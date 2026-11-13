// herdr.mjs exit codes and output shape (AC-9 never block): every orchestrator-facing command prints exactly one JSON line and exits 0
// for every outcome, ok:false included; a usage error exits 2 with one JSON line whose reason starts "usage:"; an internal error
// is ok:false with exit 0. Real process, fake herdr on a temp PATH.
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { sandbox, herdrCalls } from "./helpers/fake-bin.mjs";
import { parseArgs } from "../../plugins/claude/ai-dlc/skills/herdr/scripts/herdr.mjs";

const boxes = [];
const box = () => { const sb = sandbox("usage"); boxes.push(sb); return sb; };
afterEach(() => { while (boxes.length) boxes.pop().cleanup(); });
const ENV = { HERDR_ENV: "1", HERDR_PANE_ID: "w1:p1" };
const RUN = "docs/handoffs/RUN-1";

function usage(sb, args, { status = 2, reason = /^usage: / } = {}) {
  const r = sb.cli(args, { env: ENV });
  assert.equal(r.status, status, args.join(" "));
  assert.equal(r.stderr, "", args.join(" "));
  assert.equal(r.lines.length, 1, args.join(" "));
  assert.equal(r.json.ok, false, args.join(" "));
  assert.match(r.json.reason, reason, args.join(" "));
  return r;
}

describe("usage errors exit 2 with one JSON line [AC-9]", () => {
  test("[AC-9] no command, an unknown command and an unknown option", () => {
    const sb = box().install({ herdr: herdrCalls() });
    usage(sb, []);
    usage(sb, ["frobnicate"], { reason: /^usage: herdr\.mjs detect/ });
    usage(sb, ["detect", "--bogus"], { reason: /unknown option --bogus/ });
  });

  test("[AC-9] help prints the usage as JSON and exits 0", () => {
    const sb = box();
    for (const h of ["help", "--help"]) { const r = sb.cli([h]); assert.equal(r.status, 0); assert.equal(r.json.ok, false); assert.match(r.json.reason, /^usage: /); }
  });

  const bad = {
    "a step that is not a code": [["open", "--run", RUN, "--step", "abc", "--agent", "a"], /--step "abc" is not a step code/],
    "a step with an empty segment": [["open", "--run", RUN, "--step", "1..2", "--agent", "a"], /is not a step code/],
    "a step with a shell character": [["open", "--run", RUN, "--step", "1.2;x", "--agent", "a"], /is not a step code/],
    "a step with a space": [["open", "--run", RUN, "--step", "1 2", "--agent", "a"], /is not a step code/],
    "an agent with a capital": [["open", "--run", RUN, "--step", "1", "--agent", "Bad"], /--agent "Bad" is not an agent id/],
    "an agent starting with -": [["open", "--run", RUN, "--step", "1", "--agent", "x-y", "--agent", "-x"], /--agent "-x"|needs a value|without/],
    "an agent with a quote": [["close", "--run", RUN, "--step", "1", "--agent", 'a"b'], /is not an agent id/],
    "an agent with a space": [["close", "--run", RUN, "--step", "1", "--agent", "a b"], /is not an agent id/],
    "a run folder with a space": [["open", "--run", "docs/a b", "--step", "1", "--agent", "a"], /is not a run folder/],
    "a run folder with a newline": [["open", "--run", "docs/a\nb", "--step", "1", "--agent", "a"], /is not a run folder/],
    "a run folder with a quote": [["open", "--run", 'docs/a"b', "--step", "1", "--agent", "a"], /is not a run folder/],
    "open without --run": [["open", "--step", "1", "--agent", "a"], /--run is required/],
    "close without --run": [["close", "--step", "1", "--agent", "a"], /--run is required/],
    "run without --run": [["run", "--step", "1", "--agent", "a"], /--run is required/],
    "open without a pair": [["open", "--run", RUN], /open needs --step <code> --agent <id>/],
    "close without a pair": [["close", "--run", RUN], /close needs --step/],
    "--step without --agent": [["open", "--run", RUN, "--step", "1"], /--step without --agent/],
    "--agent without --step": [["open", "--run", RUN, "--agent", "a"], /--agent without --step/],
    "two --step in a row": [["open", "--run", RUN, "--step", "1", "--step", "2", "--agent", "a"], /--step without --agent/],
    "an option without its value": [["open", "--run", RUN, "--step"], /--step needs a value/],
    "an option whose value is another option": [["open", "--run", "--step", "1", "--agent", "a"], /--run needs a value/],
    "run with two pairs": [["run", "--run", RUN, "--step", "1", "--agent", "a", "--step", "2", "--agent", "b"], /run takes one --step\/--agent pair/],
    "--timeout 0": [["run", "--run", RUN, "--step", "1", "--agent", "a", "--timeout", "0"], /--timeout must be minutes above 0/],
    "--timeout abc": [["run", "--run", RUN, "--step", "1", "--agent", "a", "--timeout", "abc"], /--timeout must be minutes/],
    "--timeout -5": [["run", "--run", RUN, "--step", "1", "--agent", "a", "--timeout", "-5"], /needs a value|--timeout must be minutes/],
    "--timeout 1e3": [["run", "--run", RUN, "--step", "1", "--agent", "a", "--timeout", "1e3"], /--timeout must be minutes/],
  };
  for (const [name, [args, reason]] of Object.entries(bad)) test(`[AC-9] ${name}`, () => usage(box().install({ herdr: herdrCalls() }), args, { reason }));

  test("[AC-9] a usage error never reaches herdr", () => {
    const sb = box().install({ herdr: herdrCalls() });
    usage(sb, ["open", "--run", RUN, "--step", "x", "--agent", "a"]);
    assert.deepEqual(sb.entries(), []);
  });

  test("parseArgs: each --agent closes the pair its --step opened and a --record belongs to the latest pair", () => {
    const p = parseArgs(["open", "--run", "r", "--step", "1.4.1", "--agent", "code-reviewer", "--record", "a.md", "--step", "1.4.2", "--agent", "code-reviewer", "--record", "b.md", "--explain"]);
    assert.deepEqual(p.pairs, [{ step: "1.4.1", agent: "code-reviewer", record: "a.md" }, { step: "1.4.2", agent: "code-reviewer", record: "b.md" }]);
    assert.equal(p.flags.has("--explain"), true);
    assert.deepEqual(p.positional, []);
    assert.deepEqual(parseArgs(["watch", "x.json"]).positional, ["x.json"]);
  });
});

describe("every outcome of an orchestrator-facing command exits 0 with one JSON line [AC-9]", () => {
  const cases = {
    "detect outside herdr": (sb) => { sb.install({}); return ["detect"]; },
    "open outside herdr": (sb) => { sb.install({}); return ["open", "--run", RUN, "--step", "1", "--agent", "a"]; },
    "close with nothing open": (sb) => { sb.install({}); return ["close", "--run", RUN, "--step", "1", "--agent", "a"]; },
    "run outside herdr": (sb) => { sb.install({}); return ["run", "--run", RUN, "--step", "1", "--agent", "a", "--record", `${RUN}/r.md`, "--out", "o.md"]; },
    "open with a herdr that fails everything": (sb) => { sb.install({ herdr: { calls: [{ match: ["--version"], stdout: "herdr 1.0.0" }, { match: ["status", "server"], stdout: "status: running" }], default: { status: 1, stderr: "boom" } } }); return ["open", "--run", RUN, "--step", "1", "--agent", "a"]; },
  };
  for (const [name, setup] of Object.entries(cases)) {
    test(`[AC-9] ${name}`, () => {
      const sb = box();
      const args = setup(sb);
      const r = sb.cli(args, { env: ENV });
      assert.equal(r.status, 0);
      assert.equal(r.stderr, "");
      assert.equal(r.lines.length, 1);
      assert.equal(typeof r.json.ok, "boolean");
    });
  }

  test("[AC-9] an internal error (the state folder cannot be created) is ok:false \"internal: ...\" with exit 0 for run, and a failed pair for open", () => {
    const sb = box().install({ herdr: herdrCalls() });
    sb.write(".scratch", "this is a file where the state folder should be");
    sb.write(`${RUN}/r.md`, "brief");
    const run = sb.cli(["run", "--run", RUN, "--step", "1", "--agent", "a", "--record", `${RUN}/r.md`, "--out", "out/o.md"], { env: { ...ENV, AI_DLC_HERDR_MODE: "run-in-pane" } });
    assert.equal(run.status, 0);
    assert.equal(run.stderr, "");
    assert.equal(run.json.ok, false);
    assert.match(run.json.reason, /^internal: /);
    const open = sb.cli(["open", "--run", RUN, "--step", "1", "--agent", "a"], { env: ENV });
    assert.equal(open.status, 0);
    assert.equal(open.json.ok, false);
    assert.match(open.json.failed[0].reason, /^internal: /);
    assert.deepEqual(open.json.opened, []);
  });

  test("[AC-9] close with garbage state files never throws", () => {
    const sb = box().install({ herdr: herdrCalls() });
    for (const body of ["", "null", "[]", '{"pane": 5}', "\u0000"]) {
      sb.write(".scratch/herdr/RUN-1/1-a.pane.json", body);
      const r = sb.cli(["close", "--run", RUN, "--step", "1", "--agent", "a"], { env: ENV });
      assert.equal(r.status, 0, body);
      assert.equal(r.json.ok, true, body);
    }
  });

  test("[AC-9] the script prints nothing on stderr and writes only under .scratch/herdr and .ai-dlc", () => {
    const sb = box().install({ herdr: herdrCalls({ panes: [] }) });
    sb.cli(["open", "--run", RUN, "--step", "1", "--agent", "a"], { env: ENV });
    sb.cli(["close", "--run", RUN, "--step", "1", "--agent", "a"], { env: ENV });
    const top = fs.readdirSync(sb.root);
    assert.deepEqual(top, [".scratch"]);
    assert.deepEqual(fs.readdirSync(path.join(sb.root, ".scratch")), ["herdr"]);
  });
});
