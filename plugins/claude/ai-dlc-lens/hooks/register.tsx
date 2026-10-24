// ai-dlc-lens hooks module. Started from spike ITEM-027 (rounds 0-6 below, run FEAT-20261020-ai-dlc-lens);
// the code is the round 6 code, renamed, and still goes through that run's scope pass and gates G1-G3.
// Round 1 (step 17): the human's lens card. `/ai-dlc:lens` opens it:
//   L1 orchestrator view: thinking and gathered context, each collapsible (pane section, step 16 Q1)
//   L2 flowchart: an avatar per agent (Svg), a Button per avatar and per arrow under it (step 16 Q2)
//   L4 arrow -> separate pane `lens-edge` (or drill-in): handoff record, hand-back, their tokens
//   L5 avatar -> separate pane `lens-agent` (or drill-in): background tasks, tool calls, thinking
//   L6 loops draw a two-way arrow; running avatars blink green, finished ones stay green
// Round 2 (step 17.l1): the same flowchart sits at the top of the chat card. The ToolUse row of the
// first Agent call of an assistant message draws it for every Agent call of that message (parallel
// spawns side by side), with the avatar and arrow Buttons, collapsible thinking and gathered context,
// and the native row last; the message's other Agent rows stay compact, native row kept.
// Round 3 (step 17.l2): the human's findings. A smaller chart with name, model and role only (no
// figures); a chip with an "Open flowchart" Button when the row is too narrow; persona names from
// the roster, models from the agent definitions, readable roles; the figures, the cost (from
// `.ai-dlc/model-costing.json` only) and the window in the avatar panel; the arrow panel falls
// back to the orchestrator's prompt; the native row is drawn without the prompt (whole when
// expanded); only running agents blink; every collapsible starts collapsed; every setting comes
// from hooks/settings.ts levels. Root cause of the missing second agent: see `ensureIn` (lens.ts).
// Rounds 4-5 (steps 17.l3, 17.l4): the workflow pane, the one-line chat card, task titles, the status dot.
// Round 6 (step 17.l5): the pane's own minimise and close row; every workflow and every task a collapsed
// panel; close and Esc on every lens pane; the two-colour dot and "waiting" for any agent; notices as
// an exclamation icon with a hover card; a spawn for the same task joins its workflow; no bottom filler.
// Step 1.4 (run AAW-20261023-lens-plugin-from-spike): the commands are /ai-dlc:lens, /ai-dlc:lens-init,
// /ai-dlc:lens-configure, /ai-dlc:lens-kit, /ai-dlc:lens-keepalive and /ai-dlc:lens-gate. A hooks module can
// only register a bare name (CommandSpec.name: letters, digits, _ and -, d.ts:1924), so each name comes from a
// thin skill of the ai-dlc plugin (skills/lens*), which Claude Code lists as /ai-dlc:<skill>, and the
// command.run hooks below answer its runs in the skill's place (the cache-keepalive precedent). The module
// registers no command of its own. Pane ids allow no ':' (PaneOpenArgs.id, d.ts:7590), so they are ai-dlc-lens-*.
// Step 1.5: avatar and arrow Buttons open as a tab or drill-in (`panelOpenMode`, the view's `Panel Type` switch), from
// the chat card, the workflow view and the lens pane; the flowchart is drawn in the first spawn's chat card again
// (`chartInChat`) and in the workflow view (`chartInPane`); the view has pinned (the AbovePrompt band) / docked
// (the pane), full screen, minimise and restore on its first row; a workflow's identity is its run (`joinWorkflow`),
// and the view stacks the runs on the right when wide and lists them minimised when narrow (`workflowBody`).
// Step 1.6.1: /ai-dlc:lens-gate is an anomaly detector (hooks/anomaly.ts, `detectNow`): a toast once per anomaly, a
// marker on its run, avatar or arrow, an Anomalies section; the GATE-ALERT.txt marker and its command Stop hook are gone.
// Background tasks are one keyed entry per task id (`uniqueTasks`); the agent and hand-off tabs have minimise (A2);
// a run's chart draws a later spawn by another spawner (A3, `workflowBatch`).
// Experiments E1, E2, E4, E5, E7, E9 and E10 log to PROBE-LOG.jsonl while the `probes` setting is on (off by default).
// The round-0 kit (checks 1-5: resize, Svg blink, buttons, transcript cards, gate alert) is `/ai-dlc:lens-kit`.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderElement, Timer } from 'claude-code'
import type { LensAgent, LensAnomaly, LensBatch, LensCall, LensConfig, LensCosting, LensDef, LensDoc, LensDrill, LensNotice, LensRun, LensTask, LensUi, LensView, LensWorkflows, Tokens } from '../types'
import {
  AGENT_TOOLS,
  CONTEXT_TOOLS,
  drawOr,
  ENDED,
  ZERO,
  addTokens,
  addToBatch,
  batchView,
  contextUsed,
  costOfAgent,
  ensureIn,
  flowchartSvg,
  firstLine,
  fmtClock,
  fmtTokens,
  fromUsage,
  humanRole,
  initials,
  isAgentTask,
  isHumanRequest,
  isNotice,
  isPersonOrigin,
  isWaiting,
  noticeWorkflow,
  REQS_CAP,
  runningAndWaiting,
  statusLooks,
  taskKeyOf,
  runOfKey,
  unifyRuns,
  callRunIds,
  workflowTasks,
  isRespawn,
  isRunning,
  leadOf,
  matchHandoff,
  mergeStopTasks,
  modelOf,
  notePending,
  parseDefinition,
  parseRecord,
  parseRoster,
  parseRun,
  personaOf,
  pickHandback,
  joinWorkflow,
  limitRows,
  lookupModel,
  parseCosting,
  pluginOf,
  roleOf,
  runDirOf,
  stampTasks,
  uniqueTasks,
  statusBadge,
  statusDotSvg,
  summarize,
  taskLine,
  textChart,
  usageBar,
  windowOf,
  workflowBatch,
  workflowStatus,
  workflowTask,
  WF0,
  keepaliveLine,
  fmtSpan,
  keptWarm,
  noteKeepalive,
  savingsOfAgent,
  sessionSavings,
  VIEW0,
  BAND_SURFACES,
  bandEverywhere,
  layoutOf,
  openModeOf,
  openSizeOf,
  placeOf,
  selectedOf,
  newestFirst,
  runIdOf,
  runRoots,
  PARENT_DEPTH,
  folderNameOf,
  mergedHomeOf,
  workflowRunOf,
  paneFault,
  showChart,
  viewResize,
  viewRestore,
  parseRecordName,
  stepCharts,
  stepsDescending,
  pickRunState,
  isRunStateFile,
  isRenameSource,
  codeMapOf,
  composeCodeMaps,
  NO_STEP,
  NOT_FOUND,
  OPEN,
  topStepOf,
  cardCharts,
  spawnPlace,
} from './lens'
import type { ChartLabel, ChartSize, FlowStatus, KeepaliveCycle, StepChart, StepSource } from './lens'
import { DEFAULTS, KEYS, agentEnvName, agentEnvPrefix, agentKeyParts, envLevel, envName, fileLevel, initialFile, resolve, resolveAgent, schema, setKey } from './settings'
import type { Key, Level, LensSettings } from './settings'
import { SVG_CAP, avatarKey, avatarSvg, checkBytes, classify, isInside, own, trustedFolders, typesOf } from './avatar'
import type { AvatarImage, ChartAvatars } from './avatar'
import { anomaliesOf, anomalyLine, applySettings, colorOf, detectAgents, detectRun, diffAnomalies, edgeAgentOf, frontMatter, handoffsRoot, normDir, recordName, runsToRead, trackWaiting, worstOf } from './anomaly'

// Pane ids: 1-64 of letters, digits, `_` and `-` (PaneOpenArgs.id, d.ts:7590; `$.ui.open`, d.ts:2524), so
// `ai-dlc:lens-*` is not a valid id; `ai-dlc-lens-*` is the closest. The titles stay readable.
const KIT = 'ai-dlc-lens-kit'
const LENS = 'ai-dlc-lens'
const EDGE = 'ai-dlc-lens-edge'
const AGENT = 'ai-dlc-lens-agent'
const CHART = 'ai-dlc-lens-chart'
// The commands, served by the ai-dlc skills of the same names (skills/lens*).
const CMD = {
  lens: 'ai-dlc:lens',
  init: 'ai-dlc:lens-init',
  configure: 'ai-dlc:lens-configure',
  kit: 'ai-dlc:lens-kit',
  keepalive: 'ai-dlc:lens-keepalive',
  gate: 'ai-dlc:lens-gate',
} as const
const LENS_JSON = '.ai-dlc/lens.json'
const LENS_SCHEMA = '.ai-dlc/lens.schema.json'
const SETTINGS_LOCAL = '.claude/settings.local.json'
const SETTINGS_PROJECT = '.claude/settings.json'

// ---- round-0 kit state ----
const tick = atom({ plugin: 'ai-dlc-lens', key: 'tick' } as const, false)
const paneExpanded = atom({ plugin: 'ai-dlc-lens', key: 'paneExpanded' } as const, false)
const panePresses = atom({ plugin: 'ai-dlc-lens', key: 'panePresses' } as const, 0)
const forceMode = atom({ plugin: 'ai-dlc-lens', key: 'forceMode' } as const, 'auto')

// ---- round-1 lens state ----
const UI0: LensUi = { edge: null, agent: null, edgeSnap: null, agentSnap: null }
const DOC0: LensDoc = { agent: '', handoff: '', handoffText: '', handback: '', handbackText: '', error: '', prompt: '', hint: '' }
const agentsA = atom({ plugin: 'ai-dlc-lens', key: 'agents' } as const, {}, { shape: 'agents-3' })
const orderA = atom({ plugin: 'ai-dlc-lens', key: 'order' } as const, [], { shape: 'order-1' })
const callsA = atom({ plugin: 'ai-dlc-lens', key: 'calls' } as const, {}, { shape: 'calls-1' })
const thinkingA = atom({ plugin: 'ai-dlc-lens', key: 'thinking' } as const, {})
const contextA = atom({ plugin: 'ai-dlc-lens', key: 'context' } as const, [], { shape: 'context-1' })
const mainWindowA = atom({ plugin: 'ai-dlc-lens', key: 'mainWindow' } as const, 0)
const uiA = atom({ plugin: 'ai-dlc-lens', key: 'ui' } as const, UI0, { shape: 'ui-3' })
const docA = atom({ plugin: 'ai-dlc-lens', key: 'doc' } as const, DOC0, { shape: 'doc-2' })
const probeLinesA = atom({ plugin: 'ai-dlc-lens', key: 'probeLines' } as const, 0)
// ---- round-2 chat card state ----
const batchesA = atom({ plugin: 'ai-dlc-lens', key: 'batches' } as const, {}, { shape: 'batches-2' })
/** Every [+]/[-] section, by key; absent: the `collapsedByDefault` setting decides. */
const cardOpenA = atom({ plugin: 'ai-dlc-lens', key: 'cardOpen' } as const, {})
// ---- round-3 state ----
/** tool_use_id -> agent id, written by `agent.spawn` and the Agent call's result: never overwritten by a blank record. */
const callAgentA = atom({ plugin: 'ai-dlc-lens', key: 'callAgent' } as const, {})
const defsA = atom({ plugin: 'ai-dlc-lens', key: 'defs' } as const, {}, { shape: 'defs-1' })
const rosterA = atom({ plugin: 'ai-dlc-lens', key: 'roster' } as const, {})
const costingA = atom({ plugin: 'ai-dlc-lens', key: 'costing' } as const, { path: '', text: '', error: 'not read yet' }, { shape: 'costing-1' })
const chartLeadA = atom({ plugin: 'ai-dlc-lens', key: 'chartLead' } as const, '')
// ---- round-4 state ----
/** Agent call -> the request or brief that made it: a workflow's title when no run names it. */
const callTaskA = atom({ plugin: 'ai-dlc-lens', key: 'callTask' } as const, {})
/** The main loop's latest request (`turn.start` text, first line). */
const mainPromptA = atom({ plugin: 'ai-dlc-lens', key: 'mainPrompt' } as const, '')
/** Workflows across messages and turns (round 4 bug): see `joinWorkflow`. */
const workflowsA = atom({ plugin: 'ai-dlc-lens', key: 'workflows' } as const, WF0, { shape: 'workflows-1' })
/** The workflow pane opens by itself once a session, on the first spawn. */
let workflowOpened = false
const LENS0: LensConfig = { settings: { ...DEFAULTS }, sources: Object.fromEntries(KEYS.map(k => [k, 'default'])), ignored: [] }
const lensA = atom({ plugin: 'ai-dlc-lens', key: 'lens' } as const, LENS0, { shape: 'lens-3' })
// ---- round-5 state ----
/** Each run folder a brief named -> its `run.md` as parsed: the titles and the status follow it (requirement 2). */
const runsA = atom({ plugin: 'ai-dlc-lens', key: 'runs' } as const, {}, { shape: 'runs-1' })
// ---- round-6 state ----
/** Automatic notices fed to the main loop (A7): shown as an exclamation icon, never as a task title. */
const noticesA = atom({ plugin: 'ai-dlc-lens', key: 'notices' } as const, [], { shape: 'notices-1' })
/** Agent call -> its task key (`taskKeyOf`): a spawn for the same task joins its workflow (A8). */
const callKeyA = atom({ plugin: 'ai-dlc-lens', key: 'callKey' } as const, {})
// ---- step 1.5 state ----
/** Drill-in views by drawing: `lens` (the /ai-dlc:lens pane), `pane` (the workflow pane and band), `card:<call>` (a chat card). */
const drillsA = atom({ plugin: 'ai-dlc-lens', key: 'drills' } as const, {}, { shape: 'drills-1' })
/** The workflow view: pinned or docked, normal, minimised (A1's one-line bar) or full screen, the sizes restore returns to, the run selected. */
const viewA = atom({ plugin: 'ai-dlc-lens', key: 'view' } as const, VIEW0, { shape: 'view-1' })
/** The view's `Panel Type` switch: `tab` or `drill-in` for this session; '' follows the `panelOpenMode` setting. */
const openModeA = atom({ plugin: 'ai-dlc-lens', key: 'openMode' } as const, '')
/** The workflow pane's last viewport (full screen asks for its rows and columns) and the session's surfaces (pinned needs the band). */
let lastViewport: { columns?: number; rows?: number } | undefined
const NOTICES_KEPT = 20
// ---- avatars (spike ITEM-029, robot addendum) ----
/** Bumped whenever an agent's avatar image is loaded or dropped: the drawings read it to redraw. */
const avatarRevA = atom({ plugin: 'ai-dlc-lens', key: 'avatarRev' } as const, 0)
// ---- /ai-dlc:lens-keepalive (step 1.4) ----
/** Each keep-alive arming the lens has read, by `<track>@<armedAt>`: the time of earlier armings survives the next one. */
// Step 1.6.1: the anomalies /ai-dlc:lens-gate detects (hooks/anomaly.ts), and the agent and hand-off tabs' minimise (A2).
const anomaliesA = atom({ plugin: 'ai-dlc-lens', key: 'anomalies' } as const, [], { shape: 'anomalies-1' })
const tabsMinA = atom({ plugin: 'ai-dlc-lens', key: 'tabsMin' } as const, {})
/** Step 8.6.1: the step chart full screen shows, per workflow; absent: the first in order, the highest code. */
const stepSelA = atom({ plugin: 'ai-dlc-lens', key: 'stepSel' } as const, {})
const kaCyclesA = atom({ plugin: 'ai-dlc-lens', key: 'keepaliveCycles' } as const, {}, { shape: 'ka-cycles-1' })
/** The settings levels of the last load, highest first: per-agent keys are resolved from them. */
let levelsNow: Level[] = []
/** Avatar key -> its image as loaded, or why there is none, and the inputs it was loaded from. Module-local: images can be large. */
const avatarCache: Record<string, { sig: string; img: AvatarImage | null; why: string; setting: string }> = {}
/** Prompts `prompt.submit` saw arrive from something other than the person (A7): `turn.start` skips them. */
const noticeTexts = new Set<string>()
/** As many as the notices kept: the oldest goes first (a Set keeps insertion order). */
function rememberNotice(text: string) {
  noticeTexts.delete(text)
  noticeTexts.add(text)
  while (noticeTexts.size > NOTICES_KEPT) noticeTexts.delete(noticeTexts.values().next().value as string)
}
/** The session's pollers (`$.clock.every`): stopped at the next `session.start` and at `session.end`. */
const timers: Timer[] = []
function stopTimers() {
  for (const t of timers.splice(0)) t.cancel()
}

// Tools whose rows get a transcript card. `Task` is the Agent tool's name in headless runs.
const CARD_TOOLS = new Set(['Agent', 'Task', 'SendMessage'])

// Module-local (reset on reload).
type Redraw = { n: number; body: number; cols: number | undefined; placement: string; fs: string; mode: string }
const redraws: Redraw[] = []
let redrawCount = 0
let toolResultHooks = 0
let toolUseCards = 0
let stopEvents = 0
let cwd = ''
let probeOn = false
let probePath = ''
const probeLog: string[] = []
let probeWrite: Promise<void> = Promise.resolve()
const thinkBuf: Record<string, string> = {}
/** Thinking blocks streamed per loop (distinct block index per step), text or not. */
const thinkBlocks: Record<string, number> = {}
/** tool_use_id -> the output tokens of the step that asked for it and how many calls that step asked for. */
const stepOfCall: Record<string, { out: number; n: number }> = {}
const lastStatus: Record<string, string> = {}
/** The settings non-drawing code uses (limits); the drawings read `lensA`. */
let cfg: LensSettings = { ...DEFAULTS }

const nowMs = () => Date.now()
const cap = (s: string, n: number) => (s.length > n ? s.slice(0, n) + `\n... [+${s.length - n} chars]` : s)

const blankAgent = (id: string, parent: string | null, type: string): LensAgent => ({
  id,
  parent,
  type,
  name: '',
  description: '',
  model: '',
  callModel: '',
  parentModel: '',
  prompt: '',
  status: 'running',
  toolUseId: '',
  steps: ZERO,
  turns: ZERO,
  last: null,
  handoff: null,
  handoffHow: 'none',
  loop: false,
  startedAt: nowMs(),
  endedAt: null,
  bg: [],
  reqs: [],
})

const svgDot = (fill: string, animated: boolean) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">` +
  `<circle cx="12" cy="12" r="9" fill="${fill}">` +
  (animated ? `<animate attributeName="opacity" values="1;0.15;1" dur="1s" repeatCount="indefinite"/>` : '') +
  `</circle></svg>`

// ---- step 1.6.1: /ai-dlc:lens-gate, the anomaly detector (replaces the GATE-ALERT.txt marker and its command Stop hook) ----
/** When each agent was first seen waiting (anomaly.ts `trackWaiting`). */
let waitingSince: Record<string, number> = {}
/** Record texts by path, kept while the file's size and time do not change: the 2 s poll reads little. */
let recordCache: Record<string, { sig: string; text: string | null }> = {}
/** What the last pass could not read (malformed or missing), shown by a bare /ai-dlc:lens-gate. */
let anomalySkipped: string[] = []
/** The anomalies as last detected: the poll's "an anomaly stands" test, and the fallback of a failed pass. Drawings read `anomaliesA`. */
let anomaliesNow: LensAnomaly[] = []
/** Passes run one at a time, so two triggers never toast one anomaly twice. */
let detectChain: Promise<unknown> = Promise.resolve()

/**
 * Step 1.6.1.l1 (addendum A5): the workflows as drawn, one per run (`unifyRuns`): a run split by an
 * earlier lens, another session, a resumed agent or a lost key is shown as one workflow (since step 8.6.1 drawn
 * as one chart per top-level step, `flowSteps`). Read-only.
 */
async function readWorkflows($: EngineInterface): Promise<LensWorkflows> {
  const wf = await read($, workflowsA)
  const keys = await read($, callKeyA)
  const agents = await read($, agentsA)
  const callAgent = await read($, callAgentA)
  return unifyRuns(wf, keys, agents, callAgent, await readRoots($))
}

/**
 * Step 27.1: the runs drawn in another run (`runRoots`): a run.md with `parent:`, followed to the top while
 * each parent is known (its run.md read by `refreshRuns`, or named by a call). Read-only.
 */
async function readRoots($: EngineInterface): Promise<Record<string, string>> {
  const wf = await read($, workflowsA)
  const keys = await read($, callKeyA)
  const agents = await read($, agentsA)
  const callAgent = await read($, callAgentA)
  const runs = await read($, runsA)
  return runRoots(runs, Object.values(callRunIds(wf, keys, agents, callAgent)))
}

/** The run folders the lens knows: those the briefs of its agents and pending calls name. */
async function runDirs($: EngineInterface): Promise<string[]> {
  const agents = await read($, agentsA)
  const batches = await read($, batchesA)
  const dirs = new Set<string>()
  for (const a of Object.values(agents)) {
    const d = runDirOf(a)
    if (d !== null) dirs.add(d)
  }
  for (const b of Object.values(batches))
    for (const p of Object.values(b.pending)) {
      const d = runDirOf({ handoff: null, prompt: p.prompt })
      if (d !== null) dirs.add(d)
    }
  return [...dirs]
}

type ListEntry = { name: string; kind?: string; size?: number; mtimeMs?: number }

/**
 * Every run folder under the handoff folder (`artifacts.handoffs` of .ai-dlc/workflow.json, default
 * docs/handoffs, `handoffsRoot`). A handoff folder that cannot be listed is named in `skipped`.
 */
async function runFolders($: EngineInterface, skipped: string[]): Promise<string[]> {
  const { root, depth } = handoffsRoot(await readText($, '.ai-dlc/workflow.json'))
  let level = [root]
  for (let i = 0; i < depth; i++) {
    const next: string[] = []
    for (const d of level) {
      try {
        for (const e of (await $.fs.list(d)) as ListEntry[]) if (e.kind === 'dir') next.push(`${d}/${e.name}`)
      } catch {
        if (i === 0) skipped.push(`${d}: not listable`)
      }
    }
    level = next
  }
  return level
}

/**
 * Step 1.6.1.l1 (`anomalyRunScope` all): every run folder (`runFolders`), with its run.md text (re-read only
 * when it changed), its status and its listing. A folder with no run.md is left out; a folder that cannot be
 * listed is named in `skipped`.
 */
async function scanRuns($: EngineInterface, skipped: string[]): Promise<{ dir: string; text: string | null; status: string; entries: ListEntry[] }[]> {
  const level = await runFolders($, skipped)
  const out: { dir: string; text: string | null; status: string; entries: ListEntry[] }[] = []
  for (const d of level) {
    let entries: ListEntry[] = []
    try {
      entries = (await $.fs.list(d)) as ListEntry[]
    } catch {
      skipped.push(`${d}: not listable`)
      continue
    }
    // The run state is `run.md` or a versioned `run.v<major>[.<minor>].md` (`isRunStateFile`).
    if (!entries.some(e => e.kind !== 'dir' && isRunStateFile(e.name))) continue
    const text = await readRunState($, d, entries)
    out.push({ dir: normDir(d), text, status: text === null ? '' : (frontMatter(text)['status'] ?? ''), entries })
  }
  return out
}

/** A listed file's change signature for `recordText`: size and time; '' (never cached) when the listing gives neither. */
const sigOf = (e: ListEntry | undefined): string => (e === undefined || (e.size === undefined && e.mtimeMs === undefined) ? '' : `${e.size ?? ''}:${e.mtimeMs ?? ''}`)

/** A record's text, re-read only when `fs.list` shows it changed. */
async function recordText($: EngineInterface, path: string, sig: string): Promise<string | null> {
  const hit = recordCache[path]
  if (hit !== undefined && hit.sig === sig && sig !== '') return hit.text
  const text = await readText($, path)
  recordCache[path] = { sig, text }
  return text
}

/**
 * One detection pass: every known run's run.md and records, and every agent's state. A new anomaly
 * gets one toast (`toast`), an existing one keeps its first-seen time, a gone one leaves the list.
 * Never throws: a run that cannot be read is skipped and named in `anomalySkipped`.
 */
function detectNow($: EngineInterface, toast = true): Promise<LensAnomaly[]> {
  const run = detectChain.then(() => detectPass($, toast))
  detectChain = run.catch(() => undefined)
  return run.catch(err => {
    lensFail('anomaly detector', err)
    return anomaliesNow
  })
}

async function detectPass($: EngineInterface, toast: boolean): Promise<LensAnomaly[]> {
  const prev = await read($, anomaliesA)
  const now = nowMs()
  const agents = await read($, agentsA)
  waitingSince = trackWaiting(agents, waitingSince, now)
  let found: LensAnomaly[] = []
  const skipped: string[] = []
  if (cfg.gateAlert === true) {
    // Step 1.6.1.l1: anomalyRunScope all also reads every active or blocked run under the handoff folder.
    const scanned = cfg.anomalyRunScope === 'all' ? await scanRuns($, skipped) : []
    const known = new Map(scanned.map(x => [x.dir, x]))
    for (const d of runsToRead(String(cfg.anomalyRunScope), await runDirs($), scanned)) {
      try {
        const hit = known.get(d)
        const runText = hit !== undefined ? hit.text : await readRunState($, d)
        if (runText === null) continue
        let entries: ListEntry[] = hit?.entries ?? []
        if (hit === undefined)
          try {
            entries = (await $.fs.list(d)) as ListEntry[]
          } catch {
            skipped.push(`${d}: not listable`)
          }
        const files: { name: string; text: string | null }[] = []
        for (const f of entries) {
          const r = f.kind === 'dir' ? null : recordName(f.name)
          if (r === null) continue
          // Only hand-backs and records to the human are read; the rest count by name.
          const want = r.kind === 'handback' || r.to === 'human'
          files.push({ name: f.name, text: want ? await recordText($, `${d}/${f.name}`, `${f.size ?? ''}:${f.mtimeMs ?? ''}`) : '' })
        }
        const r = detectRun(d, runText, files, now)
        found.push(...r.list)
        skipped.push(...r.skipped)
      } catch (err) {
        skipped.push(`${d}: ${String(err).slice(0, 120)}`)
      }
    }
    found.push(...detectAgents(agents, waitingSince, now, cfg.anomalyWaitingMinutes))
    found = found.map(a => (a.target === 'edge' && a.agent === '' ? { ...a, agent: edgeAgentOf(a, agents) } : a))
  }
  const { list, appeared } = diffAnomalies(prev, applySettings(found, cfg))
  anomaliesNow = list
  anomalySkipped = skipped
  if (JSON.stringify(prev) !== JSON.stringify(list)) await update($, anomaliesA, () => list)
  if (skipped.length > 0) await plog($, 'anomaly', { skipped })
  if (toast && appeared.length > 0) {
    const more = appeared.length > 1 ? ` (+${appeared.length - 1} more: /ai-dlc:lens-gate)` : ''
    $.ui.toast(`ai-dlc-lens: ${anomalyLine(appeared[0]!)}${more}`)
  }
  return list
}

/** What a drawing marks with ▲: the anomalies it read (`snapshot`) and the settings that colour them. */
type Marks = { list: readonly LensAnomaly[]; s: LensSettings }

/** The anomaly marker: a triangle in the worst colour, and the count when more than one. Never the status dot. */
function anomalyMark(t: any, list: readonly LensAnomaly[], s: LensSettings) {
  const { Text } = t
  const w = worstOf(list)
  if (w === null) return null
  return (
    <Text color={colorOf(w.kind, s)} bold>
      {'▲'}
      {list.length > 1 ? String(list.length) : ''}
    </Text>
  )
}

async function readText($: EngineInterface, path: string): Promise<string | null> {
  try {
    return String(await $.fs.read(path))
  } catch {
    return null
  }
}

/**
 * A run folder's run state. A run keeps a major version per session and a minor pair per change of direction
 * (`run.v1.md`, `run.v1.1.md`, `run.v1.2.md`, `run.v2.md`, …; the handoff skill, *Run state*): the highest
 * version that can be read is current (`pickRunState`, which reads highest first and stops there), else
 * `run.md`. Each file is read through `recordText`, so an unchanged one is not read again. `entries`: the
 * folder's listing when the caller has it. Null: none.
 */
async function readRunState($: EngineInterface, dir: string, entries?: ListEntry[]): Promise<string | null> {
  let list = entries
  if (list === undefined)
    try {
      list = (await $.fs.list(dir)) as ListEntry[]
    } catch {
      list = []
    }
  const files = (Array.isArray(list) ? list : []).filter(e => e.kind !== 'dir')
  const text = (name: string) => recordText($, `${dir}/${name}`, sigOf(files.find(e => e.name === name)))
  const hit = await pickRunState(
    files.map(e => e.name),
    text,
  )
  return hit !== null ? hit.text : text('run.md')
}

// ---- settings (addendum 3): local env > project env > .ai-dlc/lens.json > default; never the process env ----
async function loadSettings($: EngineInterface): Promise<LensConfig> {
  const local = envLevel(SETTINGS_LOCAL, await readText($, SETTINGS_LOCAL))
  const project = envLevel(SETTINGS_PROJECT, await readText($, SETTINGS_PROJECT))
  const file = fileLevel(LENS_JSON, await readText($, LENS_JSON))
  const r = resolve([local.level, project.level, file.level])
  const problems = [local.problem, project.problem, file.problem].filter(x => x !== '')
  const conf: LensConfig = { settings: r.settings, sources: r.sources, ignored: [...problems, ...r.ignored] }
  cfg = r.settings
  // Step 1.4: the experiments lost their command; the `probes` setting (off by default) turns them on.
  probeOn = r.settings.probes === true
  levelsNow = [local.level, project.level, file.level]
  await update($, lensA, () => conf)
  // A changed avatar setting reloads that agent's image; an unchanged one is kept.
  const types = new Set(Object.keys(await read($, defsA)))
  for (const a of Object.values(await read($, agentsA))) types.add(a.type)
  for (const type of types) await loadAvatar($, type)
  return conf
}

/** The user's home folder (Windows sets USERPROFILE, not HOME); only the trust check reads it. */
async function homeDir($: EngineInterface): Promise<string | undefined> {
  try {
    return (await $.env.get('HOME')) || (await $.env.get('USERPROFILE')) || undefined
  } catch {
    return undefined
  }
}

/**
 * An `avatarImage` value as an image, or why not (AC-13.3 to 13.7, 13.9). A data URI is checked for
 * type and size and never fetched. A file path must resolve (every link followed, `..` folded) to a
 * real path inside a folder Claude Code trusts (~/.claude.json), be a file within the size limit and
 * start as an allowed image type; the real path is what is read. Anything else is refused.
 */
async function readImage($: EngineInterface, value: string, types: readonly string[], maxBytes: number): Promise<{ img: AvatarImage } | { why: string }> {
  const src = classify(value)
  if (src.kind === 'refused') return { why: src.why }
  if (src.kind === 'data') {
    const c = checkBytes(src.base64, src.mime, types, maxBytes)
    if ('why' in c) return c
    return { img: { uri: `data:${c.mime};base64,${src.base64}`, bytes: c.bytes, png: null } }
  }
  const home = await homeDir($)
  const folders = trustedFolders(home !== undefined ? await readText($, `${home}/.claude.json`) : null)
  const real: string[] = []
  for (const f of folders) {
    const st = await $.fs.stat(f, { resolve: true }).catch(() => undefined)
    if (st !== undefined && typeof st.realPath === 'string') real.push(st.realPath)
  }
  const st = await $.fs.stat(src.path, { resolve: true }).catch(() => undefined)
  if (st === undefined) return { why: 'the file does not exist' }
  if (typeof st.realPath !== 'string') return { why: 'its real path cannot be resolved' }
  if (!isInside(st.realPath, real)) return { why: 'it is outside every folder Claude Code trusts' }
  if (st.kind !== 'file') return { why: 'it is not a file' }
  if (st.size > maxBytes) return { why: `${st.size} bytes, over avatarImageMaxBytes (${maxBytes})` }
  let base64 = ''
  try {
    const r: unknown = await $.fs.read(st.realPath, { as: 'bytes' })
    if (r !== null && typeof r === 'object' && typeof (r as { base64?: unknown }).base64 === 'string') base64 = (r as { base64: string }).base64
  } catch {
    return { why: 'it could not be read' }
  }
  const c = checkBytes(base64, null, types, maxBytes)
  if ('why' in c) return c
  return { img: { uri: `data:${c.mime};base64,${base64}`, bytes: c.bytes, png: c.mime === 'image/png' ? base64 : null } }
}

/** Loads (or keeps) the avatar image of an agent type; bumps `avatarRevA` when what draws changed. */
async function loadAvatar($: EngineInterface, type: string) {
  const key = avatarKey(type)
  const found = cfg.avatarStyle === 'initials' ? null : resolveAgent(levelsNow, 'avatarImage', key)
  const sig = found === null ? '' : `${found.value}|${cfg.avatarImageTypes}|${cfg.avatarImageMaxBytes}`
  const had = avatarCache[key]
  if (had !== undefined && had.sig === sig) return
  if (found === null) {
    avatarCache[key] = { sig, img: null, why: '', setting: '' }
  } else {
    const setting = `avatarImage.${key} [${found.source}]`
    const r = await readImage($, found.value, typesOf(cfg.avatarImageTypes), cfg.avatarImageMaxBytes)
    avatarCache[key] = 'img' in r ? { sig, img: r.img, why: '', setting } : { sig, img: null, why: r.why, setting }
  }
  if ((had?.img ?? null) !== null || avatarCache[key]!.img !== null) await update($, avatarRevA, n => (n as number) + 1)
}

/** What the drawings need of the avatars: the style, and each agent's loaded image. */
const chartAvatars = (s: LensSettings): ChartAvatars => ({
  style: s.avatarStyle,
  image: key => (s.avatarStyle === 'initials' ? null : (avatarCache[key]?.img ?? null)),
})

/** The refused avatar images, one line each, for /ai-dlc:lens-configure. */
const avatarNotes = (): string[] =>
  Object.values(avatarCache)
    .filter(c => c.why !== '')
    .map(c => `${c.setting}: refused, ${c.why}; the default avatar draws`)

const chartSize = (s: LensSettings): ChartSize => ({ col: s.chartColumnPx, row: s.chartRowPx, perRow: s.chartAvatarsPerRow, r: s.avatarRadiusPx, blink: s.blink, blinkMs: s.blinkMs })

/** Addendum A7: the chart settings in full screen: columns, rows and avatars 1.5 times larger, within each setting's maximum. */
const fullscreenSettings = (s: LensSettings): LensSettings => ({
  ...s,
  chartColumnPx: Math.min(400, Math.round(s.chartColumnPx * 1.5)),
  chartRowPx: Math.min(400, Math.round(s.chartRowPx * 1.5)),
  avatarRadiusPx: Math.min(40, Math.round(s.avatarRadiusPx * 1.5)),
})

/** The model metadata file: `.ai-dlc/model-metadata.json`, else its earlier name `.ai-dlc/model-costing.json` (read only). */
async function loadCosting($: EngineInterface) {
  let c: LensCosting = { path: cfg.costingPath, text: '', error: `${cfg.costingPath} and ${cfg.costingFallbackPath} not found` }
  for (const path of [cfg.costingPath, cfg.costingFallbackPath]) {
    const text = await readText($, path)
    if (text !== null) {
      c = { path, text, error: '' }
      break
    }
  }
  await update($, costingA, () => c)
}

async function loadRoster($: EngineInterface) {
  const text = await readText($, cfg.rosterPath)
  await update($, rosterA, () => (text === null ? {} : parseRoster(text)))
}

/** Addendum L1: where each run folder without a run.md was merged (`mergedHomeOf`), by run id; a miss is looked up again after MERGED_RETRY_MS. */
let mergedSeen: Record<string, { at: number; hit: { home: string; file: string } | null }> = {}
const MERGED_RETRY_MS = 30_000

/**
 * Addendum L1: for each run folder whose run.md is gone, the run folder that keeps it as `merged-from-<run>.md`.
 * Lists the run folders (`runFolders`) only when a folder is not known yet, or its last miss is older than
 * MERGED_RETRY_MS; a found one is kept for the session.
 */
async function mergedHomes($: EngineInterface, missing: readonly string[]): Promise<Record<string, { home: string; file: string }>> {
  const out: Record<string, { home: string; file: string }> = {}
  if (missing.length === 0) return out
  const now = nowMs()
  const stale = missing.filter(d => {
    const seen = own(mergedSeen, runIdOf(d))
    return seen === undefined || (seen.hit === null && now - seen.at > MERGED_RETRY_MS)
  })
  if (stale.length > 0) {
    const folders: { dir: string; names: string[] }[] = []
    for (const f of await runFolders($, [])) {
      try {
        folders.push({ dir: f, names: ((await $.fs.list(f)) as ListEntry[]).filter(e => e.kind !== 'dir').map(e => e.name) })
      } catch {
        // not listable: no merged-from file read from it
      }
    }
    for (const d of stale) mergedSeen = { ...mergedSeen, [runIdOf(d)]: { at: now, hit: mergedHomeOf(d, folders) } }
  }
  for (const d of missing) {
    const hit = own(mergedSeen, runIdOf(d))?.hit
    if (hit) out[d] = hit
  }
  return out
}

/**
 * Re-reads the `run.md` of every run a brief named (round 5): the pane's titles and status follow the
 * run as it moves. Written only when something changed, so a pane redraws only then.
 */
async function refreshRuns($: EngineInterface) {
  const next: Record<string, LensRun> = {}
  const missing: string[] = []
  for (const d of await runDirs($)) {
    const r = parseRun(await readRunState($, d))
    if (r !== null) next[d] = r
    else missing.push(d)
  }
  // Addendum L1: a run folder merged away (its briefs predate the merge) is read from the `merged-from-<run>.md`
  // the run it joined keeps, and drawn in that run's chart as a child run (`parent:` set to that run).
  const merged = new Set<string>()
  for (const [d, m] of Object.entries(await mergedHomes($, missing))) {
    const r = parseRun(await readText($, `${m.home}/${m.file}`))
    if (r === null) continue
    next[d] = { ...r, parent: folderNameOf(m.home) }
    merged.add(d)
    if (!Object.keys(next).some(k => runIdOf(k) === runIdOf(m.home))) {
      const h = parseRun(await readRunState($, m.home))
      if (h !== null) next[m.home] = h
    }
  }
  // Step 27.1: a run's `parent:` names a run folder beside it; its run.md is read too, up the chain (each
  // folder once, at most PARENT_DEPTH * 4 such reads), so the child can be drawn in its parent's chart (`runRoots`).
  const queue = Object.keys(next)
  let reads = 0
  for (let i = 0; i < queue.length && reads < PARENT_DEPTH * 4; i++) {
    const d = queue[i]!
    const p = next[d]?.parent
    if (p === undefined) continue
    const base = d.replace(/[\\/]+$/, '')
    const pd = base.includes('/') || base.includes('\\') ? `${base.replace(/[\\/][^\\/]*$/, '')}/${p}` : p
    if (Object.keys(next).some(k => runIdOf(k) === runIdOf(pd))) continue
    reads++
    const r = parseRun(await readRunState($, pd))
    if (r === null) continue
    next[pd] = r
    queue.push(pd)
  }
  // Each run folder's record files, so the workflow view draws one chart per step from them. A run
  // merged away (its folder gone, its run state read from merged-from-<run>.md) or a folder that cannot be
  // listed keeps none. And its per-code renames, from its rename sources (`isRenameSource`), read
  // oldest name first (a dated name sorts by date) through `recordText`, so an unchanged file is not read again.
  for (const d of Object.keys(next)) {
    if (merged.has(d)) continue
    let entries: ListEntry[]
    try {
      entries = ((await $.fs.list(d)) as ListEntry[]).filter(e => e.kind !== 'dir')
    } catch {
      continue // not listable: no records from it
    }
    const names = entries.filter(e => parseRecordName(e.name) !== null).map(e => e.name)
    const maps: Record<string, string>[] = []
    for (const e of entries.filter(x => isRenameSource(x.name)).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)))
      maps.push(codeMapOf(e.name, await recordText($, `${d}/${e.name}`, sigOf(e))))
    const codeMap = composeCodeMaps(maps)
    next[d] = { ...next[d]!, records: names.sort(), ...(Object.keys(codeMap).length > 0 ? { codeMap } : {}) }
  }
  const prev = await read($, runsA)
  if (JSON.stringify(prev) !== JSON.stringify(next)) await update($, runsA, () => next)
}

/** A plugin's installed copies: `<plugins cache>/<marketplace>/<plugin>/<version>/`, the newest release first. */
async function installedRoots($: EngineInterface, plugin: string): Promise<string[]> {
  const base = `${$.plugin.root}/../../${plugin}`
  try {
    const vers = ((await $.fs.list(base)) as { name: string; kind: string }[]).filter(v => v.kind === 'dir').map(v => v.name)
    const rank = (v: string) => (v.includes('-') ? 0 : 1)
    vers.sort((a, b) => rank(b) - rank(a) || b.localeCompare(a, undefined, { numeric: true }))
    return vers.map(v => `${base}/${v}`)
  } catch {
    return []
  }
}

/** The definition of an agent type (finding 1d): this repository's plugin source, else the installed plugin, else `.claude/agents/`. */
async function loadDef($: EngineInterface, type: string) {
  await loadAvatar($, type)
  if (type === '') return
  const have = await read($, defsA)
  if (own(have, type)) return
  const plugin = pluginOf(type)
  const name = roleOf(type)
  const first = plugin !== '' ? `plugins/claude/${plugin}/agents/${name}.md` : `.claude/agents/${name}.md`
  let def: LensDef = { model: '', persona: '', path: '' }
  let text = await readText($, first)
  let path = first
  if (text === null && plugin !== '') {
    // The installed copy is listed only when this repository has no source for it.
    for (const r of await installedRoots($, plugin)) {
      path = `${r}/agents/${name}.md`
      text = await readText($, path)
      if (text !== null) break
    }
  }
  if (text !== null) def = { ...parseDefinition(text), path: path.replace(/^.*[\\/]plugins[\\/]cache[\\/]/, '~/.claude/plugins/cache/') }
  await update($, defsA, m => ({ ...(m as Record<string, LensDef>), [type]: def }))
}

/** What the chart and the Buttons call an agent: persona, model, role (finding 1d). */
function labeler(roster: Record<string, string>, defs: Record<string, LensDef>, mainModel: string) {
  return (a: LensAgent): ChartLabel => {
    const def = own(defs, a.type)
    const usable = def && def.path !== '' ? def : undefined
    return {
      name: personaOf(a, roster, usable),
      model: modelOf(usable, a.callModel, a.parentModel || mainModel || a.model).text,
      role: a.id === 'main' ? (a.type === '' ? 'Main loop' : humanRole(a.type)) : humanRole(a.type) || 'Agent',
    }
  }
}

/** Whether a [+]/[-] section is open: the person's choice, else the `collapsedByDefault` setting. */
const isOpen = (open: Record<string, boolean>, key: string, s: LensSettings) => open[key] ?? !s.collapsedByDefault
const toggleOpen = ($: EngineInterface, key: string, s: LensSettings) =>
  update($, cardOpenA, m => ({ ...(m as Record<string, boolean>), [key]: !((m as Record<string, boolean>)[key] ?? !s.collapsedByDefault) }))

// ---- probes (E1-E9) ----
async function plog($: EngineInterface, exp: string, data: unknown) {
  if (!probeOn || probePath === '') return
  let line: string
  try {
    line = JSON.stringify({ t: new Date().toISOString(), exp, data })
  } catch {
    line = JSON.stringify({ t: new Date().toISOString(), exp, data: String(data) })
  }
  probeLog.push(line)
  if (probeLog.length > 600) probeLog.shift()
  const text = probeLog.join('\n') + '\n'
  probeWrite = probeWrite.then(() => $.fs.write(probePath, text)).catch(() => undefined)
  await update($, probeLinesA, n => n + 1)
}

async function ensureAgent($: EngineInterface, id: string, parent: string | null, type: string) {
  // The existence check runs inside the write (round 3 root cause): a stale "absent" never overwrites.
  await update($, agentsA, m => ensureIn(m as Record<string, LensAgent>, id, () => blankAgent(id, parent, type)))
  await update($, orderA, o => (o.includes(id) ? o : [...o, id]))
}

async function patchAgent($: EngineInterface, id: string, fn: (a: LensAgent) => LensAgent) {
  await update($, agentsA, m => {
    const cur = (m as Record<string, LensAgent>)[id]
    return cur ? { ...m, [id]: fn(cur) } : m
  })
}

async function pushCall($: EngineInterface, key: string, call: LensCall) {
  await update($, callsA, m => {
    const list = ((m as Record<string, LensCall[]>)[key] ?? []).filter(c => c.id !== call.id)
    return { ...m, [key]: [...list, call].slice(-cfg.callsLimit) }
  })
}

async function refreshList($: EngineInterface, reason: string) {
  let list: any[] = []
  try {
    list = (await $.agent.list()) as any[]
  } catch (err) {
    await plog($, 'E4', { reason, error: String(err) })
    return
  }
  const changes: unknown[] = []
  for (const a of list) {
    if (lastStatus[a.id] !== a.status) changes.push({ id: a.id, type: a.type, status: a.status, was: lastStatus[a.id] ?? null, parentId: a.parentId ?? null, teammateId: a.teammateId ?? null, name: a.name ?? null })
    lastStatus[a.id] = a.status
  }
  if (changes.length > 0) await plog($, 'E4', { reason, changes, listed: list.length })
  // Background tasks: each agent's listed children (step 16 Q6).
  await update($, agentsA, m => {
    const out: Record<string, LensAgent> = { ...(m as Record<string, LensAgent>) }
    for (const key of Object.keys(out)) {
      const kids: LensTask[] = list
        .filter(a => (a.parentId ?? 'main') === key)
        .map(a => ({ id: String(a.id), type: 'subagent', agentType: String(a.type), status: String(a.status), description: String(a.description ?? ''), source: 'agent.list' }))
      const stopTasks = out[key]!.bg.filter(t => t.source !== 'agent.list')
      out[key] = { ...out[key]!, bg: stampTasks(out[key]!.bg, uniqueTasks([...kids, ...stopTasks]), nowMs()) }
    }
    for (const a of list) {
      const cur = out[a.id]
      // A list that still says `running` never undoes a `turn.complete` (finding 6).
      // Round 6: nor puts `running` back over an `idle` the turn's end set (the list lags, E4); a turn's
      // own start sets `running`. It may still start a pending agent or wake a waiting one.
      const stale = a.status === 'running' && cur !== undefined && cur.status !== 'pending' && cur.status !== 'waiting'
      if (cur && cur.status !== a.status && a.status !== 'completed' && !ENDED.has(cur.status) && !stale) out[a.id] = { ...cur, status: String(a.status) }
      if (out[a.id] && typeof a.teammateId === 'string' && out[a.id]!.teammate !== true) out[a.id] = { ...out[a.id]!, teammate: true }
    }
    return out
  })
}

/**
 * A record for an agent whose brief names none, by time order and agent type (step 16 Q7): shown only as a
 * hint since round 3, never as the record. Searched in every run folder (`runFolders`), so under the
 * workflow's `artifacts.handoffs` too.
 */
async function findFallbackRecord($: EngineInterface, role: string, startedAt: number): Promise<string | null> {
  let best: { path: string; mtime: number } | null = null
  try {
    for (const dir of await runFolders($, [])) {
      for (const f of (await $.fs.list(dir)) as ListEntry[]) {
        if (f.kind !== 'file' || !f.name.endsWith(`-to-${role}.handoff.md`)) continue
        const mt = f.mtimeMs ?? 0
        if (mt >= startedAt - 600_000 && mt <= startedAt + 60_000 && (best === null || mt > best.mtime)) best = { path: `${dir}/${f.name}`, mtime: mt }
      }
    }
  } catch {
    return null
  }
  return best?.path ?? null
}

/** The arrow panel's content (finding 2): the record the brief named and its hand-back, else the prompt. */
async function loadDoc($: EngineInterface, a: LensAgent) {
  const doc: LensDoc = { ...DOC0, agent: a.id, prompt: a.prompt }
  const path = a.handoff
  if (path === null) {
    if (a.startedAt > 0) {
      const hint = await findFallbackRecord($, roleOf(a.type), a.startedAt)
      if (hint !== null) doc.hint = hint
    }
    await update($, docA, () => doc)
    await plog($, 'E8', { via: 'arrow press', path: null, prompt: a.prompt.length, hint: doc.hint })
    return
  }
  doc.handoff = path
  const text = await readText($, path)
  if (text === null) doc.error = `read ${path}: not found`
  else doc.handoffText = cap(text, cfg.recordChars)
  const rec = parseRecord(path)
  if (rec) {
    try {
      const names = ((await $.fs.list(rec.dir)) as { name: string }[]).map(f => f.name)
      const hb = pickHandback(names, rec)
      if (hb !== null) {
        doc.handback = `${rec.dir}/${hb}`
        doc.handbackText = cap((await readText($, doc.handback)) ?? '', cfg.recordChars)
      } else doc.handbackText = '(no hand-back yet)'
    } catch (err) {
      doc.error += ` list ${rec.dir}: ${String(err)}`
    }
  }
  await update($, docA, () => doc)
  await plog($, 'E8', { via: 'arrow press', path, ok: doc.handoffText !== '', handback: doc.handback, error: doc.error })
}

/** Step 1.5: how a Button opens its details now: the view's `Panel Type` switch, else the `panelOpenMode` setting. */
async function openModeNow($: EngineInterface): Promise<'tab' | 'drill-in'> {
  const conf = await read($, lensA)
  return openModeOf(await read($, openModeA), String(conf.settings.panelOpenMode))
}

/**
 * Opens an arrow's details (`snap`: the agent as the drawing drew it). Step 1.5: `tab` opens the separate
 * pane (a tab beside the others, PaneOpenArgs, d.ts:7588-7660); `drill-in` shows it inside the drawing
 * it was pressed in (`target`: `lens`, `pane` or `card:<call>`) with "< Back". Both work from every drawing.
 */
async function openEdge($: EngineInterface, snap: LensAgent, title: string, target: string) {
  const mode = await openModeNow($)
  await loadDoc($, snap)
  if (mode === 'drill-in') {
    await update($, drillsA, m => ({ ...(m as Record<string, LensDrill>), [target]: { kind: 'edge', id: snap.id, snap } }))
    return
  }
  await update($, uiA, x => ({ ...x, edge: snap.id, edgeSnap: snap }))
  await update($, tabsMinA, m => ({ ...(m as Record<string, boolean>), [EDGE]: false }))
  // Round 6 (A4): Esc closes it while it holds the keys (PaneOpenArgs.closeOnEscape, d.ts:7614-7624); `focus` asks for them.
  const r = await $.ui.open({ id: EDGE, title: cap(`Hand-off: ${title}`, 60), focus: true, closeOnEscape: true })
  await plog($, 'E3', { open: EDGE, result: r })
}

/** Opens an avatar's details, as `openEdge`. */
async function openAgent($: EngineInterface, snap: LensAgent, title: string, target: string) {
  const mode = await openModeNow($)
  await refreshList($, 'avatar press')
  if (mode === 'drill-in') {
    await update($, drillsA, m => ({ ...(m as Record<string, LensDrill>), [target]: { kind: 'agent', id: snap.id, snap } }))
    return
  }
  await update($, uiA, x => ({ ...x, agent: snap.id, agentSnap: snap }))
  await update($, tabsMinA, m => ({ ...(m as Record<string, boolean>), [AGENT]: false }))
  const r = await $.ui.open({ id: AGENT, title: cap(`Agent: ${title}`, 60), focus: true, closeOnEscape: true })
  await plog($, 'E3', { open: AGENT, result: r })
}

/** Leaves a drawing's drill-in view ("< Back"). */
async function drillBack($: EngineInterface, target: string) {
  await update($, drillsA, m => {
    const { [target]: _gone, ...rest } = m as Record<string, LensDrill>
    return rest
  })
}

/** The surfaces the session draws on (`$.session.surfaces()`, d.ts:2864-2875); [] when unknown. Never throws. */
async function surfacesNow($: EngineInterface): Promise<string[]> {
  try {
    return [...((await $.session.surfaces()) as readonly string[])]
  } catch {
    return []
  }
}

/**
 * Step 1.5: (re)opens the workflow pane at the view's size. Full screen asks the whole viewport
 * (PaneOpenArgs `rows`, `columns`, d.ts:7638-7658); any other size asks nothing, so the surface's own
 * size applies again. Where it is seated (dock or inline) is the surface's (Pane `placement`, d.ts:10895-10902).
 */
async function openWorkflowPane($: EngineInterface, v: LensView, focus = false) {
  return $.ui.open({ id: CHART, title: 'AI-DLC workflow', closeOnEscape: true, ...(focus ? { focus: true } : {}), ...openSizeOf(v.size, lastViewport) })
}

/**
 * Step 1.5: shows the view where its place says. Pinned: the band above the prompt (AbovePrompt, raised
 * on the terminal and desktop only, d.ts:10809-10819); the pane closes only when every attached surface
 * draws that band, else it stays a pane. Docked: the pane.
 */
async function showView($: EngineInterface, v: LensView, focus = false) {
  const conf = await read($, lensA)
  const place = placeOf(v, String(conf.settings.workflowPlace))
  // Addendum A7: full screen is always the pane, raised, never the band (the band only has the rows the
  // bottom slot spares, AbovePrompt `maxRows`); restored, a pinned view goes back to the band.
  if (v.size === 'fullscreen') {
    await openWorkflowPane($, v, true)
    return
  }
  if (place === 'pinned' && bandEverywhere(await surfacesNow($))) {
    // An id that is not open is left alone (`$.ui.close`, d.ts:2538).
    await $.ui.close({ id: CHART })
    return
  }
  await openWorkflowPane($, v, focus)
}

/** Step 1.5: a view change (place, size, selection), then the view shown where and how it now says. */
async function changeView($: EngineInterface, fn: (v: LensView) => LensView) {
  let next: LensView = VIEW0
  await update($, viewA, v => {
    next = fn(v as LensView)
    return next
  })
  await showView($, next)
}

/**
 * "Open flowchart" (a chat card): the workflow view, restored if minimised, with that run selected.
 * Round 6 (finding 18.4-1): it never expands the run's panel: every panel starts collapsed (A2).
 */
async function openChart($: EngineInterface, w: string) {
  await update($, chartLeadA, () => w)
  await refreshRuns($)
  await changeView($, v => {
    const base = v.size === 'minimised' ? viewRestore(v) : v
    return { ...base, selected: w }
  })
}

/** Round 6: whether any agent but main is still at work, so the status poll is worth running. */
const anyAtWork = (agents: Record<string, LensAgent>): boolean =>
  Object.values(agents).some(a => a.id !== 'main' && (a.status === 'pending' || a.status === 'running' || isWaiting(a)))

/** Round 6 (A7): records an automatic notice on the workflow it belongs to; never a task title. */
async function addNotice($: EngineInterface, text: string) {
  const clean = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (clean === '') return
  rememberNotice(text.trim())
  const wf = await readWorkflows($)
  const agents = await read($, agentsA)
  const n: LensNotice = { text: clean.slice(0, 400), at: nowMs(), w: noticeWorkflow(text, wf, agents) }
  await update($, noticesA, l => [...(l as LensNotice[]).filter(x => x.text !== n.text), n].slice(-NOTICES_KEPT))
}

async function scanUsage($: EngineInterface, agentId: string) {
  // E5: what the agent's own rows say it used, next to the hook sums.
  try {
    const rows: unknown = await $.session.messages({ agentId })
    const sum = { in: 0, out: 0, cr: 0, cw: 0, found: 0 }
    const walk = (v: unknown, depth: number) => {
      if (depth > 6 || v === null || typeof v !== 'object') return
      const o = v as Record<string, unknown>
      const u = o.usage as Record<string, unknown> | undefined
      if (u && typeof u.output_tokens === 'number') {
        sum.found += 1
        sum.in += Number(u.input_tokens ?? 0)
        sum.out += Number(u.output_tokens ?? 0)
        sum.cr += Number(u.cache_read_input_tokens ?? 0)
        sum.cw += Number(u.cache_creation_input_tokens ?? 0)
        return
      }
      for (const k of Object.keys(o)) walk(o[k], depth + 1)
    }
    walk(rows, 0)
    return { rows: Array.isArray(rows) ? rows.length : typeof rows, sum }
  } catch (err) {
    return { error: String(err) }
  }
}

// ---- tool calls: never throw into the call (the hook gates it) ----
const lensErrors: string[] = []
function lensFail(site: string, err: unknown) {
  lensErrors.push(`${site}: ${String(err)}`)
  if (lensErrors.length > 20) lensErrors.shift()
}

/**
 * A pane's drawing, or, when it throws, one red line naming the fault (also kept by `lensFail`): a lens
 * fault never blanks a pane or throws into the host. The ToolUse card has its own guard (the native row).
 */
function guardPane<E extends Parameters<EngineInterface['ui']['resolve']>[0]>($: EngineInterface, e: E, site: string, draw: () => Promise<RenderElement>): Promise<RenderElement> {
  return drawOr(
    draw,
    // `paneFault` never throws: if resolving the kit is what failed, it builds the Text element itself.
    err =>
      paneFault(site, err, line => {
        const { Text } = $.ui.resolve(e) as any
        return <Text color="red">{line}</Text>
      }) as RenderElement,
    err => lensFail(site, err),
  )
}

type CallCtx = { key: string; tool: string; input: Record<string, unknown>; id: string; call: LensCall }

// ---- keep-alive (spike 028, AC-9.4): read-only, never written here ----
// ai-dlc's keep-alive publishes its tracks under this value (plugins/claude/ai-dlc/types/index.d.ts).
// Read while drawing, so a pane redraws when keep-alive writes it. No `dependencies` entry: without
// ai-dlc the read gives no value, and no line draws.
const KEEPALIVE = { plugin: 'ai-dlc', key: 'keepalive' } as const
let keepaliveError = ''
/**
 * ai-dlc's value is outside this plugin's PluginState contract (a contract declares only its own
 * state), so its read is typed here; `keepaliveLine` and `noteKeepalive` check its fields at run time.
 * `$.state.get` stays spelled at the call site: the module analyser refuses `$.state` as a value.
 */
type ForeignValue = { value?: unknown }

/** The keep-alive line for a pane header, or null: shown only while a keep-alive track runs. Never throws. */
async function keepaliveRow($: EngineInterface, t: any) {
  try {
    const { value } = (await $.state.get(KEEPALIVE as never)) as ForeignValue
    const line = keepaliveLine(value)
    const { Text } = t
    return line === null ? null : (
      <Text key="lens-keepalive" dimColor wrap="truncate">
        {line}
      </Text>
    )
  } catch (err) {
    // Once per distinct error, so a pane that redraws does not fill the error list.
    if (String(err) !== keepaliveError) {
      keepaliveError = String(err)
      lensFail('keepalive', err)
    }
    return null
  }
}

// ---- /ai-dlc:lens-keepalive (step 1.4): keep-alive time per track and what cache reads saved ----

/** ai-dlc's keep-alive value, or undefined (absent, or the read failed: logged once). Never throws. */
async function keepaliveValue($: EngineInterface): Promise<unknown> {
  try {
    return ((await $.state.get(KEEPALIVE as never)) as ForeignValue).value
  } catch (err) {
    if (String(err) !== keepaliveError) {
      keepaliveError = String(err)
      lensFail('keepalive', err)
    }
    return undefined
  }
}

/**
 * Keeps each arming ai-dlc publishes in the lens's own state, so its time still counts after the next
 * arming replaces it. Run from hooks (never from a drawing, which only reads): at a turn's start, before
 * and after Stop (keep-alive arms at Stop), and on the status poll. Never throws.
 */
async function captureKeepalive($: EngineInterface) {
  try {
    const value = await keepaliveValue($)
    const prev = await read($, kaCyclesA)
    const next = noteKeepalive(prev, value)
    if (next !== null) await update($, kaCyclesA, () => next)
  } catch (err) {
    lensFail('keepalive capture', err)
  }
}

/** The section's figures: kept-warm time per track, and the savings of one agent and of the session. */
type KeepaliveFigures = { warm: ReturnType<typeof keptWarm>; agent: ReturnType<typeof savingsOfAgent> | null; session: ReturnType<typeof sessionSavings> }

/** An agent's live sums: the step sums, else its turn sums when no hook saw its steps. */
const sumsOf = (a: LensAgent) => (a.steps.in + a.steps.out + a.steps.cr + a.steps.cw > 0 ? a.steps : a.turns)

/** Reads ai-dlc's value (a drawing that calls this redraws on each keep-alive write), the armings and the costs. */
async function keepaliveFigures($: EngineInterface, agentId: string | null = null): Promise<KeepaliveFigures> {
  const value = await keepaliveValue($)
  const cycles = await read($, kaCyclesA)
  const agents = await read($, agentsA)
  const costing = await read($, costingA)
  const conf = await read($, lensA)
  const th = (conf.settings.longContextThresholdTokens as number) > 0 ? (conf.settings.longContextThresholdTokens as number) : null
  const of = (a: LensAgent) => savingsOfAgent(costing, a.model, a.reqs ?? [], sumsOf(a), th)
  const a = agentId === null ? undefined : agents[agentId]
  return {
    warm: keptWarm(cycles, value, nowMs()),
    agent: a === undefined ? null : of(a),
    session: sessionSavings(Object.values(agents).map(of)),
  }
}

async function beforeCall($: EngineInterface, e: any): Promise<CallCtx | null> {
  try {
    const key: string = e.agentId ?? 'main'
    const { tool, tool_use_id, agentId: _a, consent: _c, requestMeta: _r, ...rest } = e
    const input = rest as Record<string, unknown>
    const id = String(tool_use_id ?? `${tool}-${nowMs()}`)
    const call: LensCall = { id, tool, summary: summarize(tool, input), status: 'running', stepOut: 0, stepCalls: 0 }
    const s = stepOfCall[id]
    if (s) {
      call.stepOut = s.out
      call.stepCalls = s.n
    }
    await pushCall($, key, call)
    if (key === 'main' && CONTEXT_TOOLS.has(tool)) await update($, contextA, l => [...l.filter(c => c.id !== id), call].slice(-cfg.contextLimit))
    if (tool === 'SendMessage' && typeof input.to === 'string') {
      // A message to a running agent is a loop: the arrow becomes two-way (US-12).
      const to = input.to
      const agents = await read($, agentsA)
      const hit = Object.values(agents).find(a => a.id === to || a.name === to)
      if (hit) await patchAgent($, hit.id, a => ({ ...a, loop: true }))
    }
    if (AGENT_TOOLS.has(tool)) {
      // The chat card's placeholder avatar until agent.spawn names the agent; a call no step reported is a batch of its own.
      const p = {
        type: String(input.subagent_type ?? ''),
        description: String(input.description ?? ''),
        name: String(input.name ?? ''),
        prompt: String(input.prompt ?? ''),
        model: typeof input.model === 'string' ? input.model : '',
      }
      await update($, batchesA, m => notePending(m as Record<string, LensBatch>, key, id, p))
      const agentsNow = await read($, agentsA)
      const task = key === 'main' ? (await read($, mainPromptA)) : firstLine(agentsNow[key]?.prompt ?? '')
      await update($, callTaskA, m => ({ ...(m as Record<string, string>), [id]: task }))
      // Round 6 (A8): the call's task, so a later spawn for the same task joins its workflow even after it finished.
      const taskKey = taskKeyOf(p.prompt, task)
      await update($, callKeyA, m => ({ ...(m as Record<string, string>), [id]: taskKey }))
      // Round 4 bug: a later spawn joins the spawner's workflow while any agent of it still works.
      const callAgentNow = await read($, callAgentA)
      const keysNow = await read($, callKeyA)
      const tasksNow = await read($, callTaskA)
      // Step 8.6.1.l1: the run folders are listed again as the spawn starts, so the record its brief names (written
      // just before, by Write or by any other means) is on the list before the step charts place it (`locateRecord`).
      await refreshRuns($)
      // Step 1.5: the run the brief names is the workflow's identity (AC-1.5.2); see joinWorkflow.
      // Step 27.1: a run with `parent:` joins its parent's workflow (`readRoots`).
      const rootsNow = await readRoots($)
      await update($, workflowsA, x => joinWorkflow(x as LensWorkflows, key, id, agentsNow, callAgentNow, keysNow, tasksNow, rootsNow))
      await loadDef($, p.type)
    }
    if (probeOn && AGENT_TOOLS.has(tool))
      await plog($, 'E1', { site: 'tool.call', tool, tool_use_id: id, inputKeys: Object.keys(input), hasPrompt: typeof input.prompt === 'string', firstLine: String(input.prompt ?? '').split(/\r?\n/, 1)[0]?.slice(0, 300) })
    if (probeOn && tool === 'Bash' && input.run_in_background === true) await plog($, 'E7', { site: 'tool.call', command: input.command, agent: key })
    return { key, tool, input, id, call }
  } catch (err) {
    lensFail('tool.call before', err)
    return null
  }
}

async function afterCall($: EngineInterface, ctx: CallCtx, r: any) {
  try {
    const { key, tool, input, id, call } = ctx
    const status = r?.deny !== undefined || r?.isError === true ? 'error' : 'done'
    const bgId = r?.result?.backgroundTaskId
    if (typeof bgId === 'string') {
      // E7: a background shell is known from its call's result; no live list API names it.
      const task: LensTask = { id: bgId, type: 'shell', status: 'running', description: call.summary, source: 'tool.call' }
      await patchAgent($, key, a => ({ ...a, bg: stampTasks(a.bg, [...a.bg.filter(t => t.id !== bgId), task], nowMs()) }))
    }
    // The Agent call's own result names its agent (E1: `agentId`): a second source for the call -> agent map.
    const agentId = r?.result?.agentId
    if (AGENT_TOOLS.has(tool) && typeof agentId === 'string') await update($, callAgentA, m => ({ ...(m as Record<string, string>), [id]: agentId }))
    await pushCall($, key, { ...call, status })
    if (key === 'main' && CONTEXT_TOOLS.has(tool)) await update($, contextA, l => l.map(c => (c.id === id ? { ...c, status } : c)))
    // Round 5: a write to a run's run.md, or a new Agent call, moves the titles (requirement 2).
    const target = String(input.file_path ?? input.path ?? input.notebook_path ?? '').replace(/\\/g, '/')
    const runWrite = /^(Write|Edit|MultiEdit)$/.test(tool) && (isRunStateFile(target.slice(target.lastIndexOf('/') + 1)) || /[^/]+\.hand(off|back)\.md$/.test(target))
    if (AGENT_TOOLS.has(tool) || runWrite) await refreshRuns($)
    // Step 1.6.1: a write to a run.md or a record is a moment an anomaly can appear or clear.
    if (runWrite) await detectNow($)
    if (probeOn && tool === 'Bash' && input.run_in_background === true) {
      const list = (await $.agent.list()) as any[]
      await plog($, 'E7', { site: 'after background Bash', result: r?.result ?? null, agentList: list.map(a => ({ id: a.id, type: a.type, status: a.status })) })
    }
    if (probeOn && AGENT_TOOLS.has(tool)) await plog($, 'E1', { site: 'tool.call result', tool_use_id: id, result: r?.result ?? null })
  } catch (err) {
    lensFail('tool.call after', err)
  }
}

/** Thinking blocks the transcript stored for a loop (E2): how many, how much text, how many redacted. */
async function scanThinking($: EngineInterface, key: string): Promise<{ blocks: number; chars: number; redacted: number; text: string; error?: string }> {
  const out = { blocks: 0, chars: 0, redacted: 0, text: '' }
  try {
    const got: unknown = key === 'main' ? await $.session.messages({ as: 'api' }) : await $.session.messages({ agentId: key, as: 'api' })
    const walk = (v: unknown, depth: number) => {
      if (depth > 8 || v === null || typeof v !== 'object') return
      const o = v as Record<string, unknown>
      if (o.type === 'thinking') {
        out.blocks += 1
        const t = typeof o.thinking === 'string' ? o.thinking : ''
        out.chars += t.length
        if (t !== '') out.text += (out.text === '' ? '' : '\n---\n') + t
        return
      }
      if (o.type === 'redacted_thinking') {
        out.redacted += 1
        return
      }
      for (const k of Object.keys(o)) walk(o[k], depth + 1)
    }
    walk(got, 0)
    return out
  } catch (err) {
    return { ...out, error: String(err) }
  }
}

/** Fill a loop's thinking section from the stored transcript when the stream carried no text (step 16 Q1 fallback). */
async function backfillThinking($: EngineInterface, key: string, streamedBlocks: number) {
  const have = (await read($, thinkingA))[key] ?? ''
  if (have !== '' && !have.startsWith('[')) return null
  const th = await scanThinking($, key)
  const note =
    th.text !== ''
      ? th.text.slice(-cfg.thinkingChars)
      : `[no thinking text: ${streamedBlocks} block(s) streamed empty; transcript holds ${th.blocks} thinking block(s) with ${th.chars} chars, ${th.redacted} redacted]`
  await update($, thinkingA, m => ({ ...m, [key]: note }))
  return th
}

// ---- drawing helpers (called by name with `$`) ----
/**
 * One Button per avatar and per arrow. `agents` is the drawing's own set (the chat card's view, with
 * the placeholders of calls not spawned yet), so every avatar and arrow of the chart has its Button.
 * `root`: the chat card's top avatar, whose own arrow (from its spawner) is not in that card.
 */
function agentButtons($: EngineInterface, t: any, order: string[], agents: Record<string, LensAgent>, label: (a: LensAgent) => ChartLabel, target: string, root: string | null, marks: Marks, prefix = '') {
  const { Box, Text, Button } = t
  const ids = order.filter(id => agents[id])
  const edges = ids.filter(id => id !== root && agents[id]!.parent !== null)
  return (
    <Box flexDirection="column" alignItems="center">
      <Box flexDirection="row" flexWrap="wrap" alignItems="center" justifyContent="center">
        <Text dimColor>Avatars: </Text>
        {ids.map(id => {
          const name = label(agents[id]!).name
          const mine = marks.list.filter(x => x.target === 'agent' && x.agent === id)
          return mine.length === 0 ? (
            <Button key={`${prefix}agent-${id}`} label={name} onPress={() => openAgent($, agents[id]!, name, target)} />
          ) : (
            <Button key={`${prefix}agent-${id}`} label={name} onPress={() => openAgent($, agents[id]!, name, target)}>
              {anomalyMark(t, mine, marks.s)}
              {name}
            </Button>
          )
        })}
      </Box>
      <Box flexDirection="row" flexWrap="wrap" alignItems="center" justifyContent="center">
        <Text dimColor>Arrows: </Text>
        {edges.length === 0 && <Text dimColor>(none yet)</Text>}
        {edges.map(id => {
          const a = agents[id]!
          const from = agents[a.parent!]
          const code = a.handoff !== null ? (parseRecord(a.handoff)?.code ?? '') : ''
          const text = `${code !== '' ? code + ' ' : ''}${from ? label(from).name : '?'} ${a.loop ? '<->' : '->'} ${label(a).name}`
          const mine = marks.list.filter(x => x.target === 'edge' && x.agent === id)
          return mine.length === 0 ? (
            <Button key={`${prefix}edge-${id}`} label={text} onPress={() => openEdge($, a, text, target)} />
          ) : (
            <Button key={`${prefix}edge-${id}`} label={text} onPress={() => openEdge($, a, text, target)}>
              {anomalyMark(t, mine, marks.s)}
              {text}
            </Button>
          )
        })}
      </Box>
    </Box>
  )
}

/** The live record of a pressed agent, else the one the card drew (a call not spawned yet). */
const liveOr = (agents: Record<string, LensAgent>, id: string | null, snap: LensAgent | null): LensAgent | undefined => {
  if (id === null) return undefined
  const live = agents[id]
  if (live && live.type !== '') return live
  return snap ?? live
}

// ---- the side panels (round 4: a header, grouped sections, label/value rows) ----

const DIVIDER = '─'.repeat(40)

/** A section: a divider, then its [+]/[-] and a short heading with its count; collapsed until opened (`collapsedByDefault`). */
function section($: EngineInterface, t: any, open: Record<string, boolean>, s: LensSettings, openKey: string, buttonKey: string, heading: string, body: () => any) {
  const { Box, Text, Button } = t
  const o = isOpen(open, openKey, s)
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text dimColor wrap="truncate">
        {DIVIDER}
      </Text>
      <Box flexDirection="row" flexWrap="wrap">
        <Button key={buttonKey} label={o ? '[-]' : '[+]'} onPress={() => toggleOpen($, openKey, s)} />
        <Text bold wrap="wrap">
          {' '}
          {heading}
        </Text>
      </Box>
      {o && (
        <Box flexDirection="column" paddingLeft={2}>
          {body()}
        </Box>
      )}
    </Box>
  )
}

/** One label/value row: the label left, the value right-aligned; it wraps in a narrow panel. */
function kv(t: any, label: string, value: string) {
  const { Box, Text } = t
  return (
    <Box flexDirection="row" justifyContent="space-between" flexWrap="wrap" columnGap={2}>
      <Text dimColor>{label}</Text>
      <Text tabular>{value}</Text>
    </Box>
  )
}

/** An agent's avatar for a panel header: an Svg where Svg draws, a PNG `Image` on the terminal, else null. */
function headerAvatar(t: any, hasSvg: boolean, av: ChartAvatars, a: LensAgent, name: string) {
  const { Svg, Image } = t
  const key = avatarKey(a.type)
  if (hasSvg) {
    const src = avatarSvg(av, key, 22)
    return src === null ? null : <Svg source={src} alt={`avatar of ${name}`} width={22} height={22} />
  }
  const png = av.style === 'initials' ? null : (av.image(key)?.png ?? null)
  return png === null ? null : <Image source={{ png }} columns={2} rows={1} alt={initials(name)} />
}

/**
 * The panel header: the agent's avatar where the surface draws it (robot or image; on the terminal a
 * trusted PNG file), then a badge (initials) as its label, the title in bold, the status badge in
 * colour; model and role dim under it.
 */
function panelHeader(t: any, badge: string, title: string, sub: string, status: string, avatar: unknown = null) {
  const { Box, Text } = t
  const b = statusBadge(status)
  // Round 5: the header block centred both ways in its box.
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center">
      <Box flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center" justifyContent="center">
        {avatar}
        <Text inverse bold>
          {' '}
          {badge}{' '}
        </Text>
        <Text bold wrap="wrap">
          {title}
        </Text>
        <Text inverse color={b.color}>
          {' '}
          {b.text}{' '}
        </Text>
      </Box>
      <Text dimColor wrap="wrap">
        {sub}
      </Text>
    </Box>
  )
}

/** A tool call as a compact row: status icon, tool, short argument, the estimated output tokens dim. */
function callRow(t: any, c: LensCall) {
  const { Text } = t
  const icon = c.status === 'running' ? '…' : c.status === 'error' ? '✗' : '✓'
  const color = c.status === 'running' ? 'yellow' : c.status === 'error' ? 'red' : 'green'
  return (
    <Text wrap="wrap">
      <Text color={color}>{icon}</Text> <Text bold>{c.tool}</Text> {c.summary}
      <Text dimColor>{c.stepCalls > 0 ? ` ~${fmtTokens(c.stepOut / c.stepCalls)} est.` : ''}</Text>
    </Text>
  )
}

/**
 * A workflow's agents (the spawner left out), its titles and its status (round 5). The request is the
 * prompt or brief that made the workflow's calls; `fallback` names the workflow when there is none.
 * Never an Agent call's `description`.
 */
function workflowInfo(
  view: { ids: string[]; agents: Record<string, LensAgent> },
  batch: LensBatch,
  callTask: Record<string, string>,
  runs: Record<string, LensRun>,
  fallback: string,
  roots: Record<string, string> = {},
): { members: LensAgent[]; parent: string; current: string; status: FlowStatus; both: boolean } {
  const all = view.ids.map(id => view.agents[id]!)
  const members = all.filter(a => a.id !== batch.parent)
  const request = batch.ids.map(id => callTask[id] ?? '').find(x => x !== '') ?? ''
  const { parent, current } = workflowTask(members, runs, request || fallback, roots)
  const dirs = [...new Set(members.map(a => runDirOf(a)).filter((d): d is string => d !== null))]
  // Round 6 (18.3-4): the spawner is named and left out by workflowStatus itself.
  return { members, parent, current, status: workflowStatus(all, dirs.map(d => runs[d]?.status ?? ''), batch.parent), both: runningAndWaiting(all, batch.parent) }
}

/**
 * The status indicator (round 5, requirement 4): a dot in the status colour, blinking only while in
 * progress (an Svg with SMIL where the surface draws Svg; the terminal's text dot alternates on the
 * clock), and the status in words beside it. Round 6 (A5): running and waiting at once, both colours:
 * a split dot (the terminal: two text dots).
 */
function statusIndicator(t: any, hasSvg: boolean, on1: boolean, st: FlowStatus, s: LensSettings, both = false, scope = 'status') {
  const { Box, Text, Svg } = t
  const look = statusLooks(st, both, s)
  const first = look.colors[0]!
  const dot = hasSvg ? (
    <Svg source={statusDotSvg(look.colors, look.blink, s.statusBlinkMs)} alt={`${scope}: ${look.label}`} width={14} height={14} isInteractive={look.blink} />
  ) : (
    <Text>
      <Text color={look.blink && !on1 ? s.statusPendingColor : first}>{'●'}</Text>
      {look.colors[1] !== undefined ? <Text color={look.colors[1]}>{'●'}</Text> : null}
    </Text>
  )
  return (
    <Box flexDirection="row" alignItems="center" justifyContent="center" columnGap={1}>
      {dot}
      <Text dimColor>{look.label}</Text>
    </Box>
  )
}

/**
 * Round 6 (A1, A3): the pane's own controls, right-aligned on its first row: `extra` (the minimise
 * control), then "×", which closes the pane (`$.ui.close`, d.ts:2538-2550). No API puts a control in
 * the host's title bar or tab (Pane `title` is read-only, d.ts:10876-10883; the close mark is the
 * engine's, d.ts:10868-10873), so these sit in the body. `role="dismiss"` lets a desktop draw its
 * native close control (ButtonProps.role, d.ts:1159-1168). No margin or padding: nothing to add a gap.
 */
function paneControls($: EngineInterface, t: any, id: string, extra: any = null, lead: any = null) {
  const { Box, Button } = t
  return (
    <Box flexDirection="row" justifyContent="space-between" alignItems="center" width="100%">
      <Box flexDirection="row" alignItems="center" columnGap={1} flexGrow={1}>
        {lead}
      </Box>
      <Box flexDirection="row" alignItems="center" columnGap={1}>
        {extra}
        <Button key="pane-close" label="×" role="dismiss" plain onPress={() => $.ui.close({ id })} />
      </Box>
    </Box>
  )
}

/**
 * Addendum A2 (step 1.6.1): the agent and hand-off tabs keep their own minimise, left of close, as the
 * workflow pane has since round 6 (A1): `–` minimises the tab to one line, `□` restores it. No API
 * minimises a pane (PaneOpenArgs, d.ts:7588-7660), so it is the lens's one-line view. Drill-in has no tab:
 * the view or card it is drawn in keeps its own controls.
 */
function tabMinButton($: EngineInterface, t: any, id: string, min: boolean) {
  const { Button } = t
  return <Button key="pane-min" label={min ? '□' : '–'} plain onPress={() => update($, tabsMinA, m => ({ ...(m as Record<string, boolean>), [id]: !min }))} />
}

/** A minimised agent or hand-off tab: one line with its title, then restore and close. */
function minimisedTab($: EngineInterface, t: any, id: string, title: string) {
  const { Text } = t
  return paneControls(
    $,
    t,
    id,
    tabMinButton($, t, id, true),
    <Text bold wrap="truncate">
      {title}
    </Text>,
  )
}

/**
 * Round 6 (A7): automatic notices as an exclamation icon. Hovering it reveals the notices in a small
 * card (a keyed Box is a hover scope; the card is drawn `position: "absolute"`, `display: "none"`, and
 * `hover: { display: "flex" }` shows it: BoxProps.key / hover / position, d.ts:926-958, BoxHoverProps,
 * d.ts:889-922). Pressing it shows them under the row too: the fallback where no pointer hovers (the
 * terminal, the keyboard).
 */
function noticeIcon($: EngineInterface, t: any, scope: string, notices: readonly LensNotice[]) {
  const { Box, Text, Button } = t
  if (notices.length === 0) return null
  const key = `nt:${scope}`
  const shown = notices.slice(-3)
  const tip = shown.map(n => `${fmtClock(n.at)} ${n.text.slice(0, 300)}`).join('\n')
  return (
    <Box key={`nb-${scope}`} flexDirection="row">
      <Button key={`nt-${scope}`} plain onPress={() => update($, cardOpenA, m => ({ ...(m as Record<string, boolean>), [key]: !(m as Record<string, boolean>)[key] }))}>
        <Text color="yellow" bold>
          !
        </Text>
      </Button>
      <Box position="absolute" top={1} left={0} display="none" hover={{ display: 'flex' }} borderStyle="round" paddingX={1} flexDirection="column">
        <Text wrap="wrap">{tip}</Text>
      </Box>
    </Box>
  )
}

/** The notices a pressed exclamation icon shows under its row (A7, the click fallback); null while closed. */
function noticeList(t: any, scope: string, notices: readonly LensNotice[], open: Record<string, boolean>) {
  const { Box, Text } = t
  if (notices.length === 0 || open[`nt:${scope}`] !== true) return null
  return (
    <Box flexDirection="column" paddingLeft={2}>
      {notices.slice(-3).map(n => (
        <Text color="yellow" wrap="wrap">
          ! {fmtClock(n.at)} {n.text.slice(0, 300)}
        </Text>
      ))}
    </Box>
  )
}

/** The arrow panel: who handed off to whom, the hand-off's usage, then the record and hand-back, or the prompt. */
function edgeBody(
  $: EngineInterface,
  t: any,
  ui: LensUi,
  doc: LensDoc,
  agents: Record<string, LensAgent>,
  label: (a: LensAgent) => ChartLabel,
  open: Record<string, boolean>,
  s: LensSettings,
  av: ChartAvatars,
  hasSvg: boolean,
  closeHere = false,
) {
  const { Box, Text } = t
  const a = liveOr(agents, ui.edge, ui.edgeSnap)
  if (!a)
    return (
      <Box flexDirection="column">
        {closeHere ? paneControls($, t, EDGE, tabMinButton($, t, EDGE, false)) : null}
        <Text dimColor>Press an arrow under the flowchart.</Text>
      </Box>
    )
  const from = a.parent !== null ? agents[a.parent] : undefined
  const tk = a.turns
  const l = label(a)
  const fromName = from ? label(from).name : '?'
  const prompt = doc.agent === a.id ? doc.prompt || a.prompt : a.prompt
  const hasRecord = doc.agent === a.id && doc.handoff !== ''
  return (
    <Box flexDirection="column">
      {closeHere ? paneControls($, t, EDGE, tabMinButton($, t, EDGE, false)) : null}
      {panelHeader(t, initials(l.name), `${fromName} ${a.loop ? '<->' : '->'} ${l.name}`, `${l.model} · ${l.role}`, a.status, headerAvatar(t, hasSvg, av, a, l.name))}
      {section($, t, open, s, `edge:${a.id}:usage`, 'edge-usage', `Usage (in ${fmtTokens(tk.in + tk.cr + tk.cw)}, out ${fmtTokens(tk.out)})`, () => [
        kv(t, 'Input', fmtTokens(tk.in + tk.cr + tk.cw)),
        kv(t, 'Output', fmtTokens(tk.out)),
        kv(t, 'Cache read', fmtTokens(tk.cr)),
        kv(t, 'Cache write', fmtTokens(tk.cw)),
        kv(t, 'Uncached', fmtTokens(tk.in)),
      ])}
      {doc.error !== '' && (
        <Text color="red" wrap="wrap">
          {doc.error}
        </Text>
      )}
      {hasRecord
        ? [
            section($, t, open, s, `edge:${a.id}:doc`, 'edge-doc', `Handoff (${doc.handoff})`, () => <Text wrap="wrap">{doc.handoffText === '' ? '—' : doc.handoffText}</Text>),
            section($, t, open, s, `edge:${a.id}:back`, 'edge-back', `Hand-back (${doc.handback === '' ? '—' : doc.handback})`, () => <Text wrap="wrap">{doc.handbackText === '' ? '—' : doc.handbackText}</Text>),
          ]
        : [
            section($, t, open, s, `edge:${a.id}:prompt`, 'edge-prompt', `Prompt (${prompt.length} chars)`, () => <Text wrap="wrap">{prompt === '' ? '(the prompt is not known yet)' : prompt}</Text>),
            doc.agent === a.id && doc.hint !== '' ? (
              <Text dimColor wrap="wrap">
                A record found by time order only, not named in the brief: {doc.hint}
              </Text>
            ) : null,
          ]}
    </Box>
  )
}

/**
 * /ai-dlc:lens-keepalive (step 1.4): the Cache keep-alive section of an agent pane, collapsed like every
 * section. Measured: each track's armings, expiry and pings as ai-dlc publishes them, and the agent's
 * cache-read tokens. Derived: the kept-warm time (`keptWarm`) and the savings, priced from the metadata
 * file only (`savingsOfAgent`), `—` when a price is missing.
 */
function keepaliveSection($: EngineInterface, t: any, open: Record<string, boolean>, s: LensSettings, id: string, ka: KeepaliveFigures) {
  const { Text } = t
  const head = ka.warm.map(w => `${w.track} ${fmtSpan(w.ms)}`).join(' · ')
  return section($, t, open, s, `agent:${id}:keepalive`, 'agent-keepalive', `Cache keep-alive (${head} · saved ${ka.session.text})`, () => [
    ...ka.warm.map(w => kv(t, `Kept warm, ${w.track} track`, `${fmtSpan(w.ms)}${w.running ? ' (running)' : ''} · ${w.pings} pings · ${w.armings} armings`)),
    ka.warm.every(w => w.armings === 0) ? <Text dimColor wrap="wrap">No keep-alive arming seen this session (ai-dlc keep-alive absent, off, or not armed yet).</Text> : null,
    kv(t, 'Saved by cache reads, this agent', ka.agent === null ? '—' : ka.agent.text),
    kv(t, 'Saved by cache reads, session', ka.session.text),
    // Round 4: a panel shows figures, never where they came from; `—` is a missing price (the sources stay in the figures' `source`).
    <Text dimColor wrap="wrap">
      Kept warm: from each arming to the cache's expiry, its own TTL included. Saved: cache-read tokens x (input price - cache-read price), priced from the model metadata file, — where a price is missing; the cache-write premium is not taken off.
    </Text>,
  ])
}

/**
 * The avatar panel (findings 3, 4 and the window addendum): every figure, never where it came from
 * (round 4: the sources stay in state and the probe log). Each background task is its own collapsible entry.
 */
function agentBody(
  $: EngineInterface,
  t: any,
  ui: LensUi,
  agents: Record<string, LensAgent>,
  calls: Record<string, LensCall[]>,
  thinking: Record<string, string>,
  mainWindow: number,
  label: (a: LensAgent) => ChartLabel,
  defs: Record<string, LensDef>,
  costing: LensCosting,
  open: Record<string, boolean>,
  s: LensSettings,
  av: ChartAvatars,
  hasSvg: boolean,
  closeHere = false,
  ka: KeepaliveFigures | null = null,
) {
  const { Box, Text, Button } = t
  const a = liveOr(agents, ui.agent, ui.agentSnap)
  if (!a || ui.agent === null)
    return (
      <Box flexDirection="column">
        {closeHere ? paneControls($, t, AGENT, tabMinButton($, t, AGENT, false)) : null}
        <Text dimColor>Press an avatar under the flowchart.</Text>
      </Box>
    )
  const id = a.id
  const main = agents['main']
  const mainModel = main?.model ?? ''
  const l = label(a)
  const def = own(defs, a.type)
  const mod = modelOf(def && def.path !== '' ? def : undefined, a.callModel, a.parentModel || mainModel)
  const w = id === 'main' && mainWindow > 0 ? { n: mainWindow as number | null, source: "the session's context window ($.session.usage)" } : windowOf(costing, a.model, mainModel, mainWindow, s.windowFallback)
  const used = contextUsed(a.last)
  // Live: the step sums; a loop whose steps no hook saw falls back to its turn sums.
  const sum = a.steps.in + a.steps.out + a.steps.cr + a.steps.cw > 0 ? a.steps : a.turns
  // Round 5: per request, long-context prices over the threshold (lens setting > file override > model).
  const cost = costOfAgent(costing, a.model, a.reqs ?? [], sum, s.cacheWriteRate, s.longContextThresholdTokens > 0 ? s.longContextThresholdTokens : null)
  const facts = (() => {
    const json = parseCosting(costing)
    return json === null ? null : lookupModel(json, a.model)
  })()
  const list = calls[id] ?? []
  const th = thinking[id] ?? ''
  const notStarted = a.status === 'pending'
  const win = w.n === null ? '—' : fmtTokens(w.n)
  const bar = usageBar(used, w.n)
  return (
    <Box flexDirection="column">
      {closeHere ? paneControls($, t, AGENT, tabMinButton($, t, AGENT, false)) : null}
      {panelHeader(t, initials(l.name), l.name, `${mod.text} · ${l.role}`, a.status, headerAvatar(t, hasSvg, av, a, l.name))}
      {notStarted ? (
        <Text dimColor>Not started yet: no figures.</Text>
      ) : (
        section($, t, open, s, `agent:${id}:usage`, 'agent-usage', `Usage (${fmtTokens(used)} / ${win})`, () => [
          bar !== '' ? <Text color="cyan">{bar}</Text> : null,
          kv(t, 'Context', `${fmtTokens(used)} / ${win}`),
          kv(t, 'Input', fmtTokens(sum.in + sum.cr + sum.cw)),
          kv(t, 'Output', fmtTokens(sum.out)),
          kv(t, 'Cache read', fmtTokens(sum.cr)),
          kv(t, 'Cache write', fmtTokens(sum.cw)),
          kv(t, 'Uncached', fmtTokens(sum.in)),
          // Round 6 (18.4-2): a long-context model whose requests seen do not add up to its totals: — and "partial".
          s.showCost ? kv(t, 'Cost', cost.partial ? '— (partial: not every request was seen)' : cost.text) : null,
          s.showCost && facts?.long && cost.text !== '—' ? kv(t, 'Long-context requests', `${cost.long} of ${(a.reqs ?? []).length}`) : null,
          kv(t, 'Ran on', a.model === '' ? '—' : a.model),
          ...limitRows(costing, a.model).map(([k, v]) => kv(t, k, v)),
        ])
      )}
      {s.keepaliveSection && ka !== null ? keepaliveSection($, t, open, s, id, ka) : null}
      {section($, t, open, s, `agent:${id}:calls`, 'agent-calls', `Tool calls (${list.length})`, () =>
        list.length === 0 ? <Text dimColor>none yet</Text> : list.slice(-s.callsShown).map(c => callRow(t, c)),
      )}
      {section($, t, open, s, `agent:${id}:tasks`, 'agent-tasks', `Background tasks (${uniqueTasks(a.bg).length})`, () =>
        a.bg.length === 0 ? (
          <Text dimColor>none</Text>
        ) : (
          // Step 1.6.1 (the background-task bug): one entry per task (uniqueTasks), each a keyed Box with its
          // own Button key and open key, so every entry starts collapsed and toggles alone across redraws.
          uniqueTasks(a.bg).map((b, i) => {
            const tid = b.id !== '' ? b.id : `#${i}`
            const key = `task:${id}:${tid}`
            const o = isOpen(open, key, s)
            const kid = isAgentTask(b) ? agents[b.id] : undefined
            const output = (kid?.output ?? '') || (b.output ?? '')
            return (
              <Box key={`tb-${tid}`} flexDirection="column">
                <Box flexDirection="row" flexWrap="wrap">
                  <Button key={`task-${tid}`} label={o ? '[-]' : '[+]'} onPress={() => toggleOpen($, key, s)} />
                  <Text wrap="wrap"> {taskLine(b, kid ? label(kid).name : '')}</Text>
                </Box>
                {o && (
                  <Box flexDirection="column" paddingLeft={2}>
                    {kv(t, 'Type', b.type)}
                    {kv(t, 'Id', b.id)}
                    {kv(t, 'Started', fmtClock(b.startedAt))}
                    {kv(t, 'Ended', fmtClock(b.endedAt))}
                    {isAgentTask(b) ? kv(t, 'Agent type', b.agentType || kid?.type || '—') : null}
                    {kv(t, 'Output', output === '' ? '—' : output)}
                  </Box>
                )}
              </Box>
            )
          })
        ),
      )}
      {section($, t, open, s, `agent:${id}:thinking`, 'agent-thinking', `Thinking (${th.length} chars)`, () => (
        <Text dimColor wrap="wrap">
          {th === '' ? '(no thinking chunks seen)' : th}
        </Text>
      ))}
      <Box flexDirection="row" flexWrap="wrap" marginTop={1}>
        <Button key="agent-view" label="View transcript" onPress={() => $.ui.view(id === 'main' ? {} : { agentId: id })} />
        <Button key="agent-refresh" label="Refresh" onPress={() => refreshList($, 'refresh press')} />
      </Box>
    </Box>
  )
}

/** SVG_CAP with thousands separators, for the dim lines. */
const fmtCap = String(SVG_CAP).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/**
 * The chart as drawn on a surface: the Svg, or the terminal's text chart. The Svg never passes
 * SVG_CAP (one oversize source refuses the whole pane, spike 029 E2): images that would push it over
 * are left out, and a dim line says so; a chart over it even without images is drawn as text.
 * On the terminal an agent whose avatar is a trusted PNG file draws it through `Image` (AC-13.3).
 * `kp` prefixes the Image keys: a tree drawing two charts of one agent (step 1.5) needs distinct keys.
 */
function chartNode(t: any, hasSvg: boolean, on1: boolean, ids: string[], agents: Record<string, LensAgent>, label: (a: LensAgent) => ChartLabel, s: LensSettings, alt: string, av: ChartAvatars, kp = '') {
  const { Box, Text, Svg, Image } = t
  let note: string | null = null
  if (hasSvg) {
    // A throw here would blank the whole pane: draw the text chart instead and keep the error.
    let chart: ReturnType<typeof flowchartSvg> | null = null
    try {
      chart = flowchartSvg(ids, agents, label, chartSize(s), av)
    } catch (err) {
      lensFail('flowchart', err)
    }
    if (chart !== null && !chart.tooLarge) {
      const left = chart.dropped.length
      // Round 5: Svg has no alignment of its own (SvgProps): its Box centres it both ways.
      return (
        <Box flexDirection="column" alignItems="center" justifyContent="center">
          <Box flexDirection="row" alignItems="center" justifyContent="center">
            <Svg source={chart.source} alt={alt} width={chart.width} height={chart.height} isInteractive={true} />
          </Box>
          {left > 0 && (
            <Text dimColor wrap="wrap">
              {left === 1 ? 'An avatar image was' : `${left} avatar images were`} left out ({chart.dropped.join(', ')}): the chart would pass the {fmtCap}-character Svg limit.
            </Text>
          )}
        </Box>
      )
    }
    note = chart === null ? 'The chart could not be drawn (see the lens errors): the agents as a list.' : `The chart is too large to draw (over the ${fmtCap}-character Svg limit): the agents as a list.`
  }
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center">
      {note !== null && <Text dimColor wrap="wrap">{note}</Text>}
      {textChart(ids, agents, label).map(row => {
        const a = agents[row.id]!
        const blinking = s.blink && isRunning(a.status)
        const color = blinking ? (on1 ? 'green' : 'gray') : a.status === 'failed' || a.status === 'killed' ? 'red' : a.status === 'pending' ? 'gray' : 'green'
        const png = hasSvg || av.style === 'initials' ? null : (av.image(avatarKey(a.type))?.png ?? null)
        return (
          <Box flexDirection="column">
            {png === null ? (
              <Text>
                {row.head}
                <Text color={color}>{'●'}</Text> {row.lines[0]}
              </Text>
            ) : (
              <Box flexDirection="row" columnGap={1}>
                <Text>
                  {row.head}
                  <Text color={color}>{'●'}</Text>
                </Text>
                <Image key={`${kp}avatar-${row.id}`} source={{ png }} columns={2} rows={1} alt={initials(row.lines[0] ?? '')} />
                <Text>{row.lines[0]}</Text>
              </Box>
            )}
            <Text dimColor>{row.lines[1]}</Text>
          </Box>
        )
      })}
    </Box>
  )
}

/** Everything a drawing reads, once. */
async function snapshot($: EngineInterface) {
  const agents = await read($, agentsA)
  const roster = await read($, rosterA)
  const defs = await read($, defsA)
  const conf = await read($, lensA)
  const s = conf.settings as LensSettings
  const mainModel = agents['main']?.model ?? ''
  // Read so a drawing redraws when an avatar image loads.
  await read($, avatarRevA)
  // Read so the anomaly markers (▲) of every drawing redraw when the detector's list changes.
  const anomalies = await read($, anomaliesA)
  const marks: Marks = { list: anomalies, s }
  return { agents, roster, defs, conf, s, mainModel, label: labeler(roster, defs, mainModel), av: chartAvatars(s), marks }
}

/** A settings warning without the level it names (round 4): /ai-dlc:lens-configure still says where. */
const unlevel = (msg: string): string => {
  for (const w of [SETTINGS_LOCAL, SETTINGS_PROJECT, LENS_JSON]) for (const at of [`${w} env: `, `${w}: `]) if (msg.startsWith(at)) return msg.slice(at.length)
  return msg
}

function settingsRows(t: any, conf: LensConfig) {
  const { Box, Text } = t
  return (
    <Box flexDirection="column">
      <Text bold>Lens settings (effective value)</Text>
      {KEYS.map(k => (
        <Text dimColor>
          {k} = {JSON.stringify(conf.settings[k])}
        </Text>
      ))}
      {conf.ignored.map(x => (
        <Text color="yellow">{unlevel(x)}</Text>
      ))}
    </Box>
  )
}

/** A stop-time `background_tasks` entry as a task: a subagent keeps its agent type. */
function stopTask(b: { id: string; type: string; status: string; description: string; agent_type?: string }, source: string): LensTask {
  return { id: b.id, type: b.type, status: b.status, description: b.description, source, ...(b.agent_type ? { agentType: b.agent_type } : {}) }
}

/**
 * Step 1.5: the workflow view's first row. Left: the `Panel Type` switch (drill-in or tab, for the session)
 * and the notices no workflow claims. Right: pinned / docked, full screen, minimise, restore (while a
 * size to return to is kept) and, in the pane, close. No API puts a control in the host's title bar or
 * tab (Pane `title` read-only, d.ts:10876-10883; the close mark is the engine's, d.ts:10868-10873), so
 * they sit in the body. What each can and cannot do: see `showView`, `openSizeOf` and MANUAL-CHECKS Z9-Z13.
 */
function viewControls($: EngineInterface, t: any, v: LensView, place: 'pinned' | 'docked', where: string, lead: any) {
  const { Box, Button } = t
  const full = v.size === 'fullscreen'
  const min = v.size === 'minimised'
  return (
    <Box flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" width="100%">
      <Box flexDirection="row" alignItems="center" columnGap={1} flexGrow={1}>
        {lead}
      </Box>
      <Box flexDirection="row" alignItems="center" columnGap={1}>
        <Button key="pane-place" label={place} plain onPress={() => changeView($, x => ({ ...x, place: place === 'pinned' ? 'docked' : 'pinned' }))} />
        <Button key="pane-full" label={full ? '⤡' : '⤢'} plain onPress={() => changeView($, x => (x.size === 'fullscreen' ? viewRestore(x) : viewResize(x, 'fullscreen')))} />
        <Button key="pane-min" label={min ? '□' : '–'} plain onPress={() => changeView($, x => (x.size === 'minimised' ? viewRestore(x) : viewResize(x, 'minimised')))} />
        {v.prev.length > 0 ? <Button key="pane-restore" label="↺" plain onPress={() => changeView($, viewRestore)} /> : null}
        {where === 'pane' ? <Button key="pane-close" label="×" role="dismiss" plain onPress={() => $.ui.close({ id: CHART })} /> : null}
      </Box>
    </Box>
  )
}

/** Step 1.5: an arrow or avatar opened in drill-in mode, with "< Back" (`target`: the drawing it was pressed in). */
async function drillBody($: EngineInterface, t: any, target: string, d: LensDrill, hasSvg: boolean) {
  const { Box, Button } = t
  const { agents, defs, s, label, av } = await snapshot($)
  const open = await read($, cardOpenA)
  const back = <Button key="drill-back" label="< Back" onPress={() => drillBack($, target)} />
  if (d.kind === 'edge')
    return (
      <Box flexDirection="column" width="100%">
        {back}
        {edgeBody($, t, { ...UI0, edge: d.id, edgeSnap: d.snap }, await read($, docA), agents, label, open, s, av, hasSvg)}
      </Box>
    )
  const ka = s.keepaliveSection ? await keepaliveFigures($, d.id) : null
  return (
    <Box flexDirection="column" width="100%">
      {back}
      {agentBody(
        $,
        t,
        { ...UI0, agent: d.id, agentSnap: d.snap },
        agents,
        await read($, callsA),
        await read($, thinkingA),
        await read($, mainWindowA),
        label,
        defs,
        await read($, costingA),
        open,
        s,
        av,
        hasSvg,
        false,
        ka,
      )}
    </Box>
  )
}

/**
 * Addendum A6: the "Panel Type" option switch, the look of the spike's "Panels:" row (rounds 2 to 6): a
 * label, then each choice as a Button; since step 1.6.1.l2 (human) radio glyphs, the current one `◉`, the other `○`:
 * `Panel Type: ◉ Drill in  ○ Tab`.
 * Pressing a choice sets the session's mode (it wins over `panelOpenMode` from then on, A4); it never
 * writes lens.json.
 */
function panelTypeSwitch($: EngineInterface, t: any, mode: 'tab' | 'drill-in', keys: { drill: string; tab: string }) {
  const { Box, Text, Button } = t
  return (
    <Box flexDirection="row" alignItems="center" columnGap={1}>
      <Text dimColor>Panel Type:</Text>
      <Box flexDirection="row" alignItems="center" columnGap={2}>
        <Button key={keys.drill} label={`${mode === 'drill-in' ? '◉' : '○'} Drill in`} plain onPress={() => update($, openModeA, () => 'drill-in')} />
        <Button key={keys.tab} label={`${mode === 'tab' ? '◉' : '○'} Tab`} plain onPress={() => update($, openModeA, () => 'tab')} />
      </Box>
    </Box>
  )
}

/**
 * The step-chart sources of one workflow's run (`runId`): the run folders the lens listed (`LensRun.records`), the
 * run itself first, then each child run drawn in it (`parent:`), whose steps keep their own numbers under the
 * child's name. `redirect`: each run merged away (its folder gone, so not listed), to the run that keeps its
 * records and that run's step offset for it (`LensRun.offsets`). `roots`: each run's top run (`runRoots`).
 */
function stepSources(runId: string, runs: Record<string, LensRun>, roots: Record<string, string>): { sources: StepSource[]; redirect: Record<string, { dir: string; offset: number }> } {
  const inFlow = (d: string) => runId !== '' && (runIdOf(d) === runId || own(roots, runIdOf(d)) === runId)
  const sources: StepSource[] = []
  const redirect: Record<string, { dir: string; offset: number }> = {}
  for (const [d, r] of Object.entries(runs)) {
    if (!inFlow(d)) continue
    if (r.records !== undefined) {
      // The Features table's root names and renumbering go with the folder's records.
      sources.push({ dir: d, names: r.records, stages: r.stages, child: runIdOf(d) !== runId, ...(r.features ? { features: r.features } : {}), ...(r.renames ? { renames: r.renames } : {}), ...(r.codeMap ? { codeMap: r.codeMap } : {}) })
      continue
    }
    const home = r.parent === undefined ? undefined : Object.entries(runs).find(([hd]) => runIdOf(hd) === runIdOf(r.parent))
    const offset = home === undefined ? undefined : own(home[1].offsets ?? {}, runIdOf(d))
    if (home !== undefined && offset !== undefined) redirect[runIdOf(d)] = { dir: home[0], offset }
    // No offset for it: its live spawns keep their own step numbers, under its name, with its stages.
    else sources.push({ dir: d, names: [], stages: r.stages, child: runIdOf(d) !== runId })
  }
  sources.sort((a, b) => Number(a.child) - Number(b.child))
  return { sources, redirect }
}

/**
 * One workflow's step charts (`stepCharts` over `stepSources`), by step code, highest first (`stepsDescending`).
 * `view`: the workflow as drawn (`batchView`); `spawner`: its root. `steps`: the step charts drawn; `gone`: the
 * live spawns whose brief names a record that is no longer on disk under that name or the one it was renamed to
 * (briefs written before a renumbering), shown as one collapsed line under the charts, never as a chart.
 */
function flowSteps(view: { ids: string[]; agents: Record<string, LensAgent> }, spawner: string, runId: string, runs: Record<string, LensRun>, roots: Record<string, string>): { steps: StepChart[]; gone: LensAgent[] } {
  const { sources, redirect } = stepSources(runId, runs, roots)
  const live = view.ids.filter(id => id !== spawner).map(id => view.agents[id]!)
  const root = view.agents[spawner] ?? live[0]
  if (root === undefined) return { steps: [], gone: [] }
  const all = stepsDescending(stepCharts(sources, live, root, redirect))
  const lost = all.find(c => c.key === NOT_FOUND)
  return { steps: all.filter(c => c.key !== NOT_FOUND), gone: lost === undefined ? [] : lost.ids.slice(1).map(id => lost.agents[id]!) }
}

/** Where the workflow view is drawn: the pane (Pane props, d.ts:10867-10909) or the band above the prompt (AbovePrompt props, d.ts:10809-10850). */
type ViewSite = { surface: string; columns: number | undefined; rows: number; where: 'pane' | 'band' }

/**
 * The workflow view (round 4 pane; step 1.5 layout), drawn in the pane and, pinned, in the band. Its
 * identity is the run (`joinWorkflow`): every run the lens has seen is listed, newest start first
 * (`runStartOf`, `newestFirst`; the selected run stays selected when the order changes), and none is ever
 * hidden by a newer one (AC-1.5.1). Wide (`wideColumns` and up, from the site's body columns,
 * Pane `bodyColumns` d.ts:10890-10894, AbovePrompt `bodyColumns` d.ts:10840-10848): the runs stacked as
 * collapsible panels on the right, the selected run's step charts beside them (step 8.6.1: one chart per
 * top-level step of the run, by code, highest first, `flowSteps`). Narrow: every run minimised to one row (dot and
 * title); choosing one opens its step charts, "< Runs" goes back. Minimised: one line. Full screen: the
 * frame asks the whole viewport, the body fills the rows it is given and shows one step's chart. The run
 * panels and sections start collapsed (`collapsedByDefault`); the step charts are always drawn.
 */
async function workflowBody($: EngineInterface, t: any, site: ViewSite) {
  const { Box, Text, Button } = t
  const { agents, s, label, av, marks } = await snapshot($)
  const wf = await readWorkflows($)
  const batches = await read($, batchesA)
  const order = await read($, orderA)
  const callAgent = await read($, callAgentA)
  const callTask = await read($, callTaskA)
  const runs = await read($, runsA)
  const roots = await readRoots($)
  const open = await read($, cardOpenA)
  const thinking = await read($, thinkingA)
  const calls = await read($, callsA)
  const mainContext = await read($, contextA)
  const notices = await read($, noticesA)
  const anomalies = marks.list
  const v = await read($, viewA)
  const drills = await read($, drillsA)
  const mode = openModeOf(await read($, openModeA), String(s.panelOpenMode))
  const place = placeOf(v, String(s.workflowPlace))
  const hasSvg = site.surface !== 'terminal'
  const on1 = hasSvg ? false : (await read($, tick))
  const errors = lensErrors.map(x => <Text color="red">lens hook error: {x}</Text>)
  // Newest start first (`runStartOf`, `newestFirst`): a run resumed later stays below one started after it;
  // step 27.1: a child run drawn here takes its top run's start (`workflowRunOf`).
  const flows = newestFirst(
    wf.order.map(w => {
      const batch = workflowBatch(wf, w, batches, agents)
      const view = batchView(batch, agents, order, callAgent)
      const root = view.agents[batch.parent]!
      const n = batch.ids.length
      const rootName = label(root).name
      const info = workflowInfo(view, batch, callTask, runs, `${rootName} spawned ${n} agent${n > 1 ? 's' : ''}`, roots)
      // Step 1.6.1: the run's anomalies (its run folders and its agents), the worst colour on its marker.
      // Step 27.1: a child run's folder is among them, so its anomalies (named by the child's run) show here.
      const dirs = [...new Set(info.members.map(a => runDirOf(a)).filter((d): d is string => d !== null))]
      // Step 27.1: the id and start are the top run's when a child run (`parent:`) is drawn in this one.
      const run = workflowRunOf(info.members, runs, roots)
      // Step 8.6.1: the run's step charts, by code, highest first, from its records and its live spawns.
      const { steps, gone } = flowSteps(view, batch.parent, run.id, runs, roots)
      return { w, batch, view, root, n, rootName, info, bad: anomaliesOf(anomalies, dirs, view.ids), start: run.start, id: run.id || w, steps, gone }
    }),
  )
  const stepSel = await read($, stepSelA)
  const ws = flows.map(f => f.w)
  const loose = notices.filter(n => !ws.includes(n.w))
  type Flow = (typeof flows)[number]
  const modeButton = panelTypeSwitch($, t, mode, { drill: 'panel-drill-in', tab: 'panel-tab' })
  // Full screen: the body takes every row the site gives it (the frame was asked for the whole viewport).
  const fill = v.size === 'fullscreen' && site.rows > 0 ? { minHeight: site.rows } : {}

  // A1: minimised, one line: the newest workflow's dot and title, how many more, and the controls (restore).
  if (v.size === 'minimised') {
    const top = flows[0]
    return (
      <Box flexDirection="column" width="100%">
        {viewControls(
          $,
          t,
          v,
          place,
          site.where,
          top ? (
            <Box flexDirection="row" alignItems="center" columnGap={1}>
              {statusIndicator(t, hasSvg, on1, top.info.status, s, top.info.both)}
              {anomalyMark(t, anomalies, s)}
              <Text bold wrap="truncate">
                {top.info.parent}
              </Text>
              {ws.length > 1 ? <Text dimColor>(+{ws.length - 1})</Text> : null}
            </Box>
          ) : (
            <Text dimColor>AI-DLC workflow</Text>
          ),
        )}
      </Box>
    )
  }

  const controls = viewControls(
    $,
    t,
    v,
    place,
    site.where,
    <Box flexDirection="row" alignItems="center" columnGap={1}>
      {modeButton}
      {noticeIcon($, t, 'pane', loose)}
    </Box>,
  )
  const keepalive = await keepaliveRow($, t)
  const pinnedNote =
    site.where === 'pane' && place === 'pinned' && !BAND_SURFACES.has(site.surface) ? (
      <Text dimColor wrap="wrap">
        pinned: this surface has no band above the prompt, so the view stays a pane.
      </Text>
    ) : null
  // Step 1.6.1: "Anomalies (n)", collapsed like every section; absent while there is none.
  const anomalySection =
    anomalies.length === 0
      ? null
      : section($, t, open, s, 'anomalies', 'anomalies', `Anomalies (${anomalies.length})`, () =>
          anomalies.map(x => (
            <Box key={`an-${x.key}`} flexDirection="row" columnGap={1}>
              {anomalyMark(t, [x], s)}
              <Text wrap="wrap">{anomalyLine(x)}</Text>
            </Box>
          )),
        )
  const head = [controls, pinnedNote, keepalive, noticeList(t, 'pane', loose, open), anomalySection]

  // Drill-in, pressed in this view: the details with "< Back", in place of the runs.
  const drilled = drills['pane']
  if (drilled !== undefined)
    return (
      <Box flexDirection="column" width="100%" {...fill}>
        {head}
        {await drillBody($, t, 'pane', drilled, hasSvg)}
        {errors}
      </Box>
    )

  if (ws.length === 0)
    return (
      <Box flexDirection="column" width="100%" {...fill}>
        {head}
        <Box flexDirection="column" alignItems="center" justifyContent="center" width="100%">
          <Text dimColor wrap="wrap">
            No workflow yet: it shows here when an agent is spawned.
          </Text>
        </Box>
        {errors}
      </Box>
    )

  const many = ws.length > 1
  const sel = selectedOf(v, ws)

  /**
   * Step 8.6.1 (the human, 2026-10-24): one run's step charts replace its task panels and its one chart. Each
   * top-level step of the run is its own chart (`flowSteps`), by code, highest first (8.6.1.l1 A): a heading (its status, its ▲, `Step
   * <n> · <stage>` and ⤢, which shows that step in full screen), the chart with every sub-step under its parent
   * step, then its avatar and arrow Buttons. `size`: the settings it is drawn at (full screen: larger); `kp`: the
   * prefix of its Image keys and its ⤢ key, so the charts of one tree never share a key; `bp`: the prefix of its
   * avatar and arrow Buttons (an agent is in one step chart only, so their keys stay unique without the step).
   */
  const stepLabel = (c: StepChart) => (a: LensAgent): ChartLabel => {
    // Every node names its step code before its model: `28.1 · sonnet`; the step itself (the root) `28 · opus`.
    const code = c.codes[a.id] ?? ''
    const l = label(a)
    return { ...l, model: code === '' ? l.model : l.model === '' ? code : `${code} · ${l.model}` }
  }
  const stepLook = (c: StepChart): { st: FlowStatus; both: boolean } => {
    // A record with no hand-back and no live agent counts as not started (pending, grey).
    const all = c.ids.map(id => c.agents[id]!).map(a => (a.status === OPEN ? { ...a, status: 'pending' } : a))
    const spawner = c.key === NO_STEP ? (c.ids[0] ?? null) : null
    return { st: workflowStatus(all, [], spawner), both: runningAndWaiting(all, spawner) }
  }
  // The ▲ of a step: an anomaly of one of its agents, or of one of its steps in its run folder.
  const stepBad = (c: StepChart): LensAnomaly[] =>
    marks.list.filter(x => (x.agent !== '' && c.ids.includes(x.agent)) || (c.step !== null && x.step !== '' && topStepOf(x.step) === c.step && x.run !== '' && runIdOf(x.run) === runIdOf(c.dir)))
  const stepChart = (f: Flow, c: StepChart, size: LensSettings, kp: string, bp: string, full = false) => {
    const lab = stepLabel(c)
    const look = stepLook(c)
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" width="100%" marginTop={1}>
        <Box flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={1}>
          {statusIndicator(t, hasSvg, on1, look.st, s, look.both, 'step status')}
          {anomalyMark(t, stepBad(c), s)}
          <Text bold wrap="wrap">
            {c.title}
          </Text>
          {full ? null : (
            <Button
              key={`${kp}step-full`}
              label="⤢"
              plain
              onPress={async () => {
                await update($, stepSelA, m => ({ ...(m as Record<string, string>), [f.w]: c.key }))
                await changeView($, x => ({ ...viewResize(x, 'fullscreen'), selected: f.w }))
              }}
            />
          )}
        </Box>
        {s.chartInPane ? chartNode(t, hasSvg, on1, c.ids, c.agents, lab, size, `${full ? 'Full screen chart' : 'Step chart'} ${c.key}: ${f.info.parent}`, av, kp) : null}
        {agentButtons($, t, c.ids.filter(id => !c.bare.includes(id)), c.agents, lab, 'pane', c.ids[0] ?? null, marks, bp)}
      </Box>
    )
  }
  const stepList = (f: Flow, kp: string) => {
    const wPrefix = many ? `${f.w}:` : ''
    const charts = f.steps.map(c => stepChart(f, c, s, `${kp}${wPrefix}s${c.key}:`, wPrefix))
    // Step 8.6.1.l1: briefs naming records that are gone (written before the run was renumbered): one collapsed
    // line under the charts, each brief's agent and the record it names when opened; nothing while there is none.
    if (f.gone.length === 0) return charts
    return [
      ...charts,
      <Box key={`${kp}${wPrefix}gone`} flexDirection="column" width="100%" marginTop={1}>
        {section($, t, open, s, `${f.w}:gone`, `${kp}${wPrefix}steps-gone`, `Briefs naming records no longer on disk (${f.gone.length})`, () =>
          f.gone.map(a => (
            <Text dimColor wrap="wrap">
              {label(a).name} ({a.type || 'agent'}): {a.handoff ?? '(no record named)'}
            </Text>
          )),
        )}
      </Box>,
    ]
  }

  // Addendum A7: full screen is drawn by the lens itself, on every host. No host lets a plugin take the
  // whole window: PaneOpenArgs `rows` counts only inline above the prompt, `columns` only in the terminal's
  // dock (at most 45%), and the VS Code panel is sized by VS Code (d.ts:7638-7658, Pane `placement`). So full
  // screen raises the pane (`showView`, focus) and gives it to the selected run alone. Step 8.6.1: it shows the
  // selected step's chart (⤢ on a step chart, else the first, the highest code), drawn 1.5 times larger and filling the body's
  // rows, with a "Steps:" row to show another; the run list, notices, keep-alive line and Anomalies section are
  // hidden until ⤡ (or ↺) restores the view.
  if (v.size === 'fullscreen') {
    const f = flows.find(x => x.w === sel) ?? flows[0]!
    const big = fullscreenSettings(s)
    const step = f.steps.find(c => c.key === own(stepSel as Record<string, string>, f.w)) ?? f.steps[0]
    const note =
      site.surface === 'terminal'
        ? 'Full screen: this step only, at the height the terminal gives the pane (docked beside the transcript it is at most 45% wide). ⤡ restores.'
        : 'Full screen: this step only, filling the pane. This surface sizes the pane itself: maximise or widen its panel for more room. ⤡ restores.'
    return (
      <Box flexDirection="column" width="100%" {...fill}>
        {controls}
        <Text dimColor wrap="wrap">
          {note}
        </Text>
        {many ? (
          <Box flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={1}>
            <Text dimColor>Runs:</Text>
            {flows.map(x => (
              <Button key={`fs-show-${x.w}`} label={x.w === f.w ? `(${x.info.parent})` : x.info.parent} plain onPress={() => changeView($, y => ({ ...y, selected: x.w }))} />
            ))}
          </Box>
        ) : null}
        <Box flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={1}>
          {statusIndicator(t, hasSvg, on1, f.info.status, s, f.info.both)}
          {anomalyMark(t, f.bad, s)}
          <Text bold wrap="wrap">
            {f.info.parent}
          </Text>
        </Box>
        {f.steps.length > 1 ? (
          <Box flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={1}>
            <Text dimColor>Steps:</Text>
            {f.steps.map(c => {
              const name = c.step === null ? 'no step' : c.key
              return <Button key={`fs-step-${c.key}`} label={c.key === step?.key ? `(${name})` : name} plain onPress={() => update($, stepSelA, m => ({ ...(m as Record<string, string>), [f.w]: c.key }))} />
            })}
          </Box>
        ) : null}
        <Box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center" width="100%">
          {step === undefined ? <Text dimColor>No step yet.</Text> : stepChart(f, step, big, 'fs:', 'fs:', true)}
        </Box>
        {errors}
      </Box>
    )
  }

  /**
   * One run's content: its spawner's thinking and gathered context. Step 8.6.1: `chart` draws the run's step
   * charts above them (the narrow view); the wide view draws the selected run's step charts beside the list, so
   * its panel names how many there are.
   */
  const content = (f: Flow, chart = false) => {
    const { w, batch, n, rootName } = f
    const th = thinking[batch.parent] ?? ''
    const ctx = (batch.parent === 'main' ? mainContext : (calls[batch.parent] ?? []).filter(c => CONTEXT_TOOLS.has(c.tool))).slice(-s.contextLimit)
    const wPrefix = many ? `${w}:` : ''
    const k = f.steps.length
    return (
      <Box flexDirection="column" alignItems="center" paddingLeft={2} width="100%">
        <Text dimColor wrap="wrap">
          {rootName} spawned {n} agent{n > 1 ? 's' : ''}
        </Text>
        <Text dimColor wrap="wrap">
          {k} step chart{k === 1 ? '' : 's'}
        </Text>
        {chart ? stepList(f, 'nr:') : null}
        <Box flexDirection="column" width="100%">
          {section($, t, open, s, `${w}:thinking`, `${wPrefix}wf-thinking`, `${rootName} thinking (${th.length} chars)`, () => (
            <Text dimColor wrap="wrap">
              {th === '' ? '(no thinking chunks seen yet)' : th}
            </Text>
          ))}
          {section($, t, open, s, `${w}:context`, `${wPrefix}wf-context`, `Gathered context (${ctx.length} calls)`, () => ctx.map(c => callRow(t, c)))}
        </Box>
      </Box>
    )
  }

  /** One run as a collapsible panel: [+], its dot, its title (dim once completed), its notices; `pick`: the wide view's "show" Button. */
  const panel = (f: Flow, i: number, pick: boolean) => {
    const wKey = `wf:${f.w}`
    const wOpen = isOpen(open, wKey, s)
    const mine = notices.filter(x => x.w === f.w)
    const done = f.info.status === 'completed'
    return (
      <Box flexDirection="column" marginTop={i === 0 ? 0 : 1}>
        <Box flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={1}>
          <Button key={`wf-${f.w}`} label={wOpen ? '[-]' : '[+]'} onPress={() => toggleOpen($, wKey, s)} />
          {statusIndicator(t, hasSvg, on1, f.info.status, s, f.info.both)}
          {anomalyMark(t, f.bad, s)}
          <Text bold={!done} dimColor={done} wrap="wrap">
            {f.info.parent}
          </Text>
          {noticeIcon($, t, f.w, mine)}
          {pick ? <Button key={`wf-show-${f.w}`} label={f.w === sel ? '(shown)' : 'show'} plain onPress={() => changeView($, x => ({ ...x, selected: f.w }))} /> : null}
        </Box>
        {noticeList(t, f.w, mine, open)}
        {wOpen && content(f)}
      </Box>
    )
  }

  if (layoutOf(site.columns, s.wideColumns) === 'narrow') {
    // Narrow: every run minimised to one row; the one chosen opens in its place, "< Runs" goes back.
    const chosen = flows.find(f => open[`nr:${f.w}`] === true)
    const pick = async (w: string) => {
      await update($, cardOpenA, m => {
        const out: Record<string, boolean> = {}
        for (const [k, x] of Object.entries(m as Record<string, boolean>)) if (!k.startsWith('nr:')) out[k] = x
        if (w !== '') out[`nr:${w}`] = true
        return out
      })
      if (w !== '') await changeView($, x => ({ ...x, selected: w }))
    }
    return (
      <Box flexDirection="column" width="100%" {...fill}>
        {head}
        {chosen !== undefined ? (
          <Box flexDirection="column" width="100%">
            <Button key="runs-back" label="< Runs" onPress={() => pick('')} />
            <Box flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={1}>
              {statusIndicator(t, hasSvg, on1, chosen.info.status, s, chosen.info.both)}
              {anomalyMark(t, chosen.bad, s)}
              <Text bold wrap="wrap">
                {chosen.info.parent}
              </Text>
            </Box>
            {content(chosen, true)}
          </Box>
        ) : (
          flows.map(f => (
            <Box flexDirection="row" alignItems="center" columnGap={1}>
              {statusIndicator(t, hasSvg, on1, f.info.status, s, f.info.both)}
              {anomalyMark(t, f.bad, s)}
              <Button key={`run-${f.w}`} label={f.info.parent} plain onPress={() => pick(f.w)} />
            </Box>
          ))
        )}
        {errors}
      </Box>
    )
  }

  // Wide: the selected run's step charts (by code, highest first, each with its Buttons) on the left, every run a
  // collapsible panel on the right.
  const shown = flows.find(f => f.w === sel) ?? flows[0]!
  return (
    <Box flexDirection="column" width="100%" {...fill}>
      {head}
      <Box flexDirection="row" width="100%" columnGap={1} alignItems="flex-start">
        <Box flexDirection="column" flexGrow={1} flexShrink={1} alignItems="center">
          <Box flexDirection="row" columnGap={1}>
            {anomalyMark(t, shown.bad, s)}
            <Text bold wrap="wrap">
              {shown.info.parent}
            </Text>
          </Box>
          {stepList(shown, 'sel:')}
        </Box>
        <Box flexDirection="column" width={s.runListColumns} flexShrink={0}>
          {flows.map((f, i) => panel(f, i, true))}
        </Box>
      </Box>
      {errors}
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // Module variables survive /clear and a resume: the last session's timers stop before new ones start.
    stopTimers()
    workflowOpened = false
    waitingSince = {}
    recordCache = {}
    mergedSeen = {}
    anomalySkipped = []
    anomaliesNow = []
    // Both timers are made before the first `await`: a second `session.start` that overlaps this one (its
    // `stopTimers()` running while this one awaits) cancels both, and never leaves a second poller.
    // Timer-driven blink (kit check 2, and the terminal's text avatars).
    timers.push($.clock.every(500, () => update($, tick, t => !t)))
    // E4: watch agent.list status moves while probes are on. Round 6 (A6): also while any agent is at
    // work, since `waiting` (held) is known only from `$.agent.list()` (AgentStatus).
    timers.push(
      $.clock.every(2000, async () => {
        try {
          const atWork = anyAtWork(await read($, agentsA))
          if (probeOn || atWork) await refreshList($, 'timer')
          // Step 1.6.1: while agents work (a wait growing too long), and while an anomaly stands (so it clears).
          if (atWork || anomaliesNow.length > 0) await detectNow($)
          await captureKeepalive($)
        } catch (err) {
          lensFail('poll', err)
        }
      }),
    )
    cwd = e.cwd
    probePath = `${$.plugin.root}/PROBE-LOG.jsonl`
    try {
      await loadSettings($)
      await loadRoster($)
      await loadCosting($)
    } catch (err) {
      lensFail('session.start settings', err)
    }
    let sessionAgent = ''
    try {
      const v: unknown = await $.settings.read({ key: 'agent' })
      if (typeof v === 'string') sessionAgent = v
    } catch {
      // no agent setting
    }
    // A failing write never keeps the hooks beneath from running (`next(e)` below).
    try {
      await ensureAgent($, 'main', null, sessionAgent)
      await patchAgent($, 'main', a => ({ ...a, type: a.type === '' ? sessionAgent : a.type, status: 'idle' }))
    } catch (err) {
      lensFail('session.start main agent', err)
    }
    try {
      await loadDef($, sessionAgent)
    } catch (err) {
      lensFail('session.start definition', err)
    }
    try {
      const u = await $.session.usage()
      await update($, mainWindowA, () => u.context.window)
    } catch {
      // no usage yet
    }
    return next(e)
  })

  // The session ended (exit, resume elsewhere, logout): its pollers stop. Not at `/clear`: the process
  // goes on and no `session.start` follows (SessionEndInput.reason), so the pollers keep the lens live.
  on('session.end', async ($, e, next) => {
    if (e.reason !== 'clear') stopTimers()
    return next(e)
  })

  on('command.run', { command: CMD.lens }, async $ => {
    await loadSettings($)
    const placed = await $.ui.open({ id: LENS, title: 'AI-DLC lens' })
    return { text: `Lens card opened (isPlaced: ${JSON.stringify(placed)}). Arrows and avatars are the Buttons under the flowchart.` }
  })

  // /ai-dlc:lens-init (addendum 3; step 1.4: the thin ai-dlc skill lens-init names it).
  on('command.run', { command: CMD.init }, async ($, e) => {
    const force = e.args.trim() === '--force'
    const had = (await readText($, LENS_JSON)) !== null
    if (had && !force) {
      await $.fs.write(LENS_SCHEMA, JSON.stringify(schema(), null, 2) + '\n')
      return { text: `${LENS_JSON} exists and was kept; ${LENS_SCHEMA} written. Pass --force to reset ${LENS_JSON} to the defaults.` }
    }
    await $.fs.write(LENS_JSON, initialFile())
    await $.fs.write(LENS_SCHEMA, JSON.stringify(schema(), null, 2) + '\n')
    const conf = await loadSettings($)
    const over = KEYS.filter(k => conf.sources[k] !== LENS_JSON && conf.sources[k] !== 'default')
    return {
      text:
        `${had ? 'Reset' : 'Wrote'} ${LENS_JSON} (every default) and ${LENS_SCHEMA}.` +
        (over.length > 0 ? ` Still overridden by a settings env: ${over.map(k => `${k} [${conf.sources[k]}]`).join(', ')}.` : ''),
    }
  })

  // /ai-dlc:lens-configure: no args lists every setting; `<key>` shows one; `<key> <value>` or `<key> --unset` edits lens.json.
  on('command.run', { command: CMD.configure }, async ($, e) => {
    const args = e.args.trim()
    const k = args.split(/\s+/, 1)[0] ?? ''
    // The rest of the line is the value: a path may hold spaces.
    const raw = args.slice(k.length).trim()
    const show = (c: LensConfig, key: Key) =>
      `${key} = ${JSON.stringify(c.settings[key])} [${c.sources[key]}] (env ${envName(key)}; default ${JSON.stringify(DEFAULTS[key])})`
    const clipped = (v: string) => (v.length > 80 ? `${v.slice(0, 77)}...` : v)
    const showAgent = (family: 'avatarImage', agent: string) => {
      const f = resolveAgent(levelsNow, family, agent)
      return `${family}.${agent} = ${f === null ? 'unset' : `${JSON.stringify(clipped(f.value))} [${f.source}]`} (env ${agentEnvName(family, agent)}; default unset)`
    }
    if (k === '') {
      const c = await loadSettings($)
      // Per-agent keys set in lens.json, and the env entries that set one (by env name).
      const perAgent = [
        ...Object.keys(levelsNow[2]?.values ?? {}).filter(x => agentKeyParts(x) !== null).map(x => showAgent('avatarImage', agentKeyParts(x)!.agent)),
        ...levelsNow
          .slice(0, 2)
          .flatMap(lv => Object.keys(lv.values).filter(n => n.startsWith(agentEnvPrefix('avatarImage'))).map(n => `${n} = ${JSON.stringify(clipped(String(lv.values[n])))} [${lv.where}]`)),
      ]
      return { text: [...KEYS.map(key => show(c, key)), ...perAgent, ...c.ignored, ...avatarNotes()].join('\n') }
    }
    const perAgent = agentKeyParts(k)
    if (!(KEYS as string[]).includes(k) && perAgent === null)
      return { text: k.startsWith('avatarImage.') ? `Not changed: ${k}: the agent part is empty or not an agent ID or type.` : `Unknown key ${k}. Keys: ${KEYS.join(', ')}, avatarImage.<agent>` }
    if (perAgent !== null) {
      if (raw === '') {
        await loadSettings($)
        return { text: showAgent(perAgent.family, perAgent.agent) }
      }
      if (raw !== '--unset') {
        // AC-6.5: an untrusted path, or a value that is no allowed image, is never written.
        await loadSettings($)
        const checked = await readImage($, raw, typesOf(cfg.avatarImageTypes), cfg.avatarImageMaxBytes)
        if ('why' in checked) return { text: `Not changed: ${k} is refused: ${checked.why}.` }
      }
      const w = setKey(await readText($, LENS_JSON), k, raw)
      if (w.error !== '') return { text: `Not changed: ${w.error}` }
      await $.fs.write(LENS_JSON, w.text)
      await loadSettings($)
      const f = resolveAgent(levelsNow, perAgent.family, perAgent.agent)
      const note = f !== null && f.source !== LENS_JSON && raw !== '--unset' ? ` A higher level wins: ${f.source}.` : ''
      return { text: `${LENS_JSON} updated. Effective: ${showAgent(perAgent.family, perAgent.agent)}.${note}` }
    }
    if (raw === '') return { text: show(await loadSettings($), k as Key) }
    const r = setKey(await readText($, LENS_JSON), k, raw)
    if (r.error !== '') return { text: `Not changed: ${r.error}` }
    await $.fs.write(LENS_JSON, r.text)
    const c = await loadSettings($)
    const src = c.sources[k as Key]
    const note = src !== LENS_JSON && raw !== '--unset' ? ` A higher level wins: ${src}.` : ''
    return { text: `${LENS_JSON} updated. Effective: ${show(c, k as Key)}.${note}` }
  })

  on('command.run', { command: CMD.kit }, async $ => {
    const placed = await $.ui.open({ id: KIT, title: 'AI-DLC lens kit' })
    return { text: `Kit pane opened (isPlaced: ${JSON.stringify(placed)}).` }
  })

  // /ai-dlc:lens-gate (step 1.6.1): on|off sets `gateAlert` in .ai-dlc/lens.json; bare, it lists the anomalies now.
  on('command.run', { command: CMD.gate }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg !== '' && arg !== 'on' && arg !== 'off') return { text: `Usage: /${CMD.gate} [on|off]. on|off turns anomaly detection on or off (gateAlert); bare, it lists the anomalies now.` }
    let note = ''
    if (arg !== '') {
      const w = setKey(await readText($, LENS_JSON), 'gateAlert', String(arg === 'on'))
      if (w.error !== '') return { text: `Not changed: ${w.error}` }
      await $.fs.write(LENS_JSON, w.text)
    }
    const c = await loadSettings($)
    const src = c.sources.gateAlert
    if (arg !== '' && src !== LENS_JSON) note = ` A higher level wins: ${src}.`
    // The reply names them, so this pass toasts nothing.
    const list = await detectNow($, false)
    const state = `gateAlert = ${c.settings.gateAlert === true} [${src}]: detection is ${c.settings.gateAlert === true ? 'on' : 'off'}.${note}`
    const lines = list.map(x => `- ${anomalyLine(x)}`)
    const skipped = anomalySkipped.map(x => `skipped: ${x}`)
    // Step 1.6.1.l1: which runs were read; /ai-dlc:lens-configure anomalyRunScope session|all changes it.
    const scope =
      c.settings.gateAlert === true
        ? `Runs read: ${c.settings.anomalyRunScope === 'all' ? "this session's and every active or blocked run under the handoff folder" : "this session's"} (anomalyRunScope = ${c.settings.anomalyRunScope} [${c.sources.anomalyRunScope}]).`
        : ''
    return {
      text: [
        arg === '' ? state : `${LENS_JSON} updated. ${state}`,
        c.settings.gateAlert === true ? (list.length === 0 ? 'No anomalies.' : `Anomalies (${list.length}):`) : '',
        ...lines,
        ...skipped,
        scope,
      ]
        .filter(x => x !== '')
        .join('\n'),
    }
  })

  // /ai-dlc:lens-keepalive [on|off]: turns the Cache keep-alive section of the agent panes on or off in
  // .ai-dlc/lens.json (keepaliveSection, on by default); bare, it flips the value in force. Then the figures.
  on('command.run', { command: CMD.keepalive }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg !== '' && arg !== 'on' && arg !== 'off') return { text: `Usage: /${CMD.keepalive} [on|off]. Bare, it turns the Cache keep-alive section of the agent panes off when it is on, and on when it is off.` }
    const before = await loadSettings($)
    const want = arg === '' ? !(before.settings.keepaliveSection as boolean) : arg === 'on'
    const r = setKey(await readText($, LENS_JSON), 'keepaliveSection', String(want))
    if (r.error !== '') return { text: `Not changed: ${r.error}` }
    await $.fs.write(LENS_JSON, r.text)
    const c = await loadSettings($)
    const now = c.settings.keepaliveSection === true
    const src = c.sources.keepaliveSection
    const note = src !== LENS_JSON ? ` A higher level wins: ${src}.` : ''
    const f = await keepaliveFigures($)
    return {
      text:
        `${LENS_JSON} updated: keepaliveSection = ${want}. The Cache keep-alive section is ${now ? 'shown' : 'hidden'} in the agent panes.${note}\n` +
        `Kept warm: ${f.warm.map(w => `${w.track} ${fmtSpan(w.ms)} (${w.pings} pings, ${w.armings} armings${w.running ? ', running' : ''})`).join(' · ')}. ` +
        `Saved by cache reads this session: ${f.session.text}${f.session.usd === null ? ` (${f.session.source})` : ''}.`,
    }
  })

  // ---- data: spawns, steps, tool calls, turn ends ----
  on('agent.spawn', async ($, e, next) => {
    const r: any = await next(e)
    try {
      const id: string | undefined = r?.agentId ?? e.resume?.agentId
      const parent = e.parentAgentId ?? 'main'
      const match = matchHandoff(e.prompt)
      if (probeOn)
        await plog($, 'E1', {
          site: 'agent.spawn',
          tool_use_id: e.tool_use_id,
          keys: Object.keys(e),
          subagentType: e.subagentType,
          model: e.model ?? null,
          parentModel: e.parentModel,
          firstLine: (e.prompt.split(/\r?\n/, 1)[0] ?? '').slice(0, 300),
          match,
          result: { model: r?.model, agentId: r?.agentId, teammateId: r?.teammateId, deny: r?.deny },
        })
      if (id === undefined) return r
      // A spawn no tool.call reported (a plugin's own $.agent.spawn) still joins a workflow (round 4 bug).
      {
        const agentsBefore = await read($, agentsA)
        const callAgentBefore = await read($, callAgentA)
        const request = parent === 'main' ? (await read($, mainPromptA)) : firstLine(agentsBefore[parent]?.prompt ?? '')
        // Addendum A5: a resumed agent (its brief names no record now) keeps the run its first brief named.
        const named = taskKeyOf(e.prompt, request)
        const priorDir = runOfKey(named) === null && agentsBefore[id] !== undefined ? runDirOf(agentsBefore[id]!) : null
        const taskKey = priorDir !== null ? `run:${priorDir}` : named
        await update($, callKeyA, m => ((m as Record<string, string>)[e.tool_use_id] !== undefined && runOfKey((m as Record<string, string>)[e.tool_use_id]!) !== null ? m : { ...(m as Record<string, string>), [e.tool_use_id]: taskKey }))
        const keysBefore = await read($, callKeyA)
        await update($, callTaskA, m => ((m as Record<string, string>)[e.tool_use_id] !== undefined ? m : { ...(m as Record<string, string>), [e.tool_use_id]: request }))
        const tasksBefore = await read($, callTaskA)
        const rootsBefore = await readRoots($)
        await update($, workflowsA, x => joinWorkflow(x as LensWorkflows, parent, e.tool_use_id, agentsBefore, callAgentBefore, keysBefore, tasksBefore, rootsBefore))
      }
      // One write: create-or-patch, the respawn test against the state as it stands (round 3 root cause).
      let existedBefore = false
      await update($, agentsA, m => {
        const all = m as Record<string, LensAgent>
        existedBefore = all[id] !== undefined
        const cur = all[id] ?? blankAgent(id, parent, e.subagentType)
        const again = isRespawn(all, id, parent, e.subagentType, e.tool_use_id)
        return {
          ...all,
          [id]: {
            ...cur,
            parent,
            type: e.subagentType,
            name: e.name ?? cur.name,
            description: e.description,
            model: String(r?.model ?? cur.model),
            callModel: e.model ?? '',
            parentModel: e.parentModel ?? '',
            prompt: e.prompt,
            status: ENDED.has(cur.status) && cur.toolUseId === e.tool_use_id ? cur.status : 'running',
            toolUseId: e.tool_use_id,
            handoff: match?.path ?? cur.handoff,
            handoffHow: match?.how ?? cur.handoffHow,
            loop: cur.loop || again,
            endedAt: null,
            teammate: cur.teammate === true || typeof r?.teammateId === 'string',
          },
        }
      })
      await update($, orderA, o => (o.includes(id) ? o : [...o, id]))
      await update($, callAgentA, m => ({ ...(m as Record<string, string>), [e.tool_use_id]: id }))
      await loadDef($, e.subagentType)
      await refreshRuns($)
      await detectNow($)
      if (!workflowOpened) {
        // Round 4 "pinned": VS Code has no band that stays at the top (AbovePrompt is terminal and
        // desktop only); the workflow pane, outside the transcript, is the closest. Unasked, a surface may leave it undrawn.
        workflowOpened = true
        // Round 6: Esc closes it once it holds the keys (no `focus`: an unasked open never takes the keyboard).
        // Where it goes is the surface's: PaneOpenArgs has no placement or order (d.ts:7588-7660), A9.
        // Step 1.5: pinned, on surfaces that all draw the band above the prompt, the band shows it and no pane opens.
        await showView($, await read($, viewA))
        await plog($, 'E3', { open: CHART, auto: true })
      }
      if (probeOn) {
        const now = (await read($, agentsA))[id]
        await plog($, 'E9', { site: 'agent.spawn after patch', tool_use_id: e.tool_use_id, agentId: id, existedBefore, stored: { type: now?.type, toolUseId: now?.toolUseId, loop: now?.loop } })
        await refreshList($, 'spawn')
      }
    } catch (err) {
      lensFail('agent.spawn', err)
    }
    return r
  })

  on('turn.start', async ($, e, next) => {
    try {
      const key = e.agentId ?? 'main'
      // Step 1.4: the arming that ends with this turn keeps its time before the next Stop re-arms.
      if (key === 'main') await captureKeepalive($)
      if (probeOn) await plog($, 'E9', { site: 'turn.start', agent: key, known: (await read($, agentsA))[key]?.toolUseId ?? null })
      await ensureAgent($, key, key === 'main' ? null : 'main', '')
      await patchAgent($, key, a => ({ ...a, status: 'running' }))
      const text = typeof (e as any).text === 'string' ? ((e as any).text as string) : ''
      // Round 5: only the human's request names the task. Round 6 (A7): a notice (an engine tag, or a
      // prompt `prompt.submit` saw arrive from something other than the person) is kept as a notice.
      if (key === 'main' && text.trim() !== '') {
        if (noticeTexts.has(text.trim()) || isNotice(text)) await addNotice($, text)
        else if (isHumanRequest(text)) await update($, mainPromptA, () => firstLine(text))
      }
    } catch (err) {
      lensFail('turn.start', err)
    }
    return next(e)
  })

  // Round 6 (A7): who sent a prompt (`PromptSubmitInput.origin`, d.ts:9562-9569; `PromptOrigin`, d.ts:9287 on).
  // The person's own names the task; any other (a task notification, a trigger, a peer, a relay) is a notice.
  // Observer only: the prompt passes on unchanged.
  on('prompt.submit', async ($, e, next) => {
    try {
      const kind = String((e.origin as { kind?: string } | undefined)?.kind ?? 'composer')
      if (e.command === undefined && (e.isMeta === true || !isPersonOrigin(kind))) await addNotice($, e.text)
    } catch (err) {
      lensFail('prompt.submit', err)
    }
    return next(e)
  })

  // Pass-through observer (step 16 Q1, E2): every chunk is yielded on unchanged.
  on('turn.step', async function* ($, e, next) {
    const key = e.agentId ?? 'main'
    const ids: string[] = []
    const counts: Record<string, number> = {}
    let spent = 0
    let thinkingChars = 0
    const thinkingIdx = new Set<number>()
    let usage: Tokens | null = null
    let model = e.model
    // The first Agent call of this message: its chat row draws the flowchart for all of them (round 2).
    let lead: string | null = null
    const agentCalls: string[] = []
    for await (const c of next(e)) {
      const t0 = nowMs()
      counts[c.kind] = (counts[c.kind] ?? 0) + 1
      if (c.kind === 'thinking') {
        thinkingChars += c.text.length
        thinkingIdx.add(c.index)
        thinkBuf[key] = (thinkBuf[key] ?? '') + c.text
      } else if (c.kind === 'tool') {
        ids.push(c.id)
        if (AGENT_TOOLS.has(c.name)) {
          lead ??= c.id
          agentCalls.push(c.id)
          const l = lead
          try {
            await update($, batchesA, m => addToBatch(m as Record<string, LensBatch>, l, key, c.id))
          } catch (err) {
            lensFail('turn.step batch', err)
          }
        }
      } else if (c.kind === 'stop' && c.usage) {
        usage = fromUsage(c.usage)
        model = c.usage.model
      }
      spent += nowMs() - t0
      yield c
    }
    try {
      thinkBlocks[key] = (thinkBlocks[key] ?? 0) + thinkingIdx.size
      const t1 = nowMs()
      const buf = thinkBuf[key] ?? ''
      if (buf !== '') {
        thinkBuf[key] = ''
        await update($, thinkingA, m => {
          const prev = (m as Record<string, string>)[key] ?? ''
          const joined = prev === '' || prev.startsWith('[') ? buf : prev + '\n---\n' + buf
          return { ...m, [key]: joined.length > cfg.thinkingChars ? '...' + joined.slice(-cfg.thinkingChars) : joined }
        })
      }
      for (const id of ids) stepOfCall[id] = { out: usage?.out ?? 0, n: ids.length }
      await ensureAgent($, key, key === 'main' ? null : 'main', '')
      await patchAgent($, key, a => ({
        ...a,
        model: model !== '' ? model : a.model,
        steps: usage ? addTokens(a.steps, usage) : a.steps,
        // Round 6 (18.4-3): capped; past the cap a long-context cost shows — (costOfAgent), never an undercount.
        reqs: usage ? [...(a.reqs ?? []), usage].slice(-REQS_CAP) : (a.reqs ?? []),
        last: usage ?? a.last,
      }))
      if (probeOn) await plog($, 'E2', { agent: key, index: e.index, counts, agentCalls, thinkingChars, observeMs: spent, afterMs: nowMs() - t1, usage })
    } catch (err) {
      lensFail('turn.step', err)
    }
  })

  on('tool.call', async ($, e, next) => {
    const ctx = await beforeCall($, e)
    const r: any = await next(e)
    if (ctx !== null) await afterCall($, ctx, r)
    return r
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    try {
      const key = e.agentId ?? 'main'
      await ensureAgent($, key, key === 'main' ? null : 'main', '')
      const usage = e.usage ? fromUsage(e.usage) : null
      const agents = await read($, agentsA)
      const teammate = (agents[key]?.type ?? '') === 'teammate' || agents[key]?.teammate === true
      // Round 5: a teammate that answered waits for its next message (idle); one that errored or was stopped has halted.
      const status = key === 'main' ? 'idle' : e.reason === 'answer' ? (teammate ? 'idle' : 'completed') : e.reason === 'aborted' ? 'killed' : 'failed'
      await patchAgent($, key, a => ({
        ...a,
        status,
        model: e.usage?.model ?? a.model,
        turns: usage ? addTokens(a.turns, usage) : a.turns,
        endedAt: nowMs(),
      }))
      if (key === 'main') {
        try {
          const u = await $.session.usage()
          await update($, mainWindowA, () => u.context.window)
        } catch {
          // keep the last window
        }
        // A changed lens.json, settings env or costing file shows from the next turn on.
        await loadSettings($)
        await loadCosting($)
      }
      await refreshRuns($)
      await detectNow($)
      const stored = await backfillThinking($, key, thinkBlocks[key] ?? 0)
      if (probeOn && stored !== null) await plog($, 'E2', { site: 'turn.complete stored thinking', agent: key, streamedBlocks: thinkBlocks[key] ?? 0, stored: { blocks: stored.blocks, chars: stored.chars, redacted: stored.redacted, error: stored.error ?? null } })
      if (probeOn) {
        const after = (await read($, agentsA))[key]
        await plog($, 'E5', { agent: key, reason: e.reason, turnUsage: usage, turnsSum: after?.turns, stepsSum: after?.steps, rows: key === 'main' ? null : await scanUsage($, key) })
        await refreshList($, 'turn.complete')
      }
    } catch (err) {
      lensFail('turn.complete', err)
    }
    return r
  })

  // ---- the lens pane (L1-L6) ----
  on('ui.render', { component: 'Pane', requestId: LENS }, async ($, e) => {
    return guardPane($, e, 'lens pane', async () => {
      const t = $.ui.resolve(e) as any
      const { Box, Text, Button } = t
      const { agents, conf, s, label, av, marks } = await snapshot($)
      const order = await read($, orderA)
      const thinking = await read($, thinkingA)
      const context = await read($, contextA)
      const open = await read($, cardOpenA)
      const hasSvg = e.surface !== 'terminal'

      // Step 1.5: the session's open mode, shared with the workflow view's `Panel Type` switch.
      const mode = openModeOf(await read($, openModeA), String(s.panelOpenMode))
      const modeRow = (
        <Box flexDirection="row">
          {panelTypeSwitch($, t, mode, { drill: 'mode-drill', tab: 'mode-pane' })}
        </Box>
      )

      const drilled = (await read($, drillsA))['lens']
      if (drilled !== undefined) return drillBody($, t, 'lens', drilled, hasSvg)

      const ids = order.filter(id => agents[id])
      const on1 = hasSvg ? false : (await read($, tick))
      const mainThinking = thinking['main'] ?? ''
      const thOpen = isOpen(open, 'pane:thinking', s)
      const ctxOpen = isOpen(open, 'pane:context', s)
      const setOpen = isOpen(open, 'pane:settings', s)
      return (
        <Box flexDirection="column">
          <Text bold>Workflow</Text>
          {await keepaliveRow($, t)}
          {chartNode(t, hasSvg, on1, ids, agents, label, s, `Flowchart of ${ids.length} agents`, av)}
          {agentButtons($, t, order, agents, label, 'lens', null, marks)}
          {modeRow}
          <Text bold>{agents['main'] ? label(agents['main']).name : 'Main loop'} (main loop)</Text>
          <Box flexDirection="row">
            <Button key="lens-thinking" label={thOpen ? '[-]' : '[+]'} onPress={() => toggleOpen($, 'pane:thinking', s)} />
            <Text> Thinking ({mainThinking.length} chars)</Text>
          </Box>
          {thOpen && <Text dimColor>{mainThinking === '' ? '(no thinking chunks seen yet)' : mainThinking}</Text>}
          <Box flexDirection="row">
            <Button key="lens-context" label={ctxOpen ? '[-]' : '[+]'} onPress={() => toggleOpen($, 'pane:context', s)} />
            <Text> Gathered context ({context.length} calls)</Text>
          </Box>
          {ctxOpen &&
            context.map(c => (
              <Text dimColor>
                {c.status === 'running' ? '...' : c.status === 'error' ? 'ERR' : 'ok '} {c.tool} {c.summary}
              </Text>
            ))}
          <Box flexDirection="row">
            <Button key="lens-settings" label={setOpen ? '[-]' : '[+]'} onPress={() => toggleOpen($, 'pane:settings', s)} />
            <Text> Lens settings ({KEYS.filter(k => conf.sources[k] !== 'default').length} set, {conf.ignored.length} ignored)</Text>
          </Box>
          {setOpen && settingsRows(t, conf)}
          <Text dimColor>The figures, the cost and the window are in each avatar's panel.</Text>
          {lensErrors.map(x => (
            <Text color="red">lens hook error: {x}</Text>
          ))}
        </Box>
      )
    })
  })

  on('ui.render', { component: 'Pane', requestId: EDGE }, async ($, e) => {
    return guardPane($, e, 'hand-off pane', async () => {
      const t = $.ui.resolve(e) as any
      const { agents, s, label, av } = await snapshot($)
      if ((await read($, tabsMinA))[EDGE] === true) {
        const u = await read($, uiA)
        const a = liveOr(agents, u.edge, u.edgeSnap)
        return minimisedTab($, t, EDGE, a ? `Hand-off: ${a.parent !== null && agents[a.parent] ? label(agents[a.parent]!).name : '?'} -> ${label(a).name} - ${a.status}` : 'Hand-off')
      }
      return edgeBody($, t, await read($, uiA), await read($, docA), agents, label, await read($, cardOpenA), s, av, e.surface !== 'terminal', true)
    })
  })

  on('ui.render', { component: 'Pane', requestId: AGENT }, async ($, e) => {
    return guardPane($, e, 'agent pane', async () => {
      const t = $.ui.resolve(e) as any
      const { agents, defs, s, label, av } = await snapshot($)
      const ui = await read($, uiA)
      if ((await read($, tabsMinA))[AGENT] === true) {
        const a = liveOr(agents, ui.agent, ui.agentSnap)
        return minimisedTab($, t, AGENT, a ? `Agent: ${label(a).name} - ${a.status}` : 'Agent')
      }
      // Step 1.4: read only while the section is on, so a pane without it never redraws on keep-alive writes.
      const ka = s.keepaliveSection ? await keepaliveFigures($, ui.agent) : null
      return agentBody(
        $,
        t,
        ui,
        agents,
        await read($, callsA),
        await read($, thinkingA),
        await read($, mainWindowA),
        label,
        defs,
        await read($, costingA),
        await read($, cardOpenA),
        s,
        av,
        e.surface !== 'terminal',
        true,
        ka,
      )
    })
  })

  // Round 4: the workflow pane, outside the transcript, opens on the first spawn and updates live (VS Code
  // has no band at the top of the chat; AbovePrompt is terminal and desktop only). Step 1.5: its body is
  // `workflowBody`, shared with the band below. No outer margin or padding (A9): the frame fits the tree
  // (d.ts:10904-10909); only full screen fills the rows.
  on('ui.render', { component: 'Pane', requestId: CHART }, async ($, e) => {
    return guardPane($, e, 'workflow pane', async () => {
      const t = $.ui.resolve(e) as any
      if (e.viewport !== undefined) lastViewport = { columns: e.viewport.columns, rows: e.viewport.rows }
      return workflowBody($, t, { surface: String(e.surface), columns: e.props.bodyColumns, rows: e.props.scroll.bodyRows, where: 'pane' })
    })
  })

  // Step 1.5, "pinned": the same view in the band directly above the prompt (AbovePrompt, d.ts:10809-10850;
  // raised on the terminal and desktop only). Drawn while the view is pinned and a workflow exists; a
  // survey holding the band (`hasSurvey`) and every other case pass to the hooks beneath, whose tree stays under ours.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    try {
      if (e.props.hasSurvey) return next(e)
      const conf = await read($, lensA)
      const v = await read($, viewA)
      const wf = await read($, workflowsA)
      // Addendum A7: in full screen the view is the pane's alone; the band steps aside.
      if (placeOf(v, String(conf.settings.workflowPlace)) !== 'pinned' || v.size === 'fullscreen' || wf.order.length === 0) return next(e)
      const t = $.ui.resolve(e) as any
      const { Box } = t
      const ours = await workflowBody($, t, { surface: String(e.surface), columns: e.props.bodyColumns, rows: e.props.maxRows, where: 'band' })
      const below = await next(e)
      return (
        <Box flexDirection="column" width="100%">
          {ours}
          {below}
        </Box>
      )
    } catch (err) {
      lensFail('band', err)
      return next(e)
    }
  })
  // ---- round-0 kit pane: sections 1, 2, 3 (checks K1-K3) ----
  on('ui.render', { component: 'Pane', requestId: KIT }, async ($, e) => {
    return guardPane($, e, 'kit pane', async () => {
      const { Box, Text, Button, Svg } = $.ui.resolve(e) as any
      const body = e.props.bodyColumns
      const placement = e.props.placement
      const fs = e.viewport?.isFullscreen === undefined ? 'absent' : String(e.viewport.isFullscreen)
      const forced = await read($, forceMode)
      const auto = placement === 'dock' ? 'flowchart' : 'compact'
      const mode = forced === 'auto' ? auto : forced

      redrawCount += 1
      redraws.push({ n: redrawCount, body, cols: e.viewport?.columns, placement, fs, mode })
      if (redraws.length > 8) redraws.shift()

      const on1 = await read($, tick)
      const expanded = await read($, paneExpanded)
      const presses = await read($, panePresses)
      const hasSvg = e.surface !== 'terminal'

      return (
        <Box flexDirection="column">
          <Text bold>[1] Resize across the dock boundary</Text>
          <Text>
            surface={e.surface} placement={placement} bodyColumns={body} viewport.columns={String(e.viewport?.columns)} isFullscreen={fs}
          </Text>
          <Text>
            mode={mode} (auto would be {auto}; override={forced})
          </Text>
          {mode === 'flowchart' ? (
            <Text>FLOWCHART  [PO] -&gt; [RA] -&gt; [SA]+[SE] -&gt; [SWE] -&gt; [SQA] -&gt; [CR]</Text>
          ) : (
            <Text>COMPACT  PO RA SA SE SWE SQA CR  (stage 3/7)</Text>
          )}
          <Box flexDirection="row">
            <Button key="mode-auto" label="auto" onPress={() => update($, forceMode, () => 'auto')} />
            <Button key="mode-compact" label="compact" onPress={() => update($, forceMode, () => 'compact')} />
            <Button key="mode-flow" label="flowchart" onPress={() => update($, forceMode, () => 'flowchart')} />
          </Box>
          <Text dimColor>redraw log (last 8):</Text>
          {redraws.map(r => (
            <Text dimColor>
              #{r.n} body={r.body} cols={String(r.cols)} {r.placement} fs={r.fs} -&gt; {r.mode}
            </Text>
          ))}

          <Text bold>[2] Svg animation</Text>
          {hasSvg ? (
            <Box flexDirection="row">
              <Text>A SMIL:</Text>
              <Svg source={svgDot('#2e7d32', true)} alt="SMIL blinking green dot" width={24} height={24} isInteractive={true} />
              <Text> B timer:</Text>
              <Svg source={svgDot(on1 ? '#2e7d32' : '#cfd8dc', false)} alt="timer blinking green dot" width={24} height={24} />
              <Text> C steady:</Text>
              <Svg source={svgDot('#2e7d32', false)} alt="steady green dot" width={24} height={24} />
            </Box>
          ) : (
            <Text dimColor>(terminal: no Svg element; text fallback below)</Text>
          )}
          <Text>
            D text timer: <Text color={on1 ? 'green' : 'gray'}>{on1 ? '●' : '○'}</Text>  tick={String(on1)}
          </Text>

          <Text bold>[3] Buttons (pane)</Text>
          <Box flexDirection="row">
            <Button
              key="pane-expand"
              label={expanded ? '[-]' : '[+]'}
              onPress={async () => {
                await update($, paneExpanded, x => !x)
                await update($, panePresses, n => n + 1)
              }}
            />
            <Text> presses={presses}</Text>
          </Box>
          {expanded && <Text>expanded content: the pane button works</Text>}

          <Text bold>[4] Transcript cards</Text>
          <Text>ToolUse cards drawn={toolUseCards}  ToolResult hooks passed through={toolResultHooks}</Text>
          <Text bold>[5] Gate alert</Text>
          <Text>classic.Stop seen by module={stopEvents}  (the gate alert is now anomaly detection: /ai-dlc:lens-gate)</Text>
        </Box>
      )
    })
  })

  // ---- the chat card (round 4): one line and an "Open flowchart" Button; the flowchart is in the workflow pane ----
  // The native row is always last (US-15, AC-15.5): the card wraps it, never replaces it. Finding 5:
  // the native Agent row is drawn without the prompt (the arrow panel shows it); expanded, it is whole.
  // Round 4: the card never draws the call's `description`; whether the native row draws it is the surface's.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const tool = String(e.props.tool)
    if (!CARD_TOOLS.has(tool)) return next(e)
    const input = (e.props.input ?? {}) as Record<string, unknown>
    const stripPrompt = AGENT_TOOLS.has(tool) && e.props.isExpanded !== true && typeof input.prompt === 'string'
    let native: any
    if (stripPrompt) {
      const { prompt: _p, ...rest } = input
      native = await next({ ...e, props: { ...e.props, input: rest } } as typeof e)
    } else native = await next(e)
    toolUseCards += 1
    // A lens fault never replaces the native row: on error the row is drawn as the host drew it.
    const card = async () => {
      const t = $.ui.resolve(e) as any
      const { Box, Text, Button } = t
      const id = e.props.tool_use_id
      if (tool === 'SendMessage') {
        return (
          <Box flexDirection="column">
            <Text dimColor>lens: message to {String(input.to ?? '?')}; its arrow in the flowchart is two-way</Text>
            {native}
          </Box>
        )
      }
      const wf = await readWorkflows($)
      const batches = await read($, batchesA)
      const { agents, label, s, av, marks } = await snapshot($)
      const w = wf.of[id]
      if (w !== undefined && w !== id) {
        const wb = workflowBatch(wf, w, batches, agents)
        const k = wb.ids.indexOf(id)
        return (
          <Box flexDirection="column">
            <Text dimColor wrap="wrap">
              lens: {k >= 0 ? `agent ${k + 1} of ${wb.ids.length} in` : 'spawned inside'} the workflow of an earlier call; its flowchart is in that call's card and the workflow view
            </Text>
            {native}
          </Box>
        )
      }
      const batch: LensBatch =
        w !== undefined
          ? workflowBatch(wf, w, batches, agents)
          : {
              parent: Object.values(agents).find(a => a.toolUseId === id)?.parent ?? 'main',
              ids: [id],
              pending: {
                [id]: {
                  type: String(input.subagent_type ?? ''),
                  description: String(input.description ?? ''),
                  name: String(input.name ?? ''),
                  prompt: String(input.prompt ?? ''),
                  model: typeof input.model === 'string' ? input.model : '',
                },
              },
            }
      const order = await read($, orderA)
      const callAgent = await read($, callAgentA)
      const callTask = await read($, callTaskA)
      const runs = await read($, runsA)
      const view = batchView(batch, agents, order, callAgent)
      const root = view.agents[batch.parent]!
      const n = batch.ids.length
      const roots = await readRoots($)
      const info = workflowInfo(view, batch, callTask, runs, `${label(root).name} spawned ${n} agent${n > 1 ? 's' : ''}`, roots)
      const chip = view.members
        .map(m => {
          const a = view.agents[m]!
          return `${initials(label(a).name)} ${a.status === 'pending' ? 'waiting' : a.status}`
        })
        .join(', ')
      // Step 1.5: the card of a workflow's first call draws its flowchart too (round 2; `chartInChat`), one
      // chart per workflow. `chartMode` decides chart or chip by the row's width (round 3, `showChart`, the
      // site's `viewport.columns`). A Button pressed here opens its details as a tab or, drill-in, in this card.
      const hasSvg = e.surface !== 'terminal'
      const target = `card:${id}`
      const drilled = (await read($, drillsA))[target]
      let chart: any = null
      if (drilled === undefined && s.chartInChat) {
        const on1 = hasSvg ? false : (await read($, tick))
        // Step 8.6.1.l1: one chart per task (run and feature root) of the agents on this card (`cardCharts`):
        // agents spawned together for unrelated tasks get a chart each, titled by its step; one task, one chart.
        const { sources, redirect } = stepSources(workflowRunOf(info.members, runs, roots).id, runs, roots)
        const groups = cardCharts(view, a => spawnPlace(a, sources, redirect))
        let width = 0
        try {
          for (const g of groups) width = Math.max(width, flowchartSvg(g.ids, g.agents, label, chartSize(s), av).width)
        } catch (err) {
          lensFail('card chart', err)
        }
        if (showChart(s.chartMode, width, e.viewport?.columns, s.breakpointColumns, s.cellPx))
          chart = (
            <Box flexDirection="column" alignItems="center" justifyContent="center" width="100%">
              {groups.map((g, i) => {
                // One task: the card's single chart, untitled; several: one titled chart per task.
                const one = groups.length === 1
                const prefix = one ? 'card:' : `card:g${i}:`
                return (
                  <Box key={`card-task-${i}`} flexDirection="column" alignItems="center" justifyContent="center" width="100%" marginTop={i === 0 ? 0 : 1}>
                    {one ? null : (
                      <Text bold wrap="wrap">
                        {g.title}
                      </Text>
                    )}
                    {chartNode(t, hasSvg, on1, g.ids, g.agents, label, s, one ? `Chat chart: ${info.parent}` : `Chat chart ${i + 1} of ${groups.length}: ${g.title}`, av, prefix)}
                    {agentButtons($, t, g.ids, g.agents, label, target, null, marks, prefix)}
                  </Box>
                )
              })}
            </Box>
          )
      }
      // Round 5: the card's line and its Button centred both ways in the card's box; the native row stays last.
      return (
        <Box flexDirection="column" borderStyle="round">
          <Box flexDirection="row" flexWrap="wrap" alignItems="center" justifyContent="center" columnGap={1}>
            <Text wrap="wrap">
              Workflow: {info.current} - {chip}{' '}
            </Text>
            <Button key="card-open-chart" label="Open flowchart" onPress={() => openChart($, w ?? id)} />
          </Box>
          {drilled !== undefined ? await drillBody($, t, target, drilled, hasSvg) : chart}
          {lensErrors.map(x => (
            <Text color="red">lens hook error: {x}</Text>
          ))}
          {native}
        </Box>
      )
    }
    return drawOr(card, () => native, err => lensFail('card', err))
  })
  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (CARD_TOOLS.has(String(e.props.tool))) toolResultHooks += 1
    return next(e)
  })

  // ---- background tasks at stop time (step 16 Q6, E7) ----
  on('classic.SubagentStop', async ($, e, next) => {
    const result = await next(e)
    const tasks: LensTask[] = (e.background_tasks ?? []).map(b => stopTask(b, 'SubagentStop'))
    // Its last message is the result its background task shows (round 4).
    await patchAgent($, e.agent_id, a => ({ ...a, bg: stampTasks(a.bg, mergeStopTasks(a.bg, tasks), nowMs()), output: e.last_assistant_message ?? a.output }))
    if (probeOn) await plog($, 'E7', { site: 'classic.SubagentStop', agent: e.agent_id, background_tasks: e.background_tasks ?? null })
    return result
  }).catch(($, e, next) => next(e))

  // ---- kit section 5b, and main's stop-time background tasks ----
  on('classic.Stop', async ($, e, next) => {
    // Step 1.4: keep-alive arms at Stop; the arming before it and the new one are both kept.
    await captureKeepalive($)
    const result = await next(e)
    await captureKeepalive($)
    stopEvents += 1
    const tasks: LensTask[] = (e.background_tasks ?? []).map(b => stopTask(b, 'Stop'))
    await patchAgent($, 'main', a => ({ ...a, bg: stampTasks(a.bg, mergeStopTasks(a.bg, tasks), nowMs()) }))
    if (probeOn) await plog($, 'E7', { site: 'classic.Stop', background_tasks: e.background_tasks ?? null })
    if (probeOn) {
      // E9: what the card would draw for each batch, against the agents as stored.
      const all = await read($, agentsA)
      const bs = await read($, batchesA)
      const order = await read($, orderA)
      const callAgent = await read($, callAgentA)
      const wfNow = await read($, workflowsA)
      await plog($, 'E9', {
        site: 'state at Stop',
        agents: Object.values(all).map(a => ({ id: a.id, type: a.type, toolUseId: a.toolUseId, status: a.status, parent: a.parent, loop: a.loop })),
        batches: bs,
        callAgent,
        views: Object.values(bs).map(b => batchView(b, all, order, callAgent).members),
        workflows: wfNow.order.map(w => ({ w, members: batchView(workflowBatch(wfNow, w, bs, all), all, order, callAgent).members })),
      })
      // E10 (step 1.6.1.l3): the workflows as drawn (`readWorkflows`), each call's task key and run
      // identity, and the stage groups of each run with the main node's status in its chart: what puts
      // one run in several charts, or keeps the orchestrator blinking, shows here.
      const keys = await read($, callKeyA)
      const runs = await read($, runsA)
      const drawn = await readWorkflows($)
      const roots = await readRoots($)
      const ids = callRunIds(drawn, keys, all, callAgent, roots)
      await plog($, 'E10', {
        site: 'workflows at Stop',
        mainStatus: all['main']?.status ?? null,
        calls: Object.keys(drawn.of).map(c => ({ call: c, workflow: drawn.of[c], by: drawn.by[c] ?? null, key: keys[c] ?? null, run: ids[c] ?? '' })),
        workflows: drawn.order.map(w => {
          const v = batchView(workflowBatch(drawn, w, bs, all), all, order, callAgent)
          const members = v.members.map(m => v.agents[m]!).filter(a => a !== undefined)
          return { w, root: v.ids[0] ?? null, rootStatus: v.agents[v.ids[0] ?? '']?.status ?? null, stages: workflowTasks(members, runs, '', roots).map(x => ({ title: x.title, agents: x.ids })) }
        }),
      })
    }
    // Step 1.6.1: the gate alert is the anomaly detector; a new anomaly toasts once, never every Stop.
    await detectNow($)
    return result
  }).catch(($, e, next) => next(e))
}
