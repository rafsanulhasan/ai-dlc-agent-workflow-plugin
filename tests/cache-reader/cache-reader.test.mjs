// The Cache Lab transcript reader (plugins/claude/ai-dlc-lens/hooks/cache-reader.mjs; cache-lab LLD 3, 11):
// AC-22.1.1, 22.1.4 (reader half), 22.4.6 (reader half), dedupe, the large file, paging and the envelope.
// Run by `node --test "tests/**/*.test.mjs"`, never by `plugin test`.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { statSync, utimesSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BUST_THRESHOLD, PAGE_BYTES, TURN_STEPS, createParser, fileIds, parseTranscript, turnOf } from '../../plugins/claude/ai-dlc-lens/hooks/cache-reader.mjs'
import { F1, assistant, at, f1Folder, f1Lines, user, writeFile } from './fixtures.mjs'

const READER = fileURLToPath(new URL('../../plugins/claude/ai-dlc-lens/hooks/cache-reader.mjs', import.meta.url))
const cli = (...args) => {
  const r = spawnSync(process.execPath, [READER, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  return { status: r.status, out: r.stdout, json: JSON.parse(r.stdout) }
}

describe('fileIds', () => {
  test('a main transcript is its session, stream main', () => assert.deepEqual(fileIds('abc.jsonl'), { session: 'abc', stream: 'main' }))
  test('a subagent transcript is the parent session and agent:<id>', () => assert.deepEqual(fileIds('abc/subagents/agent-a1b2.jsonl'), { session: 'abc', stream: 'agent:a1b2' }))
  test('anything else under a session folder stays main', () => assert.deepEqual(fileIds('abc/other/x.jsonl'), { session: 'abc', stream: 'main' }))
})

describe('AC-22.1.1 F1 on disk: nine calls, fields exact', () => {
  test('read gives the calls of every file with the exact fields', () => {
    const dir = f1Folder()
    const { json, status } = cli('read', '--folder', dir, '--files', 'A.jsonl,B.jsonl,C.jsonl')
    assert.equal(status, 0)
    assert.equal(json.error, null)
    const calls = json.data.files.flatMap(f => f.calls)
    assert.equal(calls.length, 9)
    const a = json.data.files[0].calls
    assert.deepEqual(a[0], { session: 'A', stream: 'main', at: at(10, 0), model: 'fixture-model-m', in: 100, out: 100, cr: 0, cc: 20000, order: 0, id: 'msg_A1', cc5m: 20000, cc1h: 0 })
    assert.deepEqual(a[4], { session: 'A', stream: 'main', at: at(10, 13), model: 'fixture-model-n', in: 100, out: 100, cr: 0, cc: 12000, order: 4, id: 'msg_A5', cc5m: 0, cc1h: 12000 })
  })
  test('A6 wrote 3,000 with no split: cc 3000 and no cc5m or cc1h at all', () => {
    const calls = parseTranscript(f1Lines('A'), 'A.jsonl').calls
    const a6 = calls[5]
    assert.equal(a6.cc, 3000)
    assert.ok(!('cc5m' in a6) && !('cc1h' in a6))
  })
  test('the totals over F1 are the stories\': in 700, cr 52,000, cc 145,800 (5m 130,800, 1h 12,000, unknown 3,000)', () => {
    const calls = ['A', 'B', 'C'].flatMap(s => parseTranscript(f1Lines(s), `${s}.jsonl`).calls)
    const sum = f => calls.reduce((n, c) => n + (c[f] ?? 0), 0)
    assert.equal(sum('in'), 700)
    assert.equal(sum('cr'), 52000)
    assert.equal(sum('cc'), 145800)
    assert.equal(sum('cc5m'), 130800)
    assert.equal(sum('cc1h'), 12000)
    assert.equal(calls.filter(c => !('cc5m' in c)).reduce((n, c) => n + c.cc, 0), 3000)
  })
  test('B0 is a sidechain row: its stream is agent:unknown, not main', () => {
    const b = parseTranscript(f1Lines('B'), 'B.jsonl').calls
    assert.equal(b[0].stream, 'agent:unknown')
    assert.equal(b[1].stream, 'main')
  })
  test('the call count and the order are the file\'s: order counts the rows read', () => {
    assert.deepEqual(parseTranscript(f1Lines('A'), 'A.jsonl').calls.map(c => c.order), [0, 1, 2, 3, 4, 5])
  })
})

describe('AC-22.1.4 rows that are not calls', () => {
  const ok = assistant({ session: 'S', ms: at(10, 0), cc5m: 5, cc1h: 0, id: 'm1' })
  test('a line that is not JSON is skipped and counted; the others are read', () => {
    const r = parseTranscript([ok, '{ not json', ok.replace('m1', 'm2')], 'S.jsonl')
    assert.equal(r.calls.length, 2)
    assert.equal(r.skipped, 1)
  })
  test('a truncated last line (a file being written) is such a line', () => {
    const r = parseTranscript([ok, ok.replace('m1', 'm2').slice(0, 40)], 'S.jsonl')
    assert.equal(r.calls.length, 1)
    assert.equal(r.skipped, 1)
  })
  test('blank lines and JSON that is not an object are neither calls nor skipped', () => {
    const r = parseTranscript(['', '   ', 'null', '3', ok], 'S.jsonl')
    assert.equal(r.calls.length, 1)
    assert.equal(r.skipped, 0)
  })
  test('an assistant row with no usage, with no output_tokens or with a bad timestamp is not a call', () => {
    const noUsage = JSON.stringify({ type: 'assistant', timestamp: new Date(at(10, 0)).toISOString(), message: { id: 'x', model: 'm' } })
    const noOut = JSON.stringify({ type: 'assistant', timestamp: new Date(at(10, 0)).toISOString(), message: { id: 'y', model: 'm', usage: { input_tokens: 1 } } })
    const badTime = JSON.stringify({ type: 'assistant', timestamp: 'yesterday', message: { id: 'z', model: 'm', usage: { output_tokens: 1 } } })
    const r = parseTranscript([noUsage, noOut, badTime], 'S.jsonl')
    assert.deepEqual(r, { calls: [], skipped: 0 })
  })
  test('a user row and a synthetic-model row are not calls', () => {
    const synthetic = assistant({ session: 'S', ms: at(10, 0), model: '<synthetic>', id: 's1' })
    assert.equal(parseTranscript([user({ uuid: 'u1', promptId: 'p1' }), synthetic], 'S.jsonl').calls.length, 0)
  })
  test('missing token fields read as 0, and a total absent with a split is the split\'s sum', () => {
    const row = JSON.stringify({ type: 'assistant', sessionId: 'S', timestamp: new Date(at(10, 0)).toISOString(), message: { id: 'q', model: 'm', usage: { output_tokens: 7, cache_creation: { ephemeral_5m_input_tokens: 3, ephemeral_1h_input_tokens: 4 } } } })
    assert.deepEqual(parseTranscript([row], 'S.jsonl').calls[0], { session: 'S', stream: 'main', at: at(10, 0), model: 'm', in: 0, out: 7, cr: 0, cc: 7, order: 0, id: 'q', cc5m: 3, cc1h: 4 })
  })
  test('the session falls back to the file name when a row names none', () => {
    const row = JSON.stringify({ type: 'assistant', timestamp: new Date(at(10, 0)).toISOString(), message: { model: 'm', usage: { output_tokens: 1 } } })
    assert.equal(parseTranscript([row], 'file-session.jsonl').calls[0].session, 'file-session')
  })
  test('a row with no message id is kept, and two of them are two calls', () => {
    const row = JSON.stringify({ type: 'assistant', timestamp: new Date(at(10, 0)).toISOString(), message: { model: 'm', usage: { output_tokens: 1 } } })
    assert.equal(parseTranscript([row, row], 'S.jsonl').calls.length, 2)
  })
})

describe('dedupe: one response is several rows', () => {
  test('three rows with one message.id count once, and the last row wins', () => {
    const row = out => assistant({ session: 'S', ms: at(10, 0), id: 'same', out, cc5m: 100, cc1h: 0 })
    const r = parseTranscript([row(1), row(5), row(9)], 'S.jsonl')
    assert.equal(r.calls.length, 1)
    assert.equal(r.calls[0].out, 9)
  })
  test('different ids are different calls', () => {
    const row = id => assistant({ session: 'S', ms: at(10, 0), id, cc5m: 1, cc1h: 0 })
    assert.equal(parseTranscript([row('a'), row('b')], 'S.jsonl').calls.length, 2)
  })
  test('a deduped row keeps the first row\'s place', () => {
    const row = (id, out) => assistant({ session: 'S', ms: at(10, 0), id, out, cc5m: 1, cc1h: 0 })
    const r = parseTranscript([row('a', 1), row('b', 2), row('a', 3)], 'S.jsonl')
    assert.deepEqual(r.calls.map(c => [c.id, c.out]), [['a', 3], ['b', 2]])
  })
})

describe('AC-22.4.6 the turn of a bust (the parentUuid walk)', () => {
  const W = n => assistant({ session: 'S', ms: at(10, n), id: `m${n}`, uuid: `a${n}`, parentUuid: n === 0 ? 'u1' : `a${n - 1}`, cc5m: n === 0 ? 100 : 11000, cc1h: 0 })
  test('a bust walks parentUuid up to a user row with a promptId: pid and the 1-based turn', () => {
    const lines = [user({ uuid: 'u1', promptId: 'p-one' }), W(0), user({ uuid: 'u2', parentUuid: 'a0', promptId: 'p-two' }), assistant({ session: 'S', ms: at(10, 5), id: 'bust', uuid: 'a9', parentUuid: 'u2', cc5m: 11000, cc1h: 0 })]
    const calls = parseTranscript(lines, 'S.jsonl').calls
    assert.equal(calls[1].pid, 'p-two')
    assert.equal(calls[1].turn, 2)
    assert.ok(!('pid' in calls[0]), 'only a bust is resolved')
  })
  test('the walk passes assistant rows (tool use chains) to reach the user row', () => {
    const lines = [user({ uuid: 'u1', promptId: 'p-one' }), W(0), W(1), W(2), W(3)]
    const calls = parseTranscript(lines, 'S.jsonl').calls
    assert.equal(calls[3].pid, 'p-one')
    assert.equal(calls[3].turn, 1)
  })
  test('a missing parent, a cycle and a chain longer than the limit give no turn', () => {
    const rows = new Map()
    assert.equal(turnOf(rows, { parentUuid: 'ghost' }), undefined)
    rows.set('x', { type: 'assistant', parentUuid: 'y' })
    rows.set('y', { type: 'assistant', parentUuid: 'x' })
    assert.equal(turnOf(rows, { parentUuid: 'x' }), undefined)
    const long = new Map()
    for (let i = 0; i < TURN_STEPS + 5; i++) long.set(`n${i}`, { type: 'assistant', parentUuid: `n${i + 1}` })
    long.set(`n${TURN_STEPS + 5}`, { type: 'user', promptId: 'far' })
    assert.equal(turnOf(long, { parentUuid: 'n0' }), undefined)
  })
  test('a user row without a promptId does not end the walk with an answer', () => {
    const rows = new Map([['u', { type: 'user', parentUuid: 'v' }], ['v', { type: 'user', promptId: 'p' }]])
    assert.equal(turnOf(rows, { parentUuid: 'u' }), 'p')
  })
  test('no chain at all: the bust has no pid and no turn (No turn attribution)', () => {
    const calls = parseTranscript([assistant({ session: 'S', ms: at(10, 0), id: 'b', cc5m: 11000, cc1h: 0 })], 'S.jsonl').calls
    assert.ok(!('pid' in calls[0]) && !('turn' in calls[0]))
  })
  test('the threshold is strict: 10,000 is not a bust to resolve, 10,001 is', () => {
    assert.equal(BUST_THRESHOLD, 10000)
    const mk = cc => parseTranscript([user({ uuid: 'u', promptId: 'p' }), assistant({ session: 'S', ms: at(10, 0), id: 'b', parentUuid: 'u', cc5m: cc, cc1h: 0 })], 'S.jsonl').calls[0]
    assert.ok(!('pid' in mk(10000)))
    assert.equal(mk(10001).pid, 'p')
  })
  test('a streamed parser gives what parseTranscript gives', () => {
    const lines = [user({ uuid: 'u1', promptId: 'p' }), W(0), W(1)]
    const p = createParser('S.jsonl')
    for (const l of lines) p.line(l)
    assert.deepEqual(p.end(), parseTranscript(lines, 'S.jsonl'))
  })
})

describe('privacy: nothing but ids, times, model ids and counts is printed', () => {
  test('neither the reply text nor the prompt text reaches stdout', () => {
    const dir = f1Folder()
    writeFile(dir, 'P.jsonl', [user({ uuid: 'u', promptId: 'p', session: 'P' }), assistant({ session: 'P', ms: at(10, 0), id: 'pm', parentUuid: 'u', cc5m: 11000, cc1h: 0 })])
    const r = cli('read', '--folder', dir, '--files', 'P.jsonl')
    assert.doesNotMatch(r.out, /SECRET/)
    assert.equal(r.json.data.files[0].calls[0].pid, 'p')
  })
})

describe('list', () => {
  test('lists main transcripts and subagent transcripts with size and mtime, ignoring other files', () => {
    const dir = f1Folder()
    writeFile(dir, 'A/subagents/agent-x1.jsonl', ['{}'])
    writeFile(dir, 'A/subagents/notes.txt', 'x')
    writeFile(dir, 'readme.md', 'x')
    writeFile(dir, 'B/other/agent-y.jsonl', '{}')
    const { json } = cli('list', '--folder', dir)
    assert.equal(json.error, null)
    assert.deepEqual(json.data.files.map(f => f.rel).sort(), ['A.jsonl', 'A/subagents/agent-x1.jsonl', 'B.jsonl', 'C.jsonl'])
    const a = json.data.files.find(f => f.rel === 'A.jsonl')
    assert.equal(a.size, statSync(join(dir, 'A.jsonl')).size)
    assert.equal(a.mtimeMs, statSync(join(dir, 'A.jsonl')).mtimeMs)
  })
  test('--since keeps only files modified at or after it', () => {
    const dir = f1Folder()
    const old = new Date('2026-01-01T00:00:00Z')
    utimesSync(join(dir, 'A.jsonl'), old, old)
    const since = Date.parse('2026-06-01T00:00:00Z')
    const { json } = cli('list', '--folder', dir, '--since', String(since))
    assert.deepEqual(json.data.files.map(f => f.rel).sort(), ['B.jsonl', 'C.jsonl'])
  })
  test('a folder that cannot be read is an error with a reason, not an empty list', () => {
    const { json, status } = cli('list', '--folder', join(f1Folder(), 'nope'))
    assert.equal(status, 1)
    assert.equal(json.data, null)
    assert.match(json.error, /ENOENT/)
  })
})

describe('the envelope', () => {
  test('no --folder, an unknown mode and no mode are errors with a null data and exit 1', () => {
    for (const args of [['list'], ['frobnicate', '--folder', '.'], []]) {
      const r = cli(...args)
      assert.equal(r.status, 1, args.join(' '))
      assert.equal(r.json.data, null)
      assert.equal(typeof r.json.error, 'string')
    }
  })
  test('a named file that is missing is a reader error with the file and the code', () => {
    const r = cli('read', '--folder', f1Folder(), '--files', 'ghost.jsonl')
    assert.equal(r.status, 1)
    assert.match(r.json.error, /^ghost\.jsonl: ENOENT/)
  })
  test('a name that climbs out of the folder is refused', () => {
    const r = cli('read', '--folder', f1Folder(), '--files', '../escape.jsonl')
    assert.equal(r.status, 1)
    assert.match(r.json.error, /outside the folder/)
  })
  test('a success exits 0 with a null error', () => {
    const r = cli('read', '--folder', f1Folder(), '--files', 'C.jsonl')
    assert.equal(r.status, 0)
    assert.equal(r.json.error, null)
  })
  test('read with no files names none: an empty page, not an error', () => {
    const r = cli('read', '--folder', f1Folder())
    assert.deepEqual(r.json, { data: { files: [] }, error: null })
  })
})

describe('the large file and the page limit', () => {
  test('a file over 4 MiB is streamed whole: every call is read', () => {
    const dir = f1Folder()
    const lines = []
    const pad = 'x'.repeat(2000)
    for (let i = 0; i < 2500; i++) lines.push(JSON.stringify({ type: 'assistant', sessionId: 'BIG', timestamp: new Date(at(10, 0) + i * 1000).toISOString(), pad, message: { id: `big${i}`, model: 'm', usage: { output_tokens: 1, cache_read_input_tokens: i } } }))
    writeFile(dir, 'BIG.jsonl', lines)
    assert.ok(statSync(join(dir, 'BIG.jsonl')).size > 4 * 1024 * 1024)
    const r = cli('read', '--folder', dir, '--files', 'BIG.jsonl')
    assert.equal(r.json.error, null)
    assert.equal(r.json.data.files[0].calls.length, 2500)
    assert.equal(r.json.data.files[0].calls.at(-1).cr, 2499)
    assert.ok(r.out.length < 4 * 1024 * 1024, 'the output stays under the host\'s 4 MiB stdout cap')
  })
  test('pages stop at the byte limit: data.next is the index of the first file left out', () => {
    const dir = f1Folder()
    const names = []
    for (let f = 0; f < 3; f++) {
      const lines = []
      for (let i = 0; i < 9000; i++) lines.push(JSON.stringify({ type: 'assistant', sessionId: `P${f}`, timestamp: new Date(at(10, 0) + i * 1000).toISOString(), message: { id: `p${f}-${i}`, model: 'fixture-model-with-a-long-name', usage: { output_tokens: 1, input_tokens: 123456, cache_read_input_tokens: 123456, cache_creation_input_tokens: 123456 } } }))
      writeFile(dir, `P${f}.jsonl`, lines)
      names.push(`P${f}.jsonl`)
    }
    const first = cli('read', '--folder', dir, '--files', names.join(','))
    assert.equal(first.json.error, null)
    assert.ok(first.json.data.next >= 1 && first.json.data.next < 3, `next = ${first.json.data.next}`)
    assert.equal(first.json.data.files.length, first.json.data.next)
    assert.ok(first.out.length <= PAGE_BYTES + 1024)
    const rest = cli('read', '--folder', dir, '--files', names.slice(first.json.data.next).join(','))
    assert.equal(rest.json.error, null)
    assert.equal(first.json.data.files.length + rest.json.data.files.length, 3)
  })
  test('one file too big for a page is an error that names it', () => {
    const dir = f1Folder()
    const lines = []
    for (let i = 0; i < 40000; i++) lines.push(JSON.stringify({ type: 'assistant', sessionId: 'HUGE', timestamp: new Date(at(10, 0) + i * 1000).toISOString(), message: { id: `h${i}`, model: 'fixture-model-with-a-long-name', usage: { output_tokens: 1, input_tokens: 123456, cache_read_input_tokens: 123456, cache_creation_input_tokens: 123456 } } }))
    writeFile(dir, 'HUGE.jsonl', lines)
    const r = cli('read', '--folder', dir, '--files', 'HUGE.jsonl')
    assert.equal(r.status, 1)
    assert.match(r.json.error, /^HUGE\.jsonl: too many calls for one page/)
  })
})

test('F1 has the nine calls the stories list', () => assert.equal(F1.length, 9))
