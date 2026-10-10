---
name: request-routing
description: "The orchestrator's single routing skill. Classifies every incoming request, decides which AI-DLC workflow (lifecycle) each work item runs — the one the user explicitly asked for, otherwise chosen from the ai-dlc lifecycles — or which single agent it is handed to, assigns the agent chain, and picks the orchestration mode (direct delegation, parallel subagents, sequential agent team, full traversal). Produces the Routing Plan. The orchestrator only delegates; this skill never does engineering work itself."
---

# Request Routing

**Scott Hanselman** (`orchestrator`) runs this skill for every human request. It turns the request into a **Routing Plan**: for each work item, the AI-DLC workflow to run (or the single agent to hand it to), the agent chain and the orchestration mode. Decomposition, dependencies, priorities and bug severity come from **James Montemagno** (`product-manager`)'s `task-triage` skill; this skill consumes that breakdown.

> Agent names are the defaults; a name chosen at `/ai-dlc:init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

```
Skill("ai-dlc:request-routing", args: "classify <request>")      // Step 1
Skill("ai-dlc:request-routing", args: "route <work breakdown>")  // Steps 2–5
```

## Delegation only

The orchestrator's job is delegation. Every piece of real work goes to the agent that owns it:

| Work | Owner | Name |
|---|---|---|
| Requirements, stories, ACs | `requirement-analyst` (directed by `product-owner`) | James Montemagno |
| Scope, priority, acceptance, release go / no-go | `product-owner` | James Montemagno |
| Work breakdown, bug triage, backlog | `product-manager` | James Montemagno |
| Architecture, ADRs, specs | `software-architect` | Mark Richards |
| Low-level design | `system-engineer` | Zoran Horvat |
| Code, fixes, refactors | `software-engineer` | David Fowler |
| Tests, mutation gate | `sqa-engineer` | Kent Beck |
| Review | `code-reviewer` | Robert C. Martin (Uncle Bob) |
| Documents | `documentation-writer` (critiqued by `brutal-critique`) | Daniele Procida (+ Linus Torvalds) |
| Slide decks (.pptx) — create, update, review | `presentation-manager` | Nancy Duarte |
| Research, library/API facts, wide code exploration | `research-assistant` | Jon Skeet |
| CI/CD, packaging, releases | `devops-engineer` | Gene Kim |
| Agents, skills, hooks, rules, commands, agent memory | `agent-manager` | Boris Cherny |

The orchestrator never writes code, tests, designs, specs or documents, never runs research, and never reviews code itself. It reads only enough of the repository to route correctly and to verify artifacts. If no agent owns a piece of work, that is a capability gap (Step 3), not a reason to do it yourself.

## Step 1 — Classify

First check for **agent-artifact work** (agents, skills, hooks, rules/instructions, commands/prompts, agent memory). If the request only touches those, stop: it goes straight to `agent-manager` (Mode 1, no lifecycle, no work breakdown).

Otherwise identify all task types present:

| Type | Indicators |
|---|---|
| Feature | "Add X", "I want X", "we need X", new capability |
| Bug Fix | Crash, incorrect behavior, failing test, exception, regression |
| Security Fix | Auth bypass, data exposure, input validation gap, vulnerable dependency |
| TechDebt | Refactor, convention violation, cleanup, performance |
| Testing | Missing coverage, AC traceability, weak mutation score |
| Review | An open change or PR to drive to merge-ready |
| Release | "Ship", "release", "deploy", "publish" |
| Question | Exploratory — "what would...", "how should we..." |

A single request may contain multiple types.

Record whether the user **explicitly named a workflow** — a lifecycle by name or code (AI-DLC, PDLC, ASDLC, STBLC, FDLC, BFLC, RLC, TLC, CRLC) or an unambiguous equivalent ("full lifecycle", "end to end", "take it from idea to release" for AI-DLC; "run a code review on PR 42", "just write the tests", "only design it, don't build"). An explicit choice is binding in Step 2.

Decide whether the request needs a work breakdown from `product-manager` (`task-triage`):

- **Yes** — more than one type, more than one agent, or any Feature / Bug / Security / TechDebt work that touches the backlog.
- **No** — a single question or a single-agent task with no dependencies; continue with Step 2 directly.

Security fixes and regressions are flagged `route-immediately`; send them for breakdown in parallel with starting work, not before it.

### Step 1 output

```
### Classification: <request summary>
- Types: <type(s)> — <one sentence why>
- Explicit workflow requested: <lifecycle | none>
- Agent-artifact work: <yes → agent-manager | no>
- Work breakdown needed: <yes → product-manager task-triage | no>
- Route immediately (P0): <yes | no>
- Open questions for the human: <questions | none>
```

## Step 2 — Decide the workflow for each work item

Load `Skill("ai-dlc:ai-dlc")` and use its lifecycle table — never pick from memory.

1. **The user named a workflow** → run exactly that lifecycle for the items it covers. If it cannot work as asked (for example FDLC requested but no stories or spec exist), do not silently switch: tell the human what is missing and propose the earlier lifecycle that produces it.
2. **No workflow named** → decide per work item from its state, earliest missing artifact first:

| The work item… | Workflow |
|---|---|
| is a feature, epic or idea that must reach release | **AI-DLC** (enter at its earliest missing artifact) |
| is scoped to product design only, or is the Plan segment of a split AI-DLC run | **PDLC** |
| is scoped to design only (has stories, no frozen spec), or is that segment of a split AI-DLC run | **ASDLC** |
| is scoped to task breakdown only (has a frozen spec, no task plan), or is that segment of a split AI-DLC run | **STBLC** |
| is scoped to building already-planned tasks, or is that segment of a split AI-DLC run | **FDLC** |
| is incorrect behaviour, a failing test or a regression | **BFLC** (P0 security: BFLC with `security-review` first) |
| must change structure without changing behaviour | **RLC** |
| lacks coverage, AC traceability or mutation strength | **TLC** |
| is an open change / PR to drive to merge-ready | **CRLC** |
| is a release | Release phase (`product-manager` checklist → `product-owner` go / no-go → `devops-engineer`) |

Feature work defaults to **AI-DLC**: one item that runs from its earliest missing artifact through G1–G4 to Release, gated by the human at each boundary. Pick a segment lifecycle (PDLC, ASDLC, STBLC, FDLC) only when the user limits scope to it or `product-manager` split the AI-DLC run into separate items. A bug or refactor that turns out to need new behaviour forks an AI-DLC item.

3. **No lifecycle needed** → hand the item to one agent instead:

| The work item is… | Hand off to | Name |
|---|---|---|
| agent-artifact work | `agent-manager` | Boris Cherny |
| a factual or library/API question, or wide code exploration | `research-assistant` | Jon Skeet |
| a backlog or prioritisation question | `product-manager` | James Montemagno |
| a scope or priority decision | `product-owner` | James Montemagno |
| an architecture question | `software-architect` | Mark Richards |
| a low-level design question | `system-engineer` | Zoran Horvat |
| a documentation-only change | `documentation-writer` (+ `brutal-critique`) | Daniele Procida (+ Linus Torvalds) |
| a slide deck to create, update or review | `presentation-manager` | Nancy Duarte |
| a CI/CD or pipeline change | `devops-engineer` | Gene Kim |

State the reason for every choice in the Routing Plan, so the human can correct it at the Confirm step.

## Step 3 — Assign the agent chain

Within the chosen workflow, use the agents the `ai-dlc` lifecycle lists for its stages. For work handed to one agent, the chain is that agent. Then apply:

- **Research-prepend rule** — if the item is marked *needs research* in the breakdown, or its design or implementation depends on external technology the team has not recently verified, prepend `research-assistant`; the next agent waits for the cited findings report.
- **Scope decision first** — Feature or TechDebt items flagged for a `product-owner` decision get `product-owner` before the build chain.
- **Capability gaps** — if no agent has the skill, hook, command or MCP tool an item needs, add a preceding `agent-manager` item to create or attach it and make the original item depend on it. Never route to an agent that lacks the capability, and never fill the gap yourself.

## Step 4 — Pick the orchestration mode

Run this once per planning cycle over the whole batch, so cross-item dependencies and shared context are visible.

| Mode | When to use | How to execute |
|---|---|---|
| **1. Direct single-agent delegation** | One agent's expertise fully covers the item; no collaboration or lifecycle traversal needed | Hand off with a self-contained brief (`agent-invocation`). Done. |
| **2. Parallel independent subagents** | The item splits into sub-tasks that do not need each other (research angles, independent reviews or analyses) | Spawn them in one message; the orchestrator synthesizes. For broad research, 3–5 `research-assistant` subagents, each with a distinct angle. |
| **3. Sequential agent team** | Roles must collaborate — design informs implementation, implementation informs testing | Run the lifecycle's stages in order with explicit handoffs (`handoff`). |
| **4. Full lifecycle traversal** | The item is an **AI-DLC** run, or otherwise crosses several lifecycles (requirements → architecture → implementation → test/docs → review → release) | Run the AI-DLC stages in order from the earliest missing artifact, gate by gate; use the `product-manager`'s breakdown for FDLC waves; coordinate inter-team handoffs. |

Decision tree:

1. Can one agent fully own the item? → **Mode 1**.
2. Do its sub-tasks need no collaboration? → **Mode 2**.
3. Otherwise → **Mode 3** for one lifecycle, **Mode 4** for an AI-DLC run or any item that spans several lifecycles.

Rules:

- Prefer the smallest mode that fits; never collapse a needed team into one agent to save calls, and never expand a single-agent task into a team.
- Within a sequential chain, parallelize only where the lifecycle allows it (for example `sqa-engineer` and `documentation-writer` after `software-engineer`; `software-architect` and `system-engineer` together in design).
- Re-plan when progress reveals new constraints or scope: return to Step 2 for the affected items only.

## Step 5 — Write the Routing Plan

Use the Routing Plan format in the orchestrator definition: classification, work items with workflow (lifecycle or hand-off agent), reason, mode and agent chain, execution waves, flags and expected human gates. Present it to the human at the Confirm step before any delegation, except `route-immediately` items.
