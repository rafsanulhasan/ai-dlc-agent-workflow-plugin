import { describe, expect, mock, test } from 'claude-code/testing'
import { cacheKey } from '../hooks/diagram'
// The test runs under bun, which has timers; the hooks lib (es2023, no DOM) does not declare them.
declare const setTimeout: (fn: (...args: never[]) => void, ms: number) => unknown

// registerDiagram (ITEM-053.c, diagramming LLD 4): an assistant message with Mermaid fences is drawn as
// pictures through the child renderer. The engine is stubbed at its edges: `process.run` answers `node
// --version` and the renderer with envelopes, the clock is the engine's virtual one.

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="10" height="10"><rect width="10" height="10"/></svg>'
const ENVELOPE = (body = SVG) => JSON.stringify({ data: { format: 'svg', body, width: 10, height: 10 }, error: null }) + '\n'
const FLOW = (n = 'A') => `\`\`\`mermaid\nflowchart LR\n  ${n}[Start] --> B[End]\n\`\`\``

type Harness = {
  renders: string[]
  invalidations: number
  /** Resolves the held renderer run with this stdout. */
  finishRender: (stdout?: string) => void
  /** Fires the render deadline (RENDER_WAIT_MS passes). */
  fireDeadline: () => Promise<void>
  renderStarted: () => boolean
}

function engine(on: any, o: { hold?: boolean; node?: boolean; stdout?: string; writes?: Record<string, string>; disk?: Record<string, string> } = {}): Harness {
  const ctl: Harness = { renders: [], invalidations: 0, finishRender: () => {}, fireDeadline: async () => {}, renderStarted: () => false }
  const held: ((s: string) => void)[] = []
  ctl.finishRender = (s = ENVELOPE()) => { for (const r of held.splice(0)) r(s) }
  // The deadline is the engine's virtual clock: advancing it past RENDER_WAIT_MS fires every pending wait
  const clock = mock.clock(on as never)
  ctl.fireDeadline = async () => { for (let i = 0; i < 3; i++) { await settle(); await clock.advance(1000) } }
  const result = (stdout: string, exitCode = 0) => ({ value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
  on('process.run', (_: unknown, e: any) => {
    const argv: string[] = e.argv
    if (argv[1] === '--version') return result('v24.0.0\n', o.node === false ? 127 : 0)
    ctl.renders.push(String(e.stdin ?? e.options?.stdin ?? e.input ?? JSON.stringify(e)))
    if (o.hold) return new Promise(r => held.push(s => r(result(s)))) as never
    return result(o.stdout ?? ENVELOPE())
  })
  on('ui.invalidate', () => { ctl.invalidations++; return { value: undefined } as never })
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('fs.exists', () => ({ value: false }))
  on('fs.stat', () => { throw new Error('ENOENT') })
  on('fs.list', () => { throw new Error('ENOENT') })
  on('fs.read', (_: unknown, e: any) => {
    const cached = Object.keys(o.disk ?? {}).find(k => String(e.path).replaceAll(String.fromCharCode(92), '/').endsWith(k))
    if (cached) return { value: o.disk![cached] }
    if (String(e.path).endsWith('plugin.json')) return { value: JSON.stringify({ version: '9.9.9' }) }
    throw new Error(`ENOENT ${e.path}`)
  })
  on('fs.write', (_: unknown, e: any) => { if (o.writes) o.writes[String(e.path).replace(/\\/g, '/')] = e.text; return { value: undefined } })
  mock.env(on as never, { HOME: '/home/test' })
  // the engine's own drawing, beneath the lens: what a message with no diagram shows
  on('ui.render', ($: any, e: any) => { try { const { Text } = $.ui.resolve(e); return <Text>NATIVE</Text> } catch (err) { throw new Error('STUB: ' + String(err)) } })
  ctl.renderStarted = () => ctl.renders.length > 0
  return ctl
}

const message = ($: any, text: string, surface: 'vscode' | 'terminal' = 'vscode') =>
  $.ui.mount({ plugin: 'ai-dlc-lens', surface, component: 'AssistantMessage', props: { text } })
const shown = async (ui: any): Promise<string[]> => ((await ui.findAll({})) as any[]).map(x => `${x.type}:${x.text ?? x.alt ?? ''}`)
// what a mount that never returned races against
const TIMEOUT = Symbol('timeout')
const until = async (check: () => boolean) => { for (let i = 0; i < 200 && !check(); i++) await new Promise(r => setTimeout(r, 10)) }
const settle = async () => { for (let i = 0; i < 200; i++) await Promise.resolve(); await new Promise(r => setTimeout(r, 20)) }

describe('registerDiagram: a closed Mermaid fence is drawn', () => {
  test('the source stays, then its picture, drawn by the renderer; the surface that draws SVG gets an Svg', async ($, on) => {
    const ctl = engine(on)
    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    const ui = await message($, `before\n\n${FLOW()}\n\nafter`)
    const all = await shown(ui)
    expect(ctl.renders).toHaveLength(1)
    expect(ctl.renders[0]).toContain('flowchart LR')
    expect(all.some(x => x.startsWith('Svg:'))).toBe(true)
    await ui.unmount()
  })

  test('the renderer is asked for the source with its remote references removed, and the removed note is shown', async ($, on) => {
    const ctl = engine(on)
    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    const ui = await message($, '```mermaid\nflowchart LR\n  A --> B\n  click A href "http://example.test/"\n```')
    expect(ctl.renders[0]).not.toContain('http://example.test')
    expect((await shown(ui)).some(x => x.includes('removed 1 remote reference(s)'))).toBe(true)
    await ui.unmount()
  })

  for (const [name, text] of [
    ['an unclosed fence', '```mermaid\nflowchart LR\n  A --> B'],
    ['a text with no fence', 'no diagram here'],
    ['a plantuml fence (deferred kind)', '```plantuml\n@startuml\n@enduml\n```'],
    ['a math fence (deferred kind)', '```math\nx^2\n```'],
  ] as const) {
    test(`${name} is drawn as it is: the renderer is never run`, async ($, on) => {
      const ctl = engine(on)
      await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
      const ui = await message($, text)
      await ui.unmount()
      expect(ctl.renders).toEqual([])
    })
  }

  test('an unsupported Mermaid kind says so and runs nothing', async ($, on) => {
    const ctl = engine(on)
    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    const ui = await message($, '```mermaid\npie title Pets\n  "Dogs" : 3\n```')
    expect((await shown(ui)).some(x => x.includes('mermaid diagram type "pie" is not supported offline'))).toBe(true)
    expect(ctl.renders).toEqual([])
    await ui.unmount()
  })

  test('without node on PATH the reason says so', async ($, on) => {
    engine(on, { node: false })
    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    const ui = await message($, FLOW())
    expect((await shown(ui)).some(x => x.includes('diagram renderer needs node on PATH'))).toBe(true)
    await ui.unmount()
  })

  test('a renderer error is shown as one reason line; the source stays', async ($, on) => {
    engine(on, { stdout: JSON.stringify({ data: null, error: 'Invalid mermaid header: x' }) + '\n' })
    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    const ui = await message($, FLOW())
    const all = await shown(ui)
    expect(all.some(x => x.includes('diagram not drawn: Invalid mermaid header: x'))).toBe(true)
    await ui.unmount()
  })

  test('an SVG from the renderer is scrubbed again before it is drawn', async ($, on) => {
    engine(on, { stdout: ENVELOPE('<svg viewBox="0 0 1 1" width="1" height="1"><script>alert(1)</script><rect onclick="x()" width="1" height="1"/></svg>') })
    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    const ui = await message($, FLOW('S'))
    const svg = ((await ui.findAll({})) as any[]).find(x => x.type === 'Svg')
    expect(svg).toBeDefined()
    const drawn = String(svg.source ?? svg.props?.source ?? '')
    expect(drawn).toContain('<rect')
    expect(drawn).not.toMatch(/script|onclick/)
    await ui.unmount()
  })

  test('a picture on disk is drawn with a cold memory: the renderer is not run', async ($, on) => {
    const source = 'flowchart LR\n  D[Start] --> B[End]'
    const key = cacheKey('mermaid', 'png', '9.9.9', source)
    const ctl = engine(on, { disk: { [`/.claude/state/ai-dlc-lens/diagrams/${key}.json`]: JSON.stringify({ format: 'png', body: 'AAAA', width: 10, height: 10 }) } })
    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    const ui = await message($, '```mermaid\n' + source + '\n```')
    expect(ctl.renders).toEqual([])
    const drawn = await shown(ui)
    expect(drawn.some(x => x.startsWith('Text:'))).toBe(false) // no reason line: not 'rendering…', not an error
    expect(drawn.length).toBeGreaterThan(2) // the source, then its picture
    await ui.unmount()
  })

  test('a drawn picture is written to the disk cache, and the next message is served from memory without a second render', async ($, on) => {
    const writes: Record<string, string> = {}
    const ctl = engine(on, { writes })
    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    const a = await message($, FLOW('K'))
    await a.unmount()
    expect(Object.keys(writes).some(p => p.includes('/home/test/.claude/state/ai-dlc-lens/diagrams/mermaid-'))).toBe(true)
    const b = await message($, FLOW('K'))
    await b.unmount()
    expect(ctl.renders).toHaveLength(1)
  })
})

describe('registerDiagram: two identical fences in one message (cr-std-41, am-41 fix)', () => {
  test('both are drawn from one renderer run when it lands inside the deadline', async ($, on) => {
    const ctl = engine(on)
    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    const ui = await message($, `${FLOW('D')}\n\ntext between\n\n${FLOW('D')}`)
    expect(ctl.renders).toHaveLength(1)
    expect((await shown(ui)).filter(x => x.startsWith('Svg:'))).toHaveLength(2)
    await ui.unmount()
  })

  test('one fence: the deadline passes first, so it shows "rendering…"', async ($, on) => {
    const ctl = engine(on, { hold: true })
    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    const pending = message($, FLOW('O'))
    await until(() => ctl.renderStarted())
    await ctl.fireDeadline()
    const got: any = await Promise.race([pending, new Promise(r => setTimeout(() => r(TIMEOUT), 1500))])
    expect(got).not.toBe(TIMEOUT)
    expect((await shown(got)).some(x => x.includes('rendering…'))).toBe(true)
    await got.unmount()
  })

  const two = (n: string) => `${FLOW(n)}\n\nbetween\n\n${FLOW(n)}`

  test('when the deadline passes first, both fences show "rendering…" and the renderer ran once', async ($, on) => {
    const ctl = engine(on, { hold: true })
    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    const pending = message($, two('E'))
    await until(() => ctl.renderStarted())
    await ctl.fireDeadline()
    const got: any = await Promise.race([pending, new Promise(r => setTimeout(() => r(TIMEOUT), 1500))])
    expect(got).not.toBe(TIMEOUT)
    const ui = got
    const first = await shown(ui)
    expect(first.filter(x => x === 'Text:rendering…')).toHaveLength(2)
    expect(first.some(x => x.startsWith('Svg:'))).toBe(false)
    expect(ctl.renders).toHaveLength(1)
    await ui.unmount()
  })

  test('the result of a late render asks for one redraw, and the next draw shows both pictures', async ($, on) => {
    const ctl = engine(on, { hold: true })
    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    const pending = message($, two('P'))
    await until(() => ctl.renderStarted())
    await ctl.fireDeadline()
    const ui = await pending
    const before = ctl.invalidations
    ctl.finishRender()
    await until(() => ctl.invalidations > before)
    expect(ctl.invalidations).toBeGreaterThan(before)
    await ui.unmount()
    const again = await message($, two('P'))
    expect((await shown(again)).filter(x => !x.includes('rendering…') && (x.startsWith('Svg:') || x.startsWith('Image:')))).toHaveLength(2)
    expect(ctl.renders).toHaveLength(1)
    await again.unmount()
  })

  test('a second render that finds the first one\'s job in flight waits for it and is also redrawn', async ($, on) => {
    const ctl = engine(on, { hold: true })
    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    const one = message($, FLOW('F'))
    await settle()
    const two = message($, FLOW('F'))
    await settle()
    expect(ctl.renders).toHaveLength(1)
    ctl.finishRender()
    const [a, b] = await Promise.all([one, two])
    expect((await shown(a)).some(x => x.startsWith('Svg:'))).toBe(true)
    expect((await shown(b)).some(x => x.startsWith('Svg:'))).toBe(true)
    await a.unmount()
    await b.unmount()
  })

  test('different diagrams are different jobs', async ($, on) => {
    const ctl = engine(on)
    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    const ui = await message($, `${FLOW('G')}\n\n${FLOW('H')}`)
    expect(ctl.renders).toHaveLength(2)
    await ui.unmount()
  })
})
