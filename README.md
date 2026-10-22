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

Changes to agents, skills, hooks, rules, commands and the workflow file run **AAW**: `agent-manager` makes the change; `brutal-critique` reviews the docs (PASS or REVISE), while `sqa-engineer` tests and then `code-reviewer` reviews any code; findings go back to `agent-manager` while each reviewer's own limits allow: every loop has a `maxRounds` and a `maxFailures` (2 and 1 by default), set in `.ai-dlc/workflow.json` and overridable per developer or team through `AI_DLC_*` variables in `env` of `.claude/settings.local.json` or `.claude/settings.json`; `node .ai-dlc/workflow.mjs rounds` shows the limits in effect. When a loop stops with findings open, you decide: raise its limits for the run, or stop or accept them. After updating the plugin, run `/ai-dlc:workflow upgrade` in each repository that has `.ai-dlc/workflow.json`: an older file fails `validate` without the new review stages, and `upgrade` adds the missing loop limits without overwriting your values. Limits an older file left implicit are now 2 rounds / 1 failure, and an omitted `clarify.maxRounds` went from 3 to 2; to keep three full rounds on a loop, set `maxRounds` 3 and `maxFailures` 2. The orchestrator's reminder at session start relies on the plugin version changing between releases. Every run keeps a committed folder, `docs/handoffs/{LIFECYCLE}-{YYYYMMDD}-{feature-slug}/`, with its run state (`run.md`, written before each spawn and after each return or gate), a handoff record written before every hand-off (`3-orchestrator-to-software-engineer.handoff.md`) and each agent's hand-back, the report it returned, stored with the same step code (`3-software-engineer-to-orchestrator.handback.md`), so a new session can resume a run after a crash or a lost context.

## Install

### Claude Code

```text
/plugin marketplace add rafsanulhasan/ai-dlc-agent-workflow-plugin
/plugin install ai-dlc@ai-dlc-agent-workflow
```

From a local clone: `/plugin marketplace add E:\Projects\personal\ai-dlc-agent-workflow-plugin`, or for one session `claude --plugin-dir ./plugins/claude/ai-dlc`.

#### Automatic session handoff and the bundled mod

The Claude plugin includes a [Claude Code mod](https://code.claude.com/docs/en/plugins/mods/overview) (a hooks module) and installs one more as a dependency. Both are adapted from their authors' repositories under the MIT License (see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)):

| Mod | Where | What it does |
|---|---|---|
| Automatic session handoff | Part of `ai-dlc` (`plugins/claude/ai-dlc/hooks/auto-handoff/`) | Before the context window fills, it has Haiku write a session handoff, runs `/clear`, and seeds the fresh session to carry on, instead of auto-compacting. When the repository has an active AI-DLC run on the current branch that this session drives (or the only one, unclaimed), it writes the `handoff` skill's session handoff to `.scratch/<run-folder>/` and points the run's `run.md` at it, so the orchestrator resumes the run. Otherwise it writes its own brief to `~/.claude/state/auto-handoff/`. Adapted from [alexknowshtml/claude-auto-handoff](https://github.com/alexknowshtml/claude-auto-handoff). |
| `cache-keepalive` | Its own plugin in `plugins/claude-mods/`, a dependency of `ai-dlc` | When a turn ends with background work still running (a teammate, a long build), pings the prompt cache every 50 minutes so it doesn't expire before the work reports back, for up to the keep-warm duration (`keepWarmFor`, default `8h`). Stops sooner when a new turn starts, on a cache miss, or once the pings have cost what a cache rewrite would. `/keepalive` pings now; `/keepalive 2h` sets the duration for this session (or for the machine, when `keepaliveScope` is `machine`), `/keepalive 1d --machine` for every session on this machine. Both settings are rows under `cache-keepalive` in `/config`. Adapted from [RichardJSun/claude-code-mods](https://github.com/RichardJSun/claude-code-mods); the duration and the command's arguments are local changes, listed in its `VENDORED.md`. |

Both need Claude Code 2.1.287 or later, and both make model requests that count against your plan or API usage. GitHub Copilot has no mods, so the Copilot plugin includes neither; there, the `handoff` skill's session handoff is written by hand.

Only the main session (the lead of an agent team) is handed off automatically. Subagents and teammates each have their own context window, and `/clear` cannot reset one; for in-process teammates, set `autoCompactWindow` in the subagent definition they are spawned from so they compact instead. `/ai-dlc:init` asks for the handoff percentage, which it writes to `.ai-dlc/auto-handoff.json`, and for the keep-warm settings, for which it tells you which `/config` rows to set.

The automatic handoff's settings live in the repository's `.ai-dlc/auto-handoff.json`, committed for the whole team, which `/ai-dlc:init` writes and `/ai-dlc:configure-auto-handoff` shows (with where each value comes from) and changes. Each key is read, highest first, from `env` of `.claude/settings.local.json` (one developer's override), `env` of `.claude/settings.json`, the process environment, `.ai-dlc/auto-handoff.json`, the row under `ai-dlc` in `/config` for the keys in the table below, then the default. In `env` and the environment, a key is its `AI_DLC_AUTO_HANDOFF_*` variable, listed in the file's schema (`.ai-dlc/auto-handoff.schema.json`). The settings reload at each session start. From `.ai-dlc/auto-handoff.json`, `viewer`, `briefTemplate` and `instructionsTemplate` apply only in a folder Claude Code trusts (`hasTrustDialogAccepted` in `~/.claude.json`, which Claude Code in VS Code and the SDK did not set in the versions tested, since they showed no trust dialog); elsewhere they are logged and skipped, so a cloned repository cannot serve your handoffs to the network or pick the files the module writes and reads. Set them for yourself in `env` of `.claude/settings.local.json` or in `/config`. The `/config` rows:

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

**Installed the separate `auto-handoff` plugin before?** The automatic handoff used to be its own plugin, installed as a dependency of `ai-dlc`. Claude Code keeps an auto-installed dependency until you prune it, so the old copy could run next to the new one. Remove it with `claude plugin uninstall auto-handoff@ai-dlc-agent-workflow` (or `claude plugin prune`, which removes auto-installed dependencies no installed plugin needs any more), and drop `"auto-handoff@ai-dlc-agent-workflow"` from `enabledPlugins` in your settings if it is there. Settings you made under `auto-handoff` in `/config` do not carry over: set them again under `ai-dlc`.


### GitHub Copilot CLI

```text
copilot plugin marketplace add rafsanulhasan/ai-dlc-agent-workflow-plugin
copilot plugin install ai-dlc@ai-dlc-agent-workflow
```

Or directly: `copilot plugin install rafsanulhasan/ai-dlc-agent-workflow-plugin:plugins/copilot/ai-dlc`.

### VS Code

VS Code's agent-plugin support reads the same Copilot/Claude plugin formats; add this repository as a plugin marketplace from VS Code's agent plugin settings.

## Use it in a project

1. **Bootstrap once:** `/ai-dlc:init` (Claude) or the `init` skill (Copilot). It scaffolds `AGENTS.md` — the orchestrator persona for your project, with all its routing rules and skills, plus your gates and artifact paths — `CLAUDE.md` (an `@AGENTS.md` import, your build / test / mutation commands and the Claude Code specifics), `.github/copilot-instructions.md` (the same commands and the Copilot specifics), recommended `.claude/settings.json` permissions and the `docs/` folders the lifecycles write to, plus the worktree and scratch roots (via `workspace-folders`; `/ai-dlc:workspace-folders` changes them later). It also installs `.ai-dlc/workflow.json`, the team's workflow — stages, who hands off to whom, gates and their approvers, the clarify matrix and routing — which the orchestrator follows instead of the plugin default, with `.ai-dlc/catalog.json` (the installed plugin's agents and skills, which `validate` checks every stage against) and a workflow gate hook that blocks finishing while the file is invalid; `/ai-dlc:workflow show` prints it with diagrams and `/ai-dlc:workflow edit <change>` customises it. In a .NET repository it also installs the C# coding-style, GlobalUsings and testing rules (`.claude/rules/*` with `.github/instructions/*` twins, via `dotnet-rules`), the `dotnet test` gate hook (via `dotnet-test-gate`) and `stryker-config.json`. In a JS / TS repository (a `package.json`) it installs the `node-coding-style`, `node-modules`, `node-async-errors` and `node-testing` rules (via `node-rules`) and the test gate hook (via `node-test-gate`). It shows a diff before touching any existing file, and merges into an existing `AGENTS.md`, `CLAUDE.md` or `.github/copilot-instructions.md` instead of replacing it: its content sits in `<!-- ai-dlc:begin … -->` blocks and your own lines stay as they are.
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

## The test gates

The plugin ships no hooks. `init` installs the gate for each stack it detects; a repository with both stacks gets both. In every repository it also installs the **workflow gate** (`.claude/hooks/check-workflow.mjs`, a `Stop` hook and `.github/hooks/ai-dlc-workflow-gate.json`), which blocks finishing — once per stop cycle, like the test gates — while `.ai-dlc/` has uncommitted changes that fail `node .ai-dlc/workflow.mjs validate`; `AI_DLC_WORKFLOW_GATE=false` pauses it.

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

CI (`.github/workflows/validate.yml`) fails if the Copilot tree is stale, a test in `tests/` fails, or either manifest stops validating. Never hand-edit `plugins/copilot/**`.

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

## License

AI-DLC Agent Workflow is released under the [MIT License](LICENSE), Copyright (c) 2026 Rafsanul Hasan. Both plugins ship a copy of it: the build copies the root `LICENSE` into `plugins/claude/ai-dlc/` and `plugins/copilot/ai-dlc/`.

The bundled mods in `plugins/claude-mods/` are MIT-licensed by their own authors and keep their own `LICENSE` files. Those mods, and the parts adapted from other projects (such as [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman), Apache-2.0), are attributed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
