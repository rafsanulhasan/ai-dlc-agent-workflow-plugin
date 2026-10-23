// ITEM-027 spike, rounds 1-3 (steps 17, 17.l1, 17.l2): pure helpers of the lens card. No `$` here.
import type { LensAgent, LensBatch, LensDef, LensPending, LensTask, Tokens } from '../types'

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
  maxOutput: number | null
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Every numeric leaf of an entry, keyed by its path with the separators dropped (`pricing.cacheWrite5m` -> `pricingcachewrite5m`). */
function leaves(v: unknown, path = '', out: [string, number][] = []): [string, number][] {
  if (typeof v === 'number' && Number.isFinite(v)) out.push([norm(path), v])
  else if (v !== null && typeof v === 'object' && !Array.isArray(v)) for (const [k, x] of Object.entries(v as Record<string, unknown>)) leaves(x, path + '.' + k, out)
  return out
}

const first = (ls: [string, number][], ok: (k: string) => boolean): number | null => ls.find(([k]) => ok(k))?.[1] ?? null

/**
 * One entry's facts. The file's schema is being written in parallel (AAW-20261023-model-costing-hook),
 * so the keys are matched by name, not position: prices are $ per million tokens.
 */
export function factsOf(id: string, entry: unknown): ModelFacts {
  const ls = leaves(entry)
  const isTokens = (k: string) => /token|window|max|context/.test(k)
  return {
    id,
    cacheRead: first(ls, k => /cache.*(read|hit)|(read|hit).*cache/.test(k) && !isTokens(k)),
    cacheWrite5m: first(ls, k => /(cache.*(write|creation)|write.*cache).*5m|5m.*(write|creation)/.test(k) && !isTokens(k)),
    cacheWrite1h: first(ls, k => /(cache.*(write|creation)|write.*cache).*1h|1h.*(write|creation)/.test(k) && !isTokens(k)),
    input: first(ls, k => /input/.test(k) && !/cache|long|batch/.test(k) && !isTokens(k)),
    output: first(ls, k => /output/.test(k) && !/long|batch/.test(k) && !isTokens(k)),
    window: first(ls, k => /window/.test(k) && !/long|1m|extended/.test(k)),
    longWindow: first(ls, k => /window/.test(k) && /long|1m|extended/.test(k)),
    maxOutput: first(ls, k => /max.*output|output.*max/.test(k)),
  }
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

/**
 * Cost from the file's prices only (finding 4): never estimated, `—` when the file, the model or a
 * needed price is missing. Cache writes are priced at the 5-minute rate: `ModelUsage` does not say
 * the TTL (D:6605-6627), so the label says so.
 */
export function costOf(c: Costing, model: string, t: Tokens, rate: string = '5m'): { text: string; source: string } {
  if (c.text === '') return { text: '—', source: c.error !== '' ? c.error : `${c.path} not found` }
  const json = parseCosting(c)
  if (json === null) return { text: '—', source: `${c.path} is not valid JSON` }
  const f = lookupModel(json, model)
  if (f === null) return { text: '—', source: `${model || 'the model'} is not in ${c.path}` }
  const need: [number | null, number, string][] = [
    [f.input, t.in, 'input'],
    [f.output, t.out, 'output'],
    [f.cacheRead, t.cr, 'cache read'],
    [rate === '1h' ? f.cacheWrite1h : f.cacheWrite5m, t.cw, `cache write ${rate === '1h' ? '1h' : '5m'}`],
  ]
  const missing = need.filter(([p, n]) => p === null && n > 0).map(([, , k]) => k)
  if (missing.length > 0) return { text: '—', source: `${c.path} has no ${missing.join(', ')} price for ${f.id}` }
  const usd = need.reduce((s, [p, n]) => s + (p ?? 0) * n, 0) / 1_000_000
  return { text: `$${usd.toFixed(usd < 1 ? 4 : 2)}`, source: `${c.path} (${f.id}; cache writes at the ${rate === '1h' ? '1-hour' : '5-minute'} rate: the usage does not say the TTL)` }
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
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="sans-serif">`,
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
      `<text x="${p.x}" y="${p.y + 4}" text-anchor="middle" font-size="11" font-weight="bold" fill="#fff">${esc(initials(l.name))}</text>`,
    )
    ;[l.name, l.model, l.role].forEach((t, i) =>
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

/** One line for a tool call's input. */
export function summarize(tool: string, input: Record<string, unknown>): string {
  const pick = (k: string) => (typeof input[k] === 'string' ? (input[k] as string) : '')
  const s =
    pick('file_path') || pick('path') || pick('pattern') || pick('command') || pick('url') || pick('query') || pick('description') || pick('skill') || pick('to') || pick('subagent_type')
  return (s === '' ? tool : s).replace(/\s+/g, ' ').slice(0, 90)
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
