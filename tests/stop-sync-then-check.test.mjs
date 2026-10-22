// Tests for .claude/hooks/stop-sync-then-check.mjs, the repository's one Stop command that runs the harness
// sync and then the Copilot staleness check. Unlike the stand-in test in validate-script.test.mjs, most of
// these run the REAL sync-harness-on-stop.mjs and check-copilot-stale.mjs against a throwaway project whose
// sync script and build script are stand-ins.
// Run from the repository root: node --test "tests/**/*.test.mjs"
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let tmp;
const w = (rel, text) => { fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true }); fs.writeFileSync(path.join(tmp, rel), text); };
const sync = (body) => w(".claude/scripts/sync-harness.mjs", body);
const build = (body) => w("tools/build-copilot.mjs", body);
const run = (payload = { hook_event_name: "Stop" }, env = {}) => {
  const e = { ...process.env };
  delete e.AI_DLC_HARNESS_SYNC;
  Object.assign(e, { CLAUDE_PROJECT_DIR: tmp }, env);
  return spawnSync(process.execPath, [path.join(tmp, ".claude", "hooks", "stop-sync-then-check.mjs")], { cwd: tmp, input: JSON.stringify(payload), encoding: "utf8", env: e });
};
const WROTE = 'console.log("update .claude/skills/s/SKILL.md");\n';
const STALE = 'console.error("stale: plugins/copilot differs"); process.exit(1);\n';

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stop-combined-"));
  for (const f of ["stop-sync-then-check.mjs", "sync-harness-on-stop.mjs", "check-copilot-stale.mjs"]) {
    w(`.claude/hooks/${f}`, fs.readFileSync(path.join(REPO, ".claude", "hooks", f), "utf8"));
  }
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

test("nothing pending and the Copilot plugin current: no output, exit 0", () => {
  sync("console.log('harness already in sync');\n");
  build("process.exit(0);\n");
  const r = run();
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
});

test("the sync runs first: the check sees what the sync wrote (order observable through a file)", () => {
  sync('const fs = process.getBuiltinModule("node:fs"); fs.writeFileSync("synced.flag", ""); console.log("create a");\n');
  build('process.exit(process.getBuiltinModule("node:fs").existsSync("synced.flag") ? 0 : 1);\n');
  const r = run();
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.decision, undefined, "the check saw the finished sync, so it does not block");
  assert.match(out.systemMessage, /Harness sync wrote 1 change/);
});

test("a stale Copilot plugin blocks with the check's reason, and the sync's message is kept as the system message", () => {
  sync(WROTE);
  build(STALE);
  const r = run();
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.decision, "block");
  assert.match(out.reason, /The generated Copilot plugin is stale/);
  assert.match(out.reason, /stale: plugins\/copilot differs/);
  assert.match(out.systemMessage, /Harness sync wrote 1 change/);
});

test("stale plugin and nothing synced: the check's block alone, no systemMessage", () => {
  sync("");
  build(STALE);
  const out = JSON.parse(run().stdout);
  assert.equal(out.decision, "block");
  assert.equal(out.systemMessage, undefined);
});

test("a sync failure (exit 2) never blocks by itself: it is reported and the check's verdict decides", () => {
  sync('console.error("boom"); process.exit(2);\n');
  build("process.exit(0);\n");
  let r = run();
  assert.equal(r.status, 0);
  let out = JSON.parse(r.stdout);
  assert.equal(out.decision, undefined);
  assert.match(out.systemMessage, /did not finish \(exit 2\)/);
  build(STALE);
  r = run();
  assert.equal(r.status, 0);
  out = JSON.parse(r.stdout);
  assert.equal(out.decision, "block");
  assert.match(out.systemMessage, /did not finish \(exit 2\)/);
});

test("the stop_hook_active loop guard reaches the check: it lets the stop through even when stale", () => {
  sync(WROTE);
  build(STALE);
  const r = run({ hook_event_name: "Stop", stop_hook_active: true });
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.decision, undefined);
  assert.match(out.systemMessage, /Harness sync wrote/);
});

test("AI_DLC_HARNESS_SYNC=off pauses only the sync; the check still blocks", () => {
  sync(WROTE);
  build(STALE);
  const out = JSON.parse(run(undefined, { AI_DLC_HARNESS_SYNC: "off" }).stdout);
  assert.equal(out.decision, "block");
  assert.equal(out.systemMessage, undefined);
});

test("a missing sync script is fine: the check alone decides", () => {
  build(STALE);
  assert.equal(JSON.parse(run().stdout).decision, "block");
  build("process.exit(0);\n");
  assert.equal(run().stdout, "");
});

test("the check's exit code is returned", () => {
  sync("");
  w(".claude/hooks/check-copilot-stale.mjs", 'process.stdout.write(JSON.stringify({ decision: "block", reason: "r" })); process.exit(3);\n');
  const r = run();
  assert.equal(r.status, 3);
  assert.equal(JSON.parse(r.stdout).decision, "block");
});

test("the check's non-JSON output is passed through unchanged", () => {
  sync("");
  w(".claude/hooks/check-copilot-stale.mjs", 'process.stdout.write("plain text");\n');
  const r = run();
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "plain text");
});

test("stderr of both steps is forwarded", () => {
  w(".claude/hooks/sync-harness-on-stop.mjs", 'console.error("from sync");\n');
  w(".claude/hooks/check-copilot-stale.mjs", 'console.error("from check");\n');
  const r = run();
  assert.match(r.stderr, /from sync/);
  assert.match(r.stderr, /from check/);
});

test("system messages of both steps are joined, sync first", () => {
  w(".claude/hooks/sync-harness-on-stop.mjs", "");
  w(".claude/hooks/check-copilot-stale.mjs", 'process.stdout.write(JSON.stringify({ systemMessage: "c" }));\n');
  assert.deepEqual(JSON.parse(run().stdout), { systemMessage: "c" });
  w(".claude/hooks/sync-harness-on-stop.mjs", 'process.stdout.write(JSON.stringify({ systemMessage: "s" }));\n');
  assert.deepEqual(JSON.parse(run().stdout), { systemMessage: "s\nc" });
});

// A step that does not finish is skipped (fail-open) but never silently: one line naming the step and
// the reason goes to stderr, and on Claude Code (hook_event_name "Stop") into the system message.
test("a check that times out lets the stop through, and says so on stderr and in the system message", () => {
  sync("");
  w(".claude/hooks/check-copilot-stale.mjs", "setTimeout(() => {}, 5000);\n");
  const r = run({ hook_event_name: "Stop" }, { AI_DLC_STOP_STEP_MS: "300" });
  assert.equal(r.status, 0);
  const line = "stop-sync-then-check: the Copilot staleness check (check-copilot-stale.mjs) timed out after 0.3 s; skipped, the stop is not blocked.";
  assert.ok(r.stderr.includes(line), r.stderr);
  const answer = JSON.parse(r.stdout);
  assert.equal(answer.decision, undefined, "never blocks for a check that did not finish");
  assert.equal(answer.systemMessage, line);
});

test("a step that crashes lets the stop through and is named; elsewhere than Claude Code only stderr carries it", () => {
  sync("");
  w(".claude/hooks/sync-harness-on-stop.mjs", 'throw new Error("boom");\n');
  w(".claude/hooks/check-copilot-stale.mjs", "");
  const r = run();
  assert.equal(r.status, 0);
  assert.match(r.stderr, /boom/); // the step's own stderr is forwarded
  assert.match(r.stderr, /^stop-sync-then-check: the harness sync \(sync-harness-on-stop\.mjs\) crashed \(exit 1\); skipped, the stop is not blocked\.$/m);
  assert.match(JSON.parse(r.stdout).systemMessage, /the harness sync \(sync-harness-on-stop\.mjs\) crashed \(exit 1\)/);
  // A crashed check, on Copilot (no "Stop" event name): stderr only, no JSON, exit 0.
  w(".claude/hooks/sync-harness-on-stop.mjs", "");
  w(".claude/hooks/check-copilot-stale.mjs", "process.exit(7);\n");
  const c = run({ hook_event_name: "agentStop" });
  assert.equal(c.status, 0);
  assert.equal(c.stdout, "");
  assert.match(c.stderr, /the Copilot staleness check \(check-copilot-stale\.mjs\) crashed \(exit 7\)/);
});

test("a crashed sync does not hide a stale verdict: the check still blocks, with the crash in the system message", () => {
  w(".claude/hooks/sync-harness-on-stop.mjs", "process.exit(9);\n");
  w(".claude/hooks/check-copilot-stale.mjs", 'process.stdout.write(JSON.stringify({ decision: "block", reason: "stale" }));\n');
  const answer = JSON.parse(run().stdout);
  assert.equal(answer.decision, "block");
  assert.match(answer.systemMessage, /the harness sync \(sync-harness-on-stop\.mjs\) crashed \(exit 9\)/);
});

// Cases below: a killed step, a sync that times out, an invalid AI_DLC_STOP_STEP_MS, both steps failing.
const HANG = "setTimeout(() => {}, 20000);\n";
const BLOCK = 'process.stdout.write(JSON.stringify({ decision: "block", reason: "stale" }));\n';
const SYNC_NOTE = "stop-sync-then-check: the harness sync (sync-harness-on-stop.mjs)";
const CHECK_NOTE = "stop-sync-then-check: the Copilot staleness check (check-copilot-stale.mjs)";

// A signal is only reported by spawnSync on POSIX; on Windows a self-kill surfaces as a plain non-zero exit.
test("a step killed by a signal is named, and never blocks", { skip: process.platform === "win32" && "signals are not reported on Windows" }, () => {
  w(".claude/hooks/sync-harness-on-stop.mjs", 'process.kill(process.pid, "SIGKILL");\n');
  w(".claude/hooks/check-copilot-stale.mjs", "");
  const r = run();
  assert.equal(r.status, 0);
  assert.ok(r.stderr.includes(`${SYNC_NOTE} was stopped by SIGKILL; skipped, the stop is not blocked.`), r.stderr);
  const answer = JSON.parse(r.stdout);
  assert.equal(answer.decision, undefined);
  assert.match(answer.systemMessage, /was stopped by SIGKILL/);
});

test("a killed check (SIGTERM) lets the stop through even though it would have blocked", { skip: process.platform === "win32" && "signals are not reported on Windows" }, () => {
  sync("");
  w(".claude/hooks/check-copilot-stale.mjs", 'process.stdout.write(JSON.stringify({ decision: "block", reason: "x" })); process.kill(process.pid, "SIGTERM");\n');
  const r = run();
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).decision, undefined, "a killed check counts as passing");
  assert.match(r.stderr, /the Copilot staleness check .* was stopped by SIGTERM/);
});

test("a non-zero exit with no JSON answer (what a kill looks like on Windows) is reported as a crash, not a block", () => {
  sync("");
  w(".claude/hooks/check-copilot-stale.mjs", "process.exit(137);\n");
  const r = run();
  assert.equal(r.status, 0);
  assert.match(JSON.parse(r.stdout).systemMessage, /crashed \(exit 137\)/);
});

test("a sync that times out is named, the check still runs and its block still wins", () => {
  w(".claude/hooks/sync-harness-on-stop.mjs", HANG);
  w(".claude/hooks/check-copilot-stale.mjs", BLOCK);
  const r = run({ hook_event_name: "Stop" }, { AI_DLC_STOP_STEP_MS: "1500" });
  assert.equal(r.status, 0);
  assert.ok(r.stderr.includes(`${SYNC_NOTE} timed out after 1.5 s; skipped, the stop is not blocked.`), r.stderr);
  const answer = JSON.parse(r.stdout);
  assert.equal(answer.decision, "block");
  assert.equal(answer.systemMessage, `${SYNC_NOTE} timed out after 1.5 s; skipped, the stop is not blocked.`);
});

test("a sync that times out with a current plugin: the stop passes, the note is the only output", () => {
  w(".claude/hooks/sync-harness-on-stop.mjs", HANG);
  w(".claude/hooks/check-copilot-stale.mjs", "");
  const r = run({ hook_event_name: "Stop" }, { AI_DLC_STOP_STEP_MS: "1500" });
  assert.equal(r.status, 0);
  assert.deepEqual(Object.keys(JSON.parse(r.stdout)), ["systemMessage"]);
  assert.match(r.stderr, /the harness sync .* timed out after 1\.5 s/);
});

for (const bad of ["abc", "0", "-5", "NaN", ""]) {
  test(`AI_DLC_STOP_STEP_MS=${JSON.stringify(bad)} is ignored: the default timeout applies and slow steps are not cut off`, () => {
    // A step slower than any tiny timeout a bad value could turn into (0, -5 ms) must still finish normally.
    w(".claude/hooks/sync-harness-on-stop.mjs", 'setTimeout(() => process.stdout.write(JSON.stringify({ systemMessage: "s" })), 600);\n');
    w(".claude/hooks/check-copilot-stale.mjs", "");
    const r = run({ hook_event_name: "Stop" }, { AI_DLC_STOP_STEP_MS: bad });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stderr, /timed out|could not run/);
    assert.deepEqual(JSON.parse(r.stdout), { systemMessage: "s" });
  });
}

// Fixed defect (.claude/hooks/stop-sync-then-check.mjs): `override > 0` used to accept Infinity and
// non-integers, and spawnSync then threw ERR_OUT_OF_RANGE (timeout must be an unsigned integer), so the hook
// itself crashed with exit 1. Only a safe whole number above 0 is taken now; anything else falls back to STEP_MS.
for (const bad of ["Infinity", "0.5", "1.5"]) test(`AI_DLC_STOP_STEP_MS=${bad} does not make the hook itself crash`, () => {
  w(".claude/hooks/sync-harness-on-stop.mjs", "");
  w(".claude/hooks/check-copilot-stale.mjs", BLOCK);
  const r = run({ hook_event_name: "Stop" }, { AI_DLC_STOP_STEP_MS: bad });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).decision, "block");
});

test("both steps failing (sync crashes, check times out): two notes, in order, one system message, no block, exit 0", () => {
  w(".claude/hooks/sync-harness-on-stop.mjs", "process.exit(9);\n");
  w(".claude/hooks/check-copilot-stale.mjs", HANG);
  const r = run({ hook_event_name: "Stop" }, { AI_DLC_STOP_STEP_MS: "1500" });
  assert.equal(r.status, 0);
  const syncLine = `${SYNC_NOTE} crashed (exit 9); skipped, the stop is not blocked.`;
  const checkLine = `${CHECK_NOTE} timed out after 1.5 s; skipped, the stop is not blocked.`;
  assert.ok(r.stderr.indexOf(syncLine) >= 0 && r.stderr.indexOf(checkLine) > r.stderr.indexOf(syncLine), r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), { systemMessage: `${syncLine}\n${checkLine}` });
});

test("both steps crashing, not on Claude Code: stderr names both, stdout is empty, exit 0", () => {
  w(".claude/hooks/sync-harness-on-stop.mjs", "process.exit(2);\n");
  w(".claude/hooks/check-copilot-stale.mjs", "process.exit(3);\n");
  const r = run({ hook_event_name: "agentStop" });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /the harness sync .* crashed \(exit 2\)/);
  assert.match(r.stderr, /the Copilot staleness check .* crashed \(exit 3\)/);
});

test("both steps failing with no stdin payload at all: still fail-open and silent on stdout", () => {
  w(".claude/hooks/sync-harness-on-stop.mjs", "process.exit(2);\n");
  w(".claude/hooks/check-copilot-stale.mjs", "process.exit(3);\n");
  const r = run("");
  assert.equal(r.status, 0);
  assert.match(r.stderr, /crashed \(exit 2\)/);
  assert.match(r.stderr, /crashed \(exit 3\)/);
});
