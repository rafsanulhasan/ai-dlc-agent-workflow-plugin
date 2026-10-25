// Cache Lab, the pure core (cache-lab LLD section 5). No `$`: `register.tsx` reads the transcripts and the
// price file and hands this module the calls and a `PriceOf`.
//
// Saved by cache, Lost to busts, NET, the miss attribution and the TTL mix reuse the formulas of claude-lens
// (MIT, (c) 2026 Foyzul Karim, https://github.com/foyzulkarim/claude-lens); see NOTICE.md and ATTRIBUTION.md.

import { lookupModel, parseCosting } from './lens'
import type { Costing, Prices } from './lens'

export type { Prices }

/** A model's prices per million tokens, or null when the price file does not name the model. */
export type PriceOf = (model: string) => Prices | null

/** The prices of the lens's model metadata file (the `costingPath` setting), or null when there is no readable file. */
export function priceOfCosting(c: Costing): PriceOf | null {
  const json = parseCosting(c)
  if (json === null) return null
  return model => {
    const f = lookupModel(json, model)
    return f === null ? null : { input: f.input, output: f.output, cacheRead: f.cacheRead, cacheWrite5m: f.cacheWrite5m, cacheWrite1h: f.cacheWrite1h }
  }
}
