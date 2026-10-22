---
run: AAW-20261022-fold-cache-keepalive
work-item: none
lifecycle: AAW
step: 6
from: orchestrator
to: brutal-critique
mode: subagent
loop: none
gate: none
verification: pending
date: 2026-10-22
---

# 6 orchestrator → brutal-critique: critique the docs of the keep-alive fold-in

## Goal
Decide, as PASS or REVISE, whether the docs from steps 4 and 5.1 are accurate, complete against the approved plan, honest about what the cache can and cannot do, and usable by their readers (users configuring keep-alive, agents following the skills).

## Request and intent
The human asked for:
- cache-keepalive folded into ai-dlc's auto-handoff module, with the separate mod dropped;
- a handoff that uses the warm cache;
- separate 1h and 5m tracks with two status lines;
- every setting configurable as an env var in settings.local.json or settings.json, in `.ai-dlc/cache-keepalive.json`, then `/config`, then the defaults, with invalid values ignored;
- every command prefixed with `ai-dlc:`.

The approved spec is `docs/handoffs/AAW-20261022-fold-cache-keepalive/plan.md`.

## Artifacts (docs to critique; all under `plugins/claude/ai-dlc/` unless the path starts at the repo root)
- `hooks/auto-handoff/keepalive/README.md` (moved and rewritten)
- `hooks/auto-handoff/ATTRIBUTION.md`
- `skills/keepalive/SKILL.md` (new)
- `skills/init/SKILL.md`
- `skills/configure-auto-handoff/SKILL.md`
- `skills/plugin-management/SKILL.md` (step 5.1)
- `.claude-plugin/plugin.json` — a manifest: data, so it is on the docs path; also on the code path
- repo root: `.claude-plugin/marketplace.json` (on both paths), `CLAUDE.md`, `README.md`, `THIRD_PARTY_NOTICES.md`
- repo root: `.claude/agent-memory/ai-dlc-agent-manager/MEMORY.md`, `reference_claude-plugin-config-facts.md`, `feedback_bash-heredoc-backslashes.md`
- `hooks/auto-handoff/keepalive/LICENSE` was moved unchanged; check only that it is still the upstream MIT text.
- The diff: `git diff HEAD -- <path>` (renames are staged; `git diff --cached -M` shows them as moves)

Context:
- `4-agent-manager-to-orchestrator.handback.md` — the intent and risks 3–14 (status rendering, 19 vs 20 pings, trust gating, Copilot rewriting the command)
- `5.1-agent-manager-to-orchestrator.handback.md`
- research `1.1`, `1.2`, `2`, `3` hand-backs: the facts the docs must match

## Gate evidence (orchestrator re-run)
- `node tools/build-copilot.mjs --check` → up to date
- `node --test "tests/**/*.test.mjs"` → 319/319
- `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/ai-dlc` and on `.` → passed
- `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc` → 285/285
- `plugins/claude-mods/` → removed; no references in the manifests, CI, `.claude/settings.json` or `CLAUDE.md`

## What to check
1. Each status line is explained correctly: "warm until" is the last ping plus the track's lifetime; "keep warm" is the total time to keep pinging.
2. The full env var table matches the plan (names, JSON keys, defaults); `5M_KEEP_WARM_FOR` is `1h` and `5M_PING_EVERY` is `3m`.
3. The precedence is stated correctly, and invalid values are said to be ignored.
4. The docs are honest that only the shared prefix can be reused, never the old conversation, and that refresh-on-read is unverified.
5. The command is `/ai-dlc:keepalive` everywhere in the Claude plugin, with no bare `/keepalive`.
6. No stale mentions of the mod, its dependency, `VENDORED.md` or `plugins/claude-mods/` remain.
7. Persona-name and plugin-development conventions from `.claude/rules/plugin-development.md` are followed.
8. The memory files hold no secrets.

## Instructions for the receiver
Read-only. Return:
- Line 1: `handoff 6-orchestrator-to-brutal-critique.handoff.md: passed|failed — <why>`
- a severity-ranked critique, one finding per line with `path:line`
- a final `verdict: PASS | REVISE`

Next hop: on REVISE, agent-manager fixes the findings (AAW critique loop, 2 rounds / 1 failure).

## Suggested skills
- the brutal-critique default critique workflow
- `skill-management` (the review checklist for agent-facing docs)
