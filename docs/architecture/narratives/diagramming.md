---
feature: diagramming
root: 20
audience: product owner, plugin maintainer, G2 reviewer
author: software-architect
date: 2026-10-24
spec: docs/specs/diagramming.spec.md
adrs: [ADR-0005]
---

# Narrative: diagrams that render in the chat and never leave the machine

## Act 1: the problem

The architect and the engineers write UML and other diagrams as Mermaid, math or PlantUML in chat. Today the lens shows them as raw text, so a reader has to paste each one into a separate tool to see it (14.1.15).

## Act 2: constraints and choices

- **C1 (human).** Offline only, never a remote renderer. The order is Mermaid, then math, then PlantUML.
- **C2 (spike 20.1.1).** A render hook can split a reply around one fence. The hooks module cannot load npm packages.
- **C3 (spike 20.1.1).** The terminal draws PNG only, at most 2 MiB. Desktop, VS Code and mobile draw SVG, at most 131,072 characters.
- **C4 (licences).** Every bundled renderer ships its licence text. PlantUML, which is GPL, is never bundled.
- **C5 (po).** Each increment has its own on/off setting. A diagram that fails always stays readable as text.

### Alternatives

| Choice | Option | Outcome |
|---|---|---|
| Rendering | Remote | Rejected, C1 |
| Rendering | In-module | Impossible, C2 |
| Rendering | Child process with vendored renderers | Chosen |
| Placement | Beneath the reply | Fallback |
| Placement | Right after its fence | Recommended; the spike shows it works, and the human decides at G2 |

## Act 3: the design

- **D1, D2 (C2, C5).** A new hook draws each closed fence. Open fences wait. A reply with no fence is untouched.
- **D3, D5 (C1, C2; ADR-0005).** A `node` renderer process runs from vendored bundles. Inputs and outputs are sanitised, and no setting names a host. The PNG rasteriser is chosen by a build spike, and the WebAssembly build is preferred.
- **D4 (C3).** The output format follows the surface, and each surface's size cap is enforced.
- **D6 (C5).** There is one setting per kind. PlantUML runs only with a trusted, configured jar.
- **D7 (C5).** Every failure shows the source with a one-line reason.
- **D8 (C4).** Notices are written for each reused idea and each bundled renderer.

### Risks

- **Bundle size and the rasteriser** are measured and verified in ITEM-053.a. If they fail, the fallback is native resvg modules for each platform.
- **`node` must be on PATH.** Without it, users see the source and a reason.
- **Fonts.** A WebAssembly rasteriser needs a bundled font, which 053.a picks.
- **Source cleaning** is a new function. The `classify` reference in the stories is corrected.
- **Root 20 is a sprint stretch goal.** It is the first root to move to the backlog if the sprint ends.
