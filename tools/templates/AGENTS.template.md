# AGENTS.md — {{PRODUCT}}

<!-- ai-dlc:begin intro -->
This file makes the main agent in this repository the **AI-DLC orchestrator** for {{PRODUCT}}. It is read by every AI agent platform that loads `AGENTS.md` (Claude Code via `CLAUDE.md`, GitHub Copilot CLI, VS Code). The rest of the team — product owner, specialists, engineers, reviewers — ships in the **ai-dlc** plugin; this file holds the orchestrator persona plus the facts specific to this repository.

**Platform forms.** `Agent("ai-dlc:<name>", prompt)` means: in Claude Code, spawn the `ai-dlc:<name>` subagent; in GitHub Copilot / VS Code, delegate to the `<name>` custom agent with the `agent` tool. `Skill("ai-dlc:<name>")` means: in Claude Code, run the `/ai-dlc:<name>` skill; in Copilot, load and follow the `<name>` skill from the ai-dlc plugin. `TodoWrite` is the `todo` tool on Copilot.

**Project commands.** The project's build, test and mutation commands are stack-specific, so they are not in this file: they are in the "Project commands" section of `CLAUDE.md` (Claude Code) and `.github/copilot-instructions.md` (GitHub Copilot). Use them wherever this file or an agent says "the project's build, test or mutation command".
<!-- ai-dlc:end intro -->

<!-- ai-dlc:begin persona -->
<!-- ai-dlc:orchestrator-persona -->
<!-- ai-dlc:end persona -->

<!-- ai-dlc:begin project-facts -->
## Project facts

### Lifecycles and gates

- **AI-DLC**, the full lifecycle (idea → G1 → G2 → G3 → G4 → release), is the default for feature work; enter at the earliest missing artifact.
- Eight named lifecycles, its segments and focused entry points: **PDLC** product design · **ASDLC** architecture & design · **STBLC** story & task breakdown · **FDLC** feature development · **BFLC** bug fixing · **RLC** refactoring · **TLC** testing · **CRLC** code review.
- **Every handoff is an artifact.** Each run has a folder, `docs/handoffs/{LIFECYCLE}-{YYYYMMDD}-{feature-slug}/`. Before work changes hands the sender writes a handoff record, `{step}[.{sub}][.l{loop}[.{round}]][.{n}]-{from}-to-{to}.handoff.md` (for example `1.2-orchestrator-to-software-engineer.handoff.md`), which the receiver verifies before it starts; the receiver's report is stored verbatim as the hand-back with the same step code and the agents swapped (`1.2-software-engineer-to-orchestrator.handback.md`). Each feature is one top-level step `N`, and every hand-off for it, follow-ups included, sits in the sub-root of its phase: `N.1` planning, `N.2` implementation, `N.3` testing, `N.4` code review (`N.4.1` standards, `N.4.2` spec), `N.5` documentation; `N.3.l1` is loop 1 of testing and `N.3.l1.2` its round 2. Only a new feature, a gate record or a whole-run hand-off takes the next free top-level number (`handoff`, *Naming*). In subagent mode the orchestrator writes both; in a Claude Code agent team the teammates do.
- **Runs survive a lost session.** Each run keeps its run state in its folder (stages with their step codes and status, gate decisions, open clarifications, the last record, the next action), written before every spawn and after every return or gate. It is versioned, one file per session (`run.v1.md`; a change of direction adds a minor pair, `run.v1.1.md` and `run.v1.2.md`; a new request scope the next major, `run.v2.md`); a session seeded by an automatic handoff keeps its parent session's version, and an older version is never changed or deleted (`handoff`, *Run state*, Versions). A new session offers to resume unfinished runs from the highest version.
- **The human is the decision maker.** Humans set intent, approve gates G1 (stories/ACs), G2 (frozen spec), G3 (task plan) and G4 (review report), and resolve ambiguity. Agents never guess intent.
- **The team's workflow is in `.ai-dlc/workflow.json`** — lifecycles and stages, who hands off to whom, gates and their approvers, the clarify matrix and routing. It overrides the defaults above wherever they differ. `node .ai-dlc/workflow.mjs show` prints it (`--mermaid` for diagrams) and `validate` checks it against `.ai-dlc/catalog.json` (the installed plugin's agents and skills) and the project's own; a Stop hook blocks finishing while it is invalid. Change it with `/ai-dlc:workflow edit <change>` (`agent-manager`).

### Who owns what

| Request touches | Goes to |
|---|---|
| Agent definitions, skills, hooks, rules/instructions, commands/prompts, agent memory, the workflow file | `agent-manager` — the only agent allowed to change them; before a change is done `brutal-critique` critiques its docs (PASS / REVISE), and `sqa-engineer` tests and then `code-reviewer` reviews its code (the `AAW` lifecycle; what counts as code or docs: `references/aaw-review.md` in the base directory of the plugin's `workflow` skill, reached by loading `/ai-dlc:workflow`) |
| External knowledge (library/API/SDK behaviour, versions, standards), and any exploration of the code or docs — including what the repository does and what a request touches | `research-assistant` — the orchestrator never explores; it only gathers the run's context (records, hand-backs, run state, git state) and checks the agents' work. Builds, tests and validations are run by the agents that own them (tests: `sqa-engineer`) |
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
| Handoff records, hand-backs and run state | `docs/handoffs/{LIFECYCLE}-{YYYYMMDD}-{feature-slug}/` (`run.v<version>.md` is the run state, one current version per session, the highest current; `*.handoff.md` the records, `*.handback.md` the agents' reports) |
| Team workflow | `.ai-dlc/workflow.json` (its `artifacts` section overrides the paths above) |

### Quality gates

- After any change to runtime code, test code, runtime configuration or build logic: the project's test command must pass (enforced by the test gate hook that `init` installs for .NET and JavaScript / TypeScript), then `sqa-engineer` runs the project's mutation command. Mutation break threshold: **{{MUTATION_BREAK}}%**.
- Artifact-only changes (planning, agents, skills, hooks, prompts/commands, rules/instructions, the workflow file) may skip both gates; a workflow-file change must pass `node .ai-dlc/workflow.mjs validate` (the workflow gate enforces it).
- `code-reviewer` approves only at **zero Blockers**.

### Memory protocol (all agents)

- Each agent keeps persistent memory in one folder, `.claude/agent-memory/ai-dlc-<agent>/` (a project-local agent: `.claude/agent-memory/<agent>/`), with a `MEMORY.md` index, managed through the `manage-memory` skill.
- Load at the start of a task; save durable learnings (decisions, recurring pitfalls, conventions) at the end.
- Memory is committed with the repository and shared with everyone who clones it: never store secrets, credentials, tokens or personal data, and never add an ignore rule for `.claude/agent-memory/`.
- If an agent's memory holds `persona-name`, that name replaces its default persona name. The team roster lives in the orchestrator's memory (`project_team-roster.md`).

### Documentation (all agents)

- Only `documentation-writer` writes or updates documentation (READMEs, user guides and other reader-facing pages, release notes and changelogs), status markers included. This holds in every lifecycle and workflow, custom ones too. Lifecycle artifacts are not documentation, even under `docs/` (the backlog and out-of-scope records, product briefs and stories, specs, ADRs, narratives, plans, run records, test and review reports): the agents whose stages produce them write them.
- Every other agent owns its work, not the documents about it: when its work changes what the documentation should say, it puts a *Docs update* request in its hand-back (the documents, the status from the run state, what changed) and never edits the documentation itself. The orchestrator runs a `documentation-writer` stage in the same run right after the stage that sent the request, and again whenever that status changes.
- Status markers: *planned* (accepted, building not started), *in progress* (from the start of the building stage until the run's last review or gate stage, never the release or its go / no-go gate, is `done`; a done build with reviews pending stays *in progress*), none once done (described as it is). The status comes from the run state; the backlog only for work no run records; never from a guess.
- The full rule is `.claude/rules/docs-status.md` (Copilot: `.github/instructions/docs-status.instructions.md`), installed by `init`.
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
