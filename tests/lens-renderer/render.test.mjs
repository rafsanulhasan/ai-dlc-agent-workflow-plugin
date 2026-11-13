// render.mjs: the envelope, the usage errors, the real Mermaid kinds, the PNG and the pixel oracle
// (diagramming LLD 7; AC-20.5.4 and the pixel oracle of 17.1.l3 Major 3).
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { COLOURS, render, sizeOf, svgForRaster } from '../../plugins/claude/ai-dlc-lens/renderer/render.mjs'
import { decodePng } from './png-sample.mjs'

const RENDER = fileURLToPath(new URL('../../plugins/claude/ai-dlc-lens/renderer/render.mjs', import.meta.url))
const FLOW = 'flowchart LR\n  A[Start] --> B[End]\n'
const envelope = r => JSON.parse(r.line)
// resvg's initWasm runs once per process, so each PNG is drawn by its own renderer process, as the hook runs it
const cli = (format, src) => JSON.parse(spawnSync(process.execPath, [RENDER, '--kind', 'mermaid', '--format', format], { input: src, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout)

describe('render: the envelope', () => {
  test('svg: one line, data and a null error, a real viewBox size', async () => {
    const r = await render('mermaid', 'svg', FLOW)
    assert.equal(r.code, 0)
    assert.equal(r.line.indexOf('\n'), r.line.length - 1, 'one line')
    const e = envelope(r)
    assert.equal(e.error, null)
    assert.equal(e.data.format, 'svg')
    assert.match(e.data.body, /^<svg /)
    assert.ok(e.data.width > 0 && e.data.height > 0)
    assert.deepEqual({ width: e.data.width, height: e.data.height }, sizeOf(e.data.body))
  })
  test('png: base64 of a real PNG, twice the size of the SVG', async () => {
    const e = cli('png', FLOW)
    assert.equal(e.error, null)
    assert.equal(e.data.format, 'png')
    const png = decodePng(Buffer.from(e.data.body, 'base64'))
    assert.ok(Math.abs(png.width - 2 * e.data.width) <= 2 && Math.abs(png.height - 2 * e.data.height) <= 2)
  })
  test('an unknown kind or format is a usage error: exit code 2, an envelope with a null data', async () => {
    for (const [k, f] of [['plantuml', 'svg'], ['math', 'png'], [undefined, 'svg'], ['mermaid', 'gif'], ['mermaid', undefined]]) {
      const r = await render(k, f, FLOW)
      assert.equal(r.code, 2, `${k}/${f}`)
      const e = envelope(r)
      assert.equal(e.data, null)
      assert.match(e.error, /^usage: /)
    }
  })
  test('a syntax error is a one-line error with a null data and exit code 0', async () => {
    const bad = await render('mermaid', 'svg', 'nonsense\n  A --> B\n')
    const e = envelope(bad)
    assert.equal(bad.code, 0)
    assert.equal(e.data, null)
    assert.ok(e.error.length > 0 && !e.error.includes('\n'))
    assert.match(e.error, /Invalid mermaid header/)
  })
  test('as a program: stdin in, the envelope on stdout, exit 0', () => {
    const r = spawnSync(process.execPath, [RENDER, '--kind', 'mermaid', '--format', 'svg'], { input: FLOW, encoding: 'utf8' })
    assert.equal(r.status, 0)
    assert.equal(JSON.parse(r.stdout).data.format, 'svg')
  })
  test('as a program with a bad format: exit 2 and an envelope', () => {
    const r = spawnSync(process.execPath, [RENDER, '--kind', 'mermaid', '--format', 'bmp'], { input: FLOW, encoding: 'utf8' })
    assert.equal(r.status, 2)
    assert.match(JSON.parse(r.stdout).error, /^usage: /)
  })
})

describe('render: the Mermaid kinds of AC-20.1.5 draw offline', () => {
  const KINDS = {
    flowchart: FLOW,
    graph: 'graph TD\n  A --> B\n',
    sequenceDiagram: 'sequenceDiagram\n  Alice->>Bob: hi\n  Bob-->>Alice: yo\n',
    classDiagram: 'classDiagram\n  class Animal\n  Animal <|-- Dog\n',
    stateDiagram: 'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Busy\n',
    erDiagram: 'erDiagram\n  CUSTOMER ||--o{ ORDER : places\n',
  }
  for (const [name, src] of Object.entries(KINDS)) {
    test(`${name} gives an SVG and a PNG`, async () => {
      for (const f of ['svg', 'png']) {
        const e = cli(f, src)
        assert.equal(e.error, null, `${name}/${f}`)
        assert.ok(e.data.body.length > 100)
      }
    })
  }
})

describe('render: the PNG half of AC-20.5.4 and the pixel oracle', () => {
  test('the SVG handed to the rasteriser has no var(), color-mix(), @import, host or non-fragment url()', async () => {
    const svg = envelope(await render('mermaid', 'svg', FLOW)).data.body
    const flat = svgForRaster(svg)
    assert.doesNotMatch(flat, /var\(|color-mix\(|@import|fonts\.googleapis\.com/i)
    for (const m of flat.matchAll(/url\(([^)]*)\)/gi)) assert.match(m[1].trim(), /^['"]?#/, 'only fragment url()')
    assert.match(svg, /fonts\.googleapis\.com/, 'the raw SVG does carry the import, so the check above means something')
  })
  test('a png of a Mermaid flowchart paints its colours: the background, and node A fill from the colour table', async () => {
    const e = cli('png', FLOW)
    const png = decodePng(Buffer.from(e.data.body, 'base64'))
    // (a) the corner is the table's bg and opaque: a transparent corner is black text on a dark terminal (LLD 7, pixel oracle)
    assert.equal(png.alpha(0, 0), 255, 'the corner pixel is opaque')
    assert.equal(png.at(0, 0), COLOURS.bg.toLowerCase())
    const flat = svgForRaster(envelope(await render('mermaid', 'svg', FLOW)).data.body)
    const rect = /<g class="node" data-id="A"[^>]*>\s*<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"[^>]*fill="(#[0-9a-f]{6})"/i.exec(flat)
    assert.ok(rect, 'node A rect found in the flattened SVG')
    const [, x, y, , h, fill] = rect
    const px = png.at(Math.round((Number(x) + 3) * 2), Math.round((Number(y) + Number(h) / 2) * 2))
    assert.equal(px, fill.toLowerCase(), 'the pixel inside node A is the rect fill')
    assert.equal(px, COLOURS.surface.toLowerCase(), 'and that fill is the surface colour of the table')
    assert.notEqual(px, '#000000')
    assert.notEqual(px, COLOURS.bg.toLowerCase())
  })
  test('the PNG is not flat: antialiased text and strokes paint more than two colours', async () => {
    const e = cli('png', FLOW)
    const png = decodePng(Buffer.from(e.data.body, 'base64'))
    const seen = new Set()
    for (let y = 0; y < png.height; y += 2) for (let x = 0; x < png.width; x += 2) seen.add(png.at(x, y))
    assert.ok(seen.size > 2)
  })
})
