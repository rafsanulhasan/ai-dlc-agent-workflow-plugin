// ITEM-027 spike — throwaway. Not plugin source; discarded after the human's check.
// Round 1 (step 17): the human's lens card. `/spike027` opens it:
//   L1 orchestrator view: thinking and gathered context, each collapsible (pane section, step 16 Q1)
//   L2 flowchart: an avatar per agent (Svg), a Button per avatar and per arrow under it (step 16 Q2)
//   L3 five lines under each avatar: name (model), role, context used/window, in/out, cache r/w/uncached
//   L4 arrow -> separate pane `lens-027-edge` (or drill-in): handoff record, hand-back, their tokens
//   L5 avatar -> separate pane `lens-027-agent` (or drill-in): background tasks, tool calls, thinking
//   L6 loops draw a two-way arrow; running avatars blink green, finished ones stay green
// Round 2 (step 17.l1): the same flowchart sits at the top of the chat card. The ToolUse row of the
// first Agent call of an assistant message draws it for every Agent call of that message (parallel
// spawns side by side), with the avatar and arrow Buttons, collapsible thinking and gathered context,
// and the native row last; the message's other Agent rows stay compact, native row kept.
// Experiments E1-E8 (step 16) log to PROBE-LOG.jsonl while `/spike027-probe on`.
// The round-0 kit (checks 1-5: resize, Svg blink, buttons, transcript cards, gate alert) is `/spike027-kit`.
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'
import type { LensAgent, LensBatch, LensCall, LensDoc, LensTask, LensUi, Tokens } from '../types'
import {
  AGENT_TOOLS,
  CONTEXT_TOOLS,
  ZERO,
  addTokens,
  addToBatch,
  batchView,
  cardLines,
  displayName,
  flowchartSvg,
  fmtTokens,
  fromUsage,
  leadOf,
  matchHandoff,
  mergeStopTasks,
  notePending,
  parseRecord,
  pickHandback,
  roleOf,
  summarize,
  textChart,
} from './lens'

const P = 'ai-dlc-lens-spike-027'
const KIT = 'lens-spike-027'
const LENS = 'lens-027'
const EDGE = 'lens-027-edge'
const AGENT = 'lens-027-agent'
const PROBE_PANE = 'lens-027-p'

// ---- round-0 kit state ----
const tick = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'tick' } as const, false)
const paneExpanded = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'paneExpanded' } as const, false)
const panePresses = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'panePresses' } as const, 0)
const forceMode = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'forceMode' } as const, 'auto')

// ---- round-1 lens state ----
const UI0: LensUi = {
  thinkingOpen: false,
  contextOpen: false,
  panelMode: 'pane',
  edge: null,
  agent: null,
  drill: null,
  edgeDocOpen: true,
  edgeBackOpen: true,
  agentThinkingOpen: false,
}
const DOC0: LensDoc = { agent: '', handoff: '', handoffText: '', handback: '', handbackText: '', error: '' }
const agentsA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'agents' } as const, {}, { shape: 'agents-1' })
const orderA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'order' } as const, [], { shape: 'order-1' })
const callsA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'calls' } as const, {}, { shape: 'calls-1' })
const thinkingA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'thinking' } as const, {})
const contextA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'context' } as const, [], { shape: 'context-1' })
const mainWindowA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'mainWindow' } as const, 0)
const uiA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'ui' } as const, UI0, { shape: 'ui-1' })
const docA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'doc' } as const, DOC0, { shape: 'doc-1' })
const probeA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'probe' } as const, false)
const probeLinesA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'probeLines' } as const, 0)
// ---- round-2 chat card state ----
const batchesA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'batches' } as const, {}, { shape: 'batches-1' })
const cardOpenA = atom({ plugin: 'ai-dlc-lens-spike-027', key: 'cardOpen' } as const, {})

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

const nowMs = () => Date.now()
const cap = (s: string, n: number) => (s.length > n ? s.slice(0, n) + `\n... [+${s.length - n} chars]` : s)

const blankAgent = (id: string, parent: string | null, type: string): LensAgent => ({
  id,
  parent,
  type,
  name: '',
  description: '',
  model: '',
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

// ---- probes (E1-E8) ----
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
  const all = (await read($, agentsA)) as Record<string, LensAgent>
  if (all[id]) return
  await update($, agentsA, m => ({ ...m, [id]: blankAgent(id, parent, type) }))
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
    return { ...m, [key]: [...list, call].slice(-80) }
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
      if (cur && cur.status !== a.status && a.status !== 'completed') out[a.id] = { ...cur, status: String(a.status) }
    }
    return out
  })
}

async function findFallbackRecord($: any, role: string, startedAt: number): Promise<string | null> {
  // Time order + agent type (step 16 Q7 fallback): the newest `*-to-<role>.handoff.md` written before the spawn.
  let best: { path: string; mtime: number } | null = null
  try {
    for (const run of await $.fs.list('docs/handoffs')) {
      if (run.kind !== 'dir') continue
      for (const f of await $.fs.list(`docs/handoffs/${run.name}`)) {
        if (f.kind !== 'file' || !f.name.endsWith(`-to-${role}.handoff.md`)) continue
        const mt = Number(f.mtimeMs ?? f.mtime ?? 0)
        if (mt <= startedAt + 60_000 && (best === null || mt > best.mtime)) best = { path: `docs/handoffs/${run.name}/${f.name}`, mtime: mt }
      }
    }
  } catch {
    return null
  }
  return best?.path ?? null
}

async function loadDoc($: any, id: string) {
  const agents = (await read($, agentsA)) as Record<string, LensAgent>
  const a = agents[id]
  if (!a) return
  let path = a.handoff
  if (path === null) {
    path = await findFallbackRecord($, roleOf(a.type), a.startedAt)
    if (path !== null) await patchAgent($, id, x => ({ ...x, handoff: path, handoffHow: 'fallback' }))
  }
  const doc: LensDoc = { ...DOC0, agent: id }
  if (path === null) {
    doc.error = 'No handoff record: the brief named none and no `*-to-' + roleOf(a.type) + '.handoff.md` was found.'
    await update($, docA, () => doc)
    return
  }
  doc.handoff = path
  try {
    doc.handoffText = cap(String(await $.fs.read(path)), 6000)
  } catch (err) {
    doc.error = `read ${path}: ${String(err)}`
  }
  const rec = parseRecord(path)
  if (rec) {
    try {
      const names = ((await $.fs.list(rec.dir)) as { name: string }[]).map(f => f.name)
      const hb = pickHandback(names, rec)
      if (hb !== null) {
        doc.handback = `${rec.dir}/${hb}`
        doc.handbackText = cap(String(await $.fs.read(doc.handback)), 6000)
      } else doc.handbackText = '(no hand-back yet)'
    } catch (err) {
      doc.error += ` list ${rec.dir}: ${String(err)}`
    }
  }
  await update($, docA, () => doc)
  await plog($, 'E8', { via: 'arrow press', path, ok: doc.handoffText !== '', handback: doc.handback, error: doc.error })
}

/** `fromChat`: pressed in a chat card, which has no drill-in: always the separate pane. */
async function openEdge($: any, id: string, title: string, fromChat: boolean) {
  const u = (await read($, uiA)) as LensUi
  const pane = fromChat || u.panelMode === 'pane'
  await update($, uiA, x => ({ ...x, edge: id, drill: pane ? (fromChat ? x.drill : null) : 'edge' }))
  await loadDoc($, id)
  if (pane) {
    const r = await $.ui.open({ id: EDGE, title: cap(`Hand-off: ${title}`, 60) })
    await plog($, 'E3', { open: EDGE, result: r })
  }
}

async function openAgent($: any, id: string, title: string, fromChat: boolean) {
  const u = (await read($, uiA)) as LensUi
  const pane = fromChat || u.panelMode === 'pane'
  await update($, uiA, x => ({ ...x, agent: id, drill: pane ? (fromChat ? x.drill : null) : 'agent' }))
  await refreshList($, 'avatar press')
  if (pane) {
    const r = await $.ui.open({ id: AGENT, title: cap(`Agent: ${title}`, 60) })
    await plog($, 'E3', { open: AGENT, result: r })
  }
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
    if (key === 'main' && CONTEXT_TOOLS.has(tool)) await update($, contextA, l => [...l.filter(c => c.id !== id), call].slice(-60))
    if (tool === 'SendMessage' && typeof input.to === 'string') {
      // A message to a running agent is a loop: the arrow becomes two-way (US-12).
      const to = input.to
      const agents = (await read($, agentsA)) as Record<string, LensAgent>
      const hit = Object.values(agents).find(a => a.id === to || a.name === to)
      if (hit) await patchAgent($, hit.id, a => ({ ...a, loop: true }))
    }
    if (AGENT_TOOLS.has(tool)) {
      // The chat card's placeholder avatar until agent.spawn names the agent; a call no step reported is a batch of its own.
      const p = { type: String(input.subagent_type ?? ''), description: String(input.description ?? ''), name: String(input.name ?? '') }
      await update($, batchesA, m => notePending(m as Record<string, LensBatch>, key, id, p))
    }
    if (probeOn && (tool === 'Agent' || tool === 'Task'))
      await plog($, 'E1', { site: 'tool.call', tool, inputKeys: Object.keys(input), hasPrompt: typeof input.prompt === 'string', firstLine: String(input.prompt ?? '').split(/\r?\n/, 1)[0]?.slice(0, 300) })
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
    await pushCall($, key, { ...call, status })
    if (key === 'main' && CONTEXT_TOOLS.has(tool)) await update($, contextA, l => l.map(c => (c.id === id ? { ...c, status } : c)))
    if (probeOn && tool === 'Bash' && input.run_in_background === true) {
      const list = (await $.agent.list()) as any[]
      await plog($, 'E7', { site: 'after background Bash', result: r?.result ?? null, agentList: list.map(a => ({ id: a.id, type: a.type, status: a.status })) })
    }
    if (probeOn && (tool === 'Agent' || tool === 'Task')) await plog($, 'E1', { site: 'tool.call result', result: r?.result ?? null })
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
      ? th.text.slice(-4000)
      : `[no thinking text: ${streamedBlocks} block(s) streamed empty; transcript holds ${th.blocks} thinking block(s) with ${th.chars} chars, ${th.redacted} redacted]`
  await update($, thinkingA, m => ({ ...m, [key]: note }))
  return th
}

// ---- drawing helpers (called by name with `$`) ----
/** `root`: the chat card's top avatar, whose own arrow (from its spawner) is not in that card. */
function agentButtons($: any, t: any, order: string[], agents: Record<string, LensAgent>, fromChat: boolean, root: string | null) {
  const { Box, Text, Button } = t
  const ids = order.filter(id => agents[id])
  const edges = ids.filter(id => id !== root && agents[id]!.parent !== null)
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" flexWrap="wrap">
        <Text dimColor>Avatars: </Text>
        {ids.map(id => (
          <Button key={`agent-${id}`} label={displayName(agents[id]!)} onPress={() => openAgent($, id, displayName(agents[id]!), fromChat)} />
        ))}
      </Box>
      <Box flexDirection="row" flexWrap="wrap">
        <Text dimColor>Arrows: </Text>
        {edges.length === 0 && <Text dimColor>(none yet)</Text>}
        {edges.map(id => {
          const a = agents[id]!
          const from = agents[a.parent!]
          const code = a.handoff !== null ? (parseRecord(a.handoff)?.code ?? '') : ''
          const label = `${code !== '' ? code + ' ' : ''}${from ? displayName(from) : '?'} ${a.loop ? '<->' : '->'} ${displayName(a)}`
          return <Button key={`edge-${id}`} label={label} onPress={() => openEdge($, id, label, fromChat)} />
        })}
      </Box>
    </Box>
  )
}

function edgeBody($: any, t: any, ui: LensUi, doc: LensDoc, agents: Record<string, LensAgent>) {
  const { Box, Text, Button } = t
  const a = ui.edge !== null ? agents[ui.edge] : undefined
  if (!a) return <Text dimColor>Press an arrow under the flowchart.</Text>
  const from = a.parent !== null ? agents[a.parent] : undefined
  const tk = a.turns
  return (
    <Box flexDirection="column">
      <Text bold>
        {from ? displayName(from) : '?'} {a.loop ? '<->' : '->'} {displayName(a)} ({roleOf(a.type)})
      </Text>
      <Text>
        Hand-off tokens (callee's turn.complete, summed): in {fmtTokens(tk.in + tk.cr + tk.cw)}, out {fmtTokens(tk.out)}; cache r {fmtTokens(tk.cr)} / w {fmtTokens(tk.cw)} / uncached {fmtTokens(tk.in)}
      </Text>
      <Text dimColor>
        Step sums (turn.step): in {fmtTokens(a.steps.in + a.steps.cr + a.steps.cw)}, out {fmtTokens(a.steps.out)}. Record matched: {a.handoffHow}
        {a.handoffHow === 'fallback' ? ' (time order + agent type: check it)' : ''}
      </Text>
      {doc.error !== '' && <Text color="red">{doc.error}</Text>}
      <Box flexDirection="row">
        <Button key="edge-doc" label={ui.edgeDocOpen ? '[-]' : '[+]'} onPress={() => update($, uiA, u => ({ ...u, edgeDocOpen: !u.edgeDocOpen }))} />
        <Text bold> Handoff record </Text>
        <Text dimColor>{doc.handoff}</Text>
      </Box>
      {ui.edgeDocOpen && <Text>{doc.handoffText}</Text>}
      <Box flexDirection="row">
        <Button key="edge-back" label={ui.edgeBackOpen ? '[-]' : '[+]'} onPress={() => update($, uiA, u => ({ ...u, edgeBackOpen: !u.edgeBackOpen }))} />
        <Text bold> Hand-back </Text>
        <Text dimColor>{doc.handback}</Text>
      </Box>
      {ui.edgeBackOpen && <Text>{doc.handbackText}</Text>}
    </Box>
  )
}

function agentBody($: any, t: any, ui: LensUi, agents: Record<string, LensAgent>, calls: Record<string, LensCall[]>, thinking: Record<string, string>, mainWindow: number) {
  const { Box, Text, Button } = t
  const id = ui.agent
  const a = id !== null ? agents[id] : undefined
  if (!a || id === null) return <Text dimColor>Press an avatar under the flowchart.</Text>
  const main = agents['main']
  const l = cardLines(a, main?.model ?? '', mainWindow)
  const list = calls[id] ?? []
  const th = thinking[id] ?? ''
  return (
    <Box flexDirection="column">
      <Text bold>{l.title}</Text>
      <Text>
        {l.role} - {a.status} - ctx {l.ctx}
      </Text>
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
      {list.slice(-40).map(c => (
        <Text>
          {c.status === 'running' ? '...' : c.status === 'error' ? 'ERR' : 'ok '} {c.tool} {c.summary}
          <Text dimColor>{c.stepCalls > 0 ? `  step out ${fmtTokens(c.stepOut)} / ${c.stepCalls} call${c.stepCalls > 1 ? 's' : ''} (est.)` : ''}</Text>
        </Text>
      ))}
      <Box flexDirection="row">
        <Button key="agent-thinking" label={ui.agentThinkingOpen ? '[-]' : '[+]'} onPress={() => update($, uiA, u => ({ ...u, agentThinkingOpen: !u.agentThinkingOpen }))} />
        <Text bold> Thinking ({th.length} chars)</Text>
      </Box>
      {ui.agentThinkingOpen && <Text dimColor>{th === '' ? '(no thinking chunks seen)' : th}</Text>}
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'spike027', description: 'ITEM-027 spike: open the lens card (round 1)' })
    await $.command.register({ name: 'spike027-kit', description: 'ITEM-027 spike: open the round-0 kit pane (checks 1-5)' })
    await $.command.register({ name: 'spike027-gate', description: 'ITEM-027 spike: gate alert on|off', argumentHint: 'on|off' })
    await $.command.register({
      name: 'spike027-probe',
      description: 'ITEM-027 spike: experiments E1-E8 (on|off|panes <n>|fs [path]|list|usage)',
      argumentHint: 'on|off|panes <n>|fs [path]|list|usage',
    })
    // Timer-driven blink (kit check 2, and the terminal's text avatars).
    $.clock.every(500, () => update($, tick, t => !t))
    cwd = e.cwd
    probeOn = (await read($, probeA)) as boolean
    probePath = (await $.fs.exists('spikes/ai-dlc-lens/027/CHECK.md')) ? 'spikes/ai-dlc-lens/027/PROBE-LOG.jsonl' : `${$.plugin.root}/PROBE-LOG.jsonl`
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
    const placed = await $.ui.open({ id: LENS, title: 'AI-DLC lens (spike 027)' })
    return { text: `Lens card opened (isPlaced: ${JSON.stringify(placed)}). Arrows and avatars are the Buttons under the flowchart.` }
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
      return { text: `E6: main window ${u.context.window}, tokens ${u.context.tokens ?? '?'}; subagent windows: no API, table used.` }
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
        keys: Object.keys(e),
        subagentType: e.subagentType,
        firstLine: (e.prompt.split(/\r?\n/, 1)[0] ?? '').slice(0, 300),
        match,
        result: { model: r?.model, agentId: r?.agentId, teammateId: r?.teammateId, deny: r?.deny },
      })
    if (id === undefined) return r
    const agents = (await read($, agentsA)) as Record<string, LensAgent>
    const again = agents[id] !== undefined || Object.values(agents).some(a => a.parent === parent && a.type === e.subagentType && a.status !== 'running')
    await ensureAgent($, id, parent, e.subagentType)
    await patchAgent($, id, a => ({
      ...a,
      parent,
      type: e.subagentType,
      name: e.name ?? a.name,
      description: e.description,
      model: String(r?.model ?? a.model),
      status: 'running',
      toolUseId: e.tool_use_id,
      handoff: match?.path ?? a.handoff,
      handoffHow: match?.how ?? a.handoffHow,
      loop: a.loop || again,
      endedAt: null,
    }))
    if (probeOn) await refreshList($, 'spawn')
    } catch (err) {
      lensFail('agent.spawn', err)
    }
    return r
  })

  on('turn.start', async ($, e, next) => {
    try {
      const key = e.agentId ?? 'main'
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
          const l = lead
          try {
            await update($, batchesA, m => addToBatch(m as Record<string, LensBatch>, l, key, c.id))
          } catch (err) {
            lensFail('turn.step batch', err)
          }
        }
      }
      else if (c.kind === 'stop' && c.usage) {
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
        return { ...m, [key]: joined.length > 4000 ? '...' + joined.slice(-4000) : joined }
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
    if (probeOn) await plog($, 'E2', { agent: key, index: e.index, counts, thinkingChars, observeMs: spent, afterMs: nowMs() - t1, usage })
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

  // ---- the lens card (L1-L6) ----
  on('ui.render', { component: 'Pane', requestId: LENS }, async ($, e) => {
    const t = $.ui.resolve(e) as any
    const { Box, Text, Button, Svg } = t
    const agents = (await read($, agentsA)) as Record<string, LensAgent>
    const order = (await read($, orderA)) as string[]
    const ui = (await read($, uiA)) as LensUi
    const thinking = (await read($, thinkingA)) as Record<string, string>
    const context = (await read($, contextA)) as LensCall[]
    const mainWindow = (await read($, mainWindowA)) as number
    const calls = (await read($, callsA)) as Record<string, LensCall[]>
    const mainModel = agents['main']?.model ?? ''
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
          {ui.drill === 'edge' ? edgeBody($, t, ui, (await read($, docA)) as LensDoc, agents) : agentBody($, t, ui, agents, calls, thinking, mainWindow)}
        </Box>
      )
    }

    const ids = order.filter(id => agents[id])
    const chart = flowchartSvg(ids, agents, mainModel, mainWindow)
    const on1 = hasSvg ? false : ((await read($, tick)) as boolean)
    const mainThinking = thinking['main'] ?? ''
    return (
      <Box flexDirection="column">
        <Text bold>Workflow</Text>
        {hasSvg ? (
          <Svg source={chart.source} alt={`Flowchart of ${ids.length} agents`} isInteractive={true} />
        ) : (
          ids.map(id => {
            const a = agents[id]!
            const running = a.status === 'running' || a.status === 'pending'
            const depth = a.parent === null ? 0 : a.parent === 'main' ? 1 : 2
            return (
              <Text>
                {'  '.repeat(depth)}
                {a.parent !== null ? (a.loop ? '<-> ' : '-> ') : ''}
                <Text color={running ? (on1 ? 'green' : 'gray') : a.status === 'failed' ? 'red' : 'green'}>{'●'}</Text> {displayName(a)}
              </Text>
            )
          })
        )}
        {agentButtons($, t, order, agents, false, null)}
        {ids.map(id => {
          const l = cardLines(agents[id]!, mainModel, mainWindow)
          return (
            <Box flexDirection="column" borderStyle="round">
              <Text bold>{l.title}</Text>
              <Text>{l.role}</Text>
              <Text>ctx {l.ctx}</Text>
              <Text>{l.io}</Text>
              <Text>{l.cache}</Text>
            </Box>
          )
        })}
        {modeRow}
        <Text bold>Orchestrator (main loop)</Text>
        <Box flexDirection="row">
          <Button key="lens-thinking" label={ui.thinkingOpen ? '[-]' : '[+]'} onPress={() => update($, uiA, u => ({ ...u, thinkingOpen: !u.thinkingOpen }))} />
          <Text> Thinking ({mainThinking.length} chars)</Text>
        </Box>
        {ui.thinkingOpen && <Text dimColor>{mainThinking === '' ? '(no thinking chunks seen yet)' : mainThinking}</Text>}
        <Box flexDirection="row">
          <Button key="lens-context" label={ui.contextOpen ? '[-]' : '[+]'} onPress={() => update($, uiA, u => ({ ...u, contextOpen: !u.contextOpen }))} />
          <Text> Gathered context ({context.length} calls)</Text>
        </Box>
        {ui.contextOpen &&
          context.map(c => (
            <Text dimColor>
              {c.status === 'running' ? '...' : c.status === 'error' ? 'ERR' : 'ok '} {c.tool} {c.summary}
            </Text>
          ))}
        <Text dimColor>uncached = input_tokens (derived); windows other than main's are assumed unless the model matches main's.</Text>
        {lensErrors.map(x => (
          <Text color="red">lens hook error: {x}</Text>
        ))}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: EDGE }, async ($, e) => {
    const t = $.ui.resolve(e) as any
    return edgeBody($, t, (await read($, uiA)) as LensUi, (await read($, docA)) as LensDoc, (await read($, agentsA)) as Record<string, LensAgent>)
  })

  on('ui.render', { component: 'Pane', requestId: AGENT }, async ($, e) => {
    const t = $.ui.resolve(e) as any
    return agentBody(
      $,
      t,
      (await read($, uiA)) as LensUi,
      (await read($, agentsA)) as Record<string, LensAgent>,
      (await read($, callsA)) as Record<string, LensCall[]>,
      (await read($, thinkingA)) as Record<string, string>,
      (await read($, mainWindowA)) as number,
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

  // ---- the chat card (round 2): the flowchart at the top of the first Agent row of a message ----
  // The native row is always last and unchanged (US-15, AC-15.5): the card wraps it, never replaces it.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const tool = String(e.props.tool)
    if (!CARD_TOOLS.has(tool)) return next(e)
    const native = await next(e)
    toolUseCards += 1
    const t = $.ui.resolve(e) as any
    const { Box, Text, Button, Svg } = t
    const id = e.props.tool_use_id
    const input = (e.props.input ?? {}) as Record<string, unknown>
    if (tool === 'SendMessage') {
      return (
        <Box flexDirection="column">
          <Text dimColor>lens: message to {String(input.to ?? '?')}; its arrow in the flowchart is two-way</Text>
          {native}
        </Box>
      )
    }
    const batches = (await read($, batchesA)) as Record<string, LensBatch>
    const agents = (await read($, agentsA)) as Record<string, LensAgent>
    const lead = leadOf(batches, id)
    const batch: LensBatch =
      lead !== null
        ? batches[lead]!
        : {
            parent: Object.values(agents).find(a => a.toolUseId === id)?.parent ?? 'main',
            ids: [id],
            pending: { [id]: { type: String(input.subagent_type ?? ''), description: String(input.description ?? ''), name: String(input.name ?? '') } },
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
    const mainWindow = (await read($, mainWindowA)) as number
    const open = (await read($, cardOpenA)) as Record<string, boolean>
    const mainModel = agents['main']?.model ?? ''
    const hasSvg = e.surface !== 'terminal'
    const on1 = hasSvg ? false : ((await read($, tick)) as boolean)
    const view = batchView(batch, agents, order)
    const root = view.agents[batch.parent]!
    const chart = flowchartSvg(view.ids, view.agents, mainModel, mainWindow)
    const n = batch.ids.length
    const th = thinking[batch.parent] ?? ''
    const ctx = batch.parent === 'main' ? mainContext : (calls[batch.parent] ?? []).filter(c => CONTEXT_TOOLS.has(c.tool))
    const thOpen = open[`${id}:thinking`] === true
    const ctxOpen = open[`${id}:context`] === true
    const toggle = (k: string) =>
      update($, cardOpenA, m => ({ ...(m as Record<string, boolean>), [`${id}:${k}`]: (m as Record<string, boolean>)[`${id}:${k}`] !== true }))
    return (
      <Box flexDirection="column" borderStyle="round">
        <Text bold>
          Workflow: {displayName(root)} spawned {n} agent{n > 1 ? 's in parallel' : ''}
        </Text>
        {hasSvg ? (
          <Svg source={chart.source} alt={`Flowchart: ${displayName(root)} spawned ${n} agent(s)`} isInteractive={true} />
        ) : (
          textChart(view.ids, view.agents, mainModel, mainWindow).map(row => {
            const a = view.agents[row.id]!
            const running = a.status === 'running' || a.status === 'pending'
            return (
              <Box flexDirection="column">
                <Text>
                  {row.head}
                  <Text color={running ? (on1 ? 'green' : 'gray') : a.status === 'failed' || a.status === 'killed' ? 'red' : 'green'}>{'●'}</Text> {row.lines[0]}
                </Text>
                {row.lines.slice(1).map(x => (
                  <Text dimColor>{x}</Text>
                ))}
              </Box>
            )
          })
        )}
        {agentButtons($, t, view.ids, agents, true, batch.parent)}
        <Box flexDirection="row">
          <Button key="card-thinking" label={thOpen ? '[-]' : '[+]'} onPress={() => toggle('thinking')} />
          <Text>
            {' '}
            {displayName(root)} thinking ({th.length} chars)
          </Text>
        </Box>
        {thOpen && <Text dimColor>{th === '' ? '(no thinking chunks seen yet)' : th}</Text>}
        <Box flexDirection="row">
          <Button key="card-context" label={ctxOpen ? '[-]' : '[+]'} onPress={() => toggle('context')} />
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
    if (await gateIsOn($ as any)) $.ui.toast('ai-dlc-lens spike: gate alert test (5b, module toast on classic.Stop)')
    return result
  }).catch(($, e, next) => next(e))
}
