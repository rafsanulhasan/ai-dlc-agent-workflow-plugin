# Attribution: the lens's hooks and renderer

What this plugin takes from third parties, and every change made to it. The licences are in the repository's `THIRD_PARTY_NOTICES.md`; the plugin-wide record is `../ATTRIBUTION.md`.

## Diagrams (ITEM-053, ITEM-056; 2026-10-25, step 38)

- **Vendored, unmodified, in `../renderer/vendor/`:** beautiful-mermaid 1.1.3 (MIT) with elkjs 0.11.1 (EPL-2.0) and entities 7.0.1 (BSD-2-Clause), bundled by esbuild 0.28.2 into `mermaid.mjs` (minified, no source change); `@resvg/resvg-wasm` 2.6.2 (MPL-2.0), `index.mjs` and `index_bg.wasm` as published; Inter Regular (SIL OFL-1.1) from `@expo-google-fonts/inter` 0.4.2, with its licence as `fonts/OFL.txt`. How to rebuild them: `../renderer/BUILD.md`.
- **Written here, no third-party code:** `diagram.ts` (fences, cleaning, caps, layout, cache key), `../renderer/render.mjs`, `flatten.mjs` (the var() and color-mix() evaluator that spike 20.1.5 found resvg needs) and `scrub.mjs`, and the `registerDiagram` hook in `register.tsx`.
- **Not used:** mermaid-inline and claude-code-figures (no code of either is copied).

## One band, active runs (step 44, R44.4 and R44.5; 2026-10-31)

- **Written here, no third-party code:** in `register.tsx`, the `AbovePrompt` hook draws the lens band only where every attached surface draws it (`bandEverywhere`, the rule `/ai-dlc:lens` already follows), so a VS Code session gets the pane alone; in `lens.ts`, `runListStatus` keeps a workflow whose run is `active` from reading `completed` in the run list and the band (it reads `waiting`), and `workflowInfo` uses it.
- **R44.4 widened (2026-10-31):** no change here; keep-alive (ai-dlc) follows the same surface rule, so a VS Code session draws no band below the tabbed pane.
- **R44.9, R44.10 (44.2.l1.3, 2026-10-31):** written here, no third-party code: `followSeat` in `register.tsx` closes the Run List tab when a lens pane is drawn inline, so a narrowing VS Code panel keeps one lens tab; VS Code itself moves the pane between above the prompt and the right pane. The probe (`p44`) used to find it is removed.
- **R44.12 (44.2.l1.4, 2026-10-31):** written here: `followSeat` also opens the Run List tab, without focus, when a VS Code lens pane is docked again after being inline. The comments that called AbovePrompt terminal and desktop only now say the probe saw VS Code raise it.
- **R44.14 to R44.16 (44.2.l1.5, 2026-10-31):** written here. The Run List tab opens only in tab mode, by `/ai-dlc:lens` and on widening (`openLens`, `seatChanged`). In VS Code the view's place follows the pane's seat (`followSeat`), and the mode button (`placePress`) switches between the pane (docked) and the band above the prompt (pinned, pane closed; `vscodeBandA`, `bandAllowed`), so R44.4's no-band rule now holds only while the pane is the view. The pinned note is not shown in VS Code.
- **R44.17, R44.18 (44.2.l1.6, 2026-10-31):** written here. The acts a render asks for (the seat follow, the band's hand-over, the band ping) run through `afterRender`, which tries a write again when the host refuses it as made during a later render's dispatch; the seat follow's refused write had left a widened pane in its narrow minimised list, without its flowchart.
- **R44.19, R44.20 (44.2.l1.7, 2026-10-31):** written here. On docking after inline, `seatChanged` lays out the workflow view in both panel types and opens the Run List tab in tab mode only. In VS Code a step's flowchart is drawn only in the docked pane; above the prompt a line says to widen the Claude panel (no host op can widen it), and the step's full-screen control is drawn dim while the panel is narrow.
