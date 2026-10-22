#!/usr/bin/env node
// sync-harness-on-stop.mjs — automatic harness sync (Claude Code "Stop" / Copilot "agentStop" hook).
// Local to this repository (the plugin repository): stop-sync-then-check.mjs runs it before the Copilot
// staleness check. Consumer repositories get no sync hook; they sync with /ai-dlc:harness-sync.
// Each time the agent stops, it runs .claude/scripts/sync-harness.mjs, which makes every agent, skill,
// command / prompt, rule / instruction and hook a developer made or edited on one platform exist on the
// other, then lets the agent finish. It never blocks and never loops: it always exits 0 and never answers
// with a "decision", whatever the sync does (nothing pending, files written, or an error; sync-harness
// signals an error with exit 2, which a Stop hook would otherwise read as "block").
// Silent when nothing was pending, when .claude/scripts/sync-harness.mjs is missing, or when
// AI_DLC_HARNESS_SYNC is false, 0, no or off. When it wrote files, or the sync failed, it says so:
// as a system message on Claude Code, on stderr elsewhere. CI must not write: run
// `node .claude/scripts/sync-harness.mjs --check` there instead.
// Dependency-free; runs on Windows, macOS and Linux with Node.js 18 or later.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

if (["false", "0", "no", "off"].includes((process.env.AI_DLC_HARNESS_SYNC ?? "").toLowerCase())) process.exit(0);

let payload = {};
try { payload = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch { payload = {}; }

const root = process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd();
const script = path.join(root, ".claude", "scripts", "sync-harness.mjs");
if (!fs.existsSync(script)) process.exit(0);

const r = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8", timeout: 100_000, windowsHide: true });
const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
// sync-harness prints one line per action written: `create`, `update` or `add hook`, then the target.
// Its notes and its "already in sync" summary stay quiet here.
const written = out.split(/\r?\n/).filter((l) => /^(create|update|add hook)\s/.test(l));
if (r.status === 0 && !written.length) process.exit(0);

const message = r.status === 0
  ? `Harness sync wrote ${written.length} change(s):\n${written.join("\n")}\nReview them before committing.`
  : `Harness sync did not finish (exit ${r.status ?? "none"}${r.error ? `, ${r.error.message}` : ""}); nothing blocks the stop. Run \`node .claude/scripts/sync-harness.mjs\` to see why.\n${out.trim()}`;
// Claude Code shows `systemMessage` to the user. Other platforms get plain stderr, so no JSON they might
// read as a decision ever reaches them.
if (payload.hook_event_name === "Stop") process.stdout.write(JSON.stringify({ systemMessage: message }));
else process.stderr.write(message + "\n");
process.exit(0);
