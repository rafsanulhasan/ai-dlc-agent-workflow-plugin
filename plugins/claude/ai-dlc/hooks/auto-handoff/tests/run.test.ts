import { describe, expect, test } from 'claude-code/testing'
import { AUTO_MARK, assembleSessionHandoff, currentRunStateFile, handoffsRoot, inRepo, isOpen, openInRow, openRecords, pairOf, passOf, parseRunState, parseStages, pickRun, recordsSection, runStateNote, scratchRoot, sessionHandoffName, sessionHandoffPath, stepOf, withNextAction } from '../run.ts'
import type { RunState, RunTarget } from '../run.ts'

const RUN = `---
run: AAW-20261021-demo
status: active   # active | blocked | done | abandoned
lifecycle: AAW
current-stage: change
owner: orchestrator
session: s-1
branch: feat/x
last-record: 2.l1-orchestrator-to-agent-manager.handoff.md
updated: 2026-10-21 11:10
---

# Run: AAW-20261021-demo — absorb the demo mod

## Next action
Spawn agent-manager.

## Notes
- kept
`
const AT = new Date(2026, 9, 21, 9, 5)

describe('run state', () => {
  test('handoffsRoot cuts artifacts.handoffs at its first placeholder, else docs/handoffs', () => {
    expect(handoffsRoot(JSON.stringify({ artifacts: { handoffs: 'docs/handoffs/{LIFECYCLE}-{YYYYMMDD}-{feature-slug}/' } }))).toBe('docs/handoffs')
    expect(handoffsRoot(JSON.stringify({ artifacts: { handoffs: './records/{LIFECYCLE}/x/' } }))).toBe('records')
    expect(handoffsRoot(JSON.stringify({ artifacts: {} }))).toBe('docs/handoffs')
    expect(handoffsRoot('{ not json')).toBe('docs/handoffs')
    expect(handoffsRoot(undefined)).toBe('docs/handoffs')
  })

  test('scratchRoot reads the Scratch row of AGENTS.md, else .scratch', () => {
    expect(scratchRoot('| Scratch | `tmp/work/` | session or task |')).toBe('tmp/work')
    expect(scratchRoot('| Scratch | `D:\\scratch` | x |')).toBe('D:/scratch')
    expect(scratchRoot('no table here')).toBe('.scratch')
    expect(scratchRoot(undefined)).toBe('.scratch')
  })

  test('parseRunState reads the front matter, drops trailing comments, and takes the title summary', () => {
    const r = parseRunState(RUN.replace(/\n/g, '\r\n'), 'docs/handoffs/AAW-20261021-demo')!
    expect(r.id).toBe('AAW-20261021-demo')
    expect(r.status).toBe('active')
    expect(r.stage).toBe('change')
    expect(r.lastRecord).toBe('2.l1-orchestrator-to-agent-manager.handoff.md')
    expect(r.summary).toBe('absorb the demo mod')
    expect(parseRunState('# no front matter', 'x')).toBeUndefined()
  })

  test('pickRun takes this session\'s active run on the branch first, the newest of several', () => {
    const run = (o: Partial<RunState>): RunState => ({ id: 'r', folder: 'f', status: 'active', branch: 'b', ...o })
    const runs = [run({ id: 'old-mine', session: 's', updated: '2026-10-20 10:00' }), run({ id: 'new-mine', session: 's', updated: '2026-10-21 10:00' }), run({ id: 'newest', updated: '2026-10-22 10:00' }), run({ id: 'blocked', status: 'blocked', session: 's', updated: '2026-10-23 10:00' }), run({ id: 'other', branch: 'main', session: 's' })]
    expect(pickRun(runs, 'b', 's')?.id).toBe('new-mine')
    expect(pickRun(runs, 'c', 's')).toBeUndefined()
  })

  test('pickRun without a run of its own takes only the single unclaimed active run on the branch', () => {
    const run = (o: Partial<RunState>): RunState => ({ id: 'r', folder: 'f', status: 'active', branch: 'b', ...o })
    // One unclaimed run: it is taken, whether `session` is missing or blank.
    expect(pickRun([run({ id: 'free' })], 'b', 's')?.id).toBe('free')
    expect(pickRun([run({ id: 'free', session: '  ' })], 'b', 's')?.id).toBe('free')
    // One run claimed by another session: none.
    expect(pickRun([run({ id: 'theirs', session: 'other' })], 'b', 's')).toBeUndefined()
    // Two active runs from other sessions: none, newest or not.
    expect(pickRun([run({ id: 'a', session: 'x', updated: '2026-10-20 10:00' }), run({ id: 'b', session: 'y', updated: '2026-10-22 10:00' })], 'b', 's')).toBeUndefined()
    // Two unclaimed runs, or one unclaimed beside another session's: ambiguous, so none.
    expect(pickRun([run({ id: 'a' }), run({ id: 'b' })], 'b', 's')).toBeUndefined()
    expect(pickRun([run({ id: 'free' }), run({ id: 'theirs', session: 'x' })], 'b', 's')).toBeUndefined()
    // A blocked or other-branch run does not count against the single unclaimed one.
    expect(pickRun([run({ id: 'free' }), run({ id: 'wait', status: 'blocked' }), run({ id: 'away', branch: 'main' })], 'b', 's')?.id).toBe('free')
    // An empty session id never matches an empty `session`, it only reaches the unclaimed rule.
    expect(pickRun([run({ id: 'a', session: '' }), run({ id: 'b', session: '' })], 'b', '')).toBeUndefined()
  })

  test('the session handoff is named and placed as the handoff skill says', () => {
    expect(sessionHandoffName(AT)).toBe('session-20261021-0905.md')
    expect(sessionHandoffPath('.scratch/', { id: 'ignored', folder: 'docs/handoffs/AAW-1-x' }, AT)).toBe('.scratch/AAW-1-x/session-20261021-0905.md')
    expect(inRepo('/r', '.scratch/a.md')).toBe('/r/.scratch/a.md')
    expect(inRepo('/r', 'C:/s/a.md')).toBe('C:/s/a.md')
  })

  test('stepOf reads the step code of a record name', () => {
    expect(stepOf('3-orchestrator-to-x.handoff.md')).toBe('3')
    expect(stepOf('4.1.l2-orchestrator-to-x.handoff.md')).toBe('4.1.l2')
    expect(stepOf(undefined)).toBeUndefined()
  })

  test('withNextAction replaces only the Next action section, quotes the old action and sets updated', () => {
    const out = withNextAction(RUN, { stage: 'change', sessionHandoff: '.scratch/AAW-20261021-demo/session-20261021-0905.md', oldSession: 'abcdef123456', tokens: '165k', at: AT })
    expect(out).toContain('updated: 2026-10-21 09:05')
    expect(out).toContain(`Continue stage \`change\` from the session handoff \`.scratch/AAW-20261021-demo/session-20261021-0905.md\` (${AUTO_MARK} from session abcdef12 at 165k, 2026-10-21 09:05).`)
    expect(out).toContain('> Spawn agent-manager.')
    expect(out).not.toMatch(/^Spawn agent-manager\.$/m)
    expect(out).toContain('## Notes\n- kept\n')
  })

  test('a second handoff in a row carries the first quote over instead of nesting it', () => {
    const once = withNextAction(RUN, { stage: 'change', sessionHandoff: 'a.md', oldSession: 's1', tokens: '1k', at: AT })
    const twice = withNextAction(once, { stage: 'change', sessionHandoff: 'b.md', oldSession: 's2', tokens: '2k', at: AT })
    expect(twice).toContain('from the session handoff `b.md`')
    expect(twice).not.toContain('`a.md`')
    expect(twice).toContain('> Spawn agent-manager.')
    expect(twice).not.toContain('> >')
  })

  test('CRLF run.md stays CRLF, and a run.md without the section gets one', () => {
    const crlf = withNextAction(RUN.replace(/\n/g, '\r\n'), { sessionHandoff: 'a.md', oldSession: 's', tokens: '1k', at: AT })
    expect(crlf.replace(/\r\n/g, '')).not.toContain('\n')
    const added = withNextAction('---\nupdated: x\n---\n\n# Run: r — s\n', { sessionHandoff: 'a.md', oldSession: 's', tokens: '1k', at: AT })
    expect(added).toContain('\n## Next action\nContinue the current stage from the session handoff `a.md`')
    expect(added).toContain('> (none recorded)')
  })
})

describe('assembleSessionHandoff', () => {
  const target: RunTarget = {
    id: 'AAW-1-demo', folder: 'docs/handoffs/AAW-1-demo', root: '/r', runState: 'docs/handoffs/AAW-1-demo/run.md',
    sessionHandoff: '.scratch/AAW-1-demo/session-20261021-0905.md', branchName: 'feat/x', commit: 'abc1234',
    lifecycle: 'AAW', stage: 'change', owner: 'agent-manager', lastRecord: '2.l1-orchestrator-to-agent-manager.handoff.md', summary: 'absorb the demo mod',
  }
  const instructions = '{{#priority}}PRIORITY-LINE{{/priority}}{{^priority}}CALM-LINE{{/priority}}'
  const ctx = { run: target, sessionId: 'sess-9', transcript: '/t/x.jsonl', instructions, tokens: '165k' }
  const facts = { filesModified: ['a.ts'], commits: [], issues: [] }

  test('the header carries the run, lifecycle/stage/step, branch and commit, session and transcript', () => {
    const out = assembleSessionHandoff(ctx, facts, '## In progress\nWork.')
    expect(out).toContain('# Session handoff: AAW-1-demo — absorb the demo mod')
    expect(out).toContain('- Run state: `docs/handoffs/AAW-1-demo/run.md`')
    expect(out).toContain('- Lifecycle / stage / step: AAW / change / 2.l1, agent `agent-manager`')
    expect(out).toContain('- Branch and last commit: feat/x @ abc1234')
    expect(out).toContain('- Previous session: sess-9 · transcript `/t/x.jsonl`')
    expect(out).toContain('## Resume the run')
    expect(out).toContain('## In progress\nWork.')
    expect(out).toContain('## Files Modified (from Edit/Write calls)')
    expect(out).toContain('Haiku wrote the sections below')
  })

  test('without Haiku text only facts follow, with the last user message, and the header says so', () => {
    const out = assembleSessionHandoff(ctx, { ...facts, lastUserMessage: 'do the thing' }, undefined)
    expect(out).toContain('Haiku did not return a usable summary')
    expect(out).toContain('## Last Real User Message (verbatim)\ndo the thing')
    expect(out).toContain('CALM-LINE')
    expect(out).not.toContain('PRIORITY-LINE')
  })

  test('with Haiku text the last message is not repeated, and an unanswered request turns on PRIORITY', () => {
    const haiku = '## Last Request from the User\nFix it.\nStatus: Not answered'
    const out = assembleSessionHandoff(ctx, { ...facts, lastUserMessage: 'fix it' }, haiku)
    expect(out).toContain('PRIORITY-LINE')
    expect(out).not.toContain('CALM-LINE')
    expect(out).not.toContain('## Last Real User Message')
  })

  test('missing run fields fall back to unknown / orchestrator / continue the run', () => {
    const bare: RunTarget = { id: 'r', folder: 'f', root: '/r', runState: 'f/run.md', sessionHandoff: 's.md', branchName: 'b' }
    const out = assembleSessionHandoff({ ...ctx, run: bare }, facts, undefined)
    expect(out).toContain('# Session handoff: r — continue the run')
    expect(out).toContain('unknown / unknown / unknown, agent `orchestrator`')
    expect(out).toContain('b @ unknown')
  })
})

describe('run state edge cases', () => {
  test('parseRunState: the front matter run id wins over the folder name; no title leaves summary undefined', () => {
    const r = parseRunState('---\nrun: X-1\nstatus: done\n---\n\nbody\n', 'docs/handoffs/other')!
    expect(r.id).toBe('X-1')
    expect(r.summary).toBeUndefined()
    expect(parseRunState('---\nstatus: done\n---\n', 'docs/handoffs/folder-name')!.id).toBe('folder-name')
  })

  test('handoffsRoot: a non-string, blank or all-placeholder value falls back; backslashes are normalised', () => {
    expect(handoffsRoot(JSON.stringify({ artifacts: { handoffs: 42 } }))).toBe('docs/handoffs')
    expect(handoffsRoot(JSON.stringify({ artifacts: { handoffs: '   ' } }))).toBe('docs/handoffs')
    expect(handoffsRoot(JSON.stringify({ artifacts: { handoffs: '{LIFECYCLE}/x' } }))).toBe('docs/handoffs')
    expect(handoffsRoot(JSON.stringify({ artifacts: { handoffs: 'a\\b\\{X}' } }))).toBe('a/b')
  })

  test('handoffsRoot: a `..` segment before the first placeholder falls back to docs/handoffs', () => {
    expect(handoffsRoot(JSON.stringify({ artifacts: { handoffs: '../outside/{LIFECYCLE}/' } }))).toBe('docs/handoffs')
    expect(handoffsRoot(JSON.stringify({ artifacts: { handoffs: 'docs/../../x/{LIFECYCLE}/' } }))).toBe('docs/handoffs')
    expect(handoffsRoot(JSON.stringify({ artifacts: { handoffs: 'docs/..handoffs/{LIFECYCLE}/' } }))).toBe('docs/..handoffs')
  })

  test('withNextAction: a final Next action with no trailing newline is replaced and the old text quoted', () => {
    const tail = '---\nupdated: x\n---\n\n# Run: r — s\n\n## Next action\nOld.'
    const out = withNextAction(tail, { sessionHandoff: 'a.md', oldSession: 's', tokens: '1k', at: AT })
    expect(out).toContain('> Old.')
    expect(out).not.toMatch(/^Old\.$/m)
    expect(out.match(/## Next action/g)?.length).toBe(1)
  })

  test('withNextAction: a CRLF run.md round-trips to the same result as its LF form, in CRLF', () => {
    const ctx = { stage: 'change', sessionHandoff: 'a.md', oldSession: 's', tokens: '1k', at: AT }
    const lfOut = withNextAction(RUN, ctx)
    const crlfOut = withNextAction(RUN.replace(/\n/g, '\r\n'), ctx)
    expect(crlfOut).toBe(lfOut.replace(/\n/g, '\r\n'))
    // A second handoff on the CRLF file still recognises the first one and does not nest the quote.
    const twice = withNextAction(crlfOut, { ...ctx, sessionHandoff: 'b.md' })
    expect(twice).toBe(withNextAction(lfOut, { ...ctx, sessionHandoff: 'b.md' }).replace(/\n/g, '\r\n'))
    expect(twice).not.toContain('> >')
  })

  test('withNextAction: an action that only mentions the marker phrase is quoted whole, not taken for one written here', () => {
    const mention = RUN.replace('Spawn agent-manager.', `Ask about the ${AUTO_MARK} wording.\n> keep this quote`)
    const out = withNextAction(mention, { sessionHandoff: 'a.md', oldSession: 's', tokens: '1k', at: AT })
    expect(out).toContain(`> Ask about the ${AUTO_MARK} wording.`)
    expect(out).toContain('> > keep this quote')
  })

  test('pickRun: done and abandoned runs are never picked', () => {
    const run = (o: Partial<RunState>): RunState => ({ id: 'r', folder: 'f', branch: 'b', ...o })
    expect(pickRun([run({ status: 'done' }), run({ status: 'abandoned' })], 'b', 's')).toBeUndefined()
    expect(pickRun([], 'b', 's')).toBeUndefined()
  })

  test('withNextAction: a second handoff with no stage name still recognises the first (the current stage form)', () => {
    const ctx = { sessionHandoff: 'a.md', oldSession: 's', tokens: '1k', at: AT }
    const once = withNextAction(RUN, ctx)
    expect(once).toContain('Continue the current stage from the session handoff')
    const twice = withNextAction(once, { ...ctx, sessionHandoff: 'b.md' })
    expect(twice).toContain('`b.md`')
    expect(twice).not.toContain('`a.md`')
    expect(twice).toContain('> Spawn agent-manager.')
    expect(twice).not.toContain('> >')
  })

  test('withNextAction: an empty Next action section followed by another quotes (none recorded) and keeps the next section', () => {
    const empty = '---\nupdated: x\n---\n\n# Run: r — s\n\n## Next action\n\n## Notes\n- kept\n'
    const out = withNextAction(empty, { sessionHandoff: 'a.md', oldSession: 's', tokens: '1k', at: AT })
    expect(out).toContain('> (none recorded)')
    expect(out).toContain('## Notes\n- kept\n')
    expect(out.match(/## Next action/g)?.length).toBe(1)
  })

  test('handoffsRoot: a backslash-separated `..` segment falls back to docs/handoffs too', () => {
    expect(handoffsRoot(JSON.stringify({ artifacts: { handoffs: 'docs\\..\\x\\{LIFECYCLE}' } }))).toBe('docs/handoffs')
  })

  test('withNextAction: a Next action at the end of the file is replaced once and the old text quoted', () => {
    const tail = '---\nupdated: x\n---\n\n# Run: r — s\n\n## Next action\nOld.\n'
    const out = withNextAction(tail, { sessionHandoff: 'a.md', oldSession: 'abcdefghijkl', tokens: '1k', at: AT })
    expect(out).toContain('> Old.')
    expect(out.match(/## Next action/g)?.length).toBe(1)
    expect(out).toContain('from session abcdefgh at 1k')
  })
})

describe('chained sessions', () => {
  const run = (o: Partial<RunState>): RunState => ({ id: 'r', folder: 'f', status: 'active', branch: 'b', ...o })

  test('pickRun follows the lineage: a run written by an earlier session of the chain is this session\'s', () => {
    const runs = [run({ id: 'mine', session: 'first' })]
    expect(pickRun(runs, 'b', 'third', ['second', 'first'])?.id).toBe('mine')
    expect(pickRun(runs, 'b', 'third', ['second'])).toBeUndefined()
    expect(pickRun(runs, 'b', 'third')).toBeUndefined()
  })

  test('pickRun takes the claimed run among several unclaimed ones, never one another session wrote', () => {
    const runs = [run({ id: 'a' }), run({ id: 'b' })]
    expect(pickRun(runs, 'b', 's', [], 'b')?.id).toBe('b')
    expect(pickRun(runs, 'b', 's')).toBeUndefined()
    expect(pickRun([run({ id: 'b', session: 'someone-else' })], 'b', 's', ['first'], 'b')).toBeUndefined()
    expect(pickRun([run({ id: 'b', status: 'done' })], 'b', 's', [], 'b')).toBeUndefined()
  })
})

const STAGES_MD = `---
run: AAW-1
last-record: 2-orchestrator-to-agent-manager.handoff.md
---

## Stages
| Step | Stage | Owner | Status | Handoff | Hand-back |
|---|---|---|---|---|---|
| 1 | research | research-assistant | done (passed) | \`1-orchestrator-to-research-assistant.handoff.md\` | \`1-research-assistant-to-orchestrator.handback.md\` |
| 2 | change | agent-manager | in-progress | \`2-orchestrator-to-agent-manager.handoff.md\` | — |
| 3.x | review | brutal-critique · sqa-engineer | pending | \`3.1-orchestrator-to-brutal-critique.handoff.md\`, \`3.2-orchestrator-to-sqa-engineer.handoff.md\` | — |
| 4 | gate | human | blocked | \`other/4-orchestrator-to-human.handoff.md\` | — |
| 5 | spike | research-assistant | skipped | \`5-orchestrator-to-research-assistant.handoff.md\` | — |

## Next action
Go.
`

describe('handoff records', () => {
  test('parseStages finds the columns by header and reads every record in a cell', () => {
    const rows = parseStages(STAGES_MD)
    expect(rows.map(r => r.step)).toEqual(['1', '2', '3.x', '4', '5'])
    expect(rows[0]!.records).toEqual(['1-orchestrator-to-research-assistant.handoff.md', '1-research-assistant-to-orchestrator.handback.md'])
    expect(rows[2]!.records).toEqual(['3.1-orchestrator-to-brutal-critique.handoff.md', '3.2-orchestrator-to-sqa-engineer.handoff.md'])
    expect(rows.map(isOpen)).toEqual([false, true, true, true, false])
  })

  test('parseStages: no Stages table, or one without a Status column, gives no rows', () => {
    expect(parseStages('# Run\n\n## Next action\nGo.\n')).toEqual([])
    expect(parseStages('## Stages\n| Step | Stage |\n|---|---|\n| 1 | x |\n')).toEqual([])
    expect(parseStages(STAGES_MD.replace(/\n/g, '\r\n')).length).toBe(5)
  })

  test('pairOf swaps the agents and the record kind, keeping the step code and folder', () => {
    expect(pairOf('2-orchestrator-to-agent-manager.handoff.md')).toBe('2-agent-manager-to-orchestrator.handback.md')
    expect(pairOf('3.1.l2-agent-manager-to-orchestrator.handback.md')).toBe('3.1.l2-orchestrator-to-agent-manager.handoff.md')
    expect(pairOf('docs/x/4-a-to-b.handoff.md')).toBe('docs/x/4-b-to-a.handback.md')
    expect(pairOf('run.md')).toBeUndefined()
  })

  test('openRecords lists run.md, the session handoff, then last-record and its pair, then the other open stages', () => {
    const out = openRecords(STAGES_MD, { folder: 'docs/handoffs/AAW-1', runState: 'docs/handoffs/AAW-1/run.md', lastRecord: '2-orchestrator-to-agent-manager.handoff.md' }, '.scratch/AAW-1/session-1.md')
    expect(out.map(r => r.path)).toEqual([
      'docs/handoffs/AAW-1/run.md',
      '.scratch/AAW-1/session-1.md',
      'docs/handoffs/AAW-1/2-orchestrator-to-agent-manager.handoff.md',
      'docs/handoffs/AAW-1/2-agent-manager-to-orchestrator.handback.md',
      'docs/handoffs/AAW-1/3.1-orchestrator-to-brutal-critique.handoff.md',
      'docs/handoffs/AAW-1/3.2-orchestrator-to-sqa-engineer.handoff.md',
      'other/4-orchestrator-to-human.handoff.md',
    ])
    expect(out[2]!.note).toBe('last record, step 2, in-progress')
    expect(out[3]!.note).toBe('its pair')
  })

  test('openRecords leaves last-record out when its stage is done', () => {
    const md = STAGES_MD.replace('last-record: 2-orchestrator-to-agent-manager.handoff.md', 'last-record: 1-research-assistant-to-orchestrator.handback.md')
    const out = openRecords(md, { folder: 'f', runState: 'f/run.md', lastRecord: '1-research-assistant-to-orchestrator.handback.md' }, 's.md')
    expect(out.some(r => r.path.includes('research-assistant'))).toBe(false)
    expect(out[2]!.path).toBe('f/2-orchestrator-to-agent-manager.handoff.md')
  })

  test('openRecords matches last-record by its whole file name, not a suffix', () => {
    const md = STAGES_MD.replace('`2-orchestrator-to-agent-manager.handoff.md`', '`12-orchestrator-to-agent-manager.handoff.md`')
    const out = openRecords(md, { folder: 'f', runState: 'f/run.md', lastRecord: '2-orchestrator-to-agent-manager.handoff.md' }, 's.md')
    expect(out.some(r => r.note.startsWith('last record'))).toBe(false)
  })

  test('recordsSection marks the missing ones', () => {
    const text = recordsSection([{ path: 'a.md', note: 'run state', exists: true }, { path: 'b.md', note: 'its pair', exists: false }], 'f/run.v2.md')
    expect(text.startsWith('## Handoff records\n')).toBe(true)
    expect(text).toContain('from the *Stages* table of `f/run.v2.md`')
    expect(text).not.toContain('`run.md`')
    expect(text).toContain('- `a.md` — run state')
    expect(text).toContain('- `b.md` (missing) — its pair')
  })
})

describe('currentRunStateFile', () => {
  test('the highest run.v<N>.md wins, compared as numbers', () => {
    expect(currentRunStateFile(['run.v1.md', 'run.v2.md'])).toBe('run.v2.md')
    expect(currentRunStateFile(['run.v9.md', 'run.v10.md', 'run.v2.md'])).toBe('run.v10.md')
    expect(currentRunStateFile(['run.v10.md', 'run.v9.md'])).toBe('run.v10.md')
  })

  test('a folder from before versions gives its run.md', () => {
    expect(currentRunStateFile(['run.md', '1.1-orchestrator-to-agent-manager.handoff.md'])).toBe('run.md')
  })

  test('a version wins over a stray run.md, and other names are ignored', () => {
    expect(currentRunStateFile(['run.md', 'run.v1.md'])).toBe('run.v1.md')
    expect(currentRunStateFile(['run.vx.md', 'run.v.md', 'run.v2.md.bak', 'myrun.v3.md', 'run.V4.md'])).toBeUndefined()
  })

  test('a real version among near-names is still found, wherever it sits in the list', () => {
    const near = ['run.v3.md.bak', 'run.V9.md', 'xrun.v8.md', 'run.v7.md~', 'run.v.md', 'run.v1.md ', 'run.md']
    expect(currentRunStateFile([...near, 'run.v2.md'])).toBe('run.v2.md')
    expect(currentRunStateFile(['run.v2.md', ...near])).toBe('run.v2.md')
  })

  test('a minor pair: run.v1.2.md over run.v1.1.md over run.v1.md, in any order', () => {
    expect(currentRunStateFile(['run.v1.md', 'run.v1.1.md'])).toBe('run.v1.1.md')
    expect(currentRunStateFile(['run.v1.1.md', 'run.v1.md'])).toBe('run.v1.1.md')
    expect(currentRunStateFile(['run.v1.md', 'run.v1.1.md', 'run.v1.2.md'])).toBe('run.v1.2.md')
    expect(currentRunStateFile(['run.v1.2.md', 'run.v1.1.md', 'run.v1.md'])).toBe('run.v1.2.md')
  })

  test('a newer major beats every minor of an older one: run.v2.md over run.v1.9.md', () => {
    expect(currentRunStateFile(['run.v1.9.md', 'run.v2.md'])).toBe('run.v2.md')
    expect(currentRunStateFile(['run.v2.md', 'run.v1.9.md', 'run.v1.md'])).toBe('run.v2.md')
    expect(currentRunStateFile(['run.v1.1.md', 'run.v1.2.md', 'run.v2.md', 'run.v1.md'])).toBe('run.v2.md')
    // A minor of the newer major beats its bare major.
    expect(currentRunStateFile(['run.v2.md', 'run.v1.9.md', 'run.v2.1.md'])).toBe('run.v2.1.md')
  })

  test('minors compare as numbers, not text: run.v1.10.md over run.v1.9.md', () => {
    expect(currentRunStateFile(['run.v1.9.md', 'run.v1.10.md'])).toBe('run.v1.10.md')
    expect(currentRunStateFile(['run.v1.10.md', 'run.v1.9.md', 'run.v1.2.md'])).toBe('run.v1.10.md')
    expect(currentRunStateFile(['run.v9.9.md', 'run.v10.md'])).toBe('run.v10.md')
  })

  test('a minor version wins over a stray run.md', () => {
    expect(currentRunStateFile(['run.md', 'run.v1.1.md'])).toBe('run.v1.1.md')
  })

  test('near-names of a minor version are not run states', () => {
    const near = ['run.v1.md.bak', 'run.v1..2.md', 'run.v1.2.3.md', 'run.v1.md.md', 'run.v1.2.md.bak', 'run.v.1.md', 'run.v1.x.md', 'run.v1.-1.md', 'run.v1.2.MD']
    expect(currentRunStateFile(near)).toBeUndefined()
    expect(currentRunStateFile([...near, 'run.v1.1.md'])).toBe('run.v1.1.md')
    expect(currentRunStateFile(['run.v1.1.md', ...near])).toBe('run.v1.1.md')
  })

  test('versions start at 1 with no leading zero: v0, v01, v1.0 and v1.01 are not run states', () => {
    const zero = ['run.v0.md', 'run.v01.md', 'run.v00.md', 'run.v1.0.md', 'run.v1.01.md', 'run.v0.1.md', 'run.v02.1.md']
    expect(currentRunStateFile(zero)).toBeUndefined()
    // A real version beside them is found, and a zero-padded name can never outrank or tie it.
    expect(currentRunStateFile([...zero, 'run.v1.md'])).toBe('run.v1.md')
    expect(currentRunStateFile(['run.v01.md', 'run.v1.md'])).toBe('run.v1.md')
    expect(currentRunStateFile(['run.v1.md', 'run.v1.01.md'])).toBe('run.v1.md')
    // Only legacy run.md is left once the zero-padded names are rejected.
    expect(currentRunStateFile([...zero, 'run.md'])).toBe('run.md')
  })

  test('a folder with no run state gives undefined', () => {
    expect(currentRunStateFile([])).toBeUndefined()
    expect(currentRunStateFile(['1-orchestrator-to-x.handoff.md'])).toBeUndefined()
  })

  test('a run.v<N>.md named in a Stages cell is never taken for a handoff record', () => {
    const md = '## Stages\n| Step | Status | Handoff | Handback |\n|---|---|---|---|\n| 1 | in-progress | `run.v2.md` | `run.v1.md` |\n'
    expect(parseStages(md)[0]!.records).toEqual([])
    const out = openRecords(md, { folder: 'f', runState: 'f/run.v2.md' }, 's.md')
    expect(out.map(r => r.path)).toEqual(['f/run.v2.md', 's.md'])
    expect(pairOf('run.v2.md')).toBeUndefined()
  })

  test('a run.v<major>.<minor>.md named in a Stages cell is never taken for a handoff record', () => {
    const md = '## Stages\n| Step | Status | Handoff | Handback |\n|---|---|---|---|\n| 1 | in-progress | `run.v1.2.md` | `run.v1.1.md` |\n'
    expect(parseStages(md)[0]!.records).toEqual([])
    expect(openRecords(md, { folder: 'f', runState: 'f/run.v1.2.md' }, 's.md').map(r => r.path)).toEqual(['f/run.v1.2.md', 's.md'])
    expect(pairOf('run.v1.2.md')).toBeUndefined()
  })
})

describe('round codes (11.14)', () => {
  const ROUND_MD = (status = 'in-progress') => `## Stages
| Step | Stage | Owner | Mode | Status | Sessions | Agents | Handoff | Handback | Updated |
|---|---|---|---|---|---|---|---|---|---|
| 1.3 | testing, loop \`1.3.l1\` round 2 | sqa-engineer | subagent | ${status} | \`s1\` | sqa-engineer, software-engineer | \`1.3-orchestrator-to-sqa-engineer.handoff.md\`, \`1.3.1-sqa-engineer-to-sqa-engineer.handoff.md\`, \`1.3.l1.1-orchestrator-to-software-engineer.handoff.md\`, \`1.3.l1.1-orchestrator-to-sqa-engineer.handoff.md\`, \`1.3.l1.2-orchestrator-to-software-engineer.handoff.md\` | \`1.3-sqa-engineer-to-orchestrator.handback.md\`, \`1.3.1-sqa-engineer-to-sqa-engineer.handback.md\`, \`1.3.l1.1-software-engineer-to-orchestrator.handback.md\` | 2026-10-24 |
| 1.4 | review | code-reviewer | subagent | in-progress | \`s1\` | code-reviewer | \`1.4.1-orchestrator-to-code-reviewer.handoff.md\`, \`1.4.2-orchestrator-to-code-reviewer.handoff.md\` | \`1.4.1-code-reviewer-to-orchestrator.handback.md\`, \`1.4.2-code-reviewer-to-orchestrator.handback.md\` | 2026-10-24 |
`

  test('stepOf reads every code the rule allows, old codes too, with or without a folder', () => {
    expect(stepOf('1.3.l1.1-orchestrator-to-x.handoff.md')).toBe('1.3.l1.1')
    expect(stepOf('1.4.l1.1.2-orchestrator-to-code-reviewer.handoff.md')).toBe('1.4.l1.1.2')
    expect(stepOf('8.1.6.1.l2.1-orchestrator-to-x.handback.md')).toBe('8.1.6.1.l2.1')
    expect(stepOf('8.2.l1.1.l1.2-orchestrator-to-x.handoff.md')).toBe('8.2.l1.1.l1.2')
    expect(stepOf('5.0.1-orchestrator-to-research-assistant.handoff.md')).toBe('5.0.1')
    expect(stepOf('3.1.l2-agent-manager-to-orchestrator.handback.md')).toBe('3.1.l2')
    expect(stepOf('01-orchestrator-to-product-manager.md')).toBe('01')
    expect(stepOf('docs/handoffs/R/1.3.l1.2-a-to-b.handoff.md')).toBe('1.3.l1.2')
    // Not codes: a loop with no number, a letter other than l, a dot before the dash.
    expect(stepOf('1.3.l-a-to-b.handoff.md')).toBeUndefined()
    expect(stepOf('1.3.x1-a-to-b.handoff.md')).toBeUndefined()
    expect(stepOf('1.3.-a-to-b.handoff.md')).toBeUndefined()
    expect(stepOf('l1.1-a-to-b.handoff.md')).toBeUndefined()
  })

  test('pairOf finds the pair of a round record', () => {
    expect(pairOf('1.3.l1.1-orchestrator-to-sqa-engineer.handoff.md')).toBe('1.3.l1.1-sqa-engineer-to-orchestrator.handback.md')
    expect(pairOf('docs/x/1.4.l1.1.2-code-reviewer-to-orchestrator.handback.md')).toBe('docs/x/1.4.l1.1.2-orchestrator-to-code-reviewer.handoff.md')
    expect(pairOf('8.1.6.1.l2.1-orchestrator-to-x.handoff.md')).toBe('8.1.6.1.l2.1-x-to-orchestrator.handback.md')
    expect(pairOf('1.3.l-orchestrator-to-x.handoff.md')).toBeUndefined()
  })

  test('passOf: a loop round up to its round number, else the sub-root', () => {
    expect(passOf('1.4.l1.1.2')).toBe('1.4.l1.1')
    expect(passOf('1.3.l1.2')).toBe('1.3.l1.2')
    expect(passOf('8.1.6.1.l2.1')).toBe('8.1.6.1.l2.1')
    expect(passOf('8.2.l1.1.l1.2.3')).toBe('8.2.l1.1.l1.2')
    expect(passOf('3.1.l2')).toBe('3.1.l2')
    expect(passOf('1.4.2')).toBe('1.4')
    expect(passOf('1.3.1')).toBe('1.3')
    expect(passOf('1.3')).toBe('1.3')
    expect(passOf('4')).toBe('4')
  })

  test('openInRow keeps the latest round and earlier handoffs never answered, not the done passes', () => {
    const [testing, review] = parseStages(ROUND_MD())
    expect(openInRow(testing!)).toEqual([
      '1.3.l1.1-orchestrator-to-sqa-engineer.handoff.md',
      '1.3.l1.2-orchestrator-to-software-engineer.handoff.md',
    ])
    // The first pass with its parallel axes: both pairs, nothing left out.
    expect(openInRow(review!)).toEqual(review!.records)
  })

  test('openInRow keeps a record with no step code, and every record when the newest has none', () => {
    expect(openInRow({ step: '1', status: 'in-progress', records: ['1.2-a-to-b.handoff.md', 'notes.handback.md'] })).toEqual(['1.2-a-to-b.handoff.md', 'notes.handback.md'])
    expect(openInRow({ step: '1', status: 'in-progress', records: ['1.2-a-to-b.handoff.md', '1.2-b-to-a.handback.md', 'x.handoff.md'] })).toEqual(['1.2-a-to-b.handoff.md', '1.2-b-to-a.handback.md', 'x.handoff.md'])
    expect(openInRow({ step: '1', status: 'in-progress', records: [] })).toEqual([])
  })

  test('openRecords: a round last-record and its pair first, then only the open work of each open row', () => {
    const last = '1.3.l1.1-software-engineer-to-orchestrator.handback.md'
    const out = openRecords(ROUND_MD(), { folder: 'f', runState: 'f/run.v1.md', lastRecord: last }, 's.md')
    expect(out.map(r => r.path)).toEqual([
      'f/run.v1.md',
      's.md',
      `f/${last}`,
      'f/1.3.l1.1-orchestrator-to-software-engineer.handoff.md',
      'f/1.3.l1.1-orchestrator-to-sqa-engineer.handoff.md',
      'f/1.3.l1.2-orchestrator-to-software-engineer.handoff.md',
      'f/1.4.1-orchestrator-to-code-reviewer.handoff.md',
      'f/1.4.2-orchestrator-to-code-reviewer.handoff.md',
      'f/1.4.1-code-reviewer-to-orchestrator.handback.md',
      'f/1.4.2-code-reviewer-to-orchestrator.handback.md',
    ])
    expect(out[2]!.note).toBe('last record, step 1.3.l1.1 in 1.3, in-progress')
    expect(out[3]!.note).toBe('its pair')
    expect(out[5]!.note).toBe('step 1.3.l1.2 in 1.3, in-progress')
    expect(out.some(r => /\/1\.3(\.1)?-/.test(r.path))).toBe(false)
  })

  test('openRecords: a done row with round records lists none of them', () => {
    const out = openRecords(ROUND_MD('done'), { folder: 'f', runState: 'f/run.v1.md', lastRecord: '1.3.l1.2-orchestrator-to-software-engineer.handoff.md' }, 's.md')
    expect(out.some(r => r.path.includes('/1.3'))).toBe(false)
    expect(out.some(r => r.note.startsWith('last record'))).toBe(false)
  })
})

describe('round codes: gaps (11.15)', () => {
  const table = (rows: string, head = '| Step | Status | Handoff | Handback |') => `## Stages\n${head}\n|---|---|---|---|\n${rows}\n`
  const rec = (state: string) => parseStages(state)[0]!

  test('openInRow reads Handoff and Handback in either column order', () => {
    const row = rec(table('| 1.3 | in-progress | `1.3.l1.1-b-to-o.handback.md` | `1.3-o-to-b.handoff.md`, `1.3.l1.1-o-to-b.handoff.md` |', '| Step | Status | Handback | Handoff |'))
    expect(openInRow(row)).toEqual(['1.3.l1.1-b-to-o.handback.md', '1.3-o-to-b.handoff.md', '1.3.l1.1-o-to-b.handoff.md'])
  })

  test('openInRow: empty Handoff and Handback cells give no records', () => {
    expect(openInRow(rec(table('| 1.3 | in-progress | | |')))).toEqual([])
  })

  test('openInRow: bare names, several in one cell, a done first pass dropped', () => {
    const row = rec(table('| 1.3 | in-progress | 1.3-o-to-b.handoff.md, 1.3.l1.1-o-to-b.handoff.md | 1.3-b-to-o.handback.md |'))
    expect(openInRow(row)).toEqual(['1.3.l1.1-o-to-b.handoff.md'])
  })

  test('openInRow: a nested spawn under a round (1.3.l1.1.1) belongs to that round', () => {
    const row = rec(table('| 1.3 | in-progress | `1.3-o-to-b.handoff.md`, `1.3.l1.1-o-to-b.handoff.md`, `1.3.l1.1.1-b-to-b.handoff.md`, `1.3.l1.1.2-b-to-b.handoff.md` | `1.3-b-to-o.handback.md`, `1.3.l1.1.1-b-to-b.handback.md` |'))
    expect(openInRow(row)).toEqual(['1.3.l1.1-o-to-b.handoff.md', '1.3.l1.1.1-b-to-b.handoff.md', '1.3.l1.1.2-b-to-b.handoff.md', '1.3.l1.1.1-b-to-b.handback.md'])
  })

  test('openInRow: with two loops in one row only the latest loop round stays', () => {
    const row = rec(table('| 1.3 | in-progress | `1.3-o-to-b.handoff.md`, `1.3.l1.1-o-to-b.handoff.md`, `1.3.l2.1-o-to-b.handoff.md` | `1.3-b-to-o.handback.md`, `1.3.l1.1-b-to-o.handback.md` |'))
    expect(openInRow(row)).toEqual(['1.3.l2.1-o-to-b.handoff.md'])
  })

  test('openInRow: an earlier loop round left unanswered stays beside the latest one', () => {
    const row = rec(table('| 1.3 | in-progress | `1.3.l1.1-o-to-b.handoff.md`, `1.3.l2.1-o-to-b.handoff.md` | |'))
    expect(openInRow(row)).toEqual(['1.3.l1.1-o-to-b.handoff.md', '1.3.l2.1-o-to-b.handoff.md'])
  })

  test('openInRow: the latest pass is that of the last handoff, even when a handback has a later code', () => {
    const row = rec(table('| 1.3 | in-progress | `1.3.l1.1-o-to-b.handoff.md` | `1.3.l1.1-b-to-o.handback.md`, `1.3.l1.2-b-to-o.handback.md` |'))
    expect(openInRow(row)).toEqual(['1.3.l1.1-o-to-b.handoff.md', '1.3.l1.1-b-to-o.handback.md'])
  })

  test('openInRow: a handback-only row takes its pass from its last record', () => {
    const row = rec(table('| 1.3 | in-progress | | `1.3-b-to-o.handback.md`, `1.3.l1.1-b-to-o.handback.md` |'))
    expect(openInRow(row)).toEqual(['1.3.l1.1-b-to-o.handback.md'])
  })

  test('openInRow: a -to-human handoff in the latest pass of a sub-root row stays, as part of that pass', () => {
    const row = rec(table('| 1.3 | in-progress | `1.3.1-o-to-b.handoff.md`, `1.3.2-o-to-human.handoff.md` | `1.3.1-b-to-o.handback.md` |'))
    expect(openInRow(row)).toEqual(['1.3.1-o-to-b.handoff.md', '1.3.2-o-to-human.handoff.md', '1.3.1-b-to-o.handback.md'])
  })

  test('openInRow: a -to-human handoff of an earlier pass is not unanswered work, so it is dropped (11.19, the human ruling on 11.14 open question a)', () => {
    const row = rec(table('| 1.3 | in-progress | `1.3.1-o-to-human.handoff.md`, `1.3.l1.1-o-to-b.handoff.md` | `1.3.l1.1-b-to-o.handback.md` |'))
    expect(openInRow(row)).toEqual(['1.3.l1.1-o-to-b.handoff.md', '1.3.l1.1-b-to-o.handback.md'])
  })

  test('openInRow: only -to-human is exempt; an unanswered earlier handoff to an agent named like it stays', () => {
    const row = rec(table('| 1.3 | in-progress | `1.3.1-o-to-humanizer.handoff.md`, `1.3.2-human-to-o.handoff.md`, `1.3.l1.1-o-to-b.handoff.md` | |'))
    expect(openInRow(row)).toEqual(['1.3.1-o-to-humanizer.handoff.md', '1.3.2-human-to-o.handoff.md', '1.3.l1.1-o-to-b.handoff.md'])
  })

  test('openInRow: an earlier answered handoff is dropped with its hand-back, even when the hand-back is only in the Handback column', () => {
    const row = rec(table('| 1.3 | in-progress | `1.3.1-o-to-b.handoff.md`, `1.3.l1.1-o-to-b.handoff.md` | `1.3.1-b-to-o.handback.md` |'))
    expect(openInRow(row)).toEqual(['1.3.l1.1-o-to-b.handoff.md'])
  })

  test('openInRow: a folder in a cell does not stop a pair being found by file name', () => {
    const row = rec(table('| 1.3 | in-progress | `docs/h/1.3.1-o-to-b.handoff.md`, `docs/h/1.3.l1.1-o-to-b.handoff.md` | `1.3.1-b-to-o.handback.md` |'))
    expect(openInRow(row)).toEqual(['docs/h/1.3.l1.1-o-to-b.handoff.md'])
  })

  test('passOf on earlier-rule codes keeps the loop round, and drops a nested number after it', () => {
    expect(passOf('8.1.6.1.l2.1')).toBe('8.1.6.1.l2.1')
    expect(passOf('8.1.6.1.l2')).toBe('8.1.6.1.l2')
    expect(passOf('8.1.6.1.l2.1.3')).toBe('8.1.6.1.l2.1')
    expect(passOf('8.1.6.1')).toBe('8.1')
    expect(passOf('8.1.6.1.1')).toBe('8.1')
    expect(passOf('1.3.l1.1.1')).toBe('1.3.l1.1')
  })

  test('versions above 9 in either part compare as numbers', () => {
    expect(currentRunStateFile(['run.v9.99.md', 'run.v10.md'])).toBe('run.v10.md')
    expect(currentRunStateFile(['run.v10.md', 'run.v10.1.md', 'run.v9.99.md'])).toBe('run.v10.1.md')
    expect(currentRunStateFile(['run.v10.9.md', 'run.v10.10.md', 'run.v10.2.md'])).toBe('run.v10.10.md')
    expect(currentRunStateFile(['run.v1.10.md', 'run.v10.1.md', 'run.v1.100.md'])).toBe('run.v10.1.md')
    expect(currentRunStateFile(['run.v1.100.md', 'run.v1.99.md', 'run.v1.20.md'])).toBe('run.v1.100.md')
    expect(currentRunStateFile(['run.v99.99.md', 'run.v100.md'])).toBe('run.v100.md')
  })

  test('the same version listed twice gives that name', () => {
    expect(currentRunStateFile(['run.v1.1.md', 'run.v1.1.md'])).toBe('run.v1.1.md')
  })
})

describe('run state names for the log (11.19)', () => {
  test('nothing odd: no version-like names, or valid versions alone', () => {
    expect(runStateNote([])).toBeUndefined()
    expect(runStateNote(['run.md', '1-o-to-a.handoff.md'])).toBeUndefined()
    expect(runStateNote(['run.v1.md', 'run.v1.2.md'])).toBeUndefined()
  })

  test('version-like names that are all rejected: the folder is ignored, or run.md is read', () => {
    expect(runStateNote(['run.v0.md', 'run.v01.md'])).toBe('no valid run-state version among run.v0.md, run.v01.md; folder ignored')
    expect(runStateNote(['run.md', 'run.v1.01.md'])).toBe('no valid run-state version among run.v1.01.md; run.md read')
  })

  test('run.md beside valid versions: the highest version is named as the file read', () => {
    expect(runStateNote(['run.md', 'run.v1.md', 'run.v2.md', 'run.v02.md'])).toBe('run.md beside run-state versions; run.v2.md read')
  })
})
