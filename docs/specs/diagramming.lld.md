---
work-item: FEAT-20261020-ai-dlc-lens
root: 20
kind: lld
feature: diagramming
module: ai-dlc-lens
submodule: diagramming
integrations: []
items: [ITEM-052, ITEM-053, ITEM-053.a, ITEM-054, ITEM-055, ITEM-056]
author: system-engineer
date: 2026-10-24
status: draft revision 4 (G2 OQ1 resolved: picture right after its fence; no layout setting), bc round 2 PASS on revision 3, text confirmation of revision 4 requested
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
| Pure core | `hooks/diagram.ts` holds the pure functions: `findFences`, `texKind`, `scrubSvg`, `sanitiseSource`, `mermaidKind`, `reasonFor`, `fitCaps`, `layoutParts`, `cacheKey`. They take strings and return values; they import no engine type. |
| One impure shell | `registerDiagram(on)` is the only function with `$`: it reads settings, calls the renderer through `$.process.run`, reads and writes the cache with `$.fs`, and builds the tree from `$.ui.resolve(e)`. |
| Fail to the native drawing | Any throw in the hook returns `next(e)`; any renderer failure shows the source plus a one-line reason; no stack trace ever reaches the screen. |
| The surface is read from the element table | The hook asks `$.ui.resolve(e)` for `Image` (terminal) or `Svg` (desktop, VS Code, mobile) instead of switching on a surface name, so a new surface that has either element works. |
| Offline by construction | The renderer is a vendored bundle with no network code; the hook has no `fetch` or socket; sources are cleaned before and SVG output after. |

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
export const SVG_CAP = 131072, PNG_CAP = 2 * 1024 * 1024
export function fitCaps(format: 'svg' | 'png', body: string, bytes: number): { ok: true } | { ok: false; reason: string }
export function reasonFor(code: ReasonCode, detail?: string): string                                  // one line, at most 120 characters
```

- **`sanitiseSource(kind, source): { source: string; removed: number }`** (spec D5; the spec corrects the stories' reference to `classify`, which classifies one avatar setting value and cannot clean text). One pure function; the pattern table below has one row per pattern in the pure-seam test table; `removed` counts the removals:

  | Kind | Removed (the whole line, or the matched fragment) |
  |---|---|
  | `plantuml` | every `!include`, `!include_many`, `!include_once`, `!includeurl`, `!includesub`, `!import` form (all, whether the argument is a URL or a path: the security profile is the real control, stripping is the backstop, sa/bc round 2); `<img:http…>` and `<img:https…>`; a `sprite` definition loaded from a URL (`sprite $x <url>`); `!theme <name> from <url>` |
  | `mermaid` | a `click <id> href "<url>"` line; `<img src="…">` in a label; `![alt](url)` in a label |
  | `math` | `\href{…}{…}` (keeps the text argument), `\url{…}`, `\includegraphics[…]{…}` |

  Matching is case-insensitive for PlantUML directives and exact for the LaTeX macros. A removal never touches ordinary label text. Each removal adds one to `removed`; the diagram still renders. The hook shows one dim note **under the picture** (sa/bc round 2): `removed N remote reference(s)`, only when `removed > 0` and a picture or a reason was produced; it is a note, not a failure.
- **`mermaidKind(source)`**: the first non-comment keyword of a Mermaid source (`flowchart`, `graph`, `sequenceDiagram`, `classDiagram`, `stateDiagram`, `stateDiagram-v2`, `erDiagram`, `xychart-beta`, …). A kind outside the supported list gives the reason `unsupportedMermaid` and the renderer is not run (spec D3).
- **`scrubSvg(svg)`**: drops every `href` and `xlink:href` attribute whose value is not a fragment (`#…`) or a `data:` URI; drops `<script>`, `<foreignObject>`, `<iframe>`, `<object>`, `<embed>` elements and every `on*=` attribute and `javascript:` value (the host scrubs too; this is defence in depth). It leaves the rest untouched, so `xmlns="http://www.w3.org/2000/svg"` stays (which is why the AC-20.5.2 search excludes `renderer/vendor/`).
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

AC-20.3.2 (restated by the spec): `noJar` when `plantumlJar` is unset, `noJava` when `javaPath` is unset and `java` is not found on PATH (found by `$.process.run(['java', '-version'])` exit 0, cached for the session). The reason names what is missing and how to configure it. **Once per message:** the `noJar`/`noJava` notice is shown for the first PlantUML fence of a message only; later PlantUML fences of the same message show their source with no reason line (spec D6 minor; `layoutParts` takes `noticeShown: Set<ReasonCode>`).

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
  { "data": { "format": "svg"|"png", "body": "<svg…>" | "<base64>", "width": <px>, "height": <px>, "removed": false }, "error": null }
  { "data": null, "error": "<one-line reason>" }
exit:   0 whenever an envelope was written (an error is a normal result); 2 for a usage error (also an envelope)
```

- `<root>` is `$.plugin.root` (`register.tsx:2529` uses it for the probe log); the hook passes `join(root, 'renderer/render.mjs')`.
- `$.process.run(argv, { stdin, timeoutMs })` (types: `ProcessRunInit` has `stdin`, `timeoutMs`; default 30 s; the hook sets 20 s for mermaid/math, 30 s for plantuml). stdout is capped at 4,194,304 bytes by the engine; a PNG of at most 2 MiB is about 2.8 MiB of base64, which fits; larger output is `isStdoutTruncated` → the hook treats it as `pngCap`/`svgCap`.
- Dispatch inside `render.mjs`: `mermaid` → beautiful-mermaid `renderMermaidSVG` (flowchart, sequence, class, state, ER, plus XY; the five of AC-20.1.5 are the floor, the kind is the diagram's first keyword) with ELK for layout; `math` → MathJax `tex2svg` (SVG output, no CHTML); `plantuml` → `spawn(java, ['-Djava.awt.headless=true', '-jar', jar, '-tsvg', '-pipe', …profile])`; `--format png` → the SVG through the rasteriser (3.3). `width`/`height` are the SVG's `viewBox` size (px), used for the terminal's `columns`/`rows`.
- Errors: a parse error → `error` with the renderer's first message line (`syntax`); the hook shows it through `reasonFor('syntax', error)`.
- **Font.** The WebAssembly rasteriser has no system fonts, so a font is bundled in `renderer/vendor/fonts/` (one OFL or similarly permissive font, chosen by ITEM-053.a with its licence and size; the SVGs name it in `font-family`, and `render.mjs` loads it into the rasteriser). If the font fails to load, `--format png` returns the envelope error `no font` and the hook shows the source with the `noFont` reason; SVG output (other surfaces) is unaffected, because those surfaces draw text with their own fonts.
- The renderer reads no environment variable except `PATH` resolution done by `spawn`, opens no socket, writes nothing to disk. Its bundles contain no URL fetch (checked by the 5.2 tests).

### 3.2 PlantUML security profile (CONDITIONAL on ITEM-053.a)

053.a checks whether the installed PlantUML offers a security profile that blocks includes and URLs (`PLANTUML_SECURITY_PROFILE=SANDBOX` / `-DPLANTUML_SECURITY_PROFILE=…`, version-dependent). Pass: the renderer sets it in the child's `env`. Fail: the renderer removes `!include`/URL lines before the call (the same `sanitiseSource` rules, applied inside the renderer as the second line of defence) and sets `removed: true`; the hook shows the one-line notice `PlantUML includes and links were removed` only if the render fails. **Order of sanitising and profile (bc round 1, Major 5):** the hook **always** runs `sanitiseSource` before the source reaches the renderer (so every `!include*`/`!import*` form is gone whether or not a profile exists), and the profile, when 053.a finds one, is set in addition as the real control for anything the jar would still resolve; on the fail branch (no profile) the renderer runs `sanitiseSource` again on stdin as the second line of defence and sets `removed` from the count it removes beyond the hook's. The note `removed N remote reference(s)` counts both.

### 3.3 PNG rasteriser (CONDITIONAL on ITEM-053.a)

First choice: the WebAssembly build of resvg (`@resvg/resvg-wasm`, MPL-2.0), one `.wasm` file for every platform, loaded by `render.mjs` from `renderer/vendor/` with no network. Drop path: `@resvg/resvg-js` with prebuilt `.node` modules for the platforms 053.a lists (vendored per platform, selected by `process.platform`/`process.arch`); on another platform `render.mjs --format png` returns the envelope error `no PNG rasteriser for this platform` (reason `noRaster`), and the terminal shows the source with that reason. If neither works, increment 1 ships SVG surfaces only and the terminal shows the source plus `noRaster`; AC-20.1.1 goes back to the human with 053.a's result. PNG tests are skipped with the reason until 053.a decides.

### 3.4 Cache and the render budget

- **Key.** `cacheKey(kind, format, rendererVersion, source) = <kind>-<format>-<fnv1a64(rendererVersion + '\0' + source) as 16 hex chars>-<source.length>`. The hooks module has no crypto import guaranteed (it cannot load npm packages); FNV-1a 64 over UTF-16 code units, done twice with different seeds for 128 bits, is enough for a local cache (a collision shows one wrong picture; the length is part of the key). `rendererVersion` is the plugin's `version` read once.
- **Store.** In memory first (`Map`, 64 entries, least recently used), then on disk under `~/.claude/state/ai-dlc-lens/diagrams/<key>.json` (the envelope's `data`), written with `$.fs.write`. Bound: 200 files; on a write that makes it more, list the folder and delete the oldest by `mtimeMs` until 200 remain. A read or write failure is ignored (cache miss). A cache file that does not parse as the envelope data, or whose `format` differs from the key, is a miss and is overwritten.
- **Budget.** `RENDER_WAIT_MS = 300` (spec: at most 300 ms; a named constant). A cache hit (memory or disk) is drawn at once. Otherwise the hook starts the renderer and awaits it with `Promise.race([render, wait(RENDER_WAIT_MS)])` using `$.clock.after`. A render done in time is drawn in this render. Otherwise this render shows the source plus the `rendering…` line, and the render continues in the background. **When it finishes the hook stores the result and calls `$.ui.invalidate('ui.render')` exactly once for that fence result** (`invalidate: (event: InvalidatableEventName) => void`, `claude-code.d.ts:2396`; its doc at :4099 names `$.ui.invalidate("ui.render")` as a repaint trigger; the auto-handoff panel uses the same call, `register.tsx:665`). The repaint runs the hook again and finds the cache entry. Concurrent renders of one key share a single promise, so one result produces one invalidate. If a later engine drops the call, the picture appears on the next render the host makes for its own reasons (spec: documented limitation).

## 4. The hook (`registerDiagram`)

```ts
export function registerDiagram(on: Register): void
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => { … })
```

Registered from `hooks/register.tsx` beside the other `ui.render` hooks (line ~3198 area), in its own call so a fault in it cannot affect them. Steps:

1. `try {` … `} catch { return next(e) }` around everything (AC-20.6.4).
2. `cfg = await settingsNow($)` (section 5). If all three kinds are off, `return next(e)`.
3. `segs = findFences(String(e.props.text))`. If no fence is closed and enabled, `return next(e)` (so the tree is exactly the engine's, AC-20.1.4, 20.4.1, 20.9.2).
4. For each closed, enabled fence compute `outcome(f)` (4.1), concurrently (`Promise.all`, at most 3 renderer processes at once). **One shared deadline for the whole render:** `deadline = now + RENDER_WAIT_MS` is taken once at the start of this step and every fence awaits against that same deadline, so three uncached fences together never hold a redraw longer than `RENDER_WAIT_MS` (300 ms), not 3 x 300 ms. A fence not done at the deadline becomes `rendering…` and continues in the background.
5. `const t = $.ui.resolve(e)`; `{ Box, Markdown, Text, Image, Svg }`. `parts = layoutParts(segs, outcome)`. Build one `Box flexDirection="column"` with, per part: `md` → `<Markdown text=…/>`; `source` → `<Markdown text={original fence text}/>`; `picture` → `<Image source={{ png: body }} columns rows alt/>` when `t.Image`, else `<Svg source alt width? height?/>` when `t.Svg`; `reason` → `<Text dimColor>{reason}</Text>`; after a picture whose `removed > 0`, `<Text dimColor>removed N remote reference(s)</Text>`.
6. `columns = clamp(ceil(width / 8), 1, 255)`, `rows = clamp(ceil(height / 16), 1, 255)` (a nominal 8×16 px cell; the engine scales the picture to the box, so the values are hints). `alt` = `<kind> diagram: <first line, at most 80 chars>`.
7. The stored message is never changed (ctrl+o shows the original).

### 4.1 `outcome(f)`

```
kind off in settings           -> not a candidate (step 3)
texDiagram                      -> { reason: 'texDiagram' }                      (no process)
plantuml: jar unset             -> noJar; java unset and not found -> noJava;
          path not inside trustedFolders (avatar.ts trustedFolders/isInside, resolved with $.fs.stat(.., { resolve: true }) as register.tsx:586 does) -> untrusted;
          stat fails -> missing
mermaid with a kind outside the supported list (`mermaidKind`) -> unsupportedMermaid (the renderer is not run)
node missing (`$.process.run(['node','--version'])` exit != 0, cached per session) -> noNode
format = t.Image ? 'png' : t.Svg ? 'svg' : none   (none -> source + reason 'this surface draws neither images nor SVG')
cached? -> use it; else run (budget 3.4)
result: error "no font" -> noFont; "no PNG rasteriser…" -> noRaster; other error -> syntax | failed; format svg: scrubSvg then fitCaps; png: fitCaps(png, bytes)
```

Every outcome is `{ picture: {format, body, width, height} } | { reason }`; one fence's failure does not affect the others.

## 5. Settings (D6)

`hooks/settings.ts` `SPEC` gains (same pattern as the others; `envName` makes `AI_DLC_LENS_DIAGRAM_MERMAID` etc.):

```ts
diagramMermaid:  { kind: 'bool', def: true,  doc: 'Draw closed mermaid fences as pictures (offline)' },
diagramMath:     { kind: 'bool', def: true,  doc: 'Draw closed math fences and display math as pictures (bundled MathJax, offline)' },
diagramPlantuml: { kind: 'bool', def: true,  doc: 'Draw closed plantuml fences with a local Java and plantuml.jar; takes effect only with plantumlJar set' },
plantumlJar:     { kind: 'path', def: '',     doc: 'Path of plantuml.jar; must be inside a folder Claude Code trusts' },
javaPath:        { kind: 'path', def: '',     doc: 'Path of the java executable; empty: java on PATH' },
```

`plantumlJar` and `javaPath` are paths in the lens's `path` kind (trust-gated like `costingPath`: the lens `coerce` for `kind: 'path'` and the trusted-folder check at use). AC-20.9.1: with no setting, Mermaid and math are on, PlantUML is on but draws only with a jar. The `lens-configure` skill's listing of settings and the lens schema (if the skill ships one) gain the five rows; `settings.test` style checks (`lens.test.tsx` has one pinning `SPEC` keys against the README table) change with them (build counts the pinned tests).

## 6. Offline proof (US-20.5)

- AC-20.5.1: the lens test stubs `globalThis.fetch`, `net.connect`-level calls are not reachable from the hooks module; the test stubs `fetch` to record and throw, stubs `process.run` with the fixture envelopes, renders one fence of each kind, and asserts zero recorded attempts. The renderer-level proof is in `tests/lens-renderer/offline.test.mjs`: it runs `render.mjs` with `NODE_OPTIONS=--require <stub.cjs>` where the stub replaces `fetch`, `http.request`, `https.request`, `net.Socket.prototype.connect` and `dns.lookup` with recorders that fail, renders each fixture, and asserts none was called.
- AC-20.5.2 `[BV]`: a script in `tests/lens-renderer/no-remote-hosts.test.mjs` reads `hooks/diagram.ts`, the `diagram*` and `plantuml*` keys of `settings.ts`, and `renderer/render.mjs` (not `renderer/vendor/`) and asserts no match of `kroki|plantuml\.com|mermaid\.ink`, and that no `SPEC` key name or default contains `http`.
- AC-20.5.3: the pure test has one row per pattern of the `sanitiseSource` table (every PlantUML include/import form with a URL and with a path, `<img:http…>`, a URL sprite, `!theme … from <url>`, Mermaid `click href`, `<img src>`, `![](url)`, and the three LaTeX macros), each asserting the source out and the `removed` count; the lens test renders a Mermaid source with an image link and a PlantUML source with `!includeurl http://x`; the stubbed `process.run` records the stdin; the test asserts the link is gone from stdin, nothing was fetched, and the note `removed 1 remote reference(s)` sits under the picture.

## 7. AC to design to test

Seams: `plugins/claude/ai-dlc-lens/tests/lens.test.tsx` (mounts `AssistantMessage` per surface, stubbed `process.run`); a new `tests/diagram.test.ts` beside it for the pure functions; `tests/lens-renderer/*.test.mjs` (node:test, repository root, never shipped) for `render.mjs`. Test names begin with the AC id.

| AC | Element | Test |
|---|---|---|
| AC-20.1.1 | terminal: `Image` PNG + source (G2 OQ1: the picture is directly after the fence source) | `AC-20.1.1 a closed mermaid fence on the terminal gives an Image and keeps the source` (mount `surface: 'terminal'`; stub returns a png envelope; find `Image` with `alt`, and the fence text in a `Markdown`) |
| AC-20.1.2 | `Svg` elsewhere | `AC-20.1.2 on desktop and vscode (and mobile) the picture is an Svg` (loop over the three surfaces) |
| AC-20.1.3 | order | `AC-20.1.3 three fences give three pictures in order` (each picture directly after its own fence) |
| AC-20.1.4 | no fence → `next(e)` | `AC-20.1.4 a reply with no diagram fence is drawn exactly as without the submodule` (compare the tree with the native `next` result) |
| AC-20.1.5 | five kinds | `AC-20.1.5 flowchart, sequence, class, state and ER each give a picture` (renderer test on five fixtures; hook test with one stub per kind) |
| AC-20.2.1 | math display blocks | `AC-20.2.1 $$ block, \[ \] block and a math fence each give a picture` |
| AC-20.2.2 | TeX diagram | `AC-20.2.2 a tikz fence and a latex fence with tikzpicture give no picture and the TeX reason` (pure `texKind` + hook) |
| AC-20.2.3 | `E = mc^2` in latex fence | `AC-20.2.3 a latex fence without TeX-document markers is math` |
| AC-20.3.1 | local jar | `AC-20.3.1 a configured trusted jar renders through the local program` (stub asserts argv has `--jar` and `--java`) |
| AC-20.3.2 | no jar/Java | `AC-20.3.2 no jar gives the noJar notice and no process.run for it`; `no java gives noJava`; `AC-20.3.2 two plantuml fences in one message show the notice once` |
| AC-20.3.3 | untrusted/missing | `AC-20.3.3 a jar outside the trusted folders is not run`; `a jar that does not exist is not run` (fake `fs.stat`, `~/.claude.json` trust as `register.tsx:586` tests do) |
| AC-20.4.1 | open fence | `AC-20.4.1 a streaming reply with an unclosed mermaid fence shows no picture and no reason` |
| AC-20.4.2 | closed later | `AC-20.4.2 the same reply after the closing delimiter shows the picture` |
| AC-20.4.3 | finished reply open fence | `AC-20.4.3 a finished reply ending inside an open fence shows source only` |
| AC-20.5.1 | offline | the stubbed-fetch hook test and `offline.test.mjs` (section 6) |
| AC-20.5.2 `[BV]` | search | `no-remote-hosts.test.mjs` |
| AC-20.5.3 | `sanitiseSource` | `AC-20.5.3 an image link and an http include are removed before the renderer gets the source` (hook) and `AC-20.5.3 sanitiseSource removes <pattern>` (one pure row per pattern, 12 rows) |
| Mermaid kinds | `mermaidKind` | `AC-20.1.5 an unsupported mermaid kind (gantt, pie, mindmap, journey) gives the source and the unsupportedMermaid reason and does not run the renderer` (assert no `process.run` call) |
| Font | 3.1 | `a png render with the font missing gives the noFont reason` (renderer test, skipped until 053.a) |
| AC-20.6.1 | svg cap | `AC-20.6.1 an Svg over 131072 characters gives the source and the size-cap reason; the other pictures are unaffected` |
| AC-20.6.2 | syntax error | `AC-20.6.2 a renderer error shows the source and a one-line reason` (envelope `error`) |
| AC-20.6.3 | png cap | `AC-20.6.3 a terminal PNG over 2 MiB gives the source and a reason` |
| AC-20.6.4 | throw → native | `AC-20.6.4 a renderer that throws returns the native drawing` (`process.run` rejects; compare to `next`) |
| AC-20.7.1 `[DC]` | `THIRD_PARTY_NOTICES.md` | the entries of D8 against the file |
| AC-20.7.2 `[BV]` | lens validate/test | `plugin validate --strict` and `plugin test` for the lens, quoted by the build |
| AC-20.7.3 `[DC]` | attribution record | `plugins/claude/ai-dlc-lens/hooks/ATTRIBUTION.md`, created by ITEM-056 (sa: NOTICE.md already points to it), records the change |
| AC-20.8.1 `[MV]` | `MANUAL-CHECKS.md` | the steps added by ITEM-053 |
| AC-20.9.1 | defaults | `AC-20.9.1 with no setting Mermaid and math are on; PlantUML draws only with a jar` (`DEFAULTS` + hook) |
| AC-20.9.2 | per-kind off | `AC-20.9.2 mermaid off, math on: the mermaid fence is drawn as without the submodule and the math block gets a picture` (tree comparison for the first, picture for the second), for each kind |
| Placement | `layoutParts` | pure table: picture right after its fence for 0, 1 and 3 fences, an open fence, a disabled fence |
| Render budget | 3.4 | `a render slower than 300 ms shows rendering… and exactly one invalidate("ui.render") follows its result; the next render shows the picture` (mock clock; the `ui.invalidate` call recorded; a second slow fence gives its own single invalidate) |

## 8. Tasks for `pm` (merge group LENS: 053 → 054 → 055 → 056, one at a time; root 20 before root 18's lens work)

| Item | Scope |
|---|---|
| ITEM-052 | closed: the API spike (20.1.1). The live surface check is AC-20.8.1 in 053. |
| ITEM-053.a | build spike, first: confirm the resvg WebAssembly package, licence, size and offline load; the PlantUML security profile; bundle sizes of beautiful-mermaid with ELK and MathJax. Also: the PlantUML security profile (does the installed PlantUML offer one that blocks includes and URLs; the real control, with stripping as the backstop), the bundled font (name, licence, size), the unpacked size of `renderer/` against the 15 MB threshold of spec OQ3 (above 15 MB, or a licence beyond MIT, EPL-2.0, Apache-2.0, MPL-2.0 and the font's, the item goes back to the human with the numbers). Output: a written result (package names and versions, sizes, pass/fail per CONDITIONAL) in the run folder. Decides 3.2, 3.3 and the font. |
| ITEM-053 | `diagram.ts` (pure functions), `registerDiagram`, `renderer/` (`render.mjs`, vendor bundle for Mermaid; the rasteriser per 053.a), cache, settings rows, Mermaid tests, placement, caps, fallbacks, the offline tests, `MANUAL-CHECKS.md` steps, README section request |
| ITEM-054 | MathJax in `render.mjs`, the math kind in `findFences` tests and hook tests, TeX-diagram reason |
| ITEM-055 | PlantUML (`javaPath`, `plantumlJar`, trust check, profile per 053.a), tests AC-20.3.x |
| ITEM-056 | create `hooks/ATTRIBUTION.md`; `THIRD_PARTY_NOTICES.md` entries (beautiful-mermaid, ELK.js, MathJax, the rasteriser, the bundled font, mermaid-inline, LaTeX Inline; claude-code-figures only if reused, its NOTICE checked), the attribution record, lens `validate` and `test` |

053.a may split into 053.a1 (rasteriser and sizes) and 053.a2 (PlantUML profile) for `pm`. 053 may split into 053.b (pure functions in `diagram.ts`, the renderer, their tests) and 053.c (the hook, the five `settings.ts` rows, the hook tests, `MANUAL-CHECKS.md`) with 053.b first; 053.c owns `settings.ts` and `register.tsx`, 053.b owns `diagram.ts` and `renderer/`.

## 9. Questions for `sa` (Refine)

1. (Closed by sa: confirmed, spec D4 now says it.) **Element-table detection instead of a surface name.** The hook picks `Image` or `Svg` from `$.ui.resolve(e)`; the spec says `e.surface`. The types show the terminal table has `Image` and the others `Svg`. Confirm (it also covers a future surface).
2. (Closed by spec rev 2: `RENDER_WAIT_MS` 300 ms, one redraw per fence result, `$.ui.invalidate("ui.render")` named from the types.)
3. (Closed by sa: ITEM-056 creates `plugins/claude/ai-dlc-lens/hooks/ATTRIBUTION.md`, as auto-handoff does; `NOTICE.md` already points to it; spec D8 says so.)
4. (Closed by sa after G2: the picture goes right after its fence; the `belowReply` layout and the `diagramLayout` setting are removed.)
5. **Hash and cache.** FNV-1a 128-bit keys (no crypto import is guaranteed in the hooks module), 64 in-memory and 200 on-disk entries. Confirm, or name an allowed hash.
6. **Image size to terminal cells.** `columns = ceil(width/8)`, `rows = ceil(height/16)`, capped at 255; no setting. Confirm.
7. **`plantumlJar` and `javaPath` as `path` kind** go through the lens's trust gate at use, not at settings-read. Confirm that is the lens's `costingPath` pattern, not a stricter one.
8. **The vendor bundle build** (`renderer/BUILD.md`, esbuild outside the plugin, bundle checked in): confirm that a checked-in generated bundle is acceptable for the lens plugin (the repository rule says generated Copilot output is never hand-edited; the lens has no Copilot projection).

## 10. Risks

- Vendored bundles are large (measured in 053.a) and carry four licences; ITEM-056 and the size result may make the human refuse OQ3.
- `$.process.run` stdout is text; a PNG travels as base64 (about 4/3 size), fine under the 4 MiB cap, but a renderer that writes a larger base64 line is truncated and reported as a cap.
- The hook runs on every assistant block: the cost with no fence is one string scan plus `settings` reads (cached by the lens's settings layer), measured by the build.
- With a 300 ms budget a first-time render nearly always shows `rendering…` first (ELK layout and the WebAssembly start-up can take longer); the cache makes the second sight instant. Measured in 053.a.
- Engine facts (`Image`/`Svg` props, `ui.invalidate`, `$.process.run` init) come from the provisional 2.1.308 types.
