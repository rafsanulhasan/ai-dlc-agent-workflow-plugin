---
id: 029-config-readers-fallback
unit: engine
intent: 001-preview2-specsmd
status: ready
priority: must
bolt: 015-engine-forgeline-root
created: 2026-11-14
---

# engine/029 — Readers take the new path first and fall back with one warning

**Planned:** nothing here is built yet. The story belongs to [bolt 015-engine-forgeline-root](../bolts/015-engine-forgeline-root/bolt.md), which has not started (G3 approved, 2026-11-14, D79).

## Story

As a maintainer of a preview1 repository, I want every tool to read the new config path first and fall back to the old one with one warning, so that nothing silently stops working after the move.

## Acceptance criteria

- AC-18.4[engine] (ITEM-127 AC-4; G1 amendment D69, approved at G3, 2026-11-14 (D80))
- AC-18.5 (ITEM-127 AC-12)
- AC-18.6 (ITEM-127 AC-5)
- AC-15.8[forgeline-root]

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- Readers and writers: `workflow.mjs`, `check-workflow.mjs`, `update-model-metadata.mjs` and its template, auto-handoff `config.ts`, `register.tsx` and `run.ts`, keepalive `keepalive.ts`, `settings.ts` and `duration.ts`, `herdr.mjs`, and the `cache-keepalive` and `auto-handoff` configure templates (the writers write the new path). The final list is the output of story 027. The lens readers are lens/007. In the fallback state (only the old `.ai-dlc/` file exists) a `/…configure` writer refuses, tells the user to run `/engine:migrate` and writes no partial new file; the old file stays unchanged (D77; AC-18.4 (a)), with a writer test.
- New path first; with only the legacy path, the reader reads it and warns once per invocation, naming `/engine:migrate`; every fallback branch carries the marker `fallback: remove in 1.0.0`.
- `check-workflow.mjs` blocks only with an installed layout (behaviour change, decided by the human, D74 and D76, approved at G3, 2026-11-14 (D80)): it blocks the Stop when a folder `.forgeline/ai-dlc/` or `.ai-dlc/` exists, whatever it holds, but neither `workflow.json` does, and then blocks every Stop in a git repository whatever git shows (D76); validating an existing `workflow.json` stays change-gated; outside a git repository it is silent; a missing `workflow.mjs` keeps today's block; a bank folder alone does not trigger it; `AI_DLC_WORKFLOW_GATE=false` and `stop_hook_active` still stop it; with both files it reads the new one and warns that the old one is ignored; with only `.ai-dlc/workflow.json` it validates that file with a warning (in this repository's intermediate state it warns once and does not block); with neither folder it exits 0 silently (AC-18.6). Fixtures: layout present, nothing changed, no `workflow.json` → blocks; folder with only `lens.json` or `model-metadata.json` → blocks; not a git repository → silent.
