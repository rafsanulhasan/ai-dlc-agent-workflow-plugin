---
run: FEAT-20261020-ai-dlc-lens
work-item: ITEM-027
lifecycle: AI-DLC
step: 16
from: research-assistant
to: orchestrator
mode: subagent
loop: none
received: 2026-10-23 12:20
verification: passed — "handoff 16-orchestrator-to-research-assistant.handoff.md: passed"; orchestrator spot-checked D:2536 (`open: (pane: PaneOpenArgs)`), D:13088-13089 (presses on an enclosing element), D:6605-6612 (`ModelUsage.input_tokens` = uncached); types copy is 2.1.308, installed build is 2.1.309 (re-copy in step 17)
---

handoff 16-orchestrator-to-research-assistant.handoff.md: passed — record read; its cited inputs exist and match the record: spikes/ai-dlc-lens/027 (register.tsx, types, README), handbacks 3.2, 4.2, 4.3, 12.1, 12.2, 15.1, 15.2, 15-claude-lens-gap-analysis.md "Human decisions, 2026-10-23" (lines 29-36), plugins/claude/ai-dlc/hooks/auto-handoff/register.tsx. Caveat: the engine types I read are the 2.1.308 copy at `e:\Projects\personal\ai-dlc-agent-workflow-plugin\.scratch\ai-dlc-lens\spikes\029\typecheck\claude-code.d.ts` ("D:" below). I did not find the installed build's bundled plugin-authoring types, and I did not re-fetch the online docs in this run. Citations are D: line numbers.

| # | Question | Answer | How (API, event, field) | Fallback if no | Source |
|---|---|---|---|---|---|
| 1 | Read thinking and gathered context as they stream; collapsible? | Partial. Gathered context: yes. Thinking: no render site. | Thinking streams to `turn.step` hooks as `kind: 'thinking'` chunks (observe by yielding them back unchanged). Stored thinking: `$.session.messages({ agentId, as: 'api' })`. No thinking render site exists in RenderComponent. Collapsible = `[+]` Button plus state. ToolUse rows wrap with `next(e)`. ToolGroup `isExpanded` unfolds. | Put thinking and context in a Pane section, not the transcript. | D:9812 (RenderComponent list), D:10320-10351 (AssistantMessage, text only), D:14509-14518, D:11814-11829, D:10358-10415, D:10480-10497. Kit-only: spikes/027/CHECK.md check 4. |
| 2 | Svg element click handler? | No. Svg is a leaf with no children and no onPress. Box has no onPress. Only Button takes a press, and its label is a string (one string child only). | Clickable target = a Button beside or under the Svg (label = agent name or arrow glyph). Svg `isInteractive` gives hover and SMIL only. | Button row under the chart. | D:13058-13064, D:13088-13089 ("presses ... go on an enclosing element"), D:9822-9870 (Button, label, plain child). |
| 3 | Separate pane on click, or drill-in with back? | Yes, both. `$.ui.open({id,title})`. Several panes show as tabs. Drill-in = module state plus Button back. Pane count limit: not found. | `$.ui.open` (D:2536); tab label while several panes open (D:10855-10859). `$.ui.view({ agentId })` switches the MAIN transcript to an agent's transcript, only from the person's own input; it is not a separate panel (D:2623-2639). | Drill-in in one Pane. | D:2536, D:10853-10893, D:2623-2639. Limit: needs a spike. |
| 4 | Per subagent: model, window, context used, in/out tokens, cache read/write/miss | Model: yes. In/out, cache read, cache write: yes, per response or turn. Window: session only; no per-agent window API found, so a table is needed. Context used: derived. Cache "miss": not a field. | Model: `TurnUsage.model` on `turn.step` result `usage` (`null` if none) and `turn.complete.usage` (D:14438-14443, D:14563-14574, D:14211). Counts: `ModelUsage` `input_tokens` (documented as uncached, neither read nor written), `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens` (D:6605-6627). Window: `$.session.usage().context.window`, main session (D:12306-12330, D:11506-11509). Context used (derived, Medium): last step of that agent's loop, input + cache_read + cache_creation (+ output, per the engine's own definition for the main thread, D:8021). Miss (derived, Low): label it "uncached" = input_tokens. Agent model at spawn: `AgentSpawnInput.model` (D:248-270). | Window from a model-to-window table, marked as an assumption. | D:6605-6627, D:14190-14212, D:14343-14377, D:14438-14443, D:8021, D:11506-11509. |
| 5 | Tokens per spawn (handoff) and per tool call? | Per spawn: yes. Per tool call: no; split derived from the step. | Spawn to agent: `AgentSpawnInput.tool_use_id` (D:248-270), `$.agent.list()` `parentId` (D:125-184), Agent tool use's `toolUses` entry (D:11814-11821). Per spawn tokens = that agent's `turn.complete.usage` (summed per turn, D:14190-14212). Per call: a step's usage covers the whole response, and the response lists all its `toolUses` (D:14421), so a call's share is an estimate. | Attribute the whole step's tokens to each call it lists, flagged. | D:14190-14212, D:14421, D:14438-14443, D:125-184. |
| 6 | Background tasks visible, with status? | Partial. Stop-time snapshot yes (`background_tasks`). Live list of background shell tasks: not found. Background subagents: via `$.agent.list()` status. | `background_tasks?: BackgroundTaskSummary[]` (id, type, status, description, agent_type) on a classic hook input (SubagentStop/Stop family) (D:820-846, D:13041-13050). `AgentStatus` = pending, running, waiting, idle, completed, failed, killed (D:566). Task notifications: `session.receive` origin `task-notification` (per 4.3); `UserMessage.task` for rendering (D:10292-10295). | Module state from `tool.call` and `turn.complete` with `agentId`. | D:566, D:820-846, D:10292-10295, D:13041-13050. Live background shells: needs a spike. |
| 7 | Read handoff/hand-back files; match spawn to step code? | Yes for reading (`$.fs.read`, relative to the working directory, or absolute; 4 MiB cap). Match: via the Agent call's brief. | `$.fs.read` (D:3314-3331), `$.fs.list` (D:3340-3352). Match: AGENTS.md says the brief starts with the record path, so match the Agent ToolUse `input` (sent as the model wrote it, D:10370-10372) against the record name. The prompt key is `AgentSpawnArgs.prompt` (D:251). | Match by time order plus `subagentType`, flagged. | D:3314-3352, D:10370-10372, D:251; AGENTS.md "Run Loop" step 8 (path first in the brief). |

Also resolved from earlier handbacks (this copy): (a) raw colours: `Color` admits "a name such as red, or hex" (D:1713-1719), which upgrades the 4.2 open question (Medium: a type comment, not runtime-tested). (b) `$.ui.view` is new relative to 4.2/4.3.

Recommended card layout (from the answers):
- Transcript: keep the native row inside a `ToolUse` card for Agent and SendMessage (spike 027 kit). Gathered context is the same card pattern for other tools, or a ToolGroup with `isExpanded`.
- Pane "lens", dock placement: top, one Svg flowchart (non-clickable; initials, or images only if 029's human check passes). Under it, one Button per agent (label = agent name) and one Button per arrow. Then Text per avatar: `Name (model)`, role, context used/window, input/output tokens, cache read/write/uncached.
- Arrow click: drill-in, or a second pane (`$.ui.open`). Shows the handoff record and hand-back (read with `$.fs.read`) plus that spawn's tokens (`turn.complete.usage` of the callee).
- Avatar click: drill-in with a back Button. Shows background tasks (stop-time or `$.agent.list()` status) and tool calls (`tool.call` with `agentId`, module state). A "View transcript" Button calls `$.ui.view({ agentId })`.
- Thinking: a collapsible Pane section fed from `turn.step` thinking chunks. Not in the transcript.

Experiments step 17 must run (each in VS Code, with the 027 kit style of test):
E1 Log the live Agent ToolUse `input` and confirm the key holding the brief (`prompt`), and that the record path is its first line.
E2 A pass-through `turn.step` observer: confirm thinking chunks arrive for the main loop and a subagent, and measure the cost of a generator that yields chunks through.
E3 Several panes open with tabs: find the pane count limit; check drill-in with a back Button and a Button under an Svg.
E4 `$.agent.list()` for a background subagent and a teammate: is `parentId` set, how do `status` values move, and is the teammate listed (4.3 open Q5).
E5 Per-agent usage sums: compare `turn.complete.usage` per agent with the subagent transcript's `usage` fields (4.3 Q3) for one run.
E6 Window: read `$.session.usage().context.window` on main; for a subagent with another model, find whether any API gives its window. If none, use a table and mark it.
E7 Background shell tasks: run one background Bash and see whether any live API lists it; if not, use stop-time `background_tasks` only.
E8 `$.fs.read` of a handoff record from a hook with the session cwd at the repo root on Windows (path separators).

Confidence: Medium. The D: facts are read from a 2.1.308 copy, not the installed build, and the online docs were not re-fetched; I did not confirm against the build the human runs. Low for the subagent window, live background shells and the per-tool-call token split. Stale-source flag: the 4.2 and 4.3 handbacks predate `$.ui.view`, `turn.step` usage and `Color` hex.

Open questions:
1. Installed build: re-copy `claude-code.d.ts` from the plugin-authoring skill of the build the human runs (`/plugin-types` per 4.2) and check these lines before step 17.
2. No memory saved: the record says write nothing, so manage-memory save was skipped. Save the D: line map if the caller wants it kept.
3. Pane count limit, thinking availability in the transcript, live background shells and subagent windows need the spikes above.
4. The 15 gap-analysis "Human decisions" section was read (lines 29-36); its wording matches the record.
