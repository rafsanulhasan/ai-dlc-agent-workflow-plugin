---
run: AAW-20261021-mods-config
work-item: WI-M1
lifecycle: AAW
step: 5
from: orchestrator
to: agent-manager
mode: subagent
loop: round 2 of 3 (shared)
gate: none
verification: "passed — the record exists, is step 5, is addressed from orchestrator to agent-manager, and is loop round 2 of 3 (shared)"
date: 2026-10-21
---

# 5 orchestrator → agent-manager: round 2 fixes

Step numbering note: 2.l1 and 2.l2 were used for the round-1 resume and Revision 2, so round 2 continues at step 5.

## Goal
Fix the two findings that open round 2 (required). Also fix the optional items below where each is a small, local edit, and say which you did and which you left. Do not reopen the human decisions in `run.md` *Clarified intent* (8h default, `/keepalive` with session/machine scope, `thresholdPercent` default 80, main/lead session only, fallback window 500000, init guides `/config` and writes nothing).

## Required
1. **3.1 Major: the 500000 fallback's consequence is undocumented.** If Claude Code reports no window and the real window is smaller than 500000 (a 200k session), the line sits at 400k, above the window, so no handoff fires.
   - Add one sentence to `README.md` (near :88) and `plugins/claude/ai-dlc/skills/handoff/SKILL.md` (near :335): if your window is under 500000 and Claude Code reports none, no handoff happens; set `AUTO_HANDOFF_TOKENS` to an absolute token count. Stop calling `AUTO_HANDOFF_TOKENS` "for a test run" in those places if they say so.
   - Code side (4.1 suggestion, same cause): extend the one-time log line in `plugins/claude/ai-dlc/hooks/auto-handoff/register.tsx` (:474-482, currently "no context window reported: thresholdPercent applies to 500000") to say no handoff fires before that line, and point to `AUTO_HANDOFF_TOKENS`. Update any test that pins the log text, and make sure the docs quote the new text.
2. **4.1 Warning: a keep-warm duration under 50 minutes sends no ping.** `PING_EVERY_MS` is 50 min (`plugins/claude-mods/cache-keepalive/hooks/register.ts:9`), and the duration check at :161 runs only when the timer fires. So `keepWarmFor` or `/keepalive` under 50m sends no ping, yet the status reads "kept warm 30m, stopped".
   - Fix: keep the accepted input (the human chose minutes as a unit), and document the granularity. Pings come every 50 minutes, a duration under 50m sends none, and the cache's own lifetime covers that span. Put this in the `keepWarmFor` description in `plugins/claude-mods/cache-keepalive/.claude-plugin/plugin.json`, the `/keepalive` usage text, and the mod `README.md` duration section. Make the stop status for that case truthful (for example "no ping needed for 30m").
   - Add a test in `plugins/claude-mods/cache-keepalive/hooks/register.test.ts` that pins the under-50m behaviour and its status text.

## Optional (Minors and Suggestions; fix if each is a small, local edit)
- `plugins/claude-mods/cache-keepalive/README.md:42`: `/keepalive clear` follows `keepaliveScope`. Add "(in the default scope unless a flag is given)".
- `plugins/claude/ai-dlc/.claude-plugin/plugin.json:33`: "when this is set lower" → "when this leaves less than 40k above the new session's starting size".
- `plugins/claude/ai-dlc/hooks/auto-handoff/ATTRIBUTION.md:81-94`: note "(field shapes from the mods types; not yet checked on a live 1M session)". At :88, use a 1M window as the example instead of "200k window".
- `.claude/agent-memory/ai-dlc-agent-manager/reference_claude-plugin-config-facts.md:8`: add "minimum supported is 2.1.287".
- `plugins/claude-mods/cache-keepalive/hooks/duration.ts:15-18,22-25`: `0.4m` parses to 24 s and prints as `0m`. Require at least 1m.
- `duration.ts:43-44`: `/keepalive 2h 3h` reports "`3h` is not a duration". Use its own message, such as "give one duration".
- `plugins/claude/ai-dlc/hooks/auto-handoff/config.ts:56-63`: re-indent the `parseConfig` return object to 4 spaces.
- The accepted syntax beyond `<n>m|h|d` (fractions such as `1.5h`, the `--clear` alias, the 20-session store cap) is in no AC. Keep it, and list it in the mod `README.md` and `VENDORED.md` *Modifications*.

## Constraints
- Hooks-module code and tests stay under `plugins/claude/ai-dlc/hooks/`; record every change in its `ATTRIBUTION.md`. Mod changes stay in the mod; record them in `VENDORED.md` (and `THIRD_PARTY_NOTICES.md` if its wording no longer covers them).
- After any change under `plugins/claude/ai-dlc/`, run `node tools/build-copilot.mjs`, then `--check`.
- Run `node --test "tests/**/*.test.mjs"` (round 1: 177/177), `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc` (round 1: 133 pass), `npx @anthropic-ai/claude-code plugin test ./plugins/claude-mods/cache-keepalive` (round 1: 25 pass), and `npx @anthropic-ai/claude-code plugin validate --strict` on `./plugins/claude/ai-dlc`, `./plugins/claude-mods/cache-keepalive` and `.`.
- Scratch files go in `.scratch/mods-percent-config/`.

## Sources
Findings verbatim: `3.1-brutal-critique-to-orchestrator.handback.md`, `4.1-code-reviewer-to-orchestrator.handback.md`, `4.2-code-reviewer-to-orchestrator.handback.md`. ACs: `2-orchestrator-to-agent-manager.handoff.md`, `2.l2-orchestrator-to-agent-manager.handoff.md`. Tests and AC map: `3.2-sqa-engineer-to-orchestrator.handback.md`. All are in `docs/handoffs/AAW-20261021-mods-config/`.

## Orchestrator verification of round 1 (2026-10-21 16:24 UTC)
build `--check` up to date · 177/177 · 133 pass 0 fail · 25 pass 0 fail. I confirmed `PING_EVERY_MS = 50 * 60_000` at register.ts:9 and the duration check inside the timer callback at :161. I also confirmed init/SKILL.md:54-59 and :152-156 ask the questions and list the `/config` rows, so no AC-7 gap.

## Expected hand-back
Line 1: `handoff docs/handoffs/AAW-20261021-mods-config/5-orchestrator-to-agent-manager.handoff.md: passed|failed — <why>`. Then each finding, required and optional, marked fixed or left with a reason. Then the changed paths, each marked `code` or `docs`, the intent, and the real output of every check you ran.
