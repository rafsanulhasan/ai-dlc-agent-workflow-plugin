// Tests for plugins/claude/ai-dlc/skills/cache-keepalive-configure/templates/cache-keepalive.mjs (the CLI behind
// /ai-dlc:cache-keepalive-install, -merge and -configure) and its agreement with keep-alive's settings table and resolution
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
import { NULL_IN_FILE, checkValue, differsFromDefault, effective, loadSchema, merged, parseAssignment, resolve, validateDoc, validateEnv, capWarnings, rowsOf, followingMaxPings } from "../../plugins/claude/ai-dlc/skills/cache-keepalive-configure/templates/cache-keepalive.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PLUGIN = path.join(REPO, "plugins", "claude", "ai-dlc");
const SKILL = path.join(PLUGIN, "skills", "cache-keepalive-configure");
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
const defaultOf = (key) => keys.find((p) => p.key === key).default;
const at = (doc, key) => { const [h, t] = key.split("."); return t === undefined ? doc[h] : doc[h][t]; };
/** A complete file: every key at its default, with `over` applied (dotted keys). */
const full = (over = {}) => { const doc = JSON.parse(merged(null, keys).text); for (const [k, v] of Object.entries(over)) { const [h, t] = k.split("."); if (t === undefined) doc[h] = v; else doc[h][t] = v; } return doc; };
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
      assert.ok(!Array.isArray(p.type) && p.type !== "null", `${s.key} is not nullable`);
    }
  });

  test("requires every key, top-level and in each track, so the file always holds a value", () => {
    assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).filter((k) => k !== "$schema").sort());
    for (const track of ["oneHour", "fiveMinute"]) {
      assert.equal(schema.properties[track].type, "object");
      assert.deepEqual([...schema.properties[track].required].sort(), Object.keys(schema.properties[track].properties).sort());
    }
    assert.ok(!schema.properties.scope.enum.includes(null));
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
    "a null in the file is invalid and warned about; blank env values are unset": [
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

  test("a file init writes, every key at its default, gives the trust gate nothing to skip; a value that differs is skipped", () => {
    const doc = full({ scope: "machine" });
    assert.deepEqual(mod.gatedDiffering(doc, "json"), []);
    // The same value in another unit is still the default.
    assert.deepEqual(mod.gatedDiffering(full({ "oneHour.keepWarmFor": "480m", readPrice: " fable|mythos=0.025, opus[- ]?5[-. ]5=0.05, *=0.1 " }), "json"), []);
    assert.deepEqual(mod.gatedDiffering(full({ "oneHour.keepWarmFor": "10h", budgetMultiplier: 3 }), "json"), ["oneHour.keepWarmFor", "budgetMultiplier"]);
    assert.deepEqual(mod.gatedDiffering({ AI_DLC_KEEPALIVE_ENABLED: "true", AI_DLC_KEEPALIVE_1H_MAX_PINGS: "3" }, "env"), ["AI_DLC_KEEPALIVE_1H_MAX_PINGS"]);
    assert.deepEqual(config.withoutKeys(doc, mod.gatedDiffering(doc, "json")).ignored, []);
  });

  // The module's path (keepalive.ts, load): trustGate(values, gatedDiffering(values), …) in io.ts, which
  // skips through config.ts withoutKeys only the keys whose value is neither undefined nor null. So in an
  // untrusted folder a null gated key is not skipped by the trust gate: it reaches resolveSettings and
  // gets the null warning, like any other null. The CLI must say the same, not a trust warning.
  test("untrusted: a null gated key gets the null warning, not the trust warning, in the CLI as in the module", () => {
    const doc = full({ "oneHour.keepWarmFor": null, budgetMultiplier: 3, "fiveMinute.maxPings": null });
    const gated = mod.gatedDiffering(doc, "json");
    const gate = config.withoutKeys(doc, gated);
    assert.deepEqual(gate.ignored, ["budgetMultiplier"]); // the module skips only the non-null differing value
    const moduleWarnings = mod.resolveSettings([{ where: ".ai-dlc/cache-keepalive.json", by: "json", values: gate.values }]).warnings;
    const root = repo({ ".ai-dlc/cache-keepalive.json": doc });
    const cliWarnings = effective(root, keys, UNTRUSTED).warnings;
    const trust = cliWarnings.filter((w) => w.includes("does not trust"));
    assert.equal(trust.length, 1);
    assert.match(trust[0], /^budgetMultiplier in \.ai-dlc\/cache-keepalive\.json ignored: Claude Code does not trust this folder/);
    assert.deepEqual(cliWarnings.filter((w) => !w.includes("does not trust")), moduleWarnings);
    assert.ok(moduleWarnings.some((w) => w.startsWith(`oneHour.keepWarmFor=null in .ai-dlc/cache-keepalive.json ignored: ${NULL_IN_FILE}`)));
  });

  test("the CLI and the module agree on which values differ from the default", () => {
    for (const p of keys) {
      for (const raw of [p.default, null, ...SAMPLES[p["x-kind"]]]) {
        for (const [by, byEnv] of [["env", true], ["json", false]]) {
          const s = mod.SETTINGS.find((x) => x.key === p.key);
          assert.equal(differsFromDefault(p, raw, byEnv), mod.differsFromDefault(s, raw, by), `${p.key} ${by} ${JSON.stringify(raw)}`);
        }
      }
    }
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
test("install creates the file with every key at its default, and the schema next to it; then merge finds it up to date", () => {
  const root = repo();
  const dry = cli(root, ["install", "--dry-run"]);
  assert.equal(dry.code, 0);
  assert.match(dry.out, /create \.ai-dlc\/cache-keepalive\.json with every key at its default/);
  assert.ok(!fs.existsSync(FILE(root)), "--dry-run writes nothing");
  assert.equal(cli(root, ["install"]).code, 0);
  const doc = fileOf(root);
  assert.equal(doc.$schema, "./cache-keepalive.schema.json");
  for (const p of keys) assert.deepEqual(at(doc, p.key), p.default, p.key);
  assert.equal(fs.readFileSync(path.join(root, ".ai-dlc", "cache-keepalive.schema.json"), "utf8"), fs.readFileSync(path.join(SKILL, "templates", "cache-keepalive.schema.json"), "utf8"));
  assert.equal(cli(root, ["validate"]).code, 0);
  assert.match(cli(root, ["merge", "--dry-run"]).out, /^up to date$/m);
});

test("install on an existing file warns, points to merge and writes nothing; merge without a file warns, points to install and writes nothing; both exit 0", () => {
  const root = repo({ ".ai-dlc/cache-keepalive.json": { scope: null } });
  const before = fs.readFileSync(FILE(root), "utf8");
  const i = cli(root, ["install"]);
  assert.equal(i.code, 0, i.out);
  assert.equal(i.out, "warning: .ai-dlc/cache-keepalive.json already exists: run /ai-dlc:cache-keepalive-merge to bring it up to date; nothing written\n");
  assert.equal(fs.readFileSync(FILE(root), "utf8"), before);
  assert.ok(!fs.existsSync(path.join(root, ".ai-dlc", "cache-keepalive.schema.json")));
  const none = repo();
  const m = cli(none, ["merge"]);
  assert.equal(m.code, 0, m.out);
  assert.equal(m.out, "warning: .ai-dlc/cache-keepalive.json does not exist: run /ai-dlc:cache-keepalive-install to create it; nothing written\n");
  assert.ok(!fs.existsSync(FILE(none)));
  assert.equal(cli(none, ["merge", "--dry-run"]).code, 0);
});

test("no user-facing set: the usage line, the warnings and the skills never tell a user to run set", () => {
  const usage = cli(repo(), ["help"]).out;
  assert.match(usage, /install \[--dry-run\] \| merge \[--dry-run\]/);
  assert.doesNotMatch(usage, /\bset\b/);
  for (const name of ["cache-keepalive-install", "cache-keepalive-merge", "cache-keepalive-configure", "cache-keepalive", "init"]) {
    const text = fs.readFileSync(path.join(PLUGIN, "skills", name, "SKILL.md"), "utf8");
    assert.doesNotMatch(text, /\/ai-dlc:cache-keepalive-config\b(?!ure)/, name);
    assert.doesNotMatch(text, /cache-keepalive-config(?!ure)/, name);
    assert.doesNotMatch(text, /`\/ai-dlc:[a-z-]+ set\b|run `?set\b/i, name);
  }
  assert.ok(!fs.existsSync(path.join(PLUGIN, "skills", "cache-keepalive-config")), "the -config skill is gone, with no alias");
});

test("merge keeps every value, fills missing, legacy-null and legacy-0 keys with their default, and removes retired ones", () => {
  const root = repo({ ".ai-dlc/cache-keepalive.json": { scope: "machine", status: null, oldKey: 1, oneHour: { keepWarmFor: "10h", maxPings: 0, gone: true }, fiveMinute: { maxPings: null } } });
  const r = cli(root, ["merge", "--dry-run"]);
  assert.match(r.out, /^\+ enabled: true$/m);
  assert.match(r.out, /^\+ fiveMinute\.ttl: "5m"$/m);
  assert.match(r.out, /^\+ status: null -> true$/m);
  assert.match(r.out, /^\+ oneHour\.maxPings: 0 -> 9$/m);
  assert.match(r.out, /^\+ fiveMinute\.maxPings: null -> 20$/m);
  assert.match(r.out, /^- oldKey: 1$/m);
  assert.match(r.out, /^- oneHour\.gone: true$/m);
  assert.equal(cli(root, ["merge"]).code, 0);
  const doc = fileOf(root);
  assert.equal(doc.scope, "machine");
  assert.equal(doc.oneHour.keepWarmFor, "10h");
  assert.ok(!("oldKey" in doc) && !("gone" in doc.oneHour));
  assert.equal(doc.fiveMinute.ttl, "5m");
  assert.equal(doc.status, true);
  assert.equal(doc.oneHour.maxPings, 9);
  assert.equal(doc.fiveMinute.maxPings, 20);
  assert.match(cli(root, ["validate"]).out, /cache-keepalive\.json is valid/);
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
test("set writes the two values init passes, recomputes that track's maxPings, and keeps every other key at its default", () => {
  const root = repo();
  const r = cli(root, ["set", "oneHour.keepWarmFor=10h", "scope=machine"]);
  assert.equal(r.code, 0, r.out);
  const doc = fileOf(root);
  assert.equal(doc.oneHour.keepWarmFor, "10h");
  assert.equal(doc.scope, "machine");
  assert.equal(doc.oneHour.maxPings, 12);
  const changed = keys.filter((p) => JSON.stringify(at(doc, p.key)) !== JSON.stringify(p.default)).map((p) => p.key);
  assert.deepEqual(changed.sort(), ["oneHour.keepWarmFor", "oneHour.maxPings", "scope"]);
  const v = cli(root, ["validate"]);
  assert.equal(v.code, 0);
  assert.doesNotMatch(v.out, /^warning: \.ai-dlc|maxPings is/m); // init's done condition: no warning for the file
});

test("set takes a text setting as typed: a number-like or boolean-like text stays text; a quoted string is unquoted", () => {
  const root = repo();
  const r = cli(root, ["set", "pingPrompt=123", "compactInstructions=true", "readPrice=*=0.1"]);
  assert.equal(r.code, 0, r.out);
  let doc = fileOf(root);
  assert.equal(doc.pingPrompt, "123");
  assert.equal(doc.compactInstructions, "true");
  assert.equal(doc.readPrice, "*=0.1");
  assert.equal(cli(root, ["validate"]).code, 0);
  assert.equal(cli(root, ["set", 'pingPrompt="say ok"']).code, 0);
  doc = fileOf(root);
  assert.equal(doc.pingPrompt, "say ok");
  // A number setting still reads JSON.
  assert.equal(cli(root, ["set", "fiveMinute.maxPings=10"]).code, 0);
  assert.equal(fileOf(root).fiveMinute.maxPings, 10);
  assert.deepEqual(parseAssignment("pingPrompt=123", "text"), { key: "pingPrompt", value: "123" });
  assert.deepEqual(parseAssignment("oneHour.maxPings=123", "whole"), { key: "oneHour.maxPings", value: 123 });
});

test("set keeps durations as written, normalises booleans, the scope and numbers; a null is skipped with a warning naming the value that stays", () => {
  const root = repo();
  assert.equal(cli(root, ["set", "status=no", "scope= Machine ", "fiveMinute.maxPings=10", "oneHour.keepWarmFor= 1.5h "]).code, 0);
  let doc = fileOf(root);
  assert.equal(doc.status, false);
  assert.equal(doc.scope, "machine");
  assert.equal(doc.fiveMinute.maxPings, 10);
  assert.equal(doc.oneHour.keepWarmFor, "1.5h");
  const r = cli(root, ["set", "status=null", "compactInstructions=null", "oneHour.keepWarmFor=null", "budgetMultiplier=3"]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^warning: status=null skipped: null is not a value: every key holds one; status stays false$/m);
  assert.match(r.out, /^warning: oneHour\.keepWarmFor=null skipped: null is not a value: every key holds one; oneHour\.keepWarmFor stays "1\.5h"$/m);
  doc = fileOf(root);
  assert.equal(doc.status, false);
  assert.equal(doc.compactInstructions, defaultOf("compactInstructions"));
  assert.equal(doc.budgetMultiplier, 3); // the valid pair is still written
});

test("set on a file with legacy nulls and missing keys rewrites each to its default and lists it", () => {
  const root = repo({ ".ai-dlc/cache-keepalive.json": { scope: null, oneHour: { keepWarmFor: null } } });
  const r = cli(root, ["set", "fiveMinute.maxPings=10"]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^\+ scope: null -> "session"$/m);
  assert.match(r.out, /^\+ oneHour\.keepWarmFor: null -> "8h"$/m);
  assert.match(r.out, /^\+ enabled: true$/m); // missing: written with its default, and listed
  const doc = fileOf(root);
  assert.equal(doc.scope, "session");
  assert.equal(doc.fiveMinute.maxPings, 10);
  assert.equal(cli(root, ["validate"]).code, 0);
});

test("set skips an invalid value, an unknown key, a broken rule and maxPings 0 with a warning, exits 0, and writes nothing with --dry-run", () => {
  const root = repo();
  const cases = {
    "scope=global": /^warning: scope="global" skipped: not session or machine; scope stays "session"$/m,
    "nope=1": /^warning: nope: not a setting; skipped$/m,
    "oneHour.nope=1": /^warning: oneHour\.nope: not a setting; skipped$/m,
    "fiveMinute.pingEvery=6m": /^warning: fiveMinute\.pingEvery="6m" skipped: fiveMinute\.pingEvery="6m": not shorter than fiveMinute\.ttl \(5m\); fiveMinute\.pingEvery stays "3m"$/m,
    "oneHour.keepWarmFor=0.5m": /^warning: oneHour\.keepWarmFor="0\.5m" skipped: oneHour\.keepWarmFor="0\.5m": shorter than minDuration \(1m\); oneHour\.keepWarmFor stays "8h"$/m,
    "oneHour.maxPings=0": /^warning: oneHour\.maxPings=0 skipped: not a whole number of 1 or more; oneHour\.maxPings stays 9$/m,
    "fiveMinute.maxPings=-2": /^warning: fiveMinute\.maxPings=-2 skipped: not a whole number of 1 or more; fiveMinute\.maxPings stays 20$/m,
  };
  for (const [arg, want] of Object.entries(cases)) {
    const r = cli(root, ["set", arg]);
    assert.equal(r.code, 0, arg);
    assert.match(r.out, want, `${arg}\n${r.out}`);
  }
  const doc = fileOf(root);
  for (const p of keys) assert.deepEqual(at(doc, p.key), p.default, p.key); // every skipped pair left its default
  const dry = repo();
  assert.equal(cli(dry, ["set", "scope=machine", "--dry-run"]).code, 0);
  assert.ok(!fs.existsSync(FILE(dry)));
});

test("set recomputes a track's maxPings when it writes that track's keepWarmFor without an explicit maxPings, and prints it", () => {
  const root = repo();
  const r = cli(root, ["set", "oneHour.keepWarmFor=10h", "fiveMinute.keepWarmFor=2h"]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^oneHour\.maxPings: 9 -> 12 \(follows oneHour\.keepWarmFor 10h at oneHour\.pingEvery 50m\)$/m);
  assert.match(r.out, /^fiveMinute\.maxPings: 20 -> 40 \(follows fiveMinute\.keepWarmFor 2h at fiveMinute\.pingEvery 3m\)$/m);
  assert.doesNotMatch(r.out, /maxPings is/); // no cap warning: the limit followed
  let doc = fileOf(root);
  assert.equal(doc.oneHour.maxPings, 12);
  assert.equal(doc.fiveMinute.maxPings, 40);
  // A keep-warm time shorter than the interval: at least 1. The new pingEvery of the same call counts.
  assert.equal(cli(root, ["set", "oneHour.keepWarmFor=30m"]).code, 0);
  assert.equal(fileOf(root).oneHour.maxPings, 1);
  assert.equal(cli(root, ["set", "fiveMinute.pingEvery=4m", "fiveMinute.keepWarmFor=1h"]).code, 0);
  assert.equal(fileOf(root).fiveMinute.maxPings, 15);
  // Equal: nothing to print.
  const same = cli(root, ["set", "fiveMinute.keepWarmFor=1h"]);
  assert.doesNotMatch(same.out, /maxPings/);
});

test("set: an explicit maxPings in the same call wins over the recomputed one; the cap warning then names the value that would follow", () => {
  const root = repo();
  const r = cli(root, ["set", "oneHour.keepWarmFor=10h", "oneHour.maxPings=5"]);
  assert.equal(r.code, 0, r.out);
  assert.equal(fileOf(root).oneHour.maxPings, 5);
  assert.doesNotMatch(r.out, /follows/);
  assert.match(r.out, /^warning: oneHour\.maxPings is 5, but oneHour\.keepWarmFor \(10h\) at oneHour\.pingEvery \(50m\) allows 12 pings: the pings stop after 5; set oneHour\.maxPings=12 to keep warm for the whole time$/m);
  // Writing only pingEvery or maxPings recomputes nothing.
  assert.equal(cli(root, ["set", "oneHour.pingEvery=40m"]).code, 0);
  assert.equal(fileOf(root).oneHour.maxPings, 5);
  // An explicit maxPings that is skipped still counts as named: nothing is recomputed in its place.
  const bad = cli(root, ["set", "oneHour.keepWarmFor=20h", "oneHour.maxPings=0"]);
  assert.match(bad.out, /^warning: oneHour\.maxPings=0 skipped: /m);
  assert.equal(fileOf(root).oneHour.maxPings, 5);
});

// ---- validate ------------------------------------------------------------------------------------
test("validate: a missing file passes; unknown, missing and null keys, invalid values and broken rules are reported, as warnings, exit 0", () => {
  assert.equal(cli(repo(), ["validate"]).code, 0);
  assert.deepEqual(validateDoc(full({ scope: "machine", "oneHour.keepWarmFor": "10h", "oneHour.maxPings": 12 }), keys), []);
  const partial = validateDoc({ scope: "machine", oneHour: { keepWarmFor: "10h" } }, keys);
  assert.ok(partial.includes("enabled: missing (run /ai-dlc:cache-keepalive-merge to write its default)"), partial.join("\n"));
  assert.ok(partial.includes("fiveMinute.maxPings: missing (run /ai-dlc:cache-keepalive-merge to write its default)"), partial.join("\n"));
  const nulls = validateDoc(full({ status: null, "fiveMinute.maxPings": null }), keys);
  assert.deepEqual(nulls, ["status=null: " + NULL_IN_FILE, "fiveMinute.maxPings=null: " + NULL_IN_FILE]);
  assert.deepEqual(validateDoc(full({ "oneHour.maxPings": 0 }), keys), ["oneHour.maxPings=0: not a whole number of 1 or more"]);
  assert.ok(validateDoc(full({ oneHour: null }), keys).includes("oneHour: not an object"));
  const errors = validateDoc({ ...full({ "fiveMinute.pingEvery": "6m", scope: "global" }), extra: 1, oneHour: { ...full().oneHour, odd: 2 }, $schema: 3 }, keys);
  assert.ok(errors.includes("extra: not a setting (run /ai-dlc:cache-keepalive-merge to remove it)"), errors.join("\n"));
  assert.ok(errors.includes("oneHour.odd: not a setting (run /ai-dlc:cache-keepalive-merge to remove it)"), errors.join("\n"));
  assert.ok(errors.includes("$schema: not text"), errors.join("\n"));
  assert.ok(errors.includes('scope="global": not session or machine'), errors.join("\n"));
  assert.ok(errors.includes('fiveMinute.pingEvery="6m": not shorter than fiveMinute.ttl (5m)'), errors.join("\n"));
  const r = cli(repo({ ".ai-dlc/cache-keepalive.json": { scope: "global" } }), ["validate"]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^warning: \.ai-dlc\/cache-keepalive\.json: scope="global": not session or machine; in force: "session" \(default\)$/m);
  assert.match(r.out, /^warning: \.ai-dlc\/cache-keepalive\.json: extra|^warning: \.ai-dlc\/cache-keepalive\.json: enabled: missing \(run \/ai-dlc:cache-keepalive-merge to write its default\); in force: true \(default\)$/m);
  assert.match(r.out, /^keep-alive runs on the values in force above/m);
});

test("show and validate warn about a null in the file, naming the fix and the value in force; the configure skill's show mode offers merge (and install for a missing file)", () => {
  const root = repo({ ".ai-dlc/cache-keepalive.json": full({ status: null }) });
  const r = cli(root, ["show"]);
  assert.equal(r.code, 0);
  assert.match(r.out, /^warning: status=null in \.ai-dlc\/cache-keepalive\.json ignored: null: every key holds a value \(run \/ai-dlc:cache-keepalive-merge to write its default\); falling back to the next source$/m);
  assert.match(r.out, /^\| `status` \| `true` \| default \|$/m);
  const v = cli(root, ["validate"]);
  assert.equal(v.code, 0);
  assert.match(v.out, /^warning: \.ai-dlc\/cache-keepalive\.json: status=null: null: every key holds a value \(run \/ai-dlc:cache-keepalive-merge to write its default\); in force: true \(default\)$/m);
  const skill = fs.readFileSync(path.join(SKILL, "SKILL.md"), "utf8").replace(/\r\n/g, "\n");
  const show = skill.slice(skill.indexOf("### show"), skill.indexOf("### edit"));
  assert.match(show, /null/);
  assert.match(show, /\/ai-dlc:cache-keepalive-merge/);
  assert.match(show, /\/ai-dlc:cache-keepalive-install/);
});

// ---- validate: the env of the settings files ------------------------------------------------------
test("validate checks every AI_DLC_KEEPALIVE_* variable in both settings files: each finding is a warning naming the file, the variable, the reason and the value in force", () => {
  const root = repo({
    ".ai-dlc/cache-keepalive.json": full(),
    ".claude/settings.local.json": { env: { AI_DLC_KEEPALIVE_SCOPE: "global", AI_DLC_KEEPALIVE_NOPE: "1", AI_DLC_KEEPALIVE_5M_MAX_PINGS: "0", OTHER_VAR: "x" } },
    ".claude/settings.json": { env: { AI_DLC_KEEPALIVE_5M_PING_EVERY: "6m", AI_DLC_KEEPALIVE_1H_KEEP_WARM_FOR: "0.5m", AI_DLC_KEEPALIVE_HIT_THRESHOLD: "2" } },
  });
  const { warnings } = validateEnv(root, keys, TRUSTED);
  assert.deepEqual(warnings.sort(), [
    '.claude/settings.json: AI_DLC_KEEPALIVE_1H_KEEP_WARM_FOR="0.5m": shorter than minDuration (1m); in force: "8h" (oneHour.keepWarmFor in .ai-dlc/cache-keepalive.json)',
    '.claude/settings.json: AI_DLC_KEEPALIVE_5M_PING_EVERY="6m": not shorter than fiveMinute.ttl (5m); in force: "3m" (fiveMinute.pingEvery in .ai-dlc/cache-keepalive.json)',
    '.claude/settings.json: AI_DLC_KEEPALIVE_HIT_THRESHOLD="2": not a number from 0 up to, not including, 1; in force: 0.9 (hitThreshold in .ai-dlc/cache-keepalive.json)',
    '.claude/settings.local.json: AI_DLC_KEEPALIVE_5M_MAX_PINGS="0": not a whole number of 1 or more; in force: 20 (fiveMinute.maxPings in .ai-dlc/cache-keepalive.json)',
    ".claude/settings.local.json: AI_DLC_KEEPALIVE_NOPE: not a keep-alive setting; ignored",
    '.claude/settings.local.json: AI_DLC_KEEPALIVE_SCOPE="global": not session or machine; in force: "session" (scope in .ai-dlc/cache-keepalive.json)',
  ].sort());
  const r = cli(root, ["validate"]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^\.ai-dlc\/cache-keepalive\.json is valid$/m);
  assert.match(r.out, /^warning: \.claude\/settings\.local\.json: AI_DLC_KEEPALIVE_NOPE: not a keep-alive setting; ignored$/m);
  assert.doesNotMatch(r.out, /^error:/m);
});

test("validate: a gated variable in .claude/settings.json of an untrusted folder is a warning; one equal to its default is not reported", () => {
  const root = repo({
    ".ai-dlc/cache-keepalive.json": full(),
    ".claude/settings.json": { env: { AI_DLC_KEEPALIVE_BUDGET_MULTIPLIER: "0", AI_DLC_KEEPALIVE_ENABLED: "true", AI_DLC_KEEPALIVE_STATUS: "maybe" } },
    ".claude/settings.local.json": { env: { AI_DLC_KEEPALIVE_1H_MAX_PINGS: "3" } },
  });
  const u = validateEnv(root, keys, UNTRUSTED);
  assert.deepEqual(u.warnings, [
    ".claude/settings.json: AI_DLC_KEEPALIVE_BUDGET_MULTIPLIER: skipped, Claude Code does not trust this folder (the folder has no entry); set them in the env of .claude/settings.local.json instead (a keep-warm time also with /ai-dlc:cache-keepalive); in force: 2 (budgetMultiplier in .ai-dlc/cache-keepalive.json)",
    '.claude/settings.json: AI_DLC_KEEPALIVE_STATUS="maybe": not true or false; in force: true (status in .ai-dlc/cache-keepalive.json)',
  ]);
  const t = validateEnv(root, keys, TRUSTED);
  assert.deepEqual(t.warnings.map((w) => w.split(";")[0]), ['.claude/settings.json: AI_DLC_KEEPALIVE_STATUS="maybe": not true or false']);
});

test("validate: clean settings files and a valid file report no warning; a broken settings or repository file is a warning; every case exits 0", () => {
  const ok = repo({ ".ai-dlc/cache-keepalive.json": full(), ".claude/settings.local.json": "{\n  // mine\n  \"env\": { \"AI_DLC_KEEPALIVE_SCOPE\": \"machine\" }\n}\n" });
  const r = cli(ok, ["validate"]);
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /^warning:/m);
  assert.match(r.out, /variables in the settings files are valid/);
  const broken = repo({ ".ai-dlc/cache-keepalive.json": full(), ".claude/settings.json": "{ nope" });
  const b = cli(broken, ["validate"]);
  assert.equal(b.code, 0);
  assert.match(b.out, /^warning: \.claude\/settings\.json is not valid JSON \(comments allowed\); its env is skipped$/m);
  assert.deepEqual(validateEnv(broken, keys, TRUSTED).warnings, [".claude/settings.json is not valid JSON (comments allowed); its env is skipped"]);
  const badFile = repo({ ".ai-dlc/cache-keepalive.json": "{ nope" });
  const f = cli(badFile, ["validate"]);
  assert.equal(f.code, 0);
  assert.match(f.out, /^warning: \.ai-dlc\/cache-keepalive\.json: not valid JSON: .*; it is skipped, so the next level or the default applies to every key$/m);
  const none = repo();
  const n = cli(none, ["validate"]);
  assert.equal(n.code, 0, n.out);
  assert.match(n.out, /does not exist: the defaults apply \(run \/ai-dlc:cache-keepalive-install to write them\)/);
});

test("validate warns when a track's maxPings is below the pings its keep-warm time allows (the values in force; the folder here is untrusted, so the rows are built from the file)", () => {
  assert.deepEqual(capWarnings(rowsOf(full(), keys)), []);
  assert.deepEqual(capWarnings(rowsOf(full({ "fiveMinute.keepWarmFor": "2h" }), keys)), ["fiveMinute.maxPings is 20, but fiveMinute.keepWarmFor (2h) at fiveMinute.pingEvery (3m) allows 40 pings: the pings stop after 20; set fiveMinute.maxPings=40 to keep warm for the whole time"]);
  assert.deepEqual(capWarnings(rowsOf(full({ "fiveMinute.keepWarmFor": "2h", "fiveMinute.maxPings": 40 }), keys)), []);
  // A trusted folder: validate prints it.
  const root = repo({ ".ai-dlc/cache-keepalive.json": full({ "fiveMinute.keepWarmFor": "2h" }) });
  assert.deepEqual(capWarnings(effective(root, keys, TRUSTED).rows), capWarnings(rowsOf(full({ "fiveMinute.keepWarmFor": "2h" }), keys)));
});

// ---- the skill and init --------------------------------------------------------------------------
test("the skill is Claude-only, user-invoked, and init passes it keys the schema has", () => {
  const skill = fs.readFileSync(path.join(SKILL, "SKILL.md"), "utf8");
  assert.match(skill, /^---\r?\nname: cache-keepalive-configure\r?\n/);
  assert.match(skill, /\ndisable-model-invocation: true\r?\n/);
  assert.ok(JSON.parse(fs.readFileSync(path.join(REPO, "tools", "claude-only-skills.json"), "utf8")).includes("cache-keepalive-configure"));
  const init = fs.readFileSync(path.join(PLUGIN, "skills", "init", "SKILL.md"), "utf8");
  for (const name of ["install", "merge", "configure"]) assert.ok(init.includes(`\${CLAUDE_SKILL_DIR}/../cache-keepalive-${name}/SKILL.md`), name);
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
  assert.equal(doc.oneHour.ttl, "60m");
  const before = fs.readFileSync(FILE(root), "utf8");
  assert.match(cli(root, ["merge", "--dry-run"]).out, /^up to date$/m);
  assert.equal(cli(root, ["set", "oneHour.keepWarmFor=10h", "scope=machine"]).code, 0);
  assert.equal(fs.readFileSync(FILE(root), "utf8"), before);
  assert.equal(cli(root, ["validate"]).code, 0);
});

test("set writes the valid pairs and skips the bad one with a warning; exit 0", () => {
  const root = repo({ ".ai-dlc/cache-keepalive.json": full({ scope: "session" }) });
  const r = cli(root, ["set", "scope=machine", "oneHour.keepWarmFor=soon"]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^warning: oneHour\.keepWarmFor="soon" skipped: not a duration \(<n>m, <n>h or <n>d\); oneHour\.keepWarmFor stays "8h"$/m);
  assert.equal(fileOf(root).scope, "machine");
  assert.equal(fileOf(root).oneHour.keepWarmFor, "8h");
});

test("parseAssignment: text-kind values that parse as JSON stay the text typed; other kinds still read JSON; a missing kind reads JSON", () => {
  for (const kind of ["text", "duration", "minDuration", "prices"]) {
    for (const typed of ["123", "1.5", "true", "false", "[1]", '{"a":1}']) assert.deepEqual(parseAssignment(`k=${typed}`, kind), { key: "k", value: typed }, `${kind} ${typed}`);
    assert.deepEqual(parseAssignment("k=null", kind), { key: "k", value: null }, kind); // set refuses it
    assert.deepEqual(parseAssignment('k="1h"', kind), { key: "k", value: "1h" }, kind);
  }
  assert.deepEqual(parseAssignment("k=true", "boolean"), { key: "k", value: true });
  assert.deepEqual(parseAssignment("k=1.5", undefined), { key: "k", value: 1.5 });
  assert.deepEqual(parseAssignment("k=a=b", "text"), { key: "k", value: "a=b" });
  assert.throws(() => parseAssignment("=1", "text"), /expected <key>=<value>/);
  assert.throws(() => parseAssignment("nokey", "text"), /expected <key>=<value>/);
});

test("set: a bare number or boolean on a duration key is skipped as not a duration, never stored as a number; a text value is trimmed", () => {
  const root = repo();
  for (const arg of ["oneHour.keepWarmFor=10", "minDuration=true", "pingPrompt=   "]) {
    const r = cli(root, ["set", arg]);
    assert.equal(r.code, 0, arg);
    assert.match(r.out, /^warning: .* skipped: /m, arg);
  }
  const doc = fileOf(root);
  assert.equal(doc.oneHour.keepWarmFor, "8h");
  assert.equal(doc.minDuration, "1m");
  assert.equal(cli(root, ["set", "pingPrompt=  42  "]).code, 0);
  assert.equal(fileOf(root).pingPrompt, "42");
});

// ---- explicit defaults: coverage added by the SQA review (run AAW-20261023-keepalive-explicit-defaults) ----
// A minimal check of a document against the schema's own rules (type, required, additionalProperties,
// no null, minimum), since the repository tests carry no JSON Schema validator.
function schemaErrors(doc, node = schema, at = "") {
  const errs = [];
  const name = at.replace(/\.$/, "");
  if (node.type === "object") {
    if (doc === null || typeof doc !== "object" || Array.isArray(doc)) return [`${name || "root"}: not an object`];
    for (const k of node.required ?? []) if (!Object.hasOwn(doc, k)) errs.push(`${at}${k}: required`);
    for (const [k, v] of Object.entries(doc)) {
      const sub = node.properties[k];
      if (!sub) { if (node.additionalProperties === false) errs.push(`${at}${k}: not allowed`); continue; }
      errs.push(...schemaErrors(v, sub, `${at}${k}.`));
    }
    return errs;
  }
  if (doc === null) return [`${name}: null`];
  if (node.minimum !== undefined && typeof doc === "number" && doc < node.minimum) errs.push(`${name}: below minimum`);
  return errs;
}

describe("the schema rejects what the file may no longer hold", () => {
  test("a complete file of defaults is accepted; a null, a missing key, a missing track key and maxPings 0 are rejected", () => {
    assert.deepEqual(schemaErrors(full()), []);
    assert.deepEqual(schemaErrors(full({ status: null })), ["status: null"]);
    assert.deepEqual(schemaErrors(full({ "fiveMinute.maxPings": null })), ["fiveMinute.maxPings: null"]);
    const noScope = full(); delete noScope.scope;
    assert.deepEqual(schemaErrors(noScope), ["scope: required"]);
    const noTrackKey = full(); delete noTrackKey.oneHour.maxPings;
    assert.deepEqual(schemaErrors(noTrackKey), ["oneHour.maxPings: required"]);
    assert.deepEqual(schemaErrors(full({ "oneHour.maxPings": 0 })), ["oneHour.maxPings: below minimum"]);
    assert.deepEqual(schemaErrors({ ...full(), extra: 1 }), ["extra: not allowed"]);
  });

  test("both maxPings properties are whole numbers of 1 or more with the 9 and 20 defaults", () => {
    for (const [track, def] of [["oneHour", 9], ["fiveMinute", 20]]) {
      const p = schema.properties[track].properties.maxPings;
      assert.equal(p.type, "integer", track);
      assert.equal(p.minimum, 1, track);
      assert.equal(p.default, def, track);
    }
  });

  test("this repository's own file and schema are what merge writes: all keys, no null, maxPings 9 and 20, no finding", () => {
    const ownFile = JSON.parse(fs.readFileSync(path.join(REPO, ".ai-dlc", "cache-keepalive.json"), "utf8"));
    assert.deepEqual(schemaErrors(ownFile), []);
    for (const p of keys) assert.notEqual(at(ownFile, p.key), null, p.key);
    assert.equal(ownFile.oneHour.maxPings, 9);
    assert.equal(ownFile.fiveMinute.maxPings, 20);
    assert.deepEqual(validateDoc(ownFile, keys), []);
    const lf = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
    assert.equal(lf(path.join(REPO, ".ai-dlc", "cache-keepalive.schema.json")), lf(path.join(SKILL, "templates", "cache-keepalive.schema.json")));
  });
});

describe("maxPings must be 1 or more, in the CLI as in the module", () => {
  test("merge rewrites a legacy 0 given as a number or as text, on both tracks, and a null track is rebuilt", () => {
    const root = repo({ ".ai-dlc/cache-keepalive.json": { oneHour: { maxPings: "0" }, fiveMinute: { maxPings: 0, keepWarmFor: "30m" } } });
    const dry = cli(root, ["merge", "--dry-run"]);
    assert.match(dry.out, /^\+ oneHour\.maxPings: "0" -> 9$/m);
    assert.match(dry.out, /^\+ fiveMinute\.maxPings: 0 -> 20$/m);
    assert.equal(cli(root, ["merge"]).code, 0);
    const doc = fileOf(root);
    assert.equal(doc.oneHour.maxPings, 9);
    assert.equal(doc.fiveMinute.maxPings, 20);
    assert.equal(doc.fiveMinute.keepWarmFor, "30m"); // a neighbour is kept
    const nullTrack = repo({ ".ai-dlc/cache-keepalive.json": { oneHour: null } });
    assert.equal(cli(nullTrack, ["merge"]).code, 0);
    assert.deepEqual(schemaErrors(fileOf(nullTrack)), []);
    assert.equal(fileOf(nullTrack).oneHour.maxPings, 9);
  });

  test("merge leaves a valid maxPings alone, 1 included", () => {
    const root = repo({ ".ai-dlc/cache-keepalive.json": full({ "oneHour.maxPings": 1, "fiveMinute.maxPings": 50 }) });
    assert.equal(cli(root, ["merge"]).code, 0);
    assert.equal(fileOf(root).oneHour.maxPings, 1);
    assert.equal(fileOf(root).fiveMinute.maxPings, 50);
  });

  test("set rewrites a legacy 0 to the default while writing the valid pair, and lists it", () => {
    const root = repo({ ".ai-dlc/cache-keepalive.json": full({ "oneHour.maxPings": 0 }) });
    const r = cli(root, ["set", "scope=machine"]);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /^\+ oneHour\.maxPings: 0 -> 9$/m);
    assert.equal(fileOf(root).oneHour.maxPings, 9);
    assert.equal(fileOf(root).scope, "machine");
  });

  test("set accepts maxPings 1, and skips 1.5, text and a negative with the file keeping its value", () => {
    const root = repo();
    assert.equal(cli(root, ["set", "oneHour.maxPings=1"]).code, 0);
    assert.equal(fileOf(root).oneHour.maxPings, 1);
    for (const bad of ["oneHour.maxPings=1.5", "oneHour.maxPings=many", "oneHour.maxPings=-1"]) {
      const r = cli(root, ["set", bad]);
      assert.equal(r.code, 0, bad);
      assert.match(r.out, /skipped: not a whole number of 1 or more; oneHour\.maxPings stays 1$/m, bad);
    }
    assert.equal(fileOf(root).oneHour.maxPings, 1);
  });

  test("set refuses an unparsable file and leaves it as it was", () => {
    const root = repo({ ".ai-dlc/cache-keepalive.json": "{ nope" });
    assert.equal(cli(root, ["set", "scope=machine"]).code, 1);
    assert.equal(fs.readFileSync(FILE(root), "utf8"), "{ nope");
  });

  test("show: maxPings 0 or below from the file or either env falls back, with a warning each, to the default", () => {
    const root = repo({
      ".ai-dlc/cache-keepalive.json": full({ "oneHour.maxPings": 0 }),
      ".claude/settings.local.json": { env: { AI_DLC_KEEPALIVE_5M_MAX_PINGS: "0" } },
      ".claude/settings.json": { env: { AI_DLC_KEEPALIVE_5M_MAX_PINGS: "-3" } },
    });
    const r = effective(root, keys, TRUSTED);
    const oneHour = r.rows.find((x) => x.key === "oneHour.maxPings");
    assert.deepEqual([oneHour.value, oneHour.source], [9, "default"]);
    assert.equal(r.rows.find((x) => x.key === "fiveMinute.maxPings").value, 20);
    assert.equal(r.warnings.filter((w) => /max_?pings/i.test(w)).length, 3, r.warnings.join("\n"));
    assert.ok(r.warnings.includes('AI_DLC_KEEPALIVE_5M_MAX_PINGS="0" in .claude/settings.local.json ignored: not a whole number of 1 or more; falling back to the next source'), r.warnings.join("\n"));
    assert.ok(r.warnings.includes("oneHour.maxPings=0 in .ai-dlc/cache-keepalive.json ignored: not a whole number of 1 or more; falling back to the next source"), r.warnings.join("\n"));
  });

  test("a bad maxPings at the top level falls back to the next level, not the default, when a lower source holds a valid one", () => {
    const levels = [
      { where: ".claude/settings.local.json", byEnv: true, values: { AI_DLC_KEEPALIVE_1H_MAX_PINGS: "0" } },
      { where: ".claude/settings.json", byEnv: true, values: { AI_DLC_KEEPALIVE_1H_MAX_PINGS: "4" } },
      { where: ".ai-dlc/cache-keepalive.json", byEnv: false, values: { oneHour: { maxPings: 7 } } },
    ];
    const r = resolve(levels, keys);
    assert.equal(r.values["oneHour.maxPings"], 4);
    assert.equal(r.sources["oneHour.maxPings"], "AI_DLC_KEEPALIVE_1H_MAX_PINGS in .claude/settings.json");
    assert.equal(r.warnings.length, 1);
  });

  test("resolve agrees with resolveSettings when maxPings is 0 or text in the env and the file", { skip: skipReason }, () => {
    const levels = [
      { where: ".claude/settings.local.json", env: { AI_DLC_KEEPALIVE_1H_MAX_PINGS: "0", AI_DLC_KEEPALIVE_5M_MAX_PINGS: "12" } },
      { where: ".ai-dlc/cache-keepalive.json", json: { oneHour: { maxPings: 0 }, fiveMinute: { maxPings: "x" } } },
    ];
    const m = mod.resolveSettings(levels.map((l) => ({ where: l.where, by: l.env ? "env" : "json", values: l.env ?? l.json })));
    const c = resolve(levels.map((l) => ({ where: l.where, byEnv: !!l.env, values: l.env ?? l.json })), keys);
    assert.equal(c.values["oneHour.maxPings"], m.settings.oneHour.maxPings);
    assert.equal(c.values["fiveMinute.maxPings"], m.settings.fiveMinute.maxPings);
    assert.deepEqual([c.values["oneHour.maxPings"], c.values["fiveMinute.maxPings"]], [9, 12]);
    assert.deepEqual(c.warnings, m.warnings);
  });

  test("the 9 and 20 defaults are the pings the default keep-warm times allow at the default intervals", () => {
    const ms = (key) => checkValue(keys.find((p) => p.key === key), defaultOf(key), false, 0).value;
    for (const track of ["oneHour", "fiveMinute"]) assert.equal(defaultOf(`${track}.maxPings`), Math.floor(ms(`${track}.keepWarmFor`) / ms(`${track}.pingEvery`)), track);
  });
});

describe("the cap warning: maxPings below the pings the keep-warm time allows", () => {
  test("none at the exact boundary, one past it; both tracks can warn, each naming the value to set", () => {
    assert.deepEqual(capWarnings(rowsOf(full({ "oneHour.keepWarmFor": "450m" }), keys)), []); // 9 pings
    assert.equal(capWarnings(rowsOf(full({ "oneHour.keepWarmFor": "500m" }), keys)).length, 1); // 10 pings
    const both = capWarnings(rowsOf(full({ "oneHour.keepWarmFor": "1d", "fiveMinute.keepWarmFor": "2h" }), keys));
    assert.equal(both.length, 2);
    assert.match(both[0], /set oneHour\.maxPings=28 to keep warm/);
    assert.match(both[1], /set fiveMinute\.maxPings=40 to keep warm/);
  });

  test("validate prints it and still exits 0, for a keep-warm time raised by an env", () => {
    const root = repo({ ".ai-dlc/cache-keepalive.json": full(), ".claude/settings.local.json": { env: { AI_DLC_KEEPALIVE_1H_KEEP_WARM_FOR: "1d" } } });
    const r = cli(root, ["validate"]);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /^warning: oneHour\.maxPings is 9, but oneHour\.keepWarmFor \(1d\) at oneHour\.pingEvery \(50m\) allows 28 pings/m);
  });
});

describe("trust gating treats a value equal to its default as no change, in the CLI as in the module", () => {
  test("untrusted, a file of defaults (a duration in another unit, a padded price) gives no trust warning and keeps the file as the source", () => {
    const root = repo({ ".ai-dlc/cache-keepalive.json": full({ "oneHour.keepWarmFor": "480m", readPrice: " fable|mythos=0.025, opus[- ]?5[-. ]5=0.05, *=0.1 ", enabled: "yes" }) });
    const r = effective(root, keys, UNTRUSTED);
    assert.deepEqual(r.warnings, []);
    assert.equal(r.rows.find((x) => x.key === "oneHour.keepWarmFor").source, "oneHour.keepWarmFor in .ai-dlc/cache-keepalive.json");
  });

  test("untrusted, only the gated values that differ are named; the maxPings default of 9 is not", () => {
    const root = repo({ ".ai-dlc/cache-keepalive.json": full({ "oneHour.keepWarmFor": "2h", "oneHour.maxPings": 9, budgetMultiplier: 3 }) });
    const r = effective(root, keys, UNTRUSTED);
    const w = r.warnings.find((x) => x.includes("does not trust"));
    assert.ok(w.startsWith("oneHour.keepWarmFor, budgetMultiplier in .ai-dlc/cache-keepalive.json ignored"), w);
    assert.ok(!w.includes("maxPings"), w);
    assert.equal(r.rows.find((x) => x.key === "budgetMultiplier").value, 2);
  });

  test("untrusted, a default-equal gated env in .claude/settings.json applies quietly; one that differs is warned about", () => {
    const root = repo({ ".claude/settings.json": { env: { AI_DLC_KEEPALIVE_1H_MAX_PINGS: "9", AI_DLC_KEEPALIVE_5M_MAX_PINGS: "21" } } });
    const r = effective(root, keys, UNTRUSTED);
    assert.equal(r.warnings.length, 1, r.warnings.join("\n"));
    assert.match(r.warnings[0], /^AI_DLC_KEEPALIVE_5M_MAX_PINGS in the env of \.claude\/settings\.json ignored/);
    assert.equal(r.rows.find((x) => x.key === "oneHour.maxPings").source, "AI_DLC_KEEPALIVE_1H_MAX_PINGS in .claude/settings.json");
    assert.equal(r.rows.find((x) => x.key === "fiveMinute.maxPings").value, 20);
  });

  test("the module and the CLI skip the same gated keys of the same file", { skip: skipReason }, () => {
    const doc = full({ "oneHour.keepWarmFor": "2h", "fiveMinute.maxPings": 21, pingPrompt: "other", scope: "machine", "oneHour.maxPings": 9 });
    const root = repo({ ".ai-dlc/cache-keepalive.json": doc });
    const w = effective(root, keys, UNTRUSTED).warnings.find((x) => x.includes("does not trust"));
    assert.deepEqual(w.split(" in .ai-dlc")[0].split(", ").sort(), mod.gatedDiffering(doc, "json").sort());
  });

  test("untrusted, a null in a gated key leaves the same value in force in the CLI as in the module", { skip: skipReason }, () => {
    const doc = { enabled: null };
    const root = repo({ ".ai-dlc/cache-keepalive.json": doc });
    const c = effective(root, keys, UNTRUSTED);
    const m = mod.resolveSettings([{ where: ".ai-dlc/cache-keepalive.json", by: "json", values: config.withoutKeys(doc, mod.gatedDiffering(doc, "json")).values }]);
    assert.equal(c.rows.find((x) => x.key === "enabled").value, m.settings.enabled);
  });
});

describe("validate covers both settings envs and always exits 0", () => {
  test("a bad maxPings in either env is a warning naming the value in force; exit 0", () => {
    const root = repo({
      ".ai-dlc/cache-keepalive.json": full({ "oneHour.maxPings": 12 }),
      ".claude/settings.local.json": { env: { AI_DLC_KEEPALIVE_1H_MAX_PINGS: "0" } },
      ".claude/settings.json": { env: { AI_DLC_KEEPALIVE_5M_MAX_PINGS: "2.5" } },
    });
    // The folder is untrusted on this machine, so the CLI run checks the exit code and the text is checked with trust given.
    assert.equal(cli(root, ["validate"]).code, 0);
    assert.deepEqual(validateEnv(root, keys, TRUSTED).warnings.sort(), [
      '.claude/settings.json: AI_DLC_KEEPALIVE_5M_MAX_PINGS="2.5": not a whole number of 1 or more; in force: 20 (fiveMinute.maxPings in .ai-dlc/cache-keepalive.json)',
      '.claude/settings.local.json: AI_DLC_KEEPALIVE_1H_MAX_PINGS="0": not a whole number of 1 or more; in force: 12 (oneHour.maxPings in .ai-dlc/cache-keepalive.json)',
    ]);
  });

  test("a file with a null, a missing key and a 0 maxPings plus a bad env: every finding is a warning, no error line, exit 0", () => {
    const doc = full({ status: null, "oneHour.maxPings": 0 }); delete doc.scope;
    const root = repo({ ".ai-dlc/cache-keepalive.json": doc, ".claude/settings.json": { env: { AI_DLC_KEEPALIVE_ENABLED: "perhaps" } } });
    const r = cli(root, ["validate"]);
    assert.equal(r.code, 0, r.out);
    assert.doesNotMatch(r.out, /^error:/m);
    for (const want of [/status=null/, /scope: missing/, /oneHour\.maxPings=0: not a whole number of 1 or more; in force: 9 \(default\)/, /AI_DLC_KEEPALIVE_ENABLED/]) assert.match(r.out, want);
    assert.match(validateEnv(root, keys, TRUSTED).warnings[0], /AI_DLC_KEEPALIVE_ENABLED="perhaps": not true or false/);
    assert.match(r.out, /^keep-alive runs on the values in force above/m);
  });

  test("a settings file whose env is not an object is a warning, exit 0", () => {
    const root = repo({ ".ai-dlc/cache-keepalive.json": full(), ".claude/settings.json": { env: ["x"] } });
    const r = cli(root, ["validate"]);
    assert.equal(r.code, 0);
    assert.match(r.out, /^warning: \.claude\/settings\.json: env is not an object; skipped$/m);
  });
});

// ---- SQA round 2 (run AAW-20261023-keepalive-explicit-defaults) ------------------------------------
describe("the internal write recomputes maxPings from keepWarmFor", () => {
  test("boundaries on the 1h track (pingEvery 50m): exact multiples, one minute below, shorter than one interval", () => {
    const want = { "450m": 9, "449m": 8, "500m": 10, "499m": 9, "100m": 2, "99m": 1, "50m": 1, "49m": 1, "1m": 1 };
    for (const [keep, n] of Object.entries(want)) {
      const root = repo();
      const r = cli(root, ["set", `oneHour.keepWarmFor=${keep}`]);
      assert.equal(r.code, 0, `${keep}\n${r.out}`);
      assert.equal(fileOf(root).oneHour.maxPings, n, `1h ${keep}`);
      assert.equal(followingMaxPings(fileOf(root), "oneHour"), n, keep);
    }
  });

  test("boundaries on the 5m track (pingEvery 3m)", () => {
    const want = { "60m": 20, "59m": 19, "3m": 1, "2m": 1, "1d": 480 };
    for (const [keep, n] of Object.entries(want)) {
      const root = repo();
      assert.equal(cli(root, ["set", `fiveMinute.keepWarmFor=${keep}`]).code, 0, keep);
      assert.equal(fileOf(root).fiveMinute.maxPings, n, `5m ${keep}`);
    }
  });

  test("each track follows on its own: an explicit maxPings on one track does not stop the other from following", () => {
    const root = repo();
    const r = cli(root, ["set", "oneHour.keepWarmFor=10h", "oneHour.maxPings=4", "fiveMinute.keepWarmFor=2h"]);
    assert.equal(r.code, 0, r.out);
    assert.equal(fileOf(root).oneHour.maxPings, 4);
    assert.equal(fileOf(root).fiveMinute.maxPings, 40);
    assert.doesNotMatch(r.out, /^oneHour\.maxPings:.*follows/m);
    assert.match(r.out, /^fiveMinute\.maxPings: 20 -> 40 \(follows/m);
  });

  test("an explicit maxPings wins whichever side of keepWarmFor it is written, and when it equals the old value", () => {
    for (const [args, n] of [[["oneHour.maxPings=3", "oneHour.keepWarmFor=10h"], 3], [["oneHour.keepWarmFor=10h", "oneHour.maxPings=3"], 3], [["oneHour.keepWarmFor=10h", "oneHour.maxPings=9"], 9]]) {
      const root = repo();
      assert.equal(cli(root, ["set", ...args]).code, 0);
      assert.equal(fileOf(root).oneHour.maxPings, n, args.join(" "));
    }
  });

  test("a keepWarmFor that is skipped recomputes nothing, and the old maxPings stays", () => {
    const root = repo({ ".ai-dlc/cache-keepalive.json": full({ "oneHour.maxPings": 5 }) });
    for (const bad of ["oneHour.keepWarmFor=soon", "oneHour.keepWarmFor=0.5m"]) {
      const r = cli(root, ["set", bad]);
      assert.equal(r.code, 0, bad);
      assert.doesNotMatch(r.out, /follows/, bad);
    }
    assert.equal(fileOf(root).oneHour.maxPings, 5);
  });

  test("writing keepWarmFor again with the same value still recomputes (a hand-edited maxPings is brought back), but only that track's", () => {
    const root = repo({ ".ai-dlc/cache-keepalive.json": full({ "oneHour.maxPings": 5, "fiveMinute.maxPings": 7 }) });
    assert.equal(cli(root, ["set", "oneHour.keepWarmFor=8h"]).code, 0);
    assert.equal(fileOf(root).oneHour.maxPings, 9);
    assert.equal(fileOf(root).fiveMinute.maxPings, 7);
  });

  test("it follows the track's pingEvery in the file, not the default", () => {
    const root = repo({ ".ai-dlc/cache-keepalive.json": full({ "oneHour.pingEvery": "30m" }) });
    assert.equal(cli(root, ["set", "oneHour.keepWarmFor=10h"]).code, 0);
    assert.equal(fileOf(root).oneHour.maxPings, 20);
  });

  test("--dry-run prints the recomputed value and writes nothing; a missing file is created with it", () => {
    const root = repo();
    const dry = cli(root, ["set", "oneHour.keepWarmFor=10h", "--dry-run"]);
    assert.match(dry.out, /^oneHour\.maxPings: 9 -> 12 \(follows/m);
    assert.ok(!fs.existsSync(FILE(root)));
    assert.equal(cli(root, ["set", "oneHour.keepWarmFor=10h"]).code, 0);
    assert.equal(fileOf(root).oneHour.maxPings, 12);
    assert.deepEqual(validateDoc(fileOf(root), keys), []);
  });

  test("merge never recomputes: a maxPings set by hand survives it", () => {
    const root = repo({ ".ai-dlc/cache-keepalive.json": full({ "oneHour.keepWarmFor": "10h", "oneHour.maxPings": 3 }) });
    assert.equal(cli(root, ["merge"]).code, 0);
    assert.equal(fileOf(root).oneHour.maxPings, 3);
  });

  test("the recomputed value is always a whole number of 1 or more, so the file stays valid", () => {
    for (const keep of ["1m", "50m", "51m", "10h", "3d"]) {
      const root = repo();
      assert.equal(cli(root, ["set", `oneHour.keepWarmFor=${keep}`, `fiveMinute.keepWarmFor=${keep}`]).code, 0, keep);
      const doc = fileOf(root);
      for (const t of ["oneHour", "fiveMinute"]) assert.ok(Number.isSafeInteger(doc[t].maxPings) && doc[t].maxPings >= 1, `${t} ${keep}`);
      assert.deepEqual(validateDoc(doc, keys), [], keep);
    }
  });

  // Fixed defect (followingMaxPings): a pingEvery that is not a duration used to give NaN, written as
  // null. The value in force applies instead: the next level, here the default 50m.
  test("a file whose pingEvery is not a duration: maxPings follows the pingEvery in force (the default), never null", () => {
    const root = repo({ ".ai-dlc/cache-keepalive.json": full({ "oneHour.pingEvery": "soon" }) });
    const r = cli(root, ["set", "oneHour.keepWarmFor=10h"]);
    assert.equal(r.code, 0);
    const n = fileOf(root).oneHour.maxPings;
    assert.ok(Number.isSafeInteger(n) && n >= 1, `maxPings is ${n}`);
    assert.equal(n, 12);
    assert.match(r.out, /^oneHour\.maxPings: 9 -> 12 \(follows oneHour\.keepWarmFor 10h at oneHour\.pingEvery 50m\)$/m);
    // A pingEvery that breaks a rule (not shorter than ttl) gives way the same way.
    const rule = repo({ ".ai-dlc/cache-keepalive.json": full({ "fiveMinute.pingEvery": "6m" }) });
    assert.equal(cli(rule, ["set", "fiveMinute.keepWarmFor=2h"]).code, 0);
    assert.equal(fileOf(rule).fiveMinute.maxPings, 40);
    assert.equal(followingMaxPings(full({ "oneHour.pingEvery": null, "oneHour.keepWarmFor": "10h" }), "oneHour", keys), 12);
  });

  test("a personal keep-warm time in the env of settings.local.json comes with the matching MAX_PINGS, unless the change names maxPings; the Done line names the cap warning", () => {
    const skill = fs.readFileSync(path.join(SKILL, "SKILL.md"), "utf8").replace(/\r\n/g, "\n");
    const change = skill.slice(skill.indexOf("### change"));
    assert.match(change, /AI_DLC_KEEPALIVE_1H_KEEP_WARM_FOR[^\n]*also write[^\n]*AI_DLC_KEEPALIVE_1H_MAX_PINGS/);
    assert.match(change, /unless the change names `maxPings`/);
    assert.match(change.slice(change.indexOf("Done when")), /maxPings is/);
    // What the skill computes is what the CLI and the module enforce: with the pair, no cap warning.
    const root = repo({ ".ai-dlc/cache-keepalive.json": full(), ".claude/settings.local.json": { env: { AI_DLC_KEEPALIVE_1H_KEEP_WARM_FOR: "10h", AI_DLC_KEEPALIVE_1H_MAX_PINGS: "12" } } });
    assert.deepEqual(capWarnings(effective(root, keys, UNTRUSTED).rows), []);
    const alone = repo({ ".ai-dlc/cache-keepalive.json": full(), ".claude/settings.local.json": { env: { AI_DLC_KEEPALIVE_1H_KEEP_WARM_FOR: "10h" } } });
    assert.match(capWarnings(effective(alone, keys, UNTRUSTED).rows)[0], /^oneHour\.maxPings is 9, but oneHour\.keepWarmFor \(10h\)/);
  });
});

describe("install or merge, as init chooses (by whether the file exists)", () => {
  test("no file: install creates it and a second install refuses; with a file: merge twice is a no-op", () => {
    const root = repo();
    assert.equal(cli(root, ["install"]).code, 0);
    assert.match(cli(root, ["install"]).out, /^warning: .* already exists: run \/ai-dlc:cache-keepalive-merge/m);
    const before = fs.readFileSync(FILE(root), "utf8");
    assert.equal(cli(root, ["merge"]).code, 0);
    assert.equal(fs.readFileSync(FILE(root), "utf8"), before);
    assert.match(cli(root, ["merge"]).out, /^up to date$/m);
  });

  test("an empty or unparsable existing file counts as existing: install refuses it, merge reports it needs a hand fix (exit 1)", () => {
    for (const text of ["", "{ nope"]) {
      const root = repo({ ".ai-dlc/cache-keepalive.json": text });
      const i = cli(root, ["install"]);
      assert.equal(i.code, 0, text);
      assert.match(i.out, /already exists/);
      assert.equal(fs.readFileSync(FILE(root), "utf8"), text);
      assert.equal(cli(root, ["merge"]).code, 1, text);
    }
  });

  test("install --dry-run on an existing file and merge --dry-run on a missing one also warn and exit 0, writing nothing", () => {
    const has = repo({ ".ai-dlc/cache-keepalive.json": full() });
    assert.match(cli(has, ["install", "--dry-run"]).out, /already exists/);
    const none = repo();
    const m = cli(none, ["merge", "--dry-run"]);
    assert.equal(m.code, 0);
    assert.match(m.out, /does not exist: run \/ai-dlc:cache-keepalive-install/);
    assert.ok(!fs.existsSync(path.join(none, ".ai-dlc")));
  });

  test("a refusal prints only its warning, and leaves even a stale schema alone", () => {
    const root = repo({ ".ai-dlc/cache-keepalive.json": full(), ".ai-dlc/cache-keepalive.schema.json": "{}" });
    assert.equal(cli(root, ["install"]).out.trim().split("\n").length, 1);
    assert.equal(fs.readFileSync(path.join(root, ".ai-dlc", "cache-keepalive.schema.json"), "utf8"), "{}");
  });

  test("validate on a missing file points to install", () => {
    assert.match(cli(repo(), ["validate"]).out, /run \/ai-dlc:cache-keepalive-install to write them/);
  });

  test("init's SKILL.md chooses install when the file is missing and merge when it exists", () => {
    const init = fs.readFileSync(path.join(PLUGIN, "skills", "init", "SKILL.md"), "utf8");
    assert.match(init, /does not exist, read `\$\{CLAUDE_SKILL_DIR\}\/\.\.\/cache-keepalive-install\/SKILL\.md`/);
    assert.match(init, /when it exists, read `\$\{CLAUDE_SKILL_DIR\}\/\.\.\/cache-keepalive-merge\/SKILL\.md`/);
  });
});

describe("nothing tells a user to run set or the removed -config command", () => {
  const walkFiles = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".git", ".scratch", ".worktrees", "handoffs"].includes(e.name)) continue;
      const f = path.join(dir, e.name);
      if (e.isDirectory()) walkFiles(f, out); else if (/\.(md|mjs|ts|tsx|json)$/.test(e.name)) out.push(f);
    }
    return out;
  };

  test("no plugin file, README or doc names /ai-dlc:cache-keepalive-config (history in ATTRIBUTION.md excepted), and none says to run a command's set", () => {
    const files = [...walkFiles(PLUGIN), ...walkFiles(path.join(REPO, "plugins", "copilot")), path.join(REPO, "README.md"), path.join(REPO, "docs", "plugins.md")]
      .filter((f) => fs.existsSync(f) && !f.endsWith("ATTRIBUTION.md"));
    for (const f of files) {
      const text = fs.readFileSync(f, "utf8");
      assert.doesNotMatch(text, /cache-keepalive-config(?!ure)/, path.relative(REPO, f));
      assert.doesNotMatch(text, /(run|use|type|call)\s+`?\/ai-dlc:cache-keepalive[a-z-]*\s+set\b/i, path.relative(REPO, f));
    }
  });

  test("the CLI's own output never tells a user to run set or the removed command", () => {
    const bad = full({ status: null, "oneHour.maxPings": 0, scope: "x" });
    const outputs = [cli(repo(), ["validate"]).out, cli(repo(), ["show"]).out, cli(repo(), ["help"]).out, cli(repo({ ".ai-dlc/cache-keepalive.json": bad }), ["validate"]).out, cli(repo({ ".ai-dlc/cache-keepalive.json": bad }), ["show"]).out, cli(repo(), ["install"]).out, cli(repo(), ["merge"]).out];
    for (const o of outputs) assert.doesNotMatch(o, /run\s+(\/ai-dlc:\S+\s+)?set\b|cache-keepalive-config(?!ure)/i, o);
  });
});

// ---- SQA round 3 (run AAW-20261023-keepalive-explicit-defaults) ------------------------------------
describe("maxPings follows the pingEvery in force when the file's own pingEvery is unusable", () => {
  test("every kind of unusable pingEvery (a number, null, 0m, a blank, text, not shorter than the ttl) gives the default interval, on both tracks, never NaN or null", () => {
    for (const bad of [5, null, "0m", "", "abc", "60m", "-5m"]) {
      const one = repo({ ".ai-dlc/cache-keepalive.json": full({ "oneHour.pingEvery": bad }) });
      const r = cli(one, ["set", "oneHour.keepWarmFor=10h"]);
      assert.equal(r.code, 0, JSON.stringify(bad));
      assert.equal(fileOf(one).oneHour.maxPings, 12, `1h ${JSON.stringify(bad)}`);
      assert.match(r.out, /^oneHour\.maxPings: 9 -> 12 \(follows oneHour\.keepWarmFor 10h at oneHour\.pingEvery 50m\)$/m, JSON.stringify(bad));
      assert.doesNotMatch(r.out, /NaN|maxPings: .*-> null/);
    }
    for (const bad of [5, null, "0m", "abc", "5m", "6m"]) {
      const five = repo({ ".ai-dlc/cache-keepalive.json": full({ "fiveMinute.pingEvery": bad }) });
      const r = cli(five, ["set", "fiveMinute.keepWarmFor=2h"]);
      assert.equal(r.code, 0, JSON.stringify(bad));
      assert.equal(fileOf(five).fiveMinute.maxPings, 40, `5m ${JSON.stringify(bad)}`);
      assert.match(r.out, /at fiveMinute\.pingEvery 3m\)/, JSON.stringify(bad));
    }
  });

  test("a usable pingEvery in the file is used, and one written in the same call counts; the printed interval is the one in force", () => {
    const root = repo({ ".ai-dlc/cache-keepalive.json": full({ "oneHour.pingEvery": "30m" }) });
    const r = cli(root, ["set", "oneHour.keepWarmFor=10h"]);
    assert.match(r.out, /follows oneHour\.keepWarmFor 10h at oneHour\.pingEvery 30m\)/);
    assert.equal(fileOf(root).oneHour.maxPings, 20);
    const same = cli(repo(), ["set", "oneHour.keepWarmFor=10h", "oneHour.pingEvery=40m"]);
    assert.match(same.out, /^oneHour\.maxPings: 9 -> 15 \(follows oneHour\.keepWarmFor 10h at oneHour\.pingEvery 40m\)$/m);
  });

  test("a pingEvery below minDuration in the file falls back to the default interval, which is exempt from minDuration", () => {
    const root = repo({ ".ai-dlc/cache-keepalive.json": full({ minDuration: "10m", "fiveMinute.pingEvery": "4m" }) });
    assert.equal(cli(root, ["set", "fiveMinute.keepWarmFor=2h"]).code, 0);
    assert.equal(fileOf(root).fiveMinute.maxPings, 40);
  });

  test("one track's unusable interval does not touch the other track's recomputation", () => {
    const root = repo({ ".ai-dlc/cache-keepalive.json": full({ "fiveMinute.pingEvery": "soon" }) });
    assert.equal(cli(root, ["set", "oneHour.keepWarmFor=2h", "fiveMinute.keepWarmFor=2h"]).code, 0);
    assert.equal(fileOf(root).oneHour.maxPings, 2);
    assert.equal(fileOf(root).fiveMinute.maxPings, 40);
  });

  test("followingMaxPings itself: the default keys are loaded when none are passed, an unusable keepWarmFor also gives a whole number of 1 or more", () => {
    assert.equal(followingMaxPings(full({ "oneHour.keepWarmFor": "10h" }), "oneHour"), 12);
    assert.equal(followingMaxPings(full({ "fiveMinute.keepWarmFor": "soon" }), "fiveMinute"), 20);
    assert.equal(followingMaxPings(full({ "oneHour.keepWarmFor": "1m" }), "oneHour", keys), 1);
    for (const doc of [full({ "oneHour.pingEvery": "x" }), full({ "oneHour.keepWarmFor": null, "oneHour.pingEvery": null })]) {
      const n = followingMaxPings(doc, "oneHour", keys);
      assert.ok(Number.isSafeInteger(n) && n >= 1, String(n));
    }
  });
});

describe("the personal env pair: AI_DLC_KEEPALIVE_*_KEEP_WARM_FOR with its matching *_MAX_PINGS", () => {
  const pair = (track, keep, max) => {
    const v = track === "oneHour" ? "1H" : "5M";
    return repo({ ".ai-dlc/cache-keepalive.json": full(), ".claude/settings.local.json": { env: { [`AI_DLC_KEEPALIVE_${v}_KEEP_WARM_FOR`]: keep, ...(max === undefined ? {} : { [`AI_DLC_KEEPALIVE_${v}_MAX_PINGS`]: String(max) }) } } });
  };

  test("the formula the skill states (keep-warm time / pingEvery in force, rounded down, at least 1) is the one that clears the cap warning, and one less raises it", () => {
    const cases = [["oneHour", "450m", 9], ["oneHour", "449m", 8], ["oneHour", "500m", 10], ["oneHour", "10h", 12], ["oneHour", "30m", 1], ["oneHour", "1d", 28],
      ["fiveMinute", "60m", 20], ["fiveMinute", "59m", 19], ["fiveMinute", "2h", 40], ["fiveMinute", "2m", 1], ["fiveMinute", "3m", 1]];
    for (const [track, keep, n] of cases) {
      const ok = pair(track, keep, n);
      assert.deepEqual(capWarnings(effective(ok, keys, TRUSTED).rows), [], `${track} ${keep} -> ${n}`);
      assert.equal(effective(ok, keys, TRUSTED).rows.find((x) => x.key === `${track}.maxPings`).value, n);
      assert.deepEqual(validateEnv(ok, keys, TRUSTED).warnings, [], `${track} ${keep}`);
      if (n > 1) {
        const short = pair(track, keep, n - 1);
        assert.equal(capWarnings(effective(short, keys, TRUSTED).rows).length, 1, `${track} ${keep} -> ${n - 1}`);
      }
      // The same value the CLI's own write would give for the file.
      const doc = full({ [`${track}.keepWarmFor`]: keep });
      assert.equal(followingMaxPings(doc, track, keys), n, `${track} ${keep}`);
    }
  });

  test("the keep-warm time alone (no pair) keeps the old limit and warns, on both tracks, naming the value to pair it with", () => {
    for (const [track, keep, n] of [["oneHour", "10h", 12], ["fiveMinute", "2h", 40]]) {
      const w = capWarnings(effective(pair(track, keep), keys, TRUSTED).rows);
      assert.equal(w.length, 1);
      assert.ok(w[0].includes(`set ${track}.maxPings=${n} to keep warm`), w[0]);
    }
  });

  test("the pair's MAX_PINGS must itself be 1 or more: 0 or text is ignored with a warning, so the old limit stays and the cap warning shows", () => {
    for (const bad of ["0", "-1", "twelve", "1.5"]) {
      const root = pair("oneHour", "10h", bad);
      const warnings = validateEnv(root, keys, TRUSTED).warnings;
      assert.equal(warnings.length, 1, bad);
      assert.match(warnings[0], /AI_DLC_KEEPALIVE_1H_MAX_PINGS=.*: not a whole number of 1 or more; in force: 9 \(oneHour\.maxPings in \.ai-dlc\/cache-keepalive\.json\)$/, bad);
      assert.equal(capWarnings(effective(root, keys, TRUSTED).rows).length, 1, bad);
    }
    assert.deepEqual(validateEnv(pair("oneHour", "10h", 1), keys, TRUSTED).warnings, []); // 1 is valid (and caps the pings)
  });

  test("the skill states both tracks' variables, the rounding and the example", () => {
    const skill = fs.readFileSync(path.join(SKILL, "SKILL.md"), "utf8").replace(/\r\n/g, "\n");
    const change = skill.slice(skill.indexOf("### change"));
    assert.match(change, /`…_5M_KEEP_WARM_FOR`\)[^\n]*`…_5M_MAX_PINGS`\)/);
    assert.match(change, /rounded down, at least 1/);
    assert.match(change, /`10h` at `50m` is `"12"`/);
    assert.match(change, /that track's `pingEvery` in force/);
  });
});
