import type { EngineInterface, Register, Timer } from 'claude-code'
import { TRACK_NAMES, formatDuration, parseCommandArgs } from './duration.ts'
import type { Scope, TrackName } from './duration.ts'
import { defaults, gatedNames, readMult, resolveSettings } from './settings.ts'
import type { Level, Settings, TrackKey } from './settings.ts'
import { creationSplit, k, repoConfig, settingsEnv } from '../auto-handoff/config.ts'
import { log, readRaw, repoRoot, trustGate } from '../auto-handoff/io.ts'
import type { TrustCache } from '../auto-handoff/io.ts'

// Keep-alive, folded into the ai-dlc hooks module from the vendored cache-keepalive mod (see
// ../ATTRIBUTION.md, "cache-keepalive"). When Claude ends a turn while background tasks still run, it
// pings the prompt cache so the cache is still warm when the task's notification wakes the session.
// Two tracks, one per cache lifetime: the 1-hour track and the 5-minute track. Which ones run comes
// from the 1h/5m split of the session's last cache write, never from an assumption.
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

type Track = { name: TrackName; key: TrackKey; timer?: Timer; generation: number; armedTime: number; warmUntil: number; pings: number; line: string }
const newTrack = (name: TrackName, key: TrackKey): Track => ({ name, key, generation: 0, armedTime: 0, warmUntil: 0, pings: 0, line: `keepalive ${name}: off` })

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
// The split of the last cache write this session made, from a response's usage or its transcript.
let lastSplit: Split | undefined
// After an automatic handoff, what the seeded session's first request read from the cache, shown
// under the track lines until the next turn starts (showSeedCache).
let seedLine: string | undefined

/** The 1h/5m split of a usage object, when it carries one with a write: `cache_creation`'s
 * `ephemeral_1h_input_tokens` and `ephemeral_5m_input_tokens`. Undefined otherwise. */
export function splitOf(usage: unknown): Split | undefined {
  const split = creationSplit(usage)
  return split && split['1h'] + split['5m'] > 0 ? split : undefined
}

/** The split of the last main-conversation response in a transcript (JSON lines) that wrote to the cache. */
export function splitFromTranscript(jsonl: string): Split | undefined {
  const lines = jsonl.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!
    if (!line.includes('"cache_creation"')) continue
    try {
      const o = JSON.parse(line) as { isSidechain?: boolean; message?: { usage?: unknown } }
      if (o.isSidechain === true) continue
      const split = splitOf(o.message?.usage)
      if (split) return split
    } catch {}
  }
  return undefined
}

/** Records the split of a main-conversation response, when its usage carries one. */
export function noteUsage(usage: unknown): void {
  const split = splitOf(usage)
  if (split) lastSplit = split
}

/** The split from the transcript file: read whole, else its last TAIL_BYTES through `tail`. */
export async function transcriptSplit($: EngineInterface, path: string | undefined): Promise<Split | undefined> {
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

// The status names the expiry so a line left on screen past it reads as stale
function until(ms: number) {
  const d = new Date(ms)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

const anyRunning = () => TRACKS.some(([n]) => tracks[n].timer !== undefined)

function stopTrack(t: Track) {
  // Bumping the generation also stops a ping already in flight from rearming
  t.generation++
  t.timer?.cancel()
  t.timer = undefined
}

function stopAll(line?: string) {
  for (const [n] of TRACKS) {
    const t = tracks[n]
    const was = t.timer !== undefined
    stopTrack(t)
    if (line && was) t.line = `keepalive ${n}: ${line}`
  }
}

function render($: EngineInterface) {
  if (!settings.enabled || !settings.status) return $.ui.status(undefined)
  $.ui.status([...TRACKS.map(([n]) => tracks[n].line), ...(seedLine ? [seedLine] : [])].join('\n'))
}

async function warn($: EngineInterface, line: string) {
  if (warned.has(line)) return
  warned.add(line)
  $.ui.log(`keepalive: ${line}`)
  await log($, `keepalive: ${line}`)
}

// Where a person sets a trust-gated setting instead: the sources a cloned repository cannot write.
const GATED_INSTEAD = `set them in the env of .claude/settings.local.json instead (a keep-warm time also with /${COMMAND})`

// Reads every level and resolves each setting, highest first: `env` of .claude/settings.local.json,
// `env` of .claude/settings.json, .ai-dlc/cache-keepalive.json, the default (settings.ts). Keep-alive
// has no /config rows, and the process environment is not read. The two committed sources, the env
// of .claude/settings.json and the repository file, set the trust-gated settings (settings.ts,
// TRUST_GATED) only in a folder Claude Code trusts; elsewhere each is skipped with a warning and the
// next level applies. Never throws: on an error, the defaults apply.
async function load($: EngineInterface) {
  const problems: string[] = []
  const levels: Level[] = []
  const trust: TrustCache = {}
  try {
    const root = await repoRoot($)
    for (const where of ['.claude/settings.local.json', '.claude/settings.json']) {
      const { env, problem } = settingsEnv(await readRaw($, `${root}/${where}`))
      if (problem) problems.push(`${where} ${problem}`)
      if (!env) continue
      const values = where === '.claude/settings.json' ? await trustGate($, env, gatedNames('env'), `the env of ${where}`, GATED_INSTEAD, problems, trust) : env
      levels.push({ where, by: 'env', values })
    }
    const repo = repoConfig(await readRaw($, `${root}/${REPO_FILE}`))
    if (repo.problem) problems.push(`${REPO_FILE} ${repo.problem}`)
    if (repo.values) levels.push({ where: REPO_FILE, by: 'json', values: await trustGate($, repo.values, gatedNames('json'), REPO_FILE, GATED_INSTEAD, problems, trust) })
  } catch (err) {
    problems.push(`settings files unreadable (${String(err)}); using the defaults`)
  }
  const r = resolveSettings(levels)
  settings = r.settings
  sources = r.sources
  for (const line of [...problems, ...r.warnings]) await warn($, line)
}

type Keep = { ms: number; from: string }

async function sessionOverrides($: EngineInterface, n: TrackName): Promise<[string, number][]> {
  const v = await $.store.get(sessionKey(n))
  return Array.isArray(v) ? v.filter((x): x is [string, number] => Array.isArray(x) && typeof x[0] === 'string' && typeof x[1] === 'number') : []
}

// The keep-warm time of a track: this session's override, the machine's, then the track's setting.
// An override shorter than minDuration (set before minDuration was raised) is ignored with a warning.
async function keepWarm($: EngineInterface, key: TrackKey): Promise<Keep> {
  const n = TRACKS.find(([, k]) => k === key)![0]
  const id = await $.session.id()
  const own = (await sessionOverrides($, n)).find(([s]) => s === id)
  if (own) {
    if (own[1] >= settings.minDuration) return { ms: own[1], from: `this session, /${COMMAND}` }
    await warn($, `the /${COMMAND} override of the ${n} track for this session (${formatDuration(own[1])}) is shorter than minDuration (${formatDuration(settings.minDuration)}); ignored`)
  }
  const machine = await $.store.get(machineKey(n))
  if (typeof machine === 'number' && machine > 0) {
    if (machine >= settings.minDuration) return { ms: machine, from: `this machine, /${COMMAND}` }
    await warn($, `the /${COMMAND} override of the ${n} track for this machine (${formatDuration(machine)}) is shorter than minDuration (${formatDuration(settings.minDuration)}); ignored`)
  }
  return { ms: settings[key].keepWarmFor, from: sources[`${key}.keepWarmFor`] ?? 'default' }
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

async function ping($: EngineInterface) {
  const r = await $.model.fork({ prompt: settings.pingPrompt })
  if (!('usage' in r)) return { ok: false, line: `no ping: ${r.reason}` }
  const u = r.usage
  context = u.cache_read_input_tokens + u.cache_creation_input_tokens + u.input_tokens
  const hit = u.cache_read_input_tokens / Math.max(context, 1)
  spent += cost(u, readMult(settings.readPrice, await $.session.model()))
  const of = Number.isFinite(budget) ? `of ${Math.round(budget)}` : '(no spend limit)'
  return { ok: hit > settings.hitThreshold, line: `cache read ${u.cache_read_input_tokens}/${context} (${Math.round(hit * 100)}%), spent ${Math.round(spent)} ${of} token-equivalents` }
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

const pingsOf = (t: Track) => `ping ${t.pings}/${settings[t.key].maxPings > 0 ? settings[t.key].maxPings : '∞'}`
const runningLine = (t: Track, keep: Keep, lead = '') =>
  `keepalive ${t.name}: ${lead}warm until ${until(t.warmUntil)}, ${pingsOf(t)}, keep warm ${formatDuration(keep.ms)}, stop by ${until(t.armedTime + keep.ms)}`

function end($: EngineInterface, t: Track, text: string) {
  stopTrack(t)
  t.line = `keepalive ${t.name}: ${text}`
  render($)
}

// One track's pings: each tick checks, in order, a timer that fired after the cache expired, the
// track's keep-warm time, then pings; a miss stops the track, a hit moves "warm until" on, and the
// track's ping limit or the shared spend limit stops it after that ping.
function arm($: EngineInterface, t: Track) {
  stopTrack(t)
  const armedAt = t.generation
  const cfg = settings[t.key]
  t.timer = $.clock.after(cfg.pingEvery, async () => {
    // A timer stopped since it was set must not touch the track: another may be armed by now
    if (t.generation !== armedAt) return
    t.timer = undefined
    try {
      // A timer that fires late (the machine slept) finds the cache gone, and a ping would only re-write it
      const now = await $.clock.now()
      if (t.generation !== armedAt) return
      if (now >= t.warmUntil) return end($, t, 'expired, stopped')
      const keep = await keepWarm($, t.key)
      if (t.generation !== armedAt) return
      // The n-th ping is due n × pingEvery after the turn ended, and goes out when that is within the
      // keep-warm time, the last one included (20 on the 5m track's hour; human decision D1). Counted
      // on that schedule, not the clock, so the seconds each ping takes never cost the last one.
      // A duration spent before the first ping needed none: the cache's own lifetime covered it.
      if ((t.pings + 1) * cfg.pingEvery > keep.ms) return end($, t, `${t.pings ? 'kept warm' : 'no ping needed for'} ${formatDuration(keep.ms)}, stopped, warm until ${until(t.warmUntil)}`)

      const { ok, line } = await ping($)
      if (t.generation !== armedAt) return
      $.ui.log(`keepalive ${t.name}: ${line}`, { to: 'debug' })
      if (!ok) return end($, t, 'missed, stopped')
      t.warmUntil = now + cfg.ttl
      t.pings++
      // Awaited, so a failure in it lands in the catch below
      if (spent >= budget) return await spendLimit($, t)
      if (cfg.maxPings > 0 && t.pings >= cfg.maxPings) return end($, t, `ping limit ${cfg.maxPings} reached, stopped, warm until ${until(t.warmUntil)}`)
      t.line = runningLine(t, keep)
      render($)
      return arm($, t)
    } catch (err) {
      // Logged even when the track was stopped meanwhile (the spend limit stops it before it fails)
      $.ui.log(`keepalive ${t.name}: ${err instanceof Error ? err.message : String(err)}`, { to: 'debug' })
      if (t.generation !== armedAt) return
      end($, t, 'error, stopped')
    }
  })
}

// The spend limit is shared: reaching it stops every track. compactOnCap compacts instead, when it pays.
async function spendLimit($: EngineInterface, t: Track) {
  for (const [n] of TRACKS) {
    const other = tracks[n]
    if (other !== t && other.timer === undefined) continue // off, or already stopped for its own reason
    stopTrack(other)
    other.line = `keepalive ${n}: spend limit reached, stopped, warm until ${until(other.warmUntil)}`
  }
  // The tracks are already stopped, so a store that cannot be read stops here too, and says so
  let pays = false
  try {
    pays = settings.compactOnCap && await compactPays($)
  } catch (err) {
    $.ui.log(`keepalive: could not tell whether compacting pays (${err instanceof Error ? err.message : String(err)}); not compacting`, { to: 'debug' })
  }
  if (!pays) return render($)
  t.line = `keepalive ${t.name}: compacting`
  render($)
  const result = await compact($)
  $.ui.log(`keepalive: ${result}`, { to: 'debug' })
  t.line = `keepalive ${t.name}: ${result.split(' (')[0]}`
  render($)
}

/** Stops every keep-alive timer before an automatic handoff's /clear, so no ping of the old session
 * runs into the new one, and says so on the status line. Answers whether a timer was running. */
export function stopForHandoff($: EngineInterface): boolean {
  const was = anyRunning()
  stopAll('handed off, stopped')
  lastSplit = undefined
  if (was) render($)
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
  if (!settings.enabled || !settings.status) return
  // No track runs during a turn (turn.start stops them), so the line stands alone until the turn's
  // Stop arms one; render() then shows it under the track lines.
  $.ui.status(seedLine)
}

export function registerKeepalive(on: Parameters<Register>[0], deps: KeepaliveDeps) {

  on('turn.start', async ($, e, next) => {
    stopAll()
    seedLine = undefined
    for (const [n] of TRACKS) tracks[n].line = `keepalive ${n}: off`
    if (!compacting) $.ui.status(undefined)
    return next(e)
  })

  // Arm only when background work will wake the session later. A Stop with none is the work being done.
  on('classic.Stop', async ($, e, next) => {
    try {
      if (compacting || deps.handingOff()) return next(e)
      const tasks = e.background_tasks?.length ?? 0
      if (!tasks) {
        if (anyRunning()) { stopAll('work done, stopped'); render($) }
        return next(e)
      }
      await load($)
      if (!settings.enabled) {
        stopAll()
        $.ui.status(undefined)
        return next(e)
      }
      const { context: ctx, rateLimits } = await $.session.usage()
      if (inOverage(rateLimits)) {
        stopAll()
        for (const [n] of TRACKS) tracks[n].line = `keepalive ${n}: off in overage`
        render($)
        return next(e)
      }
      const split = lastSplit ?? await transcriptSplit($, e.transcript_path)
      if (split) lastSplit = split
      const now = await $.clock.now()
      spent = 0
      budget = settings.budgetMultiplier > 0 ? settings.budgetMultiplier * (ctx.tokens ?? 0) : Infinity
      for (const [n, key] of TRACKS) {
        const t = tracks[n]
        stopTrack(t)
        if (!settings[key].enabled) { t.line = `keepalive ${n}: off (disabled)`; continue }
        if (!split) { t.line = `keepalive ${n}: off (no cache write seen yet, so the cache lifetime is unknown)`; continue }
        if (split[n] <= 0) { t.line = `keepalive ${n}: off`; t.warmUntil = 0; continue }
        t.armedTime = now
        t.pings = 0
        t.warmUntil = now + settings[key].ttl
        t.line = runningLine(t, await keepWarm($, key), `armed, ${tasks} task(s), `)
        arm($, t)
      }
      render($)
    } catch (err) {
      await log($, `keepalive: Stop error ${String(err)}`)
    }
    return next(e)
  })

  // Other sessions can push the account into overage during the wait
  on('session.measure', async ($, e, next) => {
    if (anyRunning() && e.changed.includes('rateLimits') && inOverage(e.rateLimits)) {
      stopAll('overage, stopped')
      render($)
    }
    return next(e)
  })

  // The session ended (exit, /clear, resume elsewhere): its timers must not ping the next one, and
  // nothing of its spend, its context or its warnings carries over. Module variables survive /clear.
  on('session.end', async ($, e, next) => {
    stopAll()
    lastSplit = undefined
    seedLine = undefined
    spent = 0
    budget = 0
    context = 0
    compacting = false
    // Each session warns about a setting problem once
    warned.clear()
    for (const [n] of TRACKS) tracks[n].line = `keepalive ${n}: off`
    $.ui.status(undefined)
    return next(e)
  })

  // /ai-dlc:cache-keepalive pings now (upstream). With a duration it sets the keep-warm time of both
  // tracks, or of the one --track names, and with clear it removes that override, in the default scope
  // or the one --session / --machine names.
  on('command.run', { command: COMMAND }, async ($, e) => {
    await load($)
    const args = parseCommandArgs(e.args ?? '', settings.scope, settings.minDuration)
    if (args.kind === 'usage') {
      const every = TRACKS.map(([n, key]) => `the ${n} track every ${formatDuration(settings[key].pingEvery)}`).join(' and ')
      return { text: `keepalive: ${args.problem}. Usage: /${COMMAND} [<n>m|<n>h|<n>d|clear] [--track 1h|5m|both] [--session|--machine]. A duration sets the keep-warm time of both tracks, or of the one --track names. Pings come on ${every}, so a duration no longer than a track's interval sends no ping on it: the cache's own lifetime covers it.` }
    }
    if (args.kind !== 'ping') {
      await setKeepWarm($, args.scope, args.kind === 'set' ? args.ms : undefined, args.tracks)
      const where = args.scope === 'machine' ? 'every session on this machine' : 'this session'
      const which = args.tracks.length === TRACK_NAMES.length ? 'both tracks' : `the ${args.tracks[0]} track`
      const what = args.kind === 'set' ? `set to ${formatDuration(args.ms)} on ${which} for ${where}` : `override cleared on ${which} for ${where}`
      return { text: `keepalive: keep-warm ${what}; now ${await keepLines($)}` }
    }
    if (!settings.enabled) return { text: `keepalive: off (enabled=false, ${sources.enabled ?? 'default'}); nothing pinged` }
    const { context: ctx } = await $.session.usage()
    if (!budget) budget = settings.budgetMultiplier > 0 ? settings.budgetMultiplier * (ctx.tokens ?? 0) : Infinity
    const { ok, line } = await ping($)
    return { text: `${ok ? 'HIT' : 'MISS'}: ${line}; ${await keepLines($)}` }
  })
}

/** The settings in force and where each came from. */
export const current = () => ({ settings, sources })
