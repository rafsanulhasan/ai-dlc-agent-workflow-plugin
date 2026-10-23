// ITEM-027 spike, round 3 (step 17.l2, addendum 3): every lens setting, its levels and its schema. No `$` here.
// Precedence, highest first: `AI_DLC_LENS_*` in the `env` of .claude/settings.local.json, then of
// .claude/settings.json, then .ai-dlc/lens.json, then the default. An invalid value falls through to
// the next level. The process environment is never read (US-5, AC-5.4).

export type Spec =
  | { kind: 'int'; min: number; max: number; def: number; doc: string }
  | { kind: 'bool'; def: boolean; doc: string }
  | { kind: 'enum'; values: readonly string[]; def: string; doc: string }
  | { kind: 'path'; def: string; doc: string }
  | { kind: 'color'; def: string; doc: string }

export const SPEC = {
  chartMode: { kind: 'enum', values: ['auto', 'chart', 'button'], def: 'auto', doc: 'auto: the chart when the row is wide enough, else a chip with an "Open flowchart" Button; chart or button: always that one' },
  breakpointColumns: { kind: 'int', min: 0, max: 1000, def: 0, doc: 'The row width (viewport columns) from which the chart is drawn in auto mode; 0: the chart width divided by cellPx' },
  cellPx: { kind: 'int', min: 4, max: 32, def: 8, doc: 'CSS px taken per viewport column (no API gives the cell width)' },
  chartColumnPx: { kind: 'int', min: 60, max: 400, def: 120, doc: 'Width of one avatar column in the chart, px' },
  chartRowPx: { kind: 'int', min: 60, max: 400, def: 96, doc: 'Height of one level of the chart, px' },
  avatarRadiusPx: { kind: 'int', min: 6, max: 40, def: 14, doc: 'Avatar radius, px' },
  collapsedByDefault: { kind: 'bool', def: true, doc: 'Every [+]/[-] section starts collapsed' },
  blink: { kind: 'bool', def: true, doc: 'Running avatars blink' },
  blinkMs: { kind: 'int', min: 200, max: 10000, def: 1000, doc: 'One blink cycle, ms' },
  showCost: { kind: 'bool', def: true, doc: 'Show the cost line in the avatar panel' },
  cacheWriteRate: { kind: 'enum', values: ['5m', '1h'], def: '5m', doc: 'The cache-write price used for cost (the usage does not say the TTL)' },
  windowFallback: { kind: 'enum', values: ['main', 'none'], def: 'main', doc: "A model not in the costing file: main: the main session's window when it runs the same model; none: show —" },
  costingPath: { kind: 'path', def: '.ai-dlc/model-metadata.json', doc: 'The model metadata file: prices, windows, limits (read only)' },
  costingFallbackPath: { kind: 'path', def: '.ai-dlc/model-costing.json', doc: 'Read when costingPath is missing: the name the file had before its rename to model-metadata.json' },
  rosterPath: { kind: 'path', def: '.claude/agent-memory/ai-dlc-orchestrator/project_team-roster.md', doc: 'The team roster (agent ID -> persona name)' },
  contextLimit: { kind: 'int', min: 1, max: 1000, def: 60, doc: "Gathered-context calls kept for the main loop's card" },
  callsLimit: { kind: 'int', min: 1, max: 1000, def: 80, doc: 'Tool calls kept per agent' },
  callsShown: { kind: 'int', min: 1, max: 1000, def: 40, doc: 'Tool calls listed in the avatar panel' },
  recordChars: { kind: 'int', min: 200, max: 200000, def: 6000, doc: 'Characters shown of a handoff record or hand-back' },
  thinkingChars: { kind: 'int', min: 200, max: 200000, def: 4000, doc: 'Characters of thinking kept per agent' },
  // Round 5 (step 17.l4): long-context pricing and the workflow status indicator.
  longContextThresholdTokens: {
    kind: 'int',
    min: 0,
    max: 100000000,
    def: 0,
    doc: "Overrides every model's long-context threshold for the cost (prompt tokens: input + cache read + cache write of one request); 0: the metadata file decides (its longContextThresholdTokensOverride, else the model's longContextPricing.thresholdTokens)",
  },
  statusBlink: { kind: 'bool', def: true, doc: 'The in-progress status indicator of a workflow blinks' },
  statusBlinkMs: { kind: 'int', min: 200, max: 10000, def: 1000, doc: 'One blink cycle of the status indicator, ms' },
  statusInProgressColor: { kind: 'color', def: '#2e7d32', doc: 'Status indicator: in progress (blinks)' },
  statusPendingColor: { kind: 'color', def: '#cfd8dc', doc: 'Status indicator: pending (spawned, not started)' },
  statusHaltedColor: { kind: 'color', def: '#c62828', doc: 'Status indicator: halted (an agent failed or was killed, or the run is blocked)' },
  statusWaitingColor: { kind: 'color', def: '#ef6c00', doc: 'Status indicator: an agent teammate waiting' },
  statusCompletedColor: { kind: 'color', def: '#2e7d32', doc: 'Status indicator: completed (steady)' },
} as const satisfies Record<string, Spec>

export type Key = keyof typeof SPEC
export type LensSettings = { [K in Key]: (typeof SPEC)[K]['def'] extends number ? number : (typeof SPEC)[K]['def'] extends boolean ? boolean : string }
export type Sources = Record<Key, string>

export const KEYS = Object.keys(SPEC) as Key[]
export const DEFAULTS = Object.fromEntries(KEYS.map(k => [k, SPEC[k].def])) as LensSettings

/** `chartMode` -> `AI_DLC_LENS_CHART_MODE`. */
export const envName = (k: Key): string => 'AI_DLC_LENS_' + k.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()

/** A value from a settings `env` (always a string) or from lens.json (its JSON type); undefined when invalid. */
export function coerce(k: Key, v: unknown, fromEnv: boolean): number | boolean | string | undefined {
  const s: Spec = SPEC[k]
  if (s.kind === 'int') {
    const n = fromEnv ? (typeof v === 'string' && /^-?\d+$/.test(v.trim()) ? Number(v.trim()) : NaN) : typeof v === 'number' ? v : NaN
    return Number.isInteger(n) && n >= s.min && n <= s.max ? n : undefined
  }
  if (s.kind === 'bool') {
    if (!fromEnv) return typeof v === 'boolean' ? v : undefined
    if (typeof v !== 'string') return undefined
    const t = v.trim().toLowerCase()
    return t === 'true' || t === '1' ? true : t === 'false' || t === '0' ? false : undefined
  }
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  if (s.kind === 'enum') return s.values.includes(t) ? t : undefined
  if (s.kind === 'color') return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(t) ? t : undefined
  return t !== '' && !t.includes('\0') ? t : undefined
}

/** One level: where it is, whether its values are `env` strings, and its raw values by setting key. */
export type Level = { where: string; byEnv: boolean; values: Record<string, unknown> }

/** The `AI_DLC_LENS_*` entries of a settings file's `env`, by setting key. */
export function envLevel(where: string, settingsText: string | null): { level: Level; problem: string } {
  if (settingsText === null) return { level: { where, byEnv: true, values: {} }, problem: '' }
  let json: unknown
  try {
    json = JSON.parse(settingsText)
  } catch {
    return { level: { where, byEnv: true, values: {} }, problem: `${where}: not valid JSON, skipped` }
  }
  const env = json !== null && typeof json === 'object' ? (json as Record<string, unknown>).env : undefined
  const values: Record<string, unknown> = {}
  if (env !== null && typeof env === 'object')
    for (const k of KEYS) {
      const v = (env as Record<string, unknown>)[envName(k)]
      if (v !== undefined) values[k] = v
    }
  return { level: { where: `${where} env`, byEnv: true, values }, problem: '' }
}

/** `.ai-dlc/lens.json`'s keys (`$schema` and unknown keys ignored). */
export function fileLevel(where: string, text: string | null): { level: Level; problem: string } {
  if (text === null) return { level: { where, byEnv: false, values: {} }, problem: '' }
  try {
    const json = JSON.parse(text)
    if (json === null || typeof json !== 'object' || Array.isArray(json)) return { level: { where, byEnv: false, values: {} }, problem: `${where}: not an object, skipped` }
    return { level: { where, byEnv: false, values: json as Record<string, unknown> }, problem: '' }
  } catch {
    return { level: { where, byEnv: false, values: {} }, problem: `${where}: not valid JSON, skipped` }
  }
}

/** Each setting from the first level, highest first, that holds a valid value for it; else the default. */
export function resolve(levels: readonly Level[]): { settings: LensSettings; sources: Sources; ignored: string[] } {
  const settings = { ...DEFAULTS } as Record<Key, unknown>
  const sources = Object.fromEntries(KEYS.map(k => [k, 'default'])) as Sources
  const ignored: string[] = []
  for (const k of KEYS) {
    for (const lv of levels) {
      if (!(k in lv.values)) continue
      const v = coerce(k, lv.values[k], lv.byEnv)
      if (v === undefined) {
        ignored.push(`${lv.where}: ${lv.byEnv ? envName(k) : k} = ${JSON.stringify(lv.values[k])} is invalid, ignored`)
        continue
      }
      settings[k] = v
      sources[k] = lv.where
      break
    }
  }
  return { settings: settings as LensSettings, sources, ignored }
}

/** `.ai-dlc/lens.schema.json`, written by `/spike027-lens-init`. */
export function schema(): Record<string, unknown> {
  const props: Record<string, unknown> = { $schema: { type: 'string' } }
  for (const k of KEYS) {
    const s: Spec = SPEC[k]
    const base = { description: `${s.doc}. Env: ${envName(k)}.`, default: s.def }
    props[k] =
      s.kind === 'int'
        ? { ...base, type: 'integer', minimum: s.min, maximum: s.max }
        : s.kind === 'bool'
          ? { ...base, type: 'boolean' }
          : s.kind === 'enum'
            ? { ...base, type: 'string', enum: [...s.values] }
            : s.kind === 'color'
              ? { ...base, type: 'string', pattern: '^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$' }
              : { ...base, type: 'string', minLength: 1 }
  }
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'AI-DLC lens settings (spike 027)',
    description: 'Overridden by AI_DLC_LENS_* in the env of .claude/settings.json, then of .claude/settings.local.json. The process environment is not read.',
    type: 'object',
    additionalProperties: false,
    properties: props,
  }
}

/** The text `/spike027-lens-init` writes to `.ai-dlc/lens.json`: every default. */
export const initialFile = (): string => JSON.stringify({ $schema: './lens.schema.json', ...DEFAULTS }, null, 2) + '\n'

/** `/spike027-lens-configure <key> <value>`: the new lens.json text, or why not. */
export function setKey(text: string | null, k: string, raw: string): { text: string; error: string } {
  if (!(KEYS as string[]).includes(k)) return { text: '', error: `unknown key ${k}; keys: ${KEYS.join(', ')}` }
  const key = k as Key
  let json: Record<string, unknown> = { $schema: './lens.schema.json' }
  if (text !== null) {
    const f = fileLevel('lens.json', text)
    if (f.problem !== '') return { text: '', error: f.problem }
    json = { ...f.level.values }
  }
  if (raw === '--unset') {
    delete json[key]
    return { text: JSON.stringify(json, null, 2) + '\n', error: '' }
  }
  // A typed value: the same parse as an env string, then stored as its JSON type.
  const v = coerce(key, raw, true)
  if (v === undefined) {
    const s: Spec = SPEC[key]
    const want = s.kind === 'int' ? `an integer ${s.min}..${s.max}` : s.kind === 'bool' ? 'true or false' : s.kind === 'enum' ? s.values.join(' | ') : s.kind === 'color' ? 'a hex colour such as #2e7d32' : 'a non-empty path'
    return { text: '', error: `${raw} is not valid for ${key}: ${want}` }
  }
  json[key] = v
  return { text: JSON.stringify(json, null, 2) + '\n', error: '' }
}
