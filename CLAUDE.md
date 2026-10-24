# Project: AI-DLC Agent Workflow

<!-- ai-dlc:begin pointer -->
@AGENTS.md

> Agent orchestration, routing, gates and memory rules live in [AGENTS.md](AGENTS.md), imported above. Claude Code reads `AGENTS.md` on its own only when there is no `CLAUDE.md`, so the import is what loads it here.
<!-- ai-dlc:end pointer -->

A Claude Code and GitHub Copilot plugin that ships the AI-DLC agentic engineering team. The lifecycle, agents and gates are language-agnostic; .NET and JS / TS (Node.js, TypeScript, JavaScript) are the supported stacks, with more languages to follow.

## Agents and skills in this repo

This repo has no local copies of agents, skills or commands; it runs the plugin it builds. Register the repo as a local marketplace once per machine (writes the machine path to the gitignored `.claude/settings.local.json`):

```text
claude plugin marketplace add ./ --scope local
claude plugin install ai-dlc@ai-dlc-agent-workflow --scope local
```

Agents are then `ai-dlc:<name>` and skills `/ai-dlc:<name>`, read straight from `plugins/claude/ai-dlc/`; edits apply on the next session or after `/reload-plugins`. Changes to agents, skills, hooks or rules go through `ai-dlc:agent-manager`.

<!-- ai-dlc:skip commands -->
## Commands

`AGENTS.md` and the agents call these "the project's build, test or mutation command": the build is the first two lines below, the test command is `node --test "tests/**/*.test.mjs"`, and no mutation testing is set up for this stack.

- `node tools/build-copilot.mjs` : regenerate `plugins/copilot/ai-dlc` from `plugins/claude/ai-dlc`
- `node tools/build-copilot.mjs --check` : fail if the Copilot plugin is stale
- `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/ai-dlc` : validate the Claude plugin
- `npx @anthropic-ai/claude-code plugin validate --strict .` : validate the marketplace
- `node tools/validate.mjs` : the local pre-validate run: syncs the `.claude/` ↔ `.github/` harness twins (`node .claude/scripts/sync-harness.mjs`), then runs both `plugin validate --strict` commands above and the one for each plugin in `tools/claude-only-plugins.json` (`ai-dlc-lens`), and exits 1 when any step fails; `--check` only checks the sync, as CI does
- `node --test "tests/**/*.test.mjs"` : run the repository tests (`tests/workflow/`: the `workflow.mjs` CLI; `tests/build-copilot-*.test.mjs`: the Copilot build; `tests/auto-handoff/`: the configure-auto-handoff and cache-keepalive CLIs and their agreement with the hooks module; `tests/model-metadata/`: the model metadata hook script); run it after changing a script that has tests in `tests/`. Quote the glob. Don't run `node --test` bare (it can also pick up the TypeScript tests of the hooks module, which need `claude plugin test`) or `node --test tests/` (fails on Node 24)
- `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc` : run the tests of the plugin's hooks module (`hooks/auto-handoff/`: the automatic session handoff; `hooks/keepalive/`: keep-alive, which auto-handoff registers); run it after changing either folder or its tests
- `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/ai-dlc-lens` and `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc-lens` : validate the ai-dlc-lens plugin and run its hooks module's tests; run both after changing it (`node tools/validate.mjs` runs the validation, CI runs both)

## Architecture

- `plugins/claude/ai-dlc/` — source of truth (agents, skills, and `hooks/auto-handoff/`: a Claude-only hooks module, the automatic path of the `handoff` skill's session handoff, adapted from alexknowshtml/claude-auto-handoff, and `hooks/keepalive/`, which keeps the prompt cache warm while background tasks run and answers `/ai-dlc:cache-keepalive` (the `cache-keepalive` skill gives the name), adapted from the `cache-keepalive` mod of RichardJSun/claude-code-mods; auto-handoff's `register.tsx` imports and registers keep-alive, so `hooks/hooks.json` lists the one module under `modules` only, and the settings of both are `AI_DLC_AUTO_HANDOFF_*` and `AI_DLC_KEEPALIVE_*` variables in a settings file's `env` and keys in `.ai-dlc/auto-handoff.json` and `.ai-dlc/cache-keepalive.json`, changed with `/ai-dlc:configure-auto-handoff` and `/ai-dlc:cache-keepalive-configure`; neither has `/config` rows)
- `plugins/claude/ai-dlc-lens/` — the ai-dlc-lens plugin, Claude Code only (one hooks module, started from spike 027, still behind its run's gates G1 to G3); listed in the Claude marketplace only, never projected to Copilot
- `plugins/copilot/ai-dlc/` — generated; never hand-edit
- `tools/build-copilot.mjs` — Claude → Copilot projection
- `tools/overlays/non-claude/skills/` — skills only non-Claude plugins ship (currently `scratchpad`); the build adds them to the Copilot plugin, never to the Claude one
- `tools/claude-only-skills.json` — plugin skills that work only in Claude Code (currently `cache-keepalive`, `cache-keepalive-configure`, `cache-keepalive-install` and `cache-keepalive-merge`, and the six `lens*` skills that name the ai-dlc-lens commands: `lens`, `lens-init`, `lens-configure`, `lens-kit`, `lens-keepalive`, `lens-gate`); the build leaves them out of the Copilot plugin
- `tools/claude-only-plugins.json` — plugins that work only in Claude Code (currently `ai-dlc-lens`); the build ignores their folders under `plugins/claude/`, refuses them as `--plugin` and fails when one has a `plugins/copilot/` folder
- `.claude-plugin/marketplace.json`, `.github/plugin/marketplace.json` — marketplaces
- Stack-specific rules and hooks (`dotnet-rules` and `dotnet-test-gate` for .NET, `node-rules` and `node-test-gate` for JS / TS) are installed into target repositories by skills that `/ai-dlc:init` runs; the plugin itself ships no settings hooks or rules (its hooks module is a Claude Code mod, never projected to Copilot). The model metadata hook, which every repository gets whatever its stack, is installed the same way, by the `model-metadata` skill (see "Watch out for"), and so is the stack-agnostic documentation rule, `docs-status` (only `documentation-writer` writes documentation; status markers *planned*, *in progress*, none once done), by the `docs-rules` skill; this repository has it in `.claude/rules/docs-status.md` with its `.github/instructions/` twin.
- `.claude/rules/plugin-development.md` — the workflow rule for this repository.
- `.claude/skills/` — generated mirrors of the plugin skills listed in `tools/project-skills.json` (currently `presentation-authoring`); edit the plugin copy, then rebuild.

## Watch out for

- After changing anything under `plugins/claude/ai-dlc/`, run `node tools/build-copilot.mjs`. A Stop hook (`.claude/hooks/check-copilot-stale.mjs`, run by `.claude/hooks/stop-sync-then-check.mjs`) blocks finishing while the Copilot plugin is stale.
- CI (`.github/workflows/validate.yml`) runs the staleness check, the repository tests, the harness sync check (`node .claude/scripts/sync-harness.mjs --check`, before the validations), both `plugin validate --strict` commands, `plugin test` for `ai-dlc`'s hooks module, and `plugin validate --strict` and `plugin test` for `ai-dlc-lens`.
- The harness sync is automatic locally: one Stop command, `.claude/hooks/stop-sync-then-check.mjs`, runs the harness sync (`sync-harness-on-stop.mjs`) and then the staleness check (`check-copilot-stale.mjs`), in that order, because Claude Code runs the hooks of one event in parallel and the check reads project mirrors (`.claude/skills/<name>/`) the sync can rewrite. The sync says what it wrote and never blocks. The workflow gate (`check-workflow.mjs`) stays a separate Stop hook; it reads only `.ai-dlc/`, which the sync never writes.
- Model metadata: `.ai-dlc/model-metadata.json` (every Anthropic model's prices and limits, from Anthropic's docs pages) is refreshed by `.claude/hooks/update-model-metadata.mjs`, a Stop entry of its own (in parallel with the other Stop hooks) and a `PreToolUse` `Bash` entry that runs only before `git commit`. It never blocks, keeps the old file on failure and refetches at most hourly. It is installed from the plugin's `model-metadata` skill, which `/ai-dlc:init` runs; never edit the JSON by hand. Tests: `tests/model-metadata/`.
- The hooks module and its tests stay under `plugins/claude/ai-dlc/hooks/`, never in `skills/`, `agents/` or `scripts/`, which the build copies to Copilot (it fails when one is there). Each of its two folders keeps its upstream `LICENSE` (`hooks/auto-handoff/LICENSE`, `hooks/keepalive/LICENSE`); record every change to a folder in that folder's `ATTRIBUTION.md`, and a new upstream in `THIRD_PARTY_NOTICES.md`.

<!-- ai-dlc:begin workspace-folders -->
## Workspace folders (Claude Code only)

- Write scratch files to `.scratch/<session-or-task>/` instead of Claude Code's built-in per-session scratchpad directory or the system temp directory.
- `claude --worktree`, `EnterWorktree` and agents with `isolation: "worktree"` get their worktree under `.worktrees/` through the `WorktreeCreate` hook in `.claude/settings.json`. Claude Code keeps the worktrees it creates for subagents; remove each with `git worktree remove` once its branch is merged.
<!-- ai-dlc:end workspace-folders -->
