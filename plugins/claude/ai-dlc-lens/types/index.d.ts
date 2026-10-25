export type KitRedraw = { n: number; columns: number; placement: string; mode: string }

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
  /** Each `turn.step` usage of this loop, one per request (round 5: long-context pricing is per request; round 6: the last REQS_CAP only). */
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

/** What the separate arrow and avatar panes show: the last arrow and avatar pressed in `tab` mode. */
export type LensUi = {
  edge: string | null
  agent: string | null
  /** The pressed arrow's / avatar's agent as the card drew it: a call not spawned yet is in no other state. */
  edgeSnap: LensAgent | null
  agentSnap: LensAgent | null
}

/**
 * Step 1.5: an arrow or avatar opened in `drill-in` mode, inside the drawing it was pressed in (the
 * workflow pane or band, one chat card), with "< Back". Kept per drawing.
 */
export type LensDrill = { kind: string; id: string; snap: LensAgent }

/**
 * Step 1.5: the workflow view's state. `place`: `pinned` (above the prompt) or `docked` (the pane);
 * `size`: `normal`, `minimised` or `fullscreen`; `prev`: the sizes before, newest last, that restore
 * returns to; `selected`: the run (workflow) shown beside the list when wide, or opened from the list when narrow.
 * Step 36.2, amendment 3: `pane`, the run the pane shows while the band shows the view (the pane `/ai-dlc:lens` opens
 * beside the band); absent or '': the band's `selected`. `size` and `prev` are then the band's alone: that pane is never minimised.
 * Amendment 8: `band`, the band's own size (`normal` or `minimised`) while the view is docked, when the band is still
 * drawn above the prompt because a workflow is in progress; `size` and `prev` are then the docked pane's.
 */
export type LensView = { place: string; size: string; prev: string[]; selected: string; pane?: string; band?: string }

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
export type LensBatch = { parent: string; ids: string[]; pending: Record<string, LensPending>; /** Step 1.6.1: each call's spawner when it is not `parent` (workflowBatch). */ by?: Record<string, string> }

/** The arrow panel: the matched record and its hand-back, else the orchestrator's prompt (finding 2); `hint` a record found by time order only. */
export type LensDoc = { agent: string; handoff: string; handoffText: string; handback: string; handbackText: string; error: string; prompt: string; hint: string }

/**
 * Workflows across messages (round 4 bug): `of` maps each Agent call to its workflow (named by its
 * first call), `by` to its spawner; `parent` is each workflow's spawner; `order` oldest first.
 */
export type LensWorkflows = { of: Record<string, string>; by: Record<string, string>; parent: Record<string, string>; order: string[] }

/**
 * A run's `run.md` as the lens reads it (round 5): its title, `status:`, the stage in progress, and
 * each stage row's name by its step code, so an agent's task follows its handoff record. `started`: its
 * front matter's `started:` (else `created:`), present only when set: the workflow view's last fallback for when the run started.
 * `parent`: step 27.1, its front matter's `parent:`, the run folder's name (as written, backticks and
 * any path before it dropped), present only when set: the run is drawn in that run's chart (`runRoots`).
 */
export type LensRun = {
  title: string
  status: string
  stage: string
  stages: Record<string, string>
  started?: string
  parent?: string
  /**
   * Step 8.6.1: the record files of the run folder (`*.handoff.md`, `*.handback.md`, and the oldest form
   * `<step>-<from>-to-<to>.md`), as `refreshRuns` listed them; absent when the folder could not be listed
   * (a run merged away). The workflow view draws one chart per top-level step from them (`stepTrees`).
   */
  records?: string[]
  /**
   * Step 8.6.1: the step offset of each run merged into this one, by its run id, from the run.md table that
   * has an `Offset` column (`+18`: the merged run's step k is this run's step k + 18). A brief that still
   * names the merged run's folder joins this run's step chart k + offset.
   */
  offsets?: Record<string, number>
  /**
   * Step 8.6.1.l1: the run.md *Features* table (`Step | Feature | Old steps | Status`, written when a run's
   * records were renumbered into feature roots): each root's feature name by its step number. The step chart
   * of a root is titled with it.
   */
  features?: Record<string, string>
  /**
   * Step 8.6.1.l1: the same table's `Old steps` column as old code -> new code prefixes (`renamesFromFeatures`):
   * old `30` -> `8.6`, old `10.2` -> `5.1`. A brief written before the renumbering, which names an old code,
   * is drawn at the record it was renamed to (`locateRecord`).
   */
  renames?: Record<string, string>
  /**
   * Per-code renames, old code -> new code, from the run folder's rename sources
   * (`isRenameSource`: a JSON file's `codeMap`, or an `Old code | New code` table), oldest file first and
   * composed (`composeCodeMaps`). A brief written before such a renaming is drawn at the record it became
   * (`locateRecord`, which applies this before the `renames` prefixes and composes the two).
   */
  codeMap?: Record<string, string>
}

/**
 * Step 1.6.1: one anomaly /ai-dlc:lens-gate reports (hooks/anomaly.ts). `key` names it while its cause
 * holds: it is reported once when it appears and dropped when the cause is gone. `run`: the run folder
 * ('' for none); `step` and `record`: the step code and the record file it concerns ('' when none);
 * `agent` and `target`: the agent whose avatar (`agent`) or arrow (`edge`) carries the marker; `since`:
 * when the lens first saw it.
 */
export type LensAnomaly = { key: string; kind: string; run: string; step: string; record: string; agent: string; target: string; text: string; since: number }

/** Round 6: an automatic notice the engine fed the main loop (a task notification, a reminder): never a task title. `w`: the workflow it is shown on, '' for none. */
export type LensNotice = { text: string; at: number; w: string }

/**
 * Keep-alive's state as the ai-dlc plugin publishes it (`$.state` `{ plugin: 'ai-dlc', key: 'keepalive' }`,
 * plugins/claude/ai-dlc/types/index.d.ts): only the fields the lens reads. A plugin's contract declares
 * only its own state, so this is not in PluginState below; hooks/lens.ts `keepaliveLine` checks each
 * field it uses. The lens does not list ai-dlc under `dependencies`: without it the read gives no value.
 * Read-only here.
 */
export type LensKeepaliveTrack = { name: string; running: boolean; nextPingAt: number | null; warmUntil: number; pings: number; cap: number }
export type LensKeepalive = { enabled: boolean; updatedAt: number; sessionId: string; tracks: LensKeepaliveTrack[] }

/**
 * /ai-dlc:lens-keepalive (step 1.4): one arming of one keep-alive track, as the lens last read it from
 * ai-dlc's value (`armedAt`, `warmUntil`, `pings`). Kept per `<track>@<armedAt>` in the lens's own state,
 * so the time of earlier armings survives the next one; hooks/lens.ts `noteKeepalive`, `keptWarm`.
 */
export type LensKeepaliveCycle = { track: string; armedAt: number; warmUntil: number; pings: number }

declare module 'claude-code' {
  interface PluginState {
    'ai-dlc-lens': {
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
      notices: Shaped<LensNotice[]>
      callKey: Record<string, string>
      drills: Shaped<Record<string, LensDrill>>
      view: Shaped<LensView>
      openMode: string
      avatarRev: number
      keepaliveCycles: Shaped<Record<string, LensKeepaliveCycle>>
      anomalies: Shaped<LensAnomaly[]>
      tabsMin: Record<string, boolean>
      /** Step 8.6.1: the step chart full screen shows, per workflow (its chart key); absent: the first in order, the highest code. */
      stepSel: Record<string, string>
      /** Step 36.2, amendment 8: the band closed with its close, which it has only while no workflow is in progress. */
      bandClosed: boolean
    }
  }
}
