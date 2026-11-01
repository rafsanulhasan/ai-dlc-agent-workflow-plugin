/**
 * Step 44's shared lens kit (closes the gap that let R44.17 through): the engine stubbed at its edges, as in
 * lens-live1-cmd-43.test.tsx, with two differences.
 *  - Every `clock.after` timer, 0 ms included, is queued (`kit.timers`), and the test decides when it fires. A real host
 *    can fire a timer while another `ui.render` is being dispatched; here `fireInDraw` does that, and `fire` fires the
 *    timers outside any draw.
 *  - The render-purity guard (`RenderGuard`) belongs to the kit: a state write made while `guard.draw` is in progress is
 *    refused with the host's words ("state.set: denied: it was made while ui.render is being dispatched"). The guard
 *    exempts the `tick` and `agents` keys: the lens writes them from its own timers (the status blink, the agent list poll),
 *    which run beside a draw and not in one; the real host does not refuse those, so the kit must not either.
 * Not a test file: the test files import it.
 */
import { expect } from 'claude-code/testing'

export const PLUGIN = 'ai-dlc-lens'
export const CHART = 'ai-dlc-lens-chart'
export const RUNS = 'ai-dlc-lens-runs'

const RECORD = 'docs/handoffs/R/17-orchestrator-to-agent-manager.handoff.md'

/** The host's refusal of a state write made while a `ui.render` is dispatched (d.ts 3494), for the writes of one draw. */
export class RenderGuard {
  writes: string[] = []
  private span = 0
  /** Brackets one draw: any write checked until `fn`'s promise settles, continuations included, is refused. */
  async draw<T>(fn: () => Promise<T>): Promise<T> {
    this.span++
    try {
      return await fn()
    } finally {
      this.span--
    }
  }
  get inDraw(): boolean {
    return this.span > 0
  }
  /** The refusal for a write checked now, or undefined: recorded in `writes`. (A hook that throws is skipped by the engine, so the kit answers `{ deny }`.) */
  refusal(plugin: unknown, key: unknown): string | undefined {
    // the lens's own timers' writes (the blink, the agent list poll) run beside a draw, not in it
    if (this.span > 0 && key !== 'tick' && key !== 'agents') {
      this.writes.push(`${String(plugin)}:${String(key)}`)
      return `state.set: denied: it was made while ui.render is being dispatched (${String(key)})`
    }
    return undefined
  }
}

export type Timer = { ms: number; fire: () => void }
export type KitSurface = 'terminal' | 'desktop' | 'vscode' | 'mobile'
export type KitOpts = { surface?: KitSurface; surfaces?: string[]; files?: Record<string, string>; /** The host leaves every opened pane undrawn (`isPlaced: false`). */ unplaced?: boolean }
export type Kit = {
  guard: RenderGuard
  timers: Timer[]
  openArgs: any[]
  closed: string[]
  openNow: Set<string>
  seed: (key: string, value: unknown) => void
}

const wait = (ms: number) => new Promise(r => (globalThis as any).setTimeout(r, ms))
const micro = async () => {
  for (let i = 0; i < 100; i++) await Promise.resolve()
}

/** The engine for one test. `surface` is the session's; `surfaces` (default `[surface]`) what `session.surfaces` answers. */
export async function engine($: any, on: any, o: KitOpts = {}): Promise<Kit> {
  const surface = o.surface ?? 'vscode'
  const files: Record<string, string> = { [RECORD]: 'HANDOFF BODY', ...(o.files ?? {}) }
  if (!('.ai-dlc/lens.json' in files)) files['.ai-dlc/lens.json'] = JSON.stringify({ panelOpenMode: 'tab' })
  const kit: Kit = { guard: new RenderGuard(), timers: [], openArgs: [], closed: [], openNow: new Set(), seed: () => {} }
  on('session.surfaces', () => ({ value: o.surfaces ?? [surface] }))
  on('ui.render', ($s: any, e: any) => {
    const { Text } = $s.ui.resolve(e)
    return <Text>NATIVE ROW</Text>
  })
  on('clock.every', () => ({ value: undefined }))
  // Every timer waits for the test (`fire`, `fireInDraw`), 0 ms included: that is what lets a test fire one while a draw is in progress.
  on('clock.after', (_: unknown, e: any) => new Promise(r => kit.timers.push({ ms: Number(e?.ms ?? 0), fire: () => r({ value: undefined }) })) as never)
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
  on('agent.list', () => ({ value: [1].map(n => ({ id: `a${n}`, description: 'build', type: 'ai-dlc:agent-manager', status: 'running' })) }))
  on('ui.open', (_: unknown, e: any) => {
    kit.openArgs.push(e)
    kit.openNow.add(e.id)
    return { value: o.unplaced === true ? { isPlaced: false, reason: 'the host left it undrawn' } : { isPlaced: true } }
  })
  on('ui.close', (_: unknown, e: any) => {
    kit.closed.push(e.id)
    kit.openNow.delete(e.id)
    return { value: undefined }
  })
  on('ui.panes', () => ({ value: [...kit.openNow].map(id => ({ id, title: id, isShown: true, isFocused: false, isPlaced: true })) }))
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
  const seeds = new Map<string, unknown>()
  on('state.set', (_: unknown, e: any, next: any) => {
    const denied = kit.guard.refusal(e.plugin, e.key)
    if (denied !== undefined) return { deny: denied } as never
    if (e.plugin === PLUGIN) seeds.delete(String(e.key))
    return next(e)
  })
  on('state.get', (_: unknown, e: any, next: any) => (e.plugin === PLUGIN && seeds.has(String(e.key)) ? { value: { value: seeds.get(String(e.key)), version: 1 } } : next(e)))
  kit.seed = (key, value) => void seeds.set(key, value)
  await $.session.start({ cwd: '/', surface, isInteractive: true })
  await spawn($, 1, 'R', '17')
  return kit
}

export async function spawn($: any, n: number, run: string, code: string, subagentType = 'ai-dlc:agent-manager') {
  await wait(3)
  const prompt = `Your handoff record is docs/handoffs/${run}/${code}-orchestrator-to-agent-manager.handoff.md (root x).\nDo it.`
  await $.turn.start({ text: `request ${n}`, turnId: `m${n}` })
  await $.tool.call({ tool: 'Agent', subagent_type: subagentType, description: `d${n}`, prompt, tool_use_id: `toolu_${n}` })
  await $.agent.spawn({ tool_use_id: `toolu_${n}`, prompt, description: `d${n}`, subagentType, provider: { plugin: 'ai-dlc', tier: 'user' }, parentModel: 'claude-opus-5-5', background: true, fork: false })
}

/** Fires every queued timer outside any draw, lets what they started finish, and returns how many fired. Timers they queue stay queued. */
export async function fire(kit: Kit): Promise<number> {
  const t = kit.timers.splice(0)
  for (const x of t) x.fire()
  await micro()
  await wait(30)
  return t.length
}

/** Fires every queued timer while a draw is in progress, so a state write they make is refused with the host's words. */
export async function fireInDraw(kit: Kit): Promise<number> {
  const t = kit.timers.splice(0)
  await kit.guard.draw(async () => {
    for (const x of t) x.fire()
    await micro()
  })
  await wait(30)
  return t.length
}

/** A lens Pane on VS Code (or `surface`) at `placement`, drawn inside a guarded draw; the writes the earlier events left running finish first. */
export async function pane($: any, id: string, placement: 'dock' | 'inline', kit: Kit, o: { surface?: string; bodyColumns?: number } = {}) {
  await micro()
  await wait(40)
  return kit.guard.draw(() =>
    $.ui.mount({
      plugin: PLUGIN,
      surface: o.surface ?? 'vscode',
      component: 'Pane',
      requestId: id,
      props: { title: id, isFocused: false, bodyColumns: o.bodyColumns ?? 120, placement, scroll: { offset: 0, bodyRows: 80 }, view: {} },
      viewport: { columns: 200, rows: 50 },
    } as any)
  )
}

export const band = ($: any, surface = 'vscode') =>
  $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 40, bodyColumns: 120, scroll: { offset: 0, bodyRows: 40 }, view: {} } } as any)

/** Whether a lens band render on `surface` draws the lens band (the band's mode button is there). */
export const bandDrawn = async ($: any, surface: string): Promise<boolean> => {
  const b = await band($, surface)
  const yes = await has(b, 'pane-place')
  await b.unmount()
  return yes
}
/** A terminal session with a VS Code panel attached: the session most of the surface tests start from. */
export const BOTH: KitOpts = { surface: 'terminal', surfaces: ['terminal', 'vscode'] }
export const has = async (ui: any, key: string) => (await ui.find({ type: 'Button', key })) !== undefined
export const texts = async (ui: any): Promise<string[]> => ((await ui.findAll({})) as any[]).filter(x => x.type === 'Text').map(x => String(x.text ?? ''))
export const lensCmd = async ($: any) => String(((await ($.command.run as any)({ command: 'ai-dlc:lens', args: '' })) as any)?.text)
/** Nothing the guard refused is left unexplained: a test that expects refusals says so, the others call this. */
export const noRefusals = (kit: Kit) => expect(kit.guard.writes).toEqual([])
export const idsOf = (calls: any[]) => calls.map((x: any) => x.id)
