// ai-dlc-lens (from spike ITEM-027, rounds 1-6, steps 17 to 17.l5): pure helpers of the lens card and the workflow pane. No `$` here.
import type { LensAgent, LensBatch, LensDef, LensKeepaliveCycle, LensPending, LensRun, LensTask, LensView, LensWorkflows, Tokens } from '../types'
import { NO_IMAGES, SVG_CAP, avatarKey, imageInline, own, robotInline, robotOf } from './avatar'
import type { AvatarImage, ChartAvatars } from './avatar'

export const ZERO: Tokens = { in: 0, out: 0, cr: 0, cw: 0 }

/**
 * A drawing's guard: `draw()`, or, when it throws, `fail(err)` and then `fallback(err)`. The ToolUse
 * card falls back to the native row as the host drew it, a pane to one line naming the fault.
 */
export async function drawOr<T>(draw: () => Promise<T>, fallback: (err: unknown) => T, fail: (err: unknown) => void): Promise<T> {
  try {
    return await draw()
  } catch (err) {
    fail(err)
    return fallback(err)
  }
}

/**
 * A pane's fault as one red line naming the pane and the fault: drawn with the kit's Text (`viaKit`), or,
 * when that throws too (resolving the kit was what failed), as the plain Text element the kit would build.
 * Never throws.
 */
export function paneFault<T>(site: string, err: unknown, viaKit: (line: string) => T): T | { type: 'Text'; props: { color: string }; children: string[] } {
  const line = `lens: the ${site} could not be drawn (${String(err).slice(0, 200)})`
  try {
    return viaKit(line)
  } catch {
    return { type: 'Text', props: { color: 'red' }, children: [line] }
  }
}

export const addTokens = (a: Tokens, b: Tokens): Tokens => ({
  in: a.in + b.in,
  out: a.out + b.out,
  cr: a.cr + b.cr,
  cw: a.cw + b.cw,
})

/** `ModelUsage` (D:6605-6627) to Tokens; `input_tokens` is the uncached part. */
export const fromUsage = (u: {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}): Tokens => ({
  in: u.input_tokens,
  out: u.output_tokens,
  cr: u.cache_read_input_tokens,
  cw: u.cache_creation_input_tokens,
})

/** 950, 12.3K, 100K, 1M, 1.2M. */
export function fmtTokens(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '?'
  const trim = (x: number) => (Math.round(x * 10) / 10).toString()
  if (n < 1000) return String(Math.round(n))
  if (n < 999_950) return trim(n / 1000) + 'K'
  return trim(n / 1_000_000) + 'M'
}

/** `claude-opus-5-5` -> `opus/opus-5.5`; `claude-sonnet-4-5-20250929` -> `sonnet/sonnet-4.5`; an alias stays. */
export function fmtModel(id: string): string {
  if (id === '') return '?'
  const oneM = /\[1m\]/i.test(id)
  let s = id.replace(/\[1m\]/i, '').replace(/^claude-/, '').replace(/-\d{8}$/, '')
  if (!s.includes('-')) return s + (oneM ? '[1m]' : '')
  const family = s.split('-')[0] ?? s
  const m = /^([a-z]+)-(\d+)(?:-(\d+))?(.*)$/.exec(s)
  if (m) s = `${m[1]}-${m[2]}${m[3] !== undefined ? '.' + m[3] : ''}${m[4] ?? ''}`
  return `${family}/${s}${oneM ? '[1m]' : ''}`
}

/** `ai-dlc:agent-manager` -> `agent-manager` (the agent ID). */
export const roleOf = (type: string): string => type.replace(/^[^:]*:/, '')

/** `ai-dlc:agent-manager` -> `ai-dlc`; no plugin -> ''. */
export const pluginOf = (type: string): string => (type.includes(':') ? type.slice(0, type.indexOf(':')) : '')

/** `agent-manager` -> `Agent Manager`. */
export const titleCase = (role: string): string =>
  role
    .split(/[-_\s]+/)
    .filter(w => w !== '')
    .map(w => w[0]!.toUpperCase() + w.slice(1))
    .join(' ')

/** Words a role keeps in capitals, or spelled its own way (finding 1d.iii). */
const ROLE_WORDS: Record<string, string> = {
  sqa: 'SQA',
  qa: 'QA',
  pm: 'PM',
  po: 'PO',
  ui: 'UI',
  ux: 'UX',
  api: 'API',
  ci: 'CI',
  cd: 'CD',
  ai: 'AI',
  dlc: 'DLC',
  devops: 'DevOps',
}

/** The role in human-readable form: `sqa-engineer` -> `SQA Engineer`, `devops-engineer` -> `DevOps Engineer`. */
export const humanRole = (type: string): string =>
  roleOf(type)
    .split(/[-_\s]+/)
    .filter(w => w !== '')
    .map(w => own(ROLE_WORDS, w.toLowerCase()) ?? w[0]!.toUpperCase() + w.slice(1))
    .join(' ')

/** The roster table of the orchestrator's memory (`| agent-id | Name |`) as id -> name. */
export function parseRoster(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const m = /^\|\s*([a-z0-9][a-z0-9-]*)\s*\|\s*([^|]+?)\s*\|\s*$/.exec(line)
    if (m && m[1] !== 'agent' && !/^-+$/.test(m[2]!)) out[m[1]!] = m[2]!
  }
  return out
}

/** An agent definition's frontmatter `model:` and its `Persona name: **X**` line. */
export function parseDefinition(text: string): { model: string; persona: string } {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  const model = fm ? (/^model:\s*["']?([^"'\r\n#]+?)["']?\s*$/m.exec(fm[1]!)?.[1] ?? '') : ''
  const persona = /Persona name:\s*\*\*([^*]+)\*\*/.exec(text)?.[1]?.trim() ?? ''
  return { model: model.trim(), persona }
}

/**
 * The model line (finding 1d.ii): the definition's `model:` as written (an alias stays an alias,
 * a full id stays the id); `inherit` or none falls to the Agent call's `model`, then the session's.
 */
export function modelOf(def: LensDef | undefined, callModel: string, sessionModel: string): { text: string; source: string } {
  const m = def?.model ?? ''
  if (m !== '' && m !== 'inherit') return { text: m, source: `agent definition (${def!.path})` }
  const why = m === 'inherit' ? 'definition says inherit' : def ? 'definition names no model' : 'no agent definition'
  if (callModel !== '') return { text: callModel, source: `the orchestrator's Agent call (${why})` }
  if (sessionModel !== '') return { text: sessionModel, source: `the session's model (${why})` }
  return { text: '?', source: why }
}

/** The name line (finding 1d.i): the roster's persona name, else the definition's, else the role. */
export function personaOf(a: Pick<LensAgent, 'id' | 'name' | 'type'>, roster: Record<string, string>, def: LensDef | undefined): string {
  const id = roleOf(a.type)
  const fromRoster = id === '' ? undefined : own(roster, id)
  if (fromRoster) return fromRoster
  if (def && def.persona !== '') return def.persona
  if (a.name !== '') return a.name
  if (a.id === 'main' && a.type === '') return 'Main'
  return humanRole(a.type) || 'Agent'
}

/** The plain role, as before round 3: kept for the pane's dim lines. */
export const displayName = (a: Pick<LensAgent, 'id' | 'name' | 'type'>): string => {
  if (a.name !== '') return a.name
  if (a.id === 'main') return a.type === '' ? 'Main' : humanRole(a.type)
  return humanRole(a.type) || 'Agent'
}

/** `Kent Beck` -> `KB`; `Robert C. Martin (Uncle Bob)` -> `RM`: first and last word, parentheses dropped. */
export const initials = (name: string): string => {
  const words = name
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s+/)
    .filter(w => /^[A-Za-z]/.test(w))
  if (words.length === 0) return '?'
  const pick = words.length === 1 ? [words[0]!] : [words[0]!, words[words.length - 1]!]
  return pick.map(w => w[0]!.toUpperCase()).join('')
}

/** Context used, as the engine counts it for main (D:8021): input + cache read + cache write + output of the last response. */
export const contextUsed = (t: Tokens | null): number => (t === null ? 0 : t.in + t.cr + t.cw + t.out)

// ---- `.ai-dlc/model-metadata.json`, earlier `.ai-dlc/model-costing.json` (finding 4, addenda): read only ----

/** What the lens takes from one model's entry; `null` where the file has no figure. */
export type ModelFacts = {
  id: string
  input: number | null
  output: number | null
  cacheRead: number | null
  cacheWrite5m: number | null
  cacheWrite1h: number | null
  window: number | null
  longWindow: number | null
  /** Null unless a docs page or the Models API (`sources.modelsApi`) gives it (round 4: a null limit is not drawn). */
  maxInput: number | null
  maxOutput: number | null
  /** Round 5: the prices of a request whose prompt is over the threshold; null for a model priced flat. */
  long: LongPricing | null
}

/** The prices of one request, $ per million tokens; null where the file has no figure. */
export type Prices = { input: number | null; output: number | null; cacheRead: number | null; cacheWrite5m: number | null; cacheWrite1h: number | null }

/** `longContextPricing`: its prices and its `thresholdTokens` (null when the page names none). */
export type LongPricing = Prices & { threshold: number | null }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Every numeric leaf of an entry, keyed by its path with the separators dropped (`pricing.cacheWrite5m` -> `pricingcachewrite5m`). */
function leaves(v: unknown, path = '', out: [string, number][] = []): [string, number][] {
  if (typeof v === 'number' && Number.isFinite(v)) out.push([norm(path), v])
  else if (v !== null && typeof v === 'object' && !Array.isArray(v)) for (const [k, x] of Object.entries(v as Record<string, unknown>)) leaves(x, path + '.' + k, out)
  return out
}

const first = (ls: [string, number][], ok: (k: string) => boolean): number | null => ls.find(([k]) => ok(k))?.[1] ?? null

const isTokens = (k: string) => /token|window|max|context|threshold/.test(k)

/** The five prices among an entry's leaves; `long` false leaves the long-context ones out. */
function pricesOf(ls: [string, number][], long: boolean): Prices {
  const flat = (k: string) => long || !/long/.test(k)
  return {
    cacheRead: first(ls, k => /cache.*(read|hit)|(read|hit).*cache/.test(k) && !isTokens(k) && flat(k)),
    cacheWrite5m: first(ls, k => /(cache.*(write|creation)|write.*cache).*5m|5m.*(write|creation)/.test(k) && !isTokens(k) && flat(k)),
    cacheWrite1h: first(ls, k => /(cache.*(write|creation)|write.*cache).*1h|1h.*(write|creation)/.test(k) && !isTokens(k) && flat(k)),
    input: first(ls, k => /input/.test(k) && !/cache|batch|fast/.test(k) && !isTokens(k) && flat(k)),
    output: first(ls, k => /output/.test(k) && !/batch|fast/.test(k) && !isTokens(k) && flat(k)),
  }
}

/** The entry's `longContextPricing` object (any key naming long-context prices); null when absent or null. */
function longPricingOf(entry: unknown): LongPricing | null {
  if (entry === null || typeof entry !== 'object') return null
  const hit = Object.entries(entry as Record<string, unknown>).find(([k]) => /long.*pric|pric.*long/i.test(k))
  const v = hit?.[1]
  if (v === null || v === undefined || typeof v !== 'object' || Array.isArray(v)) return null
  const ls = leaves(v)
  return { ...pricesOf(ls, true), threshold: first(ls, k => /threshold/.test(k)) }
}

/**
 * One entry's facts. The keys are matched by name, not position (the file had other names before
 * `.ai-dlc/model-metadata.schema.json` landed): prices are $ per million tokens.
 */
export function factsOf(id: string, entry: unknown): ModelFacts {
  const ls = leaves(entry)
  return {
    id,
    ...pricesOf(ls, false),
    window: first(ls, k => /window/.test(k) && !/long|1m|extended/.test(k)),
    longWindow: first(ls, k => /window/.test(k) && /long|1m|extended/.test(k)),
    maxInput: first(ls, k => /max.*input|input.*max/.test(k)),
    maxOutput: first(ls, k => /max.*output|output.*max/.test(k)),
    long: longPricingOf(entry),
  }
}

/** The file's `longContextThresholdTokensOverride` (model-metadata.schema.json): a positive number, else null (round 6: that key only). */
export function thresholdOverrideOf(json: unknown): number | null {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) return null
  const v = (json as Record<string, unknown>).longContextThresholdTokensOverride
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null
}

/** The entries of the file: `models` as an array (`id`, `aliases`) or an object keyed by id; else the root. */
function entries(json: unknown): { id: string; aliases: string[]; entry: unknown }[] {
  const root = json !== null && typeof json === 'object' && 'models' in (json as object) ? (json as Record<string, unknown>).models : json
  const out: { id: string; aliases: string[]; entry: unknown }[] = []
  const add = (id: unknown, e: unknown) => {
    if (e === null || typeof e !== 'object') return
    const o = e as Record<string, unknown>
    const name = typeof o.id === 'string' ? o.id : typeof o.model === 'string' ? o.model : typeof id === 'string' ? id : ''
    if (name === '') return
    const aliases = Array.isArray(o.aliases) ? o.aliases.filter((x): x is string => typeof x === 'string') : []
    out.push({ id: name, aliases, entry: e })
  }
  if (Array.isArray(root)) root.forEach(e => add(undefined, e))
  else if (root !== null && typeof root === 'object') for (const [k, e] of Object.entries(root as Record<string, unknown>)) add(k, e)
  return out
}

/** The facts of `model` (a resolved id such as `claude-sonnet-5-5[1m]`, or an alias), or null when the file has none. */
export function lookupModel(json: unknown, model: string): ModelFacts | null {
  if (model === '') return null
  const bare = (s: string) => s.toLowerCase().replace(/\[1m\]/g, '').replace(/-\d{8}$/, '')
  const want = bare(model)
  const all = entries(json)
  const hit = all.find(e => bare(e.id) === want || e.aliases.some(a => bare(a) === want))
  return hit ? factsOf(hit.id, hit.entry) : null
}

/** The costing file as the lens holds it: its raw text, or why there is none. */
export type Costing = { path: string; text: string; error: string }

export function parseCosting(c: Costing): unknown {
  if (c.text === '') return null
  try {
    return JSON.parse(c.text)
  } catch {
    return null
  }
}

/** The file and the model's facts a cost needs, or why there are none (`—`). Shared by every cost below (round 6). */
function resolveCosting(c: Costing, model: string): { ok: true; json: unknown; f: ModelFacts } | { ok: false; source: string } {
  if (c.text === '') return { ok: false, source: c.error !== '' ? c.error : `${c.path} not found` }
  const json = parseCosting(c)
  if (json === null) return { ok: false, source: `${c.path} is not valid JSON` }
  const f = lookupModel(json, model)
  if (f === null) return { ok: false, source: `${model || 'the model'} is not in ${c.path}` }
  return { ok: true, json, f }
}

/** One request (or one total) at one set of prices, and the prices its tokens need that the file lacks. */
function priceAt(p: Prices, t: Tokens, w: '5m' | '1h'): { usd: number; missing: string[] } {
  const need: [number | null, number, string][] = [
    [p.input, t.in, 'input'],
    [p.output, t.out, 'output'],
    [p.cacheRead, t.cr, 'cache read'],
    [w === '1h' ? p.cacheWrite1h : p.cacheWrite5m, t.cw, `cache write ${w}`],
  ]
  return { usd: need.reduce((s, [x, n]) => s + (x ?? 0) * n, 0) / 1_000_000, missing: need.filter(([x, n]) => x === null && n > 0).map(([, , k]) => k) }
}

const usdText = (usd: number): string => `$${usd.toFixed(usd < 1 ? 4 : 2)}`
const rateOf = (rate: string): '5m' | '1h' => (rate === '1h' ? '1h' : '5m')
const rateWords = (w: '5m' | '1h'): string => (w === '1h' ? '1-hour' : '5-minute')

/**
 * Cost from the file's prices only (finding 4): never estimated, `—` when the file, the model or a
 * needed price is missing. Cache writes are priced at the 5-minute rate: `ModelUsage` does not say
 * the TTL (D:6605-6627), so the label says so.
 */
export function costOf(c: Costing, model: string, t: Tokens, rate: string = '5m'): { text: string; source: string } {
  const r = resolveCosting(c, model)
  if (!r.ok) return { text: '—', source: r.source }
  const w = rateOf(rate)
  const p = priceAt(r.f, t, w)
  if (p.missing.length > 0) return { text: '—', source: `${c.path} has no ${p.missing.join(', ')} price for ${r.f.id}` }
  return { text: usdText(p.usd), source: `${c.path} (${r.f.id}; cache writes at the ${rateWords(w)} rate: the usage does not say the TTL)` }
}

/** A request's prompt as the long-context rule counts it: all input tokens, cache reads and writes included. */
export const promptTokens = (t: Tokens): number => t.in + t.cr + t.cw

/** The long-context prices and the threshold they start at, and where the threshold came from. */
type LongRule = { prices: LongPricing; threshold: number; from: string }

/**
 * Round 5: the long-context rule of a model. Null for a model priced flat; a string (why) when the
 * model has long-context prices but no threshold is given. The threshold is the lens setting
 * (`longContextThresholdTokens`, when given), else the file's `longContextThresholdTokensOverride`,
 * else the model's `longContextPricing.thresholdTokens`. Round 6: the long prices travel with their
 * threshold, so a request over it never needs `f.long!`.
 */
function longRuleOf(c: Costing, f: ModelFacts, json: unknown, lensThreshold: number | null): LongRule | null | string {
  if (f.long === null) return null
  const fileOverride = thresholdOverrideOf(json)
  if (lensThreshold !== null && lensThreshold > 0) return { prices: f.long, threshold: lensThreshold, from: 'the lens setting longContextThresholdTokens' }
  if (fileOverride !== null) return { prices: f.long, threshold: fileOverride, from: `${c.path} longContextThresholdTokensOverride` }
  if (f.long.threshold !== null) return { prices: f.long, threshold: f.long.threshold, from: `${f.id} longContextPricing.thresholdTokens` }
  return `${f.id} has long-context prices but ${c.path} gives no threshold`
}

/**
 * Round 5: cost per request (each `turn.step` usage), with long-context pricing. For a model whose
 * `longContextPricing` is not null the threshold is the lens setting (`longContextThresholdTokens`,
 * when given), else the file's `longContextThresholdTokensOverride`, else the model's
 * `longContextPricing.thresholdTokens`. A request whose prompt is over it pays the long-context prices
 * for all its tokens; any other the flat ones. No threshold at all: `—`, never a guess.
 */
export function costOfRequests(
  c: Costing,
  model: string,
  reqs: readonly Tokens[],
  rate: string = '5m',
  lensThreshold: number | null = null,
): { text: string; source: string; long: number } {
  const none = (source: string) => ({ text: '—', source, long: 0 })
  const r = resolveCosting(c, model)
  if (!r.ok) return none(r.source)
  const f = r.f
  const rule = longRuleOf(c, f, r.json, lensThreshold)
  if (typeof rule === 'string') return none(rule)
  const w = rateOf(rate)
  let usd = 0
  let long = 0
  for (const t of reqs) {
    const longPrices = rule !== null && promptTokens(t) > rule.threshold ? rule.prices : null
    const p = priceAt(longPrices ?? f, t, w)
    if (p.missing.length > 0) return none(`${c.path} has no ${longPrices ? 'long-context ' : ''}${p.missing.join(', ')} price for ${f.id}`)
    if (longPrices) long += 1
    usd += p.usd
  }
  const said = rule === null ? 'flat prices' : `long-context over ${rule.threshold} prompt tokens (${rule.from}): ${long} of ${reqs.length} requests`
  return { text: usdText(usd), source: `${c.path} (${f.id}; ${said}; cache writes at the ${rateWords(w)} rate)`, long }
}

/** The requests an agent keeps for its cost (round 6: capped; past the cap a long-context model's cost is partial). */
export const REQS_CAP = 500

const sameTokens = (a: Tokens, b: Tokens): boolean => a.in === b.in && a.out === b.out && a.cr === b.cr && a.cw === b.cw

/**
 * An agent's cost (round 6). A model priced flat: from the totals, exact whatever was seen per request.
 * A model priced by prompt length: per request, and only when the requests seen add up to the loop's
 * totals; otherwise `—` and `partial` (a hook missed steps, a respawn, or more than REQS_CAP requests),
 * never an undercount.
 */
export function costOfAgent(
  c: Costing,
  model: string,
  reqs: readonly Tokens[],
  totals: Tokens,
  rate: string = '5m',
  lensThreshold: number | null = null,
): { text: string; source: string; long: number; partial: boolean } {
  const r = resolveCosting(c, model)
  if (r.ok && r.f.long !== null) {
    if (reqs.length === 0 || !sameTokens(reqs.reduce(addTokens, ZERO), totals))
      return { text: '—', source: `${r.f.id} is priced by prompt length and the ${reqs.length} requests seen do not add up to the loop's totals`, long: 0, partial: reqs.length > 0 }
    return { ...costOfRequests(c, model, reqs, rate, lensThreshold), partial: false }
  }
  return { ...costOf(c, model, totals, rate), long: 0, partial: false }
}

/**
 * A subagent's context window (addendum): the costing file by model (its long-context window for a
 * `[1m]` model), else the main session's window when it runs main's model, else unknown (`—`).
 */
export function windowOf(c: Costing, model: string, mainModel: string, mainWindow: number, fallback: string = 'main'): { n: number | null; source: string } {
  const json = parseCosting(c)
  const f = json === null ? null : lookupModel(json, model)
  if (f !== null) {
    if (/\[1m\]/i.test(model) && f.longWindow !== null) return { n: f.longWindow, source: `${c.path} (${f.id}, long context)` }
    if (f.window !== null) return { n: f.window, source: `${c.path} (${f.id})` }
  }
  if (fallback === 'main' && model !== '' && model === mainModel && mainWindow > 0) return { n: mainWindow, source: "the main session's window (same model)" }
  return { n: null, source: c.text === '' ? `${c.error || c.path + ' not found'}; not main's model` : `${model || 'the model'} not in ${c.path} and not main's model` }
}

/** Kept for round-1 callers: `[1m]` says 1M, main's model takes main's window, else unknown. */
export function windowFor(model: string, mainModel: string, mainWindow: number): { n: number | null; how: string } {
  if (/\[1m\]/i.test(model)) return { n: 1_000_000, how: '[1m] in the model id' }
  if (model !== '' && model === mainModel && mainWindow > 0) return { n: mainWindow, how: 'same model as main' }
  return { n: null, how: 'unknown' }
}

/** The record path in a brief: on its first line (AGENTS.md Run Loop step 8), else anywhere in it. */
export function matchHandoff(prompt: string): { path: string; how: string } | null {
  const re = /[A-Za-z0-9_.:/\\-]*[A-Za-z0-9_-]\.handoff\.md/
  const firstLine = prompt.split(/\r?\n/, 1)[0] ?? ''
  const a = re.exec(firstLine)
  if (a) return { path: a[0].replace(/\\/g, '/'), how: 'first line' }
  const b = re.exec(prompt)
  if (b) return { path: b[0].replace(/\\/g, '/'), how: 'body' }
  return null
}

/** `docs/handoffs/R/17-orchestrator-to-agent-manager.handoff.md` -> its folder, step code, sender and receiver. */
export function parseRecord(path: string): { dir: string; file: string; code: string; from: string; to: string } | null {
  const slash = path.lastIndexOf('/')
  const dir = slash < 0 ? '.' : path.slice(0, slash)
  const file = path.slice(slash + 1)
  // Step 1.6.1.l3: any mix of sub-steps and loop rounds, as run.md rows take them (`STEP_CODE`): the real
  // record `1.6.1.l2.1-orchestrator-to-agent-manager.handoff.md` gave no folder before, so no run key.
  const m = /^(\d+(?:\.(?:\d+|l\d+))*)-(.+?)-to-(.+)\.handoff\.md$/.exec(file)
  if (!m) return null
  return { dir, file, code: m[1]!, from: m[2]!, to: m[3]! }
}

/** The hand-back with the same step code and the agents swapped; else any hand-back of that code. */
export function pickHandback(names: readonly string[], rec: { code: string; from: string; to: string }): string | null {
  const exact = `${rec.code}-${rec.to}-to-${rec.from}.handback.md`
  if (names.includes(exact)) return exact
  return names.find(n => n.startsWith(rec.code + '-') && n.endsWith('.handback.md')) ?? null
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

/** What the chart says about one agent (finding 1a, 1d): name, model, role; no figures. */
export type ChartLabel = { name: string; model: string; role: string }

/** Only `running` blinks (finding 6): a call not yet started, or an agent that ended, is steady. */
export const isRunning = (status: string): boolean => status === 'running'

/** Step 8.6.1: a step drawn from its records only, whose handoff has no hand-back on disk: steady and grey, like a call not started. */
export const OPEN = 'open'

export type Placed = { id: string; x: number; y: number; depth: number }

/**
 * The chart's sizes, row cap and blink (lens settings `chartColumnPx`, `chartRowPx`, `chartAvatarsPerRow`,
 * `avatarRadiusPx`, `blink`, `blinkMs`). `perRow`, addendum L1, a setting since step 27.2: the most avatars one
 * row holds. A level with more (a run whose orchestrator spawned 23 agents drew a 2640 x 182 chart, shrunk to an
 * unreadable strip in the pane) wraps onto further rows.
 */
export type ChartSize = { col: number; row: number; perRow: number; r: number; blink: boolean; blinkMs: number }
/** Round 3 defaults (finding 1a: smaller than round 2's 200 x 210); `perRow` is the setting's default, 8. */
export const SIZE0: ChartSize = { col: 120, row: 96, perRow: 8, r: 14, blink: true, blinkMs: 1000 }

/**
 * Tree layout: the top agent first, each level below its spawner's. A level of more than `size.perRow` agents
 * wraps onto further rows, in order, so a chart stays at most `size.perRow` columns wide.
 */
export function layout(order: readonly string[], agents: Record<string, LensAgent>, size: ChartSize = SIZE0): { placed: Placed[]; width: number; height: number } {
  const depthOf = (id: string): number => {
    let d = 0
    let cur = agents[id]
    const seen = new Set<string>()
    while (cur && cur.parent !== null && agents[cur.parent] && !seen.has(cur.id)) {
      seen.add(cur.id)
      cur = agents[cur.parent]
      d += 1
    }
    return d
  }
  const levels: string[][] = []
  for (const id of order) {
    if (!agents[id]) continue
    const d = depthOf(id)
    ;(levels[d] ??= []).push(id)
  }
  const max = Math.max(1, Math.floor(size.perRow))
  const widest = Math.min(max, Math.max(1, ...levels.map(l => (l ?? []).length)))
  const width = widest * size.col
  const placed: Placed[] = []
  let row = 0
  levels.forEach((ids, depth) => {
    const all = ids ?? []
    for (let start = 0; start < all.length; start += max, row++) {
      const chunk = all.slice(start, start + max)
      const n = chunk.length
      chunk.forEach((id, i) => placed.push({ id, depth, x: Math.round((width / n) * (i + 0.5)), y: size.r + 8 + row * size.row }))
    }
    if (all.length === 0) row++
  })
  return { placed, width, height: Math.max(1, row) * size.row - 10 }
}

/** A chart as drawn: its Svg, the agents whose image was left out to stay under SVG_CAP, and whether it is still over. */
export type Flowchart = { source: string; width: number; height: number; dropped: string[]; tooLarge: boolean }

/**
 * The flowchart: one avatar per agent (avatar.ts: robot, image or initials badge, by `av.style`),
 * three lines under it (name, model, role), an arrow per spawn; a loop's arrow has a head at each
 * end. No ctx, tokens or cache. When the Svg would pass SVG_CAP (one oversize source refuses the
 * whole pane, spike 029 E2), images are left out, largest first, and named in `dropped`; when it is
 * over even without them, `tooLarge` is set and the caller draws something else.
 */
export function flowchartSvg(
  order: readonly string[],
  agents: Record<string, LensAgent>,
  label: (a: LensAgent) => ChartLabel,
  size: ChartSize = SIZE0,
  av: ChartAvatars = NO_IMAGES,
): Flowchart {
  const keys = new Map<string, AvatarImage>()
  if (av.style !== 'initials')
    for (const id of order) {
      const a = agents[id]
      if (!a) continue
      const k = avatarKey(a.type)
      const img = keys.has(k) ? undefined : av.image(k)
      if (img) keys.set(k, img)
    }
  const dropped: string[] = []
  for (;;) {
    const drawn = drawChart(order, agents, label, size, av.style, keys)
    if (drawn.source.length <= SVG_CAP || keys.size === 0) return { ...drawn, dropped, tooLarge: drawn.source.length > SVG_CAP }
    // Largest total first: an image counts once per node that draws it.
    const uses = (k: string) => order.filter(id => agents[id] && avatarKey(agents[id]!.type) === k).length
    const largest = [...keys.entries()].sort((x, y) => y[1].uri.length * uses(y[0]) - x[1].uri.length * uses(x[0]))[0]![0]
    keys.delete(largest)
    dropped.push(largest)
  }
}

function drawChart(
  order: readonly string[],
  agents: Record<string, LensAgent>,
  label: (a: LensAgent) => ChartLabel,
  size: ChartSize,
  style: string,
  images: ReadonlyMap<string, AvatarImage>,
): { source: string; width: number; height: number } {
  const { placed, width, height } = layout(order, agents, size)
  const at = new Map(placed.map(p => [p.id, p] as const))
  const R = size.r
  const parts: string[] = []
  // Each robot and image is drawn inline at its node: no <symbol>, <use> or <clipPath>, whose survival of
  // a surface's Svg scrub is unproven (the chart went blank in VS Code with them, run AAW-20261023 step 1.2).
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" font-family="sans-serif">`,
    `<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#78909c"/></marker></defs>`,
  )
  for (const p of placed) {
    const a = agents[p.id]!
    const from = a.parent !== null ? at.get(a.parent) : undefined
    if (!from) continue
    const x1 = from.x
    const y1 = from.y + R + 40
    const x2 = p.x
    const y2 = p.y - R - 3
    const ends = a.loop ? ' marker-start="url(#a)" marker-end="url(#a)"' : ' marker-end="url(#a)"'
    parts.push(`<path d="M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}" fill="none" stroke="#78909c" stroke-width="1.5"${ends}><title>${esc(a.handoff ?? 'no handoff record: the arrow panel shows the prompt')}</title></path>`)
  }
  for (const p of placed) {
    const a = agents[p.id]!
    const l = label(a)
    const fill = a.status === 'failed' || a.status === 'killed' ? '#c62828' : a.status === 'waiting' ? '#f9a825' : a.status === 'pending' || a.status === OPEN ? '#90a4ae' : '#2e7d32'
    const title = `<title>${esc(l.name)}: ${esc(a.status)}</title>`
    const blink = size.blink && isRunning(a.status) ? `<animate attributeName="opacity" values="1;0.25;1" dur="${size.blinkMs / 1000}s" repeatCount="indefinite"/>` : ''
    const k = avatarKey(a.type)
    const img = images.get(k)
    if (img === undefined && style !== 'robot') {
      // The initials badge (style `initials`, or `image` with no image): a disc in the status colour.
      parts.push(
        `<circle cx="${p.x}" cy="${p.y}" r="${R}" fill="${fill}">${title}${blink}</circle>`,
        // Round 5: the initials centred in the avatar both ways (middle anchor, central baseline at the circle's centre).
        `<text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="bold" fill="#fff">${esc(initials(l.name))}</text>`,
      )
    } else {
      // A robot or an image on a light disc; the status colour is the ring, and the ring blinks.
      const d = 2 * R - 6
      parts.push(
        `<circle cx="${p.x}" cy="${p.y}" r="${R}" fill="#eceff1" stroke="${fill}" stroke-width="3">${title}${blink}</circle>`,
        img !== undefined ? imageInline(img.uri, p.x - d / 2, p.y - d / 2, d) : robotInline(robotOf(k), p.x - d / 2, p.y - d / 2, d),
      )
    }
    ;[l.name, l.model, l.role].forEach((t, i) =>
      // Round 6: the label lines keep the alphabetic baseline their offsets were set for; only the initials are centred.
      parts.push(`<text x="${p.x}" y="${p.y + R + 13 + i * 12}" text-anchor="middle" font-size="${i === 0 ? 10.5 : 9.5}"${i === 0 ? ' font-weight="bold"' : ''} fill="#90a4ae">${esc(clip(t, 22))}</text>`),
    )
  }
  parts.push('</svg>')
  return { source: parts.join(''), width, height }
}

/**
 * Finding 1b: the chart is drawn in full when the row is wide enough for it, else a one-line chip
 * with an "Open flowchart" Button. `columns` is the render site's `viewport.columns` (cells,
 * D:10957-10962); a cell is taken as 8 CSS px (an assumption: no API gives the cell width).
 * With no viewport the chart is drawn in full: `Svg` shrinks to its slot on its own (D:13099-13105).
 */
export function showChart(mode: string, chartWidth: number, columns: number | undefined, breakpointColumns: number, cellPx: number): boolean {
  if (mode === 'chart') return true
  if (mode === 'button') return false
  if (columns === undefined || columns <= 0) return true
  const need = breakpointColumns > 0 ? breakpointColumns : Math.ceil(chartWidth / cellPx)
  return columns >= need
}

/**
 * Merge a stop-time `background_tasks` list into an agent's tasks (E7): the listed ones as listed;
 * one started by a tool call (`backgroundTaskId`) and no longer listed is `ended`; `agent.list` rows stay.
 */
export function mergeStopTasks(bg: readonly LensTask[], stop: readonly LensTask[]): LensTask[] {
  const listed = new Set(stop.map(t => t.id))
  const kept = bg.filter(t => t.source === 'agent.list')
  const started = bg
    .filter(t => t.source === 'tool.call' && !listed.has(t.id))
    .map(t => ({ ...t, status: t.status === 'running' ? 'ended' : t.status }))
  return uniqueTasks([...kept, ...started, ...stop])
}

/**
 * Step 1.6.1 (the background-task bug): one entry per task id. A subagent is listed live by
 * `$.agent.list()` and again in a Stop's `background_tasks`, so the same id came twice: two entries
 * sharing one open key and one Button key, which a surface cannot tell apart (ButtonProps.key, d.ts:1094-1101).
 * The first entry wins (the live list comes first); a later one only fills what the first lacks.
 * Entries without an id are kept as they are.
 */
export function uniqueTasks(tasks: readonly LensTask[]): LensTask[] {
  const out: LensTask[] = []
  const at = new Map<string, number>()
  for (const t of tasks) {
    const i = t.id === '' ? undefined : at.get(t.id)
    if (i === undefined) {
      if (t.id !== '') at.set(t.id, out.length)
      out.push(t)
      continue
    }
    const cur = out[i]!
    out[i] = {
      ...cur,
      ...(cur.agentType ? {} : t.agentType ? { agentType: t.agentType } : {}),
      ...(cur.output ? {} : t.output ? { output: t.output } : {}),
      description: cur.description || t.description,
    }
  }
  return out
}

/**
 * One line for a tool call's input. An Agent call is named by its agent type, never by its
 * `description` (round 4: the human saw "Agent Wait test agent one" and wants it gone).
 */
export function summarize(tool: string, input: Record<string, unknown>): string {
  const pick = (k: string) => (typeof input[k] === 'string' ? (input[k] as string) : '')
  if (AGENT_TOOLS.has(tool)) return (pick('subagent_type') || tool).replace(/\s+/g, ' ').slice(0, 90)
  const s =
    pick('file_path') || pick('path') || pick('pattern') || pick('command') || pick('url') || pick('query') || pick('description') || pick('skill') || pick('to') || pick('subagent_type')
  return (s === '' ? tool : s).replace(/\s+/g, ' ').slice(0, 90)
}

// ---- background tasks (round 4): one collapsible entry each ----

/** Statuses after which a background task has ended. */
export const TASK_ENDED = new Set(['completed', 'failed', 'killed', 'ended', 'stopped'])

/** A task that is an agent's loop: its description is that Agent call's `description`, never drawn. */
export const isAgentTask = (t: LensTask): boolean => t.source === 'agent.list' || t.type === 'subagent' || (t.agentType ?? '') !== ''

/**
 * Keeps each task's first-seen time across updates and stamps the end the first time it is seen
 * ended: no event names the times (`AgentInfo`, `BackgroundTaskSummary`).
 */
export function stampTasks(prev: readonly LensTask[], next: readonly LensTask[], now: number): LensTask[] {
  return next.map(t => {
    const p = prev.find(x => x.id === t.id)
    const startedAt = p?.startedAt ?? t.startedAt ?? now
    const endedAt = TASK_ENDED.has(t.status) ? (p?.endedAt ?? t.endedAt ?? now) : null
    const output = t.output || p?.output
    return output ? { ...t, startedAt, endedAt, output } : { ...t, startedAt, endedAt }
  })
}

/** A task's collapsed line: description and status; an agent task by its agent's name instead. */
export function taskLine(t: LensTask, agentName: string): string {
  const what = isAgentTask(t) ? agentName || humanRole(t.agentType ?? '') || 'Subagent' : t.description || t.type
  return `${what} - ${t.status}`
}

/** A clock time for a task's details: `14:03:07`, or `—` when not known. */
export function fmtClock(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms <= 0) return '—'
  const d = new Date(ms)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`
}

/** Tools whose results are gathered context for the main loop (design item 1). */
export const CONTEXT_TOOLS = new Set(['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'Bash', 'Skill', 'Agent', 'LSP', 'ToolSearch'])

// ---- the chat card (rounds 2-3) ----

/** The tools that spawn an agent: `Agent`, and `Task` as headless runs name it. */
export const AGENT_TOOLS = new Set(['Agent', 'Task'])

/** Terminal statuses: `agent.list` may still say `running` for a while after them (E4), so they are kept. */
export const ENDED = new Set(['completed', 'failed', 'killed'])

/**
 * Adds an agent only when it is absent, decided inside the write (round 3 root cause): a
 * `turn.start` that read "absent" before `agent.spawn` patched the agent must not put a blank one back.
 */
export function ensureIn(m: Record<string, LensAgent>, id: string, make: () => LensAgent): Record<string, LensAgent> {
  return m[id] ? m : { ...m, [id]: make() }
}

/**
 * Two-way arrow on spawn (L6): the same parent spawned this type before, under another call.
 * Not "the agent already exists": its own `turn.start` adds it first (headless run, step 17.l2).
 */
export function isRespawn(m: Record<string, LensAgent>, id: string, parent: string, type: string, toolUseId: string): boolean {
  const self = m[id]
  if (self && self.toolUseId !== '' && self.toolUseId !== toolUseId) return true
  return Object.values(m).some(a => a.id !== id && a.parent === parent && a.type === type && a.toolUseId !== '' && a.toolUseId !== toolUseId)
}

/** The batch an Agent call belongs to: the batch that lists it with others first, else its own. */
export function leadOf(batches: Record<string, LensBatch>, toolUseId: string): string | null {
  let own: string | null = null
  for (const [lead, b] of Object.entries(batches)) {
    if (!b.ids.includes(toolUseId)) continue
    if (b.ids.length > 1) return lead
    own = lead
  }
  return own
}

/** Adds an Agent call to the batch of its message; a single-call batch `tool.call` made for it first is folded in. */
export function addToBatch(batches: Record<string, LensBatch>, lead: string, parent: string, toolUseId: string): Record<string, LensBatch> {
  const b = batches[lead] ?? { parent, ids: [], pending: {} }
  const lone = toolUseId !== lead ? batches[toolUseId] : undefined
  const pending = lone ? { ...b.pending, ...lone.pending } : b.pending
  const ids = b.ids.includes(toolUseId) ? b.ids : [...b.ids, toolUseId]
  const out = { ...batches, [lead]: { ...b, ids, pending } }
  if (lone && lone.ids.length === 1) delete out[toolUseId]
  return out
}

/** Notes what `tool.call` saw of an Agent call; a call no step reported becomes a batch of its own. */
export function notePending(batches: Record<string, LensBatch>, parent: string, toolUseId: string, p: LensPending): Record<string, LensBatch> {
  const lead = leadOf(batches, toolUseId)
  const base = lead === null ? addToBatch(batches, toolUseId, parent, toolUseId) : batches
  const key = lead ?? toolUseId
  const b = base[key]!
  return { ...base, [key]: { ...b, pending: { ...b.pending, [toolUseId]: p } } }
}

/** The avatar of an Agent call whose agent `agent.spawn` has not named yet: steady, never blinking. */
export function pendingAgent(toolUseId: string, parent: string, p: LensPending | undefined): LensAgent {
  return {
    id: `call:${toolUseId}`,
    parent,
    type: p?.type ?? '',
    name: p?.name ?? '',
    description: p?.description ?? '',
    model: '',
    callModel: p?.model ?? '',
    parentModel: '',
    prompt: p?.prompt ?? '',
    status: 'pending',
    toolUseId,
    steps: ZERO,
    turns: ZERO,
    last: null,
    handoff: p ? (matchHandoff(p.prompt)?.path ?? null) : null,
    handoffHow: p && matchHandoff(p.prompt) ? matchHandoff(p.prompt)!.how : 'none',
    loop: false,
    startedAt: 0,
    endedAt: null,
    bg: [],
    reqs: [],
  }
}

/**
 * What the chat card draws for one batch: the loop that made the calls on top, each call's agent
 * (by `callAgent`, then by its stored call id; else a placeholder) under it, then their children.
 */
export function batchView(
  batch: LensBatch,
  agents: Record<string, LensAgent>,
  order: readonly string[],
  callAgent: Record<string, string> = {},
): { ids: string[]; agents: Record<string, LensAgent>; members: string[] } {
  const out: Record<string, LensAgent> = {}
  const ids: string[] = []
  const root: LensAgent = agents[batch.parent] ?? { ...pendingAgent('', '', undefined), id: batch.parent, parent: null, status: 'running' }
  out[root.id] = { ...root, parent: null }
  ids.push(root.id)
  const byCall = new Map<string, LensAgent>()
  for (const a of Object.values(agents)) if (a.toolUseId !== '') byCall.set(a.toolUseId, a)
  const members: string[] = []
  // Step 1.6.1 (A3): a call made by another spawner than the root hangs under that spawner, which is
  // drawn first with its own chain up to the root (a nested agent that started the run, say).
  const place = (id: string, depth = 0): void => {
    if (out[id] !== undefined || depth > 50) return
    const a = agents[id]
    if (a === undefined) return
    const up = a.parent ?? root.id
    if (up !== root.id) place(up, depth + 1)
    out[id] = { ...a, parent: out[up] !== undefined ? up : root.id }
    ids.push(id)
  }
  for (const tu of batch.ids) {
    const mapped = callAgent[tu] !== undefined ? agents[callAgent[tu]!] : undefined
    const p = batch.pending[tu]
    let a = mapped ?? byCall.get(tu) ?? pendingAgent(tu, root.id, p)
    // A record a race left blank still gets its call's type, prompt and id from the call.
    if (p && a.type === '') a = { ...a, type: p.type, description: a.description || p.description, prompt: a.prompt || p.prompt, callModel: a.callModel || p.model }
    if (a.toolUseId === '') a = { ...a, toolUseId: tu }
    const sp = batch.by?.[tu] ?? root.id
    if (sp !== root.id) place(sp)
    if (out[a.id] !== undefined && a.id !== root.id) {
      // Drawn already as a spawner of another call: keep it, but it is a member too.
      members.push(a.id)
      continue
    }
    out[a.id] = { ...a, parent: out[sp] !== undefined ? sp : root.id }
    ids.push(a.id)
    members.push(a.id)
  }
  for (let grew = true; grew; ) {
    grew = false
    for (const id of order) {
      const a = agents[id]
      if (!a || out[id] || a.parent === null || a.parent === root.id || !out[a.parent]) continue
      out[id] = a
      ids.push(id)
      grew = true
    }
  }
  out[root.id] = restingSpawner(out[root.id]!, members.map(m => out[m]!))
  return { ids, agents: out, members }
}

/**
 * Step 1.6.1.l3 (addendum B2): the orchestrator's node in one workflow's chart. The main loop is the
 * spawner of every run and its status is the loop's own: `running` while it works a turn for any run (it
 * drove three runs at once in the session that showed the bug, one turn from 05:59:05 to 06:07:04). In a
 * workflow whose agents have all ended, the orchestrator's part in it is done (the human's rule), so its
 * node there is drawn `idle`: steady, never blinking. Only `main`; any other spawner keeps its status.
 */
export function restingSpawner(root: LensAgent, members: readonly LensAgent[]): LensAgent {
  if (root.id !== 'main' || !isRunning(root.status) || members.length === 0 || members.some(atWork)) return root
  return { ...root, status: 'idle' }
}

/** The terminal's flowchart: one line per avatar, indented by depth, its model and role under it. */
export function textChart(ids: readonly string[], agents: Record<string, LensAgent>, label: (a: LensAgent) => ChartLabel): { id: string; head: string; lines: string[] }[] {
  const { placed } = layout(ids, agents, SIZE0)
  return placed.map(p => {
    const a = agents[p.id]!
    const l = label(a)
    const pad = '   '.repeat(p.depth)
    const sub = `${pad}${a.parent !== null ? '    ' : ''}  `
    return { id: p.id, head: `${pad}${a.parent !== null ? (a.loop ? '<-> ' : '-> ') : ''}`, lines: [l.name, `${sub}${l.model}, ${l.role}`] }
  })
}

// ---- round 4: the workflow pane and the panels ----

/** A run's title from its `run.md`: the first heading without `Run:` / `Run state:`, else the `run:` field; '' when none. */
export function runTitle(text: string | null): string {
  if (text === null) return ''
  const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
  const h = /^#\s+(.+?)\s*$/m.exec(body)
  if (h) return h[1]!.replace(/^(Run state|Run):\s*/i, '').trim()
  const f = /^run:\s*(.+?)\s*$/m.exec(text)
  return f ? f[1]!.trim() : ''
}

/** The first line of a request or brief, as a workflow's title; '' when empty. */
export const firstLine = (text: string, max = 100): string => (text.split(/\r?\n/).find(l => l.trim() !== '') ?? '').trim().slice(0, max)

/** The workflows of the session, newest first: every batch that holds an Agent call. */
export function workflowLeads(batches: Record<string, LensBatch>): string[] {
  return Object.keys(batches)
    .filter(k => batches[k]!.ids.length > 0)
    .reverse()
}

/** The status badge: running, waiting, done or failed, and its colour. */
export function statusBadge(status: string): { text: string; color: string } {
  if (status === 'running') return { text: 'running', color: 'yellow' }
  if (status === 'pending') return { text: 'waiting', color: 'gray' }
  if (status === OPEN) return { text: 'no hand-back', color: 'gray' }
  if (status === 'failed' || status === 'killed') return { text: 'failed', color: 'red' }
  if (status === 'completed' || status === 'idle' || status === 'done' || status === 'ended') return { text: 'done', color: 'green' }
  return { text: status || '—', color: 'gray' }
}

/** Context used against the window as a bar of `cells` cells; '' when the window is not known. */
export function usageBar(used: number, window: number | null, cells = 12): string {
  if (window === null || !(window > 0)) return ''
  const k = Math.max(0, Math.min(cells, Math.round((used / window) * cells)))
  return '█'.repeat(k) + '░'.repeat(cells - k)
}

// ---- round 4 bug: one workflow across messages and turns ----

export const WF0: LensWorkflows = { of: {}, by: {}, parent: {}, order: [] }

/** Whether a workflow still has an agent at work: a call not spawned yet, or an agent running. */
export function workflowActive(wf: LensWorkflows, w: string, agents: Record<string, LensAgent>, callAgent: Record<string, string>): boolean {
  const byCall = new Map<string, LensAgent>()
  for (const a of Object.values(agents)) if (a.toolUseId !== '') byCall.set(a.toolUseId, a)
  for (const [call, ww] of Object.entries(wf.of)) {
    if (ww !== w) continue
    const a = (callAgent[call] !== undefined ? agents[callAgent[call]!] : undefined) ?? byCall.get(call)
    if (!a || a.status === 'pending' || a.status === 'running') return true
  }
  return false
}

/**
 * The task an Agent call works for (round 6): the run folder its brief's handoff record is in, else the
 * request or brief that made the call; '' when neither is known. Two calls with one key are one task.
 */
export function taskKeyOf(prompt: string, request: string): string {
  const rec = matchHandoff(prompt)?.path
  const dir = rec === undefined ? null : (parseRecord(rec)?.dir ?? null)
  if (dir !== null && dir !== '.') return `run:${dir}`
  return request.trim() === '' ? '' : `req:${request.trim()}`
}

/** The run folder a task key names (`run:<dir>`, from `taskKeyOf`), else null. */
export const runOfKey = (key: string): string | null => (key.startsWith('run:') ? key.slice(4) : null)

/**
 * Step 1.6.1.l1 (addendum A5): a run's identity, the name of its run folder (`AAW-20261023-lens-plugin-from-spike`),
 * lower case. The same run named as `docs/handoffs/R`, `./docs/handoffs/R/`, `E:\repo\docs\handoffs\R` or from a
 * worktree is one run; '' when there is no folder.
 */
export function runIdOf(dir: string | null | undefined): string {
  if (dir === null || dir === undefined) return ''
  const segs = dir.replace(/\\/g, '/').split('/').filter(x => x !== '' && x !== '.')
  return (segs.at(-1) ?? '').toLowerCase()
}

/**
 * The run each call of the workflows belongs to, by identity (`runIdOf`): the run its task key names, else
 * the run of the agent that call spawned or resumed (its brief's record, kept on the agent: a resumed agent's
 * new call, or a call whose key was lost, still belongs to the agent's run). '' when neither names a run.
 * Step 27.1: a run drawn in another (`roots`, from `runRoots`) gives that run's identity instead.
 */
export function callRunIds(
  wf: LensWorkflows,
  keys: Record<string, string>,
  agents: Record<string, LensAgent>,
  callAgent: Record<string, string>,
  roots: Record<string, string> = {},
): Record<string, string> {
  const byCall = new Map<string, LensAgent>()
  for (const a of Object.values(agents)) if (a.toolUseId !== '') byCall.set(a.toolUseId, a)
  const out: Record<string, string> = {}
  for (const c of Object.keys(wf.of)) {
    let id = runIdOf(runOfKey(keys[c] ?? ''))
    if (id === '') {
      const a = (callAgent[c] !== undefined ? agents[callAgent[c]!] : undefined) ?? byCall.get(c)
      id = a ? runIdOf(runDirOf({ handoff: typeof a.handoff === 'string' ? a.handoff : null, prompt: typeof a.prompt === 'string' ? a.prompt : '' })) : ''
    }
    // Step 27.1: a run with `parent:` is its top run's (`runRoots`).
    out[c] = own(roots, id) ?? id
  }
  return out
}

/**
 * Addendum A5: one workflow per run (drawn since step 8.6.1 as one chart per top-level step, `stepCharts`). Every call of a run joins the run's first workflow (the oldest in `order`
 * holding one of its calls), whatever session, batch, message or time made it. A workflow whose calls name
 * that one run (and the calls without a run its agents made) is merged into it whole and leaves `order`; a
 * workflow that mixes runs (an older lens joined them) gives each other run's calls back to that run's
 * workflow. Two runs never share one; nothing changes when every run already has one workflow. Step 27.1:
 * a child run (`parent:`, `roots`) is its top run here, so its calls join that run's workflow and chart.
 */
export function unifyRuns(
  wf: LensWorkflows,
  keys: Record<string, string>,
  agents: Record<string, LensAgent>,
  callAgent: Record<string, string>,
  roots: Record<string, string> = {},
): LensWorkflows {
  const ids = callRunIds(wf, keys, agents, callAgent, roots)
  const home = new Map<string, string>()
  for (const w of wf.order) for (const c of Object.keys(wf.of)) if (wf.of[c] === w && ids[c] !== '' && !home.has(ids[c]!)) home.set(ids[c]!, w)
  const of = { ...wf.of }
  let changed = false
  for (const w of wf.order) {
    const calls = Object.keys(wf.of).filter(c => wf.of[c] === w)
    const runs = new Set(calls.map(c => ids[c]!).filter(x => x !== ''))
    if (runs.size === 1) {
      const target = home.get([...runs][0]!)!
      if (target !== w) {
        for (const c of calls) of[c] = target
        changed = true
      }
      continue
    }
    for (const c of calls) {
      const target = ids[c] !== '' ? home.get(ids[c]!) : undefined
      if (target !== undefined && target !== w) {
        of[c] = target
        changed = true
      }
    }
  }
  if (!changed) return wf
  const used = new Set(Object.values(of))
  return { ...wf, of, order: wf.order.filter(w => used.has(w)) }
}

/**
 * The workflow an Agent call joins. Step 1.5 (AC-1.5.1, AC-1.5.2, the human's definitions): a workflow's
 * identity is its run, the work item, never the spawner or the timing. A call whose brief names a record
 * in a run folder (`keys`, from `taskKeyOf`) joins the workflow that run already has, whatever spawned it,
 * whether that run is active, blocked or done, and whatever other workflows are at work; a run the lens
 * has not seen is a new workflow. Only a call no run can be read from falls back: an agent of a workflow
 * spawning stays in it; else the spawner's newest workflow for the same request (round 6, A8: a call with
 * that request key, or one the same request made, `requests`, whatever run it named); else, when not even
 * the request is known, the spawner's latest workflow while an agent of it still works (round 4).
 * Otherwise a new workflow, named by this call. Step 27.1: a run with `parent:` (`roots`, from `runRoots`)
 * is its top run's, so its calls join that run's workflow; an unknown parent leaves it its own.
 */
export function joinWorkflow(
  wf: LensWorkflows,
  spawner: string,
  call: string,
  agents: Record<string, LensAgent>,
  callAgent: Record<string, string>,
  keys: Record<string, string> = {},
  requests: Record<string, string> = {},
  roots: Record<string, string> = {},
): LensWorkflows {
  if (wf.of[call] !== undefined) return unifyRuns(wf, keys, agents, callAgent, roots)
  const key = keys[call] ?? ''
  const fresh = (): LensWorkflows => unifyRuns({ of: { ...wf.of, [call]: call }, by: { ...wf.by, [call]: spawner }, parent: { ...wf.parent, [call]: spawner }, order: [...wf.order, call] }, keys, agents, callAgent, roots)
  const join = (w: string): LensWorkflows => unifyRuns({ ...wf, of: { ...wf.of, [call]: w }, by: { ...wf.by, [call]: spawner } }, keys, agents, callAgent, roots)
  const withKey = new Set(Object.keys(wf.of).filter(c => c !== call && keys[c] === key).map(c => wf.of[c]!))
  const raw = runIdOf(runOfKey(key))
  // Step 27.1: a child run (`parent:`) joins its top run's workflow (`roots`, `runRoots`).
  const run = own(roots, raw) ?? raw
  if (run !== '') {
    // Addendum A5: the run's own workflow by identity (the run folder's name, `callRunIds`), the oldest
    // if an earlier version of the lens split it; never a newer one. `unifyRuns` merges any split.
    const ids = callRunIds(wf, keys, agents, callAgent, roots)
    const mine = new Set(Object.keys(wf.of).filter(c => c !== call && ids[c] === run).map(c => wf.of[c]!))
    const w = wf.order.find(x => mine.has(x))
    return w === undefined ? fresh() : join(w)
  }
  const self = agents[spawner]
  let w = spawner !== 'main' && self && self.toolUseId !== '' ? wf.of[self.toolUseId] : undefined
  if (w === undefined && key !== '') {
    const request = key.startsWith('req:') ? key.slice(4) : ''
    const same = new Set([...withKey, ...Object.keys(wf.of).filter(c => c !== call && request !== '' && (requests[c] ?? '').trim() === request).map(c => wf.of[c]!)])
    w = [...wf.order].reverse().find(x => wf.parent[x] === spawner && same.has(x))
  }
  if (w === undefined && key === '') {
    const latest = [...wf.order].reverse().find(x => wf.parent[x] === spawner)
    if (latest !== undefined && workflowActive(wf, latest, agents, callAgent)) w = latest
  }
  return w === undefined ? fresh() : join(w)
}

/** One workflow as a batch for `batchView`: its spawner and the calls it made; what those agents spawned joins as descendants. */
export function workflowBatch(wf: LensWorkflows, w: string, batches: Record<string, LensBatch>, agents: Record<string, LensAgent> = {}): LensBatch {
  const first = wf.parent[w] ?? 'main'
  // Step 1.6.1 (addendum A3): every call of the run's workflow, whoever made it. A run started by a nested
  // agent and joined later by the orchestrator is drawn from the spawners' nearest common ancestor, each
  // call under its own spawner (`by`), so the orchestrator's later spawn shows in that run's chart too.
  // Calls an agent of the drawn tree made are drawn as its descendants, as before; only a spawner outside
  // that tree (not `first`, not under it) adds its calls here.
  const inTree = (id: string): boolean => {
    const seen = new Set<string>()
    for (let cur: string | null = id; cur !== null && !seen.has(cur); cur = agents[cur]?.parent ?? null) {
      if (cur === first) return true
      seen.add(cur)
    }
    return false
  }
  const ids = Object.keys(wf.of).filter(c => wf.of[c] === w && (wf.by[c] === first || !inTree(wf.by[c] ?? first)))
  const by: Record<string, string> = {}
  for (const c of ids) by[c] = wf.by[c] ?? first
  const parent = commonAncestor([first, ...ids.map(c => by[c]!)], agents)
  const pending: Record<string, LensPending> = {}
  for (const b of Object.values(batches)) for (const id of ids) if (b.pending[id]) pending[id] = b.pending[id]!
  return { parent, ids, pending, by }
}

/** The nearest agent every one of `ids` is or descends from (by `parent`); `main` when they share none. */
export function commonAncestor(ids: readonly string[], agents: Record<string, LensAgent>): string {
  const chain = (id: string): string[] => {
    const out: string[] = []
    const seen = new Set<string>()
    for (let cur: string | null = id; cur !== null && !seen.has(cur); cur = agents[cur]?.parent ?? (cur === 'main' ? null : 'main')) {
      seen.add(cur)
      out.push(cur)
    }
    return out
  }
  const uniq = [...new Set(ids)]
  if (uniq.length === 1) return uniq[0]!
  const chains = uniq.map(chain)
  return chains[0]!.find(x => chains.every(c => c.includes(x))) ?? 'main'
}

/**
 * The model's limits the avatar panel lists (round 4): only those the metadata file gives. A null
 * limit (max input without an API key, a long-context window the model lacks) is left out, not `—`.
 */
export function limitRows(c: Costing, model: string): [string, string][] {
  const json = parseCosting(c)
  const f = json === null ? null : lookupModel(json, model)
  if (f === null) return []
  const rows: [string, number | null][] = [
    ['Long-context window', f.longWindow],
    ['Max input', f.maxInput],
    ['Max output', f.maxOutput],
  ]
  return rows.filter((r): r is [string, number] => r[1] !== null).map(([k, v]) => [k, fmtTokens(v)])
}

// ---- round 5 (step 17.l4) and round 6 (step 17.l5): task titles, run state, workflow status, notices ----

const STEP_CODE = /^\d+(?:\.(?:\d+|l\d+))*$/
const TABLE_RULE = /^\|\s*:?-{2,}/

/** A table row's cells, trimmed, backticks dropped. */
const cellsOf = (line: string): string[] =>
  line
    .split('|')
    .slice(1, -1)
    .map(x => x.trim().replace(/^`|`$/g, ''))

/**
 * A run's `run.md`: its title (`runTitle`), its `status:`, the stage in progress (the last stage row
 * whose status starts with `in-progress`, else `current-stage:`), and every stage row's name by its
 * step code. Round 6: only the stages table is read, the one whose header has a `Stage` column or that
 * sits under a `Stages` heading; the gates, loops and clarifications tables are not. Null when there is no file.
 */
export function parseRun(text: string | null): LensRun | null {
  if (text === null) return null
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? ''
  const field = (k: string) => new RegExp(`^${k}:\\s*(.+?)\\s*$`, 'm').exec(fm)?.[1] ?? ''
  const stages: Record<string, string> = {}
  let inProgress = ''
  let heading = ''
  let inStages = false
  // Step 8.6.1: the merged-runs table (its second header cell `Offset`): each merged run's step offset.
  let inOffsets = false
  const offsets: Record<string, number> = {}
  // Step 8.6.1.l1: the Features table (`Step | Feature | Old steps | Status`): each root's name and old steps.
  let inFeatures = false
  const features: Record<string, string> = {}
  const featureRows: { step: number; old: string }[] = []
  const lines = text.split(/\r?\n/)
  lines.forEach((line, i) => {
    if (/^#{1,6}\s/.test(line)) heading = line
    if (!line.startsWith('|')) {
      inStages = false
      inOffsets = false
      inFeatures = false
      return
    }
    if (TABLE_RULE.test(line)) return
    const cells = cellsOf(line)
    if (TABLE_RULE.test(lines[i + 1] ?? '')) {
      // The header row: it decides whether this table is the stages table.
      inStages = cells.some(x => /^stages?$/i.test(x)) || /^#{1,6}\s+stages?\b/i.test(heading)
      inOffsets = cells[1] !== undefined && /^offset$/i.test(cells[1])
      inFeatures = /^steps?$/i.test(cells[0] ?? '') && /^features?$/i.test(cells[1] ?? '')
      if (inFeatures) inStages = false
      return
    }
    if (inFeatures) {
      if (/^\d+$/.test(cells[0] ?? '') && (cells[1] ?? '') !== '') {
        features[String(Number(cells[0]))] = cells[1]!
        featureRows.push({ step: Number(cells[0]), old: cells[2] ?? '' })
      }
      return
    }
    if (inOffsets) {
      const off = /^\+?(\d+)$/.exec(cells[1] ?? '')
      if (off && runIdOf(cells[0] ?? '') !== '') offsets[runIdOf(cells[0]!)] = Number(off[1])
      return
    }
    const code = cells[0] ?? ''
    if (!inStages || !STEP_CODE.test(code) || cells.length < 2) return
    const name = cells[1]!
    stages[code] = name
    if (cells.slice(2).some(x => /^in-progress\b/i.test(x))) inProgress = name
  })
  const started = field('started') || field('created')
  // Step 27.1: `parent: <run id>` (the handoff skill's Related requests), kept as the folder's name.
  const parent = folderNameOf(field('parent').replace(/^["'`]+|["'`]+$/g, ''))
  const renames = renamesFromFeatures(featureRows)
  return {
    title: runTitle(text),
    status: field('status'),
    stage: inProgress || field('current-stage'),
    stages,
    ...(started !== '' ? { started } : {}),
    ...(parent !== '' ? { parent } : {}),
    ...(Object.keys(offsets).length > 0 ? { offsets } : {}),
    ...(Object.keys(features).length > 0 ? { features } : {}),
    ...(Object.keys(renames).length > 0 ? { renames } : {}),
  }
}

/**
 * Step 8.6.1.l1: the renumbering a run.md *Features* table records, as old code -> new code prefixes. The rule
 * the orchestrator applied (run.md, 2026-10-24): the i-th old top-level step of feature F became `F.i`, keeping
 * everything after it. Each row's `Old steps` cell lists codes and ranges (`1, 2, 3.1–3.5, 4.1–4.5`); an old
 * top-level step listed under one feature only is one unit (`3.1–3.5` is old step 3 -> `1.3`, so `3.2` -> `1.3.2`);
 * an old step split across features (`10.1` under feature 3, `10.2` under feature 5) makes each listed code its own
 * unit (`10.1` -> `3.3`, `10.2` -> `5.1`). Units are numbered in the order they are listed.
 */
export function renamesFromFeatures(rows: readonly { step: number; old: string }[]): Record<string, string> {
  const codesOf = (cell: string): string[] =>
    cell
      .split(',')
      .map(t => t.trim())
      .filter(t => t !== '')
      .flatMap(t => {
        const r = /^(\d+(?:\.\d+)*)\s*[–—-]\s*(\d+(?:\.\d+)*)$/.exec(t)
        if (r === null) return STEP_CODE.test(t) ? [t] : []
        const a = r[1]!.split('.')
        const b = r[2]!.split('.')
        const lo = Number(a.at(-1))
        const hi = Number(b.at(-1))
        // `3.1–3.5`: the same prefix, its last number from 3 to 5 (at most 100 codes); anything else: its two ends.
        if (a.length === b.length && a.slice(0, -1).join('.') === b.slice(0, -1).join('.') && hi >= lo && hi - lo < 100)
          return Array.from({ length: hi - lo + 1 }, (_, k) => [...a.slice(0, -1), String(lo + k)].join('.'))
        return [r[1]!, r[2]!]
      })
  const listed = rows.map(r => ({ step: r.step, codes: codesOf(r.old) }))
  const rowsOfTop = new Map<number, Set<number>>()
  for (const r of listed) for (const c of r.codes) rowsOfTop.set(topStepOf(c), (rowsOfTop.get(topStepOf(c)) ?? new Set()).add(r.step))
  const out: Record<string, string> = {}
  for (const r of listed) {
    const seen = new Set<string>()
    for (const c of r.codes) {
      const unit = (rowsOfTop.get(topStepOf(c))?.size ?? 0) > 1 ? c : String(topStepOf(c))
      if (seen.has(unit)) continue
      seen.add(unit)
      out[unit] = `${r.step}.${seen.size}`
    }
  }
  return out
}

/** Step 8.6.1.l1: an old code under a renumbering (`renamesFromFeatures`): the longest old prefix it starts with, replaced (old `30.1` -> `8.6.1`); null when none applies. */
export function renameCode(code: string, renames: Record<string, string>): string | null {
  let best: string | null = null
  for (const k of Object.keys(renames)) if ((code === k || code.startsWith(`${k}.`)) && (best === null || k.length > best.length)) best = k
  return best === null ? null : `${renames[best]}${code.slice(best.length)}`
}

/**
 * A file of a run folder that records per-code renames (a renaming that is not a prefix change, such as the
 * phase renaming: `3.2.1` -> `3.1`, `8.6.5.l1` -> `8.4.l2.2`): a `.json` or `.md` file whose name has the word
 * `rename` at its start or after a character that is not a letter or digit (`phase-renames-2026-10-24.json`,
 * `renames.md`; not `prename.json`), that is neither a record nor a run state.
 */
export const isRenameSource = (name: string): boolean => /(?:^|[^a-z0-9])rename[^/\\]*\.(json|md)$/i.test(name) && !isRunStateFile(name) && parseRecordName(name) === null

/**
 * A rename source's map, old code -> new code: a `.json` file's `codeMap` object; a `.md` file's
 * table whose first two header cells are `Old code` and `New code`. Only pairs of step codes are kept; {} when the
 * file is unreadable or has neither.
 */
export function codeMapOf(name: string, text: string | null): Record<string, string> {
  const out: [string, string][] = []
  const keep = (k: unknown, v: unknown) => {
    if (typeof k === 'string' && typeof v === 'string' && STEP_CODE.test(k.trim()) && STEP_CODE.test(v.trim())) out.push([k.trim(), v.trim()])
  }
  if (text === null) return {}
  if (/\.json$/i.test(name)) {
    let j: unknown
    try {
      j = JSON.parse(text)
    } catch {
      return {}
    }
    const m = j !== null && typeof j === 'object' ? (j as Record<string, unknown>)['codeMap'] : undefined
    if (m !== null && typeof m === 'object' && !Array.isArray(m)) for (const [k, v] of Object.entries(m)) keep(k, v)
    return Object.fromEntries(out)
  }
  const lines = text.split(/\r?\n/)
  let inMap = false
  lines.forEach((line, i) => {
    if (!line.startsWith('|')) {
      inMap = false
      return
    }
    if (TABLE_RULE.test(line)) return
    const cells = cellsOf(line)
    if (TABLE_RULE.test(lines[i + 1] ?? '')) {
      inMap = /^old\s+code$/i.test(cells[0] ?? '') && /^new\s+code$/i.test(cells[1] ?? '')
      return
    }
    if (inMap) keep(cells[0], cells[1])
  })
  return Object.fromEntries(out)
}

/**
 * Several per-code maps, oldest first, as one: a code goes through each later map that has its result as a key
 * (`a` -> `b`, then `b` -> `c`: `a` -> `c`). A key a later map repeats takes the later map's value, since a brief
 * that names it is likelier written after the earlier renaming. Keys inside one map are not chained (`{ a: b, b: c }`
 * keeps `a` -> `b`): one map records one renaming, whose new codes can reuse its old ones (old `8.4.1` and new `8.4.1`
 * are different records).
 */
export function composeCodeMaps(maps: readonly Record<string, string>[]): Record<string, string> {
  const out = new Map<string, string>()
  for (const m of maps) {
    for (const [k, v] of out) {
      const next = own(m, v)
      if (next !== undefined) out.set(k, next)
    }
    for (const [k, v] of Object.entries(m)) out.set(k, v)
  }
  return Object.fromEntries(out)
}

/** A run folder's name as written (the last segment of its path, case kept); '' for none. `runIdOf` is its identity. */
export function folderNameOf(dir: string): string {
  return dir.replace(/\\/g, '/').split('/').filter(x => x !== '' && x !== '.').at(-1) ?? ''
}

/** The cap on a `parent:` chain (`runRoots`, and the run.md reads that follow one): deeper chains stop there. */
export const PARENT_DEPTH = 16

/**
 * Step 27.1: the run each run with `parent:` is drawn in, by identity (`runIdOf`): the top of its chain of
 * parents, followed while the next parent is known to the lens (a run whose run.md it read, `runs`, or a run
 * a call names, `known`). An unknown parent ends the chain there; a child whose first parent is unknown is
 * left out, so it stays its own run. A chain that comes back to a run already on it (a cycle) leaves the run
 * out too: it is never lost and the walk never loops. Only runs drawn in another run are listed.
 */
export function runRoots(runs: Record<string, LensRun>, known: Iterable<string> = []): Record<string, string> {
  const byId = new Map<string, LensRun>()
  for (const [d, r] of Object.entries(runs)) if (runIdOf(d) !== '') byId.set(runIdOf(d), r)
  const isKnown = new Set<string>([...byId.keys(), ...[...known].filter(x => x !== '')])
  const out: Record<string, string> = {}
  for (const id of byId.keys()) {
    const seen = new Set([id])
    let cur = id
    let cycle = false
    for (let i = 0; i < PARENT_DEPTH; i++) {
      const p = runIdOf(byId.get(cur)?.parent ?? '')
      if (p === '' || !isKnown.has(p)) break
      if (seen.has(p)) {
        cycle = true
        break
      }
      seen.add(p)
      cur = p
    }
    if (!cycle && cur !== id) out[id] = cur
  }
  return out
}

/**
 * Step 27.1, addendum L1: the run a run folder that no longer exists was merged into. When runs are merged
 * (the handoff skill's *Related requests*: related work joins the parent run), the old run folder goes and its
 * run state is kept in the run it joined as `merged-from-<old run>.md`. Briefs written before the merge still
 * name the old folder. Given the old folder and the listing of every run folder, the folder holding
 * `merged-from-<its name>.md` (case-insensitive) and that file's name; null when none does (the first found wins).
 */
export function mergedHomeOf(dir: string, folders: readonly { dir: string; names: readonly string[] }[]): { home: string; file: string } | null {
  const id = runIdOf(dir)
  if (id === '') return null
  for (const f of folders) {
    if (runIdOf(f.dir) === id) continue
    const file = f.names.find(n => n.toLowerCase() === `merged-from-${id}.md`)
    if (file !== undefined) return { home: f.dir, file }
  }
  return null
}

/** The key in `runs` of a run folder's top run (`runRoots`), or of the folder itself when it has none; null when that run.md was not read. */
export function rootDirOf(dir: string, runs: Record<string, LensRun>, roots: Record<string, string>): string | null {
  const id = own(roots, runIdOf(dir)) ?? runIdOf(dir)
  return Object.keys(runs).find(d => runIdOf(d) === id) ?? null
}

/** The run folder of an agent's handoff record (named by its brief), or null. */
export function runDirOf(a: Pick<LensAgent, 'handoff' | 'prompt'>): string | null {
  const rec = a.handoff ?? matchHandoff(a.prompt)?.path ?? null
  if (rec === null) return null
  return parseRecord(rec)?.dir ?? (rec.includes('/') ? rec.replace(/\/[^/]*$/, '') : null)
}

export const isTeammate = (a: Pick<LensAgent, 'type' | 'teammate'>): boolean => a.teammate === true || a.type === 'teammate'

/**
 * Round 6: an agent waiting, whatever kind it is: `waiting` (held on background work it owns, a
 * plan's approval or, a background subagent, an Agent call alone; `AgentStatus`, D:556-566), or a
 * teammate `idle` between messages. A subagent `idle` after its answer has finished, not waiting.
 */
export const isWaiting = (a: Pick<LensAgent, 'status' | 'type' | 'teammate'>): boolean => a.status === 'waiting' || (isTeammate(a) && a.status === 'idle')

/** Agents still at work: not started, running, or waiting. */
const atWork = (a: Pick<LensAgent, 'status' | 'type' | 'teammate'>): boolean => a.status === 'pending' || a.status === 'running' || isWaiting(a)

/** The task one agent works on: its record's stage row, else its run's stage in progress, else its run's title; '' with no run. */
function agentTask(a: LensAgent, runs: Record<string, LensRun>): string {
  const d = runDirOf(a)
  const r = d === null ? undefined : runs[d]
  if (r === undefined) return ''
  const code = parseRecord(a.handoff ?? matchHandoff(a.prompt)?.path ?? '')?.code ?? ''
  return r.stages[code] ?? (r.stage || r.title)
}

/**
 * A workflow's titles (round 5, requirements 2 and 3). `parent`: the task the human gave the
 * orchestrator: the run's title when every agent of the workflow that names a record is in one run,
 * else the request or brief that made the workflow's calls. `current`: the task the agents are working
 * on: the stage row of each working agent's record (its run's stage in progress when the row is
 * missing); when they work on different tasks, or one names no record, the parent task. Never an
 * Agent call's `description`. Step 27.1: an agent of a child run (`roots`) counts as its top run's, so the
 * run title is the parent's when that run.md was read.
 */
export function workflowTask(members: readonly LensAgent[], runs: Record<string, LensRun>, request: string, roots: Record<string, string> = {}): { parent: string; current: string } {
  const titles = [
    ...new Set(
      members
        .map(a => {
          const d = runDirOf(a)
          if (d === null) return ''
          const top = own(roots, runIdOf(d)) === undefined ? d : rootDirOf(d, runs, roots)
          return top === null ? '' : (own(runs, top)?.title ?? '')
        })
        .filter(t => t !== ''),
    ),
  ]
  const parent = titles.length === 1 ? titles[0]! : request
  const tasks = new Set(members.filter(atWork).map(a => agentTask(a, runs)))
  const current = tasks.size === 1 && !tasks.has('') ? [...tasks][0]! : parent
  return { parent, current }
}

/**
 * Round 6, requirement A2: the tasks of one workflow, each its own panel: its agents grouped by the
 * task each works on (`agentTask`; an agent with no run works on the parent task), in the order first seen.
 * Step 27.1: a stage of a child run drawn in this one (`roots`) is labelled with the child run's folder name,
 * `<run>: <stage>`, so it stays apart from the parent's stages.
 */
export function workflowTasks(members: readonly LensAgent[], runs: Record<string, LensRun>, parent: string, roots: Record<string, string> = {}): { title: string; ids: string[] }[] {
  const out: { title: string; ids: string[] }[] = []
  for (const a of members) {
    const d = runDirOf(a)
    const child = d !== null && own(roots, runIdOf(d)) !== undefined
    const title = child ? `${folderNameOf(d!)}: ${agentTask(a, runs) || parent}` : agentTask(a, runs) || parent
    const hit = out.find(t => t.title === title)
    if (hit) hit.ids.push(a.id)
    else out.push({ title, ids: [a.id] })
  }
  return out
}

/** The five states of a workflow's status indicator. */
export type FlowStatus = 'in-progress' | 'pending' | 'halted' | 'waiting' | 'completed'

/** What `workflowStatus` reads of an agent; `id` to leave the spawner out. */
export type StatusMember = Pick<LensAgent, 'status' | 'type' | 'teammate'> & { id?: string }

/**
 * A workflow's status from its agents and its runs' `status:` (round 5, requirement 4). Round 6: the
 * spawner (`spawner`, the agent id that made the workflow's calls) is left out here, not by the caller.
 * The first match wins:
 * halted: an agent failed or was killed, or a run is `blocked`;
 * in-progress: an agent is running a turn;
 * waiting: an agent is waiting (`isWaiting`);
 * pending: an Agent call not started yet (or no agent yet);
 * completed: every agent has ended (`completed`, or a subagent `idle` after its answer).
 */
export function workflowStatus(members: readonly StatusMember[], runStatuses: readonly string[] = [], spawner: string | null = null): FlowStatus {
  const ms = spawner === null ? members : members.filter(a => a.id !== spawner)
  if (ms.some(a => a.status === 'failed' || a.status === 'killed') || runStatuses.some(x => x.trim().toLowerCase() === 'blocked')) return 'halted'
  if (ms.some(a => a.status === 'running')) return 'in-progress'
  if (ms.some(isWaiting)) return 'waiting'
  if (ms.length === 0 || ms.some(a => a.status === 'pending')) return 'pending'
  return 'completed'
}

/**
 * Step 36.2, amendment 6: the one workflow the minimised band names, from the workflows newest first: the newest in
 * progress, else the first waiting, then pending, then halted; with every one completed, the newest. `live`: how many
 * are in progress. Null with no workflow ("Nothing Here").
 */
export function bandLineOf<T extends { info: { status: FlowStatus } }>(flows: readonly T[]): { flow: T; live: number } | null {
  const live = flows.filter(f => f.info.status === 'in-progress').length
  for (const st of ['in-progress', 'waiting', 'pending', 'halted'] as const) {
    const f = flows.find(x => x.info.status === st)
    if (f !== undefined) return { flow: f, live }
  }
  return flows[0] === undefined ? null : { flow: flows[0], live }
}

/** Round 6, requirement A5: whether some agents run while others wait (the dot then shows both colours). */
export const runningAndWaiting = (members: readonly StatusMember[], spawner: string | null = null): boolean => {
  const ms = spawner === null ? members : members.filter(a => a.id !== spawner)
  return ms.some(a => a.status === 'running') && ms.some(isWaiting)
}

/** The colours and blink of the indicator (lens settings). */
export type StatusLook = {
  statusBlink: boolean
  statusInProgressColor: string
  statusPendingColor: string
  statusHaltedColor: string
  statusWaitingColor: string
  statusCompletedColor: string
}

/** What the indicator draws for a status: its words, its colour, and whether it blinks (only in progress). */
export function statusStyle(st: FlowStatus, s: StatusLook): { label: string; color: string; blink: boolean } {
  if (st === 'in-progress') return { label: 'in progress', color: s.statusInProgressColor, blink: s.statusBlink }
  if (st === 'pending') return { label: 'pending', color: s.statusPendingColor, blink: false }
  if (st === 'halted') return { label: 'halted', color: s.statusHaltedColor, blink: false }
  // Round 6: any waiting agent, not only a teammate.
  if (st === 'waiting') return { label: 'waiting', color: s.statusWaitingColor, blink: false }
  return { label: 'completed', color: s.statusCompletedColor, blink: false }
}

/**
 * Round 6, requirement A5: the indicator with every colour it shows. In progress with agents waiting
 * at once: both colours (the dot split, the in-progress half blinking) and both words.
 */
export function statusLooks(st: FlowStatus, both: boolean, s: StatusLook): { label: string; colors: string[]; blink: boolean } {
  const one = statusStyle(st, s)
  if (st === 'in-progress' && both) return { label: 'in progress, waiting', colors: [one.color, s.statusWaitingColor], blink: one.blink }
  return { label: one.label, colors: [one.color], blink: one.blink }
}

/**
 * The indicator as an SVG dot centred in its box; a SMIL blink when `blink`. Two colours (round 6):
 * the left half in the first, blinking when `blink`, the right half in the second, steady.
 */
export function statusDotSvg(color: string | readonly string[], blink: boolean, ms: number, size = 14): string {
  const colors = typeof color === 'string' ? [color] : color
  const r = Math.round(size * 0.36)
  const c = size / 2
  const anim = blink ? `<animate attributeName="opacity" values="1;0.2;1" dur="${ms / 1000}s" repeatCount="indefinite"/>` : ''
  const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" preserveAspectRatio="xMidYMid meet">`
  if (colors.length < 2) return head + `<circle cx="${c}" cy="${c}" r="${r}" fill="${esc(colors[0] ?? '')}">` + anim + `</circle></svg>`
  return (
    head +
    `<path d="M${c},${c - r} A${r},${r} 0 0,0 ${c},${c + r} Z" fill="${esc(colors[0]!)}">${anim}</path>` +
    `<path d="M${c},${c - r} A${r},${r} 0 0,1 ${c},${c + r} Z" fill="${esc(colors[1]!)}"/>` +
    `</svg>`
  )
}

/**
 * The tags the engine wraps a prompt it feeds the main loop in (a background task's notification, a
 * reminder, a slash command's echo, a shell escape, a hook's or a peer's message). Round 6: only these
 * are notices; a human prompt that starts with `<` (pasted HTML or XML) stays the request.
 */
const NOTICE_TAG = /^<(task-notification|system-reminder|teammate-message|local-command-[a-z]+|command-(?:name|message|args)|bash-(?:input|stdout|stderr)|user-prompt-submit-hook)\b/

/** A main-loop prompt that is an automatic notice: one of the engine's tags, or an automatic handoff seed. */
export const isNotice = (text: string): boolean => {
  const t = text.trim()
  return NOTICE_TAG.test(t) || t.startsWith('[auto-handoff]')
}

/** A main-loop prompt that is the human's request, not a notice the engine fed the loop. */
export const isHumanRequest = (text: string): boolean => text.trim() !== '' && !isNotice(text)

/**
 * Round 6: who sent a prompt (`prompt.submit` `origin.kind`, `PromptOrigin`, D:9287-9340): the person's
 * own (`composer`, `bridge`, `sdk`), or something automatic (a task notification, a trigger, a peer, a relay).
 */
export const isPersonOrigin = (kind: string): boolean => kind === 'composer' || kind === 'bridge' || kind === 'sdk'

/**
 * The workflow a notice belongs to: the one whose agent or Agent call the notice names (a task
 * notification carries the task's id), else the newest workflow, else '' (round 6).
 */
export function noticeWorkflow(text: string, wf: LensWorkflows, agents: Record<string, LensAgent>): string {
  for (const a of Object.values(agents)) {
    if (a.id === 'main' || a.toolUseId === '') continue
    if ((a.id.length >= 6 && text.includes(a.id)) || text.includes(a.toolUseId)) {
      const w = wf.of[a.toolUseId]
      if (w !== undefined) return w
    }
  }
  return wf.order.at(-1) ?? ''
}

// ---- keep-alive (spike 028, AC-9.4): ai-dlc's published state, read-only ----

/**
 * The keep-alive line for the pane headers, from the value ai-dlc publishes under
 * `{ plugin: 'ai-dlc', key: 'keepalive' }`: `keep-alive: 1h ping 2/9, next 14:05:07 · 5m ping 1/20, next 14:01:00`,
 * one part per running track. Null, so no line draws, when there is no value (ai-dlc or keep-alive
 * absent), keep-alive is off, no track runs, or the value is not in the shape the lens knows.
 */
export function keepaliveLine(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as { enabled?: unknown; tracks?: unknown }
  if (v.enabled !== true || !Array.isArray(v.tracks)) return null
  const parts: string[] = []
  for (const t of v.tracks as unknown[]) {
    if (typeof t !== 'object' || t === null) continue
    const k = t as { name?: unknown; running?: unknown; nextPingAt?: unknown; pings?: unknown; cap?: unknown }
    if (k.running !== true || typeof k.name !== 'string') continue
    const count = typeof k.pings === 'number' && typeof k.cap === 'number' ? ` ping ${k.pings}/${k.cap}` : ''
    const next = typeof k.nextPingAt === 'number' ? `, next ${fmtClock(k.nextPingAt)}` : ''
    parts.push(`${k.name}${count}${next}`)
  }
  return parts.length === 0 ? null : `keep-alive: ${parts.join(' · ')}`
}

// ---- /ai-dlc:lens-keepalive: how long keep-alive kept the cache warm, and what cache reads saved ----

/** The two keep-alive tracks, one per prompt-cache TTL, in the order the section lists them. */
export const KEEPALIVE_TRACKS = ['5m', '1h'] as const

/** One arming of one keep-alive track, as ai-dlc last published it. Times are epoch ms. */
export type KeepaliveCycle = LensKeepaliveCycle

/** Cycles kept per session: the oldest go first. */
export const KEEPALIVE_CYCLES_KEPT = 200

/**
 * The armings in ai-dlc's published keep-alive value added to `prev`, one per `<track>@<armedAt>`
 * (each arming has its own `armedAt`; a later write of the same arming replaces it). Null when the
 * value adds nothing, so a caller writes only on a change. A track never armed (`armedAt` 0) and a
 * value in an unknown shape add nothing.
 */
export function noteKeepalive(prev: Record<string, KeepaliveCycle>, value: unknown): Record<string, KeepaliveCycle> | null {
  if (typeof value !== 'object' || value === null) return null
  const tracks = (value as { tracks?: unknown }).tracks
  if (!Array.isArray(tracks)) return null
  let next: Record<string, KeepaliveCycle> | null = null
  for (const t of tracks as unknown[]) {
    if (typeof t !== 'object' || t === null) continue
    const k = t as { name?: unknown; armedAt?: unknown; warmUntil?: unknown; pings?: unknown }
    if (typeof k.name !== 'string' || typeof k.armedAt !== 'number' || !Number.isFinite(k.armedAt) || k.armedAt <= 0) continue
    const cycle: KeepaliveCycle = {
      track: k.name,
      armedAt: k.armedAt,
      warmUntil: typeof k.warmUntil === 'number' && Number.isFinite(k.warmUntil) ? k.warmUntil : 0,
      pings: typeof k.pings === 'number' && Number.isFinite(k.pings) ? k.pings : 0,
    }
    const key = `${cycle.track}@${cycle.armedAt}`
    const had = (next ?? prev)[key]
    if (had !== undefined && had.warmUntil === cycle.warmUntil && had.pings === cycle.pings) continue
    next = { ...(next ?? prev), [key]: cycle }
  }
  if (next === null) return null
  const keys = Object.keys(next)
  if (keys.length > KEEPALIVE_CYCLES_KEPT) {
    const drop = keys.sort((a, b) => next![a]!.armedAt - next![b]!.armedAt).slice(0, keys.length - KEEPALIVE_CYCLES_KEPT)
    for (const k of drop) delete next[k]
  }
  return next
}

/** How long one track kept the cache warm this session. */
export type KeptWarm = { track: string; ms: number; pings: number; armings: number; running: boolean }

/**
 * Per track (5m, then 1h; both always listed), the time the cache was warm while keep-alive held
 * the track: for each arming, from `armedAt` to the cache's expiry (`warmUntil`, moved on by each
 * ping), cut at the next arming of the same track and at `now`. It includes the cache's own TTL
 * after the turn that armed it; it is not the extension the pings added alone (that needs the TTL,
 * which ai-dlc does not publish). `value` is merged in first, so the arming in progress counts.
 */
export function keptWarm(cycles: Record<string, KeepaliveCycle>, value: unknown, now: number): KeptWarm[] {
  const all = Object.values(noteKeepalive(cycles, value) ?? cycles)
  const live = new Set<string>()
  if (typeof value === 'object' && value !== null && (value as { enabled?: unknown }).enabled === true) {
    const tracks = (value as { tracks?: unknown }).tracks
    if (Array.isArray(tracks))
      for (const t of tracks as unknown[]) if (typeof t === 'object' && t !== null && (t as { running?: unknown }).running === true && typeof (t as { name?: unknown }).name === 'string') live.add((t as { name: string }).name)
  }
  return KEEPALIVE_TRACKS.map(track => {
    const mine = all.filter(c => c.track === track).sort((a, b) => a.armedAt - b.armedAt)
    let ms = 0
    let pings = 0
    mine.forEach((c, i) => {
      const end = Math.min(c.warmUntil, mine[i + 1]?.armedAt ?? Infinity, now)
      ms += Math.max(0, end - c.armedAt)
      pings += c.pings
    })
    return { track, ms, pings, armings: mine.length, running: live.has(track) }
  })
}

/** A span: `0s`, `45s`, `12m 30s`, `1h 05m`. */
export function fmtSpan(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

/** What cache reads saved, or why there is no figure (`usd` null, `text` `—`). */
export type Savings = { usd: number | null; text: string; source: string }

/**
 * What one agent's cache reads saved: each request's cache-read tokens times (input price minus
 * cache-read price), from the metadata file's prices only, never estimated. `—` when the file, the
 * model or either price is missing. A model priced by prompt length is priced per request, with the
 * long-context rule of its cost, and only when the requests seen add up to the totals. The premium
 * paid to write the cache is not taken off: the usage does not say each write's TTL.
 */
export function savingsOfAgent(c: Costing, model: string, reqs: readonly Tokens[], totals: Tokens, lensThreshold: number | null = null): Savings {
  if (totals.cr <= 0) return { usd: 0, text: usdText(0), source: 'no cache reads' }
  const none = (source: string): Savings => ({ usd: null, text: '—', source })
  const r = resolveCosting(c, model)
  if (!r.ok) return none(r.source)
  const f = r.f
  const rule = longRuleOf(c, f, r.json, lensThreshold)
  if (typeof rule === 'string') return none(rule)
  const saved = (p: Prices, t: Tokens): number | null => (p.input === null || p.cacheRead === null ? null : (t.cr * (p.input - p.cacheRead)) / 1_000_000)
  if (rule === null) {
    const usd = saved(f, totals)
    return usd === null ? none(`${c.path} has no ${f.input === null ? 'input' : 'cache read'} price for ${f.id}`) : { usd, text: usdText(usd), source: `${c.path} (${f.id}; flat prices)` }
  }
  if (reqs.length === 0 || !sameTokens(reqs.reduce(addTokens, ZERO), totals)) return none(`${f.id} is priced by prompt length and the ${reqs.length} requests seen do not add up to the loop's totals`)
  let usd = 0
  for (const t of reqs) {
    const long = promptTokens(t) > rule.threshold
    const x = saved(long ? rule.prices : f, t)
    if (x === null) return none(`${c.path} has no ${long ? 'long-context ' : ''}input or cache read price for ${f.id}`)
    usd += x
  }
  return { usd, text: usdText(usd), source: `${c.path} (${f.id}; long-context over ${rule.threshold} prompt tokens)` }
}

/** The session's savings: the sum over its agents, `—` when any agent that read the cache has no figure. */
export function sessionSavings(each: readonly Savings[]): Savings {
  const missing = each.filter(x => x.usd === null)
  if (missing.length > 0) return { usd: null, text: '—', source: `${missing.length} of ${each.length} agents have no figure: ${missing[0]!.source}` }
  const usd = each.reduce((s, x) => s + (x.usd ?? 0), 0)
  return { usd, text: usdText(usd), source: `${each.length} agents` }
}

// ---- step 1.5: panel open mode, the workflow view's place, size and layout ----

/**
 * How a Button opens its details: the session's choice (the "Panel Type" switch), else the `panelOpenMode`
 * setting; drill-in unless the setting says tab (addendum A6: drill-in is the default).
 */
export const openModeOf = (override: string, setting: string): 'tab' | 'drill-in' =>
  override === 'tab' || override === 'drill-in' ? override : setting === 'tab' ? 'tab' : 'drill-in'

/** The view's sizes; `prev` keeps at most VIEW_PREV_KEPT of them. */
export const VIEW_SIZES = ['normal', 'minimised', 'fullscreen'] as const
export const VIEW_PREV_KEPT = 8
export const VIEW0: LensView = { place: '', size: 'normal', prev: [], selected: '' }

/** The view's place: the session's switch, else the `workflowPlace` setting. */
export const placeOf = (v: LensView, setting: string): 'pinned' | 'docked' =>
  v.place === 'pinned' || v.place === 'docked' ? v.place : setting === 'docked' ? 'docked' : 'pinned'

/** A new size (minimise, full screen): the size it leaves is kept, so restore returns to it. The same size again is no change. */
export function viewResize(v: LensView, size: string): LensView {
  if (!(VIEW_SIZES as readonly string[]).includes(size) || v.size === size) return v
  return { ...v, size, prev: [...v.prev, v.size].slice(-VIEW_PREV_KEPT) }
}

/** Restore: back to the size before the last change (full screen -> pinned or docked as it was; minimised -> the size before); normal when none is kept. */
export function viewRestore(v: LensView): LensView {
  const prev = [...v.prev]
  let size = prev.pop() ?? 'normal'
  // A kept size equal to the current one would look like no change: skip it.
  while (size === v.size && prev.length > 0) size = prev.pop()!
  return { ...v, size: size === v.size ? 'normal' : size, prev }
}

/**
 * The size a `$.ui.open` asks for the view's pane (PaneOpenArgs `rows`, `columns`, d.ts:7638-7658): full
 * screen asks the surface's whole rows and columns (the dock caps columns at 45%, the person's own size
 * wins); any other size asks nothing, so the surface's default (a third inline, its share docked) applies.
 */
export function openSizeOf(size: string, viewport: { columns?: number; rows?: number } | undefined): { rows?: number; columns?: number } {
  if (size !== 'fullscreen' || viewport === undefined) return {}
  const ok = (n: number | undefined) => typeof n === 'number' && Number.isInteger(n) && n > 0
  return { ...(ok(viewport.rows) ? { rows: viewport.rows } : {}), ...(ok(viewport.columns) ? { columns: viewport.columns } : {}) }
}

/** Wide (the runs stacked on the right, the selected run's chart beside them) or narrow (the list of runs only), by the view's body columns. */
export const layoutOf = (bodyColumns: number | undefined, wideColumns: number): 'wide' | 'narrow' =>
  bodyColumns === undefined || bodyColumns >= wideColumns ? 'wide' : 'narrow'

/** The run shown: the one selected, while it is still listed; else the newest. */
export const selectedOf = (v: LensView, newestFirst: readonly string[]): string => (newestFirst.includes(v.selected) ? v.selected : (newestFirst[0] ?? ''))

/**
 * Step 36.2, amendment 3: the view as the pane beside the band draws it: its own run (`pane`, else the band's), and
 * always its normal size, whatever the band's (minimised or not); no size of the band's to restore to.
 */
export const paneViewOf = (v: LensView): LensView => ({ ...v, size: 'normal', prev: [], selected: v.pane || v.selected })

/**
 * Finding 36.3-F1 (amendment 3) and amendment 8: the view leaving the band for docked. The band's size is the band's
 * alone, so the docked pane starts at its normal size with no size to restore to; with the pane open beside the band
 * it keeps that pane's run, else the band's. `pane` is dropped (docked, the pane draws `selected`); `band` keeps the
 * band's own size, minimised or its list, for the band drawn above the prompt while work is in progress.
 */
export function dockedFromBand(v: LensView, paneOpen: boolean): LensView {
  const { pane: _pane, ...rest } = paneOpen ? paneViewOf(v) : { ...v, size: 'normal', prev: [] }
  return { ...rest, band: v.size === 'normal' ? 'normal' : 'minimised' }
}

/**
 * Step 36.2, amendment 8: the view as the band draws it while the view is docked (shown only while a workflow is in
 * progress): the band's own size (`band`, minimised unless its list was kept), never the docked pane's; no size to restore.
 */
export const dockedBandViewOf = (v: LensView): LensView => ({ ...v, size: v.band === 'normal' ? 'normal' : 'minimised', prev: [] })

/**
 * The start date in a run folder's name, `{LIFECYCLE}-{YYYYMMDD}-{feature-slug}` (local midnight), else null
 * (no such name, or not a real date).
 */
export function folderDateOf(dir: string): number | null {
  const m = /^[a-z][a-z0-9]*-(\d{4})(\d{2})(\d{2})(?:-|$)/.exec(runIdOf(dir))
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])]
  const at = new Date(y, mo, d)
  return at.getFullYear() === y && at.getMonth() === mo && at.getDate() === d ? at.getTime() : null
}

/**
 * When a run started, for the workflow view's order: the earliest spawn the lens recorded for it (its
 * members' `startedAt`, every session's, once `unifyRuns` has joined them), so a run resumed later keeps
 * its first start. A run with no spawn (its calls not started yet, or known only from disk): the date in
 * its folder name, then `started:` (or `created:`) in its run.md front matter. null when none is known.
 */
export function runStartOf(members: readonly Pick<LensAgent, 'id' | 'startedAt'>[], dirs: readonly string[], runs: Record<string, LensRun>): number | null {
  const earliest = (xs: (number | null)[]): number | null => {
    const ok = xs.filter((x): x is number => x !== null && Number.isFinite(x))
    return ok.length > 0 ? Math.min(...ok) : null
  }
  return (
    earliest(members.filter(a => a.id !== 'main' && a.startedAt > 0).map(a => a.startedAt)) ??
    earliest(dirs.map(folderDateOf)) ??
    earliest(dirs.map(d => {
      const at = own(runs, d)?.started
      return at === undefined ? null : Date.parse(at)
    }))
  )
}

/**
 * Step 27.1: a workflow's run as the view lists it. `id`: its run's identity, the top run when a child run
 * (`parent:`, `roots`) is drawn in it, else the first member's run ('' for none). `start`: the top run's start
 * (`runStartOf` over the top run's own members and folders, its run.md included when read); a child run's
 * spawns count only when nothing of the top run gives a start. With no child run, as `runStartOf` alone.
 */
export function workflowRunOf(members: readonly LensAgent[], runs: Record<string, LensRun>, roots: Record<string, string> = {}): { id: string; start: number | null } {
  const dirs = [...new Set(members.map(a => runDirOf(a)).filter((d): d is string => d !== null))]
  const isChild = (d: string) => own(roots, runIdOf(d)) !== undefined
  const id = dirs.map(d => own(roots, runIdOf(d)) ?? runIdOf(d)).find(x => x !== '') ?? ''
  const children = dirs.filter(isChild)
  if (children.length === 0) return { id, start: runStartOf(members, dirs, runs) }
  const tops = dirs.filter(d => !isChild(d))
  for (const c of children) {
    const r = rootDirOf(c, runs, roots)
    if (r !== null && !tops.some(d => runIdOf(d) === runIdOf(r))) tops.push(r)
  }
  const mine = members.filter(a => {
    const d = runDirOf(a)
    return d !== null && !isChild(d)
  })
  return { id, start: runStartOf(mine, tops, runs) ?? runStartOf(members, dirs, runs) }
}

/**
 * The workflow view's order of runs: newest start first (`runStartOf`). A run with no start known (a call
 * not started yet that names no run folder) is the newest. Equal starts: by run id (its folder name, else
 * the workflow id), A to Z.
 */
export function newestFirst<T extends { start: number | null; id: string }>(runs: readonly T[]): T[] {
  const at = (r: T) => (r.start === null ? Infinity : r.start)
  return [...runs].sort((a, b) => at(b) - at(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** Surfaces that draw the AbovePrompt band (d.ts:10809-10819: "Raised on the terminal and desktop surfaces only"). */
export const BAND_SURFACES = new Set(['terminal', 'desktop'])

/** Whether every attached surface draws the band, so a pinned view needs no pane; none attached (or unknown) is false. */
export const bandEverywhere = (surfaces: readonly string[]): boolean => surfaces.length > 0 && surfaces.every(s => BAND_SURFACES.has(s))

// ---- step 8.6.1 (was 30.1): one flowchart per top-level step (feature root) of a run ----

/** One record file of a run folder, read from its name. `step`: its code's first number. */
export type StepRecord = { file: string; code: string; step: number; from: string; to: string; kind: 'handoff' | 'handback' }

const RECORD_NAME = /^(\d+)((?:\.(?:\d+|l\d+))*)-([a-z0-9]+(?:-[a-z0-9]+)*?)-to-([a-z0-9]+(?:-[a-z0-9]+)*?)(?:\.(handoff|handback))?\.md$/i

/**
 * A record file's name: `<code>-<from>-to-<to>.handoff.md` or `.handback.md` (the handoff skill's *Naming*),
 * or the oldest form `<code>-<from>-to-<to>.md`, a brief written before the suffixes (steps 1 and 2 of
 * FEAT-20261020-ai-dlc-lens: `01-orchestrator-to-product-manager.md`). The first number drops its leading
 * zeros (`01` is step 1). null for any other file: run.md and its versions (`isRunStateFile`), `merged-from-<run>.md`, plans, notes.
 */
export function parseRecordName(file: string): StepRecord | null {
  if (isRunStateFile(file)) return null
  const m = RECORD_NAME.exec(file)
  if (!m) return null
  const step = Number(m[1])
  return { file, code: `${step}${m[2] ?? ''}`, step, from: m[3]!.toLowerCase(), to: m[4]!.toLowerCase(), kind: (m[5] ?? '').toLowerCase() === 'handback' ? 'handback' : 'handoff' }
}

/** A step code's parent: the code without its last segment (`28.1.l2` -> `28.1`, `19.6.1.l2.1` -> `19.6.1.l2`); null for a top-level step. */
export const parentCode = (code: string): string | null => (code.includes('.') ? code.slice(0, code.lastIndexOf('.')) : null)

/** A step code's top-level step (`28.1.l2` -> 28). */
export const topStepOf = (code: string): number => Number(code.split('.')[0])

/** Code order, segment by segment: a code before the codes under it; numbers by value, before loop rounds (`19.7`, then `19.l1`); rounds by value. */
export function compareCodes(a: string, b: string): number {
  const x = a.split('.')
  const y = b.split('.')
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const p = x[i]
    const q = y[i]
    if (p === undefined) return -1
    if (q === undefined) return 1
    const lp = /^l/i.test(p)
    const lq = /^l/i.test(q)
    if (lp !== lq) return lp ? 1 : -1
    const d = Number(p.replace(/^l/i, '')) - Number(q.replace(/^l/i, ''))
    if (d !== 0) return d
  }
  return 0
}

/**
 * One node of a step's tree. `worker`: the agent that worked it, the receiver of its handoff (else the sender of
 * its hand-back); `from`: who handed it over; `handoff` / `handback`: the record files (null: none); `recorded`:
 * false for a code no record has, kept so its sub-steps stay connected (`19.6` between `19` and `19.6.1`);
 * `loop`: a loop round, drawn with a two-way arrow: a code ending in `.l<k>` that has a record (the older naming,
 * where `.l<k>` was round k), or a round `<sub-root>.l<k>.<r>` of the current naming (the handoff skill, *Naming*,
 * Loops and rounds), whose loop code `.l<k>` has no record and is no node: the round hangs under the sub-root.
 */
export type StepNode = { code: string; parent: string | null; from: string; worker: string; handoff: string | null; handback: string | null; loop: boolean; recorded: boolean }

/** A code whose last segment is a loop, `.l<k>`. */
const LOOP_CODE = /\.l\d+$/i

/** One top-level step: its nodes in code order, the step itself first, every node after its parent. */
export type StepTree = { step: number; nodes: StepNode[] }

/**
 * The run's steps from its records, one tree per top-level step (ascending). Every code a record has is a
 * node, hung under its prefix (`parentCode`): `28.1`-`28.6` under `28`, the loop rounds `28.1.l1`-`28.1.l3`
 * under `28.1`, `19.6.1.l2.1` under `19.6.1.l2`, then `19.6.1`, `19.6`, `19`; a prefix no record has is a
 * node too, except a loop code (`.l<k>` last) that no record or spawn has: a loop is never a record, so its rounds
 * (`5.3.l1.1`, `5.3.l1.2`) hang under its sub-root (`5.3`) as loop rounds, and a round's own sub-numbers
 * (`5.4.l1.1.2`) under the round. `extra`: codes with no record on disk yet (a live spawn's), added the same way.
 */
export function stepTrees(records: readonly StepRecord[], extra: readonly string[] = []): StepTree[] {
  const byCode = new Map<string, { handoff: StepRecord | null; handback: StepRecord | null }>()
  for (const r of [...records].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))) {
    const e = byCode.get(r.code) ?? { handoff: null, handback: null }
    if (r.kind === 'handoff') e.handoff ??= r
    else e.handback ??= r
    byCode.set(r.code, e)
  }
  const known = new Set<string>([...byCode.keys(), ...extra])
  const bareLoop = (c: string) => LOOP_CODE.test(c) && !known.has(c)
  /** A code's node parent: its prefix, past a loop code that is no node. */
  const hangOf = (c: string): string | null => {
    let p = parentCode(c)
    while (p !== null && bareLoop(p)) p = parentCode(p)
    return p
  }
  const codes = new Set<string>()
  for (const c of known) for (let x: string | null = c; x !== null && !codes.has(x); x = parentCode(x)) if (!bareLoop(x)) codes.add(x)
  const steps = new Map<number, string[]>()
  for (const c of codes) steps.set(topStepOf(c), [...(steps.get(topStepOf(c)) ?? []), c])
  return [...steps.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([step, cs]) => ({
      step,
      nodes: cs.sort(compareCodes).map(code => {
        const e = byCode.get(code)
        const ho = e?.handoff ?? null
        const hb = e?.handback ?? null
        const parent = hangOf(code)
        const loop = LOOP_CODE.test(code) || parent !== parentCode(code)
        return { code, parent, from: ho?.from ?? hb?.to ?? '', worker: ho?.to ?? hb?.from ?? '', handoff: ho?.file ?? null, handback: hb?.file ?? null, loop, recorded: e !== undefined }
      }),
    }))
}

/** The key of the chart for spawns whose brief names no record (they belong to no step). */
export const NO_STEP = 'no-step'

/**
 * One step chart of a workflow, ready to draw. `key`: `<step>`, `<child run id>:<step>` for a child run's
 * step (`parent:`), or NO_STEP. `ids`: drawing order, the step first; `agents`: the nodes as LensAgents (a live
 * spawn as itself, a record as a stand-in whose `handoff` is the record's path); `codes`: each node's step code;
 * `bare`: the nodes no record has (the step as such, drawn with its sender's avatar); `start`: the first live
 * spawn in it, null when it is drawn from records only.
 */
export type StepChart = {
  key: string
  step: number | null
  title: string
  stage: string
  dir: string
  ids: string[]
  agents: Record<string, LensAgent>
  codes: Record<string, string>
  bare: string[]
  start: number | null
}

/** A run folder a workflow draws: its record names (`LensRun.records`), its stages (`LensRun.stages`), and whether it is a child run drawn in the workflow's top run. */
export type StepSource = {
  dir: string
  names: readonly string[]
  stages: Record<string, string>
  child: boolean
  /** `LensRun.features` (each root's feature name), `LensRun.renames` (old code -> new code prefixes) and `LensRun.codeMap` (per-code renames). */
  features?: Record<string, string>
  renames?: Record<string, string>
  codeMap?: Record<string, string>
}

/** The key of the chart for live spawns whose brief names a record that is not on disk under that name or the one it was renamed to. */
export const NOT_FOUND = 'not-found'

const normPath = (d: string): string => d.replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/\/+$/, '')

const standIn = (id: string, parent: string | null, type: string, status: string, handoff: string | null, prompt: string, loop: boolean): LensAgent => ({
  id,
  parent,
  type,
  name: '',
  description: '',
  model: '',
  callModel: '',
  parentModel: '',
  prompt,
  status,
  toolUseId: '',
  steps: ZERO,
  turns: ZERO,
  last: null,
  handoff,
  handoffHow: 'record',
  loop,
  startedAt: 0,
  endedAt: null,
  bg: [],
  reqs: [],
})

/** An agent id from a record name as an agent type: the plugin's agents are `ai-dlc:<id>`; `human` and a typed id stay as they are. */
const typeOfWorker = (worker: string): string => (worker === 'human' || worker.includes(':') ? worker : `ai-dlc:${worker || 'orchestrator'}`)

/** A step's stage, from its run.md *Stages* rows: the row of the step itself, else its first sub-step's row, else ''. */
export function stageOfStep(stages: Record<string, string>, step: number): string {
  const self = stages[String(step)]
  if (self !== undefined) return self
  const sub = Object.keys(stages)
    .filter(c => c.includes('.') && topStepOf(c) === step)
    .sort(compareCodes)[0]
  return sub === undefined ? '' : (stages[sub] ?? '')
}

/**
 * A step chart's title: `Step <n> · <name>`, the name from run.md's *Features* table (a chart is one feature
 * root, so it is titled by its feature), else its *Stages* rows (`stageOfStep`), else `Step <n>` alone; a child
 * run's step is prefixed with the child's folder name.
 */
export function stepTitle(src: Pick<StepSource, 'dir' | 'stages' | 'child' | 'features'>, step: number): string {
  const name = own(src.features ?? {}, String(step)) ?? stageOfStep(src.stages, step)
  return `${src.child ? `${folderNameOf(src.dir)}: ` : ''}Step ${step}${name !== '' ? ` · ${name}` : ''}`
}

/**
 * Where a brief's record is drawn. Its run folder among `sources`, else (a run merged away) the run that keeps
 * its records, its code moved by that run's offset (`redirect`, `shiftCode`). In a run whose records were
 * renamed (its source has `renames` or a `codeMap`) and listed, a record is looked up on disk: under its own name,
 * else under the code it was renamed to, the per-code map first (`codeMap`: a code that is one of its keys is a code
 * from just before that renaming, so the older `renames` prefixes, whose keys can collide with it, are not applied),
 * else the `renames` prefixes (`renameCode`) and then the per-code map, else the prefixes alone. The first of these
 * names that is listed wins. Found under none: unchecked when its root is one the run has now
 * (its *Features* table or its listed records), since a record written just before its spawn may be newer than
 * the listing; else `'gone'`, a brief written before the renumbering whose record no longer exists, kept out of
 * the step charts. `path`: the record on disk, as listed (its case kept), so the brief opens it; null when it was
 * not checked. Any other run: the code as named, unchecked. null: no source for the folder.
 */
export function locateRecord(
  rec: { dir: string; code: string; from: string; to: string },
  sources: readonly StepSource[],
  redirect: Record<string, { dir: string; offset: number }> = {},
): { src: StepSource; code: string; path: string | null } | 'gone' | null {
  const srcOf = (dir: string) => sources.find(s => runIdOf(s.dir) === runIdOf(dir))
  let src = srcOf(rec.dir)
  let code = rec.code
  if (src === undefined) {
    const r = own(redirect, runIdOf(rec.dir))
    const home = r === undefined ? undefined : srcOf(r.dir)
    if (r !== undefined && home !== undefined) {
      src = home
      code = shiftCode(code, r.offset)
    }
  }
  if (src === undefined) return null
  const dir = normPath(src.dir)
  const fileOf = (c: string) => `${c}-${rec.from}-to-${rec.to}.handoff.md`.toLowerCase()
  const renames = src.renames ?? {}
  const map = src.codeMap ?? {}
  if (src.names.length === 0 || (Object.keys(renames).length === 0 && Object.keys(map).length === 0)) return { src, code, path: null }
  // Names match in any case; the path keeps the case on disk, which a case-sensitive file system needs.
  const listed = new Map(src.names.map(n => [n.toLowerCase(), n] as const))
  const moved = renameCode(code, renames)
  const tries = [code, own(map, code), moved === null ? undefined : own(map, moved), moved].filter((c): c is string => typeof c === 'string')
  for (const c of tries) {
    const hit = listed.get(fileOf(c))
    if (hit !== undefined) return { src, code: c, path: `${dir}/${hit}` }
  }
  // Not on disk under either name. Under a root the run has now, it is taken as a record newer than the listing
  // (a live spawn's brief is far likelier fresh than from before the renumbering); under any other root, gone.
  const roots = new Set([...Object.keys(src.features ?? {}), ...src.names.map(n => parseRecordName(n)?.step).filter((x): x is number => x !== undefined).map(String)])
  return roots.has(String(topStepOf(code))) ? { src, code, path: null } : 'gone'
}

/** A code moved by a merge offset: its first number plus `offset` (`1.6.1.l3` + 18 -> `19.6.1.l3`). */
export const shiftCode = (code: string, offset: number): string => {
  const [head, ...rest] = code.split('.')
  return [String(Number(head) + offset), ...rest].join('.')
}

/**
 * A workflow's charts, one per top-level step (feature root) of its run, sub-steps connected to their parent, drawn from the records on disk
 * (`sources`) and from the live spawns (`live`: the workflow's agents as drawn, the spawner left out, `parent` as
 * drawn). Each chart's root is the step itself, drawn as its sender (the orchestrator, the one who wrote most of
 * its handoffs); the step's own record, when it has one, is a node under the root, with that record's loop rounds
 * under it; its sub-steps hang under the root, and deeper codes under their prefix (`stepTrees`).
 * A live spawn takes the node of its brief's record code (its live status replaces the record's); one
 * whose record is not on disk yet adds its code. A brief naming a run merged away (`redirect`: its run id -> the
 * run keeping its records and the step offset of the merge) joins that run's step k + offset. A spawn with no
 * record hangs under the spawn that made it, else goes to the NO_STEP chart under the spawner. A record node's
 * status: `completed` with a hand-back, else OPEN. The step itself: the spawner's status while a live spawn under it
 * is at work, `idle` once they all ended (only the orchestrator rests), `completed` with no live spawn; a code
 * between it and a record that no record has: `idle` over live spawns, else `completed` (never blinking).
 */
export function stepCharts(
  sources: readonly StepSource[],
  live: readonly LensAgent[],
  spawner: LensAgent,
  redirect: Record<string, { dir: string; offset: number }> = {},
): StepChart[] {
  const srcs: StepSource[] = sources.map(s => ({ ...s, dir: normPath(s.dir) }))
  const keyOf = (s: StepSource, step: number) => (s.child ? `${runIdOf(s.dir)}:${step}` : String(step))
  const liveIds = new Set(live.map(a => a.id))
  // Each live spawn with a record: its source and code.
  const placed = new Map<StepSource, Map<string, LensAgent[]>>()
  const unplaced: LensAgent[] = []
  const gone: LensAgent[] = []
  for (const a of [...live].sort((x, y) => x.startedAt - y.startedAt)) {
    const path = a.handoff ?? matchHandoff(a.prompt)?.path ?? null
    const rec = path === null ? null : parseRecord(path)
    if (rec === null) {
      unplaced.push(a)
      continue
    }
    const at = locateRecord(rec, srcs, redirect)
    if (at === 'gone') {
      gone.push(a)
      continue
    }
    let src = at?.src
    let code = at?.code ?? rec.code
    // A brief that names an old code (or a merged-away folder) opens the record on disk it was renamed to.
    const moved = at !== null && at.path !== null && at.path !== normPath(path!) ? { ...a, handoff: at.path } : a
    if (src === undefined) {
      src = { dir: normPath(rec.dir), names: [], stages: {}, child: srcs.length > 0 }
      srcs.push(src)
      code = rec.code
    }
    const m = placed.get(src) ?? new Map<string, LensAgent[]>()
    m.set(code, [...(m.get(code) ?? []), moved])
    placed.set(src, m)
  }
  const charts: StepChart[] = []
  const chartOfId = new Map<string, StepChart>()
  for (const src of srcs) {
    const lv = placed.get(src) ?? new Map<string, LensAgent[]>()
    const records = src.names.map(parseRecordName).filter((r): r is StepRecord => r !== null)
    for (const tree of stepTrees(records, [...lv.keys()])) {
      const key = keyOf(src, tree.step)
      // The step's sender (the one who wrote most of its handoffs): the avatar of a node no record has.
      const count = new Map<string, number>()
      for (const n of tree.nodes) if (n.from !== '') count.set(n.from, (count.get(n.from) ?? 0) + 1)
      const sender = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'orchestrator'
      const stage = own(src.features ?? {}, String(tree.step)) ?? stageOfStep(src.stages, tree.step)
      const c: StepChart = {
        key,
        step: tree.step,
        title: stepTitle(src, tree.step),
        stage,
        dir: src.dir,
        ids: [],
        agents: {},
        codes: {},
        bare: [],
        start: null,
      }
      // The step itself is the root: its sender (the orchestrator), drawn as the step. Its own record (`28`
      // has none, `17` has one) is a node under it, and the loop rounds of that record (`17.l1`) hang under that
      // node; sub-steps (`28.1`, `19.2`) hang under the step; deeper codes under their prefix.
      const top = String(tree.step)
      const rootId = `step:${key}`
      const path = (f: string | null) => (f === null ? null : `${src.dir}/${f}`)
      c.agents[rootId] = standIn(rootId, null, typeOfWorker(sender), 'completed', null, `Step ${top}${stage !== '' ? `: ${stage}` : ''}`, false)
      c.ids.push(rootId)
      c.codes[rootId] = top
      c.bare.push(rootId)
      const idOf = new Map<string, string>()
      for (const n of tree.nodes) {
        const here = lv.get(n.code) ?? []
        if (n.code === top && !n.recorded && here.length === 0) continue
        const parent =
          n.parent === null ? rootId : n.parent === top ? (n.loop ? (idOf.get(top) ?? rootId) : rootId) : (idOf.get(n.parent) ?? rootId)
        if (here.length > 0) {
          idOf.set(n.code, here[0]!.id)
          for (const a of here) {
            c.agents[a.id] = { ...a, parent, loop: a.loop || n.loop }
            c.ids.push(a.id)
            c.codes[a.id] = n.code
          }
          continue
        }
        const id = `step:${key}:${n.code}`
        idOf.set(n.code, id)
        const status = !n.recorded || n.handback !== null ? 'completed' : OPEN
        const prompt = n.handoff === null && n.handback !== null ? `No handoff record on disk for step ${n.code}; its hand-back is ${path(n.handback)}.` : ''
        c.agents[id] = standIn(id, parent, typeOfWorker(n.recorded ? n.worker : sender), status, path(n.handoff), prompt, n.loop)
        c.ids.push(id)
        c.codes[id] = n.code
        if (!n.recorded) c.bare.push(id)
      }
      charts.push(c)
      for (const id of c.ids) chartOfId.set(id, c)
    }
  }
  // Briefs naming a record that is gone (`locateRecord`): one chart under the spawner, which the workflow view
  // draws as one collapsed line, never as a step chart; what they spawned joins them below.
  if (gone.length > 0) {
    const c = spawnerChart(NOT_FOUND, 'Briefs naming records no longer on disk', spawner, gone, () => spawner.id)
    for (const id of c.ids.slice(1)) chartOfId.set(id, c)
    charts.push(c)
  }
  // Spawns with no record: under the spawn that made it (as long as that one is drawn), else NO_STEP.
  let rest = unplaced
  for (let grew = true; grew; ) {
    grew = false
    const next: LensAgent[] = []
    for (const a of rest) {
      const c = a.parent !== null && liveIds.has(a.parent) ? chartOfId.get(a.parent) : undefined
      if (c === undefined) {
        next.push(a)
        continue
      }
      c.agents[a.id] = { ...a }
      c.ids.push(a.id)
      c.codes[a.id] = ''
      chartOfId.set(a.id, c)
      grew = true
    }
    rest = next
  }
  if (rest.length > 0) charts.push(spawnerChart(NO_STEP, 'Spawns with no step record', spawner, rest, a => (a.parent !== null && rest.some(b => b.id === a.parent) ? a.parent : spawner.id)))
  // The statuses of the nodes no record has, and each chart's first live spawn.
  for (const c of charts) {
    const lives = c.ids.filter(id => liveIds.has(id)).map(id => c.agents[id]!)
    const starts = lives.map(a => a.startedAt).filter(x => x > 0)
    c.start = starts.length > 0 ? Math.min(...starts) : null
    const under = (id: string): LensAgent[] =>
      lives.filter(a => {
        for (let p = a.parent, i = 0; p !== null && i < 64; p = c.agents[p]?.parent ?? null, i++) if (p === id) return true
        return false
      })
    for (const id of c.bare) {
      // Only the step itself takes the spawner's status (it blinks while the spawner runs and its agents work); a
      // code between it and a record (`1.2` above `1.2.l1`) is steady.
      const below = under(id)
      const status = id === c.ids[0] && below.some(atWork) ? spawner.status : below.length > 0 ? 'idle' : 'completed'
      c.agents[id] = { ...c.agents[id]!, status }
    }
  }
  return charts
}

/**
 * A chart under the spawner for spawns that belong to no step (NOT_FOUND, NO_STEP): the spawner on top, resting
 * once its spawns ended, then each spawn under `parentOf(spawn)`.
 */
function spawnerChart(key: string, title: string, spawner: LensAgent, spawns: readonly LensAgent[], parentOf: (a: LensAgent) => string): StepChart {
  const c: StepChart = { key, step: null, title, stage: '', dir: '', ids: [spawner.id], agents: { [spawner.id]: { ...spawner, parent: null } }, codes: { [spawner.id]: '' }, bare: [], start: null }
  for (const a of spawns) {
    c.agents[a.id] = { ...a, parent: parentOf(a) }
    c.ids.push(a.id)
    c.codes[a.id] = ''
  }
  c.agents[spawner.id] = restingSpawner(c.agents[spawner.id]!, spawns.map(a => c.agents[a.id]!))
  return c
}

/**
 * The step charts' order: by step number, highest first (12, 11, … 1), whether or not a live spawn is in it, so
 * a chart keeps its place while its agents work. The run's own steps come before a child run's, which follow by
 * child folder then step, highest first; then the chart of spawns with no step; NOT_FOUND last. Inside a chart
 * the nodes stay in code order (`stepTrees`). Ties: by key.
 */
export function stepsDescending<T extends { step: number | null; key: string }>(charts: readonly T[]): T[] {
  const rank = (c: T) => (c.key === NOT_FOUND ? 3 : c.step === null ? 2 : c.key.includes(':') ? 1 : 0)
  const child = (c: T) => (c.key.includes(':') ? c.key.slice(0, c.key.lastIndexOf(':')) : '')
  return [...charts].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b)
    if (child(a) !== child(b)) return child(a) < child(b) ? -1 : 1
    const d = (b.step ?? 0) - (a.step ?? 0)
    if (d !== 0) return d
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
  })
}

/** One chart of a chat card: `key` / `title` from `place`, the spawner on top, then that group's agents. */
export type CardChart = { key: string; title: string; ids: string[]; agents: Record<string, LensAgent> }

/**
 * A chat card's chart split by task, so agents spawned together for unrelated tasks are not drawn as one. `place`
 * names each spawned agent's task (its run and feature root; register.tsx `cardPlace`); agents of one task share a
 * chart. A member whose task is unknown (`key` ''; a brief with no record, or one naming a record that is gone)
 * has no chart of its own: it joins the first task's. What a member spawned goes with that member; a spawner drawn
 * between the root and a member (`batchView`) goes into every chart that has a member under it. One task (or none):
 * one chart, the view as it is.
 */
export function cardCharts(view: { ids: string[]; agents: Record<string, LensAgent>; members: string[] }, place: (a: LensAgent) => { key: string; title: string }): CardChart[] {
  const root = view.ids[0] ?? ''
  const groupOf = new Map<string, string>()
  const titles = new Map<string, string>()
  for (const m of view.members) {
    const a = view.agents[m]
    if (m === root || a === undefined || groupOf.has(m)) continue
    const p = place(a)
    if (p.key === '') continue
    groupOf.set(m, p.key)
    if (!titles.has(p.key)) titles.set(p.key, p.title)
  }
  const keys = [...titles.keys()]
  if (keys.length <= 1) return [{ key: keys[0] ?? '', title: titles.get(keys[0] ?? '') ?? '', ids: view.ids, agents: view.agents }]
  const chain = (id: string): string[] => {
    const out: string[] = []
    for (let p = view.agents[id]?.parent ?? null, i = 0; p !== null && p !== root && i < 64; p = view.agents[p]?.parent ?? null, i++) out.push(p)
    return out
  }
  const inGroup = new Map<string, Set<string>>(keys.map(k => [k, new Set<string>()]))
  for (const id of view.ids) {
    if (id === root) continue
    const up = [id, ...chain(id)]
    const g = up.map(x => groupOf.get(x)).find((x): x is string => x !== undefined) ?? keys[0]!
    const set = inGroup.get(g)!
    set.add(id)
    for (const p of chain(id)) set.add(p)
  }
  return keys.map(k => {
    const set = inGroup.get(k)!
    const ids = view.ids.filter(id => id === root || set.has(id))
    const agents: Record<string, LensAgent> = {}
    for (const id of ids) agents[id] = view.agents[id]!
    const members = ids.filter(id => groupOf.get(id) === k).map(id => agents[id]!)
    if (agents[root] !== undefined) agents[root] = restingSpawner(agents[root]!, members)
    return { key: k, title: titles.get(k)!, ids, agents }
  })
}

/**
 * The task a spawned agent works for a chat card (`cardCharts`): its run and feature root, from its
 * brief's record (`locateRecord`, so an old code counts under the root it was renamed to). A brief with no record,
 * or one naming a record that is gone: no task of its own (key ''); a run the lens has not read: its folder and the
 * code's first number.
 */
export function spawnPlace(a: LensAgent, sources: readonly StepSource[], redirect: Record<string, { dir: string; offset: number }> = {}): { key: string; title: string } {
  const path = a.handoff ?? matchHandoff(a.prompt)?.path ?? null
  const rec = path === null ? null : parseRecord(path)
  if (rec === null) return { key: '', title: '' }
  const at = locateRecord(rec, sources, redirect)
  if (at === 'gone') return { key: '', title: '' }
  if (at === null) return { key: `${runIdOf(rec.dir)}:${topStepOf(rec.code)}`, title: `${folderNameOf(rec.dir)}: Step ${topStepOf(rec.code)}` }
  const step = topStepOf(at.code)
  return { key: `${runIdOf(at.src.dir)}:${step}`, title: stepTitle(at.src, step) }
}

// ---- versioned run state (`run.v1.md`, `run.v1.1.md`, `run.v1.2.md`, `run.v2.md`, …) ----

/**
 * A versioned run-state file name, `run.v<major>.md` or `run.v<major>.<minor>.md`, lower case as the handoff
 * skill names them (*Run state*, Versions). Each part is a positive number with no leading zero (`[1-9]\d*`), so
 * `run.v0.md`, `run.v01.md` and `run.v1.0.md` are not versions. Kept identical to `VERSION_NAME` in the ai-dlc
 * plugin's `hooks/auto-handoff/run.ts`, the module that writes these files: the lens must show the same current
 * run state the writer picks. The two modules are licensed apart, so the pattern is copied, not shared.
 */
export const RUN_VERSION = /^run\.v([1-9]\d*)(?:\.([1-9]\d*))?\.md$/

/** A run-state file, the legacy `run.md` or a version (`RUN_VERSION`). Never a record or a chart node. */
export const isRunStateFile = (name: string): boolean => name === 'run.md' || RUN_VERSION.test(name)

/** A run version's order: major, then minor (a bare major is minor 0), both numeric (`v1.10 > v1.9`, `v10 > v9`). */
const byVersionDesc = (a: { major: number; minor: number; name: string }, b: { major: number; minor: number; name: string }) =>
  b.major - a.major || b.minor - a.minor || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)

/** A run folder's versioned run-state files (`RUN_VERSION`), the current (highest) version first: `v2 > v1.2 > v1.1 > v1`. */
export function runVersions(names: readonly string[]): { major: number; minor: number; name: string }[] {
  return names
    .map(name => ({ name, m: RUN_VERSION.exec(name) }))
    .filter((x): x is { name: string; m: RegExpExecArray } => x.m !== null)
    .map(x => ({ major: Number(x.m[1]), minor: x.m[2] === undefined ? 0 : Number(x.m[2]), name: x.name }))
    .sort(byVersionDesc)
}

/**
 * The run state to read among a folder's file `names`: the highest version (`runVersions`) that `read` can read,
 * read highest first and no further than the first readable one; null when none (then `run.md`). The current
 * version is always the highest: an older one is deprecated by a newer `.1` minor saying so, never by its own
 * front matter, so no deprecation field is read.
 */
export async function pickRunState(names: readonly string[], read: (name: string) => Promise<string | null> | string | null): Promise<{ name: string; text: string } | null> {
  for (const v of runVersions(names)) {
    const text = await read(v.name)
    if (text !== null) return { name: v.name, text }
  }
  return null
}
