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

export type Attribution = 'ttlLapse' | 'prefixChange' | 'unknown'
export type Classified = Call & { first: boolean; bust: boolean; base: 'first' | 'modelSwitch' | 'compaction' | 'unexplained'; attribution?: Attribution }

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

/** claude-lens's compaction rule: the cache read of the two calls before the one classified falls by more than half. */
export function isCompaction(bp: Call | undefined, prev: Call | undefined): boolean {
  return bp !== undefined && prev !== undefined && bp.cr > 0 && Math.max(0, (bp.cr - prev.cr) / bp.cr) > 0.5
}

/** Why a bust missed the cache (the stories' Terms, Miss attribution; LLD 5.1 rule order). */
export function attributionOf(cur: Call, prev: Call, base: Classified['base']): Attribution {
  if (base === 'modelSwitch') return 'unknown'
  const ttls: number[] = []
  if ((cur.cc5m ?? 0) > 0) ttls.push(TTL_MS['5m'])
  if ((cur.cc1h ?? 0) > 0) ttls.push(TTL_MS['1h'])
  if (ttls.length === 0) return 'unknown'
  const gap = cur.at - prev.at
  if (ttls.every(t => gap > t)) return 'ttlLapse'
  if (ttls.every(t => gap <= t)) return base === 'compaction' ? 'unknown' : 'prefixChange'
  return 'unknown'
}

/** First call, bust, base and miss attribution of every call, over the WHOLE stream (never the window: a window's first call is not its stream's first). */
export function classify(calls: readonly Call[]): Classified[] {
  const out: Classified[] = []
  for (const g of groups(calls))
    g.forEach((cur, i) => {
      const first = i === 0
      const prev = g[i - 1]
      const bust = !first && cur.cc > BUST_THRESHOLD
      const base: Classified['base'] = first || prev === undefined ? 'first' : cur.model !== prev.model ? 'modelSwitch' : isCompaction(g[i - 2], prev) ? 'compaction' : 'unexplained'
      const c: Classified = { ...cur, first, bust, base }
      if (bust && prev !== undefined) c.attribution = attributionOf(cur, prev, base)
      out.push(c)
    })
  return out
}

/** One bust of the Invalidation Gallery; `lossUsd` null when unpriced; `pid`/`turn` when the bust resolves to its prompt. */
export type GalleryRow = { at: number; model: string; session: string; stream: string; attribution: Attribution; cacheWrite: number; lossUsd: number | null; pid?: string; turn?: number }
/** The gallery shows at most this many busts, newest first. */
export const GALLERY_CAP = 50

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
  attribution: { ttlLapse: number; prefixChange: number; unknown: number }
  /** Cache writes by TTL: `unknown` is what no 5m/1h split covers; the parts sum to `total`. */
  ttlMix: { m5: number; h1: number; unknown: number; total: number }
  gallery: { rows: GalleryRow[]; total: number; truncated: boolean }
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
  const attribution = { ttlLapse: 0, prefixChange: 0, unknown: 0 }
  const ttlMix = { m5: 0, h1: 0, unknown: 0, total: 0 }
  const bustRows: GalleryRow[] = []
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
    if (c.bust) {
      busts += 1
      attribution[c.attribution ?? 'unknown'] += 1
      const row: GalleryRow = { at: c.at, model: c.model, session: c.session, stream: c.stream, attribution: c.attribution ?? 'unknown', cacheWrite: c.cc, lossUsd: l }
      if (c.pid !== undefined) row.pid = c.pid
      if (c.turn !== undefined) row.turn = c.turn
      bustRows.push(row)
    }
    const split = c.cc5m !== undefined || c.cc1h !== undefined
    ttlMix.m5 += c.cc5m ?? 0
    ttlMix.h1 += c.cc1h ?? 0
    ttlMix.unknown += split ? Math.max(0, c.cc - (c.cc5m ?? 0) - (c.cc1h ?? 0)) : c.cc
  }
  ttlMix.total = ttlMix.m5 + ttlMix.h1 + ttlMix.unknown
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
    attribution,
    ttlMix,
    gallery: { rows: bustRows.sort((a, b) => b.at - a.at).slice(0, GALLERY_CAP), total: bustRows.length, truncated: bustRows.length > GALLERY_CAP },
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

/** The chain ai-dlc's keep-alive publishes (`chain` of its state, ITEM-076; LLD 7.2), checked at run
 * time: its id and its sessions, newest first; null when absent or malformed. */
export function chainFrom(value: unknown): { id: string; sessions: string[] } | null {
  const c = value && typeof value === 'object' ? (value as { chain?: unknown }).chain : undefined
  if (!c || typeof c !== 'object') return null
  const { id, sessions } = c as { id?: unknown; sessions?: unknown }
  if (typeof id !== 'string' || !id || !Array.isArray(sessions)) return null
  const ids = sessions.filter((s): s is string => typeof s === 'string' && s !== '')
  return { id, sessions: ids.length ? ids : [id] }
}

/** The chain the lab speaks for (LLD 7.2, `chainNow`): the published chain, else the transcript's session as a chain of one, else null. */
export const chainNowOf = (published: { id: string; sessions: string[] } | null, transcriptSession: string | null): { id: string; sessions: string[] } | null =>
  published ?? (transcriptSession === null ? null : { id: transcriptSession, sessions: [transcriptSession] })

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
export const ATTRIBUTION_LABELS: Record<Attribution, string> = { ttlLapse: 'TTL lapse', prefixChange: 'Prefix change', unknown: 'Unknown' }
/** A part of a total as a percent, one decimal; none when the total is 0. */
export const share = (part: number, total: number): string => (total === 0 ? '' : ` (${((part / total) * 100).toFixed(1)}%)`)
/** `3 busts`, or `50 of 51 busts` when truncated. */
export const galleryHeader = (g: CacheLab['gallery']): string => (g.truncated ? `${g.rows.length} of ${g.total} busts` : `${g.total} bust${g.total === 1 ? '' : 's'}`)
/** A gallery row: `HH:MM · model · session · stream? · attribution · 12,000 · $0.07` (a main stream names none). */
export function galleryLine(r: GalleryRow, priced: boolean, tz?: string): string {
  const money = !priced || r.lossUsd === null ? 'no price' : usd(r.lossUsd)
  return [hhmm(r.at, tz), r.model, r.session.slice(0, 8), ...(r.stream === 'main' ? [] : [r.stream]), ATTRIBUTION_LABELS[r.attribution], count(r.cacheWrite), money].join(' · ')
}
/** `prompt <first 8 of the id> · turn <n>`, or `No turn attribution`. */
export const turnLine = (r: GalleryRow): string => (r.pid === undefined || r.turn === undefined ? 'No turn attribution' : `prompt ${r.pid.slice(0, 8)} · turn ${r.turn}`)
export const noPriceNote = (n: number): string => `${n} call${n === 1 ? '' : 's'} with no price`

/** `HH:MM` in the time zone (default: the machine's). */
export function hhmm(ms: number, tz?: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(new Date(ms))
}

// ---- step 42: keep-alive's on/off buttons in Cache Lab ----

/** What Cache Lab's keep-alive buttons switch: the master, or one track. */
export type KeepaliveTarget = 'master' | '1h' | '5m'
/** The buttons in the human's order: Master, 1h, 5m. */
export const KEEPALIVE_TARGETS: readonly KeepaliveTarget[] = ['master', '1h', '5m']
export const KEEPALIVE_TARGET_LABELS: Record<KeepaliveTarget, string> = { master: 'Master', '1h': '1h', '5m': '5m' }

/**
 * Whether the master and each track are on, from the state ai-dlc's keep-alive publishes; null when there is
 * no usable value (ai-dlc absent or not published yet), and then Cache Lab draws no button. A track's
 * `enabled` is its state in force; a value from before it was published falls back to the track's session
 * switch, else on.
 */
export function keepaliveSwitches(value: unknown): Record<KeepaliveTarget, boolean> | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as { enabled?: unknown; tracks?: unknown }
  if (typeof v.enabled !== 'boolean' || !Array.isArray(v.tracks)) return null
  const on = (name: '1h' | '5m'): boolean | null => {
    const t = (v.tracks as unknown[]).find(x => typeof x === 'object' && x !== null && (x as { name?: unknown }).name === name) as { enabled?: unknown; sessionSwitch?: unknown } | undefined
    if (t === undefined) return null
    return typeof t.enabled === 'boolean' ? t.enabled : t.sessionSwitch !== 'off'
  }
  const h1 = on('1h')
  const m5 = on('5m')
  return h1 === null || m5 === null ? null : { master: v.enabled, '1h': h1, '5m': m5 }
}

/** The `/ai-dlc:cache-keepalive` arguments a press runs: this session only (`--session`), as the band's buttons do. */
export const switchArgs = (target: KeepaliveTarget, on: boolean): string => `${on ? 'on' : 'off'}${target === 'master' ? '' : ` --track ${target}`} --session`
