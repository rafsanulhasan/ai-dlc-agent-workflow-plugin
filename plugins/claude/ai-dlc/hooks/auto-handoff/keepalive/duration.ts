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

export type CommandArgs =
  | { kind: 'ping' }
  | { kind: 'set'; ms: number; scope: Scope }
  | { kind: 'clear'; scope: Scope }
  | { kind: 'usage'; problem: string }

/** The words after `/ai-dlc:keepalive`: a duration or `clear`, and `--session` / `--machine` to pick
 * the scope for this call. `min`: the shortest duration accepted (minDuration). */
export function parseCommandArgs(args: string, defaultScope: Scope, min = MINUTE): CommandArgs {
  let scope = defaultScope
  let ms: number | undefined
  let clear = false
  for (const word of args.trim().split(/\s+/).filter(Boolean)) {
    const w = word.toLowerCase()
    const d = parseDuration(w, min)
    if (w === '--machine') scope = 'machine'
    else if (w === '--session') scope = 'session'
    else if (w === 'clear' || w === '--clear') clear = true
    else if (d !== undefined) {
      if (ms !== undefined) return { kind: 'usage', problem: 'give one duration' }
      ms = d
    }
    else return { kind: 'usage', problem: `"${word}" is not a duration (<n>m, <n>h, <n>d, at least ${formatDuration(Math.max(min, ABSOLUTE_MIN))}), clear, --session or --machine` }
  }
  if (clear && ms !== undefined) return { kind: 'usage', problem: 'give a duration or clear, not both' }
  if (clear) return { kind: 'clear', scope }
  if (ms !== undefined) return { kind: 'set', ms, scope }
  return { kind: 'ping' }
}
