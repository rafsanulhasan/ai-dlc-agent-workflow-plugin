import { describe, expect, test } from 'claude-code/testing'
import { FileCache, READ_BATCH, batches, checkEnvelope, folderOf, mergeCalls, sessionOfTranscript } from '../hooks/transcripts'
import type { FileRecord } from '../hooks/transcripts'
import { at, call } from './fixtures/cache-lab'

// The lens side of the Cache Lab reader (ITEM-069, LLD 4): the envelope check, the per-file cache, the merge.

const env = (o: unknown) => JSON.stringify(o)

describe('checkEnvelope: a figure is shown whole or not at all', () => {
  test('a good envelope gives its data', () => {
    expect(checkEnvelope(env({ data: { files: [] }, error: null }), false, 0)).toEqual({ ok: true, value: { files: [] } })
  })
  test('truncated stdout is refused, whatever it holds', () => {
    expect(checkEnvelope(env({ data: {}, error: null }), true, 0)).toEqual({ ok: false, reason: 'transcript reader output truncated' })
  })
  test('output that is not JSON: "no envelope" after exit 0, the exit code otherwise', () => {
    expect(checkEnvelope('oops', false, 0)).toEqual({ ok: false, reason: 'transcript reader printed no envelope' })
    expect(checkEnvelope('', false, 1)).toEqual({ ok: false, reason: 'transcript reader exited 1' })
  })
  test('JSON that is not an envelope is "no envelope"', () => {
    for (const bad of ['null', '3', '"x"', '{}', env({ data: 1 }), env({ error: null })]) expect(checkEnvelope(bad, false, 0)).toEqual({ ok: false, reason: 'transcript reader printed no envelope' })
  })
  test('an error string wins, cut to its first line, even with data and exit 0', () => {
    expect(checkEnvelope(env({ data: { files: [] }, error: 'A.jsonl: ENOENT\nstack…' }), false, 0)).toEqual({ ok: false, reason: 'A.jsonl: ENOENT' })
  })
  test('a non-zero exit with a null error is refused with the code', () => {
    expect(checkEnvelope(env({ data: { files: [] }, error: null }), false, 3)).toEqual({ ok: false, reason: 'transcript reader exited 3' })
  })
  test('null data with a null error is "no data"', () => {
    expect(checkEnvelope(env({ data: null, error: null }), false, 0)).toEqual({ ok: false, reason: 'transcript reader returned no data' })
  })
  test('an empty error string is not an error', () => {
    expect(checkEnvelope(env({ data: { files: [] }, error: '' }), false, 0).ok).toBe(true)
  })
})

describe('FileCache: calls kept while size and mtime stay the same', () => {
  const rec = (rel: string, size: number, mtimeMs: number): FileRecord => ({ rel, size, mtimeMs, calls: [], skipped: 0 })
  test('get answers only an exact size and mtime; peek answers whatever was kept', () => {
    const c = new FileCache()
    c.set(rec('A.jsonl', 10, 100))
    expect(c.get('A.jsonl', 10, 100)).toBeDefined()
    expect(c.get('A.jsonl', 11, 100)).toBeUndefined() // grew
    expect(c.get('A.jsonl', 10, 101)).toBeUndefined() // touched
    expect(c.get('B.jsonl', 10, 100)).toBeUndefined()
    expect(c.peek('A.jsonl')?.size).toBe(10)
    expect(c.peek('B.jsonl')).toBeUndefined()
  })
  test('set replaces the file\'s record; clear forgets all', () => {
    const c = new FileCache()
    c.set(rec('A.jsonl', 10, 100))
    c.set(rec('A.jsonl', 20, 200))
    expect(c.get('A.jsonl', 10, 100)).toBeUndefined()
    expect(c.get('A.jsonl', 20, 200)).toBeDefined()
    c.clear()
    expect(c.peek('A.jsonl')).toBeUndefined()
  })
})

describe('mergeCalls: a resumed session repeats calls, which count once', () => {
  const f = (rel: string, ...calls: ReturnType<typeof call>[]): FileRecord => ({ rel, size: 1, mtimeMs: 1, calls, skipped: 0 })
  test('a call id repeated in a later file counts once, the first copy kept; calls without an id are all kept', () => {
    const a1 = call({ session: 'A', ms: at(10, 0), cr: 1, id: 'm1' })
    const dup = call({ session: 'A2', ms: at(10, 0), cr: 99, id: 'm1' })
    const noId1 = call({ session: 'A', ms: at(10, 1), cr: 2 })
    const noId2 = call({ session: 'A', ms: at(10, 1), cr: 2 })
    const out = mergeCalls([f('A.jsonl', a1, noId1), f('B.jsonl', dup, noId2)])
    expect(out).toEqual([a1, noId1, noId2])
  })
  test('no files, no calls', () => expect(mergeCalls([])).toEqual([]))
})

describe('batches, folderOf, sessionOfTranscript', () => {
  test('batches of at most n, in order; the default is the 80 that fit a Windows command line', () => {
    expect(READ_BATCH).toBe(80)
    expect(batches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(batches([], 2)).toEqual([])
    expect(batches(Array.from({ length: 161 }, (_, i) => i)).map(b => b.length)).toEqual([80, 80, 1])
  })
  test('folderOf: the folder of a path with / or \\, else null', () => {
    expect(folderOf('/home/u/.claude/projects/p/s-1.jsonl')).toBe('/home/u/.claude/projects/p')
    expect(folderOf('C:\\Users\\u\\p\\s-1.jsonl')).toBe('C:\\Users\\u\\p')
    for (const bad of [undefined, null, 3, '', 'nofolder.jsonl', '/x.jsonl']) expect(folderOf(bad)).toBeNull()
  })
  test('sessionOfTranscript: the file name without .jsonl, else null', () => {
    expect(sessionOfTranscript('/p/abc-123.jsonl')).toBe('abc-123')
    expect(sessionOfTranscript('C:\\p\\abc-123.jsonl')).toBe('abc-123')
    for (const bad of [undefined, 3, '/p/x.txt', '/p/.jsonl', '']) expect(sessionOfTranscript(bad)).toBeNull()
  })
})
