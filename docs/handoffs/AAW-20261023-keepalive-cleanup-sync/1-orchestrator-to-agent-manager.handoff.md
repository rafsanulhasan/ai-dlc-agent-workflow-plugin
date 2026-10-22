---
from: orchestrator
to: agent-manager
step: 1
run: AAW-20261023-keepalive-cleanup-sync
---
# Handoff: two CLI cleanups, one explicit doc note, harness sync
Source: docs/handoffs/AAW-20261023-keepalive-explicit-defaults/3.1-code-reviewer-to-orchestrator.handback.md.
1. **Cleanup A** — plugins/claude/ai-dlc/skills/cache-keepalive-configure/templates/cache-keepalive.mjs:340-345: the JSDoc for `merged` sits above the `LEGACY` const. Move the `LEGACY` comment and constant above, so the JSDoc sits directly before `export function merged`.
2. **Cleanup B** — the same file, :414-416 and :614: `validateEnv` calls `effective()` for its default `applied` argument and again at :416, and the `validate` case calls it a third time for `shownRows`. Compute the rows once and derive `applied` and `inForce` from them; keep the exported signatures. No behaviour change: the existing tests must pass unchanged.
3. **Doc note (no code change)** — writing a track's `keepWarmFor` through the internal write recomputes that track's `maxPings`, even when the value equals the one already in the file, so it overwrites a hand-set lower `maxPings` (the output line says so); name `maxPings` in the same change to keep it. State this explicitly in the cache-keepalive-configure SKILL.md change step and in the keep-alive README, and pin it with one test.
4. **Harness sync** — run `node .claude/scripts/sync-harness.mjs` (it last reported 7 pending changes), then `--check` must report nothing pending. Keep the generated mirrors identical to their sources; do not hand-edit them. List what it wrote. (The .github/ twins from an earlier sync were committed in 97c431a.)
Checks: build and --check; node --test "tests/**/*.test.mjs"; plugin test; both plugin validate; workflow validate; sync-harness --check. Don't commit.
Return: line 1 `handoff <this file>: passed|failed — <why>`, the changed paths marked code/docs/generated, the checks.

## Amendment (human, 2026-10-23): the harness sync becomes automatic in this repository
Behaviour everywhere: local hooks **sync, then carry on**; CI, which must not write, runs `--check` and fails when anything is pending.
5. **This repo, Claude Code hook:** a hook in `.claude/settings.json` that runs `node .claude/scripts/sync-harness.mjs` when a session stops (beside the existing check-copilot-stale Stop hook; order it so the sync runs first). Use the hook-management skill's conventions; it must not loop or block when nothing is pending.
6. **CI:** in `.github/workflows/validate.yml`, a step running `node .claude/scripts/sync-harness.mjs --check` **before** the two `plugin validate --strict` steps.
7. **Local pre-validate script:** `tools/validate.mjs` (or a name that fits the repo) runs the sync, then both `plugin validate --strict` commands, and exits non-zero when any fails. Add it to CLAUDE.md "Commands" and `.claude/rules/plugin-development.md` as the validation command; give it a test in tests/ if it has logic worth testing.
Out of this run (a fresh agent-manager, run AAW-20261023-harness-sync-hook-init): installing the hook in consumer repositories through init and the harness-sync skill, and plugin-management's documentation of the CI and dev setup. Return any change those skills need as a request.
