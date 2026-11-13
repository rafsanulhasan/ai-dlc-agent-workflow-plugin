import { describe, expect, test } from 'claude-code/testing'
import {
  BAND_TITLE,
  afterMasterPress,
  afterTrackPress,
  bandModel,
  hhmm,
  isOffPart,
  lineOf,
  masterOn,
  offTail,
  rowLineOf,
  reasonText,
  sourceLabel,
  trackOn,
} from '../cache-state'
import type { SessionSwitch } from '../cache-state'
import { bandText, masterState } from '../panel'

// ITEM-068 (T17.6; LLD rev 7 to 11): the off-line suffix and the source note, the session switches, the band
// and Pane model (step 44: no status-line summary). All pure, driven directly. Times are local, as the line writes them.

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
  test('[R44.3] a master press: reading on, its [off] sets the master off and clears both track switches; reading off, its [on] sets the master and both tracks on', () => {
    expect(afterMasterPress(true)).toEqual({ master: 'off' })
    expect(afterMasterPress(false)).toEqual({ master: 'on', '5m': 'on', '1h': 'on' })
  })
  test('[R44.3] [off] turns both tracks off whatever the settings say; [on] turns both on even one the setting turned off', () => {
    const off = afterMasterPress(true)
    expect(trackOn(off, '1h', true, true)).toBe(false)
    expect(trackOn(off, '5m', true, true)).toBe(false)
    const on = afterMasterPress(false)
    expect(masterOn(on, false)).toBe(true)
    expect(trackOn(on, '1h', false, false)).toBe(true)
    expect(trackOn(on, '5m', false, false)).toBe(true)
  })
})

describe('[R44.2] a track row: its status first, the button the opposite', () => {
  const tail = { cap: 20, keepWarm: '1h' }
  test('switched on and idle: "on, idle (<reason>)" and the off-line suffix', () => {
    expect(rowLineOf('5m', undefined, 'off (no 5m cache write seen)', true, tail)).toBe('keepalive 5m: on, idle (no 5m cache write seen), ping 0/20, keep warm 1h')
    expect(rowLineOf('5m', undefined, 'off', true, tail)).toBe('keepalive 5m: on, idle, ping 0/20, keep warm 1h')
  })
  test('switched off: "off" and its reason, never "on"', () => {
    expect(rowLineOf('5m', undefined, 'off (disabled)', false, tail)).toBe('keepalive 5m: off (disabled), ping 0/20, keep warm 1h')
    expect(rowLineOf('1h', undefined, 'off', false, { cap: 9, keepWarm: '8h', source: 'settings' })).toBe('keepalive 1h: off, ping 0/9, keep warm 8h (settings)')
  })
  test('a part that is not off is led by the switch: "on, <part>", or "off, <part>" for a track switched off', () => {
    expect(rowLineOf('1h', undefined, 'armed, 1 task(s), ping 0/9', true)).toBe('keepalive 1h: on, armed, 1 task(s), ping 0/9')
    expect(rowLineOf('1h', undefined, 'kept warm 8h, stopped', false)).toBe('keepalive 1h: off, kept warm 8h, stopped')
  })
  test('the cache part, when there is one, comes last, after a "; "', () => {
    expect(rowLineOf('5m', 'main warm until 10:05', 'off (no 5m cache write seen)', true, tail)).toBe('keepalive 5m: on, idle (no 5m cache write seen), ping 0/20, keep warm 1h; main warm until 10:05')
    expect(rowLineOf('5m', 'main warm until 10:05', 'armed', true)).toBe('keepalive 5m: on, armed; main warm until 10:05')
  })
  test('the published line is untouched: lineOf still leads with the cache part and never says "on,"', () => {
    expect(lineOf('5m', 'main warm until 10:05', 'off (disabled)', tail)).toBe('keepalive 5m: main warm until 10:05; off (disabled), ping 0/20, keep warm 1h')
  })
})

describe('[AC-17.6] [R44.2] [R44.3] the band and Pane model (Q-SL2, Q-SL5, Q-SL8)', () => {
  const rows = { '5m': { line: 'keepalive 5m: off (disabled)', enabled: false }, '1h': { line: 'keepalive 1h: on, armed', enabled: true } }
  test('title, then the 5m row before the 1h row, each button naming the press (the opposite of its enabled state)', () => {
    const m = bandModel(rows)
    expect(m.title).toBe(BAND_TITLE)
    expect(BAND_TITLE).toBe('⚠ ai-dlc cache-keepalive:')
    expect(m.rows).toEqual([{ track: '5m', line: 'keepalive 5m: off (disabled)', button: 'on' }, { track: '1h', line: 'keepalive 1h: on, armed', button: 'off' }])
    expect(m.seed).toBeUndefined()
  })
  const row = (enabled: boolean) => ({ line: 'x', enabled })
  for (const [a, b, on] of [[true, true, true], [true, false, true], [false, true, true], [false, false, false]] as const)
    test(`[R44.3] 5m ${a ? 'on' : 'off'}, 1h ${b ? 'on' : 'off'}: the head row reads ${on ? 'on' : 'off'} and its button is ${on ? 'off' : 'on'}`, () => {
      const m = bandModel({ '5m': row(a), '1h': row(b) })
      expect(m.on).toBe(on)
      expect(masterState(m)).toBe(on ? 'on' : 'off')
      expect(m.master).toBe(on ? 'off' : 'on')
    })
  test('[R44.2] each track button is the opposite of its own status, independent of the other track', () => {
    const m = bandModel({ '5m': row(true), '1h': row(false) })
    expect(m.rows.map(r => r.button)).toEqual(['off', 'on'])
  })
  test('the seed row only while the seed line shows', () => {
    expect(bandModel(rows, 'keepalive seed: cache hit, 47k read').seed).toBe('keepalive seed: cache hit, 47k read')
    expect('seed' in bandModel(rows)).toBe(false)
  })
  test('[R44.6] the seed row is kept only while a track is on: both tracks off drop it, either track on keeps it', () => {
    const row = (enabled: boolean) => ({ line: 'x', enabled })
    const seed = 'keepalive seed: cache hit, 47k read'
    expect('seed' in bandModel({ '5m': row(false), '1h': row(false) }, seed)).toBe(false)
    expect(bandModel({ '5m': row(true), '1h': row(false) }, seed).seed).toBe(seed)
    expect(bandModel({ '5m': row(false), '1h': row(true) }, seed).seed).toBe(seed)
    expect(bandModel({ '5m': row(true), '1h': row(true) }, seed).seed).toBe(seed)
    // the head row and the rows are untouched by the seed
    const off = bandModel({ '5m': row(false), '1h': row(false) }, seed)
    expect([off.on, off.master, off.rows.length]).toEqual([false, 'on', 2])
  })
  test('as plain text, one row per line with its button in brackets; the head row carries its status', () => {
    expect(bandText(bandModel(rows, 'keepalive seed: cache miss'))).toBe('⚠ ai-dlc cache-keepalive: on [off]\nkeepalive 5m: off (disabled) [on]\nkeepalive 1h: on, armed [off]\nkeepalive seed: cache miss')
    const none = bandModel({ '5m': row(false), '1h': row(false) })
    expect(bandText(none)).toBe('⚠ ai-dlc cache-keepalive: off [on]\nx [on]\nx [on]')
  })
})

// AC-17.8.3 (step 44, R44.2): a row's status and the switch in force agree, for all 18 combinations of the master (on, off,
// unset), the track's session switch (on, off, unset) and the settings' <track>.enabled (true, false). The oracle is written
// out from the order of *Track enabled for this session* (the track's switch, else the master's switch over the settings' enabled,
// and the track's own setting), not by calling `trackOn`; `trackOn` is then held to it.
describe('[AC-17.8.3] [R44.2] a row never reads on while its switch is off, nor off while it is on: all 18 combinations', () => {
  const switches = [undefined, 'on', 'off'] as const
  const inForce = (master: 'on' | 'off' | undefined, track: 'on' | 'off' | undefined, settingMaster: boolean, settingTrack: boolean): boolean => {
    if (track !== undefined) return track === 'on'
    const m = master !== undefined ? master === 'on' : settingMaster
    return m && settingTrack
  }
  for (const master of switches)
    for (const track of switches)
      for (const settingTrack of [true, false]) {
        test(`master ${master ?? 'unset'}, 5m switch ${track ?? 'unset'}, settings 5m.enabled ${settingTrack}: the row status is the switch in force`, () => {
          const sw: SessionSwitch = { ...(master ? { master } : {}), ...(track ? { '5m': track } : {}) }
          const want = inForce(master, track, true, settingTrack)
          const enabled = trackOn(sw, '5m', true, settingTrack)
          expect(enabled).toBe(want)
          const line = rowLineOf('5m', undefined, want ? 'armed' : 'off (disabled)', enabled)
          const m = bandModel({ '5m': { line, enabled }, '1h': { line: 'x', enabled: false } })
          if (want) {
            expect(line.startsWith('keepalive 5m: on')).toBe(true)
            expect(line.startsWith('keepalive 5m: off')).toBe(false)
            expect(m.rows[0]!.button).toBe('off')
          } else {
            expect(line.startsWith('keepalive 5m: off')).toBe(true)
            expect(line.startsWith('keepalive 5m: on')).toBe(false)
            expect(m.rows[0]!.button).toBe('on')
          }
        })
      }
  test('the master setting also decides when no switch is set: master setting off, track setting on, nothing switched: off', () => {
    expect(trackOn({}, '5m', false, true)).toBe(false)
    expect(trackOn({ master: 'on' }, '5m', false, false)).toBe(false)
    expect(trackOn({ master: 'on' }, '5m', false, true)).toBe(true)
  })
})

describe('hhmm', () => {
  test('hhmm: local H:MM with a two-digit minute and no padding on the hour', () => {
    expect(hhmm(T(9, 5))).toBe('9:05')
    expect(hhmm(T(0, 0))).toBe('0:00')
    expect(hhmm(T(23, 59))).toBe('23:59')
  })
})

// Step 42, 44: the minimised keep-alive band is one row: title, the status, the master button.
describe('[42.2] [R44.3] the minimised keep-alive band', () => {
  const row = (enabled: boolean) => ({ line: 'x', enabled })
  test('minimised, the band is one row: title, on|off and the master button; no track row, no seed row', () => {
    expect(bandText(bandModel({ '5m': row(false), '1h': row(true) }, 'keepalive seed: cache miss'), true)).toBe('⚠ ai-dlc cache-keepalive: on [off]')
    expect(bandText(bandModel({ '5m': row(false), '1h': row(false) }), true)).toBe('⚠ ai-dlc cache-keepalive: off [on]')
  })
  test('[R44.3] the minimised row reads on when either track is on, off when both are off; its button is the opposite', () => {
    for (const [a, b] of [[true, true], [true, false], [false, true]] as const) expect(bandText(bandModel({ '5m': row(a), '1h': row(b) }), true)).toBe('⚠ ai-dlc cache-keepalive: on [off]')
    expect(bandText(bandModel({ '5m': row(false), '1h': row(false) }), true)).toBe('⚠ ai-dlc cache-keepalive: off [on]')
  })
  test('not minimised (the default and the Pane) is the full band', () => {
    const m = bandModel({ '5m': row(true), '1h': row(false) })
    expect(bandText(m, false)).toBe(bandText(m))
    expect(bandText(m).split('\n')).toHaveLength(3)
  })
})
