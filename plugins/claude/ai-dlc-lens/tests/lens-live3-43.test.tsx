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
  return guard.draw(() => paneMount($, id, placement, bodyColumns))
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
const NARROW = 40
const WIDE = 120
const bandKeys = async (ui: any): Promise<string[]> => [...new Set(((await ui.findAll({})) as any[]).map((x: any) => String(x.key ?? '')).filter((k: string) => /^band-line-/.test(k)))].sort()

/** What the command opened: the ui.open calls it added, by id. */
const commandOpens = async ($: any, openArgs: any[]) => {
  const before = openArgs.length
  await lensCmd($)
  return openArgs.slice(before)
}

describe('step 43 live round 3, 2: /ai-dlc:lens in a narrow VS Code panel opens exactly one pane', () => {
  // The first test of the file: no lens pane has been drawn yet in this module, so the command has no seat to read.
  test('[live3-2] no pane drawn yet: the default is narrow, one CHART pane, no Run List tab', HEAVY, async ($, on) => {
    const { openArgs } = await engine($, on)
    await spawn($, 2, 'B', '1')
    await spawn($, 3, 'C', '1')
    await spawn($, 4, 'D', '1')
    const opens = await commandOpens($, openArgs)
    expect(opens.map((x: any) => x.id)).toEqual([CHART])
    expect(opens.filter((x: any) => x.id === RUNS)).toEqual([])
    const ui = await pane($, CHART, 'inline', NARROW)
    await settle()
    expect(await bandKeys(ui)).toEqual(['band-line-0', 'band-line-1', 'band-line-2'])
    expect(await has(ui, 'runs-back')).toBe(false)
    await ui.unmount()
  })

  test('[live3-2] a CHART pane drawn inline: one CHART open, no Run List, the minimised top 3, no workflow pane', HEAVY, async ($, on) => {
    const { openArgs } = await engine($, on)
    await spawn($, 2, 'B', '1')
    await spawn($, 3, 'C', '1')
    await spawn($, 4, 'D', '1')
    seedState(LENS_VIEW.key, fullScreenView())
    const first = await pane($, CHART, 'inline', NARROW)
    await first.unmount()
    const opens = await commandOpens($, openArgs)
    expect(opens.map((x: any) => x.id)).toEqual([CHART])
    expect(opens.filter((x: any) => x.id !== CHART)).toEqual([])
    const ui = await pane($, CHART, 'inline', NARROW)
    await fireTicks()
    await settle()
    const keys = await keysOf(ui)
    expect(await bandKeys(ui)).toEqual(['band-line-0', 'band-line-1', 'band-line-2'])
    expect(keys).not.toContain('runs-back')
    expect(keys.some(k => /:wf-thinking$/.test(k))).toBe(false)
    await ui.unmount()
  })

  test('[live3-2] a CHART pane docked below wideColumns is narrow too: one pane, the minimised list', HEAVY, async ($, on) => {
    const { openArgs } = await engine($, on)
    await spawn($, 2, 'B', '1')
    const first = await pane($, CHART, 'dock', 60) // wideColumns defaults to 70
    await first.unmount()
    const opens = await commandOpens($, openArgs)
    expect(opens.map((x: any) => x.id)).toEqual([CHART])
    const ui = await pane($, CHART, 'dock', 60)
    await fireTicks()
    await settle()
    expect(await ui.find({ key: 'band-line-0' })).toBeDefined()
    expect(await has(ui, 'runs-back')).toBe(false)
    expect((await keysOf(ui)).some(k => /:wf-thinking$/.test(k))).toBe(false)
    await ui.unmount()
  })

  test('[live3-2] a docked CHART pane at exactly wideColumns is wide', HEAVY, async ($, on) => {
    const { openArgs } = await engine($, on)
    const first = await pane($, CHART, 'dock', 70)
    await first.unmount()
    const opens = await commandOpens($, openArgs)
    expect(opens.map((x: any) => x.id)).toEqual([RUNS, CHART])
  })

  test('[live3-2] an inline CHART pane is narrow whatever its body columns: one pane, even at 120 columns', HEAVY, async ($, on) => {
    const { openArgs } = await engine($, on)
    const first = await pane($, CHART, 'inline', WIDE)
    await first.unmount()
    const opens = await commandOpens($, openArgs)
    expect(opens.map((x: any) => x.id)).toEqual([CHART])
  })

  test('[live3-2] a RUNS tab drawn inline is narrow as well (the seat is the last lens pane drawn)', HEAVY, async ($, on) => {
    const { openArgs } = await engine($, on)
    const first = await pane($, RUNS, 'inline', NARROW)
    await first.unmount()
    const opens = await commandOpens($, openArgs)
    expect(opens.map((x: any) => x.id)).toEqual([CHART])
  })
})

describe('step 43 live round 3, 2: the wide panel still opens its tabs', () => {
  test('[live3-2] a docked CHART pane at 120 columns: the Run List tab without focus, then the CHART with focus, in workflow mode', HEAVY, async ($, on) => {
    const { openArgs } = await engine($, on, { files: { 'docs/handoffs/A/run.md': RUN_A } })
    await spawn($, 2, 'A', '2')
    seedState(LENS_VIEW.key, fullScreenView())
    await seatWide($, WIDE)
    const opens = await commandOpens($, openArgs)
    expect(opens.map((x: any) => x.id)).toEqual([RUNS, CHART])
    expect(opens[0].focus).not.toBe(true)
    expect(opens[1].focus).toBe(true)
    const wp = await pane($, CHART, 'dock', WIDE)
    await fireTicks()
    await settle()
    expect(await has(wp, 'toolu_2:wf-thinking')).toBe(true)
    expect(await has(wp, 'runs-back')).toBe(true)
    await wp.unmount()
  })

  test('[live3-2] the seat is the last pane drawn: wide, then narrow, then the command opens one pane', HEAVY, async ($, on) => {
    const { openArgs } = await engine($, on)
    await seatWide($, WIDE)
    const narrow = await pane($, CHART, 'inline', NARROW)
    await narrow.unmount()
    const opens = await commandOpens($, openArgs)
    expect(opens.map((x: any) => x.id)).toEqual([CHART])
  })

  test('[live3-2] a terminal never opens a Run List tab whatever the pane drawn', HEAVY, async ($, on) => {
    const { openArgs } = await engine($, on, { surface: 'terminal' })
    await seatWide($, WIDE)
    const opens = await commandOpens($, openArgs)
    expect(opens.filter((x: any) => x.id === RUNS)).toEqual([])
  })
})
