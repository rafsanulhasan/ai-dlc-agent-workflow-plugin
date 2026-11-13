import { describe, expect, test } from 'claude-code/testing'
import { CHART, PLUGIN, RUNS, engine, fire, has, lensCmd, pane, texts } from './lens-kit-44'
import type { Kit } from './lens-kit-44'

// Step 44, round 7 (AC-12.24 to AC-12.26; R44.19, R44.20): on widening, the workflow view and its flowchart in both panel
// types and the Run List tab in Tab mode only; in VS Code a step's flowchart is drawn only in the docked pane, above the
// prompt an open step says so and its full-screen control is dim, except on a band in a wide panel. Terminal and desktop
// are unchanged. The engine is the shared kit (lens-kit-44.tsx).

const HEAVY = { timeoutMs: 20000 }
const LINE = 'Widen the Claude panel to see the flowchart in the right panel.'
const charts = async (ui: any): Promise<string[]> => ((await ui.findAll({ type: 'Svg' })) as any[]).map((x: any) => String(x?.props?.alt ?? '')).filter(a => /^Step chart/.test(a))
const stepFull = async (ui: any) => ((await ui.findAll({ type: 'Button' })) as any[]).some((b: any) => /step-full$/.test(String(b.key)))
const hasLine = async (ui: any) => (await texts(ui)).some(t => t.includes(LINE))
const dimFull = async (ui: any) => (await texts(ui)).includes('⤢')
const bandAt = ($: any, full: boolean, surface = 'vscode') =>
  $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 40, bodyColumns: 60, scroll: { offset: 0, bodyRows: 40 }, view: {} }, viewport: { columns: 200, rows: 50, isFullscreen: full } } as any)
/** VS Code: the lens pinned to the band (the mode button on an inline pane), the band opened on the run's workflow view. */
const bandOnStep = async ($: any, kit: Kit, full: boolean) => {
  const p = await pane($, CHART, 'inline', kit)
  await fire(kit)
  await p.press({ key: 'pane-place' })
  await p.unmount()
  const b = await bandAt($, full)
  if (await has(b, 'pane-min')) await b.press({ key: 'pane-min' }) // restored
  if (await has(b, 'wf-toolu_1')) await b.press({ key: 'wf-toolu_1' }) // the run's workflow view
  return b
}

describe('[R44.20] [AC-12.25] in VS Code a step\'s flowchart is drawn only in the docked pane', () => {
  test('an inline pane: no chart, the line instead, and the ⤢ is dim text, not a Button', HEAVY, async ($, on) => {
    const kit = await engine($, on)
    const ui = await pane($, CHART, 'inline', kit)
    await fire(kit)
    expect(await charts(ui)).toEqual([])
    expect(await hasLine(ui)).toBe(true)
    expect(await stepFull(ui)).toBe(false)
    expect(await dimFull(ui)).toBe(true)
    expect(await has(ui, 'nr:s17:step-stop')).toBe(true) // the heading's other controls stay
    expect(await has(ui, 'nr:s17:step-min')).toBe(true)
    await ui.unmount()
  })

  test('the docked pane: the chart, no line, and the ⤢ is a Button', HEAVY, async ($, on) => {
    const kit = await engine($, on)
    const ui = await pane($, CHART, 'dock', kit)
    await fire(kit)
    expect((await charts(ui)).length).toBe(1)
    expect(await hasLine(ui)).toBe(false)
    expect(await stepFull(ui)).toBe(true)
    expect(await dimFull(ui)).toBe(false)
    await ui.unmount()
  })

  test('the band in a narrow panel: as the inline pane', HEAVY, async ($, on) => {
    const kit = await engine($, on)
    const b = await bandOnStep($, kit, false)
    expect(await charts(b)).toEqual([])
    expect(await hasLine(b)).toBe(true)
    expect(await stepFull(b)).toBe(false)
    expect(await dimFull(b)).toBe(true)
    await b.unmount()
  })

  test('the band in a wide panel: still no chart and the line, but the ⤢ is a Button and opens the right pane on that step', HEAVY, async ($, on) => {
    const kit = await engine($, on)
    const b = await bandOnStep($, kit, true)
    expect(await charts(b)).toEqual([])
    expect(await hasLine(b)).toBe(true)
    expect(await stepFull(b)).toBe(true)
    const before = kit.openArgs.length
    await b.press({ key: 'nr:s17:step-full' })
    expect(kit.openArgs.slice(before).map((x: any) => x.id)).toContain(CHART)
    await b.unmount()
  })

  test('a terminal band is unchanged: no "widen" line and a ⤢ Button (a terminal draws its chart as text, not an Svg)', HEAVY, async ($, on) => {
    const kit = await engine($, on, { surface: 'terminal' })
    const b = await bandAt($, false, 'terminal')
    if (await has(b, 'pane-min')) await b.press({ key: 'pane-min' })
    if (await has(b, 'wf-toolu_1')) await b.press({ key: 'wf-toolu_1' })
    expect(await hasLine(b)).toBe(false)
    expect(await stepFull(b)).toBe(true)
    expect(await dimFull(b)).toBe(false)
    await b.unmount()
    void kit
  })
})

describe('[R44.19] [AC-12.24] on widening, the workflow view and its flowchart in both panel types', () => {
  for (const mode of ['drill-in', 'tab'] as const)
    test(`${mode}: narrow command, then docked: the workflow view on the newest run with its step chart, the mode control reads docked; Run List tab ${mode === 'tab' ? 'opened once, without focus' : 'not opened'}`, HEAVY, async ($, on) => {
      const kit = await engine($, on, { files: { '.ai-dlc/lens.json': JSON.stringify({ panelOpenMode: mode }) } })
      const narrow = await pane($, CHART, 'inline', kit, { bodyColumns: 43 })
      await fire(kit)
      await narrow.unmount()
      await lensCmd($) // narrow: the command leaves the minimised list
      const wide = await pane($, CHART, 'dock', kit, { bodyColumns: 150 })
      await fire(kit)
      await wide.unmount()
      const runs = kit.openArgs.filter((x: any) => x.id === RUNS)
      expect(runs.length).toBe(mode === 'tab' ? 1 : 0)
      if (mode === 'tab') expect(runs[0].focus).toBeUndefined()
      const docked = await pane($, CHART, 'dock', kit, { bodyColumns: 150 }) // at the seat in force
      expect(await has(docked, 'runs-back')).toBe(true) // the workflow view, not the list
      expect((await charts(docked)).length).toBe(1)
      expect(await stepFull(docked)).toBe(true)
      expect(String(((await docked.find({ type: 'Button', key: 'pane-place' })) as any)?.text)).toBe('docked')
      await docked.unmount()
    })
})
