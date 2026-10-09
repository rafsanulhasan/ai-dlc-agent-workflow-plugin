# AGENTS.md — {{PRODUCT}}

This file is the orchestration authority for every AI agent working in this repository (Claude Code, GitHub Copilot CLI, VS Code). It is loaded by both platforms. The agent team itself ships in the **ai-dlc** plugin; this file holds the rules specific to this repository.

## Commands

| Purpose | Command |
|---|---|
| Build | `{{BUILD_CMD}}` |
| Test | `{{TEST_CMD}}` |
| Mutation test | `{{MUTATION_CMD}}` |

## AI-DLC operating model

- **Every human request goes to the `orchestrator` first** (`ai-dlc:orchestrator`, the default agent in Claude Code via `.claude/settings.json`). It gets intent, has `triage-agent` classify and decompose the work into a routing plan (lifecycle, mode, agent chain), gets scope and priority decisions from `product-owner`, confirms the plan with the human, then drives the team and verifies every artifact.
- Eight named lifecycles: **PDLC** product design · **ASDLC** architecture & design · **STBLC** story & task breakdown · **FDLC** feature development · **BFLC** bug fixing · **RLC** refactoring · **TLC** testing · **CRLC** code review.
- **Every handoff is an artifact.** Stage boundaries are crossed with a handoff record in `docs/handoffs/`; the orchestrator verifies it before the next agent starts.
- **The human is the decision maker.** Humans set intent, approve gates G1 (stories/ACs), G2 (frozen spec), G3 (task plan) and G4 (review report), and resolve ambiguity. Agents never guess intent.

## Routing rules

| Request touches | Goes to |
|---|---|
| Every human request | `orchestrator` (which calls `triage-agent` to plan non-trivial work) |
| Agent definitions, skills, hooks, rules/instructions, commands/prompts, agent memory | `agent-manager` — the only agent allowed to change them |
| External knowledge (library/API/SDK behaviour, versions, standards) or wide codebase exploration | `research-assistant` |
| Product scope, priority, story acceptance, release go / no-go | `product-owner` (directs `requirement-analyst` and `product-manager`) |
| Backlog records, milestones, release-gate checklist | `product-manager` |
| Any document at a gate | `documentation-writer` writes, `brutal-critique` critiques in parallel |

## Artifact locations

| Artifact | Path |
|---|---|
| Backlog | `docs/backlog/backlog.md` |
| Product docs / stories | `docs/product/` |
| Frozen specs | `docs/specs/<feature-slug>.spec.md` |
| ADRs | `docs/architecture/decisions/` |
| Architecture narratives | `docs/architecture/narratives/<feature-slug>.md` |
| Task plans | `docs/plans/<feature-slug>.tasks.md` |
| Handoff records | `docs/handoffs/<work-item>/` |

## Quality gates

- After any change to runtime code, test code, runtime configuration or build logic: `{{TEST_CMD}}` must pass (enforced by the test gate hook in .NET repositories), then `{{MUTATION_CMD}}` is run by `sqa-engineer`. Mutation break threshold: **{{MUTATION_BREAK}}%**.
- Artifact-only changes (planning, agents, skills, hooks, prompts/commands, rules/instructions) may skip both gates.
- `code-reviewer` approves only at **zero Blockers**.

## Anti-hallucination protocol (all agents)

- Never invent API surfaces, file paths, library behaviours, versions, configuration keys or project facts.
- Unsure of a fact → spawn `research-assistant` (in parallel for several questions). Unsure of intent → ask the human one targeted question.
- Prefer "I don't know — let me verify" over a confident guess.

## Memory protocol

- Each agent keeps persistent memory under `.claude/agent-memory/<agent-name>/` with a `MEMORY.md` index, managed through the `manage-memory` skill.
- Load at the start of a task; save durable learnings (decisions, recurring pitfalls, conventions) at the end. Never store secrets.

## Repository conventions

See `.claude/rules/` (Claude) and `.github/instructions/` (Copilot) — identical content. Add project-specific architecture notes here:

- {{ARCHITECTURE_NOTES}}
