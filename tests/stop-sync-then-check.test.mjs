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
