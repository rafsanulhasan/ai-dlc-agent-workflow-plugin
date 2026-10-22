// Spike 029 (ITEM-029): what the engine itself accepts or refuses, per surface.
// The host's Svg scrub and the pixels are not reachable here (the kit "never a surface's paint"); CHECK.md covers those by hand.
import { expect, test } from 'claude-code/testing'

declare const console: { log: (...args: unknown[]) => void }

// Base64 lengths of the real assets (tools/gen-assets.mjs output); content is filler, the kit has no fs.
const B64: Record<string, number> = {
  'avatar.png': 172, 'avatar.jpg': 1756, 'avatar.gif': 2008, 'avatar.webp': 48,
  'size-4k.png': 3972, 'size-32k.png': 31908, 'size-64k.png': 63984, 'size-95k.png': 94900,
  'size-130k.png': 130468, 'size-140k.png': 139916,
}

// The real avatar.png, and the PNG signature base64-encoded for filler (the engine checks it on Image png).
const AVATAR_PNG = 'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAAASElEQVR42u3PMQ0AMAwDwYDoXIhFUogFUQgh4S0n/Wyd698VaZ8XqYCAgICAgICAgICAgIaBUkOpY0BAQEBAQEBAQEBAQMNADebbXMRiLnWeAAAAAElFTkSuQmCC'
const PNG_HEAD = 'iVBORw0KGgoAAAANSUhEUg'

const pane = (requestId: string) => ({
  plugin: 'spike029-avatars',
  component: 'Pane',
  requestId,
  props: { title: 'Spike 029', isFocused: false, bodyColumns: 120, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
}) as const

function stubFs(on: (event: 'fs.read', hook: (...a: any[]) => unknown) => void) {
  on('fs.read', (_: unknown, e: { path: string }) => {
    const name = e.path.replace(/\\/g, '/').split('/').pop() ?? ''
    if (name === 'avatar.png') return { value: { base64: AVATAR_PNG } }
    const len = B64[name] ?? 16
    return { value: { base64: (PNG_HEAD + 'A'.repeat(len)).slice(0, len) } }
  })
}

test('vscode and desktop: 27 Svg cells within the cap are drawn', async ($, on) => {
  stubFs(on as never)
  for (const surface of ['vscode', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...pane('spike029'), surface })
    await ui.drawn()
    const svgs = await ui.findAll({ type: 'Svg' })
    expect(svgs).toHaveLength(27)
    expect(await ui.find({ type: 'Text', text: /S18/ })).toBeDefined()
    await ui.unmount()
  }
})

test('terminal: three Image elements (file path, png bytes, large file) are drawn', async ($, on) => {
  stubFs(on as never)
  const ui = await $.ui.mount({ ...pane('spike029'), surface: 'terminal' })
  await ui.drawn()
  expect(await ui.findAll({ type: 'Image' })).toHaveLength(3)
  await ui.unmount()
})

test('vscode: an Svg source past 131072 characters refuses the tree', async ($, on) => {
  stubFs(on as never)
  let refusal = ''
  try {
    const ui = await $.ui.mount({ ...pane('spike029-overcap'), surface: 'vscode' })
    await ui.drawn()
  } catch (err) {
    refusal = String(err)
  }
  console.log(`S26 refusal: ${refusal || '(none: tree accepted)'}`)
  expect(refusal).toMatch(/Svg source longer than 131072 characters/)
})

test('vscode: the engine hands the Svg markup on unchanged (any scrub happens in the surface)', async ($, on) => {
  stubFs(on as never)
  const ui = await $.ui.mount({ ...pane('spike029'), surface: 'vscode' })
  const sources = (await ui.findAll({ type: 'Svg' })).map(s => String(s.props.source))
  const has = (needle: string) => sources.some(s => s.includes(needle))
  const probes = {
    style: has('<style>.ok{fill:#2e7d32}</style>'),
    styleAttr: has('style="fill:#2e7d32"'),
    marker: has('<marker id="h"') && has('marker-start="url(#h)"'),
    imageData: has('<image href="data:image/png;base64,'),
    imageXlink: has('<image xlink:href="data:image/png;base64,'),
    imageFile: has('<image href="file:///'),
    script: has('<script>'),
    onload: has('onload='),
  }
  console.log('engine-level markup after validation: ' + JSON.stringify(probes))
  for (const v of Object.values(probes)) expect(v).toBe(true)
  await ui.unmount()
})
