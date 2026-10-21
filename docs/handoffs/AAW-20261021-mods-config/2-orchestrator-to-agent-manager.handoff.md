---
run: AAW-20261021-mods-config
work-item: WI-M1
lifecycle: AAW
step: 2
from: orchestrator
to: agent-manager
mode: subagent
loop: none
gate: none
verification: pending
date: 2026-10-21
---

# 2 orchestrator → agent-manager: percentage auto-handoff, configurable cache-keepalive duration, init guidance

## Goal
Make the automatic handoff fire at a percentage of the context window instead of a token count, make cache-keepalive keep the cache warm for a configurable duration, and have `/ai-dlc:init` tell the developer how to set both. Human decisions are in `run.md` *Clarified intent*; do not reopen them.

## Artifacts (read these first)
- `docs/handoffs/AAW-20261021-mods-config/run.md`: request and human decisions.
- Research hand-backs in this folder, all verified `passed`: `1.1` (cache-keepalive code, line-cited), `1.2` (auto-handoff threshold, tests that pin it), `1.3` (init, `pluginConfigs` scope, Copilot), `1.4` (agent scope, where values can live), `1.5` (mods API: `$.session.usage().context` has `tokens`/`window`/`percent`; command args via `e.args`; `$.store` is machine-wide; teammates not handoff-able).
- `plugins/claude/ai-dlc/hooks/auto-handoff/` (`config.ts`, `register.tsx`, `tests/`, `ATTRIBUTION.md`), `plugins/claude/ai-dlc/.claude-plugin/plugin.json` (`userConfig`).
- `plugins/claude-mods/cache-keepalive/` (`hooks/register.ts`, `.claude-plugin/plugin.json`, `README.md`, `VENDORED.md`, `LICENSE`), `THIRD_PARTY_NOTICES.md`.
- `plugins/claude/ai-dlc/skills/init/SKILL.md`, `plugins/claude/ai-dlc/skills/handoff/SKILL.md` (settings section ~:288, :333-349), `README.md` (:78, :82-86).

## Acceptance criteria
| AC | Requirement |
|---|---|
| AC-1 | auto-handoff gets a new `userConfig` number `thresholdPercent` (default 80, min 1, max 100), clamped in `config.ts`. The trigger compares the context percentage, computed from `$.session.usage().context` (`percent`, else `tokens / window`), with it. The old token `threshold` key is retired (not reused: stored 160000 values must not be read as a percent). Decide and document what happens to `AUTO_HANDOFF_TOKENS` (keep as an absolute-token override, or replace with a percent env var) and keep the seeded-session headroom guard working. If the host reports no window, fall back to a documented default (200000) and log it once. |
| AC-2 | The percentage applies to the main / lead session only (the existing `e.agentId` guards stay). Docs say teammates and subagents are not handed off automatically and point to `autoCompactWindow` for in-process teammates. |
| AC-3 | Update the module's tests for the new semantics (every case that pins 160k / tokens per research 1.2), fix the stale `config.ts:8` comment, record the change in `ATTRIBUTION.md`. |
| AC-4 | cache-keepalive gets a `userConfig` keep-warm duration (string, e.g. `keepWarmFor`, default `8h`, accepts `<n>m`, `<n>h`, `<n>d`; invalid → default with a log line). Pings stop when the duration since arming at `classic.Stop` is spent, alongside the existing budget, overage and miss stops (whichever comes first). |
| AC-5 | The mod's existing `keepalive` command (`register.ts:184`) takes an optional duration (`e.args`), e.g. `keepalive 2h`. A second `userConfig` option sets its default scope, `session` (default) or `machine`; a flag on the command (e.g. `--machine` / `--session`) overrides it for that call. Session scope overrides only the current session; machine scope persists in `$.store` and overrides the `/config` value in every session until cleared. Confirm and document the command's real invoked name. |
| AC-6 | cache-keepalive README documents the duration, the command, the scope, and that in-process teammates use a 5-minute cache unless `subagentPromptCacheTtl` is `1h`. `VENDORED.md` *Modifications* lists every local change (it says "None" today); `THIRD_PARTY_NOTICES.md` says the mod is modified. Keep the upstream `LICENSE`. Add or update the mod's tests for the duration parser, the cap and the command. |
| AC-7 | `/ai-dlc:init` (`skills/init/SKILL.md`) asks for the handoff percentage and the keep-warm duration in Phase 1, then tells the developer the exact `/config` rows to set; it writes no settings. Claude-only text is in a Claude variant so Copilot's init skips it and says these settings are Claude Code only. |
| AC-8 | `handoff/SKILL.md` and `README.md` (:78, :82-86, including the wrong "about 80%" line at :86) describe the new settings correctly. |
| AC-9 | Gates pass: `node tools/build-copilot.mjs` then `--check`; `node --test "tests/**/*.test.mjs"`; `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc`; `plugin validate --strict ./plugins/claude/ai-dlc` and `.`; `plugin validate --strict` and `plugin test` for `./plugins/claude-mods/cache-keepalive`; `node .ai-dlc/workflow.mjs validate`. |

## Gate evidence (before this change, re-run by orchestrator 2026-10-21 16:00 UTC)
- Build `--check`: up to date. Tests: 175/175. `plugin test ./plugins/claude/ai-dlc`: 121/121. Both `validate --strict`: passed. Workflow: valid. cache-keepalive validate/test: not re-run; run them as a baseline first.
- Mutation: n/a. Gate: none (AAW).

## Decisions so far
See `run.md` *Clarified intent*. Claude Code 2.1.287 minimum stays in the docs.

## Open questions / risks for the receiver
- **Uncommitted sibling work is on disk; build on it, do not revert it** (the absorbed auto-handoff module, MIT license, mod vendoring — all uncommitted on `feat/track-agent-memory`).
- `context.window` for 1M extended context is unconfirmed on a live host; the human will check it. Do not invent a per-model table.
- 1h cache refresh-on-read is a medium-confidence inference (1.5 Q4); the 8h duration relies on it. Say so in the README without overclaiming.
- If `pluginConfigs` / `$.config.set` details turn out undocumented, do not rely on them; init only guides.

## Expected hand-back
Line 1 `handoff <this file>: passed|failed — <why>`; then what changed per AC; the **changed paths, each marked `code` or `docs`**; the **intent**; and the real output of the AC-9 checks you ran.

## Revision 1 (human, 2026-10-21 16:40 UTC)
AC-1 fallback window changed: when the host reports no window, fall back to **700000** tokens (not 200000), documented and logged once. Everything else in AC-1 stands.
