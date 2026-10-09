---
name: agent-invocation
description: "Authoritative skill for spawning or invoking another agent with proper context. Use PROACTIVELY before any agent calls another agent — covers Claude `Agent(...)` / `SendMessage` and Copilot/VS Code `agent` tool invocation forms, routing rules to orchestrator / triage-agent / agent-manager / research-assistant / product-manager, the SDLC chain and per-stage artifacts, how to brief a cold-started spawned agent with a self-contained handoff, foreground vs background and parallel calls, trust-but-verify after the spawned agent returns, and when NOT to invoke another agent at all."
---

# agent-invocation

This skill is the single source of truth for how any agent in the AI-DLC multi-agent system spawns or invokes another agent. Every agent (Claude or Copilot/VS Code) must consult this skill before delegating work, handing off across the SDLC, or routing a sub-task to another role. Do not invent invocation conventions — use the forms defined here verbatim.

## When to consult this skill

- You are about to spawn another agent, hand off work, or send a message to a previously spawned agent.
- The user's request spans more than one agent's responsibility and you are unsure who should own it.
- You catch yourself reaching for `WebSearch`, `WebFetch`, or library-docs tools directly — that is a signal to delegate to `research-assistant` (see Routing rules).
- You are about to edit any file under `.claude/agents/`, `.github/agents/`, `.github/skills/`, `.claude/skills/`, `.claude/commands/`, `.github/prompts/`, `.claude/rules/`, `.github/instructions/`, or any hook configuration — stop and route to `agent-manager` instead.

## When NOT to invoke another agent

- A simple factual question already answered by the current agent's own context.
- A follow-up inside an already-triaged workflow where the receiving agent is already running.
- A task that is fully within the current agent's own responsibilities — do the work, do not subcontract it.
- Trivial one-shot lookups already resolved inline by `triage-agent` during classification.

## Invocation mechanisms

### Claude Code

- **Plugin namespacing** — every team agent ships in the `ai-dlc` plugin, so its Claude Code id is `ai-dlc:<agent-name>` (for example `ai-dlc:software-engineer`). Skills are likewise `ai-dlc:<skill-name>`. On Copilot the bare name is used.

- **Spawn a cold agent** — primary form, used for all new delegations:

  ```
  Agent(subagent_type: "ai-dlc:<agent-name>", description: "<one-line task summary>", prompt: "<self-contained brief>")
  ```

- **Continue an already-spawned agent** — preserves the agent's working memory; cheaper than a cold respawn:

  ```
  SendMessage({to: "<agent-id-or-name-returned-by-Agent>", message: "<follow-up>"})
  ```

- **Parallel independent agents** — issue multiple `Agent(...)` calls in a single message. Each runs concurrently and returns to the caller, who synthesizes the combined output. This is the canonical form for orchestration mode 2 (Parallel independent subagents) in the `agent-selection` skill.

- **Foreground vs background** — default to foreground (you block until the agent returns). Use background only for genuinely independent long-running work where the caller has other useful work to do meanwhile.

### Copilot / VS Code

- **Spawn an agent** — use the platform-native `agent` tool, targeting the desired agent by name and passing a self-contained prompt:

  > Invoke the `agent` tool against `<agent-name>` with prompt "<self-contained brief>".

- **Continue an already-spawned agent** — send a follow-up message to that named agent rather than re-spawning a cold instance.

- **Parallel independent agents** — issue multiple `agent` tool calls in a single message; the caller synthesizes outputs.

- **Foreground vs background** — default to foreground. Background mode is reserved for genuinely independent long-running work.

> Do not invent new invocation syntax on either platform. If a form is not listed here, treat it as unsupported and ask `agent-manager` whether the skill needs updating.

## Routing rules every caller must respect

- **Every human request → `orchestrator` first.** The orchestrator gets intent, then sends non-trivial / multi-step / ambiguous requests to `triage-agent`, which returns a routing plan (work items, lifecycle, mode, chain, flags). The orchestrator confirms the plan with the human and executes it. Skipping triage to save time costs more than it saves.
- **Any agent / skill / command / prompt / rules / instructions / hook file lifecycle work → `agent-manager`.** No other agent edits files under `.claude/agents/`, `.github/agents/`, `.github/skills/`, `.claude/skills/`, `.claude/commands/`, `.github/prompts/`, `.claude/rules/`, `.github/instructions/`, or any hook configuration. `agent-manager` is the single authority.
- **External knowledge (library / API / SDK docs, framework conventions, version-specific behavior, current best practices) and non-trivial cross-cutting codebase exploration → `research-assistant`.** Prefer **context7** over web search for library docs. Never run ad-hoc `WebSearch` / `WebFetch` / library-docs tools yourself when a `research-assistant` call would do the job.
- **Product scope, priority, acceptance of stories, release go / no-go → `product-owner`**, which directs `requirement-analyst` and `product-manager`.
- **Backlog management, milestone planning, and the release-gate checklist → `product-manager`.** The `orchestrator` consults the PM (flagged by `triage-agent`) before the plan is executed for any Feature or TechDebt batch; feed PM priorities into the routing decision.
- **SDLC forward chain** — implementation work flows through this order, with each role producing an explicit artifact for the next:

  | Stage | Role | Hands off to next stage |
  |---|---|---|
  | 0 | `product-owner` | Product brief at `docs/product/<slug>/brief.md`, priority decision, delegation list; later acceptance of stage-1 artifacts |
  | 1 | `requirement-analyst` | Finalized spec at `docs/specs/<feature-slug>.spec.md` with numbered acceptance criteria |
  | 2 | `software-architect` | Architecture Design Document + ADR under `docs/architecture/decisions/`, plus Implementation Guidance section |
  | 3 | `system-engineer` | Low-level design notes (class/module structure, design-pattern choices, DI registration plan) |
  | 4 | `software-engineer` | Implementation diff + `dotnet test` green + `dotnet stryker` survivors triaged |
  | 5 | `sqa-engineer` (in parallel with `documentation-writer`) | Test plan, implemented tests, mutation report with surviving-mutant rationale, AC-traceability table |
  | 5 | `documentation-writer` (in parallel with `sqa-engineer`) | New or updated `README.md` files reflecting the change |
  | 6 | `code-reviewer` | Severity-ranked findings report (Blocker / Warning / Suggestion) with file:line specificity |

  Always cite the artifact path when invoking the next stage. Never hand off without naming the file the next agent should read first.

- **Lifecycle selection and artifact handoff** — before routing, pick the lifecycle with `Skill("ai-dlc:ai-dlc")` (PDLC, ASDLC, STBLC, FDLC, BFLC, RLC, TLC, CRLC). Every stage boundary is crossed with a handoff record written by `Skill("ai-dlc:handoff")` to `docs/handoffs/`.
- **Documentation critique** — any spec, ADR, design or README produced by `documentation-writer` (or another agent) is reviewed by `brutal-critique` in parallel before the gate is crossed.

## How to brief the spawned agent

The spawned agent starts **cold** — it does not see this conversation, your prior tool calls, or any context that lives only in your head. The prompt must be fully self-contained.

Required elements in every brief:

- **Goal** — one sentence on the outcome, and one sentence on why it matters.
- **Required context** — concrete artifact paths (`docs/specs/<slug>.spec.md`, `docs/architecture/decisions/NNN-*.md`, plan files, failing test names), file paths with **line numbers**, prior findings from earlier agents, and any constraints discovered so far.
- **Instructions** — the specific question to answer or work to perform, scoped to the receiving agent's role. Do not ask one agent to do another's job.
- **Acceptance criteria** — numbered ACs the deliverable must satisfy.
- **Expected deliverable** — its shape and length (e.g., "findings report ≤ 30 lines", "ADR following the project template", "code diff + passing tests", "test plan with AC-traceability table").
- **Write code vs. report only** — say explicitly whether the agent should land code on disk or only return analysis.
- **Next-hop hint** — which agent (if any) receives this agent's output, so the receiving agent can shape its deliverable appropriately.
- **Success criteria** — how you (the caller) will verify the handoff is complete.

Anti-patterns to avoid:

- **Do not delegate synthesis.** "Look into X and fix whatever you find" outsources the *understanding* — that is your job. Do the diagnostic work first, then hand off a scoped task with a clear acceptance criterion.
- **Do not assume shared context.** If the spawned agent needs a file path, a line number, or a prior finding, include it explicitly. A cold agent re-reading the entire repo is wasted tokens.
- **Do not skip the next-hop hint.** Without it, the receiver cannot shape its output for the next stage.

## Parallelism and concurrency

- For **independent sub-tasks** (no collaboration needed between them) — fire multiple `Agent(...)` calls in a single message on Claude, or multiple `agent` tool calls in a single message on Copilot/VS Code. The orchestrator synthesizes the combined output.
- For **research breadth** (e.g., comparing 3–5 options) — spawn 3–5 `research-assistant` subagents in parallel, each with a distinct angle, then synthesize.
- For **collaborative SDLC work** — do **not** parallelize within the chain; run it sequentially with explicit handoffs (Mode 3 in `agent-selection`).
- Background mode is for genuinely long-running independent work only — not a default. Most invocations should be foreground.

## Trust but verify

A spawned agent's summary describes **intent**, not necessarily what landed on disk:

- After the agent returns, **verify changed files** with `Read` / `Grep` (Claude) before reporting work complete on the agent's behalf.
- Mark `TodoWrite` / `todo` items Done only after verification, not on the agent's claim alone.
- If verification fails, send a `SendMessage` (or Copilot equivalent) follow-up to the same agent rather than respawning a cold instance — the original context is still warm.

## Companion skills

- `agent-selection` — decides *which* agent (or team) to invoke and which of the four orchestration modes applies. Use it alongside this skill: `agent-selection` picks the targets and mode; `agent-invocation` covers the mechanics of actually invoking them with proper context.
- `triage` — the primary caller of both skills, run at the start of every non-trivial user request.

## Authority

This skill is authoritative. If an agent's own definition file describes invocation behavior that contradicts this skill, the skill wins, and the agent file should be updated via `agent-manager`. Do not silently diverge.
