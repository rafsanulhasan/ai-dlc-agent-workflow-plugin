import { describe, expect, test } from 'claude-code/testing'
import { AUTO_MARK, assembleSessionHandoff, handoffsRoot, inRepo, parseRunState, pickRun, scratchRoot, sessionHandoffName, sessionHandoffPath, stepOf, withNextAction } from '../run.ts'
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
    id: 'AAW-1-demo', folder: 'docs/handoffs/AAW-1-demo', root: '/r', runMd: 'docs/handoffs/AAW-1-demo/run.md',
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
    const bare: RunTarget = { id: 'r', folder: 'f', root: '/r', runMd: 'f/run.md', sessionHandoff: 's.md', branchName: 'b' }
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
