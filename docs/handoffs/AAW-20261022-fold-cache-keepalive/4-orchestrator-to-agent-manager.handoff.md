---
run: AAW-20261022-fold-cache-keepalive
work-item: none
lifecycle: AAW
step: 4
from: orchestrator
to: agent-manager
mode: subagent
loop: none
gate: none
verification: pending
date: 2026-10-22
---

# 4 orchestrator → agent-manager: fold cache-keepalive into ai-dlc's auto-handoff module, make the handoff cache-aware, rework keep-alive

## Goal
One ai-dlc hooks module manages both context (auto-handoff) and the prompt cache (keep-alive):
- the handed-off session reads as much warm cache as possible, and proves it in a log;
- keep-alive gets a 1-hour track and a 5-minute track, stops when a session's work is done, has every setting configurable, and uses only `ai-dlc:`-prefixed commands;
- the separate `cache-keepalive` mod and its dependency go away.

Why it matters: the human wants a single module, no command-name clash with other plugins, and honest cache behaviour.

## Artifacts
- `docs/handoffs/AAW-20261022-fold-cache-keepalive/plan.md` — **the approved spec. Follow it exactly.** It has the change scope, the command prefix changes, the precedence, the env var table, the defaults and the verification list. Verified: exists, matches what the human approved on 2026-10-22.
- `docs/handoffs/AAW-20261022-fold-cache-keepalive/run.md` — run state, with the human's decisions and verbatim additions. Verified.
- `1.1-research-assistant-to-orchestrator.handback.md` — how the status line and the ping loop work, with `register.ts` line refs. Verified.
- `1.2-research-assistant-to-orchestrator.handback.md` — what the cache can reuse across /clear; the seed-turn usage log site is `register.tsx:928-930`. Verified.
- `2-research-assistant-to-orchestrator.handback.md` — every setting and constant of the mod, and auto-handoff's env/config convention (`config.ts:70-84`, `:103-139`, `:152-185`). Verified.
- `3-research-assistant-to-orchestrator.handback.md` — every `/keepalive` mention; `$.command.register` names are bare. Verified.
- `docs/handoffs/AAW-20261022-auto-handoff-chain/5.2-research-assistant-to-orchestrator.handback.md` — earlier research: the full wiring list to change (manifests, marketplace, CI, notices). Verified: exists.
- Source: `plugins/claude-mods/cache-keepalive/` (the mod, its `LICENSE` and `VENDORED.md`) and `plugins/claude/ai-dlc/hooks/auto-handoff/` (the module, its `ATTRIBUTION.md` and `LICENSE`). Verified: exist.

## Acceptance criteria covered
| AC | What |
|---|---|
| AC-1 | Cache-aware handoff: the prefix stays stable across /clear; the old session's keep-alive timers are stopped before /clear; the seed turn logs `input_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens` and the 1h/5m split, and shows hit or miss in the status |
| AC-2 | The mod lives inside ai-dlc's hooks module and is registered by the one module. Its upstream MIT `LICENSE` is kept; `ATTRIBUTION.md` and `THIRD_PARTY_NOTICES.md` are updated. `plugins/claude-mods/cache-keepalive`, the `dependencies` entry of `ai-dlc`, its marketplace entry and its CI loop are removed |
| AC-3 | Stop rules: the work is done (all background tasks have ended, a new turn has started, the session has ended or been handed off), a ping misses, the time or ping limit is reached, or the optional spend limit is hit (`BUDGET_MULTIPLIER=0` turns it off; `compactOnCap` works as today) |
| AC-4 | Two tracks, detected from the `ephemeral_1h` / `ephemeral_5m` usage split. 1h: a ping every 50m, keep warm 8h. 5m: a ping every 3m, keep warm 1h. Each track has its own status line, and a track not in use shows `off` |
| AC-5 | Every setting in the plan's env var table (`AI_DLC_KEEPALIVE_*`) is configurable. Precedence, highest first: the `/ai-dlc:keepalive` override, then the env of `.claude/settings.local.json`, then the env of `.claude/settings.json`, then `.ai-dlc/cache-keepalive.json`, then `/config` userConfig, then the defaults. The process env is not read. An invalid value at any level is ignored with a warning and the next level applies. There is one defaults table (no duplicate `8h`) |
| AC-6 | No bare `/keepalive` command remains: first try `name: 'ai-dlc:keepalive'`; else add a plugin skill `/ai-dlc:keepalive`; else stop and return `clarify:` to the human. Every mention listed in the plan is updated |
| AC-7 | Docs explain each status line, give the full env var table, and say what the cache can and cannot reuse, including that refresh-on-read is unverified. The init skill, `configure-auto-handoff`, `plugin-management`, `CLAUDE.md` (Architecture, Commands, Watch out for) and the README are updated where they mention the mod |
| AC-8 | Tests cover: the precedence across all six levels, with an invalid value falling through at each one; the scheduling of both tracks and every stop condition; the spend limit on and off; the timers cleared before /clear; both status lines; the command name |

## Gate evidence
- Build: n/a (not run yet)
- Tests: n/a
- Gate: none (AAW has no gates)

## Decisions so far
- The human's decisions are in `run.md` (*Clarified intent*) and `plan.md` (*Your decisions*).
- Auto-handoff's own settings keep their existing precedence and `.ai-dlc/auto-handoff.json`. The keep-alive precedence is separate.

## Open questions / risks for the receiver
- It is unknown whether `$.command.register` accepts a colon in a name. Check it with `claude plugin test` or the mods docs, and record the evidence.
- Hooks-module files must stay under `plugins/claude/ai-dlc/hooks/`, never `skills/`, `agents/` or `scripts/`; the Copilot build fails otherwise. `hooks/hooks.json` stays `modules` only.
- The orchestrator memory `project_mods-release-scope.md` plans a separate Claude-only mods plugin. Do not edit orchestrator memory; report any conflict instead.

## Suggested skills
- `plugin-management` — this repository's layout, build and CI
- `hook-management` — hooks-module rules
- `skill-management` — only if the fallback `/ai-dlc:keepalive` skill is needed; also the writing guide for docs
- `plugin-authoring` — the mods API (`$.command.register`, `$.env`, `$.model.fork`, the status line)

## Instructions for the receiver
Make the change in the plan. You are the only agent allowed to change these files.

Before you return, run all of these and paste their real output:
- `node tools/build-copilot.mjs`, then `node tools/build-copilot.mjs --check`
- `node --test "tests/**/*.test.mjs"`
- `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/ai-dlc`
- `npx @anthropic-ai/claude-code plugin validate --strict .`
- `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc`

Report only; do not commit.

Return a compressed report:
- **Line 1:** `handoff 4-orchestrator-to-agent-manager.handoff.md: passed|failed — <why>`
- **Changed paths:** each marked `code` or `docs` (or `generated`)
- **Intent:** one paragraph
- **Command naming:** the option used, with evidence
- **Checks:** each command with its result
- **Risks or deviations from the plan:** anything else

**Next hop:** the orchestrator re-runs the checks. Docs then go to brutal-critique, and code to sqa-engineer and then code-reviewer.
