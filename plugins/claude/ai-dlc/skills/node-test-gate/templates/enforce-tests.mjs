#!/usr/bin/env node
// enforce-tests.mjs — AI-DLC JavaScript / TypeScript test gate (Claude Code "Stop" / Copilot "agentStop" hook).
// Installed into a Node.js repository by the ai-dlc `node-test-gate` skill (run by /ai-dlc:init).
// Blocks the agent from finishing while the repository's tests fail, but only when runtime code,
// test code, runtime configuration or build logic changed (artifact-only changes are exempt, and
// changes that touch only .NET files are left to the .NET gate).
// Dependency-free; runs on Windows, macOS and Linux with Node.js 18 or later.
//
// Configuration (first match wins):
//   Test command : AI_DLC_NODE_TEST_CMD | CONFIRMED_TEST_CMD below (set by the installer) | `<pm> test`
//   Test folder  : AI_DLC_NODE_TEST_CWD | CONFIRMED_TEST_CWD below | repo root (relative to the repo root)
//   Disable      : AI_DLC_ENFORCE_TESTS=false (also pauses the .NET gate)

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Replaced by node-test-gate at install with the command and folder confirmed at /ai-dlc:init.
const CONFIRMED_TEST_CMD = "{{TEST_CMD}}";
const CONFIRMED_TEST_CWD = "{{TEST_CWD}}";

const configured = (value) => (value && !value.startsWith("{{") ? value : "");
const skip = (message) => {
  if (message) process.stderr.write(`ai-dlc node test gate: ${message}\n`);
  process.exit(0);
};
const block = (reason) => {
  // Top-level decision/reason is the Stop-hook contract for Claude Code and the
  // agentStop decision-control contract for Copilot.
  process.stdout.write(JSON.stringify({ decision: "block", reason }) + "\n");
  process.exit(0);
};

// --- read the hook payload from stdin (both platforms send JSON) -------------
let payload = null;
try {
  const raw = readFileSync(0, "utf8");
  if (raw.trim()) payload = JSON.parse(raw);
} catch {
  payload = null;
}

// Avoid infinite loops: if we are already continuing because of this hook, let it pass.
if (payload && (payload.stop_hook_active === true || payload.stopHookActive === true)) skip();

// --- opt-out ------------------------------------------------------------------
const enforce = (process.env.AI_DLC_ENFORCE_TESTS ?? "").toLowerCase();
if (["false", "0", "no", "off"].includes(enforce)) skip();

// --- locate the project -------------------------------------------------------
const projectDir = process.env.CLAUDE_PROJECT_DIR || payload?.cwd || process.cwd();
const git = (args) => spawnSync("git", args, { cwd: projectDir, encoding: "utf8", windowsHide: true });

const top = git(["rev-parse", "--show-toplevel"]);
const inGit = top.status === 0 && top.stdout.trim() !== "";
const repoRoot = inGit ? path.resolve(top.stdout.trim()) : projectDir;

// Not a Node.js repository → nothing to gate.
const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", "bin", "obj"]);
function hasPackageJson(dir, depth) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  if (entries.some((e) => e.isFile() && e.name === "package.json")) return true;
  if (depth === 0) return false;
  return entries.some((e) => e.isDirectory() && !IGNORED_DIRS.has(e.name) && hasPackageJson(path.join(dir, e.name), depth - 1));
}
if (!hasPackageJson(repoRoot, 4)) skip();

// --- artifact-only exemption --------------------------------------------------
if (inGit) {
  const status = spawnSync("git", ["-C", repoRoot, "status", "--porcelain", "--untracked-files=all", "-z"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const entries = (status.stdout || "").split("\0").filter(Boolean);
  const changed = [];
  for (let i = 0; i < entries.length; i++) {
    const code = entries[i].slice(0, 2);
    changed.push(entries[i].slice(3));
    if (code.includes("R") || code.includes("C")) i++; // skip the rename/copy source path
  }
  if (changed.length === 0) skip(); // nothing changed this session

  const artifactOnly = /^(\.claude\/|\.github\/(agents|skills|prompts|instructions|hooks)\/|docs\/|AGENTS\.md$|CLAUDE\.md$)|\.md$/i;
  const dotnetOnly = /\.(cs|csx|csproj|fs|fsproj|vb|vbproj|sln|slnx|props|targets|razor|cshtml)$/i;
  const runtime = changed.filter((f) => !artifactOnly.test(f) && !dotnetOnly.test(f));
  if (runtime.length === 0) skip();
}

// --- choose the test command --------------------------------------------------
function detectPackageManager(dir) {
  if (existsSync(path.join(dir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(path.join(dir, "yarn.lock"))) return "yarn";
  if (existsSync(path.join(dir, "bun.lockb")) || existsSync(path.join(dir, "bun.lock"))) return "bun";
  return "npm";
}

const testCwd = path.resolve(repoRoot, process.env.AI_DLC_NODE_TEST_CWD || configured(CONFIRMED_TEST_CWD) || ".");
let command = process.env.AI_DLC_NODE_TEST_CMD || configured(CONFIRMED_TEST_CMD);

if (!command) {
  let scripts = {};
  try {
    scripts = JSON.parse(readFileSync(path.join(testCwd, "package.json"), "utf8")).scripts ?? {};
  } catch {
    skip(`no package.json in ${testCwd}; set AI_DLC_NODE_TEST_CMD. Skipping.`);
  }
  if (!scripts.test || /no test specified/i.test(scripts.test)) skip("no test script in package.json; skipping.");
  const pm = detectPackageManager(testCwd) === "npm" ? detectPackageManager(repoRoot) : detectPackageManager(testCwd);
  command = pm === "bun" ? "bun run test" : `${pm} test`;
}

// --- run the tests --------------------------------------------------------------
// shell: true resolves npm.cmd / pnpm.cmd on Windows and runs the command string as written.
// stdin is ignored so watch-mode runners (Vitest) see no TTY and run once.
const result = spawnSync(command, {
  cwd: testCwd,
  shell: true,
  encoding: "utf8",
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
  maxBuffer: 64 * 1024 * 1024,
});

if (result.error) skip(`could not run "${command}": ${result.error.message}. Skipping.`);

if (result.status !== 0) {
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const tail = output
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .slice(-40)
    .join("\n");
  block(`${command} failed (exit ${result.status ?? result.signal}). Fix all test failures before finishing. Last output:\n${tail}`);
}
process.exit(0);
