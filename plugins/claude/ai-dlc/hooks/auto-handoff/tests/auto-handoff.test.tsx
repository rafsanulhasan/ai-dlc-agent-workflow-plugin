import { describe, expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import type { FsEntry, On, SessionMessage } from 'claude-code'
import { briefPrompt, extractFacts, factsBlock, hasUnansweredLastRequest, isValidBrief, markUnverifiedFigures } from '../brief.ts'
import { renderTemplate } from '../templates.ts'
import { parseBrief } from '../viewer.ts'
import { orLog } from '../io.ts'
import { DEFAULT_WINDOW, contextLine, creationSplit, hostFields, seedCacheFields, seedCacheLine, windowFields, windowInfo, windowOf } from '../config.ts'

// renamed: the names /rename was run with, in order; commandOrder: every slash command run, in order.
// store: the module's store as the fake engine holds it, so a test can read what the mod stored.
type Calls = { compacts: number; steps: number; cleared: number; seeded: string[]; written: Record<string, string>; completes: number; tokens: number; prompts: string[]; toasts: string[]; ran: number; clearedAtWrite: Record<string, number>; renamed: string[]; commandOrder: string[]; branchQueries: number; usageArgs: unknown[]; store: Map<string, unknown> }

// The test runs sandboxed, with no file access, so these stand in for the files in templates/:
// the same headings and switches, shorter prose.
const SHIPPED_BRIEF = `Write a handoff brief with these sections.

## Work in Progress
What was being worked on.

## Questions Answered
Things established.

## Last Request from the User
Copy "Last Real User Message" verbatim. Then "Status: Answered / Partially answered / Not answered".

## Next Step
The next action.
`
const SHIPPED_INSTRUCTIONS = `## Instructions
{{#priority}}
**PRIORITY: The last request from the user, in its section below, is not yet answered. Answer that request as your first action.**
{{/priority}}

This turn was triggered by the system, not by a user.
{{#priority}}Do the PRIORITY request and nothing else.{{/priority}}
{{^priority}}If the brief includes in-progress or pending work, continue that work immediately.{{/priority}}

**You MUST produce a text response before ending your turn.**
`

// The session handoff template (templates/session-handoff.md): the same headings, shorter prose.
const SHIPPED_SESSION = `Write the body of a session handoff.

## Done so far
Outcomes.

## In progress
What was being changed.

## Last request from the user
Copy "Last Real User Message" verbatim. Then "Status: Answered / Partially answered / Not answered".

## Next steps
1. The next action.
`

// git as the engine runs it: the repository root, the branch and the short commit; commonDir: the
// absolute --git-common-dir, set for a linked worktree (unset: git answers as for an older git).
type Git = { root: string; branch: string; commit: string; commonDir?: string }

const BASIC: SessionMessage[] = [
  { role: 'user', text: 'please refactor the parser', toolUses: [] },
  { role: 'assistant', text: 'on it', toolUses: [{ tool_use_id: 'r1', tool: 'Read', input: { file_path: 'src/parser.ts' } }] },
]

const msg = (role: 'user' | 'assistant', text: string, toolUses: SessionMessage['toolUses'] = []): SessionMessage => ({ role, text, toolUses })
const bash = (command: string, text?: string, isError?: true) => ({ tool_use_id: 'b', tool: 'Bash', input: { command }, ...(text === undefined ? {} : { text }), ...(isError ? { isError } : {}) })
const edit = (file_path: string, tool = 'Edit') => ({ tool_use_id: 'e', tool, input: { file_path } })

const TURN = { answer: 'ok', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' } as const
const USAGE = { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
// The test runs under bun, which has timers; the hooks lib (es2023, no DOM) does not declare them.
declare const setTimeout: (fn: (...args: never[]) => void, ms: number) => unknown

// On Windows the engine hands fs hooks "/home/test/x" as "D:\home\test\x";
// the fake file store keys on the POSIX spelling either way.
const posix = (p: string) => p.replace(/^[A-Za-z]:/, '').replace(/\\/g, '/')
// The mod's log and its capabilities record land in the fake file store too (sh append or fs.write);
// assertions about the files a handoff writes skip them.
const files = (written: Record<string, string>) => Object.keys(written).filter(p => !p.endsWith('/auto-handoff.log') && !p.endsWith('/capabilities.json'))

// The engine beneath the plugin: everything the mod calls, answered from memory.
// commands: the slash commands the engine lists (default: clear and rename); failRename: /rename rejects.
// failList: listing a folder whose path matches it fails, as an unreadable folder does.
// failStore: $.store.get of a key that matches it rejects, as an unreadable store does.
function engine(on: On, opts: { endOnClear?: boolean; beneath?: string; tokens: number; files?: Record<string, string>; env?: Record<string, string>; brief?: string | null; messages?: SessionMessage[]; toolChars?: number; streamToolChars?: number; store?: Record<string, unknown>; stepUsage?: boolean; surfaces?: ('terminal' | 'desktop' | 'mobile' | 'vscode')[]; noSh?: boolean; git?: Git; failWrite?: RegExp; failList?: RegExp; failStore?: RegExp; window?: number | null; percent?: number; breakdown?: Record<string, unknown> | 'throw'; commands?: string[]; failRename?: boolean; hold?: Promise<unknown>; stepRead?: number; stepSplit?: { h: number; m: number } }): Calls {
  const calls: Calls = { compacts: 0, steps: 0, cleared: 0, seeded: [], written: {}, completes: 0, tokens: opts.tokens, prompts: [], toasts: [], ran: 0, clearedAtWrite: {}, renamed: [], commandOrder: [], branchQueries: 0, usageArgs: [], store: new Map(Object.entries(opts.store ?? {})) }
  let sessionId = 'old-session'
  let clears = 0
  mock.env(on, { HOME: '/home/test', ...(opts.env ?? {}) })
  clock = mock.clock(on) // the panel's spinner and collapse timers
  on('session.surfaces', async () => ({ value: opts.surfaces ?? ['terminal'] }))
  on('ui.render', { component: 'AbovePrompt' }, async ($, e) => { // the engine draws nothing in the band
    const { Box, Text } = $.ui.resolve(e)
    // `beneath`: a band another plugin draws beneath ours (the lens's), to see that ours lets it through
    return opts.beneath ? <Text>{opts.beneath}</Text> : <Box />
  })
  // The test's $ has no store noun: what the mod finds in its store is seeded here. The four handlers
  // answer as mock.store does (claude-code/testing), over calls.store, so a test can read what was
  // stored and make a read fail (failStore), which mock.store cannot.
  // A failed read answers { deny }, which rejects the caller's promise (OpEventResult); a hook that
  // throws is skipped instead, and the read falls through to the engine's own empty store.
  on('store.get', async (_$, e) => {
    if (opts.failStore?.test(e.key)) return { deny: 'store unreadable' }
    return { value: calls.store.get(e.key) }
  })
  on('store.set', async (_$, e) => {
    // get reads back JSON data, as the engine keeps it.
    calls.store.set(e.key, JSON.parse(JSON.stringify(e.value)))
    return { value: undefined }
  })
  on('store.delete', async (_$, e) => {
    calls.store.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', async () => ({ value: [...calls.store.keys()] }))
  on('turn.complete', async () => ({ text: 'ok' }))
  // window: the host's context window, 200k unless the test sets one; null: the host reports none.
  // percent: the host's own share, 0 to 100, sent only when the test sets it.
  // breakdown: what a call with { breakdown } gets as context.breakdown (absent unless the test sets it);
  // 'throw': such a call fails. usageArgs records every call's args, so a test sees which asked for one.
  on('session.usage', async (_$, e) => {
    calls.usageArgs.push(e)
    if (e?.breakdown && opts.breakdown === 'throw') throw new Error('breakdown failed')
    const breakdown = e?.breakdown && opts.breakdown ? { breakdown: opts.breakdown } : {}
    return { value: { startedAt: 0, context: { tokens: calls.tokens, ...(opts.window === null ? {} : { window: opts.window ?? 200_000 }), ...(opts.percent === undefined ? {} : { percent: opts.percent }), ...breakdown }, rateLimits: [] } } as never
  })
  on('session.id', async () => ({ value: sessionId }))
  on('session.cwd', async () => ({ value: '/home/test/proj' }))
  on('fs.read', async (_$, e) => {
    const path = posix(e.path)
    const text = calls.written[path] ?? opts.files?.[path]
    // The shipped defaults: the real files in the mod's templates/ folder.
    if (text === undefined && path.endsWith("/templates/brief.md")) return { value: SHIPPED_BRIEF }
    if (text === undefined && path.endsWith("/templates/instructions.md")) return { value: SHIPPED_INSTRUCTIONS }
    if (text === undefined && path.endsWith("/templates/session-handoff.md")) return { value: SHIPPED_SESSION }
    // Keep-alive's status line in full mode (its D13 summary has its own tests in hooks/keepalive/), so
    // the track lines asserted here stay whole on the terminal surface this engine reports.
    if (text === undefined && path === '/home/test/proj/.ai-dlc/cache-keepalive.json') return { value: JSON.stringify({ statusText: 'full' }) }
    if (text === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: text }
  })
  on('session.messages', async () => ({ value: opts.messages ?? BASIC }))
  on('model.complete', async (_$, e) => {
    calls.completes++
    calls.prompts.push(e.prompt)
    // hold: the brief's model call waits for it, so a test can act while the handoff is in flight.
    if (opts.hold) await opts.hold
    return {
      value: opts.brief === null
        ? { isAnswered: false, reason: 'empty-reply', usage: USAGE }
        : { isAnswered: true, text: opts.brief ?? '## Next Step\nFinish the parser refactor.', usage: USAGE },
    }
  })
  on('fs.write', async (_$, e) => {
    if (opts.failWrite?.test(posix(e.path))) throw new Error(`EACCES ${e.path}`)
    calls.written[posix(e.path)] = e.text
    calls.clearedAtWrite[posix(e.path)] = calls.cleared
    return { value: undefined }
  })
  // Files directly in the folder, and the folders below it, from the seeded files and the writes.
  on('fs.list', async (_$, e) => {
    const dir = posix(e.path)
    if (opts.failList?.test(dir)) throw new Error(`EACCES ${e.path}`)
    const names = new Map<string, FsEntry['kind']>()
    for (const p of [...Object.keys(opts.files ?? {}), ...Object.keys(calls.written)]) {
      if (!p.startsWith(`${dir}/`)) continue
      const rest = p.slice(dir.length + 1)
      const name = rest.split('/')[0]!
      names.set(name, rest.includes('/') ? 'dir' : 'file')
    }
    if (!names.size) throw new Error(`ENOENT ${e.path}`)
    return { value: [...names].map(([name, kind]) => ({ name, kind, size: 0, mtimeMs: 0, isLink: false })) }
  })
  on('process.run', async (_$, e) => {
    // No `sh`, as on Windows: every sh call refused. The log's `sh` append is kept in the file store.
    if (opts.noSh && e.argv[0] === 'sh') throw new Error('ENOENT sh')
    // git answers only when the test gives a repository; otherwise it fails as outside one.
    if (e.argv[0] === 'git') {
      const args = e.argv.slice(3).join(' ')
      // Each run lookup asks for the branch once: the count of lookups.
      if (args === 'rev-parse --abbrev-ref HEAD') calls.branchQueries++
      const out = !opts.git ? undefined
        : args === 'rev-parse --show-toplevel' ? opts.git.root
        : args === 'rev-parse --abbrev-ref HEAD' ? opts.git.branch
        : args === 'rev-parse --short HEAD' ? opts.git.commit
        : args === 'rev-parse --path-format=absolute --git-common-dir' ? opts.git.commonDir
        : undefined
      return { value: { exitCode: out === undefined ? 128 : 0, stdout: out ? `${out}\n` : '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    if (e.argv[0] === 'sh' && e.argv[2]?.includes('>> "$2"')) {
      const path = posix(e.argv[5] ?? '')
      calls.written[path] = `${calls.written[path] ?? ''}${e.argv[4]}\n`
    }
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.toast', async (_$, e) => {
    calls.toasts.push(e.text)
    return { value: undefined }
  })
  on('command.list', async () => ({ value: (opts.commands ?? ['clear', 'rename']).map(name => ({ name, description: name, source: 'builtin' as never })) }))
  on('session.version', async () => ({ value: { version: '2.1.306', base: '2.1.306' } as never }))
  // /clear starts a new session; /rename records the name; anything else is a no-op.
  on('command.run', async (_$, e) => {
    calls.commandOrder.push(e.command)
    if (e.command === 'rename') {
      if (opts.failRename) throw new Error('rename refused')
      calls.renamed.push(e.args)
      return {}
    }
    if (e.command !== 'clear') return {}
    calls.cleared++
    sessionId = `new-session-${++clears}`
    return {}
  })
  on('prompt.submit', async (_$, e) => {
    calls.seeded.push(e.text)
    return { text: e.text }
  })
  on('classic.SessionStart', async () => ({}))
  // endOnClear: a test ends the old session itself while the handoff is under way, as /clear does
  if (opts.endOnClear) on('session.end', async (_$, e) => ({ sessionId: e.sessionId }) as never)
  on('session.compact', async (_$, e) => {
    calls.compacts++
    return { messages: e.messages }
  })
  // The real request: reached only when the mod lets the step through.
  on('turn.step', async function* (_$, e) {
    calls.steps++
    // stepUsage: the response reports the request's size, as the real engine does.
    const usage = opts.streamToolChars ? { input_tokens: 0, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } as never
      // stepRead: what the request read from the cache, the rest written to it (all read unless set)
      : opts.stepUsage ? { input_tokens: 10, output_tokens: 0, cache_read_input_tokens: opts.stepRead ?? calls.tokens - 10, cache_creation_input_tokens: opts.stepRead === undefined ? 0 : calls.tokens - 10 - opts.stepRead, ...(opts.stepSplit ? { cache_creation: { ephemeral_1h_input_tokens: opts.stepSplit.h, ephemeral_5m_input_tokens: opts.stepSplit.m } } : {}) } as never
      : null
    if (usage) yield { kind: 'text', index: 0, text: 'reading' }
    yield { kind: 'stop', stopReason: 'tool_use', usage }
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'tool_use', usage }
  })
  on('tool.call', async (_$, e) => (calls.ran++, { result: { content: '' }, text: 'x'.repeat(('file_path' in e && e.file_path === '/streamed.txt' ? opts.streamToolChars : opts.toolChars) ?? 0) }))
  return calls
}

const STEP = { turnId: 't1', index: 1, model: 'claude-fable-5-1', messageCount: 10 }

// Runs one model request through the chain and returns the chunks that came out.
async function step($: TestBody extends (...a: infer A) => unknown ? A[0] : never, index = 1) {
  const chunks: { kind: string; text?: string }[] = []
  for await (const c of $.turn.step({ ...STEP, index })) chunks.push(c)
  return chunks
}

let clock: ReturnType<typeof mock.clock>

const mountBand = ($: Parameters<TestBody>[0]) =>
  $.ui.mount({ plugin: 'ai-dlc', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120 } as never })

// Step 42: keep-alive's band starts minimised (one row: whether it is on, and the master button). Opens it, whatever its state.
const mountOpenBand = async ($: Parameters<TestBody>[0]) => {
  const ui = await mountBand($)
  const min = await ui.find({ type: 'Button', key: 'ka-min' })
  if (min && String((min as { text?: unknown }).text ?? '').includes('□')) await ui.press({ key: 'ka-min' })
  return ui
}

// Every string in a drawn tree, in order: Text children, a Markdown's text, a Button's label.
const textOf = (n: unknown): string => typeof n === 'string' ? n
  : Array.isArray(n) ? n.map(textOf).join('')
  : n && typeof n === 'object' ? Object.entries(n).map(([k, v]) => k === 'children' || k === 'text' || k === 'label' || k === 'props' ? textOf(v) : '').join('')
  : ''

// The band above the prompt as drawn, flattened to its text; '' when the mod draws nothing.
async function band($: Parameters<TestBody>[0]): Promise<string> {
  const ui = await mountBand($)
  try {
    // Auto-handoff's panel only: keep-alive's rows, drawn below it in the same band since ITEM-068, are
    // tested in hooks/keepalive/
    const text = textOf(await ui.drawn())
    const ka = text.indexOf('⚠ ai-dlc cache-keepalive:')
    return ka < 0 ? text : text.slice(0, ka)
  } finally {
    await ui.unmount()
  }
}

// Step 44 (R44.1): keep-alive writes no status line. A test reads the track lines from the state keep-alive publishes (they are
// the text the old line carried; nothing while the master is off), and the seed line from its band (kaText). The write goes out
// after the hook returns, so a terminal Stop handler waits a moment (`flush`) before it answers.
const flush = () => new Promise<void>(r => setTimeout(r, 30))
function kaFeed(on: On, calls?: { cleared: number }): (string | undefined)[] & { cleared: number[] } {
  const feed = Object.assign([] as (string | undefined)[], { cleared: [] as number[] })
  on('state.set', async (_$, e) => {
    const w = e as unknown as { plugin: string; key: string; value: { enabled: boolean; tracks: { line: string }[] } }
    if (w.plugin === 'ai-dlc' && w.key === 'keepalive') { feed.push(w.value.enabled ? w.value.tracks.map(t => t.line).join('\n') : undefined); feed.cleared.push(calls?.cleared ?? 0) }
    return { value: { isSet: true, version: feed.length } } as never
  })
  return feed
}
// Keep-alive's band opened, as text: its head row, the track rows and the seed row while it shows.
async function kaText($: Parameters<TestBody>[0]): Promise<string> {
  await flush()
  const ui = await mountOpenBand($)
  try { return textOf(await ui.drawn()) } finally { await ui.unmount() }
}

async function settle(check: () => boolean) {
  for (let i = 0; i < 50 && !check(); i++) await new Promise(r => setTimeout(r, 10))
}

// One handoff of a session titled `title` (none: no title from the engine), started as `source`;
// returns the name the seeded session asked for through its SessionStart answer.
async function handOffTitled($: Parameters<TestBody>[0], calls: Calls, title?: string, source: 'startup' | 'resume' = 'startup'): Promise<string | undefined> {
  if (title !== undefined) await $.classic.SessionStart({ source, session_title: title } as never)
  await $.turn.complete(TURN)
  await settle(() => calls.cleared > 0)
  const answer = await $.classic.SessionStart({ source: 'clear' }) as { sessionTitle?: string }
  return answer.sessionTitle
}
const P = '[ai-dlc:auto-handoff]'
// The number of `numbering fallback:` lines in the log (LOG_FILE, defined below; read at call time).
const fallbacks = (calls: Calls) => (calls.written[LOG_FILE] ?? '').split('numbering fallback:').length - 1

describe('auto-handoff', () => {
  test('below the threshold nothing happens', async ($, on) => {
    const calls = engine(on, { tokens: 100_000 })
    await $.turn.complete(TURN)
    await settle(() => false)
    expect(calls.completes).toBe(0)
    expect(calls.cleared).toBe(0)
  })

  test('at the threshold: brief to disk, /clear, then seed the new session', async ($, on) => {
    const calls = engine(on, { tokens: 165_000 })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.completes).toBe(1)
    expect(files(calls.written)).toEqual(['/home/test/.claude/state/auto-handoff/old-session.md', '/home/test/.claude/state/auto-handoff/pages/old-session.html'])
    expect(calls.written['/home/test/.claude/state/auto-handoff/old-session.md']).toContain('Finish the parser refactor')
    // The log is how a failed handoff gets diagnosed: it must name the threshold and the brief.
    const log = calls.written['/home/test/.claude/state/auto-handoff/auto-handoff.log'] ?? ''
    expect(log).toContain('threshold session=old-session tokens=165000')
    expect(log).toContain('brief written /home/test/.claude/state/auto-handoff/old-session.md')
    expect(calls.cleared).toBe(1)

    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    expect(calls.seeded.length).toBe(1)
    // The seed is one line pointing at the brief on disk, not the brief itself.
    expect(calls.seeded[0]).toContain('Read the brief at /home/test/.claude/state/auto-handoff/old-session.md')
    expect(calls.seeded[0]).not.toContain('Finish the parser refactor')
    expect(calls.seeded[0]?.split('\n').length).toBe(1)
  })

  test('fires once per session', async ($, on) => {
    const calls = engine(on, { tokens: 165_000 })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    await $.turn.complete(TURN)
    await settle(() => false)
    expect(calls.completes).toBe(1)
  })

  test('AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS lowers the threshold', async ($, on) => {
    const calls = engine(on, { tokens: 25_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '20000' } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.cleared).toBe(1)
  })

  for (const [name, value] of [['AI_DLC_AUTO_HANDOFF_ENABLED', 'false'], ['DISABLE_AUTO_COMPACT', '1']] as const) {
    test(`kill switch: ${name}=${value} means no brief and no clear`, async ($, on) => {
      const calls = engine(on, { tokens: 190_000, env: { [name]: value } })
      await $.turn.complete(TURN)
      await settle(() => false)
      expect(calls.completes).toBe(0)
      expect(calls.cleared).toBe(0)
    })
  }

  test('subagent turns are ignored', async ($, on) => {
    const calls = engine(on, { tokens: 190_000 })
    await $.turn.complete({ ...TURN, agentId: 'sub-1' })
    await settle(() => false)
    expect(calls.completes).toBe(0)
  })

  test('a failed Haiku brief falls back to the facts and still hands off', async ($, on) => {
    const calls = engine(on, { tokens: 190_000, brief: null, messages: [msg('assistant', 'done', [edit('/repo/src/a.ts')])] })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const brief = calls.written['/home/test/.claude/state/auto-handoff/old-session.md']
    expect(calls.cleared).toBe(1)
    expect(brief).toContain('did not return a usable brief')
    expect(brief).toContain('- /repo/src/a.ts')
  })

  test('a Haiku reply with no brief sections is replaced by the facts', async ($, on) => {
    const calls = engine(on, { tokens: 190_000, brief: 'Sure, I can help with that parser refactor!' })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const brief = calls.written['/home/test/.claude/state/auto-handoff/old-session.md']
    expect(brief).not.toContain('Sure, I can help')
    expect(brief).toContain('## Last Real User Message (verbatim)\nplease refactor the parser')
  })

  test('without sh the server cannot launch, and the link is the local file', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, noSh: true })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.written['/home/test/.claude/state/auto-handoff/pages/old-session.html']).toBeDefined()
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    expect(calls.seeded[0]).toContain('file:///home/test/.claude/state/auto-handoff/pages/old-session.html')
    expect(calls.seeded[0]).not.toContain('http://')
  })

  test('a blank viewer setting means no server, and the link is the local file', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, env: { AI_DLC_AUTO_HANDOFF_VIEWER: '' } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    expect(calls.seeded[0]).toContain('file:///home/test/.claude/state/auto-handoff/pages/old-session.html')
  })

  test('the default threshold is 80% of the window', async ($, on) => {
    const calls = engine(on, { tokens: 159_999 })
    await $.turn.complete(TURN)
    await settle(() => false)
    expect(calls.cleared).toBe(0)
    calls.tokens = 160_000
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.cleared).toBe(1)
  })

  test('thresholdPercent sets the share of the window', async ($, on) => {
    const calls = engine(on, { tokens: 120_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_PERCENT: '50' } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.cleared).toBe(1)
    expect(calls.written['/home/test/.claude/state/auto-handoff/auto-handoff.log']).toContain('threshold=100000')
  })

  // The automatic handoff has no /config rows: neither the retired token threshold nor a former row is read.
  test('plugin options are not read: the retired token threshold and the former thresholdPercent row change nothing', { options: { threshold: 100_000, thresholdPercent: 50 } }, async ($, on) => {
    const calls = engine(on, { tokens: 120_000 })
    await $.turn.complete(TURN)
    await settle(() => false)
    expect(calls.cleared).toBe(0) // 120k is under 80% of 200k
  })

  test('windowOf takes the window, else derives it from the percentage, else nothing', () => {
    expect(windowOf({ tokens: 100_000, window: 1_000_000, percent: 50 })).toBe(1_000_000)
    expect(windowOf({ tokens: 400_000, percent: 40 })).toBe(1_000_000)
    expect(windowOf({ tokens: 0, percent: 0 })).toBeUndefined()
    expect(windowOf({ tokens: 100_000 })).toBeUndefined()
    expect(contextLine(80, 500_000)).toBe(400_000)
    expect(DEFAULT_WINDOW).toBe(500_000)
  })

  test('the line follows the window the host reports', async ($, on) => {
    const calls = engine(on, { tokens: 700_000, window: 1_000_000 })
    await $.turn.complete(TURN)
    await settle(() => false)
    expect(calls.cleared).toBe(0) // 700k is under 80% of 1M
    calls.tokens = 800_000
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.cleared).toBe(1)
  })

  test('without a window, the host percentage gives it', async ($, on) => {
    // 400k at 40% means a 1M window, so the line is 800k.
    const calls = engine(on, { tokens: 400_000, window: null, percent: 40 })
    await $.turn.complete(TURN)
    await settle(() => false)
    expect(calls.cleared).toBe(0)
    expect(calls.written['/home/test/.claude/state/auto-handoff/auto-handoff.log'] ?? '').not.toContain('no context window reported')
  })

  test('without a window or a percentage, the line is 80% of the 500k fallback, logged once', async ($, on) => {
    const calls = engine(on, { tokens: 399_999, window: null })
    await $.turn.complete(TURN)
    await $.turn.complete(TURN)
    await settle(() => false)
    expect(calls.cleared).toBe(0)
    const log = calls.written['/home/test/.claude/state/auto-handoff/auto-handoff.log'] ?? ''
    expect(log.split('no context window reported: thresholdPercent applies to 500000').length - 1).toBe(1)
    expect(log).toContain('no context window reported: thresholdPercent applies to 500000, a line of 400000 tokens; if the real window is smaller than 400000, the handoff waits for auto-compact: set thresholdTokens (AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS) to an absolute token count')
    calls.tokens = 400_000
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.cleared).toBe(1)
  })

  test('the fallback log line follows thresholdPercent', async ($, on) => {
    const calls = engine(on, { tokens: 1, window: null, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_PERCENT: '50' } })
    await $.turn.complete(TURN)
    await settle(() => false)
    const log = calls.written['/home/test/.claude/state/auto-handoff/auto-handoff.log'] ?? ''
    expect(log).toContain('no context window reported: thresholdPercent applies to 500000, a line of 250000 tokens; if the real window is smaller than 250000, the handoff waits for auto-compact: set thresholdTokens (AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS) to an absolute token count')
    expect(log).not.toContain('400000')
  })

  test('AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS overrides thresholdPercent with an absolute count', async ($, on) => {
    const calls = engine(on, { tokens: 120_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '150000', AI_DLC_AUTO_HANDOFF_THRESHOLD_PERCENT: '50' } })
    await $.turn.complete(TURN)
    await settle(() => false)
    expect(calls.cleared).toBe(0)
  })

  // Review round 1 (AC-1): edges of the percentage line.
  test('a non-numeric or non-positive AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS is ignored and thresholdPercent applies', async ($, on) => {
    const calls = engine(on, { tokens: 159_999, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: 'lots' } })
    await $.turn.complete(TURN)
    await settle(() => false)
    expect(calls.cleared).toBe(0) // not handed off at 0 tokens; the line is 160k
    calls.tokens = 160_000
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.cleared).toBe(1)
  })

  test('thresholdPercent 100 puts the line at the whole window', async ($, on) => {
    const calls = engine(on, { tokens: 199_999, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_PERCENT: '100' } })
    await $.turn.complete(TURN)
    await settle(() => false)
    expect(calls.cleared).toBe(0)
    calls.tokens = 200_000
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.cleared).toBe(1)
  })

  test('windowOf ignores a zero or negative window and falls through to the percentage', () => {
    expect(windowOf({ tokens: 200_000, window: 0, percent: 20 })).toBe(1_000_000)
    expect(windowOf({ tokens: 200_000, window: -1, percent: 20 })).toBe(1_000_000)
    expect(windowOf({ window: 0 })).toBeUndefined()
    expect(windowOf({})).toBeUndefined()
  })

  test('contextLine rounds down to a whole token', () => {
    expect(contextLine(33, 100_001)).toBe(33_000)
    expect(contextLine(1, 150)).toBe(1)
    expect(contextLine(100, 1_000_000)).toBe(1_000_000)
  })

  test('the log records the default line in tokens (80% of 200k)', async ($, on) => {
    const calls = engine(on, { tokens: 160_000 })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const log = calls.written['/home/test/.claude/state/auto-handoff/auto-handoff.log'] ?? ''
    expect(log).toContain('threshold=160000')
  })

  // The per-turn threshold line names the window the threshold came from and its source, so a live
  // session shows what Claude Code reports. via stays last: it can hold spaces.
  const thresholdLine = (calls: Calls) => (calls.written['/home/test/.claude/state/auto-handoff/auto-handoff.log'] ?? '').split('\n').find((l) => l.includes('threshold session=')) ?? ''

  test('the threshold log line names a window the host reports', async ($, on) => {
    const calls = engine(on, { tokens: 800_000, window: 1_000_000 })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(thresholdLine(calls)).toContain('tokens=800000 threshold=800000 window=1000000 windowSource=host basis=thresholdPercent:80 hostWindowSource=none autoCompactThreshold=none via=turn.complete')
  })

  test('the threshold log line names a window derived from the host percentage', async ($, on) => {
    // 800k at 80% means a 1M window, so the line is 800k.
    const calls = engine(on, { tokens: 800_000, window: null, percent: 80 })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(thresholdLine(calls)).toContain('threshold=800000 window=1000000 windowSource=host-percent basis=thresholdPercent:80 hostWindowSource=none autoCompactThreshold=none via=')
  })

  test('the threshold log line names the default window when the host reports none', async ($, on) => {
    const calls = engine(on, { tokens: 400_000, window: null })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(thresholdLine(calls)).toContain('threshold=400000 window=500000 windowSource=default basis=thresholdPercent:80 hostWindowSource=none autoCompactThreshold=none via=')
  })

  test('the threshold log line reads no window under thresholdTokens', async ($, on) => {
    const calls = engine(on, { tokens: 150_000, window: 1_000_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '150000' } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(thresholdLine(calls)).toContain('threshold=150000 window=none windowSource=none basis=thresholdTokens hostWindowSource=none autoCompactThreshold=none via=')
  })

  test('the threshold log line keeps via last, after the window fields', async ($, on) => {
    const calls = engine(on, { tokens: 165_000 })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(thresholdLine(calls)).toMatch(/threshold session=old-session tokens=165000 threshold=160000 window=200000 windowSource=host basis=thresholdPercent:80 hostWindowSource=none autoCompactThreshold=none via=turn\.complete$/)
  })

  test('windowInfo and windowFields give the window, its source and the basis', () => {
    expect(windowInfo({ tokens: 1, window: 1_000_000 })).toEqual({ window: 1_000_000, source: 'host' })
    expect(windowInfo({ tokens: 400_000, percent: 40 })).toEqual({ window: 1_000_000, source: 'host-percent' })
    expect(windowInfo({ tokens: 400_000 })).toBeUndefined()
    expect(windowFields({ window: 500_000, source: 'default' }, { thresholdPercent: 50 })).toBe('window=500000 windowSource=default basis=thresholdPercent:50')
    expect(windowFields(undefined, { thresholdPercent: 80, thresholdTokens: 90_000 })).toBe('window=none windowSource=none basis=thresholdTokens')
  })

  test('windowInfo ignores a window that is not a number and falls through to the percentage', () => {
    expect(windowInfo({ tokens: 200_000, window: '1000000' as unknown as number, percent: 20 })).toEqual({ window: 1_000_000, source: 'host-percent' })
    expect(windowInfo({ tokens: 200_000, window: Number.NaN, percent: 20 })).toEqual({ window: 1_000_000, source: 'host-percent' })
    expect(windowInfo({ tokens: 200_000, window: '1000000' as unknown as number })).toBeUndefined()
    expect(windowInfo({ tokens: 200_000, window: 0, percent: 20 })?.source).toBe('host-percent')
  })

  // Claude Code's own window source and auto-compact line, from a summary breakdown asked for only
  // when the threshold line is written.
  test('the threshold log line names the host window source and auto-compact threshold', async ($, on) => {
    const calls = engine(on, { tokens: 800_000, window: 1_000_000, breakdown: { autocompactSource: 'model-default', autoCompactThreshold: 967_000 } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(thresholdLine(calls)).toContain('window=1000000 windowSource=host basis=thresholdPercent:80 hostWindowSource=model-default autoCompactThreshold=967000 via=turn.complete')
  })

  test('the threshold log line reads none when the host breakdown has neither field', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, breakdown: { totalTokens: 165_000 } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(thresholdLine(calls)).toContain('basis=thresholdPercent:80 hostWindowSource=none autoCompactThreshold=none via=turn.complete')
  })

  test('the threshold log line reads none and still hands off when the breakdown call throws', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, breakdown: 'throw' })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.cleared).toBe(1)
    expect(thresholdLine(calls)).toContain('windowSource=host basis=thresholdPercent:80 hostWindowSource=none autoCompactThreshold=none via=turn.complete')
  })

  test('the host breakdown is asked for once, as a summary, and only when the threshold line is written', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, breakdown: { autocompactSource: 'env', autoCompactThreshold: 150_000 } })
    await $.turn.complete(TURN)
    await settle(() => false)
    expect(calls.cleared).toBe(0)
    expect(calls.usageArgs.length).toBeGreaterThan(0)
    expect(calls.usageArgs.filter((a) => (a as { breakdown?: unknown } | undefined)?.breakdown !== undefined)).toEqual([])
    calls.tokens = 165_000
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const asked = calls.usageArgs.filter((a) => (a as { breakdown?: unknown } | undefined)?.breakdown !== undefined)
    expect(asked).toEqual([{ breakdown: 'summary' }])
    expect(thresholdLine(calls)).toContain('hostWindowSource=env autoCompactThreshold=150000 via=turn.complete')
  })

  test('hostFields keeps the line to key=value pairs', () => {
    expect(hostFields(undefined)).toBe('hostWindowSource=none autoCompactThreshold=none')
    expect(hostFields({ autocompactSource: 'settings', autoCompactThreshold: 180_000 })).toBe('hostWindowSource=settings autoCompactThreshold=180000')
    expect(hostFields({ autocompactSource: 'two words', autoCompactThreshold: '180000' })).toBe('hostWindowSource=none autoCompactThreshold=none')
    expect(hostFields({ autocompactSource: '', autoCompactThreshold: Number.NaN })).toBe('hostWindowSource=none autoCompactThreshold=none')
  })

  test('hostFields reads each field on its own and rejects what is not a plain string or finite number', () => {
    expect(hostFields({ autocompactSource: 'env' })).toBe('hostWindowSource=env autoCompactThreshold=none')
    expect(hostFields({ autoCompactThreshold: 150_000 })).toBe('hostWindowSource=none autoCompactThreshold=150000')
    expect(hostFields({})).toBe('hostWindowSource=none autoCompactThreshold=none')
    expect(hostFields({ autocompactSource: 7, autoCompactThreshold: Number.POSITIVE_INFINITY })).toBe('hostWindowSource=none autoCompactThreshold=none')
    expect(hostFields({ autocompactSource: null, autoCompactThreshold: Number.NEGATIVE_INFINITY })).toBe('hostWindowSource=none autoCompactThreshold=none')
    expect(hostFields({ autocompactSource: 'a	b' })).toBe('hostWindowSource=none autoCompactThreshold=none')
    expect(hostFields({ autocompactSource: ' env' })).toBe('hostWindowSource=none autoCompactThreshold=none')
    // Any finite number is logged as the host sent it; the module does not judge it.
    expect(hostFields({ autoCompactThreshold: 0 })).toBe('hostWindowSource=none autoCompactThreshold=0')
    expect(hostFields({ autoCompactThreshold: -5 })).toBe('hostWindowSource=none autoCompactThreshold=-5')
    expect(hostFields({ autoCompactThreshold: 1.5 })).toBe('hostWindowSource=none autoCompactThreshold=1.5')
  })

  test('the threshold log line reads each host field on its own', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, breakdown: { autoCompactThreshold: 180_000 } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(thresholdLine(calls)).toContain('hostWindowSource=none autoCompactThreshold=180000 via=turn.complete')
  })

  test('the threshold log line shows the host source when auto-compact is off (no threshold)', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, breakdown: { autocompactSource: 'settings' } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(thresholdLine(calls)).toContain('hostWindowSource=settings autoCompactThreshold=none via=turn.complete')
  })

  test('the threshold log line names a host source with a space as none and keeps via last', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, breakdown: { autocompactSource: 'model default', autoCompactThreshold: 150_000 } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(thresholdLine(calls)).toContain('hostWindowSource=none autoCompactThreshold=150000 via=turn.complete')
  })

  test('auto-compact asks the host breakdown once and logs it', async ($, on) => {
    const calls = engine(on, { tokens: 174_000, window: null, breakdown: { autocompactSource: 'env', autoCompactThreshold: 170_000 } })
    await $.session.compact({ trigger: 'auto', messages: BASIC })
    await settle(() => calls.cleared > 0)
    expect(thresholdLine(calls)).toContain('hostWindowSource=env autoCompactThreshold=170000 via=session.compact')
    expect(calls.usageArgs.filter((a) => (a as { breakdown?: unknown } | undefined)?.breakdown !== undefined)).toEqual([{ breakdown: 'summary' }])
  })

  test('the threshold log line keeps via last when it holds spaces', async ($, on) => {
    const calls = engine(on, { tokens: 61_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '80000' }, toolChars: 80_000 })
    await $.tool.call({ tool: 'Read', file_path: '/big.txt' })
    await step($)
    await settle(() => calls.cleared > 0)
    expect(thresholdLine(calls)).toMatch(/ window=none windowSource=none basis=thresholdTokens hostWindowSource=none autoCompactThreshold=none via=turn\.step measured=\d+$/)
  })

  test('auto-compact on the default window fires and names the default window', async ($, on) => {
    // The fallback message says the handoff waits for auto-compact: it does fire there, below the line.
    const calls = engine(on, { tokens: 174_000, window: null })
    await $.session.compact({ trigger: 'auto', messages: BASIC })
    await settle(() => calls.cleared > 0)
    expect(calls.cleared).toBe(1)
    expect(thresholdLine(calls)).toContain('window=500000 windowSource=default basis=thresholdPercent:80 hostWindowSource=none autoCompactThreshold=none via=session.compact')
  })

  test('the brief opens with the handoff instructions', async ($, on) => {
    const calls = engine(on, { tokens: 165_000 })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const brief = parseBrief(calls.written['/home/test/.claude/state/auto-handoff/old-session.md'] ?? '').body
    expect(brief.startsWith('## Instructions')).toBe(true)
    expect(brief).toContain('triggered by the system, not by a user')
    expect(brief).toContain('continue that work immediately')
    expect(brief).toContain('You MUST produce a text response')
    expect(brief).not.toContain('PRIORITY')
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    expect(calls.seeded[0]).toContain('follow its Instructions section')
  })

  test('each brief gets a viewer page, and the chain links forward once the next session hands off', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, env: { AI_DLC_AUTO_HANDOFF_VIEWER: 'tailscale:3846' } })
    const dir = '/home/test/.claude/state/auto-handoff'
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const first = parseBrief(calls.written[`${dir}/old-session.md`] ?? '').header
    expect(first.chain).toBe('old-session')
    expect(first.tokens).toBe('165000')
    expect(first.depth).toBe('1')
    expect(calls.prompts[0]).toContain('**Handoff depth:** 1')
    expect(calls.written[`${dir}/pages/old-session.html`]).toContain('Session Context')
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    // No Tailscale in the test, so the server falls back to localhost.
    expect(calls.seeded[0]).toContain('(readable copy: http://127.0.0.1:3846/old-sess)')
    expect(parseBrief(calls.written[`${dir}/old-session.md`] ?? '').header.to).toBe('new-session-1')
    // The seeded session hands off in turn: same chain, and its brief points back.
    // The seeded session's first turn sets its floor; the next one past the line hands off.
    calls.tokens = 47_000
    await $.turn.complete(TURN)
    calls.tokens = 260_000
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 1)
    const second = parseBrief(calls.written[`${dir}/new-session-1.md`] ?? '').header
    expect(second.chain).toBe('old-session')
    expect(second.from).toBe('old-session')
    expect(second.depth).toBe('2')
    expect(calls.prompts[1]).toContain('**Handoff depth:** 2')
    expect(calls.written[`${dir}/pages/new-session-1.html`]).toContain('href="old-session.html"')
  })

  test('AC-16.2.4 lineage without depth: new 4, stored depth 4 (a session seeded before a hot reload keeps its chain)', async ($, on) => {
    // Seen live: the reload wiped the in-memory lineage, and the next brief started a new chain.
    // The record was written before depth existed, so the title's number is the current one.
    const dir = '/home/test/.claude/state/auto-handoff'
    const calls = engine(on, { tokens: 165_000, store: { 'lineage:old-session': { from: 'earlier', chain: 'first' } } })
    await $.classic.SessionStart({ source: 'startup', session_title: '[ai-dlc:auto-handoff]: Fix the parser (Session 3)' } as never)
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const header = parseBrief(calls.written[`${dir}/old-session.md`] ?? '').header
    expect(header.from).toBe('earlier')
    expect(header.chain).toBe('first')
    expect(header.depth).toBe('3')
    expect(calls.prompts[0]).toContain('**Handoff depth:** 3')
    expect(calls.renamed).toEqual([])
    const answer = await $.classic.SessionStart({ source: 'clear' }) as { sessionTitle?: string }
    expect(answer.sessionTitle).toBe('[ai-dlc:auto-handoff]: Fix the parser (Session 4)')
    expect(calls.store.get('lineage:new-session-1')).toEqual({ from: 'old-session', chain: 'first', depth: 4, baseName: 'Fix the parser' })
  })

  test('depth carries through the store across a hot reload', async ($, on) => {
    const dir = '/home/test/.claude/state/auto-handoff'
    const calls = engine(on, { tokens: 165_000, store: { 'lineage:old-session': { from: 'earlier', chain: 'first', depth: 3 } } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(parseBrief(calls.written[`${dir}/old-session.md`] ?? '').header.depth).toBe('3')
    expect(calls.prompts[0]).toContain('**Handoff depth:** 3')
  })

  test('an unanswered last request puts a PRIORITY directive in the instructions', async ($, on) => {
    const brief = '## Last Request from the User\n"Make the thresholds vars"\nStatus: Partially answered.\n\n## Next Step\nAdd userConfig.'
    const calls = engine(on, { tokens: 165_000, brief })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const written = calls.written['/home/test/.claude/state/auto-handoff/old-session.md'] ?? ''
    expect(written).toContain('**PRIORITY:')
    expect(written).toContain('Do the PRIORITY request and nothing else.')
    expect(written.indexOf('**PRIORITY:')).toBeLessThan(written.indexOf('## Session Handoff Brief'))
  })

  test('the brief template file sets the sections Haiku is asked for', async ($, on) => {
    const files = { '/home/test/.claude/auto-handoff/brief.md': 'Write only:\n\n## Mood\nHow it went.' }
    const calls = engine(on, { tokens: 165_000, files, brief: '## Mood\nGood.' })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.prompts[0]).toContain('## Mood\nHow it went.')
    expect(calls.prompts[0]).not.toContain('## Dead Ends')
    // Valid against the custom template, so Haiku's text is kept.
    expect(calls.written['/home/test/.claude/state/auto-handoff/old-session.md']).toContain('## Mood\nGood.')
  })

  test('the instructions template file replaces the instructions', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, env: { AI_DLC_AUTO_HANDOFF_INSTRUCTIONS_TEMPLATE: '/custom/i.md' }, files: { '/custom/i.md': '## Rules\nJust keep going.' } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const brief = parseBrief(calls.written['/home/test/.claude/state/auto-handoff/old-session.md'] ?? '').body
    expect(brief.startsWith('## Rules\nJust keep going.')).toBe(true)
  })

  test('without sh, the log is written through fs and keeps every line', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, noSh: true })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const log = calls.written['/home/test/.claude/state/auto-handoff/auto-handoff.log'] ?? ''
    expect(log).toContain('threshold session=old-session tokens=165000')
    expect(log).toContain('brief written /home/test/.claude/state/auto-handoff/old-session.md')
  })

  test('a new session writes missing templates and leaves existing ones alone', async ($, on) => {
    const calls = engine(on, { tokens: 1_000, files: { '/home/test/.claude/auto-handoff/brief.md': 'mine' } })
    await $.classic.SessionStart({ source: 'startup' })
    expect(files(calls.written)).toEqual(['/home/test/.claude/auto-handoff/instructions.md'])
    expect(calls.written['/home/test/.claude/auto-handoff/instructions.md']).toContain('{{#priority}}')
  })

  test('renderTemplate keeps the branch that matches the flag', async () => {
    const t = 'A\n{{#priority}}P{{/priority}}{{^priority}}N{{/priority}}\nB'
    expect(renderTemplate(t, { priority: true })).toBe('A\nP\nB')
    expect(renderTemplate(t, { priority: false })).toBe('A\nN\nB')
  })

  test('renderTemplate treats a section named like an Object.prototype member as not set', async () => {
    for (const name of ['constructor', '__proto__']) {
      const t = `A\n{{#${name}}}SHOWN{{/${name}}}{{^${name}}}HIDDEN{{/${name}}}\nB`
      expect(renderTemplate(t, {})).toBe('A\nHIDDEN\nB')
      expect(renderTemplate(t, { priority: true })).toBe('A\nHIDDEN\nB')
    }
  })

  test('hasUnansweredLastRequest reads only the last-request section', async () => {
    expect(hasUnansweredLastRequest('## Last Request from the User\n"x"\nStatus: Not answered')).toBe(true)
    expect(hasUnansweredLastRequest('## Last Request from the User\n"x"\nStatus: Answered')).toBe(false)
    expect(hasUnansweredLastRequest('## Last Request from the User\nStatus: Answered\n\n## Open Questions\nStatus: Not answered')).toBe(false)
    expect(hasUnansweredLastRequest('## Last Request from the User\nNo user message found. Status: Not answered')).toBe(false)
    expect(hasUnansweredLastRequest('## Next Step\nStatus: Not answered')).toBe(false)
  })

  test('the brief carries the transcript path, verify block and facts', async ($, on) => {
    const messages = [
      msg('user', 'fix #846 please'),
      msg('assistant', 'committing', [edit('/repo/mod.ts', 'Write'), bash("git commit -m 'feat: x'", '[main 47edd8e] feat(mods): auto-handoff\n 2 files changed')]),
    ]
    const calls = engine(on, { tokens: 190_000, messages })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const brief = calls.written['/home/test/.claude/state/auto-handoff/old-session.md']
    expect(brief).toContain('`~/.claude/projects/-home-test-proj/old-session.jsonl`')
    expect(brief).toContain('## How to Use This Brief')
    expect(brief).toContain('Finish the parser refactor')
    expect(brief).toContain('- feat(mods): auto-handoff (47edd8e)')
    expect(brief).not.toContain('## Last Real User Message') // Haiku's section quotes it; no duplicate
    const prompt = calls.prompts[0] ?? ''
    expect(prompt).toContain('- /repo/mod.ts')
    expect(prompt).toContain('## Questions Answered')
    expect(prompt.indexOf('## Extracted Facts')).toBeLessThan(prompt.indexOf('## Next Step'))
  })

  test('a /clear from the user without a pending handoff seeds nothing', async ($, on) => {
    const calls = engine(on, { tokens: 1_000 })
    await $.classic.SessionStart({ source: 'clear' })
    expect(calls.seeded.length).toBe(0)
  })

  test('a seeded session that starts above the threshold does not loop', async ($, on) => {
    // The 2026-10-03 live run: threshold 20k, every fresh session started at ~31k.
    const calls = engine(on, { tokens: 31_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '20000' } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    await $.turn.complete(TURN) // the seed turn: sets the floor
    await $.turn.complete(TURN) // still ~31k: below floor + growth (a quarter of the threshold)
    await settle(() => false)
    expect(calls.cleared).toBe(1)

    calls.tokens = 90_000 // grew 59k past the floor
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 1)
    expect(calls.cleared).toBe(2)
  })

  test('a seeded session measures its floor at its first request, not at the end of its first turn', async ($, on) => {
    // Seen live: the seed turn read the whole mod and ran the suite three times, 47k to 129k,
    // with the pre-request check off; the floor landed at 129k and the next handoff moved out to 179k.
    const calls = engine(on, { tokens: 165_000, stepUsage: true, toolChars: 560_000 })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)

    calls.tokens = 47_000 // the fresh session, brief and CLAUDE.md loaded
    await step($, 0) // the seed turn's first request: this is the floor
    expect(calls.steps).toBe(1)
    await $.tool.call({ tool: 'Read', file_path: '/big.txt' }) // ~140k of reads land in the same turn
    const chunks = await step($, 1)
    expect(calls.steps).toBe(1) // stopped before the request that would carry 187k
    expect(chunks.some(c => c.kind === 'text' && c.text?.includes('auto-handoff'))).toBe(true)
    await settle(() => calls.cleared > 1)
    expect(calls.cleared).toBe(2)
  })

  // Hand off once per round with no typed prompt between rounds; growth clears the floor each time.
  async function unattendedRounds($: Parameters<TestBody>[0], calls: Calls, rounds: number) {
    for (let i = 0; i < rounds; i++) {
      const before = calls.cleared
      await $.turn.complete(TURN)
      await settle(() => calls.cleared > before)
      if (calls.cleared === before) return
      await $.classic.SessionStart({ source: 'clear' })
      await settle(() => calls.seeded.length >= calls.cleared)
      await $.turn.complete(TURN) // seed turn sets the floor
      calls.tokens += 60_000
    }
  }

  test('progress guard: no more than two handoffs without a typed prompt', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '20000' } })
    await unattendedRounds($, calls, 4)
    await settle(() => false)
    expect(calls.cleared).toBe(2)
  })

  test('maxConsecutiveHandoffs sets the progress guard', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '20000', AI_DLC_AUTO_HANDOFF_MAX_CONSECUTIVE: '1' } })
    await unattendedRounds($, calls, 3)
    await settle(() => false)
    expect(calls.cleared).toBe(1)
  })

  test('a seeded session gets 40k of headroom above its floor by default; unknown options do not change it', { options: { headroom: 1_000_000, growth: 1_000_000 } }, async ($, on) => {
    const calls = engine(on, { tokens: 120_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '100000' } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    calls.tokens = 90_000 // floor 90k: the line moves to 130k
    await $.turn.complete(TURN) // seed turn sets the floor
    calls.tokens = 125_000
    await $.turn.complete(TURN)
    await settle(() => false)
    expect(calls.cleared).toBe(1) // 125k: past the 100k threshold, short of floor + 40k
    calls.tokens = 131_000
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 1)
    expect(calls.cleared).toBe(2) // the ignored options did not hold it off
  })

  test('a threshold too close to the floor is raised, and the panel names the env var', async ($, on) => {
    // The 2026-10-04 live run: AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS=80000 left in a shell, seeded sessions start at
    // ~45k. max(80k, 45k + 20k) was 80k, so each seeded session handed off after ~35k of work: eight times.
    const calls = engine(on, { tokens: 85_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '80000' } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    calls.tokens = 45_000
    await $.turn.complete(TURN) // seed turn sets the floor: 35k of headroom, under the 40k minimum
    const warning = "threshold 80k (AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS in the environment) leaves 35k this session's 45k start: handing off at 85k instead"
    expect(await band($)).toContain(`⚠ ${warning}`)
    calls.tokens = 81_000 // past 80k; the old math handed off here
    await $.turn.complete(TURN)
    await settle(() => false)
    expect(calls.cleared).toBe(1)
    expect((await band($)).split(warning).length - 1).toBe(1) // warned once, not every turn
    calls.tokens = 86_000 // floor + 40k
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 1)
    expect(calls.cleared).toBe(2)
  })

  test('the headroom warning names the source of thresholdPercent', async ($, on) => {
    const calls = engine(on, { tokens: 65_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_PERCENT: '30' } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    calls.tokens = 45_000
    await $.turn.complete(TURN)
    expect(await band($)).toContain('threshold 60k (30% of the 200k window, AI_DLC_AUTO_HANDOFF_THRESHOLD_PERCENT in the environment) leaves 15k')
  })

  test('no headroom warning at the default threshold', async ($, on) => {
    const calls = engine(on, { tokens: 165_000 })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    calls.tokens = 45_000
    await $.turn.complete(TURN)
    expect(await band($)).not.toContain('threshold')
  })

  test('progress guard: a typed prompt resumes handoffs', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '20000' } })
    await unattendedRounds($, calls, 3)
    expect(calls.cleared).toBe(2)
    await $.prompt.submit({ text: 'keep going', origin: { kind: 'composer' } } as never)
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 2)
    expect(calls.cleared).toBe(3)
  })

  test('progress guard: a plugin or notification prompt is not progress', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '20000' } })
    await unattendedRounds($, calls, 3)
    await $.prompt.submit({ text: 'from a plugin', origin: { kind: 'plugin', name: 'other' } } as never)
    await $.prompt.submit({ text: 'task done', origin: { kind: 'task-notification' } } as never)
    await $.turn.complete(TURN)
    await settle(() => false)
    expect(calls.cleared).toBe(2)
  })

  test('a turn whose tool output would cross the threshold stops before the next request', async ($, on) => {
    // The 2026-10-03 case: measured 63k, then reads worth ~140k land in one turn.
    const calls = engine(on, { tokens: 63_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '80000' }, toolChars: 560_000 })
    await $.tool.call({ tool: 'Read', file_path: '/big.txt' })
    const chunks = await step($)
    expect(calls.steps).toBe(0)
    expect(chunks.some(c => c.kind === 'text' && c.text?.includes('auto-handoff'))).toBe(true)
    await settle(() => calls.cleared > 0)
    expect(calls.completes).toBe(1)
    expect(calls.cleared).toBe(1)
  })

  test('tool output that lands while the response streams still counts', async ($, on) => {
    // Seen live: eight reads ran mid-stream, then the stream's end zeroed the count.
    const calls = engine(on, { tokens: 61_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '80000' }, streamToolChars: 400_000 })
    const stream = $.turn.step({ ...STEP, index: 1 })[Symbol.asyncIterator]()
    await stream.next() // the response is still streaming
    await $.tool.call({ tool: 'Read', file_path: '/streamed.txt' }) // core runs the tool now
    while (!(await stream.next()).done) {}
    expect(calls.steps).toBe(1)
    const chunks = await step($, 2)
    expect(calls.steps).toBe(1)
    expect(chunks.some(c => c.kind === 'text' && c.text?.includes('auto-handoff'))).toBe(true)
  })

  test('auto-compact is replaced by a handoff', async ($, on) => {
    const calls = engine(on, { tokens: 174_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '80000' } })
    const r = await $.session.compact({ trigger: 'auto', messages: BASIC })
    expect(r.skip).toContain('auto-handoff')
    expect(calls.compacts).toBe(0)
    await settle(() => calls.cleared > 0)
    expect(calls.cleared).toBe(1)
  })

  test('a manual /compact is left alone', async ($, on) => {
    const calls = engine(on, { tokens: 174_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '80000' } })
    await $.session.compact({ trigger: 'manual', messages: BASIC })
    expect(calls.compacts).toBe(1)
    expect(calls.completes).toBe(0)
  })

  test('auto-compact goes ahead when the kill switch is set', async ($, on) => {
    const calls = engine(on, { tokens: 174_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '80000', AI_DLC_AUTO_HANDOFF_ENABLED: 'false' } })
    await $.session.compact({ trigger: 'auto', messages: BASIC })
    expect(calls.compacts).toBe(1)
    expect(calls.cleared).toBe(0)
  })

  test('small tool output under the threshold lets the request through', async ($, on) => {
    const calls = engine(on, { tokens: 63_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '80000' }, toolChars: 20_000 })
    await $.tool.call({ tool: 'Read', file_path: '/small.txt' })
    await step($)
    expect(calls.steps).toBe(1)
    expect(calls.completes).toBe(0)
  })

  test('the first request of a turn is never stopped', async ($, on) => {
    const calls = engine(on, { tokens: 63_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '80000' }, toolChars: 560_000 })
    await $.tool.call({ tool: 'Read', file_path: '/big.txt' })
    await step($, 0)
    expect(calls.steps).toBe(1)
  })

  test('a stale briefing marker from a mid-handoff reload is retried', async ($, on) => {
    // Seen live: threshold fired, the mod reloaded 71 ms later, the marker stayed at 'briefing'.
    const calls = engine(on, { tokens: 165_000, store: { 'fired:old-session': 'briefing' } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.completes).toBe(1)
    expect(calls.cleared).toBe(1)
  })

  test('a clearing or seeded marker still means fired once', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, store: { 'fired:old-session': 'seeded:new-session-1' } })
    await $.turn.complete(TURN)
    await settle(() => false)
    expect(calls.completes).toBe(0)
  })

  test('the panel above the prompt walks the handoff, then collapses', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, stepUsage: true, env: { AI_DLC_AUTO_HANDOFF_VIEWER: 'tailscale:3846' } })
    expect(await band($)).toBe('')
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const clearing = await band($)
    expect(clearing).toContain('auto-handoff · 165k / 160k')
    expect(clearing).toContain('✓ brief written')
    expect(clearing).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] clearing/)
    await clock.advance(100)
    expect(await band($)).not.toBe(clearing) // the spinner moved

    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    expect(await band($)).toContain('✓ cleared')
    expect(await band($)).toContain('starting the fresh session')

    calls.tokens = 47_000
    await step($, 0) // the seed turn's first request
    const done = await band($)
    expect(done).toContain('✓ handed off · 165k → 47k')
    expect(done).toContain('[open brief](http://127.0.0.1:3846/old-sess)')
    expect(done).not.toContain('Dismiss')
    await clock.advance(10_000)
    expect(await band($)).toBe('')
    expect(calls.toasts).toEqual([])
  })

  test('on the mobile app, which draws no band, the key moments go out as toasts', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, stepUsage: true, surfaces: ['terminal', 'mobile'] })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    await settle(() => calls.toasts.length > 0)
    expect(calls.toasts).toEqual(['context 165k is past 160k: handing off'])
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    calls.tokens = 47_000
    await step($, 0)
    await settle(() => calls.toasts.length > 1)
    expect(calls.toasts).toEqual(['context 165k is past 160k: handing off', '↪ handed off · 165k → 47k'])
  })

  test('a facts-only brief stays on the panel until dismissed', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, stepUsage: true, brief: null })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(await band($)).toContain('⚠ brief is facts only: the summary failed (empty-reply)')
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    calls.tokens = 47_000
    await step($, 0)
    await clock.advance(10_000)
    const ui = await mountBand($)
    expect(textOf(await ui.drawn())).toContain('⚠ brief is facts only')
    await ui.press({ key: 'dismiss' })
    // Only keep-alive's rows are left in the band (ITEM-068)
    expect(textOf(await ui.drawn())).toMatch(/^⚠ ai-dlc cache-keepalive:/)
    await ui.unmount()
  })

  test('past the threshold, tool calls are refused before they run', async ($, on) => {
    // Seen live: ~28 reads in one step took the session from 67k to 437k.
    const calls = engine(on, { tokens: 67_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '80000' }, toolChars: 220_000 })
    const results = []
    for (let i = 0; i < 28; i++) results.push(await $.tool.call({ tool: 'Read', file_path: `/export-${i}.txt` }))
    expect(calls.ran).toBe(1) // 67k + 55k crosses 80k after the first read
    expect(results.slice(1).every(r => 'deny' in r && r.deny?.includes('[auto-handoff] Not run'))).toBe(true)
    expect(calls.cleared).toBe(0) // the refusal does not hand off by itself

    await step($)
    expect(calls.steps).toBe(0) // the next request is stopped, under the window, and the handoff runs
    await settle(() => calls.cleared > 0)
    expect(calls.cleared).toBe(1)
    expect(calls.compacts).toBe(0)
  })

  test('a refused tool call hands off at turn end even when the real size comes in under the threshold', async ($, on) => {
    // Seen live: the gate projected 83.7k, the response measured 72.5k, and the session stopped with no handoff.
    const calls = engine(on, { tokens: 67_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '80000' }, toolChars: 220_000 })
    await $.tool.call({ tool: 'Read', file_path: '/a.txt' })
    const refused = await $.tool.call({ tool: 'Read', file_path: '/b.txt' })
    expect('deny' in refused && refused.deny?.includes('[auto-handoff] Not run')).toBe(true)
    calls.tokens = 72_500
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.cleared).toBe(1)
  })

  test('a refused tool call hands off at the next request, and the stop line does not claim a size under the threshold', async ($, on) => {
    const calls = engine(on, { tokens: 84_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '80000' } })
    const refused = await $.tool.call({ tool: 'Read', file_path: '/a.txt' })
    expect('deny' in refused).toBe(true)
    calls.tokens = 72_500 // the next measurement comes in under the threshold
    const chunks = await step($)
    expect(calls.steps).toBe(0)
    const text = chunks.map(c => c.text ?? '').join('')
    expect(text).toContain('A tool call was refused at the handoff threshold (80k)')
    expect(text).not.toContain('would carry')
    await settle(() => calls.cleared > 0)
    expect(calls.cleared).toBe(1)
  })

  test('without a refusal, a turn that ends under the threshold does not hand off', async ($, on) => {
    const calls = engine(on, { tokens: 67_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '80000' }, toolChars: 4_000 })
    await $.tool.call({ tool: 'Read', file_path: '/a.txt' })
    await $.turn.complete(TURN)
    await settle(() => false)
    expect(calls.cleared).toBe(0)
  })

  test("the person's own /clear dismisses the panel when no handoff is under way", async ($, on) => {
    const calls = engine(on, { tokens: 165_000, stepUsage: true, brief: null })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    calls.tokens = 47_000
    await step($, 0)
    await clock.advance(10_000)
    expect(await band($)).toContain('⚠ brief is facts only') // sticky
    await $.classic.SessionStart({ source: 'clear' })
    expect(await band($)).toBe('')
    expect(calls.seeded.length).toBe(1)
  })

  test('the handoff\'s own /clear keeps the panel', async ($, on) => {
    const calls = engine(on, { tokens: 165_000 })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    expect(await band($)).toContain('✓ cleared')
  })

  test('the tool gate never blocks a session the mod will not hand off', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, env: { AI_DLC_AUTO_HANDOFF_ENABLED: 'false' }, toolChars: 220_000 })
    await $.tool.call({ tool: 'Read', file_path: '/a.txt' })
    await $.tool.call({ tool: 'Read', file_path: '/b.txt' })
    expect(calls.ran).toBe(2)
  })

  test('the tool gate leaves subagents alone', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, toolChars: 220_000 })
    await $.tool.call({ tool: 'Read', file_path: '/a.txt', agentId: 'sub-1' } as never)
    expect(calls.ran).toBe(1)
  })

  test('the pre-request check honours the kill switch', async ($, on) => {
    const calls = engine(on, { tokens: 63_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '80000', AI_DLC_AUTO_HANDOFF_ENABLED: 'false' }, toolChars: 560_000 })
    await $.tool.call({ tool: 'Read', file_path: '/big.txt' })
    await step($)
    expect(calls.steps).toBe(1)
    expect(calls.completes).toBe(0)
  })
})

// An AI-DLC run on disk: a run state as the handoff skill's Run state template writes it (run.md
// from before versions; the versioned tests name run.v<N>.md).
const ROOT = '/home/test/proj'
const GIT: Git = { root: ROOT, branch: 'feat/x', commit: 'abc1234' }
const runMd = (o: { status?: string; branch?: string; session?: string; updated?: string; next?: string; stages?: string; lastRecord?: string } = {}) => `---
run: AAW-20261021-demo
work-item: WI-1
status: ${o.status ?? 'active'}
lifecycle: AAW
mode: subagent
current-stage: change
owner: orchestrator
session: ${o.session ?? ''}
branch: ${o.branch ?? 'feat/x'}
commit: abc1234
last-record: ${o.lastRecord ?? '2-orchestrator-to-agent-manager.handoff.md'}
updated: ${o.updated ?? '2026-10-21 11:10'}
---

# Run: AAW-20261021-demo — absorb the demo mod

## Stages
${o.stages ?? '| Step | Stage |\n|---|---|'}

## Next action
${o.next ?? 'Store agent-manager\'s report as `2-agent-manager-to-orchestrator.handback.md`.'}
`
const RUN_MD = `${ROOT}/docs/handoffs/AAW-20261021-demo/run.md`
const SCRATCH = new RegExp(`^${ROOT}/\\.scratch/AAW-20261021-demo/session-\\d{8}-\\d{4}\\.md$`)
const sessionHandoffOf = (written: Record<string, string>) => Object.keys(written).find(p => SCRATCH.test(p))

describe('ai-dlc run', () => {
  test('an active run on the branch gets the session handoff, run.md first, then the seed resumes it', async ($, on) => {
    const brief = '## In progress\nFinish the parser refactor.\n\n## Next steps\n1. Run the tests.'
    const calls = engine(on, { tokens: 165_000, git: GIT, brief, files: { [RUN_MD]: runMd() } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const path = sessionHandoffOf(calls.written)
    expect(path).toBeDefined()
    const handoff = calls.written[path!]!
    expect(handoff.startsWith('# Session handoff: AAW-20261021-demo — absorb the demo mod\n')).toBe(true)
    expect(handoff).toContain('- Run state: `docs/handoffs/AAW-20261021-demo/run.md`')
    expect(handoff).toContain('- Lifecycle / stage / step: AAW / change / 2, agent `orchestrator`')
    expect(handoff).toContain('- Branch and last commit: feat/x @ abc1234')
    expect(handoff).toContain('## Instructions')
    expect(handoff).toContain('## Resume the run')
    expect(handoff).toContain('## In progress\nFinish the parser refactor.')
    // The brief in the state folder holds the same body, so the chain and the viewer keep working.
    expect(calls.written['/home/test/.claude/state/auto-handoff/old-session.md']).toContain('# Session handoff: AAW-20261021-demo')
    // run.md points at the session handoff, quotes the old next action, and was written before the /clear.
    const state = calls.written[RUN_MD]!
    const rel = path!.slice(ROOT.length + 1)
    expect(state).toContain(`Continue stage \`change\` from the session handoff \`${rel}\``)
    expect(state).toContain("> Store agent-manager's report as `2-agent-manager-to-orchestrator.handback.md`.")
    expect(state).not.toContain('updated: 2026-10-21 11:10')
    expect(calls.clearedAtWrite[RUN_MD]).toBe(0)
    expect(calls.clearedAtWrite[path!]).toBe(0)

    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    expect(calls.seeded[0]).toContain(`Read the session handoff at ${path}`)
    expect(calls.seeded[0]).toContain('It continues AI-DLC run AAW-20261021-demo: resume the run from its run state docs/handoffs/AAW-20261021-demo/run.md')
    expect(calls.seeded[0]?.split('\n').length).toBe(1)
  })

  test('a versioned run: the highest run.v<N>.md is read and updated, no new version is written', async ($, on) => {
    const dir = `${ROOT}/docs/handoffs/AAW-20261021-demo`
    // v1 is an older session's version (another session, done): only v2 decides and is written.
    const files = { [`${dir}/run.v1.md`]: runMd({ status: 'done', session: 'earlier' }), [`${dir}/run.v2.md`]: runMd() }
    const calls = engine(on, { tokens: 165_000, git: GIT, files })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const path = sessionHandoffOf(calls.written)
    expect(path).toBeDefined()
    const handoff = calls.written[path!]!
    expect(handoff).toContain('- Run state: `docs/handoffs/AAW-20261021-demo/run.v2.md`')
    expect(handoff).not.toContain('`run.md`')
    expect(calls.written[`${dir}/run.v2.md`]).toContain(`from the session handoff \`${path!.slice(ROOT.length + 1)}\``)
    expect(calls.written[`${dir}/run.v1.md`]).toBeUndefined()
    expect(Object.keys(calls.written).some(p => /\/run\.v3\.md$|\/run\.md$/.test(p))).toBe(false)
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    expect(calls.seeded[0]).toContain('resume the run from its run state docs/handoffs/AAW-20261021-demo/run.v2.md,')
  })

  test('run.v10.md wins over run.v9.md: versions compare as numbers, not text', async ($, on) => {
    const dir = `${ROOT}/docs/handoffs/AAW-20261021-demo`
    // Read as text, v9 would win; it is done, so the run would not be picked at all.
    const files = { [`${dir}/run.v9.md`]: runMd({ status: 'done' }), [`${dir}/run.v10.md`]: runMd() }
    const calls = engine(on, { tokens: 165_000, git: GIT, files })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(sessionHandoffOf(calls.written)).toBeDefined()
    expect(calls.written[`${dir}/run.v10.md`]).toContain('automatic context-limit handoff')
    expect(calls.written[`${dir}/run.v9.md`]).toBeUndefined()
  })

  test('a minor pair: run.v1.2.md is read and updated, v1.1 and v1 are untouched, no new version', async ($, on) => {
    const dir = `${ROOT}/docs/handoffs/AAW-20261021-demo`
    // v1.1 records what the change of direction deprecated; v1.2 is current. Only v1.2 decides.
    const files = {
      [`${dir}/run.v1.md`]: runMd({ status: 'done', session: 'earlier' }),
      [`${dir}/run.v1.1.md`]: runMd({ status: 'done' }),
      [`${dir}/run.v1.2.md`]: runMd(),
    }
    const calls = engine(on, { tokens: 165_000, git: GIT, files })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const path = sessionHandoffOf(calls.written)
    expect(path).toBeDefined()
    expect(calls.written[path!]).toContain('- Run state: `docs/handoffs/AAW-20261021-demo/run.v1.2.md`')
    expect(calls.written[`${dir}/run.v1.2.md`]).toContain(`from the session handoff \`${path!.slice(ROOT.length + 1)}\``)
    expect(calls.written[`${dir}/run.v1.1.md`]).toBeUndefined()
    expect(calls.written[`${dir}/run.v1.md`]).toBeUndefined()
    expect(Object.keys(calls.written).some(p => /\/run\.v(?:1\.3|2)\.md$|\/run\.md$/.test(p))).toBe(false)
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    expect(calls.seeded[0]).toContain('resume the run from its run state docs/handoffs/AAW-20261021-demo/run.v1.2.md,')
  })

  test('a new major wins over the minors of the old one, and minors compare as numbers', async ($, on) => {
    const dir = `${ROOT}/docs/handoffs/AAW-20261021-demo`
    // v1.9 and v1.10 are done; only v2, the new major, is active. Minors read as text would rank
    // v1.9 over v1.10, and a minor ranked over its major's successor would end the run.
    const files = {
      [`${dir}/run.v1.9.md`]: runMd({ status: 'done' }),
      [`${dir}/run.v1.10.md`]: runMd({ status: 'done' }),
      [`${dir}/run.v2.md`]: runMd(),
    }
    const calls = engine(on, { tokens: 165_000, git: GIT, files })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(sessionHandoffOf(calls.written)).toBeDefined()
    expect(calls.written[`${dir}/run.v2.md`]).toContain('automatic context-limit handoff')
    expect(calls.written[`${dir}/run.v1.9.md`]).toBeUndefined()
    expect(calls.written[`${dir}/run.v1.10.md`]).toBeUndefined()
  })

  test('a done minor version ends the run even when its bare major is active', async ($, on) => {
    const dir = `${ROOT}/docs/handoffs/AAW-20261021-demo`
    const files = { [`${dir}/run.v1.md`]: runMd(), [`${dir}/run.v1.1.md`]: runMd({ status: 'done' }) }
    const calls = engine(on, { tokens: 165_000, git: GIT, files })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(sessionHandoffOf(calls.written)).toBeUndefined()
    for (const p of Object.keys(files)) expect(calls.written[p]).toBeUndefined()
  })

  test('zero and zero-padded versions are not run states: run.v01.md never outranks run.v1.md', async ($, on) => {
    const dir = `${ROOT}/docs/handoffs/AAW-20261021-demo`
    // Were v0, v01 or v1.01 accepted, a done one would tie or beat v1 and the run would not be picked.
    const files = {
      [`${dir}/run.v1.md`]: runMd(),
      [`${dir}/run.v0.md`]: runMd({ status: 'done' }),
      [`${dir}/run.v01.md`]: runMd({ status: 'done' }),
      [`${dir}/run.v1.01.md`]: runMd({ status: 'done' }),
      [`${dir}/run.v1.0.md`]: runMd({ status: 'done' }),
    }
    const calls = engine(on, { tokens: 165_000, git: GIT, files })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(sessionHandoffOf(calls.written)).toBeDefined()
    expect(calls.written[`${dir}/run.v1.md`]).toContain('automatic context-limit handoff')
    for (const n of ['run.v0.md', 'run.v01.md', 'run.v1.01.md', 'run.v1.0.md']) expect(calls.written[`${dir}/${n}`]).toBeUndefined()
  })

  test('a done newest version ends the run even when an older version is active', async ($, on) => {
    const dir = `${ROOT}/docs/handoffs/AAW-20261021-demo`
    const files = { [`${dir}/run.v1.md`]: runMd(), [`${dir}/run.v2.md`]: runMd({ status: 'done' }) }
    const calls = engine(on, { tokens: 165_000, git: GIT, files })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(sessionHandoffOf(calls.written)).toBeUndefined()
    for (const p of Object.keys(files)) expect(calls.written[p]).toBeUndefined()
  })

  test('a run.v<N>.md beside a stray run.md: the version is current and run.md is left alone', async ($, on) => {
    const dir = `${ROOT}/docs/handoffs/AAW-20261021-demo`
    // run.md is active, the version is the current one and is done: the run has ended.
    const files = { [`${dir}/run.md`]: runMd(), [`${dir}/run.v1.md`]: runMd({ status: 'done' }) }
    const calls = engine(on, { tokens: 165_000, git: GIT, files })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(sessionHandoffOf(calls.written)).toBeUndefined()
    expect(calls.written[`${dir}/run.md`]).toBeUndefined()
    expect(calls.written[`${dir}/run.v1.md`]).toBeUndefined()
  })

  test('near-named files are never the run state: only run.v<N>.md counts', async ($, on) => {
    const dir = `${ROOT}/docs/handoffs/AAW-20261021-demo`
    const files = {
      [`${dir}/run.v2.md`]: runMd(),
      [`${dir}/run.v3.md.bak`]: runMd({ status: 'done' }),
      [`${dir}/run.V9.md`]: runMd({ status: 'done' }),
      [`${dir}/myrun.v8.md`]: runMd({ status: 'done' }),
      [`${dir}/run.vx.md`]: runMd({ status: 'done' }),
    }
    const calls = engine(on, { tokens: 165_000, git: GIT, files })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(sessionHandoffOf(calls.written)).toBeDefined()
    expect(calls.written[`${dir}/run.v2.md`]).toContain('automatic context-limit handoff')
    for (const n of ['run.v3.md.bak', 'run.V9.md', 'myrun.v8.md', 'run.vx.md']) expect(calls.written[`${dir}/${n}`]).toBeUndefined()
  })

  test('a run.v<N>.md inside a sub-folder of the run folder is not the run state', async ($, on) => {
    const dir = `${ROOT}/docs/handoffs/AAW-20261021-demo`
    const files = { [`${dir}/run.v1.md`]: runMd(), [`${dir}/old/run.v9.md`]: runMd({ status: 'done' }) }
    const calls = engine(on, { tokens: 165_000, git: GIT, files })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.written[`${dir}/run.v1.md`]).toContain('automatic context-limit handoff')
    expect(calls.written[`${dir}/old/run.v9.md`]).toBeUndefined()
  })

  test('takeover guard: a current version written by another session is not touched', async ($, on) => {
    const dir = `${ROOT}/docs/handoffs/AAW-20261021-demo`
    // v1 is unclaimed and active, but the current version v2 names another session: no run is ours.
    const files = { [`${dir}/run.v1.md`]: runMd(), [`${dir}/run.v2.md`]: runMd({ session: 'someone-else' }) }
    const calls = engine(on, { tokens: 165_000, git: GIT, files })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(sessionHandoffOf(calls.written)).toBeUndefined()
    expect(calls.written[`${dir}/run.v1.md`]).toBeUndefined()
    expect(calls.written[`${dir}/run.v2.md`]).toBeUndefined()
  })

  test('the version read changes only updated and Next action; older versions are untouched', async ($, on) => {
    const dir = `${ROOT}/docs/handoffs/AAW-20261021-demo`
    const v1 = runMd({ status: 'done', session: 'earlier' })
    const v2 = runMd()
    const calls = engine(on, { tokens: 165_000, git: GIT, files: { [`${dir}/run.v1.md`]: v1, [`${dir}/run.v2.md`]: v2 } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const out = calls.written[`${dir}/run.v2.md`]!
    const head = (t: string) => t.slice(0, t.indexOf('## Next action'))
    expect(head(out).replace(/^updated:.*$/m, '')).toBe(head(v2).replace(/^updated:.*$/m, ''))
    expect(out).not.toContain('updated: 2026-10-21 11:10')
    expect(out).toMatch(/^updated: \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/m)
    expect(out.slice(out.indexOf('## Next action'))).toContain('Continue stage `change` from the session handoff')
    expect(calls.written[`${dir}/run.v1.md`]).toBeUndefined()
  })

  test('a failed write to a versioned run state names that file in the log', async ($, on) => {
    const dir = `${ROOT}/docs/handoffs/AAW-20261021-demo`
    const calls = engine(on, { tokens: 165_000, git: GIT, files: { [`${dir}/run.v2.md`]: runMd() }, failWrite: /\/run\.v2\.md$/ })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const path = sessionHandoffOf(calls.written)
    const log = calls.written['/home/test/.claude/state/auto-handoff/auto-handoff.log'] ?? ''
    expect(log).toContain('session handoff failed run=AAW-20261021-demo step="write run.v2.md"')
    expect(log).toContain(`${path} written but not linked from docs/handoffs/AAW-20261021-demo/run.v2.md`)
  })

  test('with a run, Haiku is asked for the session handoff sections', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, git: GIT, files: { [RUN_MD]: runMd() } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const prompt = calls.prompts[0] ?? ''
    expect(prompt).toContain('## Done so far')
    expect(prompt).not.toContain('## Questions Answered')
  })

  test('an unanswered last request in the session handoff still puts PRIORITY in the instructions', async ($, on) => {
    const brief = '## Done so far\n- nothing\n\n## Last request from the user\nplease refactor the parser\nStatus: Not answered'
    const calls = engine(on, { tokens: 165_000, git: GIT, brief, files: { [RUN_MD]: runMd() } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.written[sessionHandoffOf(calls.written)!]).toContain('PRIORITY')
  })

  for (const [name, state] of [
    ['a done run', runMd({ status: 'done' })],
    ['a blocked run', runMd({ status: 'blocked' })],
    ['a run on another branch', runMd({ branch: 'main' })],
  ] as const) {
    test(`${name} is left alone: the brief and its seed are the mod's own`, async ($, on) => {
      const calls = engine(on, { tokens: 165_000, git: GIT, files: { [RUN_MD]: state } })
      await $.turn.complete(TURN)
      await settle(() => calls.cleared > 0)
      expect(sessionHandoffOf(calls.written)).toBeUndefined()
      expect(calls.written[RUN_MD]).toBeUndefined()
      await $.classic.SessionStart({ source: 'clear' })
      await settle(() => calls.seeded.length > 0)
      expect(calls.seeded[0]).toContain('Read the brief at /home/test/.claude/state/auto-handoff/old-session.md')
    })
  }

  test('outside a git repository the handoff is the mod\'s own', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, files: { [RUN_MD]: runMd() } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(sessionHandoffOf(calls.written)).toBeUndefined()
    expect(calls.written[RUN_MD]).toBeUndefined()
  })

  test('of two active runs on the branch, the one this session wrote last wins', async ($, on) => {
    const other = `${ROOT}/docs/handoffs/AAW-20261022-newer/run.md`
    const files = { [RUN_MD]: runMd({ session: 'old-session', updated: '2026-10-21 09:00' }), [other]: runMd({ updated: '2026-10-22 09:00' }).replace('run: AAW-20261021-demo', 'run: AAW-20261022-newer') }
    const calls = engine(on, { tokens: 165_000, git: GIT, files })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(sessionHandoffOf(calls.written)).toBeDefined()
    expect(calls.written[other]).toBeUndefined()
  })

  for (const [name, files] of [
    ['the only active run, claimed by another session', { [RUN_MD]: runMd({ session: 'some-other-session' }) }],
    ['two unclaimed active runs', { [RUN_MD]: runMd(), [`${ROOT}/docs/handoffs/AAW-20261022-newer/run.md`]: runMd({ updated: '2026-10-22 09:00' }).replace('run: AAW-20261021-demo', 'run: AAW-20261022-newer') }],
    ['two active runs from other sessions', { [RUN_MD]: runMd({ session: 'a' }), [`${ROOT}/docs/handoffs/AAW-20261022-newer/run.md`]: runMd({ session: 'b', updated: '2026-10-22 09:00' }).replace('run: AAW-20261021-demo', 'run: AAW-20261022-newer') }],
  ] as const) {
    test(`${name}: no run is taken, the brief and its seed are the mod's own`, async ($, on) => {
      const calls = engine(on, { tokens: 165_000, git: GIT, files })
      await $.turn.complete(TURN)
      await settle(() => calls.cleared > 0)
      expect(Object.keys(calls.written).some(p => p.includes('/.scratch/'))).toBe(false)
      for (const p of Object.keys(files)) expect(calls.written[p]).toBeUndefined()
      await $.classic.SessionStart({ source: 'clear' })
      await settle(() => calls.seeded.length > 0)
      expect(calls.seeded[0]).toContain('Read the brief at /home/test/.claude/state/auto-handoff/old-session.md')
    })
  }

  test('a failed run.md write logs the step and the unlinked session handoff, and seeds the brief', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, git: GIT, files: { [RUN_MD]: runMd() }, failWrite: /\/run\.md$/ })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const path = sessionHandoffOf(calls.written)
    expect(path).toBeDefined()
    const log = calls.written['/home/test/.claude/state/auto-handoff/auto-handoff.log'] ?? ''
    expect(log).toContain('session handoff failed run=AAW-20261021-demo step="write run.md"')
    expect(log).toContain(`${path} written but not linked from docs/handoffs/AAW-20261021-demo/run.md`)
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    expect(calls.seeded[0]).toContain('Read the brief at /home/test/.claude/state/auto-handoff/old-session.md')
  })

  test('a failed session handoff write logs that step and leaves run.md alone', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, git: GIT, files: { [RUN_MD]: runMd() }, failWrite: /\/\.scratch\// })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const log = calls.written['/home/test/.claude/state/auto-handoff/auto-handoff.log'] ?? ''
    expect(log).toContain('step="write session handoff"')
    expect(log).not.toContain('written but not linked')
    expect(calls.written[RUN_MD]).toBeUndefined()
  })

  test('the handoff folder from .ai-dlc/workflow.json and the scratch root from AGENTS.md are honoured', async ($, on) => {
    const custom = `${ROOT}/records/runs/AAW-20261021-demo/run.md`
    const files = {
      [custom]: runMd(),
      [`${ROOT}/.ai-dlc/workflow.json`]: JSON.stringify({ artifacts: { handoffs: 'records/runs/{LIFECYCLE}-{YYYYMMDD}-{feature-slug}/' } }),
      [`${ROOT}/AGENTS.md`]: '| Folder | Root | One folder per |\n|---|---|---|\n| Scratch | `tmp/work` | session or task |\n',
    }
    const calls = engine(on, { tokens: 165_000, git: GIT, files })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(Object.keys(calls.written).some(p => p.startsWith(`${ROOT}/tmp/work/AAW-20261021-demo/session-`))).toBe(true)
    expect(calls.written[custom]).toContain('from the session handoff `tmp/work/AAW-20261021-demo/session-')
  })
})

// Hands off once per round with no typed prompt between rounds; growth clears the floor each time.
// Returns the SessionStart answers of the seeded sessions, in order.
async function chainRounds($: Parameters<TestBody>[0], calls: Calls, rounds: number) {
  const answers: { sessionTitle?: string }[] = []
  for (let i = 0; i < rounds; i++) {
    const before = calls.cleared
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > before)
    if (calls.cleared === before) return answers
    answers.push(await $.classic.SessionStart({ source: 'clear' }) as { sessionTitle?: string })
    await settle(() => calls.seeded.length >= calls.cleared)
    await $.turn.complete(TURN) // seed turn sets the floor
    calls.tokens += 60_000
  }
  return answers
}
const LOG_FILE = '/home/test/.claude/state/auto-handoff/auto-handoff.log'
const LOW = { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '20000' }

describe('chain while the run is active', () => {
  test('with an active run the chain goes on past maxConsecutiveHandoffs', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, env: LOW, git: GIT, files: { [RUN_MD]: runMd() } })
    await chainRounds($, calls, 5)
    await settle(() => false)
    expect(calls.cleared).toBe(5)
    // Every seed resumes the run: the chain kept finding it.
    expect(calls.seeded.every(s => s.includes('It continues AI-DLC run AAW-20261021-demo'))).toBe(true)
  })

  test('without a run the loop guard still stops the chain at two', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, env: LOW, git: GIT })
    await chainRounds($, calls, 5)
    await settle(() => false)
    expect(calls.cleared).toBe(2)
  })

  test('chainWhileRunActive false keeps the loop guard with an active run', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, env: { ...LOW, AI_DLC_AUTO_HANDOFF_CHAIN_WHILE_RUN_ACTIVE: 'false' }, git: GIT, files: { [RUN_MD]: runMd() } })
    await chainRounds($, calls, 5)
    await settle(() => false)
    expect(calls.cleared).toBe(2)
  })

  for (const status of ['done', 'blocked', 'abandoned']) {
    test(`the chain ends when its run becomes ${status}`, async ($, on) => {
      const calls = engine(on, { tokens: 31_000, env: LOW, git: GIT, files: { [RUN_MD]: runMd() } })
      await chainRounds($, calls, 1)
      expect(calls.cleared).toBe(1)
      calls.written[RUN_MD] = calls.written[RUN_MD]!.replace('status: active', `status: ${status}`)
      await chainRounds($, calls, 2)
      await settle(() => false)
      expect(calls.cleared).toBe(1)
      expect(calls.written[LOG_FILE]).toContain(`run AAW-20261021-demo is ${status}: chain ends`)
      expect(await band($)).toContain(`auto-handoff stopped: run AAW-20261021-demo is ${status}: chain ends`)
    })
  }

  test('a typed prompt after the chain ended lets the session hand off again, as its own brief', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, env: LOW, git: GIT, files: { [RUN_MD]: runMd() } })
    await chainRounds($, calls, 1)
    calls.written[RUN_MD] = calls.written[RUN_MD]!.replace('status: active', 'status: done')
    await chainRounds($, calls, 1)
    expect(calls.cleared).toBe(1)
    await $.prompt.submit({ text: 'one more thing', origin: { kind: 'composer' } } as never)
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 1)
    expect(calls.cleared).toBe(2)
  })

  test('the run is found through the lineage while run.md still names the first session', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, env: LOW, git: GIT, files: { [RUN_MD]: runMd({ session: 'old-session' }) } })
    await chainRounds($, calls, 3)
    expect(calls.cleared).toBe(3)
    expect(calls.seeded.length).toBe(3)
    for (const s of calls.seeded) expect(s).toContain('Read the session handoff at')
    // The third session (new-session-2) still wrote the run's Next action.
    expect(calls.written[RUN_MD]).toContain('from session new-sess')
  })

  test('a run claimed by a session outside the chain is never taken', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, env: LOW, git: GIT, files: { [RUN_MD]: runMd({ session: 'someone-else' }) } })
    await chainRounds($, calls, 4)
    expect(calls.cleared).toBe(2) // no run of its own: the loop guard applies
    expect(calls.seeded.every(s => s.includes('Read the brief at'))).toBe(true)
  })
})

describe('chain guard on the tool gate and retired names', () => {
  const READ = { tool: 'Read', file_path: '/big.txt' } as const
  const refused = (r: unknown) => typeof r === 'object' && r !== null && 'deny' in r

  test('[AC-1] the tool gate keeps refusing past maxConsecutiveHandoffs while the chain run is active', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, env: LOW, git: GIT, files: { [RUN_MD]: runMd() }, toolChars: 220_000 })
    await chainRounds($, calls, 3)
    expect(refused(await $.tool.call(READ))).toBe(true)
  })

  test('[AC-3] the tool gate lets calls run once the loop guard has paused a chain with no run', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, env: LOW, git: GIT, toolChars: 220_000 })
    await chainRounds($, calls, 3)
    expect(calls.cleared).toBe(2)
    expect(refused(await $.tool.call(READ))).toBe(false)
  })

  test('[AC-2] the tool gate lets calls run once the chain run is done', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, env: LOW, git: GIT, files: { [RUN_MD]: runMd() }, toolChars: 220_000 })
    await chainRounds($, calls, 1) // one handoff in: only the ended run, not the loop guard, can stop the gate
    calls.written[RUN_MD] = calls.written[RUN_MD]!.replace('status: active', 'status: done')
    expect(refused(await $.tool.call(READ))).toBe(false)
  })

  for (const [name, value] of [['AUTO_HANDOFF_TOKENS', '20000'], ['AUTO_HANDOFF_DISABLE', '1'], ['AUTO_HANDOFF_ENABLED', 'false']] as const) {
    test(`[AC-8] the retired variable ${name} is ignored`, async ($, on) => {
      const calls = engine(on, { tokens: 165_000, env: { [name]: value } })
      await $.turn.complete(TURN)
      await settle(() => calls.cleared > 0)
      expect(calls.cleared).toBe(1) // handed off at the default 80% line of 200k; none of the old names moved or stopped it
    })
  }
})

// A Stages table with a done, an in-progress, a pending and a skipped stage.
const STAGES = `| Step | Stage | Owner | Mode | Status | Handoff | Handback | Updated |
|---|---|---|---|---|---|---|---|
| 1 | research | research-assistant | subagent | done (passed) | \`1-orchestrator-to-research-assistant.handoff.md\` | \`1-research-assistant-to-orchestrator.handback.md\` | 2026-10-22 |
| 2 | change | agent-manager | subagent | in-progress | \`2-orchestrator-to-agent-manager.handoff.md\` | — | 2026-10-22 |
| 3.x | critique | brutal-critique | subagent | pending | \`3.1-orchestrator-to-brutal-critique.handoff.md\` | — | 2026-10-22 |
| 0 | spike | research-assistant | subagent | skipped | \`0-orchestrator-to-research-assistant.handoff.md\` | — | 2026-10-22 |`
const RUN_DIR = `${ROOT}/docs/handoffs/AAW-20261021-demo`

describe('handoff records', () => {
  test('the session handoff lists the open records, last-record and its pair first, and the seed names them', async ($, on) => {
    const files = {
      [RUN_MD]: runMd({ stages: STAGES }),
      [`${RUN_DIR}/2-orchestrator-to-agent-manager.handoff.md`]: 'brief',
      [`${RUN_DIR}/1-orchestrator-to-research-assistant.handoff.md`]: 'done brief',
    }
    const calls = engine(on, { tokens: 165_000, git: GIT, files })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const handoff = calls.written[sessionHandoffOf(calls.written)!]!
    const section = handoff.slice(handoff.indexOf('## Handoff records'))
    const paths = [...section.matchAll(/^- `([^`]+)`/gm)].map(m => m[1])
    expect(paths.slice(0, 1)).toEqual(['docs/handoffs/AAW-20261021-demo/run.md'])
    expect(paths[1]).toMatch(/^\.scratch\/AAW-20261021-demo\/session-\d{8}-\d{4}\.md$/)
    expect(paths.slice(2)).toEqual([
      'docs/handoffs/AAW-20261021-demo/2-orchestrator-to-agent-manager.handoff.md',
      'docs/handoffs/AAW-20261021-demo/2-agent-manager-to-orchestrator.handback.md',
      'docs/handoffs/AAW-20261021-demo/3.1-orchestrator-to-brutal-critique.handoff.md',
    ])
    expect(section).toContain('`docs/handoffs/AAW-20261021-demo/2-orchestrator-to-agent-manager.handoff.md` — last record, step 2, in-progress')
    expect(section).toContain('`docs/handoffs/AAW-20261021-demo/2-agent-manager-to-orchestrator.handback.md` (missing) — its pair')
    expect(section).toContain('`docs/handoffs/AAW-20261021-demo/3.1-orchestrator-to-brutal-critique.handoff.md` (missing)')
    // Done and skipped stages are left out.
    expect(section).not.toContain('1-orchestrator-to-research-assistant')
    expect(section).not.toContain('0-orchestrator-to-research-assistant')
    // Built in code, ahead of what Haiku wrote.
    expect(handoff.indexOf('## Handoff records')).toBeLessThan(handoff.indexOf('## How to Use This Brief'))
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    expect(calls.seeded[0]).toContain('resume the run from its run state docs/handoffs/AAW-20261021-demo/run.md')
    expect(calls.seeded[0]).toContain('read the open records its Handoff records section lists')
  })

  test('a round code in last-record is found: the round in progress first, the done first pass left out', async ($, on) => {
    const stages = `| Step | Stage | Owner | Mode | Status | Sessions | Agents | Handoff | Handback | Updated |
|---|---|---|---|---|---|---|---|---|---|
| 1.2 | change | agent-manager | subagent | done | \`s1\` | agent-manager | \`1.2-orchestrator-to-agent-manager.handoff.md\` | \`1.2-agent-manager-to-orchestrator.handback.md\` | 2026-10-24 |
| 1.3 | testing, loop \`1.3.l1\` round 1 | sqa-engineer | subagent | in-progress | \`s1\` | sqa-engineer, agent-manager | \`1.3-orchestrator-to-sqa-engineer.handoff.md\`, \`1.3.l1.1-orchestrator-to-agent-manager.handoff.md\`, \`1.3.l1.1-orchestrator-to-sqa-engineer.handoff.md\` | \`1.3-sqa-engineer-to-orchestrator.handback.md\`, \`1.3.l1.1-agent-manager-to-orchestrator.handback.md\` | 2026-10-24 |`
    const last = '1.3.l1.1-agent-manager-to-orchestrator.handback.md'
    const calls = engine(on, { tokens: 165_000, git: GIT, files: { [RUN_MD]: runMd({ stages, lastRecord: last }), [`${RUN_DIR}/${last}`]: 'report' } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const handoff = calls.written[sessionHandoffOf(calls.written)!]!
    expect(handoff).toContain(' / 1.3.l1.1, agent ')
    const section = handoff.slice(handoff.indexOf('## Handoff records'))
    const paths = [...section.matchAll(/^- `([^`]+)`/gm)].map(m => m[1])
    expect(paths.slice(2)).toEqual([
      `docs/handoffs/AAW-20261021-demo/${last}`,
      'docs/handoffs/AAW-20261021-demo/1.3.l1.1-orchestrator-to-agent-manager.handoff.md',
      'docs/handoffs/AAW-20261021-demo/1.3.l1.1-orchestrator-to-sqa-engineer.handoff.md',
    ])
    expect(section).toContain(`\`docs/handoffs/AAW-20261021-demo/${last}\` — last record, step 1.3.l1.1 in 1.3, in-progress`)
    expect(section).not.toContain('1.3-orchestrator-to-sqa-engineer')
    expect(section).not.toContain('1.3-sqa-engineer-to-orchestrator')
    expect(section).not.toContain('1.2-orchestrator-to-agent-manager')
  })

  test('without a run the brief has no records section', async ($, on) => {
    const calls = engine(on, { tokens: 165_000 })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.written['/home/test/.claude/state/auto-handoff/old-session.md']).not.toContain('## Handoff records')
  })
})

describe('session names', () => {
  test('AC-16.1.1 a main session is renamed Session 1 and the new one is Session 2', async ($, on) => {
    const calls = engine(on, { tokens: 165_000 })
    const name = await handOffTitled($, calls, 'Fix the parser')
    // The first session is renamed before its /clear; the seeded one is named through SessionStart.
    expect(calls.renamed).toEqual([`${P}: Fix the parser (Session 1)`])
    expect(calls.commandOrder.slice(0, 2)).toEqual(['rename', 'clear'])
    expect(name).toBe(`${P}: Fix the parser (Session 2)`)
    expect(calls.store.get('lineage:new-session-1')).toEqual({ from: 'old-session', chain: 'old-session', depth: 2, baseName: 'Fix the parser' })
  })

  test('AC-16.2.1 title Session 3, depth 3: new 4, no rename', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, store: { 'lineage:old-session': { from: 'earlier', chain: 'first', depth: 3, baseName: 'Fix the parser' } } })
    const name = await handOffTitled($, calls, `${P}: Fix the parser (Session 3)`)
    expect(calls.renamed).toEqual([])
    expect(calls.commandOrder).not.toContain('rename')
    expect(name).toBe(`${P}: Fix the parser (Session 4)`)
  })

  test('AC-16.2.2 title Session 7 and no lineage: new 8, not renamed (a session already carrying the chain name is not wrapped again)', async ($, on) => {
    const calls = engine(on, { tokens: 165_000 })
    const name = await handOffTitled($, calls, `${P}: Fix the parser (Session 7)`)
    expect(calls.renamed).toEqual([])
    expect(name).toBe(`${P}: Fix the parser (Session 8)`)
    expect((calls.store.get('lineage:new-session-1') as { depth?: number }).depth).toBe(8)
  })

  test('AC-16.2.3 title Session 7, depth 2: new 8', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, store: { 'lineage:old-session': { from: 'earlier', chain: 'first', depth: 2, baseName: 'Fix the parser' } } })
    const name = await handOffTitled($, calls, `${P}: Fix the parser (Session 7)`)
    expect(calls.renamed).toEqual([])
    expect(name).toBe(`${P}: Fix the parser (Session 8)`)
  })

  test('[LLD 3.3.5] the chain keeps the base name its lineage carries, not a later title (the chain original)', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, store: { 'lineage:old-session': { from: 'earlier', chain: 'first', depth: 3, baseName: 'Fix the parser' } } })
    const name = await handOffTitled($, calls, `${P}: Renamed by the person (Session 3)`)
    expect(calls.renamed).toEqual([])
    expect(name).toBe(`${P}: Fix the parser (Session 4)`)
    expect((calls.store.get('lineage:new-session-1') as { baseName?: string }).baseName).toBe('Fix the parser')
  })

  test('AC-16.2.5 a failed store read: new 4 and exactly one fallback notice', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, failStore: /^lineage:old-session$/, surfaces: ['vscode'] })
    const name = await handOffTitled($, calls, `${P}: Fix the parser (Session 3)`)
    expect(name).toBe(`${P}: Fix the parser (Session 4)`)
    expect(calls.renamed).toEqual([])
    await settle(() => calls.seeded.length > 0)
    const step = 'numbering: store unreadable, number taken from the title, chain id restarted'
    expect(fallbacks(calls)).toBe(1)
    // The engine rejects a denied read as "HooksError: <plugin>: $.store.get: <reason>".
    expect(calls.written[LOG_FILE]).toMatch(/numbering fallback: lineage read failed session=old-session \([^)]*store unreadable\); number 3 taken from the title \(Session 3\), chain id restarted\n/)
    expect(await band($)).toContain(step)
    // The fresh session's first measurement still lists it, with no second log line or toast.
    calls.tokens = 47_000
    await $.turn.complete(TURN)
    expect(await band($)).toContain(step)
    const handedOff = () => calls.toasts.some(t => t.startsWith('↪ handed off'))
    await settle(handedOff)
    expect(handedOff()).toBe(true)
    expect(fallbacks(calls)).toBe(1)
    expect(calls.toasts.filter(t => t === step)).toEqual([step])
    // The chain id restarted: the new lineage's chain is this session.
    expect((calls.store.get('lineage:new-session-1') as { chain?: string }).chain).toBe('old-session')
  })

  test('AC-16.2.5b a failed read with an unnumbered title: new Session 2, no rename', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, failStore: /^lineage:old-session$/ })
    const name = await handOffTitled($, calls, 'Fix the parser')
    expect(name).toBe(`${P}: Fix the parser (Session 2)`)
    expect(calls.renamed).toEqual([])
    expect(fallbacks(calls)).toBe(1)
    expect(calls.written[LOG_FILE]).toContain('number defaulted to 1, the title has none')
    expect(await band($)).toContain('numbering: store unreadable, number defaulted to 1, chain id restarted, session not renamed')
  })

  test('AC-16.2.6 a seeded session resumed with the same id: new 5', async ($, on) => {
    // The record its own seed wrote: depth 4, the chain's base name.
    const calls = engine(on, { tokens: 165_000, store: { 'lineage:old-session': { from: 'earlier', chain: 'first', depth: 4, baseName: 'Fix the parser' } } })
    const name = await handOffTitled($, calls, `${P}: Fix the parser (Session 4)`, 'resume')
    expect(calls.renamed).toEqual([])
    expect(name).toBe(`${P}: Fix the parser (Session 5)`)
  })

  test('AC-16.2.7 no /rename and title Session 3: new 4', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, commands: ['clear'] })
    const name = await handOffTitled($, calls, `${P}: Fix the parser (Session 3)`)
    expect(calls.renamed).toEqual([])
    expect(name).toBe(`${P}: Fix the parser (Session 4)`)
  })

  test('AC-16.2.8 title without a number, depth 3: new 4, no rename', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, store: { 'lineage:old-session': { from: 'earlier', chain: 'first', depth: 3, baseName: 'Fix the parser' } } })
    const name = await handOffTitled($, calls, `${P}: Fix the parser`)
    expect(calls.renamed).toEqual([])
    expect(name).toBe(`${P}: Fix the parser (Session 4)`)
  })

  test('AC-16.3.1 a prefixed title without a number: Session 1 then 2, the prefix once', async ($, on) => {
    const calls = engine(on, { tokens: 165_000 })
    const name = await handOffTitled($, calls, `${P}: Fix the parser`)
    expect(calls.renamed).toEqual([`${P}: Fix the parser (Session 1)`])
    expect(name).toBe(`${P}: Fix the parser (Session 2)`)
  })

  // The starting titles of the wiring tests above (AC-16.1.1 to AC-16.3.1, AC-16.3.5), each without lineage.
  for (const title of ['Fix the parser', `${P}: Fix the parser (Session 3)`, `${P}: Fix the parser (Session 7)`, `${P}: Fix the parser`, 'Fix the parser (Session 3)', `${P}: ${P}: Fix the parser (Session 1) (Session 2)`]) {
    test(`AC-16.3.2 every name has the prefix once and one suffix: ${title}`, async ($, on) => {
      const calls = engine(on, { tokens: 165_000 })
      const name = await handOffTitled($, calls, title)
      for (const n of [...calls.renamed, name ?? '']) {
        expect(n.split(P).length - 1).toBe(1)
        expect(n.match(/\(Session \d+\)/g)?.length).toBe(1)
      }
    })
  }

  test('AC-16.3.3 the old default prefix is stripped, another X: is kept', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, env: { AI_DLC_AUTO_HANDOFF_SESSION_NAME_PREFIX: '[handoff]' } })
    const name = await handOffTitled($, calls, `${P}: Fix the parser (Session 3)`)
    expect(name).toBe('[handoff]: Fix the parser (Session 4)')
    expect(name).not.toContain(P)
  })

  test('AC-16.3.5 a numbered title without the prefix: P: B (Session 4), no rename', async ($, on) => {
    const calls = engine(on, { tokens: 165_000 })
    const name = await handOffTitled($, calls, 'Fix the parser (Session 3)')
    expect(calls.renamed).toEqual([])
    expect(name).toBe(`${P}: Fix the parser (Session 4)`)
  })

  test('AC-16.4.1 four handoffs give sessions 1 to 5', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, env: LOW, git: GIT, files: { [RUN_MD]: runMd() } })
    await $.classic.SessionStart({ source: 'startup', session_title: 'Fix the parser' } as never)
    const answers = await chainRounds($, calls, 4)
    expect(calls.renamed).toEqual([`${P}: Fix the parser (Session 1)`])
    expect(answers.map(a => a.sessionTitle)).toEqual([2, 3, 4, 5].map(n => `${P}: Fix the parser (Session ${n})`))
  })

  test('AC-16.4.2 the store fails at the third handoff: still 1 to 5', async ($, on) => {
    // new-session-2 makes the third handoff; its numbering read goes to the store and fails.
    const calls = engine(on, { tokens: 31_000, env: LOW, git: GIT, files: { [RUN_MD]: runMd() }, failStore: /^lineage:new-session-2$/ })
    await $.classic.SessionStart({ source: 'startup', session_title: 'Fix the parser' } as never)
    const answers = await chainRounds($, calls, 4)
    expect(calls.renamed).toEqual([`${P}: Fix the parser (Session 1)`])
    expect(answers.map(a => a.sessionTitle)).toEqual([2, 3, 4, 5].map(n => `${P}: Fix the parser (Session ${n})`))
    expect(fallbacks(calls)).toBe(1)
  })

  test('without a title from the engine, the transcript\'s custom-title names the chain, else the short id', async ($, on) => {
    const transcript = '/home/test/.claude/projects/-home-test-proj/old-session.jsonl'
    const lines = ['{"type":"ai-title","aiTitle":"Guessed","sessionId":"old-session"}', '{"type":"custom-title","customTitle":"Named by me","sessionId":"old-session"}'].join('\n')
    const calls = engine(on, { tokens: 165_000, files: { [transcript]: lines } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.renamed).toEqual(['[ai-dlc:auto-handoff]: Named by me (Session 1)'])
  })

  test('AC-16.1.2 no title: the short id is the base', async ($, on) => {
    const calls = engine(on, { tokens: 165_000 })
    const name = await handOffTitled($, calls)
    expect(calls.renamed).toEqual(['[ai-dlc:auto-handoff]: old-sess (Session 1)'])
    expect(name).toBe('[ai-dlc:auto-handoff]: old-sess (Session 2)')
  })

  test('without /rename the old session keeps its name, and the new one is still named', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, commands: ['clear'] })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.renamed).toEqual([])
    expect(calls.written[LOG_FILE]).toContain('rename unavailable')
    const answer = await $.classic.SessionStart({ source: 'clear' }) as { sessionTitle?: string }
    expect(answer.sessionTitle).toBe('[ai-dlc:auto-handoff]: old-sess (Session 2)')
  })

  test('a failed rename is logged and the handoff goes on', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, failRename: true })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.cleared).toBe(1)
    await settle(() => (calls.written[LOG_FILE] ?? '').includes('rename failed'))
    expect(calls.written[LOG_FILE]).toContain('rename failed session=old-session')
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    expect(calls.seeded.length).toBe(1)
  })

  test('renameSessions false names nothing', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, env: { AI_DLC_AUTO_HANDOFF_RENAME_SESSIONS: 'false' } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.renamed).toEqual([])
    const answer = await $.classic.SessionStart({ source: 'clear' }) as { sessionTitle?: string }
    expect(answer.sessionTitle).toBeUndefined()
  })

  test('renameSessions false with a numbered title names nothing, and the chain is still numbered', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, env: { AI_DLC_AUTO_HANDOFF_RENAME_SESSIONS: 'false' } })
    const name = await handOffTitled($, calls, `${P}: Fix the parser (Session 3)`)
    expect(calls.renamed).toEqual([])
    expect(name).toBeUndefined()
    await settle(() => calls.seeded.length > 0)
    expect(calls.store.get('lineage:new-session-1')).toEqual({ from: 'old-session', chain: 'old-session', depth: 4, baseName: 'Fix the parser' })
  })

  test('sessionNamePrefix changes the prefix', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, env: { AI_DLC_AUTO_HANDOFF_SESSION_NAME_PREFIX: '[handoff]' } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.renamed).toEqual(['[handoff]: old-sess (Session 1)'])
  })
})

describe('repository configuration', () => {
  const LOCAL = `${ROOT}/.claude/settings.local.json`
  const SHARED = `${ROOT}/.claude/settings.json`
  const REPO = `${ROOT}/.ai-dlc/auto-handoff.json`
  const tokensEnv = (n: number | string) => JSON.stringify({ env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: n } })
  const all = { [LOCAL]: tokensEnv('30000'), [SHARED]: tokensEnv(40000), [REPO]: JSON.stringify({ thresholdTokens: 60000 }) }
  const without = (...drop: string[]) => Object.fromEntries(Object.entries(all).filter(([p]) => !drop.includes(p)))
  const thresholdIn = (calls: Calls) => /threshold session=old-session tokens=\d+ threshold=(\d+)/.exec(calls.written[LOG_FILE] ?? '')?.[1]

  for (const [name, files, env, expected] of [
    ['settings.local.json env wins over everything', all, { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '50000' }, '30000'],
    ['then settings.json env', without(LOCAL), { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '50000' }, '40000'],
    ['then the process environment', without(LOCAL, SHARED), { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '50000' }, '50000'],
    ['then .ai-dlc/auto-handoff.json', without(LOCAL, SHARED), {}, '60000'],
  ] as const) {
    test(`precedence: ${name}`, async ($, on) => {
      const calls = engine(on, { tokens: 190_000, git: GIT, files, env })
      await $.turn.complete(TURN)
      await settle(() => calls.cleared > 0)
      expect(thresholdIn(calls)).toBe(expected)
    })
  }

  test('precedence: the repository file beats the default, and a former /config row is not read', { options: { thresholdPercent: 50 } }, async ($, on) => {
    const calls = engine(on, { tokens: 190_000, git: GIT, files: { [REPO]: JSON.stringify({ thresholdPercent: 60 }) } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(thresholdIn(calls)).toBe('120000') // 60% of 200k
  })

  test('precedence: with no source set, the default applies, whatever a former /config row holds', { options: { thresholdPercent: 50 } }, async ($, on) => {
    const calls = engine(on, { tokens: 190_000, git: GIT })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(thresholdIn(calls)).toBe('160000') // 80% of 200k
  })

  test('an invalid value is logged and falls through to the next source', async ($, on) => {
    const calls = engine(on, { tokens: 190_000, git: GIT, files: { ...without(LOCAL), [LOCAL]: tokensEnv('lots') } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(thresholdIn(calls)).toBe('40000')
    expect(calls.written[LOG_FILE]).toContain('config: AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS="lots" in .claude/settings.local.json ignored')
  })

  test('settings files with comments are read, and a broken one is logged and skipped', async ($, on) => {
    const files = { [LOCAL]: '{ not json', [SHARED]: '{\n  // team settings\n  "env": { "AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS": "40000" } /* end */\n}' }
    const calls = engine(on, { tokens: 190_000, git: GIT, files })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(thresholdIn(calls)).toBe('40000')
    expect(calls.written[LOG_FILE]).toContain('config: .claude/settings.local.json is not valid JSON')
  })

  test('null in the repository file means not set here', async ($, on) => {
    const calls = engine(on, { tokens: 190_000, git: GIT, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_PERCENT: '50' }, files: { [REPO]: JSON.stringify({ $schema: './auto-handoff.schema.json', thresholdPercent: null, thresholdTokens: null }) } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(thresholdIn(calls)).toBe('100000')
  })

  test('enabled false in the repository file turns the module off', async ($, on) => {
    const calls = engine(on, { tokens: 190_000, git: GIT, files: { [REPO]: JSON.stringify({ enabled: false }) } })
    await $.turn.complete(TURN)
    await settle(() => false)
    expect(calls.cleared).toBe(0)
    expect(calls.written[LOG_FILE]).toContain('reason=enabled=false (enabled in .ai-dlc/auto-handoff.json)')
  })

  test('the settings are reloaded at each session start, so a chain picks up an edit', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, git: GIT, files: { [REPO]: JSON.stringify({ thresholdTokens: 20000 }) } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    calls.written[REPO] = JSON.stringify({ thresholdTokens: 500000 })
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    await $.turn.complete(TURN) // seed turn sets the floor
    calls.tokens = 200_000
    await $.turn.complete(TURN)
    await settle(() => false)
    expect(calls.cleared).toBe(1)
  })

  test('a window read before a reload to thresholdTokens does not leak into the threshold line', async ($, on) => {
    // The first turn computes a percent threshold (and caches its window); the settings then switch to an
    // absolute count, so the next handoff must log window=none, not the stale 200000.
    const calls = engine(on, { tokens: 31_000, git: GIT, files: { [REPO]: JSON.stringify({ thresholdPercent: 80 }) } })
    await $.turn.complete(TURN)
    await settle(() => false)
    expect(calls.cleared).toBe(0)
    calls.written[REPO] = JSON.stringify({ thresholdTokens: 20000 })
    await $.classic.SessionStart({ source: 'resume' })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const line = (calls.written['/home/test/.claude/state/auto-handoff/auto-handoff.log'] ?? '').split(/\r?\n/).find((l) => l.includes('threshold session=')) ?? ''
    expect(line).toContain('threshold=20000 window=none windowSource=none basis=thresholdTokens hostWindowSource=none autoCompactThreshold=none via=')
  })

  test('defaultContextWindow and seedHeadroomTokens come from the settings', async ($, on) => {
    const calls = engine(on, { tokens: 85_000, window: null, git: GIT, files: { [REPO]: JSON.stringify({ defaultContextWindow: 100000, seedHeadroomTokens: 0 }) } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(thresholdIn(calls)).toBe('80000') // 80% of the 100k fallback
  })

  test('each session start records whether /rename exists, for init to read', async ($, on) => {
    const calls = engine(on, { tokens: 1_000 })
    await $.classic.SessionStart({ source: 'startup' })
    const caps = JSON.parse(calls.written['/home/test/.claude/state/auto-handoff/capabilities.json'] ?? '{}')
    expect(caps.rename).toBe(true)
    expect(caps.claudeCodeVersion).toBe('2.1.306')
  })

  test('the capabilities record says so when /rename is missing', async ($, on) => {
    const calls = engine(on, { tokens: 1_000, commands: ['clear'] })
    await $.classic.SessionStart({ source: 'startup' })
    expect(JSON.parse(calls.written['/home/test/.claude/state/auto-handoff/capabilities.json'] ?? '{}').rename).toBe(false)
  })
})

describe('extractFacts', () => {
  test('heredoc commit messages count when git output is not in yet', async () => {
    const f = extractFacts([msg('assistant', '', [bash("git add x && git commit -F - <<'EOF'\nfix(mods): loop guard\n\nWHY: chained six times\nEOF")])])
    expect(f.commits).toEqual(['fix(mods): loop guard'])
  })

  test('git output wins, and a commit that did not land is dropped', async () => {
    const f = extractFacts([msg('assistant', '', [
      bash('git commit -m "first"', '[main abc1234] first real subject\n 1 file changed'),
      bash('git commit -m "second"', 'nothing to commit, working tree clean'),
      bash('git commit -m "third"', 'hook rejected', true),
    ])])
    expect(f.commits).toEqual(['first real subject (abc1234)'])
  })

  test('files matching ignoreFiles are excluded; real edits are kept', async () => {
    const ignore = /(?:-state\.json|\/cache\/.*\.json)$/
    const f = extractFacts([msg('assistant', '', [
      edit('/a/data/favorites-state.json', 'Write'),
      edit('/a/data/cache/feed.json', 'Write'),
      edit('/a/notes/meeting.md'),
      edit('/a/src/brief.ts', 'Write'),
    ])], ignore)
    expect(f.filesModified).toEqual(['/a/notes/meeting.md', '/a/src/brief.ts'])
  })

  test('harness signals are never the last real request', async () => {
    const f = extractFacts([
      msg('user', 'Port all five gaps into the mod'),
      msg('user', 'Stop hook feedback: reply promises a check-back'),
      msg('user', '[Automatic handoff] The previous session reached its context limit.'),
      msg('user', '[auto-handoff] The previous session (x) reached its context limit'),
      msg('user', '', []),
    ])
    expect(f.lastUserMessage).toBe('Port all five gaps into the mod')
  })

  test('issue numbers come from the user and the assistant, not from tool noise', async () => {
    const f = extractFacts([msg('user', 'work #846'), msg('assistant', 'see #761 and color #fff', [bash('echo "#9999"')])])
    expect(f.issues).toEqual(['#846', '#761'])
  })

  test('brief validation needs at least one expected section', async () => {
    const template = '## Work in Progress\nWhat was happening.\n\n## Next Step\nThe next action.'
    expect(isValidBrief('## Next Step\nGo.', template)).toBe(true)
    expect(isValidBrief('Sure! Here is a summary.', template)).toBe(false)
  })
})

describe('handoff numbers', () => {
  const base = { filesModified: [], commits: [], issues: [] }

  test('the prompt carries the real token figures and where the threshold came from', () => {
    const p = briefPrompt([], { ...base, handoffTokens: 93_105, threshold: 85_000, thresholdSource: 'AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS', seededSessionStartSize: 45_000, unattendedCount: 2 }, 'TEMPLATE')
    expect(p).toContain('## Handoff Numbers')
    expect(p).toContain('**Tokens at handoff:** 93105 (93k)')
    expect(p).toContain('**Threshold:** 85000 (85k), from AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS')
    expect(p).toContain('starting size (seeded from a handoff):** 45000 (45k)')
    expect(p).toContain('no user message:** 2')
    expect(p.indexOf('## Handoff Numbers')).toBeLessThan(p.indexOf('TEMPLATE'))
  })

  test('no numbers, no section', () => {
    expect(factsBlock(base)).not.toContain('Handoff Numbers')
  })
})

describe('markUnverifiedFigures', () => {
  const facts = { filesModified: [], commits: [], issues: [], handoffTokens: 93_105, threshold: 85_141, thresholdSource: 'AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS (80k), raised to leave 40k above the starting size', seededSessionStartSize: 45_141 }

  test('marks an invented figure and leaves the real ones alone', () => {
    const r = markUnverifiedFigures('Low: session burned its 200k budget. It handed off at 93k of 85k, from 80k with 40k room over a 45,141 tokens start.', facts)
    expect(r.flagged).toEqual(['200k'])
    expect(r.text).toContain('200k [unverified: not in Handoff Numbers]')
    expect(r.text).toContain('at 93k of 85k')
    expect(r.text).not.toContain('45,141 tokens [unverified')
  })

  test('rounding to the nearest thousand passes; issue numbers and years are not figures', () => {
    expect(markUnverifiedFigures('93.1k tokens, see #2 and PR 2026', facts).flagged).toEqual([])
  })

  test('with no numbers block, any figure is marked', () => {
    expect(markUnverifiedFigures('at 120k', { filesModified: [], commits: [], issues: [] }).flagged).toEqual(['120k'])
  })
})

describe('workspace trust for the repository file', () => {
  const REPO_FILE = `${ROOT}/.ai-dlc/auto-handoff.json`
  const CLAUDE_JSON = '/home/test/.claude.json'
  const risky = JSON.stringify({ viewer: '0.0.0.0:3846', briefTemplate: '/repo/chosen.md', thresholdTokens: 60000 })
  const trust = (path: string, value: unknown = true) => JSON.stringify({ projects: { [path]: { hasTrustDialogAccepted: value } } })
  const thresholdIn = (calls: Calls) => /threshold session=old-session tokens=\d+ threshold=(\d+)/.exec(calls.written[LOG_FILE] ?? '')?.[1]
  // Each skipped key is logged with its value (io.ts, trustGate).
  const IGNORED = 'config: briefTemplate="/repo/chosen.md", viewer="0.0.0.0:3846" in .ai-dlc/auto-handoff.json ignored: Claude Code does not trust this folder'

  test('untrusted: viewer and the templates from the repository file are ignored and logged, other keys apply', async ($, on) => {
    const calls = engine(on, { tokens: 190_000, git: GIT, files: { [REPO_FILE]: risky } })
    await $.classic.SessionStart({ source: 'startup' })
    expect(calls.written['/repo/chosen.md']).toBeUndefined()
    expect(calls.written['/home/test/.claude/auto-handoff/brief.md']).toBeDefined()
    expect(calls.written[LOG_FILE]).toContain(`${IGNORED} (~/.claude.json was not readable); set them in the env of .claude/settings.local.json instead`)
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(thresholdIn(calls)).toBe('60000')
  })

  test('an entry that is not exactly true is untrusted', async ($, on) => {
    const calls = engine(on, { tokens: 1_000, git: GIT, files: { [REPO_FILE]: risky, [CLAUDE_JSON]: trust(ROOT, 'yes') } })
    await $.classic.SessionStart({ source: 'startup' })
    expect(calls.written['/repo/chosen.md']).toBeUndefined()
    expect(calls.written[LOG_FILE]).toContain(`${IGNORED} (the folder is not marked trusted)`)
  })

  test('trusted: the repository file applies in full, and nothing is logged about trust', async ($, on) => {
    const calls = engine(on, { tokens: 1_000, git: GIT, files: { [REPO_FILE]: risky, [CLAUDE_JSON]: trust('\\HOME\\test\\proj\\') } })
    await $.classic.SessionStart({ source: 'startup' })
    expect(calls.written['/repo/chosen.md']).toBeDefined()
    expect(calls.written[LOG_FILE] ?? '').not.toContain('does not trust')
  })

  test('in a linked worktree, trust is read from the main checkout', async ($, on) => {
    const tree = `${ROOT}/.worktrees/fix`
    const git: Git = { ...GIT, root: tree, commonDir: `${ROOT}/.git` }
    const calls = engine(on, { tokens: 1_000, git, files: { [`${tree}/.ai-dlc/auto-handoff.json`]: risky, [CLAUDE_JSON]: trust(ROOT) } })
    await $.classic.SessionStart({ source: 'startup' })
    expect(calls.written['/repo/chosen.md']).toBeDefined()
  })

  test('a file with no trust-gated key never reads ~/.claude.json', async ($, on) => {
    const calls = engine(on, { tokens: 1_000, git: GIT, files: { [REPO_FILE]: JSON.stringify({ thresholdTokens: 60000 }), [CLAUDE_JSON]: '{ not json' } })
    await $.classic.SessionStart({ source: 'startup' })
    expect(calls.written[LOG_FILE] ?? '').not.toContain('trust')
  })
})

// 11.19: a run folder the lookup cannot list, and folders whose run-state names are odd.
describe('run folders the lookup skips or notes', () => {
  const LOG = '/home/test/.claude/state/auto-handoff/auto-handoff.log'

  test('an unreadable run folder is skipped and the readable run is still handed off', async ($, on) => {
    const locked = `${ROOT}/docs/handoffs/AAW-20261021-locked`
    const files = { [RUN_MD]: runMd(), [`${locked}/run.v1.md`]: runMd({ session: 'someone-else' }) }
    const calls = engine(on, { tokens: 165_000, git: GIT, files, failList: /\/AAW-20261021-locked$/ })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(sessionHandoffOf(calls.written)).toBeDefined()
    expect(calls.written[RUN_MD]).toContain('Continue stage `change` from the session handoff')
    expect(calls.written[`${locked}/run.v1.md`]).toBeUndefined()
    expect(calls.written[LOG] ?? '').not.toContain('run lookup error')
  })

  test('a folder whose version names are all rejected is logged once, across lookups', async ($, on) => {
    const odd = `${ROOT}/docs/handoffs/AAW-20261021-padded`
    const files = { [RUN_MD]: runMd(), [`${odd}/run.v01.md`]: runMd({ session: 'someone-else' }) }
    const calls = engine(on, { tokens: 31_000, env: LOW, git: GIT, files })
    await chainRounds($, calls, 2)
    expect(calls.cleared).toBe(2)
    const note = 'run state names docs/handoffs/AAW-20261021-padded: no valid run-state version among run.v01.md; folder ignored'
    expect((calls.written[LOG] ?? '').split(note).length - 1).toBe(1)
  })

  test('run.md beside versions is logged, naming the version read', async ($, on) => {
    const both = `${ROOT}/docs/handoffs/AAW-20261021-both`
    const files = { [`${both}/run.md`]: runMd({ session: 'x' }), [`${both}/run.v1.md`]: runMd() }
    const calls = engine(on, { tokens: 165_000, git: GIT, files })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.written[LOG] ?? '').toContain('run state names docs/handoffs/AAW-20261021-both: run.md beside run-state versions; run.v1.md read')
    expect(calls.written[`${both}/run.v1.md`]).toContain('Continue stage `change` from the session handoff')
    expect(calls.written[`${both}/run.md`]).toBeUndefined()
  })
})

describe('one run lookup per handoff attempt', () => {
  test('the handoff reuses the lookup its chain guard made', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, env: LOW, git: GIT, files: { [RUN_MD]: runMd() } })
    await chainRounds($, calls, 1)
    calls.branchQueries = 0
    const before = calls.cleared
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > before)
    expect(calls.cleared).toBe(before + 1)
    expect(calls.branchQueries).toBe(1)
  })

  test('parallel tool calls at the gate share one lookup', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, env: LOW, git: GIT, files: { [RUN_MD]: runMd() }, toolChars: 220_000 })
    await chainRounds($, calls, 3)
    calls.branchQueries = 0
    const READ = { tool: 'Read', file_path: '/big.txt' } as const
    const results = await Promise.all([$.tool.call(READ), $.tool.call(READ), $.tool.call(READ), $.tool.call(READ)])
    expect(results.every(r => typeof r === 'object' && r !== null && 'deny' in r)).toBe(true)
    expect(calls.branchQueries).toBeLessThanOrEqual(1)
  })
})

// AAW-20261022-fold-cache-keepalive: the handoff and the prompt cache. Keep-alive is registered by
// the same module, so its timers are stopped before the /clear, and the seed turn logs what its
// first request read from the cache.
describe('the handoff and the prompt cache', () => {
  const KA_TASK = { id: 'b1', type: 'shell', status: 'running', description: 'build' }
  // A transcript row of a main-conversation response that wrote h tokens for 1 hour and m for 5 minutes.
  const cacheRow = (h: number, m: number) => JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: h + m, cache_creation: { ephemeral_1h_input_tokens: h, ephemeral_5m_input_tokens: m } } } })

  test('keep-alive timers stop before the /clear, so no ping of the old session reaches the new one', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, files: { '/home/test/old.jsonl': cacheRow(0, 2_000) } })
    let forks = 0
    const statuses = kaFeed(on, calls)
    on('model.fork', async () => (forks++, { value: { isAnswered: true, text: 'ok', usage: USAGE } }) as never)
    on('classic.Stop', async () => (await flush(), {}) as never)
    await $.classic.Stop({ background_tasks: [KA_TASK], transcript_path: '/home/test/old.jsonl' } as never)
    expect(statuses.at(-1)).toMatch(/^keepalive 5m: main warm until \d+:\d\d; armed/m)
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const stoppedAt = statuses.findIndex(s => s?.includes('keepalive 5m: handed off, stopped'))
    expect(stoppedAt).toBeGreaterThanOrEqual(0)
    expect(statuses.cleared[stoppedAt]).toBe(0) // published before the /clear ran
    expect(calls.written['/home/test/.claude/state/auto-handoff/auto-handoff.log']).toContain('keepalive timers stopped for the handoff session=old-session')
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    // Past the 5m track's 3-minute interval (the panel's spinner caps how far one advance may go)
    await clock.advance(4 * 60_000)
    expect(forks).toBe(0)
  })

  // Gap found by mutation (17.3): the handoff's reset of the cache ledger had no test. The harness loads
  // its own copy of the module, so this goes through the real handoff. The Stop before it seeds the ledger
  // from the old transcript; after the /clear a Stop whose transcript shows no write must find none.
  test('the handoff clears the keep-alive cache ledger: the new session\'s Stop finds no cache write', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, files: { '/home/test/old.jsonl': cacheRow(0, 2_000) } })
    const statuses = kaFeed(on)
    on('classic.Stop', async () => (await flush(), {}) as never)
    await $.classic.Stop({ background_tasks: [KA_TASK], transcript_path: '/home/test/old.jsonl' } as never)
    expect(statuses.at(-1)).toMatch(/^keepalive 5m: main warm until \d+:\d\d; armed/m)
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    await $.classic.Stop({ background_tasks: [KA_TASK], transcript_path: '/home/test/none.jsonl' } as never)
    expect(statuses.at(-1)?.split('\n')).toContain('keepalive 5m: off (no cache write seen yet, so the cache lifetime is unknown), ping 0/20, keep warm 1h (default)')
  })

  test('no ping is armed while a handoff is under way', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, files: { '/home/test/old.jsonl': cacheRow(1_000, 0) } })
    const statuses = kaFeed(on)
    on('classic.Stop', async () => (await flush(), {}) as never)
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0 || calls.completes > 0)
    await $.classic.Stop({ background_tasks: [KA_TASK], transcript_path: '/home/test/old.jsonl' } as never)
    expect(statuses.some(s => s?.includes('armed'))).toBe(false)
  })

  test('a Stop while the handoff writes its brief, or waits for its seed, arms nothing; after it, one does', async ($, on) => {
    let release!: () => void
    const hold = new Promise<void>(r => { release = r })
    const calls = engine(on, { tokens: 165_000, hold, files: { '/home/test/old.jsonl': cacheRow(0, 2_000), '/home/test/new.jsonl': cacheRow(0, 2_000) } })
    const statuses = kaFeed(on)
    on('classic.Stop', async () => (await flush(), {}) as never)
    const stopWith = (path: string) => $.classic.Stop({ background_tasks: [KA_TASK], transcript_path: path } as never)
    await $.turn.complete(TURN)
    await settle(() => calls.completes > 0)
    // In flight: the brief's model call has not answered yet.
    expect([calls.completes, calls.cleared]).toEqual([1, 0])
    await stopWith('/home/test/old.jsonl')
    expect(statuses.some(s => s?.includes('armed'))).toBe(false)
    release()
    await settle(() => calls.cleared > 0)
    // Pending: the /clear ran, and the new session has not been seeded yet.
    expect(calls.seeded).toHaveLength(0)
    await stopWith('/home/test/old.jsonl')
    expect(statuses.some(s => s?.includes('armed'))).toBe(false)
    await $.classic.SessionStart({ source: 'clear', transcript_path: '/home/test/new.jsonl' } as never)
    await settle(() => calls.seeded.length > 0)
    // The handoff is over: the same Stop now arms the 5m track, so the guard is what held it back.
    await stopWith('/home/test/new.jsonl')
    expect(statuses.at(-1)).toMatch(/^keepalive 5m: main warm until \d+:\d\d; armed/m)
  })

  test('the seed turn logs what its first request read from and wrote to the cache, and the panel says hit', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, stepUsage: true, files: { '/home/test/new.jsonl': cacheRow(300, 0) } })
    const statuses = kaFeed(on)
    on('classic.Stop', async () => (await flush(), {}) as never)
    on('turn.start', async (_$, e) => e as never)
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    await $.classic.SessionStart({ source: 'clear', transcript_path: '/home/test/new.jsonl' } as never)
    await settle(() => calls.seeded.length > 0)
    calls.tokens = 47_000
    await step($, 0) // the seed turn's first request
    const log = calls.written['/home/test/.claude/state/auto-handoff/auto-handoff.log']!
    expect(log).toContain("floor session=new-session-1 tokens=47000 (seed turn's first request) input_tokens=10 cache_read_input_tokens=46990 cache_creation_input_tokens=0 cache_creation_1h=300 cache_creation_5m=0 cache=hit")
    expect(await band($)).toContain('cache hit: 47k read, 0k written (1h 0k, 5m 0k)')
    // D4 (step 44: the band's seed row, not a status line): keep-alive's band says it too, under the track rows, until the next turn.
    expect(await kaText($)).toContain('keepalive seed: cache hit, 47k read')
    await $.classic.Stop({ background_tasks: [KA_TASK], transcript_path: '/home/test/new.jsonl' } as never)
    const armedText = await kaText($)
    expect(armedText).toContain('keepalive seed: cache hit, 47k read')
    expect(armedText.indexOf('keepalive 1h: on, armed')).toBeLessThan(armedText.indexOf('keepalive seed:'))
    expect(statuses.at(-1)?.split('\n')).toEqual([expect.stringMatching(/^keepalive 1h: main warm until \d+:\d\d; armed/m), 'keepalive 5m: off (no 5m cache write seen), ping 0/20, keep warm 1h (default)'])
    await $.turn.start({ turnId: 't-2' } as never)
    await $.classic.Stop({ background_tasks: [KA_TASK], transcript_path: '/home/test/new.jsonl' } as never)
    expect(await kaText($)).not.toContain('keepalive seed')
    expect(statuses.at(-1)?.split('\n')).toHaveLength(2)
  })

  // The engine drops a failed status line itself, so the seed line cannot fail through it today;
  // register.tsx runs showSeedCache through orLog, and this is what orLog does with a throw. A test's
  // own $ has no env or process, so orLog gets a stand-in with the two calls log() makes.
  test('a step run through orLog that throws is logged, not passed on; one that succeeds logs nothing', async () => {
    const lines: string[] = []
    const stub = {
      env: { get: async (name: string) => name === 'HOME' ? '/home/test' : undefined },
      process: { run: async (argv: string[]) => (lines.push(argv[4] ?? ''), { exitCode: 0, stdout: '', stderr: '' }) },
    } as never
    await expect(orLog(stub, 'keepalive seed line', async () => { throw new Error('status line unavailable') })).resolves.toBeUndefined()
    await orLog(stub, 'keepalive seed line', async () => undefined)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('keepalive seed line error Error: status line unavailable')
  })

  // [B1] End to end: the seed line's status call fails during the seed turn. The floor is already set,
  // so the tight-threshold warning (the next step in register.tsx) must still run and the turn must return.
  // Whether the engine drops the failed call itself or the orLog guard catches it, both are fine here:
  // the stub test above pins the guard, this one pins the outcome the guard exists for.
  // Not pinned: the guard's wiring at its call site in register.tsx. No test can make showSeedCache
  // throw past the engine: every engine call in it is caught (load, log) or dropped by the engine
  // (ui.status, ui.log), userConfig values are validated before register sees them, and the test
  // harness loads its own copy of the module, so a fault a test sets on an imported module never
  // reaches it (tried 2026-10-23). Removing the wrapper therefore fails no test; that gap is accepted.
  test('[B1] [R44.1] the seed turn writes no status line at all: the floor is set and the tight-threshold warning still shows', { options: {} }, async ($, on) => {
    const calls = engine(on, { tokens: 85_000, stepUsage: true, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '80000' } })
    const texts: (string | undefined)[] = []
    on('ui.status', async (_$, e) => (texts.push(e.text), { value: undefined }) as never)
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    calls.tokens = 45_000
    await step($, 0) // the seed turn's first request: sets the floor, then shows the seed line, then warns
    const log = calls.written['/home/test/.claude/state/auto-handoff/auto-handoff.log']!
    expect(texts.filter(t => t !== undefined)).toEqual([]) // R44.1: keep-alive writes no status line, the seed line included
    expect(log).toContain("floor session=new-session-1 tokens=45000 (seed turn's first request)")
    expect(log).toContain('tight threshold session=new-session-1')
    expect(await band($)).toContain("leaves 35k this session's 45k start")
  })

  test('a seed turn that read nothing from the cache says miss in the seed row of the band', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, stepUsage: true, stepRead: 0 })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    calls.tokens = 47_000
    await step($, 0)
    expect(await kaText($)).toContain('keepalive seed: cache miss')
  })

  test('with keep-alive status lines off, the seed line is not shown', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, stepUsage: true, files: { '/home/test/proj/.claude/settings.local.json': JSON.stringify({ env: { AI_DLC_KEEPALIVE_STATUS: 'false' } }) } })
    const statuses = kaFeed(on)
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    calls.tokens = 47_000
    await step($, 0)
    expect(calls.written['/home/test/.claude/state/auto-handoff/auto-handoff.log']).toContain('cache=hit')
    expect(await kaText($)).not.toContain('keepalive seed')
  })

  // ITEM-076: with handoff.onWhenOff (default true) the seeded session turns keep-alive on, so it is off here
  test('[R4] with keep-alive off (enabled=false) and no onWhenOff, the seeded session stays off: the head row reads off', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, stepUsage: true, files: { '/home/test/proj/.claude/settings.local.json': JSON.stringify({ env: { AI_DLC_KEEPALIVE_ENABLED: 'false', AI_DLC_KEEPALIVE_HANDOFF_ON_WHEN_OFF: 'false' } }) } })
    const statuses = kaFeed(on)
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    calls.tokens = 47_000
    await step($, 0)
    expect(calls.written['/home/test/.claude/state/auto-handoff/auto-handoff.log']).toContain('cache=hit')
    const offText = await kaText($)
    expect(offText).toMatch(/cache-keepalive: off on/)
    expect(offText).not.toContain('keepalive seed') // R44.6
  })

  test('[R4] the session ending clears the seed line, and the next Stop shows the track lines alone', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, stepUsage: true, files: { '/home/test/new.jsonl': cacheRow(300, 0) } })
    const statuses = kaFeed(on)
    on('classic.Stop', async () => (await flush(), {}) as never)
    on('session.end', async (_$, e) => ({ sessionId: e.sessionId }) as never)
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    await $.classic.SessionStart({ source: 'clear', transcript_path: '/home/test/new.jsonl' } as never)
    await settle(() => calls.seeded.length > 0)
    calls.tokens = 47_000
    await step($, 0)
    expect(await kaText($)).toContain('keepalive seed: cache hit, 47k read')
    await $.session.end({ reason: 'clear', sessionId: 'new-session-1' } as never)
    expect(await kaText($)).not.toContain('keepalive seed')
    await $.classic.Stop({ background_tasks: [KA_TASK], transcript_path: '/home/test/new.jsonl' } as never)
    expect(statuses.at(-1)?.split('\n')).toHaveLength(2)
    expect(await kaText($)).not.toContain('seed')
  })

  // ITEM-034.c (17.2.4): a subagent response's usage goes to the debug log only, never to the cache
  // ledger; a main-loop response goes to the ledger and logs no agent line. register.tsx, turn.step.
  const agentStep = async ($: Parameters<TestBody>[0], agentId?: string) => {
    for await (const _ of $.turn.step({ ...STEP, ...(agentId ? { agentId } : {}) } as never)) void _
  }

  test('[ITEM-034] a subagent response logs its agent usage line and reaches the cache ledger as a subagent cache, which arms nothing (AC-17.3.8)', async ($, on) => {
    engine(on, { tokens: 50_000, stepUsage: true, stepRead: 0, stepSplit: { h: 0, m: 49_990 } })
    const logs: string[] = []
    const statuses = kaFeed(on)
    on('ui.log', async (_$, e) => (logs.push(e.text), { value: undefined }) as never)
    on('classic.Stop', async () => (await flush(), {}) as never)
    await agentStep($, 'sub-1')
    expect(logs).toContain('keepalive: agent usage agent=sub-1 split=present writes=49990')
    // T17.3: the agent's write is in the ledger as a subagent cache; with subagent pings off it arms nothing
    await $.classic.Stop({ background_tasks: [KA_TASK] } as never)
    expect(statuses.at(-1)).not.toContain('main warm until')
    expect(statuses.at(-1)).toMatch(/^keepalive 5m: subagents warm until \d+:\d\d; off \(only subagent caches; subagent pings off\), ping 0\/20, keep warm 1h \(default\)$/m)
  })

  test('[ITEM-034.c] a main-loop response reaches the cache ledger and logs no agent usage line', async ($, on) => {
    engine(on, { tokens: 50_000, stepUsage: true, stepRead: 0, stepSplit: { h: 0, m: 49_990 } })
    const logs: string[] = []
    const statuses = kaFeed(on)
    on('ui.log', async (_$, e) => (logs.push(e.text), { value: undefined }) as never)
    on('classic.Stop', async () => (await flush(), {}) as never)
    await agentStep($)
    expect(logs.filter(l => l.includes('agent usage'))).toEqual([])
    await $.classic.Stop({ background_tasks: [KA_TASK] } as never)
    expect(statuses.at(-1)).toMatch(/5m: main warm until \d+:\d\d/)
  })

  test('the seed cache fields and panel line, for a hit, a miss and a split not reported', () => {
    expect(seedCacheFields({ input: 5, read: 0, written: 40_000, split: { '1h': 40_000, '5m': 0 } }))
      .toBe('input_tokens=5 cache_read_input_tokens=0 cache_creation_input_tokens=40000 cache_creation_1h=40000 cache_creation_5m=0 cache=miss')
    expect(seedCacheFields({ input: 5, read: 30_000, written: 2_000 })).toContain('cache_creation_1h=none cache_creation_5m=none cache=hit')
    expect(seedCacheLine({ input: 5, read: 0, written: 40_000, split: { '1h': 40_000, '5m': 0 } })).toBe('cache miss: nothing read, 40k written (1h 40k, 5m 0k)')
    expect(seedCacheLine({ input: 5, read: 30_000, written: 2_000 })).toBe('cache hit: 30k read, 2k written (1h/5m split not reported)')
    expect(creationSplit({ cache_creation: { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 0 } })).toEqual({ '1h': 0, '5m': 0 })
    expect(creationSplit({ input_tokens: 1 })).toBeUndefined()
  })
})

// T17.7 (ITEM-076): at the seed of an automatic handoff, handoff.onWhenOff (default true) turns keep-alive on
// for the chain when its master is off. It is trust-gated: from a file a cloned repository controls it applies
// only in a folder Claude Code trusts. The seed line (keepalive seed: cache hit, ...) shows only while keep-alive is on.
describe('handoff.onWhenOff at the seed of an automatic handoff', () => {
  const PROJ = '/home/test/proj'
  const LOCAL = `${PROJ}/.claude/settings.local.json`
  const SETTINGS_JSON = `${PROJ}/.claude/settings.json`
  const REPO = `${PROJ}/.ai-dlc/cache-keepalive.json`
  const TRUSTED = { '/home/test/.claude.json': JSON.stringify({ projects: { [PROJ]: { hasTrustDialogAccepted: true } } }) }
  const env = (vars: Record<string, string>) => JSON.stringify({ env: vars })
  const OFF = { AI_DLC_KEEPALIVE_ENABLED: 'false' }

  // One handoff with keep-alive's master off in the settings; whether the seeded session's band shows the seed row.
  async function seedShown($: Parameters<TestBody>[0], on: On, files: Record<string, string>): Promise<{ shown: boolean; on: boolean; log: string }> {
    const calls = engine(on, { tokens: 165_000, stepUsage: true, files })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    calls.tokens = 47_000
    await step($, 0)
    const text = await kaText($)
    // `on`: the head row reads on (keep-alive is on in the seeded session); the seed row is the band's, shown whatever the master says
    return { shown: text.includes('keepalive seed:'), on: /cache-keepalive: on /.test(text), log: calls.written['/home/test/.claude/state/auto-handoff/auto-handoff.log'] ?? '' }
  }

  test('master off in the settings, onWhenOff on (the default): the seeded session has keep-alive on, so the seed line shows', async ($, on) => {
    expect((await seedShown($, on, { [LOCAL]: env(OFF) })).shown).toBe(true)
  })

  test('onWhenOff false in the env of settings.local.json: the seeded session stays off, the head row reads off', async ($, on) => {
    expect((await seedShown($, on, { [LOCAL]: env({ ...OFF, AI_DLC_KEEPALIVE_HANDOFF_ON_WHEN_OFF: 'false' }) })).shown).toBe(false) // R44.6: no seed row while keep-alive is off
  })

  test('master on: the seed line shows as before, whatever onWhenOff says', async ($, on) => {
    expect((await seedShown($, on, { [LOCAL]: env({ AI_DLC_KEEPALIVE_HANDOFF_ON_WHEN_OFF: 'false' }) })).shown).toBe(true)
  })

  test('the trust gate, untrusted: false in the env of settings.json is skipped, the default applies, so keep-alive is turned on', async ($, on) => {
    expect((await seedShown($, on, { [LOCAL]: env(OFF), [SETTINGS_JSON]: env({ AI_DLC_KEEPALIVE_HANDOFF_ON_WHEN_OFF: 'false' }) })).shown).toBe(true)
  })

  test('the trust gate, untrusted: false in the repository file is skipped, so keep-alive is turned on', async ($, on) => {
    expect((await seedShown($, on, { [LOCAL]: env(OFF), [REPO]: JSON.stringify({ handoff: { onWhenOff: false } }) })).shown).toBe(true)
  })

  test('the trust gate, trusted: false in the env of settings.json applies, so keep-alive stays off', async ($, on) => {
    expect((await seedShown($, on, { ...TRUSTED, [LOCAL]: env(OFF), [SETTINGS_JSON]: env({ AI_DLC_KEEPALIVE_HANDOFF_ON_WHEN_OFF: 'false' }) })).shown).toBe(false)
  })

  test('the trust gate, trusted: false in the repository file applies, so keep-alive stays off', async ($, on) => {
    expect((await seedShown($, on, { ...TRUSTED, [LOCAL]: env(OFF), [REPO]: JSON.stringify({ handoff: { onWhenOff: false } }) })).shown).toBe(false)
  })
})

// Step 40, fix 3 (human: "the lens band is gone"): the band above the prompt draws auto-handoff's panel and
// keep-alive's rows and then the hooks beneath it (another plugin's band, such as ai-dlc-lens's, then the
// engine's). A hook that returns its own tree without calling next hides everything beneath it.
describe('the band above the prompt draws the hooks beneath it', () => {
  const KA = '⚠ ai-dlc cache-keepalive:'

  test('keep-alive\'s rows are drawn and so is the band of a hook beneath (the lens band)', async ($, on) => {
    engine(on, { tokens: 10_000, beneath: 'LENS BAND BENEATH' })
    const ui = await mountBand($)
    const text = textOf(await ui.drawn())
    expect(text).toContain(KA)
    expect(text).toContain('LENS BAND BENEATH')
    // Step 42: the lens band first, keep-alive's band after it
    expect(text.indexOf('LENS BAND BENEATH')).toBeLessThan(text.indexOf(KA))
    await ui.unmount()
  })

  test('with a handoff panel showing too: panel, then the hook beneath (the lens band), then keep-alive\'s band, in that order', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, stepUsage: true, beneath: 'LENS BAND BENEATH' })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const ui = await mountBand($)
    const text = textOf(await ui.drawn())
    const lens = text.indexOf('LENS BAND BENEATH')
    expect(lens).toBeGreaterThan(0)
    expect(text.slice(0, lens).trim()).not.toBe('') // the handoff panel
    expect(text.slice(0, lens)).not.toContain(KA)
    expect(text.indexOf(KA)).toBeGreaterThan(lens)
    await ui.unmount()
  })

  test('a survey in progress yields the whole band to the hooks beneath: nothing of ours is drawn', async ($, on) => {
    engine(on, { tokens: 10_000, beneath: 'BENEATH' })
    const ui = await $.ui.mount({ plugin: 'ai-dlc', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: true, isWorking: false, maxRows: 20, bodyColumns: 120 } as never })
    const text = textOf(await ui.drawn())
    expect(text).toContain('BENEATH')
    expect(text).not.toContain(KA)
    await ui.unmount()
  })

})

// Step 44 (R44.7, which reverses R44.4 for keep-alive): keep-alive is a band only, drawn on every surface that raises
// AbovePrompt, VS Code and mixed or unknown surfaces included.
describe('[R44.7] keep-alive\'s band is drawn on every surface', () => {
  const KA = '⚠ ai-dlc cache-keepalive:'
  const drawn = async ($: Parameters<TestBody>[0], on: On, surfaces: ('terminal' | 'desktop' | 'mobile' | 'vscode')[]) => {
    engine(on, { tokens: 10_000, surfaces })
    const ui = await mountBand($)
    const text = textOf(await ui.drawn())
    await ui.unmount()
    return text.includes(KA)
  }
  for (const surfaces of [['terminal'], ['desktop'], ['vscode'], ['terminal', 'vscode'], []] as ('terminal' | 'desktop' | 'vscode')[][])
    test(`surfaces ${JSON.stringify(surfaces)}: the band is drawn`, async ($, on) => {
      expect(await drawn($, on, surfaces)).toBe(true)
    })
  test('the band has no maximise control, minimised or full (R44.7)', async ($, on) => {
    engine(on, { tokens: 10_000, surfaces: ['vscode'] })
    const ui = await mountBand($)
    expect(await ui.find({ type: 'Button', key: 'ka-max' })).toBe(undefined)
    expect(textOf(await ui.drawn())).not.toContain('⤢')
    await ui.unmount()
  })
})

// Step 42, points 1 and 2: the lens band and keep-alive's are two separate bands, in that order, and keep-alive's
// minimises like the lens band: `–` minimises, `□` restores. Minimised it is one row: whether keep-alive is on
// or off, and the master button only. It starts minimised at each load.
describe('[42.1, 42.2] keep-alive\'s band: separate from the lens band, minimised like it', () => {
  const TITLE = '⚠ ai-dlc cache-keepalive:'
  const kids = (n: any): any[] => {
    const c = n?.props?.children ?? n?.children
    return c === undefined || c === null ? [] : Array.isArray(c) ? c.flat(Infinity) : [c]
  }
  const press = async (ui: Awaited<ReturnType<typeof mountBand>>, key: string) => {
    await ui.press({ key })
    await settle(() => false)
  }

  test('[42.1] two blocks side by side, never nested in each other: the lens band is one child of the band, keep-alive\'s another, after it', async ($, on) => {
    engine(on, { tokens: 10_000, beneath: 'LENS BAND BENEATH' })
    const ui = await mountBand($)
    const root: any = await ui.drawn()
    const blocks = kids(root)
    const at = (needle: string) => blocks.findIndex(b => textOf(b).includes(needle))
    expect(at('LENS BAND BENEATH')).toBeGreaterThanOrEqual(0)
    expect(at(TITLE)).toBeGreaterThanOrEqual(0)
    expect(at('LENS BAND BENEATH')).toBeLessThan(at(TITLE))
    // neither block holds the other's text
    expect(textOf(blocks[at('LENS BAND BENEATH')])).not.toContain(TITLE)
    expect(textOf(blocks[at(TITLE)])).not.toContain('LENS BAND BENEATH')
    await ui.unmount()
  })

  // every `width` prop in a drawn tree (the engine refuses a Box with a width around core's engine node, step 34)
  const widths = (n: any): unknown[] => {
    if (n === null || typeof n !== 'object') return []
    const own = n.props && 'width' in n.props ? [n.props.width] : []
    return [...own, ...kids(n).flatMap(widths)]
  }

  test('[42.1] step 34\'s rule holds on the whole band: no Box anywhere in the tree has a width, keep-alive\'s included; keep-alive\'s band is the last child after the hook beneath', async ($, on) => {
    engine(on, { tokens: 10_000, beneath: 'LENS BAND BENEATH' })
    const ui = await mountBand($)
    const root: any = await ui.drawn()
    expect(widths(root)).toEqual([])
    const blocks = kids(root)
    expect(textOf(blocks[blocks.length - 1]).startsWith(TITLE)).toBe(true)
    expect(textOf(blocks[blocks.length - 2])).toContain('LENS BAND BENEATH')
    await ui.press({ key: 'ka-min' })
    await settle(() => false)
    expect(widths(await ui.drawn())).toEqual([]) // opened too
    await ui.unmount()
  })

  test('[42.1] with a handoff panel showing: panel, lens band, keep-alive band; the panel is not inside keep-alive\'s block', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, stepUsage: true, beneath: 'LENS BAND BENEATH' })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const ui = await mountBand($)
    const blocks = kids(await ui.drawn())
    const lens = blocks.findIndex(b => textOf(b).includes('LENS BAND BENEATH'))
    const keep = blocks.findIndex(b => textOf(b).includes(TITLE))
    expect(lens).toBeGreaterThan(0)
    expect(keep).toBeGreaterThan(lens)
    expect(textOf(blocks[keep]).startsWith(TITLE)).toBe(true)
    await ui.unmount()
  })

  test('[42.2] the band starts minimised: one row with the title, whether keep-alive is on, the master button and the restore control', async ($, on) => {
    engine(on, { tokens: 10_000 })
    const ui = await mountBand($)
    expect(textOf(await ui.drawn())).toBe(`${TITLE} on off⏻Ping now⟳Restore□Close×`)
    // live findings 3, point 8: minimised, a control is its glyph (the Button's Text child) and the label names it
    const min: any = await ui.find({ type: 'Button', key: 'ka-min' })
    expect(min?.text).toBe('□')
    expect(min?.props?.label).toBe('Restore')
    expect(await ui.find({ type: 'Button', key: 'ka-master' })).toBeDefined()
    // no track row and no track button while minimised
    expect(await ui.find({ type: 'Button', key: 'ka-5m' })).toBe(undefined)
    expect(await ui.find({ type: 'Button', key: 'ka-1h' })).toBe(undefined)
    expect(textOf(await ui.drawn())).not.toContain('keepalive 5m:')
    await ui.unmount()
  })

  test('[42.2] the control restores (`□` becomes `–`, the rows appear) and minimises again; it is the lens band\'s plain button', async ($, on) => {
    engine(on, { tokens: 10_000 })
    const ui = await mountBand($)
    await press(ui, 'ka-min')
    expect(((await ui.find({ type: 'Button', key: 'ka-min' })) as any)?.props?.label).toBe('Minimise') // full: the word
    const open = textOf(await ui.drawn())
    expect(open).toContain('keepalive 5m:')
    expect(open).toContain('keepalive 1h:')
    for (const key of ['ka-master', 'ka-5m', 'ka-1h']) expect(await ui.find({ type: 'Button', key })).toBeDefined()
    await press(ui, 'ka-min')
    expect(textOf(await ui.drawn())).toBe(`${TITLE} on off⏻Ping now⟳Restore□Close×`)
    const min: any = await ui.find({ type: 'Button', key: 'ka-min' })
    expect(min?.props?.plain ?? min?.plain).toBe(true)
    await ui.unmount()
  })

  test('[42.2] the size is the band\'s own and survives a redraw: opened, a new mount draws it opened', async ($, on) => {
    engine(on, { tokens: 10_000 })
    const first = await mountBand($)
    await press(first, 'ka-min')
    await first.unmount()
    const second = await mountBand($)
    expect(textOf(await second.drawn())).toContain('keepalive 5m:')
    expect(((await second.find({ type: 'Button', key: 'ka-min' })) as any)?.props?.label).toBe('Minimise')
    await second.unmount()
  })

  test('[42.2] minimised, the master button works: it switches keep-alive off for this session, the row reads off and the button reads on', async ($, on) => {
    const calls = engine(on, { tokens: 10_000 })
    const ui = await mountBand($)
    await press(ui, 'ka-master')
    expect(textOf(await ui.drawn())).toBe(`${TITLE} off on⏻Ping now⟳Restore□Close×`)
    expect(Object.keys(calls.written).filter(p => p.endsWith('settings.json') || p.endsWith('settings.local.json') || p.endsWith('cache-keepalive.json'))).toEqual([])
    await press(ui, 'ka-master')
    expect(textOf(await ui.drawn())).toBe(`${TITLE} on off⏻Ping now⟳Restore□Close×`)
    await ui.unmount()
  })

  test('[42.2] the master state read minimised is the state the full band shows: master off in the settings reads off in both', async ($, on) => {
    engine(on, { tokens: 10_000, files: { '/home/test/proj/.claude/settings.local.json': JSON.stringify({ env: { AI_DLC_KEEPALIVE_ENABLED: 'false' } }) } })
    on('classic.Stop', async () => (await flush(), {}) as never)
    on('ui.status', async () => ({ value: undefined }) as never)
    await $.classic.Stop({ background_tasks: [{ id: 'b1', type: 'shell', status: 'running', description: 'build' }] } as never) // settings are read at the turn and at its Stop
    const ui = await mountBand($)
    expect(textOf(await ui.drawn())).toBe(`${TITLE} off on⏻Ping now⟳Restore□Close×`)
    await press(ui, 'ka-min')
    expect(textOf(await ui.drawn())).toMatch(/^⚠ ai-dlc cache-keepalive: off onPing nowMinimiseClosekeepalive 5m:/)
    await ui.unmount()
  })

  test('[42.2] the seed row and the track rows are hidden while minimised and back when restored', async ($, on) => {
    const calls = engine(on, { tokens: 165_000, stepUsage: true })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    calls.tokens = 47_000
    await step($, 0)
    const ui = await mountBand($)
    expect(textOf(await ui.drawn())).not.toContain('keepalive seed:')
    await press(ui, 'ka-min')
    expect(textOf(await ui.drawn())).toContain('keepalive seed:')
    await ui.unmount()
  })

  test('[42.2] a close `×` is on the band, full and minimised, after the minimise control: plain, a dismiss', async ($, on) => {
    engine(on, { tokens: 10_000 })
    const ui = await mountBand($)
    for (const opened of [false, true]) {
      if (opened) await press(ui, 'ka-min')
      const close: any = await ui.find({ type: 'Button', key: 'ka-close' })
      expect(close?.props?.label).toBe('Close') // the label names the control in both sizes
      if (!opened) expect(close?.text).toBe('×') // minimised: the glyph is the Button's Text child
      expect(close?.props?.plain ?? close?.plain).toBe(true)
      expect(close?.props?.role ?? close?.role).toBe('dismiss') // role=dismiss stays on close
      expect(textOf(await ui.drawn())).toMatch(opened ? /MinimiseClose/ : /Restore□Close×/)
    }
    await ui.unmount()
  })

  test('[42.2] the close hides keep-alive\'s band for the session; the lens band beneath stays', async ($, on) => {
    engine(on, { tokens: 10_000, beneath: 'LENS BAND BENEATH' })
    const ui = await mountBand($)
    await press(ui, 'ka-close')
    const text = textOf(await ui.drawn())
    expect(text).toContain('LENS BAND BENEATH')
    expect(text).not.toContain(TITLE)
    expect(await ui.find({ type: 'Button', key: 'ka-master' })).toBe(undefined)
    // a new mount (a redraw) still has it hidden
    await ui.unmount()
    const again = await mountBand($)
    expect(textOf(await again.drawn())).not.toContain(TITLE)
    await again.unmount()
  })

  test('[42.2] a run of /ai-dlc:cache-keepalive brings the closed band back', async ($, on) => {
    engine(on, { tokens: 10_000 })
    const ui = await mountBand($)
    await press(ui, 'ka-close')
    expect(textOf(await ui.drawn())).not.toContain(TITLE)
    await $.command.run({ command: 'ai-dlc:cache-keepalive', args: '' } as never) // no arguments (live findings 3, point 5)
    await settle(() => false)
    expect(textOf(await ui.drawn())).toContain(TITLE)
    await ui.unmount()
  })

  test('[42.2] a new session (session.start) brings the closed band back', async ($, on) => {
    engine(on, { tokens: 10_000 })
    on('session.start', async (_$, e) => ({ cwd: e.cwd }) as never)
    const ui = await mountBand($)
    await press(ui, 'ka-close')
    expect(textOf(await ui.drawn())).not.toContain(TITLE)
    await $.session.start({ cwd: '/home/test/proj', surface: 'terminal', isInteractive: true })
    await settle(() => false)
    expect(textOf(await ui.drawn())).toContain(TITLE)
    await ui.unmount()
  })

  test('[42.2] closed or not, a later load starts with the band shown: a fresh module draws it', async ($, on) => {
    // each test loads the hooks module afresh, as a /reload-plugins does: nothing of an earlier close remains
    engine(on, { tokens: 10_000 })
    const ui = await mountBand($)
    expect(textOf(await ui.drawn())).toContain(TITLE)
    await ui.unmount()
  })

  test('[42.1] status off: no keep-alive band at all, and the lens band beneath still draws', async ($, on) => {
    engine(on, { tokens: 10_000, beneath: 'LENS BAND BENEATH', files: { '/home/test/proj/.claude/settings.local.json': JSON.stringify({ env: { AI_DLC_KEEPALIVE_STATUS: 'false' } }) } })
    on('classic.Stop', async () => (await flush(), {}) as never)
    on('ui.status', async () => ({ value: undefined }) as never)
    await $.classic.Stop({ background_tasks: [{ id: 'b1', type: 'shell', status: 'running', description: 'build' }] } as never) // settings are read at the turn and at its Stop
    const ui = await mountBand($)
    const text = textOf(await ui.drawn())
    expect(text).toContain('LENS BAND BENEATH')
    expect(text).not.toContain(TITLE)
    await ui.unmount()
  })
})

// Live findings 3, point 8: the band's new "Ping now" control (ka-ping), and its buttons: icons minimised, words full.
describe('[43 live3 p8] the keep-alive band: ka-ping, glyph buttons minimised, word buttons full', () => {
  const kids = (n: any): any[] => {
    const c = n?.props?.children ?? n?.children
    return c === undefined || c === null ? [] : Array.isArray(c) ? c.flat(Infinity) : [c]
  }
  const walk = (n: any): any[] => (n !== null && typeof n === 'object' ? [n, ...kids(n).flatMap(walk)] : [])
  const buttons = (tree: any): any[] => walk(tree).filter(n => n.type === 'Button')
  const press = async (ui: Awaited<ReturnType<typeof mountBand>>, key: string) => {
    await ui.press({ key })
    await settle(() => false)
  }
  const withFork = (on: On, files?: Record<string, string>) => {
    engine(on, { tokens: 10_000, ...(files ? { files } : {}) })
    const seen = { forks: 0, prompts: [] as string[], invalidated: 0 }
    on('model.fork', (_$, e) => (seen.forks++, seen.prompts.push((e as { prompt: string }).prompt), { value: { isAnswered: true, text: 'ok', usage: USAGE } }) as never)
    on('ui.invalidate' as never, ((_$: unknown, e: unknown, next: (e: unknown) => unknown) => (seen.invalidated++, next(e))) as never) // counts, and lets the redraw through
    on('classic.Stop', async () => (await flush(), {}) as never)
    on('ui.status', async () => ({ value: undefined }) as never)
    on('session.model', async () => ({ value: 'claude-opus-5-5' }) as never) // the ping prices its read with the model
    return seen
  }

  test('[p8] minimised, the four controls are master, ping, min, close, in that order; each is a plain Button with a glyph Text child and a label naming it', async ($, on) => {
    withFork(on)
    const ui = await mountBand($)
    const bs = buttons(await ui.drawn())
    expect(bs.map(b => b.props.key)).toEqual(['ka-master', 'ka-ping', 'ka-min', 'ka-close'])
    expect(bs.map(b => b.props.label)).toEqual(['off', 'Ping now', 'Restore', 'Close']) // master reads the press: off|on
    expect(bs.map(b => kids(b).map(c => [c.type, textOf(c)]))).toEqual([[['Text', '⏻']], [['Text', '⟳']], [['Text', '□']], [['Text', '×']]])
    for (const b of bs) expect(b.props.plain).toBe(true)
    await ui.unmount()
  })

  test('[p8] restored, the labels are the words Ping now, Minimise, Close; the master still reads off|on; no glyph child; role=dismiss stays on close', async ($, on) => {
    withFork(on)
    const ui = await mountOpenBand($)
    const bs = buttons(await ui.drawn())
    expect(bs.map(b => b.props.key)).toEqual(['ka-master', 'ka-ping', 'ka-min', 'ka-close', 'ka-5m', 'ka-1h'])
    expect(bs.slice(0, 4).map(b => b.props.label)).toEqual(['off', 'Ping now', 'Minimise', 'Close'])
    for (const b of bs) expect(kids(b)).toEqual([])
    expect(bs.map(b => b.props.role)).toEqual([undefined, undefined, undefined, 'dismiss', undefined, undefined])
    await press(ui, 'ka-master')
    expect(buttons(await ui.drawn())[0].props.label).toBe('on')
    await ui.unmount()
  })

  test('[p8] minimised, the close keeps role=dismiss', async ($, on) => {
    withFork(on)
    const ui = await mountBand($)
    expect(((await ui.find({ type: 'Button', key: 'ka-close' })) as any)?.props?.role).toBe('dismiss')
    await ui.unmount()
  })

  test('[p8] ka-ping on the band pings once with the settings in force and redraws, minimised and restored', async ($, on) => {
    const seen = withFork(on, { '/home/test/proj/.claude/settings.local.json': JSON.stringify({ env: { AI_DLC_KEEPALIVE_PING_PROMPT: 'warm it' } }) })
    const ui = await mountBand($)
    await $.classic.Stop({ background_tasks: [{ id: 'b1', type: 'shell', status: 'running', description: 'build' }] } as never) // settings are read at the turn and at its Stop
    expect(seen.forks).toBe(0) // drawing and stopping ping nothing
    const base = seen.invalidated
    await ui.press({ key: 'ka-ping' })
    await settle(() => seen.invalidated > base) // the ping is async: the redraw comes when it is done
    expect(seen.forks).toBe(1)
    expect(seen.prompts).toEqual(['warm it'])
    expect(seen.invalidated - base).toBe(1) // the band is redrawn once the ping is done
    expect(textOf(await ui.drawn())).toContain('Ping now⟳Restore□Close×') // still minimised
    await press(ui, 'ka-min')
    const again = seen.invalidated
    await ui.press({ key: 'ka-ping' })
    await settle(() => seen.invalidated > again)
    expect(seen.forks).toBe(2)
    expect(textOf(await ui.drawn())).toContain('keepalive 5m:') // restored stays restored
    await ui.unmount()
  })

  test('[p8] ka-ping pings nothing while keep-alive is off', async ($, on) => {
    const seen = withFork(on)
    const ui = await mountBand($)
    await $.command.run({ command: 'ai-dlc:cache-keepalive-configure', args: 'off --session' } as never)
    await settle(() => false)
    await press(ui, 'ka-ping')
    expect(seen.forks).toBe(0)
    await ui.unmount()
  })
})

// ITEM-068 (T17.6, AC-17.6.x): the band above the prompt (Terminal and Desktop) draws keep-alive's rows with a
// master button and one button per track; a press affects the current session only (no settings file written).
describe('keep-alive in the band: master and track buttons (T17.6)', () => {
  // Step 42: the band starts minimised; the track rows and their buttons are there once it is opened.
  const mountBand = mountOpenBand
  const press = async (ui: Awaited<ReturnType<typeof mountBand>>, key: string) => {
    await ui.press({ key })
    await settle(() => false) // the presses write the store and redraw after the handler returns
  }
  // Step 44 (R44.2, R44.3): each row reads its status first and ends in its button, the opposite; the head row the same.
  // `status` and `master` are the head row's status and button; `fiveStatus` and `five` the 5m row's; `oneStatus` and `one` the 1h row's.
  const rows = (text: string) => ({
    status: /⚠ ai-dlc cache-keepalive: (on|off) (?:on|off)Ping nowMinimiseClosekeepalive/.exec(text)?.[1],
    master: /⚠ ai-dlc cache-keepalive: (?:on|off) (on|off)Ping nowMinimiseClosekeepalive/.exec(text)?.[1],
    fiveStatus: /[k]eepalive 5m: (on|off)/.exec(text)?.[1],
    five: /[k]eepalive 5m:[^]*?(on|off)keepalive 1h/.exec(text)?.[1],
    oneStatus: /[k]eepalive 1h: (on|off)/.exec(text)?.[1],
    one: /[k]eepalive 1h:[^]*?(on|off)$/.exec(text)?.[1],
  })

  test('the title row with the master button, then the 5m row, then the 1h row, each with its button', async ($, on) => {
    engine(on, { tokens: 10_000 })
    const ui = await mountBand($)
    const text = textOf(await ui.drawn())
    expect(text.indexOf('⚠ ai-dlc cache-keepalive:')).toBe(0)
    expect(text.indexOf('keepalive 5m:')).toBeGreaterThan(text.indexOf('⚠ ai-dlc cache-keepalive:'))
    expect(text.indexOf('keepalive 1h:')).toBeGreaterThan(text.indexOf('keepalive 5m:'))
    expect(await ui.find({ type: 'Button', key: 'ka-master' })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'ka-5m' })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'ka-1h' })).toBeDefined()
    await ui.unmount()
  })

  test('both track lines are drawn even when nothing runs: off, with the ping limit and keep-warm time (AC-17.6.1)', async ($, on) => {
    engine(on, { tokens: 10_000 })
    const ui = await mountBand($)
    const text = textOf(await ui.drawn())
    // R44.2: a track switched on and idle reads on, with the reason; its button offers off
    expect(text).toContain('keepalive 5m: on, idle (no 5m cache write seen), ping 0/20, keep warm 1h (default)')
    expect(text).toContain('keepalive 1h: on, idle (no 1h cache write seen), ping 0/9, keep warm 8h (default)')
    expect(rows(text)).toMatchObject({ status: 'on', master: 'off', fiveStatus: 'on', five: 'off', oneStatus: 'on', one: 'off' })
    await ui.unmount()
  })

  test('the master button [off] disables both tracks for this session, and then reads [on]', async ($, on) => {
    const calls = engine(on, { tokens: 10_000 })
    const ui = await mountBand($)
    expect(rows(textOf(await ui.drawn()))).toMatchObject({ status: 'on', master: 'off' })
    await press(ui, 'ka-master')
    const text = textOf(await ui.drawn())
    // R44.3: both tracks off, so the head row reads off and its button offers on; each track reads off with an on button
    expect(rows(text)).toMatchObject({ status: 'off', master: 'on', fiveStatus: 'off', five: 'on', oneStatus: 'off', one: 'on' })
    expect(text).toContain('keepalive 5m: off (disabled)')
    expect(text).toContain('keepalive 1h: off (disabled)')
    expect(Object.keys(calls.written).filter(p => p.endsWith('settings.json') || p.endsWith('settings.local.json') || p.endsWith('cache-keepalive.json'))).toEqual([])
    await ui.unmount()
  })

  test('the master button [on] turns the master and both tracks back on, with no ping', async ($, on) => {
    engine(on, { tokens: 10_000 })
    let forks = 0
    on('model.fork', async () => (forks++, { value: { isAnswered: true, text: 'ok', usage: USAGE } }) as never)
    const ui = await mountBand($)
    await press(ui, 'ka-master')
    await press(ui, 'ka-master')
    const text = textOf(await ui.drawn())
    expect(rows(text)).toMatchObject({ status: 'on', master: 'off', fiveStatus: 'on', five: 'off', oneStatus: 'on', one: 'off' })
    expect(text).not.toContain('(disabled)')
    expect(forks).toBe(0)
    await ui.unmount()
  })

  test('a track button switches that track alone: the master and the other track are untouched', async ($, on) => {
    engine(on, { tokens: 10_000 })
    const ui = await mountBand($)
    await press(ui, 'ka-5m')
    const text = textOf(await ui.drawn())
    // R44.2: the 5m row reads off with an on button; the 1h row reads on with an off button; the head row still reads on (1h is on)
    expect(rows(text)).toMatchObject({ status: 'on', master: 'off', fiveStatus: 'off', five: 'on', oneStatus: 'on', one: 'off' })
    expect(text).toContain('keepalive 5m: off (disabled)')
    expect(text).not.toContain('keepalive 1h: off (disabled)')
    await press(ui, 'ka-5m')
    expect(rows(textOf(await ui.drawn()))).toMatchObject({ status: 'on', master: 'off', fiveStatus: 'on', five: 'off', oneStatus: 'on', one: 'off' })
    await ui.unmount()
  })

  test('a track [on] overrides a master that is off: the button follows "allowed", not "running"', async ($, on) => {
    engine(on, { tokens: 10_000 })
    const ui = await mountBand($)
    await press(ui, 'ka-master') // master off, both tracks disabled
    await press(ui, 'ka-1h') // 1h [on]
    const text = textOf(await ui.drawn())
    // R44.3: one track on is enough for the head row to read on, with an off button
    expect(rows(text)).toMatchObject({ status: 'on', master: 'off', fiveStatus: 'off', five: 'on', oneStatus: 'on', one: 'off' })
    expect(text).not.toContain('keepalive 1h: off (disabled)')
    await ui.unmount()
  })

  test('[R44.3] both tracks switched off by their own buttons: the head row reads off with an on button, and that button turns both tracks on', async ($, on) => {
    engine(on, { tokens: 10_000 })
    const ui = await mountBand($)
    await press(ui, 'ka-5m')
    expect(rows(textOf(await ui.drawn()))).toMatchObject({ status: 'on', master: 'off' }) // 1h is still on
    await press(ui, 'ka-1h')
    expect(rows(textOf(await ui.drawn()))).toMatchObject({ status: 'off', master: 'on', fiveStatus: 'off', five: 'on', oneStatus: 'off', one: 'on' })
    await press(ui, 'ka-master')
    expect(rows(textOf(await ui.drawn()))).toMatchObject({ status: 'on', master: 'off', fiveStatus: 'on', five: 'off', oneStatus: 'on', one: 'off' })
    await ui.unmount()
  })

  // Step 44 (R44.6): the seed row shows only while a track is on; with both tracks off the band is the head row `off [on]` and the track rows.
  const seeded = async ($: Parameters<TestBody>[0], on: On) => {
    const calls = engine(on, { tokens: 165_000, stepUsage: true })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    calls.tokens = 47_000
    await step($, 0)
  }
  const SEED = 'keepalive seed: cache hit, 47k read'

  test('[R44.6] the master [off] hides the seed row, the head row reads off with an on button, and a track [on] brings the row back', async ($, on) => {
    await seeded($, on)
    const ui = await mountBand($)
    expect(textOf(await ui.drawn())).toContain(SEED)
    await press(ui, 'ka-master')
    let text = textOf(await ui.drawn())
    expect(text).not.toContain(SEED)
    expect(rows(text)).toMatchObject({ status: 'off', master: 'on', fiveStatus: 'off', oneStatus: 'off' })
    await press(ui, 'ka-5m')
    text = textOf(await ui.drawn())
    expect(text).toContain(SEED)
    expect(rows(text)).toMatchObject({ status: 'on', master: 'off', fiveStatus: 'on', oneStatus: 'off' })
    await ui.unmount()
  })

  test('[R44.6] both tracks switched off by their own buttons hide the seed row; the first one switched back on shows it again', async ($, on) => {
    await seeded($, on)
    const ui = await mountBand($)
    await press(ui, 'ka-5m')
    expect(textOf(await ui.drawn())).toContain(SEED) // 1h is still on
    await press(ui, 'ka-1h')
    expect(textOf(await ui.drawn())).not.toContain(SEED)
    await press(ui, 'ka-1h')
    expect(textOf(await ui.drawn())).toContain(SEED)
    await ui.unmount()
  })

  test('[R44.3] the head row reads on while the 5m track alone is on, and its off button turns both tracks off', async ($, on) => {
    engine(on, { tokens: 10_000 })
    const ui = await mountBand($)
    await press(ui, 'ka-1h')
    expect(rows(textOf(await ui.drawn()))).toMatchObject({ status: 'on', master: 'off', fiveStatus: 'on', oneStatus: 'off' })
    await press(ui, 'ka-master')
    expect(rows(textOf(await ui.drawn()))).toMatchObject({ status: 'off', master: 'on', fiveStatus: 'off', five: 'on', oneStatus: 'off', one: 'on' })
    await ui.unmount()
  })

})

// T17.7 (ITEM-076, AC-17.7.1 to 17.7.9): an automatically handed-off chain is one keep-alive session. The
// switches and the --session overrides are kept under the chain id, so they survive the /clear (session.end
// during a handoff) and are read by the seeded session; a session started by hand is its own chain.
describe('keep-alive across an automatic handoff (T17.7)', () => {
  const KA_TASK = { id: 'b1', type: 'shell', status: 'running', description: 'build' }
  const LOCAL = '/home/test/proj/.claude/settings.local.json'
  const env = (vars: Record<string, string>) => JSON.stringify({ env: vars })
  // a low threshold, so each seeded session can hand off again after its seed turn (chainRounds, above)
  const MANY = { ...LOW, AI_DLC_AUTO_HANDOFF_MAX_CONSECUTIVE_HANDOFFS: '5' }
  const cacheRow = JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 2000, cache_creation: { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 2000 } } } })
  const bandOf = async ($: Parameters<TestBody>[0]) => { const ui = await mountOpenBand($); try { return textOf(await ui.drawn()) } finally { await ui.unmount() } }
  const pressKey = async ($: Parameters<TestBody>[0], key: string) => { const ui = await mountOpenBand($); await ui.press({ key }); await settle(() => false); await ui.unmount() }
  // One automatic handoff: the old session ends during it (as /clear does), the fresh session starts.
  async function handOff($: Parameters<TestBody>[0], calls: Calls) {
    const before = calls.cleared
    const ended = before === 0 ? 'old-session' : `new-session-${before}`
    if (before > 0) { await $.turn.complete(TURN); calls.tokens += 60_000 } // the seed turn sets the floor, then the context grows
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > before)
    expect(calls.cleared).toBe(before + 1)
    // /clear ends the old session while the handoff is under way: keep-alive must keep the chain's switches
    await $.session.end({ reason: 'clear', sessionId: ended } as never)
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length >= calls.cleared)
  }

  test('[AC-17.7.1] a track switched off in S1 stays off in the seeded session S2, and S3 after it', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, stepUsage: true, endOnClear: true, env: MANY })
    await pressKey($, 'ka-5m')
    expect(await bandOf($)).toContain('keepalive 5m: off (disabled)')
    await handOff($, calls)
    const s2 = await bandOf($)
    expect(s2).toContain('keepalive 5m: off (disabled)')
    expect(s2).not.toContain('keepalive 1h: off (disabled)')
    await handOff($, calls)
    expect(await bandOf($)).toContain('keepalive 5m: off (disabled)')
  })

  test('[AC-17.7.1] the --session keep-warm override carries too: keep warm 2h (session) in S2', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, stepUsage: true, endOnClear: true, env: MANY })
    await $.command.run({ command: 'ai-dlc:cache-keepalive-configure', args: '2h --session' } as never)
    expect(await bandOf($)).toContain('keep warm 2h (session)')
    await handOff($, calls)
    expect(await bandOf($)).toContain('keep warm 2h (session)')
  })

  test('[AC-17.7.2] no track runs in S2 and nothing of the ledger is carried: the old session\'s arming is gone', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, stepUsage: true, endOnClear: true, env: MANY, files: { '/home/test/old.jsonl': cacheRow } })
    on('classic.Stop', async () => (await flush(), {}) as never)
    on('model.fork', async () => ({ value: { isAnswered: true, text: 'ok', usage: USAGE } }) as never)
    await $.classic.Stop({ background_tasks: [KA_TASK], transcript_path: '/home/test/old.jsonl' } as never)
    expect(await bandOf($)).toContain('armed')
    await handOff($, calls)
    const text = await bandOf($)
    expect(text).not.toContain('armed')
    expect(text).toMatch(/ping 0\/20/)
  })

  test('[AC-17.7.5] handoff.carryOver false: S2 starts clean, from the settings alone', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, stepUsage: true, endOnClear: true, env: MANY, files: { [LOCAL]: env({ AI_DLC_KEEPALIVE_HANDOFF_CARRY_OVER: 'false' }) } })
    await pressKey($, 'ka-5m')
    expect(await bandOf($)).toContain('keepalive 5m: off (disabled)')
    await handOff($, calls)
    expect(await bandOf($)).not.toContain('(disabled)')
  })

  test('[AC-17.7.6] carryOver false and the master off in the settings: the exception applies (onWhenOff on), keep-alive is on in S2', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, stepUsage: true, endOnClear: true, env: MANY, files: { [LOCAL]: env({ AI_DLC_KEEPALIVE_HANDOFF_CARRY_OVER: 'false', AI_DLC_KEEPALIVE_ENABLED: 'false' }) } })
    await handOff($, calls)
    expect(await bandOf($)).toMatch(/cache-keepalive: on off/) // R44.3: it reads on, and offers to turn it off
  })

  test('[AC-17.7.4] master [off] pressed in S2 stays off for S2, and the exception turns keep-alive on again at S3', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, stepUsage: true, endOnClear: true, env: MANY, files: { [LOCAL]: env({ AI_DLC_KEEPALIVE_ENABLED: 'false' }) } })
    await handOff($, calls) // S2: the exception turned it on
    expect(await bandOf($)).toMatch(/cache-keepalive: on off/)
    await pressKey($, 'ka-master') // S2: off
    const s2 = await bandOf($)
    expect(s2).toMatch(/cache-keepalive: off on/)
    expect(s2).toContain('(disabled)')
    await handOff($, calls) // S3: the settings still say master off, so the exception applies again
    expect(await bandOf($)).toMatch(/cache-keepalive: on off/)
  })

  // R44.13: at the seed, keep-alive is turned on only when nothing is on (`!anyOn()`), not when the master setting is off
  test('[R44.13] master off in the settings but the 5m track switched on: the seed changes nothing, the 1h track stays off', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, stepUsage: true, endOnClear: true, env: MANY, files: { [LOCAL]: env({ AI_DLC_KEEPALIVE_ENABLED: 'false' }) } })
    on('classic.Stop', async () => (await flush(), {}) as never)
    await $.classic.Stop({ background_tasks: [KA_TASK], transcript_path: '/home/test/none.jsonl' } as never) // the settings are read at a Stop: the master is off
    await pressKey($, 'ka-5m') // 5m [on] overrides the master that is off
    const before = await bandOf($)
    expect(before).toMatch(/cache-keepalive: on off/)
    expect(before).toContain('keepalive 1h: off (disabled)')
    await handOff($, calls)
    const after = await bandOf($)
    expect(after).toMatch(/cache-keepalive: on off/)
    expect(after).toContain('keepalive 1h: off (disabled)') // the exception did not turn the 1h track on
    expect(after).toContain('keepalive 5m: on')
  })

  test('[AC-17.7.9] a session started by hand is its own chain: the earlier session switches are not there', async ($, on) => {
    engine(on, { tokens: 10_000, endOnClear: true })
    on('classic.Stop', async () => (await flush(), {}) as never)
    await pressKey($, 'ka-5m')
    expect(await bandOf($)).toContain('keepalive 5m: off (disabled)')
    await $.session.end({ reason: 'clear', sessionId: 'old-session' } as never) // not a handoff: the entry goes with the session
    await $.classic.Stop({ background_tasks: [KA_TASK], transcript_path: '/home/test/none.jsonl' } as never)
    expect(await bandOf($)).not.toContain('keepalive 5m: off (disabled)')
  })

  test('[AC-17.7.9] a session started by hand gets no onWhenOff exception: with the master off in the settings it stays off', async ($, on) => {
    engine(on, { tokens: 10_000, endOnClear: true, files: { [LOCAL]: env({ AI_DLC_KEEPALIVE_ENABLED: 'false' }) } })
    on('classic.Stop', async () => (await flush(), {}) as never)
    await $.session.end({ reason: 'clear', sessionId: 'old-session' } as never)
    await $.classic.Stop({ background_tasks: [KA_TASK], transcript_path: '/home/test/none.jsonl' } as never)
    expect(await bandOf($)).toMatch(/cache-keepalive: off on/) // R44.3: it reads off, and the button offers to turn it on
  })

  test('[AC-17.7.9] a lineage that cannot be read counts as a session started by hand, with a debug line', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, stepUsage: true, endOnClear: true, env: MANY, failStore: /^lineage:/ })
    const logs: string[] = []
    on('ui.log', async (_$, e) => (logs.push(e.text), { value: undefined }) as never)
    await pressKey($, 'ka-5m')
    await handOff($, calls)
    expect(await bandOf($)).not.toContain('keepalive 5m: off (disabled)')
    expect(logs.some(l => l.startsWith('chain: lineage of '))).toBe(true)
  })

  for (const [carry, whenOff] of [['true', 'true'], ['true', 'false'], ['false', 'true'], ['false', 'false']] as const) {
    test(`[AC-17.7.8] carryOver ${carry}, onWhenOff ${whenOff}: no settings file is written and no ping goes out at the handoff`, async ($, on) => {
      const calls = engine(on, { tokens: 31_000, stepUsage: true, endOnClear: true, env: MANY, files: { [LOCAL]: env({ AI_DLC_KEEPALIVE_ENABLED: 'false', AI_DLC_KEEPALIVE_HANDOFF_CARRY_OVER: carry, AI_DLC_KEEPALIVE_HANDOFF_ON_WHEN_OFF: whenOff }) } })
      let forks = 0
      on('model.fork', async () => (forks++, { value: { isAnswered: true, text: 'ok', usage: USAGE } }) as never)
      await handOff($, calls)
      expect(forks).toBe(0)
      expect(Object.keys(calls.written).filter(p => /settings|cache-keepalive\.json|CLAUDE\.md|AGENTS\.md/.test(p))).toEqual([])
    })
  }
})

// Step 43, A2, as step 44 (R44.7) leaves it: /ai-dlc:cache-keepalive shows only keep-alive's band, minimised, and opens
// no Pane on any surface; the band has no maximise button.
describe('[43 A2] keep-alive band: minimised by the command, no Pane', () => {
  const TITLE = '⚠ ai-dlc cache-keepalive:'
  type Opened = { id: string; title?: string; focus?: boolean; closeOnEscape?: boolean }
  const setup = (on: On, surfaces: ('terminal' | 'desktop' | 'vscode')[]) => {
    const opened: Opened[] = []
    engine(on, { tokens: 10_000, surfaces })
    on('ui.open', (_$, ev) => (opened.push(ev as never), { value: { isPlaced: true } }) as never)
    // The command pings now (live findings 3, point 7): the fork answers a hit
    on('model.fork', () => ({ value: { isAnswered: true, text: 'ok', usage: USAGE } }) as never)
    return opened
  }
  const mountOn = ($: Parameters<TestBody>[0], surface: 'terminal' | 'desktop') =>
    $.ui.mount({ plugin: 'ai-dlc', surface, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120 } as never })
  const press = async (ui: Awaited<ReturnType<typeof mountBand>>, key: string) => {
    await ui.press({ key })
    await settle(() => false)
  }
  const run = async ($: Parameters<TestBody>[0], args = '') => {
    await $.command.run({ command: 'ai-dlc:cache-keepalive', args } as never)
    await settle(() => false)
  }
  // The old arguments (on, off, a keep-warm time) are /ai-dlc:cache-keepalive-configure's (live findings 3, point 5)
  const runCfg = async ($: Parameters<TestBody>[0], args: string) => {
    await $.command.run({ command: 'ai-dlc:cache-keepalive-configure', args } as never)
    await settle(() => false)
  }

  test('[A2] [R44.7] the title row has minimise and close and no maximise control, minimised and opened', async ($, on) => {
    setup(on, ['terminal'])
    const ui = await mountBand($)
    expect(textOf(await ui.drawn())).toBe(`${TITLE} on off⏻Ping now⟳Restore□Close×`)
    expect(await ui.find({ type: 'Button', key: 'ka-max' })).toBe(undefined)
    await press(ui, 'ka-min')
    const open = textOf(await ui.drawn())
    expect(open.startsWith(`${TITLE} on offPing nowMinimiseClose`)).toBe(true) // full: the words
    expect(open).toContain('keepalive 5m:')
    expect(await ui.find({ type: 'Button', key: 'ka-max' })).toBe(undefined)
    await ui.unmount()
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    test(`[A2] the command on ${surface} opens no Pane, bare, with arguments, and configure with a switch`, async ($, on) => {
      const opened = setup(on, [surface])
      await run($)
      await runCfg($, 'off --session')
      await run($, 'bogus')
      await runCfg($, 'bogus')
      expect(opened).toEqual([])
    })

  }

  test('[A2] the command minimises an opened band and shows only the band', async ($, on) => {
    const opened = setup(on, ['terminal'])
    const ui = await mountOpenBand($)
    expect(textOf(await ui.drawn())).toContain('keepalive 5m:')
    await run($)
    expect(textOf(await ui.drawn())).toBe(`${TITLE} on off⏻Ping now⟳Restore□Close×`)
    expect(opened).toEqual([])
    await ui.unmount()
  })

  test('[A2] the command brings back a band closed with `×`, minimised', async ($, on) => {
    setup(on, ['terminal'])
    const ui = await mountOpenBand($)
    await press(ui, 'ka-close')
    expect(textOf(await ui.drawn())).not.toContain(TITLE)
    await run($)
    expect(textOf(await ui.drawn())).toBe(`${TITLE} on off⏻Ping now⟳Restore□Close×`)
    await ui.unmount()
  })

  // Step 44 (R44.7): no surface gets a Pane from the command; the band is the view everywhere.
  for (const surfaces of [['vscode'], ['terminal', 'vscode'], []] as ('terminal' | 'desktop' | 'vscode')[][]) {
    test(`[R44.7] the command on surfaces ${JSON.stringify(surfaces)} opens no Pane, and shows the band`, async ($, on) => {
      const opened = setup(on, surfaces)
      await run($)
      expect(opened).toEqual([])
      const ui = await mountBand($)
      expect(textOf(await ui.drawn())).toBe(`${TITLE} on off⏻Ping now⟳Restore□Close×`)
      await ui.unmount()
    })
  }

  test('[A2] the minimised master button still works: off for this session, the row reads off, the button reads on', async ($, on) => {
    setup(on, ['terminal'])
    const ui = await mountBand($)
    await press(ui, 'ka-master')
    expect(textOf(await ui.drawn())).toBe(`${TITLE} off on⏻Ping now⟳Restore□Close×`)
    await press(ui, 'ka-master')
    expect(textOf(await ui.drawn())).toBe(`${TITLE} on off⏻Ping now⟳Restore□Close×`)
    await ui.unmount()
  })

  // Live findings 3, point 4: the minimised row's `on` / `off` is whether keep-alive runs (any track on), not the master alone.
  test('[live3 p4] [R44.3] the master off with a track switched on: the minimised row reads on (a track is on in force) and its button offers off, which turns both tracks off', async ($, on) => {
    setup(on, ['terminal'])
    const ui = await mountBand($)
    await runCfg($, 'off --session')
    // the row's word, then the master button's (the button names the press); the icons and labels after them are point 8's
    expect(textOf(await ui.drawn()).startsWith(`${TITLE} off on`)).toBe(true)
    await runCfg($, 'on --session --track 1h')
    expect(textOf(await ui.drawn()).startsWith(`${TITLE} on off`)).toBe(true)
    await runCfg($, 'off --session --track 1h')
    expect(textOf(await ui.drawn()).startsWith(`${TITLE} off on`)).toBe(true)
    await ui.unmount()
  })
})
