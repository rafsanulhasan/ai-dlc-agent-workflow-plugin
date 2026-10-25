import { describe, expect, test } from 'claude-code/testing'
import { DEFAULTS, DEFAULT_SESSION_PREFIX, SETTINGS, TRUST_GATED, baseName, numbering, numberingNotice, parseTitle, check, normPath, repoConfig, resolveConfig, sessionName, settingsEnv, transcriptTitle, trustOf, trustRoot, withoutGated, withoutKeys, parseBool, PREVIEW_CHARS, previewValue, keysWithValues } from '../config.ts'
import { parseAddress } from '../server.ts'
import type { Level } from '../config.ts'

const env = (where: string, values: Record<string, unknown>): Level => ({ where, byEnv: true, values })
const file = (values: Record<string, unknown>): Level => ({ where: '.ai-dlc/auto-handoff.json', byEnv: false, values })

describe('resolveConfig', () => {
  test('the first level with a valid value wins, then the default', () => {
    const levels = [
      env('.claude/settings.local.json', { AI_DLC_AUTO_HANDOFF_MAX_CONSECUTIVE: '7' }),
      env('.claude/settings.json', { AI_DLC_AUTO_HANDOFF_MAX_CONSECUTIVE: 6, AI_DLC_AUTO_HANDOFF_THRESHOLD_PERCENT: 70 }),
      env('the environment', { AI_DLC_AUTO_HANDOFF_THRESHOLD_PERCENT: '60', AI_DLC_AUTO_HANDOFF_VIEWER: 'tailscale:3846' }),
      file({ thresholdPercent: 50, viewer: '', briefTemplate: '/repo/brief.md' }),
    ]
    const { cfg, sources } = resolveConfig(levels)
    expect(cfg.maxUnattended).toBe(7)
    expect(sources.maxConsecutiveHandoffs).toBe('AI_DLC_AUTO_HANDOFF_MAX_CONSECUTIVE in .claude/settings.local.json')
    expect(cfg.thresholdPercent).toBe(70)
    expect(cfg.viewer).toBe('tailscale:3846')
    expect(cfg.briefTemplate).toBe('/repo/brief.md')
    expect(sources.briefTemplate).toBe('briefTemplate in .ai-dlc/auto-handoff.json')
    expect(cfg.instructionsTemplate).toBe(DEFAULTS.instructionsTemplate)
    expect(sources.instructionsTemplate).toBe('default')
    expect(cfg.seedHeadroomTokens).toBe(40_000)
    expect(sources.seedHeadroomTokens).toBe('default')
  })

  test('an invalid value is reported and falls through to the next level', () => {
    const levels = [
      env('.claude/settings.local.json', { AI_DLC_AUTO_HANDOFF_THRESHOLD_PERCENT: '150', AI_DLC_AUTO_HANDOFF_ENABLED: 'maybe' }),
      file({ thresholdPercent: 'eighty', ignoreFiles: '(' }),
    ]
    const { cfg, sources, warnings } = resolveConfig(levels)
    expect(cfg.thresholdPercent).toBe(80)
    expect(sources.thresholdPercent).toBe('default')
    expect(cfg.enabled).toBe(true)
    expect(cfg.ignoreFiles).toBeUndefined()
    expect(warnings).toEqual([
      'AI_DLC_AUTO_HANDOFF_ENABLED="maybe" in .claude/settings.local.json ignored: not a valid boolean; falling back to the next source',
      'AI_DLC_AUTO_HANDOFF_THRESHOLD_PERCENT="150" in .claude/settings.local.json ignored: not a valid percent; falling back to the next source',
      'thresholdPercent="eighty" in .ai-dlc/auto-handoff.json ignored: not a valid percent; falling back to the next source',
      'ignoreFiles="(" in .ai-dlc/auto-handoff.json ignored: not a valid pattern; falling back to the next source',
    ])
  })

  test('unset is not invalid: null, a missing key or a blank environment value fall through quietly', () => {
    const { cfg, warnings } = resolveConfig([env('x', { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '  ' }), file({ thresholdTokens: null })])
    expect(cfg.thresholdTokens).toBeUndefined()
    expect(warnings).toEqual([])
  })

  test('a blank viewer or ignoreFiles in the file is a value: no server, no pattern', () => {
    const { cfg, sources } = resolveConfig([file({ viewer: '', ignoreFiles: '' })])
    expect(cfg.viewer).toBe('')
    expect(sources.viewer).toBe('viewer in .ai-dlc/auto-handoff.json')
    expect(cfg.ignoreFiles).toBeUndefined()
  })

  test('with nothing set, the defaults', () => {
    const { cfg } = resolveConfig([])
    expect(cfg).toEqual(DEFAULTS)
  })

  test('every setting has its own key and AI_DLC_AUTO_HANDOFF_ variable', () => {
    expect(new Set(SETTINGS.map(s => s.key)).size).toBe(SETTINGS.length)
    expect(SETTINGS.every(s => s.env.startsWith('AI_DLC_AUTO_HANDOFF_'))).toBe(true)
  })
})

describe('check', () => {
  test('booleans, whole numbers and ranges', () => {
    expect(check('boolean', 'FALSE', true)).toBe(false)
    expect(check('boolean', 'yes', true)).toBe(true)
    expect(check('boolean', 1, false)).toBeUndefined()
    expect(check('percent', 100, false)).toBe(100)
    expect(check('percent', 0, false)).toBeUndefined()
    expect(check('percent', 50.5, false)).toBeUndefined()
    expect(check('positive', '007', true)).toBeUndefined()
    expect(check('positive', ' 20000 ', true)).toBe(20000)
    expect(check('whole', 0, false)).toBe(0)
    expect(check('whole', -1, false)).toBeUndefined()
    expect(check('text', '', false)).toBeUndefined()
    expect(check('path', null, false)).toBeNull()
  })
})

describe('settings files', () => {
  test('settingsEnv reads env from JSONC, and says what is wrong with a broken file', () => {
    expect(settingsEnv('﻿{ // c\n "env": { "A": "1" } /* x */ }').env).toEqual({ A: '1' })
    expect(settingsEnv('{ "url": "http://x//y" }')).toEqual({})
    expect(settingsEnv(undefined)).toEqual({})
    expect(settingsEnv('{').problem).toContain('not valid JSON')
    expect(settingsEnv('[1]').problem).toContain('not an object')
    expect(settingsEnv('{ "env": [] }').problem).toContain('env is not an object')
  })

  test('repoConfig reads the file and rejects a non-object', () => {
    expect(repoConfig('{ "enabled": false }').values).toEqual({ enabled: false })
    expect(repoConfig('nope').problem).toContain('not valid JSON')
    expect(repoConfig('3').problem).toContain('not an object')
    expect(repoConfig(undefined)).toEqual({})
  })
})

describe('session names', () => {
  const P = '[ai-dlc:auto-handoff]'
  test('sessionName wraps a base name with the prefix and the number', () => {
    expect(sessionName(P, 'Fix it', 3)).toBe('[ai-dlc:auto-handoff]: Fix it (Session 3)')
  })

  test('AC-16.3.4 baseName takes off nested wrappers', () => {
    expect(baseName(`${P}: B`, P)).toBe('B')
    expect(baseName(`${P}: B (Session 2)`, P)).toBe('B')
    expect(baseName(`${P}: B (Session 1) (Session 2)`, P)).toBe('B')
  })

  test('baseName takes off every chain wrapper, so names never nest', () => {
    expect(baseName('Fix it', P)).toBe('Fix it')
    expect(baseName('[ai-dlc:auto-handoff]: Fix it (Session 2)', P)).toBe('Fix it')
    expect(baseName('[ai-dlc:auto-handoff]: [ai-dlc:auto-handoff]: Fix it (Session 1) (Session 2)', P)).toBe('Fix it')
    expect(baseName('[x]: Fix it (Session 2)', '[x]')).toBe('Fix it')
    expect(baseName('  ', P)).toBeUndefined()
    expect(baseName(undefined, P)).toBeUndefined()
  })

  test('transcriptTitle takes the last custom-title, else the last ai-title', () => {
    const line = (o: object) => JSON.stringify(o)
    expect(transcriptTitle([line({ type: 'ai-title', aiTitle: 'A1' }), line({ type: 'custom-title', customTitle: 'C1' }), line({ type: 'ai-title', aiTitle: 'A2' }), line({ type: 'custom-title', customTitle: 'C2' })].join('\n'))).toBe('C2')
    expect(transcriptTitle([line({ type: 'ai-title', aiTitle: 'A1' }), line({ type: 'ai-title', aiTitle: 'A2' })].join('\n'))).toBe('A2')
    expect(transcriptTitle('{"type":"user"}\nnot json -title"')).toBeUndefined()
  })
})

describe('session numbering (root 16)', () => {
  const P = DEFAULT_SESSION_PREFIX
  test('the default prefix is the one the settings default to', () => {
    expect(P).toBe('[ai-dlc:auto-handoff]')
    expect(P).toBe(DEFAULTS.sessionNamePrefix)
  })

  test('AC-16.2.2 parseTitle reads the number of a trailing (Session n)', () => {
    expect(parseTitle(`${P}: B (Session 7)`, P)).toEqual({ base: 'B', number: 7 })
    expect(parseTitle(`${P}: B (Session 1) (Session 2)`, P)).toEqual({ base: 'B', number: 2 })
    expect(parseTitle(`${P}: B (Session 3)  `, P)).toEqual({ base: 'B', number: 3 })
  })

  test('AC-16.3.5 parseTitle reads a numbered title without the prefix', () => {
    expect(parseTitle('B (Session 3)', P)).toEqual({ base: 'B', number: 3 })
  })

  test('AC-16.3.1 parseTitle strips the prefix of a title without a number', () => {
    expect(parseTitle(`${P}: B`, P)).toEqual({ base: 'B' })
    expect(parseTitle('B', P)).toEqual({ base: 'B' })
  })

  test('AC-16.3.3 parseTitle strips the default prefix and the one in force, and keeps any other X:', () => {
    expect(parseTitle(`${P}: B (Session 3)`, '[handoff]')).toEqual({ base: 'B', number: 3 })
    expect(parseTitle('[handoff]: B (Session 3)', '[handoff]')).toEqual({ base: 'B', number: 3 })
    expect(parseTitle('X: B (Session 3)', P)).toEqual({ base: 'X: B', number: 3 })
    expect(sessionName('[handoff]', parseTitle('X: B (Session 3)', '[handoff]').base!, 4)).toBe('[handoff]: X: B (Session 4)')
  })

  test('parseTitle edge cases: only wrappers, Session 0, huge numbers, blanks, regex characters', () => {
    expect(parseTitle(`${P}: (Session 3)`, P)).toEqual({ number: 3 })
    expect(parseTitle('Fix (Session 0)', P)).toEqual({ base: 'Fix' })
    expect(parseTitle(`Fix (Session ${'9'.repeat(30)})`, P)).toEqual({ base: 'Fix' })
    expect(parseTitle('   ', P)).toEqual({})
    expect(parseTitle(undefined, P)).toEqual({})
    expect(parseTitle('a.b*: B (Session 2)', 'a.b*')).toEqual({ base: 'B', number: 2 })
    expect(parseTitle('aXb*: B (Session 2)', 'a.b*')).toEqual({ base: 'aXb*: B', number: 2 })
  })

  test('AC-16.2.8 numbering: the title number, else the lineage depth, else 1 (the main session)', () => {
    expect(numbering(7, 2)).toEqual({ current: 7, next: 8, isMain: false, source: 'title' })
    expect(numbering(3, undefined)).toEqual({ current: 3, next: 4, isMain: false, source: 'title' })
    expect(numbering(undefined, 3)).toEqual({ current: 3, next: 4, isMain: false, source: 'lineage' })
    expect(numbering(undefined, undefined)).toEqual({ current: 1, next: 2, isMain: true, source: 'default' })
  })

  test('AC-16.2.5b numbering after a failed read is never the main session', () => {
    expect(numbering(undefined, undefined, true)).toEqual({ current: 1, next: 2, isMain: false, source: 'default' })
    expect(numbering(3, undefined, true)).toEqual({ current: 3, next: 4, isMain: false, source: 'title' })
  })

  test('AC-16.2.5 numberingNotice text for both sources', () => {
    const t = numberingNotice('s1', 'Error: boom', numbering(3, undefined, true))
    expect(t.log).toBe('numbering fallback: lineage read failed session=s1 (Error: boom); number 3 taken from the title (Session 3), chain id restarted')
    expect(t.step).toEqual({ mark: 'warn', text: 'numbering: store unreadable, number taken from the title, chain id restarted' })
    expect(t.toast).toBe(t.step.text)
    const d = numberingNotice('s1', 'Error: boom', numbering(undefined, undefined, true))
    expect(d.log).toBe('numbering fallback: lineage read failed session=s1 (Error: boom); number defaulted to 1, the title has none, chain id restarted, session not renamed')
    expect(d.step.text).toBe('numbering: store unreadable, number defaulted to 1, chain id restarted, session not renamed')
    expect(d.log.split('numbering fallback:').length - 1).toBe(1)
  })
})

describe('viewer address (W2)', () => {
  test('check accepts blank or host:port and rejects anything else', () => {
    expect(check('address', ' ', false)).toBe('')
    expect(check('address', 'tailscale:3846', false)).toBe('tailscale:3846')
    expect(check('address', ' 127.0.0.1:8080 ', true)).toBe('127.0.0.1:8080')
    for (const bad of ['foo', 'host:', ':80', 'host:0080', 'host:70000', 'host:8', 'a b:80', 'http://x:80']) expect(check('address', bad, false)).toBeUndefined()
    expect(check('address', 80, false)).toBeUndefined()
  })

  test('parseAddress takes ports 10 to 65535 with no leading zero', () => {
    expect(parseAddress('localhost:65535')).toEqual({ host: 'localhost', port: '65535' })
    expect(parseAddress('localhost:65536')).toBeUndefined()
    expect(parseAddress('localhost:10')).toEqual({ host: 'localhost', port: '10' })
    expect(parseAddress('localhost:01')).toBeUndefined()
  })

  test('a bad viewer in a settings file is logged and falls through', () => {
    const { cfg, warnings } = resolveConfig([env('.claude/settings.json', { AI_DLC_AUTO_HANDOFF_VIEWER: 'foo' })])
    expect(cfg.viewer).toBe('')
    expect(warnings).toEqual(['AI_DLC_AUTO_HANDOFF_VIEWER="foo" in .claude/settings.json ignored: not a valid address; falling back to the next source'])
  })
})

// The automatic handoff has no /config rows (human decision, 2026-10-23, run AAW-20261022-cache-keepalive-init):
// resolveConfig takes the levels alone, and no setting names a userConfig key.
describe('resolution order, level by level', () => {
  const KEY = 'AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS'
  const levels = (...present: number[]): Level[] => [
    env('.claude/settings.local.json', { [KEY]: '30000' }),
    env('.claude/settings.json', { [KEY]: '40000' }),
    env('the environment', { [KEY]: '50000' }),
    file({ thresholdTokens: 60000 }),
  ].filter((_, i) => present.includes(i))
  const expected = [[30000, '.claude/settings.local.json'], [40000, '.claude/settings.json'], [50000, 'the environment'], [60000, '.ai-dlc/auto-handoff.json']] as const

  test('each level beats every level below it, and the source names it', () => {
    for (let top = 0; top < 4; top++) {
      const { cfg, sources } = resolveConfig(levels(...[0, 1, 2, 3].filter(i => i >= top)))
      expect(cfg.thresholdTokens).toBe(expected[top]![0])
      expect(sources.thresholdTokens).toContain(expected[top]![1])
    }
  })

  test('a level whose value is invalid is skipped and the next one wins, for every level', () => {
    for (let top = 0; top < 3; top++) {
      const ls = levels(0, 1, 2, 3)
      for (let i = 0; i <= top; i++) ls[i] = env(ls[i]!.where, { [KEY]: 'lots' })
      const { cfg, warnings } = resolveConfig(ls)
      expect(cfg.thresholdTokens).toBe(expected[top + 1]![0])
      for (let i = 0; i <= top; i++) expect(warnings.some(w => w.includes(ls[i]!.where) && w.includes('lots'))).toBe(true)
    }
  })

  test('a former /config row is not a level: resolveConfig takes only the levels given, and a key like userConfig changes nothing', () => {
    const { cfg, sources } = resolveConfig([file({ userConfig: { thresholdPercent: 10 }, thresholdPercent: 70 } as never)])
    expect(cfg.thresholdPercent).toBe(70)
    expect(resolveConfig([]).cfg.thresholdPercent).toBe(DEFAULTS.thresholdPercent)
    expect(Object.values(sources).some(v => /config/i.test(v) && !/auto-handoff.json/.test(v))).toBe(false)
  })
})

describe('workspace trust (W1)', () => {
  const json = (projects: Record<string, unknown>) => JSON.stringify({ numStartups: 3, projects })
  const yes = { hasTrustDialogAccepted: true }
  const no = { hasTrustDialogAccepted: false }

  test('the repository root is trusted only by its own entry being exactly true', () => {
    expect(trustOf(json({ 'e:/Projects/app': yes }), { root: 'e:/Projects/app' })).toEqual({ trusted: true, why: '' })
    expect(trustOf(json({ 'e:/Projects/app': no }), { root: 'e:/Projects/app' })).toEqual({ trusted: false, why: 'the folder is not marked trusted' })
    expect(trustOf(json({ 'e:/Projects/app': { hasTrustDialogAccepted: 'true' } }), { root: 'e:/Projects/app' }).trusted).toBe(false)
    expect(trustOf(json({ 'e:/Projects/app': { hasTrustDialogAccepted: 1 } }), { root: 'e:/Projects/app' }).trusted).toBe(false)
    expect(trustOf(json({ 'e:/Projects/other': yes }), { root: 'e:/Projects/app' })).toEqual({ trusted: false, why: 'the folder has no entry' })
  })

  test('keys match case-insensitively, with either separator, a trailing slash and a lowercase drive', () => {
    for (const key of ['E:\\Projects\\App', 'e:/projects/app/', 'E:/Projects/App', 'e:\\projects\\app\\']) {
      expect(trustOf(json({ [key]: yes }), { root: 'E:/Projects/app' }).trusted).toBe(true)
    }
    expect(normPath('E:\\A\\b\\')).toBe('e:/a/b')
  })

  test('one true entry among differently spelled ones is enough', () => {
    expect(trustOf(json({ 'E:\\app': no, 'e:/app': yes }), { root: 'e:/app' }).trusted).toBe(true)
  })

  test('a nested repository is not trusted by its parent repository', () => {
    expect(trustOf(json({ '/work/app': yes }), { root: '/work/app/vendor/lib' }).trusted).toBe(false)
  })

  test('outside a repository, the start folder or any folder above it holds trust', () => {
    expect(trustOf(json({ '/work': yes }), { start: '/work/notes/today' }).trusted).toBe(true)
    expect(trustOf(json({ '/work/notes/today': yes }), { start: '/work/notes/today' }).trusted).toBe(true)
    expect(trustOf(json({ '/': yes }), { start: '/work' }).trusted).toBe(true)
    expect(trustOf(json({ '/work/notes/today/deeper': yes }), { start: '/work/notes/today' }).trusted).toBe(false)
    expect(trustOf(json({ 'C:/Users/me': yes, 'c:/users/me/scratch': no }), { start: 'C:\\Users\\me\\scratch' }).trusted).toBe(true)
  })

  test('fails closed on a missing file, bad JSON or no projects', () => {
    expect(trustOf(undefined, { root: '/a' })).toEqual({ trusted: false, why: '~/.claude.json was not readable' })
    expect(trustOf('{ nope', { root: '/a' })).toEqual({ trusted: false, why: '~/.claude.json is not valid JSON' })
    expect(trustOf('{}', { root: '/a' })).toEqual({ trusted: false, why: '~/.claude.json has no projects' })
    expect(trustOf('{"projects": []}', { root: '/a' }).trusted).toBe(false)
    expect(trustOf('null', { root: '/a' }).trusted).toBe(false)
    expect(trustOf(json({ '/a': null }), { root: '/a' }).trusted).toBe(false)
  })

  test('the reason never carries the file content', () => {
    const other = JSON.stringify({ oauthAccount: { emailAddress: 'x@y' }, projects: { '/a': no } })
    expect(trustOf(other, { root: '/a' }).why).not.toContain('x@y')
  })

  test('trustRoot: a linked worktree is keyed on the main checkout, anything else on its own top level', () => {
    expect(trustRoot('E:/repo/.worktrees/fix', 'E:/repo/.git')).toBe('E:/repo')
    expect(trustRoot('E:/repo', 'E:/repo/.git')).toBe('E:/repo')
    expect(trustRoot('E:/repo', 'e:\\repo\\.git\\')).toBe('E:/repo')
    expect(trustRoot('/super/sub', '/super/.git/modules/sub')).toBe('/super/sub')
    expect(trustRoot('/x', undefined)).toBe('/x')
  })

  test('withoutGated takes out only the set trust-gated keys', () => {
    expect([...TRUST_GATED]).toEqual(['briefTemplate', 'instructionsTemplate', 'viewer'])
    const values = { viewer: '0.0.0.0:3846', briefTemplate: '/x.md', instructionsTemplate: null, thresholdPercent: 70 }
    expect(withoutGated(values)).toEqual({ values: { instructionsTemplate: null, thresholdPercent: 70 }, ignored: ['briefTemplate', 'viewer'] })
    const plain = { thresholdPercent: 70 }
    expect(withoutGated(plain)).toEqual({ values: plain, ignored: [] })
  })
  test('[R6] parseBool: booleans and their words, any case, spaces ignored; anything else is undefined, own keys only', () => {
    expect(parseBool(true)).toBe(true)
    expect(parseBool(false)).toBe(false)
    for (const w of ['true', '1', 'yes', 'on', ' TRUE ', 'On']) expect(parseBool(w)).toBe(true)
    for (const w of ['false', '0', 'no', 'off', ' Off ', 'NO']) expect(parseBool(w)).toBe(false)
    for (const w of ['', 'maybe', 'constructor', '__proto__', 'toString']) expect(parseBool(w)).toBeUndefined()
    for (const v of [1, 0, null, undefined, {}, []]) expect(parseBool(v)).toBeUndefined()
  })

  test('[R6] withoutKeys: dotted keys take out one nested level, copies only, missing and null keys are not ignored', () => {
    const values = { a: 1, b: null, n: { x: 1, y: 2 }, keep: 'k' }
    const before = JSON.stringify(values)
    const out = withoutKeys(values, ['a', 'b', 'c', 'n.x', 'm.z'])
    expect(out).toEqual({ values: { b: null, n: { y: 2 }, keep: 'k' }, ignored: ['a', 'n.x'] })
    expect(JSON.stringify(values)).toBe(before)
    expect(out.values.n).not.toBe(values.n)
    const plain = { keep: 1 }
    expect(withoutKeys(plain, ['a'])).toEqual({ values: plain, ignored: [] })
    expect(withoutKeys(plain, ['a']).values).toBe(plain)
  })

  test('previewValue: text quoted, other values as JSON, white space folded, long values cut with their length', () => {
    expect(previewValue('0.0.0.0:3846')).toBe('"0.0.0.0:3846"')
    expect(previewValue(false)).toBe('false')
    expect(previewValue(3)).toBe('3')
    expect(previewValue('a\n\t b')).toBe('"a b"')
    expect(previewValue('x'.repeat(PREVIEW_CHARS))).toBe(`"${'x'.repeat(PREVIEW_CHARS)}"`)
    expect(previewValue('x'.repeat(PREVIEW_CHARS + 1))).toBe(`"${'x'.repeat(PREVIEW_CHARS)}…" (${PREVIEW_CHARS + 1} chars)`)
    expect(previewValue({ a: 'y'.repeat(60) })).toBe(`{"a":"${'y'.repeat(PREVIEW_CHARS - 6)}… (68 chars)`)
  })

  test('previewValue: cuts on code points, so a character outside the BMP is never split into a lone surrogate', () => {
    // 39 x's then an emoji (two UTF-16 units) at the 40th character: a cut by code unit kept half of it.
    const value = `${'x'.repeat(PREVIEW_CHARS - 1)}😀${'z'.repeat(10)}`
    const out = previewValue(value)
    expect(out).toBe(`"${'x'.repeat(PREVIEW_CHARS - 1)}😀…" (${PREVIEW_CHARS + 10} chars)`)
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(out)).toBe(false)
    // Exactly PREVIEW_CHARS characters, one of them an emoji (41 code units), is not cut.
    expect(previewValue(`${'x'.repeat(PREVIEW_CHARS - 1)}😀`)).toBe(`"${'x'.repeat(PREVIEW_CHARS - 1)}😀"`)
  })

  test('previewValue: (N chars) counts the folded text that was cut, not the raw value', () => {
    // 50 characters of text with a run of 11 white-space characters: 61 raw, 51 after folding.
    const value = `${'a'.repeat(25)}\n\n\t${' '.repeat(8)}${'b'.repeat(25)}`
    expect(value.length).toBe(61)
    expect(previewValue(value)).toBe(`"${'a'.repeat(25)} ${'b'.repeat(PREVIEW_CHARS - 26)}…" (51 chars)`)
  })

  test('keysWithValues: each key with its value, dotted keys read one nested level', () => {
    expect(keysWithValues({ viewer: '0.0.0.0:3846', n: { x: 2 } }, ['viewer', 'n.x'])).toBe('viewer="0.0.0.0:3846", n.x=2')
  })
})
