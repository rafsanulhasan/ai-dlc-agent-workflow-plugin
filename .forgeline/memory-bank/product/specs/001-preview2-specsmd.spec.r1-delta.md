---
spec: 001-preview2-specsmd
revision: r1
base: memory-bank/product/specs/001-preview2-specsmd.spec.md (G2-approved, D38)
intent: 001-preview2-specsmd
status: draft
created: 2026-11-14
---

# Spec 001, revision delta r1 (input to G3)

**Planned (G3 pending):** this delta changes the frozen spec 001 only when the human approves G3. Until then the frozen text stands. The front matter `status: draft` is this delta's own status (the §5 vocabulary; `draft` shows as *planned*), not the spec's: the spec's own `status` becomes `frozen` through change 7.1.

Content by `requirement-analyst` (step 1.1.30, `spec-driven-development`); written to the bank by `documentation-writer` (D2). Line numbers ("spec:N") refer to `memory-bank/product/specs/001-preview2-specsmd.spec.md` as approved at G2; "AC file:N" refers to `memory-bank/product/intents/001-preview2-specsmd/acceptance-criteria.md`.

Sources (all in `.forgeline/execution-plans/AI-DLC-20261113-preview2-specsmd/`): 1.1.23 §4 (R-1 to R-11), 1.1.24 §0 and §8 (S-1 to S-8, views on the refines), 1.1.24.1 (F-1 to F-11, R-12 to R-14), 1.1.25 and 1.1.25.1 (product-owner, D43), 1.1.27 (product-owner, order and Windows CI), 1.1.28 §1 to §6 (software-architect reconciliation C-1 to C-7), 1.1.29 (product-owner, 012 split), `decisions-2026-11-13.md` (D38 to D43), and the clarify answers 1.1.30.1 (C1, C4: product-owner) and 1.1.30.2 (C2, C3: software-architect).

## AC impact (read first)

- **New AC:** one, AC-16.6, the `windows-latest` CI job (change 3.1). It is **pending human acceptance at G3**.
- **Clarified AC:** AC-15.2, for the lens (change 2.3, O-4 closed). The AC text does not change.
- **Amended decision in the AC file (not an AC):** R8 (change 2.1).
- **No other AC text changes** from this delta. Every other change is spec text, a §16 or §16.1 row, a component boundary or a test seam.
- **Two AC readings were settled at clarify (product-owner, step 1.1.30.1); no AC text changes:**
  - **C1.** "The migration bolt" in AC-17.14 (AC file:260: "the migration bolt does not start before its hand-back is accepted") means bolt 014, the spike-dependent half of the split. Bolt 012 requires only 002 and uses no spike finding (1.1.28 §4), so adding 001 to its Requires would only delay W3 (change 5.2).
  - **C4.** AC-17.14 labels finding (c) "(c, lens)" (AC file:260). Under the amended R8 the label is read as "consumed by the lens" (change 2.1). No text change.
- **Two more clarify answers applied (software-architect, step 1.1.30.2):** C2, R-10 `time_box` is a convention that `validate` does not check (change 1.9); C3, the split bolts take the ids `012-engine-migrate-plan` (was 012a) and `014-engine-migrate-settings` (was 012b), and the id grammar and AC-2.2 stay as they are (change 5.1).
- **Shown to the human at G3 (product-owner, step 1.1.25.1):** "R8 amended: AC-17.14 owned whole by engine" (change 2.1). AC-16.6 (change 3.1) and 012 in W3 on the non-blocking rule (change 5.2) are also pending the human at G3. Three readings are shown with them, so none is silent: C1 and C4 above (product-owner answers, step 1.1.30.1; no AC text changes) and the AC-15.2 clarification for the lens (change 2.3; O-4, product-owner, D43).

## Change index

| # | Section | Change | Source |
|---|---|---|---|
| 1.1 | §16 Bolt 011, Waves | 011 runs after ITEM-121 (R-1) | 1.1.23 §4 R-1; 1.1.24 §8; 1.1.27 §1 |
| 1.2 | §16.1 | AC parts `AC-x[part]` and the bolt Definition of Done (R-2) | 1.1.23 §0 D-A, D-B, §4 R-2 |
| 1.3 | §6.1, §16 rows 002, 005 | `spike-bolt` lands in 005 (R-4) | 1.1.23 §4 R-4; 1.1.24 §8 |
| 1.4 | §6.2, §16 rows 002, 003 | building-stage prose to 003 (R-5) | 1.1.23 §4 R-5; 1.1.24 §2, §8 |
| 1.5 | §16 row 005, merge order | 005 merges after 004 (R-6) | 1.1.23 §4 R-6; 1.1.24 §1, §8 |
| 1.6 | §11 path constants, §16 rows 002, 009, 010 | `paths.mjs` from 002, new tests only (R-7) | 1.1.23 §4 R-7; 1.1.28 C-1 |
| 1.7 | §16 W6 (ITEM-121) | `docs/follow-ups.md` moves in ITEM-121 (R-8) | 1.1.23 §4 R-8; 1.1.25 item 2 (D43) |
| 1.8 | §16 intro and W6 (ITEM-123) | reader pages renamed in each bolt's docs stage (R-9) | 1.1.23 §4 R-9 |
| 1.9 | §4.1 | `time_box` format (R-10) | 1.1.23 §4 R-10; 1.1.24 §8; 1.1.24.1 |
| 1.10 | §16 row 001, §17 O-6 | spike acceptance as an unvalidated `.verdict.md` (R-11) | 1.1.23 §4 R-11; 1.1.24 §8; D40 |
| 1.11 | §16 intro | legacy paths cleared in files a bolt already edits (S-7) | 1.1.24 S-7; 1.1.28 §3 |
| 1.12 | §16 intro | shared bank files change once per wave (S-8) | 1.1.24 S-8; 1.1.28 §3 |
| 1.13 | §2.3 Size | no `lib/` split in preview2 (S-2, F-3) | 1.1.24 §3; 1.1.24.1 F-3; 1.1.28 §1 |
| 1.14 | §16 row 005 | bank templates location (F-11) | 1.1.24.1 F-11; 1.1.28 §2 |
| 2.1 | AC file R8, R3, Q3 (AC file:50, :45, :75) | AC-17.14 owned whole by engine (R-3) | 1.1.25 item 1; 1.1.25.1 item 1 (D43) |
| 2.2 | §16 row 001 Unit cell, row 010 | lens-consumed findings (R-3) | 1.1.25 item 1 |
| 2.3 | §9.2, §16.1 AC-15.2, §17 O-4 | O-4 resolved as a clarification of AC-15.2, closed | 1.1.25 item 3; 1.1.25.1 item 3 (D43) |
| 3.1 | AC file FR-16, §16 row 009, §16.1 | new AC-16.6 `windows-latest` job (pending human acceptance at G3) | 1.1.27 §4; 1.1.29 §3 |
| 4.1 | §4.2 | G-FM: one grammar, one implementation in preview2 | 1.1.28 C-3, §5 item 1 |
| 4.2 | §8.1 | `record-names.mjs`; hook `record.ts` | 1.1.28 §5 item 2, C-6 |
| 4.3 | §9.1 | two TS files; per-key rule (D42); mixed row; `runs-root.mjs` | 1.1.28 §5 item 3, C-4, §6 |
| 4.4 | §9.2 | `.mjs` vectors with `channel`; `MIGRATE_ENTRY`; merge guard in 002; files of their own | 1.1.28 §5 item 4, C-2, C-6, R-13 |
| 4.5 | §10.2 | residue source; fixture F13 | 1.1.28 §5 item 5, §6 |
| 4.6 | §16 rows 002, 004, 007, 008, 009, 010, 012, W6 | per 1.1.28 §5 item 6 | 1.1.28 §5 item 6, C-1, C-2, C-5, C-7, R-14 |
| 4.7 | §12 | lens file names (`runs-root.ts`, `identity.ts`, `engine-names.ts`) | 1.1.28 C-6 (consequence of item 4.8) |
| 4.8 | Component boundaries | lens and hook grammar files; canonical vectors engine-owned | 1.1.28 §5 item 8 |
| 4.9 | Test seams | `.mjs` vectors, one drift test; F-4; S-6 | 1.1.28 §5 item 9 |
| 4.10 | Data shapes, §17 O-12 | O-12 closed: no envelope | 1.1.24.1; 1.1.28 §3, §5 item 10 |
| 4.11 | §16 row 007 | D42: 007 and 008 testable on this repository | 1.1.28 §6; 1.1.27 §6 |
| 5.1 | §16 row 012 | split into 012 and 014 | 1.1.28 §4; 1.1.29 §1 |
| 5.2 | §16 Requires, Waves | requires of 012, 014, 011; 012 in W3 with fallback; 14 bolts | 1.1.28 §4; 1.1.29 §1, §2 |
| 5.3 | §16.1 | AC split between 012 and 014 | 1.1.28 §5 item 7; 1.1.29 delegation 1 |
| 7.1 | spec front matter and status line (spec:4, :11) | frozen after G2 (housekeeping) | 1.1.30 other findings; D38 |
| 6 | §17 after r1 | the *Closed* line and the rows that leave §17 | 1.1.28 §5 item 10; 1.1.25; D38 to D41, D43 |
| 7.2 | §17 | O-1, O-2, O-3, O-5 and O-15 closed (housekeeping) | 1.1.30 other findings; D38 to D41 |
| 7.3 | spec:32, 405, 416, 444, 475, 479 | text that still points at the closed items O-1, O-2, O-3, O-5 and O-15 | 1.1.30 other findings; D38 to D41 |

---

## 1. Refines R-1 to R-11 and the settled S- and F-items

### 1.1 R-1: bolt 011 runs after ITEM-121

- **Section:** §16, row 011 (spec:601) and *Waves* (spec:605-616).
- **Old (spec:601, Requires cell):** "009, 010"
- **New (Requires cell):** "009, 010, 012, 014; after ITEM-121"
- **Old (spec:610):** "- W5: 011 and 012, in parallel."
- **New:** replaced by the waves of change 5.2.
- **Reason:** the §15 search scope includes `docs/` and `README.md`. Until ITEM-121 moves `docs/{architecture,product,specs,backlog,plans}` into the bank, those folders hold old names that AC-17.4(d) does not allow, so the check fails CI if 011 runs in W5. Running 011 after ITEM-121 needs no AC change; the alternative (a temporary history allowlist) would amend AC-17.4 and was rejected.
- **Source:** 1.1.23 §0 D-D and §4 R-1; accepted by system-engineer (1.1.24 §8, 1.1.24.1); order confirmed by product-owner (1.1.27 §1 W6).

### 1.2 R-2: AC parts and the bolt Definition of Done

- **Section:** §16.1 (spec:618-728), its intro line (spec:619).
- **Old (spec:619):** "\"Intent\" means intent-level work with no bolt."
- **New:**
  > "Intent" means intent-level work with no bolt.
  >
  > **AC parts.** An AC delivered by more than one bolt is split into parts, written `AC-x[part]`, by file ownership. Each part belongs to exactly one story, and a story to one bolt. An AC is met when all its parts are met. 26 ACs are split this way.
  >
  > **Bolt Definition of Done (DoD).** These hold for every bolt and are checked in its review. They are not story ACs, and the intent closes them:
  > - AC-16.1 (`node tools/build-copilot.mjs --check`), closed by ITEM-124;
  > - AC-16.3 (no stack terms), closed by ITEM-122;
  > - AC-16.5 (`node tools/validate.mjs`), closed by ITEM-124;
  > - AC-12.3, for any bolt that adapts specsmd material: the bolt appends its `ATTRIBUTION.md` line; the full comparison is closed by ITEM-122;
  > - the AC-9.5 `ATTRIBUTION.md` rule for any change under `hooks/auto-handoff` or `hooks/keepalive`;
  > - the AC-15.8 marker on every legacy branch;
  > - the single-writer rule (§14);
  > - "done" means engineering done and knowledge done (§14): the bolt's `bolt.md` and stories were updated by `documentation-writer` and passed critique.
- **Rows:** the Delivery cells change as in the full §16.1 table in change 5.3, which carries R-2, R-3, O-4, AC-16.6 and the 012 split together.
- **Reason:** §16.1 maps 26 ACs to more than one bolt, while a story belongs to one bolt; the units' split rule (by file ownership) gives the parts. AC-16.3 had no closer in §16.1.
- **Source:** 1.1.23 §0 D-A, D-B, §1 *Coverage check*, §4 R-2; no objection from system-engineer (1.1.24.1).

### 1.3 R-4: `spike-bolt` lands in bolt 005

- **Section:** §6.1 (spec:199-208) and §16 rows 002 (spec:592) and 005 (spec:595).
- **Old (spec:199):** "### 6.1 `boltTypes` (a new top-level key in `workflow.json`; optional in preview2, required from 1.0.0)"
- **New:** heading unchanged; add after the type table (after spec:208):
  > **Delivery.** Bolt 002 adds `boltTypes` with `construction-bolt` and `simple-bolt`, and the `validate` checks of §6.2, including the object form (`{stages, after}`) with fixtures. Bolt 005 adds `spike-bolt` together with the `probe` stage, because `validate` checks that every stage id exists and `probe` does not exist before 005.
- **§16 rows:** see change 4.6 (002: "`boltTypes` with `construction-bolt` and `simple-bolt`"; 005: "`spike-bolt`, with `probe`").
- **Reason:** with `spike-bolt` in 002, 002's own "every stage id exists" check fails on its own template.
- **Source:** 1.1.23 §4 R-4; accepted by system-engineer (1.1.24 §8, 1.1.24.1: object-form validation stays in 002).

### 1.4 R-5: building-stage prose moves to bolt 003

- **Section:** §6.2, the `building: true` bullet (spec:215).
- **Old (spec:215):** "- **New stage flag `building: true`.** It is set on FDLC `build`, BFLC `fix`, RLC `refactor`, AAWH `change` and AAWP `change`. It replaces the prose definition of \"the building stage\" (`software-engineer` in FDLC, BFLC, RLC and AI-DLC; `agent-manager` in AAW) in the `docs-status` rule and its copies (`docs-rules` templates, `orchestrator.md`, `documentation-writer.md`, `write-documentation`). No code constant exists today."
- **New:**
  > - **New stage flag `building: true`.** It is set on FDLC `build`, BFLC `fix`, RLC `refactor`, AAWH `change` and AAWP `change`. It replaces the prose definition of "the building stage" (`software-engineer` in FDLC, BFLC, RLC and AI-DLC; `agent-manager` in AAW) in the `docs-status` rule and its copies (`docs-rules` templates, `orchestrator.md`, `documentation-writer.md`, `write-documentation`). No code constant exists today.
  >   - **Delivery.** Bolt 002 adds the flag: the `building` stage key, its schema entry, the five template flags and the `validate` rule for `producesCode: false`. Bolt 003 replaces every prose copy. 002 merges before 003.
  >   - **Until ITEM-121.** A repository whose `workflow.json` has no `building` flag yet (this repository until ITEM-121) keeps the preview1 meaning; the rewritten prose keeps one sentence that says so (`software-engineer`; `agent-manager` in AAW).
- **§16 rows:** see change 4.6 (002 and 003).
- **Reason:** otherwise 002 and 003 both edit `docs-status` in W1.
- **Source:** 1.1.23 §4 R-5; accepted by system-engineer with the self-hosting sentence (1.1.24 §2 bolt 003 and §8; 1.1.24.1).

### 1.5 R-6: bolt 005 merges after 004

- **Section:** §16 row 005 (spec:595).
- **New (Scope cell, appended):** "Merges after 004 (W2 merge order 013, 004, 005). It does not edit `orchestrator.md` or `agent-invocation`."
- **Requires cell:** unchanged, "002".
- **Reason:** 004 and 005 both edit `workflow.mjs` (`validate`), the template `workflow.json`, the workflow tests and the `ai-dlc` skill; ITEM-114 already depends on ITEM-115. The remaining conflict is resolved by hunk ownership (section and line ranges in 005's lld) and one array line in `validate`.
- **Source:** 1.1.23 §4 R-6; accepted by system-engineer with the mechanism (1.1.24 §1, §8; 1.1.24.1 F-5 for 013 before 005).

### 1.6 R-7: `tests/helpers/paths.mjs` from bolt 002, for new tests only

- **Section:** §11, the *Path constants* row (spec:485).
- **Old (spec:485, To cell):** "`tests/helpers/paths.mjs` exporting `ENGINE_DIR` (`plugins/claude/engine`, bolt 009), `LENS_PLUGIN` and `LENS_DIR` (old values from 009; `lens` and `plugins/claude/lens` from 010)"
- **New (To cell):** "`tests/helpers/paths.mjs`, created by bolt 002 with today's values (`ENGINE_DIR` = `plugins/claude/ai-dlc`, `LENS_PLUGIN` = `ai-dlc-lens`, `LENS_DIR` = `plugins/claude/ai-dlc-lens`). Bolt 009 changes the engine values to `engine` and `plugins/claude/engine`; bolt 010 changes the lens values to `lens` and `plugins/claude/lens`. Only tests written from 002 on use it. The existing tests are not converted: 16 of them import plugin code through static specifiers, which must be string literals, so 009 edits the literals in the engine-owned existing tests and 010 in the lens-owned ones."
- **Rows:** see change 4.6 (002, 009, 010).
- **Reason:** new tests in 002 to 008 and 011 need no edit at the renames. Converting existing tests was rejected: four of the 16 are lens-owned (Component boundaries), dynamic imports would add churn, and it would lengthen 002 on the critical path.
- **Source:** 1.1.23 §4 R-7; 1.1.24 §8 (accept with correction); 1.1.24.1 (amend: convert 41 tests); conflict decided by software-architect 1.1.28 §1 C-1 (reading A), accepted by product-owner 1.1.29 §3.

### 1.7 R-8: `docs/follow-ups.md` moves in ITEM-121

- **Section:** §16 *Waves*, W6 ITEM-121 (spec:612). Full W6 text in change 5.2.
- **New (ITEM-121 line, part):** "moves `docs/follow-ups.md` to `memory-bank/project/follow-ups.md` with `git mv` (a pure move, exempt from the single-writer rule); `documentation-writer` updates its stale plugin and `.ai-dlc` paths in the same stage, so it needs no sweep allowlist entry. 009's docs stage does not touch it."
- **Reason:** it holds open review follow-ups and is not one of the seven migrated keys, so `migrate` would leave it behind with old names inside the AC-17.3 scope. Once moved it is a bank file under `memory-bank/project/`, so the bank's single-writer rule (§14, D2) governs it: `documentation-writer` writes it, with content from its stage owners.
- **Source:** 1.1.23 §4 R-8; product-owner 1.1.25 item 2 and 1.1.25.1 item 2 (D43). The orchestrator's note on 1.1.25.1 carries the 1.1.25 wording (target file name and the `documentation-writer` update), used here.

### 1.8 R-9: reader pages renamed in each bolt's docs stage

- **Section:** §16 intro (spec:587) and W6 ITEM-123 (spec:614).
- **New (§16 intro, appended as a bullet list under the existing paragraph):**
  > **Reader pages.** The README pages and `docs/plugins.md` pick up new names in the docs stage of the bolt whose work changes them, through *Docs update* requests (`docs-status`):
  > - 004: run-folder text (`execution-plans/`); 005 and 013 send *Docs update* requests to 004's stage instead of editing;
  > - 009: engine names;
  > - 010: lens names;
  > - 014: the migrate entry.
- **New (ITEM-123 line):** "ITEM-123: the upgrade guide (with the stored-data warning), the release notes, and the AC-17.8 verification over reader pages that the bolts' docs stages already renamed."
- **Reason:** scheduling only; `docs-status` already requires it. The source says "012" for the migrate entry; it is written 014 here because the migration skill, the user entry point, is in bolt 014 after the split (change 5.1).
- **Source:** 1.1.23 §4 R-9; 1.1.24 §2 bolt 004.

### 1.9 R-10: `time_box` format

- **Section:** §4.1, the Bolt row (spec:145) and the bullets after the table (spec:147-148).
- **Old (spec:145, part):** "optional `current_stage`, `stages_completed [stage ids]`, `time_box`"
- **New (bullet added after spec:148):**
  > - `time_box` is a string `<n>d`, a whole number of working days, for example `2d`. Bolt 001 uses `2d` until the estimate replaces it. It is a convention only: `validate` does not check it (C2).
- **Reason:** the format was undefined. The two system-engineer reports disagreed on validation. Software-architect settled it (C2, step 1.1.30.2): a convention only, because no engine, hook or lens code reads `time_box`, and validating it would let a badly formatted estimate fail `validate`, which the Stop-hook workflow gate enforces. Revisit only if a later consumer starts parsing `time_box`; that needs an ADR-level change, not a preview2 one.
- **Source:** 1.1.23 §4 R-10; 1.1.24 §8; 1.1.24.1; software-architect 1.1.30.2 (C2).

### 1.10 R-11: the spike acceptance is an unvalidated `.verdict.md`

- **Section:** §16 row 001 (spec:591, Scope cell) and §17 O-6 (spec:786).
- **New (row 001, Scope cell, appended):** "The human accepts the hand-back (D40). The acceptance is written as `{code}-human-to-orchestrator.verdict.md` in the exact §8.3 shape, before bolt 004 exists. It is not validated, because the run has no `events: 1`, and preview1 readers ignore it (the lens reads only `handoff` and `handback`; the hook pairs by name; from 1.1.24 §8, recheck at bolt start). Bolt 004 copies this file into its `events` tests as one valid vector."
- **Old (spec:786):** the O-6 row.
- **New:** O-6 leaves §17 and is listed under *Closed*: "O-6 and O-7 by D40 (the human accepts the spike hand-back, recorded as a `verdict`; bolt 001 runs as ASDLC with a one-off override research → probe → architecture)."
- **Reason:** forward-compatible record of D40 before the event schema exists.
- **Source:** 1.1.23 §4 R-11; 1.1.24 §8 (accept, amended: 004 reuses the file); 1.1.24.1 (accept); D40.
- **Note:** closing O-6 and O-7 in §17 also follows from D40. O-1, O-2, O-3 and O-5 are closed by change 7.2 (D39, D41).

### 1.11 S-7: legacy paths cleared in files a bolt already edits

- **Section:** §16 intro (spec:587), new bullet.
- **New:**
  > **Legacy paths.** Each bolt removes the legacy `docs/…` paths in the files it already edits. A prose hit is replaced by the `artifacts.<key>` reference with the preview2 default in parentheses, for example "the specs path (`artifacts.specs`, default `memory-bank/product/specs/`)", never by a bare new literal, because until ITEM-121 a repository can be legacy, mixed (D42) or preview2. Bolt 006 takes the leftover files; bolt 004 takes the `tests/herdr` fixture literals (change 4.6).
- **Reason:** shrinks bolt 011's fix volume to a short leftover list.
- **Source:** 1.1.24 S-7, §2; accepted, amended by software-architect 1.1.28 §3.

### 1.12 S-8: shared bank files change once per wave

- **Section:** §16 intro, new bullet.
- **New:**
  > **Shared bank files.** The unit-brief *Bolts* sections, `units.md`, the task-plan status columns and `memory-bank/project/backlog.md` are changed by one `documentation-writer` stage after each wave's merges, not inside a bolt's run. Each bolt's own `bolt.md` and stories stay inside its run.
  >
  > The bank's single-writer rule (§14, D2) governs these files: `documentation-writer` writes them, with content from their stage owners. Until bolt 003 merges, the preview1 `docs-status` rule still names the stage owners as the writers of the backlog, the plan and `units.md`; §14 replaces that for bank files.
- **Source:** 1.1.24 S-8; accepted by software-architect 1.1.28 §3.

### 1.13 S-2 / F-3: no `lib/` split of `workflow.mjs` in preview2

- **Section:** §2.3, *Size* (spec:118). Not in the 1.1.28 §5 list; added because spec:118 contradicts the decision 1.1.28 §1 confirms.
- **Old (spec:118):** "- **Size.** `workflow.mjs` stays one installed file. Its sections are ordered grammar, artifacts, validate, migrate. It is split into `lib/` once it passes about 1,500 lines."
- **New:**
  > - **Size.** `workflow.mjs` stays one installed file through preview2 (forecast about 2,100 to 2,300 lines). It is importable: an `IS_MAIN` guard runs the CLI only when the file is executed, and the pure functions are exported, so tests can import them. It is organised in fixed sections, each owned by one bolt, and the legacy branches sit in one section that 1.0.0 deletes. A `lib/` split is revisited at ITEM-125 (1.0.0) or above 2,500 lines, because a split changes the installed file set (`init`, the `workflow` skill, the migrate skill) and the Stop-hook gate.
- **Source:** 1.1.24 §0 S-2 and §3; 1.1.24.1 F-2, F-3; confirmed by software-architect 1.1.28 §1.

### 1.14 F-11: where the bank templates live

- **Section:** §16 row 005 (spec:595). Not in the 1.1.28 §5 list; added because row 005's scope names the templates without a location.
- **New (Scope cell, part):** "bank templates for the intent files, unit brief, story and `bolt.md` (§4.1), in `skills/write-documentation/templates/bank/` of the engine plugin, linked from `write-documentation`; a specsmd-adapted template appends its path to the plugin-root `ATTRIBUTION.md` (AC-12.3)."
- **Source:** 1.1.24.1 F-11; decided by software-architect 1.1.28 §2.

---

## 2. Product-owner step 1.1.25 (D43)

### 2.1 R8 amended (acceptance-criteria.md, *Decided*)

- **Section:** AC file *Decided*, R8 (AC file:50). Not an AC.
- **Old (AC file:50):** "- **R8 — unit assignment.** Lens parts of AC-17.5, AC-17.11 and AC-17.14 go to the lens, the rest to engine (D14; product-owner, 1.1.17)."
- **New:** "- **R8 — unit assignment.** Lens parts of AC-17.5 and AC-17.11 go to the lens, the rest to engine (D14; product-owner, 1.1.17). AC-17.14 is owned whole by engine (bolt 001); its lens parts (c), (e), (h) and (i) are consumed by lens bolt 010 through `requires_bolts` (product-owner, 1.1.25, D43; amends 1.1.17)."
- **Old (AC file:45, R3, end):** "...; the lens commands are live-checked by AC-17.14 (c)."
- **New (AC file:45, R3, end):** "...; the lens commands are live-checked by AC-17.14 (c) in engine bolt 001, whose finding lens bolt 010 consumes (R8 as amended)."
- **Old (AC file:75, Q3, Question cell):** "The AC-17.14 spike is the first construction bolt of the engine unit, its lens part (c) goes to the lens unit, and the migration bolt waits for the spike's accepted hand-back."
- **New (AC file:75, Q3, Question cell):** "The AC-17.14 spike is the first construction bolt of the engine unit and owns AC-17.14 whole; lens bolt 010 consumes its findings (c), (e), (h) and (i); and the migration bolt (014) waits for the spike's accepted hand-back (R8 as amended)." The Answer, owner and Where cells do not change.
- **Reason:** a story belongs to one bolt and a bolt to one unit, so a lens story cannot sit inside the engine spike bolt. The spike is one time-boxed hand-back, accepted once by the human. R3 and Q3 are amended with R8 (R-3, 1.1.25 item 1) so the AC file states one owner of AC-17.14.
- **Source:** 1.1.23 §0 D-C, §4 R-3; product-owner 1.1.25 item 1, 1.1.25.1 item 1; D43.
- **Conditions carried:** the spike hand-back and the research note label findings (c), (e), (h), (i) as lens-consumed; bolt 010's success criteria and notes cite them; 010 does not start until the human accepts the spike hand-back (D40); a failed (c) goes to the human as a new decision.

### 2.2 §16 row 001 Unit cell; row 010

- **Old (spec:591, Unit cell):** "engine (lens part (c))"
- **New:** "engine (findings (c), (e), (h), (i) consumed by lens bolt 010)"
- **New (row 010, spec:600, Scope cell, appended):** "Consumes spike findings (c), (e), (h), (i); its success criteria cite them, and it does not start before the human accepts the spike hand-back (D40)."
- **Reason and source:** as change 2.1. 1.1.23 R-3 named finding (c) only; product-owner 1.1.25 item 1 names all four, used here.

### 2.3 O-4 resolved: clarification of AC-15.2, closed

- **Section:** §9.2, the lens bullet (spec:372); §16.1 row AC-15.2 (spec:701); §17 O-4 (spec:784).
- **Old (spec:372):** "- The lens collects notes per scan and writes at most one note to its log and to the `skipped` list that the bare `/lens:gate` shows. Its toast is deduplicated by text per session (O-4)."
- **New:**
  > - The lens collects notes per scan and writes at most one note to its log and to the `skipped` list that the bare `/lens:gate` shows. Its toast is deduplicated by text per session.
  >   - **AC-15.2 for the lens (clarification, O-4 closed by product-owner, D43).** A lens scan is one invocation. Its one warning is one log entry plus one `skipped` entry. The toast is a display echo of that warning: a session shows at most one toast for the same text, on the first scan that hits the fallback, so it never adds a second warning for a scan. The AC-15.7 lens test asserts that two legacy reads in one scan give one log entry and one `skipped` entry, and that a session shows at most one toast for the same text.
- **Old (spec:701, Delivery cell):** "002, 007, 008 (O-4)"
- **New:** see change 5.3 (AC-15.2 row: "[cli] 002, [hook] 007, [lens] 008; lens reading clarified in §9.2 (O-4 closed)").
- **Old (spec:784):** the O-4 row.
- **New:** O-4 leaves §17; the *Closed* line adds "O-4 by product-owner, 1.1.25 (D43; clarification of AC-15.2, §9.2)".
- **AC change:** none. AC-15.2's text (AC file:222) stands; this fixes how the lens meets it. It unblocks bolt 008.
- **Source:** 1.1.23 §6 Q4; product-owner 1.1.25 item 3 and 1.1.25.1 item 3; D43.

---

## 3. New AC (pending human acceptance at G3)

### 3.1 AC-16.6: a `windows-latest` CI job

- **Section:** AC file, FR-16 (after AC-16.5, AC file:243); spec §16 row 009 (spec:599); spec §16.1 (new row; total line spec:728).
- **Status:** **pending human acceptance at G3.** It is a scope addition to the frozen spec (about 0.25d). If the human does not accept it, nothing in this section is written.
- **New AC text (AC file, FR-16):**
  > - AC-16.6 (pending human acceptance at G3; product-owner, 1.1.27): `.github/workflows/validate.yml` has a job that runs on `windows-latest` and runs `node --test "tests/**/*.test.mjs"`, with the glob quoted. The bolt that adds it quotes the job's first run and its result. If that run shows tests that fail on Windows, fixing them is out of scope: the job keeps running `node --test` on the tests present at 009's merge, the bolt's hand-back reports the Windows failures, and `product-owner` decides the follow-up (1.1.27 item 4).
- **Numbering:** proposed as AC-16.6, under FR-16 next to the other repository-check ACs (AC-16.1, AC-16.5). Another FR is possible; the number does not change the delivery.
- **§16 row 009 (Scope cell, appended):** "a `windows-latest` job in `.github/workflows/validate.yml` running `node --test \"tests/**/*.test.mjs\"` (AC-16.6, pending human acceptance at G3)".
- **§16.1 new row:** `| AC-16.6 | §16 | 009 (pending human acceptance at G3) |`
- **§16.1 total (spec:728):** "All 104 ACs are mapped." becomes "All 105 ACs are mapped." if AC-16.6 is accepted; otherwise unchanged.
- **Story:** the architect attaches it to a 009 story, proposed engine/018 (1.1.27 §4). It is a story AC, not a DoD item.
- **Reason:** the migrate fixtures (012, 014) are where Windows behaviour matters (line endings, temp paths, git spawns), and CI is `ubuntu-latest` only, so the Windows claims are checked only on a developer machine. 009 already edits `validate.yml` and precedes 014; ITEM-124 runs too late.
- **Source:** system-engineer 1.1.24 §9 clarify 4; product-owner 1.1.27 item 4 (decision and the out-of-scope fallback); 1.1.29 §3 (unchanged, in 009).
- **Open for the human at G3 (from product-owner):** accept the AC; the assumption that the existing suite is green on Windows. Who decides: the bolt's hand-back reports any Windows failure, and `product-owner` decides the follow-up.

---

## 4. Split-design reconciliation (1.1.28 §5) and D42 effects (1.1.28 §6)

### 4.1 §4.2 G-FM: one grammar, one implementation in preview2

- **Old (spec:150):** "### 4.2 G-FM, the front-matter grammar (one grammar, three implementations)"
- **New:** "### 4.2 G-FM, the front-matter grammar (one grammar, one implementation in preview2)"
- **Old (spec:156):** "- **Lenient mode (hook and lens).** It never throws, ignores lines that are not `key: value`, and lets the last duplicate win."
- **New:**
  > - **Lenient mode** is for readers that must not fail. It never throws, ignores lines that are not `key: value`, and lets the last duplicate win. In preview2 only `workflow.mjs` implements G-FM, in strict and lenient modes. The hook (`parseRunState`) and the lens (`frontMatter`) keep their preview1 readers of run-state and record front matter; they read no bank file. A code base that starts reading bank-file front matter adopts G-FM and joins the vector set with a byte copy. The known differences (the lens lowercases keys; the hook strips no BOM) are recorded for ITEM-125.
- **Old (spec:158):** "- **Shared vectors.** One vector set lives in `tests/fixtures/grammar/front-matter.json`. Byte-identical copies sit in the hook's and the lens's test fixtures, and a drift test asserts that the copies are equal."
- **New:** "- **Vectors.** `tests/fixtures/grammar/front-matter.mjs`, canonical only, with no copies."
- **Reason:** no AC asks the hook or the lens to parse G-FM; three implementations would add two story parts, two vector copies and a drift pair for behaviour no AC tests. Vector files are `.mjs` modules because the hooks test runner loads code files only (precedent: the lens's `tests/fixtures/scrub-cases.mjs`).
- **Source:** 1.1.24 S-1, S-5; 1.1.24.1 F-1; software-architect 1.1.28 C-3, §3 S-1, §5 item 1; accepted by product-owner 1.1.29 §3.

### 4.2 §8.1 G-REC vectors and the hook file

- **Old (spec:290):** "`parseRecordName(name) → {code, from, to, type} | undefined` and `RECORD_TYPES` are implemented in three places: `workflow.mjs`, the auto-handoff hook (which replaces its `CODE` regex) and the lens (a new `record.ts` that replaces three regexes). The shared vectors live in `tests/fixtures/grammar/record-names.json`, with copies and a drift test. They must include every name the code accepts today."
- **New:**
  > `parseRecordName(name) → {code, from, to, type} | undefined` and `RECORD_TYPES` are implemented in three places: `workflow.mjs`, the auto-handoff hook (a new `record.ts` that replaces its `CODE` regex) and the lens (a new `record.ts` that replaces three regexes). The canonical vectors are `tests/fixtures/grammar/record-names.mjs`; byte copies sit in the hook's and the lens's `tests/fixtures/grammar/`, checked by the drift test (Test seams). The accept list is generated once from the record names that exist in `docs/handoffs/**` and `execution-plans/**` (every distinct shape, including `.l1.2` and `.h1` suffixes) and checked in as data, so it includes every name the code accepts today.
- **Source:** 1.1.24 §4; 1.1.24.1 (record names from `docs/handoffs/**`); software-architect 1.1.28 C-6 (`record.ts`, not `grammar.ts`), §5 item 2.

### 4.3 §9.1 Resolver: files, the per-key rule (D42), the mixed row, vectors

- **Old (spec:338):** "There is one pure function per code base:"
- **New:** "There is one pure function per code base: in `workflow.mjs`, and in a file `runs-root.ts` in the hook and in the lens (next to `record.ts`, §8.1). It is in a file of its own because it ends at 1.0.0 (§9.2)."
- **New (after spec:345, before the table):**
  > **Per-key rule (D42).** A key is legacy when its configured value's root is a legacy root in the §3 map; otherwise its rows are the preview2 rows, whatever the file-level layout.
- **No new table row.** The per-key rule (above) already gives a mixed block its outcome: a key whose configured value is a preview2 root uses the two preview2 rows (spec:349-350), even in a legacy-layout file (D42). Those rows give `ignored` for a non-empty `docs/handoffs` and none for an empty or absent one, the outcomes of the mixed block.
- **Old (spec:351):** "| legacy values | any | any | the configured value's root | `read` |"
- **New:** "| legacy values (the key's own value is a legacy root) | any | any | the configured value's root | `read` |"
- **New (after spec:357):** "The vectors are `tests/fixtures/grammar/runs-root.mjs`, canonical from bolt 002, with byte copies from 007 (hook) and 008 (lens). A node test recomputes their expected roots from `ARTIFACT_TYPES`, so the single old-to-new map (AC-1.6) reaches the TypeScript code through the vectors."
- **Reason:** D42 points this repository's `artifacts.handoffs` at `execution-plans/` and leaves six keys legacy. Without the per-key rule, a 007 or 008 build loaded here prints a false `read execution-plans` warning on every firing; with it, this repository gets the true `ignored docs/handoffs` warning until ITEM-121 (C-3). The resolver table is the largest behaviour implemented three times, and `fallback-warning` covers only the formatter.
- **Source:** 1.1.24 S-4; software-architect 1.1.28 C-4, §5 item 3, §6; D42. 1.1.28 §5 item 3 states the mixed block as one row with a conditional note; this delta writes it as the per-key sentence instead, because the existing preview2 rows already cover both outcomes.

### 4.4 §9.2 Warning: vectors, `MIGRATE_ENTRY`, the merge guard, files of their own

- **Old (spec:364-367):**
  > - **`entry` per channel (SA-C2):**
  >   - hook and lens: `/engine:migrate --dry-run`;
  >   - `workflow.mjs`: `node .ai-dlc/workflow.mjs migrate --dry-run (or the migrate skill)`.
  >   - The skill name is O-1.
- **New:**
  > - **`entry` per channel (SA-C2).** One `MIGRATE_ENTRY` constant per code base, holding the final name from its first commit, so 009 and 010 do not change it:
  >   - hook and lens: `/engine:migrate --dry-run`;
  >   - `workflow.mjs`: `node .ai-dlc/workflow.mjs migrate --dry-run (or the migrate skill)`.
  >   - The skill name is `migrate` (D39). Vectors use a placeholder `entry`, so the vector copies never change at the renames.
- **Old (spec:368):** "- **Vectors:** `tests/fixtures/grammar/fallback-warning.json`."
- **New:** "- **Vectors:** `tests/fixtures/grammar/fallback-warning.mjs`, each case with a `channel` (`cli`, `hook` or `lens`), because the entry text differs per channel; byte copies in the hook and the lens."
- **Old (spec:374):** "- **Marker.** Every legacy branch carries `// fallback: remove in 1.0.0` (`#` in non-JS files). AC-15.8 is checked with `grep -rn \"fallback: remove in 1.0.0\"`, and the 1.0.0 backlog item (ITEM-125) lists the files it finds."
- **New:**
  > - **Marker.** Every legacy branch carries `// fallback: remove in 1.0.0` (`#` in non-JS files). AC-15.8 is checked with `grep -rn "fallback: remove in 1.0.0"`, and the 1.0.0 backlog item (ITEM-125) lists the files it finds.
  > - **Files of their own.** Code that ends at 1.0.0 lives in files of its own where the code base allows (`runs-root.ts`, `engine-names.ts`; in `workflow.mjs`, one LEGACY section), so the sweep allowlist and ITEM-125 act per file.
- **Old (spec:375-376):**
  > - **Upgrade guards (SA-C3), enforced in code:**
  >   - `workflow.mjs merge` skips `artifacts` while the layout is legacy, and prints `artifacts: legacy layout — run migrate first`.
- **New:**
  > - **Upgrade guards (SA-C3), enforced in code:**
  >   - `workflow.mjs merge` skips `artifacts` while the layout is legacy, and prints `artifacts: legacy layout — run migrate first`. This `artifacts` merge guard is delivered by bolt 002: from the moment 002 gives the template 13 `artifacts` keys, a `merge` or `upgrade` on a legacy or mixed block (this repository, D42) would otherwise add `intents` and flip the layout before any file moves. The remaining guards and the `upgrade` split are delivered by 014.
- **Source:** 1.1.24 S-3; 1.1.24.1 F-7, R-13; software-architect 1.1.28 C-2, C-6, §3 R-13, §5 item 4; D39.

### 4.5 §10.2 Plan: the residue source and fixture F13

- **Old (spec:394-397):**
  > 1. **Detect.**
  >    - A preview2 layout with no legacy residue → "nothing to migrate", exit 0.
  >    - A legacy layout, or a preview2 layout with residue → build a plan.
  >    - No `workflow.json` → use the legacy defaults, and write no `workflow.json`.
- **New:**
  > 1. **Detect.**
  >    - **Residue** is a non-empty legacy default path of a key whose configured value is already its new path.
  >    - A preview2 layout with no residue → "nothing to migrate", exit 0.
  >    - A legacy layout, a mixed block (D42), or a preview2 layout with residue → build a plan.
  >    - No `workflow.json` → use the legacy defaults, and write no `workflow.json`.
- **Old (spec:398-401):**
  > 2. **Artifact moves.** The seven keys are processed in a fixed order.
  >    - `src = rootOf(file value ?? legacy default)` (AC-11.6); `dst = rootOf(bank)`.
  >    - When `src` equals `dst`, or `src` is absent → skip.
  >    - Overlapping sources → conflict `overlap`.
- **New:**
  > 2. **Artifact moves.** The seven keys are processed in a fixed order.
  >    - `src = rootOf(file value ?? legacy default)` (AC-11.6); `dst = rootOf(bank)`.
  >    - When `src` equals `dst`, the source is the legacy default instead, as residue; this applies AC-11.7 to a mixed block (D42). When that is absent or empty → skip.
  >    - When `src` is absent → skip.
  >    - Overlapping sources → conflict `overlap`.
- **New (bolt notes, carried in §16 row 012):** fixture F13, a mixed block with `docs/handoffs/` and `execution-plans/` both non-empty.
- **Reason:** under AC-11.6 as written, `src` equals `dst` for this repository's `handoffs`, so `docs/handoffs/` would never be migrated and ITEM-121's AC-11.10 would fail.
- **AC change:** none (AC-11.6 governs custom values; AC-11.7 already requires the merge).
- **Source:** software-architect 1.1.28 §5 item 5, §6; D42.

### 4.6 §16 rows (spec:589-603)

Each row's cells not named below are unchanged. "Old" quotes the row's Scope cell at the line given.

- **002 (spec:592).** Old Scope: "`ARTIFACT_TYPES`, schema, `boltTypes`, skip rule and `building`, `validate`, `artifacts`, G-FM with vectors; the `workflow.mjs` resolver and fallback warning with their vectors (§9); `init` scaffolding of `memory-bank/product/`, `memory-bank/project/` and `execution-plans/` (`.gitkeep`) with a preview2 `artifacts` block (AC-1.1, AC-8.2)". New Scope:
  > `workflow.mjs` made importable (`IS_MAIN`, exports; §2.3); `ARTIFACT_TYPES`, schema, `boltTypes` with `construction-bolt` and `simple-bolt` (§6.1), skip rule, the `building` flag and its validation (§6.2; the prose is 003's), `validate`, `artifacts`; G-FM with `front-matter.mjs` (§4.2); the `workflow.mjs` resolver with the per-key rule and fallback warning, with `runs-root.mjs` and `fallback-warning.mjs` (§9); the `artifacts` merge guard (§9.2); the drift test `tests/grammar-vectors-drift.test.mjs`; `tests/helpers/paths.mjs` with today's values, for new tests only (§11); `init` scaffolding of `memory-bank/product/`, `memory-bank/project/` and `execution-plans/` (`.gitkeep`) with a preview2 `artifacts` block (AC-1.1, AC-8.2). Merges before 003.
- **003 (spec:593).** Old Scope begins: "`docs-status` rewrite in its three copies (§14);". New Scope begins: "`docs-status` rewrite in its three copies (§14), including the building-stage prose by the `building` flag, with the preview1 sentence kept until ITEM-121 (§6.2); the same prose in `orchestrator.md`, `documentation-writer.md` and `write-documentation`;" and the rest is unchanged.
- **004 (spec:594).** Append to Scope: "`record-names.mjs` (canonical, §8.1); the `tests/herdr` fixture literals `docs/handoffs/` → `execution-plans/` (14 hits in 8 files, inside the AC-17.3 scope); reader-page run-folder text (R-9)."
- **005 (spec:595).** Old Scope: "`unit-design`, `bolt-design`, `probe`; PDLC, ASDLC and STBLC prose; agent text; bank templates for the intent files, unit brief, story and `bolt.md` (§4.1)". New Scope: "`unit-design`, `bolt-design`, `probe`, and `spike-bolt` (§6.1); PDLC, ASDLC and STBLC prose; agent text; bank templates (change 1.14 text); the AC-3.3 gate set as a stored fixture captured once from `47a3480` (Test seams). Merges after 004; does not edit `orchestrator.md` or `agent-invocation`."
- **006 (spec:596).** Append to Scope: "the leftover legacy-path files (§16 intro, *Legacy paths*)."
- **007 (spec:597).** Old Scope: "hook resolver, formatter, G-REC, pairing, plugin tests". New Scope: "`record.ts` (G-REC) and `runs-root.ts` (resolver, formatter, `MIGRATE_ENTRY`), byte copies of `record-names.mjs`, `runs-root.mjs` and `fallback-warning.mjs`; pairing; plugin tests. No G-FM (§4.2). Testable live on this repository (D42; change 4.11). May start once 004 is merged; does not edit `workflow.mjs`, the template or `orchestrator.md`."
- **008 (spec:598).** Old Scope: "lens resolver, `record.ts`, `detectRun`, verdict and escalation reading, the lens's legacy-path strings". New Scope: "`record.ts` and `runs-root.ts` (with `MIGRATE_ENTRY`), byte copies of the three vector files; `detectRun`, verdict and escalation reading, the toast rule of §9.2 (O-4 closed); the lens's legacy-path strings. No G-FM (§4.2). May start once 004 is merged; does not edit `workflow.mjs`, the template or `orchestrator.md`."
- **009 (spec:599).** Old Scope part: "`tests/helpers/paths.mjs` (`ENGINE_DIR`; `LENS_PLUGIN` and `LENS_DIR` at their old values)". New part: "the `ENGINE_*` values in `tests/helpers/paths.mjs` (§11); the literals in the engine-owned existing tests (12 files with static imports, plus the tests that assert names); the agent artifacts naming the old folder, through `agent-manager`: the `CLAUDE.md` dev setup, `.claude/rules/plugin-development.md` (twin by the harness sync), the `.claude/settings.json` permission with path `./plugins/claude/ai-dlc`, and `tools/validate.mjs`. `.claude/settings.json`'s `\"agent\"` and the `ai-dlc-agent-workflow` marketplace key are left to ITEM-121's `migrate` dogfood (AC-11.10); if spike (f) shows that an `\"agent\"` naming an unknown plugin agent breaks session start, 009 changes the `\"agent\"` line too and ITEM-121's hand-back records it." Plus the AC-16.6 text of change 3.1. The rest of the row, including "It edits no lens entry" and "the five lens skills sit under `plugins/claude/engine/skills/` until 010", is unchanged.
- **010 (spec:600).** Old Scope part: "`LENS_PLUGIN` and `LENS_DIR`)". New part: "`LENS_PLUGIN` and `LENS_DIR`); the literals in the lens-owned existing tests (`tests/lens-renderer/`, `tests/cache-reader/`); the lens lines of the files 009 changes, if any". Old Scope part: "pane ids `lens-*` with `LEGACY_PANE_IDS` (D33, D37); `LENS_STATE_NS = 'lens'`". New part: "`identity.ts` (`LENS_STATE_NS`, the pane ids `lens-*`), introduced with today's values first and flipped second; `LEGACY_PANE_IDS` in `engine-names.ts` (D33, D37); `LENS_STATE_NS = 'lens'`". Plus the change 2.2 text.
- **012 (spec:602):** replaced by two rows, change 5.1.
- **W6, ITEM-121 (spec:612).** Old: "- ITEM-121: dogfood migration, through the agent-artifact lifecycle;". New:
  > - ITEM-121: dogfood migration, through the agent-artifact lifecycle. It refreshes this repository's `.ai-dlc/workflow.mjs` and `workflow.schema.json` (no bolt does), runs `migrate` including the settings rewrite (`"agent"` and the marketplace key; AC-11.10), refreshes the `init` managed block (which removes the interim D42 sentence about `docs/handoffs/` runs from `AGENTS.md`), and moves `docs/follow-ups.md` (change 1.7);
- **Source:** software-architect 1.1.28 §5 item 6, C-1, C-2, C-4, C-5, C-6, C-7, §3 R-14, S-6, S-7; 1.1.24.1 F-8, F-10, R-14; product-owner 1.1.27 §2 (007/008 early start), 1.1.29 §3.

### 4.7 §12 Lens changes: file names (consequence of C-6)

Not named in 1.1.28 §5; needed so §12 agrees with change 4.8.

- **Old (spec:510):** "- **Resolver.** The lens uses `resolveRunsRoot` and `formatFallbackWarning` (§9), which replace `handoffsRoot`; it keeps `depth`."
- **New:** "- **Resolver.** The lens uses `resolveRunsRoot` and `formatFallbackWarning` (§9) from its `runs-root.ts`, which replace `handoffsRoot`; it keeps `depth`."
- **Old (spec:522, part):** "At load the lens closes any open pane whose id is in `LEGACY_PANE_IDS` (`ai-dlc-lens` and the five `ai-dlc-lens-*` ids), which extends today's `closeOldCard`; the list carries the fallback marker."
- **New (part):** "The pane ids live in `identity.ts`. At load the lens closes any open pane whose id is in `LEGACY_PANE_IDS` (`ai-dlc-lens` and the five `ai-dlc-lens-*` ids, in `engine-names.ts`), which extends today's `closeOldCard`; the list carries the fallback marker."
- **Old (spec:523):** "- **State namespace.** The lens's own atoms use `LENS_STATE_NS = 'lens'`; the shared keep-alive namespace follows spike (e)."
- **New:** "- **State namespace.** The lens's own atoms use `LENS_STATE_NS = 'lens'`, in `identity.ts`; the shared keep-alive namespace follows spike (e)."
- **Old (spec:525-529):**
  > - **Dual prefix (AC-17.11).** `hooks/engine-names.ts` exports:
  >   - `ENGINE_PLUGIN = 'engine'`;
  >   - `LEGACY_ENGINE_PLUGINS = ['ai-dlc']`, with the fallback marker;
  >   - `engineRole`, which strips either prefix;
  >   - `typeOfWorker`, which builds `engine:<id>`.
- **New:** the same five lines, with one bullet inserted after spec:529 (the `typeOfWorker` line): "  - `LEGACY_PANE_IDS`, with the fallback marker."
- **Source:** software-architect 1.1.28 C-6 (in the lens, 010 adds `identity.ts` for `LENS_STATE_NS` and pane ids, and `engine-names.ts` for the dual-prefix window and `LEGACY_PANE_IDS`).

### 4.8 Component boundaries

- **Old (spec:735):** "  - the `hooks/auto-handoff` and `hooks/keepalive` folders;"
- **New:** "  - the `hooks/auto-handoff` and `hooks/keepalive` folders, including the hook's `record.ts` and `runs-root.ts`;"
- **Old (spec:736):** "  - `tools/`, both marketplace files, `.github/workflows/validate.yml` and `tests/`, except the lens's two test folders."
- **New:** "  - `tools/`, both marketplace files, `.github/workflows/validate.yml` and `tests/`, except the lens's two test folders; the canonical vectors in `tests/fixtures/grammar/` (bolts 002 and 004) and the drift test."
- **Old (spec:740):** "  - its resolver, `record.ts`, `engine-names.ts`; answering `engine:cache-keepalive-lens`."
- **New:** "  - `record.ts`, `runs-root.ts`, `engine-names.ts` and `identity.ts`, and its copies of the vector files; answering `engine:cache-keepalive-lens`."
- **Source:** software-architect 1.1.28 §5 item 8.

### 4.9 Test seams

- **Old (spec:757):** "- **Shared grammar vectors** with drift tests (`tests/fixtures/grammar/`)."
- **New:**
  > - **Shared grammar vectors** as `.mjs` modules in `tests/fixtures/grammar/` (`front-matter`, `record-names`, `runs-root`, `fallback-warning`), with one convention-based drift test, `tests/grammar-vectors-drift.test.mjs` (bolt 002): it finds every `plugins/claude/*/**/tests/fixtures/grammar/*.mjs` and asserts that each byte-equals (LF-normalised) a canonical file. The hook and lens copies are checked against their code under `plugin test`.
  > - **`init` scaffolding** (AC-8.2[scaffold], AC-8.3): `init` is a skill an agent runs, so no test runs it. A static assertion that `init/SKILL.md` names the three folders and `.gitkeep`, plus a fixture repository on which `validate` exits 0. The end-to-end walk is ITEM-122's (AC-14.7).
  > - **AC-3.3 gate set:** a stored fixture, `tests/fixtures/preview1-gates.mjs`, captured once from `47a3480`; CI reads no git history (shallow checkout).
- **Source:** 1.1.24 S-6, §4; 1.1.24.1 F-4; software-architect 1.1.28 C-5, §3 S-6 and F-4, §5 item 9.

### 4.10 Data shapes and O-12

- **Old (spec:753):** "- Whether the `{data, error}` envelope applies to the new `--json` outputs is O-12."
- **New:** "- The new `--json` outputs are CLI reports and carry no `{data, error}` envelope (O-12, closed)."
- **§17:** the O-12 row (spec:790) leaves §17; the *Closed* line adds "O-12 by system-engineer, 1.1.24.1, confirmed by software-architect, 1.1.28".
- **Source:** 1.1.24.1; software-architect 1.1.28 §3, §5 item 10.

### 4.11 D42 effects carried in the spec

- **Hook and lens (row 007, row 008):** the preview1 hook and lens already take the runs root from `artifacts.handoffs`, so with D42 both can be tested live on this repository without a pre-rename checkout. Text in change 4.6 (row 007). The 1.1.23 self-hosting risk for run discovery is gone; it was never spec text, so the task plan's risk entry is updated by its author.
- **Resolver:** the per-key rule and the mixed row (change 4.3).
- **`migrate`:** the residue source and F13 (change 4.5).
- **Merge guard:** now protects this repository's mixed block too (change 4.4).
- **ITEM-121:** refreshes the `init` managed block (change 4.6, W6).
- **Still true:** 009 breaks the local install (`plugins/claude/ai-dlc` disappears); the human re-registers the marketplace at 009's merge. The `workflow.mjs` fallback warning prints here on every run until ITEM-121, as expected.
- **Order:** D42 forces no order change.
- **Source:** software-architect 1.1.28 §6; product-owner 1.1.27 §6, 1.1.29 §3; D42.

---

## 5. Bolt 012 split into 012 and 014 (product-owner 1.1.29; 14 bolts)

### 5.1 §16 row 012 replaced by two rows

- **Old (spec:602):** "| 012-engine-migrate | engine | construction-bolt (AAWP) | §10, `merge` guards, `upgrade` split, migration skill, AC-17.12 | ITEM-118; ITEM-126 (AC-17.10, AC-17.12) | 001 (hand-back accepted), 002, 009, 010 |"
- **New:**
  > | 012-engine-migrate-plan | engine | construction-bolt (AAWP) | §10.2 steps 1-3 and 6, §10.3: `planMigration` as an ordered list of planners (detect, artifacts, memory, settings, commit point) with the memory and settings planners present and empty; `applyPlan`; the dry run with the whole `migrate --dry-run --json` `kind` enum fixed here (including `memory-move`, `memory-merge`, `settings-rewrite`, `advice`); the residue rule (§10.2); fixtures F1-F6, F12, F13 | ITEM-118 (part a) | 002 |
  > | 014-engine-migrate-settings | engine | construction-bolt (AAWP) | §10.2 steps 4-5, §10.4: memory folders and `MEMORY.md` union, settings rewrite, the migration skill, detect-and-warn (AC-17.12), the `upgrade` split, the remaining `merge` guards; fixtures F7-F11. It fills the empty planners of 012 and never reorders them; it changes no dry-run shape 012's tests assert | ITEM-118 (part b); ITEM-126 (AC-17.10, AC-17.12) | 001 (hand-back accepted), 012, 009, 010 |
- **Bolt ids (C3, software-architect, step 1.1.30.2):** bolt ids are `{BBB}-{unit-slug}-{bolt-slug}` with a three-digit `BBB` (§4.1, AC-2.2), so "012a" and "012b" are not valid ids. The ids are `012-engine-migrate-plan` (was 012a) and `014-engine-migrate-settings` (was 012b). The id grammar and AC-2.2 do not change, because changing the grammar would reopen AC-2.2 and every id parser and its tests just to keep a label. Keeping 012 for the plan half is not a reuse: `012-engine-migrate` was never created as a bolt folder and is retired. Bolt numbers are identity, not order (013 already runs in W2), so 014 running in W5 is fine. In this delta and in every source it quotes, "012a" reads 012 and "012b" reads 014.
- **Mandatory conditions (bolt notes and lld):** (1) the planners are ordered and the memory and settings planners are present and empty in 012; (2) the whole `kind` enum is fixed in 012; (3) the requires are the two cells above (012 "002"; 014 "001 (hand-back accepted), 012, 009, 010").
- **Reason:** 012 was about 9d (7 to 12) with one failure budget, the costliest bolt to fail. The cut isolates the spike-sensitive half (findings (a) and (b)) in 014.
- **Source:** software-architect 1.1.28 §4 (cut and three conditions); product-owner 1.1.27 §3, 1.1.29 §1 (final, 14 bolts; requires replaced by the architect's).

### 5.2 Requires and Waves

- **Requires:** 012 "002"; 014 "001 (hand-back accepted), 012, 009, 010"; 011 "009, 010, 012, 014; after ITEM-121" (change 1.1). Other rows unchanged.
- **AC-17.14 reading (C1, product-owner, step 1.1.30.1; a clarification, no AC text change):** "the migration bolt" in AC-17.14 means bolt 014, the spike-dependent half. Bolt 012 requires only 002 and uses no spike finding (1.1.28 §4), so its W3 placement stands and 001 is not added to its Requires.
- **Old (spec:605-616):** the *Waves* list.
- **New:**
  > **Waves** (the task plan is the schedule of record; 14 bolts):
  > - W1: 001, 002 and 003, in parallel. Merge order: 002, then 003. The human's spike session is on days 1 to 2.
  > - W2: 013, 004 and 005. Merge order: 013, 004, 005.
  > - W3: 008, 007, 006 and 012, in that priority order.
  >   - 007 and 008 may start once 004 is merged; the wave label stays W3. They do not edit `workflow.mjs`, the template or `orchestrator.md`.
  >   - 012 is the only W3 bolt that edits `workflow.mjs`; it rebases onto 004 and 005. It never delays 009: if it has not merged when 009's `requires_bolts` are merged and the spike hand-back is accepted, it moves to W5 and runs before 014, rebasing onto the renames.
  > - W4: 009, then 010, with no other bolt open. The spike hand-back is accepted, and any spec revision from it applied, before 009 starts.
  > - W5: 014 (preceded by 012 when it fell back from W3).
  > - W6, intent-level work, in this order:
  >   - ITEM-121: dogfood migration (change 4.6 text);
  >   - 011: the sweep;
  >   - ITEM-122: TLC;
  >   - ITEM-123: the upgrade guide, release notes and AC-17.8 verification (change 1.8 text);
  >   - ITEM-124: release.
  > - Not scheduled: ITEM-120 (FR-13, P3; now covers `forgeline`, `engine` and `lens`, O-19) and ITEM-125 (1.0.0).
- **Source:** 1.1.23 §3, §4 R-1; 1.1.24 §1; 1.1.24.1 F-5; product-owner 1.1.27 §1, §2, §5, 1.1.29 §2 (W3 placement, priority and fallback).
- **Human-visible at G3 (product-owner):** 012 in W3 on the non-blocking rule; the assumption that W3 bolts run in parallel (if serial, 012 falls back to W5 at once).

### 5.3 §16.1 Traceability, full Delivery column after r1

Only rows whose Delivery cell changes are listed; every other row is unchanged. Bracketed names are AC parts (change 1.2).

| AC | Section | Delivery (new) |
|---|---|---|
| AC-1.5 | §2.2 | [contract] 002; [migrate] 012 |
| AC-1.6 | §3 | [map] 002; [hook] 007; [lens] 008; [migrate] 012 |
| AC-2.1 | §4.1 | [validate] 002; [templates] 005 |
| AC-2.2 | §4.1 | [validate] 002; [templates] 005 |
| AC-2.3 | §6.1 | [list] 002; [planning prose] 005; [build prose] 006 |
| AC-4.1 | §6.1 | [construction, simple] 002; [spike] 005 |
| AC-4.2 | §6.1 | [planning] 005; [build] 006 |
| AC-4.4 | §6.2 | [validate] 002; [spike] 005 |
| AC-6.5 | §8.4 | [contract] 004; [hook] 007; [lens] 008 |
| AC-8.2 | §2.3, §8.3 | [scaffold] 002; [name] 009 |
| AC-9.4 | §9 | [hook] 007; [lens] 008 |
| AC-9.5 | §9, §11 | [hook] 007; [lens] 008; [rename] 009 |
| AC-11.1 | §10.4 | [skill] 014; intent ITEM-123 (guide) |
| AC-11.2 to AC-11.9, AC-11.11 (each row) | as now | 012 |
| AC-12.3 | §13 | 013; DoD for every adapting bolt; full comparison closed by ITEM-122 |
| AC-15.1, AC-15.3 to AC-15.7 (each row) | as now | [cli] 002; [hook] 007; [lens] 008 |
| AC-15.2 | §9.2 | [cli] 002; [hook] 007; [lens] 008; lens reading clarified in §9.2 (O-4 closed) |
| AC-15.8 | §9.2 | [cli] 002; [hook] 007; [lens] 008; [lens-rename] 010; [detect] 014; ITEM-125 |
| AC-16.1 | — | DoD, every bolt; closed by ITEM-124 |
| AC-16.2 | §10.4, §11, §12 | [009] 009; [010] 010; [014] 014 |
| AC-16.3 | — | DoD, every bolt; closed by ITEM-122 |
| AC-16.4 | §11 | [009] 009; [010] 010; [011] 011 |
| AC-16.5 | — | DoD, every bolt; closed by ITEM-124 |
| AC-16.6 (new) | §16 | 009 (pending human acceptance at G3) |
| AC-17.1 | §11 | [engine] 009; [lens] 010 |
| AC-17.2 | §11 | [engine] 009; [lens] 010 |
| AC-17.5 | §11 | [engine] 009; [lens] 010 |
| AC-17.10 | §10.2 | 014 |
| AC-17.12 | §11 | 014 |
| AC-17.13 | §11, §12 | [keepalive-skill] 009; [lens] 010 |
| AC-17.14 | §16 | 001 (whole, engine; findings (c), (e), (h), (i) consumed by lens bolt 010) |

- **Total line (spec:728):** "All 104 ACs are mapped." → "All 105 ACs are mapped (26 split into parts; AC-16.1, AC-16.3 and AC-16.5 are the bolt DoD)." if AC-16.6 is accepted; otherwise "All 104 ACs are mapped (26 split into parts; AC-16.1, AC-16.3 and AC-16.5 are the bolt DoD)."
- **Check:** the parts above agree with the 1.1.23 §1 coverage list (story → bolt: e001 → 001; e002-e006 → 002; e007-e009 → 003; e010-e011 → 004; e012-e014 → 005; e015 → 006; e016-e017 → 007; l001-l003 → 008; e018-e020 → 009; l004-l006 → 010; e021 → 011; e022 → 012; e023-e024 → 014; e025 → 013) and with the product-owner's 012 split (1.1.29 delegation 1). The 26 split ACs are 1.5, 1.6, 2.1, 2.2, 2.3, 4.1, 4.2, 4.4, 6.5, 8.2, 9.4, 9.5, 15.1-15.7, 15.8, 16.2, 16.4, 17.1, 17.2, 17.5, 17.13. AC-11.1 has a skill part (014) and an intent part (ITEM-123); an intent part is not a bolt part, so AC-11.1 is not among the 26.
- **Source:** 1.1.23 §1 coverage check, §4 R-2; software-architect 1.1.28 §5 item 7; product-owner 1.1.29 delegation 1.

---

## 6. §17 after r1

- **Leave §17 (closed):** O-1, O-2 and O-3 (D39), O-4 (1.1.25, D43), O-5 (D41), O-6 and O-7 (D40), O-12 (1.1.24.1, 1.1.28), O-15 (D38: the human approved G2, which included the amended names).
- **Added:** nothing.
- **New *Closed* line (replaces spec:797):** "(Closed: O-16 and O-18 by D32; O-17 by D33, D37; O-20 by D34; O-22 by D35, D36; O-8, O-11 and O-24 by software-architect, step 1.1.22; O-14 by critique 1.5.l3.7; O-1, O-2 and O-3 by D39; O-5 by D41; O-4 by product-owner, 1.1.25 (D43); O-6 and O-7 by D40; O-12 by system-engineer, 1.1.24.1, confirmed in 1.1.28; O-15 by D38.)"
- **Grep result:** O-6 and O-7 occur in the frozen spec only in their §17 rows (spec:786, 787); no other spec line points at them. The spec's references to O-1, O-2, O-3, O-5 and O-15 are rewritten in change 7.3.
- **Source:** 1.1.28 §5 item 10; 1.1.25; D38, D39, D40, D41, D43.

---

## 7. Housekeeping (requirement-analyst, step 1.1.30, other findings)

Not part of the 1.1.23 or 1.1.28 lists. The spec was approved at G2 (D38) but its header and its §17 still say otherwise. Like every change in this delta, these are written to the frozen spec only when the human approves G3.

### 7.1 Spec front matter and status line (frozen)

- **Section:** spec front matter (spec:4) and the status paragraph under the title (spec:11).
- **Old (spec:4):** "status: draft"
- **New (spec:4):** "status: frozen"
- **Old (spec:11):** "**Planned (G2 pending):** nothing in this spec is built yet. It describes what preview2 will do, and it is a draft until the human approves G2."
- **New (spec:11):** "**Planned (G2 approved, frozen, D38):** nothing in this spec is built yet. It describes what preview2 will do. It is frozen and changes only through a revision delta (r1 is G3 pending)."
- **Reason:** D38: the human approved G2, which froze spec 001. The `docs-status` marker stays *planned*: no building stage has started.
- **Source:** requirement-analyst 1.1.30 (other findings); architect 1.1.23 (verification note); D38.

### 7.2 §17: O-1, O-2, O-3, O-5 and O-15 closed

Each row leaves §17. The decision is quoted from `.forgeline/execution-plans/AI-DLC-20261113-preview2-specsmd/decisions-2026-11-13.md`.

| Id | Old (spec §17 row) | Closed by |
|---|---|---|
| O-1 | "Name of the migration skill: `migrate` (`/engine:migrate`, as D32 writes it) or another" | D39: "migration skill **`/engine:migrate`**" |
| O-2 | "Identical duplicates in artifact moves: drop the legacy file, losing that path's history (memory folders are already decided by AC-17.10(e))" | D39: "identical legacy duplicates are **dropped** (printed as `drop`)" |
| O-3 | "D25 settles that the repository's two settings files are rewritten. Confirm that user-level and managed settings get advice only" | D39: "user-level and managed settings get **advice only**" |
| O-5 | "Confirm `/lens:init`, `/lens:kit` and `/lens:gate` (D32 lists them; earlier marked "to confirm at G2")" | D41: "lens commands **`/lens:show`, `/lens:configure`, `/lens:init`, `/lens:kit`, `/lens:gate`**" |
| O-15 | "The FRs and ACs carry the D30–D37 names (sweep 1.5.l3.3; the 1.1.22 fix pass) ..." (owner: human at G2; recommendation: approve the amended text at G2, a G1 amendment as D26) | D38: the human approved G2, which approved the amended text |

- **Reason:** §17 is titled "none decided by the human", but D39 and D41 decided four of these, and D38 (G2 approved) decided O-15. The text of §9.2 and §10 already follows D39 and D41 (the skill is `migrate`, D39, in change 4.4).
- **Source:** requirement-analyst 1.1.30 (other findings); D38, D39, D41.

### 7.3 Spec text that still points at closed items

The frozen spec keeps these references after 7.2. Each is rewritten when the human approves G3 (lines of the spec as approved at G2).

- **Old (spec:32, end):** "...; the human approves the amended text at G2 (O-15)."
- **New (spec:32, end):** "...; the human approved the amended text at G2 (D38)."
- **Old (spec:405):** "   - Both are files with identical content → `DROP` the source (O-2)."
- **New (spec:405):** "   - Both are files with identical content → `DROP` the source (D39)."
- **Old (spec:416, end):** "User-level and managed settings get `advice:` lines only (O-3)."
- **New (spec:416, end):** "User-level and managed settings get `advice:` lines only (D39)."
- **Old (spec:444):** "### 10.4 Migration skill (D25 decided; name open, O-1)"
- **New (spec:444):** "### 10.4 Migration skill (D25 decided; skill `migrate`, D39)"
- **Old (spec:475, Lens commands row, end):** "...(`init`, `kit` and `gate` confirmation: O-5) |"
- **New (spec:475, end):** "...(the five commands decided, D41) |"
- **Old (spec:479, Migration entry row, end):** "(D25, D32; skill name O-1) |"
- **New (spec:479, end):** "(D25, D32, D39) |"
- **Old (spec:792):** the O-15 row. **New:** the row leaves §17 (7.2).
- **Source:** critique 1.5.l4.2.1 (Blocker 1, Major 1); D38, D39, D41.
