// Transcript fixtures for the Cache Lab reader (cache-lab stories, fixture F1; LLD 11): one table of calls
// that emits JSONL rows, so the numbers the pure tests (plugins/claude/ai-dlc-lens/tests/fixtures/cache-lab.ts)
// and these reader tests use cannot drift apart. Times are UTC, 2026-10-25.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const at = (hh, mm, day = 25, month = 10) => Date.UTC(2026, month - 1, day, hh, mm)
const iso = ms => new Date(ms).toISOString()

/** F1's calls: [name, session, ms, model, in, out, cr, cc5m, cc1h, ccNoSplit, note]. */
export const F1 = [
  ['A1', 'A', at(10, 0), 'm', 100, 100, 0, 20000, 0, undefined],
  ['A2', 'A', at(10, 2), 'm', 100, 100, 20000, 500, 0, undefined],
  ['A3', 'A', at(10, 10), 'm', 100, 100, 15000, 20600, 0, undefined],
  ['A4', 'A', at(10, 12), 'm', 100, 100, 5000, 15700, 0, undefined],
  ['A5', 'A', at(10, 13), 'n', 100, 100, 0, 0, 12000, undefined],
  ['A6', 'A', at(10, 14), 'm', 100, 100, 12000, undefined, undefined, 3000],
  ['B0', 'B', at(10, 59), 'm', 50, 50, 0, 4000, 0, undefined, 'sidechain'],
  ['B1', 'B', at(11, 0), 'm', 50, 50, 0, 10000, 0, undefined],
  ['C1', 'C', at(12, 0), 'm', 0, 0, 0, 60000, 0, undefined],
]

/** One assistant row. `split` false: no cache_creation object, only the total. */
export function assistant({ session, ms, model = 'fixture-model-m', id, uuid, parentUuid, inTok = 0, out = 1, cr = 0, cc5m, cc1h, cc, sidechain, agentId }) {
  const usage = { input_tokens: inTok, output_tokens: out, cache_read_input_tokens: cr }
  if (cc5m !== undefined && cc1h !== undefined) {
    usage.cache_creation = { ephemeral_5m_input_tokens: cc5m, ephemeral_1h_input_tokens: cc1h }
    usage.cache_creation_input_tokens = cc ?? cc5m + cc1h
  } else if (cc !== undefined) usage.cache_creation_input_tokens = cc
  return JSON.stringify({
    type: 'assistant',
    sessionId: session,
    timestamp: iso(ms),
    ...(uuid ? { uuid } : {}),
    ...(parentUuid ? { parentUuid } : {}),
    ...(sidechain ? { isSidechain: true } : {}),
    ...(agentId ? { agentId } : {}),
    message: { ...(id ? { id } : {}), model, role: 'assistant', content: [{ type: 'text', text: 'SECRET-REPLY-TEXT' }], usage },
  })
}

export const user = ({ uuid, parentUuid, promptId, session = 'A', ms = at(9, 0) }) =>
  JSON.stringify({ type: 'user', sessionId: session, timestamp: iso(ms), uuid, ...(parentUuid ? { parentUuid } : {}), ...(promptId ? { promptId } : {}), message: { role: 'user', content: 'SECRET-PROMPT-TEXT' } })

/** The F1 calls of one session as JSONL rows, in order. */
export function f1Lines(session) {
  return F1.filter(c => c[1] === session).map(([name, s, ms, m, inTok, out, cr, cc5m, cc1h, cc]) =>
    assistant({ session: s, ms, model: `fixture-model-${m}`, id: `msg_${name}`, inTok, out, cr, cc5m, cc1h, cc, sidechain: name === 'B0' }))
}

/** A folder in the OS temp dir with the F1 transcripts: A.jsonl, B.jsonl, C.jsonl. Returns its path. */
export function f1Folder() {
  const dir = mkdtempSync(join(tmpdir(), 'cache-reader-'))
  for (const s of ['A', 'B', 'C']) writeFileSync(join(dir, `${s}.jsonl`), f1Lines(s).join('\n') + '\n')
  return dir
}

export function writeFile(dir, rel, lines) {
  const path = join(dir, ...rel.split('/'))
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, Array.isArray(lines) ? lines.join('\n') + '\n' : lines)
  return path
}
