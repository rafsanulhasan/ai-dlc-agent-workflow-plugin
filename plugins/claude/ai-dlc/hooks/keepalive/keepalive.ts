import type { EngineInterface, Register, Timer } from 'claude-code'
import { TRACK_NAMES, formatDuration, parseCommandArgs } from './duration.ts'
import type { CommandArgs } from './duration.ts'
import type { Scope, TrackName } from './duration.ts'
import { SETTINGS, defaults, gatedDiffering, readMult, resolveSettings } from './settings.ts'
import type { Level, Settings, TrackKey, TrackSettings } from './settings.ts'
import { creationSplit, k, repoConfig, settingsEnv, trustOf } from '../auto-handoff/config.ts'
import { chainIdOf, chainSessions } from '../auto-handoff/chain.ts'
import type { TrustTarget } from '../auto-handoff/config.ts'
import { homeDir, log, readRaw, repoRoot, trustGate, trustTarget } from '../auto-handoff/io.ts'
import type { TrustCache } from '../auto-handoff/io.ts'
import type { KeepaliveState, KeepaliveTrackState } from '../../types/index.d.ts'
import { afterMasterPress, afterTrackPress, agentUnsettled, armUntil, bandModel, cachePart, cacheView, dropPending, emptyLedger, hhmm, isEmpty, lineOf, markAgent, masterOn, needsMainSeed, observe, observePing, onlyAgentsWarm, reasonText, seedMain, settleAgent, sourceLabel, statusModeOf, statusTextOf, trackOn } from './cache-state.ts'
import type { BandModel, CompactionPhase, Ledger, Lifetimes, OffTail, Reason, SeedFact, SessionSwitch, StopKind, TrackFacts } from './cache-state.ts'
import { keepaliveTree } from './panel.tsx'

// Keep-alive, folded into the ai-dlc hooks module from the vendored cache-keepalive mod (see
// ../ATTRIBUTION.md, "cache-keepalive"). When Claude ends a turn while background tasks still run, it
// pings the prompt cache so the cache is still warm when the task's notification wakes the session.
// Two tracks, one per cache lifetime: the 1-hour track and the 5-minute track. Which ones run comes
// from the cache ledger (./cache-state.ts): per source and lifetime, until when each cache is warm, as
// the session's responses and pings show it, never from an assumption.
// ../auto-handoff/register.tsx calls registerKeepalive; the files, git, trust and the log come from
// ../auto-handoff/io.ts. This file reads no environment variable: its settings come from settings
// files, never the process environment.

// The command. A hooks module can only register a bare name (letters, digits, _ and -), so the name
// comes from the plugin skill skills/cache-keepalive, which Claude Code lists as /ai-dlc:cache-keepalive,
// and the command.run hook below answers its runs in the skill's place.
export const COMMAND = 'ai-dlc:cache-keepalive'
export const REPO_FILE = '.ai-dlc/cache-keepalive.json'
// The /ai-dlc:cache-keepalive overrides, one pair of store keys per track: this session's (a list of
// [session id, ms]) and the machine's (ms).
const sessionKey = (n: TrackName) => `keepalive:keepWarmFor:sessions:${n}`
const machineKey = (n: TrackName) => `keepalive:keepWarmFor:machine:${n}`
const COST_KEY = 'keepalive:compactCost'
const RATIO_KEY = 'keepalive:summaryRatio'
// How much of a transcript's end is read for the cache split when the file is too big to read whole.
const TAIL_BYTES = 2_000_000

export type { TrackName }
const TRACKS: readonly (readonly [TrackName, TrackKey])[] = [['1h', 'oneHour'], ['5m', 'fiveMinute']]

/** What register.tsx tells keep-alive: whether an automatic handoff is under way, when no pings are armed. */
export type KeepaliveDeps = { handingOff: () => boolean }

/** Tokens written to the cache for the 1-hour and the 5-minute lifetime. */
export type Split = Record<TrackName, number>

// nextPingAt: when the armed timer fires (null when none is armed); keep: the keep-warm time in force
// for the track, worked out at arming and at each ping, and re-read while the track is not running
// (refreshKeep); undefined means the track's setting. Both are published in the track's state
// (publish), not used to decide. cfg: the track's settings as the armed timer took them (arm), the
// one source of a running track's published pingEvery and ping limit, so they match what its tick
// uses even when a full read changes the settings meanwhile; a track not running publishes the
// settings now read, the ones its next arming takes. part: the keep-alive part of the track's line,
// the text after the cache part (or after `keepalive <track>: ` when there is none); the line itself
// is built when it is shown or published (lineFor), with that moment's cache part. A track that is not
// armed always says why (reasonText), never a bare `off`.
// pingWarmUntil (0 = none): the last landed ping's time plus the track's ttl. Read only when a Stop
// arms the track (LLD 3.4), never by the cache part, which stays the ledger's: a landed 1h ping that
// wrote no 1h tokens leaves the ledger's 1h entry, yet proves the cache warm. Cleared when the cache
// is gone or unknown (expired, missed, an error), at session.end and before a handoff.
// status (LLD rev 11, 20.3): what the summary reads of a track that is not running, written only by
// setPart beside its part, so the two cannot disagree: why it is off, how it stopped (with the
// warm-until its full line shows, for done, ping limit and spend limit) or the compaction's phase.
type TrackStatus = { off: Reason } | { stop: StopKind; warm?: number } | { compaction: CompactionPhase }
type Track = { name: TrackName; key: TrackKey; timer?: Timer; generation: number; armedTime: number; warmUntil: number; pingWarmUntil: number; pings: number; part: string; status?: TrackStatus; nextPingAt: number | null; keep?: Keep; cfg?: TrackSettings }
const newTrack = (name: TrackName, key: TrackKey): Track => ({ name, key, generation: 0, armedTime: 0, warmUntil: 0, pingWarmUntil: 0, pings: 0, part: reasonText({ noWrite: name }), status: { off: { noWrite: name } }, nextPingAt: null })

// The one writer of a track's part and status (LLD 20.3): a running part passes no status.
function setPart(t: Track, part: string, status?: TrackStatus) {
  t.part = part
  t.status = status
}
// A track off for a reason: its part is the reason's text.
const setOff = (t: Track, r: Reason) => setPart(t, reasonText(r), { off: r })
// A track stopped: the stop's text and kind, with the warm-until for the three kinds whose line says it.
const setStopped = (t: Track, text: string, stop: StopKind) =>
  setPart(t, text, { stop, ...(stop === 'done' || stop === 'ping limit' || stop === 'spend limit') && text.includes('warm until') ? { warm: t.warmUntil } : {} })

// Module variables survive /clear, which is why every timer is stopped before one (stopForHandoff)
// and at session.end.
let settings: Settings = defaults()
let sources: Record<string, string> = {}
const warned = new Set<string>()
const tracks: Record<TrackName, Track> = { '1h': newTrack('1h', 'oneHour'), '5m': newTrack('5m', 'fiveMinute') }
let compacting = false
let spent = 0
let budget = 0
let context = 0
// Until when each cache of this session is warm, per source and lifetime (./cache-state.ts), from the
// responses' usage, the pings and, when no usage was seen, the transcript. Cleared at session.end and
// before a handoff; a new turn keeps it.
let ledger: Ledger = emptyLedger()
const life = (): Lifetimes => ({ '5m': settings.fiveMinute.ttl, '1h': settings.oneHour.ttl })
// After an automatic handoff, what the seeded session's first request read from the cache, shown
// under the track lines until the next turn starts (showSeedCache).
let seedLine: string | undefined
let seedFact: SeedFact | undefined
// The surfaces the session draws on (LLD 20.4), read by refreshSurfaces; [] means the summary.
let surfaces: readonly string[] = []

/** The 1h/5m split of a usage object, when it carries one with a write: `cache_creation`'s
 * `ephemeral_1h_input_tokens` and `ephemeral_5m_input_tokens`. Undefined otherwise. */
export function splitOf(usage: unknown): Split | undefined {
  const split = creationSplit(usage)
  return split && split['1h'] + split['5m'] > 0 ? split : undefined
}

/** A transcript's last cache write: its split and, when the row has a timestamp, when it was written. */
export type TranscriptSplit = { split: Split; at?: number }

// The last row of a transcript (JSON lines) that wrote to the cache with a split, with the time of
// that row (`at`, from its `timestamp`) when it has one. `sidechain`: whether subagent rows count.
function lastSplit(jsonl: string, sidechain: boolean): TranscriptSplit | undefined {
  const lines = jsonl.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!
    if (!line.includes('"cache_creation"')) continue
    try {
      const o = JSON.parse(line) as { isSidechain?: boolean; timestamp?: unknown; message?: { usage?: unknown } }
      if (!sidechain && o.isSidechain === true) continue
      const split = splitOf(o.message?.usage)
      if (!split) continue
      const at = typeof o.timestamp === 'string' ? Date.parse(o.timestamp) : NaN
      return Number.isFinite(at) ? { split, at } : { split }
    } catch {}
  }
  return undefined
}

/** The split of the last main-conversation response in a transcript (JSON lines) that wrote to the
 * cache, with the time of that row (`at`, from its `timestamp`) when it has one. */
export const splitFromTranscript = (jsonl: string): TranscriptSplit | undefined => lastSplit(jsonl, false)

/** splitFromTranscript for a subagent's own transcript, whose rows are all sidechain rows: they count
 * (LLD 3.7, Fallback and 034.c). */
export const splitFromAgentTranscript = (jsonl: string): TranscriptSplit | undefined => lastSplit(jsonl, true)

/** Records one response in the cache ledger (./cache-state.ts, observe): the main conversation's, or,
 * with `agentId`, a subagent's or teammate's (whose usage also goes to the debug log, 034.c). */
export async function noteUsage($: EngineInterface, usage: unknown, agentId?: string): Promise<void> {
  if (agentId) logAgentUsage($, usage, agentId)
  observe(ledger, agentId ? { at: await $.clock.now(), agentId, usage } : { at: await $.clock.now(), usage }, life())
}

// ITEM-034.c, the observation check (LLD 3.7, rev 6): two debug lines that show whether a subagent's
// usage and its transcript carry the 1h/5m split. Log only: they never touch the ledger and never throw.

/** Logs one subagent response's usage to the debug log: `keepalive: agent usage agent=<id>
 * split=present|absent writes=<n>`, `writes` being its cache_creation_input_tokens and `split`
 * whether its cache_creation carries the 1h/5m fields. noteUsage calls it for each response that
 * has an agent id. */
export function logAgentUsage($: EngineInterface, usage: unknown, agentId: string): void {
  try {
    const raw = usage && typeof usage === 'object' ? (usage as Record<string, unknown>).cache_creation_input_tokens : undefined
    const writes = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
    $.ui.log(`keepalive: agent usage agent=${agentId} split=${creationSplit(usage) ? 'present' : 'absent'} writes=${writes}`, { to: 'debug' })
  } catch {}
}

/** Logs a finished subagent's transcript to the debug log: `keepalive: subagent transcript
 * agent=<id> rows=<n> split=present|absent`, `rows` being its non-empty lines and `split` whether a
 * row wrote to the cache with the 1h/5m split (splitFromAgentTranscript). A missing path or a read
 * that fails logs `rows=0 split=absent`. Never throws. Returns the text read, for the stop-time fallback. */
export async function logSubagentTranscript($: EngineInterface, e: { agent_id?: string; agent_transcript_path?: string }): Promise<string | undefined> {
  let text: string | undefined
  try {
    text = e.agent_transcript_path ? await readTranscript($, e.agent_transcript_path) : undefined
    const rows = text === undefined ? 0 : text.split('\n').filter(l => l.trim() !== '').length
    const split = text !== undefined && splitFromAgentTranscript(text) !== undefined
    $.ui.log(`keepalive: subagent transcript agent=${e.agent_id ?? '?'} rows=${rows} split=${split ? 'present' : 'absent'}`, { to: 'debug' })
  } catch {}
  return text
}

// LLD 3.7 rev 12 (b): the last `n` bytes of a file, through `node` (no `tail` on Windows; no shell).
const TAIL_SCRIPT = [
  "const fs = require('fs'); const [p, n] = process.argv.slice(1)",
  'const fd = fs.openSync(p, "r"); const size = fs.fstatSync(fd).size; const len = Math.min(size, Number(n))',
  'const buf = Buffer.alloc(len); fs.readSync(fd, buf, 0, len, size - len); fs.closeSync(fd)',
  "process.stdout.write(buf.toString('utf8'))",
].join('\n')
// The tail failure is logged once per session (a module flag, reset at session.end).
let tailLogged = false

// A transcript file: read whole; a missing file reads nothing and starts no process; else (a file over
// the 4 MiB read limit) its last TAIL_BYTES through `node`; undefined when none of that works.
async function readTranscript($: EngineInterface, path: string): Promise<string | undefined> {
  const whole = await readRaw($, path)
  if (whole !== undefined) return whole
  try {
    if (!(await $.fs.exists(path))) return undefined
  } catch {
    return undefined
  }
  let why = ''
  try {
    const { exitCode, stdout } = await $.process.run(['node', '-e', TAIL_SCRIPT, path, String(TAIL_BYTES)])
    if (exitCode === 0) return stdout
    why = `exit ${exitCode}`
  } catch (err) {
    why = String(err)
  }
  if (!tailLogged) {
    tailLogged = true
    try {
      $.ui.log(`keepalive: transcript tail unavailable (${why})`, { to: 'debug' })
    } catch {}
  }
  return undefined
}

/** The split from the transcript file: read whole, else its last TAIL_BYTES through `node`. */
export async function transcriptSplit($: EngineInterface, path: string | undefined): Promise<TranscriptSplit | undefined> {
  if (!path) return undefined
  const text = await readTranscript($, path)
  return text === undefined ? undefined : splitFromTranscript(text)
}

// No main usage seen yet, or a main write with no split is pending (LLD 3.4, rev 5): the transcript's
// last write seeds main, from the time of its row, else the pending write's time, else now (seedMain,
// which never lowers a live entry). The guard skips the read otherwise, so the transcript is read once
// per Stop with a pending write and never per response: a response's own row may not be written yet
// when its usage arrives, while at the Stop it is. A transcript with no split forgets the pending
// write, so the next Stop does not read again.
async function seedFromTranscript($: EngineInterface, path: string | undefined, now: number) {
  if (!needsMainSeed(ledger)) return
  const r = await transcriptSplit($, path)
  if (r) return seedMain(ledger, r.split, r.at ?? ledger.pendingMain?.at ?? now, now, life())
  if (ledger.pendingMain) $.ui.log('keepalive: main write without split, transcript has none', { to: 'debug' })
  dropPending(ledger)
}

const anyRunning = () => TRACKS.some(([n]) => tracks[n].timer !== undefined)

// The settings a track's state and status line speak for (see Track, cfg).
const cfgOf = (t: Track): TrackSettings => (t.timer !== undefined && t.cfg) || settings[t.key]

function stopTrack(t: Track) {
  // Bumping the generation also stops a ping already in flight from rearming
  t.generation++
  t.timer?.cancel()
  t.timer = undefined
  t.nextPingAt = null
}

function stopAll(line?: string, stop?: StopKind) {
  for (const [n] of TRACKS) {
    const t = tracks[n]
    const was = t.timer !== undefined
    stopTrack(t)
    if (line && stop && was) setStopped(t, line, stop)
  }
}

// The state other plugins read (ai-dlc-lens, read-only): $.state { plugin: 'ai-dlc', key: 'keepalive' },
// its contract in ../../types/index.d.ts (plugin.json `types`). Written each time the status lines
// change, whether or not the status line is shown, so a reader sees what the lines say.
const STATE = { plugin: 'ai-dlc', key: 'keepalive' } as const
// Writes go out one after another, in the order the snapshots were taken.
let publishing: Promise<unknown> = Promise.resolve()

// The line a track shows at `now`: the ledger's cache part of the track's lifetime (main, then
// subagents), then the keep-alive part (LLD 2.2). Built at each render and publish, never stored, so
// it never carries a cache part older than the event that shows it.
const lineFor = (t: Track, now: number) => lineOf(t.name, cachePart(cacheView(ledger, t.name, now)), t.part, tailOf(t))

// The keep-warm time a track speaks for (its last read, else its setting) and its ping limit: one
// source for the off-line suffix and the published keepWarmMs and cap (LLD 11.2).
const keepOf = (t: Track): Keep => t.keep ?? { ms: cfgOf(t).keepWarmFor, from: sources[`${t.key}.keepWarmFor`] ?? 'default' }
const capOf = (t: Track) => { const cfg = cfgOf(t); return pingCap(cfg.maxPings, cfg.pingEvery, keepOf(t)) }
// The source note of a keep-warm clause, none when `sourceNote` is off (LLD 11.2).
const noteOf = (keep: Keep) => settings.sourceNote ? ` (${sourceLabel(keep)})` : ''
const tailOf = (t: Track): OffTail => ({ cap: capOf(t), keepWarm: formatDuration(keepOf(t).ms), ...(settings.sourceNote ? { source: sourceLabel(keepOf(t)) } : {}) })

// What the summary reads of a track (LLD 20.3): running from its timer, else its status.
function factsOf(t: Track): TrackFacts {
  if (t.timer !== undefined) return { kind: 'running', warmUntil: t.warmUntil, pings: t.pings, cap: capOf(t), ...(t.pings === 0 && t.nextPingAt !== null ? { firstPingAt: t.nextPingAt } : {}) }
  const st = t.status
  if (st && 'stop' in st) return { kind: 'stopped', stop: st.stop, ...(st.warm !== undefined ? { warmUntil: st.warm } : {}) }
  if (st && 'compaction' in st) return { kind: 'compaction', phase: st.compaction }
  return { kind: 'off', reason: st && 'off' in st ? st.off : 'noTasks' }
}

// ---- The session switches (LLD rev 8, 12.2): the master and one per track, this session only, kept in
// $.store as [session id, SessionSwitch] pairs, so a module reload loses none. The mirror is this
// session's entry for the synchronous readers (render, publish); every handler that renders awaits
// loadSwitch first.
const switchKey = 'keepalive:switch:sessions'
let switchMirror: { id: string; sw: SessionSwitch } | undefined

async function switchList($: EngineInterface): Promise<[string, SessionSwitch][]> {
  const v = await $.store.get(switchKey)
  return Array.isArray(v) ? v.filter((x): x is [string, SessionSwitch] => Array.isArray(x) && typeof x[0] === 'string' && !!x[1] && typeof x[1] === 'object') : []
}

// This session's switches: the mirror, re-read from the store when it is for another session or unset.
// A store that cannot be read leaves the switches unset and says so in the debug log.
async function loadSwitch($: EngineInterface): Promise<SessionSwitch> {
  try {
    const id = await stateId($)
    if (switchMirror?.id === id) return switchMirror.sw
    const sw = (await switchList($)).find(([s]) => s === id)?.[1] ?? {}
    switchMirror = { id, sw }
    return sw
  } catch (err) {
    $.ui.log(`keepalive: session switches not read (${err instanceof Error ? err.message : String(err)})`, { to: 'debug' })
    return switchMirror?.sw ?? {}
  }
}

// Writes this session's switches (the entry dropped when none is set), then the mirror. A store
// failure goes to the debug log and the mirror still holds the value.
async function saveSwitch($: EngineInterface, sw: SessionSwitch) {
  let id = switchMirror?.id ?? ''
  try {
    id = await stateId($)
    const rest = (await switchList($)).filter(([s]) => s !== id)
    const set = Object.keys(sw).length > 0
    await $.store.set(switchKey, (set ? [...rest, [id, sw]] : rest).slice(-settings.sessionOverridesMax))
  } catch (err) {
    $.ui.log(`keepalive: session switches not saved (${err instanceof Error ? err.message : String(err)})`, { to: 'debug' })
  }
  switchMirror = { id, sw }
}

const curSwitch = (): SessionSwitch => switchMirror?.sw ?? {}
const masterNow = (): boolean => masterOn(curSwitch(), settings.enabled)
const trackEnabled = (n: TrackName, key: TrackKey): boolean => trackOn(curSwitch(), n, settings.enabled, settings[key].enabled)
const anyOn = (): boolean => TRACKS.some(([n, k]) => trackEnabled(n, k))
const keyOf = (n: TrackName): TrackKey => TRACKS.find(([m]) => m === n)![1]

/** The set switches as the command reports them (AC-17.6.21): master, then 5m, then 1h; '' when none. */
function switchText(): string {
  const sw = curSwitch()
  return [
    ...(sw.master ? [`keep-alive: ${sw.master} for this session`] : []),
    ...(sw['5m'] ? [`5m track: ${sw['5m']} for this session`] : []),
    ...(sw['1h'] ? [`1h track: ${sw['1h']} for this session`] : []),
  ].join('; ')
}
const withSwitches = (text: string) => { const sw = switchText(); return sw ? `${text}\n${sw}` : text }

// The surface roster (LLD 20.4): read at the session's start, when a surface attaches or detaches, and
// before each handler that renders, so a module reload never falls back to the summary for long. Not
// read when statusText forces a mode. A read that fails stores [] (the summary) and logs one line.
async function refreshSurfaces($: EngineInterface) {
  if (settings.statusText !== 'auto') return
  try {
    surfaces = await $.session.surfaces()
  } catch (err) {
    surfaces = []
    $.ui.log(`keepalive: surfaces not read (${err instanceof Error ? err.message : String(err)}); showing the summary`, { to: 'debug' })
  }
}

// The id the per-session state is kept under (LLD rev 10, 19.2): the automatic handoff chain's id, so
// a seeded session sees the switches and the --session overrides of the session it continues; with
// handoff.carryOver off, the session's own id.
async function stateId($: EngineInterface): Promise<string> {
  return settings.handoff.carryOver ? (await chainIdOf($)).id : await $.session.id()
}

// The chain as published for the lens (cache-lab LLD 7.2): its id and its sessions, newest first.
let chainInfo: { id: string; sessions: string[] } | undefined
async function refreshChain($: EngineInterface) {
  try {
    chainInfo = { id: (await chainIdOf($)).id, sessions: await chainSessions($) }
  } catch (err) {
    $.ui.log(`keepalive: chain not read (${err instanceof Error ? err.message : String(err)})`, { to: 'debug' })
  }
}

// What a handler that renders reads first: this session's switches, the surface roster and the chain.
async function prepare($: EngineInterface) {
  await loadSwitch($)
  await refreshSurfaces($)
  await refreshChain($)
}

// The published cache entries of a track's lifetime, one per source that has one (D8); omitted when none.
function cachesOf(n: TrackName, now: number): KeepaliveTrackState['caches'] {
  const v = cacheView(ledger, n, now)
  const caches = [
    ...(v.main ? [{ source: 'main' as const, ...v.main }] : []),
    ...(v.subagents ? [{ source: 'subagents' as const, ...v.subagents }] : []),
  ]
  return caches.length ? caches : undefined
}

/** The tracks as published at `now`: their status, with the next ping, the keep-warm time, the ping
 * limit, the line as shown and, when the ledger has any, the caches of the track's lifetime. */
function trackStates(now: number): KeepaliveTrackState[] {
  return TRACKS.map(([n]) => {
    const t = tracks[n]
    const cfg = cfgOf(t)
    const keep = keepOf(t)
    const caches = cachesOf(n, now)
    const sw = curSwitch()[n]
    return {
      name: n,
      running: t.timer !== undefined,
      armedAt: t.armedTime,
      warmUntil: t.warmUntil,
      nextPingAt: t.timer !== undefined ? t.nextPingAt : null,
      pingEvery: cfg.pingEvery,
      keepWarmMs: keep.ms,
      pings: t.pings,
      cap: pingCap(cfg.maxPings, cfg.pingEvery, keep),
      line: lineFor(t, now),
      keepWarmFrom: sourceLabel(keep),
      ...(sw ? { sessionSwitch: sw } : {}),
      ...(caches ? { caches } : {}),
    }
  })
}

// Never throws and never waits: a failed write only goes to the debug log. The last catch keeps the
// chain resolved when that log call fails too, so one failure never stops every later write.
// `now` is the caller's clock reading, the time the snapshot's cache parts speak for.
function publish($: EngineInterface, now: number) {
  const master = curSwitch().master
  const snapshot = { enabled: masterNow(), ...(master ? { sessionMaster: master } : {}), ...(chainInfo ? { chain: { id: chainInfo.id, sessions: [...chainInfo.sessions] } } : {}), tracks: trackStates(now) }
  publishing = publishing
    .then(async () => {
      const value: KeepaliveState = { ...snapshot, updatedAt: await $.clock.now(), sessionId: await $.session.id() }
      await $.state.set(STATE, value)
    })
    .catch(err => $.ui.log(`keepalive: state not published (${err instanceof Error ? err.message : String(err)})`, { to: 'debug' }))
    .catch(() => {})
}

// No keep-alive status line: `status` off (AC-17.6.5), the master off (step 40: the band and the Pane
// still show the rows and buttons, so it can be turned back on there), or no track allowed (AC-17.6.33).
const statusHidden = (): boolean => !settings.status || !masterNow() || !anyOn()

// The full text (the track lines, then the seed line while it shows) or its one-line summary, by the
// status mode (LLD 20.4); nothing while the status line is hidden (statusHidden). The band and the
// Pane redraw at every render (invalidate).
function render($: EngineInterface, now: number) {
  publish($, now)
  $.ui.invalidate('ui.render')
  if (statusHidden()) return $.ui.status(undefined)
  const full = [...TRACKS.map(([n]) => lineFor(tracks[n], now)), ...(seedLine ? [seedLine] : [])].join('\n')
  const facts = { '1h': factsOf(tracks['1h']), '5m': factsOf(tracks['5m']) }
  $.ui.status(statusTextOf(statusModeOf(settings.statusText, surfaces), full, facts, seedLine ? seedFact : undefined))
}

/** The band and Pane model now: the master button, both rows with their full lines, the seed row. */
async function bandModelNow($: EngineInterface): Promise<BandModel> {
  const now = await $.clock.now()
  const rows = { '1h': { line: lineFor(tracks['1h'], now), enabled: trackEnabled('1h', 'oneHour') }, '5m': { line: lineFor(tracks['5m'], now), enabled: trackEnabled('5m', 'fiveMinute') } }
  return bandModel(masterNow() ? 'off' : 'on', rows, seedLine)
}

// Whether the first band draw since the module loaded has checked the status line (keepaliveBand).
let statusChecked = false

/** The keep-alive band (AbovePrompt, Terminal and Desktop) or the Pane's body: the tree, or undefined
 * when `status` is off (AC-17.6.5). register.tsx composes it under auto-handoff's band. Never throws. */
export async function keepaliveBand($: EngineInterface, t: { Box: any; Text: any; Button: any }): Promise<unknown> {
  try {
    await loadSwitch($)
    // A /reload-plugins fires no session.start: the first draw after a load clears a status line the
    // module left before it, when the switches read now hide it (step 40). Once per load.
    if (!statusChecked) {
      statusChecked = true
      if (statusHidden()) $.ui.status(undefined)
    }
    if (!settings.status) return undefined
    return keepaliveTree(t, await bandModelNow($), n => { void pressTrack($, n) }, () => { void pressMaster($) })
  } catch (err) {
    $.ui.log(`keepalive: band not drawn (${err instanceof Error ? err.message : String(err)})`, { to: 'debug' })
    return undefined
  }
}

// The reason a track not running has without its disabled state: its cache, or no tasks yet (E1', E5').
const idleReason = (n: TrackName): Reason => isEmpty(ledger, n) ? { noWrite: n } : 'noTasks'
const isDisabledPart = (t: Track) => !!t.status && 'off' in t.status && t.status.off === 'disabled'

/** A track button (LLD 12.3, Q-SL8): `[off]` on an enabled track stops it (when running) and disables it
 * for this session; `[on]` enables it, with no ping (it arms at the next Stop with tasks). The master
 * and the other track are untouched. No settings file is written. Never throws. */
export async function pressTrack($: EngineInterface, n: TrackName): Promise<void> {
  try {
    const key = keyOf(n)
    const before = await loadSwitch($)
    const enabled = trackEnabled(n, key)
    await saveSwitch($, afterTrackPress(before, n, enabled))
    const t = tracks[n]
    if (enabled) {
      if (t.timer !== undefined) stopTrack(t)
      setOff(t, 'disabled')
    } else if (isDisabledPart(t)) setOff(t, idleReason(n))
    await refreshKeep($)
    render($, await $.clock.now())
  } catch (err) {
    $.ui.log(`keepalive ${n}: press failed (${err instanceof Error ? err.message : String(err)})`, { to: 'debug' })
  }
}

/** The master button (LLD 12.3, Q-SL7): `[off]` stops both tracks and disables them for this session;
 * `[on]` turns the master and both tracks on, with no ping. No settings file is written. Never throws. */
export async function pressMaster($: EngineInterface): Promise<void> {
  try {
    const before = await loadSwitch($)
    const was = masterNow()
    await saveSwitch($, afterMasterPress(before, settings.enabled))
    for (const [n] of TRACKS) {
      const t = tracks[n]
      if (was) { stopTrack(t); setOff(t, 'disabled') }
      else if (t.timer === undefined && isDisabledPart(t)) setOff(t, idleReason(n))
    }
    await refreshKeep($)
    render($, await $.clock.now())
  } catch (err) {
    $.ui.log(`keepalive: master press failed (${err instanceof Error ? err.message : String(err)})`, { to: 'debug' })
  }
}

// ---- /ai-dlc:cache-keepalive on|off (step 40) ----
const LOCAL_FILE = '.claude/settings.local.json'
const envOf = (key: string): string => SETTINGS.find(s => s.key === key)!.env

// Sets variables in the env of .claude/settings.local.json, every other key kept. Answers the problem
// and writes nothing when the file cannot be read or is not plain JSON (a file with comments is not
// rewritten, since they would be lost).
async function writeLocalEnv($: EngineInterface, vars: Record<string, string>): Promise<string | undefined> {
  const path = `${await repoRoot($)}/${LOCAL_FILE}`
  const text = await readRaw($, path)
  if (text === undefined && (await sigOf($, path)).startsWith('file:')) return `${LOCAL_FILE} exists but could not be read; nothing written`
  let doc: Record<string, unknown> = {}
  if (text !== undefined && text.trim()) {
    let parsed: unknown
    try { parsed = JSON.parse(text.replace(/^﻿/, '')) } catch { return `${LOCAL_FILE} is not plain JSON (a file with comments is not rewritten); nothing written` }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return `${LOCAL_FILE}: the top level is not an object; nothing written`
    doc = parsed as Record<string, unknown>
  }
  const env = doc.env
  if (env !== undefined && (!env || typeof env !== 'object' || Array.isArray(env))) return `${LOCAL_FILE}: env is not an object; nothing written`
  doc.env = { ...(env as Record<string, unknown> | undefined), ...vars }
  const eol = text?.includes('\r\n') ? '\r\n' : '\n'
  await $.fs.write(path, JSON.stringify(doc, null, 2).replace(/\n/g, eol) + eol)
  return undefined
}

/**
 * `on` / `off`: the master, or the tracks --track names. With --session, the band's buttons (this
 * session's switches; no file written). Otherwise the env of .claude/settings.local.json, which wins
 * over .claude/settings.json and .ai-dlc/cache-keepalive.json; this session's switch for what was
 * written is dropped, since a switch outranks every settings file, so the written value applies now.
 */
async function switchCommand($: EngineInterface, a: Extract<CommandArgs, { kind: 'switch' }>): Promise<string> {
  const word = a.on ? 'on' : 'off'
  const names = a.tracks
  const what = names ? names.map(n => `the ${n} track`).join(' and ') : 'keep-alive'
  if (a.where === 'session') {
    if (!names) { if (masterNow() !== a.on) await pressMaster($) }
    else for (const n of names) if (trackEnabled(n, keyOf(n)) !== a.on) await pressTrack($, n)
    return withSwitches(`keepalive: ${what} ${word} for this session; no settings file written`)
  }
  const vars: Record<string, string> = names
    ? Object.fromEntries(names.map(n => [envOf(`${keyOf(n)}.enabled`), String(a.on)]))
    : { [envOf('enabled')]: String(a.on) }
  const problem = await writeLocalEnv($, vars)
  if (problem) return `keepalive: ${problem}`
  const sw = await loadSwitch($)
  await saveSwitch($, names ? Object.fromEntries(Object.entries(sw).filter(([k]) => !names.includes(k as TrackName))) as SessionSwitch : {})
  await load($)
  for (const [n, key] of TRACKS) {
    const t = tracks[n]
    if (!trackEnabled(n, key)) { if (t.timer !== undefined) stopTrack(t); setOff(t, 'disabled') }
    else if (t.timer === undefined && isDisabledPart(t)) setOff(t, idleReason(n))
  }
  await refreshKeep($)
  render($, await $.clock.now())
  const written = Object.entries(vars).map(([k, v]) => `${k}=${v}`).join(', ')
  return withSwitches(`keepalive: ${what} ${word}: ${written} written to the env of ${LOCAL_FILE}, which wins over .claude/settings.json and ${REPO_FILE}`)
}

async function warn($: EngineInterface, line: string) {
  if (warned.has(line)) return
  warned.add(line)
  $.ui.log(`keepalive: ${line}`)
  await log($, `keepalive: ${line}`)
}

// Where a person sets a trust-gated setting instead: the sources a cloned repository cannot write.
const GATED_INSTEAD = `set them in the env of .claude/settings.local.json instead (a keep-warm time also with /${COMMAND})`

// The turn cache: what the read at a new turn (load with atTurn) keeps between turns, so a turn reads
// only what changed. A Stop and the command never use it.
// - files: each settings file's text with its size and modified time ('missing' when it does not
//   stat); a file is read again only when that changes. Two edits in one modified-time tick that
//   leave the size the same go unseen until the next full read.
// - cwd, root, target: git's answers (the repository root, and what trust is keyed on) for the
//   session's working directory. Dropped when that directory changes, at session.end and at every
//   full read (forgetGit), so a turn never runs git while the directory stays, and is never behind
//   the last full read, which runs git itself. Not watched otherwise: a git init or a moved worktree
//   has no cheaper signal than the rev-parse it would replace.
// - trust: Claude Code's trust answer, kept with the size and modified time of ~/.claude.json, which
//   is stat-ed at every turn that needs the answer and read again when it changed. Trust fails
//   closed and gates the committed sources, so a trust withdrawn in that file must count at the next
//   turn. Still asked only when a trust-gated setting differs from its default (trustGate).
type Seen = { sig: string; text: string | undefined }
type TrustAnswer = { trusted: boolean; why: string }
let turnCache: { files: Map<string, Seen>; cwd?: string; root?: string; target?: TrustTarget; trust?: { sig: string; answer: TrustAnswer } } = { files: new Map() }

const forgetGit = () => { turnCache = { files: turnCache.files } }

// A file's size and modified time, 'missing' when it does not stat (missing, or unreadable).
async function sigOf($: EngineInterface, path: string): Promise<string> {
  try {
    const s = await $.fs.stat(path)
    return `${s.kind}:${s.size}:${s.mtimeMs}`
  } catch {
    return 'missing'
  }
}

// A file that stats as a file but whose read fails (a lock or a transient error while an editor saves
// it) is not absent: the read at a turn counts it as a failure, so the turn keeps the settings last read.
const unreadable = (path: string) => new Error(`${path} exists but could not be read`)

// readRaw, but only when the file's size or modified time changed since the turn cache last read it.
// Throws, caching nothing, when a file that stats as a file cannot be read: its next turn reads it
// again. A path that stats as something else (a folder) reads as absent, as at a full read.
async function cachedRead($: EngineInterface, path: string): Promise<string | undefined> {
  const sig = await sigOf($, path)
  const was = turnCache.files.get(path)
  if (was && was.sig === sig) return was.text
  const text = await readRaw($, path)
  if (text === undefined && sig.startsWith('file:')) {
    turnCache.files.delete(path)
    throw unreadable(path)
  }
  // A file that does not stat but reads is not kept: next turn reads it again
  if (sig === 'missing' && text !== undefined) turnCache.files.delete(path)
  else turnCache.files.set(path, { sig, text })
  return text
}

// The repository root for the turn read: git runs again only when the working directory changed.
// The answer is kept only in the cache it was asked for: a full read (forgetGit) or a new working
// directory that replaced the cache while git ran must make the next turn ask again.
async function turnRoot($: EngineInterface): Promise<string> {
  const cwd = (await $.session.cwd()).replace(/\\/g, '/')
  if (turnCache.cwd !== cwd) turnCache = { files: turnCache.files, cwd }
  if (turnCache.root !== undefined) return turnCache.root
  const cache = turnCache
  const root = await repoRoot($)
  if (turnCache === cache) cache.root = root
  return root
}

// The trust answer for the turn read, as a TrustCache whose answer trustGate asks for only when a
// gated setting differs from its default (io.ts): reused while the trust target and ~/.claude.json
// are unchanged, else worked out again as folderTrust does. A ~/.claude.json that stats as a file but
// cannot be read rejects the answer, caching nothing: the turn counts it as a failure and keeps the
// settings last read (load), and the next turn reads the file again.
function turnTrust($: EngineInterface): TrustCache {
  let result: Promise<TrustAnswer> | undefined
  const answer = async (): Promise<TrustAnswer> => {
    const home = await homeDir($)
    const path = home ? `${home}/.claude.json` : undefined
    let target = turnCache.target
    if (target === undefined) {
      const cache = turnCache
      target = await trustTarget($)
      // As in turnRoot: kept only in the cache it was asked for
      if (turnCache === cache) cache.target = target
    }
    const sig = path ? await sigOf($, path) : 'missing'
    if (turnCache.trust?.sig === sig) return turnCache.trust.answer
    const text = path ? await readRaw($, path) : undefined
    if (path && text === undefined && sig.startsWith('file:')) {
      turnCache.trust = undefined
      throw unreadable(path)
    }
    const fresh = trustOf(text, target)
    // Kept only when the file stat-ed: a file that cannot be stat-ed is asked again at every turn
    turnCache.trust = sig === 'missing' ? undefined : { sig, answer: fresh }
    return fresh
  }
  // trustGate (io.ts) asks `cache.result ??= folderTrust($)`. This getter always answers a promise,
  // so at a turn folderTrust is never called and the cached answer above is the one used; the test
  // "trustGate asks the turn cache" fails if trustGate stops going through cache.result.
  return {
    get result() { return result ??= answer() },
    set result(v) { result = v },
  }
}

// Reads every level and resolves each setting, highest first: `env` of .claude/settings.local.json,
// `env` of .claude/settings.json, .ai-dlc/cache-keepalive.json, the default (settings.ts). Keep-alive
// has no /config rows, and the process environment is not read. The two committed sources, the env
// of .claude/settings.json and the repository file, set the trust-gated settings (settings.ts,
// TRUST_GATED) only in a folder Claude Code trusts; elsewhere each one whose value differs from its
// default is skipped with a warning and the next level applies (one equal to its default changes
// nothing, so it applies quietly: settings.ts, gatedDiffering). Never throws: on an error, the
// defaults apply.
// `atTurn`: the read at a new turn (turn.start), so a fresh session publishes its real settings from
// its first turn. Same levels, precedence and trust, but a settings file that cannot be parsed, or a
// read that fails, keeps the settings last read instead (the defaults when none was read yet) and
// says so in the debug log. Nothing is warned in the transcript: the next Stop or command reads and
// warns as above. It reads through the turn cache below: only what changed since the last turn.
async function load($: EngineInterface, { atTurn = false } = {}) {
  const problems: string[] = []
  // The problems that mean a file was not read: its JSON, its shape, or the read itself
  const failures: string[] = []
  const fail = (line: string) => { problems.push(line); failures.push(line) }
  const levels: Level[] = []
  // A full read (a Stop, the command) runs git and reads every file itself, and drops the cached git
  // and trust answers, so the next turn asks git again: a turn's answer is never older than the last
  // full read. The cached files need no dropping: their size and modified time say when they changed.
  if (!atTurn) forgetGit()
  const trust: TrustCache = atTurn ? turnTrust($) : {}
  const read = atTurn ? (path: string) => cachedRead($, path) : (path: string) => readRaw($, path)
  try {
    const root = atTurn ? await turnRoot($) : await repoRoot($)
    for (const where of ['.claude/settings.local.json', '.claude/settings.json']) {
      const { env, problem } = settingsEnv(await read(`${root}/${where}`))
      if (problem) fail(`${where} ${problem}`)
      if (!env) continue
      const values = where === '.claude/settings.json' ? await trustGate($, env, gatedDiffering(env, 'env'), `the env of ${where}`, GATED_INSTEAD, problems, trust) : env
      levels.push({ where, by: 'env', values })
    }
    const repo = repoConfig(await read(`${root}/${REPO_FILE}`))
    if (repo.problem) fail(`${REPO_FILE} ${repo.problem}`)
    if (repo.values) levels.push({ where: REPO_FILE, by: 'json', values: await trustGate($, repo.values, gatedDiffering(repo.values, 'json'), REPO_FILE, GATED_INSTEAD, problems, trust) })
  } catch (err) {
    fail(atTurn ? `settings files unreadable (${String(err)})` : `settings files unreadable (${String(err)}); using the defaults`)
  }
  if (atTurn && failures.length) {
    for (const line of failures) $.ui.log(`keepalive: settings not re-read at the new turn: ${line}; keeping the settings last read`, { to: 'debug' })
    return
  }
  const r = resolveSettings(levels)
  settings = r.settings
  sources = r.sources
  // At a turn, the other problems (an invalid value, a setting skipped in an untrusted folder) are left
  // to the next Stop or command, which warns about each once a session
  if (atTurn) return
  for (const line of [...problems, ...r.warnings]) await warn($, line)
}

// The keep-warm time in force and where it comes from; `override` when /ai-dlc:cache-keepalive set it.
type Keep = { ms: number; from: string; override?: boolean }

async function sessionOverrides($: EngineInterface, n: TrackName): Promise<[string, number][]> {
  const v = await $.store.get(sessionKey(n))
  return Array.isArray(v) ? v.filter((x): x is [string, number] => Array.isArray(x) && typeof x[0] === 'string' && typeof x[1] === 'number') : []
}

// The keep-warm time of a track: this session's override, the machine's, then the track's setting.
// An override shorter than minDuration (set before minDuration was raised) is ignored with a warning.
// `session: false` leaves this session's override out and warns about nothing: the time a session
// that has ended leaves in force (session.end), which its own override no longer reaches.
async function keepWarm($: EngineInterface, key: TrackKey, { session = true } = {}): Promise<Keep> {
  const n = TRACKS.find(([, k]) => k === key)![0]
  if (session) {
    const id = await stateId($)
    const own = (await sessionOverrides($, n)).find(([s]) => s === id)
    if (own) {
      if (own[1] >= settings.minDuration) return { ms: own[1], from: `this session, /${COMMAND}`, override: true }
      await warn($, `the /${COMMAND} override of the ${n} track for this session (${formatDuration(own[1])}) is shorter than minDuration (${formatDuration(settings.minDuration)}); ignored`)
    }
  }
  const machine = await $.store.get(machineKey(n))
  if (typeof machine === 'number' && machine > 0) {
    if (machine >= settings.minDuration) return { ms: machine, from: `this machine, /${COMMAND}`, override: true }
    if (session) await warn($, `the /${COMMAND} override of the ${n} track for this machine (${formatDuration(machine)}) is shorter than minDuration (${formatDuration(settings.minDuration)}); ignored`)
  }
  return { ms: settings[key].keepWarmFor, from: sources[`${key}.keepWarmFor`] ?? 'default' }
}

// Re-reads the keep-warm time of every track that is not running, so the state it publishes says the
// time now in force: the one the track's next arming would take. Called where a track is reset (a
// new turn, the session ending), where the overrides change (/ai-dlc:cache-keepalive), after every
// full read of the settings (a Stop, the command, the seed line), and wherever a track stops, on its
// own or not (end, the spend limit, work done, overage, a handoff), so an override set or cleared
// while it ran counts the moment it stops. Never here for a running track: its tick reads the time
// again before each ping, and a change made while it runs takes effect at that ping (README), so
// until then the time it armed with is the one in force.
// Not in stopTrack: arm() calls it before every arming. A track armed while this waits on the store
// is left alone (its generation moved on). Never throws: a store that cannot be read leaves the
// track's setting in force, as keepWarm's last level, and says so in the debug log.
async function refreshKeep($: EngineInterface, opts: { session?: boolean } = {}) {
  for (const [n, key] of TRACKS) {
    const t = tracks[n]
    if (t.timer !== undefined) continue
    const g = t.generation
    let keep: Keep | undefined
    try {
      keep = await keepWarm($, key, opts)
    } catch (err) {
      $.ui.log(`keepalive ${n}: keep-warm time not re-read (${err instanceof Error ? err.message : String(err)}); publishing the setting`, { to: 'debug' })
    }
    if (t.generation === g && t.timer === undefined) t.keep = keep
  }
}

// For a stop that cannot wait on the store (stopForHandoff answers at once): re-reads in the
// background, then publishes, unless a track was stopped or armed meanwhile (a new turn or the
// session ending), since that path re-reads and publishes for itself.
async function republishKeep($: EngineInterface) {
  const gens = TRACKS.map(([n]) => tracks[n].generation)
  await refreshKeep($)
  if (TRACKS.every(([n], i) => tracks[n].generation === gens[i])) publish($, await $.clock.now())
}

// Sets (ms) or clears (undefined) the override of each track named, in the scope given.
async function setKeepWarm($: EngineInterface, scope: Scope, ms: number | undefined, which: readonly TrackName[]) {
  for (const n of which) {
    if (scope === 'machine') {
      await (ms === undefined ? $.store.delete(machineKey(n)) : $.store.set(machineKey(n), ms))
      continue
    }
    const id = await stateId($)
    const rest = (await sessionOverrides($, n)).filter(([s]) => s !== id)
    await $.store.set(sessionKey(n), ms === undefined ? rest : [...rest, [id, ms]].slice(-settings.sessionOverridesMax))
  }
}

// "keep warm 2h on both tracks (this session, ...)" when one override sets both, else each track's own.
async function keepLines($: EngineInterface) {
  const [a, b] = [await keepWarm($, 'oneHour'), await keepWarm($, 'fiveMinute')]
  if (a.ms === b.ms && a.from === b.from) return `keep warm ${formatDuration(a.ms)} on both tracks (${a.from})`
  return `keep warm: 1h track ${formatDuration(a.ms)} (${a.from}), 5m track ${formatDuration(b.ms)} (${b.from})`
}

const inOverage = (limits: { percentUsed: number }[]) => limits.some(l => l.percentUsed >= settings.overagePercent)

// Input-token equivalents a call cost, reads priced for the session's model
type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }
const cost = (u: Usage, r: number) => r * u.cache_read_input_tokens + u.input_tokens + settings.writeMult * u.cache_creation_input_tokens + settings.outputMult * u.output_tokens

// A ping of the main conversation at `at`. Its usage goes into the ledger: as a landed ping of the
// track `ttl` when it hit the cache (observePing), else as any response (observe), which is also how
// the command's ping, which keeps no track, is recorded.
// `at` is the ping's start, taken before the fork, so a warm-until recorded from it errs early.
async function ping($: EngineInterface, at: number, ttl?: TrackName) {
  const r = await $.model.fork({ prompt: settings.pingPrompt })
  if (!('usage' in r)) return { ok: false, line: `no ping: ${r.reason}` }
  const u = r.usage
  context = u.cache_read_input_tokens + u.cache_creation_input_tokens + u.input_tokens
  const hit = u.cache_read_input_tokens / Math.max(context, 1)
  spent += cost(u, readMult(settings.readPrice, await $.session.model()))
  const of = Number.isFinite(budget) ? `of ${Math.round(budget)}` : '(no spend limit)'
  const ok = hit > settings.hitThreshold
  if (ok && ttl) observePing(ledger, { at, ttl, usage: u }, life())
  else observe(ledger, { at, usage: u }, life())
  return { ok, line: `cache read ${u.cache_read_input_tokens}/${context} (${Math.round(hit * 100)}%), spent ${Math.round(spent)} ${of} token-equivalents` }
}

// Compacting pays when its own cost plus re-caching the summary is below re-caching the whole context
async function compactPays($: EngineInterface) {
  const perToken = (await $.store.get(COST_KEY) as number | undefined) ?? settings.compactCostGuess
  const ratio = (await $.store.get(RATIO_KEY) as number | undefined) ?? settings.summaryRatioGuess
  return perToken + settings.writeMult * ratio < settings.writeMult
}

// Compaction only appends to the transcript, and its boundary row names the last message before it.
// The mod API exposes no message UUIDs, so the command reads that row, picked by when this compaction began.
// --resume-session-at is a hidden CLI flag; --fork-session leaves the compacted session as it is.
async function restoreCommand($: EngineInterface, startedAt: string) {
  const id = await $.session.id()
  const quote = (s: string) => `'${s.replaceAll("'", `'\\''`)}'`
  const at = `jq -r 'select(.subtype == "compact_boundary" and .timestamp >= "${startedAt}") | .logicalParentUuid' `
    + `"\${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/projects/*/${id}.jsonl | head -1`
  return `cd ${quote(await $.session.cwd())} && claude --resume ${id} --fork-session --resume-session-at "$(${at})"`
}

async function compact($: EngineInterface) {
  compacting = true
  try {
    const startedAt = new Date(await $.clock.now()).toISOString()
    const r = await $.session.compact({ instructions: settings.compactInstructions })
    if (r.skip !== undefined) return `compaction skipped: ${r.skip}`
    $.ui.log(`keepalive: compacted. To reopen the conversation as it was before, in a new session, run: ${await restoreCommand($, startedAt)}`)
    const before = r.tokensBefore ?? context
    if (r.usage && before) {
      await $.store.set(COST_KEY, cost(r.usage, readMult(settings.readPrice, await $.session.model())) / before)
      if (r.tokensAfter) await $.store.set(RATIO_KEY, r.tokensAfter / before)
    }
    const read = r.usage ? `${r.usage.cache_read_input_tokens} read from cache, ${r.usage.output_tokens} output` : 'no usage reported'
    return `compacted ${before} → ${r.tokensAfter ?? '?'} tokens (${read})`
  } catch (err) {
    return `compaction refused: ${err instanceof Error ? err.message : String(err)}`
  } finally {
    compacting = false
  }
}

/** The pings a keep-warm time allows on a track: the n-th ping is due n × pingEvery after the turn
 * ended and goes out when that is within the keep-warm time, the last one included (see arm). */
export const pingsWithin = (keepMs: number, pingEvery: number) => Math.floor(keepMs / pingEvery)

/** A track's ping limit: maxPings, or, when /ai-dlc:cache-keepalive set the keep-warm time, at least the
 * pings that time allows, so the command always keeps warm for the time it says. */
export const pingCap = (maxPings: number, pingEvery: number, keep: { ms: number; override?: boolean }) =>
  keep.override ? Math.max(maxPings, pingsWithin(keep.ms, pingEvery)) : maxPings

// Written right after arm(), so cfgOf gives the settings the armed timer took, and nextPingAt is the
// first tick: until a ping lands, the counter says when the first one is due, so 0 reads "not yet"
// (spec D6, LLD 3.5)
const pingsOf = (t: Track, keep: Keep) => {
  const cfg = cfgOf(t)
  const first = t.pings === 0 && t.nextPingAt !== null ? `, first ping at ${hhmm(t.nextPingAt)}` : ''
  return `ping ${t.pings}/${pingCap(cfg.maxPings, cfg.pingEvery, keep)}${first}`
}
const runningText = (t: Track, keep: Keep, lead = '') =>
  `${lead}warm until ${hhmm(t.warmUntil)}, ${pingsOf(t, keep)}, keep warm ${formatDuration(keep.ms)}${noteOf(keep)}, stop by ${hhmm(t.armedTime + keep.ms)}`

// A track stopping on its own (expired, kept warm, missed, its ping limit, an error): its keep-warm
// time is re-read before the state is published (refreshKeep). Never throws.
async function end($: EngineInterface, t: Track, text: string, stop: StopKind) {
  stopTrack(t)
  setStopped(t, text, stop)
  await refreshKeep($)
  render($, await $.clock.now())
}

// One track's pings: each tick checks, in order, a timer that fired after the cache expired, the
// track's keep-warm time, then pings; a miss stops the track, a hit moves "warm until" on, and the
// track's ping limit or the shared spend limit stops it after that ping.
// `from` is the time the timer is set, so the published state can say when the next ping is due.
function arm($: EngineInterface, t: Track, from: number) {
  stopTrack(t)
  const armedAt = t.generation
  const cfg = settings[t.key]
  t.cfg = cfg
  t.nextPingAt = from + cfg.pingEvery
  t.timer = $.clock.after(cfg.pingEvery, async () => {
    // A timer stopped since it was set must not touch the track: another may be armed by now
    if (t.generation !== armedAt) return
    t.timer = undefined
    try {
      // A timer that fires late (the machine slept) finds the cache gone, and a ping would only re-write it
      const now = await $.clock.now()
      if (t.generation !== armedAt) return
      if (now >= t.warmUntil) { t.pingWarmUntil = 0; return await end($, t, 'expired, stopped', 'expired') }
      const keep = await keepWarm($, t.key)
      if (t.generation !== armedAt) return
      t.keep = keep
      // The n-th ping is due n × pingEvery after the turn ended, and goes out when that is within the
      // keep-warm time, the last one included (20 on the 5m track's hour; human decision D1). Counted
      // on that schedule, not the clock, so the seconds each ping takes never cost the last one.
      // A duration spent before the first ping needed none: the cache's own lifetime covered it.
      if ((t.pings + 1) * cfg.pingEvery > keep.ms) return await end($, t, `${t.pings ? 'kept warm' : 'no ping needed for'} ${formatDuration(keep.ms)}, stopped, warm until ${hhmm(t.warmUntil)}`, 'done')

      const { ok, line } = await ping($, now, t.name)
      if (t.generation !== armedAt) return
      $.ui.log(`keepalive ${t.name}: ${line}`, { to: 'debug' })
      if (!ok) { t.pingWarmUntil = 0; return await end($, t, 'missed, stopped', 'missed') }
      t.warmUntil = now + cfg.ttl
      t.pingWarmUntil = t.warmUntil
      t.pings++
      // Awaited, so a failure in it lands in the catch below
      if (spent >= budget) return await spendLimit($, t)
      // The ping limit stops the track only when the keep-warm time would allow another ping; when it
      // does not, the next tick ends the track as "kept warm", as without a limit.
      const cap = pingCap(cfg.maxPings, cfg.pingEvery, keep)
      if (t.pings >= cap && (t.pings + 1) * cfg.pingEvery <= keep.ms) return await end($, t, `ping limit ${cap} reached, stopped, warm until ${hhmm(t.warmUntil)}`, 'ping limit')
      const at = await $.clock.now()
      if (t.generation !== armedAt) return
      // Armed before the line and the render, so both speak for the settings the new timer took
      // (cfgOf) and the state shows the next ping
      arm($, t, at)
      setPart(t, runningText(t, keep))
      render($, at)
    } catch (err) {
      // Logged even when the track was stopped meanwhile (the spend limit stops it before it fails)
      $.ui.log(`keepalive ${t.name}: ${err instanceof Error ? err.message : String(err)}`, { to: 'debug' })
      if (t.generation !== armedAt) return
      t.pingWarmUntil = 0
      await end($, t, 'error, stopped', 'error')
    }
  })
}

// The spend limit is shared: reaching it stops every track. compactOnCap compacts instead, when it pays.
async function spendLimit($: EngineInterface, t: Track) {
  for (const [n] of TRACKS) {
    const other = tracks[n]
    if (other !== t && other.timer === undefined) continue // off, or already stopped for its own reason
    stopTrack(other)
    setStopped(other, `spend limit reached, stopped, warm until ${hhmm(other.warmUntil)}`, 'spend limit')
  }
  await refreshKeep($)
  // The tracks are already stopped, so a store that cannot be read stops here too, and says so
  let pays = false
  try {
    pays = settings.compactOnCap && await compactPays($)
  } catch (err) {
    $.ui.log(`keepalive: could not tell whether compacting pays (${err instanceof Error ? err.message : String(err)}); not compacting`, { to: 'debug' })
  }
  if (!pays) return render($, await $.clock.now())
  setPart(t, 'compacting', { compaction: 'compacting' })
  render($, await $.clock.now())
  const result = await compact($)
  $.ui.log(`keepalive: ${result}`, { to: 'debug' })
  const phase: CompactionPhase = result.startsWith('compaction skipped') ? 'skipped' : result.startsWith('compaction refused') ? 'refused' : 'compacted'
  setPart(t, result.split(' (')[0]!, { compaction: phase })
  render($, await $.clock.now())
}

/** Stops every keep-alive timer before an automatic handoff's /clear, so no ping of the old session
 * runs into the new one, and says so on the status line. Answers whether a timer was running. */
export function stopForHandoff($: EngineInterface): boolean {
  const was = anyRunning()
  stopAll('handed off, stopped', 'handoff')
  ledger = emptyLedger()
  for (const [n] of TRACKS) tracks[n].pingWarmUntil = 0
  if (was) {
    // Synchronous, as the caller's /clear follows at once: the ledger was just emptied, so no line has
    // a cache part and the time render is given changes nothing in what it shows
    render($, 0)
    void republishKeep($)
  }
  return was
}

/** The seed line's text for the tokens the seeded session's first request read from the cache. */
export const seedLineOf = (read: number) => read > 0 ? `keepalive seed: cache hit, ${k(read)} read` : 'keepalive seed: cache miss'

/** After an automatic handoff, shows on the status line whether the seeded session's first request
 * read from the prompt cache, `keepalive seed: cache hit, 30k read` or `keepalive seed: cache miss`,
 * under the track lines until the next turn starts. Hidden, like the tracks, when keep-alive or its
 * status is off. register.tsx calls it from the seed turn, beside its panel line and log line. */
export async function showSeedCache($: EngineInterface, cache: { read: number }): Promise<void> {
  seedLine = seedLineOf(cache.read)
  seedFact = cache.read > 0 ? { hit: true, tokens: cache.read } : { hit: false }
  await load($)
  await prepare($)
  // A full read: publish the keep-warm time it leaves in force (no track runs during a turn)
  await refreshKeep($)
  publish($, await $.clock.now())
  $.ui.invalidate('ui.render')
  if (statusHidden()) return
  // No track runs during a turn (turn.start stops them), so the line stands alone until the turn's
  // Stop arms one; render() then shows it under the track lines.
  $.ui.status(seedLine)
}

/** At the seed turn of an automatic handoff (register.tsx, once per handoff, after the lineage record is
 * written): when handoff.onWhenOff is on and the chain's master in force is off, acts as a master [on]
 * press (LLD rev 10, 19.4; Q-SL9): the master and both tracks on for the chain. It sends nothing, pings
 * nothing and writes only $.store (19.5). Never throws. */
export async function applyHandoffSeed($: EngineInterface): Promise<void> {
  try {
    await load($)
    switchMirror = undefined
    const sw = await loadSwitch($)
    if (settings.handoff.onWhenOff && !masterNow()) {
      await saveSwitch($, afterMasterPress(sw, settings.enabled))
      for (const [n] of TRACKS) if (tracks[n].timer === undefined && isDisabledPart(tracks[n])) setOff(tracks[n], idleReason(n))
    }
    await refreshChain($)
    await refreshKeep($)
    publish($, await $.clock.now())
    $.ui.invalidate('ui.render')
  } catch (err) {
    $.ui.log(`keepalive: handoff seed not applied (${err instanceof Error ? err.message : String(err)})`, { to: 'debug' })
  }
}

// A surface came or went, or the session started: the roster is read again and the line re-rendered.
async function rosterChanged($: EngineInterface) {
  try {
    await loadSwitch($)
    await refreshSurfaces($)
    render($, await $.clock.now())
  } catch {}
}

// The Pane's id (an identifier) and its frame title (rev 11, 20.6).
export const PANE = 'keepalive'
const PANE_TITLE = 'ai-dlc cache-keepalive'

// Opens the keep-alive Pane when a VS Code surface is attached; '' when not, or the reason it was not
// placed (`; pane not shown (<reason>)`). Never throws.
async function openPane($: EngineInterface): Promise<string> {
  try {
    if (!(await $.session.surfaces()).includes('vscode')) return ''
    const r = await $.ui.open({ id: PANE, title: PANE_TITLE, closeOnEscape: true })
    return r.isPlaced ? '' : `; pane not shown (${(r as { reason?: string }).reason ?? 'not placed'})`
  } catch (err) {
    $.ui.log(`keepalive: pane not opened (${err instanceof Error ? err.message : String(err)})`, { to: 'debug' })
    return ''
  }
}

export function registerKeepalive(on: Parameters<Register>[0], deps: KeepaliveDeps) {

  on('turn.start', async ($, e, next) => {
    stopAll()
    seedLine = undefined
    seedFact = undefined
    // The turn resets the keep-alive part only: the ledger, and so the cache part, is kept (AC-17.2.3).
    // A disabled track says so during the turn too (the band shows it, AC-17.6.8).
    await prepare($)
    for (const [n, key] of TRACKS) setOff(tracks[n], trackEnabled(n, key) ? 'turnRunning' : 'disabled')
    // The settings and the overrides are read again at every new turn, and only then: a fresh session
    // publishes its real settings from its first turn, and a machine override another session changed
    // is published at this session's next turn. Nothing is read while the session is idle. A file is
    // read again only when it changed, and git only when the working directory did (the turn cache).
    try {
      await load($, { atTurn: true })
    } catch (err) {
      $.ui.log(`keepalive: settings not re-read at the new turn (${err instanceof Error ? err.message : String(err)}); keeping the settings last read`, { to: 'debug' })
    }
    // A session's override outlives its turns (it is kept per session in the store), so the time
    // re-read here is still that override until it is cleared or the session ends
    await refreshKeep($)
    publish($, await $.clock.now())
    $.ui.invalidate('ui.render')
    if (!compacting) $.ui.status(undefined)
    return next(e)
  })

  // Arm only when background work will wake the session later. A Stop with none is the work being
  // done: nothing arms, and each track shows its cache and why it is off (AC-17.2.2).
  on('classic.Stop', async ($, e, next) => {
    try {
      if (compacting || deps.handingOff()) return next(e)
      const tasks = e.background_tasks?.length ?? 0
      const now = await $.clock.now()
      await prepare($)
      if (!tasks) {
        await seedFromTranscript($, e.transcript_path, now)
        const running = new Set(TRACKS.filter(([n]) => tracks[n].timer !== undefined).map(([n]) => n))
        if (running.size) stopAll('work done, stopped', 'done')
        for (const [n, key] of TRACKS) {
          if (running.has(n)) continue
          setOff(tracks[n], !trackEnabled(n, key) ? 'disabled' : idleReason(n))
        }
        await refreshKeep($)
        render($, now)
        return next(e)
      }
      await load($)
      // After the full read, so a seeded entry lasts the cache lifetime now in force; before every
      // branch, so each line below has its cache part
      await seedFromTranscript($, e.transcript_path, now)
      // A full read can change the keep-warm time of a track that will not arm below: each branch
      // re-reads it once the tracks are stopped (refreshKeep skips a running track). The master's old
      // branch is gone (LLD 12.3): the loop below disables each track the switches and settings leave
      // off, so with nothing allowed it stops every track with `disabled` and the line is hidden.
      const { context: ctx, rateLimits } = await $.session.usage()
      if (inOverage(rateLimits)) {
        stopAll()
        for (const [n, key] of TRACKS) setOff(tracks[n], trackEnabled(n, key) ? 'overage' : 'disabled')
        await refreshKeep($)
        render($, now)
        return next(e)
      }
      spent = 0
      budget = settings.budgetMultiplier > 0 ? settings.budgetMultiplier * (ctx.tokens ?? 0) : Infinity
      for (const [n, key] of TRACKS) {
        const t = tracks[n]
        stopTrack(t)
        if (!trackEnabled(n, key)) { setOff(t, 'disabled'); continue }
        if (isEmpty(ledger)) { setOff(t, 'noSplit'); continue }
        // A track arms from a warm main cache of its lifetime, warm until that cache's own time
        // (spec D5), or from its own last landed ping, warm until that ping's time plus the ttl, when
        // that is later and still ahead (LLD 3.4); the cache part stays the ledger's.
        const fromPing = t.pingWarmUntil > now ? t.pingWarmUntil : undefined
        // ITEM-034: subagent caches arm a track only once subagent pings exist (034.b, pingSubagents)
        const fromLedger = armUntil(ledger, n, now, { agents: false })
        const warm = fromLedger === undefined ? fromPing : fromPing === undefined ? fromLedger : Math.max(fromLedger, fromPing)
        if (warm === undefined && onlyAgentsWarm(ledger, n, now)) {
          // AC-17.3.8: only subagents hold a warm cache and nothing pings them: no arm, no main ping
          setOff(t, 'onlySubagents')
          t.warmUntil = 0
          continue
        }
        if (warm === undefined) {
          // Not armed: no write of this lifetime by any source, or every one of them has expired
          setOff(t, isEmpty(ledger, n) ? { noWrite: n } : 'expired')
          t.warmUntil = 0
          continue
        }
        t.armedTime = now
        t.pings = 0
        t.warmUntil = warm
        t.keep = await keepWarm($, key)
        arm($, t, now)
        setPart(t, runningText(t, t.keep, `armed, ${tasks} task(s), `))
      }
      // The tracks that did not arm (off, disabled, no split): the time the full read left in force
      await refreshKeep($)
      render($, now)
    } catch (err) {
      await log($, `keepalive: Stop error ${String(err)}`)
    }
    return next(e)
  })

  // ITEM-034 (LLD 3.7): agent liveness. A subagent starts running, a teammate goes idle (TeammateIdle
  // names the agent only when the input carries its agent_id); each handler only observes.
  on('classic.SubagentStart', async ($, e, next) => {
    try {
      if (e.agent_id) markAgent(ledger, e.agent_id, 'running')
    } catch {}
    return next(e)
  })
  on('classic.TeammateIdle', async ($, e, next) => {
    try {
      const id = (e as { agent_id?: string }).agent_id
      if (id && ledger.agents.has(id)) markAgent(ledger, id, 'idle')
    } catch {}
    return next(e)
  })

  // ITEM-034.c and 034 (LLD 3.7, rev 12): a stop with no transcript file (a forked helper, or a file not
  // written yet) is ignored. Otherwise the transcript is logged, the agent is finished (never pinged,
  // AC-17.3.3), and while it has no entry or only its 'unknown' marker its split comes from the transcript.
  on('classic.SubagentStop', async ($, e, next) => {
    try {
      const path = e.agent_transcript_path
      if (!path || !(await $.fs.exists(path))) {
        $.ui.log(`keepalive: subagent ${e.agent_id ?? '?'} has no transcript file, ignored`, { to: 'debug' })
        return next(e)
      }
      const text = await logSubagentTranscript($, e)
      if (e.agent_id) {
        const unsettled = agentUnsettled(ledger, e.agent_id)
        markAgent(ledger, e.agent_id, 'finished')
        const r = unsettled && text !== undefined ? splitFromAgentTranscript(text) : undefined
        if (r) settleAgent(ledger, e.agent_id, r, await $.clock.now(), life())
      }
    } catch {}
    return next(e)
  })

  // Other sessions can push the account into overage during the wait
  on('session.measure', async ($, e, next) => {
    if (anyRunning() && e.changed.includes('rateLimits') && inOverage(e.rateLimits)) {
      await prepare($)
      stopAll('overage, stopped', 'overage')
      await refreshKeep($)
      render($, await $.clock.now())
    }
    return next(e)
  })

  // The session ended (exit, /clear, resume elsewhere): its timers must not ping the next one, and
  // nothing of its spend, its context or its warnings carries over. Module variables survive /clear.
  on('session.end', async ($, e, next) => {
    stopAll()
    ledger = emptyLedger()
    tailLogged = false
    seedLine = undefined
    spent = 0
    budget = 0
    context = 0
    compacting = false
    // A new session reads every settings file, and asks git and trust, again at its first turn
    turnCache = { files: new Map() }
    // Each session warns about a setting problem once
    for (const [n] of TRACKS) { setOff(tracks[n], 'sessionEnded'); tracks[n].pingWarmUntil = 0 }
    // The session's switches end with it (AC-17.6.18): its store entry is deleted, so a session started
    // later in this folder starts with none set. Not at an automatic handoff's /clear with carryOver on
    // (LLD rev 10, 19.3): the chain goes on in the seeded session, which keeps the entry.
    try {
      const id = await stateId($)
      const list = await switchList($)
      const continuing = deps.handingOff() && settings.handoff.carryOver
      if (!continuing && list.some(([s]) => s === id)) await $.store.set(switchKey, list.filter(([s]) => s !== id))
    } catch (err) {
      $.ui.log(`keepalive: session switches not cleared (${err instanceof Error ? err.message : String(err)})`, { to: 'debug' })
    }
    switchMirror = undefined
    // The ended session's own override reaches no other session: the machine's override or the
    // setting is what stays in force
    await refreshKeep($, { session: false })
    warned.clear()
    publish($, await $.clock.now())
    $.ui.invalidate('ui.render')
    $.ui.status(undefined)
    return next(e)
  })

  // The roster of surfaces (LLD 20.4): re-read when the session starts or a surface comes or goes, and
  // the status line re-rendered in the mode it gives. The payloads are not read.
  on('session.start', async ($, e, next) => (await rosterChanged($), next(e)))
  on('session.attach', async ($, e, next) => (await rosterChanged($), next(e)))
  on('session.detach', async ($, e, next) => (await rosterChanged($), next(e)))

  // The keep-alive Pane (VS Code), opened by the command: the same tree as the band (AC-17.6.9).
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    const tree = await keepaliveBand($, $.ui.resolve(e))
    return tree === undefined ? next(e) : tree as never
  })

  // /ai-dlc:cache-keepalive pings now (upstream). With a duration it sets the keep-warm time of both
  // tracks, or of the one --track names, and with clear it removes that override, in the default scope
  // or the one --session / --machine names.
  on('command.run', { command: COMMAND }, async ($, e) => {
    await load($)
    await prepare($)
    // A full read: publish the keep-warm time, pingEvery and limit it leaves in force
    await refreshKeep($)
    publish($, await $.clock.now())
    const args = parseCommandArgs(e.args ?? '', settings.scope, settings.minDuration)
    if (args.kind === 'usage') {
      const every = TRACKS.map(([n, key]) => `the ${n} track every ${formatDuration(settings[key].pingEvery)}`).join(' and ')
      return { text: `keepalive: ${args.problem}. Usage: /${COMMAND} [<n>m|<n>h|<n>d|clear|on|off] [--track 1h|5m|both] [--session|--machine]. on or off turns keep-alive, or the tracks --track names, on or off in the env of ${LOCAL_FILE} (with --session, for this session only). A duration sets the keep-warm time of both tracks, or of the one --track names. Pings come on ${every}, so a duration no longer than a track's interval sends no ping on it: the cache's own lifetime covers it.` }
    }
    if (args.kind === 'switch') return { text: await switchCommand($, args) }
    if (args.kind !== 'ping') {
      await setKeepWarm($, args.scope, args.kind === 'set' ? args.ms : undefined, args.tracks)
      await refreshKeep($)
      publish($, await $.clock.now())
      const where = args.scope === 'machine' ? 'every session on this machine' : 'this session'
      const which = args.tracks.length === TRACK_NAMES.length ? 'both tracks' : `the ${args.tracks[0]} track`
      const what = args.kind === 'set' ? `set to ${formatDuration(args.ms)} on ${which} for ${where}` : `override cleared on ${which} for ${where}`
      // A running track keeps the time it armed with until its next ping, which reads it again
      const running = args.tracks.filter(n => tracks[n].timer !== undefined)
      const later = running.length === 0 ? '' : running.length === 1
        ? `; the running ${running[0]} track takes it at its next ping`
        : '; the running tracks take it at their next ping'
      return { text: withSwitches(`keepalive: keep-warm ${what}; now ${await keepLines($)}${later}`) }
    }
    // In VS Code the command also opens the keep-alive Pane, the buttons' only place there (LLD 13);
    // the Terminal and Desktop have the band.
    const pane = await openPane($)
    if (!anyOn()) return { text: withSwitches(`keepalive: off (enabled=false, ${sources.enabled ?? 'default'}); nothing pinged${pane}`) }
    const { context: ctx } = await $.session.usage()
    if (!budget) budget = settings.budgetMultiplier > 0 ? settings.budgetMultiplier * (ctx.tokens ?? 0) : Infinity
    const { ok, line } = await ping($, await $.clock.now())
    return { text: withSwitches(`${ok ? 'HIT' : 'MISS'}: ${line}; ${await keepLines($)}${pane}`) }
  })
}

/** The settings in force and where each came from. */
export const current = () => ({ settings, sources })
