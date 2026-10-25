// Round 3 (after fix round 2): unguarded fs calls in run(), the order-independent alias check, the default
// interval of 0 with its back-off, and the limits filled from Anthropic's Models API when ANTHROPIC_API_KEY is set.
// No network: fetch is always a stub or the stub-fetch preload, and no real key is used.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..");
const script = path.join(repo, "plugins", "claude", "ai-dlc", "skills", "model-metadata", "templates", "update-model-metadata.mjs");
const stub = pathToFileURL(path.join(here, "stub-fetch.mjs")).href;
const m = await import(pathToFileURL(script).href);

const fixture = (n) => fs.readFileSync(path.join(here, "fixtures", n), "utf8");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "model-metadata-r3-"));
const dataFile = (root) => path.join(root, ".ai-dlc", "model-metadata.json");
const NOW = new Date("2026-10-23T12:00:00.000Z");
const later = (min) => new Date(NOW.getTime() + min * 60_000);
const FAKE_KEY = "sk-ant-test-not-a-real-key-0000";

/** Serves the saved docs pages; `api` answers the Models API (a function of the URL, a status number, or an Error). */
function stubFetch({ overrides = {}, api } = {}) {
  const pages = {
    [m.SOURCES.pricing]: fixture("pricing.md"),
    [m.SOURCES.models]: fixture("models-overview.md"),
    [m.SOURCES.deprecations]: fixture("model-deprecations.md"),
    [m.modelPageUrl("opus-5-5")]: fixture("model-opus-5-5.md"),
    [m.modelPageUrl("haiku-5-5")]: fixture("model-haiku-5-5.md"),
    [m.modelPageUrl("opus-4-5")]: fixture("model-opus-4-5.md"),
    [m.modelPageUrl("sonnet-4-5")]: fixture("model-sonnet-4-5.md"),
    ...overrides,
  };
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    if (url.startsWith(m.MODELS_API)) {
      const a = typeof api === "function" ? api(url) : api;
      if (a instanceof Error) throw a;
      if (typeof a === "number") return { ok: false, status: a, json: async () => ({ type: "error" }) };
      if (a == null) return { ok: false, status: 404, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => a };
    }
    const body = pages[url];
    if (body instanceof Error) throw body;
    if (typeof body === "number") return { ok: false, status: body, text: async () => "" };
    if (body == null) return { ok: false, status: 404, text: async () => "" };
    return { ok: true, status: 200, text: async () => body };
  };
  fn.calls = calls;
  fn.apiCalls = () => calls.filter((c) => c.url.startsWith(m.MODELS_API));
  return fn;
}

/** Replaces one node:fs function for the duration of `body` (named ESM imports follow through syncBuiltinESMExports). */
async function withFs(name, impl, body) {
  const original = fs[name];
  fs[name] = impl(original);
  syncBuiltinESMExports();
  try { return await body(); } finally { fs[name] = original; syncBuiltinESMExports(); }
}

const fresh = async (root, extra = {}) => m.run({ root, fetchImpl: stubFetch(), now: NOW, retryStamp: path.join(tmp(), "s"), ...extra });

// ---- run(): unguarded fs calls --------------------------------------------------------------------------

test("run: a utimesSync failure on the unchanged path does not throw; it reports unchanged", async () => {
  const root = tmp();
  await fresh(root);
  const target = path.resolve(dataFile(root));
  const r = await withFs("utimesSync", (orig) => (p, ...a) => {
    if (path.resolve(String(p)) === target) throw Object.assign(new Error("EPERM: operation not permitted"), { code: "EPERM" });
    return orig(p, ...a);
  }, () => m.run({ root, fetchImpl: stubFetch(), now: later(1), retryStamp: path.join(tmp(), "s") }));
  assert.equal(r.action, "unchanged");
});

test("run: a statSync failure on the data file (removed after existsSync, EPERM) does not throw; the file is refreshed", async () => {
  const root = tmp();
  await fresh(root);
  const target = path.resolve(dataFile(root));
  const f = stubFetch();
  const r = await withFs("statSync", (orig) => (p, ...a) => {
    if (path.resolve(String(p)) === target) throw Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" });
    return orig(p, ...a);
  }, () => m.run({ root, fetchImpl: f, now: later(1), maxAgeMinutes: 60, retryStamp: path.join(tmp(), "s") }));
  assert.notEqual(r.action, "skipped", "no clock: refreshed");
  assert.ok(f.calls.length > 0);
});

test("run: mkdir failing (.ai-dlc is a regular file) reports failed and stamps; it never throws", async () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, ".ai-dlc"), "x");
  const retryStamp = path.join(tmp(), "s.retry");
  const r = await m.run({ root, fetchImpl: stubFetch(), now: NOW, retryStamp });
  assert.equal(r.action, "failed");
  assert.match(r.message, /could not write .*no file written/);
  assert.equal(fs.statSync(retryStamp).mtimeMs, NOW.getTime());
});

test("run: a successful unchanged refresh clears an old stamp", async () => {
  const root = tmp();
  const retryStamp = path.join(tmp(), "s.retry");
  await m.run({ root, fetchImpl: stubFetch(), now: NOW, retryStamp });
  fs.writeFileSync(retryStamp, ""); fs.utimesSync(retryStamp, later(-30), later(-30));
  assert.equal((await m.run({ root, fetchImpl: stubFetch(), now: later(1), retryStamp })).action, "unchanged");
  assert.equal(fs.existsSync(retryStamp), false);
});

// ---- validateMetadata: aliases ------------------------------------------------------------------------------

const doc = () => ({
  version: 1, currency: "USD", fetchedAt: NOW.toISOString(), longContextThresholdTokensOverride: null,
  models: ["a", "b", "c"].map((s) => ({
    id: `claude-${s}`, aliases: [], contextWindow: null, longContextWindow: null, maxInputTokens: null, maxOutputTokens: null,
    pricing: { input: 1, output: 2, cacheWrite5m: 1, cacheWrite1h: 1, cacheRead: 0, batchInput: null, batchOutput: null, fastInput: null, fastOutput: null },
    longContextPricing: null,
    sources: { pricing: "https://x", metadata: null, modelsApi: [] },
  })),
});

test("validateMetadata: an alias equal to a LATER model's id is caught (order-independent)", () => {
  const d = doc(); d.models[0].aliases = ["claude-c"];
  assert.match(m.validateMetadata(d).join(), /models\[claude-a\]: alias claude-c is another model's id/);
});

test("validateMetadata: an alias shared by two models is caught", () => {
  const d = doc(); d.models[0].aliases = ["claude-x"]; d.models[2].aliases = ["claude-x"];
  assert.match(m.validateMetadata(d).join(), /alias claude-x is also an alias of claude-a/);
  const ok = doc(); ok.models[0].aliases = ["claude-x"]; ok.models[1].aliases = ["claude-y"];
  assert.deepEqual(m.validateMetadata(ok), []);
});

test("validateMetadata: sources.modelsApi lists only filled limit fields", () => {
  const ok = doc(); ok.models[0].maxInputTokens = 1000; ok.models[0].sources.modelsApi = ["maxInputTokens"];
  assert.deepEqual(m.validateMetadata(ok), []);
  for (const bad of [["maxInputTokens"], ["pricing"], "maxInputTokens"]) {
    const d = doc(); d.models[0].sources.modelsApi = bad; // maxInputTokens is null here
    assert.match(m.validateMetadata(d).join(), /sources\.modelsApi/, JSON.stringify(bad));
  }
});

// ---- Models API ---------------------------------------------------------------------------------------------

/** A Models API page for the ids in the fixtures; the docs give no max input tokens for any of them. */
const apiPage = (extra = {}) => ({
  data: [
    { type: "model", id: "claude-opus-5-5", display_name: "Claude Opus 5.5", max_input_tokens: 1_000_000, max_tokens: 1 },
    { type: "model", id: "claude-haiku-5-5", display_name: "Claude Haiku 5.5", max_input_tokens: 200_000, max_tokens: null },
    { type: "model", id: "claude-opus-4-1", display_name: "Claude Opus 4.1", max_input_tokens: 0, max_tokens: 32_000 },
  ],
  has_more: false, first_id: "claude-opus-5-5", last_id: "claude-opus-4-1", ...extra,
});

test("api: without a key no Models API request is made; limits stay null and sources.modelsApi is empty", async () => {
  const root = tmp();
  const f = stubFetch({ api: apiPage() });
  assert.equal((await m.run({ root, fetchImpl: f, now: NOW, retryStamp: path.join(tmp(), "s") })).action, "updated");
  assert.equal(f.apiCalls().length, 0);
  const d = JSON.parse(fs.readFileSync(dataFile(root), "utf8"));
  assert.ok(d.models.every((x) => x.maxInputTokens === null), "the docs give no max input tokens");
  assert.ok(d.models.every((x) => Array.isArray(x.sources.modelsApi) && x.sources.modelsApi.length === 0));
  for (const key of [null, "", "   "]) assert.equal(await m.fetchApiLimits({ apiKey: key, fetchImpl: f }), null);
});

test("api: with a key, null limits are filled, docs figures are never replaced, and the fields are listed", async () => {
  const root = tmp();
  const f = stubFetch({ api: apiPage() });
  const r = await m.run({ root, fetchImpl: f, now: NOW, retryStamp: path.join(tmp(), "s"), apiKey: FAKE_KEY });
  assert.equal(r.action, "updated");
  const d = JSON.parse(fs.readFileSync(dataFile(root), "utf8"));
  const opus = d.models.find((x) => x.id === "claude-opus-5-5");
  assert.equal(opus.maxInputTokens, 1_000_000, "filled from max_input_tokens");
  assert.equal(opus.contextWindow, 1_000_000, "the page's context window");
  assert.notEqual(opus.maxOutputTokens, 1, "the page's max output is never replaced by the API's max_tokens");
  assert.deepEqual(opus.sources.modelsApi, ["maxInputTokens"]);
  const haiku = d.models.find((x) => x.id === "claude-haiku-5-5");
  assert.equal(haiku.maxInputTokens, 200_000);
  // A retired model with no page: 0 is not a figure (stays null); max_tokens fills the null max output.
  const old = d.models.find((x) => x.id === "claude-opus-4-1" || x.aliases.includes("claude-opus-4-1"));
  if (old) {
    assert.equal(old.maxInputTokens, null);
    assert.equal(old.contextWindow, null);
    assert.equal(old.maxOutputTokens, 32_000);
    assert.deepEqual(old.sources.modelsApi, ["maxOutputTokens"]);
  }
  assert.deepEqual(m.validateMetadata(d), []);
  // The request: the documented endpoint and headers; the key in x-api-key only.
  const [call] = f.apiCalls();
  assert.equal(call.url, `${m.MODELS_API}?limit=1000`);
  assert.equal(call.opts.headers["x-api-key"], FAKE_KEY);
  assert.equal(call.opts.headers["anthropic-version"], "2023-06-01");
  assert.ok(call.opts.signal, "the request has a timeout");
  for (const c of f.calls) if (!c.url.startsWith(m.MODELS_API)) assert.ok(!JSON.stringify(c.opts ?? {}).includes(FAKE_KEY), `key sent to ${c.url}`);
  assert.ok(!fs.readFileSync(dataFile(root), "utf8").includes(FAKE_KEY), "the key is never written");
  assert.ok(!r.message.includes(FAKE_KEY));
});

test("api: an invalid key (401), a 500, a thrown request or a malformed body leave the limits null; the refresh succeeds", async () => {
  for (const api of [401, 500, new TypeError("fetch failed"), { nope: true }]) {
    const root = tmp();
    const f = stubFetch({ api });
    const r = await m.run({ root, fetchImpl: f, now: NOW, retryStamp: path.join(tmp(), "s"), apiKey: FAKE_KEY });
    assert.equal(r.action, "updated", String(api));
    assert.ok(!r.message.includes(FAKE_KEY));
    const d = JSON.parse(fs.readFileSync(dataFile(root), "utf8"));
    assert.ok(d.models.every((x) => x.maxInputTokens === null && x.sources.modelsApi.length === 0), String(api));
  }
});

test("api: pages are followed through has_more and last_id", async () => {
  const f = stubFetch({
    api: (url) => (url.includes("after_id=")
      ? { data: [{ id: "claude-b", max_input_tokens: 2000, max_tokens: 20 }], has_more: false, last_id: "claude-b" }
      : { data: [{ id: "claude-a", max_input_tokens: 1000, max_tokens: 10 }], has_more: true, last_id: "claude-a" }),
  });
  const limits = await m.fetchApiLimits({ apiKey: FAKE_KEY, fetchImpl: f });
  assert.deepEqual([...limits.entries()], [["claude-a", { maxInputTokens: 1000, maxOutputTokens: 10 }], ["claude-b", { maxInputTokens: 2000, maxOutputTokens: 20 }]]);
  assert.equal(f.apiCalls()[1].url, `${m.MODELS_API}?limit=1000&after_id=claude-a`);
});

test("api: buildMetadata matches an API entry by alias too, and fills nothing when apiLimits is null", () => {
  const pages = new Map([["sonnet-4-5", { url: m.modelPageUrl("sonnet-4-5"), md: fixture("model-sonnet-4-5.md") }]]);
  const base = { pricingMd: fixture("pricing.md"), overviewMd: "", deprecationsMd: fixture("model-deprecations.md"), pages, fetchedAt: NOW.toISOString() };
  const none = m.buildMetadata(base).models.find((x) => x.aliases.includes("claude-sonnet-4-5"));
  assert.equal(none.maxInputTokens, null);
  const viaAlias = m.buildMetadata({ ...base, apiLimits: new Map([["claude-sonnet-4-5", { maxInputTokens: 777_000, maxOutputTokens: null }]]) })
    .models.find((x) => x.aliases.includes("claude-sonnet-4-5"));
  assert.equal(viaAlias.maxInputTokens, 777_000);
  assert.deepEqual(viaAlias.sources.modelsApi, ["maxInputTokens"]);
});

test("hook: with an invalid ANTHROPIC_API_KEY the hook exits 0, writes the file with null max input tokens and never prints the key", () => {
  const root = tmp();
  const r = spawnSync(process.execPath, ["--import", stub, script, "--root", root], {
    input: JSON.stringify({ hook_event_name: "Stop" }),
    encoding: "utf8",
    cwd: tmp(),
    env: Object.fromEntries(Object.entries({ ...process.env, CLAUDE_PROJECT_DIR: undefined, AI_DLC_MODEL_METADATA: "", AI_DLC_MODEL_METADATA_MAX_AGE_MINUTES: "", AI_DLC_MODEL_METADATA_LONG_CONTEXT_THRESHOLD_TOKENS: undefined, MC_STUB_MODE: "ok", ANTHROPIC_API_KEY: FAKE_KEY }).filter(([, v]) => v !== undefined)),
    timeout: 30_000,
  });
  assert.equal(r.status, 0);
  assert.ok(!(r.stdout + r.stderr).includes(FAKE_KEY));
  assert.match(JSON.parse(r.stdout.trim()).systemMessage, /created \.ai-dlc\/model-metadata\.json/);
  const text = fs.readFileSync(dataFile(root), "utf8");
  assert.ok(!text.includes(FAKE_KEY));
  assert.ok(JSON.parse(text).models.every((x) => x.maxInputTokens === null));
});

// ---- Default interval 0 through the hook -----------------------------------------------------------------

test("hook: with no settings, a stop right after another refetches (interval 0)", () => {
  const root = tmp();
  const log = path.join(tmp(), "requests.log");
  const env = Object.fromEntries(Object.entries({ ...process.env, CLAUDE_PROJECT_DIR: undefined, AI_DLC_MODEL_METADATA: "", AI_DLC_MODEL_METADATA_MAX_AGE_MINUTES: undefined, ANTHROPIC_API_KEY: undefined, MC_STUB_MODE: "ok", MC_STUB_LOG: log }).filter(([, v]) => v !== undefined));
  const go = () => spawnSync(process.execPath, ["--import", stub, script, "--root", root], { input: JSON.stringify({ hook_event_name: "Stop" }), encoding: "utf8", cwd: tmp(), env, timeout: 30_000 });
  assert.equal(go().status, 0);
  const first = fs.readFileSync(log, "utf8").split("\n").filter(Boolean).length;
  assert.equal(go().status, 0);
  const second = fs.readFileSync(log, "utf8").split("\n").filter(Boolean).length;
  assert.ok(first > 0 && second > first, "both stops fetched");
});
