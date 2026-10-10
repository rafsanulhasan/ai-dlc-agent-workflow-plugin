# AI-DLC Agent Workflow — Claude Code & GitHub Copilot plugin

An agentic engineering team that runs the **AI-DLC**: role-scoped agents own each phase of the lifecycle, hand off explicit artifacts, and stop at hard gates. The human sets intent, approves gates and resolves ambiguity — reviewing artifacts, not every line of code.

The lifecycle, agents and gates are language-agnostic. Two stacks are supported: .NET (C# testing skills, Stryker.NET, NuGet and a `dotnet test` gate) and JS / TS — Node.js, TypeScript and plain JavaScript (TypeScript testing skills, StrykerJS, npm and a test gate that runs the repository's test command). Support for more languages will follow.

One source, two plugins:

| Platform | Plugin | Marketplace file |
|---|---|---|
| Claude Code | `plugins/claude/ai-dlc` (**source of truth**) | `.claude-plugin/marketplace.json` |
| GitHub Copilot CLI / VS Code | `plugins/copilot/ai-dlc` (**generated**) | `.github/plugin/marketplace.json` |

Full reference for both plugins (agents, skills, lifecycles, hooks, the build and releasing): [docs/plugins.md](docs/plugins.md).

## The team

| Agent | Role | Model |
|---|---|---|
| `orchestrator` | Receives every human request first; classifies and routes it (lifecycle, mode, agent chain), drives the flow, verifies artifacts, runs human gates | opus |
| `product-owner` | Owns Plan and Release — product brief, scope and priority, acceptance, release go / no-go | opus |
| `requirement-analyst` | Specialist under the product owner — elicitation, stories, numbered ACs, frozen specs | opus |
| `product-manager` | Specialist under the product owner — work breakdown (work items, dependencies, priorities, waves), backlog, release-gate checklist | opus |
| `software-architect` | Architecture design, ADRs, architecture conformance review | opus |
| `system-engineer` | Low-level design, SOLID/patterns, DI plan | opus |
| `software-engineer` | Implementation, bug fixes, refactors | sonnet |
| `sqa-engineer` | Test design, unit/integration/UI/architecture tests, mutation gate | sonnet |
| `code-reviewer` | Quality gate — approves only at zero Blockers | sonnet |
| `documentation-writer` | Every document | sonnet |
| `presentation-manager` | Slide decks — creates, updates and reviews .pptx presentations, keeping them true to the project | sonnet |
| `brutal-critique` | Adversarial read-only critique of every document | sonnet |
| `research-assistant` | All external research; owns the knowledge base | opus |
| `devops-engineer` | CI/CD, NuGet and npm publishing, SonarQube PR gates, releases | sonnet |
| `agent-manager` | The only agent that changes agents, skills, hooks or rules | opus |

Agents use the `opus` and `sonnet` aliases, and nothing pins `haiku`, so every role follows the newest model in its family (Opus 5.5 / Sonnet 5.5 / Haiku 5.5 on the Anthropic API today) without edits. To freeze a version, set `ANTHROPIC_DEFAULT_OPUS_MODEL` / `_SONNET_` / `_HAIKU_` in `.claude/settings.json`.

## Eight lifecycles

`request-routing` decides each work item's workflow (the lifecycle you asked for, else one chosen from `ai-dlc`), agent chain and orchestration mode → `agent-invocation` spawns → `handoff` carries the artifact. The orchestrator only delegates; it never does the engineering work itself.

| Lifecycle | Exit artifact |
|---|---|
| **PDLC** Product Design | Stories with numbered acceptance criteria |
| **ASDLC** Architecture & Design | ADRs + frozen `docs/specs/<slug>.spec.md` |
| **STBLC** Story & Task Breakdown | Dependency-ordered tasks with technical DoD |
| **FDLC** Feature Development | Code + tests + docs + review with zero Blockers |
| **BFLC** Bug Fixing | Root cause, minimal fix, regression test that failed first |
| **RLC** Refactoring | Same behaviour, mutation score not lower |
| **TLC** Testing | AC traceability, new tests, mutation report |
| **CRLC** Code Review | Change driven to merge-ready |

Human gates: **G1** stories/ACs · **G2** frozen spec · **G3** task plan · **G4** review report.

## Install

### Claude Code

```text
/plugin marketplace add rafsanulhasan/ai-dlc-agent-workflow-plugin
/plugin install ai-dlc@ai-dlc-agent-workflow
```

From a local clone: `/plugin marketplace add E:\Projects\personal\ai-dlc-agent-workflow-plugin`, or for one session `claude --plugin-dir ./plugins/claude/ai-dlc`.


### GitHub Copilot CLI

```text
copilot plugin marketplace add rafsanulhasan/ai-dlc-agent-workflow-plugin
copilot plugin install ai-dlc@ai-dlc-agent-workflow
```

Or directly: `copilot plugin install rafsanulhasan/ai-dlc-agent-workflow-plugin:plugins/copilot/ai-dlc`.

### VS Code

VS Code's agent-plugin support reads the same Copilot/Claude plugin formats; add this repository as a plugin marketplace from VS Code's agent plugin settings.

## Use it in a project

1. **Bootstrap once:** `/ai-dlc:init` (Claude) or the `init` skill (Copilot). It scaffolds `AGENTS.md` — the orchestrator persona for your project, with all its routing rules and skills, plus your build/test commands, gates and artifact paths — `CLAUDE.md`, recommended `.claude/settings.json` permissions and the `docs/` folders the lifecycles write to. In a .NET repository it also installs the C# coding-style, GlobalUsings and testing rules (`.claude/rules/*` with `.github/instructions/*` twins, via `dotnet-rules`), the `dotnet test` gate hook (via `dotnet-test-gate`) and `stryker-config.json`. In a JS / TS repository (a `package.json`) it installs the `node-coding-style`, `node-modules`, `node-async-errors` and `node-testing` rules (via `node-rules`) and the test gate hook (via `node-test-gate`). It shows a diff before touching any existing file.
2. **Talk to the orchestrator.** `init` sets `"agent": "ai-dlc:orchestrator"` in the repo's `.claude/settings.json`, so every request reaches it first (one-off: `claude --agent ai-dlc:orchestrator`). On Copilot, select the `orchestrator` custom agent.
3. The orchestrator classifies your request, gets a work breakdown from `product-manager`, routes each item to a lifecycle and agent chain, confirms the plan with you, then runs the lifecycle and stops at each human gate.

The orchestrator must be the **main** agent: subagents cannot spawn other subagents, so invoking it as `@agent-ai-dlc:orchestrator` from another agent will not let it run the team.

If a project still has its own copies of these agents in `.claude/agents` / `.github/agents`, remove them after installing the plugin so each role exists once.

### Requirements

- For .NET projects: .NET SDK (`dotnet test`, `dotnet stryker` via a local tool manifest)
- For the .NET test gate: PowerShell 7 (`pwsh`) on PATH — on any OS
- For JS / TS projects and their test gate: Node.js 18 or later, and the project's package manager (npm, pnpm, yarn or bun)
- Optional MCP servers the agents use when present: GitHub, SonarQube, Playwright, context7. Agents that need them (`product-manager`, `software-engineer`, `sqa-engineer`, `devops-engineer`, `code-reviewer`, `research-assistant`) inherit whatever MCP tools your session has instead of hard-coding one gateway's tool names.

## The test gates

The plugin ships no hooks. `init` installs the gate for each stack it detects; a repository with both stacks gets both.

### .NET

When `/ai-dlc:init` detects a .NET project (a `.sln`, `.slnx` or `.csproj`), it installs the gate through the `dotnet-test-gate` skill: `.claude/hooks/enforce-tests.ps1`, a `Stop` hook in `.claude/settings.json` and `.github/hooks/ai-dlc-test-gate.json` for Copilot. Run `/ai-dlc:dotnet-test-gate` to add, repair or remove it later.

The gate runs on Claude Code `Stop` / Copilot `agentStop`. It blocks the agent from finishing while `dotnet test` fails, and stays silent when:

- the repo has no `.sln`/`.slnx`/`.csproj`, or `dotnet` is not installed;
- nothing changed, or only artifacts changed (`.claude/`, `.github/agents|skills|prompts|instructions|hooks/`, `docs/`, `*.md`), or only JS/TS files changed (`*.ts`, `*.js` …, `package.json`, lockfiles, `tsconfig*.json`), when the JS/TS gate is installed;
- it already blocked once in this stop cycle (loop guard), or `AI_DLC_ENFORCE_TESTS=false`.

The test target is `AI_DLC_TEST_TARGET`, else a `*.Testing.slnx` / `*.Tests.sln` at the repo root.

### JS / TS

When `init` detects a Node.js project (a `package.json` outside `node_modules/`), it installs the gate through the `node-test-gate` skill: `.claude/hooks/enforce-tests.mjs` (dependency-free, Node 18+), a `Stop` hook in `.claude/settings.json` and `.github/hooks/ai-dlc-node-test-gate.json` for Copilot. Run `/ai-dlc:node-test-gate` to add, repair or remove it later.

It blocks the agent from finishing while the repository's test command fails, with the same silent cases as the .NET gate, plus: only .NET files changed, or `package.json` has no real `test` script. The command is `AI_DLC_NODE_TEST_CMD`, else the one confirmed at `init`, else `<pm> test` for the package manager the lockfile shows.

## Develop the plugin

```text
plugins/claude/ai-dlc/          ← edit here (agents/, skills/)
node tools/build-copilot.mjs    ← regenerate plugins/copilot/ai-dlc and init's AGENTS.md template
node tools/build-copilot.mjs --check
npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/ai-dlc
```

`init`'s `AGENTS.md` template is generated too: `tools/templates/AGENTS.template.md` with the body of `agents/orchestrator.md` inserted at its persona marker, so a project's `AGENTS.md` always carries the current orchestrator persona. Edit the orchestrator or the template, then rebuild.

This whole setup is captured as the `plugin-management` skill (owned by `agent-manager`), with the build script shipped as its template, so the team can create and release other Claude Code + Copilot plugins the same way: `/ai-dlc:plugin-management create <name>`.

CI (`.github/workflows/validate.yml`) fails if the Copilot tree is stale or either manifest stops validating. Never hand-edit `plugins/copilot/**`.

The build projects each Claude agent to `agents/<name>.agent.md`, translates tools to Copilot aliases (`Read`→`read`, `Write`/`Edit`→`edit`, `Glob`/`Grep`→`search`, `Bash`→`execute`, `Agent`→`agent`, `WebFetch`/`WebSearch`→`web`, `TodoWrite`→`todo`), drops Claude-only tools, strips the `ai-dlc:` namespace, and converts plugin hooks (if any are added) to Copilot's `version: 1` format. In this repository a `Stop` hook (`.claude/hooks/check-copilot-stale.mjs`) blocks the agent from finishing while the Copilot tree is stale.

## What changed from the original `.claude/` setup

- **Namespacing.** Agent ids are `ai-dlc:<name>` in Claude Code (the `-claude` suffix is gone); skills are `/ai-dlc:<name>`.
- **Commands folded into skills.** In a plugin a command and a skill with the same name collide, and skills are slash-invocable on both platforms. Where a skill was a stub (`fix-bug`, `implement-feature`, `review`, `requirement-analysis`, `system-design`), the command's full method became the skill.
- **Sync skills replaced by the build.** `agent-sync`, `skills-sync`, `hooks-sync`, `command-prompt-sync` and `rules-instructions-sync` are gone; `agent-manager` now distinguishes plugin scope (edit + rebuild) from project scope (hand-maintained twins).
- **Product owner added.** `product-owner` (new) owns the Plan and Release phases and directs `requirement-analyst` and `product-manager`, which stay as specialists.
- **Triage agent retired.** `orchestrator` (new) receives human requests, classifies and routes them, and executes the flow; `product-manager` triages non-trivial requests and bugs into prioritised work items with dependencies and waves. The old `triage` skill is split into `request-routing` (orchestrator) and `task-triage` (product manager).
- **Added from the AI-DLC deck:** `ai-dlc` lifecycle router, `handoff`, `brutal-critique`, `csharp-mutation-testing`, a full `security-review`, and `init`.
- **Added afterwards:** `architecture-narrative` (three-act architecture story for G2 and stakeholders, after Mark Richards' Software Architecture Monday lesson 224); its source video frames are not redistributed. `terse-output` (a terse response register at three levels, `lite` / `full` / `ultra`, on until you turn it off), with compressed agent reports in `agent-invocation`, a compact review format in `review` and a `compress` action in `manage-memory`, adapted from [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) (Apache-2.0); see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- **Test gate moved to the target project.** The `dotnet test` Stop hook is no longer a plugin hook; `init` installs it only in .NET repositories via `dotnet-test-gate`, and the plugin's `enforce_tests` / `test_target` settings are gone (use `AI_DLC_ENFORCE_TESTS` / `AI_DLC_TEST_TARGET`).
- **.NET rules moved to a skill.** The C# coding-style, GlobalUsings and testing rules are no longer scaffolded into every repository; `init` installs them only in .NET repositories via `dotnet-rules`.
- **Fixes:** the test-gate script now reads its JSON payload from stdin and returns the top-level `decision`/`reason` contract (the old script could not block); agents that call skills now have the `Skill` tool; `software-architect` can write the ADRs it is asked to write.
