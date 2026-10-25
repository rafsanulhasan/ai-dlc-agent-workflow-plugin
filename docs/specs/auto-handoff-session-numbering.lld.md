---
work-item: FEAT-20261020-ai-dlc-lens
root: 16
kind: lld
feature: auto-handoff-session-numbering
module: ai-dlc
submodule: auto-handoff
integrations: []
items: [ITEM-030, ITEM-031]
author: system-engineer
date: 2026-10-24
status: draft, round 2 (bc round 1 fixed; aligned with spec revision 2)
spec: docs/specs/auto-handoff-session-numbering.spec.md
stories: docs/product/active/session-continuity-and-cache-visibility/sprint-1/auto-handoff-session-numbering/stories.md
handoff: 16.1.1-software-architect-to-system-engineer.handoff.md
---

# LLD: auto-handoff session numbering (root 16)

Code lines are as read on 2026-10-24 (branch feat/ai-dlc-lens); the build re-checks them. Paths are under `plugins/claude/ai-dlc/hooks/auto-handoff/`. No code is written here.

## 1. Design summary

| Principle | Decision |
|---|---|
| Pure core, thin wiring | Two pure functions in `config.ts` hold every naming rule (D1, D2). `register.tsx` only reads the store, calls them and acts on the result. |
| One truth per handoff | The handoff computes a `Numbering` once and carries `next`, `base` and the notice in `Pending`. The seed step reads nothing from the store. |
| Total functions | `parseTitle` and `numbering` never throw and need no I/O, so the table tests in `config.test.ts` cover every branch. |
| Minimum change | `baseName`, `sessionName`, `renameOld` and `storedLineage`'s chain readers keep their contracts. |

## 2. `config.ts` (D1, D2)

```ts
/** The default session-name prefix: the one always stripped, besides the prefix in force (Q16-2). */
export const DEFAULT_SESSION_PREFIX: string = DEFAULTS.sessionNamePrefix   // '[ai-dlc:auto-handoff]'

export type TitleParts = { base?: string; number?: number }

/** D1. Reads a title into its base name and its number. Pure, total. */
export function parseTitle(title: string | undefined, prefix: string): TitleParts

/** Kept contract (AC-16.3.4): the base of a title, undefined when blank. */
export function baseName(title: string | undefined, prefix: string): string | undefined   // = parseTitle(...).base

export type Numbering = { current: number; next: number; isMain: boolean; source: 'title' | 'lineage' | 'default' }

/** D2. The current and the next number of a session. `depth` is the lineage depth of a *found* read, else undefined. */
export function numbering(titleNumber: number | undefined, depth: number | undefined, readFailed = false): Numbering
```

`parseTitle` algorithm:

1. `t = title?.trim()`; blank gives `{}`.
2. `number`: the integer `n` of the **last** trailing `\(Session (\d+)\)\s*$` match on the untouched `t`. Valid when `Number.isSafeInteger(n) && n >= 1`; otherwise there is no number. `P: B (Session 1) (Session 2)` gives 2.
3. `base`: loop until nothing changes: remove a trailing `\s*\(Session \d+\)$` (any `n`, so `(Session 0)` is stripped too), then remove a leading `^(?:<esc(DEFAULT)>|<esc(prefix)>):\s*`. Trim. Empty gives no base.
4. Only these two prefixes are stripped (AC-16.3.3). `X: B (Session 3)` has base `X: B`, number 3.

Behaviour change to flag: a title that is only `B (Session 3)` (no prefix) now parses to base `B`, number 3 (AC-16.3.5). Today `baseName` returned the whole title. This is intended (title wins).

`numbering` table:

| titleNumber | depth | current | source | isMain |
|---|---|---|---|---|
| n | any | n | title | false |
| undefined | d | d | lineage | false |
| undefined | undefined | 1 | default | true unless `readFailed` |

`next = current + 1`. `isMain` is true only in the last row and only when the read did not fail, so a `P: B` title with depth 3 is not main (AC-16.2.8) and a `P: B` title with nothing is main (AC-16.3.1).

`sessionName` is unchanged. It is always called with a base that `parseTitle` produced, or the short id, so the prefix appears once and one suffix is added (AC-16.3.2).

## 3. `register.tsx` wiring (D3 to D6)

### 3.1 Types

```ts
type LineageRead =
  | { state: 'found'; lineage: Lineage }
  | { state: 'absent' }
  | { state: 'failed'; error: string }

// Pending gains: next: number; notice?: Line   (baseName stays)
// handedFrom gains: notice?: Line
```

### 3.2 Reads (D3)

- New `readLineage($, id): Promise<LineageRead>`: `try { v = await $.store.get('lineage:'+id) } catch (e) { return { state:'failed', error: String(e) } }`; a value with string `from` and `chain` is `found` (shape check and `depth`/`baseName` typing exactly as `storedLineage` has them now, lines 345-354); anything else is `absent`.
- `storedLineage` becomes `readLineage` folded: `(await readLineage(...)).state === 'found' ? lineage : undefined`. Its callers `lineageOf`, `ancestors`, and the run lookup (line 347 users) see no change, so *failed* stays *absent* for them.
- The numbering path calls `readLineage` directly and never the in-memory `lineage` (spec D3, revision 3). The seed step writes `lineage:<new>` before the new session can hand off, so the store holds the same record, and the numbering path has one source that can fail visibly. `lineageOf` keeps its in-memory shortcut for the chain readers (`ancestors`, the run lookup). Cost: one `get` per handoff.

### 3.3 `handoff()` (lines 425-460), the order of work

1. `read = await readLineage($, sessionId)`; `own = read.state === 'found' ? read.lineage : undefined`.
2. `{ transcript, cwd } = await transcriptFor($, sessionId)`. This is lines 488-490 of `composeBrief` (`cwd = await $.session.cwd()` and the `transcriptPath ?? …` expression) moved into a helper that returns both, because the title needs the path before the brief is composed and `handoff` uses `cwd` (header, line 440). `composeBrief` receives `{ transcript, cwd }` as a parameter and no longer calls `$.session.cwd()`, so it is read once.
3. `title = await currentTitle($, sessionId, transcript)`; `parts = parseTitle(title, cfg.sessionNamePrefix)`.
4. `num = numbering(parts.number, own?.depth, read.state === 'failed')`.
5. `name = own?.baseName ?? parts.base ?? short(sessionId)` (the lineage carries the original base; D5 open question, default kept).
6. `notice = read.state === 'failed' ? numberingNotice(sessionId, read.error, num) : undefined`. When set: `await log($, notice.log)` once, here.
7. `composeBrief(..., depth = num.current, ...)`. Its `depth` parameter becomes `number` (never undefined). `header.depth = String(num.current)`; the brief fact `Handoff depth` is now always present.
8. `pending = { ..., baseName: name, next: num.next, notice: notice?.step }`.
9. The panel: `steps($, [...(notice ? [notice.step] : []), briefStep(problem), { mark: 'spin', text: 'clearing' }], notice?.toast)`. `steps` gains an optional third parameter `toast` passed to `showPanel` (today `steps` passes none; `addStep` is the only toast path, and a `steps` call replaces the step list, so a notice added earlier would be lost).
10. Rename: `if (cfg.renameSessions && num.isMain) await renameOld($, sessionId, sessionName(cfg.sessionNamePrefix, name, 1), title)`. `renameOld` is untouched (D4): its `/rename` availability check, timeout and failure logging stay.

Failed-read case (spec D2 rev 2): `isMain` is false when the read failed, so the old session is not renamed; the new session is still `current + 1` (Session 2 when the title has no number). On a failed read the chain id falls back to this session's id, as for absent (`own?.chain ?? sessionId`); the notice says the chain id restarted.

`numberingNotice` is a pure helper (in `config.ts`, testable without the engine):

```ts
export function numberingNotice(session: string, error: string, n: Numbering):
  { log: string; step: Line; toast: string }
```
- `log`: ``numbering fallback: lineage read failed session=${session} (${error}); ${n.source === 'title' ? `number ${n.current} taken from the title (Session ${n.current})` : 'number defaulted to 1, the title has none'}`` . The marker `numbering fallback:` is the first token and appears once.
- `step`: `{ mark: 'warn', text: 'numbering: store unreadable, ' + (n.source === 'title' ? 'number taken from the title' : 'number defaulted to 1') + ', chain id restarted' + (n.source === 'title' ? '' : ', session not renamed') }`. The `log` text carries the same clauses.
- `toast`: the step text (the panel's `toastOffBand` shows it off the band; on the band it shows nothing extra).

### 3.4 Seed step (lines 986-1008, D5)

- Delete `own = await storedLineage(p.oldSession)` and `prior` (lines 996-997).
- `lineage = { from: p.oldSession, chain: p.chain, depth: p.next, baseName: p.baseName }`; stored as `lineage:<new>`. A stored lineage always has a depth (AC-16.2.4).
- Naming: `if (cfg.renameSessions) { sessionTitle = sessionName(cfg.sessionNamePrefix, p.baseName, p.next); ... }` (drops `lineage.depth !== undefined`).
- `handedFrom = { ..., notice: p.notice }`. The `steps($, [...])` call at line 995 includes `p.notice`; `showHandedOff` (line 707) prepends `handedFrom.notice` to `lines`, so the warning is still listed after the fresh session's first measurement; the panel collapses on its own as usual (not sticky: D6 states one warn step and nothing about stickiness, bc Minor 1). No second log line and no second toast: the toast was sent once, at step 9.

### 3.5 Behaviour matrix (every AC row traced)

| Case | read | title | depth | current | old renamed | new named | stored depth |
|---|---|---|---|---|---|---|---|
| main | absent | `B` | none | 1 | `P: B (Session 1)` | `... (Session 2)` | 2 |
| `P: B` | absent | `P: B` | none | 1 | Session 1 | Session 2 | 2 |
| numbered | found 3 | `(Session 3)` | 3 | 3 | no | Session 4 | 4 |
| store lost | absent | `(Session 7)` | none | 7 | no | Session 8 | 8 |
| user renamed | found 2 | `(Session 7)` | 2 | 7 | no | Session 8 | 8 |
| no depth | found, no depth | `(Session 3)` | none | 3 | no | Session 4 | 4 |
| read fails | failed | `(Session 3)` | none | 3 | no | Session 4 | 4, one notice |
| title lacks number | found 3 | `P: B` | 3 | 3 | no | Session 4 | 4 |
| no prefix | any | `B (Session 3)` | any | 3 | no | `P: B (Session 4)` | 4 |
| `/rename` missing | any | `(Session 3)` | any | 3 | no call (not main) | Session 4 | 4 |
| failed, no number | failed | `B` | none | 1 | no (not proven main) | Session 2 | 2, one notice |

## 4. Records (D7, ITEM-031)

- `ATTRIBUTION.md`, *Session names* entry (today lines 144-155): state the title-wins rule, the main-session rule (only the main session is renamed), the no-nesting rule (only the default prefix and the prefix in force are stripped), the `numbering fallback:` log marker, and remove "a session without lineage is renamed Session 1 whatever its title".
- `skills/configure-auto-handoff/templates/auto-handoff.schema.json` (naming description, today line 65) and `.ai-dlc/auto-handoff.schema.json`: the same edit, byte-identical copies. Both are agent artifacts: agent-manager makes the edit in Wave 3; `configure-auto-handoff/SKILL.md:74-75` follows.
- Docs update: none (spec).

## 5. Test seams and tests

Seams (spec, *Test seams*): `tests/config.test.ts` for the pure core, `tests/auto-handoff.test.tsx` via `engine(...)` for the wiring. Observables: `calls.renamed`, `chainRounds` answers' `sessionTitle`, the seeded store (`lineage:<new>`), `calls.written[LOG_FILE]`, `band($)`, `calls.toasts`.

**New fake option** `failStore?: RegExp` on `engine`, pinned. `mock.store` is `(on, entries?) => void` and answers `store.get|set|delete|keys` from memory (`claude-code` types, `testing.mock.store`); it cannot be made to throw and does not expose its contents. So `engine` stops calling `mock.store` and registers the four store handlers itself over a `Map` seeded from `opts.store`: `store.get` (`async (_$, e) => { if (opts.failStore?.test(e.key)) throw new Error('store unreadable'); return { value: map.get(e.key) } }`), `store.set` (JSON round trip as the engine does, `JSON.parse(JSON.stringify(v))`), `store.delete`, `store.keys` (insertion order). `calls.store` exposes the `Map` so a test can assert the stored lineage records. Only one set of store handlers is ever registered, so there is no handler-precedence question. Existing tests keep passing because the handlers behave as `mock.store` does.

Test names cite the AC id (AC-16.5.1). Pure rows go in `config.test.ts` (`parseTitle`, `numbering`, `numberingNotice`); wiring rows in `auto-handoff.test.tsx` under `describe('session names')`.

| AC | Function / wiring | Test (name starts with the AC id) |
|---|---|---|
| AC-16.1.1 | `numbering` main, rename step 10, seed 3.4 | `AC-16.1.1 a main session is renamed Session 1 and the new one is Session 2` (adapts "the chain is named Session 1, 2, 3, 4 after the original name, never nested", `auto-handoff.test.tsx:1752`; checks `renamed` and the answer) |
| AC-16.1.2 | `?? short(sessionId)` | `AC-16.1.2 no title: the short id is the base` (keeps lines 1785-1790) |
| AC-16.2.1 | `numbering` row 1, rename gate | `AC-16.2.1 title Session 3, depth 3: new 4, no rename` (store seeded depth 3; `renamed` empty) |
| AC-16.2.2 | no lineage, title number | `AC-16.2.2 title Session 7 and no lineage: new 8, not renamed` (replaces :1766-1774) |
| AC-16.2.3 | title beats depth | `AC-16.2.3 title Session 7, depth 2: new 8` |
| AC-16.2.4 | `readLineage` found without depth, seed `depth: p.next` | `AC-16.2.4 lineage without depth: new 4, stored depth 4` (replaces :693-705; asserts `store['lineage:new-session-1'].depth === 4`) |
| AC-16.2.5 | `failed` read, `numberingNotice`, step 9 | `AC-16.2.5 a failed store read: new 4 and exactly one fallback notice` (`failStore: /^lineage:old-session$/`; count of `numbering fallback:` in `LOG_FILE` is 1 after the seed too; `band($)` contains the warn step; with `surfaces: ['vscode']` `calls.toasts` has the step once) plus a pure test `numberingNotice` text for both sources |
| AC-16.2.5b (design-level; no story id) | `numbering(…, readFailed)` | `AC-16.2.5b a failed read with an unnumbered title: new Session 2, no rename` (`failStore`; `renamed` empty; the notice says the chain id restarted) |
| AC-16.2.6 | the store record written at the seed | `AC-16.2.6 a seeded session resumed with the same id: new 5` |
| AC-16.2.7 | rename gate independent of `/rename` | `AC-16.2.7 no /rename and title Session 3: new 4` (extends :1792-1800 to the numbered title) |
| AC-16.2.8 | `numbering` row 2 | `AC-16.2.8 title without a number, depth 3: new 4, no rename` and the `numbering` table row in `config.test.ts` |
| AC-16.3.1 | `parseTitle` strips `P:`; main | `AC-16.3.1 a prefixed title without a number: Session 1 then 2, the prefix once` |
| AC-16.3.2 | `sessionName` over `parseTitle` | `AC-16.3.2 every name has the prefix once and one suffix` (loops over the starting titles of the wiring tests) |
| AC-16.3.3 | two-prefix strip | `AC-16.3.3 the old default prefix is stripped, another X: is kept` (pure `parseTitle` rows plus one wiring row) |
| AC-16.3.4 | `baseName` | `AC-16.3.4 baseName takes off nested wrappers` (extends :113-119 with `P: B`, `P: B (Session 2)`, `P: B (Session 1) (Session 2)`) |
| AC-16.3.5 | `parseTitle` suffix without prefix | `AC-16.3.5 a numbered title without the prefix: P: B (Session 4), no rename` |
| AC-16.4.1 | whole path | `AC-16.4.1 four handoffs give sessions 1 to 5` (`chainRounds($, calls, 4)`; answers are Session 2..5, `renamed` holds only Session 1) |
| AC-16.4.2 | store-only numbering read (3.2), title carries the number | `AC-16.4.2 the store fails at the third handoff: still 1 to 5`: one in-process chain with `chainRounds($, calls, 4)` after `SessionStart` title `Fix the parser`; `failStore: /^lineage:new-session-2$/` (the session making the third handoff, whose numbering read goes to the store); asserts answers Session 2 to Session 5, `renamed` holds only Session 1, and `numbering fallback:` occurs once in `LOG_FILE`. The fault fires because the numbering read never uses the in-memory lineage. |
| AC-16.5.1 | test suite | the two replaced tests above; `plugin test` passes |
| AC-16.5.2 | `ATTRIBUTION.md` | document check, no test |
| AC-16.5.3 | schema copies | ITEM-031 adds a byte comparison of `plugins/claude/ai-dlc/skills/configure-auto-handoff/templates/auto-handoff.schema.json` and `.ai-dlc/auto-handoff.schema.json` (`Buffer.equals`) and a check that the naming description contains `title` and `main session`, to `tests/auto-handoff/auto-handoff-agreement.test.mjs` (sa's choice; `node:test` and `node:assert` only). Today no test compares the copies (`auto-handoff-cli.test.mjs:73` checks existence; `settings-levels-aligned.test.mjs:15` reads the template alone). |

Extra pure tests: `parseTitle('P: (Session 3)')` has number 3 and no base (the caller uses the short id); `numbering(undefined, undefined, true)` is `{ current: 1, next: 2, isMain: false }`; `parseTitle('Fix (Session 0)')` has no number and base `Fix`; a 30-digit session number is not a number; blank and undefined titles give `{}`; a prefix that contains regex characters is escaped.

## 6. Risks and notes for sa

1. The numbering read always goes to the store (spec D3 rev 3), so a store failure is visible and testable at any handoff. The title carries the number across a failed read; after a hot reload the in-memory title map may be lost, then the title has no number and the stored depth (always written from now on) decides.
2. `Handoff depth` in the brief and header now equals the current number and is never absent; the test at `auto-handoff.test.tsx:704` (`not.toContain('Handoff depth')`) is the replaced test of AC-16.2.4.
3. A failed read never renames (spec D2 rev 2); the new session is still `current + 1`. Test row `AC-16.2.5b a failed read with an unnumbered title: new Session 2, old session not renamed, chain id restarted in the notice` (spec D2/D3 rev 2).
4. Moving the transcript-path computation out of `composeBrief` (3.3 step 2) is the one structural edit outside D1 to D7; it removes a title lookup after the brief and keeps `composeBrief` free of naming.

## 7. Task split for `pm`

- **ITEM-030**: `config.ts` (2), `register.tsx` (3), `failStore`, and the tests of section 5. One task; if `pm` splits it, the natural parts are 030.a (`config.ts` plus `config.test.ts`) and 030.b (wiring plus the engine tests, after 030.a).
- **ITEM-031**: section 4 plus the byte-comparison test added to `tests/auto-handoff/auto-handoff-agreement.test.mjs`, after ITEM-030 (merge group KA).
