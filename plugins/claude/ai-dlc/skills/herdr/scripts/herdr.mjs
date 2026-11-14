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
// run's result comes from the result file the child writes (main); when that channel lost a result the child produced,
// from a base64 copy the child prints in its pane, read with `pane read` and checked by byte count and sha256 (fallback).
// run's ok:true means "the agent's final text was copied to the result file", never "the hand-back is valid".
// Settings commands (for people; the format of configure-auto-handoff's auto-handoff.mjs):
//   show [--json] | merge [--dry-run] | set <key>=<value>... [--dry-run] | validate
//
// Options: --root <dir> (default: git root, else the working directory).
// Each setting is read, highest first, from `env` in .claude/settings.local.json, `env` in
// .claude/settings.json, the process environment, .ai-dlc/herdr.json, then the default.
// State and job files live in <root>/.scratch/herdr/<run-id>/ (gitignored).
// Test hooks, not settings: AI_DLC_HERDR_CALL_TIMEOUT_MS (5000), AI_DLC_HERDR_POLL_MS,
// AI_DLC_HERDR_TRANSCRIPT_ROOT.

import crypto from "node:crypto";
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
  const options = { timeout: timeoutMs, encoding: "utf8", windowsHide: true, env, input, maxBuffer: 16 * 1024 * 1024, stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"] };
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

// ---- placement: where a run's next pane goes ---------------------------------------------------------
// Probed on herdr 0.9.5 / Windows: `pane layout --pane <id>` answers the tab of that pane with every pane's rect in cells
// (`result.layout.panes[].rect`: x, y, width, height; no border cells), and a split halves its pane.
/** The size a pane stays readable at: columns and rows of a watch view (its header, task lines and records). */
export const READABLE = { cols: 50, rows: 10 };

const isRect = (r) => isObj(r) && ["x", "y", "width", "height"].every((k) => Number.isInteger(r[k]) && r[k] >= 0) && r.width > 0 && r.height > 0;

/**
 * The split for a run's next pane, among the run's own live panes in one tab (`group`, ids): for each of them and each
 * direction, the smaller half is (width, ⌊height/2⌋) down or (⌊width/2⌋, height) right, scored min(cols/50, rows/10); the
 * best score wins. Ties: the top-left pane first, then down before right. So panes stack down while the halves stay
 * readable, and a new column starts when one more row of panes would make a pane too small. Panes outside the group (the
 * session's own pane, other runs' panes) are never split. Pure. { pane, direction, cols, rows, readable } or undefined
 * when no group pane has a rect in `layoutPanes`.
 */
export function choosePlacement(layoutPanes, group) {
  const ids = new Set(group);
  const mine = (Array.isArray(layoutPanes) ? layoutPanes : []).filter((p) => isObj(p) && typeof p.pane_id === "string" && ids.has(p.pane_id) && isRect(p.rect))
    .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  let best;
  for (const p of mine) {
    const { width, height } = p.rect;
    for (const direction of ["down", "right"]) {
      const cols = direction === "right" ? Math.floor(width / 2) : width;
      const rows = direction === "down" ? Math.floor(height / 2) : height;
      const score = Math.min(cols / READABLE.cols, rows / READABLE.rows);
      if (!best || score > best.score) best = { pane: p.pane_id, direction, cols, rows, score };
    }
  }
  if (!best) return undefined;
  const { score, ...place } = best;
  return { ...place, readable: place.cols >= READABLE.cols && place.rows >= READABLE.rows };
}

/** choosePlacement over the live `pane layout` of the tab that holds the run's newest live pane; undefined when unavailable. */
function placeInLayout(livePanes) {
  const lay = herdrJson(["pane", "layout", "--pane", livePanes[0].pane]);
  const panes = lay.ok ? lay.json?.result?.layout?.panes : undefined;
  return Array.isArray(panes) ? choosePlacement(panes, livePanes.map((p) => p.pane)) : undefined;
}

/**
 * Split, label and start one pane. { ok, pane?, reason?, warnings }.
 * Placement: the run's first pane goes right of the anchor; every later one splits a live pane of the same run, chosen
 * by choosePlacement on the tab's layout, so a run's panes stay together and readable. Without a usable layout (the
 * call fails, or none of the run's panes is in it) it splits down from the run's newest live pane, as before.
 * The only place that closes a pane after a failure: once the split succeeded, any later failure closes the new pane
 * here, once, and its callers (open, run) never close it again.
 */
function openPane({ root, runId, det, step, agent, job, mode, live }) {
  const warnings = [];
  const anchor = det.anchor;
  if (anchor && det.source !== "cached" && !fs.existsSync(path.join(stateDir(root, runId), "anchor.json"))) {
    atomicWrite(path.join(stateDir(root, runId), "anchor.json"), `${JSON.stringify({ pane: anchor, source: det.source, at: new Date().toISOString() })}\n`);
  }
  const livePanes = runPanes(root, runId).filter((p) => !live || live.has(p.pane));
  const prior = livePanes[0];
  const split = (target, dir) => herdrJson(["pane", "split", ...(target ? [target] : ["--current"]), "--direction", dir, "--no-focus", "--cwd", root]);
  const place = prior ? placeInLayout(livePanes) : undefined;
  if (place && !place.readable) warnings.push(`layout: the new pane gets about ${place.cols}x${place.rows} cells, below ${READABLE.cols}x${READABLE.rows}`);
  let r = place ? split(place.pane, place.direction) : prior ? split(prior.pane, "down") : split(anchor, "right");
  if (!r.ok && r.errorCode === "pane_not_found" && prior) r = split(anchor, "right");
  if (!r.ok) return { ok: false, reason: `pane split failed: ${r.reason}`, warnings };
  const pane = paneIdFrom(r.json);
  if (typeof pane !== "string" || !pane) return { ok: false, reason: "unexpected herdr output", warnings };
  const fail = (reason) => {
    runExe("herdr", ["pane", "close", pane]);
    try { fs.rmSync(paneFile(root, runId, step, agent), { force: true }); } catch {}
    return { ok: false, pane, reason, warnings };
  };
  try {
    const rn = runExe("herdr", ["pane", "rename", pane, `${agent} ${step}`]);
    if (!rn.ok) warnings.push(`pane rename ${pane}: ${rn.reason}`);
    const jobFile = jobPath(root, runId, step, agent);
    atomicWrite(jobFile, `${JSON.stringify(job, null, 2)}\n`);
    atomicWrite(paneFile(root, runId, step, agent), `${JSON.stringify({ pane, mode, step, agent, opened: job.opened ?? new Date().toISOString() })}\n`);
    live?.add(pane);
    const run = runExe("herdr", ["pane", "run", pane, paneCommand(job.kind, jobFile)]);
    if (!run.ok) return fail(`pane run failed: ${run.reason}`);
  } catch (e) { return fail(`internal: ${e.message}`); }
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
const WORKTREE = /^[A-Za-z0-9._-]+$/;
const NONCE = /^[0-9a-f]{12}$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

// ---- result retrieval: the result file (main) and the pane copy (fallback) --------------------------
// Probed on herdr 0.9.5 / Windows: `pane read` without --lines is only a tail; plain text loses tabs, trailing blanks
// and ANSI; scrollback is bounded (a 39 KB base64 block lost its first marker). Hence base64, a per-run nonce in the
// markers (an older block stays in the scrollback) and a 16 KiB cap on the copy.
export const PANE_COPY_MAX_BYTES = 16384;
export const PANE_COPY_WIDTH = 76;
const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

/** A regex source for a literal with optional whitespace between its characters (its own spaces included). */
const looseLiteral = (s) => [...s].filter((c) => !/\s/.test(c)).map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*");

/** The line-1 shape of a hand-back: `handoff <file>: passed|failed — <why>`. */
export const HANDOFF_LINE = /^handoff \S+: (passed|failed) — /;

/** The pane copy block of a result: BEGIN marker, base64 at 76 columns, END marker with the sha256; LF line ends. */
export function encodePaneCopy(text, nonce) {
  const buf = Buffer.from(String(text), "utf8");
  const b64 = buf.toString("base64");
  const lines = [];
  for (let i = 0; i < b64.length; i += PANE_COPY_WIDTH) lines.push(b64.slice(i, i + PANE_COPY_WIDTH));
  return [`<<<HERDR-RESULT-BEGIN-${nonce} encoding=base64 bytes=${buf.length}>>>`, ...lines, `<<<HERDR-RESULT-END-${nonce} sha256=${sha256(buf)}>>>`, ""].join("\n");
}

/**
 * The result in a pane's text: { ok: true, text } or { ok: false, reason }. Takes the last END marker of this nonce and
 * the last BEGIN marker before it; markers of another nonce are ignored. All whitespace between them is removed, so CRLF,
 * trailing blanks and wrapped lines do not matter; text around the block (a shell prompt) is ignored. The markers match
 * with any whitespace between their characters too, so a marker line the pane wrapped still decodes.
 */
export function decodePaneCopy(paneText, nonce) {
  const text = String(paneText ?? "");
  if (typeof nonce !== "string" || !NONCE.test(nonce)) return { ok: false, reason: "markers missing" };
  const endRe = new RegExp(`${looseLiteral(`<<<HERDR-RESULT-END-${nonce} sha256=`)}\\s*((?:[0-9a-f]\\s*){63}[0-9a-f])\\s*${looseLiteral(">>>")}`, "g");
  const beginRe = new RegExp(`${looseLiteral(`<<<HERDR-RESULT-BEGIN-${nonce} encoding=base64 bytes=`)}\\s*([0-9](?:\\s*[0-9])*)\\s*${looseLiteral(">>>")}`, "g");
  let end;
  for (const m of text.matchAll(endRe)) end = m;
  if (!end) return { ok: false, reason: "markers missing" };
  let begin;
  for (const m of text.slice(0, end.index).matchAll(beginRe)) begin = m;
  if (!begin) return { ok: false, reason: "markers missing" };
  const body = text.slice(begin.index + begin[0].length, end.index).replace(/\s+/g, "");
  if (body.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(body)) return { ok: false, reason: "invalid base64" };
  const buf = Buffer.from(body, "base64");
  if (buf.length !== Number(begin[1].replace(/\s+/g, ""))) return { ok: false, reason: "size mismatch" };
  if (sha256(buf) !== end[1].replace(/\s+/g, "")) return { ok: false, reason: "hash mismatch" };
  return { ok: true, text: buf.toString("utf8") };
}

/** `pane read` of a run-in-pane pane: { ok, text? , gone?, reason? }. */
function readPaneText(pane) {
  const r = runExe("herdr", ["pane", "read", pane, "--source", "recent-unwrapped", "--lines", "100000"]);
  if (r.ok) return { ok: true, text: r.stdout };
  let code;
  for (const t of [r.stderr, r.stdout]) { try { const j = JSON.parse(String(t).trim()); if (isObj(j?.error)) code = j.error.code; } catch {} if (code) break; }
  return code === "pane_not_found" ? { ok: false, gone: true, reason: "pane not found" } : { ok: false, reason: `pane read failed: ${code ?? r.reason}` };
}

/**
 * The result of a run (LLD 3.8.2). Main: `.exit` says usable and the result file matches its sha256 → source "file".
 * Fallback, only when the file channel lost a result the child may have produced (usable but the file missing, empty
 * or changed; writeError; `.exit` missing or unparsable): the pane copy → source "pane", written to the result file.
 * Never when `.exit.usable` is false: the child's own verdict stands.
 * job: { outFile, nonce, pane, missingReason } (missingReason: why there is no parsable `.exit`); ex: `.exit` or undefined.
 * deps: { readPane(pane), sleep(ms), attempts }. Returns { ok: true, source, text } or { ok: false, reason }.
 */
export async function retrieveResult({ outFile, nonce, pane, missingReason }, ex, deps = {}) {
  const readPane = deps.readPane ?? readPaneText;
  const wait = deps.sleep ?? sleep;
  const attempts = deps.attempts ?? 3;
  let mainReason;
  if (isObj(ex)) {
    if (ex.usable === false) return { ok: false, reason: ex.reason ?? "no usable result" };
    if (ex.usable === true && !ex.writeError) {
      let buf;
      try { buf = fs.readFileSync(outFile); } catch {}
      if (buf && buf.length && buf.toString("utf8").trim() && typeof ex.sha256 === "string" && sha256(buf) === ex.sha256) {
        return { ok: true, source: "file", text: buf.toString("utf8") };
      }
      mainReason = !buf || !buf.length || !buf.toString("utf8").trim() ? "result file missing or empty" : "result file does not match .exit";
    } else if (ex.writeError) mainReason = `result file not written: ${ex.writeError}`;
    else mainReason = "no usable result";
  } else mainReason = missingReason ?? "no .exit file";
  let last;
  for (let i = 0; i < attempts; i++) {
    if (i) await wait(pollMs(500));
    const read = readPane(pane);
    if (!read.ok) { if (read.gone) return { ok: false, reason: mainReason }; last = read.reason; continue; }
    const got = decodePaneCopy(read.text, nonce);
    if (got.ok) {
      if (!got.text.trim()) return { ok: false, reason: "pane copy unusable: blank result" };
      try { atomicWrite(outFile, got.text); } catch (e) { return { ok: false, reason: `pane copy not written: ${e.message}` }; }
      return { ok: true, source: "pane", text: got.text };
    }
    last = got.reason;
    if (got.reason !== "markers missing") break;
  }
  return { ok: false, reason: `pane copy unusable: ${last}` };
}

async function runCommand({ root, run, runId, step, agent, record, out, worktree, timeout }) {
  const det = detectState({ root, runId });
  if (!det.active) return { ok: false, stage: "launch", reason: det.reason };
  if (det.mode !== "run-in-pane") return { ok: false, stage: "launch", reason: `mode is ${det.mode}, not run-in-pane` };
  if (!safeRel(record) || !safeRel(out) || !fs.existsSync(path.join(root, record)) || !AGENT.test(agent) || (worktree !== undefined && !WORKTREE.test(worktree))) {
    return { ok: false, stage: "launch", reason: "unsafe or missing path" };
  }
  const timeoutMinutes = timeout ?? det.runTimeoutMinutes;
  const outFile = path.join(root, out), exitFile = `${outFile}.exit`;
  for (const f of [outFile, exitFile]) fs.rmSync(f, { force: true });
  const nonce = crypto.randomBytes(6).toString("hex");
  const job = { kind: "child", agent, record, out, ...(worktree ? { worktree } : {}), timeoutMinutes, root, nonce, opened: new Date().toISOString() };
  const opened = openPane({ root, runId, det, step, agent, job, mode: "run-in-pane", live: liveIds() });
  if (!opened.ok) return { ok: false, stage: "launch", reason: opened.reason };
  const pane = opened.pane;
  const every = pollMs(1000);
  const deadline = Date.now() + timeoutMinutes * 60_000 + 15_000;
  let polls = 0, missingReason;
  while (!fs.existsSync(exitFile)) {
    if (Date.now() > deadline) { missingReason = `no result within ${timeoutMinutes} min`; break; }
    await sleep(every);
    if (++polls % 10 === 0 && !fs.existsSync(exitFile)) {
      const ids = liveIds();
      if (ids && !ids.has(pane)) {
        if (fs.existsSync(exitFile)) break; // it finished just before the pane closed
        return { ok: false, stage: "run", reason: "pane closed before the agent finished", exit: null, pane };
      }
    }
  }
  let ex;
  if (!missingReason) { ex = readJson(exitFile); if (!isObj(ex)) { ex = undefined; missingReason = "unreadable .exit file"; } }
  const got = await retrieveResult({ outFile, nonce, pane, missingReason }, ex);
  if (!got.ok) return { ok: false, stage: "run", reason: got.reason, exit: ex?.exit ?? null, pane };
  if (got.source === "pane" && ex) { try { atomicWrite(exitFile, JSON.stringify({ ...ex, resultSource: "pane" })); } catch {} }
  closeOne(root, runId, step, agent);
  const line1 = got.text.replace(/^﻿/, "").split(/\r?\n/, 1)[0];
  return {
    ok: true, result: out, source: got.source, exit: ex ? (ex.exit ?? 0) : null, line1: line1.slice(0, 200), handoffLine: HANDOFF_LINE.test(line1),
    permissionDenials: ex?.permissionDenials ?? 0, sessionId: ex?.sessionId ?? null, costUsd: ex?.costUsd ?? null,
  };
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

/**
 * Stop a child and everything it started; never throws. Windows: `taskkill /t /f`. POSIX: the child was spawned
 * detached, so it leads its own process group: SIGTERM to the group, SIGKILL 5 s later (the child alone if the group
 * signal fails).
 */
export function killTree(child, platform = process.platform) {
  const pid = child?.pid;
  if (!pid) return;
  if (platform === "win32") { try { execFileSync("taskkill", ["/pid", String(pid), "/t", "/f"], { stdio: "ignore", windowsHide: true }); } catch {} return; }
  const signal = (s) => { try { process.kill(-pid, s); } catch { try { child.kill(s); } catch {} } };
  signal("SIGTERM");
  setTimeout(() => signal("SIGKILL"), 5000).unref();
}

/**
 * Validate a child job and build its claude call; pure apart from finding claude on PATH.
 * { ok: true, file, args, shell } or { ok: false, field } (an invalid job field) or { ok: false, reason }.
 */
export function childCommand(job, env = process.env) {
  if (!isObj(job) || job.kind !== "child") return { ok: false, field: "kind" };
  if (typeof job.root !== "string" || !isDir(job.root)) return { ok: false, field: "root" };
  if (!safeRel(job.out)) return { ok: false, field: "out" };
  if (!safeRel(job.record)) return { ok: false, field: "record" };
  if (typeof job.agent !== "string" || !AGENT.test(job.agent)) return { ok: false, field: "agent" };
  if (job.worktree !== undefined && (typeof job.worktree !== "string" || !WORKTREE.test(job.worktree))) return { ok: false, field: "worktree" };
  if (typeof job.nonce !== "string" || !NONCE.test(job.nonce)) return { ok: false, field: "nonce" };
  if (typeof job.timeoutMinutes !== "number" || !(job.timeoutMinutes > 0)) return { ok: false, field: "timeoutMinutes" };
  const exe = resolveExe("claude", env);
  if (!exe) return { ok: false, reason: "claude is not on PATH" };
  const args = childArgs(job);
  if (exe.shell && !args.every(safeArg)) return { ok: false, reason: "unsafe argument" };
  return { ok: true, file: exe.file, args, shell: exe.shell };
}

const printNow = (text) => new Promise((resolve) => { try { process.stdout.write(text, () => resolve()); } catch { resolve(); } });

/**
 * The end of every child path; never throws. a) a usable result goes to the result file first; b) the pane copy is
 * printed (at most 16 KiB); c) `.exit` is written last, so its presence means the result file is final. Each step is
 * tried on its own: a failing write is recorded (`writeError`) or printed, and the next step still runs.
 * target: { outFile, out, nonce } (outFile undefined when the job named no safe place); r: { usable, reason?, text?, ...fields }.
 */
export async function finishChild(target, r, write = atomicWrite) {
  try {
    const { usable, reason, text, ...fields } = r;
    const buf = typeof text === "string" ? Buffer.from(text, "utf8") : undefined;
    let writeError, paneCopy = false;
    if (usable && target.outFile) { try { write(target.outFile, text); } catch (e) { writeError = e.message; } }
    if (usable && !target.outFile) writeError = "no result file";
    if (usable) {
      await printNow(writeError ? `[result file not written: ${writeError}]\n` : `[result written: ${target.out}]\n`);
      if (buf.length <= PANE_COPY_MAX_BYTES && typeof target.nonce === "string" && NONCE.test(target.nonce)) {
        await printNow(`[result copy for the orchestrator follows: ${buf.length} bytes, base64]\n${encodePaneCopy(text, target.nonce)}`);
        paneCopy = true;
      } else await printNow("[no pane copy: result larger than 16 KiB]\n");
    } else await printNow(`[no usable result: ${reason}]\n`);
    const exit = {
      usable: Boolean(usable), ...fields, ...(buf ? { bytes: buf.length, sha256: sha256(buf) } : {}), paneCopy, nonce: target.nonce ?? null,
      ...(usable ? {} : { reason }), ...(writeError ? { writeError } : {}),
    };
    if (!target.outFile) { await printNow("[could not write .exit: the job names no safe result file]\n"); return; }
    try { write(`${target.outFile}.exit`, JSON.stringify(exit)); } catch (e) { await printNow(`[could not write .exit: ${e.message}]\n`); }
  } catch (e) {
    try { process.stdout.write(`[child: ${e.message}]\n`); } catch {}
  }
}

async function childMain(jobFile) {
  const job = readJson(jobFile);
  const writable = isObj(job) && typeof job.root === "string" && isDir(job.root) && safeRel(job.out);
  const target = { outFile: writable ? path.join(job.root, job.out) : undefined, out: writable ? job.out : undefined, nonce: isObj(job) ? job.nonce : undefined };
  let finished = false;
  const finish = async (r) => { if (finished) return; finished = true; await finishChild(target, r); };
  try {
    const cmd = childCommand(job);
    if (!cmd.ok) { await finish({ usable: false, exit: null, reason: cmd.field ? `invalid job: ${cmd.field}` : cmd.reason }); return 0; }
    return await runChild(job, cmd, finish);
  } catch (e) {
    await finish({ usable: false, exit: null, reason: `internal: ${e.message}` });
    return 0;
  }
}

async function runChild(job, { file, args, shell }, finish) {
  const env = { ...process.env, AI_DLC_HERDR_MODE: "off" };
  for (const k of Object.keys(env)) if (k.toUpperCase() === "HERDR_ENV") delete env[k];
  const opts = { cwd: job.root, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: false, detached: process.platform !== "win32" };
  const child = shell ? spawn(shellLine(file, args), { ...opts, shell: true }) : spawn(file, args, opts);
  const onSignal = () => killTree(child);
  // A closed pane hangs up the wrapper: stop the child's tree; a write to the gone pane must not crash before `.exit`.
  const onHangup = () => { process.stdout.on("error", () => {}); killTree(child); };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  process.on("SIGHUP", onHangup);
  let result, timedOut = false, spawnError;
  const minutes = job.timeoutMinutes;
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
  process.off("SIGINT", onSignal);
  process.off("SIGTERM", onSignal);
  process.off("SIGHUP", onHangup);
  const u = timedOut ? { usable: false, reason: `timed out after ${minutes} min` } : spawnError ? { usable: false, reason: `claude: ${spawnError}` } : usableResult(code, result);
  await finish({
    usable: u.usable, ...(u.usable ? {} : { reason: u.reason }), ...(typeof result?.result === "string" ? { text: result.result } : {}),
    exit: code, subtype: result?.subtype ?? null, isError: result?.is_error ?? null, terminalReason: result?.terminal_reason ?? null,
    permissionDenials: Array.isArray(result?.permission_denials) ? result.permission_denials.length : 0, sessionId: result?.session_id ?? null, costUsd: result?.total_cost_usd ?? null,
  });
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
      // The file, then the other levels (the env of both settings files and the process environment): an invalid value
      // anywhere is an error here, while show only warns and the next level applies.
      const levelErrors = effective(root, keys).warnings.filter((w) => !w.includes(`.ai-dlc/${FILE_NAME}`));
      const repo = readRepoFile(file);
      const errors = repo.error ? [] : repo.doc ? validateDoc(repo.doc, keys) : [];
      if (repo.error) out(`.ai-dlc/${FILE_NAME}: ${repo.error}`);
      for (const e of [...errors, ...levelErrors]) out(`error: ${e}`);
      if (!repo.error && !errors.length) out(repo.doc ? `.ai-dlc/${FILE_NAME} is valid` : `.ai-dlc/${FILE_NAME} does not exist: the defaults apply`);
      return repo.error || errors.length || levelErrors.length ? 1 : 0;
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
    try { return command === "watch" ? await watchCommand(positional[0] ?? "") : await childMain(positional[0] ?? ""); }
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
    if (opts.timeout !== undefined) { timeout = Number(opts.timeout); if (!NUMBER.test(opts.timeout) || !(timeout > 0) || timeout > 720) throw new UsageError("--timeout must be minutes above 0, at most 720"); }
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
