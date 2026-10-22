#!/usr/bin/env node
// auto-handoff.mjs: shows, writes and checks a repository's .ai-dlc/auto-handoff.json, the settings of
// the ai-dlc plugin's automatic session handoff (Claude Code only). Zero dependencies; tested on Node 22 and later.
// It runs from the plugin's configure-auto-handoff skill folder; the schema next to it is the one list
// of keys, environment variables and defaults. The hooks module (hooks/auto-handoff/config.ts) resolves
// the same keys in the same order; tests/auto-handoff/ in the plugin repository checks the two agree.
//
//   show [--json]               each key's effective value and where it comes from
//   merge [--dry-run]           create the file, or add new keys and remove retired ones, keeping values
//   set <key>=<value>... [--dry-run]   set values (JSON literal or plain text; null unsets)
//   validate                    check the file; exit 1 on an error
//   capabilities [--json]       what the module recorded about the running Claude Code (/rename, version)
//
// Options: --root <dir> (default: git root, else the working directory).
// Each key is read, highest first, from `env` in .claude/settings.local.json, `env` in
// .claude/settings.json, the process environment, .ai-dlc/auto-handoff.json, then the default. The
// automatic handoff has no /config rows. Keys the schema marks
// x-trustGated apply from .ai-dlc/auto-handoff.json only when Claude Code trusts the folder, as in the
// module; `show` reads the trust flag from ~/.claude.json and nothing else from it.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_FILE = path.join(HERE, "auto-handoff.schema.json");
const FILE_NAME = "auto-handoff.json";
const SCHEMA_NAME = "auto-handoff.schema.json";
const CAPABILITIES = path.join(".claude", "state", "auto-handoff", "capabilities.json");

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

export function loadSchema(file = SCHEMA_FILE) {
  const schema = JSON.parse(fs.readFileSync(file, "utf8"));
  const keys = Object.entries(schema.properties).filter(([k]) => k !== "$schema").map(([key, p]) => ({ key, ...p }));
  return { schema, keys };
}

// ---- values ------------------------------------------------------------------------------------
const WHOLE = /^\s*(0|[1-9][0-9]*)\s*$/;
const BOOLS = { true: true, false: false, 1: true, 0: false, yes: true, no: false, on: true, off: false };
const typesOf = (p) => (Array.isArray(p.type) ? p.type : [p.type]).filter((t) => t !== "null");

/**
 * A raw value checked against a key, with the module's rules (hooks/auto-handoff/config.ts, `check`):
 * { value } when valid, { unset: true } when not set (missing, null, a blank environment value),
 * { error } when set but invalid. Booleans may be written true / false, or as text (true, false, 1, 0,
 * yes, no, on, off); whole numbers as numbers or digits. A regular expression is kept as written; other
 * text is trimmed.
 */
export function checkValue(p, raw, byEnv) {
  if (raw === undefined || raw === null) return { unset: true };
  if (byEnv && typeof raw === "string" && !raw.trim()) return { unset: true };
  const type = typesOf(p)[0];
  if (type === "boolean") {
    if (typeof raw === "boolean") return { value: raw };
    const word = typeof raw === "string" ? raw.trim().toLowerCase() : undefined;
    return word !== undefined && Object.hasOwn(BOOLS, word) ? { value: BOOLS[word] } : { error: "not true or false" };
  }
  if (type === "integer") {
    const n = typeof raw === "number" ? raw : typeof raw === "string" && WHOLE.test(raw) ? Number(raw) : NaN;
    if (!Number.isSafeInteger(n) || n < 0) return { error: "not a whole number" };
    if (p.minimum !== undefined && n < p.minimum) return { error: `below ${p.minimum}` };
    if (p.maximum !== undefined && n > p.maximum) return { error: `above ${p.maximum}` };
    return { value: n };
  }
  if (typeof raw !== "string") return { error: "not text" };
  if (p.format === "host-port") {
    // The module's rule (hooks/auto-handoff/server.ts, parseAddress): blank, or host:port with a port
    // of 10 to 65535 and no leading zero.
    const t = raw.trim();
    if (!t) return { value: "" };
    const m = /^[\w.-]+:([1-9]\d{1,4})$/.exec(t);
    return m && Number(m[1]) <= 65535 ? { value: t } : { error: "not host:port" };
  }
  if (p.format === "regex") {
    if (!raw.trim()) return { value: "" };
    try { new RegExp(raw); } catch { return { error: "not a valid regular expression" }; }
    return { value: raw };
  }
  if (p.minLength && !raw.trim()) return { error: "blank" };
  return { value: raw.trim() };
}

// ---- files -------------------------------------------------------------------------------------
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

const readMaybe = (file) => { try { return fs.readFileSync(file, "utf8").replace(/^﻿/, ""); } catch { return undefined; } };

function settingsEnv(root, name, warnings) {
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

// ---- workspace trust ---------------------------------------------------------------------------
// The same rules as the module (hooks/auto-handoff/config.ts, trustOf): keys compared case-insensitively
// with \ as /, no trailing slash; in a repository its root (a linked worktree: the main checkout's),
// outside one the folder or a folder above it; anything but exactly true is untrusted.
export const normPath = (p) => p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

/** { trusted, why } for the target ({ root } or { start }) from the text of ~/.claude.json. */
export function trustOf(text, target) {
  if (text === undefined) return { trusted: false, why: "~/.claude.json was not readable" };
  let doc;
  try { doc = JSON.parse(text.replace(/^\uFEFF/, "")); } catch { return { trusted: false, why: "~/.claude.json is not valid JSON" }; }
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

/** Each key's effective value and source, with a warning for every invalid value met on the way.
 * `trust`: { trusted, why } for the folder; untrusted, the x-trustGated keys of the file are skipped. */
export function effective(root, keys, env = process.env, trust = trustOf(readMaybe(path.join(os.homedir(), ".claude.json")), trustTarget(root))) {
  const warnings = [];
  const levels = [
    { where: ".claude/settings.local.json", byEnv: true, values: settingsEnv(root, "settings.local.json", warnings) },
    { where: ".claude/settings.json", byEnv: true, values: settingsEnv(root, "settings.json", warnings) },
    { where: "the environment", byEnv: true, values: env },
  ];
  const repo = readRepoFile(path.join(root, ".ai-dlc", FILE_NAME));
  if (repo.error) warnings.push(`.ai-dlc/${FILE_NAME}: ${repo.error}; it is skipped`);
  let values = repo.doc;
  if (values && !trust.trusted) {
    const ignored = keys.filter((p) => p["x-trustGated"] && values[p.key] !== undefined && values[p.key] !== null).map((p) => p.key);
    if (ignored.length) {
      values = Object.fromEntries(Object.entries(values).filter(([k]) => !ignored.includes(k)));
      warnings.push(`${ignored.join(", ")} in .ai-dlc/${FILE_NAME} ignored: Claude Code does not trust this folder (${trust.why}); set them in the env of .claude/settings.local.json instead`);
    }
  }
  levels.push({ where: `.ai-dlc/${FILE_NAME}`, byEnv: false, values });
  const rows = keys.map((p) => {
    for (const level of levels) {
      if (!level.values) continue;
      const name = level.byEnv ? p["x-env"] : p.key;
      if (!Object.hasOwn(level.values, name)) continue;
      const raw = level.values[name];
      const r = checkValue(p, raw, level.byEnv);
      if (r.unset) continue;
      if (r.error) { warnings.push(`${name}=${JSON.stringify(raw)} in ${level.where} ignored: ${r.error}; falling back to the next source`); continue; }
      return { key: p.key, value: r.value, source: `${name} in ${level.where}` };
    }
    return { key: p.key, value: p.default, source: "default" };
  });
  return { rows, warnings };
}

/** The file's text after a merge: every schema key in schema order, each value kept, new keys null,
 * keys the schema no longer has removed. */
export function merged(doc, keys) {
  const out = { $schema: `./${SCHEMA_NAME}` };
  const added = [], removed = [];
  for (const p of keys) {
    if (doc && Object.hasOwn(doc, p.key)) out[p.key] = doc[p.key];
    else { out[p.key] = null; if (doc) added.push(p.key); }
  }
  if (doc) for (const k of Object.keys(doc)) if (k !== "$schema" && !keys.some((p) => p.key === k)) removed.push(k);
  return { text: `${JSON.stringify(out, null, 2)}\n`, added, removed };
}

/** Errors in the file: unknown keys and invalid values. */
export function validateDoc(doc, keys) {
  const errors = [];
  for (const [k, v] of Object.entries(doc)) {
    if (k === "$schema") { if (typeof v !== "string") errors.push("$schema: not text"); continue; }
    const p = keys.find((x) => x.key === k);
    if (!p) { errors.push(`${k}: not a setting (run merge to remove it)`); continue; }
    const r = checkValue(p, v, false);
    if (r.error) errors.push(`${k}: ${JSON.stringify(v)} is ${r.error}`);
  }
  return errors;
}

/** A `set` value: JSON when it parses (true, 70, null, "x"), else the text as typed. */
export function parseAssignment(arg) {
  const eq = arg.indexOf("=");
  if (eq <= 0) throw new Error(`expected <key>=<value>, got "${arg}"`);
  const key = arg.slice(0, eq).trim();
  const text = arg.slice(eq + 1);
  let value;
  try { value = JSON.parse(text); } catch { value = text; }
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

  switch (command) {
    case "show": {
      const { rows, warnings } = effective(root, keys);
      if (json) { out(JSON.stringify({ settings: rows, warnings }, null, 2)); return 0; }
      out("| Key | Value | Source |\n|---|---|---|");
      for (const r of rows) out(`| \`${r.key}\` | ${r.value === null ? "unset" : `\`${JSON.stringify(r.value)}\``} | ${r.source} |`);
      for (const w of warnings) out(`warning: ${w}`);
      return 0;
    }
    case "merge": {
      const repo = readRepoFile(file);
      if (repo.error) { out(`.ai-dlc/${FILE_NAME}: ${repo.error}; fix it by hand first`); return 1; }
      const m = merged(repo.doc, keys);
      if (!repo.doc) out(`create .ai-dlc/${FILE_NAME} with every key unset (null)`);
      for (const k of m.added) out(`+ ${k}: null`);
      for (const k of m.removed) out(`- ${k}: ${JSON.stringify(repo.doc[k])}`);
      const schemaTarget = path.join(root, ".ai-dlc", SCHEMA_NAME);
      const schemaText = fs.readFileSync(SCHEMA_FILE, "utf8");
      const schemaStale = readMaybe(schemaTarget) !== schemaText.replace(/^﻿/, "");
      if (schemaStale) out(`${readMaybe(schemaTarget) === undefined ? "create" : "update"} .ai-dlc/${SCHEMA_NAME}`);
      const changed = !repo.doc || m.added.length || m.removed.length || readMaybe(file) !== m.text;
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
      if (repo.error) { out(`.ai-dlc/${FILE_NAME}: ${repo.error}; fix it by hand first`); return 1; }
      const doc = JSON.parse(merged(repo.doc, keys).text);
      const errors = [];
      for (const arg of rest) {
        let a;
        try { a = parseAssignment(arg); } catch (e) { errors.push(e.message); continue; }
        const p = keys.find((x) => x.key === a.key);
        if (!p) { errors.push(`${a.key}: not a setting`); continue; }
        const r = checkValue(p, a.value, false);
        if (r.error) { errors.push(`${a.key}: ${JSON.stringify(a.value)} is ${r.error}`); continue; }
        if (JSON.stringify(doc[a.key]) !== JSON.stringify(r.unset ? null : r.value)) out(`${a.key}: ${JSON.stringify(doc[a.key])} -> ${JSON.stringify(r.unset ? null : r.value)}`);
        doc[a.key] = r.unset ? null : r.value;
      }
      if (errors.length) { for (const e of errors) out(`error: ${e}`); return 1; }
      if (!dryRun) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`); }
      return 0;
    }
    case "validate": {
      const repo = readRepoFile(file);
      if (repo.error) { out(`.ai-dlc/${FILE_NAME}: ${repo.error}`); return 1; }
      if (!repo.doc) { out(`.ai-dlc/${FILE_NAME} does not exist: the defaults apply`); return 0; }
      const errors = validateDoc(repo.doc, keys);
      for (const e of errors) out(`error: ${e}`);
      if (!errors.length) out(`.ai-dlc/${FILE_NAME} is valid`);
      return errors.length ? 1 : 0;
    }
    case "capabilities": {
      const capFile = path.join(os.homedir(), CAPABILITIES);
      const text = readMaybe(capFile);
      let caps = null;
      try { caps = text === undefined ? null : JSON.parse(text); } catch {}
      if (json) { out(JSON.stringify(caps)); return 0; }
      if (!caps) { out(`not recorded (${capFile} is missing): start a new Claude Code session with the ai-dlc plugin enabled, then run this again`); return 0; }
      out(`checked ${caps.checkedAt} on Claude Code ${caps.claudeCodeVersion ?? "(version unknown)"}: /rename ${caps.rename ? "is available" : "is NOT available"}`);
      return 0;
    }
    default:
      out("usage: auto-handoff.mjs show [--json] | merge [--dry-run] | set <key>=<value>... [--dry-run] | validate | capabilities [--json]  [--root <dir>]");
      return command === "--help" || command === "help" ? 0 : 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
