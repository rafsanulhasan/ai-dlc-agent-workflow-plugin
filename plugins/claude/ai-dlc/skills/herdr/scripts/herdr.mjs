#!/usr/bin/env node
// herdr.mjs: the ai-dlc orchestrator's herdr panes (Claude Code only). Zero dependencies; Node 22 or later.
// herdr (https://herdr.dev) is a terminal workspace for coding agents. Inside it, this script opens a
// labelled pane per spawned agent that shows its progress (watch), or runs a subagent as its own
// `claude -p` process in a pane (run-in-pane). Outside herdr it does nothing. It never installs herdr.
//
// Orchestrator commands: one JSON line on stdout, nothing on stderr, exit 0 for every outcome (ok:false
// included); exit 2 only for a usage error, with one JSON line whose reason starts "usage:".
//   detect [--explain] [--run <dir>]
//   open  --run <dir> (--step <code> --agent <id> [--record <path>])...
//   close --run <dir> (--step <code> --agent <id>)...
//   run   --run <dir> --step <code> --agent <id> --record <path> --out <path> [--worktree <name>] [--timeout <minutes>]
// Pane commands (run inside a pane; always exit 0):
//   watch <job.json>     the progress view, read only
//   child <job.json>     the run-in-pane wrapper around `claude -p`
// Settings commands (for people; the format of configure-auto-handoff's auto-handoff.mjs):
//   show [--json] | merge [--dry-run] | set <key>=<value>... [--dry-run] | validate
//
// Options: --root <dir> (default: git root, else the working directory).
// Each setting is read, highest first, from `env` in .claude/settings.local.json, `env` in
// .claude/settings.json, the process environment, .ai-dlc/herdr.json, then the default.
// State and job files live in <root>/.scratch/herdr/<run-id>/ (gitignored).
// Test hooks, not settings: AI_DLC_HERDR_CALL_TIMEOUT_MS (5000), AI_DLC_HERDR_POLL_MS,
// AI_DLC_HERDR_TRANSCRIPT_ROOT.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(import.meta.url);
const SKILL_DIR = path.resolve(path.dirname(SCRIPT), "..");
const SCHEMA_FILE = path.join(SKILL_DIR, "templates", "herdr.schema.json");
const FILE_NAME = "herdr.json";
const SCHEMA_NAME = "herdr.schema.json";

// ---- copied from configure-auto-handoff's auto-handoff.mjs (tests/herdr/herdr-helpers-drift.test.mjs) ----
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

export function loadSchema(file = SCHEMA_FILE) {
  const schema = JSON.parse(fs.readFileSync(file, "utf8"));
  const keys = Object.entries(schema.properties).filter(([k]) => k !== "$schema").map(([key, p]) => ({ key, ...p }));
  return { schema, keys };
}

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

function gitRoot(cwd) {
  try { return execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || cwd; } catch { return cwd; }
}
// ---- end of the copied helpers ----

export { isObj, readMaybe, stripComments, settingsEnv };

/** A path for comparison: \ as /, no trailing slash, lower case on Windows only. */
export const normPath = (p, platform = process.platform) => {
  const s = String(p).replace(/\\/g, "/").replace(/\/+$/, "");
  return platform === "win32" ? s.toLowerCase() : s;
};

// ---- settings -----------------------------------------------------------------------------------
const NUMBER = /^\s*[0-9]+(\.[0-9]+)?\s*$/;
const typesOf = (p) => (Array.isArray(p.type) ? p.type : [p.type]).filter((t) => t !== "null");

/** A raw value checked against a key: { value }, { unset: true } (missing, null, blank in an environment), or { error }. */
export function checkValue(p, raw, byEnv) {
  if (raw === undefined || raw === null) return { unset: true };
  if (byEnv && typeof raw === "string" && !raw.trim()) return { unset: true };
  if (typesOf(p)[0] === "number") {
    const n = typeof raw === "number" ? raw : typeof raw === "string" && NUMBER.test(raw) ? Number(raw) : NaN;
    if (!Number.isFinite(n)) return { error: "not a number" };
    if (p.exclusiveMinimum !== undefined && n <= p.exclusiveMinimum) return { error: `not above ${p.exclusiveMinimum}` };
    if (p.maximum !== undefined && n > p.maximum) return { error: `above ${p.maximum}` };
    return { value: n };
  }
  if (typeof raw !== "string") return { error: "not text" };
  const t = raw.trim();
  if (Array.isArray(p.enum) && !p.enum.includes(t)) return { error: `not one of ${p.enum.filter((v) => v !== null).join(", ")}` };
  return { value: t };
}

/** Each key's effective value and source, with a warning for every invalid value met on the way. */
export function effective(root, keys, env = process.env) {
  const warnings = [];
  const levels = [
    { where: ".claude/settings.local.json", byEnv: true, values: settingsEnv(root, "settings.local.json", warnings) },
    { where: ".claude/settings.json", byEnv: true, values: settingsEnv(root, "settings.json", warnings) },
    { where: "the environment", byEnv: true, values: env },
  ];
  const repo = readRepoFile(path.join(root, ".ai-dlc", FILE_NAME));
  if (repo.error) warnings.push(`.ai-dlc/${FILE_NAME}: ${repo.error}; it is skipped`);
  levels.push({ where: `.ai-dlc/${FILE_NAME}`, byEnv: false, values: repo.doc });
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

/** { mode, runTimeoutMinutes, sources, warnings }; never throws. */
export function readSettings(root, env = process.env) {
  try {
    const { keys } = loadSchema();
    const { rows, warnings } = effective(root, keys, env);
    const get = (k) => rows.find((r) => r.key === k);
    return { mode: get("mode").value, runTimeoutMinutes: get("runTimeoutMinutes").value, sources: { mode: get("mode").source, runTimeoutMinutes: get("runTimeoutMinutes").source }, warnings };
  } catch (e) {
    return { mode: "watch", runTimeoutMinutes: 60, sources: { mode: "default", runTimeoutMinutes: "default" }, warnings: [`settings unreadable: ${e.message}`] };
  }
}

/** The file's text after a merge: every schema key in schema order, each value kept, new keys null. */
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

/** A `set` value: JSON when it parses (60, null, "x"), else the text as typed. */
export function parseAssignment(arg) {
  const eq = arg.indexOf("=");
  if (eq <= 0) throw new Error(`expected <key>=<value>, got "${arg}"`);
  const key = arg.slice(0, eq).trim();
  const text = arg.slice(eq + 1);
  let value;
  try { value = JSON.parse(text); } catch { value = text; }
  return { key, value };
}

// ---- processes ----------------------------------------------------------------------------------
const callTimeoutMs = () => Number(process.env.AI_DLC_HERDR_CALL_TIMEOUT_MS) || 5000;
const pollMs = (fallback) => Number(process.env.AI_DLC_HERDR_POLL_MS) || fallback;

/** Where an executable is on PATH: { file, shell } (shell only for .cmd / .bat), or undefined. */
export function resolveExe(name, env = process.env, platform = process.platform) {
  const pathKey = Object.keys(env).find((k) => k.toUpperCase() === "PATH");
  const dirs = (pathKey ? String(env[pathKey]) : "").split(platform === "win32" ? ";" : ":").filter(Boolean);
  const exts = platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const dir of dirs) {
    for (const ext of exts) {
      const file = path.join(dir, name + ext);
      try { if (fs.statSync(file).isFile()) return { file, shell: /\.(cmd|bat)$/i.test(ext) }; } catch {}
    }
  }
  return undefined;
}

/** An argument that may pass through cmd.exe: letters, digits, . _ : / \ space -, and no `..` segment. */
export function safeArg(s) {
  return typeof s === "string" && /^[A-Za-z0-9._:\/\\ -]+$/.test(s) && !s.split(/[\/\\]/).includes("..");
}

/** The one command line for a .cmd / .bat target, so Node gets no args array with shell: true. */
function shellLine(file, args) {
  return [`"${file}"`, ...args.map((a) => (a.includes(" ") ? `"${a}"` : a))].join(" ");
}

/** { ok, status, stdout, stderr, reason? }; never throws. */
export function runExe(name, args, { timeoutMs = callTimeoutMs(), input, env = process.env } = {}) {
  const exe = resolveExe(name, env);
  if (!exe) return { ok: false, status: null, stdout: "", stderr: "", reason: `${name} is not on PATH`, missing: true };
  if (exe.shell && !args.every(safeArg)) return { ok: false, status: null, stdout: "", stderr: "", reason: "unsafe argument" };
  const options = { timeout: timeoutMs, encoding: "utf8", windowsHide: true, env, input, stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"] };
  let r;
  try { r = exe.shell ? spawnSync(shellLine(exe.file, args), { ...options, shell: true }) : spawnSync(exe.file, args, options); }
  catch (e) { return { ok: false, status: null, stdout: "", stderr: "", reason: `${name}: ${e.message}` }; }
  const out = { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  if (r.error) return { ok: false, ...out, reason: r.error.code === "ETIMEDOUT" ? `${name} timed out` : `${name}: ${r.error.message}` };
  if (r.signal) return { ok: false, ...out, reason: `${name} stopped by ${r.signal}` };
  return { ok: r.status === 0, ...out, reason: r.status === 0 ? undefined : `${name} exited ${r.status}` };
}

/** A herdr call that answers JSON: { ok, json?, errorCode?, reason? }. */
export function herdrJson(args, opts = {}) {
  const r = runExe("herdr", args, opts);
  let json;
  for (const text of [r.stdout, r.stderr]) {
    if (json !== undefined || !text || !text.trim()) continue;
    try { json = JSON.parse(text.trim()); } catch {}
  }
  const errorCode = isObj(json) && isObj(json.error) ? json.error.code : undefined;
  if (json === undefined) return { ok: false, reason: r.reason ?? "unexpected herdr output", status: r.status };
  if (!r.ok || errorCode) return { ok: false, json, errorCode, reason: errorCode ?? r.reason, status: r.status };
  return { ok: true, json, status: r.status };
}

/** A new pane's id from `pane split` output, or undefined. */
export const paneIdFrom = (json) => json?.result?.pane?.pane_id ?? json?.result?.pane_id;

/** herdr's `status server` text says the server runs. Its exit code is 0 either way. */
export const parseStatusServer = (text) => /^\s*status:\s*running\s*$/m.test(String(text ?? ""));

/** Write a result or state file in one step: a .tmp file, then a rename. */
export function atomicWrite(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, text);
  fs.renameSync(`${file}.tmp`, file);
}

// ---- state files ---------------------------------------------------------------------------------
export const stateDir = (root, runId) => path.join(root, ".scratch", "herdr", runId);
export const jobPath = (root, runId, step, agent) => path.join(stateDir(root, runId), `${step}-${agent}.job.json`);
export const paneFile = (root, runId, step, agent) => path.join(stateDir(root, runId), `${step}-${agent}.pane.json`);
export const resultPaths = (root, runId, step, agent) => {
  const out = path.join(stateDir(root, runId), `${step}-${agent}.result.md`);
  return { out, exit: `${out}.exit` };
};
const readJson = (file) => { const t = readMaybe(file); if (t === undefined) return undefined; try { return JSON.parse(t); } catch { return undefined; } };

/** Pane ids this script opened, in any run: they are never this session's pane. */
function ownPanes(root) {
  const ids = new Set();
  const base = path.join(root, ".scratch", "herdr");
  let runs = [];
  try { runs = fs.readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory()); } catch { return ids; }
  for (const r of runs) {
    let files = [];
    try { files = fs.readdirSync(path.join(base, r.name)).filter((f) => f.endsWith(".pane.json")); } catch {}
    for (const f of files) { const j = readJson(path.join(base, r.name, f)); if (j && typeof j.pane === "string") ids.add(j.pane); }
  }
  return ids;
}

/** The live panes of the run this script opened, newest first: [{ file, pane, opened }]. */
function runPanes(root, runId) {
  const dir = stateDir(root, runId);
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith(".pane.json")); } catch { return []; }
  return files.map((f) => ({ file: f, ...(readJson(path.join(dir, f)) ?? {}) })).filter((j) => typeof j.pane === "string")
    .sort((a, b) => String(b.opened ?? "").localeCompare(String(a.opened ?? "")));
}

// ---- detect ----------------------------------------------------------------------------------------
const panesOf = (list) => (list.ok && Array.isArray(list.json?.result?.panes) ? list.json.result.panes : undefined);

/** This session's pane by evidence: the run's cached anchor, else the one working claude pane in this folder. */
function matchAnchor({ root, runId, panes }) {
  if (runId) {
    const cached = readJson(path.join(stateDir(root, runId), "anchor.json"));
    if (cached && typeof cached.pane === "string" && panes.some((p) => p?.pane_id === cached.pane && p?.agent === "claude")) {
      return { anchor: cached.pane, source: "cached", candidates: [cached.pane] };
    }
  }
  const own = ownPanes(root);
  const here = new Set([normPath(root), normPath(process.cwd())]);
  const candidates = panes.filter((p) => isObj(p) && p.agent === "claude" && p.agent_status === "working"
    && typeof p.cwd === "string" && here.has(normPath(p.cwd)) && typeof p.pane_id === "string" && !own.has(p.pane_id)).map((p) => p.pane_id);
  if (candidates.length === 1) return { anchor: candidates[0], source: "pane-match", candidates };
  return { anchor: null, source: null, candidates, reason: candidates.length ? `ambiguous: ${candidates.length} panes match this session` : "no pane matches this session" };
}

/** Whether herdr panes are active for this session, with the anchor pane. Read-only. */
export function detectState({ root, runId, env = process.env, explain = false }) {
  const s = readSettings(root, env);
  if (s.mode === "off") return { ok: true, active: false, mode: "off", reason: "mode is off" };
  const inactive = (reason, extra = {}) => ({ ok: true, active: false, mode: s.mode, reason, ...extra });
  const v = runExe("herdr", ["--version"]);
  if (!v.ok) return inactive(v.missing ? "herdr is not on PATH" : `herdr --version failed: ${v.reason}`);
  const version = (/\d+\.\d+\.\d+\S*/.exec(v.stdout) ?? [v.stdout.trim()])[0];
  const st = runExe("herdr", ["status", "server"]);
  if (!parseStatusServer(st.stdout)) return inactive("herdr server is not running");
  let source, anchor = null, candidates;
  if (env.HERDR_ENV === "1") {
    source = "env";
    if (env.HERDR_PANE_ID) anchor = env.HERDR_PANE_ID;
    else {
      const panes = panesOf(herdrJson(["pane", "list"]));
      if (panes) { const m = matchAnchor({ root, runId, panes }); candidates = m.candidates; if (m.anchor) anchor = m.anchor; }
    }
  } else {
    const panes = panesOf(herdrJson(["pane", "list"]));
    if (!panes) return inactive("pane list unavailable");
    const m = matchAnchor({ root, runId, panes });
    candidates = m.candidates;
    if (!m.anchor) return inactive(m.reason, explain ? { candidates } : {});
    source = m.source; anchor = m.anchor;
  }
  return { ok: true, active: true, source, anchor, mode: s.mode, modeSource: s.sources.mode, runTimeoutMinutes: s.runTimeoutMinutes, version, ...(explain ? { candidates: candidates ?? [] } : {}) };
}

// ---- open / close ----------------------------------------------------------------------------------
/** The `pane run` command: node, this script, a mode and the job file; forward slashes, quotes only around a path with a space. */
export function paneCommand(mode, job) {
  const q = (p) => { const f = p.replace(/\\/g, "/"); return f.includes(" ") ? `"${f}"` : f; };
  return `node ${q(SCRIPT)} ${mode} ${q(job)}`;
}

function liveIds() {
  const panes = panesOf(herdrJson(["pane", "list"]));
  return panes ? new Set(panes.map((p) => p?.pane_id).filter((x) => typeof x === "string")) : undefined;
}

/** Split, label and start one pane. { ok, pane?, reason?, warnings }. */
function openPane({ root, runId, det, step, agent, job, mode, live }) {
  const warnings = [];
  const anchor = det.anchor;
  if (anchor && det.source !== "cached" && !fs.existsSync(path.join(stateDir(root, runId), "anchor.json"))) {
    atomicWrite(path.join(stateDir(root, runId), "anchor.json"), `${JSON.stringify({ pane: anchor, source: det.source, at: new Date().toISOString() })}\n`);
  }
  const prior = runPanes(root, runId).find((p) => !live || live.has(p.pane));
  const split = (target, dir) => herdrJson(["pane", "split", ...(target ? [target] : ["--current"]), "--direction", dir, "--no-focus", "--cwd", root]);
  let r = prior ? split(prior.pane, "down") : split(anchor, "right");
  if (!r.ok && r.errorCode === "pane_not_found" && prior) r = split(anchor, "right");
  if (!r.ok) return { ok: false, reason: `pane split failed: ${r.reason}`, warnings };
  const pane = paneIdFrom(r.json);
  if (typeof pane !== "string" || !pane) return { ok: false, reason: "unexpected herdr output", warnings };
  const rn = runExe("herdr", ["pane", "rename", pane, `${agent} ${step}`]);
  if (!rn.ok) warnings.push(`pane rename ${pane}: ${rn.reason}`);
  const jobFile = jobPath(root, runId, step, agent);
  atomicWrite(jobFile, `${JSON.stringify(job, null, 2)}\n`);
  atomicWrite(paneFile(root, runId, step, agent), `${JSON.stringify({ pane, mode, step, agent, opened: job.opened ?? new Date().toISOString() })}\n`);
  live?.add(pane);
  const run = runExe("herdr", ["pane", "run", pane, paneCommand(job.kind, jobFile)]);
  if (!run.ok) {
    runExe("herdr", ["pane", "close", pane]);
    try { fs.rmSync(paneFile(root, runId, step, agent), { force: true }); } catch {}
    return { ok: false, pane, reason: `pane run failed: ${run.reason}`, warnings };
  }
  return { ok: true, pane, warnings };
}

function openCommand({ root, run, runId, pairs }) {
  const det = detectState({ root, runId });
  if (!det.active) return { ok: true, opened: [], skipped: pairs.map(({ step, agent }) => ({ step, agent, reason: det.reason })), warnings: [] };
  const opened = [], failed = [], warnings = [];
  const live = liveIds();
  for (const { step, agent, record } of pairs) {
    try {
      const job = { kind: "watch", run, step, agent, record: record ? path.resolve(root, record) : null, opened: new Date().toISOString() };
      const r = openPane({ root, runId, det, step, agent, job, mode: "watch", live });
      warnings.push(...r.warnings);
      if (r.ok) opened.push({ step, agent, pane: r.pane });
      else failed.push({ step, agent, reason: r.reason });
    } catch (e) { failed.push({ step, agent, reason: `internal: ${e.message}` }); }
  }
  return failed.length ? { ok: false, opened, failed, warnings } : { ok: true, opened, skipped: [], warnings };
}

function closeOne(root, runId, step, agent) {
  const file = paneFile(root, runId, step, agent);
  const j = readJson(file);
  if (!j || typeof j.pane !== "string") { try { fs.rmSync(file, { force: true }); } catch {} return { none: true }; }
  const r = herdrJson(["pane", "close", j.pane]);
  const gone = r.ok || r.errorCode === "pane_not_found" || (r.status === 0 && !r.errorCode);
  if (!gone) return { ok: false, pane: j.pane, reason: r.reason };
  fs.rmSync(file, { force: true });
  return { ok: true, pane: j.pane };
}

function closeCommand({ root, runId, pairs }) {
  const closed = [], notOpen = [], failed = [];
  for (const { step, agent } of pairs) {
    const r = closeOne(root, runId, step, agent);
    if (r.none) notOpen.push({ step, agent });
    else if (r.ok) closed.push({ step, agent, pane: r.pane });
    else failed.push({ step, agent, pane: r.pane, reason: r.reason });
  }
  if (failed.length) return { ok: false, closed, failed };
  return closed.length ? { ok: true, closed, notOpen } : { ok: true, closed: [], reason: "no pane" };
}

// ---- run (run-in-pane) ----------------------------------------------------------------------------
const SAFE_PATH = /^[A-Za-z0-9._\/-]+$/;
const safeRel = (p) => typeof p === "string" && SAFE_PATH.test(p) && !p.split("/").includes("..") && !p.startsWith("/");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runCommand({ root, run, runId, step, agent, record, out, worktree, timeout }) {
  const det = detectState({ root, runId });
  if (!det.active) return { ok: false, stage: "launch", reason: det.reason };
  if (det.mode !== "run-in-pane") return { ok: false, stage: "launch", reason: `mode is ${det.mode}, not run-in-pane` };
  if (!safeRel(record) || !safeRel(out) || !fs.existsSync(path.join(root, record)) || (worktree !== undefined && !/^[A-Za-z0-9._-]+$/.test(worktree))) {
    return { ok: false, stage: "launch", reason: "unsafe or missing path" };
  }
  const timeoutMinutes = timeout ?? det.runTimeoutMinutes;
  const outFile = path.join(root, out), exitFile = `${outFile}.exit`;
  for (const f of [outFile, exitFile]) fs.rmSync(f, { force: true });
  const job = { kind: "child", agent, record, out, ...(worktree ? { worktree } : {}), timeoutMinutes, root, opened: new Date().toISOString() };
  const opened = openPane({ root, runId, det, step, agent, job, mode: "run-in-pane", live: liveIds() });
  if (!opened.ok) {
    if (opened.pane) runExe("herdr", ["pane", "close", opened.pane]);
    return { ok: false, stage: "launch", reason: opened.reason };
  }
  const pane = opened.pane;
  const every = pollMs(1000);
  const deadline = Date.now() + timeoutMinutes * 60_000 + 15_000;
  let polls = 0, stopped;
  while (!fs.existsSync(exitFile)) {
    if (Date.now() > deadline) { stopped = `no result within ${timeoutMinutes} min`; break; }
    await sleep(every);
    if (++polls % 10 === 0 && !fs.existsSync(exitFile)) {
      const ids = liveIds();
      if (ids && !ids.has(pane) && !fs.existsSync(exitFile)) { stopped = "pane closed before the agent finished"; break; }
    }
  }
  if (stopped) return { ok: false, stage: "run", reason: stopped, exit: null, pane };
  const ex = readJson(exitFile);
  if (!isObj(ex)) return { ok: false, stage: "run", reason: "unreadable .exit file", exit: null, pane };
  const text = readMaybe(outFile);
  if (ex.usable === true && text !== undefined && text.trim()) {
    closeOne(root, runId, step, agent);
    return { ok: true, result: out, exit: ex.exit ?? 0, permissionDenials: ex.permissionDenials ?? 0, sessionId: ex.sessionId ?? null, costUsd: ex.costUsd ?? null };
  }
  return { ok: false, stage: "run", reason: ex.reason ?? "no usable result", exit: ex.exit ?? null, pane };
}

// ---- pane side: child ----------------------------------------------------------------------------
/** The fixed brief of a run-in-pane child. Only characters safeArg allows, so it passes cmd.exe unchanged. */
export function childPrompt(record) {
  return `Handoff record - read it first - it is your brief: ${record}. Do the work it asks and end with your report. Its line 1 is: handoff ${path.posix.basename(record)}: passed or failed - why`;
}

/** The `claude -p` arguments of a run-in-pane child. */
export function childArgs(job) {
  return ["-p", childPrompt(job.record), "--agent", `ai-dlc:${job.agent}`, "--output-format", "stream-json", "--verbose", "--permission-prompts", "none", ...(job.worktree ? ["--worktree", job.worktree] : [])];
}

/** One stream-json event as one pane line, or undefined. */
export function renderEvent(ev) {
  if (!isObj(ev)) return undefined;
  if (ev.type === "system" && ev.subtype === "init") return `[start] ${ev.model ?? ""}`.trim();
  if (ev.type === "result") return `[done] ${ev.subtype ?? "?"} ${ev.num_turns ?? "?"} turns $${ev.total_cost_usd ?? "?"}`;
  if (ev.type === "assistant" && Array.isArray(ev.message?.content)) {
    const lines = [];
    for (const b of ev.message.content) {
      if (b?.type === "text" && typeof b.text === "string") lines.push(b.text.replace(/\s+/g, " ").trim().slice(0, 160));
      else if (b?.type === "tool_use") {
        const i = isObj(b.input) ? b.input : {};
        const main = i.command ?? i.file_path ?? i.pattern ?? i.description ?? i.prompt ?? JSON.stringify(b.input ?? "");
        lines.push(`> ${b.name} ${String(main).replace(/\s+/g, " ").slice(0, 100)}`);
      }
    }
    return lines.filter(Boolean).join("\n") || undefined;
  }
  return undefined;
}

/** Whether a final result object is a usable hand-back, and why not. */
export function usableResult(exit, result) {
  if (exit !== 0) return { usable: false, reason: exit === null ? "claude did not exit normally" : `claude exited ${exit}` };
  if (!isObj(result)) return { usable: false, reason: "no result line" };
  if (result.is_error === true) return { usable: false, reason: "result is an error" };
  if (result.subtype !== "success") return { usable: false, reason: `result subtype ${result.subtype}` };
  if (typeof result.result !== "string" || !result.result.trim()) return { usable: false, reason: "blank result" };
  return { usable: true };
}

function killTree(child) {
  if (process.platform === "win32") { try { execFileSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore", windowsHide: true }); } catch {} return; }
  try { child.kill("SIGTERM"); } catch {}
  setTimeout(() => { try { child.kill("SIGKILL"); } catch {} }, 5000).unref();
}

async function childCommand(jobFile) {
  const job = readJson(jobFile);
  if (!isObj(job) || job.kind !== "child" || !safeRel(job.record) || !safeRel(job.out) || typeof job.root !== "string") { console.log("[no usable result: bad job file]"); return 0; }
  const outFile = path.join(job.root, job.out), exitFile = `${outFile}.exit`;
  const finish = (fields) => { atomicWrite(exitFile, JSON.stringify(fields)); };
  const exe = resolveExe("claude");
  if (!exe) { finish({ usable: false, exit: null, reason: "claude is not on PATH" }); console.log("[no usable result: claude is not on PATH]"); return 0; }
  const args = childArgs(job);
  if (exe.shell && !args.every(safeArg)) { finish({ usable: false, exit: null, reason: "unsafe argument" }); console.log("[no usable result: unsafe argument]"); return 0; }
  const env = { ...process.env, AI_DLC_HERDR_MODE: "off" };
  for (const k of Object.keys(env)) if (k.toUpperCase() === "HERDR_ENV") delete env[k];
  const opts = { cwd: job.root, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: false };
  const child = exe.shell ? spawn(shellLine(exe.file, args), { ...opts, shell: true }) : spawn(exe.file, args, opts);
  let result, timedOut = false, spawnError;
  const minutes = Number(job.timeoutMinutes) > 0 ? Number(job.timeoutMinutes) : 60;
  const timer = setTimeout(() => { timedOut = true; killTree(child); }, minutes * 60_000);
  readline.createInterface({ input: child.stdout }).on("line", (line) => {
    let ev;
    try { ev = JSON.parse(line); } catch { console.log(line); return; }
    if (isObj(ev) && ev.type === "result") result = ev;
    const shown = renderEvent(ev);
    if (shown) console.log(shown);
  });
  readline.createInterface({ input: child.stderr }).on("line", (line) => console.log(line));
  const code = await new Promise((resolve) => {
    child.on("error", (e) => { spawnError = e.message; resolve(null); });
    child.on("close", (c) => resolve(c));
  });
  clearTimeout(timer);
  const u = timedOut ? { usable: false, reason: `timed out after ${minutes} min` } : spawnError ? { usable: false, reason: `claude: ${spawnError}` } : usableResult(code, result);
  if (u.usable) atomicWrite(outFile, result.result);
  finish({
    usable: u.usable, exit: code, subtype: result?.subtype ?? null, isError: result?.is_error ?? null, terminalReason: result?.terminal_reason ?? null,
    permissionDenials: Array.isArray(result?.permission_denials) ? result.permission_denials.length : 0, sessionId: result?.session_id ?? null, costUsd: result?.total_cost_usd ?? null,
    ...(u.usable ? {} : { reason: u.reason }),
  });
  console.log(u.usable ? `[result written: ${job.out}]` : `[no usable result: ${u.reason}]`);
  return 0;
}

// ---- pane side: watch ----------------------------------------------------------------------------
const hhmmss = (d) => d.toTimeString().slice(0, 8);

/** The first 6 lines of the record's `## Your task` section, else of its body. */
function taskLines(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let i = lines.findIndex((l) => /^##\s+Your task\s*$/.test(l));
  if (i < 0) { i = lines[0] === "---" ? lines.indexOf("---", 1) : -1; }
  return lines.slice(i + 1).filter((l) => l.trim()).slice(0, 6);
}

function transcriptLines(recordName) {
  try {
    const base = process.env.AI_DLC_HERDR_TRANSCRIPT_ROOT || path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"), "projects");
    const files = [];
    for (const p of fs.readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      let sessions = [];
      try { sessions = fs.readdirSync(path.join(base, p.name), { withFileTypes: true }).filter((e) => e.isDirectory()); } catch { continue; }
      for (const s of sessions) {
        const dir = path.join(base, p.name, s.name, "subagents");
        let names = [];
        try { names = fs.readdirSync(dir).filter((f) => /^agent-.*\.jsonl$/.test(f)); } catch { continue; }
        for (const f of names) { try { files.push({ file: path.join(dir, f), mtime: fs.statSync(path.join(dir, f)).mtimeMs }); } catch {} }
      }
    }
    files.sort((a, b) => b.mtime - a.mtime);
    for (const { file } of files.slice(0, 20)) {
      const fd = fs.openSync(file, "r");
      let head;
      try { const buf = Buffer.alloc(8192); head = buf.toString("utf8", 0, fs.readSync(fd, buf, 0, 8192, 0)); } finally { fs.closeSync(fd); }
      if (!head.includes(recordName)) continue;
      const out = [];
      for (const line of fs.readFileSync(file, "utf8").split("\n")) {
        let ev;
        try { ev = JSON.parse(line); } catch { continue; }
        const shown = ev?.type === "assistant" ? renderEvent(ev) : undefined;
        if (shown) out.push(...shown.split("\n"));
      }
      return out.slice(-8);
    }
  } catch {}
  return [];
}

async function watchCommand(jobFile) {
  const job = readJson(jobFile);
  if (!isObj(job) || typeof job.run !== "string" || typeof job.step !== "string" || typeof job.agent !== "string") { console.log("[watch: bad job file]"); return 0; }
  const opened = Date.parse(job.opened) || Date.now();
  const recordName = job.record ? path.basename(job.record) : "";
  const every = pollMs(2000);
  for (;;) {
    let names = [];
    try { names = fs.readdirSync(job.run); } catch {}
    const done = names.find((f) => f.startsWith(`${job.step}-${job.agent}-to-`) && f.endsWith(".handback.md"));
    const elapsed = Math.max(0, Math.floor((Date.now() - opened) / 1000));
    const lines = [`${job.agent} ${job.step}   ${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}   ${recordName}`];
    if (job.record) { const t = readMaybe(job.record); lines.push(...(t === undefined ? ["(record not readable)"] : taskLines(t))); }
    const events = names.filter((f) => f.includes(`-${job.agent}-to-`) || f.includes(`-to-${job.agent}.`))
      .map((f) => { try { return { f, m: fs.statSync(path.join(job.run, f)).mtimeMs }; } catch { return undefined; } })
      .filter((e) => e && e.m >= opened - 1000).sort((a, b) => b.m - a.m).slice(0, 12);
    if (events.length) lines.push("", ...events.map((e) => `${hhmmss(new Date(e.m))} ${e.f}`));
    if (recordName) { const t = transcriptLines(recordName); if (t.length) lines.push("", ...t); }
    process.stdout.write(`\x1b[2J\x1b[H${lines.join("\n")}\n`);
    if (done) { console.log(`[${job.agent} ${job.step} finished]`); return 0; }
    await sleep(every);
  }
}

// ---- CLI ---------------------------------------------------------------------------------------------
const STEP = /^[0-9]+(\.[0-9a-z]+)*$/;
const AGENT = /^[a-z0-9][a-z0-9-]*$/;
const RUN_ID = /^[A-Za-z0-9._-]+$/;
const VALUED = ["--root", "--run", "--step", "--agent", "--record", "--out", "--worktree", "--timeout"];
const FLAGS = ["--explain", "--json", "--dry-run"];
const USAGE = "usage: herdr.mjs detect [--explain] [--run <dir>] | open|close --run <dir> (--step <code> --agent <id> [--record <path>])... | run --run <dir> --step <code> --agent <id> --record <path> --out <path> [--worktree <name>] [--timeout <minutes>] | watch|child <job.json> | show [--json] | merge [--dry-run] | set <key>=<value>... [--dry-run] | validate  [--root <dir>]";

class UsageError extends Error {}

/** Arguments read left to right; each --agent closes the pair its --step opened; --record goes with the latest pair. */
export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = {}, flags = new Set(), positional = [], pairs = [];
  let pending;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (FLAGS.includes(a)) { flags.add(a); continue; }
    if (VALUED.includes(a)) {
      const v = rest[i + 1];
      if (v === undefined || v.startsWith("--")) throw new UsageError(`${a} needs a value`);
      i++;
      if (a === "--step") { if (!STEP.test(v)) throw new UsageError(`--step ${JSON.stringify(v)} is not a step code`); if (pending) throw new UsageError("--step without --agent"); pending = { step: v }; }
      else if (a === "--agent") { if (!AGENT.test(v)) throw new UsageError(`--agent ${JSON.stringify(v)} is not an agent id`); if (!pending) throw new UsageError("--agent without --step"); pending.agent = v; pairs.push(pending); pending = undefined; }
      else if (a === "--record") { const target = pending ?? pairs[pairs.length - 1]; if (target) target.record = v; opts.record = v; }
      else opts[a.slice(2)] = v;
      continue;
    }
    if (a.startsWith("--")) throw new UsageError(`unknown option ${a}`);
    positional.push(a);
  }
  if (pending) throw new UsageError("--step without --agent");
  return { command, opts, flags, positional, pairs };
}

function runContext(opts, required) {
  const root = path.resolve(opts.root ?? gitRoot(process.cwd()));
  if (opts.run === undefined) { if (required) throw new UsageError("--run is required"); return { root }; }
  const run = path.resolve(root, opts.run);
  const runId = path.basename(run);
  if (!RUN_ID.test(runId) || /[\r\n\0]/.test(opts.run)) throw new UsageError(`--run ${JSON.stringify(opts.run)} is not a run folder`);
  return { root, run, runId };
}

function settingsMain(command, rest, flags, root) {
  const out = (s) => process.stdout.write(`${s}\n`);
  const { keys } = loadSchema();
  const file = path.join(root, ".ai-dlc", FILE_NAME);
  const dryRun = flags.has("--dry-run");
  switch (command) {
    case "show": {
      const { rows, warnings } = effective(root, keys);
      if (flags.has("--json")) { out(JSON.stringify({ settings: rows, warnings }, null, 2)); return 0; }
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
  }
  return 2;
}

const emit = (obj) => process.stdout.write(`${JSON.stringify(obj)}\n`);

export async function main(argv) {
  let parsed;
  try { parsed = parseArgs(argv); } catch (e) {
    if (e instanceof UsageError) { emit({ ok: false, reason: `usage: ${e.message}` }); return 2; }
    throw e;
  }
  const { command, opts, flags, positional, pairs } = parsed;
  if (["watch", "child"].includes(command)) {
    try { return command === "watch" ? await watchCommand(positional[0] ?? "") : await childCommand(positional[0] ?? ""); }
    catch (e) { console.log(`[${command}: ${e.message}]`); return 0; }
  }
  if (["show", "merge", "set", "validate"].includes(command)) {
    return settingsMain(command, positional, flags, path.resolve(opts.root ?? gitRoot(process.cwd())));
  }
  if (!["detect", "open", "close", "run"].includes(command)) { emit({ ok: false, reason: USAGE }); return command === "--help" || command === "help" ? 0 : 2; }
  try {
    const ctx = runContext(opts, command !== "detect");
    if (command !== "detect" && !pairs.length) throw new UsageError(`${command} needs --step <code> --agent <id>`);
    if (command === "run" && pairs.length !== 1) throw new UsageError("run takes one --step/--agent pair");
    let timeout;
    if (opts.timeout !== undefined) { timeout = Number(opts.timeout); if (!NUMBER.test(opts.timeout) || !(timeout > 0)) throw new UsageError("--timeout must be minutes above 0"); }
    if (command === "detect") { const d = detectState({ root: ctx.root, runId: ctx.runId, explain: flags.has("--explain") }); emit(d); return 0; }
    if (command === "open") { emit(openCommand({ ...ctx, pairs })); return 0; }
    if (command === "close") { emit(closeCommand({ ...ctx, pairs })); return 0; }
    emit(await runCommand({ ...ctx, ...pairs[0], record: opts.record, out: opts.out, worktree: opts.worktree, timeout }));
    return 0;
  } catch (e) {
    if (e instanceof UsageError) { emit({ ok: false, reason: `usage: ${e.message}` }); return 2; }
    emit({ ok: false, reason: `internal: ${e.message}` });
    return 0;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT) main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => { process.stdout.write(`${JSON.stringify({ ok: false, reason: `internal: ${e.message}` })}\n`); process.exitCode = 0; });
