import { describe, expect, test } from 'claude-code/testing'
import { CHART, band, engine, fire, has, lensCmd, pane, spawn } from './lens-kit-44'
import type { Kit } from './lens-kit-44'

// Step 44, the human's G4 decisions 10 (AC-12.30) and AC-12.29 (e). Decision 10: when the person closes the lens pane or
// the band by hand, or the host leaves the pane undrawn, the lens reopens nothing by its own acts that follow. The engine is
// the shared kit (lens-kit-44.tsx).

const HEAVY = { timeoutMs: 20000 }
const BOTH = { surface: 'terminal', surfaces: ['terminal', 'vscode'] } as const
const chartOpens = (kit: Kit) => kit.openArgs.filter(x => x.id === CHART).length
const bandDrawn = async ($: any, surface: string): Promise<boolean> => {
  const b = await band($, surface)
  const yes = await has(b, 'pane-place')
  await b.unmount()
  return yes
}
/** The lens's own acts that follow in a session: timers firing, another agent spawned, a turn ending, a pane drawn. */
const acts = async ($: any, kit: Kit) => {
  await fire(kit)
  await spawn($, 2, 'R', '18')
  await fire(kit)
  await $.turn.complete({ reason: 'answer', answer: 'done', durationMs: 1, isAborted: false, turnId: 't', agentId: 'a2' })
  await fire(kit)
}

describe('[AC-12.30] decision 10: the lens reopens nothing the person closed', () => {
  test('the person closes the lens pane by hand: the acts that follow do not open it again', HEAVY, async ($, on) => {
    const kit = await engine($, on, BOTH as any)
    await lensCmd($) // the pane is open
    expect(chartOpens(kit)).toBeGreaterThan(0)
    const ui = await pane($, CHART, 'dock', kit, { surface: 'terminal' })
    await fire(kit)
    await ui.press({ key: 'pane-close' }) // the person's ×
    await ui.unmount()
    expect(kit.openNow.has(CHART)).toBe(false)
    const opens = chartOpens(kit)
    await acts($, kit)
    expect(chartOpens(kit)).toBe(opens)
    expect(kit.openNow.has(CHART)).toBe(false)
  })

  test('the host leaves the pane undrawn (isPlaced: false): the lens does not try again by itself', HEAVY, async ($, on) => {
    const kit = await engine($, on, { ...BOTH, unplaced: true } as any)
    const reply = await lensCmd($)
    expect(reply).toContain('not drawn yet')
    const opens = chartOpens(kit)
    await acts($, kit)
    expect(chartOpens(kit)).toBe(opens)
  })

  test('the lens moved into the VS Code band and the person closed the band with ×: the acts that follow (not a new spawn) restore no band and open no pane', HEAVY, async ($, on) => {
    const kit = await engine($, on, BOTH as any)
    kit.seed('vscodeBand', true)
    await $.turn.complete({ reason: 'answer', answer: 'done', durationMs: 1, isAborted: false, turnId: 't0', agentId: 'a1' }) // the run is idle: the band has its ×
    await fire(kit)
    const b = await band($, 'vscode')
    expect(await has(b, 'band-close')).toBe(true)
    await b.press({ key: 'band-close' })
    await b.unmount()
    expect(await bandDrawn($, 'vscode')).toBe(false)
    const opens = chartOpens(kit)
    await fire(kit)
    await $.turn.complete({ reason: 'answer', answer: 'again', durationMs: 1, isAborted: false, turnId: 't1', agentId: 'a1' })
    await fire(kit)
    expect(await bandDrawn($, 'vscode')).toBe(false) // nothing restored it
    expect(chartOpens(kit)).toBe(opens) // and no pane opened for the VS Code panel
  })
})

describe('[AC-12.29] (e) the session\'s own surface is unknown ([]): a press that is not from VS Code takes the VS Code path', () => {
  for (const surface of ['terminal', 'desktop'])
    test(`a ${surface} press: the lens pane closes, the VS Code band is chosen`, HEAVY, async ($, on) => {
      const kit = await engine($, on, { surface: 'vscode', surfaces: [] })
      const ui = await pane($, CHART, 'dock', kit, { surface })
      await fire(kit)
      await ui.press({ key: 'pane-place' })
      await ui.unmount()
      expect(kit.closed).toContain(CHART) // not a toggle of the place: the VS Code path
      expect(await bandDrawn($, 'vscode')).toBe(true)
    })
})
