# Attribution: the lens's hooks and renderer

What this plugin takes from third parties, and every change made to it. The licences are in the repository's `THIRD_PARTY_NOTICES.md`; the plugin-wide record is `../ATTRIBUTION.md`.

## Diagrams (ITEM-053, ITEM-056; 2026-10-25, step 38)

- **Vendored, unmodified, in `../renderer/vendor/`:** beautiful-mermaid 1.1.3 (MIT) with elkjs 0.11.1 (EPL-2.0) and entities 7.0.1 (BSD-2-Clause), bundled by esbuild 0.28.2 into `mermaid.mjs` (minified, no source change); `@resvg/resvg-wasm` 2.6.2 (MPL-2.0), `index.mjs` and `index_bg.wasm` as published; Inter Regular (SIL OFL-1.1) from `@expo-google-fonts/inter` 0.4.2, with its licence as `fonts/OFL.txt`. How to rebuild them: `../renderer/BUILD.md`.
- **Written here, no third-party code:** `diagram.ts` (fences, cleaning, caps, layout, cache key), `../renderer/render.mjs`, `flatten.mjs` (the var() and color-mix() evaluator that spike 20.1.5 found resvg needs) and `scrub.mjs`, and the `registerDiagram` hook in `register.tsx`.
- **Not used:** mermaid-inline and claude-code-figures (no code of either is copied).
