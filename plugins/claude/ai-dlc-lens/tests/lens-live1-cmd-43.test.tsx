import { describe, expect, test } from 'claude-code/testing'
import { VIEW0, bandLineOf } from '../hooks/lens'

// Step 43, live findings round 1 (43-live-findings-1.md; the human's answers), the /ai-dlc:lens command and the VS Code
// surface: 2a (a narrow panel: the pane inline, minimised, up to 3 runs), 2b (a wide panel: the docked workflow pane and
// the Run List tab), 2b.i (the minimised line's order), 3 (Cache Lab starts collapsed). The engine is stubbed at its
// edges as in tests/lens-view-43.test.tsx; each test is tagged with the finding's number.

const PLUGIN = 'ai-dlc-lens'
const CHART = 'ai-dlc-lens-chart'
const RUNS = 'ai-dlc-lens-runs'
const AGENT = 'ai-dlc-lens-agent'
const LENS_VIEW = { plugin: PLUGIN, key: 'view' } as const
const LENS_OPEN = { plugin: PLUGIN, key: 'cardOpen' } as const

const RECORD = 'docs/handoffs/R/17-orchestrator-to-agent-manager.handoff.md'
const BASE_FILES: Record<string, string> = { [RECORD]: 'HANDOFF BODY' }
const RUN_A =
  '---\nrun: A\nstatus: active\n---\n\n# Run: run A\n\n## Stages\n| Step | Stage | Agent | Status |\n|---|---|---|---|\n| 1 | research | agent-manager | done |\n| 2 | build | agent-manager | in-progress |\n'

/** Puts a stored value in front of one of the lens atoms (set by `engine`). */
let ticks: (() => void)[] = []
const fireTicks = async () => {
  const t = ticks.splice(0)
  for (const f of t) f()
  for (let i = 0; i < 100; i++) await Promise.resolve()
}
/**
 * The kit's render-purity guard (the host denies a state write made while `ui.render` is dispatched, live finding 3):
 * `draw` brackets one draw, and any write checked between its start and the settling of its promise, async
 * continuations included, is recorded in `writes` and refused (it throws). `tick` and `agents` are the lens's own
 * timers' writes (clock.every: the blink, the agent list poll), which run beside a draw, not in it.
 */
class RenderGuard {
  writes: string[] = []
  private span = 0
  constructor(private readonly timerKeys: ReadonlySet<string> = new Set(['tick', 'agents'])) {}
  async draw<T>(fn: () => Promise<T>): Promise<T> {
    this.span++
    try {
      return await fn()
    } finally {
      this.span--
    }
  }
  check(plugin: unknown, key: unknown) {
    if (this.span > 0 && !this.timerKeys.has(String(key))) {
      this.writes.push(`${String(plugin)}:${String(key)}`)
      throw new Error(`state.set: denied: it was made while ui.render is being dispatched (${String(key)})`)
    }
  }
}
let guard = new RenderGuard()
let seedState: (key: string, value: unknown) => void = () => {}

type Opts = { surface?: 'terminal' | 'vscode'; files?: Record<string, string>; done?: string[] }

async function engine($: any, on: any, o: Opts = {}) {
  const surface = o.surface ?? 'vscode'
  const files: Record<string, string> = { ...BASE_FILES, ...(o.files ?? {}) }
  if (!('.ai-dlc/lens.json' in files)) files['.ai-dlc/lens.json'] = JSON.stringify({ panelOpenMode: 'tab' })
  const openArgs: any[] = []
  const closed: string[] = []
  const openNow = new Set<string>()
  const done = new Set<string>(o.done ?? [])
  on('session.surfaces', () => ({ value: [surface] }))
  on('ui.render', ($s: any, e: any) => {
    const { Text } = $s.ui.resolve(e)
    return <Text>NATIVE ROW</Text>
  })
  on('clock.every', () => ({ value: undefined }))
  // `clock.after` waits until the test fires it (`fireTicks`): the command's deferred open (scheduleCommandOpen) and the band ping.
  ticks = []
  // `after(0)` runs its callback at once, as the real host did (inside the draw that asked for it); a longer wait waits for the test.
  on('clock.after', (_: unknown, e: any) => (e?.ms === 0 ? { value: undefined } : (new Promise(r => ticks.push(() => r({ value: undefined }))) as never)))
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
    return { value: [{ name: '17-orchestrator-to-agent-manager.handoff.md', kind: 'file', size: 1, mtimeMs: listed }] }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('agent.list', () => ({ value: [1, 2, 3, 4, 5].map(n => ({ id: `a${n}`, description: 'build', type: 'ai-dlc:agent-manager', status: done.has(`a${n}`) ? 'completed' : 'running' })) }))
  on('ui.open', (_: unknown, e: any) => {
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
  on('classic.UserPromptSubmit', () => ({}))
  on('classic.SessionStart', () => ({}))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  // The lens's atoms are the engine's state; `seed` puts a stored value in front of one until the lens writes it (an earlier session's or load's state).
  const seeds = new Map<string, unknown>()
  on('state.set', (_: unknown, e: any, next: any) => {
    guard.check(e.plugin, e.key)
    return e.plugin === PLUGIN && seeds.delete(String(e.key)), next(e)
  })
  on('state.get', (_: unknown, e: any, next: any) => (e.plugin === PLUGIN && seeds.has(String(e.key)) ? { value: { value: seeds.get(String(e.key)), version: 1 } } : next(e)))
  seedState = (key: string, value: unknown) => void seeds.set(key, value)
  await $.session.start({ cwd: '/', surface, isInteractive: true })
  await spawn($, 1, 'R', '17')
  for (const id of done) await finish($, id)
  return { openArgs, closed, openNow, files }
}

async function spawn($: any, n: number, run: string, code: string, subagentType = 'ai-dlc:agent-manager') {
  await new Promise(r => (globalThis as any).setTimeout(r, 3))
  const prompt = `Your handoff record is docs/handoffs/${run}/${code}-orchestrator-to-agent-manager.handoff.md (root x).\nDo it.`
  await $.turn.start({ text: `request ${n}`, turnId: `m${n}` })
  await $.tool.call({ tool: 'Agent', subagent_type: subagentType, description: `d${n}`, prompt, tool_use_id: `toolu_${n}` })
  await $.agent.spawn({ tool_use_id: `toolu_${n}`, prompt, description: `d${n}`, subagentType, provider: { plugin: 'ai-dlc', tier: 'user' }, parentModel: 'claude-opus-5-5', background: true, fork: false })
}
async function finish($: any, agentId: string) {
  await $.turn.complete({ reason: 'answer', answer: 'done', durationMs: 1, isAborted: false, turnId: 't', agentId, usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'claude-sonnet-5-5' } })
}
const wait = (ms: number) => new Promise(r => (globalThis as any).setTimeout(r, ms))
const settle = async () => {
  for (let i = 0; i < 100; i++) await Promise.resolve()
  await wait(30)
  expect(guard.writes).toEqual([])
}
/** Draws a docked lens pane at `columns` body columns and drops it: the command reads the seat from the last pane drawn. */
const seatWide = async ($: any, columns: number) => {
  const p = await pane($, CHART, 'dock', columns)
  await p.unmount()
}

/** A Pane of the lens at `placement` (the surface's seat), on VS Code. */
const pane = async ($: any, id: string, placement: 'dock' | 'inline', bodyColumns = 120) => {
  // Let the writes the earlier events left running finish first, so a write inside the span is the draw's own.
  for (let i = 0; i < 100; i++) await Promise.resolve()
  await wait(40)
  return guard.draw<any>(() => paneMount($, id, placement, bodyColumns))
}
const paneMount = ($: any, id: string, placement: 'dock' | 'inline', bodyColumns: number) =>
  $.ui.mount({ plugin: PLUGIN, surface: 'vscode', component: 'Pane', requestId: id, props: { title: id, isFocused: false, bodyColumns, placement, scroll: { offset: 0, bodyRows: 80 }, view: {} }, viewport: { columns: 200, rows: 50 } } as any)
const keysOf = async (ui: any): Promise<string[]> => ((await ui.findAll({ type: 'Button' })) as any[]).map((b: any) => String(b.key))
const has = async (ui: any, key: string) => (await ui.find({ type: 'Button', key })) !== undefined
const labelOf = async (ui: any, key: string): Promise<string | undefined> => {
  const b: any = await ui.find({ type: 'Button', key })
  return b === undefined ? undefined : String(b.text ?? b.props?.label)
}
const lensCmd = async ($: any) => String(((await ($.command.run as any)({ command: 'ai-dlc:lens', args: '' })) as any)?.text)
const texts = async (ui: any): Promise<string[]> => ((await ui.findAll({})) as any[]).filter(x => x.type === 'Text').map(x => String(x.text ?? ''))
// Several spawns and settles per test: the default 5 s is not enough when the whole suite runs under load.
const HEAVY = { timeoutMs: 20000 }
const fullScreenView = () => ({ ...VIEW0, size: 'fullscreen', prev: ['normal'] })

// ---------------------------------------------------------------------------------------------------------------
describe('step 43 live round 1, 2a: /ai-dlc:lens in a narrow VS Code panel (the pane inline)', () => {
  test('[live1-2a] a stored full screen is not brought back: the pane is the minimised line with up to 3 runs, no "< Runs", no full-screen note', HEAVY, async ($, on) => {
    await engine($, on)
    await spawn($, 2, 'B', '1')
    await spawn($, 3, 'C', '1')
    await spawn($, 4, 'D', '1')
    seedState(LENS_VIEW.key, fullScreenView())
    await lensCmd($)
    const ui = await pane($, CHART, 'inline')
    await settle()
    const keys = await keysOf(ui)
    expect(keys).not.toContain('runs-back')
    expect((await texts(ui)).some(t => /Full screen/i.test(t))).toBe(false)
    // four runs exist; the minimised line names the top 3
    expect(await ui.find({ key: 'band-line-0' })).toBeDefined()
    expect(await ui.find({ key: 'band-line-1' })).toBeDefined()
    expect(await ui.find({ key: 'band-line-2' })).toBeDefined()
    expect(await ui.find({ key: 'band-line-3' })).toBe(undefined)
    expect(keys.some(k => /^fs-step-/.test(k))).toBe(false)
    await ui.unmount()
  })

  test('[live1-2a] a stored normal size does not matter either: the command decides, the pane is still minimised', HEAVY, async ($, on) => {
    await engine($, on)
    seedState(LENS_VIEW.key, { ...VIEW0, size: 'normal' })
    await lensCmd($)
    const ui = await pane($, CHART, 'inline')
    await settle()
    expect(await has(ui, 'runs-back')).toBe(false)
    expect(await ui.find({ key: 'band-line-0' })).toBeDefined()
    await ui.unmount()
  })
})

// ---------------------------------------------------------------------------------------------------------------
describe('step 43 live round 1, 2b: /ai-dlc:lens in a wide VS Code panel (the pane docked)', () => {
  test('[live1-2b] the workflow pane is on the newest run in progress, normal size; the Run List tab opens first without focus, then the workflow tab with focus', HEAVY, async ($, on) => {
    const { openArgs } = await engine($, on, { files: { 'docs/handoffs/A/run.md': RUN_A } })
    await spawn($, 2, 'A', '2')
    seedState(LENS_VIEW.key, fullScreenView())
    const before = openArgs.length
    await seatWide($, 120)
    await lensCmd($)
    const wp = await pane($, CHART, 'dock')
    await fireTicks()
    await settle()
    expect(await has(wp, 'toolu_2:wf-thinking')).toBe(true)
    expect(await has(wp, 'toolu_1:wf-thinking')).toBe(false)
    // one step back is the run list
    expect(await has(wp, 'runs-back')).toBe(true)
    const opens = openArgs.slice(before)
    const runsAt = opens.findIndex((x: any) => x.id === RUNS)
    expect(runsAt).toBeGreaterThanOrEqual(0)
    expect(opens[runsAt].focus).not.toBe(true)
    const lastChart = opens.map((x: any, i: number) => (x.id === CHART ? i : -1)).filter(i => i >= 0).pop()!
    expect(lastChart).toBeGreaterThan(runsAt)
    expect(opens[lastChart].focus).toBe(true)
    for (const x of opens.filter((x: any) => x.id === CHART)) {
      expect(x.rows).toBeUndefined()
      expect(x.columns).toBeUndefined()
    }
    await wp.unmount()
  })

  test('[live1-2b] none in progress: the workflow pane is on the newest run', HEAVY, async ($, on) => {
    await engine($, on)
    await spawn($, 2, 'B', '1')
    await finish($, 'a1')
    await finish($, 'a2')
    await seatWide($, 120)
    await lensCmd($)
    const wp = await pane($, CHART, 'dock')
    await fireTicks()
    await settle()
    expect(await has(wp, 'runs-back')).toBe(true)
    expect(await has(wp, 'toolu_1:wf-thinking')).toBe(false)
    await wp.unmount()
  })

  test('[live1-2b] the Run List tab: wf-<w> rows newest first, runs-close; a press on a row opens the workflow tab on that run', HEAVY, async ($, on) => {
    const { openArgs, closed } = await engine($, on)
    await spawn($, 2, 'B', '1')
    await spawn($, 3, 'C', '1')
    await seatWide($, 120)
    await lensCmd($)
    const wp = await pane($, CHART, 'dock')
    await fireTicks()
    await settle()
    await wp.unmount()
    const tab = await pane($, RUNS, 'dock')
    await fireTicks()
    await settle()
    const rows = (await keysOf(tab)).filter(k => /^wf-toolu_\d+$/.test(k))
    expect(rows).toEqual(['wf-toolu_3', 'wf-toolu_2', 'wf-toolu_1'])
    expect(await has(tab, 'runs-close')).toBe(true)
    // choosing the oldest run opens the workflow tab, focused, on it
    const before = openArgs.length
    await tab.press({ key: 'wf-toolu_1' })
    await fireTicks()
    await settle()
    const chartOpens = openArgs.slice(before).filter((x: any) => x.id === CHART)
    expect(chartOpens.map((x: any) => x.focus)).toContain(true)
    const wp2 = await pane($, CHART, 'dock')
    await fireTicks()
    await settle()
    expect(await has(wp2, 'toolu_1:wf-thinking')).toBe(true)
    expect(await has(wp2, 'toolu_3:wf-thinking')).toBe(false)
    await wp2.unmount()
    await tab.press({ key: 'runs-close' })
    await fireTicks()
    await settle()
    expect(closed).toContain(RUNS)
    await tab.unmount()
  })

  test('[live1-2b] stored step:<w>:<old> keys are cleared: only the highest step is open', HEAVY, async ($, on) => {
    await engine($, on, { files: { 'docs/handoffs/A/run.md': RUN_A } })
    await spawn($, 2, 'A', '1')
    await spawn($, 3, 'A', '2')
    // an earlier session left step 1 open and step 2 closed
    seedState(LENS_OPEN.key, { 'step:toolu_2:1': true, 'step:toolu_2:2': false })
    await seatWide($, 120)
    await lensCmd($)
    const wp = await pane($, CHART, 'dock')
    await fireTicks()
    await settle()
    // the run's steps are 17 (its records on disk), 2 and 1: the highest, 17, is the only one open; step 1, stored open, is collapsed again
    expect(await labelOf(wp, 'nr:toolu_2:s17:step-min')).toBe('–')
    expect(await labelOf(wp, 'nr:toolu_2:s2:step-min')).toBe('□')
    expect(await labelOf(wp, 'nr:toolu_2:s1:step-min')).toBe('□')
    await wp.unmount()
  })

  test('[live1-2b] a terminal opens no Run List tab', HEAVY, async ($, on) => {
    const { openArgs } = await engine($, on, { surface: 'terminal' })
    const before = openArgs.length
    await lensCmd($)
    expect(openArgs.slice(before).filter((x: any) => x.id === RUNS)).toEqual([])
  })
})

// ---------------------------------------------------------------------------------------------------------------
describe('step 43 live round 3: the kit refuses a state write made during a draw (the host denies it)', () => {
  // A fake render writer: a draw that writes at once, from a deferred callback (a resolved promise), or after the draw settled.
  const fakeDraw = (g: RenderGuard, when: 'in' | 'deferred' | 'after') => {
    let later: Promise<unknown> = Promise.resolve()
    const write = async () => {
      try {
        g.check(PLUGIN, 'view')
      } catch {
        // a plugin may swallow the refusal: the guard has recorded it
      }
    }
    const draw = g.draw(async () => {
      if (when === 'in') await write()
      if (when === 'deferred') later = Promise.resolve().then(write)
      for (let i = 0; i < 10; i++) await Promise.resolve()
      return 'drawn'
    })
    return draw.then(async () => {
      if (when === 'after') await write()
      await later
    })
  }

  test('[live3-guard] a write made in the draw itself is recorded and refused', async () => {
    const g = new RenderGuard()
    await fakeDraw(g, 'in')
    expect(g.writes).toEqual([`${PLUGIN}:view`])
    // and the write itself throws while a draw is open
    let thrown: unknown
    const open = g.draw(async () => {
      try {
        g.check(PLUGIN, 'view')
      } catch (err) {
        thrown = err
      }
    })
    await open
    expect(String(thrown)).toMatch(/denied/)
  })

  test('[live3-guard] a deferred write (an async continuation) inside the draw is caught', async () => {
    const g = new RenderGuard()
    await fakeDraw(g, 'deferred')
    expect(g.writes).toEqual([`${PLUGIN}:view`])
  })

  test('[live3-guard] a write after the draw has settled is not refused (control)', async () => {
    const g = new RenderGuard()
    await fakeDraw(g, 'after')
    expect(g.writes).toEqual([])
  })

  test('[live3-guard] the lens timers own keys are not draw writes', async () => {
    const g = new RenderGuard()
    await g.draw(async () => g.check(PLUGIN, 'tick'))
    expect(g.writes).toEqual([])
  })

})

// ---------------------------------------------------------------------------------------------------------------
describe('step 43 live round 1, 2b.i: the minimised line lists the top 3 runs by precedence', () => {
  const f = (w: string, status: string) => ({ w, info: { status } }) as any
  const ws = (r: { top: any[] } | null) => r?.top.map(x => x.w)

  test('[live1-2b.i] order: in progress, waiting, halted, pending, completed', () => {
    const all = [f('c', 'completed'), f('p', 'pending'), f('h', 'halted'), f('w', 'waiting'), f('i', 'in-progress')]
    expect(ws(bandLineOf(all))).toEqual(['i', 'w', 'h'])
    expect(ws(bandLineOf(all.slice(0, 4)))).toEqual(['w', 'h', 'p'])
    expect(ws(bandLineOf(all.slice(0, 3)))).toEqual(['h', 'p', 'c'])
  })

  test('[live1-2b.i] newest first within a status (the input is newest first); the first of the top is `flow`; `live` counts in progress', () => {
    const r = bandLineOf([f('a', 'halted'), f('b', 'in-progress'), f('c', 'halted'), f('d', 'in-progress'), f('e', 'in-progress')])!
    expect(ws(r)).toEqual(['b', 'd', 'e'])
    expect(r.flow.w).toBe('b')
    expect(r.live).toBe(3)
  })

  test('[live1-2b.i] at most 3, fewer when fewer exist, null when none', () => {
    expect(ws(bandLineOf([f('a', 'completed'), f('b', 'completed'), f('c', 'completed'), f('d', 'completed')]))).toEqual(['a', 'b', 'c'])
    expect(ws(bandLineOf([f('a', 'pending')]))).toEqual(['a'])
    expect(bandLineOf([])).toBe(null)
  })

  test('[live1-2b.i] the run list keeps its normal order: wf rows newest first whatever the statuses', async ($, on) => {
    await engine($, on)
    await spawn($, 2, 'B', '1')
    await finish($, 'a2')
    await spawn($, 3, 'C', '1')
    const ui = await pane($, RUNS, 'dock')
    await settle()
    expect((await keysOf(ui)).filter(k => /^wf-toolu_\d+$/.test(k))).toEqual(['wf-toolu_3', 'wf-toolu_2', 'wf-toolu_1'])
    await ui.unmount()
  })
})

// ---------------------------------------------------------------------------------------------------------------
describe('step 43 live round 1, 3: Cache Lab starts collapsed in the agent panel', () => {
  const openAgent = async ($: any) => {
    const card = await $.ui.mount({
      plugin: PLUGIN,
      surface: 'vscode',
      component: 'ToolUse',
      requestId: 'toolu_1',
      viewport: { columns: 200, rows: 40 },
      props: { tool_use_id: 'toolu_1', tool: 'Agent', input: { subagent_type: 'ai-dlc:agent-manager', description: 'd1', prompt: 'p' }, isRunning: false, isErrored: false, isInterrupted: false },
    } as any)
    await card.press({ key: 'card:agent-main' })
    await card.unmount()
    const ui = await pane($, AGENT, 'dock')
    await settle()
    return ui
  }
  const lab = async (ui: any) => (await ui.find({ type: 'Button', key: 'cachelab-open' }))?.text

  test('[live1-3] a stored open state from an earlier session or load does not open it: [+] until pressed', async ($, on) => {
    await engine($, on)
    seedState(LENS_OPEN.key, { 'lens:cachelab': true })
    const ui = await openAgent($)
    expect(await lab(ui)).toBe('[+]')
    expect((await texts(ui)).some(t => t.includes('Saved by cache'))).toBe(false)
    await ui.unmount()
  })

  test('[live1-3] also after session.start (a new session over a stored open state)', async ($, on) => {
    await engine($, on)
    seedState(LENS_OPEN.key, { 'lens:cachelab': true })
    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    const ui = await openAgent($)
    expect(await lab(ui)).toBe('[+]')
    await ui.unmount()
  })

  test('[live1-3] a press opens it; a second press closes it', async ($, on) => {
    await engine($, on)
    seedState(LENS_OPEN.key, { 'lens:cachelab': true })
    const ui = await openAgent($)
    await ui.press({ key: 'cachelab-open' })
    await settle()
    expect(await lab(ui)).toBe('[-]')
    await ui.press({ key: 'cachelab-open' })
    await settle()
    expect(await lab(ui)).toBe('[+]')
    await ui.unmount()
  })

  test('[live1-3] with collapsedByDefault:false it starts open (the setting still decides the start)', async ($, on) => {
    await engine($, on, { files: { '.ai-dlc/lens.json': JSON.stringify({ panelOpenMode: 'tab', collapsedByDefault: false }) } })
    const ui = await openAgent($)
    expect(await lab(ui)).toBe('[-]')
    await ui.unmount()
  })
})
