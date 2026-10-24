import type { EngineInterface, Register, Timer } from 'claude-code'
import { TRACK_NAMES, formatDuration, parseCommandArgs } from './duration.ts'
import type { Scope, TrackName } from './duration.ts'
import { defaults, gatedDiffering, readMult, resolveSettings } from './settings.ts'
import type { Level, Settings, TrackKey, TrackSettings } from './settings.ts'
import { creationSplit, k, repoConfig, settingsEnv, trustOf } from '../auto-handoff/config.ts'
import type { TrustTarget } from '../auto-handoff/config.ts'
import { homeDir, log, readRaw, repoRoot, trustGate, trustTarget } from '../auto-handoff/io.ts'
import type { TrustCache } from '../auto-handoff/io.ts'
import type { KeepaliveState, KeepaliveTrackState } from '../../types/index.d.ts'
import { armUntil, cachePart, cacheView, emptyLedger, hasMain, hhmm, isEmpty, lineOf, observe, observePing, reasonText, seedMain } from './cache-state.ts'
import type { Ledger, Lifetimes } from './cache-state.ts'

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
type Track = { name: TrackName; key: TrackKey; timer?: Timer; generation: number; armedTime: number; warmUntil: number; pingWarmUntil: number; pings: number; part: string; nextPingAt: number | null; keep?: Keep; cfg?: TrackSettings }
const newTrack = (name: TrackName, key: TrackKey): Track => ({ name, key, generation: 0, armedTime: 0, warmUntil: 0, pingWarmUntil: 0, pings: 0, part: reasonText({ noWrite: name }), nextPingAt: null })

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

/** The 1h/5m split of a usage object, when it carries one with a write: `cache_creation`'s
 * `ephemeral_1h_input_tokens` and `ephemeral_5m_input_tokens`. Undefined otherwise. */
export function splitOf(usage: unknown): Split | undefined {
  const split = creationSplit(usage)
  return split && split['1h'] + split['5m'] > 0 ? split : undefined
}

/** A transcript's last cache write: its split and, when the row has a timestamp, when it was written. */
export type TranscriptSplit = { split: Split; at?: number }

/** The split of the last main-conversation response in a transcript (JSON lines) that wrote to the
 * cache, with the time of that row (`at`, from its `timestamp`) when it has one. */
export function splitFromTranscript(jsonl: string): TranscriptSplit | undefined {
  const lines = jsonl.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!
    if (!line.includes('"cache_creation"')) continue
    try {
      const o = JSON.parse(line) as { isSidechain?: boolean; timestamp?: unknown; message?: { usage?: unknown } }
      if (o.isSidechain === true) continue
      const split = splitOf(o.message?.usage)
      if (!split) continue
      const at = typeof o.timestamp === 'string' ? Date.parse(o.timestamp) : NaN
      return Number.isFinite(at) ? { split, at } : { split }
    } catch {}
  }
  return undefined
}

/** Records one main-conversation response in the cache ledger (./cache-state.ts, observe). */
export async function noteUsage($: EngineInterface, usage: unknown): Promise<void> {
  observe(ledger, { at: await $.clock.now(), usage }, life())
}

/** The split from the transcript file: read whole, else its last TAIL_BYTES through `tail`. */
export async function transcriptSplit($: EngineInterface, path: string | undefined): Promise<TranscriptSplit | undefined> {
  if (!path) return undefined
  const whole = await readRaw($, path)
  if (whole !== undefined) return splitFromTranscript(whole)
  try {
    const { exitCode, stdout } = await $.process.run(['tail', '-c', String(TAIL_BYTES), path])
    return exitCode === 0 ? splitFromTranscript(stdout) : undefined
  } catch {
    return undefined
  }
}

// No main usage seen yet: the transcript's last write seeds main, from the time of its row (seedMain).
// The guard skips the transcript read once a response or an earlier seed recorded the main cache.
async function seedFromTranscript($: EngineInterface, path: string | undefined, now: number) {
  if (hasMain(ledger)) return
  const r = await transcriptSplit($, path)
  if (r) seedMain(ledger, r.split, r.at ?? now, now, life())
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

function stopAll(line?: string) {
  for (const [n] of TRACKS) {
    const t = tracks[n]
    const was = t.timer !== undefined
    stopTrack(t)
    if (line && was) t.part = line
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
const lineFor = (t: Track, now: number) => lineOf(t.name, cachePart(cacheView(ledger, t.name, now)), t.part)

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
    const keep = t.keep ?? { ms: cfg.keepWarmFor }
    const caches = cachesOf(n, now)
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
      ...(caches ? { caches } : {}),
    }
  })
}

// Never throws and never waits: a failed write only goes to the debug log. The last catch keeps the
// chain resolved when that log call fails too, so one failure never stops every later write.
// `now` is the caller's clock reading, the time the snapshot's cache parts speak for.
function publish($: EngineInterface, now: number) {
  const snapshot = { enabled: settings.enabled, tracks: trackStates(now) }
  publishing = publishing
    .then(async () => {
      const value: KeepaliveState = { ...snapshot, updatedAt: await $.clock.now(), sessionId: await $.session.id() }
      await $.state.set(STATE, value)
    })
    .catch(err => $.ui.log(`keepalive: state not published (${err instanceof Error ? err.message : String(err)})`, { to: 'debug' }))
    .catch(() => {})
}

function render($: EngineInterface, now: number) {
  publish($, now)
  if (!settings.enabled || !settings.status) return $.ui.status(undefined)
  $.ui.status([...TRACKS.map(([n]) => lineFor(tracks[n], now)), ...(seedLine ? [seedLine] : [])].join('\n'))
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
    const id = await $.session.id()
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
    const id = await $.session.id()
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
  `${lead}warm until ${hhmm(t.warmUntil)}, ${pingsOf(t, keep)}, keep warm ${formatDuration(keep.ms)}, stop by ${hhmm(t.armedTime + keep.ms)}`

// A track stopping on its own (expired, kept warm, missed, its ping limit, an error): its keep-warm
// time is re-read before the state is published (refreshKeep). Never throws.
async function end($: EngineInterface, t: Track, text: string) {
  stopTrack(t)
  t.part = text
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
      if (now >= t.warmUntil) { t.pingWarmUntil = 0; return await end($, t, 'expired, stopped') }
      const keep = await keepWarm($, t.key)
      if (t.generation !== armedAt) return
      t.keep = keep
      // The n-th ping is due n × pingEvery after the turn ended, and goes out when that is within the
      // keep-warm time, the last one included (20 on the 5m track's hour; human decision D1). Counted
      // on that schedule, not the clock, so the seconds each ping takes never cost the last one.
      // A duration spent before the first ping needed none: the cache's own lifetime covered it.
      if ((t.pings + 1) * cfg.pingEvery > keep.ms) return await end($, t, `${t.pings ? 'kept warm' : 'no ping needed for'} ${formatDuration(keep.ms)}, stopped, warm until ${hhmm(t.warmUntil)}`)

      const { ok, line } = await ping($, now, t.name)
      if (t.generation !== armedAt) return
      $.ui.log(`keepalive ${t.name}: ${line}`, { to: 'debug' })
      if (!ok) { t.pingWarmUntil = 0; return await end($, t, 'missed, stopped') }
      t.warmUntil = now + cfg.ttl
      t.pingWarmUntil = t.warmUntil
      t.pings++
      // Awaited, so a failure in it lands in the catch below
      if (spent >= budget) return await spendLimit($, t)
      // The ping limit stops the track only when the keep-warm time would allow another ping; when it
      // does not, the next tick ends the track as "kept warm", as without a limit.
      const cap = pingCap(cfg.maxPings, cfg.pingEvery, keep)
      if (t.pings >= cap && (t.pings + 1) * cfg.pingEvery <= keep.ms) return await end($, t, `ping limit ${cap} reached, stopped, warm until ${hhmm(t.warmUntil)}`)
      const at = await $.clock.now()
      if (t.generation !== armedAt) return
      // Armed before the line and the render, so both speak for the settings the new timer took
      // (cfgOf) and the state shows the next ping
      arm($, t, at)
      t.part = runningText(t, keep)
      render($, at)
    } catch (err) {
      // Logged even when the track was stopped meanwhile (the spend limit stops it before it fails)
      $.ui.log(`keepalive ${t.name}: ${err instanceof Error ? err.message : String(err)}`, { to: 'debug' })
      if (t.generation !== armedAt) return
      t.pingWarmUntil = 0
      await end($, t, 'error, stopped')
    }
  })
}

// The spend limit is shared: reaching it stops every track. compactOnCap compacts instead, when it pays.
async function spendLimit($: EngineInterface, t: Track) {
  for (const [n] of TRACKS) {
    const other = tracks[n]
    if (other !== t && other.timer === undefined) continue // off, or already stopped for its own reason
    stopTrack(other)
    other.part = `spend limit reached, stopped, warm until ${hhmm(other.warmUntil)}`
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
  t.part = 'compacting'
  render($, await $.clock.now())
  const result = await compact($)
  $.ui.log(`keepalive: ${result}`, { to: 'debug' })
  t.part = result.split(' (')[0]!
  render($, await $.clock.now())
}

/** Stops every keep-alive timer before an automatic handoff's /clear, so no ping of the old session
 * runs into the new one, and says so on the status line. Answers whether a timer was running. */
export function stopForHandoff($: EngineInterface): boolean {
  const was = anyRunning()
  stopAll('handed off, stopped')
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
  await load($)
  // A full read: publish the keep-warm time it leaves in force (no track runs during a turn)
  await refreshKeep($)
  publish($, await $.clock.now())
  if (!settings.enabled || !settings.status) return
  // No track runs during a turn (turn.start stops them), so the line stands alone until the turn's
  // Stop arms one; render() then shows it under the track lines.
  $.ui.status(seedLine)
}

export function registerKeepalive(on: Parameters<Register>[0], deps: KeepaliveDeps) {

  on('turn.start', async ($, e, next) => {
    stopAll()
    seedLine = undefined
    // The turn resets the keep-alive part only: the ledger, and so the cache part, is kept (AC-17.2.3)
    for (const [n] of TRACKS) tracks[n].part = reasonText('turnRunning')
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
      if (!tasks) {
        await seedFromTranscript($, e.transcript_path, now)
        const running = new Set(TRACKS.filter(([n]) => tracks[n].timer !== undefined).map(([n]) => n))
        if (running.size) stopAll('work done, stopped')
        for (const [n, key] of TRACKS) {
          if (running.has(n)) continue
          tracks[n].part = !settings.enabled || !settings[key].enabled ? reasonText('disabled')
            : isEmpty(ledger, n) ? reasonText({ noWrite: n })
            : reasonText('noTasks')
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
      // re-reads it once the tracks are stopped (refreshKeep skips a running track)
      if (!settings.enabled) {
        stopAll()
        for (const [n] of TRACKS) tracks[n].part = reasonText('disabled')
        await refreshKeep($)
        publish($, now)
        $.ui.status(undefined)
        return next(e)
      }
      const { context: ctx, rateLimits } = await $.session.usage()
      if (inOverage(rateLimits)) {
        stopAll()
        for (const [n] of TRACKS) tracks[n].part = reasonText('overage')
        await refreshKeep($)
        render($, now)
        return next(e)
      }
      spent = 0
      budget = settings.budgetMultiplier > 0 ? settings.budgetMultiplier * (ctx.tokens ?? 0) : Infinity
      for (const [n, key] of TRACKS) {
        const t = tracks[n]
        stopTrack(t)
        if (!settings[key].enabled) { t.part = reasonText('disabled'); continue }
        if (isEmpty(ledger)) { t.part = reasonText('noSplit'); continue }
        // A track arms from a warm main cache of its lifetime, warm until that cache's own time
        // (spec D5), or from its own last landed ping, warm until that ping's time plus the ttl, when
        // that is later and still ahead (LLD 3.4); the cache part stays the ledger's.
        const fromPing = t.pingWarmUntil > now ? t.pingWarmUntil : undefined
        const fromLedger = armUntil(ledger, n, now)
        const warm = fromLedger === undefined ? fromPing : fromPing === undefined ? fromLedger : Math.max(fromLedger, fromPing)
        if (warm === undefined) {
          // Not armed: no write of this lifetime by any source, or every one of them has expired
          t.part = reasonText(isEmpty(ledger, n) ? { noWrite: n } : 'expired')
          t.warmUntil = 0
          continue
        }
        t.armedTime = now
        t.pings = 0
        t.warmUntil = warm
        t.keep = await keepWarm($, key)
        arm($, t, now)
        t.part = runningText(t, t.keep, `armed, ${tasks} task(s), `)
      }
      // The tracks that did not arm (off, disabled, no split): the time the full read left in force
      await refreshKeep($)
      render($, now)
    } catch (err) {
      await log($, `keepalive: Stop error ${String(err)}`)
    }
    return next(e)
  })

  // Other sessions can push the account into overage during the wait
  on('session.measure', async ($, e, next) => {
    if (anyRunning() && e.changed.includes('rateLimits') && inOverage(e.rateLimits)) {
      stopAll('overage, stopped')
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
    seedLine = undefined
    spent = 0
    budget = 0
    context = 0
    compacting = false
    // A new session reads every settings file, and asks git and trust, again at its first turn
    turnCache = { files: new Map() }
    // Each session warns about a setting problem once
    for (const [n] of TRACKS) { tracks[n].part = reasonText('sessionEnded'); tracks[n].pingWarmUntil = 0 }
    // The ended session's own override reaches no other session: the machine's override or the
    // setting is what stays in force
    await refreshKeep($, { session: false })
    warned.clear()
    publish($, await $.clock.now())
    $.ui.status(undefined)
    return next(e)
  })

  // /ai-dlc:cache-keepalive pings now (upstream). With a duration it sets the keep-warm time of both
  // tracks, or of the one --track names, and with clear it removes that override, in the default scope
  // or the one --session / --machine names.
  on('command.run', { command: COMMAND }, async ($, e) => {
    await load($)
    // A full read: publish the keep-warm time, pingEvery and limit it leaves in force
    await refreshKeep($)
    publish($, await $.clock.now())
    const args = parseCommandArgs(e.args ?? '', settings.scope, settings.minDuration)
    if (args.kind === 'usage') {
      const every = TRACKS.map(([n, key]) => `the ${n} track every ${formatDuration(settings[key].pingEvery)}`).join(' and ')
      return { text: `keepalive: ${args.problem}. Usage: /${COMMAND} [<n>m|<n>h|<n>d|clear] [--track 1h|5m|both] [--session|--machine]. A duration sets the keep-warm time of both tracks, or of the one --track names. Pings come on ${every}, so a duration no longer than a track's interval sends no ping on it: the cache's own lifetime covers it.` }
    }
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
      return { text: `keepalive: keep-warm ${what}; now ${await keepLines($)}${later}` }
    }
    if (!settings.enabled) return { text: `keepalive: off (enabled=false, ${sources.enabled ?? 'default'}); nothing pinged` }
    const { context: ctx } = await $.session.usage()
    if (!budget) budget = settings.budgetMultiplier > 0 ? settings.budgetMultiplier * (ctx.tokens ?? 0) : Infinity
    const { ok, line } = await ping($, await $.clock.now())
    return { text: `${ok ? 'HIT' : 'MISS'}: ${line}; ${await keepLines($)}` }
  })
}

/** The settings in force and where each came from. */
export const current = () => ({ settings, sources })
