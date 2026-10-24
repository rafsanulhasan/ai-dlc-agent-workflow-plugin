// Tests that a plugin listed in tools/claude-only-plugins.json (Claude Code only, such as ai-dlc-lens) is
// never projected to Copilot: the build ignores its folder, refuses it as --plugin, and fails on a stale
// Copilot copy. Each fixture test builds a throwaway repository with a copy of the build script.
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
const build = (...args) => spawnSync(process.execPath, [p("tools", "build-copilot.mjs"), ...args], { encoding: "utf8", cwd: tmp });

function plugin(name) {
  write(`plugins/claude/${name}/.claude-plugin/plugin.json`, JSON.stringify({ name, version: "0.0.1", description: name, author: { name: "Test" } }, null, 2));
  write(`plugins/claude/${name}/agents/helper.md`, "---\nname: helper\ndescription: helps\n---\n\nBody.\n");
  write(`plugins/claude/${name}/skills/hello/SKILL.md`, "---\nname: hello\ndescription: says hello\n---\n\nHello.\n");
}

/** Two plugins: `demo` (projected) and `lensy` (a hooks module only); `list` is the claude-only-plugins.json content. */
function fixture({ list = ["lensy"] } = {}) {
  fs.mkdirSync(p("tools"), { recursive: true });
  fs.copyFileSync(BUILD, p("tools", "build-copilot.mjs"));
  plugin("demo");
  write("plugins/claude/lensy/.claude-plugin/plugin.json", JSON.stringify({ name: "lensy", version: "0.1.0", description: "lens", author: { name: "Test" } }, null, 2));
  write("plugins/claude/lensy/hooks/hooks.json", JSON.stringify({ modules: ["./register.tsx"] }));
  write("plugins/claude/lensy/hooks/register.tsx", "export const register = () => {}\n");
  if (list !== null) write("tools/claude-only-plugins.json", JSON.stringify(list));
}

beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "build-claude-only-plugins-")); });
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

test("a Claude-only plugin is ignored: the build picks the other plugin without --plugin and writes nothing for it", () => {
  fixture();
  const r = build();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Copilot plugin written to plugins[\\/]copilot[\\/]demo/);
  assert.ok(fs.existsSync(p("plugins", "copilot", "demo", "plugin.json")));
  assert.ok(!fs.existsSync(p("plugins", "copilot", "lensy")), "the Claude-only plugin must not be projected");
  assert.equal(build("--check").status, 0);
});

test("without the list, two plugin folders still need --plugin (the skip is explicit, never guessed)", () => {
  fixture({ list: null });
  const r = build();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Pick a plugin with --plugin <name> \(found: (demo, lensy|lensy, demo)\)/);
});

test("--plugin naming a Claude-only plugin fails with a clear message", () => {
  fixture();
  const r = build("--plugin", "lensy");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /lensy is Claude-only \(tools\/claude-only-plugins\.json\): it has no Copilot plugin/);
  assert.ok(!fs.existsSync(p("plugins", "copilot", "lensy")));
});

test("a listed name with no plugin folder fails the build", () => {
  fixture({ list: ["lensy", "ghost"] });
  const r = build();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /tools\/claude-only-plugins\.json: no plugin folder plugins\/claude\/ghost/);
});

test("a list that is not an array of names fails the build", () => {
  for (const bad of [{ lensy: true }, [""], [42]]) {
    fixture({ list: bad });
    const r = build();
    assert.equal(r.status, 1, `list ${JSON.stringify(bad)} built`);
    assert.match(r.stderr, /tools\/claude-only-plugins\.json: must be an array of plugin folder names/);
  }
});

test("a Copilot folder for a Claude-only plugin fails the build, also with --check", () => {
  fixture();
  write("plugins/copilot/lensy/plugin.json", "{}\n");
  for (const args of [[], ["--check"]]) {
    const r = build(...args);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /plugins\/copilot\/lensy exists, but lensy is Claude-only/);
  }
});

// The repository itself (AAW-20261023-lens-plugin-from-spike, stories US-4): ai-dlc-lens is Claude-only.
test("ai-dlc-lens is listed as Claude-only, has no Copilot plugin and is in the Claude marketplace only", () => {
  const list = JSON.parse(fs.readFileSync(path.join(REPO, "tools", "claude-only-plugins.json"), "utf8"));
  assert.ok(list.includes("ai-dlc-lens"));
  assert.ok(fs.existsSync(path.join(REPO, "plugins", "claude", "ai-dlc-lens", ".claude-plugin", "plugin.json")));
  assert.ok(!fs.existsSync(path.join(REPO, "plugins", "copilot", "ai-dlc-lens")));
  const claude = JSON.parse(fs.readFileSync(path.join(REPO, ".claude-plugin", "marketplace.json"), "utf8"));
  assert.equal(claude.plugins.find((e) => e.name === "ai-dlc-lens")?.source, "./plugins/claude/ai-dlc-lens");
  const copilot = JSON.parse(fs.readFileSync(path.join(REPO, ".github", "plugin", "marketplace.json"), "utf8"));
  assert.ok(!copilot.plugins.some((e) => e.name === "ai-dlc-lens"), "the Copilot marketplace must not list ai-dlc-lens");
});
