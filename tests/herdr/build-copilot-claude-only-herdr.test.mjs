// AC-1: the herdr skill is a Claude Code only skill. tools/claude-only-skills.json lists it, the Claude plugin ships it with its script
// and schema, and the generated Copilot plugin has neither the skill nor the script. Reads the repository files; run
// `node tools/build-copilot.mjs` first (the Stop hook and CI do) when the Copilot plugin is stale.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { REPO } from "./helpers/fake-bin.mjs";

const CLAUDE = path.join(REPO, "plugins", "claude", "ai-dlc");
const COPILOT = path.join(REPO, "plugins", "copilot", "ai-dlc");

function find(dir, name, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) find(f, name, out);
    else if (e.name === name) out.push(f);
  }
  return out;
}

test("[AC-1] tools/claude-only-skills.json lists herdr, in sorted position, and names a real plugin skill", () => {
  const list = JSON.parse(fs.readFileSync(path.join(REPO, "tools", "claude-only-skills.json"), "utf8"));
  assert.ok(list.includes("herdr"));
  assert.deepEqual([...list].sort(), list, "the list is kept sorted");
  assert.ok(fs.existsSync(path.join(CLAUDE, "skills", "herdr", "SKILL.md")));
});

test("[AC-1] the Claude plugin ships the herdr skill with its script and schema", () => {
  for (const f of ["SKILL.md", path.join("scripts", "herdr.mjs"), path.join("templates", "herdr.schema.json")]) assert.ok(fs.existsSync(path.join(CLAUDE, "skills", "herdr", f)), f);
});

test("[AC-1] the Copilot plugin has no herdr skill, script or schema", () => {
  assert.equal(fs.existsSync(path.join(COPILOT, "skills", "herdr")), false);
  assert.deepEqual(find(COPILOT, "herdr.mjs"), []);
  assert.deepEqual(find(COPILOT, "herdr.schema.json"), []);
});
