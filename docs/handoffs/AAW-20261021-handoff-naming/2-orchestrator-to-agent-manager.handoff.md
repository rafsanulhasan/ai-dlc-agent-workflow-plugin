---
run: AAW-20261021-handoff-naming
work-item: none
lifecycle: AAW
step: 2
from: orchestrator
to: agent-manager
mode: subagent
loop: none
verification: pending
date: 2026-10-21
---

# Handoff 2: orchestrator → agent-manager (WI-B, main change)

## Goal
Make the team record **both** handoffs and handbacks with step / sub-step / loop codes, with the writer decided by orchestration mode (subagent vs agent team); add an agent-team orchestration mode; apply gap fixes O1/O2/O9, O3, O4, O6, O7, O8 (reference side) and the Claude-Code-only subagent-nesting correction; migrate existing records; save the deferred backlog in your memory. Today only handbacks get written because the writer of the stage handoff is undefined/contradictory.

## Parallel work — do not touch
A separate fresh agent-manager (run `AAW-20261021-handoff-naming-self`) owns: `agents/agent-manager.md`, everything under `skills/workflow/` (templates, schema, `workflow.mjs`, `references/aaw-review.md`), `skills/plugin-management/`, and the `.ai-dlc/` copies. It is adding the single authoritative lifecycle-code list to the workflow file (O8). Reference that list; do not define your own.

## Normative spec
Read section "Normative spec" in `docs/handoffs/AAW-20261021-handoff-naming-self/1-orchestrator-to-agent-manager.handoff.md` — folder `docs/handoffs/{LIFECYCLE}-{YYYYMMDD}-{feature-slug}/`, files `{step}[.{sub}][.l{loop}]-{from}-to-{to}.handoff.md|.handback.md`, writer-by-mode, receiver verifies. Follow it exactly. Worked examples to put in the handoff skill:
- `2-software-architect-to-system-engineer.handoff.md` / `2-system-engineer-to-software-architect.handback.md` (team mode)
- `3-orchestrator-to-software-engineer.handoff.md` / `3-software-engineer-to-orchestrator.handback.md` (subagent mode)
- parallel: `4.1-orchestrator-to-sqa-engineer.handoff.md`, `4.2-orchestrator-to-documentation-writer.handoff.md`
- loop: `3.l1-orchestrator-to-software-engineer.handoff.md`; with sub-step `4.1.l1-…`
- nested spawn (Claude Code): a subagent that spawns its own subagents writes their handoffs/handbacks under its parent step, e.g. `4.1.1-sqa-engineer-to-sqa-engineer.handoff.md`.

## Scope (files)
1. `plugins/claude/ai-dlc/skills/handoff/SKILL.md` — core rewrite: naming; writer-by-mode table; templates with front matter `run, work-item, lifecycle, step, from, to, mode (subagent|team), loop, verification|received, date`; run.md Stages table gets `Step`, `Handoff`, `Handback` columns; AAW now writes handoffs (drop `:95` rule); description (`:3`) updated.
   - **O3**: verification-only results go in a handback with an AC outcome table; `verification` enum `pending|passed|failed|blocked|unavailable`; only `failed` returns to the sender, `blocked`/`unavailable` go to the human.
   - **O4**: refresh run.md `commit` to HEAD at every checkpoint; add `last-record:` front-matter field (latest handoff or handback file name) and use it in resume; resuming a `blocked` run starts by showing the blocker and asking the human how to resolve it.
   - **O6**: gate approver `none` = "do not stop; still write and verify the handoff".
   - **O7**: session handoffs go to `.scratch/<run-folder>/` on both platforms; on non-Claude platforms load the `scratchpad` skill first.
   - **O8**: lifecycle values reference the workflow file's list.
   - **O2**: the writer never verifies its own record; the receiver verifies before starting; orchestrator re-verifies at gates.
2. `plugins/claude/ai-dlc/agents/orchestrator.md` — Run Loop steps 1 (resume glob, `last-record`, blocked runs), 7–10 (write the handoff before each spawn, store the handback with its step code), Project workflow gate `none` wording, AAW section (now steps `1-orchestrator-to-agent-manager.handoff.md` etc.; run id = `AAW-<YYYYMMDD>-<slug>` folder per the new scheme), Using request-routing (add agent-team mode), Skills table row for `handoff`. Keep the orchestrator's main-agent runtime requirement, but restate its reason correctly (it is the human-facing lead and runs the team; nesting depth is limited).
3. `skills/agent-invocation/SKILL.md` (`:42`, `:116`, `:168`, `:198-200`, `:207`), `skills/request-routing/SKILL.md` (modes `:134-156`: rename "sequential agent team" → "sequential subagent chain"; add **agent-team mode** with criteria — genuine back-and-forth teamwork such as Refine architect↔system-engineer or Align; Claude Code only, needs `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` and an interactive session; one team per session, no nested teams, teammates ignore `skills` frontmatter so team briefs name the skills to load; on Copilot fall back to subagent mode), `skills/ai-dlc/SKILL.md` (`:151-153`, `:186`), `skills/review/SKILL.md` (`:28`, `:51`). Update the "sequential agent team" name everywhere it appears (orchestrator.md:171 etc.).
4. **Subagent nesting (Claude Code only)** — facts in `docs/handoffs/AAW-20261021-handoff-naming/1-research-assistant-to-orchestrator.handback.md`: subagents may spawn subagents when they have the `Agent` tool, up to `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` (default 3 from Claude Code v2.1.219; 1 disables nesting). Correct the statements at agent-invocation `:42`, `:168`, ai-dlc `:186`, review `:28`, orchestrator `:43`, `README.md:91`, `docs/plugins.md:72`, `AGENTS.md:45` / `tools/templates/AGENTS.template.md` accordingly. Copilot: nesting is not documented — keep "on Copilot, only the main agent spawns". Do not change any agent's `tools` list. `product-owner.md:30` stays (it has no Agent tool). The clarify relay through the orchestrator stays as the workflow rule.
5. Stage agents' `### handoff` sections: software-engineer, sqa-engineer, software-architect, system-engineer, requirement-analyst, product-manager, product-owner, devops-engineer, documentation-writer — one consistent rule: subagent mode → the orchestrator writes your handoff and stores your report as the handback, you return the report; team mode → you write your outgoing handoff to the next teammate and your handback to whoever handed you work. code-reviewer (no Write) and brutal-critique wording aligned.
6. Docs: `tools/templates/AGENTS.template.md:22-23,48`, root `AGENTS.md` (`:39,72,88,93-97,119-129,287,305-306,331`), `README.md:40,58,149`, `docs/plugins.md:54,70,98,138,146,185,192`. Note `plugins/claude/ai-dlc/skills/init/templates/AGENTS.md` is generated by the build — never hand-edit.
7. **Migration** of `docs/handoffs/AAW-20261016-stack-commands-out-of-agents-md/`, `AAW-20261021-agent-models/`, `AAW-20261021-model-policy/` (folder names already fit the scheme): rename hand-backs with `git mv` — agent-manager first pass = step 1 (`1-agent-manager-to-orchestrator.handback.md`), brutal-critique = step 2, later rounds `.l1`, `.l2` on the same step; research-assistant in model-policy gets its own step in order. Update each file's front matter (`run:`, step fields), each run.md table (add Step/Handoff/Handback columns; handoff cells "not recorded (pre-convention)") and the two cross-links between agent-models and model-policy run.md. Do not invent handoff files. Do not fix the stale `branch:` or add the missing research-assistant row in model-policy (deferred; see 8). Do not touch the two new run folders `AAW-20261021-handoff-naming*`.
8. **Memory** (`.claude/agent-memory/ai-dlc-agent-manager/`, via manage-memory): (a) `project_handoff-gaps.md` — deferred backlog: **O5** session matching undecided (candidate: platform session id, exact equality; host+start time only when no id; needs the human's decision); **stale local data**: move the `FEAT-20261020-ai-dlc-lens` permission from `.claude/settings.local.json:20-21` to `.claude/settings.json` (note: that folder does not exist), fix `branch:` in `AAW-20261021-model-policy/run.md` (says `feat/ai-dlc-lens`), add its missing research-assistant row; **Copilot nesting** unverified; **orchestrator main-agent rule** at depth 3 untested. (b) a short `project_handoff-naming.md` recording the naming + writer-by-mode decision (2026-10-21, user-approved). Index both in MEMORY.md.
9. Run `node tools/build-copilot.mjs`, then `--check`; `node --test`.

## Constraints
Follow `.claude/rules/plugin-development.md` (persona names next to IDs on first prose mention in plugin skills; IDs in file names/frontmatter/code). Language-agnostic. Never hand-edit `plugins/copilot/**`. Do not write the run.md or handback of this run. Do not commit.

## Deliverable (compressed report)
Changed paths each marked `code` / `docs` / `generated` with a ≤10-word note; the migration old→new mapping table; intent in one sentence; checks run with real result lines; anything you could not do. Next hop: orchestrator re-runs checks → brutal-critique (docs) / sqa-engineer → code-reviewer (code).
