import { describe, expect, test } from 'claude-code/testing'
import {
  MERMAID_KINDS,
  PNG_CAP,
  SVG_CAP,
  altOf,
  cacheKey,
  cellsOf,
  errorCode,
  findFences,
  fitCaps,
  fnv1a64,
  isSupportedMermaid,
  layoutParts,
  mermaidKind,
  reasonFor,
  removedNote,
  sanitiseSource,
  scrubSvg,
  texKind,
} from '../hooks/diagram'
import type { Fence, Outcome, ReasonCode, Segment } from '../hooks/diagram'
import { cases } from './fixtures/scrub-cases.mjs'

// The diagramming submodule's pure core (diagramming spec and LLD 2; ITEM-053.b). The scrub cases are one table
// for both copies of scrubSvg: tests/fixtures/scrub-cases.mjs is also run against renderer/scrub.mjs by
// tests/lens-renderer/scrub.test.mjs.

describe('scrubSvg: the shared case table (AC-20.5.4, the Svg half)', () => {
  for (const c of cases) test(c.name, () => expect(scrubSvg(c.input)).toBe(c.output))

  test('scrubbing twice changes nothing', () => {
    for (const c of cases) expect(scrubSvg(c.output)).toBe(c.output)
  })
  test('what the hook draws has no @import, no script scheme, no handler and no remote link, on every case', () => {
    for (const c of cases) {
      const out = scrubSvg(c.input)
      expect(/@import/i.test(out)).toBe(false)
      expect(/javascript:/i.test(out)).toBe(false)
      expect(/\son\w+\s*=/i.test(out)).toBe(false)
      expect(/(?:href|src)\s*=\s*["']?https?:/i.test(out)).toBe(false)
    }
  })
})

describe('findFences (LLD 2.1)', () => {
  const fences = (text: string) => findFences(text).flatMap(s => ('fence' in s ? [s.fence] : []))
  test('text with no fence is one text segment', () => {
    expect(findFences('hello\nworld')).toEqual([{ text: 'hello\nworld' }])
    expect(findFences('')).toEqual([])
  })
  test('a closed mermaid fence: its kind, body, offsets and tag; the text around it stays', () => {
    const text = 'before\n```mermaid\nflowchart LR\n  A --> B\n```\nafter'
    const segs = findFences(text)
    expect(segs).toHaveLength(3)
    const f = (segs[1] as { fence: Fence }).fence
    expect(f).toMatchObject({ kind: 'mermaid', closed: true, source: 'flowchart LR\n  A --> B', tag: 'mermaid' })
    expect(text.slice(f.start, f.end)).toBe('```mermaid\nflowchart LR\n  A --> B\n```')
    expect((segs[0] as { text: string }).text).toBe('before\n')
    expect((segs[2] as { text: string }).text).toBe('\nafter')
  })
  test('an unclosed fence runs to the end of the text and is marked open', () => {
    const [f] = fences('```mermaid\nflowchart LR\n  A --> B')
    expect(f).toMatchObject({ kind: 'mermaid', closed: false, source: 'flowchart LR\n  A --> B' })
  })
  test('the closing fence must be at least as long as the opening one, and of the same character', () => {
    expect(fences('````mermaid\nflowchart LR\n```\nstill inside\n````')[0]).toMatchObject({ closed: true, source: 'flowchart LR\n```\nstill inside' })
    expect(fences('~~~mermaid\nflowchart LR\n```\n~~~')[0]).toMatchObject({ closed: true, source: 'flowchart LR\n```' })
  })
  test('an opening fence is indented by at most 3 spaces', () => {
    expect(fences('   ```mermaid\nflowchart LR\n   ```')).toHaveLength(1)
    expect(fences('    ```mermaid\nflowchart LR\n    ```')).toHaveLength(0)
  })
  test('the info string is case-insensitive; other tags are plain text and their body is not scanned', () => {
    expect(fences('```MERMAID\nflowchart LR\n```')[0]!.kind).toBe('mermaid')
    expect(fences('```js\n$$ x $$\n```')).toHaveLength(0)
    expect(findFences('```js\ncode\n```')).toEqual([{ text: '```js\ncode\n```' }])
  })
  const kinds: [string, string][] = [['plantuml', 'plantuml'], ['puml', 'plantuml'], ['math', 'math'], ['tikz', 'texDiagram']]
  for (const [tag, kind] of kinds) test(`a ${tag} fence is a ${kind} fence`, () => expect(fences('```' + tag + '\nx\n```')[0]!.kind).toBe(kind))
  test('latex and tex: a document or tikzpicture is a texDiagram, anything else math', () => {
    expect(texKind('latex', '\\documentclass{article}')).toBe('texDiagram')
    expect(texKind('tex', '\\usepackage{tikz}')).toBe('texDiagram')
    expect(texKind('latex', '\\begin{document}')).toBe('texDiagram')
    expect(texKind('latex', '\\begin{tikzpicture}')).toBe('texDiagram')
    expect(texKind('latex', 'x^2 + y^2')).toBe('math')
    expect(texKind('tikz', 'x')).toBe('texDiagram')
    expect(texKind('math', '\\documentclass')).toBe('math')
    expect(texKind('LaTeX', 'x')).toBe('math')
  })
  test('display math outside fences: $$ ... $$ and \\[ ... \\]; single $x$ is never a fence', () => {
    const a = fences('see\n$$\nx^2\n$$\nend')
    expect(a).toHaveLength(1)
    expect(a[0]).toMatchObject({ kind: 'math', closed: true, source: 'x^2', tag: '$$' })
    const b = fences('\\[ y \\]')
    expect(b[0]).toMatchObject({ kind: 'math', source: 'y', closed: true })
    expect(fences('the price is $5 and $6')).toHaveLength(0)
  })
  test('an unclosed $$ runs to the end; an empty $$ $$ is not a fence', () => {
    expect(fences('$$\nx')[0]).toMatchObject({ closed: false, source: 'x' })
    expect(fences('$$ $$')).toHaveLength(0)
  })
  test('several fences keep their order and non-overlapping offsets', () => {
    const text = '```mermaid\na\n```\nmid\n```mermaid\nb\n```'
    const fs = fences(text)
    expect(fs.map(f => f.source)).toEqual(['a', 'b'])
    expect(fs[0]!.end).toBeLessThanOrEqual(fs[1]!.start)
  })
  test('CRLF text is read the same way', () => {
    expect(fences('```mermaid\r\nflowchart LR\r\n```\r\n')[0]).toMatchObject({ closed: true, source: 'flowchart LR' })
  })
})

describe('sanitiseSource (spec D5)', () => {
  test('click href and click "url" lines, <img src> and ![](url) in labels are removed and counted', () => {
    const src = 'flowchart LR\n  A["<img src=\'http://x/a.png\'> hi"] --> B\n  click A href "http://x/"\n  click B "http://y/"\n  C["![alt](http://z/p.png)"]'
    const out = sanitiseSource('mermaid', src)
    expect(out.removed).toBe(4)
    expect(out.source).not.toMatch(/http|click|<img|!\[/)
    expect(out.source).toContain('flowchart LR')
    expect(out.source).toContain('A["')
  })
  test('a clean source is returned as it is with nothing removed', () => {
    expect(sanitiseSource('mermaid', 'flowchart LR\n  A --> B')).toEqual({ source: 'flowchart LR\n  A --> B', removed: 0 })
  })
  test('the other kinds are returned as they are (sprint 2)', () => {
    expect(sanitiseSource('plantuml', 'click A href "http://x"')).toEqual({ source: 'click A href "http://x"', removed: 0 })
    expect(sanitiseSource('math', 'x')).toEqual({ source: 'x', removed: 0 })
  })
})

describe('mermaidKind and the supported kinds (AC-20.1.5)', () => {
  test('the first keyword that is not a comment or front matter', () => {
    expect(mermaidKind('flowchart LR\n A-->B')).toBe('flowchart')
    expect(mermaidKind('%% comment\n\n  sequenceDiagram\n  A->>B: x')).toBe('sequenceDiagram')
    expect(mermaidKind('---\ntitle: T\n---\nstateDiagram-v2\n  [*] --> A')).toBe('stateDiagram-v2')
    expect(mermaidKind('xychart-beta\n x-axis [a]')).toBe('xychart-beta')
    expect(mermaidKind('')).toBe('')
    expect(mermaidKind('%% only a comment')).toBe('')
    expect(mermaidKind('123 not a keyword')).toBe('')
  })
  test('the five kinds of AC-20.1.5 and the rest of the list are supported; others are not', () => {
    for (const k of ['flowchart', 'graph', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'stateDiagram-v2', 'erDiagram', 'xychart-beta']) {
      expect(isSupportedMermaid(`${k}\n  x`)).toBe(true)
      expect(MERMAID_KINDS).toContain(k)
    }
    for (const k of ['pie', 'gantt', 'journey', 'mindmap', 'gitGraph', 'flowchartx']) expect(isSupportedMermaid(`${k}\n  x`)).toBe(false)
    expect(isSupportedMermaid('')).toBe(false)
  })
})

describe('caps and reasons (LLD 2.2)', () => {
  test('fitCaps: an SVG of at most SVG_CAP characters fits, one more does not; a PNG of at most 2 MiB fits', () => {
    expect(SVG_CAP).toBe(131072)
    expect(PNG_CAP).toBe(2 * 1024 * 1024)
    expect(fitCaps('svg', 'x'.repeat(SVG_CAP), 0)).toEqual({ ok: true })
    expect(fitCaps('svg', 'x'.repeat(SVG_CAP + 1), 0)).toEqual({ ok: false, reason: 'diagram too large to draw (over 131072 characters)' })
    expect(fitCaps('png', 'x'.repeat(SVG_CAP + 1), PNG_CAP)).toEqual({ ok: true })
    expect(fitCaps('png', '', PNG_CAP + 1)).toEqual({ ok: false, reason: 'diagram too large to draw (over 2 MiB)' })
  })
  test('every reason code has its line', () => {
    const lines: Record<ReasonCode, string> = {
      svgCap: 'diagram too large to draw (over 131072 characters)',
      pngCap: 'diagram too large to draw (over 2 MiB)',
      syntax: 'diagram not drawn: syntax error',
      noNode: 'diagram renderer needs node on PATH',
      noRaster: 'no PNG rasteriser for this platform',
      noFont: 'diagram text could not be rendered (no font)',
      unsupportedMermaid: 'mermaid diagram type "" is not supported offline',
      rendering: 'rendering…',
      failed: 'diagram not drawn: renderer failed',
      noSurface: 'this surface draws neither images nor SVG',
    }
    for (const [code, line] of Object.entries(lines)) expect(reasonFor(code as ReasonCode)).toBe(line)
  })
  test('a syntax reason carries the first line of the renderer\'s message; an unsupported kind carries its name', () => {
    expect(reasonFor('syntax', 'Parse error on line 2\nExpecting x')).toBe('diagram not drawn: Parse error on line 2')
    expect(reasonFor('unsupportedMermaid', 'pie')).toBe('mermaid diagram type "pie" is not supported offline')
  })
  test('a reason is at most 120 characters, cut with an ellipsis', () => {
    const r = reasonFor('syntax', 'e'.repeat(500))
    expect(r.length).toBe(120)
    expect(r.endsWith('…')).toBe(true)
  })
  test('errorCode: the renderer\'s error text decides the reason', () => {
    expect(errorCode('no font')).toBe('noFont')
    expect(errorCode('no PNG rasteriser')).toBe('noRaster')
    expect(errorCode('renderer failed: flatten: x')).toBe('failed')
    expect(errorCode('Invalid mermaid header: x')).toBe('syntax')
  })
  test('the removed note', () => expect(removedNote(2)).toBe('removed 2 remote reference(s)'))
})

describe('layoutParts: the picture goes right after its fence (G2 OQ1)', () => {
  const segs = (text: string): Segment[] => findFences(text)
  const pic = { picture: { format: 'svg' as const, body: '<svg/>', width: 1, height: 1 } }
  test('text, the fence as source, its picture, text', () => {
    const parts = layoutParts(segs('a\n```mermaid\nflowchart LR\n```\nb'), () => pic)
    expect(parts.map(p => Object.keys(p)[0])).toEqual(['md', 'source', 'picture', 'md'])
  })
  test('a reason replaces the picture, the source stays', () => {
    const parts = layoutParts(segs('```mermaid\nflowchart LR\n```'), () => ({ reason: 'nope' }))
    expect(parts).toEqual([{ source: expect.anything() }, { reason: 'nope' }])
  })
  test('an open fence, and a fence the lookup does not answer (disabled or deferred), are source only', () => {
    expect(layoutParts(segs('```mermaid\nflowchart LR'), () => pic).map(p => Object.keys(p)[0])).toEqual(['source'])
    expect(layoutParts(segs('```math\nx\n```'), () => undefined).map(p => Object.keys(p)[0])).toEqual(['source'])
  })
  test('the removed count rides with the picture', () => {
    const parts = layoutParts(segs('```mermaid\nflowchart LR\n```'), () => ({ ...pic, removed: 3 } as Outcome))
    expect(parts[1]).toMatchObject({ removed: 3 })
  })
  test('two fences are laid out in order, each followed by its own outcome', () => {
    const parts = layoutParts(segs('```mermaid\na\n```\n```mermaid\nb\n```'), f => (f.source === 'a' ? pic : { reason: 'r' }))
    expect(parts.map(p => Object.keys(p)[0])).toEqual(['source', 'picture', 'md', 'source', 'reason'])
  })
})

describe('cacheKey and fnv1a64 (LLD 3.4)', () => {
  test('FNV-1a 64: the published test vectors, as 16 hex characters', () => {
    expect(fnv1a64('')).toBe('cbf29ce484222325')
    expect(fnv1a64('a')).toBe('af63dc4c8601ec8c')
    expect(fnv1a64('foobar')).toBe('85944171f73967e8')
  })
  test('the key is kind, format, the hash of version + NUL + source, and the source length', () => {
    expect(cacheKey('mermaid', 'svg', '1.0.0', 'flowchart LR')).toBe(`mermaid-svg-${fnv1a64('1.0.0\u0000flowchart LR')}-12`)
  })
  test('another format, version or source is another key', () => {
    const k = (f: 'svg' | 'png', v: string, s: string) => cacheKey('mermaid', f, v, s)
    const base = k('svg', '1', 'a')
    expect(new Set([base, k('png', '1', 'a'), k('svg', '2', 'a'), k('svg', '1', 'b')]).size).toBe(4)
  })
})

describe('cellsOf and altOf', () => {
  test('a nominal 8 x 16 px cell, each side 1 to 255', () => {
    expect(cellsOf(80, 160)).toEqual({ columns: 10, rows: 10 })
    expect(cellsOf(81, 161)).toEqual({ columns: 11, rows: 11 })
    expect(cellsOf(0, 0)).toEqual({ columns: 1, rows: 1 })
    expect(cellsOf(100000, 100000)).toEqual({ columns: 255, rows: 255 })
  })
  test('the alt text: the kind and the first non-blank line, at most 80 characters', () => {
    const f = (source: string): Fence => ({ kind: 'mermaid', source, closed: true, start: 0, end: 1, tag: 'mermaid' })
    expect(altOf(f('\n\n  flowchart LR\n A-->B'))).toBe('mermaid diagram: flowchart LR')
    expect(altOf(f('x'.repeat(200))).length).toBe('mermaid diagram: '.length + 80)
    expect(altOf(f(''))).toBe('mermaid diagram: ')
  })
})
