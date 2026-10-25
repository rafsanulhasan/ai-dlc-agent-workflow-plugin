// Cache Lab, the pure core (cache-lab LLD section 5). No `$`: `register.tsx` reads the transcripts and the
// price file and hands this module the calls and a `PriceOf`.
//
// Saved by cache, Lost to busts, NET, the miss attribution and the TTL mix reuse the formulas of claude-lens
// (MIT, (c) 2026 Foyzul Karim, https://github.com/foyzulkarim/claude-lens); see NOTICE.md and ATTRIBUTION.md.

import { lookupModel, parseCosting } from './lens'
import type { Costing, Prices } from './lens'
import type { Call } from './transcripts'

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

/** Inclusive; `sessions` keeps only the calls of those session ids ("This session": every session of the chain). */
export type Window = { from: number; to: number; sessions?: readonly string[] }

/** A call writing more than this many cache tokens after the first call of its stream is a bust (strict; cache-reader.mjs keeps the same value). */
export const BUST_THRESHOLD = 10_000
export const TTL_MS = { '5m': 300_000, '1h': 3_600_000 } as const

export type Classified = Call & { first: boolean; bust: boolean }

const byTime = (a: Call, b: Call) => a.at - b.at || a.order - b.order

/** The calls grouped by session and stream, each group in time order. */
function groups(calls: readonly Call[]): Call[][] {
  const m = new Map<string, Call[]>()
  for (const c of calls) {
    const k = `${c.session}|${c.stream}`
    const g = m.get(k)
    if (g === undefined) m.set(k, [c])
    else g.push(c)
  }
  return [...m.values()].map(g => [...g].sort(byTime))
}

/** First call and bust of every call, over the WHOLE stream (never the window: a window's first call is not its stream's first). */
export function classify(calls: readonly Call[]): Classified[] {
  const out: Classified[] = []
  for (const g of groups(calls))
    g.forEach((cur, i) => {
      const first = i === 0
      out.push({ ...cur, first, bust: !first && cur.cc > BUST_THRESHOLD })
    })
  return out
}

export type CacheLab = {
  savedUsd: number
  lostUsd: number
  netUsd: number
  /** Calls of the window that count in neither dollar figure because a price (or the model) is missing. */
  unpricedCalls: number
  hitPct: number | null
  tokensSaved: number
  bustEvents: number
  medianBaseline: number | null
  /** False when there is no price file, or no model of the window is in it. */
  priced: boolean
}

const inWindow = (c: Call, w: Window) => c.at >= w.from && c.at <= w.to && (w.sessions === undefined || w.sessions.includes(c.session))

/** Saved by cache of one call, or null when a price it needs is missing (claude-lens: uncached cost minus actual). */
function savedOf(c: Call, p: Prices | null): number | null {
  if (c.cr <= 0) return 0
  if (p === null || p.input === null || p.cacheRead === null) return null
  return (c.cr * (p.input - p.cacheRead)) / 1e6
}

/** Lost to one bust, each cache write at its TTL's write rate (an unknown TTL at the 5m rate), or null when unpriced. */
export function lostOf(c: Call, p: Prices | null): number | null {
  if (p === null || p.cacheRead === null) return null
  const split = c.cc5m !== undefined || c.cc1h !== undefined
  const m5 = c.cc5m ?? 0
  const h1 = c.cc1h ?? 0
  const rest = split ? Math.max(0, c.cc - m5 - h1) : c.cc
  if ((m5 > 0 || rest > 0) && p.cacheWrite5m === null) return null
  if (h1 > 0 && p.cacheWrite1h === null) return null
  const over = (rate: number | null) => Math.max((rate ?? 0) - p.cacheRead!, 0)
  return (m5 * over(p.cacheWrite5m) + h1 * over(p.cacheWrite1h) + rest * over(p.cacheWrite5m)) / 1e6
}

/** The true median (even count: the mean of the two middle values), or null. */
export function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const h = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[h]! : (s[h - 1]! + s[h]!) / 2
}

/** Every Cache Lab figure of the window. `priceOf` null: there is no price file. */
export function labOf(all: readonly Classified[], priceOf: PriceOf | null, w: Window): CacheLab {
  const W = all.filter(c => inWindow(c, w))
  const price = (m: string) => (priceOf === null ? null : priceOf(m))
  let saved = 0
  let lost = 0
  let unpriced = 0
  let anyPrice = false
  let cr = 0
  let cc = 0
  let inp = 0
  let busts = 0
  for (const c of W) {
    const p = price(c.model)
    if (p !== null) anyPrice = true
    const s = savedOf(c, p)
    const l = c.bust ? lostOf(c, p) : 0
    if (s !== null) saved += s
    if (l !== null) lost += l
    if (p === null || s === null || l === null) unpriced += 1
    cr += c.cr
    cc += c.cc
    inp += c.in
    if (c.bust) busts += 1
  }
  // Median baseline: per session, the first call of its main stream that wrote the cache, when that call is in the window.
  const base = new Map<string, Classified>()
  for (const c of [...all].sort(byTime)) if (c.stream === 'main' && c.cc > 0 && !base.has(c.session)) base.set(c.session, c)
  const baselines = [...base.values()].filter(c => inWindow(c, w)).map(c => c.cc)
  const den = cr + cc + inp
  return {
    savedUsd: saved,
    lostUsd: lost,
    netUsd: saved - lost,
    unpricedCalls: unpriced,
    hitPct: den === 0 ? null : (cr / den) * 100,
    tokensSaved: cr,
    bustEvents: busts,
    medianBaseline: median(baselines),
    priced: priceOf !== null && (W.length === 0 || anyPrice),
  }
}

export const cacheLab = (calls: readonly Call[], priceOf: PriceOf | null, w: Window): CacheLab => labOf(classify(calls), priceOf, w)

// ---- the window presets (LLD 7.2) ----

export const WINDOWS = ['session', 'today', '7d', '30d', 'all'] as const
export type WindowPreset = (typeof WINDOWS)[number]
export const DEFAULT_WINDOW: WindowPreset = '7d'
export const WINDOW_LABELS: Record<WindowPreset, string> = { session: 'This session', today: 'Today', '7d': '7d', '30d': '30d', all: 'All' }
/** Chains whose window choice the store keeps (oldest dropped first). */
export const WINDOW_SESSIONS_MAX = 20

const DAY_MS = 86_400_000

/** A preset as a window at `now`; `session` keeps only the given session ids (the chain's). */
export function windowOf(preset: WindowPreset, now: number, sessions: readonly string[]): Window {
  if (preset === 'session') return { from: 0, to: Infinity, sessions }
  if (preset === 'today') {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    return { from: d.getTime(), to: Infinity }
  }
  if (preset === '7d') return { from: now - 7 * DAY_MS, to: Infinity }
  if (preset === '30d') return { from: now - 30 * DAY_MS, to: Infinity }
  return { from: 0, to: Infinity }
}

export const isPreset = (v: unknown): v is WindowPreset => typeof v === 'string' && (WINDOWS as readonly string[]).includes(v)

/** The stored `[chainId, preset]` pairs' preset for `id`, else the default (an absent or invalid value reads `7d`). */
export function presetOf(pairs: unknown, id: string): WindowPreset {
  if (!Array.isArray(pairs)) return DEFAULT_WINDOW
  for (let i = pairs.length - 1; i >= 0; i--) {
    const p = pairs[i]
    if (Array.isArray(p) && p[0] === id) return isPreset(p[1]) ? p[1] : DEFAULT_WINDOW
  }
  return DEFAULT_WINDOW
}

/** The pairs with `[id, preset]` last, bounded by WINDOW_SESSIONS_MAX. */
export function withPreset(pairs: unknown, id: string, preset: WindowPreset): [string, WindowPreset][] {
  const kept = (Array.isArray(pairs) ? pairs : []).filter((p): p is [string, WindowPreset] => Array.isArray(p) && typeof p[0] === 'string' && p[0] !== id && isPreset(p[1]))
  return [...kept, [id, preset] as [string, WindowPreset]].slice(-WINDOW_SESSIONS_MAX)
}

// ---- the string table (LLD 5.3) ----

/** Dollars: sign, `$`, rounded half away from zero to 2 decimals; no minus on `$0.00`. */
export function usd(n: number): string {
  const r = Math.round(Math.abs(n) * 100 + 1e-9) / 100
  return `${n < 0 && r > 0 ? '-' : ''}$${r.toFixed(2)}`
}
export const count = (n: number): string => n.toLocaleString('en-US')
export const pct = (x: number | null): string => (x === null ? '—' : `${x.toFixed(1)}%`)
export const medianK = (n: number | null): string => (n === null ? '—' : `${Math.round(n / 1000)}k`)
export const noPriceNote = (n: number): string => `${n} call${n === 1 ? '' : 's'} with no price`

/** `HH:MM` in the time zone (default: the machine's). */
export function hhmm(ms: number, tz?: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(new Date(ms))
}
