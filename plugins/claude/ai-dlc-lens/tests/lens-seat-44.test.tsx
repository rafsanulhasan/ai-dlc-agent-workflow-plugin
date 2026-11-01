import { describe, expect, test } from 'claude-code/testing'
import { CHART, PLUGIN, RUNS, band, engine, fire, fireInDraw, has, idsOf, lensCmd, noRefusals, pane, texts } from './lens-kit-44'
import type { Kit } from './lens-kit-44'

// Step 44, phase B and rounds 4 to 6 (44-live-findings-2.human.md to -4): the lens follows the seat the surface gives its
// panes (R44.9, R44.10, R44.12, R44.14, R44.15), the mode button (R44.16) and the race that refused its writes (R44.17,
// R44.18). The engine is the shared kit (lens-kit-44.tsx): every timer, 0 ms included, waits for the test, which can fire
// it while a draw is in progress, as the host can.

const HEAVY = { timeoutMs: 20000 }
const runsOpened = (kit: Kit) => kit.openArgs.filter(x => x.id === RUNS)
const runsClosed = (kit: Kit) => kit.closed.filter(x => x === RUNS)
/** The view's place as the pane's mode button shows it (`pinned` by default, the `workflowPlace` setting). */
const placeOf = async ($: any, kit: Kit, placement: 'dock' | 'inline', surface = 'vscode'): Promise<string> => {
  const ui = await pane($, CHART, placement, kit, { surface }) // at the seat in force, so reading it changes no seat
  const offered = String(((await ui.find({ type: 'Button', key: 'pane-place' })) as any)?.text)
  await ui.unmount()
  return offered
}
/** Draws a lens pane at `seat`, lets its deferred acts run, and drops it. */
const seat = async ($: any, kit: Kit, placement: 'dock' | 'inline', o: { surface?: string; bodyColumns?: number } = {}) => {
  const ui = await pane($, CHART, placement, kit, o)
  await fire(kit)
  await ui.unmount()
}

describe('[R44.9] [R44.10] the lens follows its seat: inline, the Run List tab is closed', () => {
  test('dock, then inline: the Run List tab is closed once, after the inline render', HEAVY, async ($, on) => {
    const kit = await engine($, on)
    await seat($, kit, 'dock')
    expect(runsClosed(kit)).toEqual([])
    await seat($, kit, 'inline')
    expect(runsClosed(kit)).toEqual([RUNS])
  })

  test('inline twice: one close only', HEAVY, async ($, on) => {
    const kit = await engine($, on)
    await seat($, kit, 'inline')
    await seat($, kit, 'inline')
    expect(runsClosed(kit)).toEqual([RUNS])
  })

  test('dock: no close', HEAVY, async ($, on) => {
    const kit = await engine($, on)
    await seat($, kit, 'dock')
    await seat($, kit, 'dock')
    expect(runsClosed(kit)).toEqual([])
  })
})

describe('[R44.12] [R44.14] docked again after being inline: the Run List tab opens unasked, in tab mode only', () => {
  test('tab mode, VS Code: inline, then dock: one Run List open, with no focus', HEAVY, async ($, on) => {
    const kit = await engine($, on)
    await seat($, kit, 'inline')
    await seat($, kit, 'dock')
    expect(runsOpened(kit)).toEqual([expect.objectContaining({ id: RUNS })])
    expect(runsOpened(kit)[0].focus).toBeUndefined()
  })

  test('dock twice: one open; dock first, with no inline before: none', HEAVY, async ($, on) => {
    const kit = await engine($, on)
    await seat($, kit, 'dock')
    expect(runsOpened(kit)).toEqual([])
    await seat($, kit, 'inline')
    await seat($, kit, 'dock')
    await seat($, kit, 'dock')
    expect(runsOpened(kit).length).toBe(1)
  })

  test('on a terminal: inline, then dock opens nothing', HEAVY, async ($, on) => {
    const kit = await engine($, on, { surface: 'terminal' })
    await seat($, kit, 'inline', { surface: 'terminal' })
    await seat($, kit, 'dock', { surface: 'terminal' })
    expect(runsOpened(kit)).toEqual([])
  })

  test('drill-in mode: inline, then dock opens no Run List tab', HEAVY, async ($, on) => {
    const kit = await engine($, on, { files: { '.ai-dlc/lens.json': JSON.stringify({ panelOpenMode: 'drill-in' }) } })
    await seat($, kit, 'inline')
    await seat($, kit, 'dock')
    expect(runsOpened(kit)).toEqual([])
  })

  test('the command, wide and docked: tab mode opens the Run List tab, then the workflow tab with focus', HEAVY, async ($, on) => {
    const kit = await engine($, on)
    await seat($, kit, 'dock', { bodyColumns: 150 })
    const before = kit.openArgs.length
    await lensCmd($)
    const opens = kit.openArgs.slice(before)
    expect(idsOf(opens)).toEqual([RUNS, CHART])
    expect(opens[0].focus).toBeUndefined()
    expect(opens[1].focus).toBe(true)
  })

  test('the command, wide and docked: drill-in opens the workflow tab only and closes an open Run List tab', HEAVY, async ($, on) => {
    const kit = await engine($, on, { files: { '.ai-dlc/lens.json': JSON.stringify({ panelOpenMode: 'drill-in' }) } })
    await seat($, kit, 'dock', { bodyColumns: 150 })
    const before = kit.openArgs.length
    await lensCmd($)
    expect(idsOf(kit.openArgs.slice(before))).toEqual([CHART])
    expect(kit.closed).toContain(RUNS)
  })
})

describe('[R44.15] in VS Code every change of seat writes the view\'s place', () => {
  test('inline pins the view, dock docks it', HEAVY, async ($, on) => {
    const kit = await engine($, on)
    await seat($, kit, 'dock')
    expect(await placeOf($, kit, 'dock')).toBe('docked') // the default place is pinned
    await seat($, kit, 'inline')
    expect(await placeOf($, kit, 'inline')).toBe('pinned')
    await seat($, kit, 'dock')
    expect(await placeOf($, kit, 'dock')).toBe('docked')
  })

  test('on a terminal the seat leaves the place alone', HEAVY, async ($, on) => {
    const kit = await engine($, on, { surface: 'terminal' })
    const before = await placeOf($, kit, 'inline', 'terminal')
    await fire(kit)
    await seat($, kit, 'inline', { surface: 'terminal' })
    expect(await placeOf($, kit, 'inline', 'terminal')).toBe(before)
  })

  test('the pinned note is not drawn in VS Code', HEAVY, async ($, on) => {
    const kit = await engine($, on)
    const ui = await pane($, CHART, 'inline', kit)
    expect((await texts(ui)).some(t => /no band above the prompt/.test(t))).toBe(false)
    await ui.unmount()
  })
})

describe('[R44.16] the mode button in VS Code', () => {
  test('a lens pane drawn while the band was chosen clears the choice: the band stops drawing', HEAVY, async ($, on) => {
    const kit = await engine($, on)
    const ui = await pane($, CHART, 'inline', kit)
    await fire(kit)
    await ui.press({ key: 'pane-place' }) // pane to band: the panes close, the band is chosen
    await ui.unmount()
    let b = await band($)
    expect(await has(b, 'pane-place')).toBe(true) // the lens band is drawn above the prompt
    await b.unmount()
    const again = await pane($, CHART, 'inline', kit) // a pane drawn meanwhile (the band's ⤢ opens one)
    await fire(kit)
    await again.unmount()
    b = await band($)
    expect(await has(b, 'pane-place')).toBe(false) // one view only: the band gave way
    await b.unmount()
  })
})

describe('[R44.17] [R44.18] the acts after a render are tried again when the host refuses them', () => {
  test('a refused seat follow is retried and lands once the draw ends: the Run List tab is closed', HEAVY, async ($, on) => {
    const kit = await engine($, on)
    await seat($, kit, 'dock') // the place is docked, so the inline seat has a change to write
    const ui = await pane($, CHART, 'inline', kit)
    await fireInDraw(kit) // the timer fires while another render is dispatched: the place write is refused
    expect(kit.guard.writes).toContain(`${PLUGIN}:view`)
    expect(runsClosed(kit)).toEqual([]) // the act stopped at the refused write, before it closed the Run List tab
    expect(kit.timers.map(t => t.ms)).toEqual([100]) // and asked to be tried again
    await fire(kit) // outside a draw
    expect(runsClosed(kit)).toEqual([RUNS])
    await ui.unmount()
    expect(await placeOf($, kit, 'inline')).toBe('pinned')
  })

  test('a write refused 19 times in a row still lands on the 20th try; refused 20 times it reaches lensFail with the site name', HEAVY, async ($, on) => {
    const kit = await engine($, on)
    const ui = await pane($, CHART, 'inline', kit)
    for (let i = 0; i < 19; i++) await fireInDraw(kit)
    expect(kit.timers.length).toBe(1) // still asking again
    await fire(kit)
    expect(runsClosed(kit)).toEqual([RUNS])
    expect((await texts(ui)).some(t => /lens hook error: seat follow/.test(t))).toBe(false)
    await ui.unmount()
  })

  test('refused 20 times: the error names the site and the refusal', HEAVY, async ($, on) => {
    const kit = await engine($, on)
    const ui = await pane($, CHART, 'inline', kit)
    for (let i = 0; i < 20; i++) await fireInDraw(kit)
    expect(kit.timers).toEqual([]) // no 21st try
    await ui.unmount()
    const again = await pane($, CHART, 'inline', kit)
    expect((await texts(again)).some(t => /lens hook error: seat follow: .*ui\.render is being dispatched/.test(t))).toBe(true)
    await again.unmount()
  })

  test('[R44.18] narrow, then widened with the first write refused: the docked pane still gets the workflow layout, not the minimised list', HEAVY, async ($, on) => {
    const kit = await engine($, on)
    await seat($, kit, 'inline', { bodyColumns: 43 })
    await lensCmd($) // narrow: the command leaves the minimised list
    const wide = await pane($, CHART, 'dock', kit, { bodyColumns: 150 })
    await fireInDraw(kit) // the place write is refused: the whole act stops
    await fire(kit) // tried again
    expect(runsOpened(kit).length).toBe(1) // the act ran to its end: the Run List tab was opened
    await wide.unmount()
    const docked = await pane($, CHART, 'dock', kit, { bodyColumns: 150 })
    const charts = ((await docked.findAll({ type: 'Svg' })) as any[]).filter(x => /^Step chart/.test(String(x?.props?.alt ?? '')))
    expect(charts.length).toBeGreaterThan(0)
    await docked.unmount()
  })

  test('the writes the tests above provoke are the only refusals: an ordinary draw and fire provoke none', HEAVY, async ($, on) => {
    const kit = await engine($, on)
    await seat($, kit, 'inline')
    await seat($, kit, 'dock')
    noRefusals(kit)
  })
})

// Step 44 (G4 round): one hand-over from the band to a pane at a time (`bandGivingWay`); the flag stays set while
// `afterRender` retries a refused hand-over and is cleared once it succeeded or was given up.
describe('[R44.16] [R44.17] the band gives way to a pane once at a time', () => {
  const wait40 = () => new Promise(r => (globalThis as any).setTimeout(r, 40))
  /** The band chosen with the mode button on a mounted inline pane: its re-render starts the hand-over (a 0 ms timer, held). */
  const bandChosen = async ($: any, kit: Kit) => {
    const ui = await pane($, CHART, 'inline', kit)
    await fire(kit)
    await ui.press({ key: 'pane-place' })
    await wait40()
    return ui
  }
  /** How many hand-overs (0 ms timers) one more render of an inline pane queues. */
  const queuedBy = async ($: any, kit: Kit) => {
    const before = kit.timers.filter(t => t.ms === 0).length
    const ui = await pane($, CHART, 'inline', kit)
    await wait40()
    const n = kit.timers.filter(t => t.ms === 0).length - before
    await ui.unmount()
    return n
  }
  const bandDrawn = async ($: any) => {
    const b = await band($)
    const yes = await has(b, 'pane-place')
    await b.unmount()
    return yes
  }

  test('while a refused hand-over is being retried, further renders ask for no second hand-over; it lands once and the band gives way', HEAVY, async ($, on) => {
    const kit = await engine($, on)
    const ui = await bandChosen($, kit)
    await ui.unmount()
    expect(await queuedBy($, kit)).toBe(0) // a hand-over is under way: the next renders ask for none
    await fireInDraw(kit) // refused: the retry is queued
    expect(kit.timers.some(t => t.ms === 100)).toBe(true)
    expect(await queuedBy($, kit)).toBe(0) // still none, between the retries
    await fire(kit) // outside a draw: it lands
    expect(await bandDrawn($)).toBe(false) // the band gave way
  })

  test('after the hand-over landed, choosing the band again starts a new hand-over', HEAVY, async ($, on) => {
    const kit = await engine($, on)
    const ui = await bandChosen($, kit)
    await fire(kit) // lands: the flag is cleared
    await fire(kit)
    await ui.press({ key: 'pane-place' }) // the band chosen again
    await wait40()
    expect(await bandDrawn($)).toBe(true) // chosen
    await ui.unmount()
    await fire(kit) // the new hand-over runs
    await fire(kit)
    expect(await bandDrawn($)).toBe(false) // and the band gave way again
  })

  test('after the hand-over was given up (refused 20 times), the next render asks for a new one', HEAVY, async ($, on) => {
    const kit = await engine($, on)
    const ui = await bandChosen($, kit)
    await ui.unmount()
    for (let i = 0; i < 25; i++) await fireInDraw(kit)
    expect(kit.timers).toEqual([]) // given up: no 26th try
    expect(await queuedBy($, kit)).toBeGreaterThan(0) // the band is still chosen (the writes never landed), the flag is clear
  })
})
