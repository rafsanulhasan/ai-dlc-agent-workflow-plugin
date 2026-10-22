export type SpikeRedraw = { n: number; columns: number; placement: string; mode: string }

declare module 'claude-code' {
  interface PluginState {
    'ai-dlc-lens-spike-027': {
      tick: boolean
      paneExpanded: boolean
      panePresses: number
      rowPresses: Record<string, number>
      rowExpanded: Record<string, boolean>
      forceMode: string
    }
  }
}
