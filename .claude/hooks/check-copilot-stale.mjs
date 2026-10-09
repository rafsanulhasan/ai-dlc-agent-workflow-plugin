#!/usr/bin/env node
// check-copilot-stale.mjs — Stop hook for this repository.
// Blocks the agent from finishing while plugins/copilot/ai-dlc is stale relative to
// plugins/claude/ai-dlc (the source of truth), so the agent regenerates it before stopping.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

let payload = {};
try { payload = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch { payload = {}; }

// Loop guard: if we are already continuing because of a Stop hook, let it pass.
if (payload.stop_hook_active === true) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd();
const build = path.join(root, "tools", "build-copilot.mjs");
if (!fs.existsSync(build)) process.exit(0);

const r = spawnSync(process.execPath, [build, "--check"], { cwd: root, encoding: "utf8" });
if (r.status === 0) process.exit(0);

const detail = `${r.stderr ?? ""}${r.stdout ?? ""}`.trim();
process.stdout.write(JSON.stringify({
  decision: "block",
  reason: `The generated Copilot plugin is stale. Run \`node tools/build-copilot.mjs\` and confirm \`node tools/build-copilot.mjs --check\` passes before finishing.\n${detail}`,
}));
process.exit(0);
