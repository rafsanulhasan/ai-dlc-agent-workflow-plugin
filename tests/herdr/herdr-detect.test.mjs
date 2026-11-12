// herdr.mjs detect (AC-4 as changed by the human in 1.1.6.l1: fallback detection; AC-9 never block; AC-2 only documented herdr commands).
// herdr is a fake executable on a temp PATH (helpers/fake-bin.mjs); detect runs as a real process. Temp folders only.
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { sandbox, herdrCalls, pane, listJson } from "./helpers/fake-bin.mjs";
import { normPath } from "../../plugins/claude/ai-dlc/skills/herdr/scripts/herdr.mjs";

const boxes = [];
const box = (label = "detect") => { const sb = sandbox(label); boxes.push(sb); return sb; };
afterEach(() => { while (boxes.length) boxes.pop().cleanup(); });

const MUTATING = /^(pane (split|run|rename|close|current)|terminal)/;
const noMutation = (sb) => assert.deepEqual(sb.herdr().filter((c) => MUTATING.test(c)), [], "detect must be read only");

describe("detect: herdr absent or switched off [AC-4, AC-9]", () => {
  for (const env of [{}, { HERDR_ENV: "1" }]) {
    test(`[AC-4] herdr not on PATH is inactive, silent and exit 0 (${JSON.stringify(env)})`, () => {
      const sb = box().install({});
      const r = sb.cli(["detect"], { env });
      assert.equal(r.status, 0);
      assert.equal(r.stderr, "");
      assert.equal(r.lines.length, 1);
      assert.deepEqual(r.json, { ok: true, active: false, mode: "watch", reason: "herdr is not on PATH" });
      assert.deepEqual(sb.entries(), []);
    });
  }

  test("[AC-4] mode off wins over HERDR_ENV=1 and a running server, and no herdr call is made", () => {
    const sb = box().install({ herdr: herdrCalls() });
    const r = sb.cli(["detect"], { env: { HERDR_ENV: "1", HERDR_PANE_ID: "w1:p1", AI_DLC_HERDR_MODE: "off" } });
    assert.equal(r.status, 0);
    assert.deepEqual(r.json, { ok: true, active: false, mode: "off", reason: "mode is off" });
    assert.deepEqual(sb.entries(), []);
  });

  test("[AC-4] mode off from .ai-dlc/herdr.json also wins", () => {
    const sb = box().install({ herdr: herdrCalls() });
    sb.write(".ai-dlc/herdr.json", JSON.stringify({ mode: "off" }));
    const r = sb.cli(["detect"], { env: { HERDR_ENV: "1" } });
    assert.equal(r.json.active, false);
    assert.equal(r.json.mode, "off");
  });

  test("[AC-4] herdr --version failing is inactive with the reason", () => {
    const sb = box().install({ herdr: herdrCalls({ extra: [{ match: ["--version"], status: 1, stderr: "boom" }] }) });
    const r = sb.cli(["detect"], { env: { HERDR_ENV: "1" } });
    assert.equal(r.status, 0);
    assert.equal(r.json.active, false);
    assert.match(r.json.reason, /^herdr --version failed: herdr exited 1/);
  });

  test("[AC-4] a server that is not running is inactive, although the live exit code is 0", () => {
    const sb = box().install({ herdr: herdrCalls({ extra: [{ match: ["status", "server"], stdout: "status: not running\n", status: 0 }] }) });
    const r = sb.cli(["detect"], { env: { HERDR_ENV: "1", HERDR_PANE_ID: "w1:p1" } });
    assert.deepEqual(r.json, { ok: true, active: false, mode: "watch", reason: "herdr server is not running" });
    noMutation(sb);
  });

  for (const [name, stdout] of [["garbage", "lorem ipsum"], ["empty", ""], ["running only as a substring", "status: runningish\n"]]) {
    test(`[AC-4] status server output "${name}" is not a running server`, () => {
      const sb = box().install({ herdr: herdrCalls({ extra: [{ match: ["status", "server"], stdout }] }) });
      const r = sb.cli(["detect"], { env: { HERDR_ENV: "1" } });
      assert.equal(r.json.active, false);
      assert.equal(r.json.reason, "herdr server is not running");
    });
  }
});

describe("detect: HERDR_ENV=1 [AC-4]", () => {
  test("[AC-4] active with source env and the anchor from HERDR_PANE_ID; pane list is not asked", () => {
    const sb = box().install({ herdr: herdrCalls() });
    const r = sb.cli(["detect"], { env: { HERDR_ENV: "1", HERDR_PANE_ID: "w1:p7" } });
    assert.equal(r.status, 0);
    assert.equal(r.stderr, "");
    assert.deepEqual(r.json, { ok: true, active: true, source: "env", anchor: "w1:p7", mode: "watch", modeSource: "default", runTimeoutMinutes: 60, version: "0.9.5" });
    assert.equal(sb.herdr().some((c) => c.startsWith("pane list")), false);
    noMutation(sb);
  });

  test("[AC-4] without HERDR_PANE_ID a unique pane match becomes the anchor", () => {
    const sb = box();
    sb.install({ herdr: herdrCalls({ panes: [pane({ cwd: sb.root })] }) });
    const r = sb.cli(["detect"], { env: { HERDR_ENV: "1" } });
    assert.equal(r.json.active, true);
    assert.equal(r.json.source, "env");
    assert.equal(r.json.anchor, "w1:p1");
  });

  test("[AC-4] without HERDR_PANE_ID and no unique match the anchor is null (open then splits --current), never a guess", () => {
    const sb = box();
    sb.install({ herdr: herdrCalls({ panes: [pane({ cwd: sb.root, agent_status: "idle" })] }) });
    const r = sb.cli(["detect", "--explain"], { env: { HERDR_ENV: "1" } });
    assert.equal(r.json.active, true);
    assert.equal(r.json.anchor, null);
    assert.deepEqual(r.json.candidates, []);
  });

  for (const v of ["0", "true", "", "yes"]) {
    test(`[AC-4] HERDR_ENV=${JSON.stringify(v)} is treated as missing: the pane match decides`, () => {
      const sb = box();
      sb.install({ herdr: herdrCalls({ panes: [pane({ cwd: sb.root })] }) });
      const r = sb.cli(["detect"], { env: { HERDR_ENV: v } });
      assert.equal(r.json.source, "pane-match");
      assert.ok(sb.herdr().some((c) => c.startsWith("pane list")));
    });
  }
});

describe("detect: the pane match [AC-4]", () => {
  test("[AC-4] exactly one claude/working pane in this folder: active, pane-match, anchor, version, mode", () => {
    const sb = box();
    sb.install({ herdr: herdrCalls({ panes: [pane({ cwd: sb.root }), pane({ pane_id: "w1:p9", agent: "codex", cwd: sb.root })] }) });
    const r = sb.cli(["detect", "--explain"]);
    assert.equal(r.status, 0);
    assert.equal(r.stderr, "");
    assert.deepEqual(r.json, { ok: true, active: true, source: "pane-match", anchor: "w1:p1", mode: "watch", modeSource: "default", runTimeoutMinutes: 60, version: "0.9.5", candidates: ["w1:p1"] });
    noMutation(sb);
  });

  const noMatch = {
    "no panes at all": () => [],
    "agent other than claude": (root) => [pane({ cwd: root, agent: "codex" })],
    "agent missing": (root) => [pane({ cwd: root, agent: undefined })],
    "agent_status idle": (root) => [pane({ cwd: root, agent_status: "idle" })],
    "agent_status blocked": (root) => [pane({ cwd: root, agent_status: "blocked" })],
    "agent_status missing": (root) => [pane({ cwd: root, agent_status: undefined })],
    "cwd of another folder": (root) => [pane({ cwd: `${root}-other` })],
    "cwd a parent folder": (root) => [pane({ cwd: path.dirname(root) })],
    "cwd missing": () => [pane({ cwd: undefined })],
    "pane_id missing": (root) => [pane({ cwd: root, pane_id: undefined })],
  };
  for (const [name, panes] of Object.entries(noMatch)) {
    test(`[AC-4] no match (${name}) is inactive: "no pane matches this session"`, () => {
      const sb = box();
      sb.install({ herdr: herdrCalls({ panes: panes(sb.root) }) });
      const r = sb.cli(["detect"]);
      assert.equal(r.status, 0);
      assert.deepEqual(r.json, { ok: true, active: false, mode: "watch", reason: "no pane matches this session" });
      noMutation(sb);
    });
  }

  test("[AC-4] two matching panes are ambiguous: inactive, the count in the reason, no anchor, nothing created (never a guess)", () => {
    const sb = box();
    sb.install({ herdr: herdrCalls({ panes: [pane({ cwd: sb.root }), pane({ pane_id: "w2:p1", cwd: sb.root })] }) });
    const r = sb.cli(["detect", "--explain"]);
    assert.equal(r.json.active, false);
    assert.equal(r.json.reason, "ambiguous: 2 panes match this session");
    assert.equal("anchor" in r.json, false);
    assert.deepEqual(r.json.candidates, ["w1:p1", "w2:p1"]);
    noMutation(sb);
    assert.equal(fs.existsSync(path.join(sb.root, ".scratch")), false);
  });

  test("[AC-4] a pane this script opened (a *.pane.json of any run) is never this session's pane", () => {
    const sb = box();
    sb.install({ herdr: herdrCalls({ panes: [pane({ cwd: sb.root }), pane({ pane_id: "w1:p2", cwd: sb.root })] }) });
    sb.write(".scratch/herdr/OTHER-RUN/1.2-agent-manager.pane.json", JSON.stringify({ pane: "w1:p2", mode: "run-in-pane" }));
    const r = sb.cli(["detect"]);
    assert.equal(r.json.active, true);
    assert.equal(r.json.anchor, "w1:p1");
  });

  test("[AC-4] the cwd is compared after normPath: backslashes, a trailing slash and (win32 only) case do not matter", { skip: process.platform !== "win32" && "win32 path rules" }, () => {
    const sb = box();
    const alt = sb.root.toUpperCase().replace(/\\/g, "/") + "/";
    sb.install({ herdr: herdrCalls({ panes: [pane({ cwd: alt })] }) });
    assert.equal(sb.cli(["detect"]).json.anchor, "w1:p1");
  });

  test("[AC-4] off win32 a cwd that differs only by case is another folder", { skip: process.platform === "win32" && "case-insensitive file system rules" }, () => {
    const sb = box();
    sb.install({ herdr: herdrCalls({ panes: [pane({ cwd: sb.root.toUpperCase() })] }) });
    assert.equal(sb.cli(["detect"]).json.active, false);
  });

  test("normPath: backslash to slash, no trailing slash, lower case on win32 only", () => {
    assert.equal(normPath("C:\\Repo\\Sub\\", "win32"), "c:/repo/sub");
    assert.equal(normPath("C:\\Repo\\Sub\\", "linux"), "C:/Repo/Sub");
    assert.equal(normPath("/Home/X///", "linux"), "/Home/X");
    assert.equal(normPath("/Home/X", "darwin"), "/Home/X");
    assert.equal(normPath("E:/A", "win32"), normPath("e:\\a\\", "win32"));
  });

  test("[AC-4] a cached anchor (--run) is reused while its pane still lists as claude, even when it is idle", () => {
    const sb = box();
    sb.install({ herdr: herdrCalls({ panes: [pane({ pane_id: "w1:p9", cwd: sb.root, agent_status: "idle" })] }) });
    sb.write(".scratch/herdr/RUN-1/anchor.json", JSON.stringify({ pane: "w1:p9", source: "pane-match" }));
    const r = sb.cli(["detect", "--run", "docs/handoffs/RUN-1"]);
    assert.equal(r.json.active, true);
    assert.equal(r.json.source, "cached");
    assert.equal(r.json.anchor, "w1:p9");
  });

  test("[AC-4] a cached anchor whose pane is gone, or no longer claude, is dropped and the match runs again", () => {
    const sb = box();
    sb.install({ herdr: herdrCalls({ panes: [pane({ cwd: sb.root }), pane({ pane_id: "w1:p9", agent: "codex", cwd: sb.root })] }) });
    sb.write(".scratch/herdr/RUN-1/anchor.json", JSON.stringify({ pane: "w1:p9" }));
    assert.equal(sb.cli(["detect", "--run", "docs/handoffs/RUN-1"]).json.source, "pane-match");
    sb.write(".scratch/herdr/RUN-1/anchor.json", JSON.stringify({ pane: "w9:p9" }));
    const r = sb.cli(["detect", "--run", "docs/handoffs/RUN-1"]);
    assert.equal(r.json.source, "pane-match");
    assert.equal(r.json.anchor, "w1:p1");
  });

  test("[AC-4] a cached anchor of another run is not used", () => {
    const sb = box();
    sb.install({ herdr: herdrCalls({ panes: [pane({ cwd: sb.root, agent_status: "idle" })] }) });
    sb.write(".scratch/herdr/RUN-1/anchor.json", JSON.stringify({ pane: "w1:p1" }));
    const r = sb.cli(["detect", "--run", "docs/handoffs/RUN-2"]);
    assert.equal(r.json.active, false);
  });
});

describe("detect: a herdr that misbehaves never blocks or throws [AC-9]", () => {
  const bad = {
    "pane list exits 1 with no output": { match: ["pane", "list"], status: 1 },
    "pane list prints non-JSON": { match: ["pane", "list"], stdout: "not json at all" },
    "pane list prints JSON without result.panes": { match: ["pane", "list"], stdout: JSON.stringify({ id: "x", result: {} }) },
    "pane list prints JSON whose panes is not an array": { match: ["pane", "list"], stdout: JSON.stringify({ result: { panes: "nope" } }) },
    "pane list prints a herdr error object": { match: ["pane", "list"], stdout: JSON.stringify({ error: { code: "boom" } }), status: 1 },
    "pane list prints nothing, exit 0": { match: ["pane", "list"], stdout: "" },
  };
  for (const [name, call] of Object.entries(bad)) {
    test(`[AC-9] ${name}: inactive, "pane list unavailable", exit 0, stderr empty`, () => {
      const sb = box().install({ herdr: herdrCalls({ extra: [call] }) });
      const r = sb.cli(["detect"]);
      assert.equal(r.status, 0);
      assert.equal(r.stderr, "");
      assert.deepEqual(r.json, { ok: true, active: false, mode: "watch", reason: "pane list unavailable" });
    });
  }

  test("[AC-9] panes list entries that are not objects are ignored", () => {
    const sb = box();
    sb.install({ herdr: herdrCalls({ panes: [null, 7, "x", pane({ cwd: sb.root })] }) });
    assert.equal(sb.cli(["detect"]).json.anchor, "w1:p1");
  });

  test("[AC-9] a pane list that hangs past AI_DLC_HERDR_CALL_TIMEOUT_MS returns promptly as inactive", () => {
    const sb = box().install({ herdr: herdrCalls({ extra: [{ match: ["pane", "list"], delayMs: 2500, stdout: listJson([]) }] }) });
    const r = sb.cli(["detect"], { env: { AI_DLC_HERDR_CALL_TIMEOUT_MS: "300" } });
    assert.equal(r.status, 0);
    assert.equal(r.json.active, false);
    assert.equal(r.json.reason, "pane list unavailable");
    assert.ok(r.ms < 15000, `took ${r.ms} ms`);
  });

  test("[AC-9] a herdr --version that hangs past the timeout is inactive with a timeout reason", () => {
    const sb = box().install({ herdr: herdrCalls({ extra: [{ match: ["--version"], delayMs: 2500, stdout: "herdr 0.9.5" }] }) });
    const r = sb.cli(["detect"], { env: { AI_DLC_HERDR_CALL_TIMEOUT_MS: "300" } });
    assert.equal(r.json.active, false);
    assert.match(r.json.reason, /herdr --version failed: herdr timed out/);
  });

  test("[AC-9] broken settings files never make detect fail", () => {
    const sb = box().install({ herdr: herdrCalls() });
    sb.write(".claude/settings.local.json", "{ not json");
    sb.write(".claude/settings.json", "[1]");
    sb.write(".ai-dlc/herdr.json", "oops");
    const r = sb.cli(["detect"], { env: { HERDR_ENV: "1", HERDR_PANE_ID: "w1:p1" } });
    assert.equal(r.status, 0);
    assert.equal(r.json.active, true);
    assert.equal(r.json.mode, "watch");
  });
});

describe("detect: settings reach the answer [AC-5]", () => {
  test("[AC-5] mode run-in-pane and the timeout from the environment are reflected with their source", () => {
    const sb = box().install({ herdr: herdrCalls() });
    const r = sb.cli(["detect"], { env: { HERDR_ENV: "1", HERDR_PANE_ID: "w1:p1", AI_DLC_HERDR_MODE: "run-in-pane", AI_DLC_HERDR_RUN_TIMEOUT_MINUTES: "15" } });
    assert.equal(r.json.mode, "run-in-pane");
    assert.equal(r.json.modeSource, "AI_DLC_HERDR_MODE in the environment");
    assert.equal(r.json.runTimeoutMinutes, 15);
  });

  test("[AC-5] an invalid mode falls back to the next source (the default watch) and detect still answers", () => {
    const sb = box().install({ herdr: herdrCalls() });
    const r = sb.cli(["detect"], { env: { HERDR_ENV: "1", HERDR_PANE_ID: "w1:p1", AI_DLC_HERDR_MODE: "bogus" } });
    assert.equal(r.json.active, true);
    assert.equal(r.json.mode, "watch");
  });

  test("[AC-4] detect --run with a malformed run folder is a usage error (exit 2), not a crash", () => {
    const sb = box().install({ herdr: herdrCalls() });
    const r = sb.cli(["detect", "--run", "docs/bad run"]);
    assert.equal(r.status, 2);
    assert.match(r.json.reason, /^usage: /);
  });
});
