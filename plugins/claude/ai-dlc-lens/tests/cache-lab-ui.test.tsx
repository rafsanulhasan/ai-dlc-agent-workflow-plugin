import { describe, expect, mock, test } from 'claude-code/testing'
import type { Call } from '../hooks/transcripts'

// The Cache Lab accordion of the lens pane (cache-lab spec: AC-22.2.1, 22.2.12, 22.2.13, 22.1.5, 22.4, 22.7, 22.8;
// ITEM-070 to 074 and 077). The engine is stubbed at its edges: `process.run` answers the transcript reader's
// `list` and `read` from calls built here (the reader itself is tested by tests/cache-reader/), the price file is
// a fixture, and keep-alive's published value comes from `state.get`.

const DAY = 86_400_000
const PANE = 'ai-dlc-lens-chart'
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

type Stub = { readerRuns: string[][]; fileWrites: string[]; stores: Map<string, unknown>; storeWrites: string[] }

function engine(on: any, o: { now?: number; prices?: string | null; chain?: { id: string; sessions: string[] } | null | (() => { id: string; sessions: string[] } | null); files?: Record<string, string>; keepalive?: unknown; calls?: Call[]; readerError?: string; exitCode?: number; env?: Record<string, string> } = {}): Stub {
  const now = o.now ?? Date.now()
  const all = o.calls ?? calls(now)
  const stub: Stub = { readerRuns: [], fileWrites: [], stores: new Map(), storeWrites: [] }
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
  on('state.get', (_: unknown, e: any, next: any) => (e.plugin === 'ai-dlc' && e.key === 'keepalive' ? { value: { value: ((c: any) => (c === null || c === undefined ? o.keepalive : { ...((o.keepalive as object) ?? {}), chain: c }))(typeof o.chain === 'function' ? o.chain() : o.chain), version: 1 } } : next(e)))
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
    const hit = Object.keys(o.files ?? {}).find(k => path.endsWith(k))
    if (hit) return { value: o.files![hit] }
    if (o.prices !== null && path.endsWith('.ai-dlc/model-metadata.json')) return { value: o.prices ?? PRICES }
    throw new Error(`ENOENT ${path}`)
  })
  on('fs.write', (_: unknown, e: any) => (stub.fileWrites.push(String(e.path)), { value: undefined }))
  mock.env(on as never, { HOME: '/home/test', ...(o.env ?? {}) })
  // the classic hooks nothing beneath the lens answers
  on('classic.UserPromptSubmit', () => ({}))
  on('classic.SessionStart', () => ({}))
  on('classic.Stop', () => ({}))
  return stub
}

const mount = ($: any, surface: 'vscode' | 'terminal' = 'vscode') =>
  $.ui.mount({ plugin: 'ai-dlc-lens', surface, component: 'Pane', requestId: PANE, props: { title: PANE, isFocused: false, bodyColumns: 120, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} } })
const start = async ($: any, session = 'C2') => {
  await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
  await $.classic.UserPromptSubmit({ transcript_path: `${FOLDER}/${session}.jsonl`, prompt: 'x' } as never)
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
  test('it is in the lens pane head, labelled "Cache Lab" (capital L), collapsed, with a [+] button', async ($, on) => {
    engine(on)
    await start($)
    const ui = await mount($)
    expect((await texts(ui)).some(t => t.trim() === 'Cache Lab')).toBe(true)
    expect((await ui.find({ type: 'Button', key: 'cachelab-open' }))?.text ?? (await labels(ui))[0]).toBeDefined()
    expect((await labels(ui)).some(l => l === '[+]')).toBe(true)
    // collapsed: no figures, and the transcripts are never read while it is closed
    expect((await texts(ui)).some(t => t.includes('Saved by cache'))).toBe(false)
    await ui.unmount()
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
  test('with a track running, the pane head draws "keep-alive: 1h ping 2/9" with Cache Lab closed and open', async ($, on) => {
    engine(on, { keepalive: RUNNING })
    await start($)
    const ui = await mount($)
    expect((await texts(ui)).some(t => t.trim() === 'keep-alive: 1h ping 2/9')).toBe(true)
    await open(ui)
    expect((await texts(ui)).filter(t => t.trim() === 'keep-alive: 1h ping 2/9')).toHaveLength(1)
    await ui.unmount()
  })
})
