// The diagram renderer (diagramming LLD section 3, ADR-0005): a child process the lens's hook runs with
// $.process.run, so the vendored bundles never load into the hooks module.
//
//   node render.mjs --kind mermaid --format svg|png
//   stdin:  the cleaned source, UTF-8
//   stdout: one JSON line, { "data": { format, body, width, height }, "error": null } or
//           { "data": null, "error": "<one line>" }; body is the SVG text or the PNG in base64
//   exit:   0 whenever an envelope was written; 2 for a usage error (also an envelope)
//
// Sprint 1 draws Mermaid only (math and PlantUML are sprint 2). Offline by construction: the bundles in
// vendor/ are loaded from disk, the WebAssembly from a buffer, fetch is replaced by a function that
// throws, and nothing is written to disk. See BUILD.md for how vendor/ is built.
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { flattenSvg } from './flatten.mjs'
import { scrubSvg } from './scrub.mjs'

const here = dirname(fileURLToPath(import.meta.url))
globalThis.fetch = () => { throw new Error('the diagram renderer is offline') }

// The colours beautiful-mermaid is given explicitly, so every color-mix() has known inputs (LLD 3.1).
export const COLOURS = { bg: '#FFFFFF', fg: '#27272A', line: '#71717A', accent: '#27272A', muted: '#52525B', surface: '#F4F4F5', border: '#D4D4D8' }
// The PNG is drawn at twice the SVG's size, so the terminal's picture stays sharp.
const PNG_ZOOM = 2

/** The SVG handed to the rasteriser (LLD 6, the PNG half of AC-20.5.4): flattened, then scrubbed. Throws `flatten: ...`. */
export const svgForRaster = svg => scrubSvg(flattenSvg(svg))

const envelope = (data, error = null) => `${JSON.stringify({ data, error })}\n`
const firstLine = err => String(err instanceof Error ? err.message : err).split(/\r?\n/)[0].trim().slice(0, 200) || 'unknown error'

function argOf(argv, name) {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

/** The viewBox size of an SVG, in px. */
export function sizeOf(svg) {
  const m = /<svg\b[^>]*\bviewBox="\s*[-0-9.]+[\s,]+[-0-9.]+[\s,]+([0-9.]+)[\s,]+([0-9.]+)\s*"/.exec(svg)
  return m ? { width: Math.round(Number(m[1])), height: Math.round(Number(m[2])) } : { width: 0, height: 0 }
}

/** One render: the envelope line for `kind`, `format` and the source. Never throws. */
export async function render(kind, format, source) {
  if (kind !== 'mermaid') return { code: 2, line: envelope(null, `usage: --kind mermaid (got ${kind ?? 'none'})`) }
  if (format !== 'svg' && format !== 'png') return { code: 2, line: envelope(null, `usage: --format svg|png (got ${format ?? 'none'})`) }
  let svg
  try {
    const { renderMermaidSVG } = await import('./vendor/mermaid.mjs')
    svg = await renderMermaidSVG(source, COLOURS)
  } catch (err) {
    return { code: 0, line: envelope(null, firstLine(err)) }
  }
  const { width, height } = sizeOf(svg)
  if (format === 'svg') return { code: 0, line: envelope({ format: 'svg', body: svg, width, height }) }
  let flat
  try {
    flat = svgForRaster(svg)
  } catch (err) {
    return { code: 0, line: envelope(null, `renderer failed: ${firstLine(err)}`) }
  }
  let resvg
  try {
    resvg = await import('./vendor/index.mjs')
    await resvg.initWasm(readFileSync(join(here, 'vendor', 'index_bg.wasm')))
  } catch {
    return { code: 0, line: envelope(null, 'no PNG rasteriser') }
  }
  let font
  try {
    font = new Uint8Array(readFileSync(join(here, 'vendor', 'fonts', 'Inter_400Regular.ttf')))
  } catch {
    return { code: 0, line: envelope(null, 'no font') }
  }
  try {
    const png = new resvg.Resvg(flat, { font: { fontBuffers: [font], loadSystemFonts: false, defaultFontFamily: 'Inter' }, fitTo: { mode: 'zoom', value: PNG_ZOOM } }).render().asPng()
    return { code: 0, line: envelope({ format: 'png', body: Buffer.from(png).toString('base64'), width, height }) }
  } catch (err) {
    return { code: 0, line: envelope(null, `renderer failed: ${firstLine(err)}`) }
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  const { code, line } = await render(argOf(argv, '--kind'), argOf(argv, '--format'), Buffer.concat(chunks).toString('utf8'))
  process.stdout.write(line)
  process.exitCode = code
}

// Run as a program (not when a test imports render)
const same = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b)
if (process.argv[1] && same(resolve(process.argv[1]), fileURLToPath(import.meta.url))) await main()
