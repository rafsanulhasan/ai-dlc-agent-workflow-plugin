---
work-item: FEAT-20261020-ai-dlc-lens
root: 20
kind: lld
feature: diagramming
module: ai-dlc-lens
submodule: diagramming
integrations: []
items: [ITEM-052, ITEM-053, ITEM-053.a, ITEM-053.b, ITEM-053.c, ITEM-054, ITEM-055, ITEM-056, ITEM-075]
evidence: docs/handoffs/FEAT-20261020-ai-dlc-lens/20.1.5-spike-t20.3a-metafile.md
author: system-engineer
date: 2026-10-25
status: draft revision 9 (17.1.55, fix round 6: DG m2 the ELK.js sentence wording source, m3 the claude-code-figures record; review status: critique round 6 done, edits checked by the orchestrator); revision 8 (17.1.46, gate critique round 3: DG M1 the deferred-kind oracle, M2 the notice source lines and tag forms, m4 the removed note; review status: awaiting critique round 4 / 4); revision 7 (17.1.41: gate critique round 2 fixes DG B1 merge order, M1 deferred-kind assertion, M3 file set, m2 cacheKey, m3, m4, m5, m6, m7, m8, and the elkjs source pointer in the notices; review status: awaiting critique round 3 / 3); revision 6 (17.1.32, gate-critique fix round for 20.1.l3.1: PNG scrub inside the renderer, pixel oracle, color-mix grammar, sprint-1 AC-20.5.3 rows, deferred-kind passthrough test, sprint-2 marks in section 4, the licence inventory); revision 5 (17.1.24: spike 20.1.5 results applied, sprint-1 scope Mermaid only, ITEM-054 and ITEM-055 parts marked sprint 2, sizes for 053.b, 053.c and 056); revision 4 (G2 OQ1 resolved: picture right after its fence; no layout setting), bc round 2 PASS on revision 3
spec: docs/specs/diagramming.spec.md
adrs: [ADR-0005]
stories: docs/product/active/ai-dlc-lens/sprint-1/diagramming/stories.md
handoff: 20.1.2-software-architect-to-system-engineer.handoff.md
---

# LLD: the lens diagramming submodule (root 20)

Design only. Code lines were read on 2026-10-24 under `plugins/claude/ai-dlc-lens/`; engine facts come from the gitignored 2.1.308 type copy (`.scratch/item28/tc/claude-code.d.ts`) and are provisional (the stories say so). Conditional parts are marked **CONDITIONAL** with their drop path.

## 1. Design summary

| Principle | Decision |
|---|---|
| Pure core | `hooks/diagram.ts` holds the pure functions: `findFences`, `texKind`, `scrubSvg` (the Svg path only, 2.2), `sanitiseSource`, `mermaidKind`, `reasonFor`, `fitCaps`, `layoutParts`, `cacheKey`. They take strings and return values; they import no engine type. |
| One impure shell | `registerDiagram(on)` is the only function with `$`: it reads settings, calls the renderer through `$.process.run`, reads and writes the cache with `$.fs`, and builds the tree from `$.ui.resolve(e)`. |
| Fail to the native drawing | Any throw in the hook returns `next(e)`; any renderer failure shows the source plus a one-line reason; no stack trace ever reaches the screen. |
| The surface is read from the element table | The hook asks `$.ui.resolve(e)` for `Image` (terminal) or `Svg` (desktop, VS Code, mobile) instead of switching on a surface name, so a new surface that has either element works. |
| Offline by construction | The renderer is a vendored bundle with no network code; the hook has no `fetch` or socket; sources are cleaned before and SVG output after. |

### 1.1 Scope after 2026-10-25 (human) and spike 20.1.5

Sprint 1 draws **Mermaid only**, to PNG (terminal) and SVG (other surfaces), with `resvg-wasm` and one bundled font. ITEM-054 (math, LaTeX/MathJax) and ITEM-055 (PlantUML) are **sprint 2**; every part of this LLD that only they need is marked *(sprint 2)* and is not built in sprint 1: the `math`/`texDiagram`/`plantuml` rows of `sanitiseSource`, the reasons `texDiagram`, `noJar`, `noJava`, `untrusted`, `missing`, the PlantUML security profile (3.2), the `math` and `plantuml` dispatch of `render.mjs`, the settings rows other than `diagramMermaid` (section 5), and the tests that name them (section 7). `findFences` keeps its whole grammar (cheap, pure, and the shared parser); in sprint 1 a fence of a deferred kind is drawn as its source, as if its setting were off (AC-20.9.2). Spike 20.1.5 (`docs/handoffs/FEAT-20261020-ai-dlc-lens/20.1.5-spike-t20.3a-result.md`) settled ITEM-053.a: resvg-wasm 2.6.2, a flatten step, the `@import` strip, Inter Regular, and the licence list (OQ3 adds BSD-2-Clause for `entities`, accepted by the human).

## 2. `hooks/diagram.ts` (pure)

```ts
export type FenceKind = 'mermaid' | 'math' | 'texDiagram' | 'plantuml'
export type Fence = { kind: FenceKind; source: string; closed: boolean; start: number; end: number; tag: string }
export type Segment = { text: string } | { fence: Fence }

/** D2. Splits one block's text into text and fence segments in order. */
export function findFences(text: string): Segment[]

/** math or texDiagram for a `latex` or `tex` fence body. */
export function texKind(tag: string, body: string): 'math' | 'texDiagram'
```

### 2.1 `findFences` grammar (the Terms of the stories, fixed)

Scan line by line, tracking whether the position is inside a non-diagram fence (a fence with another info string, for example `ts`) so that a `$$` or a `mermaid` line inside it is not a diagram:

1. **Fenced blocks.** An opening line matches `^( {0,3})(`{3,}|~{3,})\s*([A-Za-z0-9_+-]*)` . The tag is lower-cased. The block closes at the first line that starts with the same fence character repeated at least as many times, with at most 3 spaces of indent, and nothing else but spaces. Tags: `mermaid` → `mermaid`; `math` → `math`; `latex`/`tex` → `texKind` decides; `tikz` → `texDiagram`; `plantuml`/`puml` → `plantuml`. Any other tag is plain text (and its body is skipped for `$$` scanning).
2. **`texKind(tag, body)`**: `tikz` → `texDiagram`; for `latex`/`tex`, `texDiagram` when the body contains `\documentclass`, `\usepackage`, `\begin{document}` or `\begin{tikzpicture}` (a plain substring test), else `math`; a `math` fence is always `math` (AC-20.2.2, 20.2.3).
3. **Display math outside fences.** `$$ … $$` (the opening `$$` and the closing `$$` may be on one line or several; the body is non-empty) and `\[ … \]`. An opening with no closing delimiter in this text is `closed: false`. Single `$…$` inline math is never a fence.
4. **Closed.** A fenced block is closed when its closing line exists in this block of text. A block with no closing line runs to the end of the text with `closed: false` (AC-20.4.1 to 20.4.3).
5. **Output.** `Segment[]` covering the whole text: text segments between fences (possibly empty strings are dropped), fence segments with `start`/`end` offsets and `source` (the body, without the delimiters). A fence split across two `AssistantMessage` blocks cannot be seen (spike); each half is then a text or an open fence in its own block.
6. If there is no `closed` fence of an enabled kind, `registerDiagram` returns `next(e)` without further work (AC-20.1.4). "Enabled" is decided by the settings (section 5), so a disabled kind returns the native drawing (AC-20.9.2).

### 2.2 Cleaning, caps and reasons

```ts
export function sanitiseSource(kind: FenceKind, source: string): { source: string; removed: number }   // D5
export function scrubSvg(svg: string): string                                                          // D5 output filter
import { SVG_CAP } from './avatar.ts'                                                                  // avatar.ts:13, one definition (not repeated)
export const PNG_CAP = 2 * 1024 * 1024
export function fitCaps(format: 'svg' | 'png', body: string, bytes: number): { ok: true } | { ok: false; reason: string }
export function reasonFor(code: ReasonCode, detail?: string): string                                  // one line, at most 120 characters
```

- **`sanitiseSource(kind, source): { source: string; removed: number }`** (sprint 1 builds the `mermaid` row only; the `plantuml` and `math` rows are *sprint 2*, ITEM-054/055) (spec D5; the spec corrects the stories' reference to `classify`, which classifies one avatar setting value and cannot clean text). One pure function; the pattern table below has one row per pattern in the pure-seam test table; `removed` counts the removals:

  | Kind | Removed (the whole line, or the matched fragment) |
  |---|---|
  | `plantuml` | every `!include`, `!include_many`, `!include_once`, `!includeurl`, `!includesub`, `!import` form (all, whether the argument is a URL or a path: the security profile is the real control, stripping is the backstop, sa/bc round 2); `<img:http…>` and `<img:https…>`; a `sprite` definition loaded from a URL (`sprite $x <url>`); `!theme <name> from <url>` |
  | `mermaid` | a `click <id> href "<url>"` line; a `click <id> "<url>"` line (the form without `href`, decided: covered, because Mermaid treats a bare quoted target as a link); `<img src="…">` in a label; `![alt](url)` in a label. A `click <id> call fn()` line and a plain `http://…` word in a label are ordinary text and stay |
  | `math` | `\href{…}{…}` (keeps the text argument), `\url{…}`, `\includegraphics[…]{…}` |

  Matching is case-insensitive for PlantUML directives and exact for the LaTeX macros. A removal never touches ordinary label text. Each removal adds one to `removed`; the diagram still renders. The hook shows one dim note **under the picture** (sa/bc round 2): `removed N remote reference(s)`, only when `removed > 0` and a **picture** was produced, matching 4 step 5 (a fence that ends as a reason line shows no note; `removed` is the number `sanitiseSource` returned for that fence, computed by the hook before the cache lookup, so the note shows on a cache hit too; the renderer envelope carries no such field); it is a note, not a failure.
- **`mermaidKind(source)`**: the first non-comment keyword of a Mermaid source (`flowchart`, `graph`, `sequenceDiagram`, `classDiagram`, `stateDiagram`, `stateDiagram-v2`, `erDiagram`, `xychart-beta`, …). A kind outside the supported list gives the reason `unsupportedMermaid` and the renderer is not run (spec D3).
- **`scrubSvg(svg)`**: drops every `href` and `xlink:href` attribute whose value is not a fragment (`#…`) or a `data:` URI; drops `<script>`, `<foreignObject>`, `<iframe>`, `<object>`, `<embed>` elements and every `on*=` attribute and `javascript:` value (the host scrubs too; this is defence in depth). It also **removes every CSS `@import` rule and every `url(...)` in a `<style>` block or `style` attribute whose target is not a fragment (`#...`) or a `data:` URI** (spike 20.1.5, finding B: every beautiful-mermaid SVG carries `@import url('https://fonts.googleapis.com/css2?family=Inter...')` in its `<style>`), on every surface. **What is removed is the whole declaration (`property: …url(…);`) or the whole at-rule (`@import …;`), never only the `url(...)` token, so no dangling `property: ;` remains (17.1.l3 Minor 17); the rest of the `<style>` stays and is tested to still parse (the fixture's remaining rules are asserted byte for byte).** It leaves the rest untouched, so `xmlns="http://www.w3.org/2000/svg"` stays (which is why the AC-20.5.2 search excludes `renderer/vendor/`). **Where it runs, per path (17.1.l3 Major 1).** `scrubSvg` in `hooks/diagram.ts` runs on the **Svg path only**, in the hook, on the `body` of an SVG envelope. The **PNG path never reaches the hook with an SVG**: resvg runs inside `render.mjs`, so the hook receives only the finished PNG. `render.mjs` therefore runs its own strip before rasterising: `renderer/scrub.mjs` (plain JS, pure, no dependency; the hook's TypeScript cannot be imported by the child, and the child's `.mjs` is not imported by the hook), applied to the flattened SVG, which is also the SVG handed to resvg (the second line of defence after `flattenSvg` drops the `<style>` block). The two scrubs are one rule table written twice, so one data file, `tests/fixtures/scrub-cases.json` (input SVG, expected SVG), is read by both test files and a case added there is run on both: the hook test in `tests/diagram.test.ts` and the renderer test in `tests/lens-renderer/scrub.test.mjs`. AC-20.5.4's PNG half is testable only in `tests/lens-renderer/` (it asserts on the SVG that `render.mjs` passes to a stubbed rasteriser, or on `scrub.mjs` plus `flatten.mjs` over the fixture); its Svg half is the hook test. Neither scrub names a host: they match `@import` and non-fragment `url(`, so the AC-20.5.2 search finds no literal in a comment or a rule.
- **`fitCaps`**: svg over 131,072 characters → reason code `svgCap`; png whose decoded size exceeds 2 MiB → `pngCap`.

Reason texts (literal, `reasonFor`), shown under the source as a dim one line, each at most 120 characters (a longer detail is cut with `…`):

| Code | Text |
|---|---|
| `svgCap` | `diagram too large to draw (over 131072 characters)` |
| `pngCap` | `diagram too large to draw (over 2 MiB)` |
| `syntax` | `diagram not drawn: <first line of the renderer's error>` |
| `texDiagram` | `TeX diagrams are not supported; only math is drawn` |
| `noNode` | `diagram renderer needs node on PATH` |
| `noJar` | `PlantUML not drawn: set plantumlJar (and javaPath if java is not on PATH) in .ai-dlc/lens.json` |
| `noJava` | `PlantUML not drawn: java not found; set javaPath in .ai-dlc/lens.json` |
| `untrusted` | `PlantUML not drawn: <jar or java> is outside the folders Claude Code trusts` |
| `missing` | `PlantUML not drawn: <jar or java> does not exist` |
| `noRaster` | `no PNG rasteriser for this platform` |
| `noFont` | `diagram text could not be rendered (no font)` |
| `unsupportedMermaid` | `mermaid diagram type "<x>" is not supported offline` |
| `refsRemoved` (a note under the picture, not a reason) | `removed <N> remote reference(s)` |
| `rendering` | `rendering…` |
| `failed` | `diagram not drawn: renderer failed` |

*(sprint 2)* the reasons `texDiagram`, `noJar`, `noJava`, `untrusted` and `missing` belong to ITEM-054/055 and are not built in sprint 1. `noRaster` now means only "the WebAssembly rasteriser failed to load" (3.3; its text is unchanged).

AC-20.3.2 *(sprint 2)* (restated by the spec): `noJar` when `plantumlJar` is unset, `noJava` when `javaPath` is unset and `java` is not found on PATH (found by `$.process.run(['java', '-version'])` exit 0, cached for the session). The reason names what is missing and how to configure it. **Once per message:** the `noJar`/`noJava` notice is shown for the first PlantUML fence of a message only; later PlantUML fences of the same message show their source with no reason line (spec D6 minor; `layoutParts` takes `noticeShown: Set<ReasonCode>`).

### 2.3 Placement (G2 resolved OQ1: right after the fence; no setting)

```ts
export type Part = { md: string } | { source: Fence } | { picture: Fence } | { reason: string }
export function layoutParts(segs: Segment[], outcome: (f: Fence) => Outcome, noticeShown?: Set<ReasonCode>): Part[]
```

- The only placement: for each text segment a `md` part; for a closed fence of an enabled kind the `source` part (the fence as it was written) then its `picture` or `reason` part; an open or disabled fence is a `source`-only part (`md` of the original text, no picture, no reason; AC-20.4.1 shows nothing for it, AC-20.4.3 shows source only).
- A pure function, table-tested for 0, 1 and 3 fences, an open fence and a disabled fence. The `belowReply` layout and the `diagramLayout` setting are removed (sa, after G2: a one-value setting is dead config).

## 3. The renderer process (ADR-0005)

`plugins/claude/ai-dlc-lens/renderer/render.mjs` with `renderer/vendor/` (pre-built bundles) and `renderer/BUILD.md` (how the vendor bundle is produced, how to rebuild it and compare the result with the checked-in files (sa, round 2); the bundle is generated once with `esbuild` outside the plugin build and checked in; no runtime install).

### 3.1 Protocol

```
node <root>/renderer/render.mjs --kind mermaid|math|plantuml --format svg|png [--java <path> --jar <path>]
stdin:  the (cleaned) source, UTF-8
stdout: exactly one JSON line, the envelope
  { "data": { "format": "svg"|"png", "body": "<svg…>" | "<base64>", "width": <px>, "height": <px> }, "error": null }   // no `removed`: the count comes from the hook's `sanitiseSource` (section 2.2), never from the renderer
  { "data": null, "error": "<one-line reason>" }
exit:   0 whenever an envelope was written (an error is a normal result); 2 for a usage error (also an envelope)
```

- `<root>` is `$.plugin.root` (`register.tsx:2529` uses it for the probe log); the hook passes `join(root, 'renderer/render.mjs')`.
- `$.process.run(argv, { stdin, timeoutMs })` (types: `ProcessRunInit` has `stdin`, `timeoutMs`; default 30 s; the hook sets 20 s for mermaid/math, 30 s for plantuml). stdout is capped at 4,194,304 bytes by the engine; a PNG of at most 2 MiB is about 2.8 MiB of base64, which fits; larger output is `isStdoutTruncated` → the hook treats it as `pngCap`/`svgCap`.
- Dispatch inside `render.mjs` (sprint 1: `mermaid` only; the `math` and `plantuml` branches are *sprint 2*): `mermaid` → beautiful-mermaid `renderMermaidSVG` (flowchart, sequence, class, state, ER, plus XY; the five of AC-20.1.5 are the floor, the kind is the diagram's first keyword) with ELK for layout, called with **explicit** `bg, fg, line, accent, muted, surface, border` colours (spike finding A: they fix the `color-mix()` inputs; the values are one constant table in `render.mjs`); *(sprint 2)* `math` → MathJax `tex2svg` (SVG output, no CHTML); `plantuml` → `spawn(java, ['-Djava.awt.headless=true', '-jar', jar, '-tsvg', '-pipe', …profile])`; `--format png` → the SVG through the flatten step and the rasteriser (3.3). `width`/`height` are the SVG's `viewBox` size (px), used for the terminal's `columns`/`rows`.
- Errors: a parse error → `error` with the renderer's first message line (`syntax`); the hook shows it through `reasonFor('syntax', error)`.
- **Font (decided by spike 20.1.5).** **Inter Regular**, SIL OFL-1.1 ("Copyright 2020 The Inter Project Authors"), `renderer/vendor/fonts/Inter_400Regular.ttf` (342,408 bytes) with `OFL.txt` (4,377 bytes), taken from npm `@expo-google-fonts/inter` 0.4.2 (static TTF; the package is MIT AND OFL-1.1). Inter Bold (344,072 bytes) is **not bundled**: Regular alone is enough, and a bold label renders in the Regular weight on the terminal (a known, accepted difference; resvg may synthesise a heavier face, observed at 053.b). `render.mjs` loads it with `fontBuffers: [readFileSync(...)]`, `loadSystemFonts: false`, `defaultFontFamily: 'Inter'`. If the font fails to load, `--format png` returns the envelope error `no font` and the hook shows the source with the `noFont` reason; SVG output (other surfaces) is unaffected, because those surfaces draw text with their own fonts (after `scrubSvg` the `@import` is gone, so Inter is not fetched; the surface falls back to its own font).
- The renderer reads no environment variable except `PATH` resolution done by `spawn`, opens no socket, writes nothing to disk. Its bundles contain no URL fetch (checked by the 5.2 tests).

### 3.2 PlantUML security profile *(sprint 2, with ITEM-055; unresolved by spike 20.1.5)*

Not built in sprint 1, and not measured: the spike found no Java on its machine (`java -version`: command not found), which ITEM-055 must account for in its own spike. The text below is the design to confirm then.

053.a checks whether the installed PlantUML offers a security profile that blocks includes and URLs (`PLANTUML_SECURITY_PROFILE=SANDBOX` / `-DPLANTUML_SECURITY_PROFILE=…`, version-dependent). Pass: the renderer sets it in the child's `env`. Fail: the renderer removes `!include`/URL lines before the call (the same `sanitiseSource` rules, applied inside the renderer as the second line of defence) and sets `removed: true`; the hook shows the one-line notice `PlantUML includes and links were removed` only if the render fails. **Order of sanitising and profile (bc round 1, Major 5):** the hook **always** runs `sanitiseSource` before the source reaches the renderer (so every `!include*`/`!import*` form is gone whether or not a profile exists), and the profile, when 053.a finds one, is set in addition as the real control for anything the jar would still resolve; on the fail branch (no profile) the renderer runs `sanitiseSource` again on stdin as the second line of defence and sets `removed` from the count it removes beyond the hook's. The note `removed N remote reference(s)` counts both.

### 3.3 PNG rasteriser and the flatten step (decided by spike 20.1.5)

- **Rasteriser: `@resvg/resvg-wasm` 2.6.2** (MPL-2.0; `index_bg.wasm` 2,478,606 bytes and `index.mjs` 17,048 bytes, one `.wasm` for every platform), vendored in `renderer/vendor/`. `render.mjs` loads it offline: `await initWasm(readFileSync(join(here, 'vendor/index_bg.wasm')))` (a Buffer, so the package never calls `fetch`; the spike ran it in Node 24.11.1 with `globalThis.fetch` replaced by a function that throws, no attempt, render OK). The init runs once per `render.mjs` process. The first-choice drop path (`@resvg/resvg-js`, per-platform `.node` modules) is **dropped**: not needed, no per-platform vendoring. The reason `noRaster` is kept only for a wasm that fails to init (the envelope error `no PNG rasteriser`), shown as before.
- **Flatten step (new; spike finding A).** beautiful-mermaid SVGs use CSS `var()` and `color-mix()`; resvg draws such shapes all black. Before rasterising, `flattenSvg(svg: string): string` (plain JS in `renderer/flatten.mjs`, pure, no dependency, about 20 lines in the prototype `.scratch/t20.3a/renderer/flat.mjs`) (1) reads the custom properties of the root `<svg style>`/`<style>` block, (2) substitutes every `var(--x)` and `var(--x, fallback)`, (3) evaluates `color-mix(...)` to a hex colour (grammar below), (4) drops the whole `<style>` block (which also drops the `@import`) and replaces it with one rule, `text { font-family: Inter }` (the font bundled, 3.1), and (5) returns an SVG with no `var(`, no `color-mix(` and no `@import`. Because `renderMermaidSVG` is called with explicit colours (3.1), every mix input is a known literal. `flattenSvg` is exported and unit-tested without the wasm.

  **Accepted grammar (17.1.l3 Major 4), and what throws.** An unknown or unsupported form makes `flattenSvg` throw one line (`flatten: <what>`) and the render ends as `failed` (never a black picture; the prototype's `?? '#000'` fallback for an unknown property is **removed**: it was the black-shapes bug).

  - `var(--name)` and `var(--name, fallback)`: `name` is `[a-z0-9_-]+` (any case); the fallback may hold balanced parentheses; `var()` may sit inside a `color-mix` operand or around a whole `color-mix`; resolution repeats until nothing changes, at most 8 passes (then `flatten: custom property depth`). An unknown name with no fallback throws `flatten: unknown property --name`.
  - `color-mix(in srgb, C1 [P1%], C2 [P2%])`, exactly two operands. A colour operand `C` is `#rgb` or `#rrggbb` in any case (after `var()` substitution), or a nested `color-mix(...)`, evaluated first (inner to outer). A percentage is a number from 0 to 100 inclusive, decimals allowed. Weights: none given, 50 and 50; only `P1`, `C2` gets `100 - P1`; only `P2`, `C1` gets `100 - P2`; both given must sum to 100, else throw. Each channel is `round(c1 * w1 + c2 * w2)` with `Math.round` (half up) over the 0 to 255 values, written as lowercase `#rrggbb`.
  - Throws: any `in` space other than `srgb` (`oklch`, `hsl`, `lab`, `srgb-linear`), a named colour, `rgb()`/`hsl()`, an 8-digit hex, `transparent`, `currentColor`, a missing or third operand, a percentage outside 0 to 100 or not a number, both percentages not summing to 100.

  **Numeric rows (each is one table-test row; the expected value is the literal, computed by hand):**

  | Input | Expected |
  |---|---|
  | `color-mix(in srgb, #000000 50%, #ffffff)` | `#808080` (127.5 rounds to 128) |
  | `color-mix(in srgb, #000, #fff)` (no percentage, 3-digit hex) | `#808080` |
  | `color-mix(in srgb, #ff0000 25%, #0000ff)` | `#4000bf` (63.75 to 64; 191.25 to 191) |
  | `color-mix(in srgb, #000000, #ffffff 25%)` (only `P2`: `C1` gets 75) | `#404040` (63.75 to 64) |
  | `color-mix(in srgb, #102030 100%, #ffffff)` | `#102030` |
  | `color-mix(in srgb, #27272A 15%, #F4F4F5)` (the spike palette, upper-case) | `#d5d5d7` (213.25, 213.25, 214.55 round to 213, 213, 215) |
  | `color-mix(in srgb, color-mix(in srgb, #000000 50%, #ffffff) 50%, #ffffff)` (nested) | `#c0c0c0` (128 and 255 give 191.5, rounds to 192) |
  | `--a: #000000;` then `color-mix(in srgb, var(--a) 50%, #ffffff)` | `#808080` |
  | `var(--m)` with `--m` unset and no fallback; `color-mix(in oklch, #000 50%, #fff)`; `color-mix(in srgb, red 50%, #fff)`; `color-mix(in srgb, #000 60%, #fff 60%)`; `color-mix(in srgb, #000 120%, #fff)` | each throws (the message names the cause) |
- **PNG path (all inside `render.mjs`; fixed 17.1.l3 Major 1):** `renderMermaidSVG` → `flattenSvg` → `scrub.mjs` (the renderer's own strip, 2.2) → resvg `render()` → PNG; the hook gets the PNG envelope and runs only `fitCaps` on it (no `scrubSvg`: there is no SVG on the hook side) (width/height from the SVG `viewBox`, 3.1). PNG tests are **un-skipped** (spike: magic `89504e47`, 9.4 KB to 21 KB; timings on the spike machine: bundles plus wasm load 414 ms, first Mermaid SVG 345 ms (ELK), rasterise 181 ms; the 300 ms render budget (3.4) means a first render shows `rendering...`, as the risks say).
- Sizes: sprint-1 `renderer/` is 4,745,092 bytes in the spike (4.53 MiB; threshold 15 MB, PASS) before `render.mjs`, `flatten.mjs` and the dropped Inter Bold; with Bold not bundled it is about 4.4 MB.

### 3.4 Cache and the render budget

- **Key.** `cacheKey(kind, format, rendererVersion, source) = <kind>-<format>-<fnv1a64(rendererVersion + '\0' + source) as 16 hex chars>-<source.length>`. The hooks module has no crypto import guaranteed (it cannot load npm packages); one FNV-1a 64-bit hash over UTF-16 code units (16 hex characters, no second seed) is enough for a local cache (a collision shows one wrong picture; the length is part of the key). `rendererVersion` is the plugin's `version` read once.
- **Store.** In memory first (`Map`, 64 entries, least recently used), then on disk under `~/.claude/state/ai-dlc-lens/diagrams/<key>.json` (the envelope's `data`), written with `$.fs.write`. Bound: 200 files; on a write that makes it more, list the folder and delete the oldest by `mtimeMs` until 200 remain. A read or write failure is ignored (cache miss). A cache file that does not parse as the envelope data, or whose `format` differs from the key, is a miss and is overwritten.
- **Budget.** `RENDER_WAIT_MS = 300` (spec: at most 300 ms; a named constant). A cache hit (memory or disk) is drawn at once. Otherwise the hook starts the renderer and awaits it with `Promise.race([render, wait(RENDER_WAIT_MS)])` using `$.clock.after`. A render done in time is drawn in this render. Otherwise this render shows the source plus the `rendering…` line, and the render continues in the background. **When it finishes the hook stores the result and calls `$.ui.invalidate('ui.render')` exactly once for that fence result** (`invalidate: (event: InvalidatableEventName) => void`, `claude-code.d.ts:2396`; its doc at :4099 names `$.ui.invalidate("ui.render")` as a repaint trigger; the auto-handoff panel uses the same call, `plugins/claude/ai-dlc/hooks/auto-handoff/register.tsx:699,706,714`; the lens `register.tsx` has none). The repaint runs the hook again and finds the cache entry. Concurrent renders of one key share a single promise, so one result produces one invalidate. If a later engine drops the call, the picture appears on the next render the host makes for its own reasons (spec: documented limitation).

## 4. The hook (`registerDiagram`)

```ts
export function registerDiagram(on: Register): void
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => { … })
```

Registered from `hooks/register.tsx` beside the other `ui.render` hooks (line ~3198 area), in its own call so a fault in it cannot affect them. Steps:

1. `try {` … `} catch { return next(e) }` around everything (AC-20.6.4).
2. `cfg = await settingsNow($)` (section 5). Sprint 1: if `diagramMermaid` is off, `return next(e)`; the only candidate kind is `mermaid`. *(Sprint 2: if all three kinds are off.)*
3. `segs = findFences(String(e.props.text))`. **Sprint 1: a fence of a deferred kind (`math`, `texDiagram`, `plantuml`) is never a candidate**: `outcome` is not called for it and `layoutParts` gets it as a source-only part, so the `texDiagram`, `noJar`, `noJava`, `untrusted` and `missing` branches of 4.1 never run. If there is no closed `mermaid` fence, `return next(e)` (so the tree is exactly the engine's, AC-20.1.4, 20.4.1, 20.9.2).
4. For each closed, enabled fence compute `outcome(f)` (4.1), concurrently (`Promise.all`, at most 3 renderer processes at once). **One shared deadline for the whole render:** `deadline = now + RENDER_WAIT_MS` is taken once at the start of this step and every fence awaits against that same deadline, so three uncached fences together never hold a redraw longer than `RENDER_WAIT_MS` (300 ms), not 3 x 300 ms. A fence not done at the deadline becomes `rendering…` and continues in the background.
5. `const t = $.ui.resolve(e)`; `{ Box, Markdown, Text, Image, Svg }`. `parts = layoutParts(segs, outcome)`. Build one `Box flexDirection="column"` with, per part: `md` → `<Markdown text=…/>`; `source` → `<Markdown text={original fence text}/>`; `picture` → `<Image source={{ png: body }} columns rows alt/>` when `t.Image`, else `<Svg source alt width? height?/>` when `t.Svg`; `reason` → `<Text dimColor>{reason}</Text>`; after a picture whose `removed > 0`, `<Text dimColor>removed N remote reference(s)</Text>`.
6. `columns = clamp(ceil(width / 8), 1, 255)`, `rows = clamp(ceil(height / 16), 1, 255)` (a nominal 8×16 px cell; the engine scales the picture to the box, so the values are hints). `alt` = `<kind> diagram: <first line, at most 80 chars>`.
7. The stored message is never changed (ctrl+o shows the original).

### 4.1 `outcome(f)`

```
kind off in settings           -> not a candidate (step 3)
(sprint 2) texDiagram           -> { reason: 'texDiagram' }                      (no process)
(sprint 2) plantuml: jar unset  -> noJar; java unset and not found -> noJava;
          path not inside trustedFolders (avatar.ts trustedFolders/isInside, resolved with $.fs.stat(.., { resolve: true }) as register.tsx:586 does) -> untrusted;
          stat fails -> missing
(sprint 1: none of the three lines above is reachable; deferred kinds are not candidates, step 3)
mermaid with a kind outside the supported list (`mermaidKind`) -> unsupportedMermaid (the renderer is not run)
node missing (`$.process.run(['node','--version'])` exit != 0, cached per session) -> noNode
format = t.Image ? 'png' : t.Svg ? 'svg' : none   (none -> source + reason 'this surface draws neither images nor SVG')
cached? -> use it; else run (budget 3.4)
result: error "no font" -> noFont; "no PNG rasteriser…" -> noRaster; other error -> syntax | failed; format svg: scrubSvg then fitCaps; png: fitCaps(png, bytes)
```

Every outcome is `{ picture: {format, body, width, height} } | { reason }`; one fence's failure does not affect the others.

## 5. Settings (D6)

`hooks/settings.ts` `SPEC` gains (same pattern as the others; `envName` makes `AI_DLC_LENS_DIAGRAM_MERMAID` etc.). **Sprint 1 adds `diagramMermaid` only** (053.c); `diagramMath`, `diagramPlantuml`, `plantumlJar` and `javaPath` are *sprint 2* (054/055), so a deferred kind has no setting to switch on and is drawn as source (1.1; sprint 1 is AC-20.9.1a and AC-20.9.2a (Mermaid only), sprint 2 is AC-20.9.1 and AC-20.9.2):

```ts
diagramMermaid:  { kind: 'bool', def: true,  doc: 'Draw closed mermaid fences as pictures (offline)' },
diagramMath:     { kind: 'bool', def: true,  doc: 'Draw closed math fences and display math as pictures (bundled MathJax, offline)' },
diagramPlantuml: { kind: 'bool', def: true,  doc: 'Draw closed plantuml fences with a local Java and plantuml.jar; takes effect only with plantumlJar set' },
plantumlJar:     { kind: 'path', def: '',     doc: 'Path of plantuml.jar; must be inside a folder Claude Code trusts' },
javaPath:        { kind: 'path', def: '',     doc: 'Path of the java executable; empty: java on PATH' },
```

`plantumlJar` and `javaPath` are paths in the lens's `path` kind (trust-gated like `costingPath`: the lens `coerce` for `kind: 'path'` and the trusted-folder check at use). AC-20.9.1 *(sprint 2)*: with no setting, Mermaid and math are on, PlantUML is on but draws only with a jar. **Sprint 1 adds one settings row, `diagramMermaid`, and AC-20.9.1a (Mermaid on, nothing else exists); AC-20.9.1 and the other four rows are sprint 2.** The `lens-configure` skill's listing of settings and the lens schema (if the skill ships one) gain the one row in sprint 1 (five in sprint 2); `settings.test` style checks (`lens.test.tsx` has one pinning `SPEC` keys against the README table) change with them (build counts the pinned tests).

## 6. Offline proof (US-20.5)

- AC-20.5.1: the lens test stubs `globalThis.fetch`, `net.connect`-level calls are not reachable from the hooks module; the test stubs `fetch` to record and throw, stubs `process.run` with the fixture envelopes, renders one fence of each kind, and asserts zero recorded attempts. The renderer-level proof is in `tests/lens-renderer/offline.test.mjs`: it runs `render.mjs` with `NODE_OPTIONS=--require <stub.cjs>` where the stub replaces `fetch`, `http.request`, `https.request`, `net.Socket.prototype.connect` and `dns.lookup` with recorders that fail, renders each fixture, and asserts none was called.
- AC-20.5.2 `[BV]` (one host list and one file set, as spec D5 and stories rev 6): `tests/lens-renderer/no-remote-hosts.test.mjs` reads `hooks/**/*.ts` and `hooks/**/*.tsx` and every `renderer/*.mjs` (spec D5's set; `hooks/ATTRIBUTION.md` and `hooks.json` are not searched) (`render.mjs`, `flatten.mjs`, `scrub.mjs`; not `renderer/vendor/`, not `tests/`), case-insensitively with comments included, and asserts no match of `kroki|plantuml\.com|mermaid\.ink|fonts\.googleapis\.com`, and that no `SPEC` key name or default in `settings.ts` contains `http`. So the scrubs and `flatten.mjs` must not carry the host as a literal even in a comment (they match `@import` and non-fragment `url(` instead, 2.2); the fixture holding the real Google Fonts import lives under `tests/`, outside the search.
- AC-20.5.4 (from spike finding B), by path: **PNG half** `[tests/lens-renderer/]`: `flattenSvg` then `scrub.mjs` over the real beautiful-mermaid SVG fixture leave no `@import`, no `fonts.googleapis.com`, no non-fragment `url(` and no dangling declaration, asserted on the SVG `render.mjs` hands to the rasteriser (a seam: `render.mjs` exports `svgForRaster(svg)`, called by `main` and by the test); **Svg half** `[tests/diagram.test.ts]`: the Svg `body` the hook draws, after `scrubSvg`, has the same properties. `offline.test.mjs` renders one Mermaid fixture to PNG and to SVG with the network stubbed and zero recorded attempts.
- AC-20.5.3, **sprint 1 (Mermaid only): 5 pure rows** of the `sanitiseSource` table, each asserting the source out and the `removed` count: (1) `click A href "https://x"` removed, count 1; (2) `click A "https://x"` (no `href`) removed, count 1; (3) `<img src="http://x/a.png">` in a label removed, count 1; (4) `![alt](https://x/a.png)` in a label removed, count 1; (5) negative: `click A call cb()` and a label with the plain word `http://x` are unchanged, count 0. One hook test renders a Mermaid source with an image link; the stubbed `process.run` records the stdin; the test asserts the link is gone from stdin, nothing was fetched, and the note `removed 1 remote reference(s)` sits under the picture. *(Sprint 2, ITEM-054/055: the PlantUML include/import forms with a URL and with a path, `<img:http…>`, a URL sprite, `!theme … from <url>`, the three LaTeX macros, and the `!includeurl` hook test; the old count of 12 rows is the sprint-2 total.)*

## 7. AC to design to test

Seams: `plugins/claude/ai-dlc-lens/tests/lens.test.tsx` (mounts `AssistantMessage` per surface, stubbed `process.run`); a new `tests/diagram.test.ts` beside it for the pure functions; `tests/lens-renderer/*.test.mjs` (node:test, repository root, never shipped) for `render.mjs`. Test names begin with the AC id.

| AC | Element | Test |
|---|---|---|
| AC-20.1.1 (once the render completes: a cache hit or the one redraw, 17.1.l3 Major 10) | terminal: `Image` PNG + source (G2 OQ1: the picture is directly after the fence source) | `AC-20.1.1 a closed mermaid fence on the terminal gives an Image and keeps the source` (mount `surface: 'terminal'`; stub returns a png envelope; find `Image` with `alt`, and the fence text in a `Markdown`) |
| AC-20.1.2 | `Svg` elsewhere | `AC-20.1.2 on desktop and vscode (and mobile) the picture is an Svg` (loop over the three surfaces) |
| AC-20.1.3 | order | `AC-20.1.3 three fences give three pictures in order` (each picture directly after its own fence) |
| AC-20.1.4 | no fence → `next(e)` | `AC-20.1.4 a reply with no diagram fence is drawn exactly as without the submodule` (compare the tree with the native `next` result) |
| AC-20.1.5 | five kinds | `AC-20.1.5 flowchart, sequence, class, state and ER each give a picture` (renderer test on five fixtures; hook test with one stub per kind) |
| AC-20.2.1 *(sprint 2)* | math display blocks | `AC-20.2.1 $$ block, \[ \] block and a math fence each give a picture` |
| AC-20.2.2 *(sprint 2)* | TeX diagram | `AC-20.2.2 a tikz fence and a latex fence with tikzpicture give no picture and the TeX reason` (pure `texKind` + hook) |
| AC-20.2.3 *(sprint 2)* | `E = mc^2` in latex fence | `AC-20.2.3 a latex fence without TeX-document markers is math` |
| AC-20.3.1 *(sprint 2)* | local jar | `AC-20.3.1 a configured trusted jar renders through the local program` (stub asserts argv has `--jar` and `--java`) |
| AC-20.3.2 *(sprint 2)* | no jar/Java | `AC-20.3.2 no jar gives the noJar notice and no process.run for it`; `no java gives noJava`; `AC-20.3.2 two plantuml fences in one message show the notice once` |
| AC-20.3.3 *(sprint 2)* | untrusted/missing | `AC-20.3.3 a jar outside the trusted folders is not run`; `a jar that does not exist is not run` (fake `fs.stat`, `~/.claude.json` trust as `register.tsx:586` tests do) |
| AC-20.4.1 | open fence | `AC-20.4.1 a streaming reply with an unclosed mermaid fence shows no picture and no reason` |
| AC-20.4.2 | closed later | `AC-20.4.2 the same reply after the closing delimiter shows the picture` |
| AC-20.4.3 | finished reply open fence | `AC-20.4.3 a finished reply ending inside an open fence shows source only` |
| AC-20.5.1 | offline | the stubbed-fetch hook test and `offline.test.mjs` (section 6) |
| AC-20.5.2 `[BV]` | search (four hosts, `hooks/` and `renderer/*.mjs`, section 6) | `no-remote-hosts.test.mjs` |
| AC-20.5.3 (sprint 1) | `sanitiseSource`, mermaid row | `AC-20.5.3 an image link is removed before the renderer gets the source` (hook, Mermaid) and `AC-20.5.3 sanitiseSource removes <pattern>` (5 pure rows, section 6); *sprint 2* adds the PlantUML and LaTeX rows (12 in all) and the `!includeurl` hook test |
| AC-20.5.4 | scrubs (PNG half in the renderer, Svg half in the hook) | `tests/lens-renderer/scrub.test.mjs` and `tests/diagram.test.ts` over `tests/fixtures/scrub-cases.json`, plus the `svgForRaster` assertion (section 6) |
| Mermaid kinds | `mermaidKind` | `AC-20.1.5 an unsupported mermaid kind (gantt, pie, mindmap, journey) gives the source and the unsupportedMermaid reason and does not run the renderer` (assert no `process.run` call) |
| Font | 3.1 | `a png render with the font missing gives the noFont reason` (renderer test; un-skipped, spike 20.1.5 decided the font) |
| Flatten (new) | 3.3 | `flattenSvg` table tests in `tests/lens-renderer/flatten.test.mjs`: the numeric rows and the throw rows of 3.3, var() with and without fallback, the style block replaced, no `@import` left; and the **pixel oracle** `a png of a Mermaid flowchart paints its colours` (17.1.l3 Major 3; "more than one distinct colour" is dropped, since black shapes on white pass it): render `flowchart LR; A[Start] --> B[End]` with the explicit colour table of `render.mjs` (the spike palette: bg `#FFFFFF`, fg `#27272A`, line `#71717A`, accent `#27272A`, muted `#52525B`, surface `#F4F4F5`, border `#D4D4D8`) to PNG; decode it with a 30-line helper `tests/lens-renderer/png-sample.mjs` (`zlib.inflateSync`, filter types 0 to 4, 8-bit RGBA, no dependency); assert (a) the corner pixel is the table's `bg` (`#ffffff`), (b) a pixel at the middle of node A's left edge, a few pixels inside the rect and away from the label text and from the rounded corners (geometry `x`, `y`, `height` read from the flattened SVG: `(x + 3, y + height / 2)`) equals that rect's `fill` in the flattened SVG, and (c) that fill equals the literal recorded at ITEM-053.b from the first correct render and reviewed against the table, and is neither `#000000` nor the `bg` |
| Scrub `@import` (new) | 2.2 | `scrubSvg removes the Google Fonts @import and every non-fragment url() from a real beautiful-mermaid SVG` (pure, fixture) |
| AC-20.6.1 | svg cap | `AC-20.6.1 an Svg over 131072 characters gives the source and the size-cap reason; the other pictures are unaffected` |
| AC-20.6.2 | syntax error | `AC-20.6.2 a renderer error shows the source and a one-line reason` (envelope `error`) |
| AC-20.6.3 | png cap | `AC-20.6.3 a terminal PNG over 2 MiB gives the source and a reason` |
| AC-20.6.4 | throw → native | `AC-20.6.4 a renderer that throws returns the native drawing` (`process.run` rejects; compare to `next`) |
| AC-20.7.1a `[DC]` (sprint 1; AC-20.7.1 is sprint 2, ITEM-075) | `THIRD_PARTY_NOTICES.md` | exactly the sprint-1 entries of D8 against the file (**ITEM-056's hand-back records whether claude-code-figures is reused**, so the tester knows whether its entry is expected): beautiful-mermaid (MIT), ELK.js `elkjs` 0.11.1 (EPL-2.0, with the source pointer below), `entities` (BSD-2-Clause), `@resvg/resvg-wasm` (MPL-2.0), Inter with the OFL text, mermaid-inline (MIT), claude-code-figures only if reused; checked against the bundle inventory in `20.1.5-spike-t20.3a-metafile.md` (the metafile lists exactly elkjs, beautiful-mermaid and entities; resvg-wasm and Inter are vendored files). MathJax, LaTeX Inline and PlantUML are ITEM-075. **Source pointer (research 17.1.43; EPL-2.0 needs it for the minified `vendor/mermaid.mjs` beside the licence text; elkjs is "EPL-2.0 OR GPL-3.0-or-later", EPL-2.0 chosen):** the ELK.js entry of `THIRD_PARTY_NOTICES.md` carries the line "The bundled renderer includes elkjs, distributed in minified form under the Eclipse Public License 2.0. Source code: https://github.com/kieler/elkjs (tag 0.11.1)." (AC-20.7.1a fixes only the `Source code: <URL> (tag <tag>)` line; the full sentence is fixed by spec D8 and this LLD); `@resvg/resvg-wasm` 2.6.2 (MPL-2.0, which also requires source availability) gets a line of the same form, `Source code: <repo URL> (tag <tag>)`, but **its URL and tag are not fixed here**: spec D8 leaves them to ITEM-056, which reads the repository URL from the package metadata (`repository` in the package's `package.json`) and the tag from the upstream tags, and writes the tag exactly as upstream names it (research 17.1.48: elkjs names its tag `0.11.1`, with no `v`, so the elkjs line reads `(tag 0.11.1)`; resvg-js, whose repository the wasm package's source may share, uses `v2.6.2`; the `@resvg/resvg-wasm` manifest itself was not checked); the tester checks that each named tag exists upstream; the test checks both lines, with the full licence texts |
| AC-20.7.2 `[BV]` | lens validate/test | `plugin validate --strict` and `plugin test` for the lens, quoted by the build |
| AC-20.7.3 `[DC]` | attribution record | `plugins/claude/ai-dlc-lens/hooks/ATTRIBUTION.md`, created by ITEM-056 (sa: NOTICE.md already points to it), records the change |
| AC-20.8.1 `[MV]` | `MANUAL-CHECKS.md` | the steps added by ITEM-053 |
| AC-20.9.1a (sprint 1; AC-20.9.1 is sprint 2) | defaults | `AC-20.9.1a with no setting Mermaid is on (diagramMermaid true); no math or PlantUML setting exists` (`DEFAULTS` + hook); sprint 2 adds `AC-20.9.1` (math on, PlantUML draws only with a jar) |
| AC-20.9.1a, deferred-kind half (17.1.l3 Major 8; 17.1.l3.3 Major 1) | step 3: deferred kinds are not candidates | two cases. (i) `AC-20.9.1a a reply with only a $$ block, a latex fence containing tikzpicture and a plantuml fence is drawn exactly as without the submodule`: there is no closed `mermaid` fence, so the hook returns `next(e)`; the tree equals the one `next` returns, and `process.run` has no call whose argv has `--kind`. (ii) `AC-20.9.1a the same reply with one mermaid fence added keeps the deferred parts as they were`: the hook rebuilds the reply as one `Box` (4 step 5), so no tree equality is claimed; each deferred part is a `Markdown` part whose `text` equals the original substring of the reply, fence markers included, byte for byte; there is no reason `Text` and no `removed` note for it; the stubbed `process.run` recorded **exactly one call whose argv has `--kind`, and its value is `mermaid`** (the `node --version` probe of 4.1 is also a `process.run` call and is not counted: the assertion filters the calls by `--kind`); and only the mermaid fence has a picture part |
| AC-20.9.2a (sprint 1; AC-20.9.2 is sprint 2) | Mermaid off | `AC-20.9.2a diagramMermaid off: the mermaid fence is drawn as without the submodule` (tree comparison with `next`); sprint 2 adds the per-kind `AC-20.9.2` for math and PlantUML |
| Placement | `layoutParts` | pure table: picture right after its fence for 0, 1 and 3 fences, an open fence, a disabled fence |
| Render budget | 3.4 | `a render slower than 300 ms shows rendering… and exactly one invalidate("ui.render") follows its result; the next render shows the picture` (mock clock; the `ui.invalidate` call recorded; a second slow fence gives its own single invalidate) |

## 8. Tasks for `pm` (merge group LENS, one lens lane: root 22 merges first and in full, then root 20, 053 -> 056, one at a time (human, run.v4 2e and 2f); root 18's lens work is another file but the same plugin; 054 and 055 are sprint 2)

| Item | Scope | Size (agent sessions) |
|---|---|---|
| ITEM-052 | closed: the API spike (20.1.1). The live surface check is AC-20.8.1 in 053. | 0 |
| ITEM-053.a | **closed**: spike 20.1.5 (resvg-wasm 2.6.2 PASS with the flatten step, bundle sizes PASS at 4.53 MiB, Inter Regular OFL-1.1, `entities` BSD-2-Clause accepted; the PlantUML profile and MathJax deferred to sprint 2). | done |
| ITEM-053.b | `hooks/diagram.ts` (pure: `findFences` whole grammar, `texKind`, `scrubSvg` with the `@import`/`url()` strip, `sanitiseSource` Mermaid row, `mermaidKind`, `reasonFor`, `fitCaps`, `layoutParts`, `cacheKey`), `renderer/` (`render.mjs` Mermaid + explicit colours + wasm init + font load, `flatten.mjs`, `scrub.mjs`, `vendor/` built with esbuild, `BUILD.md` with the licence-inventory rebuild rule), `tests/diagram.test.ts`, `tests/lens-renderer/*.test.mjs` (flatten with its numeric rows, scrub, offline, no-remote-hosts, the pixel oracle and `png-sample.mjs`), `tests/fixtures/scrub-cases.json`. Owns `diagram.ts` and `renderer/`. | **3** (confirmed: the vendor build, the flatten step with its evaluator and the pure table of about 12 functions do not fit in 2) |
| ITEM-053.c | `registerDiagram` hook, `outcome`, the cache and render budget (3.4), the `diagramMermaid` settings row (sprint 1), hook tests per surface (AC-20.1.x, 20.4.x, 20.6.x, 20.9.x for Mermaid), `MANUAL-CHECKS.md` steps, README section request. Owns `settings.ts` and `register.tsx`; after 053.b. | **2** (confirmed) |
| ITEM-053 | the parent of 053.b and 053.c (they are its split; no extra size). | 5 total |
| ITEM-054 | *sprint 2*: MathJax in `render.mjs` (spike warning: `mathjax-full` 3.2.2 threw `TypeError: Cannot read properties of null (reading '4')` on `\frac{a}{b}+x^2` and `E=mc^2` in Node 24.11.1; `@mathjax/src` 4.1.3, Apache-2.0, is the untried candidate; the bundle must be CJS), the math kind tests, TeX-diagram reason, the `diagramMath` row, the `math` rows of `sanitiseSource`. | sprint 2 |
| ITEM-055 | *sprint 2*: PlantUML (`javaPath`, `plantumlJar`, trust check, the profile per its own spike; no Java on the spike machine), tests AC-20.3.x, the `plantuml` rows. | sprint 2 |
| ITEM-056 | create `plugins/claude/ai-dlc-lens/hooks/ATTRIBUTION.md`; `THIRD_PARTY_NOTICES.md` entries for what sprint 1 ships or reuses: beautiful-mermaid (MIT), ELK.js (EPL-2.0 chosen from "EPL-2.0 OR GPL-3.0-or-later"; beautiful-mermaid pins elkjs 0.11.1; the elkjs and resvg-wasm entries each carry a `Source code: <repo URL> (tag <version>)` line, section 7 AC-20.7.1a), `entities` 7.0.1 (**BSD-2-Clause**, 7,149 bytes bundled into `vendor/mermaid.mjs`, accepted by the human 2026-10-25), `@resvg/resvg-wasm` 2.6.2 (MPL-2.0), Inter (OFL-1.1, with the OFL text in `fonts/OFL.txt`), mermaid-inline (MIT) and claude-code-figures (Apache-2.0, NOTICE checked) only if reused; the BSD-2-Clause licence added to the allowed list (spec OQ3); the attribution record; lens `validate` and `test`. | **1** (confirmed: documents plus two commands) |
| ITEM-075 | *sprint 2*: the same notices for 054 (MathJax Apache-2.0, claude-latex, LaTeX Inline) and 055 (PlantUML). | sprint 2 |

053.b before 053.c (053.c needs the pure functions and the renderer protocol). Sprint-1 total for root 20: 3 + 2 + 1 = 6 sessions (the PM placeholders were 3, 2, 1; the design confirms them).

## 9. Questions for `sa` (Refine)

1. (Closed by sa: confirmed, spec D4 now says it.) **Element-table detection instead of a surface name.** The hook picks `Image` or `Svg` from `$.ui.resolve(e)`; the spec says `e.surface`. The types show the terminal table has `Image` and the others `Svg`. Confirm (it also covers a future surface).
2. (Closed by spec rev 2: `RENDER_WAIT_MS` 300 ms, one redraw per fence result, `$.ui.invalidate("ui.render")` named from the types.)
3. (Closed by sa: ITEM-056 creates `plugins/claude/ai-dlc-lens/hooks/ATTRIBUTION.md`, as auto-handoff does; `NOTICE.md` already points to it; spec D8 says so.)
4. (Closed by sa after G2: the picture goes right after its fence; the `belowReply` layout and the `diagramLayout` setting are removed.)
5. **Hash and cache.** FNV-1a 64-bit keys, plus the source length in the key (no crypto import is guaranteed in the hooks module), 64 in-memory and 200 on-disk entries. Confirm, or name an allowed hash.
6. **Image size to terminal cells.** `columns = ceil(width/8)`, `rows = ceil(height/16)`, capped at 255; no setting. Confirm.
7. **`plantumlJar` and `javaPath` as `path` kind** go through the lens's trust gate at use, not at settings-read. Confirm that is the lens's `costingPath` pattern, not a stricter one.
8. **The vendor bundle build** (`renderer/BUILD.md`, esbuild outside the plugin, bundle checked in): confirm that a checked-in generated bundle is acceptable for the lens plugin (the repository rule says generated Copilot output is never hand-edited; the lens has no Copilot projection).

## 10. Risks

- Vendored bundles: measured in spike 20.1.5 at 4.53 MiB for sprint 1 (below the 15 MB threshold); four code licences (MIT, EPL-2.0, BSD-2-Clause in the bundle, MPL-2.0 for the wasm) and OFL-1.1 for the font; the inventory is `20.1.5-spike-t20.3a-metafile.md`; the human accepted BSD-2-Clause. Sprint 2 adds MathJax (about 1.8 MB more, about 6.3 MiB in all, still under).
- The flatten step is a small colour evaluator for beautiful-mermaid's current CSS; a beautiful-mermaid upgrade that emits another form makes the render fail as `failed` (never black). The flatten tests pin the shape; `BUILD.md` says to re-run them on every vendor rebuild.
- Inter Regular only: bold text on the terminal renders in the Regular weight (or a synthesised face); a visual difference from SVG surfaces, no functional one.
- `$.process.run` stdout is text; a PNG travels as base64 (about 4/3 size), fine under the 4 MiB cap, but a renderer that writes a larger base64 line is truncated and reported as a cap.
- The hook runs on every assistant block: the cost with no fence is one string scan plus `settings` reads (cached by the lens's settings layer), measured by the build.
- With a 300 ms budget a first-time render nearly always shows `rendering…` first (ELK layout and the WebAssembly start-up can take longer); the cache makes the second sight instant. Measured in 053.a.
- Engine facts (`Image`/`Svg` props, `ui.invalidate`, `$.process.run` init) come from the provisional 2.1.308 types.
