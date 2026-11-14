# ADR-0011: Hand-off records are the typed events

- **Status:** Accepted (G2 approved, D38). Planned: nothing is built. The place of `.ai-dlc/event.schema.json` (line 19) is to be set by ADR-0018 (planned; bolt 015, story engine/026; AC-18.2).
- **Date:** 2026-11-13
- **Deciders:** software-architect (1.1.14, 1.1.20), system-engineer (1.1.19), human at G2.

## Context

FR-6 asks for five typed events (command, handoff, handback, verdict, escalation) checked against a schema, with no runtime (D3). Every run already writes handoff records and hand-backs, and the auto-handoff hook and the lens parse their file names. A second event stream would duplicate those records and drift from them.

## Decision

One record file is one event, named by the record grammar `CODE-FROM-to-TO.TYPE.md` with an optional `.h{round}` suffix. `human` is a valid party.

- Front matter is flat. The common fields are `event, step, run, from, to, date`; each type adds its own fields with closed value lists. `event`, `step`, `from` and `to` must match the file name.
- A gate decision is a `verdict` file named `{code}-{human|orchestrator}-to-orchestrator.verdict.md`. An approver of `none` writes no verdict.
- Pairing: a handoff is answered by a handback; a handoff to `human` (a gate record) is answered by a verdict; an escalation is answered by a verdict. Commands and verdicts are never answered.
- Reviewer verdicts (PASS, REVISE) stay fields of the hand-back.
- `.ai-dlc/event.schema.json` documents the format for editors and readers; `workflow.mjs` enforces it from one code table, and a drift test keeps the two equal.
- Events are opt-in per run (`events: 1` in the execution plan). The read-only command `workflow.mjs events` lists them.

## Consequences

- There is no second store: history stays readable as plain files.
- The hook and lens changes are additive.
- The orchestrator prepends front matter to verbatim hand-backs.
- Old and migrated runs are never validated.
- The closed `command.action` list (`fix, stop, resume, raise-limits, re-plan`) can only be extended through a schema change.
- Three parsers (the `workflow.mjs` validator, the hook, the lens) share one grammar and one set of test vectors.

## Alternatives rejected

- An `events.jsonl` file per run: a second source of truth.
- JSON event files beside the records: duplication.
- One file per reviewer verdict: more files and no new information.
