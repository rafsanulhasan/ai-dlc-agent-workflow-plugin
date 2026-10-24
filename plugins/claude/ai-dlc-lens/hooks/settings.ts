// ai-dlc-lens (from spike ITEM-027, round 3, step 17.l2, addendum 3): every lens setting, its levels and its schema. No `$` here.
// Precedence, highest first: `AI_DLC_LENS_*` in the `env` of .claude/settings.local.json, then of
// .claude/settings.json, then .ai-dlc/lens.json, then the default. An invalid value falls through to
// the next level. The process environment is never read (US-5, AC-5.4).

export type Spec =
  | { kind: 'int'; min: number; max: number; def: number; doc: string }
  | { kind: 'bool'; def: boolean; doc: string }
  | { kind: 'enum'; values: readonly string[]; def: string; doc: string }
  | { kind: 'path'; def: string; doc: string }
  | { kind: 'color'; def: string; doc: string }
  | { kind: 'list'; values: readonly string[]; def: string; doc: string }

export const SPEC = {
  chartMode: { kind: 'enum', values: ['auto', 'chart', 'button'], def: 'auto', doc: 'auto: the chart when the row is wide enough, else a chip with an "Open flowchart" Button; chart or button: always that one' },
  breakpointColumns: { kind: 'int', min: 0, max: 1000, def: 0, doc: 'The row width (viewport columns) from which the chart is drawn in auto mode; 0: the chart width divided by cellPx' },
  cellPx: { kind: 'int', min: 4, max: 32, def: 8, doc: 'CSS px taken per viewport column (no API gives the cell width)' },
  chartColumnPx: { kind: 'int', min: 60, max: 400, def: 120, doc: 'Width of one avatar column in the chart, px' },
  chartRowPx: { kind: 'int', min: 60, max: 400, def: 96, doc: 'Height of one level of the chart, px' },
  // Step 27.2: the row cap of addendum L1, now a setting.
  chartAvatarsPerRow: { kind: 'int', min: 2, max: 24, def: 8, doc: 'The most avatars one row of a chart holds; a level with more wraps onto further rows, so a chart is at most this many avatar columns wide' },
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
  statusWaitingColor: { kind: 'color', def: '#ef6c00', doc: 'Status indicator: an agent waiting (held, or a teammate idle between messages); beside the in-progress colour when both hold' },
  statusCompletedColor: { kind: 'color', def: '#2e7d32', doc: 'Status indicator: completed (steady)' },
  // Avatars (spike ITEM-029 and the robot-avatar addendum): avatar.ts draws them.
  avatarStyle: {
    kind: 'enum',
    values: ['robot', 'image', 'initials'],
    def: 'robot',
    doc: "robot: an agent's avatarImage when it draws, else its robot (the same robot for every agent of a type); image: the avatarImage, else the initials badge; initials: always the initials badge, no image read",
  },
  avatarImageTypes: {
    kind: 'list',
    values: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
    def: 'image/png',
    doc: 'The image types an avatarImage may be, comma-separated (checked on the bytes, not the name)',
  },
  avatarImageMaxBytes: { kind: 'int', min: 1, max: 2097152, def: 65536, doc: 'The largest avatarImage, bytes; the whole chart must also stay under 131,072 Svg characters' },
  // /ai-dlc:lens-keepalive (step 1.4): the keep-alive section of every agent pane; the command toggles it.
  keepaliveSection: {
    kind: 'bool',
    def: true,
    doc: "Show the Cache keep-alive section in every agent pane (collapsed like every section): how long keep-alive kept the cache warm per track (5m, 1h) and what cache reads saved, priced from costingPath. /ai-dlc:lens-keepalive turns it off and on",
  },
  // Step 1.5: how panels open, where the chart is drawn, and the workflow view's place and layout.
  panelOpenMode: {
    kind: 'enum',
    values: ['tab', 'drill-in'],
    def: 'drill-in',
    doc: 'How an avatar or arrow Button opens its details: drill-in (the default): inside the pane or chat card it was pressed in, with "< Back"; tab: a separate pane (a tab beside the others). The "Panel Type" switch of the workflow view and of the /ai-dlc:lens pane overrides it for the session',
  },
  chartInChat: { kind: 'bool', def: true, doc: "Draw each workflow's flowchart in the chat card of its first spawn (chartMode decides chart or chip by the row's width)" },
  chartInPane: { kind: 'bool', def: true, doc: 'Draw the flowcharts in the workflow view (pane or band); off: the avatar and arrow Buttons only' },
  workflowPlace: {
    kind: 'enum',
    values: ['pinned', 'docked'],
    def: 'pinned',
    doc: "Where the workflow view starts: pinned: the band above the prompt where the surface has one (terminal, desktop), else the pane; docked: the pane, placed by the surface (beside the transcript where it docks). The view's own switch changes it for the session",
  },
  wideColumns: {
    kind: 'int',
    min: 0,
    max: 1000,
    def: 70,
    doc: "The workflow view's width (body columns) from which the runs stack as collapsible panels on the right with the selected run's chart beside them; narrower, the view shows only the list of runs, each minimised to one row",
  },
  runListColumns: { kind: 'int', min: 16, max: 200, def: 34, doc: 'Width of the stacked run panels on the right of the wide workflow view, columns' },
  // Step 1.6.1: /ai-dlc:lens-gate, the anomaly detector (hooks/anomaly.ts). One switch, one setting per check, its colour, and the waiting threshold.
  gateAlert: { kind: 'bool', def: true, doc: 'Detect anomalies in the runs and agents the lens sees: a toast when one appears, a marker on its run, agent or arrow, and the Anomalies section of the workflow view. /ai-dlc:lens-gate on|off sets it' },
  anomalyRunBlocked: { kind: 'bool', def: true, doc: 'Check: a run is blocked (run.md status: blocked); the anomaly names its blocked steps' },
  anomalyRunBlockedColor: { kind: 'color', def: '#c62828', doc: 'Marker colour: a blocked run (red)' },
  // Step 1.6.1.l1: a blocked step of a run that is not itself blocked, and which runs are read.
  anomalyStepBlocked: {
    kind: 'bool',
    def: true,
    doc: "Check: a step is blocked (its row in run.md's Stages table has status blocked), whatever the run's status; a run reported blocked names its blocked steps instead, so none is reported twice",
  },
  anomalyStepBlockedColor: { kind: 'color', def: '#c62828', doc: 'Marker colour: a blocked step (red)' },
  anomalyRunScope: {
    kind: 'enum',
    values: ['session', 'all'],
    def: 'session',
    doc: "The runs the detector reads: session: those this session's agent briefs name; all: also every run.md under the handoff folder (artifacts.handoffs of .ai-dlc/workflow.json, default docs/handoffs) whose status is active or blocked",
  },
  anomalyGateWaiting: { kind: 'bool', def: true, doc: 'Check: a gate waits for the human (a gate row with approver human and no decision, or the newest record of the run addressed to: human with no decision for its gate)' },
  anomalyGateWaitingColor: { kind: 'color', def: '#ef6c00', doc: 'Marker colour: a gate waiting for the human (orange)' },
  anomalyGateRejected: { kind: 'bool', def: true, doc: 'Check: a gate was rejected (the last row of that gate in Gates and loops says rejected, not approved, declined or no-go)' },
  anomalyGateRejectedColor: { kind: 'color', def: '#c62828', doc: 'Marker colour: a rejected gate (red)' },
  anomalyLoopOutOfRounds: { kind: 'bool', def: true, doc: 'Check: a loop is out of rounds (the last row of that loop in Gates and loops says its limits are used up, and no raise or acceptance is recorded)' },
  anomalyLoopOutOfRoundsColor: { kind: 'color', def: '#d84315', doc: 'Marker colour: a loop out of rounds (deep orange)' },
  anomalyAgentFailed: { kind: 'bool', def: true, doc: 'Check: an agent failed or stopped, and no later agent of its type was spawned for the same run' },
  anomalyAgentFailedColor: { kind: 'color', def: '#c62828', doc: 'Marker colour: an agent failed or stopped (red)' },
  anomalyAgentKilled: { kind: 'bool', def: true, doc: 'Check: an agent was killed, and no later agent of its type was spawned for the same run' },
  anomalyAgentKilledColor: { kind: 'color', def: '#c62828', doc: 'Marker colour: an agent killed (red)' },
  anomalyAgentWaitingLong: { kind: 'bool', def: true, doc: 'Check: an agent has been waiting (held, or a teammate idle) for anomalyWaitingMinutes or more' },
  anomalyAgentWaitingLongColor: { kind: 'color', def: '#c62828', doc: 'Marker colour: an agent waiting too long (red)' },
  anomalyWaitingMinutes: { kind: 'int', min: 0, max: 1440, def: 30, doc: 'How long an agent may wait before it is an anomaly, minutes; 0: as soon as it waits' },
  anomalyHandbackFailed: { kind: 'bool', def: true, doc: "Check: a hand-back failed its check (verification: failed in its front matter, or a first line 'handoff <file>: failed'), in the newest round of its step" },
  anomalyHandbackFailedColor: { kind: 'color', def: '#f9a825', doc: 'Marker colour: a hand-back that failed its check (yellow)' },
  probes: { kind: 'bool', def: false, doc: "Log the spike's experiments E1, E2, E4, E5, E7, E9 and E10 to PROBE-LOG.jsonl in the plugin folder (diagnostics only)" },
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
  if (s.kind === 'list' && !fromEnv && Array.isArray(v)) return v.every(x => typeof x === 'string') ? listOf(s.values, v.join(',')) : undefined
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  if (s.kind === 'enum') return s.values.includes(t) ? t : undefined
  if (s.kind === 'color') return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(t) ? t : undefined
  if (s.kind === 'list') return listOf(s.values, t)
  return t !== '' && !t.includes('\0') ? t : undefined
}

/** A comma-separated list of allowed values, normalised (lower case, no repeats); undefined when empty or any is not allowed. */
function listOf(allowed: readonly string[], text: string): string | undefined {
  const items = [...new Set(text.split(',').map(x => x.trim().toLowerCase()).filter(x => x !== ''))]
  return items.length > 0 && items.every(x => allowed.includes(x)) ? items.join(',') : undefined
}

// ---- per-agent keys (stories A21, AC-6.9): `<family>.<agent>` ----

/** The per-agent settings. Each agent's value is looked up by its avatar key (avatar.ts avatarKey). */
export const AGENT_FAMILIES = ['avatarImage'] as const
export type AgentFamily = (typeof AGENT_FAMILIES)[number]

/** An agent part: an agent ID, or `<plugin>:<agent>`; letters, digits, `-`, `_`, `.` and one `:`. */
export const isAgentPart = (agent: string): boolean => /^[A-Za-z0-9][A-Za-z0-9_.-]*(?::[A-Za-z0-9][A-Za-z0-9_.-]*)?$/.test(agent)

/** `avatarImage.software-architect` -> its family and agent part; null when not a per-agent key. */
export function agentKeyParts(k: string): { family: AgentFamily; agent: string } | null {
  const dot = k.indexOf('.')
  if (dot < 0) return null
  const family = k.slice(0, dot)
  const agent = k.slice(dot + 1)
  if (!(AGENT_FAMILIES as readonly string[]).includes(family) || !isAgentPart(agent)) return null
  return { family: family as AgentFamily, agent }
}

/** `avatarImage` -> `AI_DLC_LENS_AVATAR_IMAGE__`: the prefix every per-agent env name of a family starts with. */
export const agentEnvPrefix = (family: AgentFamily): string => 'AI_DLC_LENS_' + family.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase() + '__'

/**
 * The settings `env` name of a per-agent key: the family's prefix, then the agent part in capitals,
 * `:` as `__` and `-` or `.` as `_` (`software-architect` -> `AI_DLC_LENS_AVATAR_IMAGE__SOFTWARE_ARCHITECT`,
 * `my-plugin:my-agent` -> `AI_DLC_LENS_AVATAR_IMAGE__MY_PLUGIN__MY_AGENT`).
 */
export const agentEnvName = (family: AgentFamily, agent: string): string =>
  agentEnvPrefix(family) + agent.replace(/:/g, '__').replace(/[-.]/g, '_').toUpperCase()

/**
 * A per-agent value: the first level, highest first, holding a non-empty string for it; `null` when
 * none does. An invalid entry (not a string, or blank) falls through and is named in `ignored`.
 */
export function resolveAgent(levels: readonly Level[], family: AgentFamily, agent: string): { value: string; source: string; ignored: string[] } | null {
  const ignored: string[] = []
  for (const lv of levels) {
    const name = lv.byEnv ? agentEnvName(family, agent) : `${family}.${agent}`
    if (!(name in lv.values)) continue
    const v = lv.values[name]
    if (typeof v === 'string' && v.trim() !== '') return { value: v.trim(), source: lv.where, ignored }
    ignored.push(`${lv.where}: ${name} = ${JSON.stringify(v)} is invalid, ignored`)
  }
  return null
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
  if (env !== null && typeof env === 'object') {
    for (const k of KEYS) {
      const v = (env as Record<string, unknown>)[envName(k)]
      if (v !== undefined) values[k] = v
    }
    // Per-agent entries are kept under their env name; resolveAgent looks them up by it.
    const prefixes = AGENT_FAMILIES.map(agentEnvPrefix)
    for (const [name, v] of Object.entries(env as Record<string, unknown>)) if (prefixes.some(p => name.startsWith(p))) values[name] = v
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

/** `.ai-dlc/lens.schema.json`, written by `/ai-dlc:lens-init`. */
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
              : s.kind === 'list'
                ? { ...base, anyOf: [{ type: 'array', items: { enum: [...s.values] }, minItems: 1, uniqueItems: true }, { type: 'string', minLength: 1 }] }
                : { ...base, type: 'string', minLength: 1 }
  }
  const patterns: Record<string, unknown> = {
    '^avatarImage\\.[A-Za-z0-9][A-Za-z0-9_.-]*(:[A-Za-z0-9][A-Za-z0-9_.-]*)?$': {
      type: 'string',
      minLength: 1,
      description:
        "One agent's avatar: a data URI (data:image/png;base64,...) or a path to an image file inside a folder Claude Code trusts. The agent part is the agent ID for an ai-dlc agent, else the whole agent type. Env: AI_DLC_LENS_AVATAR_IMAGE__<AGENT> (capitals; ':' as '__', '-' and '.' as '_').",
    },
  }
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'AI-DLC lens settings',
    description: 'Overridden by AI_DLC_LENS_* in the env of .claude/settings.json, then of .claude/settings.local.json. The process environment is not read.',
    type: 'object',
    additionalProperties: false,
    properties: props,
    patternProperties: patterns,
  }
}

/** The text `/ai-dlc:lens-init` writes to `.ai-dlc/lens.json`: every default. */
export const initialFile = (): string => JSON.stringify({ $schema: './lens.schema.json', ...DEFAULTS }, null, 2) + '\n'

/** `/ai-dlc:lens-configure <key> <value>`: the new lens.json text, or why not. */
export function setKey(text: string | null, k: string, raw: string): { text: string; error: string } {
  const perAgent = agentKeyParts(k)
  if (!(KEYS as string[]).includes(k) && perAgent === null)
    return {
      text: '',
      error: k.startsWith('avatarImage.') ? `${k}: the agent part is empty or not an agent ID or type` : `unknown key ${k}; keys: ${KEYS.join(', ')}, avatarImage.<agent>`,
    }
  let json: Record<string, unknown> = { $schema: './lens.schema.json' }
  if (text !== null) {
    const f = fileLevel('lens.json', text)
    if (f.problem !== '') return { text: '', error: f.problem }
    json = { ...f.level.values }
  }
  if (perAgent !== null) {
    // The value's own checks (trust, type, size) are the caller's: they need the file system.
    if (raw === '--unset') delete json[k]
    else if (raw.trim() === '') return { text: '', error: `${k} needs a value` }
    else json[k] = raw.trim()
    return { text: JSON.stringify(json, null, 2) + '\n', error: '' }
  }
  const key = k as Key
  if (raw === '--unset') {
    delete json[key]
    return { text: JSON.stringify(json, null, 2) + '\n', error: '' }
  }
  // A typed value: the same parse as an env string, then stored as its JSON type.
  const v = coerce(key, raw, true)
  if (v === undefined) {
    const s: Spec = SPEC[key]
    const want =
      s.kind === 'int'
        ? `an integer ${s.min}..${s.max}`
        : s.kind === 'bool'
          ? 'true or false'
          : s.kind === 'enum'
            ? s.values.join(' | ')
            : s.kind === 'color'
              ? 'a hex colour such as #2e7d32'
              : s.kind === 'list'
                ? `a comma-separated list of ${s.values.join(', ')}`
                : 'a non-empty path'
    return { text: '', error: `${raw} is not valid for ${key}: ${want}` }
  }
  json[key] = v
  return { text: JSON.stringify(json, null, 2) + '\n', error: '' }
}
