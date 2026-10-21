// Tests that the Copilot platform note names the per-agent memory folder like Claude Code does.
// Run from the repository root: node --test     Reads files only; nothing is written.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFileSync(path.join(REPO, ...p), "utf8");
const NEW = ".claude/agent-memory/ai-dlc-<agent>/";
const OLD = ".claude/agent-memory/<agent>/";

const agentsDir = path.join(REPO, "plugins", "copilot", "ai-dlc", "agents");
const agentFiles = fs.readdirSync(agentsDir).filter((f) => f.endsWith(".agent.md"));

test("there is at least one generated Copilot agent", () => {
  assert.ok(agentFiles.length > 0);
});

for (const f of agentFiles) {
  test(`${f} platform note names the ai-dlc-<agent> memory folder, not the bare one`, () => {
    const text = fs.readFileSync(path.join(agentsDir, f), "utf8");
    assert.ok(text.includes(NEW), `missing ${NEW}`);
    assert.ok(!text.includes(OLD), `still names the bare folder ${OLD}`);
  });
}

test("build tool and its shipped template copy agree on the memory folder", () => {
  const tool = read("tools", "build-copilot.mjs");
  const copy = read("plugins", "claude", "ai-dlc", "skills", "plugin-management", "templates", "build-copilot.mjs");
  for (const src of [tool, copy]) {
    assert.ok(src.includes(NEW));
    assert.ok(!src.includes(OLD));
  }
});
