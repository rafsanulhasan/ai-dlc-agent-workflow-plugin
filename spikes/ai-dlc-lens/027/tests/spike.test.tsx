import { describe, expect, test } from 'claude-code/testing'
import { fmtModel, fmtTokens, matchHandoff, mergeStopTasks, parseRecord, pickHandback, windowFor } from '../hooks/lens'

const PLUGIN = 'ai-dlc-lens-spike-027'
const SURFACES = ['terminal', 'vscode'] as const

const pane = (requestId: string, placement: 'dock' | 'inline' = 'dock', bodyColumns = 120) =>
  ({
    plugin: PLUGIN,
    component: 'Pane',
    requestId,
    props: {
      title: requestId,
      isFocused: false,
      bodyColumns,
      placement,
      scroll: { offset: 0, bodyRows: 80 },
      view: {},
    },
  }) as const

// ---------------- round-0 kit (/spike027-kit) ----------------
describe('kit', () => {
  test('K1: dock draws flowchart, inline draws compact', async ($, on) => {
    on('command.register', () => ({ value: { command: 'x' } }))
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    for (const surface of SURFACES) {
      const dock = await $.ui.mount({ ...pane('lens-spike-027', 'dock', 120), surface })
      expect(await dock.find({ type: 'Text', text: /^FLOWCHART/ })).toBeDefined()
      await dock.unmount()
      const inline = await $.ui.mount({ ...pane('lens-spike-027', 'inline', 60), surface })
      expect(await inline.find({ type: 'Text', text: /^COMPACT/ })).toBeDefined()
      await inline.unmount()
    }
  })

  test('K3: pane [+] button toggles and counts', async ($, on) => {
    on('command.register', () => ({ value: { command: 'x' } }))
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    let n = 0
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...pane('lens-spike-027'), surface })
      await ui.press({ key: 'pane-expand' })
      n += 1
      expect(await ui.find({ type: 'Text', text: new RegExp(`presses=${n}$`) })).toBeDefined()
      const shown = await ui.find({ type: 'Text', text: /expanded content/ })
      expect(shown !== undefined).toBe(n % 2 === 1)
      await ui.unmount()
    }
  })

  test('K4: an Agent ToolUse card keeps the engine row inside it, last (US-15)', async ($, on) => {
    on('ui.render', ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>NATIVE ROW</Text>
    })
    for (const surface of SURFACES) {
      const ui = await $.ui.mount(toolRow('toolu_1', surface, { subagent_type: 'ai-dlc:software-architect', description: 'design', prompt: 'p' }))
      expect(await ui.find({ type: 'Text', text: /^Workflow: Main spawned 1 agent$/ })).toBeDefined()
      const all = await ui.findAll({})
      expect(all.findIndex((x: any) => x.text === 'NATIVE ROW')).toBe(all.length - 1)
      await ui.unmount()
    }
  })
})

/** A transcript row of a tool call, as the engine mounts it. */
function toolRow(id: string, surface: (typeof SURFACES)[number], input: Record<string, unknown>, tool = 'Agent') {
  return {
    plugin: PLUGIN,
    surface,
    component: 'ToolUse',
    requestId: id,
    props: { tool_use_id: id, tool, input, isRunning: false, isErrored: false, isInterrupted: false },
  } as const
}

// ---------------- round-1 helpers ----------------
describe('figures', () => {
  test('L3: token and model formatting', () => {
    expect(fmtTokens(950)).toBe('950')
    expect(fmtTokens(12_345)).toBe('12.3K')
    expect(fmtTokens(100_000)).toBe('100K')
    expect(fmtTokens(999_999)).toBe('1M')
    expect(fmtTokens(1_000_000)).toBe('1M')
    expect(fmtTokens(1_234_567)).toBe('1.2M')
    expect(fmtModel('claude-opus-5-5')).toBe('opus/opus-5.5')
    expect(fmtModel('claude-sonnet-4-5-20250929')).toBe('sonnet/sonnet-4.5')
    expect(fmtModel('claude-opus-4-7[1m]')).toBe('opus/opus-4.7[1m]')
    expect(fmtModel('haiku')).toBe('haiku')
    expect(windowFor('claude-opus-4-7[1m]', 'x', 0).n).toBe(1_000_000)
    expect(windowFor('m', 'm', 500_000)).toEqual({ n: 500_000, how: 'same model as main' })
    expect(windowFor('other', 'm', 500_000).how).toBe('assumed')
  })

  test('L4: the record path on the brief first line, then its hand-back', () => {
    const brief = 'Your handoff record is docs\\handoffs\\R\\17-orchestrator-to-agent-manager.handoff.md (repository root e:\\x).\nDo it.'
    expect(matchHandoff(brief)).toEqual({ path: 'docs/handoffs/R/17-orchestrator-to-agent-manager.handoff.md', how: 'first line' })
    expect(matchHandoff('Do it.\nRecord: 2.1-orchestrator-to-sqa-engineer.handoff.md')?.how).toBe('body')
    expect(matchHandoff('no record')).toBe(null)
    const rec = parseRecord('docs/handoffs/R/1.l1-orchestrator-to-agent-manager.handoff.md')
    expect(rec).toEqual({ dir: 'docs/handoffs/R', file: '1.l1-orchestrator-to-agent-manager.handoff.md', code: '1.l1', from: 'orchestrator', to: 'agent-manager' })
    const names = ['1-agent-manager-to-orchestrator.handback.md', '1.l1-agent-manager-to-orchestrator.handback.md', '1.l1-x-to-y.handback.md']
    expect(pickHandback(names, rec!)).toBe('1.l1-agent-manager-to-orchestrator.handback.md')
  })
})

// ---------------- round-1 lens card (/spike027) ----------------
const RECORD = 'docs/handoffs/R/17-orchestrator-to-agent-manager.handoff.md'
const HANDBACK = 'docs/handoffs/R/17-agent-manager-to-orchestrator.handback.md'

/**
 * `parallel`: main's step asks for two Agent calls (toolu_1 -> a1 agent-manager, toolu_2 -> a2
 * sqa-engineer) as one message; `spawnSecond: false` leaves toolu_2 unspawned; `complete: false`
 * leaves a1 running.
 */
async function seed($: any, on: any, opts: { parallel?: boolean; spawnSecond?: boolean; complete?: boolean } = {}) {
  const { parallel = false, spawnSecond = true, complete = true } = opts
  const opened: string[] = []
  on('ui.render', ($s: any, e: any) => {
    const { Text } = $s.ui.resolve(e)
    return <Text>NATIVE ROW</Text>
  })
  on('command.register', () => ({ value: { command: 'x' } }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 10 }, rateLimits: [] } }))
  on('settings.read', () => ({ value: { agent: 'ai-dlc:orchestrator' } }))
  on('fs.exists', () => ({ value: false }))
  on('fs.read', (_: unknown, e: any) => ({ value: JSON.stringify(e).includes('handback') ? 'HANDBACK BODY' : 'HANDOFF BODY' }))
  on('fs.list', () => ({ value: [{ name: '17-orchestrator-to-agent-manager.handoff.md', kind: 'file', size: 1, mtimeMs: 1 }, { name: '17-agent-manager-to-orchestrator.handback.md', kind: 'file', size: 1, mtimeMs: 1 }] }))
  on('agent.list', () => ({ value: [{ id: 'a1', description: 'rework', type: 'ai-dlc:agent-manager', status: 'running' }] }))
  on('ui.open', (_: unknown, e: any) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('agent.spawn', (_: unknown, e: any) => ({ model: 'claude-opus-5-5', agentId: e.tool_use_id === 'toolu_2' ? 'a2' : 'a1' }))
  on('turn.step', async function* (_: unknown, e: any) {
    if (e.agentId === undefined) {
      if (parallel) {
        yield { kind: 'tool', index: 0, id: 'toolu_1', name: 'Agent' }
        yield { kind: 'tool', index: 1, id: 'toolu_2', name: 'Agent' }
      }
      yield { kind: 'stop', stopReason: 'end_turn', usage: { input_tokens: 5000, output_tokens: 1000, cache_read_input_tokens: 100_000, cache_creation_input_tokens: 2000, model: 'claude-opus-5-5' } }
      return { turnId: 'm', index: 0, answer: 'ok', toolUses: [], stopReason: 'end_turn', usage: null }
    }
    yield { kind: 'thinking', index: 0, text: 'SUBAGENT THOUGHT' }
    yield { kind: 'tool', index: 1, id: 'toolu_9', name: 'Read' }
    yield { kind: 'stop', stopReason: 'tool_use', usage: { input_tokens: 1000, output_tokens: 200_000, cache_read_input_tokens: 90_000, cache_creation_input_tokens: 9_000, model: 'claude-opus-5-5' } }
    return { turnId: 't', index: 0, answer: '', toolUses: [{ name: 'Read', input: {} }], stopReason: 'tool_use', usage: null }
  })
  on('tool.call', (_: unknown, e: any) => (e.tool === 'Bash' && e.run_in_background === true ? { result: { backgroundTaskId: 'b9' } } : { result: {} }))
  on('turn.complete', (_: unknown, e: any) => ({ text: e.answer }))
  on('classic.SubagentStop', () => ({}))

  await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
  for await (const _ of $.turn.step({ turnId: 'm', index: 0, model: 'claude-opus-5-5', messageCount: 1 })) {
    // drain the main step
  }
  if (parallel) {
    await $.tool.call({ tool: 'Agent', subagent_type: 'ai-dlc:agent-manager', description: 'rework', prompt: 'p', tool_use_id: 'toolu_1' })
    await $.tool.call({ tool: 'Agent', subagent_type: 'ai-dlc:sqa-engineer', description: 'tests', prompt: 'p', tool_use_id: 'toolu_2' })
  }
  await $.agent.spawn({
    tool_use_id: 'toolu_1',
    prompt: `Your handoff record is ${RECORD} (root x).\nDo it.`,
    description: 'rework',
    subagentType: 'ai-dlc:agent-manager',
    provider: { plugin: 'ai-dlc', tier: 'user' },
    parentModel: 'claude-opus-5-5',
    background: false,
    fork: false,
  })
  const stream = $.turn.step({ turnId: 't', index: 0, model: 'claude-opus-5-5', messageCount: 1, agentId: 'a1' })
  for await (const _ of stream) {
    // drain
  }
  await $.tool.call({ tool: 'Read', file_path: 'x.md', tool_use_id: 'toolu_9', agentId: 'a1' })
  if (parallel && spawnSecond)
    await $.agent.spawn({
      tool_use_id: 'toolu_2',
      prompt: 'Your handoff record is docs/handoffs/R/17.2-orchestrator-to-sqa-engineer.handoff.md.\nTest it.',
      description: 'tests',
      subagentType: 'ai-dlc:sqa-engineer',
      provider: { plugin: 'ai-dlc', tier: 'user' },
      parentModel: 'claude-opus-5-5',
      background: true,
      fork: false,
    })
  if (complete) await completeA1($)
  return opened
}

async function completeA1($: any) {
  await $.turn.complete({
    reason: 'answer',
    answer: 'done',
    durationMs: 1,
    isAborted: false,
    turnId: 't',
    agentId: 'a1',
    usage: { input_tokens: 1000, output_tokens: 200_000, cache_read_input_tokens: 90_000, cache_creation_input_tokens: 9_000, model: 'claude-opus-5-5' },
  })
}

const svgSource = async (ui: any): Promise<string> => {
  const svg: any = await ui.find({ type: 'Svg' })
  return String(svg?.props?.source ?? svg?.source ?? '')
}

// ---------------- round-2 chat card (the ToolUse row of an Agent call) ----------------
describe('chat card', () => {
  test('C1: one Agent call: the flowchart at the top, five lines per avatar, Buttons, native row last', async ($, on) => {
    await seed($, on)
    for (const surface of SURFACES) {
      const ui = await $.ui.mount(toolRow('toolu_1', surface, { subagent_type: 'ai-dlc:agent-manager', description: 'rework', prompt: 'p' }))
      const all = await ui.findAll({})
      expect(all.findIndex((x: any) => x.type === 'Text' && /^Workflow: Orchestrator spawned 1 agent$/.test(String(x.text)))).toBeGreaterThan(-1)
      expect(all.findIndex((x: any) => x.text === 'NATIVE ROW')).toBe(all.length - 1)
      if (surface === 'vscode') {
        const src = await svgSource(ui)
        for (const line of ['Orchestrator (opus/opus-5.5)', 'orchestrator (main)', 'Agent Manager (opus/opus-5.5)', '>agent-manager<', 'ctx 300K/1M', 'in 100K, out 200K', 'cache r 90K / w 9K / uncached 1K'])
          expect(src.includes(line)).toBe(true)
        const svgAt = all.findIndex((x: any) => x.type === 'Svg')
        expect(svgAt).toBeGreaterThan(-1)
        expect(svgAt).toBeLessThan(all.findIndex((x: any) => x.type === 'Button'))
      } else {
        expect(await ui.find({ type: 'Svg' })).toBe(undefined)
        expect(await ui.find({ type: 'Text', text: /-> .*Agent Manager \(opus\/opus-5\.5\)/ })).toBeDefined()
        expect(await ui.find({ type: 'Text', text: /^\s+agent-manager$/ })).toBeDefined()
        expect(await ui.find({ type: 'Text', text: /^\s+ctx 300K\/1M$/ })).toBeDefined()
        expect(await ui.find({ type: 'Text', text: /^\s+in 100K, out 200K$/ })).toBeDefined()
        expect(await ui.find({ type: 'Text', text: /^\s+cache r 90K \/ w 9K \/ uncached 1K$/ })).toBeDefined()
      }
      expect(await ui.find({ type: 'Button', key: 'agent-main' })).toBeDefined()
      expect(await ui.find({ type: 'Button', key: 'agent-a1' })).toBeDefined()
      expect((await ui.find({ type: 'Button', key: 'edge-a1' }))?.text).toMatch(/^17 Orchestrator -> Agent Manager$/)
      expect(await ui.find({ type: 'Button', key: 'card-thinking' })).toBeDefined()
      expect(await ui.find({ type: 'Button', key: 'card-context' })).toBeDefined()
      await ui.unmount()
    }
  })

  test('C2: two parallel Agent calls: one flowchart on the first row, both agents side by side; the second row compact', async ($, on) => {
    await seed($, on, { parallel: true })
    const first = await $.ui.mount(toolRow('toolu_1', 'vscode', { subagent_type: 'ai-dlc:agent-manager', description: 'rework', prompt: 'p' }))
    expect(await first.find({ type: 'Text', text: /^Workflow: Orchestrator spawned 2 agents in parallel$/ })).toBeDefined()
    const src = await svgSource(first)
    expect(src.includes('Agent Manager (opus/opus-5.5)')).toBe(true)
    expect(src.includes('Sqa Engineer (opus/opus-5.5)')).toBe(true)
    // Side by side: both avatars on one row, under the orchestrator's.
    const cys = [...src.matchAll(/<circle cx="(\d+)" cy="(\d+)"/g)].map(m => [Number(m[1]), Number(m[2])])
    expect(cys.length).toBe(3)
    expect(cys[1]![1]).toBe(cys[2]![1])
    expect(cys[1]![0]).not.toBe(cys[2]![0])
    expect(cys[0]![1]).toBeLessThan(cys[1]![1]!)
    const keys = (await first.findAll({ type: 'Button' })).map((b: any) => b.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const k of ['agent-main', 'agent-a1', 'agent-a2', 'edge-a1', 'edge-a2']) expect(keys).toContain(k)
    expect((await first.find({ type: 'Button', key: 'edge-a2' }))?.text).toMatch(/^17\.2 Orchestrator -> Sqa Engineer$/)
    await first.unmount()
    const second = await $.ui.mount(toolRow('toolu_2', 'vscode', { subagent_type: 'ai-dlc:sqa-engineer', description: 'tests', prompt: 'p' }))
    expect(await second.find({ type: 'Svg' })).toBe(undefined)
    expect(await second.find({ type: 'Text', text: /agent 2 of 2 spawned in parallel; the flowchart is on the first of them/ })).toBeDefined()
    expect(await second.find({ type: 'Text', text: 'NATIVE ROW' })).toBeDefined()
    await second.unmount()
  })

  test('C3: live: running avatars blink, finished ones stop; an unspawned call shows a placeholder', async ($, on) => {
    await seed($, on, { parallel: true, spawnSecond: false, complete: false })
    const ui = await $.ui.mount(toolRow('toolu_1', 'vscode', { subagent_type: 'ai-dlc:agent-manager', description: 'rework', prompt: 'p' }))
    let src = await svgSource(ui)
    expect(src.includes('Sqa Engineer (?)')).toBe(true)
    expect((src.match(/<animate /g) ?? []).length).toBe(2)
    await completeA1($)
    src = await svgSource(ui)
    expect((src.match(/<animate /g) ?? []).length).toBe(1)
    await ui.unmount()
  })

  test('C4: chat Buttons open the separate panes even in drill-in mode; thinking and context collapse', async ($, on) => {
    const opened = await seed($, on)
    await $.tool.call({ tool: 'Grep', pattern: 'needle', tool_use_id: 'toolu_m1' })
    const pane0 = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await pane0.press({ key: 'mode-drill' })
    await pane0.unmount()
    const ui = await $.ui.mount(toolRow('toolu_1', 'vscode', { subagent_type: 'ai-dlc:agent-manager', description: 'rework', prompt: 'p' }))
    await ui.press({ key: 'edge-a1' })
    await ui.press({ key: 'agent-a1' })
    expect(opened).toContain('lens-027-edge')
    expect(opened).toContain('lens-027-agent')
    expect(await ui.find({ type: 'Text', text: /Grep needle/ })).toBe(undefined)
    await ui.press({ key: 'card-context' })
    expect(await ui.find({ type: 'Text', text: /Grep needle/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /no thinking chunks seen yet/ })).toBe(undefined)
    await ui.press({ key: 'card-thinking' })
    expect(await ui.find({ type: 'Text', text: /no thinking chunks seen yet/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'NATIVE ROW' })).toBeDefined()
    await ui.unmount()
  })

  test('C5: a SendMessage row keeps its native row under one lens line', async ($, on) => {
    await seed($, on)
    const ui = await $.ui.mount(toolRow('toolu_s', 'vscode', { to: 'a1', message: 'again' }, 'SendMessage'))
    expect(await ui.find({ type: 'Text', text: /lens: message to a1/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'NATIVE ROW' })).toBeDefined()
    await ui.unmount()
  })
})

describe('lens card', () => {
  test('L2+L3: an avatar per agent with its five lines, a Button per avatar and per arrow', async ($, on) => {
    await seed($, on)
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...pane('lens-027'), surface })
      expect(await ui.find({ type: 'Text', text: 'Orchestrator (opus/opus-5.5)' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'orchestrator (main)' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^ctx 108K\/1M$/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'Agent Manager (opus/opus-5.5)' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^agent-manager$/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^ctx 300K\/1M$/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'in 100K, out 200K' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'cache r 90K / w 9K / uncached 1K' })).toBeDefined()
      expect(await ui.find({ type: 'Button', key: 'agent-a1' })).toBeDefined()
      expect(await ui.find({ type: 'Button', key: 'agent-main' })).toBeDefined()
      expect((await ui.find({ type: 'Button', key: 'edge-a1' }))?.text).toMatch(/^17 .* -> Agent Manager$/)
      if (surface === 'vscode') expect(await ui.find({ type: 'Svg' })).toBeDefined()
      // Field uniqueness: no two Buttons share a key.
      const keys = (await ui.findAll({ type: 'Button' })).map((b: any) => b.key)
      expect(new Set(keys).size).toBe(keys.length)
      await ui.unmount()
    }
  })

  test('L4: an arrow opens the hand-off pane with the record, the hand-back and its tokens', async ($, on) => {
    const opened = await seed($, on)
    const ui = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await ui.press({ key: 'edge-a1' })
    await ui.unmount()
    expect(opened).toContain('lens-027-edge')
    const edge = await $.ui.mount({ ...pane('lens-027-edge'), surface: 'vscode' })
    expect(await edge.find({ type: 'Text', text: 'HANDOFF BODY' })).toBeDefined()
    expect(await edge.find({ type: 'Text', text: 'HANDBACK BODY' })).toBeDefined()
    expect(await edge.find({ type: 'Text', text: HANDBACK })).toBeDefined()
    expect(await edge.find({ type: 'Text', text: /Hand-off tokens .*in 100K, out 200K/ })).toBeDefined()
    expect(await edge.find({ type: 'Text', text: /Record matched: first line/ })).toBeDefined()
    await edge.press({ key: 'edge-doc' })
    expect(await edge.find({ type: 'Text', text: 'HANDOFF BODY' })).toBe(undefined)
    await edge.unmount()
  })

  test('L5: an avatar opens the agent pane with tool calls, background tasks and thinking', async ($, on) => {
    const opened = await seed($, on)
    const ui = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await ui.press({ key: 'agent-a1' })
    await ui.unmount()
    expect(opened).toContain('lens-027-agent')
    const ag = await $.ui.mount({ ...pane('lens-027-agent'), surface: 'vscode' })
    expect(await ag.find({ type: 'Text', text: /Read x\.md/ })).toBeDefined()
    expect(await ag.find({ type: 'Text', text: /step out 200K \/ 1 call \(est\.\)/ })).toBeDefined()
    expect(await ag.find({ type: 'Button', key: 'agent-view' })).toBeDefined()
    expect(await ag.find({ type: 'Text', text: 'SUBAGENT THOUGHT' })).toBe(undefined)
    await ag.press({ key: 'agent-thinking' })
    expect(await ag.find({ type: 'Text', text: 'SUBAGENT THOUGHT' })).toBeDefined()
    await ag.unmount()
  })

  test('L4 fallback: drill-in shows the panel inside the lens pane with a Back button', async ($, on) => {
    const opened = await seed($, on)
    const ui = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await ui.press({ key: 'mode-drill' })
    await ui.press({ key: 'edge-a1' })
    expect(opened).not.toContain('lens-027-edge')
    expect(await ui.find({ type: 'Button', key: 'drill-back' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'HANDOFF BODY' })).toBeDefined()
    await ui.press({ key: 'drill-back' })
    expect(await ui.find({ type: 'Button', key: 'edge-a1' })).toBeDefined()
    await ui.unmount()
  })

  test('L1: gathered context is collapsible', async ($, on) => {
    await seed($, on)
    await $.tool.call({ tool: 'Grep', pattern: 'needle', tool_use_id: 'toolu_m1' })
    const ui = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    expect(await ui.find({ type: 'Text', text: /Gathered context \(1 calls\)/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Grep needle/ })).toBe(undefined)
    await ui.press({ key: 'lens-context' })
    expect(await ui.find({ type: 'Text', text: /Grep needle/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Thinking \(0 chars\)/ })).toBeDefined()
    await ui.unmount()
  })

  test('L6: a respawn of the same type, or a SendMessage to it, draws a two-way arrow', async ($, on) => {
    await seed($, on)
    await $.tool.call({ tool: 'SendMessage', to: 'a1', message: 'again', tool_use_id: 'toolu_s1' })
    const ui = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    expect((await ui.find({ type: 'Button', key: 'edge-a1' }))?.text).toMatch(/<-> Agent Manager$/)
    const svg: any = await ui.find({ type: 'Svg' })
    expect(String(svg?.props?.source ?? svg?.source ?? '')).toMatch(/marker-start/)
    await ui.unmount()
  })
})

describe('lens card, more', () => {
  test('L5: background tasks from agent.list children and stop-time background_tasks', async ($, on) => {
    const opened = await seed($, on)
    await $.classic.SubagentStop({
      stop_hook_active: false,
      agent_id: 'a1',
      agent_transcript_path: '',
      agent_type: 'ai-dlc:agent-manager',
      background_tasks: [{ id: 'b1', type: 'shell', status: 'running', description: 'npm run watch' }],
    })
    const ui = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await ui.press({ key: 'agent-main' })
    await ui.unmount()
    expect(opened).toContain('lens-027-agent')
    const main = await $.ui.mount({ ...pane('lens-027-agent'), surface: 'vscode' })
    expect(await main.find({ type: 'Text', text: /running ai-dlc:agent-manager rework/ })).toBeDefined()
    await main.unmount()
    const ui2 = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await ui2.press({ key: 'agent-a1' })
    await ui2.unmount()
    const sub = await $.ui.mount({ ...pane('lens-027-agent'), surface: 'vscode' })
    expect(await sub.find({ type: 'Text', text: /running shell npm run watch/ })).toBeDefined()
    await sub.unmount()
  })

  test('E1-E8: probes log to PROBE-LOG.jsonl; E3 opens probe panes that draw', async ($, on) => {
    const writes: { path: string; text: string }[] = []
    on('fs.write', (_: unknown, e: any) => {
      writes.push(e)
      return { value: undefined }
    })
    on('ui.panes', () => ({ value: [] }))
    const opened = await seed($, on)
    const r1: any = await ($.command.run as any)({ command: 'spike027-probe', args: 'on' })
    expect(String(r1?.text)).toMatch(/Probes on\. Log: .*PROBE-LOG\.jsonl/)
    await $.agent.spawn({
      tool_use_id: 'toolu_2',
      prompt: `${RECORD}\nagain`,
      description: 'again',
      subagentType: 'ai-dlc:agent-manager',
      provider: { plugin: 'ai-dlc', tier: 'user' },
      parentModel: 'claude-opus-5-5',
      background: false,
      fork: false,
    })
    const r3: any = await ($.command.run as any)({ command: 'spike027-probe', args: 'panes 3' })
    expect(String(r3?.text)).toMatch(/opened 3 probe panes/)
    expect(opened).toContain('lens-027-p3')
    const p2 = await $.ui.mount({ ...pane('lens-027-p2'), surface: 'vscode' })
    expect(await p2.find({ type: 'Text', text: /E3 probe pane 2/ })).toBeDefined()
    await p2.unmount()
    const log = writes.at(-1)?.text ?? ''
    expect(log).toMatch(/"exp":"E1"/)
    expect(log).toMatch(/"exp":"E3"/)
    expect(writes.at(-1)?.path ?? '').toMatch(/PROBE-LOG\.jsonl$/)
  })
})

describe('fallbacks', () => {
  test('E7: stop-time background_tasks merge with tasks a tool call started', () => {
    const started = { id: 'b1', type: 'shell', status: 'running', description: 'sleep 15', source: 'tool.call' }
    const listed = { id: 'k1', type: 'subagent', status: 'running', description: 'x', source: 'agent.list' }
    expect(mergeStopTasks([started, listed], [{ ...started, source: 'Stop' }]).map(t => t.source)).toEqual(['agent.list', 'Stop'])
    expect(mergeStopTasks([started, listed], []).map(t => `${t.id}:${t.status}`)).toEqual(['k1:running', 'b1:ended'])
  })

  test('E7: a background Bash shows in the main avatar panel at once', async ($, on) => {
    await seed($, on)
    await $.tool.call({ tool: 'Bash', command: 'sleep 15', run_in_background: true, tool_use_id: 'toolu_b' })
    const ui = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await ui.press({ key: 'agent-main' })
    await ui.unmount()
    const main = await $.ui.mount({ ...pane('lens-027-agent'), surface: 'vscode' })
    expect(await main.find({ type: 'Text', text: 'running shell sleep 15 [tool.call]' })).toBeDefined()
    await main.unmount()
  })

  test('L1: thinking with no streamed text says so, from the stored transcript', async ($, on) => {
    on('session.messages', () => ({ value: [{ role: 'assistant', content: [{ type: 'thinking', thinking: '', signature: 's' }] }] }))
    await seed($, on)
    await $.turn.complete({ reason: 'answer', answer: 'ok', durationMs: 1, isAborted: false, turnId: 'm' })
    const ui = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await ui.press({ key: 'lens-thinking' })
    expect(await ui.find({ type: 'Text', text: /no thinking text: 0 block.*transcript holds 1 thinking block.*0 chars/ })).toBeDefined()
    await ui.unmount()
  })
})
