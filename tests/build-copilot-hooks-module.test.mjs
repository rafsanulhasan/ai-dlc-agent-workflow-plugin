// Tests that a Claude Code hooks module (a mod, such as ai-dlc's auto-handoff) never reaches the
// Copilot plugin: no module file, no hooks.json, no userConfig. Each test builds a throwaway fixture
// repository with a copy of the build script, so the real plugins are never touched.
// Run from the repository root: node --test "tests/**/*.test.mjs"
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUILD = path.join(REPO, "tools", "build-copilot.mjs");

let tmp;
const p = (...parts) => path.join(tmp, ...parts);
const write = (rel, text) => { fs.mkdirSync(path.dirname(p(rel)), { recursive: true }); fs.writeFileSync(p(rel), text); };
const read = (rel) => fs.readFileSync(p(rel), "utf8");
const build = (...args) => spawnSync(process.execPath, [p("tools", "build-copilot.mjs"), ...args], { encoding: "utf8", cwd: tmp });
const copilotFiles = () => {
  const out = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else out.push(path.relative(p("plugins/copilot/demo"), f).split(path.sep).join("/")); } };
  walk(p("plugins/copilot/demo"));
  return out.sort();
};

const USER_CONFIG = { threshold: { type: "number", title: "Threshold", description: "Tokens.", default: 160000 } };

function fixture({ hooks = { modules: ["./mod/register.tsx"] }, moduleAt = "hooks/mod" } = {}) {
  fs.copyFileSync(BUILD, (fs.mkdirSync(p("tools"), { recursive: true }), p("tools", "build-copilot.mjs")));
  write("plugins/claude/demo/.claude-plugin/plugin.json", JSON.stringify({ name: "demo", version: "0.0.1", description: "demo", author: { name: "Test" }, userConfig: USER_CONFIG }, null, 2));
  write("plugins/claude/demo/agents/helper.md", "---\nname: helper\ndescription: helps\n---\n\nBody.\n");
  write("plugins/claude/demo/skills/hello/SKILL.md", "---\nname: hello\ndescription: says hello\n---\n\nHello.\n");
  if (hooks) write("plugins/claude/demo/hooks/hooks.json", JSON.stringify(hooks));
  write(`plugins/claude/demo/${moduleAt}/register.tsx`, "export const register = () => {}\n");
  write(`plugins/claude/demo/${moduleAt}/templates/brief.md`, "## Next Step\n");
  write(`plugins/claude/demo/${moduleAt}/statusline/link.sh`, "#!/usr/bin/env bash\n");
  write(`plugins/claude/demo/${moduleAt}/tests/mod.test.tsx`, "test('x', () => {})\n");
}

beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "build-module-")); });
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

test("a hooks module under hooks/ leaves no module file, hooks.json or userConfig in the Copilot plugin", () => {
  fixture();
  const r = build();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /1 Claude-only hooks module\(s\) and 0 Claude-only skill\(s\) left out/);
  assert.deepEqual(copilotFiles(), ["GENERATED.md", "agents/helper.agent.md", "plugin.json", "skills/hello/SKILL.md"]);
  const manifest = JSON.parse(read("plugins/copilot/demo/plugin.json"));
  assert.ok(!("userConfig" in manifest), "userConfig leaked");
  assert.ok(!("hooks" in manifest), "hooks entry without hooks");
  assert.equal(build("--check").status, 0);
});

test("settings hooks next to modules are projected, the modules are not", () => {
  fixture({ hooks: { modules: ["./mod/register.tsx"], hooks: { Stop: [{ hooks: [{ type: "command", command: "node check.mjs" }] }] } } });
  assert.equal(build().status, 0);
  const hooks = JSON.parse(read("plugins/copilot/demo/hooks.json"));
  assert.deepEqual(Object.keys(hooks.hooks), ["agentStop"]);
  assert.ok(!read("plugins/copilot/demo/hooks.json").includes("register.tsx"));
  assert.ok(!copilotFiles().some((f) => f.includes("register.tsx") || f.endsWith(".test.tsx")));
});

test("a hooks module inside skills/ fails the build, since skills/ is copied", () => {
  fixture({ hooks: { modules: ["../skills/hello/mod/register.tsx"] }, moduleAt: "skills/hello/mod" });
  const r = build();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /hooks module skills\/hello\/mod\/register\.tsx is in skills\//);
  assert.ok(!fs.existsSync(p("plugins/copilot/demo")));
});

test("a mod test inside skills/ fails the build even without a modules entry", () => {
  fixture({ hooks: null });
  write("plugins/claude/demo/skills/hello/tests/mod.test.ts", "test('x', () => {})\n");
  const r = build();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /skills\/hello\/tests\/mod\.test\.ts: mod tests belong next to their hooks module/);
});

test("this repository's ai-dlc hooks module is Claude-only: hooks.json is modules only, nothing reaches Copilot", () => {
  const claude = path.join(REPO, "plugins", "claude", "ai-dlc");
  const copilot = path.join(REPO, "plugins", "copilot", "ai-dlc");
  const hooks = JSON.parse(fs.readFileSync(path.join(claude, "hooks", "hooks.json"), "utf8"));
  assert.deepEqual(Object.keys(hooks), ["modules"]);
  assert.deepEqual(hooks.modules, ["./auto-handoff/register.tsx"]);
  assert.ok(fs.existsSync(path.join(claude, "hooks", "auto-handoff", "register.tsx")));
  assert.ok(fs.existsSync(path.join(claude, "hooks", "auto-handoff", "LICENSE")));
  assert.ok(!fs.existsSync(path.join(copilot, "hooks.json")));
  assert.ok(!fs.existsSync(path.join(copilot, "hooks")));
  const manifest = JSON.parse(fs.readFileSync(path.join(copilot, "plugin.json"), "utf8"));
  assert.ok(!("userConfig" in manifest));
  assert.ok(!("hooks" in manifest));
  const claudeManifest = JSON.parse(fs.readFileSync(path.join(claude, ".claude-plugin", "plugin.json"), "utf8"));
  assert.ok(!("dependencies" in claudeManifest), "ai-dlc depends on no other plugin: keep-alive is part of its hooks module");
});

test("the session handoff template the hooks module ships has the handoff skill's sections, in order", () => {
  const headings = (text) => [...text.replace(/\r\n/g, "\n").matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
  const skill = fs.readFileSync(path.join(REPO, "plugins", "claude", "ai-dlc", "skills", "handoff", "SKILL.md"), "utf8").replace(/\r\n/g, "\n");
  const block = /```markdown\n# Session handoff: [\s\S]*?\n```/.exec(skill);
  assert.ok(block, "session handoff template block not found in skills/handoff/SKILL.md");
  const shipped = fs.readFileSync(path.join(REPO, "plugins", "claude", "ai-dlc", "hooks", "auto-handoff", "templates", "session-handoff.md"), "utf8");
  assert.deepEqual(headings(shipped), headings(block[0]));
});

test("a hooks module inside agents/ or scripts/ fails the build, too", () => {
  for (const dir of ["agents", "scripts"]) {
    fixture({ hooks: { modules: [`../${dir}/mod/register.tsx`] }, moduleAt: `${dir}/mod` });
    const r = build();
    assert.equal(r.status, 1, dir);
    assert.match(r.stderr, new RegExp(`hooks module ${dir}/mod/register\.tsx is in ${dir}/`));
    fs.rmSync(tmp, { recursive: true, force: true });
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "build-module-"));
  }
});

test("a mod test inside agents/ or scripts/ fails the build, nested paths included", () => {
  for (const rel of ["agents/sub/deep/x.test.tsx", "scripts/y.test.ts"]) {
    fixture({ hooks: null });
    write(`plugins/claude/demo/${rel}`, "test('x', () => {})\n");
    const r = build();
    assert.equal(r.status, 1, rel);
    assert.match(r.stderr, new RegExp(`${rel.replace(/\./g, "\.")}: mod tests belong next to their hooks module`));
    fs.rmSync(tmp, { recursive: true, force: true });
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "build-module-"));
  }
});

test("a module and its tests under hooks/ pass the guard, and a plain .test.md or .test.json in skills/ is not a mod test", () => {
  fixture();
  write("plugins/claude/demo/skills/hello/fixtures/data.test.json", "{}\n");
  write("plugins/claude/demo/skills/hello/notes.test.md", "x\n");
  const r = build();
  assert.equal(r.status, 0, r.stderr);
});

test("a build with no hooks.json reports zero hooks modules", () => {
  fixture({ hooks: null });
  const r = build();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /0 Claude-only hooks module\(s\) and 0 Claude-only skill\(s\) left out/);
});

test("a modules entry that is not a path string fails the build with a clear message", () => {
  for (const bad of [42, null, { path: "./mod/register.tsx" }, ""]) {
    fixture({ hooks: { modules: [bad] } });
    const r = build();
    assert.equal(r.status, 1, `entry ${JSON.stringify(bad)} built`);
    assert.match(r.stderr, /every "modules" entry must be a non-empty path string/, `entry ${JSON.stringify(bad)}`);
  }
});

// AC-1, AC-4, AC-5 (AAW-20261021-mods-config), revised by AAW-20261022-cache-keepalive-init: thresholdPercent
// lives in the configure-auto-handoff schema as a 1..100 integer defaulting to 80; no /config row, no token threshold.
test("thresholdPercent is a 1..100 integer defaulting to 80 in the schema, with no token threshold", () => {
  const schema = JSON.parse(fs.readFileSync(path.join(REPO, "plugins", "claude", "ai-dlc", "skills", "configure-auto-handoff", "templates", "auto-handoff.schema.json"), "utf8"));
  const field = schema.properties.thresholdPercent;
  assert.deepEqual(field.type, ["integer", "null"]);
  assert.equal(field.default, 80);
  assert.equal(field.minimum, 1);
  assert.equal(field.maximum, 100);
  assert.ok(!("threshold" in schema.properties), "the retired token threshold key must not come back");
});

test("the cache-keepalive mod is folded into ai-dlc: no mod folder, marketplace entry or CI loop is left", () => {
  assert.ok(!fs.existsSync(path.join(REPO, "plugins", "claude-mods")), "plugins/claude-mods/ should be gone");
  const market = JSON.parse(fs.readFileSync(path.join(REPO, ".claude-plugin", "marketplace.json"), "utf8"));
  assert.deepEqual(market.plugins.map((p) => p.name), ["ai-dlc"]);
  const ci = fs.readFileSync(path.join(REPO, ".github", "workflows", "validate.yml"), "utf8");
  assert.ok(!ci.includes("claude-mods"), "the CI loop over vendored mods should be gone");
  const keepalive = path.join(REPO, "plugins", "claude", "ai-dlc", "hooks", "keepalive");
  assert.ok(fs.existsSync(path.join(keepalive, "LICENSE")), "the upstream MIT LICENSE ships with the folded-in code");
  assert.match(fs.readFileSync(path.join(keepalive, "LICENSE"), "utf8"), /Copyright \(c\) 2026 RichardJSun/);
  assert.ok(fs.existsSync(path.join(keepalive, "ATTRIBUTION.md")), "keep-alive's attribution sits with its code");
});

// Keep-alive has its own folder, hooks/keepalive/ (AAW-20261023-keepalive-own-folder), and is not a
// module of its own: auto-handoff's register.tsx imports and registers it, and hooks.json lists one module.
test("keep-alive lives in hooks/keepalive/, registered by the auto-handoff module; nothing is left under auto-handoff", () => {
  const hooksDir = path.join(REPO, "plugins", "claude", "ai-dlc", "hooks");
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(hooksDir, "hooks.json"), "utf8")).modules, ["./auto-handoff/register.tsx"]);
  for (const f of ["keepalive.ts", "settings.ts", "duration.ts", "README.md", "LICENSE", "ATTRIBUTION.md", "tests/keepalive.test.ts"]) {
    assert.ok(fs.existsSync(path.join(hooksDir, "keepalive", f)), `hooks/keepalive/${f}`);
  }
  assert.ok(!fs.existsSync(path.join(hooksDir, "auto-handoff", "keepalive")), "hooks/auto-handoff/keepalive/ should be gone");
  assert.ok(!fs.existsSync(path.join(hooksDir, "auto-handoff", "tests", "keepalive.test.ts")));
  assert.match(fs.readFileSync(path.join(hooksDir, "auto-handoff", "register.tsx"), "utf8"), /from '\.\.\/keepalive\/keepalive\.ts'/);
});

// D3 (AAW-20261022-fold-cache-keepalive): skills that only work in Claude Code stay out of the Copilot plugin.
test("a skill listed in tools/claude-only-skills.json is left out of the Copilot plugin; the others are copied", () => {
  fixture({ hooks: null });
  write("plugins/claude/demo/skills/claude-thing/SKILL.md", "---\nname: claude-thing\ndescription: Claude only\n---\n\nRun /demo:claude-thing.\n");
  write("plugins/claude/demo/skills/claude-thing/references/notes.md", "notes\n");
  write("tools/claude-only-skills.json", JSON.stringify(["claude-thing"]));
  const r = build();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /and 1 Claude-only skill\(s\) left out/);
  assert.deepEqual(copilotFiles(), ["GENERATED.md", "agents/helper.agent.md", "plugin.json", "skills/hello/SKILL.md"]);
  assert.equal(build("--check").status, 0);
});

test("a Claude-only skill already in the Copilot plugin is removed by the next build, and --check reports it until then", () => {
  fixture({ hooks: null });
  write("plugins/claude/demo/skills/claude-thing/SKILL.md", "---\nname: claude-thing\ndescription: Claude only\n---\n\nBody.\n");
  assert.equal(build().status, 0);
  assert.ok(copilotFiles().includes("skills/claude-thing/SKILL.md"));
  write("tools/claude-only-skills.json", JSON.stringify(["claude-thing"]));
  assert.equal(build("--check").status, 1);
  assert.equal(build().status, 0);
  assert.ok(!copilotFiles().includes("skills/claude-thing/SKILL.md"));
});

test("a name in tools/claude-only-skills.json that is not a plugin skill fails the build", () => {
  fixture({ hooks: null });
  write("tools/claude-only-skills.json", JSON.stringify(["nope"]));
  const r = build();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /tools\/claude-only-skills\.json: no plugin skill "nope"/);
});

test("this repository's keep-alive skills are Claude-only: listed, and absent from the Copilot plugin", () => {
  const names = ["cache-keepalive", "cache-keepalive-configure", "cache-keepalive-install", "cache-keepalive-merge"];
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(REPO, "tools", "claude-only-skills.json"), "utf8")), names);
  for (const name of names) {
    assert.ok(fs.existsSync(path.join(REPO, "plugins", "claude", "ai-dlc", "skills", name, "SKILL.md")), name);
    assert.ok(!fs.existsSync(path.join(REPO, "plugins", "copilot", "ai-dlc", "skills", name)), name);
  }
});
