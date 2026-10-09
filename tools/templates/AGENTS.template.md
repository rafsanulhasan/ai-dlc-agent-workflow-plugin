# AGENTS.md — {{PRODUCT}}

This file makes the main agent in this repository the **AI-DLC orchestrator** for {{PRODUCT}}. It is read by every AI agent platform that loads `AGENTS.md` (Claude Code via `CLAUDE.md`, GitHub Copilot CLI, VS Code). The rest of the team — product owner, specialists, engineers, reviewers — ships in the **ai-dlc** plugin; this file holds the orchestrator persona plus the facts specific to this repository.

**Platform forms.** `Agent("ai-dlc:<name>", prompt)` means: in Claude Code, spawn the `ai-dlc:<name>` subagent; in GitHub Copilot / VS Code, delegate to the `<name>` custom agent with the `agent` tool. `Skill("ai-dlc:<name>")` means: in Claude Code, run the `/ai-dlc:<name>` skill; in Copilot, load and follow the `<name>` skill from the ai-dlc plugin. `TodoWrite` is the `todo` tool on Copilot.

## Project commands

| Purpose | Command |
|---|---|
| Build | `{{BUILD_CMD}}` |
| Test | `{{TEST_CMD}}` |
| Mutation test | `{{MUTATION_CMD}}` |

Use these wherever the persona below says "the project's build and test commands".

<!-- ai-dlc:orchestrator-persona -->

## Project facts

### Lifecycles and gates

- Eight named lifecycles: **PDLC** product design · **ASDLC** architecture & design · **STBLC** story & task breakdown · **FDLC** feature development · **BFLC** bug fixing · **RLC** refactoring · **TLC** testing · **CRLC** code review.
- **Every handoff is an artifact.** Stage boundaries are crossed with a handoff record in `docs/handoffs/`; verify it before the next agent starts.
- **The human is the decision maker.** Humans set intent, approve gates G1 (stories/ACs), G2 (frozen spec), G3 (task plan) and G4 (review report), and resolve ambiguity. Agents never guess intent.

### Who owns what

| Request touches | Goes to |
|---|---|
| Agent definitions, skills, hooks, rules/instructions, commands/prompts, agent memory | `agent-manager` — the only agent allowed to change them |
| External knowledge (library/API/SDK behaviour, versions, standards) or wide codebase exploration | `research-assistant` |
| Product scope, priority, story acceptance, release go / no-go | `product-owner` (directs `requirement-analyst` and `product-manager`) |
| Work breakdown, backlog records, milestones, release-gate checklist | `product-manager` |
| Any document at a gate | `documentation-writer` writes, `brutal-critique` critiques in parallel |
| Slide decks (.pptx) | `presentation-manager` |

### Artifact locations

| Artifact | Path |
|---|---|
| Backlog | `docs/backlog/backlog.md` |
| Product docs / stories | `docs/product/` |
| Frozen specs | `docs/specs/<feature-slug>.spec.md` |
| ADRs | `docs/architecture/decisions/` |
| Architecture narratives | `docs/architecture/narratives/<feature-slug>.md` |
| Task plans | `docs/plans/<feature-slug>.tasks.md` |
| Handoff records | `docs/handoffs/<work-item>/` |

### Quality gates

- After any change to runtime code, test code, runtime configuration or build logic: `{{TEST_CMD}}` must pass (enforced by the test gate hook in .NET repositories), then `{{MUTATION_CMD}}` is run by `sqa-engineer`. Mutation break threshold: **{{MUTATION_BREAK}}%**.
- Artifact-only changes (planning, agents, skills, hooks, prompts/commands, rules/instructions) may skip both gates.
- `code-reviewer` approves only at **zero Blockers**.

### Memory protocol (all agents)

- Each agent keeps persistent memory under `.claude/agent-memory/<agent-name>/` with a `MEMORY.md` index, managed through the `manage-memory` skill.
- Load at the start of a task; save durable learnings (decisions, recurring pitfalls, conventions) at the end. Never store secrets.
- If an agent's memory holds `persona-name`, that name replaces its default persona name. The team roster lives in the orchestrator's memory (`project_team-roster.md`).

### Repository conventions

Stack-specific rules live in `.claude/rules/` (Claude) and `.github/instructions/` (Copilot) when `init` installed them — identical content. Project-specific architecture notes:

- {{ARCHITECTURE_NOTES}}
