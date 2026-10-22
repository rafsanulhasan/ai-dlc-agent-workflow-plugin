import { describe, expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import type { On, SessionMessage } from 'claude-code'
import { briefPrompt, extractFacts, factsBlock, hasUnansweredLastRequest, isValidBrief, markUnverifiedFigures } from '../brief.ts'
import { renderTemplate } from '../templates.ts'
import { parseBrief } from '../viewer.ts'
import { DEFAULT_WINDOW, contextLine, parseConfig, windowOf } from '../config.ts'

// renamed: the names /rename was run with, in order; commandOrder: every slash command run, in order.
type Calls = { compacts: number; steps: number; cleared: number; seeded: string[]; written: Record<string, string>; completes: number; tokens: number; prompts: string[]; toasts: string[]; ran: number; clearedAtWrite: Record<string, number>; renamed: string[]; commandOrder: string[]; branchQueries: number }

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
function engine(on: On, opts: { tokens: number; files?: Record<string, string>; env?: Record<string, string>; brief?: string | null; messages?: SessionMessage[]; toolChars?: number; streamToolChars?: number; store?: Record<string, unknown>; stepUsage?: boolean; surfaces?: ('terminal' | 'desktop' | 'mobile' | 'vscode')[]; noSh?: boolean; git?: Git; failWrite?: RegExp; window?: number | null; percent?: number; commands?: string[]; failRename?: boolean }): Calls {
  const calls: Calls = { compacts: 0, steps: 0, cleared: 0, seeded: [], written: {}, completes: 0, tokens: opts.tokens, prompts: [], toasts: [], ran: 0, clearedAtWrite: {}, renamed: [], commandOrder: [], branchQueries: 0 }
  let sessionId = 'old-session'
  let clears = 0
  mock.env(on, { HOME: '/home/test', ...(opts.env ?? {}) })
  clock = mock.clock(on) // the panel's spinner and collapse timers
  on('session.surfaces', async () => ({ value: opts.surfaces ?? ['terminal'] }))
  on('ui.render', { component: 'AbovePrompt' }, async ($, e) => { // the engine draws nothing in the band
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  mock.store(on, opts.store) // the test's $ has no store noun: what the mod finds in its store is seeded here
  on('turn.complete', async () => ({ text: 'ok' }))
  // window: the host's context window, 200k unless the test sets one; null: the host reports none.
  // percent: the host's own share, 0 to 100, sent only when the test sets it.
  on('session.usage', async () => ({ value: { startedAt: 0, context: { tokens: calls.tokens, ...(opts.window === null ? {} : { window: opts.window ?? 200_000 }), ...(opts.percent === undefined ? {} : { percent: opts.percent }) }, rateLimits: [] } }))
  on('session.id', async () => ({ value: sessionId }))
  on('session.cwd', async () => ({ value: '/home/test/proj' }))
  on('fs.read', async (_$, e) => {
    const path = posix(e.path)
    const text = calls.written[path] ?? opts.files?.[path]
    // The shipped defaults: the real files in the mod's templates/ folder.
    if (text === undefined && path.endsWith("/templates/brief.md")) return { value: SHIPPED_BRIEF }
    if (text === undefined && path.endsWith("/templates/instructions.md")) return { value: SHIPPED_INSTRUCTIONS }
    if (text === undefined && path.endsWith("/templates/session-handoff.md")) return { value: SHIPPED_SESSION }
    if (text === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: text }
  })
  on('session.messages', async () => ({ value: opts.messages ?? BASIC }))
  on('model.complete', async (_$, e) => {
    calls.completes++
    calls.prompts.push(e.prompt)
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
    const names = new Map<string, 'file' | 'directory'>()
    for (const p of [...Object.keys(opts.files ?? {}), ...Object.keys(calls.written)]) {
      if (!p.startsWith(`${dir}/`)) continue
      const rest = p.slice(dir.length + 1)
      const name = rest.split('/')[0]!
      names.set(name, rest.includes('/') ? 'directory' : 'file')
    }
    if (!names.size) throw new Error(`ENOENT ${e.path}`)
    return { value: [...names].map(([name, kind]) => ({ name, kind: kind as never, size: 0, mtimeMs: 0, isLink: false })) }
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
  on('session.compact', async (_$, e) => {
    calls.compacts++
    return { messages: e.messages }
  })
  // The real request: reached only when the mod lets the step through.
  on('turn.step', async function* (_$, e) {
    calls.steps++
    // stepUsage: the response reports the request's size, as the real engine does.
    const usage = opts.streamToolChars ? { input_tokens: 0, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } as never
      : opts.stepUsage ? { input_tokens: 10, output_tokens: 0, cache_read_input_tokens: calls.tokens - 10, cache_creation_input_tokens: 0 } as never
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

// Every string in a drawn tree, in order: Text children, a Markdown's text, a Button's label.
const textOf = (n: unknown): string => typeof n === 'string' ? n
  : Array.isArray(n) ? n.map(textOf).join('')
  : n && typeof n === 'object' ? Object.entries(n).map(([k, v]) => k === 'children' || k === 'text' || k === 'label' || k === 'props' ? textOf(v) : '').join('')
  : ''

// The band above the prompt as drawn, flattened to its text; '' when the mod draws nothing.
async function band($: Parameters<TestBody>[0]): Promise<string> {
  const ui = await mountBand($)
  try {
    return textOf(await ui.drawn())
  } finally {
    await ui.unmount()
  }
}

async function settle(check: () => boolean) {
  for (let i = 0; i < 50 && !check(); i++) await new Promise(r => setTimeout(r, 10))
}

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

  test('a blank viewer setting means no server, and the link is the local file', { options: { viewer: '' } }, async ($, on) => {
    const calls = engine(on, { tokens: 165_000 })
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

  test('the thresholdPercent userConfig field sets the share of the window', { options: { thresholdPercent: 50 } }, async ($, on) => {
    const calls = engine(on, { tokens: 120_000 })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.cleared).toBe(1)
    expect(calls.written['/home/test/.claude/state/auto-handoff/auto-handoff.log']).toContain('threshold=100000')
  })

  test('the retired token threshold field is ignored, never read as a percent', { options: { threshold: 100_000 } }, async ($, on) => {
    const calls = engine(on, { tokens: 120_000 })
    await $.turn.complete(TURN)
    await settle(() => false)
    expect(calls.cleared).toBe(0) // 120k is under 80% of 200k
  })

  // The host refuses values outside min and max in plugin.json before the module loads; parseConfig
  // still clamps, for a host that does not.
  test('parseConfig clamps thresholdPercent to 1..100 and falls back to 80 on a bad value', () => {
    const pct = (v: unknown) => parseConfig({ thresholdPercent: v }).thresholdPercent
    expect(pct(150)).toBe(100)
    expect(pct(0.5)).toBe(1)
    expect(pct(0)).toBe(80)
    expect(pct(-5)).toBe(80)
    expect(pct('90')).toBe(80)
    expect(pct(undefined)).toBe(80)
    expect(pct(65)).toBe(65)
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
    expect(log).toContain('no context window reported: thresholdPercent applies to 500000, a line of 400000 tokens; if the real window is smaller than 400000, no handoff fires: set thresholdTokens (AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS) to an absolute token count')
    calls.tokens = 400_000
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.cleared).toBe(1)
  })

  test('the fallback log line follows thresholdPercent', { options: { thresholdPercent: 50 } }, async ($, on) => {
    const calls = engine(on, { tokens: 1, window: null })
    await $.turn.complete(TURN)
    await settle(() => false)
    const log = calls.written['/home/test/.claude/state/auto-handoff/auto-handoff.log'] ?? ''
    expect(log).toContain('no context window reported: thresholdPercent applies to 500000, a line of 250000 tokens; if the real window is smaller than 250000, no handoff fires: set thresholdTokens (AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS) to an absolute token count')
    expect(log).not.toContain('400000')
  })

  test('AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS overrides thresholdPercent with an absolute count', { options: { thresholdPercent: 50 } }, async ($, on) => {
    const calls = engine(on, { tokens: 120_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '150000' } })
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

  test('thresholdPercent 100 puts the line at the whole window', { options: { thresholdPercent: 100 } }, async ($, on) => {
    const calls = engine(on, { tokens: 199_999 })
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

  test('each brief gets a viewer page, and the chain links forward once the next session hands off', { options: { viewer: 'tailscale:3846' } }, async ($, on) => {
    const calls = engine(on, { tokens: 165_000 })
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

  test('a session seeded before a hot reload keeps its chain: lineage comes from the store', async ($, on) => {
    // Seen live: the reload wiped the in-memory lineage, and the next brief started a new chain.
    const dir = '/home/test/.claude/state/auto-handoff'
    const calls = engine(on, { tokens: 165_000, store: { 'lineage:old-session': { from: 'earlier', chain: 'first' } } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    const header = parseBrief(calls.written[`${dir}/old-session.md`] ?? '').header
    expect(header.from).toBe('earlier')
    expect(header.chain).toBe('first')
    // Seeded before depth was recorded: unknown beats a wrong guess.
    expect(header.depth).toBeUndefined()
    expect(calls.prompts[0]).not.toContain('Handoff depth')
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

  test('the instructions template file replaces the instructions', { options: { instructionsTemplate: '/custom/i.md' } }, async ($, on) => {
    const calls = engine(on, { tokens: 165_000, files: { '/custom/i.md': '## Rules\nJust keep going.' } })
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

  test('maxConsecutiveHandoffs sets the progress guard', { options: { maxConsecutiveHandoffs: 1 } }, async ($, on) => {
    const calls = engine(on, { tokens: 31_000, env: { AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS: '20000' } })
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

  test('the headroom warning names /config when thresholdPercent is the source', { options: { thresholdPercent: 30 } }, async ($, on) => {
    const calls = engine(on, { tokens: 65_000 })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    await $.classic.SessionStart({ source: 'clear' })
    await settle(() => calls.seeded.length > 0)
    calls.tokens = 45_000
    await $.turn.complete(TURN)
    expect(await band($)).toContain('threshold 60k (30% of the 200k window, thresholdPercent in /config) leaves 15k')
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

  test('the panel above the prompt walks the handoff, then collapses', { options: { viewer: 'tailscale:3846' } }, async ($, on) => {
    const calls = engine(on, { tokens: 165_000, stepUsage: true })
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
    expect(textOf(await ui.drawn())).toBe('')
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

// An AI-DLC run on disk: run.md as the handoff skill's Run state template writes it.
const ROOT = '/home/test/proj'
const GIT: Git = { root: ROOT, branch: 'feat/x', commit: 'abc1234' }
const runMd = (o: { status?: string; branch?: string; session?: string; updated?: string; next?: string; stages?: string } = {}) => `---
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
last-record: 2-orchestrator-to-agent-manager.handoff.md
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
    expect(log).toContain(`${path} written but not linked from run.md`)
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

  test('without a run the brief has no records section', async ($, on) => {
    const calls = engine(on, { tokens: 165_000 })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.written['/home/test/.claude/state/auto-handoff/old-session.md']).not.toContain('## Handoff records')
  })
})

describe('session names', () => {
  test('the chain is named Session 1, 2, 3, 4 after the original name, never nested', async ($, on) => {
    const calls = engine(on, { tokens: 31_000, env: LOW, git: GIT, files: { [RUN_MD]: runMd() } })
    await $.classic.SessionStart({ source: 'startup', session_title: 'Fix the parser' } as never)
    const answers = await chainRounds($, calls, 3)
    // The first session is renamed before its /clear; the seeded ones are named through SessionStart.
    expect(calls.renamed).toEqual(['[ai-dlc:auto-handoff]: Fix the parser (Session 1)'])
    expect(calls.commandOrder.slice(0, 2)).toEqual(['rename', 'clear'])
    expect(answers.map(a => a.sessionTitle)).toEqual([
      '[ai-dlc:auto-handoff]: Fix the parser (Session 2)',
      '[ai-dlc:auto-handoff]: Fix the parser (Session 3)',
      '[ai-dlc:auto-handoff]: Fix the parser (Session 4)',
    ])
  })

  test('a session already carrying the chain name is not wrapped again', async ($, on) => {
    const calls = engine(on, { tokens: 165_000 })
    await $.classic.SessionStart({ source: 'startup', session_title: '[ai-dlc:auto-handoff]: Fix the parser (Session 7)' } as never)
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.renamed).toEqual(['[ai-dlc:auto-handoff]: Fix the parser (Session 1)'])
    const answer = await $.classic.SessionStart({ source: 'clear' }) as { sessionTitle?: string }
    expect(answer.sessionTitle).toBe('[ai-dlc:auto-handoff]: Fix the parser (Session 2)')
  })

  test('without a title from the engine, the transcript\'s custom-title names the chain, else the short id', async ($, on) => {
    const transcript = '/home/test/.claude/projects/-home-test-proj/old-session.jsonl'
    const lines = ['{"type":"ai-title","aiTitle":"Guessed","sessionId":"old-session"}', '{"type":"custom-title","customTitle":"Named by me","sessionId":"old-session"}'].join('\n')
    const calls = engine(on, { tokens: 165_000, files: { [transcript]: lines } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.renamed).toEqual(['[ai-dlc:auto-handoff]: Named by me (Session 1)'])
  })

  test('with no title anywhere, the short id is the name', async ($, on) => {
    const calls = engine(on, { tokens: 165_000 })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(calls.renamed).toEqual(['[ai-dlc:auto-handoff]: old-sess (Session 1)'])
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

  test('precedence: the repository file beats /config, which beats the default', { options: { thresholdPercent: 50 } }, async ($, on) => {
    const calls = engine(on, { tokens: 190_000, git: GIT, files: { [REPO]: JSON.stringify({ thresholdPercent: 60 }) } })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(thresholdIn(calls)).toBe('120000') // 60% of 200k, not /config's 50%
  })

  test('precedence: /config beats the default', { options: { thresholdPercent: 50 } }, async ($, on) => {
    const calls = engine(on, { tokens: 190_000, git: GIT })
    await $.turn.complete(TURN)
    await settle(() => calls.cleared > 0)
    expect(thresholdIn(calls)).toBe('100000')
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

  test('null in the repository file means not set here', { options: { thresholdPercent: 50 } }, async ($, on) => {
    const calls = engine(on, { tokens: 190_000, git: GIT, files: { [REPO]: JSON.stringify({ $schema: './auto-handoff.schema.json', thresholdPercent: null, thresholdTokens: null }) } })
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
  const IGNORED = 'config: briefTemplate, viewer in .ai-dlc/auto-handoff.json ignored: Claude Code does not trust this folder'

  test('untrusted: viewer and the templates from the repository file are ignored and logged, other keys apply', async ($, on) => {
    const calls = engine(on, { tokens: 190_000, git: GIT, files: { [REPO_FILE]: risky } })
    await $.classic.SessionStart({ source: 'startup' })
    expect(calls.written['/repo/chosen.md']).toBeUndefined()
    expect(calls.written['/home/test/.claude/auto-handoff/brief.md']).toBeDefined()
    expect(calls.written[LOG_FILE]).toContain(`${IGNORED} (~/.claude.json was not readable); set them in the env of .claude/settings.local.json or in /config instead`)
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
