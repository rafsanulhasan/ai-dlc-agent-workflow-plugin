// The renderer's scrubSvg (renderer/scrub.mjs) against the one case table both copies share with
// hooks/diagram.ts (plugins/claude/ai-dlc-lens/tests/fixtures/scrub-cases.mjs; the other half is
// plugins/claude/ai-dlc-lens/tests/diagram.test.ts). AC-20.5.4, the PNG half.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { scrubSvg } from '../../plugins/claude/ai-dlc-lens/renderer/scrub.mjs'

import { cases } from '../../plugins/claude/ai-dlc-lens/tests/fixtures/scrub-cases.mjs'

describe('renderer/scrub.mjs: the shared case table', () => {
  test('the table has the cases the reviewers asked for', () => {
    assert.ok(cases.length >= 24)
    for (const c of cases) assert.ok(c.name && typeof c.input === 'string' && typeof c.output === 'string', c.name)
  })
  for (const c of cases) test(c.name, () => assert.equal(scrubSvg(c.input), c.output))
})

describe('renderer/scrub.mjs: properties', () => {
  test('scrubbing twice changes nothing (idempotent) on every case', () => {
    for (const c of cases) assert.equal(scrubSvg(c.output), c.output, c.name)
  })
  test('nothing the table lists as removed survives: no http(s) link, no javascript:, no handler, no @import', () => {
    for (const c of cases) {
      const out = scrubSvg(c.input)
      assert.doesNotMatch(out, /\son\w+\s*=/i, c.name)
      assert.doesNotMatch(out, /javascript:/i, c.name)
      assert.doesNotMatch(out, /@import/i, c.name)
      assert.doesNotMatch(out, /(?:href|src)\s*=\s*["']?https?:/i, c.name)
    }
  })
})
