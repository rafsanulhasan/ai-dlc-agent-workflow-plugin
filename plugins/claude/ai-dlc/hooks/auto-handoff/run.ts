// The ai-dlc side of a handoff: when the repository has an active AI-DLC run on the current branch,
// the automatic handoff writes the `handoff` skill's session handoff (skills/handoff/SKILL.md,
// "Session handoff") into the scratch folder and points the run's run.md at it, so the fresh session
// resumes the run from its run state. Engine-free, like config.ts: the host follows $ only into
// functions declared in register.tsx, so the file reads and git calls stay there.

import type { Facts } from './brief.ts'
import { factsBlock, hasUnansweredLastRequest } from './brief.ts'
import { renderTemplate } from './templates.ts'

/** One run.md, as the handoff skill's "Run state" template writes it. */
export type RunState = {
  /** The run id: the run folder's name. */
  id: string
  /** The run folder, relative to the repository root, with forward slashes. */
  folder: string
  status?: string
  branch?: string
  session?: string
  updated?: string
  lifecycle?: string
  stage?: string
  owner?: string
  lastRecord?: string
  /** The one-line summary after "# Run: <id> — ". */
  summary?: string
}

/** Where the session handoff goes and what the fresh session reads. */
export type RunTarget = RunState & {
  /** The repository root, absolute, with forward slashes. */
  root: string
  /** run.md, relative to the repository root. */
  runMd: string
  /** The session handoff, relative to the repository root unless the scratch root is absolute. */
  sessionHandoff: string
  branchName: string
  commit?: string
}

const DEFAULT_HANDOFFS = 'docs/handoffs'
const DEFAULT_SCRATCH = '.scratch'
/** Marks a Next action this module wrote, so a second handoff in a row does not nest the quote. */
export const AUTO_MARK = 'automatic context-limit handoff'
/** The leading sentence of a Next action withNextAction wrote. Matching the whole prefix, not just
 * AUTO_MARK, keeps an action that merely mentions the phrase from being taken for one. */
const WRITTEN_HERE = new RegExp(`^Continue (?:stage \`[^\`\\n]*\`|the current stage) from the session handoff \`[^\`\\n]*\` \\(${AUTO_MARK} from session `)

const lf = (text: string) => text.replace(/\r\n/g, '\n')
const trimSlashes = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '')

/** The folder that holds the run folders: artifacts.handoffs of .ai-dlc/workflow.json up to its
 * first placeholder segment, else docs/handoffs. A file that does not parse falls back too. */
export function handoffsRoot(workflowJson?: string): string {
  if (!workflowJson) return DEFAULT_HANDOFFS
  try {
    const value = (JSON.parse(workflowJson) as { artifacts?: { handoffs?: unknown } }).artifacts?.handoffs
    if (typeof value !== 'string' || !value.trim()) return DEFAULT_HANDOFFS
    const kept: string[] = []
    for (const seg of trimSlashes(value.trim()).split('/')) {
      if (seg.includes('{')) break
      // A `..` segment would let the run lookup leave the repository: use the default instead.
      if (seg === '..') return DEFAULT_HANDOFFS
      kept.push(seg)
    }
    const root = kept.join('/').replace(/^\.\//, '')
    return root || DEFAULT_HANDOFFS
  } catch {
    return DEFAULT_HANDOFFS
  }
}

/** The scratch root from the "Workspace folders" table of AGENTS.md (the `workspace-folders`
 * skill records it there), else .scratch. */
export function scratchRoot(agentsMd?: string): string {
  const m = agentsMd ? /^\|\s*Scratch\s*\|\s*`([^`]+)`/m.exec(lf(agentsMd)) : null
  return m?.[1]?.trim() ? trimSlashes(m[1].trim()) : DEFAULT_SCRATCH
}

export const isAbsolute = (p: string) => /^(\/|[A-Za-z]:[\\/])/.test(p)

/** Reads a run.md's front matter and title. Undefined when it has no front matter. */
export function parseRunState(text: string, folder: string): RunState | undefined {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(lf(text))
  if (!m) return undefined
  const fm: Record<string, string> = {}
  for (const line of m[1]!.split('\n')) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(line)
    // A value may carry a trailing "# comment", as in the template; drop it.
    if (kv) fm[kv[1]!] = kv[2]!.replace(/\s+#.*$/, '').trim()
  }
  const title = /^# Run: \S+ — (.+)$/m.exec(lf(text).slice(m[0].length))
  const id = folder.split('/').pop() ?? folder
  return {
    id: fm.run || id,
    folder,
    status: fm.status,
    branch: fm.branch,
    session: fm.session,
    updated: fm.updated,
    lifecycle: fm.lifecycle,
    stage: fm['current-stage'],
    owner: fm.owner,
    lastRecord: fm['last-record'],
    summary: title?.[1]?.trim(),
  }
}

/** The statuses that end a run's handoff chain. */
export const ENDED = new Set(['done', 'blocked', 'abandoned'])

/** The run this session hands off, among the `active` runs on the current branch:
 * 1. the run whose `session` is this session's id or one of its chain's earlier sessions (`lineage`,
 *    nearest first), or whose id is the run this chain claimed (`claimed`) while no session outside
 *    the chain has written it; the newest `updated` when there are several;
 * 2. else the only active run on the branch, when its `session` is empty (no session claimed it);
 * 3. else none, so the module seeds its plain brief. A run a session outside this chain wrote is
 * never taken, and neither is one of several unclaimed runs: two sessions never drive one run. A
 * `blocked` run waits for the human, so it is never picked.
 * A session seeded by a handoff matches through `lineage`: until the resumed orchestrator rewrites
 * run.md, its `session` still names an earlier session of the chain. */
export function pickRun(runs: readonly RunState[], branch: string, sessionId: string, lineage: readonly string[] = [], claimed?: string): RunState | undefined {
  const open = runs.filter(r => r.status === 'active' && r.branch === branch)
  const chain = new Set([sessionId, ...lineage].filter(Boolean))
  const own = open.filter(r => {
    const s = r.session?.trim() ?? ''
    return (s && chain.has(s)) || (claimed !== undefined && r.id === claimed && !s)
  })
  if (own.length) return [...own].sort((a, b) => (b.updated ?? '').localeCompare(a.updated ?? ''))[0]
  return open.length === 1 && !open[0]!.session?.trim() ? open[0] : undefined
}

/** One row of run.md's *Stages* table: its step code, its status and the record files it names. */
export type StageRow = { step: string; status: string; records: string[] }

const cells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
const norm = (h: string) => h.toLowerCase().replace(/[^a-z]/g, '')
const base = (p: string) => p.slice(p.lastIndexOf('/') + 1)
// A record file name in a cell: backticked or bare, with or without a folder.
const RECORD = /[^\s`|]*\.(?:handoff|handback)\.md/g

/** The rows of run.md's *Stages* table. Columns are found by their header (Step, Status, Handoff,
 * Handback / Hand-back), so a table with more or fewer columns still parses; no table, no rows. */
export function parseStages(runMd: string): StageRow[] {
  const text = lf(runMd)
  const heading = /^## Stages[ \t]*$/m.exec(text)
  if (!heading) return []
  const rest = text.slice(heading.index + heading[0].length)
  const end = /^## /m.exec(rest)
  const lines = (end ? rest.slice(0, end.index) : rest).split('\n').filter(l => l.trim().startsWith('|'))
  if (lines.length < 2) return []
  const head = cells(lines[0]!).map(norm)
  const at = (name: string) => head.indexOf(name)
  const step = at('step')
  const status = at('status')
  const recordCols = head.map((h, i) => h === 'handoff' || h === 'handback' ? i : -1).filter(i => i >= 0)
  if (status < 0) return []
  return lines.slice(2).map(line => {
    const c = cells(line)
    const records = recordCols.flatMap(i => (c[i] ?? '').match(RECORD) ?? [])
    return { step: step >= 0 ? (c[step] ?? '').replace(/`/g, '') : '', status: (c[status] ?? '').toLowerCase(), records }
  })
}

/** Whether a stage row is still open work: any status but done or skipped. */
export const isOpen = (row: StageRow) => !/^(done|skipped)\b/.test(row.status.trim())

/** The record a record answers or is answered by: same step code, agents swapped, handoff ↔ handback.
 * "3-orchestrator-to-x.handoff.md" → "3-x-to-orchestrator.handback.md". Undefined for another name. */
export function pairOf(record: string): string | undefined {
  const slash = record.lastIndexOf('/')
  const dir = record.slice(0, slash + 1)
  const m = /^(\d+(?:\.\d+)*(?:\.l\d+)?)-(.+?)-to-(.+)\.(handoff|handback)\.md$/.exec(record.slice(slash + 1))
  if (!m) return undefined
  return `${dir}${m[1]}-${m[3]}-to-${m[2]}.${m[4] === 'handoff' ? 'handback' : 'handoff'}.md`
}

/** A file the fresh session is told to read, relative to the repository root unless absolute. */
export type OpenRecord = { path: string; note: string }

/**
 * The files of the work that is not done, in reading order: run.md, the session handoff, then the
 * records of every *Stages* row whose status is not done or skipped. `last-record` and its pair come
 * first among the records when their stage is open. A record named by its file name alone lives in
 * the run folder. Done and skipped stages are left out: the fresh session needs only open work.
 */
export function openRecords(runMd: string, run: { folder: string; runMd: string; lastRecord?: string }, sessionHandoff: string): OpenRecord[] {
  const inFolder = (name: string) => name.includes('/') ? name : `${run.folder}/${name}`
  const out: OpenRecord[] = [{ path: run.runMd, note: 'run state' }, { path: sessionHandoff, note: 'this session handoff' }]
  const seen = new Set(out.map(r => r.path))
  const add = (name: string, note: string) => {
    const path = inFolder(name)
    if (seen.has(path)) return
    seen.add(path)
    out.push({ path, note })
  }
  const rows = parseStages(runMd)
  const last = run.lastRecord?.trim()
  if (last) {
    const pair = pairOf(last)
    const names = new Set([base(last), ...(pair ? [base(pair)] : [])])
    const row = rows.find(r => r.records.some(p => names.has(base(p))))
    if (row && isOpen(row)) {
      add(last, `last record, step ${row.step || stepOf(last) || '?'}, ${row.status || 'open'}`)
      if (pair) add(pair, 'its pair')
    }
  }
  for (const row of rows) if (isOpen(row)) for (const p of row.records) add(p, `step ${row.step || stepOf(p) || '?'}, ${row.status || 'open'}`)
  return out
}

/** The "Handoff records" section: each open file, `(missing)` after one that is not on disk. */
export function recordsSection(records: readonly (OpenRecord & { exists: boolean })[]): string {
  const lines = records.map(r => `- \`${r.path}\`${r.exists ? '' : ' (missing)'} — ${r.note}`)
  return `## Handoff records
The files of the work that is not done yet, listed in code from \`run.md\`'s *Stages* table: read them before the run state's *Next action*. Stages that are done or skipped are left out.

${lines.join('\n')}`
}

const pad = (n: number) => String(n).padStart(2, '0')
/** YYYY-MM-DD HH:MM, local time, as run.md writes `updated`. */
export const stamp = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
/** session-YYYYMMDD-HHMM.md, the skill's file name. */
export const sessionHandoffName = (d: Date) => `session-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.md`

/** The step code of a record file name: "3.l1-orchestrator-to-x.handoff.md" → "3.l1". */
export const stepOf = (record?: string) => record ? /^(\d+(?:\.\d+)*(?:\.l\d+)?)-/.exec(record)?.[1] : undefined

/** The session handoff's path: <scratch>/<run folder name>/session-<YYYYMMDD-HHMM>.md. */
export function sessionHandoffPath(scratch: string, run: RunState, at: Date): string {
  return `${trimSlashes(scratch)}/${run.folder.split('/').pop()}/${sessionHandoffName(at)}`
}

/** A path relative to the repository root made absolute; an absolute one is left alone. */
export const inRepo = (root: string, p: string) => isAbsolute(p) ? p : `${trimSlashes(root)}/${p}`

/**
 * run.md with its *Next action* pointing at the session handoff, and `updated` set. The action that
 * was there is quoted under the new one, so nothing the orchestrator planned is lost; when that
 * action was itself written here, its quote is carried over instead of nesting a second one.
 */
export function withNextAction(runMd: string, ctx: { stage?: string; sessionHandoff: string; oldSession: string; tokens: string; at: Date }): string {
  const crlf = runMd.includes('\r\n')
  let text = lf(runMd)
  text = text.replace(/^(updated:).*$/m, `$1 ${stamp(ctx.at)}`)
  const heading = /^## Next action[ \t]*\n/m.exec(text)
  const start = heading ? heading.index + heading[0].length : text.length
  const rest = text.slice(start)
  const next = /^## /m.exec(rest)
  const old = (next ? rest.slice(0, next.index) : rest).trim()
  const prior = WRITTEN_HERE.test(old)
    ? old.split('\n').filter(l => l.startsWith('>')).map(l => l.replace(/^> ?/, '')).join('\n').trim()
    : old
  const stage = ctx.stage ? `stage \`${ctx.stage}\`` : 'the current stage'
  const action = [
    `Continue ${stage} from the session handoff \`${ctx.sessionHandoff}\` (${AUTO_MARK} from session ${ctx.oldSession.slice(0, 8)} at ${ctx.tokens}, ${stamp(ctx.at)}). Then carry on with the next action recorded before the handoff:`,
    '',
    ...(prior ? prior.split('\n').map(l => l ? `> ${l}` : '>') : ['> (none recorded)']),
  ].join('\n')
  const body = `${action}\n${next ? '\n' : ''}`
  const out = heading
    ? text.slice(0, start) + body + (next ? rest.slice(next.index) : '')
    : `${text.replace(/\n*$/, '\n')}\n## Next action\n${body}`
  return crlf ? out.replace(/\n/g, '\r\n') : out
}

/**
 * The handoff skill's session handoff, filled by the automatic path: the header lines from the run
 * state and git, the fresh session's instructions, then the sections Haiku wrote from the session
 * handoff template (or, when Haiku failed, the facts alone), then the facts extracted in code.
 */
export function assembleSessionHandoff(ctx: { run: RunTarget; sessionId: string; transcript: string; instructions: string; tokens: string; records?: readonly (OpenRecord & { exists: boolean })[] }, facts: Facts, haiku: string | undefined): string {
  const { run } = ctx
  const instructions = renderTemplate(ctx.instructions, { priority: haiku ? hasUnansweredLastRequest(haiku) : false })
  const step = stepOf(run.lastRecord)
  const header = `# Session handoff: ${run.id} — ${run.summary ?? 'continue the run'}

- Run state: \`${run.runMd}\`
- Lifecycle / stage / step: ${run.lifecycle ?? 'unknown'} / ${run.stage ?? 'unknown'} / ${step ?? 'unknown'}, agent \`${run.owner ?? 'orchestrator'}\`
- Branch and last commit: ${run.branchName} @ ${run.commit ?? 'unknown'}
- Next session focus: resume the run where the previous session stopped (${AUTO_MARK} at ${ctx.tokens})
- Previous session: ${ctx.sessionId} · transcript \`${ctx.transcript}\`

${instructions}

## Resume the run
This session continues run \`${run.id}\`. Resume it from its run state \`${run.runMd}\` as the \`handoff\` skill describes (*Run state*, Resuming): re-verify its \`last-record\`, and for a stage left \`in-progress\` check whether that agent's output landed before handing off again. Its *Next action* points to this file and quotes the action planned before the handoff.
${ctx.records?.length ? `\n${recordsSection(ctx.records)}\n` : ''}
## How to Use This Brief
${haiku ? 'Haiku wrote the sections below from the conversation, with tool output abbreviated. The facts sections came from tool calls in code.' : 'Haiku did not return a usable summary, so this holds only facts extracted in code. Read the transcript for the rest.'} Treat every line as a starting point, not a fact: check it against the run state, the records and \`git status\` before acting on it.`
  return [header, haiku?.trim(), factsBlock(facts, !haiku)].filter(Boolean).join('\n\n')
}
