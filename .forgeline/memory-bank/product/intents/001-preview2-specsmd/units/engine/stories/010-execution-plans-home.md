---
id: 010-execution-plans-home
unit: engine
intent: 001-preview2-specsmd
status: ready
priority: must
bolt: 004-engine-events
created: 2026-11-14
---

# engine/010 — One run folder per run under `execution-plans/`

**Planned:** nothing here is built yet. The story belongs to [bolt 004-engine-events](../bolts/004-engine-events/bolt.md), which has not started (G3 approved, 2026-11-14, D79).

## Story

As the orchestrator, I want one run folder per run under `execution-plans/`, with an execution plan written before the first spawn, so that run mechanics have one home outside the bank.

## Acceptance criteria

- AC-5.2
- AC-5.3
- AC-5.4
- AC-5.5

## Technical notes

- `execution-plan.md` gets its front matter and seven sections (§7).
- The run state gains `intent`, `units` and `bolts`.
- Session handoffs move from `.scratch/<run>/` to the run folder.
- It changes the `handoff` skill, `agent-invocation`, the orchestrator body and the `AGENTS.md` template source.
- The `herdr` script needs no edit (it holds no legacy path). The `docs/handoffs/` literals in `tests/herdr/` change to `execution-plans/` (14 hits in 8 files, inside the AC-17.3 scope; C-7). The existing herdr tests are its regression check.
- It deletes `.handoff/config.md`, which exists today.
- Reader pages (R-9): the README and `docs/plugins.md` run-folder text is updated by this bolt's docs stage; bolts 005 and 013 send *Docs update* requests to it instead of editing.
