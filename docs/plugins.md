# The ai-dlc plugins

This repository ships the **ai-dlc** plugin, an agentic engineering team that runs the AI-DLC (AI-driven development lifecycle), on two platforms, and a second, Claude-only plugin, **ai-dlc-lens** (*in progress*, see below):

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

Both marketplaces are named `ai-dlc-agent-workflow`. The Claude marketplace lists two plugins, `ai-dlc` at version **1.0.0-preview1** (unreleased preview) and the Claude-only `ai-dlc-lens`; the Copilot marketplace lists `ai-dlc` only. The Claude `ai-dlc` plugin has 15 agents and 73 skills; the Copilot plugin has the same 15 agents and 64 skills: it leaves out the 10 Claude-only skills and adds `scratchpad`. Only the platform wiring differs.

**`ai-dlc-lens` (in progress).** A Claude Code mod that draws an AI-DLC run while it happens (a workflow view, agent and hand-off panels, a chat card, anomaly markers). It is built in the run `FEAT-20261020-ai-dlc-lens`, its reviews are still open, and it is listed in `.claude-plugin/marketplace.json` only; the Copilot build ignores it (`tools/claude-only-plugins.json`). Its reference is the [plugin README](../plugins/claude/ai-dlc-lens/README.md) and the lens section of the [root README](../README.md); its commands are the `lens*` skills of `ai-dlc`, listed under *Commands*.

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
   - `AGENTS.md`: the full orchestrator persona, followed by the project's gates, artifact paths and conventions. It names no stack-specific command.
   - `CLAUDE.md` in the repository root: an `@AGENTS.md` import (Claude Code reads `AGENTS.md` on its own only when there is no `CLAUDE.md`), the project's build, test and mutation commands, and the Claude Code specifics `AGENTS.md` does not carry.
   - `.github/copilot-instructions.md`: the same build, test and mutation commands and the GitHub Copilot specifics `AGENTS.md` does not carry (Copilot loads `AGENTS.md` itself). It comes from the same source as `CLAUDE.md`, with Copilot content in the same blocks.
   - `.claude/settings.json`, merged into any existing file. It includes `"agent": "ai-dlc:orchestrator"`.
   - `docs/backlog/backlog.md` and the empty `docs/` folders the lifecycles write to: `specs/`, `architecture/decisions/`, `architecture/narratives/`, `plans/`, `handoffs/`, `product/`.
   - `.ai-dlc/workflow.json`, the team's workflow, with `workflow.schema.json`, the `workflow.mjs` CLI and `catalog.json` (generated from the installed plugin: its version, agent IDs and skill names), installed from the `workflow` skill, plus the workflow gate hook (see *Hooks and rules*). The orchestrator follows the workflow instead of the plugin default (see *Customising the workflow*). An existing `workflow.json` is kept; `/ai-dlc:workflow upgrade` brings in a newer default and regenerates the catalog.
   - The worktree root and the scratch root, installed by `workspace-folders`: recorded in `AGENTS.md`, `CLAUDE.md` and `.github/copilot-instructions.md`, added to `.gitignore`, and a Claude `WorktreeCreate` / `WorktreeRemove` hook pair that creates worktrees under the root. Run `/ai-dlc:workspace-folders` to change them later.
   - The documentation rule, in every repository whatever its stack, installed by `docs-rules`: `.claude/rules/docs-status.md` with an identical `.github/instructions/docs-status.instructions.md` twin. It binds every agent in every lifecycle and workflow (see *Hooks and rules*).
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
   5. It runs the work and stops at each human gate. Each run has a folder, `docs/handoffs/{LIFECYCLE}-{YYYYMMDD}-{feature-slug}/`. Before every spawn it writes the brief as a handoff record (`1.3-orchestrator-to-software-engineer.handoff.md`: each feature is one root step, here 1, and every hand-off for it, follow-ups included, is a sub-step of its phase: `N.1` planning, `N.2` implementation, `N.3` testing, `N.4` code review with `N.4.1` and `N.4.2` for the two review axes, `N.5` documentation; a loop is `l<k>` and its rounds are sub-numbers after it, as in `1.3.l1.2`; only a new feature takes the next free top-level number) and updates the run state, one file per session (`run.v1.md`; the next session that writes it adds a version, `run.v1.1.md` or `run.v2.md`, and the highest version is current; a run from before versions keeps a `run.md`); it stores each agent's hand-back (the report it returned) verbatim with the same step code (`1.3-software-engineer-to-orchestrator.handback.md`) the moment the agent returns, before checking it; it commits them at each gate and when the run closes; after a crash, a dropped connection or a lost context, the next session offers to resume each unfinished run from its recorded next action, re-verifying the last record first. In a Claude Code agent team the teammates write the records between themselves.

The orchestrator has to be the **main** agent: it is the lead that talks to you and runs the whole team, and subagent nesting is limited (on Claude Code to `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` levels, default 3 from v2.1.219, `1` to turn it off; GitHub Copilot does not document nested spawning, so the plugin assumes only the main agent spawns there; running the orchestrator as a subagent is not tested). Invoking it from inside another agent is not supported.

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
| `agent-manager` | The only agent that may change agents, skills, hooks, rules, commands, agent memory and the workflow file; `brutal-critique` critiques the docs of every change, `sqa-engineer` and `code-reviewer` test and review its code. It also creates new Claude and Copilot plugins | opus |

Agents use the `opus`, `sonnet` and `haiku` aliases (see the `model:` line of each file in `plugins/claude/ai-dlc/agents/`), so every role follows the newest model in its family without edits. To freeze a version, set `ANTHROPIC_DEFAULT_OPUS_MODEL` / `_SONNET_` / `_HAIKU_` in `.claude/settings.json`.

## Lifecycles and gates

The `ai-dlc` skill is the catalogue of lifecycles. `request-routing` picks a lifecycle for each work item, `agent-invocation` spawns the agents, and `handoff` records every hand-off: the sender's handoff record and the receiver's hand-back, named by step code in the run's folder.

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

Changes to agents, skills, hooks, rules, commands and the workflow file run one of two agent-artifact lifecycles, chosen from the change set. **AAWH** (harness) is for a docs-only change under the harness folders (`routing.agentArtifact.harnessPaths`: agents, skills, rules, instructions, commands, prompts, the workflow file, `AGENTS.md`): `product-owner` → `agent-manager`, then `documentation-writer` ∥ `brutal-critique`. **AAWP** (plugin / mod) is for any change that holds code or touches `routing.agentArtifact.pluginPaths` (`plugins/`, `tools/`, `tests/`): `product-owner` → `software-architect` → `system-engineer` → `agent-manager` → `sqa-engineer` → `code-reviewer`, then `documentation-writer` ∥ `brutal-critique`. Neither has a `software-engineer` stage or a gate. In either variant the orchestrator chooses agent team or subagents per request, and asks you when it cannot decide. An `AAWH` run whose change turns out to hold code stops before any review and you decide, with "continue as `AAWP`" recommended. `brutal-critique` also reviews each handoff record of both variants (`handoffReview`), with its own limits. **In progress:** both lifecycles are in the workflow template; the `variant` command that picks the variant arrives with ITEM-048, and the reviews of this change are still open. In either variant `agent-manager` makes the change and hands back the changed paths and the intent, `agent-manager` runs the checks (`validate`, or the plugin build check) and quotes their output, the orchestrator checks that hand-back, then the change is reviewed by what it contains: docs (Markdown, memory, data config such as `workflow.json`) go to `brutal-critique`, which returns PASS or REVISE; code (scripts, and files that register something that runs, such as hook or CI config) goes to `sqa-engineer`, which writes and runs tests for it, then to `code-reviewer`; a mixed change runs both paths in parallel. Findings go back to `agent-manager` while each reviewer's own limits allow — a `maxRounds` and a `maxFailures` per loop, 2 and 1 by default, with no budget shared between reviewers — and the open ones then come to you: raise that loop's limits for the run, or stop or accept them. The exact rules are in the `workflow` skill's `references/aaw-review.md`. `brutal-critique`, `sqa-engineer` and `code-reviewer` cannot be disabled, and `validate` fails when the agent-artifact review stages are missing, do not loop back to `agent-manager`, have a `maxFailures` that is not below `maxRounds`, do not list the `sqa-engineer` stage directly in `code-reviewer`'s `after`, or carry a `when` other than the exact phrase (`the change set contains docs` / `the change set contains code`); it cannot check that a review really ran.

**Upgrading from an earlier version.** A repository whose `.ai-dlc/workflow.json` predates these review stages fails `validate` (and the workflow gate) until you run `/ai-dlc:workflow upgrade`. `upgrade` runs `merge`, which adds the loop limits a file lacks (`maxFailures` next to an existing `maxRounds`, both on loops that had neither) and never overwrites a value you set. Limits an older file left implicit are now 2 rounds / 1 failure, and an omitted `clarify.maxRounds` went from 3 to 2; to keep three full rounds on a loop, set `maxRounds` 3 and `maxFailures` 2. Each review loop now has its own limits, so the agent-artifact review loops no longer need equal `maxRounds`. To change the limits without editing the file, set `AI_DLC_CRITIQUE_MAX_ROUNDS` / `AI_DLC_CRITIQUE_MAX_FAILURES`, `AI_DLC_TEST_MAX_ROUNDS` / `AI_DLC_TEST_MAX_FAILURES` `AI_DLC_CODE_REVIEW_MAX_ROUNDS` / `AI_DLC_CODE_REVIEW_MAX_FAILURES`, or, for the review of handoff records, `AI_DLC_HANDOFF_REVIEW_MAX_ROUNDS` / `AI_DLC_HANDOFF_REVIEW_MAX_FAILURES` (default 2 / 1; the required `handoffReview` key in the file), in `env` of `.claude/settings.local.json` (you) or `.claude/settings.json` (the team), or in the environment; `node .ai-dlc/workflow.mjs rounds` shows the values in effect and where each comes from. At session start the orchestrator reminds you to upgrade when `.ai-dlc/catalog.json` records another plugin version than the installed one — which only works if the plugin's version changes between releases. A change to `agent-manager`'s own definition, or to a skill it owns, is made by a freshly spawned `agent-manager`.

No agent guesses. When an input is unclear, the receiving agent asks the agents that produced it (the *Clarify loop*): for example, the software engineer asks the architect or the system engineer, and the SQA engineer asks the engineer, the product owner, the system engineer or the architect. The orchestrator relays the batched questions and the answers, records them in the handoff, and brings the question to you when no agent can answer it or the clarify limits (`clarify.maxRounds` and `clarify.maxFailures`, 2 and 1 by default) are used up. The full consultation matrix is in the `ai-dlc` skill.

### Customising the workflow

Everything above is the default. Each repository can change it in `.ai-dlc/workflow.json`, which `init` creates as a full copy of the default. The orchestrator reads the file on every request and follows it wherever it differs from the `ai-dlc` skill; an invalid file stops the run with the validator's output.

| Section | What you can change |
|---|---|
| `lifecycles` | Each lifecycle's stages: owner agent, skills, artifacts, `after` (who hands off to whom; equal `after` means parallel), `when` (conditional stages), `loop` (send work back, with its `maxRounds` and `maxFailures` limits), `gate`, `critique`. Add your own lifecycles (`kind: "custom"`) |
| `gates` | Name, the artifact approved, and the approver: `human`, `orchestrator` or `none` (no stop, but the handoff record is still written and verified) |
| `agents` | Run without a plugin agent (`disabled`), or bring the project's own agents into stages (`custom`) |
| `routing` | Request type → lifecycle, work kind → single agent, types routed before confirmation |
| `clarify` | Whom each agent may ask, about what, and the round and failure limits |
| `documents`, `review`, `artifacts` | Document writer and critic (or no critic), the review axes, artifact paths |

`workflow.schema.json` documents every key (VS Code shows it on hover). `node .ai-dlc/workflow.mjs validate` checks the file, including unknown or disabled agents, stage skills that do not exist (each must be a plugin skill or a project skill in `.claude/skills/` or `.github/skills/`, with a "did you mean" for near misses), dangling or cyclic hand-offs and undefined gates. It checks names against `.ai-dlc/catalog.json`, which `/ai-dlc:workflow install` and `upgrade` (and `init`) generate from the installed plugin with `workflow.mjs catalog --plugin <plugin root>`, plus the project's own agents and skills; without the catalog it fails. The workflow gate hook blocks an agent from finishing, once per stop cycle, while `.ai-dlc/` has uncommitted changes that do not validate. `show [<lifecycle>] [--mermaid]` prints stage tables or flowcharts; `diff --against <file>` compares two workflow files. `/ai-dlc:workflow edit <change in plain words>` makes a change through `agent-manager`, validates it and shows the diff and the new diagram before writing.

These stay fixed: `agent-manager` alone changes agents, skills, hooks, rules and the workflow file, and `Agent Artifact` work runs `AAWH` or `AAWP`, in which it is the stage that makes the change; every hand-off, agent-artifact runs included, gets a handoff record its receiver verifies and a stored hand-back (`AAWH` and `AAWP` have no gates; its run state records the rounds); the test gate hook stays in force; the orchestrator only delegates; a stage owner never does another agent's job.

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
| Project setup | `init`, `workspace-folders`, `docs-rules`, `dotnet-rules`, `dotnet-test-gate`, `node-rules`, `node-test-gate` | the user |

`init`, `workspace-folders`, `docs-rules`, `dotnet-rules`, `dotnet-test-gate`, `node-rules` and `node-test-gate` are **user-invocable only**: they set `disable-model-invocation: true`. `init` reads these skills' `SKILL.md` files and follows them, rather than calling them. Run `/ai-dlc:workspace-folders`, `/ai-dlc:docs-rules`, `/ai-dlc:dotnet-test-gate`, `/ai-dlc:dotnet-rules`, `/ai-dlc:node-test-gate` or `/ai-dlc:node-rules` yourself to add, repair or remove them later.

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
| `handoff` | Lifecycle agents | Scott Hanselman (`orchestrator`) writes the handoff records and stores the hand-backs in subagent mode; in a Claude Code agent team the teammates write their own; every receiver verifies its record; Robert C. Martin (`code-reviewer`) and Linus Torvalds (`brutal-critique`) never write one |
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
| `harness-sync` | Role | Boris Cherny (`agent-manager`); in a consumer repository, `/ai-dlc:harness-sync [args]`, a plugin command only the user invokes, runs `node .claude/scripts/sync-harness.mjs`: a two-way sync of agents, skills, commands / prompts, rules / instructions and hooks (`--check` only reports). `init` installs no sync hook; only this plugin repository syncs automatically, on `Stop` |
| `workflow` | Role | Boris Cherny (`agent-manager`) installs, edits, upgrades and resets `.ai-dlc/workflow.json`; Scott Hanselman (`orchestrator`) reads it with `show`; `init` installs its files; developers may run `/ai-dlc:workflow` themselves |
| `skill-management` | Role | Boris Cherny (`agent-manager`); Linus Torvalds (`brutal-critique`) reads its writing guide for agent and skill files; every other agent asks Boris Cherny (`agent-manager`) for skill changes |
| `init` | Init-only | The user (`/ai-dlc:init`); no agent |
| `workspace-folders` | Init-only | Followed by `init` in every repository, or run by the user to change the worktree or scratch root; no agent |
| `docs-rules` | Init-only | Followed by `init` in every repository, or run by the user to add, repair or update the documentation rule; no agent (the rule it installs binds every agent) |
| `dotnet-rules`, `dotnet-test-gate` | Init-only | Followed by `init` in .NET repositories, or run by the user; no agent |
| `node-rules`, `node-test-gate` | Init-only | Followed by `init` in JS / TS repositories, or run by the user; no agent |

## Commands

<!-- ai-dlc:commands:begin -->

<!-- Generated by tools/build-copilot.mjs from the skills' frontmatter. Do not edit this list. -->

Every skill of the plugin is a command. In Claude Code, type `/ai-dlc:<name>`; in GitHub Copilot, `/<name>` (the commands marked Claude Code only are not in the Copilot plugin).

| Command | Arguments | What it does |
| --- | --- | --- |
| `/ai-dlc:agent-invocation` | — | Authoritative skill for spawning or invoking another agent with proper context. |
| `/ai-dlc:agent-management` | — | Creates, updates, and deprecates agent definitions for both Claude Code (.claude/agents/*.md) and GitHub Copilot/VS Code (.github/agents/*.agent.md). |
| `/ai-dlc:ai-dlc` | — | AI-DLC lifecycle router and operating model. |
| `/ai-dlc:architecture-design` | — | Structured architectural design skill for the project. |
| `/ai-dlc:architecture-narrative` | — | Turn an architecture solution into a story stakeholders can follow — business problem first, then constraints and trade-offs, then the proposed design, ADRs and risks. |
| `/ai-dlc:architecture-review` | — | Structured architectural review skill for the project. |
| `/ai-dlc:bunit-blazor-testing` | — | Comprehensive guidance for writing Blazor component tests using bUnit with TUnit as the test runner. |
| `/ai-dlc:cache-keepalive` | `[<n>m\|<n>h\|<n>d\|clear] [--track 1h\|5m\|both] [--session\|--machine]` | Pings the prompt cache now, or sets how long keep-alive keeps it warm while background tasks run, on the 1h track, the 5m track or both. **Claude Code only.** |
| `/ai-dlc:cache-keepalive-configure` | `[<change in plain words>]` | Shows or changes keep-alive's settings in .ai-dlc/cache-keepalive.json. **Claude Code only.** |
| `/ai-dlc:cache-keepalive-install` | — | Creates .ai-dlc/cache-keepalive.json with every key at its default, and its schema, on first use; an existing file is left alone (use /ai-dlc:cache-keepalive-merge). **Claude Code only.** |
| `/ai-dlc:cache-keepalive-merge` | — | Brings .ai-dlc/cache-keepalive.json up to date after a plugin upgrade, or repairs it. **Claude Code only.** |
| `/ai-dlc:command-management` | — | Create, modify, and delete GitHub Copilot prompt files (.github/prompts/*.prompt.md) and Claude command files (.claude/commands/*.md) safely using a discovery-first, non-destructive workflow. |
| `/ai-dlc:configure-auto-handoff` | — | Shows and changes the automatic session handoff's settings in the repository's .ai-dlc/auto-handoff.json, with the source of each value, and checks whether this Claude Code can rename sessions. **Claude Code only.** |
| `/ai-dlc:csharp-architecture-testing` | — | Comprehensive guidance for writing C# architecture tests using NetArchTest.Rules, TUnit, and TUnit.Assertions.Should to enforce layer dependencies, namespace rules, and naming conventions |
| `/ai-dlc:csharp-integration-testing` | — | Comprehensive guidance for writing C# integration tests using TUnit, TestWebApplicationFactory, Testcontainers, Bogus, and TUnit.Assertions.Should — real infrastructure, no mocks of your own code |
| `/ai-dlc:csharp-mutation-testing` | — | Runs and interprets Stryker.NET mutation testing for C# projects — installing the tool, configuring stryker-config.json, running full, incremental (--since) and baseline runs, and triaging surviving mutants into real test gaps vs … |
| `/ai-dlc:csharp-unit-testing` | — | Comprehensive guidance for writing C# unit tests using TUnit, TUnit.Mocks, Bogus, and TUnit.Assertions.Should with project conventions |
| `/ai-dlc:design-test-cases` | — | Structured test case design skill for software projects. |
| `/ai-dlc:docs-rules` | — | Installs the AI-DLC documentation rule (docs-status) into the current repository, for every stack. |
| `/ai-dlc:dotnet-rules` | — | Installs the AI-DLC .NET rules into the current repository: C# coding style, the GlobalUsings convention and the dotnet test / dotnet stryker testing gates, as Claude rules (.claude/rules) with identical GitHub Copilot instruction twins … |
| `/ai-dlc:dotnet-test-gate` | — | Installs the AI-DLC .NET test gate into the current repository: a Claude Code Stop hook and a GitHub Copilot agentStop hook that block the agent from finishing while `dotnet test` fails after runtime changes. |
| `/ai-dlc:fix-bug` | — | Structured bug investigation workflow for software projects. |
| `/ai-dlc:github-cd-automation` | — | Structured workflow for designing GitHub Actions continuous deployment for .NET and JavaScript/TypeScript projects. |
| `/ai-dlc:github-ci-automation` | — | Structured workflow for designing and maintaining GitHub Actions continuous integration for .NET and JavaScript/TypeScript projects. |
| `/ai-dlc:handoff` | — | Records and verifies every hand-off in an AI-DLC run and keeps its run state. |
| `/ai-dlc:harness-sync` | `[--check] [--prefer claude\|copilot\|newer] [--only <kinds>] [--name <n>]` | Runs the two-way Claude Code ↔ GitHub Copilot harness sync, `node .claude/scripts/sync-harness.mjs`, so every agent, skill, command ↔ prompt, rule ↔ instruction and hook made or edited on one platform exists on the other. |
| `/ai-dlc:hook-management` | — | Create, modify, and delete Claude Code hooks and GitHub Copilot hook integrations safely using a discovery-first, non-destructive workflow. |
| `/ai-dlc:implement-feature` | — | Structured feature implementation workflow for software projects. |
| `/ai-dlc:init` | — | Bootstraps a repository for the AI-DLC agent team: scaffolds AGENTS.md (the orchestrator persona with all its skills, plus the project's gates and workspace folders, free of stack-specific commands), CLAUDE.md (an @AGENTS.md import, the … |
| `/ai-dlc:k6-docker` | — | Invoke this skill when the question is **how to run k6 tests via Docker** — for either local development or CI automation. |
| `/ai-dlc:k6-load-testing` | — | Invoke this skill when the task is to validate that the system sustains its SLOs at **realistic production throughput over time** — including endurance (soak) testing for memory leaks, connection pool exhaustion, and GC pressure. |
| `/ai-dlc:k6-performance-testing` | — | Invoke this skill when the task is to validate that a system meets its SLOs under **normal operating conditions** — expected concurrency and throughput levels. |
| `/ai-dlc:k6-stress-testing` | — | Invoke this skill when the task is to validate system behaviour **beyond normal capacity** — to observe how it degrades and whether it recovers. |
| `/ai-dlc:lens` | — | Opens or brings forward the AI-DLC Lens view, a live view of every run: one panel per workflow, its step charts of agents, and the avatar and hand-off panels (needs the ai-dlc-lens plugin). **Claude Code only.** |
| `/ai-dlc:lens-configure` | `[<key> [<value>\|--unset]]` | Shows the lens settings, each with its value, where it comes from and its env name, or sets or unsets one in .ai-dlc/lens.json (needs the ai-dlc-lens plugin). **Claude Code only.** |
| `/ai-dlc:lens-gate` | `[on\|off]` | Lens anomaly detection (blocked runs and steps, gates waiting or rejected, loops out of rounds, failed or stuck agents, failed hand-backs): on\|off turns it on or off; bare, it lists them (needs the ai-dlc-lens plugin). **Claude Code only.** |
| `/ai-dlc:lens-init` | `[--force]` | Writes the lens settings file .ai-dlc/lens.json with every default, and its schema .ai-dlc/lens.schema.json (needs the ai-dlc-lens plugin). **Claude Code only.** |
| `/ai-dlc:lens-keepalive` | `[on\|off]` | Shows or hides the lens's Cache keep-alive section (how long keep-alive kept the cache warm per track, what cache reads saved), then reports those figures (needs the ai-dlc-lens plugin; on by default). **Claude Code only.** |
| `/ai-dlc:lens-kit` | — | Opens the lens kit pane: the manual checks K1 to K5 of the lens (resize across the dock boundary, Svg animation, pane buttons, transcript cards; K5 superseded: see /ai-dlc:lens-gate) (needs the ai-dlc-lens plugin). **Claude Code only.** |
| `/ai-dlc:manage-memory` | — | Manages persistent file-based memory for all agents in .claude/agent-memory/&lt;folder>/ (ai-dlc-&lt;agent> for plugin agents), committed with the repository. |
| `/ai-dlc:model-metadata` | — | Installs the AI-DLC model metadata hook into the current repository: .ai-dlc/model-metadata.json with its schema, holding every Anthropic model's prices (input, output, 5-minute and 1-hour cache writes, cache reads, batch, fast mode, … |
| `/ai-dlc:node-rules` | — | Installs the AI-DLC JavaScript / TypeScript rules into the current repository: coding style (strict TypeScript, no any, ESM, naming), module and import boundaries, async and error handling, and the test / Stryker testing gates, as Claude … |
| `/ai-dlc:node-test-gate` | — | Installs the AI-DLC JavaScript / TypeScript test gate into the current repository: a Claude Code Stop hook and a GitHub Copilot agentStop hook that block the agent from finishing while the repository's test command fails after runtime … |
| `/ai-dlc:npm-package-deployment` | — | Structured workflow for publishing JavaScript/TypeScript packages to the npm registry. |
| `/ai-dlc:nuget-package-deployment` | — | Structured workflow for publishing NuGet packages to nuget.org. |
| `/ai-dlc:playwright-mcp-ui-testing` | — | AI-driven browser UI testing using the Playwright MCP server. |
| `/ai-dlc:plugin-management` | — | Creates and maintains a plugin that ships the same agents and skills to Claude Code and GitHub Copilot (CLI and VS Code) from one source: the Claude plugin is the source of truth and a zero-dependency build projects it into the Copilot … |
| `/ai-dlc:presentation-authoring` | — | Authors and maintains PowerPoint (.pptx) decks: reading a deck, editing slide text in place without breaking the layout, building a new deck, rendering slides to images for visual QA, and keeping a deck in sync with its source of truth … |
| `/ai-dlc:product-planning` | — | Product backlog management and release planning skill. |
| `/ai-dlc:request-routing` | — | The orchestrator's single routing skill. |
| `/ai-dlc:requirement-analysis` | — | Structured requirement elicitation for software projects. |
| `/ai-dlc:research` | — | Structured external-knowledge and codebase-exploration research skill for software projects. |
| `/ai-dlc:review` | — | Structured code review workflow for software projects. |
| `/ai-dlc:rules-management` | — | Create, modify, delete, and sync Claude rules files (.claude/rules/*.md) and GitHub Copilot instruction files (.github/instructions/*.instructions.md) safely using a discovery-first, non-destructive workflow. |
| `/ai-dlc:security-review` | — | Security-focused review workflow for software projects. |
| `/ai-dlc:skill-management` | — | Creates, updates, syncs, and lists skill files (.claude/skills/*/SKILL.md) and (.github/skills/*/SKILL.md) for the AI-DLC multi-agent system, and holds the writing guide and review checklist for any agent-facing document (skills, agent … |
| `/ai-dlc:sonarqube-pr-quality-gate` | — | Structured workflow for enforcing SonarQube quality gate on pull requests for .NET and JavaScript/TypeScript projects. |
| `/ai-dlc:spec-driven-development` | — | Manages the full lifecycle of a feature specification — from collaborative drafting (after a requirement-analysis session, or by synthesising a spec from requirements already discussed in the conversation, a product brief or an issue … |
| `/ai-dlc:system-design` | — | Low-level design skill. |
| `/ai-dlc:task-triage` | — | The product-manager's task and bug triage skill. |
| `/ai-dlc:terse-output` | `[lite \| full \| ultra \| off \| status]` | Terse response register: answer first, keep every technical fact, drop the filler, at three levels (lite, full, ultra). |
| `/ai-dlc:test-doubles` | — | Mock, stub, fake, spy or test double policy — the single rule for whether a test may replace part of the system and with what. |
| `/ai-dlc:ts-architecture-testing` | — | Comprehensive guidance for writing architecture tests in JavaScript/TypeScript projects (Node, TypeScript, plain JavaScript) using dependency-cruiser forbidden and required rules (layer dependencies, no circular dependencies, no orphans, … |
| `/ai-dlc:ts-integration-testing` | — | Comprehensive guidance for writing integration tests in JavaScript/TypeScript projects (Node, TypeScript, plain JavaScript) using Vitest (or Jest when the repository already uses it), Testcontainers for Node for real databases, caches … |
| `/ai-dlc:ts-mutation-testing` | — | Runs and interprets StrykerJS mutation testing for JavaScript/TypeScript projects (Node, TypeScript, plain JavaScript): installing @stryker-mutator/core with the vitest-runner or jest-runner, configuring stryker.config.json, running … |
| `/ai-dlc:ts-playwright-ui-testing` | — | Comprehensive guidance for writing coded end-to-end UI tests for web applications in JavaScript/TypeScript projects (Node, TypeScript, plain JavaScript) using Playwright Test (@playwright/test). |
| `/ai-dlc:ts-unit-testing` | — | Comprehensive guidance for writing unit tests in JavaScript/TypeScript projects (Node, TypeScript, plain JavaScript) using Vitest (or Jest when the repository already uses it), @faker-js/faker builders, vi.fn / vi.mock for the test … |
| `/ai-dlc:tunit-playwright-ui-testing` | — | Comprehensive guidance for writing coded end-to-end UI tests in C# using TUnit.Playwright. |
| `/ai-dlc:workflow` | — | Customise the AI-DLC workflow of a repository: which stages each lifecycle runs, which agent owns each stage and hands off to whom, what runs in parallel, refinement loops and their round and failure limits, gates and who approves them, … |
| `/ai-dlc:workspace-folders` | — | Sets or changes the repository's worktree root and scratch root: records them in AGENTS.md, CLAUDE.md and .github/copilot-instructions.md, gitignores them, and installs the Claude WorktreeCreate / WorktreeRemove hooks that place … |
| `/ai-dlc:write-adr` | — | Writes a numbered Architecture Decision Record (ADR) for a significant architectural choice in the project, after first checking the decision deserves one (hard to reverse, surprising without context, a real trade-off). |
| `/ai-dlc:write-documentation` | — | Structured documentation writing workflow for software projects. |
| `/ai-dlc:write-tests` | — | Stack-neutral test implementation skill. |

<!-- ai-dlc:commands:end -->

## Hooks and rules

The plugin ships **no rules and no settings hooks**; its only hooks are its Claude Code hooks module (the automatic handoff and keep-alive). A plugin settings hook would run in every project that enables the plugin, and stack-specific checks do not belong everywhere. Instead, `init` installs them only into repositories of the matching stack, and the workflow gate and the documentation rule in every repository. `init` installs no sync hook: in a consumer repository, run `/ai-dlc:harness-sync [args]`, a plugin command only you invoke, which runs `node .claude/scripts/sync-harness.mjs`, a two-way sync of agents, skills, commands / prompts, rules / instructions and hooks between `.claude/` and `.github/` (`--check` only reports). Only this plugin repository syncs automatically, in its own `Stop` hook.

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
- **`docs-rules`** (every stack) installs the documentation rule `docs-status`, as `.claude/rules/docs-status.md` with an identical `.github/instructions/docs-status.instructions.md` twin (no `paths` / `applyTo: "**"`, so every session loads it). The rule binds every agent in every lifecycle and workflow, custom ones included:
  - Documentation is a closed list: READMEs, user guides and other pages that say what the project does or will do, release notes and changelogs. Lifecycle artifacts (backlog, stories, specs, ADRs, narratives, task plans, run records, reviews and critiques, even under `docs/`), agent artifacts, agent memory and build-generated text are not documentation, and the rule does not cover them.
  - Only `documentation-writer` writes or updates documentation, status markers included.
  - Every other agent owns its work, not the documents about it. When its work changes what the documentation should say, it puts a *Docs update* request in its hand-back, naming the documents, the status and what changed; the orchestrator routes it to `documentation-writer` as a stage of the same run, and runs that stage again, without a new request, each time the status changes.
  - Status markers: *planned* (accepted, and its building stage has not started), *in progress* (from the moment the building stage starts until the run's last review or gate stage is `done`, fix rounds included; describe only what exists), none once that stage is `done` or the run closes `done`. The status is read from the run's current run state (the highest `run.v<major>[.<minor>].md`; older versions never give the status; `run.md` for a run from before versions), and from the backlog only for work no run records; never guessed.
  - When `.ai-dlc/workflow.json` moves the handoff folder or the backlog, `docs-rules` writes those paths into the rule.
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
| `skills/**` | Copied, with the `ai-dlc:` namespace and the `${CLAUDE_SKILL_DIR}/` prefix stripped from Markdown. Skills listed in [`tools/claude-only-skills.json`](../tools/claude-only-skills.json) (currently `cache-keepalive`, which names the hooks module's command, `cache-keepalive-install`, `cache-keepalive-merge` and `cache-keepalive-configure`, which manage keep-alive's settings, and the six `lens*` skills that name the ai-dlc-lens commands: `lens`, `lens-init`, `lens-configure`, `lens-kit`, `lens-keepalive` and `lens-gate`) are left out; a name there that is not a plugin skill fails the build |
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
