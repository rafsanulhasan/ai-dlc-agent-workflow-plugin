import { describe, expect, test } from 'claude-code/testing'
import { mergeAgentList, pendingAgent, planDrops } from '../hooks/lens'
import type { AgentListMarks, ListedAgent } from '../hooks/lens'
import type { LensAgent } from '../types'

/**
 * Step 44.3.l2.4 (the human's decision 17, ITEM-104 round 2 W-A): the body of `refreshList`'s `update` updater is the
 * pure `mergeAgentList` / `planDrops`, so the engine may run it again on a version miss. The kit cannot make `update`
 * conflict (44.3.l2.3), so purity is tested where it can be: both functions are called twice with the same arguments,
 * their inputs deep-frozen (a write throws in these strict modules) and the three marks snapshotted before and after.
 * A mutant whose updater writes a mark (W-A's M2: `missingSince.delete` in the halt), writes an input, or reads the
 * clock instead of `t` turns a test here red.
 */

const T0 = 1_000_000
const LIMIT = 60_000

const agent = (id: string, over: Partial<LensAgent> = {}): LensAgent => ({ ...pendingAgent(`toolu_${id}`, 'main', undefined), id, status: 'running', ...over })

const deepFreeze = <T>(v: T): T => {
  if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v)
    for (const k of Object.keys(v as object)) deepFreeze((v as Record<string, unknown>)[k])
  }
  return v
}

type Marks = { turn?: string[]; timeout?: string[]; since?: Array<[string, number]> }
const marksOf = (m: Marks): AgentListMarks => ({ turn: new Set(m.turn ?? []), timeout: new Set(m.timeout ?? []), missingSince: new Map(m.since ?? []) })
const snap = (m: AgentListMarks) => ({ turn: [...m.turn], timeout: [...m.timeout], missingSince: [...m.missingSince] })

/** Runs `mergeAgentList` twice on frozen inputs; asserts equal results and unchanged marks; returns the first result. */
function merge(agents: Record<string, LensAgent>, list: ListedAgent[], t: number, limitMs: number, m: Marks = {}) {
  deepFreeze(agents)
  deepFreeze(list)
  const marks = marksOf(m)
  const before = snap(marks)
  const first = mergeAgentList(agents, list, t, limitMs, marks)
  const second = mergeAgentList(agents, list, t, limitMs, marks)
  expect(second).toEqual(first)
  expect(snap(marks)).toEqual(before)
  return first
}

const listed = (id: string, status: string, over: Partial<ListedAgent> = {}): ListedAgent => ({ id, type: 'ai-dlc:agent-manager', status, ...over })

describe('[44.3.l2.4] [decision 17] mergeAgentList / planDrops are pure', () => {
  test('a timeout halt: at the limit the agent fails with endedAt t and the plan halts it; 1 ms short it does not', () => {
    const agents = { main: agent('main', { parent: null }), a1: agent('a1') }
    const at = merge(agents, [], T0 + LIMIT, LIMIT, { since: [['a1', T0]] })
    expect(at.agents['a1']).toMatchObject({ status: 'failed', endedAt: T0 + LIMIT })
    expect(at.drops).toEqual({ start: [], clear: [], halt: ['a1'] })
    expect(at.resumed).toEqual([])
    expect(agents.a1.status).toBe('running') // the frozen input is unchanged

    const short = merge(agents, [], T0 + LIMIT - 1, LIMIT, { since: [['a1', T0]] })
    expect(short.agents['a1']!.status).toBe('running')
    expect(short.agents['a1']!.endedAt).toBeNull()
    expect(short.drops).toEqual({ start: [], clear: [], halt: [] })
  })

  test('a running subagent missing from the list with no mark starts its time; the main loop and teammates never do', () => {
    const agents = { main: agent('main', { parent: null }), a1: agent('a1'), a2: agent('a2', { type: 'teammate' }), a3: agent('a3', { teammate: true }) }
    const r = merge(agents, [], T0, LIMIT)
    expect(r.drops).toEqual({ start: ['a1'], clear: [], halt: [] })
    expect(r.agents['a1']!.status).toBe('running')
  })

  test('a listed agent, or one no longer running, clears a mark it had', () => {
    const agents = { main: agent('main', { parent: null }), a1: agent('a1'), a2: agent('a2', { status: 'completed' }) }
    const r = merge(agents, [listed('a1', 'running')], T0 + 10 * LIMIT, LIMIT, { since: [['a1', T0], ['a2', T0]] })
    expect(r.drops.clear.sort()).toEqual(['a1', 'a2'])
    expect(r.drops.halt).toEqual([])
    expect(r.agents['a1']!.status).toBe('running')
  })

  for (const mark of ['turn', 'timeout'] as const) {
    test(`a listed running resumes a halted agent that is in the ${mark} mark: running again, endedAt null, reported in resumed`, () => {
      const agents = { main: agent('main', { parent: null }), a1: agent('a1', { status: 'failed', endedAt: T0 - 5 }) }
      const r = merge(agents, [listed('a1', 'running')], T0, LIMIT, { [mark]: ['a1'] })
      expect(r.agents['a1']).toMatchObject({ status: 'running', endedAt: null })
      expect(r.resumed).toEqual(['a1'])
    })

    test(`a killed agent in the ${mark} mark resumes the same way`, () => {
      const agents = { main: agent('main', { parent: null }), a1: agent('a1', { status: 'killed', endedAt: T0 - 5 }) }
      const r = merge(agents, [listed('a1', 'running')], T0, LIMIT, { [mark]: ['a1'] })
      expect(r.agents['a1']).toMatchObject({ status: 'running', endedAt: null })
      expect(r.resumed).toEqual(['a1'])
    })
  }

  test('a listed running does not resume a failed agent that no mark covers (the list set that halt), nor a completed one', () => {
    const agents = {
      main: agent('main', { parent: null }),
      a1: agent('a1', { status: 'failed', endedAt: T0 - 5 }),
      a2: agent('a2', { status: 'completed', endedAt: T0 - 5 }),
    }
    const r = merge(agents, [listed('a1', 'running'), listed('a2', 'running')], T0, LIMIT, { turn: ['a2'], timeout: ['a2'] })
    expect(r.agents['a1']!.status).toBe('failed')
    expect(r.agents['a2']!.status).toBe('completed')
    expect(r.resumed).toEqual([])
  })

  test('limitMs 0 means never: nothing halts however long, and clear holds every missingSince key, listed or not', () => {
    const agents = { main: agent('main', { parent: null }), a1: agent('a1') }
    const r = merge(agents, [], T0 + 1e9, 0, { since: [['a1', T0], ['ghost', T0], ['a9', T0 + 1]] })
    expect(r.drops).toEqual({ start: [], clear: ['a1', 'ghost', 'a9'], halt: [] })
    expect(r.agents['a1']!.status).toBe('running')
  })

  test('the background-task stamp uses the t it is given: startedAt t for a running task, endedAt t for an ended one', () => {
    const agents = { main: agent('main', { parent: null }) }
    const rows = [listed('b1', 'running', { parentId: 'main', type: 'bash' }), listed('b2', 'completed', { parentId: 'main', type: 'bash' })]
    const r = merge(agents, rows, 7_777, LIMIT)
    const bg = r.agents['main']!.bg
    expect(bg.find(x => x.id === 'b1')).toMatchObject({ startedAt: 7_777, endedAt: null, status: 'running', source: 'agent.list' })
    expect(bg.find(x => x.id === 'b2')).toMatchObject({ startedAt: 7_777, endedAt: 7_777, status: 'completed' })
    // a second poll at a later t keeps the first stamp
    const again = mergeAgentList(deepFreeze(r.agents), deepFreeze(rows), 9_999, LIMIT, marksOf({}))
    expect(again.agents['main']!.bg.find(x => x.id === 'b1')!.startedAt).toBe(7_777)
  })

  test('planDrops alone: a copy back, the plan, and neither inputs nor marks written', () => {
    const agents = deepFreeze({ main: agent('main', { parent: null }), a1: agent('a1'), a2: agent('a2') })
    const ids = deepFreeze(new Set(['a2']))
    const since = new Map<string, number>([['a1', T0]])
    const before = [...since]
    const one = planDrops(agents, ids, T0 + LIMIT, LIMIT, since)
    const two = planDrops(agents, ids, T0 + LIMIT, LIMIT, since)
    expect(two).toEqual(one)
    expect([...since]).toEqual(before)
    expect(one.plan).toEqual({ start: [], clear: [], halt: ['a1'] })
    expect(one.agents).not.toBe(agents)
    expect(one.agents['a1']).toMatchObject({ status: 'failed', endedAt: T0 + LIMIT })
    expect(one.agents['a2']!.status).toBe('running')
  })
})
