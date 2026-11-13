// herdr.mjs keeps its own copy of the settings helpers of configure-auto-handoff's auto-handoff.mjs, so that each skill runs on its own
// (the decision cache-keepalive.mjs also follows; LLD 1.1.6 section 4). This suite stops the copies drifting apart: the source of each
// copied helper must match, and the helpers both files export must give the same results on the same inputs.
// normPath is deliberately NOT copied: herdr's lowercases on win32 only (LLD 1.1.6 section 4, deviation 3 of the 1.2 hand-back).
// Run from the repository root: node --test "tests/**/*.test.mjs". Temp folders only.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as ah from "../../plugins/claude/ai-dlc/skills/configure-auto-handoff/templates/auto-handoff.mjs";
import * as hd from "../../plugins/claude/ai-dlc/skills/herdr/scripts/herdr.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SKILLS = path.join(REPO, "plugins", "claude", "ai-dlc", "skills");
const AH_SRC = fs.readFileSync(path.join(SKILLS, "configure-auto-handoff", "templates", "auto-handoff.mjs"), "utf8").replace(/\r\n/g, "\n");
const HD_SRC = fs.readFileSync(path.join(SKILLS, "herdr", "scripts", "herdr.mjs"), "utf8").replace(/\r\n/g, "\n");

/** A helper's source: a function to its closing brace at the start of a line, or a one-line const.
 * `export` is dropped, and a literal byte-order mark is written as its escape, so only the code counts
 * (the same extraction as tests/auto-handoff/cli-helpers-drift.test.mjs). */
function helper(src, name) {
  const fn = new RegExp(`^(?:export )?function ${name}\\(.*?^\\}$`, "ms").exec(src);
  const one = new RegExp(`^(?:export )?const ${name} = .*$`, "m").exec(src);
  const found = fn?.[0] ?? one?.[0];
  assert.ok(found, `${name} not found`);
  return found.replace(/^export /, "").replace(/\uFEFF/g, "\\uFEFF");
}

const COPIED = ["isObj", "readMaybe", "stripComments", "settingsEnv", "readRepoFile", "loadSchema", "gitRoot"];

test("every copied helper has the same source in herdr.mjs and auto-handoff.mjs", () => {
  for (const name of COPIED) assert.equal(helper(HD_SRC, name), helper(AH_SRC, name), name);
  // The function helpers are read whole, not cut at their first line.
  for (const name of ["stripComments", "settingsEnv", "readRepoFile"]) assert.ok(helper(HD_SRC, name).split("\n").length > 5, name);
});

test("normPath is not a copy: herdr's lowercases on win32 only, auto-handoff's always", () => {
  assert.notEqual(helper(HD_SRC, "normPath"), helper(AH_SRC, "normPath"));
  assert.equal(hd.normPath("C:\\Repo\\", "linux"), "C:/Repo");
  assert.equal(ah.normPath("C:\\Repo\\"), "c:/repo");
  assert.equal(hd.normPath("C:\\Repo\\", "win32"), ah.normPath("C:\\Repo\\"));
});

let tmp;
before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "herdr-drift-")); });
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test("readRepoFile gives the same result for a missing, broken, non-object, BOM and good file", () => {
  const files = { missing: undefined, broken: "{ nope", array: "[1]", scalar: "3", bom: "\uFEFF{\"a\":1}", good: "{\"a\":{\"b\":null}}", empty: "" };
  for (const [name, text] of Object.entries(files)) {
    const file = path.join(tmp, `${name}.json`);
    if (text !== undefined) fs.writeFileSync(file, text);
    assert.deepEqual(hd.readRepoFile(file), ah.readRepoFile(file), name);
  }
});

test("loadSchema reads the keys of a schema file the same way, $schema excluded", () => {
  const file = path.join(tmp, "x.schema.json");
  fs.writeFileSync(file, JSON.stringify({ properties: { $schema: { type: "string" }, a: { type: "number", default: 1 }, b: { type: ["string", "null"], enum: ["x", null] } } }));
  assert.deepEqual(hd.loadSchema(file), ah.loadSchema(file));
  assert.deepEqual(hd.loadSchema(file).keys.map((k) => k.key), ["a", "b"]);
});

test("stripComments (compared by source, so behaviour is pinned here): comments go, // inside a string stays, escaped quotes do not end a string", () => {
  const cases = [
    ['{ "a": 1 // tail\n}', '{ "a": 1 \n}'],
    ['{ /* block */ "a": "http://x" }', '{  "a": "http://x" }'],
    ['{ "a": "q\\"//not a comment" }', '{ "a": "q\\"//not a comment" }'],
    ['{ "a": 1 /* open', '{ "a": 1 '],
    ["", ""],
  ];
  for (const [input, expected] of cases) assert.equal(hd.stripComments(input), expected, input);
});

test("settingsEnv (compared by source) reads env of a settings file, tolerates comments and warns about bad shapes", () => {
  const root = fs.mkdtempSync(path.join(tmp, "root-"));
  fs.mkdirSync(path.join(root, ".claude"));
  const put = (name, text) => fs.writeFileSync(path.join(root, ".claude", name), text);
  const w = [];
  put("a.json", '{ // c\n "env": { "X": "1" } }');
  assert.deepEqual(hd.settingsEnv(root, "a.json", w), { X: "1" });
  assert.equal(hd.settingsEnv(root, "missing.json", w), null);
  put("b.json", "{ broken"); assert.equal(hd.settingsEnv(root, "b.json", w), null);
  put("c.json", "[]"); assert.equal(hd.settingsEnv(root, "c.json", w), null);
  put("d.json", '{ "env": 5 }'); assert.equal(hd.settingsEnv(root, "d.json", w), null);
  put("e.json", "{}"); assert.equal(hd.settingsEnv(root, "e.json", w), null);
  assert.equal(w.length, 3, w.join("; "));
  assert.match(w[0], /^\.claude\/b\.json is not valid JSON/);
});
