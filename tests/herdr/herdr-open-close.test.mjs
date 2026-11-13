// herdr.mjs open / close (AC-6 pane per agent, AC-7 closed on hand-back, AC-8 never closed for idleness, AC-9 never block,
// AC-2 only documented herdr commands; LLD 1.1.6 U3, U4, U9). herdr is a fake executable on a temp PATH; the script runs as a process.
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { sandbox, herdrCalls, pane, notFound, HERDR_MJS } from "./helpers/fake-bin.mjs";

const boxes = [];
const box = (label = "open") => { const sb = sandbox(label); boxes.push(sb); return sb; };
afterEach(() => { while (boxes.length) boxes.pop().cleanup(); });

const RUN = "docs/handoffs/RUN-1";
const ENV = { HERDR_ENV: "1", HERDR_PANE_ID: "w1:p1" };
const open = (sb, pairs, env = ENV) => sb.cli(["open", "--run", RUN, ...pairs.flatMap(([s, a, r]) => ["--step", s, "--agent", a, ...(r ? ["--record", r] : [])])], { env });
const close = (sb, pairs, env = ENV) => sb.cli(["close", "--run", RUN, ...pairs.flatMap(([s, a]) => ["--step", s, "--agent", a])], { env });
const calls = (sb, prefix) => sb.herdrArgs().filter((a) => a.join(" ").startsWith(prefix));
const paneFile = (sb, step, agent) => `.scratch/herdr/RUN-1/${step}-${agent}.pane.json`;

describe("open: one labelled pane per agent [AC-6, AC-2]", () => {
  test("[AC-6] splits the anchor to the right without focus in the repository, labels it, and starts watch from the job file", () => {
    const sb = box().install({ herdr: herdrCalls({ panes: [pane({ cwd: "x" }), pane({ pane_id: "w1:p2", cwd: "x" })] }) });
    const rec = `${RUN}/1.2-orchestrator-to-agent-manager.handoff.md`;
    const r = open(sb, [["1.2", "agent-manager", rec]]);
    assert.equal(r.status, 0);
    assert.equal(r.stderr, "");
    assert.equal(r.lines.length, 1);
    assert.deepEqual(r.json, { ok: true, opened: [{ step: "1.2", agent: "agent-manager", pane: "w1:p2" }], skipped: [], warnings: [] });

    assert.deepEqual(calls(sb, "pane split")[0], ["pane", "split", "w1:p1", "--direction", "right", "--no-focus", "--cwd", sb.root]);
    assert.deepEqual(calls(sb, "pane rename")[0], ["pane", "rename", "w1:p2", "agent-manager 1.2"]);

    const run = calls(sb, "pane run")[0];
    assert.equal(run[2], "w1:p2");
    const jobFile = path.join(sb.root, ".scratch", "herdr", "RUN-1", "1.2-agent-manager.job.json");
    const script = HERDR_MJS.replace(/\\/g, "/");
    // U5: a form that parses the same in sh, pwsh and powershell: node, forward-slash paths, no quote, no $, no backslash.
    assert.equal(run[3], `node ${script} watch ${jobFile.replace(/\\/g, "/")}`);
    assert.doesNotMatch(run[3], /["'$`\\]/);

    const job = JSON.parse(fs.readFileSync(jobFile, "utf8"));
    assert.equal(job.kind, "watch");
    assert.equal(job.run, path.join(sb.root, RUN));
    assert.equal(job.step, "1.2");
    assert.equal(job.agent, "agent-manager");
    assert.equal(job.record, path.join(sb.root, rec));
    assert.ok(Date.parse(job.opened));
    const pf = JSON.parse(sb.read(paneFile(sb, "1.2", "agent-manager")));
    assert.equal(pf.pane, "w1:p2");
    assert.equal(pf.mode, "watch");
    assert.equal(JSON.parse(sb.read(".scratch/herdr/RUN-1/anchor.json")).pane, "w1:p1");
  });

  test("[AC-6] the job has record null when --record is not given", () => {
    const sb = box().install({ herdr: herdrCalls() });
    assert.equal(open(sb, [["2.1", "sqa-engineer"]]).json.ok, true);
    assert.equal(JSON.parse(sb.read(".scratch/herdr/RUN-1/2.1-sqa-engineer.job.json")).record, null);
  });

  test("[AC-6] a fan-out of two pairs in one call: the first pane right of the anchor, the second down from the first", () => {
    const sb = box().install({ herdr: herdrCalls({ splitIds: ["w1:p2", "w1:p3"], panes: [pane({ pane_id: "w1:p1" })] }) });
    const r = open(sb, [["1.4.1", "code-reviewer"], ["1.4.2", "code-reviewer"]]);
    assert.deepEqual(r.json.opened.map((o) => [o.step, o.pane]), [["1.4.1", "w1:p2"], ["1.4.2", "w1:p3"]]);
    const splits = calls(sb, "pane split");
    assert.deepEqual([splits[0][2], splits[0][4]], ["w1:p1", "right"]);
    assert.deepEqual([splits[1][2], splits[1][4]], ["w1:p2", "down"]);
    assert.deepEqual(calls(sb, "pane rename").map((a) => a[3]), ["code-reviewer 1.4.1", "code-reviewer 1.4.2"]);
  });

  test("[AC-6] a later open call splits down from the run's newest live pane", () => {
    const sb = box().install({ herdr: herdrCalls({ splitIds: ["w1:p2", "w1:p3"], panes: [pane(), pane({ pane_id: "w1:p2" })] }) });
    open(sb, [["1.2", "agent-manager"]]);
    open(sb, [["1.3", "sqa-engineer"]]);
    const splits = calls(sb, "pane split");
    assert.deepEqual([splits[1][2], splits[1][4]], ["w1:p2", "down"]);
  });

  test("[AC-6] when the run's earlier pane is no longer live it is skipped as a target (the anchor again, to the right)", () => {
    const sb = box().install({ herdr: herdrCalls({ splitIds: ["w1:p2", "w1:p3"], panes: [pane()] }) });
    open(sb, [["1.2", "agent-manager"]]);
    open(sb, [["1.3", "sqa-engineer"]]);
    const splits = calls(sb, "pane split");
    assert.deepEqual([splits[1][2], splits[1][4]], ["w1:p1", "right"]);
  });

  test("[AC-9] pane_not_found on the target retries once with the anchor", () => {
    const split = { match: ["pane", "split"], replies: [{ stdout: JSON.stringify({ result: { pane: { pane_id: "w1:p2" } } }) }, { ...notFound }, { stdout: JSON.stringify({ result: { pane: { pane_id: "w1:p3" } } }) }] };
    const sb = box().install({ herdr: herdrCalls({ extra: [split], panes: [pane(), pane({ pane_id: "w1:p2" })] }) });
    open(sb, [["1.2", "agent-manager"]]);
    const r = open(sb, [["1.3", "sqa-engineer"]]);
    assert.equal(r.json.ok, true);
    assert.deepEqual(r.json.opened, [{ step: "1.3", agent: "sqa-engineer", pane: "w1:p3" }]);
    const splits = calls(sb, "pane split");
    assert.equal(splits.length, 3);
    assert.deepEqual([splits[1][2], splits[1][4]], ["w1:p2", "down"]);
    assert.deepEqual([splits[2][2], splits[2][4]], ["w1:p1", "right"]);
  });

  test("[AC-6] anchor sources: the run's cached anchor.json, and a pane match, are used as the split target", () => {
    const sb = box();
    sb.install({ herdr: herdrCalls({ panes: [pane({ pane_id: "w3:p4", cwd: sb.root })] }) });
    // pane match, no HERDR_ENV
    assert.equal(open(sb, [["1.2", "agent-manager"]], {}).json.ok, true);
    assert.equal(calls(sb, "pane split")[0][2], "w3:p4");
    assert.equal(JSON.parse(sb.read(".scratch/herdr/RUN-1/anchor.json")).source, "pane-match");
    // cached on the next call: the pane may now be idle (it launched a tool-free turn)
    const sb2 = box();
    sb2.install({ herdr: herdrCalls({ panes: [pane({ pane_id: "w3:p4", agent_status: "idle" })] }) });
    sb2.write(".scratch/herdr/RUN-1/anchor.json", JSON.stringify({ pane: "w3:p4", source: "pane-match" }));
    assert.equal(open(sb2, [["1.3", "sqa-engineer"]], {}).json.ok, true);
    assert.equal(calls(sb2, "pane split")[0][2], "w3:p4");
  });

  test("[AC-6] a null anchor (HERDR_ENV=1, no HERDR_PANE_ID, no match) splits --current; pane current is never called", () => {
    const sb = box().install({ herdr: herdrCalls({ panes: [] }) });
    const r = open(sb, [["1.2", "agent-manager"]], { HERDR_ENV: "1" });
    assert.equal(r.json.ok, true);
    const split = calls(sb, "pane split")[0];
    assert.deepEqual(split.slice(0, 3), ["pane", "split", "--current"]);
    assert.equal(sb.herdr().some((c) => c.startsWith("pane current")), false);
    assert.equal(sb.exists(".scratch/herdr/RUN-1/anchor.json"), false, "no anchor is cached when there is none");
  });

  test("[AC-6] a --record path is made absolute against the root", () => {
    const sb = box().install({ herdr: herdrCalls() });
    open(sb, [["1.2", "agent-manager", "docs/x.md"]]);
    assert.equal(JSON.parse(sb.read(".scratch/herdr/RUN-1/1.2-agent-manager.job.json")).record, path.join(sb.root, "docs", "x.md"));
  });
});

describe("open: outside herdr nothing is opened [AC-4, AC-9]", () => {
  test("[AC-4] herdr absent: ok true, nothing opened, every pair skipped with the reason, nothing created", () => {
    const sb = box().install({});
    const r = open(sb, [["1.2", "agent-manager"], ["1.3", "sqa-engineer"]], {});
    assert.equal(r.status, 0);
    assert.deepEqual(r.json, { ok: true, opened: [], skipped: [{ step: "1.2", agent: "agent-manager", reason: "herdr is not on PATH" }, { step: "1.3", agent: "sqa-engineer", reason: "herdr is not on PATH" }], warnings: [] });
    assert.equal(fs.existsSync(path.join(sb.root, ".scratch")), false);
  });

  test("[AC-4] mode off inside herdr: skipped, no split", () => {
    const sb = box().install({ herdr: herdrCalls() });
    const r = open(sb, [["1.2", "agent-manager"]], { ...ENV, AI_DLC_HERDR_MODE: "off" });
    assert.equal(r.json.ok, true);
    assert.deepEqual(r.json.opened, []);
    assert.equal(r.json.skipped[0].reason, "mode is off");
    assert.deepEqual(calls(sb, "pane split"), []);
  });

  test("[AC-4] inside a herdr whose pane cannot be matched: skipped with the reason", () => {
    const sb = box().install({ herdr: herdrCalls({ panes: [] }) });
    const r = open(sb, [["1.2", "agent-manager"]], {});
    assert.equal(r.json.ok, true);
    assert.equal(r.json.skipped[0].reason, "no pane matches this session");
    assert.deepEqual(calls(sb, "pane split"), []);
  });
});

describe("open: herdr failures never block [AC-9; U3, U4, U9]", () => {
  const variants = {
    "result.pane_id": { stdout: JSON.stringify({ result: { pane_id: "w1:p5" } }), ok: "w1:p5" },
    "result.pane.pane_id": { stdout: JSON.stringify({ result: { pane: { pane_id: "w1:p6" } } }), ok: "w1:p6" },
  };
  for (const [name, v] of Object.entries(variants)) {
    test(`[AC-9] split output shape ${name} is understood`, () => {
      const sb = box().install({ herdr: herdrCalls({ extra: [{ match: ["pane", "split"], stdout: v.stdout }] }) });
      assert.equal(open(sb, [["1.2", "agent-manager"]]).json.opened[0].pane, v.ok);
    });
  }

  const unusable = {
    "valid JSON without a pane id": { stdout: JSON.stringify({ result: {} }), reason: /unexpected herdr output/ },
    "a non-string pane id": { stdout: JSON.stringify({ result: { pane: { pane_id: 7 } } }), reason: /unexpected herdr output/ },
    "an empty pane id": { stdout: JSON.stringify({ result: { pane: { pane_id: "" } } }), reason: /unexpected herdr output/ },
    "non-JSON": { stdout: "split done", reason: /pane split failed: unexpected herdr output/ },
    "empty output": { stdout: "", reason: /pane split failed: unexpected herdr output/ },
    "exit 1 (an unknown flag, U9)": { stdout: "", status: 1, stderr: "unknown flag --no-focus", reason: /pane split failed/ },
    "a herdr error object": { stdout: JSON.stringify({ error: { code: "bad" } }), status: 1, reason: /pane split failed: bad/ },
  };
  for (const [name, c] of Object.entries(unusable)) {
    test(`[AC-9] split answering ${name}: ok false, exit 0, no pane file, nothing run`, () => {
      const sb = box().install({ herdr: herdrCalls({ extra: [{ match: ["pane", "split"], stdout: c.stdout, stderr: c.stderr, status: c.status }] }) });
      const r = open(sb, [["1.2", "agent-manager"]]);
      assert.equal(r.status, 0);
      assert.equal(r.stderr, "");
      assert.equal(r.json.ok, false);
      assert.deepEqual(r.json.opened, []);
      assert.equal(r.json.failed.length, 1);
      assert.deepEqual([r.json.failed[0].step, r.json.failed[0].agent], ["1.2", "agent-manager"]);
      assert.match(r.json.failed[0].reason, c.reason);
      assert.equal(sb.exists(paneFile(sb, "1.2", "agent-manager")), false);
      assert.deepEqual(calls(sb, "pane run"), []);
    });
  }

  test("[AC-9] pane rename failing (exit 1) leaves the pane unlabelled: ok true with a warning", () => {
    const sb = box().install({ herdr: herdrCalls({ extra: [{ match: ["pane", "rename"], status: 1, stderr: "no" }] }) });
    const r = open(sb, [["1.2", "agent-manager"]]);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.opened.length, 1);
    assert.equal(r.json.warnings.length, 1);
    assert.match(r.json.warnings[0], /^pane rename w1:p2: herdr exited 1/);
  });

  test("[AC-9] pane rename and pane run answering garbage with exit 0 is a success (U4: exit code only)", () => {
    const sb = box().install({ herdr: herdrCalls({ extra: [{ match: ["pane", "rename"], stdout: "<<garbage>>" }, { match: ["pane", "run"], stdout: "\u0000\u0001 ???" }] }) });
    const r = open(sb, [["1.2", "agent-manager"]]);
    assert.equal(r.json.ok, true);
    assert.deepEqual(r.json.warnings, []);
  });

  test("[AC-9] pane run failing closes the pane (best effort), removes its pane file and reports ok false", () => {
    const sb = box().install({ herdr: herdrCalls({ extra: [{ match: ["pane", "run"], status: 1, stderr: "no shell" }] }) });
    const r = open(sb, [["1.2", "agent-manager"]]);
    assert.equal(r.json.ok, false);
    assert.equal(r.json.failed[0].reason, "pane run failed: herdr exited 1");
    assert.deepEqual(calls(sb, "pane close"), [["pane", "close", "w1:p2"]]);
    assert.equal(sb.exists(paneFile(sb, "1.2", "agent-manager")), false);
  });

  test("[AC-9] one pair failing does not stop the others; the result lists what opened and what failed", () => {
    const split = { match: ["pane", "split"], replies: [{ stdout: "nope" }, { stdout: JSON.stringify({ result: { pane: { pane_id: "w1:p3" } } }) }] };
    const sb = box().install({ herdr: herdrCalls({ extra: [split] }) });
    const r = open(sb, [["1.4.1", "code-reviewer"], ["1.4.2", "code-reviewer"]]);
    assert.equal(r.json.ok, false);
    assert.deepEqual(r.json.opened, [{ step: "1.4.2", agent: "code-reviewer", pane: "w1:p3" }]);
    assert.deepEqual(r.json.failed.map((f) => f.step), ["1.4.1"]);
  });

  test("[AC-9] a herdr that hangs on split makes open return ok false within the call timeout, not block", () => {
    const sb = box().install({ herdr: herdrCalls({ extra: [{ match: ["pane", "split"], delayMs: 3000, stdout: "late" }] }) });
    const r = open(sb, [["1.2", "agent-manager"]], { ...ENV, AI_DLC_HERDR_CALL_TIMEOUT_MS: "300" });
    assert.equal(r.status, 0);
    assert.equal(r.json.ok, false);
    assert.match(r.json.failed[0].reason, /pane split failed/);
    assert.ok(r.ms < 20000, `took ${r.ms} ms`);
  });
});

describe("close [AC-7, AC-8, AC-9]", () => {
  test("[AC-7] closes the stored pane and removes its pane file", () => {
    const sb = box().install({ herdr: herdrCalls() });
    open(sb, [["1.2", "agent-manager"]]);
    const r = close(sb, [["1.2", "agent-manager"]]);
    assert.equal(r.status, 0);
    assert.deepEqual(r.json, { ok: true, closed: [{ step: "1.2", agent: "agent-manager", pane: "w1:p2" }], notOpen: [] });
    assert.deepEqual(calls(sb, "pane close"), [["pane", "close", "w1:p2"]]);
    assert.equal(sb.exists(paneFile(sb, "1.2", "agent-manager")), false);
  });

  test("[AC-7] close needs no herdr detection: it works from the pane file alone (mode off, no HERDR_ENV)", () => {
    const sb = box().install({ herdr: herdrCalls() });
    sb.write(paneFile(sb, "1.2", "agent-manager"), JSON.stringify({ pane: "w1:p2" }));
    const r = close(sb, [["1.2", "agent-manager"]], { AI_DLC_HERDR_MODE: "off" });
    assert.equal(r.json.ok, true);
    assert.deepEqual(calls(sb, "pane close"), [["pane", "close", "w1:p2"]]);
  });

  test("[AC-9] no pane file: ok true, reason \"no pane\", no herdr call", () => {
    const sb = box().install({ herdr: herdrCalls() });
    const r = close(sb, [["1.2", "agent-manager"]]);
    assert.deepEqual(r.json, { ok: true, closed: [], reason: "no pane" });
    assert.deepEqual(sb.entries(), []);
  });

  test("[AC-9] close outside herdr (herdr absent) with no pane file is still ok", () => {
    const sb = box().install({});
    assert.deepEqual(close(sb, [["1.2", "agent-manager"]], {}).json, { ok: true, closed: [], reason: "no pane" });
  });

  test("[AC-9] an unreadable pane file is removed and counts as no pane", () => {
    const sb = box().install({ herdr: herdrCalls() });
    sb.write(paneFile(sb, "1.2", "agent-manager"), "{ broken");
    const r = close(sb, [["1.2", "agent-manager"]]);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.reason, "no pane");
    assert.equal(sb.exists(paneFile(sb, "1.2", "agent-manager")), false);
    assert.deepEqual(calls(sb, "pane close"), []);
  });

  test("[AC-9] pane_not_found (exit 1, the live behaviour) is success and the file is removed: close is idempotent", () => {
    const sb = box().install({ herdr: herdrCalls({ extra: [{ match: ["pane", "close"], ...notFound }] }) });
    sb.write(paneFile(sb, "1.2", "agent-manager"), JSON.stringify({ pane: "w9:p9" }));
    const r = close(sb, [["1.2", "agent-manager"]]);
    assert.deepEqual(r.json.closed, [{ step: "1.2", agent: "agent-manager", pane: "w9:p9" }]);
    assert.equal(r.json.ok, true);
    assert.equal(sb.exists(paneFile(sb, "1.2", "agent-manager")), false);
  });

  test("[AC-9] any other close failure is ok false and the pane file stays so close can be retried", () => {
    for (const call of [{ match: ["pane", "close"], status: 1, stdout: JSON.stringify({ error: { code: "internal" } }) }, { match: ["pane", "close"], status: 1, stdout: "plain failure" }]) {
      const sb = box().install({ herdr: herdrCalls({ extra: [call] }) });
      sb.write(paneFile(sb, "1.2", "agent-manager"), JSON.stringify({ pane: "w1:p2" }));
      const r = close(sb, [["1.2", "agent-manager"]]);
      assert.equal(r.status, 0);
      assert.equal(r.json.ok, false);
      assert.equal(r.json.failed[0].pane, "w1:p2");
      assert.equal(sb.exists(paneFile(sb, "1.2", "agent-manager")), true);
    }
  });

  test("[AC-9] exit 0 with output that is not JSON counts as closed (U4)", () => {
    const sb = box().install({ herdr: herdrCalls({ extra: [{ match: ["pane", "close"], stdout: "closed w1:p2" }] }) });
    sb.write(paneFile(sb, "1.2", "agent-manager"), JSON.stringify({ pane: "w1:p2" }));
    assert.equal(close(sb, [["1.2", "agent-manager"]]).json.ok, true);
  });

  test("[AC-7] several pairs: each is closed, a failure of one is reported and does not stop the rest", () => {
    const sb = box().install({ herdr: herdrCalls({ extra: [{ match: ["pane", "close", "w1:p3"], status: 1, stdout: "no" }] }) });
    for (const [s, p] of [["1.4.1", "w1:p2"], ["1.4.2", "w1:p3"], ["1.4.3", "w1:p4"]]) sb.write(paneFile(sb, s, "code-reviewer"), JSON.stringify({ pane: p }));
    const r = close(sb, [["1.4.1", "code-reviewer"], ["1.4.2", "code-reviewer"], ["1.4.3", "code-reviewer"]]);
    assert.equal(r.json.ok, false);
    assert.deepEqual(r.json.closed.map((c) => c.pane), ["w1:p2", "w1:p4"]);
    assert.deepEqual(r.json.failed.map((c) => c.pane), ["w1:p3"]);
  });

  test("[AC-7] only the named step and agent are closed; another agent's pane of the same step stays", () => {
    const sb = box().install({ herdr: herdrCalls() });
    sb.write(paneFile(sb, "1.4", "code-reviewer"), JSON.stringify({ pane: "w1:p2" }));
    sb.write(paneFile(sb, "1.4", "sqa-engineer"), JSON.stringify({ pane: "w1:p3" }));
    close(sb, [["1.4", "code-reviewer"]]);
    assert.deepEqual(calls(sb, "pane close"), [["pane", "close", "w1:p2"]]);
    assert.equal(sb.exists(paneFile(sb, "1.4", "sqa-engineer")), true);
  });
});

describe("a pane is closed only by a close call [AC-8]", () => {
  test("[AC-8] open, a re-open of the same step, and detect never close or kill a pane, whatever the agent state", () => {
    const sb = box().install({ herdr: herdrCalls({ splitIds: ["w1:p2", "w1:p3", "w1:p4"], panes: [pane({ agent_status: "idle" }), pane({ pane_id: "w1:p2", agent_status: "idle" })] }) });
    open(sb, [["1.2", "agent-manager"]]);
    open(sb, [["1.2", "agent-manager"]]);
    open(sb, [["1.3", "sqa-engineer"]]);
    sb.cli(["detect", "--run", RUN], { env: ENV });
    assert.deepEqual(calls(sb, "pane close"), []);
    assert.deepEqual(sb.herdrArgs().map((a) => a.slice(0, 2).join(" ")).filter((c) => !/^(--version|status server|pane (list|layout|split|rename|run))$/.test(c)), [], "only the opening commands ran");
  });

  test("[AC-8] the cached state of an open pane survives repeated open calls (the pane file is not removed)", () => {
    const sb = box().install({ herdr: herdrCalls() });
    open(sb, [["1.2", "agent-manager"]]);
    open(sb, [["1.3", "sqa-engineer"]]);
    assert.equal(sb.exists(paneFile(sb, "1.2", "agent-manager")), true);
  });
});

describe("every herdr command used is a documented one [AC-2]", () => {
  test("[AC-2] a full open / close flow calls only --version, status server and pane list|split|rename|run|close", () => {
    const sb = box();
    sb.install({ herdr: herdrCalls({ panes: [pane({ cwd: sb.root })] }) });
    open(sb, [["1.2", "agent-manager"]], {});
    close(sb, [["1.2", "agent-manager"]], {});
    const allowed = [["--version"], ["status", "server"], ["pane", "list"], ["pane", "layout"], ["pane", "split"], ["pane", "rename"], ["pane", "run"], ["pane", "close"]];
    for (const argv of sb.herdrArgs()) assert.ok(allowed.some((a) => a.every((x, i) => argv[i] === x)), `undocumented herdr call: ${argv.join(" ")}`);
    assert.ok(sb.herdr().length >= 6);
  });
});

test("[AC-9] open still works when only the liveness pane list fails (HERDR_PANE_ID needs no list)", () => {
  const sb = box().install({ herdr: herdrCalls({ extra: [{ match: ["pane", "list"], status: 1 }] }) });
  const r = open(sb, [["1.2", "agent-manager"]]);
  assert.equal(r.json.ok, true, "HERDR_ENV=1 plus HERDR_PANE_ID needs no pane list");
});
