// flattenSvg (renderer/flatten.mjs, diagramming LLD 3.3): var() and color-mix() resolved, the style block
// replaced by one font rule, anything it cannot evaluate thrown as `flatten: ...`, never drawn black.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { flattenSvg } from '../../plugins/claude/ai-dlc-lens/renderer/flatten.mjs'

const svg = (style, body, root = '') => `<svg xmlns="http://www.w3.org/2000/svg"${root}><style>${style}</style>${body}</svg>`
const fillOf = out => /fill="([^"]*)"/.exec(out)?.[1]

describe('flattenSvg', () => {
  test('a var() resolves from the style block', () => {
    const out = flattenSvg(svg('svg{--a:#112233}', '<rect fill="var(--a)"/>'))
    assert.equal(fillOf(out), '#112233')
  })
  test('a var() resolves from the root style attribute, which wins over the style block', () => {
    const out = flattenSvg(svg('svg{--a:#111111}', '<rect fill="var(--a)"/>', ' style="--a:#222222"'))
    assert.equal(fillOf(out), '#222222')
  })
  test('a var() with a fallback uses it when the property is unknown, and ignores it when known', () => {
    assert.equal(fillOf(flattenSvg(svg('', '<rect fill="var(--nope, #abcdef)"/>'))), '#abcdef')
    assert.equal(fillOf(flattenSvg(svg('svg{--a:#000000}', '<rect fill="var(--a, #abcdef)"/>'))), '#000000')
  })
  test('a var() with no value and no fallback throws', () => {
    assert.throws(() => flattenSvg(svg('', '<rect fill="var(--nope)"/>')), /flatten: unknown property --nope/)
  })
  test('color-mix without percentages is the midpoint, rounded', () => {
    assert.equal(fillOf(flattenSvg(svg('', '<rect fill="color-mix(in srgb, #000000, #ffffff)"/>'))), '#808080')
  })
  test('color-mix with one percentage gives the rest to the other operand, wherever the percentage sits', () => {
    assert.equal(fillOf(flattenSvg(svg('', '<rect fill="color-mix(in srgb, #000000 25%, #ffffff)"/>'))), '#bfbfbf')
    assert.equal(fillOf(flattenSvg(svg('', '<rect fill="color-mix(in srgb, #000000, #ffffff 25%)"/>'))), '#404040')
  })
  test('color-mix with two percentages that sum to 100 mixes by them', () => {
    assert.equal(fillOf(flattenSvg(svg('', '<rect fill="color-mix(in srgb, #ff0000 100%, #0000ff 0%)"/>'))), '#ff0000')
  })
  test('color-mix accepts three-digit hex', () => {
    assert.equal(fillOf(flattenSvg(svg('', '<rect fill="color-mix(in srgb, #000, #fff)"/>'))), '#808080')
  })
  test('nested color-mix and var() resolve inner to outer', () => {
    const out = flattenSvg(svg('svg{--fg:#000000;--bg:#ffffff}', '<rect fill="color-mix(in srgb, color-mix(in srgb, var(--fg) 100%, var(--bg) 0%) 50%, var(--bg))"/>'))
    assert.equal(fillOf(out), '#808080')
  })
  for (const [name, fill, message] of [
    ['a colour space other than srgb', 'color-mix(in oklch, #000000, #ffffff)', /flatten: color-mix in oklch is not supported/],
    ['a colour name instead of hex', 'color-mix(in srgb, red, #ffffff)', /flatten: unsupported colour red/],
    ['percentages that do not sum to 100', 'color-mix(in srgb, #000000 30%, #ffffff 30%)', /sum to 100/],
    ['a percentage over 100', 'color-mix(in srgb, #000000 120%, #ffffff)', /out of range/],
    ['one operand only', 'color-mix(in srgb, #000000)', /needs a colour space and exactly two colours/],
    ['unbalanced parentheses', 'color-mix(in srgb, #000000, #ffffff', /unbalanced/],
    ['a custom property name that is not one', 'var(fill)', /bad custom property/],
  ]) test(`throws for ${name}`, () => assert.throws(() => flattenSvg(svg('', `<rect fill="${fill}"/>`)), message))

  test('a property that refers to itself throws on depth, it does not loop', () => {
    assert.throws(() => flattenSvg(svg('svg{--a:var(--a)}', '<rect fill="var(--a)"/>')), /flatten: custom property depth/)
  })
  test('the style block becomes one font rule, right after the svg element; @import is gone', () => {
    const out = flattenSvg(svg("@import url('https://example.test/x.css'); svg{--a:#111111}", '<rect fill="var(--a)"/>'))
    assert.equal((out.match(/<style/g) ?? []).length, 1)
    assert.match(out, /<svg[^>]*>\n<style>text \{ font-family: Inter \}<\/style><rect/)
    assert.doesNotMatch(out, /@import|var\(|color-mix\(/)
  })
  test('text with no svg element throws', () => {
    assert.throws(() => flattenSvg('<g/>'), /flatten: no <svg> element/)
  })
})
