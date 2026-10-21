---
run: AAW-20261021-mods-config
work-item: WI-M1
lifecycle: AAW
step: 8
from: orchestrator
to: agent-manager
mode: subagent
loop: round 3 of 3 (shared, last)
gate: none
verification: "passed — hand-back line 1 passed; orchestrator re-ran: --check up to date, 177/177, ai-dlc hooks 134/134, cache-keepalive 32/32, validate --strict x3 passed; checked register.ts:194, duration.ts:43-47, no "under 50" left in docs."
date: 2026-10-21
---

# 8 orchestrator → agent-manager: round 3 polish (four open items from round 2)

## Goal
The human asked (2026-10-21) for a quick fix of the four non-blocking items left open after review round 2. Fix exactly these four, nothing else:

1. **6.1 Minor (docs):** `plugins/claude-mods/cache-keepalive/README.md:29`, `plugins/claude-mods/cache-keepalive/.claude-plugin/plugin.json:18` (`keepWarmFor` description) and `plugins/claude-mods/cache-keepalive/VENDORED.md:58` say a duration "under 50m" sends no ping. The code (`hooks/register.ts:163`, `now - armedTime >= keep.ms`) also sends none at exactly 50m. Change each to "50m or less" / "50 minutes or less", and any other place (the `/keepalive` usage text in `hooks/duration.ts` or `register.ts`, the handoff skill, the root README) that states the same bound. If a test pins that text, update the test.
2. **7.1 Suggestion (code):** `plugins/claude-mods/cache-keepalive/hooks/duration.ts:43-45` calls `parseDuration(w)` twice. Assign once (`const d = parseDuration(w)`) and test `d !== undefined`. No behaviour change.
3. **7.1 Suggestion (code):** `plugins/claude-mods/cache-keepalive/hooks/register.ts:194`, the `/config` problem text `keepWarmFor "<v>" in /config is not <n>m, <n>h or <n>d; using 8h`, omits the 1m minimum. Make it say the value must be at least 1m (match the `/keepalive` usage wording). Add or update a test that pins the new text for a sub-1m value such as `0.4m`.
4. **7.1 Suggestion (docs):** `plugins/claude/ai-dlc/.claude-plugin/plugin.json`, `thresholdPercent` description: "then, on a smaller window, no handoff fires once the line is past the window" is hard to parse. Reword, e.g. "if the real window is smaller than that line (80% of 500000 is 400000), no handoff fires, so set AUTO_HANDOFF_TOKENS …". Keep the meaning.

## Constraints
- Human decisions in `run.md` *Clarified intent* stay as they are.
- Record the change in `plugins/claude-mods/cache-keepalive/VENDORED.md` (a "Review round 3" entry) and, if any file under `hooks/auto-handoff/` changes, in its `ATTRIBUTION.md`.
- After changing anything under `plugins/claude/ai-dlc/`, run `node tools/build-copilot.mjs` and then `--check`.
- Run: `node --test "tests/**/*.test.mjs"`, `npx --yes @anthropic-ai/claude-code plugin test ./plugins/claude-mods/cache-keepalive`, `npx --yes @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc` (if its hooks changed), and `plugin validate --strict` on `./plugins/claude/ai-dlc`, `./plugins/claude-mods/cache-keepalive` and `.`.
- Do not commit.

## Run context
- Round-2 reports: `6.1-brutal-critique-to-orchestrator.handback.md`, `7.1-code-reviewer-to-orchestrator.handback.md`, `7.2-code-reviewer-to-orchestrator.handback.md`.
- Gate evidence before this step (orchestrator, 16:33 UTC): --check up to date; 177/177; ai-dlc hooks 134/134; cache-keepalive 30/30; validate --strict ×3 passed.

## Expected hand-back
Line 1: `handoff docs/handoffs/AAW-20261021-mods-config/8-orchestrator-to-agent-manager.handoff.md: passed|failed — <why>`. Then each item and how it was fixed, the checks run with their results, and **Changed paths**, each marked `code` or `docs`, plus the intent.
