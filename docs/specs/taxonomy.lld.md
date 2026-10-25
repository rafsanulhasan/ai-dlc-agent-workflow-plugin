---
work-item: FEAT-20261020-ai-dlc-lens
root: 18
kind: lld
feature: taxonomy
module: ai-dlc
submodule: multi-agent-workflow
integrations: [integration-2]
items: [ITEM-037, ITEM-038, ITEM-039, ITEM-040, ITEM-041, ITEM-042, ITEM-043, ITEM-044, ITEM-065, ITEM-066]
author: system-engineer
date: 2026-10-24
status: draft revision 2 (bc round 1 fixed; sa answers applied), awaiting brutal-critique round 2
spec: docs/specs/taxonomy.spec.md (revision 2)
adrs: [ADR-0003, ADR-0004]
stories: docs/product/active/multi-agent-workflow-foundations/sprint-1/taxonomy/stories.md
handoff: 18.1.1-software-architect-to-system-engineer.handoff.md
---

# LLD: a module taxonomy in the plugin (root 18)

Design only. Changes to the `workflow` skill's files are made later by a freshly spawned agent-manager (team brief). Code lines were read on 2026-10-24; the build re-checks them. Paths are under `plugins/claude/ai-dlc/` unless stated.

## 1. Design summary

| Principle | Decision |
|---|---|
| Pure core, three adapters | Each rule is one pure function: `walkRunFolders(list)` (D4), `parseSessions` (D5), `pickRun(…, filter)` (D7), `checkTaxonomy`, `checkTags`, `checkLinks` (D2, D8). Each runtime (workflow.mjs, run.ts, lens) gives the walk its own `list` function. |
| No declaration, no change | Plain `validate` is unchanged in every case (AC-18.2.1). The tag and link checks run only with `--artefacts` **and** a declaration; the walk, the unique-run-id check and the too-deep warning run only with `--artefacts` (with or without a declaration). |
| Additive parsing | New fields are optional: `module`, `submodule`, `feature` (`string | undefined`), `integrations`, `tasks` (`string[]`, `[]` when absent), `sessions` (`[]` when the cell is empty or in another format). Nothing throws. |
| Two copies are tested equal | The lens cannot import from `ai-dlc`, so the walk and the sessions parser exist in `run.ts` and in the lens. A shared fixture and an equality test keep them the same. |

## 2. D1: the declaration and its schema (ITEM-037)

`skills/workflow/templates/taxonomy.schema.json` (new; the plugin ships only this, never a declaration):

```json
{ "$schema": "http://json-schema.org/draft-07/schema#", "title": "AI-DLC taxonomy", "type": "object", "additionalProperties": false,
  "required": ["version", "modules", "integrations"],
  "properties": {
    "$schema": { "type": "string" },
    "version": { "const": 1 },
    "modules": { "type": "array", "items": { "$ref": "#/definitions/module" } },
    "integrations": { "type": "array", "items": { "$ref": "#/definitions/integration" } }
  },
  "definitions": {
    "id": { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
    "feature":   { "type": "object", "additionalProperties": false, "required": ["id", "label"], "properties": { "id": { "$ref": "#/definitions/id" }, "label": { "type": "string" } } },
    "submodule": { "type": "object", "additionalProperties": false, "required": ["id", "label", "features"], "properties": { "id": { "$ref": "#/definitions/id" }, "label": { "type": "string" }, "features": { "type": "array", "items": { "$ref": "#/definitions/feature" } } } },
    "module":    { "type": "object", "additionalProperties": false, "required": ["id", "label", "submodules"], "properties": { "id": { "$ref": "#/definitions/id" }, "label": { "type": "string" }, "submodules": { "type": "array", "items": { "$ref": "#/definitions/submodule" } } } },
    "integration": { "type": "object", "additionalProperties": false, "required": ["id", "label", "joins"], "properties": { "id": { "$ref": "#/definitions/id" }, "label": { "type": "string" }, "joins": { "type": "array", "minItems": 2, "items": { "type": "string", "pattern": "^(module|submodule|feature):[a-z][a-z0-9-]*$" } }, "description": { "type": "string" } } }
  } }
```

Epics are not in the schema (folders, not tags). The shipped schema contains none of `ai-dlc-lens`, `cache-keepalive`, `integration-1` (AC-18.1.3; the example `description` texts are generic).

### 2.1 `checkTaxonomy(tx, rel)` (pure, in `workflow.mjs`)

Returns an array of error strings; `validate` appends them to its `errors` when `.ai-dlc/taxonomy.json` exists, after the workflow checks. Invalid JSON: `<rel>: not valid JSON: <message>` (one error, no further checks). Checks, in order, each message `<rel>: <json path>: <text> ("<id>")`:

| # | Check | Text |
|---|---|---|
| 1 | an unknown key anywhere (against the schema's property names) | `unknown key "<key>"` |
| 2 | `version` is not 1; a required key missing | `must be 1` / `missing required key "<key>"` |
| 3 | an `id` that is not kebab-case | `id is not kebab-case` |
| 4 | an id repeated within its kind (modules, submodules, features, integrations; each kind a separate namespace; feature ids unique across all submodules) | `duplicate <kind> id (first at <path>)` |
| 5 | an integration with fewer than two `joins`, a reference not of the form `<kind>:<id>`, or one naming an undeclared id | `needs at least two joins` / `reference "<ref>" is not <module|submodule|feature>:<id>` / `reference "<ref>" is not declared` |

The schema file is documentation for editors and for the `$schema` link; `checkTaxonomy` is the executable form (the file has no dependency, so it does not run a JSON-Schema engine). A test asserts that the schema's property names equal the key sets `checkTaxonomy` allows.

## 3. D2 and D3: tags on artefacts (ITEM-038, ITEM-042)

### 3.1 `validate` and `validate --artefacts`

Spec D2 (rev 2, sa's answers): two levels.

- **Plain `validate`** computes `errors`/`warnings` as today and, when `.ai-dlc/taxonomy.json` exists, appends `checkTaxonomy` errors (the declaration file only). With no file its output and exit code are today's (AC-18.2.1). `check-workflow.mjs` is untouched and runs plain `validate`, so the Stop gate never sees tag, link or run-id errors.
- **`validate --artefacts`** additionally runs `checkArtefacts(root, wf, tx)`: (1) always, with or without a declaration: the run walk (section 5), the unique-run-id errors (AC-18.5.3) and the too-deep warnings; (2) only with a declaration: `checkTags` over run states, backlog items and story/task files, and `checkLinks` (section 7). With no declaration, `--artefacts` prints nothing extra: it behaves as plain `validate` plus the unique-id check (no skipped-notice line; the spec says it behaves like plain validate). AC-18.2.3 is tested that way.
- `--artefacts` is a boolean read with `argv.includes`; `VALUE_OPTS` is unchanged. It runs in CI (ITEM-044.b), from `product-manager` and from build agents that write run-state tags; the orchestrator never runs it.

### 3.2 Artefact readers (pure functions, in `workflow.mjs`)

```js
function frontMatterOf(text)                  // { key: string } from the first --- block; inline list "[a, b]" -> string[]
function tagsOf(fm)                           // { module?, submodule?, feature?, integrations: [] }
function backlogItems(text)                   // [{ id: "ITEM-037", title, status, tags }] 
function taskRows(text)                       // [{ item: "37", run: "…" }] from tables with ITEM and Run columns
function isOpenRun(fm), isOpenItem(status), isOpenDoc(fm)
```

- **Run states.** For each run folder (section 5) the current state file by the `VERSION_NAME` rule (copied from `run.ts`: highest `run.v<major>[.<minor>].md`, else `run.md`). Tags from its front matter; open when `status` is `active` or `blocked`. Older versions are not read (AC-18.11.2).
- **Backlog items.** `backlogItems(text)` walks the lines of `artifacts.backlog`; it skips **fenced code blocks** (a line starting with three backticks toggles) **and HTML comments** (`<!--` to `-->`), because this repository's template item lives in an HTML comment (`docs/backlog/backlog.md:7`) and the `product-planning` *Item Format* in a code fence. Each `### ITEM-NNN` heading starts an item that ends at the next `###` or `##` heading (a `---` rule inside an item does not end it). Its bullet lines `- **Module**: x`, `- **Submodule**:`, `- **Feature**:`, `- **Integrations**: a, b` are read case-insensitively on the label; `- **Status**: …` decides openness (not `Done`, not `Cancelled`). Summary tables are not read.
- **Stories and tasks.** Every `.md` file under `artifacts.product` (recursive; `readdirSync` with `withFileTypes`) whose front matter has `kind: user-stories` or `kind: tasks`. Open when the front matter `status` does not start with `done` (an absent `status` is open).

### 3.3 `checkTags(artefact, tx)` and its messages

For each artefact (`path`, `kind` ∈ `run state`, `backlog item`, `user stories`, `tasks`, `tags`, `open`), in order:

| # | Rule | Message |
|---|---|---|
| 1 | each present tag is a declared id of its kind | `<path>: <key> "<id>" is not declared in .ai-dlc/taxonomy.json` (for `integrations`, once per bad entry) |
| 2 | `submodule` is under `module` | `<path>: submodule "<s>" is not under module "<m>"` |
| 3 | `feature` is under `submodule` | `<path>: feature "<f>" is not under submodule "<s>"` |
| 4 | an open artefact has `module` and `submodule` | `<path>: open <kind> has no <key> (required with a declaration)` |

A closed artefact without tags is skipped. For a backlog item `<path>` is `<backlog file>#ITEM-NNN`. A test asserts rule 4 for each artefact kind (po condition, spec OQ2).

### 3.4 Tag formats (text, ITEM-038 and ITEM-042)

Sections to change, no prose drafted: `handoff` *Run state* front matter (the four keys, written at Confirm from the work item, left out with no declaration) and *Request/Naming* none; `product-planning` *Item Format* (the four bullet lines) and a *Taxonomy upkeep* action; `task-triage` breakdown table (columns `Module | Submodule | Feature | Integrations`, and the `needs-info` rule for a row without module or submodule when a declaration exists).

## 4. D7: `pickRun` by module (ITEM-040)

`run.ts`:

- `RunState` gains `module?: string`, `submodule?: string`, `feature?: string`, `integrations?: string[]`, `tasks?: string[]`. `parseRunState` reads them: scalars from `fm.module`, …, lists by the same inline-list parser as `frontMatterOf` (new exported `inlineList(value): string[]`, `[]` for an empty or missing value).
- `pickRun(runs, branch, sessionId, lineage = [], claimed?, filter?: { module?: string })`:
  ```ts
  const open = runs.filter(r => r.status === 'active' && r.branch === branch)
    .filter(r => !filter?.module || r.module === filter.module)
  ```
  The rest is unchanged. With no `filter` (or an empty module) the predicate is always true, so the result is identical (AC-18.6.2). A test passes `undefined` and `{}` and compares to the old results over the existing fixtures.
- Setting: `config.ts` `Config.runModule?: string` (default unset), `SETTINGS` row `{ key: 'runModule', field: 'runModule', env: 'AI_DLC_AUTO_HANDOFF_RUN_MODULE', kind: 'text' }`, not trust-gated. `register.tsx` `runLookup` calls `pickRun(runs, branchName, sessionId, lineageIds, claimed, cfg.runModule ? { module: cfg.runModule } : undefined)`.
- Alignment files (spec boundaries): `skills/configure-auto-handoff/SKILL.md`, its `templates/auto-handoff.schema.json` and the `.ai-dlc/` copy (byte-identical; description: "run states are filtered to this module before the branch rule"), `tests/auto-handoff/auto-handoff-agreement.test.mjs` and `settings-levels-aligned.test.mjs` (they check the SETTINGS table against the schema and the README table; the new row joins both), and a README row requested from documentation-writer.

## 5. D4: run discovery at any depth (ITEM-039)

### 5.1 The walk, written once

```ts
type Entry = { name: string; kind: 'file' | 'dir' | 'other' }
type Walk = { runs: { folder: string; names: string[] }[]; tooDeep: string[]; skipped: string[] }
export const MAX_DEPTH = 6
/** list(dir) returns the entries of a folder or throws. folders are repo-relative, forward slashes. */
export async function walkRunFolders(root: string, list: (dir: string) => Promise<Entry[]>): Promise<Walk>
```

Algorithm (depth of the root's direct children is 1):

```
visit(dir, depth):
  entries = list(dir)   (a throw: at depth 0 the result is empty; deeper, the folder is skipped and added to `skipped`, a fourth result array that readers log once)
  names = entries.filter(file).map(name)
  if depth > 0 and currentRunStateFile(names) !== undefined: runs.push({ folder: dir, names }); return    // stop at a run folder
  for e of entries (sorted by name) where e.kind === 'dir' and !e.name.startsWith('.'):
      if depth + 1 > MAX_DEPTH: tooDeep.push(dir/e.name); continue
      visit(dir/e.name, depth + 1)
```

`isRunStateFile(name)` = `name === 'run.md' || VERSION_NAME.test(name)`; `currentRunStateFile(names) !== undefined` is exactly that over the list. Links (`kind: other`) are neither descended nor read. Results are in path order (sorted at each level). A `tooDeep` entry is every folder at depth 7, reached from a depth 6 folder that is not a run folder; it is reported whether or not it holds a run (a run there is hidden, which is why it is reported), once, and never as an error.

### 5.2 Three adapters

| Runtime | `list` | Where the walk lives |
|---|---|---|
| `run.ts` (auto-handoff) | `$.fs.list(inRepo(root, dir))` supplied by `register.tsx` `runLookup` (replaces the single `$.fs.list` and the `entries.filter(e => e.kind==='dir')` map at lines 302-325) | `walkRunFolders` exported from `run.ts` (engine-free); `runLookup` maps `walk.runs` to run states with the code at lines 311-324 unchanged (`parseRunState(text, folder)`, `folder` now the full relative path) |
| lens | `$.fs.list(d)` in `runFolders` (`ai-dlc-lens/hooks/register.tsx:383`) | a copy of the same function in `ai-dlc-lens/hooks/anomaly.ts` (beside `handoffsRoot`); `runFolders` returns `walk.runs` folders instead of the fixed-depth level; `handoffsRoot`'s `depth` field is kept but ignored by the walk (existing tests unchanged) |
| `workflow.mjs` | `fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })` | sync twin `walkRunFoldersSync(root, rootDir)` with the same loop; new command `node .ai-dlc/workflow.mjs runs [--json]` prints the found run folders, `tooDeep` warnings and duplicates (used by the validate step, the fixture test and the orchestrator's resume scan text) |

The copy in the lens is the same code with the `Entry` type from its own `ListEntry`. The three walks are held equal by the shared fixture (5.4) and nothing else: each walk carries the comment `// must give the results of tests/fixtures/handoffs-tree.json (see taxonomy.lld.md 5.4)`. There is no function-body comparison test (bc round 1, Major 2).

### 5.3 Unique run ids (`validate --artefacts` only)

The run id of a folder is its **name in lower case** (`runIdOf`, `lens.ts:986`). `run.ts` today takes `fm.run || folder name` (`run.ts:97`); the duplicate check uses the folder name only, so a run state whose `run:` differs from its folder name does not make the check and the readers disagree. `validate --artefacts` runs the walk and, for a name found twice, appends the error `<handoffs root>: run id "<id>" is used by two run folders: <path A> and <path B>` (AC-18.5.3), and for each `tooDeep` entry the warning `<path>: deeper than 6 levels under <handoffs root>; not read`. Plain `validate` runs neither (AC-18.2.1: the Stop gate must not block on a handoffs-tree problem). Readers (`run.ts`, lens) that find a duplicate take the first in path order and log `duplicate run id <id>: using <path A>, ignoring <path B>` once.

### 5.4 The shared fixture and how each suite loads it

The harnesses are sandboxed (`auto-handoff.test.tsx:27` "no file access"; the lens test fakes `fs.list`), so the CONDITIONAL in the spec resolves to the JSON-listing form: `tests/fixtures/handoffs-tree.json` is the contract:

```json
{ "root": "docs/handoffs",
  "tree": {
    "docs/handoffs": ["flat-run-20261001/", "epic-a/", "epic-b/", ".hidden/", "deep-a/"],
    "docs/handoffs/flat-run-20261001": ["run.v1.md", "1-x.handoff.md"],
    "docs/handoffs/epic-a": ["s1/"], "docs/handoffs/epic-a/s1": ["f/"], "docs/handoffs/epic-a/s1/f": ["nested-20261002/", "dup-20261003/"],
    "docs/handoffs/epic-a/s1/f/nested-20261002": ["run.md"], "docs/handoffs/epic-a/s1/f/dup-20261003": ["run.v1.md"],
    "docs/handoffs/epic-b": ["s1/"], "docs/handoffs/epic-b/s1": ["f/"], "docs/handoffs/epic-b/s1/f": ["dup-20261003/"], "docs/handoffs/epic-b/s1/f/dup-20261003": ["run.v1.md"],
    "docs/handoffs/.hidden": ["skipped-20261004/"], "docs/handoffs/.hidden/skipped-20261004": ["run.md"],
    "docs/handoffs/deep-a": ["b/"], "docs/handoffs/deep-a/b": ["c/"], "docs/handoffs/deep-a/b/c": ["d/"], "docs/handoffs/deep-a/b/c/d": ["e/"], "docs/handoffs/deep-a/b/c/d/e": ["f/"], "docs/handoffs/deep-a/b/c/d/e/f": ["g/"], "docs/handoffs/deep-a/b/c/d/e/f/g": ["toodeep-20261005/"], "docs/handoffs/deep-a/b/c/d/e/f/g/toodeep-20261005": ["run.md"]
  },
  "expected": {
    "runs": ["docs/handoffs/epic-a/s1/f/dup-20261003", "docs/handoffs/epic-a/s1/f/nested-20261002", "docs/handoffs/epic-b/s1/f/dup-20261003", "docs/handoffs/flat-run-20261001"],
    "tooDeep": ["docs/handoffs/deep-a/b/c/d/e/f/g"],
    "duplicateIds": [["dup-20261003", "docs/handoffs/epic-a/s1/f/dup-20261003", "docs/handoffs/epic-b/s1/f/dup-20261003"]]
  } }
```

(names ending `/` are folders, as the lens test fake already reads them; the `deep-a` chain has `g` at depth 7 holding a run folder at depth 8 and is reported once). Loading:

- `workflow.mjs` suite (`tests/workflow/handoffs-tree.test.mjs`): materialises `tree` in a temp directory (mkdir + empty files) and runs `runs --json` and `validate`; asserts `expected`.
- `run.test.ts` and `lens.test.tsx`: a copy of the JSON at `hooks/auto-handoff/tests/handoffs-tree.json` and `ai-dlc-lens/tests/handoffs-tree.json` is imported (`import tree from './handoffs-tree.json'`, with the `resolveJsonModule` the folder's `tsconfig.json` needs; build-time check) and fed to a `list` function built from `tree`; `walkRunFolders` is asserted against `expected`.
- `tests/workflow/fixture-copies.test.mjs`: the two copies are byte-equal to the root fixture (line endings normalised). If `import … .json` is not supported by `plugin test`, the copies become a `.ts` module `export default {...}` generated by the same test's `--write` helper; the equality test then compares the parsed object.

### 5.5 Text

`handoff` *Run state*: the resume scan paragraph (`SKILL.md:288`) reads "every run folder at any depth under the handoffs root, found by `node .ai-dlc/workflow.mjs runs`, stopping at a run folder, skipping dot-folders, to a depth of 6" (AC-18.5.2); the orchestrator's Run Loop step 1 uses `runs`. `orchestrator.md` adds `node .ai-dlc/workflow.mjs runs` to the list of the workflow reads that are not checks (ITEM-039, text).

## 6. D5: the sessions cell (ITEM-041)

```ts
export type SessionGroup = { chain: string; ids: string[] }
/** "0a1b2c3d: 0a1b2c3d, 4e5f6a7b; 8c9d0e1f: 8c9d0e1f" -> two groups. Empty, free text or any other format -> []. Never throws. */
export function parseSessions(cell: string): SessionGroup[]
```

- Split on `;`; each part must match `^\s*([0-9A-Za-z_-]+)\s*:\s*([0-9A-Za-z_-]+(?:\s*,\s*[0-9A-Za-z_-]+)*)\s*$`; ids split on `,`. A part that does not match drops the **whole** cell to `[]` (a cell is machine-readable or it is not; free text such as `` `s-1`, `s-2` `` has no colon and gives `[]`; every run written before this change reads as `[]`, AC-18.7.3). Backticks around the cell are removed first (the template writes them).
- `StageRow` gains `sessions: SessionGroup[]`. `parseStages` finds the column by header `norm(...) === 'sessions'` (the template header is `Sessions`); no such column: `[]` for every row.
- The lens has the same function in `lens.ts` beside `cellsOf` and `parseRun`; `LensRun` gains `sessions: Record<string, SessionGroup[]>` keyed by step code, filled in `parseRun`'s stages-table branch (the existing `stages` map is unchanged); the column index comes from the header row the function already detects (`inStages`).
- **Chain id and the `Chain:` line.** The chain id is `short(chain)` where `chain = own?.chain ?? sessionId` (`register.tsx` `handoff`, line 439) and `short` is the module's existing first-8-characters helper; sessions are `short(sessionId)`. `writeRunHandoff` (line 506) passes `chain` to `assembleSessionHandoff`, which writes a line `Chain: <short(chain)>` in the session handoff's header facts block (new parameter `chain: string` on `assembleSessionHandoff` and in `SessionHandoffInput`; the existing tests that call it pass it). Test seam: `AC-18.7.1` asserts the produced text contains the line, with the id equal to `short(chain)`.
- `handoff` skill text: *Run state* Stages table `Sessions` cell format with the example from the spec; the resumed orchestrator copies the `Chain:` line into the cell; a session with no handoff uses its own short id (AC-18.7.1).

## 7. D8 and D9: links and priority (ITEM-065, ITEM-066)

- **Keys.** A run state's front matter gains `tasks: [ITEM-037, …]` (parsed by `inlineList`). `work-item` is unchanged.
- **`taskRows(text)`**: scans the lines of a Markdown file for pipe tables; a table qualifies when its header row (cells lower-cased, non-letters removed) has both `item` and `run`; for each row the `item` cell is normalised (`/^(?:ITEM-)?0*(\d+)$/i` → the number as a string) and the `run` cell is trimmed (empty or `—` → no run). Other tables and a table without both columns are ignored.
- **`checkLinks(runs, taskFiles)`** (only with a declaration, via `--artefacts`): for each run with `tasks`, each id `ITEM-N` is looked up in all qualifying task tables (`N` normalised); found rows whose `run` is non-empty and not equal (case-insensitive) to the run id give the error `<run state path> names task ITEM-<N>, but <tasks file path> row <N> names run "<other>" (this run is "<id>")`, naming both files and both run ids (AC-18.9.2). A task with an empty `Run` cell, or an id found in no table, is a warning: `<run state path>: task ITEM-<N> has no Run in any tasks file` / `…is not found in any tasks file`.
- **Formats (text)**: `product-planning` *Item Format* / task format: the `Run` column; `task-triage` breakdown table the same column; `handoff` *Run state* `tasks:` key and the `Run` column rule (ITEM-065).
- **D9 priority order (text only)**: `orchestrator.md` Run Loop, Confirm step (and the generated `AGENTS.md` template source), and `handoff` *Run state*: run states for a breakdown with several items are written in priority order, then wave order within a priority (AC-18.10.1).

## 8. D6: `move-run` and lens resolution (ITEM-043)

```js
function moveRun(oldDir, newDir, today)    // pure plan; the command performs it
```

`node .ai-dlc/workflow.mjs move-run [--dry-run] <old dir> <new dir>` (paths relative to `--root` or absolute inside it):

1. Refuse (exit 1, nothing changed) when: `old` is not a directory; `old` holds no run state (`currentRunStateFile`); `new` exists; `new` is inside `old` or the reverse; either path leaves the repository root.
2. `fs.mkdirSync(path.dirname(new), { recursive: true })`, then `fs.renameSync(old, new)`; an `EXDEV` or any failure exits 1 with the message and leaves `old` in place (rename is atomic on one volume; no copy fallback).
3. Write `<new>/merged-from-<basename(old)>.md`: `---\nfrom: <old, repo-relative, forward slashes>\nto: <new, same>\ndate: YYYY-MM-DD\n---\n` (local date), no body. If the write fails, move back (`renameSync(new, old)`) and exit 1.
4. Print `moved <old> -> <new>; wrote merged-from-<name>.md`. `--dry-run` prints the same lines prefixed `would` and changes nothing.
5. Every other file name in the folder is unchanged (AC-18.8.2); the command touches no record.

**Lens resolution (AC-18.8.3).** `lens.ts` gains `movedHomeOf(dir, runDirs: readonly string[]): string | null` beside `mergedHomeOf`: the first of `runDirs` (path order) whose `runIdOf` equals `runIdOf(dir)` and whose normalised path differs from `dir`; null when none. `register.tsx` (line ~697-702, where `mergedHomeOf(d, folders)` is called for a stale folder) calls `movedHomeOf(d, found)` first, with `found` the D4 scan, and uses `mergedHomeOf` only when it returns null. `mergedHomeOf` is unchanged.

## 9. D10: this repository's declaration (ITEM-044)

Product data, written by `product-manager` (not agent-manager). `.ai-dlc/taxonomy.json` (`$schema` `./taxonomy.schema.json`, the schema file copied beside it by the `workflow` skill's install/upgrade when a declaration is created):

- Modules, submodules and integrations exactly as the table of AC-18.11.1 (ids `ai-dlc`, `multi-agent-workflow`, `cache-keepalive`, `auto-handoff`, `ai-dlc-lens`, `agent-cards-in-chat`, `agent-workflows`, `review-mods`, `diagramming`; `integration-1` joins `submodule:auto-handoff` and `submodule:cache-keepalive`; `integration-2` joins `module:ai-dlc` and `module:ai-dlc-lens`).
- Features, each under one submodule (the final list is pm's G1 question; this is the mandatory floor):

| Submodule | Features |
|---|---|
| `auto-handoff` | `auto-handoff-session-numbering`, `auto-handoff-setup`, `auto-handoff-configure`, `handing-off` |
| `cache-keepalive` | `keepalive-cache-status`, `cache-keepalive-setup`, `cache-keepalive-configure`, `statusline` |
| `multi-agent-workflow` | `taxonomy`, `aaw-variants`, `skills`, `agents`, `workflow-design`, `handoff`, `loop-design`, `commands`, `rules`, `hooks` |
| `diagramming` | `diagramming` |

- **ITEM-044.a** (product data, `product-manager`): tags written into the current run state of each open run (`run.v3.md` of this run and the others), the open backlog items, and the tier 1 files. Older run-state versions are untouched.
- **The scan finds 11 files on this repository** (`kind: user-stories` or `kind: tasks` under `docs/product`, 2026-10-24): the five tier 1 `stories.md` and five `tasks.md` (all tagged in their front matter, so they pass), and `docs/product/ai-dlc-lens/stories.md` (open, untagged: it would fail rule 4). Decision proposed for 044.a: tag it `module: ai-dlc-lens` and `submodule: agent-workflows` (its largest share) with no `feature`, as an interim until root 21 migrates it (root 21 then splits or retags it); if `product-manager` refuses a single submodule for a file that spans several, the alternative is an `exclude` list in the declaration, which is a spec change. Either way the file is named in the 044.a task so `--artefacts` exits 0.
- **ITEM-044.b** (CI, `agent-manager`): `.github/workflows/validate.yml` gets a step `node .ai-dlc/workflow.mjs validate --artefacts` after the existing validation (CI is code, so the sqa/code-review path applies).
- `validate --artefacts` on this repository exits 0 (AC-18.11.1, 18.11.2); the build quotes it.

## 10. AC to design to test

Seams: `tests/workflow/workflow.test.mjs` (CLI on temp trees), new `tests/workflow/handoffs-tree.test.mjs`, `fixture-copies.test.mjs`; `hooks/auto-handoff/tests/run.test.ts`; `ai-dlc-lens/tests/lens.test.tsx`. Test names begin with the AC id.

| AC | Element | Test or check |
|---|---|---|
| AC-18.1.1 | `checkTaxonomy` ok | `AC-18.1.1 two modules and two integrations validate` |
| AC-18.1.2 | checks 1 to 5 | `AC-18.1.2 duplicate id, unknown key, undeclared join: exit 1 and the message names file, key, id` (three cases) |
| AC-18.1.3 `[BV]` | schema content | `AC-18.1.3 the shipped schema and templates contain none of ai-dlc-lens, cache-keepalive, integration-1` (a scripted search over `templates/`) |
| AC-18.1.4 `[DC]` | `workflow` SKILL taxonomy section | add, rename, remove; id stable once used |
| AC-18.2.1 | no file → unchanged | the existing `tests/workflow/` tests pass unchanged; `AC-18.2.1 validate output equals a recorded output with no declaration` |
| AC-18.2.2 | optional fields | the existing `run.test.ts` and lens tests pass unchanged |
| AC-18.2.3 | no file, run state with `module: x` | `AC-18.2.3 a run state with module: x and no declaration: validate and validate --artefacts both exit 0 with no tag complaint` |
| AC-18.3.1, 18.3.2 `[DC]` | 3.4 | `handoff`, `product-planning`, `task-triage` sections |
| AC-18.3.3 | `checkTags` | `AC-18.3.3 undeclared module/submodule/feature/integration, submodule not under module, feature not under submodule: exit 1 and the path, key, id` (five cases), and `AC-18.3.3 an open artefact with no module fails` per artefact kind (run state, backlog item, stories, tasks); closed ones pass; the backlog template item in an HTML comment and in a code fence is not scanned |
| AC-18.3.4 | parsing | `run.test.ts`: `AC-18.3.4 a run state with none of the four keys parses with module undefined and integrations []`; lens: the same for `parseRun` |
| AC-18.4.1 `[DC]` | `task-triage` | columns and `needs-info` rule |
| AC-18.5.1 | `walkRunFolders` × 3 | `AC-18.5.1 the shared fixture gives expected runs` in `run.test.ts`, `lens.test.tsx` and `handoffs-tree.test.mjs`; `fixture-copies.test.mjs` keeps the fixture copies equal |
| AC-18.5.2 `[DC]` | 5.5 | the `handoff` resume scan |
| AC-18.5.3 | 5.3 | `AC-18.5.3 two runs with the same folder name under two sprints: validate --artefacts exits 1 naming both paths` (from the fixture's duplicate pair; plain validate still exits 0 on the same tree, pinned by AC-18.2.1) |
| AC-18.6.1, 18.6.2 | `pickRun` filter | `AC-18.6.1 two open runs, filter picks the module's`; `AC-18.6.2 no filter, {} and undefined give today's result over the existing cases`; `config.test.ts`: the `runModule` row parses |
| AC-18.7.1 `[DC]` + seam | 6 | skill text; `AC-18.7.1 the session handoff carries Chain: <short(chain)>` (`run.test.ts`) |
| AC-18.7.2 | `parseSessions`, lens copy | `AC-18.7.2 the example cell gives two groups` in both suites |
| AC-18.7.3 | tolerant parse | `AC-18.7.3 empty, free text, a part without a colon: sessions []` in both suites |
| AC-18.8.1, 18.8.2 | `move-run` | `AC-18.8.1 the new folder holds merged-from-<old>.md with from, to, date and no body`; `AC-18.8.2 every other file name is unchanged`; refusals (target exists, no run state, nested); `--dry-run` writes nothing |
| AC-18.8.3 | `movedHomeOf` | `lens.test.tsx`: `AC-18.8.3 a brief that names the old path resolves to the moved run by id`; and `mergedHomeOf` still resolves a merge (existing test) |
| AC-18.9.1 `[DC]` | 7 | `handoff` and `product-planning` text |
| AC-18.9.2 | `checkLinks` | `AC-18.9.2 a run and a task naming each other validate; a task naming another run fails naming both files and both run ids; 037 and ITEM-037 match` (fixture `tasks.md` with a table, as spec D8) |
| AC-18.10.1 `[DC]` | 7 | orchestrator and `handoff` text |
| AC-18.11.1 `[BV]` | D10 | `validate` on this repository with `.ai-dlc/taxonomy.json`: exit 0; a test compares the module, submodule and integration ids to the AC's table |
| AC-18.11.2 `[BV]` | D10 | `validate --artefacts` exits 0 on this repository; every tag value declared; the 11 files of section 9 are the scan |

**Existing tests that change:** `lens.test.tsx` tests of `runFolders`/`handoffsRoot` depth (the walk replaces the fixed depth; `handoffsRoot` still returns `{ root, depth }`, so they pass), the `run.test.ts` `runLookup` fakes in `auto-handoff.test.tsx` that give a single flat listing (the walk lists run folders; their fakes list the same entries, so they pass), and `assembleSessionHandoff` callers (new `chain` parameter). The build counts them with `grep -c`.

## 11. Tasks for `pm` (one per ITEM; groups)

| Item | Scope | Group, depends on |
|---|---|---|
| ITEM-037 | `taxonomy.schema.json`, `checkTaxonomy`, `validate` wiring, `workflow` SKILL taxonomy section, tests AC-18.1.x, 18.2.x | WF, after root 19 (…, 048, 051) |
| ITEM-038 | `checkArtefacts` and `checkTags`, `--artefacts`, readers (`frontMatterOf`, `backlogItems`, product-tree scan), run-state tag fields in `run.ts`/lens, tests AC-18.3.x | WF after 037; RUN for `run.ts`/lens parts |
| ITEM-039 | `walkRunFolders` (3 adapters), `runs` command, unique-id check, fixture + equality tests, `runLookup` and `runFolders` rewired, resume-scan text | RUN first; the `workflow.mjs` part joins WF after 038 |
| ITEM-040 | `pickRun` filter, `runModule` setting and its alignment files | RUN after 039 and 041 |
| ITEM-041 | `parseSessions`, `StageRow.sessions`, lens `parseRun`, `Chain:` line, skill text | HS then RUN: after 039; HS order 041 → 043 → 049 |
| ITEM-042 | `product-planning` and `task-triage` text | after 038 |
| ITEM-043 | `move-run`, `movedHomeOf`, `handoff` rule text, tests | HS after 041; the `workflow.mjs` part joins WF |
| ITEM-044.a | `.ai-dlc/taxonomy.json`, the tags, the 11-file list (section 9); the legacy `docs/product/ai-dlc-lens/stories.md` is tagged ai-dlc-lens / agent-workflows now and root 21 re-tags or splits it when it migrates the file | `product-manager`; after 037 to 043 and 065 |
| ITEM-044.b | the CI step | `agent-manager`; after 044.a |
| ITEM-065 | `tasks:` key, `Run` column, `taskRows`, `checkLinks`, text | after 038; HS |
| ITEM-066 | priority order text (orchestrator, `handoff`) | after 065 (same files) |

Splits for `pm`: ITEM-039 into 039.a (`run.ts` and fixture, auto-handoff) , 039.b (lens), 039.c (`workflow.mjs` `runs` and unique ids); ITEM-043 into 043.a (`move-run`) and 043.b (lens `movedHomeOf`). Every change to the `workflow` skill files is made by a freshly spawned agent-manager, in the WF order after root 19's 048 and 051.

## 12. Questions for `sa` (Refine)

Answered by sa and applied: `runs` accepted; unique ids and the walk run under `--artefacts` only; whole-cell `[]` accepted; HTML comments skipped; CI step is ITEM-044.b (agent-manager); `walk-copies.test.mjs` dropped.

1. **The legacy `docs/product/ai-dlc-lens/stories.md`** is open and untagged; the LLD proposes tagging it `ai-dlc-lens` / `agent-workflows` in 044.a (section 9) until root 21 migrates it. Confirm, or choose an `exclude` key in the declaration.

## 13. Risks

- The sandboxed harnesses cannot read repository files; the JSON-listing fixture with copies and the equality test is the mitigation. `import … .json` under `plugin test` is unverified: the fallback is a generated `.ts` module (5.4).
- The lens walk replaces a fixed-depth listing with a recursive one: for a deep non-run tree under the handoffs root it lists more folders than today. Bounded by depth 6 and by stopping at run folders.
- `validate --artefacts` is only as good as where it runs (CI, product-manager, build agents); the Stop gate does not run it by design (spec D2).
