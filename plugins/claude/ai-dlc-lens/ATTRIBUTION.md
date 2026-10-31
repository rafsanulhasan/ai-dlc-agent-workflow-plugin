# Attribution: ai-dlc-lens

What this plugin takes from upstream projects, and how it changed it. The licence notices are in `NOTICE.md` and in the repository's `THIRD_PARTY_NOTICES.md`.

## foyzulkarim/claude-lens (MIT, (c) 2026 Foyzul Karim)

Source: [claude-lens](https://github.com/foyzulkarim/claude-lens), its Cache Lab (`server/cache/classifier.ts` and the Cache Lab page). Formulas only, written anew in `hooks/cache-lab.ts`; no code copied. Design: `docs/specs/cache-lab.lld.md`.

| Formula | Taken | Changes |
|---|---|---|
| Saved by cache: `cache read tokens x (input price - cache read price)` | ITEM-069 / 070 | none |
| Lost to busts: a bust's cache write priced above the cache read price | ITEM-070 | modified: each cache write is priced at its TTL's write rate (5m, 1h; an unknown TTL at the 5m rate) |
| NET: Saved minus Lost | ITEM-070 | none |
| Miss attribution (TTL lapse, Prefix change, Unknown) and its compaction rule (the cache read of the two calls before falls by more than half) | ITEM-071 | none |
| TTL mix (5m, 1h, unknown cache writes) | ITEM-071 | none |

Not taken (they deliberately differ): Cache Hit % (token-weighted), Tokens Saved (cache-read tokens), Median baseline (a true median).

## Changes

- 2026-10-25 (ITEM-069, step 37): the transcript reader (`hooks/cache-reader.mjs`), its lens side (`hooks/transcripts.ts`) and the price lookup (`hooks/cache-lab.ts`, `priceOfCosting`).
- 2026-10-25 (ITEM-070, step 37): Saved by cache, Lost to busts (per-TTL write rates) and NET in `hooks/cache-lab.ts`.
- 2026-10-25 (ITEM-071, step 37): the miss attribution with the compaction rule, and the TTL mix.
- 2026-10-25 (ITEM-072, step 37): the Invalidation Gallery (busts newest first, cap 50) and the reader's turn join.
- 2026-10-25 (ITEM-077, step 38): the Cache Lab `This session` window covers the automatic handoff chain: the chain keep-alive publishes (`chainFrom`, `chainNowOf` in `hooks/cache-lab.ts`), else the transcript's session; the window choice is kept per chain id, and a press made before the chain arrives moves to the chain's id.
- 2026-10-25 (ITEM-053.b, step 38): the diagramming core: `hooks/diagram.ts` (pure: `findFences`, `texKind`, `sanitiseSource` for Mermaid, `mermaidKind`, `scrubSvg`, `fitCaps`, `reasonFor`, `layoutParts`, `cacheKey`) and the renderer process `renderer/` (`render.mjs`, `flatten.mjs`, `scrub.mjs`, `BUILD.md`, and `vendor/`: beautiful-mermaid with elkjs and entities bundled by esbuild, @resvg/resvg-wasm, Inter Regular with its OFL). Not yet drawn: the hook is ITEM-053.c.
- 2026-10-25 (ITEM-053.c, step 38): `registerDiagram` in `hooks/register.tsx`: a closed mermaid fence in an assistant message is drawn right after its source, a PNG `Image` on the terminal and an `Svg` elsewhere, through `renderer/render.mjs`; memory and disk cache, a 300 ms wait, then `rendering…` and one redraw; the setting `diagramMermaid`; `MANUAL-CHECKS.md` row D1.
- 2026-10-25 (ITEM-056, step 38): `hooks/ATTRIBUTION.md` created for the diagram renderer; `THIRD_PARTY_NOTICES.md` gains its five entries; `NOTICE.md` names the vendored code.
- 2026-10-25 (step 42): Cache Lab moved from the AI-DLC Lens view's head into the agent panel, in place of the Cache keep-alive section (removed); its Keep Alive sub-accordion now holds what that section showed, and Cache Lab gains on/off buttons for Master, 1h and 5m (`keepaliveSwitches`, `switchArgs` in `hooks/cache-lab.ts`), which run `/ai-dlc:cache-keepalive ... --session`. The lens band no longer draws keep-alive's line: keep-alive has a band of its own. No third-party code or formula changed.
- 2026-10-26 (step 43): the AI-DLC Lens view's band and pane each have a list or workflow mode (`LensView.bandMode`, `paneMode`, pure rules in `hooks/lens.ts`); the combined wide layout is retired; `/ai-dlc:lens` pinned shows the band minimised only; the controls, the chat card's "Open flowchart" and avatar and arrow drill-ins follow the site; step charts are accordions with a minimise; the agent panel gains Panel Type and its Anomalies and a new order, and Cache Lab follows `collapsedByDefault`; run status fixes (a restarted step's latest attempt wins, a `done` run state or stage counts as completed, a listed `completed` applies, band and step accordion share their inputs, the poll refreshes run states another session writes). No third-party code or formula changed.
- 2026-10-31 (step 43, review round 4): the `openLens` doc comment in `hooks/register.tsx` describes the seat `commandSeatOf` gives, and that `paneSeat` can be stale after a resize with no redraw. Comment only; no third-party code or formula changed.
