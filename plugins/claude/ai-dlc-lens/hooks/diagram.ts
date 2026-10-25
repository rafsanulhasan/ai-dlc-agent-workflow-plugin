// The diagramming submodule's pure core (diagramming LLD section 2, ITEM-053.b): it finds the diagram
// fences in an assistant message, cleans their source, checks the renderer's output, and lays the parts
// out. No engine type: register.tsx's registerDiagram (ITEM-053.c) is the one shell with $; the
// renderer is ../renderer/render.mjs, a child process. Sprint 1 draws Mermaid only; the math and
// PlantUML kinds are found but drawn as their source (sprint 2, ITEM-054 and 055).
import { SVG_CAP } from './avatar'

export type FenceKind = 'mermaid' | 'math' | 'texDiagram' | 'plantuml'
/** A diagram fence: its kind, its body (`source`, without the delimiters), whether it is closed in this
 * text, its offsets in the text (`start` to `end`, delimiters included) and the info string as written. */
export type Fence = { kind: FenceKind; source: string; closed: boolean; start: number; end: number; tag: string }
export type Segment = { text: string } | { fence: Fence }

/** math or texDiagram for a `latex`, `tex`, `tikz` or `math` fence (LLD 2.1, rule 2). */
export function texKind(tag: string, body: string): 'math' | 'texDiagram' {
  const t = tag.toLowerCase()
  if (t === 'tikz') return 'texDiagram'
  if (t === 'math') return 'math'
  return ['\\documentclass', '\\usepackage', '\\begin{document}', '\\begin{tikzpicture}'].some(m => body.includes(m)) ? 'texDiagram' : 'math'
}

// The kind of a fenced block's info string; undefined for any other tag (plain text).
function kindOfTag(tag: string, body: string): FenceKind | undefined {
  switch (tag) {
    case 'mermaid': return 'mermaid'
    case 'math': return 'math'
    case 'latex': case 'tex': case 'tikz': return texKind(tag, body)
    case 'plantuml': case 'puml': return 'plantuml'
    default: return undefined
  }
}

const OPEN = /^( {0,3})(`{3,}|~{3,})\s*([A-Za-z0-9_+-]*)/

/** D2. Splits one block's text into text and fence segments, in order (LLD 2.1). */
export function findFences(text: string): Segment[] {
  const out: Segment[] = []
  let textFrom = 0
  const pushText = (to: number) => { if (to > textFrom) out.push({ text: text.slice(textFrom, to) }) }
  // Line starts
  const starts: number[] = [0]
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1)
  const lineAt = (n: number) => { const s = starts[n]!; const e = n + 1 < starts.length ? starts[n + 1]! - 1 : text.length; return text.slice(s, e).replace(/\r$/, '') }
  let n = 0
  while (n < starts.length) {
    const line = lineAt(n)
    const open = OPEN.exec(line)
    if (open) {
      const ch = open[2]![0]!
      const len = open[2]!.length
      const tag = open[3]!.toLowerCase()
      const close = new RegExp(`^ {0,3}${ch === '`' ? '`' : '~'}{${len},}\\s*$`)
      let m = n + 1
      while (m < starts.length && !close.test(lineAt(m))) m++
      const closed = m < starts.length
      const bodyFrom = n + 1 < starts.length ? starts[n + 1]! : text.length
      const bodyTo = closed ? starts[m]! : text.length
      const body = text.slice(bodyFrom, bodyTo).replace(/\r?\n$/, '')
      const end = closed ? (m + 1 < starts.length ? starts[m + 1]! - 1 : text.length) : text.length
      const kind = kindOfTag(tag, body)
      if (kind) {
        pushText(starts[n]!)
        out.push({ fence: { kind, source: body, closed, start: starts[n]!, end, tag } })
        textFrom = end
      }
      // A fence of another tag is text, and its body is not scanned for display math
      n = closed ? m + 1 : starts.length
      continue
    }
    // Display math outside fences: $$ ... $$ and \[ ... \] (single $...$ is never a fence)
    const mathOpen = /^\s*(\$\$|\\\[)/.exec(line)
    if (mathOpen) {
      const delim = mathOpen[1] === '$$' ? '$$' : '\\]'
      const from = starts[n]! + line.indexOf(mathOpen[1]!)
      const after = from + mathOpen[1]!.length
      const closeAt = text.indexOf(delim, after)
      const closed = closeAt >= 0
      const body = text.slice(after, closed ? closeAt : text.length).trim()
      if (body) {
        const end = closed ? closeAt + delim.length : text.length
        pushText(from)
        out.push({ fence: { kind: 'math', source: body, closed, start: from, end, tag: mathOpen[1]! } })
        textFrom = end
        // Continue on the line after the closing delimiter
        let next = n + 1
        while (next < starts.length && starts[next]! <= end) next++
        n = closed ? next : starts.length
        continue
      }
    }
    n++
  }
  pushText(text.length)
  return out
}

// ---- cleaning (spec D5)

const MERMAID_REMOVED: readonly RegExp[] = [
  /^[ \t]*click[ \t]+\S+[ \t]+href[ \t]+"[^"]*".*(?:\r?\n|$)/gim,          // click <id> href "<url>"
  /^[ \t]*click[ \t]+\S+[ \t]+"[^"]*".*(?:\r?\n|$)/gim,                    // click <id> "<url>"
  /<img\b[^>]*\bsrc\s*=\s*["'][^"']*["'][^>]*>/gi,                        // <img src="..."> in a label
  /!\[[^\]]*\]\([^)]*\)/g,                                                // ![alt](url) in a label
]

/** D5. The source with its remote references removed, and how many were. Sprint 1 cleans Mermaid; the
 * PlantUML and math rows are sprint 2 (ITEM-054, 055), so their source is returned as it is. */
export function sanitiseSource(kind: FenceKind, source: string): { source: string; removed: number } {
  if (kind !== 'mermaid') return { source, removed: 0 }
  let removed = 0
  let out = source
  for (const re of MERMAID_REMOVED) out = out.replace(re, () => (removed++, ''))
  return { source: out, removed }
}

/** The Mermaid kinds drawn offline (spec D3; the five of AC-20.1.5 are the floor). */
export const MERMAID_KINDS: readonly string[] = ['flowchart', 'graph', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'stateDiagram-v2', 'erDiagram', 'xychart-beta']

/** The first keyword of a Mermaid source that is not a comment (`%%`) or front matter; '' when none. */
export function mermaidKind(source: string): string {
  let inFront = false
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '---') { inFront = !inFront; continue }
    if (inFront || !line || line.startsWith('%%')) continue
    return /^[A-Za-z][A-Za-z0-9-]*/.exec(line)?.[0] ?? ''
  }
  return ''
}

export const isSupportedMermaid = (source: string) => MERMAID_KINDS.includes(mermaidKind(source))

// ---- the Svg path's strip (the same rule table as ../renderer/scrub.mjs)

const DROPPED = ['script', 'foreignObject', 'iframe', 'object', 'embed']
// A URL that may stay: a fragment or a data: URI.
const local = (v: string) => /^\s*['"]?\s*(#|data:)/i.test(v)
// The value as a browser reads it: numeric character references and &colon; decoded.
const decode = (v: string) => v
  .replace(/&#x([0-9a-f]+);?/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);?/g, (_, d: string) => String.fromCodePoint(Number(d)))
  .replace(/&colon;/gi, ':')
// A script scheme anywhere in the value, ignoring the whitespace and control characters browsers skip.
const scripted = (v: string) => /javascript:/i.test(v.replace(/[\u0000- ]/g, ''))
// Every url() target in the value is a fragment or a data: URI.
const urlsLocal = (v: string) => [...v.matchAll(/url\(([^)]*)\)/gi)].every(m => local(m[1]))

// CSS: every @import at-rule, every declaration with a CSS escape (it can hide a url()), and every
// declaration whose url() is not local, removed whole.
const scrubCss = (css: string) => css
  .replace(/@import\b[^;]*;?/gi, '')
  .replace(/[^;{}]*\\[^;{}]*;?/g, '')
  .replace(/[A-Za-z-]+\s*:[^;{}]*url\(([^)]*)\)[^;{}]*;?/gi, (d, target: string) => (local(target) ? d : ''))

// One attribute, its value as written (double-quoted, single-quoted, unquoted or none): null when it
// goes, else name="value".
function scrubAttr(name: string, raw: string | undefined): string | null {
  const n = name.toLowerCase()
  if (/(^|:)on/.test(n)) return null
  if (raw === undefined) return name
  const v = /^(["']).*\1$/s.test(raw) ? raw.slice(1, -1) : raw
  const d = decode(v)
  if (scripted(d)) return null
  let kept = v
  if (n === 'href' || n === 'src' || n.endsWith(':href')) {
    if (!local(d)) return null
  } else if (n === 'style') {
    // Checked as decoded; a value with character references keeps its text only when nothing was removed
    const css = scrubCss(d)
    if (css !== d && v !== d) return null
    kept = v === d ? css : v
  } else if (!urlsLocal(d)) return null
  if (kept.includes('"') && kept.includes("'")) return null
  return `${name}=${kept.includes('"') ? `'${kept}'` : `"${kept}"`}`
}

// An attribute: a name, then optionally = and a double-quoted, single-quoted or unquoted value. `/` and
// whitespace both separate attributes, so `<svg/onload=...>` is read the way a browser reads it.
const ATTR = /([^\s"'=/>]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g

// Every start tag rebuilt from the attributes that stay, so what a browser parses is what was checked;
// a tag never closed drops the rest of the text.
function scrubTags(svg: string): string {
  const open = /<([A-Za-z][\w:.-]*)/g
  let out = ''
  let at = 0
  let m: RegExpExecArray | null
  while ((m = open.exec(svg))) {
    let j = m.index + m[0].length
    let quote = ''
    for (; j < svg.length; j++) {
      const c = svg[j]
      if (quote) { if (c === quote) quote = '' } else if (c === '"' || c === "'") quote = c
      else if (c === '>') break
    }
    out += svg.slice(at, m.index)
    if (j >= svg.length) return out
    const attrs = svg.slice(m.index + m[0].length, j)
    const kept: string[] = []
    for (const a of attrs.matchAll(ATTR)) {
      const s = scrubAttr(a[1], a[2])
      if (s !== null) kept.push(s)
    }
    out += `<${m[1]}${kept.map(s => ` ${s}`).join('')}${/\/\s*$/.test(attrs) ? '/' : ''}>`
    at = j + 1
    open.lastIndex = at
  }
  return out + svg.slice(at)
}

/** D5 output filter, the Svg path only: drops script-like elements, event handlers, javascript: values,
 * links that are not a fragment or a data: URI, every CSS @import and every declaration with a remote url().
 * Attribute values are read double-quoted, single-quoted or unquoted. */
export function scrubSvg(svg: string): string {
  let out = svg
  for (const tag of DROPPED) {
    out = out.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '')
    out = out.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), '')
  }
  out = out.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (_, o: string, css: string, c: string) => `${o}${scrubCss(css)}${c}`)
  return scrubTags(out)
}

// ---- caps and reasons

export { SVG_CAP }
export const PNG_CAP = 2 * 1024 * 1024

export type ReasonCode = 'svgCap' | 'pngCap' | 'syntax' | 'noNode' | 'noRaster' | 'noFont' | 'unsupportedMermaid' | 'rendering' | 'failed' | 'noSurface'

/** The picture fits: an SVG of at most SVG_CAP characters, a PNG of at most PNG_CAP decoded bytes. */
export function fitCaps(format: 'svg' | 'png', body: string, bytes: number): { ok: true } | { ok: false; reason: string } {
  if (format === 'svg' && body.length > SVG_CAP) return { ok: false, reason: reasonFor('svgCap') }
  if (format === 'png' && bytes > PNG_CAP) return { ok: false, reason: reasonFor('pngCap') }
  return { ok: true }
}

const REASON_MAX = 120
const cut = (s: string) => (s.length > REASON_MAX ? `${s.slice(0, REASON_MAX - 1)}…` : s)

/** One reason line, at most 120 characters (LLD 2.2's table). */
export function reasonFor(code: ReasonCode, detail?: string): string {
  const d = (detail ?? '').split(/\r?\n/)[0]!.trim()
  switch (code) {
    case 'svgCap': return `diagram too large to draw (over ${SVG_CAP} characters)`
    case 'pngCap': return 'diagram too large to draw (over 2 MiB)'
    case 'syntax': return cut(`diagram not drawn: ${d || 'syntax error'}`)
    case 'noNode': return 'diagram renderer needs node on PATH'
    case 'noRaster': return 'no PNG rasteriser for this platform'
    case 'noFont': return 'diagram text could not be rendered (no font)'
    case 'unsupportedMermaid': return cut(`mermaid diagram type "${d}" is not supported offline`)
    case 'rendering': return 'rendering…'
    case 'failed': return 'diagram not drawn: renderer failed'
    case 'noSurface': return 'this surface draws neither images nor SVG'
  }
}

/** The note under a picture whose source lost remote references. */
export const removedNote = (n: number) => `removed ${n} remote reference(s)`

/** The reason code of a renderer envelope's error (LLD 4.1). */
export const errorCode = (error: string): ReasonCode =>
  error === 'no font' ? 'noFont' : error.startsWith('no PNG rasteriser') ? 'noRaster' : error.startsWith('renderer failed') ? 'failed' : 'syntax'

// ---- placement (G2 resolved OQ1: the picture goes right after its fence)

export type Picture = { format: 'svg' | 'png'; body: string; width: number; height: number }
export type Outcome = { picture: Picture; removed?: number } | { reason: string }
export type Part = { md: string } | { source: Fence } | { picture: Fence; image: Picture; removed: number } | { reason: string }

/** The parts in order: each text segment as markdown; a closed fence that `outcome` answers (an enabled
 * kind) as its source, then its picture (and the removed note's count) or its reason; any other fence
 * (open, disabled, a deferred kind: `outcome` gives undefined) as its source only. */
export function layoutParts(segs: readonly Segment[], outcome: (f: Fence) => Outcome | undefined): Part[] {
  const parts: Part[] = []
  for (const s of segs) {
    if ('text' in s) { parts.push({ md: s.text }); continue }
    const f = s.fence
    parts.push({ source: f })
    if (!f.closed) continue
    const o = outcome(f)
    if (!o) continue
    parts.push('picture' in o ? { picture: f, image: o.picture, removed: o.removed ?? 0 } : { reason: o.reason })
  }
  return parts
}

// ---- the cache key (LLD 3.4)

/** FNV-1a 64-bit over UTF-16 code units, as 16 hex characters. */
export function fnv1a64(s: string): string {
  let h = 0xcbf29ce484222325n
  const prime = 0x100000001b3n
  const mask = 0xffffffffffffffffn
  for (let i = 0; i < s.length; i++) h = ((h ^ BigInt(s.charCodeAt(i))) * prime) & mask
  return h.toString(16).padStart(16, '0')
}

/** `<kind>-<format>-<fnv1a64(rendererVersion + NUL + source)>-<source length>`. */
export const cacheKey = (kind: FenceKind, format: 'svg' | 'png', rendererVersion: string, source: string): string =>
  `${kind}-${format}-${fnv1a64(`${rendererVersion}\u0000${source}`)}-${source.length}`

/** A terminal Image's size in cells: a nominal 8 x 16 px cell, each side 1 to 255 (LLD 4, step 6). */
export const cellsOf = (width: number, height: number) => ({
  columns: Math.min(255, Math.max(1, Math.ceil(width / 8))),
  rows: Math.min(255, Math.max(1, Math.ceil(height / 16))),
})

/** The picture's alt text: `<kind> diagram: <first line, at most 80 characters>`. */
export const altOf = (f: Fence) => `${f.kind} diagram: ${(f.source.split(/\r?\n/).find(l => l.trim()) ?? '').trim().slice(0, 80)}`
