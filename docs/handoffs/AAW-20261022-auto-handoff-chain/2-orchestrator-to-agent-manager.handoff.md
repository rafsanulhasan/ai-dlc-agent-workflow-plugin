---
run: AAW-20261022-auto-handoff-chain
work-item: none
lifecycle: AAW
step: 2
from: orchestrator
to: agent-manager
mode: subagent
loop: none
gate: none
verification: pending
date: 2026-10-22
---

# 2 orchestrator → agent-manager: auto-handoff chains while the run is active, hands off open records, names sessions, reads repo config

## Goal
The auto-handoff hooks module stops after two handoffs because only a typed prompt resets its `unattended` counter, and the seed prompt (origin `plugin`) never does. The human wants it to keep handing off until the AI-DLC run is finished, give each new session the open handoff files, name each session in the chain, and take every setting from a repo file `.ai-dlc/auto-handoff.json` (configurable via `/ai-dlc:init` and a new `/ai-dlc:configure-auto-handoff`).

## Artifacts
- `docs/handoffs/AAW-20261022-auto-handoff-chain/plan.md` — **the approved plan; sections A–F are the spec.** Verified: copy of the plan the human approved on 2026-10-22.
- `docs/handoffs/AAW-20261022-auto-handoff-chain/1-research-assistant-to-orchestrator.handback.md` — how a mod can name a session. Verified by the orchestrator against the bundled engine types (Claude Code 2.1.306, `plugin-authoring` skill's `types/claude-code.d.ts`): `sessionTitle` is a `ClassicResult` field for SessionStart/UserPromptSubmit (:1332-1334); `session_title` is on the classic SessionStart (:12251) and UserPromptSubmit (:15597) inputs; `command.run` takes `{ command, args }` (:1817-1828); no `session.start` fires after `/clear` (:11597-11605).
- `plugins/claude/ai-dlc/hooks/auto-handoff/` — the module (`register.tsx`, `config.ts`, `run.ts`, `brief.ts`, `templates/`, `tests/`, `ATTRIBUTION.md`).
- `plugins/claude/ai-dlc/.claude-plugin/plugin.json` — `userConfig` for the six current settings.
- `plugins/claude/ai-dlc/skills/handoff/SKILL.md` — *The automatic path* section.
- `plugins/claude/ai-dlc/skills/init/SKILL.md` — the step that asks for the threshold percentage.

## Decisions so far
- Chain stop: run state decides. An `active` run on the branch claimed by this session (or its lineage) → no `unattended` cap; `done` / `blocked` / `abandoned` → stop; no active run → the existing `maxConsecutiveHandoffs` guard (default 2).
- Handed-off files: only open work — `run.md`, the session handoff note, and the handoff/hand-back paths of *Stages* rows whose status is not `done` / `skipped`; `last-record` and its pair first when its stage is open. Built in code, not by Haiku.
- Names: `[ai-dlc:auto-handoff]: <original name> (Session N)`; the original session is renamed `(Session 1)` before `/clear`; the base name is carried in the lineage record, never nested. Per the research:
  - new session → return `{ sessionTitle }` from the `classic.SessionStart` (`source: 'clear'`) handler that already seeds it;
  - old session → only if `(await $.command.list())` includes `rename`, `$.command.run({ command: 'rename', args })` before `clear`; otherwise log and skip;
  - original name → `session_title` from the classic SessionStart / UserPromptSubmit input (cache it), else the transcript's last `custom-title`, else `ai-title`, else the 8-char id.
  - A failed or unavailable rename is logged and never blocks the handoff.
- Config precedence, per key, **corrected by the human on 2026-10-22 (local wins; reverses plan F)**: `env` of `.claude/settings.local.json` > `env` of `.claude/settings.json` > `.ai-dlc/auto-handoff.json` > plugin `userConfig` > built-in default. Same order as the workflow loop-limit overrides.
- **`/rename` must be confirmed at runtime by `/ai-dlc:init`** (human, 2026-10-22). init is a model-run skill and cannot call `$.command.list()` itself, so give it a way to check: e.g. the module records the runtime result of `$.command.list()` (whether `rename` is present, plus the Claude Code version) to a state file at each session start and init reads it, or another mechanism you find in the engine types. When `rename` is missing, init tells the human (old-session `(Session 1)` naming will be skipped; new sessions are still named through `sessionTitle`) and records it; it never fails init. Document the check in the init step and in `configure-auto-handoff`. Env keys `AI_DLC_AUTO_HANDOFF_*` (table in plan F). Old `AUTO_HANDOFF_*` names dropped (1.0.0 unreleased). `DISABLE_AUTO_COMPACT` still honoured. Read the two settings files directly; invalid values log and fall through; reload at each session start.
- Existing-file update: add new keys, remove keys that no longer exist, keep values set. Done by `configure-auto-handoff` and by `init` on re-run. **Deviation from plan F:** do not touch the `workflow` skill (`/ai-dlc:workflow upgrade`) — it is a skill you own, so changing it needs a separate run by a fresh agent-manager; leave it out.

## Open questions / risks for the receiver
- `configure-auto-handoff` must not appear in the Copilot plugin, or must say it does not apply there: check how `tools/build-copilot.mjs` handles a Claude-only skill and pick the least invasive route. Changing the build itself is out of scope unless it is the only way; if so, return it as a request.
- The test mock in `tests/auto-handoff.test.tsx` (~:159-163) answers every `command.run` as `/clear`; make it branch on `command`, and give it a `command.list`.
- Whether the engine honours `sessionTitle` from a module and whether `rename` exists cannot be proved in unit tests; cover the calls in tests and record the open runtime check in ATTRIBUTION.md / your report.

## Suggested skills
- `hook-management` — hooks module conventions in this plugin.
- `skill-management` — writing guide and review checklist for the new skill and the SKILL.md edits.
- `plugin-management` — this repo's build, layout and checks.
- `plugin-authoring` — the engine API (`$.command`, `classic.SessionStart`, `ClassicResult.sessionTitle`).

## Instructions for the receiver
Line 1 of your report: `handoff 2-orchestrator-to-agent-manager.handoff.md: passed|failed — <why>`. Implement plan sections A–F (with the deviation above) in `plugins/claude/ai-dlc/` only; record the change in `hooks/auto-handoff/ATTRIBUTION.md`; run `node tools/build-copilot.mjs`. Run and report: `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc`, `node --test "tests/**/*.test.mjs"`, `node tools/build-copilot.mjs --check`, both `plugin validate --strict` commands. Do not commit. End with **Changed paths** (each marked `code`, `docs` or `generated`), **Intent**, **Checks** (command + result). Next hop: orchestrator → brutal-critique (docs) and sqa-engineer → code-reviewer (code).
