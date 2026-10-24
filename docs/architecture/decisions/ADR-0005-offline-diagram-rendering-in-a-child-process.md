# ADR-0005: Diagrams are rendered offline, in a child process, from vendored renderers

**Date**: 2026-10-24
**Status**: Proposed (awaiting G2)
**Deciders**: the human (decision 20: offline only, never remote); software-architect (the process and vendoring design)

## Context

The lens will draw Mermaid, math and PlantUML fences found in chat replies (root 20). Most diagram tools render on a server: Kroki, mermaid.ink or the PlantUML server. The human decided that diagrams never leave the machine, and that this holds even as an opt-in.

The lens hooks module cannot load npm packages (spike 20.1.1). The terminal needs PNG and the other surfaces need SVG. The available offline renderers have different licences:

| Renderer | Licence |
|---|---|
| beautiful-mermaid | MIT |
| ELK.js | EPL-2.0 |
| MathJax | Apache-2.0 |
| resvg | MPL-2.0 |
| PlantUML | GPL; the user supplies the jar |

## Decision

We will render every diagram on the user's machine, in a `node` child process (`renderer/render.mjs`). The renderer runs from pre-built, vendored bundles shipped in the lens plugin. There is no renderer URL setting, and no network fallback of any kind.

- **Clean on the way in and out.** Sources are cleaned of links and includes before rendering, and SVG output is cleaned of external references after it.
- **PlantUML** runs only from a jar the user configured, inside a trusted folder.
- **The PNG rasteriser** is chosen by a build spike (ITEM-053.a). The preferred option is the WebAssembly build of resvg, so the plugin ships no native binaries for each platform.
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
- The lens plugin grows by the vendored bundles, measured in ITEM-053.a. It also ships four more licences, and their notices must be kept current when the bundles are updated.
- Rendering needs `node` on PATH. Without it, users see the source and a reason.
- The vendored bundles have to be rebuilt by hand to pick up upstream fixes.
- The guarantee covers the lens's code and bundles. A user-supplied PlantUML jar is outside it, gated by path trust.
- A WebAssembly rasteriser needs a bundled font, which adds its size and licence (ITEM-053.a).

### Neutral
- The renderer's stdout uses the `{ data, error }` envelope.

## Compliance checklist

- [x] Affected components:
  - `ai-dlc-lens/hooks/diagram.ts` (new), `register.tsx`, `settings.ts`;
  - `renderer/` (new);
  - `THIRD_PARTY_NOTICES.md`, `ATTRIBUTION.md`, `MANUAL-CHECKS.md`.
- [x] Related ADRs: none. This is the first lens ADR in this folder.
- [x] `{ data, error }`: used on the renderer protocol.
- [x] No stack traces exposed: reasons are one line.
- [ ] DI registration: not applicable.
- [x] No ADR superseded.
