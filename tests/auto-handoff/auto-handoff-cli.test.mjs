// Tests for plugins/claude/ai-dlc/skills/configure-auto-handoff/templates/auto-handoff.mjs (the CLI behind
// /ai-dlc:configure-auto-handoff) and its agreement with the hooks module's settings table
// (plugins/claude/ai-dlc/hooks/auto-handoff/config.ts). Run from the repository root:
// node --test "tests/**/*.test.mjs". Each test works in a temp repository; nothing under plugins/ is written.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { checkValue, effective, loadSchema, merged, normPath, parseAssignment, trustOf, validateDoc } from "../../plugins/claude/ai-dlc/skills/configure-auto-handoff/templates/auto-handoff.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SKILL = path.join(REPO, "plugins", "claude", "ai-dlc", "skills", "configure-auto-handoff");
const CLI = path.join(SKILL, "templates", "auto-handoff.mjs");
const CONFIG_TS = path.join(REPO, "plugins", "claude", "ai-dlc", "hooks", "auto-handoff", "config.ts");
const { keys } = loadSchema();

let tmp, n = 0;
before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ah-test-")); });
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function repo(files = {}) {
  const root = path.join(tmp, `repo-${++n}`);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), typeof text === "string" ? text : JSON.stringify(text, null, 2));
  }
  fs.mkdirSync(root, { recursive: true });
  return root;
}
function cli(root, args, env = {}) {
  // The shell's AI_DLC_AUTO_HANDOFF_* variables never leak in; a test sets them through env.
  const base = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("AI_DLC_AUTO_HANDOFF_")));
  const r = spawnSync(process.execPath, [CLI, "--root", root, ...args], { encoding: "utf8", cwd: tmp, env: { ...base, ...env } });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
const fileOf = (root) => JSON.parse(fs.readFileSync(path.join(root, ".ai-dlc", "auto-handoff.json"), "utf8"));

// ---- one list of settings ----------------------------------------------------------------------
test("the schema and the hooks module list the same keys, variables and kinds, in the same order", () => {
  const source = fs.readFileSync(CONFIG_TS, "utf8");
  const rows = [...source.matchAll(/^\s*\{ key: '([^']+)', field: '[^']+', env: '([^']+)', kind: '([^']+)'(?:, userConfig: '([^']+)')? \},$/gm)]
    .map((m) => ({ key: m[1], env: m[2], kind: m[3], userConfig: m[4] }));
  assert.deepEqual(rows.map((r) => r.key), keys.map((p) => p.key));
  assert.deepEqual(rows.map((r) => r.env), keys.map((p) => p["x-env"]));
  assert.deepEqual(rows.map((r) => r.userConfig), keys.map((p) => p["x-userConfig"]));
  // Each module kind matches the schema's constraint.
  const kindOf = (p) => {
    const t = p.type.filter((x) => x !== "null")[0];
    if (t === "boolean") return "boolean";
    if (t === "integer") return p.maximum === 100 && p.minimum === 1 ? "percent" : p.minimum === 1 ? "positive" : "whole";
    if (p.format === "regex") return "pattern";
    if (p.format === "host-port") return "address";
    return p.minLength ? null : "unknown";
  };
  for (const [i, r] of rows.entries()) {
    const want = kindOf(keys[i]);
    if (want === null) assert.ok(["text", "path"].includes(r.kind), `${r.key}: ${r.kind}`);
    else assert.equal(r.kind, want, r.key);
  }
});

test("every key with a /config option exists in the plugin manifest's userConfig", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO, "plugins", "claude", "ai-dlc", ".claude-plugin", "plugin.json"), "utf8"));
  for (const p of keys.filter((x) => x["x-userConfig"])) assert.ok(manifest.userConfig[p["x-userConfig"]], p.key);
});

// ---- merge ---------------------------------------------------------------------------------------
test("merge creates the file with every key unset, and the schema next to it", () => {
  const root = repo();
  const r = cli(root, ["merge"]);
  assert.equal(r.code, 0, r.out);
  const doc = fileOf(root);
  assert.equal(doc.$schema, "./auto-handoff.schema.json");
  assert.deepEqual(Object.keys(doc).slice(1), keys.map((p) => p.key));
  assert.ok(Object.values(doc).slice(1).every((v) => v === null));
  assert.ok(fs.existsSync(path.join(root, ".ai-dlc", "auto-handoff.schema.json")));
});

test("merge adds new keys, removes retired ones and keeps every value set", () => {
  const root = repo({ ".ai-dlc/auto-handoff.json": { thresholdPercent: 65, viewer: "", oldKey: 3, enabled: false } });
  const dry = cli(root, ["merge", "--dry-run"]);
  assert.equal(dry.code, 0);
  assert.match(dry.out, /^\+ thresholdTokens: null$/m);
  assert.match(dry.out, /^- oldKey: 3$/m);
  assert.deepEqual(fileOf(root), { thresholdPercent: 65, viewer: "", oldKey: 3, enabled: false }, "dry run writes nothing");
  assert.equal(cli(root, ["merge"]).code, 0);
  const doc = fileOf(root);
  assert.equal(doc.thresholdPercent, 65);
  assert.equal(doc.viewer, "");
  assert.equal(doc.enabled, false);
  assert.equal(doc.thresholdTokens, null);
  assert.equal("oldKey" in doc, false);
  assert.deepEqual(Object.keys(doc), ["$schema", ...keys.map((p) => p.key)]);
  assert.match(cli(root, ["merge"]).out, /up to date/);
});

test("merged keeps values verbatim, even invalid ones, for validate to report", () => {
  const { text, added, removed } = merged({ thresholdPercent: "eighty", gone: 1 }, keys);
  assert.equal(JSON.parse(text).thresholdPercent, "eighty");
  assert.ok(added.includes("enabled"));
  assert.deepEqual(removed, ["gone"]);
});

test("merge refuses a file that is not JSON", () => {
  const root = repo({ ".ai-dlc/auto-handoff.json": "{ nope" });
  const r = cli(root, ["merge"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /not valid JSON/);
});

// ---- set and validate ----------------------------------------------------------------------------
test("set writes valid values, null unsets, and an invalid value changes nothing", () => {
  const root = repo();
  assert.equal(cli(root, ["set", "thresholdPercent=70", "renameSessions=false", "sessionNamePrefix=[handoff]"]).code, 0);
  let doc = fileOf(root);
  assert.equal(doc.thresholdPercent, 70);
  assert.equal(doc.renameSessions, false);
  assert.equal(doc.sessionNamePrefix, "[handoff]");
  assert.equal(cli(root, ["set", "thresholdPercent=null"]).code, 0);
  assert.equal(fileOf(root).thresholdPercent, null);
  const bad = cli(root, ["set", "thresholdPercent=150", "renameSessions=true"]);
  assert.equal(bad.code, 1);
  assert.match(bad.out, /thresholdPercent: 150 is above 100/);
  doc = fileOf(root);
  assert.equal(doc.renameSessions, false, "nothing written when one value is invalid");
  assert.equal(cli(root, ["set", "nope=1"]).code, 1);
});

test("validate passes a good file, reports unknown keys and invalid values, and accepts no file", () => {
  assert.equal(cli(repo(), ["validate"]).code, 0);
  assert.equal(cli(repo({ ".ai-dlc/auto-handoff.json": { $schema: "./auto-handoff.schema.json", thresholdTokens: 60000, ignoreFiles: "" } }), ["validate"]).code, 0);
  const r = cli(repo({ ".ai-dlc/auto-handoff.json": { thresholdTokens: 0, ignoreFiles: "(", extra: true } }), ["validate"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /thresholdTokens: 0 is below 1/);
  assert.match(r.out, /ignoreFiles: "\(" is not a valid regular expression/);
  assert.match(r.out, /extra: not a setting/);
  assert.deepEqual(validateDoc({ enabled: "yes" }, keys), []);
});

// ---- show: precedence ----------------------------------------------------------------------------
test("show resolves settings.local.json env, then settings.json env, then the environment, then the file, then the default", () => {
  const tokens = (v) => ({ env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: v } });
  const all = {
    ".claude/settings.local.json": tokens("30000"),
    ".claude/settings.json": "{\n  // team\n  \"env\": { \"AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS\": 40000 }\n}",
    ".ai-dlc/auto-handoff.json": { thresholdTokens: 60000, thresholdPercent: 70 },
  };
  const row = (root, env, key = "thresholdTokens") => {
    const out = JSON.parse(cli(root, ["show", "--json"], env).out);
    return out.settings.find((r) => r.key === key);
  };
  const env = { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: "50000" };
  assert.deepEqual(row(repo(all), env), { key: "thresholdTokens", value: 30000, source: "AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS in .claude/settings.local.json" });
  const noLocal = { ...all }; delete noLocal[".claude/settings.local.json"];
  assert.equal(row(repo(noLocal), env).value, 40000);
  const fileOnly = { ".ai-dlc/auto-handoff.json": all[".ai-dlc/auto-handoff.json"] };
  assert.equal(row(repo(fileOnly), env).value, 50000);
  assert.deepEqual(row(repo(fileOnly), {}), { key: "thresholdTokens", value: 60000, source: "thresholdTokens in .ai-dlc/auto-handoff.json" });
  assert.deepEqual(row(repo(), {}, "thresholdPercent"), { key: "thresholdPercent", value: 80, source: "default, unless set in /config" });
  assert.deepEqual(row(repo(), {}, "enabled"), { key: "enabled", value: true, source: "default" });
});

test("show reports an invalid value and falls through", () => {
  const root = repo({ ".claude/settings.local.json": { env: { AI_DLC_AUTO_HANDOFF_ENABLED: "maybe" } }, ".ai-dlc/auto-handoff.json": { enabled: false } });
  const { rows, warnings } = effective(root, keys, {});
  assert.deepEqual(rows.find((r) => r.key === "enabled"), { key: "enabled", value: false, source: "enabled in .ai-dlc/auto-handoff.json" });
  assert.deepEqual(warnings, ['AI_DLC_AUTO_HANDOFF_ENABLED="maybe" in .claude/settings.local.json ignored: not true or false; falling back to the next source']);
});

test("show prints a table", () => {
  const r = cli(repo(), ["show"]);
  assert.equal(r.code, 0);
  assert.match(r.out, /^\| `thresholdTokens` \| unset \| default \|$/m);
});

// ---- values --------------------------------------------------------------------------------------
test("checkValue follows the module's rules", () => {
  const p = (key) => keys.find((x) => x.key === key);
  assert.deepEqual(checkValue(p("enabled"), "OFF", true), { value: false });
  assert.deepEqual(checkValue(p("thresholdTokens"), "  ", true), { unset: true });
  assert.deepEqual(checkValue(p("thresholdTokens"), "007", true), { error: "not a whole number" });
  assert.deepEqual(checkValue(p("seedHeadroomTokens"), 0, false), { value: 0 });
  assert.deepEqual(checkValue(p("viewer"), " ", false), { value: "" });
  assert.deepEqual(checkValue(p("ignoreFiles"), "\\.lock$", false), { value: "\\.lock$" });
  assert.deepEqual(checkValue(p("briefTemplate"), "", false), { error: "blank" });
  assert.deepEqual(parseAssignment("viewer="), { key: "viewer", value: "" });
  assert.deepEqual(parseAssignment("ignoreFiles=a=b"), { key: "ignoreFiles", value: "a=b" });
});

test("capabilities reports a missing record without failing", () => {
  const home = path.join(tmp, `home-${++n}`);
  fs.mkdirSync(home);
  const r = cli(repo(), ["capabilities"], { HOME: home, USERPROFILE: home });
  assert.equal(r.code, 0);
  assert.match(r.out, /not recorded/);
  fs.mkdirSync(path.join(home, ".claude", "state", "auto-handoff"), { recursive: true });
  fs.writeFileSync(path.join(home, ".claude", "state", "auto-handoff", "capabilities.json"), JSON.stringify({ checkedAt: "2026-10-22T10:00:00Z", claudeCodeVersion: "2.1.306", rename: false }));
  assert.match(cli(repo(), ["capabilities"], { HOME: home, USERPROFILE: home }).out, /\/rename is NOT available/);
});

// ---- viewer address (W2) -------------------------------------------------------------------------
test("viewer must be blank or host:port, in checkValue, set and validate", () => {
  const viewer = keys.find((p) => p.key === "viewer");
  assert.deepEqual(checkValue(viewer, " tailscale:3846 ", false), { value: "tailscale:3846" });
  assert.deepEqual(checkValue(viewer, "", false), { value: "" });
  for (const bad of ["foo", "host:", ":80", "host:0080", "host:70000", "host:8", "http://x:80"]) assert.deepEqual(checkValue(viewer, bad, false), { error: "not host:port" }, bad);
  const root = repo();
  const r = cli(root, ["set", "viewer=foo"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /viewer: "foo" is not host:port/);
  assert.equal(cli(root, ["set", "viewer=127.0.0.1:3846"]).code, 0);
  assert.equal(cli(repo({ ".ai-dlc/auto-handoff.json": { viewer: "foo" } }), ["validate"]).code, 1);
});

test("the schema's viewer pattern accepts what the CLI accepts", () => {
  const viewer = keys.find((p) => p.key === "viewer");
  const re = new RegExp(viewer.pattern);
  for (const v of ["", "tailscale:3846", "127.0.0.1:65535"]) assert.ok(re.test(v), v);
  for (const v of ["foo", "host:0080", "host:8"]) assert.ok(!re.test(v), v);
});

// ---- workspace trust (W1) -----------------------------------------------------------------------
test("the trust-gated keys are viewer, briefTemplate and instructionsTemplate", () => {
  assert.deepEqual(keys.filter((p) => p["x-trustGated"]).map((p) => p.key), ["briefTemplate", "instructionsTemplate", "viewer"]);
  // The hooks module gates the same keys, in the same order.
  const gated = /export const TRUST_GATED = \[([^\]]*)\] as const/.exec(fs.readFileSync(CONFIG_TS, "utf8"));
  assert.ok(gated, "TRUST_GATED not found in config.ts");
  assert.deepEqual([...gated[1].matchAll(/'([^']+)'/g)].map((m) => m[1]), ["briefTemplate", "instructionsTemplate", "viewer"]);
});

test("trustOf matches keys case-insensitively with either separator, and fails closed", () => {
  const json = (projects) => JSON.stringify({ projects });
  assert.equal(trustOf(json({ "E:\\Repo\\": { hasTrustDialogAccepted: true } }), { root: "e:/repo" }).trusted, true);
  assert.equal(trustOf(json({ "e:/repo": { hasTrustDialogAccepted: "true" } }), { root: "e:/repo" }).trusted, false);
  assert.equal(trustOf(json({ "/work": { hasTrustDialogAccepted: true } }), { start: "/work/a/b" }).trusted, true);
  assert.equal(trustOf(json({ "/work": { hasTrustDialogAccepted: true } }), { root: "/work/a" }).trusted, false);
  assert.deepEqual(trustOf(undefined, { root: "/a" }), { trusted: false, why: "~/.claude.json was not readable" });
  assert.deepEqual(trustOf("{", { root: "/a" }), { trusted: false, why: "~/.claude.json is not valid JSON" });
  assert.equal(normPath("C:\\A\\"), "c:/a");
});

test("show skips the trust-gated keys of an untrusted folder, says so, and keeps the rest", () => {
  const root = repo({ ".ai-dlc/auto-handoff.json": { viewer: "0.0.0.0:3846", briefTemplate: "/x.md", thresholdTokens: 60000 } });
  const untrusted = effective(root, keys, {}, { trusted: false, why: "the folder has no entry" });
  assert.deepEqual(untrusted.rows.find((r) => r.key === "viewer"), { key: "viewer", value: "", source: "default, unless set in /config" });
  assert.equal(untrusted.rows.find((r) => r.key === "thresholdTokens").value, 60000);
  assert.deepEqual(untrusted.warnings, ["briefTemplate, viewer in .ai-dlc/auto-handoff.json ignored: Claude Code does not trust this folder (the folder has no entry); set them in the env of .claude/settings.local.json or in /config instead"]);
  const trusted = effective(root, keys, {}, { trusted: true, why: "" });
  assert.equal(trusted.rows.find((r) => r.key === "viewer").value, "0.0.0.0:3846");
  assert.deepEqual(trusted.warnings, []);
});

test("show reads trust from ~/.claude.json for the repository root", () => {
  const root = repo({ ".ai-dlc/auto-handoff.json": { viewer: "127.0.0.1:3846" } });
  const home = path.join(tmp, `home-${++n}`);
  fs.mkdirSync(home);
  const env = { HOME: home, USERPROFILE: home };
  const viewerOf = () => JSON.parse(cli(root, ["show", "--json"], env).out).settings.find((r) => r.key === "viewer").value;
  assert.equal(viewerOf(), "", "no ~/.claude.json: untrusted");
  fs.writeFileSync(path.join(home, ".claude.json"), JSON.stringify({ projects: { [root.replace(/\\/g, "/").toUpperCase()]: { hasTrustDialogAccepted: true } } }));
  assert.equal(viewerOf(), "127.0.0.1:3846", "trusted (the temp folder is not a repository, so the folder itself is the key)");
});
