// Tests for the handoff folder-naming data in the workflow template and schema (data config, no code).
// Run from the repository root: node --test     Reads files only; nothing is written.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const TPL = path.join(REPO, "plugins", "claude", "ai-dlc", "skills", "workflow", "templates");
const read = (p) => fs.readFileSync(p, "utf8");
const wf = JSON.parse(read(path.join(TPL, "workflow.json")));
const schema = JSON.parse(read(path.join(TPL, "workflow.schema.json")));

test("default artifacts.handoffs is the {LIFECYCLE}-{YYYYMMDD}-{feature-slug} folder", () => {
  assert.equal(wf.artifacts.handoffs, "docs/handoffs/{LIFECYCLE}-{YYYYMMDD}-{feature-slug}/");
});

test("every lifecycle key matches the schema key pattern (so it is a safe folder-name part)", () => {
  const pattern = new RegExp(schema.properties.lifecycles.propertyNames.pattern);
  const keys = Object.keys(wf.lifecycles);
  assert.ok(keys.length > 0);
  for (const k of keys) {
    assert.match(k, pattern, `lifecycle key ${k}`);
  }
  for (const k of ["AAWH", "AAWP"]) assert.ok(keys.includes(k), k);
  assert.ok(!keys.includes("AAW"), "the single AAW lifecycle is replaced by AAWH and AAWP");
});

test("the schema documents the handoffs placeholders, file suffixes and file-name pattern", () => {
  const h = schema.properties.artifacts.properties.handoffs.description;
  for (const s of ["{LIFECYCLE}", "{YYYYMMDD}", "{feature-slug}", ".handoff.md", ".handback.md",
    "{step}[.{sub}][.l{loop}[.{round}]][.{n}][.h{round}]-{from-agent}-to-{to-agent}"]) {
    assert.ok(h.includes(s), `handoffs description mentions ${s}`);
  }
});

for (const code of ["AAWH", "AAWP"]) {
  test(`the ${code} lifecycle note says it writes handoff records and stores hand-backs`, () => {
    const notes = wf.lifecycles[code].note;
    assert.doesNotMatch(notes, /no handoff records/);
    assert.match(notes, /writes a handoff record before each hand-off/);
    assert.match(notes, /stores every hand-back verbatim/);
  });
}

// The record-name grammar of the schema, written out as a regex: step, sub-roots, loop and round, parallel
// index, then the handoff-review round `.h<round>`, then the agents.
const NAME = /^\d+(\.\d+)*(\.l\d+(\.\d+)?)?(\.\d+)*(\.h\d+)?-[a-z][a-z0-9-]*-to-[a-z][a-z0-9-]*\.(handoff|handback)\.md$/;

test("AC-19.6.2 AAWP planning records (N.1.1 intent, N.1.2 design, N.1.3 LLD, Refine rounds) and .h review records match the grammar", () => {
  for (const name of [
    "1.1.1-orchestrator-to-product-owner.handoff.md",
    "1.1.2-orchestrator-to-software-architect.handoff.md",
    "1.1.3-orchestrator-to-system-engineer.handoff.md",
    "1.1.3.l1.1-orchestrator-to-software-architect.handoff.md",
    "1.2.h1-orchestrator-to-brutal-critique.handoff.md",
    "1.2.h1-brutal-critique-to-orchestrator.handback.md",
    "1.3.l1.2.h2-orchestrator-to-brutal-critique.handoff.md",
    "1.4.2.h1-orchestrator-to-brutal-critique.handoff.md",
  ]) assert.match(name, NAME, name);
  for (const name of ["1.h-orchestrator-to-brutal-critique.handoff.md", "1.2.h1.h2-orchestrator-to-brutal-critique.handoff.md", "h1-orchestrator-to-brutal-critique.handoff.md"])
    assert.doesNotMatch(name, NAME, name);
});

test(".ai-dlc copies equal the templates (line endings normalised)", () => {
  for (const f of ["workflow.json", "workflow.schema.json"]) {
    const norm = (t) => t.replace(/\r\n/g, "\n");
    assert.equal(norm(read(path.join(REPO, ".ai-dlc", f))), norm(read(path.join(TPL, f))), f);
  }
});
