import { expect, test } from 'claude-code/testing'

const PANE = (placement: 'dock' | 'inline', bodyColumns: number) =>
  ({
    plugin: 'ai-dlc-lens-spike-027',
    component: 'Pane',
    requestId: 'lens-spike-027',
    props: {
      title: 'Lens spike 027',
      isFocused: false,
      bodyColumns,
      placement,
      scroll: { offset: 0, bodyRows: 40 },
      view: {},
    },
  }) as const

test('check 1: dock draws flowchart, inline draws compact', async ($, on) => {
  on('command.register', () => ({ value: { command: 'x' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
  for (const surface of ['terminal', 'vscode'] as const) {
    const dock = await $.ui.mount({ ...PANE('dock', 120), surface })
    expect(await dock.find({ type: 'Text', text: /^FLOWCHART/ })).toBeDefined()
    await dock.unmount()
    const inline = await $.ui.mount({ ...PANE('inline', 60), surface })
    expect(await inline.find({ type: 'Text', text: /^COMPACT/ })).toBeDefined()
    await inline.unmount()
  }
})

test('check 3: pane [+] button toggles and counts', async ($, on) => {
  on('command.register', () => ({ value: { command: 'x' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
  // State is the session's, shared by both mounts: odd presses expand, even collapse.
  let n = 0
  for (const surface of ['terminal', 'vscode'] as const) {
    const ui = await $.ui.mount({ ...PANE('dock', 120), surface })
    await ui.press({ key: 'pane-expand' })
    n += 1
    expect((await ui.find({ type: 'Text', text: new RegExp(`presses=${n}$`) }))).toBeDefined()
    const shown = await ui.find({ type: 'Text', text: /expanded content/ })
    expect(shown !== undefined).toBe(n % 2 === 1)
    await ui.unmount()
  }
})

test('check 4: Agent ToolUse card keeps the engine row inside it', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>NATIVE ROW</Text>
  })
  for (const surface of ['terminal', 'vscode'] as const) {
    const ui = await $.ui.mount({
      plugin: 'ai-dlc-lens-spike-027',
      surface,
      component: 'ToolUse',
      requestId: 'toolu_1',
      props: {
        tool_use_id: 'toolu_1',
        tool: 'Agent',
        input: { subagent_type: 'ai-dlc:software-architect', description: 'design', prompt: 'p' },
        isRunning: false,
        isErrored: false,
        isInterrupted: false,
      },
    })
    expect(await ui.find({ type: 'Text', text: /NATIVE ROW/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /LENS CARD/ })).toBeDefined()
    const before = await ui.find({ type: 'Text', text: /input keys/ })
    await ui.press({ key: 'row-toolu_1' })
    const after = await ui.find({ type: 'Text', text: /input keys/ })
    expect(after !== undefined).toBe(before === undefined)
    expect(await ui.find({ type: 'Text', text: /NATIVE ROW/ })).toBeDefined()
    await ui.unmount()
  }
})
