import { describe, expect, test } from 'claude-code/testing'
import { CHART, RUNS, band, engine, fire, has, lensCmd, pane } from './lens-kit-44'
import type { Kit } from './lens-kit-44'

// Step 44, the human's G4 decision 9 (Q44-C): only a lens pane render whose own surface is VS Code drives the seat: the
// place, the seat memory (`paneSeat`, which `/ai-dlc:lens` reads), the band's hand-over and the Run List tab. A terminal or
// desktop render of the same pane changes none of them. The engine is the shared kit (lens-kit-44.tsx).

const HEAVY = { timeoutMs: 20000 }
const AGENT = 'ai-dlc-lens-agent'
const EDGE = 'ai-dlc-lens-edge'
const DOCKED = JSON.stringify({ panelOpenMode: 'tab', workflowPlace: 'docked' })
const TAB = JSON.stringify({ panelOpenMode: 'tab' })
const runsClosed = (kit: Kit) => kit.closed.filter(x => x === RUNS).length
const runsOpened = (kit: Kit) => kit.openArgs.filter(x => x.id === RUNS).length
/** Draws a lens pane at `placement` on `surface`, lets its deferred acts run, and returns the mode button's label it read. */
const draw = async ($: any, kit: Kit, surface: string, placement: 'dock' | 'inline', o: { id?: string; bodyColumns?: number } = {}): Promise<string> => {
  const ui = await pane($, o.id ?? CHART, placement, kit, { surface, ...(o.bodyColumns !== undefined ? { bodyColumns: o.bodyColumns } : {}) })
  const label = String(((await ui.find({ type: 'Button', key: 'pane-place' })) as any)?.text)
  await fire(kit)
  await ui.unmount()
  return label
}
const bandDrawn = async ($: any, surface: string): Promise<boolean> => {
  const b = await band($, surface)
  const yes = await has(b, 'pane-place')
  await b.unmount()
  return yes
}

describe('[R44.23] decision 9: a terminal or desktop render of the pane never moves the seat', () => {
  for (const surface of ['terminal', 'desktop'])
    test(`a ${surface}-only session: inline then dock renders leave the place and the Run List tab alone`, HEAVY, async ($, on) => {
      const kit = await engine($, on, { surface: surface as any, surfaces: [surface], files: { '.ai-dlc/lens.json': DOCKED } })
      kit.openNow.add(RUNS) // the Run List tab is open
      expect(await draw($, kit, surface, 'inline')).toBe('docked')
      expect(await draw($, kit, surface, 'dock')).toBe('docked') // an inline render did not make it pinned
      expect(await draw($, kit, surface, 'inline')).toBe('docked')
      expect(runsClosed(kit)).toBe(0) // the intended side effect: a terminal session no longer closes the tab inline
      expect(kit.openNow.has(RUNS)).toBe(true)
    })

  test('["terminal","vscode"], docked: the place follows the VS Code seat only, and a terminal dock render never flips it back', HEAVY, async ($, on) => {
    const kit = await engine($, on, { surface: 'terminal', surfaces: ['terminal', 'vscode'], files: { '.ai-dlc/lens.json': DOCKED } })
    await draw($, kit, 'terminal', 'dock')
    await draw($, kit, 'vscode', 'inline') // the first VS Code inline render: pinned, the Run List tab closed
    expect(runsClosed(kit)).toBe(1)
    expect(await draw($, kit, 'terminal', 'dock')).toBe('pinned') // the place is pinned, and the terminal read it so
    expect(await draw($, kit, 'vscode', 'inline')).toBe('pinned') // a terminal dock render did not make it docked again
    expect(await draw($, kit, 'terminal', 'dock')).toBe('pinned')
    expect(await draw($, kit, 'vscode', 'inline')).toBe('pinned')
    expect(runsClosed(kit)).toBe(1) // further VS Code inline renders schedule nothing new
  })
})

describe('[R44.16] [R44.23] decision 9: the band hands over to a VS Code render only', () => {
  test('["terminal","vscode"], the lens in the VS Code band: a terminal render of the pane keeps it, a VS Code render hands over', HEAVY, async ($, on) => {
    const kit = await engine($, on, { surface: 'terminal', surfaces: ['terminal', 'vscode'] })
    kit.seed('vscodeBand', true)
    expect(await bandDrawn($, 'vscode')).toBe(true)
    await draw($, kit, 'terminal', 'inline')
    await draw($, kit, 'terminal', 'dock')
    expect(await bandDrawn($, 'vscode')).toBe(true) // vscodeBandA stays on
    await draw($, kit, 'vscode', 'inline')
    expect(await bandDrawn($, 'vscode')).toBe(false) // as before, a VS Code render hands the band over
  })
})

describe('[R44.14] [R44.23] decision 9: /ai-dlc:lens reads the VS Code seat only', () => {
  const session = (on: any, $: any) => engine($, on, { surface: 'vscode', surfaces: ['vscode', 'desktop'], files: { '.ai-dlc/lens.json': TAB } })
  test('a wide VS Code render, then a desktop inline render: the command lays out the wide seat (the Run List tab)', HEAVY, async ($, on) => {
    const kit = await session(on, $)
    await draw($, kit, 'vscode', 'dock', { bodyColumns: 150 })
    await draw($, kit, 'desktop', 'inline')
    const before = runsOpened(kit)
    await lensCmd($)
    expect(runsOpened(kit)).toBeGreaterThan(before)
  })
  test('the reverse order gives the same result', HEAVY, async ($, on) => {
    const kit = await session(on, $)
    await draw($, kit, 'desktop', 'inline')
    await draw($, kit, 'vscode', 'dock', { bodyColumns: 150 })
    const before = runsOpened(kit)
    await lensCmd($)
    expect(runsOpened(kit)).toBeGreaterThan(before)
  })
  test('a VS Code inline render alone gives the narrow seat: exactly one pane, no Run List tab', HEAVY, async ($, on) => {
    const kit = await session(on, $)
    await draw($, kit, 'vscode', 'inline')
    const before = runsOpened(kit)
    await lensCmd($)
    expect(runsOpened(kit)).toBe(before)
  })
  for (const id of [RUNS, AGENT, EDGE])
    test(`a desktop render of the ${id.replace('ai-dlc-lens-', '').replace('ai-dlc-lens', 'chart')} pane leaves the seat memory alone: after a wide VS Code render the command still lays out the wide seat`, HEAVY, async ($, on) => {
      const kit = await session(on, $)
      await draw($, kit, 'vscode', 'dock', { bodyColumns: 150 })
      await draw($, kit, 'desktop', 'inline', { id, bodyColumns: 40 })
      const before = runsOpened(kit)
      await lensCmd($)
      expect(runsOpened(kit)).toBeGreaterThan(before)
    })
})
