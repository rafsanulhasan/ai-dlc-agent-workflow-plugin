import type { EngineInterface, Register } from 'claude-code'

// Spike 028 reader: reads spike028-ka's keep-alive state three ways and records what each gave in
// results/<site>-<time>.json under the spike root. A pane (/spike028-lens) draws one keep-alive line
// from the provider's $.state value, to show whether a read while drawing redraws on the provider's
// writes.

const KA = { plugin: 'spike028-ka', key: 'keepalive' } as const
const TOOL = 'mcp__spike028-ka__keepalive_state'
const PANE = 'spike028-lens'

const spikeRoot = ($: EngineInterface) => $.plugin.root.replaceAll('\\', '/').replace(/\/spike028-lens\/?$/, '')
const msg = (err: unknown) => (err instanceof Error ? `${err.name}: ${err.message}` : String(err))

async function timed<T>($: EngineInterface, ms: number, p: Promise<T>): Promise<{ value?: T; error?: string; ms: number }> {
  const t0 = await $.clock.now()
  try {
    const value = await Promise.race([p, $.clock.sleep(ms).then(() => { throw new Error(`timed out after ${ms} ms`) })])
    return { value: value as T, ms: (await $.clock.now()) - t0 }
  } catch (err) {
    return { error: msg(err), ms: (await $.clock.now()) - t0 }
  }
}

async function probe($: EngineInterface, site: string) {
  const out: Record<string, unknown> = { site, at: new Date(await $.clock.now()).toISOString() }
  out.state = await timed($, 3_000, $.state.get(KA))
  out.toolListed = await timed($, 3_000, $.tool.list().then(l => l.filter(t => t.name.includes('spike028')).map(t => t.name)))
  out.toolCheck = await timed($, 3_000, $.tool.check({ tool: TOOL, input: {} } as never))
  out.toolCall = await timed($, 8_000, $.tool.call({ tool: TOOL } as never).then(r => {
    const result = (r as { result?: unknown }).result
    return { raw: r, parsed: typeof result === 'string' ? (() => { try { return JSON.parse(result) as unknown } catch { return 'unparsable' } })() : undefined }
  }))
  out.stateFile = await timed($, 3_000, $.fs.read(`${spikeRoot($)}/state/keepalive.json`).then(t => JSON.parse(t) as unknown))
  // A second state read a few pings later, to see the version move.
  await $.clock.sleep(5_000)
  out.stateLater = await timed($, 3_000, $.state.get(KA))
  await $.fs.write(`${spikeRoot($)}/results/${site}-${Date.now()}.json`, JSON.stringify(out, null, 2))
  return out
}

function line(s: { tracks: { name: string; running: boolean; nextPingAt: number | null; pingEvery: number; pings: number; cap: number }[] } | undefined, now: number) {
  if (!s) return 'keep-alive: no state'
  const on = s.tracks.filter(t => t.running)
  if (!on.length) return 'keep-alive: off'
  return 'keep-alive: ' + on.map(t => `${t.name} next ping in ${Math.max(0, Math.round(((t.nextPingAt ?? now) - now) / 1000))}s (every ${t.pingEvery / 1000}s, ${t.pings}/${t.cap})`).join(' · ')
}

export const register: Register = on => {
  let probed = false

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command.register({ name: 'spike028-lens', description: 'Spike 028: open the keep-alive line pane' })
    await $.command.register({ name: 'spike028-probe', description: 'Spike 028: read the keep-alive state three ways now' })
    return r
  })

  on('prompt.submit', async ($, e, next) => {
    if (!probed) {
      probed = true
      try { await probe($, 'prompt-submit') } catch (err) { $.ui.log(`spike028-lens: probe failed ${msg(err)}`) }
    }
    return next(e)
  })

  // A second dispatch, later in the turn: shows whether a reader sees the provider's later writes
  // (one dispatch reads one moment of $.state).
  on('classic.Stop', async ($, e, next) => {
    try { await probe($, 'stop') } catch (err) { $.ui.log(`spike028-lens: probe failed ${msg(err)}`) }
    return next(e)
  })

  on('command.run', { command: 'spike028-probe' }, async $ => ({ text: JSON.stringify(await probe($, 'command'), null, 2) }))

  on('command.run', { command: 'spike028-lens' }, async $ => {
    const { isPlaced } = await $.ui.open({ id: PANE, title: 'Keep-alive (spike 028)' })
    return { text: `pane opened, placed: ${isPlaced}` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const { value, version } = await $.state.get(KA)
    const now = await $.clock.now()
    return (
      <Box flexDirection="column">
        <Text>{line(value, now)}</Text>
        <Text dimColor>state version {version}</Text>
      </Box>
    )
  })
}
