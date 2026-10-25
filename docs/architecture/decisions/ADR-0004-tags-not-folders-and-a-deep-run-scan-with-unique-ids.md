# ADR-0004: Taxonomy as tags, not folders; runs found at any depth, with ids unique across the tree

**Date**: 2026-10-24
**Status**: Proposed (awaiting G2)
**Deciders**: the human (decision 18: epics are folders, the taxonomy is tags); software-architect (the scan and the id rule)

## Context

The human decided two things. Epics are a folder level of the product tree and of a future mirror tree under `docs/handoffs/` (root 21). Module, submodule, feature and integrations are front-matter tags. A cross-module feature, such as Integration2 linking `ai-dlc` and `ai-dlc-lens`, cannot have two parent folders (14.1.13 §2).

Today a run is found by a one-level scan of the handoffs root (`handoff` skill, `run.ts`, `lens.ts`). Its id is the folder name in lower case (`runIdOf`). The lens follows merged runs by `merged-from-<id>.md` and skips folders with the same id (`mergedHomeOf`). Once root 21 nests the tree, a one-level scan finds nothing nested. Two folders with the same name under two sprints would then share one id. And a moved folder, which keeps its id, would not be followed.

## Decision

We will treat module, submodule, feature and integrations as tags only. Run discovery will be a bounded walk that stops at the first folder holding a run state, and run ids, still the folder name, must be unique across the whole tree.

- **The walk.** It goes to depth 6, skips dot-folders and never descends into a run folder. Logical nesting stays `parent:`.
- **Duplicate ids.** `validate` rejects them and names both paths. Readers take the first one found and log it.
- **Moves.** A move uses `workflow.mjs move-run`. It keeps every record name and leaves `merged-from-<old>.md` in the new folder. The lens resolves a missing folder by run id first (a move) and by `mergedHomeOf` second (a merge).
- **One contract.** The walk exists in three runtimes that cannot share code: auto-handoff (`run.ts`), the lens (a separate plugin) and `workflow.mjs` (zero-dependency Node). They are held to one contract, a shared fixture tree used by all three test suites.

## Alternatives considered

- **Modules as folders** (`docs/product/<module>/<submodule>/…`). Rejected by the human: a cross-module feature has no single parent.
- **Run ids from the full relative path.** Rejected for three reasons:
  - every existing id and brief would change;
  - a move would change a run's identity;
  - the lens would lose the simple `runIdOf` it uses everywhere.
- **Unbounded recursion.** Rejected: the walk runs in a Stop hook and in the lens on every refresh. Depth 6 covers `<epic>/<sprint>/<feature>/<run>` with room to spare, and anything deeper is reported, not silently skipped.
- **One shared walk module.** Rejected for now. The lens is a separate plugin that cannot import from `ai-dlc`, and `workflow.mjs` must stay a single zero-dependency file. Copying the ~20-line walk under a contract test costs less than a shared package.

## Consequences

### Positive
- Root 21 can nest the tree without breaking discovery, resume, the lens or old briefs.
- Ids stay short and stable, and moving a run never changes its identity.

### Negative / Trade-offs
- Folder names must be unique across the whole tree. That is a new constraint for the people naming runs, and `validate` enforces it.
- The walk is implemented three times, and only the shared fixture keeps the copies in agreement.

### Neutral
- Chain ids (D5 of the spec) may repeat across runs. They are not run ids, and nothing requires them to be unique.
- `merged-from-<old>.md` now marks moves as well as merges. Its front matter (`from`, `to`, `date`) tells the two apart by whether the ids differ.

## Compliance checklist

- [x] Affected components:
  - `run.ts`, `lens.ts`, `workflow.mjs`;
  - the `handoff` skill (*Run state*, resume scan);
  - `tests/fixtures/handoffs-tree/`.
- [x] Related ADRs: ADR-0003.
- [x] `{ data, error }`: not applicable.
- [x] No stack traces exposed.
- [ ] DI registration: not applicable.
- [x] No ADR superseded.
