// The module's file, git, trust and log helpers, shared by register.tsx and keepalive/keepalive.ts.
// The engine is passed in as `$` and only ever called as $.noun.event(...), which is what `claude
// plugin validate` follows. HOME and USERPROFILE are the only environment variables read here.
import type { EngineInterface } from 'claude-code'
import { BRIEF_DIR, trustOf, trustRoot, withoutKeys } from './config.ts'
import type { TrustTarget } from './config.ts'

// Windows sets USERPROFILE, not HOME. With HOME unset, every path built on it began with
// "undefined/", which $.fs resolves under the session's working directory: briefs, templates
// and pages landed inside the user's project.
export async function homeDir($: EngineInterface): Promise<string | undefined> {
  return (await $.env.get('HOME')) || (await $.env.get('USERPROFILE'))
}

export async function log($: EngineInterface, line: string) {
  try {
    const path = `${await homeDir($)}/${BRIEF_DIR}/auto-handoff.log`
    const stamped = `${new Date().toISOString()} ${line}`
    // Where there is a `sh`, append: an append is atomic, so concurrent sessions and the viewer
    // server (which appends its own output here) never drop each other's lines.
    try {
      const { exitCode } = await $.process.run(['sh', '-c', 'mkdir -p "$(dirname "$2")" && printf "%s\\n" "$1" >> "$2"', 'sh', stamped, path])
      if (exitCode === 0) return
    } catch {}
    // Windows has no `sh`. $.fs has no append, so the log is read and rewritten: two lines logged
    // at the same instant can lose one. It keeps the last ~500 KB, cut at a line, so a read never
    // hits $.fs's 4 MiB cap.
    const old = await $.fs.read(path).catch(() => '')
    const kept = typeof old !== 'string' ? '' : old.length > 1_000_000 ? old.slice(old.indexOf('\n', old.length - 500_000) + 1) : old
    await $.fs.write(path, `${kept}${stamped}\n`)
  } catch {}
}

export async function readText($: EngineInterface, path: string): Promise<string | undefined> {
  try {
    const text = await $.fs.read(path)
    if (typeof text === 'string' && text.trim()) return text
  } catch {}
  return undefined
}
// A file's text as it is, blank included; undefined when it cannot be read.
export async function readRaw($: EngineInterface, path: string): Promise<string | undefined> {
  try {
    const text = await $.fs.read(path)
    return typeof text === 'string' ? text : undefined
  } catch {
    return undefined
  }
}

// The repository root (git), else the session's working directory.
export async function repoRoot($: EngineInterface): Promise<string> {
  const cwd = (await $.session.cwd()).replace(/\\/g, '/')
  return await git($, ['-C', cwd, 'rev-parse', '--show-toplevel']) ?? cwd
}

// Whether Claude Code trusts this folder (config.ts, trustOf). Also keep-alive's check for its own
// repository file (keepalive/keepalive.ts).
export async function folderTrust($: EngineInterface): Promise<{ trusted: boolean; why: string }> {
  const home = await homeDir($)
  return trustOf(home ? await readRaw($, `${home}/.claude.json`) : undefined, await trustTarget($))
}

/** One load's answer from folderTrust, kept so a load that gates several sources reads ~/.claude.json once. */
export type TrustCache = { result?: Promise<{ trusted: boolean; why: string }> }

// A level read from a file a cloned repository controls (a repository file, the env of the committed
// .claude/settings.json), without the given keys unless Claude Code trusts this folder. ~/.claude.json
// is read only when one of the keys is set, and only its trust flag is used: nothing else from it is
// logged or kept. Each skipped key is named in one line added to `problems`, with `where` and
// `instead` (where to set them instead). Fails closed. Shared by the automatic handoff and keep-alive.
export async function trustGate($: EngineInterface, values: Record<string, unknown>, keys: readonly string[], where: string, instead: string, problems: string[], cache: TrustCache = {}): Promise<Record<string, unknown>> {
  const gated = withoutKeys(values, keys)
  if (!gated.ignored.length) return values
  cache.result ??= folderTrust($)
  const { trusted, why } = await cache.result
  if (trusted) return values
  problems.push(`${gated.ignored.join(', ')} in ${where} ignored: Claude Code does not trust this folder (${why}); ${instead}`)
  return gated.values
}

// What trust is keyed on (config.ts, TrustTarget): the repository root, or in a linked worktree the
// main checkout's root; outside a repository, the session's working directory.
export async function trustTarget($: EngineInterface): Promise<TrustTarget> {
  const cwd = (await $.session.cwd()).replace(/\\/g, '/')
  const top = await git($, ['-C', cwd, 'rev-parse', '--show-toplevel'])
  if (!top) return { start: cwd }
  return { root: trustRoot(top, await git($, ['-C', cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir'])) }
}

// git, run through -C in the given directory. Undefined when git is missing, the directory is not
// a repository, or the command prints nothing.
export async function git($: EngineInterface, args: string[]): Promise<string | undefined> {
  try {
    const { exitCode, stdout } = await $.process.run(['git', ...args])
    const out = stdout.trim()
    return exitCode === 0 && out ? out : undefined
  } catch {
    return undefined
  }
}
