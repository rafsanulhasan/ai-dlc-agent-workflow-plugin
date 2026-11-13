// herdr.mjs pane placement (follow-up of the herdr skill, step 1.2.l3.1): `open` and `run` lay the run's panes out so each stays
// readable and a team's panes stay together. choosePlacement is pure and is tested directly; openPane is tested through the CLI with a fake
// herdr on a temp PATH (never the real one). Traces: AC-6 (a labelled pane per agent), AC-9 (never block: a failing layout falls back),
// AC-10 (run-in-pane panes), AC-2 (only documented herdr commands: `pane layout` is read-only). Tag [layout] marks the new rule.
// HERDR_MJS_UNDER_TEST (see helpers/fake-bin.mjs) runs the whole file against a mutated copy of the script for red-before-green checks.
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { sandbox, herdrCalls, pane, notFound, splitJson, claudeOk, until, HERDR_MJS } from "./helpers/fake-bin.mjs";

const { choosePlacement, READABLE } = await import(pathToFileURL(HERDR_MJS).href);

const boxes = [];
const box = (label = "layout") => { const sb = sandbox(label); boxes.push(sb); return sb; };
afterEach(() => { while (boxes.length) boxes.pop().cleanup(); });

/** A `pane layout` entry in the live shape: { pane_id, focused, rect: { x, y, width, height } }. */
const lp = (id, x, y, width, height) => ({ pane_id: id, focused: false, rect: { x, y, width, height } });
const layoutJson = (...panes) => JSON.stringify({ id: "cli:pane:layout", result: { layout: { area: { x: 0, y: 0, width: 400, height: 200 }, focused_pane_id: "w1:p1", panes, splits: [], tab_id: "w1:t1", workspace_id: "w1", zoomed: false }, type: "pane_layout" } });
const layoutCall = (...panes) => ({ match: ["pane", "layout"], stdout: layoutJson(...panes) });

const RUN = "docs/handoffs/RUN-1";
const ENV = { HERDR_ENV: "1", HERDR_PANE_ID: "w1:p1" };
const open = (sb, pairs, env = ENV) => sb.cli(["open", "--run", RUN, ...pairs.flatMap(([s, a]) => ["--step", s, "--agent", a])], { env });
const calls = (sb, prefix) => sb.herdrArgs().filter((a) => a.join(" ").startsWith(prefix));
const paneFile = (step, agent) => `.scratch/herdr/RUN-1/${step}-${agent}.pane.json`;
const seed = (sb, step, agent, id, opened = "2026-11-14T10:00:00.000Z") => sb.write(paneFile(step, agent), JSON.stringify({ pane: id, mode: "watch", step, agent, opened }));
/** [target, direction] of every split call (`--current` shows as the target). */
const splitsOf = (sb) => calls(sb, "pane split").map((a) => [a[2], a[a.indexOf("--direction") + 1]]);

describe("choosePlacement: the pure rule [layout]", () => {
  test("[layout] READABLE is 50 columns by 10 rows", () => {
    assert.deepEqual({ ...READABLE }, { cols: 50, rows: 10 });
  });

  test("[layout] a tall pane stacks down: 130x40 -> down, the lower half 130x20, readable", () => {
    assert.deepEqual(choosePlacement([lp("a", 0, 0, 130, 40)], ["a"]), { pane: "a", direction: "down", cols: 130, rows: 20, readable: true });
  });

  test("[layout] a column that would get too short starts a new column: 130x20 -> right (65x20), not down (130x10 scores lower)", () => {
    assert.deepEqual(choosePlacement([lp("a", 0, 0, 130, 20)], ["a"]), { pane: "a", direction: "right", cols: 65, rows: 20, readable: true });
  });

  test("[layout] halves are floored: 99x19 -> right gives 49x19 (not 49.5), unreadable", () => {
    assert.deepEqual(choosePlacement([lp("a", 0, 0, 99, 19)], ["a"]), { pane: "a", direction: "right", cols: 49, rows: 19, readable: false });
  });

  test("[layout] down's lower half is floored too: 101x21 ties down (101x10) with right (50x21); down wins the tie and is readable", () => {
    assert.deepEqual(choosePlacement([lp("a", 0, 0, 101, 21)], ["a"]), { pane: "a", direction: "down", cols: 101, rows: 10, readable: true });
  });

  test("[layout] the readable flag needs both 50 columns and 10 rows (50x20 down -> 50x10 readable; 49x20 down -> 49x10 not)", () => {
    assert.equal(choosePlacement([lp("a", 0, 0, 50, 20)], ["a"]).readable, true);
    const p = choosePlacement([lp("a", 0, 0, 49, 20)], ["a"]);
    assert.deepEqual([p.direction, p.cols, p.rows, p.readable], ["down", 49, 10, false]);
  });

  test("[layout] below readable the best of a bad lot is still returned, flagged: 45x8 -> right 22x8", () => {
    assert.deepEqual(choosePlacement([lp("a", 0, 0, 45, 8)], ["a"]), { pane: "a", direction: "right", cols: 22, rows: 8, readable: false });
  });

  test("[layout] the pane whose split scores best wins across several panes (a 65x10 pane loses to a 65x20 pane)", () => {
    const p = choosePlacement([lp("a", 0, 0, 65, 10), lp("b", 0, 10, 65, 20)], ["a", "b"]);
    assert.deepEqual([p.pane, p.direction, p.cols, p.rows], ["b", "down", 65, 10]);
  });

  test("[layout] tie between panes: the top-left one (smaller y, then smaller x), whatever the input order", () => {
    const a = lp("a", 0, 0, 65, 20), b = lp("b", 65, 0, 65, 20), c = lp("c", 0, 20, 65, 20);
    for (const order of [[a, b, c], [c, b, a], [b, c, a]]) assert.equal(choosePlacement(order, ["a", "b", "c"]).pane, "a");
    assert.equal(choosePlacement([b, c], ["b", "c"]).pane, "b", "same score: smaller y before larger y");
    assert.equal(choosePlacement([lp("r", 70, 5, 65, 20), lp("l", 10, 5, 65, 20)], ["r", "l"]).pane, "l", "same y: smaller x first");
  });

  test("[layout] tie between directions on one pane: down before right (100x20: both score 1)", () => {
    assert.deepEqual(choosePlacement([lp("a", 0, 0, 100, 20)], ["a"]), { pane: "a", direction: "down", cols: 100, rows: 10, readable: true });
  });

  test("[layout] panes outside the group (the anchor, another run's pane) are never chosen, however large", () => {
    const p = choosePlacement([lp("anchor", 0, 0, 400, 200), lp("other", 0, 0, 300, 100), lp("mine", 400, 0, 20, 4)], ["mine"]);
    assert.equal(p.pane, "mine");
  });

  test("[layout] undefined when no group pane is in the layout, or the layout is not a list", () => {
    assert.equal(choosePlacement([lp("anchor", 0, 0, 100, 40)], ["mine"]), undefined);
    assert.equal(choosePlacement([], ["mine"]), undefined);
    assert.equal(choosePlacement([lp("a", 0, 0, 100, 40)], []), undefined);
    for (const bad of [undefined, null, "x", {}, 7]) assert.equal(choosePlacement(bad, ["a"]), undefined);
  });

  test("[layout] entries without a usable rect or id are ignored; a valid pane beside them is still chosen", () => {
    const bad = [
      { pane_id: "a" },
      { pane_id: "a", rect: null },
      { pane_id: "a", rect: { x: 0, y: 0, width: 0, height: 10 } },
      { pane_id: "a", rect: { x: 0, y: 0, width: 10, height: 0 } },
      { pane_id: "a", rect: { x: -1, y: 0, width: 80, height: 40 } },
      { pane_id: "a", rect: { x: 0, y: 0, width: 80.5, height: 40 } },
      { pane_id: "a", rect: { x: 0, y: 0, width: "80", height: 40 } },
      { pane_id: "a", rect: { x: 0, y: 0, width: 80 } },
      { pane_id: 7, rect: { x: 0, y: 0, width: 80, height: 40 } },
      { rect: { x: 0, y: 0, width: 80, height: 40 } },
      null, "a", 3,
    ];
    assert.equal(choosePlacement(bad, ["a", 7]), undefined);
    assert.equal(choosePlacement([...bad, lp("a", 0, 0, 80, 40)], ["a"]).pane, "a");
  });

  test("[layout] it does not mutate its inputs", () => {
    const layout = [lp("b", 65, 0, 65, 20), lp("a", 0, 0, 65, 20)];
    const snapshot = JSON.stringify(layout);
    choosePlacement(layout, ["a", "b"]);
    assert.equal(JSON.stringify(layout), snapshot);
  });
});

describe("open: the layout decides where a later pane goes [AC-6, layout]", () => {
  test("[AC-6][layout] the run's first pane goes right of the anchor and no layout is asked for", () => {
    const sb = box().install({ herdr: herdrCalls({ extra: [layoutCall(lp("w1:p1", 0, 0, 400, 200))] }) });
    assert.equal(open(sb, [["1.2", "agent-manager"]]).json.ok, true);
    assert.deepEqual(splitsOf(sb), [["w1:p1", "right"]]);
    assert.deepEqual(calls(sb, "pane layout"), []);
  });

  test("[AC-6][layout] a later pane takes the layout's choice: a wide, short pane is split right, not down (and the huge anchor is left alone)", () => {
    const sb = box().install({ herdr: herdrCalls({ splitIds: ["w1:p3"], panes: [pane(), pane({ pane_id: "w1:p2" })], extra: [layoutCall(lp("w1:p1", 0, 0, 400, 200), lp("w1:p2", 100, 0, 200, 20))] }) });
    seed(sb, "1.2", "agent-manager", "w1:p2");
    const r = open(sb, [["1.3", "sqa-engineer"]]);
    assert.deepEqual(r.json, { ok: true, opened: [{ step: "1.3", agent: "sqa-engineer", pane: "w1:p3" }], skipped: [], warnings: [] });
    assert.deepEqual(splitsOf(sb), [["w1:p2", "right"]]);
  });

  test("[AC-6][layout] a tall pane keeps stacking down", () => {
    const sb = box().install({ herdr: herdrCalls({ splitIds: ["w1:p3"], panes: [pane(), pane({ pane_id: "w1:p2" })], extra: [layoutCall(lp("w1:p1", 0, 0, 65, 40), lp("w1:p2", 65, 0, 65, 40))] }) });
    seed(sb, "1.2", "agent-manager", "w1:p2");
    open(sb, [["1.3", "sqa-engineer"]]);
    assert.deepEqual(splitsOf(sb), [["w1:p2", "down"]]);
  });

  test("[AC-6][layout] the layout is asked about the run's newest live pane, with only --pane", () => {
    const sb = box().install({ herdr: herdrCalls({ splitIds: ["w1:p4"], panes: [pane(), pane({ pane_id: "w1:p2" }), pane({ pane_id: "w1:p3" })], extra: [layoutCall(lp("w1:p1", 0, 0, 65, 40), lp("w1:p2", 65, 0, 65, 10), lp("w1:p3", 65, 10, 65, 30))] }) });
    seed(sb, "1.2", "agent-manager", "w1:p2", "2026-11-14T10:00:00.000Z");
    seed(sb, "1.3", "sqa-engineer", "w1:p3", "2026-11-14T11:00:00.000Z");
    open(sb, [["1.4", "code-reviewer"]]);
    assert.deepEqual(calls(sb, "pane layout"), [["pane", "layout", "--pane", "w1:p3"]]);
    assert.deepEqual(splitsOf(sb), [["w1:p3", "down"]], "p3 (65x30) is the one that splits best");
  });

  test("[AC-6][layout] a pane of the run that is no longer live is not offered to the layout rule", () => {
    // p2 is in the run's state but gone from `pane list`; p3 is live. The layout still lists p2's old rect: it must not be chosen.
    const sb = box().install({ herdr: herdrCalls({ splitIds: ["w1:p4"], panes: [pane(), pane({ pane_id: "w1:p3" })], extra: [layoutCall(lp("w1:p1", 0, 0, 65, 40), lp("w1:p2", 65, 0, 300, 100), lp("w1:p3", 65, 100, 65, 20))] }) });
    seed(sb, "1.2", "agent-manager", "w1:p2", "2026-11-14T10:00:00.000Z");
    seed(sb, "1.3", "sqa-engineer", "w1:p3", "2026-11-14T11:00:00.000Z");
    open(sb, [["1.4", "code-reviewer"]]);
    assert.equal(splitsOf(sb)[0][0], "w1:p3");
  });

  test("[AC-6][layout] a fan-out of 5 pairs in one call: anchor right, then down, down, down the other pane, and a right split once the column is full", () => {
    // Geometry after each split, worked out by hand for a 65x40 run column right of a 65x40 anchor (herdr halves the split pane).
    const L = [
      [lp("w1:p1", 0, 0, 65, 40), lp("w1:p2", 65, 0, 65, 40)],
      [lp("w1:p1", 0, 0, 65, 40), lp("w1:p2", 65, 0, 65, 20), lp("w1:p3", 65, 20, 65, 20)],
      [lp("w1:p1", 0, 0, 65, 40), lp("w1:p2", 65, 0, 65, 10), lp("w1:p4", 65, 10, 65, 10), lp("w1:p3", 65, 20, 65, 20)],
      [lp("w1:p1", 0, 0, 65, 40), lp("w1:p2", 65, 0, 65, 10), lp("w1:p4", 65, 10, 65, 10), lp("w1:p3", 65, 20, 65, 10), lp("w1:p5", 65, 30, 65, 10)],
    ];
    const sb = box().install({ herdr: herdrCalls({ splitIds: ["w1:p2", "w1:p3", "w1:p4", "w1:p5", "w1:p6"], extra: [{ match: ["pane", "layout"], replies: L.map((l) => ({ stdout: layoutJson(...l) })) }] }) });
    const r = open(sb, [["1.4.1", "code-reviewer"], ["1.4.2", "code-reviewer"], ["1.4.3", "code-reviewer"], ["1.4.4", "code-reviewer"], ["1.4.5", "code-reviewer"]]);
    assert.equal(r.json.ok, true);
    assert.deepEqual(r.json.opened.map((o) => o.pane), ["w1:p2", "w1:p3", "w1:p4", "w1:p5", "w1:p6"]);
    assert.deepEqual(splitsOf(sb), [["w1:p1", "right"], ["w1:p2", "down"], ["w1:p2", "down"], ["w1:p3", "down"], ["w1:p2", "right"]]);
    const asked = calls(sb, "pane layout");
    assert.equal(asked.length, 4, "no layout for the first pane, one per later pane");
    for (const a of asked) assert.ok(["w1:p2", "w1:p3", "w1:p4", "w1:p5"].includes(a[3]), `asked about a pane of the run: ${a[3]}`);
    assert.deepEqual(r.json.warnings, ["layout: the new pane gets about 32x10 cells, below 50x10"], "only the fifth pane is below readable");
    assert.equal(calls(sb, "pane close").length, 0);
  });

  test("[AC-6][layout] a short, wide area opens a new column that is readable: no warning", () => {
    const sb = box().install({ herdr: herdrCalls({ splitIds: ["w1:p3"], panes: [pane(), pane({ pane_id: "w1:p2" })], extra: [layoutCall(lp("w1:p1", 0, 0, 100, 20), lp("w1:p2", 100, 0, 200, 20))] }) });
    seed(sb, "1.2", "agent-manager", "w1:p2");
    const r = open(sb, [["1.3", "sqa-engineer"]]);
    assert.deepEqual(r.json.warnings, []);
    assert.deepEqual(splitsOf(sb), [["w1:p2", "right"]]);
  });

  test("[AC-6][layout] below readable: the split is still made and exactly one warning says the size", () => {
    const sb = box().install({ herdr: herdrCalls({ splitIds: ["w1:p3"], panes: [pane(), pane({ pane_id: "w1:p2" })], extra: [layoutCall(lp("w1:p1", 0, 0, 100, 40), lp("w1:p2", 100, 0, 45, 8))] }) });
    seed(sb, "1.2", "agent-manager", "w1:p2");
    const r = open(sb, [["1.3", "sqa-engineer"]]);
    assert.equal(r.status, 0);
    assert.equal(r.json.ok, true, "a small pane never blocks the run");
    assert.deepEqual(r.json.opened, [{ step: "1.3", agent: "sqa-engineer", pane: "w1:p3" }]);
    assert.deepEqual(r.json.warnings, ["layout: the new pane gets about 22x8 cells, below 50x10"]);
    assert.deepEqual(splitsOf(sb), [["w1:p2", "right"]]);
    assert.equal(calls(sb, "pane run").length, 1, "the pane is still labelled and started");
  });
});

describe("open: a layout that cannot be used falls back to the old placement, silently [AC-9, layout]", () => {
  // The old behaviour: split down from the run's newest live pane. A big layout would have chosen "right", so "down" proves the fallback.
  const bigLayout = layoutJson(lp("w1:p1", 0, 0, 65, 40), lp("w1:p2", 65, 0, 400, 20));
  const variants = {
    "exit 1 pane_not_found": { ...notFound },
    "exit 1 with an unknown error": { stdout: JSON.stringify({ error: { code: "internal" } }), status: 1 },
    "non-JSON output": { stdout: "layout?" },
    "empty output": { stdout: "" },
    "JSON without result.layout": { stdout: JSON.stringify({ result: {} }) },
    "result.layout.panes not an array": { stdout: JSON.stringify({ result: { layout: { panes: "x" } } }) },
    "no pane of the run in the layout": { stdout: layoutJson(lp("w1:p1", 0, 0, 65, 40), lp("w9:p9", 65, 0, 400, 20)) },
    "the run's pane has no usable rect": { stdout: layoutJson(lp("w1:p1", 0, 0, 65, 40), { pane_id: "w1:p2", rect: { x: 0, y: 0, width: 0, height: 0 } }) },
  };
  for (const [name, v] of Object.entries(variants)) {
    test(`[AC-9][layout] layout answering ${name}: split down from the newest live pane, ok true, no warning`, () => {
      const sb = box().install({ herdr: herdrCalls({ splitIds: ["w1:p3"], panes: [pane(), pane({ pane_id: "w1:p2" })], extra: [{ match: ["pane", "layout"], ...v }] }) });
      seed(sb, "1.2", "agent-manager", "w1:p2");
      const r = open(sb, [["1.3", "sqa-engineer"]]);
      assert.equal(r.status, 0);
      assert.equal(r.stderr, "");
      assert.deepEqual(r.json, { ok: true, opened: [{ step: "1.3", agent: "sqa-engineer", pane: "w1:p3" }], skipped: [], warnings: [] });
      assert.deepEqual(splitsOf(sb), [["w1:p2", "down"]]);
    });
  }

  test("[AC-9][layout] control: the same fixture with a usable layout does choose right (so the fallback tests above are not vacuous)", () => {
    const sb = box().install({ herdr: herdrCalls({ splitIds: ["w1:p3"], panes: [pane(), pane({ pane_id: "w1:p2" })], extra: [{ match: ["pane", "layout"], stdout: bigLayout }] }) });
    seed(sb, "1.2", "agent-manager", "w1:p2");
    open(sb, [["1.3", "sqa-engineer"]]);
    assert.deepEqual(splitsOf(sb), [["w1:p2", "right"]]);
  });

  test("[AC-9][layout] a herdr that hangs on `pane layout` does not block: ok true within the call timeout, old placement", () => {
    const sb = box().install({ herdr: herdrCalls({ splitIds: ["w1:p3"], panes: [pane(), pane({ pane_id: "w1:p2" })], extra: [{ match: ["pane", "layout"], delayMs: 3000, stdout: bigLayout }] }) });
    seed(sb, "1.2", "agent-manager", "w1:p2");
    const r = open(sb, [["1.3", "sqa-engineer"]], { ...ENV, AI_DLC_HERDR_CALL_TIMEOUT_MS: "300" });
    assert.equal(r.json.ok, true);
    assert.deepEqual(splitsOf(sb), [["w1:p2", "down"]]);
    assert.ok(r.ms < 20000, `took ${r.ms} ms`);
  });
});

describe("open: a vanished target falls back to the anchor [AC-9, layout]", () => {
  test("[AC-9][layout] the layout's chosen pane is gone (split answers pane_not_found): retry once, anchor to the right", () => {
    const split = { match: ["pane", "split"], replies: [{ ...notFound }, { stdout: splitJson("w1:p3") }] };
    const sb = box().install({ herdr: herdrCalls({ panes: [pane(), pane({ pane_id: "w1:p2" })], extra: [split, layoutCall(lp("w1:p1", 0, 0, 65, 40), lp("w1:p2", 65, 0, 400, 20))] }) });
    seed(sb, "1.2", "agent-manager", "w1:p2");
    const r = open(sb, [["1.3", "sqa-engineer"]]);
    assert.deepEqual(r.json, { ok: true, opened: [{ step: "1.3", agent: "sqa-engineer", pane: "w1:p3" }], skipped: [], warnings: [] });
    assert.deepEqual(splitsOf(sb), [["w1:p2", "right"], ["w1:p1", "right"]]);
  });

  test("[AC-9][layout] same with no anchor known (HERDR_ENV=1 only): the retry splits --current to the right", () => {
    const split = { match: ["pane", "split"], replies: [{ ...notFound }, { stdout: splitJson("w1:p3") }] };
    const sb = box().install({ herdr: herdrCalls({ panes: [pane({ pane_id: "w1:p2", cwd: "elsewhere" })], extra: [split, layoutCall(lp("w1:p2", 65, 0, 400, 20))] }) });
    seed(sb, "1.2", "agent-manager", "w1:p2");
    const r = open(sb, [["1.3", "sqa-engineer"]], { HERDR_ENV: "1" });
    assert.equal(r.json.ok, true);
    const splits = calls(sb, "pane split");
    assert.equal(splits.length, 2);
    assert.deepEqual(splits[0].slice(0, 5), ["pane", "split", "w1:p2", "--direction", "right"]);
    assert.deepEqual(splits[1].slice(0, 5), ["pane", "split", "--current", "--direction", "right"]);
  });

  test("[AC-9][layout] a split that fails for another reason is reported ok false and is not retried", () => {
    const sb = box().install({ herdr: herdrCalls({ panes: [pane(), pane({ pane_id: "w1:p2" })], extra: [{ match: ["pane", "split"], stdout: JSON.stringify({ error: { code: "bad" } }), status: 1 }, layoutCall(lp("w1:p2", 65, 0, 65, 40))] }) });
    seed(sb, "1.2", "agent-manager", "w1:p2");
    const r = open(sb, [["1.3", "sqa-engineer"]]);
    assert.equal(r.json.ok, false);
    assert.match(r.json.failed[0].reason, /pane split failed: bad/);
    assert.equal(calls(sb, "pane split").length, 1);
  });
});

describe("open: every pane call keeps working with the layout [AC-2, AC-8, layout]", () => {
  test("[AC-2][AC-8][layout] `pane layout` is the only new command, read-only: nothing is closed and the pane file of the new pane is written", () => {
    const sb = box().install({ herdr: herdrCalls({ splitIds: ["w1:p3"], panes: [pane(), pane({ pane_id: "w1:p2" })], extra: [layoutCall(lp("w1:p1", 0, 0, 65, 40), lp("w1:p2", 65, 0, 65, 40))] }) });
    seed(sb, "1.2", "agent-manager", "w1:p2");
    open(sb, [["1.3", "sqa-engineer"]]);
    assert.deepEqual(calls(sb, "pane close"), []);
    const heads = new Set(sb.herdrArgs().map((a) => a.slice(0, 2).join(" ")));
    assert.deepEqual([...heads].sort(), ["--version", "pane layout", "pane list", "pane rename", "pane run", "pane split", "status server"]);
    assert.equal(JSON.parse(sb.read(paneFile("1.3", "sqa-engineer"))).pane, "w1:p3");
    assert.equal(sb.read(paneFile("1.2", "agent-manager")) !== undefined, true, "the earlier pane's state is untouched");
  });

  test("[AC-6][layout] two parallel `open` calls: no shared state file, both panes opened, both pane files and job files written", async () => {
    const sb = box().install({ herdr: herdrCalls({ splitIds: ["w1:p9"], panes: [pane(), pane({ pane_id: "w1:p2" })], extra: [layoutCall(lp("w1:p1", 0, 0, 65, 40), lp("w1:p2", 65, 0, 400, 20))] }) });
    seed(sb, "1.2", "agent-manager", "w1:p2");
    const run = (step, agent) => new Promise((resolve) => {
      const child = spawn(process.execPath, [HERDR_MJS, "open", "--run", RUN, "--step", step, "--agent", agent, "--root", sb.root], { cwd: sb.root, env: sb.env(ENV) });
      let out = "";
      child.stdout.on("data", (d) => { out += d; });
      child.on("close", (code) => resolve({ code, json: JSON.parse(out.split("\n").filter(Boolean)[0]) }));
    });
    const [a, b] = await Promise.all([run("1.3", "sqa-engineer"), run("1.4", "code-reviewer")]);
    for (const r of [a, b]) { assert.equal(r.code, 0); assert.equal(r.json.ok, true); assert.equal(r.json.opened.length, 1); }
    assert.equal(await until(() => sb.exists(paneFile("1.3", "sqa-engineer")) && sb.exists(paneFile("1.4", "code-reviewer"))), true);
    assert.equal(sb.exists(".scratch/herdr/RUN-1/1.3-sqa-engineer.job.json") && sb.exists(".scratch/herdr/RUN-1/1.4-code-reviewer.job.json"), true);
    assert.equal(calls(sb, "pane split").length, 2);
    assert.equal(sb.exists(paneFile("1.2", "agent-manager")), true);
  });
});

describe("run: run-in-pane panes follow the same placement [AC-10, layout]", () => {
  const RECORD = `${RUN}/1.2-orchestrator-to-agent-manager.handoff.md`;
  const OUT = ".scratch/herdr/RUN-1/1.3-sqa-engineer.result.md";
  const RENV = { ...ENV, AI_DLC_HERDR_MODE: "run-in-pane", AI_DLC_HERDR_POLL_MS: "100" };
  const HANDBACK = "handoff 1.2-orchestrator-to-agent-manager.handoff.md: passed — done\n";
  const runIt = (sb) => sb.cli(["run", "--run", RUN, "--step", "1.3", "--agent", "sqa-engineer", "--record", RECORD, "--out", OUT], { env: RENV });

  test("[AC-10][layout] with a pane of the run already open, the run's pane is split where the layout says (right), not down", () => {
    const sb = box().install({ herdr: herdrCalls({ execRun: true, splitIds: ["w1:p3"], panes: [pane(), pane({ pane_id: "w1:p2" })], extra: [layoutCall(lp("w1:p1", 0, 0, 65, 40), lp("w1:p2", 65, 0, 400, 20))] }), claude: claudeOk({ result: HANDBACK }) });
    sb.write(RECORD, "---\nfrom: orchestrator\n---\n# brief\n");
    seed(sb, "1.2", "agent-manager", "w1:p2");
    const r = runIt(sb);
    assert.equal(r.json.ok, true);
    assert.deepEqual(splitsOf(sb), [["w1:p2", "right"]]);
    assert.deepEqual(calls(sb, "pane layout"), [["pane", "layout", "--pane", "w1:p2"]]);
  });

  test("[AC-10][layout] with no earlier pane the run's pane goes right of the anchor and no layout is asked for", () => {
    const sb = box().install({ herdr: herdrCalls({ execRun: true, splitIds: ["w1:p3"], extra: [layoutCall(lp("w1:p1", 0, 0, 400, 200))] }), claude: claudeOk({ result: HANDBACK }) });
    sb.write(RECORD, "---\nfrom: orchestrator\n---\n# brief\n");
    const r = runIt(sb);
    assert.equal(r.json.ok, true);
    assert.deepEqual(splitsOf(sb), [["w1:p1", "right"]]);
    assert.deepEqual(calls(sb, "pane layout"), []);
  });

  test("[AC-10][AC-9][layout] a failing layout does not stop run: the old placement (down) is used and the hand-back is still delivered", () => {
    const sb = box().install({ herdr: herdrCalls({ execRun: true, splitIds: ["w1:p3"], panes: [pane(), pane({ pane_id: "w1:p2" })], extra: [{ match: ["pane", "layout"], stdout: "garbage", status: 1 }] }), claude: claudeOk({ result: HANDBACK }) });
    sb.write(RECORD, "---\nfrom: orchestrator\n---\n# brief\n");
    seed(sb, "1.2", "agent-manager", "w1:p2");
    const r = runIt(sb);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.handoffLine, true);
    assert.deepEqual(splitsOf(sb), [["w1:p2", "down"]]);
  });
});
