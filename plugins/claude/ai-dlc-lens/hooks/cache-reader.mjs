// Cache Lab transcript reader (ITEM-069, cache-lab LLD section 3; ADR-0006).
//
// Run by the lens as a child process: `node cache-reader.mjs list|read --folder <dir> ...`. Plain JS with no
// dependencies, so it runs under any `node` without a build. It is the one place that knows the transcript
// format; it prints one JSON object, `{ data, error }`, and never prints transcript text: only ids,
// timestamps, model ids and token counts.
//
//   list --folder <dir> [--since <ms>]       <dir>/*.jsonl and <dir>/<session>/subagents/agent-*.jsonl, by mtime
//   read --folder <dir> --files <rel,...>    the calls of each named file, paged at PAGE_BYTES (data.next)

import { createReadStream, readdirSync, statSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/** A call writing more than this many cache tokens after the first call of its stream is a bust (cache-lab.ts keeps the same value). */
export const BUST_THRESHOLD = 10_000
/** The serialized output stops growing at this size (the host keeps the first 4 MiB of stdout). */
export const PAGE_BYTES = 3.5 * 1024 * 1024
/** Steps of the parentUuid walk from a bust to its user row. */
export const TURN_STEPS = 64

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

/** The promptId of the nearest user row above `row` on its parentUuid chain, or undefined (missing parent, cycle, too long). */
export function turnOf(rowsByUuid, row) {
  const seen = new Set()
  let cur = row
  for (let i = 0; i < TURN_STEPS; i++) {
    const up = cur?.parentUuid
    if (typeof up !== 'string' || seen.has(up)) return undefined
    seen.add(up)
    cur = rowsByUuid.get(up)
    if (cur === undefined) return undefined
    if (cur.type === 'user' && typeof cur.promptId === 'string') return cur.promptId
  }
  return undefined
}

/** The session id and stream of a file, from its path relative to the folder (`/` separators). */
export function fileIds(rel) {
  const parts = rel.split('/')
  const session = parts[0].replace(/\.jsonl$/, '')
  const m = parts.length >= 3 && parts[1] === 'subagents' ? /^agent-(.+)\.jsonl$/.exec(parts[parts.length - 1]) : null
  return { session, stream: m ? `agent:${m[1]}` : 'main' }
}

/** A parser for one file: feed it lines, then `end()` gives `{ calls, skipped }`. Pure. */
export function createParser(rel) {
  const ids = fileIds(rel)
  const calls = []
  const byId = new Map()
  const links = new Map() // uuid -> { type, parentUuid, promptId }
  const prompts = []
  const promptSeen = new Set()
  const pending = [] // [call, row] of bust candidates
  let skipped = 0
  let pos = 0
  return {
    line(text) {
      if (text.trim() === '') return
      let row
      try {
        row = JSON.parse(text)
      } catch {
        skipped++
        return
      }
      if (row === null || typeof row !== 'object') return
      const order = pos++
      if (typeof row.uuid === 'string') links.set(row.uuid, { type: row.type, parentUuid: row.parentUuid, promptId: row.promptId })
      if (row.type === 'user' && typeof row.promptId === 'string' && !promptSeen.has(row.promptId)) {
        promptSeen.add(row.promptId)
        prompts.push(row.promptId)
      }
      if (row.type !== 'assistant') return
      const m = row.message
      const u = m?.usage
      if (u === null || typeof u !== 'object' || num(u.output_tokens) === undefined) return
      const at = Date.parse(row.timestamp)
      if (!Number.isFinite(at)) return
      if (m.model === '<synthetic>') return
      const c5 = num(u.cache_creation?.ephemeral_5m_input_tokens)
      const c1 = num(u.cache_creation?.ephemeral_1h_input_tokens)
      const split = c5 !== undefined && c1 !== undefined
      const call = {
        session: typeof row.sessionId === 'string' ? row.sessionId : ids.session,
        stream: ids.stream !== 'main' ? ids.stream : row.isSidechain === true ? `agent:${typeof row.agentId === 'string' ? row.agentId : 'unknown'}` : 'main',
        at,
        model: typeof m.model === 'string' ? m.model : '',
        in: num(u.input_tokens) ?? 0,
        out: u.output_tokens,
        cr: num(u.cache_read_input_tokens) ?? 0,
        cc: num(u.cache_creation_input_tokens) ?? (split ? c5 + c1 : 0),
        order,
      }
      if (split) {
        call.cc5m = c5
        call.cc1h = c1
      }
      if (typeof m.id === 'string') {
        call.id = m.id
        // One response is several rows (one per content block): the last row of an id wins.
        const at0 = byId.get(m.id)
        if (at0 !== undefined) {
          calls[at0] = call
          const p = pending.findIndex(x => x[0].id === m.id)
          if (p >= 0) pending.splice(p, 1)
        } else {
          byId.set(m.id, calls.length)
          calls.push(call)
        }
      } else calls.push(call)
      if (call.cc > BUST_THRESHOLD) pending.push([call, { parentUuid: row.parentUuid }])
    },
    end() {
      for (const [call, row] of pending) {
        const pid = turnOf(links, row)
        if (pid !== undefined) {
          call.pid = pid
          call.turn = prompts.indexOf(pid) + 1
        }
      }
      return { calls, skipped }
    },
  }
}

/** Every call of a file's lines (an array or any iterable of strings). Pure. */
export function parseTranscript(lines, rel) {
  const p = createParser(rel)
  for (const l of lines) p.line(l)
  return p.end()
}

// ---- the CLI ----

function args(argv) {
  const o = { mode: argv[0] }
  for (let i = 1; i < argv.length; i += 2) o[String(argv[i]).replace(/^--/, '')] = argv[i + 1]
  return o
}

function listFiles(folder, since) {
  const out = []
  const add = rel => {
    const st = statSync(join(folder, ...rel.split('/')))
    if (st.isFile() && (since === undefined || st.mtimeMs >= since)) out.push({ rel, size: st.size, mtimeMs: st.mtimeMs })
  }
  for (const e of readdirSync(folder, { withFileTypes: true })) {
    if (e.isFile() && e.name.endsWith('.jsonl')) add(e.name)
    else if (e.isDirectory()) {
      let subs = []
      try {
        subs = readdirSync(join(folder, e.name, 'subagents'), { withFileTypes: true })
      } catch {
        continue
      }
      for (const s of subs) if (s.isFile() && /^agent-.+\.jsonl$/.test(s.name)) add(`${e.name}/subagents/${s.name}`)
    }
  }
  return out
}

async function readFile(folder, rel) {
  const path = resolve(folder, ...rel.split('/'))
  if (rel.includes('..') || !path.startsWith(resolve(folder) + sep)) throw new Error(`${rel}: outside the folder`)
  const st = statSync(path)
  const p = createParser(rel)
  const rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity })
  for await (const l of rl) p.line(l)
  return { rel, size: st.size, mtimeMs: st.mtimeMs, ...p.end() }
}

async function main(argv) {
  const a = args(argv)
  if (typeof a.folder !== 'string' || a.folder === '') return { data: null, error: '--folder missing' }
  if (a.mode === 'list') {
    const since = a.since === undefined ? undefined : Number(a.since)
    try {
      return { data: { files: listFiles(a.folder, Number.isFinite(since) ? since : undefined) }, error: null }
    } catch (err) {
      return { data: null, error: `${a.folder}: ${err?.code ?? String(err)}` }
    }
  }
  if (a.mode === 'read') {
    const names = String(a.files ?? '').split(',').filter(n => n !== '')
    const files = []
    let bytes = 0
    for (let i = 0; i < names.length; i++) {
      let f
      try {
        f = await readFile(a.folder, names[i])
      } catch (err) {
        return { data: null, error: err?.code ? `${names[i]}: ${err.code}` : String(err?.message ?? err) }
      }
      const size = JSON.stringify(f).length
      if (size > PAGE_BYTES && files.length === 0) return { data: null, error: `${names[i]}: too many calls for one page` }
      if (bytes + size > PAGE_BYTES) return { data: { files, next: i }, error: null }
      bytes += size
      files.push(f)
    }
    return { data: { files }, error: null }
  }
  return { data: null, error: `unknown mode: ${a.mode ?? '(none)'}` }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    r => {
      process.stdout.write(JSON.stringify(r))
      process.exitCode = r.error === null ? 0 : 1
    },
    err => {
      process.stdout.write(JSON.stringify({ data: null, error: String(err?.message ?? err).split('\n')[0] }))
      process.exitCode = 1
    },
  )
}
