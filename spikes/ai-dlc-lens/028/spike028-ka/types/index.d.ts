// The keep-alive state a lens would read. Mirrors what hooks/keepalive/keepalive.ts holds per
// track (Track: generation, timer, armedTime, warmUntil, pings, line) plus the settings it reads
// (pingEvery, keepWarmFor, maxPings), with the next ping worked out as a time.
export type KeepaliveTrackState = {
  name: '1h' | '5m'
  running: boolean
  armedAt: number
  warmUntil: number
  nextPingAt: number | null
  pingEvery: number
  keepWarmMs: number
  pings: number
  cap: number
  line: string
}

export type KeepaliveState = {
  enabled: boolean
  updatedAt: number
  sessionId: string
  tracks: KeepaliveTrackState[]
}

declare module 'claude-code' {
  interface PluginState {
    'spike028-ka': { keepalive: KeepaliveState }
  }
}
