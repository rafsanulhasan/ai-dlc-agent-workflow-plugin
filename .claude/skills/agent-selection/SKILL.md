---
name: agent-selection
description: Expert agent selection and orchestration skill. Use PROACTIVELY to pick the most suitable agent for a task and to decide among four orchestration modes — direct single-agent delegation, parallel independent subagents, sequential SDLC Agent Teams, or a full SDLC traversal — based on task complexity, required expertise, and whether the work needs collaboration.
---

# agent-selection

This is the expert agent selection skill. Use PROACTIVELY to select the most suitable agent for a given task, based on the task requirements and agent capabilities. Also use this skill to orchestrate multi-agent workflows when a task requires multiple agents, skills, or expertise.

## Workflow

```
(research-assistant — optional, when knowledge-dependent) → requirement-analyst → software-architect + system-engineer → software-engineer → (sqa-engineer + documentation-writer) → code-reviewer
```

Use `triage-agent` to orchestrate multi-agent workflows. When the work depends on external knowledge (library/API/SDK docs, unfamiliar framework, current best practices, validating assumptions before design, deep cross-cutting code exploration), prepend `research-assistant` as the first step before any specialist work. After `software-engineer` completes any implementation work (feature, bug fix, or refactor), `sqa-engineer` and `documentation-writer` start in parallel.

## Agent Reference

- **research-assistant** — Read-only research specialist. Invoke when external knowledge is needed: library/API/SDK docs, unfamiliar framework behavior, version-migration info, current best practices, validating assumptions before design or implementation, or non-trivial cross-cutting code exploration where a single Grep is insufficient. Returns a cited, structured findings report. Prefer this over any agent doing ad-hoc WebSearch/WebFetch themselves. Valid as a **first step** in sequential SDLC chains when the work is knowledge-dependent (e.g., before `requirement-analyst` or `software-architect` when external tech is involved).

- **requirement-analyst** — Analyzes requirements. Invoke before any feature work begins.

- **software-architect** — Designs high-level system architecture. Invoke after `requirement-analyst` completes, and after `software-engineer` finishes to validate architectural integrity.

- **system-engineer** — Designs low-level structure: SOLID, design patterns, monads, discriminated unions. Collaborates with `software-architect` to translate requirements into concrete design. Also validates implementation after `software-engineer` finishes.

- **software-engineer** — Implements features, fixes bugs, refactors. Invoke after architecture and design are defined.

- **code-reviewer** — Reviews implementation and test cases after `software-engineer`, `sqa-engineer`, and `documentation-writer` complete their work.

- **sqa-engineer** — Designs and writes test cases, validates tests after `software-engineer` implements features, fixes bugs, and refactors code. Runs in parallel with `documentation-writer`.

- **triage-agent** — Orchestrates and manages multi-agent workflows. Use when a task spans multiple agents or requires coordinated parallel execution.

- **product-manager** — Owns the product backlog, prioritization, and release planning. Consult before starting Feature or TechDebt work. Invoke for release planning and backlog health reviews.

- **documentation-writer** — Writes and maintains documentation, updates README, and updates other documentation such as release notes. Invoked after `software-engineer` completes any implementation work. Runs in parallel with `sqa-engineer`.

- **agent-manager** — **Exclusive owner of all agent artifacts.** Always route here (Mode 1, direct delegation — no SDLC chain) for: agent definitions (`.github/agents/`, `.claude/agents/`), skill files (`.github/skills/`), hooks, rules/instructions (`.claude/rules/`, `.github/instructions/`), and commands/prompts (`.claude/commands/`, `.github/prompts/`). Also handles agent memory prune, audit, and refresh. **Never route these requests to `software-engineer` or any SDLC chain.**

## Decision Framework

Use the following decision tree to pick the right orchestration mode. Always start by analyzing the task: desired outcome, constraints, required expertise, and whether collaboration between roles is required.

### The four orchestration modes

| Mode | When to use | How to execute |
|------|-------------|----------------|
| **1. Direct single-agent delegation** | One agent's expertise fully covers the task. No collaboration or SDLC traversal needed. | Select the agent, hand off with the full Handoff Checklist below. Done. |
| **2. Parallel independent subagents** | Task naturally splits into sub-tasks that do NOT need to talk to each other (e.g., research, parallel reviews, independent analyses). | Spawn multiple subagents in parallel. `triage-agent` synthesizes the combined output. |
| **3. Agent Teams (sequential SDLC)** | Task requires collaboration between roles — design must inform implementation, implementation must inform testing, etc. | Spawn one or more Agent Teams. Each team follows the sequential SDLC chain with explicit handoffs. |
| **4. Full SDLC routing** | Task is complex/large enough that it must traverse the entire SDLC workflow (requirements → architecture → implementation → test/docs → review). | Consult `product-manager` first to decompose into subtasks, then orchestrate per-subtask SDLC teams via `triage-agent`. |

### Selection decision tree

1. **Can a single agent fully own this task?**
   - Yes → Mode 1 (Direct single-agent delegation). Hand off and stop.
   - No → continue.
2. **Are the sub-tasks independent (no collaboration needed between them)?**
   - Yes → Mode 2 (Parallel independent subagents). Spawn in parallel; `triage-agent` synthesizes.
   - No → continue.
3. **Is the task simple-but-SDLC OR complex/large?**
   - Consult `product-manager` to break the task into subtasks.
   - Then choose between Mode 3 (one Agent Team per subtask, sequential SDLC) or Mode 4 (full SDLC traversal across multiple subtasks, coordinated by `triage-agent`).
4. **Continuously monitor.** If progress reveals new constraints or scope, return to step 1 and re-select.

## Rules for Multi-Agent Workflow Orchestration

- **Agent artifact work** → delegate directly to `agent-manager` (Mode 1). **Hard rule** — agent definitions, skills, hooks, rules/instructions, and commands/prompts must never be handled by `software-engineer` or routed through any SDLC chain. Triggers: create, update, fix, or add any of: agent, skill, hook, rule, instruction, command, prompt.

- **Research work** → delegate to `research-assistant`. For broad, multi-angle research (comparison studies, surveys of competing options), spawn **3–5 `research-assistant` subagents in parallel**, each with a distinct angle; `triage-agent` then synthesizes findings into a single report. Triggers: "external knowledge needed", "library/API/SDK docs", "unfamiliar framework", "validate assumption before design", "deep cross-cutting code exploration where Explore is insufficient".
- **Design and implementation work** → follow the SDLC workflow with `triage-agent` orchestrating end to end.
  - When a complex task is decomposed into subtasks, run an SDLC workflow **per subtask**:
    - **No collaboration needed within a subtask** → spawn parallel subagent teams per SDLC role to work simultaneously; `triage-agent` synthesizes outputs.
    - **Collaboration needed within a subtask** → spawn an **Agent Team** that follows the sequential SDLC workflow with clear, explicit handoffs between roles.
  - **Collaboration needed across the whole complex task** → spawn an Agent Team per subtask; each team follows the sequential SDLC; within each team, use parallel subagents per role where it accelerates the work without harming coherence. `triage-agent` coordinates inter-team handoffs.
- **Always prefer the smallest orchestration that fits.** Do not escalate to Mode 3 or 4 if Mode 1 or 2 will suffice.
- **Never skip `product-manager`** for backlog-affecting or release-affecting work.
- **Never skip `triage-agent`** when more than one agent is involved.

### Handoff Checklist

When delegating to any agent (single or part of a team), the handoff must include:

- **Required context** — links to the originating user prompt, prior agent outputs, relevant files, and constraints discovered so far.
- **Instructions** — the specific question to answer or work to perform, scoped to the agent's role.
- **Expected output format** — e.g., findings report, ADR, design document, code diff, test plan, review comments.
- **Success criteria** — how the receiving agent (or `triage-agent`) will know the handoff is complete and acceptable.
- **Next-hop hint** — which agent (if any) receives this agent's output, so the receiving agent can shape its output appropriately.
