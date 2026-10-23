// ITEM-027 spike, rounds 1-6 (steps 17 to 17.l5): pure helpers of the lens card and the workflow pane. No `$` here.
import type { LensAgent, LensBatch, LensDef, LensPending, LensRun, LensTask, LensWorkflows, Tokens } from '../types'

export const ZERO: Tokens = { in: 0, out: 0, cr: 0, cw: 0 }

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
    .map(w => ROLE_WORDS[w.toLowerCase()] ?? w[0]!.toUpperCase() + w.slice(1))
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
  if (id !== '' && roster[id]) return roster[id]!
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
    input: first(ls, k => /input/.test(k) && !/cache|batch/.test(k) && !isTokens(k) && flat(k)),
    output: first(ls, k => /output/.test(k) && !/batch/.test(k) && !isTokens(k) && flat(k)),
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
  // Round 6: the long prices travel with their threshold, so a request over it never needs `f.long!`.
  let rule: { prices: LongPricing; threshold: number; from: string } | null = null
  if (f.long !== null) {
    const fileOverride = thresholdOverrideOf(r.json)
    if (lensThreshold !== null && lensThreshold > 0) rule = { prices: f.long, threshold: lensThreshold, from: 'the lens setting longContextThresholdTokens' }
    else if (fileOverride !== null) rule = { prices: f.long, threshold: fileOverride, from: `${c.path} longContextThresholdTokensOverride` }
    else if (f.long.threshold !== null) rule = { prices: f.long, threshold: f.long.threshold, from: `${f.id} longContextPricing.thresholdTokens` }
    else return none(`${f.id} has long-context prices but ${c.path} gives no threshold`)
  }
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
  const m = /^(\d+(?:\.\d+)*(?:\.l\d+)?)-(.+?)-to-(.+)\.handoff\.md$/.exec(file)
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

export type Placed = { id: string; x: number; y: number; depth: number }

/** The chart's sizes and blink (lens settings `chartColumnPx`, `chartRowPx`, `avatarRadiusPx`, `blink`, `blinkMs`). */
export type ChartSize = { col: number; row: number; r: number; blink: boolean; blinkMs: number }
/** Round 3 defaults (finding 1a: smaller than round 2's 200 x 210). */
export const SIZE0: ChartSize = { col: 120, row: 96, r: 14, blink: true, blinkMs: 1000 }

/** Tree layout: the top agent first, each level below its spawner's. */
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
  const widest = Math.max(1, ...levels.map(l => (l ?? []).length))
  const width = widest * size.col
  const placed: Placed[] = []
  levels.forEach((ids, depth) => {
    const n = (ids ?? []).length
    ;(ids ?? []).forEach((id, i) => placed.push({ id, depth, x: Math.round((width / n) * (i + 0.5)), y: size.r + 8 + depth * size.row }))
  })
  return { placed, width, height: Math.max(1, levels.length) * size.row - 10 }
}

/**
 * The flowchart: one avatar per agent with its initials, three lines under it (name, model,
 * role), an arrow per spawn; a loop's arrow has a head at each end. No ctx, tokens or cache.
 */
export function flowchartSvg(order: readonly string[], agents: Record<string, LensAgent>, label: (a: LensAgent) => ChartLabel, size: ChartSize = SIZE0): { source: string; width: number; height: number } {
  const { placed, width, height } = layout(order, agents, size)
  const at = new Map(placed.map(p => [p.id, p] as const))
  const R = size.r
  const parts: string[] = []
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
    const fill = a.status === 'failed' || a.status === 'killed' ? '#c62828' : a.status === 'waiting' ? '#f9a825' : a.status === 'pending' ? '#90a4ae' : '#2e7d32'
    parts.push(
      `<circle cx="${p.x}" cy="${p.y}" r="${R}" fill="${fill}"><title>${esc(l.name)}: ${esc(a.status)}</title>` +
        (size.blink && isRunning(a.status) ? `<animate attributeName="opacity" values="1;0.25;1" dur="${size.blinkMs / 1000}s" repeatCount="indefinite"/>` : '') +
        `</circle>`,
      // Round 5: the initials centred in the avatar both ways (middle anchor, central baseline at the circle's centre).
      `<text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="bold" fill="#fff">${esc(initials(l.name))}</text>`,
    )
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
  return [...kept, ...started, ...stop]
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
  for (const tu of batch.ids) {
    const mapped = callAgent[tu] !== undefined ? agents[callAgent[tu]!] : undefined
    const p = batch.pending[tu]
    let a = mapped ?? byCall.get(tu) ?? pendingAgent(tu, root.id, p)
    // A record a race left blank still gets its call's type, prompt and id from the call.
    if (p && a.type === '') a = { ...a, type: p.type, description: a.description || p.description, prompt: a.prompt || p.prompt, callModel: a.callModel || p.model }
    if (a.toolUseId === '') a = { ...a, toolUseId: tu }
    out[a.id] = { ...a, parent: root.id }
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
  return { ids, agents: out, members }
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

/**
 * The workflow an Agent call joins. An agent of a workflow spawning: that workflow. Otherwise (round 6)
 * the spawner's newest workflow for the same task (`keys`, from `taskKeyOf`), even when all its agents
 * have finished. Otherwise the spawner's latest workflow, while any agent in it (a descendant included)
 * is still at work. Otherwise a new workflow, named by this call: a different task, or a new spawner.
 */
export function joinWorkflow(
  wf: LensWorkflows,
  spawner: string,
  call: string,
  agents: Record<string, LensAgent>,
  callAgent: Record<string, string>,
  keys: Record<string, string> = {},
): LensWorkflows {
  if (wf.of[call] !== undefined) return wf
  const self = agents[spawner]
  let w = spawner !== 'main' && self && self.toolUseId !== '' ? wf.of[self.toolUseId] : undefined
  const key = keys[call] ?? ''
  if (w === undefined && key !== '') {
    const sameTask = new Set(Object.keys(wf.of).filter(c => c !== call && keys[c] === key).map(c => wf.of[c]!))
    w = [...wf.order].reverse().find(x => wf.parent[x] === spawner && sameTask.has(x))
  }
  if (w === undefined) {
    const latest = [...wf.order].reverse().find(x => wf.parent[x] === spawner)
    if (latest !== undefined && workflowActive(wf, latest, agents, callAgent)) w = latest
  }
  if (w === undefined) return { of: { ...wf.of, [call]: call }, by: { ...wf.by, [call]: spawner }, parent: { ...wf.parent, [call]: spawner }, order: [...wf.order, call] }
  return { ...wf, of: { ...wf.of, [call]: w }, by: { ...wf.by, [call]: spawner } }
}

/** One workflow as a batch for `batchView`: its spawner and the calls it made; what those agents spawned joins as descendants. */
export function workflowBatch(wf: LensWorkflows, w: string, batches: Record<string, LensBatch>): LensBatch {
  const parent = wf.parent[w] ?? 'main'
  const ids = Object.keys(wf.of).filter(c => wf.of[c] === w && wf.by[c] === parent)
  const pending: Record<string, LensPending> = {}
  for (const b of Object.values(batches)) for (const id of ids) if (b.pending[id]) pending[id] = b.pending[id]!
  return { parent, ids, pending }
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
  const lines = text.split(/\r?\n/)
  lines.forEach((line, i) => {
    if (/^#{1,6}\s/.test(line)) heading = line
    if (!line.startsWith('|')) {
      inStages = false
      return
    }
    if (TABLE_RULE.test(line)) return
    const cells = cellsOf(line)
    if (TABLE_RULE.test(lines[i + 1] ?? '')) {
      // The header row: it decides whether this table is the stages table.
      inStages = cells.some(x => /^stages?$/i.test(x)) || /^#{1,6}\s+stages?\b/i.test(heading)
      return
    }
    const code = cells[0] ?? ''
    if (!inStages || !STEP_CODE.test(code) || cells.length < 2) return
    const name = cells[1]!
    stages[code] = name
    if (cells.slice(2).some(x => /^in-progress\b/i.test(x))) inProgress = name
  })
  return { title: runTitle(text), status: field('status'), stage: inProgress || field('current-stage'), stages }
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
 * Agent call's `description`.
 */
export function workflowTask(members: readonly LensAgent[], runs: Record<string, LensRun>, request: string): { parent: string; current: string } {
  const titles = [
    ...new Set(
      members
        .map(a => {
          const d = runDirOf(a)
          return d === null ? '' : (runs[d]?.title ?? '')
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
 */
export function workflowTasks(members: readonly LensAgent[], runs: Record<string, LensRun>, parent: string): { title: string; ids: string[] }[] {
  const out: { title: string; ids: string[] }[] = []
  for (const a of members) {
    const title = agentTask(a, runs) || parent
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
