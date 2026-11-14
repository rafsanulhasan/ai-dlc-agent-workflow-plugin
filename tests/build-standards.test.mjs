// Tests for tools/build-standards.mjs: the repo-local generator of rule twins from standards.
// Run from the repository root: node --test "tests/**/*.test.mjs"
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { build, parseStandard, splitFlow, splitDoc, stripMarker, STANDARDS_DIR, RULES_DIR, INSTRUCTIONS_DIR } from "../tools/build-standards.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOOL = path.join(REPO, "tools", "build-standards.mjs");
let tmp;
const w = (rel, text) => { fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true }); fs.writeFileSync(path.join(tmp, rel), text); };
const r = (rel) => fs.readFileSync(path.join(tmp, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(tmp, rel));
const std = (name, fm, body = "# Title\n\nBody line.\n") => w(`${STANDARDS_DIR}/${name}.md`, `---\n${fm}\n---\n\n${body}`);
const rule = (n) => `${RULES_DIR}/${n}.md`;
const inst = (n) => `${INSTRUCTIONS_DIR}/${n}.instructions.md`;
const cli = (...args) => spawnSync(process.execPath, [TOOL, "--root", tmp, ...args], { encoding: "utf8" });
const bodyOf = (text) => splitDoc(text).body;

beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "build-standards-")); });
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

test("write creates both twins with byte-identical bodies and exits 0", () => {
  std("alpha", "description: Alpha rule");
  const res = cli();
  assert.equal(res.status, 0);
  assert.match(res.stdout, /create \.claude\/rules\/alpha\.md/);
  assert.match(res.stdout, /create \.github\/instructions\/alpha\.instructions\.md/);
  assert.equal(bodyOf(r(rule("alpha"))), "\n# Title\n\nBody line.\n");
  assert.equal(bodyOf(r(rule("alpha"))), bodyOf(r(inst("alpha"))));
});

test("front matter per host: no paths = Claude has none, Copilot applyTo all", () => {
  std("alpha", "description: Alpha rule");
  cli();
  const c = splitDoc(r(rule("alpha"))).fm, g = splitDoc(r(inst("alpha"))).fm;
  assert.match(c, /^description: Alpha rule$/m);
  assert.doesNotMatch(c, /paths:/);
  assert.match(g, /^description: "Alpha rule"$/m);
  assert.match(g, /^applyTo: "\*\*"$/m);
});

test("front matter per host: paths become a Claude list and a comma-joined applyTo (block and flow lists)", () => {
  std("blk", 'description: B\npaths:\n  - "src/**/*.ts"\n  - "lib/**"');
  std("flw", "description: F\npaths: [a/**, b/**]");
  cli();
  assert.match(r(rule("blk")), /^paths:\n {2}- "src\/\*\*\/\*\.ts"\n {2}- "lib\/\*\*"$/m);
  assert.match(r(inst("blk")), /^applyTo: "src\/\*\*\/\*\.ts,lib\/\*\*"$/m);
  assert.match(r(inst("flw")), /^applyTo: "a\/\*\*,b\/\*\*"$/m);
  assert.match(r(rule("flw")), /^ {2}- "a\/\*\*"$/m);
});

test("the marker is the first front-matter line and hashes the twin without it", () => {
  std("alpha", "description: Alpha rule");
  cli();
  for (const f of [rule("alpha"), inst("alpha")]) {
    const lines = r(f).split("\n");
    assert.equal(lines[0], "---");
    assert.match(lines[1], /^# Generated from \.forgeline\/memory-bank\/project\/standards\/alpha\.md by tools\/build-standards\.mjs \(sha256 [0-9a-f]{12} of this file without this line\)\. Do not edit/);
    const m = stripMarker(r(f));
    assert.equal(m.source, `${STANDARDS_DIR}/alpha.md`);
    assert.ok(!m.content.includes("Generated from"));
  }
});

test("idempotent: a second write changes nothing and --check passes", () => {
  std("alpha", "description: A");
  cli();
  const before = r(rule("alpha")) + r(inst("alpha"));
  const again = cli();
  assert.equal(again.status, 0);
  assert.doesNotMatch(again.stdout, /^(create|update)/m);
  assert.match(again.stdout, /2 twin\(s\) current, 1 standard\(s\)/);
  assert.equal(r(rule("alpha")) + r(inst("alpha")), before);
  assert.equal(cli("--check").status, 0);
});

test("--check on a missing twin exits 1 and writes nothing", () => {
  std("alpha", "description: A");
  const res = cli("--check");
  assert.equal(res.status, 1);
  assert.match(res.stderr, /stale \.claude\/rules\/alpha\.md: would create/);
  assert.ok(!exists(rule("alpha")));
});

test("a changed standard makes the twins stale (--check 1); write updates them (exit 0)", () => {
  std("alpha", "description: A");
  cli();
  std("alpha", "description: A", "# Title\n\nChanged.\n");
  const chk = cli("--check");
  assert.equal(chk.status, 1);
  assert.match(chk.stderr, /stale .*would update/);
  assert.match(r(rule("alpha")), /Body line/, "--check did not write");
  const wr = cli();
  assert.equal(wr.status, 0);
  assert.match(wr.stdout, /update \.claude\/rules\/alpha\.md/);
  assert.match(r(rule("alpha")), /Changed\./);
  assert.match(r(inst("alpha")), /Changed\./);
  assert.equal(cli("--check").status, 0);
});

test("a hand-edited twin is refused (exit 1, unchanged); --force overwrites it", () => {
  std("alpha", "description: A");
  cli();
  const edited = r(rule("alpha")) + "\nmy edit\n";
  w(rule("alpha"), edited);
  std("alpha", "description: A", "# Title\n\nNew.\n");
  const res = cli();
  assert.equal(res.status, 1);
  assert.match(res.stderr, /refuse \.claude\/rules\/alpha\.md: edited by hand/);
  assert.equal(r(rule("alpha")), edited);
  assert.match(r(inst("alpha")), /New\./, "the untouched twin still updates");
  const forced = cli("--force");
  assert.equal(forced.status, 0);
  assert.doesNotMatch(r(rule("alpha")), /my edit/);
  assert.match(r(rule("alpha")), /New\./);
});

test("--check reports a hand-edited twin as refused, exit 1", () => {
  std("alpha", "description: A");
  cli();
  w(rule("alpha"), r(rule("alpha")) + "x\n");
  const res = cli("--check");
  assert.equal(res.status, 1);
  assert.match(res.stderr, /refuse .*edited by hand/);
});

test("an unmarked twin with the same body is adopted (front matter rewritten)", () => {
  std("alpha", "description: A");
  w(rule("alpha"), "---\ndescription: old\n---\n\n# Title\n\nBody line.\n");
  const res = cli();
  assert.equal(res.status, 0);
  assert.match(res.stdout, /update \.claude\/rules\/alpha\.md/);
  assert.equal(stripMarker(r(rule("alpha"))).source, `${STANDARDS_DIR}/alpha.md`);
});

test("an unmarked twin with a different body is refused", () => {
  std("alpha", "description: A");
  const orig = "---\ndescription: old\n---\n\nSomething else entirely.\n";
  w(rule("alpha"), orig);
  const res = cli();
  assert.equal(res.status, 1);
  assert.match(res.stderr, /no marker, and its body differs/);
  assert.equal(r(rule("alpha")), orig);
});

test("template: twins equal to the plugin template are written; a missing template is off-template", () => {
  const t = "plugins/x/templates";
  std("alpha", `description: A\ntemplate: ${t}`);
  const probe = build(tmp, { check: true });
  assert.equal(probe.code, 1);
  assert.match(probe.lines.join("\n"), /off-template.*\(missing\)/);
  w(`${t}/rules/alpha.md`, "---\ndescription: A\n---\n\n# Title\n\nBody line.\n");
  w(`${t}/instructions/alpha.instructions.md`, '---\ndescription: "A"\napplyTo: "**"\n---\n\n# Title\n\nBody line.\n');
  const res = cli();
  assert.equal(res.status, 0, res.stderr);
  assert.ok(exists(rule("alpha")) && exists(inst("alpha")));
});

test("off-template: a differing template refuses the standard (exit 1) and writes nothing for it", () => {
  const t = "plugins/x/templates";
  std("alpha", `description: A\ntemplate: ${t}`);
  w(`${t}/rules/alpha.md`, "---\ndescription: A\n---\n\n# Title\n\nDIFFERENT\n");
  w(`${t}/instructions/alpha.instructions.md`, '---\ndescription: "A"\napplyTo: "**"\n---\n\n# Title\n\nBody line.\n');
  const res = cli();
  assert.equal(res.status, 1);
  assert.match(res.stderr, /off-template .*alpha\.md: its rule would differ/);
  assert.doesNotMatch(res.stderr, /its instruction would differ/);
  assert.ok(!exists(rule("alpha")) && !exists(inst("alpha")));
});

test("orphan: a marked twin whose standard is gone is reported (exit 1) and never deleted", () => {
  std("alpha", "description: A");
  cli();
  fs.rmSync(path.join(tmp, STANDARDS_DIR, "alpha.md"));
  const res = cli();
  assert.equal(res.status, 1);
  assert.match(res.stderr, /orphan \.claude\/rules\/alpha\.md/);
  assert.match(res.stderr, /orphan \.github\/instructions\/alpha\.instructions\.md/);
  assert.ok(exists(rule("alpha")) && exists(inst("alpha")));
});

test("orphan is also reported when the standards folder is missing", () => {
  std("alpha", "description: A");
  cli();
  fs.rmSync(path.join(tmp, ".forgeline"), { recursive: true });
  const res = cli("--check");
  assert.equal(res.status, 1);
  assert.match(res.stderr, /orphan/);
});

test("an unmarked rule with no standard is only a note (exit 0) and is left alone", () => {
  std("alpha", "description: A");
  w(rule("hand"), "---\ndescription: mine\n---\n\nHand written.\n");
  const res = cli();
  assert.equal(res.status, 0);
  assert.match(res.stdout, /note \.claude\/rules\/hand\.md/);
  assert.equal(r(rule("hand")), "---\ndescription: mine\n---\n\nHand written.\n");
});

test("README.md and dot files in the standards folder are skipped", () => {
  std("alpha", "description: A");
  w(`${STANDARDS_DIR}/README.md`, "no front matter here");
  w(`${STANDARDS_DIR}/.hidden.md`, "nope");
  const res = cli();
  assert.equal(res.status, 0);
  assert.match(res.stdout, /1 standard\(s\)/);
});

test("invalid standards exit 2 and report the file", () => {
  const cases = {
    nodesc: ["x: 1", "body\n"],
    mismatch: ["name: other\ndescription: D", "body\n"],
    badlist: ["description: D\n  - orphan item", "body\n"],
    empty: ["description: D", "\n"],
  };
  for (const [n, [fm, body]] of Object.entries(cases)) {
    fs.rmSync(path.join(tmp, ".forgeline"), { recursive: true, force: true });
    std(n, fm, body);
    const res = cli();
    assert.equal(res.status, 2, `${n}: ${res.stderr}${res.stdout}`);
    assert.match(res.stderr + res.stdout, new RegExp(`invalid .*${n}\\.md`));
  }
  fs.rmSync(path.join(tmp, ".forgeline"), { recursive: true, force: true });
  w(`${STANDARDS_DIR}/nofm.md`, "no front matter\n");
  const res = cli();
  assert.equal(res.status, 2);
  assert.match(res.stderr + res.stdout, /invalid .*nofm\.md: no front matter/);
});

test("an invalid standard still lets a valid one be written", () => {
  std("good", "description: G");
  std("bad", "x: 1");
  const res = cli();
  assert.equal(res.status, 2);
  assert.ok(exists(rule("good")));
});

test("usage errors exit 2: unknown flag, --check with --force, --root without a value", () => {
  for (const args of [["--bogus"], ["--check", "--force"]]) {
    const res = cli(...args);
    assert.equal(res.status, 2, args.join(" "));
    assert.ok(res.stderr.length > 0);
  }
  const noVal = spawnSync(process.execPath, [TOOL, "--root"], { encoding: "utf8" });
  assert.equal(noVal.status, 2);
  assert.match(noVal.stderr, /--root needs a folder/);
});

test("parseStandard: quoted values, # comments and CRLF input", () => {
  const s = parseStandard('---\r\n# comment\r\ndescription: "Quoted: yes"\r\npaths:\r\n  - "a/**"\r\n---\r\n\r\n\r\nBody\r\n', "n");
  assert.equal(s.description, "Quoted: yes");
  assert.deepEqual(s.paths, ["a/**"]);
  assert.equal(s.body, "Body\n");
});

test("a description needing quoting is quoted on the Claude side", () => {
  std("alpha", 'description: "Starts: with colon and # hash"');
  cli();
  assert.match(r(rule("alpha")), /^description: "Starts: with colon and # hash"$/m);
});

test("real repo: --check exits 0 and the docs-status twins minus the marker equal the docs-rules templates", () => {
  const res = spawnSync(process.execPath, [TOOL, "--check", "--root", REPO], { encoding: "utf8" });
  assert.equal(res.status, 0, res.stderr + res.stdout);
  const tpl = path.join(REPO, "plugins", "claude", "ai-dlc", "skills", "docs-rules", "templates");
  const pairs = [
    [path.join(REPO, RULES_DIR, "docs-status.md"), path.join(tpl, "rules", "docs-status.md")],
    [path.join(REPO, INSTRUCTIONS_DIR, "docs-status.instructions.md"), path.join(tpl, "instructions", "docs-status.instructions.md")],
  ];
  for (const [twin, template] of pairs) {
    const m = stripMarker(fs.readFileSync(twin, "utf8"));
    assert.ok(m.source, `${twin} carries the marker`);
    assert.equal(m.content, fs.readFileSync(template, "utf8").replace(/\r\n/g, "\n"));
  }
});

test("real repo: every standard's twin bodies are identical on both hosts", () => {
  const dir = path.join(REPO, STANDARDS_DIR);
  const names = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && !/^README/i.test(f)).map((f) => f.slice(0, -3));
  assert.ok(names.length >= 2);
  for (const n of names) {
    const a = splitDoc(fs.readFileSync(path.join(REPO, RULES_DIR, `${n}.md`), "utf8")).body;
    const b = splitDoc(fs.readFileSync(path.join(REPO, INSTRUCTIONS_DIR, `${n}.instructions.md`), "utf8")).body;
    assert.equal(a, b, n);
  }
});

test("real repo: sync-harness --check sees the generated twins as in sync", () => {
  const sh = path.join(REPO, ".claude", "scripts", "sync-harness.mjs");
  const res = spawnSync(process.execPath, [sh, "--check"], { cwd: REPO, encoding: "utf8" });
  assert.equal(res.status, 0, res.stdout + res.stderr);
});

// Review 8.4.1 (round 1) gaps: a brace glob inside a flow list, and unknown front-matter keys.
test("[8.4.1] splitFlow splits only on commas outside quotes and braces", () => {
  assert.deepEqual(splitFlow('"src/**/*.{ts,tsx}", "a,b", c/**'), ["src/**/*.{ts,tsx}", "a,b", "c/**"]);
  assert.deepEqual(splitFlow("{a,b}/x, 'q,r'"), ["{a,b}/x", "q,r"]);
});

test("[8.4.1] a glob containing a comma is refused (exit 2, nothing written), in flow and block lists", () => {
  for (const fm of ['description: B\npaths: ["src/**/*.{ts,tsx}"]', 'description: B\npaths:\n  - "src/**/*.{ts,tsx}"']) {
    fs.rmSync(path.join(tmp, ".forgeline"), { recursive: true, force: true });
    std("brace", fm);
    const res = cli();
    assert.equal(res.status, 2, res.stdout + res.stderr);
    assert.match(res.stderr + res.stdout, /contains a comma/);
    assert.ok(!exists(rule("brace")) && !exists(inst("brace")));
  }
});

test("[8.4.1] a flow list without commas inside entries writes paths and a comma-joined applyTo", () => {
  std("ok", 'description: B\npaths: ["src/**/*.ts", "**/*.{md}"]');
  assert.equal(cli().status, 0);
  assert.match(r(rule("ok")), /^ {2}- "\*\*\/\*\.\{md\}"$/m);
  assert.match(r(inst("ok")), /^applyTo: "src\/\*\*\/\*\.ts,\*\*\/\*\.\{md\}"$/m);
});

test("[8.4.1] a repeated front-matter key is invalid (exit 2)", () => {
  std("dup", "description: A\ndescription: B");
  const res = cli();
  assert.equal(res.status, 2);
  assert.match(res.stderr + res.stdout, /appears twice/);
});

test("[8.4.1] descriptions YAML would read as non-strings are quoted on the Claude side", () => {
  for (const d of ["true", "no", "123", "~", "null"]) {
    fs.rmSync(path.join(tmp, ".forgeline"), { recursive: true, force: true });
    std("q", `description: "${d}"`);
    cli();
    assert.match(r(rule("q")), new RegExp(`^description: "${d}"$`, "m"), d);
  }
});

test("[8.4.1] no temp files are left after a write", () => {
  std("alpha", "description: A");
  cli();
  const left = [RULES_DIR, INSTRUCTIONS_DIR].flatMap((d) => fs.readdirSync(path.join(tmp, d))).filter((f) => f.endsWith(".tmp"));
  assert.deepEqual(left, []);
});

test("[8.4.1] an unknown front-matter key is an invalid standard (exit 2), so a typo cannot widen a scoped rule", () => {
  for (const fm of ['description: D\npath: ["src/**"]', 'description: D\npaths : ["src/**"]']) {
    fs.rmSync(path.join(tmp, ".forgeline"), { recursive: true, force: true });
    std("typo", fm);
    const res = cli();
    assert.equal(res.status, 2, `${fm}: ${res.stdout}${res.stderr}`);
    assert.match(res.stderr + res.stdout, /invalid .*typo\.md/);
    assert.ok(!exists(rule("typo")), "nothing is written for an invalid standard");
  }
});
