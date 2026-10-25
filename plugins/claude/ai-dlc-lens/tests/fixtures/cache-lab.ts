// The Cache Lab fixtures F1 to F6h (stories, "Fixtures"), built from one table so that no number is typed
// twice. Times are UTC; the tests pin the display zone to 'UTC'. Expected values live in the tests, copied from the stories.
import type { Call } from '../../hooks/transcripts'
import type { PriceOf } from '../../hooks/cache-lab'

export const at = (hh: number, mm: number, day = 25, month = 10) => Date.UTC(2026, month - 1, day, hh, mm)
export const MIN = 60_000
export const M = 'fixture-model-m'
export const N = 'fixture-model-n'

/** Price file P: both models input 3, output 15, cacheRead 0.30, cacheWrite5m 3.75, cacheWrite1h 6.00. */
const P = { input: 3, output: 15, cacheRead: 0.3, cacheWrite5m: 3.75, cacheWrite1h: 6 }
export const priceP: PriceOf = model => (model === M || model === N ? P : null)
/** F3: P without fixture-model-n. */
export const priceF3: PriceOf = model => (model === M ? P : null)

let order = 0
type Spec = { session: string; ms: number; model?: string; in?: number; out?: number; cr?: number; cc5m?: number; cc1h?: number; cc?: number; stream?: string; id?: string }
/** One call. With cc5m or cc1h the split is present and cc is their sum; with only cc there is no split. */
export function call(s: Spec): Call {
  const split = s.cc5m !== undefined || s.cc1h !== undefined
  const c: Call = {
    session: s.session,
    stream: s.stream ?? 'main',
    at: s.ms,
    model: s.model ?? M,
    in: s.in ?? 0,
    out: s.out ?? 0,
    cr: s.cr ?? 0,
    cc: split ? (s.cc5m ?? 0) + (s.cc1h ?? 0) : s.cc ?? 0,
    order: order++,
  }
  if (split) {
    c.cc5m = s.cc5m ?? 0
    c.cc1h = s.cc1h ?? 0
  }
  if (s.id) c.id = s.id
  return c
}

/** F1 (rev 2). */
export function f1(): Call[] {
  order = 0
  return [
    call({ session: 'A', ms: at(10, 0), in: 100, out: 100, cr: 0, cc5m: 20000, cc1h: 0 }), // A1
    call({ session: 'A', ms: at(10, 2), in: 100, out: 100, cr: 20000, cc5m: 500, cc1h: 0 }), // A2
    call({ session: 'A', ms: at(10, 10), in: 100, out: 100, cr: 15000, cc5m: 20600, cc1h: 0 }), // A3
    call({ session: 'A', ms: at(10, 12), in: 100, out: 100, cr: 5000, cc5m: 15700, cc1h: 0 }), // A4
    call({ session: 'A', ms: at(10, 13), model: N, in: 100, out: 100, cr: 0, cc5m: 0, cc1h: 12000 }), // A5
    call({ session: 'A', ms: at(10, 14), in: 100, out: 100, cr: 12000, cc: 3000 }), // A6, no split
    call({ session: 'B', ms: at(10, 59), stream: 'agent:b0', in: 50, out: 50, cr: 0, cc5m: 4000, cc1h: 0 }), // B0 sidechain
    call({ session: 'B', ms: at(11, 0), in: 50, out: 50, cr: 0, cc5m: 10000, cc1h: 0 }), // B1
    call({ session: 'C', ms: at(12, 0), cr: 0, cc5m: 60000, cc1h: 0 }), // C1
  ]
}

/** F2: one session, a first call then 51 busts (cc5m 11,000), one minute apart, 10:01 to 10:51. */
export function f2(): Call[] {
  order = 0
  return [call({ session: 'S', ms: at(10, 0), cc5m: 100, cc1h: 0 }), ...Array.from({ length: 51 }, (_, i) => call({ session: 'S', ms: at(10, 1 + i), cc5m: 11000, cc1h: 0 }))]
}

/** F4 (compaction) and F4b (the ratio exactly 0.5): D3's cr is 8,000 or 10,000. */
export function f4(d3cr = 8000): Call[] {
  order = 0
  return [
    call({ session: 'D', ms: at(10, 0), in: 100, cr: 0, cc5m: 20000, cc1h: 0 }),
    call({ session: 'D', ms: at(10, 1), in: 100, cr: 20000, cc5m: 0, cc1h: 0 }),
    call({ session: 'D', ms: at(10, 2), in: 100, cr: d3cr, cc5m: 0, cc1h: 0 }),
    call({ session: 'D', ms: at(10, 3), in: 100, cr: 0, cc5m: 20000, cc1h: 0 }),
  ]
}

/** F5: F1 plus E1 (2026-10-24 12:00, cr 1,000), G1 (2026-10-01, cr 2,000) and H1 (2026-09-01, cr 4,000). The clock reads F5_NOW. */
export function f5(): Call[] {
  return [
    ...f1(),
    call({ session: 'E', ms: at(12, 0, 24), cr: 1000 }),
    call({ session: 'G', ms: at(12, 0, 1, 10), cr: 2000 }),
    call({ session: 'H', ms: at(12, 0, 1, 9), cr: 4000 }),
  ]
}
export const F5_NOW = at(12, 30)

/** F6: F5 plus C2 at 12:20 (cr 3,000), seeded by a handoff from C. */
export function f6(): Call[] {
  return [...f5(), call({ session: 'C2', ms: at(12, 20), cr: 3000 })]
}

/** A one-session stream with the given (minute offset, spec) calls: the previous-call setups of AC-22.3.6. */
export function stream(calls: Omit<Spec, 'session'>[]): Call[] {
  order = 0
  return calls.map(c => call({ session: 'T', ...c }))
}
