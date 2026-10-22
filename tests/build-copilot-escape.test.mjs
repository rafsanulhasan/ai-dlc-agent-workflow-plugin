// Tests for the `<` escaping in the Commands list tools/build-copilot.mjs generates: a purpose (outside a
// code span) containing `<agent>` must not read as an HTML tag, while the argument hint stays in its code span.
// Run from the repository root: node --test "tests/**/*.test.mjs"
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BEGIN = "<!-- demo:commands:begin -->";
const END = "<!-- demo:commands:end -->";
let tmp;
const p = (...a) => path.join(tmp, ...a);
const write = (rel, text) => { fs.mkdirSync(path.dirname(p(rel)), { recursive: true }); fs.writeFileSync(p(rel), text); };
const build = (...args) => spawnSync(process.execPath, [p("tools", "build-copilot.mjs"), ...args], { cwd: tmp, encoding: "utf8" });

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "build-escape-"));
  fs.mkdirSync(p("tools"), { recursive: true });
  fs.copyFileSync(path.join(REPO, "tools", "build-copilot.mjs"), p("tools", "build-copilot.mjs"));
  write("plugins/claude/demo/.claude-plugin/plugin.json", JSON.stringify({ name: "demo", version: "0.0.1", description: "demo", author: { name: "Test" } }));
  write("plugins/claude/demo/agents/helper.md", "---\nname: helper\ndescription: helps\n---\n\nBody.\n");
  write("plugins/claude/demo/skills/mem/SKILL.md", '---\nname: mem\ndescription: "Stores memory in ai-dlc-<agent> folders when a < b. More text."\nargument-hint: "<agent> | --all"\n---\n\nBody.\n');
  write("plugins/claude/demo/README.md", `# demo\n\n${BEGIN}\n${END}\n`);
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

test("a `<` in a purpose is written as &lt;, while the argument hint keeps its `<` inside a code span", () => {
  const r = build();
  assert.equal(r.status, 0, r.stderr);
  const readme = fs.readFileSync(p("plugins/claude/demo/README.md"), "utf8");
  const row = readme.split("\n").find((l) => l.includes("/demo:mem"));
  assert.ok(row, readme);
  assert.match(row, /ai-dlc-&lt;agent> folders when a &lt; b\./);
  assert.match(row, /`<agent> (\\)?\| --all`/);
  assert.equal(build("--check").status, 0);
});

test("the escape also reaches the Copilot copy of the list", () => {
  assert.equal(build().status, 0);
  const copy = fs.readFileSync(p("plugins/copilot/demo/README.md"), "utf8");
  assert.match(copy, /ai-dlc-&lt;agent> folders/);
});
