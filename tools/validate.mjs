#!/usr/bin/env node
// validate.mjs — the local pre-validate run for this repository. Zero dependencies; Node 18+.
//
//   node tools/validate.mjs           sync the agent harness, then validate the plugin and the marketplace
//   node tools/validate.mjs --check   the same, but only check the harness sync (what CI does: it never writes)
//
// Steps, in order; every step runs, and the script exits 1 when any of them failed:
//   1. node .claude/scripts/sync-harness.mjs [--check]   .claude/ <-> .github/ twins (skipped when the script is absent)
//   2. npx -y @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/ai-dlc
//   3. npx -y @anthropic-ai/claude-code plugin validate --strict .
// CI (.github/workflows/validate.yml) runs the same commands as separate steps, the sync with --check.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The steps to run: { name, command, args }. `check`: only check the harness sync. */
export function steps({ check = false, root = ROOT } = {}) {
  const out = [];
  const sync = path.join(root, ".claude", "scripts", "sync-harness.mjs");
  if (fs.existsSync(sync)) out.push({ name: check ? "harness sync (check)" : "harness sync", command: process.execPath, args: [sync, ...(check ? ["--check"] : [])] });
  // npx is a .cmd script on Windows, which spawn runs only through cmd.exe; no shell option is used.
  const npx = (args) => process.platform === "win32" ? { command: "cmd.exe", args: ["/d", "/c", "npx", ...args] } : { command: "npx", args };
  out.push({ name: "validate the Claude plugin", ...npx(["-y", "@anthropic-ai/claude-code", "plugin", "validate", "--strict", "./plugins/claude/ai-dlc"]) });
  out.push({ name: "validate the marketplace", ...npx(["-y", "@anthropic-ai/claude-code", "plugin", "validate", "--strict", "."]) });
  return out;
}

/** Runs every step (each one, even after a failure) and returns { failed: [names], code }. `spawn` is
 * spawnSync's shape, replaceable in tests. */
export function run(list, { root = ROOT, spawn = spawnSync, log = (s) => process.stdout.write(`${s}\n`) } = {}) {
  const failed = [];
  for (const s of list) {
    log(`==> ${s.name}`);
    const r = spawn(s.command, s.args, { cwd: root, stdio: "inherit" });
    if (r.status !== 0) { failed.push(s.name); log(`FAILED: ${s.name} (exit ${r.status ?? "none"}${r.error ? `, ${r.error.message}` : ""})`); }
  }
  log(failed.length ? `validate: ${failed.length} step(s) failed: ${failed.join(", ")}` : "validate: every step passed");
  return { failed, code: failed.length ? 1 : 0 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = run(steps({ check: process.argv.includes("--check") })).code;
}
