// Agreement between the hooks module (hooks/auto-handoff/config.ts) and the configure-auto-handoff CLI
// (skills/configure-auto-handoff/templates/auto-handoff.mjs). The CLI re-implements the module's value
// rules and its JSONC comment stripping because it runs outside Claude Code. This suite feeds both the
// same inputs and asserts the same outcome: unset, invalid, or valid with the same normalised value.
//
// Why here and not in the hooks suite: that suite's loader only lets a test import its own module files
// and "claude-code" (not node:fs, not the CLI, which imports node:fs). Here the module is imported as
// TypeScript through Node's type stripping (Node 22.18 and later, which CI's Node 22 resolves to).
// Run: node --test "tests/**/*.test.mjs". Temp folders only; nothing under plugins/ is written.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkValue, effective, loadSchema } from "../../plugins/claude/ai-dlc/skills/configure-auto-handoff/templates/auto-handoff.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CONFIG_TS = path.join(REPO, "plugins", "claude", "ai-dlc", "hooks", "auto-handoff", "config.ts");

let mod;
let skipReason;
try {
  mod = await import(pathToUrl(CONFIG_TS));
} catch (e) {
  // Type stripping is on by default from Node 22.18; before that the module cannot be loaded here.
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major > 22 || (major === 22 && minor >= 18)) throw e;
  skipReason = `Node ${process.versions.node} cannot import config.ts (needs 22.18 or later): ${e.message}`;
}
function pathToUrl(p) { return new URL(`file:///${p.replace(/\\/g, "/").replace(/^\/+/, "")}`).href; }

const { keys } = loadSchema();
const schemaOf = (key) => keys.find((p) => p.key === key);

const fromModule = (kind, raw, byEnv) => {
  const v = mod.check(kind, raw, byEnv);
  return v === null ? { state: "unset" } : v === undefined ? { state: "invalid" } : { state: "valid", value: v };
};
const fromCli = (key, raw, byEnv) => {
  const r = checkValue(schemaOf(key), raw, byEnv);
  return r.unset ? { state: "unset" } : r.error ? { state: "invalid" } : { state: "valid", value: r.value };
};
// A function or object is not a value either side may return; stringify would hide it, so tag it.
const show = (o) => JSON.stringify(o, (_k, v) => (typeof v === "function" ? `[function ${v.name}]` : v));

// [label, raw]. Every case is fed to every setting, from a file (byEnv false) and from the environment.
const CASES = [
  // not set
  ["undefined", undefined], ["null", null], ["empty text", ""], ["blank text", "  "], ["tab/newline text", "\t\n"],
  // boolean forms
  ["true", true], ["false", false], ['"true"', "true"], ['"FALSE"', "FALSE"], ['" Yes "', " Yes "], ['"no"', "no"],
  ['"on"', "on"], ['"OFF"', "OFF"], ['"1"', "1"], ['"0"', "0"], ['"2"', "2"], ['"maybe"', "maybe"], ['"t"', "t"],
  // whole numbers, ranges and shapes
  ["number 0", 0], ["number 1", 1], ["number 50", 50], ["number 100", 100], ["number 101", 101], ["number -1", -1],
  ["number 1.5", 1.5], ["NaN", NaN], ["Infinity", Infinity], ["-0", -0],
  ["2^53+1 (unsafe)", 9007199254740993], ["max safe integer", Number.MAX_SAFE_INTEGER],
  ['"0"', "0"], ['"1"', "1"], ['"100"', "100"], ['"101"', "101"], ['"007"', "007"], ['" 20000 "', " 20000 "],
  ['"1e3"', "1e3"], ['"+5"', "+5"], ['"-5"', "-5"], ['"5.0"', "5.0"], ['"0x10"', "0x10"], ['"9007199254740993"', "9007199254740993"],
  ["arabic digit", "٣"],
  // other types
  ["empty array", []], ["empty object", {}], ["array [1]", [1]],
  // path / text
  ["padded path", " ~/a b/c.md "], ["windows path", "C:\\x\\y.md"], ["plain word", "word"], ["bracketed prefix", "[ai-dlc:x]"],
  // regular expressions
  ['"("', "("], ['"[a-z]+"', "[a-z]+"], ['"x{2,1}"', "x{2,1}"], ["lone backslash", "\\"], ["named group", "(?<n>a)\\k<n>"],
  ["padded pattern", " pad "], ['"*"', "*"], ['"a|"', "a|"],
  // addresses
  ["host:80", "host:80"], ["host:8", "host:8"], ["host:10", "host:10"], ["host:0080", "host:0080"], ["host:65535", "host:65535"],
  ["host:65536", "host:65536"], ["host:100000", "host:100000"], ["padded address", " h:99 "], [":80", ":80"], ["host:", "host:"],
  ["space in host", "a b:80"], ["url", "http://x:80"], ["tailscale:3846", "tailscale:3846"], ["dotted host", "a.b-c_d:1000"],
  ["ipv4", "127.0.0.1:8080"], ["ipv6", "[::1]:8080"], ["non-ascii host", "ünï:80"], ["fullwidth port", "h:８０"],
  ["trailing newline", "h:80\n"], ["two colons", "a:b:80"], ["no colon", "foo"],
];

// Words that name an Object.prototype member: a lookup table of boolean words must not answer for them.
const PROTOTYPE_WORDS = ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__", "isPrototypeOf"];

describe("check (module) and checkValue (CLI) agree", { skip: skipReason }, () => {
  test("the module and the schema list the same keys in the same order", () => {
    assert.deepEqual(mod.SETTINGS.map((s) => s.key), keys.map((p) => p.key));
  });

  for (const key of keys.map((p) => p.key)) {
    test(`${key}: same outcome and value for every input, from a file and from the environment`, () => {
      const s = mod.SETTINGS.find((x) => x.key === key);
      const disagreements = [];
      for (const byEnv of [false, true]) {
        for (const [label, raw] of CASES) {
          const a = fromModule(s.kind, raw, byEnv);
          const b = fromCli(key, raw, byEnv);
          if (show(a) !== show(b)) disagreements.push(`${byEnv ? "env" : "file"} ${label}: module ${show(a)}, cli ${show(b)}`);
        }
      }
      assert.deepEqual(disagreements, []);
    });
  }

  // Regression guard (config.ts): BOOLS is a plain object, so a word that names an Object.prototype member
  // must not be "found" and returned as the setting's value (a function or object). The CLI uses
  // Object.hasOwn and rejects them. The module lower-cases first, so only the all-lowercase members
  // ("constructor", "__proto__") are reachable; the camelCase words are controls that must stay invalid.
  // Kept as its own test so the rest of the table stays green.
  for (const word of PROTOTYPE_WORDS) {
    test(`boolean kind (enabled key on the CLI side): "${word}" is invalid in the module and in the CLI`, () => {
      assert.deepEqual(fromCli("enabled", word, false), { state: "invalid" });
      assert.equal(show(fromModule("boolean", word, false)), show({ state: "invalid" }));
    });
  }
});

describe("whole-setting resolution and JSONC comments agree", { skip: skipReason }, () => {
  let tmp, n = 0;
  const trusted = { trusted: true, why: "" };
  before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ah-agree-")); });
  after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const repoWith = (files) => {
    const root = path.join(tmp, `r${++n}`);
    fs.mkdirSync(root, { recursive: true });
    for (const [rel, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), text);
    }
    return root;
  };

  test("a repository file, a process environment and bad values resolve to the same value and source per key", () => {
    const repoFile = { enabled: "no", thresholdPercent: 101, thresholdTokens: 5000, viewer: "h:8", seedHeadroomTokens: 0, ignoreFiles: "(", sessionNamePrefix: " P ", maxConsecutiveHandoffs: null };
    const processEnv = { AI_DLC_AUTO_HANDOFF_THRESHOLD_PERCENT: " 65 ", AI_DLC_AUTO_HANDOFF_ENABLED: "On", AI_DLC_AUTO_HANDOFF_VIEWER: "tailscale:3846", AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: "  " };
    const root = repoWith({ ".ai-dlc/auto-handoff.json": JSON.stringify(repoFile) });
    const cli = effective(root, keys, processEnv, trusted);
    const res = mod.resolveConfig([
      { where: "the environment", byEnv: true, values: processEnv },
      { where: ".ai-dlc/auto-handoff.json", byEnv: false, values: repoFile },
    ], {});
    const compared = [];
    for (const s of mod.SETTINGS) {
      const row = cli.rows.find((r) => r.key === s.key);
      const modSource = res.sources[s.key];
      // From a level on either side: the other side must name the same level. Defaults are not compared
      // by value: the CLI reports the schema default, the module its DEFAULTS constant.
      if (row.source.startsWith("default") || modSource === "default") {
        assert.equal(row.source.startsWith("default") && modSource === "default", true, `${s.key}: cli "${row.source}", module "${modSource}"`);
        continue;
      }
      const raw = res.cfg[s.field];
      const modValue = s.kind === "pattern" ? (raw ? raw.source : "") : raw;
      assert.deepEqual(row.value, modValue, `${s.key} value`);
      assert.equal(row.source, modSource, `${s.key} source`);
      compared.push(s.key);
    }
    // The fixture must exercise the levels, not just defaults.
    assert.ok(compared.includes("enabled") && compared.includes("thresholdPercent") && compared.includes("viewer") && compared.includes("sessionNamePrefix") && compared.includes("seedHeadroomTokens"), compared.join(","));
  });

  test("JSONC comments in a settings file are skipped the same way; // inside a string is kept", () => {
    const jsonc = [
      "\uFEFF{",
      '  // line comment with "quote" and /* nested start',
      '  "url": "http://x//y", /* block',
      "  comment */",
      '  "env": {',
      '    "AI_DLC_AUTO_HANDOFF_THRESHOLD_PERCENT": "70", // trailing',
      '    "AI_DLC_AUTO_HANDOFF_SESSION_NAME_PREFIX": "a//b /* c */ d\\"//e",',
      '    /* before key */ "AI_DLC_AUTO_HANDOFF_ENABLED": false',
      "  }",
      "}",
    ].join("\n");
    const root = repoWith({ ".claude/settings.json": jsonc });
    const env = mod.settingsEnv(jsonc).env;
    assert.ok(env, "the module parses the file");
    const cli = effective(root, keys, {}, trusted);
    const row = (k) => cli.rows.find((r) => r.key === k);
    assert.deepEqual(cli.warnings, []);
    assert.equal(row("thresholdPercent").value, Number(env.AI_DLC_AUTO_HANDOFF_THRESHOLD_PERCENT));
    assert.equal(row("sessionNamePrefix").value, env.AI_DLC_AUTO_HANDOFF_SESSION_NAME_PREFIX);
    assert.equal(row("enabled").value, env.AI_DLC_AUTO_HANDOFF_ENABLED);
  });

  for (const [label, text] of [
    ["an unterminated block comment", '{ "env": { "AI_DLC_AUTO_HANDOFF_ENABLED": false } /* never closed'],
    ["truncated JSON", '{ "env": '],
    ["a non-object top level", "[1]"],
    ["an env that is an array", '{ "env": [] }'],
    ["an env that is null", '{ "env": null }'],
  ]) {
    test(`${label}: both sides skip the file's env, and the CLI says so`, () => {
      const root = repoWith({ ".claude/settings.json": text });
      const m = mod.settingsEnv(text);
      const cli = effective(root, keys, {}, trusted);
      assert.equal(m.env === undefined, true, "module yields no env");
      assert.equal(cli.rows.find((r) => r.key === "enabled").source, "default");
      assert.equal(m.problem !== undefined, cli.warnings.length > 0, `module problem ${m.problem}, cli warnings ${show(cli.warnings)}`);
    });
  }
});
