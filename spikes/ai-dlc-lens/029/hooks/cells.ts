// Spike 029 (ITEM-029): the cells of the avatar grid, pure data, no `$`.
// Each Svg cell names what a pass and a fail look like, so the person can read the pane alone.

export const SVG_CAP = 131072

export type Asset = { name: string; mime: string; base64: string; bytes: number }

export type SvgCell = {
  id: string
  label: string
  pass: string
  source: string
  isInteractive?: boolean
  width: number
  height: number
}

const NS = 'xmlns="http://www.w3.org/2000/svg"'
const XLINK = 'xmlns:xlink="http://www.w3.org/1999/xlink"'

export function pick(assets: Record<string, Asset>, name: string): Asset {
  const a = assets[name]
  if (!a) throw new Error(`spike029: asset ${name} not loaded`)
  return a
}

export const dataUri = (a: Asset) => `data:${a.mime};base64,${a.base64}`

// A grey square with a red diagonal behind the image: the diagonal shows only when the image is not drawn.
export function imageSvg(href: string, attr: 'href' | 'xlink:href' = 'href'): string {
  return `<svg ${NS}${attr === 'xlink:href' ? ' ' + XLINK : ''} width="48" height="48"><rect width="48" height="48" fill="#ddd"/><line x1="0" y1="0" x2="48" y2="48" stroke="red" stroke-width="4"/><image ${attr}="${href}" width="48" height="48" preserveAspectRatio="none"/></svg>`
}

export function initialsSvg(text: string, color: string): string {
  return `<svg ${NS} width="48" height="48"><circle cx="24" cy="24" r="24" fill="${color}"/><text x="24" y="30" font-size="18" font-family="sans-serif" text-anchor="middle" fill="#fff">${text}</text></svg>`
}

export const CONTROL_SVG = `<svg ${NS} width="48" height="48"><rect width="48" height="48" fill="#2e7d32"/><text x="24" y="30" font-size="14" font-family="sans-serif" text-anchor="middle" fill="#fff">OK</text></svg>`

// CSS in <style> beats the fill attribute: green = <style> kept, red = stripped.
export const STYLE_SVG = `<svg ${NS} width="48" height="48"><style>.ok{fill:#2e7d32}</style><rect class="ok" width="48" height="48" fill="#c62828"/></svg>`

// Inline style attribute, same reading: green = kept, red = stripped.
export const STYLE_ATTR_SVG = `<svg ${NS} width="48" height="48"><rect style="fill:#2e7d32" width="48" height="48" fill="#c62828"/></svg>`

// Scrub probe: a <script> and an onload attribute the host must strip; the square draws either way.
export const SCRIPT_PROBE_SVG = `<svg ${NS} width="48" height="48" onload="void 0"><script>/* spike029 probe */</script><rect width="48" height="48" fill="#6d4c41"/></svg>`

// One-way (top) and two-way (bottom) arrows with <marker>: heads at the ends = kept, bare lines = stripped.
export const MARKER_SVG = `<svg ${NS} width="96" height="48"><defs><marker id="h" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="#1565c0"/></marker></defs><line x1="6" y1="14" x2="90" y2="14" stroke="#1565c0" stroke-width="2" marker-end="url(#h)"/><line x1="6" y1="34" x2="90" y2="34" stroke="#1565c0" stroke-width="2" marker-start="url(#h)" marker-end="url(#h)"/></svg>`

// The same two arrows with heads drawn as plain paths: what MARKER_SVG must look like.
export const MARKER_REF_SVG = `<svg ${NS} width="96" height="48"><line x1="6" y1="14" x2="84" y2="14" stroke="#1565c0" stroke-width="2"/><path d="M84,9L94,14L84,19z" fill="#1565c0"/><line x1="12" y1="34" x2="84" y2="34" stroke="#1565c0" stroke-width="2"/><path d="M84,29L94,34L84,39z" fill="#1565c0"/><path d="M12,29L2,34L12,39z" fill="#1565c0"/></svg>`

export function fileUrl(absPath: string): string {
  const p = absPath.replace(/\\/g, '/')
  return 'file://' + (p.startsWith('/') ? '' : '/') + encodeURI(p)
}

const IMG_PASS = 'picture covers the square; red diagonal = not drawn'

// The grid of the vscode/desktop pane, in check order (CHECK.md numbers).
export function svgCells(assets: Record<string, Asset>, root: string): SvgCell[] {
  const cells: SvgCell[] = []
  const add = (c: Omit<SvgCell, 'width' | 'height'> & { width?: number; height?: number }) =>
    cells.push({ width: 48, height: 48, ...c })

  add({ id: 'S0', label: 'control: plain Svg', pass: 'green square "OK"', source: CONTROL_SVG })
  add({ id: 'S0b', label: 'initials badge (fallback ref)', pass: 'blue circle "MR"', source: initialsSvg('MR', '#1e6edc') })

  const formats: [string, string][] = [['png', 'avatar.png'], ['jpeg', 'avatar.jpg'], ['gif', 'avatar.gif'], ['webp', 'avatar.webp']]
  let n = 1
  for (const isInteractive of [false, true]) {
    for (const [fmt, file] of formats) {
      const a = pick(assets, file)
      add({ id: `S${n++}`, label: `data:image/${fmt}${isInteractive ? ' (interactive)' : ''}`, pass: IMG_PASS, source: imageSvg(dataUri(a)), isInteractive })
    }
  }
  // n = 9
  add({ id: `S${n++}`, label: 'data:image/png via xlink:href', pass: IMG_PASS, source: imageSvg(dataUri(pick(assets, 'avatar.png')), 'xlink:href') })
  const png = `${root}/assets/avatar.png`.replace(/\\/g, '/')
  for (const isInteractive of [false, true]) {
    add({ id: `S${n++}`, label: `file:/// URL${isInteractive ? ' (interactive)' : ''}`, pass: IMG_PASS, source: imageSvg(fileUrl(png)), isInteractive })
    add({ id: `S${n++}`, label: `bare path${isInteractive ? ' (interactive)' : ''}`, pass: IMG_PASS, source: imageSvg(png), isInteractive })
  }
  // n = 14
  for (const size of ['4k', '32k', '64k', '95k', '130k']) {
    const a = pick(assets, `size-${size}.png`)
    const source = imageSvg(dataUri(a))
    add({ id: `S${n++}`, label: `png ${a.bytes} B, data URI ${dataUri(a).length} ch, Svg ${source.length} ch`, pass: 'noise covers the square; red diagonal = not drawn', source })
  }
  // n = 19
  add({ id: `S${n++}`, label: '<style> element', pass: 'green = kept, red = stripped', source: STYLE_SVG })
  add({ id: `S${n++}`, label: 'style="" attribute', pass: 'green = kept, red = stripped', source: STYLE_ATTR_SVG })
  add({ id: `S${n++}`, label: '<marker> arrows', pass: 'heads as in the reference = kept; bare lines = stripped', source: MARKER_SVG, width: 96 })
  add({ id: `S${n++}`, label: 'arrow reference (plain paths)', pass: 'one-way top, two-way bottom', source: MARKER_REF_SVG, width: 96 })
  add({ id: `S${n++}`, label: '<marker> arrows (interactive)', pass: 'heads as in the reference = kept', source: MARKER_SVG, width: 96, isInteractive: true })
  add({ id: `S${n++}`, label: '<style> (interactive)', pass: 'green = kept, red = stripped', source: STYLE_SVG, isInteractive: true })
  add({ id: `S${n++}`, label: 'scrub probe: <script> + onload', pass: 'brown square; nothing else happens', source: SCRIPT_PROBE_SVG })
  return cells
}

// The one cell past the cap, drawn alone in its own pane (a refused Svg refuses the whole tree).
export function overCapCell(assets: Record<string, Asset>): SvgCell {
  const a = pick(assets, 'size-140k.png')
  const source = imageSvg(dataUri(a))
  return { id: 'S26', label: `over cap: Svg ${source.length} ch > ${SVG_CAP}`, pass: 'tree refused (dim transcript line), pane closed or empty', source, width: 48, height: 48 }
}

export const ASSET_FILES: Record<string, string> = {
  'avatar.png': 'image/png',
  'avatar.jpg': 'image/jpeg',
  'avatar.gif': 'image/gif',
  'avatar.webp': 'image/webp',
  'size-4k.png': 'image/png',
  'size-32k.png': 'image/png',
  'size-64k.png': 'image/png',
  'size-95k.png': 'image/png',
  'size-130k.png': 'image/png',
  'size-140k.png': 'image/png',
}
