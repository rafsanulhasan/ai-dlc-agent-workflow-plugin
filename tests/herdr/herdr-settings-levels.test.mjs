// herdr.mjs settings, the amended ACs AC-16 to AC-23 (1.1.3.l1): validate checks every level (AC-21), --timeout is at most 720 (AC-17),
// each mode value is read back by show (AC-16), the schema validates the shipped default file (AC-23), the skill documents the settings
// (AC-22). The rest of AC-16 to AC-20 is covered by herdr-settings.test.mjs (tagged AC-5 there; see the hand-back's traceability table).
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { sandbox, REPO, SCHEMA } from "./helpers/fake-bin.mjs";
import { loadSchema, merged, validateDoc } from "../../plugins/claude/ai-dlc/skills/herdr/scripts/herdr.mjs";

const boxes = [];
const box = () => { const sb = sandbox("levels"); boxes.push(sb); return sb; };
afterEach(() => { while (boxes.length) boxes.pop().cleanup(); });
const errors = (r) => r.stdout.split("\n").filter((l) => l.startsWith("error:"));

describe("validate checks the file and every settings level [AC-21]", () => {
  test("[AC-21] nothing invalid anywhere: exit 0", () => {
    const sb = box();
    sb.write(".ai-dlc/herdr.json", JSON.stringify({ mode: "off", runTimeoutMinutes: 5 }));
    sb.write(".claude/settings.json", JSON.stringify({ env: { AI_DLC_HERDR_MODE: "watch" } }));
    const r = sb.cli(["validate"], { env: { AI_DLC_HERDR_RUN_TIMEOUT_MINUTES: "30" } });
    assert.equal(r.status, 0);
    assert.deepEqual(errors(r), []);
    assert.match(r.stdout, /herdr\.json is valid/);
  });

  const levels = {
    "the process environment": { env: { AI_DLC_HERDR_MODE: "bogus" }, name: /AI_DLC_HERDR_MODE="bogus" in the environment/ },
    "the env of .claude/settings.json": { files: { ".claude/settings.json": { env: { AI_DLC_HERDR_MODE: "nope" } } }, name: /AI_DLC_HERDR_MODE="nope" in \.claude\/settings\.json/ },
    "the env of .claude/settings.local.json": { files: { ".claude/settings.local.json": { env: { AI_DLC_HERDR_RUN_TIMEOUT_MINUTES: "0" } } }, name: /AI_DLC_HERDR_RUN_TIMEOUT_MINUTES="0" in \.claude\/settings\.local\.json/ },
    "the timeout above 720 in the environment": { env: { AI_DLC_HERDR_RUN_TIMEOUT_MINUTES: "721" }, name: /AI_DLC_HERDR_RUN_TIMEOUT_MINUTES="721" in the environment/ },
  };
  for (const [level, c] of Object.entries(levels)) {
    test(`[AC-21] an invalid value in ${level} is an error and exit 1 (show only warns)`, () => {
      const sb = box();
      for (const [f, doc] of Object.entries(c.files ?? {})) sb.write(f, JSON.stringify(doc));
      const v = sb.cli(["validate"], { env: c.env });
      assert.equal(v.status, 1);
      assert.equal(errors(v).length, 1, v.stdout);
      assert.match(errors(v)[0], c.name);
      const s = sb.cli(["show"], { env: c.env });
      assert.equal(s.status, 0, "reading settings never blocks");
      assert.match(s.stdout, /warning: /);
    });
  }

  test("[AC-21] one message per invalid value: the file and two levels give three errors, none twice", () => {
    const sb = box();
    sb.write(".ai-dlc/herdr.json", JSON.stringify({ mode: "bogus" }));
    sb.write(".claude/settings.local.json", JSON.stringify({ env: { AI_DLC_HERDR_RUN_TIMEOUT_MINUTES: "-3" } }));
    const r = sb.cli(["validate"], { env: { AI_DLC_HERDR_MODE: "wrong" } });
    assert.equal(r.status, 1);
    const e = errors(r);
    assert.equal(e.length, 3, r.stdout);
    assert.equal(new Set(e).size, 3);
    assert.ok(e.some((l) => /mode: "bogus" is not one of/.test(l)));
    assert.ok(e.some((l) => /AI_DLC_HERDR_MODE="wrong" in the environment/.test(l)));
    assert.ok(e.some((l) => /AI_DLC_HERDR_RUN_TIMEOUT_MINUTES="-3"/.test(l)));
  });

  test("[AC-21] a valid level above an invalid one does not hide it: the broken file is still an error", () => {
    const sb = box();
    sb.write(".ai-dlc/herdr.json", JSON.stringify({ mode: "bogus" }));
    const r = sb.cli(["validate"], { env: { AI_DLC_HERDR_MODE: "off" } });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /mode: "bogus"/);
  });

  test("[AC-21] a broken .claude/settings.json is skipped without a crash", () => {
    const sb = box();
    sb.write(".claude/settings.json", "{ nope");
    const r = sb.cli(["validate"]);
    assert.ok(r.status === 0 || r.status === 1);
    assert.equal(r.stderr, "");
    assert.doesNotMatch(r.stdout, /internal|TypeError/);
  });
});

describe("AC-16 and AC-17 values and limits", () => {
  const row = (r, key) => JSON.parse(r.stdout).settings.find((s) => s.key === key);

  test("[AC-16] each of watch, run-in-pane, off is read back by show --json from the variable and from the repository file", () => {
    for (const mode of ["watch", "run-in-pane", "off"]) {
      const sb = box();
      assert.equal(row(sb.cli(["show", "--json"], { env: { AI_DLC_HERDR_MODE: mode } }), "mode").value, mode);
      sb.write(".ai-dlc/herdr.json", JSON.stringify({ mode }));
      const viaFile = row(sb.cli(["show", "--json"]), "mode");
      assert.equal(viaFile.value, mode);
      assert.match(viaFile.source, /mode in \.ai-dlc\/herdr\.json/);
    }
  });

  test("[AC-17] show --json: a timeout above 720 is a warning and the default 60 applies; 720 itself is accepted", () => {
    const sb = box();
    const bad = sb.cli(["show", "--json"], { env: { AI_DLC_HERDR_RUN_TIMEOUT_MINUTES: "721" } });
    assert.equal(row(bad, "runTimeoutMinutes").value, 60);
    assert.equal(JSON.parse(bad.stdout).warnings.length, 1);
    const ok = sb.cli(["show", "--json"], { env: { AI_DLC_HERDR_RUN_TIMEOUT_MINUTES: "720" } });
    assert.equal(row(ok, "runTimeoutMinutes").value, 720);
    assert.deepEqual(JSON.parse(ok.stdout).warnings, []);
  });

  test("[AC-17] set rejects a timeout above 720, 0 and a negative with exit 1 and writes nothing; 720 is written", () => {
    for (const v of ["721", "0", "-5"]) {
      const sb = box();
      assert.equal(sb.cli(["set", `runTimeoutMinutes=${v}`]).status, 1, v);
      assert.equal(fs.existsSync(path.join(sb.root, ".ai-dlc", "herdr.json")), false, v);
    }
    const sb = box();
    assert.equal(sb.cli(["set", "runTimeoutMinutes=720"]).status, 0);
    assert.equal(JSON.parse(fs.readFileSync(path.join(sb.root, ".ai-dlc", "herdr.json"), "utf8")).runTimeoutMinutes, 720);
  });
});

describe("run --timeout: minutes above 0, at most 720 [AC-17]", () => {
  const RUN = "docs/handoffs/RUN-1";
  const args = (t) => ["run", "--run", RUN, "--step", "1.2", "--agent", "agent-manager", "--record", `${RUN}/1.2-x.handoff.md`, "--out", ".scratch/herdr/RUN-1/1.2-a.result.md", "--timeout", t];

  for (const t of ["721", "720.5", "1000", "0", "-1", "abc", "1e3"]) {
    test(`[AC-17] --timeout ${JSON.stringify(t)} is a usage error: exit 2, ok false`, () => {
      const sb = box();
      sb.write(`${RUN}/1.2-x.handoff.md`, "x");
      const r = sb.cli(args(t));
      assert.equal(r.status, 2);
      assert.equal(r.json.ok, false);
      assert.match(r.json.reason, /^usage: /);
    });
  }

  for (const t of ["720", "0.5", "7"]) {
    test(`[AC-17] --timeout ${t} passes the check (the run then stops at launch: not inside herdr)`, () => {
      const sb = box();
      sb.write(`${RUN}/1.2-x.handoff.md`, "x");
      const r = sb.cli(args(t));
      assert.equal(r.status, 0);
      assert.equal(r.json.ok, false);
      assert.equal(r.json.stage, "launch");
    });
  }
});

describe("AC-22 and AC-23: the schema and the skill", () => {
  test("[AC-23] the file merge writes validates against the schema's own keys: no errors, every key null", () => {
    const { keys } = loadSchema();
    const doc = JSON.parse(merged(undefined, keys).text);
    assert.deepEqual(validateDoc(doc, keys), []);
    assert.deepEqual(keys.map((k) => doc[k.key]), [null, null]);
  });

  test("[AC-23] the shipped schema pins what the script enforces: mode enum with null, timeout exclusive minimum 0, maximum 720, defaults watch and 60, no extra keys", () => {
    const s = JSON.parse(fs.readFileSync(SCHEMA, "utf8"));
    assert.deepEqual(s.properties.mode.enum, ["watch", "run-in-pane", "off", null]);
    assert.equal(s.properties.mode.default, "watch");
    assert.equal(s.properties.runTimeoutMinutes.exclusiveMinimum, 0);
    assert.equal(s.properties.runTimeoutMinutes.maximum, 720);
    assert.equal(s.properties.runTimeoutMinutes.default, 60);
    assert.equal(s.additionalProperties, false);
  });

  test("[AC-22] the skill names the keys, their variables, the four commands, and where a personal choice and the team's belong", () => {
    const md = fs.readFileSync(path.join(REPO, "plugins", "claude", "ai-dlc", "skills", "herdr", "SKILL.md"), "utf8");
    for (const needle of ["AI_DLC_HERDR_MODE", "AI_DLC_HERDR_RUN_TIMEOUT_MINUTES", "runTimeoutMinutes", "run-in-pane", "settings.local.json", ".ai-dlc/herdr.json", "show", "merge", "set", "validate"]) {
      assert.ok(md.includes(needle), `SKILL.md does not mention ${needle}`);
    }
  });
});
