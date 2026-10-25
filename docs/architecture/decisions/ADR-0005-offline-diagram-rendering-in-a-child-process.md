# ADR-0005: Diagrams are rendered offline, in a child process, from vendored renderers

**Date**: 2026-10-24 (revised 2026-10-25, 17.1.40: size without Inter Bold, `Source code:` lines, ADR-0006 cross-link; gate critique 20.1.l3.2 Minor 9; 17.1.45: licence table lists `entities` and Inter, status stated, gate critique 20.1.l3.3 Minor 6)
**Status**: Proposed. Not yet approved: it is decided at the combined G1+G2+G3 stop (S1), which has not run; it moves to Accepted when the human approves that stop.
**Deciders**: the human (decision 20: offline only, never remote); software-architect (the process and vendoring design)

## Context

The lens will draw Mermaid, math and PlantUML fences found in chat replies (root 20). Most diagram tools render on a server: Kroki, mermaid.ink or the PlantUML server. The human decided that diagrams never leave the machine, and that this holds even as an opt-in.

The lens hooks module cannot load npm packages (spike 20.1.1). The terminal needs PNG and the other surfaces need SVG. The available offline renderers have different licences:

| Renderer | Licence |
|---|---|
| beautiful-mermaid | MIT |
| ELK.js | EPL-2.0 |
| MathJax | Apache-2.0 |
| resvg (`@resvg/resvg-wasm`) | MPL-2.0 |
| `entities` (bundled inside `vendor/mermaid.mjs` by beautiful-mermaid) | BSD-2-Clause (human accepted 2026-10-25) |
| Inter Regular (font for the PNG rasteriser) | OFL-1.1 |
| PlantUML | GPL; the user supplies the jar |

## Decision

We will render every diagram on the user's machine, in a `node` child process (`renderer/render.mjs`). The renderer runs from pre-built, vendored bundles shipped in the lens plugin. There is no renderer URL setting, and no network fallback of any kind.

- **Clean on the way in and out.** Sources are cleaned of links and includes before rendering, and SVG output is cleaned of external references after it, CSS `@import` included (beautiful-mermaid emits a `fonts.googleapis.com` import; spike 20.1.5).
- **PlantUML** runs only from a jar the user configured, inside a trusted folder.
- **The PNG rasteriser** is `@resvg/resvg-wasm` (MPL-2.0), the WebAssembly build of resvg, so the plugin ships no native binaries for each platform. Spike 20.1.5 (ITEM-053.a, 2026-10-25) confirmed it works offline. The SVG is flattened first (CSS `var()` and `color-mix()` resolved), since resvg cannot resolve them, and the font is a bundled Inter Regular (OFL-1.1).
- **Allowed licences** of vendored code: MIT, EPL-2.0, Apache-2.0, MPL-2.0, BSD-2-Clause (`entities`, bundled by beautiful-mermaid; human accepted 2026-10-25) and OFL-1.1 for the font. Any other licence goes back to the human.
- **Results are cached** locally, by a content hash.

## Alternatives considered

- **An opt-in remote renderer (Kroki or mermaid.ink).** The human rejected it: a privacy promise with an opt-out is one wrong setting away from leaking internal designs.
- **Rendering inside the hooks module.** Not possible, because the module cannot load npm packages (spike 20.1.1).
- **Installing the renderers at runtime (`npm install` on first use).** Rejected: it needs the network at runtime and contradicts the decision.
- **Upstream mermaid with a headless browser.** Rejected: it needs a DOM or a browser, which is heavy and slow, and it may fetch fonts.

## Consequences

### Positive
- The privacy promise is simple and testable. The renderer code never opens a socket, and no setting names a host.
- Renders are fast after the first one, because they are cached.

### Negative / Trade-offs
- The lens plugin grows by the vendored bundles: about 4.4 MB unpacked for the sprint-1 Mermaid renderer (the spike 20.1.5 measured 4.75 MB with Inter Bold, which is not bundled; diagramming LLD), about 6.3 MB once MathJax joins in sprint 2. It also ships four code licences in sprint 1 (MIT for beautiful-mermaid, EPL-2.0 for ELK.js, BSD-2-Clause for `entities`, MPL-2.0 for resvg-wasm) plus the font's OFL-1.1, and a fifth code licence, Apache-2.0 for MathJax, in sprint 2. Their notices must be kept current when the bundles are updated, and the EPL-2.0 and MPL-2.0 entries carry a `Source code:` line, since a minified or compiled copy must say where its source is (research 17.1.43; spec D8).
- Rendering needs `node` on PATH. Without it, users see the source and a reason.
- The vendored bundles have to be rebuilt by hand to pick up upstream fixes.
- The guarantee covers the lens's code and bundles. A user-supplied PlantUML jar is outside it, gated by path trust.
- A WebAssembly rasteriser needs a bundled font, which adds its size (Inter Regular, about 342 KB) and licence (OFL-1.1).

### Neutral
- The renderer's stdout uses the `{ data, error }` envelope.

## Compliance checklist

- [x] Affected components:
  - `ai-dlc-lens/hooks/diagram.ts` (new), `register.tsx`, `settings.ts`;
  - `renderer/` (new);
  - `THIRD_PARTY_NOTICES.md`, `ATTRIBUTION.md`, `MANUAL-CHECKS.md`.
- [x] Related ADRs: ADR-0006 (the Cache Lab reads transcripts in a child process), which uses the same child-process pattern for the lens: a `node` process behind `$.process.run`, the `{ data, error }` envelope on stdout and the 4 MiB output cap.
- [x] `{ data, error }`: used on the renderer protocol.
- [x] No stack traces exposed: reasons are one line.
- [ ] DI registration: not applicable.
- [x] No ADR superseded.
