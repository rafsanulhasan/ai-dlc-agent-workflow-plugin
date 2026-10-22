// Settings and the constants built on them. Engine-free: the host follows $ only into functions
// declared in register.tsx, so anything taking $ (reading the files, the environment) stays there.
import { parseAddress } from './server.ts'

export const BRIEF_DIR = '.claude/state/auto-handoff'
// Where this module sits inside the ai-dlc plugin; the shipped templates are under it.
export const MODULE_DIR = 'hooks/auto-handoff'
// The repository file that configures the module, relative to the repository root.
export const REPO_CONFIG = '.ai-dlc/auto-handoff.json'
// What the module learns about the running Claude Code at each session start: whether the built-in
// /rename exists and the engine version. /ai-dlc:init and /ai-dlc:configure-auto-handoff read it,
// because a model-run skill cannot call $.command.list() itself.
export const CAPABILITIES_FILE = 'capabilities.json'

// thresholdPercent: the share of the context window that triggers a handoff, 1 to 100. The line in
// tokens is thresholdPercent of the window $.session.usage() reports (contextLine below), or of
// defaultContextWindow when it reports none. thresholdTokens, when set, is an absolute line instead.
// seedHeadroomTokens and maxUnattended are loop guards. A seeded session must grow seedHeadroomTokens
// past its first-turn size (its floor) before it can hand off again, and, while no AI-DLC run is
// active, at most maxUnattended handoffs may run before the user types a prompt. With an active run
// that this session's chain claimed, the run state decides instead (chainWhileRunActive): the chain
// goes on while the run is active and ends when it is done, blocked or abandoned.
// 40k of headroom is the empirical line where a seeded session can read its brief and still do real
// work. The 2026-10-03 live run (threshold 20k, seeded sessions start at ~31k) chained six times
// with no guard; the 2026-10-04 run (a token threshold of 80000 left in a shell, floor ~45k) chained
// eight times with a guard of a quarter of the threshold, because max(80k, 45k + 20k) is still 80k,
// and 35k of room goes in reading the brief.
// The rest shape the brief: two template files and a pattern for files that never count as edits.
// viewer: where the mod serves the brief pages, "host:port"; "tailscale" as the host means this
// machine's Tailscale IP, or 127.0.0.1 without Tailscale. Blank: no server, and the link is the local file.
// viewer and the two templates apply from .ai-dlc/auto-handoff.json only in a trusted folder (TRUST_GATED).
export type Config = {
  enabled: boolean
  thresholdPercent: number
  thresholdTokens?: number
  defaultContextWindow: number
  seedHeadroomTokens: number
  maxUnattended: number
  chainWhileRunActive: boolean
  renameSessions: boolean
  sessionNamePrefix: string
  briefTemplate: string
  instructionsTemplate: string
  ignoreFiles?: RegExp
  viewer: string
}
export const MIN_HEADROOM = 40_000
// The window used when the host reports neither a window nor a percentage (human decision, 2026-10-21).
export const DEFAULT_WINDOW = 500_000
export const DEFAULTS: Config = {
  enabled: true,
  thresholdPercent: 80,
  defaultContextWindow: DEFAULT_WINDOW,
  seedHeadroomTokens: MIN_HEADROOM,
  maxUnattended: 2,
  chainWhileRunActive: true,
  renameSessions: true,
  sessionNamePrefix: '[ai-dlc:auto-handoff]',
  briefTemplate: '~/.claude/auto-handoff/brief.md',
  instructionsTemplate: '~/.claude/auto-handoff/instructions.md',
  viewer: '',
}

/** What a setting's value must be. */
type Kind = 'boolean' | 'percent' | 'positive' | 'whole' | 'text' | 'path' | 'pattern' | 'address'
/** A setting: its key in .ai-dlc/auto-handoff.json and in Config, its environment variable, its kind,
 * and its key in the plugin's userConfig when it has one. One line each: tests/auto-handoff/ in the
 * repository checks this table against the schema the configure-auto-handoff skill ships. */
export type Setting = { key: string; field: keyof Config; env: string; kind: Kind; userConfig?: string }
export const SETTINGS: readonly Setting[] = [
  { key: 'enabled', field: 'enabled', env: 'AI_DLC_AUTO_HANDOFF_ENABLED', kind: 'boolean' },
  { key: 'thresholdPercent', field: 'thresholdPercent', env: 'AI_DLC_AUTO_HANDOFF_THRESHOLD_PERCENT', kind: 'percent', userConfig: 'thresholdPercent' },
  { key: 'thresholdTokens', field: 'thresholdTokens', env: 'AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS', kind: 'positive' },
  { key: 'defaultContextWindow', field: 'defaultContextWindow', env: 'AI_DLC_AUTO_HANDOFF_DEFAULT_CONTEXT_WINDOW', kind: 'positive' },
  { key: 'seedHeadroomTokens', field: 'seedHeadroomTokens', env: 'AI_DLC_AUTO_HANDOFF_SEED_HEADROOM_TOKENS', kind: 'whole' },
  { key: 'maxConsecutiveHandoffs', field: 'maxUnattended', env: 'AI_DLC_AUTO_HANDOFF_MAX_CONSECUTIVE', kind: 'positive', userConfig: 'maxConsecutiveHandoffs' },
  { key: 'chainWhileRunActive', field: 'chainWhileRunActive', env: 'AI_DLC_AUTO_HANDOFF_CHAIN_WHILE_RUN_ACTIVE', kind: 'boolean' },
  { key: 'renameSessions', field: 'renameSessions', env: 'AI_DLC_AUTO_HANDOFF_RENAME_SESSIONS', kind: 'boolean' },
  { key: 'sessionNamePrefix', field: 'sessionNamePrefix', env: 'AI_DLC_AUTO_HANDOFF_SESSION_NAME_PREFIX', kind: 'text' },
  { key: 'briefTemplate', field: 'briefTemplate', env: 'AI_DLC_AUTO_HANDOFF_BRIEF_TEMPLATE', kind: 'path', userConfig: 'briefTemplate' },
  { key: 'instructionsTemplate', field: 'instructionsTemplate', env: 'AI_DLC_AUTO_HANDOFF_INSTRUCTIONS_TEMPLATE', kind: 'path', userConfig: 'instructionsTemplate' },
  { key: 'ignoreFiles', field: 'ignoreFiles', env: 'AI_DLC_AUTO_HANDOFF_IGNORE_FILES', kind: 'pattern', userConfig: 'ignoreFiles' },
  { key: 'viewer', field: 'viewer', env: 'AI_DLC_AUTO_HANDOFF_VIEWER', kind: 'address', userConfig: 'viewer' },
]

/** One place values are read from, highest first. `byEnv`: keyed by environment variable, not by key. */
export type Level = { where: string; byEnv: boolean; values: Record<string, unknown> }
/** The effective settings, each key's source, and one warning per value that was set but invalid. */
export type Resolved = { cfg: Config; sources: Record<string, string>; warnings: string[] }

const WHOLE = /^\s*(0|[1-9][0-9]*)\s*$/
const BOOLS: Record<string, boolean> = { true: true, false: false, '1': true, '0': false, yes: true, no: false, on: true, off: false }

/** A boolean, or a word for one (true/false, 1/0, yes/no, on/off; any case, spaces around ignored).
 * Undefined for anything else. Shared with ../keepalive/settings.ts, so both parse a boolean alike. */
export function parseBool(raw: unknown): boolean | undefined {
  if (typeof raw === 'boolean') return raw
  if (typeof raw !== 'string') return undefined
  // Own keys only: a plain lookup would let `constructor` or `__proto__` reach Object.prototype.
  const word = raw.trim().toLowerCase()
  return Object.hasOwn(BOOLS, word) ? BOOLS[word] : undefined
}

// Numbers are not shared with ../keepalive/settings.ts: this module takes whole numbers only, written
// without leading zeros, and keep-alive takes fractions ("0.9", "1.5"); one parser would change one of them.
const whole = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && WHOLE.test(v) ? Number(v) : NaN
  return Number.isSafeInteger(n) && n >= 0 ? n : undefined
}

/**
 * A raw value checked against its kind: the value, `null` when it is not set (missing, null, or a
 * blank environment value), or `undefined` when it is set but invalid. An environment variable is
 * always text in the process, and may be text, a number or a boolean in a settings file's `env`.
 */
export function check(kind: Kind, raw: unknown, byEnv: boolean): unknown {
  if (raw === undefined || raw === null) return null
  if (byEnv && typeof raw === 'string' && !raw.trim()) return null
  switch (kind) {
    case 'boolean': return parseBool(raw)
    case 'percent': {
      const n = whole(raw)
      return n !== undefined && n >= 1 && n <= 100 ? n : undefined
    }
    case 'positive': {
      const n = whole(raw)
      return n !== undefined && n >= 1 ? n : undefined
    }
    case 'whole': return whole(raw)
    case 'text':
    case 'path':
      return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined
    case 'pattern': {
      if (typeof raw !== 'string') return undefined
      if (!raw.trim()) return '' // set to nothing: no file is ignored
      try { new RegExp(raw); return raw } catch { return undefined }
    }
    case 'address': {
      // Blank means no server; anything else must be host:port, or the server would never start.
      if (typeof raw !== 'string') return undefined
      const t = raw.trim()
      return t === '' || parseAddress(t) ? t : undefined
    }
  }
}

const show = (v: unknown) => typeof v === 'string' ? JSON.stringify(v) : String(JSON.stringify(v))

/**
 * Each setting from the first level that holds a valid value, highest first: the levels given (the
 * `env` of .claude/settings.local.json, the `env` of .claude/settings.json, the process environment,
 * then .ai-dlc/auto-handoff.json), then the plugin's userConfig from /config, then the default. A
 * value that is set but invalid is reported in `warnings` and resolution falls through to the next
 * level. userConfig keeps its old leniency: the host enforces its min and max, and a percentage
 * outside 1..100 is clamped, a bad one dropped (parseUserConfig). A /config value that is clamped or
 * dropped is reported in `warnings` too, when no higher level set that key.
 */
export function resolveConfig(levels: readonly Level[], options: Record<string, unknown>): Resolved {
  const { cfg: user, warnings: userWarnings } = parseUserConfig(options)
  const cfg: Config = { ...DEFAULTS }
  const sources: Record<string, string> = {}
  const warnings: string[] = []
  for (const s of SETTINGS) {
    let found = false
    for (const level of levels) {
      const name = level.byEnv ? s.env : s.key
      if (!Object.prototype.hasOwnProperty.call(level.values, name)) continue
      const raw = level.values[name]
      const v = check(s.kind, raw, level.byEnv)
      if (v === null) continue
      if (v === undefined) {
        warnings.push(`${name}=${show(raw)} in ${level.where} ignored: not a valid ${s.kind}; falling back to the next source`)
        continue
      }
      assign(cfg, s, v)
      sources[s.key] = `${name} in ${level.where}`
      found = true
      break
    }
    if (found) continue
    if (s.userConfig && options[s.userConfig] !== undefined && options[s.userConfig] !== null) {
      (cfg as Record<string, unknown>)[s.field] = (user as Record<string, unknown>)[s.field]
      sources[s.key] = `${s.userConfig} in /config`
      const w = userWarnings[s.userConfig]
      if (w) warnings.push(w)
    } else {
      sources[s.key] = 'default'
    }
  }
  return { cfg, sources, warnings }
}

function assign(cfg: Config, s: Setting, v: unknown) {
  if (s.kind === 'pattern') cfg.ignoreFiles = v ? new RegExp(v as string) : undefined
  else (cfg as Record<string, unknown>)[s.field] = v
}

export const k = (n: number) => `${Math.round(n / 1000)}k`
export const short = (sessionId: string) => sessionId.slice(0, 8)
export const expand = (path: string, home: string) => path.replace(/^~(?=\/|$)/, home)

const isPositive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0

/**
 * The /config values alone, each checked, with the defaults for anything missing or bad, and one
 * warning per /config key whose value was clamped or dropped. Lenient on purpose: a typo in /config
 * should not stop handoffs. A non-positive or non-numeric number falls back to the default rather
 * than handing off at 0; a percentage outside 1..100 is clamped into it.
 */
export function parseUserConfig(options: Record<string, unknown>): { cfg: Config; warnings: Record<string, string> } {
  const warnings: Record<string, string> = {}
  const set = (key: string) => options[key] !== undefined && options[key] !== null
  const drop = (key: string, why: string, fallback: unknown) => {
    warnings[key] = `${key}=${show(options[key])} in /config ignored: ${why}; using ${show(fallback)}`
  }
  const cfg: Config = { ...DEFAULTS }

  const pct = options.thresholdPercent
  if (isPositive(pct)) {
    cfg.thresholdPercent = Math.min(100, Math.max(1, pct))
    if (cfg.thresholdPercent !== pct) warnings.thresholdPercent = `thresholdPercent=${pct} in /config clamped to ${cfg.thresholdPercent}`
  } else if (set('thresholdPercent')) drop('thresholdPercent', 'not a positive number', DEFAULTS.thresholdPercent)

  const max = options.maxConsecutiveHandoffs
  if (isPositive(max)) cfg.maxUnattended = max
  else if (set('maxConsecutiveHandoffs')) drop('maxConsecutiveHandoffs', 'not a positive number', DEFAULTS.maxUnattended)

  for (const key of ['briefTemplate', 'instructionsTemplate'] as const) {
    const v = options[key]
    if (typeof v === 'string' && v.trim()) cfg[key] = v.trim()
    else if (set(key)) drop(key, 'blank or not text', DEFAULTS[key])
  }

  const pat = options.ignoreFiles
  if (typeof pat === 'string' && pat.trim()) {
    try { cfg.ignoreFiles = new RegExp(pat) } catch { drop('ignoreFiles', 'not a valid regular expression', '') }
  } else if (set('ignoreFiles') && typeof pat !== 'string') drop('ignoreFiles', 'not text', '')

  const viewer = options.viewer
  if (typeof viewer === 'string' && (!viewer.trim() || parseAddress(viewer))) cfg.viewer = viewer.trim()
  else if (set('viewer')) drop('viewer', 'not host:port', DEFAULTS.viewer)

  return { cfg, warnings }
}

/** The /config values alone, each checked, with the defaults for anything missing or bad. */
export const parseConfig = (options: Record<string, unknown>): Config => parseUserConfig(options).cfg

// Strip // and /* */ comments outside strings: Claude Code settings files may be JSONC.
export function stripComments(text: string): string {
  let out = ''
  let i = 0
  let inStr = false
  while (i < text.length) {
    const c = text[i]!
    const d = text[i + 1]
    if (inStr) {
      out += c
      if (c === '\\') { out += d ?? ''; i += 2; continue }
      if (c === '"') inStr = false
      i++
    } else if (c === '"') { inStr = true; out += c; i++ }
    else if (c === '/' && d === '/') { while (i < text.length && text[i] !== '\n') i++ }
    else if (c === '/' && d === '*') { const e = text.indexOf('*/', i + 2); i = e === -1 ? text.length : e + 2 }
    else { out += c; i++ }
  }
  return out
}

/** A settings file's `env` object, or the problem with it. Missing text or a file with no `env` is
 * not a problem. */
export function settingsEnv(text: string | undefined): { env?: Record<string, unknown>; problem?: string } {
  if (text === undefined) return {}
  let doc: unknown
  try { doc = JSON.parse(stripComments(text.replace(/^﻿/, ''))) } catch { return { problem: 'is not valid JSON (comments allowed); its env is skipped' } }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { problem: 'top level is not an object; its env is skipped' }
  const env = (doc as Record<string, unknown>).env
  if (env === undefined) return {}
  if (!env || typeof env !== 'object' || Array.isArray(env)) return { problem: 'env is not an object; skipped' }
  return { env: env as Record<string, unknown> }
}

/** .ai-dlc/auto-handoff.json's settings, or the problem with it. A missing file is not a problem. */
export function repoConfig(text: string | undefined): { values?: Record<string, unknown>; problem?: string } {
  if (text === undefined) return {}
  let doc: unknown
  try { doc = JSON.parse(text.replace(/^﻿/, '')) } catch { return { problem: 'is not valid JSON; it is skipped' } }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { problem: 'top level is not an object; it is skipped' }
  return { values: doc as Record<string, unknown> }
}

// Workspace trust for the repository file. .ai-dlc/auto-handoff.json is committed, so a cloned
// repository could point the viewer server at the network (0.0.0.0:port serves briefs and transcript
// summaries to the LAN), make the module write a template file at a path it picks, or feed a file of
// its choosing into the Haiku prompt. Claude Code asks before trusting a folder's settings files, but
// it knows nothing of this file, so the module checks Claude Code's own record instead: the keys
// below apply from the repository file only when the folder is trusted. Every other key always does.
// Settings `env`, the process environment and /config are the person's own, and are never gated.
export const TRUST_GATED = ['briefTemplate', 'instructionsTemplate', 'viewer'] as const

/** Where Claude Code records trust: `projects["<path>"].hasTrustDialogAccepted` in ~/.claude.json.
 * In a repository, the key is the repository root (in a worktree, the main checkout's root), and a
 * nested repository has its own. Outside a repository, it is the start folder or a folder above it. */
export type TrustTarget = { root: string } | { start: string }

/** A path as trust keys are compared: `\` as `/`, no trailing slash, lower case. Windows writes keys
 * with forward slashes and a lowercase drive letter on some machines, and backslashes on others. */
export const normPath = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()

/** The repository root trust is keyed on: the main checkout's root when `commonDir` (git's
 * --git-common-dir, absolute) is a `.git` folder outside `top` (a linked worktree), else `top`. */
export function trustRoot(top: string, commonDir: string | undefined): string {
  const common = commonDir?.replace(/\\/g, '/').replace(/\/+$/, '')
  if (!common || !common.endsWith('/.git')) return top
  const main = common.slice(0, -'/.git'.length)
  return main && normPath(main) !== normPath(top) ? main : top
}

/** The folders whose entry may hold trust for the target, nearest first. */
function trustKeys(target: TrustTarget): string[] {
  if ('root' in target) return [normPath(target.root)]
  const parts = normPath(target.start).split('/')
  return parts.map((_, i) => parts.slice(0, parts.length - i).join('/'))
}

/**
 * Whether Claude Code trusts the target, from the text of ~/.claude.json, and why not. Fails closed:
 * a missing or unreadable file, bad JSON, no matching entry, or a value that is not exactly `true`
 * means untrusted. `why` names the reason only, never the file's content.
 */
export function trustOf(claudeJson: string | undefined, target: TrustTarget): { trusted: boolean; why: string } {
  if (claudeJson === undefined) return { trusted: false, why: '~/.claude.json was not readable' }
  let doc: unknown
  try { doc = JSON.parse(claudeJson.replace(/^﻿/, '')) } catch { return { trusted: false, why: '~/.claude.json is not valid JSON' } }
  const projects = doc && typeof doc === 'object' ? (doc as Record<string, unknown>).projects : undefined
  if (!projects || typeof projects !== 'object' || Array.isArray(projects)) return { trusted: false, why: '~/.claude.json has no projects' }
  const wanted = new Set(trustKeys(target))
  let matched = false
  for (const [key, entry] of Object.entries(projects as Record<string, unknown>)) {
    if (!wanted.has(normPath(key))) continue
    matched = true
    if (entry && typeof entry === 'object' && (entry as Record<string, unknown>).hasTrustDialogAccepted === true) return { trusted: true, why: '' }
  }
  return { trusted: false, why: matched ? 'the folder is not marked trusted' : 'the folder has no entry' }
}

/** The repository file's values without the trust-gated keys that are set, and the keys taken out. */
export const withoutGated = (values: Record<string, unknown>) => withoutKeys(values, TRUST_GATED)

/** The value at a key; a dot in the key is one level of nesting (`oneHour.keepWarmFor`). */
function valueAt(values: Record<string, unknown>, key: string): unknown {
  let cur: unknown = values
  for (const part of key.split('.')) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur) || !Object.hasOwn(cur, part)) return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

/** The longest text, in characters (code points), a skipped setting's value is logged with before it is cut. */
export const PREVIEW_CHARS = 40

/**
 * A value as the trust gate logs it: a text in double quotes, anything else as JSON. Runs of
 * white space become one space, and a value longer than PREVIEW_CHARS is cut there, with `…` and
 * `(N chars)` after it, so a long pingPrompt or compactInstructions stays one short line. Lengths
 * count characters (code points, so an emoji is one and is never split in half) of the folded
 * text, the text that was cut. Nothing is redacted (asked for, so a person can see what was
 * skipped): the first PREVIEW_CHARS characters are logged as they are, which is why the README
 * says never to put a secret in these settings.
 */
export function previewValue(v: unknown): string {
  const text = typeof v === 'string' ? v : JSON.stringify(v) ?? String(v)
  const chars = Array.from(text.replace(/\s+/g, ' '))
  const cut = chars.length > PREVIEW_CHARS ? `${chars.slice(0, PREVIEW_CHARS).join('')}…` : chars.join('')
  const shown = typeof v === 'string' ? `"${cut}"` : cut
  return chars.length > PREVIEW_CHARS ? `${shown} (${chars.length} chars)` : shown
}

/** The given keys with the values they have in `values`, `key=value, …`, as the trust gate logs them. */
export const keysWithValues = (values: Record<string, unknown>, keys: readonly string[]): string =>
  keys.map(key => `${key}=${previewValue(valueAt(values, key))}`).join(', ')

/**
 * The values without those of the given keys that are set (not missing or null), and the keys taken
 * out. A dot in a key is one level of nesting. The values passed in are never changed: what is taken
 * out is taken out of copies. Shared by the automatic handoff's and keep-alive's trust gates.
 */
export function withoutKeys(values: Record<string, unknown>, keys: readonly string[]): { values: Record<string, unknown>; ignored: string[] } {
  const ignored = keys.filter(key => { const v = valueAt(values, key); return v !== undefined && v !== null })
  if (!ignored.length) return { values, ignored }
  const kept = { ...values }
  for (const key of ignored) {
    const parts = key.split('.')
    let cur = kept
    for (const part of parts.slice(0, -1)) cur = cur[part] = { ...(cur[part] as Record<string, unknown>) }
    delete cur[parts.at(-1)!]
  }
  return { values: kept, ignored }
}

/** Where the window a threshold was computed from came from: `host`, the `window` Claude Code
 * reported; `host-percent`, derived from its `percent` and `tokens`; `default`, defaultContextWindow. */
export type WindowSource = 'host' | 'host-percent' | 'default'
export type WindowInfo = { window: number; source: WindowSource }

/** The context window in tokens and its source, from $.session.usage().context: its `window`, else
 * derived from its `percent` (0 to 100) and `tokens`, else undefined, and the caller uses defaultContextWindow. */
export function windowInfo(context: { tokens?: number; window?: number; percent?: number }): WindowInfo | undefined {
  if (typeof context.window === 'number' && context.window > 0) return { window: context.window, source: 'host' }
  const { tokens, percent: pct } = context
  if (typeof tokens === 'number' && tokens > 0 && typeof pct === 'number' && pct > 0) return { window: Math.round(tokens * 100 / pct), source: 'host-percent' }
  return undefined
}

/** The context window in tokens (windowInfo without its source). */
export const windowOf = (context: { tokens?: number; window?: number; percent?: number }): number | undefined => windowInfo(context)?.window

/** The window fields of the per-turn `threshold` log line: the window the threshold was computed
 * from, where it came from, and the basis of the threshold. With thresholdTokens no window is read,
 * so `window=none windowSource=none`. One space-separated run of key=value pairs, no spaces in a value. */
export function windowFields(w: WindowInfo | undefined, cfg: Pick<Config, 'thresholdPercent' | 'thresholdTokens'>): string {
  const basis = cfg.thresholdTokens ? 'thresholdTokens' : `thresholdPercent:${cfg.thresholdPercent}`
  return `window=${w?.window ?? 'none'} windowSource=${w?.source ?? 'none'} basis=${basis}`
}

/** The part of $.session.usage({ breakdown }).context.breakdown the threshold line reads: how Claude
 * Code settled its window (`autocompactSource`, a ContextWindowSource such as `model-default` or
 * `env`) and the token count its auto-compact runs at (absent when auto-compact is off). */
export type HostWindow = { autocompactSource?: unknown; autoCompactThreshold?: unknown }

/** Claude Code's own window fields of the threshold log line, next to the module's windowFields:
 * `hostWindowSource=<source|none> autoCompactThreshold=<n|none>`. A value that is missing, of the
 * wrong type or would put a space in the line reads `none`. */
export function hostFields(b: HostWindow | undefined): string {
  const src = typeof b?.autocompactSource === 'string' && /^\S+$/.test(b.autocompactSource) ? b.autocompactSource : 'none'
  const at = typeof b?.autoCompactThreshold === 'number' && Number.isFinite(b.autoCompactThreshold) ? b.autoCompactThreshold : 'none'
  return `hostWindowSource=${src} autoCompactThreshold=${at}`
}

/** A response usage's `cache_creation` split, 1-hour and 5-minute tokens, when it carries one (zeros
 * included). The mods API's usage type does not declare it; the engine may still pass it on. */
export function creationSplit(usage: unknown): { '1h': number; '5m': number } | undefined {
  const c = usage && typeof usage === 'object' ? (usage as Record<string, unknown>).cache_creation : undefined
  if (!c || typeof c !== 'object') return undefined
  const h = (c as Record<string, unknown>).ephemeral_1h_input_tokens
  const m = (c as Record<string, unknown>).ephemeral_5m_input_tokens
  return typeof h === 'number' && typeof m === 'number' ? { '1h': h, '5m': m } : undefined
}

/** What the seeded session's first request read from and wrote to the prompt cache. */
export type SeedCache = { input: number; read: number; written: number; split?: { '1h': number; '5m': number } }

/** The cache fields of the seed turn's `floor` log line. `cache=hit` when anything was read from the
 * cache: only the shared prefix (tools, system prompt, project context) can be, never the old conversation. */
export function seedCacheFields(c: SeedCache): string {
  return `input_tokens=${c.input} cache_read_input_tokens=${c.read} cache_creation_input_tokens=${c.written} cache_creation_1h=${c.split?.['1h'] ?? 'none'} cache_creation_5m=${c.split?.['5m'] ?? 'none'} cache=${c.read > 0 ? 'hit' : 'miss'}`
}

/** The panel's line for the same: "cache hit: 30k read, 2k written (1h 2k, 5m 0)". */
export function seedCacheLine(c: SeedCache): string {
  const split = c.split ? `1h ${k(c.split['1h'])}, 5m ${k(c.split['5m'])}` : '1h/5m split not reported'
  return `${c.read > 0 ? `cache hit: ${k(c.read)} read` : 'cache miss: nothing read'}, ${k(c.written)} written (${split})`
}

/** The handoff line in tokens: thresholdPercent of the window, rounded down. */
export const contextLine = (thresholdPercent: number, window: number) => Math.floor(window * thresholdPercent / 100)

/** A session name in a handoff chain: "<prefix>: <base> (Session <n>)". */
export const sessionName = (prefix: string, base: string, n: number) => `${prefix}: ${base} (Session ${n})`

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** The base name of a session title: the title with a "<prefix>: … (Session N)" wrapper taken off,
 * however many times it was applied, so names never nest. Undefined for a blank title. */
export function baseName(title: string | undefined, prefix: string): string | undefined {
  let t = title?.trim()
  if (!t) return undefined
  const wrapped = new RegExp(`^${escapeRe(prefix)}:\\s*(.*?)\\s*\\(Session \\d+\\)$`)
  for (let m = wrapped.exec(t); m?.[1]; m = wrapped.exec(t)) t = m[1].trim()
  return t || undefined
}

/** The session's title from its transcript: the last `custom-title` line (a name the person or
 * /rename gave), else the last `ai-title` line. Undefined when the transcript names none. */
export function transcriptTitle(jsonl: string): string | undefined {
  let custom: string | undefined
  let ai: string | undefined
  for (const line of jsonl.split('\n')) {
    if (!line.includes('-title"')) continue
    try {
      const o = JSON.parse(line) as { type?: string; customTitle?: unknown; aiTitle?: unknown }
      if (o.type === 'custom-title' && typeof o.customTitle === 'string' && o.customTitle.trim()) custom = o.customTitle.trim()
      else if (o.type === 'ai-title' && typeof o.aiTitle === 'string' && o.aiTitle.trim()) ai = o.aiTitle.trim()
    } catch {}
  }
  return custom ?? ai
}

// The seed prompt's first characters; the render hook knows the seed row by them.
export const SEED_PREFIX = '[auto-handoff] ↪ Handoff from session'
// The seed text with its brief path and viewer URL as markdown links. The path becomes a
// file: link labelled by its file name; the URL links to itself. Exported for the test.
export function linkify(text: string): string {
  return text
    .replace(/(?<=\bat )(\/\S+\.md)(?=[\s)]|$)/, (p) => `[${p.slice(p.lastIndexOf('/') + 1)}](file://${p})`)
    .replace(/(https?:\/\/[^\s)]+)/, (u) => `[${u}](${u})`)
}

// Each template's default, a file in the mod's templates/ folder.
export const TEMPLATES = [['briefTemplate', 'brief.md'], ['instructionsTemplate', 'instructions.md']] as const
export type TemplateKey = typeof TEMPLATES[number][0]
// The sections Haiku writes when an AI-DLC run is active: the handoff skill's session handoff
// template. Shipped only, not a setting, so it stays the skill's template.
export const SESSION_TEMPLATE = 'session-handoff.md'
// Used only when the shipped default is unreadable too, so the fresh session still knows what to do.
export const LAST_RESORT_INSTRUCTIONS = '## Instructions\n\nThis turn was triggered by the system, not by a user. Read this brief and continue the work it describes.'
