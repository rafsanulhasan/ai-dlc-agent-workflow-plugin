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

export type CommandArgs =
  | { kind: 'ping' }
  | { kind: 'set'; ms: number; scope: Scope; tracks: TrackName[] }
  | { kind: 'clear'; scope: Scope; tracks: TrackName[] }
  | { kind: 'usage'; problem: string }

/** `1h`, `5m` or `both` (any case) as the tracks it names; undefined for anything else. */
function tracksOf(word: string | undefined): TrackName[] | undefined {
  const w = word?.toLowerCase()
  if (w === 'both') return [...TRACK_NAMES]
  return w === '1h' || w === '5m' ? [w] : undefined
}

/** The words after `/ai-dlc:cache-keepalive`: a duration or `clear`; `--session` / `--machine` to pick
 * the scope for this call; and `--track 1h`, `--track 5m` or `--track both` (also `--track=5m`) to pick
 * the track whose keep-warm time it sets or clears, both when not given. `min`: the shortest duration
 * accepted (minDuration). A flag alone changes nothing: the call pings. */
export function parseCommandArgs(args: string, defaultScope: Scope, min = MINUTE): CommandArgs {
  let scope = defaultScope
  let ms: number | undefined
  let clear = false
  let tracks: TrackName[] | undefined
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
    const d = parseDuration(w, min)
    if (w === '--machine') scope = 'machine'
    else if (w === '--session') scope = 'session'
    else if (w === 'clear' || w === '--clear') clear = true
    else if (d !== undefined) {
      if (ms !== undefined) return { kind: 'usage', problem: 'give one duration' }
      ms = d
    }
    else return { kind: 'usage', problem: `"${word}" is not a duration (<n>m, <n>h, <n>d, at least ${formatDuration(Math.max(min, ABSOLUTE_MIN))}), clear, --session, --machine or --track` }
  }
  if (clear && ms !== undefined) return { kind: 'usage', problem: 'give a duration or clear, not both' }
  const which = tracks ?? [...TRACK_NAMES]
  if (clear) return { kind: 'clear', scope, tracks: which }
  if (ms !== undefined) return { kind: 'set', ms, scope, tracks: which }
  return { kind: 'ping' }
}
