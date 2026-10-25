// The lens side of the Cache Lab transcript reader (ITEM-069, cache-lab LLD section 4). Pure: no `$`.
// `cache-reader.mjs` reads the transcripts in a child process and prints one `{ data, error }` envelope;
// this file checks the envelope, caches each file's calls by (path, size, mtime) and merges them.

/** One API call, as the reader emits it (the transcript's ids, times, model and token counts only). */
export type Call = {
  id?: string
  session: string
  stream: string
  at: number
  model: string
  in: number
  out: number
  cr: number
  cc: number
  cc5m?: number
  cc1h?: number
  pid?: string
  turn?: number
  order: number
}
export type FileEntry = { rel: string; size: number; mtimeMs: number }
export type FileRecord = FileEntry & { calls: Call[]; skipped: number }
export type Envelope<T> = { data: T | null; error: string | null }
export type ListData = { files: FileEntry[] }
export type ReadData = { files: FileRecord[]; next?: number }

/** File names per `read` call: about 40 characters each keeps a Windows command line under 8,191. */
export const READ_BATCH = 80

const oneLine = (s: string) => s.split(/\r?\n/)[0]!.trim()

/** The envelope's data, or one line saying why there is none. A figure is shown whole or not at all. */
export function checkEnvelope<T>(stdout: string, isStdoutTruncated: boolean, exitCode: number): { ok: true; value: T } | { ok: false; reason: string } {
  if (isStdoutTruncated) return { ok: false, reason: 'transcript reader output truncated' }
  let env: unknown
  try {
    env = JSON.parse(stdout)
  } catch {
    return { ok: false, reason: exitCode === 0 ? 'transcript reader printed no envelope' : `transcript reader exited ${exitCode}` }
  }
  if (env === null || typeof env !== 'object' || !('data' in env) || !('error' in env)) return { ok: false, reason: 'transcript reader printed no envelope' }
  const e = env as Envelope<T>
  if (typeof e.error === 'string' && e.error !== '') return { ok: false, reason: oneLine(e.error) }
  if (exitCode !== 0) return { ok: false, reason: `transcript reader exited ${exitCode}` }
  if (e.data === null) return { ok: false, reason: 'transcript reader returned no data' }
  return { ok: true, value: e.data }
}

/** Each file's calls, kept while its size and mtime stay the same (module memory; gone with a module restart). */
export class FileCache {
  private m = new Map<string, FileRecord>()
  get(rel: string, size: number, mtimeMs: number): FileRecord | undefined {
    const f = this.m.get(rel)
    return f !== undefined && f.size === size && f.mtimeMs === mtimeMs ? f : undefined
  }
  /** The record kept for a file, whatever its size and mtime now. */
  peek(rel: string): FileRecord | undefined {
    return this.m.get(rel)
  }
  set(f: FileRecord): void {
    this.m.set(f.rel, f)
  }
  clear(): void {
    this.m.clear()
  }
}

/** Every call of the files, in the order given (oldest first); a call repeated in a later file (a resumed session) counts once. */
export function mergeCalls(files: readonly FileRecord[]): Call[] {
  const seen = new Set<string>()
  const out: Call[] = []
  for (const f of files)
    for (const c of f.calls) {
      if (c.id !== undefined) {
        if (seen.has(c.id)) continue
        seen.add(c.id)
      }
      out.push(c)
    }
  return out
}

/** The names in batches of at most `n`. */
export function batches<T>(xs: readonly T[], n = READ_BATCH): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n))
  return out
}

/** The folder of a transcript path (`\` or `/`), or null. */
export function folderOf(transcriptPath: unknown): string | null {
  if (typeof transcriptPath !== 'string' || transcriptPath === '') return null
  const i = Math.max(transcriptPath.lastIndexOf('/'), transcriptPath.lastIndexOf('\\'))
  return i <= 0 ? null : transcriptPath.slice(0, i)
}

/** The session id a transcript path names (its file name without `.jsonl`), or null. */
export function sessionOfTranscript(transcriptPath: unknown): string | null {
  if (typeof transcriptPath !== 'string') return null
  const i = Math.max(transcriptPath.lastIndexOf('/'), transcriptPath.lastIndexOf('\\'))
  const name = transcriptPath.slice(i + 1)
  return name.endsWith('.jsonl') && name.length > 6 ? name.slice(0, -6) : null
}
