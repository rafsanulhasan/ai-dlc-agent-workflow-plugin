// The flatten step before rasterising (diagramming LLD 3.3; spike 20.1.5, finding A). beautiful-mermaid
// writes its colours as CSS custom properties, var() and color-mix(); resvg cannot evaluate them and
// draws such shapes black. flattenSvg resolves every var() from the SVG's own custom properties,
// evaluates every color-mix(in srgb, ...) to a hex colour, and replaces the <style> block with one font
// rule. An unknown or unsupported form throws one line (`flatten: <what>`): the render then fails, it is
// never drawn black. Pure, no dependency. Its table tests (LLD 7, tests/lens-renderer/) are not written yet.

const MAX_DEPTH = 8

// The index just past the parenthesis that closes the one opening at `open`.
function closeOf(s, open) {
  let depth = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++
    else if (s[i] === ')' && --depth === 0) return i + 1
  }
  throw new Error('flatten: unbalanced parentheses')
}

// Splits on the commas at depth 0.
function topLevelCommas(s) {
  const out = []
  let depth = 0, from = 0
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++
    else if (s[i] === ')') depth--
    else if (s[i] === ',' && depth === 0) { out.push(s.slice(from, i)); from = i + 1 }
  }
  out.push(s.slice(from))
  return out.map(x => x.trim())
}

// The custom properties the SVG declares: in its <style> block, then in the root element's style
// attribute (which wins for the same name).
function propsOf(svg) {
  const props = new Map()
  const decl = /(--[A-Za-z0-9_-]+)\s*:\s*([^;}]+)/g
  for (const m of svg.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    const css = m[1].replace(/\/\*[\s\S]*?\*\//g, '')
    for (const d of css.matchAll(decl)) props.set(d[1].toLowerCase(), d[2].trim())
  }
  const root = /<svg\b[^>]*\sstyle="([^"]*)"/.exec(svg)
  if (root) for (const d of root[1].matchAll(decl)) props.set(d[1].toLowerCase(), d[2].trim())
  return props
}

const hexOf = c => {
  const v = c.trim()
  if (/^#[0-9a-f]{6}$/i.test(v)) return [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16))
  if (/^#[0-9a-f]{3}$/i.test(v)) return [1, 2, 3].map(i => parseInt(v[i] + v[i], 16))
  throw new Error(`flatten: unsupported colour ${v.slice(0, 40)}`)
}
const toHex = rgb => `#${rgb.map(n => n.toString(16).padStart(2, '0')).join('')}`

// One color-mix operand: a colour, then an optional percentage.
function operand(text) {
  const m = /^(.*?)(?:\s+(-?[0-9]+(?:\.[0-9]+)?)%)?$/.exec(text.trim())
  const colour = m[1].trim()
  const pct = m[2] === undefined ? undefined : Number(m[2])
  if (pct !== undefined && (!Number.isFinite(pct) || pct < 0 || pct > 100)) throw new Error(`flatten: percentage ${m[2]}% out of range`)
  return { rgb: hexOf(colour), pct }
}

// color-mix(in srgb, C1 [P1%], C2 [P2%]) with every inner var() and color-mix() already resolved.
function mix(inner) {
  const parts = topLevelCommas(inner)
  if (parts.length !== 3) throw new Error('flatten: color-mix needs a colour space and exactly two colours')
  if (parts[0].toLowerCase() !== 'in srgb') throw new Error(`flatten: color-mix ${parts[0]} is not supported`)
  const a = operand(parts[1]), b = operand(parts[2])
  let w1, w2
  if (a.pct === undefined && b.pct === undefined) { w1 = 50; w2 = 50 }
  else if (b.pct === undefined) { w1 = a.pct; w2 = 100 - a.pct }
  else if (a.pct === undefined) { w2 = b.pct; w1 = 100 - b.pct }
  else {
    if (a.pct + b.pct !== 100) throw new Error('flatten: color-mix percentages do not sum to 100')
    w1 = a.pct; w2 = b.pct
  }
  return toHex(a.rgb.map((c, i) => Math.round((c * w1 + b.rgb[i] * w2) / 100)))
}

// Resolves every var() and color-mix() in `text`, inner to outer.
function resolve(text, props, depth = 0) {
  if (depth > MAX_DEPTH) throw new Error('flatten: custom property depth')
  let out = ''
  let i = 0
  const head = /var\(|color-mix\(/gi
  for (;;) {
    head.lastIndex = i
    const m = head.exec(text)
    if (!m) return out + text.slice(i)
    out += text.slice(i, m.index)
    const open = m.index + m[0].length - 1
    const end = closeOf(text, open)
    const inner = text.slice(open + 1, end - 1)
    if (m[0].toLowerCase() === 'var(') {
      const [name, ...rest] = topLevelCommas(inner)
      if (!/^--[A-Za-z0-9_-]+$/.test(name)) throw new Error(`flatten: bad custom property ${name.slice(0, 40)}`)
      const value = props.get(name.toLowerCase()) ?? (rest.length ? rest.join(', ') : undefined)
      if (value === undefined) throw new Error(`flatten: unknown property ${name}`)
      out += resolve(value, props, depth + 1)
    } else {
      out += mix(resolve(inner, props, depth + 1))
    }
    i = end
  }
}

/** The SVG with no var(), no color-mix() and no @import: its <style> block is one font rule. Throws `flatten: ...`. */
export function flattenSvg(svg) {
  const props = propsOf(svg)
  const noStyle = svg.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
  if (noStyle.search(/<svg\b[^>]*>/) < 0) throw new Error('flatten: no <svg> element')
  const body = resolve(noStyle, props)
  const openAfter = body.indexOf('>', body.search(/<svg\b[^>]*>/)) + 1
  const out = `${body.slice(0, openAfter)}\n<style>text { font-family: Inter }</style>${body.slice(openAfter)}`
  if (/var\(|color-mix\(|@import/i.test(out)) throw new Error('flatten: unresolved CSS left')
  return out
}
