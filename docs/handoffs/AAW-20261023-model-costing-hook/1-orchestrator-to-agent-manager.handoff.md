---
run: AAW-20261023-model-costing-hook
lifecycle: AAW
step: 1
from: orchestrator
to: agent-manager
mode: subagent
loop: none
gate: none
verification: passed
date: 2026-10-23
---

# 1 orchestrator → agent-manager: `.ai-dlc/model-costing.json` and the project hook that keeps it current

## Goal
Every repository set up with `/ai-dlc:init` — this one included — keeps an up-to-date price table for every model Anthropic offers in `.ai-dlc/model-costing.json`, refreshed by a **project** hook (the repository's own `.claude/settings.json`, never a plugin-wide hook). The plugin ships it as a skill that `init` runs to install it, like the stack test-gate hooks (`node-test-gate`, `dotnet-test-gate`). The ai-dlc-lens spike reads the file to compute cost; nothing estimates or hard-codes prices.

## Human's decisions (2026-10-23, binding)
- Cost only from this file; a model missing from it shows `—`.
- When: "after every run completes and just before committing. can be parallely with plugin validation". Read as: (a) a **Stop** hook entry of its own, so it runs in parallel with the existing Stop commands (`.claude/hooks/stop-sync-then-check.mjs`, `check-workflow.mjs`) — not chained into them; and (b) before a commit: a `PreToolUse` hook on Bash `git commit` (Claude-run commits). Say in your hand-back whether you also add a git pre-commit hook and why / why not.
- **Installed by `/ai-dlc:init` in target repositories, and in this repository** (human, 2026-10-23, superseding "this repository only"). Not a plugin-wide hook: the plugin ships no settings hooks (CLAUDE.md, Architecture).

## Do
1. **Source of prices.** Use Anthropic's official public pricing (the Claude API docs pricing page). Confirm the URL and the page structure (via `research-assistant` if you need it); do not invent prices. Record per model: id and aliases, input $/MTok, output $/MTok, cache write (5 min and 1 h) $/MTok, cache read $/MTok, and any long-context tier; plus `source`, `fetchedAt`, `currency`.
2. **File + schema.** `.ai-dlc/model-costing.json` with a `.ai-dlc/model-costing.schema.json`, matching the style of the other `.ai-dlc/*.json` + schema pairs. Seed it with a real fetch.
3. **Install skill.** A new plugin skill (e.g. `model-costing`, `disable-model-invocation: true`) under `plugins/claude/ai-dlc/skills/` with the script and schema as templates, which `init` follows via `${CLAUDE_SKILL_DIR}/../<skill>/SKILL.md` (`.claude/rules/plugin-development.md`). Follow the pattern of `node-test-gate` / `dotnet-test-gate` (skill-management, hook-management): what it copies, how it merges into `.claude/settings.json` without clobbering, the Copilot side (GitHub Copilot hook integration if the test-gate skills have one; else say why not), idempotent re-runs, and a note in `init`'s SKILL.md. Language-agnostic. Then run `node tools/build-copilot.mjs` and `node tools/validate.mjs`.
4. **Script** (the template, installed to `.claude/hooks/`) (Node, no dependencies, like the existing hooks): fetch, parse, validate, write atomically. Never block: on network or parse failure keep the old file, print one line saying so, exit 0. Short timeout. Throttle so back-to-back Stops do not refetch (say what interval you chose and why).
5. **Install it here** by following the new skill (this repository's `.claude/settings.json`): a separate Stop hook entry, and the PreToolUse Bash entry for `git commit`. Use the `hook-management` skill. If the harness sync twins (`.github/`) are affected, keep them in sync (`node .claude/scripts/sync-harness.mjs`).
6. **Tests** in `tests/` (`node:test`, `node:assert`) for the parser and the keep-old-file-on-failure path, with a saved fixture of the page — no network in tests.
7. Mention the skill, the file and the hook where this repo documents its hooks (`CLAUDE.md` "Watch out for" / `.claude/rules/plugin-development.md`, briefly).

## Addendum (human, 2026-10-23, sent while step 1 was running)
"in the hook, it will not just fetch the price per model, it will also fetch the metadata like ctx window, input/output tokens, cache read/write for both 5 mins and 1hr." So per model the file also holds: **context window** (and the long-context window where offered), **max input tokens** and **max output tokens**, and the cache read and cache write figures for **both the 5-minute and the 1-hour** cache — all from Anthropic's official docs (models overview + pricing pages), with each source URL recorded. A missing figure is `null`, never guessed. The schema, parser, fixtures and tests cover the new fields. The lens reads the context window from this file (spike 027 step 17.l2 is told).

## Do not
Hand-edit `plugins/copilot/**` (rebuild it); add a plugin-wide hook (`hooks/hooks.json`); touch `spikes/` (another agent-manager is reworking spike 027 in parallel); commit. Do not edit `agents/agent-manager.md` or a skill you own (`agent-management`, `skill-management`, `hook-management`, `rules-management`, `command-management`, `harness-sync`, `workflow`, `plugin-management`): if one needs a change (e.g. `plugin-management` documenting the new skill), return it as a request and a fresh agent-manager makes it.

## Return (compact)
Line 1: `handoff 1-orchestrator-to-agent-manager.handoff.md: passed|failed — <why>`. Then changed paths, each marked code or docs; the intent; the price source URL; the checks you ran with real results (`node --test "tests/**/*.test.mjs"`, `node tools/validate.mjs`, the script run by hand, `node .claude/scripts/sync-harness.mjs --check`, `node tools/build-copilot.mjs --check`); open questions.
