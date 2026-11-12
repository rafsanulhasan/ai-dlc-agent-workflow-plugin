// herdr.mjs run + child (AC-10 run-in-pane, AC-11 the hand-back flow and a failed result is never success, AC-12 fall back to the
// Agent tool, AC-9 never block; LLD 1.1.6 U5-U8). herdr and claude are fake executables on a temp PATH; the fake herdr's `pane run`
// really executes the command string it is given, so `child` runs as the real script and the whole path is exercised.
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { sandbox, herdrCalls, pane, claudeOk, initEvent, assistantEvent, resultEvent, until } from "./helpers/fake-bin.mjs";
import { HANDOFF_LINE, usableResult, childPrompt, childArgs, renderEvent, safeArg, paneCommand, atomicWrite, resolveExe, parseStatusServer } from "../../plugins/claude/ai-dlc/skills/herdr/scripts/herdr.mjs";

const boxes = [];
const box = (label = "run") => { const sb = sandbox(label); boxes.push(sb); return sb; };
afterEach(() => { while (boxes.length) boxes.pop().cleanup(); });

const RUN = "docs/handoffs/RUN-1";
const RECORD = `${RUN}/1.2-orchestrator-to-agent-manager.handoff.md`;
const OUT = ".scratch/herdr/RUN-1/1.2-agent-manager.result.md";
const EXIT = `${OUT}.exit`;
const ENV = { HERDR_ENV: "1", HERDR_PANE_ID: "w1:p1", AI_DLC_HERDR_MODE: "run-in-pane", AI_DLC_HERDR_POLL_MS: "100" };
const HANDBACK = "handoff 1.2-orchestrator-to-agent-manager.handoff.md: passed \u2014 built it\n\n## Body\nline two \u00e9\u00e8\n";

/** A sandbox with the record in place; the fake herdr executes `pane run`. */
function ready(claude = claudeOk({ result: HANDBACK }), herdrOpts = {}) {
  const sb = box();
  sb.install({ herdr: herdrCalls({ execRun: true, panes: [pane({ cwd: sb.root }), pane({ pane_id: "w1:p2" })], ...herdrOpts }), claude });
  sb.write(RECORD, "---\nfrom: orchestrator\n---\n# brief\n");
  return sb;
}
const runArgs = (extra = []) => ["run", "--run", RUN, "--step", "1.2", "--agent", "agent-manager", "--record", RECORD, "--out", OUT, ...extra];
const go = (sb, extra = [], env = {}) => sb.cli(runArgs(extra), { env: { ...ENV, ...env } });
const exitDoc = (sb) => JSON.parse(sb.read(EXIT));
const closes = (sb) => sb.herdrArgs().filter((a) => a[0] === "pane" && a[1] === "close");
const noTmp = (sb) => fs.readdirSync(path.join(sb.root, ".scratch", "herdr", "RUN-1")).filter((f) => f.endsWith(".tmp"));

describe("run: the happy path [AC-10, AC-11]", () => {
  test("[AC-10][AC-11] a usable result: ok true, the result file holds the child's text byte for byte, .exit says usable", () => {
    const sb = ready();
    const r = go(sb);
    assert.equal(r.status, 0);
    assert.equal(r.stderr, "");
    assert.equal(r.lines.length, 1);
    assert.deepEqual(r.json, { ok: true, result: OUT, source: "file", exit: 0, line1: HANDBACK.split("\n")[0], handoffLine: true, permissionDenials: 0, sessionId: "sess-1", costUsd: 0.01 });
    assert.equal(fs.readFileSync(path.join(sb.root, OUT), "utf8"), HANDBACK, "AC-11: the hand-back is copied verbatim");
    const ex = exitDoc(sb);
    assert.deepEqual([ex.usable, ex.exit, ex.subtype, ex.isError, ex.terminalReason, ex.permissionDenials], [true, 0, "success", false, "completed", 0]);
    assert.deepEqual(noTmp(sb), [], "atomic write: no .tmp file left");
    assert.ok(fs.statSync(path.join(sb.root, OUT)).mtimeMs <= fs.statSync(path.join(sb.root, EXIT)).mtimeMs, "the result is final before .exit appears");
  });

  test("[AC-10] claude is started in the repository as `claude -p <brief> --agent ai-dlc:<id> --output-format stream-json --verbose --permission-prompts none`", () => {
    const sb = ready();
    go(sb);
    const [c] = sb.entries("claude");
    assert.equal(sb.entries("claude").length, 1);
    assert.equal(c.args[0], "-p");
    assert.equal(c.args[1], childPrompt(RECORD));
    assert.deepEqual(c.args.slice(2), ["--agent", "ai-dlc:agent-manager", "--output-format", "stream-json", "--verbose", "--permission-prompts", "none"]);
    assert.equal(path.resolve(c.cwd).toLowerCase(), path.resolve(sb.root).toLowerCase());
  });

  test("[AC-10] a child never opens panes: AI_DLC_HERDR_MODE=off and no HERDR_ENV in claude's environment", () => {
    const sb = ready();
    go(sb);
    const [c] = sb.entries("claude");
    assert.equal(c.mode, "off");
    assert.equal(c.herdrEnv, false);
  });

  test("[AC-10] the pane is opened to the right of the anchor, labelled, started with the child command, and closed after a usable result", () => {
    const sb = ready();
    go(sb);
    const args = sb.herdrArgs();
    assert.deepEqual(args.find((a) => a[1] === "split").slice(0, 5), ["pane", "split", "w1:p1", "--direction", "right"]);
    assert.deepEqual(args.find((a) => a[1] === "rename"), ["pane", "rename", "w1:p2", "agent-manager 1.2"]);
    const run = args.find((a) => a[1] === "run");
    assert.match(run[3], /^node \S+\/herdr\.mjs child \S+\/1\.2-agent-manager\.job\.json$/);
    const job = JSON.parse(sb.read(".scratch/herdr/RUN-1/1.2-agent-manager.job.json"));
    assert.deepEqual([job.kind, job.agent, job.record, job.out, job.timeoutMinutes], ["child", "agent-manager", RECORD, OUT, 60]);
    assert.deepEqual(closes(sb), [["pane", "close", "w1:p2"]]);
    assert.equal(sb.exists(".scratch/herdr/RUN-1/1.2-agent-manager.pane.json"), false);
  });

  test("[AC-11] noise lines that are not JSON in claude's output do not spoil a usable result", () => {
    const sb = ready({ stdoutLines: ["warming up...", initEvent, "{ not json", assistantEvent, resultEvent({ result: HANDBACK })] });
    const r = go(sb);
    assert.equal(r.json.ok, true);
    assert.equal(sb.read(OUT), HANDBACK);
  });

  test("[AC-11] only the last result event counts", () => {
    const sb = ready({ stdoutLines: [initEvent, resultEvent({ result: "first" }), resultEvent({ result: HANDBACK })] });
    assert.equal(go(sb).json.ok, true);
    assert.equal(sb.read(OUT), HANDBACK);
  });

  test("[AC-10] a stale result and .exit from an earlier run are removed before the child starts", () => {
    const sb = ready(claudeOk({ result: HANDBACK }));
    sb.write(OUT, "STALE");
    sb.write(EXIT, JSON.stringify({ usable: true, exit: 0 }));
    const r = go(sb);
    assert.equal(r.json.ok, true);
    assert.equal(sb.read(OUT), HANDBACK);
  });

  test("[AC-11] the permission denials of the result are reported (U8)", () => {
    const sb = ready(claudeOk({ result: HANDBACK, permission_denials: [{ tool_name: "Bash" }, { tool_name: "Write" }] }));
    const r = go(sb);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.permissionDenials, 2);
    assert.equal(exitDoc(sb).permissionDenials, 2);
  });

  test("[AC-10] --worktree <name> is passed through to claude (U7)", () => {
    const sb = ready();
    const r = go(sb, ["--worktree", "wt-1.2"]);
    assert.equal(r.json.ok, true);
    const [c] = sb.entries("claude");
    assert.deepEqual(c.args.slice(-2), ["--worktree", "wt-1.2"]);
    assert.equal(JSON.parse(sb.read(".scratch/herdr/RUN-1/1.2-agent-manager.job.json")).worktree, "wt-1.2");
  });

  test("[AC-10] --timeout minutes and the setting reach the job file; --timeout wins", () => {
    const sb = ready();
    go(sb, ["--timeout", "7"], { AI_DLC_HERDR_RUN_TIMEOUT_MINUTES: "30" });
    assert.equal(JSON.parse(sb.read(".scratch/herdr/RUN-1/1.2-agent-manager.job.json")).timeoutMinutes, 7);
    const sb2 = ready();
    go(sb2, [], { AI_DLC_HERDR_RUN_TIMEOUT_MINUTES: "30" });
    assert.equal(JSON.parse(sb2.read(".scratch/herdr/RUN-1/1.2-agent-manager.job.json")).timeoutMinutes, 30);
  });
});

describe("run: a result that is not usable is a failure, never success [AC-11, AC-9]", () => {
  const cases = {
    "claude exits non-zero after a success line": { claude: { ...claudeOk({ result: HANDBACK }), status: 3 }, reason: "claude exited 3" },
    "claude exits non-zero with no output": { claude: { stdoutLines: [], status: 1 }, reason: "claude exited 1" },
    "is_error true": { claude: claudeOk({ is_error: true, result: "boom" }), reason: "result is an error" },
    "subtype error_max_turns": { claude: claudeOk({ subtype: "error_max_turns" }), reason: "result subtype error_max_turns" },
    "subtype missing": { claude: claudeOk({ subtype: undefined }), reason: "result subtype undefined" },
    "a blank result": { claude: claudeOk({ result: "   \n " }), reason: "blank result" },
    "an empty result": { claude: claudeOk({ result: "" }), reason: "blank result" },
    "a result that is not text": { claude: claudeOk({ result: { text: "x" } }), reason: "blank result" },
    "a missing result field": { claude: claudeOk({ result: undefined }), reason: "blank result" },
    "no result line": { claude: { stdoutLines: [initEvent, assistantEvent] }, reason: "no result line" },
    "only non-JSON output": { claude: { stdoutLines: ["Error: not logged in"] }, reason: "no result line" },
  };
  for (const [name, c] of Object.entries(cases)) {
    test(`[AC-11] ${name}: stage run, no result file, pane left open for the human`, () => {
      const sb = ready(c.claude);
      const r = go(sb);
      assert.equal(r.status, 0);
      assert.equal(r.stderr, "");
      assert.equal(r.json.ok, false);
      assert.equal(r.json.stage, "run");
      assert.equal(r.json.reason, c.reason);
      assert.equal(r.json.pane, "w1:p2");
      assert.equal(sb.exists(OUT), false, "an unusable result is never written as the hand-back");
      assert.equal(exitDoc(sb).usable, false);
      assert.equal(exitDoc(sb).reason, c.reason);
      assert.deepEqual(closes(sb), [], "D5: the pane stays open");
      assert.equal(sb.exists(".scratch/herdr/RUN-1/1.2-agent-manager.pane.json"), true, "the pane file stays so close can remove it later");
    });
  }

  test("[AC-11][AC-9] a child that never ends is stopped at --timeout (the process tree gone) and reported as stage run", async () => {
    const sb = ready({ hang: true });
    const r = go(sb, ["--timeout", "0.02"]);
    assert.equal(r.json.ok, false);
    assert.equal(r.json.stage, "run");
    assert.match(r.json.reason, /^timed out after 0\.02 min$/);
    assert.equal(sb.exists(OUT), false);
    const [c] = sb.entries("claude");
    const gone = await until(() => { try { process.kill(c.pid, 0); return false; } catch { return true; } }, 8000);
    assert.equal(gone, true, "the hung claude process was killed with its tree");
  });

  test("[AC-9] a pane that disappears before the agent finishes is reported, not waited for until the timeout", () => {
    const sb = ready({ hang: true }, { execRun: false, panes: [pane({ cwd: "x" })] });
    const r = go(sb, [], { AI_DLC_HERDR_POLL_MS: "30" });
    assert.deepEqual(r.json, { ok: false, stage: "run", reason: "pane closed before the agent finished", exit: null, pane: "w1:p2" });
    assert.deepEqual(closes(sb), []);
  });

  test("[AC-9] an .exit file that cannot be parsed is stage run, and no result is taken", () => {
    const sb = box();
    const exitFile = path.join(sb.root, EXIT);
    sb.install({ herdr: herdrCalls({ panes: [pane({ cwd: sb.root }), pane({ pane_id: "w1:p2" })], extra: [{ match: ["pane", "run"], writeFile: { path: exitFile, text: "{ torn" } }] }) });
    sb.write(RECORD, "x");
    const r = go(sb);
    assert.deepEqual(r.json, { ok: false, stage: "run", reason: "pane copy unusable: markers missing", exit: null, pane: "w1:p2" }, "AC-10: an unparsable .exit lets the pane copy be tried; this pane has none");
    assert.deepEqual(closes(sb), []);
  });

  test("[AC-11] a usable .exit with a blank or missing result file is not success", () => {
    for (const text of [undefined, "  \n"]) {
      const sb = box();
      const exitFile = path.join(sb.root, EXIT);
      sb.install({ herdr: herdrCalls({ panes: [pane({ cwd: sb.root }), pane({ pane_id: "w1:p2" })], extra: [{ match: ["pane", "run"], writeFile: { path: exitFile, text: JSON.stringify({ usable: true, exit: 0 }), also: text === undefined ? undefined : { path: path.join(sb.root, OUT), text } } }] }) });
      sb.write(RECORD, "x");
      const r = go(sb);
      assert.equal(r.json.ok, false);
      assert.equal(r.json.stage, "run");
      assert.equal(r.json.reason, "pane copy unusable: markers missing", "AC-10: the result file is missing or blank, so the pane copy is tried; this pane has none");
    }
  });
});

describe("run: it could not start, so the caller falls back to the Agent tool [AC-12]", () => {
  const launch = (r, reason) => { assert.equal(r.status, 0); assert.equal(r.json.ok, false); assert.equal(r.json.stage, "launch"); assert.match(r.json.reason, reason); assert.equal("exit" in r.json, false); };

  test("[AC-12] mode watch is not run-in-pane", () => {
    const sb = ready();
    launch(go(sb, [], { AI_DLC_HERDR_MODE: undefined }), /^mode is watch, not run-in-pane$/);
    assert.deepEqual(sb.entries("claude"), []);
  });

  test("[AC-12] mode off", () => launch(go(ready(), [], { AI_DLC_HERDR_MODE: "off" }), /^mode is off$/));
  test("[AC-12] herdr not on PATH", () => { const sb = ready(); sb.install({ claude: claudeOk() }); launch(go(sb), /^herdr is not on PATH$/); });
  test("[AC-12] herdr server not running", () => {
    const sb = ready();
    sb.install({ herdr: herdrCalls({ extra: [{ match: ["status", "server"], stdout: "status: not running\n" }] }), claude: claudeOk() });
    launch(go(sb), /^herdr server is not running$/);
  });
  test("[AC-12] the session is not recognised in herdr (HERDR_ENV unset, no pane matches)", () => {
    const sb = ready();
    sb.install({ herdr: herdrCalls({ panes: [] }), claude: claudeOk() });
    launch(go(sb, [], { HERDR_ENV: undefined, HERDR_PANE_ID: undefined }), /^no pane matches this session$/);
  });

  const unsafe = {
    "record with a space": { record: `${RUN}/a b.md` },
    "record with a quote": { record: `${RUN}/a"b.md` },
    "record with $": { record: `${RUN}/$HOME.md` },
    "record with ..": { record: `${RUN}/../../x.md` },
    "absolute record": { record: "/etc/passwd" },
    "record with a semicolon": { record: `${RUN}/a;b.md` },
    "missing record": { record: `${RUN}/nope.md` },
    "out with a space": { out: ".scratch/a b.md" },
    "out with ..": { out: "../x.md" },
    "out absolute": { out: "/tmp/x.md" },
    "worktree with a space": { worktree: "a b" },
    "worktree with ;": { worktree: "x;y" },
    "worktree with ..": { worktree: "a/b" },
  };
  for (const [name, o] of Object.entries(unsafe)) {
    test(`[AC-12] ${name}: stage launch "unsafe or missing path", no pane, no claude`, () => {
      const sb = ready();
      const args = ["run", "--run", RUN, "--step", "1.2", "--agent", "agent-manager", "--record", o.record ?? RECORD, "--out", o.out ?? OUT, ...(o.worktree ? ["--worktree", o.worktree] : [])];
      launch(sb.cli(args, { env: ENV }), /^unsafe or missing path$/);
      assert.deepEqual(sb.herdrArgs().filter((a) => a[1] === "split" || a[1] === "run"), []);
      assert.deepEqual(sb.entries("claude"), []);
    });
  }

  test("[AC-12] a split failing is a launch failure with the reason; nothing is run and no stale result is left behind", () => {
    const sb = ready(claudeOk(), { extra: [{ match: ["pane", "split"], status: 1, stdout: "" }] });
    sb.write(OUT, "STALE");
    launch(go(sb), /^pane split failed/);
    assert.equal(sb.exists(OUT), false, "a stale result of an earlier run is never mistaken for this one");
    assert.deepEqual(sb.entries("claude"), []);
  });

  test("[AC-12] pane run failing is a launch failure and the new pane is closed", () => {
    const sb = ready(claudeOk(), { extra: [{ match: ["pane", "run"], status: 1 }] });
    launch(go(sb), /^pane run failed/);
    assert.deepEqual(closes(sb), [["pane", "close", "w1:p2"]], "the new pane is closed exactly once, and only the new pane");
    assert.equal(sb.exists(".scratch/herdr/RUN-1/1.2-agent-manager.pane.json"), false);
    assert.deepEqual(sb.entries("claude"), []);
  });

  test("[AC-12] claude not on PATH is a stage run failure reported by the child (the pane ran, the agent never started)", () => {
    const sb = ready();
    sb.install({ herdr: herdrCalls({ execRun: true, panes: [pane({ cwd: sb.root }), pane({ pane_id: "w1:p2" })] }) });
    const r = go(sb);
    assert.equal(r.json.ok, false);
    assert.equal(r.json.stage, "run");
    assert.equal(r.json.reason, "claude is not on PATH");
    assert.deepEqual(closes(sb), []);
  });

  test("[AC-12] a child failing with a --worktree argument is a stage run failure, so the Agent-tool fallback applies (U7)", () => {
    const sb = ready({ stdoutLines: ["error: unknown option --worktree"], status: 1 });
    const r = go(sb, ["--worktree", "wt"]);
    assert.equal(r.json.ok, false);
    assert.equal(r.json.stage, "run");
    assert.equal(r.json.reason, "claude exited 1");
  });
});

describe("the AC-11 hand-back check: the child's text is copied verbatim and not judged by the script", () => {
  const stopHookText = "The Stop hook reported that the Copilot plugin is stale; I rebuilt it. Nothing else to report.";

  // LLD 3.3 run step 6: the script copies the text and reports `handoffLine` and `line1`; the orchestrator decides (AC-11: ok:true means
  // "text copied" only; a line 1 that is not the hand-back line is a failed hand-back and the step is re-spawned with the Agent tool).
  test("[AC-11] a final text whose line 1 is not the verification line (a Stop-hook rewrite) is copied verbatim and reported handoffLine:false with its line 1", () => {
    const sb = ready(claudeOk({ result: stopHookText }));
    const r = go(sb);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.handoffLine, false);
    assert.equal(r.json.line1, stopHookText);
    assert.equal(sb.read(OUT), stopHookText);
  });

  test("[AC-11] line1 is the first line only, cut at 200 characters, with a BOM and a CRLF line end ignored", () => {
    const long = "x".repeat(300);
    const sb = ready(claudeOk({ result: `${long}\nsecond` }));
    assert.equal(go(sb).json.line1, "x".repeat(200));
    const sb2 = ready(claudeOk({ result: `\ufeffhandoff r.md: passed \u2014 ok\r\nbody` }));
    const r2 = go(sb2);
    assert.equal(r2.json.line1, "handoff r.md: passed \u2014 ok");
    assert.equal(r2.json.handoffLine, true);
  });

  test("[AC-11] handoffLine needs the exact shape: `handoff <file>: passed|failed \u2014 <why>` with an em dash", () => {
    for (const [text, expected] of [
      ["handoff a.md: passed \u2014 x", true], ["handoff a.md: failed \u2014 x", true],
      ["handoff a.md: passed - x", false], ["handoff a.md: maybe \u2014 x", false], ["handoff : passed \u2014 x", false],
      [" handoff a.md: passed \u2014 x", false], ["Handoff a.md: passed \u2014 x", false], ["handoff a.md passed \u2014 x", false],
    ]) assert.equal(HANDOFF_LINE.test(text), expected, text);
  });

  test("[AC-11] a result whose line 1 is the verification line is returned as is, handoffLine true (a failed verdict is still a well-formed hand-back)", () => {
    const sb = ready(claudeOk({ result: "handoff 1.2-orchestrator-to-agent-manager.handoff.md: failed \u2014 tests red\nrest" }));
    const r = go(sb);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.handoffLine, true);
    assert.match(sb.read(OUT), /^handoff 1\.2-orchestrator-to-agent-manager\.handoff\.md: failed \u2014 tests red\n/);
  });
});

const NONCE = "0123456789ab";
describe("child (the run-in-pane wrapper) as a process [AC-10, AC-9]", () => {
  const job = (sb, over = {}) => sb.write(".scratch/herdr/RUN-1/1.2-agent-manager.job.json", JSON.stringify({ kind: "child", agent: "agent-manager", record: RECORD, out: OUT, timeoutMinutes: 1, root: sb.root, nonce: NONCE, ...over }));
  const child = (sb, over, env = {}) => sb.cli(["child", job(sb, over)], { env: { ...ENV, ...env } });

  test("[AC-10] prints the progress lines and ends with the result marker; exit 0", () => {
    const sb = ready();
    const r = child(sb);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /\[start\] claude-haiku-5-5/);
    assert.match(r.stdout, /working/);
    assert.match(r.stdout, /> Read x\.md/);
    assert.match(r.stdout, /\[done\] success 1 turns \$0\.01/);
    assert.match(r.stdout, new RegExp(`\\[result written: ${OUT.replace(/[.\\/]/g, "\\$&")}\\]`));
  });

  test("[AC-9][AC-10] a bad job file (every field is validated, LLD 3.4 step 0) prints `invalid job: <field>` and exits 0 without running claude", () => {
    const sb = ready();
    const f = sb.write("bad.job.json", "{ nope");
    const r = sb.cli(["child", f]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /\[no usable result: invalid job: kind\]/);
    assert.deepEqual(sb.entries("claude"), []);
    for (const [over, field] of [[{ kind: "watch" }, "kind"], [{ record: "../x" }, "record"], [{ out: "a b" }, "out"], [{ root: 5 }, "root"], [{ nonce: "xyz" }, "nonce"], [{ nonce: undefined }, "nonce"], [{ timeoutMinutes: 0 }, "timeoutMinutes"], [{ agent: "a b" }, "agent"], [{ worktree: "a/b" }, "worktree"]]) {
      const r2 = child(sb, over);
      assert.equal(r2.status, 0, JSON.stringify(over));
      assert.ok(r2.stdout.includes(`[no usable result: invalid job: ${field}]`), `${JSON.stringify(over)} -> ${r2.stdout}`);
    }
    assert.deepEqual(sb.entries("claude"), []);
  });

  test("[AC-9] claude missing: .exit says so, exit 0", () => {
    const sb = ready();
    sb.install({ herdr: herdrCalls() });
    const r = child(sb);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /\[no usable result: claude is not on PATH\]/);
    assert.deepEqual(JSON.parse(sb.read(EXIT)), { usable: false, exit: null, paneCopy: false, nonce: NONCE, reason: "claude is not on PATH" });
  });

  test("[AC-9] a hostile agent id in a hand-made job file is rejected before claude.cmd is spawned (win32 shell path)", { skip: process.platform !== "win32" && "the .cmd shell path exists on win32 only" }, () => {
    const sb = ready();
    for (const agent of ['x"&calc', "a&b", "a|b", "$(x)", "a%PATH%"]) {
      const r = child(sb, { agent });
      assert.equal(r.status, 0, agent);
      assert.match(r.stdout, /\[no usable result: invalid job: agent\]/, agent);
      assert.equal(JSON.parse(sb.read(EXIT)).reason, "invalid job: agent");
    }
    assert.deepEqual(sb.entries("claude"), [], "claude was never spawned");
  });
});

describe("pure helpers of the run path", () => {
  test("usableResult: only exit 0 with a successful, non-error, non-blank result is usable [AC-11]", () => {
    const ok = { subtype: "success", is_error: false, result: "text" };
    assert.deepEqual(usableResult(0, ok), { usable: true });
    assert.deepEqual(usableResult(0, { subtype: "success", result: "text" }), { usable: true }, "a missing is_error is not an error");
    assert.deepEqual(usableResult(1, ok), { usable: false, reason: "claude exited 1" });
    assert.deepEqual(usableResult(null, ok), { usable: false, reason: "claude did not exit normally" });
    assert.deepEqual(usableResult(0, undefined), { usable: false, reason: "no result line" });
    assert.deepEqual(usableResult(0, "str"), { usable: false, reason: "no result line" });
    assert.deepEqual(usableResult(0, { ...ok, is_error: true }), { usable: false, reason: "result is an error" });
    assert.deepEqual(usableResult(0, { ...ok, subtype: "error_during_execution" }), { usable: false, reason: "result subtype error_during_execution" });
    for (const result of ["", "  ", "\n", undefined, null, 5, {}]) assert.deepEqual(usableResult(0, { ...ok, result }), { usable: false, reason: "blank result" }, String(result));
  });

  test("[AC-10] childPrompt carries the record and the line-1 shape, and only characters the .cmd path allows", () => {
    const p = childPrompt(RECORD);
    assert.ok(p.includes(RECORD));
    assert.match(p, /handoff 1\.2-orchestrator-to-agent-manager\.handoff\.md: passed or failed - why/);
    assert.equal(safeArg(p), true);
  });

  test("childArgs adds --worktree only when asked", () => {
    assert.equal(childArgs({ agent: "a", record: RECORD }).includes("--worktree"), false);
    assert.deepEqual(childArgs({ agent: "a", record: RECORD, worktree: "w" }).slice(-2), ["--worktree", "w"]);
    assert.ok(childArgs({ agent: "a", record: RECORD }).every((a) => typeof a === "string"));
  });

  test("safeArg: letters, digits and . _ : / \\ space - pass; shell metacharacters and .. segments do not", () => {
    for (const ok of ["w1:p2", "agent-manager 1.2", "C:\\a\\b.md", "docs/x_y-z.md", "a b"]) assert.equal(safeArg(ok), true, ok);
    for (const bad of ['a"b', "a$b", "a`b", "a;b", "a&b", "a|b", "a<b", "a>b", "a%b", "a\nb", "", "..", "a/../b", "a\\..\\b", 5, undefined, null]) assert.equal(safeArg(bad), false, String(bad));
  });

  test("paneCommand: node, forward slashes, quotes only around a path with a space [U5]", () => {
    const c = paneCommand("child", "C:\\r\\.scratch\\herdr\\RUN\\1.2-a.job.json");
    assert.match(c, /^node \S+\/skills\/herdr\/scripts\/herdr\.mjs child C:\/r\/\.scratch\/herdr\/RUN\/1\.2-a\.job\.json$/);
    assert.doesNotMatch(c, /[\\"$]/);
    assert.match(paneCommand("watch", "/a b/c.json"), / watch "\/a b\/c\.json"$/);
  });

  test("renderEvent renders one pane line per stream-json event and nothing for the rest", () => {
    assert.equal(renderEvent(initEvent), "[start] claude-haiku-5-5");
    assert.equal(renderEvent({ type: "system", subtype: "init" }), "[start]");
    assert.equal(renderEvent(resultEvent()), "[done] success 1 turns $0.01");
    assert.equal(renderEvent({ type: "result" }), "[done] ? ? turns $?");
    assert.equal(renderEvent(assistantEvent), "working\n> Read x.md");
    assert.equal(renderEvent({ type: "assistant", message: { content: [{ type: "text", text: "x".repeat(300) }] } }).length, 160);
    assert.equal(renderEvent({ type: "assistant", message: { content: [{ type: "text", text: "a\n\n  b" }] } }), "a b");
    assert.equal(renderEvent({ type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", input: { command: "echo ".concat("y".repeat(200)) } }] } }).length, "> Bash ".length + 100);
    assert.equal(renderEvent({ type: "assistant", message: { content: [{ type: "tool_use", name: "Grep", input: { pattern: "foo" } }] } }), "> Grep foo");
    for (const ev of [null, undefined, 5, "x", [], { type: "rate_limit_event" }, { type: "assistant", message: {} }, { type: "assistant", message: { content: [] } }, { type: "assistant", message: { content: [null, { type: "image" }] } }]) assert.equal(renderEvent(ev), undefined, JSON.stringify(ev));
  });

  test("atomicWrite leaves the final file and no .tmp, creating folders", () => {
    const sb = box();
    const f = path.join(sb.root, "a", "b", "c.txt");
    atomicWrite(f, "one");
    atomicWrite(f, "two");
    assert.equal(fs.readFileSync(f, "utf8"), "two");
    assert.deepEqual(fs.readdirSync(path.dirname(f)), ["c.txt"]);
  });

  test("resolveExe finds a file on PATH; .cmd and .bat need a shell on win32; a missing name is undefined", () => {
    const sb = box();
    fs.writeFileSync(path.join(sb.bin, "tool.cmd"), "@echo off\n");
    fs.writeFileSync(path.join(sb.bin, "plain"), "x");
    assert.equal(resolveExe("nothing-here", { PATH: sb.bin }, "win32"), undefined);
    assert.deepEqual(resolveExe("tool", { PATH: sb.bin }, "win32"), { file: path.join(sb.bin, "tool.cmd"), shell: true });
    assert.equal(resolveExe("plain", {}, "linux"), undefined);
    assert.deepEqual(resolveExe("plain", { Path: sb.bin }, "win32"), { file: path.join(sb.bin, "plain"), shell: false }, "a bare name is the last extension tried; the PATH key may be any case");
  });

  test("parseStatusServer reads the status line only [live: exit 0 either way]", () => {
    assert.equal(parseStatusServer("status: running\nversion: 0.9.5"), true);
    assert.equal(parseStatusServer("  status:   running  \n"), true);
    for (const t of ["status: not running", "status: stopped", "running", "", undefined, null, "mystatus: running"]) assert.equal(parseStatusServer(t), false, String(t));
  });
});
