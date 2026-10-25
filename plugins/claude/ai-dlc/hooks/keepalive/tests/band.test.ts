import { describe, expect, test } from 'claude-code/testing'
import {
  BAND_TITLE,
  SUMMARY_MAX,
  afterMasterPress,
  afterTrackPress,
  bandModel,
  hhmm,
  isOffPart,
  lineOf,
  masterOn,
  offTail,
  reasonText,
  sourceLabel,
  statusModeOf,
  statusTextOf,
  summaryOf,
  surfaceMode,
  trackOn,
} from '../cache-state.ts'
import type { SessionSwitch, TrackFacts } from '../cache-state.ts'
import { bandText } from '../panel.tsx'

// ITEM-068 (T17.6; LLD rev 7 to 11): the off-line suffix and the source note, the session switches, the band
// and Pane model, and the status-line summary. All pure, driven directly. Times are local, as the line writes them.

const T = (h: number, m: number) => new Date(2026, 9, 25, h, m).getTime()

describe('[AC-17.6] the off line: reason, then "ping 0/<cap>, keep warm <time> (<source>)"', () => {
  test('an off part gets the suffix; the source note is optional', () => {
    expect(lineOf('1h', undefined, 'off (disabled)', { cap: 9, keepWarm: '8h', source: 'default' })).toBe('keepalive 1h: off (disabled), ping 0/9, keep warm 8h (default)')
    expect(lineOf('5m', undefined, 'off (disabled)', { cap: 20, keepWarm: '1h' })).toBe('keepalive 5m: off (disabled), ping 0/20, keep warm 1h')
  })
  test('with a cache part the suffix still ends the line, after the reason', () => {
    expect(lineOf('1h', 'main warm until 10:05', 'off (no background tasks)', { cap: 9, keepWarm: '8h', source: 'session' }))
      .toBe('keepalive 1h: main warm until 10:05; off (no background tasks), ping 0/9, keep warm 8h (session)')
  })
  test('a part that is not off, an armed or a stopped track, gets no suffix', () => {
    const tail = { cap: 9, keepWarm: '8h', source: 'default' as const }
    for (const part of ['armed, 1 task(s), warm until 10:05, ping 0/9, keep warm 8h (default)', 'kept warm 8h, stopped, warm until 10:00', 'expired, stopped', 'missed, stopped']) expect(lineOf('1h', undefined, part, tail)).toBe(`keepalive 1h: ${part}`)
  })
  test('without a tail the line is as before ITEM-068', () => {
    expect(lineOf('1h', undefined, 'off (disabled)')).toBe('keepalive 1h: off (disabled)')
  })
  test('isOffPart: "off" alone or "off ..." only; every reasonText is off, a stopped text is not', () => {
    expect(isOffPart('off')).toBe(true)
    expect(isOffPart('off in overage')).toBe(true)
    for (const r of ['noTasks', 'expired', 'turnRunning', 'sessionEnded', 'onlySubagents', 'disabled', 'noSplit', 'overage'] as const) expect(isOffPart(reasonText(r))).toBe(true)
    expect(isOffPart(reasonText({ noWrite: '5m' }))).toBe(true)
    for (const p of ['offline', 'expired, stopped', 'armed', 'ping limit 9 reached, stopped', 'official']) expect(isOffPart(p)).toBe(false)
  })
  test('offTail writes the cap, the keep-warm time and the note', () => {
    expect(offTail({ cap: 20, keepWarm: '90m', source: 'machine' })).toBe(', ping 0/20, keep warm 90m (machine)')
    expect(offTail({ cap: 1, keepWarm: '1m' })).toBe(', ping 0/1, keep warm 1m')
  })
  test('sourceLabel (AC-17.6.34): an override of this session or this machine, the default, else a settings level', () => {
    expect(sourceLabel({ from: 'this session (/ai-dlc:cache-keepalive)', override: true })).toBe('session')
    expect(sourceLabel({ from: 'this machine (/ai-dlc:cache-keepalive)', override: true })).toBe('machine')
    expect(sourceLabel({ from: 'default' })).toBe('default')
    expect(sourceLabel({ from: 'AI_DLC_KEEPALIVE_1H_KEEP_WARM_FOR in .claude/settings.local.json' })).toBe('settings')
    expect(sourceLabel({ from: '.ai-dlc/cache-keepalive.json' })).toBe('settings')
    // an override flag with a text that names neither is a settings level, not a guess
    expect(sourceLabel({ from: 'somewhere', override: true })).toBe('settings')
  })
})

describe('[AC-17.6] session switches: the master and one per track, this session only', () => {
  test('the master in force: the session switch, else the setting', () => {
    expect(masterOn({}, true)).toBe(true)
    expect(masterOn({}, false)).toBe(false)
    expect(masterOn({ master: 'off' }, true)).toBe(false)
    expect(masterOn({ master: 'on' }, false)).toBe(true)
  })
  test('a track in force: its switch over everything; else the master AND the track\'s own setting', () => {
    expect(trackOn({}, '1h', true, true)).toBe(true)
    expect(trackOn({}, '1h', true, false)).toBe(false)
    expect(trackOn({}, '1h', false, true)).toBe(false)
    expect(trackOn({ '1h': 'on' }, '1h', false, false)).toBe(true) // [on] overrides the master and the setting
    expect(trackOn({ '1h': 'off' }, '1h', true, true)).toBe(false)
    expect(trackOn({ master: 'off' }, '5m', true, true)).toBe(false)
    expect(trackOn({ master: 'on', '5m': 'off' }, '5m', false, true)).toBe(false)
    expect(trackOn({ '5m': 'off' }, '1h', true, true)).toBe(true) // the other track is untouched
  })
  test('a track press flips only that track: [off] on an enabled track, [on] on a disabled one', () => {
    expect(afterTrackPress({}, '5m', true)).toEqual({ '5m': 'off' })
    expect(afterTrackPress({ master: 'on', '1h': 'on' }, '5m', false)).toEqual({ master: 'on', '1h': 'on', '5m': 'on' })
  })
  test('a master [off] sets the master off and clears both track switches; [on] sets the master and both tracks on', () => {
    expect(afterMasterPress({ '1h': 'on', '5m': 'on' }, true)).toEqual({ master: 'off' })
    expect(afterMasterPress({}, false)).toEqual({ master: 'on', '5m': 'on', '1h': 'on' })
    expect(afterMasterPress({ master: 'off', '1h': 'off' }, true)).toEqual({ master: 'on', '5m': 'on', '1h': 'on' })
    expect(afterMasterPress({ master: 'on', '5m': 'off' }, false)).toEqual({ master: 'off' })
  })
  test('pressing the master twice returns to the setting\'s own state (off, then on)', () => {
    let sw: SessionSwitch = {}
    sw = afterMasterPress(sw, true)
    expect(masterOn(sw, true)).toBe(false)
    sw = afterMasterPress(sw, true)
    expect(masterOn(sw, true)).toBe(true)
    expect(trackOn(sw, '1h', true, false)).toBe(true) // [on] forces both tracks on, even one the setting turned off
  })
})

describe('[AC-17.6] the band and Pane model (Q-SL2, Q-SL5, Q-SL8)', () => {
  const rows = { '5m': { line: 'keepalive 5m: off (disabled)', enabled: false }, '1h': { line: 'keepalive 1h: armed', enabled: true } }
  test('title, the master button, then the 5m row before the 1h row, each button naming the press', () => {
    const m = bandModel('off', rows)
    expect(m.title).toBe(BAND_TITLE)
    expect(BAND_TITLE).toBe('⚠ ai-dlc cache-keepalive:')
    expect(m.master).toBe('off')
    expect(m.rows).toEqual([{ track: '5m', line: 'keepalive 5m: off (disabled)', button: 'on' }, { track: '1h', line: 'keepalive 1h: armed', button: 'off' }])
    expect(m.seed).toBeUndefined()
  })
  test('the seed row only while the seed line shows', () => {
    expect(bandModel('on', rows, 'keepalive seed: cache hit, 47k read').seed).toBe('keepalive seed: cache hit, 47k read')
    expect('seed' in bandModel('on', rows)).toBe(false)
  })
  test('as plain text, one row per line with its button in brackets', () => {
    expect(bandText(bandModel('off', rows, 'keepalive seed: cache miss'))).toBe('⚠ ai-dlc cache-keepalive: [off]\nkeepalive 5m: off (disabled) [on]\nkeepalive 1h: armed [off]\nkeepalive seed: cache miss')
    expect(bandText(bandModel('on', rows))).toBe('⚠ ai-dlc cache-keepalive: [on]\nkeepalive 5m: off (disabled) [on]\nkeepalive 1h: armed [off]')
  })
})

describe('[D13] the status-line summary', () => {
  const run1h: TrackFacts = { kind: 'running', warmUntil: T(10, 5), pings: 2, cap: 9 }
  const idle5m: TrackFacts = { kind: 'off', reason: 'noTasks' }
  test('running track: "<ttl> warm <H:MM>, ping k/m"; an idle one by its reason; the tracks 1h then 5m after "keepalive "', () => {
    expect(summaryOf({ '1h': run1h, '5m': idle5m }, undefined)).toBe('keepalive 1h warm 10:05, ping 2/9 | 5m idle (no tasks)')
  })
  test('before its first ping a running track names the first ping time instead of ping 0/m', () => {
    expect(summaryOf({ '1h': { kind: 'running', warmUntil: T(10, 5), pings: 0, cap: 9, firstPingAt: T(9, 50) }, '5m': idle5m }, undefined)).toBe('keepalive 1h warm 10:05, first ping 9:50 | 5m idle (no tasks)')
    // once a ping landed the clause goes
    expect(summaryOf({ '1h': { kind: 'running', warmUntil: T(10, 5), pings: 1, cap: 9, firstPingAt: T(9, 50) }, '5m': idle5m }, undefined)).toContain('ping 1/9')
  })
  const reasons: [TrackFacts, string][] = [
    [{ kind: 'off', reason: 'noSplit' }, '5m idle (no write yet)'],
    [{ kind: 'off', reason: { noWrite: '5m' } }, '5m idle (no write)'],
    [{ kind: 'off', reason: 'turnRunning' }, '5m idle (turn)'],
    [{ kind: 'off', reason: 'onlySubagents' }, '5m idle (subagents)'],
    [{ kind: 'off', reason: 'sessionEnded' }, '5m idle (ended)'],
    [{ kind: 'off', reason: 'disabled' }, '5m off'],
    [{ kind: 'off', reason: 'expired' }, '5m expired'],
    [{ kind: 'off', reason: 'overage' }, '5m off (overage)'],
    [{ kind: 'stopped', stop: 'ping limit' }, '5m stopped: ping limit'],
    [{ kind: 'stopped', stop: 'done', warmUntil: T(11, 0) }, '5m stopped: done, warm 11:00'],
    [{ kind: 'compaction', phase: 'compacting' }, '5m compacting'],
    [{ kind: 'compaction', phase: 'skipped' }, '5m compaction skipped'],
    [{ kind: 'compaction', phase: 'refused' }, '5m compaction refused'],
    [{ kind: 'compaction', phase: 'compacted' }, '5m compacted'],
  ]
  for (const [facts, token] of reasons) test(`the 5m token for ${JSON.stringify(facts)} is "${token}"`, () => expect(summaryOf({ '1h': idle5m, '5m': facts }, undefined)).toBe(`keepalive 1h idle (no tasks) | ${token}`))
  test('the seed token: "seed hit <k>" or "seed miss", while the line fits', () => {
    expect(summaryOf({ '1h': idle5m, '5m': idle5m }, { hit: true, tokens: 47000 })).toBe('keepalive 1h idle (no tasks) | 5m idle (no tasks) | seed hit 47k')
    expect(summaryOf({ '1h': idle5m, '5m': idle5m }, { hit: false })).toBe('keepalive 1h idle (no tasks) | 5m idle (no tasks) | seed miss')
  })
  test('the length rule: past 72 characters the seed token goes first, then every "warm <H:MM>" clause', () => {
    expect(SUMMARY_MAX).toBe(72)
    const a: TrackFacts = { kind: 'running', warmUntil: T(10, 5), pings: 3, cap: 9 }
    const b: TrackFacts = { kind: 'running', warmUntil: T(10, 7), pings: 12, cap: 20 }
    const seed = { hit: true as const, tokens: 123000 }
    const whole = summaryOf({ '1h': a, '5m': b }, seed)
    expect(whole).toBe('keepalive 1h warm 10:05, ping 3/9 | 5m warm 10:07, ping 12/20')
    const long: TrackFacts = { kind: 'stopped', stop: 'spend limit', warmUntil: T(10, 5) }
    const noSeed = summaryOf({ '1h': long, '5m': { kind: 'stopped', stop: 'spend limit', warmUntil: T(10, 7) } }, seed)
    expect(noSeed).not.toContain('seed')
    expect(noSeed.length).toBeLessThanOrEqual(SUMMARY_MAX)
    const tight = summaryOf({ '1h': { kind: 'running', warmUntil: T(10, 5), pings: 10, cap: 28, firstPingAt: undefined }, '5m': { kind: 'stopped', stop: 'spend limit', warmUntil: T(10, 7) } }, seed)
    expect(tight.length).toBeLessThanOrEqual(SUMMARY_MAX)
  })
  test('the summary never loses a track, whatever it drops', () => {
    const long: TrackFacts = { kind: 'stopped', stop: 'spend limit', warmUntil: T(10, 5) }
    const s = summaryOf({ '1h': long, '5m': long }, { hit: true, tokens: 999000 })
    expect(s.startsWith('keepalive 1h stopped: spend limit')).toBe(true)
    expect(s).toContain(' | 5m stopped: spend limit')
  })
})

describe('[D13] which text the status line carries', () => {
  const facts = { '1h': { kind: 'off', reason: 'noTasks' } as TrackFacts, '5m': { kind: 'off', reason: 'noTasks' } as TrackFacts }
  test('surfaceMode: full only when every surface is vscode and there is at least one', () => {
    expect(surfaceMode(['vscode'])).toBe('full')
    expect(surfaceMode(['vscode', 'vscode'])).toBe('full')
    expect(surfaceMode(['vscode', 'terminal'])).toBe('summary')
    expect(surfaceMode(['terminal'])).toBe('summary')
    expect(surfaceMode([])).toBe('summary')
  })
  test('statusModeOf: summary and full override the surface rule; auto is the surface rule', () => {
    expect(statusModeOf('summary', ['vscode'])).toBe('summary')
    expect(statusModeOf('full', ['terminal'])).toBe('full')
    expect(statusModeOf('auto', ['vscode'])).toBe('full')
    expect(statusModeOf('auto', ['terminal'])).toBe('summary')
  })
  test('statusTextOf: full is the full text unchanged; summary is summaryOf', () => {
    expect(statusTextOf('full', 'L1\nL2', facts, undefined)).toBe('L1\nL2')
    expect(statusTextOf('summary', 'L1\nL2', facts, undefined)).toBe(summaryOf(facts, undefined))
  })
  test('hhmm: local H:MM with a two-digit minute and no padding on the hour', () => {
    expect(hhmm(T(9, 5))).toBe('9:05')
    expect(hhmm(T(0, 0))).toBe('0:00')
    expect(hhmm(T(23, 59))).toBe('23:59')
  })
})
