# ADR-0009: Lens marks that guard an agent's status live in its row in `agentsA`

**Date**: 2026-11-02
**Status**: Accepted, implementation pending ITEM-106. The human accepted the rule and its staging: decision 17 in `docs/handoffs/FEAT-20261020-ai-dlc-lens/52-human-decisions.human.md`, and decision 20 in `54-human-decision.human.md`, which has this record written now. Until ITEM-106 is built, the code follows the interim design below, and the race is a documented known limit.
**Deciders**: the human (decisions 17 and 20); software-architect (the rule, proposed in `44.1.l2.2-software-architect-to-orchestrator.handback.md`); system-engineer (the interim pure planner, `44.1.l2.2-system-engineer-to-orchestrator.handback.md`)
**Narrative**: [`docs/architecture/narratives/ai-dlc-lens-halted-state.md`](../narratives/ai-dlc-lens-halted-state.md) tells how the work got here, from the bug report to this decision.

## Context

The lens shows an agent as *halted* from the status stored in its row in the engine atom `agentsA` (`plugins/claude/ai-dlc-lens/hooks/register.tsx`, shape `agents-3`). The ITEM-104 fix added three marks, and each one guards a status change of one agent:

- `haltedByTurn`: a listed `running` may resume this agent.
- `haltedByTimeout`: any event of the agent revives this timeout halt.
- `missingSince`: when the dropped-subagent timeout fires (decision 16).

The marks live in module memory (a `Set`, a `Set` and a `Map` in `register.tsx`). The status lives in `agentsA`, whose `update` writes on a version check and runs the updater again on a miss. A rule spread over two stores with no shared commit cannot be made atomic, however carefully the steps are ordered. Three defects come from that split:

- **W-A only holds by convention.** The updater must not write the marks, and the test kit cannot force a conflict, so mutant M2 survived (44.3.l2.3).
- **A narrow race.** An event that lands between the row write and the mark write finds no mark, and the agent stays halted until its next event (44.2.l2.3).
- **A lifetime mismatch.** The rows survive a plugin reload; the marks do not.

## Decision

We will keep every mark that guards an agent's status change in that agent's row in `agentsA`, written by the same `update` that changes the status. Module memory holds only caches and diagnostics.

- **The rule.**
  - Fields on `LensAgent`, for example `haltedBy: 'turn' | 'timeout' | null` and `missingSince: number | null`, replace `haltedByTurn`, `haltedByTimeout` and `missingSince`.
  - `refreshList`'s updater becomes a function of the rows, the agent list, the time `t` and the limit only.
  - `heard` and the `turn.start` and `turn.complete` handlers set or clear the marks inside the `patchAgent` updaters they already call. Each change is then one compare-and-set write on one atom: a concurrent writer loses `ifVersion`, and its updater runs again on the new value.
  - The apply step after `update`, and the module collections, are deleted.
- **Shape.** The atom's shape tag moves from `agents-3` to `agents-4`.
- **`session.start`.** It clears the marks in every row with one `update`. This keeps today's behaviour and its test ("session.start clears the mark, so neither a listed running nor its own event revives it").
- **What stays in module memory.** `lastStatus`, which only feeds the E4 probe log, and any other cache or diagnostic. Rule of thumb: if a status change depends on a value, the value belongs in the row.
- **Staging (decision 17).**
  - *Interim, ships in ITEM-104.* The updater body is the pure `mergeAgentList` and `planDrops` in `plugins/claude/ai-dlc-lens/hooks/lens.ts`. Both read the marks as parameters and write nothing, so a unit test can call them twice on one frozen input. One apply block after `update` is the only writer of the marks. The race and the reload mismatch remain, as a documented known limit (`docs/specs/lens-view.lld.md`, section 4; the lens README).
  - *Target, ITEM-106.* The marks move into the row as above. Keep `mergeAgentList` and `planDrops` as the pure updater; their mark parameters become fields of the rows they already receive.

## ITEM-106: the work that implements this record

[ITEM-106](../../backlog/backlog.md) ("Lens: halt marks live in the agent row (agentsA)", TechDebt, P2, Backlog, follow-up of ITEM-104) is the later work that brings the code in line with this record. The human keeps it for later (`54-human-decision.human.md`).

- **What it changes.**
  - `haltedByTurn`, `haltedByTimeout` and `missingSince` leave module memory and become fields of each `LensAgent` row in `agentsA`, written by the same `update` that changes the row's status.
  - The shape tag moves from `agents-3` to `agents-4`.
  - `session.start` clears the marks in every row.
  - `heard` and the turn handlers write the marks inside their existing `patchAgent` updaters.
  - The apply block after `refreshList`'s `update` and the three module collections are removed.
- **Why.** It removes the ITEM-104 race and the reload mismatch, and makes a re-run of the update harmless by construction, not by convention (Context, above).
- **Acceptance criteria** (from the backlog row):
  - (a) the three marks are fields of the agent row, written in the same update as the status;
  - (b) the shape tag is `agents-4`, and a stored `agents-3` value is dropped once;
  - (c) `session.start` clears the marks in every row;
  - (d) a test re-runs the `refreshList` update on the same input and gets the same rows (no race), and the ITEM-104 tests still pass;
  - (e) ADR-0009 is written and linked (done early, by decision 20: this record);
  - (f) `node --test "tests/**/*.test.mjs"` and `claude plugin test ./plugins/claude/ai-dlc-lens` pass, with the output quoted.
- **When it is done.** Change this record's status to Accepted (implemented in ITEM-106), and remove the known-limit text of the interim from the LLD and the README.

## Alternatives Considered

- **Option: module sets as now** (`haltedByTurn`, `haltedByTimeout`, `missingSince` in module memory, written beside the row update).
  - **Why rejected as the target:** two stores with no shared commit. This is the source of W-A, the race and the reload mismatch. It stays only as the interim, until ITEM-106.
- **Option: a separate marks atom** (the marks in their own engine atom next to `agentsA`).
  - **Why rejected:** `update` covers one atom, so the race moves to a gap between two atoms instead of going away. It does fix the reload mismatch, but not the defect that matters.
- **Option: the pure planner alone** (system-engineer's narrow design: `mergeAgentList` and `planDrops` exported and unit-tested, the marks left in module memory).
  - **Why not the end state:** it makes the updater testable and kills M2, but the race and the reload mismatch remain. The human chose it as the interim (decision 17) because it is small and keeps the persisted shape. It is a step towards this decision, not an alternative to it.

## Consequences

### Positive

- A re-run of the update is harmless by construction. Purity no longer depends on a convention that a future change can break.
- The race between an event and the poll goes away, because both write the same row through `ifVersion`.
- Marks and rows have one lifetime: a halt stored before a plugin reload can still be resumed after it.
- One rule for all lens state, so later features know where a new mark goes.

### Negative / Trade-offs

- The shape bump drops the rows stored before a reload once, in the session where the new version first loads. This is accepted: the lens rebuilds them from events and the list.
- Rows carry bookkeeping. `blankAgent`, fixtures and deep-equal assertions on `LensAgent` need the new fields.
- Until ITEM-106 is built, the code does not follow this record. The interim and its known limit must stay stated in the LLD and the README.

### Neutral

- `session.start` gains one `update` of `agentsA`.
- The migration is one backlog item, ITEM-106 (section above).
- Mutant M2 cannot even be written once ITEM-106 is built. Remove it from the mutant set rather than try to kill it.

## Compliance Checklist

- [x] All affected components identified: `register.tsx` (`agentsA`, the three marks, `refreshList`, `heard`, `turn.start`, `turn.complete`, `session.start`, `blankAgent`), `lens.ts` (`mergeAgentList`, `planDrops`, `LensAgent`), the lens tests.
- [x] Related ADRs cross-referenced: ADR-0008 (where the lens is drawn) is not changed by this record.
- [x] Return shape `{ data, error }`: not applicable (TypeScript hooks module).
- [x] No stack traces exposed: not applicable.
- [x] DI registration: not applicable; no new components.
- [x] Superseded ADRs: none.
