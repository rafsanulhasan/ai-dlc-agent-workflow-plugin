import { describe, expect, test } from 'claude-code/testing'
import {
  VIEW0,
  bandClosedOf,
  bandFromPane,
  bandMinimise,
  bandModeOf,
  bandPick,
  bandRestore,
  bandToList,
  cardOpenView,
  dockedBandMinimise,
  dockedCanRestore,
  dockedRestore,
  drillPlaceOf,
  drillTargetOf,
  lensCommandView,
  paneFromBand,
  paneModeOf,
  paneOnRun,
  paneToList,
  stepKeyOfCall,
} from '../hooks/lens'

// Step 43 (the human's requirements A1, B1-B6 and the answers on rules 2 and 3): the lens view's modes and controls.
// The engine is stubbed at its edges, as the lens tests do (tests/lens.test.tsx `seed`); the band is mounted as
// AbovePrompt and the right panel as the Pane of id ai-dlc-lens-chart. Each test is tagged with its requirement id.

const PLUGIN = 'ai-dlc-lens'
const CHART = 'ai-dlc-lens-chart'
const AGENT = 'ai-dlc-lens-agent'
const EDGE = 'ai-dlc-lens-edge'
const MINIMISED_REPLY = 'AI-DLC Lens: the band above the prompt is shown minimised; the pane is not changed (open it from the band with ⤢).'

const ROSTER = ['| Agent | Name |', '|---|---|', '| orchestrator | Scott Hanselman |', '| software-engineer | David Fowler |', '| sqa-engineer | Kent Beck |', '| agent-manager | Boris Cherny |'].join('\n')
const def = (model: string, persona: string) => `---\nname: x\nmodel: ${model}\n---\n\nPersona name: **${persona}** — a nod.\n`
const RECORD = 'docs/handoffs/R/17-orchestrator-to-agent-manager.handoff.md'
const BASE_FILES: Record<string, string> = {
  '.claude/agent-memory/ai-dlc-orchestrator/project_team-roster.md': ROSTER,
  'plugins/claude/ai-dlc/agents/orchestrator.md': def('opus', 'Scott Hanselman'),
  'plugins/claude/ai-dlc/agents/agent-manager.md': def('sonnet', 'Boris Cherny'),
  'plugins/claude/ai-dlc/agents/sqa-engineer.md': def('sonnet', 'Kent Beck'),
  [RECORD]: 'HANDOFF BODY',
}
/** A run folder's run state with the steps 1 (done) and 2 (in progress): a card of a step-1 call has a step to open. */
const RUN_A =
  '---\nrun: A\nstatus: active\n---\n\n# Run: run A\n\n## Stages\n| Step | Stage | Agent | Status |\n|---|---|---|---|\n| 1 | research | agent-manager | done |\n| 2 | build | agent-manager | in-progress |\n'
const RUN_B = '---\nrun: B\nstatus: active\n---\n\n# Run: run B\n\n## Stages\n| Step | Stage | Agent | Status |\n|---|---|---|---|\n| 1 | change it | agent-manager | in-progress |\n'
const lensJson = (o: Record<string, unknown>) => ({ '.ai-dlc/lens.json': JSON.stringify(o) })
const DOCKED = lensJson({ workflowPlace: 'docked' })

type Opts = {
  surface?: 'terminal' | 'vscode'
  /** The first agent has finished (the run is idle: no workflow in progress). */
  done?: boolean
  files?: Record<string, string>
  /** What the session draws on (default: the surface alone). */
  surfaces?: string[]
}

/**
 * The engine's edges for the lens (the same stubs as the lens tests' `seed`, without the main loop's own step): the
 * first call (toolu_1 -> a1) is spawned in the background, so its workflow is in progress unless `done`. `ticks` are the
 * band-ping timers the pane beside the band asks for (never fired unless the test fires them).
 */
async function engine($: any, on: any, o: Opts = {}) {
  const surface = o.surface ?? 'terminal'
  const files: Record<string, string> = { ...BASE_FILES, ...(o.files ?? {}) }
  // The older panel tests were written for the tab mode; most of these tests need none of it, but a test that wants drill-in sets it.
  if (!('.ai-dlc/lens.json' in files)) files['.ai-dlc/lens.json'] = JSON.stringify({ panelOpenMode: 'tab' })
  const opened: string[] = []
  const openArgs: any[] = []
  const closed: string[] = []
  const ticks: (() => void)[] = []
  const openNow = new Set<string>()
  const status = { a1: o.done ? 'completed' : 'running' }
  on('session.surfaces', () => ({ value: o.surfaces ?? [surface] }))
  on('ui.render', ($s: any, e: any) => {
    const { Text } = $s.ui.resolve(e)
    return <Text>NATIVE ROW</Text>
  })
  on('clock.every', () => ({ value: undefined }))
  on('clock.after', () => new Promise(r => ticks.push(() => r({ value: undefined }))) as never)
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
  on('fs.write', (_: unknown, e: any) => ({ value: undefined }))
  let listed = 1
  on('fs.list', () => {
    listed += 1
    return { value: [{ name: '17-orchestrator-to-agent-manager.handoff.md', kind: 'file', size: 1, mtimeMs: listed }] }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('agent.list', () => ({ value: [{ id: 'a1', description: 'build', type: 'ai-dlc:agent-manager', status: status.a1 }] }))
  on('ui.open', (_: unknown, e: any) => {
    opened.push(e.id)
    openArgs.push(e)
    openNow.add(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_: unknown, e: any) => {
    closed.push(e.id)
    openNow.delete(e.id)
    return { value: undefined }
  })
  on('ui.panes', () => ({ value: [...openNow].map(id => ({ id, title: id, isShown: true, isFocused: false, isPlaced: true })) }))
  on('ui.view', () => ({ value: undefined }))
  on('agent.spawn', (_: unknown, e: any) => ({ model: 'claude-sonnet-5-5', agentId: 'a' + (/^toolu_(\d+)$/.exec(String(e.tool_use_id))?.[1] ?? '1') }))
  on('turn.start', (_: unknown, e: any) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: {} }))
  on('turn.complete', (_: unknown, e: any) => ({ text: e.answer }))
  on('classic.SubagentStop', () => ({}))
  on('classic.Stop', () => ({}))
  await $.session.start({ cwd: '/', surface, isInteractive: true })
  await spawn($, 1, 'R', '17')
  if (o.done) await finish($, 'a1')
  return { opened, openArgs, closed, ticks, openNow, files }
}

/** The orchestrator spawns agent `a<n>` (call `toolu_<n>`) into run folder `run`, step `code`; it keeps running. */
async function spawn($: any, n: number, run: string, code: string, subagentType = 'ai-dlc:agent-manager') {
  await new Promise(r => (globalThis as any).setTimeout(r, 3)) // the view lists runs by their start: each spawn starts in a later millisecond
  const prompt = `Your handoff record is docs/handoffs/${run}/${code}-orchestrator-to-agent-manager.handoff.md (root x).\nDo it.`
  await $.turn.start({ text: `request ${n}`, turnId: `m${n}` })
  await $.tool.call({ tool: 'Agent', subagent_type: subagentType, description: `d${n}`, prompt, tool_use_id: `toolu_${n}` })
  await $.agent.spawn({ tool_use_id: `toolu_${n}`, prompt, description: `d${n}`, subagentType, provider: { plugin: 'ai-dlc', tier: 'user' }, parentModel: 'claude-opus-5-5', background: true, fork: false })
}
async function finish($: any, agentId: string) {
  await $.turn.complete({ reason: 'answer', answer: 'done', durationMs: 1, isAborted: false, turnId: 't', agentId, usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'claude-sonnet-5-5' } })
}

const setting = (columns: number) => ({ hasSurvey: false, isWorking: false, maxRows: 40, bodyColumns: columns, scroll: { offset: 0, bodyRows: 40 }, view: {} })
/** The band above the prompt: 120 columns is wide (list only), 40 narrow (the band shows a run's workflow itself). */
const band = ($: any, columns = 120) => $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: setting(columns) } as any)
/** The right panel (the Pane). */
const rightPane = ($: any, surface: 'terminal' | 'vscode' = 'terminal', columns = 120) =>
  $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: CHART, props: { title: CHART, isFocused: false, bodyColumns: columns, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} }, viewport: { columns: 200, rows: 50 } } as any)
const tab = ($: any, id: string, surface: 'terminal' | 'vscode' = 'terminal') =>
  $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: id, props: { title: id, isFocused: false, bodyColumns: 120, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} } } as any)
const keysOf = async (ui: any): Promise<string[]> => ((await ui.findAll({ type: 'Button' })) as any[]).map((b: any) => String(b.key))
const has = async (ui: any, key: string): Promise<boolean> => (await ui.find({ type: 'Button', key })) !== undefined
const labelOf = async (ui: any, key: string): Promise<string | undefined> => {
  const b: any = await ui.find({ type: 'Button', key })
  return b === undefined ? undefined : String(b.text ?? b.props?.label)
}
const lensCmd = async ($: any): Promise<string> => String(((await ($.command.run as any)({ command: 'ai-dlc:lens', args: '' })) as any)?.text)
const chartOpens = (openArgs: any[]) => openArgs.filter((x: any) => x.id === CHART)
const stepChartKeys = async (ui: any): Promise<string[]> =>
  ((await ui.findAll({ type: 'Svg' })) as any[]).map((x: any) => /^(?:Step|Full screen) chart (\S+):/.exec(String(x?.props?.alt ?? ''))?.[1] ?? '').filter(k => k !== '')
/** The band shows its run list: the first run's row; minimised, nothing of the kind. */
const listed = async (ui: any) => has(ui, 'wf-toolu_1')
/** The band (or pane) shows one run's flow. */
const inFlow = async (ui: any) => has(ui, 'runs-back')

/** Starts a second workflow (a new request, a new background spawn) that keeps running. */
async function secondFlow($: any) {
  await spawn($, 2, 'B', '1')
}
const wait = (ms: number) => new Promise(r => (globalThis as any).setTimeout(r, ms))

// ---------------------------------------------------------------------------------------------------------------
// A1: /ai-dlc:lens pinned shows only the band, minimised
// ---------------------------------------------------------------------------------------------------------------
describe('step 43 A1: /ai-dlc:lens, pinned with the band drawn', () => {
  test('[A1] the band starts minimised and the command keeps it so, says so, and opens no pane', async ($, on) => {
    const { openArgs, closed } = await engine($, on)
    const before = { opens: openArgs.length, closes: closed.length }
    expect(await lensCmd($)).toBe(MINIMISED_REPLY)
    expect(chartOpens(openArgs.slice(before.opens))).toEqual([])
    expect(closed.slice(before.closes)).not.toContain(CHART)
    const b = await band($)
    expect(await labelOf(b, 'pane-min')).toBe('□')
    expect(await listed(b)).toBe(false)
    // The right panel is opened from the band with the full-screen button.
    expect(await has(b, 'pane-full')).toBe(true)
    await b.unmount()
  })

  test('[A1] a band in list mode is minimised by the command; the pane beside it is not changed', async ($, on) => {
    const { openArgs } = await engine($, on)
    const b = await band($)
    await b.press({ key: 'pane-min' })
    expect(await listed(b)).toBe(true)
    await b.press({ key: 'pane-full' })
    await b.unmount()
    const before = openArgs.length
    expect(await lensCmd($)).toBe(MINIMISED_REPLY)
    expect(chartOpens(openArgs.slice(before))).toEqual([])
    const again = await band($)
    expect(await listed(again)).toBe(false)
    await again.unmount()
  })

  test('[A1] a band closed with × comes back, minimised, with the command', async ($, on) => {
    await engine($, on, { done: true })
    let b = await band($)
    expect(await has(b, 'band-close')).toBe(true)
    await b.press({ key: 'band-close' })
    await b.unmount()
    b = await band($)
    expect(await has(b, 'pane-place')).toBe(false)
    expect(await b.find({ type: 'Text', text: 'NATIVE ROW' })).toBeDefined()
    await b.unmount()
    expect(await lensCmd($)).toBe(MINIMISED_REPLY)
    b = await band($)
    expect(await labelOf(b, 'pane-min')).toBe('□')
    await b.unmount()
  })

  test('[A1] pure: lensCommandView with the band drawn only minimises the band; both modes and the pane are untouched', () => {
    const v = { ...VIEW0, bandMode: 'workflow' as const, paneMode: 'workflow' as const, pane: 'w9', selected: 'w1' }
    expect(lensCommandView(v, true, 'wX')).toEqual({ ...v, size: 'minimised', prev: [] })
  })
})

// ---------------------------------------------------------------------------------------------------------------
// The human's rule 2: the command opens the pane itself (docked, or a surface with no band)
// ---------------------------------------------------------------------------------------------------------------
describe('step 43 rule 2: the command opens the panel: the workflow in progress, else the run list', () => {
  test('[rule2] docked, a workflow in progress: the pane opens in workflow mode on it', async ($, on) => {
    const { openArgs } = await engine($, on, { files: DOCKED })
    const before = openArgs.length
    await lensCmd($)
    expect(chartOpens(openArgs.slice(before)).map((x: any) => x.focus)).toEqual([true])
    const wp = await rightPane($)
    expect(await inFlow(wp)).toBe(true)
    expect(await has(wp, 'agent-a1')).toBe(true)
    await wp.unmount()
  })

  test('[rule2] docked, none in progress: the pane is on the newest run, its run list one step back (live round 1, 2b)', async ($, on) => {
    await engine($, on, { files: DOCKED, done: true })
    await lensCmd($)
    const wp = await rightPane($)
    expect(await inFlow(wp)).toBe(true)
    expect(await has(wp, 'wf-toolu_1')).toBe(false)
    await wp.unmount()
  })

  test('[rule2] docked, several in progress: the latest', async ($, on) => {
    await engine($, on, { files: { ...DOCKED, 'docs/handoffs/B/run.md': RUN_B } })
    await secondFlow($)
    await lensCmd($)
    const wp = await rightPane($)
    expect(await has(wp, 'toolu_2:wf-thinking')).toBe(true)
    expect(await has(wp, 'toolu_1:wf-thinking')).toBe(false)
    await wp.unmount()
  })

  test('[rule2] a surface with no band (VS Code): the command opens the pane on the workflow in progress, and the run list when none is', async ($, on) => {
    const { openArgs } = await engine($, on, { surface: 'vscode' })
    // the command seats itself from the last lens pane drawn: a docked pane, wide by wideColumns, is the wide VS Code panel
    await (await rightPane($, 'vscode')).unmount()
    const before = openArgs.length
    expect(await lensCmd($)).toMatch(/^AI-DLC Lens (opened|brought forward)\.$/)
    expect(chartOpens(openArgs.slice(before)).length).toBe(1)
    const wp = await rightPane($, 'vscode')
    expect(await inFlow(wp)).toBe(true)
    await wp.unmount()
  })

  test('[rule2] the first spawn opens the pane by itself the same way (a surface with no band)', async ($, on) => {
    const { openArgs } = await engine($, on, { surface: 'vscode', files: { 'docs/handoffs/B/run.md': RUN_B } })
    expect(chartOpens(openArgs).length).toBe(1)
    const wp = await rightPane($, 'vscode')
    expect(await inFlow(wp)).toBe(true)
    await wp.unmount()
  })

  test('[rule2] pure: lensCommandView without a band is the workflow of the newest in progress, else the run list', () => {
    expect(lensCommandView({ ...VIEW0, paneMode: 'list' }, false, 'w7')).toMatchObject({ paneMode: 'workflow', selected: 'w7' })
    expect(lensCommandView({ ...VIEW0, paneMode: 'workflow', selected: 'w1' }, false, null)).toMatchObject({ paneMode: 'list', selected: 'w1' })
  })
})

// ---------------------------------------------------------------------------------------------------------------
// The human's rule 3: the chat card opens that step in workflow mode
// ---------------------------------------------------------------------------------------------------------------
describe('step 43 rule 3: the chat card opens its step in workflow mode', () => {
  const card = ($: any, n: number, surface: 'terminal' | 'vscode' = 'terminal') =>
    $.ui.mount({
      plugin: PLUGIN,
      surface,
      component: 'ToolUse',
      requestId: `toolu_${n}`,
      viewport: { columns: 200, rows: 40 },
      props: { tool_use_id: `toolu_${n}`, tool: 'Agent', input: { subagent_type: 'ai-dlc:agent-manager', description: `d${n}`, prompt: `Your handoff record is docs/handoffs/A/${n === 2 ? 1 : 2}-orchestrator-to-agent-manager.handoff.md (root x).\nDo it.` }, isRunning: false, isErrored: false, isInterrupted: false },
    } as any)

  test('[rule3] "Open flowchart" on a step-1 call: the pane opens focused in workflow mode, that step open; the pinned band is untouched', async ($, on) => {
    const { openArgs } = await engine($, on, { files: { 'docs/handoffs/A/run.md': RUN_A } })
    await spawn($, 2, 'A', '1')
    await spawn($, 3, 'A', '2')
    // The pane would have been opened by the band; the card opens it itself.
    const c = await card($, 2)
    const before = openArgs.length
    await c.press({ key: 'card-open-chart' })
    await c.unmount()
    expect(chartOpens(openArgs.slice(before)).map((x: any) => x.focus)).toEqual([true])
    const wp = await rightPane($)
    expect(await inFlow(wp)).toBe(true)
    // Step 2 is the run's highest (open by default); step 1 is the card's call: open too (its minimise reads –, not □).
    expect(await labelOf(wp, 'nr:toolu_2:s1:step-min')).toBe('–')
    expect(await labelOf(wp, 'nr:toolu_2:s2:step-min')).toBe('□') // the other steps stay collapsed
    await wp.unmount()
    // The band stays as it was: minimised.
    const b = await band($)
    expect(await labelOf(b, 'pane-min')).toBe('□')
    await b.unmount()
  })

  test('[rule3] the card of a call of another run opens that run, not the one the pane showed', async ($, on) => {
    await engine($, on, { files: { 'docs/handoffs/A/run.md': RUN_A, 'docs/handoffs/B/run.md': RUN_B } })
    await spawn($, 2, 'A', '1')
    const wp0 = await rightPane($)
    await wp0.press({ key: 'wf-toolu_1' }) // the pane shows the first run
    await wp0.unmount()
    const c = await card($, 2)
    await c.press({ key: 'card-open-chart' })
    await c.unmount()
    const wp = await rightPane($)
    expect(await has(wp, 'nr:toolu_2:s1:step-min')).toBe(true)
    expect(await has(wp, 'toolu_1:wf-thinking')).toBe(false)
    await wp.unmount()
  })

  test('[rule3] pure: cardOpenView puts the pane in workflow mode on the run, the band untouched; stepKeyOfCall finds the call\'s step', () => {
    expect(cardOpenView({ ...VIEW0, paneMode: 'list', bandMode: 'workflow' }, 'w3', true)).toMatchObject({ paneMode: 'workflow', pane: 'w3', bandMode: 'workflow' })
    // Docked a minimised pane is restored first.
    expect(cardOpenView(viewMin(), 'w3', false)).toMatchObject({ size: 'normal', paneMode: 'workflow', selected: 'w3' })
    const charts = [
      { key: '2', ids: ['a3'], agents: { a3: { toolUseId: 'toolu_3' } } },
      { key: '1', ids: ['a2', 'call:toolu_9'], agents: { a2: { toolUseId: 'toolu_2' } } },
    ] as any
    expect(stepKeyOfCall(charts, 'toolu_2')).toBe('1')
    expect(stepKeyOfCall(charts, 'toolu_9')).toBe('1')
    expect(stepKeyOfCall(charts, 'toolu_3')).toBe('2')
    expect(stepKeyOfCall(charts, 'toolu_x')).toBe(null)
  })
})
const viewMin = () => ({ ...VIEW0, size: 'minimised' as const, prev: ['normal' as const] })

// ---------------------------------------------------------------------------------------------------------------
// B1 minimise, B2 maximise (responsive)
// ---------------------------------------------------------------------------------------------------------------
describe('step 43 B1/B2: minimise and maximise', () => {
  test('[B1a] – on the band minimises only the band: the pane beside it stays open on its run, nothing opens or closes', async ($, on) => {
    const { openArgs, closed } = await engine($, on)
    let b = await band($)
    await b.press({ key: 'pane-min' }) // □: the list
    await b.press({ key: 'pane-full' }) // the pane opens (list)
    await b.unmount()
    const wp0 = await rightPane($)
    await wp0.press({ key: 'wf-toolu_1' })
    await wp0.unmount()
    const before = { opens: openArgs.length, closes: closed.length }
    b = await band($)
    expect(await labelOf(b, 'pane-min')).toBe('–')
    await b.press({ key: 'pane-min' })
    expect(await listed(b)).toBe(false)
    expect(await labelOf(b, 'pane-min')).toBe('□')
    await b.unmount()
    expect(chartOpens(openArgs.slice(before.opens))).toEqual([])
    expect(closed.slice(before.closes).filter(x => x === CHART)).toEqual([])
    const wp = await rightPane($)
    expect(await has(wp, 'agent-a1')).toBe(true)
    await wp.unmount()
  })

  test('[B1b] – on the panel minimises only the band: the band is one line afterwards, the panel stays on its run', async ($, on) => {
    const { closed } = await engine($, on)
    let b = await band($)
    await b.press({ key: 'pane-min' })
    await b.press({ key: 'pane-full' })
    expect(await listed(b)).toBe(true)
    await b.unmount()
    const wp = await rightPane($)
    await wp.press({ key: 'wf-toolu_1' })
    expect(await labelOf(wp, 'pane-min')).toBe('–')
    await wp.press({ key: 'pane-min' })
    // The panel is not minimised: it still draws its run.
    expect(await has(wp, 'agent-a1')).toBe(true)
    expect(await labelOf(wp, 'pane-min')).toBe('□')
    await wp.unmount()
    expect(closed.filter(x => x === CHART).length).toBe(1) // only the setup close, before the first spawn
    b = await band($)
    expect(await listed(b)).toBe(false)
    expect(await labelOf(b, 'pane-min')).toBe('□')
    await b.unmount()
  })

  test('[B2a-i] narrow band: □ expands it to the run list; a run chosen there opens in the band, no panel opens', async ($, on) => {
    const { openArgs } = await engine($, on)
    const b = await band($, 40)
    await b.press({ key: 'pane-min' })
    expect(await listed(b)).toBe(true)
    expect(await inFlow(b)).toBe(false)
    const before = openArgs.length
    await b.press({ key: 'wf-toolu_1' })
    expect(await inFlow(b)).toBe(true)
    expect(await has(b, 'agent-a1')).toBe(true)
    expect(chartOpens(openArgs.slice(before))).toEqual([])
    await b.unmount()
  })

  test('[B2a-ii] wide band: a run chosen in the list opens in the panel (focused, workflow mode); the band stays on its list', async ($, on) => {
    const { openArgs } = await engine($, on)
    const b = await band($, 120)
    await b.press({ key: 'pane-min' })
    const before = openArgs.length
    await b.press({ key: 'wf-toolu_1' })
    expect(chartOpens(openArgs.slice(before)).map((x: any) => x.focus)).toEqual([true])
    expect(await listed(b)).toBe(true)
    expect(await inFlow(b)).toBe(false)
    await b.unmount()
    const wp = await rightPane($)
    expect(await inFlow(wp)).toBe(true)
    expect(await has(wp, 'agent-a1')).toBe(true)
    await wp.unmount()
  })

  test('[B2a] a wide band never goes to workflow view, even with a narrow band\'s stored workflow mode', async ($, on) => {
    await engine($, on)
    const narrow = await band($, 40)
    await narrow.press({ key: 'pane-min' })
    await narrow.press({ key: 'wf-toolu_1' })
    expect(await inFlow(narrow)).toBe(true)
    await narrow.unmount()
    const wide = await band($, 120)
    expect(await inFlow(wide)).toBe(false)
    expect(await listed(wide)).toBe(true)
    await wide.unmount()
  })

  test('[B2b] □ from the panel brings the band back in list mode only, never its workflow view', async ($, on) => {
    await engine($, on)
    // The band (narrow) is in its workflow view, then minimised.
    let b = await band($, 40)
    await b.press({ key: 'pane-min' })
    await b.press({ key: 'wf-toolu_1' })
    expect(await inFlow(b)).toBe(true)
    await b.press({ key: 'pane-full' }) // workflow mode: the panel opens on the run at once
    await b.press({ key: 'pane-min' })
    expect(await inFlow(b)).toBe(false)
    await b.unmount()
    const wp = await rightPane($)
    expect(await labelOf(wp, 'pane-min')).toBe('□')
    await wp.press({ key: 'pane-min' })
    await wp.unmount()
    b = await band($, 40)
    expect(await listed(b)).toBe(true)
    expect(await inFlow(b)).toBe(false)
    await b.unmount()
  })

  test('[B2] pure: bandPick is the band\'s own flow when narrow, the panel\'s when wide; bandToList is list mode at normal size; bandModeOf lists a wide band only', () => {
    const v = { ...VIEW0, size: 'minimised' as const, bandMode: 'workflow' as const }
    expect(bandPick(VIEW0, 'narrow', 'w2', false)).toEqual({ view: { ...VIEW0, bandMode: 'workflow', selected: 'w2' }, openPane: false })
    expect(bandPick(VIEW0, 'wide', 'w2', false)).toEqual({ view: { ...VIEW0, paneMode: 'workflow', pane: 'w2' }, openPane: true })
    expect(bandPick(VIEW0, 'wide', 'w2', true).view).toMatchObject({ paneMode: 'workflow', selected: 'w2' })
    expect(bandToList(v)).toMatchObject({ size: 'normal', prev: [], bandMode: 'list' })
    expect(bandToList({ ...VIEW0, band: 'minimised', bandMode: 'workflow' }, true)).toMatchObject({ band: 'normal', bandMode: 'list', size: 'normal' })
    expect(bandModeOf({ ...VIEW0, bandMode: 'workflow' }, 'wide')).toBe('list')
    expect(bandModeOf({ ...VIEW0, bandMode: 'workflow' }, 'narrow')).toBe('workflow')
    expect(bandModeOf(VIEW0, 'narrow')).toBe('list')
    expect(paneModeOf({ ...VIEW0, paneMode: 'workflow' })).toBe('workflow')
    expect(paneModeOf(VIEW0)).toBe('list')
    expect(bandMinimise({ ...VIEW0, paneMode: 'workflow', bandMode: 'workflow' })).toEqual({ ...VIEW0, paneMode: 'workflow', bandMode: 'workflow', size: 'minimised', prev: [] })
    expect(dockedBandMinimise(VIEW0)).toMatchObject({ band: 'minimised' })
  })
})

// ---------------------------------------------------------------------------------------------------------------
// B3 full screen
// ---------------------------------------------------------------------------------------------------------------
describe('step 43 B3: full screen from the band opens the panel at once', () => {
  test('[B3a-i] the minimised band: the panel opens focused in list mode; the band is unchanged', async ($, on) => {
    const { openArgs } = await engine($, on)
    const before = openArgs.length
    const b = await band($)
    await b.press({ key: 'pane-full' })
    expect(await labelOf(b, 'pane-min')).toBe('□')
    await b.unmount()
    expect(chartOpens(openArgs.slice(before)).map((x: any) => [x.focus, x.rows ?? null])).toEqual([[true, null]])
    const wp = await rightPane($)
    expect(await inFlow(wp)).toBe(false)
    expect(await has(wp, 'wf-toolu_1')).toBe(true)
    await wp.unmount()
  })

  test('[B3a-ii] the band in list mode: the panel opens in list mode; the band keeps its list', async ($, on) => {
    await engine($, on)
    const b = await band($)
    await b.press({ key: 'pane-min' })
    await b.press({ key: 'pane-full' })
    expect(await listed(b)).toBe(true)
    await b.unmount()
    const wp = await rightPane($)
    expect(await inFlow(wp)).toBe(false)
    expect(await has(wp, 'wf-toolu_1')).toBe(true)
    await wp.unmount()
  })

  test('[B3a-iii] the band in workflow mode: the panel opens in workflow mode on the band\'s run; the band stays in its workflow', async ($, on) => {
    const { openArgs } = await engine($, on, { files: { 'docs/handoffs/B/run.md': RUN_B } })
    await secondFlow($)
    const b = await band($, 40)
    await b.press({ key: 'pane-min' })
    await b.press({ key: 'wf-toolu_1' }) // the older run, not the latest
    const before = openArgs.length
    await b.press({ key: 'pane-full' })
    expect(await inFlow(b)).toBe(true)
    await b.unmount()
    expect(chartOpens(openArgs.slice(before)).map((x: any) => x.focus)).toEqual([true])
    const wp = await rightPane($)
    expect(await inFlow(wp)).toBe(true)
    expect(await has(wp, 'toolu_1:agent-a1')).toBe(true)
    expect(await has(wp, 'toolu_2:agent-a2')).toBe(false)
    await wp.unmount()
  })

  test('[B3b] the panel beside the band has no full-screen button, and neither has the docked panel on its title row', async ($, on) => {
    await engine($, on)
    const b = await band($)
    await b.press({ key: 'pane-full' })
    await b.unmount()
    const side = await rightPane($)
    expect(await has(side, 'pane-full')).toBe(false)
    expect(await has(side, 'pane-place')).toBe(true)
    await side.unmount()
  })

  test('[B3] pure: paneFromBand is list mode from a minimised or listing band, else workflow mode on the band\'s run', () => {
    const w = { ...VIEW0, bandMode: 'workflow' as const, selected: 'w4' }
    expect(paneFromBand({ ...w, size: 'minimised' }, 'narrow', false)).toMatchObject({ paneMode: 'list' })
    expect(paneFromBand({ ...VIEW0, selected: 'w4' }, 'narrow', false)).toMatchObject({ paneMode: 'list' })
    expect(paneFromBand(w, 'wide', false)).toMatchObject({ paneMode: 'list' })
    expect(paneFromBand(w, 'narrow', false)).toMatchObject({ paneMode: 'workflow', pane: 'w4' })
    expect(paneFromBand(w, 'narrow', true)).toMatchObject({ paneMode: 'workflow', selected: 'w4' })
    expect(paneFromBand({ ...w, band: 'minimised' }, 'narrow', true, 'minimised')).toMatchObject({ paneMode: 'list' })
    expect(paneOnRun(VIEW0, 'w5', false)).toMatchObject({ paneMode: 'workflow', pane: 'w5' })
    expect(paneToList({ ...VIEW0, paneMode: 'workflow' })).toMatchObject({ paneMode: 'list' })
  })
})

// ---------------------------------------------------------------------------------------------------------------
// B4 restore
// ---------------------------------------------------------------------------------------------------------------
describe('step 43 B4: restore', () => {
  test('[B4a-i] from the band in workflow mode: back to the run list', async ($, on) => {
    await engine($, on)
    const b = await band($, 40)
    await b.press({ key: 'pane-min' })
    await b.press({ key: 'wf-toolu_1' })
    expect(await inFlow(b)).toBe(true)
    expect(await has(b, 'pane-restore')).toBe(true)
    await b.press({ key: 'pane-restore' })
    expect(await inFlow(b)).toBe(false)
    expect(await listed(b)).toBe(true)
    await b.unmount()
  })

  test('[B4a-ii] from the band otherwise: not applicable (no restore in list mode, none minimised)', async ($, on) => {
    await engine($, on)
    const b = await band($, 40)
    expect(await has(b, 'pane-restore')).toBe(false)
    await b.press({ key: 'pane-min' })
    expect(await has(b, 'pane-restore')).toBe(false)
    await b.unmount()
    const wide = await band($, 120)
    expect(await has(wide, 'pane-restore')).toBe(false)
    await wide.unmount()
  })

  /** The panel open beside a narrow band that is then closed with ×; `pick`: the panel's mode (a run chosen, or the list). */
  async function bandClosedScene($: any, on: any, pick: boolean) {
    const s = await engine($, on, { done: true })
    let b = await band($, 40)
    await b.press({ key: 'pane-min' })
    await b.press({ key: 'pane-full' }) // the panel opens (list mode)
    await b.press({ key: 'band-close' })
    await b.unmount()
    const wp = await rightPane($)
    if (pick) await wp.press({ key: 'wf-toolu_1' })
    return { ...s, wp }
  }

  test('[B4b-i] from the panel with the band closed (×), in workflow mode: the panel closes and the band is shown in workflow mode', async ($, on) => {
    const { closed, wp } = await bandClosedScene($, on, true)
    expect(await has(wp, 'pane-restore')).toBe(true)
    const before = closed.length
    await wp.press({ key: 'pane-restore' })
    await wp.unmount()
    expect(closed.slice(before)).toContain(CHART)
    const b = await band($, 40)
    expect(await inFlow(b)).toBe(true)
    expect(await has(b, 'agent-a1')).toBe(true)
    expect(await labelOf(b, 'pane-min')).toBe('–')
    await b.unmount()
  })

  test('[B4b-ii] from the panel with the band closed (×), in list mode: the panel closes and the band is shown in list mode', async ($, on) => {
    const { closed, wp } = await bandClosedScene($, on, false)
    const before = closed.length
    await wp.press({ key: 'pane-restore' })
    await wp.unmount()
    expect(closed.slice(before)).toContain(CHART)
    const b = await band($, 40)
    expect(await listed(b)).toBe(true)
    expect(await inFlow(b)).toBe(false)
    await b.unmount()
  })

  test('[B4c] from the panel with the band open: no restore, as it is now', async ($, on) => {
    await engine($, on)
    const b = await band($, 40)
    await b.press({ key: 'pane-min' })
    await b.press({ key: 'pane-full' })
    await b.unmount()
    const wp = await rightPane($)
    await wp.press({ key: 'wf-toolu_1' })
    expect(await has(wp, 'pane-restore')).toBe(false)
    await wp.unmount()
  })

  test('[B4b] a band not on screen counts as closed: no band draw within bandGoneMs (lens.json, here 1 s) shows the panel\'s restore', async ($, on) => {
    const { ticks } = await engine($, on, { files: lensJson({ panelOpenMode: 'tab', bandGoneMs: 1000 }) })
    const b = await band($, 40)
    await b.press({ key: 'pane-min' })
    await b.press({ key: 'pane-full' })
    await b.unmount() // the band's last draw
    let wp = await rightPane($)
    await wp.press({ key: 'wf-toolu_1' })
    expect(await has(wp, 'pane-restore')).toBe(false)
    await wp.unmount()
    await wait(1200)
    wp = await rightPane($)
    expect(await has(wp, 'pane-restore')).toBe(true)
    // The pane asked for a redraw tick, to ask again while the band is on screen.
    expect(ticks.length).toBeGreaterThan(0)
    await wp.unmount()
  })

  test('[B4b] a band drawn again keeps the panel\'s restore away: the band\'s draws are what "on screen" means', async ($, on) => {
    await engine($, on, { files: lensJson({ panelOpenMode: 'tab', bandGoneMs: 1000 }) })
    let b = await band($, 40)
    await b.press({ key: 'pane-min' })
    await b.press({ key: 'pane-full' })
    await b.unmount()
    await wait(1200)
    b = await band($, 40) // drawn again after the pause
    const wp = await rightPane($)
    expect(await has(wp, 'pane-restore')).toBe(false)
    await wp.unmount()
    await b.unmount()
  })

  test('[B4b] a VS Code panel too narrow for the pane: only × counts, never "not on screen"; wide enough, the band never drawn counts as not on screen', async ($, on) => {
    // The band is drawn on every surface of the session (desktop), but this pane is VS Code's.
    await engine($, on, { surface: 'terminal', surfaces: ['desktop'], files: lensJson({ panelOpenMode: 'tab', bandGoneMs: 1000 }) })
    const narrow = await rightPane($, 'vscode', 30)
    expect(await has(narrow, 'pane-place')).toBe(true)
    expect(await has(narrow, 'pane-restore')).toBe(false)
    await narrow.unmount()
    const wide = await rightPane($, 'vscode', 120)
    expect(await has(wide, 'pane-restore')).toBe(true)
    await wide.unmount()
  })

  test('[B4] pure: bandRestore, dockedRestore, bandFromPane and bandClosedOf', () => {
    expect(bandRestore({ ...VIEW0, bandMode: 'workflow' })).toMatchObject({ bandMode: 'list' })
    expect(bandFromPane({ ...VIEW0, size: 'minimised', prev: ['normal'], paneMode: 'workflow', pane: 'w8', selected: 'w1' })).toMatchObject({ size: 'normal', prev: [], bandMode: 'workflow', selected: 'w8' })
    expect(bandFromPane({ ...VIEW0, paneMode: 'list', pane: '', selected: 'w1' })).toMatchObject({ bandMode: 'list', selected: 'w1' })
    expect(dockedCanRestore({ ...VIEW0, paneMode: 'workflow' })).toBe(true)
    expect(dockedCanRestore(VIEW0)).toBe(false)
    expect(dockedRestore({ ...VIEW0, paneMode: 'workflow' })).toMatchObject({ paneMode: 'list' })
    expect(dockedRestore({ ...VIEW0, size: 'minimised', prev: ['normal'], paneMode: 'workflow' })).toMatchObject({ size: 'normal', paneMode: 'workflow' })
    // closed with ×, never drawn, drawn too long ago; drawn recently is open; the exemption (timeout false) leaves only ×
    expect(bandClosedOf(true, 100, 101, 10000)).toBe(true)
    expect(bandClosedOf(false, 0, 101, 10000)).toBe(true)
    expect(bandClosedOf(false, 100, 10101, 10000)).toBe(true)
    expect(bandClosedOf(false, 100, 10100, 10000)).toBe(false)
    expect(bandClosedOf(false, 0, 101, 10000, false)).toBe(false)
    expect(bandClosedOf(true, 0, 101, 10000, false)).toBe(true)
  })
})

// ---------------------------------------------------------------------------------------------------------------
// B5, B6 avatar and arrow clicks
// ---------------------------------------------------------------------------------------------------------------
describe('step 43 B5/B6: an avatar or an arrow follows the same rules', () => {
  const drillIn = lensJson({ panelOpenMode: 'drill-in' })

  test('[B5/B6 band narrow] drill-in: an avatar or an arrow pressed in the band opens inside the band; no panel opens', async ($, on) => {
    const { openArgs } = await engine($, on, { files: drillIn })
    const b = await band($, 40)
    await b.press({ key: 'pane-min' })
    await b.press({ key: 'wf-toolu_1' })
    const before = openArgs.length
    await b.press({ key: 'agent-a1' })
    expect(await has(b, 'drill-back')).toBe(true)
    await b.press({ key: 'drill-back' })
    expect(await has(b, 'drill-back')).toBe(false)
    await b.press({ key: 'edge-a1' })
    expect(await has(b, 'drill-back')).toBe(true)
    await b.unmount()
    expect(chartOpens(openArgs.slice(before))).toEqual([])
  })

  test('[B5/B6 panel] drill-in: an avatar pressed in the panel opens in the panel, not in the band', async ($, on) => {
    await engine($, on, { files: drillIn })
    const b = await band($, 40)
    await b.press({ key: 'pane-min' })
    await b.press({ key: 'pane-full' })
    const wp = await rightPane($)
    await wp.press({ key: 'wf-toolu_1' })
    await wp.press({ key: 'agent-a1' })
    expect(await has(wp, 'drill-back')).toBe(true)
    // The band is minimised and drew nothing drilled.
    expect(await has(b, 'drill-back')).toBe(false)
    await wp.press({ key: 'drill-back' })
    await wp.press({ key: 'edge-a1' })
    expect(await has(wp, 'drill-back')).toBe(true)
    await wp.unmount()
    await b.unmount()
  })

  test('[B5/B6 Panel Type Tab] an avatar or an arrow opens its own tab from the band and from the panel, whatever the width', async ($, on) => {
    const { opened } = await engine($, on)
    const b = await band($, 40)
    await b.press({ key: 'pane-min' })
    await b.press({ key: 'wf-toolu_1' })
    await b.press({ key: 'agent-a1' })
    await b.press({ key: 'edge-a1' })
    expect(opened).toContain(AGENT)
    expect(opened).toContain(EDGE)
    expect(await has(b, 'drill-back')).toBe(false)
    await b.unmount()
    const before = opened.length
    const wp = await rightPane($)
    await wp.press({ key: 'wf-toolu_1' })
    await wp.press({ key: 'agent-a1' })
    expect(opened.slice(before)).toContain(AGENT)
    expect(await has(wp, 'drill-back')).toBe(false)
    await wp.unmount()
    const ag = await tab($, AGENT)
    expect(await has(ag, 'pane-close')).toBe(true)
    await ag.unmount()
  })

  test('[B5/B6] the Panel Type switch decides for the session: Drill in, then Tab', async ($, on) => {
    const { opened } = await engine($, on, { files: drillIn })
    const b = await band($, 40)
    await b.press({ key: 'pane-min' })
    await b.press({ key: 'wf-toolu_1' })
    await b.press({ key: 'panel-tab' })
    await b.press({ key: 'agent-a1' })
    expect(opened).toContain(AGENT)
    expect(await has(b, 'drill-back')).toBe(false)
    await b.unmount()
  })

  test('[B5/B6 pure] drillTargetOf: the band narrow drills in the band, wide in the panel on the band\'s run; the panel in the panel; drillPlaceOf splits it', () => {
    expect(drillTargetOf('band', 'narrow', 'w1')).toBe('band')
    expect(drillTargetOf('band', 'wide', 'w1')).toBe('band-wide:w1')
    expect(drillTargetOf('pane', 'narrow', 'w1')).toBe('pane')
    expect(drillTargetOf('pane', 'wide', 'w1')).toBe('pane')
    expect(drillPlaceOf('band')).toEqual({ key: 'band', openPane: null })
    expect(drillPlaceOf('card:toolu_2')).toEqual({ key: 'card:toolu_2', openPane: null })
    expect(drillPlaceOf('band-wide:w1')).toEqual({ key: 'pane', openPane: 'w1' })
  })
})
