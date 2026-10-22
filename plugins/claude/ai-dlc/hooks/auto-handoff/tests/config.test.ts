import { describe, expect, test } from 'claude-code/testing'
import { DEFAULTS, SETTINGS, TRUST_GATED, baseName, check, normPath, parseUserConfig, repoConfig, resolveConfig, sessionName, settingsEnv, transcriptTitle, trustOf, trustRoot, withoutGated } from '../config.ts'
import { parseAddress } from '../server.ts'
import type { Level } from '../config.ts'

const env = (where: string, values: Record<string, unknown>): Level => ({ where, byEnv: true, values })
const file = (values: Record<string, unknown>): Level => ({ where: '.ai-dlc/auto-handoff.json', byEnv: false, values })

describe('resolveConfig', () => {
  test('the first level with a valid value wins, then /config, then the default', () => {
    const levels = [
      env('.claude/settings.local.json', { AI_DLC_AUTO_HANDOFF_MAX_CONSECUTIVE: '7' }),
      env('.claude/settings.json', { AI_DLC_AUTO_HANDOFF_MAX_CONSECUTIVE: 6, AI_DLC_AUTO_HANDOFF_THRESHOLD_PERCENT: 70 }),
      env('the environment', { AI_DLC_AUTO_HANDOFF_THRESHOLD_PERCENT: '60', AI_DLC_AUTO_HANDOFF_VIEWER: 'tailscale:3846' }),
      file({ thresholdPercent: 50, viewer: '', briefTemplate: '/repo/brief.md' }),
    ]
    const { cfg, sources } = resolveConfig(levels, { thresholdPercent: 40, briefTemplate: '/mine.md', instructionsTemplate: '/i.md' })
    expect(cfg.maxUnattended).toBe(7)
    expect(sources.maxConsecutiveHandoffs).toBe('AI_DLC_AUTO_HANDOFF_MAX_CONSECUTIVE in .claude/settings.local.json')
    expect(cfg.thresholdPercent).toBe(70)
    expect(cfg.viewer).toBe('tailscale:3846')
    expect(cfg.briefTemplate).toBe('/repo/brief.md')
    expect(sources.briefTemplate).toBe('briefTemplate in .ai-dlc/auto-handoff.json')
    expect(cfg.instructionsTemplate).toBe('/i.md')
    expect(sources.instructionsTemplate).toBe('instructionsTemplate in /config')
    expect(cfg.seedHeadroomTokens).toBe(40_000)
    expect(sources.seedHeadroomTokens).toBe('default')
  })

  test('an invalid value is reported and falls through to the next level', () => {
    const levels = [
      env('.claude/settings.local.json', { AI_DLC_AUTO_HANDOFF_THRESHOLD_PERCENT: '150', AI_DLC_AUTO_HANDOFF_ENABLED: 'maybe' }),
      file({ thresholdPercent: 'eighty', ignoreFiles: '(' }),
    ]
    const { cfg, sources, warnings } = resolveConfig(levels, { thresholdPercent: 55 })
    expect(cfg.thresholdPercent).toBe(55)
    expect(sources.thresholdPercent).toBe('thresholdPercent in /config')
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
    const { cfg, warnings } = resolveConfig([env('x', { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '  ' }), file({ thresholdTokens: null })], {})
    expect(cfg.thresholdTokens).toBeUndefined()
    expect(warnings).toEqual([])
  })

  test('a blank viewer or ignoreFiles in the file is a value: no server, no pattern', () => {
    const { cfg, sources } = resolveConfig([file({ viewer: '', ignoreFiles: '' })], { viewer: 'tailscale:1', ignoreFiles: 'x' })
    expect(cfg.viewer).toBe('')
    expect(sources.viewer).toBe('viewer in .ai-dlc/auto-handoff.json')
    expect(cfg.ignoreFiles).toBeUndefined()
  })

  test('with nothing set, the defaults', () => {
    const { cfg } = resolveConfig([], {})
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
    const { cfg, warnings } = resolveConfig([env('.claude/settings.json', { AI_DLC_AUTO_HANDOFF_VIEWER: 'foo' })], {})
    expect(cfg.viewer).toBe('')
    expect(warnings).toEqual(['AI_DLC_AUTO_HANDOFF_VIEWER="foo" in .claude/settings.json ignored: not a valid address; falling back to the next source'])
  })
})

describe('/config warnings (W3)', () => {
  test('parseUserConfig warns for each clamped or dropped value and keeps the defaults', () => {
    const { cfg, warnings } = parseUserConfig({ thresholdPercent: 150, maxConsecutiveHandoffs: 0, briefTemplate: ' ', instructionsTemplate: '/i.md', ignoreFiles: '(', viewer: 'foo' })
    expect(cfg.thresholdPercent).toBe(100)
    expect(cfg.maxUnattended).toBe(2)
    expect(cfg.briefTemplate).toBe(DEFAULTS.briefTemplate)
    expect(cfg.instructionsTemplate).toBe('/i.md')
    expect(cfg.ignoreFiles).toBeUndefined()
    expect(cfg.viewer).toBe('')
    expect(warnings).toEqual({
      thresholdPercent: 'thresholdPercent=150 in /config clamped to 100',
      maxConsecutiveHandoffs: 'maxConsecutiveHandoffs=0 in /config ignored: not a positive number; using 2',
      briefTemplate: 'briefTemplate=" " in /config ignored: blank or not text; using "~/.claude/auto-handoff/brief.md"',
      ignoreFiles: 'ignoreFiles="(" in /config ignored: not a valid regular expression; using ""',
      viewer: 'viewer="foo" in /config ignored: not host:port; using ""',
    })
  })

  test('good, blank and missing /config values give no warning', () => {
    expect(parseUserConfig({ thresholdPercent: 70, maxConsecutiveHandoffs: 3, ignoreFiles: '', viewer: '' }).warnings).toEqual({})
    expect(parseUserConfig({}).warnings).toEqual({})
    expect(parseUserConfig({ thresholdPercent: 0.5 }).warnings.thresholdPercent).toBe('thresholdPercent=0.5 in /config clamped to 1')
  })

  test('resolveConfig reports a /config warning only when /config supplies the key', () => {
    expect(resolveConfig([], { thresholdPercent: 150 }).warnings).toEqual(['thresholdPercent=150 in /config clamped to 100'])
    expect(resolveConfig([file({ thresholdPercent: 70 })], { thresholdPercent: 150 }).warnings).toEqual([])
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
})
