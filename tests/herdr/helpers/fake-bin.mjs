// A sandbox for tests/herdr/: a temp repository, a temp bin/ holding fake `herdr` and `claude` executables (see fake-exe.mjs),
// and a runner for the real herdr.mjs. On win32 the fakes are .cmd files, so the script's `.cmd` shell path runs for real.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, "..", "..", "..");
export const HERDR_MJS = path.join(REPO, "plugins", "claude", "ai-dlc", "skills", "herdr", "scripts", "herdr.mjs");
export const SCHEMA = path.join(REPO, "plugins", "claude", "ai-dlc", "skills", "herdr", "templates", "herdr.schema.json");
const FAKE_EXE = path.join(HERE, "fake-exe.mjs");
const WIN = process.platform === "win32";

export const splitJson = (id) => JSON.stringify({ id: "cli:pane:split", result: { pane: { pane_id: id }, type: "pane_info" } });
export const listJson = (panes) => JSON.stringify({ id: "cli:pane:list", result: { panes, type: "pane_list" } });
export const notFound = { stdout: JSON.stringify({ error: { code: "pane_not_found", message: "no such pane" } }), status: 1 };

/** The success shapes of `claude -p --output-format stream-json --verbose`, as probed in LLD 1.1.6 section 1. */
export const initEvent = { type: "system", subtype: "init", model: "claude-haiku-5-5", agents: ["ai-dlc:agent-manager"] };
export const assistantEvent = { type: "assistant", message: { content: [{ type: "text", text: "working" }, { type: "tool_use", name: "Read", input: { file_path: "x.md" } }] } };
export const resultEvent = (over = {}) => ({ type: "result", subtype: "success", is_error: false, result: "OK", num_turns: 1, permission_denials: [], session_id: "sess-1", total_cost_usd: 0.01, terminal_reason: "completed", ...over });
export const claudeOk = (over = {}) => ({ stdoutLines: [initEvent, assistantEvent, resultEvent(over)] });

/** A `pane list` entry in the live shape (LLD 1.1.6 section 1). */
export const pane = (o) => ({ pane_id: "w1:p1", tab_id: "w1:t1", workspace_id: "w1", agent: "claude", agent_status: "working", cwd: "", focused: true, ...o });

/** A herdr scenario: the answers every command gets unless `extra` (matched first) says otherwise. */
export function herdrCalls({ panes = [], extra = [], splitIds = ["w1:p2"], execRun = false } = {}) {
  return {
    calls: [
      ...extra,
      { match: ["--version"], stdout: "herdr 0.9.5\n" },
      { match: ["status", "server"], stdout: "status: running\nversion: 0.9.5\nsocket: x\n" },
      { match: ["pane", "list"], stdout: listJson(panes) },
      { match: ["pane", "split"], replies: splitIds.map((id) => ({ stdout: splitJson(id) })) },
      { match: ["pane", "run"], execRun },
    ],
    default: { stdout: "", status: 0 },
  };
}

export function sandbox(label) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `herdr-${label}-`)));
  const root = path.join(base, "repo");
  const bin = path.join(base, "bin");
  const log = path.join(base, "calls.log");
  const scriptFile = path.join(base, "scenario.json");
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(log, "");
  const sb = {
    base, root, bin, log,
    /** Install the fakes named in `scenarios` ({ herdr, claude }); a fake not named is not on PATH. */
    install(scenarios) {
      fs.writeFileSync(scriptFile, JSON.stringify(scenarios));
      for (const who of ["herdr", "claude"]) {
        for (const f of [`${who}.cmd`, who]) fs.rmSync(path.join(bin, f), { force: true });
        if (!scenarios[who]) continue;
        if (WIN) fs.writeFileSync(path.join(bin, `${who}.cmd`), `@echo off\r\n"${process.execPath}" "${FAKE_EXE}" ${who} %*\r\nexit /b %ERRORLEVEL%\r\n`);
        else { fs.writeFileSync(path.join(bin, who), `#!/bin/sh\nexec "${process.execPath}" "${FAKE_EXE}" ${who} "$@"\n`); fs.chmodSync(path.join(bin, who), 0o755); }
      }
      return sb;
    },
    /** The environment of a run: PATH is the fake bin (plus the system folder taskkill and sh live in), no HERDR_* variable. */
    env(extra = {}) {
      const env = {};
      for (const [k, v] of Object.entries(process.env)) if (!/^(HERDR_|AI_DLC_HERDR_)/i.test(k) && k.toUpperCase() !== "PATH") env[k] = v;
      env.PATH = WIN ? [bin, path.join(process.env.SystemRoot ?? "C:\\Windows", "System32")].join(";") : [bin, "/usr/bin", "/bin"].join(":");
      env.FAKE_SCRIPT = scriptFile;
      env.FAKE_LOG = log;
      for (const [k, v] of Object.entries(extra)) { if (v === undefined) delete env[k]; else env[k] = v; }
      return env;
    },
    /** Run herdr.mjs as a process with --root set to the sandbox repository. */
    cli(args, { env = {}, cwd = root, timeout = 120000 } = {}) {
      const t0 = Date.now();
      const r = spawnSync(process.execPath, [HERDR_MJS, ...args, "--root", root], { cwd, env: sb.env(env), encoding: "utf8", timeout });
      const lines = r.stdout.split("\n").filter(Boolean);
      let json;
      try { json = JSON.parse(lines[0]); } catch {}
      return { status: r.status, stdout: r.stdout, stderr: r.stderr, lines, json, ms: Date.now() - t0 };
    },
    entries(who) {
      return fs.readFileSync(log, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((e) => !who || e.who === who);
    },
    /** The argv of every herdr call, as a space-joined string for matching. */
    herdr() { return sb.entries("herdr").map((e) => e.args.join(" ")); },
    herdrArgs() { return sb.entries("herdr").map((e) => e.args); },
    write(rel, text) { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); return f; },
    read(rel) { try { return fs.readFileSync(path.join(root, rel), "utf8"); } catch { return undefined; } },
    exists(rel) { return fs.existsSync(path.join(root, rel)); },
    cleanup() { try { fs.rmSync(base, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch {} },
  };
  return sb;
}

/** Wait until `fn()` is truthy or `ms` pass. */
export async function until(fn, ms = 10000, every = 50) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return true; await new Promise((r) => setTimeout(r, every)); }
  return Boolean(fn());
}
