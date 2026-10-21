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
  assert.ok(keys.includes("AAW"));
});

test("the schema documents the handoffs placeholders, file suffixes and file-name pattern", () => {
  const h = schema.properties.artifacts.properties.handoffs.description;
  for (const s of ["{LIFECYCLE}", "{YYYYMMDD}", "{feature-slug}", ".handoff.md", ".handback.md",
    "{step}[.{sub}][.l{loop}]-{from-agent}-to-{to-agent}"]) {
    assert.ok(h.includes(s), `handoffs description mentions ${s}`);
  }
});

test("the AAW lifecycle note says AAW writes handoff records and stores hand-backs", () => {
  const notes = wf.lifecycles.AAW.note;
  assert.doesNotMatch(notes, /no handoff records/);
  assert.match(notes, /writes a handoff record before each hand-off/);
  assert.match(notes, /stores every hand-back verbatim/);
});

test(".ai-dlc copies equal the templates (line endings normalised)", () => {
  for (const f of ["workflow.json", "workflow.schema.json"]) {
    const norm = (t) => t.replace(/\r\n/g, "\n");
    assert.equal(norm(read(path.join(REPO, ".ai-dlc", f))), norm(read(path.join(TPL, f))), f);
  }
});
