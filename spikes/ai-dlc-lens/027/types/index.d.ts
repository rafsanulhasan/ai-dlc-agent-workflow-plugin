export type SpikeRedraw = { n: number; columns: number; placement: string; mode: string }

/** Token counts as `ModelUsage` has them: `in` is uncached input (D:6605-6627). */
export type Tokens = { in: number; out: number; cr: number; cw: number }

/** One agent of the flowchart: `main` for the session's main loop, else the agent id. */
export type LensAgent = {
  id: string
  parent: string | null
  /** `agent.spawn` `subagentType` (`ai-dlc:agent-manager`), or the session agent for main. */
  type: string
  /** `Agent({ name })` when given. */
  name: string
  description: string
  /** Resolved model id (`AgentSpawnResult.model`, then `TurnUsage.model`). */
  model: string
  status: string
  toolUseId: string
  /** Sum of every `turn.step` usage of this loop. */
  steps: Tokens
  /** Sum of every `turn.complete` usage of this loop: the hand-off's tokens. */
  turns: Tokens
  /** The last step's usage: context used = in + cr + cw + out (D:8021). */
  last: Tokens | null
  handoff: string | null
  /** `first line`, `body`, `fallback` or `none`: how the record path was found. */
  handoffHow: string
  /** Two-way arrow: a respawn of the same type by the same parent, or a SendMessage to it. */
  loop: boolean
  startedAt: number
  endedAt: number | null
  /** Background tasks: `$.agent.list()` children and stop-time `background_tasks`. */
  bg: LensTask[]
}

export type LensTask = { id: string; type: string; status: string; description: string; source: string }

export type LensCall = {
  id: string
  tool: string
  summary: string
  status: string
  /** The output tokens of the step that asked for it, and how many calls that step asked for (estimate). */
  stepOut: number
  stepCalls: number
}

export type LensUi = {
  thinkingOpen: boolean
  contextOpen: boolean
  /** `pane`: arrow and avatar panels open as separate panes; `drill`: inside the lens pane with a Back button. */
  panelMode: string
  edge: string | null
  agent: string | null
  drill: string | null
  edgeDocOpen: boolean
  edgeBackOpen: boolean
  agentThinkingOpen: boolean
}

/** What `tool.call` saw of one Agent call before `agent.spawn` named its agent: the placeholder avatar. */
export type LensPending = { type: string; description: string; name: string }

/**
 * The Agent calls one assistant message made (one `turn.step`), in the order the model made them.
 * The first one's ToolUse row draws the flowchart for all of them; `parent` is the loop that made them.
 */
export type LensBatch = { parent: string; ids: string[]; pending: Record<string, LensPending> }

export type LensDoc = { agent: string; handoff: string; handoffText: string; handback: string; handbackText: string; error: string }

declare module 'claude-code' {
  interface PluginState {
    'ai-dlc-lens-spike-027': {
      tick: boolean
      paneExpanded: boolean
      panePresses: number
      forceMode: string
      agents: Shaped<Record<string, LensAgent>>
      order: Shaped<string[]>
      calls: Shaped<Record<string, LensCall[]>>
      thinking: Record<string, string>
      context: Shaped<LensCall[]>
      mainWindow: number
      ui: Shaped<LensUi>
      doc: Shaped<LensDoc>
      probe: boolean
      probeLines: number
      batches: Shaped<Record<string, LensBatch>>
      cardOpen: Record<string, boolean>
    }
  }
}
