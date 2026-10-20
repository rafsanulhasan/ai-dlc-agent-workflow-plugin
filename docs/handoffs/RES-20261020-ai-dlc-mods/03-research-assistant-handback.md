# Hand-back 03: research-assistant — cluster C-model-effort-routing

Stored verbatim on 2026-10-20 (work item RES-20261020-ai-dlc-mods).

---

I found no existing mod that covers R4/R14 end to end. Each one handles one piece, and all four are Claude Code only. The repo already gives each agent a fixed `model`, and Claude Code lets the caller set both `model` and `effort` on every subagent spawn. So the main gap is a routing policy in `workflow.json` that the orchestrator applies, plus carrying `model`/`reasoning-effort` through to Copilot.

## Per-mod table

| Mod | Function | Mechanism | Harness | License / source | Maturity |
|---|---|---|---|---|---|
| **effortless** | Chooses effort per prompt; bar above the prompt shows effort, context fill and a cache countdown | Hooks `prompt.submit` and `turn.step`. A judge model (Haiku 5.5 by default, or the optional "Jev" judge, which sends prompts to api.typesafe.ai) picks low…max and the mod rewrites effort on each request. It never changes the app's Effort setting. Auto mode only works on Opus/Sonnet 5.5, and judge calls count against usage. | Claude Code ≥2.1.287, terminal and desktop. VS Code and Copilot not mentioned. | MIT, github.com/HeyCubit/effortless | No version number, 249 stars, updated 2026-10-14 |
| **effort-cycle** | Manual effort up/down with Alt+E / Alt+Shift+E, plus a meter in the footer | Keybindings plus a `turn.step` rewrite of **main-thread** requests only. Subagents keep Claude Code's own level. | Claude Code CLI, terminal only | MIT, github.com/Anerco/claude-code-effort-cycle | No version number, 3 stars, known issue #1 |
| **agent-router** | Model **and effort** per subagent role (scout, reviewer, security-reviewer, task, sonic) | `agent.spawn` replaces the subagent type and model before the child starts; `turn.step` reapplies model and effort. Inactive unless `ANTHROPIC_BASE_URL` is set (gateway or proxy endpoint). Needs Node 22. | Claude Code ≥2.1.287, terminal and desktop | MIT, github.com/alexandernicholson/agent-router | v0.10.2, verified only by its author, 9 stars |
| **harness-mods** | Four guards in one: subagent model routing, secret redaction, token tracking, read cache | `agent.spawn` rewrites the requested model onto the author's capability graph, caps top-tier spawns at 3 per session, and needs the `claude-runtime` plugin. **No effort selection.** | Claude Code ≥2.1.287, terminal | MIT, github.com/ucsandman/Agnostic-AI (`engine/mods/harness-mods`) | v0.1.0, "written for the author's harness first", tied to the author's model ladder |

Sources: https://claude-mods.com/effortless/, /effort-cycle/, /agent-router/, /harness-mods/. All facts come from the directory pages. I did not open the GitHub repos.

## Platform facts

- **Claude Code subagent frontmatter** supports `model` (`sonnet`/`opus`/`haiku`/`fable`/full ID/`inherit`) and `effort` (`low`…`max`, depending on the model). `effort` overrides the session level but not `CLAUDE_CODE_EFFORT_LEVEL`. Source: https://code.claude.com/docs/en/sub-agents
  - Plugin agents ignore only `hooks`, `mcpServers`, `permissionMode` and `initialPrompt`. The page doesn't say `model` and `effort` are ignored for plugin agents. **Unverified** that `effort` takes effect in a plugin agent; I read only the first 100k characters of that page.
- **Agent tool, per spawn:** the Agent tool schema in this session has a `model` parameter (sonnet/opus/haiku/fable) and an `effort` parameter (low…max). So the orchestrator can override both on each call. This comes from the tool schema I was given, not from a docs page. One catch: the schema says to set `effort` only when the user, CLAUDE.md or a skill explicitly asks for it. A workflow policy or skill would therefore have to state the effort rule explicitly.
- **Copilot / VS Code:** `.agent.md` accepts `model` as a string or as an array in preference order, and `reasoning-effort` (`low`…`max`). Handoffs also take `model` in the form `<model name> (<vendor>)`. Source: https://code.visualstudio.com/docs/agents/reference/custom-agent-file-reference
  - GitHub's reference lists `model` for GitHub.com, Copilot CLI and IDEs, but not `reasoning-effort`. Source: https://docs.github.com/en/copilot/reference/custom-agents-configuration. **Unverified:** effort support in Copilot CLI.
- **Hooks (settings.json):** no event sets model or effort.
  - `UserPromptSubmit` and `SubagentStart` can only add context.
  - `PreModelSwitch` can only block a switch; `effort` is read-only hook input.
  - `PreToolUse` `updatedInput` replaces a tool's arguments, which in principle includes the Agent tool's `model`/`effort`. **Unverified:** the docs don't confirm this for the Agent tool.
  - Source: https://code.claude.com/docs/en/hooks
  - Mods use a separate engine event layer (`agent.spawn`, `turn.step`) that *can* rewrite model and effort. That layer needs Claude Code ≥2.1.287.

## What the repo already has

- A static `model:` in every agent's frontmatter:
  - `opus`: orchestrator, product-owner, product-manager, requirement-analyst, software-architect, system-engineer, research-assistant, agent-manager (e.g. `plugins/claude/ai-dlc/agents/orchestrator.md:5`, `software-architect.md:5`)
  - `sonnet`: software-engineer (`:4`), sqa-engineer (`:4`), code-reviewer (`:5`), brutal-critique (`:5`), documentation-writer (`:5`), devops-engineer (`:4`), presentation-manager (`:5`)
- `plugins/claude/ai-dlc/skills/agent-management/SKILL.md:72` has a template line `model: <model>`.
- **No `effort:`** in any agent file.
- **No `model`/`effort`** in the `request-routing`, `agent-invocation` or `workflow` skills (grep returned 0), nor in `.ai-dlc/*.json` (0 matches).
- **The Copilot projection drops `model`.** `tools/build-copilot.mjs:152-153` writes only `name`, `description` and `tools`. Copilot agents therefore always run on the user's selected model.

## Per requirement

**R4: automatic model and effort per session or workflow task**
- Covered by:
  - effortless: effort only, main thread only, judge-model cost.
  - agent-router: model and effort per role, but only behind a gateway.
- Gaps:
  - Nothing reads `.ai-dlc/workflow.json` or knows the stage or work-item type.
  - Everything is Claude Code only, so there is nothing for VS Code or Copilot.
  - The repo has no effort setting anywhere.
- Feasibility: **high** without mods. The orchestrator already spawns every stage, so it can pass `model`/`effort` on each Agent call, from a policy plus task signals (lifecycle, priority, item size).
- Recommendation:
  - **Build** a native policy.
  - **Reuse the idea** of effortless's judge only as an optional tiebreaker.
  - Users can install effortless separately for main-thread prompts; there's no need to integrate it.

**R14: routing policy per task or handoff (model and effort per agent)**
- Covered by:
  - agent-router: role → model + effort, the closest conceptually.
  - harness-mods: model only, author-specific.
- Gaps:
  - Their roles don't map to ai-dlc's 15 agents or to its stages.
  - Both need a Claude Code mod runtime (and agent-router also needs `ANTHROPIC_BASE_URL`).
  - The Copilot build drops `model`.
- Feasibility: **high**. Proposed layering (my proposal, not an existing design):
  1. Add `effort:` to agent frontmatter as the default.
  2. Add an optional `routing.models` / per-stage `model` + `effort` override in `workflow.json` and its schema.
  3. Make `request-routing` record model and effort in the Routing Plan, and `agent-invocation` pass them in `Agent(...)`.
  4. Extend `build-copilot.mjs` to emit `model` (mapped to Copilot model names, possibly as a fallback array) and `reasoning-effort`.
- Recommendation:
  - **Build**, and **reuse ideas** from agent-router: role tiers, the per-turn reapply, and the `/routes` decision log.
  - Do **not integrate** any of the four mods: Claude Code only, gateway or author-harness dependencies, low maturity.
  - These changes are agent-artifact work, so they go through agent-manager (AAW).

## Unverified items

- Whether `effort:` is honored in **plugin** agents.
- Whether `PreToolUse` `updatedInput` can rewrite the Agent tool's `model`/`effort`.
- `reasoning-effort` support in Copilot CLI and on GitHub.com.
- Whether mods run in the VS Code extension: none of the four mod pages lists it as a surface.
- Mod repo contents: I didn't fetch the repos.

Plan mode was on, so I made no edits and did not save memory.
