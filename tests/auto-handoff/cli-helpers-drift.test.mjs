// The cache-keepalive-config CLI keeps its own copy of the file and trust helpers of the
// configure-auto-handoff CLI, so that each skill runs on its own (the human ruled, in run
// AAW-20261022-cache-keepalive-init, that keep-alive's CLI must not import from configure-auto-handoff).
// This suite stops the two copies drifting apart: the source of each helper must match, and the helpers
// both CLIs export must give the same results on the same inputs. configure-auto-handoff exports no
// helper for this test: stripComments and settingsEnv, which it keeps private, are compared by source.
// Run from the repository root: node --test "tests/**/*.test.mjs". Temp folders only.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as ah from "../../plugins/claude/ai-dlc/skills/configure-auto-handoff/templates/auto-handoff.mjs";
import * as ka from "../../plugins/claude/ai-dlc/skills/cache-keepalive-config/templates/cache-keepalive.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SKILLS = path.join(REPO, "plugins", "claude", "ai-dlc", "skills");
const AH_SRC = fs.readFileSync(path.join(SKILLS, "configure-auto-handoff", "templates", "auto-handoff.mjs"), "utf8").replace(/\r\n/g, "\n");
const KA_SRC = fs.readFileSync(path.join(SKILLS, "cache-keepalive-config", "templates", "cache-keepalive.mjs"), "utf8").replace(/\r\n/g, "\n");

/** A helper's source: a function to its closing brace at the start of a line, or a one-line const.
 * `export` is dropped, and a literal byte-order mark is written as its escape, so only the code counts. */
function helper(src, name) {
  const fn = new RegExp(`^(?:export )?function ${name}\\(.*?^\\}$`, "ms").exec(src);
  const one = new RegExp(`^(?:export )?const ${name} = .*$`, "m").exec(src);
  const found = fn?.[0] ?? one?.[0];
  assert.ok(found, `${name} not found`);
  return found.replace(/^export /, "").replace(/\uFEFF/g, "\\uFEFF");
}

const HELPERS = ["isObj", "readMaybe", "stripComments", "settingsEnv", "readRepoFile", "normPath", "trustOf", "trustTarget"];

test("every copied helper has the same source in both CLIs", () => {
  for (const name of HELPERS) assert.equal(helper(KA_SRC, name), helper(AH_SRC, name), name);
  // The function helpers are read whole, not cut at their first line.
  for (const name of ["stripComments", "settingsEnv", "readRepoFile", "trustOf", "trustTarget"]) assert.ok(helper(KA_SRC, name).split("\n").length > 5, name);
});

let tmp;
before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "drift-test-")); });
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test("readRepoFile gives the same result for a missing, broken, non-object and good file", () => {
  const files = { missing: undefined, broken: "{ nope", array: "[1]", bom: "\uFEFF{\"a\":1}", good: "{\"a\":{\"b\":null}}" };
  for (const [name, text] of Object.entries(files)) {
    const file = path.join(tmp, `${name}.json`);
    if (text !== undefined) fs.writeFileSync(file, text);
    assert.deepEqual(ka.readRepoFile(file), ah.readRepoFile(file), name);
  }
});

test("normPath and trustOf give the same result on the same inputs", () => {
  for (const p of ["C:\\Repo\\", "/home/x/repo/", "e:/Projects/A", ""]) assert.equal(ka.normPath(p), ah.normPath(p), p);
  const texts = [
    undefined, "nope", "[]", "{}", JSON.stringify({ projects: [] }),
    JSON.stringify({ projects: { "C:/Repo": { hasTrustDialogAccepted: true } } }),
    JSON.stringify({ projects: { "c:\\repo\\": { hasTrustDialogAccepted: "true" } } }),
    "\uFEFF" + JSON.stringify({ projects: { "/home/x": { hasTrustDialogAccepted: true } } }),
  ];
  const targets = [{ root: "C:\\Repo" }, { root: "/elsewhere" }, { start: "/home/x/repo/sub" }];
  for (const t of texts) for (const target of targets) assert.deepEqual(ka.trustOf(t, target), ah.trustOf(t, target), `${t} ${JSON.stringify(target)}`);
});

test("trustTarget gives the same result inside and outside a repository", () => {
  for (const dir of [REPO, path.join(REPO, "tests"), tmp]) assert.deepEqual(ka.trustTarget(dir), ah.trustTarget(dir), dir);
});
