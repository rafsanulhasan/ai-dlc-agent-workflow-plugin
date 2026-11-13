import { describe, expect, test } from 'claude-code/testing'

// Step 43, live findings round 1, area layout: 2b.ii (a step heading in full screen shows restore; only the newest
// step is open), 2c (no Steps row, no fs-step-* keys; one chart per step whatever the folder's spelling), 2d (a chart
// that is wider than its pane is scaled by one factor, never enlarged; the step box has no margin in full screen).

const PLUGIN = 'ai-dlc-lens'
const CHART_PANE = 'ai-dlc-lens-chart'
const RUN = 'docs/handoffs/R'
const RUN_MD = `---\nrun: R\nstatus: active\n---\n\n# Run: R — the layout run\n\n## Stages\n| Step | Stage | Agent | Status |\n|---|---|---|---|\n| 17 | build | agent-manager | done |\n| 18 | test | agent-manager | in-progress |\n`
const ROSTER = '| Agent | Name |\n|---|---|\n| orchestrator | Scott Hanselman |\n| agent-manager | Boris Cherny |\n'
const def = (model: string, persona: string) => `---\nname: x\nmodel: ${model}\n---\n\nPersona name: **${persona}** — a nod.\n`
const BASE: Record<string, string> = {
  '.claude/agent-memory/ai-dlc-orchestrator/project_team-roster.md': ROSTER,
  'plugins/claude/ai-dlc/agents/orchestrator.md': def('opus', 'Scott Hanselman'),
  'plugins/claude/ai-dlc/agents/agent-manager.md': def('sonnet', 'Boris Cherny'),
  [`${RUN}/run.md`]: RUN_MD,
}
const rec = (code: string) => [`${code}-orchestrator-to-agent-manager.handoff.md`, `${code}-agent-manager-to-orchestrator.handback.md`]
const entry = (name: string) => ({ name, kind: 'file', size: 1, mtimeMs: 1 })

/** The engine's edges, as the other lens tests stub them. `list`: what `fs.list` answers per folder path (as asked, case and slashes kept); null: that path cannot be listed. */
function engine(on: any, opts: { extra?: Record<string, string>; list?: (path: string) => string[] | null } = {}) {
  const files: Record<string, string> = { ...BASE, ...(opts.extra ?? {}) }
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
    const hit = Object.keys(files).find(k => path.toLowerCase() === k.toLowerCase() || path.toLowerCase().endsWith('/' + k.toLowerCase()))
    if (hit === undefined) throw new Error(`ENOENT ${path}`)
    return { value: files[hit] }
  })
  on('fs.write', () => ({ value: undefined }))
  on('fs.list', (_: unknown, e: any) => {
    const path = String(e.path ?? e)
    const names = opts.list === undefined ? [...rec('17'), ...rec('18')] : opts.list(path)
    if (names === null) throw new Error(`ENOENT ${path}`)
    return { value: names.map(entry) }
  })
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('ui.toast', () => ({ value: undefined }))
  on('agent.list', () => ({ value: [] }))
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

/** Agent `a<n>` (call `toolu_<n>`) is spawned into the run folder spelled `dir`, at step `code`; it keeps running. */
async function spawn($: any, n: number, code: string, dir = RUN) {
  const prompt = `Your handoff record is ${dir}/${code}-orchestrator-to-agent-manager.handoff.md (root x).\nDo it.`
  await $.tool.call({ tool: 'Agent', subagent_type: 'ai-dlc:agent-manager', description: `d${n}`, prompt, tool_use_id: `toolu_${n}` })
  await $.agent.spawn({ tool_use_id: `toolu_${n}`, prompt, description: `d${n}`, subagentType: 'ai-dlc:agent-manager', provider: { plugin: 'ai-dlc', tier: 'user' }, parentModel: 'claude-opus-5-5', background: true, fork: false })
}
const begin = async ($: any, on: any, opts: Parameters<typeof engine>[1] = {}) => {
  engine(on, { ...opts, extra: { '.ai-dlc/lens.json': JSON.stringify({ panelOpenMode: 'tab' }), ...(opts.extra ?? {}) } })
  await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
}

const mountPane = ($: any, bodyColumns = 120, columns = 200) =>
  $.ui.mount({ plugin: PLUGIN, surface: 'vscode', component: 'Pane', requestId: CHART_PANE, viewport: { columns, rows: 60 }, props: { title: CHART_PANE, isFocused: false, bodyColumns, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} } })
/** The docked view in workflow mode (it opens so on the newest run in progress; from a list it is entered through the first run's row). */
async function workflowView($: any, bodyColumns = 120) {
  const ui = await mountPane($, bodyColumns)
  if ((await ui.find({ type: 'Button', key: 'runs-back' })) === undefined) {
    const row = ((await ui.findAll({ type: 'Button' })) as any[]).find((b: any) => /^wf-toolu_\d+$/.test(String(b.key)))
    await ui.press({ key: String(row.key) })
  }
  return ui
}
const keyOf = (x: any) => String(x?.key ?? x?.props?.key ?? '')
const buttons = async (ui: any): Promise<any[]> => (await ui.findAll({ type: 'Button' })) as any[]
const stepButtons = async (ui: any, which: 'min' | 'full' | 'restore') => (await buttons(ui)).filter(b => new RegExp(`step-${which}$`).test(keyOf(b)))
const charts = async (ui: any): Promise<any[]> => ((await ui.findAll({ type: 'Svg' })) as any[]).filter(x => /^(Step chart|Full screen chart) /.test(String(x?.props?.alt ?? '')))
const chartKeys = async (ui: any) => (await charts(ui)).map(x => /^(?:Step chart|Full screen chart) (\S+):/.exec(String(x.props.alt))?.[1] ?? '')
/** Presses every closed step accordion (□) open. */
const openSteps = async (ui: any) => {
  for (const b of await stepButtons(ui, 'min')) if (String(b.text) === '□') await ui.press({ key: keyOf(b) })
}
/** The natural size an Svg source declares. */
const natural = (src: string) => {
  const m = /<svg[^>]* width="(\d+(?:\.\d+)?)" height="(\d+(?:\.\d+)?)"/.exec(src)
  return { w: Number(m?.[1]), h: Number(m?.[2]) }
}

describe('[2b.ii] step accordions: restore in full screen, only the newest step open', () => {
  test('[2b.ii] a normal heading keeps – (or □) then ⤢ and no restore; the newest step is open (–) and the older one collapsed (□), one chart', async ($, on) => {
    await begin($, on)
    await spawn($, 1, '17')
    await spawn($, 2, '18')
    const ui = await workflowView($)
    const order = (await buttons(ui)).map(keyOf).filter(k => /step-(min|full|restore)$/.test(k))
    expect(order.length).toBe(4)
    // Each step: min, then full (⤢); the newest (18) first.
    expect(order[0]).toMatch(/step-min$/)
    expect(order[1]).toMatch(/step-full$/)
    expect(order[2]).toMatch(/step-min$/)
    expect(order[3]).toMatch(/step-full$/)
    expect((await stepButtons(ui, 'restore')).length).toBe(0)
    expect((await stepButtons(ui, 'min')).map(b => String(b.text))).toEqual(['–', '□'])
    expect((await stepButtons(ui, 'full')).map(b => String(b.text))).toEqual(['⤢', '⤢'])
    expect(await chartKeys(ui)).toEqual(['18'])
    // Opening the collapsed one (a press on its □) draws its chart too.
    await ui.press({ key: keyOf((await stepButtons(ui, 'min'))[1]) })
    expect(await chartKeys(ui)).toEqual(['18', '17'])
    await ui.unmount()
  })

  test('[2b.ii] ⤢ on a step: its heading shows ⤡ (step-restore) in place of – and ⤢; ⤡ brings the normal headings back', async ($, on) => {
    await begin($, on)
    await spawn($, 1, '17')
    await spawn($, 2, '18')
    const ui = await workflowView($)
    await ui.press({ key: keyOf((await stepButtons(ui, 'full'))[1]) })
    expect(await chartKeys(ui)).toEqual(['17'])
    const restore = await stepButtons(ui, 'restore')
    expect(restore.length).toBe(1)
    expect(String(restore[0].text)).toBe('⤡')
    expect((await stepButtons(ui, 'min')).length).toBe(0)
    expect((await stepButtons(ui, 'full')).length).toBe(0)
    await ui.press({ key: keyOf(restore[0]) })
    expect((await stepButtons(ui, 'restore')).length).toBe(0)
    expect((await stepButtons(ui, 'min')).length).toBe(2)
    expect((await stepButtons(ui, 'full')).length).toBe(2)
    await ui.unmount()
  })
})

describe('[2c] no numbered Steps row; one chart per step whatever the folder\'s spelling', () => {
  test('[2c] full screen has no "Steps:" row and no fs-step-* key (only the step shown)', async ($, on) => {
    await begin($, on)
    await spawn($, 1, '17')
    await spawn($, 2, '18')
    const ui = await workflowView($)
    await ui.press({ key: keyOf((await stepButtons(ui, 'full'))[0]) })
    expect(await chartKeys(ui)).toEqual(['18'])
    expect((await buttons(ui)).filter(b => /^fs-step-/.test(keyOf(b)))).toEqual([])
    const texts = ((await ui.findAll({ type: 'Text' })) as any[]).map(x => String(x.text ?? '').trim())
    expect(texts.filter(t => /^Steps:?$/.test(t))).toEqual([])
    expect(((await ui.findAll({})) as any[]).some(x => /^fs-step-/.test(keyOf(x)))).toBe(false)
    await ui.unmount()
  })

  test('[2c] one run folder spelled four ways (/, \\, ./, case), all listing the same records: one chart per step, no duplicate numbers', async ($, on) => {
    await begin($, on)
    await spawn($, 1, '17', 'docs/handoffs/R')
    await spawn($, 2, '18', 'docs\\handoffs\\R')
    await spawn($, 3, '17', './docs/handoffs/R')
    await spawn($, 4, '18', 'Docs/Handoffs/r')
    const ui = await workflowView($)
    await openSteps(ui)
    const keys = await chartKeys(ui)
    expect([...keys].sort()).toEqual(['17', '18'])
    expect(new Set(keys).size).toBe(keys.length)
    const headings = ((await ui.findAll({ type: 'Text' })) as any[]).map(x => String(x.text ?? '').trim()).filter(t => /^Step \d+ ·/.test(t))
    expect(new Set(headings).size).toBe(headings.length)
    await ui.unmount()
  })

  test('[2c] the spelling with records wins: spawned first by a spelling (other case) that cannot be listed, a step only on disk is still drawn once', async ($, on) => {
    const onDisk = [...rec('17'), ...rec('18'), ...rec('19')]
    // The engine hands fs.list the path resolved on this OS, its case kept: only the lower-case spelling lists.
    await begin($, on, { list: p => (/docs[\\/]handoffs[\\/]R[\\/]?$/.test(p) ? onDisk : null) })
    await spawn($, 1, '17', 'Docs/Handoffs/R')
    await spawn($, 2, '18', 'DOCS\\handoffs\\r')
    await spawn($, 3, '17', 'docs/handoffs/R')
    const ui = await workflowView($)
    await openSteps(ui)
    expect(await chartKeys(ui)).toEqual(['19', '18', '17'])
    await ui.unmount()
  })
})

describe('[2d] a chart is fitted to its pane: one factor on both sides, never enlarged; no margin around the step box in full screen', () => {
  /** Nine agents under root 20 (20.1 .. 20.9): the step-20 chart is eight columns wide, 960 px at the default chartColumnPx. */
  const wideRun = async ($: any, on: any) => {
    await begin($, on, { list: () => [...rec('20.1')] })
    for (let i = 1; i <= 9; i++) await spawn($, i, `20.${i}`)
  }

  test('[2d] a pane narrower than the chart: Svg width <= columns x cellPx, both sides scaled by one factor (the natural aspect), no blank margin', async ($, on) => {
    await wideRun($, on)
    const columns = 60 // x cellPx 8 = 480 px < 960 px
    const ui = await workflowView($, columns)
    const svg = (await charts(ui))[0]
    expect(svg).toBeDefined()
    const nat = natural(String(svg.props.source))
    expect(nat.w).toBeGreaterThan(columns * 8)
    const w = Number(svg.props.width)
    const h = Number(svg.props.height)
    expect(w).toBeLessThanOrEqual(columns * 8)
    expect(w).toBeGreaterThan(columns * 8 * 0.9) // fitted to the pane, not shrunk to a sliver
    // One factor for both sides: the declared height is the natural height times the width's factor (rounding aside).
    expect(Math.abs(h - nat.h * (w / nat.w))).toBeLessThanOrEqual(1)
    expect(Math.abs(w / h - nat.w / nat.h)).toBeLessThan(0.02)
    await ui.unmount()
  })

  test('[2d] the narrower the pane, the smaller the chart; a pane wider than the chart leaves it at its natural size', async ($, on) => {
    await wideRun($, on)
    const narrow = await workflowView($, 40)
    const small = (await charts(narrow))[0]!
    const nat = natural(String(small.props.source))
    expect(Number(small.props.width)).toBeLessThanOrEqual(40 * 8)
    await narrow.unmount()
    const roomy = await workflowView($, 400) // 3200 px
    const big = (await charts(roomy))[0]!
    expect(Number(big.props.width)).toBe(nat.w)
    expect(Number(big.props.height)).toBe(nat.h)
    await roomy.unmount()
  })

  test('[2d] a small chart is not enlarged beyond its natural size', async ($, on) => {
    await begin($, on)
    await spawn($, 1, '18')
    const ui = await workflowView($, 120)
    const svg = (await charts(ui))[0]!
    const nat = natural(String(svg.props.source))
    expect(nat.w).toBeLessThan(120 * 8)
    expect(Number(svg.props.width)).toBe(nat.w)
    expect(Number(svg.props.height)).toBe(nat.h)
    await ui.unmount()
  })

  test('[2d] full screen: the step box has no margin (normal headings keep their top margin)', async ($, on) => {
    await begin($, on)
    await spawn($, 1, '17')
    await spawn($, 2, '18')
    const ui = await workflowView($)
    const stepBoxes = async () => ((await ui.findAll({ type: 'Box' })) as any[]).filter(b => b?.props?.width === '100%' && b?.props?.alignItems === 'center' && b?.props?.flexDirection === 'column')
    const normal = await stepBoxes()
    expect(normal.some(b => b.props.marginTop === 1)).toBe(true)
    await ui.press({ key: keyOf((await stepButtons(ui, 'full'))[0]) })
    const fs = await stepBoxes()
    expect(fs.length).toBeGreaterThan(0)
    expect(fs.some(b => b.props.marginTop === 1)).toBe(false)
    expect(fs.every(b => !b.props.marginTop && !b.props.marginBottom)).toBe(true)
    await ui.unmount()
  })
})
