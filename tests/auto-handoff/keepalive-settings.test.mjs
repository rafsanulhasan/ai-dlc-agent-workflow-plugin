// Keep-alive's one settings table (hooks/auto-handoff/keepalive/settings.ts) against everything that
// repeats its names: the ai-dlc manifest's /config rows, the keep-alive README's table, and the
// command's name everywhere it is written. The module's own behaviour is tested by `claude plugin test`
// (hooks/auto-handoff/tests/keepalive.test.ts); this suite needs node:fs, which that one cannot import.
// The table is imported as TypeScript through Node's type stripping (Node 22.18 and later).
// Run: node --test "tests/**/*.test.mjs".
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PLUGIN = path.join(REPO, "plugins", "claude", "ai-dlc");
const KEEPALIVE = path.join(PLUGIN, "hooks", "auto-handoff", "keepalive");
const toUrl = (p) => new URL(`file:///${p.replace(/\\/g, "/").replace(/^\/+/, "")}`).href;

let mod;
let skipReason;
try {
  mod = await import(toUrl(path.join(KEEPALIVE, "settings.ts")));
} catch (e) {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major > 22 || (major === 22 && minor >= 18)) throw e;
  skipReason = `Node ${process.versions.node} cannot import settings.ts (needs 22.18 or later): ${e.message}`;
}

const NUMBER_KINDS = new Set(["threshold", "ratio", "percent", "nonNegative", "positive", "whole", "positiveWhole"]);
const manifest = JSON.parse(fs.readFileSync(path.join(PLUGIN, ".claude-plugin", "plugin.json"), "utf8"));
const readme = fs.readFileSync(path.join(KEEPALIVE, "README.md"), "utf8").replace(/\r\n/g, "\n");

describe("keep-alive settings table", { skip: skipReason }, () => {
  test("every setting has one /config row, of the right type and with no default of its own", () => {
    const rows = Object.keys(manifest.userConfig).filter((k) => k.startsWith("keepalive"));
    assert.deepEqual(rows.sort(), mod.SETTINGS.map((s) => s.userConfig).sort());
    for (const s of mod.SETTINGS) {
      const row = manifest.userConfig[s.userConfig];
      const type = s.kind === "boolean" ? "boolean" : NUMBER_KINDS.has(s.kind) ? "number" : "string";
      assert.equal(row.type, type, s.userConfig);
      assert.ok(!("default" in row), `${s.userConfig} repeats a default: the defaults live in settings.ts alone`);
      assert.match(row.title, /^Keep-alive: /, s.userConfig);
      assert.ok(row.description.includes(s.env), `${s.userConfig} names its variable`);
    }
  });

  test("every variable is AI_DLC_KEEPALIVE_*, unique, and the defaults keep every rule", () => {
    assert.equal(new Set(mod.SETTINGS.map((s) => s.env)).size, mod.SETTINGS.length);
    for (const s of mod.SETTINGS) assert.match(s.env, /^AI_DLC_KEEPALIVE_[A-Z0-9_]+$/);
    const d = mod.defaults();
    for (const track of ["oneHour", "fiveMinute"]) assert.ok(d[track].pingEvery < d[track].ttl, track);
    assert.deepEqual(mod.resolveSettings([]).warnings, []);
  });

  test("the README's table lists every variable with its key and its default", () => {
    for (const s of mod.SETTINGS) {
      const shown = String(s.default).replace(/\|/g, "\\|");
      assert.ok(readme.includes(`| \`${s.env}\` | \`${s.key}\` | \`${shown}\` |`), `README row for ${s.env}`);
    }
    const listed = [...readme.matchAll(/^\| `(AI_DLC_KEEPALIVE_[A-Z0-9_]+)`/gm)].map((m) => m[1]);
    assert.deepEqual(listed.sort(), mod.SETTINGS.map((s) => s.env).sort());
  });
});

describe("keep-alive's trust gate", { skip: skipReason }, () => {
  // D2 (AAW-20261022-fold-cache-keepalive): in an untrusted folder, the two committed sources may not
  // set these: the spend and behaviour settings, and the two texts sent to the model.
  test("gates exactly the spend and behaviour settings and the two texts, each a real setting", () => {
    assert.deepEqual([...mod.TRUST_GATED].sort(), [
      "budgetMultiplier", "compactInstructions", "compactOnCap", "enabled",
      "fiveMinute.enabled", "fiveMinute.keepWarmFor", "fiveMinute.maxPings", "fiveMinute.pingEvery",
      "oneHour.enabled", "oneHour.keepWarmFor", "oneHour.maxPings", "oneHour.pingEvery", "pingPrompt",
    ]);
    const keys = new Set(mod.SETTINGS.map((s) => s.key));
    for (const k of mod.TRUST_GATED) assert.ok(keys.has(k), k);
    assert.deepEqual(mod.gatedNames("json").sort(), [...mod.TRUST_GATED].sort());
    assert.equal(mod.gatedNames("env").length, mod.TRUST_GATED.length);
    assert.ok(mod.gatedNames("env").every((n) => n.startsWith("AI_DLC_KEEPALIVE_")));
  });

  test("the README names every gated setting and both gated sources", () => {
    const trust = readme.slice(readme.indexOf("**Workspace trust.**"));
    assert.ok(trust.length > 20, "README has a Workspace trust paragraph");
    const para = trust.slice(0, trust.indexOf("\n\n"));
    for (const k of mod.TRUST_GATED) assert.ok(para.includes(`\`${k.split(".").pop()}\``), `README trust paragraph names ${k}`);
    assert.ok(para.includes("`.ai-dlc/cache-keepalive.json`") && para.includes("`.claude/settings.json`"));
  });
});

describe("the keep-alive command", () => {
  test("is /ai-dlc:keepalive: a plugin skill gives the name and the module answers it", () => {
    const skill = fs.readFileSync(path.join(PLUGIN, "skills", "keepalive", "SKILL.md"), "utf8");
    assert.match(skill, /^---\r?\nname: keepalive\r?\n/);
    assert.match(skill, /\ndisable-model-invocation: true\r?\n/);
    const code = fs.readFileSync(path.join(KEEPALIVE, "keepalive.ts"), "utf8");
    assert.match(code, /export const COMMAND = 'ai-dlc:keepalive'/);
    assert.match(code, /on\('command\.run', \{ command: COMMAND \}/);
    assert.ok(!code.includes("command.register"), "a hooks module can only register a bare name");
  });

  // ATTRIBUTION.md keeps the history, the old name included. The Copilot plugin is left out: its build
  // strips the ai-dlc: prefix from every command by design, and keep-alive does not exist there.
  test("no bare /keepalive is left in the Claude plugin, the README or CLAUDE.md", () => {
    const files = [path.join(REPO, "README.md"), path.join(REPO, "CLAUDE.md")];
    const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/\.(md|ts|tsx|json|mjs)$/.test(e.name) && e.name !== "ATTRIBUTION.md") files.push(f); } };
    walk(PLUGIN);
    // A slash command, not a path segment (./keepalive/, auto-handoff/keepalive) or a regex's \/keepalive.
    const bare = /(^|[^:\w/.\\-])\/keepalive\b/m;
    const found = files.filter((f) => bare.test(fs.readFileSync(f, "utf8"))).map((f) => path.relative(REPO, f));
    assert.deepEqual(found, []);
  });
});
