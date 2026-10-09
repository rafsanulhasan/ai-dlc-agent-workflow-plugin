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

Both marketplaces are named `ai-dlc-agent-workflow`, and both list one plugin, `ai-dlc`, at version **1.0.0**. The two plugins carry the same 15 agents and 47 skills. Only the platform wiring differs.

The lifecycle, agents and gates are language-agnostic. .NET is the first supported stack: it has C# testing skills, Stryker.NET mutation testing, NuGet publishing and a `dotnet test` gate. More languages will follow.

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

1. **Bootstrap once.** Run `/ai-dlc:init` in Claude Code, or the `init` skill in Copilot. It shows a diff before it changes any existing file. It writes:
   - `AGENTS.md`: the full orchestrator persona, followed by the project's build, test and mutation commands, its gates, artifact paths and conventions.
   - `CLAUDE.md`.
   - `.claude/settings.json`, merged into any existing file. It includes `"agent": "ai-dlc:orchestrator"`.
   - `docs/backlog/backlog.md` and the empty `docs/` folders the lifecycles write to: `specs/`, `architecture/decisions/`, `architecture/narratives/`, `plans/`, `handoffs/`, `product/`.
   - **.NET repositories only** (detected from a `.sln`, `.slnx` or `.csproj` file):
     - The C# coding-style, GlobalUsings and testing rules, installed by `dotnet-rules`.
     - The `dotnet test` gate hook, installed by `dotnet-test-gate`.
     - `stryker-config.json`.
2. **Talk to the orchestrator.** In Claude Code, the `agent` setting makes the orchestrator the main agent, so every request reaches it first. For a single session, run `claude --agent ai-dlc:orchestrator`. In Copilot, select the `orchestrator` custom agent.
3. The orchestrator handles each request in this order:
   1. It classifies the request.
   2. It gets a work breakdown from `product-manager`.
   3. It picks a lifecycle, or a single agent, for each work item.
   4. It confirms the plan with you.
   5. It runs the work and stops at each human gate.

The orchestrator has to be the **main** agent, because subagents cannot spawn other subagents. If you invoke it from inside another agent, it cannot run the team.

## The team (agents)

| Agent | Role | Model |
|---|---|---|
| `orchestrator` | First point of contact. Classifies and routes every request and drives the flow. Only delegates; never does engineering work | opus |
| `product-owner` | Owns Plan and Release: product brief, scope, priority, acceptance, release go / no-go | opus |
| `requirement-analyst` | Elicitation, user stories, numbered acceptance criteria, frozen specs | opus |
| `product-manager` | Work breakdown and bug triage, backlog, milestones, release-gate checklist | opus |
| `software-architect` | Architecture design, ADRs, architecture conformance review | opus |
| `system-engineer` | Low-level design, SOLID, design patterns, DI plan | opus |
| `software-engineer` | Implementation, bug fixes, refactors | sonnet |
| `sqa-engineer` | Test design; unit, integration, UI and architecture tests; mutation gate | sonnet |
| `code-reviewer` | Quality gate; approves only when there are zero Blockers | sonnet |
| `documentation-writer` | Writes every document | sonnet |
| `brutal-critique` | Adversarial, read-only critique of every document, run in parallel with the writer | sonnet |
| `presentation-manager` | Creates, updates and reviews `.pptx` decks so they stay true to the project | sonnet |
| `research-assistant` | All external research and wide codebase exploration | opus |
| `devops-engineer` | CI/CD, NuGet, SonarQube PR gates, releases | sonnet |
| `agent-manager` | The only agent that may change agents, skills, hooks, rules, commands and agent memory. It also creates new Claude and Copilot plugins | opus |

Agents name the `opus` and `sonnet` aliases rather than pinned model ids, so each role follows the newest model in its family. To pin a version, set `ANTHROPIC_DEFAULT_OPUS_MODEL` or `ANTHROPIC_DEFAULT_SONNET_MODEL` in `.claude/settings.json`.

## Lifecycles and gates

The `ai-dlc` skill is the catalogue of lifecycles. `request-routing` picks a lifecycle for each work item, `agent-invocation` spawns the agents, and `handoff` records the artifact at every stage boundary.

| Lifecycle | Exit artifact |
|---|---|
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

If you name a lifecycle in your request, the orchestrator runs that one. Otherwise it picks one from the state of each work item.

## Skills

Every skill is also a slash command: `/ai-dlc:<name>` in Claude Code, or the `<name>` skill in Copilot. The plugin ships no separate `commands/` folder, because a command and a skill with the same name would collide.

| Area | Skills | Main user |
|---|---|---|
| Routing and flow | `request-routing`, `ai-dlc`, `agent-invocation`, `handoff` | orchestrator |
| Product | `product-planning`, `task-triage`, `requirement-analysis`, `spec-driven-development` | product-owner, product-manager, requirement-analyst |
| Architecture and design | `architecture-design`, `architecture-review`, `architecture-narrative`, `write-adr`, `system-design` | software-architect, system-engineer |
| Engineering | `implement-feature`, `fix-bug`, `review`, `security-review` | software-engineer, code-reviewer |
| Testing (general) | `design-test-cases`, `write-tests`, `playwright-mcp-ui-testing` | sqa-engineer |
| Testing (C# / .NET) | `csharp-unit-testing`, `csharp-integration-testing`, `csharp-architecture-testing`, `csharp-mutation-testing`, `bunit-blazor-testing`, `tunit-playwright-ui-testing` | sqa-engineer |
| Performance testing | `k6-performance-testing`, `k6-load-testing`, `k6-stress-testing`, `k6-docker` | sqa-engineer |
| DevOps | `github-ci-automation`, `github-cd-automation`, `nuget-package-deployment`, `sonarqube-pr-quality-gate` | devops-engineer |
| Communication | `write-documentation`, `presentation-authoring`, `terse-output` | documentation-writer, presentation-manager; `terse-output`: the user and every agent |
| Research | `research` | research-assistant |
| Team management | `agent-management`, `skill-management`, `hook-management`, `rules-management`, `command-management`, `plugin-management`, `manage-memory` | agent-manager (all agents use `manage-memory`) |
| Project setup | `init`, `dotnet-rules`, `dotnet-test-gate` | the user |

`init`, `dotnet-rules` and `dotnet-test-gate` are **user-invocable only**: they set `disable-model-invocation: true`. `init` reads the other two skills' `SKILL.md` files and follows them, rather than calling them. Run `/ai-dlc:dotnet-test-gate` or `/ai-dlc:dotnet-rules` yourself to add, repair or remove them later.

## Hooks and rules

The plugin ships **no hooks and no rules**. A plugin hook would run in every project that enables the plugin, and stack-specific checks do not belong everywhere. Instead, `init` installs them only into repositories of the matching stack.

- **`dotnet-test-gate`** installs three things:
  - `.claude/hooks/enforce-tests.ps1`.
  - A `Stop` hook in `.claude/settings.json`.
  - `.github/hooks/ai-dlc-test-gate.json`, an `agentStop` hook for Copilot.

  The hook blocks the agent from finishing while `dotnet test` fails after a change to runtime code. It stays silent when:
  - only artifacts changed: `.claude/`, `.github/agents|skills|prompts|instructions|hooks/`, `docs/`, or `*.md` files;
  - it has already blocked once in this stop cycle;
  - `AI_DLC_ENFORCE_TESTS=false` is set.

  It runs `AI_DLC_TEST_TARGET` if that is set. Otherwise it runs a `*.Testing.slnx` or `*.Tests.sln` at the repository root. It needs PowerShell 7 (`pwsh`).
- **`dotnet-rules`** installs the C# coding-style, GlobalUsings and testing rules. Each rule goes in two places with identical content:
  - `.claude/rules/*.md` for Claude Code.
  - `.github/instructions/*.instructions.md` for Copilot.

## How the Copilot plugin is generated

[`tools/build-copilot.mjs`](../tools/build-copilot.mjs) projects the Claude plugin onto Copilot. It needs only Node 18 or later, with no dependencies.

| Claude source | Copilot output |
|---|---|
| `agents/<a>.md` | `agents/<a>.agent.md` with a platform note. Tools are mapped (see below). Claude-only tools are dropped. `mcp__*` tools are kept. Agents marked `status: deprecated` are skipped |
| `skills/**` | Copied, with the `ai-dlc:` namespace and the `${CLAUDE_SKILL_DIR}/` prefix stripped from Markdown |
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

- **`skills/init/templates/AGENTS.md`**: built from [`tools/templates/AGENTS.template.md`](../tools/templates/AGENTS.template.md) with the body of `agents/orchestrator.md` inserted at its persona marker. A project's `AGENTS.md` therefore always carries the current orchestrator.
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

1. Bump `version` in `plugins/claude/ai-dlc/.claude-plugin/plugin.json`. Also bump it in the `.github/plugin/marketplace.json` entry, which is maintained by hand.
2. Rebuild and run both validations.
3. Tag the release `v<version>` and push.

**Trying changes locally:** this repository uses the plugin it builds. Register the repository as a local marketplace once per machine:

```text
claude plugin marketplace add ./ --scope local
claude plugin install ai-dlc@ai-dlc-agent-workflow --scope local
```

Edits take effect in the next session, or after `/reload-plugins`.
