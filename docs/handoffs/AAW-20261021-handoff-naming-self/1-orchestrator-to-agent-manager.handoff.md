---
run: AAW-20261021-handoff-naming-self
work-item: none
lifecycle: AAW
step: 1
from: orchestrator
to: agent-manager
mode: subagent
loop: none
verification: pending
date: 2026-10-21
---

# Handoff 1: orchestrator → agent-manager (fresh instance, self-change)

## Goal
Change agent-manager's own definition and the `workflow` skill it owns so they follow the new handoff/handback naming convention and the single lifecycle-code list (gap O8). This is the self-change half of a two-item change; a separate agent-manager instance (run `AAW-20261021-handoff-naming`) is changing the handoff skill, orchestrator, other skills, agents and docs in parallel. Do not touch those files.

## Normative spec (shared by both items — follow exactly)

**Folder:** `docs/handoffs/{LIFECYCLE}-{YYYYMMDD}-{feature-slug}/` — LIFECYCLE = lifecycle code (e.g. `FDLC`, `AAW`, `AI-DLC`), date = the run's start date, slug = kebab-case. Replaces `docs/handoffs/<work-item-id>/` and the special `AAW-<YYYYMMDD>-<slug>` id. Work-item id (if any) moves to a `work-item:` front-matter field. `run.md` stays in the folder.

**Files:**
- Handoff: `{step}[.{sub}][.l{loop}]-{from-agent}-to-{to-agent}.handoff.md`
- Handback: `{step}[.{sub}][.l{loop}]-{from-agent}-to-{to-agent}.handback.md` (`from` = agent returning work, `to` = agent that handed it off; names swapped vs its handoff).
- `step`: integer, +1 for each new hand-off in the run. `.sub`: when one sender fans out to parallel agents (2.1, 2.2… in spawn order), also for nested spawns under a parent step. `.l{n}`: loop round n re-running that step, keeps the step code (`3.l1-…`, `3.1.l1-…`); first pass has no `l` suffix.
- Agent IDs only in file names, never persona names. Replaces `<NN>-<from>-to-<to>.md` and `<NN>-<agent>-handback.md`.
- AAW now records handoffs too; the rule "AAW writes no handoff records" is removed.

**Writer by orchestration mode:**
- Subagent mode (default; only mode on Copilot): orchestrator writes `N-orchestrator-to-<agent>.handoff.md` (the brief) before each spawn and stores `N-<agent>-to-orchestrator.handback.md` verbatim on return. Orchestrator owns run.md.
- Agent-team mode (Claude Code only, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, interactive session): the sending teammate writes `N-<sender>-to-<receiver>.handoff.md` before messaging; the receiving teammate writes `N-<receiver>-to-<sender>.handback.md` when done (sender stores it if the receiver lacks Write). run.md stays orchestrator (team lead) only.
- The receiver verifies a handoff before starting; the writer never verifies its own record.

**O8:** the lifecycle codes are defined once in the workflow file (template + schema); other skills refer to that list.

## Your scope (only these files)
1. `plugins/claude/ai-dlc/agents/agent-manager.md:184` (no-orchestrator branch: run state `AAW-<YYYYMMDD>-<slug>`, `<NN>-agent-manager-handback.md`) and any other naming mention in that file — new folder and file names; when no orchestrator, agent-manager as main agent writes `N-<self>-to-<agent>.handoff.md` for reviewers it spawns and stores their handbacks.
2. `plugins/claude/ai-dlc/skills/workflow/`:
   - `templates/workflow.json:417-422` AAW note (now records handoffs and handbacks) and `:594` `artifacts.handoffs` default → `docs/handoffs/{LIFECYCLE}-{YYYYMMDD}-{feature-slug}/`.
   - `templates/workflow.schema.json:167` description (new naming), `:186`, `:253` wording if affected.
   - O8: add one authoritative list of lifecycle codes to the workflow file (template + schema), or designate the existing lifecycles keys as that list — your call; keep `workflow.mjs validate` passing. If `workflow.mjs` must change, update `tests/workflow/` and run `node --test`.
   - `references/aaw-review.md:49` and `SKILL.md:37`.
3. The repo's own `.ai-dlc/workflow.json` / `.ai-dlc/workflow.schema.json` / `.ai-dlc/workflow.mjs` copies, via the workflow skill's upgrade path or equivalent; regenerate `.ai-dlc/catalog.json` only if needed.
4. Run `node tools/build-copilot.mjs` then `--check`, `node .ai-dlc/workflow.mjs validate`, and `node --test` if code changed.

## Constraints
- Language-agnostic; follow `.claude/rules/plugin-development.md`. Never hand-edit `plugins/copilot/**`.
- Do not edit `skills/handoff/`, `agents/orchestrator.md`, other agents, other skills, AGENTS.md, README.md, docs/ — the other item owns them.
- Do not commit.

## Deliverable (compressed report)
Changed paths, each marked `code` or `docs`, one line each with a ≤10-word note; the intent in one sentence; the checks you ran with their real result lines. Next hop: orchestrator re-runs checks, then brutal-critique (docs) / sqa-engineer → code-reviewer (code).
