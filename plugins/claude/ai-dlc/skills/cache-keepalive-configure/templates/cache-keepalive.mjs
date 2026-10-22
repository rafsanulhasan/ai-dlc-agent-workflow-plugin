#!/usr/bin/env node
// cache-keepalive.mjs: shows, writes and checks a repository's .ai-dlc/cache-keepalive.json, the settings of
// the ai-dlc plugin's keep-alive (Claude Code only). Zero dependencies; tested on Node 22 and later.
// It lives in the plugin's cache-keepalive-configure skill folder; the cache-keepalive-install and
// cache-keepalive-merge skills, and init, run it from there by relative path. The schema next to it lists every key, its
// environment variable, its kind and its default. The hooks module
// (hooks/keepalive/settings.ts, SETTINGS) is the source of those; tests/auto-handoff/ in the plugin
// repository checks the two agree, and that this file resolves values as the module does.
//
//   show [--json]               each key's effective value and where it comes from
//   install [--dry-run]         create the file with every default (first use only; an existing file is left alone)
//   merge [--dry-run]           bring an existing file up to date: add new keys, rewrite null and legacy values, remove retired ones, keep values
//   validate                    check the file and the AI_DLC_KEEPALIVE_* variables in the settings files' env; each finding is a warning (exit 0)
//   set <key>=<value>... [--dry-run]   internal write, for the cache-keepalive-configure skill and init only, never a
//                               user command (a dot is one nesting level; JSON literal or plain text; null is refused)
//
// Options: --root <dir> (default: git root, else the working directory).
// Each key is read, highest first, from a /ai-dlc:cache-keepalive override (keep-warm times only, per track;
// kept in the plugin's store, not readable here), `env` in .claude/settings.local.json, `env` in
// .claude/settings.json, .ai-dlc/cache-keepalive.json, then the default. Keep-alive has no /config rows,
// and the process environment is not read. Keys the schema marks x-trustGated apply from the two
// committed sources (the env of .claude/settings.json and this file) only when Claude Code trusts the
// folder, as in the module; `show` reads the trust flag from ~/.claude.json and nothing else from it.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_FILE = path.join(HERE, "cache-keepalive.schema.json");
const FILE_NAME = "cache-keepalive.json";
const SCHEMA_NAME = "cache-keepalive.schema.json";
// Where a person sets a trust-gated setting instead: the module's words (hooks/keepalive/keepalive.ts, GATED_INSTEAD).
const GATED_INSTEAD = "set them in the env of .claude/settings.local.json instead (a keep-warm time also with /ai-dlc:cache-keepalive)";

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const readMaybe = (file) => { try { return fs.readFileSync(file, "utf8").replace(/^﻿/, ""); } catch { return undefined; } };

// ---- files and workspace trust -------------------------------------------------------------------
// Copied from the configure-auto-handoff skill's CLI (templates/auto-handoff.mjs), which keeps its own
// copy, so that each skill runs on its own. The rules are the hooks module's (hooks/auto-handoff/config.ts,
// settingsEnv and trustOf; hooks/auto-handoff/io.ts, trustTarget), which keep-alive also uses.

// A settings file's text with its line and block comments removed, strings left as they are.
function stripComments(text) {
  let out = "", i = 0, inStr = false;
  while (i < text.length) {
    const c = text[i], d = text[i + 1];
    if (inStr) {
      out += c;
      if (c === "\\") { out += d ?? ""; i += 2; continue; }
      if (c === "\"") inStr = false;
      i++;
    } else if (c === "\"") { inStr = true; out += c; i++; }
    else if (c === "/" && d === "/") { while (i < text.length && text[i] !== "\n") i++; }
    else if (c === "/" && d === "*") { const e = text.indexOf("*/", i + 2); i = e === -1 ? text.length : e + 2; }
    else { out += c; i++; }
  }
  return out;
}

/** The `env` object of .claude/<name> (comments allowed), or null; a problem is pushed to `warnings`. */
export function settingsEnv(root, name, warnings) {
  const rel = `.claude/${name}`;
  const text = readMaybe(path.join(root, ".claude", name));
  if (text === undefined) return null;
  let doc;
  try { doc = JSON.parse(stripComments(text)); } catch { warnings.push(`${rel} is not valid JSON (comments allowed); its env is skipped`); return null; }
  if (!isObj(doc)) { warnings.push(`${rel}: top level is not an object; its env is skipped`); return null; }
  if (!("env" in doc)) return null;
  if (!isObj(doc.env)) { warnings.push(`${rel}: env is not an object; skipped`); return null; }
  return doc.env;
}

/** The repository file: { doc } (null when missing) or { error }. */
export function readRepoFile(file) {
  const text = readMaybe(file);
  if (text === undefined) return { doc: null };
  let doc;
  try { doc = JSON.parse(text); } catch (e) { return { error: `not valid JSON: ${e.message}` }; }
  if (!isObj(doc)) return { error: "top level is not an object" };
  return { doc };
}

// Trust keys are compared case-insensitively with \ as /, no trailing slash; in a repository its root
// (a linked worktree: the main checkout's), outside one the folder or a folder above it; anything but
// exactly true is untrusted.
export const normPath = (p) => p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

/** { trusted, why } for the target ({ root } or { start }) from the text of ~/.claude.json. */
export function trustOf(text, target) {
  if (text === undefined) return { trusted: false, why: "~/.claude.json was not readable" };
  let doc;
  try { doc = JSON.parse(text.replace(/^﻿/, "")); } catch { return { trusted: false, why: "~/.claude.json is not valid JSON" }; }
  const projects = isObj(doc) ? doc.projects : undefined;
  if (!isObj(projects)) return { trusted: false, why: "~/.claude.json has no projects" };
  let wanted;
  if (target.root !== undefined) wanted = new Set([normPath(target.root)]);
  else { const parts = normPath(target.start).split("/"); wanted = new Set(parts.map((_, i) => parts.slice(0, parts.length - i).join("/"))); }
  let matched = false;
  for (const [key, entry] of Object.entries(projects)) {
    if (!wanted.has(normPath(key))) continue;
    matched = true;
    if (isObj(entry) && entry.hasTrustDialogAccepted === true) return { trusted: true, why: "" };
  }
  return { trusted: false, why: matched ? "the folder is not marked trusted" : "the folder has no entry" };
}

/** What trust is keyed on for a folder: its repository root (a linked worktree: the main checkout's root), else the folder. */
export function trustTarget(dir) {
  const run = (args) => { try { return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || undefined; } catch { return undefined; } };
  const top = run(["rev-parse", "--show-toplevel"]);
  if (!top) return { start: dir };
  const common = run(["rev-parse", "--path-format=absolute", "--git-common-dir"])?.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!common || !common.endsWith("/.git")) return { root: top };
  const main = common.slice(0, -"/.git".length);
  return { root: main && normPath(main) !== normPath(top) ? main : top };
}

/** The schema and its keys, flattened in schema order: `oneHour.ttl` for a nested key. The order is the
 * module's (settings.ts, SETTINGS): minDuration before every duration, each ttl before its pingEvery. */
export function loadSchema(file = SCHEMA_FILE) {
  const schema = JSON.parse(fs.readFileSync(file, "utf8"));
  const keys = [];
  for (const [k, p] of Object.entries(schema.properties)) {
    if (k === "$schema") continue;
    if (p.properties) for (const [sub, q] of Object.entries(p.properties)) keys.push({ key: `${k}.${sub}`, ...q });
    else keys.push({ key: k, ...p });
  }
  return { schema, keys };
}

// ---- values: the module's rules (hooks/keepalive/settings.ts, check; duration.ts, parseDuration) ----------
const MINUTE = 60_000;
const ABSOLUTE_MIN = 1_000;
const UNIT_MS = { m: MINUTE, h: 60 * MINUTE, d: 24 * 60 * MINUTE };
const BOOLS = { true: true, false: false, 1: true, 0: false, yes: true, no: false, on: true, off: false };
const NUMBER = /^\s*[0-9]+(\.[0-9]+)?\s*$/;
const num = (v) => { const n = typeof v === "number" ? v : typeof v === "string" && NUMBER.test(v) ? Number(v) : NaN; return Number.isFinite(n) ? n : undefined; };

/** `<n>m`, `<n>h` or `<n>d` in milliseconds, at least 1 second; undefined otherwise. */
export function parseDuration(text) {
  if (typeof text !== "string") return undefined;
  const m = /^\s*(\d+(?:\.\d+)?)\s*([mhd])\s*$/i.exec(text);
  if (!m) return undefined;
  const ms = Math.round(Number(m[1]) * UNIT_MS[m[2].toLowerCase()]);
  return Number.isFinite(ms) && ms >= ABSOLUTE_MIN ? ms : undefined;
}

/** A duration in the largest unit that holds it whole: 8h, 2d, 90m. */
export function formatDuration(ms) {
  for (const unit of ["d", "h"]) if (ms > 0 && ms % UNIT_MS[unit] === 0) return `${ms / UNIT_MS[unit]}${unit}`;
  return ms % MINUTE === 0 ? `${ms / MINUTE}m` : `${Number((ms / MINUTE).toFixed(2))}m`;
}

function parsePrices(text) {
  if (typeof text !== "string" || !text.trim()) return undefined;
  const out = [];
  for (const part of text.split(",")) {
    const at = part.lastIndexOf("=");
    if (at <= 0) return undefined;
    const pattern = part.slice(0, at).trim();
    const mult = num(part.slice(at + 1));
    if (!pattern || mult === undefined) return undefined;
    if (pattern !== "*") { try { new RegExp(pattern, "i"); } catch { return undefined; } }
    out.push({ pattern, mult });
  }
  return out.filter((p) => p.pattern === "*").length === 1 ? out : undefined;
}

/**
 * A raw value checked against a key's kind (x-kind), as the module does: { unset: true } when not set
 * (missing, null, or blank text in an `env`), { error } when invalid, else { value } with the value as
 * the module holds it (a duration in milliseconds, prices as written). `byEnv`: read from an `env`.
 * `minDuration`: the shortest duration a `duration` may be.
 */
export function checkValue(p, raw, byEnv, minDuration = 0) {
  if (raw === undefined) return { unset: true };
  // Every key of the file holds a value: a null there is invalid, as in the module (settings.ts, NULL_IN_FILE).
  if (raw === null) return byEnv ? { unset: true } : { error: NULL_IN_FILE };
  if (byEnv && typeof raw === "string" && !raw.trim()) return { unset: true };
  const n = num(raw);
  const bad = (error) => ({ error });
  switch (p["x-kind"]) {
    case "boolean": {
      if (typeof raw === "boolean") return { value: raw };
      const word = typeof raw === "string" ? raw.trim().toLowerCase() : undefined;
      return word !== undefined && Object.hasOwn(BOOLS, word) ? { value: BOOLS[word] } : bad("not true or false");
    }
    case "scope": {
      const word = typeof raw === "string" ? raw.trim().toLowerCase() : "";
      return word === "session" || word === "machine" ? { value: word } : bad("not session or machine");
    }
    case "text": return typeof raw === "string" && raw.trim() ? { value: raw.trim() } : bad("blank or not text");
    case "threshold": return n !== undefined && n >= 0 && n < 1 ? { value: n } : bad("not a number from 0 up to, not including, 1");
    case "ratio": return n !== undefined && n > 0 && n < 1 ? { value: n } : bad("not a number between 0 and 1");
    case "percent": return n !== undefined && n >= 1 && n <= 100 ? { value: n } : bad("not a number from 1 to 100");
    case "nonNegative": return n !== undefined && n >= 0 ? { value: n } : bad("not a number of 0 or more");
    case "positive": return n !== undefined && n > 0 ? { value: n } : bad("not a number above 0");
    case "whole": return n !== undefined && Number.isSafeInteger(n) && n >= 0 ? { value: n } : bad("not a whole number of 0 or more");
    case "positiveWhole": return n !== undefined && Number.isSafeInteger(n) && n >= 1 ? { value: n } : bad("not a whole number of 1 or more");
    case "minDuration": { const ms = parseDuration(raw); return ms !== undefined ? { value: ms } : bad("not a duration (<n>m, <n>h or <n>d, at least 1 second)"); }
    case "duration": {
      const ms = parseDuration(raw);
      if (ms === undefined) return bad("not a duration (<n>m, <n>h or <n>d)");
      return ms >= minDuration ? { value: ms } : bad(`shorter than minDuration (${formatDuration(minDuration)})`);
    }
    case "prices": return parsePrices(raw) ? { value: raw.trim() } : bad("not pattern=multiplier pairs separated by commas, with exactly one *");
    default: return bad(`unknown kind ${p["x-kind"]}`);
  }
}

/** Whether a set value differs from the key's default, both read as the module reads them (a duration
 * in milliseconds, prices as their pairs), so `60m` equals `1h`. An invalid value differs. */
export function differsFromDefault(p, raw, byEnv) {
  const norm = (v, env) => {
    const r = checkValue(p, v, env, 0);
    if (r.error || r.unset) return undefined;
    return p["x-kind"] === "prices" ? JSON.stringify(parsePrices(r.value)) : JSON.stringify(r.value);
  };
  const mine = norm(raw, byEnv);
  return mine === undefined || mine !== norm(p.default, false);
}

/** A key's value in a nested document: { has, raw }. */
export function valueAt(doc, key) {
  let cur = doc;
  for (const part of key.split(".")) {
    if (!isObj(cur) || !Object.hasOwn(cur, part)) return { has: false };
    cur = cur[part];
  }
  return { has: true, raw: cur };
}

const shown = (v) => JSON.stringify(v);
// The module's trust warning folds white space and cuts a value at 40 characters; this one names the
// keys only, as configure-auto-handoff's does.
// A gated value equal to its default changes nothing, so it is neither skipped nor warned about, as in
// the module (hooks/keepalive/settings.ts, differsFromDefault). A null is not skipped here either: the
// module's trust gate (auto-handoff/io.ts, trustGate, through config.ts withoutKeys) passes a null on,
// and it then gets the null warning like any other null. tests/auto-handoff/ checks the two agree.
function withoutGated(values, keys, names, byEnv) {
  const ignored = keys.filter((p) => p["x-trustGated"]).filter((p) => { const v = valueAt(values, names(p)); return v.has && v.raw !== null && v.raw !== undefined && differsFromDefault(p, v.raw, byEnv); }).map(names);
  if (!ignored.length) return { values, ignored };
  const kept = structuredClone(values);
  for (const name of ignored) {
    const parts = name.split(".");
    let cur = kept;
    for (const part of parts.slice(0, -1)) cur = cur[part];
    delete cur[parts.at(-1)];
  }
  return { values: kept, ignored };
}

/**
 * Each key's value and source from the levels given, highest first, then the default: the module's
 * resolveSettings (hooks/keepalive/settings.ts). A level is { where, byEnv, values }. An invalid value,
 * or one that breaks a rule (a duration shorter than minDuration, a pingEvery not shorter than its
 * track's ttl), is a warning, and the next level applies. When even the default pingEvery is not
 * shorter than a ttl set at some level, that ttl falls back to its default too.
 */
export function resolve(levels, keys) {
  const values = {}, sources = {}, warnings = [];
  for (const p of keys) {
    const min = p.key === "minDuration" ? 0 : values.minDuration ?? 0;
    let found = false;
    for (const level of levels) {
      if (!level.values) continue;
      const name = level.byEnv ? p["x-env"] : p.key;
      const { has, raw } = level.byEnv ? { has: Object.hasOwn(level.values, name), raw: level.values[name] } : valueAt(level.values, name);
      if (!has) continue;
      const r = checkValue(p, raw, level.byEnv, min);
      if (r.unset) continue;
      const why = r.error ?? rule(p.key, r.value, values);
      if (why !== undefined) { warnings.push(`${name}=${shown(raw)} in ${level.where} ignored: ${why}; falling back to the next source`); continue; }
      values[p.key] = r.value;
      sources[p.key] = `${name} in ${level.where}`;
      found = true;
      break;
    }
    if (found) continue;
    const d = checkValue(p, p.default, false, 0).value;
    if (rule(p.key, d, values) !== undefined) {
      const ttlKey = p.key.replace("pingEvery", "ttl");
      warnings.push(`${ttlKey} from ${sources[ttlKey]} ignored: no level sets a ${p.key} shorter than it, and the default (${formatDuration(d)}) is not; set ${p.key} too. Using the defaults for both`);
      values[ttlKey] = checkValue(keys.find((x) => x.key === ttlKey), keys.find((x) => x.key === ttlKey).default, false, 0).value;
      sources[ttlKey] = "default";
    }
    values[p.key] = d;
    sources[p.key] = "default";
  }
  return { values, sources, warnings };
}

function rule(key, v, soFar) {
  const m = /^(oneHour|fiveMinute)\.pingEvery$/.exec(key);
  if (!m) return undefined;
  const ttl = soFar[`${m[1]}.ttl`];
  return v < ttl ? undefined : `not shorter than ${m[1]}.ttl (${formatDuration(ttl)})`;
}

/** A value as a person writes it: a duration back in its unit. */
const display = (p, v) => (p["x-kind"] === "duration" || p["x-kind"] === "minDuration") && typeof v === "number" ? formatDuration(v) : v;

/** Each key's effective value and source, with a warning for every invalid or skipped value.
 * `trust`: { trusted, why } for the folder; untrusted, the x-trustGated keys of the two committed sources are skipped. */
export function effective(root, keys, trust = trustOf(readMaybe(path.join(os.homedir(), ".claude.json")), trustTarget(root))) {
  const warnings = [];
  const levels = [];
  for (const name of ["settings.local.json", "settings.json"]) {
    const where = `.claude/${name}`;
    let values = settingsEnv(root, name, warnings);
    if (values && name === "settings.json" && !trust.trusted) {
      const g = withoutGated(values, keys, (p) => p["x-env"], true);
      if (g.ignored.length) warnings.push(`${g.ignored.join(", ")} in the env of ${where} ignored: Claude Code does not trust this folder (${trust.why}); ${GATED_INSTEAD}`);
      values = g.values;
    }
    levels.push({ where, byEnv: true, values });
  }
  const repo = readRepoFile(path.join(root, ".ai-dlc", FILE_NAME));
  if (repo.error) warnings.push(`.ai-dlc/${FILE_NAME}: ${repo.error}; it is skipped`);
  let values = repo.doc;
  if (values && !trust.trusted) {
    const g = withoutGated(values, keys, (p) => p.key, false);
    if (g.ignored.length) warnings.push(`${g.ignored.join(", ")} in .ai-dlc/${FILE_NAME} ignored: Claude Code does not trust this folder (${trust.why}); ${GATED_INSTEAD}`);
    values = g.values;
  }
  levels.push({ where: `.ai-dlc/${FILE_NAME}`, byEnv: false, values });
  const r = resolve(levels, keys);
  const rows = keys.map((p) => ({
    key: p.key,
    value: display(p, r.values[p.key]),
    source: r.sources[p.key],
  }));
  return { rows, warnings: [...warnings, ...r.warnings] };
}

// Values earlier versions wrote that this one rewrites to the default on merge (and set).
const LEGACY = { "oneHour.maxPings": [0, "0"], "fiveMinute.maxPings": [0, "0"] };

/** The file's text after a merge: every schema key in schema order. A value already set is kept; a
 * missing key, or a null one left by an earlier version or by hand, gets its default (the schema's,
 * which tests check against the module's SETTINGS); keys the schema no longer has are removed. The
 * defaults written are this plugin version's: a later default does not reach a key already set. */
export function merged(doc, keys) {
  const out = { $schema: `./${SCHEMA_NAME}` };
  const added = [], filled = [], removed = [];
  for (const p of keys) {
    const parts = p.key.split(".");
    const { has, raw } = valueAt(doc ?? {}, p.key);
    if (parts.length === 2) out[parts[0]] ??= {};
    const target = parts.length === 2 ? out[parts[0]] : out;
    // A legacy value an earlier version allowed and this one does not (maxPings 0, "no limit") is
    // rewritten to the default like a null.
    const legacy = has && LEGACY[p.key]?.some((x) => JSON.stringify(x) === JSON.stringify(raw));
    if (has && raw !== null && !legacy) target[parts.at(-1)] = raw;
    else {
      target[parts.at(-1)] = p.default;
      if (doc) (has ? filled : added).push(p.key);
    }
  }
  if (doc) {
    for (const [k, v] of Object.entries(doc)) {
      if (k === "$schema") continue;
      if (isObj(out[k]) && isObj(v)) { for (const sub of Object.keys(v)) if (!Object.hasOwn(out[k], sub)) removed.push(`${k}.${sub}`); }
      else if (!Object.hasOwn(out, k)) removed.push(k);
    }
  }
  return { text: `${JSON.stringify(out, null, 2)}\n`, added, filled, removed };
}

/** The problems in the file, each with the key it is about (undefined for a key that is not a setting):
 * unknown keys, missing keys, a track that is not an object, invalid values (null included), and broken
 * rules (read against the file's own values and the defaults). None stops keep-alive: the module warns
 * and uses the next level or the default. */
export function fileProblems(doc, keys) {
  const found = [];
  const tracks = new Set(keys.filter((p) => p.key.includes(".")).map((p) => p.key.split(".")[0]));
  for (const [k, v] of Object.entries(doc)) {
    if (k === "$schema") { if (typeof v !== "string") found.push({ problem: "$schema: not text" }); continue; }
    if (tracks.has(k)) {
      if (!isObj(v)) { found.push({ key: k, problem: `${k}: not an object` }); continue; }
      for (const sub of Object.keys(v)) if (!keys.some((p) => p.key === `${k}.${sub}`)) found.push({ problem: `${k}.${sub}: not a setting (run /ai-dlc:cache-keepalive-merge to remove it)` });
      continue;
    }
    if (!keys.some((p) => p.key === k)) found.push({ problem: `${k}: not a setting (run /ai-dlc:cache-keepalive-merge to remove it)` });
  }
  for (const p of keys) if (!valueAt(doc, p.key).has) found.push({ key: p.key, problem: `${p.key}: missing (run /ai-dlc:cache-keepalive-merge to write its default)` });
  const r = resolve([{ where: `.ai-dlc/${FILE_NAME}`, byEnv: false, values: doc }], keys);
  for (const w of r.warnings) {
    const key = keys.find((p) => w.startsWith(`${p.key}=`) || w.startsWith(`${p.key} from `))?.key;
    found.push({ key, problem: w.replace(` in .ai-dlc/${FILE_NAME} ignored: `, ": ").replace(/; falling back to the next source$/, "") });
  }
  return found;
}

/** The problems in the file, as text. */
export const validateDoc = (doc, keys) => fileProblems(doc, keys).map((f) => f.problem);

/** Why a null in the file is invalid: the module's words (hooks/keepalive/settings.ts, NULL_IN_FILE). */
export const NULL_IN_FILE = "null: every key holds a value (run /ai-dlc:cache-keepalive-merge to write its default)";

/**
 * The env half of `validate`: every AI_DLC_KEEPALIVE_* variable in the env of .claude/settings.local.json
 * and .claude/settings.json, read with the same check as the file and the module (checkValue, held to
 * hooks/keepalive/settings.ts by tests/auto-handoff/), against the minDuration and each track's ttl in
 * force. Each finding is a warning, never an error, since keep-alive only skips a bad value: an unknown
 * name, a value that fails its kind, limits or a rule, a settings file that does not parse, and, in a
 * folder Claude Code does not trust, a gated variable in .claude/settings.json that differs from its
 * default. `applied(key)` names what applies instead; `rows` are show's rows, read once. Returns { warnings }.
 */
export function validateEnv(root, keys, trust = trustOf(readMaybe(path.join(os.homedir(), ".claude.json")), trustTarget(root)), applied, rows = effective(root, keys, trust).rows) {
  // The rows in force are read once (a caller that already has them, such as validate, passes them);
  // `applied` and `inForce` are both derived from them.
  applied ??= appliedFrom(rows);
  const warnings = [];
  const inForce = (key) => { const v = rows.find((r) => r.key === key).value; return typeof v === "string" ? parseDuration(v) : v; };
  const minDuration = inForce("minDuration");
  for (const name of ["settings.local.json", "settings.json"]) {
    const where = `.claude/${name}`;
    const problems = [];
    const env = settingsEnv(root, name, problems);
    warnings.push(...problems);
    if (!env) continue;
    for (const [variable, raw] of Object.entries(env)) {
      if (!variable.startsWith("AI_DLC_KEEPALIVE_")) continue;
      const p = keys.find((x) => x["x-env"] === variable);
      if (!p) { warnings.push(`${where}: ${variable}: not a keep-alive setting; ignored`); continue; }
      if (name === "settings.json" && !trust.trusted && p["x-trustGated"] && differsFromDefault(p, raw, true)) {
        warnings.push(`${where}: ${variable}: skipped, Claude Code does not trust this folder (${trust.why}); ${GATED_INSTEAD}; ${applied(p.key)}`);
        continue;
      }
      const r = checkValue(p, raw, true, p.key === "minDuration" ? 0 : minDuration);
      if (r.unset) continue;
      if (r.error) { warnings.push(`${where}: ${variable}=${JSON.stringify(raw)}: ${r.error}; ${applied(p.key)}`); continue; }
      const track = /^(oneHour|fiveMinute)\.pingEvery$/.exec(p.key)?.[1];
      if (track && r.value >= inForce(`${track}.ttl`)) warnings.push(`${where}: ${variable}=${JSON.stringify(raw)}: not shorter than ${track}.ttl (${formatDuration(inForce(`${track}.ttl`))}); ${applied(p.key)}`);
    }
  }
  return { warnings };
}

/** A track's maxPings as its keep-warm time sets it: the pings keepWarmFor allows at pingEvery (the n-th
 * ping goes out when n × pingEvery is within the keep-warm time), at least 1. Both are the values in force
 * for the file over the defaults, as the module reads them: a pingEvery (or keepWarmFor) that is not a
 * valid duration, or breaks a rule, gives way to the next level, the default, so the result is always a
 * whole number of 1 or more, never NaN. */
export function followingMaxPings(doc, track, keys = loadSchema().keys) {
  const { values } = resolve([{ where: `.ai-dlc/${FILE_NAME}`, byEnv: false, values: doc }], keys);
  return Math.max(1, Math.floor(values[`${track}.keepWarmFor`] / values[`${track}.pingEvery`]));
}

/** show-style rows for the file alone over the defaults: what set's file would give. */
export function rowsOf(doc, keys) {
  const r = resolve([{ where: `.ai-dlc/${FILE_NAME}`, byEnv: false, values: doc }], keys);
  return keys.map((p) => ({ key: p.key, value: display(p, r.values[p.key]), source: r.sources[p.key] }));
}

/** "in force: <value> (<source>)" for a key, from show's rows. */
export const appliedFrom = (rows) => (key) => {
  const row = rows.find((r) => r.key === key);
  return row ? `in force: ${JSON.stringify(row.value)} (${row.source})` : "ignored";
};

/** Each track whose maxPings is below the pings its keep-warm time allows, as a warning: the limit
 * stops the pings first (only /ai-dlc:cache-keepalive lifts it). From show's rows. */
export function capWarnings(rows) {
  const v = (key) => { const x = rows.find((r) => r.key === key).value; return typeof x === "string" ? parseDuration(x) : x; };
  const out = [];
  for (const track of ["oneHour", "fiveMinute"]) {
    const allows = Math.floor(v(`${track}.keepWarmFor`) / v(`${track}.pingEvery`));
    const max = v(`${track}.maxPings`);
    if (max < allows) out.push(`${track}.maxPings is ${max}, but ${track}.keepWarmFor (${formatDuration(v(`${track}.keepWarmFor`))}) at ${track}.pingEvery (${formatDuration(v(`${track}.pingEvery`))}) allows ${allows} pings: the pings stop after ${max}; set ${track}.maxPings=${allows} to keep warm for the whole time`);
  }
  return out;
}

// The kinds whose value is text: a `set` value for them is the text as typed, so `pingPrompt=123` is
// the text "123", never the number 123.
const TEXT_KINDS = new Set(["text", "duration", "minDuration", "prices"]);

/**
 * A `set` value. For a text kind (`kind`, a key's x-kind): the text as typed, except `null` (which
 * `set` refuses: every key holds a value) and a quoted JSON string ("..."), which is unquoted. For any other kind: JSON when it parses
 * (true, 10, null), else the text as typed.
 */
export function parseAssignment(arg, kind) {
  const eq = arg.indexOf("=");
  if (eq <= 0) throw new Error(`expected <key>=<value>, got "${arg}"`);
  const key = arg.slice(0, eq).trim();
  const text = arg.slice(eq + 1);
  let value;
  try { value = JSON.parse(text); } catch { value = text; }
  if (TEXT_KINDS.has(kind) && value !== null && typeof value !== "string") value = text;
  return { key, value };
}

// ---- CLI ---------------------------------------------------------------------------------------
function gitRoot(cwd) {
  try { return execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || cwd; } catch { return cwd; }
}

function main(argv) {
  const args = [...argv];
  const flag = (name) => { const i = args.indexOf(name); if (i < 0) return false; args.splice(i, 1); return true; };
  const option = (name) => { const i = args.indexOf(name); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
  const json = flag("--json");
  const dryRun = flag("--dry-run");
  const root = path.resolve(option("--root") ?? gitRoot(process.cwd()));
  const [command, ...rest] = args;
  const { keys } = loadSchema();
  const file = path.join(root, ".ai-dlc", FILE_NAME);
  const out = (s) => process.stdout.write(`${s}\n`);
  const tracksOk = (doc) => !doc || keys.filter((p) => p.key.includes(".")).every((p) => { const t = doc[p.key.split(".")[0]]; return t === undefined || t === null || isObj(t); });

  switch (command) {
    case "show": {
      const { rows, warnings } = effective(root, keys);
      if (json) { out(JSON.stringify({ settings: rows, warnings }, null, 2)); return 0; }
      out("| Key | Value | Source |\n|---|---|---|");
      for (const r of rows) out(`| \`${r.key}\` | \`${JSON.stringify(r.value).replace(/\|/g, "\\|")}\` | ${r.source} |`);
      out("A /ai-dlc:cache-keepalive override of a track (this session's, else the machine's) outranks its keepWarmFor above; run /ai-dlc:cache-keepalive to see the keep-warm time in force.");
      for (const w of warnings) out(`warning: ${w}`);
      return 0;
    }
    case "install":
    case "merge": {
      // install is for a repository without the file; merge for one that has it. Each points to the other
      // otherwise and writes nothing (a warning, exit 0).
      const exists = readMaybe(file) !== undefined;
      if (command === "install" && exists) { out(`warning: .ai-dlc/${FILE_NAME} already exists: run /ai-dlc:cache-keepalive-merge to bring it up to date; nothing written`); return 0; }
      if (command === "merge" && !exists) { out(`warning: .ai-dlc/${FILE_NAME} does not exist: run /ai-dlc:cache-keepalive-install to create it; nothing written`); return 0; }
      const repo = readRepoFile(file);
      if (repo.error || !tracksOk(repo.doc)) { out(`.ai-dlc/${FILE_NAME}: ${repo.error ?? "a track (oneHour, fiveMinute) is not an object"}; fix it by hand first`); return 1; }
      const m = merged(repo.doc, keys);
      const defaultOf = (k) => JSON.stringify(keys.find((p) => p.key === k).default);
      if (!repo.doc) out(`create .ai-dlc/${FILE_NAME} with every key at its default`);
      for (const k of m.added) out(`+ ${k}: ${defaultOf(k)}`);
      for (const k of m.filled) out(`+ ${k}: ${JSON.stringify(valueAt(repo.doc, k).raw)} -> ${defaultOf(k)}`);
      for (const k of m.removed) out(`- ${k}: ${JSON.stringify(valueAt(repo.doc, k).raw)}`);
      const schemaTarget = path.join(root, ".ai-dlc", SCHEMA_NAME);
      const schemaText = fs.readFileSync(SCHEMA_FILE, "utf8");
      const schemaStale = readMaybe(schemaTarget) !== schemaText.replace(/^﻿/, "");
      if (schemaStale) out(`${readMaybe(schemaTarget) === undefined ? "create" : "update"} .ai-dlc/${SCHEMA_NAME}`);
      const changed = !repo.doc || m.added.length || m.filled.length || m.removed.length || readMaybe(file) !== m.text;
      if (!changed && !schemaStale) out("up to date");
      if (dryRun) return 0;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      if (changed) fs.writeFileSync(file, m.text);
      if (schemaStale) fs.writeFileSync(schemaTarget, schemaText);
      return 0;
    }
    case "set": {
      if (!rest.length) { out("set needs <key>=<value>"); return 2; }
      const repo = readRepoFile(file);
      if (repo.error || !tracksOk(repo.doc)) { out(`.ai-dlc/${FILE_NAME}: ${repo.error ?? "a track (oneHour, fiveMinute) is not an object"}; fix it by hand first`); return 1; }
      // Every key holds a value: a key missing from the file, or null in it, gets its default first.
      const m = merged(repo.doc, keys);
      const doc = JSON.parse(m.text);
      // The same lines as merge: `+ key: default` for a missing key, `+ key: null -> default` for a null one.
      const defaultOf = (k) => JSON.stringify(keys.find((p) => p.key === k).default);
      if (repo.doc) for (const k of m.added) out(`+ ${k}: ${defaultOf(k)}`);
      for (const k of m.filled) out(`+ ${k}: ${JSON.stringify(valueAt(repo.doc, k).raw)} -> ${defaultOf(k)}`);
      const shown = (k) => JSON.stringify(valueAt(doc, k).raw);
      const wroteKeep = new Set(), namedMax = new Set();
      for (const arg of rest) {
        let a;
        const named = keys.find((x) => x.key === arg.slice(0, Math.max(arg.indexOf("="), 0)).trim());
        try { a = parseAssignment(arg, named?.["x-kind"]); } catch (e) { out(`warning: ${e.message}; skipped`); continue; }
        const p = keys.find((x) => x.key === a.key);
        if (!p) { out(`warning: ${a.key}: not a setting; skipped`); continue; }
        const track = /^(oneHour|fiveMinute)\.maxPings$/.exec(a.key)?.[1];
        if (track) namedMax.add(track); // an explicit maxPings in the same call wins over the recomputed one
        const skip = (why) => out(`warning: ${a.key}=${JSON.stringify(a.value)} skipped: ${why}; ${a.key} stays ${shown(a.key)}`);
        if (a.value === null) { skip("null is not a value: every key holds one"); continue; }
        const r = checkValue(p, a.value, false, 0);
        if (r.error) { skip(r.error); continue; }
        const parts = a.key.split(".");
        const target = parts.length === 2 ? doc[parts[0]] : doc;
        // Durations, prices and text are kept as written; booleans, the scope and numbers as the module reads them.
        const asWritten = ["duration", "minDuration", "prices", "text"].includes(p["x-kind"]);
        const next = asWritten ? a.value.trim() : r.value;
        const before = target[parts.at(-1)];
        // The rules read the file as a whole (a duration against minDuration, a pingEvery against its
        // ttl): a pair that would break one is skipped, and the file keeps its value.
        const had = new Set(validateDoc(doc, keys));
        target[parts.at(-1)] = next;
        const broke = validateDoc(doc, keys).filter((x) => !had.has(x));
        if (broke.length) { target[parts.at(-1)] = before; skip(broke.join("; ")); continue; }
        if (JSON.stringify(before) !== JSON.stringify(next)) out(`${a.key}: ${JSON.stringify(before)} -> ${JSON.stringify(next)}`);
        const kept = /^(oneHour|fiveMinute)\.keepWarmFor$/.exec(a.key)?.[1];
        if (kept) wroteKeep.add(kept);
      }
      // A track's maxPings follows a keepWarmFor written without an explicit maxPings in the same call
      // (human decision, 2026-10-23): the pings the keep-warm time allows at the track's pingEvery,
      // counted as the module counts them (the one on the limit included), at least 1.
      for (const track of wroteKeep) {
        if (namedMax.has(track)) continue;
        const n = followingMaxPings(doc, track, keys);
        if (n !== doc[track].maxPings) {
          const every = formatDuration(resolve([{ where: "file", byEnv: false, values: doc }], keys).values[`${track}.pingEvery`]);
          out(`${track}.maxPings: ${JSON.stringify(doc[track].maxPings)} -> ${n} (follows ${track}.keepWarmFor ${doc[track].keepWarmFor} at ${track}.pingEvery ${every})`);
          doc[track].maxPings = n;
        }
      }
      for (const w of capWarnings(rowsOf(doc, keys))) out(`warning: ${w}`);
      if (!dryRun) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`); }
      return 0;
    }
    case "validate": {
      // Both sources: the file (schema, values, required keys, no null) and the AI_DLC_KEEPALIVE_*
      // variables in the env of the two settings files. Every finding is a warning naming what applies
      // instead, since keep-alive only skips a bad value; validate exits 0 (human, 2026-10-23).
      const shownRows = effective(root, keys).rows;
      const applied = appliedFrom(shownRows);
      let clean = true;
      const repo = readRepoFile(file);
      if (repo.error) { out(`warning: .ai-dlc/${FILE_NAME}: ${repo.error}; it is skipped, so the next level or the default applies to every key`); clean = false; }
      else if (!repo.doc) out(`.ai-dlc/${FILE_NAME} does not exist: the defaults apply (run /ai-dlc:cache-keepalive-install to write them)`);
      else {
        const found = fileProblems(repo.doc, keys);
        for (const f of found) out(`warning: .ai-dlc/${FILE_NAME}: ${f.problem}; ${f.key ? applied(f.key) : "ignored"}`);
        if (found.length) clean = false;
        else out(`.ai-dlc/${FILE_NAME} is valid`);
      }
      const env = validateEnv(root, keys, undefined, applied, shownRows);
      for (const w of env.warnings) out(`warning: ${w}`);
      if (env.warnings.length) clean = false;
      else out("the AI_DLC_KEEPALIVE_* variables in the settings files are valid");
      for (const w of capWarnings(shownRows)) out(`warning: ${w}`);
      if (!clean) out("keep-alive runs on the values in force above; the warnings name each value it skips");
      return 0;
    }
    default:
      out("usage: cache-keepalive.mjs show [--json] | install [--dry-run] | merge [--dry-run] | validate  [--root <dir>]");
      return command === "--help" || command === "help" ? 0 : 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
