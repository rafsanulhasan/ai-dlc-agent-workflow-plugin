import { describe, expect, test } from 'claude-code/testing'

// Step 43, area L3 (layout): C2 the order of the workflow view in workflow mode and its step accordions, C3a Cache Lab
// collapsed by default (following collapsedByDefault), C3b the order of the agent panel. Every order is asserted by the
// index of the rendered texts and keys, never by a snapshot of the whole tree.

const PLUGIN = 'ai-dlc-lens'
const CHART_PANE = 'ai-dlc-lens-chart'
const AGENT_PANE = 'ai-dlc-lens-agent'
const RUN = 'docs/handoffs/R'
const RUN_MD = `---\nrun: R\nstatus: active\n---\n\n# Run: R — the layout run\n\n## Stages\n| Step | Stage | Agent | Status |\n|---|---|---|---|\n| 17 | build | agent-manager | in-progress |\n| 18 | test | agent-manager | in-progress |\n`
const ROSTER = '| Agent | Name |\n|---|---|\n| orchestrator | Scott Hanselman |\n| agent-manager | Boris Cherny |\n'
const def = (model: string, persona: string) => `---\nname: x\nmodel: ${model}\n---\n\nPersona name: **${persona}** — a nod.\n`
const BASE: Record<string, string> = {
  '.claude/agent-memory/ai-dlc-orchestrator/project_team-roster.md': ROSTER,
  'plugins/claude/ai-dlc/agents/orchestrator.md': def('opus', 'Scott Hanselman'),
  'plugins/claude/ai-dlc/agents/agent-manager.md': def('sonnet', 'Boris Cherny'),
  [`${RUN}/run.md`]: RUN_MD,
}

/** The engine's edges, as the lens tests' `seed` stubs them: files by path tail, panes opened, no clock. */
const listedFailed: Record<string, string> = {}
function engine(on: any, extra: Record<string, string> = {}) {
  for (const k of Object.keys(listedFailed)) delete listedFailed[k]
  const files: Record<string, string> = { ...BASE, ...extra }
  on('ui.render', ($s: any, e: any) => {
    const { Text } = $s.ui.resolve(e)
    return <Text>NATIVE ROW</Text>
  })
  on('clock.every', () => ({ value: undefined }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('session.end', (_: unknown, e: any) => ({ sessionId: e.sessionId }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 10 }, rateLimits: [] } }))
  on('settings.read', () => ({ value: { agent: 'ai-dlc:orchestrator' } }))
  on('fs.exists', () => ({ value: false }))
  on('fs.stat', () => {
    throw new Error('ENOENT')
  })
  on('fs.read', (_: unknown, e: any) => {
    const path = String(e.path ?? e).replace(/\\/g, '/')
    const hit = Object.keys(files).find(k => path === k || path.endsWith('/' + k))
    if (hit === undefined) throw new Error(`ENOENT ${path}`)
    return { value: files[hit] }
  })
  on('fs.write', () => ({ value: undefined }))
  on('fs.list', () => ({ value: [] }))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('ui.toast', () => ({ value: undefined }))
  // Step 44.3.l2.1: the engine's list says `failed` for an agent `failAgent` fails (an error turn end alone no longer halts a subagent).
  on('agent.list', () => ({ value: Object.entries(listedFailed).map(([id, status]) => ({ id, description: id, type: 'ai-dlc:agent-manager', status })) }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.view', () => ({ value: undefined }))
  on('agent.spawn', (_: unknown, e: any) => ({ model: 'claude-sonnet-5-5', agentId: 'a' + (/^toolu_(\d+)$/.exec(String(e.tool_use_id))?.[1] ?? '1') }))
  on('turn.start', (_: unknown, e: any) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: {} }))
  on('turn.complete', (_: unknown, e: any) => ({ text: e.answer }))
  on('classic.SubagentStop', () => ({}))
  on('classic.Stop', () => ({}))
}

/** The orchestrator spawns agent `a<n>` (call `toolu_<n>`) into run R at step `code`; it keeps running. */
async function spawn($: any, n: number, code: string) {
  const prompt = `Your handoff record is ${RUN}/${code}-orchestrator-to-agent-manager.handoff.md (root x).\nDo it.`
  await $.tool.call({ tool: 'Agent', subagent_type: 'ai-dlc:agent-manager', description: `d${n}`, prompt, tool_use_id: `toolu_${n}` })
  await $.agent.spawn({ tool_use_id: `toolu_${n}`, prompt, description: `d${n}`, subagentType: 'ai-dlc:agent-manager', provider: { plugin: 'ai-dlc', tier: 'user' }, parentModel: 'claude-opus-5-5', background: true, fork: false })
}
/** Run R with steps 17 (agent a1) and 18 (agent a2). `lens`: lens.json keys; the Panel Type defaults to the tab unless the test says otherwise. */
async function start($: any, on: any, lens: Record<string, unknown> = {}) {
  engine(on, { '.ai-dlc/lens.json': JSON.stringify({ panelOpenMode: 'tab', ...lens }) })
  await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
  await spawn($, 1, '17')
  await spawn($, 2, '18')
}
const failAgent = ($: any, agentId: string) => {
  listedFailed[agentId] = 'failed'
  return failTurn($, agentId)
}
const failTurn = ($: any, agentId: string) => $.turn.complete({ reason: 'error', answer: '', durationMs: 1, isAborted: false, turnId: 't', agentId, usage: null } as any)

const mountPane = ($: any, requestId: string, bodyColumns = 120) =>
  $.ui.mount({ plugin: PLUGIN, surface: 'vscode', component: 'Pane', requestId, props: { title: requestId, isFocused: false, bodyColumns, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} } })
/** The docked view in workflow mode (the first spawn opens it so; from a list it is entered through the first run's row). */
async function workflowView($: any) {
  const ui = await mountPane($, CHART_PANE)
  if ((await ui.find({ type: 'Button', key: 'runs-back' })) === undefined) {
    const row = ((await ui.findAll({ type: 'Button' })) as any[]).find((b: any) => /^wf-toolu_\d+$/.test(String(b.key)))
    await ui.press({ key: String(row.key) })
  }
  return ui
}
const keyOf = (x: any) => String(x?.key ?? x?.props?.key ?? '')
const textOf = (x: any) => String(x?.text ?? '').trim()
/** The index of the first element at or after `from` that `pred` accepts; -1 when none. */
const at = (all: any[], pred: (x: any) => boolean, from = 0) => {
  if (from < 0) return -1
  for (let i = from; i < all.length; i++) if (pred(all[i])) return i
  return -1
}
const isButton = (key: string | RegExp) => (x: any) => x.type === 'Button' && (typeof key === 'string' ? keyOf(x) === key : key.test(keyOf(x)))
const isDivider = (x: any) => x.type === 'Text' && /^─+$/.test(textOf(x))
const isText = (re: RegExp) => (x: any) => x.type === 'Text' && re.test(textOf(x))
const increasing = (xs: number[]) => xs.every((x, i) => x >= 0 && (i === 0 || x > xs[i - 1]!))
const chartKeys = async (ui: any): Promise<string[]> =>
  ((await ui.findAll({ type: 'Svg' })) as any[]).map((x: any) => /^Step chart (\S+):/.exec(String(x?.props?.alt ?? ''))?.[1] ?? '').filter(k => k !== '')
const stepButtons = async (ui: any, which: 'min' | 'full') => ((await ui.findAll({ type: 'Button' })) as any[]).filter((b: any) => new RegExp(`step-${which}$`).test(keyOf(b)))

describe('[C2] the workflow view, workflow mode: the order of the elements', () => {
  test('[C2] Panel Type, separator, Anomalies, separator, back button, status, run name and metadata, then the step accordions', async ($, on) => {
    await start($, on)
    // a2 is the latest agent: a failed agent is cleared once a later one of its type runs the same run, so a1 failing would show nothing.
    await failAgent($, 'a2')
    const ui = await workflowView($)
    const all: any[] = await ui.findAll({})
    const drill = at(all, isButton('panel-drill-in'))
    const tab = at(all, isButton('panel-tab'), drill)
    const sepA = at(all, isDivider, tab)
    const anomalies = at(all, isButton('anomalies'), sepA)
    const sepB = at(all, isDivider, anomalies)
    const back = at(all, isButton('runs-back'), sepB)
    const status = at(all, x => x.type === 'Svg' && String(x?.props?.alt ?? '').startsWith('status: '), back)
    const meta = at(all, isText(/^Scott Hanselman spawned 2 agents$/), status)
    const steps = at(all, isText(/^2 steps$/), meta)
    const firstStep = at(all, isButton(/step-min$/), steps)
    expect(increasing([drill, tab, sepA, anomalies, sepB, back, status, meta, steps, firstStep])).toBe(true)
    // The run's name sits between the status and its metadata.
    expect(all.slice(status + 1, meta).some(x => x.type === 'Text' && textOf(x) !== '' && !/^▲/.test(textOf(x)))).toBe(true)
    // Between Panel Type and the first separator: nothing but the pane's own controls (no Anomalies, no back button).
    expect(all.slice(tab + 1, sepA).some(x => x.type === 'Button' && !/^pane-/.test(keyOf(x)))).toBe(false)
    await ui.unmount()
  })

  test('[C2] with no anomaly: Panel Type, one separator, back button (no Anomalies heading, no second separator)', async ($, on) => {
    await start($, on)
    const ui = await workflowView($)
    const all: any[] = await ui.findAll({})
    expect(at(all, isButton('anomalies'))).toBe(-1)
    const tab = at(all, isButton('panel-tab'))
    const sep = at(all, isDivider, tab)
    const back = at(all, isButton('runs-back'), sep)
    expect(increasing([tab, sep, back])).toBe(true)
    expect(all.slice(sep + 1, back).filter(isDivider).length).toBe(0)
    await ui.unmount()
  })
})

describe('[C2] each step is its own accordion with a minimise button just left of its full-screen button', () => {
  test('[C2] per step: heading, then minimise, then full screen, nothing between; the highest step is open (–), the other collapsed (□)', async ($, on) => {
    await start($, on)
    const ui = await workflowView($)
    const all: any[] = await ui.findAll({})
    const mins = await stepButtons(ui, 'min')
    const fulls = await stepButtons(ui, 'full')
    expect(mins.length).toBe(2)
    expect(fulls.length).toBe(2)
    // Highest code first: step 18, then 17.
    const headings = [at(all, isText(/^Step 18 ·/)), at(all, isText(/^Step 17 ·/))]
    const minAt = mins.map((b: any) => at(all, x => x === b || (x.type === 'Button' && keyOf(x) === keyOf(b))))
    const fullAt = fulls.map((b: any) => at(all, x => x.type === 'Button' && keyOf(x) === keyOf(b)))
    expect(increasing([headings[0]!, minAt[0]!, fullAt[0]!, headings[1]!, minAt[1]!, fullAt[1]!])).toBe(true)
    // Just left of: no other Button stands between a step's minimise and its full screen.
    for (const i of [0, 1]) expect(all.slice(minAt[i]! + 1, fullAt[i]!).filter(x => x.type === 'Button').length).toBe(0)
    expect(mins.map((b: any) => String(b.text))).toEqual(['–', '□'])
    expect(fulls.map((b: any) => String(b.text))).toEqual(['⤢', '⤢'])
    // Only the open step draws its chart.
    expect(await chartKeys(ui)).toEqual(['18'])
    await ui.unmount()
  })

  test('[C2] the minimise button flips the default: the collapsed step opens, the open (highest) step collapses, and each press toggles back', async ($, on) => {
    await start($, on)
    const ui = await workflowView($)
    const [highest, lower] = await stepButtons(ui, 'min')
    await ui.press({ key: keyOf(lower) })
    expect(await chartKeys(ui)).toEqual(['18', '17'])
    expect((await stepButtons(ui, 'min')).map((b: any) => String(b.text))).toEqual(['–', '–'])
    // The default-open step collapses: its chart goes, its heading and its buttons stay.
    await ui.press({ key: keyOf(highest) })
    expect(await chartKeys(ui)).toEqual(['17'])
    expect((await stepButtons(ui, 'min')).map((b: any) => String(b.text))).toEqual(['□', '–'])
    expect((await stepButtons(ui, 'full')).length).toBe(2)
    await ui.press({ key: keyOf(highest) })
    expect(await chartKeys(ui)).toEqual(['18', '17'])
    await ui.press({ key: keyOf(lower) })
    expect(await chartKeys(ui)).toEqual(['18'])
    await ui.unmount()
  })

  test('[C2] a collapsed step still has its heading and its status; its avatar and arrow buttons are drawn only while it is open', async ($, on) => {
    await start($, on)
    const ui = await workflowView($)
    // Step 18 is open: its agent a2 has an avatar and an arrow; step 17 (agent a1) is collapsed and has neither.
    const keys = async () => ((await ui.findAll({ type: 'Button' })) as any[]).map(keyOf)
    expect((await keys()).some(k => k.endsWith('agent-a2'))).toBe(true)
    expect((await keys()).some(k => k.endsWith('edge-a2'))).toBe(true)
    expect((await keys()).some(k => k.endsWith('agent-a1'))).toBe(false)
    expect(await ui.find({ type: 'Text', text: /^Step 17 ·/ })).toBeDefined()
    const [, lower] = await stepButtons(ui, 'min')
    await ui.press({ key: keyOf(lower) })
    expect((await keys()).some(k => k.endsWith('agent-a1'))).toBe(true)
    await ui.unmount()
  })
})

describe('[C3a] Cache Lab in the agent panel follows collapsedByDefault', () => {
  async function agentPanel($: any, id = 'a2') {
    const ui = await workflowView($)
    await ui.press({ key: `agent-${id}` })
    await ui.unmount()
    return mountPane($, AGENT_PANE)
  }
  const labButton = async (ui: any) => String((await ui.find({ type: 'Button', key: 'cachelab-open' }))?.text)

  test('[C3a] closed by default, like the other sections (Context Lab, Tool calls, Background tasks, Thinking); a press opens and closes it', async ($, on) => {
    await start($, on)
    const ag = await agentPanel($)
    for (const k of ['agent-usage', 'cachelab-open', 'agent-calls', 'agent-tasks', 'agent-thinking']) expect(String((await ag.find({ type: 'Button', key: k }))?.text)).toBe('[+]')
    await ag.press({ key: 'cachelab-open' })
    expect(await labButton(ag)).toBe('[-]')
    await ag.press({ key: 'cachelab-open' })
    expect(await labButton(ag)).toBe('[+]')
    await ag.unmount()
  })

  test('[C3a] collapsedByDefault false in lens.json: Cache Lab starts open, with every other section; a press closes it', async ($, on) => {
    await start($, on, { collapsedByDefault: false })
    const ag = await agentPanel($)
    for (const k of ['agent-usage', 'cachelab-open', 'agent-calls', 'agent-tasks', 'agent-thinking']) expect(String((await ag.find({ type: 'Button', key: k }))?.text)).toBe('[-]')
    await ag.press({ key: 'cachelab-open' })
    expect(await labButton(ag)).toBe('[+]')
    // The other sections are untouched by that press.
    expect(String((await ag.find({ type: 'Button', key: 'agent-usage' }))?.text)).toBe('[-]')
    await ag.press({ key: 'cachelab-open' })
    expect(await labButton(ag)).toBe('[-]')
    await ag.unmount()
  })
})

describe('[C3b] the agent panel: the order of the elements', () => {
  /** The sections' button keys, in the order the panel must draw them. */
  const SECTIONS = ['agent-anomalies', 'agent-usage', 'cachelab-open', 'agent-calls', 'agent-tasks', 'agent-thinking']

  test('[C3b] tab: Panel Type; separator; agent name, model and role; separator; Anomalies; separator; Context Lab; separator; Cache Lab; the rest, each after a separator', async ($, on) => {
    await start($, on)
    await failAgent($, 'a2')
    const wv = await workflowView($)
    await wv.press({ key: 'agent-a2' })
    await wv.unmount()
    const ag = await mountPane($, AGENT_PANE)
    const all: any[] = await ag.findAll({})
    const drill = at(all, isButton('agent-panel-drill-in'))
    const tab = at(all, isButton('agent-panel-tab'), drill)
    const sepTop = at(all, isDivider, tab)
    const name = at(all, isText(/Boris Cherny/), sepTop)
    const role = at(all, isText(/Agent Manager/), name)
    const idx: number[] = []
    let from = role
    for (const k of SECTIONS) {
      from = at(all, isButton(k), from)
      idx.push(from)
      from += 1
    }
    expect(increasing([drill, tab, sepTop, name, role, ...idx])).toBe(true)
    // Each section has a separator of its own right before it: one divider between every two consecutive headings, and one between the header and Anomalies.
    const marks = [role, ...idx]
    for (let i = 1; i < marks.length; i++) expect(all.slice(marks[i - 1]! + 1, marks[i]!).filter(isDivider).length).toBe(1)
    // The Panel Type switch is the first thing in the panel and is followed by a separator before the header.
    expect(all.slice(0, drill).some(x => x.type === 'Button')).toBe(false)
    expect(all.slice(tab + 1, sepTop).filter(x => x.type === 'Button' && !/^pane-/.test(keyOf(x))).length).toBe(0)
    await ag.unmount()
  })

  test('[C3b] the agent has no anomaly: the same order without the Anomalies section and without a doubled separator', async ($, on) => {
    await start($, on)
    const wv = await workflowView($)
    await wv.press({ key: 'agent-a2' })
    await wv.unmount()
    const ag = await mountPane($, AGENT_PANE)
    const all: any[] = await ag.findAll({})
    expect(at(all, isButton('agent-anomalies'))).toBe(-1)
    const rest = SECTIONS.filter(k => k !== 'agent-anomalies')
    const idx = rest.map(k => at(all, isButton(k)))
    const role = at(all, isText(/Agent Manager/))
    expect(increasing([role, ...idx])).toBe(true)
    const marks = [role, ...idx]
    for (let i = 1; i < marks.length; i++) expect(all.slice(marks[i - 1]! + 1, marks[i]!).filter(isDivider).length).toBe(1)
    await ag.unmount()
  })

  test('[C3b] only that agent\'s anomalies are in its panel: the other agent failing adds no Anomalies section here', async ($, on) => {
    await start($, on)
    await failAgent($, 'a2')
    const wv = await workflowView($)
    // Step 17's accordion is collapsed: open it to reach a1's avatar. The view lists a2's anomaly; a1's own panel has none.
    expect(await wv.find({ type: 'Button', key: 'anomalies' })).toBeDefined()
    await wv.press({ key: String(((await stepButtons(wv, 'min')) as any[])[1].key) })
    await wv.press({ key: 'agent-a1' })
    await wv.unmount()
    const ag = await mountPane($, AGENT_PANE)
    expect(await ag.find({ type: 'Text', text: /Boris Cherny/ })).toBeDefined()
    expect(await ag.find({ type: 'Button', key: 'agent-anomalies' })).toBe(undefined)
    await ag.unmount()
  })

  test('[C3b] drill-in: Panel Type; separator; back button; agent name, model and role; separator; Anomalies; separator; Context Lab; separator; Cache Lab; the rest', async ($, on) => {
    await start($, on, { panelOpenMode: 'drill-in' })
    await failAgent($, 'a2')
    const wv = await workflowView($)
    await wv.press({ key: 'agent-a2' })
    // The view now draws the panel in place of the runs, under its own "< Back".
    const all: any[] = await wv.findAll({})
    const drill = at(all, isButton('agent-panel-drill-in'))
    // Panel Type, then the separator, then back, then the header: the panel's own switch leads its body.
    const tab = at(all, isButton('agent-panel-tab'), drill)
    const sep = at(all, isDivider, tab)
    const backInPanel = at(all, isButton('drill-back'), sep)
    const name = at(all, isText(/Boris Cherny/), backInPanel)
    const role = at(all, isText(/Agent Manager/), name)
    const idx: number[] = []
    let from = role
    for (const k of SECTIONS) {
      from = at(all, isButton(k), from)
      idx.push(from)
      from += 1
    }
    expect(increasing([drill, tab, sep, backInPanel, name, role, ...idx])).toBe(true)
    const marks = [role, ...idx]
    for (let i = 1; i < marks.length; i++) expect(all.slice(marks[i - 1]! + 1, marks[i]!).filter(isDivider).length).toBe(1)
    await wv.unmount()
  })
})
