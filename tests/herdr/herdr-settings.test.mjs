// herdr.mjs settings (AC-5 a setting chooses watch / run-in-pane, default watch, and `off`): the five levels, invalid values, and the
// show / merge / set / validate commands in the format of auto-handoff.mjs. Pure functions run in process; the commands run as processes
// in temp repositories. Run from the repository root: node --test "tests/**/*.test.mjs".
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { sandbox, SCHEMA } from "./helpers/fake-bin.mjs";
import { readSettings, effective, loadSchema, checkValue, validateDoc, merged, parseAssignment } from "../../plugins/claude/ai-dlc/skills/herdr/scripts/herdr.mjs";

const boxes = [];
const box = () => { const sb = sandbox("settings"); boxes.push(sb); return sb; };
afterEach(() => { while (boxes.length) boxes.pop().cleanup(); });
const { keys } = loadSchema();
const key = (k) => keys.find((p) => p.key === k);

describe("the schema and readSettings agree [AC-5]", () => {
  test("[AC-5] every schema key has a default, an x-env variable and a type; the keys are mode and runTimeoutMinutes", () => {
    assert.deepEqual(keys.map((k) => k.key), ["mode", "runTimeoutMinutes"]);
    for (const k of keys) { assert.ok(k.default !== undefined, k.key); assert.match(k["x-env"], /^AI_DLC_HERDR_[A-Z_]+$/, k.key); assert.ok(k.type, k.key); }
    assert.equal(JSON.parse(fs.readFileSync(SCHEMA, "utf8")).additionalProperties, false);
  });

  test("[AC-5] the defaults: mode watch, timeout 60, both from the default source", () => {
    const sb = box();
    const s = readSettings(sb.root, {});
    assert.deepEqual(s, { mode: "watch", runTimeoutMinutes: 60, sources: { mode: "default", runTimeoutMinutes: "default" }, warnings: [] });
    for (const row of effective(sb.root, keys, {}).rows) assert.equal(row.value, key(row.key).default, row.key);
  });

  test("[AC-5] every schema key is read from its x-env variable, and readSettings reports a value for each key", () => {
    const sb = box();
    const sample = { mode: "run-in-pane", runTimeoutMinutes: "90" };
    const env = Object.fromEntries(keys.map((k) => [k["x-env"], sample[k.key]]));
    const { rows } = effective(sb.root, keys, env);
    assert.deepEqual(rows.map((r) => [r.key, r.value]), [["mode", "run-in-pane"], ["runTimeoutMinutes", 90]]);
    const s = readSettings(sb.root, env);
    for (const k of keys) assert.ok(k.key in s, `readSettings omits ${k.key}`);
  });

  test("[AC-5] mode accepts watch, run-in-pane and off (the third value), and nothing else", () => {
    const p = key("mode");
    for (const v of ["watch", "run-in-pane", "off", " off "]) assert.equal(checkValue(p, v, true).value, v.trim(), v);
    for (const v of ["", "on", "Watch", "run_in_pane", 1, true, {}]) assert.ok(checkValue(p, v, false).error || checkValue(p, v, false).unset, String(v));
    assert.deepEqual(checkValue(p, null, false), { unset: true });
    assert.deepEqual(checkValue(p, "  ", true), { unset: true }, "blank in an environment means unset");
  });

  test("[AC-5] runTimeoutMinutes: above 0, at most 720, numbers or numeric text", () => {
    const p = key("runTimeoutMinutes");
    assert.equal(checkValue(p, 0.5, false).value, 0.5);
    assert.equal(checkValue(p, "30", true).value, 30);
    assert.equal(checkValue(p, 720, false).value, 720);
    for (const v of [0, -1, 721, "abc", "1e3", "", NaN, Infinity, true, [], "0"]) assert.ok(checkValue(p, v, false).error, String(v));
  });
});

describe("precedence: env of settings.local.json > env of settings.json > the environment > .ai-dlc/herdr.json > default [AC-5]", () => {
  const T = "runTimeoutMinutes", ENVVAR = "AI_DLC_HERDR_RUN_TIMEOUT_MINUTES";
  function layers(sb, on) {
    if (on.local) sb.write(".claude/settings.local.json", `{ // personal\n "env": { "${ENVVAR}": "11" } }`);
    if (on.shared) sb.write(".claude/settings.json", `{ /* shared */ "env": { "${ENVVAR}": "22" } }`);
    if (on.file) sb.write(".ai-dlc/herdr.json", JSON.stringify({ [T]: 44 }));
    return on.env ? { [ENVVAR]: "33" } : {};
  }
  const cases = [
    [{ local: 1, shared: 1, env: 1, file: 1 }, 11, `${ENVVAR} in .claude/settings.local.json`],
    [{ shared: 1, env: 1, file: 1 }, 22, `${ENVVAR} in .claude/settings.json`],
    [{ env: 1, file: 1 }, 33, `${ENVVAR} in the environment`],
    [{ file: 1 }, 44, `${T} in .ai-dlc/herdr.json`],
    [{}, 60, "default"],
  ];
  for (const [on, value, source] of cases) {
    test(`[AC-5] ${Object.keys(on).join(" + ") || "nothing set"} gives ${value} from ${source}`, () => {
      const sb = box();
      const env = layers(sb, on);
      const s = readSettings(sb.root, env);
      assert.equal(s.runTimeoutMinutes, value);
      assert.equal(s.sources.runTimeoutMinutes, source);
      assert.deepEqual(s.warnings, []);
    });
  }

  test("[AC-5] mode: the personal level beats the repository file, comments in the settings files are allowed", () => {
    const sb = box();
    sb.write(".ai-dlc/herdr.json", JSON.stringify({ mode: "run-in-pane" }));
    assert.equal(readSettings(sb.root, {}).mode, "run-in-pane");
    sb.write(".claude/settings.local.json", '{ "env": { "AI_DLC_HERDR_MODE": "off" } // no panes for me\n}');
    const s = readSettings(sb.root, {});
    assert.equal(s.mode, "off");
    assert.equal(s.sources.mode, "AI_DLC_HERDR_MODE in .claude/settings.local.json");
  });

  test("[AC-5] a null in the repository file, and a blank environment value, are unset: the next level applies", () => {
    const sb = box();
    sb.write(".ai-dlc/herdr.json", JSON.stringify({ mode: null, runTimeoutMinutes: null }));
    assert.deepEqual(readSettings(sb.root, { AI_DLC_HERDR_MODE: "  " }).sources, { mode: "default", runTimeoutMinutes: "default" });
  });
});

describe("an invalid value is reported and the next level applies; readSettings never throws [AC-5, AC-9]", () => {
  test("[AC-5] an invalid mode at the top level warns and the next valid level wins", () => {
    const sb = box();
    sb.write(".claude/settings.local.json", JSON.stringify({ env: { AI_DLC_HERDR_MODE: "bogus" } }));
    sb.write(".ai-dlc/herdr.json", JSON.stringify({ mode: "run-in-pane" }));
    const s = readSettings(sb.root, {});
    assert.equal(s.mode, "run-in-pane");
    assert.equal(s.warnings.length, 1);
    assert.match(s.warnings[0], /AI_DLC_HERDR_MODE="bogus" in \.claude\/settings\.local\.json ignored: not one of watch, run-in-pane, off; falling back to the next source/);
  });

  for (const bad of ["0", "-5", "abc", "721", "1e2"]) {
    test(`[AC-5] runTimeoutMinutes=${bad} in the environment warns and the default applies`, () => {
      const sb = box();
      const s = readSettings(sb.root, { AI_DLC_HERDR_RUN_TIMEOUT_MINUTES: bad });
      assert.equal(s.runTimeoutMinutes, 60);
      assert.equal(s.warnings.length, 1);
    });
  }

  test("[AC-9] broken settings files warn and are skipped; a non-object top level, and an env that is not an object, are skipped too", () => {
    const sb = box();
    sb.write(".claude/settings.local.json", "{ nope");
    sb.write(".claude/settings.json", "[]");
    sb.write(".ai-dlc/herdr.json", "oops");
    const s = readSettings(sb.root, {});
    assert.equal(s.mode, "watch");
    assert.equal(s.warnings.length, 3);
    sb.write(".claude/settings.json", '{ "env": 7 }');
    assert.equal(readSettings(sb.root, {}).warnings.some((w) => /env is not an object/.test(w)), true);
  });

  test("[AC-9] a settings path that is a directory, or a root that does not exist, does not throw", () => {
    const sb = box();
    fs.mkdirSync(path.join(sb.root, ".claude", "settings.json"), { recursive: true });
    assert.equal(readSettings(sb.root, {}).mode, "watch");
    assert.equal(readSettings(path.join(sb.root, "nowhere"), {}).mode, "watch");
  });
});

describe("pure settings helpers", () => {
  test("merged: every schema key in schema order, values kept, new keys null, unknown keys removed and reported", () => {
    const m = merged({ runTimeoutMinutes: 5, extra: 1, $schema: "old" }, keys);
    assert.deepEqual(JSON.parse(m.text), { $schema: "./herdr.schema.json", mode: null, runTimeoutMinutes: 5 });
    assert.deepEqual(m.added, ["mode"]);
    assert.deepEqual(m.removed, ["extra"]);
    assert.ok(m.text.endsWith("\n"));
    assert.deepEqual(merged(null, keys).added, [], "a new file reports no additions, only creation");
  });

  test("validateDoc: unknown keys and invalid values are errors, null is fine, $schema must be text", () => {
    assert.deepEqual(validateDoc({ $schema: "./x", mode: "off", runTimeoutMinutes: null }, keys), []);
    assert.deepEqual(validateDoc({ mode: "bogus", runTimeoutMinutes: 0, nope: 1, $schema: 3 }, keys), ['mode: "bogus" is not one of watch, run-in-pane, off', "runTimeoutMinutes: 0 is not above 0", "nope: not a setting (run merge to remove it)", "$schema: not text"]);
  });

  test("parseAssignment: JSON when it parses, else the text as typed; no = is an error", () => {
    assert.deepEqual(parseAssignment("runTimeoutMinutes=30"), { key: "runTimeoutMinutes", value: 30 });
    assert.deepEqual(parseAssignment("mode=null"), { key: "mode", value: null });
    assert.deepEqual(parseAssignment("mode=run-in-pane"), { key: "mode", value: "run-in-pane" });
    assert.deepEqual(parseAssignment('mode="off"'), { key: "mode", value: "off" });
    assert.throws(() => parseAssignment("mode"), /expected <key>=<value>/);
    assert.throws(() => parseAssignment("=x"), /expected <key>=<value>/);
  });
});

describe("the settings commands [AC-5]", () => {
  const file = (sb) => path.join(sb.root, ".ai-dlc", "herdr.json");
  const text = (sb) => fs.readFileSync(file(sb), "utf8");

  test("[AC-5] show prints the table with defaults and sources; show --json prints the rows and warnings", () => {
    const sb = box();
    const r = sb.cli(["show"]);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "| Key | Value | Source |\n|---|---|---|\n| `mode` | `\"watch\"` | default |\n| `runTimeoutMinutes` | `60` | default |\n");
    const j = JSON.parse(sb.cli(["show", "--json"]).stdout);
    assert.deepEqual(j.settings.map((s) => [s.key, s.value, s.source]), [["mode", "watch", "default"], ["runTimeoutMinutes", 60, "default"]]);
    assert.deepEqual(j.warnings, []);
  });

  test("[AC-5] show reflects the environment and warns about an invalid value", () => {
    const sb = box();
    const r = sb.cli(["show"], { env: { AI_DLC_HERDR_MODE: "off", AI_DLC_HERDR_RUN_TIMEOUT_MINUTES: "x" } });
    assert.match(r.stdout, /\| `mode` \| `"off"` \| AI_DLC_HERDR_MODE in the environment \|/);
    assert.match(r.stdout, /warning: AI_DLC_HERDR_RUN_TIMEOUT_MINUTES="x" in the environment ignored: not a number/);
  });

  test("[AC-5] set mode=run-in-pane creates the file with every key; set mode=null unsets it", () => {
    const sb = box();
    const r = sb.cli(["set", "mode=run-in-pane"]);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, 'mode: null -> "run-in-pane"\n');
    assert.deepEqual(JSON.parse(text(sb)), { $schema: "./herdr.schema.json", mode: "run-in-pane", runTimeoutMinutes: null });
    assert.equal(sb.cli(["set", "mode=null"]).status, 0);
    assert.equal(JSON.parse(text(sb)).mode, null);
    assert.equal(sb.cli(["set", "runTimeoutMinutes=45", "mode=off"]).status, 0);
    assert.deepEqual(JSON.parse(text(sb)), { $schema: "./herdr.schema.json", mode: "off", runTimeoutMinutes: 45 });
  });

  test("[AC-5] set rejects invalid values and unknown keys with exit 1, writing nothing, even when another assignment is valid", () => {
    const sb = box();
    for (const arg of ["runTimeoutMinutes=0", "runTimeoutMinutes=721", "mode=bogus", "bogus=1", "runTimeoutMinutes=abc"]) {
      const r = sb.cli(["set", arg, "mode=off"]);
      assert.equal(r.status, 1, arg);
      assert.match(r.stdout, /^(.*\n)*error: /, arg);
      assert.equal(fs.existsSync(file(sb)), false, `${arg} wrote a file`);
    }
    assert.match(sb.cli(["set", "runTimeoutMinutes=0"]).stdout, /error: runTimeoutMinutes: 0 is not above 0/);
    assert.match(sb.cli(["set", "bogus=1"]).stdout, /error: bogus: not a setting/);
    assert.match(sb.cli(["set", "novalue"]).stdout, /error: expected <key>=<value>/);
  });

  test("[AC-5] set with no assignment exits 2; set on an invalid file exits 1 and leaves it", () => {
    const sb = box();
    assert.equal(sb.cli(["set"]).status, 2);
    fs.mkdirSync(path.dirname(file(sb)), { recursive: true });
    fs.writeFileSync(file(sb), "{ broken");
    const r = sb.cli(["set", "mode=off"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /not valid JSON/);
    assert.equal(text(sb), "{ broken");
  });

  test("[AC-5] --dry-run prints the change and writes nothing", () => {
    const sb = box();
    const r = sb.cli(["set", "mode=off", "--dry-run"]);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, 'mode: null -> "off"\n');
    assert.equal(fs.existsSync(file(sb)), false);
    const m = sb.cli(["merge", "--dry-run"]);
    assert.match(m.stdout, /create \.ai-dlc\/herdr\.json with every key unset \(null\)/);
    assert.match(m.stdout, /create \.ai-dlc\/herdr\.schema\.json/);
    assert.equal(fs.existsSync(path.join(sb.root, ".ai-dlc")), false);
  });

  test("[AC-5] merge creates the file with every key null and copies the schema; a second merge is up to date", () => {
    const sb = box();
    assert.equal(sb.cli(["merge"]).status, 0);
    assert.deepEqual(JSON.parse(text(sb)), { $schema: "./herdr.schema.json", mode: null, runTimeoutMinutes: null });
    assert.equal(fs.readFileSync(path.join(sb.root, ".ai-dlc", "herdr.schema.json"), "utf8"), fs.readFileSync(SCHEMA, "utf8"));
    assert.equal(sb.cli(["merge"]).stdout, "up to date\n");
  });

  test("[AC-5] merge keeps values, adds missing keys as null, removes unknown keys, and refreshes a stale schema copy", () => {
    const sb = box();
    sb.write(".ai-dlc/herdr.json", JSON.stringify({ mode: "off", old: 1 }));
    sb.write(".ai-dlc/herdr.schema.json", "{}");
    const r = sb.cli(["merge"]);
    assert.match(r.stdout, /\+ runTimeoutMinutes: null/);
    assert.match(r.stdout, /- old: 1/);
    assert.match(r.stdout, /update \.ai-dlc\/herdr\.schema\.json/);
    assert.deepEqual(JSON.parse(text(sb)), { $schema: "./herdr.schema.json", mode: "off", runTimeoutMinutes: null });
    assert.equal(fs.readFileSync(path.join(sb.root, ".ai-dlc", "herdr.schema.json"), "utf8"), fs.readFileSync(SCHEMA, "utf8"));
  });

  test("[AC-5] merge on a broken file exits 1 and leaves it", () => {
    const sb = box();
    sb.write(".ai-dlc/herdr.json", "nope");
    assert.equal(sb.cli(["merge"]).status, 1);
    assert.equal(text(sb), "nope");
  });

  test("[AC-5] validate: a missing file is fine (the defaults apply), a valid file is valid, an invalid or broken file exits 1", () => {
    const sb = box();
    let r = sb.cli(["validate"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /does not exist: the defaults apply/);
    sb.write(".ai-dlc/herdr.json", JSON.stringify({ mode: "off", runTimeoutMinutes: 5 }));
    r = sb.cli(["validate"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /herdr\.json is valid/);
    sb.write(".ai-dlc/herdr.json", JSON.stringify({ mode: "bogus", extra: 1 }));
    r = sb.cli(["validate"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /error: mode: "bogus" is not one of watch, run-in-pane, off/);
    assert.match(r.stdout, /error: extra: not a setting/);
    sb.write(".ai-dlc/herdr.json", "{ broken");
    assert.equal(sb.cli(["validate"]).status, 1);
    sb.write(".ai-dlc/herdr.json", "[]");
    assert.match(sb.cli(["validate"]).stdout, /top level is not an object/);
  });
});
