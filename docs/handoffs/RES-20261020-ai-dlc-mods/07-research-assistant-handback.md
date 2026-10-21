# Hand-back 07: research-assistant — cluster G-diagramming

Stored verbatim on 2026-10-20 (work item RES-20261020-ai-dlc-mods).

---

Short answer: none of the three mods fully covers R13. All three only redraw Mermaid code blocks in the CLI terminal transcript, and they share one renderer that handles six diagram types. None of them adds C4, use case, activity or architecture diagrams, none renders in VS Code, and none claims to render in plan mode. Most of the value for R13 has to come from new diagram guidance in our own skills, since those skills currently say almost nothing about diagrams.

**Per mod**

| Mod | What it does | How it works | Where it works | License and source | Maturity |
|---|---|---|---|---|---|
| claude-mermaid (Gal Elmalah) | Replaces each finished mermaid fence with coloured box art in the transcript. Types: flowchart, sequence, class, state, ER, xychart. Gantt, pie and mindmap stay as code. | A `ui.render` hook on `AssistantMessage` using beautiful-mermaid's ASCII renderer. Not an MCP server, not a side pane, no plan-mode feature, no network calls. | Listed for terminal, desktop and mobile; colour only in the terminal. Nothing draws in `claude -p`. The page never mentions VS Code. Needs Claude Code 2.1.287+. | MIT, github.com/galElmalah/claude-mods | v0.3.1, 5 stars, updated 2026-10-02 [1] |
| mermaid-inline (dazebug) | Draws real images in Ghostty, cmux and kitty (resvg to PNG over the kitty graphics protocol), box art in other terminals. Same six types. | Hooks on `session.start`, `command.run`, `prompt.compose` and `ui.render`, plus a local Node renderer. In image-capable sessions it adds about 150 words to the system prompt (can be turned off). | CLI terminal only. The page says the desktop app, VS Code and `claude -p` are not rendered. macOS and Linux only, so it would not run on your Windows machine. Needs Node 18+. | MIT, github.com/dazebug/mermaid-inline | v0.1.0, 0 stars, published 2026-10-03 [2] |
| mermaid (WhiteKr) | Box art in place of the fence, with a plain-ASCII option. Flowchart, sequence, class, ER and state. Leaves the fence alone if the diagram is wider than the terminal or doesn't parse. | Same `ui.render` hook and beautiful-mermaid ASCII renderer. The saved transcript keeps the mermaid source. | Terminal only. Needs 2.1.287+. | MIT, github.com/WhiteKr/claude-plugin-mermaid | v0.1.0, 0 stars, tested Claude Code version not stated [3] |

**Plan mode**
- **CLI:** none of the three pages says anything about plan mode (unverified). Because they hook the assistant message, they may not touch the plan view at all.
- **VS Code:** the extension opens a plan "as a full Markdown document where you can add inline comments" [4]. Nothing in the docs says Mermaid is rendered there. The feature request for Mermaid rendering in the VS Code extension (#20529) was closed by a bot for inactivity on 2026-02-27, never implemented [5]. So there is no confirmed inline Mermaid in plan mode on either harness. A five-minute manual test would settle it.

**Which diagram types Mermaid supports natively** (docs list 31 types [6])

| Need | Mermaid | Shown by the mods | Note |
|---|---|---|---|
| ER | yes; "experimental" per the Mermaid intro page [6] | yes | |
| Sequence | yes | yes | ZenUML is a second option [6] |
| Class | yes | yes | |
| State | yes | yes | |
| Activity | no type of its own; flowchart and "Swimlanes" stand in [6] | flowchart only | True UML activity notation needs PlantUML (not researched) |
| Use case | yes, `usecase-beta`, recent release only, laid out by ELK [7] | no | GitHub may not have that version yet (unverified; check with `info` inside a mermaid block [9]) |
| C4 | yes: Context, Container, Component, Dynamic, Deployment; "experimental … syntax may change" [8] | no | Structurizr is the mature alternative (not researched) |
| Architecture | yes, `architecture-beta`, v11.1.0+ [10] | no | |
| Business workflows | flowchart, swimlanes, user journey, requirement, event modeling [6] | flowchart only | BPMN would need another tool |

GitHub renders Mermaid in Markdown, so specs and ADRs that embed Mermaid already show as diagrams on PRs and in the repo [9].

**What the repo has today**
- `architecture-design`, `system-design`, `write-adr` and `requirement-analysis`: no hits for "mermaid", "C4", "diagram", PlantUML or Structurizr. No diagram guidance at all.
- `skills/architecture-narrative/references/narrative-template.md:51-54`: a Diagrams section listing context, container/component and key-flow views, without saying which syntax to use. `skills/architecture-narrative/SKILL.md:89` says simplest view first.
- `agents/product-owner.md:29`: the brief needs "use cases (Mermaid use-case or flow diagrams)". This is the only place that names Mermaid as a format.
- `skills/ai-dlc/SKILL.md:82` and `skills/workflow/templates/workflow.json:49`: the product-design lifecycle's exit artifact includes "use-case diagrams".
- `skills/workflow/templates/workflow.mjs:434-440`: `show --mermaid` generates flowcharts of the workflow. This proves we already emit Mermaid ourselves.

**Covered, gaps, feasibility**
- **Covered by the mods:** viewing flowchart, sequence, class, state and ER diagrams inside the CLI terminal transcript.
- **Gaps:**
  - C4, use case, architecture and Gantt diagrams are never rendered by any of the three.
  - Nothing works in VS Code, and plan-mode rendering is unconfirmed on both harnesses.
  - None of them is GitHub Copilot compatible: they are Claude Code `ui.render` hooks (inferred).
  - We have no diagram-authoring guidance telling the architect, system-engineer and analyst which diagram to draw at which stage.
- **Feasibility:**
  - Adding a shared Mermaid diagramming skill and linking it from the agents' skills is straightforward. It is agent-artifact work for `agent-manager`.
  - A VS Code renderer is outside what a plugin can do; it would need an extension. Plan-mode inline rendering depends on Anthropic and is not feasible from the plugin.

**Recommendation**
1. **Build:** a diagramming skill that maps each diagram type to its lifecycle stage and owner (C4 context and container in architecture, sequence/class/state in low-level design, ER for data, use case and flowchart/swimlanes in product and requirements). It should name the beta and experimental caveats and say PlantUML or Structurizr is the fallback for UML activity and full C4. Wire it into `architecture-design`, `system-design`, `write-adr`, `requirement-analysis` and the narrative template.
2. **Recommend, don't bundle:** suggest claude-mermaid in the docs as an optional CLI viewer (MIT, most mature of the three, not limited to macOS/Linux). Don't ship any of the three as a dependency.
3. **Reuse the idea:** mermaid-inline's prompt teaching becomes guidance in our skill.
4. **Not feasible:** rendering in VS Code and in plan mode. Rely on GitHub and VS Code Markdown preview for viewing.

**Confidence:** Medium. The mod facts come only from the claude-mods.com listings; I did not read the repositories' code. The Mermaid facts come from mermaid.js.org. Plan-mode behaviour is unverified.

**Open questions**
- Does the VS Code plan document render Mermaid if a Markdown Mermaid preview extension is installed? (unverified)
- Are PlantUML or Structurizr acceptable dependencies, or should we stay Mermaid-only?
- Does GitHub's Mermaid version support `usecase-beta` and `architecture-beta` yet?

**Sources**
1. https://claude-mods.com/claude-mermaid/
2. https://claude-mods.com/mermaid-inline/
3. https://claude-mods.com/whitekr-mermaid/
4. https://code.claude.com/docs/en/vs-code (plan mode section)
5. https://github.com/anthropics/claude-code/issues/20529
6. https://mermaid.js.org/intro/
7. https://mermaid.js.org/syntax/usecase.html
8. https://mermaid.js.org/syntax/c4.html
9. https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams
10. https://mermaid.js.org/syntax/architecture.html

I saved nothing to memory because plan mode blocked writes.
