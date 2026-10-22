// Two-way coverage of the harness sync script the harness-sync skill ships
// (plugins/claude/ai-dlc/skills/harness-sync/templates/sync-harness.mjs): for each kind — agents, skills,
// commands <-> prompts, rules <-> instructions, hooks — a twin made on one platform only is created on the
// other, in both directions, and a twin edited on both sides is resolved by --prefer.
// Each test runs the real script against a throwaway repository (--root).
// Run from the repository root: node --test "tests/**/*.test.mjs"
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(REPO, "plugins", "claude", "ai-dlc", "skills", "harness-sync", "templates", "sync-harness.mjs");

let tmp;
const w = (rel, text) => { const p = path.join(tmp, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); return p; };
const r = (rel) => fs.readFileSync(path.join(tmp, rel), "utf8");
const has = (rel) => fs.existsSync(path.join(tmp, rel));
const sync = (...args) => spawnSync(process.execPath, [SCRIPT, "--root", tmp, ...args], { encoding: "utf8" });
const age = (rel, secondsAgo) => { const t = new Date(Date.now() - secondsAgo * 1000); fs.utimesSync(path.join(tmp, rel), t, t); };

beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sync-harness-")); });
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

// After a sync, --check must report nothing pending.
const assertSettled = () => { const c = sync("--check"); assert.equal(c.status, 0, c.stdout + c.stderr); };

test("agents: Claude -> Copilot", () => {
  w(".claude/agents/rev.md", "---\nname: rev\ndescription: Reviews\ntools: Read, Grep, Bash\n---\n\nBody.\n");
  assert.equal(sync().status, 0);
  const out = r(".github/agents/rev.agent.md");
  assert.match(out, /^name: rev$/m);
  assert.match(out, /^tools: \["read", "search", "execute"\]$/m);
  assert.match(out, /Body\./);
  assertSettled();
});

test("agents: Copilot -> Claude", () => {
  w(".github/agents/rev.agent.md", "---\nname: rev\ndescription: Reviews\ntools: [\"read\", \"edit\"]\n---\n\nBody.\n");
  assert.equal(sync().status, 0);
  const out = r(".claude/agents/rev.md");
  assert.match(out, /^tools: Read, Edit, Write$/m);
  assert.match(out, /^model: inherit$/m);
  assertSettled();
});

test("skills: Claude -> Copilot and Copilot -> Claude, file by file", () => {
  w(".claude/skills/a/SKILL.md", "---\nname: a\n---\nA\n");
  w(".claude/skills/a/references/x.md", "X\n");
  w(".github/skills/b/SKILL.md", "---\nname: b\n---\nB\n");
  assert.equal(sync().status, 0);
  assert.equal(r(".github/skills/a/SKILL.md"), "---\nname: a\n---\nA\n");
  assert.equal(r(".github/skills/a/references/x.md"), "X\n");
  assert.equal(r(".claude/skills/b/SKILL.md"), "---\nname: b\n---\nB\n");
  assertSettled();
});

test("commands -> prompts and prompts -> commands, translating the argument placeholder", () => {
  w(".claude/commands/go.md", "---\ndescription: Go\n---\n\nRun $ARGUMENTS\n");
  w(".github/prompts/stop.prompt.md", "---\ndescription: Stop\n---\n\nHalt ${input:arguments}\n");
  assert.equal(sync().status, 0);
  assert.match(r(".github/prompts/go.prompt.md"), /Run \$\{input:arguments\}/);
  assert.match(r(".claude/commands/stop.md"), /Halt \$ARGUMENTS/);
  assertSettled();
});

test("rules -> instructions and instructions -> rules, translating the scope", () => {
  w(".claude/rules/ts.md", "---\ndescription: TS\npaths:\n  - \"src/**/*.ts\"\n---\n\nUse strict.\n");
  w(".github/instructions/all.instructions.md", "---\ndescription: All\napplyTo: \"**\"\n---\n\nBe kind.\n");
  assert.equal(sync().status, 0);
  assert.match(r(".github/instructions/ts.instructions.md"), /^applyTo: "src\/\*\*\/\*\.ts"$/m);
  const rule = r(".claude/rules/all.md");
  assert.match(rule, /Be kind\./);
  assert.doesNotMatch(rule, /^paths:/m, "applyTo ** is a rule without paths");
  assertSettled();
});

test("hooks: Claude -> Copilot and Copilot -> Claude, matched by command", () => {
  w(".claude/settings.json", JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "node a.mjs" }] }] } }));
  w(".github/hooks/b.json", JSON.stringify({ version: 1, hooks: { preToolUse: [{ type: "command", bash: "node b.mjs", powershell: "node b.mjs" }] } }));
  assert.equal(sync().status, 0);
  const copilot = JSON.parse(r(".github/hooks/synced-from-claude.json"));
  assert.equal(copilot.hooks.agentStop[0].bash, "node a.mjs");
  const claude = JSON.parse(r(".claude/settings.json"));
  assert.equal(claude.hooks.PreToolUse[0].hooks[0].command, "node b.mjs");
  assert.equal(claude.hooks.Stop.length, 1, "the original Claude hook is not duplicated");
  assertSettled();
});

test("both twins edited: --prefer claude / copilot picks the side; default newer takes the file saved last", () => {
  const seed = () => {
    w(".claude/rules/r.md", "---\ndescription: R\n---\n\nClaude edit.\n");
    w(".github/instructions/r.instructions.md", "---\ndescription: R\napplyTo: \"**\"\n---\n\nCopilot edit.\n");
  };
  seed();
  assert.equal(sync("--prefer", "claude").status, 0);
  assert.match(r(".github/instructions/r.instructions.md"), /Claude edit\./);

  seed();
  assert.equal(sync("--prefer", "copilot").status, 0);
  assert.match(r(".claude/rules/r.md"), /Copilot edit\./);

  seed();
  age(".claude/rules/r.md", 60);
  assert.equal(sync().status, 0);
  assert.match(r(".claude/rules/r.md"), /Copilot edit\./, "Copilot saved last, so it wins");
});

test("--check writes nothing and exits 1 when a twin is pending", () => {
  w(".claude/agents/x.md", "---\nname: x\ndescription: X\n---\n\nX\n");
  const c = sync("--check");
  assert.equal(c.status, 1);
  assert.match(c.stdout, /would create\s+\.github\/agents\/x\.agent\.md/);
  assert.equal(has(".github/agents/x.agent.md"), false);
});
