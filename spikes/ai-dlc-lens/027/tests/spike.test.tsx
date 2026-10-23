import { describe, expect, test } from 'claude-code/testing'
import {
  addToBatch,
  costOf,
  ensureIn,
  fmtModel,
  fmtTokens,
  humanRole,
  initials,
  isRespawn,
  leadOf,
  lookupModel,
  matchHandoff,
  mergeStopTasks,
  modelOf,
  notePending,
  parseDefinition,
  parseRecord,
  parseRoster,
  pickHandback,
  showChart,
  windowOf,
} from '../hooks/lens'
import { DEFAULTS, envLevel, envName, fileLevel, resolve, schema, setKey } from '../hooks/settings'

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

/** A transcript row of a tool call, as the engine mounts it; `columns` sets the render site's viewport. */
function toolRow(id: string, surface: (typeof SURFACES)[number], input: Record<string, unknown>, tool = 'Agent', columns?: number, isExpanded?: boolean) {
  return {
    plugin: PLUGIN,
    surface,
    component: 'ToolUse',
    requestId: id,
    ...(columns !== undefined ? { viewport: { columns, rows: 40 } } : {}),
    props: { tool_use_id: id, tool, input, isRunning: false, isErrored: false, isInterrupted: false, ...(isExpanded !== undefined ? { isExpanded } : {}) },
  } as const
}

// ---------------- pure helpers ----------------
describe('figures', () => {
  test('L3: token and model formatting', () => {
    expect(fmtTokens(950)).toBe('950')
    expect(fmtTokens(12_345)).toBe('12.3K')
    expect(fmtTokens(100_000)).toBe('100K')
    expect(fmtTokens(999_999)).toBe('1M')
    expect(fmtTokens(1_234_567)).toBe('1.2M')
    expect(fmtModel('claude-opus-5-5')).toBe('opus/opus-5.5')
    expect(fmtModel('haiku')).toBe('haiku')
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

  test('1d: persona from the roster or the definition, model from the definition, readable role, initials', () => {
    expect(parseRoster(ROSTER)).toEqual({ orchestrator: 'Scott Hanselman', 'software-engineer': 'David Fowler', 'sqa-engineer': 'Kent Beck', 'code-reviewer': 'Robert C. Martin (Uncle Bob)' })
    expect(parseDefinition(def('sonnet', 'Kent Beck'))).toEqual({ model: 'sonnet', persona: 'Kent Beck' })
    expect(parseDefinition(def('claude-opus-5-5', 'X Y')).model).toBe('claude-opus-5-5')
    expect(humanRole('ai-dlc:sqa-engineer')).toBe('SQA Engineer')
    expect(humanRole('software-engineer')).toBe('Software Engineer')
    expect(humanRole('ai-dlc:devops-engineer')).toBe('DevOps Engineer')
    expect(humanRole('ai-dlc:product-owner')).toBe('Product Owner')
    expect(initials('Kent Beck')).toBe('KB')
    expect(initials('Robert C. Martin (Uncle Bob)')).toBe('RM')
    const d = { model: 'sonnet', persona: 'Kent Beck', path: 'p' }
    expect(modelOf(d, 'haiku', 'claude-opus-5-5')).toEqual({ text: 'sonnet', source: 'agent definition (p)' })
    expect(modelOf({ ...d, model: 'inherit' }, 'haiku', 'claude-opus-5-5').text).toBe('haiku')
    expect(modelOf({ ...d, model: 'inherit' }, '', 'claude-opus-5-5')).toEqual({ text: 'claude-opus-5-5', source: "the session's model (definition says inherit)" })
    expect(modelOf(undefined, '', 'claude-opus-5-5').source).toMatch(/no agent definition/)
  })
})

// The `.ai-dlc/model-costing.json` shapes the reader accepts (its schema is written in parallel): by key, not position.
const COSTING_ARRAY = JSON.stringify({
  currency: 'USD',
  models: [
    {
      id: 'claude-sonnet-5-5',
      aliases: ['sonnet'],
      pricing: { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.3, cacheWrite5mPerMTok: 3.75, cacheWrite1hPerMTok: 6 },
      limits: { contextWindow: 200000, longContextWindow: 1000000, maxOutputTokens: 64000 },
    },
  ],
})
const COSTING_OBJECT = JSON.stringify({ models: { 'claude-opus-5-5': { input: 5, output: 25, cache_read: 0.5, cache_write_5m: 6.25, cache_write_1h: 10, context_window: 1000000 } } })

describe('model costing (read only)', () => {
  test('4: cost from the file, — when the file, the model or a price is missing', () => {
    const t = { in: 1_000_000, out: 100_000, cr: 2_000_000, cw: 100_000 }
    const c = { path: '.ai-dlc/model-costing.json', text: COSTING_ARRAY, error: '' }
    // 3 + 1.5 + 0.6 + 0.375 = 5.475, shown to the cent
    expect(costOf(c, 'claude-sonnet-5-5', t).text).toBe('$5.47')
    expect(costOf(c, 'claude-sonnet-5-5', t, '1h').text).toBe('$5.70')
    expect(costOf(c, 'claude-sonnet-5-5', t).source).toMatch(/5-minute rate/)
    expect(costOf(c, 'claude-haiku-5-5', t)).toEqual({ text: '—', source: 'claude-haiku-5-5 is not in .ai-dlc/model-costing.json' })
    expect(costOf({ path: '.ai-dlc/model-costing.json', text: '', error: '.ai-dlc/model-costing.json not found' }, 'claude-sonnet-5-5', t).text).toBe('—')
    expect(costOf({ ...c, text: '{' }, 'claude-sonnet-5-5', t).text).toBe('—')
    expect(costOf({ ...c, text: COSTING_OBJECT }, 'claude-opus-5-5', { in: 0, out: 1_000_000, cr: 0, cw: 0 }).text).toBe('$25.00')
    // The shape the parallel AAW run wrote (2026-10-23): `pricing.input`, batch prices beside them, limits at the top level.
    const real = {
      models: [
        {
          id: 'claude-haiku-5-5',
          aliases: [],
          contextWindow: 1000000,
          longContextWindow: null,
          maxInputTokens: null,
          maxOutputTokens: 128000,
          pricing: { input: 0.1, cacheWrite5m: 0.125, cacheWrite1h: 0.2, cacheRead: 0.01, output: 0.5, batchInput: 0.05, batchOutput: 0.25, fastInput: null, fastOutput: null },
          longContextPricing: null,
        },
      ],
    }
    expect(lookupModel(real, 'claude-haiku-5-5')).toEqual({ id: 'claude-haiku-5-5', cacheRead: 0.01, cacheWrite5m: 0.125, cacheWrite1h: 0.2, input: 0.1, output: 0.5, window: 1000000, longWindow: null, maxOutput: 128000 })
    expect(costOf({ ...c, text: JSON.stringify(real) }, 'claude-haiku-5-5', { in: 1e6, out: 1e6, cr: 1e6, cw: 1e6 }).text).toBe('$0.7350')
    expect(lookupModel(JSON.parse(COSTING_ARRAY), 'sonnet')?.id).toBe('claude-sonnet-5-5')
    expect(lookupModel(JSON.parse(COSTING_ARRAY), 'claude-sonnet-5-5-20260101')?.maxOutput).toBe(64000)
  })

  test('addendum: a subagent window from the file, else main for the same model, else —', () => {
    const c = { path: '.ai-dlc/model-costing.json', text: COSTING_ARRAY, error: '' }
    expect(windowOf(c, 'claude-sonnet-5-5', 'claude-opus-5-5', 1_000_000)).toEqual({ n: 200000, source: '.ai-dlc/model-costing.json (claude-sonnet-5-5)' })
    expect(windowOf(c, 'claude-sonnet-5-5[1m]', 'x', 0).n).toBe(1_000_000)
    const none = { path: '.ai-dlc/model-costing.json', text: '', error: 'missing' }
    expect(windowOf(none, 'claude-opus-5-5', 'claude-opus-5-5', 1_000_000).source).toBe("the main session's window (same model)")
    expect(windowOf(none, 'claude-opus-5-5', 'claude-opus-5-5', 1_000_000, 'none').n).toBe(null)
    expect(windowOf(none, 'claude-haiku-5-5', 'claude-opus-5-5', 1_000_000).n).toBe(null)
  })
})

describe('root cause: the second call of a batch (findings 1c, 6)', () => {
  test('a stale "absent" never overwrites an agent agent.spawn already wrote', () => {
    const written = { a2: { id: 'a2', type: 'ai-dlc:sqa-engineer', toolUseId: 'toolu_2' } as any }
    const blank = () => ({ id: 'a2', type: '', toolUseId: '' }) as any
    // Round 2's write, `{ ...m, [id]: blank }`, replaced the record whatever stood:
    expect(({ ...written, a2: blank() } as any).a2.toolUseId).toBe('')
    // Round 3 decides inside the write:
    expect(ensureIn(written, 'a2', blank).a2!.toolUseId).toBe('toolu_2')
  })

  test('the agent its own turn.start added first is not a respawn (headless order, E9)', () => {
    const m = { a1: { id: 'a1', parent: 'main', type: 'ai-dlc:sqa-engineer', toolUseId: '' } as any }
    expect(isRespawn(m, 'a1', 'main', 'ai-dlc:sqa-engineer', 'toolu_1')).toBe(false)
    const again = { ...m, a0: { id: 'a0', parent: 'main', type: 'ai-dlc:sqa-engineer', toolUseId: 'toolu_0' } as any }
    expect(isRespawn(again, 'a1', 'main', 'ai-dlc:sqa-engineer', 'toolu_1')).toBe(true)
  })

  test('a tool.call seen before its tool chunk is folded into the message batch', () => {
    const p = { type: 't', description: '', name: '', prompt: 'P2', model: '' }
    let b = addToBatch({}, 'toolu_1', 'main', 'toolu_1')
    b = notePending(b, 'main', 'toolu_2', p)
    expect(Object.keys(b).sort()).toEqual(['toolu_1', 'toolu_2'])
    b = addToBatch(b, 'toolu_1', 'main', 'toolu_2')
    expect(Object.keys(b)).toEqual(['toolu_1'])
    expect(b['toolu_1']!.pending['toolu_2']?.prompt).toBe('P2')
    expect(leadOf(b, 'toolu_2')).toBe('toolu_1')
  })
})

// ---------------- module tests ----------------
const RECORD = 'docs/handoffs/R/17-orchestrator-to-agent-manager.handoff.md'
const HANDBACK = 'docs/handoffs/R/17-agent-manager-to-orchestrator.handback.md'
const ROSTER = [
  '| Agent | Name |',
  '|---|---|',
  '| orchestrator | Scott Hanselman |',
  '| software-engineer | David Fowler |',
  '| sqa-engineer | Kent Beck |',
  '| code-reviewer | Robert C. Martin (Uncle Bob) |',
].join('\n')
const def = (model: string, persona: string) => `---\nname: x\nmodel: ${model}\n---\n\nPersona name: **${persona}** — a nod.\n`
const ROSTER_PATH = '.claude/agent-memory/ai-dlc-orchestrator/project_team-roster.md'
const BASE_FILES: Record<string, string> = {
  [ROSTER_PATH]: ROSTER,
  'plugins/claude/ai-dlc/agents/orchestrator.md': def('opus', 'Scott Hanselman'),
  'plugins/claude/ai-dlc/agents/software-engineer.md': def('sonnet', 'David Fowler'),
  'plugins/claude/ai-dlc/agents/sqa-engineer.md': def('sonnet', 'Kent Beck'),
  [RECORD]: 'HANDOFF BODY',
  [HANDBACK]: 'HANDBACK BODY',
}

type SeedOpts = { parallel?: boolean; spawnSecond?: boolean; complete?: boolean; files?: Record<string, string | null>; turnStartFirst?: boolean }

/**
 * `parallel`: main's step asks for two Agent calls (toolu_1 -> a1 software-engineer, toolu_2 -> a2
 * sqa-engineer) as one message; `spawnSecond: false` leaves toolu_2 unspawned; `complete: false`
 * leaves a1 running; `turnStartFirst`: each subagent's turn.start comes before its agent.spawn
 * resumes, the order the headless run showed (E9). `files`: path -> text, or null for missing.
 */
async function seed($: any, on: any, opts: SeedOpts = {}) {
  const { parallel = false, spawnSecond = true, complete = true, turnStartFirst = false } = opts
  const files: Record<string, string | null> = { ...BASE_FILES, ...(opts.files ?? {}) }
  const opened: string[] = []
  const nativeInputs: unknown[] = []
  const writes: { path: string; text: string }[] = []
  on('ui.render', ($s: any, e: any) => {
    nativeInputs.push(e.props?.input)
    const { Text } = $s.ui.resolve(e)
    return <Text>NATIVE ROW</Text>
  })
  on('command.register', () => ({ value: { command: 'x' } }))
  on('clock.every', () => ({ value: undefined }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 10 }, rateLimits: [] } }))
  on('settings.read', () => ({ value: { agent: 'ai-dlc:orchestrator' } }))
  on('fs.exists', () => ({ value: false }))
  on('fs.read', (_: unknown, e: any) => {
    // The engine hands the path resolved against the working directory: match by the relative tail.
    const path = String(e.path ?? e).replace(/\\/g, '/')
    const hit = Object.keys(files).find(k => path === k || path.endsWith('/' + k))
    const text = hit === undefined ? undefined : files[hit]
    if (text === undefined || text === null) throw new Error(`ENOENT ${path}`)
    return { value: text }
  })
  on('fs.write', (_: unknown, e: any) => {
    const rel = String(e.path).replace(/\\/g, '/').replace(/^.*\/(\.ai-dlc\/|spikes\/)/, '$1')
    writes.push({ path: rel, text: e.text })
    files[rel] = e.text
    return { value: undefined }
  })
  on('fs.list', () => ({ value: [{ name: '17-orchestrator-to-agent-manager.handoff.md', kind: 'file', size: 1, mtimeMs: 1 }, { name: '17-agent-manager-to-orchestrator.handback.md', kind: 'file', size: 1, mtimeMs: 1 }] }))
  on('agent.list', () => ({ value: [{ id: 'a1', description: 'build', type: 'ai-dlc:software-engineer', status: 'running' }] }))
  on('ui.open', (_: unknown, e: any) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.view', () => ({ value: undefined }))
  on('agent.spawn', (_: unknown, e: any) => ({ model: 'claude-sonnet-5-5', agentId: e.tool_use_id === 'toolu_2' ? 'a2' : 'a1' }))
  on('turn.start', (_: unknown, e: any) => ({ turnId: e.turnId }))
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
    yield { kind: 'stop', stopReason: 'tool_use', usage: { input_tokens: 1000, output_tokens: 200_000, cache_read_input_tokens: 90_000, cache_creation_input_tokens: 9_000, model: 'claude-sonnet-5-5' } }
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
    await $.tool.call({ tool: 'Agent', subagent_type: 'ai-dlc:software-engineer', description: 'build', prompt: `Your handoff record is ${RECORD} (root x).\nDo it.`, tool_use_id: 'toolu_1' })
    await $.tool.call({ tool: 'Agent', subagent_type: 'ai-dlc:sqa-engineer', description: 'tests', prompt: 'SQA PROMPT: test the change.', tool_use_id: 'toolu_2' })
  }
  // The subagent's own turn.start lands before agent.spawn's hook resumes (headless run, E9).
  if (turnStartFirst) await $.turn.start({ text: 'p', turnId: 't', agentId: 'a1' })
  await $.agent.spawn({
    tool_use_id: 'toolu_1',
    prompt: `Your handoff record is ${RECORD} (root x).\nDo it.`,
    description: 'build',
    subagentType: 'ai-dlc:software-engineer',
    provider: { plugin: 'ai-dlc', tier: 'user' },
    parentModel: 'claude-opus-5-5',
    background: false,
    fork: false,
  })
  const stream = $.turn.step({ turnId: 't', index: 0, model: 'claude-sonnet-5-5', messageCount: 1, agentId: 'a1' })
  for await (const _ of stream) {
    // drain
  }
  await $.tool.call({ tool: 'Read', file_path: 'x.md', tool_use_id: 'toolu_9', agentId: 'a1' })
  if (parallel && spawnSecond && turnStartFirst) await $.turn.start({ text: 'p', turnId: 't2', agentId: 'a2' })
  if (parallel && spawnSecond)
    await $.agent.spawn({
      tool_use_id: 'toolu_2',
      prompt: 'SQA PROMPT: test the change.',
      description: 'tests',
      subagentType: 'ai-dlc:sqa-engineer',
      provider: { plugin: 'ai-dlc', tier: 'user' },
      parentModel: 'claude-opus-5-5',
      background: true,
      fork: false,
    })
  if (complete) await completeAgent($, 'a1')
  return { opened, nativeInputs, writes, files }
}

async function completeAgent($: any, agentId: string) {
  await $.turn.complete({
    reason: 'answer',
    answer: 'done',
    durationMs: 1,
    isAborted: false,
    turnId: 't',
    agentId,
    usage: { input_tokens: 1000, output_tokens: 200_000, cache_read_input_tokens: 90_000, cache_creation_input_tokens: 9_000, model: 'claude-sonnet-5-5' },
  })
}

const svgSource = async (ui: any): Promise<string> => {
  const svg: any = await ui.find({ type: 'Svg' })
  return String(svg?.props?.source ?? svg?.source ?? '')
}
const SE_INPUT = { subagent_type: 'ai-dlc:software-engineer', description: 'build', prompt: 'p' }

// ---------------- the chat card ----------------
describe('chat card', () => {
  test('C1 (1a, 1d): the chart shows persona, model from the definition and role; no ctx, tokens or cache', async ($, on) => {
    await seed($, on)
    for (const surface of SURFACES) {
      const ui = await $.ui.mount(toolRow('toolu_1', surface, SE_INPUT))
      const all = await ui.findAll({})
      expect(all.findIndex((x: any) => x.type === 'Text' && /^Workflow: Scott Hanselman spawned 1 agent$/.test(String(x.text)))).toBeGreaterThan(-1)
      expect(all.findIndex((x: any) => x.text === 'NATIVE ROW')).toBe(all.length - 1)
      if (surface === 'vscode') {
        const src = await svgSource(ui)
        for (const line of ['>Scott Hanselman<', '>opus<', '>Orchestrator<', '>David Fowler<', '>sonnet<', '>Software Engineer<', '>DF<', '>SH<']) expect(src.includes(line)).toBe(true)
        for (const gone of ['ctx', 'cache', 'in 1', 'out 2', 'software-engineer<']) expect(src.includes(gone)).toBe(false)
        const svg: any = await ui.find({ type: 'Svg' })
        expect(Number(svg?.props?.width ?? svg?.width)).toBe(120)
      } else {
        expect(await ui.find({ type: 'Svg' })).toBe(undefined)
        expect(await ui.find({ type: 'Text', text: /-> .*David Fowler/ })).toBeDefined()
        expect(await ui.find({ type: 'Text', text: /^\s+sonnet, Software Engineer$/ })).toBeDefined()
      }
      expect((await ui.find({ type: 'Button', key: 'agent-a1' }))?.text).toBe('David Fowler')
      expect((await ui.find({ type: 'Button', key: 'edge-a1' }))?.text).toMatch(/^17 Scott Hanselman -> David Fowler$/)
      await ui.unmount()
    }
  })

  test('C2 (1c, 1d): two parallel calls: both avatars, both arrows, Kent Beck as KB, SQA Engineer; second row compact', async ($, on) => {
    await seed($, on, { parallel: true })
    const first = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT))
    expect(await first.find({ type: 'Text', text: /^Workflow: Scott Hanselman spawned 2 agents in parallel$/ })).toBeDefined()
    const src = await svgSource(first)
    for (const s of ['>Kent Beck<', '>KB<', '>SQA Engineer<', '>David Fowler<']) expect(src.includes(s)).toBe(true)
    const cys = [...src.matchAll(/<circle cx="(\d+)" cy="(\d+)"/g)].map(m => [Number(m[1]), Number(m[2])])
    expect(cys.length).toBe(3)
    expect(cys[1]![1]).toBe(cys[2]![1])
    const keys = (await first.findAll({ type: 'Button' })).map((b: any) => b.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const k of ['agent-main', 'agent-a1', 'agent-a2', 'edge-a1', 'edge-a2']) expect(keys).toContain(k)
    expect((await first.find({ type: 'Button', key: 'edge-a2' }))?.text).toBe('Scott Hanselman -> Kent Beck')
    await first.unmount()
    const second = await $.ui.mount(toolRow('toolu_2', 'vscode', { subagent_type: 'ai-dlc:sqa-engineer', description: 'tests', prompt: 'p' }))
    expect(await second.find({ type: 'Svg' })).toBe(undefined)
    expect(await second.find({ type: 'Text', text: /agent 2 of 2 spawned in parallel/ })).toBeDefined()
    await second.unmount()
  })

  test('C2b (root cause): turn.start before agent.spawn resumes: no false two-way arrow, both calls mapped', async ($, on) => {
    await seed($, on, { parallel: true, turnStartFirst: true })
    const ui = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT))
    const src = await svgSource(ui)
    expect(src.includes('marker-start')).toBe(false)
    expect((await ui.find({ type: 'Button', key: 'edge-a1' }))?.text).toMatch(/ -> David Fowler$/)
    expect((await ui.find({ type: 'Button', key: 'edge-a2' }))?.text).toBe('Scott Hanselman -> Kent Beck')
    expect(await ui.find({ type: 'Button', key: 'agent-call:toolu_2' })).toBe(undefined)
    await ui.unmount()
  })

  test('C3 (6): only running avatars blink: a call not started is steady, a finished agent stops', async ($, on) => {
    await seed($, on, { parallel: true, spawnSecond: false, complete: false })
    const ui = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT))
    let src = await svgSource(ui)
    // main is idle, a1 runs, the toolu_2 placeholder has not started: one blink.
    expect((src.match(/<animate /g) ?? []).length).toBe(1)
    expect(src.includes('>Kent Beck<')).toBe(true)
    // The placeholder still has its Buttons (1c): its avatar and its arrow.
    expect(await ui.find({ type: 'Button', key: 'agent-call:toolu_2' })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'edge-call:toolu_2' })).toBeDefined()
    await completeAgent($, 'a1')
    src = await svgSource(ui)
    expect((src.match(/<animate /g) ?? []).length).toBe(0)
    await ui.unmount()
  })

  test('C3b (6): a list that still says running does not undo turn.complete', async ($, on) => {
    const { opened } = await seed($, on)
    const ui = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT))
    await ui.press({ key: 'agent-a1' })
    expect(opened).toContain('lens-027-agent')
    expect((((await svgSource(ui)).match(/<animate /g)) ?? []).length).toBe(0)
    await ui.unmount()
  })

  test('C4 (1b): a narrow row shows a chip and an "Open flowchart" Button that opens the chart pane', async ($, on) => {
    const { opened } = await seed($, on, { parallel: true })
    const narrow = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT, 'Agent', 20))
    expect(await narrow.find({ type: 'Svg' })).toBe(undefined)
    expect(await narrow.find({ type: 'Text', text: /DF completed, KB running/ })).toBeDefined()
    await narrow.press({ key: 'card-open-chart' })
    expect(opened).toContain('lens-027-chart')
    await narrow.unmount()
    const chart = await $.ui.mount({ ...pane('lens-027-chart'), surface: 'vscode' })
    expect((await svgSource(chart)).includes('>Kent Beck<')).toBe(true)
    expect(await chart.find({ type: 'Button', key: 'edge-a2' })).toBeDefined()
    await chart.unmount()
    const wide = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT, 'Agent', 200))
    expect(await wide.find({ type: 'Svg' })).toBeDefined()
    expect(await wide.find({ type: 'Button', key: 'card-open-chart' })).toBe(undefined)
    await wide.unmount()
  })

  test('C5 (5): the native Agent row gets no prompt; expanded, it gets the whole input; native still last', async ($, on) => {
    const { nativeInputs } = await seed($, on)
    const ui = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT))
    expect(nativeInputs.at(-1)).toEqual({ subagent_type: 'ai-dlc:software-engineer', description: 'build' })
    const all = await ui.findAll({})
    expect(all.findIndex((x: any) => x.text === 'NATIVE ROW')).toBe(all.length - 1)
    await ui.unmount()
    const full = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT, 'Agent', undefined, true))
    expect(nativeInputs.at(-1)).toEqual(SE_INPUT)
    await full.unmount()
  })

  test('C6: a SendMessage row keeps its native row under one lens line', async ($, on) => {
    await seed($, on)
    const ui = await $.ui.mount(toolRow('toolu_s', 'vscode', { to: 'a1', message: 'again' }, 'SendMessage'))
    expect(await ui.find({ type: 'Text', text: /lens: message to a1/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'NATIVE ROW' })).toBeDefined()
    await ui.unmount()
  })

  test('C7: chat Buttons open the separate panes even in drill-in mode', async ($, on) => {
    const { opened } = await seed($, on)
    const pane0 = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await pane0.press({ key: 'mode-drill' })
    await pane0.unmount()
    const ui = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT))
    await ui.press({ key: 'edge-a1' })
    await ui.press({ key: 'agent-a1' })
    expect(opened).toContain('lens-027-edge')
    expect(opened).toContain('lens-027-agent')
    await ui.unmount()
  })
})

describe('panels', () => {
  test('2: no handoff record: the arrow panel shows the orchestrator prompt in full', async ($, on) => {
    await seed($, on, { parallel: true })
    const ui = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT))
    await ui.press({ key: 'edge-a2' })
    await ui.unmount()
    const edge = await $.ui.mount({ ...pane('lens-027-edge'), surface: 'vscode' })
    expect(await edge.find({ type: 'Text', text: 'Prompt from orchestrator (no handoff record)' })).toBeDefined()
    expect(await edge.find({ type: 'Text', text: 'SQA PROMPT: test the change.' })).toBeDefined()
    await edge.unmount()
  })

  test('2: a call not spawned yet: its arrow still shows the prompt from the call', async ($, on) => {
    await seed($, on, { parallel: true, spawnSecond: false })
    const ui = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT))
    await ui.press({ key: 'edge-call:toolu_2' })
    await ui.unmount()
    const edge = await $.ui.mount({ ...pane('lens-027-edge'), surface: 'vscode' })
    expect(await edge.find({ type: 'Text', text: 'SQA PROMPT: test the change.' })).toBeDefined()
    await edge.unmount()
  })

  test('L4: a matched record: record and hand-back, collapsed until opened', async ($, on) => {
    await seed($, on)
    const ui = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await ui.press({ key: 'edge-a1' })
    await ui.unmount()
    const edge = await $.ui.mount({ ...pane('lens-027-edge'), surface: 'vscode' })
    expect(await edge.find({ type: 'Text', text: /Record matched: first line/ })).toBeDefined()
    expect(await edge.find({ type: 'Text', text: HANDBACK })).toBeDefined()
    expect(await edge.find({ type: 'Text', text: 'HANDOFF BODY' })).toBe(undefined)
    await edge.press({ key: 'edge-doc' })
    await edge.press({ key: 'edge-back' })
    expect(await edge.find({ type: 'Text', text: 'HANDOFF BODY' })).toBeDefined()
    expect(await edge.find({ type: 'Text', text: 'HANDBACK BODY' })).toBeDefined()
    await edge.unmount()
  })

  test('3, 4: the avatar panel has the figures, the model source, the window and the cost from the file', async ($, on) => {
    await seed($, on, { files: { '.ai-dlc/model-costing.json': COSTING_ARRAY } })
    const ui = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await ui.press({ key: 'agent-a1' })
    await ui.unmount()
    const ag = await $.ui.mount({ ...pane('lens-027-agent'), surface: 'vscode' })
    expect(await ag.find({ type: 'Text', text: /^David Fowler \(DF\)$/ })).toBeDefined()
    expect(await ag.find({ type: 'Text', text: /^Role: Software Engineer/ })).toBeDefined()
    expect(await ag.find({ type: 'Text', text: /^Model: sonnet from agent definition \(plugins\/claude\/ai-dlc\/agents\/software-engineer\.md\)$/ })).toBeDefined()
    expect(await ag.find({ type: 'Text', text: /^Context: 300K \/ 200K window from \.ai-dlc\/model-costing\.json \(claude-sonnet-5-5\)$/ })).toBeDefined()
    expect(await ag.find({ type: 'Text', text: 'Tokens: in 100K, out 200K' })).toBeDefined()
    expect(await ag.find({ type: 'Text', text: 'Cache: read 90K / write 9K / uncached 1K' })).toBeDefined()
    // 0.003 + 3 + 0.027 + 0.03375
    expect(await ag.find({ type: 'Text', text: /^Cost: \$3\.06 from \.ai-dlc\/model-costing\.json/ })).toBeDefined()
    expect(await ag.find({ type: 'Text', text: /Read x\.md/ })).toBeDefined()
    await ag.unmount()
  })

  test('rename: model-metadata.json is read before model-costing.json, and the panel names the file used', async ($, on) => {
    const other = COSTING_ARRAY.replace('"outputPerMTok":15', '"outputPerMTok":16')
    await seed($, on, { files: { '.ai-dlc/model-metadata.json': other, '.ai-dlc/model-costing.json': COSTING_ARRAY } })
    const ui = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await ui.press({ key: 'agent-a1' })
    await ui.unmount()
    const ag = await $.ui.mount({ ...pane('lens-027-agent'), surface: 'vscode' })
    // 0.003 + 3.2 + 0.027 + 0.03375: the metadata file's output price, not the older file's
    expect(await ag.find({ type: 'Text', text: /^Cost: \$3\.26 from \.ai-dlc\/model-metadata\.json/ })).toBeDefined()
    expect(await ag.find({ type: 'Text', text: /window from \.ai-dlc\/model-metadata\.json/ })).toBeDefined()
    await ag.unmount()
  })

  test('4: no metadata file: cost and a subagent window on another model show —', async ($, on) => {
    await seed($, on)
    const ui = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await ui.press({ key: 'agent-a1' })
    await ui.unmount()
    const ag = await $.ui.mount({ ...pane('lens-027-agent'), surface: 'vscode' })
    expect(await ag.find({ type: 'Text', text: /^Cost: — \(\.ai-dlc\/model-metadata\.json and \.ai-dlc\/model-costing\.json not found\)$/ })).toBeDefined()
    expect(await ag.find({ type: 'Text', text: /^Context: 300K \/ — window from/ })).toBeDefined()
    await ag.unmount()
  })

  test('L4 fallback: drill-in shows the panel inside the lens pane with a Back button', async ($, on) => {
    const { opened } = await seed($, on)
    const ui = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await ui.press({ key: 'mode-drill' })
    await ui.press({ key: 'edge-a1' })
    expect(opened).not.toContain('lens-027-edge')
    expect(await ui.find({ type: 'Button', key: 'drill-back' })).toBeDefined()
    await ui.press({ key: 'drill-back' })
    expect(await ui.find({ type: 'Button', key: 'edge-a1' })).toBeDefined()
    await ui.unmount()
  })

  test('L6: a SendMessage to an agent draws a two-way arrow', async ($, on) => {
    await seed($, on)
    await $.tool.call({ tool: 'SendMessage', to: 'a1', message: 'again', tool_use_id: 'toolu_s1' })
    const ui = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    expect((await ui.find({ type: 'Button', key: 'edge-a1' }))?.text).toMatch(/<-> David Fowler$/)
    expect(await svgSource(ui)).toMatch(/marker-start/)
    await ui.unmount()
  })

  test('L5: background tasks from agent.list children and stop-time background_tasks', async ($, on) => {
    await seed($, on)
    await $.classic.SubagentStop({
      stop_hook_active: false,
      agent_id: 'a1',
      agent_transcript_path: '',
      agent_type: 'ai-dlc:software-engineer',
      background_tasks: [{ id: 'b1', type: 'shell', status: 'running', description: 'npm run watch' }],
    })
    const ui = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await ui.press({ key: 'agent-a1' })
    await ui.unmount()
    const sub = await $.ui.mount({ ...pane('lens-027-agent'), surface: 'vscode' })
    expect(await sub.find({ type: 'Text', text: /running shell npm run watch/ })).toBeDefined()
    await sub.unmount()
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

  test('E1-E9: probes log to PROBE-LOG.jsonl; E3 opens probe panes that draw', async ($, on) => {
    on('ui.panes', () => ({ value: [] }))
    const { opened, writes } = await seed($, on)
    const r1: any = await ($.command.run as any)({ command: 'spike027-probe', args: 'on' })
    expect(String(r1?.text)).toMatch(/Probes on\. Log: .*PROBE-LOG\.jsonl/)
    await $.agent.spawn({ tool_use_id: 'toolu_2', prompt: 'again', description: 'again', subagentType: 'ai-dlc:software-engineer', provider: { plugin: 'ai-dlc', tier: 'user' }, parentModel: 'claude-opus-5-5', background: false, fork: false })
    const r3: any = await ($.command.run as any)({ command: 'spike027-probe', args: 'panes 3' })
    expect(String(r3?.text)).toMatch(/opened 3 probe panes/)
    expect(opened).toContain('lens-027-p3')
    const log = writes.filter(w => /PROBE-LOG\.jsonl$/.test(w.path)).at(-1)?.text ?? ''
    expect(log).toMatch(/"exp":"E1"/)
    expect(log).toMatch(/"exp":"E9"/)
  })
})

describe('collapsed by default (addendum 2)', () => {
  test('every [+]/[-] section starts collapsed: chat card, /spike027 pane, arrow and avatar panels', async ($, on) => {
    await seed($, on)
    await $.tool.call({ tool: 'Grep', pattern: 'needle', tool_use_id: 'toolu_m1' })
    const card = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT))
    for (const k of ['card-thinking', 'card-context']) expect((await card.find({ type: 'Button', key: k }))?.text).toBe('[+]')
    expect(await card.find({ type: 'Text', text: /Grep needle/ })).toBe(undefined)
    await card.press({ key: 'card-context' })
    expect(await card.find({ type: 'Text', text: /Grep needle/ })).toBeDefined()
    await card.unmount()
    const lens = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    for (const k of ['lens-thinking', 'lens-context', 'lens-settings']) expect((await lens.find({ type: 'Button', key: k }))?.text).toBe('[+]')
    await lens.press({ key: 'edge-a1' })
    await lens.press({ key: 'agent-a1' })
    await lens.unmount()
    const edge = await $.ui.mount({ ...pane('lens-027-edge'), surface: 'vscode' })
    for (const k of ['edge-doc', 'edge-back']) expect((await edge.find({ type: 'Button', key: k }))?.text).toBe('[+]')
    await edge.unmount()
    const ag = await $.ui.mount({ ...pane('lens-027-agent'), surface: 'vscode' })
    expect((await ag.find({ type: 'Button', key: 'agent-thinking' }))?.text).toBe('[+]')
    await ag.unmount()
  })

  test('collapsedByDefault false in lens.json opens them', async ($, on) => {
    await seed($, on, { files: { '.ai-dlc/lens.json': JSON.stringify({ collapsedByDefault: false }) } })
    const card = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT))
    expect((await card.find({ type: 'Button', key: 'card-thinking' }))?.text).toBe('[-]')
    await card.unmount()
  })
})

describe('settings (addendum 3)', () => {
  const local = (env: Record<string, string>) => JSON.stringify({ env })
  test('precedence: local env > project env > lens.json > default; invalid falls through', () => {
    const levels = [
      envLevel('.claude/settings.local.json', local({ AI_DLC_LENS_CELL_PX: '10', AI_DLC_LENS_BLINK: 'maybe' })).level,
      envLevel('.claude/settings.json', local({ AI_DLC_LENS_CELL_PX: '9', AI_DLC_LENS_CHART_COLUMN_PX: '150', AI_DLC_LENS_BLINK: 'false' })).level,
      fileLevel('.ai-dlc/lens.json', JSON.stringify({ cellPx: 7, chartColumnPx: 140, chartRowPx: 80, contextLimit: 'many', blink: true })).level,
    ]
    const r = resolve(levels)
    expect([r.settings.cellPx, r.sources.cellPx]).toEqual([10, '.claude/settings.local.json env'])
    expect([r.settings.chartColumnPx, r.sources.chartColumnPx]).toEqual([150, '.claude/settings.json env'])
    expect([r.settings.chartRowPx, r.sources.chartRowPx]).toEqual([80, '.ai-dlc/lens.json'])
    expect([r.settings.contextLimit, r.sources.contextLimit]).toEqual([60, 'default'])
    // `maybe` is invalid in the local env: the project env's `false` wins.
    expect([r.settings.blink, r.sources.blink]).toEqual([false, '.claude/settings.json env'])
    expect(r.ignored.length).toBe(2)
    expect(resolve([]).settings).toEqual(DEFAULTS)
    expect(envName('breakpointColumns')).toBe('AI_DLC_LENS_BREAKPOINT_COLUMNS')
    expect(Object.keys((schema().properties as object) ?? {}).length).toBe(Object.keys(DEFAULTS).length + 1)
    expect(setKey(null, 'chartMode', 'sideways').error).toMatch(/not valid for chartMode/)
    expect(JSON.parse(setKey(null, 'cellPx', '12').text).cellPx).toBe(12)
  })

  test('the module reads the three files, never the process env; the pane shows each value and its level', async ($, on) => {
    await seed($, on, {
      files: {
        '.claude/settings.local.json': local({ AI_DLC_LENS_CHART_MODE: 'button' }),
        '.claude/settings.json': local({ AI_DLC_LENS_CHART_MODE: 'chart', AI_DLC_LENS_SHOW_COST: 'false' }),
        '.ai-dlc/lens.json': JSON.stringify({ showCost: true, callsShown: 5, blinkMs: 'fast' }),
      },
    })
    const card = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT, 'Agent', 500))
    // chartMode button (local env) beats chart (project env), whatever the width.
    expect(await card.find({ type: 'Svg' })).toBe(undefined)
    expect(await card.find({ type: 'Button', key: 'card-open-chart' })).toBeDefined()
    await card.unmount()
    const lens = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await lens.press({ key: 'lens-settings' })
    expect(await lens.find({ type: 'Text', text: 'chartMode = "button" [.claude/settings.local.json env]' })).toBeDefined()
    expect(await lens.find({ type: 'Text', text: 'showCost = false [.claude/settings.json env]' })).toBeDefined()
    expect(await lens.find({ type: 'Text', text: 'callsShown = 5 [.ai-dlc/lens.json]' })).toBeDefined()
    expect(await lens.find({ type: 'Text', text: 'blinkMs = 1000 [default]' })).toBeDefined()
    expect(await lens.find({ type: 'Text', text: /blinkMs = "fast" is invalid, ignored/ })).toBeDefined()
    await lens.press({ key: 'agent-a1' })
    await lens.unmount()
    const ag = await $.ui.mount({ ...pane('lens-027-agent'), surface: 'vscode' })
    expect(await ag.find({ type: 'Text', text: /^Cost:/ })).toBe(undefined)
    await ag.unmount()
  })

  test('/spike027-lens-init writes lens.json and its schema; /spike027-lens-configure sets a key and names the winning level', async ($, on) => {
    const { writes } = await seed($, on, { files: { '.claude/settings.json': local({ AI_DLC_LENS_BLINK: 'false' }) } })
    const init: any = await ($.command.run as any)({ command: 'spike027-lens-init', args: '' })
    expect(String(init?.text)).toMatch(/Wrote \.ai-dlc\/lens\.json .*Still overridden by a settings env: blink \[\.claude\/settings\.json env\]/)
    expect(writes.map(w => w.path)).toEqual(expect.arrayContaining(['.ai-dlc/lens.json', '.ai-dlc/lens.schema.json']))
    expect(JSON.parse(writes.find(w => w.path === '.ai-dlc/lens.json')!.text).chartColumnPx).toBe(120)
    const set: any = await ($.command.run as any)({ command: 'spike027-lens-configure', args: 'chartColumnPx 200' })
    expect(String(set?.text)).toMatch(/chartColumnPx = 200 \[\.ai-dlc\/lens\.json\]/)
    const blocked: any = await ($.command.run as any)({ command: 'spike027-lens-configure', args: 'blink true' })
    expect(String(blocked?.text)).toMatch(/A higher level wins: \.claude\/settings\.json env/)
    const bad: any = await ($.command.run as any)({ command: 'spike027-lens-configure', args: 'cellPx 2' })
    expect(String(bad?.text)).toMatch(/^Not changed: 2 is not valid for cellPx/)
    const card = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT))
    const svg: any = await card.find({ type: 'Svg' })
    expect(Number(svg?.props?.width ?? svg?.width)).toBe(200)
    await card.unmount()
  })
})

describe('fallbacks', () => {
  test('E7: stop-time background_tasks merge with tasks a tool call started', () => {
    const started = { id: 'b1', type: 'shell', status: 'running', description: 'sleep 15', source: 'tool.call' }
    const listed = { id: 'k1', type: 'subagent', status: 'running', description: 'x', source: 'agent.list' }
    expect(mergeStopTasks([started, listed], [{ ...started, source: 'Stop' }]).map(t => t.source)).toEqual(['agent.list', 'Stop'])
    expect(mergeStopTasks([started, listed], []).map(t => `${t.id}:${t.status}`)).toEqual(['k1:running', 'b1:ended'])
  })

  test('1b: chart or button by width, mode and breakpoint', () => {
    expect(showChart('auto', 240, undefined, 0, 8)).toBe(true)
    expect(showChart('auto', 240, 30, 0, 8)).toBe(true)
    expect(showChart('auto', 240, 29, 0, 8)).toBe(false)
    expect(showChart('auto', 240, 50, 60, 8)).toBe(false)
    expect(showChart('chart', 240, 1, 0, 8)).toBe(true)
    expect(showChart('button', 240, 999, 0, 8)).toBe(false)
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
