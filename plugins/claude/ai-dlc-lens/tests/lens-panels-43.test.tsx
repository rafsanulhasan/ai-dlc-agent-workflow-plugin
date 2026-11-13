import { describe, expect, test } from 'claude-code/testing'
import { MESSAGES_KEPT, STOP_NOTE, addMessage, handoffLine, messageTarget, messageText, messagesOfEdge } from '../hooks/lens'
import type { LensMessage } from '../hooks/lens'

// Step 43, live findings round 2 (43-live-findings-2.md; the human's decisions of 2026-10-26; build 43.2.5): the
// Connections panel (an arrow's), the Agents panel (an avatar's) and the SendMessage rows in the chat. The engine is
// stubbed at its edges, as in tests/lens-view-43.test.tsx. Each test is tagged with the finding's number: [F2.1] to
// [F2.4] are the Connections panel's points 1 to 4, [F2.5] the Agents panel's Stop, [F2.V] and [F2.R] its View
// transcript and Refresh, [F2.L] the pure helpers.

const PLUGIN = 'ai-dlc-lens'
const CHART = 'ai-dlc-lens-chart'
const AGENT = 'ai-dlc-lens-agent'
const EDGE = 'ai-dlc-lens-edge'
const DIVIDER = '─'.repeat(40)

const ROSTER = ['| Agent | Name |', '|---|---|', '| orchestrator | Scott Hanselman |', '| agent-manager | Boris Cherny |'].join('\n')
const def = (model: string, persona: string) => `---\nname: x\nmodel: ${model}\n---\n\nPersona name: **${persona}** — a nod.\n`
const RECORD = 'docs/handoffs/R/17-orchestrator-to-agent-manager.handoff.md'
const BACK = 'docs/handoffs/R/17-agent-manager-to-orchestrator.handback.md'
const BRIEF = `Your handoff record is ${RECORD} (root x).\nDo it.`
const BASE_FILES: Record<string, string> = {
  '.claude/agent-memory/ai-dlc-orchestrator/project_team-roster.md': ROSTER,
  'plugins/claude/ai-dlc/agents/orchestrator.md': def('opus', 'Scott Hanselman'),
  'plugins/claude/ai-dlc/agents/agent-manager.md': def('sonnet', 'Boris Cherny'),
  [RECORD]: 'HANDOFF BODY',
}
const RUN_R =
  '---\nrun: R\nstatus: active\ncurrent-stage: build\n---\n\n# Run: R — the lens spike\n\n## Stages\n| Step | Stage | Agent | Status | Record |\n|---|---|---|---|---|\n| 16 | research | research-assistant | done (passed) | x |\n| 17 | build | agent-manager | in-progress | `17-orchestrator-to-agent-manager.handoff.md` |\n'
const hb = (verification: string, body: string) => `---\nrun: R\nverification: ${verification}\n---\n\n${body}\n`

type Opts = {
  files?: Record<string, string>
  /** The hand-back record is listed in the run folder (default: no). */
  listBack?: boolean
  /** What `$.ui.view` answers (default: nothing, which is shown). */
  view?: { deny?: string } | undefined
  /**
   * No `turn.abort` stub at all: the engine's own `$.turn.abort` answers, and it rejects because the test's turn is not
   * a running one (a handler that throws is only skipped by the engine, not turned into a rejection).
   */
  abortRejects?: boolean
}

/** Scott Hanselman (main) spawns agent-manager `a1` in the background, in run R step 17; a1 keeps running. */
async function engine($: any, on: any, o: Opts = {}) {
  const files: Record<string, string> = { ...BASE_FILES, ...(o.files ?? {}), '.ai-dlc/lens.json': JSON.stringify({ panelOpenMode: 'tab', recordChars: 200 }) }
  const opened: string[] = []
  const calls = { views: [] as unknown[], aborts: [] as unknown[], lists: 0 }
  const openNow = new Set<string>()
  on('session.surfaces', () => ({ value: ['terminal'] }))
  on('ui.render', ($s: any, e: any) => {
    const { Text } = $s.ui.resolve(e)
    return <Text>NATIVE ROW</Text>
  })
  on('clock.every', () => ({ value: undefined }))
  on('clock.after', () => new Promise(() => {}) as never)
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('session.end', (_: unknown, e: any) => ({ sessionId: e.sessionId }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 10 }, rateLimits: [] } }))
  on('settings.read', () => ({ value: { agent: 'ai-dlc:orchestrator' } }))
  on('fs.exists', () => ({ value: false }))
  on('fs.stat', (_: unknown, e: any) => {
    throw new Error(`ENOENT ${String(e.path ?? e)}`)
  })
  on('fs.read', (_: unknown, e: any) => {
    const path = String(e.path ?? e).replace(/\\/g, '/')
    const hit = Object.keys(files).find(k => path === k || path.endsWith('/' + k))
    if (hit === undefined) throw new Error(`ENOENT ${path}`)
    return { value: files[hit] }
  })
  on('fs.write', () => ({ value: undefined }))
  let listed = 1
  on('fs.list', () => {
    listed += 1
    const names = ['17-orchestrator-to-agent-manager.handoff.md', ...(o.listBack === true ? ['17-agent-manager-to-orchestrator.handback.md'] : [])]
    return { value: names.map(name => ({ name, kind: 'file', size: 1, mtimeMs: listed })) }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('agent.list', () => {
    calls.lists += 1
    return { value: [{ id: 'a1', description: 'build', type: 'ai-dlc:agent-manager', status: 'running' }] }
  })
  on('ui.open', (_: unknown, e: any) => {
    opened.push(e.id)
    openNow.add(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_: unknown, e: any) => {
    openNow.delete(e.id)
    return { value: undefined }
  })
  on('ui.panes', () => ({ value: [...openNow].map(id => ({ id, title: id, isShown: true, isFocused: false, isPlaced: true })) }))
  on('ui.view', (_: unknown, e: any) => {
    calls.views.push(e)
    return { value: o.view }
  })
  if (o.abortRejects !== true)
    on('turn.abort', (_: unknown, e: any) => {
      calls.aborts.push(e)
      return { value: undefined }
    })
  on('agent.spawn', (_: unknown, e: any) => ({ model: 'claude-sonnet-5-5', agentId: 'a' + (/^toolu_(\d+)$/.exec(String(e.tool_use_id))?.[1] ?? '1') }))
  on('turn.start', (_: unknown, e: any) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: {} }))
  on('turn.complete', (_: unknown, e: any) => ({ text: e.answer }))
  on('classic.SubagentStop', () => ({}))
  on('classic.Stop', () => ({}))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'request 1', turnId: 'm1' })
  await $.tool.call({ tool: 'Agent', subagent_type: 'ai-dlc:agent-manager', description: 'd1', prompt: BRIEF, tool_use_id: 'toolu_1' })
  await $.agent.spawn({ tool_use_id: 'toolu_1', prompt: BRIEF, description: 'd1', subagentType: 'ai-dlc:agent-manager', provider: { plugin: 'ai-dlc', tier: 'user' }, parentModel: 'claude-opus-5-5', background: true, fork: false })
  return { opened, calls, files }
}

const pane = ($: any, id: string) =>
  $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: id, props: { title: id, isFocused: false, bodyColumns: 120, placement: 'dock', scroll: { offset: 0, bodyRows: 200 }, view: {} } } as any)
/** The workflow pane, opened on the run's chart: its avatar and arrow Buttons are pressed from here. */
const workflow = async ($: any) => {
  const ui = await pane($, CHART)
  if (await ui.find({ type: 'Button', key: 'wf-toolu_1' })) await ui.press({ key: 'wf-toolu_1' })
  return ui
}
const agentsPanel = async ($: any) => {
  const wp = await workflow($)
  await wp.press({ key: 'agent-a1' })
  await wp.unmount()
  return pane($, AGENT)
}
/** The orchestrator's (main) Agents panel: its avatar is on the chat card of the spawn call. */
const mainPanel = async ($: any) => {
  const card = await $.ui.mount(toolRow('toolu_1', 'Agent', { subagent_type: 'ai-dlc:agent-manager', description: 'd1', prompt: BRIEF }))
  await card.press({ key: 'card:agent-main' })
  await card.unmount()
  return pane($, AGENT)
}
const connectionsPanel = async ($: any) => {
  const wp = await workflow($)
  await wp.press({ key: 'edge-a1' })
  await wp.unmount()
  return pane($, EDGE)
}
const props = (x: any) => x?.props ?? x
const textOf = (x: any) => String(x?.text ?? x?.props?.text ?? '')
const texts = async (ui: any): Promise<string[]> => ((await ui.findAll({ type: 'Text' })) as any[]).map(textOf)
const headings = async (ui: any): Promise<string[]> => (await texts(ui)).map(t => t.trim())
const keysOf = async (ui: any): Promise<string[]> => ((await ui.findAll({ type: 'Button' })) as any[]).map((b: any) => String(b.key))
const wait = (ms: number) => new Promise(r => (globalThis as any).setTimeout(r, ms))
const toolRow = (id: string, tool: string, input: Record<string, unknown>, flags: { isExpanded?: boolean; isErrored?: boolean } = {}) =>
  ({
    plugin: PLUGIN,
    surface: 'vscode',
    component: 'ToolUse',
    requestId: id,
    props: { tool_use_id: id, tool, input, isRunning: false, isErrored: flags.isErrored ?? false, isInterrupted: false, ...(flags.isExpanded !== undefined ? { isExpanded: flags.isExpanded } : {}) },
  }) as any
const toolResult = (id: string, tool: string, flags: { isExpanded?: boolean; isErrored?: boolean } = {}) =>
  ({
    plugin: PLUGIN,
    surface: 'vscode',
    component: 'ToolResult',
    requestId: id,
    props: { tool_use_id: id, tool, output: {}, isErrored: flags.isErrored ?? false, ...(flags.isExpanded !== undefined ? { isExpanded: flags.isExpanded } : {}) },
  }) as any
const send = ($: any, id: string, to: string, message: unknown, agentId?: string) =>
  $.tool.call({ tool: 'SendMessage', to, message, tool_use_id: id, ...(agentId !== undefined ? { agentId } : {}) })
const msg = (id: string, from: string, to: string, text = id, at = 1): LensMessage => ({ id, from, to, toRaw: to, text, at })

// ---------------------------------------------------------------------------------------------------------------
// The pure helpers
// ---------------------------------------------------------------------------------------------------------------
describe('step 43 live findings 2: the message list and the Hand-off line (pure)', () => {
  test('[F2.4/L] addMessage keeps the last 200 messages, the newest last, one per call id', () => {
    expect(MESSAGES_KEPT).toBe(200)
    let list: LensMessage[] = []
    for (let i = 0; i < 205; i++) list = addMessage(list, msg(`m${i}`, 'main', 'a1'))
    expect(list.length).toBe(200)
    expect(list[0]!.id).toBe('m5')
    expect(list.at(-1)!.id).toBe('m204')
    // The same call id again replaces the earlier entry and moves to the end; the count does not grow.
    const again = addMessage(list, msg('m100', 'main', 'a1', 'second sight'))
    expect(again.length).toBe(200)
    expect(again.filter(m => m.id === 'm100').map(m => m.text)).toEqual(['second sight'])
    expect(again.at(-1)!.id).toBe('m100')
    // Exactly 200 stay 200 when the 201st arrives.
    expect(addMessage(addMessage([], msg('x', 'main', 'a1')), msg('y', 'main', 'a1')).map(m => m.id)).toEqual(['x', 'y'])
  })

  test('[F2.4/L] addMessage does not change the list it was given', () => {
    const list = [msg('a', 'main', 'a1')]
    addMessage(list, msg('b', 'main', 'a1'))
    expect(list.map(m => m.id)).toEqual(['a'])
  })

  test('[F2.4/L] messagesOfEdge: parent to child and child to parent, oldest first; no other pair', () => {
    const list = [msg('1', 'main', 'a1'), msg('2', 'a1', 'main'), msg('3', 'main', 'a2'), msg('4', 'a2', 'a1'), msg('5', 'a1', 'a3'), msg('6', 'main', 'a1')]
    expect(messagesOfEdge(list, 'main', 'a1').map(m => m.id)).toEqual(['1', '2', '6'])
    // The connection is the same whichever end is called the parent.
    expect(messagesOfEdge(list, 'a1', 'main').map(m => m.id)).toEqual(['1', '2', '6'])
    expect(messagesOfEdge(list, 'a1', 'a2').map(m => m.id)).toEqual(['4'])
    expect(messagesOfEdge(list, 'a2', 'a3')).toEqual([])
    expect(messagesOfEdge([], 'main', 'a1')).toEqual([])
  })

  test('[F2.3/L] handoffLine: sizes in characters with thousands separators; "—" while a size is unknown', () => {
    expect(handoffLine(120, 4500)).toBe('Hand-off: brief 120 chars · hand-back 4,500 chars')
    expect(handoffLine(1234567, 0)).toBe('Hand-off: brief 1,234,567 chars · hand-back 0 chars')
    expect(handoffLine(999, 1000)).toBe('Hand-off: brief 999 chars · hand-back 1,000 chars')
    expect(handoffLine(null, 7)).toBe('Hand-off: brief — · hand-back 7 chars')
    expect(handoffLine(7, null)).toBe('Hand-off: brief 7 chars · hand-back —')
    expect(handoffLine(null, null)).toBe('Hand-off: brief — · hand-back —')
  })

  test('[F2.4/L] messageText: a text as written, a structured message as JSON, nothing as the empty string', () => {
    expect(messageText({ message: 'hello' })).toBe('hello')
    expect(messageText({ message: { type: 'shutdown_request', reason: 'done' } })).toBe('{"type":"shutdown_request","reason":"done"}')
    expect(messageText({})).toBe('')
    expect(messageText({ message: null })).toBe('')
    expect(messageText({ message: 42 })).toBe('42')
  })
})

// ---------------------------------------------------------------------------------------------------------------
// F2.4: SendMessage rows are hidden from the chat
// ---------------------------------------------------------------------------------------------------------------
describe('step 43 live findings 2, point 4: SendMessage in the chat', () => {
  test('[F2.4] a SendMessage row draws nothing: no lens line, no native row', async ($, on) => {
    await engine($, on)
    const ui = await $.ui.mount(toolRow('toolu_s1', 'SendMessage', { to: 'a1', message: 'again' }))
    expect(await texts(ui)).toEqual([])
    await ui.unmount()
  })

  test('[F2.4] expanded (ctrl+o, --verbose) the row is drawn: the lens line and the native row last', async ($, on) => {
    await engine($, on)
    const ui = await $.ui.mount(toolRow('toolu_s1', 'SendMessage', { to: 'a1', message: 'again' }, { isExpanded: true }))
    const all = await texts(ui)
    expect(all).toContain('lens: message to a1; its arrow in the flowchart is two-way')
    expect(all.at(-1)).toBe('NATIVE ROW')
    await ui.unmount()
  })

  test('[F2.4] isExpanded false hides it like an absent flag', async ($, on) => {
    await engine($, on)
    const ui = await $.ui.mount(toolRow('toolu_s1', 'SendMessage', { to: 'a1', message: 'again' }, { isExpanded: false }))
    expect(await texts(ui)).toEqual([])
    await ui.unmount()
  })

  test('[F2.4 negative] a SendMessage that failed stays drawn (the person must see that it failed)', async ($, on) => {
    await engine($, on)
    const ui = await $.ui.mount(toolRow('toolu_s1', 'SendMessage', { to: 'a1', message: 'again' }, { isErrored: true }))
    expect(await texts(ui)).toContain('NATIVE ROW')
    await ui.unmount()
  })

  test('[F2.4 negative] the other card tools are not hidden: an Agent row is still drawn, the native row last', async ($, on) => {
    await engine($, on)
    const ui = await $.ui.mount(toolRow('toolu_1', 'Agent', { subagent_type: 'ai-dlc:agent-manager', description: 'd1', prompt: BRIEF }))
    const all = await texts(ui)
    expect(all.length).toBeGreaterThan(1)
    expect(all.at(-1)).toBe('NATIVE ROW')
    await ui.unmount()
  })

  test('[F2.4] its result block is hidden with it, and drawn when expanded', async ($, on) => {
    await engine($, on)
    const hidden = await $.ui.mount(toolResult('toolu_s1', 'SendMessage'))
    expect(await texts(hidden)).toEqual([])
    await hidden.unmount()
    const full = await $.ui.mount(toolResult('toolu_s1', 'SendMessage', { isExpanded: true }))
    expect(await texts(full)).toEqual(['NATIVE ROW'])
    await full.unmount()
  })

  test('[F2.4 negative] the result of a failed SendMessage keeps its error text; another tool\'s result is never hidden', async ($, on) => {
    await engine($, on)
    const failed = await $.ui.mount(toolResult('toolu_s1', 'SendMessage', { isErrored: true }))
    expect(await texts(failed)).toEqual(['NATIVE ROW'])
    await failed.unmount()
    for (const tool of ['Agent', 'Read']) {
      const other = await $.ui.mount(toolResult('toolu_9', tool))
      expect(await texts(other)).toEqual(['NATIVE ROW'])
      await other.unmount()
    }
  })

  test('[F2.4] hiding the row does not stop the message from being recorded: the call still lists in the Connections panel', async ($, on) => {
    await engine($, on)
    await send($, 'toolu_s1', 'a1', 'kept although the row is hidden')
    const ui = await $.ui.mount(toolRow('toolu_s1', 'SendMessage', { to: 'a1', message: 'kept although the row is hidden' }))
    expect(await texts(ui)).toEqual([])
    await ui.unmount()
    const edge = await connectionsPanel($)
    expect(await headings(edge)).toContain('Send Message (1)')
    await edge.unmount()
  })
})

// ---------------------------------------------------------------------------------------------------------------
// The Connections panel
// ---------------------------------------------------------------------------------------------------------------
describe('step 43 live findings 2: the Connections panel', () => {
  test('[F2.1/F2.3] no anomaly: header; one separator; the Hand-off line; then the sections; no Usage, no Context Lab, no Cache Lab', async ($, on) => {
    await engine($, on)
    const ui = await connectionsPanel($)
    const all = ((await ui.findAll({})) as any[]).map(x => `${x.type}:${x.key ?? ''}:${textOf(x)}`)
    const head = all.findIndex(x => /Scott Hanselman -> Boris Cherny/.test(x))
    const line = all.findIndex(x => x.startsWith('Text::Hand-off: brief '))
    expect(head).toBeGreaterThan(-1)
    expect(line).toBeGreaterThan(head)
    expect(all.slice(head, line).filter(x => x === `Text::${DIVIDER}`).length).toBe(1)
    expect(all[line - 1]).toBe(`Text::${DIVIDER}`)
    expect(await ui.find({ type: 'Button', key: 'edge-anomalies' })).toBe(undefined)
    const keys = await keysOf(ui)
    expect(keys.filter(k => /^edge-/.test(k))).toEqual(['edge-doc', 'edge-back', 'edge-messages', 'edge-stop'])
    const h = await headings(ui)
    expect(h.some(t => /^Usage\b/.test(t))).toBe(false)
    expect(h.some(t => /Context Lab/.test(t))).toBe(false)
    expect(h.some(t => /Cache Lab/.test(t))).toBe(false)
    expect(keys).not.toContain('edge-usage')
    expect(keys).not.toContain('cachelab-open')
    await ui.unmount()
  })

  test('[F2.1/F2.2] with an anomaly: header; separator; Anomalies; separator; the Hand-off line; Hand-off, Hand-back and Send Message follow', async ($, on) => {
    const { files } = await engine($, on, { listBack: true, files: { 'docs/handoffs/R/run.md': RUN_R, [BACK]: hb('failed', 'handoff 17-orchestrator-to-agent-manager.handoff.md: failed — no AC list') } })
    expect(Object.keys(files)).toContain(BACK)
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
    const ui = await connectionsPanel($)
    const all = ((await ui.findAll({})) as any[]).map(x => `${x.type}:${x.key ?? ''}:${textOf(x)}`)
    const at = (pred: (x: string) => boolean, from = 0) => {
      const i = all.findIndex((x, n) => n >= from && pred(x))
      expect(i).toBeGreaterThan(-1)
      return i
    }
    const head = at(x => /Scott Hanselman -> Boris Cherny/.test(x))
    const sep1 = at(x => x === `Text::${DIVIDER}`, head)
    const anomalies = at(x => x.startsWith('Button:edge-anomalies:'), sep1)
    const sep2 = at(x => x === `Text::${DIVIDER}`, anomalies)
    const line = at(x => x.startsWith('Text::Hand-off: brief '), sep2)
    const doc = at(x => x.startsWith('Button:edge-doc:'), line)
    const back = at(x => x.startsWith('Button:edge-back:'), doc)
    const messages = at(x => x.startsWith('Button:edge-messages:'), back)
    const stopBtn = at(x => x.startsWith('Button:edge-stop:'), messages)
    expect([sep1 < anomalies, anomalies < sep2, sep2 < line, line < doc, doc < back, back < messages, messages < stopBtn]).toEqual([true, true, true, true, true, true, true])
    // Nothing but the connection's own anomaly rows sits between the Anomalies button and the second separator; the line comes right after it.
    expect(sep2).toBeGreaterThan(anomalies)
    expect(line).toBe(sep2 + 1)
    expect(textOf(await ui.find({ type: 'Button', key: 'edge-anomalies' }))).toBe('[+]')
    expect(await headings(ui)).toContain('Anomalies (1)')
    await ui.unmount()
  })

  test('[F2.1] the Anomalies section opens on its button and lists the failed hand-back; it is absent when the check passes', async ($, on) => {
    await engine($, on, { listBack: true, files: { 'docs/handoffs/R/run.md': RUN_R, [BACK]: hb('failed', 'handoff 17-orchestrator-to-agent-manager.handoff.md: failed — no AC list') } })
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
    const ui = await connectionsPanel($)
    await ui.press({ key: 'edge-anomalies' })
    expect(textOf(await ui.find({ type: 'Button', key: 'edge-anomalies' }))).toBe('[-]')
    expect((await headings(ui)).some(t => /Hand-back failed its check/.test(t))).toBe(true)
    await ui.unmount()
  })

  test('[F2.1 negative] a passing hand-back leaves the panel without an Anomalies section', async ($, on) => {
    await engine($, on, { listBack: true, files: { 'docs/handoffs/R/run.md': RUN_R, [BACK]: hb('passed', 'handoff 17-orchestrator-to-agent-manager.handoff.md: passed — ok') } })
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
    const ui = await connectionsPanel($)
    expect(await ui.find({ type: 'Button', key: 'edge-anomalies' })).toBe(undefined)
    expect((await headings(ui)).some(t => /^Anomalies/.test(t))).toBe(false)
    await ui.unmount()
  })

  test('[F2.3] the Hand-off line: brief = the prompt\'s length; hand-back = the stored record\'s full length, though the shown text is capped', async ($, on) => {
    const body = hb('passed', 'handoff 17-orchestrator-to-agent-manager.handoff.md: passed — ok\n' + 'x'.repeat(4800))
    await engine($, on, { listBack: true, files: { [BACK]: body } })
    const ui = await connectionsPanel($)
    const line = (await headings(ui)).find(t => t.startsWith('Hand-off: brief '))
    expect(line).toBe(`Hand-off: brief ${BRIEF.length} chars · hand-back ${body.length.toLocaleString('en-US')} chars`)
    // recordChars is 200 in this engine: the text shown is far shorter than the size said.
    await ui.press({ key: 'edge-back' })
    const shown = (await texts(ui)).find(t => t.startsWith('---') || t.includes('verification: passed'))
    expect(shown).toBeDefined()
    expect(shown!.length).toBeLessThan(1000)
    expect(body.length).toBeGreaterThan(4800)
    await ui.unmount()
  })

  test('[F2.3] no hand-back record and no output yet: the hand-back size is "—"', async ($, on) => {
    await engine($, on)
    const ui = await connectionsPanel($)
    expect((await headings(ui)).find(t => t.startsWith('Hand-off: brief '))).toBe(`Hand-off: brief ${BRIEF.length} chars · hand-back —`)
    expect(await headings(ui)).toContain('Hand-back (—)')
    await ui.unmount()
  })

  test('[F2.4] the Send Message accordion is collapsed; opened it lists sender, receiver, text and time of each message, oldest first', async ($, on) => {
    await engine($, on)
    await send($, 'toolu_s1', 'a1', 'please look at the AC list')
    await send($, 'toolu_s2', 'a1', 'a second note')
    const ui = await connectionsPanel($)
    expect(textOf(await ui.find({ type: 'Button', key: 'edge-messages' }))).toBe('[+]')
    expect(await headings(ui)).toContain('Send Message (2)')
    expect(await headings(ui)).not.toContain('please look at the AC list')
    await ui.press({ key: 'edge-messages' })
    expect(textOf(await ui.find({ type: 'Button', key: 'edge-messages' }))).toBe('[-]')
    const all = await headings(ui)
    const first = all.findIndex(t => /^\d{2}:\d{2}:\d{2} Scott Hanselman -> Boris Cherny$/.test(t))
    expect(first).toBeGreaterThan(-1)
    expect(all[first + 1]).toBe('please look at the AC list')
    const second = all.findIndex((t, n) => n > first + 1 && /^\d{2}:\d{2}:\d{2} Scott Hanselman -> Boris Cherny$/.test(t))
    expect(all[second + 1]).toBe('a second note')
    await ui.unmount()
  })

  test('[F2.4] a message from the agent back to its sender is on the same connection; a structured message is shown as JSON', async ($, on) => {
    await engine($, on)
    await send($, 'toolu_s1', 'a1', 'down')
    await send($, 'toolu_s2', 'a1', { type: 'shutdown_request' })
    await send($, 'toolu_s3', 'main', 'up', 'a1')
    const ui = await connectionsPanel($)
    await ui.press({ key: 'edge-messages' })
    const all = await headings(ui)
    expect(all).toContain('{"type":"shutdown_request"}')
    expect(all).toContain('down')
    // The reply to 'main' (the raw name the model wrote) is on the connection too: a1 is main's child.
    expect(all).toContain('up')
    expect(all.some(t => /^\d{2}:\d{2}:\d{2} Boris Cherny -> /.test(t))).toBe(true)
    expect(all).toContain('Send Message (3)')
    await ui.unmount()
  })

  test('[F2.4 negative] a message to a name no agent has is on no connection (the receiver stays unmatched)', async ($, on) => {
    await engine($, on)
    await send($, 'toolu_s1', 'nobody-at-all', 'nobody here')
    const ui = await connectionsPanel($)
    expect(await headings(ui)).toContain('Send Message (0)')
    await ui.press({ key: 'edge-messages' })
    expect(await headings(ui)).toContain('no SendMessage between these two agents yet')
    expect(await headings(ui)).not.toContain('nobody here')
    await ui.unmount()
  })

  test('[F2.4] a message arriving while the panel is open redraws it', async ($, on) => {
    await engine($, on)
    const ui = await connectionsPanel($)
    expect(await headings(ui)).toContain('Send Message (0)')
    await send($, 'toolu_s1', 'a1', 'late')
    await wait(20)
    expect(await headings(ui)).toContain('Send Message (1)')
    await ui.unmount()
  })
})

// ---------------------------------------------------------------------------------------------------------------
// The Agents panel
// ---------------------------------------------------------------------------------------------------------------
describe('step 43 live findings 2, point 5: the Agents panel bottom row', () => {
  test('[F2.5] the bottom row: View transcript, Refresh, Stop, in that order, centred with space between; Stop is red with white text', async ($, on) => {
    await engine($, on)
    const ui = await mainPanel($)
    const keys = await keysOf(ui)
    expect(keys.slice(-3)).toEqual(['agent-view', 'agent-refresh', 'agent-stop'])
    const labels = await Promise.all(['agent-view', 'agent-refresh', 'agent-stop'].map(async k => textOf(await ui.find({ type: 'Button', key: k }))))
    expect(labels[0]).toBe('View transcript')
    expect(labels[1]).toBe('Refresh')
    // The Stop button holds a Text child drawn in its place: white on red.
    const stopText: any = ((await ui.findAll({ type: 'Text' })) as any[]).find(x => textOf(x).trim() === 'Stop')
    expect(stopText).toBeDefined()
    expect(props(stopText).backgroundColor).toBe('red')
    expect(props(stopText).color).toBe('white')
    // The row centres its buttons with a gap between them.
    const row: any = ((await ui.findAll({ type: 'Box' })) as any[]).find(b => props(b).justifyContent === 'center' && props(b).flexDirection === 'row' && Number(props(b).columnGap) === 2)
    expect(row).toBeDefined()
    await ui.unmount()
  })

  test('[F2.5] below the buttons: the dim note on what Stop does, and that one agent cannot be stopped alone', async ($, on) => {
    await engine($, on)
    const ui = await mainPanel($)
    const all = (await ui.findAll({})) as any[]
    const stop = all.findIndex(x => x.type === 'Button' && x.key === 'agent-stop')
    const note = all.findIndex(x => x.type === 'Text' && textOf(x) === STOP_NOTE)
    expect(stop).toBeGreaterThan(-1)
    expect(note).toBeGreaterThan(stop)
    expect(props(all[note]).dimColor).toBe(true)
    expect(STOP_NOTE).toMatch(/interrupts the current turn, as Esc does/)
    expect(STOP_NOTE).toMatch(/A single agent cannot be stopped on its own/)
    await ui.unmount()
  })

  test('[F2.5] Stop with a turn running: $.turn.abort gets the main loop\'s turn id; the note says it was interrupted', async ($, on) => {
    const { calls } = await engine($, on)
    const ui = await mainPanel($)
    await ui.press({ key: 'agent-stop' })
    expect(calls.aborts).toEqual([{ turnId: 'm1' }])
    expect((await headings(ui)).some(t => /^Stop: the current turn was interrupted at \d{2}:\d{2}:\d{2}\.$/.test(t))).toBe(true)
    await ui.unmount()
  })

  test('[F2.5] Stop aborts the main turn, never the pressed agent\'s own turn id', async ($, on) => {
    const { calls } = await engine($, on)
    await $.turn.start({ text: 'p', turnId: 'sub1', agentId: 'a1' })
    const ui = await mainPanel($)
    await ui.press({ key: 'agent-stop' })
    expect(calls.aborts).toEqual([{ turnId: 'm1' }])
    await ui.unmount()
  })

  test('[F2.5] Stop with no turn running (the main turn completed): nothing is aborted and the note says so', async ($, on) => {
    const { calls } = await engine($, on)
    await $.turn.complete({ reason: 'answer', answer: 'ok', durationMs: 1, isAborted: false, turnId: 'm1', usage: null } as any)
    const ui = await mainPanel($)
    await ui.press({ key: 'agent-stop' })
    expect(calls.aborts).toEqual([])
    expect(await headings(ui)).toContain('Stop: no turn is running.')
    await ui.unmount()
  })

  test('[F2.5] Stop while a new main turn runs after an earlier one: the newest turn id is aborted', async ($, on) => {
    const { calls } = await engine($, on)
    await $.turn.complete({ reason: 'answer', answer: 'ok', durationMs: 1, isAborted: false, turnId: 'm1', usage: null } as any)
    await $.turn.start({ text: 'request 2', turnId: 'm2' })
    const ui = await mainPanel($)
    await ui.press({ key: 'agent-stop' })
    expect(calls.aborts).toEqual([{ turnId: 'm2' }])
    await ui.unmount()
  })

  test('[F2.5] a subagent\'s turn completing does not clear the main turn: Stop still aborts it', async ($, on) => {
    const { calls } = await engine($, on)
    await $.turn.complete({ reason: 'answer', answer: 'done', durationMs: 1, isAborted: false, turnId: 'sub1', agentId: 'a1', usage: null } as any)
    const ui = await mainPanel($)
    await ui.press({ key: 'agent-stop' })
    expect(calls.aborts).toEqual([{ turnId: 'm1' }])
    await ui.unmount()
  })

  test('[F2.5] when $.turn.abort rejects, the note says it did not stop and gives the reason; the panel still draws', async ($, on) => {
    await engine($, on, { abortRejects: true })
    const ui = await mainPanel($)
    await ui.press({ key: 'agent-stop' })
    const note = (await headings(ui)).find(t => t.startsWith('Stop: '))
    expect(note).toMatch(/^Stop: not stopped\. \S/)
    expect(note).not.toMatch(/interrupted/)
    expect(await ui.find({ type: 'Button', key: 'agent-stop' })).toBeDefined()
    await ui.unmount()
  })

  test('[F2.V] View transcript on an agent: $.ui.view gets its id and the note says the transcript is in view', async ($, on) => {
    const { calls } = await engine($, on, { view: {} })
    const ui = await agentsPanel($)
    await ui.press({ key: 'agent-view' })
    expect(calls.views).toEqual([{ agentId: 'a1' }])
    expect((await headings(ui)).some(t => /^View transcript: .*'s transcript is in view\./.test(t))).toBe(true)
    await ui.unmount()
  })

  test('[F2.V] a refused view (a finished agent the host no longer lists): the deny reason is shown under the buttons, not dropped', async ($, on) => {
    const { calls } = await engine($, on, { view: { deny: 'no agent a1 is shown in the tasks list' } })
    const ui = await agentsPanel($)
    await ui.press({ key: 'agent-view' })
    expect(calls.views).toEqual([{ agentId: 'a1' }])
    const h = await headings(ui)
    expect(h).toContain('View transcript: not shown. no agent a1 is shown in the tasks list')
    expect(h.some(t => /transcript is in view/.test(t))).toBe(false)
    await ui.unmount()
  })

  test('[F2.V] the note sits between the buttons and the Stop note', async ($, on) => {
    await engine($, on, { view: { deny: 'refused' } })
    const ui = await mainPanel($)
    await ui.press({ key: 'agent-view' })
    const all = (await ui.findAll({})) as any[]
    const stop = all.findIndex(x => x.type === 'Button' && x.key === 'agent-stop')
    const note = all.findIndex(x => x.type === 'Text' && textOf(x) === 'View transcript: not shown. refused')
    const stopNote = all.findIndex(x => x.type === 'Text' && textOf(x) === STOP_NOTE)
    expect(stop).toBeLessThan(note)
    expect(note).toBeLessThan(stopNote)
    await ui.unmount()
  })

  test('[F2.V] a later press replaces the earlier note', async ($, on) => {
    const { calls } = await engine($, on, { view: { deny: 'first answer' } })
    const ui = await mainPanel($)
    await ui.press({ key: 'agent-view' })
    expect(await headings(ui)).toContain('View transcript: not shown. first answer')
    await ui.press({ key: 'agent-stop' })
    expect(await headings(ui)).not.toContain('View transcript: not shown. first answer')
    expect(calls.views.length).toBe(1)
    await ui.unmount()
  })

  test('[F2.R] Refresh re-reads the agent list and says when it did and what it re-read', async ($, on) => {
    const { calls } = await engine($, on)
    const ui = await agentsPanel($)
    const before = calls.lists
    await ui.press({ key: 'agent-refresh' })
    expect(calls.lists).toBeGreaterThan(before)
    expect((await headings(ui)).some(t => /^Refreshed at \d{2}:\d{2}:\d{2}: agent statuses and background tasks, run states, anomalies\.$/.test(t))).toBe(true)
    await ui.unmount()
  })

  test('[F2.R] Refresh re-reads the run states and the anomalies: a hand-back that failed since the last look is marked', async ($, on) => {
    const { files } = await engine($, on, { listBack: true, files: { 'docs/handoffs/R/run.md': RUN_R, [BACK]: hb('passed', 'handoff 17-orchestrator-to-agent-manager.handoff.md: passed — ok') } })
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
    const ui = await agentsPanel($)
    expect((await headings(ui)).some(t => /^Anomalies/.test(t))).toBe(false)
    files[BACK] = hb('failed', 'handoff 17-orchestrator-to-agent-manager.handoff.md: failed — no AC list')
    await ui.press({ key: 'agent-refresh' })
    expect((await headings(ui)).some(t => /^Refreshed at /.test(t))).toBe(true)
    const wp = await workflow($)
    const mark = ((await wp.findAll({ type: 'Text' })) as any[]).some(x => /^▲/.test(textOf(x)))
    const edge = textOf(await wp.find({ type: 'Button', key: 'edge-a1' }))
    expect(mark || /^▲/.test(edge)).toBe(true)
    await wp.unmount()
    await ui.unmount()
  })

  test('[F2.R] Refresh does not reach Cache Lab while it is closed', async ($, on) => {
    await engine($, on)
    const ui = await agentsPanel($)
    await ui.press({ key: 'agent-refresh' })
    expect((await headings(ui)).some(t => /Cache Lab/.test(t) && /^Refreshed at /.test(t))).toBe(false)
    await ui.unmount()
  })
})

// ---------------------------------------------------------------------------------------------------------------
// Decisions of 2026-10-26 (step 43.2.5): Stop only on the orchestrator's panel; Stop turn on steps and connections;
// SendMessage receivers by name
// ---------------------------------------------------------------------------------------------------------------
describe('step 43 live findings 2, decisions: where Stop is', () => {
  test('[F2.5 negative] a subagent Agents panel has no Stop and no Stop note; View transcript and Refresh stay, with their note', async ($, on) => {
    await engine($, on, { view: { deny: 'gone' } })
    const ui = await agentsPanel($)
    const keys = await keysOf(ui)
    expect(keys).not.toContain('agent-stop')
    expect(keys.slice(-2)).toEqual(['agent-view', 'agent-refresh'])
    expect((await headings(ui)).some(t => t === 'Stop')).toBe(false)
    expect(await texts(ui)).not.toContain(STOP_NOTE)
    await ui.press({ key: 'agent-view' })
    expect(await headings(ui)).toContain('View transcript: not shown. gone')
    await ui.unmount()
  })

  test('[F2.5] the orchestrator panel has Stop with the Stop note; View transcript there asks for the main view', async ($, on) => {
    const { calls } = await engine($, on, { view: {} })
    const ui = await mainPanel($)
    expect(await keysOf(ui)).toContain('agent-stop')
    expect(await texts(ui)).toContain(STOP_NOTE)
    await ui.press({ key: 'agent-view' })
    expect(calls.views).toEqual([{}])
    expect(await headings(ui)).toContain('View transcript: the main conversation is in view.')
    await ui.unmount()
  })

  test('[F2.5] a step heading has "Stop turn" before its minimise button; the press aborts the main turn; the open step shows the note and what Stop does', async ($, on) => {
    const { calls } = await engine($, on)
    const wp = await workflow($)
    const keys = await keysOf(wp)
    const stop = keys.findIndex(k => k.endsWith('step-stop'))
    const min = keys.findIndex(k => k.endsWith('step-min'))
    expect(stop).toBeGreaterThan(-1)
    expect(stop).toBeLessThan(min)
    expect(textOf(await wp.find({ type: 'Button', key: keys[stop] })).trim()).toBe('Stop turn')
    const child: any = ((await wp.findAll({ type: 'Text' })) as any[]).find(x => textOf(x).trim() === 'Stop turn')
    expect(props(child).backgroundColor).toBe('red')
    expect(props(child).color).toBe('white')
    expect(await texts(wp)).toContain(STOP_NOTE)
    await wp.press({ key: keys[stop] })
    expect(calls.aborts).toEqual([{ turnId: 'm1' }])
    expect((await headings(wp)).some(t => /^Stop: the current turn was interrupted at \d{2}:\d{2}:\d{2}\.$/.test(t))).toBe(true)
    await wp.unmount()
  })

  test('[F2.5] Stop turn on a step with no turn running aborts nothing and says so', async ($, on) => {
    const { calls } = await engine($, on)
    await $.turn.complete({ reason: 'answer', answer: 'ok', durationMs: 1, isAborted: false, turnId: 'm1', usage: null } as any)
    const wp = await workflow($)
    await wp.press({ key: (await keysOf(wp)).find(k => k.endsWith('step-stop'))! })
    expect(calls.aborts).toEqual([])
    expect(await headings(wp)).toContain('Stop: no turn is running.')
    await wp.unmount()
  })

  test('[F2.5] the Connections panel ends with Stop turn: centred, white on red, then the Stop note; the press aborts the main turn', async ($, on) => {
    const { calls } = await engine($, on)
    const ui = await connectionsPanel($)
    const all = (await ui.findAll({})) as any[]
    const stop = all.findIndex(x => x.type === 'Button' && x.key === 'edge-stop')
    const note = all.findIndex(x => x.type === 'Text' && textOf(x) === STOP_NOTE)
    expect(stop).toBeGreaterThan(-1)
    expect(note).toBeGreaterThan(stop)
    expect(textOf(all[stop]).trim()).toBe('Stop turn')
    const child: any = all.find(x => x.type === 'Text' && textOf(x).trim() === 'Stop turn')
    expect(props(child).backgroundColor).toBe('red')
    expect(props(child).color).toBe('white')
    expect(all.some(x => x.type === 'Box' && props(x).justifyContent === 'center' && props(x).flexDirection === 'row' && props(x).width === '100%')).toBe(true)
    await ui.press({ key: 'edge-stop' })
    expect(calls.aborts).toEqual([{ turnId: 'm1' }])
    expect((await headings(ui)).some(t => /^Stop: the current turn was interrupted at /.test(t))).toBe(true)
    await ui.unmount()
  })

  test('[F2.5] the notes of the panels do not mix: a press on the Connections panel leaves the orchestrator panel without it', async ($, on) => {
    await engine($, on)
    const edge = await connectionsPanel($)
    await edge.press({ key: 'edge-stop' })
    await edge.unmount()
    const ui = await mainPanel($)
    expect((await headings(ui)).some(t => t.startsWith('Stop: '))).toBe(false)
    await ui.unmount()
  })
})

describe('step 43 live findings 2, decisions: SendMessage receivers', () => {
  const A = [{ id: 'a1', name: 'builder' }, { id: 'a2' }]
  const nameOf = (a: { id: string }) => (a.id === 'a1' ? 'Boris Cherny' : 'Kent Beck')

  test('[F2.4/L] messageTarget: team-lead and main, any case or padding, are main', () => {
    for (const to of ['team-lead', 'Team-Lead', 'TEAM-LEAD', 'main', 'MAIN', '  main  ']) expect(messageTarget(to, A, nameOf)).toBe('main')
  })

  test('[F2.4/L] messageTarget: an id, a name or a persona name is that agent, letter case aside', () => {
    expect(messageTarget('a1', A, nameOf)).toBe('a1')
    expect(messageTarget('A2', A, nameOf)).toBe('a2')
    expect(messageTarget('builder', A, nameOf)).toBe('a1')
    expect(messageTarget('boris cherny', A, nameOf)).toBe('a1')
    expect(messageTarget('Kent Beck', A, nameOf)).toBe('a2')
  })

  test('[F2.4/L] messageTarget: an unknown name is null; an empty list knows only main', () => {
    expect(messageTarget('nobody', A, nameOf)).toBeNull()
    expect(messageTarget('a1', [], nameOf)).toBeNull()
    expect(messageTarget('team-lead', [], nameOf)).toBe('main')
  })

  // PRODUCTION FINDING (left red on purpose): an empty or blank receiver matches the first agent with no name, because
  // messageTarget compares `(a.name ?? '').toLowerCase()` with the empty string. It should be null (kept raw).
  test('[F2.4/L] messageTarget: an empty or blank receiver is null, never an agent without a name', () => {
    expect(messageTarget('', A, nameOf)).toBeNull()
    expect(messageTarget('   ', A, nameOf)).toBeNull()
  })

  test('[F2.4] a SendMessage to team-lead from an agent is listed on that agent connection with the orchestrator', async ($, on) => {
    await engine($, on)
    await send($, 'toolu_s1', 'team-lead', 'report to the lead', 'a1')
    await send($, 'toolu_s2', 'Team-Lead', 'second report', 'a1')
    const ui = await connectionsPanel($)
    expect(await headings(ui)).toContain('Send Message (2)')
    await ui.press({ key: 'edge-messages' })
    const all = await headings(ui)
    expect(all).toContain('report to the lead')
    expect(all).toContain('second report')
    expect(all.some(t => /^\d{2}:\d{2}:\d{2} Boris Cherny -> Scott Hanselman$/.test(t))).toBe(true)
    await ui.unmount()
  })

  test('[F2.4] a SendMessage to an agent persona name is listed on its connection', async ($, on) => {
    await engine($, on)
    await send($, 'toolu_s1', 'Boris Cherny', 'by persona name')
    const ui = await connectionsPanel($)
    expect(await headings(ui)).toContain('Send Message (1)')
    await ui.press({ key: 'edge-messages' })
    expect(await headings(ui)).toContain('by persona name')
    await ui.unmount()
  })
})
