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
