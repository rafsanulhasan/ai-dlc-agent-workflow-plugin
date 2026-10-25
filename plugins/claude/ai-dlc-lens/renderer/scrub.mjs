// The renderer's own SVG strip (diagramming LLD 2.2), run on the flattened SVG before it is rasterised:
// the PNG path never reaches the hook with an SVG. The same rule table as scrubSvg in
// ../hooks/diagram.ts, written twice (the hook's TypeScript is not imported here, nor this file there).
// Pure, no dependency. The shared case file both are to be tested on (LLD 2.2) is not written yet.

// The elements that never stay, with their content.
const DROPPED = ['script', 'foreignObject', 'iframe', 'object', 'embed']
// A URL that may stay: a fragment or a data: URI.
const local = v => /^\s*['"]?\s*(#|data:)/i.test(v)

// CSS: every @import at-rule, and every declaration whose url() is not local, removed whole.
function scrubCss(css) {
  return css
    .replace(/@import\b[^;]*;?/gi, '')
    .replace(/[A-Za-z-]+\s*:[^;{}]*url\(([^)]*)\)[^;{}]*;?/gi, (d, target) => (local(target) ? d : ''))
}

/** The SVG with no script-like element, event handler, javascript: value, remote link, @import or remote url(). */
export function scrubSvg(svg) {
  let out = svg
  for (const tag of DROPPED) {
    out = out.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '')
    out = out.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), '')
  }
  // Event handlers and javascript: values
  out = out.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  out = out.replace(/\s+[A-Za-z:-]+\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, '')
  // Links that are not a fragment or a data: URI
  out = out.replace(/\s+(?:xlink:)?href\s*=\s*("([^"]*)"|'([^']*)')/gi, (a, _q, d, s) => (local(d ?? s ?? '') ? a : ''))
  // <style> blocks and style attributes
  out = out.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (_, o, css, c) => `${o}${scrubCss(css)}${c}`)
  out = out.replace(/(\sstyle\s*=\s*")([^"]*)(")/gi, (_, o, css, c) => `${o}${scrubCss(css)}${c}`)
  // A presentation attribute that points outside (fill="url(...)" with a remote target)
  out = out.replace(/\s+[A-Za-z:-]+\s*=\s*"[^"]*url\(([^)]*)\)[^"]*"/gi, (a, target) => (local(target) ? a : ''))
  return out
}
