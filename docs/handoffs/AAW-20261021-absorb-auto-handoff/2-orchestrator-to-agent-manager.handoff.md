---
run: AAW-20261021-absorb-auto-handoff
work-item: WI-4
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

# 2 orchestrator → agent-manager: absorb auto-handoff into ai-dlc and merge it with the `handoff` skill

## Goal
Make the automatic context-limit handoff part of ai-dlc's own `handoff` procedure instead of a separate mod, so one procedure covers both the manual and the automatic session handoff, and a resumed session picks the run up from `run.md`. The human asked: "handoff and auto-handoff should be merged into one." They chose "absorb the mod into ai-dlc".

## Artifacts
- `C:/Users/rafsa/.claude/plans/i-have-decided-to-distributed-wozniak.md`: the confirmed plan. **WI-4** is the scope of this hand-off; read it first. Verified: exists, WI-4 section present.
- `docs/handoffs/AAW-20261021-absorb-auto-handoff/1-research-assistant-to-orchestrator.handback.md`: feasibility research (AC-1 and AC-5 are the parts that matter here). Verified: line 1 `passed`; Go/no-go section present.
- `plugins/claude-mods/auto-handoff/`: the vendored mod to absorb (`hooks/hooks.json` = `{ "modules": ["./register.tsx"] }`, `hooks/register.tsx`, `.claude-plugin/plugin.json` with 6 `userConfig` keys, tests `tests/viewer.test.ts`, `tests/seed-row.test.tsx`, `tests/auto-handoff.test.tsx`, upstream MIT `LICENSE`, `VENDORED.md`). Verified: the folder exists (untracked in git; it was never committed).
- `plugins/claude/ai-dlc/skills/handoff/SKILL.md`: the manual *Session handoff (mid-stage)* section is the procedure to merge with.
- `tools/build-copilot.mjs`: the Claude → Copilot projection (research: hooks read at `:314-331`, skills copied verbatim at `:282-285`, manifest fields at `:131-142`).

## Acceptance criteria covered
| AC | Where it is satisfied / tested |
|---|---|
| AC-1 | The hooks module, its config, statusline, viewer and templates live under `plugins/claude/ai-dlc/` **outside `skills/`**. `plugins/claude/ai-dlc/hooks/hooks.json` holds **only** `modules`, no `hooks` key. |
| AC-2 | The mod's upstream MIT `LICENSE` and an attribution note sit inside the moved folder. `THIRD_PARTY_NOTICES.md` and the attribution say it is now incorporated into ai-dlc, not vendored. |
| AC-3 | The 6 `userConfig` keys are merged into `plugins/claude/ai-dlc/.claude-plugin/plugin.json`, schema-valid per the manifest reference. `auto-handoff` is removed from its `dependencies`, from `.claude-plugin/marketplace.json` and from `.claude/settings.json` `enabledPlugins`. `plugins/claude-mods/auto-handoff/` is deleted, and its CI steps in `.github/workflows/validate.yml` are removed. |
| AC-4 | CI gets `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc`. The moved tests pass under it, and `plugin validate --strict ./plugins/claude/ai-dlc` passes with the module. |
| AC-5 | The automatic trigger writes the `handoff` skill's session handoff: same template, `.scratch/<run-folder>/session-<YYYYMMDD-HHMM>.md` when an active `run.md` exists for the current branch, with a link to it. It updates that `run.md` *Next action* **before** the `/clear`, and the seeded prompt tells the new session to resume from it. With no active run it keeps the mod's current brief behavior. |
| AC-6 | `skills/handoff/SKILL.md` describes the manual and automatic paths as **one** procedure. Copilot, and Claude with the trigger disabled, use the manual path. It documents the kill switches and the main-loop-only `tool.call` gate, and states the Claude Code 2.1.287+ requirement. |
| AC-7 | `tools/build-copilot.mjs` keeps the Claude-only module out of the Copilot plugin: no module file, no `hooks.json`, no `userConfig` in `plugins/copilot/ai-dlc/`. A new `node:test` test under `tests/` proves it. The generated copy `skills/plugin-management/templates/build-copilot.mjs` is regenerated. |
| AC-8 | The orchestrator's Run Loop step 1 (`agents/orchestrator.md`) resumes the active run after an automatic seed. The build regenerates `skills/init/templates/AGENTS.md`; do not hand-edit it. |
| AC-9 | `node tools/build-copilot.mjs --check` passes. `node --test "tests/**/*.test.mjs"` passes. Both `plugin validate --strict` commands (plugin and marketplace) pass. `plugin validate --strict` and `plugin test` for `plugins/claude-mods/cache-keepalive` still pass. |

## Gate evidence
- Build: `node tools/build-copilot.mjs --check` → "Copilot plugin and generated sources are up to date." (2026-10-21 11:10, before this change)
- Tests: `node --test "tests/**/*.test.mjs"` → 164 passed, 0 failed
- Workflow: `node .ai-dlc/workflow.mjs validate` → valid. Catalog `plugin.version` 1.0.0-preview1 matches the plugin.
- Mutation: n/a (none set up for this stack)
- Review: n/a
- Gate: none (AAW has no gates)

## Decisions so far
- Absorb auto-handoff into ai-dlc; cache-keepalive stays a vendored mod and a `dependencies` entry (human, 2026-10-21).
- The absorbed trigger is Claude-only. Copilot port: NO-GO (research step 1: no token-usage field, timer, programmatic `/clear` or model call in Copilot hooks). Copilot keeps the manual path.
- The README's "Claude Code 2.1.287+" requirement stays, because older-CLI behavior with `modules` is undocumented.

## Clarifications carried forward
| # | Asked → answered by | Refers to | Question | Answer | Artifact revised by owner |
|---|---|---|---|---|---|

## Open questions / risks for the receiver
- **Uncommitted sibling work is on disk. Do not revert it.** WI-1 (MIT license, run `AAW-20261021-mit-license`) changed `plugins/claude/ai-dlc/.claude-plugin/plugin.json`, both marketplaces, `tools/build-copilot.mjs` (+ generated copy), `plugins/*/ai-dlc/LICENSE` and `tests/build-copilot-license.test.mjs`. Earlier mod-vendoring work changed `.claude/settings.json`, `CLAUDE.md`, `README.md`, `THIRD_PARTY_NOTICES.md` and `.github/workflows/validate.yml`. Build on the working tree as it is.
- Users who installed the standalone `auto-handoff` keep it until `claude plugin prune`, so two copies could run at once (undocumented). Add an upgrade note to `README.md` telling them to uninstall it.
- `plugin test ./plugins/claude/ai-dlc` picks up any `*.test.ts(x)` anywhere in the plugin. Keep the tests out of `skills/`.
- `.tsx` imports: confirm the moved module still resolves its relative imports, such as viewer and templates, from the new location.
- If an AC cannot be met as written (for example, the mod's seed cannot find the active `run.md`), return a `clarify:` request (`agent-invocation` format) instead of guessing.

## Suggested skills
- `plugin-management`: this repository's layout, build and CI. Update it for the new `hooks/` module.
- `hook-management`: mod hooks module conventions.
- `skill-management`: writing guide and review checklist for the `handoff` SKILL.md edit.
- `agent-management`: the orchestrator Run Loop edit.

## Instructions for the receiver
Make the WI-4 change on disk (write code and docs) to meet AC-1…AC-9. Then run every check in AC-9 yourself and include the real output lines. Do not commit.

Return a compressed report:
- Line 1 exactly: `handoff 2-orchestrator-to-agent-manager.handoff.md: passed|failed — <why>`.
- Then **Changed paths**: one per line, `path — code|docs|generated — <≤10-word change>`, including deletions.
- Then **Intent**: 2–3 sentences.
- Then **Checks**: command → result, one per line.
- Then any open risks.

Next hop: the orchestrator re-runs the checks, then sends the docs paths to brutal-critique and the code to sqa-engineer → code-reviewer.
