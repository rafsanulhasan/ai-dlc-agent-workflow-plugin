#!/usr/bin/env node
// stop-sync-then-check.mjs — one Stop hook for this repository that runs two steps in order:
//   1. sync-harness-on-stop.mjs: syncs the .claude/ <-> .github/ harness twins; never blocks;
//   2. check-copilot-stale.mjs: blocks finishing while the generated Copilot plugin or a generated
//      source is stale (node tools/build-copilot.mjs --check).
// They are one command because Claude Code runs the hooks of one event in parallel, with no order, and
// step 2 reads files step 1 can write: the build's --check compares the project mirrors in
// .claude/skills/<name>/ (tools/project-skills.json) with the plugin, and the sync may rewrite a mirror
// from its .github/skills/ twin. Run separately, the check could see a half-synced tree.
// The answer is step 2's: its block decision when it blocks (with step 1's message, if any, kept as the
// system message), else step 1's system message, else nothing. It exits with step 2's exit code.
// Time budget: each step may take up to 110 s (STEP_MS; sync-harness-on-stop.mjs gives the sync itself
// 100 s), so both together stay under the hook's 240 s timeout in .claude/settings.json and its Copilot
// twin's timeoutSec in .github/hooks/synced-from-claude.json (the sync matches hooks by command and
// does not carry a changed timeout over, so keep the two equal). A step that runs out of time counts as silent.
// The workflow gate (check-workflow.mjs) stays a separate Stop hook: it reads only .ai-dlc/, which the
// sync never writes.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
let input = "";
try { input = fs.readFileSync(0, "utf8"); } catch { input = ""; }

const STEP_MS = 110_000; // two steps × 110 s < 240 s, the hook's timeout
const step = (file) => spawnSync(process.execPath, [path.join(HERE, file)], { input, encoding: "utf8", timeout: STEP_MS, windowsHide: true });
const json = (text) => { try { return JSON.parse((text ?? "").trim() || "null"); } catch { return null; } };

const sync = step("sync-harness-on-stop.mjs");
if (sync.stderr) process.stderr.write(sync.stderr);
const syncAnswer = json(sync.stdout);

const check = step("check-copilot-stale.mjs");
if (check.stderr) process.stderr.write(check.stderr);
const checkAnswer = json(check.stdout);

const answer = checkAnswer ?? {};
if (syncAnswer?.systemMessage) answer.systemMessage = answer.systemMessage ? `${syncAnswer.systemMessage}\n${answer.systemMessage}` : syncAnswer.systemMessage;
if (Object.keys(answer).length) process.stdout.write(JSON.stringify(answer));
else if (check.stdout?.trim()) process.stdout.write(check.stdout);
process.exit(check.status ?? 0);
