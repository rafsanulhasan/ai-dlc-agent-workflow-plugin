import type { EngineInterface, Register, Timer } from 'claude-code'
import type { KeepaliveState, KeepaliveTrackState } from '../types'

// Spike 028 provider: a fake keep-alive. It arms both tracks at session.start and "pings" on a short
// timer, and exposes the same state three ways: a $.state value (STATE), a registered read-only tool
// (TOOL) and a JSON state file (stateFile). flags.json in the spike root turns the tool's own
// tool.check allow on or off, so a run can show the permission check with and without it.

const STATE = { plugin: 'spike028-ka', key: 'keepalive' } as const
const TOOL = 'keepalive_state'
const PING_EVERY = 4_000

let timer: Timer | undefined
let current: KeepaliveState | undefined
let allowOwnTool = false

const spikeRoot = ($: EngineInterface) => $.plugin.root.replaceAll('\\', '/').replace(/\/spike028-ka\/?$/, '')
const stateFile = ($: EngineInterface) => `${spikeRoot($)}/state/keepalive.json`

async function publish($: EngineInterface, s: KeepaliveState) {
  current = s
  await $.state.set(STATE, s)
  await $.fs.write(stateFile($), JSON.stringify(s, null, 2))
}

function track(name: '1h' | '5m', now: number, ttl: number, cap: number): KeepaliveTrackState {
  return { name, running: true, armedAt: now, warmUntil: now + ttl, nextPingAt: now + PING_EVERY, pingEvery: PING_EVERY, keepWarmMs: 60 * 60_000, pings: 0, cap, line: `keepalive ${name}: armed` }
}

function tick($: EngineInterface) {
  timer = $.clock.after(PING_EVERY, async () => {
    if (!current) return
    const now = await $.clock.now()
    const tracks = current.tracks.map(t => {
      if (!t.running) return t
      const pings = t.pings + 1
      const running = pings < t.cap
      return { ...t, pings, running, warmUntil: now + (t.name === '1h' ? 3_600_000 : 300_000), nextPingAt: running ? now + PING_EVERY : null, line: `keepalive ${t.name}: ping ${pings}/${t.cap}${running ? '' : ', stopped'}` }
    })
    await publish($, { ...current, updatedAt: now, tracks })
    if (tracks.some(t => t.running)) tick($)
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    try {
      const flags = JSON.parse(await $.fs.read(`${spikeRoot($)}/flags.json`)) as { allowOwnTool?: boolean }
      allowOwnTool = flags.allowOwnTool === true
    } catch { allowOwnTool = false }
    await $.tool.register({
      name: TOOL,
      description: 'Read-only: the keep-alive state of this session (spike).',
      inputSchema: { type: 'object', properties: {} },
      isDeferred: true,
    })
    const now = await $.clock.now()
    timer?.cancel()
    await publish($, { enabled: true, updatedAt: now, sessionId: await $.session.id(), tracks: [track('1h', now, 3_600_000, 3), track('5m', now, 300_000, 3)] })
    tick($)
    return r
  })

  // Serves the registered tool: the state as it stands, as JSON text (a tool's result is a string or
  // content blocks; an object is refused: run 1).
  on('tool.call', { tool: `mcp__spike028-ka__${TOOL}` }, async () => ({ result: JSON.stringify(current ?? null) }))

  // The provider's own allow for its read-only tool, so neither the model nor another plugin's
  // $.tool.call meets a permission dialog for it. On only when flags.json says so.
  on('tool.check', { tool: `mcp__spike028-ka__${TOOL}` }, async ($, e, next) =>
    allowOwnTool ? { decision: 'allow', reason: 'spike028-ka: read-only state tool' } : next(e))

  on('session.end', async ($, e, next) => {
    timer?.cancel()
    timer = undefined
    return next(e)
  })
}
