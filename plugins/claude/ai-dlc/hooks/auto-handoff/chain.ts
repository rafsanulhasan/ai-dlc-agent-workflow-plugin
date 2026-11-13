// The automatic handoff chain a session belongs to (keep-alive LLD rev 10, section 19.1): one file both
// modules import, so keep-alive (../keepalive/keepalive.ts) never imports register.tsx. A chain is
// read from the lineage records the seed step writes (`lineage:<session id>` in $.store, register.tsx):
// a session with none, a session started by hand, is a chain of one, its own id.
import type { EngineInterface } from 'claude-code'

/** At most this many steps up a chain; a longer one (or a cycle) stops there. */
export const CHAIN_MAX = 50

type LineageRecord = { from?: unknown; chain?: unknown }

/** This session's chain id: `lineage:<id>.chain`, else its own id. A read that throws gives its own id
 * with `failed` and one debug-log line (the chain restarts; the numbering spec, D3). */
export async function chainIdOf($: EngineInterface): Promise<{ id: string; failed?: true }> {
  const own = await $.session.id()
  try {
    const v = await $.store.get(`lineage:${own}`) as LineageRecord | undefined
    return { id: v && typeof v === 'object' && typeof v.chain === 'string' && v.chain ? v.chain : own }
  } catch (err) {
    try {
      $.ui.log(`chain: lineage of ${own} not read (${err instanceof Error ? err.message : String(err)}); the session is its own chain`, { to: 'debug' })
    } catch {}
    return { id: own, failed: true }
  }
}

/** The session ids of this session's chain, newest first: itself, then each `lineage:<id>.from` up the
 * chain, at most CHAIN_MAX steps; a cycle or a read that fails stops the walk. */
export async function chainSessions($: EngineInterface): Promise<string[]> {
  const out = [await $.session.id()]
  const seen = new Set(out)
  for (let i = 0; i < CHAIN_MAX; i++) {
    let v: LineageRecord | undefined
    try {
      v = await $.store.get(`lineage:${out.at(-1)}`) as LineageRecord | undefined
    } catch {
      break
    }
    const from = v && typeof v === 'object' && typeof v.from === 'string' ? v.from : undefined
    if (!from || seen.has(from)) break
    seen.add(from)
    out.push(from)
  }
  return out
}
