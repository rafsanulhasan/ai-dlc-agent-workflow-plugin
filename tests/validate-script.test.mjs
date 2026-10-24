// Tests for tools/validate.mjs, the local pre-validate run: the steps it runs, in order, and that it
// runs every step and exits 1 when any fails. The real commands are never run: spawn is a fake.
// Run from the repository root: node --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { claudeOnlyPlugins, run, steps } from "../tools/validate.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the steps: the harness sync first, then the plugin, then the Claude-only plugins, then the marketplace", () => {
  const list = steps();
  assert.deepEqual(list.map((s) => s.name), ["harness sync", "validate the Claude plugin", "validate the ai-dlc-lens plugin", "validate the marketplace"]);
  assert.deepEqual(list[0].args, [path.join(REPO, ".claude", "scripts", "sync-harness.mjs")]);
  assert.deepEqual(list[1].args.slice(-3), ["validate", "--strict", "./plugins/claude/ai-dlc"]);
  assert.deepEqual(list[2].args.slice(-3), ["validate", "--strict", "./plugins/claude/ai-dlc-lens"]);
  assert.deepEqual(list[3].args.slice(-3), ["validate", "--strict", "."]);
});

test("a Claude-only plugin is validated only when it is listed and its folder exists", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "validate-"));
  try {
    fs.mkdirSync(path.join(tmp, "tools"));
    fs.writeFileSync(path.join(tmp, "tools", "claude-only-plugins.json"), JSON.stringify(["lensy", "gone"]));
    fs.mkdirSync(path.join(tmp, "plugins", "claude", "lensy"), { recursive: true });
    assert.deepEqual(claudeOnlyPlugins(tmp), ["lensy"]);
    assert.deepEqual(steps({ root: tmp }).map((s) => s.name), ["validate the Claude plugin", "validate the lensy plugin", "validate the marketplace"]);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test("--check only checks the harness sync, as CI does", () => {
  const list = steps({ check: true });
  assert.equal(list[0].name, "harness sync (check)");
  assert.equal(list[0].args.at(-1), "--check");
});

test("without the sync script, only the two validations run", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "validate-"));
  try {
    assert.deepEqual(steps({ root: tmp }).map((s) => s.name), ["validate the Claude plugin", "validate the marketplace"]);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test("every step runs even after a failure, and any failure exits 1", () => {
  const calls = [];
  const logs = [];
  const spawn = (command, args) => { calls.push(args.at(-1)); return { status: args.at(-1) === "./plugins/claude/ai-dlc" ? 1 : 0 }; };
  const r = run(steps(), { spawn, log: (s) => logs.push(s) });
  assert.equal(calls.length, 4);
  assert.deepEqual(r, { failed: ["validate the Claude plugin"], code: 1 });
  assert.ok(logs.includes("validate: 1 step(s) failed: validate the Claude plugin"));
  const ok = run(steps(), { spawn: () => ({ status: 0 }), log: () => {} });
  assert.deepEqual(ok, { failed: [], code: 0 });
  const missing = run(steps(), { spawn: () => ({ status: null, error: new Error("ENOENT") }), log: () => {} });
  assert.equal(missing.code, 1);
  assert.equal(missing.failed.length, 4);
});

test("CI runs the harness sync check before the two plugin validations", () => {
  const ci = fs.readFileSync(path.join(REPO, ".github", "workflows", "validate.yml"), "utf8");
  const at = (s) => ci.indexOf(s);
  assert.ok(at("node .claude/scripts/sync-harness.mjs --check") > 0);
  assert.ok(at("node .claude/scripts/sync-harness.mjs --check") < at("plugin validate --strict ./plugins/claude/ai-dlc"));
  assert.ok(at("node .claude/scripts/sync-harness.mjs --check") < at("plugin validate --strict ."));
});

// Claude Code runs the hooks of one event in parallel, so the sync and the staleness check, which reads
// project mirrors the sync can write, are one Stop command that runs them in turn.
test("one Stop command runs the sync, then the staleness check; the workflow gate stays separate", () => {
  const settings = JSON.parse(fs.readFileSync(path.join(REPO, ".claude", "settings.json"), "utf8"));
  const commands = settings.hooks.Stop.flatMap((g) => g.hooks.map((h) => h.command));
  assert.ok(commands.includes("node .claude/hooks/stop-sync-then-check.mjs"));
  assert.ok(commands.includes("node .claude/hooks/check-workflow.mjs"));
  assert.ok(!commands.includes("node .claude/hooks/sync-harness-on-stop.mjs"), "not a separate, unordered hook");
  assert.ok(!commands.includes("node .claude/hooks/check-copilot-stale.mjs"), "not a separate, unordered hook");
  const combined = fs.readFileSync(path.join(REPO, ".claude", "hooks", "stop-sync-then-check.mjs"), "utf8");
  assert.ok(combined.indexOf('step("sync-harness-on-stop.mjs")') < combined.indexOf('step("check-copilot-stale.mjs")'));
  // Time budget: both steps fit inside the hook's timeout, on Claude Code and in the Copilot twin.
  const stepMs = Number(/const STEP_MS = ([\d_]+)/.exec(combined)[1].replace(/_/g, ""));
  const claudeTimeout = settings.hooks.Stop.flatMap((g) => g.hooks).find((h) => h.command === "node .claude/hooks/stop-sync-then-check.mjs").timeout;
  assert.ok(2 * stepMs < claudeTimeout * 1000, `2 × ${stepMs} ms must fit in ${claudeTimeout} s`);
  const copilot = JSON.parse(fs.readFileSync(path.join(REPO, ".github", "hooks", "synced-from-claude.json"), "utf8"));
  assert.equal(copilot.hooks.agentStop.find((h) => h.bash === "node .claude/hooks/stop-sync-then-check.mjs").timeoutSec, claudeTimeout);
  const sync = fs.readFileSync(path.join(REPO, ".claude", "hooks", "sync-harness-on-stop.mjs"), "utf8");
  assert.doesNotMatch(sync, /decision:\s*"block"/);
  assert.doesNotMatch(sync, /process\.exit\((?!0\))/);
});

test("the combined Stop command: silent when all is current, the check's block (and exit code) when the Copilot plugin is stale", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stop-hook-"));
  try {
    const hooks = path.join(tmp, ".claude", "hooks");
    fs.mkdirSync(hooks, { recursive: true });
    fs.copyFileSync(path.join(REPO, ".claude", "hooks", "stop-sync-then-check.mjs"), path.join(hooks, "stop-sync-then-check.mjs"));
    // Stand-ins for the two steps: the sync reports a write, the check blocks only when STALE exists.
    fs.writeFileSync(path.join(hooks, "sync-harness-on-stop.mjs"), 'process.stdout.write(JSON.stringify({ systemMessage: "synced 1" }));\n');
    fs.writeFileSync(path.join(hooks, "check-copilot-stale.mjs"), 'import fs from "node:fs"; import path from "node:path";\nif (fs.existsSync(path.join(process.cwd(), "STALE"))) process.stdout.write(JSON.stringify({ decision: "block", reason: "stale" }));\n');
    const runHook = () => spawnSync(process.execPath, [path.join(hooks, "stop-sync-then-check.mjs")], { cwd: tmp, input: '{"hook_event_name":"Stop"}', encoding: "utf8" });
    let r = runHook();
    assert.equal(r.status, 0);
    assert.deepEqual(JSON.parse(r.stdout), { systemMessage: "synced 1" });
    fs.writeFileSync(path.join(tmp, "STALE"), "");
    r = runHook();
    assert.equal(r.status, 0);
    assert.deepEqual(JSON.parse(r.stdout), { decision: "block", reason: "stale", systemMessage: "synced 1" });
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
