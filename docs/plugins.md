# The ai-dlc plugins

This repository ships the **ai-dlc** plugin, an agentic engineering team that runs the AI-DLC (AI-driven development lifecycle), on two platforms:

| | Claude Code | GitHub Copilot CLI / VS Code |
|---|---|---|
| Plugin folder | [`plugins/claude/ai-dlc`](../plugins/claude/ai-dlc) | [`plugins/copilot/ai-dlc`](../plugins/copilot/ai-dlc) |
| Status | **Source of truth**, edited by hand | **Generated** from the Claude plugin, never edited |
| Manifest | `.claude-plugin/plugin.json` | `plugin.json` (generated) |
| Marketplace | [`.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json) | [`.github/plugin/marketplace.json`](../.github/plugin/marketplace.json) |
| Agents | `agents/<name>.md` | `agents/<name>.agent.md` |
| Skills | `skills/<name>/SKILL.md` | `skills/<name>/SKILL.md` |
| Agent id | `ai-dlc:<name>` | `<name>` |
| Skill call | `/ai-dlc:<name>` | the `<name>` skill |

Both marketplaces are named `ai-dlc-agent-workflow`, and both list one plugin, `ai-dlc`, at version **1.0.0-preview1** (unreleased preview). The two plugins carry the same 15 agents and 60 skills; the Copilot plugin adds `scratchpad`. Only the platform wiring differs.

The lifecycle, agents and gates are language-agnostic. Two stacks are supported:

- **.NET (C#)**: C# testing skills, Stryker.NET mutation testing, NuGet publishing, the .NET rules and a `dotnet test` gate.
- **JS / TS (Node.js, TypeScript and plain JavaScript)**: TypeScript testing skills, StrykerJS mutation testing, npm publishing, the Node rules and a test gate that runs the repository's test command.

More languages will follow.

## Install

**Claude Code**

```text
/plugin marketplace add rafsanulhasan/ai-dlc-agent-workflow-plugin
/plugin install ai-dlc@ai-dlc-agent-workflow
```

**GitHub Copilot CLI**

```text
copilot plugin marketplace add rafsanulhasan/ai-dlc-agent-workflow-plugin
copilot plugin install ai-dlc@ai-dlc-agent-workflow
```

You can also install the plugin directly, without the marketplace: `copilot plugin install rafsanulhasan/ai-dlc-agent-workflow-plugin:plugins/copilot/ai-dlc`.

**VS Code** reads the same plugin formats. Add this repository as a plugin marketplace in VS Code's agent plugin settings.

**Updating:** run `/plugin marketplace update ai-dlc-agent-workflow` in Claude Code, or `copilot plugin update` in Copilot.

## Using it in a project

1. **Bootstrap once.** Run `/ai-dlc:init` in Claude Code, or the `init` skill in Copilot. It shows a diff before it changes any existing file. An existing `AGENTS.md`, `CLAUDE.md` or `.github/copilot-instructions.md` is merged, not replaced: init writes its content inside `<!-- ai-dlc:begin <id> -->` … `<!-- ai-dlc:end <id> -->` blocks, keeps every line of yours outside them, reuses commands your file already states (asking when they conflict with what it detects), and on a re-run replaces only its own blocks. It writes:
   - `AGENTS.md`: the full orchestrator persona, followed by the project's build, test and mutation commands, its gates, artifact paths and conventions.
   - `CLAUDE.md` in the repository root: an `@AGENTS.md` import (Claude Code reads `AGENTS.md` on its own only when there is no `CLAUDE.md`) plus the Claude Code specifics `AGENTS.md` does not carry.
   - `.github/copilot-instructions.md`: the GitHub Copilot specifics `AGENTS.md` does not carry (Copilot loads `AGENTS.md` itself). It comes from the same source as `CLAUDE.md`, with Copilot content in the same blocks.
   - `.claude/settings.json`, merged into any existing file. It includes `"agent": "ai-dlc:orchestrator"`.
   - `docs/backlog/backlog.md` and the empty `docs/` folders the lifecycles write to: `specs/`, `architecture/decisions/`, `architecture/narratives/`, `plans/`, `handoffs/`, `product/`.
   - `.ai-dlc/workflow.json`, the team's workflow, with `workflow.schema.json`, the `workflow.mjs` CLI and `catalog.json` (generated from the installed plugin: its version, agent IDs and skill names), installed from the `workflow` skill, plus the workflow gate hook (see *Hooks and rules*). The orchestrator follows the workflow instead of the plugin default (see *Customising the workflow*). An existing `workflow.json` is kept; `/ai-dlc:workflow upgrade` brings in a newer default and regenerates the catalog.
   - The worktree root and the scratch root, installed by `workspace-folders`: recorded in `AGENTS.md`, `CLAUDE.md` and `.github/copilot-instructions.md`, added to `.gitignore`, and a Claude `WorktreeCreate` / `WorktreeRemove` hook pair that creates worktrees under the root. Run `/ai-dlc:workspace-folders` to change them later.
   - **.NET repositories only** (detected from a `.sln`, `.slnx` or `.csproj` file):
     - The C# coding-style, GlobalUsings and testing rules, installed by `dotnet-rules`.
     - The `dotnet test` gate hook, installed by `dotnet-test-gate`.
     - `stryker-config.json`.
   - **JS / TS repositories only** (detected from a `package.json` file):
     - The coding-style, modules, async-and-errors and testing rules, installed by `node-rules`.
     - The test gate hook, installed by `node-test-gate`.
2. **Talk to the orchestrator.** In Claude Code, the `agent` setting makes the orchestrator the main agent, so every request reaches it first. For a single session, run `claude --agent ai-dlc:orchestrator`. In Copilot, select the `orchestrator` custom agent.
3. The orchestrator handles each request in this order:
   1. It classifies the request. Any context it needs about your code or docs comes from `research-assistant`; the orchestrator never explores the repository itself, it only verifies what agents claim.
   2. It gets a work breakdown from `product-manager`.
   3. It picks a lifecycle, or a single agent, for each work item.
   4. It confirms the plan with you.
   5. It runs the work and stops at each human gate. Before the first spawn, before every spawn and after every return or gate it updates the work item's run state, `docs/handoffs/<work-item>/run.md`, and commits it at each gate and when the item closes; after a crash, a dropped connection or a lost context, the next session offers to resume each unfinished run from its recorded next action, re-verifying the last handoff first.

The orchestrator has to be the **main** agent, because subagents cannot spawn other subagents. If you invoke it from inside another agent, it cannot run the team.

## The team (agents)

| Agent | Role | Model |
|---|---|---|
| `orchestrator` | First point of contact. Classifies and routes every request and drives the flow. Only delegates, understanding included (code and doc questions go to `research-assistant`); it verifies artifacts itself | opus |
| `product-owner` | Owns Plan and Release: product brief, scope, priority, acceptance, release go / no-go | opus |
| `requirement-analyst` | Elicitation, user stories, numbered acceptance criteria, frozen specs | opus |
| `product-manager` | Work breakdown and bug triage, backlog, milestones, release-gate checklist | opus |
| `software-architect` | Architecture design, ADRs, architecture conformance review | opus |
| `system-engineer` | Low-level design: code structure, SOLID, design patterns, DI plan, UI design (component structure, UI patterns) | opus |
| `software-engineer` | Implementation, bug fixes, refactors | sonnet |
| `sqa-engineer` | Test design; unit, integration, UI and architecture tests; mutation gate | sonnet |
| `code-reviewer` | Quality gate; approves only when there are zero Blockers | sonnet |
| `documentation-writer` | Writes every document | sonnet |
| `brutal-critique` | Adversarial, read-only critique of every document, run in parallel with the writer | sonnet |
| `presentation-manager` | Creates, updates and reviews `.pptx` decks so they stay true to the project | sonnet |
| `research-assistant` | All external research and wide codebase exploration | opus |
| `devops-engineer` | CI/CD, NuGet and npm publishing, SonarQube PR gates, releases | sonnet |
| `agent-manager` | The only agent that may change agents, skills, hooks, rules, commands, agent memory and the workflow file; `brutal-critique` critiques every change. It also creates new Claude and Copilot plugins | opus |

Agents name the `opus` and `sonnet` aliases rather than pinned model ids, so each role follows the newest model in its family. To pin a version, set `ANTHROPIC_DEFAULT_OPUS_MODEL` or `ANTHROPIC_DEFAULT_SONNET_MODEL` in `.claude/settings.json`.

## Lifecycles and gates

The `ai-dlc` skill is the catalogue of lifecycles. `request-routing` picks a lifecycle for each work item, `agent-invocation` spawns the agents, and `handoff` records the artifact at every stage boundary.

**AI-DLC**, the full lifecycle, is the default for feature work: Plan → G1 → Architect & Design → G2 → Breakdown → G3 → Build · Test · Review → G4 → Release. A run enters at the earliest missing artifact and continues to release. The other eight lifecycles are its segments (PDLC to FDLC) or focused entry points for bugs, refactors, test gaps and reviews (BFLC to CRLC).

| Lifecycle | Exit artifact |
|---|---|
| **AI-DLC** Full lifecycle | A released feature, traceable from the brief to the release notes |
| **PDLC** Product Design | Stories with numbered acceptance criteria |
| **ASDLC** Architecture & Design | ADRs and a frozen `docs/specs/<slug>.spec.md` |
| **STBLC** Story & Task Breakdown | Dependency-ordered tasks with a technical definition of done (DoD) |
| **FDLC** Feature Development | Code, tests and docs, plus a review with zero Blockers |
| **BFLC** Bug Fixing | Root cause, a minimal fix, and a regression test that failed first |
| **RLC** Refactoring | Same behaviour, and a mutation score that is not lower |
| **TLC** Testing | Acceptance-criteria traceability, new tests, a mutation report |
| **CRLC** Code Review | The change driven to merge-ready |

Humans approve four gates:

| Gate | What the human approves |
|---|---|
| **G1** | Stories and acceptance criteria |
| **G2** | The frozen spec |
| **G3** | The task plan |
| **G4** | The review report |

If you name a lifecycle in your request, the orchestrator runs that one. Otherwise feature work runs AI-DLC, and other work gets the lifecycle that fits the state of each item.

Changes to agents, skills, hooks, rules, commands and the workflow file run the agent-artifact lifecycle, **AAW**: `agent-manager` makes the change and hands back the changed paths and the intent, the orchestrator re-runs the checks (`validate`, or the plugin build check), then `brutal-critique` reviews the change with that output and returns PASS or REVISE; on REVISE the work goes back to `agent-manager`, for at most three rounds before the open Blockers come to you. The critique cannot be switched off: `brutal-critique` cannot be disabled, and `validate` fails without the critique stage. A change to `agent-manager`'s own definition, or to a skill it owns, is made by a freshly spawned `agent-manager`.

No agent guesses. When an input is unclear, the receiving agent asks the agents that produced it (the *Clarify loop*): for example, the software engineer asks the architect or the system engineer, and the SQA engineer asks the engineer, the product owner, the system engineer or the architect. The orchestrator relays the batched questions and the answers, records them in the handoff, and brings the question to you when no agent can answer it or three rounds have not settled it. The full consultation matrix is in the `ai-dlc` skill.

### Customising the workflow

Everything above is the default. Each repository can change it in `.ai-dlc/workflow.json`, which `init` creates as a full copy of the default. The orchestrator reads the file on every request and follows it wherever it differs from the `ai-dlc` skill; an invalid file stops the run with the validator's output.

| Section | What you can change |
|---|---|
| `lifecycles` | Each lifecycle's stages: owner agent, skills, artifacts, `after` (who hands off to whom; equal `after` means parallel), `when` (conditional stages), `loop` (send work back, with an optional round limit), `gate`, `critique`. Add your own lifecycles (`kind: "custom"`) |
| `gates` | Name, the artifact approved, and the approver: `human`, `orchestrator` or `none` (no stop, but the handoff record is still written) |
| `agents` | Run without a plugin agent (`disabled`), or bring the project's own agents into stages (`custom`) |
| `routing` | Request type → lifecycle, work kind → single agent, types routed before confirmation |
| `clarify` | Whom each agent may ask, about what, and the round limit |
| `documents`, `review`, `artifacts` | Document writer and critic (or no critic), the review axes, artifact paths |

`workflow.schema.json` documents every key (VS Code shows it on hover). `node .ai-dlc/workflow.mjs validate` checks the file, including unknown or disabled agents, stage skills that do not exist (each must be a plugin skill or a project skill in `.claude/skills/` or `.github/skills/`, with a "did you mean" for near misses), dangling or cyclic hand-offs and undefined gates. It checks names against `.ai-dlc/catalog.json`, which `/ai-dlc:workflow install` and `upgrade` (and `init`) generate from the installed plugin with `workflow.mjs catalog --plugin <plugin root>`, plus the project's own agents and skills; without the catalog it fails. The workflow gate hook blocks an agent from finishing, once per stop cycle, while `.ai-dlc/` has uncommitted changes that do not validate. `show [<lifecycle>] [--mermaid]` prints stage tables or flowcharts; `diff --against <file>` compares two workflow files. `/ai-dlc:workflow edit <change in plain words>` makes a change through `agent-manager`, validates it and shows the diff and the new diagram before writing.

These stay fixed: `agent-manager` alone changes agents, skills, hooks, rules and the workflow file, and `Agent Artifact` work runs a lifecycle that starts with it; every stage boundary gets a verified handoff record; the test gate hook stays in force; the orchestrator only delegates; a stage owner never does another agent's job.

## Skills

Every skill is also a slash command: `/ai-dlc:<name>` in Claude Code, or the `<name>` skill in Copilot. The plugin ships no separate `commands/` folder, because a command and a skill with the same name would collide.

| Area | Skills | Main user |
|---|---|---|
| Routing and flow | `request-routing`, `ai-dlc`, `agent-invocation`, `handoff` | orchestrator |
| Product | `product-planning`, `task-triage`, `requirement-analysis`, `spec-driven-development` | product-manager (`product-planning`, `task-triage`), requirement-analyst (`requirement-analysis`, `spec-driven-development`); product-owner reads `product-planning` and `requirement-analysis` |
| Architecture and design | `architecture-design`, `architecture-review`, `architecture-narrative`, `write-adr`, `system-design` | software-architect (architecture skills and `write-adr`); system-engineer (`system-design` only) |
| Engineering | `implement-feature`, `fix-bug`, `review`, `security-review` | software-engineer, code-reviewer |
| Testing (general) | `design-test-cases`, `write-tests`, `test-doubles`, `playwright-mcp-ui-testing` | sqa-engineer; software-engineer and code-reviewer also use `test-doubles` |
| Testing (C# / .NET) | `csharp-unit-testing`, `csharp-integration-testing`, `csharp-architecture-testing`, `csharp-mutation-testing`, `bunit-blazor-testing`, `tunit-playwright-ui-testing` | sqa-engineer |
| Testing (JS / TS) | `ts-unit-testing`, `ts-integration-testing`, `ts-architecture-testing`, `ts-mutation-testing`, `ts-playwright-ui-testing` | sqa-engineer |
| Performance testing | `k6-performance-testing`, `k6-load-testing`, `k6-stress-testing`, `k6-docker` | sqa-engineer |
| DevOps | `github-ci-automation`, `github-cd-automation`, `nuget-package-deployment`, `npm-package-deployment`, `sonarqube-pr-quality-gate` | devops-engineer |
| Communication | `write-documentation`, `presentation-authoring`, `terse-output` | documentation-writer, presentation-manager; `terse-output`: the user and every agent |
| Research | `research` | research-assistant |
| Team management | `agent-management`, `skill-management`, `hook-management`, `rules-management`, `command-management`, `harness-sync`, `workflow`, `plugin-management`, `manage-memory` | agent-manager (all agents use `manage-memory`); the orchestrator reads `workflow` |
| Workspace (Copilot only) | `scratchpad` | every agent on Copilot, before its first temporary file (Claude Code has a built-in scratchpad, so the Claude plugin does not ship it) |
| Project setup | `init`, `workspace-folders`, `dotnet-rules`, `dotnet-test-gate`, `node-rules`, `node-test-gate` | the user |

`init`, `workspace-folders`, `dotnet-rules`, `dotnet-test-gate`, `node-rules` and `node-test-gate` are **user-invocable only**: they set `disable-model-invocation: true`. `init` reads these skills' `SKILL.md` files and follows them, rather than calling them. Run `/ai-dlc:workspace-folders`, `/ai-dlc:dotnet-test-gate`, `/ai-dlc:dotnet-rules`, `/ai-dlc:node-test-gate` or `/ai-dlc:node-rules` yourself to add, repair or remove them later.

### Which agent uses which skill

Each agent lists its skills, and when it uses them, in the `## Skills` section of its definition. Skills are not preloaded through a `skills:` frontmatter field; an agent loads one when it needs it.

The **lifecycle agents** own a stage and hand an artifact on: James Montemagno (`product-owner`), James Montemagno (`requirement-analyst`), James Montemagno (`product-manager`), Mark Richards (`software-architect`), Zoran Horvat (`system-engineer`), David Fowler (`software-engineer`), Kent Beck (`sqa-engineer`), Robert C. Martin (`code-reviewer`), Daniele Procida (`documentation-writer`), Gene Kim (`devops-engineer`) and Linus Torvalds (`brutal-critique`). The others are Scott Hanselman (`orchestrator`), Jon Skeet (`research-assistant`), Nancy Duarte (`presentation-manager`) and Boris Cherny (`agent-manager`). Names are the defaults; names chosen at `/ai-dlc:init` take precedence.

*Reads* means the agent reads the skill's standard and does not run its workflow.

| Skill | Scope | Agents (Name (`id`)) |
|---|---|---|
| `agent-invocation` | All agents | Every agent, before it spawns or briefs another agent |
| `manage-memory` | All agents | Every agent: load at session start, save durable learnings |
| `terse-output` | All agents | Every agent, for the compressed report it returns to its caller; by default for Jon Skeet (`research-assistant`), whose reader is another agent; Scott Hanselman (`orchestrator`) when the human asks for shorter answers |
| `scratchpad` | All agents (Copilot only) | Every agent on Copilot, before it writes its first temporary file; on Claude Code agents use the scratch root from `AGENTS.md` directly |
| `handoff` | Lifecycle agents | Scott Hanselman (`orchestrator`) and every lifecycle agent, at each stage boundary; Robert C. Martin (`code-reviewer`) and Linus Torvalds (`brutal-critique`) verify records but never write one |
| `ai-dlc` | Role | Scott Hanselman (`orchestrator`) |
| `request-routing` | Role | Scott Hanselman (`orchestrator`) |
| `research` | Role | Jon Skeet (`research-assistant`) runs it; every other agent routes external questions to Jon Skeet (`research-assistant`) instead |
| `product-planning` | Role | James Montemagno (`product-manager`); James Montemagno (`product-owner`) reads the backlog view |
| `task-triage` | Role | James Montemagno (`product-manager`) owns it, including deciding and recording rejections in `out-of-scope/`; Linus Torvalds (`brutal-critique`) reads the agent-brief self-check |
| `requirement-analysis` | Role | James Montemagno (`requirement-analyst`); James Montemagno (`product-owner`) reads it to direct elicitation; Mark Richards (`software-architect`) uses its interview loop on a chosen deepening candidate; Linus Torvalds (`brutal-critique`) reads |
| `spec-driven-development` | Role | James Montemagno (`requirement-analyst`); Mark Richards (`software-architect`) reviews the draft spec and agrees its Test Seams; David Fowler (`software-engineer`) and Kent Beck (`sqa-engineer`) follow its enforcement handoff; Linus Torvalds (`brutal-critique`) reads |
| `architecture-design` | Role | Mark Richards (`software-architect`) |
| `architecture-review` | Role | Mark Richards (`software-architect`) |
| `architecture-narrative` | Role | Mark Richards (`software-architect`); Daniele Procida (`documentation-writer`) for stakeholder-facing architecture docs |
| `write-adr` | Role | Mark Richards (`software-architect`); Linus Torvalds (`brutal-critique`) reads |
| `system-design` | Role | Zoran Horvat (`system-engineer`); Mark Richards (`software-architect`) hands interface design to it |
| `security-review` | Role | Robert C. Martin (`code-reviewer`) on security-sensitive changes; Mark Richards (`software-architect`) at threat and design level; Gene Kim (`devops-engineer`) for pipelines and secrets |
| `implement-feature` | Role | David Fowler (`software-engineer`) |
| `fix-bug` | Role | David Fowler (`software-engineer`), including diagnosis-only requests |
| `review` | Role | Robert C. Martin (`code-reviewer`); Scott Hanselman (`orchestrator`) fans out its two axes (Standards, Spec) to two reviewers |
| `design-test-cases` | Role | Kent Beck (`sqa-engineer`); Linus Torvalds (`brutal-critique`) reads |
| `write-tests` | Role | Kent Beck (`sqa-engineer`) |
| `test-doubles` | Role | Kent Beck (`sqa-engineer`) when planning and writing tests; David Fowler (`software-engineer`) for the tests it writes; Robert C. Martin (`code-reviewer`) applies its review checklist to every double in a diff |
| `playwright-mcp-ui-testing` | Role | Kent Beck (`sqa-engineer`) |
| `csharp-unit-testing`, `csharp-integration-testing`, `csharp-architecture-testing`, `bunit-blazor-testing`, `tunit-playwright-ui-testing` | Role (C# / .NET) | Kent Beck (`sqa-engineer`) |
| `csharp-mutation-testing` | Role (C# / .NET) | Kent Beck (`sqa-engineer`), who alone declares the mutation gate passed |
| `ts-unit-testing`, `ts-integration-testing`, `ts-architecture-testing`, `ts-playwright-ui-testing` | Role (JS / TS) | Kent Beck (`sqa-engineer`) |
| `ts-mutation-testing` | Role (JS / TS) | Kent Beck (`sqa-engineer`), who alone declares the mutation gate passed |
| `k6-performance-testing`, `k6-stress-testing`, `k6-load-testing`, `k6-docker` | Role | Kent Beck (`sqa-engineer`) |
| `github-ci-automation`, `github-cd-automation`, `sonarqube-pr-quality-gate` | Role | Gene Kim (`devops-engineer`) |
| `nuget-package-deployment` | Role (C# / .NET) | Gene Kim (`devops-engineer`) |
| `npm-package-deployment` | Role (JS / TS) | Gene Kim (`devops-engineer`) |
| `write-documentation` | Role | Daniele Procida (`documentation-writer`); Linus Torvalds (`brutal-critique`) reads |
| `presentation-authoring` | Role | Nancy Duarte (`presentation-manager`) |
| `agent-management`, `command-management`, `hook-management`, `rules-management`, `plugin-management` | Role | Boris Cherny (`agent-manager`) |
| `harness-sync` | Role | Boris Cherny (`agent-manager`); `init` installs its script; developers run `node .claude/scripts/sync-harness.mjs` themselves |
| `workflow` | Role | Boris Cherny (`agent-manager`) installs, edits, upgrades and resets `.ai-dlc/workflow.json`; Scott Hanselman (`orchestrator`) reads it with `show`; `init` installs its files; developers may run `/ai-dlc:workflow` themselves |
| `skill-management` | Role | Boris Cherny (`agent-manager`); Linus Torvalds (`brutal-critique`) reads its writing guide for agent and skill files; every other agent asks Boris Cherny (`agent-manager`) for skill changes |
| `init` | Init-only | The user (`/ai-dlc:init`); no agent |
| `workspace-folders` | Init-only | Followed by `init` in every repository, or run by the user to change the worktree or scratch root; no agent |
| `dotnet-rules`, `dotnet-test-gate` | Init-only | Followed by `init` in .NET repositories, or run by the user; no agent |
| `node-rules`, `node-test-gate` | Init-only | Followed by `init` in JS / TS repositories, or run by the user; no agent |

## Hooks and rules

The plugin ships **no hooks and no rules**. A plugin hook would run in every project that enables the plugin, and stack-specific checks do not belong everywhere. Instead, `init` installs them only into repositories of the matching stack.

- **`workspace-folders`** (every stack) installs `.claude/hooks/worktree-create.mjs` and `worktree-remove.mjs` with `WorktreeCreate` / `WorktreeRemove` entries in `.claude/settings.json`, so Claude Code creates its worktrees under the configured worktree root instead of `.claude/worktrees/`. Copilot has no worktree location setting; it follows the `AGENTS.md` instruction.

- **`workflow`** (every stack) installs the workflow gate: `.claude/hooks/check-workflow.mjs`, a `Stop` hook in `.claude/settings.json` and `.github/hooks/ai-dlc-workflow-gate.json` for Copilot. When `.ai-dlc/` has uncommitted changes, it runs `node .ai-dlc/workflow.mjs validate` and blocks the agent from finishing while that fails. It blocks **once per stop cycle**, like the test gates: if the agent stops again right after a block, the hook lets it through, so it catches mistakes rather than making an invalid file impossible. It stays silent when nothing under `.ai-dlc/` changed, or with `AI_DLC_WORKFLOW_GATE=false`. When the catalog is missing (repositories set up before it existed), its message says to run `/ai-dlc:workflow upgrade`.

- **`dotnet-test-gate`** installs three things:
  - `.claude/hooks/enforce-tests.ps1`.
  - A `Stop` hook in `.claude/settings.json`.
  - `.github/hooks/ai-dlc-test-gate.json`, an `agentStop` hook for Copilot.

  The hook blocks the agent from finishing while `dotnet test` fails after a change to runtime code. It stays silent when:
  - only artifacts changed: `.claude/`, `.github/agents|skills|prompts|instructions|hooks/`, `docs/`, or `*.md` files;
  - only JS/TS files changed (`*.ts`, `*.js` …, `package.json`, lockfiles, `tsconfig*.json`), when the JS/TS gate is installed;
  - it has already blocked once in this stop cycle;
  - `AI_DLC_ENFORCE_TESTS=false` is set.

  It runs `AI_DLC_TEST_TARGET` if that is set. Otherwise it runs a `*.Testing.slnx` or `*.Tests.sln` at the repository root. It needs PowerShell 7 (`pwsh`).
- **`dotnet-rules`** installs the C# coding-style, GlobalUsings and testing rules. Each rule goes in two places with identical content:
  - `.claude/rules/*.md` for Claude Code.
  - `.github/instructions/*.instructions.md` for Copilot.
- **`node-test-gate`** installs `.claude/hooks/enforce-tests.mjs`, a `Stop` hook in `.claude/settings.json` and `.github/hooks/ai-dlc-node-test-gate.json` for Copilot. The dependency-free Node.js script (Node 18 or later) blocks the agent from finishing while the repository's test command fails after a change to runtime code. It stays silent on the same conditions as the .NET gate, and also when only .NET files changed or `package.json` has no real `test` script. The command is `AI_DLC_NODE_TEST_CMD`, else the one confirmed at `init`, else `<pm> test` for the package manager its lockfile shows.
- **`node-rules`** installs the `node-coding-style`, `node-modules`, `node-async-errors` and `node-testing` rules, as Claude rules with identical Copilot instruction twins. Their `node-` prefix lets them sit next to the .NET rules in a repository with both stacks.

## How the Copilot plugin is generated

[`tools/build-copilot.mjs`](../tools/build-copilot.mjs) projects the Claude plugin onto Copilot. It needs only Node 18 or later, with no dependencies.

| Claude source | Copilot output |
|---|---|
| `agents/<a>.md` | `agents/<a>.agent.md` with a platform note. Tools are mapped (see below). Claude-only tools are dropped. `mcp__*` tools are kept. Agents marked `status: deprecated` are skipped |
| `skills/**` | Copied, with the `ai-dlc:` namespace and the `${CLAUDE_SKILL_DIR}/` prefix stripped from Markdown |
| `tools/overlays/non-claude/skills/**` | Added to `skills/` the same way (Copilot only, e.g. `scratchpad`); a name shared with a Claude skill fails the build |
| `scripts/**` | Copied verbatim |
| `hooks/hooks.json` (none today) | `hooks.json` in Copilot's `version: 1` format (`Stop` → `agentStop`) |
| `.claude-plugin/plugin.json` | `plugin.json` and `GENERATED.md` |

The tools are mapped like this:

| Claude tool | Copilot alias |
|---|---|
| `Read` | `read` |
| `Write`, `Edit` | `edit` |
| `Glob`, `Grep` | `search` |
| `Bash` | `execute` |
| `Agent` | `agent` |
| `WebFetch`, `WebSearch` | `web` |
| `TodoWrite` | `todo` |

The generated platform note at the top of each Copilot agent explains how to read the Claude forms. `Skill("name")` means "load and follow the `name` skill". `Agent("name", prompt)` means "delegate to the `name` custom agent".

The build also regenerates three sources:

- **`skills/init/templates/AGENTS.md`**: built from [`tools/templates/AGENTS.template.md`](../tools/templates/AGENTS.template.md) with the body of `agents/orchestrator.md` inserted at its persona marker. A project's `AGENTS.md` therefore always carries the current orchestrator. The build fails when the template's managed-block markers are unbalanced.
- **`skills/init/templates/CLAUDE.md`** and **`copilot-instructions.md`**: rendered from [`tools/templates/instructions.template.md`](../tools/templates/instructions.template.md). Lines inside `<!-- variant:claude -->` or `<!-- variant:copilot -->` (up to `<!-- /variant -->`) go to that platform's file only; everything else, including every managed-block marker, goes to both. The build fails when the variants are unclosed, a marker sits inside a variant, or the two outputs' markers differ.
- **`skills/plugin-management/templates/build-copilot.mjs`**: a copy of the build script itself. `plugin-management` uses it to create other plugins the same way.
- **`.claude/skills/<name>/`**: mirrors of the skills listed in [`tools/project-skills.json`](../tools/project-skills.json) (currently `presentation-authoring`), for use inside this repository.

`node tools/build-copilot.mjs --check` exits with code 1 when any generated output is stale. CI and this repository's Stop hook both run that check.

## Changing the plugins

Changes to agents, skills, hooks or rules go through `ai-dlc:agent-manager`. Its `plugin-management` skill holds the full recipe. In short:

1. Edit only `plugins/claude/ai-dlc/`. For generated sources, edit `tools/templates/` or `tools/build-copilot.mjs` instead.
2. Run `node tools/build-copilot.mjs`, then `node tools/build-copilot.mjs --check`.
3. After a manifest change, or after adding, renaming or removing an agent or skill, run both validations:

   ```text
   npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/ai-dlc
   npx @anthropic-ai/claude-code plugin validate --strict .
   ```

4. Update the references and the README tables.

[`.github/workflows/validate.yml`](../.github/workflows/validate.yml) runs the staleness check and both validations on every push and pull request.

**Releasing:**

1. Bump `version` in `plugins/claude/ai-dlc/.claude-plugin/plugin.json`. Also bump it in the `.github/plugin/marketplace.json` entry, which is maintained by hand. Prerelease versions use a SemVer suffix (the current `1.0.0-preview1`); `plugin validate --strict` accepts them.
2. Rebuild and run both validations.
3. Tag the release `v<version>` and push.

**Trying changes locally:** this repository uses the plugin it builds. Register the repository as a local marketplace once per machine:

```text
claude plugin marketplace add ./ --scope local
claude plugin install ai-dlc@ai-dlc-agent-workflow --scope local
```

Edits take effect in the next session, or after `/reload-plugins`.
