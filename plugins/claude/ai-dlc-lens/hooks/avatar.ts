// ai-dlc-lens: avatars (from spike ITEM-029 and the robot-avatar addendum of run AAW-20261023). Pure, no `$` here.
//
// An agent's avatar, by the `avatarStyle` setting:
//   robot (default)  its configured image when one draws, else its robot
//   image            its configured image when one draws, else its initials badge
//   initials         always its initials badge; images are not read
// The robot is inline Svg (no image file, no network): one of ROBOT_DESIGNS in one of ROBOT_COLORS,
// picked per agent type (ROBOT_TABLE for the ai-dlc agents, else robotOf's hash), so every agent of a
// type gets the same robot. The status colour is the ring around it; a running ring blinks.
// An image is `avatarImage.<agent>`: a data URI, or a file path inside a folder Claude Code trusts.

/** The longest Svg source a surface accepts; past it the whole tree is refused (spike 029, E2). */
export const SVG_CAP = 131072

export const AVATAR_STYLES = ['robot', 'image', 'initials'] as const
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const

/**
 * The key an agent's per-agent settings use (stories A21, AC-6.9): the agent ID for an ai-dlc agent
 * (`software-architect`), the whole agent type for any other (`my-plugin:my-agent`, `my-agent`), and
 * `main` for a main loop that runs no agent.
 */
export function avatarKey(type: string): string {
  if (!type) return 'main'
  // lens.ts pluginOf / roleOf, inlined: lens.ts imports this file.
  return type.startsWith('ai-dlc:') ? type.slice('ai-dlc:'.length) : type
}

// ---- robots ----

const DARK = '#263238'
const LIGHT = '#eceff1'

/** The robot body colours. */
export const ROBOT_COLORS = ['#1e88e5', '#43a047', '#8e24aa', '#f4511e', '#00897b', '#6d4c41', '#3949ab', '#c0ca33'] as const

/** The robot designs, each drawn in a 40 x 40 box with the body colour `c`. No `<circle>`: the chart's node is the only one. */
export const ROBOT_DESIGNS: readonly { name: string; draw: (c: string) => string }[] = [
  {
    name: 'boxy',
    draw: c =>
      `<path d="M20 4v6" stroke="${DARK}" stroke-width="2"/><ellipse cx="20" cy="4" rx="2.5" ry="2.5" fill="${c}"/>` +
      `<rect x="7" y="10" width="26" height="24" rx="4" fill="${c}"/>` +
      `<ellipse cx="14.5" cy="20" rx="3.5" ry="3.5" fill="${LIGHT}"/><ellipse cx="25.5" cy="20" rx="3.5" ry="3.5" fill="${LIGHT}"/>` +
      `<ellipse cx="14.5" cy="20" rx="1.5" ry="1.5" fill="${DARK}"/><ellipse cx="25.5" cy="20" rx="1.5" ry="1.5" fill="${DARK}"/>` +
      `<rect x="13" y="27" width="14" height="3" rx="1" fill="${DARK}"/>`,
  },
  {
    name: 'dome',
    draw: c =>
      `<rect x="3" y="20" width="4" height="8" rx="1" fill="${DARK}"/><rect x="33" y="20" width="4" height="8" rx="1" fill="${DARK}"/>` +
      `<path d="M6 34V20a14 14 0 0 1 28 0v14z" fill="${c}"/>` +
      `<rect x="10" y="17" width="20" height="7" rx="3.5" fill="${DARK}"/>` +
      `<rect x="13" y="19" width="5" height="3" rx="1.5" fill="#4dd0e1"/><rect x="22" y="19" width="5" height="3" rx="1.5" fill="#4dd0e1"/>` +
      `<path d="M14 29h12" stroke="${DARK}" stroke-width="2" stroke-linecap="round"/>`,
  },
  {
    name: 'cyclops',
    draw: c =>
      `<path d="M13 9L10 3M27 9l3-6" stroke="${DARK}" stroke-width="2" stroke-linecap="round"/>` +
      `<rect x="7" y="8" width="26" height="27" rx="9" fill="${c}"/>` +
      `<ellipse cx="20" cy="19" rx="7" ry="7" fill="${LIGHT}"/><ellipse cx="20" cy="19" rx="3" ry="3" fill="${DARK}"/>` +
      `<path d="M14 28q6 4 12 0" fill="none" stroke="${DARK}" stroke-width="2" stroke-linecap="round"/>`,
  },
  {
    name: 'screen',
    draw: c =>
      `<path d="M14 11L10 4M26 11l4-7" stroke="${DARK}" stroke-width="2" stroke-linecap="round"/>` +
      `<rect x="4" y="11" width="32" height="24" rx="3" fill="${c}"/><rect x="8" y="15" width="24" height="15" rx="2" fill="${DARK}"/>` +
      `<rect x="12" y="19" width="5" height="4" fill="#76ff03"/><rect x="23" y="19" width="5" height="4" fill="#76ff03"/>` +
      `<path d="M15 26h10" stroke="#76ff03" stroke-width="1.5"/>`,
  },
  {
    name: 'octagon',
    draw: c =>
      `<path d="M20 2l2 5h-4z" fill="${DARK}"/><path d="M14 7h12l7 7v12l-7 7H14l-7-7V14z" fill="${c}"/>` +
      `<rect x="12" y="15" width="6" height="6" rx="1" fill="${LIGHT}"/><rect x="22" y="15" width="6" height="6" rx="1" fill="${LIGHT}"/>` +
      `<path d="M13 27l3-2 2 2 2-2 2 2 2-2 3 2" fill="none" stroke="${DARK}" stroke-width="1.5"/>`,
  },
  {
    name: 'can',
    draw: c =>
      `<path d="M12 9a8 5 0 0 1 16 0z" fill="${DARK}"/><rect x="10" y="9" width="20" height="27" rx="3" fill="${c}"/>` +
      `<rect x="12" y="14" width="16" height="5" rx="2.5" fill="${LIGHT}"/>` +
      `<ellipse cx="16" cy="16.5" rx="1.5" ry="1.5" fill="${DARK}"/><ellipse cx="24" cy="16.5" rx="1.5" ry="1.5" fill="${DARK}"/>` +
      `<ellipse cx="15" cy="27" rx="1.2" ry="1.2" fill="${DARK}"/><ellipse cx="20" cy="27" rx="1.2" ry="1.2" fill="${DARK}"/><ellipse cx="25" cy="27" rx="1.2" ry="1.2" fill="${DARK}"/>`,
  },
]

export type Robot = { design: number; color: number }

/**
 * The ai-dlc agents' robots, fixed so that no two share one: agent i of this list gets design
 * i mod 6 and colour 3i mod 8, a pair no other i below 24 repeats.
 */
export const ROBOT_TABLE: Record<string, Robot> = Object.fromEntries(
  [
    'orchestrator',
    'product-owner',
    'product-manager',
    'requirement-analyst',
    'software-architect',
    'system-engineer',
    'software-engineer',
    'sqa-engineer',
    'code-reviewer',
    'brutal-critique',
    'devops-engineer',
    'documentation-writer',
    'research-assistant',
    'agent-manager',
    'presentation-manager',
    'main',
  ].map((id, i) => [id, { design: i % ROBOT_DESIGNS.length, color: (3 * i) % ROBOT_COLORS.length }]),
)

/** 32-bit FNV-1a of the text's UTF-16 code units: the stable hash behind robotOf. */
export function fnv1a(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/**
 * An agent's robot from its avatar key: ROBOT_TABLE's for an ai-dlc agent; for any other,
 * h = fnv1a(key), design h mod 6, colour (h >>> 8) mod 8. The same key always gets the same robot.
 */
export function robotOf(key: string): Robot {
  const fixed = own(ROBOT_TABLE, key)
  if (fixed) return fixed
  const h = fnv1a(key)
  return { design: h % ROBOT_DESIGNS.length, color: (h >>> 8) % ROBOT_COLORS.length }
}

/** `o[k]` for the object's own keys only: `constructor` or `toString` never reach Object.prototype. */
export const own = <T>(o: Readonly<Record<string, T>>, k: string): T | undefined => (Object.hasOwn(o, k) ? o[k] : undefined)

export const robotId = (r: Robot): string => `lens-robot-${r.design}-${r.color}`

/**
 * A robot drawn inline in a `d` x `d` box at (x, y): a group moved and scaled onto its 40 x 40 drawing,
 * its class naming the robot. Inline on purpose: no <symbol> or <use>, see lens.ts drawChart.
 */
export const robotInline = (r: Robot, x: number, y: number, d: number): string =>
  `<g class="${robotId(r)}" transform="translate(${x} ${y}) scale(${d / 40})">${ROBOT_DESIGNS[r.design]!.draw(ROBOT_COLORS[r.color]!)}</g>`

// ---- images ----

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** The first bytes of a base64 text (at most `n`); stops at the first character that is not base64. */
export function headBytes(base64: string, n = 16): number[] {
  const out: number[] = []
  let acc = 0
  let bits = 0
  for (const ch of base64) {
    const v = B64.indexOf(ch)
    if (v < 0) break
    acc = (acc << 6) | v
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out.push((acc >> bits) & 0xff)
      if (out.length >= n) break
    }
  }
  return out
}

/** The decoded size of standard padded base64. */
export function decodedBytes(base64: string): number {
  const s = base64.replace(/\s+/g, '')
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0
  return Math.floor((s.length * 3) / 4) - pad
}

/** The image type the bytes start as (magic bytes), or '' when none of IMAGE_TYPES. */
export function sniffType(base64: string): string {
  const b = headBytes(base64, 12)
  const is = (at: number, xs: number[]) => xs.every((x, i) => b[at + i] === x)
  if (is(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (is(0, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (is(0, [0x47, 0x49, 0x46, 0x38]) && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) return 'image/gif'
  if (is(0, [0x52, 0x49, 0x46, 0x46]) && is(8, [0x57, 0x45, 0x42, 0x50])) return 'image/webp'
  return ''
}

/** The allowed types from the `avatarImageTypes` setting (a comma-separated list). */
export const typesOf = (setting: string): string[] =>
  setting
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(t => t !== '')

export type AvatarSource = { kind: 'data'; mime: string; base64: string } | { kind: 'path'; path: string } | { kind: 'refused'; why: string }

/**
 * What an `avatarImage.<agent>` value is (AC-13.6): a `data:<type>;base64,` URI, a file path, or refused.
 * Any other scheme (`http:`, `https:`, `file:` ...) is refused and never fetched. A Windows drive
 * letter (`C:\`, `C:/`) is a path, not a scheme.
 */
export function classify(value: string): AvatarSource {
  const v = value.trim()
  if (v === '') return { kind: 'refused', why: 'empty' }
  const data = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(v)
  if (data) return { kind: 'data', mime: data[1]!.toLowerCase(), base64: data[2]! }
  if (/^data:/i.test(v)) return { kind: 'refused', why: 'a data URI that is not base64 image data' }
  if (/^[A-Za-z]:[\\/]/.test(v)) return { kind: 'path', path: v }
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(v)
  if (scheme) return { kind: 'refused', why: `a ${scheme[1]!.toLowerCase()}: URL; only a data URI or a file path is read` }
  if (v.includes('\0')) return { kind: 'refused', why: 'a path with a NUL character' }
  return { kind: 'path', path: v }
}

/** Image bytes checked against the allowed types and the size limit; `declared` is a data URI's own type. */
export function checkBytes(base64: string, declared: string | null, types: readonly string[], maxBytes: number): { mime: string; bytes: number } | { why: string } {
  const bytes = decodedBytes(base64)
  if (bytes > maxBytes) return { why: `${bytes} bytes, over avatarImageMaxBytes (${maxBytes})` }
  const mime = sniffType(base64)
  if (mime === '') return { why: 'not an image of a known type' }
  if (declared !== null && declared !== mime) return { why: `says ${declared} but is ${mime}` }
  if (!types.includes(mime)) return { why: `${mime} is not in avatarImageTypes (${types.join(', ')})` }
  return { mime, bytes }
}

// ---- trust (AC-13.3, 13.4, 13.9) ----

/** A path as trust compares it: `/` separators, no trailing slash; a Windows drive path in lower case. */
export function normPath(p: string): string {
  const s = p.replace(/\\/g, '/').replace(/\/+$/, '')
  return /^[A-Za-z]:(\/|$)/.test(s) ? s.toLowerCase() : s
}

/**
 * The folders Claude Code trusts, from the text of ~/.claude.json: each `projects` key whose entry
 * has `hasTrustDialogAccepted: true` (the rule auto-handoff's config.ts trustOf uses). Fails closed:
 * an unreadable or malformed file trusts nothing.
 */
export function trustedFolders(claudeJson: string | null): string[] {
  if (claudeJson === null) return []
  let doc: unknown
  try {
    doc = JSON.parse(claudeJson.replace(/^\uFEFF/, ''))
  } catch {
    return []
  }
  const projects = doc !== null && typeof doc === 'object' ? (doc as Record<string, unknown>).projects : undefined
  if (projects === null || typeof projects !== 'object' || Array.isArray(projects)) return []
  return Object.entries(projects as Record<string, unknown>)
    .filter(([, e]) => e !== null && typeof e === 'object' && (e as Record<string, unknown>).hasTrustDialogAccepted === true)
    .map(([k]) => k)
}

/** Whether a resolved real path lies inside one of the resolved trusted folders. */
export function isInside(realPath: string, realFolders: readonly string[]): boolean {
  const p = normPath(realPath)
  return realFolders.some(f => {
    const d = normPath(f)
    return d !== '' && (p === d || p.startsWith(d + '/'))
  })
}

// ---- drawing ----

/** A loaded image, ready to draw: a data URI, and its PNG bytes for the terminal when it came from a trusted file. */
export type AvatarImage = { uri: string; bytes: number; png: string | null }

/** What the chart needs to draw avatars: the style, and each agent's image (null: none, or refused). */
export type ChartAvatars = { style: string; image: (key: string) => AvatarImage | null }

export const NO_IMAGES: ChartAvatars = { style: 'robot', image: () => null }

/** An image avatar inline in a `d` x `d` box at (x, y): the `<image href="data:...">` form spike 029 checked. */
export const imageInline = (uri: string, x: number, y: number, d: number): string =>
  `<image href="${uri}" x="${x}" y="${y}" width="${d}" height="${d}" preserveAspectRatio="xMidYMid slice"/>`

/**
 * A small standalone avatar (panel headers): the robot, or the image when it fits under SVG_CAP;
 * null for the initials style or an `image` style agent with no image (its initials badge stands).
 */
export function avatarSvg(av: ChartAvatars, key: string, size = 22): string | null {
  const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40">`
  if (av.style === 'initials') return null
  const img = av.image(key)
  if (img) {
    const src = head + imageInline(img.uri, 0, 0, 40) + '</svg>'
    if (src.length <= SVG_CAP) return src
  }
  if (av.style === 'image') return null
  return head + robotInline(robotOf(key), 0, 0, 40) + '</svg>'
}
