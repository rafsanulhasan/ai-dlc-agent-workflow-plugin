// Tests for the Commands list tools/build-copilot.mjs generates from the skills' frontmatter into the
// marked region of the plugin's README.md (and its Copilot copy), the repository README.md and
// docs/plugins.md. Each test builds a throwaway fixture repository with a copy of the build script.
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
const BEGIN = "<!-- demo:commands:begin -->";
const END = "<!-- demo:commands:end -->";

let tmp;
const p = (...parts) => path.join(tmp, ...parts);
const write = (rel, text) => { fs.mkdirSync(path.dirname(p(rel)), { recursive: true }); fs.writeFileSync(p(rel), text); };
const read = (rel) => fs.readFileSync(p(rel), "utf8");
const build = (...args) => spawnSync(process.execPath, [p("tools", "build-copilot.mjs"), ...args], { encoding: "utf8", cwd: tmp });
const region = (text) => text.slice(text.indexOf(BEGIN), text.indexOf(END) + END.length);
const skill = (name, fm) => write(`plugins/claude/demo/skills/${name}/SKILL.md`, `---\nname: ${name}\n${fm}\n---\n\nBody.\n`);

function fixture() {
  fs.copyFileSync(BUILD, (fs.mkdirSync(p("tools"), { recursive: true }), p("tools", "build-copilot.mjs")));
  write("plugins/claude/demo/.claude-plugin/plugin.json", JSON.stringify({ name: "demo", version: "0.0.1", description: "demo", author: { name: "Test" } }, null, 2));
  write("plugins/claude/demo/agents/helper.md", "---\nname: helper\ndescription: helps\n---\n\nBody.\n");
  skill("hello", 'description: "Says hello. Then it waits for e.g. a reply."\nargument-hint: "[name | --loud]"');
  skill("keep", 'description: "Keeps the cache warm (Claude Code only). More text."\ndisable-model-invocation: true');
  skill("only", "description: Claude-only by list. More.");
  skill("hidden", "description: An internal step.\nuser-invocable: false");
  write("tools/claude-only-skills.json", JSON.stringify(["only"]));
  write("tools/overlays/non-claude/skills/scratch/SKILL.md", "---\nname: scratch\ndescription: Scratch folder. More.\n---\n\nBody.\n");
  write("plugins/claude/demo/README.md", `# demo\n\nUse /demo:hello.\n\n## Commands\n\n${BEGIN}\nstale\n${END}\n\n## End\n`);
  write("README.md", `# repo\n\n${BEGIN}\n${END}\n`);
  write("docs/plugins.md", `# plugins\n\n${BEGIN}\n${END}\n`);
}

beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "build-commands-")); fixture(); });
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

test("the plugin README, the repository README and docs/plugins.md get the same full list, from the frontmatter", () => {
  const r = build();
  assert.equal(r.status, 0, r.stderr);
  const plugin = read("plugins/claude/demo/README.md");
  assert.equal(region(read("README.md")), region(plugin));
  assert.equal(region(read("docs/plugins.md")), region(plugin));
  const list = region(plugin);
  assert.match(list, /^\| `\/demo:hello` \| `\[name \\\| --loud\]` \| Says hello\. \|$/m); // first sentence; pipes escaped
  assert.match(list, /^\| `\/demo:keep` \| — \| Keeps the cache warm\. \*\*Claude Code only\.\*\* \|$/m); // marked once
  assert.match(list, /^\| `\/demo:only` \| — \| Claude-only by list\. \*\*Claude Code only\.\*\* \|$/m);
  assert.doesNotMatch(list, /hidden/); // user-invocable: false
  assert.doesNotMatch(list, /scratch/); // overlay skills are Copilot's only
  assert.doesNotMatch(list, /stale/);
  assert.match(plugin, /^Use \/demo:hello\.$/m); // the rest of the file is left alone
  assert.match(plugin, /\n## End\n$/);
  // Sorted by name.
  const names = [...list.matchAll(/^\| `\/demo:([a-z-]+)`/gm)].map((m) => m[1]);
  assert.deepEqual(names, ["hello", "keep", "only"]);
});

test("the Copilot plugin's README has Copilot names, the overlay skills, and the Claude-only commands marked not available", () => {
  assert.equal(build().status, 0);
  const copilot = read("plugins/copilot/demo/README.md");
  assert.match(copilot, /^Use \/hello\.$/m); // the namespace is stripped outside the list too
  const list = region(copilot);
  assert.match(list, /^\| `\/hello` \|/m);
  assert.match(list, /^\| `\/keep` \| — \| Keeps the cache warm\. \*\*Not available in GitHub Copilot\*\* \(Claude Code only\)\. \|$/m);
  assert.match(list, /^\| `\/only` \| — \| Claude-only by list\. \*\*Not available in GitHub Copilot\*\* \(Claude Code only\)\. \|$/m);
  assert.match(list, /^\| `\/scratch` \| — \| Scratch folder\. \|$/m);
  assert.ok(copilot.includes(BEGIN), "the marker keeps its namespace");
});

test("--check fails when a copy drifts or a skill's frontmatter changes, and passes after a rebuild", () => {
  assert.equal(build().status, 0);
  assert.equal(build("--check").status, 0);
  write("docs/plugins.md", read("docs/plugins.md").replace("Says hello.", "Says hi."));
  let r = build("--check");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /docs\/plugins\.md/);
  assert.equal(build().status, 0);
  skill("hello", 'description: "Greets you. More."');
  r = build("--check");
  assert.equal(r.status, 1);
  for (const f of ["README.md", "docs/plugins.md", "plugins/claude/demo/README.md"]) assert.match(r.stderr, new RegExp(f.replace(/[./]/g, "\\$&")));
  assert.equal(build().status, 0);
  assert.match(read("README.md"), /Greets you\./);
  assert.equal(build("--check").status, 0);
});

test("a file without the markers is left alone; a file with only one marker fails the build", () => {
  write("README.md", "# repo\n\nNo list here.\n");
  assert.equal(build().status, 0);
  assert.equal(read("README.md"), "# repo\n\nNo list here.\n");
  write("docs/plugins.md", `# plugins\n\n${BEGIN}\n`);
  const r = build();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /must both be there, in that order/);
});

test("this repository: the three copies hold the same list, and every plugin skill is in it", () => {
  const begin = "<!-- ai-dlc:commands:begin -->", end = "<!-- ai-dlc:commands:end -->";
  const cut = (f) => { const t = fs.readFileSync(path.join(REPO, f), "utf8").replace(/\r\n/g, "\n"); return t.slice(t.indexOf(begin), t.indexOf(end) + end.length); };
  const plugin = cut("plugins/claude/ai-dlc/README.md");
  assert.ok(plugin.length > begin.length + end.length);
  assert.equal(cut("README.md"), plugin);
  assert.equal(cut("docs/plugins.md"), plugin);
  for (const name of fs.readdirSync(path.join(REPO, "plugins", "claude", "ai-dlc", "skills"))) assert.ok(plugin.includes(`| \`/ai-dlc:${name}\` |`), name);
  for (const name of ["cache-keepalive", "cache-keepalive-configure", "cache-keepalive-install", "cache-keepalive-merge", "configure-auto-handoff"]) assert.match(plugin, new RegExp(`\\| \`/ai-dlc:${name}\` \\|.*\\*\\*Claude Code only\\.\\*\\* \\|`));
  const copilot = fs.readFileSync(path.join(REPO, "plugins", "copilot", "ai-dlc", "README.md"), "utf8");
  assert.match(copilot, /\| `\/cache-keepalive` \|.*\*\*Not available in GitHub Copilot\*\*/);
});

// ---- SQA round 2 (run AAW-20261023-keepalive-explicit-defaults) ------------------------------------

test("a second build changes nothing, and text outside the markers of every copy is kept", () => {
  assert.equal(build().status, 0);
  const files = ["README.md", "docs/plugins.md", "plugins/claude/demo/README.md", "plugins/copilot/demo/README.md"];
  const first = files.map(read);
  write("README.md", `# repo\n\nIntro stays.\n\n${region(read("README.md"))}\n\nOutro stays.\n`);
  assert.equal(build().status, 0);
  assert.equal(build().status, 0);
  const second = files.map(read);
  assert.match(second[0], /^# repo\n\nIntro stays\.\n\n<!-- demo:commands:begin -->/);
  assert.match(second[0], /\n\nOutro stays\.\n$/);
  assert.deepEqual(second.slice(1), first.slice(1));
  assert.equal(build("--check").status, 0);
});

test("--check also fails when the generated Copilot README drifts, and a rebuild repairs it", () => {
  assert.equal(build().status, 0);
  write("plugins/copilot/demo/README.md", read("plugins/copilot/demo/README.md").replace("Says hello.", "Says bye."));
  const r = build("--check");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Copilot plugin is stale: 1 changed[^\n]*\n\s+README\.md/); // named relative to the Copilot plugin
  assert.equal(build().status, 0);
  assert.match(read("plugins/copilot/demo/README.md"), /Says hello\./);
  assert.equal(build("--check").status, 0);
});

test("--check fails when a copy's region is emptied by hand", () => {
  assert.equal(build().status, 0);
  write("README.md", `# repo\n\n${BEGIN}\n${END}\n`);
  const r = build("--check");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /README\.md/);
});

test("markers in the wrong order fail the build, with the file named", () => {
  write("docs/plugins.md", `# plugins\n\n${END}\n${BEGIN}\n`);
  const r = build();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /docs[\\/]plugins\.md/);
  assert.match(r.stderr, /must both be there, in that order/);
});

test("removing a skill drops its row from every copy; adding one adds it in name order", () => {
  assert.equal(build().status, 0);
  fs.rmSync(p("plugins/claude/demo/skills/keep"), { recursive: true });
  skill("alpha", "description: Alpha first. Then more.");
  assert.equal(build("--check").status, 1);
  assert.equal(build().status, 0);
  for (const f of ["README.md", "docs/plugins.md", "plugins/claude/demo/README.md"]) {
    const names = [...region(read(f)).matchAll(/^\| `\/demo:([a-z-]+)`/gm)].map((m) => m[1]);
    assert.deepEqual(names, ["alpha", "hello", "only"], f);
  }
  assert.doesNotMatch(region(read("plugins/copilot/demo/README.md")), /\/keep/);
});

test("a long description is cut at 240 characters on a word; one without a sentence end is used whole; a skill without argument-hint shows a dash", () => {
  const long = `${"word ".repeat(80)}end.`;
  skill("longone", `description: ${long}`);
  skill("nodot", "description: Does a thing with no full stop");
  assert.equal(build().status, 0);
  const list = region(read("plugins/claude/demo/README.md"));
  const row = list.split("\n").find((l) => l.startsWith("| `/demo:longone`"));
  assert.match(row, /^\| `\/demo:longone` \| — \| (word )+word …/);
  assert.ok(row.split("|")[3].trim().length <= 242, row);
  assert.match(list, /^\| `\/demo:nodot` \| — \| Does a thing with no full stop \|$/m);
});

test("a skill whose description says (Claude Code only) is marked once and the phrase is not repeated in the purpose", () => {
  assert.equal(build().status, 0);
  const keep = region(read("plugins/claude/demo/README.md")).split("\n").find((l) => l.startsWith("| `/demo:keep`"));
  assert.equal((keep.match(/Claude Code only/g) ?? []).length, 1, keep);
});

test("this repository: no row of the Commands list sends users to the removed -config command or to a user-facing set, and the keep-alive trio is listed", () => {
  const text = fs.readFileSync(path.join(REPO, "plugins", "claude", "ai-dlc", "README.md"), "utf8");
  const list = text.slice(text.indexOf("<!-- ai-dlc:commands:begin -->"), text.indexOf("<!-- ai-dlc:commands:end -->"));
  assert.doesNotMatch(list, /cache-keepalive-config(?!ure)/);
  assert.doesNotMatch(list, /`\/ai-dlc:[a-z-]+` \| [^|]*\bset\b/);
  for (const n of ["cache-keepalive-install", "cache-keepalive-merge", "cache-keepalive-configure"]) assert.ok(list.includes(`/ai-dlc:${n}\``), n);
  assert.ok(!list.includes("/ai-dlc:cache-keepalive-config`"), "no alias for the removed command");
});
