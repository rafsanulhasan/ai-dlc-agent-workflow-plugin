#!/usr/bin/env node
// stop-sync-then-check.mjs — one Stop hook for this repository that runs three steps in order:
//   0. tools/build-standards.mjs: writes the .claude/rules/ and .github/instructions/ twins from the
//      standards in .forgeline/memory-bank/project/standards/; never blocks, and skipped when the script
//      is absent;
//   1. sync-harness-on-stop.mjs: syncs the .claude/ <-> .github/ harness twins; never blocks;
//   2. check-copilot-stale.mjs: blocks finishing while the generated Copilot plugin or a generated
//      source is stale (node tools/build-copilot.mjs --check).
// Step 0 runs before the sync because both write the rule twins: run after it, or in parallel, a stale
// generated twin could be synced to its other side first.
// They are one command because Claude Code runs the hooks of one event in parallel, with no order, and
// step 2 reads files step 1 can write: the build's --check compares the project mirrors in
// .claude/skills/<name>/ (tools/project-skills.json) with the plugin, and the sync may rewrite a mirror
// from its .github/skills/ twin. Run separately, the check could see a half-synced tree.
// The answer is step 2's: its block decision when it blocks (with step 0's and step 1's messages, if
// any, kept as the system message), else those messages, else nothing. It exits with step 2's exit code.
// Fail-open, but never silent: a step that times out or crashes (a spawn error, a signal, or a non-zero
// exit with no JSON answer) is skipped, and the hook says so in one line naming the step and the reason,
// on stderr and, on Claude Code (hook_event_name "Stop"), in the system message. It never blocks for it:
// a check that did not finish counts as passing, and the hook then exits 0.
// Time budget: step 0 may take up to 15 s (STANDARDS_MS), steps 1 and 2 up to 110 s each (STEP_MS;
// sync-harness-on-stop.mjs gives the sync itself 100 s), so all three together (235 s) stay under the
// hook's 240 s timeout in .claude/settings.json and its Copilot twin's timeoutSec in
// .github/hooks/synced-from-claude.json (the sync matches hooks by command and
// does not carry a changed timeout over, so keep the two equal). AI_DLC_STOP_STEP_MS overrides the step
// timeout, for tests only (step 0 takes the smaller of it and STANDARDS_MS).
// The workflow gate (check-workflow.mjs) stays a separate Stop hook: it reads only .ai-dlc/, which the
// sync never writes.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
let input = "";
try { input = fs.readFileSync(0, "utf8"); } catch { input = ""; }
let onClaude = false;
try { onClaude = JSON.parse(input || "{}").hook_event_name === "Stop"; } catch { onClaude = false; }

const STEP_MS = 110_000; // two steps × 110 s < 240 s, the hook's timeout
const override = Number(process.env.AI_DLC_STOP_STEP_MS);
// Only a whole number of milliseconds above 0 is taken (spawnSync rejects Infinity and fractions with a
// RangeError, which would crash the hook before either step runs); anything else falls back to STEP_MS.
const STEP_MS_IN_FORCE = Number.isSafeInteger(override) && override > 0 ? override : STEP_MS; // STEP_MS, unless a test lowers it
const step = (file) => spawnSync(process.execPath, [path.join(HERE, file)], { input, encoding: "utf8", timeout: STEP_MS_IN_FORCE, windowsHide: true });
const json = (text) => { try { return JSON.parse((text ?? "").trim() || "null"); } catch { return null; } };

// Why a step did not finish, or undefined when it did. A non-zero exit with a JSON answer is a verdict
// (the check may exit non-zero with its block decision), not a crash.
function failure(r) {
  if (r.error?.code === "ETIMEDOUT") return `timed out after ${STEP_MS_IN_FORCE / 1000} s`;
  if (r.error) return `could not run (${r.error.code ?? r.error.message})`;
  if (r.signal) return `was stopped by ${r.signal}`;
  if (r.status !== 0 && !json(r.stdout)) return `crashed (exit ${r.status})`;
  return undefined;
}

const notes = [];
function settle(r, file, label) {
  if (r.stderr) process.stderr.write(r.stderr);
  const why = failure(r);
  if (why) notes.push(`stop-sync-then-check: ${label} (${file}) ${why}; skipped, the stop is not blocked.`);
  return { r, failed: !!why, answer: why ? null : json(r.stdout) };
}

// Step 0: the standards build. It prints plain lines (create / update / problems) and exits 0, 1 or 2;
// it never blocks: what it wrote, or why it stopped, becomes one system message.
const STANDARDS_MS = 15_000;
const standardsScript = path.resolve(HERE, "..", "..", "tools", "build-standards.mjs");
let standardsMessage;
if (fs.existsSync(standardsScript)) {
  const ms = Math.min(STANDARDS_MS, STEP_MS_IN_FORCE);
  const r = spawnSync(process.execPath, [standardsScript, "--root", path.resolve(HERE, "..", "..")], { encoding: "utf8", timeout: ms, windowsHide: true });
  if (r.stderr) process.stderr.write(r.stderr);
  const lines = `${r.stdout ?? ""}${r.stderr ?? ""}`.split(/\r?\n/).filter((l) => l.trim() && !/^\d+ twin\(s\) current/.test(l) && !/^note /.test(l));
  if (r.error?.code === "ETIMEDOUT") standardsMessage = `stop-sync-then-check: the standards build (tools/build-standards.mjs) timed out after ${ms / 1000} s; skipped, the stop is not blocked.`;
  else if (r.error || r.signal) standardsMessage = `stop-sync-then-check: the standards build (tools/build-standards.mjs) could not run (${r.error?.code ?? r.signal}); skipped, the stop is not blocked.`;
  else if (r.status === 0 && lines.length) standardsMessage = `Standards build wrote ${lines.length} rule twin(s):\n${lines.join("\n")}\nReview them before committing.`;
  else if (r.status !== 0) standardsMessage = `Standards build did not finish (exit ${r.status}); nothing blocks the stop. Run \`node tools/build-standards.mjs\` to see why.\n${lines.join("\n")}`;
}

const sync = settle(step("sync-harness-on-stop.mjs"), "sync-harness-on-stop.mjs", "the harness sync");
const check = settle(step("check-copilot-stale.mjs"), "check-copilot-stale.mjs", "the Copilot staleness check");

for (const n of notes) process.stderr.write(`${n}\n`);
const answer = check.answer ?? {};
const messages = [standardsMessage, sync.answer?.systemMessage, answer.systemMessage, ...(onClaude ? notes : [])].filter(Boolean);
if (messages.length) answer.systemMessage = messages.join("\n");
if (Object.keys(answer).length) process.stdout.write(JSON.stringify(answer));
else if (!check.failed && check.r.stdout?.trim()) process.stdout.write(check.r.stdout);
process.exit(check.failed ? 0 : (check.r.status ?? 0));
