---
spec: 001-preview2-specsmd
intent: 001-preview2-specsmd
status: draft
created: 2026-11-13
updated: 2026-11-14
---

# Spec 001: preview2 (memory bank, intents/units/bolts, execution plans with typed events, rename)

**Planned (G2 pending):** nothing in this spec is built yet. It describes what preview2 will do, and it is a draft until the human approves G2.

## 0. Names

| Thing | Name | Decision |
|---|---|---|
| Engine plugin | `engine`: install `engine@forgeline`, prefixes `engine:<id>` and `/engine:<skill>`, folders `plugins/claude/engine/` and `plugins/copilot/engine/`, memory folders `.claude/agent-memory/engine-<agent>/` | D32 |
| Lens plugin | `lens`: install `lens@forgeline`, commands `/lens:show\|configure\|init\|kit\|gate`, folder `plugins/claude/lens/` | D31, D32 |
| Lens pane ids | `lens-*`: `lens-kit`, `lens-edge`, `lens-agent`, `lens-chart`, `lens-runs` | D33, D37 (a pane id allows only letters, digits, `_` and `-`, so `lens:*` is written `lens-*`) |
| Marketplace | `forgeline`, in both marketplace files | D30 |
| Units | `engine`, `lens` | D27, D34 (confirmed by the human) |
| Family names (unchanged) | `.ai-dlc/` (including `.ai-dlc/lens.json`), `AI_DLC_*`, the managed-block markers `<!-- ai-dlc:… -->`, the `[ai-dlc fallback]` and `[ai-dlc:auto-handoff]` tags | D16, SA-R1 |
| Superseded, never shipped | `ai-dlc-engine` (D15), `ai-dlc-suite` (D21), and the planning name `ai-dlc-lens` for the renamed lens | D30–D32 |

**Status:** Draft for G2. It becomes Frozen when the human approves G2. After that, it changes only through `spec-driven-development` (revision deltas `001-preview2-specsmd.spec.r<N>-delta.md`).
**Release:** 1.0.0-preview2. This is a breaking release, and preview1 ships first (D7).
**Owners:**
- requirement-analyst (assembly);
- software-architect (contract, 1.1.14 and 1.1.20);
- system-engineer (low-level design, 1.1.19 and 1.1.19.1, as amended by 1.1.20 SA-K1 to SA-K5).
**Requirements:** `memory-bank/product/intents/001-preview2-specsmd/requirements.md` (FR-1 to FR-17).
**Acceptance criteria:** `acceptance-criteria.md` in the same folder (AC-1.1 to AC-17.14). Their names were amended to D30–D32 by sweep 1.5.l3.3, and to D33–D37 by the fix pass after step 1.1.22; the human approves the amended text at G2 (O-15).
**Human decisions:** D1 to D37.
**ADRs (proposed, G2):** ADR-0011 to ADR-0016 (1.1.20 §5). ADR-0015 takes the names in §0.

Wording used below:
- **decided** means a human decision (Dn), or a product-owner decision recorded in the AC file: the `C-n` under *Decided* (with a hyphen) and `R1` to `R10`.
- **SA- ids** (`SA-R1`–`SA-R5`, `SA-C1`–`SA-C5`, `SA-K1`–`SA-K5`) are the review ids of software-architect's hand-back 1.1.20: proposed design, never the AC file's `R1`–`R10` or `C-n`.
- **proposed** means an architect or system-engineer design that the human approves by approving G2.
- **open** means listed in §17 and not decided.

## 1. Overview

Today, run mechanics, product knowledge and reader documentation are all mixed under `docs/`. preview2:
1. moves lifecycle knowledge into `memory-bank/product|project/` (D2, D3, D10, D11);
2. makes intents, units, bolts and stories first-class constructs (FR-2 to FR-4);
3. moves run mechanics to `execution-plans/`, where the records are typed events checked by `validate`, with no runtime (D3, FR-5, FR-6);
4. makes `documentation-writer` the only writer of the bank (D2, FR-7);
5. keeps preview1 repositories working for one release, with a warning and a migration skill (D9, D25, FR-11, FR-15);
6. renames the `ai-dlc` plugin to `engine`, the `ai-dlc-lens` plugin to `lens` and the marketplace to `forgeline`, and moves five lens commands into `lens` (D19–D24, D28, D30–D32; FR-17).

Units (decided, D14 and D27): **engine** owns the contract. **lens** consumes it. The dependency goes one way in code: lens depends on engine, never the reverse.

## 2. Layout and `ARTIFACT_TYPES` (FR-1, FR-8)

### 2.1 Tree (decided: D2, D3, D10, D11; layout proposed)
`memory-bank/` has exactly two top-level folders, `product/` and `project/`, and nothing else at that level.

```
memory-bank/product/   intents/{NNN}-{intent-slug}/{requirements.md, acceptance-criteria.md, inception-log.md, units.md,
                                               units/{unit-slug}/{unit-brief.md, stories/, bolts/{bolt-id}/bolt.md}}
                       units.md · specs/ · decisions/ · narratives/ · glossary.md · briefs/
memory-bank/project/   backlog.md · out-of-scope/ · plans/ · research/ · quality/ · standards/
execution-plans/{LIFECYCLE}-{YYYYMMDD}-{feature-slug}/
docs/                  reader-facing only (README pages, docs/plugins.md, guides, release notes)
```

### 2.2 One home per artifact type (proposed)

| Artifact type | Path | `artifacts` key |
|---|---|---|
| Intent requirements, ACs, inception log, unit decomposition | `memory-bank/product/intents/{NNN}-{intent-slug}/requirements.md`, `acceptance-criteria.md`, `inception-log.md`, `units.md` | `intents` (new, required in preview2) |
| Unit registry | `memory-bank/product/units.md` | derived (no key) |
| Unit brief | `…/intents/{intent}/units/{unit-slug}/unit-brief.md` | derived |
| Story | `…/units/{unit-slug}/stories/{SSS}-{story-slug}.md` | derived |
| Bolt | `…/units/{unit-slug}/bolts/{bolt-id}/bolt.md` | derived |
| Frozen spec, revision delta | `memory-bank/product/specs/<slug>.spec.md`, `<slug>.spec.r<N>-delta.md` | `specs` |
| Low-level design | `memory-bank/product/specs/<slug>.lld.md` | `designs` (new, optional until 1.0.0) |
| ADR | `memory-bank/product/decisions/ADR-NNNN-<title>.md` | `decisions` |
| Architecture narrative | `memory-bank/product/narratives/<slug>.md` | `narratives` |
| Glossary | `memory-bank/product/glossary.md` | `glossary` (new, optional) |
| Preview1 briefs and stories | `memory-bank/product/briefs/` | `product` |
| Backlog | `memory-bank/project/backlog.md` | `backlog` |
| Out-of-scope records | `dirname(backlog)/out-of-scope/` | derived |
| Task plan (G3) | `memory-bank/project/plans/<slug>.tasks.md`; for intent work the slug is the intent folder, and the plan indexes the bolts | `plans` |
| Research notes, spike reports | `memory-bank/project/research/<slug>.md` | `research` (new, optional) |
| Test plan, test report, mutation report | `memory-bank/project/quality/<slug>/test-plan.md`, `test-report.md`, `mutation-report.md` | `quality` (new, optional) |
| Standards (reserved) | `memory-bank/project/standards/` | `standards` (new, optional) |
| Review reports, critiques, verification results | not in the bank: they are hand-back and verdict events in the run folder | `handoffs` |
| Run mechanics | `execution-plans/{LIFECYCLE}-{YYYYMMDD}-{feature-slug}/` | `handoffs` |
| Reader-facing docs | unchanged under `docs/` and README files (D11) | none |

### 2.3 `ARTIFACT_TYPES` (proposed; one table in `workflow.mjs`)
- **Columns.** One row per key, 13 keys: `key`, `kind` (`file`|`folder`), `area` (`product`|`project`|`runs`), `legacy` (the preview1 default or `null`), `bank` (the preview2 default) and `required`.
- **Values of `required`:**
  - `legacy`: the seven keys `backlog`, `product`, `specs`, `decisions`, `narratives`, `plans`, `handoffs`, required in both layouts;
  - `preview2`: `intents`;
  - `1.0.0`: `designs`, `glossary`, `research`, `quality`, `standards`, optional until 1.0.0.
- **Who reads it.** The table is read by `validate`, `migrate`, the resolver (§9) and the AC-8.1 key-equality test. The workflow schema `artifacts.properties` and the plugin template carry the same 13 keys.
- **Schema.** `required` stays the seven legacy keys. `intents` is enforced through a draft-07 `if/then`. `additionalProperties: false` stays.
- **Layout detection.** The layout is `preview2` when `artifacts.intents` is a string, otherwise `legacy`.
- **`validate` on a legacy layout.** Only the seven keys are checked, and the new keys are optional (AC-8.4). The fallback warning goes to stderr, and the exit code does not change.
- **`validate` on a preview2 layout.**
  - The seven keys plus `intents` are required.
  - An unknown key is an error.
  - Area rule: a `product` or `project` key starts with `memory-bank/<area>/`, and `handoffs` is not under `memory-bank/` (AC-8.5, AC-1.4).
  - Overlap rule: no two keys share a root, and no root is a prefix of another. The one exception is file patterns in the same folder with different literal suffixes (`.spec.md` and `.lld.md`).
  - `rootOf(value)` is the path segments before the first segment that contains `{` or `<`, with forward slashes, no leading `./` and no trailing `/`. The engine, the hook and the lens implement the same rule.
- **Missing folders (C-4, proposed).** `validate` checks keys and paths only, never that a folder exists on disk. `init` creates the folders.
- **New read-only command:** `node .ai-dlc/workflow.mjs artifacts [--json]` prints, for each key, the key, kind, resolved path, layout and root.
- **Error cases:**
  - an unknown key: `error`, exit 1;
  - a bank key outside `memory-bank/<area>/`: `error`, exit 1;
  - `handoffs` under `memory-bank/`: `error`, exit 1;
  - overlapping roots: `error`, exit 1;
  - a preview2 layout missing a required key: `error`, exit 1;
  - a hand-added `intents` with legacy values: an area error whose message names `migrate`.
- **Size.** `workflow.mjs` stays one installed file. Its sections are ordered grammar, artifacts, validate, migrate. It is split into `lib/` once it passes about 1,500 lines.

## 3. Old-to-new path map (FR-1, AC-1.6; proposed)

| Key | preview1 | preview2 |
|---|---|---|
| backlog | `docs/backlog/backlog.md` | `memory-bank/project/backlog.md` |
| product | `docs/product/` | `memory-bank/product/briefs/` |
| specs | `docs/specs/<feature-slug>.spec.md` | `memory-bank/product/specs/<feature-slug>.spec.md` |
| decisions | `docs/architecture/decisions/` | `memory-bank/product/decisions/` |
| narratives | `docs/architecture/narratives/<feature-slug>.md` | `memory-bank/product/narratives/<feature-slug>.md` |
| plans | `docs/plans/<feature-slug>.tasks.md` | `memory-bank/project/plans/<feature-slug>.tasks.md` |
| handoffs | `docs/handoffs/{LIFECYCLE}-{YYYYMMDD}-{feature-slug}/` | `execution-plans/{LIFECYCLE}-{YYYYMMDD}-{feature-slug}/` |

- A key's root moves whole, including files the tools do not know.
- With custom preview1 values, the source is the file's own value (AC-11.6).
- Out-of-scope records follow `dirname(backlog)`.
- `migrate` (§10) and the resolver (§9) both use this one map, through `ARTIFACT_TYPES`.

## 4. Ids, names, front matter and G-FM (FR-2; proposed)

### 4.1 Ids and required front matter
| Construct | Id format = name | Example | Required front matter |
|---|---|---|---|
| Intent | `{NNN}-{intent-slug}`, global; it is the folder name | `001-preview2-specsmd` | `requirements.md`: `intent, status, created, updated` |
| Unit | `{unit-slug}` from `memory-bank/product/units.md`, no number; it is the folder name (D27, ADR-0016) | `engine` | `unit-brief.md`: `unit, intent, status, default_bolt_type, created, updated` |
| Story | `{SSS}-{story-slug}`, numbered per unit; it is the file stem; the full reference is `<unit>/<SSS>` | `003-fallback-warning` (`engine/003`) | `id, unit, intent, status, priority (must\|should\|could), bolt, created` |
| Bolt | `{BBB}-{unit-slug}-{bolt-slug}`, a global three-digit number, never reused; it is the folder name (AC-2.2) | `004-engine-events` | `id, unit, intent, type, status, stories [..], requires_bolts [..], enables_bolts [..], created`; optional `current_stage`, `stages_completed [stage ids]`, `time_box` |

- `stages_completed` is a flat inline list of stage ids, for example `[build, tests]` (SA-R2).
- The artifacts of each stage are linked from a *Stages* table in the body of `bolt.md`, with the columns stage, step code and artifact path.

### 4.2 G-FM, the front-matter grammar (one grammar, three implementations)
- **Block.** The block starts at byte 0, after an optional BOM. It is `---`, then `key: value` lines, then `---`. Lines may end in LF or CRLF.
- **Keys** match `^[a-z][a-z0-9_-]*$`.
- **Values** are trimmed, and a trailing `\s+#.*$` is removed.
- **Lists.** An inline list `[a, b]` becomes `string[]`, and `[]` is an empty list. There is no nesting and no quoting.
- **Signature:** `parseFrontMatter(text, {strict}) → { found, data: Record<string, string|string[]>, errors: {line, message}[] }`.
- **Lenient mode (hook and lens).** It never throws, ignores lines that are not `key: value`, and lets the last duplicate win.
- **Strict mode (`validate`).** It reports malformed lines and duplicate keys as `{line, message}`.
- **Shared vectors.** One vector set lives in `tests/fixtures/grammar/front-matter.json`. Byte-identical copies sit in the hook's and the lens's test fixtures, and a drift test asserts that the copies are equal.
- **Front-matter checks in `validate` (C-5, proposed, narrow), preview2 layout:**
  - each id equals its folder name or file stem;
  - `status` is one of the values in §5;
  - a bolt's `type` is a key of `boltTypes`.
  - Cross-references between files are left to templates and review.

## 5. Status model (FR-2, AC-2.4 to AC-2.6; proposed)

- **One vocabulary** for intents, units, stories and bolts: `draft | ready | in-progress | blocked | done | cancelled`.
- **`ready`** means the construct's gate passed: G1 for an intent, G2 for units and stories, G3 for a bolt.
- **`done`** means engineering done and knowledge done (FR-7, §14).
- **docs-status mapping:**
  - `draft` and `ready` → *planned*;
  - `in-progress` and `blocked` → *in progress*;
  - `done` → no marker;
  - `cancelled` → the text is removed.
- **Which record wins:**
  1. The current run state is authoritative for every id it records: its `intent`, `units` and `bolts` keys and its Stages table.
  2. Bank front matter is a projection that `documentation-writer` writes. It wins only for ids that no run records.
  3. The backlog comes last.
  - A disagreement between them is a docs-status finding.
- **Cascade statuses** are computed, never stored.
- **Worked example.** Run `FDLC-20261201-events` has bolt `004-engine-events`. In its run state, `software-engineer` is `done` and `code-reviewer` is `pending`, but `bolt.md` says `done`.
  - The effective status is `in-progress`.
  - The reviewer raises a finding.
  - `documentation-writer` corrects `bolt.md` after G4 and the critique.

**specsmd inconsistencies and how preview2 resolves them (AC-2.6):**

| specsmd inconsistency | preview2 resolution |
|---|---|
| Bolt id vs folder | The id is the folder name |
| Three bolt types documented, one known to the scripts | One list, in `boltTypes` |
| Story statuses vs scripts that write `complete` | One vocabulary; "implemented" and "tested" become run-state stage progress |
| Front matter vs scripts as the status source | The run state wins |
| Stored cascade statuses | Computed, not stored; `inception-complete` is dropped |
| Additions | `default_bolt_type` on the unit brief; a global `BBB` |

## 6. Bolt types, the skip rule, `building`, and new stages (FR-3, FR-4; proposed; SA-K1 to SA-K4)

### 6.1 `boltTypes` (a new top-level key in `workflow.json`; optional in preview2, required from 1.0.0)
- **Shape:**
  - `"<type-id>": { "description": string, "producesCode"?: false, "lifecycles": { "<LIFECYCLE>": "*" | [stageId, …] | { "stages": [stageId, …], "after": { "<stageId>": [stageId, …] } } } }`
- **Owners and artifacts** come from the lifecycle stage (`agent`, `produces`), so `workflow.mjs show` answers AC-4.1.

| Type | Lifecycle → stages (stage ids checked against the template) |
|---|---|
| `construction-bolt` | FDLC `*` (`build, ui-tests, tests, docs, architecture-review, review`) · AAWP `[design, lld, change, test, code-review, docs, critique]` · RLC `*` |
| `simple-bolt` | FDLC `[build, ui-tests, tests, review]` · AAWP `[change, test, code-review, docs, critique]` · AAWH `[change, docs, critique]` · BFLC `*` |
| `spike-bolt` (`producesCode: false`) | ASDLC `{ stages: [research, probe, architecture], after: { architecture: [research, probe] } }` |

### 6.2 Rules
- **Skip rule (SA-K4).** A lifecycle stage that is not in the bolt type is skipped in the same way as a stage whose `when` does not hold. The skip is recorded in the handoff, and dependent stages proceed.
- **Order.** Stages run in the order of the lifecycle's `after` edges, plus the type's `after` override. There is no array-order rule.
- **`when`** conditions inside the subset still apply.
- **AAWP `intent`** is outside both AAWP types.
- **New stage flag `building: true`.** It is set on FDLC `build`, BFLC `fix`, RLC `refactor`, AAWH `change` and AAWP `change`. It replaces the prose definition of "the building stage" (`software-engineer` in FDLC, BFLC, RLC and AI-DLC; `agent-manager` in AAW) in the `docs-status` rule and its copies (`docs-rules` templates, `orchestrator.md`, `documentation-writer.md`, `write-documentation`). No code constant exists today.
- **`validate` checks on `boltTypes`:**
  - the type id matches `ID`;
  - every lifecycle key and stage id exists;
  - no stage appears twice;
  - each type has at least one stage;
  - override keys and values are inside the subset, and the overrides are acyclic;
  - a `producesCode: false` type contains no `building: true` stage (AC-4.4);
  - types a project adds are accepted.
- **AC-2.3 grep test.** Every bolt-type id found in `plugins/claude/engine/` text is a key of `boltTypes`.
- **Differences from specsmd (AC-4.3):**
  - the domain model and technical design fold into `lld`;
  - the ADR stage is optional through `when`;
  - construction adds review and critique;
  - "ddd" is dropped;
  - `spike-bolt` keeps its id;
  - the spike time-box becomes the optional `time_box` on the bolt.

### 6.3 New stages. No gate is added or removed (AC-3.3)

**`unit-design`**
- Lifecycle: ASDLC.
- Owner: `software-architect`.
- `critique: true`, `after: []`, `when`: the run plans an intent.
- Produces `units.md` and the unit briefs, plus stories through `requirement-analyst`.
- Template change: `architecture.after = ["unit-design"]`. It feeds G2.
- `validate` warns on a merged project whose `architecture.after` lacks `unit-design`.

**`bolt-design`**
- Lifecycle: STBLC, after `split-design` and before `estimate`.
- Owner: `software-architect`, consulting `product-manager`.
- `critique: true`, `when`: the run plans an intent.
- Produces the `bolt.md` files and the bolt index in `plans/<intent>.tasks.md`. It feeds G3.

**`probe`** (decided: D29)
- Lifecycle: ASDLC.
- Owner: `software-engineer`.
- `after: []`, `when`: a decision depends on behaviour that only a live run shows.
- It writes only under `.scratch/`. The commands and their real output are quoted in a research note, written by `documentation-writer`.
- It is not a `building` stage. A tracked file in its change set is a Blocker.

## 7. `execution-plans/` and the execution plan (FR-5; proposed; C-6 decided)
- **One folder per run:** `execution-plans/{LIFECYCLE}-{YYYYMMDD}-{feature-slug}/`. It holds:
  - `execution-plan.md`;
  - `run.v*.md`;
  - the event records (§8);
  - `session-<n>.md` session handoffs, which move here from `.scratch/<run>/`.
- **`execution-plan.md`** is written by the orchestrator before the first spawn.
  - Front matter: `run, lifecycle, mode, intent, units [..], bolts [..], created, events: 1`.
  - Required sections, in order:
    1. Scope;
    2. Routing Plan;
    3. Bolts (columns: bolt, type, unit, stories, stages after the skip rule, step root);
    4. Stages and waves;
    5. Gates and approvers;
    6. Loops and limits;
    7. Re-plans (append-only).
- **Run state** gains the keys `intent`, `units` and `bolts`.
- **Documents that name `execution-plans/`** as the home of the execution plan, the records, the run-state versions and the session handoffs (AC-5.2): the `handoff` skill, `agent-invocation`, the orchestrator body and the generated `AGENTS.md` template.
- **`.handoff/config.md`** (C-14, proposed): bolt 004 deletes it. No engine file reads it or `handoff_dir` (AC-5.5).

## 8. Events, G-REC, `event.schema.json` and the `events` command (FR-6; proposed; C-8)

### 8.1 Records are the events (ADR-0011)
One record file is one event, Markdown with G-FM front matter.

```
record = CODE "-" AGENT "-to-" AGENT "." TYPE ".md"
CODE   = NUM *("." NUM) *(".l" NUM *("." NUM)) ["." "h" NUM]
AGENT  = [a-z][a-z0-9]*(-[a-z0-9]+)*     ; an agent id or "human"; no "-"-separated part equals "to"
TYPE   = handoff | handback | verdict | command | escalation
```

Implementations check AGENT with `^(?!(?:.*-)?to(?:-|$))[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`, and `validate` rejects an `agents.custom` id with a `to` part, so the first `-to-` after CODE is always the separator.

`parseRecordName(name) → {code, from, to, type} | undefined` and `RECORD_TYPES` are implemented in three places: `workflow.mjs`, the auto-handoff hook (which replaces its `CODE` regex) and the lens (a new `record.ts` that replaces three regexes). The shared vectors live in `tests/fixtures/grammar/record-names.json`, with copies and a drift test. They must include every name the code accepts today.

### 8.2 Types and when the orchestrator writes each one (AC-6.6)
| Type | Meaning | Written |
|---|---|---|
| `handoff` | A brief that transfers work. Addressed `to: human`, it is a gate record | before every spawn, by the sender |
| `handback` | The receiver's verbatim report, with front matter prepended by the orchestrator | when the agent returns |
| `verdict` | A gate decision: `{code}-{human\|orchestrator}-to-orchestrator.verdict.md`. Approver `none` writes no verdict | at each gate with approver human or orchestrator |
| `command` | Control without a work transfer | when the orchestrator issues fix, stop, resume, raise-limits or re-plan |
| `escalation` | To `human`: a loop or clarify limit is reached, the work is blocked, or the intent is unclear | when that occurs |

- **Pairing:**
  - a handoff is answered by a handback;
  - a handoff to `human` is answered by a verdict;
  - an escalation is answered by a verdict;
  - commands and verdicts are never answered.
- **Reviewer verdicts** stay as fields in hand-backs.

### 8.3 Front matter
| Event | Required fields and allowed values |
|---|---|
| all | `event, step, run, from, to, date` (`YYYY-MM-DD`). `event` equals the file TYPE; `step`, `from` and `to` equal the file name; `run` equals the run folder name |
| `handoff` | `stage`, `verification` (`pending\|passed\|failed`) |
| `handback` | `in-reply-to`, `result` (`passed\|failed`) |
| `verdict` | `subject`, `decision` (`approved\|rejected`), `approver` (`human\|orchestrator`). An escalation's verdict is followed by a `command` (`raise-limits`, `stop` or `resume`) that carries the action |
| `escalation` | `reason` (`loop-limit\|clarify-limit\|blocked\|intent`) |
| `command` | `action` (`fix\|stop\|resume\|raise-limits\|re-plan`). The list is closed and is extended only through the schema |

- **`.ai-dlc/event.schema.json`** is a draft-07 schema that `init` installs (AC-6.1).
- **`EVENT_RULES`** in `workflow.mjs` enforces the same rules. A drift test asserts that the schema's `oneOf` equals `EVENT_RULES`.

### 8.4 Validation scope and the `events` command
- **Opt-in per run.** A run is checked when its `execution-plan.md` has `events: 1` in its front matter; the run state does not carry the flag. Every `*.{handoff,handback,verdict,command,escalation}.md` file in that run must then validate. Migrated history is never checked (AC-11.2).
- **Failure (AC-6.3).** The output is `error: <relative path>: <field>: <message>`, and the exit code is 1.
- **New read-only command:** `node .ai-dlc/workflow.mjs events [--run <folder>] [--json]` prints `{file, code, from, to, type, frontMatter, errors[]}` per record. `validate` uses the same function.
- **No runtime (AC-6.5).** Nothing watches, schedules or acts on events.
- **Hook, additive.**
  - `answerOf` covers the pairing rules.
  - Open work no longer counts `-to-human.escalation.md`.
- **Lens, additive.**
  - The lens also reads `verdict`, `escalation` and any record addressed to `human`.
  - New anomalies, raised only for runs with event files:
    - `gateWaiting`: the newest record to `human` has no later same-code `.verdict.md`;
    - `gateRejected`: a `.verdict.md` has `decision: rejected`.

## 9. Fallback resolver and warning (FR-15; proposed; C-2 and C-3 decided)

### 9.1 Resolver
There is one pure function per code base:

```
resolveRunsRoot({ workflowJson?: string|null, nonEmptyDir(path): boolean })
  → { root: string, layout: 'legacy'|'preview2', notes: { kind: 'read'|'ignored', legacy: string, current: string }[] }
```

A directory counts as present only when it has at least one entry (SA-R4).

| workflow.json | new dir | `docs/handoffs` | root | notes |
|---|---|---|---|---|
| preview2 | configured | non-empty | configured | `ignored` |
| preview2 | configured | empty or absent | configured | none |
| legacy values | any | any | the configured value's root | `read` |
| none or invalid | `execution-plans` non-empty | non-empty | `execution-plans` | `ignored` |
| none or invalid | `execution-plans` non-empty | no | `execution-plans` | none |
| none or invalid | no | non-empty | `docs/handoffs` | `read` |
| none or invalid | no | no | `execution-plans` | none (the hook answers `owned:false`) |

For bank types, `workflow.mjs` applies the same rule per `ARTIFACT_TYPES` key.

### 9.2 Warning
- **Formatter:** `formatFallbackWarning(notes, entry) → string | undefined`. It returns `undefined` when there are no notes (AC-15.5). Otherwise it returns exactly one line, with the roots aggregated:

  `[ai-dlc fallback] legacy layout (fallback ends in 1.0.0): read <legacy> (new: <new>)[; ignored <legacy>]. Migrate: <entry>`

- **`entry` per channel (SA-C2):**
  - hook and lens: `/engine:migrate --dry-run`;
  - `workflow.mjs`: `node .ai-dlc/workflow.mjs migrate --dry-run (or the migrate skill)`.
  - The skill name is O-1.
- **Vectors:** `tests/fixtures/grammar/fallback-warning.json`.
- **Once per invocation:**
  - `workflow.mjs` collects notes at module level, and one exit handler writes them to stderr. The exit code never changes.
  - The hook warns once per firing, through its existing non-blocking notice channel: a log line, a `warn` panel step, and a toast where the band is not drawn.
  - The lens collects notes per scan and writes at most one note to its log and to the `skipped` list that the bare `/lens:gate` shows. Its toast is deduplicated by text per session (O-4).
  - The warning never blocks.
- **Marker.** Every legacy branch carries `// fallback: remove in 1.0.0` (`#` in non-JS files). AC-15.8 is checked with `grep -rn "fallback: remove in 1.0.0"`, and the 1.0.0 backlog item (ITEM-125) lists the files it finds.
- **Upgrade guards (SA-C3), enforced in code:**
  - `workflow.mjs merge` skips `artifacts` while the layout is legacy, and prints `artifacts: legacy layout — run migrate first`.
  - The order is: new tooling, then `migrate`, then `workflow upgrade` (template keys only), then the `init` managed-block refresh.
  - `validate` passes on a legacy layout with the warning.

## 10. `migrate` command and the migration skill (FR-11, FR-17; proposed; D25 decided)

### 10.1 Command
- **Synopsis:** `node .ai-dlc/workflow.mjs migrate [--dry-run] [--json] [--root <dir>] [--file <path>] [--plugin <dir>]`.
- **Exit codes:**
  - 0: migrated, or a dry run with no conflict;
  - 1: conflicts;
  - 2: usage error, or not a git repository.
- **Structure.**
  - `planMigration(ctx) → Plan` is pure, over `{exists, isDir, list, read}`.
  - `applyPlan(plan, io)` does the writes.
  - All conflicts are reported before any write (AC-11.5).

### 10.2 Plan, in order
1. **Detect.**
   - A preview2 layout with no legacy residue → "nothing to migrate", exit 0.
   - A legacy layout, or a preview2 layout with residue → build a plan.
   - No `workflow.json` → use the legacy defaults, and write no `workflow.json`.
2. **Artifact moves.** The seven keys are processed in a fixed order.
   - `src = rootOf(file value ?? legacy default)` (AC-11.6); `dst = rootOf(bank)`.
   - When `src` equals `dst`, or `src` is absent → skip.
   - Overlapping sources → conflict `overlap`.
3. **`planMove(src, dst)`.**
   - `dst` absent → `MOVE`.
   - Both are folders → recurse (AC-11.7).
   - Both are files with identical content → `DROP` the source (O-2).
   - Both are files with different content → `CONFLICT {path, target}`.
   - A folder against a file → `CONFLICT kind-mismatch`.
   - Reader-facing docs are never a source (AC-11.8).
4. **Memory folders.**
   - For each catalog agent id: `.claude/agent-memory/ai-dlc-<id>/` → `.claude/agent-memory/engine-<id>/`. The name comes from `catalog.plugin.name`, built in one function, so spike (a) can change the pattern.
   - Project-local and non-plugin `ai-dlc-*` folders are untouched.
   - A trivial destination (no files, or an empty `MEMORY.md`) counts as absent.
   - Same-name files: identical → deduplicated; different → conflict naming both paths.
   - `MEMORY.md` lines are merged as a union (AC-17.10(e), SA-K5; algorithm O-9).
5. **Settings rewrite.**
   - Only `.claude/settings.json` and `.claude/settings.local.json` are rewritten. An absent file is skipped without error. User-level and managed settings get `advice:` lines only (O-3).
   - The rewrite is textual, so comments survive. It has two kinds of rule:
     - **Whole-string rules** match one complete JSON string token, quotes included:
       - `"ai-dlc@ai-dlc-agent-workflow"` → `"engine@forgeline"`;
       - `"ai-dlc-lens@ai-dlc-agent-workflow"` → `"lens@forgeline"` (AC-17.10(g) as amended, O-10);
       - the `extraKnownMarketplaces` key `"ai-dlc-agent-workflow"` → `"forgeline"`; a `repo` value `…/ai-dlc-agent-workflow-plugin` is never a whole token, so it is untouched.
     - **Prefix rules** match inside string content, with `(?<![\w-])` before and `(?![\w-])` after the whole name, longest name first:
       - lens commands first, by exact map: `ai-dlc:lens-keepalive` → `engine:cache-keepalive-lens` (D28), `ai-dlc:lens-configure` → `lens:configure`, `ai-dlc:lens-init` → `lens:init`, `ai-dlc:lens-kit` → `lens:kit`, `ai-dlc:lens-gate` → `lens:gate`, `ai-dlc:lens` → `lens:show`;
       - then `ai-dlc:<id>` → `engine:<id>` for catalog agent and skill ids. This covers `"agent"` (`"ai-dlc:orchestrator"` → `"engine:orchestrator"`) and permission entries such as `"Skill(ai-dlc:init)"`.
   - **Other marketplaces.** A key or value naming plugin `ai-dlc` or `ai-dlc-lens` of a marketplace other than `ai-dlc-agent-workflow` (detected as a JSON string `(ai-dlc|ai-dlc-lens)@<marketplace>` whose `<marketplace>` is not `ai-dlc-agent-workflow`; for example `"ai-dlc@<other>"`; `ai-dlc` is also TheBushidoCollective's plugin, ADR-0015) is never rewritten: `migrate` prints one `advice:` line naming the file, key and value. While such a key is in a file, the prefix rules are not applied to that file; each `ai-dlc:<id>` hit there is printed as `advice:`.
   - After the replacement the text must still parse. If it does not, the file is left untouched and a conflict is reported.
   - **Leftover hits.** After the rewrite, any remaining `ai-dlc-agent-workflow` or `ai-dlc@` inside a string (for example `Bash(claude plugin install ai-dlc@ai-dlc-agent-workflow)`) is not rewritten; `migrate` prints one `advice:` line for it naming the file, key and value.
6. **Commit point.** The `artifacts` of `workflow.json` are rewritten to the preview2 keys last, through a temporary file and a rename.

### 10.3 Apply and dry run
- **Apply.**
  - Parent folders are created as needed.
  - Tracked paths move with `git mv`, untracked ones with a rename.
  - `DROP` uses `git rm -q`, or a delete for untracked files.
  - Emptied source folders are removed.
  - Nothing is committed.
- **Dry run (AC-11.11, AC-17.10(f)).**
  - It prints one line per `move`, `merge`, `drop`, `memory`, `settings`, `workflow` and `conflict` action, then a summary.
  - `--json` prints `{actions, conflicts}`.
  - It writes nothing, and it exits non-zero only when there is a conflict.
- **Idempotence.** A second run changes nothing (AC-11.4, AC-17.10(d)).
- **Single-writer exemption.** Pure moves and `init` `.gitkeep` files are exempt from the single-writer rule (product-owner, 1.1.17).

### 10.4 Migration skill (D25 decided; name open, O-1)
- **Location:** `plugins/claude/engine/skills/migrate/SKILL.md`.
- **Invocation:** `/engine:migrate [--dry-run]` in Claude Code, `/migrate` in Copilot.
- **Frontmatter:** `disable-model-invocation: true`.
- **Platforms.** It is not Claude-only, so it ships to Copilot.
- **What it runs:** `node ${CLAUDE_SKILL_DIR}/../workflow/templates/workflow.mjs migrate --root . --plugin ${CLAUDE_SKILL_DIR}/../.. [--dry-run] [--json]`.
- **Flow:**
  1. Read-only preconditions: the folder is a git repository; report staged or untracked files under the legacy roots.
  2. Run `--dry-run --json` and show the plan grouped: moves, merges and drops with counts; memory folders; settings before and after, naming both files; the `workflow.json` change.
  3. If there are conflicts, stop and list each one. Nothing is written.
  4. A `--dry-run` invocation stops here.
  5. Ask for one consent that names the two settings files. User-level settings are shown as advice.
  6. Install the new tooling (`workflow.mjs`, `workflow.schema.json`, `event.schema.json`) and regenerate the catalog.
  7. Run the migration and quote its output.
  8. Run `validate` (exit 0, no fallback line) and `git status`, and quote both. The skill never commits.
  9. List the next steps without running them: `/engine:workflow upgrade` and `/engine:init`.
  - A second run reports "nothing to migrate".
- **Copilot differences.** On a Copilot-only repository the settings step is a no-op. Copilot refuses to remove a marketplace while plugins are installed unless `--force` is given.
- **`workflow upgrade`** keeps only the template-key merge (SA-C1).

## 11. Rename map (FR-17; D19–D24, D28, D30–D32 decided; mechanics proposed)

| What | From | To |
|---|---|---|
| Engine plugin `name`, folders (Claude and Copilot) | `ai-dlc`, `plugins/claude/ai-dlc/`, `plugins/copilot/ai-dlc/` | `engine`, `plugins/claude/engine/`, `plugins/copilot/engine/` (D32; moved with `git mv`) |
| Engine display name, keywords | — | "AI-DLC Engineering Team" kept (D20); keywords `specsmd`, `ai-dlc`, `forgeline`, `agentic-sdlc` (D35, D36, replacing D20's list) |
| Lens plugin `name`, folder | `ai-dlc-lens`, `plugins/claude/ai-dlc-lens/` | `lens`, `plugins/claude/lens/` (D31, D32); its entries in the shared registration files follow, in bolt 010 (Component boundaries); `tools/validate.mjs` needs no change |
| Marketplace `name` (both files) | `ai-dlc-agent-workflow` | `forgeline` (D30) |
| Install ids | `ai-dlc@ai-dlc-agent-workflow`, `ai-dlc-lens@ai-dlc-agent-workflow` | `engine@forgeline`, `lens@forgeline` (the lens only in the Claude marketplace) |
| References | `ai-dlc:<id>`, `/ai-dlc:<skill>` | `engine:<id>`, `/engine:<skill>`; `claude --agent engine:orchestrator`. Copilot strips the namespace; its `stripNamespace` must strip `engine:` only before a known id (O-21) |
| Keep-alive command constants | `ai-dlc:cache-keepalive`, `…-configure` | `engine:cache-keepalive`, `engine:cache-keepalive-configure` |
| Lens commands (D22, D24, D31) | `/ai-dlc:lens`, `lens-configure`, `lens-init`, `lens-kit`, `lens-gate` | `/lens:show`, `/lens:configure`, `/lens:init`, `/lens:kit`, `/lens:gate`; skills in `plugins/claude/lens/skills/<name>/` (`init`, `kit` and `gate` confirmation: O-5) |
| Lens keep-alive toggle | `/ai-dlc:lens-keepalive` | `/engine:cache-keepalive-lens [on\|off]` (D28, D32): an engine skill, Claude-only, answered by the lens module |
| Lens pane ids (D33, D37) | `ai-dlc-lens-kit`, `-edge`, `-agent`, `-chart`, `-runs` | `lens-kit`, `lens-edge`, `lens-agent`, `lens-chart`, `lens-runs` (§12) |
| Lens state namespace | `{plugin: 'ai-dlc-lens', key: …}` (about 40 atoms in `hooks/register.tsx`) | `{plugin: 'lens', …}` through one constant `LENS_STATE_NS` |
| Migration entry | `/ai-dlc:workflow upgrade` (layout part) | `/engine:migrate [--dry-run]` (D25, D32; skill name O-1) |
| Consumer settings | `"agent": "ai-dlc:orchestrator"`, old install ids, marketplace key | `"engine:orchestrator"`, `engine@forgeline`, `lens@forgeline`, key `forgeline`; `init` writes the new forms, and `migrate` rewrites the old ones |
| Agent memory folders | `.claude/agent-memory/ai-dlc-<agent>/` | `.claude/agent-memory/engine-<agent>/` (D32; the platform pattern is checked by spike (a)) |
| Catalog `plugin.name` | `ai-dlc` | `engine` |
| Lens worker prefix, roster path | `ai-dlc:`, `.claude/agent-memory/ai-dlc-orchestrator/…` | `engine:`; both prefixes accepted for one release; `.claude/agent-memory/engine-orchestrator/project_team-roster.md`, with a fallback to the old path |
| Build | `PLUGIN` drives the marker regexes | `MARKER_NS = "ai-dlc"`, separate from `PLUGIN`; guard `manifest.name === PLUGIN` |
| Path constants | CI, `tools/validate.mjs`, `.claude/settings.json`, about 40 test files (41 at planning time: `grep -rlE "plugins/(claude\|copilot)/ai-dlc\|ai-dlc-lens"` over `tests/`, the lens tests and the engine hooks) | `tests/helpers/paths.mjs` exporting `ENGINE_DIR` (`plugins/claude/engine`, bolt 009), `LENS_PLUGIN` and `LENS_DIR` (old values from 009; `lens` and `plugins/claude/lens` from 010) |

**Unchanged:**
- `.ai-dlc/` (including `.ai-dlc/lens.json`) and `AI_DLC_*` (D16);
- the `[ai-dlc:auto-handoff]` tag;
- the managed-block markers (SA-R1);
- the shared state namespace `{plugin:'ai-dlc', key:'keepalive'}`, unless spike (e) shows it must equal the manifest name (SA-R5);
- the GitHub repository name;
- bare agent ids in `workflow.json`;
- project-local memory folders.

**No aliases** for the old plugin, marketplace or lens command names (D23). The upgrade:
1. remove marketplace `ai-dlc-agent-workflow` (and its plugins);
2. add `forgeline`;
3. install `engine` (and `lens`);
4. run `/engine:migrate`.

The guide warns before step 1 that removing a marketplace deletes the stored plugin data and settings, and it shows the old-to-new command table (AC-17.8).

**`validate` detect-and-warn (AC-17.12).**
- **When:** a `.claude/agent-memory/ai-dlc-<plugin-agent-id>/` folder exists, or the `agent` starts with `ai-dlc:`.
- **Output:** exactly one stderr warning per invocation, naming the migration skill. The exit code is unchanged.
- **Marker:** the code carries the fallback marker.

## 12. Lens changes (FR-9, FR-17 lens parts; proposed)
- **Resolver.** The lens uses `resolveRunsRoot` and `formatFallbackWarning` (§9), which replace `handoffsRoot`; it keeps `depth`.
- **Record names.** `record.ts` `parseRecordName` (§8.1). The lens reads verdicts, escalations and records to `human`, and raises `gateWaiting` and `gateRejected`.
- **`detectRun` (C-9, proposed).**
  - New signature: `detectRun(dir, run: {file, text} | null, files, now)`.
  - The skipped message names the actual run-state file, for example `run.v2.md: no front matter`.
  - Six text sites say "run state" instead of "run.md".
- **Commands (AC-17.13).**
  - The `CMD` map registers exactly `lens:show`, `lens:configure`, `lens:init`, `lens:kit` and `lens:gate`. A test asserts that each equals `lens:<skill folder name>`.
  - The lens also answers `engine:cache-keepalive-lens`, which is excluded from that test.
  - `KEEPALIVE_COMMAND` becomes `engine:cache-keepalive-configure`.
  - The gate hint names `/lens:gate`.
  - There is no `keepalive` skill in the lens plugin.
- **Pane ids (D33, D37).** The lens opens `lens-kit`, `lens-edge`, `lens-agent`, `lens-chart` and `lens-runs`. A pane id is 1–64 letters, digits, `_` and `-` (`PaneOpenArgs.id`; `hooks/register.tsx:24-29`, `:202-203`). At load the lens closes any open pane whose id is in `LEGACY_PANE_IDS` (`ai-dlc-lens` and the five `ai-dlc-lens-*` ids), which extends today's `closeOldCard`; the list carries the fallback marker. `migrate` rewrites no layout file unless spike (i) finds that pane ids persist. Pane titles ("AI-DLC Lens") are unchanged.
- **State namespace.** The lens's own atoms use `LENS_STATE_NS = 'lens'`; the shared keep-alive namespace follows spike (e).
- **Skill moves.** The five skills move, their `name:` fields change, and the "(needs the ai-dlc-lens plugin)" text is dropped. The five lens skill entries leave `tools/claude-only-skills.json` in bolt 010, with the move; the sixth, `lens-keepalive`, becomes `cache-keepalive-lens` in bolt 009 and stays listed.
- **Dual prefix (AC-17.11).** `hooks/engine-names.ts` exports:
  - `ENGINE_PLUGIN = 'engine'`;
  - `LEGACY_ENGINE_PLUGINS = ['ai-dlc']`, with the fallback marker;
  - `engineRole`, which strips either prefix;
  - `typeOfWorker`, which builds `engine:<id>`.
  - Pre-rename records display unchanged.
- **Lens tests** live in `plugins/claude/lens/tests/` (plugin test) and in `tests/lens-renderer/` and `tests/cache-reader/` (repository node:test run), all lens-owned.

## 13. Build notices (FR-12; C-13 proposed)
- **Copy rule.** `tools/build-copilot.mjs` copies a fixed allowlist `ROOT_NOTICES = ["NOTICE.md", "ATTRIBUTION.md"]` from the plugin root when the files exist. They are LF-normalised and namespace-stripped. Nothing else is copied, and `--check` covers staleness.
- **Build test** (`tests/build-copilot-notices.test.mjs`):
  - the Copilot output is byte-equal to the source;
  - an edited or missing copy fails `--check`;
  - `EXTRA.md` is not copied.
- **Repository test.** Both files exist in `plugins/claude/engine/` and `plugins/copilot/engine/`.
- **`THIRD_PARTY_NOTICES.md`** gains a fabriqaai/specs.md entry: MIT, "Copyright (c) 2025 Fabriqa AI", the upstream URL and the full licence text.
- **`ATTRIBUTION.md`** lists each adapted file and what was adapted.

## 14. Authorship rule and docs-status (FR-7; D2 and C-10 decided; proposed text)
- **The bank is documentation.** The rewritten `docs-status` lists every file under `memory-bank/` as documentation. The rule lives in three copies with identical bodies: the `docs-rules` template, `.claude/rules/docs-status.md` and its `.github/instructions/` twin.
- **Single writer.** `documentation-writer` is the only agent that creates, edits or deletes files under `memory-bank/`. Stage agents return the content plus a *Docs update* request.
- **Severity.** A bank file in another agent's change set is a Blocker (`code-reviewer` cannot approve; `brutal-critique` returns REVISE). The rule and the `review` skill both state this check.
- **Exemptions:** build-generated text, `migrate` pure moves, `init` `.gitkeep` files.
- **`execution-plans/` is not documentation.**
- **"Done" for a unit or bolt** means engineering done and knowledge done:
  - its bank content was written by `documentation-writer`;
  - `brutal-critique` returned PASS on it;
  - no marker disagrees with the run state.
  - Worked example: bolt 004's engineering is done, but its `bolt.md` still says `in-progress` and has not been critiqued, so the bolt is not done.
- **Skills that wrote lifecycle artifacts** return the content to `documentation-writer` instead: `write-adr`, `spec-driven-development`, `product-planning`, and the glossary writes of `requirement-analysis` (AC-7.6).
- **Critique.** `brutal-critique` critiques every bank change before the owning stage is `done` (AC-7.7).

## 15. Stale-names sweep (FR-10, FR-17; proposed)
- **The check:** `tests/stale-names.test.mjs` with one allowlist, `tools/stale-names.allowlist.json`:

```json
{ "patterns": [
    {"id":"legacy-path",     "regex":"docs/(backlog|product|specs|plans|handoffs|architecture/(decisions|narratives))(?![\\w-])"},
    {"id":"old-prefix",      "regex":"(?<![\\w-])ai-dlc:(?!begin|end|skip|orchestrator-persona|auto-handoff)"},
    {"id":"old-folder",      "regex":"plugins/(claude|copilot)/ai-dlc(?![\\w-])|plugins/claude/ai-dlc-lens(?![\\w-])"},
    {"id":"old-marketplace", "regex":"ai-dlc-agent-workflow(?!-plugin)"},
    {"id":"old-lens-name",   "regex":"ai-dlc-lens"},
    {"id":"interim-names",   "regex":"ai-dlc-engine|ai-dlc-suite"} ],
  "allow": [ {"path":"<glob>", "reason":"<one line>", "patterns":["<id>"]} ] }
```

- **`old-lens-name`** matches every `ai-dlc-lens` form, the old pane ids included (D33, D37). Its only allowlist entries are the lens's `LEGACY_PANE_IDS` and its test (lens dual-prefix category). The `interim-names` pattern is decided in step 1.1.22; the planning records that carry interim names are outside the search scope, so it needs no allowlist entry.
- **Additional patterns:** `ai-dlc@`, `"name": "ai-dlc"`, `agent-memory/ai-dlc-<id>`, the phrase `ai-dlc plugin`, and the half-renamed forms `engine:lens`, `lens:lens` and `lens:keepalive`.
- **Search scope:** the union of AC-10.1 and AC-17.3, with the paths `plugins/claude/engine/`, `plugins/copilot/engine/` and `plugins/claude/lens/`.
- **Not flagged:**
  - `.ai-dlc/`, `AI_DLC_`, `forgeline`, `ai-dlc-agent-workflow-plugin`, the new names `engine:` and `lens:`, except the half-renamed forms above;
  - `docs/plugins.md` and `README.md` (AC-10.4).
- **Allowlist categories.** Only these entries are allowed; any other entry fails code review:
  - the fallback code and its tests;
  - the migration code, its tests and fixtures;
  - the lens dual-prefix code and the `validate` detect-and-warn code, and their tests;
  - the reader-facing rename pages: the migration and upgrade guide and the preview2 release notes;
  - history: `docs/handoffs/` only (the other history paths are outside the search scope).
- **Failure output** names the file and line.

## 16. Delivery: bolts (proposed; this section governs each bolt's scope)

The task plan (`memory-bank/project/plans/001-preview2-specsmd.tasks.md`) carries the same rows and is the schedule of record (waves and order). G3 may renumber or reschedule bolts that have not started; a scope change goes through `spec-driven-development` here first.

| Bolt | Unit | Type (lifecycle) | Scope | Items | Requires |
|---|---|---|---|---|---|
| 001-engine-rename-spike | engine (lens part (c)) | spike-bolt (ASDLC: research, probe, architecture) | Live in Claude Code, scratch marketplace under `.scratch/`, Claude Code version quoted. Records: (a) the memory folder of a `memory: project` agent of plugin `engine`; (b) what happens to installed plugins, their `enabledPlugins` entries and stored data and settings when marketplace `ai-dlc-agent-workflow` is removed, `forgeline` added and `engine` and `lens` installed; (c) whether `/lens:show`, run from a skill in the `lens` plugin, reaches the lens module; (d) whether `lens` with `skills/` passes `validate --strict`; (e) whether the `$.state` `plugin` must equal the manifest name, and whether lens atoms persist (state lost on rename); (f) what an `"agent"` naming an unknown plugin agent does; (g) whether `engine:cache-keepalive-lens` is answered across plugins; (h, O-23) what happens when another installed plugin is also named `engine` or `lens`, including two plugins opening the same pane id such as `lens-chart`; (i, D33, D37) whether Claude Code reopens a pane by id after `/reload-plugins` or in a new session. A difference from this spec goes through `spec-driven-development` before bolt 009 starts | ITEM-126 (AC-17.14) | — |
| 002-engine-contract-tooling | engine | construction-bolt (AAWP) | `ARTIFACT_TYPES`, schema, `boltTypes`, skip rule and `building`, `validate`, `artifacts`, G-FM with vectors; the `workflow.mjs` resolver and fallback warning with their vectors (§9); `init` scaffolding of `memory-bank/product/`, `memory-bank/project/` and `execution-plans/` (`.gitkeep`) with a preview2 `artifacts` block (AC-1.1, AC-8.2) | ITEM-112 | — |
| 003-engine-authorship-rule | engine | simple-bolt (AAWP) | `docs-status` rewrite in its three copies (§14); the bank-file Blocker check in the `review` skill (AC-7.3); `write-adr`, `spec-driven-development`, `product-planning` and the glossary writes of `requirement-analysis` return content to `documentation-writer` (AC-7.6); `brutal-critique` critiques every bank change before the owning stage is `done`, stated in the rule and the orchestrator's docs-stage text (AC-7.7) | ITEM-113 | — |
| 004-engine-events | engine | construction-bolt (AAWP) | G-REC with vectors, `event.schema.json` installed by `init` (AC-6.1), `EVENT_RULES`, `events`, `handoff` skill rewrite, `execution-plan.md`; `agent-invocation`, the orchestrator body and the generated `AGENTS.md` template name `execution-plans/` (AC-5.2) and say when each event type is written (AC-6.6); session-handoff move; delete `.handoff/config.md` | ITEM-115 | 002 |
| 005-engine-planning-stages | engine | construction-bolt (AAWP) | `unit-design`, `bolt-design`, `probe`; PDLC, ASDLC and STBLC prose; agent text; bank templates for the intent files, unit brief, story and `bolt.md` (§4.1) | ITEM-114 (part a) | 002 |
| 006-engine-build-stages | engine | construction-bolt (AAWP) | bolt types wired into the orchestrator, `request-routing`, the `ai-dlc` skill, and the FDLC, BFLC, RLC and AAW prose | ITEM-114 (part b) | 005 |
| 007-engine-handoff-hook | engine | simple-bolt (AAWP) | hook resolver, formatter, G-REC, pairing, plugin tests | ITEM-116 (part a) | 002, 004 |
| 008-lens-new-paths | lens | simple-bolt (AAWP) | lens resolver, `record.ts`, `detectRun`, verdict and escalation reading, the lens's legacy-path strings | ITEM-116 (part b); lens part of ITEM-117 | 002, 004 |
| 009-engine-rename | engine | construction-bolt (AAWP) | §11 engine side: folder `git mv`, manifest (`name`; keywords D35, D36), both marketplaces (`forgeline`, the `engine` entry), `MARKER_NS`, `tests/helpers/paths.mjs` (`ENGINE_DIR`; `LENS_PLUGIN` and `LENS_DIR` at their old values), `engine:` prefixes, keep-alive command constants, `lens-keepalive` → `cache-keepalive-lens`, `init` settings, catalog, `stripNamespace` (O-21) with a build test, shared state namespace per (e). It edits no lens entry (Component boundaries); the five lens skills sit under `plugins/claude/engine/skills/` until 010, unreleased | ITEM-126 (engine) | 001; 002–008 and 013 merged; serialised |
| 010-lens-rename | lens | simple-bolt (AAWP) | lens plugin `name` and folder `git mv` to `plugins/claude/lens/`; the lens's entries in the shared registration files (marketplace entry, `tools/claude-only-plugins.json` line, the five skill lines leaving `tools/claude-only-skills.json`, its two CI steps, `LENS_PLUGIN` and `LENS_DIR`); paths in `tests/lens-renderer/` and `tests/cache-reader/`; the five skills move and rename; `CMD` map; `KEEPALIVE_COMMAND`; `engine-names.ts`; roster fallback; pane ids `lens-*` with `LEGACY_PANE_IDS` (D33, D37); `LENS_STATE_NS = 'lens'`; shared state namespace per (e) | ITEM-126 (lens; AC-17.11, AC-17.13) | 001, 009 |
| 011-engine-path-sweep | engine | simple-bolt (AAWP) | §15 sweep, its allowlist, and fixes in engine-owned paths; a hit in a lens-owned path goes back to the lens unit as a fix round of bolt 010 | ITEM-117; ITEM-126 (AC-17.3, AC-17.4) | 009, 010 |
| 012-engine-migrate | engine | construction-bolt (AAWP) | §10, `merge` guards, `upgrade` split, migration skill, AC-17.12 | ITEM-118; ITEM-126 (AC-17.10, AC-17.12) | 001 (hand-back accepted), 002, 009, 010 |
| 013-engine-notices | engine | simple-bolt (AAWP) | §13 | ITEM-119 | 002 |

**Waves:**
- W1: 001, 002 and 003, in parallel.
- W2: 004, 005 and 013.
- W3: 006, 007 and 008.
- W4: 009, then 010, with no other bolt open.
- W5: 011 and 012, in parallel.
- W6, intent-level work:
  - ITEM-121: dogfood migration, through the agent-artifact lifecycle;
  - ITEM-122: TLC;
  - ITEM-123: docs and release notes;
  - ITEM-124: release.
- Not scheduled: ITEM-120 (FR-13, P3; now covers `forgeline`, `engine` and `lens`, O-19) and ITEM-125 (1.0.0).

### 16.1 Traceability (AC → spec section → delivery)
"Intent" means intent-level work with no bolt.

| AC | Section | Delivery |
|---|---|---|
| AC-1.1 | §2.1 | 002 (init scaffolding) |
| AC-1.2 | §2.2, §2.3 | 002 |
| AC-1.3 | §2.2 | 002 |
| AC-1.4 | §2.2, §2.3 | 002 |
| AC-1.5 | §2.2 | 002; 012 |
| AC-1.6 | §3 | 002, 012; resolver 002/007/008 |
| AC-2.1 | §4.1 | 002, 005 |
| AC-2.2 | §4.1 | 002, 005 |
| AC-2.3 | §6.1 | 002, 005, 006 |
| AC-2.4 | §5 | 005 |
| AC-2.5 | §5 | this spec; 003 |
| AC-2.6 | §5 | this spec (G2) |
| AC-3.1 | §6.3 | 005 |
| AC-3.2 | §6.3 | 005 |
| AC-3.3 | §6.3 | 005 |
| AC-3.4 | §6.3 | 005 |
| AC-4.1 | §6.1 | 002, 005 |
| AC-4.2 | §6.1 | 005, 006 |
| AC-4.3 | §6.2 | this spec (G2), ADR-0012 |
| AC-4.4 | §6.2 | 002, 005 |
| AC-5.1 | §2.2, §7 | 002 |
| AC-5.2 | §7 | 004 |
| AC-5.3 | §7 | 004 |
| AC-5.4 | §7 | 004 |
| AC-5.5 | §7 | 004 |
| AC-6.1 | §8.3 | 004 |
| AC-6.2 | §8.4 | 004 |
| AC-6.3 | §8.4 | 004 |
| AC-6.4 | §8.4 | 004 |
| AC-6.5 | §8.4 | 004, 007, 008 (review) |
| AC-6.6 | §8.2 | 004 |
| AC-7.1 | §14 | 003 |
| AC-7.2 | §14 | 003 |
| AC-7.3 | §14 | 003 |
| AC-7.4 | §14 | 003 |
| AC-7.5 | §14 | 003 |
| AC-7.6 | §14 | 003 |
| AC-7.7 | §14 | 003 |
| AC-8.1 | §2.3 | 002 |
| AC-8.2 | §2.3, §8.3 | 002 (scaffolding); 009 (the `/engine:init` name) |
| AC-8.3 | §14 | 003 |
| AC-8.4 | §2.3, §9 | 002 |
| AC-8.5 | §2.3 | 002 |
| AC-9.1 | §9.1 | 007 |
| AC-9.2 | §12 | 008 |
| AC-9.3 | §12 | 008 |
| AC-9.4 | §9 | 007, 008 |
| AC-9.5 | §9, §11 | 007, 008, 009 |
| AC-10.1 | §15 | 011 |
| AC-10.2 | §15 | 011 |
| AC-10.3 | §15 | 011 |
| AC-10.4 | §15 | 011 |
| AC-11.1 | §10.4 | 012; intent ITEM-123 (guide) |
| AC-11.2 | §10.2 | 012 |
| AC-11.3 | §10.3 | 012 |
| AC-11.4 | §10.3 | 012 |
| AC-11.5 | §10.2 | 012 |
| AC-11.6 | §10.2 | 012 |
| AC-11.7 | §10.2 | 012 |
| AC-11.8 | §10.2 | 012 |
| AC-11.9 | §10 | 012 |
| AC-11.10 | §10 | intent ITEM-121 |
| AC-11.11 | §10.3 | 012 |
| AC-12.1 | §13 | 013 |
| AC-12.2 | §13 | 013 |
| AC-12.3 | §13 | 013, plus every adapting bolt (review) |
| AC-12.4 | §13 | intent ITEM-124 |
| AC-13.1 | — | intent ITEM-120 (O-19) |
| AC-13.2 | — | intent ITEM-120 |
| AC-13.3 | — | intent ITEM-120 |
| AC-14.1 | §1 | intent ITEM-124 |
| AC-14.2 | §11 | intent ITEM-124 |
| AC-14.3 | — | intent ITEM-124 |
| AC-14.4 | §9–§11 | intent ITEM-123 |
| AC-14.5 | §9.2 | intent ITEM-124 |
| AC-14.6 | — | intent ITEM-124 |
| AC-14.7 | §10 | intent ITEM-122 |
| AC-15.1 | §9.1 | 002, 007, 008 |
| AC-15.2 | §9.2 | 002, 007, 008 (O-4) |
| AC-15.3 | §9.2 | 002, 007, 008 |
| AC-15.4 | §9.2 | 002, 007, 008 |
| AC-15.5 | §9.2 | 002, 007, 008 |
| AC-15.6 | §9.1 | 002, 007, 008 |
| AC-15.7 | §9.2 | 002, 007, 008 |
| AC-15.8 | §9.2 | 002, 007, 008, 010, 012; ITEM-125 |
| AC-16.1 | — | every engine bolt; intent ITEM-124 |
| AC-16.2 | §10.4, §11, §12 | 009, 010, 012 |
| AC-16.3 | — | every bolt (review) |
| AC-16.4 | §11 | 009, 010, 011 |
| AC-16.5 | — | every bolt; intent ITEM-124 |
| AC-17.1 | §11 | 009, 010 |
| AC-17.2 | §11 | 009, 010 |
| AC-17.3 | §15 | 011 |
| AC-17.4 | §15 | 011 |
| AC-17.5 | §11 | 009, 010 |
| AC-17.6 | §11 | 009 |
| AC-17.7 | §11 | 009 |
| AC-17.8 | §11 | intent ITEM-123 |
| AC-17.9 | §10 | intent ITEM-121 |
| AC-17.10 | §10.2 | 012 |
| AC-17.11 | §12 | 010 |
| AC-17.12 | §11 | 012 |
| AC-17.13 | §11, §12 | 009 (keep-alive skill), 010 (lens commands, pane ids) |
| AC-17.14 | §16 | 001 |

All 104 ACs are mapped.

## Component boundaries
- **engine** owns:
  - `plugins/claude/engine/**` (except the lens's five skills until they move) and `plugins/copilot/engine/**`;
  - the `hooks/auto-handoff` and `hooks/keepalive` folders;
  - the `workflow.mjs` contract: layout, `ARTIFACT_TYPES`, G-FM, G-REC, `EVENT_RULES`, resolver, `migrate`;
  - both schemas; the `migrate` and `cache-keepalive-lens` skills;
  - `tools/`, both marketplace files, `.github/workflows/validate.yml` and `tests/`, except the lens's two test folders.
- **lens** owns:
  - `plugins/claude/lens/**`, including its five command skills;
  - `tests/lens-renderer/` and `tests/cache-reader/` (node:test suites of lens code, run by the repository test command; they stay under `tests/`);
  - its resolver, `record.ts`, `engine-names.ts`; answering `engine:cache-keepalive-lens`.
  - It reads the engine contract and never writes it.
- **Shared registration files.** The engine owns each file; the lens owns only its own entries, and only a lens bolt changes them: its entry in `.claude-plugin/marketplace.json`, its line in `tools/claude-only-plugins.json`, its five skill lines in `tools/claude-only-skills.json` (until they leave), its two steps in `.github/workflows/validate.yml`, `LENS_PLUGIN` and `LENS_DIR` in `tests/helpers/paths.mjs`. `tools/validate.mjs` reads `tools/claude-only-plugins.json` and names no lens path. A bolt that edits the other unit's entry is a code-review finding.
- **Writers:** `documentation-writer` alone writes `memory-bank/`; the orchestrator (or Mode-5 teammates) writes `execution-plans/`; `agent-manager` writes agent artifacts.

## Data shapes
- `parseFrontMatter → { found, data, errors[] }`.
- `parseRecordName → {code, from, to, type} | undefined`.
- `resolveRunsRoot → { root, layout, notes[] }`.
- `formatFallbackWarning → string | undefined`.
- `events --json → [{file, code, from, to, type, frontMatter, errors[]}]`.
- `migrate --dry-run --json → {actions, conflicts}`.
- `artifacts --json → [{key, kind, path, layout, root}]`.
- Whether the `{data, error}` envelope applies to the new `--json` outputs is O-12.

## Test seams
- **`workflow.mjs` CLI on temporary git repositories** (prior art: `tests/workflow/workflow.test.mjs`).
- **Shared grammar vectors** with drift tests (`tests/fixtures/grammar/`).
- **Hook tests** under `npx @anthropic-ai/claude-code plugin test ./plugins/claude/engine`.
- **Lens tests** under `npx @anthropic-ai/claude-code plugin test ./plugins/claude/lens`.
- **Build:** `tests/build-copilot-notices.test.mjs`.
- **Sweep:** `tests/stale-names.test.mjs`, including a test that plants a pattern.
- **Live seam:** the spike 001 hand-back.
- **Quoted command output:** AC-11.10, 14.3, 14.7, 17.2 and 17.9.

## Out of scope
- A deterministic runtime or scheduler (D3).
- The GitHub repository rename.
- Renaming `.ai-dlc/`, `AI_DLC_*` or the managed-block markers (D16, SA-R1).
- Aliases for the old plugin, marketplace or lens command names (D23).
- specsmd runtime scripts as dependencies.
- The specsmd ideation, FIRE and simple flows, and its operations flow beyond mapping to our release and DevOps stages.
- Changes to preview1 (C-12).
- Editing user-level or managed settings.
- Removing the fallback (ITEM-125).
- Validating migrated or pre-opt-in history.

## 17. Open items (none decided by the human)

| Id | Item | Owner | Recommendation |
|---|---|---|---|
| O-1 | Name of the migration skill: `migrate` (`/engine:migrate`, as D32 writes it) or another | human at G2 | `migrate` |
| O-2 | Identical duplicates in artifact moves: drop the legacy file, losing that path's history (memory folders are already decided by AC-17.10(e)) | human at G2 | Drop it, printed as `drop` |
| O-3 | D25 settles that the repository's two settings files are rewritten. Confirm that user-level and managed settings get advice only | human at G2 | Confirm |
| O-4 | Lens toast deduplicated by text per session, plus one entry per scan in the `/lens:gate` list, counts as "one warning per lens scan" (AC-15.2) | product-owner | Yes |
| O-5 | Confirm `/lens:init`, `/lens:kit` and `/lens:gate` (D32 lists them; earlier marked "to confirm at G2") | human at G2 | Treat as confirmed by D32 unless the human says otherwise |
| O-6 | `spike-bolt` leaves out ASDLC `narrative`, which carries G2; nothing says who accepts the spike hand-back (AC-17.14) | software-architect proposes; human decides | A gate on a skipped stage is not held for that bolt; the human accepts the spike hand-back, recorded as a `verdict` |
| O-7 | Bolt 001 runs before `boltTypes` and `probe` exist | orchestrator; human at G3 | Run it as ASDLC with a one-off override (research → probe → architecture) recorded in its Routing Plan |
| O-9 | Algorithm of the `MEMORY.md` line union | system-engineer | Target lines in order, then source lines not present (exact match after trimming trailing whitespace), in source order |
| O-10 | The lens install-key rewrite was missing from the 1.1.19 design; added in §10.2 step 5 | system-engineer to confirm | Keep it |
| O-12 | Does the `{data, error}` envelope apply to the new `--json` outputs? | system-engineer | No (CLI reports) |
| O-13 | Spike-dependent items (a), (b), (c), (e), (f), (h), (i) | bolt 001; changes through `spec-driven-development` | Run bolt 001 first (D29) |
| O-15 | The FRs and ACs carry the D30–D37 names (sweep 1.5.l3.3; the 1.1.22 fix pass): the Conventions, FR-16, FR-17, the glossary, AC-2.3, 8.2, 9.5, 10.1, 11.1, 12.2, 14.2–14.4, 16.2, 16.4, 17.1–17.14 | human at G2 | Approve the amended text at G2 (a G1 amendment, as D26) |
| O-19 | Brand and collision risk: 1.1.8 found a private-beta AI-agent product called "Forgeline" (single source); `engine` and `lens` are generic names | research-assistant (FR-13, P3, non-gating); a clash goes to the human | Add `forgeline`, `engine` and `lens` to the ITEM-120 report |
| O-21 | The Copilot build strips the namespace. With `engine:` a generic prefix, a plain prefix strip would also change prose such as "engine: …" | system-engineer (bolt 009) | Strip `engine:` only before a known agent or skill id and after a non-word character; add a build test |
| O-23 | Can a plugin named `engine` or `lens` coexist with another installed plugin of the same name from a different marketplace? The platform does not document it | bolt 001 (spike (h), proposed) | Add (h) to the spike |

(Closed: O-16 and O-18 by D32; O-17 by D33, D37; O-20 by D34; O-22 by D35, D36; O-8, O-11 and O-24 by software-architect, step 1.1.22; O-14 closed by critique 1.5.l3.7.)
