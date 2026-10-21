import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'
import { formatDuration, parseCommandArgs, parseDuration } from './duration.ts'

const MIN = 60_000
const task = { id: 'b1', type: 'shell', status: 'running', description: 'build' }

// Stands in for the engine: a 1M-token context, cache hits on every fork, records statuses and forks.
// The timer fires only on `fire(at)`, so a test sets the wall time it fires at, as a machine that slept would.
// store: what the mod finds in its store (the keep-warm overrides); session: the session id.
function engine(on: On, forkOutput = 1, store?: Record<string, unknown>, session: string | (() => string) = 's-1', cacheRead = 1_000_000) {
  const seen = { statuses: [] as (string | undefined)[], forks: 0, logs: [] as string[] }
  let now = Date.UTC(2026, 9, 7, 12)
  let resolve = () => {}
  on('clock.now', () => ({ value: now }) as never)
  on('clock.after', () => new Promise(r => { resolve = () => r({ value: undefined }) }) as never)
  const clock = { async fire(minutes: number) { now += minutes * MIN; resolve(); for (let i = 0; i < 1000; i++) await Promise.resolve() } }
  on('classic.Stop', () => ({}) as never)
  on('session.usage', () => ({ value: { context: { tokens: 1_000_000, window: 1_000_000, percent: 100 }, rateLimits: [] } }) as never)
  on('session.model', () => ({ value: 'claude-opus-5-5' }) as never)
  on('model.fork', () => (seen.forks++, { value: { isAnswered: true, text: 'ok', usage: { input_tokens: 10, output_tokens: forkOutput, cache_read_input_tokens: cacheRead, cache_creation_input_tokens: cacheRead === 1_000_000 ? 0 : 1_000_000 } } }) as never)
  on('ui.status', (_, e) => (seen.statuses.push(e.text), { value: undefined }) as never)
  on('ui.log', (_, e) => (seen.logs.push(e.text), { value: undefined }) as never)
  on('session.id', () => ({ value: typeof session === 'function' ? session() : session }) as never)
  mock.store(on, store)
  return { seen, clock }
}

test('pings while warm and names the expiry', async ($, on) => {
  const { seen, clock } = engine(on)
  await $.classic.Stop({ background_tasks: [task] } as never)
  expect(seen.statuses.at(-1)).toContain('armed, 1 task(s), warm until')
  await clock.fire(50)
  expect(seen.forks).toBe(1)
  expect(seen.statuses.at(-1)).toMatch(/^keepalive: warm until \d+:\d\d$/)
})

test('a timer that fires after the TTL does not ping and says expired', async ($, on) => {
  const { seen, clock } = engine(on)
  await $.classic.Stop({ background_tasks: [task] } as never)
  await clock.fire(80)
  expect(seen.forks).toBe(0)
  expect(seen.statuses.at(-1)).toBe('keepalive: expired, stopped')
})

test('compacting on cap logs a command that restores the pre-compaction conversation', { options: { compactOnCap: true } }, async ($, on) => {
  // 400k output tokens per ping spends the whole 2M budget on the first one
  const { seen, clock } = engine(on, 400_000)
  on('session.cwd', () => ({ value: "/work/it's" }) as never)
  on('session.compact', () => ({ messages: [{ role: 'user', text: 'summary', toolUses: [] }], tokensBefore: 1_000_000, tokensAfter: 100_000 }) as never)
  await $.classic.Stop({ background_tasks: [task] } as never)
  await clock.fire(50)
  const restore = seen.logs.find(l => l.includes('--resume-session-at'))
  expect(restore).toContain(`cd '/work/it'\\''s' && claude --resume s-1 --fork-session --resume-session-at "$(jq -r`)
  expect(restore).toContain('.timestamp >= "2026-10-07T12:50:00.000Z"')
  expect(restore).toContain('/projects/*/s-1.jsonl | head -1)"')
})

// Local additions (VENDORED.md): the keep-warm duration and /keepalive <duration>.

// Fires the timer every 50 minutes until the pings stop; returns how many pings ran.
async function runChain(clock: { fire(m: number): Promise<void> }, seen: { forks: number; statuses: (string | undefined)[] }, max = 60) {
  for (let i = 0; i < max && !/stopped/.test(seen.statuses.at(-1) ?? ''); i++) await clock.fire(50)
  return seen.forks
}

test('parseDuration reads minutes, hours and days and refuses anything else', () => {
  expect(parseDuration('90m')).toBe(90 * MIN)
  expect(parseDuration('8h')).toBe(8 * 60 * MIN)
  expect(parseDuration(' 1.5H ')).toBe(90 * MIN)
  expect(parseDuration('2d')).toBe(2 * 24 * 60 * MIN)
  for (const bad of ['', '8', 'h', '0h', '-1h', '8 hours', '1w', '8h30m', 8]) expect(parseDuration(bad)).toBeUndefined()
  expect(formatDuration(8 * 60 * MIN)).toBe('8h')
  expect(formatDuration(2 * 24 * 60 * MIN)).toBe('2d')
  expect(formatDuration(90 * MIN)).toBe('90m')
})

test('parseCommandArgs: a duration, clear, the scope flags and usage errors', () => {
  expect(parseCommandArgs('', 'session')).toEqual({ kind: 'ping' })
  expect(parseCommandArgs('2h', 'session')).toEqual({ kind: 'set', ms: 120 * MIN, scope: 'session' })
  expect(parseCommandArgs('2h', 'machine')).toEqual({ kind: 'set', ms: 120 * MIN, scope: 'machine' })
  expect(parseCommandArgs('--machine 1d', 'session')).toEqual({ kind: 'set', ms: 24 * 60 * MIN, scope: 'machine' })
  expect(parseCommandArgs('30m --session', 'machine')).toEqual({ kind: 'set', ms: 30 * MIN, scope: 'session' })
  expect(parseCommandArgs('clear --machine', 'session')).toEqual({ kind: 'clear', scope: 'machine' })
  expect(parseCommandArgs('soon', 'session').kind).toBe('usage')
  expect(parseCommandArgs('2h clear', 'session').kind).toBe('usage')
  expect(parseCommandArgs('2h 3h', 'session').kind).toBe('usage')
})

test('the default keeps the cache warm for 8h, then stops', async ($, on) => {
  const { seen, clock } = engine(on)
  await $.classic.Stop({ background_tasks: [task] } as never)
  expect(seen.statuses.at(-1)).toContain('keep warm 8h')
  // Pings at 50, 100, ... 450 minutes; at 500 the 8h (480 minutes) is spent. The last ping keeps it warm to 510.
  expect(await runChain(clock, seen)).toBe(9)
  expect(seen.statuses.at(-1)).toMatch(/^keepalive: kept warm 8h, stopped, warm until \d+:\d\d$/)
})

test('keepWarmFor in /config sets the duration', { options: { keepWarmFor: '2h' } }, async ($, on) => {
  const { seen, clock } = engine(on)
  await $.classic.Stop({ background_tasks: [task] } as never)
  expect(await runChain(clock, seen)).toBe(2) // 50 and 100; at 150 the 120 minutes are spent
  expect(seen.statuses.at(-1)).toContain('kept warm 2h, stopped')
})

test('an invalid keepWarmFor falls back to 8h and says so', { options: { keepWarmFor: 'all day' } }, async ($, on) => {
  const { seen, clock } = engine(on)
  on('command.register', () => ({ value: { command: 'keepalive' } }) as never)
  on('session.start', (_, e) => e as never)
  await $.session.start({ source: 'startup', cwd: '/work' } as never)
  expect(seen.logs.some(l => l.includes('keepWarmFor "all day" in /config is not a duration (<n>m, <n>h or <n>d, at least 1m); using 8h'))).toBe(true)
  await $.classic.Stop({ background_tasks: [task] } as never)
  expect(await runChain(clock, seen)).toBe(9)
})

test('the budget still stops the pings before the duration', { options: { keepWarmFor: '1d' } }, async ($, on) => {
  // 400k output tokens per ping spends the whole 2M budget on the first one
  const { seen, clock } = engine(on, 400_000)
  await $.classic.Stop({ background_tasks: [task] } as never)
  expect(await runChain(clock, seen)).toBe(1)
  expect(seen.statuses.at(-1)).toContain('budget spent, stopped')
})

test('/keepalive 2h overrides the duration for this session only', async ($, on) => {
  const { seen, clock } = engine(on)
  const { text } = await $.command.run({ command: 'keepalive', args: '2h' })
  expect(text).toBe('keepalive: keep-warm set to 2h for this session; now keep warm 2h (this session, /keepalive)')
  expect(seen.forks).toBe(0) // setting the duration does not ping
  await $.classic.Stop({ background_tasks: [task] } as never)
  expect(await runChain(clock, seen)).toBe(2)
})

test('a session override does not reach another session', async ($, on) => {
  const { seen, clock } = engine(on, 1, { 'keepWarmFor:sessions': [['other', 120 * MIN]] })
  await $.classic.Stop({ background_tasks: [task] } as never)
  expect(seen.statuses.at(-1)).toContain('keep warm 8h')
  expect(await runChain(clock, seen)).toBe(9)
})

test('/keepalive 1d --machine applies to every session until cleared', async ($, on) => {
  engine(on)
  expect((await $.command.run({ command: 'keepalive', args: '1d --machine' })).text)
    .toBe('keepalive: keep-warm set to 1d for every session on this machine; now keep warm 1d (this machine, /keepalive)')
  expect((await $.command.run({ command: 'keepalive' })).text).toContain('; keep warm 1d (this machine, /keepalive)')
  expect((await $.command.run({ command: 'keepalive', args: 'clear --machine' })).text)
    .toBe('keepalive: keep-warm override cleared for every session on this machine; now keep warm 8h (/config)')
})

test('a machine override from the store applies in a new session, and a session override beats it', async ($, on) => {
  const { seen } = engine(on, 1, { 'keepWarmFor:machine': 24 * 60 * MIN, 'keepWarmFor:sessions': [['s-1', 30 * MIN]] })
  await $.classic.Stop({ background_tasks: [task] } as never)
  expect(seen.statuses.at(-1)).toContain('keep warm 30m')
  expect((await $.command.run({ command: 'keepalive', args: 'clear' })).text).toContain('now keep warm 1d (this machine, /keepalive)')
})

test('keepaliveScope machine makes machine the default scope; --session overrides it', { options: { keepaliveScope: 'machine' } }, async ($, on) => {
  engine(on)
  expect((await $.command.run({ command: 'keepalive', args: '3h' })).text).toContain('for every session on this machine')
  expect((await $.command.run({ command: 'keepalive', args: '30m --session' })).text).toContain('for this session; now keep warm 30m (this session, /keepalive)')
})

test('/keepalive with a bad argument shows the usage and changes nothing', async ($, on) => {
  const { seen } = engine(on)
  const { text } = await $.command.run({ command: 'keepalive', args: 'forever' })
  expect(text).toContain('"forever" is not a duration')
  expect(text).toContain('Usage: /keepalive [<n>m|<n>h|<n>d|clear] [--session|--machine]')
  expect(seen.forks).toBe(0)
})

// Added in review round 1 of AAW-20261021-mods-config (AC-4, AC-5): edges the first set left open.

test('parseCommandArgs: --clear, upper-case flags and a bare scope flag', () => {
  expect(parseCommandArgs('--clear', 'session')).toEqual({ kind: 'clear', scope: 'session' })
  expect(parseCommandArgs('CLEAR --MACHINE', 'session')).toEqual({ kind: 'clear', scope: 'machine' })
  expect(parseCommandArgs('2H --Session', 'machine')).toEqual({ kind: 'set', ms: 120 * MIN, scope: 'session' })
  expect(parseCommandArgs('--machine', 'session')).toEqual({ kind: 'ping' }) // a flag alone changes nothing
  expect(parseCommandArgs('  \t ', 'session')).toEqual({ kind: 'ping' })
  expect(parseCommandArgs('0h', 'session').kind).toBe('usage')
})

// Added in review round 2 of AAW-20261021-mods-config.

test('a duration under 1m is refused, and two durations are one usage error', () => {
  expect(parseDuration('1m')).toBe(MIN)
  for (const short of ['0.4m', '0.9m', '0.01h']) expect(parseDuration(short)).toBeUndefined()
  expect(parseCommandArgs('0.4m', 'session').kind).toBe('usage')
  expect(parseCommandArgs('2h 3h', 'session')).toEqual({ kind: 'usage', problem: 'give one duration' })
})

test('a keep-warm duration under 50m sends no ping and says none was needed', { options: { keepWarmFor: '30m' } }, async ($, on) => {
  const { seen, clock } = engine(on)
  await $.classic.Stop({ background_tasks: [task] } as never)
  expect(seen.statuses.at(-1)).toContain('keep warm 30m')
  await clock.fire(50) // the first ping is due at 50 minutes, past the 30 minutes
  expect(seen.forks).toBe(0)
  expect(seen.statuses.at(-1)).toMatch(/^keepalive: no ping needed for 30m, stopped, warm until \d+:\d\d$/)
})

test('arming again after a ping resets the flag: a short duration then says no ping was needed', async ($, on) => {
  const { seen, clock } = engine(on)
  on('turn.start', (_, e) => e as never)
  await $.classic.Stop({ background_tasks: [task] } as never)
  await clock.fire(50)
  expect(seen.forks).toBe(1) // pinged, so the flag is set
  await $.command.run({ command: 'keepalive', args: '30m' })
  await $.turn.start({ turnId: 't-2' } as never)
  await $.classic.Stop({ background_tasks: [task] } as never) // re-armed: the flag resets
  await clock.fire(50)
  expect(seen.forks).toBe(1)
  expect(seen.statuses.at(-1)).toMatch(/^keepalive: no ping needed for 30m, stopped/)
})

test('a missed ping stops with "missed" and never reads as kept warm', async ($, on) => {
  const { seen, clock } = engine(on, 1, undefined, 's-1', 0)
  await $.classic.Stop({ background_tasks: [task] } as never)
  await clock.fire(50)
  expect(seen.forks).toBe(1)
  expect(seen.statuses.at(-1)).toBe('keepalive: missed, stopped')
})

test('/keepalive refuses a short or doubled duration and the usage text states the 1m minimum and the 50-minute pings', async ($, on) => {
  const { seen } = engine(on)
  const short = (await $.command.run({ command: 'keepalive', args: '0.4m' })).text
  expect(short).toContain('at least 1m')
  expect(short).toContain('Pings come every 50 minutes')
  expect(short).toContain('a duration of 50m or less sends none')
  expect((await $.command.run({ command: 'keepalive', args: '2h 3h' })).text).toContain('keepalive: give one duration. Usage:')
  expect((await $.command.run({ command: 'keepalive', args: '1m' })).text).toContain('set to 1m for this session')
  expect(seen.forks).toBe(0)
})

test('formatDuration keeps the largest whole unit', () => {
  expect(formatDuration(24 * 60 * MIN)).toBe('1d')
  expect(formatDuration(36 * 60 * MIN)).toBe('36h')
  expect(formatDuration(100 * MIN)).toBe('100m')
  expect(formatDuration(30 * MIN)).toBe('30m')
})

test('a valid keepWarmFor, or none, logs nothing at session start', { options: { keepWarmFor: '3h' } }, async ($, on) => {
  const { seen } = engine(on)
  on('command.register', () => ({ value: { command: 'keepalive' } }) as never)
  on('session.start', (_, e) => e as never)
  await $.session.start({ source: 'startup', cwd: '/work' } as never)
  expect(seen.logs.filter(l => l.includes('keepWarmFor'))).toEqual([])
})

test('an invalid keepaliveScope falls back to session', { options: { keepaliveScope: 'everywhere' } }, async ($, on) => {
  const { seen } = engine(on)
  const { text } = await $.command.run({ command: 'keepalive', args: '3h' })
  expect(text).toContain('for this session; now keep warm 3h (this session, /keepalive)')
  expect(seen.forks).toBe(0)
})

test('a session override set while the pings are armed applies at the next ping', async ($, on) => {
  const { seen, clock } = engine(on)
  await $.classic.Stop({ background_tasks: [task] } as never)
  await clock.fire(50)
  expect(seen.forks).toBe(1)
  await $.command.run({ command: 'keepalive', args: '30m' })
  await clock.fire(50) // 100 minutes since arming, past the 30m now in force
  expect(seen.forks).toBe(1)
  expect(seen.statuses.at(-1)).toMatch(/^keepalive: kept warm 30m, stopped/)
})

test('the keep-warm time counts from the latest arming, not the first', async ($, on) => {
  const { seen, clock } = engine(on, 1, { 'keepWarmFor:sessions': [['s-1', 120 * MIN]] })
  on('turn.start', (_, e) => e as never)
  await $.classic.Stop({ background_tasks: [task] } as never)
  await clock.fire(50)
  await clock.fire(50)
  expect(seen.forks).toBe(2)
  await $.turn.start({ turnId: 't-2' } as never)
  await $.classic.Stop({ background_tasks: [task] } as never) // armed again at minute 100
  expect(await runChain(clock, seen)).toBe(4) // two more pings: 2h counts from the new arming
})

test('clear in one scope leaves the other scope and other sessions alone', async ($, on) => {
  engine(on, 1, { 'keepWarmFor:machine': 24 * 60 * MIN, 'keepWarmFor:sessions': [['s-1', 30 * MIN], ['other', 45 * MIN]] })
  expect((await $.command.run({ command: 'keepalive', args: 'clear' })).text).toContain('now keep warm 1d (this machine, /keepalive)')
  expect((await $.command.run({ command: 'keepalive', args: 'clear --machine' })).text).toContain('now keep warm 8h (/config)')
  expect((await $.command.run({ command: 'keepalive', args: '' })).text).toContain('keep warm 8h (/config)')
})

test('a malformed store value is ignored: a non-positive machine override and bad session rows', async ($, on) => {
  const { seen } = engine(on, 1, { 'keepWarmFor:machine': 0, 'keepWarmFor:sessions': [['s-1', 'soon'], 'junk', [7, 5]] })
  await $.classic.Stop({ background_tasks: [task] } as never)
  expect(seen.statuses.at(-1)).toContain('keep warm 8h')
})

test('only the newest 20 session overrides are kept', async ($, on) => {
  const old = Array.from({ length: 20 }, (_, i) => [`old-${i}`, (i + 1) * MIN])
  let id = 's-1'
  engine(on, 1, { 'keepWarmFor:sessions': old }, () => id)
  await $.command.run({ command: 'keepalive', args: '2h' })
  // s-1 is stored and the oldest row, old-0, is dropped; old-1 survives
  id = 'old-0'
  expect((await $.command.run({ command: 'keepalive', args: '' })).text).toContain('keep warm 8h (/config)')
  id = 'old-1'
  expect((await $.command.run({ command: 'keepalive', args: '' })).text).toContain('keep warm 2m (this session, /keepalive)')
  id = 's-1'
  expect((await $.command.run({ command: 'keepalive', args: '' })).text).toContain('keep warm 2h (this session, /keepalive)')
})

test('a machine override of 0 minutes is never stored: a zero duration is a usage error', async ($, on) => {
  const { seen } = engine(on)
  const { text } = await $.command.run({ command: 'keepalive', args: '0m --machine' })
  expect(text).toContain('is not a duration')
  expect(seen.forks).toBe(0)
})

// Added in review round 3 of AAW-20261021-mods-config.

test('a keepWarmFor under 1m in /config falls back to 8h and the log states the 1m minimum', { options: { keepWarmFor: '0.4m' } }, async ($, on) => {
  const { seen } = engine(on)
  on('command.register', () => ({ value: { command: 'keepalive' } }) as never)
  on('session.start', (_, e) => e as never)
  await $.session.start({ source: 'startup', cwd: '/work' } as never)
  expect(seen.logs.some(l => l.includes('keepWarmFor "0.4m" in /config is not a duration (<n>m, <n>h or <n>d, at least 1m); using 8h'))).toBe(true)
})

test('a keep-warm duration of exactly 50m sends no ping either', { options: { keepWarmFor: '50m' } }, async ($, on) => {
  const { seen, clock } = engine(on)
  await $.classic.Stop({ background_tasks: [task] } as never)
  await clock.fire(50) // the first ping is due at 50 minutes, when the 50 minutes are spent
  expect(seen.forks).toBe(0)
  expect(seen.statuses.at(-1)).toMatch(/^keepalive: no ping needed for 50m, stopped/)
})
