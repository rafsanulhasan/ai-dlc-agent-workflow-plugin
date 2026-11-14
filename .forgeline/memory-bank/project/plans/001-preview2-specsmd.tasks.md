# Task plan — intent 001-preview2-specsmd (bolt index)

**Planned (G3 pending).** This task plan is the schedule of record for intent 001: its bolt waves replace the work-item waves of step 1.1.11. Its bolt rows are the same as spec 001 §16 (revision r1), which governs each bolt's scope; G3 may renumber or reschedule bolts that have not started. Each bolt has a `bolt.md` (status `draft`, planned) under `memory-bank/product/intents/001-preview2-specsmd/units/<unit>/bolts/<bolt-id>/` (ADR-0016), linked in the table below; the bolts become `ready` when the human approves G3. Bolt types are those of [ADR-0012](../../product/architecture/decisions/ADR-0012-bolt-types-are-stage-subsets.md); units are in [the decomposition](../../product/intents/001-preview2-specsmd/units.md).

Every bolt below is a bolt of the `engine` unit unless the Unit column says `lens`. "AAWP" is the lifecycle the bolt runs in. Items are the backlog items of [the backlog](../backlog.md). There are 14 bolts: the original 012 was split in two by the product-owner (step 1.1.29). The plan half keeps the number 012 and the settings half is bolt 014 (C3, software-architect, step 1.1.30.2).

## Bolts

| Bolt | Unit | Type (lifecycle) | Scope | Items | Requires | Stories | Wave |
|---|---|---|---|---|---|---|---|
| [001-engine-rename-spike](../../product/intents/001-preview2-specsmd/units/engine/bolts/001-engine-rename-spike/bolt.md) | engine (lens finding (c) consumed by lens bolt 010) | spike-bolt (ASDLC: research, probe, architecture) | Live in Claude Code, scratch marketplace under `.scratch/`, Claude Code version quoted. Records (a) to (i) of AC-17.14 as in spec §16: (a) memory folder of a `memory: project` agent of plugin `engine`; (b) installed plugins, `enabledPlugins` and stored data after the marketplace changes; (c) whether `/lens:show` from a skill in `lens` reaches the lens module; (d) `lens` with `skills/` under `validate --strict`; (e) `$.state` `plugin` versus manifest name, and lens atoms across the rename; (f) an `"agent"` naming an unknown plugin agent; (g) `engine:cache-keepalive-lens` answered across plugins; (h, O-23) another installed plugin named `engine` or `lens`, and a shared pane id; (i, D33, D37) pane reopen by id after `/reload-plugins` or a new session. `time_box` `2d`. Any difference from the spec goes through `spec-driven-development` before bolt 009 starts | ITEM-126 (AC-17.14) | — | engine/001 | W1 |
| [002-engine-contract-tooling](../../product/intents/001-preview2-specsmd/units/engine/bolts/002-engine-contract-tooling/bolt.md) | engine | construction-bolt (AAWP) | `ARTIFACT_TYPES`, schema, `boltTypes` (`construction-bolt`, `simple-bolt`; `spike-bolt` lands in 005 with `probe`), skip rule and `building`, `validate`, `artifacts`, G-FM with vectors; the `workflow.mjs` resolver and fallback warning with their vectors (§9) including the per-key rule and the mixed-layout row (D42); the `artifacts` merge guard (C-2); canonical `tests/fixtures/grammar/` including `runs-root.mjs` and the one drift test `tests/grammar-vectors-drift.test.mjs` (C-4, C-5); `tests/helpers/paths.mjs` for new tests only (C-1); `init` scaffolding of `memory-bank/product/`, `memory-bank/project/` and `execution-plans/` (`.gitkeep`) with a preview2 `artifacts` block (AC-1.1, AC-8.2). `workflow.mjs` stays one file (no `lib/` split before 1.0.0; final in this bolt's lld) | ITEM-112 | — | engine/002 to engine/006 | W1 |
| [003-engine-authorship-rule](../../product/intents/001-preview2-specsmd/units/engine/bolts/003-engine-authorship-rule/bolt.md) | engine | simple-bolt (AAWP) | `docs-status` rewrite in its three copies (§14) with the building-stage prose of §6.2 (R-5); the bank-file Blocker check in the `review` skill (AC-7.3); `write-adr`, `spec-driven-development`, `product-planning` and the glossary writes of `requirement-analysis` return content to `documentation-writer` (AC-7.6); `brutal-critique` critiques every bank change before the owning stage is `done` (AC-7.7) | ITEM-113 | — | engine/007 to engine/009 | W1 |
| [004-engine-events](../../product/intents/001-preview2-specsmd/units/engine/bolts/004-engine-events/bolt.md) | engine | construction-bolt (AAWP) | G-REC with vectors, `event.schema.json` installed by `init` (AC-6.1), `EVENT_RULES`, `events`, `handoff` skill rewrite, `execution-plan.md`; `agent-invocation`, the orchestrator body and the generated `AGENTS.md` template name `execution-plans/` (AC-5.2) and say when each event type is written (AC-6.6); session-handoff move; delete `.handoff/config.md`; the `docs/handoffs/` literals in `tests/herdr/` (C-7) | ITEM-115 | 002 | engine/010, engine/011 | W2 (merges first of its wave pair) |
| [005-engine-planning-stages](../../product/intents/001-preview2-specsmd/units/engine/bolts/005-engine-planning-stages/bolt.md) | engine | construction-bolt (AAWP) | `unit-design`, `bolt-design`, `probe`, `spike-bolt` in `boltTypes`; PDLC, ASDLC and STBLC prose; agent text; bank templates under `skills/write-documentation/templates/bank/` for the intent files, unit brief, story and `bolt.md` (§4.1). Merges after 004; does not edit `orchestrator.md` or `agent-invocation` (R-6) | ITEM-114 (part a) | 002 | engine/012 to engine/014 | W2 (builds beside 004, merges after it) |
| [006-engine-build-stages](../../product/intents/001-preview2-specsmd/units/engine/bolts/006-engine-build-stages/bolt.md) | engine | construction-bolt (AAWP) | bolt types wired into the orchestrator, `request-routing`, the `ai-dlc` skill, and the FDLC, BFLC, RLC and AAW prose; legacy-path leftovers in plugin prose that no earlier bolt touched | ITEM-114 (part b) | 005 | engine/015 | W3 |
| [007-engine-handoff-hook](../../product/intents/001-preview2-specsmd/units/engine/bolts/007-engine-handoff-hook/bolt.md) | engine | simple-bolt (AAWP) | hook resolver (`runs-root.ts`), formatter, G-REC (`record.ts`), pairing, plugin tests, byte copies of the canonical vectors; no G-FM implementation (C-3, C-6). May start once 004 is merged; edits no `workflow.mjs`, template or `orchestrator.md`. Can be tested live in this repository (D42) | ITEM-116 (part a) | 002, 004 | engine/016, engine/017 | W3 (early start) |
| [008-lens-new-paths](../../product/intents/001-preview2-specsmd/units/lens/bolts/008-lens-new-paths/bolt.md) | lens | simple-bolt (AAWP) | lens resolver (`runs-root.ts`), `record.ts`, `detectRun`, verdict and escalation reading, the lens's legacy-path strings; vector copies; the O-4 decision (toast deduplicated by text per session, one note per scan in the `/lens:gate` `skipped` list) with its AC-15.7 test. May start once 004 is merged; edits no `workflow.mjs`, template or `orchestrator.md` | ITEM-116 (part b); lens part of ITEM-117 | 002, 004 | lens/001 to lens/003 | W3 (early start; longest W3 bolt) |
| [009-engine-rename](../../product/intents/001-preview2-specsmd/units/engine/bolts/009-engine-rename/bolt.md) | engine | construction-bolt (AAWP) | §11 engine side: folder `git mv`, manifest (`name`; keywords D35, D36), both marketplaces (`forgeline`, the `engine` entry), `MARKER_NS`, `tests/helpers/paths.mjs` values (`ENGINE_DIR`), engine-owned test literals, `engine:` prefixes, keep-alive command constants, `lens-keepalive` → `cache-keepalive-lens`, `init` settings, catalog, `stripNamespace` (O-21) with a build test, shared state namespace per (e); the R-14 engine lines (`CLAUDE.md` dev setup, `.claude/rules/plugin-development.md`, `.claude/settings.json:20`, `tools/validate.mjs:9,36`); `.claude/settings.json:3,113` stay for ITEM-121 (changed here only if spike (f) shows an unknown `"agent"` breaks session start); a `windows-latest` CI job running `node --test "tests/**/*.test.mjs"` (pending human acceptance; about 0.25 d). It edits no lens entry and none of the five lens skills. Commit the `git mv` separately from the content edits. When 012 merged before this bolt, it absorbs it | ITEM-126 (engine) | 001 (hand-back accepted); 002 to 008 and 013 merged; serialised | engine/018 to engine/020 | W4 |
| [010-lens-rename](../../product/intents/001-preview2-specsmd/units/lens/bolts/010-lens-rename/bolt.md) | lens | simple-bolt (AAWP) | lens plugin `name` and folder `git mv` to `plugins/claude/lens/`; the lens's entries in the shared registration files (marketplace entry, `tools/claude-only-plugins.json` line, the five skill lines leaving `tools/claude-only-skills.json`, its two CI steps, `LENS_PLUGIN` and `LENS_DIR`); lens-owned test literals (`tests/lens-renderer/`, `tests/cache-reader/`); the five skills move and rename; `CMD` map; `KEEPALIVE_COMMAND`; `identity.ts` (`LENS_STATE_NS = 'lens'`, pane ids `lens-*` with `LEGACY_PANE_IDS`, D33, D37); `engine-names.ts` (dual-prefix window); roster fallback; the R-14 lens lines; shared state namespace per (e). Consumes spike findings (c), (e), (h), (i) | ITEM-126 (lens; AC-17.11, AC-17.13) | 001 (accepted), 009 | lens/004 to lens/006 | W4 (after 009) |
| [011-engine-path-sweep](../../product/intents/001-preview2-specsmd/units/engine/bolts/011-engine-path-sweep/bolt.md) | engine | simple-bolt (AAWP) | §15 sweep, its allowlist, and fixes in engine-owned paths; a hit in a lens-owned path goes back to the lens unit as a fix round of bolt 010. `docs/follow-ups.md` is out of scope (moved by ITEM-121) | ITEM-117; ITEM-126 (AC-17.3, AC-17.4) | 009, 010, 012, 014; runs after ITEM-121 (R-1) | engine/021 | W6 |
| [012-engine-migrate-plan](../../product/intents/001-preview2-specsmd/units/engine/bolts/012-engine-migrate-plan/bolt.md) | engine | construction-bolt (AAWP) | §10.2 steps 1 to 3 and 6: `planMigration` as an ordered list of planners (detect, artifacts, memory, settings, commit point), the memory and settings planners present as empty entries; `applyPlan`; dry run with the whole `kind` enum fixed (`memory-move`, `memory-merge`, `settings-rewrite`, `advice` included); the residue rule (a non-empty legacy default path of a key whose configured value is already its new path, D42); fixtures F1 to F6, F12 and F13. Edits `workflow.mjs`; the only W3 bolt allowed to; rebases onto 004 and 005. Own-file rule: code that ends at 1.0.0 lives in files of its own | ITEM-118 (AC-2 to AC-10) | 002 | engine/022 | W3 (lowest priority, non-blocking; fallback W5 before 014) |
| [013-engine-notices](../../product/intents/001-preview2-specsmd/units/engine/bolts/013-engine-notices/bolt.md) | engine | simple-bolt (AAWP) | §13 | ITEM-119 | 002 | engine/025 | W2 (merges first) |
| [014-engine-migrate-settings](../../product/intents/001-preview2-specsmd/units/engine/bolts/014-engine-migrate-settings/bolt.md) | engine | construction-bolt (AAWP) | §10.2 steps 4 and 5 and §10.4: memory-folder rewrite and settings rewrite (JSONC, comments survive), the `migrate` skill and its entry, detect-and-warn (AC-17.12), the `upgrade` split, the remaining `merge` guards; fixtures F7 to F11. Fills in the planners 012 left empty; changes no order and no shape that 012's tests assert | ITEM-118 (AC-1, AC-11); ITEM-126 (AC-10, AC-12) | 001 (accepted), 012, 009, 010 | engine/023, engine/024 | W5 |

Bolt 013 was added late and is numbered after 012. Bolt 014 is the settings half of the old 012 (renumbered by C3: a bolt id is `{BBB}-{unit-slug}-{bolt-slug}` with a three-digit number, so `012a` and `012b` were not valid ids, and the id grammar and AC-2.2 do not change). `012-engine-migrate` was never created as a bolt folder and is retired.

## Waves

The schedule has no calendar dates. Elapsed times are ideal pipeline days (the estimate's unit): one working day of wall-clock for a bolt's agent pipeline, with no human gate wait and no review-loop overrun. They are the estimate's medians; the ranges are the real statement.

| Wave | Bolts and work | Order and rules | Elapsed (point) |
|---|---|---|---|
| W1 | 001, 002, 003 | In parallel. 002 first (the rest of the plan builds on it). 001 is human-gated; its human session is on days 1 to 2. 003 is off the critical path and rebases after 002 merges (merge order 002, then 003). 002 and 003 split the building-stage text (R-5) | 7.5 d |
| W2 | 004, 013, 005 | 004 starts first (it gates 007 and 008). 013 merges first (licence compliance; 009 requires it). 005 builds beside 004 and merges after it (R-6) | 5.25 d |
| W3 | 008, 007, 006, 012 | Priority 008, then 007, then 006, then 012. 007 and 008 may start once 004 is merged. 006 needs 005 merged and gates 009. 012 is non-blocking | 4.25 d |
| W4 | 009, then 010 | Serialised, with no other bolt open. The human has accepted the spike hand-back first (D40), and any spec revision from the spike is applied before 009 starts. Includes the spike buffer (1.0 d, spent only if (a) or (c) changes the spec) | 11.45 d |
| W5 | 014 | Alone (and 012 first, if it fell back from W3) | 4.5 d; 9.25 d with the 012 fallback (about 44 d in total, see *012 fallback*) |
| W6 | ITEM-121, then 011, then ITEM-122, then ITEM-123, then ITEM-124 | Intent-level work around the sweep (R-1). Only 011 is a bolt; the others are rough figures (low confidence) | 7.0 d |
| Not scheduled | ITEM-120 (P3, non-gating), ITEM-125 (1.0.0) | | |

**Critical path:** 002 → 004 → 008 → 009 → 010 → 014 → ITEM-121 → 011 → ITEM-122 → ITEM-123 → ITEM-124. The spike 001 hand-back is accepted before 009. 005 → 006 only has to finish before 009 starts, and 012 is off the path.

**Early-start rule.** Bolts 007 and 008 require only 002 and 004, so each may start as soon as 004 is merged. The wave label stays W3. They must not edit `workflow.mjs`, the template or `orchestrator.md`; if one needs to, it waits for the wave. 005 still merges immediately after 004 (R-6). Effect: about 0.5 d off the path.

**`workflow.mjs` rule in W3.** No W3 bolt edits `workflow.mjs` except 012, which rebases onto 004 and 005. 009 is the first bolt to edit it after 012 (the hot file); when 012 merged first, 009 absorbs it.

**012 fallback.** 012 never delays 009. If 012 has not merged when 009's `requires_bolts` are merged and the spike hand-back is accepted, it moves to W5, runs before 014 and rebases onto the 009 and 010 renames. This costs only what the split already costs (about +0.25 d overhead). At the point estimates 012 (4.75 d, merged about 5.0 d) ends about 0.75 d after 008 (4.25 d), so unless it starts when 002 merges it takes the fallback; W5 is then 9.25 d and the total moves from about 39.5 to about 44 d.

**Bolt 001 human session.** The human runs checks (c), (h) and (i), which need a live session (`/reload-plugins`, a new session, panes), and writes the acceptance (`001-human-to-orchestrator.verdict.md`). Estimate: 2 to 4 hours (30 to 60 minutes per check, plus 0.5 to 1 hour to read the hand-back and accept it), on days 1 to 2 of W1, so a failed (c) or a changed (a) is known while 002 still runs. The probe writes each check as a numbered script, so the human only runs it and pastes the output. **Pending the human's confirmation that the time is available.** If the human is unavailable, 009 is the bolt that slips, and the intent end date moves with it.

## Priority and estimates

Every bolt is P1 (spec §16; ITEM-111 is the P0 contract, delivered at G2). Priority inside a wave follows the critical path first, then the licence item.

| Bolt | Priority | Estimate (point) | Range | Confidence | Note |
|---|---|---|---|---|---|
| 001 | P1 | 2 d box (about 1 d of agent work) | 1 to 2 d | Medium | Elapsed is bound by the human's session |
| 002 | P1 | 7.25 d | 6 to 9.5 d | Medium-Low | Critical path. Includes the merge guard, `runs-root.mjs` and the drift test |
| 003 | P1 | 2.0 d | 1.5 to 3 d | Medium-High | |
| 004 | P1 | 4.75 d | 4 to 6.25 d | Medium | Includes the `tests/herdr` literals (+0.25 d) |
| 005 | P1 | 3.1 d | 2.5 to 4.5 d | Medium | |
| 006 | P1 | 2.0 d | 1.5 to 3 d | Medium-High | |
| 007 | P1 | 3.0 d | 2.5 to 4.5 d | Medium | |
| 008 | P1 | 4.0 d | 3 to 6 d | Medium-Low | Longest W3 bolt |
| 009 | P1 | 6.35 d | 5.25 to 8.5 d | Medium | Includes the R-14 lines (+0.1 d) and the Windows CI leg (+0.25 d) |
| 010 | P1 | 4.1 d | 3 to 6.25 d | Medium-Low | Includes the R-14 lens lines (+0.1 d) |
| 011 | P1 | 1.5 d | 1 to 3.5 d | Low | Range bolt: fix volume is unknown until it runs |
| 012 | P1 (lowest of W3) | 4.75 d | 4 to 6.25 d | Medium | Derived from the estimate's 012 cut, story 022 |
| 013 | P1 | 1.0 d | 0.75 to 1.5 d | High | |
| 014 | P1 | 4.5 d | 3.75 to 6 d | Medium-Low | Derived; stories 023 and 024 |

**Totals (ideal pipeline days).** Effort over the 14 bolts: about 49.3 d (non-spike bolts about 48.3 d plus about 1 d for 001's agent work). Elapsed, through W6: about 44 d if 012 falls back to W5 (the expected case at the point estimates, see *012 fallback*), and about 39.5 d only if 012 starts when 002 merges and finishes in W3 (the wave column above less the early-start saving of 0.5 d). Through W5 (bolts only): about 32.5 d with 012 in W3, and about 37 d with the fallback (step 1.1.26). The range of about 31 to 58 d comes from step 1.1.31, is low-confidence and is not recomputed here; it is narrower than the 34 to 63 d of step 1.1.26, and no derivation of the difference is recorded. This excludes human gate waits, the human's session beyond its box, the per-wave documentation stage (about 0.25 d a wave, outside the bolts), any raised loop limits, and the per-wave rough W6 figures (ITEM-121 1.5 d, 011 1.5 d, ITEM-122 2 d, ITEM-123 1 d, ITEM-124 1 d). No measured velocity exists: every number is judgement, not calibrated against a previous bolt.

**Estimate caveats.** The ranges of 009 (5.25 to 8.5 d) and 010 (3 to 6.25 d) come from step 1.1.31 and are not recomputed from step 1.1.26 plus the stated increments. The points and ranges of 012 and 014 are derived from the estimate's cut and the product-owner's "about 5 d / about 4.5 d"; the estimate gave no ranges for the two halves. Step 1.1.29 lists +0.5 d on 002 (C-2, C-4, C-5) and +0.1 d on 007 and 008, while the estimate says S-3, S-4, S-6 and the one-implementation G-FM are already included in the figures used here; if the 0.5 d is meant on top of 7.25 d, the critical path gains up to 0.5 d, inside 002's range of 6 to 9.5 d.

**Assumptions needing confirmation.** (1) W3 bolts run in parallel; if capacity is serial, W3 grows by about 5 d, and 012 goes to W5 at once. (2) The existing test suite is green on Windows (Windows CI leg).

## Pending the human (shown at G3)

- **Bolt 001 human session (pending):** a 2 to 4 hour session on days 1 and 2 of W1 for checks (c), (h) and (i) and the acceptance. Not yet confirmed as available.
- **AC-16.6, the Windows CI leg in bolt 009 (pending acceptance):** about 0.25 d, a new AC in a frozen spec (spec r1, change 3.1). Assumption: the existing suite is green on Windows.
- **Bolt 012 in W3 on the non-blocking rule (pending acceptance),** and the assumption that W3 bolts run in parallel; with serial capacity, W3 grows by about 5 d and bolt 012 goes to W5 at once.
- **"R8 amended: AC-17.14 owned whole by engine" (shown at G3):** product-owner, step 1.1.25 (D43).
- **ITEM-121 AC-6 (pending acceptance with the revised spec):** the managed block, the schema refresh and the settings rewrite are spec r1 text.

## Bolt Definition of Done (every bolt)

- AC-16.1 (`node tools/build-copilot.mjs --check`), closed by ITEM-124;
- AC-16.3 (no stack-specific terms outside a stack-routing table), closed by ITEM-122;
- AC-16.5 (`node tools/validate.mjs`), closed by ITEM-124;
- AC-12.3 for any bolt that adapts specsmd material: the bolt appends its `ATTRIBUTION.md` line;
- AC-9.5's `ATTRIBUTION.md` rule for any change under `hooks/auto-handoff/` or `hooks/keepalive/`;
- the AC-15.8 marker (`fallback: remove in 1.0.0`) on any legacy branch;
- the single-writer rule (§14);
- "done" means engineering done plus knowledge done (§14);
- the bolt's `bolt.md` and stories were updated by `documentation-writer` and passed critique.

## Open items to settle before a bolt starts

| Open item | Status | Owner | Before bolt |
|---|---|---|---|
| O-4 | Decided: yes (toast deduplicated by text per session, one `skipped` note per scan) | product-owner | 008 (closed) |
| O-12 | Closed: no `{data, error}` envelope on the new `--json` outputs | system-engineer | 002 (closed) |
| O-21 | Open | system-engineer, in the lld | 009 |
| O-9, O-10 | Open | system-engineer, in the lld | 012 / 014 |
| O-13, O-23 | Open | spike | 001 |
| O-19 | Open, non-gating | ITEM-120 | — |
| `time_box` format (R-10) | Closed: a convention (`<n>d`), not validated by `validate` (C2, step 1.1.30.2) | software-architect | 002 (closed) |
| "The migration bolt" of AC-17.14 | Closed: it means bolt 014; bolt 012 does not wait for the spike hand-back (C1, product-owner, step 1.1.30.1) | product-owner | 012 (closed) |
| Bolt ids of the 012 split | Closed: `012-engine-migrate-plan` and `014-engine-migrate-settings` (C3, step 1.1.30.2) | software-architect | G3 (closed) |

## Intent-level work (W6)

- **ITEM-121:** dogfood migration of this repository, an AAWP run. It runs `/engine:migrate`, moves `docs/backlog/backlog.md` into the bank backlog (`documentation-writer` merges it), moves `docs/follow-ups.md` to `memory-bank/project/follow-ups.md` with its content update (R-8), and makes this repository's settings `engine:` and `forgeline`.
- **011:** the path sweep, after ITEM-121 (R-1).
- **ITEM-122:** TLC. It runs the full checks and the fresh-`init` and migrated-repository walk-throughs (AC-14.7), and it closes AC-16.3 and the full AC-12.3 comparison.
- **ITEM-123:** the upgrade guide (with the stored-data warning, D23) and the release notes, plus the AC-17.8 verification over reader pages that the bolts' docs stages already renamed (R-9).
- **ITEM-124:** the release, closing AC-16.1, AC-16.5, AC-12.4 and the FR-14 ACs.

## Execution

One run per bolt: AAWP bolts in `execution-plans/AAWP-<YYYYMMDD>-<bolt-id>/`, one branch and worktree per bolt; bolt 001 in `ASDLC-<YYYYMMDD>-engine-rename-spike`, with the D40 override recorded in its Routing Plan.

## Merge order

W1: 002, then 003. W2: 013 first, then 004, then 005. W3: 008, 007, 006, 012, in the order they finish; none edits `workflow.mjs` except 012. W4: 009, then 010. W5: 012 (if it fell back), then 014. W6: ITEM-121, then 011.

## Risks

1. **Self-hosting after D42 (reduced).** This repository's `artifacts.handoffs` points at `execution-plans/`, so the hook and the lens find this run's records, and 007 and 008 can be tested live here. Bolt 009 still breaks the local install (`plugins/claude/ai-dlc` disappears): the human re-registers the marketplace as `forgeline` when 009 merges. Between 002 and ITEM-121 this repository's block is mixed (`handoffs` new, six keys legacy): the merge guard in 002 protects it from `upgrade` flipping the layout, and the resolver's per-key rule gives a true `ignored docs/handoffs` warning until ITEM-121.
2. **No `lib/` split.** `workflow.mjs` (988 lines today) grows to about 2,100 to 2,300 lines by the end of W5, below the 2,500-line revisit trigger. The single file is final in 002's lld and is revisited at ITEM-125 or above 2,500 lines. Replaces the earlier "split trigger" wording.
3. **Rename breadth.** 60 files under `tests/`, the lens and the engine hooks name the old plugin paths, and 39 engine plugin files hold legacy `docs/` paths. Bolt 009 is the widest mechanical change, then 010. A spike result can add a spec revision before 009 (the 1.0 d buffer).
4. **Spike result.** (a), (b) or (c) failing after the fixtures are written adds a spec revision or a new human decision; the single-function seams (memory pattern, state namespace, pane ids) limit a change to one place each. Spike finding (f) may add the `settings.json:3` change to 009.
5. **Bolt 011 fix volume.** Unknown until it runs after ITEM-121; each lens-owned hit becomes a fix round of 010.
6. **Three grammar implementations drift.** In preview2 only `workflow.mjs` implements G-FM; the byte-identical vector copies and the one drift test (002) guard G-REC and the resolver in the hook and the lens.
7. **Hot files.** `workflow.mjs` (the `validate` and template sections), the template `workflow.json`, `tests/workflow/`, the `ai-dlc` skill and `orchestrator.md` (004 only). One new test file per concern avoids conflicts on `workflow.test.mjs`.
8. **Windows.** The fixtures of 012 and 014 build temporary git repositories on Windows and Linux (CRLF, `git mv` case sensitivity, JSONC settings comments); the Windows CI leg in 009 is the one place CI sees Windows.