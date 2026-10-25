import { describe, expect, mock, test } from 'claude-code/testing'
import {
  addToBatch,
  costOf,
  ensureIn,
  fmtClock,
  fmtModel,
  joinWorkflow,
  runIdOf,
  unifyRuns,
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
  uniqueTasks,
  commonAncestor,
  workflowBatch,
  batchView,
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
  keepaliveLine,
  fmtSpan,
  keptWarm,
  noteKeepalive,
  savingsOfAgent,
  sessionSavings,
  KEEPALIVE_CYCLES_KEPT,
  VIEW0,
  bandEverywhere,
  layoutOf,
  openModeOf,
  openSizeOf,
  placeOf,
  selectedOf,
  viewResize,
  viewRestore,
  restingSpawner,
  callRunIds,
  personaOf,
  drawOr,
  folderDateOf,
  newestFirst,
  paneFault,
  runStartOf,
  PARENT_DEPTH,
  runRoots,
  workflowRunOf,
  mergedHomeOf,
  layout,
  SIZE0,
  parseRecordName,
  parentCode,
  compareCodes,
  stepTrees,
  stepCharts,
  stepsDescending,
  runVersions,
  pickRunState,
  isRunStateFile,
  RUN_VERSION,
  shiftCode,
  NO_STEP,
  NOT_FOUND,
  OPEN,
  renamesFromFeatures,
  renameCode,
  isRenameSource,
  codeMapOf,
  composeCodeMaps,
  locateRecord,
  stepTitle,
  cardCharts,
  spawnPlace,
} from '../hooks/lens'
import type { StepChart, StepSource } from '../hooks/lens'
import { CHECKS, anomaliesOf, anomalyLine, gateUndecided, applySettings, blockedSteps, colorOf, detectAgents, detectRun, diffAnomalies, handbackFailed, handoffsRoot, runsToRead, trackWaiting, worstOf } from '../hooks/anomaly'
import type { LensAgent } from '../types'
import { DEFAULTS, agentEnvName, agentKeyParts, envLevel, envName, fileLevel, initialFile, resolve, resolveAgent, schema, setKey } from '../hooks/settings'
import {
  ROBOT_DESIGNS,
  ROBOT_TABLE,
  SVG_CAP,
  avatarKey,
  avatarSvg,
  checkBytes,
  classify,
  decodedBytes,
  fnv1a,
  isInside,
  own,
  robotId,
  robotOf,
  sniffType,
  trustedFolders,
} from '../hooks/avatar'

const PLUGIN = 'ai-dlc-lens'
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

// ---------------- round-0 kit (/ai-dlc:lens-kit) ----------------

/** The longest in-lens tests (the real 217-file folder, 42-agent charts): a time limit with room on a loaded machine. */
const HEAVY = { timeoutMs: 20000 }

describe('kit', () => {
  test('K1: dock draws flowchart, inline draws compact', async ($, on) => {
    on('command.register', () => ({ value: { command: 'x' } }))
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    for (const surface of SURFACES) {
      const dock = await $.ui.mount({ ...pane('ai-dlc-lens-kit', 'dock', 120), surface })
      expect(await dock.find({ type: 'Text', text: /^FLOWCHART/ })).toBeDefined()
      await dock.unmount()
      const inline = await $.ui.mount({ ...pane('ai-dlc-lens-kit', 'inline', 60), surface })
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
      const ui = await $.ui.mount({ ...pane('ai-dlc-lens-kit'), surface })
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
  /** Avatars: what `$.fs.stat` answers per path (absent: the path does not exist), and the engine env (HOME). */
  stat?: Record<string, { kind: 'file' | 'dir' | 'other'; size: number; realPath?: string }>
  env?: Record<string, string>
  /** Avatars: files read as bytes, path -> base64. */
  bytes?: Record<string, string>
  /** Step 1.6.1: what `$.fs.list` gives per folder (matched by tail); absent: the two R/17 records for every folder. */
  list?: Record<string, string[]>
  /** Addendum A6: the default panelOpenMode (drill-in). Unset, seed puts `panelOpenMode: "tab"` in lens.json, the mode the older panel tests were written for. */
  defaultOpenMode?: boolean
  /** What the engine's `clock.every` dispatch answers (default: at once); a pending promise holds the period open. */
  clockEvery?: (e: { ms: number }) => unknown
  /** Step 29.1: the modification time every `$.fs.list` entry gets (default: a counter that grows per listing). */
  listMtime?: number
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
  if (opts.defaultOpenMode !== true) {
    const lj = files['.ai-dlc/lens.json']
    let o: Record<string, unknown> | null = null
    try {
      o = lj === undefined || lj === null ? {} : (JSON.parse(lj) as Record<string, unknown>)
    } catch {
      o = null
    }
    if (o !== null && typeof o === 'object' && !Array.isArray(o) && !('panelOpenMode' in o)) files['.ai-dlc/lens.json'] = JSON.stringify({ ...o, panelOpenMode: 'tab' })
  }
  const bytes: Record<string, string> = opts.bytes ?? {}
  const stats = opts.stat ?? {}
  const statted: string[] = []
  const tail = (path: string, keys: string[]) => keys.find(k => path === k || path.endsWith('/' + k) || path.endsWith(k))
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
  // Step 1.4: the module registers no command (the /ai-dlc:lens* skills name them), so no command.register stub.
  on('clock.every', (_: unknown, e: any) => (opts.clockEvery !== undefined ? opts.clockEvery(e) : { value: undefined }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('session.end', (_: unknown, e: any) => ({ sessionId: e.sessionId }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 10 }, rateLimits: [] } }))
  on('settings.read', () => ({ value: { agent: 'ai-dlc:orchestrator' } }))
  on('fs.exists', () => ({ value: false }))
  if (opts.env !== undefined) mock.env(on as never, opts.env)
  on('fs.stat', (_: unknown, e: any) => {
    const path = String(e.path ?? e).replace(/\\/g, '/')
    statted.push(path)
    const hit = tail(path, Object.keys(stats))
    if (hit === undefined) throw new Error(`ENOENT ${path}`)
    const st = stats[hit]!
    return { value: { kind: st.kind, size: st.size, mtimeMs: 1, isLink: st.realPath !== undefined && st.realPath !== hit, ...(st.realPath !== undefined ? { realPath: st.realPath } : {}) } }
  })
  on('fs.read', (_: unknown, e: any) => {
    // The engine hands the path resolved against the working directory: match by the relative tail.
    const path = String(e.path ?? e).replace(/\\/g, '/')
    const asBytes = tail(path, Object.keys(bytes))
    if (asBytes !== undefined) return { value: { base64: bytes[asBytes] } }
    const hit = Object.keys(files).find(k => (k.startsWith('/') ? path.endsWith(k) : path === k || path.endsWith('/' + k)))
    const text = hit === undefined ? undefined : files[hit]
    if (text === undefined || text === null) throw new Error(`ENOENT ${path}`)
    return { value: text }
  })
  on('fs.write', (_: unknown, e: any) => {
    const rel = String(e.path).replace(/\\/g, '/').replace(/^.*\/(\.ai-dlc\/)/, '$1')
    writes.push({ path: rel, text: e.text })
    files[rel] = e.text
    return { value: undefined }
  })
  // Step 1.6.1: each listing has a new time, so the detector's record cache re-reads a file a test changed.
  let listed = 1
  const lists = opts.list
  on('fs.list', (_: unknown, e: any) => {
    listed = opts.listMtime ?? listed + 1
    if (lists === undefined) return { value: [{ name: '17-orchestrator-to-agent-manager.handoff.md', kind: 'file', size: 1, mtimeMs: listed }, { name: '17-agent-manager-to-orchestrator.handback.md', kind: 'file', size: 1, mtimeMs: listed }] }
    const dir = String(e?.path ?? e).replace(/\\/g, '/').replace(/\/$/, '')
    const hit = Object.keys(lists).find(k => dir === k || dir.endsWith('/' + k))
    // Step 1.6.1.l1: a name ending in `/` is a folder (the anomalyRunScope all scan).
    return {
      value: (hit === undefined ? [] : lists[hit]!).map(name =>
        name.endsWith('/') ? { name: name.slice(0, -1), kind: 'dir', mtimeMs: listed } : { name, kind: 'file', size: (files[`${hit}/${name}`] ?? '').length, mtimeMs: listed },
      ),
    }
  })
  const toasts: string[] = []
  on('ui.toast', (_: unknown, e: any) => {
    toasts.push(String(e?.text ?? e))
    return { value: undefined }
  })
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
    agentId: 'a' + (/^toolu_(\d+)$/.exec(String(e.tool_use_id))?.[1] ?? '1'),
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
  on('classic.Stop', () => ({}))

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
  return { opened, nativeInputs, writes, files, openArgs, closed, statted, toasts }
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

/**
 * The flowchart's Svg (round 5: the status indicator is an Svg too, so the chart is found by its alt).
 * `Flowchart` is the /ai-dlc:lens pane's session chart. Step 30.1: the workflow view draws one chart per
 * top-level step of a run, `Step chart <key>: <run>` (full screen: `Full screen chart <key>: <run>`), newest
 * first; `chartSvg` is the first chart drawn, `svgSource` every chart's source, one after the other.
 */
const CHART_ALT = /^(Flowchart|Step chart|Full screen chart)/
const chartSvgs = async (ui: any): Promise<any[]> => ((await ui.findAll({ type: 'Svg' })) as any[]).filter((x: any) => CHART_ALT.test(String(x?.props?.alt ?? x?.alt ?? '')))
const chartSvg = async (ui: any): Promise<any> => (await chartSvgs(ui))[0]
const svgSource = async (ui: any): Promise<string> => (await chartSvgs(ui)).map((svg: any) => String(svg?.props?.source ?? svg?.source ?? '')).join('')
/** Step 30.1: the keys of the step charts drawn, in order (`Step chart <key>: …`, `Full screen chart <key>: …`). */
const stepKeys = async (ui: any): Promise<string[]> =>
  (await chartSvgs(ui)).map((x: any) => /^(?:Step|Full screen) chart (\S+):/.exec(String(x?.props?.alt ?? ''))?.[1] ?? '').filter(k => k !== '')
/** Step 30.1: the step chart of `key`, its Svg source ('' when it is not drawn). */
const stepSource = async (ui: any, key: string): Promise<string> =>
  String((await chartSvgs(ui)).find((x: any) => [`Step chart ${key}:`, `Full screen chart ${key}:`].some(p => String(x?.props?.alt ?? '').startsWith(p)))?.props?.source ?? '')
const SE_INPUT = { subagent_type: 'ai-dlc:software-engineer', description: 'build', prompt: 'p' }

// ---------------- the chat card ----------------
const CHART_PANE = 'ai-dlc-lens-chart'
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
  test('C1 (round 4, step 8.1.5): the card line, "Open flowchart", and the chart in the card (chartInChat); the pane draws persona, model and role', async ($, on) => {
    const { opened } = await seed($, on)
    // The workflow pane opened by itself on the first spawn.
    expect(opened).toContain(CHART_PANE)
    for (const surface of SURFACES) {
      const ui = await $.ui.mount(toolRow('toolu_1', surface, SE_INPUT))
      const all = await ui.findAll({})
      expect(all.findIndex((x: any) => x.type === 'Text' && /^Workflow: Scott Hanselman spawned 1 agent - DF completed\s*$/.test(String(x.text)))).toBeGreaterThan(-1)
      expect(all.findIndex((x: any) => x.text === 'NATIVE ROW')).toBe(all.length - 1)
      // Step 1.5: the first spawn's card draws the workflow's chart (an Svg, or the text chart on the terminal) and its Buttons.
      const cardChart = ((await ui.findAll({ type: 'Svg' })) as any[]).find((x: any) => /^Chat chart/.test(String(x?.props?.alt ?? '')))
      if (surface === 'vscode') expect(String(cardChart?.props?.source ?? '').includes('>David Fowler<')).toBe(true)
      else expect(await ui.find({ type: 'Text', text: /-> .*David Fowler/ })).toBeDefined()
      expect(await ui.find({ type: 'Button', key: 'card-open-chart' })).toBeDefined()
      expect(await ui.find({ type: 'Button', key: 'card:agent-a1' })).toBeDefined()
      expect(await ui.find({ type: 'Button', key: 'agent-a1' })).toBe(undefined)
      await ui.unmount()
      const wp = await chartPane($, surface)
      if (surface === 'vscode') {
        const src = await svgSource(wp)
        // Step 30.1: the step chart's root is step 17 itself, drawn as the orchestrator; each node's model line starts with its step code.
        for (const line of ['>Scott Hanselman<', '>17 · opus<', '>Orchestrator<', '>David Fowler<', '>17 · sonnet<', '>Software Engineer<']) expect(src.includes(line)).toBe(true)
        // The robot-avatar addendum: each agent is its type's robot, not its initials.
        for (const t of ['ai-dlc:orchestrator', 'ai-dlc:software-engineer']) expect(src.includes(`class="${robotId(robotOf(avatarKey(t)))}"`)).toBe(true)
        for (const gone of ['>DF<', '>SH<']) expect(src.includes(gone)).toBe(false)
        for (const gone of ['ctx', 'cache', 'in 1', 'out 2', 'software-engineer<']) expect(src.includes(gone)).toBe(false)
        const svg: any = await chartSvg(wp)
        expect(Number(svg?.props?.width ?? svg?.width)).toBe(120)
      } else {
        expect(await chartSvg(wp)).toBe(undefined)
        expect(await wp.find({ type: 'Text', text: /-> .*David Fowler/ })).toBeDefined()
        expect(await wp.find({ type: 'Text', text: /^\s+17 · sonnet, Software Engineer$/ })).toBeDefined()
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
    for (const s of ['>Kent Beck<', '>SQA Engineer<', '>David Fowler<']) expect(src.includes(s)).toBe(true)
    expect(src.includes(`class="${robotId(robotOf('sqa-engineer'))}"`)).toBe(true)
    // Step 30.1: a1's brief names step 17, a2's names no record: two charts, the newest spawn's on top. The
    // one with no step hangs a2 under the orchestrator; step 17's root is the step itself, a1 under it.
    expect(await stepKeys(wp)).toEqual(['17', 'no-step'])
    const cys = [...src.matchAll(/<circle cx="(\d+)" cy="(\d+)"/g)].map(m => [Number(m[1]), Number(m[2])])
    expect(cys.length).toBe(4)
    expect(cys[0]![1]!).toBeLessThan(cys[1]![1]!)
    expect(cys[2]![1]!).toBeLessThan(cys[3]![1]!)
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
    expect(opened).toContain('ai-dlc-lens-agent')
    expect((((await svgSource(wp)).match(/<animate /g)) ?? []).length).toBe(0)
    await wp.unmount()
  })

  test('C4 (1b, step 8.1.5): any width: the chip and "Open flowchart"; the chart only where the row is wide enough (chartMode auto)', async ($, on) => {
    const { opened } = await seed($, on, { parallel: true })
    for (const cols of [20, 200]) {
      const card = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT, 'Agent', cols))
      const svgs = ((await card.findAll({ type: 'Svg' })) as any[]).filter((x: any) => /^Chat chart/.test(String(x?.props?.alt ?? '')))
      expect(svgs.length).toBe(cols === 20 ? 0 : 1)
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

  test('C7 (step 8.1.5): drill-in chosen in the lens pane applies to the workflow pane too; "Panel Type: Tab" opens the separate panes again', async ($, on) => {
    const { opened } = await seed($, on)
    const pane0 = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    await pane0.press({ key: 'mode-drill' })
    await pane0.unmount()
    opened.length = 0
    const wp = await chartPane($)
    expect((await wp.find({ type: 'Button', key: 'panel-drill-in' }))?.text).toBe('◉ Drill in')
    await wp.press({ key: 'agent-a1' })
    expect(opened).not.toContain('ai-dlc-lens-agent')
    expect(await wp.find({ type: 'Button', key: 'drill-back' })).toBeDefined()
    expect(await wp.find({ type: 'Button', key: 'agent-view' })).toBeDefined()
    await wp.press({ key: 'drill-back' })
    await openPanels(wp)
    await wp.press({ key: 'panel-tab' })
    await wp.press({ key: 'edge-a1' })
    await wp.press({ key: 'agent-a1' })
    expect(opened).toContain('ai-dlc-lens-edge')
    expect(opened).toContain('ai-dlc-lens-agent')
    await wp.unmount()
  })
})

describe('panels', () => {
  test('2: no handoff record: the arrow panel has the prompt, collapsed, whole when opened', async ($, on) => {
    await seed($, on, { parallel: true })
    const wp = await chartPane($)
    await wp.press({ key: 'edge-a2' })
    await wp.unmount()
    const edge = await $.ui.mount({ ...pane('ai-dlc-lens-edge'), surface: 'vscode' })
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
    const edge = await $.ui.mount({ ...pane('ai-dlc-lens-edge'), surface: 'vscode' })
    await edge.press({ key: 'edge-prompt' })
    expect(await edge.find({ type: 'Text', text: 'SQA PROMPT: test the change.' })).toBeDefined()
    await edge.unmount()
  })

  test('L4: a matched record: record and hand-back, collapsed until opened; no match label', async ($, on) => {
    await seed($, on)
    const ui = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    await ui.press({ key: 'edge-a1' })
    await ui.unmount()
    const edge = await $.ui.mount({ ...pane('ai-dlc-lens-edge'), surface: 'vscode' })
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
    const ui = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    await ui.press({ key: 'agent-a1' })
    await ui.unmount()
    const ag = await $.ui.mount({ ...pane('ai-dlc-lens-agent'), surface: 'vscode' })
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
    const ui = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    await ui.press({ key: 'agent-a1' })
    await ui.unmount()
    const ag = await $.ui.mount({ ...pane('ai-dlc-lens-agent'), surface: 'vscode' })
    await ag.press({ key: 'agent-usage' })
    // 0.003 + 3.2 + 0.027 + 0.03375: the metadata file's output price, not the older file's
    expect(await ag.find({ type: 'Text', text: '$3.26' })).toBeDefined()
    expect(await ag.find({ type: 'Text', text: /model-(metadata|costing)\.json/ })).toBe(undefined)
    await ag.unmount()
  })

  test('4: no metadata file: cost and a subagent window on another model show —', async ($, on) => {
    await seed($, on)
    const ui = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    await ui.press({ key: 'agent-a1' })
    await ui.unmount()
    const ag = await $.ui.mount({ ...pane('ai-dlc-lens-agent'), surface: 'vscode' })
    await ag.press({ key: 'agent-usage' })
    expect(await ag.find({ type: 'Text', text: '300K / —' })).toBeDefined()
    const costRow: any = (await ag.findAll({})).find((x: any) => x.type === 'Box' && String(x.text) === 'Cost—')
    expect(costRow).toBeDefined()
    await ag.unmount()
  })

  test('L4 fallback: drill-in shows the panel inside the lens pane with a Back button', async ($, on) => {
    const { opened } = await seed($, on)
    opened.length = 0
    const ui = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    await ui.press({ key: 'mode-drill' })
    await ui.press({ key: 'edge-a1' })
    expect(opened).not.toContain('ai-dlc-lens-edge')
    expect(await ui.find({ type: 'Button', key: 'drill-back' })).toBeDefined()
    await ui.press({ key: 'drill-back' })
    expect(await ui.find({ type: 'Button', key: 'edge-a1' })).toBeDefined()
    await ui.unmount()
  })

  test('L6: a SendMessage to an agent draws a two-way arrow', async ($, on) => {
    await seed($, on)
    await $.tool.call({ tool: 'SendMessage', to: 'a1', message: 'again', tool_use_id: 'toolu_s1' })
    const ui = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
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
    const ui = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    await ui.press({ key: 'agent-a1' })
    await ui.unmount()
    const sub = await $.ui.mount({ ...pane('ai-dlc-lens-agent'), surface: 'vscode' })
    expect(await sub.find({ type: 'Text', text: /^\s*Background tasks \(1\)$/ })).toBeDefined()
    await sub.press({ key: 'agent-tasks' })
    expect(await sub.find({ type: 'Text', text: /^\s*npm run watch - running$/ })).toBeDefined()
    await sub.unmount()
  })

  test('E7: a background Bash shows in the main avatar panel at once', async ($, on) => {
    await seed($, on)
    await $.tool.call({ tool: 'Bash', command: 'sleep 15', run_in_background: true, tool_use_id: 'toolu_b' })
    const ui = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    await ui.press({ key: 'agent-main' })
    await ui.unmount()
    const main = await $.ui.mount({ ...pane('ai-dlc-lens-agent'), surface: 'vscode' })
    await main.press({ key: 'agent-tasks' })
    expect(await main.find({ type: 'Text', text: /^\s*sleep 15 - running$/ })).toBeDefined()
    await main.unmount()
  })

  // Step 1.4: the experiments lost their command; the `probes` setting (off by default) turns the logging on.
  for (const probes of [true, false])
    test(`E1-E9: probes ${probes ? 'on' : 'off (the default)'} in lens.json ${probes ? 'log' : 'log nothing'} to PROBE-LOG.jsonl`, async ($, on) => {
      const { writes } = await seed($, on, probes ? { files: { '.ai-dlc/lens.json': JSON.stringify({ probes: true }) } } : {})
      await $.agent.spawn({ tool_use_id: 'toolu_2', prompt: 'again', description: 'again', subagentType: 'ai-dlc:software-engineer', provider: { plugin: 'ai-dlc', tier: 'user' }, parentModel: 'claude-opus-5-5', background: false, fork: false })
      const log = writes.filter(w => /PROBE-LOG\.jsonl$/.test(w.path)).at(-1)?.text ?? ''
      if (probes) {
        expect(log).toMatch(/"exp":"E1"/)
        expect(log).toMatch(/"exp":"E9"/)
      } else expect(log).toBe('')
    })

  test('round 4 UI: a narrow avatar panel: four divided sections, each with a heading, a count and its own Button; no raw JSON', async ($, on) => {
    await seed($, on, { files: { '.ai-dlc/lens.json': JSON.stringify({ collapsedByDefault: false }) } })
    const ui = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    await ui.press({ key: 'agent-a1' })
    await ui.unmount()
    const ag = await $.ui.mount({ ...pane('ai-dlc-lens-agent', 'inline', 24), surface: 'vscode' })
    const all: any[] = await ag.findAll({})
    const headings = all.filter((x: any) => x.type === 'Text' && /^\s*(Usage|Cache keep-alive|Tool calls|Background tasks|Thinking) \(/.test(String(x.text))).map((x: any) => String(x.text).trim().replace(/ \(.*$/, ''))
    // Step 1.4: the Cache keep-alive section, on by default (keepaliveSection), comes after Usage.
    expect(headings).toEqual(['Usage', 'Cache keep-alive', 'Tool calls', 'Background tasks', 'Thinking'])
    expect(all.filter((x: any) => x.type === 'Text' && /^─+$/.test(String(x.text))).length).toBe(5)
    for (const k of ['agent-usage', 'agent-keepalive', 'agent-calls', 'agent-tasks', 'agent-thinking']) expect(await ag.find({ type: 'Button', key: k })).toBeDefined()
    // No raw JSON in the panel.
    expect(all.some((x: any) => x.type === 'Text' && /^\s*[[{]"/.test(String(x.text)))).toBe(false)
    await ag.unmount()
  })
})

describe('collapsed by default (addendum 2)', () => {
  test('every [+]/[-] section starts collapsed: workflow pane, /ai-dlc:lens pane, arrow and avatar panels', async ($, on) => {
    await seed($, on)
    await $.tool.call({ tool: 'Grep', pattern: 'needle', tool_use_id: 'toolu_m1' })
    const wp = await chartPane($)
    for (const k of ['wf-thinking', 'wf-context']) expect((await wp.find({ type: 'Button', key: k }))?.text).toBe('[+]')
    expect(await wp.find({ type: 'Text', text: /Grep needle/ })).toBe(undefined)
    await wp.press({ key: 'wf-context' })
    expect(await wp.find({ type: 'Text', text: /Grep needle/ })).toBeDefined()
    await wp.unmount()
    const lens = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    for (const k of ['lens-thinking', 'lens-context', 'lens-settings']) expect((await lens.find({ type: 'Button', key: k }))?.text).toBe('[+]')
    await lens.press({ key: 'edge-a1' })
    await lens.press({ key: 'agent-a1' })
    await lens.unmount()
    const edge = await $.ui.mount({ ...pane('ai-dlc-lens-edge'), surface: 'vscode' })
    for (const k of ['edge-usage', 'edge-doc', 'edge-back']) expect((await edge.find({ type: 'Button', key: k }))?.text).toBe('[+]')
    await edge.unmount()
    const ag = await $.ui.mount({ ...pane('ai-dlc-lens-agent'), surface: 'vscode' })
    for (const k of ['agent-usage', 'agent-keepalive', 'agent-calls', 'agent-tasks', 'agent-thinking']) expect((await ag.find({ type: 'Button', key: k }))?.text).toBe('[+]')
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
    const lens = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    await lens.press({ key: 'lens-settings' })
    // Round 4: the pane shows the values only; /ai-dlc:lens-configure names the levels.
    expect(await lens.find({ type: 'Text', text: 'chartMode = "button"' })).toBeDefined()
    expect(await lens.find({ type: 'Text', text: 'showCost = false' })).toBeDefined()
    expect(await lens.find({ type: 'Text', text: 'callsShown = 5' })).toBeDefined()
    expect(await lens.find({ type: 'Text', text: 'blinkMs = 1000' })).toBeDefined()
    expect(await lens.find({ type: 'Text', text: /^blinkMs = "fast" is invalid, ignored$/ })).toBeDefined()
    await lens.press({ key: 'agent-a1' })
    await lens.unmount()
    const ag = await $.ui.mount({ ...pane('ai-dlc-lens-agent'), surface: 'vscode' })
    expect(await ag.find({ type: 'Text', text: /^Cost:/ })).toBe(undefined)
    await ag.unmount()
  })

  test('/ai-dlc:lens-init writes lens.json and its schema; /ai-dlc:lens-configure sets a key and names the winning level', async ($, on) => {
    const { writes } = await seed($, on, { defaultOpenMode: true, files: { '.claude/settings.json': local({ AI_DLC_LENS_BLINK: 'false' }) } })
    const init: any = await ($.command.run as any)({ command: 'ai-dlc:lens-init', args: '' })
    expect(String(init?.text)).toMatch(/Wrote \.ai-dlc\/lens\.json .*Still overridden by a settings env: blink \[\.claude\/settings\.json env\]/)
    expect(writes.map(w => w.path)).toEqual(expect.arrayContaining(['.ai-dlc/lens.json', '.ai-dlc/lens.schema.json']))
    expect(JSON.parse(writes.find(w => w.path === '.ai-dlc/lens.json')!.text).chartColumnPx).toBe(120)
    const set: any = await ($.command.run as any)({ command: 'ai-dlc:lens-configure', args: 'chartColumnPx 200' })
    expect(String(set?.text)).toMatch(/chartColumnPx = 200 \[\.ai-dlc\/lens\.json\]/)
    const blocked: any = await ($.command.run as any)({ command: 'ai-dlc:lens-configure', args: 'blink true' })
    expect(String(blocked?.text)).toMatch(/A higher level wins: \.claude\/settings\.json env/)
    const bad: any = await ($.command.run as any)({ command: 'ai-dlc:lens-configure', args: 'cellPx 2' })
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
    const ui = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
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

/** Mounts the chat cards, the /ai-dlc:lens pane, and every avatar and arrow panel; returns all their text. */
async function everything($: any, extraCard?: string): Promise<string[]> {
  const out: string[] = []
  for (const id of ['toolu_1', ...(extraCard ? [extraCard] : [])]) {
    const card = await $.ui.mount(toolRow(id, 'vscode', SE_INPUT))
    out.push(...(await drawn(card)))
    await card.unmount()
  }
  const lens = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
  out.push(...(await drawn(lens)))
  for (const target of ['agent-main', 'agent-a1', 'agent-a2', 'edge-a1', 'edge-a2']) {
    if ((await lens.find({ type: 'Button', key: target })) === undefined) continue
    await lens.press({ key: target })
    const id = target.startsWith('agent-') ? 'ai-dlc-lens-agent' : 'ai-dlc-lens-edge'
    const p = await $.ui.mount({ ...pane(id), surface: 'vscode' })
    out.push(...(await drawn(p)))
    await p.unmount()
  }
  await lens.unmount()
  return out
}

describe('round 4: no Agent description, no sources, collapsible background tasks', () => {
  test("no rendered text contains an Agent call's description: card, context, chip, panels, /ai-dlc:lens pane", async ($, on) => {
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
    const lens = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    await lens.press({ key: 'agent-a1' })
    const sub = await $.ui.mount({ ...pane('ai-dlc-lens-agent'), surface: 'vscode' })
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
    const main = await $.ui.mount({ ...pane('ai-dlc-lens-agent'), surface: 'vscode' })
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

  test('regression (step 8.1.5 definitions): B from a later message for the same request joins A while A still runs, with its own arrow', async ($, on) => {
    // A (a1) is spawned for the request "Ship it" and keeps running; B (a2), no run named, comes from a
    // later main-loop message of the same request (an automatic notice in between is not a new request).
    await seed($, on, { complete: false, request: 'Ship it' })
    await $.turn.start({ text: '<task-notification>x</task-notification>', turnId: 'm2' })
    await later($)
    const wp = await chartPane($)
    // One workflow (round 6: one panel, A2); both avatars and both arrows in one chart.
    expect((await wp.findAll({ type: 'Button' })).filter((b: any) => String(b.key).startsWith('wf-toolu')).map((b: any) => b.key)).toEqual(['wf-toolu_1'])
    for (const k of ['agent-a1', 'agent-a2', 'edge-a1', 'edge-a2']) expect(await wp.find({ type: 'Button', key: k })).toBeDefined()
    expect((await wp.find({ type: 'Button', key: 'edge-a2' }))?.text).toBe('Scott Hanselman -> Kent Beck')
    const src = await svgSource(wp)
    for (const n of ['>David Fowler<', '>Kent Beck<']) expect(src.includes(n)).toBe(true)
    // Step 30.1: A (step 17) and B (no record) are in two step charts, each with the orchestrator over it, who
    // runs while they do: A, B and the orchestrator in each chart blink.
    expect(await stepKeys(wp)).toEqual(['17', 'no-step'])
    expect((src.match(/<animate /g) ?? []).length).toBe(4)
    expect(await wp.find({ type: 'Text', text: /^Scott Hanselman spawned 2 agents$/ })).toBeDefined()
    await wp.unmount()
    const card = await $.ui.mount(toolRow('toolu_2', 'vscode', { subagent_type: 'ai-dlc:sqa-engineer', description: 'later', prompt: 'p' }))
    expect(await card.find({ type: 'Text', text: /agent 2 of 2 in the workflow of an earlier call/ })).toBeDefined()
    await card.unmount()
  })

  test('step 8.1.5: a new request with no run named, while A (run R) still runs, is a workflow of its own (a different work item)', async ($, on) => {
    await seed($, on, { complete: false, request: 'Ship it' })
    await $.turn.start({ text: 'and now something else', turnId: 'm2' })
    await later($)
    const wp = await chartPane($, 'vscode', false)
    expect((await wp.findAll({ type: 'Button' })).filter((b: any) => /^wf-toolu_\d+$/.test(String(b.key))).map((b: any) => b.key)).toEqual(['wf-toolu_2', 'wf-toolu_1'])
    await wp.unmount()
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
    // Step 30.1: the selected run (the newest) draws its step charts and their Buttons beside the list; an open
    // panel names how many step charts its run has, and "show" draws them in place of the others.
    expect(await wp.find({ type: 'Button', key: 'toolu_2:agent-a2' })).toBeDefined()
    expect(await wp.find({ type: 'Button', key: 'toolu_1:agent-a1' })).toBe(undefined)
    await wp.press({ key: 'wf-toolu_1' })
    await wp.press({ key: 'wf-toolu_2' })
    expect(await wp.find({ type: 'Text', text: '1 step chart' })).toBeDefined()
    expect(await wp.find({ type: 'Button', key: 'toolu_1:agent-a1' })).toBe(undefined)
    await wp.press({ key: 'wf-show-toolu_1' })
    expect(await wp.find({ type: 'Button', key: 'toolu_1:agent-a1' })).toBeDefined()
    expect(await wp.find({ type: 'Button', key: 'toolu_2:agent-a2' })).toBe(undefined)
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
    const ui = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    await ui.press({ key: 'agent-a1' })
    await ui.unmount()
    const ag = await $.ui.mount({ ...pane('ai-dlc-lens-agent'), surface: 'vscode' })
    await ag.press({ key: 'agent-usage' })
    expect(await ag.find({ type: 'Box', text: 'Max output64K' })).toBeDefined()
    expect(await ag.find({ type: 'Text', text: 'Max input' })).toBe(undefined)
    expect(await ag.find({ type: 'Text', text: 'Long-context window' })).toBe(undefined)
    expect(await ag.find({ type: 'Box', text: /^Cost\$/ })).toBeDefined()
    await ag.unmount()
    // main runs on claude-opus-5-5, not in the file: no limit rows at all, and its cost is —.
    const lens = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    await lens.press({ key: 'agent-main' })
    await lens.unmount()
    const main = await $.ui.mount({ ...pane('ai-dlc-lens-agent'), surface: 'vscode' })
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
    // The robot sits on the ring's centre: its box starts half its size up and left of the circle's centre.
    const circle = /<circle cx="(\d+)" cy="(\d+)" r="(\d+)"/.exec(src)!
    const d = 2 * Number(circle[3]) - 6
    expect(src.includes(`transform="translate(${Number(circle[1]) - d / 2} ${Number(circle[2]) - d / 2}) scale(${d / 40})"`)).toBe(true)
    await wp.unmount()
    const card = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT))
    expect((await boxes(card)).some(centred)).toBe(true)
    const all = await card.findAll({})
    expect(all.findIndex((x: any) => x.text === 'NATIVE ROW')).toBe(all.length - 1)
    await card.unmount()
    // The avatar panel's header block.
    const lens = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    await lens.press({ key: 'agent-a1' })
    await lens.unmount()
    const ag = await $.ui.mount({ ...pane('ai-dlc-lens-agent'), surface: 'vscode' })
    expect((await boxes(ag)).filter(centred).length).toBeGreaterThanOrEqual(2)
    await ag.unmount()
  })
})

describe('round 5: the task title at the top (requirement 2)', () => {
  test('the workflow panel shows the parent task; its task panel the running stage, following a run.md write (round 6, A2)', async ($, on) => {
    const { files } = await seed($, on, { complete: false, files: { 'docs/handoffs/R/run.md': RUN_R('build the lens') } })
    const wp = await chartPane($)
    // The workflow panel's header: the run's title. Step 30.1: its step chart's heading, the record's stage row.
    expect(await wp.find({ type: 'Text', text: 'R — the lens spike' })).toBeDefined()
    expect(await wp.find({ type: 'Text', text: 'Step 17 · build the lens' })).toBeDefined()
    const all: any[] = await wp.findAll({})
    const head = all.findIndex((x: any) => x.type === 'Text' && x.text === 'R — the lens spike')
    expect(head).toBeLessThan(all.findIndex((x: any) => x.type === 'Text' && x.text === 'Step 17 · build the lens'))
    // The orchestrator writes run.md (the next fix round): the step's heading follows with no other event.
    files['docs/handoffs/R/run.md'] = RUN_R('build the lens: fix round 1')
    await $.tool.call({ tool: 'Write', file_path: 'docs/handoffs/R/run.md', content: 'x', tool_use_id: 'toolu_w' })
    expect(await wp.find({ type: 'Text', text: 'Step 17 · build the lens: fix round 1' })).toBeDefined()
    expect(await wp.find({ type: 'Text', text: /^Step 17 · build the lens$/ })).toBe(undefined)
    expect(await chartSvg(wp)).toBeDefined()
    await completeAgent($, 'a1')
    expect(await wp.find({ type: 'Text', text: 'R — the lens spike' })).toBeDefined()
    await wp.unmount()
  })

  test('two agents on two runs, spawned in one message (step 8.1.5): two workflows, each titled by its run; never a description', async ($, on) => {
    await seed($, on, { parallel: true, complete: false, request: 'Ship the lens\nwith the panels', prompt2: S_BRIEF, desc: ['Wait one', 'Wait two'], files: { 'docs/handoffs/R/run.md': RUN_R('build the lens'), 'docs/handoffs/S/run.md': RUN_S } })
    const wp = await chartPane($)
    // AC-1.5.2: one workflow per run, whatever the message that spawned them. Step 30.1: each step of a run is a
    // chart headed by its stage; the selected run's charts are drawn, "show" draws the other's instead.
    expect(await wp.find({ type: 'Text', text: 'R — the lens spike' })).toBeDefined()
    expect(await wp.find({ type: 'Text', text: 'S — the second task' })).toBeDefined()
    expect(await wp.find({ type: 'Text', text: 'Step 18 · write the tests' })).toBeDefined()
    expect(await wp.find({ type: 'Button', key: 'toolu_2:agent-a2' })).toBeDefined()
    await wp.press({ key: 'wf-show-toolu_1' })
    expect(await wp.find({ type: 'Text', text: 'Step 17 · build the lens' })).toBeDefined()
    expect(await wp.find({ type: 'Button', key: 'toolu_1:agent-a1' })).toBeDefined()
    expect((await drawn(wp)).filter(t => /Wait one|Wait two|Agent: /.test(t))).toEqual([])
    await wp.unmount()
    const card = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT))
    expect(await card.find({ type: 'Text', text: /^Workflow: build the lens - DF running\s*$/ })).toBeDefined()
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
    // Step 30.1: collapsed, only the selected (newest) run's step charts are drawn, beside the list: its one
    // spawn names no record, so its one chart is the one for spawns with no step.
    expect((await chartSvgs(wp)).map((x: any) => x.props.alt)).toEqual(['Step chart no-step: Test the change please'])
    // Newest first: its status is in progress (blinking), the older completed (steady).
    expect(await statusSvgs(wp)).toEqual(['status: in progress', 'status: completed'])
    expect(await wp.find({ type: 'Text', text: /^\s*Test the change please$/ })).toBeDefined()
    expect(await wp.find({ type: 'Text', text: /^\s*R — the lens spike$/ })).toBeDefined()
    await wp.press({ key: 'wf-toolu_2' })
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
    const ui = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    await ui.press({ key: 'agent-a1' })
    await ui.unmount()
    const ag = await $.ui.mount({ ...pane('ai-dlc-lens-agent'), surface: 'vscode' })
    await ag.press({ key: 'agent-usage' })
    expect(await ag.find({ type: 'Box', text: 'Cost$3.06' })).toBeDefined()
    expect(await ag.find({ type: 'Box', text: 'Long-context requests0 of 1' })).toBeDefined()
    await ag.unmount()
  })

  test('the lens setting from a settings env puts the request over the threshold', async ($, on) => {
    await seed($, on, { files: { '.ai-dlc/model-metadata.json': META(LONG), '.claude/settings.json': JSON.stringify({ env: { AI_DLC_LENS_LONG_CONTEXT_THRESHOLD_TOKENS: '99999' } }) } })
    const ui = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    await ui.press({ key: 'agent-a1' })
    await ui.unmount()
    const ag = await $.ui.mount({ ...pane('ai-dlc-lens-agent'), surface: 'vscode' })
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
    // Step 1.5: the first row: the Panel Type switch left (Drill in, Tab); pinned/docked, full screen, minimise and close right.
    expect(keys.slice(0, 6)).toEqual(['panel-drill-in', 'panel-tab', 'pane-place', 'pane-full', 'pane-min', 'pane-close'])
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
    for (const id of ['ai-dlc-lens-agent', 'ai-dlc-lens-edge']) {
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
    // Step 30.1: no task panels any more; the selected run's step charts are drawn beside the list, open or not.
    expect(await wp.find({ type: 'Button', key: 'tk-toolu_1-0' })).toBe(undefined)
    expect(await stepKeys(wp)).toEqual(['17'])
    await wp.press({ key: 'wf-toolu_1' })
    expect(await wp.find({ type: 'Button', key: 'tk-toolu_1-0' })).toBe(undefined)
    expect(await stepKeys(wp)).toEqual(['17'])
    expect(await wp.find({ type: 'Button', key: 'agent-a1' })).toBeDefined()
    // The workflow's dot, and its step chart's own.
    expect((await statusSvgs(wp)).length).toBe(1)
    expect(((await wp.findAll({ type: 'Svg' })) as any[]).filter((x: any) => String(x?.props?.alt ?? '').startsWith('step status: ')).length).toBe(1)
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
    // The workflow's dot and its step chart's: both orange "waiting".
    expect(await statusSvgs(wp)).toEqual(['status: waiting'])
    expect(((await wp.findAll({ type: 'Svg' })) as any[]).map((x: any) => String(x?.props?.alt ?? '')).filter(a => a.startsWith('step status: '))).toEqual(['step status: waiting'])
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
    const src = flowchartSvg(['main'], agents, () => ({ name: 'Kent Beck', model: 'sonnet', role: 'SQA Engineer' }), undefined, { style: 'initials', image: () => null }).source
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

  test('18.4-3: the module keeps at most REQS_CAP requests per agent; past the cap a long-context cost is partial', HEAVY, async ($, on) => {
    const meta = JSON.stringify({
      longContextThresholdTokensOverride: null,
      models: [{ id: 'claude-sonnet-5-5', pricing: { input: 3, output: 15, cacheRead: 0.3, cacheWrite5m: 3.75 }, longContextPricing: { thresholdTokens: 100000, input: 6, output: 20, cacheRead: 0.6, cacheWrite5m: 7 } }],
    })
    await seed($, on, { complete: false, files: { '.ai-dlc/model-metadata.json': meta } })
    for (let i = 0; i < REQS_CAP; i++)
      for await (const _ of $.turn.step({ turnId: 't', index: 0, model: 'claude-sonnet-5-5', messageCount: 1, agentId: 'a1' })) {
        // drain
      }
    const ui = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    await ui.press({ key: 'agent-a1' })
    await ui.unmount()
    const ag = await $.ui.mount({ ...pane('ai-dlc-lens-agent'), surface: 'vscode' })
    await ag.press({ key: 'agent-usage' })
    // REQS_CAP + 1 steps seen, REQS_CAP kept: the kept ones do not add up to the totals.
    expect(await ag.find({ type: 'Box', text: /^Cost— \(partial/ })).toBeDefined()
    expect(await ag.find({ type: 'Text', text: 'Long-context requests' })).toBe(undefined)
    await ag.unmount()
  })
})

// ---------------- avatars: robots and images (spike ITEM-029, robot-avatar addendum) ----------------
// The real 48 x 48 avatar.png of spike 029, and the first bytes of its JPEG, GIF and WebP (magic bytes).
const AVATAR_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAAASElEQVR42u3PMQ0AMAwDwYDoXIhFUogFUQgh4S0n/Wyd698VaZ8XqYCAgICAgICAgICAgIaBUkOpY0BAQEBAQEBAQEBAQMNADebbXMRiLnWeAAAAAElFTkSuQmCC'
const JPEG_HEAD = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQE'
const GIF_HEAD = 'R0lGODlhMAAwAPcAAAAAAAAAMwAAZgAAmQAAzAAA/wArAAArMwArZgArmQAr'
const WEBP = 'UklGRhoAAABXRUJQVlA4TA0AAAAvL8ALAChKLYvc/wIAAA=='
const PNG_URI = `data:image/png;base64,${AVATAR_PNG}`
/** A PNG signature and filler: `n` base64 characters that sniff as a PNG. */
const bigPng = (n: number) => (AVATAR_PNG.slice(0, 22) + 'A'.repeat(n)).slice(0, n - (n % 4))
const agentsOf = (...types: string[]) =>
  Object.fromEntries(
    types.map((type, i) => [`x${i}`, { id: `x${i}`, parent: i === 0 ? null : 'x0', type, status: i === 1 ? 'running' : 'completed', loop: false, handoff: null } as any]),
  )
const named = () => ({ name: 'Kent Beck', model: 'sonnet', role: 'SQA Engineer' })
const HOME = '/home/u'
const TRUSTED_ENV = { HOME }
const trustFiles = (extra: Record<string, string> = {}) => ({ [`${HOME}/.claude.json`]: JSON.stringify({ projects: { '/trusted': { hasTrustDialogAccepted: true }, '/other': { hasTrustDialogAccepted: false } } }), ...extra })
const TRUST_STAT = {
  '/trusted': { kind: 'dir' as const, size: 0, realPath: '/trusted' },
  '/trusted/df.png': { kind: 'file' as const, size: 129, realPath: '/trusted/df.png' },
  '/trusted/df.jpg': { kind: 'file' as const, size: 45, realPath: '/trusted/df.jpg' },
  '/elsewhere/df.png': { kind: 'file' as const, size: 129, realPath: '/elsewhere/df.png' },
  '/trusted/link.png': { kind: 'file' as const, size: 129, realPath: '/elsewhere/df.png' },
  '/trusted/../elsewhere/df.png': { kind: 'file' as const, size: 129, realPath: '/elsewhere/df.png' },
}
const TRUST_BYTES = { '/trusted/df.png': AVATAR_PNG, '/elsewhere/df.png': AVATAR_PNG, '/trusted/df.jpg': JPEG_HEAD }
const lensJson = (o: Record<string, unknown>) => ({ '.ai-dlc/lens.json': JSON.stringify(o) })
const seRobot = `class="${robotId(robotOf('software-engineer'))}"`

describe('avatars: robots (addendum)', () => {
  test('the same agent type gets the same robot; different types get different robots', () => {
    expect(robotOf(avatarKey('ai-dlc:code-reviewer'))).toEqual(robotOf(avatarKey('ai-dlc:code-reviewer')))
    expect(robotId(robotOf('code-reviewer'))).not.toBe(robotId(robotOf('sqa-engineer')))
    // Every ai-dlc agent (and the bare main loop) has its own robot.
    const ids = Object.keys(ROBOT_TABLE).map(k => robotId(robotOf(k)))
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBe(16)
    // Every design is used by some ai-dlc agent: the styles are all on show.
    expect(new Set(Object.values(ROBOT_TABLE).map(r => r.design)).size).toBe(ROBOT_DESIGNS.length)
    // Any other type: the documented hash, stable across calls.
    expect(fnv1a('')).toBe(0x811c9dc5)
    expect(fnv1a('a')).toBe(0xe40c292c)
    const h = fnv1a('my-plugin:helper')
    expect(robotOf('my-plugin:helper')).toEqual({ design: h % ROBOT_DESIGNS.length, color: (h >>> 8) % 8 })
    expect(avatarKey('ai-dlc:software-architect')).toBe('software-architect')
    expect(avatarKey('my-plugin:helper')).toBe('my-plugin:helper')
    expect(avatarKey('')).toBe('main')
  })

  test('two parallel code-reviewers draw the same robot; sqa-engineer another; no <symbol>, <use> or <clipPath>', () => {
    const agents = agentsOf('ai-dlc:orchestrator', 'ai-dlc:code-reviewer', 'ai-dlc:code-reviewer', 'ai-dlc:sqa-engineer')
    const src = flowchartSvg(Object.keys(agents), agents, named).source
    const cr = robotId(robotOf('code-reviewer'))
    const robots = [...src.matchAll(/<g class="(lens-robot-[^"]+)" transform="[^"]*">(.*?)<\/g>/g)].map(m => [m[1]!, m[2]!] as const)
    const crs = robots.filter(r => r[0] === cr)
    expect(crs.length).toBe(2)
    expect(crs[0]![1]).toBe(crs[1]![1])
    expect(robots.filter(r => r[0] === robotId(robotOf('sqa-engineer'))).length).toBe(1)
    for (const gone of ['<symbol', '<use', '<clipPath']) expect(src.includes(gone)).toBe(false)
    // No initials in the robot style; the robots draw no <circle>, so each node has exactly one: its ring.
    expect(src.includes('dominant-baseline')).toBe(false)
    expect((src.match(/<circle /g) ?? []).length).toBe(4)
    // The status is the ring's colour, and only the running ring blinks.
    expect(src).toMatch(/<circle [^>]*stroke="#2e7d32" stroke-width="3">/)
    expect((src.match(/<animate /g) ?? []).length).toBe(1)
    for (const d of ROBOT_DESIGNS) expect(d.draw('#000').includes('<circle')).toBe(false)
  })

  test('avatarStyle initials (and image with no image) draw the initials badge, as before the robots', () => {
    const agents = agentsOf('ai-dlc:sqa-engineer')
    for (const style of ['initials', 'image']) {
      const src = flowchartSvg(['x0'], agents, named, undefined, { style, image: () => null }).source
      expect(src).toMatch(/dominant-baseline="central"[^>]*>KB</)
      expect(src.includes('lens-robot-')).toBe(false)
    }
    expect(avatarSvg({ style: 'initials', image: () => null }, 'sqa-engineer')).toBe(null)
    expect(avatarSvg({ style: 'image', image: () => null }, 'sqa-engineer')).toBe(null)
    expect(String(avatarSvg({ style: 'robot', image: () => null }, 'sqa-engineer'))).toMatch(new RegExp(`class="${robotId(robotOf('sqa-engineer'))}"`))
  })
})

describe('avatars: images (spike 029)', () => {
  test('classify: a data URI, a path (a Windows drive too), and every other scheme refused', () => {
    expect(classify(PNG_URI)).toEqual({ kind: 'data', mime: 'image/png', base64: AVATAR_PNG })
    expect(classify('C:\\pics\\a.png')).toEqual({ kind: 'path', path: 'C:\\pics\\a.png' })
    expect(classify('pics/a.png')).toEqual({ kind: 'path', path: 'pics/a.png' })
    for (const v of ['https://example.com/a.png', 'http://x/a.png', 'file:///trusted/df.png', 'ftp://x/a', 'data:image/png,notbase64', ''])
      expect(classify(v).kind).toBe('refused')
  })

  test('checkBytes: magic bytes decide the type; the allowed types and the size limit apply', () => {
    expect(sniffType(AVATAR_PNG)).toBe('image/png')
    expect(sniffType(JPEG_HEAD)).toBe('image/jpeg')
    expect(sniffType(GIF_HEAD)).toBe('image/gif')
    expect(sniffType(WEBP)).toBe('image/webp')
    expect(sniffType('PHN2Zz48L3N2Zz4=')).toBe('')
    expect(decodedBytes(AVATAR_PNG)).toBe(129)
    expect(checkBytes(AVATAR_PNG, 'image/png', ['image/png'], 65536)).toEqual({ mime: 'image/png', bytes: 129 })
    expect(String((checkBytes(JPEG_HEAD, 'image/jpeg', ['image/png'], 65536) as any).why)).toMatch(/not in avatarImageTypes/)
    expect(String((checkBytes(AVATAR_PNG, 'image/gif', ['image/png', 'image/gif'], 65536) as any).why)).toMatch(/says image\/gif but is image\/png/)
    expect(String((checkBytes(AVATAR_PNG, null, ['image/png'], 100) as any).why)).toMatch(/over avatarImageMaxBytes/)
    expect(String((checkBytes('PHN2Zz48L3N2Zz4=', null, ['image/png'], 100) as any).why)).toMatch(/not an image/)
  })

  test('trust: the trusted folders of ~/.claude.json; inside means under the folder, never a name prefix', () => {
    const text = JSON.stringify({ projects: { '/a/b': { hasTrustDialogAccepted: true }, '/c': { hasTrustDialogAccepted: 'yes' }, 'E:\\Work': { hasTrustDialogAccepted: true } } })
    expect(trustedFolders(text)).toEqual(['/a/b', 'E:\\Work'])
    expect(trustedFolders(null)).toEqual([])
    expect(trustedFolders('not json')).toEqual([])
    expect(isInside('/a/b/x.png', ['/a/b'])).toBe(true)
    expect(isInside('/a/bc/x.png', ['/a/b'])).toBe(false)
    expect(isInside('e:/work/pics/x.png', ['E:\\Work'])).toBe(true)
    expect(isInside('/A/b/x.png', ['/a/b'])).toBe(false)
  })

  test('the chart draws a set image instead of the robot for every agent of the type', () => {
    const agents = agentsOf('ai-dlc:orchestrator', 'ai-dlc:code-reviewer', 'ai-dlc:code-reviewer')
    const img = { uri: PNG_URI, bytes: 129, png: AVATAR_PNG }
    const src = flowchartSvg(Object.keys(agents), agents, named, undefined, { style: 'robot', image: k => (k === 'code-reviewer' ? img : null) }).source
    expect((src.match(/<image href="data:image\/png;base64,/g) ?? []).length).toBe(2)
    expect(src.includes(`class="${robotId(robotOf('orchestrator'))}"`)).toBe(true)
    expect(src.includes(robotId(robotOf('code-reviewer')))).toBe(false)
  })

  test('cap: images that would pass 131,072 characters are left out, largest first; a chart over it anyway is too large', () => {
    const agents = agentsOf('ai-dlc:orchestrator', 'ai-dlc:code-reviewer', 'ai-dlc:sqa-engineer')
    const big = { uri: `data:image/png;base64,${bigPng(100_000)}`, bytes: 75_000, png: null }
    const small = { uri: `data:image/png;base64,${bigPng(40_000)}`, bytes: 30_000, png: null }
    const chart = flowchartSvg(Object.keys(agents), agents, named, undefined, { style: 'robot', image: k => (k === 'code-reviewer' ? big : k === 'sqa-engineer' ? small : null) })
    expect(chart.source.length).toBeLessThan(SVG_CAP + 1)
    expect(chart.dropped).toEqual(['code-reviewer'])
    expect(chart.tooLarge).toBe(false)
    expect(chart.source.includes(small.uri)).toBe(true)
    expect(chart.source.includes(`class="${robotId(robotOf('code-reviewer'))}"`)).toBe(true)
    // Within the cap nothing is dropped.
    expect(flowchartSvg(Object.keys(agents), agents, named, undefined, { style: 'robot', image: k => (k === 'sqa-engineer' ? small : null) }).dropped).toEqual([])
    // 300 agents: over the cap with no image at all.
    const many = agentsOf(...Array.from({ length: 300 }, (_, i) => `p:agent-${i}`))
    expect(flowchartSvg(Object.keys(many), many, named).tooLarge).toBe(true)
    // A header avatar whose image alone passes the cap falls back to the robot.
    const huge = { uri: `data:image/png;base64,${bigPng(SVG_CAP)}`, bytes: 98_000, png: null }
    expect(String(avatarSvg({ style: 'robot', image: () => huge }, 'sqa-engineer'))).toMatch(/lens-robot-/)
  })
})

describe('avatars: settings', () => {
  test('avatarStyle, avatarImageTypes and avatarImageMaxBytes resolve like every setting; per-agent keys by level', () => {
    const levels = [
      envLevel('.claude/settings.local.json', JSON.stringify({ env: { AI_DLC_LENS_AVATAR_STYLE: 'cartoon', AI_DLC_LENS_AVATAR_IMAGE__SOFTWARE_ENGINEER: '/trusted/local.png' } })).level,
      envLevel('.claude/settings.json', JSON.stringify({ env: { AI_DLC_LENS_AVATAR_IMAGE_TYPES: 'image/png, IMAGE/WEBP, image/png' } })).level,
      fileLevel(
        '.ai-dlc/lens.json',
        JSON.stringify({ avatarStyle: 'image', avatarImageTypes: ['image/bmp'], avatarImageMaxBytes: 4096, 'avatarImage.software-engineer': '/trusted/df.png', 'avatarImage.sqa-engineer': 7 }),
      ).level,
    ]
    const r = resolve(levels)
    expect([r.settings.avatarStyle, r.sources.avatarStyle]).toEqual(['image', '.ai-dlc/lens.json'])
    expect(r.settings.avatarImageTypes).toBe('image/png,image/webp')
    expect(r.settings.avatarImageMaxBytes).toBe(4096)
    expect(DEFAULTS.avatarStyle).toBe('robot')
    expect(DEFAULTS.avatarImageTypes).toBe('image/png')
    expect(resolveAgent(levels, 'avatarImage', 'software-engineer')).toEqual({ value: '/trusted/local.png', source: '.claude/settings.local.json env', ignored: [] })
    expect(resolveAgent(levels, 'avatarImage', 'sqa-engineer')).toBe(null)
    expect(resolveAgent(levels, 'avatarImage', 'code-reviewer')).toBe(null)
    expect(agentEnvName('avatarImage', 'my-plugin:my-agent')).toBe('AI_DLC_LENS_AVATAR_IMAGE__MY_PLUGIN__MY_AGENT')
    expect(agentKeyParts('avatarImage.software-engineer')).toEqual({ family: 'avatarImage', agent: 'software-engineer' })
    expect(agentKeyParts('avatarImage.')).toBe(null)
    expect(setKey(null, 'avatarImage.', 'x').error).toMatch(/agent part is empty/)
    expect(JSON.parse(setKey(null, 'avatarImage.my-plugin:helper', '/trusted/df.png').text)['avatarImage.my-plugin:helper']).toBe('/trusted/df.png')
    expect(JSON.parse(setKey(null, 'avatarImageTypes', 'image/png,image/gif').text).avatarImageTypes).toBe('image/png,image/gif')
    expect(setKey(null, 'avatarImageTypes', 'image/bmp').error).toMatch(/comma-separated list/)
    expect(Object.keys((schema().patternProperties as object) ?? {}).length).toBe(1)
  })
})

describe('avatars: in the panes (spike 029, AC-13.3 to 13.9)', () => {
  test('a data URI image is drawn for its agent type on vscode and desktop; the engine hands the markup on unchanged', async ($, on) => {
    await seed($, on, { files: lensJson({ 'avatarImage.software-engineer': PNG_URI }) })
    for (const surface of ['vscode', 'desktop'] as const) {
      const wp = await $.ui.mount({ ...pane(CHART_PANE), surface })
      await openPanels(wp)
      const src = await svgSource(wp)
      expect(src.includes(`<image href="${PNG_URI}"`)).toBe(true)
      expect(src.includes(seRobot)).toBe(false)
      expect(src.includes(`class="${robotId(robotOf('orchestrator'))}"`)).toBe(true)
      await wp.unmount()
    }
  })

  test('a trusted PNG path draws in the Svg and, on the terminal, as an Image; the agent panel header shows it', async ($, on) => {
    await seed($, on, { env: TRUSTED_ENV, files: { ...trustFiles(), ...lensJson({ 'avatarImage.software-engineer': '/trusted/df.png' }) }, stat: TRUST_STAT, bytes: TRUST_BYTES })
    const wp = await chartPane($)
    expect((await svgSource(wp)).includes(`<image href="${PNG_URI}"`)).toBe(true)
    await wp.unmount()
    const term = await chartPane($, 'terminal')
    const img: any = await term.find({ type: 'Image' })
    expect(img).toBeDefined()
    expect(img?.props?.source?.png ?? img?.source?.png).toBe(AVATAR_PNG)
    await term.unmount()
    const lens = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    await lens.press({ key: 'agent-a1' })
    await lens.unmount()
    const ag = await $.ui.mount({ ...pane('ai-dlc-lens-agent'), surface: 'vscode' })
    const header: any = ((await ag.findAll({ type: 'Svg' })) as any[]).find((x: any) => String(x?.props?.alt ?? '').startsWith('avatar of'))
    expect(String(header?.props?.source ?? '')).toMatch(/<image href="data:image\/png;base64,/)
    // The initials stay as the header's small label.
    expect(await ag.find({ type: 'Text', text: /^\s*DF\s*$/ })).toBeDefined()
    await ag.unmount()
  })

  for (const [what, value] of [
    ['outside every trusted folder (AC-13.4)', '/elsewhere/df.png'],
    ['a link out of the trusted folder (AC-13.9)', '/trusted/link.png'],
    ['.. out of the trusted folder (AC-13.9)', '/trusted/../elsewhere/df.png'],
    ['a trusted path that does not exist (AC-13.7)', '/trusted/missing.png'],
    ['a type not in avatarImageTypes (AC-13.6)', '/trusted/df.jpg'],
    ['a remote URL, never fetched (AC-13.6)', 'https://example.com/df.png'],
  ] as const)
    test(`refused, the robot draws: ${what}`, async ($, on) => {
      const r = await seed($, on, { env: TRUSTED_ENV, files: { ...trustFiles(), ...lensJson({ 'avatarImage.software-engineer': value }) }, stat: TRUST_STAT, bytes: TRUST_BYTES })
      const wp = await chartPane($)
      const src = await svgSource(wp)
      expect(src.includes('<image ')).toBe(false)
      expect(src.includes(seRobot)).toBe(true)
      await wp.unmount()
      // A remote URL is never touched: no stat, so no request.
      if (value.startsWith('https:')) expect(r.statted.some(p => p.includes('example.com'))).toBe(false)
      const list: any = await ($.command.run as any)({ command: 'ai-dlc:lens-configure', args: '' })
      expect(String(list?.text)).toMatch(/avatarImage\.software-engineer \[\.ai-dlc\/lens\.json\]: refused, /)
    })

  test('avatarStyle initials: the initials badge even with an image set, and no image is read', async ($, on) => {
    const r = await seed($, on, { env: TRUSTED_ENV, files: { ...trustFiles(), ...lensJson({ avatarStyle: 'initials', 'avatarImage.software-engineer': '/trusted/df.png' }) }, stat: TRUST_STAT, bytes: TRUST_BYTES })
    const wp = await chartPane($)
    const src = await svgSource(wp)
    for (const s of ['>DF<', '>SH<']) expect(src.includes(s)).toBe(true)
    expect(src.includes('<image ')).toBe(false)
    expect(src.includes('lens-robot-')).toBe(false)
    expect(r.statted.length).toBe(0)
    await wp.unmount()
  })

  test('avatarStyle image: the image where set, else the initials badge (no robot)', async ($, on) => {
    await seed($, on, { files: lensJson({ avatarStyle: 'image', 'avatarImage.software-engineer': PNG_URI }) })
    const wp = await chartPane($)
    const src = await svgSource(wp)
    expect(src.includes(`<image href="${PNG_URI}"`)).toBe(true)
    expect(src.includes('>SH<')).toBe(true)
    expect(src.includes('lens-robot-')).toBe(false)
    await wp.unmount()
  })

  test('cap: an image that would pass 131,072 characters is left out and a dim line says so; the pane still draws', async ($, on) => {
    const uri = `data:image/png;base64,${bigPng(132_000)}`
    await seed($, on, { files: lensJson({ avatarImageMaxBytes: 200_000, 'avatarImage.software-engineer': uri }) })
    const wp = await chartPane($)
    const src = await svgSource(wp)
    expect(src.length).toBeGreaterThan(0)
    expect(src.length).toBeLessThan(SVG_CAP + 1)
    expect(src.includes('<image ')).toBe(false)
    expect(src.includes(seRobot)).toBe(true)
    expect(await wp.find({ type: 'Text', text: /^An avatar image was left out \(software-engineer\): the chart would pass the 131,072-character Svg limit\.$/ })).toBeDefined()
    await wp.unmount()
  })

  for (const [what, files] of [
    ['over avatarImageMaxBytes', lensJson({ avatarImageMaxBytes: 100, 'avatarImage.software-engineer': PNG_URI })],
    ['of a type not allowed', lensJson({ 'avatarImage.software-engineer': `data:image/webp;base64,${WEBP}` })],
  ] as const)
    test(`a data URI ${what} is refused (AC-13.5)`, async ($, on) => {
      await seed($, on, { files })
      const wp = await chartPane($)
      const src = await svgSource(wp)
      expect(src.includes('<image ')).toBe(false)
      expect(src.includes(seRobot)).toBe(true)
      await wp.unmount()
    })

  test('the terminal never draws a data URI (AC-13.5)', async ($, on) => {
    await seed($, on, { files: lensJson({ 'avatarImage.software-engineer': PNG_URI }) })
    const term = await chartPane($, 'terminal')
    expect(await term.find({ type: 'Image' })).toBe(undefined)
    await term.unmount()
  })

  test('a per-agent env entry beats lens.json; /ai-dlc:lens-configure refuses an untrusted path and writes a trusted one', async ($, on) => {
    const { writes } = await seed($, on, {
      env: TRUSTED_ENV,
      files: { ...trustFiles(), '.claude/settings.local.json': JSON.stringify({ env: { AI_DLC_LENS_AVATAR_IMAGE__SOFTWARE_ENGINEER: PNG_URI } }), ...lensJson({ 'avatarImage.software-engineer': '/elsewhere/df.png' }) },
      stat: TRUST_STAT,
      bytes: TRUST_BYTES,
    })
    const wp = await chartPane($)
    expect((await svgSource(wp)).includes(`<image href="${PNG_URI}"`)).toBe(true)
    await wp.unmount()
    const before = writes.length
    const bad: any = await ($.command.run as any)({ command: 'ai-dlc:lens-configure', args: 'avatarImage.sqa-engineer /elsewhere/df.png' })
    expect(String(bad?.text)).toMatch(/^Not changed: avatarImage\.sqa-engineer is refused: it is outside every folder Claude Code trusts\.$/)
    const remote: any = await ($.command.run as any)({ command: 'ai-dlc:lens-configure', args: 'avatarImage.sqa-engineer https://example.com/a.png' })
    expect(String(remote?.text)).toMatch(/^Not changed: .*https: URL/)
    expect(writes.length).toBe(before)
    const ok: any = await ($.command.run as any)({ command: 'ai-dlc:lens-configure', args: 'avatarImage.sqa-engineer /trusted/df.png' })
    expect(String(ok?.text)).toMatch(/avatarImage\.sqa-engineer = "\/trusted\/df\.png" \[\.ai-dlc\/lens\.json\]/)
    expect(JSON.parse(writes[writes.length - 1]!.text)['avatarImage.sqa-engineer']).toBe('/trusted/df.png')
    const shown: any = await ($.command.run as any)({ command: 'ai-dlc:lens-configure', args: 'avatarImage.software-engineer' })
    expect(String(shown?.text)).toMatch(/\[\.claude\/settings\.local\.json env\] \(env AI_DLC_LENS_AVATAR_IMAGE__SOFTWARE_ENGINEER/)
  })
})

describe('avatars: the flowchart renders (bug report, step 8.1.2: "the flowchart is gone")', () => {
  /** Every chart Svg of a pane, by its alt. */
  const charts = async (ui: any): Promise<string[]> =>
    (await chartSvgs(ui)).map((x: any) => String(x?.props?.source ?? ''))
  const TYPES = ['ai-dlc:software-engineer', 'ai-dlc:sqa-engineer', 'ai-dlc:code-reviewer', 'ai-dlc:code-reviewer', 'ai-dlc:documentation-writer']

  for (const n of [1, 2, 5])
    test(`${n} agent${n > 1 ? 's' : ''}: the workflow pane draws the chart, a robot in every node, well-formed and under the cap`, async ($, on) => {
      await seed($, on, { parallel: n > 1, complete: false })
      for (let i = 3; i <= n; i++) {
        const id = `toolu_${i}`
        await $.tool.call({ tool: 'Agent', subagent_type: TYPES[i - 1]!, description: `d${i}`, prompt: `P${i}`, tool_use_id: id })
        await $.agent.spawn({ tool_use_id: id, prompt: `P${i}`, description: `d${i}`, subagentType: TYPES[i - 1]!, provider: { plugin: 'ai-dlc', tier: 'user' }, parentModel: 'claude-opus-5-5', background: true, fork: false })
      }
      for (const surface of ['vscode', 'desktop'] as const) {
        const wp = await $.ui.mount({ ...pane(CHART_PANE), surface })
        await openPanels(wp)
        const srcs = await charts(wp)
        expect(srcs.length).toBeGreaterThan(0)
        for (const src of srcs) {
          expect(src.length).toBeLessThan(SVG_CAP + 1)
          // Well-formed enough for any Svg parser: every element opened is closed.
          for (const tag of ['svg', 'g', 'circle', 'text', 'path', 'defs', 'marker', 'title']) {
            const opened = (src.match(new RegExp(`<${tag}[ >]`, 'g')) ?? []).length
            const selfClosed = (src.match(new RegExp(`<${tag}[^>]*/>`, 'g')) ?? []).length
            expect([tag, opened - selfClosed]).toEqual([tag, (src.match(new RegExp(`</${tag}>`, 'g')) ?? []).length])
          }
          // A robot per node, and only the elements the chart drew before the robots plus <g>, <rect>, <ellipse>.
          expect((src.match(/<g class="lens-robot-/g) ?? []).length).toBe((src.match(/<circle /g) ?? []).length)
          const tags = new Set([...src.matchAll(/<([a-zA-Z]+)/g)].map(m => m[1]))
          for (const t of tags) expect(['svg', 'defs', 'marker', 'path', 'title', 'circle', 'animate', 'text', 'g', 'rect', 'ellipse']).toContain(t)
        }
        const all = srcs.join('')
        for (let i = 1; i <= n; i++) expect(all.includes(robotId(robotOf(avatarKey(i <= 2 ? (i === 1 ? 'ai-dlc:software-engineer' : 'ai-dlc:sqa-engineer') : TYPES[i - 1]!))))).toBe(true)
        expect(await wp.find({ type: 'Text', text: /could not be drawn|too large to draw/ })).toBe(undefined)
        await wp.unmount()
      }
    })

})


// ---------------- keep-alive (spike 028, AC-9.4): ai-dlc's published state, read-only ----------------
// An inline plugin named ai-dlc stands for the provider: its commands write the value as keep-alive
// does on arming and on stopping (plugins/claude/ai-dlc/types/index.d.ts).
const KA_NEXT = Date.UTC(2026, 9, 23, 12, 5, 7)
const kaTrack = (name: '1h' | '5m', running: boolean, pings: number, cap: number) => ({
  name,
  running,
  armedAt: 1,
  warmUntil: 2,
  nextPingAt: running ? KA_NEXT : null,
  pingEvery: 180_000,
  pings,
  cap,
  line: '',
})
// The engine loads `register` on its own, so it can use nothing from outside it: KA_NEXT and kaTrack are repeated.
const kaProvider = {
  name: 'ai-dlc',
  register(on: Parameters<import('claude-code').Register>[0]) {
    const KA = { plugin: 'ai-dlc', key: 'keepalive' } as const
    const next = Date.UTC(2026, 9, 23, 12, 5, 7)
    const track = (name: '1h' | '5m', running: boolean, pings: number, cap: number) => ({ name, running, armedAt: 1, warmUntil: 2, nextPingAt: running ? next : null, pingEvery: 180_000, pings, cap, line: '' })
    const write = (enabled: boolean, running: boolean) => ({ enabled, updatedAt: 0, sessionId: 's', tracks: [track('1h', false, 0, 9), track('5m', running, 1, 20)] })
    on('command.run', { command: 'ka-arm' }, async ($: any) => {
      await $.state.set(KA, write(true, true))
      return { text: 'armed' }
    })
    on('command.run', { command: 'ka-stop' }, async ($: any) => {
      await $.state.set(KA, write(true, false))
      return { text: 'stopped' }
    })
    on('command.run', { command: 'ka-off' }, async ($: any) => {
      await $.state.set(KA, write(false, true))
      return { text: 'off' }
    })
  },
}
const KA_LINE = `keep-alive: 5m ping 1/20, next ${fmtClock(KA_NEXT)}`

describe('keep-alive (spike 028, AC-9.4)', () => {
  test('the line: running tracks only, nothing when absent, off, stopped or in an unknown shape', () => {
    const v = (enabled: unknown, tracks: unknown) => ({ enabled, updatedAt: 0, sessionId: 's', tracks })
    expect(keepaliveLine(v(true, [kaTrack('1h', false, 0, 9), kaTrack('5m', true, 1, 20)]))).toBe(KA_LINE)
    expect(keepaliveLine(v(true, [kaTrack('1h', true, 2, 9), kaTrack('5m', true, 1, 20)]))).toBe(`keep-alive: 1h ping 2/9, next ${fmtClock(KA_NEXT)} · 5m ping 1/20, next ${fmtClock(KA_NEXT)}`)
    expect(keepaliveLine(v(true, [{ name: '1h', running: true }]))).toBe('keep-alive: 1h')
    for (const none of [undefined, null, 'x', 3, v(false, [kaTrack('5m', true, 1, 20)]), v(true, [kaTrack('5m', false, 20, 20)]), v(true, []), v(true, 'x'), v(true, [null, 7, { running: true }]), { tracks: [kaTrack('5m', true, 1, 20)] }])
      expect(keepaliveLine(none)).toBe(null)
  })

  test('the workflow pane and the lens pane show the line while a track runs, and drop it when it stops', { plugins: [kaProvider] }, async ($, on) => {
    await seed($, on)
    for (const surface of SURFACES) {
      await $.command.run({ command: 'ka-arm' } as never)
      const wp = await chartPane($, surface, false)
      expect((await wp.find({ type: 'Text', text: /^keep-alive:/ }))?.text).toBe(KA_LINE)
      const lp = await $.ui.mount({ ...pane('ai-dlc-lens'), surface })
      expect((await lp.find({ type: 'Text', text: /^keep-alive:/ }))?.text).toBe(KA_LINE)

      // The provider's next write redraws both panes: no line, every other header field still draws.
      await $.command.run({ command: 'ka-stop' } as never)
      expect(await wp.find({ type: 'Text', text: /^keep-alive:/ })).toBe(undefined)
      expect(await wp.find({ type: 'Button', key: 'pane-close' })).toBeDefined()
      expect(await wp.find({ type: 'Button', key: 'pane-min' })).toBeDefined()
      expect(await lp.find({ type: 'Text', text: /^keep-alive:/ })).toBe(undefined)
      expect(await lp.find({ type: 'Text', text: /^Workflow$/ })).toBeDefined()

      // Keep-alive turned off: no line, even with a track still marked running.
      await $.command.run({ command: 'ka-off' } as never)
      expect(await wp.find({ type: 'Text', text: /^keep-alive:/ })).toBe(undefined)
      await lp.unmount()
      await wp.unmount()
    }
  })

  test('without ai-dlc (no published value) no line draws and the panes draw as before', async ($, on) => {
    await seed($, on)
    for (const surface of SURFACES) {
      const wp = await chartPane($, surface)
      expect(await wp.find({ type: 'Text', text: /^keep-alive:/ })).toBe(undefined)
      expect(await wp.find({ type: 'Button', key: 'pane-close' })).toBeDefined()
      expect(await wp.find({ type: 'Button', key: 'agent-a1' })).toBeDefined()
      expect(await wp.find({ type: 'Text', text: /lens hook error/ })).toBe(undefined)
      await wp.unmount()
    }
  })
})

// ---------------- /ai-dlc:* commands and /ai-dlc:lens-keepalive (step 1.4) ----------------
// A provider that publishes armings with real times, in the past so `now` never cuts them: `ka2-first` an
// arming that kept the cache warm 9 minutes, `ka2-second` a later arming of the same track. Repeated inside:
// `register` runs on its own.
const kaTimed = {
  name: 'ai-dlc',
  register(on: Parameters<import('claude-code').Register>[0]) {
    const KA = { plugin: 'ai-dlc', key: 'keepalive' } as const
    const T0 = Date.UTC(2020, 0, 6, 10, 0, 0)
    const track = (name: '1h' | '5m', running: boolean, armedAt: number, warmUntil: number, pings: number) => ({ name, running, armedAt, warmUntil, nextPingAt: null, pingEvery: 240_000, keepWarmMs: 3_600_000, pings, cap: 20, line: '' })
    on('command.run', { command: 'ka2-first' }, async ($: any) => {
      await $.state.set(KA, { enabled: true, updatedAt: 0, sessionId: 's', tracks: [track('1h', false, 0, 0, 0), track('5m', false, T0, T0 + 540_000, 1)] })
      return { text: 'first' }
    })
    on('command.run', { command: 'ka2-second' }, async ($: any) => {
      await $.state.set(KA, { enabled: true, updatedAt: 0, sessionId: 's', tracks: [track('1h', false, 0, 0, 0), track('5m', true, T0 + 3_600_000, T0 + 3_600_000 + 120_000, 0)] })
      return { text: 'second' }
    })
  },
}
const T0 = Date.UTC(2020, 0, 6, 10, 0, 0)
// Prices for both models of the seed (main: opus, cr 100K; a1: sonnet, cr 90K).
const COSTING_BOTH = JSON.stringify({
  models: [
    { id: 'claude-sonnet-5-5', pricing: { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.3, cacheWrite5mPerMTok: 3.75, cacheWrite1hPerMTok: 6 } },
    { id: 'claude-opus-5-5', pricing: { inputPerMTok: 5, outputPerMTok: 25, cacheReadPerMTok: 0.5, cacheWrite5mPerMTok: 6.25, cacheWrite1hPerMTok: 10 } },
  ],
})

describe('/ai-dlc:lens-keepalive: kept-warm time and savings (pure)', () => {
  const v = (tracks: unknown[], enabled = true) => ({ enabled, updatedAt: 0, sessionId: 's', tracks })
  const tr = (name: string, running: boolean, armedAt: number, warmUntil: number, pings: number) => ({ name, running, armedAt, warmUntil, pings })

  test('noteKeepalive keeps one cycle per track arming, null when nothing changes, never a track not armed', () => {
    const a = noteKeepalive({}, v([tr('5m', true, T0, T0 + 300_000, 0), tr('1h', false, 0, 0, 0)]))!
    expect(Object.keys(a)).toEqual([`5m@${T0}`])
    expect(noteKeepalive(a, v([tr('5m', true, T0, T0 + 300_000, 0)]))).toBe(null)
    const b = noteKeepalive(a, v([tr('5m', true, T0, T0 + 540_000, 1)]))!
    expect(b[`5m@${T0}`]).toEqual({ track: '5m', armedAt: T0, warmUntil: T0 + 540_000, pings: 1 })
    const c = noteKeepalive(b, v([tr('5m', true, T0 + 900_000, T0 + 1_200_000, 0)]))!
    expect(Object.keys(c).sort()).toEqual([`5m@${T0}`, `5m@${T0 + 900_000}`].sort())
    for (const none of [undefined, null, 3, 'x', { tracks: 'x' }, v([null, 7, { name: '5m' }, tr('5m', true, 0, 9, 0), { name: 3, armedAt: 1 }])]) expect(noteKeepalive({}, none)).toBe(null)
    // The oldest go first past the cap.
    let many: Record<string, any> = {}
    for (let i = 1; i <= KEEPALIVE_CYCLES_KEPT + 3; i++) many = noteKeepalive(many, v([tr('5m', false, i, i + 1, 0)]))!
    expect(Object.keys(many).length).toBe(KEEPALIVE_CYCLES_KEPT)
    expect(many['5m@1']).toBe(undefined)
  })

  test('keptWarm: per track, each arming to its expiry, cut at the next arming and at now; both tracks always listed', () => {
    const cycles = noteKeepalive({}, v([tr('5m', false, T0, T0 + 540_000, 2)]))!
    // A later arming that starts before the first one expires cuts it there.
    const now = v([tr('5m', true, T0 + 400_000, T0 + 700_000, 1), tr('1h', false, 0, 0, 0)])
    expect(keptWarm(cycles, now, T0 + 600_000)).toEqual([
      { track: '5m', ms: 400_000 + 200_000, pings: 3, armings: 2, running: true },
      { track: '1h', ms: 0, pings: 0, armings: 0, running: false },
    ])
    // Keep-alive off: nothing runs, the time already kept still counts.
    expect(keptWarm(cycles, v([tr('5m', true, T0, T0 + 540_000, 2)], false), T0 + 10_000_000)[0]).toEqual({ track: '5m', ms: 540_000, pings: 2, armings: 1, running: false })
    expect(keptWarm({}, undefined, T0).map(w => [w.track, w.ms])).toEqual([
      ['5m', 0],
      ['1h', 0],
    ])
  })

  test('fmtSpan', () => {
    expect([0, -5, NaN, 999, 45_000, 750_000, 3_900_000, 90_000_000].map(fmtSpan)).toEqual(['0s', '0s', '0s', '0s', '45s', '12m 30s', '1h 05m', '25h 00m'])
  })

  test('savingsOfAgent: cache reads x (input - cache read), from the file only; — when a price is missing; long context per request', () => {
    const c = { path: '.ai-dlc/model-metadata.json', text: COSTING_ARRAY, error: '' }
    const t = { in: 1000, out: 10, cr: 2_000_000, cw: 0 }
    // 2M x (3 - 0.3) / 1M = 5.40
    expect(savingsOfAgent(c, 'claude-sonnet-5-5', [], t)).toMatchObject({ text: '$5.40' })
    expect(savingsOfAgent(c, 'claude-haiku-5-5', [], t)).toMatchObject({ usd: null, text: '—' })
    expect(savingsOfAgent(c, 'claude-haiku-5-5', [], { ...t, cr: 0 })).toMatchObject({ usd: 0, text: '$0.0000' })
    const noRead = JSON.stringify({ models: [{ id: 'm', pricing: { inputPerMTok: 3, outputPerMTok: 15 } }] })
    expect(savingsOfAgent({ ...c, text: noRead }, 'm', [], t)).toMatchObject({ usd: null, text: '—', source: '.ai-dlc/model-metadata.json has no cache read price for m' })
    // Long context: requests over 200K prompt tokens save at the long prices; the requests must add up to the totals.
    const long = JSON.stringify({
      models: [{ id: 'L', pricing: { inputPerMTok: 3, cacheReadPerMTok: 0.3, outputPerMTok: 15 }, longContextPricing: { thresholdTokens: 200_000, inputPerMTok: 6, cacheReadPerMTok: 0.6, outputPerMTok: 22.5 } }],
    })
    const r1 = { in: 0, out: 0, cr: 100_000, cw: 0 }
    const r2 = { in: 0, out: 0, cr: 300_000, cw: 0 }
    // 0.1M x 2.7 + 0.3M x 5.4 = 0.27 + 1.62
    expect(savingsOfAgent({ ...c, text: long }, 'L', [r1, r2], { in: 0, out: 0, cr: 400_000, cw: 0 })).toMatchObject({ text: '$1.89' })
    expect(savingsOfAgent({ ...c, text: long }, 'L', [r1], { in: 0, out: 0, cr: 400_000, cw: 0 })).toMatchObject({ usd: null, text: '—' })
  })

  test('sessionSavings: the sum, or — when any agent that read the cache has no figure', () => {
    expect(sessionSavings([{ usd: 0.45, text: '', source: '' }, { usd: 0.243, text: '', source: '' }])).toMatchObject({ text: '$0.6930' })
    expect(sessionSavings([{ usd: 0.45, text: '', source: '' }, { usd: null, text: '—', source: 'x is not in f' }])).toMatchObject({ usd: null, text: '—', source: '1 of 2 agents have no figure: x is not in f' })
  })
})

describe('/ai-dlc:* commands (step 8.1.4)', () => {
  test('the module registers no command of its own; each /ai-dlc:lens* name is answered by a command.run hook', async ($, on) => {
    const registered: string[] = []
    on('command.register', (_: unknown, e: any) => {
      registered.push(e.name)
      return { value: { command: e.name } }
    })
    const { opened } = await seed($, on)
    expect(registered).toEqual([])
    const lens: any = await ($.command.run as any)({ command: 'ai-dlc:lens', args: '' })
    expect(String(lens?.text)).toMatch(/^Lens card opened/)
    const kit: any = await ($.command.run as any)({ command: 'ai-dlc:lens-kit', args: '' })
    expect(String(kit?.text)).toMatch(/^Kit pane opened/)
    expect(opened).toEqual(expect.arrayContaining(['ai-dlc-lens', 'ai-dlc-lens-kit', 'ai-dlc-lens-chart']))
    // Every pane id is a valid PaneOpenArgs.id: 1-64 of letters, digits, _ and - (d.ts:7590).
    for (const id of opened) expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/)
  })

  test('/ai-dlc:lens-gate on|off sets gateAlert in lens.json (step 8.1.6.1); bare, it lists the anomalies; anything else is the usage', async ($, on) => {
    const { writes } = await seed($, on, { files: { 'docs/handoffs/R/run.md': RUN_R('build', 'in-progress', 'blocked') } })
    const bare: any = await ($.command.run as any)({ command: 'ai-dlc:lens-gate', args: '' })
    expect(String(bare?.text)).toMatch(/^gateAlert = true \[default\]: detection is on\.\nAnomalies \(1\):\n- Run blocked \(run R/)
    const off: any = await ($.command.run as any)({ command: 'ai-dlc:lens-gate', args: 'off' })
    expect(String(off?.text)).toMatch(/^\.ai-dlc\/lens\.json updated\. gateAlert = false \[\.ai-dlc\/lens\.json\]: detection is off\.$/)
    expect(JSON.parse(writes.filter(w => w.path === '.ai-dlc/lens.json').at(-1)!.text).gateAlert).toBe(false)
    const on2: any = await ($.command.run as any)({ command: 'ai-dlc:lens-gate', args: 'on' })
    expect(String(on2?.text)).toMatch(/gateAlert = true .*\nAnomalies \(1\):/)
    const bad: any = await ($.command.run as any)({ command: 'ai-dlc:lens-gate', args: 'maybe' })
    expect(String(bad?.text)).toMatch(/^Usage: \/ai-dlc:lens-gate \[on\|off\]/)
    // No marker file any more.
    expect(writes.some(w => /GATE-ALERT/.test(w.path))).toBe(false)
  })

  test('/ai-dlc:lens-keepalive: bare flips keepaliveSection in lens.json, on|off set it, anything else is the usage', async ($, on) => {
    const { files } = await seed($, on)
    const off: any = await ($.command.run as any)({ command: 'ai-dlc:lens-keepalive', args: '' })
    expect(String(off?.text)).toMatch(/^\.ai-dlc\/lens\.json updated: keepaliveSection = false\. The Cache keep-alive section is hidden/)
    expect(String(off?.text)).toMatch(/Kept warm: 5m 0s \(0 pings, 0 armings\) · 1h 0s \(0 pings, 0 armings\)\./)
    expect(JSON.parse(String(files['.ai-dlc/lens.json'])).keepaliveSection).toBe(false)
    const lp = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    await lp.press({ key: 'agent-a1' })
    await lp.unmount()
    const ag = await $.ui.mount({ ...pane('ai-dlc-lens-agent'), surface: 'vscode' })
    expect(await ag.find({ type: 'Button', key: 'agent-keepalive' })).toBe(undefined)
    await ag.unmount()
    const back: any = await ($.command.run as any)({ command: 'ai-dlc:lens-keepalive', args: '' })
    expect(String(back?.text)).toMatch(/keepaliveSection = true\. The Cache keep-alive section is shown/)
    const onAgain: any = await ($.command.run as any)({ command: 'ai-dlc:lens-keepalive', args: 'ON' })
    expect(String(onAgain?.text)).toMatch(/keepaliveSection = true/)
    const bad: any = await ($.command.run as any)({ command: 'ai-dlc:lens-keepalive', args: 'maybe' })
    expect(String(bad?.text)).toMatch(/^Usage: \/ai-dlc:lens-keepalive \[on\|off\]/)
  })

  test('/ai-dlc:lens-keepalive under a settings env that keeps it on: lens.json changes and the reply names the winner', async ($, on) => {
    await seed($, on, { files: { '.claude/settings.json': JSON.stringify({ env: { AI_DLC_LENS_KEEPALIVE_SECTION: 'true' } }) } })
    const r: any = await ($.command.run as any)({ command: 'ai-dlc:lens-keepalive', args: 'off' })
    expect(String(r?.text)).toMatch(/keepaliveSection = false\. The Cache keep-alive section is shown in the agent panes\. A higher level wins: \.claude\/settings\.json env\./)
  })
})

describe('/ai-dlc:lens-keepalive: the agent pane section (step 8.1.4)', () => {
  test('on by default, collapsed; opened it shows kept-warm time per track over armings and the savings of the agent and the session', { plugins: [kaTimed] }, async ($, on) => {
    await seed($, on, { files: { '.ai-dlc/model-metadata.json': COSTING_BOTH } })
    await $.command.run({ command: 'ka2-first' } as never)
    // The lens keeps the first arming at the next turn's start, before the next Stop arms again.
    await $.turn.start({ text: 'next', turnId: 'm2' })
    await $.command.run({ command: 'ka2-second' } as never)
    for (const surface of SURFACES) {
      const lp = await $.ui.mount({ ...pane('ai-dlc-lens'), surface })
      await lp.press({ key: 'agent-a1' })
      await lp.unmount()
      const ag = await $.ui.mount({ ...pane('ai-dlc-lens-agent'), surface })
      expect((await ag.find({ type: 'Button', key: 'agent-keepalive' }))?.text).toBe('[+]')
      // 9m of the first arming, then the second arming to its expiry (2m, already past): 11m.
      // Saved: main 100K x (5 - 0.5) + a1 90K x (3 - 0.3) = 0.45 + 0.243.
      expect(await ag.find({ type: 'Text', text: /^\s*Cache keep-alive \(5m 11m 00s · 1h 0s · saved \$0\.6930\)$/ })).toBeDefined()
      expect(await ag.find({ type: 'Text', text: /Kept warm, 5m track/ })).toBe(undefined)
      await ag.press({ key: 'agent-keepalive' })
      expect(await ag.find({ type: 'Text', text: '11m 00s (running) · 1 pings · 2 armings' })).toBeDefined()
      expect(await ag.find({ type: 'Text', text: '0s · 0 pings · 0 armings' })).toBeDefined()
      expect(await ag.find({ type: 'Text', text: '$0.2430' })).toBeDefined()
      expect(await ag.find({ type: 'Text', text: '$0.6930' })).toBeDefined()
      await ag.press({ key: 'agent-keepalive' })
      await ag.unmount()
    }
  })

  test('without ai-dlc and without prices: zero time, a note, and — for the savings; the pane draws as before', async ($, on) => {
    await seed($, on, { files: { '.ai-dlc/lens.json': JSON.stringify({ collapsedByDefault: false }) } })
    const lp = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    await lp.press({ key: 'agent-a1' })
    await lp.unmount()
    const ag = await $.ui.mount({ ...pane('ai-dlc-lens-agent'), surface: 'vscode' })
    expect(await ag.find({ type: 'Text', text: /^\s*Cache keep-alive \(5m 0s · 1h 0s · saved —\)$/ })).toBeDefined()
    expect(await ag.find({ type: 'Text', text: /^No keep-alive arming seen this session/ })).toBeDefined()
    expect(await ag.find({ type: 'Text', text: /lens hook error/ })).toBe(undefined)
    expect(await ag.find({ type: 'Button', key: 'agent-calls' })).toBeDefined()
    await ag.unmount()
  })

  test('keepaliveSection false: no section; the other four stay', async ($, on) => {
    await seed($, on, { files: { '.ai-dlc/lens.json': JSON.stringify({ keepaliveSection: false }) } })
    const lp = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    await lp.press({ key: 'agent-a1' })
    await lp.unmount()
    const ag = await $.ui.mount({ ...pane('ai-dlc-lens-agent'), surface: 'vscode' })
    expect(await ag.find({ type: 'Button', key: 'agent-keepalive' })).toBe(undefined)
    for (const k of ['agent-usage', 'agent-calls', 'agent-tasks', 'agent-thinking']) expect(await ag.find({ type: 'Button', key: k })).toBeDefined()
    await ag.unmount()
  })
})

// ---------------- step 1.5 (run AAW-20261023-lens-plugin-from-spike) ----------------
const RUN_MD = (title: string, status = 'active') => `---\nrun: ${title}\nstatus: ${status}\n---\n\n# Run: ${title}\n\n## Stages\n| Step | Stage | Agent | Status |\n|---|---|---|---|\n| 1 | change it | agent-manager | in-progress |\n`
const RUNS = { 'docs/handoffs/A/run.md': RUN_MD('run A'), 'docs/handoffs/B/run.md': RUN_MD('run B'), 'docs/handoffs/C/run.md': RUN_MD('run C') }
/** The brief of a spawn into run `run` (`docs/handoffs/<run>/`), its record on the first line as the orchestrator writes it. */
const runBrief = (run: string, code = '1') => `Your handoff record is docs/handoffs/${run}/${code}-orchestrator-to-agent-manager.handoff.md (root x).\nDo it.`
/** The orchestrator (main) spawns agent `a<n>` (call `toolu_<n>`) into run `run`; it keeps running. */
async function spawnInto($: any, n: number, run: string, code = '1') {
  // The view lists runs by when they started (step 29.1): each spawn starts in a later millisecond.
  await nextMs()
  const prompt = runBrief(run, code)
  await $.tool.call({ tool: 'Agent', subagent_type: 'ai-dlc:agent-manager', description: `d${n}`, prompt, tool_use_id: `toolu_${n}` })
  await $.agent.spawn({ tool_use_id: `toolu_${n}`, prompt, description: `d${n}`, subagentType: 'ai-dlc:agent-manager', provider: { plugin: 'ai-dlc', tier: 'user' }, parentModel: 'claude-opus-5-5', background: true, fork: false })
}
/** The workflow panels of the wide view, newest first. */
const panelKeys = async (ui: any): Promise<string[]> => ((await ui.findAll({ type: 'Button' })) as any[]).map((b: any) => String(b.key)).filter(k => /^wf-toolu_\d+$/.test(k))
/** The run rows of the narrow view, newest first. */
const runRows = async (ui: any): Promise<string[]> => ((await ui.findAll({ type: 'Button' })) as any[]).map((b: any) => String(b.key)).filter(k => /^run-toolu_\d+$/.test(k))
const wide = ($: any) => $.ui.mount({ ...pane(CHART_PANE, 'dock', 100), surface: 'vscode' })
const narrow = ($: any) => $.ui.mount({ ...pane(CHART_PANE, 'dock', 30), surface: 'vscode' })

describe('step 8.1.5: one workflow per run (AC-1.5.2 and the definitions)', () => {
  test('AC-1.5.2, the order observed: run A agent running, the orchestrator spawns run B agent: two workflows', async ($, on) => {
    await seed($, on, { complete: false, files: RUNS })
    // a1 (run R of the seed) is still running; the orchestrator spawns into a new run.
    await spawnInto($, 2, 'B')
    const ui = await wide($)
    expect(await panelKeys(ui)).toEqual(['wf-toolu_2', 'wf-toolu_1'])
    expect(await ui.find({ type: 'Text', text: 'run B' })).toBeDefined()
    await ui.unmount()
  })

  test('AC-1.5.2: run B spawned after run A finished: still two workflows', async ($, on) => {
    await seed($, on, { files: RUNS })
    await spawnInto($, 2, 'B')
    const ui = await wide($)
    expect(await panelKeys(ui)).toEqual(['wf-toolu_2', 'wf-toolu_1'])
    await ui.unmount()
  })

  test('definitions: a new run folder is a new workflow; a spawn into an active run listed earlier joins it, not the newest', async ($, on) => {
    await seed($, on, { complete: false, files: RUNS })
    await spawnInto($, 2, 'A')
    await spawnInto($, 3, 'B')
    // Back into run A, while run B is the newest and both still run.
    await spawnInto($, 4, 'A', '2')
    const ui = await wide($)
    expect(await panelKeys(ui)).toEqual(['wf-toolu_3', 'wf-toolu_2', 'wf-toolu_1'])
    await ui.press({ key: 'wf-toolu_2' })
    expect(await ui.find({ type: 'Text', text: /spawned 2 agents$/ })).toBeDefined()
    await ui.unmount()
  })

  test('definitions: a spawn into a done run joins that run (still its own, listed and dimmed), never a newer one', async ($, on) => {
    await seed($, on, { files: { ...RUNS, 'docs/handoffs/A/run.md': RUN_MD('run A', 'done') } })
    await spawnInto($, 2, 'A')
    await completeAgent($, 'a2')
    await spawnInto($, 3, 'B')
    let ui = await wide($)
    // Run A is done and its agent completed: listed, dimmed, completed dot.
    const doneTitle: any = await ui.find({ type: 'Text', text: 'run A' })
    expect(doneTitle?.props?.dimColor ?? doneTitle?.dimColor).toBe(true)
    await ui.unmount()
    await spawnInto($, 4, 'A', '2')
    ui = await wide($)
    expect(await panelKeys(ui)).toEqual(['wf-toolu_3', 'wf-toolu_2', 'wf-toolu_1'])
    await ui.press({ key: 'wf-toolu_2' })
    expect(await ui.find({ type: 'Text', text: /spawned 2 agents$/ })).toBeDefined()
    await ui.unmount()
  })

  test('joinWorkflow: the run decides, whatever the spawner; without a run, the same request joins and a different one does not', () => {
    const running = (id: string, call: string) => ({ id, toolUseId: call, status: 'running' }) as any
    let wf = joinWorkflow(WF0, 'main', 'c1', {}, {}, { c1: 'run:docs/handoffs/A' })
    // A's agent still runs; the main loop spawns into run B: a workflow of its own (AC-1.5.2).
    wf = joinWorkflow(wf, 'main', 'c2', { a1: running('a1', 'c1') }, { c1: 'a1' }, { c1: 'run:docs/handoffs/A', c2: 'run:docs/handoffs/B' })
    expect(wf.order).toEqual(['c1', 'c2'])
    // An agent of run A spawns into run B: run B's workflow, not its own (the run, never the spawner).
    wf = joinWorkflow(wf, 'a1', 'c3', { a1: running('a1', 'c1') }, { c1: 'a1' }, { c1: 'run:docs/handoffs/A', c2: 'run:docs/handoffs/B', c3: 'run:docs/handoffs/B' })
    expect(wf.of['c3']).toBe('c2')
    // No run named: the same request as c1 joins c1's workflow; another request is new.
    const keys = { c1: 'run:docs/handoffs/A', c2: 'run:docs/handoffs/B', c3: 'run:docs/handoffs/B', c4: 'req:Ship it', c5: 'req:Other' }
    wf = joinWorkflow(wf, 'main', 'c4', {}, {}, keys, { c1: 'Ship it' })
    expect(wf.of['c4']).toBe('c1')
    wf = joinWorkflow(wf, 'main', 'c5', {}, {}, keys, { c1: 'Ship it', c4: 'Ship it' })
    expect(wf.order).toEqual(['c1', 'c2', 'c5'])
  })
})

describe('step 8.1.5: a new run never hides an earlier one (AC-1.5.1), layout by width', () => {
  test('AC-1.5.1 wide: runs A, B, C: all three stacked on the right, A and B still openable; the selected run beside them', async ($, on) => {
    await seed($, on, { files: RUNS })
    await spawnInto($, 2, 'A')
    await spawnInto($, 3, 'B')
    await spawnInto($, 4, 'C')
    const ui = await wide($)
    expect(await panelKeys(ui)).toEqual(['wf-toolu_4', 'wf-toolu_3', 'wf-toolu_2', 'wf-toolu_1'])
    // The stack is a column of runListColumns on the right of a row whose left part is the selected run.
    const bs = await boxes(ui)
    expect(bs.some((b: any) => b.width === DEFAULTS.runListColumns)).toBe(true)
    // Step 30.1: the selected run's step charts (its spawn's step 1, and step 17 from its records on disk).
    const runChart = ((await ui.findAll({ type: 'Svg' })) as any[]).find((x: any) => String(x?.props?.alt ?? '') === 'Step chart 1: run C')
    expect(runChart).toBeDefined()
    // A and B: their panels open, and "show" puts each beside the list.
    for (const [w, title] of [['toolu_2', 'run A'], ['toolu_3', 'run B']] as const) {
      await ui.press({ key: `wf-${w}` })
      expect((await ui.find({ type: 'Button', key: `wf-${w}` }))?.text).toBe('[-]')
      await ui.press({ key: `wf-show-${w}` })
      const shown = ((await ui.findAll({ type: 'Svg' })) as any[]).find((x: any) => String(x?.props?.alt ?? '') === `Step chart 1: ${title}`)
      expect(shown).toBeDefined()
      expect((await ui.find({ type: 'Button', key: `wf-show-${w}` }))?.text).toBe('(shown)')
    }
    await ui.unmount()
  })

  test('AC-1.5.1 narrow: every run minimised to one row (dot and title); choosing A or B opens it; "< Runs" goes back', async ($, on) => {
    await seed($, on, { files: RUNS })
    await spawnInto($, 2, 'A')
    await spawnInto($, 3, 'B')
    await spawnInto($, 4, 'C')
    const ui = await narrow($)
    expect(await runRows(ui)).toEqual(['run-toolu_4', 'run-toolu_3', 'run-toolu_2', 'run-toolu_1'])
    expect(await panelKeys(ui)).toEqual([])
    expect((await statusSvgs(ui)).length).toBe(4)
    for (const [w, title] of [['toolu_2', 'run A'], ['toolu_3', 'run B']] as const) {
      await ui.press({ key: `run-${w}` })
      expect(await runRows(ui)).toEqual([])
      expect(await ui.find({ type: 'Text', text: title })).toBeDefined()
      expect(((await ui.findAll({ type: 'Svg' })) as any[]).some((x: any) => String(x?.props?.alt ?? '') === `Step chart 1: ${title}`)).toBe(true)
      await ui.press({ key: 'runs-back' })
      expect((await runRows(ui)).length).toBe(4)
    }
    await ui.unmount()
  })

  test('the breakpoint is the wideColumns setting: 30 columns are wide at wideColumns 20, narrow at the default', async ($, on) => {
    await seed($, on, { files: { ...RUNS, ...lensJson({ wideColumns: 20 }) } })
    const ui = await narrow($)
    expect(await panelKeys(ui)).toEqual(['wf-toolu_1'])
    expect(await runRows(ui)).toEqual([])
    await ui.unmount()
  })
})

describe('step 8.1.5: panels open as a tab or drill-in, from the card and the pane', () => {
  test('tab (the default): an avatar or arrow in the chat card opens the separate pane', async ($, on) => {
    const { opened } = await seed($, on)
    const card = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT))
    opened.length = 0
    await card.press({ key: 'card:agent-a1' })
    await card.press({ key: 'card:edge-a1' })
    expect(opened).toEqual(['ai-dlc-lens-agent', 'ai-dlc-lens-edge'])
    expect(await card.find({ type: 'Button', key: 'drill-back' })).toBe(undefined)
    await card.unmount()
  })

  test('drill-in (panelOpenMode in lens.json): the card shows the details in place, "< Back" returns to its chart; no pane opens', async ($, on) => {
    const { opened } = await seed($, on, { files: lensJson({ panelOpenMode: 'drill-in' }) })
    const card = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT))
    opened.length = 0
    await card.press({ key: 'card:agent-a1' })
    expect(opened).toEqual([])
    expect(await card.find({ type: 'Button', key: 'drill-back' })).toBeDefined()
    expect(await card.find({ type: 'Button', key: 'agent-view' })).toBeDefined()
    // The native row stays last, under the details.
    const all = await card.findAll({})
    expect(all.findIndex((x: any) => x.text === 'NATIVE ROW')).toBe(all.length - 1)
    await card.press({ key: 'drill-back' })
    expect(await card.find({ type: 'Button', key: 'card:agent-a1' })).toBeDefined()
    await card.press({ key: 'card:edge-a1' })
    expect(await card.find({ type: 'Text', text: /Hand-back \(/ })).toBeDefined()
    await card.unmount()
    // The workflow pane follows the same setting; its toggle switches to tab for the session.
    const wp = await chartPane($)
    expect((await wp.find({ type: 'Button', key: 'panel-drill-in' }))?.text).toBe('◉ Drill in')
    await wp.press({ key: 'panel-tab' })
    expect([(await wp.find({ type: 'Button', key: 'panel-tab' }))?.text, (await wp.find({ type: 'Button', key: 'panel-drill-in' }))?.text]).toEqual(['◉ Tab', '○ Drill in'])
    await wp.unmount()
  })
})

describe('step 8.1.5: the chart in the chat card and in the pane', () => {
  test('chartInChat false: the card is the line and "Open flowchart" only; the pane still draws the chart', async ($, on) => {
    await seed($, on, { files: lensJson({ chartInChat: false }) })
    const card = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT))
    expect(await card.find({ type: 'Svg' })).toBe(undefined)
    expect(await card.find({ type: 'Button', key: 'card:agent-a1' })).toBe(undefined)
    expect(await card.find({ type: 'Button', key: 'card-open-chart' })).toBeDefined()
    await card.unmount()
    const wp = await chartPane($)
    expect(await chartSvg(wp)).toBeDefined()
    await wp.unmount()
  })

  test('chartInPane false: no chart in the pane, the avatar and arrow Buttons stay; the card still draws its chart', async ($, on) => {
    await seed($, on, { files: lensJson({ chartInPane: false }) })
    const wp = await chartPane($)
    expect(await chartSvgs(wp)).toEqual([])
    // Step 30.1: each step chart keeps its heading and its Buttons.
    expect(await wp.find({ type: 'Text', text: /^Step 17/ })).toBeDefined()
    expect(await wp.find({ type: 'Button', key: 'agent-a1' })).toBeDefined()
    expect(await wp.find({ type: 'Button', key: 'edge-a1' })).toBeDefined()
    await wp.unmount()
    const card = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT))
    expect(((await card.findAll({ type: 'Svg' })) as any[]).some((x: any) => /^Chat chart/.test(String(x?.props?.alt ?? '')))).toBe(true)
    await card.unmount()
  })

  test('one chart per workflow: only the first call of the workflow draws it in the chat', async ($, on) => {
    await seed($, on, { parallel: true })
    const second = await $.ui.mount(toolRow('toolu_2', 'vscode', { subagent_type: 'ai-dlc:sqa-engineer', description: 'tests', prompt: 'p' }))
    expect(await second.find({ type: 'Svg' })).toBe(undefined)
    await second.unmount()
  })
})

describe('step 8.1.5: pane view controls', () => {
  test('full screen asks the whole viewport and fills the rows; minimise from full screen, restore returns to full screen, then to normal', async ($, on) => {
    const { openArgs } = await seed($, on)
    const ui = await $.ui.mount({ ...pane(CHART_PANE), surface: 'vscode', viewport: { columns: 200, rows: 50 } })
    expect(await ui.find({ type: 'Button', key: 'pane-restore' })).toBe(undefined)
    await ui.press({ key: 'pane-full' })
    const full = openArgs.filter((x: any) => x.id === CHART_PANE).at(-1)
    expect([full?.rows, full?.columns, full?.closeOnEscape]).toEqual([50, 200, true])
    expect((await boxes(ui))[0]?.minHeight).toBe(80)
    expect((await ui.find({ type: 'Button', key: 'pane-full' }))?.text).toBe('⤡')
    await ui.press({ key: 'pane-min' })
    expect(await ui.find({ type: 'Button', key: 'wf-toolu_1' })).toBe(undefined)
    expect(await ui.find({ type: 'Button', key: 'pane-restore' })).toBeDefined()
    await ui.press({ key: 'pane-restore' })
    // Back to full screen, the size before minimising.
    expect((await ui.find({ type: 'Button', key: 'pane-full' }))?.text).toBe('⤡')
    expect((await boxes(ui))[0]?.minHeight).toBe(80)
    await ui.press({ key: 'pane-restore' })
    // Back to normal: the open asks no size, so the surface's own applies; no filler.
    const normal = openArgs.filter((x: any) => x.id === CHART_PANE).at(-1)
    expect([normal?.rows, normal?.columns]).toEqual([undefined, undefined])
    expect((await boxes(ui)).some((b: any) => b.minHeight !== undefined)).toBe(false)
    expect(await ui.find({ type: 'Button', key: 'pane-restore' })).toBe(undefined)
    await ui.unmount()
  })

  test('pinned on a surface without the band (VS Code): it stays a pane and says so; docked re-opens the pane', async ($, on) => {
    const { openArgs, closed } = await seed($, on)
    const ui = await chartPane($, 'vscode', false)
    expect((await ui.find({ type: 'Button', key: 'pane-place' }))?.text).toBe('pinned')
    expect(await ui.find({ type: 'Text', text: /no band above the prompt/ })).toBeDefined()
    const before = openArgs.length
    await ui.press({ key: 'pane-place' })
    expect((await ui.find({ type: 'Button', key: 'pane-place' }))?.text).toBe('docked')
    expect(await ui.find({ type: 'Text', text: /no band above the prompt/ })).toBe(undefined)
    expect(openArgs.slice(before).map((x: any) => x.id)).toEqual([CHART_PANE])
    expect(closed).not.toContain(CHART_PANE)
    await ui.unmount()
  })

  test('pinned where every surface draws the band (terminal): no pane opens on the first spawn; the band draws the view; docked opens the pane and the band passes', async ($, on) => {
    on('session.surfaces', () => ({ value: ['terminal'] }))
    const { opened, closed } = await seed($, on)
    expect(opened).not.toContain(CHART_PANE)
    expect(closed).toContain(CHART_PANE)
    const band = () => $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { offset: 0, bodyRows: 20 }, view: {} } } as any)
    let b = await band()
    expect(await b.find({ type: 'Button', key: 'wf-toolu_1' })).toBeDefined()
    expect(await b.find({ type: 'Button', key: 'pane-close' })).toBe(undefined)
    // The tree beneath stays, under the view.
    const all = await b.findAll({})
    expect(all.findIndex((x: any) => x.text === 'NATIVE ROW')).toBe(all.length - 1)
    await b.press({ key: 'pane-place' })
    expect(opened).toContain(CHART_PANE)
    await b.unmount()
    b = await band()
    expect(await b.find({ type: 'Button', key: 'wf-toolu_1' })).toBe(undefined)
    expect(await b.find({ type: 'Text', text: 'NATIVE ROW' })).toBeDefined()
    await b.unmount()
  })

  test('pinned band over core\'s own drawing (an engine node from next): the tree validates and the view draws above it', async ($, on) => {
    // Beneath the band stands core's own drawing, `{ type: 'engine', ref: 0 }`, as in a session where nothing
    // else draws there. A Box with `width` may not hold an engine node (repaint2.log, 2026-10-25): the hook was
    // skipped and the view never drew.
    on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'engine', ref: 0 }) as any)
    on('session.surfaces', () => ({ value: ['terminal'] }))
    await seed($, on)
    const b = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { offset: 0, bodyRows: 20 }, view: {} } } as any)
    expect(await b.find({ type: 'Button', key: 'wf-toolu_1' })).toBeDefined()
    expect(await b.find({ type: 'Text', text: 'NATIVE ROW' })).toBe(undefined)
    await b.unmount()
  })

  test('a survey holding the band: the view yields', async ($, on) => {
    on('session.surfaces', () => ({ value: ['terminal'] }))
    await seed($, on)
    const b = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: true, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { offset: 0, bodyRows: 20 }, view: {} } } as any)
    expect(await b.find({ type: 'Button', key: 'wf-toolu_1' })).toBe(undefined)
    await b.unmount()
  })

  test('viewResize / viewRestore / openSizeOf / layoutOf / openModeOf / bandEverywhere', () => {
    let v = VIEW0
    v = viewResize(v, 'fullscreen')
    v = viewResize(v, 'minimised')
    expect([v.size, v.prev]).toEqual(['minimised', ['normal', 'fullscreen']])
    v = viewRestore(v)
    expect([v.size, v.prev]).toEqual(['fullscreen', ['normal']])
    v = viewRestore(v)
    expect([v.size, v.prev]).toEqual(['normal', []])
    expect(viewRestore(v).size).toBe('normal')
    expect(viewResize(v, 'normal')).toBe(v)
    expect(placeOf(VIEW0, 'pinned')).toBe('pinned')
    expect(placeOf({ ...VIEW0, place: 'docked' }, 'pinned')).toBe('docked')
    expect(openSizeOf('fullscreen', { columns: 120, rows: 40 })).toEqual({ rows: 40, columns: 120 })
    expect(openSizeOf('normal', { columns: 120, rows: 40 })).toEqual({})
    expect(openSizeOf('fullscreen', undefined)).toEqual({})
    expect([layoutOf(30, 70), layoutOf(70, 70), layoutOf(undefined, 70)]).toEqual(['narrow', 'wide', 'wide'])
    expect([openModeOf('', 'tab'), openModeOf('', 'drill-in'), openModeOf('tab', 'drill-in')]).toEqual(['tab', 'drill-in', 'tab'])
    expect([bandEverywhere([]), bandEverywhere(['terminal']), bandEverywhere(['terminal', 'vscode']), bandEverywhere(['desktop'])]).toEqual([false, true, false, true])
    expect(selectedOf({ ...VIEW0, selected: 'gone' }, ['b', 'a'])).toBe('b')
  })
})

// ---------------- step 1.6.1: /ai-dlc:lens-gate detects anomalies ----------------
const runMd = (status: string, gates = '') =>
  `---\nrun: R\nstatus: ${status}\ncurrent-stage: build\nlast-record: 17-orchestrator-to-agent-manager.handoff.md\n---\n\n# Run: R — the lens spike\n\n## Stages\n| Step | Stage | Agent | Status |\n|---|---|---|---|\n| 17 | build | agent-manager | in-progress |\n` +
  (gates === '' ? '' : `\n## Gates and loops\n| Gate or loop | Approver / round | Decision | By | Date |\n|---|---|---|---|---|\n${gates}\n`)
const hb = (verification: string, first: string) => `---\nrun: R\nverification: ${verification}\n---\n\n${first}\n`
const S0 = { ...DEFAULTS } as any
const kinds = (l: readonly { kind: string }[]) => l.map(x => x.kind)

describe('step 8.1.6.1: anomaly detection (pure)', () => {
  test('a healthy run, a done run and an abandoned run report nothing; a blocked run is red', () => {
    const files = [{ name: '17-orchestrator-to-agent-manager.handoff.md', text: '' }, { name: '17-agent-manager-to-orchestrator.handback.md', text: hb('passed', 'handoff 17-orchestrator-to-agent-manager.handoff.md: passed — ok') }]
    expect(detectRun('R', runMd('active'), files, 1).list).toEqual([])
    expect(detectRun('R', runMd('done', '| G1 | human | rejected | h | d |'), files, 1).list).toEqual([])
    expect(detectRun('R', runMd('abandoned'), [{ name: '17-a-to-b.handback.md', text: hb('failed', 'x') }], 1).list).toEqual([])
    const b = detectRun('R', runMd('blocked'), files, 7).list
    expect(b).toEqual([{ key: 'runBlocked:R', kind: 'runBlocked', run: 'R', step: 'build', record: '17-orchestrator-to-agent-manager.handoff.md', agent: '', target: '', text: '', since: 7 }])
    expect(colorOf('runBlocked', S0)).toBe('#c62828')
  })

  test('gates: waiting for the human (orange) until decided; rejected (red); the last row of a gate decides; an orchestrator gate never waits', () => {
    const w = detectRun('R', runMd('active', '| G1 | human | — | | |'), [], 1).list
    expect(kinds(w)).toEqual(['gateWaiting'])
    expect(w[0]!.step).toBe('G1')
    expect(colorOf('gateWaiting', S0)).toBe('#ef6c00')
    expect(detectRun('R', runMd('active', '| G1 | human | approved | h | d |'), [], 1).list).toEqual([])
    expect(detectRun('R', runMd('active', '| G2 | orchestrator | | | |'), [], 1).list).toEqual([])
    for (const d of ['rejected', 'not approved: redo AC-3', 'declined', 'no-go'])
      expect(kinds(detectRun('R', runMd('active', `| G2 | human | ${d} | h | d |`), [], 1).list)).toEqual(['gateRejected'])
    expect(colorOf('gateRejected', S0)).toBe('#c62828')
    // Rejected, then approved after the fix: cleared.
    expect(detectRun('R', runMd('active', '| G2 | human | rejected | h | d |\n| G2 | human | approved | h | d |'), [], 1).list).toEqual([])
  })

  test('the newest record addressed to the human is a gate waiting; a decision for its gate or a later record clears it', () => {
    const toHuman = { name: '4-orchestrator-to-human.handoff.md', text: '---\nto: human\ngate: G3\n---\n' }
    const w = detectRun('R', runMd('active'), [{ name: '3-a-to-b.handback.md', text: hb('passed', 'ok') }, toHuman], 1).list
    expect(w.map(x => [x.kind, x.step, x.record])).toEqual([['gateWaiting', 'G3', '4-orchestrator-to-human.handoff.md']])
    expect(detectRun('R', runMd('active', '| G3 | human | approved | h | d |'), [toHuman], 1).list).toEqual([])
    expect(detectRun('R', runMd('active'), [toHuman, { name: '5-orchestrator-to-software-engineer.handoff.md', text: '' }], 1).list).toEqual([])
    // A gate row and its record are one anomaly, not two.
    expect(kinds(detectRun('R', runMd('active', '| G3 | human | | | |'), [toHuman], 1).list)).toEqual(['gateWaiting'])
  })

  test('a loop out of rounds (deep orange) until the human raises the limits or accepts the findings', () => {
    const used = '| review → build (stopped at `3.l1`) | limits used up, findings open | asked the human | orchestrator | d |'
    const l = detectRun('R', runMd('active', used), [], 1).list
    expect(l.map(x => [x.kind, x.step])).toEqual([['loopOutOfRounds', 'review → build']])
    expect(colorOf('loopOutOfRounds', S0)).toBe('#d84315')
    expect(detectRun('R', runMd('active', used.replace('asked the human', 'raised for this run only to maxRounds 3')), [], 1).list).toEqual([])
    expect(detectRun('R', runMd('active', `${used}\n| review → build | round 3 / 3 · failure 1 / 2 | Blockers sent back as 3.l2 | orchestrator | d |`), [], 1).list).toEqual([])
    expect(detectRun('R', runMd('active', '| review → build | round 1 / 2 · failure 1 / 1 | Blockers sent back as `3.l1` | orchestrator | d |'), [], 1).list).toEqual([])
  })

  test('a hand-back that failed its check (yellow): front matter or first line; a newer round of the same step clears it', () => {
    const f1 = { name: '3-sqa-engineer-to-orchestrator.handback.md', text: hb('failed — AC-2 missing', 'handoff 3-orchestrator-to-sqa-engineer.handoff.md: failed — AC-2 missing') }
    const r = detectRun('R', runMd('active'), [f1], 1).list
    expect(r.map(x => [x.kind, x.step, x.record, x.target])).toEqual([['handbackFailed', '3', f1.name, 'edge']])
    expect(colorOf('handbackFailed', S0)).toBe('#f9a825')
    expect(handbackFailed(hb('pending', 'handoff 3-x.handoff.md: failed — y'))).toBe(true)
    expect(handbackFailed(hb('passed — "handoff x: passed"', 'handoff x: passed'))).toBe(false)
    expect(handbackFailed('no front matter at all\nfailed')).toBe(false)
    const fixed = { name: '3.l1-sqa-engineer-to-orchestrator.handback.md', text: hb('passed', 'handoff 3.l1-orchestrator-to-sqa-engineer.handoff.md: passed') }
    expect(detectRun('R', runMd('active'), [f1, fixed], 1).list).toEqual([])
    const again = { ...fixed, text: hb('failed', 'x') }
    expect(detectRun('R', runMd('active'), [f1, again], 1).list.map(x => x.record)).toEqual([again.name])
  })

  test('defensive: garbage, no front matter, unreadable records and odd tables never throw and report nothing', () => {
    for (const text of ['', 'garbage', '---\nunterminated', '| a | b |\n|---|\n| → | | |', '---\nstatus: active\n---\n## Gates and loops\n| x |\n|--|\n| y |'])
      expect(() => detectRun('R', text, [{ name: '1-a-to-b.handback.md', text: null }, { name: 'not-a-record.md', text: 'x' }], 1)).not.toThrow()
    const g = detectRun('R', 'garbage', [], 1)
    expect(g.list).toEqual([])
    expect(g.skipped).toEqual(['R/run.md: no front matter'])
    expect(detectRun('R', runMd('active'), [{ name: '1-a-to-b.handback.md', text: null }], 1).skipped).toEqual(['R/1-a-to-b.handback.md: not readable'])
    expect(detectRun('R', null, [], 1)).toEqual({ list: [], skipped: [] })
  })

  test('agents: failed or stopped, killed, waiting too long (red); a later agent of the type for the run clears a failure', () => {
    const ag = (id: string, status: string, extra: Partial<LensAgent> = {}): LensAgent =>
      ({ id, parent: 'main', type: 'ai-dlc:software-engineer', name: '', description: '', model: '', callModel: '', parentModel: '', prompt: '', status, toolUseId: id, steps: { in: 0, out: 0, cr: 0, cw: 0 }, turns: { in: 0, out: 0, cr: 0, cw: 0 }, last: null, handoff: 'docs/handoffs/R/3-orchestrator-to-software-engineer.handoff.md', handoffHow: 'first line', loop: false, startedAt: 10, endedAt: null, bg: [], reqs: [], ...extra }) as LensAgent
    expect(kinds(detectAgents({ a: ag('a', 'failed') }, {}, 100, 30))).toEqual(['agentFailed'])
    expect(kinds(detectAgents({ a: ag('a', 'stopped') }, {}, 100, 30))).toEqual(['agentFailed'])
    const k = detectAgents({ a: ag('a', 'killed') }, {}, 100, 30)
    expect(k.map(x => [x.kind, x.run, x.step, x.agent, x.target])).toEqual([['agentKilled', 'docs/handoffs/R', '3', 'a', 'agent']])
    expect(detectAgents({ a: ag('a', 'failed'), b: ag('b', 'running', { startedAt: 20 }) }, {}, 100, 30)).toEqual([])
    expect(kinds(detectAgents({ a: ag('a', 'failed'), b: ag('b', 'running', { startedAt: 20, handoff: 'docs/handoffs/S/1-o-to-software-engineer.handoff.md' }) }, {}, 100, 30))).toEqual(['agentFailed'])
    expect(detectAgents({ a: ag('a', 'completed'), r: ag('r', 'running') }, {}, 100, 30)).toEqual([])
    // Waiting: first seen at 0; 29 minutes later fine, 30 minutes later an anomaly; running again clears it.
    let since = trackWaiting({ a: ag('a', 'waiting') }, {}, 0)
    expect(since).toEqual({ a: 0 })
    since = trackWaiting({ a: ag('a', 'waiting') }, since, 29 * 60_000)
    expect(detectAgents({ a: ag('a', 'waiting') }, since, 29 * 60_000, 30)).toEqual([])
    expect(kinds(detectAgents({ a: ag('a', 'waiting') }, since, 30 * 60_000, 30))).toEqual(['agentWaitingLong'])
    expect(trackWaiting({ a: ag('a', 'running') }, since, 31 * 60_000)).toEqual({})
    expect(colorOf('agentFailed', S0)).toBe('#c62828')
    expect(colorOf('agentKilled', S0)).toBe('#c62828')
    expect(colorOf('agentWaitingLong', S0)).toBe('#c62828')
  })

  test('reported once: diffAnomalies keeps the first-seen time, names only new keys, drops what cleared; settings filter; the worst wins', () => {
    const a = { key: 'runBlocked:R', kind: 'runBlocked', run: 'R', step: '', record: '', agent: '', target: '', text: '', since: 1 }
    const b = { ...a, key: 'handbackFailed:R/x', kind: 'handbackFailed', since: 2 }
    const one = diffAnomalies([], [a])
    expect(one.appeared.map(x => x.key)).toEqual(['runBlocked:R'])
    const two = diffAnomalies(one.list, [{ ...a, since: 9 }, b])
    expect(two.appeared.map(x => x.key)).toEqual(['handbackFailed:R/x'])
    expect(two.list[0]!.since).toBe(1)
    const gone = diffAnomalies(two.list, [b])
    expect([gone.list.map(x => x.key), gone.appeared]).toEqual([['handbackFailed:R/x'], []])
    // Back again after it cleared: reported again.
    expect(diffAnomalies(gone.list, [a, b]).appeared.map(x => x.key)).toEqual(['runBlocked:R'])
    expect(applySettings([a, b], { ...S0, gateAlert: false })).toEqual([])
    expect(applySettings([a, b], { ...S0, anomalyRunBlocked: false }).map(x => x.kind)).toEqual(['handbackFailed'])
    expect(worstOf([b, a])?.kind).toBe('runBlocked')
    expect(worstOf([])).toBe(null)
    expect(anomalyLine({ ...a, run: 'docs/handoffs/R', step: '3', record: '3-a-to-b.handback.md' })).toBe('Run blocked (run R, step 3, 3-a-to-b.handback.md)')
    for (const k of Object.keys(CHECKS)) {
      expect(typeof (DEFAULTS as any)[(CHECKS as any)[k].enable]).toBe('boolean')
      expect(String((DEFAULTS as any)[(CHECKS as any)[k].color])).toMatch(/^#[0-9a-f]{6}$/)
    }
    expect([DEFAULTS.gateAlert, DEFAULTS.anomalyWaitingMinutes]).toEqual([true, 30])
  })
})

describe('step 8.1.6.1: anomaly detection (in the lens)', () => {
  test('nothing fires on a healthy run: no toast on Stop, no marker, no Anomalies section', async ($, on) => {
    const { toasts } = await seed($, on, { complete: false, files: { 'docs/handoffs/R/run.md': RUN_R('build') } })
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
    expect(toasts).toEqual([])
    const wp = await chartPane($)
    expect(await wp.find({ type: 'Button', key: 'anomalies' })).toBe(undefined)
    expect(await wp.find({ type: 'Text', text: /▲/ })).toBe(undefined)
    await wp.unmount()
  })

  test('a blocked run: one toast when it appears, never on each Stop; a red marker on its panel, the Anomalies section collapsed; both go when it clears', async ($, on) => {
    const { toasts, files } = await seed($, on, { complete: false, files: { 'docs/handoffs/R/run.md': runMd('blocked') } })
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
    expect(toasts.filter(x => /Run blocked/.test(x))).toEqual(['ai-dlc-lens: Run blocked (run R, step build, 17-orchestrator-to-agent-manager.handoff.md)'])
    const wp = await chartPane($, 'vscode', false)
    const marks: any[] = (await wp.findAll({ type: 'Text' })).filter((x: any) => /^▲/.test(String(x.text)))
    expect(marks.length).toBeGreaterThan(0)
    expect(marks.every((x: any) => (x.props?.color ?? x.color) === '#c62828')).toBe(true)
    // The marker is not the status dot: the dot stays an Svg (a blocked run halts it), the marker a Text.
    expect(await statusSvgs(wp)).toContain('status: halted')
    expect((await wp.find({ type: 'Button', key: 'anomalies' }))?.text).toBe('[+]')
    expect(await wp.find({ type: 'Text', text: /^\s*Anomalies \(1\)$/ })).toBeDefined()
    expect(await wp.find({ type: 'Text', text: /^Run blocked \(run R/ })).toBe(undefined)
    await wp.press({ key: 'anomalies' })
    expect(await wp.find({ type: 'Text', text: /^Run blocked \(run R/ })).toBeDefined()
    // The orchestrator unblocks the run: the next write clears it.
    files['docs/handoffs/R/run.md'] = runMd('active')
    await $.tool.call({ tool: 'Edit', file_path: 'docs/handoffs/R/run.md', old_string: 'a', new_string: 'b', tool_use_id: 'toolu_e' })
    expect(await wp.find({ type: 'Button', key: 'anomalies' })).toBe(undefined)
    expect((await wp.findAll({ type: 'Text' })).some((x: any) => /^▲/.test(String(x.text)))).toBe(false)
    // Blocked again: reported again, once.
    files['docs/handoffs/R/run.md'] = runMd('blocked')
    await $.tool.call({ tool: 'Write', file_path: 'docs/handoffs/R/run.md', content: 'x', tool_use_id: 'toolu_w2' })
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
    expect(toasts.filter(x => /Run blocked/.test(x)).length).toBe(2)
    await wp.unmount()
  })

  test('a gate waiting (orange) and a loop out of rounds (deep orange): the run marker takes the worst colour', async ($, on) => {
    const gates = '| G1 | human | waiting | | |\n| review → build | limits used up, findings open | asked the human | orchestrator | d |'
    const { toasts } = await seed($, on, { complete: false, files: { 'docs/handoffs/R/run.md': runMd('active', gates) } })
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
    expect(toasts.length).toBe(1)
    expect(toasts[0]).toMatch(/^ai-dlc-lens: (Gate waiting for the human|Loop out of rounds).*\(\+1 more: \/ai-dlc:lens-gate\)$/)
    const wp = await chartPane($, 'vscode', false)
    const panelMark: any = (await wp.findAll({ type: 'Text' })).find((x: any) => String(x.text) === '▲2')
    expect(panelMark?.props?.color ?? panelMark?.color).toBe('#d84315')
    await wp.press({ key: 'anomalies' })
    expect(await wp.find({ type: 'Text', text: /^Gate waiting for the human \(run R, step G1\)$/ })).toBeDefined()
    expect(await wp.find({ type: 'Text', text: /^Loop out of rounds \(run R, step review → build\)/ })).toBeDefined()
    await wp.unmount()
  })

  test('a gate rejected (red), from the run state', async ($, on) => {
    const { toasts } = await seed($, on, { complete: false, files: { 'docs/handoffs/R/run.md': runMd('active', '| G2 | human | rejected: AC-3 is wrong | h | d |') } })
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
    expect(toasts).toEqual(['ai-dlc-lens: Gate rejected (run R, step G2): rejected: AC-3 is wrong'])
  })

  test('an agent that failed: a red marker on its avatar Button; a respawn of its type for the run clears it', async ($, on) => {
    const { toasts } = await seed($, on, { complete: false, files: { 'docs/handoffs/R/run.md': RUN_R('build') } })
    await $.turn.complete({ reason: 'error', answer: '', durationMs: 1, isAborted: false, turnId: 't', agentId: 'a1', usage: null } as any)
    expect(toasts).toEqual(['ai-dlc-lens: Agent failed or stopped (run R, step 17, 17-orchestrator-to-agent-manager.handoff.md): failed'])
    const wp = await chartPane($)
    const btn: any = await wp.find({ type: 'Button', key: 'agent-a1' })
    expect(String(btn?.text)).toMatch(/^▲David Fowler$/)
    expect(String((await wp.find({ type: 'Button', key: 'edge-a1' }))?.text)).not.toMatch(/▲/)
    await wp.unmount()
    // The orchestrator runs the stage again: a new software-engineer for run R.
    await $.agent.spawn({ tool_use_id: 'toolu_3', prompt: `Your handoff record is ${RECORD} (root x).\nAgain.`, description: 'again', subagentType: 'ai-dlc:software-engineer', provider: { plugin: 'ai-dlc', tier: 'user' }, parentModel: 'claude-opus-5-5', background: false, fork: false })
    const wp2 = await chartPane($)
    expect((await wp2.findAll({ type: 'Text' })).some((x: any) => /^▲/.test(String(x.text)))).toBe(false)
    await wp2.unmount()
  })

  test('an agent killed (turn aborted) is red', async ($, on) => {
    const { toasts } = await seed($, on, { complete: false })
    await $.turn.complete({ reason: 'aborted', answer: '', durationMs: 1, isAborted: true, turnId: 't', agentId: 'a1', usage: null } as any)
    expect(toasts.map(x => x.replace(/ \(.*$/, ''))).toEqual(['ai-dlc-lens: Agent killed'])
  })

  test('an agent waiting too long (anomalyWaitingMinutes 0: at once) is red, reported once (clearing: the pure trackWaiting test)', async ($, on) => {
    const { toasts } = await seed($, on, { complete: false, listStatus: 'waiting', files: lensJson({ anomalyWaitingMinutes: 0 }) })
    await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' }).then(async ui => {
      await ui.press({ key: 'agent-a1' })
      await ui.unmount()
    })
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
    expect(toasts.filter(x => /Agent waiting too long/.test(x)).length).toBe(1)
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
    expect(toasts.filter(x => /Agent waiting too long/.test(x)).length).toBe(1)
  })

  test('a hand-back that failed its check: a yellow marker on the arrow of its record', async ($, on) => {
    const failed = 'docs/handoffs/R/17-agent-manager-to-orchestrator.handback.md'
    const { toasts } = await seed($, on, { complete: false, files: { 'docs/handoffs/R/run.md': RUN_R('build'), [failed]: hb('failed', 'handoff 17-orchestrator-to-agent-manager.handoff.md: failed — no AC list') } })
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
    expect(toasts).toEqual(['ai-dlc-lens: Hand-back failed its check (run R, step 17, 17-agent-manager-to-orchestrator.handback.md)'])
    const wp = await chartPane($)
    const edge: any = await wp.find({ type: 'Button', key: 'edge-a1' })
    expect(String(edge?.text)).toMatch(/^▲17 Scott Hanselman -> David Fowler$/)
    const mark: any = (await wp.findAll({ type: 'Text' })).find((x: any) => String(x.text) === '▲')
    expect(mark?.props?.color ?? mark?.color).toBe('#f9a825')
    await wp.unmount()
  })

  test('settings: a check turned off is not reported; a colour setting colours the marker; gateAlert false reports nothing', async ($, on) => {
    const { toasts } = await seed($, on, { complete: false, files: { 'docs/handoffs/R/run.md': runMd('blocked', '| G1 | human | | | |'), ...lensJson({ anomalyRunBlocked: false, anomalyGateWaitingColor: '#123456' }) } })
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
    expect(toasts.map(x => x.replace(/ \(.*$/, ''))).toEqual(['ai-dlc-lens: Gate waiting for the human'])
    const wp = await chartPane($, 'vscode', false)
    const mark: any = (await wp.findAll({ type: 'Text' })).find((x: any) => String(x.text) === '▲')
    expect(mark?.props?.color ?? mark?.color).toBe('#123456')
    await wp.unmount()
    await ($.command.run as any)({ command: 'ai-dlc:lens-gate', args: 'off' })
    const wp2 = await chartPane($, 'vscode', false)
    expect(await wp2.find({ type: 'Button', key: 'anomalies' })).toBe(undefined)
    await wp2.unmount()
  })

  test('a malformed run.md and an unreadable hand-back never throw and never blank the pane; the skip is listed', async ($, on) => {
    await seed($, on, { complete: false, files: { 'docs/handoffs/R/run.md': '| broken | table\n---\nno front matter' }, list: { 'docs/handoffs/R': ['17-agent-manager-to-orchestrator.handback.md', '9-x-to-y.handback.md'] } })
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
    const wp = await chartPane($)
    expect(await chartSvg(wp)).toBeDefined()
    expect(await wp.find({ type: 'Text', text: /lens hook error/ })).toBe(undefined)
    await wp.unmount()
    const r: any = await ($.command.run as any)({ command: 'ai-dlc:lens-gate', args: '' })
    expect(String(r?.text)).toMatch(/No anomalies\.\nskipped: docs\/handoffs\/R\/run\.md: no front matter/)
    expect(String(r?.text)).toMatch(/skipped: docs\/handoffs\/R\/9-x-to-y\.handback\.md: not readable/)
  })
})

// ---------------- step 1.6.1.l1: blocked steps and anomalyRunScope ----------------
const STEP_ROWS =
  '| 17 | build | agent-manager | done (passed) | `17-agent-manager-to-orchestrator.handback.md` |\n' +
  '| 18 | docs | documentation-writer | blocked · waiting on G2 | `18-orchestrator-to-documentation-writer.handoff.md` |\n' +
  '| 19 | review | code-reviewer | in-progress | — |\n| 20 | release | devops-engineer | pending | — |'
const runSteps = (status: string, rows = STEP_ROWS) =>
  `---\nrun: R\nstatus: ${status}\ncurrent-stage: review\nlast-record: 19-orchestrator-to-code-reviewer.handoff.md\n---\n\n# Run: R — the lens spike\n\n## Stages\n| Step | Stage | Agent | Status | Record |\n|---|---|---|---|---|\n${rows}\n`

describe('step 8.1.6.1.l1: blocked steps and which runs are read (pure)', () => {
  test('a blocked step in an active run: reported once, red, named by run and step; cleared when its row changes', () => {
    const l = detectRun('R', runSteps('active'), [], 5).list
    expect(l).toEqual([
      { key: 'stepBlocked:R:18', kind: 'stepBlocked', run: 'R', step: '18', record: '18-orchestrator-to-documentation-writer.handoff.md', agent: '', target: '', text: 'docs: waiting on G2', since: 5 },
    ])
    expect(applySettings(l, S0)).toEqual(l)
    expect(colorOf('stepBlocked', S0)).toBe('#c62828')
    expect(anomalyLine(l[0]!)).toBe('Step blocked (run R, step 18, 18-orchestrator-to-documentation-writer.handoff.md): docs: waiting on G2')
    // Two blocked steps: one anomaly each. The same step listed twice: once.
    const two = STEP_ROWS.replace('| 19 | review | code-reviewer | in-progress |', '| 19 | review | code-reviewer | **blocked** |') + '\n| 18 | docs | documentation-writer | blocked | x |'
    expect(detectRun('R', runSteps('active', two), [], 5).list.map(x => x.key)).toEqual(['stepBlocked:R:18', 'stepBlocked:R:19'])
    // Unblocked: the anomaly goes; diffAnomalies drops it.
    const cleared = detectRun('R', runSteps('active', STEP_ROWS.replace('blocked · waiting on G2', 'in-progress')), [], 6).list
    expect(cleared).toEqual([])
    expect(diffAnomalies(l, cleared).list).toEqual([])
    // A status that only mentions blocked later is not blocked; nor is a done run's blocked row.
    expect(detectRun('R', runSteps('active', '| 18 | docs | dw | done (was blocked) | x |'), [], 1).list).toEqual([])
    expect(detectRun('R', runSteps('done'), [], 1).list).toEqual([])
    expect([DEFAULTS.anomalyStepBlocked, DEFAULTS.anomalyStepBlockedColor, DEFAULTS.anomalyRunScope]).toEqual([true, '#c62828', 'session'])
  })

  test('a blocked step in a blocked run: no duplicate (the run anomaly names its steps); with anomalyRunBlocked off the step is reported', () => {
    const l = detectRun('R', runSteps('blocked'), [], 1).list
    expect(kinds(l)).toEqual(['runBlocked', 'stepBlocked'])
    const shown = applySettings(l, S0)
    expect(shown.map(x => [x.kind, x.text])).toEqual([['runBlocked', 'blocked step 18']])
    expect(kinds(applySettings(l, { ...S0, anomalyRunBlocked: false }))).toEqual(['stepBlocked'])
    expect(kinds(applySettings(l, { ...S0, anomalyStepBlocked: false }))).toEqual(['runBlocked'])
    // A step of another run is never hidden by this run being blocked; the same key twice counts once.
    const other = { ...l[1]!, key: 'stepBlocked:S:18', run: 'S' }
    expect(applySettings([...l, other, other], S0).map(x => x.key)).toEqual(['runBlocked:R', 'stepBlocked:S:18'])
  })

  test('anomalyRunScope: session reads the briefs\' runs only; all adds every active or blocked run, never done, abandoned or another status', () => {
    const scanned = [
      { dir: 'docs/handoffs/R', status: 'active' },
      { dir: 'docs/handoffs/X', status: 'blocked' },
      { dir: 'docs/handoffs/Y', status: 'done' },
      { dir: 'docs/handoffs/Z', status: 'abandoned' },
      { dir: 'docs/handoffs/P', status: 'paused' },
      { dir: 'docs/handoffs/Q', status: ' Active ' },
    ]
    expect(runsToRead('session', ['docs/handoffs/R'], scanned)).toEqual(['docs/handoffs/R'])
    expect(runsToRead('all', ['docs/handoffs/R', './docs/handoffs/R/'], scanned)).toEqual(['docs/handoffs/R', 'docs/handoffs/X', 'docs/handoffs/Q'])
    expect(runsToRead('all', [], [{ dir: '.\\docs\\handoffs\\X\\', status: 'blocked' }])).toEqual(['docs/handoffs/X'])
    // Where the runs are: artifacts.handoffs before its first placeholder; the default otherwise.
    const wf = (h: unknown) => JSON.stringify({ artifacts: { handoffs: h } })
    expect(handoffsRoot(wf('docs/handoffs/{LIFECYCLE}-{YYYYMMDD}-{feature-slug}/'))).toEqual({ root: 'docs/handoffs', depth: 1 })
    expect(handoffsRoot(wf('./work/runs/{LIFECYCLE}/{feature-slug}'))).toEqual({ root: 'work/runs', depth: 2 })
    expect(handoffsRoot(wf('records/<feature-slug>'))).toEqual({ root: 'records', depth: 1 })
    for (const bad of [null, 'not json', '[]', '{}', wf(3), wf(''), wf('{LIFECYCLE}/x'), wf('../up/{x}'), wf('/abs/{x}'), wf('C:/abs/{x}'), wf('a/{b}/{c}/{d}/{e}')])
      expect(handoffsRoot(bad)).toEqual({ root: 'docs/handoffs', depth: 1 })
  })

  test('malformed Stages tables never throw and report nothing', () => {
    const odd = [
      '## Stages\n| Step | Stage | Agent |\n|---|---|---|\n| 1 | a | blocked |',
      '## Stages\n| Step | Status |\n|---|---|\n|  | blocked |',
      '## Stages\n| Step | Status |\n|---|\n| 1 |',
      '## Stages\n| Step | Status |\n| 1 | blocked |',
      '## Notes\n| Step | Status |\n|---|---|\n| 1 | blocked |',
      '| | |\n|--|--|\n| blocked | blocked |',
      '## Stages\n|\n|-|\n|',
    ]
    for (const t of odd) {
      expect(() => blockedSteps(t)).not.toThrow()
      expect(blockedSteps(t)).toEqual([])
      expect(() => detectRun('R', `---\nstatus: active\n---\n${t}`, [], 1)).not.toThrow()
      expect(detectRun('R', `---\nstatus: active\n---\n${t}`, [], 1).list).toEqual([])
    }
    // The Stages table found by a Stage column without the heading, columns found by header name.
    expect(blockedSteps('| Status | Step | Stage |\n|---|---|---|\n| blocked: needs G1 | 4 | plan |')).toEqual([{ code: '4', stage: 'plan', record: '', detail: 'needs G1' }])
  })
})

describe('step 8.1.6.1.l1: blocked steps and anomalyRunScope (in the lens)', () => {
  test('a blocked step in an active run: one red toast and marker; cleared when the row changes; a blocked run with it is one toast', async ($, on) => {
    const { toasts, files } = await seed($, on, { complete: false, files: { 'docs/handoffs/R/run.md': runSteps('active') } })
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
    expect(toasts).toEqual(['ai-dlc-lens: Step blocked (run R, step 18, 18-orchestrator-to-documentation-writer.handoff.md): docs: waiting on G2'])
    const wp = await chartPane($, 'vscode', false)
    const marks: any[] = (await wp.findAll({ type: 'Text' })).filter((x: any) => /^▲/.test(String(x.text)))
    expect(marks.length).toBeGreaterThan(0)
    expect(marks.every((x: any) => (x.props?.color ?? x.color) === '#c62828')).toBe(true)
    // The row moves on: the anomaly clears.
    files['docs/handoffs/R/run.md'] = runSteps('active', STEP_ROWS.replace('blocked · waiting on G2', 'done (passed)'))
    await $.tool.call({ tool: 'Edit', file_path: 'docs/handoffs/R/run.md', old_string: 'a', new_string: 'b', tool_use_id: 'toolu_s1' })
    expect(await wp.find({ type: 'Button', key: 'anomalies' })).toBe(undefined)
    await wp.unmount()
    // The run and the step blocked together: one toast, the run's, naming the step.
    files['docs/handoffs/R/run.md'] = runSteps('blocked')
    await $.tool.call({ tool: 'Write', file_path: 'docs/handoffs/R/run.md', content: 'x', tool_use_id: 'toolu_s2' })
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
    expect(toasts.slice(1)).toEqual(['ai-dlc-lens: Run blocked (run R, step review, 19-orchestrator-to-code-reviewer.handoff.md): blocked step 18'])
    const r: any = await ($.command.run as any)({ command: 'ai-dlc:lens-gate', args: '' })
    expect(String(r?.text)).toMatch(/Anomalies \(1\):\n- Run blocked/)
    expect(String(r?.text)).not.toMatch(/Step blocked/)
  })

  test('anomalyRunScope: session ignores a blocked run no brief names; all reports it, and never a run that is done or paused', async ($, on) => {
    const { toasts } = await seed($, on, {
      complete: false,
      files: {
        'docs/handoffs/R/run.md': RUN_R('build'),
        'docs/handoffs/X/run.md': runMd('blocked'),
        'docs/handoffs/Y/run.md': runSteps('done'),
        'docs/handoffs/P/run.md': runSteps('paused'),
      },
      list: {
        'docs/handoffs': ['R/', 'X/', 'Y/', 'P/', 'E/', 'notes.md'],
        'docs/handoffs/R': ['run.md', '17-orchestrator-to-agent-manager.handoff.md'],
        'docs/handoffs/X': ['run.md', '2-orchestrator-to-sqa-engineer.handoff.md'],
        'docs/handoffs/Y': ['run.md'],
        'docs/handoffs/P': ['run.md'],
        'docs/handoffs/E': ['readme.md'],
      },
    })
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
    expect(toasts).toEqual([])
    const s: any = await ($.command.run as any)({ command: 'ai-dlc:lens-gate', args: '' })
    expect(String(s?.text)).toMatch(/No anomalies\.\nRuns read: this session's \(anomalyRunScope = session \[default\]\)\.$/)
    await ($.command.run as any)({ command: 'ai-dlc:lens-configure', args: 'anomalyRunScope all' })
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
    expect(toasts).toEqual(['ai-dlc-lens: Run blocked (run X, step build, 17-orchestrator-to-agent-manager.handoff.md)'])
    const a: any = await ($.command.run as any)({ command: 'ai-dlc:lens-gate', args: '' })
    expect(String(a?.text)).toMatch(/Anomalies \(1\):\n- Run blocked \(run X/)
    expect(String(a?.text)).not.toMatch(/run Y|run P|step 18/)
    expect(String(a?.text)).toMatch(/Runs read: this session's and every active or blocked run under the handoff folder \(anomalyRunScope = all \[\.ai-dlc\/lens\.json\]\)\.$/)
    // Back to session: the outside run is no longer read, so its anomaly clears.
    await ($.command.run as any)({ command: 'ai-dlc:lens-configure', args: 'anomalyRunScope session' })
    const back: any = await ($.command.run as any)({ command: 'ai-dlc:lens-gate', args: '' })
    expect(String(back?.text)).toMatch(/No anomalies\./)
  })
})

describe('step 8.1.6.1.l1 addendum A5: one chart per run, whatever session, batch, path form or resume', () => {
  test('unifyRuns / joinWorkflow: one run across two batches and two sessions is one workflow; two runs stay two', () => {
    const ag = (id: string, call: string, handoff: string | null) => ({ id, toolUseId: call, status: 'completed', handoff, prompt: '' }) as any
    // Session 1, batch 1: step 1.6.1 of run R.
    let wf = joinWorkflow(WF0, 'main', 'c1', {}, {}, { c1: 'run:docs/handoffs/R' })
    // Session 2 (after /clear): the call keys of session 1 are gone; its agent still names its record.
    const agents = { a1: ag('a1', 'c1', 'docs/handoffs/R/1.6.1-orchestrator-to-agent-manager.handoff.md') }
    // Batch 2, a loop round, the record named by an absolute Windows path: the same run.
    wf = joinWorkflow(wf, 'main', 'c2', agents, { c1: 'a1' }, { c2: 'run:E:/repo/docs/handoffs/R' })
    expect(wf.of['c2']).toBe('c1')
    // Another run is still its own workflow (AC-1.5.2).
    wf = joinWorkflow(wf, 'main', 'c3', agents, { c1: 'a1' }, { c2: 'run:E:/repo/docs/handoffs/R', c3: 'run:docs/handoffs/S' })
    expect(wf.order).toEqual(['c1', 'c3'])
    // A resumed agent's new call (its brief names no record) belongs to the agent's run.
    wf = joinWorkflow(wf, 'main', 'c4', { ...agents, a1: { ...agents.a1, toolUseId: 'c4' } }, { c1: 'a1', c4: 'a1' }, { c4: 'req:carry on' })
    expect(wf.of['c4']).toBe('c1')
    // A state an earlier lens split (two workflows for run R, one for S): drawn as one per run, the oldest kept.
    const split = { of: { c1: 'c1', c2: 'c2', n2: 'c2', c3: 'c3' }, by: { c1: 'main', c2: 'main', n2: 'a2', c3: 'main' }, parent: { c1: 'main', c2: 'main', c3: 'main' }, order: ['c1', 'c2', 'c3'] }
    const keys = { c1: 'run:docs/handoffs/R', c2: 'run:./docs/handoffs/R/', n2: '', c3: 'run:docs/handoffs/S' }
    const one = unifyRuns(split, keys, {}, {})
    expect(one.order).toEqual(['c1', 'c3'])
    expect([one.of['c2'], one.of['n2'], one.of['c3']]).toEqual(['c1', 'c1', 'c3'])
    // Already one per run: unchanged, the same object.
    expect(unifyRuns(one, keys, {}, {})).toBe(one)
    // A workflow mixing two runs (an older lens joined them): each run's calls go back to that run's workflow.
    const mixed = { of: { c1: 'c1', c3: 'c3', c5: 'c3' }, by: {}, parent: { c1: 'main', c3: 'main' }, order: ['c1', 'c3'] }
    const fixed = unifyRuns(mixed, { c1: 'run:docs/handoffs/R', c3: 'run:docs/handoffs/S', c5: 'run:docs/handoffs/R' }, {}, {})
    expect([fixed.of['c5'], fixed.order]).toEqual(['c1', ['c1', 'c3']])
    expect([runIdOf('E:\\repo\\.worktrees\\x\\docs\\handoffs\\AAW-1-x\\'), runIdOf('./docs/handoffs/aaw-1-x'), runIdOf(null), runIdOf('.')]).toEqual(['aaw-1-x', 'aaw-1-x', '', ''])
  })

  test('in the lens: step 1.6.1 (batch 1), then 1.6.1.l1 by an absolute path and a resumed agent (batch 2, after /clear): one chart; run B its own', async ($, on) => {
    await seed($, on, { files: RUNS })
    await spawnInto($, 2, 'A', '1.6.1')
    await completeAgent($, 'a2')
    // The automatic handoff's /clear: the session ends, the process and the lens state go on (no session.start).
    const abs = 'Handoff record: E:\\repo\\docs\\handoffs\\A\\1.6.1.l1-orchestrator-to-agent-manager.handoff.md — read it first.\nDo it.'
    await $.tool.call({ tool: 'Agent', subagent_type: 'ai-dlc:agent-manager', description: 'd3', prompt: abs, tool_use_id: 'toolu_3' })
    await $.agent.spawn({ tool_use_id: 'toolu_3', prompt: abs, description: 'd3', subagentType: 'ai-dlc:agent-manager', provider: { plugin: 'ai-dlc', tier: 'user' }, parentModel: 'claude-opus-5-5', background: true, fork: false })
    await spawnInto($, 4, 'B')
    const ui = await wide($)
    expect(await panelKeys(ui)).toEqual(['wf-toolu_4', 'wf-toolu_2', 'wf-toolu_1'])
    await ui.press({ key: 'wf-toolu_2' })
    expect(await ui.find({ type: 'Text', text: /spawned 2 agents$/ })).toBeDefined()
    await ui.unmount()
  })
})

describe('step 8.1.6.1.l1 addendum A6: Panel Type, drill-in by default', () => {
  test('no setting: drill-in; the switch reads "Panel Type: ◉ Drill in  ○ Tab" (radio glyphs, 8.1.6.1.l2) in the view and the /ai-dlc:lens pane; Tab switches for the session, never lens.json', async ($, on) => {
    const { opened, writes } = await seed($, on, { defaultOpenMode: true })
    expect([DEFAULTS.panelOpenMode, openModeOf('', DEFAULTS.panelOpenMode)]).toEqual(['drill-in', 'drill-in'])
    const wp = await chartPane($, 'vscode')
    expect(await wp.find({ type: 'Text', text: /^Panel Type:$/ })).toBeDefined()
    expect([(await wp.find({ type: 'Button', key: 'panel-drill-in' }))?.text, (await wp.find({ type: 'Button', key: 'panel-tab' }))?.text]).toEqual(['◉ Drill in', '○ Tab'])
    // Two choices, never a single push button that flips.
    expect(await wp.find({ type: 'Button', key: 'open-mode' })).toBe(undefined)
    await wp.press({ key: 'agent-a1' })
    expect([opened.filter(x => x === 'ai-dlc-lens-agent'), await wp.find({ type: 'Button', key: 'drill-back' }) !== undefined]).toEqual([[], true])
    await wp.press({ key: 'drill-back' })
    await wp.press({ key: 'panel-tab' })
    expect([(await wp.find({ type: 'Button', key: 'panel-drill-in' }))?.text, (await wp.find({ type: 'Button', key: 'panel-tab' }))?.text]).toEqual(['○ Drill in', '◉ Tab'])
    await wp.press({ key: 'agent-a1' })
    expect(opened).toContain('ai-dlc-lens-agent')
    await wp.unmount()
    // The /ai-dlc:lens pane shows the same switch and the same session choice.
    const lp = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    expect([(await lp.find({ type: 'Button', key: 'mode-drill' }))?.text, (await lp.find({ type: 'Button', key: 'mode-pane' }))?.text]).toEqual(['○ Drill in', '◉ Tab'])
    await lp.unmount()
    expect(writes.filter(w => w.path === '.ai-dlc/lens.json')).toEqual([])
  })
})

describe('step 8.1.6.1.l1 addendum A7: full screen on every host', () => {
  test('VS Code: full screen raises the pane and gives it to the selected run alone (larger chart, its note); restore brings the runs back', async ($, on) => {
    const { openArgs } = await seed($, on, { complete: false, files: RUNS })
    await spawnInto($, 2, 'B')
    const ui = await $.ui.mount({ ...pane(CHART_PANE, 'dock', 100), surface: 'vscode', viewport: { columns: 200, rows: 50 } })
    expect(await panelKeys(ui)).toEqual(['wf-toolu_2', 'wf-toolu_1'])
    const svgBy = async (re: RegExp): Promise<any> => ((await ui.findAll({ type: 'Svg' })) as any[]).find((x: any) => re.test(String(x?.props?.alt ?? x?.alt ?? '')))
    const widthOf = (x: any): number => Number(/width="(\d+(?:\.\d+)?)"/.exec(String(x?.props?.source ?? x?.source ?? ''))?.[1] ?? NaN)
    const normalChart: any = await svgBy(/^Step chart /)
    expect(Number.isNaN(widthOf(normalChart))).toBe(false)
    await ui.press({ key: 'pane-full' })
    const full = openArgs.filter((x: any) => x.id === CHART_PANE).at(-1)
    expect([full?.focus, full?.rows, full?.columns]).toEqual([true, 50, 200])
    // The run list is gone; one run, its chart 1.5 times larger, the note naming what this host does.
    expect(await panelKeys(ui)).toEqual([])
    // Step 30.1: full screen shows one step; step 8.6.1.l1 (A): the first in order, the highest code, when none was picked.
    expect(await ui.find({ type: 'Text', text: /^Full screen: this step only, filling the pane\. This surface sizes the pane itself/ })).toBeDefined()
    const big: any = await svgBy(/^Full screen chart 17:/)
    expect(big).toBeDefined()
    expect(await svgBy(/^Step chart /)).toBe(undefined)
    expect(widthOf(big)).toBeGreaterThan(widthOf(normalChart))
    // Another run can still be chosen in full screen.
    expect((await ui.findAll({ type: 'Button' })).some((b: any) => /^fs-show-/.test(String(b.key)))).toBe(true)
    expect((await boxes(ui))[0]?.minHeight).toBeGreaterThan(0)
    await ui.press({ key: 'pane-full' })
    expect(await panelKeys(ui)).toEqual(['wf-toolu_2', 'wf-toolu_1'])
    expect(await ui.find({ type: 'Text', text: /^Full screen:/ })).toBe(undefined)
    await ui.unmount()
  })

  test('terminal, pinned: full screen leaves the band for the pane (opened, raised); the band steps aside; restore closes the pane and the band draws again', async ($, on) => {
    on('session.surfaces', () => ({ value: ['terminal'] }))
    const { openArgs, closed } = await seed($, on)
    const band = () => $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { offset: 0, bodyRows: 20 }, view: {} } } as any)
    let b = await band()
    expect(await b.find({ type: 'Button', key: 'wf-toolu_1' })).toBeDefined()
    await b.press({ key: 'pane-full' })
    const full = openArgs.filter((x: any) => x.id === CHART_PANE).at(-1)
    expect([full?.id, full?.focus]).toEqual([CHART_PANE, true])
    await b.unmount()
    b = await band()
    expect(await b.find({ type: 'Button', key: 'pane-full' })).toBe(undefined)
    expect(await b.find({ type: 'Text', text: 'NATIVE ROW' })).toBeDefined()
    await b.unmount()
    const ui = await $.ui.mount({ ...pane(CHART_PANE, 'dock', 100), surface: 'terminal', viewport: { columns: 200, rows: 50 } })
    expect(await ui.find({ type: 'Text', text: /^Full screen: this step only, at the height the terminal gives the pane/ })).toBeDefined()
    const closedBefore = closed.filter(x => x === CHART_PANE).length
    await ui.press({ key: 'pane-full' })
    expect(closed.filter(x => x === CHART_PANE).length).toBe(closedBefore + 1)
    await ui.unmount()
    b = await band()
    expect(await b.find({ type: 'Button', key: 'wf-toolu_1' })).toBeDefined()
    await b.unmount()
  })
})

describe('step 8.1.6.1.l2 (full screen since step 8.6.1: the selected step); Panel Type radio glyphs', () => {
  test('full screen (step 8.6.1): the selected step\'s chart only, larger; ⤢ on a step chart picks it, the Steps row switches, another run shows its highest step', async ($, on) => {
    const runA = '---\nrun: A\nstatus: active\n---\n\n# Run: run A\n\n## Stages\n| Step | Stage | Agent | Status |\n|---|---|---|---|\n| 1 | research | agent-manager | done |\n| 2 | build | agent-manager | in-progress |\n'
    await seed($, on, { complete: false, files: { ...RUNS, 'docs/handoffs/A/run.md': runA } })
    await spawnInto($, 2, 'A', '1')
    await spawnInto($, 3, 'A', '2')
    await spawnInto($, 4, 'B')
    const ui = await $.ui.mount({ ...pane(CHART_PANE, 'dock', 100), surface: 'vscode', viewport: { columns: 200, rows: 50 } })
    // Show run A: its step charts beside the list, by code, highest first (step 8.6.1.l1 A): 17 from its records on disk, then 2 and 1.
    await ui.press({ key: 'wf-show-toolu_2' })
    expect(await stepKeys(ui)).toEqual(['17', '2', '1'])
    // ⤢ on step 1's chart: full screen, that step only.
    await ui.press({ key: 'sel:toolu_2:s1:step-full' })
    expect(((await ui.findAll({ type: 'Svg' })) as any[]).map((x: any) => String(x?.props?.alt ?? '')).filter(a => CHART_ALT.test(a))).toEqual(['Full screen chart 1: run A'])
    expect(await ui.find({ type: 'Text', text: 'Step 1 · research' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^Full screen: this step only/ })).toBeDefined()
    // The Steps row: every step of run A, the shown one in brackets; a press shows another.
    const stepRow = async () => ((await ui.findAll({ type: 'Button' })) as any[]).filter((b: any) => /^fs-step-/.test(String(b.key))).map((b: any) => String(b.text))
    expect(await stepRow()).toEqual(['17', '2', '(1)'])
    await ui.press({ key: 'fs-step-2' })
    expect(await stepKeys(ui)).toEqual(['2'])
    expect(await ui.find({ type: 'Text', text: 'Step 2 · build' })).toBeDefined()
    expect(await stepRow()).toEqual(['17', '(2)', '1'])
    // The other run chosen in full screen: its first step in order, the highest code (17, from its records on disk).
    await ui.press({ key: 'fs-show-toolu_4' })
    expect(await stepKeys(ui)).toEqual(['17'])
    expect(((await ui.findAll({ type: 'Svg' })) as any[]).some((x: any) => String(x?.props?.alt ?? '') === 'Full screen chart 17: run B')).toBe(true)
    await ui.unmount()
  })

  test('Panel Type: radio glyphs, the current ◉ and the other ○; a press moves the ◉; the same keys in the view and the /ai-dlc:lens pane', async ($, on) => {
    const { writes } = await seed($, on, { defaultOpenMode: true })
    const wp = await chartPane($, 'vscode')
    const pair = async (ui: any, a: string, b: string) => [(await ui.find({ type: 'Button', key: a }))?.text, (await ui.find({ type: 'Button', key: b }))?.text]
    expect(await pair(wp, 'panel-drill-in', 'panel-tab')).toEqual(['◉ Drill in', '○ Tab'])
    await wp.press({ key: 'panel-tab' })
    expect(await pair(wp, 'panel-drill-in', 'panel-tab')).toEqual(['○ Drill in', '◉ Tab'])
    await wp.press({ key: 'panel-drill-in' })
    expect(await pair(wp, 'panel-drill-in', 'panel-tab')).toEqual(['◉ Drill in', '○ Tab'])
    await wp.unmount()
    const lp = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    expect(await pair(lp, 'mode-drill', 'mode-pane')).toEqual(['◉ Drill in', '○ Tab'])
    await lp.press({ key: 'mode-pane' })
    expect(await pair(lp, 'mode-drill', 'mode-pane')).toEqual(['○ Drill in', '◉ Tab'])
    await lp.unmount()
    expect(writes.filter(w => w.path === '.ai-dlc/lens.json')).toEqual([])
  })
})

describe('step 8.1.6.1: background-task sections collapse (the human\'s bug)', () => {
  test('a subagent listed live and again at Stop is one entry; every entry starts collapsed and toggles alone across redraws and new tasks', async ($, on) => {
    await seed($, on, { complete: false })
    // a1 is listed by $.agent.list() and again in main's Stop background_tasks: the same id twice before the fix.
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [{ id: 'a1', type: 'subagent', status: 'running', description: 'build', agent_type: 'ai-dlc:software-engineer' }, { id: 'b1', type: 'shell', status: 'running', description: 'npm run watch' }] })
    const lens = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    await lens.press({ key: 'agent-main' })
    await lens.unmount()
    const main = await $.ui.mount({ ...pane('ai-dlc-lens-agent'), surface: 'vscode' })
    await main.press({ key: 'agent-tasks' })
    const taskKeys = async () => ((await main.findAll({ type: 'Button' })) as any[]).map((b: any) => String(b.key)).filter(k => k.startsWith('task-'))
    expect(await taskKeys()).toEqual(['task-a1', 'task-b1'])
    expect(await main.find({ type: 'Text', text: /^\s*Background tasks \(2\)$/ })).toBeDefined()
    for (const k of ['task-a1', 'task-b1']) expect((await main.find({ type: 'Button', key: k }))?.text).toBe('[+]')
    // Each entry is a keyed Box of its own.
    const keyed = ((await main.findAll({ type: 'Box' })) as any[]).map((b: any) => String(b.key ?? b.props?.key ?? '')).filter(k => k.startsWith('tb-'))
    expect(keyed).toEqual(['tb-a1', 'tb-b1'])
    await main.press({ key: 'task-b1' })
    expect((await main.find({ type: 'Button', key: 'task-b1' }))?.text).toBe('[-]')
    expect((await main.find({ type: 'Button', key: 'task-a1' }))?.text).toBe('[+]')
    // A redraw (the 2 s poll's list refresh) and a new task arriving keep each state.
    await main.press({ key: 'agent-refresh' })
    await $.tool.call({ tool: 'Bash', command: 'sleep 15', run_in_background: true, tool_use_id: 'toolu_b' })
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [{ id: 'a1', type: 'subagent', status: 'running', description: 'build', agent_type: 'ai-dlc:software-engineer' }, { id: 'b1', type: 'shell', status: 'running', description: 'npm run watch' }] })
    // The order may move as tasks arrive (live list, started, stop-time); each keeps its own state by its key.
    expect((await taskKeys()).sort()).toEqual(['task-a1', 'task-b1', 'task-b9'])
    expect((await main.find({ type: 'Button', key: 'task-b9' }))?.text).toBe('[+]')
    expect((await main.find({ type: 'Button', key: 'task-b1' }))?.text).toBe('[-]')
    expect((await main.find({ type: 'Button', key: 'task-a1' }))?.text).toBe('[+]')
    await main.press({ key: 'task-b1' })
    expect((await main.find({ type: 'Button', key: 'task-b1' }))?.text).toBe('[+]')
    expect(await main.find({ type: 'Box', text: 'Typeshell' })).toBe(undefined)
    await main.unmount()
  })

  test('uniqueTasks: one entry per id, the first wins, a later one fills what it lacks; mergeStopTasks no longer repeats an id', () => {
    const t = (id: string, source: string, extra: object = {}) => ({ id, type: 'subagent', status: 'running', description: '', source, ...extra })
    expect(uniqueTasks([t('a', 'agent.list'), t('a', 'Stop', { agentType: 'x', output: 'o', description: 'd' }), t('', 'Stop'), t('', 'Stop')])).toEqual([
      { ...t('a', 'agent.list'), agentType: 'x', output: 'o', description: 'd' },
      t('', 'Stop'),
      t('', 'Stop'),
    ])
    expect(mergeStopTasks([t('a', 'agent.list')], [t('a', 'Stop')]).map(x => x.id)).toEqual(['a'])
  })
})

describe('step 8.1.6.1 addendum (A1-A4)', () => {
  test('A2: the agent and hand-off tabs have minimise (–) then close (×); minimised, one line with restore (□); a new press restores', async ($, on) => {
    const { closed } = await seed($, on)
    const wp = await chartPane($)
    await wp.press({ key: 'agent-a1' })
    await wp.press({ key: 'edge-a1' })
    for (const [id, title] of [['ai-dlc-lens-agent', /^Agent: David Fowler - completed$/], ['ai-dlc-lens-edge', /^Hand-off: Scott Hanselman -> David Fowler - completed$/]] as const) {
      const ui = await $.ui.mount({ ...pane(id), surface: 'vscode' })
      const keys = ((await ui.findAll({ type: 'Button' })) as any[]).map((b: any) => String(b.key))
      expect(keys.slice(0, 2)).toEqual(['pane-min', 'pane-close'])
      expect([(await ui.find({ type: 'Button', key: 'pane-min' }))?.text, (await ui.find({ type: 'Button', key: 'pane-close' }))?.text]).toEqual(['–', '×'])
      await ui.press({ key: 'pane-min' })
      expect(((await ui.findAll({ type: 'Button' })) as any[]).map((b: any) => String(b.key))).toEqual(['pane-min', 'pane-close'])
      expect((await ui.find({ type: 'Button', key: 'pane-min' }))?.text).toBe('□')
      expect(await ui.find({ type: 'Text', text: title })).toBeDefined()
      await ui.press({ key: 'pane-min' })
      expect((await ui.find({ type: 'Button', key: 'pane-min' }))?.text).toBe('–')
      await ui.press({ key: 'pane-min' })
      await ui.unmount()
    }
    // A new press in tab mode shows the tab restored.
    await wp.press({ key: 'agent-a1' })
    const ag = await $.ui.mount({ ...pane('ai-dlc-lens-agent'), surface: 'vscode' })
    expect((await ag.find({ type: 'Button', key: 'pane-min' }))?.text).toBe('–')
    await ag.press({ key: 'pane-close' })
    expect(closed).toContain('ai-dlc-lens-agent')
    await ag.unmount()
    // Drill-in: no tab, so no tab controls inside the view; the view keeps its own row (minimise, close).
    await wp.press({ key: 'panel-drill-in' })
    await wp.press({ key: 'agent-a1' })
    expect(await wp.find({ type: 'Button', key: 'drill-back' })).toBeDefined()
    expect(((await wp.findAll({ type: 'Button' })) as any[]).filter((b: any) => b.key === 'pane-min').length).toBe(1)
    await wp.unmount()
  })

  test('A3: a run started by a nested agent and joined later by the orchestrator draws every member, each under its own spawner', () => {
    const ag = (id: string, parent: string | null, tu: string, extra: Partial<LensAgent> = {}): LensAgent =>
      ({ id, parent, type: 'ai-dlc:software-engineer', name: '', description: '', model: '', callModel: '', parentModel: '', prompt: '', status: 'running', toolUseId: tu, steps: { in: 0, out: 0, cr: 0, cw: 0 }, turns: { in: 0, out: 0, cr: 0, cw: 0 }, last: null, handoff: null, handoffHow: 'none', loop: false, startedAt: 1, endedAt: null, bg: [], reqs: [], ...extra }) as LensAgent
    const R = 'docs/handoffs/R/5-x-to-software-engineer.handoff.md'
    const agents: Record<string, LensAgent> = {
      main: ag('main', null, ''),
      a1: ag('a1', 'main', 't1'),
      a5: ag('a5', 'a1', 't5', { handoff: R }),
      a6: ag('a6', 'main', 't6', { handoff: R }),
    }
    const keys = { t1: 'req:other', t5: 'run:docs/handoffs/R', t6: 'run:docs/handoffs/R' }
    let wf = joinWorkflow(WF0, 'main', 't1', agents, {}, keys)
    wf = joinWorkflow(wf, 'a1', 't5', agents, {}, keys)
    wf = joinWorkflow(wf, 'main', 't6', agents, {}, keys)
    expect(wf.of).toEqual({ t1: 't1', t5: 't5', t6: 't5' })
    const b = workflowBatch(wf, 't5', {}, agents)
    expect([b.parent, b.ids]).toEqual(['main', ['t5', 't6']])
    const v = batchView(b, agents, ['main', 'a1', 'a5', 'a6'], { t1: 'a1', t5: 'a5', t6: 'a6' })
    expect(v.ids).toEqual(['main', 'a1', 'a5', 'a6'])
    expect([v.agents['a5']!.parent, v.agents['a6']!.parent, v.agents['a1']!.parent]).toEqual(['a1', 'main', 'main'])
    expect(v.members).toEqual(['a5', 'a6'])
    // Unchanged where one spawner made every call: the workflow main started keeps main as its root.
    expect(workflowBatch(wf, 't1', {}, agents)).toEqual({ parent: 'main', ids: ['t1'], pending: {}, by: { t1: 'main' } })
    expect(commonAncestor(['a5', 'a6'], agents)).toBe('main')
    expect(commonAncestor(['a1', 'a5'], agents)).toBe('a1')
  })

  test('A4: panelOpenMode: no session choice uses the setting; the "Panel Type" switch wins for the session and never writes lens.json', async ($, on) => {
    const { opened, writes } = await seed($, on, { files: lensJson({ panelOpenMode: 'drill-in' }) })
    const wp = await chartPane($)
    opened.length = 0
    await wp.press({ key: 'agent-a1' })
    expect([opened, await wp.find({ type: 'Button', key: 'drill-back' }) !== undefined]).toEqual([[], true])
    await wp.press({ key: 'drill-back' })
    const before = writes.filter(w => w.path === '.ai-dlc/lens.json').length
    await wp.press({ key: 'panel-tab' })
    await wp.press({ key: 'agent-a1' })
    expect(opened).toEqual(['ai-dlc-lens-agent'])
    expect(writes.filter(w => w.path === '.ai-dlc/lens.json').length).toBe(before)
    await wp.unmount()
    expect([openModeOf('', 'drill-in'), openModeOf('', 'tab'), openModeOf('tab', 'drill-in'), openModeOf('drill-in', 'tab'), openModeOf('junk', 'drill-in')]).toEqual(['drill-in', 'tab', 'tab', 'drill-in', 'drill-in'])
  })
})

// ---- step 2.2 (sqa-engineer): the anomaly checks and their settings, one by one ----

describe('step 2.2: every anomaly check has its own switch, colour and rank; the run-scope and waiting settings validate', () => {
  const an = (kind: string, run = 'R', extra: object = {}) =>
    ({ key: `${kind}:${run}`, kind, run, step: '', record: '', agent: '', target: '', text: '', since: 1, ...extra }) as any

  test('[8.1.6.1] each of the nine checks is switched off alone: only its own anomaly goes, the other eight stay', () => {
    const kindsAll = Object.keys(CHECKS)
    expect(kindsAll.length).toBe(9)
    const all = kindsAll.map(k => an(k, `run-${k}`))
    expect(applySettings(all, S0).map(x => x.kind).sort()).toEqual([...kindsAll].sort())
    for (const k of kindsAll) {
      const off = applySettings(all, { ...S0, [(CHECKS as any)[k].enable]: false })
      expect(off.map(x => x.kind).sort()).toEqual(kindsAll.filter(x => x !== k).sort())
    }
  })

  test("[8.1.6.1] each check's colour setting colours its own anomaly only; an unknown kind is red", () => {
    for (const k of Object.keys(CHECKS)) {
      const s = { ...S0, [(CHECKS as any)[k].color]: '#123456' }
      expect(colorOf(k, s)).toBe('#123456')
      for (const o of Object.keys(CHECKS)) if (o !== k) expect(colorOf(o, s)).toBe(String((DEFAULTS as any)[(CHECKS as any)[o].color]))
    }
    expect(colorOf('nonsense', S0)).toBe('#c62828')
  })

  test('[8.1.6.1] the default colours follow the human mapping: six reds, orange for a waiting gate, three other distinct colours', () => {
    const c = (k: string) => String((DEFAULTS as any)[(CHECKS as any)[k].color]).toLowerCase()
    for (const k of ['runBlocked', 'stepBlocked', 'gateRejected', 'agentFailed', 'agentKilled', 'agentWaitingLong']) expect(c(k)).toBe('#c62828')
    expect(c('gateWaiting')).toBe('#ef6c00')
    expect(new Set(['#c62828', c('gateWaiting'), c('loopOutOfRounds'), c('handbackFailed')]).size).toBe(4)
  })

  test('[8.1.6.1] the worst colour wins by rank: red > deep orange > orange > yellow, whatever the order', () => {
    const order = ['handbackFailed', 'gateWaiting', 'loopOutOfRounds', 'runBlocked']
    for (let i = 0; i < order.length; i++) {
      const list = order.slice(0, i + 1).map(k => an(k))
      expect(worstOf(list)?.kind).toBe(order[i])
      expect(worstOf([...list].reverse())?.kind).toBe(order[i])
    }
    for (const red of ['stepBlocked', 'gateRejected', 'agentFailed', 'agentKilled', 'agentWaitingLong']) expect(worstOf([an('loopOutOfRounds'), an(red)])?.kind).toBe(red)
  })

  test("[8.1.6.1.l1] a blocked step is dropped only for a run that is itself reported blocked; another run's step stays; with the run check off the step stays", () => {
    const step = (run: string) => an('stepBlocked', run, { key: `stepBlocked:${run}/3`, step: '3' })
    const list = [an('runBlocked', 'A'), step('A'), step('B')]
    expect(applySettings(list, S0).map(x => x.key)).toEqual(['runBlocked:A', 'stepBlocked:B/3'])
    expect(applySettings(list, { ...S0, anomalyRunBlocked: false }).map(x => x.key)).toEqual(['stepBlocked:A/3', 'stepBlocked:B/3'])
    expect(applySettings(list, { ...S0, anomalyStepBlocked: false }).map(x => x.key)).toEqual(['runBlocked:A'])
    expect(applySettings([step('B'), step('B')], S0).length).toBe(1)
  })

  test('[8.1.6.1.l1] anomalyRunScope: default session; env and file accept session and all only; the env name and the schema agree', () => {
    expect(DEFAULTS.anomalyRunScope).toBe('session')
    expect(envName('anomalyRunScope' as any)).toBe('AI_DLC_LENS_ANOMALY_RUN_SCOPE')
    const env = (v: string) => envLevel('.claude/settings.json', JSON.stringify({ env: { AI_DLC_LENS_ANOMALY_RUN_SCOPE: v } })).level
    expect(resolve([env('all')]).settings.anomalyRunScope).toBe('all')
    expect(resolve([env('ALL')]).settings.anomalyRunScope).toBe('session')
    expect(resolve([env('every')]).settings.anomalyRunScope).toBe('session')
    expect(resolve([env('every')]).ignored.length).toBe(1)
    const file = (v: unknown) => fileLevel('.ai-dlc/lens.json', JSON.stringify({ anomalyRunScope: v })).level
    expect(resolve([file('all')]).settings.anomalyRunScope).toBe('all')
    expect(resolve([file(true)]).settings.anomalyRunScope).toBe('session')
    const r = resolve([env('every'), file('all')])
    expect([r.settings.anomalyRunScope, r.sources.anomalyRunScope]).toEqual(['all', '.ai-dlc/lens.json'])
    expect(setKey(null, 'anomalyRunScope', 'sometimes').error).toMatch(/not valid for anomalyRunScope/)
    expect(JSON.parse(setKey(null, 'anomalyRunScope', 'all').text).anomalyRunScope).toBe('all')
    const p = (schema().properties as any).anomalyRunScope
    expect([p.type, p.enum, p.default]).toEqual(['string', ['session', 'all'], 'session'])
  })

  test('[8.1.6.1] anomalyWaitingMinutes: whole minutes from 0 to 1440; anything else falls back to 30; 0 means at once', () => {
    const file = (v: unknown) => resolve([fileLevel('.ai-dlc/lens.json', JSON.stringify({ anomalyWaitingMinutes: v })).level]).settings.anomalyWaitingMinutes
    expect([file(0), file(1), file(1440)]).toEqual([0, 1, 1440])
    expect([file(-1), file(1441), file(30.5), file('10'), file(null)]).toEqual([30, 30, 30, 30, 30])
    const env = (v: string) => resolve([envLevel('.claude/settings.json', JSON.stringify({ env: { AI_DLC_LENS_ANOMALY_WAITING_MINUTES: v } })).level]).settings.anomalyWaitingMinutes
    expect([env('0'), env('45'), env('-3'), env('1.5'), env('soon')]).toEqual([0, 45, 30, 30, 30])
    const ag = { a: { id: 'a', parent: 'main', type: 'ai-dlc:software-engineer', name: '', description: '', model: '', callModel: '', parentModel: '', prompt: '', status: 'waiting', toolUseId: 'a', steps: { in: 0, out: 0, cr: 0, cw: 0 }, turns: { in: 0, out: 0, cr: 0, cw: 0 }, last: null, handoff: 'docs/handoffs/R/3-orchestrator-to-software-engineer.handoff.md', handoffHow: 'first line', loop: false, startedAt: 10, endedAt: null, bg: [], reqs: [] } } as any
    expect(kinds(detectAgents(ag, { a: 100 }, 100, 0))).toEqual(['agentWaitingLong'])
    expect(detectAgents(ag, { a: 100 }, 100, 1)).toEqual([])
  })

  test("[8.1.6.1] every check's enable and colour setting is in the schema with its env name and in the initial lens.json; bad values are refused", () => {
    const props = schema().properties as Record<string, any>
    const initial = JSON.parse(initialFile())
    for (const k of Object.keys(CHECKS)) {
      for (const key of [(CHECKS as any)[k].enable, (CHECKS as any)[k].color]) {
        expect(props[key], key).toBeDefined()
        expect(props[key].description).toContain(envName(key))
        expect(initial).toHaveProperty(key)
      }
    }
    for (const key of ['gateAlert', 'anomalyWaitingMinutes', 'anomalyRunScope', 'anomalyStepBlocked', 'anomalyStepBlockedColor']) expect(props[key], key).toBeDefined()
    expect(setKey(null, 'anomalyGateWaitingColor', 'orange').error).toMatch(/not valid for anomalyGateWaitingColor/)
    expect(JSON.parse(setKey(null, 'anomalyGateWaitingColor', '#abc').text).anomalyGateWaitingColor).toBe('#abc')
    expect(setKey(null, 'anomalyHandbackFailed', 'maybe').error).toMatch(/not valid for anomalyHandbackFailed/)
  })
})

// ---------------- step 1.6.1.l3 (run AAW-20261023-lens-plugin-from-spike) ----------------
// The real shape of session 5bbdde00 (2026-10-23, its transcript): three runs driven at once by one
// orchestrator; every brief's first line `Handoff record: docs/handoffs/<run>/<file> — read it first ...`;
// spawns of one run in batches mixed with other runs; a resumed agent (SendMessage, round 1.6.1.l2);
// two code-reviewers citing one record (3.1). The lens run's run.md has a Stages row per step, so the
// old task panels drew one chart per step: the split the human saw. Tool-use and agent ids are anonymised.
const L_RUN = 'AAW-20261023-lens-plugin-from-spike'
const D_RUN = 'AAW-20261024-docs-in-progress-rule'
const V_RUN = 'AAW-20261024-orchestrator-verify-only'
const STAGES_MD = (title: string, rows: [string, string, string][]) =>
  `---\nrun: ${title}\nstatus: active\n---\n\n# Run: ${title}\n\n## Stages\n| Step | Stage | Agent | Status | Record |\n|---|---|---|---|---|\n` +
  rows.map(([code, stage, agent]) => `| ${code} | ${stage} | ${agent} | in-progress | ${code}-orchestrator-to-${agent}.handoff.md |\n`).join('')
const L_MD = STAGES_MD('create the ai-dlc-lens plugin from spike 027', [
  ['1.6.1.l1', 'anomaly detector: blocked steps; A5 one chart per run', 'agent-manager'],
  ['1.6.1.l2', 'full screen also shows the run task panels', 'agent-manager'],
  ['1.6.1.l2.1', 'finish and report 1.6.1.l2', 'agent-manager'],
  ['1.6.2.l1', 'README: the real gate-alert behaviour', 'documentation-writer'],
  ['2.1', 'critique (docs)', 'brutal-critique'],
  ['2.2', 'tests (code)', 'sqa-engineer'],
  ['3.1', 'code review: standards', 'code-reviewer'],
  ['3.2', 'code review: spec', 'code-reviewer'],
])
const D_MD = STAGES_MD('docs mark a feature an agent is building as in progress', [
  ['1.l1', 'check step 1 output', 'agent-manager'],
  ['1.1', 'plugin-management README work', 'agent-manager'],
  ['1.2', 'docs: docs-status rule', 'documentation-writer'],
  ['2', 'critique', 'brutal-critique'],
  ['1.2.l1', 'docs: in-progress markers', 'documentation-writer'],
])
const V_MD = STAGES_MD('orchestrator verify only', [
  ['2.1', 'critique (docs)', 'brutal-critique'],
  ['1.l2', 'fix round 1', 'agent-manager'],
])
const REAL_RUNS = { [`docs/handoffs/${L_RUN}/run.md`]: L_MD, [`docs/handoffs/${D_RUN}/run.md`]: D_MD, [`docs/handoffs/${V_RUN}/run.md`]: V_MD }
/** The brief's first line exactly as the orchestrator wrote it in that session. */
const realBrief = (run: string, code: string, agent: string, extra = '') =>
  `Handoff record: docs/handoffs/${run}/${code}-orchestrator-to-${agent}.handoff.md${extra} — read it first and verify it before you start; it is self-contained.\nDo the step.`
async function spawnReal($: any, n: number, run: string, code: string, agent: string, extra = '') {
  await nextMs()
  const prompt = realBrief(run, code, agent, extra)
  await $.tool.call({ tool: 'Agent', subagent_type: `ai-dlc:${agent}`, description: `${code} ${agent}`, prompt, tool_use_id: `toolu_${n}`, run_in_background: true })
  await $.agent.spawn({ tool_use_id: `toolu_${n}`, prompt, description: `${code} ${agent}`, subagentType: `ai-dlc:${agent}`, provider: { plugin: 'ai-dlc', tier: 'user' }, parentModel: 'claude-opus-5-5', background: true, fork: false })
}
/** The session's spawns in their real order; returns the calls of the lens run. */
async function replaySession($: any): Promise<string[]> {
  // {L 1.6.1.l1 + D 1.l1}
  await spawnReal($, 2, L_RUN, '1.6.1.l1', 'agent-manager')
  await spawnReal($, 3, D_RUN, '1.l1', 'agent-manager')
  // {D 1.1 + D 1.2}
  await spawnReal($, 4, D_RUN, '1.1', 'agent-manager')
  await spawnReal($, 5, D_RUN, '1.2', 'documentation-writer')
  // L 1.6.1.l2.1, L 1.6.2.l1: single spawns
  await spawnReal($, 6, L_RUN, '1.6.1.l2.1', 'agent-manager')
  await spawnReal($, 7, L_RUN, '1.6.2.l1', 'documentation-writer')
  // {L 2.1 + L 2.2 + D 2 + V 2.1}
  await spawnReal($, 8, L_RUN, '2.1', 'brutal-critique')
  await spawnReal($, 9, L_RUN, '2.2', 'sqa-engineer')
  await spawnReal($, 10, D_RUN, '2', 'brutal-critique')
  await spawnReal($, 11, V_RUN, '2.1', 'brutal-critique')
  // {L 3.1 + L 3.2 (one record covers both) + D 1.2.l1 + V 1.l2}
  await spawnReal($, 12, L_RUN, '3.1', 'code-reviewer')
  await spawnReal($, 13, L_RUN, '3.1', 'code-reviewer', ' (one record covers 3.1 and 3.2)')
  await spawnReal($, 14, D_RUN, '1.2.l1', 'documentation-writer')
  await spawnReal($, 15, V_RUN, '1.l2', 'agent-manager')
  return ['toolu_2', 'toolu_6', 'toolu_7', 'toolu_8', 'toolu_9', 'toolu_12', 'toolu_13']
}
const runCharts = async (ui: any): Promise<{ alt: string; src: string }[]> =>
  ((await ui.findAll({ type: 'Svg' })) as any[])
    .filter((x: any) => CHART_ALT.test(String(x?.props?.alt ?? '')))
    .map((x: any) => ({ alt: String(x.props.alt), src: String(x.props.source ?? '') }))
const nodes = (src: string) => (src.match(/<g class="lens-robot-/g) ?? []).length

describe('step 8.1.6.1.l3: one chart per run in the real session shape (the split the human still saw)', () => {
  test('pure: a resumed agent and two reviewers citing one record are the lens run; the three runs keep three workflows', () => {
    const key = (run: string, code: string, agent: string) => taskKeyOf(realBrief(run, code, agent), '')
    const keys: Record<string, string> = {
      c2: key(L_RUN, '1.6.1.l1', 'agent-manager'),
      c3: key(D_RUN, '1.l1', 'agent-manager'),
      c8: key(L_RUN, '2.1', 'brutal-critique'),
      c10: key(D_RUN, '2', 'brutal-critique'),
      c11: key(V_RUN, '2.1', 'brutal-critique'),
      c12: key(L_RUN, '3.1', 'code-reviewer'),
      c13: taskKeyOf(realBrief(L_RUN, '3.1', 'code-reviewer', ' (one record covers 3.1 and 3.2)'), ''),
    }
    let wf = WF0
    for (const c of ['c2', 'c3', 'c8', 'c10', 'c11', 'c12', 'c13']) wf = joinWorkflow(wf, 'main', c, {}, {}, keys)
    // The resumed 1.6.1.l1 agent (SendMessage, round 1.6.1.l2): its new call's message names the next record.
    const a2 = { id: 'a2', toolUseId: 'cs', status: 'running', handoff: `docs/handoffs/${L_RUN}/1.6.1.l1-orchestrator-to-agent-manager.handoff.md`, prompt: '' } as any
    keys.cs = taskKeyOf(`Round 1.6.1.l2. Your 1.6.1.l1 hand-back passed my check. Handoff record: docs/handoffs/${L_RUN}/1.6.1.l2-orchestrator-to-agent-manager.handoff.md.`, '')
    wf = joinWorkflow(wf, 'main', 'cs', { a2 }, { c2: 'a2', cs: 'a2' }, keys)
    expect(wf.order).toEqual(['c2', 'c3', 'c11'])
    expect(['c8', 'c12', 'c13', 'cs'].map(c => wf.of[c])).toEqual(['c2', 'c2', 'c2', 'c2'])
    expect(new Set(Object.values(callRunIds(wf, keys, { a2 }, { c2: 'a2', cs: 'a2' }))).size).toBe(3)
    // The real record of step 1.6.1.l2.1 (a loop round with a sub-step after it) names its run too.
    expect(parseRecord(`docs/handoffs/${L_RUN}/1.6.1.l2.1-orchestrator-to-agent-manager.handoff.md`)?.code).toBe('1.6.1.l2.1')
    expect(taskKeyOf(realBrief(L_RUN, '1.6.1.l2.1', 'agent-manager'), 'the request')).toBe(`run:docs/handoffs/${L_RUN}`)
    wf = joinWorkflow(wf, 'main', 'c6', {}, {}, { ...keys, c6: taskKeyOf(realBrief(L_RUN, '1.6.1.l2.1', 'agent-manager'), 'the request') })
    expect(wf.of['c6']).toBe('c2')
  })

  test('in the lens (step 8.6.1): the lens run is one workflow, its seven agents in the charts of their steps (1, 2, 3), every sub-step under its parent; no other run\'s agent', HEAVY, async ($, on) => {
    await seed($, on, { complete: false, files: REAL_RUNS })
    const lens = await replaySession($)
    const wp = await $.ui.mount({ ...pane(CHART_PANE, 'dock', 120), surface: 'vscode' })
    // Four workflows: the seed's run R and the three real runs; the lens run's is its first call's.
    expect(await panelKeys(wp)).toEqual(['wf-toolu_11', 'wf-toolu_3', 'wf-toolu_2', 'wf-toolu_1'])
    await wp.press({ key: 'wf-show-toolu_2' })
    // One chart per top-level step, newest spawn first; step 17 comes from the records the folder lists.
    expect(await stepKeys(wp)).toEqual(['17', '3', '2', '1'])
    expect(await wp.find({ type: 'Text', text: 'Step 3 · code review: standards' })).toBeDefined()
    // Step 1: the step, then 1.6 and 1.6.1 (no records of their own), 1.6.1.l1, 1.6.1.l2.1, 1.6.2, 1.6.2.l1. 1.6.1.l2
    // has no record, so it is read as a loop code (step 8.6.5.l1: a loop is never a record) and is no node:
    // 1.6.1.l2.1, round 1 of that loop, hangs under 1.6.1.
    expect(nodes(await stepSource(wp, '1'))).toBe(7)
    // Step 2: the step and its two sub-steps; step 3: the step and both reviewers citing 3.1's record.
    expect(nodes(await stepSource(wp, '2'))).toBe(3)
    expect(nodes(await stepSource(wp, '3'))).toBe(3)
    const keys = ((await wp.findAll({ type: 'Button' })) as any[]).map((b: any) => String(b.key))
    for (const c of lens) expect(keys).toContain(`toolu_2:agent-a${c.slice('toolu_'.length)}`)
    for (const other of ['a3', 'a4', 'a5', 'a10', 'a11', 'a14', 'a15']) expect(keys.some(k => k.endsWith(`:agent-${other}`))).toBe(false)
    await wp.press({ key: 'wf-toolu_2' })
    expect(await wp.find({ type: 'Text', text: /^Scott Hanselman spawned 7 agents$/ })).toBeDefined()
    expect(await wp.find({ type: 'Text', text: '4 step charts' })).toBeDefined()
    await wp.unmount()
    // Narrow: the chosen run shows its step charts.
    const nw = await narrow($)
    await nw.press({ key: 'run-toolu_2' })
    expect(await stepKeys(nw)).toEqual(['17', '3', '2', '1'])
    await nw.unmount()
  })
})

describe('step 8.1.6.1.l3 addendum B2: the orchestrator stops blinking in a run whose agents are all done', () => {
  test('pure: restingSpawner draws main idle once every member ended; a member at work, or another spawner, keeps its status', () => {
    const main = { id: 'main', status: 'running', type: 'ai-dlc:orchestrator' } as any
    const done = { id: 'a1', status: 'completed', type: 't' } as any
    const run = { id: 'a2', status: 'running', type: 't' } as any
    const mate = { id: 'a3', status: 'idle', type: 'teammate', teammate: true } as any
    expect(restingSpawner(main, [done]).status).toBe('idle')
    expect(restingSpawner(main, [done, run]).status).toBe('running')
    expect(restingSpawner(main, [done, mate]).status).toBe('running')
    expect(restingSpawner(main, []).status).toBe('running')
    expect(restingSpawner({ ...main, id: 'a9' }, [done]).status).toBe('running')
    expect(restingSpawner({ ...main, status: 'idle' }, [done])).toEqual({ ...main, status: 'idle' })
  })

  test('in the lens: background agents complete while main runs a turn for another run: main is steady in that run, blinking in the run still at work; idle waiting, steady everywhere', async ($, on) => {
    await seed($, on, { complete: false, files: REAL_RUNS })
    const blinks = (src: string) => (src.match(/<animate /g) ?? []).length
    // The orchestrator's turn spawns two lens agents and one docs agent in the background, then ends:
    // idle, waiting for their notifications.
    await $.turn.start({ text: 'Carry on with the runs', turnId: 'm7' })
    await spawnReal($, 2, L_RUN, '3.1', 'code-reviewer')
    await spawnReal($, 3, L_RUN, '3.1', 'code-reviewer', ' (one record covers 3.1 and 3.2)')
    await spawnReal($, 4, D_RUN, '1.2.l1', 'documentation-writer')
    await $.turn.complete({ reason: 'answer', answer: 'waiting', durationMs: 1, isAborted: false, turnId: 'm7', usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'claude-opus-5-5' } })
    const lensChart = async (wp: any) => {
      await wp.press({ key: 'wf-show-toolu_2' })
      // Step 8.6.1.l1 (A): charts go by code, so the reviewers' step 3 is picked by its key.
      return stepSource(wp, '3')
    }
    let wp = await $.ui.mount({ ...pane(CHART_PANE, 'dock', 120), surface: 'vscode' })
    // Main idle: only the two running reviewers blink.
    expect(blinks(await lensChart(wp))).toBe(2)
    await wp.unmount()
    // A notification starts a main turn; both reviewers finish while main still works for the docs run.
    await $.turn.start({ text: '<task-notification>a2 completed</task-notification>', turnId: 'm8' })
    await completeAgent($, 'a2')
    await completeAgent($, 'a3')
    wp = await $.ui.mount({ ...pane(CHART_PANE, 'dock', 120), surface: 'vscode' })
    expect(blinks(await lensChart(wp))).toBe(0)
    await wp.press({ key: 'wf-show-toolu_4' })
    // The docs run still has its writer at work: there the orchestrator and the writer blink (its step 1).
    expect(blinks(await stepSource(wp, '1'))).toBe(2)
    await wp.unmount()
    // The chat card of the lens run's first call: the same steady orchestrator.
    const card = await $.ui.mount(toolRow('toolu_2', 'vscode', { subagent_type: 'ai-dlc:code-reviewer', description: 'd', prompt: realBrief(L_RUN, '3.1', 'code-reviewer') }, 'Agent', 200))
    const cc = ((await card.findAll({ type: 'Svg' })) as any[]).find((x: any) => /^Chat chart/.test(String(x?.props?.alt ?? '')))
    expect(blinks(String(cc?.props?.source ?? 'x<animate '))).toBe(0)
    await card.unmount()
  })
})

// ---- drawing guards, anomaly markers in every drawing, the pollers, prototype-safe lookups ----
const later = (globalThis as unknown as { setTimeout: (f: (v?: unknown) => void, ms: number) => void }).setTimeout
/** Waits until the clock has moved on by at least two milliseconds, so the next spawn's `startedAt` is later. */
async function nextMs() {
  const from = Date.now()
  while (Date.now() < from + 2) await new Promise(r => later(r, 1))
}
/** Waits on later tasks until `ok()` holds or `ms` of real time pass; true when it held. */
async function until(ok: () => boolean | Promise<boolean>, ms = 5000): Promise<boolean> {
  const end = Date.now() + ms
  for (;;) {
    if (await ok()) return true
    if (Date.now() >= end) return false
    await new Promise(r => later(r, 1))
  }
}

/** Every `clock.every` dispatch, held open until the test lets its period end. */
const heldClock = () => {
  const periods: { ms: number; end: () => void }[] = []
  const clockEvery = (e: { ms: number }) => new Promise(r => periods.push({ ms: e.ms, end: () => r({ value: undefined }) }))
  /**
   * Ends every open period and waits until `want` periods are asked again (default: one per period length that
   * was open, as each live timer asks again once), up to
   * a few seconds of real time, so a loaded machine only makes it slower; then a few more tasks, so a period asked
   * twice is counted. `want` 0: waits only those few tasks. Returns the periods asked again (live timers only).
   */
  const tick = async (want?: number) => {
    const open = periods.splice(0)
    for (const p of open) p.end()
    await until(() => periods.length >= (want ?? new Set(open.map(p => p.ms)).size), want === 0 ? 0 : 5000)
    for (let i = 0; i < 20; i++) await new Promise(r => later(r, 0))
    return periods.map(p => p.ms).sort((a, b) => a - b)
  }
  return { periods, clockEvery, tick }
}

describe('a lens fault never takes the native row or blanks a pane', () => {
  test('the guard of the Agent card and the panes (drawOr): a drawing that throws gives the fallback, after the fault is recorded; one that draws is untouched', async () => {
    const faults: unknown[] = []
    const native = { native: 'row' }
    // The card's use: the native row as the host drew it.
    expect(await drawOr(async () => { throw new Error('lens boom') }, () => native, err => faults.push(err))).toBe(native)
    expect(String(faults[0])).toBe('Error: lens boom')
    // A pane's use: a line built from the fault.
    expect(await drawOr(async () => { throw new TypeError('x is undefined') }, err => `could not be drawn (${String(err)})`, err => faults.push(err))).toBe('could not be drawn (TypeError: x is undefined)')
    // No throw: the drawing itself, nothing recorded.
    expect(await drawOr<unknown>(async () => 'card', () => native, err => faults.push(err))).toBe('card')
    expect(faults.length).toBe(2)
  })

  test('the Agent card around the guard: drawn, it holds the native row last; a SendMessage row too', async ($, on) => {
    await seed($, on, { complete: false })
    for (const [tool, input] of [['Agent', SE_INPUT], ['SendMessage', { to: 'a1', message: 'm' }]] as const) {
      const card = await $.ui.mount(toolRow('toolu_1', 'vscode', input, tool))
      const all: any[] = await card.findAll({})
      expect(all.findIndex((x: any) => x.text === 'NATIVE ROW')).toBe(all.length - 1)
      expect(await card.find({ type: 'Text', text: /^lens hook error/ })).toBe(undefined)
      await card.unmount()
    }
  })

  test('a pane: a drawing that throws gives one red line naming the pane and the fault, never a blank pane or a throw', async ($, on) => {
    await seed($, on, { complete: false })
    // A host that mounts the workflow pane without `scroll` (its body rows): the drawing reads it and throws.
    const bad = { ...pane(CHART_PANE), surface: 'vscode', props: { ...pane(CHART_PANE).props, scroll: undefined } }
    const wp = await $.ui.mount(bad as any)
    const line: any = await wp.find({ type: 'Text', text: /^lens: the workflow pane could not be drawn \(TypeError/ })
    expect(line).toBeDefined()
    expect(line?.props?.color ?? line?.color).toBe('red')
    await wp.unmount()
    // The same pane, mounted as the host does, still draws.
    const good = await chartPane($)
    expect(await chartSvg(good)).toBeDefined()
    await good.unmount()
  })
})

describe('anomaly markers follow the detector in every drawing', () => {
  test('a hand-back that fails its check while nothing else changes: the mounted card and /ai-dlc:lens pane gain the ▲ on its arrow at the next poll, and lose it when it passes', async ($, on) => {
    const h = heldClock()
    const back = 'docs/handoffs/R/17-agent-manager-to-orchestrator.handback.md'
    const passed = hb('passed', 'handoff 17-orchestrator-to-agent-manager.handoff.md: passed — ok')
    const { files } = await seed($, on, { complete: false, clockEvery: h.clockEvery, files: { 'docs/handoffs/R/run.md': RUN_R('build'), [back]: passed } })
    const card = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT, 'Agent', 500))
    const lens = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    const label = async (ui: any, key: string) => String((await ui.find({ type: 'Button', key }))?.text)
    expect(await label(card, 'card:edge-a1')).toMatch(/^17 /)
    expect(await label(lens, 'edge-a1')).toMatch(/^17 /)
    // Only the record changes; the 2 s poll (an agent is at work) runs the detector and writes nothing else the drawings read.
    files[back] = hb('failed', 'handoff 17-orchestrator-to-agent-manager.handoff.md: failed — no AC list')
    await h.tick()
    await until(async () => /^▲17 /.test(await label(lens, 'edge-a1')) && /^▲17 /.test(await label(card, 'card:edge-a1')))
    expect(await label(card, 'card:edge-a1')).toMatch(/^▲17 /)
    expect(await label(lens, 'edge-a1')).toMatch(/^▲17 /)
    files[back] = passed
    await h.tick()
    await until(async () => /^17 /.test(await label(lens, 'edge-a1')) && /^17 /.test(await label(card, 'card:edge-a1')))
    expect(await label(card, 'card:edge-a1')).toMatch(/^17 /)
    expect(await label(lens, 'edge-a1')).toMatch(/^17 /)
    await card.unmount()
    await lens.unmount()
  })

  test('the chat card and the /ai-dlc:lens pane, already mounted, gain the ▲ when an agent fails and lose it when the stage runs again', async ($, on) => {
    await seed($, on, { complete: false, files: { 'docs/handoffs/R/run.md': RUN_R('build') } })
    const card = await $.ui.mount(toolRow('toolu_1', 'vscode', SE_INPUT, 'Agent', 500))
    const lens = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
    const label = async (ui: any, key: string) => String((await ui.find({ type: 'Button', key }))?.text)
    expect(await label(card, 'card:agent-a1')).toBe('David Fowler')
    expect(await label(lens, 'agent-a1')).toBe('David Fowler')
    // Nothing is pressed and nothing remounted: the detector's write alone redraws both.
    await $.turn.complete({ reason: 'error', answer: '', durationMs: 1, isAborted: false, turnId: 't', agentId: 'a1', usage: null } as any)
    expect(await label(card, 'card:agent-a1')).toBe('▲David Fowler')
    expect(await label(lens, 'agent-a1')).toBe('▲David Fowler')
    const mark: any = ((await card.findAll({ type: 'Text' })) as any[]).find((x: any) => String(x.text) === '▲')
    expect(mark?.props?.color ?? mark?.color).toBe('#c62828')
    // A new software-engineer for run R clears it in both, still mounted.
    await $.agent.spawn({ tool_use_id: 'toolu_3', prompt: `Your handoff record is ${RECORD} (root x).\nAgain.`, description: 'again', subagentType: 'ai-dlc:software-engineer', provider: { plugin: 'ai-dlc', tier: 'user' }, parentModel: 'claude-opus-5-5', background: false, fork: false })
    expect(await label(card, 'card:agent-a1')).toBe('David Fowler')
    expect(await label(lens, 'agent-a1')).toBe('David Fowler')
    await card.unmount()
    await lens.unmount()
  })
})

describe('the pollers run once per session', () => {

  test('a second session.start cancels the first one\'s blink and poll timers: one of each runs, never two', async ($, on) => {
    const h = heldClock()
    await seed($, on, { complete: false, clockEvery: h.clockEvery })
    expect(h.periods.map(p => p.ms).sort((a, b) => a - b)).toEqual([500, 2000])
    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    expect(await h.tick()).toEqual([500, 2000])
    expect(await h.tick()).toEqual([500, 2000])
  })

  test('session.end stops them (exit, resume, logout); at /clear, where no session.start follows, they keep running', async ($, on) => {
    const h = heldClock()
    await seed($, on, { complete: false, clockEvery: h.clockEvery })
    await $.session.end({ reason: 'clear', sessionId: 's-1' } as never)
    expect(await h.tick()).toEqual([500, 2000])
    await $.session.end({ reason: 'prompt_input_exit', sessionId: 's-1' } as never)
    expect(await h.tick(0)).toEqual([])
    // The next session starts them again, once.
    await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
    expect(await h.tick()).toEqual([500, 2000])
  })
})

describe('lookups by agent type never reach Object.prototype; prices and run-state columns', () => {
  test('an agent type or role word named like a prototype member (constructor, toString) gets an ordinary robot, name and role', () => {
    for (const key of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      const r = robotOf(key)
      expect(typeof r.design).toBe('number')
      expect(typeof r.color).toBe('number')
      expect(ROBOT_DESIGNS[r.design]).toBeDefined()
      expect(own({}, key)).toBe(undefined)
    }
    expect(humanRole('ai-dlc:constructor')).toBe('Constructor')
    expect(personaOf({ id: 'a1', name: '', type: 'ai-dlc:constructor' }, {}, undefined)).toBe('Constructor')
    expect(personaOf({ id: 'a1', name: '', type: 'ai-dlc:to-string' }, { 'to-string': 'Ada' }, undefined)).toBe('Ada')
  })

  test('the fast-mode prices never stand in for the standard input and output prices, whatever their order', () => {
    const entry = (pricing: Record<string, number | null>) => ({ models: [{ id: 'claude-x-1', aliases: [], contextWindow: 200000, pricing, longContextPricing: null }] })
    const f = lookupModel(entry({ fastInput: 6, fastOutput: 30, input: 3, output: 15, cacheRead: 0.3, cacheWrite5m: 3.75, cacheWrite1h: 6 }), 'claude-x-1')
    expect([f?.input, f?.output]).toEqual([3, 15])
  })

  test('a blocked step names its record from a Record column, else the run-state template\'s Handback, then Handoff', () => {
    const tpl = (handoff: string, handback: string) =>
      `---\nrun: R\nstatus: active\n---\n\n## Stages\n| Step | Stage | Owner | Mode | Status | Handoff | Handback | Updated |\n|---|---|---|---|---|---|---|---|\n| 3 | build | software-engineer | subagent | blocked · waiting | ${handoff} | ${handback} | 2026-10-23 |\n`
    const recordOf = (text: string) => detectRun('R', text, [], 1).list.map(x => x.record)
    expect(recordOf(tpl('3-orchestrator-to-software-engineer.handoff.md', '3-software-engineer-to-orchestrator.handback.md'))).toEqual(['3-software-engineer-to-orchestrator.handback.md'])
    expect(recordOf(tpl('3-orchestrator-to-software-engineer.handoff.md', '—'))).toEqual(['3-orchestrator-to-software-engineer.handoff.md'])
    expect(recordOf(tpl('—', '—'))).toEqual([''])
  })
})

describe('step 8.2.2.l1: remaining traces of 8.1.6.1.l3 and 8.1.l1 (were 19.6.1.l3 and 19.l1)', () => {
  test('parseRecord takes any mix of step, sub-step and loop segments, and refuses a code that is not one', () => {
    const rec = (code: string) => parseRecord(`docs/handoffs/R/${code}-orchestrator-to-agent-manager.handoff.md`)
    for (const code of ['7', '19.6.1', '1.l2', '1.l2.1', '19.6.1.l2.1', '5.l1.2.l3', '3.1.l1']) {
      expect(rec(code)?.code).toBe(code)
      expect(rec(code)?.from).toBe('orchestrator')
      expect(rec(code)?.to).toBe('agent-manager')
    }
    for (const code of ['l1', 'x.1', '1..2', '1.']) expect(rec(code)).toBe(null)
  })

  test('restingSpawner: only the orchestrator rests; a nested spawner at work keeps the orchestrator blinking, and a done nested spawner does not', () => {
    const main = { id: 'main', status: 'running', type: 'ai-dlc:orchestrator' } as any
    const nestedDone = { id: 'n1', status: 'completed', type: 't', parent: 'main' } as any
    const nestedRunning = { id: 'n2', status: 'running', type: 't', parent: 'n1' } as any
    expect(restingSpawner(main, [nestedDone, nestedRunning]).status).toBe('running')
    expect(restingSpawner(main, [nestedDone, { ...nestedRunning, status: 'completed' }]).status).toBe('idle')
    // A nested spawner is never rested itself, whatever its members do.
    const nested = { ...nestedRunning, id: 'n3' }
    expect(restingSpawner(nested, [nestedDone]).status).toBe('running')
  })

  test('the automatic-notice memory keeps the newest 20: the 21st forgets the oldest, whose turn is then no longer recorded as a notice', async ($, on) => {
    // The engine's own handling of the submit, beneath the lens (the lens observes and passes it on).
    on('prompt.submit', (_$: any, e: any) => ({ text: e.text }))
    await seed($, on, { complete: false, request: 'Ship the lens' })
    const relay = (n: number) => `relay-note-${n} for the cap check`
    // 21 prompts that did not come from the person, in order; each is recorded as a notice.
    for (let n = 0; n < 21; n++) await $.prompt.submit({ text: relay(n), origin: { kind: 'peer' }, isMeta: false } as any)
    const noticeLines = async () => {
      const wp = await chartPane($, 'vscode', false)
      const t = ((await wp.findAll({ type: 'Text' })) as any[]).map((x: any) => String(x.text)).filter(x => /relay-note/.test(x)).join(' ')
      await wp.unmount()
      return t
    }
    // The 20th newest (n = 1) is still remembered: its turn is a notice again (re-added as the newest).
    await $.turn.start({ text: relay(1), turnId: 'cap1' })
    expect(await noticeLines()).toMatch(/relay-note-1 for/)
    // The oldest (n = 0) was dropped from the memory: its turn is not recorded as a notice.
    await $.turn.start({ text: relay(0), turnId: 'cap2' })
    expect(await noticeLines()).not.toMatch(/relay-note-0 for/)
  })
})

// ---- step 29.1: the workflow view's order of runs, and the code review round 2 fixes ----
describe('step 8.5.1: the workflow view lists runs newest start first', () => {
  test('runStartOf: the earliest spawn (a run resumed later keeps its first start); no spawn: the folder date, then run.md started:', () => {
    const at = (id: string, startedAt: number) => ({ id, startedAt })
    const runs = { 'docs/handoffs/X': { title: 'X', status: 'active', stage: '', stages: {}, started: '2026-10-21T08:00:00Z' } }
    // The main loop is never the run's start; a call not started yet (0) is no spawn.
    expect(runStartOf([at('main', 1), at('a1', 500), at('a3', 900), at('p', 0)], ['docs/handoffs/FEAT-20200101-a'], runs)).toBe(500)
    expect(runStartOf([at('p', 0)], ['docs/handoffs/FEAT-20261020-ai-dlc-lens'], {})).toBe(new Date(2026, 9, 20).getTime())
    expect(runStartOf([], ['docs/handoffs/X'], runs)).toBe(Date.parse('2026-10-21T08:00:00Z'))
    expect(runStartOf([], ['docs/handoffs/X'], {})).toBe(null)
    expect(runStartOf([at('main', 7)], [], {})).toBe(null)
    expect(folderDateOf('E:\\repo\\docs\\handoffs\\AAW-20261023-lens-plugin-from-spike')).toBe(new Date(2026, 9, 23).getTime())
    expect(folderDateOf('docs/handoffs/FEAT-20261340-x')).toBe(null)
    expect(folderDateOf('docs/handoffs/R')).toBe(null)
  })

  test('parseRun keeps started: (else created:) only when the front matter sets it', () => {
    expect(parseRun('---\nrun: Q\nstatus: active\nstarted: 2026-10-20 09:15\n---\n# Run: Q\n')?.started).toBe('2026-10-20 09:15')
    expect(parseRun('---\nrun: Q\ncreated: 2026-10-19\n---\n# Run: Q\n')?.started).toBe('2026-10-19')
    expect('started' in parseRun('---\nrun: Q\n---\n# Run: Q\n')!).toBe(false)
  })

  test('newestFirst: three runs at different starts, one resumed later, one known only from disk; ties by run id; no start is newest', () => {
    const t0 = Date.UTC(2026, 9, 23, 10)
    const flows = [
      // Started first, resumed after the others started: still the oldest of the three.
      { w: 'c1', id: 'aaw-20261023-a', start: runStartOf([{ id: 'a1', startedAt: t0 }, { id: 'a4', startedAt: t0 + 3000 }], [], {}) },
      { w: 'c2', id: 'feat-20261023-b', start: t0 + 1000 },
      { w: 'c3', id: 'bflc-20261023-c', start: t0 + 2000 },
      // Known only from disk: its folder date.
      { w: 'c5', id: 'feat-20261001-disk', start: runStartOf([], ['docs/handoffs/FEAT-20261001-disk'], {}) },
      // The same start as c2: by run id, A to Z.
      { w: 'c6', id: 'zz-tie', start: t0 + 1000 },
      // No start known at all (a call not started, no run folder): the newest.
      { w: 'c7', id: 'c7', start: null },
    ]
    expect(newestFirst(flows).map(f => f.w)).toEqual(['c7', 'c3', 'c2', 'c6', 'c1', 'c5'])
    // The input is left as it was.
    expect(flows.map(f => f.w)).toEqual(['c1', 'c2', 'c3', 'c5', 'c6', 'c7'])
  })

  test('in the pane: the wide list, the narrow list and the full-screen Runs: row, newest start first; the selected run stays selected', async ($, on) => {
    await seed($, on, { complete: false, files: RUNS })
    await spawnInto($, 2, 'B')
    // A call into an old run, not started yet: known by its folder's date only.
    await $.tool.call({ tool: 'Agent', subagent_type: 'ai-dlc:agent-manager', description: 'd5', prompt: runBrief('FEAT-20200101-old'), tool_use_id: 'toolu_5' })
    const ui = await wide($)
    expect(await panelKeys(ui)).toEqual(['wf-toolu_2', 'wf-toolu_1', 'wf-toolu_5'])
    await ui.press({ key: 'wf-show-toolu_1' })
    // Run C starts, then run R (the seed's) is resumed: R keeps its first start, so C is on top and R stays below B.
    await spawnInto($, 3, 'C')
    await spawnInto($, 4, 'R', '2')
    expect(await panelKeys(ui)).toEqual(['wf-toolu_3', 'wf-toolu_2', 'wf-toolu_1', 'wf-toolu_5'])
    expect((await ui.find({ type: 'Button', key: 'wf-show-toolu_1' }))?.text).toBe('(shown)')
    await ui.unmount()
    const nr = await narrow($)
    expect(await runRows(nr)).toEqual(['run-toolu_3', 'run-toolu_2', 'run-toolu_1', 'run-toolu_5'])
    await nr.unmount()
    const fs = await wide($)
    await fs.press({ key: 'pane-full' })
    const row = ((await fs.findAll({ type: 'Button' })) as any[]).map((b: any) => String(b.key)).filter(k => /^fs-show-/.test(k))
    expect(row).toEqual(['fs-show-toolu_3', 'fs-show-toolu_2', 'fs-show-toolu_1', 'fs-show-toolu_5'])
    expect(String((await fs.find({ type: 'Button', key: 'fs-show-toolu_1' }))?.text)).toMatch(/^\(.*\)$/)
    await fs.press({ key: 'pane-full' })
    await fs.unmount()
  })
})

describe('step 8.5.1: code review round 2 fixes', () => {
  test("guardPane's fallback (paneFault): the kit's red line; when resolving the kit throws too, the plain red Text element, never a throw", () => {
    const err = new TypeError('x is undefined')
    expect(paneFault('workflow pane', err, line => ({ kit: line }))).toEqual({ kit: 'lens: the workflow pane could not be drawn (TypeError: x is undefined)' })
    expect(
      paneFault('kit pane', err, () => {
        throw new Error('resolve failed')
      }),
    ).toEqual({ type: 'Text', props: { color: 'red' }, children: ['lens: the kit pane could not be drawn (TypeError: x is undefined)'] })
  })

  test('two overlapping session.starts leave one blink timer and one poller, never two', async ($, on) => {
    const h = heldClock()
    await seed($, on, { complete: false, clockEvery: h.clockEvery })
    // The second starts while the first still awaits its settings, roster and costing reads.
    await Promise.all([$.session.start({ cwd: '/', surface: 'vscode', isInteractive: true }), $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })])
    expect(await h.tick()).toEqual([500, 2000])
    expect(await h.tick()).toEqual([500, 2000])
  })

  test('an arrow with no record named: the time-order hint is searched under artifacts.handoffs, not a fixed docs/handoffs', async ($, on) => {
    const workflow = JSON.stringify({ artifacts: { handoffs: 'work/runs/{LIFECYCLE}-{YYYYMMDD}-{feature-slug}' } })
    await seed($, on, {
      parallel: true,
      files: { '.ai-dlc/workflow.json': workflow },
      list: {
        'work/runs': ['FEAT-20261023-x/'],
        'work/runs/FEAT-20261023-x': ['3-orchestrator-to-sqa-engineer.handoff.md'],
        'docs/handoffs': ['R/'],
        'docs/handoffs/R': ['3-orchestrator-to-sqa-engineer.handoff.md'],
      },
      listMtime: Date.now(),
    })
    const wp = await chartPane($)
    await wp.press({ key: 'edge-a2' })
    await wp.unmount()
    const edge = await $.ui.mount({ ...pane('ai-dlc-lens-edge'), surface: 'vscode' })
    expect(await edge.find({ type: 'Text', text: /not named in the brief: work\/runs\/FEAT-20261023-x\/3-orchestrator-to-sqa-engineer\.handoff\.md$/ })).toBeDefined()
    expect(await edge.find({ type: 'Text', text: /docs\/handoffs\/R\/3-orchestrator-to-sqa-engineer/ })).toBe(undefined)
    await edge.unmount()
  })
})
// ---- step 27.1: a run with parent: is drawn in its parent's chart ----
/** A run.md (as `RUN_MD`) whose front matter names its parent run, and optionally its run status. */
const CHILD_MD = (title: string, parent: string, status = 'active') => RUN_MD(title, status).replace(/^(---\nrun: [^\n]*\n)/, `$1parent: ${parent}\n`)
const runOf = (title: string, parent?: string) => ({ title, status: 'active', stage: '', stages: {}, ...(parent !== undefined ? { parent } : {}) })
const member = (id: string, run: string, startedAt: number) => ({ id, type: 'ai-dlc:agent-manager', status: 'running', startedAt, handoff: `docs/handoffs/${run}/1-orchestrator-to-agent-manager.handoff.md`, prompt: '' }) as any

describe('step 8.4.1: a related run with parent: joins its parent run (pure)', () => {
  test('parseRun keeps parent: as the folder name (backticks, quotes and a path dropped), and only when set', () => {
    expect(parseRun(CHILD_MD('run C', 'FEAT-20261020-ai-dlc-lens'))?.parent).toBe('FEAT-20261020-ai-dlc-lens')
    expect(parseRun('---\nrun: C\nparent: `docs/handoffs/FEAT-20261020-x`\n---\n# Run: C\n')?.parent).toBe('FEAT-20261020-x')
    expect(parseRun('---\nrun: C\nparent: "P"\n---\n# Run: C\n')?.parent).toBe('P')
    expect('parent' in parseRun(RUN_MD('run P'))!).toBe(false)
    expect('parent' in parseRun('---\nrun: C\nparent:\n---\n# Run: C\n')!).toBe(false)
  })

  test('runRoots: a child joins its known parent; an unknown parent leaves it alone; a chain of two goes to the top; a cycle stays apart and ends', () => {
    const d = (x: string) => `docs/handoffs/${x}`
    // Known parent; unknown parent (no run.md, no call).
    expect(runRoots({ [d('P')]: runOf('P'), [d('C')]: runOf('C', 'P') })).toEqual({ c: 'p' })
    expect(runRoots({ [d('C')]: runOf('C', 'NOPE') })).toEqual({})
    // A parent known only from a call (no run.md read).
    expect(runRoots({ [d('C')]: runOf('C', 'P') }, ['p'])).toEqual({ c: 'p' })
    // A chain of two: C -> B -> A, each to the top; an unknown top stops at the last known run.
    expect(runRoots({ [d('A')]: runOf('A'), [d('B')]: runOf('B', 'A'), [d('C')]: runOf('C', 'B') })).toEqual({ b: 'a', c: 'a' })
    expect(runRoots({ [d('B')]: runOf('B', 'GONE'), [d('C')]: runOf('C', 'B') })).toEqual({ c: 'b' })
    // Cycles: X <-> Y, a run its own parent, and a run whose chain enters a cycle: each stays its own run.
    expect(runRoots({ [d('X')]: runOf('X', 'Y'), [d('Y')]: runOf('Y', 'X') })).toEqual({})
    expect(runRoots({ [d('S')]: runOf('S', 'S') })).toEqual({})
    expect(runRoots({ [d('X')]: runOf('X', 'Y'), [d('Y')]: runOf('Y', 'X'), [d('Z')]: runOf('Z', 'X') })).toEqual({})
  })

  test("joinWorkflow and unifyRuns with roots: the child call joins the parent run's workflow; callRunIds gives the parent", () => {
    const keys = { p1: 'run:docs/handoffs/P', q1: 'run:docs/handoffs/Q', c1: 'run:docs/handoffs/C' }
    const roots = { c: 'p' }
    let wf = WF0
    for (const c of ['p1', 'q1', 'c1']) wf = joinWorkflow(wf, 'main', c, {}, {}, keys, {}, roots)
    expect(wf.order).toEqual(['p1', 'q1'])
    expect(wf.of['c1']).toBe('p1')
    expect(callRunIds(wf, keys, {}, {}, roots)['c1']).toBe('p')
    // Without roots (an unknown parent) the child is its own workflow; roots given later merge it on read.
    let alone = WF0
    for (const c of ['p1', 'q1', 'c1']) alone = joinWorkflow(alone, 'main', c, {}, {}, keys)
    expect(alone.order).toEqual(['p1', 'q1', 'c1'])
    expect(unifyRuns(alone, keys, {}, {}, roots).order).toEqual(['p1', 'q1'])
    expect(unifyRuns(alone, keys, {}, {}, roots).of['c1']).toBe('p1')
  })

  test("workflowRunOf: the top run's id and start; the child's later spawns never move it; a parent known only from disk gives its folder date", () => {
    const runs = { 'docs/handoffs/P': runOf('run P'), 'docs/handoffs/C': runOf('run C', 'P') }
    const roots = { c: 'p' }
    expect(workflowRunOf([member('a1', 'P', 100), member('a2', 'C', 50)], runs, roots)).toEqual({ id: 'p', start: 100 })
    // No child: as before.
    expect(workflowRunOf([member('a1', 'P', 100)], runs, {})).toEqual({ id: 'p', start: 100 })
    // Only the child's agents in the lens: the parent's folder date.
    const disk = { 'docs/handoffs/FEAT-20261001-p': runOf('run P'), 'docs/handoffs/C': runOf('run C', 'FEAT-20261001-p') }
    expect(workflowRunOf([member('a2', 'C', 50)], disk, { c: 'feat-20261001-p' })).toEqual({ id: 'feat-20261001-p', start: new Date(2026, 9, 1).getTime() })
    // Nothing of the parent gives a start: the child's own spawn, never null.
    expect(workflowRunOf([member('a2', 'C', 50)], runs, roots)).toEqual({ id: 'p', start: 50 })
  })

  test("workflowTasks labels a child run's stages with its folder name; workflowTask titles the workflow by the parent run", () => {
    const runs = { 'docs/handoffs/P': parseRun(RUN_MD('run P'))!, 'docs/handoffs/C': parseRun(CHILD_MD('run C', 'P'))! }
    const members = [member('a1', 'P', 1), member('a2', 'C', 2)]
    expect(workflowTasks(members, runs, 'x', { c: 'p' }).map(t => t.title)).toEqual(['change it', 'C: change it'])
    expect(workflowTask(members, runs, 'the request', { c: 'p' }).parent).toBe('run P')
    // Without roots, two runs: no single title.
    expect(workflowTask(members, runs, 'the request').parent).toBe('the request')
  })

  test("anomalies: a child run's anomaly keeps the child run, and is among the merged workflow's", () => {
    const blocked = detectRun('docs/handoffs/C', CHILD_MD('run C', 'P', 'blocked'), [], 1).list
    expect(blocked.length).toBeGreaterThan(0)
    expect(blocked.every(a => a.run === 'docs/handoffs/C')).toBe(true)
    expect(anomalyLine(blocked[0]!)).toMatch(/\(run C\b/)
    expect(anomaliesOf(blocked, ['docs/handoffs/P', 'docs/handoffs/C'], []).map(a => a.run)).toEqual(blocked.map(() => 'docs/handoffs/C'))
  })
})

describe('step 8.4.1: a related run with parent: in the lens', () => {
  const FAMILY = { ...RUNS, 'docs/handoffs/P/run.md': RUN_MD('run P'), 'docs/handoffs/Q/run.md': RUN_MD('run Q'), 'docs/handoffs/C/run.md': CHILD_MD('run C', 'P') }

  test("one workflow: the child's steps are drawn in the parent's workflow, each chart labelled with the child run, and it is not listed alone (wide and narrow)", async ($, on) => {
    await seed($, on, { complete: false, files: FAMILY })
    await spawnInto($, 2, 'P')
    await spawnInto($, 3, 'C')
    const wp = await $.ui.mount({ ...pane(CHART_PANE, 'dock', 120), surface: 'vscode' })
    expect(await panelKeys(wp)).toEqual(['wf-toolu_2', 'wf-toolu_1'])
    await wp.press({ key: 'wf-show-toolu_2' })
    await wp.press({ key: 'wf-toolu_2' })
    // Step 30.1: P's steps and C's (each folder lists step 17's records), all in run P's workflow; C keeps its
    // own step numbers under its name. Live spawns first, newest first; then the steps from records.
    const charts = await runCharts(wp)
    expect(await stepKeys(wp)).toEqual(['17', '1', 'c:17', 'c:1'])
    expect(charts.every(c => c.alt.endsWith(': run P'))).toBe(true)
    // Each step: the step and its agent.
    expect(charts.map(c => nodes(c.src))).toEqual([2, 2, 2, 2])
    const texts = ((await wp.findAll({ type: 'Text' })) as any[]).map((x: any) => String(x.text))
    expect(texts).toContain('Step 1 · change it')
    expect(texts).toContain('C: Step 1 · change it')
    await wp.unmount()
    const nw = await narrow($)
    expect(await runRows(nw)).toEqual(['run-toolu_2', 'run-toolu_1'])
    await nw.unmount()
  })

  test('a parent known only from disk (no spawn into it this session): the child is drawn as the parent run, once', async ($, on) => {
    await seed($, on, { complete: false, files: FAMILY })
    await spawnInto($, 3, 'C')
    const wp = await $.ui.mount({ ...pane(CHART_PANE, 'dock', 120), surface: 'vscode' })
    expect(await panelKeys(wp)).toEqual(['wf-toolu_3', 'wf-toolu_1'])
    await wp.press({ key: 'wf-show-toolu_3' })
    expect(await stepKeys(wp)).toEqual(['17', 'c:17', 'c:1'])
    expect((await runCharts(wp)).every(c => c.alt.endsWith(': run P'))).toBe(true)
    await wp.unmount()
  })

  test('an unknown parent: the child stays its own run, never lost', async ($, on) => {
    await seed($, on, { complete: false, files: { ...FAMILY, 'docs/handoffs/C/run.md': CHILD_MD('run C', 'NOPE') } })
    await spawnInto($, 2, 'P')
    await spawnInto($, 3, 'C')
    const wp = await $.ui.mount({ ...pane(CHART_PANE, 'dock', 120), surface: 'vscode' })
    expect(await panelKeys(wp)).toEqual(['wf-toolu_3', 'wf-toolu_2', 'wf-toolu_1'])
    await wp.press({ key: 'wf-show-toolu_3' })
    expect((await runCharts(wp)).map(c => c.alt)).toEqual(['Step chart 17: run C', 'Step chart 1: run C'])
    await wp.unmount()
  })

  test("a chain of two: C -> B -> A, B only on disk; C is drawn in A's chart", async ($, on) => {
    await seed($, on, { complete: false, files: { ...RUNS, 'docs/handoffs/B/run.md': CHILD_MD('run B', 'A'), 'docs/handoffs/C/run.md': CHILD_MD('run C', 'B') } })
    await spawnInto($, 2, 'A')
    await spawnInto($, 3, 'C')
    const wp = await $.ui.mount({ ...pane(CHART_PANE, 'dock', 120), surface: 'vscode' })
    expect(await panelKeys(wp)).toEqual(['wf-toolu_2', 'wf-toolu_1'])
    await wp.press({ key: 'wf-show-toolu_2' })
    const charts = await runCharts(wp)
    expect(await stepKeys(wp)).toEqual(['17', '1', 'b:17', 'c:17', 'c:1'])
    expect(charts.every(c => c.alt.endsWith(': run A'))).toBe(true)
    await wp.unmount()
  })

  test('a cycle (X -> Y -> X) does not loop: both runs stay their own', async ($, on) => {
    await seed($, on, { complete: false, files: { 'docs/handoffs/X/run.md': CHILD_MD('run X', 'Y'), 'docs/handoffs/Y/run.md': CHILD_MD('run Y', 'X') } })
    await spawnInto($, 2, 'X')
    await spawnInto($, 3, 'Y')
    const wp = await wide($)
    expect(await panelKeys(wp)).toEqual(['wf-toolu_3', 'wf-toolu_2', 'wf-toolu_1'])
    await wp.unmount()
  })

  test("the order takes the parent's start: P, then Q, then a later spawn into C (child of P): Q stays on top", async ($, on) => {
    await seed($, on, { complete: false, files: FAMILY })
    await spawnInto($, 2, 'P')
    await spawnInto($, 3, 'Q')
    await spawnInto($, 4, 'C')
    const wp = await wide($)
    expect(await panelKeys(wp)).toEqual(['wf-toolu_3', 'wf-toolu_2', 'wf-toolu_1'])
    await wp.unmount()
  })

  test("anomalies keep the child id: a blocked child run is reported as its own run, and marked on the parent run's panel", async ($, on) => {
    const { toasts } = await seed($, on, { complete: false, files: { ...FAMILY, 'docs/handoffs/C/run.md': CHILD_MD('run C', 'P', 'blocked') } })
    await spawnInto($, 2, 'P')
    await spawnInto($, 3, 'C')
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
    expect(toasts.some(x => /Run blocked \(run C\b/.test(x))).toBe(true)
    const wp = await $.ui.mount({ ...pane(CHART_PANE, 'dock', 120), surface: 'vscode' })
    expect(await panelKeys(wp)).toEqual(['wf-toolu_2', 'wf-toolu_1'])
    await wp.press({ key: 'anomalies' })
    expect(await wp.find({ type: 'Text', text: /^Run blocked \(run C\b/ })).toBeDefined()
    expect(((await wp.findAll({ type: 'Text' })) as any[]).some((x: any) => /^▲/.test(String(x.text)))).toBe(true)
    await wp.unmount()
  })
})
// ---- step 27.1 addendum L1: the live session after its runs were merged into FEAT-20261020-ai-dlc-lens ----
// Session 5bbdde00 (2026-10-23, its transcript): briefs from before the merge name three run folders that no
// longer exist (L_RUN, D_RUN, V_RUN); each old run state is kept in the FEAT folder as `merged-from-<run>.md`.
// One orchestrator spawned every agent, so the merged run's chart had one level of 42 agents. Its run.md
// records decided gates in words, with a date. Tool-use and agent ids are anonymised.
const F_RUN = 'FEAT-20261020-ai-dlc-lens'
const F_MD = STAGES_MD('run-state CLI, gate alert and the ai-dlc-lens mod plugin', [
  ['26', 'related work joins the parent run', 'agent-manager'],
  ['27.1', 'lens: a related run with `parent:` is drawn in its parent\'s chart', 'agent-manager'],
])
/** The FEAT folder after the merge: its run.md and the three old run states; the old folders are gone. */
const MERGED_FILES = {
  [`docs/handoffs/${F_RUN}/run.md`]: F_MD,
  [`docs/handoffs/${F_RUN}/merged-from-${L_RUN}.md`]: L_MD,
  [`docs/handoffs/${F_RUN}/merged-from-${D_RUN}.md`]: D_MD,
  [`docs/handoffs/${F_RUN}/merged-from-${V_RUN}.md`]: V_MD,
}
const MERGED_LIST = {
  'docs/handoffs': [`${F_RUN}/`],
  [`docs/handoffs/${F_RUN}`]: ['run.md', `merged-from-${L_RUN}.md`, `merged-from-${D_RUN}.md`, `merged-from-${V_RUN}.md`, '26-orchestrator-to-agent-manager.handoff.md'],
}
/** The session's spawns in their real order, three old runs then FEAT; returns how many agents. */
async function replayMerged($: any): Promise<number> {
  await spawnReal($, 2, L_RUN, '1.6.1.l1', 'agent-manager')
  await spawnReal($, 3, D_RUN, '1.l1', 'agent-manager')
  await spawnReal($, 4, L_RUN, '2.1', 'brutal-critique')
  await spawnReal($, 5, V_RUN, '2.1', 'brutal-critique')
  await spawnReal($, 6, F_RUN, '26', 'agent-manager')
  await spawnReal($, 7, F_RUN, '27.1', 'agent-manager')
  return 6
}

describe('step 8.4.1 addendum L1: runs merged away, the wide chart, gates decided in words (pure)', () => {
  test('mergedHomeOf: the run folder that keeps merged-from-<run>.md (any case); none, or only the folder itself: null', () => {
    const folders = [
      { dir: 'docs/handoffs/AAW-20261021-x', names: ['run.md'] },
      { dir: `docs/handoffs/${F_RUN}`, names: ['run.md', `merged-from-${L_RUN}.md`, `Merged-From-${D_RUN.toUpperCase()}.md`] },
    ]
    expect(mergedHomeOf(`docs/handoffs/${L_RUN}`, folders)).toEqual({ home: `docs/handoffs/${F_RUN}`, file: `merged-from-${L_RUN}.md` })
    expect(mergedHomeOf(`E:\\repo\\docs\\handoffs\\${D_RUN}`, folders)?.file).toBe(`Merged-From-${D_RUN.toUpperCase()}.md`)
    expect(mergedHomeOf(`docs/handoffs/${V_RUN}`, folders)).toBe(null)
    expect(mergedHomeOf('', folders)).toBe(null)
    expect(mergedHomeOf(`docs/handoffs/${F_RUN}`, [{ dir: `docs/handoffs/${F_RUN}`, names: [`merged-from-${F_RUN}.md`] }])).toBe(null)
  })

  test('layout: one level of 23 agents wraps to rows of chartAvatarsPerRow (default 8); every avatar has its own place; a small chart is unchanged', () => {
    const agents: Record<string, any> = { main: { id: 'main', parent: null } }
    const ids = ['main']
    for (let i = 1; i <= 23; i++) {
      agents[`a${i}`] = { id: `a${i}`, parent: 'main' }
      ids.push(`a${i}`)
    }
    const l = layout(ids, agents)
    // Before: 2640 x 182, one row of 23 (the live chart, shrunk to an unreadable strip).
    expect(SIZE0.perRow).toBe(8)
    expect([l.width, l.height]).toEqual([8 * SIZE0.col, 4 * SIZE0.row - 10])
    expect(new Set(l.placed.map(p => `${p.x},${p.y}`)).size).toBe(24)
    expect(Math.max(...l.placed.map(p => p.x))).toBeLessThan(l.width)
    // The spawner's row is above every wrapped row of its agents.
    const y = (id: string) => l.placed.find(p => p.id === id)!.y
    expect(['a1', 'a8', 'a9', 'a23'].map(y)).toEqual([y('main') + SIZE0.row, y('main') + SIZE0.row, y('main') + 2 * SIZE0.row, y('main') + 3 * SIZE0.row])
    // Three agents: as before, one row as wide as it needs.
    const small = layout(['main', 'a1', 'a2', 'a3'], agents)
    expect([small.width, small.height]).toEqual([3 * SIZE0.col, 2 * SIZE0.row - 10])
    // Step 27.2: a custom value wraps there: 23 agents in rows of 5 are 5 rows under the spawner's.
    const five = layout(ids, agents, { ...SIZE0, perRow: 5 })
    expect([five.width, five.height]).toEqual([5 * SIZE0.col, 6 * SIZE0.row - 10])
    const y5 = (id: string) => five.placed.find(p => p.id === id)!.y
    expect(['a5', 'a6', 'a21', 'a23'].map(y5)).toEqual([1, 2, 5, 5].map(n => y5('main') + n * SIZE0.row))
    expect(new Set(five.placed.map(p => `${p.x},${p.y}`)).size).toBe(24)
  })

  test('[8.4.2] chartAvatarsPerRow: default 8, local env > project env > lens.json; out of range falls through with the usual warning (bounds: step 8.6.3 suite)', () => {
    const env = (where: string, v: string) => envLevel(where, JSON.stringify({ env: { AI_DLC_LENS_CHART_AVATARS_PER_ROW: v } })).level
    const file = (v: unknown) => fileLevel('.ai-dlc/lens.json', JSON.stringify({ chartAvatarsPerRow: v })).level
    expect(envName('chartAvatarsPerRow')).toBe('AI_DLC_LENS_CHART_AVATARS_PER_ROW')
    expect([DEFAULTS.chartAvatarsPerRow, resolve([]).sources.chartAvatarsPerRow]).toEqual([8, 'default'])
    const r = resolve([env('.claude/settings.local.json', '12'), env('.claude/settings.json', '6'), file(4)])
    expect([r.settings.chartAvatarsPerRow, r.sources.chartAvatarsPerRow]).toEqual([12, '.claude/settings.local.json env'])
    // Out of range in the local env: the project env's value wins, and the warning names the env entry.
    const o = resolve([env('.claude/settings.local.json', '30'), env('.claude/settings.json', '6'), file(4)])
    expect([o.settings.chartAvatarsPerRow, o.sources.chartAvatarsPerRow]).toEqual([6, '.claude/settings.json env'])
    expect(o.ignored).toEqual(['.claude/settings.local.json env: AI_DLC_LENS_CHART_AVATARS_PER_ROW = "30" is invalid, ignored'])
    const f = resolve([file(1)])
    expect([f.settings.chartAvatarsPerRow, f.ignored]).toEqual([8, ['.ai-dlc/lens.json: chartAvatarsPerRow = 1 is invalid, ignored']])
    const p = (schema().properties as any).chartAvatarsPerRow
    expect([p.type, p.minimum, p.maximum, p.default]).toEqual(['integer', 2, 24, 8])
    expect(p.description).toContain('AI_DLC_LENS_CHART_AVATARS_PER_ROW')
    expect(JSON.parse(initialFile()).chartAvatarsPerRow).toBe(8)
    expect(JSON.parse(setKey(null, 'chartAvatarsPerRow', '5').text).chartAvatarsPerRow).toBe(5)
  })

  test('gates: rows the human decided in words, with a date (the live run.md), are not waiting; an empty, dash, pending or undated decision still is', () => {
    const live = [
      '| Spike 027 human check (card in chat) | human | **missed**: card shows in the chat but not as expected | human | 2026-10-23 |',
      '| Order | human | spike 027 rework first, then the scope pass | human | 2026-10-23 |',
      '| cost display / pricing | human | cost only from `.ai-dlc/model-costing.json` | human | 2026-10-23 |',
      '| lens settings | human | **changed** (supersedes 00b L3 "user level") | human | 2026-10-23 |',
      '| G2, G3, G4, release | human | pending | — | — |',
    ].join('\n')
    expect(detectRun('R', runMd('active', live), [], 1).list.map(x => [x.kind, x.step])).toEqual([['gateWaiting', 'G2']])
    expect(gateUndecided('', '')).toBe(true)
    expect(gateUndecided('—', '2026-10-23')).toBe(true)
    expect(gateUndecided('**waiting** for the human', '2026-10-23')).toBe(true)
    expect(gateUndecided('spike first', '—')).toBe(true)
    expect(gateUndecided('spike first', '2026-10-23')).toBe(false)
  })
})

describe('step 8.4.1 addendum L1: the live session after the merge (in the lens)', () => {
  test('briefs naming merged-away run folders join the run that keeps their merged-from file: one workflow, one chart, each old stage labelled with its old run', async ($, on) => {
    await seed($, on, { complete: false, files: MERGED_FILES, list: MERGED_LIST })
    const n = await replayMerged($)
    const wp = await $.ui.mount({ ...pane(CHART_PANE, 'dock', 120), surface: 'vscode' })
    // The seed's run R and the merged run: the three old runs are not listed alone.
    expect(await panelKeys(wp)).toEqual(['wf-toolu_2', 'wf-toolu_1'])
    await wp.press({ key: 'wf-show-toolu_2' })
    await wp.press({ key: 'wf-toolu_2' })
    // Step 30.1: FEAT's run.md has no offset for the merged runs here, so each keeps its own step numbers, under
    // its name; FEAT's steps 26 and 27 with them. Newest spawn first.
    const charts = await runCharts(wp)
    const l = L_RUN.toLowerCase()
    const d = D_RUN.toLowerCase()
    const v = V_RUN.toLowerCase()
    expect(await stepKeys(wp)).toEqual(['27', '26', `${l}:2`, `${l}:1`, `${d}:1`, `${v}:2`])
    expect(charts.every(c => c.alt.endsWith(': run-state CLI, gate alert and the ai-dlc-lens mod plugin'))).toBe(true)
    // Every agent once, each under its step: n agents and one step node per chart, plus 1.6 and 1.6.1 for L's 1.6.1.l1.
    expect(charts.map(c => nodes(c.src)).reduce((x, y) => x + y, 0)).toBe(n + charts.length + 2)
    const texts = ((await wp.findAll({ type: 'Text' })) as any[]).map((x: any) => String(x.text))
    expect(texts).toContain(`${L_RUN}: Step 1 · anomaly detector: blocked steps; A5 one chart per run`)
    expect(texts).toContain(`${D_RUN}: Step 1 · plugin-management README work`)
    expect(texts).toContain(`${V_RUN}: Step 2 · critique (docs)`)
    expect(texts).toContain('Step 26 · related work joins the parent run')
    await wp.unmount()
  })

  test('no merged-from file for a missing run folder: that run stays its own, never lost', async ($, on) => {
    const list = { ...MERGED_LIST, [`docs/handoffs/${F_RUN}`]: ['run.md', `merged-from-${L_RUN}.md`] }
    await seed($, on, { complete: false, files: MERGED_FILES, list })
    await replayMerged($)
    const wp = await wide($)
    // D and V stay apart; L joined FEAT (its workflow is L's first call, toolu_2) and takes FEAT's start,
    // the newest: FEAT, then V, then D.
    expect(await panelKeys(wp)).toEqual(['wf-toolu_2', 'wf-toolu_5', 'wf-toolu_3', 'wf-toolu_1'])
    await wp.unmount()
  })

  test('step 30 of a merged run (test data), 42 sub-steps spawned by one orchestrator, is drawn at most chartAvatarsPerRow (default 8) avatars wide', HEAVY, async ($, on) => {
    await seed($, on, { complete: true, files: MERGED_FILES, list: MERGED_LIST })
    for (let i = 0; i < 42; i++) await spawnReal($, 2 + i, F_RUN, `30.${1 + i}`, 'agent-manager')
    const wp = await $.ui.mount({ ...pane(CHART_PANE, 'dock', 120), surface: 'vscode' })
    expect(await panelKeys(wp)).toEqual(['wf-toolu_2', 'wf-toolu_1'])
    await wp.press({ key: 'wf-show-toolu_2' })
    const svg: any = ((await wp.findAll({ type: 'Svg' })) as any[]).find((x: any) => /^Step chart 30:/.test(String(x?.props?.alt ?? '')))
    expect(Number(svg?.props?.width)).toBe(8 * SIZE0.col)
    expect(nodes(String(svg?.props?.source ?? ''))).toBe(43)
    await wp.unmount()
  })

  for (const [what, value, wide] of [
    ['a custom value wraps there', 5, 5],
    ['out of range falls back to the default, with the warning', 30, 8],
  ] as const)
    test(`[8.4.2] chartAvatarsPerRow in lens.json: ${what}`, HEAVY, async ($, on) => {
      await seed($, on, { complete: true, files: { ...MERGED_FILES, ...lensJson({ chartAvatarsPerRow: value }) }, list: MERGED_LIST })
      for (let i = 0; i < 42; i++) await spawnReal($, 2 + i, F_RUN, `30.${1 + i}`, 'agent-manager')
      const wp = await $.ui.mount({ ...pane(CHART_PANE, 'dock', 120), surface: 'vscode' })
      await wp.press({ key: 'wf-show-toolu_2' })
      const svg: any = ((await wp.findAll({ type: 'Svg' })) as any[]).find((x: any) => /^Step chart 30:/.test(String(x?.props?.alt ?? '')))
      expect(Number(svg?.props?.width)).toBe(wide * SIZE0.col)
      expect(nodes(String(svg?.props?.source ?? ''))).toBe(43)
      await wp.unmount()
      const lens = await $.ui.mount({ ...pane('ai-dlc-lens'), surface: 'vscode' })
      await lens.press({ key: 'lens-settings' })
      expect(await lens.find({ type: 'Text', text: `chartAvatarsPerRow = ${wide}` })).toBeDefined()
      const warned = await lens.find({ type: 'Text', text: /^chartAvatarsPerRow = 30 is invalid, ignored$/ })
      expect(warned !== undefined).toBe(value === 30)
      await lens.unmount()
    })
})

// ---------------- step 27.4 (sqa-engineer): gaps found while tracing items 27 and 29 to tests ----------------
describe('step 8.4.4: gateUndecided words the README names, and the parent chain cap', () => {
  test('[8.4 README] a decision that says pending, waiting, open, tbd, todo, to do or not yet is undecided, in any case or emphasis; a decision in other words with a date is decided', () => {
    for (const w of ['pending', 'Pending', '**pending**', '`waiting`', 'waiting for the human', 'open', 'OPEN', 'tbd', 'TBD', 'todo', 'to do', 'not yet', 'Not yet decided'])
      expect([w, gateUndecided(w, '2026-10-23')]).toEqual([w, true])
    for (const w of ['changed', 'spike 027 rework first, then the scope pass', 'missed: card shows in the chat', 'approved', 'todos are cleared', 'to double-check later'])
      expect([w, gateUndecided(w, '2026-10-23')]).toEqual([w, false])
    // Only an empty, dash or placeholder date makes a worded decision undecided.
    for (const d of ['', '—', '–', '-', ' ', '**—**']) expect([d, gateUndecided('changed', d)]).toEqual([d, true])
  })

  test('[8.4 README] detectRun: a worded, dated gate row is not waiting, each undecided form is, per row; an approver other than the human never is', () => {
    const row = (name: string, approver: string, decision: string, date: string) => `| ${name} | ${approver} | ${decision} | h | ${date} |`
    const waits = (rows: string[]) => detectRun('R', runMd('active', rows.join('\n')), [], 1).list.map(x => [x.kind, x.step])
    expect(waits([row('G1', 'human', 'scope cut to two items', '2026-10-23')])).toEqual([])
    expect(waits([row('G1', 'human', 'tbd', '2026-10-23')])).toEqual([['gateWaiting', 'G1']])
    expect(waits([row('G1', 'human', 'todo', '2026-10-23')])).toEqual([['gateWaiting', 'G1']])
    expect(waits([row('G1', 'human', 'open', '2026-10-23')])).toEqual([['gateWaiting', 'G1']])
    expect(waits([row('G1', 'human', 'not yet', '2026-10-23')])).toEqual([['gateWaiting', 'G1']])
    expect(waits([row('G1', 'human', 'scope cut to two items', '')])).toEqual([['gateWaiting', 'G1']])
    expect(waits([row('G1', 'orchestrator', 'pending', '')])).toEqual([])
    // The last row of a gate decides: a worded, dated row after an empty one clears it.
    expect(waits([row('G2', 'human', '', ''), row('G2', 'human', 'go, with the cap as a setting', '2026-10-24')])).toEqual([])
  })

  test('[8.4.1] runRoots: a chain of parents deeper than PARENT_DEPTH stops there and is not a cycle; the child is still drawn in the run it reached', () => {
    const n = PARENT_DEPTH + 4
    const runs: Record<string, any> = {}
    for (let i = 0; i < n; i++) runs[`docs/handoffs/FEAT-20261020-r${i}`] = { title: `r${i}`, status: 'active', stage: '', stages: {}, ...(i < n - 1 ? { parent: `FEAT-20261020-r${i + 1}` } : {}) }
    const roots = runRoots(runs)
    expect(roots[runIdOf('FEAT-20261020-r0')]).toBe(runIdOf(`FEAT-20261020-r${PARENT_DEPTH}`))
    // The top run itself has no root.
    expect(roots[runIdOf(`FEAT-20261020-r${n - 1}`)]).toBeUndefined()
  })
})

describe('step 8.4.4: chartAvatarsPerRow reaches the chat card and full screen (README: "the workflow view, the chat card and full screen")', () => {
  test('full screen: 42 agents wrap at the setting, drawn at the enlarged column width; the chat card wraps at the setting too', HEAVY, async ($, on) => {
    await seed($, on, { complete: true, files: { ...MERGED_FILES, ...lensJson({ chartAvatarsPerRow: 5 }) }, list: MERGED_LIST })
    for (let i = 0; i < 42; i++) await spawnReal($, 2 + i, F_RUN, `30.${1 + i}`, 'agent-manager')
    const widthOf = (x: any): number => Number(x?.props?.width ?? /width="(\d+(?:\.\d+)?)"/.exec(String(x?.props?.source ?? ''))?.[1] ?? NaN)
    const ui = await $.ui.mount({ ...pane(CHART_PANE, 'dock', 100), surface: 'vscode', viewport: { columns: 400, rows: 80 } })
    await ui.press({ key: 'wf-show-toolu_2' })
    await ui.press({ key: 'pane-full' })
    const big: any = ((await ui.findAll({ type: 'Svg' })) as any[]).find((x: any) => /^Full screen chart 30:/.test(String(x?.props?.alt ?? '')))
    expect(big).toBeDefined()
    expect(nodes(String(big?.props?.source ?? ''))).toBe(43)
    // Full screen enlarges the columns (x1.5, at most 400 px) and keeps the count: 5 wide, not 8 and not 43.
    expect(widthOf(big)).toBe(5 * Math.min(400, Math.round(SIZE0.col * 1.5)))
    await ui.unmount()
    const card = await $.ui.mount(toolRow('toolu_2', 'vscode', { subagent_type: 'ai-dlc:agent-manager', description: 'first', prompt: 'p' }, 'Agent', 300))
    const chat: any = ((await card.findAll({ type: 'Svg' })) as any[]).find((x: any) => /^Chat chart/.test(String(x?.props?.alt ?? '')))
    expect(chat).toBeDefined()
    expect(widthOf(chat)).toBe(5 * SIZE0.col)
    await card.unmount()
  })
})

// ---------------- step 8.6.1 (was 30.1) and 8.6.1.l1: one flowchart per feature root, sub-steps under their parent ----------------
/**
 * The record folder of run FEAT-20261020-ai-dlc-lens as it is on 2026-10-24 after the phase renaming (step 8.2.l15.1):
 * every file name, copied from disk (`ls docs/handoffs/FEAT-20261020-ai-dlc-lens`, 291 files), including the files that
 * are not records (plans, the gap analysis, run.v1.md, the merged-from run states, the rename map) and this step's own
 * handoff (8.2.l15.1). Feature roots 1 to 12, each with its phases N.1 to N.5, loops `l<k>` and rounds as sub-numbers.
 */
const FEAT_NAMES = `
  00-approved-plan.md 00b-approved-plan-2026-10-22.md 1.1-orchestrator-to-product-manager.handoff.md
  1.1-orchestrator-to-research-assistant.handoff.md 1.1.l1.1.1-orchestrator-to-research-assistant.handoff.md
  1.1.l1.1.1-research-assistant-to-orchestrator.handback.md 1.1.l1.1.2-orchestrator-to-research-assistant.handoff.md
  1.1.l1.1.2-research-assistant-to-orchestrator.handback.md 1.1.l1.1.3-orchestrator-to-research-assistant.handoff.md
  1.1.l1.1.3-research-assistant-to-orchestrator.handback.md 1.1.l1.1.4-orchestrator-to-research-assistant.handoff.md
  1.1.l1.1.4-research-assistant-to-orchestrator.handback.md 1.1.l1.1.5-orchestrator-to-research-assistant.handoff.md
  1.1.l1.1.5-research-assistant-to-orchestrator.handback.md 1.1.l1.2-orchestrator-to-product-manager.handoff.md
  1.1.l1.2-product-manager-to-orchestrator.handback.md 1.1.l1.2.1-orchestrator-to-research-assistant.handoff.md
  1.1.l1.2.1-research-assistant-to-orchestrator.handback.md 1.1.l1.2.2-orchestrator-to-research-assistant.handoff.md
  1.1.l1.2.2-research-assistant-to-orchestrator.handback.md 1.1.l1.2.3-orchestrator-to-research-assistant.handoff.md
  1.1.l1.2.3-research-assistant-to-orchestrator.handback.md 1.1.l1.2.4-orchestrator-to-research-assistant.handoff.md
  1.1.l1.2.4-research-assistant-to-orchestrator.handback.md 10.2-orchestrator-to-agent-manager.handoff.md
  10.2.l1.1-agent-manager-to-orchestrator.handback.md 10.2.l1.1-orchestrator-to-agent-manager.handoff.md
  10.2.l1.2-agent-manager-to-orchestrator.handback.md 10.2.l1.2-orchestrator-to-agent-manager.handoff.md
  10.5-brutal-critique-to-orchestrator.handback.md 10.5-documentation-writer-to-orchestrator.handback.md
  10.5-orchestrator-to-brutal-critique.handoff.md 10.5-orchestrator-to-documentation-writer.handoff.md
  10.5.l1.1-agent-manager-to-orchestrator.handback.md 10.5.l1.1-brutal-critique-to-orchestrator.handback.md
  10.5.l1.1-documentation-writer-to-orchestrator.handback.md 10.5.l1.1-orchestrator-to-agent-manager.handoff.md
  10.5.l1.1-orchestrator-to-brutal-critique.handoff.md 10.5.l1.1-orchestrator-to-documentation-writer.handoff.md
  10.5.l1.2-agent-manager-to-orchestrator.handback.md 10.5.l1.2-documentation-writer-to-orchestrator.handback.md
  10.5.l1.2-orchestrator-to-agent-manager.handoff.md 10.5.l1.2-orchestrator-to-documentation-writer.handoff.md
  11.2-agent-manager-to-orchestrator.handback.md 11.2-orchestrator-to-agent-manager.handoff.md
  11.2.l1.1-agent-manager-to-orchestrator.handback.md 11.2.l1.1-orchestrator-to-agent-manager.handoff.md
  11.2.l2.1-agent-manager-to-orchestrator.handback.md 11.2.l2.1-orchestrator-to-agent-manager.handoff.md
  11.2.l3.1.1-agent-manager-to-orchestrator.handback.md 11.2.l3.1.1-orchestrator-to-agent-manager.handoff.md
  11.2.l3.1.2-agent-manager-to-orchestrator.handback.md 11.2.l3.1.2-orchestrator-to-agent-manager.handoff.md
  11.2.l3.2-agent-manager-to-orchestrator.handback.md 11.2.l3.2-orchestrator-to-agent-manager.handoff.md
  11.2.l3.3-agent-manager-to-orchestrator.handback.md 11.2.l3.3-orchestrator-to-agent-manager.handoff.md
  11.2.l4.1.1-agent-manager-to-orchestrator.handback.md 11.2.l4.1.1-orchestrator-to-agent-manager.handoff.md
  11.2.l4.1.2-agent-manager-to-orchestrator.handback.md 11.2.l4.1.2-orchestrator-to-agent-manager.handoff.md
  11.2.l4.2-agent-manager-to-orchestrator.handback.md 11.2.l4.2-orchestrator-to-agent-manager.handoff.md
  11.2.l5.1.1-agent-manager-to-orchestrator.handback.md 11.2.l5.1.1-orchestrator-to-agent-manager.handoff.md
  11.2.l5.1.2-agent-manager-to-orchestrator.handback.md 11.2.l5.1.2-orchestrator-to-agent-manager.handoff.md
  11.2.l5.1.3-agent-manager-to-orchestrator.handback.md 11.2.l5.1.3-orchestrator-to-agent-manager.handoff.md
  11.3-orchestrator-to-sqa-engineer.handoff.md 11.3-sqa-engineer-to-orchestrator.handback.md
  11.3.l1.1-orchestrator-to-sqa-engineer.handoff.md 11.3.l1.1-sqa-engineer-to-orchestrator.handback.md
  11.4.1-orchestrator-to-code-reviewer.handoff.md 11.4.2-orchestrator-to-code-reviewer.handoff.md
  11.4.l1.1.1-code-reviewer-to-orchestrator.handback.md 11.4.l1.1.1-orchestrator-to-code-reviewer.handoff.md
  11.4.l1.1.2-code-reviewer-to-orchestrator.handback.md 11.4.l1.1.2-orchestrator-to-code-reviewer.handoff.md
  11.5-brutal-critique-to-orchestrator.handback.md 11.5-documentation-writer-to-orchestrator.handback.md
  11.5-orchestrator-to-brutal-critique.handoff.md 11.5-orchestrator-to-documentation-writer.handoff.md
  11.5.l1.1-agent-manager-to-orchestrator.handback.md 11.5.l1.1-brutal-critique-to-orchestrator.handback.md
  11.5.l1.1-orchestrator-to-agent-manager.handoff.md 11.5.l1.1-orchestrator-to-brutal-critique.handoff.md
  11.5.l1.2-agent-manager-to-orchestrator.handback.md 11.5.l1.2-brutal-critique-to-orchestrator.handback.md
  11.5.l1.2-orchestrator-to-agent-manager.handoff.md 11.5.l1.2-orchestrator-to-brutal-critique.handoff.md
  11.5.l2.1-brutal-critique-to-orchestrator.handback.md 11.5.l2.1-orchestrator-to-brutal-critique.handoff.md
  11.5.l3.1-brutal-critique-to-orchestrator.handback.md 11.5.l3.1-orchestrator-to-brutal-critique.handoff.md
  11.5.l3.2-agent-manager-to-orchestrator.handback.md 11.5.l3.2-brutal-critique-to-orchestrator.handback.md
  11.5.l3.2-orchestrator-to-agent-manager.handoff.md 11.5.l3.2-orchestrator-to-brutal-critique.handoff.md
  11.5.l4.1-brutal-critique-to-orchestrator.handback.md 11.5.l4.1-documentation-writer-to-orchestrator.handback.md
  11.5.l4.1-orchestrator-to-brutal-critique.handoff.md 11.5.l4.1-orchestrator-to-documentation-writer.handoff.md
  11.5.l4.2-agent-manager-to-orchestrator.handback.md 11.5.l4.2-brutal-critique-to-orchestrator.handback.md
  11.5.l4.2-orchestrator-to-agent-manager.handoff.md 11.5.l4.2-orchestrator-to-brutal-critique.handoff.md
  12.2-agent-manager-to-orchestrator.handback.md 12.2-orchestrator-to-agent-manager.handoff.md
  12.2.l1.1-agent-manager-to-orchestrator.handback.md 12.2.l1.1-orchestrator-to-agent-manager.handoff.md
  12.2.l2.1-agent-manager-to-orchestrator.handback.md 12.2.l2.1-orchestrator-to-agent-manager.handoff.md
  12.3-orchestrator-to-sqa-engineer.handoff.md 12.3-sqa-engineer-to-orchestrator.handback.md
  12.4.1-code-reviewer-to-orchestrator.handback.md 12.4.1-orchestrator-to-code-reviewer.handoff.md
  12.4.2-code-reviewer-to-orchestrator.handback.md 12.4.l1.1-agent-manager-to-orchestrator.handback.md
  12.4.l1.1-orchestrator-to-agent-manager.handoff.md 12.4.l1.1.1-code-reviewer-to-orchestrator.handback.md
  12.4.l1.1.1-orchestrator-to-code-reviewer.handoff.md 12.4.l1.1.2-code-reviewer-to-orchestrator.handback.md
  12.5-documentation-writer-to-orchestrator.handback.md 12.5-orchestrator-to-documentation-writer.handoff.md
  12.5.l1.1-documentation-writer-to-orchestrator.handback.md
  12.5.l1.1-orchestrator-to-documentation-writer.handoff.md 15-claude-lens-gap-analysis.md
  2.1-brutal-critique-to-orchestrator.handback.md 2.1-orchestrator-to-brutal-critique.handoff.md
  2.1-orchestrator-to-product-owner.handoff.md 2.1-product-owner-to-orchestrator.handback.md
  2.1.l1.1-orchestrator-to-product-owner.handoff.md 2.1.l1.1-product-owner-to-orchestrator.handback.md
  2.1.l2.1-brutal-critique-to-orchestrator.handback.md 2.1.l2.1-orchestrator-to-brutal-critique.handoff.md
  2.1.l2.1-orchestrator-to-product-owner.handoff.md 2.1.l2.1-product-owner-to-orchestrator.handback.md
  3.1-brutal-critique-to-orchestrator.handback.md 3.1-orchestrator-to-brutal-critique.handoff.md
  3.1-orchestrator-to-product-manager.handoff.md 3.1-orchestrator-to-product-owner.handoff.md
  3.1-orchestrator-to-requirement-analyst.handoff.md 3.1-product-manager-to-orchestrator.handback.md
  3.1-product-owner-to-orchestrator.handback.md 3.1-requirement-analyst-to-orchestrator.handback.md
  3.1.l1.1-brutal-critique-to-orchestrator.handback.md 3.1.l1.1-orchestrator-to-brutal-critique.handoff.md
  3.1.l1.1-orchestrator-to-requirement-analyst.handoff.md 3.1.l1.1-requirement-analyst-to-orchestrator.handback.md
  3.1.l1.2-orchestrator-to-requirement-analyst.handoff.md 3.1.l1.2-requirement-analyst-to-orchestrator.handback.md
  4-orchestrator-to-human.handoff.md 5.1-orchestrator-to-research-assistant.handoff.md
  5.1-research-assistant-to-orchestrator.handback.md 5.2.1-agent-manager-to-orchestrator.handback.md
  5.2.1-orchestrator-to-agent-manager.handoff.md 5.2.2-agent-manager-to-orchestrator.handback.md
  5.2.2-orchestrator-to-agent-manager.handoff.md 5.2.3-agent-manager-to-orchestrator.handback.md
  5.2.3-orchestrator-to-agent-manager.handoff.md 5.2.l1.1-agent-manager-to-orchestrator.handback.md
  5.2.l1.1-orchestrator-to-agent-manager.handoff.md 5.2.l2.1-agent-manager-to-orchestrator.handback.md
  5.2.l2.1-orchestrator-to-agent-manager.handoff.md 6.1.1-orchestrator-to-research-assistant.handoff.md
  6.1.1-research-assistant-to-orchestrator.handback.md 6.1.2-orchestrator-to-research-assistant.handoff.md
  6.1.2-research-assistant-to-orchestrator.handback.md 6.1.l1.1-orchestrator-to-research-assistant.handoff.md
  6.1.l1.1-research-assistant-to-orchestrator.handback.md 7.2-agent-manager-to-orchestrator.handback.md
  7.2-orchestrator-to-agent-manager.handoff.md 7.2.l1.1-agent-manager-to-orchestrator.handback.md
  7.2.l1.1-orchestrator-to-agent-manager.handoff.md 7.2.l1.2-agent-manager-to-orchestrator.handback.md
  7.2.l1.2-orchestrator-to-agent-manager.handoff.md 7.2.l1.3-agent-manager-to-orchestrator.handback.md
  7.2.l1.3-orchestrator-to-agent-manager.handoff.md 7.2.l1.4-agent-manager-to-orchestrator.handback.md
  7.2.l1.4-orchestrator-to-agent-manager.handoff.md 7.2.l1.5-agent-manager-to-orchestrator.handback.md
  7.2.l1.5-orchestrator-to-agent-manager.handoff.md 7.3-orchestrator-to-sqa-engineer.handoff.md
  7.3-sqa-engineer-to-orchestrator.handback.md 7.4.1-code-reviewer-to-orchestrator.handback.md
  7.4.1-orchestrator-to-code-reviewer.handoff.md 7.4.2-code-reviewer-to-orchestrator.handback.md
  7.4.2-orchestrator-to-code-reviewer.handoff.md 7.5-brutal-critique-to-orchestrator.handback.md
  7.5-orchestrator-to-brutal-critique.handoff.md 8.2-agent-manager-to-orchestrator.handback.md
  8.2-orchestrator-to-agent-manager.handoff.md 8.2.l1.1-agent-manager-to-orchestrator.handback.md
  8.2.l1.1-orchestrator-to-agent-manager.handoff.md 8.2.l10.1-agent-manager-to-orchestrator.handback.md
  8.2.l10.1-orchestrator-to-agent-manager.handoff.md 8.2.l11.1-agent-manager-to-orchestrator.handback.md
  8.2.l11.1-orchestrator-to-agent-manager.handoff.md 8.2.l12.1-agent-manager-to-orchestrator.handback.md
  8.2.l12.1-orchestrator-to-agent-manager.handoff.md 8.2.l13.1-agent-manager-to-orchestrator.handback.md
  8.2.l13.1-orchestrator-to-agent-manager.handoff.md 8.2.l14.1-agent-manager-to-orchestrator.handback.md
  8.2.l14.1-orchestrator-to-agent-manager.handoff.md 8.2.l15.1-orchestrator-to-agent-manager.handoff.md
  8.2.l2.1-agent-manager-to-orchestrator.handback.md 8.2.l2.1-orchestrator-to-agent-manager.handoff.md
  8.2.l3.1-agent-manager-to-orchestrator.handback.md 8.2.l3.1-orchestrator-to-agent-manager.handoff.md
  8.2.l4.1-agent-manager-to-orchestrator.handback.md 8.2.l4.1-orchestrator-to-agent-manager.handoff.md
  8.2.l5.1-agent-manager-to-orchestrator.handback.md 8.2.l5.1-orchestrator-to-agent-manager.handoff.md
  8.2.l6.1-agent-manager-to-orchestrator.handback.md 8.2.l6.1-orchestrator-to-agent-manager.handoff.md
  8.2.l7.1-orchestrator-to-agent-manager.handoff.md 8.2.l7.2-agent-manager-to-orchestrator.handback.md
  8.2.l7.2-orchestrator-to-agent-manager.handoff.md 8.2.l8.1-agent-manager-to-orchestrator.handback.md
  8.2.l8.1-orchestrator-to-agent-manager.handoff.md 8.2.l9.1-agent-manager-to-orchestrator.handback.md
  8.2.l9.1-orchestrator-to-agent-manager.handoff.md 8.3-orchestrator-to-sqa-engineer.handoff.md
  8.3-sqa-engineer-to-orchestrator.handback.md 8.3.l1.1-orchestrator-to-sqa-engineer.handoff.md
  8.3.l1.2-orchestrator-to-sqa-engineer.handoff.md 8.3.l1.2-sqa-engineer-to-orchestrator.handback.md
  8.4.1-code-reviewer-to-orchestrator.handback.md 8.4.1-orchestrator-to-code-reviewer.handoff.md
  8.4.2-code-reviewer-to-orchestrator.handback.md 8.4.l1.1-agent-manager-to-orchestrator.handback.md
  8.4.l1.1-orchestrator-to-agent-manager.handoff.md 8.4.l1.1-orchestrator-to-sqa-engineer.handoff.md
  8.4.l1.1-sqa-engineer-to-orchestrator.handback.md 8.4.l1.1.1-code-reviewer-to-orchestrator.handback.md
  8.4.l1.1.1-orchestrator-to-code-reviewer.handoff.md 8.4.l1.1.2-code-reviewer-to-orchestrator.handback.md
  8.4.l2.1.1-code-reviewer-to-orchestrator.handback.md 8.4.l2.1.1-orchestrator-to-code-reviewer.handoff.md
  8.4.l2.1.2-code-reviewer-to-orchestrator.handback.md 8.4.l2.1.2-orchestrator-to-code-reviewer.handoff.md
  8.4.l2.2-agent-manager-to-orchestrator.handback.md 8.4.l2.2-orchestrator-to-agent-manager.handoff.md
  8.4.l2.2.1-code-reviewer-to-orchestrator.handback.md 8.4.l2.2.1-orchestrator-to-code-reviewer.handoff.md
  8.4.l2.2.2-code-reviewer-to-orchestrator.handback.md 8.4.l2.2.2-orchestrator-to-code-reviewer.handoff.md
  8.5-brutal-critique-to-orchestrator.handback.md 8.5-documentation-writer-to-orchestrator.handback.md
  8.5-orchestrator-to-brutal-critique.handoff.md 8.5-orchestrator-to-documentation-writer.handoff.md
  8.5.l1.1-documentation-writer-to-orchestrator.handback.md 8.5.l1.1-orchestrator-to-documentation-writer.handoff.md
  8.5.l2.1-agent-manager-to-orchestrator.handback.md 8.5.l2.1-brutal-critique-to-orchestrator.handback.md
  8.5.l2.1-documentation-writer-to-orchestrator.handback.md 8.5.l2.1-orchestrator-to-agent-manager.handoff.md
  8.5.l2.1-orchestrator-to-brutal-critique.handoff.md 8.5.l2.1-orchestrator-to-documentation-writer.handoff.md
  8.5.l3.1-documentation-writer-to-orchestrator.handback.md 8.5.l3.1-orchestrator-to-documentation-writer.handoff.md
  8.5.l4.1-brutal-critique-to-orchestrator.handback.md 8.5.l4.1-documentation-writer-to-orchestrator.handback.md
  8.5.l4.1-orchestrator-to-brutal-critique.handoff.md 8.5.l4.1-orchestrator-to-documentation-writer.handoff.md
  8.5.l4.2-agent-manager-to-orchestrator.handback.md 8.5.l4.2-brutal-critique-to-orchestrator.handback.md
  8.5.l4.2-documentation-writer-to-orchestrator.handback.md 8.5.l4.2-orchestrator-to-agent-manager.handoff.md
  8.5.l4.2-orchestrator-to-brutal-critique.handoff.md 8.5.l4.2-orchestrator-to-documentation-writer.handoff.md
  8.5.l4.3-documentation-writer-to-orchestrator.handback.md 8.5.l4.3-orchestrator-to-documentation-writer.handoff.md
  8.5.l4.4-documentation-writer-to-orchestrator.handback.md 8.5.l4.4-orchestrator-to-documentation-writer.handoff.md
  9.2-agent-manager-to-orchestrator.handback.md 9.2-orchestrator-to-agent-manager.handoff.md
  9.2.l1.1-agent-manager-to-orchestrator.handback.md 9.2.l1.1-orchestrator-to-agent-manager.handoff.md
  9.5-brutal-critique-to-orchestrator.handback.md 9.5-orchestrator-to-brutal-critique.handoff.md
  9.5.l1.1-agent-manager-to-orchestrator.handback.md 9.5.l1.1-brutal-critique-to-orchestrator.handback.md
  9.5.l1.1-orchestrator-to-agent-manager.handoff.md 9.5.l1.1-orchestrator-to-brutal-critique.handoff.md
  merged-from-AAW-20261023-lens-plugin-from-spike.md merged-from-AAW-20261024-docs-in-progress-rule.md
  merged-from-AAW-20261024-orchestrator-verify-only.md phase-renames-2026-10-24.json run.v1.md`
  .split(/\s+/)
  .filter(x => x !== '')
/** The folder's rename map, `phase-renames-2026-10-24.json`'s `codeMap` (old code -> new code), verbatim. */
const FEAT_CODEMAP: Record<string, string> = {
  '1.1': '1.1', '1.2': '1.1', '1.3.1': '1.1.l1.1.1', '1.3.2': '1.1.l1.1.2', '1.3.3': '1.1.l1.1.3',
  '1.3.4': '1.1.l1.1.4', '1.3.5': '1.1.l1.1.5', '1.4.1': '1.1.l1.2', '1.4.2': '1.1.l1.2.1', '1.4.3': '1.1.l1.2.2',
  '1.4.4': '1.1.l1.2.3', '1.4.5': '1.1.l1.2.4', '10.1': '10.2', '10.1.1': '10.2.l1.2', '10.1.2': '10.5',
  '10.1.2.l1': '10.5.l1.1', '10.1.2.l2': '10.5.l1.2', '10.1.l1': '10.2.l1.1', '10.1.l2': '10.5.l1.1',
  '10.1.l3': '10.5.l1.2', '10.2': '10.5', '10.2.l1': '10.5.l1.1', '11.1': '11.2', '11.1.1': '11.5',
  '11.1.1.l1': '11.5.l1.1', '11.1.1.l2': '11.5.l1.2', '11.1.l1': '11.2.l1.1', '11.1.l2': '11.2.l2.1',
  '11.1.l3': '11.5.l1.1', '11.1.l4': '11.5.l1.2', '11.10': '11.4.2', '11.11': '11.2.l4.1.1', '11.11.l1': '11.5.l3.2',
  '11.12': '11.2.l4.1.2', '11.13': '11.5.l3.1', '11.13.l1': '11.5.l3.2', '11.14': '11.2.l4.2', '11.15': '11.3.l1.1',
  '11.16': '11.4.l1.1.1', '11.17': '11.4.l1.1.2', '11.18': '11.2.l5.1.1', '11.18.l1': '11.5.l4.2',
  '11.19': '11.2.l5.1.2', '11.2': '11.2.l3.1.1', '11.20': '11.2.l5.1.3', '11.21': '11.5.l4.1',
  '11.21.l1': '11.5.l4.2', '11.22': '11.5.l4.1', '11.3': '11.2.l3.1.2', '11.4': '11.2.l3.2', '11.5': '11.5.l2.1',
  '11.6': '11.2.l3.3', '11.7': '11.5', '11.8': '11.3', '11.9': '11.4.1', '12.1.1': '12.2', '12.1.1.l1': '12.2.l1.1',
  '12.1.1.l2': '12.2.l2.1', '12.1.1.l3': '12.4.l1.1', '12.1.2': '12.5', '12.1.3': '12.3', '12.1.4': '12.4.1',
  '12.1.4.l1': '12.4.l1.1.1', '12.1.5': '12.4.2', '12.1.5.l1': '12.4.l1.1.2', '12.1.6': '12.5.l1.1', '2.1': '2.1',
  '2.1.l1': '2.1.l2.1', '2.2': '2.1.l1.1', '2.3': '2.1', '2.3.l1': '2.1.l2.1', '3.1': '3.1', '3.1.l1': '3.1.l1.1',
  '3.1.l2': '3.1.l1.2', '3.2.1': '3.1', '3.2.1.l1': '3.1.l1.1', '3.2.2': '3.1', '3.3': '3.1', '4.1': '4',
  '5.1': '5.1', '5.2.1': '5.2.1', '5.2.2': '5.2.2', '5.2.3': '5.2.3', '5.3': '5.2.l1.1', '5.4': '5.2.l2.1',
  '6.1.1': '6.1.1', '6.1.2': '6.1.2', '6.2': '6.1.l1.1', '7.1': '7.2', '7.1.l1': '7.2.l1.1', '7.1.l2': '7.2.l1.2',
  '7.1.l3': '7.2.l1.3', '7.1.l4': '7.2.l1.4', '7.1.l5': '7.2.l1.5', '7.2.1': '7.5', '7.2.2': '7.3', '7.2.3': '7.4.1',
  '7.2.4': '7.4.2', '8.1': '8.2', '8.1.2': '8.2.l1.1', '8.1.3': '8.2.l2.1', '8.1.4': '8.2.l3.1', '8.1.5': '8.2.l4.1',
  '8.1.6.1': '8.2.l5.1', '8.1.6.1.l1': '8.2.l6.1', '8.1.6.1.l2': '8.2.l7.1', '8.1.6.1.l2.1': '8.2.l7.2',
  '8.1.6.1.l3': '8.2.l8.1', '8.1.6.2': '8.5', '8.1.6.2.l1': '8.5.l1.1', '8.1.6.2.l2': '8.5.l2.1',
  '8.1.7': '8.5.l2.1', '8.1.l1': '8.4.l1.1', '8.2.1': '8.5', '8.2.1.l1': '8.5.l2.1', '8.2.2': '8.3',
  '8.2.2.l1': '8.4.l1.1', '8.3.1': '8.4.1', '8.3.1.l1': '8.4.l1.1.1', '8.3.2': '8.4.2', '8.3.2.l1': '8.4.l1.1.2',
  '8.4.1': '8.2.l10.1', '8.4.2': '8.2.l11.1', '8.4.3': '8.5.l3.1', '8.4.4': '8.3.l1.1', '8.5.1': '8.2.l9.1',
  '8.6.1': '8.2.l12.1', '8.6.1.l1': '8.2.l13.1', '8.6.1.l2': '8.5.l4.2', '8.6.2': '8.5.l4.1', '8.6.2.l1': '8.5.l4.2',
  '8.6.3': '8.3.l1.2', '8.6.4': '8.5.l4.1', '8.6.4.l1': '8.5.l4.2', '8.6.5': '8.2.l14.1', '8.6.5.l1': '8.4.l2.2',
  '8.6.6': '8.5.l4.3', '8.6.6.l1': '8.5.l4.4', '8.6.7': '8.4.l2.1.1', '8.6.7.l1': '8.4.l2.2.1',
  '8.6.8': '8.4.l2.1.2', '8.6.8.l1': '8.4.l2.2.2', '9.1': '9.2', '9.1.1': '9.2.l1.1', '9.1.l2': '9.5.l1.1',
  '9.2.1': '9.5', '9.2.1.l1': '9.5.l1.1',
}
const FEAT_RENAMES_JSON = JSON.stringify({ dir: `docs/handoffs/FEAT-20261020-ai-dlc-lens`, tags: {}, codeMap: FEAT_CODEMAP, renames: [] })
/**
 * A run.v1.md of that run: its Features table verbatim (its Old steps still name the codes before the root
 * renumbering), some Stages rows with the current codes (as the real file has them), and its merged-runs table
 * (the offsets still name the codes before both renamings).
 */
const FEAT_MD =
  `---\nrun: ${F_RUN}\nversion: "1"\nstatus: active\n---\n\n# Run: ${F_RUN} — run-state CLI, gate alert and the ai-dlc-lens mod plugin\n\n## Stages\n| Step | Stage | Owner | Mode | Status | Handoff | Handback | Updated |\n|---|---|---|---|---|---|---|---|\n` +
  '| 1.1.l1.1.1 | research R1: savvy-progress, cache-tax | research-assistant | subagent | done (passed) | `1.1.l1.1.1-orchestrator-to-research-assistant.handoff.md` | `1.1.l1.1.1-research-assistant-to-orchestrator.handback.md` | 2026-10-22 21:40 |\n' +
  '| 4 | G1 gate (stories + ACs) | human | subagent | done · approved by the human | `4-orchestrator-to-human.handoff.md` | — | 2026-10-23 00:35 |\n' +
  "| 7.2 | spike 027 rework to the human's card design (round 1 / 2) | agent-manager | subagent | done (passed) | `7.2-orchestrator-to-agent-manager.handoff.md` | `7.2-agent-manager-to-orchestrator.handback.md` | 2026-10-23 12:50 |\n" +
  '\n## Merged runs (2026-10-23)\n| Old run | Offset | New steps | Old run state |\n|---|---|---|---|\n' +
  `| ${L_RUN} | +18 | 19–21 | \`merged-from-${L_RUN}.md\` |\n| ${V_RUN} | +21 | 22–23 | \`merged-from-${V_RUN}.md\` |\n| ${D_RUN} | +23 | 24–25 | \`merged-from-${D_RUN}.md\` |\n` +
  '\n### Stages 19–21: the ai-dlc-lens plugin from spike 027 (was its own AAW run)\n| Step | Stage | Agent | Status | Record |\n|---|---|---|---|---|\n' +
  '| 8.2 | create plugins/claude/ai-dlc-lens from spike 027 | agent-manager | done (passed) | 8.2-agent-manager-to-orchestrator.handback.md |\n' +
  '| 12.3 | tests: keep-alive keep-warm time and per-turn read | sqa-engineer | __12_3__ | 12.3-sqa-engineer-to-orchestrator.handback.md |\n' +
  '\n## Features (renumbered 2026-10-24)\nThe human (2026-10-24): one flowchart per feature root.\n\n| Step | Feature | Old steps | Status |\n|---|---|---|---|\n' +
  '| 1 | Scope and research | 1, 2, 3.1–3.5, 4.1–4.5 | done |\n' +
  '| 2 | PDLC product brief | 5, 6, 7 | done |\n' +
  '| 3 | PDLC stories, backlog, accept | 8, 9.1, 9.2, 10.1 | done |\n' +
  '| 4 | G1 gate (stories + ACs) | 11 | done · approved |\n' +
  '| 5 | Spikes 027 / 028 / 029 | 10.2, 12.1–12.3, 13, 14 | done |\n' +
  '| 6 | Lens feature inventory | 15, 16 | done |\n' +
  '| 7 | Spike 027 rework rounds 1–6 | 17, 18.1–18.4 | done |\n' +
  '| 8 | ai-dlc-lens plugin from the spike | 19, 20, 21, 27, 29, 30 | in progress (8.6: step charts; reviews of 8.4–8.6 pending) |\n' +
  '| 9 | Orchestrator checks only, never runs checks | 22, 23 | done (critique PASS) |\n' +
  '| 10 | Docs-status rule | 24, 25 | done (critique PASS) |\n' +
  '| 11 | Related work joins its parent run; numbering | 26 | done (critique PASS) |\n' +
  '| 12 | Keep-alive publishes the keep-warm time in force | 28 | done (code review approved) |\n' +
  '\n## Records renamed to the phase scheme (2026-10-24)\nThe full old → new map is `phase-renames-2026-10-24.json` (not a record).\n\n| Step | Stage | Agent | Status | Record |\n|---|---|---|---|---|\n' +
  '| 8.2.l15.1 | lens: renamed folder (fixture, real-folder tests, MANUAL-CHECKS codes, per-code rename source for old briefs) | agent-manager | in-progress | 8.2.l15.1-orchestrator-to-agent-manager.handoff.md |\n'
const featMd = (step123 = 'done · PASS') => FEAT_MD.replace('__12_3__', step123)
const featSources = (names: readonly string[] = FEAT_NAMES, codeMap: Record<string, string> | null = FEAT_CODEMAP) => {
  const r = parseRun(featMd())!
  return [{ dir: `docs/handoffs/${F_RUN}`, names, stages: r.stages, child: false, features: r.features, renames: r.renames, ...(codeMap ? { codeMap } : {}) }]
}
/** The files the lens reads from the real folder: run.v1.md and the rename map. */
const FEAT_FILES = (md = featMd()) => ({ [`docs/handoffs/${F_RUN}/run.v1.md`]: md, [`docs/handoffs/${F_RUN}/phase-renames-2026-10-24.json`]: FEAT_RENAMES_JSON })
const MAIN = { id: 'main', parent: null, type: 'ai-dlc:orchestrator', status: 'running', startedAt: 1 } as any
const liveAgent = (id: string, run: string, code: string, agent: string, status: string, startedAt: number): LensAgent =>
  ({ id, parent: 'main', type: `ai-dlc:${agent}`, name: '', description: '', model: '', callModel: '', parentModel: '', prompt: '', status, toolUseId: `t-${id}`, steps: ZERO_T, turns: ZERO_T, last: null, handoff: `docs/handoffs/${run}/${code}-orchestrator-to-${agent}.handoff.md`, handoffHow: 'first line', loop: false, startedAt, endedAt: null, bg: [], reqs: [] }) as LensAgent
const ZERO_T = { in: 0, out: 0, cr: 0, cw: 0 }
/** A chart's nodes as `code <- parent code` (the root's parent ''), in drawing order. */
const edgesOf = (c: StepChart) => c.ids.map(id => `${c.codes[id]} <- ${c.agents[id]!.parent === null ? '' : c.codes[c.agents[id]!.parent!]}`)
const ROOTS_DESC = Array.from({ length: 12 }, (_, i) => String(12 - i))
const LENS_RUN_RENAMES = { [L_RUN.toLowerCase()]: { dir: `docs/handoffs/${F_RUN}`, offset: 18 } }

describe('step 8.6.1: one flowchart per feature root (pure, from the real folder of FEAT-20261020-ai-dlc-lens)', () => {
  test('record names: every handoff and hand-back, and the oldest form 1.1-…md; plans, the gap analysis, run.v1.md, merged-from files and the rename map are not records', () => {
    expect(FEAT_NAMES.length).toBe(291)
    expect(parseRecordName('8.4.l2.2.1-orchestrator-to-code-reviewer.handoff.md')).toMatchObject({ code: '8.4.l2.2.1', step: 8, to: 'code-reviewer', kind: 'handoff' })
    expect(parseRecordName('4-orchestrator-to-human.handoff.md')).toMatchObject({ code: '4', step: 4, to: 'human' })
    for (const not of ['run.v1.md', 'phase-renames-2026-10-24.json']) expect([not, parseRecordName(not)]).toEqual([not, null])
    expect(parseRecordName('1.1-orchestrator-to-product-manager.md')).toEqual({ file: '1.1-orchestrator-to-product-manager.md', code: '1.1', step: 1, from: 'orchestrator', to: 'product-manager', kind: 'handoff' })
    expect(parseRecordName('01-orchestrator-to-product-manager.md')?.code).toBe('1')
    expect(parseRecordName('8.1.6.1.l2.1-agent-manager-to-orchestrator.handback.md')).toEqual({ file: '8.1.6.1.l2.1-agent-manager-to-orchestrator.handback.md', code: '8.1.6.1.l2.1', step: 8, from: 'agent-manager', to: 'orchestrator', kind: 'handback' })
    expect(parseRecordName('4.1-orchestrator-to-human.handoff.md')?.to).toBe('human')
    for (const not of ['run.md', '00-approved-plan.md', '00b-approved-plan-2026-10-22.md', '15-claude-lens-gap-analysis.md', `merged-from-${L_RUN}.md`]) expect([not, parseRecordName(not)]).toEqual([not, null])
    expect(FEAT_NAMES.filter(n => parseRecordName(n) === null).length).toBe(8)
    expect([parentCode('8'), parentCode('8.1'), parentCode('12.1.1.l2'), parentCode('8.1.6.1.l2.1')]).toEqual([null, '8', '12.1.1', '8.1.6.1.l2'])
    expect(['8.1.l1', '8.1.7', '8.1', '8.1.6.1.l2.1', '8.1.6.1', '8.1.6.1.l2', '8.1.10', '8.1.2'].sort(compareCodes)).toEqual(['8.1', '8.1.2', '8.1.6.1', '8.1.6.1.l2', '8.1.6.1.l2.1', '8.1.7', '8.1.10', '8.1.l1'])
  })

  test('12 feature roots in the folder: 12 trees, roots 1 to 12; a 13th root once its first record is on disk', () => {
    const records = FEAT_NAMES.map(parseRecordName).filter((r): r is NonNullable<typeof r> => r !== null)
    const trees = stepTrees(records)
    expect(trees.length).toBe(12)
    expect(trees.map(t => t.step)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1))
    expect(stepTrees([...records, parseRecordName('13.1-orchestrator-to-agent-manager.handoff.md')!]).length).toBe(13)
    // Every root but 4 has no record of its own: its tree starts with its bare root. Root 4 is the G1 gate record.
    expect(trees.filter(t => t.nodes[0]!.code === String(t.step) && t.nodes[0]!.recorded).map(t => t.step)).toEqual([4])
    expect(trees.find(t => t.step === 4)!.nodes.map(n => n.code)).toEqual(['4'])
  })

  test('root 12: its phases 12.2 to 12.5 under 12; review axes 12.4.1 and 12.4.2 and loop round 12.4.l1.1 under 12.4, the round axes under the round', () => {
    const t12 = stepTrees(FEAT_NAMES.map(parseRecordName).filter((r): r is NonNullable<typeof r> => r !== null)).find(t => t.step === 12)!
    expect(t12.nodes.map(n => `${n.code} <- ${n.parent ?? ''}`)).toEqual([
      '12 <- ',
      '12.2 <- 12',
      '12.2.l1.1 <- 12.2',
      '12.2.l2.1 <- 12.2',
      '12.3 <- 12',
      '12.4 <- 12',
      '12.4.1 <- 12.4',
      '12.4.2 <- 12.4',
      '12.4.l1.1 <- 12.4',
      '12.4.l1.1.1 <- 12.4.l1.1',
      '12.4.l1.1.2 <- 12.4.l1.1',
      '12.5 <- 12',
      '12.5.l1.1 <- 12.5',
    ])
    expect(t12.nodes.filter(n => !n.recorded).map(n => n.code)).toEqual(['12', '12.4'])
    expect(t12.nodes.filter(n => n.loop).map(n => n.code)).toEqual(['12.2.l1.1', '12.2.l2.1', '12.4.l1.1', '12.5.l1.1'])
    // 12.4.2 (the spec axis, briefed in 12.4.1's handoff) has only its hand-back: the reviewer worked it.
    expect(t12.nodes.find(n => n.code === '12.4.2')).toMatchObject({ worker: 'code-reviewer', from: 'orchestrator', handoff: null, handback: '12.4.2-code-reviewer-to-orchestrator.handback.md' })
  })

  test('the charts: 12, one per feature root; phases 8.2 to 8.5 under 8, loop rounds under their phase, 7.2.l1.1 to 7.2.l1.5 under 7.2; titles from the Features table', () => {
    const charts = stepCharts(featSources(), [], MAIN)
    expect(charts.length).toBe(12)
    const of = (k: string) => charts.find(c => c.key === k)!
    const c8 = of('8')
    expect(c8.ids.length).toBe(41)
    expect(edgesOf(c8).filter(e => / <- 8$/.test(e))).toEqual(['8.2 <- 8', '8.3 <- 8', '8.4 <- 8', '8.5 <- 8'])
    expect(edgesOf(c8).filter(e => / <- 8\.2$/.test(e))).toEqual([
      '8.2.l1.1 <- 8.2', '8.2.l2.1 <- 8.2', '8.2.l3.1 <- 8.2', '8.2.l4.1 <- 8.2', '8.2.l5.1 <- 8.2', '8.2.l6.1 <- 8.2', '8.2.l7.1 <- 8.2', '8.2.l7.2 <- 8.2',
      '8.2.l8.1 <- 8.2', '8.2.l9.1 <- 8.2', '8.2.l10.1 <- 8.2', '8.2.l11.1 <- 8.2', '8.2.l12.1 <- 8.2', '8.2.l13.1 <- 8.2', '8.2.l14.1 <- 8.2', '8.2.l15.1 <- 8.2',
    ])
    for (const e of ['8.3.l1.1 <- 8.3', '8.3.l1.2 <- 8.3', '8.4.1 <- 8.4', '8.4.2 <- 8.4', '8.4.l1.1 <- 8.4', '8.4.l1.1.1 <- 8.4.l1.1', '8.4.l2.1 <- 8.4', '8.4.l2.1.2 <- 8.4.l2.1', '8.4.l2.2 <- 8.4', '8.4.l2.2.2 <- 8.4.l2.2', '8.5.l4.4 <- 8.5'])
      expect(edgesOf(c8)).toContain(e)
    // 8.4 and the round 8.4.l2.1 (its two axes briefed apart) have no record of their own and still connect what is under them.
    expect(c8.bare).toEqual(['step:8', 'step:8:8.4', 'step:8:8.4.l2.1'])
    expect(c8.ids.filter(id => c8.agents[id]!.loop).length).toBe(28)
    expect(edgesOf(of('7'))).toEqual(['7 <- ', '7.2 <- 7', '7.2.l1.1 <- 7.2', '7.2.l1.2 <- 7.2', '7.2.l1.3 <- 7.2', '7.2.l1.4 <- 7.2', '7.2.l1.5 <- 7.2', '7.3 <- 7', '7.4 <- 7', '7.4.1 <- 7.4', '7.4.2 <- 7.4', '7.5 <- 7'])
    expect(edgesOf(of('12')).length).toBe(13)
    // Statuses from disk: a hand-back is done; a handoff without one is open (8.3.l1.1 stopped, 8.2.l7.1 stalled, 8.2.l15.1 this step).
    for (const code of ['8.3.l1.1', '8.2.l7.1', '8.2.l15.1']) expect([code, c8.agents[`step:8:${code}`]!.status]).toEqual([code, OPEN])
    expect(of('12').agents['step:12:12.5.l1.1']!.status).toBe('completed')
    // Who: the receiver of the handoff, else the sender of the hand-back; the root is its sender.
    expect(of('4').agents['step:4:4']!.type).toBe('human')
    expect(of('12').agents['step:12:12.4.2']!.type).toBe('ai-dlc:code-reviewer')
    expect(of('12').agents['step:12']!.type).toBe('ai-dlc:orchestrator')
    // The record a stand-in opens.
    expect(of('12').agents['step:12:12.2.l2.1']!.handoff).toBe(`docs/handoffs/${F_RUN}/12.2.l2.1-orchestrator-to-agent-manager.handoff.md`)
    expect(of('1').agents['step:1:1.1']!.handoff).toBe(`docs/handoffs/${F_RUN}/1.1-orchestrator-to-product-manager.handoff.md`)
    // Titles: the Features table's name for every root.
    expect(charts.map(c => c.title).sort()).toEqual(
      [
        'Step 1 · Scope and research',
        'Step 2 · PDLC product brief',
        'Step 3 · PDLC stories, backlog, accept',
        'Step 4 · G1 gate (stories + ACs)',
        'Step 5 · Spikes 027 / 028 / 029',
        'Step 6 · Lens feature inventory',
        'Step 7 · Spike 027 rework rounds 1–6',
        'Step 8 · ai-dlc-lens plugin from the spike',
        'Step 9 · Orchestrator checks only, never runs checks',
        'Step 10 · Docs-status rule',
        'Step 11 · Related work joins its parent run; numbering',
        'Step 12 · Keep-alive publishes the keep-warm time in force',
      ].sort(),
    )
  })

  test('titles fall back to the Stages rows, then the step number; a child run is prefixed with its folder', () => {
    const r = parseRun(featMd())!
    const src = { dir: `docs/handoffs/${F_RUN}`, stages: r.stages, child: false }
    expect([stepTitle(src, 7), stepTitle(src, 1), stepTitle(src, 2)]).toEqual(["Step 7 · spike 027 rework to the human's card design (round 1 / 2)", 'Step 1 · research R1: savvy-progress, cache-tax', 'Step 2'])
    expect(stepTitle({ ...src, features: r.features }, 7)).toBe('Step 7 · Spike 027 rework rounds 1–6')
    expect(stepTitle({ dir: `docs/handoffs/${L_RUN}`, stages: {}, child: true }, 3)).toBe(`${L_RUN}: Step 3`)
    // The Features table is not read as a stages table.
    expect(r.stages['8']).toBeUndefined()
  })

  test('addendum A: by step code, highest first (12 … 1), live spawns or not; a child run steps after the run own steps, then no step, then not found', () => {
    const charts = stepCharts(featSources(), [], MAIN)
    expect(stepsDescending(charts).map(c => c.key)).toEqual(ROOTS_DESC)
    const names = [...FEAT_NAMES, '13.1-orchestrator-to-agent-manager.handoff.md', '7.2.l1.6-orchestrator-to-agent-manager.handoff.md']
    const live = [liveAgent('a13', F_RUN, '13.1', 'agent-manager', 'running', 500), liveAgent('a7', F_RUN, '7.2.l1.6', 'agent-manager', 'running', 400)]
    const order = stepsDescending(stepCharts(featSources(names), live, MAIN)).map(c => c.key)
    expect(order).toEqual(['13', ...ROOTS_DESC])
    const mixed = [NOT_FOUND, 'c:2', NO_STEP, '2', 'c:10', '10', 'b:1'].map(key => ({ key, step: /(\d+)$/.test(key) ? Number(/(\d+)$/.exec(key)![1]) : null }))
    expect(stepsDescending(mixed).map(c => c.key)).toEqual(['10', '2', 'b:1', 'c:10', 'c:2', NO_STEP, NOT_FOUND])
    // Inside a chart, the nodes stay in code order, a live spawn at its code.
    const c7 = stepCharts(featSources(names), live, MAIN).find(c => c.key === '7')!
    expect(edgesOf(c7).slice(0, 8)).toEqual(['7 <- ', '7.2 <- 7', '7.2.l1.1 <- 7.2', '7.2.l1.2 <- 7.2', '7.2.l1.3 <- 7.2', '7.2.l1.4 <- 7.2', '7.2.l1.5 <- 7.2', '7.2.l1.6 <- 7.2'])
  })

  test("a live spawn takes its record's node with its live status; the root blinks with the orchestrator while it works and rests after", () => {
    const run = (status: string) => stepCharts(featSources(), [liveAgent('a8', F_RUN, '8.2.l15.1', 'agent-manager', status, 500)], MAIN).find(c => c.key === '8')!
    const c = run('running')
    expect(edgesOf(c).filter(e => e.startsWith('8.2.l1'))).toEqual(['8.2.l1.1 <- 8.2', '8.2.l10.1 <- 8.2', '8.2.l11.1 <- 8.2', '8.2.l12.1 <- 8.2', '8.2.l13.1 <- 8.2', '8.2.l14.1 <- 8.2', '8.2.l15.1 <- 8.2'])
    expect(c.ids).toContain('a8')
    expect(c.ids).not.toContain('step:8:8.2.l15.1')
    expect([c.agents['step:8']!.status, c.agents['a8']!.status, c.start]).toEqual(['running', 'running', 500])
    expect(run('completed').agents['step:8']!.status).toBe('idle')
    // A spawn with no record of its own hangs under the spawn that made it.
    const kid = { ...liveAgent('k1', F_RUN, 'x', 'research-assistant', 'running', 600), handoff: null, prompt: 'look it up', parent: 'a8' } as LensAgent
    const withKid = stepCharts(featSources(), [liveAgent('a8', F_RUN, '8.2.l15.1', 'agent-manager', 'running', 500), kid], MAIN).find(c => c.key === '8')!
    expect(withKid.agents['k1']!.parent).toBe('a8')
    // A spawn of the orchestrator with no record: the chart for spawns with no step.
    const loose = { ...kid, parent: 'main' } as LensAgent
    const nostep = stepCharts(featSources(), [loose], MAIN).find(c => c.key === NO_STEP)!
    expect(nostep.ids).toEqual(['main', 'k1'])
  })
})

describe('step 8.6.1.l1: briefs written before the renumbering (pure)', () => {
  test("the Features table: each root's name, and its Old steps as old -> new prefixes (an old step split across features maps per code)", () => {
    const r = parseRun(featMd())!
    expect(r.features?.['8']).toBe('ai-dlc-lens plugin from the spike')
    expect(Object.keys(r.features ?? {}).length).toBe(12)
    expect(r.renames).toEqual({
      '1': '1.1',
      '2': '1.2',
      '3': '1.3',
      '4': '1.4',
      '5': '2.1',
      '6': '2.2',
      '7': '2.3',
      '8': '3.1',
      '9': '3.2',
      '10.1': '3.3',
      '11': '4.1',
      '10.2': '5.1',
      '12': '5.2',
      '13': '5.3',
      '14': '5.4',
      '15': '6.1',
      '16': '6.2',
      '17': '7.1',
      '18': '7.2',
      '19': '8.1',
      '20': '8.2',
      '21': '8.3',
      '27': '8.4',
      '29': '8.5',
      '30': '8.6',
      '22': '9.1',
      '23': '9.2',
      '24': '10.1',
      '25': '10.2',
      '26': '11.1',
      '28': '12.1',
    })
    expect(renamesFromFeatures([{ step: 1, old: '' }, { step: 2, old: 'none' }])).toEqual({})
    // Every old code this session's briefs named maps to its new code.
    const pairs: [string, string][] = [['30.1', '8.6.1'], ['19.6.1.l2.1', '8.1.6.1.l2.1'], ['28.1.l3', '12.1.1.l3'], ['17.l3', '7.1.l3'], ['10.2', '5.1'], ['10.1', '3.3'], ['3.4', '1.3.4'], ['27.4', '8.4.4'], ['29.1', '8.5.1']]
    for (const [old, now] of pairs) expect([old, renameCode(old, r.renames!)]).toEqual([old, now])
    expect(renameCode('31.1', r.renames!)).toBe(null)
    // Step 8.2.l15.1: and on through the phase renaming's per-code map to the record each is today.
    const today: [string, string, string][] = [['30.1', 'agent-manager', '8.2.l12.1'], ['19.6.1.l2.1', 'agent-manager', '8.2.l7.2'], ['28.1.l3', 'agent-manager', '12.4.l1.1'], ['17.l3', 'agent-manager', '7.2.l1.3'], ['10.2', 'research-assistant', '5.1'], ['3.4', 'research-assistant', '1.1.l1.1.4'], ['27.4', 'sqa-engineer', '8.3.l1.1'], ['29.1', 'agent-manager', '8.2.l9.1']]
    for (const [old, to, now] of today) {
      const at = locateRecord({ dir: `docs/handoffs/${F_RUN}`, code: old, from: 'orchestrator', to }, featSources())
      expect([old, at !== null && at !== 'gone' ? [at.code, at.path] : at]).toEqual([old, [now, `docs/handoffs/${F_RUN}/${now}-orchestrator-to-${to}.handoff.md`]])
    }
  })

  test('locateRecord: the record under its own name; else under the name it was renamed to; else unchecked under a current root, gone under any other. A run never renumbered: as named, unchecked', () => {
    const srcs = featSources()
    const at = (code: string, to = 'agent-manager', dir = `docs/handoffs/${F_RUN}`) => locateRecord({ dir, code, from: 'orchestrator', to }, srcs, LENS_RUN_RENAMES)
    expect(at('8.2.l15.1')).toMatchObject({ code: '8.2.l15.1', path: `docs/handoffs/${F_RUN}/8.2.l15.1-orchestrator-to-agent-manager.handoff.md` })
    // Step 8.2.l15.1: a code from before the phase renaming, through the per-code map (8.6.1.l1 -> 8.2.l13.1); one from
    // before the root renumbering, through the Old steps prefixes and then the map (30.1 -> 8.6.1 -> 8.2.l12.1).
    expect(at('8.6.1.l1')).toMatchObject({ code: '8.2.l13.1', path: `docs/handoffs/${F_RUN}/8.2.l13.1-orchestrator-to-agent-manager.handoff.md` })
    expect(at('30.1')).toMatchObject({ code: '8.2.l12.1', path: `docs/handoffs/${F_RUN}/8.2.l12.1-orchestrator-to-agent-manager.handoff.md` })
    // Old 3.1 (research R1) is not today's 3.1 (requirement-analyst): the receiver tells them apart.
    expect(at('3.1', 'research-assistant')).toMatchObject({ code: '1.1.l1.1.1' })
    expect(at('3.1', 'requirement-analyst')).toMatchObject({ code: '3.1' })
    // A merged-away run's brief: its offset, then the renumbering, then the per-code map.
    expect(at('1.6.1.l3', 'agent-manager', `docs/handoffs/${L_RUN}`)).toMatchObject({ code: '8.2.l8.1', path: `docs/handoffs/${F_RUN}/8.2.l8.1-orchestrator-to-agent-manager.handoff.md` })
    // Under no root the run has now: gone. Under a current root but not listed (8.6.5.l1: a record newer than the
    // listing): unchecked, its own code, no path.
    expect(at('31.1')).toBe('gone')
    expect(at('8.6.2')).toMatchObject({ code: '8.6.2', path: null })
    expect(at('13.1')).toBe('gone')
    expect(at('1.1', 'agent-manager', 'docs/handoffs/OTHER')).toBe(null)
    const plain = [{ dir: 'docs/handoffs/P', names: ['1-orchestrator-to-agent-manager.handoff.md'], stages: {}, child: false }]
    expect(locateRecord({ dir: 'docs/handoffs/P', code: '9.1', from: 'orchestrator', to: 'agent-manager' }, plain)).toMatchObject({ code: '9.1', path: null })
  })

  test('stale briefs this session: an old code joins the root it was renamed to and opens the new record; one that cannot be found is kept out of the step charts, last', () => {
    const live = [
      liveAgent('s30', F_RUN, '30.1', 'agent-manager', 'completed', 300),
      liveAgent('old', L_RUN, '1.6.1.l3', 'agent-manager', 'completed', 310),
      liveAgent('lost', F_RUN, '31.1', 'agent-manager', 'completed', 320),
      { ...liveAgent('lostkid', F_RUN, 'x', 'research-assistant', 'completed', 330), handoff: null, prompt: 'look it up', parent: 'lost' } as LensAgent,
    ]
    const charts = stepsDescending(stepCharts(featSources(), live, MAIN, LENS_RUN_RENAMES))
    expect(charts.map(c => c.key)).toEqual([...ROOTS_DESC, NOT_FOUND])
    const c8 = charts.find(c => c.key === '8')!
    expect([c8.codes['s30'], c8.agents['s30']!.parent, c8.agents['s30']!.handoff]).toEqual(['8.2.l12.1', 'step:8:8.2', `docs/handoffs/${F_RUN}/8.2.l12.1-orchestrator-to-agent-manager.handoff.md`])
    expect([c8.codes['old'], c8.agents['old']!.parent]).toEqual(['8.2.l8.1', 'step:8:8.2'])
    expect(c8.ids).not.toContain('step:8:8.2.l12.1')
    const gone = charts.at(-1)!
    expect(gone.ids).toEqual(['main', 'lost', 'lostkid'])
    expect(gone.agents['lostkid']!.parent).toBe('lost')
    // No chart for a root that does not exist (31, 19).
    expect(charts.some(c => c.key === '31' || c.key === '19')).toBe(false)
  })
})

// ---------------- step 8.2.l15.1: per-code rename sources (the phase renaming of 2026-10-24) ----------------
describe('step 8.2.l15.1: briefs written before a per-code renaming (pure)', () => {
  const at = (code: string, to = 'agent-manager', srcs: readonly StepSource[] = featSources(), dir = `docs/handoffs/${F_RUN}`) => locateRecord({ dir, code, from: 'orchestrator', to }, srcs, LENS_RUN_RENAMES)

  test('rename sources: a .json or .md file whose name contains "rename", never a record or a run state', () => {
    for (const n of ['phase-renames-2026-10-24.json', 'renames.md', 'Code-RENAMES.json']) expect([n, isRenameSource(n)]).toEqual([n, true])
    for (const n of ['run.v1.md', 'renames.txt', 'merged-from-X.md', '00-approved-plan.md', '8.2-orchestrator-to-rename-bot.handoff.md']) expect([n, isRenameSource(n)]).toEqual([n, false])
    expect(FEAT_NAMES.filter(isRenameSource)).toEqual(['phase-renames-2026-10-24.json'])
  })

  test("codeMapOf: a JSON file's codeMap; a markdown Old code | New code table; only pairs of step codes; {} for anything else", () => {
    expect(codeMapOf('phase-renames-2026-10-24.json', FEAT_RENAMES_JSON)).toEqual(FEAT_CODEMAP)
    expect(Object.keys(FEAT_CODEMAP).length).toBe(147)
    expect(codeMapOf('r.json', JSON.stringify({ codeMap: { '8.6.5.l1': '8.4.l2.2', x: '1', '2': 'y', '3': 4, '4.1': ' 4 ' } }))).toEqual({ '8.6.5.l1': '8.4.l2.2', '4.1': '4' })
    for (const bad of ['{', 'null', '[]', '{"codeMap":[["1","2"]]}', '{"codeMap":null}', '{}']) expect([bad, codeMapOf('r.json', bad)]).toEqual([bad, {}])
    expect(codeMapOf('r.json', null)).toEqual({})
    const md = '# Renames\n\n| Old code | New code | Why |\n|---|---|---|\n| `8.6.5.l1` | `8.4.l2.2` | review round |\n| 30.1 | 8.2.l12.1 | |\n| old | 1 | |\n\n| Step | Stage |\n|---|---|\n| 9.9 | not a rename |\n'
    expect(codeMapOf('renames.md', md)).toEqual({ '8.6.5.l1': '8.4.l2.2', '30.1': '8.2.l12.1' })
    expect(codeMapOf('renames.md', '| Old | New |\n|---|---|\n| 1 | 2 |\n')).toEqual({})
  })

  test('composeCodeMaps: oldest first, a code through every later map that has its result; a repeated key takes the later value', () => {
    expect(composeCodeMaps([{ a: 'b', x: 'y' }, { b: 'c' }, { c: 'd', x: 'z' }])).toEqual({ a: 'd', x: 'z', b: 'd', c: 'd' })
    expect(composeCodeMaps([{ '1.1': '2.1' }, { '1.1': '3.1' }])).toEqual({ '1.1': '3.1' })
    expect(composeCodeMaps([])).toEqual({})
    expect(composeCodeMaps([{ ['__proto__']: '1' } as Record<string, string>])).toEqual(JSON.parse('{"__proto__":"1"}'))
  })

  test('a pre-rename code (8.6.5.l1 -> 8.4.l2.2) and a pre-root-renumbering code (30.1 -> 8.6.1 -> 8.2.l12.1) open the record they became', () => {
    expect(at('8.6.5.l1')).toMatchObject({ code: '8.4.l2.2', path: `docs/handoffs/${F_RUN}/8.4.l2.2-orchestrator-to-agent-manager.handoff.md` })
    expect(at('8.6.1')).toMatchObject({ code: '8.2.l12.1' })
    expect(at('30.1')).toMatchObject({ code: '8.2.l12.1', path: `docs/handoffs/${F_RUN}/8.2.l12.1-orchestrator-to-agent-manager.handoff.md` })
    // The current code itself is found first; a pre-rename code that maps to a gate record: 4.1 -> 4.
    expect(at('8.4.l2.2')).toMatchObject({ code: '8.4.l2.2' })
    expect(at('4.1', 'human')).toMatchObject({ code: '4', path: `docs/handoffs/${F_RUN}/4-orchestrator-to-human.handoff.md` })
  })

  test('key collisions: the Old steps keys 8, 11 and 12 are not applied to a code the per-code map has (8.1.2, 11.3, 12.1.1.l3)', () => {
    const r = parseRun(featMd())!
    expect([r.renames!['8'], r.renames!['11'], r.renames!['12']]).toEqual(['3.1', '4.1', '5.2'])
    expect([renameCode('8.1.2', r.renames!), renameCode('11.3', r.renames!), renameCode('12.1.1.l3', r.renames!)]).toEqual(['3.1.1.2', '4.1.3', '5.2.1.1.l3'])
    expect(at('8.1.2')).toMatchObject({ code: '8.2.l1.1', path: `docs/handoffs/${F_RUN}/8.2.l1.1-orchestrator-to-agent-manager.handoff.md` })
    expect(at('11.3')).toMatchObject({ code: '11.2.l3.1.2', path: `docs/handoffs/${F_RUN}/11.2.l3.1.2-orchestrator-to-agent-manager.handoff.md` })
    expect(at('12.1.1.l3')).toMatchObject({ code: '12.4.l1.1', path: `docs/handoffs/${F_RUN}/12.4.l1.1-orchestrator-to-agent-manager.handoff.md` })
    // Without the per-code map, the same briefs fall to the colliding prefixes and are not found there.
    const noMap = featSources(FEAT_NAMES, null)
    expect(at('8.1.2', 'agent-manager', noMap)).toMatchObject({ code: '8.1.2', path: null })
    expect(at('11.3', 'agent-manager', noMap)).toMatchObject({ code: '11.3', path: null })
  })

  test('a per-code map alone (no Features table) is enough; a code neither map knows: unchecked under a current root, else gone', () => {
    const only = [{ dir: `docs/handoffs/${F_RUN}`, names: FEAT_NAMES, stages: {}, child: false, codeMap: FEAT_CODEMAP }]
    expect(at('8.6.5.l1', 'agent-manager', only)).toMatchObject({ code: '8.4.l2.2' })
    expect(at('30.1', 'agent-manager', only)).toBe('gone')
    expect(at('8.2.l16.1', 'agent-manager', only)).toMatchObject({ code: '8.2.l16.1', path: null })
  })

  test('stepCharts: pre-rename briefs join the nodes they became, in chart 8; still 12 charts and no "not found" chart', () => {
    const live = [liveAgent('p', F_RUN, '8.6.5.l1', 'agent-manager', 'completed', 300), liveAgent('q', F_RUN, '30.1', 'agent-manager', 'completed', 310), liveAgent('k', F_RUN, '8.1.2', 'agent-manager', 'completed', 320)]
    const charts = stepsDescending(stepCharts(featSources(), live, MAIN, LENS_RUN_RENAMES))
    expect(charts.map(c => c.key)).toEqual(ROOTS_DESC)
    const c8 = charts.find(c => c.key === '8')!
    expect([c8.codes['p'], c8.codes['q'], c8.codes['k']]).toEqual(['8.4.l2.2', '8.2.l12.1', '8.2.l1.1'])
    expect(c8.ids.length).toBe(41)
    expect(charts.some(c => c.key === '3' && c.ids.includes('k'))).toBe(false)
  })
})

// ---------------- step 8.3.l2.1: gaps found testing the per-code rename source ----------------
describe('step 8.3.l2.1: rename sources, code maps and the locateRecord order (pure)', () => {
  const rec = (code: string, to = 'agent-manager') => ({ dir: 'docs/handoffs/R-1', code, from: 'orchestrator', to })
  const fileFor = (c: string, to = 'agent-manager') => `${c}-orchestrator-to-${to}.handoff.md`
  const src = (names: string[], extra: Partial<StepSource> = {}): StepSource => ({ dir: 'docs/handoffs/R-1', names, stages: {}, child: false, ...extra })

  test('isRenameSource: any case, "rename" anywhere in the name, .json or .md only; never a record (either kind), a run state or a file of another type', () => {
    for (const n of ['renames.md', 'RENAMES.json', 'Renames.MD', 'rename.json', 'un-renamed-notes.md', 'a.rename.md', 'rename.md.json', '2026_renames.json']) expect([n, isRenameSource(n)]).toEqual([n, true])
    for (const n of ['run.v1.md', 'run.md', 'run.v12.md', 'rename', 'renames.json5', 'renames.json.bak', 'renaming.md', 'phase.json', 'prename.json', 'unrenamed-notes.md', 'Xrenames.md', '8.2-agent-manager-to-rename-bot.handback.md', '8.2.l1.1-rename-bot-to-orchestrator.handback.md']) expect([n, isRenameSource(n)]).toEqual([n, false])
  })

  test('codeMapOf (markdown): extra columns, spaced and upper-case headers, CRLF, blank and short rows, an indented or ruleless table, two tables, a table of another kind', () => {
    const md = ['| OLD  CODE | new code | Why |', '|:--|--|--|', '| 1.1 | 2.1 | x |', '| | | |', '| 1.2 |', '| 1.3 | bad |', '|  `1.4.l2`  |  `5.l1.2`  |', '', '| Old code | New code |', '|---|---|', '| 9 | 10 |'].join('\r\n')
    expect(codeMapOf('r.md', md)).toEqual({ '1.1': '2.1', '1.4.l2': '5.l1.2', '9': '10' })
    expect(codeMapOf('r.md', '  | Old code | New code |\n  |---|---|\n  | 1 | 2 |\n')).toEqual({})
    expect(codeMapOf('r.md', '| Old code | New code |\n| 1 | 2 |\n')).toEqual({})
    expect(codeMapOf('r.md', '| New code | Old code |\n|---|---|\n| 1 | 2 |\n')).toEqual({})
    expect(codeMapOf('r.md', '| Old code | New code |\n|---|---|\n| 1 | 2 |\n| Step | Stage |\n|---|---|\n| 3 | 4 |\n')).toEqual({ '1': '2' })
    expect(codeMapOf('r.txt', '| Old code | New code |\n|---|---|\n| 1 | 2 |\n')).toEqual({ '1': '2' })
    expect(codeMapOf('r.md', '')).toEqual({})
  })

  test('codeMapOf (JSON): a codeMap that is not an object, keys and values that are not step codes, codes that are only almost codes, a repeated key after trimming, a large map; a table under a .json name is {}', () => {
    expect(codeMapOf('r.JSON', '{"codeMap":"1.1"}')).toEqual({})
    expect(codeMapOf('r.json', '{"codeMap":{}}')).toEqual({})
    expect(codeMapOf('r.json', '{"map":{"1":"2"}}')).toEqual({})
    const odd = { '1.': '2', '.1': '2', '1..2': '3', l1: '2', '1.l': '2', '1.2.': '3', '1': '2.l', '': '1', '1.1': '', '1.l2.3': '4.5', '01': '002' }
    expect(codeMapOf('r.json', JSON.stringify({ codeMap: odd }))).toEqual({ '1.l2.3': '4.5', '01': '002' })
    expect(codeMapOf('r.json', '{"codeMap":{" 1.1":"2","1.1 ":"3"}}')).toEqual({ '1.1': '3' })
    const big: Record<string, string> = {}
    for (let i = 0; i < 5000; i++) big[`${i + 1}.${i % 7}`] = `${i + 2}.l${i}`
    expect(Object.keys(codeMapOf('r.json', JSON.stringify({ codeMap: big }))).length).toBe(5000)
    expect(codeMapOf('r.json', '| Old code | New code |\n|---|---|\n| 1 | 2 |\n')).toEqual({})
  })

  test('composeCodeMaps (pinned): a chain inside one map is not followed; across maps it is; a cycle ends on one name; an identity is kept; a repeated key takes the later value', () => {
    expect(composeCodeMaps([{ a: 'b', b: 'c' }])).toEqual({ a: 'b', b: 'c' })
    expect(composeCodeMaps([{ a: 'b' }, { b: 'c' }])).toEqual({ a: 'c', b: 'c' })
    expect(composeCodeMaps([{ a: 'b' }, { b: 'c' }, { c: 'd' }, { d: 'e' }])).toEqual({ a: 'e', b: 'e', c: 'e', d: 'e' })
    expect(composeCodeMaps([{ x: 'y' }, { q: 'r' }])).toEqual({ x: 'y', q: 'r' })
    expect(composeCodeMaps([{ a: 'b' }, { b: 'a' }])).toEqual({ a: 'a', b: 'a' })
    expect(composeCodeMaps([{ a: 'a' }])).toEqual({ a: 'a' })
    expect(composeCodeMaps([{ a: 'b' }, { a: 'z', b: 'c' }])).toEqual({ a: 'z', b: 'c' })
  })

  test('locateRecord order: the code itself, then its map target, then the map applied to the prefix-moved code, then the prefix-moved code; the first one listed wins', () => {
    const all = ['1.1', '2.1', '3.1', '9.1']
    const mk = (names: string[], extra: Partial<StepSource> = {}) => src(names.map(c => fileFor(c)), extra)
    // 1. its own name beats the map target.
    expect(locateRecord(rec('1.1'), [mk(all, { codeMap: { '1.1': '2.1' } })])).toMatchObject({ code: '1.1' })
    // 2. the map target beats the prefix-moved code (30 -> 9 by prefix, 30.1 -> 2.1 per code; 9.1 and 2.1 both listed).
    expect(locateRecord(rec('30.1'), [mk(all, { renames: { '30': '9' }, codeMap: { '30.1': '2.1' } })])).toMatchObject({ code: '2.1' })
    // 2b. the map target of the code itself beats the map target of its prefix-moved code (2.1 and 3.1 both listed).
    expect(locateRecord(rec('30.1'), [mk(all, { renames: { '30': '9' }, codeMap: { '30.1': '2.1', '9.1': '3.1' } })])).toMatchObject({ code: '2.1' })
    // 3. the map applied to the prefix-moved code beats the prefix-moved code (30.1 -> 9.1 by prefix, then 9.1 -> 3.1 by map).
    expect(locateRecord(rec('30.1'), [mk(all, { renames: { '30': '9' }, codeMap: { '9.1': '3.1' } })])).toMatchObject({ code: '3.1' })
    // 4. the prefix-moved code alone when nothing else is listed.
    expect(locateRecord(rec('30.1'), [mk(['9.1'], { renames: { '30': '9' }, codeMap: { '9.1': '3.1' } })])).toMatchObject({ code: '9.1', path: `docs/handoffs/R-1/${fileFor('9.1')}` })
    // Pinned: a chain a -> b -> c inside one map is not followed when only c is listed.
    expect(locateRecord(rec('1.1'), [mk(['3.1'], { codeMap: { '1.1': '2.1', '2.1': '3.1' }, features: { '1': 'f' } })])).toMatchObject({ code: '1.1', path: null })
  })

  test('open question 1 (pinned): an unlisted code that is a key of the map is drawn at the mapped record when that record is listed', () => {
    expect(locateRecord(rec('1.1'), [src([fileFor('2.1')], { codeMap: { '1.1': '2.1' } })])).toMatchObject({ code: '2.1', path: `docs/handoffs/R-1/${fileFor('2.1')}` })
  })

  test('open question 2 (pinned): a map entry whose record has another receiver is not used; the brief keeps its own code, unchecked under a current root, gone under another', () => {
    const names = [fileFor('2.1', 'code-reviewer'), fileFor('1.9')]
    expect(locateRecord(rec('1.1'), [src(names, { codeMap: { '1.1': '2.1' } })])).toMatchObject({ code: '1.1', path: null })
    expect(locateRecord(rec('7.1'), [src(names, { codeMap: { '7.1': '2.1' } })])).toBe('gone')
  })

  test('record names match in any case and the path keeps the on-disk case', () => {
    expect(locateRecord(rec('1.1'), [src(['2.1-ORCHESTRATOR-to-Agent-Manager.handoff.md'], { codeMap: { '1.1': '2.1' } })])).toMatchObject({ code: '2.1', path: 'docs/handoffs/R-1/2.1-ORCHESTRATOR-to-Agent-Manager.handoff.md' })
  })

  test('empty maps, or a folder with no record names, check nothing', () => {
    expect(locateRecord(rec('1.1'), [src([fileFor('2.1')], { codeMap: {}, renames: {} })])).toMatchObject({ code: '1.1', path: null })
    expect(locateRecord(rec('1.1'), [src([], { codeMap: { '1.1': '2.1' } })])).toMatchObject({ code: '1.1', path: null })
  })
})

describe('step 8.3.l2.1: several rename sources of one folder (in the lens)', () => {
  const D = `docs/handoffs/${F_RUN}`
  const L21 = '8.2.l21.1'
  const L22 = '8.2.l22.1'
  const wide = { surface: 'vscode' as const, viewport: { columns: 240, rows: 60 } }
  /** The disk nodes among 8.2.l21.1 and 8.2.l22.1 that a live brief with `code` leaves undrawn: the one it took over; with the sources `extra` (path under the run folder -> text) listed in the order given. */
  const takenBy = async ($: any, on: any, code: string, extra: Record<string, string>): Promise<string[]> => {
    const records = [L21, L22].map(c => `${c}-orchestrator-to-agent-manager.handoff.md`)
    await seed($, on, { complete: false, files: { ...FEAT_FILES(), ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [`${D}/${k}`, v])) }, list: { 'docs/handoffs': [`${F_RUN}/`], [D]: [...FEAT_NAMES, ...Object.keys(extra), ...records] } })
    await spawnReal($, 2, F_RUN, code, 'agent-manager')
    const ui = await $.ui.mount({ ...pane(CHART_PANE, 'dock', 120), ...wide })
    await ui.press({ key: 'wf-show-toolu_2' })
    const keys = ((await ui.findAll({ type: 'Button' })) as any[]).map((b: any) => String(b.key))
    await ui.unmount()
    return [L21, L22].filter(c => !keys.includes(`toolu_2:agent-step:8:${c}`))
  }
  const json = (m: Record<string, string>) => JSON.stringify({ codeMap: m })

  test('sources are read sorted by name, not in listing order: on a repeated key the one that sorts last wins (upper case sorts before lower case)', HEAVY, async ($, on) => {
    expect(await takenBy($, on, '88.1', { 'zz-renames.json': json({ '88.1': L22 }), 'AA-renames.json': json({ '88.1': L21 }) })).toEqual([L22])
  })

  test('the same two sources with the contents swapped give the other result', HEAVY, async ($, on) => {
    expect(await takenBy($, on, '88.1', { 'zz-renames.json': json({ '88.1': L21 }), 'AA-renames.json': json({ '88.1': L22 }) })).toEqual([L21])
  })

  test('a later source continues what an earlier one renamed to (88.1 -> 77.1 in one file, 77.1 -> 8.2.l21.1 in a later one)', HEAVY, async ($, on) => {
    expect(await takenBy($, on, '88.1', { 'b-renames.json': json({ '77.1': L21 }), 'a-renames.json': json({ '88.1': '77.1' }) })).toEqual([L21])
  })

  test('a markdown source is read, an unreadable one adds nothing, and a record with "rename" in its name is not a source', HEAVY, async ($, on) => {
    const md = '| Old code | New code |\n|---|---|\n| 66.1 | 8.2.l22.1 |\n'
    expect(await takenBy($, on, '66.1', { 'zz-renames.md': md, 'zzz-renames.json': '{', '8.2.l30-orchestrator-to-rename-bot.handoff.md': json({ '66.1': L21 }) })).toEqual([L22])
  })

  test('nothing renames it: a brief with a code no source knows takes over none of them', HEAVY, async ($, on) => {
    expect(await takenBy($, on, '55.1', { 'zz-renames.json': json({ '88.1': L22 }) })).toEqual([])
  })
})

describe('step 8.6.1.l1: the chat card, one chart per task (pure)', () => {
  const view = (members: LensAgent[], extra: LensAgent[] = []) => {
    const agents: Record<string, LensAgent> = { main: { ...MAIN } }
    for (const a of [...members, ...extra]) agents[a.id] = a
    return { ids: ['main', ...members.map(a => a.id), ...extra.map(a => a.id)], agents, members: members.map(a => a.id) }
  }
  const place = (a: LensAgent) => spawnPlace(a, featSources())

  test('agents spawned together for two feature roots: two charts, each titled by its root; one with no record joins the first; what a member spawned goes with it', () => {
    const a = liveAgent('a', F_RUN, '8.2.l15.1', 'agent-manager', 'running', 10)
    const b = liveAgent('b', F_RUN, '12.5.l1.1', 'documentation-writer', 'completed', 11)
    const c = { ...liveAgent('c', F_RUN, 'x', 'research-assistant', 'completed', 12), handoff: null, prompt: 'look it up' } as LensAgent
    const k = { ...liveAgent('k', F_RUN, 'x', 'research-assistant', 'completed', 13), handoff: null, prompt: 'look it up', parent: 'b' } as LensAgent
    const charts = cardCharts(view([a, b, c], [k]), place)
    expect(charts.map(x => [x.key, x.title, x.ids])).toEqual([
      [`${F_RUN.toLowerCase()}:8`, 'Step 8 · ai-dlc-lens plugin from the spike', ['main', 'a', 'c']],
      [`${F_RUN.toLowerCase()}:12`, 'Step 12 · Keep-alive publishes the keep-warm time in force', ['main', 'b', 'k']],
    ])
    // The orchestrator rests in the chart whose agents have all ended.
    expect([charts[0]!.agents['main']!.status, charts[1]!.agents['main']!.status]).toEqual(['running', 'idle'])
  })

  test('one task (or a stale brief that maps to it, or none at all): one chart, the view as it is; two runs: two charts', () => {
    const a = liveAgent('a', F_RUN, '8.2.l15.1', 'agent-manager', 'running', 10)
    const s = liveAgent('s', F_RUN, '30.1', 'agent-manager', 'completed', 11)
    const v = view([a, s])
    expect(cardCharts(v, place)).toEqual([{ key: `${F_RUN.toLowerCase()}:8`, title: 'Step 8 · ai-dlc-lens plugin from the spike', ids: v.ids, agents: v.agents }])
    const none = view([{ ...a, handoff: null, prompt: 'p' } as LensAgent])
    expect(cardCharts(none, place)).toEqual([{ key: '', title: '', ids: none.ids, agents: none.agents }])
    const other = liveAgent('o', 'RES-20261020-ai-dlc-mods', '1.1', 'research-assistant', 'running', 12)
    expect(cardCharts(view([a, other]), place).map(x => x.title)).toEqual(['Step 8 · ai-dlc-lens plugin from the spike', 'RES-20261020-ai-dlc-mods: Step 1'])
  })
})

describe('step 8.6.1.l1: the workflow view and the chat card on the renumbered folder (in the lens)', () => {
  const LIST = { 'docs/handoffs': [`${F_RUN}/`], [`docs/handoffs/${F_RUN}`]: [...FEAT_NAMES] }
  const wide = { surface: 'vscode' as const, viewport: { columns: 240, rows: 60 } }

  test('the real folder: 12 step charts, by code, highest first (12 to 1, root 8 live among them); 12 holds its 13 nodes six wide; ⤢ shows one root in full screen (step 8.2.l15.1: the phase-renamed folder)', HEAVY, async ($, on) => {
    await seed($, on, { complete: false, files: FEAT_FILES(), list: LIST })
    await spawnReal($, 2, F_RUN, '8.2.l15.1', 'agent-manager')
    const ui = await $.ui.mount({ ...pane(CHART_PANE, 'dock', 120), ...wide })
    await ui.press({ key: 'wf-show-toolu_2' })
    expect(await stepKeys(ui)).toEqual(ROOTS_DESC)
    expect(await ui.find({ type: 'Text', text: 'Step 8 · ai-dlc-lens plugin from the spike' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Step 12 · Keep-alive publishes the keep-warm time in force' })).toBeDefined()
    expect(nodes(await stepSource(ui, '12'))).toBe(13)
    // chartAvatarsPerRow holds inside a step chart: 12's widest level (12.2.l1.1 to 12.5.l1.1, under the phases) is six wide.
    const svg12: any = (await chartSvgs(ui)).find((x: any) => String(x.props.alt).startsWith('Step chart 12:'))
    expect(Number(svg12.props.width)).toBe(6 * SIZE0.col)
    // Root 8: the live agent-manager runs (it blinks), at 8.2.l15.1.
    expect(await stepSource(ui, '8')).toMatch(/: running<\/title><animate /)
    // Every node has its Buttons; a loop round's arrow is two-way and named by its code.
    expect((await ui.find({ type: 'Button', key: 'toolu_2:edge-step:12:12.2.l2.1' }))?.text).toMatch(/^12\.2\.l2\.1 .+ <-> .+$/)
    expect((await ui.find({ type: 'Button', key: 'toolu_2:edge-step:12:12.2' }))?.text).toMatch(/^12\.2 .+ -> .+$/)
    expect(await ui.find({ type: 'Button', key: 'toolu_2:agent-a2' })).toBeDefined()
    // A step drawn from disk opens its records: 12.4.2's arrow (a hand-back with no handoff) and 12.5.l1.1's avatar.
    await ui.press({ key: 'toolu_2:edge-step:12:12.4.2' })
    const edge = await $.ui.mount({ ...pane('ai-dlc-lens-edge'), surface: 'vscode' })
    await edge.press({ key: 'edge-prompt' })
    expect(await edge.find({ type: 'Text', text: `No handoff record on disk for step 12.4.2; its hand-back is docs/handoffs/${F_RUN}/12.4.2-code-reviewer-to-orchestrator.handback.md.` })).toBeDefined()
    expect(await edge.find({ type: 'Text', text: /lens hook error|could not be drawn/ })).toBe(undefined)
    await edge.unmount()
    await ui.press({ key: 'toolu_2:agent-step:12:12.5.l1.1' })
    const ag = await $.ui.mount({ ...pane('ai-dlc-lens-agent'), surface: 'vscode' })
    expect(await ag.find({ type: 'Text', text: /lens hook error|could not be drawn/ })).toBe(undefined)
    expect(await ag.find({ type: 'Text', text: /Documentation Writer/ })).toBeDefined()
    await ag.unmount()
    // No stale brief: no "no longer on disk" line.
    expect(await ui.find({ type: 'Text', text: /no longer on disk/ })).toBe(undefined)
    // ⤢ on root 12: full screen, that root alone, with a Steps row for the 12.
    await ui.press({ key: 'sel:toolu_2:s12:step-full' })
    expect(await stepKeys(ui)).toEqual(['12'])
    expect(((await ui.findAll({ type: 'Button' })) as any[]).filter((b: any) => /^fs-step-/.test(String(b.key))).length).toBe(12)
    await ui.unmount()
  })

  test('briefs from before the renumbering: an old code joins its new root (still 12 charts); one whose record is gone is one collapsed line, never a chart', HEAVY, async ($, on) => {
    await seed($, on, { complete: false, files: FEAT_FILES(), list: LIST })
    await spawnReal($, 2, F_RUN, '30.1', 'agent-manager')
    await spawnReal($, 3, F_RUN, '31.1', 'agent-manager')
    // Step 8.2.l15.1: a brief from before the phase renaming, read through the folder's rename map.
    await spawnReal($, 4, F_RUN, '8.6.5.l1', 'agent-manager')
    const ui = await $.ui.mount({ ...pane(CHART_PANE, 'dock', 120), ...wide })
    await ui.press({ key: 'wf-show-toolu_2' })
    expect(await stepKeys(ui)).toEqual(ROOTS_DESC)
    // 30.1 and 8.6.5.l1 take the nodes they became (8.2.l12.1, 8.4.l2.2): chart 8 keeps its 41 nodes, none added.
    expect(nodes(await stepSource(ui, '8'))).toBe(41)
    expect(await ui.find({ type: 'Text', text: /Briefs naming records no longer on disk \(1\)/ })).toBeDefined()
    // Collapsed: the record it names shows only once opened.
    expect(await ui.find({ type: 'Text', text: /31\.1-orchestrator-to-agent-manager\.handoff\.md/ })).toBe(undefined)
    await ui.press({ key: 'sel:toolu_2:steps-gone' })
    expect(await ui.find({ type: 'Text', text: new RegExp(`docs/handoffs/${F_RUN}/31\\.1-orchestrator-to-agent-manager\\.handoff\\.md`) })).toBeDefined()
    await ui.unmount()
  })

  test('the chat card: agents spawned for two feature roots get a chart each, titled by its root; one root, one chart', async ($, on) => {
    await seed($, on, { complete: false, files: FEAT_FILES(), list: LIST })
    await spawnReal($, 2, F_RUN, '8.2.l15.1', 'agent-manager')
    const input = { subagent_type: 'ai-dlc:agent-manager', description: 'd', prompt: 'p' }
    const chatAlts = async (ui: any): Promise<string[]> => ((await ui.findAll({ type: 'Svg' })) as any[]).map((x: any) => String(x?.props?.alt ?? '')).filter(a => /^Chat chart/.test(a))
    const one = await $.ui.mount(toolRow('toolu_2', 'vscode', input, 'Agent', 240))
    expect((await chatAlts(one)).map(a => a.split(':')[0])).toEqual(['Chat chart'])
    await one.unmount()
    await spawnReal($, 3, F_RUN, '12.5.l1.1', 'documentation-writer')
    const card = await $.ui.mount(toolRow('toolu_2', 'vscode', input, 'Agent', 240))
    expect((await chatAlts(card)).map(a => a.replace(/^(Chat chart \d of \d: Step \d+) · .*$/, '$1'))).toEqual(['Chat chart 1 of 2: Step 8', 'Chat chart 2 of 2: Step 12'])
    expect(await card.find({ type: 'Text', text: 'Step 12 · Keep-alive publishes the keep-warm time in force' })).toBeDefined()
    const keys = ((await card.findAll({ type: 'Button' })) as any[]).map((b: any) => String(b.key))
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.some(k => k.startsWith('card:g0:')) && keys.some(k => k.startsWith('card:g1:'))).toBe(true)
    await card.unmount()
  })

  test("the ▲ of a blocked step is on its root's chart", async ($, on) => {
    await seed($, on, { complete: false, files: FEAT_FILES(featMd('blocked · waiting on the human')), list: LIST })
    await spawnReal($, 2, F_RUN, '8.2.l15.1', 'agent-manager')
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
    const ui = await $.ui.mount({ ...pane(CHART_PANE, 'dock', 120), surface: 'vscode' })
    await ui.press({ key: 'wf-show-toolu_2' })
    const all: any[] = await ui.findAll({ type: 'Text' })
    const before = (title: RegExp) => String(all[all.findIndex((x: any) => title.test(String(x.text))) - 1]?.text ?? '')
    expect(before(/^Step 12 · /)).toMatch(/^▲/)
    expect(before(/^Step 11 · /)).not.toMatch(/^▲/)
    expect(before(/^Step 8 · /)).not.toMatch(/^▲/)
    await ui.unmount()
  })
})

// ---------------- step 8.6.1.l1 addendum B: versioned run state (run.v1.md, run.v2.md, …) ----------------
describe('step 8.6.1.l1 (B): versioned run state', () => {
  const fm = (extra: string) => (md: string) => md.replace('status: active\n', `status: active\n${extra}`)
  const titled = (md: string, name: string) => md.replace('| 8 | ai-dlc-lens plugin from the spike |', `| 8 | ${name} |`)

  test('pure: run.v<major>[.<minor>].md files are not records; the highest version is read, else none (run.md)', async () => {
    for (const n of ['run.v1.md', 'run.v12.md', 'run.v1.1.md', 'run.v3.12.md']) expect([n, parseRecordName(n)]).toEqual([n, null])
    expect(runVersions(['run.md', 'run.v2.md', 'run.v10.md', 'run.v1.md', 'run.v1.2.md', 'run.v1.1.md', 'run.v.md', 'run.v2.md.bak', '8.1-orchestrator-to-agent-manager.handoff.md'])).toEqual([
      { major: 10, minor: 0, name: 'run.v10.md' },
      { major: 2, minor: 0, name: 'run.v2.md' },
      { major: 1, minor: 2, name: 'run.v1.2.md' },
      { major: 1, minor: 1, name: 'run.v1.1.md' },
      { major: 1, minor: 0, name: 'run.v1.md' },
    ])
    const text = (name: string) => `---\nrun: R\n---\n\n# Run: ${name}\n`
    expect((await pickRunState(['run.v1.md', 'run.v2.md'], text))?.name).toBe('run.v2.md')
    expect((await pickRunState(['run.v1.md', 'run.v1.1.md', 'run.v1.2.md'], text))?.name).toBe('run.v1.2.md')
    expect(await pickRunState([], text)).toBe(null)
  })

  // The real folder's names without its run.v1.md, so each test lists the run-state versions it is about.
  const LIST = (extra: string[]) => ({ 'docs/handoffs': [`${F_RUN}/`], [`docs/handoffs/${F_RUN}`]: [...FEAT_NAMES.filter(n => !isRunStateFile(n)), ...extra] })
  const MAP = { [`docs/handoffs/${F_RUN}/phase-renames-2026-10-24.json`]: FEAT_RENAMES_JSON }

  test('in the lens: titles, Features, Stages and the merged table come from the highest run.v<N>.md; run.md is read only when there is none', async ($, on) => {
    await seed($, on, {
      complete: false,
      files: {
        [`docs/handoffs/${F_RUN}/run.md`]: titled(featMd(), 'from run.md'),
        [`docs/handoffs/${F_RUN}/run.v1.md`]: titled(featMd(), 'from v1'),
        [`docs/handoffs/${F_RUN}/run.v2.md`]: titled(featMd(), 'from v2'),
        ...MAP,
      },
      list: LIST(['run.v1.md', 'run.v2.md']),
    })
    // A brief written before the renumbering still maps through v2's Features table and the rename map (old 30.1 -> 8.6.1 -> 8.2.l12.1).
    await spawnReal($, 2, F_RUN, '30.1', 'agent-manager')
    const ui = await $.ui.mount({ ...pane(CHART_PANE, 'dock', 120), surface: 'vscode', viewport: { columns: 240, rows: 60 } })
    await ui.press({ key: 'wf-show-toolu_2' })
    expect(await stepKeys(ui)).toEqual(ROOTS_DESC)
    expect(await ui.find({ type: 'Text', text: 'Step 8 · from v2' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /from run\.md|from v1/ })).toBe(undefined)
    expect(await ui.find({ type: 'Text', text: /no longer on disk/ })).toBe(undefined)
    await ui.unmount()
  })

  test('in the lens: a minor pair is read over its major (v1.2 over v1.1 and v1, front matter ignored); its blocked Stages row puts the ▲ on root 12', async ($, on) => {
    await seed($, on, {
      complete: false,
      files: {
        [`docs/handoffs/${F_RUN}/run.v1.md`]: titled(featMd(), 'from v1'),
        [`docs/handoffs/${F_RUN}/run.v1.1.md`]: titled(featMd(), 'from v1.1'),
        // Step 8.6.5: deprecation is no longer read from a version's own front matter; the highest is current.
        [`docs/handoffs/${F_RUN}/run.v1.2.md`]: fm('status: deprecated\nsuperseded-by: run.v1.md\n')(titled(featMd('blocked · waiting on the human'), 'from v1.2')),
      },
      list: LIST(['run.v1.md', 'run.v1.1.md', 'run.v1.2.md']),
    })
    await spawnReal($, 2, F_RUN, '8.2.l15.1', 'agent-manager')
    await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
    const ui = await $.ui.mount({ ...pane(CHART_PANE, 'dock', 120), surface: 'vscode' })
    await ui.press({ key: 'wf-show-toolu_2' })
    expect(await ui.find({ type: 'Text', text: 'Step 8 · from v1.2' })).toBeDefined()
    const all: any[] = await ui.findAll({ type: 'Text' })
    const before = (title: RegExp) => String(all[all.findIndex((x: any) => title.test(String(x.text))) - 1]?.text ?? '')
    expect(before(/^Step 12 · /)).toMatch(/^▲/)
    expect(before(/^Step 11 · /)).not.toMatch(/^▲/)
    await ui.unmount()
  })
})

// ---------------- step 8.6.3: gap-filling cases for items 8.4 to 8.6 (pure) ----------------
describe('step 8.6.3 / 8.6.5: pickRunState (versioned run state), edge cases', () => {
  const name = (major: number, minor = 0) => (minor === 0 ? `run.v${major}.md` : `run.v${major}.${minor}.md`)
  const v = (major: number, minor = 0, text: string | null = `---\nrun: R\n---\n\n# v${major}.${minor}\n`) => ({ major, minor, name: name(major, minor), text })
  /** pickRunState over these versions, with the files it read, in order. */
  const pick = async (vs: ReturnType<typeof v>[]) => {
    const reads: string[] = []
    const hit = await pickRunState(
      vs.map(x => x.name),
      n => {
        reads.push(n)
        return vs.find(x => x.name === n)!.text
      },
    )
    return { name: hit?.name ?? null, text: hit?.text ?? null, reads }
  }

  test('[8.6.5] versions compare as numbers, not names: v10 beats v9 and v2, whatever the input order', async () => {
    expect((await pick([v(9), v(10), v(2)])).name).toBe('run.v10.md')
    expect((await pick([v(2), v(10), v(9)])).name).toBe('run.v10.md')
    expect((await pick([v(1), v(11), v(9), v(100)])).name).toBe('run.v100.md')
    // The result carries the text of the version it names, and the input is not reordered.
    const input = [v(9), v(10)]
    expect(await pick(input)).toMatchObject({ name: 'run.v10.md', text: input[1]!.text })
    expect(input.map(x => x.major)).toEqual([9, 10])
  })

  test('[8.6.5] major, then minor, both numeric: v2 > v1.2 > v1.1 > v1; v1.10 > v1.9; a bare major is minor 0', async () => {
    expect((await pick([v(1), v(1, 1), v(1, 2), v(2)])).name).toBe('run.v2.md')
    expect((await pick([v(1, 2), v(1), v(1, 1)])).name).toBe('run.v1.2.md')
    expect((await pick([v(1, 9), v(1, 10), v(1, 2)])).name).toBe('run.v1.10.md')
    expect((await pick([v(1, 99), v(2)])).name).toBe('run.v2.md')
    expect((await pick([v(1), v(1, 1)])).name).toBe('run.v1.1.md')
    const names = ['run.v1.md', 'run.v1.10.md', 'run.v1.9.md', 'run.v2.md', 'run.v1.1.md', 'run.v10.md', 'run.v9.2.md']
    expect(runVersions(names).map(x => x.name)).toEqual(['run.v10.md', 'run.v9.2.md', 'run.v2.md', 'run.v1.10.md', 'run.v1.9.md', 'run.v1.1.md', 'run.v1.md'])
  })

  test('[8.6.5] names: zero and zero-padded parts, extra parts and other suffixes are not versions; case is not ignored (as the auto-handoff module writes them)', () => {
    for (const n of ['run.v0.md', 'run.v01.md', 'run.v1.0.md', 'run.v1.01.md', 'run.v0.1.md', 'run.v1.1.1.md', 'run.v1..md', 'run.v.1.md', 'run.v1.md.bak', 'run.v1.mdx', 'xrun.v1.md', 'run.v-1.md', 'run.v1a.md'])
      expect([n, RUN_VERSION.test(n), isRunStateFile(n)]).toEqual([n, false, false])
    for (const n of ['RUN.V1.MD', 'Run.v1.md', 'run.V1.md', 'run.v1.MD', 'RUN.md', 'Run.md']) expect([n, RUN_VERSION.test(n), isRunStateFile(n)]).toEqual([n, false, false])
    for (const n of ['run.v1.md', 'run.v1.1.md', 'run.v10.20.md', 'run.md']) expect([n, isRunStateFile(n)]).toEqual([n, true])
    expect(runVersions(['run.v0.md', 'run.v01.md', 'run.v1.0.md', 'Run.V3.1.md', 'run.v3.1.md'])).toEqual([{ major: 3, minor: 1, name: 'run.v3.1.md' }])
    // Upper-case names are neither run states nor records.
    for (const n of ['RUN.V2.md', 'RUN.md']) expect([n, parseRecordName(n)]).toEqual([n, null])
  })

  test('[8.6.5] none to read: no versions, or none readable, is null so the caller falls back to the legacy run.md', async () => {
    expect((await pick([])).name).toBe(null)
    expect(await pick([v(1, 0, null), v(2, 0, null)])).toEqual({ name: null, text: null, reads: ['run.v2.md', 'run.v1.md'] })
  })

  test('[8.6.5] read cost: highest first, stopping at the first readable version; an unreadable one is skipped for the next', async () => {
    const many = Array.from({ length: 40 }, (_, i) => v(Math.floor(i / 4) + 1, i % 4))
    expect(await pick(many)).toMatchObject({ name: 'run.v10.3.md', reads: ['run.v10.3.md'] })
    expect(await pick([v(1), v(2, 0, null)])).toMatchObject({ name: 'run.v1.md', reads: ['run.v2.md', 'run.v1.md'] })
    expect(await pick([v(1), v(1, 1), v(1, 2, null), v(1, 3, null)])).toMatchObject({ name: 'run.v1.1.md', reads: ['run.v1.3.md', 'run.v1.2.md', 'run.v1.1.md'] })
  })

  test('[8.6.5] deprecation fields in front matter are not read: the highest version is current whatever it says', async () => {
    for (const front of ['status: deprecated\n', 'status: deprecated-pending\n', 'deprecated: true\n', 'superseded-by: run.v1.md\n', 'deprecated-by: run.v1.md\n'])
      expect([front, (await pick([v(1), v(2, 0, `---\nrun: R\n${front}---\n`)])).name]).toEqual([front, 'run.v2.md'])
    // A newer version naming older ones changes nothing either: the newest is read.
    expect((await pick([v(1), v(2), v(3, 0, '---\ndeprecates: v2\n---\n')])).name).toBe('run.v3.md')
  })

  test('[8.6.5] run-state files are never records', () => {
    for (const n of ['run.md', 'run.v1.md', 'run.v1.1.md', 'run.v1.2.md', 'run.v2.md']) expect([n, parseRecordName(n)]).toEqual([n, null])
  })
})

describe('step 8.6.3: stepsDescending with ten or more roots', () => {
  const chart = (key: string) => ({ key, step: /(\d+)$/.test(key) ? Number(/(\d+)$/.exec(key)![1]) : null })

  test('[8.6.1.l1 A] numeric, not string order: 100, 12, 11, 10, 9 ... 1 (a string sort would put 9 first)', () => {
    const keys = ['1', '10', '100', '11', '12', '2', '3', '4', '5', '6', '7', '8', '9']
    const want = ['100', '12', '11', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1']
    expect(stepsDescending(keys.map(chart)).map(c => c.key)).toEqual(want)
    expect(stepsDescending([...keys].reverse().map(chart)).map(c => c.key)).toEqual(want)
  })

  test('[8.6.1.l1 A] a child run: by child folder, then step numerically highest first; its steps never mix into the run own steps', () => {
    const keys = ['b:9', 'a:10', 'a:9', 'a:100', '3', 'b:10', '10', NOT_FOUND, NO_STEP]
    expect(stepsDescending(keys.map(chart)).map(c => c.key)).toEqual(['10', '3', 'a:100', 'a:10', 'a:9', 'b:10', 'b:9', NO_STEP, NOT_FOUND])
  })

  test('[8.6.1.l1 A] empty and single inputs; the input array is not changed; equal charts keep a stable order by key', () => {
    expect(stepsDescending([])).toEqual([])
    expect(stepsDescending([chart('4')]).map(c => c.key)).toEqual(['4'])
    const input = ['2', '10', '1'].map(chart)
    stepsDescending(input)
    expect(input.map(c => c.key)).toEqual(['2', '10', '1'])
    const same = [{ key: 'z:5', step: 5 }, { key: 'a:5', step: 5 }, { key: 'm:5', step: 5 }]
    expect(stepsDescending(same).map(c => c.key)).toEqual(['a:5', 'm:5', 'z:5'])
  })

  test('[8.6.1.l1 A] real charts: roots 13, 14, 15 and 100 added to the real folder sort 100, 15, 14, 13, 12 ... 1', () => {
    const extra = ['13.1', '14.1', '15.1', '100.1'].map(c => `${c}-orchestrator-to-agent-manager.handoff.md`)
    const charts = stepCharts(featSources([...FEAT_NAMES, ...extra]), [], MAIN)
    expect(charts.length).toBe(16)
    expect(stepsDescending(charts).map(c => c.key)).toEqual(['100', '15', '14', '13', ...ROOTS_DESC])
  })
})

describe('step 8.6.3: cardCharts (the chat card, one chart per task), with a stub `place`', () => {
  const ag = (id: string, status: string, parent = 'main'): LensAgent => ({ ...liveAgent(id, F_RUN, '8.6.1', 'agent-manager', status, 10), parent })
  const mk = (list: LensAgent[], members: string[]) => {
    const agents: Record<string, LensAgent> = { main: { ...MAIN } }
    for (const a of list) agents[a.id] = a
    return { ids: ['main', ...list.map(a => a.id)], agents, members }
  }
  const byId = (map: Record<string, string>) => (a: LensAgent) => (map[a.id] === undefined ? { key: '', title: '' } : { key: map[a.id]!, title: `T ${map[a.id]}` })

  test('[8.6.1.l1] three tasks: one chart each, in the order of their first member; ids keep the view order; each chart has the root', () => {
    const v = mk([ag('c', 'completed'), ag('a', 'completed'), ag('b', 'completed'), ag('a2', 'completed')], ['c', 'a', 'b', 'a2'])
    const charts = cardCharts(v, byId({ c: 'z', a: 'x', b: 'y', a2: 'x' }))
    expect(charts.map(x => [x.key, x.title, x.ids])).toEqual([
      ['z', 'T z', ['main', 'c']],
      ['x', 'T x', ['main', 'a', 'a2']],
      ['y', 'T y', ['main', 'b']],
    ])
    for (const c of charts) expect(Object.keys(c.agents).sort()).toEqual([...c.ids].sort())
  })

  test("[8.6.1.l1] the orchestrator's node: working in a chart with an agent at work, resting in one whose agents all ended; the view's own root is untouched", () => {
    const v = mk([ag('a', 'running'), ag('b', 'completed')], ['a', 'b'])
    const charts = cardCharts(v, byId({ a: 'x', b: 'y' }))
    expect([charts[0]!.agents['main']!.status, charts[1]!.agents['main']!.status]).toEqual(['running', 'idle'])
    expect(v.agents['main']!.status).toBe('running')
  })

  test('[8.6.1.l1] a spawner between the root and members of two tasks is drawn in both charts; what a member spawned goes with that member', () => {
    const s = ag('s', 'running')
    const a = ag('a', 'completed', 's')
    const b = ag('b', 'completed', 's')
    const kid = ag('kid', 'completed', 'b')
    const v = mk([s, a, b, kid], ['a', 'b'])
    const charts = cardCharts(v, byId({ a: 'x', b: 'y' }))
    expect(charts.map(c => c.ids)).toEqual([['main', 's', 'a'], ['main', 's', 'b', 'kid']])
  })

  test('[8.6.1.l1] a member whose task is unknown joins the first task, even when it comes before it in the list', () => {
    const v = mk([ag('lost', 'completed'), ag('a', 'completed'), ag('b', 'completed')], ['lost', 'a', 'b'])
    const charts = cardCharts(v, byId({ a: 'x', b: 'y' }))
    expect(charts.map(c => [c.key, c.ids])).toEqual([['x', ['main', 'lost', 'a']], ['y', ['main', 'b']]])
  })

  test('[8.6.1.l1] one task, no task, no members, the root named as a member, or a member with no agent: one chart, the view as it is', () => {
    const v = mk([ag('a', 'completed'), ag('b', 'completed')], ['a', 'b'])
    const one = cardCharts(v, byId({ a: 'x', b: 'x' }))
    expect(one).toHaveLength(1)
    expect(one[0]!.ids).toBe(v.ids)
    expect(one[0]!.agents).toBe(v.agents)
    expect(cardCharts(v, byId({}))).toEqual([{ key: '', title: '', ids: v.ids, agents: v.agents }])
    expect(cardCharts(mk([], []), byId({}))).toHaveLength(1)
    const odd = { ...v, members: ['main', 'ghost', 'a'] }
    expect(cardCharts(odd, byId({ main: 'q', ghost: 'r', a: 'x' })).map(c => c.key)).toEqual(['x'])
  })
})

describe('step 8.6.3: spawnPlace and locateRecord, edge cases', () => {
  const rec = (code: string, to = 'agent-manager') => `docs/handoffs/${F_RUN}/${code}-orchestrator-to-${to}.handoff.md`
  const bare = (over: Partial<LensAgent>) => ({ ...liveAgent('x', F_RUN, '8.6.1', 'agent-manager', 'completed', 1), ...over }) as LensAgent

  test("[8.6.1.l1] spawnPlace: the brief's record from its handoff, else from the prompt; a run the lens has not read; a gone record; no record", () => {
    const srcs = featSources()
    const root8 = { key: `${F_RUN.toLowerCase()}:8`, title: 'Step 8 · ai-dlc-lens plugin from the spike' }
    expect(spawnPlace(bare({}), srcs)).toEqual(root8)
    expect(spawnPlace(bare({ handoff: null, prompt: `Read ${rec('8.4.4', 'sqa-engineer')} first` }), srcs)).toEqual(root8)
    expect(spawnPlace(bare({ handoff: rec('12.1.6', 'documentation-writer') }), srcs)).toMatchObject({ key: `${F_RUN.toLowerCase()}:12` })
    // A run that was never read: its folder and the first number of the code.
    expect(spawnPlace(bare({ handoff: 'docs/handoffs/RES-1-x/3.2.1-orchestrator-to-research-assistant.handoff.md' }), srcs)).toEqual({ key: 'res-1-x:3', title: 'RES-1-x: Step 3' })
    expect(spawnPlace(bare({ handoff: rec('31.1') }), srcs, LENS_RUN_RENAMES)).toEqual({ key: '', title: '' })
    expect(spawnPlace(bare({ handoff: null, prompt: 'no record anywhere' }), srcs)).toEqual({ key: '', title: '' })
    expect(spawnPlace(bare({ handoff: 'docs/handoffs/x/notes.md' }), srcs)).toEqual({ key: '', title: '' })
  })

  test('[8.6.1.l1] spawnPlace: an old code and its new code give one task; a merged-away run counts under the run that keeps its records', () => {
    const srcs = featSources()
    const old = spawnPlace(bare({ handoff: rec('30.1') }), srcs, LENS_RUN_RENAMES)
    const now = spawnPlace(bare({ handoff: rec('8.6.1') }), srcs, LENS_RUN_RENAMES)
    expect(old).toEqual(now)
    const merged = spawnPlace(bare({ handoff: `docs/handoffs/${L_RUN}/1.6.1.l3-orchestrator-to-agent-manager.handoff.md` }), srcs, LENS_RUN_RENAMES)
    expect(merged.key).toBe(`${F_RUN.toLowerCase()}:8`)
  })

  test('locateRecord: a run listed with no names, or with neither renames nor a per-code map, is unchecked (no path); the file name check ignores case; windows separators', () => {
    const r = { dir: `docs/handoffs/${F_RUN}`, code: '8.6.1', from: 'orchestrator', to: 'agent-manager' }
    const base = featSources()[0]!
    expect(locateRecord(r, [{ ...base, names: [] }], LENS_RUN_RENAMES)).toMatchObject({ code: '8.6.1', path: null })
    expect(locateRecord(r, [{ ...base, renames: {}, codeMap: {} }])).toMatchObject({ code: '8.6.1', path: null })
    expect(locateRecord(r, [{ ...base, renames: undefined, codeMap: undefined }])).toMatchObject({ code: '8.6.1', path: null })
    // Step 8.2.l15.1: either source alone is a renaming: the per-code map alone moves 8.6.1 to 8.2.l12.1.
    expect(locateRecord(r, [{ ...base, renames: {} }])).toMatchObject({ code: '8.2.l12.1', path: `docs/handoffs/${F_RUN}/8.2.l12.1-orchestrator-to-agent-manager.handoff.md` })
    const now = { ...r, code: '8.2.l12.1' }
    const upper = { ...base, names: base.names.map(n => n.toUpperCase()) }
    // Step 8.6.5: the path is the name as listed on disk, not lower-cased.
    expect(locateRecord(now, [upper])).toMatchObject({ code: '8.2.l12.1', path: `docs/handoffs/${F_RUN}/8.2.L12.1-ORCHESTRATOR-TO-AGENT-MANAGER.HANDOFF.MD` })
    expect(locateRecord(r, [upper])).toMatchObject({ code: '8.2.l12.1', path: `docs/handoffs/${F_RUN}/8.2.L12.1-ORCHESTRATOR-TO-AGENT-MANAGER.HANDOFF.MD` })
    expect(locateRecord({ ...now, dir: `docs\\handoffs\\${F_RUN}` }, [base])).toMatchObject({ code: '8.2.l12.1', path: `docs/handoffs/${F_RUN}/8.2.l12.1-orchestrator-to-agent-manager.handoff.md` })
    expect(locateRecord({ ...now, dir: `./docs/handoffs/${F_RUN}/` }, [base])).toMatchObject({ code: '8.2.l12.1' })
  })

  test('locateRecord: the receiver and sender must match the record on disk (else gone); a redirect to a run that is not listed is null', () => {
    const srcs = featSources()
    expect(locateRecord({ dir: `docs/handoffs/${F_RUN}`, code: '30.1', from: 'orchestrator', to: 'sqa-engineer' }, srcs, LENS_RUN_RENAMES)).toBe('gone')
    expect(locateRecord({ dir: `docs/handoffs/${F_RUN}`, code: '30.1', from: 'someone', to: 'agent-manager' }, srcs, LENS_RUN_RENAMES)).toBe('gone')
    const lost = { [L_RUN.toLowerCase()]: { dir: 'docs/handoffs/NOT-LISTED', offset: 18 } }
    expect(locateRecord({ dir: `docs/handoffs/${L_RUN}`, code: '1.1', from: 'orchestrator', to: 'agent-manager' }, srcs, lost)).toBe(null)
  })
})

describe('step 8.6.3: chartAvatarsPerRow bounds and invalid values (coerce)', () => {
  test('[8.4.2] file values: 2 and 24 are the bounds; 1, 25, fractions, strings, booleans, null and structures are ignored', () => {
    const file = (v: unknown) => resolve([fileLevel('.ai-dlc/lens.json', JSON.stringify({ chartAvatarsPerRow: v })).level])
    for (const [v, want] of [[2, 2], [3, 3], [23, 23], [24, 24]] as const) expect([v, file(v).settings.chartAvatarsPerRow]).toEqual([v, want])
    for (const v of [1, 0, -2, 25, 100, 2.5, 8.0001, '8', '', true, false, null, [8], {}]) expect([JSON.stringify(v), file(v).settings.chartAvatarsPerRow]).toEqual([JSON.stringify(v), 8])
    for (const v of [1, 25, 2.5, '8', true]) expect([JSON.stringify(v), file(v).ignored]).toEqual([JSON.stringify(v), [`.ai-dlc/lens.json: chartAvatarsPerRow = ${JSON.stringify(v)} is invalid, ignored`]])
    expect(file(8.0).settings.chartAvatarsPerRow).toBe(8)
  })

  test('[8.4.2] env values (always strings): whole numbers and surrounding spaces are read; anything else is ignored with a warning', () => {
    const env = (v: string) => resolve([envLevel('.claude/settings.json', JSON.stringify({ env: { AI_DLC_LENS_CHART_AVATARS_PER_ROW: v } })).level])
    for (const [v, want] of [['2', 2], ['24', 24], [' 10 ', 10], ['08', 8], ['007', 7]] as const) expect([v, env(v).settings.chartAvatarsPerRow]).toEqual([v, want])
    for (const v of ['1', '25', '-3', '6.5', '1e1', '0x10', '+6', 'six', '', ' ', '8px', '2 4']) {
      const r = env(v)
      expect([v, r.settings.chartAvatarsPerRow, r.sources.chartAvatarsPerRow]).toEqual([v, 8, 'default'])
      expect(r.ignored).toHaveLength(1)
    }
  })

  test('[8.4.2] an invalid value at one level falls through to the next valid level, not to the default', () => {
    const lv = [
      envLevel('.claude/settings.local.json', JSON.stringify({ env: { AI_DLC_LENS_CHART_AVATARS_PER_ROW: '1' } })).level,
      fileLevel('.ai-dlc/lens.json', JSON.stringify({ chartAvatarsPerRow: 5 })).level,
    ]
    const r = resolve(lv)
    expect([r.settings.chartAvatarsPerRow, r.sources.chartAvatarsPerRow, r.ignored.length]).toEqual([5, '.ai-dlc/lens.json', 1])
  })

  test('[8.4.2] setKey: bounds accepted and refused with the stated range; a non-number is refused', () => {
    for (const ok of ['2', '24', ' 12 ']) expect([ok, setKey(null, 'chartAvatarsPerRow', ok).error]).toEqual([ok, ''])
    for (const bad of ['1', '0', '25', '-1', '3.5', 'x']) expect([bad, setKey(null, 'chartAvatarsPerRow', bad).error]).toEqual([bad, `${bad} is not valid for chartAvatarsPerRow: an integer 2..24`])
  })
})

// ---------------- step 8.6.5.l1: round codes of the current naming (`<sub-root>.l<k>.<r>`) ----------------
describe('step 8.6.5.l1: loop rounds of the current naming hang under their sub-root', () => {
  const recs = (names: string[]) => names.map(parseRecordName).filter((r): r is NonNullable<typeof r> => r !== null)
  const ROUND_NAMES = [
    '13.2-orchestrator-to-agent-manager.handoff.md',
    '13.2-agent-manager-to-orchestrator.handback.md',
    '13.4.1-orchestrator-to-code-reviewer.handoff.md',
    '13.4.1-code-reviewer-to-orchestrator.handback.md',
    '13.4.l1.1-orchestrator-to-agent-manager.handoff.md',
    '13.4.l1.1-agent-manager-to-orchestrator.handback.md',
    '13.4.l1.1.1-orchestrator-to-code-reviewer.handoff.md',
    '13.4.l1.1.2-orchestrator-to-code-reviewer.handoff.md',
    '13.4.l1.2-orchestrator-to-agent-manager.handoff.md',
    '13.4.l2.1-orchestrator-to-agent-manager.handoff.md',
    '13.5.l1.1-orchestrator-to-brutal-critique.handoff.md',
  ]

  test('pure (stepTrees): no node for a loop code with no record; its rounds under the sub-root, as loop rounds; a round\'s sub-numbers under the round', () => {
    const t = stepTrees(recs(ROUND_NAMES)).find(x => x.step === 13)!
    expect(t.nodes.map(n => `${n.code} <- ${n.parent ?? ''}${n.loop ? ' (loop)' : ''}`)).toEqual([
      '13 <- ',
      '13.2 <- 13',
      '13.4 <- 13',
      '13.4.1 <- 13.4',
      '13.4.l1.1 <- 13.4 (loop)',
      '13.4.l1.1.1 <- 13.4.l1.1',
      '13.4.l1.1.2 <- 13.4.l1.1',
      '13.4.l1.2 <- 13.4 (loop)',
      '13.4.l2.1 <- 13.4 (loop)',
      '13.5 <- 13',
      '13.5.l1.1 <- 13.5 (loop)',
    ])
    // A live spawn whose brief names a round not on disk yet takes the same place.
    const live = stepTrees(recs(ROUND_NAMES.slice(0, 4)), ['13.4.l1.1']).find(x => x.step === 13)!
    expect(live.nodes.map(n => `${n.code} <- ${n.parent ?? ''}${n.loop ? ' (loop)' : ''}`)).toContain('13.4.l1.1 <- 13.4 (loop)')
    expect(live.nodes.some(n => n.code === '13.4.l1')).toBe(false)
  })

  test('pure (stepTrees): the older naming is unchanged: a `.l<k>` code with a record is a round, and what hangs under it stays there', () => {
    const t = stepTrees(recs(['5.1-orchestrator-to-x.handoff.md', '5.1.l2-orchestrator-to-x.handoff.md', '5.1.l2.1-x-to-y.handoff.md'])).find(x => x.step === 5)!
    expect(t.nodes.map(n => `${n.code} <- ${n.parent ?? ''}${n.loop ? ' (loop)' : ''}`)).toEqual(['5 <- ', '5.1 <- 5', '5.1.l2 <- 5.1 (loop)', '5.1.l2.1 <- 5.1.l2'])
  })

  test('stepCharts: the rounds are drawn under the sub-root with two-way arrows; the real run\'s charts are unchanged', () => {
    const charts = stepCharts(featSources([...FEAT_NAMES, ...ROUND_NAMES]), [], MAIN)
    const c13 = charts.find(c => c.key === '13')!
    expect(edgesOf(c13)).toEqual([
      '13 <- ',
      '13.2 <- 13',
      '13.4 <- 13',
      '13.4.1 <- 13.4',
      '13.4.l1.1 <- 13.4',
      '13.4.l1.1.1 <- 13.4.l1.1',
      '13.4.l1.1.2 <- 13.4.l1.1',
      '13.4.l1.2 <- 13.4',
      '13.4.l2.1 <- 13.4',
      '13.5 <- 13',
      '13.5.l1.1 <- 13.5',
    ])
    const loopOf = (code: string) => c13.agents[c13.ids.find(id => c13.codes[id] === code)!]!.loop
    expect(['13.4.l1.1', '13.4.l1.2', '13.4.l2.1', '13.5.l1.1', '13.4.l1.1.1', '13.4.1'].map(loopOf)).toEqual([true, true, true, true, false, false])
    expect(charts.filter(c => c.key !== '13').map(c => edgesOf(c))).toEqual(stepCharts(featSources(), [], MAIN).map(c => edgesOf(c)))
  })
})

describe('step 8.6.5.l1: a run folder with many run-state versions (scanRuns / readRunState in the lens)', () => {
  const titled = (md: string, name: string) => md.replace('| 8 | ai-dlc-lens plugin from the spike |', `| 8 | ${name} |`)
  test('twelve versions, majors and minors, listed in any order: the charts are titled from the highest; upper-case and zero-padded names are not versions', async ($, on) => {
    const versions = ['run.v1.md', 'run.v1.1.md', 'run.v1.2.md', 'run.v2.md', 'run.v2.1.md', 'run.v2.2.md', 'run.v2.10.md', 'run.v2.9.md', 'run.v3.md', 'run.v3.1.md', 'run.v3.2.md', 'run.v3.10.md']
    const decoys = ['RUN.V9.md', 'run.v09.md', 'run.v3.010.md']
    const files: Record<string, string> = {}
    for (const n of [...versions, ...decoys]) files[`docs/handoffs/${F_RUN}/${n}`] = titled(featMd(), `from ${n}`)
    await seed($, on, { complete: false, files, list: { 'docs/handoffs': [`${F_RUN}/`], [`docs/handoffs/${F_RUN}`]: [...FEAT_NAMES, ...[...versions, ...decoys].reverse()] } })
    await spawnReal($, 2, F_RUN, '8.6.1', 'agent-manager')
    const ui = await $.ui.mount({ ...pane(CHART_PANE, 'dock', 120), surface: 'vscode', viewport: { columns: 240, rows: 60 } })
    await ui.press({ key: 'wf-show-toolu_2' })
    expect(await stepKeys(ui)).toEqual(ROOTS_DESC)
    expect(await ui.find({ type: 'Text', text: 'Step 8 · from run.v3.10.md' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /from (RUN\.V9|run\.v09|run\.v3\.010|run\.v3\.2)\.md/ })).toBe(undefined)
    await ui.unmount()
  })
})
