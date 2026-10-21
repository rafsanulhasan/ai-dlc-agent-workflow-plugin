// Local addition to the vendored mod (see VENDORED.md): the keep-warm duration. Engine-free, so the
// test reads it directly.

const MIN = 60_000
const UNIT_MS: Record<string, number> = { m: MIN, h: 60 * MIN, d: 24 * 60 * MIN }

export const DEFAULT_KEEP_WARM = '8h'
export const DEFAULT_KEEP_WARM_MS = 8 * 60 * MIN

export type Scope = 'session' | 'machine'

/** `<n>m`, `<n>h` or `<n>d` (n may have a fraction: `1.5h`) in milliseconds; undefined for anything else or for less than 1m. */
export function parseDuration(text: unknown): number | undefined {
  if (typeof text !== 'string') return undefined
  const m = /^\s*(\d+(?:\.\d+)?)\s*([mhd])\s*$/i.exec(text)
  if (!m) return undefined
  const ms = Math.round(Number(m[1]) * UNIT_MS[m[2]!.toLowerCase()]!)
  return Number.isFinite(ms) && ms >= MIN ? ms : undefined
}

/** A duration in the largest unit that holds it whole: 8h, 2d, 90m. */
export function formatDuration(ms: number): string {
  for (const unit of ['d', 'h'] as const) if (ms % UNIT_MS[unit]! === 0) return `${ms / UNIT_MS[unit]!}${unit}`
  return `${Math.round(ms / MIN)}m`
}

export type CommandArgs =
  | { kind: 'ping' }
  | { kind: 'set'; ms: number; scope: Scope }
  | { kind: 'clear'; scope: Scope }
  | { kind: 'usage'; problem: string }

/** The words after `/keepalive`: a duration or `clear`, and `--session` / `--machine` to pick the scope for this call. */
export function parseCommandArgs(args: string, defaultScope: Scope): CommandArgs {
  let scope = defaultScope
  let ms: number | undefined
  let clear = false
  for (const word of args.trim().split(/\s+/).filter(Boolean)) {
    const w = word.toLowerCase()
    const d = parseDuration(w)
    if (w === '--machine') scope = 'machine'
    else if (w === '--session') scope = 'session'
    else if (w === 'clear' || w === '--clear') clear = true
    else if (d !== undefined) {
      if (ms !== undefined) return { kind: 'usage', problem: 'give one duration' }
      ms = d
    }
    else return { kind: 'usage', problem: `"${word}" is not a duration (<n>m, <n>h, <n>d, at least 1m), clear, --session or --machine` }
  }
  if (clear && ms !== undefined) return { kind: 'usage', problem: 'give a duration or clear, not both' }
  if (clear) return { kind: 'clear', scope }
  if (ms !== undefined) return { kind: 'set', ms, scope }
  return { kind: 'ping' }
}
