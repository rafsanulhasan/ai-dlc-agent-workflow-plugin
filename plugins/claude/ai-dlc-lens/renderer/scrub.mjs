// The renderer's own SVG strip (diagramming LLD 2.2), run on the flattened SVG before it is rasterised:
// the PNG path never reaches the hook with an SVG. The same rule table as scrubSvg in
// ../hooks/diagram.ts, written twice (the hook's TypeScript is not imported here, nor this file there):
// keep the two identical, rule for rule. Pure, no dependency.

// The elements that never stay, with their content.
const DROPPED = ['script', 'foreignObject', 'iframe', 'object', 'embed']
// A URL that may stay: a fragment or a data: URI.
const local = v => /^\s*['"]?\s*(#|data:)/i.test(v)
// The value as a browser reads it: numeric character references and &colon; decoded.
const decode = v => v
  .replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&colon;/gi, ':')
// A script scheme anywhere in the value, ignoring the whitespace and control characters browsers skip.
const scripted = v => /javascript:/i.test(v.replace(/[\u0000- ]/g, ''))
// Every url() target in the value is a fragment or a data: URI.
const urlsLocal = v => [...v.matchAll(/url\(([^)]*)\)/gi)].every(m => local(m[1]))

// CSS: every @import at-rule, every declaration with a CSS escape (it can hide a url()), and every
// declaration whose url() is not local, removed whole.
const scrubCss = css => css
  .replace(/@import\b[^;]*;?/gi, '')
  .replace(/[^;{}]*\\[^;{}]*;?/g, '')
  .replace(/[A-Za-z-]+\s*:[^;{}]*url\(([^)]*)\)[^;{}]*;?/gi, (d, target) => (local(target) ? d : ''))

// One attribute, its value as written (double-quoted, single-quoted, unquoted or none): null when it
// goes, else name="value".
function scrubAttr(name, raw) {
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
function scrubTags(svg) {
  const open = /<([A-Za-z][\w:.-]*)/g
  let out = ''
  let at = 0
  let m
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
    const kept = []
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

/** The SVG with no script-like element, event handler, javascript: value, remote link, @import or remote
 * url(). Attribute values are read double-quoted, single-quoted or unquoted. */
export function scrubSvg(svg) {
  let out = svg
  for (const tag of DROPPED) {
    out = out.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '')
    out = out.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), '')
  }
  out = out.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (_, o, css, c) => `${o}${scrubCss(css)}${c}`)
  return scrubTags(out)
}
