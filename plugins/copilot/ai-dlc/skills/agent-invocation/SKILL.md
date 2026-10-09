---
name: agent-invocation
description: "Authoritative skill for spawning or invoking another agent with proper context. Use PROACTIVELY before any agent calls another agent — covers Claude `Agent(...)` / `SendMessage` and Copilot/VS Code `agent` tool invocation forms, routing rules to orchestrator / product-manager / agent-manager / research-assistant / product-manager, the SDLC chain and per-stage artifacts, how to brief a cold-started spawned agent with a self-contained handoff, the compressed report a spawned agent returns (path:line citations, one finding per line) so the caller's context lasts longer, the clarification request a stage agent returns to consult upstream agents and how the orchestrator relays it, when to delegate a lookup instead of doing it inline, foreground vs background and parallel calls, trust-but-verify after the spawned agent returns, and when NOT to invoke another agent at all."
---

# agent-invocation

This skill is the single source of truth for how any agent in the AI-DLC multi-agent system spawns or invokes another agent. Every agent (Claude or Copilot/VS Code) must consult this skill before delegating work, handing off across the SDLC, or routing a sub-task to another role. Do not invent invocation conventions — use the forms defined here verbatim.

> Agent names are the defaults; a name chosen at `/init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## When to consult this skill

- You are about to spawn another agent, hand off work, or send a message to a previously spawned agent.
- The user's request spans more than one agent's responsibility and you are unsure who should own it.
- You catch yourself reaching for `WebSearch`, `WebFetch`, or library-docs tools directly — that is a signal to delegate to **Jon Skeet** (`research-assistant`) (see Routing rules).
- You are about to edit any file under `.claude/agents/`, `.github/agents/`, `.github/skills/`, `.claude/skills/`, `.claude/commands/`, `.github/prompts/`, `.claude/rules/`, `.github/instructions/`, or any hook configuration — stop and route to **Boris Cherny** (`agent-manager`) instead.

## When NOT to invoke another agent

- A simple factual question already answered by the current agent's own context.
- A follow-up inside an already-triaged workflow where the receiving agent is already running.
- A task that is fully within the current agent's own responsibilities — do the work, do not subcontract it.
- Trivial one-shot lookups already resolved inline by **Scott Hanselman** (`orchestrator`) during classification.

## Delegate a lookup, or do it inline?

A spawned agent's reads stay in its own context; only its final report enters yours. Delegate when the reads would cost you more context than the compressed answer, and work inline when you must read the code yourself anyway to act on it.

| Situation | Do |
|---|---|
| You already know the file or symbol, or one `Grep` / `Read` answers it | Inline |
| "Where is X defined", "what calls Y", "list every use of Z", cold-start orientation in an unfamiliar area, or a direct search already failed | Spawn **Jon Skeet** (`research-assistant`) with a *locate* brief |
| The locate question has several angles (definitions, callers, tests) | 2–3 `research-assistant` spawns in one message, one angle each; merge their lists yourself |
| You want explanation, options or design commentary, not locations | `research-assistant` with a prose deliverable, or **Mark Richards** (`software-architect`) / **Zoran Horvat** (`system-engineer`) for design |
| A bounded change — at most two files, sites known as `path:line`, no new abstraction | Spawn **David Fowler** (`software-engineer`) with a *change* brief |
| A new feature, three or more files, or a cross-cutting refactor | Not a bounded change: route it through the lifecycle (`ai-dlc`, `implement-feature`) |
| A findings-only check of a diff | Spawn **Robert C. Martin** (`code-reviewer`) asking for the `review` skill's compact format |
| A full review with rationale, or the review the human approves at G4 | `code-reviewer` with the `review` skill's full report |

**Locate → change → check.** `research-assistant` returns the sites; you pick one or two and hand their exact `path:line` to `software-engineer`; `code-reviewer` checks the resulting diff. Skip *locate* when the site is already known. A change brief without its sites forces the engineer to search, which spends the context the chain was meant to save. Only the session's main agent can run this chain, because a subagent cannot spawn further agents.

## Invocation mechanisms

### Claude Code

- **Plugin namespacing** — every team agent ships in the `ai-dlc` plugin, so its Claude Code id is `ai-dlc:<agent-name>` (for example `software-engineer`). Skills are likewise `ai-dlc:<skill-name>`. On Copilot the bare name is used.

- **Spawn a cold agent** — primary form, used for all new delegations:

  ```
  Agent(subagent_type: "ai-dlc:<agent-name>", description: "<one-line task summary>", prompt: "<self-contained brief>")
  ```

- **Continue an already-spawned agent** — preserves the agent's working memory; cheaper than a cold respawn:

  ```
  SendMessage({to: "<agent-id-or-name-returned-by-Agent>", message: "<follow-up>"})
  ```

- **Parallel independent agents** — issue multiple `Agent(...)` calls in a single message. Each runs concurrently and returns to the caller, who synthesizes the combined output. This is the canonical form for orchestration mode 2 (Parallel independent subagents) in the `request-routing` skill.

- **Foreground vs background** — default to foreground (you block until the agent returns). Use background only for genuinely independent long-running work where the caller has other useful work to do meanwhile.

### Copilot / VS Code

- **Spawn an agent** — use the platform-native `agent` tool, targeting the desired agent by name and passing a self-contained prompt:

  > Invoke the `agent` tool against `<agent-name>` with prompt "<self-contained brief>".

- **Continue an already-spawned agent** — send a follow-up message to that named agent rather than re-spawning a cold instance.

- **Parallel independent agents** — issue multiple `agent` tool calls in a single message; the caller synthesizes outputs.

- **Foreground vs background** — default to foreground. Background mode is reserved for genuinely independent long-running work.

> Do not invent new invocation syntax on either platform. If a form is not listed here, treat it as unsupported and ask `agent-manager` whether the skill needs updating.

## Routing rules every caller must respect

- **Every human request → `orchestrator` first.** The orchestrator gets intent and classifies the request; for non-trivial / multi-step / ambiguous requests it gets a work breakdown from **James Montemagno** (`product-manager`) (work items, dependencies, priorities, waves), then routes each item (lifecycle, mode, chain) into a Routing Plan, confirms it with the human and executes it. Skipping classification and breakdown to save time costs more than it saves.
- **Any agent / skill / command / prompt / rules / instructions / hook file lifecycle work → `agent-manager`.** No other agent edits files under `.claude/agents/`, `.github/agents/`, `.github/skills/`, `.claude/skills/`, `.claude/commands/`, `.github/prompts/`, `.claude/rules/`, `.github/instructions/`, or any hook configuration. `agent-manager` is the single authority.
- **External knowledge (library / API / SDK docs, framework conventions, version-specific behavior, current best practices) and non-trivial cross-cutting codebase exploration → `research-assistant`.** Prefer **context7** over web search for library docs. Never run ad-hoc `WebSearch` / `WebFetch` / library-docs tools yourself when a `research-assistant` call would do the job.
- **Product scope, priority, acceptance of stories, release go / no-go → James Montemagno (`product-owner`)**, which directs **James Montemagno** (`requirement-analyst`) and `product-manager`.
- **Backlog management, milestone planning, and the release-gate checklist → `product-manager`.** The `orchestrator` gets the PM's work breakdown before routing any non-trivial batch; the PM's priorities and waves feed the routing decision, and Feature/TechDebt scope or priority decisions go to `product-owner`.
- **SDLC forward chain** — implementation work flows through this order, with each role producing an explicit artifact for the next:

  | Stage | Role | Name | Hands off to next stage |
  |---|---|---|---|
  | 0 | `product-owner` | James Montemagno | Product brief at `docs/product/<slug>/brief.md`, priority decision, delegation list; later acceptance of stage-1 artifacts |
  | 1 | `requirement-analyst` | James Montemagno | Finalized spec at `docs/specs/<feature-slug>.spec.md` with numbered acceptance criteria |
  | 2 | `software-architect` | Mark Richards | Architecture Design Document + ADR under `docs/architecture/decisions/`, plus Implementation Guidance section |
  | 3 | `system-engineer` | Zoran Horvat | Low-level design notes (class/module structure, design-pattern choices, DI registration plan) |
  | 4 | `software-engineer` | David Fowler | Implementation diff + `dotnet test` green + `dotnet stryker` survivors triaged |
  | 5 | `sqa-engineer` (in parallel with `documentation-writer`) | Kent Beck | Test plan, implemented tests, mutation report with surviving-mutant rationale, AC-traceability table |
  | 5 | `documentation-writer` (in parallel with `sqa-engineer`) | Daniele Procida | New or updated `README.md` files reflecting the change |
  | 6 | `code-reviewer` | Robert C. Martin (Uncle Bob) | Severity-ranked findings report (Blocker / Warning / Suggestion) with file:line specificity |

  Always cite the artifact path when invoking the next stage. Never hand off without naming the file the next agent should read first.

- **Lifecycle selection and artifact handoff** — before routing, pick the lifecycle with `Skill("ai-dlc")` (PDLC, ASDLC, STBLC, FDLC, BFLC, RLC, TLC, CRLC). Every stage boundary is crossed with a handoff record written by `Skill("handoff")` to `docs/handoffs/`.
- **Documentation critique** — any spec, ADR, design or README produced by `documentation-writer` (or another agent) is reviewed by **Linus Torvalds** (`brutal-critique`) in parallel before the gate is crossed.

## How to brief the spawned agent

The spawned agent starts **cold** — it does not see this conversation, your prior tool calls, or any context that lives only in your head. The prompt must be fully self-contained.

Required elements in every brief:

- **Goal** — one sentence on the outcome, and one sentence on why it matters.
- **Required context** — concrete artifact paths (`docs/specs/<slug>.spec.md`, `docs/architecture/decisions/NNN-*.md`, plan files, failing test names), file paths with **line numbers**, prior findings from earlier agents, and any constraints discovered so far.
- **Instructions** — the specific question to answer or work to perform, scoped to the receiving agent's role. Do not ask one agent to do another's job.
- **Acceptance criteria** — numbered ACs the deliverable must satisfy.
- **Expected deliverable** — its shape and length (e.g., "findings report ≤ 30 lines", "ADR following the project template", "code diff + passing tests", "test plan with AC-traceability table"). When you, not a human, will read the reply, ask for a **compressed report** and name its contract (see *Compressed reports* below).
- **Write code vs. report only** — say explicitly whether the agent should land code on disk or only return analysis.
- **Next-hop hint** — which agent (if any) receives this agent's output, so the receiving agent can shape its deliverable appropriately.
- **Success criteria** — how you (the caller) will verify the handoff is complete.

Anti-patterns to avoid:

- **Do not delegate synthesis.** "Look into X and fix whatever you find" outsources the *understanding* — that is your job. Do the diagnostic work first, then hand off a scoped task with a clear acceptance criterion.
- **Do not assume shared context.** If the spawned agent needs a file path, a line number, or a prior finding, include it explicitly. A cold agent re-reading the entire repo is wasted tokens.
- **Do not skip the next-hop hint.** Without it, the receiver cannot shape its output for the next stage.

## Compressed reports

A spawned agent's final message enters the caller's context verbatim and stays there for every later turn. Twenty delegations that each return two thousand tokens of prose add forty thousand tokens to the caller's context; the same findings as `path:line` lines cost a fraction. So when the caller is an agent, the reply is compressed; the files the agent writes are not.

**Rules for every compressed report** (the floor of `Skill("terse-output")`):

- One finding per line, location first, as `path:line` or `path:start-end`. Cite only lines actually read; never estimate a range.
- Identifiers, commands, paths and error text verbatim, in backticks.
- No preamble, narrative of the search, or closing summary — a final `totals:` line is the only summary.
- A plain-prose sentence first for any security risk, destructive operation or ambiguity, then the compressed lines.
- Stage artifacts written to disk (spec, ADR, test plan, handoff record, the G4 review report) keep their full templates. Only the message back to the caller is compressed.

**Contracts.** Name the one you want in the brief:

| Brief | Agent | Reply shape | Terminal replies |
|---|---|---|---|
| *locate* | `research-assistant` | ``path:line — `symbol` — note of six words or fewer``; with three or more lines, grouped under one-word headers (`Definitions:`, `Callers:`, `Tests:`); last line `totals: 2 definitions, 5 callers` | `No match.` |
| *research* | `research-assistant` | One finding per line: `<claim> — <source: doc, URL or path:line> (<version>)` | `Inconclusive: <what is missing>.` |
| *change* | `software-engineer` | `path:start-end — <change, ten words or fewer>` per edit, then `verified: re-read OK` (or `mismatch at path:line`) and the test result line | `too-big: split into <n> tasks: …` · `needs-confirm: <operation>` · `ambiguous: <one question>` · `regressed: <path:line> — <cause>` |
| *check* | `code-reviewer` | The `review` skill's compact format: one line per finding, then `totals:` and `verdict:` | `No findings.` |

A terminal reply is the whole answer: stop and act on it — split the work, confirm with the human, answer the question, or send the regression back. Before showing a compressed report to a human, paraphrase it into prose.

Any stage agent, under any contract, may also end with a **clarification request** (below) instead of, or after, its partial deliverable.

## Clarification requests

The Clarify loop in the `ai-dlc` skill lets a stage agent ask the agents that produced its inputs. A subagent cannot spawn another agent, so it returns its questions to the orchestrator, which relays them. Whom an agent may ask, the rules and the round limit live in the `ai-dlc` skill's consultation matrix; this section is only the format and the relay.

**Request** — returned by the asker, all open questions in one batch:

```
clarify: round <r>/3 · <n> questions · blocked: <what waits> · continuing: <what proceeds | nothing>
Q1 → <upstream-agent | human> · <path or AC-n> — <question> · default: <recommended answer>
Q2 → <upstream-agent> · <path:line> — <question> · default: <recommended answer>
```

**Answer** — returned by the upstream agent, one line per question it received:

```
A1 · <answer> · revised: none | <path> (by me)
A2 · pass → <its own upstream agent | human> · <why it cannot answer>
```

**Relay** — the orchestrator, for each request:

1. Check every target against the asker's row in the matrix; redirect a question aimed at the wrong owner.
2. Group the questions by target and send each target one message. If the instance that produced the artifact is still available, continue it with `SendMessage` (on Copilot, a follow-up to the named agent); otherwise spawn a fresh one with a brief whose *Required context* is the artifact path, the handoff record and the questions verbatim with their defaults, and whose deliverable is the answer format above — report only, unless the answer requires revising the target's own artifact.
3. Ask the human, with the recommended defaults, any question marked `human` or passed up with no agent left to answer it.
4. Verify every `revised:` artifact on disk before relaying (trust but verify).
5. Return all answers to the asker with one `SendMessage`, which resumes its stage. If the asker's instance is gone, spawn a fresh one with its original brief plus the answers.
6. Count rounds per stage; when a question is still open after round 3, block the stage and escalate to the human.

When the session's main agent is itself a stage agent, it skips the relay and spawns or messages the upstream agent directly, with the same request and answer formats.

## Parallelism and concurrency

- For **independent sub-tasks** (no collaboration needed between them) — fire multiple `Agent(...)` calls in a single message on Claude, or multiple `agent` tool calls in a single message on Copilot/VS Code. The orchestrator synthesizes the combined output.
- For **research breadth** (e.g., comparing 3–5 options) — spawn 3–5 `research-assistant` subagents in parallel, each with a distinct angle, then synthesize.
- For **collaborative SDLC work** — do **not** parallelize within the chain; run it sequentially with explicit handoffs (Mode 3 in `request-routing`).
- Background mode is for genuinely long-running independent work only — not a default. Most invocations should be foreground.

## Trust but verify

A spawned agent's summary describes **intent**, not necessarily what landed on disk:

- After the agent returns, **verify changed files** with `Read` / `Grep` (Claude) before reporting work complete on the agent's behalf.
- Mark `TodoWrite` / `todo` items Done only after verification, not on the agent's claim alone.
- If verification fails, send a `SendMessage` (or Copilot equivalent) follow-up to the same agent rather than respawning a cold instance — the original context is still warm.

## Companion skills

- `request-routing` — the `orchestrator` classifies every request and decides *which* workflow, agent (or team) and orchestration mode each work item gets; this skill covers the mechanics of invoking them with proper context. 
- `task-triage` — the `product-manager` decomposes and triages the work (dependencies, bug severity, priorities, waves).

## Authority

This skill is authoritative. If an agent's own definition file describes invocation behavior that contradicts this skill, the skill wins, and the agent file should be updated via `agent-manager`. Do not silently diverge.

Adapted in part from [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) (Apache-2.0); modified.
