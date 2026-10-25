import { describe, expect, test } from 'claude-code/testing'
import { CHAIN_MAX, chainIdOf, chainSessions } from '../chain.ts'

// ITEM-076 (LLD rev 10, 19.1): the automatic handoff chain a session belongs to, read from the lineage records
// the seed step writes (`lineage:<session id>` in $.store). A session with none, one started by hand, is a
// chain of one: its own id.

const SESSION = 'sess-c'

// The engine's edge as chain.ts uses it: the session id, the store, the debug log. A store entry that is the
// string 'DENY' (or a function that throws) makes the read fail, as an unreadable store does.
function engine(id: string, store: Record<string, unknown> = {}, failKeys: string[] = []) {
  const logs: string[] = []
  return {
    logs,
    $: {
      session: { id: async () => id },
      store: { get: async (key: string) => { if (failKeys.includes(key) || failKeys.includes('*')) throw new Error('store unreadable'); return store[key] } },
      ui: { log: (text: string) => { logs.push(text) } },
    } as never,
  }
}
const lineage = (entries: Record<string, { from?: string; chain?: string } | string>) => Object.fromEntries(Object.entries(entries).map(([id, v]) => [`lineage:${id}`, v]))

describe('chainIdOf', () => {
  test('a session with no lineage record is its own chain', async () => {
    expect(await chainIdOf(engine(SESSION).$)).toEqual({ id: SESSION })
  })

  test('a lineage record with a chain gives that chain id', async () => {
    expect(await chainIdOf(engine(SESSION, lineage({ [SESSION]: { from: 'sess-b', chain: 'sess-a' } })).$)).toEqual({ id: 'sess-a' })
  })

  test('a record whose chain is missing, empty or not a string is no chain: the session is its own', async () => {
    for (const rec of [{ from: 'x' }, { chain: '' }, { chain: 3 }, 'garbage', null]) expect(await chainIdOf(engine(SESSION, lineage({ [SESSION]: rec as never })).$)).toEqual({ id: SESSION })
  })

  test('a store that cannot be read: its own id, marked failed (the chain restarts), and nothing thrown', async () => {
    const e = engine(SESSION, {}, ['*'])
    expect(await chainIdOf(e.$)).toEqual({ id: SESSION, failed: true })
    expect(e.logs).toHaveLength(1)
    expect(e.logs[0]).toContain('the session is its own chain')
  })
})

describe('chainSessions: the session ids of the chain, newest first', () => {
  test('a session with no lineage is a chain of one', async () => {
    expect(await chainSessions(engine(SESSION).$)).toEqual([SESSION])
  })

  test("each lineage record's from is followed up the chain: itself, then its parents", async () => {
    const store = lineage({ 'sess-c': { from: 'sess-b', chain: 'sess-a' }, 'sess-b': { from: 'sess-a', chain: 'sess-a' }, 'sess-a': {} })
    expect(await chainSessions(engine('sess-c', store).$)).toEqual(['sess-c', 'sess-b', 'sess-a'])
  })

  test('a cycle stops the walk at the repeated id', async () => {
    expect(await chainSessions(engine('a', lineage({ a: { from: 'b' }, b: { from: 'a' } })).$)).toEqual(['a', 'b'])
  })

  test('a record pointing at itself stops at once', async () => {
    expect(await chainSessions(engine('a', lineage({ a: { from: 'a' } })).$)).toEqual(['a'])
  })

  test('a `from` that is empty or not a string ends the walk', async () => {
    const store = lineage({ a: { from: '' }, b: { from: 7 as never } })
    expect(await chainSessions(engine('a', store).$)).toEqual(['a'])
    expect(await chainSessions(engine('b', store).$)).toEqual(['b'])
  })

  test('the walk takes at most CHAIN_MAX steps: a longer chain is cut there', async () => {
    const long: Record<string, { from: string }> = {}
    for (let i = 0; i < CHAIN_MAX + 20; i++) long[`s${i}`] = { from: `s${i + 1}` }
    const out = await chainSessions(engine('s0', lineage(long)).$)
    expect(CHAIN_MAX).toBe(50)
    expect(out).toHaveLength(CHAIN_MAX + 1)
    expect(out[0]).toBe('s0')
    expect(out.at(-1)).toBe(`s${CHAIN_MAX}`)
  })

  test('a read that fails part-way keeps what was read so far', async () => {
    const store = lineage({ c: { from: 'b' }, b: { from: 'a' } })
    expect(await chainSessions(engine('c', store, ['lineage:b']).$)).toEqual(['c', 'b'])
  })
})
