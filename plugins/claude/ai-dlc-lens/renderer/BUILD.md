# The diagram renderer's vendor files

`render.mjs` draws Mermaid offline from the files in `vendor/`, which are checked in: the plugin installs nothing at run time. This file says where each one comes from and how to build them again. The design is `docs/specs/diagramming.lld.md`, section 3; the licence inventory is `docs/handoffs/FEAT-20261020-ai-dlc-lens/20.1.5-spike-t20.3a-metafile.md`.

| File | From | Version | Licence |
|---|---|---|---|
| `vendor/mermaid.mjs` | `beautiful-mermaid`, bundled with esbuild; it brings `elkjs` and `entities` | beautiful-mermaid 1.1.3, elkjs 0.11.1 (its pinned copy), entities 7.0.1 | MIT; EPL-2.0 (chosen from "EPL-2.0 OR GPL-3.0-or-later"); BSD-2-Clause |
| `vendor/index.mjs`, `vendor/index_bg.wasm` | `@resvg/resvg-wasm`, copied as published | 2.6.2 | MPL-2.0 |
| `vendor/fonts/Inter_400Regular.ttf` | `@expo-google-fonts/inter`, `400Regular/Inter_400Regular.ttf` | 0.4.2 | SIL OFL-1.1 |
| `vendor/fonts/OFL.txt` | the same package's `LICENSE_FONT` | 0.4.2 | (the licence text) |

## Rebuild

In a scratch folder outside the plugin (`.scratch/<task>/`):

```text
npm i beautiful-mermaid@1.1.3 @resvg/resvg-wasm@2.6.2 @expo-google-fonts/inter@0.4.2 esbuild@0.28.2
echo "export { renderMermaidSVG } from 'beautiful-mermaid';" > entry-mermaid.mjs
npx esbuild entry-mermaid.mjs --bundle --platform=node --format=esm --minify --metafile=meta.json --outfile=<plugin>/renderer/vendor/mermaid.mjs
cp node_modules/@resvg/resvg-wasm/index.mjs node_modules/@resvg/resvg-wasm/index_bg.wasm <plugin>/renderer/vendor/
cp node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf <plugin>/renderer/vendor/fonts/
cp node_modules/@expo-google-fonts/inter/LICENSE_FONT <plugin>/renderer/vendor/fonts/OFL.txt
```

`<plugin>` is `plugins/claude/ai-dlc-lens`. With the versions above the output is byte-identical to the checked-in files (`cmp` each one).

## Rules for a rebuild with other versions

- Compare the packages in `meta.json` (`inputs`, grouped by `node_modules/<package>`) with the table above. A package that is new, or has another licence, is a licence change: the human decides it (spec OQ3), and `THIRD_PARTY_NOTICES.md` changes with it.
- Re-run the flatten and scrub checks (`flatten.mjs`, `scrub.mjs`) on a fresh beautiful-mermaid SVG: an upgrade that writes its colours in another CSS form makes `flattenSvg` throw, and the render fails as `renderer failed` (never black).
- Keep `vendor/` free of anything that fetches: the WebAssembly is loaded from a buffer, and `render.mjs` replaces `fetch` with a function that throws.
- Inter Bold is not bundled: bold labels on the terminal are drawn in the Regular weight.
