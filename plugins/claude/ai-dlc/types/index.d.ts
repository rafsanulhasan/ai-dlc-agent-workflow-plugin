// The state ai-dlc publishes for other plugins to read with `$.state.get`. Only ai-dlc writes it.
// Keep-alive (hooks/keepalive/keepalive.ts) writes `keepalive` each time a track's status line
// changes; ai-dlc-lens reads it read-only and keeps its own copy of the fields it uses
// (plugins/claude/ai-dlc-lens/types/index.d.ts), since it does not list ai-dlc under `dependencies`.

/** One keep-alive track, as its status line describes it. Times are epoch milliseconds. */
export type KeepaliveTrackState = {
  name: '1h' | '5m'
  /** A ping is scheduled on this track. */
  running: boolean
  /** When the track was armed (the turn's Stop); 0 before it ever was. */
  armedAt: number
  /** When the cache this track keeps expires, after the last ping or the arming. */
  warmUntil: number
  /** When the next ping is due; null when the track is not running. */
  nextPingAt: number | null
  /** The track's ping interval. */
  pingEvery: number
  /** The track's keep-warm time in force (an /ai-dlc:cache-keepalive override, else the setting). */
  keepWarmMs: number
  /** Pings that landed (cache hits) since the track was armed. */
  pings: number
  /** The track's ping limit. */
  cap: number
  /** The track's status line, as keep-alive shows it: its cache part, then its keep-alive part. */
  line: string
  /** The caches of the track's lifetime keep-alive has seen this session, one per source (`main`, and
   * `subagents` for the latest of the subagents' caches), with when each is warm until and whether it
   * has expired at `updatedAt`. Omitted when there is none. */
  caches?: { source: 'main' | 'subagents'; warmUntil: number; expired: boolean }[]
  /** Where the keep-warm time in force came from, the label the line's source note shows. */
  keepWarmFrom: 'session' | 'machine' | 'settings' | 'default'
  /** Whether the track is on in force: this session's switches, else the settings (step 42: the lens's
   * Cache Lab buttons show it). */
  enabled: boolean
  /** This session's switch of the track (its band or Pane button), when one is set. */
  sessionSwitch?: 'on' | 'off'
}

export type KeepaliveState = {
  /** Keep-alive's master in force: this session's master switch, else the `enabled` setting as last read. */
  enabled: boolean
  /** This session's master switch (the band or Pane title-row button), when one is set. */
  sessionMaster?: 'on' | 'off'
  /** The automatic handoff chain this session belongs to: the id of its first session, and its session
   * ids, newest first (a session started by hand is a chain of one). */
  chain?: { id: string; sessions: string[] }
  updatedAt: number
  sessionId: string
  tracks: KeepaliveTrackState[]
}

declare module 'claude-code' {
  interface PluginState {
    'ai-dlc': { keepalive: KeepaliveState }
  }
}
