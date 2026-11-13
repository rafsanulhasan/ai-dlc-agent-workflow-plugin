// Durations and the command's arguments. Added to the cache-keepalive mod's code while it was vendored (see
// ../ATTRIBUTION.md, "cache-keepalive"). Engine-free, so the tests and settings.ts read it directly.
// The defaults live in settings.ts alone (SETTINGS): no duration default is repeated here.

export const MINUTE = 60_000
const UNIT_MS: Record<string, number> = { m: MINUTE, h: 60 * MINUTE, d: 24 * 60 * MINUTE }
// The shortest duration that parses at all. minDuration (settings.ts) sets the shortest one accepted.
export const ABSOLUTE_MIN = 1_000

export type Scope = 'session' | 'machine'

/** `<n>m`, `<n>h` or `<n>d` (n may have a fraction: `1.5h`) in milliseconds; undefined for anything
 * else or for less than `min` (1 minute unless given). */
export function parseDuration(text: unknown, min = MINUTE): number | undefined {
  if (typeof text !== 'string') return undefined
  const m = /^\s*(\d+(?:\.\d+)?)\s*([mhd])\s*$/i.exec(text)
  if (!m) return undefined
  const ms = Math.round(Number(m[1]) * UNIT_MS[m[2]!.toLowerCase()]!)
  return Number.isFinite(ms) && ms >= Math.max(min, ABSOLUTE_MIN) ? ms : undefined
}

/** A duration in the largest unit that holds it whole: 8h, 2d, 90m; a part of a minute as 0.5m. */
export function formatDuration(ms: number): string {
  for (const unit of ['d', 'h'] as const) if (ms > 0 && ms % UNIT_MS[unit]! === 0) return `${ms / UNIT_MS[unit]!}${unit}`
  return ms % MINUTE === 0 ? `${ms / MINUTE}m` : `${Number((ms / MINUTE).toFixed(2))}m`
}

/** A cache lifetime, and the keep-alive track that keeps it warm. */
export type TrackName = '1h' | '5m'
export const TRACK_NAMES: readonly TrackName[] = ['1h', '5m']

/**
 * Live findings 3, point 6a (the human, 2026-10-26): `--for just-me|team|global` picks the settings file an `on`,
 * `off`, a keep-warm time or `clear` is written to: the env of .claude/settings.local.json, .claude/settings.json or
 * ~/.claude/settings.json. Not to be confused with `scope` (`--session` / `--machine`), where an override without
 * `--for` lives. With `--session`, the session wins: nothing is written and `--for` is ignored (`ignoredFor`, said in
 * the reply); with `--machine` it is refused.
 */
export type ForTarget = 'just-me' | 'team' | 'global'
export const FOR_TARGETS: readonly ForTarget[] = ['just-me', 'team', 'global']

export type CommandArgs =
  | { kind: 'ping' }
  | { kind: 'set'; ms: number; scope: Scope; tracks: TrackName[]; for?: ForTarget; ignoredFor?: ForTarget }
  | { kind: 'clear'; scope: Scope; tracks: TrackName[]; for?: ForTarget; ignoredFor?: ForTarget }
  // `on` / `off` (step 40): the master, or the tracks --track names. `local`: written to the env of
  // .claude/settings.local.json, which wins over .claude/settings.json and .ai-dlc/cache-keepalive.json;
  // `session`: with --session, this session's switches only, as the band's buttons set them.
  // Point 6a: `local` is `--for just-me` (the default); `team` and `global` the other files.
  | { kind: 'switch'; on: boolean; where: 'local' | 'team' | 'global' | 'session'; tracks?: TrackName[]; ignoredFor?: ForTarget }
  | { kind: 'usage'; problem: string }

/** `1h`, `5m` or `both` (any case) as the tracks it names; undefined for anything else. */
function tracksOf(word: string | undefined): TrackName[] | undefined {
  const w = word?.toLowerCase()
  if (w === 'both') return [...TRACK_NAMES]
  return w === '1h' || w === '5m' ? [w] : undefined
}

/** The words after `/ai-dlc:cache-keepalive-configure` (the bare `/ai-dlc:cache-keepalive` ignores its
 * arguments, live findings 3, points 5 and 7): a duration, `clear`, or `on` / `off` (the master, or the
 * tracks --track names); `--session` / `--machine` to pick the scope for this call, or `--for just-me|team|global`
 * to pick the settings file instead; and `--track 1h`, `--track 5m` or `--track both` (also `--track=5m`) to pick
 * the track whose keep-warm time it sets or clears, both when not given. `min`: the shortest duration
 * accepted (minDuration). Flags alone are `ping`, which the configure hook passes on to the configure skill. */
export function parseCommandArgs(args: string, defaultScope: Scope, min = MINUTE): CommandArgs {
  let scope = defaultScope
  let ms: number | undefined
  let clear = false
  let tracks: TrackName[] | undefined
  let turn: boolean | undefined
  let flag: Scope | undefined
  let target: ForTarget | undefined
  const words = args.trim().split(/\s+/).filter(Boolean)
  const badTrack = (v: string | undefined) => ({ kind: 'usage' as const, problem: v === undefined ? '--track needs 1h, 5m or both' : `"${v}" is not a track: --track takes 1h, 5m or both` })
  for (let i = 0; i < words.length; i++) {
    const word = words[i]!
    const w = word.toLowerCase()
    if (w === '--track' || w.startsWith('--track=')) {
      const value = w === '--track' ? words[++i] : word.slice('--track='.length)
      if (tracks !== undefined) return { kind: 'usage', problem: 'give --track once' }
      tracks = tracksOf(value)
      if (!tracks) return badTrack(value)
      continue
    }
    if (w === '--for' || w.startsWith('--for=')) {
      const value = (w === '--for' ? words[++i] : word.slice('--for='.length))?.toLowerCase()
      if (target !== undefined) return { kind: 'usage', problem: 'give --for once' }
      if (!FOR_TARGETS.includes(value as ForTarget)) return { kind: 'usage', problem: value === undefined ? '--for needs just-me, team or global' : `"${value}" is not a target: --for takes just-me, team or global` }
      target = value as ForTarget
      continue
    }
    const d = parseDuration(w, min)
    if (w === '--machine') { scope = 'machine'; flag = 'machine' }
    else if (w === '--session') { scope = 'session'; flag = 'session' }
    else if (w === 'on' || w === 'off') {
      if (turn !== undefined) return { kind: 'usage', problem: 'give on or off once' }
      turn = w === 'on'
    }
    else if (w === 'clear' || w === '--clear') clear = true
    else if (d !== undefined) {
      if (ms !== undefined) return { kind: 'usage', problem: 'give one duration' }
      ms = d
    }
    else return { kind: 'usage', problem: `"${word}" is not a duration (<n>m, <n>h, <n>d, at least ${formatDuration(Math.max(min, ABSOLUTE_MIN))}), clear, on, off, --session, --machine or --track` }
  }
  if (clear && ms !== undefined) return { kind: 'usage', problem: 'give a duration or clear, not both' }
  if (target !== undefined && flag === 'machine') return { kind: 'usage', problem: '--for writes a settings file and --machine sets this machine\'s override: give one of them' }
  // Point 6a: --session wins over --for: nothing is written, and the reply says --for was ignored.
  const ignored = target !== undefined && flag === 'session' ? { ignoredFor: target } : {}
  const forFile = target !== undefined && flag !== 'session' ? target : undefined
  if (turn !== undefined) {
    if (clear || ms !== undefined) return { kind: 'usage', problem: 'give on or off alone, without a duration or clear' }
    if (flag === 'machine') return { kind: 'usage', problem: 'on and off take --session, --for or no scope flag (then they are written to .claude/settings.local.json)' }
    const where = flag === 'session' ? 'session' : forFile === 'team' ? 'team' : forFile === 'global' ? 'global' : 'local'
    return { kind: 'switch', on: turn, where, ...(tracks ? { tracks } : {}), ...ignored }
  }
  const which = tracks ?? [...TRACK_NAMES]
  if (clear) return { kind: 'clear', scope, tracks: which, ...(forFile ? { for: forFile } : {}), ...ignored }
  if (ms !== undefined) return { kind: 'set', ms, scope, tracks: which, ...(forFile ? { for: forFile } : {}), ...ignored }
  if (target !== undefined) return { kind: 'usage', problem: '--for goes with on, off, a keep-warm time or clear' }
  return { kind: 'ping' }
}
