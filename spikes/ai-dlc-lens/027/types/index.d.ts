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
  /** Resolved model id (`AgentSpawnResult.model`, then `TurnUsage.model`): the key for costs and windows. */
  model: string
  /** The Agent call's `model` parameter as given (`agent.spawn` `model`), '' when it named none. */
  callModel: string
  /** The parent's effective model (`agent.spawn` `parentModel`): what `inherit` resolves to. */
  parentModel: string
  /** The brief the orchestrator wrote (`agent.spawn` `prompt`): the arrow panel's fallback (finding 2). */
  prompt: string
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
  /** `classic.SubagentStop` `last_assistant_message`: the result its background task shows. */
  output?: string
  /** Each `turn.step` usage of this loop, one per request (round 5: long-context pricing is per request). */
  reqs: Tokens[]
  /** An agent-team teammate (`agent.spawn` `teammateId`, `$.agent.list()` `teammateId`, type `teammate`). */
  teammate?: boolean
}

export type LensTask = {
  id: string
  type: string
  status: string
  description: string
  /** Where the entry came from (`agent.list`, `tool.call`, `Stop`, `SubagentStop`): kept for debugging, never drawn. */
  source: string
  /** The agent type of a subagent task (`agent.list` `type`, `background_tasks` `agent_type`). */
  agentType?: string
  /** When the lens first saw it, and when it first saw it end (round 4: no event gives the times). */
  startedAt?: number
  endedAt?: number | null
  /** Its output or result, when an event carries one. */
  output?: string
}

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
  /** `pane`: arrow and avatar panels open as separate panes; `drill`: inside the lens pane with a Back button. */
  panelMode: string
  edge: string | null
  agent: string | null
  drill: string | null
  /** The pressed arrow's / avatar's agent as the card drew it: a call not spawned yet is in no other state. */
  edgeSnap: LensAgent | null
  agentSnap: LensAgent | null
}

/** What `tool.call` saw of one Agent call before `agent.spawn` named its agent: the placeholder avatar. */
export type LensPending = { type: string; description: string; name: string; prompt: string; model: string }

/** An agent definition as the lens read it: `model:` and `Persona name:` (finding 1d), and where from. */
export type LensDef = { model: string; persona: string; path: string }

/** The resolved lens settings (hooks/settings.ts): each value, the level it came from, the values ignored. */
export type LensConfig = { settings: Record<string, number | boolean | string>; sources: Record<string, string>; ignored: string[] }

/** `.ai-dlc/model-costing.json` as read (never written here): its text, or why there is none. */
export type LensCosting = { path: string; text: string; error: string }

/**
 * The Agent calls one assistant message made (one `turn.step`), in the order the model made them.
 * The first one's ToolUse row draws the flowchart for all of them; `parent` is the loop that made them.
 */
export type LensBatch = { parent: string; ids: string[]; pending: Record<string, LensPending> }

/** The arrow panel: the matched record and its hand-back, else the orchestrator's prompt (finding 2); `hint` a record found by time order only. */
export type LensDoc = { agent: string; handoff: string; handoffText: string; handback: string; handbackText: string; error: string; prompt: string; hint: string }

/**
 * Workflows across messages (round 4 bug): `of` maps each Agent call to its workflow (named by its
 * first call), `by` to its spawner; `parent` is each workflow's spawner; `order` oldest first.
 */
export type LensWorkflows = { of: Record<string, string>; by: Record<string, string>; parent: Record<string, string>; order: string[] }

/**
 * A run's `run.md` as the lens reads it (round 5): its title, `status:`, the stage in progress, and
 * each stage row's name by its step code, so an agent's task follows its handoff record.
 */
export type LensRun = { title: string; status: string; stage: string; stages: Record<string, string> }

declare module 'claude-code' {
  interface PluginState {
    'ai-dlc-lens-spike-027': {
      tick: boolean
      paneExpanded: boolean
      panePresses: number
      forceMode: string
      agents: Shaped<Record<string, LensAgent>>
      runs: Shaped<Record<string, LensRun>>
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
      callAgent: Record<string, string>
      defs: Shaped<Record<string, LensDef>>
      roster: Record<string, string>
      costing: Shaped<LensCosting>
      chartLead: string
      callTask: Record<string, string>
      mainPrompt: string
      workflows: Shaped<LensWorkflows>
      lens: Shaped<LensConfig>
    }
  }
}
