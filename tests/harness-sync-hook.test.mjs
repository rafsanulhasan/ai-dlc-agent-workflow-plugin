// Tests for this repository's own sync hook script, .claude/hooks/sync-harness-on-stop.mjs, which
// .claude/hooks/stop-sync-then-check.mjs runs before the Copilot staleness check. It is repo-local: consumer
// repositories get no sync hook and sync with /ai-dlc:harness-sync. Each test runs the real hook against a
// throwaway project whose .claude/scripts/sync-harness.mjs is a stand-in that prints what the test needs.
// Run from the repository root: node --test "tests/**/*.test.mjs"
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOOK = path.join(REPO, ".claude", "hooks", "sync-harness-on-stop.mjs");

let tmp;
const stub = (body) => {
  fs.mkdirSync(path.join(tmp, ".claude", "scripts"), { recursive: true });
  fs.writeFileSync(path.join(tmp, ".claude", "scripts", "sync-harness.mjs"), body);
};
// env: extra variables; AI_DLC_HARNESS_SYNC is removed from the inherited environment unless given.
const runHook = (payload, env = {}, { viaPayloadCwd = false } = {}) => {
  const e = { ...process.env };
  delete e.AI_DLC_HARNESS_SYNC;
  delete e.CLAUDE_PROJECT_DIR;
  Object.assign(e, env);
  if (!viaPayloadCwd) e.CLAUDE_PROJECT_DIR = tmp;
  return spawnSync(process.execPath, [HOOK], { input: JSON.stringify(payload), encoding: "utf8", env: e, cwd: viaPayloadCwd ? os.tmpdir() : tmp });
};
const WROTE = 'console.log("create .github/agents/x.agent.md"); console.log("update .claude/skills/y/SKILL.md"); console.log("add hook Stop"); console.log("note: something");\n';
const touch = (marker) => `process.getBuiltinModule("node:fs").writeFileSync(${JSON.stringify(marker)}, "");\n`;

beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sync-hook-")); });
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

test("silent, exit 0, when nothing was pending (notes and the in-sync summary stay quiet)", () => {
  stub('console.log("note: skipped a thing"); console.log("harness already in sync");\n');
  const r = runHook({ hook_event_name: "Stop" });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
  assert.equal(r.stderr, "");
});

test("on Claude Code (Stop) a write is a systemMessage listing only the action lines, never a decision", () => {
  stub(WROTE);
  const r = runHook({ hook_event_name: "Stop" });
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(out), ["systemMessage"]);
  assert.match(out.systemMessage, /^Harness sync wrote 3 change\(s\):/);
  assert.match(out.systemMessage, /create \.github\/agents\/x\.agent\.md/);
  assert.match(out.systemMessage, /update \.claude\/skills\/y\/SKILL\.md/);
  assert.match(out.systemMessage, /add hook Stop/);
  assert.doesNotMatch(out.systemMessage, /note: something/);
  assert.equal(r.stderr, "");
});

test("on other platforms (agentStop, or no event) a write goes to stderr as plain text and stdout stays empty", () => {
  stub(WROTE);
  for (const payload of [{ hook_event_name: "agentStop" }, {}]) {
    const r = runHook(payload);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "");
    assert.match(r.stderr, /^Harness sync wrote 3 change\(s\):/);
  }
});

test("sync exit 2 does not block: exit 0, no decision, the failure is reported with the sync's output", () => {
  stub('console.error("boom: conflicting twins"); process.exit(2);\n');
  const r = runHook({ hook_event_name: "Stop" });
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.decision, undefined);
  assert.match(out.systemMessage, /Harness sync did not finish \(exit 2\); nothing blocks the stop/);
  assert.match(out.systemMessage, /boom: conflicting twins/);
  const other = runHook({ hook_event_name: "agentStop" });
  assert.equal(other.status, 0);
  assert.equal(other.stdout, "");
  assert.match(other.stderr, /did not finish \(exit 2\)/);
});

test("any non-zero sync exit is a reported failure that still exits 0", () => {
  stub("process.exit(1);\n");
  const r = runHook({ hook_event_name: "Stop" });
  assert.equal(r.status, 0);
  assert.match(JSON.parse(r.stdout).systemMessage, /did not finish \(exit 1\)/);
});

test("a sync that writes and then fails is reported as a failure, not as a success", () => {
  stub(WROTE + "process.exit(2);\n");
  const r = runHook({ hook_event_name: "Stop" });
  assert.equal(r.status, 0);
  const msg = JSON.parse(r.stdout).systemMessage;
  assert.match(msg, /did not finish \(exit 2\)/);
  assert.doesNotMatch(msg, /^Harness sync wrote/);
});

test("silent when .claude/scripts/sync-harness.mjs is missing", () => {
  const r = runHook({ hook_event_name: "Stop" });
  assert.equal(r.status, 0);
  assert.equal(r.stdout + r.stderr, "");
});

for (const value of ["false", "0", "no", "off", "FALSE", "Off"]) {
  test(`AI_DLC_HARNESS_SYNC=${value} pauses it: the sync does not even run`, () => {
    const marker = path.join(tmp, "ran");
    stub(touch(marker) + 'console.log("create a");\n');
    const r = runHook({ hook_event_name: "Stop" }, { AI_DLC_HARNESS_SYNC: value });
    assert.equal(r.status, 0);
    assert.equal(r.stdout + r.stderr, "");
    assert.equal(fs.existsSync(marker), false);
  });
}

test("other values of AI_DLC_HARNESS_SYNC (true, 1, empty, junk) leave the sync on", () => {
  const marker = path.join(tmp, "ran");
  stub(touch(marker));
  for (const v of ["true", "1", "", "maybe"]) {
    fs.rmSync(marker, { force: true });
    assert.equal(runHook({ hook_event_name: "Stop" }, { AI_DLC_HARNESS_SYNC: v }).status, 0);
    assert.equal(fs.existsSync(marker), true, `value "${v}"`);
  }
});

test("the root is CLAUDE_PROJECT_DIR, else the payload's cwd; the sync runs with that root as its cwd", () => {
  stub('console.log("create " + process.cwd());\n');
  const real = fs.realpathSync(tmp);
  const viaEnv = JSON.parse(runHook({ hook_event_name: "Stop" }).stdout).systemMessage;
  assert.ok(viaEnv.includes(real) || viaEnv.includes(tmp), viaEnv);
  const viaPayload = JSON.parse(runHook({ hook_event_name: "Stop", cwd: tmp }, {}, { viaPayloadCwd: true }).stdout).systemMessage;
  assert.ok(viaPayload.includes(real) || viaPayload.includes(tmp), viaPayload);
});

test("empty or garbage stdin is treated as no payload (no crash); the output then goes to stderr", () => {
  stub(WROTE);
  const e = { ...process.env, CLAUDE_PROJECT_DIR: tmp };
  delete e.AI_DLC_HARNESS_SYNC;
  for (const input of ["", "not json", "{"]) {
    const r = spawnSync(process.execPath, [HOOK], { input, encoding: "utf8", env: e });
    assert.equal(r.status, 0, input);
    assert.equal(r.stdout, "");
    assert.match(r.stderr, /Harness sync wrote 3/);
  }
});

test("the harness-sync skill ships no sync hook for consumer repositories", () => {
  const templates = path.join(REPO, "plugins", "claude", "ai-dlc", "skills", "harness-sync", "templates");
  assert.deepEqual(fs.readdirSync(templates), ["sync-harness.mjs"]);
});
