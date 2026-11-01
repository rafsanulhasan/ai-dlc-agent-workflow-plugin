import { describe, expect, test } from 'claude-code/testing'
import { CHART, RUNS, band, engine, fire, has, lensCmd, pane } from './lens-kit-44'
import type { Kit } from './lens-kit-44'

// Step 44, G4 decisions 6 and 7 (R44.23, R44.21): the lens in a terminal or desktop session with the VS Code panel
// attached. The command, the restore from full screen, the mode button (by the surface it was pressed on) and the seat
// of the command's pane. The engine is the shared kit (lens-kit-44.tsx): `surfaces` is what the session lists, its first
// entry being the session's own surface.

const HEAVY = { timeoutMs: 20000 }
const opened = (kit: Kit, id: string) => kit.openArgs.filter(x => x.id === id)
const MINIMISED = 'shown minimised'
/** Whether a lens band render on `surface` draws the lens band. */
const bandDrawn = async ($: any, surface: string): Promise<boolean> => {
  const b = await band($, surface)
  const yes = await has(b, 'pane-place')
  await b.unmount()
  return yes
}
/** The mode button's label on a lens pane drawn on `surface` (the place it reads), at `placement`. */
const placeRead = async ($: any, kit: Kit, surface: string, placement: 'dock' | 'inline' = 'dock'): Promise<string> => {
  const ui = await pane($, CHART, placement, kit, { surface })
  const label = String(((await ui.find({ type: 'Button', key: 'pane-place' })) as any)?.text)
  await ui.unmount()
  return label
}

describe('[R44.23] /ai-dlc:lens while pinned, by the surfaces the session lists', () => {
  for (const surfaces of [['terminal'], ['desktop'], ['terminal', 'desktop'], ['terminal', 'mobile']])
    test(`surfaces ${JSON.stringify(surfaces)}: the band alone, shown minimised, no pane`, HEAVY, async ($, on) => {
      const kit = await engine($, on, { surface: surfaces[0] as any, surfaces })
      const before = opened(kit, CHART).length // the first spawn opened the pane already
      const reply = await lensCmd($)
      expect(reply).toContain(MINIMISED)
      expect(opened(kit, CHART).length).toBe(before)
    })

  for (const surfaces of [['terminal', 'vscode'], ['desktop', 'vscode']])
    test(`surfaces ${JSON.stringify(surfaces)}: the pane opens for the VS Code panel; the ${surfaces[0]} still draws its band, VS Code draws none`, HEAVY, async ($, on) => {
      const kit = await engine($, on, { surface: surfaces[0] as any, surfaces })
      const before = opened(kit, CHART).length
      const reply = await lensCmd($)
      expect(reply).not.toContain(MINIMISED)
      expect(opened(kit, CHART).length).toBeGreaterThan(before)
      expect(await bandDrawn($, surfaces[0]!)).toBe(true) // R44.21
      expect(await bandDrawn($, 'vscode')).toBe(false)
    })

  for (const surfaces of [['terminal', 'vscode'], ['desktop', 'vscode']])
    test(`surfaces ${JSON.stringify(surfaces)} with the lens moved into the VS Code band: band only, no pane, both renders draw the band`, HEAVY, async ($, on) => {
      const kit = await engine($, on, { surface: surfaces[0] as any, surfaces })
      kit.seed('vscodeBand', true)
      const before = opened(kit, CHART).length
      const reply = await lensCmd($)
      expect(reply).toContain(MINIMISED)
      expect(opened(kit, CHART).length).toBe(before)
      expect(await bandDrawn($, surfaces[0]!)).toBe(true)
      expect(await bandDrawn($, 'vscode')).toBe(true)
    })

  for (const surfaces of [['vscode'], ['vscode', 'desktop'], [] as string[]])
    test(`surfaces ${JSON.stringify(surfaces)}: as before, the pane opens (the band was not chosen)`, HEAVY, async ($, on) => {
      const kit = await engine($, on, { surface: 'vscode', surfaces })
      const before = opened(kit, CHART).length
      const reply = await lensCmd($)
      expect(reply).not.toContain(MINIMISED)
      expect(opened(kit, CHART).length).toBeGreaterThan(before)
    })
})

describe('[R44.23] the restore from full screen follows the same rule (showView, changeView)', () => {
  /** A pinned view taken to full screen by the step's ⤢ on a docked pane, then restored by the pane's ⤡. */
  const restoreFromFull = async ($: any, kit: Kit, surface: string) => {
    const ui = await pane($, CHART, 'dock', kit, { surface })
    await fire(kit)
    if (await has(ui, 'wf-toolu_1')) await ui.press({ key: 'wf-toolu_1' }) // the run's workflow view
    await ui.press({ key: 'nr:s17:step-full' })
    await ui.press({ key: 'pane-full' }) // ⤡: restore
    await ui.unmount()
  }
  test('surfaces ["terminal","vscode"]: restoring a pinned view keeps the pane open', HEAVY, async ($, on) => {
    const kit = await engine($, on, { surface: 'terminal', surfaces: ['terminal', 'vscode'] })
    await restoreFromFull($, kit, 'terminal')
    expect(kit.closed).not.toContain(CHART)
    expect(kit.openNow.has(CHART)).toBe(true)
  })
  test('surfaces ["terminal"]: restoring a pinned view closes the pane (the band alone)', HEAVY, async ($, on) => {
    const kit = await engine($, on, { surface: 'terminal', surfaces: ['terminal'] })
    await restoreFromFull($, kit, 'terminal')
    expect(kit.closed).toContain(CHART)
    expect(kit.openNow.has(CHART)).toBe(false)
  })
})

describe('[R44.16] [R44.23] the mode button follows the surface it was pressed on', () => {
  const BOTH = { surface: 'terminal', surfaces: ['terminal', 'vscode'] } as const
  test('pressed in VS Code, in the pane: both lens panes close and VS Code draws the band', HEAVY, async ($, on) => {
    const kit = await engine($, on, BOTH as any)
    const ui = await pane($, CHART, 'inline', kit, { surface: 'vscode' })
    await fire(kit)
    await ui.press({ key: 'pane-place', surface: 'vscode' } as any)
    await ui.unmount()
    expect(kit.closed).toEqual(expect.arrayContaining([RUNS, CHART]))
    expect(await bandDrawn($, 'vscode')).toBe(true) // vscodeBandA is on
    expect(await bandDrawn($, 'terminal')).toBe(true)
  })

  test('pressed in VS Code, on the band: the band gives way and the pane opens (docked)', HEAVY, async ($, on) => {
    const kit = await engine($, on, BOTH as any)
    kit.seed('vscodeBand', true)
    expect(await bandDrawn($, 'vscode')).toBe(true)
    const b = await band($, 'vscode')
    const before = opened(kit, CHART).length
    await b.press({ key: 'pane-place', surface: 'vscode' } as any)
    await b.unmount()
    expect(opened(kit, CHART).length).toBeGreaterThan(before)
    expect(await bandDrawn($, 'vscode')).toBe(false) // vscodeBandA is off again
  })

  test('pressed on the terminal: the place toggles, VS Code\'s band choice is untouched and the pane stays open', HEAVY, async ($, on) => {
    const kit = await engine($, on, BOTH as any)
    const ui = await pane($, CHART, 'dock', kit, { surface: 'terminal' })
    await fire(kit)
    const before = String(((await ui.find({ type: 'Button', key: 'pane-place' })) as any)?.text)
    await ui.press({ key: 'pane-place', surface: 'terminal' } as any)
    await ui.unmount()
    const after = await placeRead($, kit, 'terminal')
    expect(after).not.toBe(before) // pinned <-> docked
    expect(kit.closed).not.toContain(CHART) // VS Code is attached: the pane stays
    expect(kit.closed).not.toContain(RUNS)
    expect(await bandDrawn($, 'vscode')).toBe(false) // vscodeBandA untouched
  })

  // The harness fills a press's surface from the pane it presses on, so a press with no argument at all (the fallback to the
  // session's own surface) cannot be made; this is the same rule with the surface left to the harness.
  test('a terminal pane press, no surface named: a terminal session toggles the place', HEAVY, async ($, on) => {
    const kit = await engine($, on, BOTH as any)
    const ui = await pane($, CHART, 'dock', kit, { surface: 'terminal' })
    await fire(kit)
    const before = String(((await ui.find({ type: 'Button', key: 'pane-place' })) as any)?.text)
    await ui.press({ key: 'pane-place' })
    await ui.unmount()
    expect(await placeRead($, kit, 'terminal')).not.toBe(before)
    expect(await bandDrawn($, 'vscode')).toBe(false)
  })

  test('a VS Code session: a press from desktop takes the VS Code path, as the own surface is VS Code', HEAVY, async ($, on) => {
    const kit = await engine($, on, { surface: 'vscode', surfaces: ['vscode', 'desktop'] })
    const ui = await pane($, CHART, 'dock', kit, { surface: 'desktop' }) // a desktop panel's pane
    await fire(kit)
    await ui.press({ key: 'pane-place' })
    await ui.unmount()
    expect(kit.closed).toEqual(expect.arrayContaining([RUNS, CHART]))
    expect(await bandDrawn($, 'vscode')).toBe(true)
  })
})

describe('[R44.23] the command\'s pane seat', () => {
  test('surfaces ["terminal","vscode"]: seat dock, no Run List tab (the VS Code seat rules are for a VS Code session)', HEAVY, async ($, on) => {
    const kit = await engine($, on, { surface: 'terminal', surfaces: ['terminal', 'vscode'], files: { '.ai-dlc/lens.json': JSON.stringify({ panelOpenMode: 'tab' }) } })
    await lensCmd($)
    expect(opened(kit, CHART).length).toBeGreaterThan(0)
    expect(opened(kit, RUNS)).toEqual([])
    // seat dock: the pane shows the workflow view on the newest run, not the minimised list an inline seat gives
    const ui = await pane($, CHART, 'dock', kit, { surface: 'terminal' })
    expect(await has(ui, 'runs-back')).toBe(true)
    await ui.unmount()
  })
  test('surfaces ["vscode"], a wide docked pane drawn first, tab mode: the VS Code seat rule opens the Run List tab', HEAVY, async ($, on) => {
    const kit = await engine($, on, { surface: 'vscode', surfaces: ['vscode'], files: { '.ai-dlc/lens.json': JSON.stringify({ panelOpenMode: 'tab' }) } })
    const wide = await pane($, CHART, 'dock', kit, { bodyColumns: 150 })
    await fire(kit)
    await wide.unmount()
    await lensCmd($)
    expect(opened(kit, RUNS).length).toBeGreaterThan(0)
  })
})
