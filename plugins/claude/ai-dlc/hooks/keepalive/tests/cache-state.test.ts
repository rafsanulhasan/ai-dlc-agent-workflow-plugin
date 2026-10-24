import { describe, expect, test } from 'claude-code/testing'
import { armUntil, cachePart, cacheView, emptyLedger, hhmm, isEmpty, lineOf, observe, observePing, reasonText, seedMain } from '../cache-state.ts'
import type { Ledger, Lifetimes } from '../cache-state.ts'

// The pure seam of the cache ledger (spec keepalive-cache-status, D1 and D3; LLD section 2, T17.1).
// Times are local clock times, so the literals compare as the stories write them (10:00, 10:05).

const MIN = 60_000
const LIFE: Lifetimes = { '5m': 5 * MIN, '1h': 60 * MIN }
const T = (h: number, m: number) => new Date(2026, 9, 7, h, m).getTime()

// A response's usage: h tokens written for 1 hour, m for 5 minutes, `read` read from the cache.
const usageOf = (h: number, m: number, read = 0) => ({
  input_tokens: 1, output_tokens: 1, cache_read_input_tokens: read, cache_creation_input_tokens: h + m,
  cache_creation: { ephemeral_1h_input_tokens: h, ephemeral_5m_input_tokens: m },
})
// A ping's usage as $.model.fork reports it: a read, no cache_creation object.
const pingUsage = (read: number) => ({ input_tokens: 10, output_tokens: 1, cache_read_input_tokens: read, cache_creation_input_tokens: 0 })

const at = (l: Ledger, ttl: '5m' | '1h', now: number, reason = reasonText('noTasks')) => lineOf(ttl, cachePart(cacheView(l, ttl, now)), reason)

describe('[T17.1] the cache ledger, pure', () => {
  test('AC-17.1.1 main 5m write at 10:00, no tasks, read at 10:01: E1', () => {
    const l = emptyLedger()
    observe(l, { at: T(10, 0), usage: usageOf(0, 2_000) }, LIFE)
    expect(cacheView(l, '5m', T(10, 1))).toEqual({ main: { warmUntil: T(10, 5), expired: false } })
    expect(at(l, '5m', T(10, 1))).toBe('keepalive 5m: main warm until 10:05; off (no background tasks)')
  })

  test('AC-17.1.3 a later 1h write (with a read) does not switch 5m off or move it', () => {
    const l = emptyLedger()
    observe(l, { at: T(10, 0), usage: usageOf(0, 2_000) }, LIFE)
    observe(l, { at: T(10, 2), usage: usageOf(3_000, 0, 1_500) }, LIFE)
    expect(at(l, '5m', T(10, 3))).toBe('keepalive 5m: main warm until 10:05; off (no background tasks)')
    expect(at(l, '1h', T(10, 3))).toBe('keepalive 1h: main warm until 11:02; off (no background tasks)')
  })

  test('AC-17.1.4 main 5m write at 10:00, no later write or read, rendered at 10:06: E4', () => {
    const l = emptyLedger()
    observe(l, { at: T(10, 0), usage: usageOf(0, 2_000) }, LIFE)
    expect(cacheView(l, '5m', T(10, 6))).toEqual({ main: { warmUntil: T(10, 5), expired: true } })
    expect(at(l, '5m', T(10, 6))).toBe('keepalive 5m: main expired 10:05; off (no background tasks)')
  })

  test('AC-17.1.5 a 5m hit at 10:04 refreshes to 10:09', () => {
    const l = emptyLedger()
    observe(l, { at: T(10, 0), usage: usageOf(0, 2_000) }, LIFE)
    observe(l, { at: T(10, 4), usage: usageOf(0, 0, 1_500) }, LIFE)
    expect(l.main['5m']).toEqual({ warmUntil: T(10, 9) })
    // A usage with no cache_creation object (a ping's shape) reads the same way
    observe(l, { at: T(10, 8), usage: pingUsage(1_500) }, LIFE)
    expect(l.main['5m']).toEqual({ warmUntil: T(10, 13) })
  })

  test('AC-17.1.5 a read and a 5m write in one response end at at + 5m', () => {
    const l = emptyLedger()
    observe(l, { at: T(10, 0), usage: usageOf(0, 2_000) }, LIFE)
    observe(l, { at: T(10, 4), usage: usageOf(0, 100, 1_500) }, LIFE)
    expect(l.main['5m']).toEqual({ warmUntil: T(10, 9) })
  })

  test('AC-17.1.5 a read never moves a 1h entry; only a 1h write does', () => {
    const l = emptyLedger()
    observe(l, { at: T(10, 0), usage: usageOf(3_000, 0) }, LIFE)
    observe(l, { at: T(10, 4), usage: usageOf(0, 0, 1_500) }, LIFE)
    expect(l.main['1h']).toEqual({ warmUntil: T(11, 0) })
    expect(l.main['5m']).toBeUndefined()
    observe(l, { at: T(10, 30), usage: usageOf(50, 0, 1_500) }, LIFE)
    expect(l.main['1h']).toEqual({ warmUntil: T(11, 30) })
  })

  test('read attribution: a read moves nothing when a 1h entry is warm, the 5m entry is expired, or there is none', () => {
    const both = emptyLedger()
    observe(both, { at: T(10, 0), usage: usageOf(3_000, 2_000) }, LIFE)
    observe(both, { at: T(10, 4), usage: usageOf(0, 0, 1_500) }, LIFE)
    expect(both.main).toEqual({ '5m': { warmUntil: T(10, 5) }, '1h': { warmUntil: T(11, 0) } })
    const cold = emptyLedger()
    observe(cold, { at: T(10, 0), usage: usageOf(0, 2_000) }, LIFE)
    observe(cold, { at: T(10, 6), usage: usageOf(0, 0, 1_500) }, LIFE)
    expect(cold.main['5m']).toEqual({ warmUntil: T(10, 5) })
    const none = emptyLedger()
    observe(none, { at: T(10, 0), usage: usageOf(0, 0, 1_500) }, LIFE)
    expect(isEmpty(none)).toBe(true)
  })

  test('AC-17.3.4 5m and 1h writes from main and agents are kept apart, per source and TTL', () => {
    const l = emptyLedger()
    observe(l, { at: T(10, 0), usage: usageOf(0, 2_000) }, LIFE)
    observe(l, { at: T(10, 1), usage: usageOf(3_000, 0) }, LIFE)
    observe(l, { at: T(10, 2), agentId: 'a1', usage: usageOf(0, 500) }, LIFE)
    observe(l, { at: T(10, 3), agentId: 'a2', usage: usageOf(700, 0) }, LIFE)
    expect(l.main).toEqual({ '5m': { warmUntil: T(10, 5) }, '1h': { warmUntil: T(11, 1) } })
    expect(l.agents.get('a1')).toEqual({ caches: { '5m': { warmUntil: T(10, 7) } }, status: 'running' })
    expect(l.agents.get('a2')).toEqual({ caches: { '1h': { warmUntil: T(11, 3) } }, status: 'running' })
    expect(at(l, '5m', T(10, 4))).toBe('keepalive 5m: main warm until 10:05, subagents warm until 10:07; off (no background tasks)')
    expect(at(l, '1h', T(10, 4))).toBe('keepalive 1h: main warm until 11:01, subagents warm until 11:03; off (no background tasks)')
    // A later 1h write by main moves only main's 1h entry: no single last write decides both tracks
    observe(l, { at: T(10, 5), usage: usageOf(100, 0) }, LIFE)
    expect(l.main['5m']).toEqual({ warmUntil: T(10, 5) })
    expect(l.agents.get('a1')!.caches['5m']).toEqual({ warmUntil: T(10, 7) })
  })

  test('AC-17.3.4 subagents show the latest warm-until over the agents of that TTL', () => {
    const l = emptyLedger()
    observe(l, { at: T(10, 2), agentId: 'a1', usage: usageOf(0, 500) }, LIFE)
    observe(l, { at: T(10, 1), agentId: 'a2', usage: usageOf(0, 500) }, LIFE)
    expect(cacheView(l, '5m', T(10, 8))).toEqual({ subagents: { warmUntil: T(10, 7), expired: true } })
    expect(cachePart(cacheView(l, '5m', T(10, 4)))).toBe('subagents warm until 10:07')
  })

  test('D1 landed ping: a landed 5m ping refreshes the 5m entry whatever other entries exist', () => {
    const l = emptyLedger()
    observe(l, { at: T(10, 0), usage: usageOf(3_000, 2_000) }, LIFE)
    // An ordinary read here would be unattributed (a warm 1h entry); a landed 5m ping is not
    observePing(l, { at: T(10, 3), ttl: '5m', usage: pingUsage(5_000) }, LIFE)
    expect(l.main['5m']).toEqual({ warmUntil: T(10, 8) })
    expect(l.main['1h']).toEqual({ warmUntil: T(11, 0) })
    // With no 5m entry yet, a landed 5m ping still sets one
    const fresh = emptyLedger()
    observePing(fresh, { at: T(10, 3), ttl: '5m', usage: pingUsage(5_000) }, LIFE)
    expect(fresh.main['5m']).toEqual({ warmUntil: T(10, 8) })
  })

  test('D1 landed ping: a landed 1h ping without a 1h write leaves the 1h entry; with one it moves (OQ2)', () => {
    const l = emptyLedger()
    observe(l, { at: T(10, 0), usage: usageOf(3_000, 0) }, LIFE)
    observePing(l, { at: T(10, 50), ttl: '1h', usage: pingUsage(5_000) }, LIFE)
    expect(l.main).toEqual({ '1h': { warmUntil: T(11, 0) } })
    observePing(l, { at: T(10, 50), ttl: '1h', usage: usageOf(20, 0, 5_000) }, LIFE)
    expect(l.main).toEqual({ '1h': { warmUntil: T(11, 50) } })
    expect(cachePart(cacheView(l, '1h', T(10, 50)))).toBe('main warm until 11:50')
  })

  test('D1 landed ping of an agent moves that agent only', () => {
    const l = emptyLedger()
    observe(l, { at: T(10, 0), usage: usageOf(0, 2_000) }, LIFE)
    observePing(l, { at: T(10, 3), agentId: 'a1', ttl: '5m', usage: pingUsage(5_000) }, LIFE)
    expect(l.main['5m']).toEqual({ warmUntil: T(10, 5) })
    expect(l.agents.get('a1')!.caches['5m']).toEqual({ warmUntil: T(10, 8) })
  })

  test('seedMain: the transcript seeds main per TTL from the row time, only warm entries, only when main has none', () => {
    const l = emptyLedger()
    seedMain(l, { '1h': 3_000, '5m': 2_000 }, T(9, 50), T(10, 0), LIFE)
    // 9:55 is past: the 5m entry is not seeded; the 1h one is, warm until 10:50
    expect(l.main).toEqual({ '1h': { warmUntil: T(10, 50) } })
    seedMain(l, { '1h': 0, '5m': 2_000 }, T(10, 0), T(10, 0), LIFE)
    expect(l.main).toEqual({ '1h': { warmUntil: T(10, 50) } })
    const zero = emptyLedger()
    seedMain(zero, { '1h': 0, '5m': 2_000 }, T(10, 0), T(10, 0), LIFE)
    expect(zero.main).toEqual({ '5m': { warmUntil: T(10, 5) } })
  })

  test('observe is total: an unusable usage changes nothing', () => {
    const l = emptyLedger()
    for (const usage of [undefined, null, 'x', 7, {}, { cache_creation: 'x' }, { cache_read_input_tokens: 'many' }]) observe(l, { at: T(10, 0), usage }, LIFE)
    expect(isEmpty(l)).toBe(true)
    expect(l.agents.size).toBe(0)
    expect(cacheView(l, '5m', T(10, 0))).toEqual({})
    expect(cachePart({})).toBeUndefined()
    expect(lineOf('5m', undefined, 'off')).toBe('keepalive 5m: off')
  })

  test('D2a: an agent write without a split is an unknown entry, shown on both tracks, never as a time', () => {
    const l = emptyLedger()
    observe(l, { at: T(10, 2), agentId: 'a1', usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 900 } }, LIFE)
    // Main without a split records nothing
    observe(l, { at: T(10, 2), usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 900 } }, LIFE)
    expect(l.main).toEqual({})
    expect(isEmpty(l)).toBe(true)
    expect(cacheView(l, '5m', T(10, 3))).toEqual({ subagentsUnknown: true })
    expect(cachePart(cacheView(l, '1h', T(10, 3)))).toBe('subagents: split unknown')
    observe(l, { at: T(10, 2), usage: usageOf(0, 2_000) }, LIFE)
    expect(at(l, '5m', T(10, 3))).toBe('keepalive 5m: main warm until 10:07, subagents: split unknown; off (no background tasks)')
  })

  test('isEmpty per TTL and over both', () => {
    const l = emptyLedger()
    observe(l, { at: T(10, 2), agentId: 'a1', usage: usageOf(0, 500) }, LIFE)
    expect([isEmpty(l), isEmpty(l, '5m'), isEmpty(l, '1h')]).toEqual([false, false, true])
  })

  test('hhmm is the local H:MM the status line has always used', () => {
    expect(hhmm(T(9, 5))).toBe('9:05')
    expect(hhmm(T(18, 0))).toBe('18:00')
  })

  test('reasonText gives the stories\' texts', () => {
    expect(reasonText('noTasks')).toBe('off (no background tasks)')
    expect(reasonText({ noWrite: '1h' })).toBe('off (no 1h cache write seen)')
    expect(reasonText('expired')).toBe('off (cache expired)')
    expect(reasonText('turnRunning')).toBe('off (turn running)')
    expect(reasonText('sessionEnded')).toBe('off (session ended)')
    expect(reasonText('onlySubagents')).toBe('off (only subagent caches; subagent pings off)')
    expect(reasonText('disabled')).toBe('off (disabled)')
    expect(reasonText('noSplit')).toBe('off (no cache write seen yet, so the cache lifetime is unknown)')
    expect(reasonText('overage')).toBe('off in overage')
  })

  // Gap found by mutation (17.3): T17.1 arms from main only (D5); arming from agents is ITEM-034.
  test('armUntil is main only: a warm main entry of the TTL, never an agent\'s, never an expired or missing one', () => {
    const l = emptyLedger()
    observe(l, { at: T(10, 0), agentId: 'a1', usage: usageOf(3_000, 2_000) }, LIFE)
    expect(armUntil(l, '5m', T(10, 1))).toBeUndefined()
    expect(armUntil(l, '1h', T(10, 1))).toBeUndefined()
    observe(l, { at: T(10, 0), usage: usageOf(0, 2_000) }, LIFE)
    expect(armUntil(l, '5m', T(10, 1))).toBe(T(10, 5))
    expect(armUntil(l, '1h', T(10, 1))).toBeUndefined()
    expect(armUntil(l, '5m', T(10, 5))).toBeUndefined()
    expect(armUntil(l, '5m', T(10, 6))).toBeUndefined()
  })
})
