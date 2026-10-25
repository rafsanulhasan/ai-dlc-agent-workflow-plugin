// ai-dlc-lens, step 1.6.1 (run AAW-20261023-lens-plugin-from-spike): the anomaly detector behind
// /ai-dlc:lens-gate. Pure functions, no `$`: register.tsx reads the files and agent states and calls these.
// The human's mapping (2026-10-24): blocked run red; gate waiting for the human orange; gate rejected red;
// loop out of rounds deep orange; agent failed or stopped red; agent killed or waiting too long red;
// hand-back that failed its check yellow. Every check and colour is a setting (hooks/settings.ts).
// Step 1.6.1.l1 (human, 2026-10-23): a blocked step (a Stages row `blocked`) red even while its run is active,
// never twice with its blocked run; and `anomalyRunScope` (this session's runs, or every active or blocked run).
// Parsing is defensive: nothing here throws on any text; what it cannot read it skips and names in `skipped`.
import type { LensAgent, LensAnomaly } from '../types'
import { isWaiting, runDirOf } from './lens'
import type { LensSettings } from './settings'

export type AnomalyKind =
  | 'runBlocked'
  | 'stepBlocked'
  | 'gateWaiting'
  | 'gateRejected'
  | 'loopOutOfRounds'
  | 'agentFailed'
  | 'agentKilled'
  | 'agentWaitingLong'
  | 'handbackFailed'

type Check = { enable: keyof LensSettings; color: keyof LensSettings; label: string; rank: number }

/** Each check: its enable setting, its colour setting, its words, and its rank (the worst colour wins on a run). */
export const CHECKS: Record<AnomalyKind, Check> = {
  runBlocked: { enable: 'anomalyRunBlocked', color: 'anomalyRunBlockedColor', label: 'Run blocked', rank: 4 },
  stepBlocked: { enable: 'anomalyStepBlocked', color: 'anomalyStepBlockedColor', label: 'Step blocked', rank: 4 },
  gateRejected: { enable: 'anomalyGateRejected', color: 'anomalyGateRejectedColor', label: 'Gate rejected', rank: 4 },
  agentFailed: { enable: 'anomalyAgentFailed', color: 'anomalyAgentFailedColor', label: 'Agent failed or stopped', rank: 4 },
  agentKilled: { enable: 'anomalyAgentKilled', color: 'anomalyAgentKilledColor', label: 'Agent killed', rank: 4 },
  agentWaitingLong: { enable: 'anomalyAgentWaitingLong', color: 'anomalyAgentWaitingLongColor', label: 'Agent waiting too long', rank: 4 },
  loopOutOfRounds: { enable: 'anomalyLoopOutOfRounds', color: 'anomalyLoopOutOfRoundsColor', label: 'Loop out of rounds', rank: 3 },
  gateWaiting: { enable: 'anomalyGateWaiting', color: 'anomalyGateWaitingColor', label: 'Gate waiting for the human', rank: 2 },
  handbackFailed: { enable: 'anomalyHandbackFailed', color: 'anomalyHandbackFailedColor', label: 'Hand-back failed its check', rank: 1 },
}

export const KINDS = Object.keys(CHECKS) as AnomalyKind[]

const isKind = (k: string): k is AnomalyKind => (KINDS as string[]).includes(k)

/** A check's colour from the settings. */
export const colorOf = (kind: string, s: LensSettings): string => (isKind(kind) ? String(s[CHECKS[kind].color]) : '#c62828')

/** The worst of a list (highest rank, first on a tie), or null when empty. */
export function worstOf(list: readonly LensAnomaly[]): LensAnomaly | null {
  let best: LensAnomaly | null = null
  for (const a of list) if (best === null || (isKind(a.kind) ? CHECKS[a.kind].rank : 0) > (isKind(best.kind) ? CHECKS[best.kind].rank : 0)) best = a
  return best
}

/**
 * Only the checks the settings keep; none at all while `gateAlert` is off. One anomaly per key (a run read
 * twice counts once). A blocked step of a run that is itself reported blocked is dropped: the run's anomaly
 * names its blocked steps, so the step is not reported twice. With `anomalyRunBlocked` off, the steps still are.
 */
export function applySettings(list: readonly LensAnomaly[], s: LensSettings): LensAnomaly[] {
  if (s.gateAlert !== true) return []
  const kept = list.filter(a => isKind(a.kind) && s[CHECKS[a.kind].enable] === true)
  const blockedRuns = new Set(kept.filter(a => a.kind === 'runBlocked').map(a => a.run))
  const keys = new Set<string>()
  return kept.filter(a => {
    if (keys.has(a.key) || (a.kind === 'stepBlocked' && blockedRuns.has(a.run))) return false
    keys.add(a.key)
    return true
  })
}

/**
 * The detector's memory across passes: the keys reported so far keep their first-seen time; `appeared`
 * are the keys new in this pass, the only ones a toast names. A key whose cause is gone leaves the list,
 * so it is reported again only if it comes back.
 */
export function diffAnomalies(prev: readonly LensAnomaly[], next: readonly LensAnomaly[]): { list: LensAnomaly[]; appeared: LensAnomaly[] } {
  const seen = new Map(prev.map(a => [a.key, a]))
  const list = next.map(a => (seen.has(a.key) ? { ...a, since: seen.get(a.key)!.since } : a))
  return { list, appeared: list.filter(a => !seen.has(a.key)) }
}

/** One line for a toast or the list: words, run, step, record. */
export function anomalyLine(a: LensAnomaly): string {
  const label = isKind(a.kind) ? CHECKS[a.kind].label : a.kind
  const where = [a.run !== '' ? `run ${a.run.replace(/^.*\//, '')}` : '', a.step !== '' ? `step ${a.step}` : '', a.record !== '' ? a.record : ''].filter(x => x !== '').join(', ')
  return `${label}${where !== '' ? ` (${where})` : ''}${a.text !== '' ? `: ${a.text}` : ''}`
}

// ---- reading run.md and the records ----

/** The front matter's `key: value` lines; {} when there is none. */
export function frontMatter(text: string): Record<string, string> {
  const fm = /^﻿?---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1]
  const out: Record<string, string> = {}
  if (fm === undefined) return out
  for (const line of fm.split(/\r?\n/)) {
    const m = /^([A-Za-z][\w-]*):\s*(.*?)\s*$/.exec(line)
    if (m) out[m[1]!.toLowerCase()] = m[2]!.replace(/\s+#.*$/, '')
  }
  return out
}

/** The first non-blank line after the front matter. */
export function firstBodyLine(text: string): string {
  const body = text.replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
  return (body.split(/\r?\n/).find(l => l.trim() !== '') ?? '').trim()
}

const cells = (line: string): string[] =>
  line
    .split('|')
    .slice(1, -1)
    .map(x => x.trim().replace(/^`|`$/g, ''))
const RULE = /^\|\s*:?-{2,}/

/** The rows of the run's *Gates and loops* table (under that heading, or a table whose first header names a gate). */
export function gatesAndLoops(text: string): string[][] {
  const lines = text.split(/\r?\n/)
  const rows: string[][] = []
  let heading = ''
  let inTable = false
  lines.forEach((line, i) => {
    if (/^#{1,6}\s/.test(line)) heading = line
    if (!line.startsWith('|')) {
      inTable = false
      return
    }
    if (RULE.test(line)) return
    const c = cells(line)
    if (RULE.test(lines[i + 1] ?? '')) {
      inTable = /^#{1,6}\s+gates\s+and\s+loops\b/i.test(heading) || /^gate\b/i.test(c[0] ?? '')
      return
    }
    if (inTable && c.length >= 3) rows.push(c)
  })
  return rows
}

type StageCols = { step: number; stage: number; status: number; record: number; handoff: number; handback: number }

/**
 * The rows of the run's *Stages* table whose status is `blocked` (the status cell starts with it, after any
 * `**` or `_`): the step code, the stage, the record cell and what follows `blocked` in the status cell.
 * The table is the one under a *Stages* heading, or one whose header has a `Stage` column; its `Step`,
 * `Stage`, `Status` and `Record` columns are found by their headers (`Step` first and `Stage` second when
 * unnamed). A table with no `Status` column, and a row with no step code, are skipped; a step listed twice counts once.
 */
export function blockedSteps(text: string): { code: string; stage: string; record: string; detail: string }[] {
  const out: { code: string; stage: string; record: string; detail: string }[] = []
  const lines = text.split(/\r?\n/)
  let heading = ''
  let cols: StageCols | null = null
  lines.forEach((line, i) => {
    if (/^#{1,6}\s/.test(line)) heading = line
    if (!line.startsWith('|')) {
      cols = null
      return
    }
    if (RULE.test(line)) return
    const c = cells(line)
    if (RULE.test(lines[i + 1] ?? '')) {
      const at = (re: RegExp) => c.findIndex(x => re.test(x))
      const stage = at(/^stages?$/i)
      const status = at(/^status$/i)
      const step = at(/^step$/i)
      const isStages = /^#{1,6}\s+stages?\b/i.test(heading) || stage >= 0
      cols = isStages && status >= 0 ? { step: step >= 0 ? step : 0, stage: stage >= 0 ? stage : 1, status, record: at(/^record$/i), handoff: at(/^handoff$/i), handback: at(/^handback$/i) } : null
      return
    }
    const k = cols as StageCols | null
    if (k === null) return
    const code = (c[k.step] ?? '').replace(/[*_]/g, '').trim()
    const m = /^blocked\b(.*)$/i.exec((c[k.status] ?? '').replace(/^[*_\s]+/, ''))
    if (code === '' || m === null || out.some(x => x.code === code)) return
    out.push({
      code,
      stage: (c[k.stage] ?? '').replace(/[*_]/g, '').trim(),
      // A `Record` column, else the run-state template's `Handback`, then `Handoff` (handoff skill, *Run state*).
      record: cellOf(c, k.record) || cellOf(c, k.handback) || cellOf(c, k.handoff),
      detail: m[1]!.replace(/^[\s*_·:—–()-]+/, '').replace(/[\s*_)]+$/, '').slice(0, 120),
    })
  })
  return out
}

/** A Stages cell, '' for a missing column or a dash. */
const cellOf = (c: string[], i: number): string => (i >= 0 ? (c[i] ?? '').replace(/^[—–-]$/, '') : '')

const LOOP_ARROW = /→|->/
const REJECTED = /\b(rejected|not approved|declined|no-go|refused)\b/i
const APPROVED = /\b(approved|accepted)\b|^\s*go\s*$/i
const USED_UP = /\b(used up|out of rounds|limits? reached|exhausted)\b/i
const RESOLVED = /\b(raised|accepted|accept|approved)\b/i

/**
 * Addendum L1: whether a gate row neither approved nor rejected still waits for its decision. It does when its
 * decision cell is empty, a dash, or says it waits (`pending`, `waiting`, `open`, `tbd`, `todo`, `not yet`), or
 * when its Date cell is empty. A row the human decided in other words (`spike 027 rework first, then the scope
 * pass`, `changed`, `missed: …`), dated, is decided: the live run's four such rows were reported as gates waiting.
 */
export function gateUndecided(decision: string, date: string): boolean {
  const blank = (x: string) => /^[\s—–-]*$/.test(x.replace(/[*_`]/g, ''))
  return blank(decision) || /^(pending|waiting|open|tbd|to ?do|not yet)\b/i.test(decision.replace(/[*_`]/g, '').trim()) || blank(date)
}

/** A gate decision cell: approved, rejected or pending (empty, a dash, "waiting", anything else). */
export function gateDecision(cell: string): 'approved' | 'rejected' | 'pending' {
  if (REJECTED.test(cell)) return 'rejected'
  if (APPROVED.test(cell)) return 'approved'
  return 'pending'
}

/** A record's step code, its loop round, sender and receiver, and whether it is a handoff or a hand-back. */
export function recordName(name: string): { code: string; base: string; round: number; from: string; to: string; kind: 'handoff' | 'handback' } | null {
  const m = /^(\d+(?:\.\d+)*)(?:\.l(\d+))?-(.+?)-to-(.+)\.(handoff|handback)\.md$/.exec(name)
  if (!m) return null
  return { code: m[2] !== undefined ? `${m[1]}.l${m[2]}` : m[1]!, base: m[1]!, round: m[2] !== undefined ? Number(m[2]) : 0, from: m[3]!, to: m[4]!, kind: m[5] as 'handoff' | 'handback' }
}

/** Orders two step codes (`2.1` < `2.10` < `3`; `3` < `3.l1`). */
export function compareCodes(a: string, b: string): number {
  const parts = (c: string) => c.split('.').map(x => (x.startsWith('l') ? [1, Number(x.slice(1))] : [0, Number(x)]))
  const pa = parts(a)
  const pb = parts(b)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i]
    const y = pb[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const d = x[1]! - y[1]! || x[0]! - y[0]!
    if (d !== 0) return d
  }
  return 0
}

/** A hand-back that failed its check: `verification: failed…` in its front matter, or a first line `handoff <file>: failed`. */
export function handbackFailed(text: string): boolean {
  const v = frontMatter(text)['verification'] ?? ''
  return /^"?failed\b/i.test(v) || /^handoff\s+\S+?:\s*failed\b/i.test(firstBodyLine(text))
}

const make = (kind: AnomalyKind, key: string, run: string, step: string, record: string, text: string, now: number, agent = '', target = ''): LensAnomaly => ({
  key: `${kind}:${key}`,
  kind,
  run,
  step,
  record,
  agent,
  target,
  text,
  since: now,
})

/**
 * One run's anomalies: blocked, gates waiting or rejected, loops out of rounds, failed hand-backs.
 * `files`: the run folder's records as read (`text` null when it could not be read). A run that is
 * `done` or `abandoned` has none: its causes are gone. `skipped` names what could not be read.
 */
export function detectRun(dir: string, runText: string | null, files: readonly { name: string; text: string | null }[], now: number): { list: LensAnomaly[]; skipped: string[] } {
  const list: LensAnomaly[] = []
  const skipped: string[] = []
  if (runText === null) return { list, skipped }
  const fm = frontMatter(runText)
  if (Object.keys(fm).length === 0) skipped.push(`${dir}/run.md: no front matter`)
  const status = (fm['status'] ?? '').toLowerCase()
  if (status === 'done' || status === 'abandoned') return { list, skipped }
  const steps = blockedSteps(runText)
  const stepsText = steps.length === 0 ? '' : `blocked step${steps.length > 1 ? 's' : ''} ${steps.map(x => x.code).join(', ')}`
  if (status === 'blocked') list.push(make('runBlocked', dir, dir, fm['current-stage'] ?? '', fm['last-record'] ?? '', stepsText, now))
  // Step 1.6.1.l1: each blocked step, whatever the run's status (applySettings drops it when the run is reported blocked).
  for (const x of steps) list.push(make('stepBlocked', `${dir}:${x.code}`, dir, x.code, x.record, x.detail !== '' ? `${x.stage}: ${x.detail}` : x.stage, now))

  // Gates and loops: the last row of each gate or loop decides.
  const gates = new Map<string, { approver: string; decision: string; date: string }>()
  const loops = new Map<string, { round: string; decision: string }>()
  for (const r of gatesAndLoops(runText)) {
    const [name = '', second = '', decision = '', , date = ''] = r
    if (LOOP_ARROW.test(name)) {
      loops.set(name.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim(), { round: second, decision })
      continue
    }
    const id = /^(G\d+|release)\b/i.exec(name)?.[1] ?? (/^(human|orchestrator|none)$/i.test(second) ? name.split(/\s+/)[0] ?? '' : '')
    if (id !== '') gates.set(id.toLowerCase(), { approver: second.toLowerCase(), decision, date })
  }
  for (const [id, g] of gates) {
    const d = gateDecision(g.decision)
    const gate = id.toUpperCase().replace(/^RELEASE$/, 'release')
    if (d === 'rejected') list.push(make('gateRejected', `${dir}:${id}`, dir, gate, '', g.decision, now))
    else if (d === 'pending' && g.approver === 'human' && gateUndecided(g.decision, g.date)) list.push(make('gateWaiting', `${dir}:${id}`, dir, gate, '', '', now))
  }
  for (const [name, l] of loops)
    if (USED_UP.test(`${l.round} ${l.decision}`) && !RESOLVED.test(l.decision)) list.push(make('loopOutOfRounds', `${dir}:${name}`, dir, name, '', l.round, now))

  // The newest record addressed to the human: a gate waiting, unless its gate has a decision.
  const named = files.map(f => ({ f, r: recordName(f.name) })).filter((x): x is { f: (typeof files)[number]; r: NonNullable<ReturnType<typeof recordName>> } => x.r !== null)
  const newest = named.reduce<(typeof named)[number] | null>((m, x) => (m === null || compareCodes(x.r.code, m.r.code) > 0 ? x : m), null)
  if (newest !== null && newest.r.kind === 'handoff' && newest.r.to === 'human') {
    const gate = (newest.f.text === null ? '' : (frontMatter(newest.f.text)['gate'] ?? '')).trim()
    const id = gate !== '' && gate.toLowerCase() !== 'none' ? gate.toLowerCase() : ''
    const decided = id !== '' && gates.has(id) && gateDecision(gates.get(id)!.decision) !== 'pending'
    if (!decided && !list.some(a => a.key === `gateWaiting:${dir}:${id}`)) list.push(make('gateWaiting', `${dir}:${id || newest.f.name}`, dir, id !== '' ? gate : newest.r.code, newest.f.name, '', now))
  }

  // Hand-backs: only the newest round of each step and sender counts; a later round clears an earlier failure.
  const latest = new Map<string, (typeof named)[number]>()
  for (const x of named) {
    if (x.r.kind !== 'handback') continue
    const k = `${x.r.base}|${x.r.from}`
    const cur = latest.get(k)
    if (cur === undefined || x.r.round > cur.r.round) latest.set(k, x)
  }
  for (const x of latest.values()) {
    if (x.f.text === null) {
      skipped.push(`${dir}/${x.f.name}: not readable`)
      continue
    }
    if (handbackFailed(x.f.text)) list.push(make('handbackFailed', `${dir}/${x.f.name}`, dir, x.r.code, x.f.name, '', now, '', 'edge'))
  }
  return { list, skipped }
}

/**
 * The agents' anomalies: failed or stopped, killed, waiting too long (`waitingSince`: when each was first
 * seen waiting). A failed or killed agent clears once a later agent of its type is spawned for the same
 * run (or, with no run, by the same parent): the stage was run again.
 */
export function detectAgents(agents: Record<string, LensAgent>, waitingSince: Record<string, number>, now: number, waitingMinutes: number): LensAnomaly[] {
  const list: LensAnomaly[] = []
  const all = Object.values(agents)
  for (const a of all) {
    if (a.id === 'main') continue
    const run = runDirOf(a) ?? ''
    const rec = a.handoff ?? ''
    const record = rec.replace(/^.*\//, '')
    const step = recordName(record)?.code ?? ''
    const redone = () => all.some(b => b.id !== a.id && b.type === a.type && b.startedAt > a.startedAt && (run !== '' ? runDirOf(b) === run : b.parent === a.parent))
    if ((a.status === 'failed' || a.status === 'stopped') && !redone()) list.push(make('agentFailed', a.id, run, step, record, a.status, now, a.id, 'agent'))
    else if (a.status === 'killed' && !redone()) list.push(make('agentKilled', a.id, run, step, record, '', now, a.id, 'agent'))
    else if (isWaiting(a)) {
      const since = waitingSince[a.id]
      if (since !== undefined && now - since >= waitingMinutes * 60_000) list.push(make('agentWaitingLong', a.id, run, step, record, `waiting ${Math.floor((now - since) / 60_000)} min`, now, a.id, 'agent'))
    }
  }
  return list
}

/** Updates when each agent was first seen waiting: kept while it waits, dropped once it does not. */
export function trackWaiting(agents: Record<string, LensAgent>, prev: Record<string, number>, now: number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const a of Object.values(agents)) if (isWaiting(a)) out[a.id] = prev[a.id] ?? now
  return out
}

/**
 * The agent a failed hand-back's arrow belongs to: the one whose brief named the record with the same
 * step code and the agents swapped (`3-a-to-b.handback.md` -> `3-b-to-a.handoff.md`), in that run folder.
 */
export function edgeAgentOf(a: LensAnomaly, agents: Record<string, LensAgent>): string {
  const r = recordName(a.record)
  if (r === null) return ''
  const want = `${a.run}/${r.code}-${r.to}-to-${r.from}.handoff.md`
  return Object.values(agents).find(x => x.handoff === want)?.id ?? ''
}

/** The anomalies of one workflow: those of its runs and of its agents. */
export const anomaliesOf = (list: readonly LensAnomaly[], dirs: readonly string[], ids: readonly string[]): LensAnomaly[] =>
  list.filter(a => (a.run !== '' && dirs.includes(a.run)) || (a.agent !== '' && ids.includes(a.agent)))

// ---- step 1.6.1.l1: which runs are read (`anomalyRunScope`) ----

const DEFAULT_ROOT = { root: 'docs/handoffs', depth: 1 }

/** A folder path as the lens compares them: forward slashes, no leading `./`, no trailing `/`. */
export const normDir = (d: string): string => d.replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/\/+$/, '')

/**
 * Where the runs are: the part of `artifacts.handoffs` (from `.ai-dlc/workflow.json`) before its first
 * placeholder segment (`{...}` or `<...>`), and how many folder levels the placeholders take (default
 * `docs/handoffs`, 1 level). A missing, invalid or unusable value (a placeholder in the first segment, a
 * `..` segment, an absolute path, more than 3 placeholder levels) gives the default.
 */
export function handoffsRoot(workflowText: string | null): { root: string; depth: number } {
  if (workflowText === null) return DEFAULT_ROOT
  let v: unknown
  try {
    const json: unknown = JSON.parse(workflowText)
    const artifacts = json !== null && typeof json === 'object' ? (json as Record<string, unknown>)['artifacts'] : undefined
    v = artifacts !== null && typeof artifacts === 'object' ? (artifacts as Record<string, unknown>)['handoffs'] : undefined
  } catch {
    return DEFAULT_ROOT
  }
  if (typeof v !== 'string') return DEFAULT_ROOT
  const path = normDir(v.trim())
  if (path === '' || /^([A-Za-z]:)?\//.test(path)) return DEFAULT_ROOT
  const segs = path.split('/').filter(x => x !== '')
  if (segs.includes('..')) return DEFAULT_ROOT
  const first = segs.findIndex(x => /[{<]/.test(x))
  if (first === 0) return DEFAULT_ROOT
  if (first < 0) return { root: segs.join('/'), depth: 0 }
  const depth = segs.length - first
  return depth > 3 ? DEFAULT_ROOT : { root: segs.slice(0, first).join('/'), depth }
}

/**
 * The run folders a pass reads. `session`: the folders this session's briefs name. `all`: those, plus every
 * scanned folder whose run.md is `active` or `blocked` (`done`, `abandoned` and the rest are not read).
 * Each folder once: the session's as named, a scanned one only when no session folder normalises to it.
 */
export function runsToRead(scope: string, sessionDirs: readonly string[], scanned: readonly { dir: string; status: string }[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const d of sessionDirs) {
    const n = normDir(d)
    if (n === '' || seen.has(n)) continue
    seen.add(n)
    out.push(d)
  }
  if (scope === 'all')
    for (const x of scanned) {
      const d = normDir(x.dir)
      if (d === '' || seen.has(d) || !/^(active|blocked)$/i.test(x.status.trim())) continue
      seen.add(d)
      out.push(d)
    }
  return out
}
