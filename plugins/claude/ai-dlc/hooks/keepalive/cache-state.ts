import { creationSplit, k } from '../auto-handoff/config.ts'

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
/** `main` never holds 'unknown'. A main write without a split sets `pendingMain` (the time of the
 * response); the next Stop resolves it from the transcript (LLD 2.1 step 3, rev 5). */
export type Ledger = { main: Partial<Record<Ttl, LedgerEntry>>; agents: Map<string, AgentCaches>; pendingMain?: { at: number } }
export type Observation = { at: number; agentId?: string; usage: unknown }
/** Each TTL's cache lifetime in ms, from the settings (fiveMinute.ttl, oneHour.ttl). */
export type Lifetimes = Record<Ttl, number>

const TTLS: readonly Ttl[] = ['5m', '1h']

export const emptyLedger = (): Ledger => ({ main: {}, agents: new Map() })

/** `main` has an entry of some TTL: a response or the transcript seed already recorded the main loop's
 * cache, so the transcript need not be read (seedMain's first test, and the Stop's guard before it). */
export const hasMain = (l: Ledger): boolean => TTLS.some(t => l.main[t] !== undefined)

/** Rev 5. True when `main` has no entry, or a main write without a split is pending: the Stop reads
 * the transcript only then. */
export const needsMainSeed = (l: Ledger): boolean => !hasMain(l) || l.pendingMain !== undefined

/** Rev 5. The transcript had no split for the pending write: forget it (one read per pending write,
 * never retried). */
export function dropPending(l: Ledger): void {
  delete l.pendingMain
}

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
// lifetime. A write with no split (D2a): an agent's is an 'unknown' marker, never shown as a time; the
// main loop's records nothing and marks the ledger pending (the later time wins), for the next Stop to
// resolve from the transcript (rev 5).
function recordWrites(l: Ledger, caches: Partial<Record<EntryTtl, LedgerEntry>>, o: Observation, life: Lifetimes) {
  const split = creationSplit(o.usage)
  let wrote = false
  for (const t of TTLS) {
    if ((split?.[t] ?? 0) > 0) { caches[t] = { warmUntil: o.at + life[t] }; wrote = true }
  }
  if (wrote || numberOf(o.usage, 'cache_creation_input_tokens') <= 0) return
  if (o.agentId !== undefined) caches.unknown = { warmUntil: o.at }
  else l.pendingMain = { at: Math.max(l.pendingMain?.at ?? o.at, o.at) }
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
  recordWrites(l, caches, o, life)
}

/** D1, landed ping (spec rev 3). The response to a keep-alive ping that hit the cache, `ttl` being the
 * track pinged and `agentId` the source (main when absent). A landed 5m ping sets that source's 5m
 * entry to at + its lifetime whatever other entries exist, since a 5m hit refreshes the 5m TTL. A
 * landed 1h ping moves the 1h entry only when its usage carries a 1h write (the 1h refresh rule is
 * undocumented, OQ2). The ping's own writes are then recorded as in observe. */
export function observePing(l: Ledger, o: Observation & { ttl: Ttl }, life: Lifetimes): void {
  const caches = cachesOf(l, o.agentId)
  if (o.ttl === '5m') caches['5m'] = { warmUntil: o.at + life['5m'] }
  recordWrites(l, caches, o, life)
}

/** D1 seed, the transcript fallback at a Stop: gives `main` an entry per TTL with tokens > 0, warm
 * until writtenAt + its lifetime, only when `needsMainSeed(l)` and that time is after `now`. Rev 5: the
 * entry is merged, the later of the existing warm-until and writtenAt + lifetime, so a seed never lowers
 * a live entry; `pendingMain` is cleared on return. `writtenAt` is the time of the transcript row that
 * carried the write; the caller gives the pending write's time when the row has none, else `now`. */
export function seedMain(l: Ledger, split: Record<Ttl, number>, writtenAt: number, now: number, life: Lifetimes): void {
  if (!needsMainSeed(l)) return
  for (const t of TTLS) {
    const until = writtenAt + life[t]
    if (split[t] > 0 && until > now) l.main[t] = { warmUntil: Math.max(l.main[t]?.warmUntil ?? until, until) }
  }
  dropPending(l)
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

/** Agent liveness (034). Creates the agent when unknown; a finished agent keeps its entries. */
export function markAgent(l: Ledger, agentId: string, status: AgentCaches['status']): void {
  const a = l.agents.get(agentId) ?? { caches: {}, status }
  a.status = status
  l.agents.set(agentId, a)
}

/** True when the agent has no entry, or only its 'unknown' marker (D2a): the stop-time transcript may settle it. */
export function agentUnsettled(l: Ledger, agentId: string): boolean {
  const a = l.agents.get(agentId)
  return a === undefined || TTLS.every(t => a.caches[t] === undefined)
}

/** LLD 3.7 rev 12 (a): a stopped subagent's split from its transcript. Each TTL with tokens > 0 is warm
 * until at + its lifetime, kept only when that is after `now` (as seedMain); the 'unknown' marker is
 * deleted whether or not an entry survives, since the split is now known. */
export function settleAgent(l: Ledger, agentId: string, r: { split: Record<Ttl, number>; at?: number }, now: number, life: Lifetimes): void {
  const a = l.agents.get(agentId) ?? { caches: {}, status: 'finished' as const }
  const at = r.at ?? now
  for (const t of TTLS) {
    const until = at + life[t]
    if (r.split[t] > 0 && until > now) a.caches[t] = { warmUntil: Math.max(a.caches[t]?.warmUntil ?? until, until) }
  }
  delete a.caches.unknown
  l.agents.set(agentId, a)
}

// The latest warm entry of the TTL among the agents that are not finished, or undefined.
function agentsUntil(l: Ledger, ttl: Ttl, now: number): number | undefined {
  let latest: number | undefined
  for (const a of l.agents.values()) {
    const e = a.caches[ttl]
    if (a.status !== 'finished' && e && e.warmUntil > now && (latest === undefined || e.warmUntil > latest)) latest = e.warmUntil
  }
  return latest
}

/** D5 (spec rev 2): the time a track may arm from, `main`'s warm entry of the TTL; with `opts.agents`
 * (034.b built and `pingSubagents` on) the latest warm entry of an unfinished agent when `main` has
 * none. Undefined when none. */
export function armUntil(l: Ledger, ttl: Ttl, now: number, opts: { agents: boolean } = { agents: false }): number | undefined {
  const m = l.main[ttl]
  if (m && m.warmUntil > now) return m.warmUntil
  return opts.agents ? agentsUntil(l, ttl, now) : undefined
}

/** AC-17.3.8: no warm main entry of the TTL, and some unfinished agent has one. */
export const onlyAgentsWarm = (l: Ledger, ttl: Ttl, now: number): boolean => !(l.main[ttl] && l.main[ttl]!.warmUntil > now) && agentsUntil(l, ttl, now) !== undefined

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

// ---- ITEM-068 (LLD rev 7 to 11): the off-line suffix, the source note, the session switches, the
// band model and the status-line summary. Pure, like the ledger above.

/** True for a keep-alive part that says the track is off: every reasonText() result. Stopped texts
 * ('expired, stopped', 'missed, stopped', ...) are not off (LLD 11). */
export const isOffPart = (part: string): boolean => part === 'off' || part.startsWith('off ')

/** Where a keep-warm time came from, as the source note writes it (LLD 11.2). */
export type SourceLabel = 'session' | 'machine' | 'settings' | 'default'

/** The source note of a keep-warm time, from keepalive.ts's Keep: an override of this session or of
 * this machine, the default, or any settings level. */
export function sourceLabel(keep: { from: string; override?: boolean }): SourceLabel {
  if (keep.override && keep.from.startsWith('this session')) return 'session'
  if (keep.override && keep.from.startsWith('this machine')) return 'machine'
  return keep.from === 'default' ? 'default' : 'settings'
}

/** The off-line suffix's values: the ping limit, the keep-warm time (formatDuration) and its source
 * note, undefined when `sourceNote` is off. */
export type OffTail = { cap: number; keepWarm: string; source?: SourceLabel }
export const offTail = (t: OffTail): string => `, ping 0/${t.cap}, keep warm ${t.keepWarm}${t.source ? ` (${t.source})` : ''}`

/** A track's status line: `keepalive <ttl>: <cache part>; <keep-alive part>`, or the keep-alive part
 * alone. With `tail`, an off part also gets the off-line suffix (rev 7, E1' to E9). */
export const lineOf = (ttl: Ttl, cache: string | undefined, part: string, tail?: OffTail): string => {
  const p = tail && isOffPart(part) ? `${part}${offTail(tail)}` : part
  return `keepalive ${ttl}: ${cache ? `${cache}; ${p}` : p}`
}

export type Button = 'on' | 'off'
/** The session switches (D10, D11): the master (keep-alive as a whole) and one per track. Absent = unset. */
export type SessionSwitch = { master?: Button; '5m'?: Button; '1h'?: Button }
/** Effective master: the session master, else the settings' `enabled`. */
export const masterOn = (sw: SessionSwitch, settingEnabled: boolean): boolean => sw.master ? sw.master === 'on' : settingEnabled
/** Effective track: its switch (over the master and the settings), else the master AND the track's own setting. */
export const trackOn = (sw: SessionSwitch, n: Ttl, settingEnabled: boolean, trackSetting: boolean): boolean =>
  sw[n] ? sw[n] === 'on' : masterOn(sw, settingEnabled) && trackSetting
/** A track press (Q-SL8): `[off]` on an enabled track sets its switch off, `[on]` on a disabled one on.
 * The master and the other track are untouched. */
export const afterTrackPress = (sw: SessionSwitch, n: Ttl, enabled: boolean): SessionSwitch => ({ ...sw, [n]: enabled ? 'off' : 'on' })
/** A master press: `[off]` sets the master off and clears both track switches; `[on]` sets the master
 * and both track switches on (Q-SL7, force both tracks on). */
export const afterMasterPress = (sw: SessionSwitch, settingEnabled: boolean): SessionSwitch =>
  masterOn(sw, settingEnabled) ? { master: 'off' } : { master: 'on', '5m': 'on', '1h': 'on' }

/** The band and Pane title (rev 11, Q-SL2). */
export const BAND_TITLE = '⚠ ai-dlc cache-keepalive:'
export type TrackRow = { track: Ttl; line: string; button: Button }
/** `on` (live findings 3, point 4): whether keep-alive is on in force, any track enabled, for the minimised row's
 * status; absent, the status follows the master button. */
export type BandModel = { title: typeof BAND_TITLE; master: Button; rows: TrackRow[]; seed?: string; on?: boolean }
/** The band and Pane model: the master button (it names the press), the 5m row then the 1h row (Q-SL5),
 * each button `[off]` while the track is enabled, else `[on]` (Q-SL8), and the seed line while it shows. */
export const bandModel = (master: Button, lines: Record<Ttl, { line: string; enabled: boolean }>, seed?: string): BandModel => ({
  title: BAND_TITLE,
  master,
  rows: (['5m', '1h'] as const).map(track => ({ track, line: lines[track].line, button: lines[track].enabled ? 'off' : 'on' })),
  ...(seed !== undefined ? { seed } : {}),
})

// ---- D13 (rev 11): the status-line summary

export type StopKind = 'done' | 'ping limit' | 'spend limit' | 'missed' | 'error' | 'expired' | 'handoff' | 'overage'
export type CompactionPhase = 'compacting' | 'compacted' | 'skipped' | 'refused'
export type StatusMode = 'full' | 'summary'
/** What the summary needs from one track, from its state, never parsed from its line. */
export type TrackFacts =
  | { kind: 'running'; warmUntil: number; pings: number; cap: number; firstPingAt?: number }
  | { kind: 'stopped'; stop: StopKind; warmUntil?: number }
  | { kind: 'off'; reason: Reason }
  | { kind: 'compaction'; phase: CompactionPhase }
export type SeedFact = { hit: true; tokens: number } | { hit: false }
export const SUMMARY_MAX = 72

function reasonToken(r: Reason): string {
  if (typeof r === 'object') return 'idle (no write)'
  switch (r) {
    case 'noTasks': return 'idle (no tasks)'
    case 'noSplit': return 'idle (no write yet)'
    case 'turnRunning': return 'idle (turn)'
    case 'onlySubagents': return 'idle (subagents)'
    case 'sessionEnded': return 'idle (ended)'
    case 'disabled': return 'off'
    case 'expired': return 'expired'
    case 'overage': return 'off (overage)'
    default: { const never: never = r; return never }
  }
}

const COMPACTION: Record<CompactionPhase, string> = { compacting: 'compacting', compacted: 'compacted', skipped: 'compaction skipped', refused: 'compaction refused' }

// One track's token; `warm` false drops its `warm <H:MM>` clause (the length rule's second step).
function trackToken(ttl: Ttl, f: TrackFacts, warm: boolean): string {
  switch (f.kind) {
    case 'running': {
      const tail = f.pings === 0 && f.firstPingAt !== undefined ? `first ping ${hhmm(f.firstPingAt)}` : `ping ${f.pings}/${f.cap}`
      return warm ? `${ttl} warm ${hhmm(f.warmUntil)}, ${tail}` : `${ttl} ${tail}`
    }
    case 'stopped': return `${ttl} stopped: ${f.stop}${warm && f.warmUntil !== undefined ? `, warm ${hhmm(f.warmUntil)}` : ''}`
    case 'off': return `${ttl} ${reasonToken(f.reason)}`
    case 'compaction': return `${ttl} ${COMPACTION[f.phase]}`
  }
}

/** D13. `keepalive <1h token> | <5m token>[ | <seed token>]`; while longer than SUMMARY_MAX it drops the
 * seed token, then every `warm <H:MM>` clause. */
export function summaryOf(facts: Record<Ttl, TrackFacts>, seed: SeedFact | undefined): string {
  const build = (withSeed: boolean, warm: boolean) => {
    const parts = [trackToken('1h', facts['1h'], warm), trackToken('5m', facts['5m'], warm)]
    if (withSeed && seed) parts.push(seed.hit ? `seed hit ${k(seed.tokens)}` : 'seed miss')
    return `keepalive ${parts.join(' | ')}`
  }
  const whole = build(true, true)
  if (whole.length <= SUMMARY_MAX) return whole
  const noSeed = build(false, true)
  return noSeed.length <= SUMMARY_MAX ? noSeed : build(false, false)
}

/** D13 surface rule: 'full' when the roster is non-empty and every entry is 'vscode', else 'summary'. */
export const surfaceMode = (surfaces: readonly string[]): StatusMode => surfaces.length > 0 && surfaces.every(s => s === 'vscode') ? 'full' : 'summary'
export type StatusTextSetting = 'auto' | 'summary' | 'full'
/** The mode in force: `summary` and `full` override the surface rule; `auto` is surfaceMode(surfaces). */
export const statusModeOf = (setting: StatusTextSetting, surfaces: readonly string[]): StatusMode => setting === 'auto' ? surfaceMode(surfaces) : setting
/** The one chooser: 'full' is fullText unchanged, 'summary' is summaryOf(...). */
export const statusTextOf = (mode: StatusMode, fullText: string, facts: Record<Ttl, TrackFacts>, seed: SeedFact | undefined): string =>
  mode === 'full' ? fullText : summaryOf(facts, seed)
