import { describe, expect, test } from 'claude-code/testing'
import {
  ATTRIBUTION_LABELS,
  BUST_THRESHOLD,
  DEFAULT_WINDOW,
  GALLERY_CAP,
  WINDOWS,
  WINDOW_LABELS,
  WINDOW_SESSIONS_MAX,
  attributionOf,
  cacheLab,
  chainFrom,
  chainNowOf,
  classify,
  count,
  galleryHeader,
  galleryLine,
  hhmm,
  isCompaction,
  isPreset,
  labOf,
  lostOf,
  median,
  medianK,
  noPriceNote,
  pct,
  presetOf,
  priceOfCosting,
  share,
  turnLine,
  usd,
  windowOf,
  withPreset,
} from '../hooks/cache-lab'
import type { Window } from '../hooks/cache-lab'
import { at, call, f1, f2, f4, f5, f6, F5_NOW, M, MIN, N, priceF3, priceP, stream } from './fixtures/cache-lab'

// Cache Lab, the pure core (cache-lab spec and stories; ITEM-069 to 072 and 077). `cacheLab` is the highest
// seam that observes every number: calls, prices and a window go in, the figures come out. Every expected
// value below is copied from the stories, not computed by the code under test.

// The test runner has no toBeCloseTo
const near = (got: number | null, want: number, digits: number) => expect(got !== null && Math.abs(got - want) < 10 ** -digits).toBe(true)
const ALL: Window = { from: 0, to: Infinity }
const labF1 = (price = priceP, w: Window = ALL) => cacheLab(f1(), price, w)

describe('[AC-22.2.2 to 22.2.8] F1, P, every call', () => {
  const lab = labF1()
  test('[AC-22.2.2] Saved by cache is $0.14 (52,000 x 2.70 / 1e6 = 0.1404)', () => {
    near(lab.savedUsd, 0.1404, 6)
    expect(usd(lab.savedUsd)).toBe('$0.14')
  })
  test('[AC-22.2.3] Lost to busts is $0.19 (A3 20,600 x 3.45 + A4 15,700 x 3.45 + A5 12,000 x 5.70 = 193,635 / 1e6)', () => {
    near(lab.lostUsd, 0.193635, 6)
    expect(usd(lab.lostUsd)).toBe('$0.19')
  })
  test('[AC-22.2.4] NET is -$0.05, a negative value', () => {
    near(lab.netUsd, -0.053235, 6)
    expect(usd(lab.netUsd)).toBe('-$0.05')
  })
  test('[AC-22.2.5] Cache Hit % is 26.2% (52,000 / (52,000 + 145,800 + 700))', () => {
    near(lab.hitPct, 26.196, 3)
    expect(pct(lab.hitPct)).toBe('26.2%')
  })
  test('[AC-22.2.6] Tokens Saved is 52,000, a token count', () => {
    expect(lab.tokensSaved).toBe(52000)
    expect(count(lab.tokensSaved)).toBe('52,000')
  })
  test('[AC-22.2.7] Bust events is 3: A3, A4, A5; the first calls and the 10,000 write are not busts', () => {
    expect(lab.bustEvents).toBe(3)
  })
  test('[AC-22.2.8] Median baseline is 20k: the median of 20,000, 10,000, 60,000 (the mean 30k is wrong; the sidechain B0 is not B\'s baseline)', () => {
    expect(lab.medianBaseline).toBe(20000)
    expect(medianK(lab.medianBaseline)).toBe('20k')
  })
  test('nothing is unpriced and the lab is priced', () => {
    expect(lab.unpricedCalls).toBe(0)
    expect(lab.priced).toBe(true)
  })
})

describe('[AC-22.1.2, 22.2.9] a window 10:05 to 11:30 over F1', () => {
  const w: Window = { from: at(10, 5), to: at(11, 30) }
  test('[AC-22.1.2] A3 is still a bust attributed TTL lapse: its neighbours A2 and A1 are outside the window but used', () => {
    const lab = cacheLab(f1(), priceP, w)
    expect(lab.gallery.rows.map(r => [r.at, r.attribution])).toContainEqual([at(10, 10), 'ttlLapse'])
  })
  test('[AC-22.2.9] Tokens Saved 32,000 (A3 15,000 + A4 5,000 + A6 12,000), Bust events 3, Median baseline 10k', () => {
    const lab = cacheLab(f1(), priceP, w)
    expect(lab.tokensSaved).toBe(32000)
    expect(lab.bustEvents).toBe(3)
    expect(medianK(lab.medianBaseline)).toBe('10k')
  })
  test('the window is inclusive at both ends', () => {
    const exact = cacheLab(f1(), priceP, { from: at(10, 10), to: at(10, 12) })
    expect(exact.bustEvents).toBe(2) // A3 and A4
    expect(exact.tokensSaved).toBe(20000)
  })
  test('a window\'s first call is not its stream\'s first: classification runs over the whole stream', () => {
    const lab = cacheLab(f1(), priceP, { from: at(10, 10), to: at(10, 10) })
    expect(lab.bustEvents).toBe(1)
  })
})

describe('[AC-22.1.3, 22.2.10] F3: fixture-model-n has no price', () => {
  const lab = labF1(priceF3)
  test('Saved $0.14, Lost $0.13 (125,235 / 1e6), NET $0.02 (0.015165)', () => {
    expect(usd(lab.savedUsd)).toBe('$0.14')
    near(lab.lostUsd, 0.125235, 6)
    expect(usd(lab.lostUsd)).toBe('$0.13')
    near(lab.netUsd, 0.015165, 6)
    expect(usd(lab.netUsd)).toBe('$0.02')
  })
  test('one call with no price is noted; hit %, tokens saved and bust events are F1\'s', () => {
    expect(lab.unpricedCalls).toBe(1)
    expect(noPriceNote(lab.unpricedCalls)).toBe('1 call with no price')
    expect(pct(lab.hitPct)).toBe('26.2%')
    expect(lab.tokensSaved).toBe(52000)
    expect(lab.bustEvents).toBe(3)
    expect(lab.priced).toBe(true)
  })
  test('a plural note', () => expect(noPriceNote(2)).toBe('2 calls with no price'))
})

describe('[AC-22.1.5] no price file at all', () => {
  test('priceOf null: unpriced, every dollar is "no price" (priced false), tokens still counted', () => {
    const lab = cacheLab(f1(), null, ALL)
    expect(lab.priced).toBe(false)
    expect(lab.tokensSaved).toBe(52000)
    expect(lab.bustEvents).toBe(3)
    expect(lab.savedUsd).toBe(0)
    expect(lab.lostUsd).toBe(0)
  })
  test('a price file that names none of the models is also unpriced', () => {
    expect(cacheLab(f1(), () => null, ALL).priced).toBe(false)
  })
})

describe('[AC-22.2.11] a window with no calls', () => {
  test('dollars $0.00, hit %, median baseline "—", tokens 0, busts 0; still priced', () => {
    const lab = cacheLab(f1(), priceP, { from: at(23, 0), to: at(23, 30) })
    expect([usd(lab.savedUsd), usd(lab.lostUsd), usd(lab.netUsd)]).toEqual(['$0.00', '$0.00', '$0.00'])
    expect(pct(lab.hitPct)).toBe('—')
    expect(lab.tokensSaved).toBe(0)
    expect(lab.bustEvents).toBe(0)
    expect(medianK(lab.medianBaseline)).toBe('—')
    expect(lab.priced).toBe(true)
  })
  test('no calls at all', () => {
    const lab = cacheLab([], priceP, ALL)
    expect(lab).toMatchObject({ bustEvents: 0, tokensSaved: 0, hitPct: null, medianBaseline: null })
  })
})

describe('[AC-22.3.1] miss attribution over F1', () => {
  test('TTL lapse 1 (A3), Prefix change 1 (A4: its cache read fell 25%, not compaction), Unknown 1 (A5, model switch); they add up to Bust events', () => {
    const lab = labF1()
    expect(lab.attribution).toEqual({ ttlLapse: 1, prefixChange: 1, unknown: 1 })
    expect(lab.attribution.ttlLapse + lab.attribution.prefixChange + lab.attribution.unknown).toBe(lab.bustEvents)
  })
  test('[AC-22.3.2] a bust whose usage has no split is Unknown', () => {
    const calls = stream([{ ms: at(10, 0), cc: 100 }, { ms: at(10, 1), cc: 11000 }])
    expect(cacheLab(calls, priceP, ALL).attribution).toEqual({ ttlLapse: 0, prefixChange: 0, unknown: 1 })
  })
})

describe('[AC-22.3.3] compaction, the exact rule', () => {
  test('F4: the cache read fell 60% (20,000 to 8,000): D4 is compaction and counts as Unknown', () => {
    expect(cacheLab(f4(8000), priceP, ALL).attribution).toEqual({ ttlLapse: 0, prefixChange: 0, unknown: 1 })
  })
  test('F4b: a fall of exactly 50% is not compaction: D4 is a Prefix change', () => {
    expect(cacheLab(f4(10000), priceP, ALL).attribution).toEqual({ ttlLapse: 0, prefixChange: 1, unknown: 0 })
  })
  test('isCompaction over (before-previous cr, previous cr) pairs', () => {
    const cr = (n: number | undefined) => (n === undefined ? undefined : call({ session: 'X', ms: 0, cr: n }))
    const t = (bp: number | undefined, prev: number | undefined) => isCompaction(cr(bp), cr(prev))
    expect(t(20000, 0)).toBe(true) // a fall of 100%
    expect(t(20000, 10000)).toBe(false) // exactly 50%: not above
    expect(t(20000, 9999)).toBe(true)
    expect(t(0, 0)).toBe(false) // nothing to fall from
    expect(t(undefined, 5)).toBe(false)
    expect(t(5, undefined)).toBe(false)
    expect(t(20000, 30000)).toBe(false) // a rise is a negative ratio, clamped
  })
})

describe('[AC-22.3.4, 22.3.5] TTL mix', () => {
  test('[AC-22.3.4] F1: 5m 130,800 (89.7%), 1h 12,000 (8.2%), unknown 3,000 (2.1%); the parts add to 145,800', () => {
    const { ttlMix } = labF1()
    expect(ttlMix).toEqual({ m5: 130800, h1: 12000, unknown: 3000, total: 145800 })
    expect([share(ttlMix.m5, ttlMix.total), share(ttlMix.h1, ttlMix.total), share(ttlMix.unknown, ttlMix.total)]).toEqual([' (89.7%)', ' (8.2%)', ' (2.1%)'])
  })
  test('[AC-22.3.5] a window with no cache write: 0 for each part and no percentages', () => {
    const lab = cacheLab(f5(), priceP, { from: at(12, 0, 24), to: at(12, 0, 24) }) // E1 only: cr, no write
    expect(lab.ttlMix).toEqual({ m5: 0, h1: 0, unknown: 0, total: 0 })
    expect(share(0, 0)).toBe('')
  })
  test('a split that sums to less than cc leaves the rest as unknown; one that sums to more clamps at 0', () => {
    const under = { ...call({ session: 'X', ms: at(10, 0), cc5m: 100, cc1h: 0 }), cc: 150 }
    const over = { ...call({ session: 'Y', ms: at(10, 0), cc5m: 100, cc1h: 0 }), cc: 50 }
    expect(cacheLab([under], priceP, ALL).ttlMix.unknown).toBe(50)
    expect(cacheLab([over], priceP, ALL).ttlMix.unknown).toBe(0)
  })
})

describe('[AC-22.3.6] boundary cases of miss attribution', () => {
  // A stream of model m: a first call, then a previous call that is unexplained (no fall in cr), then the bust `gap` after it.
  const bustAfter = (gapMs: number, w: { cc5m?: number; cc1h?: number }, prevCr = 20000) => {
    const calls = stream([
      { ms: at(9, 0), cr: 20000, cc5m: 100, cc1h: 0 },
      { ms: at(9, 30), cr: prevCr, cc5m: 100, cc1h: 0 },
      { ms: at(9, 30) + gapMs, cc5m: w.cc5m ?? 0, cc1h: w.cc1h ?? 0 },
    ])
    return classify(calls).find(c => c.bust)?.attribution
  }
  for (const [name, gap, w, want] of [
    ['cc5m 11,000, exactly 5m 00s', 5 * MIN, { cc5m: 11000 }, 'prefixChange'],
    ['cc5m 11,000, 5m 01s', 5 * MIN + 1000, { cc5m: 11000 }, 'ttlLapse'],
    ['cc1h 11,000, 61m', 61 * MIN, { cc1h: 11000 }, 'ttlLapse'],
    ['cc1h 11,000, 30m', 30 * MIN, { cc1h: 11000 }, 'prefixChange'],
    ['cc1h 11,000, exactly 60m', 60 * MIN, { cc1h: 11000 }, 'prefixChange'],
    ['both TTLs, 30m (over 5m, within 1h)', 30 * MIN, { cc5m: 6000, cc1h: 6000 }, 'unknown'],
    ['both TTLs, 61m', 61 * MIN, { cc5m: 6000, cc1h: 6000 }, 'ttlLapse'],
    ['both TTLs, 2m', 2 * MIN, { cc5m: 6000, cc1h: 6000 }, 'prefixChange'],
  ] as const) {
    test(`${name} -> ${want}`, () => {
      expect(bustAfter(gap, w)).toBe(want)
    })
  }
  for (const [name, gap, want] of [
    ['compaction after 8m (over the 5m TTL): TTL lapse, the gap is checked first', 8 * MIN, 'ttlLapse'],
    ['compaction within the TTL (1m): Unknown (F4\'s D4)', 1 * MIN, 'unknown'],
  ] as const) {
    test(name, () => {
      expect(bustAfter(gap, { cc5m: 11000 }, 8000)).toBe(want)
    })
  }
  test('a model switch is Unknown whatever the gap', () => {
    const calls = stream([
      { ms: at(9, 0), cr: 20000, cc5m: 100, cc1h: 0 },
      { ms: at(9, 30), cr: 20000, cc5m: 100, cc1h: 0 },
      { ms: at(9, 30) + 30 * MIN, model: N, cc5m: 11000, cc1h: 0 },
    ])
    expect(classify(calls).find(c => c.bust)?.attribution).toBe('unknown')
  })
  test('attributionOf directly: no represented TTL is Unknown', () => {
    const a = call({ session: 'X', ms: 0, cc: 100 })
    const b = call({ session: 'X', ms: 1000, cc: 11000 })
    expect(attributionOf(b, a, 'unexplained')).toBe('unknown')
  })
})

describe('classify: first call and bust', () => {
  test('the strict threshold: a write of exactly 10,000 is not a bust, 10,001 is', () => {
    expect(BUST_THRESHOLD).toBe(10000)
    const mk = (cc: number) => classify(stream([{ ms: at(10, 0), cc5m: 100, cc1h: 0 }, { ms: at(10, 1), cc5m: cc, cc1h: 0 }]))[1]!
    expect(mk(10000).bust).toBe(false)
    expect(mk(10001).bust).toBe(true)
  })
  test('a first call never busts, however large; each stream has its own first call', () => {
    const c = classify(f1())
    expect(c.find(x => x.session === 'C')).toMatchObject({ first: true, bust: false, base: 'first' })
    expect(c.find(x => x.stream === 'agent:b0')).toMatchObject({ first: true, bust: false })
    expect(c.find(x => x.session === 'B' && x.stream === 'main')).toMatchObject({ first: true, bust: false })
  })
  test('calls are ordered by time, then by order, within a stream', () => {
    const [x, y] = [call({ session: 'Q', ms: 5, cc5m: 20000, cc1h: 0 }), call({ session: 'Q', ms: 5, cc5m: 20000, cc1h: 0 })]
    const out = classify([y, x])
    expect(out.map(c => c.order)).toEqual([x.order, y.order])
    expect(out[0]!.first).toBe(true)
  })
})

describe('lostOf', () => {
  const P = { input: 3, output: 15, cacheRead: 0.3, cacheWrite5m: 3.75, cacheWrite1h: 6 }
  test('each write at its TTL\'s rate over the cache-read rate', () => {
    const c = call({ session: 'X', ms: 0, cc5m: 1000, cc1h: 1000 })
    near(lostOf(c, P), (1000 * 3.45 + 1000 * 5.7) / 1e6, 9)
  })
  test('an unknown-TTL write is charged at the 5m rate', () => {
    near(lostOf(call({ session: 'X', ms: 0, cc: 1000 }), P), (1000 * 3.45) / 1e6, 9)
  })
  test('the part a split does not cover is charged at the 5m rate', () => {
    const c = { ...call({ session: 'X', ms: 0, cc5m: 0, cc1h: 1000 }), cc: 1500 }
    near(lostOf(c, P), (1000 * 5.7 + 500 * 3.45) / 1e6, 9)
  })
  test('a rate below the cache-read rate costs nothing (max with 0)', () => {
    expect(lostOf(call({ session: 'X', ms: 0, cc: 1000 }), { ...P, cacheWrite5m: 0.1 })).toBe(0)
  })
  test('a missing price makes it null: no prices, no cache-read price, or the TTL\'s write price', () => {
    const c = call({ session: 'X', ms: 0, cc5m: 1000, cc1h: 1000 })
    expect(lostOf(c, null)).toBeNull()
    expect(lostOf(c, { ...P, cacheRead: null })).toBeNull()
    expect(lostOf(c, { ...P, cacheWrite1h: null })).toBeNull()
    expect(lostOf(c, { ...P, cacheWrite5m: null })).toBeNull()
  })
  test('a 1h-only write does not need the 5m price', () => {
    expect(lostOf(call({ session: 'X', ms: 0, cc5m: 0, cc1h: 1000 }), { ...P, cacheWrite5m: null })).not.toBeNull()
  })
})

describe('median', () => {
  test('the true median: odd count the middle, even count the mean of the two middle values, none null', () => {
    expect(median([60000, 10000, 20000])).toBe(20000)
    expect(median([10000, 20000, 30000, 60000])).toBe(25000)
    expect(median([7])).toBe(7)
    expect(median([])).toBeNull()
  })
  test('it does not reorder its argument', () => {
    const xs = [3, 1, 2]
    median(xs)
    expect(xs).toEqual([3, 1, 2])
  })
})

describe('[AC-22.4.1 to 22.4.7] the Invalidation Gallery', () => {
  test('[AC-22.4.1] F1: exactly 3 rows, newest first: A5, A4, A3; the header reads "3 busts"', () => {
    const { gallery } = labF1()
    expect(gallery.rows.map(r => r.at)).toEqual([at(10, 13), at(10, 12), at(10, 10)])
    expect(gallery.total).toBe(3)
    expect(galleryHeader(gallery)).toBe('3 busts')
  })
  test('the header of one bust is singular', () => {
    expect(galleryHeader({ rows: [], total: 1, truncated: false })).toBe('1 bust')
  })
  test('[AC-22.4.2] each row shows time, model, session, attribution, cache-write tokens and loss', () => {
    const lab = labF1()
    expect(lab.gallery.rows.map(r => galleryLine(r, lab.priced, 'UTC'))).toEqual([
      '10:13 · fixture-model-n · A · Unknown · 12,000 · $0.07',
      '10:12 · fixture-model-m · A · Prefix change · 15,700 · $0.05',
      '10:10 · fixture-model-m · A · TTL lapse · 20,600 · $0.07',
    ])
  })
  test('[AC-22.4.3] F3: A5\'s loss reads "no price", the other rows are unchanged', () => {
    const lab = labF1(priceF3)
    const lines = lab.gallery.rows.map(r => galleryLine(r, lab.priced, 'UTC'))
    expect(lines[0]).toBe('10:13 · fixture-model-n · A · Unknown · 12,000 · no price')
    expect(lines.slice(1)).toEqual(['10:12 · fixture-model-m · A · Prefix change · 15,700 · $0.05', '10:10 · fixture-model-m · A · TTL lapse · 20,600 · $0.07'])
  })
  test('with no price file every row reads "no price"', () => {
    const lab = cacheLab(f1(), null, ALL)
    expect(lab.gallery.rows.every(r => galleryLine(r, lab.priced, 'UTC').endsWith(' · no price'))).toBe(true)
  })
  test('[AC-22.4.4] F2: 50 rows (10:51 back to 10:02), "50 of 51 busts", truncated; the bust at 10:01 is not shown; Bust events 51', () => {
    const lab = cacheLab(f2(), priceP, ALL)
    expect(GALLERY_CAP).toBe(50)
    expect(lab.gallery.rows).toHaveLength(50)
    expect(lab.gallery.rows[0]!.at).toBe(at(10, 51))
    expect(lab.gallery.rows.at(-1)!.at).toBe(at(10, 2))
    expect(lab.gallery.rows.some(r => r.at === at(10, 1))).toBe(false)
    expect(lab.gallery.truncated).toBe(true)
    expect(lab.gallery.total).toBe(51)
    expect(galleryHeader(lab.gallery)).toBe('50 of 51 busts')
    expect(lab.bustEvents).toBe(51)
  })
  test('[AC-22.4.5] a sidechain bust names its stream; a main-loop row names none', () => {
    const calls = [
      call({ session: 'Z', ms: at(10, 0), stream: 'agent:abc', cc5m: 100, cc1h: 0 }),
      call({ session: 'Z', ms: at(10, 1), stream: 'agent:abc', cc5m: 11000, cc1h: 0 }),
      call({ session: 'Z', ms: at(10, 0), cc5m: 100, cc1h: 0 }),
      call({ session: 'Z', ms: at(10, 2), cc5m: 11000, cc1h: 0 }),
    ]
    const lines = cacheLab(calls, priceP, ALL).gallery.rows.map(r => galleryLine(r, true, 'UTC'))
    expect(lines.find(l => l.startsWith('10:01'))).toContain(' · Z · agent:abc · ')
    expect(lines.find(l => l.startsWith('10:02'))).not.toContain('agent:')
  })
  test('[AC-22.4.6] the turn label is "prompt <first 8> · turn <n>", else "No turn attribution"', () => {
    const lab = cacheLab([{ ...call({ session: 'Z', ms: at(10, 0), cc5m: 100, cc1h: 0 }) }, { ...call({ session: 'Z', ms: at(10, 1), cc5m: 11000, cc1h: 0 }), pid: '0123456789abcdef', turn: 4 }, call({ session: 'Z', ms: at(10, 2), cc5m: 11000, cc1h: 0 })], priceP, ALL)
    expect(lab.gallery.rows.map(turnLine)).toEqual(['No turn attribution', 'prompt 01234567 · turn 4'])
  })
  test('a pid with no turn, or a turn with no pid, is not a label', () => {
    expect(turnLine({ at: 0, model: 'm', session: 's', stream: 'main', attribution: 'unknown', cacheWrite: 1, lossUsd: 0, pid: 'abcdefghij' })).toBe('No turn attribution')
    expect(turnLine({ at: 0, model: 'm', session: 's', stream: 'main', attribution: 'unknown', cacheWrite: 1, lossUsd: 0, turn: 2 })).toBe('No turn attribution')
  })
  test('[AC-22.4.7] a row carries no prompt text or tool details: only ids, times, model, counts and the label', () => {
    const lab = labF1()
    for (const r of lab.gallery.rows) expect(Object.keys(r).sort()).toEqual(['at', 'attribution', 'cacheWrite', 'lossUsd', 'model', 'session', 'stream'])
  })
  test('the session is shown as its first 8 characters', () => {
    const r = { at: at(10, 0), model: 'm', session: '0123456789abcdef', stream: 'main', attribution: 'unknown' as const, cacheWrite: 12000, lossUsd: 0.07 }
    expect(galleryLine(r, true, 'UTC')).toBe('10:00 · m · 01234567 · Unknown · 12,000 · $0.07')
  })
})

describe('[AC-22.2.12] the window presets over F5', () => {
  const NOW = F5_NOW
  const tokens = (preset: (typeof WINDOWS)[number], sessions: string[] = ['C']) => cacheLab(f5(), priceP, windowOf(preset, NOW, sessions)).tokensSaved
  test('the five presets, in order, with their labels; the default is 7d', () => {
    expect([...WINDOWS]).toEqual(['session', 'today', '7d', '30d', 'all'])
    expect(WINDOWS.map(w => WINDOW_LABELS[w])).toEqual(['This session', 'Today', '7d', '30d', 'All'])
    expect(DEFAULT_WINDOW).toBe('7d')
  })
  test('This session: session C only (Tokens Saved 0, Bust events 0, Median baseline 60k)', () => {
    const lab = cacheLab(f5(), priceP, windowOf('session', NOW, ['C']))
    expect(lab.tokensSaved).toBe(0)
    expect(lab.bustEvents).toBe(0)
    expect(medianK(lab.medianBaseline)).toBe('60k')
  })
  test('7d 53,000 (+ E1); 30d 55,000 (+ G1); All 59,000 (+ H1)', () => {
    expect(tokens('7d')).toBe(53000)
    expect(tokens('30d')).toBe(55000)
    expect(tokens('all')).toBe(59000)
  })
  test('the bounds: 7d and 30d are N x 24 hours back from now, to infinity; All starts at 0', () => {
    expect(windowOf('7d', NOW, [])).toEqual({ from: NOW - 7 * 86_400_000, to: Infinity })
    expect(windowOf('30d', NOW, [])).toEqual({ from: NOW - 30 * 86_400_000, to: Infinity })
    expect(windowOf('all', NOW, [])).toEqual({ from: 0, to: Infinity })
    expect(windowOf('session', NOW, ['a', 'b'])).toEqual({ from: 0, to: Infinity, sessions: ['a', 'b'] })
  })
  test('Today starts at local midnight of now: a call just after it is in, one just before is out', () => {
    const now = new Date(2026, 9, 25, 12, 30).getTime()
    const mid = new Date(2026, 9, 25, 0, 0, 0, 0).getTime()
    expect(windowOf('today', now, [])).toEqual({ from: mid, to: Infinity })
    const calls = [call({ session: 'T1', ms: mid - 1, cr: 1000 }), call({ session: 'T2', ms: mid, cr: 2000 }), call({ session: 'T3', ms: now, cr: 4000 })]
    expect(cacheLab(calls, priceP, windowOf('today', now, [])).tokensSaved).toBe(6000)
  })
  test('the window argument of the pure seam filters the Median baseline too (E1, G1, H1 write nothing)', () => {
    expect(cacheLab(f5(), priceP, windowOf('all', NOW, [])).medianBaseline).toBe(20000)
  })
})

describe('[AC-22.8.1 to 22.8.3] an automatic handoff chain is one session', () => {
  test('[AC-22.8.1] F6: This session covers C and C2: Tokens Saved 3,000, Bust events 0, Median baseline 60k', () => {
    const lab = cacheLab(f6(), priceP, windowOf('session', F5_NOW, ['C2', 'C']))
    expect(lab.tokensSaved).toBe(3000)
    expect(lab.bustEvents).toBe(0)
    expect(medianK(lab.medianBaseline)).toBe('60k')
  })
  test('[AC-22.8.1] F6h: C2 started by hand covers C2 only: Tokens Saved 3,000, Median baseline "—"', () => {
    const lab = cacheLab(f6(), priceP, windowOf('session', F5_NOW, ['C2']))
    expect(lab.tokensSaved).toBe(3000)
    expect(medianK(lab.medianBaseline)).toBe('—')
  })
  test('the order of the chain\'s sessions changes no figure', () => {
    const a = cacheLab(f6(), priceP, windowOf('session', F5_NOW, ['C2', 'C']))
    const b = cacheLab(f6(), priceP, windowOf('session', F5_NOW, ['C', 'C2']))
    expect(a).toEqual(b)
  })
  test('[AC-22.8.2] F6, 30d: Tokens Saved 58,000; [AC-22.8.3] F6h, 7d: 56,000 (the window itself is not chain-bound)', () => {
    expect(cacheLab(f6(), priceP, windowOf('30d', F5_NOW, ['C2', 'C'])).tokensSaved).toBe(58000)
    expect(cacheLab(f6(), priceP, windowOf('7d', F5_NOW, ['C2'])).tokensSaved).toBe(56000)
  })
  test('[AC-22.8.3] with no published keep-alive value, C2 is its own chain (This session covers C2 only)', () => {
    const chain = chainNowOf(null, 'C2')
    expect(chain).toEqual({ id: 'C2', sessions: ['C2'] })
    expect(cacheLab(f6(), priceP, windowOf('session', F5_NOW, chain!.sessions)).tokensSaved).toBe(3000)
  })
})

describe('chainFrom and chainNowOf (LLD 7.2)', () => {
  test('a published chain: its id and its sessions', () => {
    expect(chainFrom({ chain: { id: 'C', sessions: ['C2', 'C'] } })).toEqual({ id: 'C', sessions: ['C2', 'C'] })
  })
  for (const [name, v] of [
    ['undefined', undefined],
    ['null', null],
    ['a string', 'x'],
    ['no chain', {}],
    ['a chain that is not an object', { chain: 3 }],
    ['an empty id', { chain: { id: '', sessions: ['a'] } }],
    ['a non-string id', { chain: { id: 7, sessions: ['a'] } }],
    ['sessions that are not a list', { chain: { id: 'a', sessions: 'a' } }],
  ] as [string, unknown][]) {
    test(`malformed (${name}) is null`, () => {
      expect(chainFrom(v)).toBeNull()
    })
  }
  test('non-string and empty session ids are dropped; none left means the chain of its id alone', () => {
    expect(chainFrom({ chain: { id: 'C', sessions: ['C2', 5, '', 'C'] } })).toEqual({ id: 'C', sessions: ['C2', 'C'] })
    expect(chainFrom({ chain: { id: 'C', sessions: [] } })).toEqual({ id: 'C', sessions: ['C'] })
  })
  test('the lab speaks for the published chain, else the transcript\'s session as a chain of one, else null', () => {
    const pub = { id: 'C', sessions: ['C2', 'C'] }
    expect(chainNowOf(pub, 'C2')).toBe(pub)
    expect(chainNowOf(null, 'C2')).toEqual({ id: 'C2', sessions: ['C2'] })
    expect(chainNowOf(null, null)).toBeNull()
  })
})

describe('the window store pairs (LLD 7.2, Q-CL19)', () => {
  test('isPreset: only the five', () => {
    for (const p of WINDOWS) expect(isPreset(p)).toBe(true)
    for (const v of ['1d', '', null, undefined, 7, '7D']) expect(isPreset(v)).toBe(false)
  })
  test('presetOf: the last pair for the chain id; absent, invalid or a bad store reads 7d', () => {
    expect(presetOf([['C', '30d']], 'C')).toBe('30d')
    expect(presetOf([['C', '30d'], ['C', 'all']], 'C')).toBe('all')
    expect(presetOf([['C', '30d']], 'C2')).toBe('7d') // a session started by hand
    expect(presetOf([['C', 'bogus']], 'C')).toBe('7d')
    expect(presetOf('nonsense', 'C')).toBe('7d')
    expect(presetOf(undefined, 'C')).toBe('7d')
    expect(presetOf([null, 'x', ['C']], 'C')).toBe('7d')
  })
  test('withPreset puts the pair last, replaces the chain\'s earlier pair, drops junk', () => {
    expect(withPreset([['A', '30d'], ['C', '7d']], 'C', 'all')).toEqual([['A', '30d'], ['C', 'all']])
    expect(withPreset(undefined, 'C', '30d')).toEqual([['C', '30d']])
    expect(withPreset([['A', 'bogus'], 5, ['B', 'today']], 'C', 'session')).toEqual([['B', 'today'], ['C', 'session']])
  })
  test('the list is bounded: the oldest are dropped first', () => {
    expect(WINDOW_SESSIONS_MAX).toBe(20)
    let pairs: unknown = []
    for (let i = 0; i < 25; i++) pairs = withPreset(pairs, `chain${i}`, '30d')
    const list = pairs as [string, string][]
    expect(list).toHaveLength(20)
    expect(list[0]![0]).toBe('chain5')
    expect(list.at(-1)![0]).toBe('chain24')
  })
})

describe('the string table (LLD 5.3)', () => {
  test('usd: two decimals, half away from zero, the minus before the $, no minus on $0.00', () => {
    expect(usd(0.1404)).toBe('$0.14')
    expect(usd(0.005)).toBe('$0.01')
    expect(usd(-0.005)).toBe('-$0.01')
    expect(usd(-0.053235)).toBe('-$0.05')
    expect(usd(-0.001)).toBe('$0.00')
    expect(usd(0)).toBe('$0.00')
    expect(usd(1234.5)).toBe('$1234.50')
  })
  test('count: a comma every thousand', () => {
    expect([count(0), count(999), count(1000), count(145800), count(1234567)]).toEqual(['0', '999', '1,000', '145,800', '1,234,567'])
  })
  test('pct: one decimal, "—" for none', () => {
    expect([pct(26.196), pct(0), pct(100), pct(null)]).toEqual(['26.2%', '0.0%', '100.0%', '—'])
  })
  test('medianK: thousands rounded to a whole number, then k; "—" for none', () => {
    expect([medianK(20000), medianK(12499), medianK(12500), medianK(0), medianK(null)]).toEqual(['20k', '12k', '13k', '0k', '—'])
  })
  test('attribution labels', () => {
    expect(ATTRIBUTION_LABELS).toEqual({ ttlLapse: 'TTL lapse', prefixChange: 'Prefix change', unknown: 'Unknown' })
  })
  test('hhmm: 24-hour HH:MM in the given zone', () => {
    expect(hhmm(Date.UTC(2026, 9, 25, 9, 5), 'UTC')).toBe('09:05')
    expect(hhmm(Date.UTC(2026, 9, 25, 23, 59), 'UTC')).toBe('23:59')
    expect(hhmm(Date.UTC(2026, 9, 25, 0, 0), 'UTC')).toBe('00:00')
    expect(hhmm(Date.UTC(2026, 9, 25, 10, 0), 'Asia/Dhaka')).toBe('16:00')
  })
})

describe('priceOfCosting: the lens model metadata file as a PriceOf', () => {
  const text = JSON.stringify({ models: [{ id: 'fixture-model-m', pricing: { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.3, cacheWrite5mPerMTok: 3.75, cacheWrite1hPerMTok: 6 } }] })
  test('a model in the file gets its five prices; a model not in it, null', () => {
    const p = priceOfCosting({ path: '.ai-dlc/model-metadata.json', text, error: '' })!
    expect(p(M)).toEqual({ input: 3, output: 15, cacheRead: 0.3, cacheWrite5m: 3.75, cacheWrite1h: 6 })
    expect(p('nobody')).toBeNull()
  })
  test('no file, or a file that is not JSON, gives no PriceOf at all', () => {
    expect(priceOfCosting({ path: 'p', text: '', error: 'ENOENT' })).toBeNull()
    expect(priceOfCosting({ path: 'p', text: '{ not json', error: '' })).toBeNull()
  })
  test('a price the file lacks reads null, and the figure that needs it is unpriced', () => {
    const lean = JSON.stringify({ models: [{ id: 'fixture-model-m', pricing: { inputPerMTok: 3, outputPerMTok: 15 } }] })
    const p = priceOfCosting({ path: 'p', text: lean, error: '' })!
    expect(p(M)).toMatchObject({ cacheRead: null, cacheWrite5m: null })
    const lab = labOf(classify(f1()), p, ALL)
    expect(lab.unpricedCalls).toBeGreaterThan(0)
  })
})
