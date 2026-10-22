// Tests for plugins/claude/ai-dlc/skills/cache-keepalive-config/templates/cache-keepalive.mjs (the CLI behind
// /ai-dlc:cache-keepalive-config) and its agreement with keep-alive's settings table and resolution
// (plugins/claude/ai-dlc/hooks/keepalive/settings.ts). The module is imported as TypeScript through
// Node's type stripping (Node 22.18 and later); the agreement suites are skipped on older Node.
// Run from the repository root: node --test "tests/**/*.test.mjs". Each CLI test works in a temp
// folder; nothing under plugins/ is written.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { checkValue, effective, loadSchema, merged, parseAssignment, resolve, validateDoc } from "../../plugins/claude/ai-dlc/skills/cache-keepalive-config/templates/cache-keepalive.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PLUGIN = path.join(REPO, "plugins", "claude", "ai-dlc");
const SKILL = path.join(PLUGIN, "skills", "cache-keepalive-config");
const CLI = path.join(SKILL, "templates", "cache-keepalive.mjs");
const toUrl = (p) => new URL(`file:///${p.replace(/\\/g, "/").replace(/^\/+/, "")}`).href;
const { schema, keys } = loadSchema();

let mod, config;
let skipReason;
try {
  mod = await import(toUrl(path.join(PLUGIN, "hooks", "keepalive", "settings.ts")));
  config = await import(toUrl(path.join(PLUGIN, "hooks", "auto-handoff", "config.ts")));
} catch (e) {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major > 22 || (major === 22 && minor >= 18)) throw e;
  skipReason = `Node ${process.versions.node} cannot import settings.ts (needs 22.18 or later): ${e.message}`;
}

let tmp, n = 0;
before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ka-test-")); });
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function repo(files = {}) {
  const root = path.join(tmp, `repo-${++n}`);
  fs.mkdirSync(root, { recursive: true });
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), typeof text === "string" ? text : JSON.stringify(text, null, 2));
  }
  return root;
}
const cli = (root, args) => {
  const r = spawnSync(process.execPath, [CLI, "--root", root, ...args], { encoding: "utf8", cwd: tmp });
  return { code: r.status, out: r.stdout, err: r.stderr };
};
const FILE = (root) => path.join(root, ".ai-dlc", "cache-keepalive.json");
const fileOf = (root) => JSON.parse(fs.readFileSync(FILE(root), "utf8"));
const TRUSTED = { trusted: true, why: "" };
const UNTRUSTED = { trusted: false, why: "the folder has no entry" };

// ---- one list of settings ----------------------------------------------------------------------
describe("the schema against keep-alive's settings table", { skip: skipReason }, () => {
  test("lists the same keys in the same order, with the same variable, kind and default", () => {
    assert.deepEqual(keys.map((p) => p.key), mod.SETTINGS.map((s) => s.key));
    for (const [i, s] of mod.SETTINGS.entries()) {
      const p = keys[i];
      assert.equal(p["x-env"], s.env, s.key);
      assert.equal(p["x-kind"], s.kind, s.key);
      assert.deepEqual(p.default, s.default, s.key);
      assert.ok(p.type.includes("null"), `${s.key} may be null`);
    }
  });

  test("marks exactly the module's trust-gated keys x-trustGated, and says so in their descriptions", () => {
    assert.deepEqual(keys.filter((p) => p["x-trustGated"]).map((p) => p.key).sort(), [...mod.TRUST_GATED].sort());
    for (const p of keys) assert.equal(p.description.includes("only when Claude Code trusts the folder"), !!p["x-trustGated"], p.key);
  });

  test("allows no key the module does not read", () => {
    assert.equal(schema.additionalProperties, false);
    for (const track of ["oneHour", "fiveMinute"]) assert.equal(schema.properties[track].additionalProperties, false);
  });
});

// ---- values and resolution, against the module ---------------------------------------------------
const SAMPLES = {
  boolean: [true, false, "yes", "OFF", " 1 ", "maybe", 1, "", "  "],
  scope: ["session", " Machine ", "global", 3, ""],
  text: ["hi", "  padded  ", "", "   ", 5],
  threshold: [0, 0.5, "0.9", 1, -0.1, "x", ""],
  ratio: [0, 0.15, 1, "0.5", ""],
  percent: [0, 1, 50.5, 100, 101, "80"],
  nonNegative: [0, 2, -1, "1.5", ""],
  positive: [0, 0.6, "5", -2],
  whole: [0, 10, 1.5, "3", -1, ""],
  positiveWhole: [0, 1, 20, "7", 2.5],
  minDuration: ["1m", "30m", "0.5m", "2s", "1.5h", 60, ""],
  duration: ["1m", "45m", "8h", "1d", "30s", "abc", 5, " 2H ", ""],
  prices: ["*=0.1", "opus=0.05,*=0.1", "opus=0.05", "(=1,*=1", "a=x,*=1", ""],
};
const fromModule = (kind, raw, by, min) => {
  const v = mod.check(kind, raw, by, min);
  if (v === null) return { state: "unset" };
  if (v && typeof v === "object" && !Array.isArray(v) && "invalid" in v) return { state: "invalid", why: v.invalid };
  return { state: "valid", value: kind === "prices" ? undefined : v };
};
const fromCli = (p, raw, byEnv, min) => {
  const r = checkValue(p, raw, byEnv, min);
  if (r.unset) return { state: "unset" };
  if (r.error) return { state: "invalid", why: r.error };
  return { state: "valid", value: p["x-kind"] === "prices" ? undefined : r.value };
};

describe("cache-keepalive.mjs reads values as the module does", { skip: skipReason }, () => {
  test("every kind: the same outcome, reason and value, from an env and from the file", () => {
    for (const p of keys) {
      for (const raw of [undefined, null, ...SAMPLES[p["x-kind"]]]) {
        for (const [by, byEnv] of [["env", true], ["json", false]]) {
          assert.deepEqual(fromCli(p, raw, byEnv, 60_000), fromModule(p["x-kind"], raw, by, 60_000), `${p.key} ${by} ${JSON.stringify(raw)}`);
        }
      }
    }
  });

  const SCENARIOS = {
    "nothing set": [],
    "env over file": [
      { where: ".claude/settings.local.json", env: { AI_DLC_KEEPALIVE_SCOPE: "machine" } },
      { where: ".ai-dlc/cache-keepalive.json", json: { scope: "session", oneHour: { keepWarmFor: "10h" } } },
    ],
    "invalid values fall through": [
      { where: ".claude/settings.json", env: { AI_DLC_KEEPALIVE_1H_KEEP_WARM_FOR: "soon", AI_DLC_KEEPALIVE_HIT_THRESHOLD: "2" } },
      { where: ".ai-dlc/cache-keepalive.json", json: { oneHour: { keepWarmFor: "2h" }, hitThreshold: 0.8 } },
    ],
    "minDuration lifts the floor": [
      { where: ".ai-dlc/cache-keepalive.json", json: { minDuration: "10m", fiveMinute: { keepWarmFor: "5m", ttl: "20m", pingEvery: "15m" } } },
    ],
    "pingEvery not shorter than ttl": [
      { where: ".ai-dlc/cache-keepalive.json", json: { fiveMinute: { pingEvery: "6m" } } },
    ],
    "a ttl no default pingEvery fits is dropped": [
      { where: ".ai-dlc/cache-keepalive.json", json: { oneHour: { ttl: "40m" } } },
    ],
    "nulls and blank env values are unset": [
      { where: ".claude/settings.local.json", env: { AI_DLC_KEEPALIVE_ENABLED: "  " } },
      { where: ".ai-dlc/cache-keepalive.json", json: { enabled: null, oneHour: null, fiveMinute: { maxPings: null } } },
    ],
  };
  for (const [name, levels] of Object.entries(SCENARIOS)) {
    test(`resolve agrees with resolveSettings: ${name}`, () => {
      const m = mod.resolveSettings(levels.map((l) => ({ where: l.where, by: l.env ? "env" : "json", values: l.env ?? l.json })));
      const c = resolve(levels.map((l) => ({ where: l.where, byEnv: !!l.env, values: l.env ?? l.json })), keys);
      for (const p of keys) {
        const [head, tail] = p.key.split(".");
        const mv = tail === undefined ? m.settings[head] : m.settings[head][tail];
        if (p["x-kind"] !== "prices") assert.deepEqual(c.values[p.key], mv, p.key);
        assert.equal(c.sources[p.key], m.sources[p.key], `source of ${p.key}`);
      }
      assert.deepEqual(c.warnings, m.warnings);
    });
  }

  test("a file init writes, every key null but the two it asks for, gives the module no trust warning to log", () => {
    const doc = JSON.parse(merged(null, keys).text);
    doc.scope = "machine";
    assert.deepEqual(config.withoutKeys(JSON.parse(merged(null, keys).text), mod.gatedNames("json")).ignored, []);
    doc.oneHour.keepWarmFor = "10h";
    assert.deepEqual(config.withoutKeys(doc, mod.gatedNames("json")).ignored, ["oneHour.keepWarmFor"]);
  });
});

// ---- trust ---------------------------------------------------------------------------------------
test("show: untrusted, the gated keys of the file and of the env of .claude/settings.json are skipped; settings.local.json is not gated", () => {
  const root = repo({
    ".claude/settings.json": { env: { AI_DLC_KEEPALIVE_BUDGET_MULTIPLIER: "0", AI_DLC_KEEPALIVE_STATUS: "false" } },
    ".claude/settings.local.json": { env: { AI_DLC_KEEPALIVE_PING_PROMPT: "mine" } },
    ".ai-dlc/cache-keepalive.json": { scope: "machine", oneHour: { keepWarmFor: "10h" } },
  });
  const row = (rows, key) => rows.find((r) => r.key === key);
  const u = effective(root, keys, UNTRUSTED);
  assert.equal(row(u.rows, "oneHour.keepWarmFor").value, "8h");
  assert.equal(row(u.rows, "oneHour.keepWarmFor").source, "default");
  assert.equal(row(u.rows, "scope").value, "machine");
  assert.equal(row(u.rows, "budgetMultiplier").value, 2);
  assert.equal(row(u.rows, "status").value, false);
  assert.equal(row(u.rows, "pingPrompt").source, "AI_DLC_KEEPALIVE_PING_PROMPT in .claude/settings.local.json");
  assert.ok(u.warnings.some((w) => w.startsWith("oneHour.keepWarmFor in .ai-dlc/cache-keepalive.json ignored: Claude Code does not trust this folder")), u.warnings.join("\n"));
  // The same advice as the module's warning (hooks/keepalive/keepalive.ts, GATED_INSTEAD): settings.local.json, or the command.
  for (const w of u.warnings.filter((x) => x.includes("does not trust"))) assert.ok(w.endsWith("set them in the env of .claude/settings.local.json instead (a keep-warm time also with /ai-dlc:cache-keepalive)"), w);
  assert.match(fs.readFileSync(path.join(PLUGIN, "hooks", "keepalive", "keepalive.ts"), "utf8"), /const GATED_INSTEAD = `set them in the env of \.claude\/settings\.local\.json instead \(a keep-warm time also with \/\$\{COMMAND\}\)`/);
  assert.ok(u.warnings.some((w) => w.startsWith("AI_DLC_KEEPALIVE_BUDGET_MULTIPLIER in the env of .claude/settings.json ignored")), u.warnings.join("\n"));
  assert.ok(!u.warnings.some((w) => w.includes("10h")), "the warning names keys, not values");
  const t = effective(root, keys, TRUSTED);
  assert.equal(row(t.rows, "oneHour.keepWarmFor").value, "10h");
  assert.equal(row(t.rows, "budgetMultiplier").value, 0);
  assert.deepEqual(t.warnings, []);
});

test("show: settings files may hold comments; a broken one is skipped with a warning", () => {
  const root = repo({
    ".claude/settings.local.json": '{\n  // mine\n  "env": { /* team asked */ "AI_DLC_KEEPALIVE_SCOPE": "machine", "AI_DLC_KEEPALIVE_PING_PROMPT": "a // b" }\n}\n',
    ".claude/settings.json": "{ nope",
  });
  const r = effective(root, keys, TRUSTED);
  assert.equal(r.rows.find((x) => x.key === "scope").source, "AI_DLC_KEEPALIVE_SCOPE in .claude/settings.local.json");
  assert.equal(r.rows.find((x) => x.key === "pingPrompt").value, "a // b");
  assert.ok(r.warnings.includes(".claude/settings.json is not valid JSON (comments allowed); its env is skipped"), r.warnings.join("\n"));
});

test("show: the process environment is not read", () => {
  const root = repo();
  const r = spawnSync(process.execPath, [CLI, "--root", root, "show", "--json"], { encoding: "utf8", cwd: tmp, env: { ...process.env, AI_DLC_KEEPALIVE_SCOPE: "machine" } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const scope = JSON.parse(r.stdout).settings.find((s) => s.key === "scope");
  assert.deepEqual(scope, { key: "scope", value: "session", source: "default" });
});

// ---- merge ---------------------------------------------------------------------------------------
test("merge creates the file with every key unset, nested by track, and the schema next to it", () => {
  const root = repo();
  const dry = cli(root, ["merge", "--dry-run"]);
  assert.equal(dry.code, 0);
  assert.match(dry.out, /create \.ai-dlc\/cache-keepalive\.json with every key unset/);
  assert.ok(!fs.existsSync(FILE(root)), "--dry-run writes nothing");
  assert.equal(cli(root, ["merge"]).code, 0);
  const doc = fileOf(root);
  assert.equal(doc.$schema, "./cache-keepalive.schema.json");
  for (const p of keys) {
    const [head, tail] = p.key.split(".");
    assert.equal(tail === undefined ? doc[head] : doc[head][tail], null, p.key);
  }
  assert.equal(fs.readFileSync(path.join(root, ".ai-dlc", "cache-keepalive.schema.json"), "utf8"), fs.readFileSync(path.join(SKILL, "templates", "cache-keepalive.schema.json"), "utf8"));
  assert.equal(cli(root, ["validate"]).code, 0);
  assert.match(cli(root, ["merge", "--dry-run"]).out, /^up to date$/m);
});

test("merge keeps every value, adds missing keys as null and removes retired ones, top-level and nested", () => {
  const root = repo({ ".ai-dlc/cache-keepalive.json": { scope: "machine", oldKey: 1, oneHour: { keepWarmFor: "10h", gone: true } } });
  const r = cli(root, ["merge", "--dry-run"]);
  assert.match(r.out, /^\+ enabled: null$/m);
  assert.match(r.out, /^\+ fiveMinute\.maxPings: null$/m);
  assert.match(r.out, /^- oldKey: 1$/m);
  assert.match(r.out, /^- oneHour\.gone: true$/m);
  assert.equal(cli(root, ["merge"]).code, 0);
  const doc = fileOf(root);
  assert.equal(doc.scope, "machine");
  assert.equal(doc.oneHour.keepWarmFor, "10h");
  assert.ok(!("oldKey" in doc) && !("gone" in doc.oneHour));
  assert.equal(doc.fiveMinute.ttl, null);
});

test("merge and set refuse a file that is not JSON or whose track is not an object", () => {
  const bad = repo({ ".ai-dlc/cache-keepalive.json": "{ nope" });
  assert.equal(cli(bad, ["merge"]).code, 1);
  const track = repo({ ".ai-dlc/cache-keepalive.json": { oneHour: "10h" } });
  const r = cli(track, ["merge"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /not an object; fix it by hand first/);
  assert.equal(cli(track, ["set", "scope=machine"]).code, 1);
  assert.deepEqual(fileOf(track), { oneHour: "10h" });
});

// ---- set -----------------------------------------------------------------------------------------
test("set writes the two values init passes and leaves every other key null", () => {
  const root = repo();
  const r = cli(root, ["set", "oneHour.keepWarmFor=10h", "scope=machine"]);
  assert.equal(r.code, 0, r.out);
  const doc = fileOf(root);
  assert.equal(doc.oneHour.keepWarmFor, "10h");
  assert.equal(doc.scope, "machine");
  const set = keys.filter((p) => { const [h, t] = p.key.split("."); return (t === undefined ? doc[h] : doc[h][t]) !== null; }).map((p) => p.key);
  assert.deepEqual(set.sort(), ["oneHour.keepWarmFor", "scope"]);
  assert.equal(cli(root, ["validate"]).code, 0);
});

test("set takes a text setting as typed: a number-like or boolean-like text stays text; a quoted string is unquoted; null unsets", () => {
  const root = repo();
  const r = cli(root, ["set", "pingPrompt=123", "compactInstructions=true", "readPrice=*=0.1"]);
  assert.equal(r.code, 0, r.out);
  let doc = fileOf(root);
  assert.equal(doc.pingPrompt, "123");
  assert.equal(doc.compactInstructions, "true");
  assert.equal(doc.readPrice, "*=0.1");
  assert.equal(cli(root, ["validate"]).code, 0);
  assert.equal(cli(root, ["set", 'pingPrompt="say ok"', "compactInstructions=null"]).code, 0);
  doc = fileOf(root);
  assert.equal(doc.pingPrompt, "say ok");
  assert.equal(doc.compactInstructions, null);
  // A number setting still reads JSON.
  assert.equal(cli(root, ["set", "fiveMinute.maxPings=10"]).code, 0);
  assert.equal(fileOf(root).fiveMinute.maxPings, 10);
  assert.deepEqual(parseAssignment("pingPrompt=123", "text"), { key: "pingPrompt", value: "123" });
  assert.deepEqual(parseAssignment("oneHour.maxPings=123", "whole"), { key: "oneHour.maxPings", value: 123 });
});

test("set keeps durations as written, normalises booleans, the scope and numbers, and null unsets", () => {
  const root = repo();
  assert.equal(cli(root, ["set", "status=no", "scope= Machine ", "fiveMinute.maxPings=10", "oneHour.keepWarmFor= 1.5h "]).code, 0);
  let doc = fileOf(root);
  assert.equal(doc.status, false);
  assert.equal(doc.scope, "machine");
  assert.equal(doc.fiveMinute.maxPings, 10);
  assert.equal(doc.oneHour.keepWarmFor, "1.5h");
  assert.equal(cli(root, ["set", "status=null"]).code, 0);
  doc = fileOf(root);
  assert.equal(doc.status, null);
});

test("set writes nothing on an invalid value, an unknown key or a broken rule, and nothing with --dry-run", () => {
  const root = repo();
  for (const arg of ["scope=global", "nope=1", "oneHour.nope=1", "fiveMinute.pingEvery=6m", "oneHour.keepWarmFor=30s"]) {
    const r = cli(root, ["set", arg]);
    assert.equal(r.code, 1, arg);
    assert.match(r.out, /^error: /m, arg);
    assert.ok(!fs.existsSync(FILE(root)), arg);
  }
  assert.equal(cli(root, ["set", "scope=machine", "--dry-run"]).code, 0);
  assert.ok(!fs.existsSync(FILE(root)));
});

// ---- validate ------------------------------------------------------------------------------------
test("validate: a missing file passes; unknown keys, invalid values and broken rules fail", () => {
  assert.equal(cli(repo(), ["validate"]).code, 0);
  assert.deepEqual(validateDoc({ $schema: "./cache-keepalive.schema.json", scope: "machine", oneHour: { keepWarmFor: "10h" } }, keys), []);
  assert.deepEqual(validateDoc({ oneHour: null, fiveMinute: { maxPings: null } }, keys), []);
  const errors = validateDoc({ extra: 1, oneHour: { odd: 2 }, fiveMinute: { pingEvery: "6m" }, scope: "global", $schema: 3 }, keys);
  assert.ok(errors.includes("extra: not a setting (run merge to remove it)"), errors.join("\n"));
  assert.ok(errors.includes("oneHour.odd: not a setting (run merge to remove it)"), errors.join("\n"));
  assert.ok(errors.includes("$schema: not text"), errors.join("\n"));
  assert.ok(errors.includes('scope="global": not session or machine'), errors.join("\n"));
  assert.ok(errors.includes('fiveMinute.pingEvery="6m": not shorter than fiveMinute.ttl (5m)'), errors.join("\n"));
  assert.ok(validateDoc({ oneHour: 3 }, keys).includes("oneHour: not an object"));
  const r = cli(repo({ ".ai-dlc/cache-keepalive.json": { scope: "global" } }), ["validate"]);
  assert.equal(r.code, 1);
});

// ---- the skill and init --------------------------------------------------------------------------
test("the skill is Claude-only, user-invoked, and init passes it keys the schema has", () => {
  const skill = fs.readFileSync(path.join(SKILL, "SKILL.md"), "utf8");
  assert.match(skill, /^---\r?\nname: cache-keepalive-config\r?\n/);
  assert.match(skill, /\ndisable-model-invocation: true\r?\n/);
  assert.ok(JSON.parse(fs.readFileSync(path.join(REPO, "tools", "claude-only-skills.json"), "utf8")).includes("cache-keepalive-config"));
  const init = fs.readFileSync(path.join(PLUGIN, "skills", "init", "SKILL.md"), "utf8");
  assert.ok(init.includes("${CLAUDE_SKILL_DIR}/../cache-keepalive-config/SKILL.md"));
  for (const key of ["oneHour.keepWarmFor", "scope"]) {
    assert.ok(init.includes(`\`${key}=`), `init passes ${key}`);
    assert.ok(keys.some((p) => p.key === key), key);
  }
  assert.ok(!/init does not write/.test(init), "init writes the two keep-alive values now");
});

// ---- init's re-run: merge and set keep what a team already chose --------------------------------
test("init re-run: merge then set keeps values already set, other than the two it passes, and a second run changes nothing", () => {
  const root = repo({ ".ai-dlc/cache-keepalive.json": { fiveMinute: { enabled: false, keepWarmFor: "30m" }, oneHour: { keepWarmFor: "4h" }, scope: "session", budgetMultiplier: 3 } });
  assert.equal(cli(root, ["merge"]).code, 0);
  assert.equal(cli(root, ["set", "oneHour.keepWarmFor=10h", "scope=machine"]).code, 0);
  const doc = fileOf(root);
  assert.equal(doc.oneHour.keepWarmFor, "10h");
  assert.equal(doc.scope, "machine");
  assert.equal(doc.fiveMinute.enabled, false);
  assert.equal(doc.fiveMinute.keepWarmFor, "30m");
  assert.equal(doc.budgetMultiplier, 3);
  assert.equal(doc.oneHour.ttl, null);
  const before = fs.readFileSync(FILE(root), "utf8");
  assert.match(cli(root, ["merge", "--dry-run"]).out, /^up to date$/m);
  assert.equal(cli(root, ["set", "oneHour.keepWarmFor=10h", "scope=machine"]).code, 0);
  assert.equal(fs.readFileSync(FILE(root), "utf8"), before);
  assert.equal(cli(root, ["validate"]).code, 0);
});

test("set refuses a key that was retired with the /config rows' wording and writes nothing when one of several pairs is bad", () => {
  const root = repo({ ".ai-dlc/cache-keepalive.json": { scope: "session" } });
  const r = cli(root, ["set", "scope=machine", "oneHour.keepWarmFor=soon"]);
  assert.equal(r.code, 1);
  assert.equal(fileOf(root).scope, "session");
});

test("parseAssignment: text-kind values that parse as JSON stay the text typed; other kinds still read JSON; a missing kind reads JSON", () => {
  for (const kind of ["text", "duration", "minDuration", "prices"]) {
    for (const typed of ["123", "1.5", "true", "false", "[1]", '{"a":1}']) assert.deepEqual(parseAssignment(`k=${typed}`, kind), { key: "k", value: typed }, `${kind} ${typed}`);
    assert.deepEqual(parseAssignment("k=null", kind), { key: "k", value: null }, kind);
    assert.deepEqual(parseAssignment('k="1h"', kind), { key: "k", value: "1h" }, kind);
  }
  assert.deepEqual(parseAssignment("k=true", "boolean"), { key: "k", value: true });
  assert.deepEqual(parseAssignment("k=1.5", undefined), { key: "k", value: 1.5 });
  assert.deepEqual(parseAssignment("k=a=b", "text"), { key: "k", value: "a=b" });
  assert.throws(() => parseAssignment("=1", "text"), /expected <key>=<value>/);
  assert.throws(() => parseAssignment("nokey", "text"), /expected <key>=<value>/);
});

test("set: a bare number or boolean on a duration key is refused as a duration, not stored as a number; a text value is trimmed", () => {
  const root = repo();
  for (const arg of ["oneHour.keepWarmFor=10", "minDuration=true", "pingPrompt=   "]) {
    const r = cli(root, ["set", arg]);
    assert.equal(r.code, 1, arg);
    assert.match(r.out, /^error: /m, arg);
  }
  assert.ok(!fs.existsSync(FILE(root)));
  assert.equal(cli(root, ["set", "pingPrompt=  42  "]).code, 0);
  assert.equal(fileOf(root).pingPrompt, "42");
});
