import type { EngineInterface, Register, Timer } from 'claude-code'
import { assembleBrief, briefPrompt, extractFacts, isValidBrief, markUnverifiedFigures } from './brief.ts'
import { chainOf, parseBrief, renderPage, viewerLink, withHeader } from './viewer.ts'
import type { Entry } from './viewer.ts'
import { SERVER_JS, parseAddress } from './server.ts'
import { isSpinning, panelTree } from './panel.tsx'
import type { Line, Panel } from './panel.tsx'
import { BRIEF_DIR, CAPABILITIES_FILE, DEFAULTS, LAST_RESORT_INSTRUCTIONS, MODULE_DIR, REPO_CONFIG, SEED_PREFIX, SESSION_TEMPLATE, TEMPLATES, TRUST_GATED, baseName, contextLine, creationSplit, expand, k, linkify, repoConfig, resolveConfig, seedCacheFields, seedCacheLine, sessionName, settingsEnv, short, transcriptTitle, hostFields, windowFields, windowInfo } from './config.ts'
import type { Config, HostWindow, Level, SeedCache, TemplateKey, WindowInfo } from './config.ts'
import { ENDED, assembleSessionHandoff, handoffsRoot, inRepo, openRecords, parseRunState, pickRun, scratchRoot, sessionHandoffPath, withNextAction } from './run.ts'
import type { RunState, RunTarget } from './run.ts'
import { noteUsage, registerKeepalive, showSeedCache, stopForHandoff, transcriptSplit } from '../keepalive/keepalive.ts'
import { git, homeDir, log, orLog, readRaw, readText, repoRoot, trustGate } from './io.ts'

// At the handoff threshold (thresholdPercent of the context window), Haiku writes a handoff brief, the mod runs /clear, then seeds the
// fresh session with a pointer to the brief. Interactive terminal sessions only: where a
// wrapper pipes the session and owns the context limit (DISABLE_AUTO_COMPACT), the mod only logs.
// Part of the ai-dlc plugin: when the repository has an active AI-DLC run on the current branch,
// the brief is the `handoff` skill's session handoff, written to the run's scratch folder, and the
// run's run.md points at it before the /clear (run.ts). Without one, the brief is the mod's own.
// While the run this chain claimed stays active, the chain goes on past maxConsecutiveHandoffs; it
// ends when the run is done, blocked or abandoned. Each session of a chain is named
// "<prefix>: <original name> (Session N)".
// The cache: the fresh session can read only the shared prefix (tools, system prompt, project
// context) from the prompt cache, never the old conversation. So the handoff keeps that prefix as
// it was: it changes neither the model nor the effort, and the brief and the seed travel only as
// messages. Keep-alive (../keepalive/) is registered here too; its timers stop before the /clear, and
// the seed turn logs what its first request read from the cache.

// The effective settings (config.ts, resolveConfig) and where each came from. Loaded on first use
// and again at each session start, so a chain picks up edits to the repository file.
let options: Record<string, unknown> = {}
let cfg: Config = DEFAULTS
let cfgSources: Record<string, string> = {}
let cfgLoaded = false
let cfgLoading: Promise<void> | undefined
// Session titles as the classic SessionStart and UserPromptSubmit inputs carry them, by session id.
const titles = new Map<string, string>()
// Whether this process has recorded what the running Claude Code offers (recordCapabilities).
let capsRecorded = false
// Origins the engine stamps on a prompt the person sent; the seed arrives as { kind: 'plugin' }.
const USER_ORIGINS = new Set(['composer', 'bridge'])
// Rough chars-per-token for tool output, used to project the next request's size.
const CHARS_PER_TOKEN = 4
// The panel above the prompt (panel.tsx) is the whole UI. No status entry: the host draws one
// as "⚠ auto-handoff:", which reads as an error.
const LOG = `~/${BRIEF_DIR}/auto-handoff.log`
// problem: why the brief is facts only, when Haiku's summary was unusable.
// briefPath: the brief in BRIEF_DIR, which keeps the chain, the viewer and the status line working.
// seedPath: what the fresh session is told to read; the session handoff when a run is active.
// baseName: the chain's original session name, carried down so names never nest.
type Pending = { oldSession: string; briefPath: string; seedPath: string; run?: { id: string; runMd: string }; tokens: number; chain: string; link: string; problem?: string; baseName: string }

// Module variables survive /clear; $.state does not.
let pending: Pending | undefined
let inFlight = false
let seededSession: string | undefined
let floor: number | undefined
let unattended = 0 // handoffs since the user last typed a prompt
let pausedSession: string | undefined
// The handoff the fresh session came from, until its first request is measured and shown on the panel.
let handedFrom: { session: string; tokens: number; link: string; problem?: string } | undefined
// The seeded session's place in its chain of handoffs, for its own brief's header. Also kept in
// the store as lineage:<session>, because a hot reload resets module variables: a session seeded
// before a reload would otherwise start a new chain when it hands off.
// baseName: the original session's name, without the chain's "<prefix>: … (Session N)" wrapper.
type Lineage = { from: string; chain: string; depth?: number; baseName?: string }
let lineage: Lineage | undefined
// Tokens added since the last response measured the context: tool results and the
// response's own output. turn.complete alone missed a turn whose reads jumped from 63k
// straight past the window, because the request that would have measured it failed.
let unmeasured = 0
// The session whose tool call the gate refused. The refusal tells the model a handoff is coming,
// so one must follow even when the next response measures under the threshold: the gate counts
// tool output at CHARS_PER_TOKEN, which ran high in a live test (projected 83.7k, measured 72.5k)
// and left a session that stopped working with no handoff.
let gated: string | undefined
// From the latest SessionStart; /clear starts a new transcript file.
let transcriptPath: string | undefined

// The module's variables in the process environment. Literal names: the host lists the variables
// a module reads.
async function processEnv($: EngineInterface): Promise<Record<string, unknown>> {
  const read: Record<string, string | undefined> = {
    AI_DLC_AUTO_HANDOFF_ENABLED: await $.env.get('AI_DLC_AUTO_HANDOFF_ENABLED'),
    AI_DLC_AUTO_HANDOFF_THRESHOLD_PERCENT: await $.env.get('AI_DLC_AUTO_HANDOFF_THRESHOLD_PERCENT'),
    AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: await $.env.get('AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS'),
    AI_DLC_AUTO_HANDOFF_DEFAULT_CONTEXT_WINDOW: await $.env.get('AI_DLC_AUTO_HANDOFF_DEFAULT_CONTEXT_WINDOW'),
    AI_DLC_AUTO_HANDOFF_SEED_HEADROOM_TOKENS: await $.env.get('AI_DLC_AUTO_HANDOFF_SEED_HEADROOM_TOKENS'),
    AI_DLC_AUTO_HANDOFF_MAX_CONSECUTIVE: await $.env.get('AI_DLC_AUTO_HANDOFF_MAX_CONSECUTIVE'),
    AI_DLC_AUTO_HANDOFF_CHAIN_WHILE_RUN_ACTIVE: await $.env.get('AI_DLC_AUTO_HANDOFF_CHAIN_WHILE_RUN_ACTIVE'),
    AI_DLC_AUTO_HANDOFF_RENAME_SESSIONS: await $.env.get('AI_DLC_AUTO_HANDOFF_RENAME_SESSIONS'),
    AI_DLC_AUTO_HANDOFF_SESSION_NAME_PREFIX: await $.env.get('AI_DLC_AUTO_HANDOFF_SESSION_NAME_PREFIX'),
    AI_DLC_AUTO_HANDOFF_BRIEF_TEMPLATE: await $.env.get('AI_DLC_AUTO_HANDOFF_BRIEF_TEMPLATE'),
    AI_DLC_AUTO_HANDOFF_INSTRUCTIONS_TEMPLATE: await $.env.get('AI_DLC_AUTO_HANDOFF_INSTRUCTIONS_TEMPLATE'),
    AI_DLC_AUTO_HANDOFF_IGNORE_FILES: await $.env.get('AI_DLC_AUTO_HANDOFF_IGNORE_FILES'),
    AI_DLC_AUTO_HANDOFF_VIEWER: await $.env.get('AI_DLC_AUTO_HANDOFF_VIEWER'),
  }
  return Object.fromEntries(Object.entries(read).filter(([, v]) => v !== undefined))
}

// Reads every source and resolves each setting, highest first: `env` of .claude/settings.local.json,
// `env` of .claude/settings.json (both read from the files, because the merged process environment
// cannot tell them apart), the process environment, .ai-dlc/auto-handoff.json, /config, the default
// (config.ts, resolveConfig). An unreadable source and every invalid value are logged; resolution
// falls through. Never throws: on an error the module runs on /config and the defaults.
async function loadConfig($: EngineInterface): Promise<void> {
  try {
    const root = await repoRoot($)
    const levels: Level[] = []
    const problems: string[] = []
    for (const where of ['.claude/settings.local.json', '.claude/settings.json']) {
      const { env, problem } = settingsEnv(await readRaw($, `${root}/${where}`))
      if (problem) problems.push(`${where} ${problem}`)
      if (env) levels.push({ where, byEnv: true, values: env })
    }
    levels.push({ where: 'the environment', byEnv: true, values: await processEnv($) })
    const repo = repoConfig(await readRaw($, `${root}/${REPO_CONFIG}`))
    if (repo.problem) problems.push(`${REPO_CONFIG} ${repo.problem}`)
    // viewer, briefTemplate and instructionsTemplate apply from the repository file only in a folder
    // Claude Code trusts (config.ts, TRUST_GATED; io.ts, trustGate).
    if (repo.values) levels.push({ where: REPO_CONFIG, byEnv: false, values: await trustGate($, repo.values, TRUST_GATED, REPO_CONFIG, 'set them in the env of .claude/settings.local.json or in /config instead', problems) })
    const r = resolveConfig(levels, options)
    cfg = r.cfg
    cfgSources = r.sources
    for (const line of [...problems, ...r.warnings]) await log($, `config: ${line}`)
  } catch (err) {
    const r = resolveConfig([], options)
    cfg = r.cfg
    cfgSources = r.sources
    await log($, `config error ${String(err)}; using /config and the defaults`)
  }
}

// The settings, loaded once per session start; concurrent callers share one load.
async function ensureConfig($: EngineInterface): Promise<void> {
  if (cfgLoaded) return
  cfgLoading ??= loadConfig($).finally(() => { cfgLoaded = true; cfgLoading = undefined })
  await cfgLoading
}

// A fresh load of the settings. A load already in flight read the files before this call, so it is
// awaited first and a new one started after it; reusing it could keep the old values for the session.
async function reloadConfig($: EngineInterface): Promise<void> {
  if (cfgLoading) await cfgLoading
  cfgLoaded = false
  await ensureConfig($)
}

// Records what the running Claude Code offers, for /ai-dlc:init and /ai-dlc:configure-auto-handoff:
// whether the built-in /rename is in $.command.list(), and the engine version. A model-run skill
// cannot ask the engine, so it reads this file. Once per process and at each startup or resume.
async function recordCapabilities($: EngineInterface): Promise<void> {
  if (capsRecorded) return
  capsRecorded = true
  try {
    const names = (await $.command.list()).map(c => c.name)
    let version: string | null = null
    try { version = (await $.session.version()).version } catch {}
    const path = `${await homeDir($)}/${BRIEF_DIR}/${CAPABILITIES_FILE}`
    await $.fs.write(path, `${JSON.stringify({ checkedAt: new Date().toISOString(), claudeCodeVersion: version, rename: names.includes('rename') }, null, 2)}\n`)
  } catch (err) {
    await log($, `capabilities check failed ${String(err)}`)
  }
}

const shippedFile = ($: EngineInterface, file: string) => `${$.plugin.root}/${MODULE_DIR}/templates/${file}`
const shipped = ($: EngineInterface, key: TemplateKey) => shippedFile($, TEMPLATES.find(t => t[0] === key)![1])

// The template file at its configured path, else the default the mod ships, else ''.
async function template($: EngineInterface, key: TemplateKey): Promise<string> {
  return await readText($, expand(cfg[key], await homeDir($) ?? '')) ?? await readText($, shipped($, key)) ?? ''
}

// A new session writes each template to its path if nothing is there yet, so the files exist
// to be edited. A file the user wrote is never touched.
async function writeMissingTemplates($: EngineInterface) {
  const home = await homeDir($) ?? ''
  for (const [key] of TEMPLATES) {
    const path = expand(cfg[key], home)
    try { await $.fs.read(path); continue } catch {}
    const text = await readText($, shipped($, key))
    if (!text) { await log($, `template default unreadable ${shipped($, key)}`); continue }
    try { await $.fs.write(path, text) } catch (err) { await log($, `template write failed ${path} ${String(err)}`) }
  }
}

// The viewer server's address: the Tailscale host resolved to this machine's IPv4, or localhost
// when Tailscale is missing, logged out or has no address, so the link still opens on this machine.
async function serveAddress($: EngineInterface): Promise<{ host: string; port: string } | undefined> {
  const addr = cfg.viewer ? parseAddress(cfg.viewer) : undefined
  if (!addr || addr.host !== 'tailscale') return addr
  const local = { host: '127.0.0.1', port: addr.port }
  try {
    const { exitCode, stdout } = await $.process.run(['tailscale', 'ip', '-4'])
    const ip = stdout.trim().split('\n')[0]?.trim()
    return exitCode === 0 && ip ? { host: ip, port: addr.port } : local
  } catch {
    return local
  }
}

let lastServeTry = 0
// Starts the server detached (setsid, else nohup), so the pages stay served after this session
// exits: a brief's link is opened later, often from a phone, long after the handoff. When a
// server already holds the port, the new child exits at once, so a launch is safe to repeat.
// Its output goes to the mod's log. Answers whether the launch ran: it needs `sh`, which Windows
// lacks, and then the link falls back to the local file.
async function launchServer($: EngineInterface, pagesDir: string, addr: { host: string; port: string }): Promise<boolean> {
  try {
    const home = await homeDir($)
    const { exitCode } = await $.process.run(['sh', '-c', 'mkdir -p "$1"; if command -v setsid >/dev/null 2>&1; then d=setsid; else d=nohup; fi; $d node -e "$2" "$1" "$3" "$4" >>"$5" 2>&1 </dev/null &',
      'sh', pagesDir, SERVER_JS, addr.host, addr.port, `${home}/${BRIEF_DIR}/auto-handoff.log`])
    if (exitCode === 0) return true
    await log($, `viewer server failed exit=${exitCode}`)
  } catch (err) {
    await log($, `viewer server failed ${String(err)}`)
  }
  return false
}

// Brings the server back if it died (a reboot, a crash). Called on startup and after each turn,
// at most once in five minutes. Sessions with the kill switches set serve too: the switches stop
// handoffs, and serving old briefs is not one.
async function keepServing($: EngineInterface) {
  if (Date.now() - lastServeTry < 300_000) return
  lastServeTry = Date.now()
  const addr = await serveAddress($)
  const home = await homeDir($)
  if (addr && home) await launchServer($, `${home}/${BRIEF_DIR}/pages`, addr)
}

/** Writes the page of every brief in sessionId's chain, so each page lists the whole chain. */
async function writeChainPages($: EngineInterface, briefDir: string, pagesDir: string, sessionId: string): Promise<void> {
  const own = await $.fs.read(`${briefDir}/${sessionId}.md`)
  if (typeof own !== 'string') return
  const all: Entry[] = []
  for (const f of await $.fs.list(briefDir)) {
    if (f.kind !== 'file' || !f.name.endsWith('.md')) continue
    const id = f.name.slice(0, -3)
    try {
      const text = await $.fs.read(`${briefDir}/${f.name}`)
      if (typeof text !== 'string') continue
      const { header, body } = parseBrief(text)
      all.push({ id, header, body })
    } catch {}
  }
  const chain = chainOf(all, sessionId)
  for (const e of chain) await $.fs.write(`${pagesDir}/${e.id}.html`, renderPage(e, chain))
}

// Writes the pages for sessionId's chain and makes sure the server is up. Returns the page's
// link, or '' when the pages could not be written. Never throws: the viewer is not the handoff.
async function viewer($: EngineInterface, briefDir: string, pagesDir: string, sessionId: string): Promise<string> {
  try {
    // $.fs.write creates pagesDir, so no `mkdir`: a subprocess Windows can't run.
    await writeChainPages($, briefDir, pagesDir, sessionId)
    const addr = await serveAddress($)
    const served = addr && await launchServer($, pagesDir, addr)
    return viewerLink(served ? addr : undefined, pagesDir, sessionId)
  } catch (err) {
    await log($, `viewer error session=${sessionId} ${String(err)}`)
    return ''
  }
}

// What the run lookup found for this session:
// run: the AI-DLC run it hands off (run.ts, pickRun), with where its files go;
// owned: whether that run belongs to this session's chain (its `session` is this session or an
//   earlier one of the chain, or the chain claimed it), so the chain may go on past the loop guard;
// ended: the run this chain claimed, when its status is now done, blocked or abandoned.
type Lookup = { run?: RunTarget; owned: boolean; ended?: RunState }

// The tool gate asks canHandOff on every call past the threshold, and parallel calls arrive together.
// One lookup (git, then every run.md) serves them for LOOKUP_TTL_MS, shared while it is still running;
// the cache is also dropped at each turn end, typed prompt and session start, so a changed run state
// is seen at the next turn. runLookup never rejects, so a cached promise cannot hold an error.
const LOOKUP_TTL_MS = 2_000
let lookupCache: { sessionId: string; at: number; look: Promise<Lookup> } | undefined
function cachedLookup($: EngineInterface, sessionId: string): Promise<Lookup> {
  const now = Date.now()
  if (lookupCache?.sessionId === sessionId && now - lookupCache.at < LOOKUP_TTL_MS) return lookupCache.look
  const look = runLookup($, sessionId, new Date(now))
  lookupCache = { sessionId, at: now, look }
  return look
}

// The AI-DLC runs on the current branch, as they matter to this session. Never throws: with no run
// the handoff goes on as the mod's own brief, under the loop guard.
async function runLookup($: EngineInterface, sessionId: string, at: Date): Promise<Lookup> {
  try {
    const cwd = (await $.session.cwd()).replace(/\\/g, '/')
    const root = await git($, ['-C', cwd, 'rev-parse', '--show-toplevel'])
    if (!root) return { owned: false }
    const branchName = await git($, ['-C', root, 'rev-parse', '--abbrev-ref', 'HEAD'])
    if (!branchName || branchName === 'HEAD') return { owned: false }
    const handoffs = handoffsRoot(await readText($, `${root}/.ai-dlc/workflow.json`))
    let entries: { name: string; kind: string }[]
    try { entries = await $.fs.list(inRepo(root, handoffs)) } catch { return { owned: false } }
    // Each run.md is read in parallel: the status that rules a run out is only in its front matter.
    const states = await Promise.all(entries.filter(e => e.kind !== 'file').map(async e => {
      const text = await readText($, `${inRepo(root, handoffs)}/${e.name}/run.md`)
      return text ? parseRunState(text, `${handoffs}/${e.name}`) : undefined
    }))
    const runs = states.filter((s): s is RunState => s !== undefined)
    const lineageIds = await ancestors($, sessionId)
    const claimed = await claimedRun($, sessionId)
    const claimedState = claimed === undefined ? undefined : runs.find(r => r.id === claimed)
    const ended = claimedState?.status && ENDED.has(claimedState.status) ? claimedState : undefined
    const run = pickRun(runs, branchName, sessionId, lineageIds, claimed)
    if (!run) return { owned: false, ended }
    const chain = new Set([sessionId, ...lineageIds])
    const session = run.session?.trim() ?? ''
    const owned = (session !== '' && chain.has(session)) || run.id === claimed
    const scratch = scratchRoot(await readText($, `${root}/AGENTS.md`))
    const commit = await git($, ['-C', root, 'rev-parse', '--short', 'HEAD'])
    return { run: { ...run, root, runMd: `${run.folder}/run.md`, sessionHandoff: sessionHandoffPath(scratch, run, at), branchName, commit }, owned, ended }
  } catch (err) {
    await log($, `run lookup error session=${sessionId} ${String(err)}`)
    return { owned: false }
  }
}

async function storedLineage($: EngineInterface, sessionId: string): Promise<Lineage | undefined> {
  try {
    const v = await $.store.get(`lineage:${sessionId}`) as Partial<Lineage> | undefined
    return typeof v?.from === 'string' && typeof v.chain === 'string'
      ? { from: v.from, chain: v.chain, depth: typeof v.depth === 'number' ? v.depth : undefined, baseName: typeof v.baseName === 'string' ? v.baseName : undefined }
      : undefined
  } catch {
    return undefined
  }
}

// This session's lineage: in memory for the seeded session, else from the store (a hot reload).
async function lineageOf($: EngineInterface, sessionId: string): Promise<Lineage | undefined> {
  return sessionId === seededSession && lineage ? lineage : await storedLineage($, sessionId)
}

// The earlier sessions of this session's chain, nearest first, from the lineage records.
async function ancestors($: EngineInterface, sessionId: string): Promise<string[]> {
  const out: string[] = []
  let cur = await lineageOf($, sessionId)
  for (let i = 0; cur && i < 100 && !out.includes(cur.from); i++) {
    out.push(cur.from)
    cur = await storedLineage($, cur.from)
  }
  return out
}

// The run id this session's chain handed off with, recorded by the seed handler as chainRun:<session>.
async function claimedRun($: EngineInterface, sessionId: string): Promise<string | undefined> {
  try {
    const v = await $.store.get(`chainRun:${sessionId}`)
    return typeof v === 'string' && v ? v : undefined
  } catch {
    return undefined
  }
}

// The session's current title: what the classic hook inputs said, else the transcript's last
// custom-title (a name the person or /rename gave), else its ai-title.
async function currentTitle($: EngineInterface, sessionId: string, transcript: string): Promise<string | undefined> {
  const known = titles.get(sessionId)
  if (known) return known
  const text = await readRaw($, expand(transcript, await homeDir($) ?? ''))
  return text ? transcriptTitle(text) : undefined
}

// Renames the session about to be cleared, before the /clear: a hook on the new session cannot
// rename the old one. Only when the running Claude Code has /rename (checked each time, since the
// types do not promise it). $.command.run queues a command and resolves once it has run, when the
// session is idle; the rename is awaited, so the /clear is queued only after it ran, rather than
// trusting the queue to keep two commands in order. A rename that fails, or has not run within
// RENAME_WAIT_MS, is logged and never stops the handoff.
const RENAME_WAIT_MS = 10_000
async function renameOld($: EngineInterface, sessionId: string, name: string, title: string | undefined): Promise<void> {
  if (title === name) return
  try {
    const names = (await $.command.list()).map(c => c.name)
    if (!names.includes('rename')) {
      await log($, `rename unavailable: /rename is not in this Claude Code's commands; session=${sessionId} keeps its name`)
      return
    }
    titles.set(sessionId, name)
    await log($, `renaming session=${sessionId} to "${name}"`)
    let timer: Timer | undefined
    const late = new Promise<'late'>(resolve => { timer = $.clock.after(RENAME_WAIT_MS, () => resolve('late')) })
    const ran = $.command.run({ command: 'rename', args: name }).then(
      () => 'ran' as const,
      async (err: unknown) => { await log($, `rename failed session=${sessionId} ${String(err)}`); return 'failed' as const },
    )
    const outcome = await Promise.race([ran, late])
    timer?.cancel()
    if (outcome === 'late') await log($, `rename not run within ${RENAME_WAIT_MS / 1000}s session=${sessionId}; clearing anyway`)
  } catch (err) {
    await log($, `rename failed session=${sessionId} ${String(err)}`)
  }
}

// Writes the brief, the run's session handoff when there is a run, and the viewer pages, then
// renames the session and queues the /clear. `found`: the run lookup chainGuard already made for this
// attempt, so it is not done twice.
async function handoff($: EngineInterface, sessionId: string, tokens: number, threshold: number, found?: Lookup) {
  try {
    const own = await lineageOf($, sessionId)
    // A session with no lineage starts its chain. One seeded before depth existed stays unknown.
    const depth = own ? own.depth : 1
    const at = new Date()
    const { run } = found ?? await runLookup($, sessionId, at)
    const { brief, problem, transcript, cwd } = await composeBrief($, sessionId, tokens, threshold, depth, run)
    // The chain's original name: carried in the lineage, else this session's own title (with any
    // chain wrapper taken off), else its short id.
    const title = await currentTitle($, sessionId, transcript)
    const name = own?.baseName ?? baseName(title, cfg.sessionNamePrefix) ?? short(sessionId)
    const briefDir = `${await homeDir($)}/${BRIEF_DIR}`
    const briefPath = `${briefDir}/${sessionId}.md`
    const chain = own?.chain ?? sessionId
    const header = { from: own?.from, chain, depth: depth !== undefined ? String(depth) : undefined, tokens: String(tokens), at: new Date().toISOString(), cwd }
    await $.fs.write(briefPath, withHeader(header, brief))
    const linked = run ? await writeRunHandoff($, run, brief, sessionId, tokens, at) : undefined
    const link = await viewer($, briefDir, `${briefDir}/pages`, sessionId)
    pending = { oldSession: sessionId, briefPath, seedPath: linked?.seedPath ?? briefPath, run: linked?.run, tokens, chain, link, problem, baseName: name }
    steps($, [briefStep(problem), { mark: 'spin', text: 'clearing' }])
    await $.store.set(`fired:${sessionId}`, problem ? `clearing-facts-only:${problem}` : 'clearing')
    await log($, `brief written ${briefPath} (${brief.length} chars); queueing /clear`)
    // The session being cleared takes its place in the chain's names, Session 1 for the first.
    if (cfg.renameSessions && depth !== undefined) await renameOld($, sessionId, sessionName(cfg.sessionNamePrefix, name, depth), title)
    // Module timers survive /clear: keep-alive's must not ping the old conversation into the new session.
    if (stopForHandoff($)) await log($, `keepalive timers stopped before /clear session=${sessionId}`)
    queueClear($, briefPath)
  } catch (err) {
    pending = undefined
    // fired stays 'briefing', which tryHandoff treats as an orphan: the next turn tries again.
    failed($, 'no brief written', 'this session keeps going and tries again after the next turn')
    await log($, `handoff error session=${sessionId} ${String(err)}; no clear`)
  }
}

// The brief's text: Haiku's summary in the template's sections, around the facts the code gathered,
// or the facts alone when the summary is unusable (`problem` says why). With a run, Haiku writes the
// handoff skill's session handoff sections instead of the brief's.
async function composeBrief($: EngineInterface, sessionId: string, tokens: number, threshold: number, depth: number | undefined, run: RunTarget | undefined) {
  const messages = await $.session.messages()
  const facts = extractFacts(messages, cfg.ignoreFiles)
  const { base, source } = await configured($)
  facts.handoffTokens = tokens
  facts.threshold = threshold
  facts.thresholdSource = threshold > base ? `${source} (${k(base)}), raised to leave ${k(cfg.seedHeadroomTokens)} above the starting size` : source
  if (sessionId === seededSession && floor !== undefined) facts.seededSessionStartSize = floor
  facts.unattendedCount = unattended
  if (depth !== undefined) facts.depth = depth
  const briefTemplate = (run && await readText($, shippedFile($, SESSION_TEMPLATE))) || await template($, 'briefTemplate')
  const result = await $.model.complete({
    model: 'haiku',
    system: 'You summarize coding sessions into precise handoff briefs.',
    prompt: briefPrompt(messages, facts, briefTemplate),
    maxTokens: 4_000,
    timeoutMs: 60_000,
  })
  // A failed, empty or sectionless reply falls back to the facts.
  const text = result.isAnswered ? result.text : ''
  const problem = !result.isAnswered ? result.reason : !text.trim() ? 'empty' : !isValidBrief(text, briefTemplate) ? 'no-sections' : undefined
  if (problem) await log($, `haiku brief unusable session=${sessionId} reason=${problem}; using facts-only brief`)
  const checked = markUnverifiedFigures(text, facts)
  if (!problem && checked.flagged.length) await log($, `brief figures not in Handoff Numbers session=${sessionId}: ${checked.flagged.join(', ')}`)
  const cwd = await $.session.cwd()
  // Claude Code keeps transcripts under the cwd with every non-alphanumeric character as '-'.
  const transcript = transcriptPath ?? `~/.claude/projects/${cwd.replace(/[^a-zA-Z0-9]/g, '-')}/${sessionId}.jsonl`
  const instructions = await template($, 'instructionsTemplate') || LAST_RESORT_INSTRUCTIONS
  const summary = problem ? undefined : checked.text
  const brief = run
    ? assembleSessionHandoff({ run, sessionId, transcript, instructions, tokens: k(tokens), records: await recordsOf($, run) }, facts, summary)
    : assembleBrief({ sessionId, transcript, instructions }, facts, summary)
  return { brief, problem, transcript, cwd }
}

// The run's session handoff, then run.md pointing at it, both before the /clear: a session that
// dies between here and the seed still leaves the run resumable from run.md. The session handoff
// goes first so run.md never points at a file that was not written; when a later step fails, the
// log names the step and the session handoff left behind (gitignored scratch, harmless), and the
// answer is undefined, so the seed names the brief instead.
async function writeRunHandoff($: EngineInterface, run: RunTarget, brief: string, sessionId: string, tokens: number, at: Date): Promise<{ seedPath: string; run: NonNullable<Pending['run']> } | undefined> {
  const handoffPath = inRepo(run.root, run.sessionHandoff)
  const runMdPath = inRepo(run.root, run.runMd)
  let step = 'write session handoff'
  try {
    await $.fs.write(handoffPath, brief)
    step = 'read run.md'
    const state = await $.fs.read(runMdPath)
    if (typeof state !== 'string') throw new Error(`${run.runMd} unreadable`)
    step = 'write run.md'
    await $.fs.write(runMdPath, withNextAction(state, { stage: run.stage, sessionHandoff: run.sessionHandoff, oldSession: sessionId, tokens: k(tokens), at }))
    await log($, `session handoff written ${handoffPath}; ${run.runMd} next action updated`)
    return { seedPath: handoffPath, run: { id: run.id, runMd: run.runMd } }
  } catch (err) {
    const left = step === 'write session handoff' ? '' : `; ${handoffPath} written but not linked from run.md`
    await log($, `session handoff failed run=${run.id} step="${step}" ${String(err)}${left}; seeding the brief instead`)
    return undefined
  }
}

// Queues the /clear that ends this session; the seed follows at the next SessionStart.
function queueClear($: EngineInterface, briefPath: string) {
  $.command.run({ command: 'clear' }).catch(async (err: unknown) => {
    pending = undefined
    // fired stays 'clearing', so this session does not try again; it carries on as it is.
    failed($, '/clear was rejected', `this session keeps going; the brief is at ${briefPath}`)
    await log($, `clear rejected ${String(err)}`)
  })
}

// The open records of the run, each checked on disk (run.ts, openRecords). The session handoff is
// the file being written, so it counts as there.
async function recordsOf($: EngineInterface, run: RunTarget) {
  const state = await readRaw($, inRepo(run.root, run.runMd))
  if (state === undefined) return undefined
  return Promise.all(openRecords(state, run, run.sessionHandoff).map(async r => ({
    ...r,
    exists: r.path === run.sessionHandoff || await readRaw($, inRepo(run.root, r.path)) !== undefined,
  })))
}

// Whether the chain may hand off once more without a typed prompt. A session the person prompted
// (unattended 0) always may. Otherwise, with chainWhileRunActive, the run state decides: the run
// this chain claimed being done, blocked or abandoned ends the chain, and an active run of the
// chain lets it go on past maxConsecutiveHandoffs. With no such run, the loop guard applies.
// `find` makes the run lookup; a guard that goes ahead returns it, so the handoff does not redo it.
type Guard = { stop: false; look?: Lookup } | { stop: true; log: string; header: string; toast: string }
async function chainGuard(sessionId: string, find: () => Promise<Lookup>): Promise<Guard> {
  if (unattended === 0) return { stop: false }
  if (!cfg.chainWhileRunActive) return unattended < cfg.maxUnattended ? { stop: false } : pause(sessionId)
  const look = await find()
  if (look.ended) {
    const why = `run ${look.ended.id} is ${look.ended.status}: chain ends`
    return { stop: true, log: `${why} session=${sessionId} after ${unattended} handoffs with no user prompt`, header: `auto-handoff stopped: ${why}`, toast: `${why}: send a message to resume` }
  }
  if (unattended < cfg.maxUnattended) return { stop: false, look }
  if (look.owned && look.run) return { stop: false, look }
  return pause(sessionId)
}

const pause = (sessionId: string): Guard => ({
  stop: true,
  log: `loop guard session=${sessionId}: ${unattended} handoffs with no user prompt; paused until one`,
  header: `auto-handoff paused after ${unattended} handoffs in a row`,
  toast: `paused after ${unattended} handoffs in a row: send a message to resume`,
})

// Shared by turn.complete and turn.step: the fired, kill-switch and loop-guard checks, then
// the handoff itself. Returns true when a handoff started.
async function tryHandoff($: EngineInterface, sessionId: string, tokens: number, threshold: number, via: string): Promise<boolean> {
  const fired = await $.store.get(`fired:${sessionId}`)
  // Every caller checks inFlight first, so a 'briefing' marker seen here is an orphan: the
  // module reloaded mid-handoff and the brief never landed. Retry instead of going quiet.
  if (fired === 'briefing') await log($, `stale briefing marker session=${sessionId} (mod reloaded mid-handoff); retrying`)
  else if (fired) return false

  const pane = await paneVar($)
  if (pane) {
    await $.store.set(`fired:${sessionId}`, 'skipped-pane')
    await log($, `skip session=${sessionId} tokens=${tokens} reason=${pane}`)
    return false
  }

  // Not marked fired: once the user types, the next turn can hand off.
  const guard = await chainGuard(sessionId, () => runLookup($, sessionId, new Date()))
  if (guard.stop) {
    if (pausedSession !== sessionId) {
      pausedSession = sessionId
      await log($, guard.log)
      showPanel($, { header: { mark: 'warn', text: guard.header }, steps: [{ mark: 'warn', text: 'send a message to resume' }], sticky: true }, guard.toast)
    }
    return false
  }
  // Counted with an active run too, so the brief, the panel and the log show the chain's length.
  unattended++

  inFlight = true
  gated = undefined
  // No keep-alive ping while the brief is written: it would only re-cache a conversation about to go.
  if (stopForHandoff($)) await log($, `keepalive timers stopped for the handoff session=${sessionId}`)
  await $.store.set(`fired:${sessionId}`, 'briefing')
  // via goes last: it can hold spaces ("turn.step measured=123 gated").
  await log($, `threshold session=${sessionId} tokens=${tokens} threshold=${threshold} ${windowFields(lastWindow, cfg)} ${hostFields(await hostWindow($))} via=${via}`)
  showPanel($, { header: { mark: 'spin', text: `auto-handoff · ${k(tokens)} / ${k(threshold)}` }, steps: [{ mark: 'spin', text: 'writing brief' }] },
    `context ${k(tokens)} is past ${k(threshold)}: handing off`)
  // Not awaited: the brief can take a while and /clear only runs once the session is idle.
  handoff($, sessionId, tokens, threshold, guard.look).finally(() => { inFlight = false })
  return true
}

// Kill switches. `enabled` false (from any source: AI_DLC_AUTO_HANDOFF_ENABLED=false in a shell
// turns it off for the sessions started there) turns the mod off. DISABLE_AUTO_COMPACT, Claude Code's
// own variable, means something else owns the context limit (a wrapper that pipes the session, where
// /clear would break the pipe), so the mod stays out of its way too.
async function paneVar($: EngineInterface): Promise<string | undefined> {
  if (!cfg.enabled) return `enabled=false (${cfgSources.enabled ?? 'default'})`
  // Literal name: the host lists the variables a module reads.
  if (await $.env.get('DISABLE_AUTO_COMPACT')) return 'DISABLE_AUTO_COMPACT set'
  return undefined
}

// Whether tryHandoff would go ahead for this session. The tool gate refuses calls only then,
// so a session the mod will not hand off (pane, loop guard, chain ended, already fired) is never blocked.
async function canHandOff($: EngineInterface, sessionId: string): Promise<boolean> {
  if (await paneVar($) || (await chainGuard(sessionId, () => cachedLookup($, sessionId))).stop) return false
  const fired = await $.store.get(`fired:${sessionId}`)
  return !fired || fired === 'briefing'
}

// The panel above the prompt. A module variable rather than $.state: $.state does not survive
// /clear, and the panel carries the handoff across it.
const FRAME_MS = 100 // the host redraws the band ten times a second at most
const DONE_MS = 10_000
let shown: Panel | undefined
let frame = 0
let spin: Timer | undefined
let collapse: Timer | undefined

// The band above the prompt is drawn on the terminal and desktop only. On the mobile app or in
// VS Code nothing shows it, so the moments that matter go out as a toast there too: the
// threshold tripping, the result, and anything that stays up until dismissed. Never per step.
const BAND_SURFACES = new Set(['terminal', 'desktop'])
async function toastOffBand($: EngineInterface, text: string) {
  try {
    if ((await $.session.surfaces()).some((s) => !BAND_SURFACES.has(s))) $.ui.toast(text, { timeoutMs: 30_000 })
  } catch (err) {
    await log($, `surfaces error ${String(err)}`)
  }
}

function showPanel($: EngineInterface, p: Panel, toast?: string) {
  if (toast) void toastOffBand($, toast)
  shown = p
  collapse?.cancel()
  collapse = undefined
  if (isSpinning(p)) {
    spin ??= $.clock.every(FRAME_MS, () => {
      frame++
      $.ui.invalidate('ui.render')
    })
  } else {
    spin?.cancel()
    spin = undefined
    if (!p.sticky) collapse = $.clock.after(DONE_MS, () => hidePanel($))
  }
  $.ui.invalidate('ui.render')
}

function hidePanel($: EngineInterface) {
  shown = undefined
  spin?.cancel()
  collapse?.cancel()
  spin = collapse = undefined
  $.ui.invalidate('ui.render')
}

// The steps under the panel's current header; a panel lost to a reload gets a plain one.
function steps($: EngineInterface, lines: Line[]) {
  showPanel($, { header: shown?.header ?? { mark: 'spin', text: 'auto-handoff' }, steps: lines })
}

// Adds a step to the panel on screen, or opens one under `header` when nothing is showing.
function addStep($: EngineInterface, step: Line, header: Line, sticky = false) {
  const p = shown ?? { header, steps: [] }
  showPanel($, { ...p, steps: [...p.steps, step], sticky: p.sticky || sticky }, step.mark === 'spin' || step.mark === 'done' ? undefined : step.text)
}

// A facts-only brief is the one quiet failure: the handoff works, but the brief is thin.
const briefStep = (problem?: string): Line => problem
  ? { mark: 'warn', text: `brief is facts only: the summary failed (${problem})` }
  : { mark: 'done', text: 'brief written' }

function failed($: EngineInterface, what: string, next: string) {
  showPanel($, { header: { mark: 'fail', text: `handoff failed: ${what}` }, steps: [{ mark: 'fail', text: next }, { mark: 'fail', text: `log: ${LOG}` }], sticky: true },
    `handoff failed: ${what}. ${next}`)
}

// The fresh session's first measurement: the panel's last step, which says the handoff worked.
// It collapses on its own unless the brief was facts only.
// With `cache`, a step says whether the fresh session's first request read the shared prefix from the cache.
function showHandedOff($: EngineInterface, fresh: number, cache?: SeedCache) {
  if (!handedFrom) return
  const { tokens, link, problem } = handedFrom
  const lines: Line[] = [...(problem ? [briefStep(problem)] : []), ...(cache ? [{ mark: cache.read > 0 ? 'done' : 'warn', text: seedCacheLine(cache) } as Line] : [])]
  showPanel($, { header: { mark: 'done', text: `handed off · ${k(tokens)} → ${k(fresh)}` }, steps: lines, link: link || undefined, sticky: !!problem },
    `↪ handed off · ${k(tokens)} → ${k(fresh)}${problem ? ' · the brief is facts only' : ''}`)
  handedFrom = undefined
}

// The context window the threshold is a share of: what $.session.usage() reports (windowInfo), else
// defaultContextWindow. The fallback is logged once per process, so a session on a larger window that
// hands off early can be traced to it, and one on a smaller window, where the line lies past the
// window and the handoff waits for Claude Code's auto-compact (session.compact below), is told to set thresholdTokens.
let windowFallbackLogged = false
// The window the last threshold was computed from, and its source, for the per-turn threshold log
// line. configured() clears it first, so with thresholdTokens (no window read) it stays undefined.
// Every caller of tryHandoff computes the threshold just before, so the line shows that window.
let lastWindow: WindowInfo | undefined
// Claude Code's own view of the window, for the threshold log line only: asked for when that line is
// written, never on every turn. `summary` estimates locally; `full` would send token-count requests,
// as /context does. A missing breakdown or a failed call gives undefined, which logs `none`.
async function hostWindow($: EngineInterface): Promise<HostWindow | undefined> {
  try {
    return (await $.session.usage({ breakdown: 'summary' })).context.breakdown
  } catch {
    return undefined
  }
}

async function contextWindow($: EngineInterface): Promise<number> {
  const w = windowInfo((await $.session.usage()).context)
  lastWindow = w ?? { window: cfg.defaultContextWindow, source: 'default' }
  if (w !== undefined) return w.window
  const fallback = cfg.defaultContextWindow
  if (!windowFallbackLogged) {
    windowFallbackLogged = true
    const line = contextLine(cfg.thresholdPercent, fallback)
    await log($, `no context window reported: thresholdPercent applies to ${fallback}, a line of ${line} tokens; if the real window is smaller than ${line}, the handoff waits for auto-compact: set thresholdTokens (AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS) to an absolute token count`)
  }
  return fallback
}

// The configured threshold in tokens and where it came from: thresholdTokens, an absolute token
// count, when it is set anywhere; else thresholdPercent of the window. The source names the variable
// or file, so the headroom warning tells the person what to change.
// Main or lead session only: every caller skips events that carry an agentId.
async function configured($: EngineInterface): Promise<{ base: number; source: string }> {
  lastWindow = undefined
  if (cfg.thresholdTokens) return { base: cfg.thresholdTokens, source: cfgSources.thresholdTokens ?? 'thresholdTokens' }
  const window = await contextWindow($)
  const from = cfgSources.thresholdPercent
  return { base: contextLine(cfg.thresholdPercent, window), source: `${cfg.thresholdPercent}% of the ${k(window)} window, ${!from || from === 'default' ? 'thresholdPercent default' : from}` }
}

// A seeded session hands off no sooner than seedHeadroomTokens past its floor, whatever the threshold says.
async function thresholdFor($: EngineInterface, sessionId: string): Promise<number> {
  const { base } = await configured($)
  return sessionId === seededSession ? Math.max(base, (floor ?? 0) + cfg.seedHeadroomTokens) : base
}

// Once per seeded session, as its floor lands: when the configured threshold leaves less than
// seedHeadroomTokens above the floor, say so, with the number, the source, and where the line moved to.
// Without this the 2026-10-04 chain looked like a guard bug: a token threshold left in a shell.
let warnedSession: string | undefined
async function warnTightThreshold($: EngineInterface, sessionId: string) {
  if (floor === undefined || warnedSession === sessionId) return
  warnedSession = sessionId
  const { base, source } = await configured($)
  const headroom = base - floor
  const min = cfg.seedHeadroomTokens
  if (headroom >= min) return
  await log($, `tight threshold session=${sessionId} threshold=${base} source=${source} floor=${floor} headroom=${headroom} effective=${floor + min}`)
  const left = headroom > 0 ? `leaves ${k(headroom)}` : 'is below'
  addStep($, { mark: 'warn', text: `threshold ${k(base)} (${source}) ${left} this session's ${k(floor)} start: handing off at ${k(floor + min)} instead` }, { mark: 'warn', text: 'auto-handoff' }, true)
}

export const register: Register = (on, opts) => {
  // /config alone until the first hook reads the other sources (ensureConfig).
  options = opts
  cfg = resolveConfig([], options).cfg
  cfgLoaded = false
  // Keep-alive (../keepalive/keepalive.ts): its own events and the /ai-dlc:keepalive command. It arms no
  // pings while a handoff is under way.
  registerKeepalive(on, opts, { handingOff: () => inFlight || pending !== undefined })
  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    try {
      if (!e.agentId) {
        lookupCache = undefined
        await ensureConfig($)
        await recordCapabilities($)
        await keepServing($)
      }
      if (e.agentId || inFlight || pending) return r // subagent turns fire turn.complete too
      const tokens = (await $.session.usage()).context.tokens
      if (tokens === undefined) return r
      const sessionId = await $.session.id()
      if (sessionId === seededSession && floor === undefined) {
        // Fallback only: turn.step sets the floor from the seed turn's first response. Reached
        // when that response carried no usage.
        floor = tokens
        await log($, `floor set at turn end session=${sessionId} tokens=${tokens} (first response carried no usage)`)
        showHandedOff($, tokens)
        await warnTightThreshold($, sessionId)
        return r
      }
      const threshold = await thresholdFor($, sessionId)
      if (tokens < threshold && gated !== sessionId) return r
      await tryHandoff($, sessionId, tokens, threshold, gated === sessionId ? 'turn.complete gated' : 'turn.complete')
    } catch (err) {
      await log($, `turn.complete error ${String(err)}`)
    }
    return r
  })

  // Tool output lands in the next request; count it before that request is sent. Past the
  // threshold, refuse the call instead: one step of parallel reads took a session from 67k to
  // 437k with no request in between for turn.step to stop. A refused call never runs; the
  // next request trips turn.step and the handoff goes through the normal path.
  on('tool.call', async ($, e, next) => {
    if (!e.agentId) {
      try {
        await ensureConfig($)
        const sessionId = await $.session.id()
        const tokens = (await $.session.usage()).context.tokens
        const projected = (tokens ?? 0) + unmeasured
        const threshold = await thresholdFor($, sessionId)
        if (inFlight || pending || (tokens !== undefined && projected >= threshold && await canHandOff($, sessionId))) {
          if (!inFlight && !pending) gated = sessionId
          await log($, `tool refused session=${sessionId} tool=${e.tool} projected=${projected} threshold=${threshold}`)
          return { deny: `[auto-handoff] Not run: the context is past the handoff threshold (${k(projected)} ≥ ${k(threshold)}). This session is handing off to a fresh one, which will redo this call. Make no more tool calls.` }
        }
      } catch (err) {
        await log($, `tool.call gate error ${String(err)}`)
      }
    }
    const r = await next(e)
    if (!e.agentId && typeof r.text === 'string') unmeasured += Math.ceil(r.text.length / CHARS_PER_TOKEN)
    return r
  })

  // Before each main-loop request: if the last measured size plus what has landed since
  // crosses the threshold, end the turn here and hand off instead of sending a request
  // that may overflow the window.
  on('turn.step', async function* ($, e, next) {
    if (!e.agentId && !inFlight && !pending && e.index > 0) {
      try {
        await ensureConfig($)
        const tokens = (await $.session.usage()).context.tokens
        const sessionId = await $.session.id()
        const isSeedTurn = sessionId === seededSession && floor === undefined
        if (tokens !== undefined && !isSeedTurn) {
          const projected = tokens + unmeasured
          const threshold = await thresholdFor($, sessionId)
          const isGated = gated === sessionId
          if ((projected >= threshold || isGated) && await tryHandoff($, sessionId, projected, threshold, `turn.step measured=${tokens}${isGated ? ' gated' : ''}`)) {
            unmeasured = 0
            // A gated session can measure under the threshold here; "would carry" a number below it reads as a bug.
            const why = projected >= threshold
              ? `The next request would carry about ${Math.round(projected / 1000)}k tokens (threshold ${Math.round(threshold / 1000)}k).`
              : `A tool call was refused at the handoff threshold (${Math.round(threshold / 1000)}k).`
            yield { kind: 'text', index: 0, text: `[auto-handoff] ${why} Stopping this turn to hand off to a fresh session.` }
            yield { kind: 'stop', stopReason: 'end_turn', usage: null }
            return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
          }
        }
      } catch (err) {
        await log($, `turn.step error ${String(err)}`)
      }
    }
    const before = unmeasured
    const seeding = !e.agentId && seededSession !== undefined && floor === undefined
    const r = yield* next(e)
    // The response measured everything up to its request; its own output is new, and so is
    // any tool output that landed while it streamed (core runs tools before the stream ends).
    if (!e.agentId && r.usage) {
      unmeasured = unmeasured - before + r.usage.output_tokens
      noteUsage(r.usage) // keep-alive's tracks follow the 1h/5m split of the cache writes
    }
    // The seed turn's first request is the fresh session's true starting size. Measuring at
    // the end of that turn instead let a busy first turn (47k to 129k of reads) set
    // the floor at 129k, with the pre-request check off the whole way.
    // It also proves what the handoff kept of the cache: only the shared prefix can be read.
    if (seeding && r.usage) {
      floor = r.usage.input_tokens + r.usage.cache_read_input_tokens + r.usage.cache_creation_input_tokens
      const cache: SeedCache = {
        input: r.usage.input_tokens,
        read: r.usage.cache_read_input_tokens,
        written: r.usage.cache_creation_input_tokens,
        split: creationSplit(r.usage) ?? await transcriptSplit($, transcriptPath ? expand(transcriptPath, await homeDir($) ?? '') : undefined),
      }
      await log($, `floor session=${seededSession} tokens=${floor} (seed turn's first request) ${seedCacheFields(cache)}`)
      showHandedOff($, floor, cache)
      // Also on keep-alive's status line, until the next turn starts. A failure there is logged,
      // never thrown: the floor is already set, and the tight-threshold warning below must still run.
      await orLog($, 'keepalive seed line', () => showSeedCache($, cache))
      await warnTightThreshold($, seededSession!)
    }
    return r
  })

  // The engine's own auto-compact runs ahead of the turn.step check (live tests 2026-10-03:
  // two compactions, no turn.step line). Catch it here and hand off in its place.
  on('session.compact', async ($, e, next) => {
    if (e.trigger !== 'auto' || e.agentId) return next(e)
    if (inFlight || pending) return { skip: 'auto-handoff in progress' }
    try {
      await ensureConfig($)
      const sessionId = await $.session.id()
      const tokens = ((await $.session.usage()).context.tokens ?? 0) + unmeasured
      const threshold = await thresholdFor($, sessionId)
      await log($, `auto-compact session=${sessionId} projected=${tokens}`)
      if (await tryHandoff($, sessionId, tokens, threshold, 'session.compact')) {
        unmeasured = 0
        return { skip: 'auto-handoff: handing off to a fresh session instead of compacting' }
      }
    } catch (err) {
      await log($, `session.compact error ${String(err)}`)
    }
    return next(e)
  })

  // The seed row in the transcript: the brief path and the viewer URL drawn as links, so a
  // click opens them. The stored message stays as submitted; only the drawing changes. A
  // Markdown element linkifies http:, https: and file: (the Link element refuses the
  // Tailscale IP), and the panel draws its brief link the same way.
  // Yields the band to a survey, and passes when there is nothing to show.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!shown || e.props.hasSurvey) return next(e)
    return panelTree($.ui.resolve(e), shown, frame, () => hidePanel($))
  })

  on('ui.render', { component: 'UserMessage', props: { origin: { kind: 'plugin' } } }, async ($, e, next) => {
    const origin = e.props.origin
    if (origin.kind !== 'plugin' || origin.name !== $.plugin.name || !e.props.text.startsWith(SEED_PREFIX)) return next(e)
    const { Markdown } = $.ui.resolve(e)
    return <Markdown text={linkify(e.props.text)} />
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.origin && USER_ORIGINS.has(e.origin.kind)) {
      unattended = 0
      lookupCache = undefined
      if (pausedSession) hidePanel($) // the pause panel's "send a message to resume" is done
      pausedSession = undefined
    }
    return next(e)
  })

  // The session's title as the engine knows it, kept for naming the chain (currentTitle).
  on('classic.UserPromptSubmit', async ($, e, next) => {
    const r = await next(e)
    try {
      if (e.session_title?.trim()) titles.set(await $.session.id(), e.session_title.trim())
    } catch {}
    return r
  })

  on('classic.SessionStart', async ($, e, next) => {
    const r = await next(e)
    if (e.transcript_path) transcriptPath = e.transcript_path
    // Each session start reloads the settings, so a chain picks up edits to the repository file.
    lookupCache = undefined
    await reloadConfig($)
    try {
      if (e.session_title?.trim()) titles.set(await $.session.id(), e.session_title.trim())
    } catch {}
    if (e.source === 'startup' || e.source === 'resume') {
      capsRecorded = false
      await recordCapabilities($)
    }
    if (e.source === 'startup') {
      await writeMissingTemplates($)
      await keepServing($)
    }
    // A /clear of the person's own leaves no handoff to report; the panel from the last one goes too.
    if (e.source === 'clear' && !pending && !inFlight && shown) hidePanel($)
    if (e.source !== 'clear' || !pending) return r
    const p = pending
    pending = undefined
    let sessionTitle: string | undefined
    try {
      const newSession = await $.session.id()
      seededSession = newSession
      floor = undefined
      unmeasured = 0
      await $.store.set(`fired:${p.oldSession}`, `seeded:${newSession}`)
      await log($, `seeding new=${newSession} from=${p.oldSession}`)
      handedFrom = { session: p.oldSession, tokens: p.tokens, link: p.link, problem: p.problem }
      steps($, [briefStep(p.problem), { mark: 'done', text: 'cleared' }, { mark: 'spin', text: 'starting the fresh session' }])
      const own = await storedLineage($, p.oldSession)
      const prior = own ? own.depth : 1
      lineage = { from: p.oldSession, chain: p.chain, depth: prior !== undefined ? prior + 1 : undefined, baseName: p.baseName }
      await $.store.set(`lineage:${newSession}`, lineage)
      // The run the chain hands off: the new session may carry it on before the resumed
      // orchestrator writes its own id into run.md (run.ts, pickRun).
      if (p.run) await $.store.set(`chainRun:${newSession}`, p.run.id)
      // The new session's name, set through the SessionStart answer: no session.start fires after /clear.
      if (cfg.renameSessions && lineage.depth !== undefined) {
        sessionTitle = sessionName(cfg.sessionNamePrefix, p.baseName, lineage.depth)
        titles.set(newSession, sessionTitle)
        await log($, `naming session=${newSession} "${sessionTitle}"`)
      }
      // The old brief learns where it went, and its chain's pages link forward.
      try {
        const old = parseBrief(await $.fs.read(p.briefPath) as string)
        // viewer: the page link, read by the status line script for the session it handed off to.
        await $.fs.write(p.briefPath, withHeader({ ...old.header, to: newSession, ...(p.link ? { viewer: p.link } : {}) }, old.body))
        const briefDir = p.briefPath.replace(/\/[^/]+$/, '')
        await viewer($, briefDir, `${briefDir}/pages`, p.oldSession)
      } catch (err) {
        await log($, `viewer forward link failed ${String(err)}`)
      }
      // One line on screen; the model reads the brief from disk. A full brief as the
      // seed showed up as a wall of text the person never wrote.
      // With a run, the seed names the session handoff, the run state the orchestrator resumes from,
      // and the session handoff's list of the open records.
      const copy = p.link ? ` (readable copy: ${p.link})` : ''
      const read = p.run
        ? `Read the session handoff at ${p.seedPath} before doing anything else${copy} and follow its Instructions section. It continues AI-DLC run ${p.run.id}: resume the run from its run state ${p.run.runMd}, whose Next action points to the session handoff, and read the open records its Handoff records section lists.`
        : `Read the brief at ${p.briefPath} before doing anything else${copy} and follow its Instructions section.`
      const text = `${SEED_PREFIX} ${short(p.oldSession)}. The previous session hit its context limit and was cleared. ${read} Open your first reply with the line "↪ Handoff from session ${short(p.oldSession)}".`
      $.prompt.submit({ text }).catch((err: unknown) => {
        handedFrom = undefined
        failed($, 'the seed prompt was rejected', `paste the brief path to carry on: ${p.briefPath}`)
        return log($, `seed rejected ${String(err)}`)
      })
    } catch (err) {
      await log($, `seed error ${String(err)}`)
    }
    return sessionTitle ? { ...r, sessionTitle } : r
  })
}
