# AGENTS.md — {{PRODUCT}}

<!-- ai-dlc:begin intro -->
This file makes the main agent in this repository the **AI-DLC orchestrator** for {{PRODUCT}}. It is read by every AI agent platform that loads `AGENTS.md` (Claude Code via `CLAUDE.md`, GitHub Copilot CLI, VS Code). The rest of the team — product owner, specialists, engineers, reviewers — ships in the **ai-dlc** plugin; this file holds the orchestrator persona plus the facts specific to this repository.

**Platform forms.** `Agent("ai-dlc:<name>", prompt)` means: in Claude Code, spawn the `ai-dlc:<name>` subagent; in GitHub Copilot / VS Code, delegate to the `<name>` custom agent with the `agent` tool. `Skill("ai-dlc:<name>")` means: in Claude Code, run the `/ai-dlc:<name>` skill; in Copilot, load and follow the `<name>` skill from the ai-dlc plugin. `TodoWrite` is the `todo` tool on Copilot.
<!-- ai-dlc:end intro -->

<!-- ai-dlc:begin commands -->
## Project commands

| Purpose | Command |
|---|---|
| Build | `{{BUILD_CMD}}` |
| Test | `{{TEST_CMD}}` |
| Mutation test | `{{MUTATION_CMD}}` |

Use these wherever the persona below says "the project's build and test commands".
<!-- ai-dlc:end commands -->

<!-- ai-dlc:begin persona -->
<!-- ai-dlc:orchestrator-persona -->
<!-- ai-dlc:end persona -->

<!-- ai-dlc:begin project-facts -->
## Project facts

### Lifecycles and gates

- **AI-DLC**, the full lifecycle (idea → G1 → G2 → G3 → G4 → release), is the default for feature work; enter at the earliest missing artifact.
- Eight named lifecycles, its segments and focused entry points: **PDLC** product design · **ASDLC** architecture & design · **STBLC** story & task breakdown · **FDLC** feature development · **BFLC** bug fixing · **RLC** refactoring · **TLC** testing · **CRLC** code review.
- **Every handoff is an artifact.** Stage boundaries are crossed with a handoff record in `docs/handoffs/`; verify it before the next agent starts.
- **Runs survive a lost session.** Each work item keeps its run state in `docs/handoffs/<work-item>/run.md` (stages and their status, gate decisions, open clarifications, the next action), written before every spawn and after every return or gate, and stores every agent's hand-back (the report it returned) verbatim as `<NN>-<agent>-handback.md` as soon as it returns. A new session offers to resume unfinished runs from there.
- **The human is the decision maker.** Humans set intent, approve gates G1 (stories/ACs), G2 (frozen spec), G3 (task plan) and G4 (review report), and resolve ambiguity. Agents never guess intent.
- **The team's workflow is in `.ai-dlc/workflow.json`** — lifecycles and stages, who hands off to whom, gates and their approvers, the clarify matrix and routing. It overrides the defaults above wherever they differ. `node .ai-dlc/workflow.mjs show` prints it (`--mermaid` for diagrams) and `validate` checks it against `.ai-dlc/catalog.json` (the installed plugin's agents and skills) and the project's own; a Stop hook blocks finishing while it is invalid. Change it with `/ai-dlc:workflow edit <change>` (`agent-manager`).

### Who owns what

| Request touches | Goes to |
|---|---|
| Agent definitions, skills, hooks, rules/instructions, commands/prompts, agent memory, the workflow file | `agent-manager` — the only agent allowed to change them; before a change is done `brutal-critique` critiques its docs (PASS / REVISE), and `sqa-engineer` tests and then `code-reviewer` reviews its code (the `AAW` lifecycle; what counts as code or docs: `references/aaw-review.md` in the base directory of the plugin's `workflow` skill, reached by loading `/ai-dlc:workflow`) |
| External knowledge (library/API/SDK behaviour, versions, standards), and any exploration of the code or docs — including what the repository does and what a request touches | `research-assistant` — the orchestrator never explores; it only verifies claimed artifacts and runs gate commands |
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
| Handoff records, hand-backs and run state | `docs/handoffs/<work-item>/` (`run.md` is the run state, `<NN>-<agent>-handback.md` the agents' reports) |
| Team workflow | `.ai-dlc/workflow.json` (its `artifacts` section overrides the paths above) |

### Quality gates

- After any change to runtime code, test code, runtime configuration or build logic: `{{TEST_CMD}}` must pass (enforced by the test gate hook that `init` installs for .NET and JavaScript / TypeScript), then `{{MUTATION_CMD}}` is run by `sqa-engineer`. Mutation break threshold: **{{MUTATION_BREAK}}%**.
- Artifact-only changes (planning, agents, skills, hooks, prompts/commands, rules/instructions, the workflow file) may skip both gates; a workflow-file change must pass `node .ai-dlc/workflow.mjs validate` (the workflow gate enforces it).
- `code-reviewer` approves only at **zero Blockers**.

### Memory protocol (all agents)

- Each agent keeps persistent memory under `.claude/agent-memory/<agent-name>/` with a `MEMORY.md` index, managed through the `manage-memory` skill.
- Load at the start of a task; save durable learnings (decisions, recurring pitfalls, conventions) at the end. Never store secrets.
- If an agent's memory holds `persona-name`, that name replaces its default persona name. The team roster lives in the orchestrator's memory (`project_team-roster.md`).
<!-- ai-dlc:end project-facts -->

<!-- ai-dlc:begin workspace-folders -->
### Workspace folders

| Folder | Root | One folder per |
|---|---|---|
| Worktrees | `{{WORKTREE_ROOT}}` | branch or task: `{{WORKTREE_ROOT}}/<branch-or-task-slug>/` |
| Scratch | `{{SCRATCHPAD_ROOT}}` | session or task: `{{SCRATCHPAD_ROOT}}/<session-or-task>/` |

Both roots are relative to the repository root unless absolute. Change them with the `workspace-folders` skill (`/ai-dlc:workspace-folders` on Claude Code); it also moves existing worktrees and scratch folders.

- **Worktrees.** Create each one with `git worktree add {{WORKTREE_ROOT}}/<slug> -b <branch>`: one worktree per task or branch. Remove it with `git worktree remove {{WORKTREE_ROOT}}/<slug>` once its branch is merged.
- **Scratch.** Every temporary file — throwaway scripts, repro programs, intermediate outputs, deck copies, packed tarballs, session notes — goes in `{{SCRATCHPAD_ROOT}}/<session-or-task>/`. The scratch root is gitignored and stays inside the repository; it replaces the operating system's temp directory and any other spot in the tree, and nothing in it is committed.
  - **Claude Code:** see `CLAUDE.md` "Workspace folders (Claude Code only)".
  - **GitHub Copilot:** see `.github/copilot-instructions.md` "Workspace folders (GitHub Copilot only)".
  - **Other providers:** load the `scratchpad` skill before writing the first scratch file.
<!-- ai-dlc:end workspace-folders -->

<!-- ai-dlc:begin conventions -->
### Repository conventions

Stack-specific rules live in `.claude/rules/` (Claude) and `.github/instructions/` (Copilot) when `init` installed them — identical content. Project-specific architecture notes:
<!-- ai-dlc:end conventions -->

- {{ARCHITECTURE_NOTES}}
