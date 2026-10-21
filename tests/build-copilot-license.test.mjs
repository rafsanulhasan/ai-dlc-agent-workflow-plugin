// Tests that the build ships the repository LICENSE with both plugins and projects the manifest's
// `license` field. Each test builds a throwaway fixture repository with a copy of the build script,
// so the real plugins are never touched. Run from the repository root: node --test "tests/**/*.test.mjs"
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUILD = path.join(REPO, "tools", "build-copilot.mjs");
const LICENSE = "MIT License\n\nCopyright (c) 2026 Test Holder\n";

let tmp;
const p = (...parts) => path.join(tmp, ...parts);
const write = (rel, text) => { fs.mkdirSync(path.dirname(p(rel)), { recursive: true }); fs.writeFileSync(p(rel), text); };
const read = (rel) => fs.readFileSync(p(rel), "utf8");
const build = (...args) => spawnSync(process.execPath, [p("tools", "build-copilot.mjs"), ...args], { encoding: "utf8", cwd: tmp });

function fixture({ license = LICENSE, manifestLicense = "MIT" } = {}) {
  fs.copyFileSync(BUILD, (fs.mkdirSync(p("tools"), { recursive: true }), p("tools", "build-copilot.mjs")));
  const manifest = { name: "demo", version: "0.0.1", description: "demo", author: { name: "Test" } };
  if (manifestLicense) manifest.license = manifestLicense;
  write("plugins/claude/demo/.claude-plugin/plugin.json", JSON.stringify(manifest, null, 2));
  write("plugins/claude/demo/agents/helper.md", "---\nname: helper\ndescription: helps\n---\n\nBody.\n");
  write("plugins/claude/demo/skills/hello/SKILL.md", "---\nname: hello\ndescription: says hello\n---\n\nHello.\n");
  if (license !== null) write("LICENSE", license);
}

beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "build-license-")); });
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

test("build copies the root LICENSE into the Claude and the Copilot plugin", () => {
  fixture();
  const r = build();
  assert.equal(r.status, 0, r.stderr);
  assert.equal(read("plugins/claude/demo/LICENSE"), LICENSE);
  assert.equal(read("plugins/copilot/demo/LICENSE"), LICENSE);
  assert.equal(build("--check").status, 0);
});

test("the copies are written with LF line endings when the root LICENSE has CRLF", () => {
  fixture({ license: LICENSE.replace(/\n/g, "\r\n") });
  assert.equal(build().status, 0);
  assert.equal(read("plugins/claude/demo/LICENSE"), LICENSE);
  assert.equal(read("plugins/copilot/demo/LICENSE"), LICENSE);
});

test("--check fails and names the Claude copy when it drifts from the root LICENSE", () => {
  fixture();
  assert.equal(build().status, 0);
  write("plugins/claude/demo/LICENSE", "edited by hand\n");
  const r = build("--check");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Generated source is stale/);
  assert.match(r.stderr, /plugins\/claude\/demo\/LICENSE/);
});

test("--check fails and names the Copilot copy when it drifts from the root LICENSE", () => {
  fixture();
  assert.equal(build().status, 0);
  write("plugins/copilot/demo/LICENSE", "edited by hand\n");
  const r = build("--check");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Copilot plugin is stale/);
  assert.match(r.stderr, /^\s+LICENSE$/m);
});

test("--check fails when the root LICENSE changes and the copies were not rebuilt", () => {
  fixture();
  assert.equal(build().status, 0);
  write("LICENSE", LICENSE + "\nAmended.\n");
  assert.equal(build("--check").status, 1);
  assert.equal(build().status, 0);
  assert.equal(read("plugins/claude/demo/LICENSE"), read("LICENSE"));
  assert.equal(read("plugins/copilot/demo/LICENSE"), read("LICENSE"));
});

test("a repository without a root LICENSE builds without copies", () => {
  fixture({ license: null, manifestLicense: null });
  assert.equal(build().status, 0);
  assert.ok(!fs.existsSync(p("plugins/claude/demo/LICENSE")));
  assert.ok(!fs.existsSync(p("plugins/copilot/demo/LICENSE")));
  assert.ok(!("license" in JSON.parse(read("plugins/copilot/demo/plugin.json"))));
});

test("the Copilot plugin.json carries the Claude manifest's license", () => {
  fixture({ manifestLicense: "MIT" });
  assert.equal(build().status, 0);
  assert.equal(JSON.parse(read("plugins/copilot/demo/plugin.json")).license, "MIT");
});

test("this repository ships one LICENSE text in all three places and both manifests say MIT", () => {
  const text = (...rel) => fs.readFileSync(path.join(REPO, ...rel), "utf8").replace(/\r\n/g, "\n");
  const root = text("LICENSE");
  assert.match(root, /^MIT License\n\nCopyright \(c\) 2026 Rafsanul Hasan\n/);
  assert.equal(text("plugins", "claude", "ai-dlc", "LICENSE"), root);
  assert.equal(text("plugins", "copilot", "ai-dlc", "LICENSE"), root);
  assert.equal(JSON.parse(text("plugins", "claude", "ai-dlc", ".claude-plugin", "plugin.json")).license, "MIT");
  assert.equal(JSON.parse(text("plugins", "copilot", "ai-dlc", "plugin.json")).license, "MIT");
  for (const mp of [[".claude-plugin", "marketplace.json"], [".github", "plugin", "marketplace.json"]]) {
    const entry = JSON.parse(text(...mp)).plugins.find((e) => e.name === "ai-dlc");
    assert.equal(entry.license, "MIT", mp.join("/"));
  }
});
