// Keep-alive's settings: one table (SETTINGS) holds every key, its environment variable and its default;
// nothing else repeats a default. Engine-free: keepalive.ts reads the files and hands the levels in, and
// tests/ in the repository checks the table against the README and the cache-keepalive-configure skill's schema.
// Keep-alive has no /config rows (human decision, 2026-10-22, run AAW-20261022-cache-keepalive-init).
import { ABSOLUTE_MIN, formatDuration, parseDuration } from './duration.ts'
import type { Scope } from './duration.ts'
import { parseBool } from '../auto-handoff/config.ts'

export type TrackKey = 'oneHour' | 'fiveMinute'
export type TrackSettings = { enabled: boolean; ttl: number; pingEvery: number; keepWarmFor: number; maxPings: number }
export type PricePattern = { pattern: string; mult: number }
export type Settings = {
  enabled: boolean
  scope: Scope
  status: boolean
  pingPrompt: string
  hitThreshold: number
  overagePercent: number
  minDuration: number
  sessionOverridesMax: number
  oneHour: TrackSettings
  fiveMinute: TrackSettings
  budgetMultiplier: number
  compactOnCap: boolean
  compactInstructions: string
  writeMult: number
  outputMult: number
  readPrice: PricePattern[]
  compactCostGuess: number
  summaryRatioGuess: number
}

/** What a value must be. */
export type Kind = 'boolean' | 'scope' | 'text' | 'threshold' | 'percent' | 'minDuration' | 'duration' | 'whole' | 'positiveWhole' | 'nonNegative' | 'positive' | 'ratio' | 'prices'

/** A setting: its key in .ai-dlc/cache-keepalive.json (a dot is one nesting level), its environment
 * variable, its kind and its default, written as a person would write it. */
export type Setting = { key: string; env: string; kind: Kind; default: unknown }

export const ENV_PREFIX = 'AI_DLC_KEEPALIVE_'
const PING_PROMPT = 'Keep-alive ping. Reply with only: ok'
const COMPACT_INSTRUCTIONS = "Also keep the background tasks' IDs, output paths, and what to do when they finish."

// Order matters: minDuration comes before every duration, and each track's ttl before its pingEvery,
// because their rules read those values.
export const SETTINGS: readonly Setting[] = [
  { key: 'enabled', env: 'AI_DLC_KEEPALIVE_ENABLED', kind: 'boolean', default: true },
  { key: 'scope', env: 'AI_DLC_KEEPALIVE_SCOPE', kind: 'scope', default: 'session' },
  { key: 'status', env: 'AI_DLC_KEEPALIVE_STATUS', kind: 'boolean', default: true },
  { key: 'pingPrompt', env: 'AI_DLC_KEEPALIVE_PING_PROMPT', kind: 'text', default: PING_PROMPT },
  { key: 'hitThreshold', env: 'AI_DLC_KEEPALIVE_HIT_THRESHOLD', kind: 'threshold', default: 0.9 },
  { key: 'overagePercent', env: 'AI_DLC_KEEPALIVE_OVERAGE_PERCENT', kind: 'percent', default: 100 },
  { key: 'minDuration', env: 'AI_DLC_KEEPALIVE_MIN_DURATION', kind: 'minDuration', default: '1m' },
  { key: 'sessionOverridesMax', env: 'AI_DLC_KEEPALIVE_SESSION_OVERRIDES_MAX', kind: 'positiveWhole', default: 20 },
  { key: 'oneHour.enabled', env: 'AI_DLC_KEEPALIVE_1H_ENABLED', kind: 'boolean', default: true },
  { key: 'oneHour.ttl', env: 'AI_DLC_KEEPALIVE_1H_TTL', kind: 'duration', default: '60m' },
  { key: 'oneHour.pingEvery', env: 'AI_DLC_KEEPALIVE_1H_PING_EVERY', kind: 'duration', default: '50m' },
  { key: 'oneHour.keepWarmFor', env: 'AI_DLC_KEEPALIVE_1H_KEEP_WARM_FOR', kind: 'duration', default: '8h' },
  // The two ping limits are the pings each track's default keepWarmFor allows at its default pingEvery,
  // counted as keepalive.ts counts them (the one on the limit included): 8h / 50m = 9, 1h / 3m = 20.
  // tests/keepalive.test.ts pins them to those defaults. 0 ("no limit") is no longer valid (human, 2026-10-23).
  { key: 'oneHour.maxPings', env: 'AI_DLC_KEEPALIVE_1H_MAX_PINGS', kind: 'positiveWhole', default: 9 },
  { key: 'fiveMinute.enabled', env: 'AI_DLC_KEEPALIVE_5M_ENABLED', kind: 'boolean', default: true },
  { key: 'fiveMinute.ttl', env: 'AI_DLC_KEEPALIVE_5M_TTL', kind: 'duration', default: '5m' },
  { key: 'fiveMinute.pingEvery', env: 'AI_DLC_KEEPALIVE_5M_PING_EVERY', kind: 'duration', default: '3m' },
  { key: 'fiveMinute.keepWarmFor', env: 'AI_DLC_KEEPALIVE_5M_KEEP_WARM_FOR', kind: 'duration', default: '1h' },
  { key: 'fiveMinute.maxPings', env: 'AI_DLC_KEEPALIVE_5M_MAX_PINGS', kind: 'positiveWhole', default: 20 },
  { key: 'budgetMultiplier', env: 'AI_DLC_KEEPALIVE_BUDGET_MULTIPLIER', kind: 'nonNegative', default: 2 },
  { key: 'compactOnCap', env: 'AI_DLC_KEEPALIVE_COMPACT_ON_CAP', kind: 'boolean', default: false },
  { key: 'compactInstructions', env: 'AI_DLC_KEEPALIVE_COMPACT_INSTRUCTIONS', kind: 'text', default: COMPACT_INSTRUCTIONS },
  { key: 'writeMult', env: 'AI_DLC_KEEPALIVE_WRITE_MULT', kind: 'positive', default: 2 },
  { key: 'outputMult', env: 'AI_DLC_KEEPALIVE_OUTPUT_MULT', kind: 'positive', default: 5 },
  { key: 'readPrice', env: 'AI_DLC_KEEPALIVE_READ_PRICE', kind: 'prices', default: 'fable|mythos=0.025,opus[- ]?5[-. ]5=0.05,*=0.1' },
  { key: 'compactCostGuess', env: 'AI_DLC_KEEPALIVE_COMPACT_COST_GUESS', kind: 'positive', default: 0.6 },
  { key: 'summaryRatioGuess', env: 'AI_DLC_KEEPALIVE_SUMMARY_RATIO_GUESS', kind: 'ratio', default: 0.15 },
]

// The settings a cloned repository may set only in a folder Claude Code trusts, from either source it
// commits: .ai-dlc/cache-keepalive.json and the `env` of .claude/settings.json. They decide whether
// and how long the module spends the person's tokens and rate limit (enabled, the intervals, the
// keep-warm times, the ping limits, the spend limit and the prices it is counted in, compactOnCap),
// or are text it sends to the model (pingPrompt, compactInstructions). Human decision D2, 2026-10-22;
// writeMult, outputMult and readPrice added 2026-10-23, since a low price lifts the spend limit as
// surely as a high budgetMultiplier does.
export const TRUST_GATED: readonly string[] = [
  'enabled', 'pingPrompt',
  'oneHour.enabled', 'oneHour.pingEvery', 'oneHour.keepWarmFor', 'oneHour.maxPings',
  'fiveMinute.enabled', 'fiveMinute.pingEvery', 'fiveMinute.keepWarmFor', 'fiveMinute.maxPings',
  'budgetMultiplier', 'compactOnCap', 'compactInstructions',
  'writeMult', 'outputMult', 'readPrice',
]

/** The names the trust-gated settings go by in a level: their variables in an `env`, their keys in the repository file. */
export const gatedNames = (by: 'env' | 'json'): string[] =>
  SETTINGS.filter(s => TRUST_GATED.includes(s.key)).map(s => by === 'env' ? s.env : s.key)

/**
 * Whether a value differs from its setting's default, both read as the module reads them (a duration
 * in milliseconds, prices as their pairs), so `60m` equals `1h`. An invalid or unset value differs.
 */
export function differsFromDefault(s: Setting, raw: unknown, by: Level['by']): boolean {
  const mine = check(s.kind, raw, by, 0)
  if (mine === null || isInvalid(mine)) return true
  return JSON.stringify(mine) !== JSON.stringify(check(s.kind, s.default, 'json', 0))
}

/**
 * The trust-gated names in a level whose value differs from its default: the ones the trust gate skips
 * in a folder Claude Code does not trust. A gated value equal to its default changes nothing, so it is
 * neither skipped nor warned about; .ai-dlc/cache-keepalive.json holds every default since init writes
 * them (run AAW-20261023-keepalive-explicit-defaults).
 */
export function gatedDiffering(values: Record<string, unknown>, by: 'env' | 'json'): string[] {
  return SETTINGS.filter(s => TRUST_GATED.includes(s.key)).filter(s => {
    const r = rawOf({ where: '', by, values }, s)
    return r.has && differsFromDefault(s, r.raw, by)
  }).map(s => by === 'env' ? s.env : s.key)
}

/** One place values are read from, highest first. `by`: how a setting is named there. */
export type Level = { where: string; by: 'env' | 'json'; values: Record<string, unknown> }
export type Resolved = { settings: Settings; sources: Record<string, string>; warnings: string[] }

// Booleans parse as in the automatic handoff's settings (../auto-handoff/config.ts, parseBool).
// Numbers do not: these take fractions ("0.9"), which the handoff's whole-number settings refuse.
const NUMBER = /^\s*[0-9]+(\.[0-9]+)?\s*$/
const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && NUMBER.test(v) ? Number(v) : NaN
  return Number.isFinite(n) ? n : undefined
}

/** `pattern=multiplier` pairs separated by commas, one of them `*` (any other model); each pattern a
 * case-insensitive regular expression. Undefined when anything is off. */
export function parsePrices(text: unknown): PricePattern[] | undefined {
  if (typeof text !== 'string' || !text.trim()) return undefined
  const out: PricePattern[] = []
  for (const part of text.split(',')) {
    const at = part.lastIndexOf('=')
    if (at <= 0) return undefined
    const pattern = part.slice(0, at).trim()
    const mult = num(part.slice(at + 1))
    if (!pattern || mult === undefined) return undefined
    if (pattern !== '*') { try { new RegExp(pattern, 'i') } catch { return undefined } }
    out.push({ pattern, mult })
  }
  return out.filter(p => p.pattern === '*').length === 1 ? out : undefined
}

/** The cache-read price over the base input price for a model id: the first pattern that matches, else `*`. */
export function readMult(prices: readonly PricePattern[], model: string): number {
  for (const p of prices) if (p.pattern !== '*' && new RegExp(p.pattern, 'i').test(model)) return p.mult
  return prices.find(p => p.pattern === '*')?.mult ?? 1
}

/**
 * A raw value checked against its kind: the value, `null` when it is not set (missing; in an `env`, also
 * null or blank text), or `{ invalid }` with the reason (in the repository file, null is invalid). `minDuration`:
 * the shortest duration a `duration` may be.
 */
export function check(kind: Kind, raw: unknown, by: Level['by'], minDuration: number): unknown {
  const bad = (why: string) => ({ invalid: why })
  if (raw === undefined) return null
  // .ai-dlc/cache-keepalive.json holds a value for every key (run AAW-20261023-keepalive-explicit-
  // defaults): a null left there by hand is invalid, warned about once, and the next level applies.
  if (raw === null) return by === 'json' ? bad(NULL_IN_FILE) : null
  if (by === 'env' && typeof raw === 'string' && !raw.trim()) return null
  switch (kind) {
    case 'boolean': return parseBool(raw) ?? bad('not true or false')
    case 'scope': {
      const word = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
      return word === 'session' || word === 'machine' ? word : bad('not session or machine')
    }
    case 'text': return typeof raw === 'string' && raw.trim() ? raw.trim() : bad('blank or not text')
    case 'threshold': { const n = num(raw); return n !== undefined && n >= 0 && n < 1 ? n : bad('not a number from 0 up to, not including, 1') }
    case 'ratio': { const n = num(raw); return n !== undefined && n > 0 && n < 1 ? n : bad('not a number between 0 and 1') }
    case 'percent': { const n = num(raw); return n !== undefined && n >= 1 && n <= 100 ? n : bad('not a number from 1 to 100') }
    case 'nonNegative': { const n = num(raw); return n !== undefined && n >= 0 ? n : bad('not a number of 0 or more') }
    case 'positive': { const n = num(raw); return n !== undefined && n > 0 ? n : bad('not a number above 0') }
    case 'whole': { const n = num(raw); return n !== undefined && Number.isSafeInteger(n) && n >= 0 ? n : bad('not a whole number of 0 or more') }
    case 'positiveWhole': { const n = num(raw); return n !== undefined && Number.isSafeInteger(n) && n >= 1 ? n : bad('not a whole number of 1 or more') }
    case 'minDuration': { const ms = parseDuration(raw, ABSOLUTE_MIN); return ms ?? bad('not a duration (<n>m, <n>h or <n>d, at least 1 second)') }
    case 'duration': {
      const ms = parseDuration(raw, ABSOLUTE_MIN)
      if (ms === undefined) return bad('not a duration (<n>m, <n>h or <n>d)')
      return ms >= minDuration ? ms : bad(`shorter than minDuration (${formatDuration(minDuration)})`)
    }
    case 'prices': return parsePrices(raw) ?? bad('not pattern=multiplier pairs separated by commas, with exactly one *')
  }
}

/** Why a null in the repository file is ignored. */
export const NULL_IN_FILE = 'null: every key holds a value (run /ai-dlc:cache-keepalive-merge to write its default)'

const isInvalid = (v: unknown): v is { invalid: string } => !!v && typeof v === 'object' && !Array.isArray(v) && 'invalid' in v
const show = (v: unknown) => typeof v === 'string' ? JSON.stringify(v) : String(JSON.stringify(v))

/** A setting's raw value in a level: by its variable, or by its nested JSON key. */
function rawOf(level: Level, s: Setting): { has: boolean; raw: unknown; name: string } {
  if (level.by === 'env') return { has: Object.hasOwn(level.values, s.env), raw: level.values[s.env], name: s.env }
  let cur: unknown = level.values
  for (const part of s.key.split('.')) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur) || !Object.hasOwn(cur, part)) return { has: false, raw: undefined, name: s.key }
    cur = (cur as Record<string, unknown>)[part]
  }
  return { has: true, raw: cur, name: s.key }
}

function setIn(target: Record<string, unknown>, key: string, v: unknown) {
  const [head, tail] = key.split('.') as [string, string | undefined]
  if (tail === undefined) target[head] = v
  else (target[head] as Record<string, unknown>)[tail] = v
}
function getIn(target: Record<string, unknown>, key: string): unknown {
  const [head, tail] = key.split('.') as [string, string | undefined]
  return tail === undefined ? target[head] : (target[head] as Record<string, unknown>)[tail]
}

/** The rule a value must keep beyond its kind, read against the values resolved before it. */
function rule(key: string, v: unknown, soFar: Record<string, unknown>): string | undefined {
  const m = /^(oneHour|fiveMinute)\.pingEvery$/.exec(key)
  if (!m) return undefined
  const ttl = getIn(soFar, `${m[1]}.ttl`) as number
  return (v as number) < ttl ? undefined : `not shorter than ${m[1]}.ttl (${formatDuration(ttl)})`
}

const blank = (): Record<string, unknown> => ({ oneHour: {}, fiveMinute: {} })

/** The built-in defaults, from SETTINGS: the one defaults table. */
export function defaults(): Settings {
  const out = blank()
  for (const s of SETTINGS) setIn(out, s.key, check(s.kind, s.default, 'json', 0))
  return out as unknown as Settings
}

/**
 * Each setting from the first level that holds a valid value, highest first: the levels given (the
 * `env` of .claude/settings.local.json, the `env` of .claude/settings.json, then
 * .ai-dlc/cache-keepalive.json), then the default. A value that is set but invalid, or that breaks a rule (a duration
 * shorter than minDuration, a pingEvery not shorter than its track's ttl), is reported in `warnings`
 * and resolution falls through to the next level. Defaults are exempt from minDuration. When even the
 * default pingEvery is not shorter than a ttl set at some level, that ttl is dropped for its default too.
 */
export function resolveSettings(levels: readonly Level[]): Resolved {
  const out = blank()
  const sources: Record<string, string> = {}
  const warnings: string[] = []
  for (const s of SETTINGS) {
    const min = s.key === 'minDuration' ? 0 : (out.minDuration as number | undefined) ?? 0
    let found = false
    for (const level of levels) {
      const { has, raw, name } = rawOf(level, s)
      if (!has) continue
      const v = check(s.kind, raw, level.by, min)
      if (v === null) continue
      const why = isInvalid(v) ? v.invalid : rule(s.key, v, out)
      if (why !== undefined) {
        warnings.push(`${name}=${show(raw)} in ${level.where} ignored: ${why}; falling back to the next source`)
        continue
      }
      setIn(out, s.key, v)
      sources[s.key] = `${name} in ${level.where}`
      found = true
      break
    }
    if (found) continue
    const d = check(s.kind, s.default, 'json', 0)
    const why = rule(s.key, d, out)
    if (why !== undefined) {
      const ttlKey = s.key.replace('pingEvery', 'ttl')
      const ttlSetting = SETTINGS.find(x => x.key === ttlKey)!
      warnings.push(`${ttlKey} from ${sources[ttlKey]} ignored: no level sets a ${s.key} shorter than it, and the default (${formatDuration(d as number)}) is not; set ${s.key} too. Using the defaults for both`)
      setIn(out, ttlKey, check(ttlSetting.kind, ttlSetting.default, 'json', 0))
      sources[ttlKey] = 'default'
    }
    setIn(out, s.key, d)
    sources[s.key] = 'default'
  }
  return { settings: out as unknown as Settings, sources, warnings }
}
