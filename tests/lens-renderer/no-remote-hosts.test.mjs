// AC-20.5.2 [BV]: no remote diagram host named in the lens's own source. The file set is spec D5's:
// hooks/**/*.ts and *.tsx and renderer/*.mjs (not renderer/vendor/, not tests/); case-insensitive, comments included.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const LENS = fileURLToPath(new URL('../../plugins/claude/ai-dlc-lens', import.meta.url))
const HOSTS = /kroki|plantuml\.com|mermaid\.ink|fonts\.googleapis\.com/i

function walk(dir, keep, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, keep, out)
    else if (keep(p)) out.push(p)
  }
  return out
}

const hooks = walk(join(LENS, 'hooks'), p => /\.(ts|tsx)$/.test(p))
const renderer = readdirSync(join(LENS, 'renderer')).filter(n => n.endsWith('.mjs')).map(n => join(LENS, 'renderer', n))

describe('no remote diagram host in the lens source (AC-20.5.2)', () => {
  test('the file set is the one spec D5 names, and it is not empty', () => {
    assert.ok(hooks.some(p => p.endsWith('diagram.ts')))
    assert.ok(hooks.some(p => p.endsWith('register.tsx')))
    assert.deepEqual(renderer.map(p => p.split(/[\\/]/).pop()).sort(), ['flatten.mjs', 'render.mjs', 'scrub.mjs'])
  })
  for (const p of [...hooks, ...renderer]) {
    test(`${p.slice(LENS.length + 1).replace(/\\/g, '/')} names no remote diagram host`, () => {
      const m = HOSTS.exec(readFileSync(p, 'utf8'))
      assert.equal(m, null, m ? `matches ${m[0]}` : '')
    })
  }
  test('no setting key or default in settings.ts contains "http"', () => {
    const src = readFileSync(join(LENS, 'hooks', 'settings.ts'), 'utf8')
    for (const line of src.split('\n').filter(l => /^\s{2}\w+:\s*\{ kind:/.test(l))) assert.doesNotMatch(line, /http/i, line.trim())
  })
})
