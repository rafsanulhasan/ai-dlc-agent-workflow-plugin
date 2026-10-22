import { expect, test } from 'claude-code/testing'

// Does a pane that reads ANOTHER plugin's $.state value while drawing redraw when that plugin writes it?
// An inline plugin named spike028-ka stands for the provider: its commands write the value as
// keep-alive would on arm and on stop.
const PANE = {
  plugin: 'spike028-lens',
  component: 'Pane',
  requestId: 'spike028-lens',
  props: { title: 'Keep-alive', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

const provider = {
  name: 'spike028-ka',
  register(on: Parameters<import('claude-code').Register>[0]) {
    const KA = { plugin: 'spike028-ka', key: 'keepalive' } as const
    const state = (pings: number, running: boolean, nextPingAt: number | null) => ({
      enabled: true, updatedAt: 0, sessionId: 's',
      tracks: [{ name: '5m' as const, running, armedAt: 0, warmUntil: 0, nextPingAt, pingEvery: 240_000, keepWarmMs: 3_600_000, pings, cap: 12, line: '' }],
    })
    on('command.run', { command: 'ka-arm' }, async $ => {
      await $.state.set(KA, state(1, true, (await $.clock.now()) + 120_000))
      return { text: 'armed' }
    })
    on('command.run', { command: 'ka-stop' }, async $ => {
      await $.state.set(KA, state(12, false, null))
      return { text: 'stopped' }
    })
  },
}

test('the lens pane draws another plugin\'s state and redraws on its writes', { plugins: [provider] }, async ($, on) => {
  on('clock.now', () => ({ value: 1_000_000 }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('command.register', (_, e) => ({ value: { command: (e as { name: string }).name } }))
  on('session.start', (_, e) => ({ cwd: (e as { cwd: string }).cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    await $.command.run({ command: 'ka-arm' })
    const ui = await $.ui.mount({ ...PANE, surface })
    const first = await ui.find({ type: 'Text', text: /keep-alive:/ })
    expect(first?.text).toMatch(/^keep-alive: 5m next ping in 1[12]\ds \(every 240s, 1\/12\)$/)

    await $.command.run({ command: 'ka-stop' })
    const second = await ui.find({ type: 'Text', text: /keep-alive:/ })
    expect(second?.text).toBe('keep-alive: off')
    await ui.unmount()
  }
})
