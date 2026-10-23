// ITEM-027 spike — throwaway. Not plugin source; discarded after the human's check.
// Round 1 (step 17): the human's lens card. `/spike027` opens it:
//   L1 orchestrator view: thinking and gathered context, each collapsible (pane section, step 16 Q1)
//   L2 flowchart: an avatar per agent (Svg), a Button per avatar and per arrow under it (step 16 Q2)
//   L4 arrow -> separate pane `lens-027-edge` (or drill-in): handoff record, hand-back, their tokens
//   L5 avatar -> separate pane `lens-027-agent` (or drill-in): background tasks, tool calls, thinking
//   L6 loops draw a two-way arrow; running avatars blink green, finished ones stay green
// Round 2 (step 17.l1): the same flowchart sits at the top of the chat card. The ToolUse row of the
// first Agent call of an assistant message draws it for every Agent call of that message (parallel
// spawns side by side), with the avatar and arrow Buttons, collapsible thinking and gathered context,
// and the native row last; the message's other Agent rows stay compact, native row kept.
// Round 3 (step 17.l2): the human's findings. A smaller chart with name, model and role only (no
// figures); a chip with an "Open flowchart" Button when the row is too narrow; persona names from
// the roster, models from the agent definitions, readable roles; the figures, the cost (from
// `.ai-dlc/model-costing.json` only) and the window in the avatar panel; the arrow panel falls
// back to the orchestrator's prompt; the native row is drawn without the prompt (whole when
// expanded); only running agents blink; every collapsible starts collapsed; every setting comes
// from hooks/settings.ts levels. Root cause of the missing second agent: see `ensureIn` (lens.ts).
// Experiments E1-E9 log to PROBE-LOG.jsonl while `/spike027-probe on`.
// The round-0 kit (checks 1-5: resize, Svg blink, buttons, transcript cards, gate alert) is `/spike027-kit`.
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'
import type { LensAgent, LensBatch, LensCall, LensConfig, LensCosting, LensDef, LensDoc, LensTask, LensUi, Tokens } from '../types'
import {
  AGENT_TOOLS,
  CONTEXT_TOOLS,
  ENDED,
  ZERO,
  addTokens,
  addToBatch,
  batchView,
  contextUsed,
  costOf,
  ensureIn,
  flowchartSvg,
  fmtTokens,
  fromUsage,
  humanRole,
  initials,
  isRespawn,
  isRunning,
  leadOf,
  matchHandoff,
  mergeStopTasks,
  modelOf,
  notePending,
  parseDefinition,
  parseRecord,
  parseRoster,
  personaOf,
  pickHandback,
  pluginOf,
  roleOf,
  showChart,
  summarize,
  textChart,
  windowOf,
} from './lens'
import type { ChartLabel, ChartSize } from './lens'
import { DEFAULTS, KEYS, envLevel, envName, fileLevel, initialFile, resolve, schema, setKey } from './settings'
import type { Key, LensSettings } from './settings'

const KIT = 'lens-spike-027'
const LENS = 'lens-027'
const EDGE = 'lens-027-edge'
const AGENT = 'lens-027-agent'
const CHART = 'lens-027-chart'
const PROBE_PANE = 'lens-027-p'
const LENS_JSON = '.ai-dlc/lens.json'
const LENS_SCHEMA = '.ai-dlc/lens.schema.json'
const SETTINGS_LOCAL = '.claude/settings.local.json'
const SETTINGS_PROJECT = '.claude/settings.json'

// ---- round-0 kit state ----
const tick = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'tick' } as const, false)
const paneExpanded = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'paneExpanded' } as const, false)
const panePresses = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'panePresses' } as const, 0)
const forceMode = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'forceMode' } as const, 'auto')

// ---- round-1 lens state ----
const UI0: LensUi = { panelMode: 'pane', edge: null, agent: null, drill: null, edgeSnap: null, agentSnap: null }
const DOC0: LensDoc = { agent: '', handoff: '', handoffText: '', handback: '', handbackText: '', error: '', prompt: '', hint: '' }
const agentsA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'agents' } as const, {}, { shape: 'agents-2' })
const orderA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'order' } as const, [], { shape: 'order-1' })
const callsA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'calls' } as const, {}, { shape: 'calls-1' })
const thinkingA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'thinking' } as const, {})
const contextA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'context' } as const, [], { shape: 'context-1' })
const mainWindowA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'mainWindow' } as const, 0)
const uiA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'ui' } as const, UI0, { shape: 'ui-2' })
const docA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'doc' } as const, DOC0, { shape: 'doc-2' })
const probeA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'probe' } as const, false)
const probeLinesA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'probeLines' } as const, 0)
// ---- round-2 chat card state ----
const batchesA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'batches' } as const, {}, { shape: 'batches-2' })
/** Every [+]/[-] section, by key; absent: the `collapsedByDefault` setting decides. */
const cardOpenA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'cardOpen' } as const, {})
// ---- round-3 state ----
/** tool_use_id -> agent id, written by `agent.spawn` and the Agent call's result: never overwritten by a blank record. */
const callAgentA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'callAgent' } as const, {})
const defsA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'defs' } as const, {}, { shape: 'defs-1' })
const rosterA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'roster' } as const, {})
const costingA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'costing' } as const, { path: '', text: '', error: 'not read yet' }, { shape: 'costing-1' })
const chartLeadA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'chartLead' } as const, '')
const LENS0: LensConfig = { settings: { ...DEFAULTS }, sources: Object.fromEntries(KEYS.map(k => [k, 'default'])), ignored: [] }
const lensA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'lens' } as const, LENS0, { shape: 'lens-1' })

// Tools whose rows get a transcript card. `Task` is the Agent tool's name in headless runs.
const CARD_TOOLS = new Set(['Agent', 'Task', 'SendMessage'])

// Module-local (reset on reload).
type Redraw = { n: number; body: number; cols: number | undefined; placement: string; fs: string; mode: string }
const redraws: Redraw[] = []
let redrawCount = 0
let toolResultHooks = 0
let toolUseCards = 0
let stopEvents = 0
let cwd = ''
let probeOn = false
let probePath = ''
const probeLog: string[] = []
let probeWrite: Promise<void> = Promise.resolve()
const thinkBuf: Record<string, string> = {}
/** Thinking blocks streamed per loop (distinct block index per step), text or not. */
const thinkBlocks: Record<string, number> = {}
/** tool_use_id -> the output tokens of the step that asked for it and how many calls that step asked for. */
const stepOfCall: Record<string, { out: number; n: number }> = {}
const lastStatus: Record<string, string> = {}
/** The settings non-drawing code uses (limits); the drawings read `lensA`. */
let cfg: LensSettings = { ...DEFAULTS }

const nowMs = () => Date.now()
const cap = (s: string, n: number) => (s.length > n ? s.slice(0, n) + `\n... [+${s.length - n} chars]` : s)

const blankAgent = (id: string, parent: string | null, type: string): LensAgent => ({
  id,
  parent,
  type,
  name: '',
  description: '',
  model: '',
  callModel: '',
  parentModel: '',
  prompt: '',
  status: 'running',
  toolUseId: '',
  steps: ZERO,
  turns: ZERO,
  last: null,
  handoff: null,
  handoffHow: 'none',
  loop: false,
  startedAt: nowMs(),
  endedAt: null,
  bg: [],
})

const svgDot = (fill: string, animated: boolean) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">` +
  `<circle cx="12" cy="12" r="9" fill="${fill}">` +
  (animated ? `<animate attributeName="opacity" values="1;0.15;1" dur="1s" repeatCount="indefinite"/>` : '') +
  `</circle></svg>`

const gateFile = (root: string) => `${root}/GATE-ALERT.txt`

async function gateIsOn($: { fs: { exists: (p: string) => Promise<boolean>; read: any }; plugin: { root: string } }) {
  const path = gateFile($.plugin.root)
  if (!(await $.fs.exists(path))) return false
  const text = String(await $.fs.read(path))
  return text.trim() === 'on'
}

async function readText($: any, path: string): Promise<string | null> {
  try {
    return String(await $.fs.read(path))
  } catch {
    return null
  }
}

// ---- settings (addendum 3): local env > project env > .ai-dlc/lens.json > default; never the process env ----
async function loadSettings($: any): Promise<LensConfig> {
  const local = envLevel(SETTINGS_LOCAL, await readText($, SETTINGS_LOCAL))
  const project = envLevel(SETTINGS_PROJECT, await readText($, SETTINGS_PROJECT))
  const file = fileLevel(LENS_JSON, await readText($, LENS_JSON))
  const r = resolve([local.level, project.level, file.level])
  const problems = [local.problem, project.problem, file.problem].filter(x => x !== '')
  const conf: LensConfig = { settings: r.settings, sources: r.sources, ignored: [...problems, ...r.ignored] }
  cfg = r.settings
  await update($, lensA, () => conf)
  return conf
}

const chartSize = (s: LensSettings): ChartSize => ({ col: s.chartColumnPx, row: s.chartRowPx, r: s.avatarRadiusPx, blink: s.blink, blinkMs: s.blinkMs })

/** The model metadata file: `.ai-dlc/model-metadata.json`, else its earlier name `.ai-dlc/model-costing.json` (read only). */
async function loadCosting($: any) {
  let c: LensCosting = { path: cfg.costingPath, text: '', error: `${cfg.costingPath} and ${cfg.costingFallbackPath} not found` }
  for (const path of [cfg.costingPath, cfg.costingFallbackPath]) {
    const text = await readText($, path)
    if (text !== null) {
      c = { path, text, error: '' }
      break
    }
  }
  await update($, costingA, () => c)
}

async function loadRoster($: any) {
  const text = await readText($, cfg.rosterPath)
  await update($, rosterA, () => (text === null ? {} : parseRoster(text)))
}

/** A plugin's installed copies: `<plugins cache>/<marketplace>/<plugin>/<version>/`, the newest release first. */
async function installedRoots($: any, plugin: string): Promise<string[]> {
  const base = `${$.plugin.root}/../../${plugin}`
  try {
    const vers = ((await $.fs.list(base)) as { name: string; kind: string }[]).filter(v => v.kind === 'dir').map(v => v.name)
    const rank = (v: string) => (v.includes('-') ? 0 : 1)
    vers.sort((a, b) => rank(b) - rank(a) || b.localeCompare(a, undefined, { numeric: true }))
    return vers.map(v => `${base}/${v}`)
  } catch {
    return []
  }
}

/** The definition of an agent type (finding 1d): this repository's plugin source, else the installed plugin, else `.claude/agents/`. */
async function loadDef($: any, type: string) {
  if (type === '') return
  const have = (await read($, defsA)) as Record<string, LensDef>
  if (have[type]) return
  const plugin = pluginOf(type)
  const name = roleOf(type)
  const first = plugin !== '' ? `plugins/claude/${plugin}/agents/${name}.md` : `.claude/agents/${name}.md`
  let def: LensDef = { model: '', persona: '', path: '' }
  let text = await readText($, first)
  let path = first
  if (text === null && plugin !== '') {
    // The installed copy is listed only when this repository has no source for it.
    for (const r of await installedRoots($, plugin)) {
      path = `${r}/agents/${name}.md`
      text = await readText($, path)
      if (text !== null) break
    }
  }
  if (text !== null) def = { ...parseDefinition(text), path: path.replace(/^.*[\\/]plugins[\\/]cache[\\/]/, '~/.claude/plugins/cache/') }
  await update($, defsA, m => ({ ...(m as Record<string, LensDef>), [type]: def }))
}

/** What the chart and the Buttons call an agent: persona, model, role (finding 1d). */
function labeler(roster: Record<string, string>, defs: Record<string, LensDef>, mainModel: string) {
  return (a: LensAgent): ChartLabel => {
    const def = defs[a.type]
    const usable = def && def.path !== '' ? def : undefined
    return {
      name: personaOf(a, roster, usable),
      model: modelOf(usable, a.callModel, a.parentModel || mainModel || a.model).text,
      role: a.id === 'main' ? (a.type === '' ? 'Main loop' : humanRole(a.type)) : humanRole(a.type) || 'Agent',
    }
  }
}

/** Whether a [+]/[-] section is open: the person's choice, else the `collapsedByDefault` setting. */
const isOpen = (open: Record<string, boolean>, key: string, s: LensSettings) => open[key] ?? !s.collapsedByDefault
const toggleOpen = ($: any, key: string, s: LensSettings) =>
  update($, cardOpenA, m => ({ ...(m as Record<string, boolean>), [key]: !((m as Record<string, boolean>)[key] ?? !s.collapsedByDefault) }))

// ---- probes (E1-E9) ----
async function plog($: any, exp: string, data: unknown) {
  if (!probeOn || probePath === '') return
  let line: string
  try {
    line = JSON.stringify({ t: new Date().toISOString(), exp, data })
  } catch {
    line = JSON.stringify({ t: new Date().toISOString(), exp, data: String(data) })
  }
  probeLog.push(line)
  if (probeLog.length > 600) probeLog.shift()
  const text = probeLog.join('\n') + '\n'
  probeWrite = probeWrite.then(() => $.fs.write(probePath, text)).catch(() => undefined)
  await update($, probeLinesA, n => n + 1)
}

async function ensureAgent($: any, id: string, parent: string | null, type: string) {
  // The existence check runs inside the write (round 3 root cause): a stale "absent" never overwrites.
  await update($, agentsA, m => ensureIn(m as Record<string, LensAgent>, id, () => blankAgent(id, parent, type)))
  await update($, orderA, o => (o.includes(id) ? o : [...o, id]))
}

async function patchAgent($: any, id: string, fn: (a: LensAgent) => LensAgent) {
  await update($, agentsA, m => {
    const cur = (m as Record<string, LensAgent>)[id]
    return cur ? { ...m, [id]: fn(cur) } : m
  })
}

async function pushCall($: any, key: string, call: LensCall) {
  await update($, callsA, m => {
    const list = ((m as Record<string, LensCall[]>)[key] ?? []).filter(c => c.id !== call.id)
    return { ...m, [key]: [...list, call].slice(-cfg.callsLimit) }
  })
}

async function refreshList($: any, reason: string) {
  let list: any[] = []
  try {
    list = (await $.agent.list()) as any[]
  } catch (err) {
    await plog($, 'E4', { reason, error: String(err) })
    return
  }
  const changes: unknown[] = []
  for (const a of list) {
    if (lastStatus[a.id] !== a.status) changes.push({ id: a.id, type: a.type, status: a.status, was: lastStatus[a.id] ?? null, parentId: a.parentId ?? null, teammateId: a.teammateId ?? null, name: a.name ?? null })
    lastStatus[a.id] = a.status
  }
  if (changes.length > 0) await plog($, 'E4', { reason, changes, listed: list.length })
  // Background tasks: each agent's listed children (step 16 Q6).
  await update($, agentsA, m => {
    const out: Record<string, LensAgent> = { ...(m as Record<string, LensAgent>) }
    for (const key of Object.keys(out)) {
      const kids: LensTask[] = list
        .filter(a => (a.parentId ?? 'main') === key)
        .map(a => ({ id: String(a.id), type: String(a.type), status: String(a.status), description: String(a.description ?? ''), source: 'agent.list' }))
      const stopTasks = out[key]!.bg.filter(t => t.source !== 'agent.list')
      out[key] = { ...out[key]!, bg: [...kids, ...stopTasks] }
    }
    for (const a of list) {
      const cur = out[a.id]
      // A list that still says `running` never undoes a `turn.complete` (finding 6).
      if (cur && cur.status !== a.status && a.status !== 'completed' && !ENDED.has(cur.status)) out[a.id] = { ...cur, status: String(a.status) }
    }
    return out
  })
}

async function findFallbackRecord($: any, role: string, startedAt: number): Promise<string | null> {
  // Time order + agent type (step 16 Q7): shown only as a hint since round 3, never as the record.
  let best: { path: string; mtime: number } | null = null
  try {
    for (const run of await $.fs.list('docs/handoffs')) {
      if (run.kind !== 'dir') continue
      for (const f of await $.fs.list(`docs/handoffs/${run.name}`)) {
        if (f.kind !== 'file' || !f.name.endsWith(`-to-${role}.handoff.md`)) continue
        const mt = Number(f.mtimeMs ?? f.mtime ?? 0)
        if (mt >= startedAt - 600_000 && mt <= startedAt + 60_000 && (best === null || mt > best.mtime)) best = { path: `docs/handoffs/${run.name}/${f.name}`, mtime: mt }
      }
    }
  } catch {
    return null
  }
  return best?.path ?? null
}

/** The arrow panel's content (finding 2): the record the brief named and its hand-back, else the prompt. */
async function loadDoc($: any, a: LensAgent) {
  const doc: LensDoc = { ...DOC0, agent: a.id, prompt: a.prompt }
  const path = a.handoff
  if (path === null) {
    if (a.startedAt > 0) {
      const hint = await findFallbackRecord($, roleOf(a.type), a.startedAt)
      if (hint !== null) doc.hint = hint
    }
    await update($, docA, () => doc)
    await plog($, 'E8', { via: 'arrow press', path: null, prompt: a.prompt.length, hint: doc.hint })
    return
  }
  doc.handoff = path
  const text = await readText($, path)
  if (text === null) doc.error = `read ${path}: not found`
  else doc.handoffText = cap(text, cfg.recordChars)
  const rec = parseRecord(path)
  if (rec) {
    try {
      const names = ((await $.fs.list(rec.dir)) as { name: string }[]).map(f => f.name)
      const hb = pickHandback(names, rec)
      if (hb !== null) {
        doc.handback = `${rec.dir}/${hb}`
        doc.handbackText = cap((await readText($, doc.handback)) ?? '', cfg.recordChars)
      } else doc.handbackText = '(no hand-back yet)'
    } catch (err) {
      doc.error += ` list ${rec.dir}: ${String(err)}`
    }
  }
  await update($, docA, () => doc)
  await plog($, 'E8', { via: 'arrow press', path, ok: doc.handoffText !== '', handback: doc.handback, error: doc.error })
}

/** `fromChat`: pressed in a chat card, which has no drill-in: always the separate pane. `snap`: the agent as drawn. */
async function openEdge($: any, snap: LensAgent, title: string, fromChat: boolean) {
  const u = (await read($, uiA)) as LensUi
  const pane = fromChat || u.panelMode === 'pane'
  await update($, uiA, x => ({ ...x, edge: snap.id, edgeSnap: snap, drill: pane ? (fromChat ? x.drill : null) : 'edge' }))
  await loadDoc($, snap)
  if (pane) {
    const r = await $.ui.open({ id: EDGE, title: cap(`Hand-off: ${title}`, 60) })
    await plog($, 'E3', { open: EDGE, result: r })
  }
}

async function openAgent($: any, snap: LensAgent, title: string, fromChat: boolean) {
  const u = (await read($, uiA)) as LensUi
  const pane = fromChat || u.panelMode === 'pane'
  await update($, uiA, x => ({ ...x, agent: snap.id, agentSnap: snap, drill: pane ? (fromChat ? x.drill : null) : 'agent' }))
  await refreshList($, 'avatar press')
  if (pane) {
    const r = await $.ui.open({ id: AGENT, title: cap(`Agent: ${title}`, 60) })
    await plog($, 'E3', { open: AGENT, result: r })
  }
}

async function openChart($: any, lead: string) {
  await update($, chartLeadA, () => lead)
  await $.ui.open({ id: CHART, title: 'AI-DLC flowchart' })
}

async function scanUsage($: any, agentId: string) {
  // E5: what the agent's own rows say it used, next to the hook sums.
  try {
    const rows: unknown = await $.session.messages({ agentId })
    const sum = { in: 0, out: 0, cr: 0, cw: 0, found: 0 }
    const walk = (v: unknown, depth: number) => {
      if (depth > 6 || v === null || typeof v !== 'object') return
      const o = v as Record<string, unknown>
      const u = o.usage as Record<string, unknown> | undefined
      if (u && typeof u.output_tokens === 'number') {
        sum.found += 1
        sum.in += Number(u.input_tokens ?? 0)
        sum.out += Number(u.output_tokens ?? 0)
        sum.cr += Number(u.cache_read_input_tokens ?? 0)
        sum.cw += Number(u.cache_creation_input_tokens ?? 0)
        return
      }
      for (const k of Object.keys(o)) walk(o[k], depth + 1)
    }
    walk(rows, 0)
    return { rows: Array.isArray(rows) ? rows.length : typeof rows, sum }
  } catch (err) {
    return { error: String(err) }
  }
}

// ---- tool calls: never throw into the call (the hook gates it) ----
const lensErrors: string[] = []
function lensFail(site: string, err: unknown) {
  lensErrors.push(`${site}: ${String(err)}`)
  if (lensErrors.length > 20) lensErrors.shift()
}

type CallCtx = { key: string; tool: string; input: Record<string, unknown>; id: string; call: LensCall }

async function beforeCall($: any, e: any): Promise<CallCtx | null> {
  try {
    const key: string = e.agentId ?? 'main'
    const { tool, tool_use_id, agentId: _a, consent: _c, requestMeta: _r, ...rest } = e
    const input = rest as Record<string, unknown>
    const id = String(tool_use_id ?? `${tool}-${nowMs()}`)
    const call: LensCall = { id, tool, summary: summarize(tool, input), status: 'running', stepOut: 0, stepCalls: 0 }
    const s = stepOfCall[id]
    if (s) {
      call.stepOut = s.out
      call.stepCalls = s.n
    }
    await pushCall($, key, call)
    if (key === 'main' && CONTEXT_TOOLS.has(tool)) await update($, contextA, l => [...l.filter(c => c.id !== id), call].slice(-cfg.contextLimit))
    if (tool === 'SendMessage' && typeof input.to === 'string') {
      // A message to a running agent is a loop: the arrow becomes two-way (US-12).
      const to = input.to
      const agents = (await read($, agentsA)) as Record<string, LensAgent>
      const hit = Object.values(agents).find(a => a.id === to || a.name === to)
      if (hit) await patchAgent($, hit.id, a => ({ ...a, loop: true }))
    }
    if (AGENT_TOOLS.has(tool)) {
      // The chat card's placeholder avatar until agent.spawn names the agent; a call no step reported is a batch of its own.
      const p = {
        type: String(input.subagent_type ?? ''),
        description: String(input.description ?? ''),
        name: String(input.name ?? ''),
        prompt: String(input.prompt ?? ''),
        model: typeof input.model === 'string' ? input.model : '',
      }
      await update($, batchesA, m => notePending(m as Record<string, LensBatch>, key, id, p))
      await loadDef($, p.type)
    }
    if (probeOn && AGENT_TOOLS.has(tool))
      await plog($, 'E1', { site: 'tool.call', tool, tool_use_id: id, inputKeys: Object.keys(input), hasPrompt: typeof input.prompt === 'string', firstLine: String(input.prompt ?? '').split(/\r?\n/, 1)[0]?.slice(0, 300) })
    if (probeOn && tool === 'Bash' && input.run_in_background === true) await plog($, 'E7', { site: 'tool.call', command: input.command, agent: key })
    return { key, tool, input, id, call }
  } catch (err) {
    lensFail('tool.call before', err)
    return null
  }
}

async function afterCall($: any, ctx: CallCtx, r: any) {
  try {
    const { key, tool, input, id, call } = ctx
    const status = r?.deny !== undefined || r?.isError === true ? 'error' : 'done'
    const bgId = r?.result?.backgroundTaskId
    if (typeof bgId === 'string') {
      // E7: a background shell is known from its call's result; no live list API names it.
      const task: LensTask = { id: bgId, type: 'shell', status: 'running', description: call.summary, source: 'tool.call' }
      await patchAgent($, key, a => ({ ...a, bg: [...a.bg.filter(t => t.id !== bgId), task] }))
    }
    // The Agent call's own result names its agent (E1: `agentId`): a second source for the call -> agent map.
    const agentId = r?.result?.agentId
    if (AGENT_TOOLS.has(tool) && typeof agentId === 'string') await update($, callAgentA, m => ({ ...(m as Record<string, string>), [id]: agentId }))
    await pushCall($, key, { ...call, status })
    if (key === 'main' && CONTEXT_TOOLS.has(tool)) await update($, contextA, l => l.map(c => (c.id === id ? { ...c, status } : c)))
    if (probeOn && tool === 'Bash' && input.run_in_background === true) {
      const list = (await $.agent.list()) as any[]
      await plog($, 'E7', { site: 'after background Bash', result: r?.result ?? null, agentList: list.map(a => ({ id: a.id, type: a.type, status: a.status })) })
    }
    if (probeOn && AGENT_TOOLS.has(tool)) await plog($, 'E1', { site: 'tool.call result', tool_use_id: id, result: r?.result ?? null })
  } catch (err) {
    lensFail('tool.call after', err)
  }
}

/** Thinking blocks the transcript stored for a loop (E2): how many, how much text, how many redacted. */
async function scanThinking($: any, key: string): Promise<{ blocks: number; chars: number; redacted: number; text: string; error?: string }> {
  const out = { blocks: 0, chars: 0, redacted: 0, text: '' }
  try {
    const got: unknown = key === 'main' ? await $.session.messages({ as: 'api' }) : await $.session.messages({ agentId: key, as: 'api' })
    const walk = (v: unknown, depth: number) => {
      if (depth > 8 || v === null || typeof v !== 'object') return
      const o = v as Record<string, unknown>
      if (o.type === 'thinking') {
        out.blocks += 1
        const t = typeof o.thinking === 'string' ? o.thinking : ''
        out.chars += t.length
        if (t !== '') out.text += (out.text === '' ? '' : '\n---\n') + t
        return
      }
      if (o.type === 'redacted_thinking') {
        out.redacted += 1
        return
      }
      for (const k of Object.keys(o)) walk(o[k], depth + 1)
    }
    walk(got, 0)
    return out
  } catch (err) {
    return { ...out, error: String(err) }
  }
}

/** Fill a loop's thinking section from the stored transcript when the stream carried no text (step 16 Q1 fallback). */
async function backfillThinking($: any, key: string, streamedBlocks: number) {
  const have = ((await read($, thinkingA)) as Record<string, string>)[key] ?? ''
  if (have !== '' && !have.startsWith('[')) return null
  const th = await scanThinking($, key)
  const note =
    th.text !== ''
      ? th.text.slice(-cfg.thinkingChars)
      : `[no thinking text: ${streamedBlocks} block(s) streamed empty; transcript holds ${th.blocks} thinking block(s) with ${th.chars} chars, ${th.redacted} redacted]`
  await update($, thinkingA, m => ({ ...m, [key]: note }))
  return th
}

// ---- drawing helpers (called by name with `$`) ----
/**
 * One Button per avatar and per arrow. `agents` is the drawing's own set (the chat card's view, with
 * the placeholders of calls not spawned yet), so every avatar and arrow of the chart has its Button.
 * `root`: the chat card's top avatar, whose own arrow (from its spawner) is not in that card.
 */
function agentButtons($: any, t: any, order: string[], agents: Record<string, LensAgent>, label: (a: LensAgent) => ChartLabel, fromChat: boolean, root: string | null) {
  const { Box, Text, Button } = t
  const ids = order.filter(id => agents[id])
  const edges = ids.filter(id => id !== root && agents[id]!.parent !== null)
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" flexWrap="wrap">
        <Text dimColor>Avatars: </Text>
        {ids.map(id => {
          const name = label(agents[id]!).name
          return <Button key={`agent-${id}`} label={name} onPress={() => openAgent($, agents[id]!, name, fromChat)} />
        })}
      </Box>
      <Box flexDirection="row" flexWrap="wrap">
        <Text dimColor>Arrows: </Text>
        {edges.length === 0 && <Text dimColor>(none yet)</Text>}
        {edges.map(id => {
          const a = agents[id]!
          const from = agents[a.parent!]
          const code = a.handoff !== null ? (parseRecord(a.handoff)?.code ?? '') : ''
          const text = `${code !== '' ? code + ' ' : ''}${from ? label(from).name : '?'} ${a.loop ? '<->' : '->'} ${label(a).name}`
          return <Button key={`edge-${id}`} label={text} onPress={() => openEdge($, a, text, fromChat)} />
        })}
      </Box>
    </Box>
  )
}

/** The live record of a pressed agent, else the one the card drew (a call not spawned yet). */
const liveOr = (agents: Record<string, LensAgent>, id: string | null, snap: LensAgent | null): LensAgent | undefined => {
  if (id === null) return undefined
  const live = agents[id]
  if (live && live.type !== '') return live
  return snap ?? live
}

function edgeBody($: any, t: any, ui: LensUi, doc: LensDoc, agents: Record<string, LensAgent>, label: (a: LensAgent) => ChartLabel, open: Record<string, boolean>, s: LensSettings) {
  const { Box, Text, Button } = t
  const a = liveOr(agents, ui.edge, ui.edgeSnap)
  if (!a) return <Text dimColor>Press an arrow under the flowchart.</Text>
  const from = a.parent !== null ? agents[a.parent] : undefined
  const tk = a.turns
  const l = label(a)
  const docOpen = isOpen(open, 'edge:doc', s)
  const backOpen = isOpen(open, 'edge:back', s)
  const prompt = doc.agent === a.id ? doc.prompt || a.prompt : a.prompt
  return (
    <Box flexDirection="column">
      <Text bold>
        {from ? label(from).name : '?'} {a.loop ? '<->' : '->'} {l.name} ({l.role})
      </Text>
      <Text>
        Hand-off tokens (callee's turn.complete, summed): in {fmtTokens(tk.in + tk.cr + tk.cw)}, out {fmtTokens(tk.out)}; cache r {fmtTokens(tk.cr)} / w {fmtTokens(tk.cw)} / uncached {fmtTokens(tk.in)}
      </Text>
      {doc.error !== '' && <Text color="red">{doc.error}</Text>}
      {doc.agent === a.id && doc.handoff !== '' ? (
        <Box flexDirection="column">
          <Text dimColor>Record matched: {a.handoffHow}</Text>
          <Box flexDirection="row">
            <Button key="edge-doc" label={docOpen ? '[-]' : '[+]'} onPress={() => toggleOpen($, 'edge:doc', s)} />
            <Text bold> Handoff record </Text>
            <Text dimColor>{doc.handoff}</Text>
          </Box>
          {docOpen && <Text>{doc.handoffText}</Text>}
          <Box flexDirection="row">
            <Button key="edge-back" label={backOpen ? '[-]' : '[+]'} onPress={() => toggleOpen($, 'edge:back', s)} />
            <Text bold> Hand-back </Text>
            <Text dimColor>{doc.handback}</Text>
          </Box>
          {backOpen && <Text>{doc.handbackText}</Text>}
        </Box>
      ) : (
        <Box flexDirection="column">
          <Text bold>Prompt from orchestrator (no handoff record)</Text>
          <Text>{prompt === '' ? '(the prompt is not known yet)' : prompt}</Text>
          {doc.agent === a.id && doc.hint !== '' && <Text dimColor>A record found by time order only, not named in the brief: {doc.hint}</Text>}
        </Box>
      )}
    </Box>
  )
}

/** The avatar panel (findings 3, 4 and the window addendum): every figure, with where it came from. */
function agentBody(
  $: any,
  t: any,
  ui: LensUi,
  agents: Record<string, LensAgent>,
  calls: Record<string, LensCall[]>,
  thinking: Record<string, string>,
  mainWindow: number,
  label: (a: LensAgent) => ChartLabel,
  defs: Record<string, LensDef>,
  costing: LensCosting,
  open: Record<string, boolean>,
  s: LensSettings,
) {
  const { Box, Text, Button } = t
  const a = liveOr(agents, ui.agent, ui.agentSnap)
  if (!a || ui.agent === null) return <Text dimColor>Press an avatar under the flowchart.</Text>
  const id = a.id
  const main = agents['main']
  const mainModel = main?.model ?? ''
  const l = label(a)
  const def = defs[a.type]
  const mod = modelOf(def && def.path !== '' ? def : undefined, a.callModel, a.parentModel || mainModel)
  const w = id === 'main' && mainWindow > 0 ? { n: mainWindow as number | null, source: "the session's context window ($.session.usage)" } : windowOf(costing, a.model, mainModel, mainWindow, s.windowFallback)
  const used = contextUsed(a.last)
  // Live: the step sums; a loop whose steps no hook saw falls back to its turn sums.
  const sum = a.steps.in + a.steps.out + a.steps.cr + a.steps.cw > 0 ? a.steps : a.turns
  const cost = costOf(costing, a.model, sum, s.cacheWriteRate)
  const list = calls[id] ?? []
  const th = thinking[id] ?? ''
  const thOpen = isOpen(open, 'agent:thinking', s)
  const notStarted = a.status === 'pending'
  return (
    <Box flexDirection="column">
      <Text bold>
        {l.name} ({initials(l.name)})
      </Text>
      <Text>
        Role: {l.role} <Text dimColor>({roleOf(a.type) || 'main loop'})</Text> - {a.status}
      </Text>
      <Text>
        Model: {mod.text} <Text dimColor>from {mod.source}</Text>
      </Text>
      <Text dimColor>Ran on: {a.model === '' ? '(not reported yet)' : a.model}</Text>
      {notStarted ? (
        <Text dimColor>Not started yet: no figures.</Text>
      ) : (
        <Box flexDirection="column">
          <Text>
            Context: {fmtTokens(used)} / {w.n === null ? '—' : fmtTokens(w.n)} <Text dimColor>window from {w.source}</Text>
          </Text>
          <Text>
            Tokens: in {fmtTokens(sum.in + sum.cr + sum.cw)}, out {fmtTokens(sum.out)}
          </Text>
          <Text>
            Cache: read {fmtTokens(sum.cr)} / write {fmtTokens(sum.cw)} / uncached {fmtTokens(sum.in)}
          </Text>
          {s.showCost && (
            <Text>
              Cost: {cost.text} <Text dimColor>{cost.text === '—' ? `(${cost.source})` : `from ${cost.source}`}</Text>
            </Text>
          )}
        </Box>
      )}
      <Box flexDirection="row">
        <Button key="agent-view" label="View transcript" onPress={() => $.ui.view(id === 'main' ? {} : { agentId: id })} />
        <Button key="agent-refresh" label="Refresh" onPress={() => refreshList($, 'refresh press')} />
      </Box>
      <Text bold>Background tasks ({a.bg.length})</Text>
      {a.bg.length === 0 && <Text dimColor>none seen (agent.list children; stop-time background_tasks)</Text>}
      {a.bg.map(b => (
        <Text>
          {b.status} {b.type} {b.description} <Text dimColor>[{b.source}]</Text>
        </Text>
      ))}
      <Text bold>Tool calls ({list.length})</Text>
      {list.length === 0 && <Text dimColor>none yet</Text>}
      {list.slice(-s.callsShown).map(c => (
        <Text>
          {c.status === 'running' ? '...' : c.status === 'error' ? 'ERR' : 'ok '} {c.tool} {c.summary}
          <Text dimColor>{c.stepCalls > 0 ? `  step out ${fmtTokens(c.stepOut)} / ${c.stepCalls} call${c.stepCalls > 1 ? 's' : ''} (est.)` : ''}</Text>
        </Text>
      ))}
      <Box flexDirection="row">
        <Button key="agent-thinking" label={thOpen ? '[-]' : '[+]'} onPress={() => toggleOpen($, 'agent:thinking', s)} />
        <Text bold> Thinking ({th.length} chars)</Text>
      </Box>
      {thOpen && <Text dimColor>{th === '' ? '(no thinking chunks seen)' : th}</Text>}
    </Box>
  )
}

/** The chart as drawn on a surface: the Svg, or the terminal's text chart. */
function chartNode(t: any, hasSvg: boolean, on1: boolean, ids: string[], agents: Record<string, LensAgent>, label: (a: LensAgent) => ChartLabel, s: LensSettings, alt: string) {
  const { Box, Text, Svg } = t
  if (hasSvg) {
    const chart = flowchartSvg(ids, agents, label, chartSize(s))
    return <Svg source={chart.source} alt={alt} width={chart.width} height={chart.height} isInteractive={true} />
  }
  return (
    <Box flexDirection="column">
      {textChart(ids, agents, label).map(row => {
        const a = agents[row.id]!
        const blinking = s.blink && isRunning(a.status)
        const color = blinking ? (on1 ? 'green' : 'gray') : a.status === 'failed' || a.status === 'killed' ? 'red' : a.status === 'pending' ? 'gray' : 'green'
        return (
          <Box flexDirection="column">
            <Text>
              {row.head}
              <Text color={color}>{'●'}</Text> {row.lines[0]}
            </Text>
            <Text dimColor>{row.lines[1]}</Text>
          </Box>
        )
      })}
    </Box>
  )
}

/** Everything a drawing reads, once. */
async function snapshot($: any) {
  const agents = (await read($, agentsA)) as Record<string, LensAgent>
  const roster = (await read($, rosterA)) as Record<string, string>
  const defs = (await read($, defsA)) as Record<string, LensDef>
  const conf = (await read($, lensA)) as LensConfig
  const s = conf.settings as LensSettings
  const mainModel = agents['main']?.model ?? ''
  return { agents, roster, defs, conf, s, mainModel, label: labeler(roster, defs, mainModel) }
}

function settingsRows(t: any, conf: LensConfig) {
  const { Box, Text } = t
  return (
    <Box flexDirection="column">
      <Text bold>Lens settings (effective value [level])</Text>
      {KEYS.map(k => (
        <Text dimColor>
          {k} = {JSON.stringify(conf.settings[k])} [{conf.sources[k] ?? 'default'}]
        </Text>
      ))}
      {conf.ignored.map(x => (
        <Text color="yellow">{x}</Text>
      ))}
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'spike027', description: 'ITEM-027 spike: open the lens card' })
    await $.command.register({ name: 'spike027-kit', description: 'ITEM-027 spike: open the round-0 kit pane (checks 1-5)' })
    await $.command.register({ name: 'spike027-gate', description: 'ITEM-027 spike: gate alert on|off', argumentHint: 'on|off' })
    await $.command.register({
      name: 'spike027-probe',
      description: 'ITEM-027 spike: experiments E1-E9 (on|off|panes <n>|fs [path]|list|usage)',
      argumentHint: 'on|off|panes <n>|fs [path]|list|usage',
    })
    await $.command.register({ name: 'spike027-lens-init', description: 'ITEM-027 spike, stand-in for /ai-dlc:lens-init: write .ai-dlc/lens.json (defaults) and its schema', argumentHint: '[--force]' })
    await $.command.register({
      name: 'spike027-lens-configure',
      description: 'ITEM-027 spike, stand-in for /ai-dlc:lens-configure: show or change lens settings',
      argumentHint: '[<key> [<value>|--unset]]',
    })
    // Timer-driven blink (kit check 2, and the terminal's text avatars).
    $.clock.every(500, () => update($, tick, t => !t))
    cwd = e.cwd
    probeOn = (await read($, probeA)) as boolean
    probePath = (await $.fs.exists('spikes/ai-dlc-lens/027/CHECK.md')) ? 'spikes/ai-dlc-lens/027/PROBE-LOG.jsonl' : `${$.plugin.root}/PROBE-LOG.jsonl`
    try {
      await loadSettings($)
      await loadRoster($)
      await loadCosting($)
    } catch (err) {
      lensFail('session.start settings', err)
    }
    let sessionAgent = ''
    try {
      const v: unknown = await $.settings.read({ key: 'agent' })
      if (typeof v === 'string') sessionAgent = v
    } catch {
      // no agent setting
    }
    await ensureAgent($, 'main', null, sessionAgent)
    await patchAgent($, 'main', a => ({ ...a, type: a.type === '' ? sessionAgent : a.type, status: 'idle' }))
    try {
      await loadDef($, sessionAgent)
    } catch (err) {
      lensFail('session.start definition', err)
    }
    try {
      const u = await $.session.usage()
      await update($, mainWindowA, () => u.context.window)
    } catch {
      // no usage yet
    }
    // E4: watch agent.list status moves while probes are on.
    $.clock.every(2000, async () => {
      if (probeOn) await refreshList($, 'timer')
    })
    return next(e)
  })

  on('command.run', { command: 'spike027' }, async $ => {
    await loadSettings($)
    const placed = await $.ui.open({ id: LENS, title: 'AI-DLC lens (spike 027)' })
    return { text: `Lens card opened (isPlaced: ${JSON.stringify(placed)}). Arrows and avatars are the Buttons under the flowchart.` }
  })

  // Stand-in for /ai-dlc:lens-init (addendum 3): the product command lives in plugins/**, which this spike must not touch.
  on('command.run', { command: 'spike027-lens-init' }, async ($, e) => {
    const force = e.args.trim() === '--force'
    const had = (await readText($, LENS_JSON)) !== null
    if (had && !force) {
      await $.fs.write(LENS_SCHEMA, JSON.stringify(schema(), null, 2) + '\n')
      return { text: `${LENS_JSON} exists and was kept; ${LENS_SCHEMA} written. Pass --force to reset ${LENS_JSON} to the defaults.` }
    }
    await $.fs.write(LENS_JSON, initialFile())
    await $.fs.write(LENS_SCHEMA, JSON.stringify(schema(), null, 2) + '\n')
    const conf = await loadSettings($)
    const over = KEYS.filter(k => conf.sources[k] !== LENS_JSON && conf.sources[k] !== 'default')
    return {
      text:
        `${had ? 'Reset' : 'Wrote'} ${LENS_JSON} (every default) and ${LENS_SCHEMA}.` +
        (over.length > 0 ? ` Still overridden by a settings env: ${over.map(k => `${k} [${conf.sources[k]}]`).join(', ')}.` : ''),
    }
  })

  // Stand-in for /ai-dlc:lens-configure: no args lists every setting; `<key>` shows one; `<key> <value>` or `<key> --unset` edits lens.json.
  on('command.run', { command: 'spike027-lens-configure' }, async ($, e) => {
    const [k = '', raw = ''] = e.args.trim().split(/\s+/)
    const show = (c: LensConfig, key: Key) =>
      `${key} = ${JSON.stringify(c.settings[key])} [${c.sources[key]}] (env ${envName(key)}; default ${JSON.stringify(DEFAULTS[key])})`
    if (k === '') {
      const c = await loadSettings($)
      return { text: [...KEYS.map(key => show(c, key)), ...c.ignored].join('\n') }
    }
    if (!(KEYS as string[]).includes(k)) return { text: `Unknown key ${k}. Keys: ${KEYS.join(', ')}` }
    if (raw === '') return { text: show(await loadSettings($), k as Key) }
    const r = setKey(await readText($, LENS_JSON), k, raw)
    if (r.error !== '') return { text: `Not changed: ${r.error}` }
    await $.fs.write(LENS_JSON, r.text)
    const c = await loadSettings($)
    const src = c.sources[k as Key]
    const note = src !== LENS_JSON && raw !== '--unset' ? ` A higher level wins: ${src}.` : ''
    return { text: `${LENS_JSON} updated. Effective: ${show(c, k as Key)}.${note}` }
  })

  on('command.run', { command: 'spike027-kit' }, async $ => {
    const placed = await $.ui.open({ id: KIT, title: 'Lens spike 027 kit' })
    return { text: `Kit pane opened (isPlaced: ${JSON.stringify(placed)}).` }
  })

  on('command.run', { command: 'spike027-gate' }, async ($, e) => {
    const want = e.args.trim() === 'on' ? 'on' : 'off'
    await $.fs.write(gateFile($.plugin.root), want + '\n')
    return { text: `Gate alert marker set to "${want}" at ${gateFile($.plugin.root)}.` }
  })

  on('command.run', { command: 'spike027-probe' }, async ($, e) => {
    const [verb = '', arg = ''] = e.args.trim().split(/\s+/)
    if (verb === 'on' || verb === 'off') {
      probeOn = verb === 'on'
      await update($, probeA, () => probeOn)
      if (probeOn) await plog($, 'start', { cwd, probePath })
      return { text: `Probes ${verb}. Log: ${probePath}` }
    }
    if (!probeOn) return { text: `Probes are off: run /spike027-probe on first. Log: ${probePath}` }
    if (verb === 'panes') {
      // E3: how many panes open side by side as tabs.
      const n = Math.min(Math.max(Number(arg) || 4, 1), 16)
      const results: unknown[] = []
      for (let i = 1; i <= n; i++) results.push({ i, result: await $.ui.open({ id: `${PROBE_PANE}${i}`, title: `probe ${i}` }) })
      const panes = await $.ui.panes()
      await plog($, 'E3', { asked: n, results, panes: panes.map(p => ({ id: p.id, isShown: p.isShown, isPlaced: p.isPlaced })) })
      return { text: `E3: opened ${n} probe panes; $.ui.panes() lists ${panes.length} of this plugin's. Each has a "Close all probe panes" Button.` }
    }
    if (verb === 'fs') {
      // E8: $.fs.read of a handoff record, relative with / and \, and absolute.
      const agents = (await read($, agentsA)) as Record<string, LensAgent>
      const rel = arg !== '' ? arg : (Object.values(agents).find(a => a.handoff !== null)?.handoff ?? 'docs/handoffs')
      const tries = [rel, rel.replace(/\//g, '\\'), `${cwd}/${rel}`, `${cwd}\\${rel.replace(/\//g, '\\')}`]
      const out: unknown[] = []
      for (const p of tries) {
        try {
          const text = String(await $.fs.read(p))
          out.push({ path: p, ok: true, chars: text.length, first: text.split(/\r?\n/, 1)[0] })
        } catch (err) {
          out.push({ path: p, ok: false, error: String(err) })
        }
      }
      await plog($, 'E8', { cwd, tries: out })
      return { text: `E8: ${out.map(o => JSON.stringify(o)).join('\n')}` }
    }
    if (verb === 'list') {
      const list = await $.agent.list()
      await plog($, 'E4', { reason: 'command', list })
      return { text: `E4: $.agent.list() = ${JSON.stringify(list)}` }
    }
    if (verb === 'usage') {
      const u = await $.session.usage()
      const agents = (await read($, agentsA)) as Record<string, LensAgent>
      await plog($, 'E6', { context: u.context, mainModel: agents['main']?.model ?? '', models: Object.values(agents).map(a => ({ id: a.id, model: a.model })) })
      return { text: `E6: main window ${u.context.window}, tokens ${u.context.tokens ?? '?'}; subagent windows from ${cfg.costingPath}, else main's for the same model.` }
    }
    const lines = (await read($, probeLinesA)) as number
    return { text: `Probes on, ${lines} log lines in ${probePath}. Verbs: on, off, panes <n>, fs [path], list, usage.` }
  })

  // ---- data: spawns, steps, tool calls, turn ends ----
  on('agent.spawn', async ($, e, next) => {
    const r: any = await next(e)
    try {
      const id: string | undefined = r?.agentId ?? e.resume?.agentId
      const parent = e.parentAgentId ?? 'main'
      const match = matchHandoff(e.prompt)
      if (probeOn)
        await plog($, 'E1', {
          site: 'agent.spawn',
          tool_use_id: e.tool_use_id,
          keys: Object.keys(e),
          subagentType: e.subagentType,
          model: e.model ?? null,
          parentModel: e.parentModel,
          firstLine: (e.prompt.split(/\r?\n/, 1)[0] ?? '').slice(0, 300),
          match,
          result: { model: r?.model, agentId: r?.agentId, teammateId: r?.teammateId, deny: r?.deny },
        })
      if (id === undefined) return r
      // One write: create-or-patch, the respawn test against the state as it stands (round 3 root cause).
      let existedBefore = false
      await update($, agentsA, m => {
        const all = m as Record<string, LensAgent>
        existedBefore = all[id] !== undefined
        const cur = all[id] ?? blankAgent(id, parent, e.subagentType)
        const again = isRespawn(all, id, parent, e.subagentType, e.tool_use_id)
        return {
          ...all,
          [id]: {
            ...cur,
            parent,
            type: e.subagentType,
            name: e.name ?? cur.name,
            description: e.description,
            model: String(r?.model ?? cur.model),
            callModel: e.model ?? '',
            parentModel: e.parentModel ?? '',
            prompt: e.prompt,
            status: ENDED.has(cur.status) && cur.toolUseId === e.tool_use_id ? cur.status : 'running',
            toolUseId: e.tool_use_id,
            handoff: match?.path ?? cur.handoff,
            handoffHow: match?.how ?? cur.handoffHow,
            loop: cur.loop || again,
            endedAt: null,
          },
        }
      })
      await update($, orderA, o => (o.includes(id) ? o : [...o, id]))
      await update($, callAgentA, m => ({ ...(m as Record<string, string>), [e.tool_use_id]: id }))
      await loadDef($, e.subagentType)
      if (probeOn) {
        const now = ((await read($, agentsA)) as Record<string, LensAgent>)[id]
        await plog($, 'E9', { site: 'agent.spawn after patch', tool_use_id: e.tool_use_id, agentId: id, existedBefore, stored: { type: now?.type, toolUseId: now?.toolUseId, loop: now?.loop } })
        await refreshList($, 'spawn')
      }
    } catch (err) {
      lensFail('agent.spawn', err)
    }
    return r
  })

  on('turn.start', async ($, e, next) => {
    try {
      const key = e.agentId ?? 'main'
      if (probeOn) await plog($, 'E9', { site: 'turn.start', agent: key, known: ((await read($, agentsA)) as Record<string, LensAgent>)[key]?.toolUseId ?? null })
      await ensureAgent($, key, key === 'main' ? null : 'main', '')
      await patchAgent($, key, a => ({ ...a, status: 'running' }))
    } catch (err) {
      lensFail('turn.start', err)
    }
    return next(e)
  })

  // Pass-through observer (step 16 Q1, E2): every chunk is yielded on unchanged.
  on('turn.step', async function* ($, e, next) {
    const key = e.agentId ?? 'main'
    const ids: string[] = []
    const counts: Record<string, number> = {}
    let spent = 0
    let thinkingChars = 0
    const thinkingIdx = new Set<number>()
    let usage: Tokens | null = null
    let model = e.model
    // The first Agent call of this message: its chat row draws the flowchart for all of them (round 2).
    let lead: string | null = null
    const agentCalls: string[] = []
    for await (const c of next(e)) {
      const t0 = nowMs()
      counts[c.kind] = (counts[c.kind] ?? 0) + 1
      if (c.kind === 'thinking') {
        thinkingChars += c.text.length
        thinkingIdx.add(c.index)
        thinkBuf[key] = (thinkBuf[key] ?? '') + c.text
      } else if (c.kind === 'tool') {
        ids.push(c.id)
        if (AGENT_TOOLS.has(c.name)) {
          lead ??= c.id
          agentCalls.push(c.id)
          const l = lead
          try {
            await update($, batchesA, m => addToBatch(m as Record<string, LensBatch>, l, key, c.id))
          } catch (err) {
            lensFail('turn.step batch', err)
          }
        }
      } else if (c.kind === 'stop' && c.usage) {
        usage = fromUsage(c.usage)
        model = c.usage.model
      }
      spent += nowMs() - t0
      yield c
    }
    try {
      thinkBlocks[key] = (thinkBlocks[key] ?? 0) + thinkingIdx.size
      const t1 = nowMs()
      const buf = thinkBuf[key] ?? ''
      if (buf !== '') {
        thinkBuf[key] = ''
        await update($, thinkingA, m => {
          const prev = (m as Record<string, string>)[key] ?? ''
          const joined = prev === '' || prev.startsWith('[') ? buf : prev + '\n---\n' + buf
          return { ...m, [key]: joined.length > cfg.thinkingChars ? '...' + joined.slice(-cfg.thinkingChars) : joined }
        })
      }
      for (const id of ids) stepOfCall[id] = { out: usage?.out ?? 0, n: ids.length }
      await ensureAgent($, key, key === 'main' ? null : 'main', '')
      await patchAgent($, key, a => ({
        ...a,
        model: model !== '' ? model : a.model,
        steps: usage ? addTokens(a.steps, usage) : a.steps,
        last: usage ?? a.last,
      }))
      if (probeOn) await plog($, 'E2', { agent: key, index: e.index, counts, agentCalls, thinkingChars, observeMs: spent, afterMs: nowMs() - t1, usage })
    } catch (err) {
      lensFail('turn.step', err)
    }
  })

  on('tool.call', async ($, e, next) => {
    const ctx = await beforeCall($, e)
    const r: any = await next(e)
    if (ctx !== null) await afterCall($, ctx, r)
    return r
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    try {
      const key = e.agentId ?? 'main'
      await ensureAgent($, key, key === 'main' ? null : 'main', '')
      const usage = e.usage ? fromUsage(e.usage) : null
      const agents = (await read($, agentsA)) as Record<string, LensAgent>
      const teammate = (agents[key]?.type ?? '') === 'teammate'
      const status = key === 'main' || teammate ? 'idle' : e.reason === 'answer' ? 'completed' : e.reason === 'aborted' ? 'killed' : 'failed'
      await patchAgent($, key, a => ({
        ...a,
        status,
        model: e.usage?.model ?? a.model,
        turns: usage ? addTokens(a.turns, usage) : a.turns,
        endedAt: nowMs(),
      }))
      if (key === 'main') {
        try {
          const u = await $.session.usage()
          await update($, mainWindowA, () => u.context.window)
        } catch {
          // keep the last window
        }
        // A changed lens.json, settings env or costing file shows from the next turn on.
        await loadSettings($)
        await loadCosting($)
      }
      const stored = await backfillThinking($, key, thinkBlocks[key] ?? 0)
      if (probeOn && stored !== null) await plog($, 'E2', { site: 'turn.complete stored thinking', agent: key, streamedBlocks: thinkBlocks[key] ?? 0, stored: { blocks: stored.blocks, chars: stored.chars, redacted: stored.redacted, error: stored.error ?? null } })
      if (probeOn) {
        const after = ((await read($, agentsA)) as Record<string, LensAgent>)[key]
        await plog($, 'E5', { agent: key, reason: e.reason, turnUsage: usage, turnsSum: after?.turns, stepsSum: after?.steps, rows: key === 'main' ? null : await scanUsage($, key) })
        await refreshList($, 'turn.complete')
      }
    } catch (err) {
      lensFail('turn.complete', err)
    }
    return r
  })

  // ---- the lens pane (L1-L6) ----
  on('ui.render', { component: 'Pane', requestId: LENS }, async ($, e) => {
    const t = $.ui.resolve(e) as any
    const { Box, Text, Button } = t
    const { agents, defs, conf, s, label } = await snapshot($)
    const order = (await read($, orderA)) as string[]
    const ui = (await read($, uiA)) as LensUi
    const thinking = (await read($, thinkingA)) as Record<string, string>
    const context = (await read($, contextA)) as LensCall[]
    const mainWindow = (await read($, mainWindowA)) as number
    const calls = (await read($, callsA)) as Record<string, LensCall[]>
    const open = (await read($, cardOpenA)) as Record<string, boolean>
    const costing = (await read($, costingA)) as LensCosting
    const hasSvg = e.surface !== 'terminal'

    const modeRow = (
      <Box flexDirection="row">
        <Text dimColor>Panels: </Text>
        <Button key="mode-pane" label={ui.panelMode === 'pane' ? '(separate pane)' : 'separate pane'} onPress={() => update($, uiA, u => ({ ...u, panelMode: 'pane', drill: null }))} />
        <Button key="mode-drill" label={ui.panelMode === 'drill' ? '(drill-in)' : 'drill-in'} onPress={() => update($, uiA, u => ({ ...u, panelMode: 'drill' }))} />
      </Box>
    )

    if (ui.drill !== null) {
      return (
        <Box flexDirection="column">
          <Button key="drill-back" label="< Back" onPress={() => update($, uiA, u => ({ ...u, drill: null }))} />
          {ui.drill === 'edge'
            ? edgeBody($, t, ui, (await read($, docA)) as LensDoc, agents, label, open, s)
            : agentBody($, t, ui, agents, calls, thinking, mainWindow, label, defs, costing, open, s)}
        </Box>
      )
    }

    const ids = order.filter(id => agents[id])
    const on1 = hasSvg ? false : ((await read($, tick)) as boolean)
    const mainThinking = thinking['main'] ?? ''
    const thOpen = isOpen(open, 'pane:thinking', s)
    const ctxOpen = isOpen(open, 'pane:context', s)
    const setOpen = isOpen(open, 'pane:settings', s)
    return (
      <Box flexDirection="column">
        <Text bold>Workflow</Text>
        {chartNode(t, hasSvg, on1, ids, agents, label, s, `Flowchart of ${ids.length} agents`)}
        {agentButtons($, t, order, agents, label, false, null)}
        {modeRow}
        <Text bold>{agents['main'] ? label(agents['main']).name : 'Main loop'} (main loop)</Text>
        <Box flexDirection="row">
          <Button key="lens-thinking" label={thOpen ? '[-]' : '[+]'} onPress={() => toggleOpen($, 'pane:thinking', s)} />
          <Text> Thinking ({mainThinking.length} chars)</Text>
        </Box>
        {thOpen && <Text dimColor>{mainThinking === '' ? '(no thinking chunks seen yet)' : mainThinking}</Text>}
        <Box flexDirection="row">
          <Button key="lens-context" label={ctxOpen ? '[-]' : '[+]'} onPress={() => toggleOpen($, 'pane:context', s)} />
          <Text> Gathered context ({context.length} calls)</Text>
        </Box>
        {ctxOpen &&
          context.map(c => (
            <Text dimColor>
              {c.status === 'running' ? '...' : c.status === 'error' ? 'ERR' : 'ok '} {c.tool} {c.summary}
            </Text>
          ))}
        <Box flexDirection="row">
          <Button key="lens-settings" label={setOpen ? '[-]' : '[+]'} onPress={() => toggleOpen($, 'pane:settings', s)} />
          <Text> Lens settings ({KEYS.filter(k => conf.sources[k] !== 'default').length} set, {conf.ignored.length} ignored)</Text>
        </Box>
        {setOpen && settingsRows(t, conf)}
        <Text dimColor>The figures, the cost and the window are in each avatar's panel.</Text>
        {lensErrors.map(x => (
          <Text color="red">lens hook error: {x}</Text>
        ))}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: EDGE }, async ($, e) => {
    const t = $.ui.resolve(e) as any
    const { agents, s, label } = await snapshot($)
    return edgeBody($, t, (await read($, uiA)) as LensUi, (await read($, docA)) as LensDoc, agents, label, (await read($, cardOpenA)) as Record<string, boolean>, s)
  })

  on('ui.render', { component: 'Pane', requestId: AGENT }, async ($, e) => {
    const t = $.ui.resolve(e) as any
    const { agents, defs, s, label } = await snapshot($)
    return agentBody(
      $,
      t,
      (await read($, uiA)) as LensUi,
      agents,
      (await read($, callsA)) as Record<string, LensCall[]>,
      (await read($, thinkingA)) as Record<string, string>,
      (await read($, mainWindowA)) as number,
      label,
      defs,
      (await read($, costingA)) as LensCosting,
      (await read($, cardOpenA)) as Record<string, boolean>,
      s,
    )
  })

  // Finding 1b: the flowchart of one batch in its own pane, opened from the card's "Open flowchart" Button.
  on('ui.render', { component: 'Pane', requestId: CHART }, async ($, e) => {
    const t = $.ui.resolve(e) as any
    const { Box, Text } = t
    const { agents, s, label } = await snapshot($)
    const lead = (await read($, chartLeadA)) as string
    const batches = (await read($, batchesA)) as Record<string, LensBatch>
    const order = (await read($, orderA)) as string[]
    const callAgent = (await read($, callAgentA)) as Record<string, string>
    const batch = lead !== '' ? batches[lead] : undefined
    if (!batch) return <Text dimColor>No flowchart chosen: press "Open flowchart" in a chat card.</Text>
    const view = batchView(batch, agents, order, callAgent)
    const hasSvg = e.surface !== 'terminal'
    const on1 = hasSvg ? false : ((await read($, tick)) as boolean)
    return (
      <Box flexDirection="column">
        <Text bold>
          Workflow: {label(view.agents[batch.parent]!).name} spawned {batch.ids.length} agent{batch.ids.length > 1 ? 's' : ''}
        </Text>
        {chartNode(t, hasSvg, on1, view.ids, view.agents, label, s, `Flowchart: ${batch.ids.length} agent(s)`)}
        {agentButtons($, t, view.ids, view.agents, label, true, batch.parent)}
      </Box>
    )
  })

  // E3 probe panes, one hook per id (`lens-027-p1` .. `lens-027-p16`).
  for (let i = 1; i <= 16; i++)
    on('ui.render', { component: 'Pane', requestId: `${PROBE_PANE}${i}` }, async ($, e) => {
      const { Box, Text, Button } = $.ui.resolve(e) as any
      return (
        <Box flexDirection="column">
          <Text>E3 probe pane {e.requestId.slice(PROBE_PANE.length)}: placement={e.props.placement} bodyColumns={e.props.bodyColumns}</Text>
          <Button
            key="probe-close"
            label="Close all probe panes"
            onPress={async () => {
              for (const p of await $.ui.panes()) if (p.id.startsWith(PROBE_PANE)) await $.ui.close({ id: p.id })
            }}
          />
        </Box>
      )
    })

  // ---- round-0 kit pane: sections 1, 2, 3 (checks K1-K3) ----
  on('ui.render', { component: 'Pane', requestId: KIT }, async ($, e) => {
    const { Box, Text, Button, Svg } = $.ui.resolve(e) as any
    const body = e.props.bodyColumns
    const placement = e.props.placement
    const fs = e.viewport?.isFullscreen === undefined ? 'absent' : String(e.viewport.isFullscreen)
    const forced = await read($, forceMode)
    const auto = placement === 'dock' ? 'flowchart' : 'compact'
    const mode = forced === 'auto' ? auto : forced

    redrawCount += 1
    redraws.push({ n: redrawCount, body, cols: e.viewport?.columns, placement, fs, mode })
    if (redraws.length > 8) redraws.shift()

    const on1 = await read($, tick)
    const expanded = await read($, paneExpanded)
    const presses = await read($, panePresses)
    const hasSvg = e.surface !== 'terminal'

    return (
      <Box flexDirection="column">
        <Text bold>[1] Resize across the dock boundary</Text>
        <Text>
          surface={e.surface} placement={placement} bodyColumns={body} viewport.columns={String(e.viewport?.columns)} isFullscreen={fs}
        </Text>
        <Text>
          mode={mode} (auto would be {auto}; override={forced})
        </Text>
        {mode === 'flowchart' ? (
          <Text>FLOWCHART  [PO] -&gt; [RA] -&gt; [SA]+[SE] -&gt; [SWE] -&gt; [SQA] -&gt; [CR]</Text>
        ) : (
          <Text>COMPACT  PO RA SA SE SWE SQA CR  (stage 3/7)</Text>
        )}
        <Box flexDirection="row">
          <Button key="mode-auto" label="auto" onPress={() => update($, forceMode, () => 'auto')} />
          <Button key="mode-compact" label="compact" onPress={() => update($, forceMode, () => 'compact')} />
          <Button key="mode-flow" label="flowchart" onPress={() => update($, forceMode, () => 'flowchart')} />
        </Box>
        <Text dimColor>redraw log (last 8):</Text>
        {redraws.map(r => (
          <Text dimColor>
            #{r.n} body={r.body} cols={String(r.cols)} {r.placement} fs={r.fs} -&gt; {r.mode}
          </Text>
        ))}

        <Text bold>[2] Svg animation</Text>
        {hasSvg ? (
          <Box flexDirection="row">
            <Text>A SMIL:</Text>
            <Svg source={svgDot('#2e7d32', true)} alt="SMIL blinking green dot" width={24} height={24} isInteractive={true} />
            <Text> B timer:</Text>
            <Svg source={svgDot(on1 ? '#2e7d32' : '#cfd8dc', false)} alt="timer blinking green dot" width={24} height={24} />
            <Text> C steady:</Text>
            <Svg source={svgDot('#2e7d32', false)} alt="steady green dot" width={24} height={24} />
          </Box>
        ) : (
          <Text dimColor>(terminal: no Svg element; text fallback below)</Text>
        )}
        <Text>
          D text timer: <Text color={on1 ? 'green' : 'gray'}>{on1 ? '●' : '○'}</Text>  tick={String(on1)}
        </Text>

        <Text bold>[3] Buttons (pane)</Text>
        <Box flexDirection="row">
          <Button
            key="pane-expand"
            label={expanded ? '[-]' : '[+]'}
            onPress={async () => {
              await update($, paneExpanded, x => !x)
              await update($, panePresses, n => n + 1)
            }}
          />
          <Text> presses={presses}</Text>
        </Box>
        {expanded && <Text>expanded content: the pane button works</Text>}

        <Text bold>[4] Transcript cards</Text>
        <Text>ToolUse cards drawn={toolUseCards}  ToolResult hooks passed through={toolResultHooks}</Text>
        <Text bold>[5] Gate alert</Text>
        <Text>classic.Stop seen by module={stopEvents}  (toggle: /spike027-gate on|off)</Text>
      </Box>
    )
  })

  // ---- the chat card (rounds 2-3): the flowchart at the top of the first Agent row of a message ----
  // The native row is always last (US-15, AC-15.5): the card wraps it, never replaces it. Finding 5:
  // the native Agent row is drawn without the prompt (the arrow panel shows it); expanded, it is whole.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const tool = String(e.props.tool)
    if (!CARD_TOOLS.has(tool)) return next(e)
    const input = (e.props.input ?? {}) as Record<string, unknown>
    const stripPrompt = AGENT_TOOLS.has(tool) && e.props.isExpanded !== true && typeof input.prompt === 'string'
    let native: any
    if (stripPrompt) {
      const { prompt: _p, ...rest } = input
      native = await next({ ...e, props: { ...e.props, input: rest } } as typeof e)
    } else native = await next(e)
    toolUseCards += 1
    const t = $.ui.resolve(e) as any
    const { Box, Text, Button } = t
    const id = e.props.tool_use_id
    if (tool === 'SendMessage') {
      return (
        <Box flexDirection="column">
          <Text dimColor>lens: message to {String(input.to ?? '?')}; its arrow in the flowchart is two-way</Text>
          {native}
        </Box>
      )
    }
    const batches = (await read($, batchesA)) as Record<string, LensBatch>
    const { agents, s, label } = await snapshot($)
    const lead = leadOf(batches, id)
    const batch: LensBatch =
      lead !== null
        ? batches[lead]!
        : {
            parent: Object.values(agents).find(a => a.toolUseId === id)?.parent ?? 'main',
            ids: [id],
            pending: {
              [id]: {
                type: String(input.subagent_type ?? ''),
                description: String(input.description ?? ''),
                name: String(input.name ?? ''),
                prompt: String(input.prompt ?? ''),
                model: typeof input.model === 'string' ? input.model : '',
              },
            },
          }
    if (lead !== null && lead !== id) {
      return (
        <Box flexDirection="column">
          <Text dimColor>
            lens: agent {batch.ids.indexOf(id) + 1} of {batch.ids.length} spawned in parallel; the flowchart is on the first of them, above
          </Text>
          {native}
        </Box>
      )
    }
    const order = (await read($, orderA)) as string[]
    const thinking = (await read($, thinkingA)) as Record<string, string>
    const calls = (await read($, callsA)) as Record<string, LensCall[]>
    const mainContext = (await read($, contextA)) as LensCall[]
    const open = (await read($, cardOpenA)) as Record<string, boolean>
    const callAgent = (await read($, callAgentA)) as Record<string, string>
    const hasSvg = e.surface !== 'terminal'
    const on1 = hasSvg ? false : ((await read($, tick)) as boolean)
    const view = batchView(batch, agents, order, callAgent)
    const root = view.agents[batch.parent]!
    const n = batch.ids.length
    const th = thinking[batch.parent] ?? ''
    const ctx = (batch.parent === 'main' ? mainContext : (calls[batch.parent] ?? []).filter(c => CONTEXT_TOOLS.has(c.tool))).slice(-s.contextLimit)
    const thOpen = isOpen(open, `${id}:thinking`, s)
    const ctxOpen = isOpen(open, `${id}:context`, s)
    const rootName = label(root).name
    const width = flowchartSvg(view.ids, view.agents, label, chartSize(s)).width
    const full = showChart(s.chartMode, width, e.viewport?.columns, s.breakpointColumns, s.cellPx)
    const chip = view.members
      .map(m => {
        const a = view.agents[m]!
        return `${initials(label(a).name)} ${a.status === 'pending' ? 'waiting' : a.status}`
      })
      .join(', ')
    return (
      <Box flexDirection="column" borderStyle="round">
        <Text bold>
          Workflow: {rootName} spawned {n} agent{n > 1 ? 's in parallel' : ''}
        </Text>
        {full ? (
          chartNode(t, hasSvg, on1, view.ids, view.agents, label, s, `Flowchart: ${rootName} spawned ${n} agent(s)`)
        ) : (
          <Box flexDirection="row" flexWrap="wrap">
            <Text dimColor>{chip} </Text>
            <Button key="card-open-chart" label="Open flowchart" onPress={() => openChart($, id)} />
          </Box>
        )}
        {agentButtons($, t, view.ids, view.agents, label, true, batch.parent)}
        <Box flexDirection="row">
          <Button key="card-thinking" label={thOpen ? '[-]' : '[+]'} onPress={() => toggleOpen($, `${id}:thinking`, s)} />
          <Text>
            {' '}
            {rootName} thinking ({th.length} chars)
          </Text>
        </Box>
        {thOpen && <Text dimColor>{th === '' ? '(no thinking chunks seen yet)' : th}</Text>}
        <Box flexDirection="row">
          <Button key="card-context" label={ctxOpen ? '[-]' : '[+]'} onPress={() => toggleOpen($, `${id}:context`, s)} />
          <Text> Gathered context ({ctx.length} calls)</Text>
        </Box>
        {ctxOpen &&
          ctx.map(c => (
            <Text dimColor>
              {c.status === 'running' ? '...' : c.status === 'error' ? 'ERR' : 'ok '} {c.tool} {c.summary}
            </Text>
          ))}
        {lensErrors.map(x => (
          <Text color="red">lens hook error: {x}</Text>
        ))}
        {native}
      </Box>
    )
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (CARD_TOOLS.has(String(e.props.tool))) toolResultHooks += 1
    return next(e)
  })

  // ---- background tasks at stop time (step 16 Q6, E7) ----
  on('classic.SubagentStop', async ($, e, next) => {
    const result = await next(e)
    const tasks: LensTask[] = (e.background_tasks ?? []).map(b => ({ id: b.id, type: b.type, status: b.status, description: b.description, source: 'SubagentStop' }))
    await patchAgent($, e.agent_id, a => ({ ...a, bg: mergeStopTasks(a.bg, tasks) }))
    if (probeOn) await plog($, 'E7', { site: 'classic.SubagentStop', agent: e.agent_id, background_tasks: e.background_tasks ?? null })
    return result
  }).catch(($, e, next) => next(e))

  // ---- kit section 5b, and main's stop-time background tasks ----
  on('classic.Stop', async ($, e, next) => {
    const result = await next(e)
    stopEvents += 1
    const tasks: LensTask[] = (e.background_tasks ?? []).map(b => ({ id: b.id, type: b.type, status: b.status, description: b.description, source: 'Stop' }))
    await patchAgent($, 'main', a => ({ ...a, bg: mergeStopTasks(a.bg, tasks) }))
    if (probeOn) await plog($, 'E7', { site: 'classic.Stop', background_tasks: e.background_tasks ?? null })
    if (probeOn) {
      // E9: what the card would draw for each batch, against the agents as stored.
      const all = (await read($, agentsA)) as Record<string, LensAgent>
      const bs = (await read($, batchesA)) as Record<string, LensBatch>
      const order = (await read($, orderA)) as string[]
      const callAgent = (await read($, callAgentA)) as Record<string, string>
      await plog($, 'E9', {
        site: 'state at Stop',
        agents: Object.values(all).map(a => ({ id: a.id, type: a.type, toolUseId: a.toolUseId, status: a.status, parent: a.parent, loop: a.loop })),
        batches: bs,
        callAgent,
        views: Object.values(bs).map(b => batchView(b, all, order, callAgent).members),
      })
    }
    if (await gateIsOn($ as any)) $.ui.toast('ai-dlc-lens spike: gate alert test (5b, module toast on classic.Stop)')
    return result
  }).catch(($, e, next) => next(e))
}
