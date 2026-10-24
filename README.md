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
| `orchestrator` | Receives every human request first; classifies and routes it (lifecycle, mode, agent chain), drives the flow, verifies artifacts, runs human gates. Delegates everything else, understanding the code and docs included (to `research-assistant`) | opus |
| `product-owner` | Owns Plan and Release — product brief, scope and priority, acceptance, release go / no-go | sonnet |
| `requirement-analyst` | Specialist under the product owner — elicitation, stories, numbered ACs, frozen specs | opus |
| `product-manager` | Specialist under the product owner — work breakdown (work items, dependencies, priorities, waves), backlog, release-gate checklist | sonnet |
| `software-architect` | Architecture design, ADRs, architecture conformance review | opus |
| `system-engineer` | Low-level design, SOLID/patterns, DI plan | sonnet |
| `software-engineer` | Implementation, bug fixes, refactors | sonnet |
| `sqa-engineer` | Test design, unit/integration/UI/architecture tests, mutation gate | sonnet |
| `code-reviewer` | Quality gate — approves only at zero Blockers | sonnet |
| `documentation-writer` | Every document | sonnet |
| `presentation-manager` | Slide decks — creates, updates and reviews .pptx presentations, keeping them true to the project | haiku |
| `brutal-critique` | Adversarial read-only critique of every document | sonnet |
| `research-assistant` | All external research; owns the knowledge base | haiku |
| `devops-engineer` | CI/CD, NuGet and npm publishing, SonarQube PR gates, releases | sonnet |
| `agent-manager` | The only agent that changes agents, skills, hooks, rules or the workflow file; `brutal-critique` critiques the docs of every change, `sqa-engineer` and `code-reviewer` test and review its code | opus |

Agents use the `opus`, `sonnet` and `haiku` aliases (see the `model:` line of each file in `plugins/claude/ai-dlc/agents/`), so every role follows the newest model in its family without edits. To freeze a version, set `ANTHROPIC_DEFAULT_OPUS_MODEL` / `_SONNET_` / `_HAIKU_` in `.claude/settings.json`.

## Lifecycles

`request-routing` decides each work item's workflow (the lifecycle you asked for, else one chosen from `ai-dlc`), agent chain and orchestration mode → `agent-invocation` spawns → `handoff` records every hand-off and hand-back. The orchestrator only delegates; it never does the engineering work itself.

**AI-DLC**, the full lifecycle, is the default for feature work: Plan → G1 → Architect & Design → G2 → Breakdown → G3 → Build · Test · Review → G4 → Release, entered at the earliest missing artifact. The eight named lifecycles are its segments (PDLC to FDLC) or focused entry points (BFLC to CRLC).

| Lifecycle | Exit artifact |
|---|---|
| **AI-DLC** Full lifecycle | Released feature, traceable from brief to release notes |
| **PDLC** Product Design | Stories with numbered acceptance criteria |
| **ASDLC** Architecture & Design | ADRs + frozen `docs/specs/<slug>.spec.md` |
| **STBLC** Story & Task Breakdown | Dependency-ordered tasks with technical DoD |
| **FDLC** Feature Development | Code + tests + docs + review with zero Blockers |
| **BFLC** Bug Fixing | Root cause, minimal fix, regression test that failed first |
| **RLC** Refactoring | Same behaviour, mutation score not lower |
| **TLC** Testing | AC traceability, new tests, mutation report |
| **CRLC** Code Review | Change driven to merge-ready |

Human gates: **G1** stories/ACs · **G2** frozen spec · **G3** task plan · **G4** review report · release go / no-go.

Changes to agents, skills, hooks, rules, commands and the workflow file run one of two agent-artifact lifecycles, chosen from the change set. **AAWH** (harness) is for a docs-only change under the harness folders (agents, skills, rules, instructions, commands, prompts, the workflow file, `AGENTS.md`): `product-owner` states the intent, `agent-manager` makes the change, then `documentation-writer` and `brutal-critique` run in parallel (the critique returns PASS or REVISE). **AAWP** (plugin / mod) is for any change that holds code or touches `plugins/`, `tools/` or `tests/`: `product-owner` → `software-architect` → `system-engineer` → `agent-manager` → `sqa-engineer` → `code-reviewer`, then `documentation-writer` and `brutal-critique` in parallel. Neither has a `software-engineer` stage or a gate. In either variant the orchestrator chooses agent team or subagents per request, and asks you when it cannot decide. An `AAWH` run whose change turns out to hold code stops before any review and you decide, with "continue as `AAWP`" recommended. `brutal-critique` also reviews each handoff record of either variant, with limits of its own (`handoffReview`, `AI_DLC_HANDOFF_REVIEW_MAX_ROUNDS` and `AI_DLC_HANDOFF_REVIEW_MAX_FAILURES`, 2 and 1 by default). **In progress:** the two lifecycles exist in the workflow template; the `variant` command that picks the variant arrives with ITEM-048, and the reviews of this change are still open. Findings go back to `agent-manager` while each reviewer's own limits allow: every loop has a `maxRounds` and a `maxFailures` (2 and 1 by default), set in `.ai-dlc/workflow.json` and overridable per developer or team through `AI_DLC_*` variables in `env` of `.claude/settings.local.json` or `.claude/settings.json`; `node .ai-dlc/workflow.mjs rounds` shows the limits in effect. When a loop stops with findings open, you decide: raise its limits for the run, or stop or accept them. After updating the plugin, run `/ai-dlc:workflow upgrade` in each repository that has `.ai-dlc/workflow.json`: an older file fails `validate` without the new review stages, and `upgrade` adds the missing loop limits without overwriting your values. Limits an older file left implicit are now 2 rounds / 1 failure, and an omitted `clarify.maxRounds` went from 3 to 2; to keep three full rounds on a loop, set `maxRounds` 3 and `maxFailures` 2. The orchestrator's reminder at session start relies on the plugin version changing between releases. Every run keeps a committed folder, `docs/handoffs/{LIFECYCLE}-{YYYYMMDD}-{feature-slug}/`, with its run state (one file per session, named `run.v<major>[.<minor>].md` such as `run.v1.md`, `run.v1.1.md` or `run.v2.md`, the highest version being current, written before each spawn and after each return or gate; a change of direction writes a minor pair, a widened scope the next major, and a plain continuation updates the current version in place for its owner and otherwise writes the next minor; a run from before versions keeps a `run.md`), a handoff record written before every hand-off (`1.3-orchestrator-to-software-engineer.handoff.md`: each feature is one root step and every hand-off for it, follow-ups included, is a sub-step of its phase: `N.1` planning, `N.2` implementation, `N.3` testing, `N.4` review with `N.4.1` and `N.4.2` for the two review axes, `N.5` documentation; loops are `l<k>` with their rounds as sub-numbers; in an agent-artifact run `N.2` is the change, `N.3` the tests, `N.4.1` and `N.4.2` the review and `N.5` the docs, with `N.5.l1` for the critique's fix rounds) and each agent's hand-back, the report it returned, stored with the same step code (`1.3-software-engineer-to-orchestrator.handback.md`), so a new session can resume a run after a crash or a lost context. The numbering and version rules are in the [`handoff` skill](plugins/claude/ai-dlc/skills/handoff/SKILL.md) (*Naming*, *Run state*). **In progress:** this phase numbering and the major.minor versions are still in review.

## Install

### Claude Code

```text
/plugin marketplace add rafsanulhasan/ai-dlc-agent-workflow-plugin
/plugin install ai-dlc@ai-dlc-agent-workflow
```

From a local clone: `/plugin marketplace add E:\Projects\personal\ai-dlc-agent-workflow-plugin`, or for one session `claude --plugin-dir ./plugins/claude/ai-dlc`.

#### Automatic session handoff and keep-alive

The Claude plugin includes a [Claude Code mod](https://code.claude.com/docs/en/plugins/mods/overview) (a hooks module) with two parts, both adapted from their authors' repositories under the MIT License (see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)):

| Part | Where | What it does |
|---|---|---|
| Automatic session handoff | Part of `ai-dlc` (`plugins/claude/ai-dlc/hooks/auto-handoff/`) | Before the context window fills, it has Haiku write a session handoff, runs `/clear`, and seeds the fresh session to carry on, instead of auto-compacting. When the repository has an active AI-DLC run on the current branch that this session drives (or the only one, unclaimed), it writes the `handoff` skill's session handoff to `.scratch/<run-folder>/` and points the run's current run state (the highest `run.v<major>[.<minor>].md`; `run.md` for a run from before versions) at it, so the orchestrator resumes the run. **In progress:** the module's handling of versioned run states is being updated to match the `handoff` skill; the versioning rule is the skill's. Otherwise it writes its own brief to `~/.claude/state/auto-handoff/`. Adapted from [alexknowshtml/claude-auto-handoff](https://github.com/alexknowshtml/claude-auto-handoff). |
| Keep-alive | Part of `ai-dlc` (`plugins/claude/ai-dlc/hooks/keepalive/`) | When a turn ends with background work still running (a teammate, a long build), pings the prompt cache so it doesn't expire before the work reports back. It has a 1-hour track (a ping every 50 minutes, for up to 8 hours) and a 5-minute track (every 3 minutes, for up to 1 hour), run by the lifetime the session's cache was written with, each with its own status line. It stops when the work is done (a new turn, no background task left, the session ending or handing off), on a cache miss, at a track's time or ping limit, or at the optional spend limit. `/ai-dlc:cache-keepalive` pings now, `/ai-dlc:cache-keepalive 2h` sets the keep-warm time of both tracks for this session, `/ai-dlc:cache-keepalive 30m --track 5m` of the 5m track only, `/ai-dlc:cache-keepalive 1d --machine` for every session on this machine. Every setting is an `AI_DLC_KEEPALIVE_*` variable in a settings file's `env` and a key in `.ai-dlc/cache-keepalive.json` (keep-alive has no `/config` rows); `/ai-dlc:init` writes its keep-warm time and the default scope of `/ai-dlc:cache-keepalive` there and writes every other key with this plugin version's default (a later plugin default does not reach a key already written), `/ai-dlc:cache-keepalive-merge` brings that file up to date after a plugin upgrade, and `/ai-dlc:cache-keepalive-configure` shows and changes the team's values in it, or one developer's in the `env` of `.claude/settings.local.json`; the full table, the status lines and what the cache can reuse across a handoff are in its [README](plugins/claude/ai-dlc/hooks/keepalive/README.md). Adapted from the `cache-keepalive` mod of [RichardJSun/claude-code-mods](https://github.com/RichardJSun/claude-code-mods); the changes are listed in its `ATTRIBUTION.md`. |

Both need Claude Code 2.1.287 or later, and both make model requests that count against your plan or API usage. GitHub Copilot has no mods, so the Copilot plugin includes neither, nor the `cache-keepalive` skill that names keep-alive's command or the `cache-keepalive-install`, `cache-keepalive-merge` and `cache-keepalive-configure` skills that manage its settings; there, the `handoff` skill's session handoff is written by hand, and keep-alive does not exist.

Only the main session (the lead of an agent team) is handed off automatically. Subagents and teammates each have their own context window, and `/clear` cannot reset one; for in-process teammates, set `autoCompactWindow` in the subagent definition they are spawned from so they compact instead. `/ai-dlc:init` asks for the handoff percentage, which it writes to `.ai-dlc/auto-handoff.json`. The handoff keeps the prompt cache's shared prefix (tools, system prompt, project context) as it was, and the fresh session's first request logs and shows whether it read that prefix from the cache; the old conversation itself can never be reused.

The automatic handoff's settings live in the repository's `.ai-dlc/auto-handoff.json`, committed for the whole team, which `/ai-dlc:init` writes and `/ai-dlc:configure-auto-handoff` shows (with where each value comes from) and changes. Each key is read, highest first, from `env` of `.claude/settings.local.json` (one developer's override), `env` of `.claude/settings.json`, the process environment, `.ai-dlc/auto-handoff.json`, then the default; the automatic handoff has no `/config` rows. In `env` and the environment, a key is its `AI_DLC_AUTO_HANDOFF_*` variable, listed in the file's schema (`.ai-dlc/auto-handoff.schema.json`). The settings reload at each session start. From `.ai-dlc/auto-handoff.json`, `viewer`, `briefTemplate` and `instructionsTemplate` apply only in a folder Claude Code trusts (`hasTrustDialogAccepted` in `~/.claude.json`, which Claude Code in VS Code and the SDK did not set in the versions tested, since they showed no trust dialog); elsewhere they are logged and skipped, so a cloned repository cannot serve your handoffs to the network or pick the files the module writes and reads. Set them for yourself in `env` of `.claude/settings.local.json`. The settings you are most likely to change (every key, with its variable, is in the schema):

| Setting | Default | What it does |
|---|---|---|
| `thresholdPercent` | `80` | Share of the context window, 1 to 100, that starts a handoff. The window is the one Claude Code reports for the session, or `defaultContextWindow` (500000 tokens) when it reports none (logged once; see *The fallback window* below). A seeded session hands off no sooner than `seedHeadroomTokens` (default 40k) above its own starting size. It replaces the old token `threshold`, which is no longer read |
| `maxConsecutiveHandoffs` | `2` | Handoffs allowed before you type a prompt when no AI-DLC run is active; past this, it pauses until you do. While the run a chain of handoffs belongs to stays active, the chain goes on until the run is done, blocked or abandoned (`chainWhileRunActive`) |
| `briefTemplate` | `~/.claude/auto-handoff/brief.md` | The sections Haiku writes when no AI-DLC run is active. With an active run it uses the `handoff` skill's session handoff template instead |
| `instructionsTemplate` | `~/.claude/auto-handoff/instructions.md` | What the fresh session is told to do first |
| `ignoreFiles` | blank | Regex for edited files to leave out, such as caches or synced state |
| `viewer` | blank | `host:port` to serve a readable page for each handoff (`tailscale` as the host means this machine's Tailscale IP). Blank: no server, and the link is the local file. Anything that is not `host:port` is logged and ignored |

Kill switches: `enabled: false` in `.ai-dlc/auto-handoff.json` stops handoffs, and `AI_DLC_AUTO_HANDOFF_ENABLED=false` does so for the sessions started from that shell (or for one developer, in `env` of `.claude/settings.local.json`). `DISABLE_AUTO_COMPACT` also stops them, for setups where something else owns the context limit. With `viewer` set, the viewer still serves earlier handoffs. `thresholdTokens` replaces the percentage with an absolute token count; as `AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS=<n>` it applies to the sessions started from that shell. Use it when Claude Code reports no window and yours is not `defaultContextWindow`, or for a test run. The old `AUTO_HANDOFF_TOKENS` and `AUTO_HANDOFF_DISABLE` variables are no longer read. The module's log is `~/.claude/state/auto-handoff/auto-handoff.log`. Each handoff it starts logs the line it crossed and the window behind it: `threshold session=<id> tokens=<n> threshold=<n> window=<n|none> windowSource=<host|host-percent|default|none> basis=<thresholdPercent:<n>|thresholdTokens> hostWindowSource=<source|none> autoCompactThreshold=<n|none> via=<trigger>`. `windowSource` is `host` for the window Claude Code reported, `host-percent` for one worked out from the percentage it reported, `default` for `defaultContextWindow`, and `none` under `thresholdTokens`, where no window is read. `hostWindowSource` and `autoCompactThreshold` are Claude Code's own figures: how it settled the window it compacts against (`model-default`, `env`, `settings`, `clientdata`, `experiment`, `unknown-model` or `auto`) and the token count its auto-compact runs at. The module asks Claude Code for them, as a local estimate, only when it writes this line, and logs `none` for a figure Claude Code does not give. The optional status line wrapper `handoff-link.sh` adds the handoff's page link to your status line. It is installed at `~/.claude/plugins/cache/ai-dlc-agent-workflow/ai-dlc/<version>/hooks/auto-handoff/statusline/handoff-link.sh` (the `installPath` in `~/.claude/plugins/installed_plugins.json` gives the version folder) and needs `jq`: without it the link never shows.

**The fallback window.** `defaultContextWindow` (default 500000 tokens, `AI_DLC_AUTO_HANDOFF_DEFAULT_CONTEXT_WINDOW`) is a safety net that should not run. Claude Code's hook types declare the session's context window a required number (as of Claude Code 2.1.306), and a window Claude Code reports always wins; the fallback applies only if it reports neither a window nor a percentage. Its value fits neither window size Claude Code documents, 200000 tokens by default and 1000000 with extended context ([status line documentation](https://code.claude.com/docs/en/statusline), `context_window.context_window_size`): the maintainer chose it on 2026-10-21 (run `AAW-20261021-mods-config`, lowered from 700000) as a compromise between the two, with no technical reason recorded. If it does run, the default 80% gives a line of 400000 tokens:

- On a 1000000 window, the session hands off at 40% of it, earlier than you asked for.
- On a 200000 window, the line is above the window and is never crossed. The module takes the place of Claude Code's auto-compact (as of Claude Code 2.1.306), so the handoff still happens, but only when Claude Code would have auto-compacted.

The module logs `no context window reported: thresholdPercent applies to 500000, a line of 400000 tokens; if the real window is smaller than 400000, the handoff waits for auto-compact: set thresholdTokens (AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS) to an absolute token count` once per process (the numbers follow `defaultContextWindow` and `thresholdPercent`), and each handoff's `threshold` line then reads `windowSource=default`, with Claude Code's own `hostWindowSource` and `autoCompactThreshold` next to it. If you see either, set `defaultContextWindow` to your real window or `thresholdTokens` to an absolute count.

**Installed the separate `auto-handoff` plugin before?** The automatic handoff used to be its own plugin, installed as a dependency of `ai-dlc`. Claude Code keeps an auto-installed dependency until you prune it, so the old copy could run next to the new one. Remove it with `claude plugin uninstall auto-handoff@ai-dlc-agent-workflow` (or `claude plugin prune`, which removes auto-installed dependencies no installed plugin needs any more), and drop `"auto-handoff@ai-dlc-agent-workflow"` from `enabledPlugins` in your settings if it is there. Settings you made under `auto-handoff` in `/config` do not carry over, and `ai-dlc` has no `/config` rows: set them with `/ai-dlc:configure-auto-handoff`.


### GitHub Copilot CLI

```text
copilot plugin marketplace add rafsanulhasan/ai-dlc-agent-workflow-plugin
copilot plugin install ai-dlc@ai-dlc-agent-workflow
```

Or directly: `copilot plugin install rafsanulhasan/ai-dlc-agent-workflow-plugin:plugins/copilot/ai-dlc`.

### VS Code

VS Code's agent-plugin support reads the same Copilot/Claude plugin formats; add this repository as a plugin marketplace from VS Code's agent plugin settings.

## Use it in a project

1. **Bootstrap once:** `/ai-dlc:init` (Claude) or the `init` skill (Copilot). It scaffolds `AGENTS.md` — the orchestrator persona for your project, with all its routing rules and skills, plus your gates and artifact paths — `CLAUDE.md` (an `@AGENTS.md` import, your build / test / mutation commands and the Claude Code specifics), `.github/copilot-instructions.md` (the same commands and the Copilot specifics), recommended `.claude/settings.json` permissions and the `docs/` folders the lifecycles write to, plus the worktree and scratch roots (via `workspace-folders`; `/ai-dlc:workspace-folders` changes them later). It also installs `.ai-dlc/workflow.json`, the team's workflow — stages, who hands off to whom, gates and their approvers, the clarify matrix and routing — which the orchestrator follows instead of the plugin default, with `.ai-dlc/catalog.json` (the installed plugin's agents and skills, which `validate` checks every stage against) and a workflow gate hook that blocks finishing while the file is invalid; `/ai-dlc:workflow show` prints it with diagrams and `/ai-dlc:workflow edit <change>` customises it. In every repository, whatever its stack, it installs the documentation rule (`.claude/rules/docs-status.md` with a `.github/instructions/` twin, via `docs-rules`): only `documentation-writer` writes documentation, every other agent asks it for a docs update in its hand-back, and a feature is marked *planned* until an agent starts building it, *in progress* from then until the run's last review or gate stage is done, and unmarked once done. In a .NET repository it also installs the C# coding-style, GlobalUsings and testing rules (`.claude/rules/*` with `.github/instructions/*` twins, via `dotnet-rules`), the `dotnet test` gate hook (via `dotnet-test-gate`) and `stryker-config.json`. In a JS / TS repository (a `package.json`) it installs the `node-coding-style`, `node-modules`, `node-async-errors` and `node-testing` rules (via `node-rules`) and the test gate hook (via `node-test-gate`). It shows a diff before touching any existing file, and merges into an existing `AGENTS.md`, `CLAUDE.md` or `.github/copilot-instructions.md` instead of replacing it: its content sits in `<!-- ai-dlc:begin … -->` blocks and your own lines stay as they are.
2. **Talk to the orchestrator.** `init` sets `"agent": "ai-dlc:orchestrator"` in the repo's `.claude/settings.json`, so every request reaches it first (one-off: `claude --agent ai-dlc:orchestrator`). On Copilot, select the `orchestrator` custom agent.
3. The orchestrator classifies your request, gets a work breakdown from `product-manager`, routes each item to a lifecycle and agent chain, confirms the plan with you, then runs the lifecycle and stops at each human gate.

The orchestrator must be the **main** agent: it is the lead that talks to you and runs the whole team, and subagent nesting is limited (on Claude Code to `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` levels, default 3 from v2.1.219, `1` to turn it off; GitHub Copilot does not document nested spawning, so the plugin assumes only the main agent spawns there; running the orchestrator as a subagent is not tested), so invoking it as `@agent-ai-dlc:orchestrator` from another agent is not supported.

If a project still has its own copies of these agents in `.claude/agents` / `.github/agents`, remove them after installing the plugin so each role exists once.

### Requirements

- For the bundled mods: Claude Code 2.1.287 or later
- For .NET projects: .NET SDK (`dotnet test`, `dotnet stryker` via a local tool manifest)
- For the .NET test gate: PowerShell 7 (`pwsh`) on PATH — on any OS
- For JS / TS projects and their test gate: Node.js 18 or later, and the project's package manager (npm, pnpm, yarn or bun)
- Optional MCP servers the agents use when present: GitHub, SonarQube, Playwright, context7. Agents that need them (`product-manager`, `software-engineer`, `sqa-engineer`, `devops-engineer`, `code-reviewer`, `research-assistant`) inherit whatever MCP tools your session has instead of hard-coding one gateway's tool names.

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
| `/ai-dlc:lens` | — | Opens the AI-DLC lens pane, a live view of the run: the flowchart of agents, the main loop's thinking and gathered context, and the lens settings in force (needs the ai-dlc-lens plugin). **Claude Code only.** |
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

## ai-dlc-lens: a live view of the run (Claude Code only)

`ai-dlc-lens` is a second plugin in this marketplace, a Claude Code mod (a hooks module) that draws an AI-DLC run while it happens. **In progress:** it is being built in the run `FEAT-20261020-ai-dlc-lens` and its reviews are still open. It started as spike ITEM-027 (round 6) and has since been extended, so its commands, settings and panes can still change before release. The full reference is in its [README](plugins/claude/ai-dlc-lens/README.md).

What it shows:

- **A workflow per run.** When the orchestrator spawns agents, the **AI-DLC workflow** view appears: one collapsible panel per run (the work item and its `docs/handoffs/<run>/` folder), with a flowchart per step of the run, its agents each drawn as a robot (the same robot for every agent of a type) with its persona name, model and role. A ring around the robot shows its status; a running agent's ring blinks. A new run never hides an earlier one.
- **Panels behind the chart.** Pressing an avatar opens the agent's panel (usage, context window, tokens, cost, tool calls, background tasks, thinking); pressing an arrow opens the hand-off panel (the handoff record and the hand-back, or the prompt). They open inside the view with `< Back` (drill-in, the default) or as a separate pane (a tab); the **Panel Type** switch `◉ Drill in  ○ Tab` changes it for the session. A run whose agents have all ended draws its orchestrator idle.
- **Step charts and run ordering (in progress).** Each run is drawn as one chart per top-level step (`Step N · <feature>`, highest step first, drawn from the run folder's records as well as live spawns, with sub-steps and loop rounds hanging under their step); the chat card draws one chart per task when its agents work on unrelated tasks; runs are listed newest first; a run with `parent: <run id>` in its `run.md` is drawn in its parent's chart, and a brief naming a merged-away run folder joins the run that kept it; a chart row holds at most `chartAvatarsPerRow` avatars (default 8) and wraps beyond that.
- **Usage, cache and cost.** Prices and context windows come from `.ai-dlc/model-metadata.json`, which the `ai-dlc` setup keeps current; a figure it cannot price shows `—`. A **Cache keep-alive** section in every agent pane shows how long keep-alive kept the prompt cache warm and what cache reads saved.
- **Status and anomaly markers.** A status dot per run, and a coloured marker, a toast and an Anomalies section when a run or step is blocked, a gate waits for you or was rejected, a loop is out of rounds, an agent failed, was killed or waited too long, or a hand-back failed its check (see *Anomaly alert* below). The markers on the chat card and the lens pane update live.
- **Full screen.** `⤢` shows one step of one run alone with its chart 1.5 times larger (`⤢` on a step chart picks that step); `Runs:` switches runs, `Steps:` switches steps and `⤡` restores the view.
- **A chat card.** The first spawn of a workflow leaves a card in the chat that names it, draws its flowchart (or a one-line chip with an "Open flowchart" button when the row is narrow) and opens the view.

### How it relates to `ai-dlc`

The two plugins are independent. The panes, the chart and the chat card need only `ai-dlc-lens`. The `/ai-dlc:lens*` commands are thin Claude-only skills of `ai-dlc` that name each command, and the lens answers them itself; Claude Code lists them only when `ai-dlc` is installed (typed in full without it, the lens still answered them in a headless run). The keep-alive line and section read the state that `ai-dlc`'s [keep-alive](plugins/claude/ai-dlc/hooks/keepalive/README.md) publishes, read-only; without `ai-dlc` or with no track running they are not drawn. `ai-dlc` does not depend on the lens, and GitHub Copilot has no mods, so the Copilot build skips the plugin and the six skills.

### Setup

```text
/plugin marketplace add rafsanulhasan/ai-dlc-agent-workflow-plugin
/plugin install ai-dlc-lens@ai-dlc-agent-workflow
/reload-plugins
```

From the command line: `claude plugin install ai-dlc-lens@ai-dlc-agent-workflow`. From a local clone, for one session: `claude --plugin-dir ./plugins/claude/ai-dlc-lens`. Then spawn an agent, or run the orchestrator: the workflow view opens by itself. Optionally run `/ai-dlc:lens-init` to write `.ai-dlc/lens.json` (every default) and its schema, so the team can commit its settings. The checks in `plugins/claude/ai-dlc-lens/MANUAL-CHECKS.md` name Claude Code 2.1.299 or later for the install; the final minimum is decided at gate G2 of the lens's own run, and the [plugin README](plugins/claude/ai-dlc-lens/README.md) points here. If you installed the earlier spike plugin (`ai-dlc-lens-spike-027`), uninstall it first: both register the same hooks.

### Commands

The commands are listed with all the others in *Commands* above; what each does:

| Command | Arguments | What it does |
|---|---|---|
| `/ai-dlc:lens` | none | Opens the older single-pane "AI-DLC lens" view. The workflow view needs no command. |
| `/ai-dlc:lens-init` | `[--force]` | Writes `.ai-dlc/lens.json` and `.ai-dlc/lens.schema.json`; keeps an existing `lens.json` unless `--force`. |
| `/ai-dlc:lens-configure` | `[<key> [<value>\|--unset]]` | Lists every setting with its value, the level it comes from and its env name; sets or unsets one in `.ai-dlc/lens.json`. |
| `/ai-dlc:lens-keepalive` | `[on\|off]` | Shows or hides the Cache keep-alive section of the agent panes (on by default), then reports its figures. Bare, it flips the value. |
| `/ai-dlc:lens-gate` | `[on\|off]` | Turns anomaly reporting on or off; bare, it lists the current anomalies, the runs it read and the `anomalyRunScope` in force (below). |
| `/ai-dlc:lens-kit` | none | Opens the kit pane, the manual checks K1 to K5 used while developing the lens. |

### Skills

Six skills of `ai-dlc`, one per command, each `disable-model-invocation: true` and Claude Code only: `lens`, `lens-init`, `lens-configure`, `lens-keepalive`, `lens-gate` and `lens-kit` (in `plugins/claude/ai-dlc/skills/`). Each names its command and, if the model ever reads it (the lens is not installed or is turned off), tells you how to install the lens and does nothing else.

### Anomaly alert

`/ai-dlc:lens-gate` reports what needs you, from each run's current run state (the highest `run.v<major>.md` or `run.v<major>.<minor>.md`, or `run.md` for a run from before versions), its handoff records and hand-backs and the agents the lens tracks. Each anomaly is shown once as a toast with the ▲ marker, marked in the workflow view in its colour, and listed in an "Anomalies (n)" section. Done and abandoned runs report nothing; there is no Stop hook. **In progress:** a gate row you decided in words, with a date, no longer counts as waiting.

| Anomaly | Colour |
|---|---|
| A run is blocked, or a step is blocked (a *Stages* row starting with `blocked`, even while the run is active) | red |
| A gate you rejected | red |
| An agent failed or stopped; an agent was killed or waited `anomalyWaitingMinutes` (default 30) or more | red |
| A gate waits for you | orange |
| A loop is out of rounds | deep orange |
| A hand-back failed its check (marked on its record's arrow) | yellow |

Every check has its own on/off and colour setting; `gateAlert` `false` turns all reporting off. `anomalyRunScope` (`session`, the default, or `all`; env `AI_DLC_LENS_ANOMALY_RUN_SCOPE`) chooses whether only this session's runs are read or every active or blocked `run.md` under the handoffs folder. See the [plugin README](plugins/claude/ai-dlc-lens/README.md#anomaly-alert).

### Settings

Each setting takes the first valid value from, highest first: `AI_DLC_LENS_*` in `env` of `.claude/settings.local.json`, `env` of `.claude/settings.json`, `.ai-dlc/lens.json`, then the default. An invalid value is skipped; the process environment is never read. The main ones:

| Setting | Default | What it does |
|---|---|---|
| `panelOpenMode` | `drill-in` | Avatars and arrows open inside the view (`drill-in`) or as a separate pane (`tab`). The Panel Type switch overrides it for the session. |
| `gateAlert` | `true` | Anomaly reporting on or off. |
| `anomalyRunScope` | `session` | Runs the detector reads: this session's (`session`) or every active or blocked run (`all`). |
| `workflowPlace` | `pinned` | `pinned`: the band above the prompt (terminal and desktop app); `docked`: the pane. In VS Code the view is always a pane. |
| `avatarStyle` | `robot` | `robot`, `image` (per-agent `avatarImage.<agent>`) or `initials`. |
| `keepaliveSection` | `true` | The Cache keep-alive section of the agent panes. |
| `collapsedByDefault` | `true` | Every `[+]`/`[-]` section starts collapsed. |
| `chartAvatarsPerRow` | `8` | **In progress.** The most avatars one chart row holds (2 to 24); a level with more wraps onto further rows. |
| `costingPath` | `.ai-dlc/model-metadata.json` | Prices and context windows (read only). |

Every key, its env name and its range is in the [plugin README](plugins/claude/ai-dlc-lens/README.md#settings); `/ai-dlc:lens-configure` prints them with where each value comes from.

### Limits

- **Failures stay contained.** A lens error never replaces Claude Code's own Agent row (the card falls back to it), and a pane that cannot be drawn shows `lens: the <pane> could not be drawn (…)`. The lens's timers stop when the session ends, not at `/clear`.
- **VS Code places panes.** A mod cannot choose where a pane goes, make it full screen, or minimise it; the lens draws its own full screen, minimise and restore controls, and VS Code has no band above the prompt, so the view stays a pane there.
- **Agent and hand-off tabs** cannot be minimised by a mod.
- **Images** for avatars must be a `data:` URI or a file inside a folder Claude Code trusts; remote URLs are never fetched.
- **Claude Code only.** There is no Copilot version.

## The test gates

The plugin adds no settings hooks of its own to a project: its only hooks are its Claude Code hooks module (the automatic handoff and keep-alive, above). `init` installs the gate for each stack it detects; a repository with both stacks gets both. In every repository it also installs the **workflow gate** (`.claude/hooks/check-workflow.mjs`, a `Stop` hook and `.github/hooks/ai-dlc-workflow-gate.json`), which blocks finishing — once per stop cycle, like the test gates — while `.ai-dlc/` has uncommitted changes that fail `node .ai-dlc/workflow.mjs validate`; `AI_DLC_WORKFLOW_GATE=false` pauses it. `init` installs no sync hook: in a consumer repository, run `/ai-dlc:harness-sync [args]`, a plugin command only you invoke, which runs `node .claude/scripts/sync-harness.mjs`, a two-way sync of agents, skills, commands / prompts, rules / instructions and hooks between `.claude/` and `.github/` (`--check` only reports). Only this plugin repository syncs automatically, in its own `Stop` hook.

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
node --test "tests/**/*.test.mjs"  ← repository tests in tests/ (quote the glob)
npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/ai-dlc
```

`init`'s `AGENTS.md` template is generated too: `tools/templates/AGENTS.template.md` with the body of `agents/orchestrator.md` inserted at its persona marker, so a project's `AGENTS.md` always carries the current orchestrator persona. Edit the orchestrator or the template, then rebuild.

This whole setup is captured as the `plugin-management` skill (owned by `agent-manager`), with the build script shipped as its template, so the team can create and release other Claude Code + Copilot plugins the same way: `/ai-dlc:plugin-management create <name>`.

CI (`.github/workflows/validate.yml`) fails if the Copilot tree is stale (`node tools/build-copilot.mjs --check`), a test in `tests/` fails, a harness twin is pending (`node .claude/scripts/sync-harness.mjs --check`), the Claude plugin or the marketplace stops validating (`plugin validate --strict`), or a test of the hooks module fails (`plugin test`). Never hand-edit `plugins/copilot/**`.

The build projects each Claude agent to `agents/<name>.agent.md`, translates tools to Copilot aliases (`Read`→`read`, `Write`/`Edit`→`edit`, `Glob`/`Grep`→`search`, `Bash`→`execute`, `Agent`→`agent`, `WebFetch`/`WebSearch`→`web`, `TodoWrite`→`todo`), drops Claude-only tools, leaves out the Claude-only skills listed in `tools/claude-only-skills.json`, strips the `ai-dlc:` namespace, and converts plugin hooks (if any are added) to Copilot's `version: 1` format. In this repository a `Stop` hook (`.claude/hooks/stop-sync-then-check.mjs`) first syncs the `.claude/` ↔ `.github/` harness twins, then blocks the agent from finishing while the Copilot tree is stale (`check-copilot-stale.mjs`); the two run in one command because Claude Code runs the hooks of one event in parallel.

## What changed from the original `.claude/` setup

- **Namespacing.** Agent ids are `ai-dlc:<name>` in Claude Code (the `-claude` suffix is gone); skills are `/ai-dlc:<name>`.
- **Commands folded into skills.** In a plugin a command and a skill with the same name collide, and skills are slash-invocable on both platforms. Where a skill was a stub (`fix-bug`, `implement-feature`, `review`, `requirement-analysis`, `system-design`), the command's full method became the skill.
- **Sync skills replaced by the build.** `agent-sync`, `skills-sync`, `hooks-sync`, `command-prompt-sync` and `rules-instructions-sync` are gone; `agent-manager` now distinguishes plugin scope (edit + rebuild) from project scope (hand-maintained twins).
- **Product owner added.** `product-owner` (new) owns the Plan and Release phases and directs `requirement-analyst` and `product-manager`, which stay as specialists.
- **Triage agent retired.** `orchestrator` (new) receives human requests, classifies and routes them, and executes the flow; `product-manager` triages non-trivial requests and bugs into prioritised work items with dependencies and waves. The old `triage` skill is split into `request-routing` (orchestrator) and `task-triage` (product manager).
- **Added from the AI-DLC deck:** `ai-dlc` lifecycle router, `handoff`, `brutal-critique`, `csharp-mutation-testing`, a full `security-review`, and `init`.
- **Added afterwards:** `architecture-narrative` (three-act architecture story for G2 and stakeholders, after Mark Richards' Software Architecture Monday lesson 224); its source video frames are not redistributed. `terse-output` (a terse response register at three levels, `lite` / `full` / `ultra`, on until you turn it off), with compressed agent reports in `agent-invocation`, a compact review format in `review` and a `compress` action in `manage-memory`, adapted from [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) (Apache-2.0); see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- **Test gate moved to the target project.** The `dotnet test` Stop hook is no longer a plugin hook; `init` installs it only in .NET repositories via `dotnet-test-gate`, and the plugin's `enforce_tests` / `test_target` settings are gone (use `AI_DLC_ENFORCE_TESTS` / `AI_DLC_TEST_TARGET`).
- **Documentation rule added.** `init` installs the `docs-status` rule in every repository via `docs-rules`: only `documentation-writer` writes documentation, other agents request a docs update in their hand-back, and status markers (*planned*, *in progress* until the run's last review or gate stage is done, then none) come from the run state, and from the backlog only for work no run records.
- **.NET rules moved to a skill.** The C# coding-style, GlobalUsings and testing rules are no longer scaffolded into every repository; `init` installs them only in .NET repositories via `dotnet-rules`.
- **Fixes:** the test-gate script now reads its JSON payload from stdin and returns the top-level `decision`/`reason` contract (the old script could not block); agents that call skills now have the `Skill` tool; `software-architect` can write the ADRs it is asked to write.

## License

AI-DLC Agent Workflow is released under the [MIT License](LICENSE), Copyright (c) 2026 Rafsanul Hasan. Both plugins ship a copy of it: the build copies the root `LICENSE` into `plugins/claude/ai-dlc/` and `plugins/copilot/ai-dlc/`.

The two parts of the Claude plugin's hooks module (`hooks/auto-handoff/` and `hooks/keepalive/`) are MIT-licensed by their own authors and keep their own `LICENSE` files. They, and the parts adapted from other projects (such as [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman), Apache-2.0), are attributed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
