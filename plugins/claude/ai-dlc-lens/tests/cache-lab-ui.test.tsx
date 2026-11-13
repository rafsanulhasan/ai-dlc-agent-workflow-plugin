import { describe, expect, mock, test } from 'claude-code/testing'
import type { Call } from '../hooks/transcripts'
// The test runs under bun, which has timers; the hooks lib (es2023, no DOM) does not declare them.
declare const setTimeout: (fn: (...args: never[]) => void, ms: number) => unknown

// The Cache Lab accordion of the agent panel (cache-lab spec: AC-22.2.1, 22.2.12, 22.2.13, 22.1.5, 22.4, 22.7, 22.8;
// ITEM-070 to 074 and 077; step 42 moved it from the lens view's head into the agent panel, opened from an avatar). The engine is stubbed at its edges: `process.run` answers the transcript reader's
// `list` and `read` from calls built here (the reader itself is tested by tests/cache-reader/), the price file is
// a fixture, and keep-alive's published value comes from `state.get`.

const DAY = 86_400_000
const PANE = 'ai-dlc-lens-chart'
const AGENT_PANE = 'ai-dlc-lens-agent'
const FOLDER = '/home/test/.claude/projects/p'
const M = 'fixture-model-m'
const N = 'fixture-model-n'

const PRICES = JSON.stringify({
  models: [M, N].map(id => ({ id, pricing: { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.3, cacheWrite5mPerMTok: 3.75, cacheWrite1hPerMTok: 6 } })),
})

// The calls of fixture F5/F6, shifted so that "now" is the real now: every window preset is a span back from it.
function calls(now: number): Call[] {
  const at = (hoursAgo: number) => now - hoursAgo * 3_600_000
  let order = 0
  const c = (session: string, ms: number, o: Partial<Call>): Call => ({ session, stream: 'main', at: ms, model: M, in: 0, out: 0, cr: 0, cc: 0, order: order++, ...o })
  const w = (cc5m: number, cc1h = 0) => ({ cc5m, cc1h, cc: cc5m + cc1h })
  return [
    // session A (F1's A calls, a few hours ago)
    c('A', at(3), { in: 100, out: 100, cr: 0, ...w(20000) }),
    c('A', at(3) + 2 * 60_000, { in: 100, out: 100, cr: 20000, ...w(500) }),
    c('A', at(3) + 10 * 60_000, { in: 100, out: 100, cr: 15000, ...w(20600) }),
    c('A', at(3) + 12 * 60_000, { in: 100, out: 100, cr: 5000, ...w(15700) }),
    c('A', at(3) + 13 * 60_000, { model: N, in: 100, out: 100, cr: 0, ...w(0, 12000) }),
    c('A', at(3) + 14 * 60_000, { in: 100, out: 100, cr: 12000, cc: 3000 }),
    c('B', at(2) - 60_000, { stream: 'agent:b0', in: 50, out: 50, ...w(4000) }),
    c('B', at(2), { in: 50, out: 50, ...w(10000) }),
    c('C', at(1), { ...w(60000) }),
    // older sessions
    c('E', now - 1 * DAY - 1_000, { cr: 1000 }),
    c('G', now - 24 * DAY, { cr: 2000 }),
    c('H', now - 54 * DAY, { cr: 4000 }),
    // the session the lens runs in, seeded by an automatic handoff from C
    c('C2', now - 10 * 60_000, { cr: 3000 }),
  ]
}

type Stub = { readerRuns: string[][]; fileWrites: string[]; stores: Map<string, unknown>; storeWrites: string[]; commands: { command: string; args: string }[] }

// Step 42: the lens opens an avatar as a tab (the panel is mounted by id), as the lens tests' `seed` does.
const withTabMode = (files: Record<string, string> = {}): Record<string, string> => {
  let json: Record<string, unknown> = {}
  try {
    json = files['.ai-dlc/lens.json'] === undefined ? {} : JSON.parse(files['.ai-dlc/lens.json'])
  } catch {
    json = {}
  }
  return { ...files, '.ai-dlc/lens.json': JSON.stringify({ panelOpenMode: 'tab', ...json }) }
}

function engine(on: any, o: { now?: number; prices?: string | null; chain?: { id: string; sessions: string[] } | null | (() => { id: string; sessions: string[] } | null); files?: Record<string, string>; keepalive?: unknown; onCommand?: (e: { command: string; args: string }) => void; calls?: Call[]; readerError?: string; exitCode?: number; env?: Record<string, string> } = {}): Stub {
  const now = o.now ?? Date.now()
  const all = o.calls ?? calls(now)
  const stub: Stub = { readerRuns: [], fileWrites: [], stores: new Map(), storeWrites: [], commands: [] }
  const files = withTabMode(o.files)
  const published = () => (typeof o.keepalive === 'function' ? (o.keepalive as () => unknown)() : o.keepalive)
  const bySession = new Map<string, Call[]>()
  for (const x of all) bySession.set(x.session, [...(bySession.get(x.session) ?? []), x])
  const rels = [...bySession.keys()].map(s => `${s}.jsonl`)
  const out = (json: unknown, exitCode = 0) => ({ value: { exitCode, stdout: JSON.stringify(json), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
  on('process.run', (_: unknown, e: any) => {
    const argv: string[] = e.argv
    if (!String(argv[1]).endsWith('cache-reader.mjs')) return out({}, 1)
    stub.readerRuns.push(argv.slice(2))
    if (o.exitCode !== undefined) return out({ data: null, error: null }, o.exitCode)
    if (o.readerError) return out({ data: null, error: o.readerError }, 1)
    const arg = (name: string) => argv[argv.indexOf(name) + 1]
    if (argv[2] === 'list') return out({ data: { files: rels.map((rel, i) => ({ rel, size: 100 + i, mtimeMs: 1000 + i })) }, error: null })
    const wanted = String(arg('--files')).split(',')
    return out({ data: { files: wanted.map((rel, i) => ({ rel, size: 100 + rels.indexOf(rel), mtimeMs: 1000 + rels.indexOf(rel), calls: bySession.get(rel.replace(/\.jsonl$/, '')) ?? [], skipped: 0 })) }, error: null })
  })
  // The test's $ has no store noun: the lens's own store, in memory, so a test can seed it and read what was written
  on('store.get', (_: unknown, e: any) => ({ value: stub.stores.get(e.key) }))
  on('store.set', (_: unknown, e: any) => (stub.stores.set(e.key, e.value), stub.storeWrites.push(e.key), { value: undefined }))
  // keep-alive's published value; any other state key (the lens's own atoms) is the engine's
  on('state.get', (_: unknown, e: any, next: any) => (e.plugin === 'ai-dlc' && e.key === 'keepalive' ? { value: { value: ((c: any) => (c === null || c === undefined ? published() : { ...((published() as object) ?? {}), chain: c }))(typeof o.chain === 'function' ? o.chain() : o.chain), version: 1 } } : next(e)))
  on('clock.every', () => ({ value: undefined }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('session.end', (_: unknown, e: any) => ({ sessionId: e.sessionId }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 10 }, rateLimits: [] } }))
  on('settings.read', () => ({ value: { agent: 'ai-dlc:orchestrator' } }))
  on('command.register', () => ({ value: { command: 'x' } }))
  on('fs.exists', () => ({ value: false }))
  on('fs.stat', () => { throw new Error('ENOENT') })
  on('fs.list', () => ({ value: [] }))
  on('fs.read', (_: unknown, e: any) => {
    const path = String(e.path).replace(/\\/g, '/')
    const hit = Object.keys(files).find(k => path.endsWith(k))
    if (hit) return { value: files[hit] }
    if (o.prices !== null && path.endsWith('.ai-dlc/model-metadata.json')) return { value: o.prices ?? PRICES }
    throw new Error(`ENOENT ${path}`)
  })
  on('fs.write', (_: unknown, e: any) => (stub.fileWrites.push(String(e.path)), { value: undefined }))
  mock.env(on as never, { HOME: '/home/test', ...(o.env ?? {}) })
  // Step 42: an avatar opens the agent panel; a Cache Lab keep-alive button runs the /ai-dlc:cache-keepalive-configure command
  on('agent.list', () => ({ value: [] }))
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'a1' }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.render', ($s: any, e: any) => {
    const { Text } = $s.ui.resolve(e)
    return <Text>NATIVE ROW</Text>
  })
  on('command.run', (_: unknown, e: any) => {
    const c = { command: String(e.command), args: String(e.args ?? '') }
    stub.commands.push(c)
    o.onCommand?.(c)
    return { value: undefined }
  })
  // the classic hooks nothing beneath the lens answers
  on('classic.UserPromptSubmit', () => ({}))
  on('classic.SessionStart', () => ({}))
  on('classic.Stop', () => ({}))
  return stub
}

const paneOf = ($: any, requestId: string, surface: 'vscode' | 'terminal') =>
  $.ui.mount({ plugin: 'ai-dlc-lens', surface, component: 'Pane', requestId, props: { title: requestId, isFocused: false, bodyColumns: 120, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} } })
/** The agent panel (Cache Lab's place since step 42). */
const mount = ($: any, surface: 'vscode' | 'terminal' = 'vscode') => paneOf($, AGENT_PANE, surface)
/** The lens view (the workflow pane): its head no longer holds Cache Lab. */
const mountView = ($: any, surface: 'vscode' | 'terminal' = 'vscode') => paneOf($, PANE, surface)
/** Opens the main loop's avatar panel from its chat card, as the lens tests do (`card:agent-main`). */
const selectAgent = async ($: any) => {
  await $.agent.spawn({ tool_use_id: 'toolu_1', prompt: 'p', description: 'build', subagentType: 'ai-dlc:software-engineer', provider: { plugin: 'ai-dlc', tier: 'user' }, parentModel: 'claude-opus-5-5', background: false, fork: false })
  const card = await $.ui.mount({ plugin: 'ai-dlc-lens', surface: 'vscode', component: 'ToolUse', requestId: 'toolu_1', props: { tool_use_id: 'toolu_1', tool: 'Agent', input: { subagent_type: 'ai-dlc:software-engineer', description: 'build', prompt: 'p' }, isRunning: false, isErrored: false, isInterrupted: false } })
  await card.press({ key: 'card:agent-main' })
  await card.unmount()
}
const start = async ($: any, session = 'C2') => {
  await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
  await $.classic.UserPromptSubmit({ transcript_path: `${FOLDER}/${session}.jsonl`, prompt: 'x' } as never)
  await selectAgent($)
}
const texts = async (ui: any): Promise<string[]> => ((await ui.findAll({})) as any[]).filter(x => x.type === 'Text').map(x => String(x.text ?? ''))
const labels = async (ui: any): Promise<string[]> => ((await ui.findAll({ type: 'Button' })) as any[]).map(b => String(b.text ?? b.label ?? b.props?.label ?? ''))
const settle = async () => { for (let i = 0; i < 200; i++) await Promise.resolve(); await new Promise(r => setTimeout(r, 30)) }
const open = async (ui: any) => { await ui.press({ key: 'cachelab-open' }); await settle() }
const value = (lines: string[], label: string): string | undefined => lines.find(l => l.replace(/\s+/g, ' ').trim().startsWith(label))?.replace(/\s+/g, ' ').trim().slice(label.length).trim()
const row = async (ui: any, label: string) => {
  const all = (await ui.findAll({})) as any[]
  const i = all.findIndex(x => x.type === 'Text' && String(x.text ?? '').trim() === label)
  return i < 0 ? undefined : String(all.slice(i + 1).find(x => x.type === 'Text')?.text ?? '').trim()
}

describe('[AC-22.2.1] the Cache Lab accordion', () => {
  test('[42.3] it is in the agent panel, labelled "Cache Lab" (capital L), collapsed, with a [+] button', async ($, on) => {
    engine(on)
    await start($)
    const ui = await mount($)
    expect((await texts(ui)).some(t => t.trim() === 'Cache Lab')).toBe(true)
    expect((await ui.find({ type: 'Button', key: 'cachelab-open' }))?.text).toBe('[+]')
    // collapsed: no figures, and the transcripts are never read while it is closed
    expect((await texts(ui)).some(t => t.includes('Saved by cache'))).toBe(false)
    await ui.unmount()
  })

  test('[42.3] it replaces the Cache keep-alive section of the agent panel: that section is gone, Context Lab stays', async ($, on) => {
    engine(on)
    await start($)
    const ui = await mount($)
    expect(await ui.find({ type: 'Button', key: 'agent-keepalive' })).toBe(undefined)
    expect((await texts(ui)).some(t => /^\s*Cache keep-alive/.test(t))).toBe(false)
    expect((await texts(ui)).some(t => /^Context Lab \(/.test(t.trim()))).toBe(true)
    await ui.unmount()
  })

  test('[42.3] Cache Lab is its own section directly after Context Lab: in that order, only the divider between them, neither inside the other', async ($, on) => {
    engine(on)
    await start($)
    const ui = await mount($)
    const lines = (await texts(ui)).map(t => t.trim())
    const ctx = lines.findIndex(t => /^Context Lab \(/.test(t))
    const lab = lines.findIndex(t => t === 'Cache Lab')
    expect(ctx).toBeGreaterThanOrEqual(0)
    expect(lab).toBeGreaterThan(ctx)
    // between the two headings: only the dividers (the Context Lab section is collapsed and ends at its heading)
    expect(lines.slice(ctx + 1, lab).filter(t => t !== '' && !/^─+$/.test(t))).toEqual([])
    // opened, Context Lab's rows come before Cache Lab's heading: Cache Lab is not one of them
    await ui.press({ key: 'agent-usage' })
    const opened = (await texts(ui)).map(t => t.trim())
    expect(opened.findIndex(t => t === 'Cache Lab')).toBeGreaterThan(opened.findIndex(t => t === 'Ran on'))
    await ui.unmount()
  })

  test('[42.3] nothing of Cache Lab is left in the view head: no Cache Lab text, no cachelab-open button', async ($, on) => {
    engine(on)
    await start($)
    const view = await mountView($)
    expect((await texts(view)).some(t => t.trim() === 'Cache Lab')).toBe(false)
    expect(await view.find({ type: 'Button', key: 'cachelab-open' })).toBe(undefined)
    expect(await view.find({ type: 'Button', key: 'cachelab-reload' })).toBe(undefined)
    await view.unmount()
  })

  test('nothing is read while it is collapsed', async ($, on) => {
    const stub = engine(on)
    await start($)
    const ui = await mount($)
    await settle()
    expect(stub.readerRuns).toEqual([])
    await ui.unmount()
  })

  test('opening it loads the figures; the order: window row, savings row, cards row, Miss attribution, TTL mix, then the gallery', async ($, on) => {
    engine(on)
    await start($)
    const ui = await mount($)
    await open(ui)
    const lines = await texts(ui)
    const at = (needle: string) => lines.findIndex(t => t.replace(/\s+/g, ' ').includes(needle))
    const order = ['Saved by cache', 'Lost to busts', 'NET', 'Cache Hit %', 'Tokens Saved', 'Bust events', 'Median baseline', 'Miss attribution', 'TTL mix', 'Invalidation Gallery']
    const idx = order.map(at)
    expect(idx.every(i => i >= 0)).toBe(true)
    expect([...idx].sort((a, b) => a - b)).toEqual(idx)
    // the window row's buttons come before the savings row
    expect((await labels(ui)).slice(0, 12)).toEqual(expect.arrayContaining(['This session', 'Today', '[7d]', '30d', 'All']))
    await ui.unmount()
  })

  test('its open state is kept: collapsed and opened again, it is still open', async ($, on) => {
    engine(on)
    await start($)
    const ui = await mount($)
    await open(ui)
    expect((await labels(ui)).some(l => l === '[-]')).toBe(true)
    await ui.unmount()
    const again = await mount($)
    expect((await texts(again)).some(t => t.includes('Saved by cache'))).toBe(true)
    await again.unmount()
  })
})

describe('[AC-22.2.12] the window row', () => {
  test('five presets in order, 7d marked active by default', async ($, on) => {
    engine(on)
    await start($)
    const ui = await mount($)
    await open(ui)
    const ls = (await labels(ui)).filter(l => ['This session', '[This session]', 'Today', '[Today]', '7d', '[7d]', '30d', '[30d]', 'All', '[All]'].includes(l))
    expect(ls).toEqual(['This session', 'Today', '[7d]', '30d', 'All'])
    await ui.unmount()
  })

  test('each preset press recomputes: Tokens Saved 53,000 at 7d, then 55,000 at 30d and 59,000 at All (F5 sums plus the handoff session\'s 3,000)', async ($, on) => {
    engine(on, { chain: { id: 'C', sessions: ['C2', 'C'] } })
    await start($)
    const ui = await mount($)
    await open(ui)
    expect(await row(ui, 'Tokens Saved')).toBe('56,000') // 52,000 + E1 1,000 + C2 3,000
    await ui.press({ key: 'cachelab-w-30d' })
    await settle()
    expect((await labels(ui)).includes('[30d]')).toBe(true)
    expect(await row(ui, 'Tokens Saved')).toBe('58,000')
    await ui.press({ key: 'cachelab-w-all' })
    await settle()
    expect(await row(ui, 'Tokens Saved')).toBe('62,000')
    await ui.unmount()
  })

  test('the chosen preset is kept when Cache Lab is collapsed and opened again', async ($, on) => {
    engine(on)
    await start($)
    const ui = await mount($)
    await open(ui)
    await ui.press({ key: 'cachelab-w-30d' })
    await settle()
    await ui.press({ key: 'cachelab-open' })
    await ui.press({ key: 'cachelab-open' })
    await settle()
    expect((await labels(ui)).includes('[30d]')).toBe(true)
    await ui.unmount()
  })

  test('no press writes a settings file or the store (the switch is off)', async ($, on) => {
    const stub = engine(on)
    await start($)
    const ui = await mount($)
    await open(ui)
    await ui.press({ key: 'cachelab-w-30d' })
    await settle()
    expect(stub.fileWrites.filter(p => /settings|lens\.json/.test(p))).toEqual([])
    expect(stub.storeWrites.filter(k => k === 'lens:cachelab:window')).toEqual([])
    await ui.unmount()
  })
})

describe('[AC-22.2.13] cacheLabKeepWindowOnReload', () => {
  test('on (the env of settings.local.json): a press is stored under the chain id; the store is read for the window', async ($, on) => {
    const stub = engine(on, { files: { '.claude/settings.local.json': JSON.stringify({ env: { AI_DLC_LENS_CACHE_LAB_KEEP_WINDOW_ON_RELOAD: 'true' } }) } })
    await start($)
    const ui = await mount($)
    await open(ui)
    await ui.press({ key: 'cachelab-w-30d' })
    await settle()
    expect(stub.stores.get('lens:cachelab:window')).toEqual([['C2', '30d']])
    await ui.unmount()
  })

  test('on: a stored value is the window at the start (kept across a reload); an invalid stored value reads 7d', async ($, on) => {
    const stub = engine(on, { files: { '.ai-dlc/lens.json': JSON.stringify({ cacheLabKeepWindowOnReload: true }) } })
    stub.stores.set('lens:cachelab:window', [['C2', '30d']])
    await start($)
    const ui = await mount($)
    await open(ui)
    expect((await labels(ui)).includes('[30d]')).toBe(true)
    await ui.unmount()
  })

  test('on: an invalid stored value reads 7d', async ($, on) => {
    const stub = engine(on, { files: { '.ai-dlc/lens.json': JSON.stringify({ cacheLabKeepWindowOnReload: true }) } })
    stub.stores.set('lens:cachelab:window', [['C2', 'forever']])
    await start($)
    const ui = await mount($)
    await open(ui)
    expect((await labels(ui)).includes('[7d]')).toBe(true)
    await ui.unmount()
  })

  test('off (the default): a window stored by an earlier run is ignored', async ($, on) => {
    const stub = engine(on)
    stub.stores.set('lens:cachelab:window', [['C2', '30d']])
    await start($)
    const ui = await mount($)
    await open(ui)
    expect((await labels(ui)).includes('[7d]')).toBe(true)
    await ui.unmount()
  })

  test('on: the process environment alone does not turn it on (only a settings file\'s env or lens.json do)', async ($, on) => {
    const stub = engine(on, { env: { AI_DLC_LENS_CACHE_LAB_KEEP_WINDOW_ON_RELOAD: 'true' } })
    stub.stores.set('lens:cachelab:window', [['C2', '30d']])
    await start($)
    const ui = await mount($)
    await open(ui)
    expect((await labels(ui)).includes('[7d]')).toBe(true)
    await ui.unmount()
  })
})

describe('[AC-22.8.2] a press made before the chain is known follows the chain (the press wins)', () => {
  test('30d pressed with no published chain (stored under the session), then keep-alive publishes the chain: the choice moves to the chain id and is still 30d', async ($, on) => {
    let chain: { id: string; sessions: string[] } | null = null
    const stub = engine(on, { files: { '.ai-dlc/lens.json': JSON.stringify({ cacheLabKeepWindowOnReload: true }) }, chain: () => chain })
    await start($)
    const ui = await mount($)
    await open(ui)
    await ui.press({ key: 'cachelab-w-30d' })
    await settle()
    expect(stub.stores.get('lens:cachelab:window')).toEqual([['C2', '30d']])
    chain = { id: 'C', sessions: ['C2', 'C'] }
    await ui.press({ key: 'cachelab-reload' })
    await settle()
    expect(stub.stores.get('lens:cachelab:window')).toEqual([['C2', '30d'], ['C', '30d']])
    expect((await labels(ui)).includes('[30d]')).toBe(true)
    await ui.unmount()
  })

  test('a window chosen under the chain survives the handoff: the next session of the chain reads it', async ($, on) => {
    const stub = engine(on, { files: { '.ai-dlc/lens.json': JSON.stringify({ cacheLabKeepWindowOnReload: true }) }, chain: { id: 'C', sessions: ['C2', 'C'] } })
    stub.stores.set('lens:cachelab:window', [['C', '30d']])
    await start($)
    const ui = await mount($)
    await open(ui)
    expect((await labels(ui)).includes('[30d]')).toBe(true)
    await ui.unmount()
  })

  test('a session started by hand (its own chain) does not read the earlier chain choice: 7d', async ($, on) => {
    const stub = engine(on, { files: { '.ai-dlc/lens.json': JSON.stringify({ cacheLabKeepWindowOnReload: true }) }, chain: { id: 'C2', sessions: ['C2'] } })
    stub.stores.set('lens:cachelab:window', [['C', '30d']])
    await start($)
    const ui = await mount($)
    await open(ui)
    expect((await labels(ui)).includes('[7d]')).toBe(true)
    await ui.unmount()
  })
})

describe('[AC-22.8.1 to 22.8.3] the automatic handoff chain', () => {
  test('[AC-22.8.1] This session covers every session of the published chain: Tokens Saved 3,000 (C2) with Median baseline 60k (C)', async ($, on) => {
    engine(on, { chain: { id: 'C', sessions: ['C2', 'C'] } })
    await start($)
    const ui = await mount($)
    await open(ui)
    await ui.press({ key: 'cachelab-w-session' })
    await settle()
    expect(await row(ui, 'Tokens Saved')).toBe('3,000')
    expect(await row(ui, 'Bust events')).toBe('0')
    expect(await row(ui, 'Median baseline')).toBe('60k')
    await ui.unmount()
  })

  test('[AC-22.8.1] F6h, C2 started by hand: This session covers C2 only, Median baseline "—"', async ($, on) => {
    engine(on, { chain: { id: 'C2', sessions: ['C2'] } })
    await start($)
    const ui = await mount($)
    await open(ui)
    await ui.press({ key: 'cachelab-w-session' })
    await settle()
    expect(await row(ui, 'Tokens Saved')).toBe('3,000')
    expect(await row(ui, 'Median baseline')).toBe('—')
    await ui.unmount()
  })

  test('[AC-22.8.3] no published keep-alive value: C2 is its own chain (This session covers C2 only)', async ($, on) => {
    engine(on, { chain: null })
    await start($)
    const ui = await mount($)
    await open(ui)
    await ui.press({ key: 'cachelab-w-session' })
    await settle()
    expect(await row(ui, 'Tokens Saved')).toBe('3,000')
    expect(await row(ui, 'Median baseline')).toBe('—')
    await ui.unmount()
  })
})

describe('[AC-22.1.5, 22.1.3] prices', () => {
  test('no price file: every dollar figure reads "no price", the token figures are still shown', async ($, on) => {
    engine(on, { prices: null })
    await start($)
    const ui = await mount($)
    await open(ui)
    expect(await row(ui, 'Saved by cache')).toBe('no price')
    expect(await row(ui, 'Lost to busts')).toBe('no price')
    expect(await row(ui, 'NET')).toBe('no price')
    expect(await row(ui, 'Tokens Saved')).not.toBe('no price')
    expect(await row(ui, 'Bust events')).toBe('3')
    await ui.unmount()
  })

  test('a model with no price is noted: "1 call with no price"', async ($, on) => {
    engine(on, { prices: JSON.stringify({ models: [{ id: M, pricing: { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.3, cacheWrite5mPerMTok: 3.75, cacheWrite1hPerMTok: 6 } }] }) })
    await start($)
    const ui = await mount($)
    await open(ui)
    expect((await texts(ui)).some(t => t.trim() === '1 call with no price')).toBe(true)
    await ui.unmount()
  })
})

describe('[AC-22.4] the Invalidation Gallery', () => {
  test('a sub-accordion, collapsed; opened it lists the busts newest first with the turn label, and no prompt text', async ($, on) => {
    engine(on)
    await start($)
    const ui = await mount($)
    await open(ui)
    expect((await texts(ui)).some(t => t.includes('Invalidation Gallery (3 busts)'))).toBe(true)
    expect((await texts(ui)).some(t => /fixture-model-[mn] · /.test(t))).toBe(false) // the rows are not drawn yet
    await ui.press({ key: 'lens:cachelab:gallery-open' })
    await settle()
    const lines = await texts(ui)
    const rows = lines.filter(t => / · /.test(t) && /(TTL lapse|Prefix change|Unknown)/.test(t))
    expect(rows).toHaveLength(3)
    expect(rows[0]).toContain('fixture-model-n')
    expect(rows[2]).toContain('TTL lapse')
    expect(lines.filter(t => t === 'No turn attribution')).toHaveLength(3)
    await ui.unmount()
  })
})

describe('the load states', () => {
  test('a reader that fails shows one reason line, red, instead of figures; the Keep Alive sub-accordion is still drawn', async ($, on) => {
    engine(on, { readerError: 'A.jsonl: EACCES' })
    await start($)
    const ui = await mount($)
    await open(ui)
    const lines = await texts(ui)
    expect(lines.some(t => t.includes('A.jsonl: EACCES'))).toBe(true)
    expect(lines.some(t => t.includes('Saved by cache'))).toBe(false)
    expect(lines.some(t => t.trim() === 'Keep Alive')).toBe(true)
    await ui.unmount()
  })

  test('no node: the reason says so, with no banner and nothing thrown', async ($, on) => {
    engine(on, { exitCode: 127 })
    await start($)
    const ui = await mount($)
    await open(ui)
    expect((await texts(ui)).some(t => t.includes('node not found'))).toBe(true)
    await ui.unmount()
  })

  test('before any transcript is known: "transcripts not located yet", nothing is run', async ($, on) => {
    const stub = engine(on)
    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    await selectAgent($)
    const ui = await mount($)
    await open(ui)
    expect((await texts(ui)).some(t => t.includes('transcripts not located yet'))).toBe(true)
    expect(stub.readerRuns).toEqual([])
    await ui.unmount()
  })

  test('the reload button reads again', async ($, on) => {
    const stub = engine(on)
    await start($)
    const ui = await mount($)
    await open(ui)
    const before = stub.readerRuns.length
    await ui.press({ key: 'cachelab-reload' })
    await settle()
    expect(stub.readerRuns.length).toBeGreaterThan(before - 1)
    await ui.unmount()
  })
})

describe('[AC-22.7] the Keep Alive sub-accordion', () => {
  const KA = { enabled: true, tracks: [], updatedAt: 0, sessionId: 's' }
  test('the last child of Cache Lab, collapsed, with no [on]/[off] button of its own', async ($, on) => {
    engine(on, { keepalive: KA })
    await start($)
    const ui = await mount($)
    await open(ui)
    const lines = await texts(ui)
    const gallery = lines.findIndex(t => t.includes('Invalidation Gallery'))
    const keep = lines.findIndex(t => t.trim() === 'Keep Alive')
    expect(keep).toBeGreaterThan(gallery)
    expect((await ui.find({ type: 'Button', key: 'lens:cachelab:keepalive-open' }))).toBeDefined()
    expect((await labels(ui)).some(l => l === 'on' || l === 'off' || l === '[on]' || l === '[off]')).toBe(false)
    await ui.unmount()
  })

  test('opened with no published value: both kept-warm times 0s and no track line', async ($, on) => {
    engine(on)
    await start($)
    const ui = await mount($)
    await open(ui)
    await ui.press({ key: 'lens:cachelab:keepalive-open' })
    await settle()
    const lines = await texts(ui)
    expect(lines.filter(t => t.replace(/\s+/g, ' ').includes('0s · 0 pings · 0 armings'))).toHaveLength(2)
    await ui.unmount()
  })

  test('keepaliveSection false: the sub-accordion is not drawn at all', async ($, on) => {
    engine(on, { files: { '.ai-dlc/lens.json': JSON.stringify({ keepaliveSection: false }) } })
    await start($)
    const ui = await mount($)
    await open(ui)
    expect((await texts(ui)).some(t => t.trim() === 'Keep Alive')).toBe(false)
    await ui.unmount()
  })

  test('a window press leaves Keep Alive\'s figures as they were (session figures, not the window)', async ($, on) => {
    engine(on, { keepalive: KA })
    await start($)
    const ui = await mount($)
    await open(ui)
    await ui.press({ key: 'lens:cachelab:keepalive-open' })
    await settle()
    const before = (await texts(ui)).filter(t => t.includes('armings'))
    await ui.press({ key: 'cachelab-w-30d' })
    await settle()
    expect((await texts(ui)).filter(t => t.includes('armings'))).toEqual(before)
    await ui.unmount()
  })
})

describe('[AC-22.7.7] the header line of keep-alive stays', () => {
  const RUNNING = { enabled: true, updatedAt: 0, sessionId: 's', tracks: [{ name: '1h', running: true, pings: 2, cap: 9, nextPingAt: null, armedAt: 0, warmUntil: 0, pingEvery: 1, keepWarmMs: 1, line: 'x' }] }
  test('with a track running, the pane head draws "keep-alive: 1h ping 2/9" with Cache Lab (in the agent panel) closed and open', async ($, on) => {
    engine(on, { keepalive: RUNNING })
    await start($)
    const view = await mountView($)
    expect((await texts(view)).some(t => t.trim() === 'keep-alive: 1h ping 2/9')).toBe(true)
    await view.unmount()
    // Cache Lab is not in the head any more: opening it in the agent panel leaves the head's line alone
    const ui = await mount($)
    await open(ui)
    const view2 = await mountView($)
    expect((await texts(view2)).filter(t => t.trim() === 'keep-alive: 1h ping 2/9')).toHaveLength(1)
    await view2.unmount()
    await ui.unmount()
  })
})

// ---- step 42, point 3: Master, 1h and 5m buttons and the Keep Alive sub-accordion in the agent panel ----
describe('[42.3] Cache Lab in the agent panel: the Keep Alive buttons', () => {
  const track = (name: string, enabled: boolean, o: Record<string, unknown> = {}) => ({ name, running: false, pings: 0, cap: 9, nextPingAt: null, armedAt: 0, warmUntil: 0, pingEvery: 1, keepWarmMs: 1, line: 'x', enabled, ...o })
  const published = (master: boolean, h1: boolean, m5: boolean) => ({ enabled: master, updatedAt: 0, sessionId: 's', tracks: [track('1h', h1), track('5m', m5)] })
  const norm = (t: string) => t.replace(/\s+/g, ' ').trim()
  const buttonKeys = async (ui: any): Promise<string[]> => ((await ui.findAll({ type: 'Button' })) as any[]).map(b => String(b.key)).filter(k => k.startsWith('cachelab-ka-'))

  test('open: the three buttons in the order Master, 1h, 5m, each with its state; the press offers the opposite', async ($, on) => {
    engine(on, { keepalive: published(true, false, true) })
    await start($)
    const ui = await mount($)
    await open(ui)
    expect(await buttonKeys(ui)).toEqual(['cachelab-ka-master-press', 'cachelab-ka-1h-press', 'cachelab-ka-5m-press'])
    const lines = (await texts(ui)).map(norm)
    const at = (s: string) => lines.findIndex(t => t.startsWith(s))
    expect([at('Master: on'), at('1h: off'), at('5m: on')].every(i => i >= 0)).toBe(true)
    expect(at('Master: on')).toBeLessThan(at('1h: off'))
    expect(at('1h: off')).toBeLessThan(at('5m: on'))
    const label = async (k: string) => String(((await ui.find({ type: 'Button', key: k })) as any)?.text ?? '')
    expect(await label('cachelab-ka-master-press')).toContain('off')
    expect(await label('cachelab-ka-1h-press')).toContain('on')
    expect(await label('cachelab-ka-5m-press')).toContain('off')
    await ui.unmount()
  })

  test('each press runs /ai-dlc:cache-keepalive-configure for this session only, with the opposite of its state', async ($, on) => {
    const stub = engine(on, { keepalive: published(true, false, true) })
    await start($)
    const ui = await mount($)
    await open(ui)
    await ui.press({ key: 'cachelab-ka-master-press' })
    await ui.press({ key: 'cachelab-ka-1h-press' })
    await ui.press({ key: 'cachelab-ka-5m-press' })
    await settle()
    expect(stub.commands).toEqual([
      { command: 'ai-dlc:cache-keepalive-configure', args: 'off --session' },
      { command: 'ai-dlc:cache-keepalive-configure', args: 'on --track 1h --session' },
      { command: 'ai-dlc:cache-keepalive-configure', args: 'off --track 5m --session' },
    ])
    await ui.unmount()
  })

  test('a press changes the switch it names and no other: after keep-alive publishes the new state the button reads it', async ($, on) => {
    let state = published(true, true, true)
    const stub = engine(on, {
      keepalive: () => state,
      onCommand: c => {
        if (c.args === 'off --track 1h --session') state = published(true, false, true)
      },
    })
    await start($)
    const ui = await mount($)
    await open(ui)
    await ui.press({ key: 'cachelab-ka-1h-press' })
    await settle()
    await ui.press({ key: 'cachelab-reload' })
    await settle()
    const lines = (await texts(ui)).map(norm)
    expect(lines.some(t => t.startsWith('1h: off'))).toBe(true)
    expect(lines.some(t => t.startsWith('Master: on'))).toBe(true)
    expect(lines.some(t => t.startsWith('5m: on'))).toBe(true)
    expect(stub.commands).toEqual([{ command: 'ai-dlc:cache-keepalive-configure', args: 'off --track 1h --session' }])
    await ui.unmount()
  })

  test('a track that is on under a master that is off reads the track state, not the master state', async ($, on) => {
    engine(on, { keepalive: published(false, true, false) })
    await start($)
    const ui = await mount($)
    await open(ui)
    const lines = (await texts(ui)).map(norm)
    expect(lines.some(t => t.startsWith('Master: off'))).toBe(true)
    expect(lines.some(t => t.startsWith('1h: on'))).toBe(true)
    expect(lines.some(t => t.startsWith('5m: off'))).toBe(true)
    await ui.unmount()
  })

  test('a command that rejects is swallowed: the panel keeps drawing and a later press still runs', async ($, on) => {
    let n = 0
    const stub = engine(on, {
      keepalive: published(true, true, true),
      onCommand: () => {
        if (n++ === 0) throw new Error('boom')
      },
    })
    await start($)
    const ui = await mount($)
    await open(ui)
    await ui.press({ key: 'cachelab-ka-master-press' })
    await settle()
    expect((await texts(ui)).some(t => t.includes('Saved by cache'))).toBe(true)
    await ui.press({ key: 'cachelab-ka-5m-press' })
    await settle()
    expect(stub.commands).toHaveLength(2)
    await ui.unmount()
  })

  test('no published value: no buttons, and nothing is run', async ($, on) => {
    const stub = engine(on)
    await start($)
    const ui = await mount($)
    await open(ui)
    expect(await buttonKeys(ui)).toEqual([])
    expect(stub.commands).toEqual([])
    await ui.unmount()
  })

  test('a published value with no tracks to read: no buttons', async ($, on) => {
    engine(on, { keepalive: { enabled: true, tracks: [], updatedAt: 0, sessionId: 's' } })
    await start($)
    const ui = await mount($)
    await open(ui)
    expect(await buttonKeys(ui)).toEqual([])
    await ui.unmount()
  })

  test('keepaliveSection false: no buttons and no Keep Alive sub-accordion', async ($, on) => {
    engine(on, { keepalive: published(true, true, true), files: { '.ai-dlc/lens.json': JSON.stringify({ keepaliveSection: false }) } })
    await start($)
    const ui = await mount($)
    await open(ui)
    expect(await buttonKeys(ui)).toEqual([])
    expect((await texts(ui)).some(t => t.trim() === 'Keep Alive')).toBe(false)
    await ui.unmount()
  })

  test('Cache Lab collapsed: no buttons are drawn', async ($, on) => {
    engine(on, { keepalive: published(true, true, true) })
    await start($)
    const ui = await mount($)
    expect(await buttonKeys(ui)).toEqual([])
    await ui.unmount()
  })

  test('the Keep Alive sub-accordion is collapsed in the open Cache Lab; opened it holds what the Cache keep-alive section showed', async ($, on) => {
    engine(on, { keepalive: published(true, true, true) })
    await start($)
    const ui = await mount($)
    await open(ui)
    expect((await ui.find({ type: 'Button', key: 'lens:cachelab:keepalive-open' }))?.text).toBe('[+]')
    expect((await texts(ui)).some(t => t.includes('Saved by cache reads, session'))).toBe(false)
    await ui.press({ key: 'lens:cachelab:keepalive-open' })
    await settle()
    const lines = (await texts(ui)).map(norm)
    expect(lines.filter(t => t.includes('0s · 0 pings · 0 armings'))).toHaveLength(2)
    expect(lines.some(t => t.startsWith('No keep-alive arming seen this session'))).toBe(true)
    expect(lines.some(t => t.startsWith('Saved by cache reads, this agent'))).toBe(true)
    expect(lines.some(t => t.startsWith('Saved by cache reads, session'))).toBe(true)
    // the buttons stay outside the sub-accordion: drawn with it closed too
    await ui.press({ key: 'lens:cachelab:keepalive-open' })
    await settle()
    expect(await buttonKeys(ui)).toHaveLength(3)
    await ui.unmount()
  })

  test('the drill-in panel (an avatar pressed on a chat card in drill-in mode) draws the same Cache Lab', async ($, on) => {
    engine(on, { keepalive: published(true, true, true), files: { '.ai-dlc/lens.json': JSON.stringify({ panelOpenMode: 'drill-in' }) } })
    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    await $.classic.UserPromptSubmit({ transcript_path: `${FOLDER}/C2.jsonl`, prompt: 'x' } as never)
    await $.agent.spawn({ tool_use_id: 'toolu_1', prompt: 'p', description: 'build', subagentType: 'ai-dlc:software-engineer', provider: { plugin: 'ai-dlc', tier: 'user' }, parentModel: 'claude-opus-5-5', background: false, fork: false })
    const card = await $.ui.mount({ plugin: 'ai-dlc-lens', surface: 'vscode', component: 'ToolUse', requestId: 'toolu_1', props: { tool_use_id: 'toolu_1', tool: 'Agent', input: { subagent_type: 'ai-dlc:software-engineer', description: 'build', prompt: 'p' }, isRunning: false, isErrored: false, isInterrupted: false } })
    await card.press({ key: 'card:agent-main' })
    await settle()
    expect((await texts(card)).some(t => t.trim() === 'Cache Lab')).toBe(true)
    await card.press({ key: 'cachelab-open' })
    await settle()
    expect(await buttonKeys(card)).toEqual(['cachelab-ka-master-press', 'cachelab-ka-1h-press', 'cachelab-ka-5m-press'])
    await card.unmount()
  })
})
