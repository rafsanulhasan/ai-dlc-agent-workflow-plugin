/**
 * Step 43, requirement C1 (status bugs), tests added by the SQA engineer. Tag: [C1a] latest attempt wins (a failed or
 * killed agent that started again is not "halted"), [C1] a done run state or a done *Stages* row reads completed (a
 * pending placeholder or a record without a hand-back no longer beats a finished step; blocked still halts; a listed
 * `completed` applies), [C1b] another session's change to a run state shows within the 2 s poll, an unchanged one costs
 * no refresh.
 *
 * The pure helpers (`workflowStatus`, `settleMembers`, `stageStatuses`, `stageDone`, `attemptKey`, `runStateSig`) are
 * tested alone; the sessions are driven through the engine harness with their own small fake file system (the one in
 * lens.test.tsx is not exported), and read the status dot of the workflow pane and of the band.
 *
 * "Fails on the old code" (base 1302cd4), by reading its `workflowStatus` (any failed/killed member halted, whatever came
 * after; the run's `done` was never read; a pending member made the workflow pending; `refreshList` skipped a listed
 * `completed`; the 2 s poll never looked at a run folder): the [C1a], [C1] and [C1b] session tests and the pure tests
 * that name `settleMembers`, `stageDone`, `stageStatuses`, `attemptKey` or `runStateSig` (not exported there) cannot pass on it.
 *
 * Step 44 (appended at the end of the file, same harness): [R44.5] the list and the band never read an `active` or
 * `blocked` run as completed (`runListStatus`, and the newest run-state version wins), [R44.4, R44.21] the lens band: a
 * terminal or desktop render draws it whatever else is attached, and a VS Code render draws it only where every attached
 * surface draws a band (`bandEverywhere`), so the narrow VS Code view has the pane alone. In this
 * file the sessions are on a terminal, and the finished agent of an `active` run reads waiting, not completed.
 */
import { describe, expect, test } from 'claude-code/testing'
import { OPEN, attemptKey, bandEverywhere, runListStatus, runStateSig, settleMembers, stageDone, stageStatuses, workflowStatus } from '../hooks/lens'
import type { StatusMember } from '../hooks/lens'
import { DEFAULTS, envLevel, fileLevel, resolve } from '../hooks/settings'

const PLUGIN = 'ai-dlc-lens'
const CHART_PANE = 'ai-dlc-lens-chart'

// ---------------------------------------------------------------- pure helpers

const m = (status: string, extra: object = {}) => ({ status, type: 'x', ...extra }) as unknown as StatusMember & { startedAt?: number }
const KEY = (a: any): string | null => a.key ?? null

describe('[C1] workflowStatus: the run state decides, blocked first', () => {
  test('[C1] a run `blocked` halts even when every agent completed', () => {
    expect(workflowStatus([m('completed')], ['blocked'])).toBe('halted')
    expect(workflowStatus([m('completed')], ['done', 'blocked'])).toBe('halted')
  })

  test('[C1] every run named `done` (at least one) reads completed whatever the agents say: failed, running, pending, waiting', () => {
    for (const s of ['failed', 'killed', 'running', 'pending', 'waiting']) expect(workflowStatus([m(s)], ['done'])).toBe('completed')
    expect(workflowStatus([], ['done'])).toBe('completed')
    expect(workflowStatus([m('running')], ['done', 'done'])).toBe('completed')
  })

  test('[C1] the run status is trimmed and case-insensitive; empty ones are ignored', () => {
    expect(workflowStatus([m('running')], [' DONE '])).toBe('completed')
    expect(workflowStatus([m('completed')], [' Blocked'])).toBe('halted')
    expect(workflowStatus([m('running')], ['', '  ', 'done'])).toBe('completed')
    // Only empty statuses: the agents decide, as before.
    expect(workflowStatus([m('running')], ['', ' '])).toBe('in-progress')
  })

  test('[C1] boundary: one run not done (active), or done mixed with active, falls back to the agents', () => {
    expect(workflowStatus([m('running')], ['active'])).toBe('in-progress')
    expect(workflowStatus([m('running')], ['done', 'active'])).toBe('in-progress')
    expect(workflowStatus([m('failed')], ['done', 'active'])).toBe('halted')
    expect(workflowStatus([m('pending')], ['active'])).toBe('pending')
    expect(workflowStatus([m('completed')], ['active'])).toBe('completed')
  })

  test('[C1] boundary: with no run named the old rules stand (failed halts, killed halts, running, waiting, pending, completed)', () => {
    expect(workflowStatus([m('failed')])).toBe('halted')
    expect(workflowStatus([m('killed'), m('running')])).toBe('halted')
    expect(workflowStatus([m('running'), m('completed')])).toBe('in-progress')
    expect(workflowStatus([m('waiting')])).toBe('waiting')
    expect(workflowStatus([m('pending')])).toBe('pending')
    expect(workflowStatus([])).toBe('pending')
    expect(workflowStatus([m('completed'), m('completed')])).toBe('completed')
  })

  test('the spawner is left out of the members, as before', () => {
    expect(workflowStatus([m('running', { id: 'main' }), m('completed', { id: 'a1' })], [], 'main')).toBe('completed')
  })
})

describe('[C1a] settleMembers: the latest attempt wins', () => {
  test('[C1a] a failed member is left out when a later member has the same attempt key: the run is not halted', () => {
    const all = [m('failed', { key: 'R|1', startedAt: 10 }), m('running', { key: 'R|1', startedAt: 20 })]
    const kept = settleMembers(all, KEY)
    expect(kept.map(a => a.status)).toEqual(['running'])
    expect(workflowStatus(kept)).toBe('in-progress')
    // The old reading of the same members: halted for ever.
    expect(workflowStatus(all)).toBe('halted')
  })

  test('[C1a] a killed member is superseded the same way; the later one ending decides (completed)', () => {
    const kept = settleMembers([m('killed', { key: 'R|1', startedAt: 10 }), m('completed', { key: 'R|1', startedAt: 20 })], KEY)
    expect(kept.map(a => a.status)).toEqual(['completed'])
    expect(workflowStatus(kept)).toBe('completed')
  })

  test('[C1a] a member not started yet (startedAt 0 or absent) is later than every started one', () => {
    expect(settleMembers([m('failed', { key: 'R|1', startedAt: 99 }), m('pending', { key: 'R|1', startedAt: 0 })], KEY).map(a => a.status)).toEqual(['pending'])
    expect(settleMembers([m('failed', { key: 'R|1', startedAt: 99 }), m('pending', { key: 'R|1' })], KEY).map(a => a.status)).toEqual(['pending'])
  })

  test('[C1a] equal start times go by list order: the later in the list is the later attempt', () => {
    expect(settleMembers([m('failed', { key: 'R|1', startedAt: 5 }), m('running', { key: 'R|1', startedAt: 5 })], KEY).map(a => a.status)).toEqual(['running'])
    // The other way round the failure is the later attempt and stays.
    expect(settleMembers([m('running', { key: 'R|1', startedAt: 5 }), m('failed', { key: 'R|1', startedAt: 5 })], KEY).map(a => a.status)).toEqual(['running', 'failed'])
  })

  test('[C1a] boundary: a failure AFTER a completed attempt of the same step stays and halts', () => {
    const kept = settleMembers([m('completed', { key: 'R|1', startedAt: 10 }), m('failed', { key: 'R|1', startedAt: 20 })], KEY)
    expect(kept.map(a => a.status)).toEqual(['completed', 'failed'])
    expect(workflowStatus(kept)).toBe('halted')
  })

  test('[C1a] boundary: a failure with no retry, a retry of ANOTHER step, or a member with no key all keep the failure', () => {
    expect(workflowStatus(settleMembers([m('failed', { key: 'R|1', startedAt: 10 })], KEY))).toBe('halted')
    expect(workflowStatus(settleMembers([m('failed', { key: 'R|1', startedAt: 10 }), m('running', { key: 'R|2', startedAt: 20 })], KEY))).toBe('halted')
    expect(workflowStatus(settleMembers([m('failed', { key: 'R|1', startedAt: 10 }), m('running', { startedAt: 20 })], KEY))).toBe('halted')
    expect(workflowStatus(settleMembers([m('failed', { startedAt: 10 }), m('running', { startedAt: 20 })], KEY))).toBe('halted')
    // The same step number in another run is another attempt key.
    expect(workflowStatus(settleMembers([m('failed', { key: 'R|1', startedAt: 10 }), m('running', { key: 'S|1', startedAt: 20 })], KEY))).toBe('halted')
  })

  test('[C1a] only failed or killed members are ever left out: running, waiting, completed and pending are kept', () => {
    const all = [m('running', { key: 'R|1', startedAt: 1 }), m('waiting', { key: 'R|1', startedAt: 2 }), m('completed', { key: 'R|1', startedAt: 3 }), m('pending', { key: 'R|1', startedAt: 4 })]
    expect(settleMembers(all, KEY).map(a => a.status)).toEqual(['running', 'waiting', 'completed', 'pending'])
  })

  test('[C1a] two failures of one step, then a retry: both are left out', () => {
    const kept = settleMembers([m('failed', { key: 'R|1', startedAt: 1 }), m('killed', { key: 'R|1', startedAt: 2 }), m('running', { key: 'R|1', startedAt: 3 })], KEY)
    expect(kept.map(a => a.status)).toEqual(['running'])
  })
})

describe('[C1] settleMembers: a done stage settles its step', () => {
  test('[C1] a pending placeholder whose step is done counts as completed; one whose step is not done stays pending', () => {
    const all = [m('pending', { key: 'R|1', done: true }), m('pending', { key: 'R|2', done: false })]
    const kept = settleMembers(all, KEY, (a: any) => a.done === true)
    expect(kept.map(a => a.status)).toEqual(['completed', 'pending'])
    expect(workflowStatus([kept[0]!])).toBe('completed')
    // The old reading: a pending member wins over everything that ended.
    expect(workflowStatus([m('pending'), m('completed')])).toBe('pending')
    expect(workflowStatus([kept[0]!, m('completed')])).toBe('completed')
  })

  test('[C1] an OPEN record (no hand-back) whose step is done counts as completed; not done, it stays OPEN', () => {
    const kept = settleMembers([m(OPEN, { key: 'R|1', done: true }), m(OPEN, { key: 'R|2', done: false })], KEY, (a: any) => a.done === true)
    expect(kept.map(a => a.status)).toEqual(['completed', OPEN])
  })

  test('[C1] a running, failed (no retry) or waiting member is NOT settled by a done stage (only pending and OPEN are)', () => {
    const kept = settleMembers([m('running', { key: 'R|1', done: true }), m('failed', { key: 'R|2', done: true }), m('waiting', { key: 'R|3', done: true })], KEY, (a: any) => a.done === true)
    expect(kept.map(a => a.status)).toEqual(['running', 'failed', 'waiting'])
  })

  test('without an isDone predicate nothing is settled, and the input is not changed', () => {
    const all = [m('pending', { key: 'R|1' })]
    expect(settleMembers(all, KEY).map(a => a.status)).toEqual(['pending'])
    settleMembers(all, KEY, () => true)
    expect(all[0]!.status).toBe('pending')
  })
})

describe('[C1] stageStatuses and stageDone', () => {
  const RUN = [
    '---', 'run: R', 'status: active', '---', '', '# Run: R', '', '## Stages',
    '| Step | Stage | Agent | Status | Record |',
    '|---|---|---|---|---|',
    '| 43 | feature | orchestrator | in-progress | x |',
    '| 43.2 | change | agent-manager | Done (passed) | x |',
    '| 43.6 | bold | agent-manager | **Done** | x |',
    '| 43.7 | underscored | agent-manager | __done__ | x |',
    '| 43.3 | tests | sqa-engineer | blocked | x |',
    '| 43.4.1 | review | code-reviewer | pending | x |',
    '| not a code | skipped | x | done | x |',
    '| 43.2 | change again | agent-manager | failed | x |',
  ].join('\n')

  test('[C1] the Stages table is read by step code, lower-cased, markdown stripped; a repeated code keeps its first row; a row with no step code is skipped', () => {
    const got = stageStatuses(RUN)
    expect(got).toEqual({ '43': 'in-progress', '43.2': 'done (passed)', '43.3': 'blocked', '43.4.1': 'pending', '43.6': 'done', '43.7': 'done' })
    // A bold cell is read as its word (markers are stripped at both ends, so **Done** and __done__ give done).
    expect(stageDone('43.6', got)).toBe(true)
  })

  test('[C1] null, a text with no table, and a table that is not a Stages table give {}', () => {
    expect(stageStatuses(null)).toEqual({})
    expect(stageStatuses('# nothing here\n')).toEqual({})
    expect(stageStatuses('# Other\n| A | B |\n|---|---|\n| 1 | done |\n')).toEqual({})
  })

  test('[C1] a table with a Stage column but no heading is a Stages table; the Status column is found by its header', () => {
    expect(stageStatuses('| Agent | Stage | Status | Step |\n|---|---|---|---|\n| a | s | done | 7 |\n')).toEqual({ '7': 'done' })
  })

  test('[C1] stageDone: the row of the code, or of a parent step code, starting with `done`', () => {
    const st = stageStatuses(RUN)
    expect(stageDone('43.2', st)).toBe(true)
    expect(stageDone('43.2.1', st)).toBe(true)
    expect(stageDone('43.2.1.3', st)).toBe(true)
  })

  test('[C1] boundary: in-progress, blocked, pending and failed rows are not done; a sibling row does not count; the parent row 43 (in-progress) does not make 43.3 done', () => {
    const st = stageStatuses(RUN)
    expect(stageDone('43', st)).toBe(false)
    expect(stageDone('43.3', st)).toBe(false)
    expect(stageDone('43.4.1', st)).toBe(false)
    expect(stageDone('43.5', st)).toBe(false)
    expect(stageDone('44', st)).toBe(false)
    // "done" must start the cell: "undone" and "not done" are not done.
    expect(stageDone('1', { '1': 'not done' })).toBe(false)
    expect(stageDone('1', { '1': 'undone' })).toBe(false)
    expect(stageDone('1', { '1': 'done' })).toBe(true)
  })

  test('[C1] a done parent row settles every step under it (row 43 done covers 43.*)', () => {
    expect(stageDone('43.9.9', { '43': 'done' })).toBe(true)
    expect(stageDone('430', { '43': 'done' })).toBe(false)
  })

  test('[C1] stageDone with no stages or an empty code is false', () => {
    expect(stageDone('1', undefined)).toBe(false)
    expect(stageDone('', { '': 'done' })).toBe(false)
    expect(stageDone('1', {})).toBe(false)
  })
})

describe('[C1a] attemptKey: the run and the step of the record a brief names', () => {
  test('[C1a] the key is <run folder name>|<step code>, from the handoff path or from the prompt', () => {
    const p = 'docs/handoffs/FEAT-1/43.2-orchestrator-to-agent-manager.handoff.md'
    // The run id is the folder name as `runIdOf` gives it (lower-cased).
    expect(attemptKey({ handoff: p, prompt: '' })).toBe('feat-1|43.2')
    expect(attemptKey({ handoff: null, prompt: `Your handoff record is ${p} (root x).\nDo it.` })).toBe('feat-1|43.2')
  })

  test('[C1a] two attempts at one step share a key; another step or another run does not', () => {
    const k = (run: string, code: string) => attemptKey({ handoff: `docs/handoffs/${run}/${code}-orchestrator-to-agent-manager.handoff.md`, prompt: '' })
    expect(k('R', '1')).toBe(k('R', '1'))
    expect(k('R', '1')).not.toBe(k('R', '2'))
    expect(k('R', '1')).not.toBe(k('S', '1'))
  })

  test('[C1a] a brief that names no record has no key', () => {
    expect(attemptKey({ handoff: null, prompt: 'just do it' })).toBe(null)
    expect(attemptKey({ handoff: null, prompt: '' })).toBe(null)
  })
})

describe('[C1b] runStateSig: a run folder\'s current run state as a change signature', () => {
  const f = (name: string, size = 1, mtimeMs = 1, kind = 'file') => ({ name, kind, size, mtimeMs })

  test('[C1b] the highest run.v<..>.md decides, with its size and time', () => {
    expect(runStateSig([f('run.v1.md', 10, 100), f('run.v2.md', 20, 200), f('run.v1.1.md', 30, 300), f('7-a-to-b.handoff.md')])).toBe('run.v2.md:20:200')
  })

  test('[C1b] a new highest version, a rewritten size, or a rewritten time each change the signature; the same entries do not', () => {
    const a = [f('run.v1.md', 10, 100)]
    const same = runStateSig(a)
    expect(runStateSig([f('run.v1.md', 10, 100)])).toBe(same)
    expect(runStateSig([f('run.v1.md', 11, 100)])).not.toBe(same)
    expect(runStateSig([f('run.v1.md', 10, 101)])).not.toBe(same)
    expect(runStateSig([f('run.v1.md', 10, 100), f('run.v2.md', 1, 1)])).not.toBe(same)
  })

  test('[C1b] a change to a record that is not the run state does not change the signature', () => {
    const base = [f('run.v1.md', 10, 100), f('1-a-to-b.handoff.md', 5, 5)]
    expect(runStateSig([f('run.v1.md', 10, 100), f('1-a-to-b.handoff.md', 99, 999)])).toBe(runStateSig(base))
  })

  test('[C1b] a run from before versions (run.md) is the run state when no versioned file exists; a versioned file wins over run.md', () => {
    expect(runStateSig([f('run.md', 3, 4)])).toBe('run.md:3:4')
    expect(runStateSig([f('run.md', 3, 4), f('run.v1.md', 5, 6)])).toBe('run.v1.md:5:6')
  })

  test('[C1b] a folder with neither gives \'\'; a sub-folder named like a run state is not read', () => {
    expect(runStateSig([])).toBe('')
    expect(runStateSig([f('1-a-to-b.handoff.md')])).toBe('')
    expect(runStateSig([f('run.v1.md', 1, 1, 'dir')])).toBe('')
  })
})

// ---------------------------------------------------------------- the engine: a small fake file system

type Fs = {
  files: Record<string, string>
  /** The modification time every listing gives a file; bumped by `put`. */
  stamp: Record<string, number>
  /** `fs.list` calls per folder. */
  lists: Record<string, number>
  /** The status `agent.list` gives each agent id. */
  listed: Record<string, string>
  /** Step 44.3.l2.2: true makes `agent.list` throw (a flag of its own, so no agent id or status is a magic value). */
  listThrows: boolean
  put:(path: string, text: string) => void
}

const RUN_DIR = 'docs/handoffs/X'
const stages = (rows: string[]) => `| Step | Stage | Agent | Status |\n|---|---|---|---|\n${rows.join('\n')}\n`
const runState = (status: string, rows: string[] = ['| 1 | change it | agent-manager | in-progress |', '| 2 | review it | code-reviewer | pending |']) =>
  `---\nrun: X\nstatus: ${status}\n---\n\n# Run: X: the thing\n\n## Stages\n${stages(rows)}`
const brief = (code: string, run = 'X') => `Your handoff record is docs/handoffs/${run}/${code}-orchestrator-to-agent-manager.handoff.md (root x).\nDo it.`

const pane = () => ({ plugin: PLUGIN, component: 'Pane', requestId: CHART_PANE, surface: 'vscode', props: { title: CHART_PANE, isFocused: false, bodyColumns: 120, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} } }) as any
const band = (surface = 'vscode') => ({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 40, bodyColumns: 120, scroll: { offset: 0, bodyRows: 40 }, view: {} } }) as any

const later = (fn: () => void, ms: number) => (globalThis as any).setTimeout(fn, ms)
async function until(ok: () => boolean | Promise<boolean>, ms = 5000): Promise<boolean> {
  const end = Date.now() + ms
  for (;;) {
    if (await ok()) return true
    if (Date.now() >= end) return false
    await new Promise<void>(r => later(r, 1))
  }
}
let lastMs = 0
async function nextMs() {
  while (Date.now() <= lastMs) await new Promise<void>(r => later(r, 1))
  lastMs = Date.now()
}

/** Every `clock.every` dispatch, held open until `tick()` lets its period end (the poll runs once per tick). */
const heldClock = () => {
  const periods: { ms: number; end: () => void }[] = []
  const clockEvery = (e: { ms: number }) => new Promise(r => periods.push({ ms: e.ms, end: () => r({ value: undefined }) }))
  const tick = async () => {
    const open = periods.splice(0)
    for (const p of open) p.end()
    await until(() => periods.length >= new Set(open.map(p => p.ms)).size)
    for (let i = 0; i < 20; i++) await new Promise<void>(r => later(r, 0))
  }
  return { clockEvery, tick }
}

// The surfaces the session answers (`session.surfaces`); a terminal unless a test sets it after `boot`.
let surfaces: string[] = ['terminal']

/** The fake file system of the session `boot` started last (step 44.3.l2.1: `fail` tells its agent list the agent failed). */
let current: Fs | undefined

async function boot($: any, on: any, initial: Record<string, string>, clockEvery?: (e: { ms: number }) => unknown): Promise<Fs> {
  surfaces = ['terminal']
  const files: Record<string, string> = { ...initial }
  const stamp: Record<string, number> = {}
  const lists: Record<string, number> = {}
  const listed: Record<string, string> = {}
  let clockT = 1
  const fs: Fs = {
    files,
    stamp,
    lists,
    listed,
    listThrows: false,
    put:(path, text) => {
      files[path] = text
      stamp[path] = ++clockT
    },
  }
  const norm = (p: unknown) => String(p).replace(/\\/g, '/').replace(/\/$/, '')
  const fileOf = (path: string) => Object.keys(files).find(k => path === k || path.endsWith('/' + k))
  on('ui.render', ($s: any, e: any) => {
    const { Text } = $s.ui.resolve(e)
    return <Text>NATIVE ROW</Text>
  })
  on('clock.every', (_: unknown, e: any) => (clockEvery !== undefined ? clockEvery(e) : { value: undefined }))
  // Step 44 (R44.4): the band hook draws only where every surface draws a band (bandEverywhere), so these sessions are on a terminal
  on('session.surfaces', () => ({ value: surfaces }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('session.end', (_: unknown, e: any) => ({ sessionId: e.sessionId }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 10 }, rateLimits: [] } }))
  on('settings.read', () => ({ value: { agent: 'ai-dlc:orchestrator' } }))
  on('fs.exists', () => ({ value: false }))
  on('fs.stat', (_: unknown, e: any) => {
    throw new Error(`ENOENT ${norm(e.path ?? e)}`)
  })
  on('fs.read', (_: unknown, e: any) => {
    const hit = fileOf(norm(e.path ?? e))
    if (hit === undefined) throw new Error(`ENOENT ${norm(e.path ?? e)}`)
    return { value: files[hit] }
  })
  on('fs.write', (_: unknown, e: any) => ({ value: undefined }))
  on('fs.list', (_: unknown, e: any) => {
    const dir = norm(e?.path ?? e)
    const folders = new Set<string>()
    for (const k of Object.keys(files)) for (let i = k.lastIndexOf('/'); i > 0; i = k.lastIndexOf('/', i - 1)) folders.add(k.slice(0, i))
    const hit = [...folders].filter(d => dir === d || dir.endsWith('/' + d)).sort((a, b) => b.length - a.length)[0]
    if (hit === undefined) throw new Error(`ENOENT ${dir}`)
    lists[hit] = (lists[hit] ?? 0) + 1
    const out: any[] = []
    const subs = new Set<string>()
    for (const k of Object.keys(files)) {
      if (!k.startsWith(hit + '/')) continue
      const rest = k.slice(hit.length + 1)
      if (rest.includes('/')) subs.add(rest.slice(0, rest.indexOf('/')))
      else out.push({ name: rest, kind: 'file', size: files[k]!.length, mtimeMs: stamp[k] ?? 1 })
    }
    for (const s of subs) out.push({ name: s, kind: 'dir', mtimeMs: 1 })
    return { value: out }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('agent.list', () => {
    // Step 44.3.l2.1: a test makes the engine's list throw by setting `fs.listThrows` (step 44.3.l2.2: a flag, not a magic id).
    if (fs.listThrows) throw new Error('agent.list failed')
    return { value: Object.entries(listed).map(([id, status]) => ({ id, description: id, type: 'ai-dlc:agent-manager', status })) }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.view', () => ({ value: undefined }))
  on('agent.spawn', (_: unknown, e: any) => ({ model: 'claude-sonnet-5-5', agentId: 'a' + (/^toolu_(\d+)$/.exec(String(e.tool_use_id))?.[1] ?? '1') }))
  on('turn.start', (_: unknown, e: any) => ({ turnId: e.turnId }))
  on('turn.step', async function* (_: unknown, e: any) {
    yield { kind: 'stop', stopReason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: e.agentId === undefined ? 'claude-opus-5-5' : 'claude-sonnet-5-5' } }
    return { turnId: 'm', index: 0, answer: 'ok', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  on('tool.call', () => ({ result: {} }))
  on('turn.complete', (_: unknown, e: any) => ({ text: e.answer }))
  on('classic.SubagentStop', () => ({}))
  on('classic.Stop', () => ({}))
  current = fs
  await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
  await $.turn.start({ text: 'do the thing', turnId: 'm0' })
  for await (const _ of $.turn.step({ turnId: 'm', index: 0, model: 'claude-opus-5-5', messageCount: 1 })) {
    // drain the main step
  }
  return fs
}

/** The orchestrator's Agent call `toolu_<n>` with the brief of step `code`; `spawn` false leaves it a `call:` placeholder. */
async function call($: any, n: number, code: string, spawn = true) {
  await nextMs()
  const prompt = brief(code)
  await $.tool.call({ tool: 'Agent', subagent_type: 'ai-dlc:agent-manager', description: `d${n}`, prompt, tool_use_id: `toolu_${n}` })
  if (spawn) await $.agent.spawn({ tool_use_id: `toolu_${n}`, prompt, description: `d${n}`, subagentType: 'ai-dlc:agent-manager', provider: { plugin: 'ai-dlc', tier: 'user' }, parentModel: 'claude-opus-5-5', background: true, fork: false })
}
/** Step 44.3.l2.1: a subagent's error turn end halts it only when the engine's list says it ended too, so the list says `failed` first. */
const fail = ($: any, id: string) => {
  current!.listed[id] = 'failed'
  return failTurn($, id)
}
const failTurn = ($: any, id: string) => $.turn.complete({ reason: 'error', answer: '', durationMs: 1, isAborted: false, turnId: 't', agentId: id, usage: null })
const finish = ($: any, id: string) =>
  $.turn.complete({ reason: 'answer', answer: 'done', durationMs: 1, isAborted: false, turnId: 't', agentId: id, usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'claude-sonnet-5-5' } })

/** The status dots the workflow pane draws (`status: <label>`), the first being the workflow's. */
const dots = async (ui: any): Promise<string[]> =>
  ((await ui.findAll({ type: 'Svg' })) as any[]).map((x: any) => String(x?.props?.alt ?? x?.alt ?? '')).filter(a => a.startsWith('status: '))
/** The workflow's status as the pane draws it now, after at most a few seconds for a redraw. */
const paneStatus = async ($: any, want?: string): Promise<string> => {
  const ui = await $.ui.mount(pane())
  let got = (await dots(ui))[0] ?? ''
  if (want !== undefined) {
    await until(async () => {
      got = (await dots(ui))[0] ?? ''
      return got === `status: ${want}`
    })
  }
  await ui.unmount()
  return got
}
const bandStatus = async ($: any): Promise<string> => {
  const ui = await $.ui.mount(band())
  const got = (await dots(ui))[0] ?? ''
  await ui.unmount()
  return got
}

/** The C1a session tests boot a whole engine and take 1 to 4 s idle: the default timeout is too close under load. */
const HEAVY = { timeoutMs: 20000 }

// ---------------------------------------------------------------- sessions

describe('[C1a] a failed step that starts again: the latest attempt decides, the workflow is not halted', () => {
  test('[C1a] a1 fails (halted), a2 starts the same step (in progress, not halted), a2 finishes (waiting: the run is active); pane and band agree', HEAVY, async ($, on) => {
    await boot($, on, { [`${RUN_DIR}/run.md`]: runState('active') })
    await call($, 1, '1')
    expect(await paneStatus($)).toBe('status: in progress')
    await fail($, 'a1')
    // No retry yet: failed with no later attempt still halts (boundary).
    expect(await paneStatus($, 'halted')).toBe('status: halted')
    expect(await bandStatus($)).toBe('status: halted')
    await call($, 2, '1')
    expect(await paneStatus($, 'in progress')).toBe('status: in progress')
    expect(await bandStatus($)).toBe('status: in progress')
    await finish($, 'a2')
    // Step 44 (R44.5): every agent ended, but the run is `active`, so it waits for its next stage: waiting, never completed
    expect(await paneStatus($, 'waiting')).toBe('status: waiting')
    expect(await bandStatus($)).toBe('status: waiting')
  })

  test('[C1a] a retry of ANOTHER step does not clear the failure: still halted', HEAVY, async ($, on) => {
    await boot($, on, { [`${RUN_DIR}/run.md`]: runState('active') })
    await call($, 1, '1')
    await fail($, 'a1')
    await call($, 2, '2')
    expect(await paneStatus($, 'halted')).toBe('status: halted')
    expect(await bandStatus($)).toBe('status: halted')
  })

  test('[C1a] a failure AFTER a completed attempt of the same step halts', HEAVY, async ($, on) => {
    await boot($, on, { [`${RUN_DIR}/run.md`]: runState('active') })
    await call($, 1, '1')
    await finish($, 'a1')
    await call($, 2, '1')
    await fail($, 'a2')
    expect(await paneStatus($, 'halted')).toBe('status: halted')
  })

  test('[C1a] a killed agent (the agent list says so) that started again: the retry decides', HEAVY, async ($, on) => {
    const h = heldClock()
    const fs = await boot($, on, { [`${RUN_DIR}/run.md`]: runState('active') }, h.clockEvery)
    await call($, 1, '1')
    fs.listed['a1'] = 'killed'
    await h.tick()
    expect(await paneStatus($, 'halted')).toBe('status: halted')
    await call($, 2, '1')
    expect(await paneStatus($, 'in progress')).toBe('status: in progress')
  })
})

describe('[C1] a done run state or stage reads completed; blocked still halts', () => {
  test('[C1] a pending placeholder (the Agent call not started) whose Stages row is done: settled, not pending (the run is active, so it waits)', async ($, on) => {
    await boot($, on, { [`${RUN_DIR}/run.md`]: runState('active', ['| 1 | change it | agent-manager | done (passed) |', '| 2 | review it | code-reviewer | pending |']) })
    await call($, 1, '1', false)
    expect(await paneStatus($, 'waiting')).toBe('status: waiting')
    expect(await bandStatus($)).toBe('status: waiting')
  })

  test('[C1] boundary: the same placeholder whose Stages row is in-progress stays pending', async ($, on) => {
    await boot($, on, { [`${RUN_DIR}/run.md`]: runState('active') })
    await call($, 1, '1', false)
    expect(await paneStatus($, 'pending')).toBe('status: pending')
    expect(await bandStatus($)).toBe('status: pending')
  })

  test('[C1] a done row of a PARENT step settles the placeholder of a sub-step (row 1 done, brief names 1.2)', async ($, on) => {
    await boot($, on, { [`${RUN_DIR}/run.md`]: runState('active', ['| 1 | change it | agent-manager | done |']) })
    await call($, 1, '1.2', false)
    expect(await paneStatus($, 'waiting')).toBe('status: waiting') // settled (not pending); the run is active (R44.5)
  })

  test('[C1] the run status `done` makes the workflow completed although its agent was never told it ended', async ($, on) => {
    const fs = await boot($, on, { [`${RUN_DIR}/run.md`]: runState('done', ['| 1 | change it | agent-manager | done |']) })
    fs.listed['a1'] = 'running'
    await call($, 1, '1')
    expect(await paneStatus($, 'completed')).toBe('status: completed')
    expect(await bandStatus($)).toBe('status: completed')
  })

  test('[C1] blocked still halts: the run is blocked while its agent completed, and a done row does not undo a blocked run', async ($, on) => {
    await boot($, on, { [`${RUN_DIR}/run.md`]: runState('blocked', ['| 1 | change it | agent-manager | done |']) })
    await call($, 1, '1')
    await finish($, 'a1')
    expect(await paneStatus($, 'halted')).toBe('status: halted')
    expect(await bandStatus($)).toBe('status: halted')
  })

  test('[C1] a listed `completed` applies to an agent whose turn.complete this session never saw', async ($, on) => {
    const h = heldClock()
    const fs = await boot($, on, { [`${RUN_DIR}/run.md`]: runState('active') }, h.clockEvery)
    await call($, 1, '1')
    fs.listed['a1'] = 'running'
    await h.tick()
    expect(await paneStatus($, 'in progress')).toBe('status: in progress')
    fs.listed['a1'] = 'completed'
    await h.tick()
    expect(await paneStatus($, 'waiting')).toBe('status: waiting') // ended (not in progress); the run is active (R44.5)
  })

  test('[C1] boundary: a status that already ended is never changed by the list (failed stays failed though the list says completed)', async ($, on) => {
    const h = heldClock()
    const fs = await boot($, on, { [`${RUN_DIR}/run.md`]: runState('active') }, h.clockEvery)
    await call($, 1, '1')
    await fail($, 'a1')
    fs.listed['a1'] = 'completed'
    await h.tick()
    expect(await paneStatus($, 'halted')).toBe('status: halted')
  })
})

/** Step 44.3.l2.1: a subagent's turn end with `reason`, as the engine sends it. */
const endTurn = ($: any, id: string, reason: 'error' | 'aborted' | 'refusal') =>
  $.turn.complete({ reason, answer: '', durationMs: 1, isAborted: reason === 'aborted', turnId: 't', agentId: id, usage: null })
const readCall = ($: any, id: string, n: number) => $.tool.call({ tool: 'Read', file_path: 'x.md', tool_use_id: `toolu_r${n}`, agentId: id })

describe('[44.3.l2.1] a background subagent whose turn ends badly while the engine still lists it live keeps running', () => {
  for (const reason of ['error', 'aborted', 'refusal'] as const) {
    test(`[a, b] turn.complete ${reason} while the list says running: never halted through later events; a later turn.start: running`, HEAVY, async ($, on) => {
      const fs = await boot($, on, { [`${RUN_DIR}/run.md`]: runState('active') })
      await call($, 1, '1') // spawned with background: true, as in the real case
      fs.listed['a1'] = 'running'
      await endTurn($, 'a1', reason)
      expect(await paneStatus($)).toBe('status: in progress')
      expect(await bandStatus($)).toBe('status: in progress')
      await readCall($, 'a1', 1)
      await readCall($, 'a1', 2)
      expect(await paneStatus($)).toBe('status: in progress')
      expect(await bandStatus($)).toBe('status: in progress')
      await $.turn.start({ text: 'p', turnId: 't2', agentId: 'a1' })
      expect(await paneStatus($)).toBe('status: in progress')
    })
  }

  test('[b] a listed `failed` that comes later still halts it (the list decides)', HEAVY, async ($, on) => {
    const h = heldClock()
    const fs = await boot($, on, { [`${RUN_DIR}/run.md`]: runState('active') }, h.clockEvery)
    await call($, 1, '1')
    fs.listed['a1'] = 'running'
    await endTurn($, 'a1', 'error')
    await h.tick()
    expect(await paneStatus($)).toBe('status: in progress')
    fs.listed['a1'] = 'failed'
    await h.tick()
    expect(await paneStatus($, 'halted')).toBe('status: halted')
  })

  for (const [reason, listedStatus] of [['error', 'failed'], ['refusal', 'failed'], ['aborted', 'killed']] as const) {
    test(`[c] turn.complete ${reason} while the list says ${listedStatus}: halted (the ended path)`, HEAVY, async ($, on) => {
      // Step 44.3.l2.2 (standards W2): a held clock that is never ticked, so the 2 s poll never reads the list and applies its `failed` / `killed`:
      // the halt below can only come from the turn.complete branch.
      const h = heldClock()
      const fs = await boot($, on, { [`${RUN_DIR}/run.md`]: runState('active') }, h.clockEvery)
      await call($, 1, '1')
      fs.listed['a1'] = listedStatus
      await endTurn($, 'a1', reason)
      // Step 44.3.l2.2 (standards W2): read at once, no wait, so a later refresh cannot satisfy it: only the turn.complete branch halts it.
      expect(await paneStatus($)).toBe('status: halted')
      expect(await bandStatus($)).toBe('status: halted')
    })
  }

  test('[d] a halt that came from turn.complete is cleared by a later listed `running`', HEAVY, async ($, on) => {
    const h = heldClock()
    const fs = await boot($, on, { [`${RUN_DIR}/run.md`]: runState('active') }, h.clockEvery)
    await call($, 1, '1')
    fs.listed['a1'] = 'failed'
    await endTurn($, 'a1', 'error')
    expect(await paneStatus($, 'halted')).toBe('status: halted')
    // The 2 s poll reads the list only while an agent is at work: a2 is (the halted a1 alone would not be polled).
    await call($, 2, '2')
    expect(await paneStatus($, 'halted')).toBe('status: halted')
    fs.listed['a1'] = 'running'
    await h.tick()
    expect(await paneStatus($, 'in progress')).toBe('status: in progress')
    expect(await bandStatus($)).toBe('status: in progress')
  })

  test('[d] a `failed` the list itself set is not cleared by a later listed `running`', HEAVY, async ($, on) => {
    const h = heldClock()
    const fs = await boot($, on, { [`${RUN_DIR}/run.md`]: runState('active') }, h.clockEvery)
    await call($, 1, '1')
    await call($, 2, '2') // at work throughout, so every tick reads the list
    fs.listed['a1'] = 'running'
    await h.tick()
    fs.listed['a1'] = 'failed'
    await h.tick()
    expect(await paneStatus($, 'halted')).toBe('status: halted')
    fs.listed['a1'] = 'running'
    await h.tick()
    expect(await paneStatus($)).toBe('status: halted')
  })

  test('[d] boundary: a halt from turn.complete is cleared once, then the listed `running` is the old rule again (a later listed `failed` halts, `running` does not undo it)', HEAVY, async ($, on) => {
    const h = heldClock()
    const fs = await boot($, on, { [`${RUN_DIR}/run.md`]: runState('active') }, h.clockEvery)
    await call($, 1, '1')
    await call($, 2, '2') // at work throughout, so every tick reads the list
    fs.listed['a1'] = 'failed'
    await endTurn($, 'a1', 'error')
    fs.listed['a1'] = 'running'
    await h.tick()
    expect(await paneStatus($, 'in progress')).toBe('status: in progress')
    fs.listed['a1'] = 'failed'
    await h.tick()
    expect(await paneStatus($, 'halted')).toBe('status: halted')
    fs.listed['a1'] = 'running'
    await h.tick()
    expect(await paneStatus($)).toBe('status: halted')
  })

  test('[e] agent.list throwing during turn.complete: the agent stays running', HEAVY, async ($, on) => {
    const fs = await boot($, on, { [`${RUN_DIR}/run.md`]: runState('active') })
    await call($, 1, '1')
    fs.listThrows = true
    await endTurn($, 'a1', 'error')
    fs.listThrows = false
    fs.listed['a1'] = 'running'
    expect(await paneStatus($)).toBe('status: in progress')
    expect(await bandStatus($)).toBe('status: in progress')
  })
})

describe('[C1b] another session moved the run: the 2 s poll shows it, an unchanged run state costs no refresh', () => {
  const BLOCKED = runState('blocked', ['| 1 | change it | agent-manager | blocked |'])
  const DONE = runState('done', ['| 1 | change it | agent-manager | done |'])

  test('[C1b] a halted run continued in another session (run.md rewritten): the next poll shows completed in the pane and the band', async ($, on) => {
    const h = heldClock()
    const fs = await boot($, on, { [`${RUN_DIR}/run.md`]: BLOCKED }, h.clockEvery)
    await call($, 1, '1')
    await finish($, 'a1')
    expect(await paneStatus($, 'halted')).toBe('status: halted')
    await h.tick()
    expect(await paneStatus($)).toBe('status: halted')
    // The other session writes the run state again (same file, new size and time).
    fs.put(`${RUN_DIR}/run.md`, DONE)
    // Not yet polled: this session still shows what it knew.
    expect(await bandStatus($)).toBe('status: halted')
    await h.tick()
    expect(await paneStatus($, 'completed')).toBe('status: completed')
    expect(await until(async () => (await bandStatus($)) === 'status: completed')).toBe(true)
    expect(await bandStatus($)).toBe('status: completed')
  })

  test('[C1b] the other session writes a new version (run.v2.md beside run.v1.md): the poll reads the highest', async ($, on) => {
    const h = heldClock()
    const fs = await boot($, on, { [`${RUN_DIR}/run.v1.md`]: BLOCKED }, h.clockEvery)
    await call($, 1, '1')
    await finish($, 'a1')
    await h.tick()
    expect(await paneStatus($, 'halted')).toBe('status: halted')
    fs.put(`${RUN_DIR}/run.v2.md`, DONE)
    await h.tick()
    expect(await paneStatus($, 'completed')).toBe('status: completed')
  })

  test('[C1b] the other session blocks a run this one saw active: the poll shows halted', async ($, on) => {
    const h = heldClock()
    const fs = await boot($, on, { [`${RUN_DIR}/run.md`]: runState('active') }, h.clockEvery)
    await call($, 1, '1')
    await finish($, 'a1')
    await h.tick()
    expect(await paneStatus($, 'waiting')).toBe('status: waiting')
    fs.put(`${RUN_DIR}/run.md`, BLOCKED)
    await h.tick()
    expect(await paneStatus($, 'halted')).toBe('status: halted')
  })

  /** The listings of the run folder one poll costs (the poll's own signature listing, plus a refresh's when it runs). */
  const polled = async (h: { tick: () => Promise<void> }, fs: Fs): Promise<number> => {
    const before = fs.lists[RUN_DIR] ?? 0
    await h.tick()
    return (fs.lists[RUN_DIR] ?? 0) - before
  }

  // A run with nothing wrong in it (no anomaly for the detector to keep scanning), so the cost of a poll is the poll's own.
  const QUIET = runState('active', ['| 1 | change it | agent-manager | done |'])

  test('[C1b] negative: with the run state unchanged a poll does not refresh the runs (a steady, smaller cost per poll); a change costs the refresh on top', async ($, on) => {
    const h = heldClock()
    const fs = await boot($, on, { [`${RUN_DIR}/run.md`]: QUIET }, h.clockEvery)
    await call($, 1, '1')
    await finish($, 'a1')
    // The first poll sees the folder for the first time (it refreshes); after it the polls have nothing to see.
    for (let i = 0; i < 4; i++) await h.tick()
    const idle1 = await polled(h, fs)
    const idle2 = await polled(h, fs)
    expect(idle1).toBeGreaterThan(0)
    expect(idle2).toBe(idle1)
    fs.put(`${RUN_DIR}/run.md`, QUIET.replace('status: active', 'status: done'))
    const changed = await polled(h, fs)
    expect(changed).toBeGreaterThan(idle1)
    // And it is steady again once the change was taken.
    expect(await polled(h, fs)).toBe(idle1)
  })

  test('[C1b] negative: a change to a record that is not the run state (a hand-back written) does not move the signature: no refresh', async ($, on) => {
    const h = heldClock()
    const fs = await boot($, on, { [`${RUN_DIR}/run.md`]: QUIET }, h.clockEvery)
    await call($, 1, '1')
    await finish($, 'a1')
    for (let i = 0; i < 4; i++) await h.tick()
    const idle = await polled(h, fs)
    fs.put(`${RUN_DIR}/1-agent-manager-to-orchestrator.handback.md`, 'hand-back text')
    expect(await polled(h, fs)).toBe(idle)
  })
})

// ---------------------------------------------------------------- step 44

describe('[R44.5] runListStatus: an active run is never completed', () => {
  const a = (status: string) => ({ status, type: 'x' }) as unknown as StatusMember
  const ended = [a('completed')]
  test('every agent ended and a run is active: waiting, where workflowStatus says completed', () => {
    expect(workflowStatus(ended, ['active'])).toBe('completed')
    expect(runListStatus(ended, ['active'])).toBe('waiting')
  })
  test('every run done (or no run named): completed; the other statuses are workflowStatus\'s', () => {
    expect(runListStatus(ended, ['done'])).toBe('completed')
    expect(runListStatus(ended, [])).toBe('completed')
    expect(runListStatus(ended, ['blocked'])).toBe('halted')
    expect(runListStatus([a('running')], ['active'])).toBe('in-progress')
    expect(runListStatus([a('failed')], ['active'])).toBe('halted')
    expect(runListStatus([a('pending')], ['active'])).toBe('pending')
  })
  test('one active run among done ones is enough; the status is read case-insensitively and trimmed', () => {
    expect(runListStatus(ended, ['done', 'active'])).toBe('waiting')
    expect(runListStatus(ended, ['done', ' Active '])).toBe('waiting')
    expect(runListStatus(ended, ['done', 'DONE'])).toBe('completed')
  })
  test('[R44.22] a run that is not done (empty, unknown, paused) keeps the workflow from completed; only done runs, or none named, complete it', () => {
    expect(runListStatus(ended, [''])).toBe('waiting')
    expect(runListStatus(ended, ['paused'])).toBe('waiting')
    expect(runListStatus(ended, ['done', ''])).toBe('waiting')
    expect(runListStatus(ended, [])).toBe('completed')
    expect(runListStatus(ended, ['done'])).toBe('completed')
  })
  test('the spawner is left out as in workflowStatus', () => {
    const members = [{ status: 'running', type: 'x', id: 'main' }, { status: 'completed', type: 'x', id: 'a1' }] as unknown as StatusMember[]
    expect(runListStatus(members, ['active'], 'main')).toBe('waiting')
  })
})

describe('[R44.5] the list and the band: an active run is never completed, the newest run-state version wins', () => {
  test('[R44.5] every agent ended, the run is active: waiting in the pane and the band, never completed', async ($, on) => {
    await boot($, on, { [`${RUN_DIR}/run.md`]: runState('active', ['| 1 | change it | agent-manager | done |']) })
    await call($, 1, '1')
    await finish($, 'a1')
    expect(await paneStatus($, 'waiting')).toBe('status: waiting')
    expect(await bandStatus($)).toBe('status: waiting')
  })

  test('[R44.5] the same run once its state says done: completed', async ($, on) => {
    await boot($, on, { [`${RUN_DIR}/run.md`]: runState('done', ['| 1 | change it | agent-manager | done |']) })
    await call($, 1, '1')
    await finish($, 'a1')
    expect(await paneStatus($, 'completed')).toBe('status: completed')
    expect(await bandStatus($)).toBe('status: completed')
  })

  test('[R44.5] the newest version wins: run.v2.md active over an older run.v1.md done reads waiting, and the reverse reads completed', async ($, on) => {
    const done = runState('done', ['| 1 | change it | agent-manager | done |'])
    const active = runState('active', ['| 1 | change it | agent-manager | done |'])
    await boot($, on, { [`${RUN_DIR}/run.v1.md`]: done, [`${RUN_DIR}/run.v2.md`]: active })
    await call($, 1, '1')
    await finish($, 'a1')
    expect(await paneStatus($, 'waiting')).toBe('status: waiting')
    expect(await bandStatus($)).toBe('status: waiting')
  })

  test('[R44.5] an older active version under a newer done one reads completed (a minor version, v4.3 over v4.2)', async ($, on) => {
    const done = runState('done', ['| 1 | change it | agent-manager | done |'])
    const active = runState('active', ['| 1 | change it | agent-manager | done |'])
    await boot($, on, { [`${RUN_DIR}/run.v4.2.md`]: active, [`${RUN_DIR}/run.v4.3.md`]: done, [`${RUN_DIR}/run.v4.md`]: active })
    await call($, 1, '1')
    await finish($, 'a1')
    expect(await paneStatus($, 'completed')).toBe('status: completed')
    expect(await bandStatus($)).toBe('status: completed')
  })

  test('[R44.5] a blocked run reads halted, not completed or waiting', async ($, on) => {
    await boot($, on, { [`${RUN_DIR}/run.md`]: runState('blocked', ['| 1 | change it | agent-manager | done |']) })
    await call($, 1, '1')
    await finish($, 'a1')
    expect(await paneStatus($, 'halted')).toBe('status: halted')
    expect(await bandStatus($)).toBe('status: halted')
  })
})

describe('[R44.4, R44.21] the lens band: a terminal or desktop render always draws it; a VS Code render only where every surface draws a band', () => {
  test('bandEverywhere: terminal and desktop only; vscode, mixed or unknown surfaces draw none', () => {
    expect(bandEverywhere(['terminal'])).toBe(true)
    expect(bandEverywhere(['terminal', 'desktop'])).toBe(true)
    expect(bandEverywhere(['vscode'])).toBe(false)
    expect(bandEverywhere(['terminal', 'vscode'])).toBe(false)
    expect(bandEverywhere([])).toBe(false)
  })

  const drawsBand = async ($: any, surface = 'vscode'): Promise<boolean> => {
    const ui = await $.ui.mount(band(surface))
    // A VS Code band draws Svg dots; a terminal or desktop one is text, so any text beside the row beneath is the band.
    const lines = ((await ui.findAll({ type: 'Text' })) as any[]).map((x: any) => String(x?.props?.text ?? x?.text ?? '')).filter(t => t.trim() !== '' && t !== 'NATIVE ROW')
    const own = ((await ui.findAll({ type: 'Svg' })) as any[]).length > 0 || (surface !== 'vscode' && lines.length > 0)
    const native = (await ui.find({ type: 'Text', text: 'NATIVE ROW' })) !== undefined
    await ui.unmount()
    expect(native).toBe(true) // the hook beneath is always reached
    return own
  }

  // Step 44 (R44.21, AC-12.12): the band is gated on the render's own surface first. A terminal or desktop render draws it
  // whatever else is attached (or unknown); only a VS Code render keeps the roster rule (`bandEverywhere`, or `vscodeBandA`).
  for (const surface of ['terminal', 'desktop']) {
    for (const set of [['terminal'], ['terminal', 'vscode'], []]) {
      test(`[R44.21] a ${surface} render with surfaces ${JSON.stringify(set)}: the lens band is drawn (above the row beneath)`, async ($, on) => {
        await boot($, on, { [`${RUN_DIR}/run.md`]: runState('active') })
        await call($, 1, '1')
        surfaces = set
        expect(await drawsBand($, surface)).toBe(true)
      })
    }
  }

  for (const set of [['vscode'], ['terminal', 'vscode'], []]) {
    test(`[R44.4] a VS Code render with surfaces ${JSON.stringify(set)}: no lens band (the mode button has not chosen pinned), so the pane the command opens is the only lens view`, async ($, on) => {
      await boot($, on, { [`${RUN_DIR}/run.md`]: runState('active') })
      await call($, 1, '1')
      surfaces = set
      expect(await drawsBand($, 'vscode')).toBe(false)
    })
  }
})

// ---------------------------------------------------------------- step 44.3.l2.2

/**
 * Step 44.3.l2.2 (the human's decision 16, ITEM-104 ACs (a)-(d)): a subagent shown running that the engine's list no
 * longer has, and that sent no event, shows halted (failed) after `droppedSubagentMinutes`.
 *
 * The lens reads the time with `Date.now()` inside the engine's own realm, which a test cannot move (the kit's
 * `mock.clock` answers `$.clock` only, and `Date.now` is not writable), and the setting is a whole number of minutes
 * from 1. So the timeline test below runs in real time against a limit of 1 minute (about two minutes), with seven
 * agents, each in a run of its own, so each agent's status is its own workflow's dot; it counts the halted dots.
 */
const stepOf = async ($: any, id: string) => {
  for await (const _ of $.turn.step({ turnId: 'm', index: 0, model: 'claude-sonnet-5-5', messageCount: 1, agentId: id })) {
    // drain
  }
}
const lensJson = (minutes: number) => ({ '.ai-dlc/lens.json': JSON.stringify({ droppedSubagentMinutes: minutes }) })
const runNamed = (n: string) => runState('active').replace('run: X', `run: ${n}`).replace('# Run: X: the thing', `# Run: ${n}: the thing`)
/** The orchestrator's background Agent call `toolu_<n>` for the step 1 of run `run`; its agent id is `a<n>`. */
const callIn = async ($: any, n: number, run: string) => {
  await nextMs()
  const prompt = brief('1', run)
  await $.tool.call({ tool: 'Agent', subagent_type: 'ai-dlc:agent-manager', description: `d${n}`, prompt, tool_use_id: `toolu_${n}` })
  await $.agent.spawn({ tool_use_id: `toolu_${n}`, prompt, description: `d${n}`, subagentType: 'ai-dlc:agent-manager', provider: { plugin: 'ai-dlc', tier: 'user' }, parentModel: 'claude-opus-5-5', background: true, fork: false })
}
/** How many of the workflow pane's status dots read halted. */
const haltedCount = async ($: any): Promise<number> => {
  const ui = await $.ui.mount(pane())
  const n = (await dots(ui)).filter(d => d === 'status: halted').length
  await ui.unmount()
  return n
}
const pause = (ms: number) => new Promise<void>(r => later(r, ms))

describe('[44.3.l2.2] AC (a)-(d): a subagent the list dropped shows halted after droppedSubagentMinutes', () => {
  test(
    '[a, b, c, d] timeline, limit 1 minute: dropped + silent halts at the limit and not before; a listed one never; a new session, a listed row and each event (turn.start, turn.step, tool.call, turn.complete) start the time again; a listed `running` resumes a timed-out agent',
    { timeoutMs: 300000 },
    async ($, on) => {
      const RUNS = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7']
      const h = heldClock()
      const files: Record<string, string> = { ...lensJson(1) }
      for (const r of RUNS) files[`docs/handoffs/${r}/run.md`] = runNamed(r)
      const fs = await boot($, on, files, h.clockEvery)
      // a1 .. a7 = R1 .. R7. a1: dropped, silent, but a new session at 25 s. a2 turn.start, a3 turn.step, a4 tool.call,
      // a5 turn.complete (error), each at 50 s. a6 listed all along. a7 listed again for one poll at 50 s.
      for (let i = 0; i < RUNS.length; i++) await callIn($, i + 1, RUNS[i]!)
      for (let i = 1; i <= 7; i++) fs.listed[`a${i}`] = 'running'
      await h.tick() // all stored running now
      expect(await haltedCount($)).toBe(0)
      for (const id of ['a1', 'a2', 'a3', 'a4', 'a5', 'a7']) delete fs.listed[id]
      const t0 = Date.now()
      // Waits until `s` seconds after t0, polling every 1.5 s: the kit lets go a held clock wait after 10 s of real time (a hook that overran), which would end the poll.
      const at = async (s: number) => {
        for (;;) {
          const left = t0 + s * 1000 - Date.now()
          if (left <= 0) return
          await pause(Math.min(left, 1500))
          await h.tick()
        }
      }
      await h.tick() // t0: a1 .. a5 and a7 are missing from here
      expect(await haltedCount($)).toBe(0)

      await at(25)
      await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true }) // the marks start empty
      await h.tick() // missing from here (~25 s)
      expect(await haltedCount($)).toBe(0)

      await at(50)
      await $.turn.start({ text: 'p', turnId: 't2', agentId: 'a2' })
      await stepOf($, 'a3')
      await readCall($, 'a4', 1)
      await endTurn($, 'a5', 'error') // no row in the list: counts as live, stays running
      fs.listed['a7'] = 'running'
      await h.tick() // a7 listed: its time starts again; a2 .. a5 missing again from here (~50 s)
      delete fs.listed['a7']
      await h.tick() // a7 missing again from here
      expect(await haltedCount($)).toBe(0)

      await at(70) // 45 s after the new session: a1 would be halted if the session had not reset it (70 s after t0)
      await h.tick()
      expect(await haltedCount($)).toBe(0)

      await at(90) // a1: 65 s missing since the new session; the others 40 s since their event or listed row
      await h.tick()
      expect(await haltedCount($)).toBe(1)

      fs.listed['a1'] = 'running' // the list shows the timed-out agent again: it resumes
      await h.tick()
      expect(await haltedCount($)).toBe(0)

      await at(115) // a2 .. a5 and a7: 65 s since their event or listed row; a6 and a1 are listed
      await h.tick()
      expect(await haltedCount($)).toBe(5)
    },
  )

  test('[d] 0 = never: nothing halts however the poll runs (no limit, not a limit of 0 minutes)', HEAVY, async ($, on) => {
    const h = heldClock()
    const files: Record<string, string> = { ...lensJson(0), 'docs/handoffs/R1/run.md': runNamed('R1') }
    const fs = await boot($, on, files, h.clockEvery)
    await callIn($, 1, 'R1')
    fs.listed['a1'] = 'running'
    await h.tick()
    delete fs.listed['a1']
    for (let i = 0; i < 4; i++) {
      await pause(50)
      await h.tick()
    }
    expect(await haltedCount($)).toBe(0)
  })
})

describe('[44.3.l2.2] settings: droppedSubagentMinutes', () => {
  const val = (v: unknown) => resolve([fileLevel('.ai-dlc/lens.json', JSON.stringify({ droppedSubagentMinutes: v })).level])
  test('[d] the default is 15', () => {
    expect(DEFAULTS.droppedSubagentMinutes).toBe(15)
    expect(resolve([]).settings.droppedSubagentMinutes).toBe(15)
  })
  test('[d] 0, 1 and 1440 are valid', () => {
    for (const v of [0, 1, 1440]) {
      const r = val(v)
      expect(r.settings.droppedSubagentMinutes).toBe(v)
      expect(r.ignored).toEqual([])
    }
  })
  test('[d] invalid values (-1, 1441, 1.5, text, a boolean) fall back to 15 with the warning', () => {
    for (const v of [-1, 1441, 1.5, 'ten', true]) {
      const r = val(v)
      expect(r.settings.droppedSubagentMinutes).toBe(15)
      expect(r.ignored.length).toBe(1)
      expect(r.ignored[0]).toContain('droppedSubagentMinutes')
      expect(r.ignored[0]).toContain('is invalid, ignored')
    }
  })
  test('[d] the environment name is AI_DLC_LENS_DROPPED_SUBAGENT_MINUTES; "abc" there falls back with the warning, "0" and "30" are accepted', () => {
    const env = (v: string) => resolve([envLevel('.claude/settings.json', JSON.stringify({ env: { AI_DLC_LENS_DROPPED_SUBAGENT_MINUTES: v } })).level])
    expect(env('abc').settings.droppedSubagentMinutes).toBe(15)
    expect(env('abc').ignored[0]).toContain('AI_DLC_LENS_DROPPED_SUBAGENT_MINUTES')
    expect(env('0').settings.droppedSubagentMinutes).toBe(0)
    expect(env('30').settings.droppedSubagentMinutes).toBe(30)
  })
})

describe('[44.3.l2.2] halted-state marks: session.start reset, an ended agent stays ended', () => {
  const FILES = () => ({ [`${RUN_DIR}/run.md`]: runState('active') })
  const startAgain = ($: any) => $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })

  test('[S1] haltedByTurn is cleared at session.start: a halt from a turn end is not undone by a listed `running` in the next session', HEAVY, async ($, on) => {
    const h = heldClock()
    const fs = await boot($, on, FILES(), h.clockEvery)
    await call($, 1, '1')
    await call($, 2, '2')
    fs.listed['a2'] = 'running'
    fs.listed['a1'] = 'failed'
    await endTurn($, 'a1', 'error')
    expect(await paneStatus($)).toBe('status: halted')
    await startAgain($)
    fs.listed['a1'] = 'running'
    await h.tick()
    await h.tick()
    expect(await paneStatus($)).toBe('status: halted')
  })

  test('[S3] a non-answer turn end never moves an ended agent back to running, and keeps its mark (a listed `running` still resumes it)', HEAVY, async ($, on) => {
    const h = heldClock()
    const fs = await boot($, on, FILES(), h.clockEvery)
    await call($, 1, '1')
    await call($, 2, '2') // at work, so the poll reads the list
    fs.listed['a2'] = 'running'
    fs.listed['a1'] = 'failed'
    await endTurn($, 'a1', 'error')
    expect(await paneStatus($)).toBe('status: halted')
    // The list now says running (no tick yet): the second error end is kept, but a1 was already ended.
    fs.listed['a1'] = 'running'
    await endTurn($, 'a1', 'error')
    expect(await paneStatus($)).toBe('status: halted')
    expect(await bandStatus($)).toBe('status: halted')
    // The mark is kept: the poll's listed `running` resumes it.
    await h.tick()
    expect(await paneStatus($, 'in progress')).toBe('status: in progress')
  })

  test('[S3] the same with no row for the agent in the list (it counts as live): still halted', HEAVY, async ($, on) => {
    const h = heldClock()
    const fs = await boot($, on, FILES(), h.clockEvery)
    await call($, 1, '1')
    fs.listed['a1'] = 'failed'
    await endTurn($, 'a1', 'error')
    expect(await paneStatus($)).toBe('status: halted')
    delete fs.listed['a1']
    await endTurn($, 'a1', 'error')
    expect(await paneStatus($)).toBe('status: halted')
  })
})
