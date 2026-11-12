# ADR-0010: The orchestrator drives herdr panes through one skill script

**Date**: 2026-11-12
**Status**: Proposed. It is pending the low-level design (1.1.5) and the research answers Q1-Q5 in `docs/handoffs/AAWP-20261112-herdr-skill/1.1.4-design.md` §8.
**Deciders**: software-architect (1.1.4). The intent and the ACs come from product-owner (1.1.3) and the human's answers in `run.v1.md`.

## Context

When a Claude Code session runs inside herdr (herdr.dev), the human wants each agent the orchestrator spawns to be visible in a labelled herdr pane (watch mode). The alternative, chosen by a setting, is that each agent runs as its own `claude --agent ai-dlc:<id>` process in a pane (run-in-pane mode). Outside herdr, nothing may change (AC-4), and a pane must never block a run (AC-9).

The obvious home for this behaviour is a hook. Three facts rule that out:

- **The step code is not in the hook events.** SubagentStart, SubagentStop and TeammateIdle carry `agent_id`, `agent_type` and, at stop, the transcript path. The step code lives only in the orchestrator's brief, and the pane label must be agent plus step (AC-6).
- **A hook cannot replace a spawn**, which run-in-pane mode does.
- **It is not verified that hooks fire for teammates** in the same way.

Writing raw `herdr` commands into the model's instructions would also work, but each spawn would then depend on the model handling pane ids, timeouts, JSON output and the differences on Windows (AC-15).

## Decision

We will have the orchestrator, and only the orchestrator, drive herdr through one Node script shipped in the Claude-only `herdr` skill (`skills/herdr/scripts/herdr.mjs`):

- One `Bash` call per action: `detect` once per run; `open` before a spawn and `close` after the hand-back or the teammate's shutdown; `run` in place of the `Agent` call in run-in-pane mode.
- The script exits 0 and reports `ok:false` on every failure caused by herdr, and it is silent when herdr is not there.
- In run-in-pane mode the hand-back comes from a **result file** that a wrapper in the pane writes atomically from `claude -p`'s final result, never from reading pane text.
- If herdr cannot be used, the orchestrator falls back to the `Agent` tool and says so. A run that gives no result is a failed hand-back.
- A Mode 5 (agent team) stage always uses watch behaviour.

This adds a second narrow exception to "the orchestrator runs no checks": driving panes with this script, which neither builds, tests nor validates anything.

## Alternatives considered

- **A hooks-module listener on SubagentStart/Stop** (`hooks/auto-handoff`): rejected. It has no step code for the label, cannot do run-in-pane, does not cover teammates as far as anyone has verified, and adds TypeScript surface to a third-party-derived module.
- **Raw `herdr` commands in the orchestrator's instructions**: rejected. It is fragile across platforms, untestable, and costs tokens on every spawn.
- **Reading the hand-back from pane text** (`pane read` / `wait-output`): rejected as the primary channel. Pane text is truncated and wrapped and mixes in rendering. It stays for diagnostics only.
- **Forcing Mode 5 stages to subagents under run-in-pane**: rejected. A display setting would then override a routing decision.

## Consequences

- **Positive.**
  - Every herdr detail lives in one tested script (`tests/herdr/`), with a fake `herdr` on PATH.
  - The orchestrator's text grows by a few lines.
  - The behaviour is the same for subagents and teammates.
  - Copilot is untouched: the skill is listed in `tools/claude-only-skills.json`.
- **Negative.**
  - A pane depends on the orchestrator following its instructions. A missed `open` leaves no pane, which AC-9 allows. A missed `close` is caught by the `watch` view exiting when the hand-back appears.
  - Run-in-pane children run `claude -p` and cannot answer permission prompts; this is a documented known limit.
  - Each child pays for its own session start.
- **Follow-up.** If Claude Code later puts the brief or a custom label in the SubagentStart event, a hook could take over watch mode. Revisit this ADR then.
