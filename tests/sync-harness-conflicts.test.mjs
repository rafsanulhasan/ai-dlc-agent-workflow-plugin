// Further coverage of the harness sync script (plugins/claude/ai-dlc/skills/harness-sync/templates/
// sync-harness.mjs): the conflict rule for every kind that has a conflict (agents, skills, commands,
// rules), "newer" in both directions, hooks never conflicting, options, nothing deleted, idempotence;
// and what the harness-sync skill ships (only the script) and how the command is exposed.
// Each sync test runs the real script against a throwaway repository (--root).
// Run from the repository root: node --test "tests/**/*.test.mjs"
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_DIR = path.join(REPO, "plugins", "claude", "ai-dlc", "skills", "harness-sync");
const SCRIPT = path.join(SKILL_DIR, "templates", "sync-harness.mjs");

let tmp;
const w = (rel, text) => { const p = path.join(tmp, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
const r = (rel) => fs.readFileSync(path.join(tmp, rel), "utf8");
const has = (rel) => fs.existsSync(path.join(tmp, rel));
const sync = (...args) => spawnSync(process.execPath, [SCRIPT, "--root", tmp, ...args], { encoding: "utf8" });
const age = (rel, s) => { const t = new Date(Date.now() - s * 1000); fs.utimesSync(path.join(tmp, rel), t, t); };

beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sync-more-")); });
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

// One conflicting pair per kind: [claude path, copilot path, claude content, copilot content, marker regex pair].
const PAIRS = {
  agents: [".claude/agents/a.md", ".github/agents/a.agent.md",
    "---\nname: a\ndescription: A\n---\n\nClaude body.\n", "---\nname: a\ndescription: A\n---\n\nCopilot body.\n"],
  skills: [".claude/skills/s/SKILL.md", ".github/skills/s/SKILL.md",
    "---\nname: s\n---\nClaude body.\n", "---\nname: s\n---\nCopilot body.\n"],
  commands: [".claude/commands/c.md", ".github/prompts/c.prompt.md",
    "---\ndescription: C\n---\n\nClaude body.\n", "---\ndescription: C\n---\n\nCopilot body.\n"],
  rules: [".claude/rules/r.md", ".github/instructions/r.instructions.md",
    "---\ndescription: R\n---\n\nClaude body.\n", "---\ndescription: R\napplyTo: \"**\"\n---\n\nCopilot body.\n"],
};

for (const [kind, [cl, co, clText, coText]] of Object.entries(PAIRS)) {
  const seed = () => { w(cl, clText); w(co, coText); };

  test(`${kind}: both twins differ -> --prefer claude overwrites the Copilot twin only`, () => {
    seed();
    assert.equal(sync("--prefer", "claude").status, 0);
    assert.match(r(co), /Claude body\./);
    assert.doesNotMatch(r(co), /Copilot body\./);
    assert.match(r(cl), /Claude body\./);
  });

  test(`${kind}: both twins differ -> --prefer copilot overwrites the Claude twin only`, () => {
    seed();
    assert.equal(sync("--prefer", "copilot").status, 0);
    assert.match(r(cl), /Copilot body\./);
    assert.match(r(co), /Copilot body\./);
  });

  test(`${kind}: default is newer — the file saved last wins, in both directions`, () => {
    seed(); age(co, 60);
    assert.equal(sync().status, 0);
    assert.match(r(co), /Claude body\./, "Claude saved last");
    seed(); age(cl, 60);
    assert.equal(sync().status, 0);
    assert.match(r(cl), /Copilot body\./, "Copilot saved last");
  });

  test(`${kind}: --check reports the conflict without writing, and exits 1`, () => {
    seed();
    const before = [r(cl), r(co)];
    const c = sync("--check", "--prefer", "claude");
    assert.equal(c.status, 1);
    assert.deepEqual([r(cl), r(co)], before);
  });
}

test("hooks: a hook present on both sides is not duplicated and never conflicts; sync is idempotent", () => {
  w(".claude/settings.json", JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "node a.mjs" }] }] } }));
  assert.equal(sync().status, 0);
  const first = [r(".claude/settings.json"), r(".github/hooks/synced-from-claude.json")];
  assert.equal(sync("--prefer", "copilot").status, 0);
  assert.deepEqual([r(".claude/settings.json"), r(".github/hooks/synced-from-claude.json")], first);
  assert.equal(sync("--check").status, 0);
});

test("hooks: unrelated settings keys and existing hooks in settings.json are kept", () => {
  w(".claude/settings.json", JSON.stringify({ model: "x", hooks: { Stop: [{ hooks: [{ type: "command", command: "node keep.mjs" }] }] } }));
  w(".github/hooks/b.json", JSON.stringify({ version: 1, hooks: { agentStop: [{ type: "command", bash: "node new.mjs", powershell: "node new.mjs" }] } }));
  assert.equal(sync().status, 0);
  const s = JSON.parse(r(".claude/settings.json"));
  assert.equal(s.model, "x");
  const cmds = s.hooks.Stop.flatMap((g) => g.hooks.map((h) => h.command));
  assert.deepEqual(cmds.sort(), ["node keep.mjs", "node new.mjs"]);
});

test("a second run changes nothing and --check passes (every kind)", () => {
  w(".claude/agents/a.md", "---\nname: a\ndescription: A\n---\n\nB\n");
  w(".claude/skills/s/SKILL.md", "---\nname: s\n---\nS\n");
  w(".github/prompts/p.prompt.md", "---\ndescription: P\n---\n\nP\n");
  w(".github/instructions/i.instructions.md", "---\ndescription: I\napplyTo: \"**\"\n---\n\nI\n");
  assert.equal(sync().status, 0);
  const snapshot = ["agents/a.agent.md", "skills/s/SKILL.md", "prompts/p.prompt.md", "instructions/i.instructions.md"].map((f) => r(`.github/${f}`));
  assert.equal(sync().status, 0);
  assert.deepEqual(["agents/a.agent.md", "skills/s/SKILL.md", "prompts/p.prompt.md", "instructions/i.instructions.md"].map((f) => r(`.github/${f}`)), snapshot);
  assert.equal(sync("--check").status, 0);
});

test("nothing is ever deleted: a twin whose source was removed stays", () => {
  w(".claude/agents/a.md", "---\nname: a\ndescription: A\n---\n\nB\n");
  assert.equal(sync().status, 0);
  fs.rmSync(path.join(tmp, ".claude/agents/a.md"));
  assert.equal(sync().status, 0);
  assert.equal(has(".github/agents/a.agent.md"), true);
  assert.equal(has(".claude/agents/a.md"), true, "recreated from the surviving twin, not deleted");
});

test("--only limits the kinds and --name limits the artifact", () => {
  w(".claude/agents/a.md", "---\nname: a\ndescription: A\n---\n\nA\n");
  w(".claude/agents/b.md", "---\nname: b\ndescription: B\n---\n\nB\n");
  w(".claude/commands/c.md", "---\ndescription: C\n---\n\nC\n");
  assert.equal(sync("--only", "agents", "--name", "a").status, 0);
  assert.equal(has(".github/agents/a.agent.md"), true);
  assert.equal(has(".github/agents/b.agent.md"), false);
  assert.equal(has(".github/prompts/c.prompt.md"), false);
});

test("bad options exit 2 and write nothing", () => {
  w(".claude/agents/a.md", "---\nname: a\ndescription: A\n---\n\nA\n");
  for (const args of [["--prefer", "nobody"], ["--only", "widgets"]]) {
    const x = sync(...args);
    assert.equal(x.status, 2, args.join(" "));
    assert.match(x.stderr, /^error: /);
  }
  assert.equal(has(".github/agents/a.agent.md"), false);
});

// ---- what the harness-sync skill ships --------------------------------------------------------------
test("the skill ships only sync-harness.mjs in templates/, in the Claude and the Copilot plugin", () => {
  for (const plugin of ["claude", "copilot"]) {
    const dir = path.join(REPO, "plugins", plugin, "ai-dlc", "skills", "harness-sync", "templates");
    assert.deepEqual(fs.readdirSync(dir).sort(), ["sync-harness.mjs"], plugin);
  }
});

test("no consumer sync hook is shipped or referenced: no hook template, and init/harness-sync name none", () => {
  const stray = fs.readdirSync(path.join(SKILL_DIR, "templates")).filter((f) => /hook|on-stop/.test(f));
  assert.deepEqual(stray, []);
  const skill = path.join(REPO, "plugins", "claude", "ai-dlc", "skills");
  for (const f of ["harness-sync/SKILL.md", "init/SKILL.md"]) {
    const text = fs.readFileSync(path.join(skill, f), "utf8");
    assert.doesNotMatch(text, /sync-harness-on-stop|templates\/(claude|copilot)-hook\.json/, f);
  }
});

test("/ai-dlc:harness-sync is a user-only command: disable-model-invocation, and it runs the script", () => {
  const text = fs.readFileSync(path.join(SKILL_DIR, "SKILL.md"), "utf8");
  const fm = /^---\n([\s\S]*?)\n---/.exec(text)[1];
  assert.match(fm, /^name: harness-sync$/m);
  assert.match(fm, /^disable-model-invocation: true$/m);
  assert.match(text, /\.claude\/scripts\/sync-harness\.mjs/);
});

test("agent-manager and the management skills run the script directly: no Skill(\"ai-dlc:harness-sync\") call is left", () => {
  const root = path.join(REPO, "plugins", "claude", "ai-dlc");
  const files = ["agents/agent-manager.md", ...["agent-management", "command-management", "hook-management", "rules-management", "skill-management"].map((s) => `skills/${s}/SKILL.md`)];
  for (const f of files) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, f), "utf8"), /Skill\(\s*"ai-dlc:harness-sync"/, f);
  }
});

// ---- the repo-local Stop command's time budget -------------------------------------------------------
test("the sync's own timeout is below the combined command's per-step budget", () => {
  const hook = fs.readFileSync(path.join(REPO, ".claude", "hooks", "sync-harness-on-stop.mjs"), "utf8");
  const combined = fs.readFileSync(path.join(REPO, ".claude", "hooks", "stop-sync-then-check.mjs"), "utf8");
  const inner = Number(/timeout: ([\d_]+)/.exec(hook)[1].replace(/_/g, ""));
  const stepMs = Number(/const STEP_MS = ([\d_]+)/.exec(combined)[1].replace(/_/g, ""));
  assert.ok(inner < stepMs, `${inner} ms must be below ${stepMs} ms so the hook reports the failure before the combined command kills it`);
  assert.match(combined, /timeout: STEP_MS/, "both steps use the one constant");
});
