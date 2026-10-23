import { describe, expect, test } from 'claude-code/testing'
import {
  addToBatch,
  costOf,
  ensureIn,
  fmtClock,
  fmtModel,
  joinWorkflow,
  limitRows,
  fmtTokens,
  humanRole,
  initials,
  isAgentTask,
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
  stampTasks,
  summarize,
  taskLine,
  WF0,
  runTitle,
  windowOf,
  workflowActive,
  costOfRequests,
  costOfAgent,
  parseRun,
  statusStyle,
  workflowStatus,
  workflowTask,
  isHumanRequest,
  isNotice,
  isPersonOrigin,
  noticeWorkflow,
  REQS_CAP,
  runningAndWaiting,
  statusDotSvg,
  statusLooks,
  taskKeyOf,
  thresholdOverrideOf,
  workflowTasks,
  flowchartSvg,
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
      expect(await ui.find({ type: 'Text', text: /^Workflow: Main spawned 1 agent - SA waiting\s*$/ })).toBeDefined()
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
    expect(lookupModel(real, 'claude-haiku-5-5')).toEqual({ id: 'claude-haiku-5-5', cacheRead: 0.01, cacheWrite5m: 0.125, cacheWrite1h: 0.2, input: 0.1, output: 0.5, window: 1000000, longWindow: null, maxInput: null, maxOutput: 128000, long: null })
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

type SeedOpts = {
  parallel?: boolean
  spawnSecond?: boolean
  complete?: boolean
  files?: Record<string, string | null>
  turnStartFirst?: boolean
  desc?: [string, string]
  /** Round 5: the human's request, the main loop's turn.start text before the calls. */
  request?: string
  /** Round 5: the second call's brief (default: no handoff record). */
  prompt2?: string
  /** Round 5: a1 is an agent-team teammate (agent.spawn answers a teammateId). */
  teammate?: boolean
  /** Round 6: the status `$.agent.list()` gives a1 (default `running`). */
  listStatus?: string
}

/**
 * `parallel`: main's step asks for two Agent calls (toolu_1 -> a1 software-engineer, toolu_2 -> a2
 * sqa-engineer) as one message; `spawnSecond: false` leaves toolu_2 unspawned; `complete: false`
 * leaves a1 running; `turnStartFirst`: each subagent's turn.start comes before its agent.spawn
 * resumes, the order the headless run showed (E9). `files`: path -> text, or null for missing.
 */
async function seed($: any, on: any, opts: SeedOpts = {}) {
  const { parallel = false, spawnSecond = true, complete = true, turnStartFirst = false, desc = ['build', 'tests'], prompt2 = 'SQA PROMPT: test the change.', teammate = false, listStatus = 'running' } = opts
  const files: Record<string, string | null> = { ...BASE_FILES, ...(opts.files ?? {}) }
  const opened: string[] = []
  const nativeInputs: unknown[] = []
  const writes: { path: string; text: string }[] = []
  const openArgs: any[] = []
  const closed: string[] = []
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
  on('agent.list', () => ({ value: [{ id: 'a1', description: desc[0], type: 'ai-dlc:software-engineer', status: listStatus }] }))
  on('ui.open', (_: unknown, e: any) => {
    opened.push(e.id)
    openArgs.push(e)
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_: unknown, e: any) => {
    closed.push(e.id)
    return { value: undefined }
  })
  on('ui.view', () => ({ value: undefined }))
  on('agent.spawn', (_: unknown, e: any) => ({
    model: 'claude-sonnet-5-5',
    agentId: e.tool_use_id === 'toolu_2' ? 'a2' : 'a1',
    ...(teammate && e.tool_use_id === 'toolu_1' ? { teammateId: 'a1@team' } : {}),
  }))
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
  if (opts.request !== undefined) await $.turn.start({ text: opts.request, turnId: 'm0' })
  for await (const _ of $.turn.step({ turnId: 'm', index: 0, model: 'claude-opus-5-5', messageCount: 1 })) {
    // drain the main step
  }
  if (parallel) {
    await $.tool.call({ tool: 'Agent', subagent_type: 'ai-dlc:software-engineer', description: desc[0], prompt: `Your handoff record is ${RECORD} (root x).\nDo it.`, tool_use_id: 'toolu_1' })
    await $.tool.call({ tool: 'Agent', subagent_type: 'ai-dlc:sqa-engineer', description: desc[1], prompt: prompt2, tool_use_id: 'toolu_2' })
  }
  // The subagent's own turn.start lands before agent.spawn's hook resumes (headless run, E9).
  if (turnStartFirst) await $.turn.start({ text: 'p', turnId: 't', agentId: 'a1' })
  await $.agent.spawn({
    tool_use_id: 'toolu_1',
    prompt: `Your handoff record is ${RECORD} (root x).\nDo it.`,
    description: desc[0],
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
      prompt: prompt2,
      description: desc[1],
      subagentType: 'ai-dlc:sqa-engineer',
      provider: { plugin: 'ai-dlc', tier: 'user' },
      parentModel: 'claude-opus-5-5',
      background: true,
      fork: false,
    })
  if (complete) await completeAgent($, 'a1')
  return { opened, nativeInputs, writes, files, openArgs, closed }
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

/** The flowchart's Svg (round 5: the status indicator is an Svg too, so the chart is found by its alt). */
const chartSvg = async (ui: any): Promise<any> => {
  const all: any[] = await ui.findAll({ type: 'Svg' })
  return all.find((x: any) => /^Flowchart/.test(String(x?.props?.alt ?? x?.alt ?? '')))
}
const svgSource = async (ui: any): Promise<string> => {
  const svg: any = await chartSvg(ui)
  return String(svg?.props?.source ?? svg?.source ?? '')
}
const SE_INPUT = { subagent_type: 'ai-dlc:software-engineer', description: 'build', prompt: 'p' }

// ---------------- the chat card ----------------
const CHART_PANE = 'lens-027-chart'
/**
 * Round 6 (A2): every workflow and every task is a collapsed panel. `openPanels` presses each closed
 * one open (never the thinking or context sections), so a test can reach the charts and their Buttons.
 */
async function openPanels(ui: any) {
  for (let round = 0; round < 6; round++) {
    const shut = ((await ui.findAll({ type: 'Button' })) as any[]).filter((b: any) => /^(wf-(?!thinking$|context$)|tk-)/.test(String(b.key)) && /\[\+\]/.test(String(b.text ?? b.label ?? b.props?.label ?? '')))
    if (shut.length === 0) return
    for (const b of shut) await ui.press({ key: b.key })
  }
}
const chartPane = async ($: any, surface: (typeof SURFACES)[number] = 'vscode', open = true) => {
  const ui = await $.ui.mount({ ...pane(CHART_PANE), surface })
  if (open) await openPanels(ui)
  return ui
}

describe('chat card', () => {
  test('C1 (round 4): the card is one line and an "Open flowchart" Button; the pane draws persona, model and role', async ($, on) => {
    const { opened } = await seed($, on)
    // The workflow pane opened by itself on the first spawn.
    expect(opened).toContain(CHART_PANE)
    for (const surface of SURFACES) {
      const ui = await $.ui.mount(toolRow('toolu_1', surface, SE_INPUT))
      const all = await ui.findAll({})
      expect(all.findIndex((x: any) => x.type === 'Text' && /^Workflow: Scott Hanselman spawned 1 agent - DF completed\s*$/.test(String(x.text)))).toBeGreaterThan(-1)
      expect(all.findIndex((x: any) => x.text === 'NATIVE ROW')).toBe(all.length - 1)
      expect(await ui.find({ type: 'Svg' })).toBe(undefined)
      expect(await ui.find({ type: 'Button', key: 'card-open-chart' })).toBeDefined()
      expect(await ui.find({ type: 'Button', key: 'agent-a1' })).toBe(undefined)
      await ui.unmount()
      const wp = await chartPane($, surface)
      if (surface === 'vscode') {
        const src = await svgSource(wp)
        for (const line of ['>Scott Hanselman<', '>opus<', '>Orchestrator<', '>David Fowler<', '>sonnet<', '>Software Engineer<', '>DF<', '>SH<']) expect(src.includes(line)).toBe(true)
        for (const gone of ['ctx', 'cache', 'in 1', 'out 2', 'software-engineer<']) expect(src.includes(gone)).toBe(false)
        const svg: any = await chartSvg(wp)
        expect(Number(svg?.props?.width ?? svg?.width)).toBe(120)
      } else {
        expect(await chartSvg(wp)).toBe(undefined)
        expect(await wp.find({ type: 'Text', text: /-> .*David Fowler/ })).toBeDefined()
        expect(await wp.find({ type: 'Text', text: /^\s+sonnet, Software Engineer$/ })).toBeDefined()
      }
      expect((await wp.find({ type: 'Button', key: 'agent-a1' }))?.text).toBe('David Fowler')
      expect((await wp.find({ type: 'Button', key: 'edge-a1' }))?.text).toMatch(/^17 Scott Hanselman -> David Fowler$/)
      await wp.unmount()
    }
  })

  test('C2 (1c, 1d): two parallel calls: both avatars, both arrows, Kent Beck as KB, SQA Engineer; second row one line', async ($, on) => {
    await seed($, on, { parallel: true })
    const wp = await chartPane($)
    expect(await wp.find({ type: 'Text', text: /^Scott Hanselman spawned 2 agents$/ })).toBeDefined()
    const src = await svgSource(wp)
    for (const s of ['>Kent Beck<', '>KB<', '>SQA Engineer<', '>David Fowler<']) expect(src.includes(s)).toBe(true)
    const cys = [...src.matchAll(/<circle cx="(\d+)" cy="(\d+)"/g)].map(m => [Number(m[1]), Number(m[2])])
    expect(cys.length).toBe(3)
    expect(cys[1]![1]).toBe(cys[2]![1])
    const keys = (await wp.findAll({ type: 'Button' })).map((b: any) => b.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const k of ['agent-main', 'agent-a1', 'agent-a2', 'edge-a1', 'edge-a2']) expect(keys).toContain(k)
    expect((await wp.find({ type: 'Button', key: 'edge-a2' }))?.text).toBe('Scott Hanselman -> Kent Beck')
    await wp.unmount()
    const second = await $.ui.mount(toolRow('toolu_2', 'vscode', { subagent_type: 'ai-dlc:sqa-engineer', description: 'tests', prompt: 'p' }))
    expect(await second.find({ type: 'Button', key: 'card-open-chart' })).toBe(undefined)
    expect(await second.find({ type: 'Text', text: /agent 2 of 2 in the workflow of an earlier call/ })).toBeDefined()
    await second.unmount()
  })

  test('C2b (root cause): turn.start before agent.spawn resumes: no false two-way arrow, both calls mapped', async ($, on) => {
    await seed($, on, { parallel: true, turnStartFirst: true })
    const wp = await chartPane($)
    const src = await svgSource(wp)
    expect(src.includes('marker-start')).toBe(false)
    expect((await wp.find({ type: 'Button', key: 'edge-a1' }))?.text).toMatch(/ -> David Fowler$/)
    expect((await wp.find({ type: 'Button', key: 'edge-a2' }))?.text).toBe('Scott Hanselman -> Kent Beck')
    expect(await wp.find({ type: 'Button', key: 'agent-call:toolu_2' })).toBe(undefined)
    await wp.unmount()
  })

  test('C3 (6): only running avatars blink: a call not started is steady, a finished agent stops', async ($, on) => {
    await seed($, on, { parallel: true, spawnSecond: false, complete: false })
    const wp = await chartPane($)
    let src = await svgSource(wp)
    // main is idle, a1 runs, the toolu_2 placeholder has not started: one blink.
    expect((src.match(/<animate /g) ?? []).length).toBe(1)
    expect(src.includes('>Kent Beck<')).toBe(true)
    // The placeholder still has its Buttons (1c): its avatar and its arrow.
    expect(await wp.find({ type: 'Button', key: 'agent-call:toolu_2' })).toBeDefined()
    expect(await wp.find({ type: 'Button', key: 'edge-call:toolu_2' })).toBeDefined()
    await completeAgent($, 'a1')
    src = await svgSource(wp)
    expect((src.match(/<animate /g) ?? []).length).toBe(0)
    await wp.unmount()
  })

  test('C3b (6): a list that still says running does not undo turn.complete', async ($, on) => {
    const { opened } = await seed($, on)
    const wp = await chartPane($)
    await wp.press({ key: 'agent-a1' })
    expect(opened).toContain('lens-027-agent')
    expect((((await svgSource(wp)).match(/<animate /g)) ?? []).length).toBe(0)
    await wp.unmount()
  })

  test('C4 (1b): any width: the card shows the chip and an "Open flowchart" Button that opens the workflow pane', async ($, on) => {
    const { opened } = await seed($, on, { parallel: true })
    for (const cols of [20, 200]) {
      const card = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT, 'Agent', cols))
      expect(await card.find({ type: 'Svg' })).toBe(undefined)
      expect(await card.find({ type: 'Text', text: /DF completed, KB running/ })).toBeDefined()
      opened.length = 0
      await card.press({ key: 'card-open-chart' })
      expect(opened).toContain(CHART_PANE)
      await card.unmount()
    }
    const wp = await chartPane($)
    expect((await svgSource(wp)).includes('>Kent Beck<')).toBe(true)
    expect(await wp.find({ type: 'Button', key: 'edge-a2' })).toBeDefined()
    await wp.unmount()
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

  test('C7: workflow pane Buttons open the separate panes even in drill-in mode', async ($, on) => {
    const { opened } = await seed($, on)
    const pane0 = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await pane0.press({ key: 'mode-drill' })
    await pane0.unmount()
    const wp = await chartPane($)
    await wp.press({ key: 'edge-a1' })
    await wp.press({ key: 'agent-a1' })
    expect(opened).toContain('lens-027-edge')
    expect(opened).toContain('lens-027-agent')
    await wp.unmount()
  })
})

describe('panels', () => {
  test('2: no handoff record: the arrow panel has the prompt, collapsed, whole when opened', async ($, on) => {
    await seed($, on, { parallel: true })
    const wp = await chartPane($)
    await wp.press({ key: 'edge-a2' })
    await wp.unmount()
    const edge = await $.ui.mount({ ...pane('lens-027-edge'), surface: 'vscode' })
    expect(await edge.find({ type: 'Text', text: /^\s*Prompt \(28 chars\)$/ })).toBeDefined()
    expect(await edge.find({ type: 'Text', text: 'SQA PROMPT: test the change.' })).toBe(undefined)
    await edge.press({ key: 'edge-prompt' })
    expect(await edge.find({ type: 'Text', text: 'SQA PROMPT: test the change.' })).toBeDefined()
    await edge.unmount()
  })

  test('2: a call not spawned yet: its arrow still shows the prompt from the call', async ($, on) => {
    await seed($, on, { parallel: true, spawnSecond: false })
    const wp = await chartPane($)
    await wp.press({ key: 'edge-call:toolu_2' })
    await wp.unmount()
    const edge = await $.ui.mount({ ...pane('lens-027-edge'), surface: 'vscode' })
    await edge.press({ key: 'edge-prompt' })
    expect(await edge.find({ type: 'Text', text: 'SQA PROMPT: test the change.' })).toBeDefined()
    await edge.unmount()
  })

  test('L4: a matched record: record and hand-back, collapsed until opened; no match label', async ($, on) => {
    await seed($, on)
    const ui = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await ui.press({ key: 'edge-a1' })
    await ui.unmount()
    const edge = await $.ui.mount({ ...pane('lens-027-edge'), surface: 'vscode' })
    expect(await edge.find({ type: 'Text', text: /Record matched/ })).toBe(undefined)
    expect(await edge.find({ type: 'Text', text: new RegExp(`Hand-back \\(${HANDBACK.replace(/[./]/g, '\\$&')}\\)$`) })).toBeDefined()
    expect(await edge.find({ type: 'Text', text: 'HANDOFF BODY' })).toBe(undefined)
    await edge.press({ key: 'edge-doc' })
    await edge.press({ key: 'edge-back' })
    expect(await edge.find({ type: 'Text', text: 'HANDOFF BODY' })).toBeDefined()
    expect(await edge.find({ type: 'Text', text: 'HANDBACK BODY' })).toBeDefined()
    await edge.unmount()
  })

  test('3, 4: the avatar panel: header, then Usage with the figures, the window and the cost, with no source', async ($, on) => {
    await seed($, on, { files: { '.ai-dlc/model-costing.json': COSTING_ARRAY } })
    const ui = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await ui.press({ key: 'agent-a1' })
    await ui.unmount()
    const ag = await $.ui.mount({ ...pane('lens-027-agent'), surface: 'vscode' })
    expect(await ag.find({ type: 'Text', text: 'David Fowler' })).toBeDefined()
    expect(await ag.find({ type: 'Text', text: /^\s*DF\s*$/ })).toBeDefined()
    expect(await ag.find({ type: 'Text', text: /^\s*done\s*$/ })).toBeDefined()
    expect(await ag.find({ type: 'Text', text: 'sonnet · Software Engineer' })).toBeDefined()
    expect(await ag.find({ type: 'Text', text: /^\s*Usage \(300K \/ 200K\)$/ })).toBeDefined()
    await ag.press({ key: 'agent-usage' })
    expect(await ag.find({ type: 'Text', text: '300K / 200K' })).toBeDefined()
    expect(await ag.find({ type: 'Text', text: '████████████' })).toBeDefined()
    for (const [k, v] of [['Input', '100K'], ['Output', '200K'], ['Cache read', '90K'], ['Cache write', '9K'], ['Uncached', '1K'], ['Ran on', 'claude-sonnet-5-5']])
      expect(await ag.find({ type: 'Text', text: v })).toBeDefined()
    // 0.003 + 3 + 0.027 + 0.03375
    expect(await ag.find({ type: 'Text', text: '$3.06' })).toBeDefined()
    expect(await ag.find({ type: 'Text', text: /^\s*Tool calls \(1\)$/ })).toBeDefined()
    await ag.press({ key: 'agent-calls' })
    expect(await ag.find({ type: 'Text', text: /^✓ Read x\.md ~200K est\.$/ })).toBeDefined()
    await ag.unmount()
  })

  test('rename: model-metadata.json is read before model-costing.json; the panel does not name the file', async ($, on) => {
    const other = COSTING_ARRAY.replace('"outputPerMTok":15', '"outputPerMTok":16')
    await seed($, on, { files: { '.ai-dlc/model-metadata.json': other, '.ai-dlc/model-costing.json': COSTING_ARRAY } })
    const ui = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await ui.press({ key: 'agent-a1' })
    await ui.unmount()
    const ag = await $.ui.mount({ ...pane('lens-027-agent'), surface: 'vscode' })
    await ag.press({ key: 'agent-usage' })
    // 0.003 + 3.2 + 0.027 + 0.03375: the metadata file's output price, not the older file's
    expect(await ag.find({ type: 'Text', text: '$3.26' })).toBeDefined()
    expect(await ag.find({ type: 'Text', text: /model-(metadata|costing)\.json/ })).toBe(undefined)
    await ag.unmount()
  })

  test('4: no metadata file: cost and a subagent window on another model show —', async ($, on) => {
    await seed($, on)
    const ui = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await ui.press({ key: 'agent-a1' })
    await ui.unmount()
    const ag = await $.ui.mount({ ...pane('lens-027-agent'), surface: 'vscode' })
    await ag.press({ key: 'agent-usage' })
    expect(await ag.find({ type: 'Text', text: '300K / —' })).toBeDefined()
    const costRow: any = (await ag.findAll({})).find((x: any) => x.type === 'Box' && String(x.text) === 'Cost—')
    expect(costRow).toBeDefined()
    await ag.unmount()
  })

  test('L4 fallback: drill-in shows the panel inside the lens pane with a Back button', async ($, on) => {
    const { opened } = await seed($, on)
    opened.length = 0
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
    expect(await sub.find({ type: 'Text', text: /^\s*Background tasks \(1\)$/ })).toBeDefined()
    await sub.press({ key: 'agent-tasks' })
    expect(await sub.find({ type: 'Text', text: /^\s*npm run watch - running$/ })).toBeDefined()
    await sub.unmount()
  })

  test('E7: a background Bash shows in the main avatar panel at once', async ($, on) => {
    await seed($, on)
    await $.tool.call({ tool: 'Bash', command: 'sleep 15', run_in_background: true, tool_use_id: 'toolu_b' })
    const ui = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await ui.press({ key: 'agent-main' })
    await ui.unmount()
    const main = await $.ui.mount({ ...pane('lens-027-agent'), surface: 'vscode' })
    await main.press({ key: 'agent-tasks' })
    expect(await main.find({ type: 'Text', text: /^\s*sleep 15 - running$/ })).toBeDefined()
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

  test('round 4 UI: a narrow avatar panel: four divided sections, each with a heading, a count and its own Button; no raw JSON', async ($, on) => {
    await seed($, on, { files: { '.ai-dlc/lens.json': JSON.stringify({ collapsedByDefault: false }) } })
    const ui = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await ui.press({ key: 'agent-a1' })
    await ui.unmount()
    const ag = await $.ui.mount({ ...pane('lens-027-agent', 'inline', 24), surface: 'vscode' })
    const all: any[] = await ag.findAll({})
    const headings = all.filter((x: any) => x.type === 'Text' && /^\s*(Usage|Tool calls|Background tasks|Thinking) \(/.test(String(x.text))).map((x: any) => String(x.text).trim().replace(/ \(.*$/, ''))
    expect(headings).toEqual(['Usage', 'Tool calls', 'Background tasks', 'Thinking'])
    expect(all.filter((x: any) => x.type === 'Text' && /^─+$/.test(String(x.text))).length).toBe(4)
    for (const k of ['agent-usage', 'agent-calls', 'agent-tasks', 'agent-thinking']) expect(await ag.find({ type: 'Button', key: k })).toBeDefined()
    // No raw JSON in the panel.
    expect(all.some((x: any) => x.type === 'Text' && /^\s*[[{]"/.test(String(x.text)))).toBe(false)
    await ag.unmount()
  })
})

describe('collapsed by default (addendum 2)', () => {
  test('every [+]/[-] section starts collapsed: workflow pane, /spike027 pane, arrow and avatar panels', async ($, on) => {
    await seed($, on)
    await $.tool.call({ tool: 'Grep', pattern: 'needle', tool_use_id: 'toolu_m1' })
    const wp = await chartPane($)
    for (const k of ['wf-thinking', 'wf-context']) expect((await wp.find({ type: 'Button', key: k }))?.text).toBe('[+]')
    expect(await wp.find({ type: 'Text', text: /Grep needle/ })).toBe(undefined)
    await wp.press({ key: 'wf-context' })
    expect(await wp.find({ type: 'Text', text: /Grep needle/ })).toBeDefined()
    await wp.unmount()
    const lens = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    for (const k of ['lens-thinking', 'lens-context', 'lens-settings']) expect((await lens.find({ type: 'Button', key: k }))?.text).toBe('[+]')
    await lens.press({ key: 'edge-a1' })
    await lens.press({ key: 'agent-a1' })
    await lens.unmount()
    const edge = await $.ui.mount({ ...pane('lens-027-edge'), surface: 'vscode' })
    for (const k of ['edge-usage', 'edge-doc', 'edge-back']) expect((await edge.find({ type: 'Button', key: k }))?.text).toBe('[+]')
    await edge.unmount()
    const ag = await $.ui.mount({ ...pane('lens-027-agent'), surface: 'vscode' })
    for (const k of ['agent-usage', 'agent-calls', 'agent-tasks', 'agent-thinking']) expect((await ag.find({ type: 'Button', key: k }))?.text).toBe('[+]')
    await ag.unmount()
  })

  test('collapsedByDefault false in lens.json opens them', async ($, on) => {
    await seed($, on, { files: { '.ai-dlc/lens.json': JSON.stringify({ collapsedByDefault: false }) } })
    const wp = await chartPane($)
    expect((await wp.find({ type: 'Button', key: 'wf-thinking' }))?.text).toBe('[-]')
    await wp.unmount()
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

  test('the module reads the three files, never the process env; the pane shows each value, not its level', async ($, on) => {
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
    // Round 4: the pane shows the values only; /spike027-lens-configure names the levels.
    expect(await lens.find({ type: 'Text', text: 'chartMode = "button"' })).toBeDefined()
    expect(await lens.find({ type: 'Text', text: 'showCost = false' })).toBeDefined()
    expect(await lens.find({ type: 'Text', text: 'callsShown = 5' })).toBeDefined()
    expect(await lens.find({ type: 'Text', text: 'blinkMs = 1000' })).toBeDefined()
    expect(await lens.find({ type: 'Text', text: /^blinkMs = "fast" is invalid, ignored$/ })).toBeDefined()
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
    const wp = await chartPane($)
    const svg: any = await chartSvg(wp)
    expect(Number(svg?.props?.width ?? svg?.width)).toBe(200)
    await wp.unmount()
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

// ---------------- round 4 (step 17.l3) ----------------
/** Every text a mounted drawing shows: Text and Button labels, and the Svg markup. */
async function drawn(ui: any): Promise<string[]> {
  const all: any[] = await ui.findAll({})
  return all.flatMap((x: any) => [x.text, x.label, x.props?.label, x.props?.source, x.source, x.props?.alt].filter((v: unknown) => typeof v === 'string' && v !== '')) as string[]
}

/** Mounts the chat cards, the /spike027 pane, and every avatar and arrow panel; returns all their text. */
async function everything($: any, extraCard?: string): Promise<string[]> {
  const out: string[] = []
  for (const id of ['toolu_1', ...(extraCard ? [extraCard] : [])]) {
    const card = await $.ui.mount(toolRow(id, 'vscode', SE_INPUT))
    out.push(...(await drawn(card)))
    await card.unmount()
  }
  const lens = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
  out.push(...(await drawn(lens)))
  for (const target of ['agent-main', 'agent-a1', 'agent-a2', 'edge-a1', 'edge-a2']) {
    if ((await lens.find({ type: 'Button', key: target })) === undefined) continue
    await lens.press({ key: target })
    const id = target.startsWith('agent-') ? 'lens-027-agent' : 'lens-027-edge'
    const p = await $.ui.mount({ ...pane(id), surface: 'vscode' })
    out.push(...(await drawn(p)))
    await p.unmount()
  }
  await lens.unmount()
  return out
}

describe('round 4: no Agent description, no sources, collapsible background tasks', () => {
  test("no rendered text contains an Agent call's description: card, context, chip, panels, /spike027 pane", async ($, on) => {
    on('classic.Stop', () => ({}))
    await seed($, on, { parallel: true, desc: ['Wait test agent one', 'Wait test agent two'], files: { '.ai-dlc/lens.json': JSON.stringify({ collapsedByDefault: false }) } })
    // A main-loop Agent call lands in the gathered context; a subagent's in its tool calls.
    await $.tool.call({ tool: 'Agent', subagent_type: 'ai-dlc:code-reviewer', description: 'Wait test agent three', prompt: 'x', tool_use_id: 'toolu_3' })
    await $.tool.call({ tool: 'Task', subagent_type: 'ai-dlc:code-reviewer', description: 'Wait test agent four', prompt: 'x', tool_use_id: 'toolu_4', agentId: 'a1' } as any)
    await $.classic.SubagentStop({
      stop_hook_active: false,
      agent_id: 'a1',
      agent_transcript_path: '',
      agent_type: 'ai-dlc:software-engineer',
      background_tasks: [{ id: 's9', type: 'subagent', status: 'running', description: 'Wait test agent five', agent_type: 'ai-dlc:sqa-engineer' }],
    })
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [{ id: 's8', type: 'subagent', status: 'running', description: 'Wait test agent six', agent_type: 'ai-dlc:sqa-engineer' }] })
    const narrow = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT, 'Agent', 20))
    const first = await drawn(narrow)
    await narrow.unmount()
    const texts = [...first, ...(await everything($, 'toolu_2'))]
    expect(texts.length).toBeGreaterThan(20)
    // The calls are still named, by their agent type.
    expect(texts.some(t => /ai-dlc:code-reviewer/.test(t))).toBe(true)
    expect(texts.filter(t => /Wait test agent/.test(t))).toEqual([])
  })

  test('no rendered text contains a source label: model, window, metadata file, setting levels', async ($, on) => {
    await seed($, on, {
      parallel: true,
      files: {
        '.ai-dlc/model-metadata.json': COSTING_ARRAY,
        '.ai-dlc/lens.json': JSON.stringify({ collapsedByDefault: false, blinkMs: 'fast' }),
        '.claude/settings.json': JSON.stringify({ env: { AI_DLC_LENS_CALLS_SHOWN: '5', AI_DLC_LENS_BLINK: 'maybe' } }),
        '.claude/settings.local.json': JSON.stringify({ env: { AI_DLC_LENS_CELL_PX: '9' } }),
      },
    })
    await $.tool.call({ tool: 'Bash', command: 'sleep 15', run_in_background: true, tool_use_id: 'toolu_b' })
    const texts = await everything($)
    expect(texts.some(t => t === 'sonnet · Software Engineer')).toBe(true)
    expect(texts.some(t => /^Cost\$\d/.test(t))).toBe(true)
    expect(texts.some(t => /is invalid, ignored$/.test(t))).toBe(true)
    const SOURCE = [
      /\bfrom (agent definition|the orchestrator|the session|\.ai-dlc)/,
      /window from/,
      /agent definition|Agent call \(|session's model|session's context window|main session's window/,
      /model-(metadata|costing)\.json/,
      /settings(\.local)?\.json|lens\.json/,
      /\[(default|agent\.list|tool\.call|Stop|SubagentStop)\]/,
      /Record matched/,
      /not main's model|not found\)/,
    ]
    // Setting values that are paths are values, not sources: left out of the check.
    const values = texts.map(t => t.replace(/(costingPath|costingFallbackPath|rosterPath) = "[^"]*"/g, ''))
    expect(values.filter(t => SOURCE.some(re => re.test(t)))).toEqual([])
  })

  test('each background task is one collapsed line (description - status); expanded, its details', async ($, on) => {
    on('classic.Stop', () => ({}))
    await seed($, on)
    await $.tool.call({ tool: 'Bash', command: 'sleep 15', run_in_background: true, tool_use_id: 'toolu_b' })
    await $.classic.SubagentStop({
      stop_hook_active: false,
      agent_id: 'a1',
      agent_transcript_path: '',
      agent_type: 'ai-dlc:software-engineer',
      last_assistant_message: 'A1 RESULT',
      background_tasks: [
        { id: 'b1', type: 'shell', status: 'running', description: 'npm run watch', command: 'npm run watch' },
        { id: 's1', type: 'subagent', status: 'running', description: 'tests', agent_type: 'ai-dlc:sqa-engineer' },
      ],
    })
    // The shell main started is no longer listed at stop time: it has ended.
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
    const lens = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await lens.press({ key: 'agent-a1' })
    const sub = await $.ui.mount({ ...pane('lens-027-agent'), surface: 'vscode' })
    expect(await sub.find({ type: 'Button', key: 'task-b1' })).toBe(undefined)
    await sub.press({ key: 'agent-tasks' })
    for (const k of ['task-b1', 'task-s1']) expect((await sub.find({ type: 'Button', key: k }))?.text).toBe('[+]')
    expect(await sub.find({ type: 'Text', text: /^\s*npm run watch - running$/ })).toBeDefined()
    expect(await sub.find({ type: 'Text', text: /^\s*SQA Engineer - running$/ })).toBeDefined()
    expect(await sub.find({ type: 'Box', text: /^Type/ })).toBe(undefined)
    await sub.press({ key: 'task-b1' })
    expect(await sub.find({ type: 'Box', text: 'Typeshell' })).toBeDefined()
    expect(await sub.find({ type: 'Box', text: 'Idb1' })).toBeDefined()
    expect(await sub.find({ type: 'Box', text: /^Started\d\d:\d\d:\d\d$/ })).toBeDefined()
    expect(await sub.find({ type: 'Box', text: 'Ended—' })).toBeDefined()
    expect(await sub.find({ type: 'Box', text: 'Output—' })).toBeDefined()
    expect(await sub.find({ type: 'Box', text: /^Agent type/ })).toBe(undefined)
    await sub.press({ key: 'task-s1' })
    expect(await sub.find({ type: 'Box', text: 'Agent typeai-dlc:sqa-engineer' })).toBeDefined()
    await sub.unmount()
    // Main's panel: a1 (an agent.list child) by persona, its last message as output; the ended shell has an end time.
    await lens.press({ key: 'agent-main' })
    const main = await $.ui.mount({ ...pane('lens-027-agent'), surface: 'vscode' })
    await main.press({ key: 'agent-tasks' })
    expect(await main.find({ type: 'Text', text: /^\s*David Fowler - running$/ })).toBeDefined()
    expect(await main.find({ type: 'Text', text: /^\s*sleep 15 - ended$/ })).toBeDefined()
    await main.press({ key: 'task-a1' })
    expect(await main.find({ type: 'Box', text: 'OutputA1 RESULT' })).toBeDefined()
    expect(await main.find({ type: 'Box', text: 'Agent typeai-dlc:software-engineer' })).toBeDefined()
    await main.press({ key: 'task-b9' })
    expect(await main.find({ type: 'Box', text: /^Ended\d\d:\d\d:\d\d$/ })).toBeDefined()
    await main.unmount()
    await lens.unmount()
  })

  test('stampTasks keeps the first-seen time and stamps the end once; an agent task is never named by its description', () => {
    const t0 = { id: 'b1', type: 'shell', status: 'running', description: 'sleep 15', source: 'tool.call' }
    const [a] = stampTasks([], [t0], 1000)
    expect([a!.startedAt, a!.endedAt]).toEqual([1000, null])
    const [b] = stampTasks([a!], [{ ...t0, status: 'ended' }], 2000)
    expect([b!.startedAt, b!.endedAt]).toEqual([1000, 2000])
    const [c] = stampTasks([b!], [{ ...t0, status: 'ended' }], 3000)
    expect(c!.endedAt).toBe(2000)
    const agentTask = { id: 'k1', type: 'subagent', status: 'running', description: 'Wait test agent one', source: 'agent.list', agentType: 'ai-dlc:sqa-engineer' }
    expect(isAgentTask(agentTask)).toBe(true)
    expect(taskLine(agentTask, 'Kent Beck')).toBe('Kent Beck - running')
    expect(taskLine(agentTask, '')).toBe('SQA Engineer - running')
    expect(taskLine(t0, '')).toBe('sleep 15 - running')
    expect(summarize('Agent', { description: 'Wait test agent one', subagent_type: 'ai-dlc:sqa-engineer' })).toBe('ai-dlc:sqa-engineer')
    expect(summarize('Task', { description: 'Wait test agent one' })).toBe('Task')
    expect(fmtClock(null)).toBe('—')
  })
})

// ---------------- round 4 bug: one workflow across messages and turns ----------------
describe('round 4: workflows', () => {
  const later = async ($: any) => {
    await $.tool.call({ tool: 'Agent', subagent_type: 'ai-dlc:sqa-engineer', description: 'later', prompt: 'SQA PROMPT: test the change.', tool_use_id: 'toolu_2' })
    await $.agent.spawn({ tool_use_id: 'toolu_2', prompt: 'SQA PROMPT: test the change.', description: 'later', subagentType: 'ai-dlc:sqa-engineer', provider: { plugin: 'ai-dlc', tier: 'user' }, parentModel: 'claude-opus-5-5', background: true, fork: false })
  }

  test('regression: B spawned in a later message while A still runs joins the same chart, running, with its own arrow', async ($, on) => {
    // A (a1) is spawned and keeps running; B (a2) comes from a later main-loop message.
    await seed($, on, { complete: false })
    await $.turn.start({ text: 'and now test it', turnId: 'm2' })
    await later($)
    const wp = await chartPane($)
    // One workflow (round 6: one panel, A2); both avatars and both arrows in one chart.
    expect((await wp.findAll({ type: 'Button' })).filter((b: any) => String(b.key).startsWith('wf-toolu')).map((b: any) => b.key)).toEqual(['wf-toolu_1'])
    for (const k of ['agent-a1', 'agent-a2', 'edge-a1', 'edge-a2']) expect(await wp.find({ type: 'Button', key: k })).toBeDefined()
    expect((await wp.find({ type: 'Button', key: 'edge-a2' }))?.text).toBe('Scott Hanselman -> Kent Beck')
    const src = await svgSource(wp)
    for (const n of ['>David Fowler<', '>Kent Beck<']) expect(src.includes(n)).toBe(true)
    // A and B both run, and so does main's new turn: three blink.
    expect((src.match(/<animate /g) ?? []).length).toBe(3)
    expect(await wp.find({ type: 'Text', text: /^Scott Hanselman spawned 2 agents$/ })).toBeDefined()
    await wp.unmount()
    const card = await $.ui.mount(toolRow('toolu_2', 'vscode', { subagent_type: 'ai-dlc:sqa-engineer', description: 'later', prompt: 'p' }))
    expect(await card.find({ type: 'Text', text: /agent 2 of 2 in the workflow of an earlier call/ })).toBeDefined()
    await card.unmount()
  })

  test('a spawn after every agent finished starts a new workflow: one panel each, titled by its parent task, all collapsed (round 5)', async ($, on) => {
    await seed($, on, { files: { 'docs/handoffs/R/run.md': '---\nrun: R\n---\n\n# Run: R — the lens spike\n' } })
    await $.turn.start({ text: 'Test the change please\nmore lines', turnId: 'm2' })
    await later($)
    const wp = await chartPane($, 'vscode', false)
    expect((await wp.find({ type: 'Button', key: 'wf-toolu_2' }))?.text).toBe('[+]')
    expect((await wp.find({ type: 'Button', key: 'wf-toolu_1' }))?.text).toBe('[+]')
    // Titles: the run's title from run.md (the brief names its record), else the request; never "Agent: <description>".
    expect(await wp.find({ type: 'Text', text: /^\s*Test the change please$/ })).toBeDefined()
    expect(await wp.find({ type: 'Text', text: /^\s*R — the lens spike$/ })).toBeDefined()
    expect(await wp.find({ type: 'Text', text: /Agent: / })).toBe(undefined)
    // Newest first; both collapsed until pressed.
    const keys = (await wp.findAll({ type: 'Button' })).map((b: any) => String(b.key))
    expect(keys.indexOf('wf-toolu_2')).toBeLessThan(keys.indexOf('wf-toolu_1'))
    expect(await wp.find({ type: 'Button', key: 'toolu_2:agent-a2' })).toBe(undefined)
    expect(await wp.find({ type: 'Button', key: 'toolu_1:agent-a1' })).toBe(undefined)
    await wp.press({ key: 'wf-toolu_1' })
    await wp.press({ key: 'wf-toolu_2' })
    // Round 6 (A2): each workflow holds its task panels, collapsed too.
    expect(await wp.find({ type: 'Button', key: 'toolu_1:agent-a1' })).toBe(undefined)
    await openPanels(wp)
    expect(await wp.find({ type: 'Button', key: 'toolu_1:agent-a1' })).toBeDefined()
    expect(await wp.find({ type: 'Button', key: 'toolu_2:agent-a2' })).toBeDefined()
    const all = (await wp.findAll({ type: 'Button' })).map((b: any) => b.key)
    expect(new Set(all).size).toBe(all.length)
    await wp.unmount()
    const card = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT))
    expect(await card.find({ type: 'Text', text: /^Workflow: R — the lens spike - DF completed\s*$/ })).toBeDefined()
    await card.unmount()
  })

  test('joinWorkflow: an agent of a workflow spawning joins it; the main loop joins while one works; else a new workflow', () => {
    const agent = (id: string, toolUseId: string, status: string) => ({ id, toolUseId, status }) as any
    let wf = joinWorkflow(WF0, 'main', 'c1', {}, {})
    expect(wf.order).toEqual(['c1'])
    // c1 not spawned yet: pending, so active; c2 from the next message joins.
    wf = joinWorkflow(wf, 'main', 'c2', {}, {})
    expect(wf.of['c2']).toBe('c1')
    const running = { a1: agent('a1', 'c1', 'running'), a2: agent('a2', 'c2', 'completed') }
    // a1 spawns: its child joins c1's workflow, as a descendant.
    wf = joinWorkflow(wf, 'a1', 'c3', running, { c1: 'a1', c2: 'a2' })
    expect([wf.of['c3'], wf.by['c3']]).toEqual(['c1', 'a1'])
    const done = { a1: agent('a1', 'c1', 'completed'), a2: agent('a2', 'c2', 'completed'), a3: agent('a3', 'c3', 'completed') }
    expect(workflowActive(wf, 'c1', done, { c1: 'a1', c2: 'a2', c3: 'a3' })).toBe(false)
    wf = joinWorkflow(wf, 'main', 'c4', done, { c1: 'a1', c2: 'a2', c3: 'a3' })
    expect(wf.order).toEqual(['c1', 'c4'])
    expect(runTitle('---\nrun: X\n---\n\n# Run state: X\n')).toBe('X')
    expect(runTitle('---\nrun: Y\n---\nno heading\n')).toBe('Y')
    expect(runTitle(null)).toBe('')
  })
})

describe('round 4: null model limits', () => {
  test('a null limit in the metadata file has no row; a known one has its value; cost keeps — when unknown', async ($, on) => {
    const meta = JSON.stringify({
      models: [
        { id: 'claude-sonnet-5-5', aliases: [], contextWindow: 200000, longContextWindow: null, maxInputTokens: null, maxOutputTokens: 64000, pricing: { input: 3, output: 15, cacheRead: 0.3, cacheWrite5m: 3.75, cacheWrite1h: 6 } },
      ],
    })
    await seed($, on, { files: { '.ai-dlc/model-metadata.json': meta } })
    const ui = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await ui.press({ key: 'agent-a1' })
    await ui.unmount()
    const ag = await $.ui.mount({ ...pane('lens-027-agent'), surface: 'vscode' })
    await ag.press({ key: 'agent-usage' })
    expect(await ag.find({ type: 'Box', text: 'Max output64K' })).toBeDefined()
    expect(await ag.find({ type: 'Text', text: 'Max input' })).toBe(undefined)
    expect(await ag.find({ type: 'Text', text: 'Long-context window' })).toBe(undefined)
    expect(await ag.find({ type: 'Box', text: /^Cost\$/ })).toBeDefined()
    await ag.unmount()
    // main runs on claude-opus-5-5, not in the file: no limit rows at all, and its cost is —.
    const lens = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await lens.press({ key: 'agent-main' })
    await lens.unmount()
    const main = await $.ui.mount({ ...pane('lens-027-agent'), surface: 'vscode' })
    await main.press({ key: 'agent-usage' })
    expect(await main.find({ type: 'Box', text: 'Cost—' })).toBeDefined()
    expect(await main.find({ type: 'Text', text: /^Max / })).toBe(undefined)
    await main.unmount()
    expect(limitRows({ path: 'x', text: meta, error: '' }, 'claude-sonnet-5-5')).toEqual([['Max output', '64K']])
  })
})

// ---------------- round 5 (step 17.l4) ----------------
const RUN_R = (stage: string, status = 'in-progress', runStatus = 'active') =>
  `---\nrun: R\nstatus: ${runStatus}\ncurrent-stage: build\n---\n\n# Run: R — the lens spike\n\n## Stages\n| Step | Stage | Agent | Status | Record |\n|---|---|---|---|---|\n| 16 | research | research-assistant | done (passed) | x |\n| 17 | ${stage} | software-engineer | ${status} | \`17-orchestrator-to-software-engineer.handoff.md\` |\n`
const RUN_S = '---\nrun: S\nstatus: active\n---\n\n# Run: S — the second task\n\n| Step | Stage | Agent | Status |\n|---|---|---|---|\n| 18 | write the tests | sqa-engineer | in-progress |\n'
const S_BRIEF = 'Your handoff record is docs/handoffs/S/18-orchestrator-to-sqa-engineer.handoff.md (root x).\nTest it.'

/** Every Box of a drawing with its alignment props, wherever the harness keeps them. */
async function boxes(ui: any): Promise<{ alignItems?: string; justifyContent?: string; flexGrow?: number; minHeight?: number }[]> {
  const all: any[] = await ui.findAll({ type: 'Box' })
  return all.map((x: any) => ({ ...(x ?? {}), ...(x?.props ?? {}) }))
}
const centred = (b: { alignItems?: string; justifyContent?: string }) => b.alignItems === 'center' && b.justifyContent === 'center'
const statusSvgs = async (ui: any): Promise<string[]> =>
  ((await ui.findAll({ type: 'Svg' })) as any[]).map((x: any) => String(x?.props?.alt ?? x?.alt ?? '')).filter(a => a.startsWith('status: '))
const statusSource = async (ui: any): Promise<string> => {
  const all: any[] = await ui.findAll({ type: 'Svg' })
  const hit = all.find((x: any) => String(x?.props?.alt ?? x?.alt ?? '').startsWith('status: '))
  return String(hit?.props?.source ?? hit?.source ?? '')
}

describe('round 5: centring (requirement 1)', () => {
  test('the chart area, the chart, the avatars and the card are centred both ways; the chart area fills the body', async ($, on) => {
    await seed($, on)
    const wp = await chartPane($)
    const bs = await boxes(wp)
    // Round 6 (A9): no filler under the content: no Box takes a minHeight, and the outermost Box adds no margin or padding.
    expect(bs.some(b => b.minHeight !== undefined)).toBe(false)
    const outer: any = bs[0]
    for (const k of ['margin', 'marginTop', 'marginBottom', 'padding', 'paddingTop', 'paddingBottom']) expect(outer?.[k] ?? 0).toBe(0)
    // The Svg's own Box, the task's chart area, the Buttons rows: centred.
    expect(bs.filter(centred).length).toBeGreaterThanOrEqual(3)
    const src = await svgSource(wp)
    expect(src).toMatch(/preserveAspectRatio="xMidYMid meet"/)
    // The initials sit on the circle's centre: middle anchor, central baseline, the circle's own y.
    const circle = /<circle cx="(\d+)" cy="(\d+)"/.exec(src)!
    expect(src.includes(`<text x="${circle[1]}" y="${circle[2]}" text-anchor="middle" dominant-baseline="central"`)).toBe(true)
    await wp.unmount()
    const card = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT))
    expect((await boxes(card)).some(centred)).toBe(true)
    const all = await card.findAll({})
    expect(all.findIndex((x: any) => x.text === 'NATIVE ROW')).toBe(all.length - 1)
    await card.unmount()
    // The avatar panel's header block.
    const lens = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await lens.press({ key: 'agent-a1' })
    await lens.unmount()
    const ag = await $.ui.mount({ ...pane('lens-027-agent'), surface: 'vscode' })
    expect((await boxes(ag)).filter(centred).length).toBeGreaterThanOrEqual(2)
    await ag.unmount()
  })
})

describe('round 5: the task title at the top (requirement 2)', () => {
  test('the workflow panel shows the parent task; its task panel the running stage, following a run.md write (round 6, A2)', async ($, on) => {
    const { files } = await seed($, on, { complete: false, files: { 'docs/handoffs/R/run.md': RUN_R('build the lens') } })
    const wp = await chartPane($)
    // The workflow panel's header: the run's title. Its one task panel: the record's stage row.
    expect(await wp.find({ type: 'Text', text: 'R — the lens spike' })).toBeDefined()
    expect(await wp.find({ type: 'Text', text: 'build the lens' })).toBeDefined()
    const all: any[] = await wp.findAll({})
    const head = all.findIndex((x: any) => x.type === 'Text' && x.text === 'R — the lens spike')
    expect(head).toBeLessThan(all.findIndex((x: any) => x.type === 'Text' && x.text === 'build the lens'))
    // The orchestrator writes run.md (the next fix round): the task follows with no other event, its panel still open.
    files['docs/handoffs/R/run.md'] = RUN_R('build the lens: fix round 1')
    await $.tool.call({ tool: 'Write', file_path: 'docs/handoffs/R/run.md', content: 'x', tool_use_id: 'toolu_w' })
    expect(await wp.find({ type: 'Text', text: 'build the lens: fix round 1' })).toBeDefined()
    expect(await wp.find({ type: 'Text', text: /^build the lens$/ })).toBe(undefined)
    expect(await chartSvg(wp)).toBeDefined()
    await completeAgent($, 'a1')
    expect(await wp.find({ type: 'Text', text: 'R — the lens spike' })).toBeDefined()
    await wp.unmount()
  })

  test('two agents on two tasks (two runs): the top shows the parent task, the human request; never a description', async ($, on) => {
    await seed($, on, { parallel: true, complete: false, request: 'Ship the lens\nwith the panels', prompt2: S_BRIEF, desc: ['Wait one', 'Wait two'], files: { 'docs/handoffs/R/run.md': RUN_R('build the lens'), 'docs/handoffs/S/run.md': RUN_S } })
    const wp = await chartPane($)
    // The panel's header is the human's request; round 6 (A2): each run's stage is a task panel of its own.
    expect(await wp.find({ type: 'Text', text: 'Ship the lens' })).toBeDefined()
    expect(await wp.find({ type: 'Text', text: 'build the lens' })).toBeDefined()
    expect(await wp.find({ type: 'Text', text: 'write the tests' })).toBeDefined()
    expect(await wp.find({ type: 'Button', key: 'tk-toolu_1-0' })).toBeDefined()
    expect(await wp.find({ type: 'Button', key: 'tk-toolu_1-1' })).toBeDefined()
    expect(await wp.find({ type: 'Button', key: 't0:agent-a1' })).toBeDefined()
    expect(await wp.find({ type: 'Button', key: 't1:agent-a2' })).toBeDefined()
    expect((await drawn(wp)).filter(t => /Wait one|Wait two|Agent: /.test(t))).toEqual([])
    await wp.unmount()
    const card = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT))
    expect(await card.find({ type: 'Text', text: /^Workflow: Ship the lens - DF running, KB running\s*$/ })).toBeDefined()
    await card.unmount()
  })

  test('workflowTask and parseRun: one run, one stage; one run, two stages; no run; isHumanRequest', () => {
    const r = parseRun(RUN_R('build'))!
    expect(r).toEqual({ title: 'R — the lens spike', status: 'active', stage: 'build', stages: { '16': 'research', '17': 'build' } })
    expect(parseRun('---\nrun: Q\nstatus: blocked\ncurrent-stage: spikes\n---\n# Run: Q\n')).toEqual({ title: 'Q', status: 'blocked', stage: 'spikes', stages: {} })
    expect(parseRun(null)).toBe(null)
    const runs = { 'docs/handoffs/R': r }
    const ag = (handoff: string | null, status: string, prompt = '') => ({ handoff, status, prompt, type: 't' }) as any
    const rec = (code: string) => `docs/handoffs/R/${code}-orchestrator-to-x.handoff.md`
    expect(workflowTask([ag(rec('17'), 'running')], runs, 'REQ')).toEqual({ parent: 'R — the lens spike', current: 'build' })
    // Same run, different stages: the parent task.
    expect(workflowTask([ag(rec('17'), 'running'), ag(rec('16'), 'running')], runs, 'REQ')).toEqual({ parent: 'R — the lens spike', current: 'R — the lens spike' })
    // A row the run does not list yet: the run's stage in progress.
    expect(workflowTask([ag(rec('18'), 'running')], runs, 'REQ').current).toBe('build')
    // No record: the request that made the calls.
    expect(workflowTask([ag(null, 'running', 'just do it')], runs, 'REQ')).toEqual({ parent: 'REQ', current: 'REQ' })
    expect(isHumanRequest('Ship it')).toBe(true)
    expect(isHumanRequest('<task-notification>done</task-notification>')).toBe(false)
    expect(isHumanRequest('  ')).toBe(false)
  })
})

describe('round 5: several workflows (requirement 3) and the status indicator (requirement 4)', () => {
  test('two workflows: a panel each, headed by its parent task and its status, all collapsed', async ($, on) => {
    await seed($, on, { files: { 'docs/handoffs/R/run.md': RUN_R('build the lens', 'done (passed)') } })
    await $.turn.start({ text: 'Test the change please', turnId: 'm2' })
    await $.tool.call({ tool: 'Agent', subagent_type: 'ai-dlc:sqa-engineer', description: 'later', prompt: 'SQA PROMPT: test the change.', tool_use_id: 'toolu_2' })
    await $.agent.spawn({ tool_use_id: 'toolu_2', prompt: 'SQA PROMPT: test the change.', description: 'later', subagentType: 'ai-dlc:sqa-engineer', provider: { plugin: 'ai-dlc', tier: 'user' }, parentModel: 'claude-opus-5-5', background: true, fork: false })
    const wp = await chartPane($, 'vscode', false)
    for (const k of ['wf-toolu_1', 'wf-toolu_2']) expect((await wp.find({ type: 'Button', key: k }))?.text).toBe('[+]')
    expect(await chartSvg(wp)).toBe(undefined)
    // Newest first: its status is in progress (blinking), the older completed (steady).
    expect(await statusSvgs(wp)).toEqual(['status: in progress', 'status: completed'])
    expect(await wp.find({ type: 'Text', text: /^\s*Test the change please$/ })).toBeDefined()
    expect(await wp.find({ type: 'Text', text: /^\s*R — the lens spike$/ })).toBeDefined()
    await wp.press({ key: 'wf-toolu_2' })
    await wp.press({ key: 'tk-toolu_2-0' })
    expect(await wp.find({ type: 'Button', key: 'toolu_2:agent-a2' })).toBeDefined()
    expect(await wp.find({ type: 'Button', key: 'toolu_1:agent-a1' })).toBe(undefined)
    await wp.unmount()
  })

  test('each colour: in progress blinks green, pending light grey, halted red, waiting orange, completed steady green', async ($, on) => {
    const look = { ...DEFAULTS }
    expect(statusStyle('in-progress', look)).toEqual({ label: 'in progress', color: '#2e7d32', blink: true })
    expect(statusStyle('pending', look)).toEqual({ label: 'pending', color: '#cfd8dc', blink: false })
    expect(statusStyle('halted', look)).toEqual({ label: 'halted', color: '#c62828', blink: false })
    expect(statusStyle('waiting', look)).toEqual({ label: 'waiting', color: '#ef6c00', blink: false })
    expect(statusStyle('completed', look)).toEqual({ label: 'completed', color: '#2e7d32', blink: false })
    expect(statusStyle('in-progress', { ...look, statusBlink: false }).blink).toBe(false)
    const a = (status: string, extra: object = {}) => ({ status, type: 'ai-dlc:x', ...extra }) as any
    expect(workflowStatus([a('running'), a('completed')])).toBe('in-progress')
    expect(workflowStatus([a('pending'), a('completed')])).toBe('pending')
    expect(workflowStatus([])).toBe('pending')
    expect(workflowStatus([a('running'), a('failed')])).toBe('halted')
    expect(workflowStatus([a('killed')])).toBe('halted')
    expect(workflowStatus([a('completed')], ['blocked'])).toBe('halted')
    expect(workflowStatus([a('idle', { teammate: true }), a('completed')])).toBe('waiting')
    expect(workflowStatus([a('idle', { type: 'teammate' })])).toBe('waiting')
    expect(workflowStatus([a('waiting')])).toBe('waiting')
    // A teammate waits while another agent runs: the work is in progress.
    expect(workflowStatus([a('idle', { teammate: true }), a('running')])).toBe('in-progress')
    expect(workflowStatus([a('completed'), a('idle')])).toBe('completed')
  })

  test('the indicator in the pane: in progress blinks; completed steady; halted in the colour lens.json sets; pending; waiting', async ($, on) => {
    const { files } = await seed($, on, { complete: false, files: { '.ai-dlc/lens.json': JSON.stringify({ statusHaltedColor: '#ff0000', statusBlinkMs: 600 }) } })
    const wp = await chartPane($, 'vscode', false)
    expect(await statusSvgs(wp)).toEqual(['status: in progress'])
    let src = await statusSource(wp)
    expect(src).toMatch(/fill="#2e7d32"/)
    expect(src).toMatch(/<animate [^>]*dur="0\.6s"/)
    await completeAgent($, 'a1')
    expect(await statusSvgs(wp)).toEqual(['status: completed'])
    expect(await statusSource(wp)).not.toMatch(/<animate/)
    // The run is blocked: halted, red as lens.json says.
    files['docs/handoffs/R/run.md'] = RUN_R('build', 'blocked', 'blocked')
    await $.tool.call({ tool: 'Write', file_path: 'docs/handoffs/R/run.md', content: 'x', tool_use_id: 'toolu_w' })
    expect(await statusSvgs(wp)).toEqual(['status: halted'])
    src = await statusSource(wp)
    expect(src).toMatch(/fill="#ff0000"/)
    await wp.unmount()
  })

  test('the indicator: an agent that failed halts; a call not started is pending; a teammate idle waits', async ($, on) => {
    await seed($, on, { parallel: true, spawnSecond: false, teammate: true })
    const wp = await chartPane($, 'vscode', false)
    // a1 (a teammate) answered and is idle, toolu_2 not started: waiting wins over pending.
    expect(await statusSvgs(wp)).toEqual(['status: waiting'])
    expect(await statusSource(wp)).toMatch(/fill="#ef6c00"/)
    await $.turn.complete({ reason: 'error', answer: '', durationMs: 1, isAborted: false, turnId: 't', agentId: 'a1' } as any)
    expect(await statusSvgs(wp)).toEqual(['status: halted'])
    await wp.unmount()
  })

  test('pending: every spawned call not started yet; on the terminal the dot is text', async ($, on) => {
    await seed($, on, { parallel: true, spawnSecond: false })
    const wp = await chartPane($, 'vscode', false)
    // a1 completed, toolu_2 not started.
    expect(await statusSvgs(wp)).toEqual(['status: pending'])
    expect(await statusSource(wp)).toMatch(/fill="#cfd8dc"/)
    await wp.unmount()
    const term = await chartPane($, 'terminal', false)
    expect(await term.find({ type: 'Text', text: 'pending' })).toBeDefined()
    expect(await term.find({ type: 'Text', text: '●' })).toBeDefined()
    await term.unmount()
  })
})

describe('round 5: long-context pricing (requirement 6) and limits (requirement 7)', () => {
  const META = (long: object | null, override: number | null = null, extra: object = {}) =>
    JSON.stringify({
      longContextThresholdTokensOverride: override,
      models: [
        {
          id: 'claude-sonnet-5-5',
          aliases: [],
          contextWindow: 200000,
          longContextWindow: null,
          maxInputTokens: null,
          maxOutputTokens: 64000,
          pricing: { input: 3, output: 15, cacheRead: 0.3, cacheWrite5m: 3.75, cacheWrite1h: 6, batchInput: 1.5, batchOutput: 7.5 },
          longContextPricing: long,
          sources: { modelsApi: [] },
          ...extra,
        },
      ],
    })
  const LONG = { thresholdTokens: 100000, input: 6, output: 20, cacheRead: 0.6, cacheWrite5m: 7, cacheWrite1h: 12, batchInput: 3, batchOutput: 10 }
  const c = (text: string) => ({ path: '.ai-dlc/model-metadata.json', text, error: '' })
  // 50K prompt (below), 150K prompt (above).
  const below = { in: 50_000, out: 10_000, cr: 0, cw: 0 }
  const above = { in: 50_000, out: 10_000, cr: 100_000, cw: 0 }

  test('per request: below the threshold flat prices, above it long-context prices for all its tokens', () => {
    // below: 0.15 + 0.15 = 0.30; above: 0.3 + 0.2 + 0.06 = 0.56
    const r = costOfRequests(c(META(LONG)), 'claude-sonnet-5-5', [below, above])
    expect([r.text, r.long]).toEqual(['$0.8600', 1])
    // The same tokens as one total would be one request over the threshold: not what is charged.
    expect(costOfRequests(c(META(LONG)), 'claude-sonnet-5-5', [{ in: 100_000, out: 20_000, cr: 100_000, cw: 0 }]).text).toBe('$1.06')
    // Exactly at the threshold is not over it.
    expect(costOfRequests(c(META(LONG)), 'claude-sonnet-5-5', [{ in: 100_000, out: 0, cr: 0, cw: 0 }]).long).toBe(0)
  })

  test('the file override, then the lens setting, move the threshold; no threshold at all is unknown', () => {
    // File override 200K: both below.
    expect(costOfRequests(c(META(LONG, 200_000)), 'claude-sonnet-5-5', [below, above]).text).toBe('$0.6300')
    // The lens setting wins over the file: 40K, both above: 0.3+0.2 + 0.56 = 1.06.
    const r = costOfRequests(c(META(LONG, 200_000)), 'claude-sonnet-5-5', [below, above], '5m', 40_000)
    expect([r.text, r.long]).toEqual(['$1.06', 2])
    // Long-context prices but neither a threshold nor an override: —.
    expect(costOfRequests(c(META({ ...LONG, thresholdTokens: null })), 'claude-sonnet-5-5', [below]).text).toBe('—')
    // ... unless an override names one.
    expect(costOfRequests(c(META({ ...LONG, thresholdTokens: null }, 50_000)), 'claude-sonnet-5-5', [below]).text).toBe('$0.3000')
    // A model priced flat ignores every threshold.
    expect(costOfRequests(c(META(null, 10)), 'claude-sonnet-5-5', [above], '5m', 10).long).toBe(0)
    // A long-context price the file lacks, for a request over the threshold: —.
    expect(costOfRequests(c(META({ ...LONG, cacheRead: null })), 'claude-sonnet-5-5', [above]).text).toBe('—')
    // Totals only (no step seen): a model priced by prompt length cannot be costed from them.
    expect(costOfAgent(c(META(LONG)), 'claude-sonnet-5-5', [], below).text).toBe('—')
    expect(costOfAgent(c(META(null)), 'claude-sonnet-5-5', [], below).text).toBe('$0.3000')
  })

  test('the avatar panel: per-request cost, and the AI_DLC_LENS_LONG_CONTEXT_THRESHOLD_TOKENS override', async ($, on) => {
    // a1's one request: prompt 1000 + 90000 + 9000 = 100000, exactly the threshold: flat, $3.06.
    await seed($, on, { files: { '.ai-dlc/model-metadata.json': META(LONG) } })
    const ui = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await ui.press({ key: 'agent-a1' })
    await ui.unmount()
    const ag = await $.ui.mount({ ...pane('lens-027-agent'), surface: 'vscode' })
    await ag.press({ key: 'agent-usage' })
    expect(await ag.find({ type: 'Box', text: 'Cost$3.06' })).toBeDefined()
    expect(await ag.find({ type: 'Box', text: 'Long-context requests0 of 1' })).toBeDefined()
    await ag.unmount()
  })

  test('the lens setting from a settings env puts the request over the threshold', async ($, on) => {
    await seed($, on, { files: { '.ai-dlc/model-metadata.json': META(LONG), '.claude/settings.json': JSON.stringify({ env: { AI_DLC_LENS_LONG_CONTEXT_THRESHOLD_TOKENS: '99999' } }) } })
    const ui = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await ui.press({ key: 'agent-a1' })
    await ui.unmount()
    const ag = await $.ui.mount({ ...pane('lens-027-agent'), surface: 'vscode' })
    await ag.press({ key: 'agent-usage' })
    // 1000*6 + 200000*20 + 90000*0.6 + 9000*7 = 4,123,000 / 1M
    expect(await ag.find({ type: 'Box', text: 'Cost$4.12' })).toBeDefined()
    expect(await ag.find({ type: 'Box', text: 'Long-context requests1 of 1' })).toBeDefined()
    await ag.unmount()
  })

  test('null limits stay hidden; a max input the Models API filled is shown', () => {
    expect(limitRows(c(META(LONG)), 'claude-sonnet-5-5')).toEqual([['Max output', '64K']])
    const api = META(LONG, null, { maxInputTokens: 180000, sources: { modelsApi: ['maxInputTokens'] } })
    expect(limitRows(c(api), 'claude-sonnet-5-5')).toEqual([
      ['Max input', '180K'],
      ['Max output', '64K'],
    ])
    expect(lookupModel(JSON.parse(META(LONG)), 'claude-sonnet-5-5')?.long).toEqual({ threshold: 100000, input: 6, output: 20, cacheRead: 0.6, cacheWrite5m: 7, cacheWrite1h: 12 })
  })
})

// ---------------- round 6 (step 17.l5) ----------------
describe('round 6: pane controls (A1, A3, A4, A9)', () => {
  test('A1: minimise sits just left of close on the first row; minimised, one line with the dot and the title; restore', async ($, on) => {
    const { closed } = await seed($, on, { complete: false })
    const wp = await chartPane($, 'vscode', false)
    const keys = (await wp.findAll({ type: 'Button' })).map((b: any) => String(b.key))
    // The first two Buttons drawn: minimise, then close.
    expect(keys.slice(0, 2)).toEqual(['pane-min', 'pane-close'])
    await wp.press({ key: 'pane-min' })
    expect(await wp.find({ type: 'Button', key: 'wf-toolu_1' })).toBe(undefined)
    expect(await chartSvg(wp)).toBe(undefined)
    expect(await statusSvgs(wp)).toEqual(['status: in progress'])
    expect(await wp.find({ type: 'Text', text: 'R — the lens spike' })).toBe(undefined)
    expect((await wp.find({ type: 'Button', key: 'pane-min' }))?.text).toBe('□')
    await wp.press({ key: 'pane-min' })
    expect(await wp.find({ type: 'Button', key: 'wf-toolu_1' })).toBeDefined()
    await wp.press({ key: 'pane-close' })
    expect(closed).toContain(CHART_PANE)
    await wp.unmount()
  })

  test('A3, A4: the avatar and arrow panes have a close Button and open with Esc closing them', async ($, on) => {
    const { closed, openArgs } = await seed($, on)
    const wp = await chartPane($)
    await wp.press({ key: 'agent-a1' })
    await wp.press({ key: 'edge-a1' })
    await wp.unmount()
    for (const id of ['lens-027-agent', 'lens-027-edge']) {
      const args = openArgs.filter((x: any) => x.id === id).at(-1)
      expect([args?.closeOnEscape, args?.focus]).toEqual([true, true])
      const ui = await $.ui.mount({ ...pane(id), surface: 'vscode' })
      const close: any = await ui.find({ type: 'Button', key: 'pane-close' })
      expect(close?.text ?? close?.props?.label).toBe('×')
      await ui.press({ key: 'pane-close' })
      expect(closed).toContain(id)
      await ui.unmount()
    }
    // The workflow pane's own open: Esc closes it too; the unasked open never takes the keyboard.
    const auto = openArgs.find((x: any) => x.id === CHART_PANE)
    expect([auto?.closeOnEscape, auto?.focus]).toEqual([true, undefined])
  })

  test('A9: no filler at the bottom edge on either placement', async ($, on) => {
    await seed($, on)
    for (const placement of ['inline', 'dock'] as const) {
      const ui = await $.ui.mount({ ...pane(CHART_PANE, placement), surface: 'vscode' })
      await openPanels(ui)
      const bs = await boxes(ui)
      expect(bs.some(b => b.minHeight !== undefined)).toBe(false)
      const outer: any = bs[0]
      for (const k of ['margin', 'marginBottom', 'padding', 'paddingBottom']) expect(outer?.[k] ?? 0).toBe(0)
      await ui.unmount()
    }
  })
})

describe('round 6: tasks as panels, same-task workflows (A2, A8)', () => {
  test('A2: one workflow and one task still each get a collapsed panel; "Open flowchart" opens the pane without expanding (18.4-1)', async ($, on) => {
    const { opened } = await seed($, on)
    const card = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT))
    opened.length = 0
    await card.press({ key: 'card-open-chart' })
    expect(opened).toContain(CHART_PANE)
    await card.unmount()
    const wp = await chartPane($, 'vscode', false)
    expect((await wp.find({ type: 'Button', key: 'wf-toolu_1' }))?.text).toBe('[+]')
    expect(await wp.find({ type: 'Button', key: 'tk-toolu_1-0' })).toBe(undefined)
    await wp.press({ key: 'wf-toolu_1' })
    expect((await wp.find({ type: 'Button', key: 'tk-toolu_1-0' }))?.text).toBe('[+]')
    expect(await chartSvg(wp)).toBe(undefined)
    await wp.press({ key: 'tk-toolu_1-0' })
    expect(await chartSvg(wp)).toBeDefined()
    // The workflow's dot and the task's dot.
    expect((await statusSvgs(wp)).length).toBe(2)
    await wp.unmount()
  })

  test('A8: a spawn for the same run after every agent finished updates the existing workflow; another task gets a new one', async ($, on) => {
    await seed($, on, { files: { 'docs/handoffs/R/run.md': RUN_R('build the lens') } })
    const brief = 'Your handoff record is docs/handoffs/R/18-orchestrator-to-sqa-engineer.handoff.md (root x).\nTest it.'
    await $.turn.start({ text: 'and test it', turnId: 'm2' })
    await $.tool.call({ tool: 'Agent', subagent_type: 'ai-dlc:sqa-engineer', description: 'later', prompt: brief, tool_use_id: 'toolu_2' })
    await $.agent.spawn({ tool_use_id: 'toolu_2', prompt: brief, description: 'later', subagentType: 'ai-dlc:sqa-engineer', provider: { plugin: 'ai-dlc', tier: 'user' }, parentModel: 'claude-opus-5-5', background: true, fork: false })
    let wp = await chartPane($, 'vscode', false)
    const panels = async () => (await wp.findAll({ type: 'Button' })).filter((b: any) => /^wf-toolu/.test(String(b.key))).map((b: any) => b.key)
    expect(await panels()).toEqual(['wf-toolu_1'])
    await openPanels(wp)
    expect(await wp.find({ type: 'Text', text: /^Scott Hanselman spawned 2 agents$/ })).toBeDefined()
    await wp.unmount()
    // A different task (no record, a new request) after all finished: a new workflow.
    await completeAgent($, 'a2')
    await $.turn.start({ text: 'Something else', turnId: 'm3' })
    await $.tool.call({ tool: 'Agent', subagent_type: 'ai-dlc:sqa-engineer', description: 'other', prompt: 'plain brief', tool_use_id: 'toolu_3' })
    wp = await chartPane($, 'vscode', false)
    expect(await panels()).toEqual(['wf-toolu_3', 'wf-toolu_1'])
    await wp.unmount()
  })

  test('taskKeyOf, joinWorkflow keys and workflowTasks', () => {
    expect(taskKeyOf('Your handoff record is docs/handoffs/R/17-a-to-b.handoff.md', 'x')).toBe('run:docs/handoffs/R')
    expect(taskKeyOf('no record', ' Ship it ')).toBe('req:Ship it')
    expect(taskKeyOf('no record', '')).toBe('')
    const done = { a1: { id: 'a1', toolUseId: 'c1', status: 'completed' } as any }
    let wf = joinWorkflow(WF0, 'main', 'c1', {}, {}, { c1: 'run:R' })
    wf = joinWorkflow(wf, 'main', 'c2', done, { c1: 'a1' }, { c1: 'run:R', c2: 'run:R' })
    expect(wf.of['c2']).toBe('c1')
    const done2 = { ...done, a2: { id: 'a2', toolUseId: 'c2', status: 'completed' } as any }
    wf = joinWorkflow(wf, 'main', 'c3', done2, { c1: 'a1', c2: 'a2' }, { c1: 'run:R', c2: 'run:R', c3: 'run:S' })
    expect(wf.order).toEqual(['c1', 'c3'])
    const runs = { 'docs/handoffs/R': parseRun(RUN_R('build'))! }
    const ag = (id: string, handoff: string | null) => ({ id, handoff, prompt: '', status: 'running', type: 't' }) as any
    expect(workflowTasks([ag('a1', 'docs/handoffs/R/17-o-to-x.handoff.md'), ag('a2', null), ag('a3', 'docs/handoffs/R/16-o-to-y.handoff.md')], runs, 'REQ')).toEqual([
      { title: 'build', ids: ['a1'] },
      { title: 'REQ', ids: ['a2'] },
      { title: 'research', ids: ['a3'] },
    ])
  })
})

describe('round 6: status (A5, A6, 18.2)', () => {
  test('A5: running and waiting at once: both colours, the in-progress half blinking; the words say both', async ($, on) => {
    const look = { ...DEFAULTS }
    expect(statusLooks('in-progress', true, look)).toEqual({ label: 'in progress, waiting', colors: ['#2e7d32', '#ef6c00'], blink: true })
    expect(statusLooks('in-progress', false, look).colors).toEqual(['#2e7d32'])
    const svg = statusDotSvg(['#2e7d32', '#ef6c00'], true, 1000)
    expect((svg.match(/<path /g) ?? []).length).toBe(2)
    expect(svg).toMatch(/fill="#2e7d32"><animate /)
    expect(svg).toMatch(/fill="#ef6c00"\/>/)
    const a = (status: string, extra: object = {}) => ({ status, type: 'x', ...extra }) as any
    expect(runningAndWaiting([a('running'), a('waiting')])).toBe(true)
    expect(runningAndWaiting([a('running'), a('idle', { teammate: true })])).toBe(true)
    expect(runningAndWaiting([a('running'), a('idle')])).toBe(false)
    // The spawner never counts (18.3-4): main running while its only agent waits is "waiting".
    expect(runningAndWaiting([a('running', { id: 'main' }), a('waiting')], 'main')).toBe(false)
    expect(workflowStatus([a('running', { id: 'main' }), a('waiting')], [], 'main')).toBe('waiting')
    // In the pane: a1 a teammate idle (waiting), a2 running.
    await seed($, on, { parallel: true, teammate: true })
    const wp = await chartPane($, 'vscode', false)
    expect(await statusSvgs(wp)).toEqual(['status: in progress, waiting'])
    const src = await statusSource(wp)
    expect(src).toMatch(/fill="#2e7d32"><animate/)
    expect(src).toMatch(/fill="#ef6c00"/)
    await wp.unmount()
    const term = await chartPane($, 'terminal', false)
    expect(await term.find({ type: 'Text', text: 'in progress, waiting' })).toBeDefined()
    await term.unmount()
  })

  test('A6, 18.2: an ordinary subagent the list says is waiting shows the orange "waiting" dot in the pane', async ($, on) => {
    await seed($, on, { complete: false, listStatus: 'waiting' })
    let wp = await chartPane($)
    // Any list read (the 2 s poll while agents work; here also an avatar press) brings the held status in.
    await wp.press({ key: 'agent-a1' })
    await wp.unmount()
    wp = await chartPane($, 'vscode', false)
    // The workflow's dot and its task's (opened above): both orange "waiting".
    expect(await statusSvgs(wp)).toEqual(['status: waiting', 'status: waiting'])
    expect(await statusSource(wp)).toMatch(/fill="#ef6c00"/)
    await wp.unmount()
  })
})

describe('round 6: notices (A7)', () => {
  test('a notice is never the title: an exclamation icon whose hover card and press show it', async ($, on) => {
    await seed($, on, { request: 'Ship the lens', parallel: true })
    await $.turn.start({ text: '<task-notification><task-id>a1</task-id><summary>Agent "build" completed</summary></task-notification>', turnId: 'm2' })
    const wp = await chartPane($, 'vscode', false)
    expect(await wp.find({ type: 'Text', text: /task-notification/ })).toBe(undefined)
    expect(await wp.find({ type: 'Text', text: 'Ship the lens' })).toBeDefined()
    // The icon sits on the workflow's header (the newest workflow: an id as short as a1 is not matched by name).
    expect(await wp.find({ type: 'Button', key: 'nt-toolu_1' })).toBeDefined()
    // The hover card: hidden, revealed by hover, placed absolutely, holding the notice.
    // The harness keeps `hover` beside `props` on the child of the keyed Box (the hover scope).
    const scope: any = await wp.find({ type: 'Box', key: 'nb-toolu_1' })
    const tip = (scope?.children ?? []).find((c: any) => c.type === 'Box' && c.props?.display === 'none' && c.props?.position === 'absolute' && c.hover?.display === 'flex')
    expect(tip).toBeDefined()
    expect(await wp.find({ type: 'Text', text: /Agent "build" completed/ })).toBeDefined()
    // The click fallback: the notice listed under the header.
    await wp.press({ key: 'nt-toolu_1' })
    expect(await wp.find({ type: 'Text', text: /^! .*Agent "build" completed/ })).toBeDefined()
    await wp.unmount()
    const card = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT))
    expect(await card.find({ type: 'Text', text: /task-notification/ })).toBe(undefined)
    await card.unmount()
  })

  test('isNotice, isHumanRequest (18.3-7), isPersonOrigin, noticeWorkflow', () => {
    expect(isNotice('<task-notification>x</task-notification>')).toBe(true)
    expect(isNotice('<system-reminder>x</system-reminder>')).toBe(true)
    expect(isNotice('[auto-handoff] Handoff from session')).toBe(true)
    expect(isHumanRequest('<div>pasted html</div> fix this')).toBe(true)
    expect(isHumanRequest('<task-notification>x')).toBe(false)
    expect(isPersonOrigin('composer')).toBe(true)
    expect(isPersonOrigin('task-notification')).toBe(false)
    expect(isPersonOrigin('scheduled-trigger')).toBe(false)
    const wf = { of: { c1: 'c1', c2: 'c2' }, by: {}, parent: {}, order: ['c1', 'c2'] }
    const agents = { abcdef12: { id: 'abcdef12', toolUseId: 'c1' } as any }
    expect(noticeWorkflow('task abcdef12 done', wf, agents)).toBe('c1')
    expect(noticeWorkflow('something', wf, agents)).toBe('c2')
    expect(noticeWorkflow('something', WF0, {})).toBe('')
  })
})

describe('round 6: review findings (18.3, 18.4)', () => {
  test('18.3-1: only the initials take the central baseline; the label lines keep theirs', () => {
    const agents = { main: { id: 'main', parent: null, status: 'running', loop: false, handoff: null } as any }
    const src = flowchartSvg(['main'], agents, () => ({ name: 'Kent Beck', model: 'sonnet', role: 'SQA Engineer' })).source
    expect((src.match(/dominant-baseline/g) ?? []).length).toBe(1)
    expect(src).toMatch(/dominant-baseline="central"[^>]*>KB</)
  })

  test('18.3-3: parseRun reads only the stages table, never the gates or clarifications tables', () => {
    const text =
      RUN_R('build') +
      '\n## Gates and loops\n| Gate or loop | Approver |\n|---|---|\n| 17 | human, in-progress |\n\n## Open clarifications\n| # | Question | Status |\n|---|---|---|\n| 1 | why? | in-progress |\n| 16 | overwrite? | open |\n'
    expect(parseRun(text)).toEqual({ title: 'R — the lens spike', status: 'active', stage: 'build', stages: { '16': 'research', '17': 'build' } })
    // A table under a "Stages" heading whose header has no Stage column still counts.
    expect(parseRun('# Run: Q\n\n## Stages\n| Step | Name |\n|---|---|\n| 3 | design |\n')!.stages).toEqual({ '3': 'design' })
  })

  test('18.3-8: thresholdOverrideOf reads longContextThresholdTokensOverride only', () => {
    expect(thresholdOverrideOf({ longContextThresholdTokensOverride: 150000 })).toBe(150000)
    expect(thresholdOverrideOf({ thresholdOverride: 150000 })).toBe(null)
    expect(thresholdOverrideOf({ longContextThresholdTokensOverride: null })).toBe(null)
  })

  test('18.4-2: a long-context cost is — (partial) when the requests seen do not add up; a flat one stays exact', () => {
    const meta = JSON.stringify({
      longContextThresholdTokensOverride: null,
      models: [
        { id: 'long', pricing: { input: 3, output: 15, cacheRead: 0.3, cacheWrite5m: 3.75 }, longContextPricing: { thresholdTokens: 100, input: 6, output: 20, cacheRead: 0.6, cacheWrite5m: 7 } },
        { id: 'flat', pricing: { input: 3, output: 15, cacheRead: 0.3, cacheWrite5m: 3.75 }, longContextPricing: null },
      ],
    })
    const c = { path: 'm.json', text: meta, error: '' }
    const r1 = { in: 50, out: 10, cr: 0, cw: 0 }
    const r2 = { in: 200, out: 10, cr: 0, cw: 0 }
    const total = { in: 250, out: 20, cr: 0, cw: 0 }
    const all = costOfAgent(c, 'long', [r1, r2], total)
    expect([all.partial, all.long]).toEqual([false, 1])
    // One request missed: the seen ones would undercount, so —, partial.
    const missed = costOfAgent(c, 'long', [r2], total)
    expect([missed.text, missed.partial]).toEqual(['—', true])
    // A flat model is costed from the totals, exact either way.
    expect(costOfAgent(c, 'flat', [r2], total).text).toBe(costOf(c, 'flat', total).text)
  })

  test('18.4-3: the module keeps at most REQS_CAP requests per agent; past the cap a long-context cost is partial', async ($, on) => {
    const meta = JSON.stringify({
      longContextThresholdTokensOverride: null,
      models: [{ id: 'claude-sonnet-5-5', pricing: { input: 3, output: 15, cacheRead: 0.3, cacheWrite5m: 3.75 }, longContextPricing: { thresholdTokens: 100000, input: 6, output: 20, cacheRead: 0.6, cacheWrite5m: 7 } }],
    })
    await seed($, on, { complete: false, files: { '.ai-dlc/model-metadata.json': meta } })
    for (let i = 0; i < REQS_CAP; i++)
      for await (const _ of $.turn.step({ turnId: 't', index: 0, model: 'claude-sonnet-5-5', messageCount: 1, agentId: 'a1' })) {
        // drain
      }
    const ui = await $.ui.mount({ ...pane('lens-027'), surface: 'vscode' })
    await ui.press({ key: 'agent-a1' })
    await ui.unmount()
    const ag = await $.ui.mount({ ...pane('lens-027-agent'), surface: 'vscode' })
    await ag.press({ key: 'agent-usage' })
    // REQS_CAP + 1 steps seen, REQS_CAP kept: the kept ones do not add up to the totals.
    expect(await ag.find({ type: 'Box', text: /^Cost— \(partial/ })).toBeDefined()
    expect(await ag.find({ type: 'Text', text: 'Long-context requests' })).toBe(undefined)
    await ag.unmount()
  })
})
