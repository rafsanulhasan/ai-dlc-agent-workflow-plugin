// ITEM-027 spike, rounds 1-2 (steps 17, 17.l1): pure helpers of the lens card. No `$` here.
import type { LensAgent, LensBatch, LensPending, LensTask, Tokens } from '../types'

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

/** `ai-dlc:agent-manager` -> `agent-manager` (the role). */
export const roleOf = (type: string): string => type.replace(/^[^:]*:/, '')

/** `agent-manager` -> `Agent Manager`. */
export const titleCase = (role: string): string =>
  role
    .split(/[-_\s]+/)
    .filter(w => w !== '')
    .map(w => w[0]!.toUpperCase() + w.slice(1))
    .join(' ')

export const displayName = (a: Pick<LensAgent, 'id' | 'name' | 'type'>): string => {
  if (a.name !== '') return a.name
  if (a.id === 'main') return a.type === '' ? 'Main' : titleCase(roleOf(a.type))
  return titleCase(roleOf(a.type)) || 'Agent'
}

export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(w => w !== '')
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join('') || '?'

/**
 * The context window: main from `$.session.usage().context.window`; a subagent on the
 * main model takes main's; `[1m]` in the id says 1M; else 200K, an assumption (no
 * per-agent window API, step 16 Q4).
 */
export function windowFor(model: string, mainModel: string, mainWindow: number): { n: number; how: string } {
  if (/\[1m\]/i.test(model)) return { n: 1_000_000, how: '[1m] in the model id' }
  if (model !== '' && model === mainModel && mainWindow > 0) return { n: mainWindow, how: 'same model as main' }
  return { n: 200_000, how: 'assumed' }
}

/** Context used, as the engine counts it for main (D:8021): input + cache read + cache write + output of the last response. */
export const contextUsed = (t: Tokens | null): number => (t === null ? 0 : t.in + t.cr + t.cw + t.out)

/** The record path in a brief: on its first line (AGENTS.md Run Loop step 8), else anywhere in it. */
export function matchHandoff(prompt: string): { path: string; how: string } | null {
  const re = /[A-Za-z0-9_.:/\\-]*[A-Za-z0-9_-]\.handoff\.md/
  const first = prompt.split(/\r?\n/, 1)[0] ?? ''
  const a = re.exec(first)
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

export type CardLines = { title: string; role: string; ctx: string; io: string; cache: string }

/** The five lines under an avatar (design item 3). */
export function cardLines(a: LensAgent, mainModel: string, mainWindow: number): CardLines {
  const model = a.model !== '' ? a.model : a.id === 'main' ? mainModel : ''
  const w = a.id === 'main' && mainWindow > 0 ? { n: mainWindow, how: 'session' } : windowFor(model, mainModel, mainWindow)
  const used = contextUsed(a.last)
  // Live: the step sums; a loop whose steps no hook saw falls back to its turn sums.
  const sum = a.steps.in + a.steps.out + a.steps.cr + a.steps.cw > 0 ? a.steps : a.turns
  return {
    title: `${displayName(a)} (${fmtModel(model)})`,
    role: a.id === 'main' ? `${roleOf(a.type) || 'main loop'} (main)` : roleOf(a.type),
    ctx: `${fmtTokens(used)}/${fmtTokens(w.n)}${w.how === 'assumed' ? ' (window assumed)' : ''}`,
    io: `in ${fmtTokens(sum.in + sum.cr + sum.cw)}, out ${fmtTokens(sum.out)}`,
    cache: `cache r ${fmtTokens(sum.cr)} / w ${fmtTokens(sum.cw)} / uncached ${fmtTokens(sum.in)}`,
  }
}

export type Placed = { id: string; x: number; y: number; depth: number }

/** Tree layout: main on top, each level below its spawner's. */
export function layout(order: readonly string[], agents: Record<string, LensAgent>): { placed: Placed[]; width: number; height: number } {
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
  const COL = 200
  const ROW = 210
  const widest = Math.max(1, ...levels.map(l => (l ?? []).length))
  const width = widest * COL
  const placed: Placed[] = []
  levels.forEach((ids, depth) => {
    const n = (ids ?? []).length
    ;(ids ?? []).forEach((id, i) => placed.push({ id, depth, x: Math.round((width / n) * (i + 0.5)), y: 40 + depth * ROW }))
  })
  return { placed, width, height: Math.max(1, levels.length) * ROW + 10 }
}

/** The flowchart (design items 2, 3, 6): one avatar per agent, its five lines under it, an arrow per spawn. */
export function flowchartSvg(order: readonly string[], agents: Record<string, LensAgent>, mainModel: string, mainWindow: number): { source: string; width: number; height: number } {
  const { placed, width, height } = layout(order, agents)
  const at = new Map(placed.map(p => [p.id, p] as const))
  const R = 22
  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="sans-serif">`,
    `<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#78909c"/></marker></defs>`,
  )
  for (const p of placed) {
    const a = agents[p.id]!
    const from = a.parent !== null ? at.get(a.parent) : undefined
    if (!from) continue
    const x1 = from.x
    const y1 = from.y + R + 92
    const x2 = p.x
    const y2 = p.y - R - 4
    const ends = a.loop ? ' marker-start="url(#a)" marker-end="url(#a)"' : ' marker-end="url(#a)"'
    parts.push(`<path d="M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}" fill="none" stroke="#78909c" stroke-width="2"${ends}><title>${esc(a.handoff ?? 'no record matched')}</title></path>`)
    const code = a.handoff !== null ? (parseRecord(a.handoff)?.code ?? '') : ''
    if (code !== '') parts.push(`<text x="${(x1 + x2) / 2 + 6}" y="${(y1 + y2) / 2}" font-size="11" fill="#78909c">${esc(code)}</text>`)
  }
  for (const p of placed) {
    const a = agents[p.id]!
    const l = cardLines(a, mainModel, mainWindow)
    const running = a.status === 'running' || a.status === 'pending'
    const fill = a.status === 'failed' || a.status === 'killed' ? '#c62828' : a.status === 'waiting' ? '#f9a825' : '#2e7d32'
    parts.push(
      `<circle cx="${p.x}" cy="${p.y}" r="${R}" fill="${fill}"><title>${esc(l.title)} ${esc(a.status)}</title>` +
        (running ? `<animate attributeName="opacity" values="1;0.25;1" dur="1s" repeatCount="indefinite"/>` : '') +
        `</circle>`,
      `<text x="${p.x}" y="${p.y + 5}" text-anchor="middle" font-size="14" font-weight="bold" fill="#fff">${esc(initials(displayName(a)))}</text>`,
    )
    const lines = [l.title, l.role, `ctx ${l.ctx}`, l.io, l.cache]
    lines.forEach((t, i) =>
      parts.push(`<text x="${p.x}" y="${p.y + R + 18 + i * 15}" text-anchor="middle" font-size="${i === 0 ? 12 : 10.5}"${i === 0 ? ' font-weight="bold"' : ''} fill="#90a4ae">${esc(t)}</text>`),
    )
  }
  parts.push('</svg>')
  return { source: parts.join(''), width, height }
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

// ---- round 2 (step 17.l1): the chat card ----

/** The tools that spawn an agent: `Agent`, and `Task` as headless runs name it. */
export const AGENT_TOOLS = new Set(['Agent', 'Task'])

/** The batch an Agent call belongs to: the id of the first Agent call of its message, or null when none was seen. */
export function leadOf(batches: Record<string, LensBatch>, toolUseId: string): string | null {
  if (batches[toolUseId]) return toolUseId
  for (const [lead, b] of Object.entries(batches)) if (b.ids.includes(toolUseId)) return lead
  return null
}

/** Adds an Agent call to the batch of its message (`lead` is that message's first Agent call). */
export function addToBatch(batches: Record<string, LensBatch>, lead: string, parent: string, toolUseId: string): Record<string, LensBatch> {
  const b = batches[lead] ?? { parent, ids: [], pending: {} }
  if (b.ids.includes(toolUseId)) return batches
  return { ...batches, [lead]: { ...b, ids: [...b.ids, toolUseId] } }
}

/** Notes what `tool.call` saw of an Agent call; a call no step reported becomes a batch of its own. */
export function notePending(batches: Record<string, LensBatch>, parent: string, toolUseId: string, p: LensPending): Record<string, LensBatch> {
  const lead = leadOf(batches, toolUseId)
  const base = lead === null ? addToBatch(batches, toolUseId, parent, toolUseId) : batches
  const key = lead ?? toolUseId
  const b = base[key]!
  return { ...base, [key]: { ...b, pending: { ...b.pending, [toolUseId]: p } } }
}

/** The avatar of an Agent call whose agent `agent.spawn` has not named yet. */
export function pendingAgent(toolUseId: string, parent: string, p: LensPending | undefined): LensAgent {
  return {
    id: `call:${toolUseId}`,
    parent,
    type: p?.type ?? '',
    name: p?.name ?? '',
    description: p?.description ?? '',
    model: '',
    status: 'pending',
    toolUseId,
    steps: ZERO,
    turns: ZERO,
    last: null,
    handoff: null,
    handoffHow: 'none',
    loop: false,
    startedAt: 0,
    endedAt: null,
    bg: [],
  }
}

/**
 * What the chat card draws for one batch: the loop that made the calls on top, each call's agent
 * (or its placeholder) under it, then what those agents spawned in turn.
 */
export function batchView(batch: LensBatch, agents: Record<string, LensAgent>, order: readonly string[]): { ids: string[]; agents: Record<string, LensAgent>; members: string[] } {
  const out: Record<string, LensAgent> = {}
  const ids: string[] = []
  const root: LensAgent = agents[batch.parent] ?? { ...pendingAgent('', '', undefined), id: batch.parent, parent: null, status: 'running' }
  out[root.id] = { ...root, parent: null }
  ids.push(root.id)
  const byCall = new Map<string, LensAgent>()
  for (const a of Object.values(agents)) if (a.toolUseId !== '') byCall.set(a.toolUseId, a)
  const members: string[] = []
  for (const tu of batch.ids) {
    const a = byCall.get(tu) ?? pendingAgent(tu, root.id, batch.pending[tu])
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

/** The terminal's flowchart: one line per avatar, indented by depth, its other four lines under it. */
export function textChart(ids: readonly string[], agents: Record<string, LensAgent>, mainModel: string, mainWindow: number): { id: string; head: string; lines: string[] }[] {
  const { placed } = layout(ids, agents)
  return placed.map(p => {
    const a = agents[p.id]!
    const l = cardLines(a, mainModel, mainWindow)
    const pad = '   '.repeat(p.depth)
    return { id: p.id, head: `${pad}${a.parent !== null ? (a.loop ? '<-> ' : '-> ') : ''}`, lines: [l.title, l.role, `ctx ${l.ctx}`, l.io, l.cache].map((x, i) => (i === 0 ? x : `${pad}${a.parent !== null ? '    ' : ''}  ${x}`)) }
  })
}
