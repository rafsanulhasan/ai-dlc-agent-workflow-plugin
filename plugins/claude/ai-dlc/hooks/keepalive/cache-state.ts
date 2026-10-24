import { creationSplit } from '../auto-handoff/config.ts'

// The cache ledger (spec keepalive-cache-status, D1 and D3; LLD section 2). Pure and engine-free:
// no clock, no I/O, so tests/cache-state.test.ts drives it on its own. keepalive.ts owns the timers,
// the arming and the I/O, and feeds this file every response it sees (noteUsage, the pings) and
// the transcript fallback at a Stop (seedMain).
//
// One entry per (source, TTL): a source is `main` or one subagent's id, and an entry says until when
// that cache is warm. It replaces the single split of the last cache write, which let a later 1h
// write hide an earlier 5m cache (AC-17.1.3, 17.3.4).

export type Ttl = '5m' | '1h'
/** 'unknown' only under D2a: an agent's write whose usage carries no 1h/5m split. */
export type EntryTtl = Ttl | 'unknown'
export type LedgerEntry = { warmUntil: number }
export type AgentCaches = { caches: Partial<Record<EntryTtl, LedgerEntry>>; status: 'running' | 'idle' | 'finished' }
/** `main` never holds 'unknown': a main write without a split is not recorded (the transcript seed covers it). */
export type Ledger = { main: Partial<Record<Ttl, LedgerEntry>>; agents: Map<string, AgentCaches> }
export type Observation = { at: number; agentId?: string; usage: unknown }
/** Each TTL's cache lifetime in ms, from the settings (fiveMinute.ttl, oneHour.ttl). */
export type Lifetimes = Record<Ttl, number>

const TTLS: readonly Ttl[] = ['5m', '1h']

export const emptyLedger = (): Ledger => ({ main: {}, agents: new Map() })

/** `main` has an entry of some TTL: a response or the transcript seed already recorded the main loop's
 * cache, so the transcript need not be read (seedMain's first test, and the Stop's guard before it). */
export const hasMain = (l: Ledger): boolean => TTLS.some(t => l.main[t] !== undefined)

/** No entry of that TTL (of either TTL when none is named) from any source. 'unknown' entries do not count. */
export function isEmpty(l: Ledger, ttl?: Ttl): boolean {
  const ttls = ttl ? [ttl] : TTLS
  if (ttls.some(t => l.main[t])) return false
  for (const a of l.agents.values()) if (ttls.some(t => a.caches[t])) return false
  return true
}

const numberOf = (usage: unknown, key: string): number => {
  const v = usage && typeof usage === 'object' ? (usage as Record<string, unknown>)[key] : undefined
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

// The entries of the source an observation comes from. An agent seen responding is running, unless
// it was finished and responds again: then it was resumed, so it is running too.
function cachesOf(l: Ledger, agentId: string | undefined): Partial<Record<EntryTtl, LedgerEntry>> {
  if (!agentId) return l.main
  const a = l.agents.get(agentId) ?? { caches: {}, status: 'running' as const }
  a.status = 'running'
  l.agents.set(agentId, a)
  return a.caches
}

// Is the usage worth recording at all: a write, or a read. Anything else changes nothing (observe is
// total), and an agent is not created for it.
const usable = (usage: unknown) => numberOf(usage, 'cache_read_input_tokens') > 0 || numberOf(usage, 'cache_creation_input_tokens') > 0

// The writes of one response (LLD 2.1, step 2): each TTL with tokens written is warm until at + its
// lifetime. D2a: an agent's write with no split is an 'unknown' marker, never shown as a time.
function recordWrites(caches: Partial<Record<EntryTtl, LedgerEntry>>, o: Observation, life: Lifetimes, isAgent: boolean) {
  const split = creationSplit(o.usage)
  let wrote = false
  for (const t of TTLS) {
    if ((split?.[t] ?? 0) > 0) { caches[t] = { warmUntil: o.at + life[t] }; wrote = true }
  }
  if (!wrote && isAgent && numberOf(o.usage, 'cache_creation_input_tokens') > 0) caches.unknown = { warmUntil: o.at }
}

/** D1. Records one response. Mutates `l`. Total: an unusable usage object changes nothing.
 * The read runs first, then the writes, so a response that reads and writes 5m ends at at + 5m.
 * A read moves the 5m entry only when it can only be a 5m read: the 5m entry is still warm, the
 * response wrote no 1h tokens, and the source has no warm 1h entry. It never moves a 1h entry. */
export function observe(l: Ledger, o: Observation, life: Lifetimes): void {
  if (!usable(o.usage)) return
  const caches = cachesOf(l, o.agentId)
  const split = creationSplit(o.usage)
  if (numberOf(o.usage, 'cache_read_input_tokens') > 0) {
    const m = caches['5m']
    const h = caches['1h']
    if (m && m.warmUntil > o.at && (split?.['1h'] ?? 0) === 0 && !(h && h.warmUntil > o.at)) m.warmUntil = o.at + life['5m']
  }
  recordWrites(caches, o, life, o.agentId !== undefined)
}

/** D1, landed ping (spec rev 3). The response to a keep-alive ping that hit the cache, `ttl` being the
 * track pinged and `agentId` the source (main when absent). A landed 5m ping sets that source's 5m
 * entry to at + its lifetime whatever other entries exist, since a 5m hit refreshes the 5m TTL. A
 * landed 1h ping moves the 1h entry only when its usage carries a 1h write (the 1h refresh rule is
 * undocumented, OQ2). The ping's own writes are then recorded as in observe. */
export function observePing(l: Ledger, o: Observation & { ttl: Ttl }, life: Lifetimes): void {
  const caches = cachesOf(l, o.agentId)
  if (o.ttl === '5m') caches['5m'] = { warmUntil: o.at + life['5m'] }
  recordWrites(caches, o, life, o.agentId !== undefined)
}

/** D1 seed, the transcript fallback at a Stop: gives `main` an entry per TTL with tokens > 0, warm
 * until writtenAt + its lifetime, only when `main` has no entry yet and that time is after `now`.
 * `writtenAt` is the time of the transcript row that carried the write (`now` when it has none). */
export function seedMain(l: Ledger, split: Record<Ttl, number>, writtenAt: number, now: number, life: Lifetimes): void {
  if (hasMain(l)) return
  for (const t of TTLS) {
    if (split[t] > 0 && writtenAt + life[t] > now) l.main[t] = { warmUntil: writtenAt + life[t] }
  }
}

export type SourceView = { warmUntil: number; expired: boolean }
export type CacheView = { main?: SourceView; subagents?: SourceView; subagentsUnknown?: boolean }

/** D3. Per-source view of one TTL. `subagents.warmUntil` is the latest over the agents' entries of
 * that TTL; `expired` = warmUntil <= now. `subagentsUnknown` is true when any agent has an 'unknown'
 * entry (D2a), the same on both TTLs. Finished agents are shown until their entries expire. */
export function cacheView(l: Ledger, ttl: Ttl, now: number): CacheView {
  const v: CacheView = {}
  const m = l.main[ttl]
  if (m) v.main = { warmUntil: m.warmUntil, expired: m.warmUntil <= now }
  let latest: number | undefined
  for (const a of l.agents.values()) {
    const e = a.caches[ttl]
    if (e && (latest === undefined || e.warmUntil > latest)) latest = e.warmUntil
    if (a.caches.unknown) v.subagentsUnknown = true
  }
  if (latest !== undefined) v.subagents = { warmUntil: latest, expired: latest <= now }
  return v
}

/** D5, main only (T17.1): the time a track may arm from, `main`'s warm entry of the TTL; undefined
 * when there is none. Arming from agents comes with ITEM-034. */
export function armUntil(l: Ledger, ttl: Ttl, now: number): number | undefined {
  const m = l.main[ttl]
  return m && m.warmUntil > now ? m.warmUntil : undefined
}

/** The names of the spec's Data shapes: why a track that is not armed is off. */
export type Reason = 'noTasks' | { noWrite: Ttl } | 'expired' | 'turnRunning' | 'sessionEnded' | 'onlySubagents' | 'disabled' | 'noSplit' | 'overage'

/** The keep-alive part of a track that is not armed (LLD 2.2). */
export function reasonText(r: Reason): string {
  if (typeof r === 'object') return `off (no ${r.noWrite} cache write seen)`
  switch (r) {
    case 'noTasks': return 'off (no background tasks)'
    case 'expired': return 'off (cache expired)'
    case 'turnRunning': return 'off (turn running)'
    case 'sessionEnded': return 'off (session ended)'
    case 'onlySubagents': return 'off (only subagent caches; subagent pings off)'
    case 'disabled': return 'off (disabled)'
    case 'noSplit': return 'off (no cache write seen yet, so the cache lifetime is unknown)'
    case 'overage': return 'off in overage'
  }
}

/** A clock time as the status line writes it: local time, H:MM. A line left on screen past it reads as stale. */
export function hhmm(ms: number): string {
  const d = new Date(ms)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** One source's element of the cache part: `main warm until 10:05`, `subagents expired 10:07`. */
const sourceText = (label: 'main' | 'subagents', s: SourceView) => `${label} ${s.expired ? 'expired' : 'warm until'} ${hhmm(s.warmUntil)}`

/** The cache part of a track line: `main …` first, then `subagents …`, then `subagents: split unknown`
 * (D2a); undefined when the view holds none of them. */
export function cachePart(v: CacheView): string | undefined {
  const parts = [
    ...(v.main ? [sourceText('main', v.main)] : []),
    ...(v.subagents ? [sourceText('subagents', v.subagents)] : []),
    ...(v.subagentsUnknown ? ['subagents: split unknown'] : []),
  ]
  return parts.length ? parts.join(', ') : undefined
}

/** A track's status line: `keepalive <ttl>: <cache part>; <keep-alive part>`, or the keep-alive part alone. */
export const lineOf = (ttl: Ttl, cache: string | undefined, part: string): string =>
  `keepalive ${ttl}: ${cache ? `${cache}; ${part}` : part}`
