#!/usr/bin/env node
// update-model-metadata.mjs — keeps .ai-dlc/model-metadata.json current (Claude Code "Stop" and
// "PreToolUse" on Bash, Copilot "agentStop" and "preToolUse" hook).
// Installed into a repository by the ai-dlc `model-metadata` skill (run by /ai-dlc:init).
//
// It fetches Anthropic's official docs pages (Markdown form), reads every model's prices and
// limits from them, and writes .ai-dlc/model-metadata.json. Nothing is estimated: a figure the
// docs do not state is null.
//   prices      : https://platform.claude.com/docs/en/about-claude/pricing.md (required)
//   model pages : https://platform.claude.com/docs/en/models/<slug>/overview.md (context window,
//                 max output, IDs); the slugs come from the models overview page and the priced names
//   status, IDs : https://platform.claude.com/docs/en/about-claude/model-deprecations.md
//
// With ANTHROPIC_API_KEY set, it also asks Anthropic's Models API (GET https://api.anthropic.com/v1/models)
// for the limits the docs leave out, and fills only those: `max_input_tokens` → maxInputTokens (and
// contextWindow when no page states one), `max_tokens` → maxOutputTokens when no page states it. The key is
// sent to api.anthropic.com only, never printed or written. Without the key, or when that call fails, those
// figures stay as the docs give them, plus any an earlier run filled from the API (see buildMetadata), and
// the refresh goes on.
//
// Time: each docs request times out after 10 s, and the Models API call, all its pages together, after 20 s.
// That call runs alongside the docs requests, so a run takes about 20 s at most, well inside the 60 s hook timeout.
//
// It never blocks: on a network error, an unexpected page or an invalid result it keeps the old
// file, prints one line and exits 0, and makes no new attempt for 10 minutes (a stamp in the user's
// cache directory holds that time). Dependency-free; Node.js 18 or later; Windows, macOS, Linux.
//
// Usage: node .claude/hooks/update-model-metadata.mjs [--force] [--before-commit] [--root <dir>]
//   --before-commit : hook mode for PreToolUse; runs only when the tool call is a `git commit`
//   --force         : ignore the refresh interval (and read no hook payload: for runs by hand)
// Settings (environment):
//   AI_DLC_MODEL_METADATA=off                    turn the hook off (also false, 0, no)
//   AI_DLC_MODEL_METADATA_MAX_AGE_MINUTES=<n>    refresh interval in minutes; default 0 = every run
//   ANTHROPIC_API_KEY=<key>                      fill the limits the docs leave out from the Models API
//   AI_DLC_MODEL_METADATA_LONG_CONTEXT_THRESHOLD_TOKENS=<n>
//                                                recorded as longContextThresholdTokensOverride (a positive
//                                                integer; anything else is null); consumers apply it

import { existsSync, mkdirSync, readFileSync, renameSync, statSync, utimesSync, writeFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const DOCS = "https://platform.claude.com/docs/en";
export const SOURCES = {
  pricing: `${DOCS}/about-claude/pricing.md`,
  models: `${DOCS}/models/overview.md`,
  deprecations: `${DOCS}/about-claude/model-deprecations.md`,
};
export const modelPageUrl = (slug) => `${DOCS}/models/${slug}/overview.md`;
export const FILE = path.join(".ai-dlc", "model-metadata.json");
export const DEFAULT_MAX_AGE_MINUTES = 0;
export const RETRY_AFTER_FAILURE_MINUTES = 10;
/** The time limit of one docs request. */
export const REQUEST_TIMEOUT_MS = 10_000;
export const MODELS_API = "https://api.anthropic.com/v1/models";
export const ANTHROPIC_VERSION = "2023-06-01";
/**
 * The largest page the Models API serves. Its `limit` parameter: "Defaults to 20. Ranges from 1 to 1000."
 * (https://platform.claude.com/docs/en/api/models/list).
 */
export const MODELS_API_PAGE_SIZE = 1000;
export const MODELS_API_MAX_PAGES = 10;
/** One deadline for the whole Models API call, every page included. */
export const MODELS_API_DEADLINE_MS = 20_000;

/**
 * The user's own cache directory: $XDG_CACHE_HOME when it is an absolute path, else %LOCALAPPDATA% on
 * Windows, else ~/.cache. Null when none can be found (no home directory): the back-off is then off.
 */
export function userCacheDir(env = process.env, platform = process.platform, homedir = os.homedir) {
  const abs = (v) => (typeof v === "string" && v !== "" && path.isAbsolute(v) ? v : null);
  const xdg = abs(env.XDG_CACHE_HOME);
  if (xdg) return xdg;
  if (platform === "win32") {
    const local = abs(env.LOCALAPPDATA);
    if (local) return local;
  }
  let home = null;
  try { home = abs(homedir()); } catch { home = null; }
  return home ? path.join(home, ".cache") : null;
}

/**
 * The back-off stamp of a repository: an empty file in the user's cache directory,
 * `<cache>/ai-dlc/model-metadata-<hash of the repository root>.retry`, whose modification time is the
 * last failed refresh. While it is under RETRY_AFTER_FAILURE_MINUTES old no refresh is tried, so an
 * offline machine does not call the network on every stop, and nothing is written into the repository.
 * A successful run deletes it. It sits in a directory only its user can write, not the shared OS temp
 * directory, so another user cannot plant a file or a link at its path. Null when there is no cache
 * directory.
 */
export function retryStampPath(root, env = process.env, platform = process.platform, homedir = os.homedir) {
  const dir = userCacheDir(env, platform, homedir);
  if (!dir) return null;
  const hash = createHash("sha256").update(path.resolve(root)).digest("hex").slice(0, 16);
  return path.join(dir, "ai-dlc", `model-metadata-${hash}.retry`);
}

// ---------------------------------------------------------------------------------------------
// Markdown helpers
// ---------------------------------------------------------------------------------------------

const stripTags = (s) => s.replace(/<sup>.*?<\/sup>/gi, "").replace(/<[^>]+>/g, "");
const stripLinks = (s) => s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
const plain = (s) => stripLinks(stripTags(s)).replace(/[*`]/g, "").trim();

/** Splits a Markdown table row into trimmed cells (the tables on these pages hold no escaped pipes). */
export function cells(line) {
  const t = line.trim();
  if (!t.startsWith("|")) return null;
  return t.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

/**
 * The tables in `md`, each as { heading, header, rows }: `heading` is the nearest heading above it,
 * `header` its first row, `rows` the data rows (the separator row dropped).
 */
export function tables(md) {
  const out = [];
  let heading = "";
  let current = null;
  for (const line of md.split(/\r?\n/)) {
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    if (h) { heading = h[1].trim(); current = null; continue; }
    const c = cells(line);
    if (!c) { current = null; continue; }
    if (!current) { current = { heading, header: c, rows: [] }; out.push(current); continue; }
    if (c.every((x) => /^:?-{2,}:?$/.test(x))) continue;
    current.rows.push(c);
  }
  return out;
}

/** "$0.20 / MTok<sup>2</sup>" → 0.2; "$8 USD / MTok" → 8; anything else → null. */
export function money(cell) {
  if (cell == null) return null;
  const m = /\$\s*(\d[\d,]*(?:\.\d+)?|\.\d+)/.exec(stripTags(cell));
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

/** "1M tokens" → 1000000; "200K tokens" → 200000; "128,000 tokens" → 128000; else null. */
export function tokens(cell) {
  if (cell == null) return null;
  const m = /(\d[\d,]*(?:\.\d+)?)\s*([KkMm])?\b/.exec(plain(cell));
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  const mult = { k: 1_000, m: 1_000_000 }[(m[2] ?? "").toLowerCase()] ?? 1;
  return Math.round(n * mult);
}

// ---------------------------------------------------------------------------------------------
// Model names and IDs
// ---------------------------------------------------------------------------------------------

/**
 * "Claude Haiku 5.5 (for prompts over 100,000 tokens)" →
 * { name: "Claude Haiku 5.5", note: null, tier: { over: true, threshold: 100000 } }.
 * "Claude X 1 (for long prompts)" → tier { over: true, threshold: null }: a long-context row that states no threshold.
 * "Claude Opus 4.1 ([retired, except on …](…))" → { name: "Claude Opus 4.1", note: "retired, except on …" }.
 */
export function modelName(cell) {
  let s = stripTags(cell).trim();
  let note = null;
  let tier = null;
  const linked = /\(\[([^\]]+)\]\([^)]*\)\)/.exec(s);
  if (linked) { note = linked[1].trim(); s = s.replace(linked[0], ""); }
  const t = /\(for prompts (up to|over) ([\d,]+) tokens\)/i.exec(s);
  if (t) { tier = { over: t[1].toLowerCase() === "over", threshold: Number(t[2].replace(/,/g, "")) }; s = s.replace(t[0], ""); }
  const long = !t && /\(for long prompts\)|\(long[- ]context\)/i.exec(s);
  if (long) { tier = { over: true, threshold: null }; s = s.replace(long[0], ""); }
  const rest = /\(([^)]*)\)/.exec(s);
  if (rest && !note) { note = rest[1].trim(); s = s.replace(rest[0], ""); }
  return { name: plain(s).replace(/\s+/g, " "), note, tier };
}

/** "Claude Opus 4.5" → "opus-4-5"; "Claude Mythos Preview" → "mythos-preview"; null if not a Claude name. */
export function nameKey(name) {
  const m = /^Claude\s+([A-Za-z]+)(?:\s+(\d+(?:\.\d+)?|Preview))?$/.exec(name.trim());
  if (!m) return null;
  return [m[1].toLowerCase(), m[2] ? m[2].toLowerCase().replace(".", "-") : null].filter(Boolean).join("-");
}

/**
 * The name key of an API model ID: "claude-opus-4-5-20251101" → "opus-4-5", "claude-opus-5" → "opus-5",
 * "claude-3-5-haiku-20241022" → "haiku-3-5"; IDs of another shape → null.
 */
export function idKey(id) {
  let m = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?$/.exec(id);
  if (m) return [m[1], m[2], m[3]].filter(Boolean).join("-");
  m = /^claude-([a-z]+)-preview$/.exec(id);
  if (m) return `${m[1]}-preview`;
  m = /^claude-(\d+)(?:-(\d{1,2}))?-([a-z]+)-\d{8}$/.exec(id);
  if (m) return [m[3], m[1], m[2]].filter(Boolean).join("-");
  return null;
}

/**
 * The ID a model has on the Claude API when no page names it: the dateless form the docs give for the
 * 4.6 generation and later (`claude-{name}-{major}[-{minor}]`), which for earlier models is their alias.
 */
export const derivedId = (key) => `claude-${key}`;

/** A dated pre-4.6 ID's documented dateless alias: "claude-sonnet-4-5-20250929" → "claude-sonnet-4-5". */
export function datelessAlias(id) {
  const m = /^(claude-[a-z]+-\d+-\d{1,2})-\d{8}$/.exec(id);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------------------------
// Page parsers (pure: Markdown in, data out)
// ---------------------------------------------------------------------------------------------

const PRICE_COLUMNS = {
  input: /^base input/i,
  cacheWrite5m: /^5m cache write/i,
  cacheWrite1h: /^1h cache write/i,
  cacheRead: /^cache (hits|read)/i,
  output: /^output/i,
};

function columnIndex(header, patterns) {
  const idx = {};
  for (const [key, re] of Object.entries(patterns)) {
    const i = header.findIndex((h) => re.test(plain(h)));
    if (i < 0) return null;
    idx[key] = i;
  }
  return idx;
}

/**
 * Parses the pricing page. Returns { models: Map(key → entry), errors } where an entry is
 * { key, name, note, pricing, longContextPricing }. Throws when the model pricing table is missing
 * or has unexpected columns: that means the page changed shape, and the old file is kept.
 */
export function parsePricingPage(md) {
  const all = tables(md);
  const main = all.find((t) => /^model pricing$/i.test(t.heading) && /^model$/i.test(plain(t.header[0])));
  if (!main) throw new Error("pricing page: no table under \"Model pricing\"");
  const idx = columnIndex(main.header, PRICE_COLUMNS);
  if (!idx) throw new Error(`pricing page: unexpected columns ${JSON.stringify(main.header.map(plain))}`);

  const models = new Map();
  for (const row of main.rows) {
    const { name, note, tier } = modelName(row[0]);
    const key = nameKey(name);
    if (!key) throw new Error(`pricing page: unrecognised model name "${name}"`);
    const prices = {};
    for (const [field, i] of Object.entries(idx)) {
      const v = money(row[i]);
      if (v == null) throw new Error(`pricing page: no ${field} price for ${name}`);
      prices[field] = v;
    }
    const entry = models.get(key) ?? { key, name, note, pricing: null, longContextPricing: null };
    if (tier?.over) entry.longContextPricing = { thresholdTokens: tier.threshold, ...prices, batchInput: null, batchOutput: null };
    else entry.pricing = { ...prices, batchInput: null, batchOutput: null, fastInput: null, fastOutput: null };
    entry.note ??= note;
    models.set(key, entry);
  }
  for (const e of models.values()) if (!e.pricing) throw new Error(`pricing page: ${e.name} has only a long-context price row`);

  // Batch prices (optional section).
  const batch = all.find((t) => /^batch processing$/i.test(t.heading) && /^model$/i.test(plain(t.header[0])));
  const bIdx = batch && columnIndex(batch.header, { input: /^batch input/i, output: /^batch output/i });
  if (bIdx) {
    for (const row of batch.rows) {
      const { name, tier } = modelName(row[0]);
      const e = models.get(nameKey(name));
      if (!e) continue;
      const target = tier?.over ? e.longContextPricing : e.pricing;
      if (!target) continue;
      target.batchInput = money(row[bIdx.input]);
      target.batchOutput = money(row[bIdx.output]);
    }
  }

  // Fast mode prices (optional section; one row may name several models: "Claude Opus 5 / Claude Opus 4.8").
  const fast = all.find((t) => /^fast mode pricing$/i.test(t.heading) && /^model$/i.test(plain(t.header[0])));
  const fIdx = fast && columnIndex(fast.header, { input: /^input/i, output: /^output/i });
  if (fIdx) {
    for (const row of fast.rows) {
      for (const part of plain(row[0]).split(/\s*\/\s*/)) {
        const e = models.get(nameKey(modelName(part).name));
        if (!e) continue;
        e.pricing.fastInput = money(row[fIdx.input]);
        e.pricing.fastOutput = money(row[fIdx.output]);
      }
    }
  }
  return models;
}

/** The model page slugs the models overview page links to ("opus-4-5", "fable-5-1", …). */
export function parseOverviewSlugs(md) {
  const slugs = new Set();
  for (const m of md.matchAll(/\/docs\/en\/models\/([a-z0-9-]+)\/overview\b/g)) slugs.add(m[1]);
  return [...slugs];
}

/** The deprecations page's "Model status" table: Map(name key → [{ id, status }]). */
export function parseDeprecationsPage(md) {
  const t = tables(md).find((x) => /^model status$/i.test(x.heading));
  const byKey = new Map();
  if (!t) return byKey;
  const iId = t.header.findIndex((h) => /model name/i.test(plain(h)));
  const iState = t.header.findIndex((h) => /current state/i.test(plain(h)));
  if (iId < 0 || iState < 0) return byKey;
  for (const row of t.rows) {
    const id = plain(row[iId]);
    const key = idKey(id);
    if (!key) continue;
    const status = plain(row[iState]).toLowerCase();
    (byKey.get(key) ?? byKey.set(key, []).get(key)).push({ id, status: ["active", "deprecated", "retired"].includes(status) ? status : null });
  }
  return byKey;
}

/**
 * A model page (models/<slug>/overview.md) → { name, id, alias, contextWindow, longContextWindow,
 * maxInputTokens, maxOutputTokens }. Figures the page does not state are null.
 */
export function parseModelPage(md) {
  const title = /^title:\s*(.+)$/m.exec(md)?.[1]?.trim().replace(/^["']|["']$/g, "") ?? null;
  const out = { name: title, id: null, alias: null, contextWindow: null, longContextWindow: null, maxInputTokens: null, maxOutputTokens: null };
  out.id = /^Model ID:\s*`([^`]+)`/m.exec(md)?.[1] ?? null;
  for (const t of tables(md)) {
    if (/^model ids$/i.test(t.heading)) {
      for (const row of t.rows) {
        const label = plain(row[0]);
        const value = /`([^`]+)`/.exec(row[1] ?? "")?.[1] ?? null;
        if (/^claude api$/i.test(label)) out.id ??= value;
        if (/^claude api alias$/i.test(label)) out.alias = value;
      }
    }
    if (/^capabilities$/i.test(t.heading)) {
      for (const row of t.rows) {
        const label = plain(row[0]);
        if (/^context window$/i.test(label)) out.contextWindow = tokens(row[1]);
        else if (/context window/i.test(label) && /(beta|long|extended)/i.test(label)) out.longContextWindow = tokens(row[1]);
        else if (/^max input/i.test(label)) out.maxInputTokens = tokens(row[1]);
        else if (/^max output$/i.test(label)) out.maxOutputTokens = tokens(row[1]);
      }
    }
  }
  // The summary line under the title, when the Capabilities table is absent.
  const summary = /^Context window:\s*([^·\n]+)·\s*Max output:\s*([^·\n]+)/m.exec(md);
  if (summary) {
    out.contextWindow ??= tokens(summary[1]);
    out.maxOutputTokens ??= tokens(summary[2]);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Assembly and validation
// ---------------------------------------------------------------------------------------------

/**
 * Builds the file's content from parsed pages. `pages` is Map(slug → { url, md }) of the model pages
 * that exist (404s left out). `priced` is parsePricingPage(pricingMd), passed in when the caller has it.
 * `apiLimits` is Map(model id → { maxInputTokens, maxOutputTokens }) from the Models API, or null. It
 * fills only figures the docs leave null; each model lists the fields it filled in `sources.modelsApi`.
 * `previous` is the old file's content, or null. When `apiLimits` is null (no key, or the call failed), a
 * figure the old file lists in its `sources.modelsApi` is kept, again only where the docs leave it null, so
 * a run without the key does not undo a run with it. A fresh API answer always replaces the kept figures.
 */
/**
 * The limits the Models API can fill, in the order buildMetadata fills them, so a kept
 * `sources.modelsApi` list reads like a fresh one.
 */
const API_FIELDS = ["maxInputTokens", "contextWindow", "maxOutputTokens"];

export function buildMetadata({ pricingMd, overviewMd, deprecationsMd, pages, fetchedAt, longContextThresholdTokensOverride = null, priced = parsePricingPage(pricingMd), apiLimits = null, previous = null }) {
  const status = deprecationsMd ? parseDeprecationsPage(deprecationsMd) : new Map();
  const byKey = new Map();
  for (const [slug, { url, md }] of pages ?? new Map()) {
    const page = parseModelPage(md);
    const key = (page.name && nameKey(page.name)) ?? slug;
    byKey.set(key, { ...page, url });
  }

  const models = [];
  for (const e of priced.values()) {
    const page = byKey.get(e.key) ?? null;
    const listed = status.get(e.key) ?? [];
    const id = page?.id ?? listed[0]?.id ?? derivedId(e.key);
    const aliases = new Set();
    if (page?.alias && page.alias !== id) aliases.add(page.alias);
    const dateless = datelessAlias(id);
    if (dateless) aliases.add(dateless);
    for (const l of listed) if (l.id !== id) aliases.add(l.id);
    const limits = {
      contextWindow: page?.contextWindow ?? null,
      longContextWindow: page?.longContextWindow ?? null,
      maxInputTokens: page?.maxInputTokens ?? null,
      maxOutputTokens: page?.maxOutputTokens ?? null,
    };
    const fromApi = [];
    // A docs figure is never overridden: the API fills only what the pages leave null.
    const fill = (field, value) => { if (limits[field] === null && value !== null) { limits[field] = value; fromApi.push(field); } };
    const api = apiLimits ? [id, ...aliases].map((x) => apiLimits.get(x)).find(Boolean) : null;
    if (api) {
      fill("maxInputTokens", api.maxInputTokens);
      fill("contextWindow", api.maxInputTokens);
      fill("maxOutputTokens", api.maxOutputTokens);
    } else if (apiLimits === null) {
      const prev = previousModel(previous, id);
      const kept = Array.isArray(prev?.sources?.modelsApi) ? prev.sources.modelsApi : [];
      for (const field of API_FIELDS) if (kept.includes(field)) fill(field, positive(prev[field]));
    }
    models.push({
      id,
      aliases: [...aliases],
      name: e.name,
      status: (listed.find((l) => l.id === id) ?? listed[0])?.status ?? null,
      note: e.note,
      ...limits,
      pricing: e.pricing,
      longContextPricing: e.longContextPricing,
      sources: { pricing: SOURCES.pricing.replace(/\.md$/, ""), metadata: page ? page.url.replace(/\.md$/, "") : null, modelsApi: fromApi },
    });
  }
  return {
    $schema: "./model-metadata.schema.json",
    version: 1,
    currency: "USD",
    unit: "MTok",
    source: SOURCES.pricing.replace(/\.md$/, ""),
    sources: Object.fromEntries(Object.entries(SOURCES).map(([k, v]) => [k, v.replace(/\.md$/, "")])),
    fetchedAt,
    longContextThresholdTokensOverride,
    models,
  };
}

const PRICE_KEYS = ["input", "output", "cacheWrite5m", "cacheWrite1h", "cacheRead"];

/** The old file's entry for model `id`, or null. */
function previousModel(previous, id) {
  return Array.isArray(previous?.models) ? previous.models.find((x) => x?.id === id) ?? null : null;
}
const isPrice = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
const isCount = (v) => v === null || (Number.isInteger(v) && v > 0);

/** Checks the shape the schema describes; returns a list of problems (empty when valid). */
export function validateMetadata(doc) {
  const p = [];
  if (!doc || typeof doc !== "object") return ["not an object"];
  if (doc.version !== 1) p.push("version must be 1");
  if (doc.currency !== "USD") p.push("currency must be USD");
  if (typeof doc.fetchedAt !== "string" || Number.isNaN(Date.parse(doc.fetchedAt))) p.push("fetchedAt must be a date-time");
  if (!("longContextThresholdTokensOverride" in doc) || !isCount(doc.longContextThresholdTokensOverride)) p.push("longContextThresholdTokensOverride must be a positive integer or null");
  if (!Array.isArray(doc.models) || doc.models.length < 3) p.push("models must list at least 3 models");
  // Every id first, so the alias checks do not depend on the order of the models.
  const ids = new Set();
  for (const m of doc.models ?? []) {
    if (ids.has(m?.id)) p.push(`models[${m?.id ?? "?"}]: duplicate id`);
    ids.add(m?.id);
  }
  const aliasOwner = new Map();
  for (const m of doc.models ?? []) {
    const at = `models[${m?.id ?? "?"}]`;
    if (typeof m?.id !== "string" || !/^claude-[a-z0-9.-]+$/.test(m.id)) p.push(`${at}: bad id`);
    for (const a of m?.aliases ?? []) {
      if (ids.has(a)) p.push(`${at}: alias ${a} is another model's id`);
      const owner = aliasOwner.get(a);
      if (owner !== undefined && owner !== m.id) p.push(`${at}: alias ${a} is also an alias of ${owner}`);
      aliasOwner.set(a, m.id);
    }
    for (const k of ["contextWindow", "longContextWindow", "maxInputTokens", "maxOutputTokens"]) if (!isCount(m[k])) p.push(`${at}: ${k} must be a positive integer or null`);
    const fromApi = m?.sources?.modelsApi;
    if (fromApi !== undefined && (!Array.isArray(fromApi) || fromApi.some((f) => !API_FIELDS.includes(f) || m[f] === null))) p.push(`${at}: sources.modelsApi must list filled fields among ${API_FIELDS.join(", ")}`);
    for (const k of PRICE_KEYS) if (!isPrice(m.pricing?.[k])) p.push(`${at}: pricing.${k} must be a number`);
    for (const k of ["batchInput", "batchOutput", "fastInput", "fastOutput"]) if (m.pricing?.[k] !== null && !isPrice(m.pricing?.[k])) p.push(`${at}: pricing.${k} must be a number or null`);
    if (m.longContextPricing !== null) {
      if (!m.longContextPricing || !("thresholdTokens" in m.longContextPricing) || !isCount(m.longContextPricing.thresholdTokens)) p.push(`${at}: longContextPricing.thresholdTokens must be a positive integer or null`);
      for (const k of PRICE_KEYS) if (!isPrice(m.longContextPricing?.[k])) p.push(`${at}: longContextPricing.${k} must be a number`);
    }
  }
  return p;
}

/** The content without `fetchedAt`, to tell a real change from a refetch of the same prices. */
const comparable = (doc) => JSON.stringify({ ...doc, fetchedAt: undefined });

// ---------------------------------------------------------------------------------------------
// Fetching and the run
// ---------------------------------------------------------------------------------------------

/** GET a docs page; resolves to its text, or null on 404. Throws on any other failure. */
async function get(url, fetchImpl) {
  const res = await fetchImpl(url, { redirect: "follow", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: { accept: "text/markdown, text/plain" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return await res.text();
}

const positive = (v) => (Number.isSafeInteger(v) && v > 0 ? v : null);

/**
 * The limits Anthropic's Models API gives for every model the key can see:
 * Map(model id → { maxInputTokens: max_input_tokens, maxOutputTokens: max_tokens }), a value that is not
 * a positive integer read as null. Null when there is no key or the call fails in any way, all or
 * nothing: a failed page, MODELS_API_DEADLINE_MS passed, or MODELS_API_MAX_PAGES read with `has_more`
 * still true. The limits then stay as the docs give them, plus the figures an earlier run filled from
 * the API (see buildMetadata). The key goes in the `x-api-key` header to api.anthropic.com and nowhere
 * else (a redirect is an error, never followed), and no message or error carries it.
 */
export async function fetchApiLimits({ apiKey, fetchImpl = globalThis.fetch }) {
  const key = typeof apiKey === "string" ? apiKey.trim() : "";
  if (!key) return null;
  try {
    const limits = new Map();
    const signal = AbortSignal.timeout(MODELS_API_DEADLINE_MS);
    let after = null;
    for (let page = 0; page < MODELS_API_MAX_PAGES; page++) {
      const url = `${MODELS_API}?limit=${MODELS_API_PAGE_SIZE}${after ? `&after_id=${encodeURIComponent(after)}` : ""}`;
      const res = await fetchImpl(url, { redirect: "error", signal, headers: { "x-api-key": key, "anthropic-version": ANTHROPIC_VERSION, accept: "application/json" } });
      if (!res.ok) return null;
      const body = await res.json();
      if (!Array.isArray(body?.data)) return null;
      for (const m of body.data) {
        if (typeof m?.id === "string") limits.set(m.id, { maxInputTokens: positive(m.max_input_tokens), maxOutputTokens: positive(m.max_tokens) });
      }
      if (!body.has_more || typeof body.last_id !== "string") return limits;
      after = body.last_id;
    }
    // The page cap was reached with pages still left: a partial list is discarded like a failed page.
    return null;
  } catch {
    return null;
  }
}

/** Fetches every page and builds the file's content. Throws on a network error or a changed page. */
export async function fetchMetadata({ fetchImpl = globalThis.fetch, now = new Date(), longContextThresholdTokensOverride = null, apiKey = null, previous = null } = {}) {
  const [pricingMd, overviewMd, deprecationsMd, apiLimits] = await Promise.all([
    get(SOURCES.pricing, fetchImpl),
    get(SOURCES.models, fetchImpl),
    get(SOURCES.deprecations, fetchImpl),
    fetchApiLimits({ apiKey, fetchImpl }),
  ]);
  if (!pricingMd) throw new Error(`${SOURCES.pricing}: not found`);
  const priced = parsePricingPage(pricingMd);
  const slugs = new Set(overviewMd ? parseOverviewSlugs(overviewMd) : []);
  for (const key of priced.keys()) slugs.add(key);
  const pages = new Map();
  // Promise.all, not allSettled: one model page that fails (a timeout) fails the whole refresh and the
  // old file is kept. Leaving that page out instead would write null over limits the old file knows.
  // About twenty pages, fetched at once; no concurrency bound is needed at that size.
  await Promise.all([...slugs].map(async (slug) => {
    const url = modelPageUrl(slug);
    const md = await get(url, fetchImpl);
    if (md) pages.set(slug, { url, md });
  }));
  return buildMetadata({ pricingMd, overviewMd, deprecationsMd, pages, fetchedAt: now.toISOString(), longContextThresholdTokensOverride, priced, apiLimits, previous });
}

/** Is the tool call in this hook payload a `git commit`? Claude: tool_input.command; Copilot: toolArgs. */
export function isGitCommit(payload) {
  let cmd = payload?.tool_input?.command;
  if (cmd == null && payload?.toolArgs != null) {
    let args = payload.toolArgs;
    if (typeof args === "string") { try { args = JSON.parse(args); } catch { args = { command: args }; } }
    cmd = args?.command;
  }
  if (typeof cmd !== "string") return false;
  return /(^|[\s;&|(])git(\s+(-C|-c)\s+\S+|\s+--[\w-]+(=\S+)?)*\s+commit(?![\w-])/.test(cmd);
}

/** The modification time of `file` in ms, or null when there is no path, or the file is missing or unreadable. */
function stampTime(file) {
  if (!file) return null;
  try { return statSync(file).mtimeMs; } catch { return null; }
}

/** Records a failed refresh at `now` in `stampFile`; nothing when there is no stamp path. */
function stamp(stampFile, now) {
  if (!stampFile) return;
  try {
    mkdirSync(path.dirname(stampFile), { recursive: true, mode: 0o700 });
    writeFileSync(stampFile, "");
    utimesSync(stampFile, now, now);
  } catch { /* the back-off is a nicety */ }
}

/** Deletes the back-off stamp after a successful refresh. */
function clearStamp(stampFile) {
  if (!stampFile) return;
  try { rmSync(stampFile, { force: true }); } catch { /* a stale stamp only delays one retry */ }
}

/** Is the clock reading `since` (ms) set and under `minutes` old at `now`? A reading in the future is not. */
function within(since, now, minutes) {
  if (since === null) return false;
  const age = now.getTime() - since;
  return age >= 0 && age < minutes * 60_000;
}

/**
 * One hook run. Returns { action: "skipped"|"unchanged"|"updated"|"failed", message }.
 * Never throws; on failure the old file stays as it was.
 */
export async function run({ root, force = false, maxAgeMinutes = DEFAULT_MAX_AGE_MINUTES, fetchImpl = globalThis.fetch, now = new Date(), retryStamp = retryStampPath(root), longContextThresholdTokensOverride = null, apiKey = null }) {
  const file = path.join(root, FILE);
  const had = existsSync(file);
  if (!force) {
    // After a failure, no new try for RETRY_AFTER_FAILURE_MINUTES, whatever the interval (0 included).
    if (within(stampTime(retryStamp), now, RETRY_AFTER_FAILURE_MINUTES)) return { action: "skipped", message: "" };
    // The file's mtime is the refresh clock; a file whose mtime cannot be read has no clock and is refreshed.
    if (had && maxAgeMinutes > 0 && within(stampTime(file), now, maxAgeMinutes)) return { action: "skipped", message: "" };
  }
  // The old content: compared with the new one, and the source of the API figures kept when the API is not read.
  let old = null;
  if (had) { try { old = JSON.parse(readFileSync(file, "utf8")); } catch { old = null; } }
  let doc;
  try {
    doc = await fetchMetadata({ fetchImpl, now, longContextThresholdTokensOverride, apiKey, previous: old });
    const problems = validateMetadata(doc);
    if (problems.length) throw new Error(`invalid result: ${problems.slice(0, 3).join("; ")}`);
  } catch (e) {
    stamp(retryStamp, now);
    return { action: "failed", message: `model metadata: could not refresh ${FILE.replace(/\\/g, "/")} (${e?.message ?? e}); ${had ? "kept the old file" : "no file written"}` };
  }
  if (old && comparable(old) === comparable(doc)) {
    try { utimesSync(file, now, now); } catch { /* the clock is a nicety: the next run refetches */ }
    clearStamp(retryStamp);
    return { action: "unchanged", message: "" };
  }
  const tmp = `${file}.tmp-${process.pid}`;
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(tmp, JSON.stringify(doc, null, 2) + "\n");
    renameSync(tmp, file);
  } catch (e) {
    try { rmSync(tmp, { force: true }); } catch { /* nothing to clean */ }
    stamp(retryStamp, now);
    return { action: "failed", message: `model metadata: could not write ${FILE.replace(/\\/g, "/")} (${e?.message ?? e}); ${had ? "kept the old file" : "no file written"}` };
  }
  clearStamp(retryStamp);
  return { action: "updated", message: `model metadata: ${had ? "updated" : "created"} ${FILE.replace(/\\/g, "/")} (${doc.models.length} models)` };
}

// ---------------------------------------------------------------------------------------------
// Hook entry point
// ---------------------------------------------------------------------------------------------

/** AI_DLC_MODEL_METADATA_LONG_CONTEXT_THRESHOLD_TOKENS → a positive integer, or null when unset or not one. */
export function thresholdOverride(value) {
  const t = String(value ?? "").trim();
  return /^\d+$/.test(t) && Number(t) > 0 && Number.isSafeInteger(Number(t)) ? Number(t) : null;
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = (n) => argv.includes(n);
  const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };

  const off = (process.env.AI_DLC_MODEL_METADATA ?? "").toLowerCase();
  if (["off", "false", "0", "no"].includes(off)) return;

  // Hooks send a JSON payload on stdin. A run by hand (--force) reads none, so it never waits on a terminal.
  let payload = null;
  if (!process.stdin.isTTY && !flag("--force")) {
    try { const raw = readFileSync(0, "utf8"); if (raw.trim()) payload = JSON.parse(raw); } catch { payload = null; }
  }
  if (flag("--before-commit") && !isGitCommit(payload)) return;

  const envAge = Number(process.env.AI_DLC_MODEL_METADATA_MAX_AGE_MINUTES);
  const maxAgeMinutes = Number.isFinite(envAge) && envAge >= 0 && process.env.AI_DLC_MODEL_METADATA_MAX_AGE_MINUTES !== "" ? envAge : DEFAULT_MAX_AGE_MINUTES;
  // An empty value counts as unset: the next source is used.
  const root = path.resolve([opt("--root"), process.env.CLAUDE_PROJECT_DIR, payload?.cwd].find((v) => typeof v === "string" && v !== "") ?? process.cwd());

  const result = await run({ root, force: flag("--force"), maxAgeMinutes, longContextThresholdTokensOverride: thresholdOverride(process.env.AI_DLC_MODEL_METADATA_LONG_CONTEXT_THRESHOLD_TOKENS), apiKey: process.env.ANTHROPIC_API_KEY ?? null });
  if (!result.message) return;
  const msg = flag("--before-commit") && result.action === "updated" ? `${result.message} — not staged; \`git add ${FILE.replace(/\\/g, "/")}\` to include it in this commit` : result.message;
  // Claude Code shows a hook's systemMessage to the user; other callers get a plain line.
  if (payload && typeof payload.hook_event_name === "string") process.stdout.write(JSON.stringify({ systemMessage: msg }) + "\n");
  else process.stderr.write(msg + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  // Set the exit code rather than exiting at once: the process ends on its own once stdout has flushed, so the
  // systemMessage JSON is never cut short when stdout is a pipe.
  main().catch((e) => { process.stderr.write(`model metadata: ${e?.message ?? e}\n`); }).finally(() => { process.exitCode = 0; });
}
