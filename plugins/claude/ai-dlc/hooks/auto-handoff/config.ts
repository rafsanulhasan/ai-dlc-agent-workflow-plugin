// Settings from /config and the constants built on them. Engine-free: the host follows $ only
// into functions declared in register.tsx, so anything taking $ stays there.

export const BRIEF_DIR = '.claude/state/auto-handoff'
// Where this module sits inside the ai-dlc plugin; the shipped templates are under it.
export const MODULE_DIR = 'hooks/auto-handoff'
// The two numbers are userConfig fields (plugin.json), set in /config. Defaults match the manifest.
// thresholdPercent: the share of the context window that triggers a handoff, 1 to 100. It replaces
// upstream's token `threshold`, a new key so a stored 160000 is never read as a percent. The line in
// tokens is thresholdPercent of the window $.session.usage() reports (contextLine below).
// MIN_HEADROOM and maxUnattended are loop guards. A seeded session must grow MIN_HEADROOM past its
// first-turn size (its floor) before it can hand off again, and at most maxUnattended handoffs may
// run before the user types a prompt. MIN_HEADROOM is fixed: seeded sessions start near 45k, so at
// the default threshold it never moves the line; it only matters when the threshold is set low.
// 40k is the empirical line where a seeded session can read its brief and still do real work. The
// 2026-10-03 live run (threshold 20k, seeded sessions start at ~31k) chained six times with no
// guard; the 2026-10-04 run (AUTO_HANDOFF_TOKENS=80000 left in a shell, floor ~45k) chained eight
// times with a guard of a quarter of the threshold, because max(80k, 45k + 20k) is still 80k, and
// 35k of room goes in reading the brief. Progress, not time: a 15-minute chain cap could block a
// real session that fills fast.
// The rest shape the brief: two template files and a pattern for files
// that never count as edits.
// viewer: where the mod serves the brief pages, "host:port"; "tailscale" as the host means this
// machine's Tailscale IP, or 127.0.0.1 without Tailscale. Blank: no server, and the link is the local file.
export type Config = { thresholdPercent: number; maxUnattended: number; briefTemplate: string; instructionsTemplate: string; ignoreFiles?: RegExp; viewer: string }
export const DEFAULTS: Config = { thresholdPercent: 80, maxUnattended: 2, briefTemplate: '~/.claude/auto-handoff/brief.md', instructionsTemplate: '~/.claude/auto-handoff/instructions.md', viewer: '' }
export const MIN_HEADROOM = 40_000
// The window used when the host reports neither a window nor a percentage (human decision, 2026-10-21).
export const DEFAULT_WINDOW = 500_000
// Each template's default, a file in the mod's templates/ folder.
export const TEMPLATES = [['briefTemplate', 'brief.md'], ['instructionsTemplate', 'instructions.md']] as const
export type TemplateKey = typeof TEMPLATES[number][0]
// The sections Haiku writes when an AI-DLC run is active: the handoff skill's session handoff
// template. Shipped only, not a /config setting, so it stays the skill's template.
export const SESSION_TEMPLATE = 'session-handoff.md'
// Used only when the shipped default is unreadable too, so the fresh session still knows what to do.
export const LAST_RESORT_INSTRUCTIONS = '## Instructions\n\nThis turn was triggered by the system, not by a user. Read this brief and continue the work it describes.'

export const k = (n: number) => `${Math.round(n / 1000)}k`
export const short = (sessionId: string) => sessionId.slice(0, 8)
export const expand = (path: string, home: string) => path.replace(/^~(?=\/|$)/, home)

// A non-positive or non-numeric value falls back to the default rather than handing off at 0.
const num = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback
// A percentage: non-positive or non-numeric falls back to the default; the rest is clamped to 1..100.
const percent = (v: unknown, fallback: number) => Math.min(100, Math.max(1, num(v, fallback)))
const str = (v: unknown, fallback: string) => typeof v === 'string' && v.trim() ? v.trim() : fallback
// A bad pattern is dropped, not fatal: a typo in /config should not stop handoffs.
function pattern(v: unknown): RegExp | undefined {
  if (typeof v !== 'string' || !v.trim()) return undefined
  try { return new RegExp(v) } catch { return undefined }
}

/** The /config values, each checked, with the manifest's defaults for anything missing or bad. */
export function parseConfig(options: Record<string, unknown>): Config {
  return {
    thresholdPercent: percent(options.thresholdPercent, DEFAULTS.thresholdPercent),
    maxUnattended: num(options.maxConsecutiveHandoffs, DEFAULTS.maxUnattended),
    briefTemplate: str(options.briefTemplate, DEFAULTS.briefTemplate),
    instructionsTemplate: str(options.instructionsTemplate, DEFAULTS.instructionsTemplate),
    ignoreFiles: pattern(options.ignoreFiles),
    viewer: typeof options.viewer === 'string' ? options.viewer.trim() : DEFAULTS.viewer,
  }
}

/** The context window in tokens, from $.session.usage().context: its `window`, else derived from its
 * `percent` (0 to 100) and `tokens`, else undefined, and the caller uses DEFAULT_WINDOW. */
export function windowOf(context: { tokens?: number; window?: number; percent?: number }): number | undefined {
  if (typeof context.window === 'number' && context.window > 0) return context.window
  const { tokens, percent: pct } = context
  if (typeof tokens === 'number' && tokens > 0 && typeof pct === 'number' && pct > 0) return Math.round(tokens * 100 / pct)
  return undefined
}

/** The handoff line in tokens: thresholdPercent of the window, rounded down. */
export const contextLine = (thresholdPercent: number, window: number) => Math.floor(window * thresholdPercent / 100)

// The seed prompt's first characters; the render hook knows the seed row by them.
export const SEED_PREFIX = '[auto-handoff] ↪ Handoff from session'
// The seed text with its brief path and viewer URL as markdown links. The path becomes a
// file: link labelled by its file name; the URL links to itself. Exported for the test.
export function linkify(text: string): string {
  return text
    .replace(/(?<=\bat )(\/\S+\.md)(?=[\s)]|$)/, (p) => `[${p.slice(p.lastIndexOf('/') + 1)}](file://${p})`)
    .replace(/(https?:\/\/[^\s)]+)/, (u) => `[${u}](${u})`)
}
