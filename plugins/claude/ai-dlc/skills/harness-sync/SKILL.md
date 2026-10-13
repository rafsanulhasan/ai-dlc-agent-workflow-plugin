---
name: harness-sync
description: "Sync a repository's agent harness between Claude Code and GitHub Copilot: agents, skills, commands / prompts, rules / instructions and hooks that a developer created or edited on one platform only. Use to sync after hand-made changes, to check for drift (missing twin, edited on one side), or to install the sync-harness.mjs script so developers can run the sync themselves. Invoked by agent-manager."
---

# Harness sync

Developers add agents, skills, commands, rules and hooks by hand, on whichever platform they use. This skill makes each one exist on both platforms. The sync is two-way: Claude → Copilot and Copilot → Claude, in one run. A dependency-free script does the work, so a developer can run the same sync without an agent: [templates/sync-harness.mjs](templates/sync-harness.mjs), installed as `.claude/scripts/sync-harness.mjs`.

> **Scope.** Project scope only: the `.claude/` and `.github/` twins of a consumer repository. In the plugin repository, `node tools/build-copilot.mjs` projects the plugin instead — see **Boris Cherny** (`agent-manager`)'s *Two Scopes of Ownership*.

| Kind | Claude Code | GitHub Copilot |
|---|---|---|
| agents | `.claude/agents/<n>.md` | `.github/agents/<n>.agent.md` |
| skills | `.claude/skills/<n>/**` | `.github/skills/<n>/**` |
| commands | `.claude/commands/<n>.md` | `.github/prompts/<n>.prompt.md` |
| rules | `.claude/rules/**/<n>.md` | `.github/instructions/**/<n>.instructions.md` |
| hooks | `hooks` in `.claude/settings.json` | `.github/hooks/*.json` |

What the script does, so you can explain its report:

- **Missing twin** → created from the side that exists, whichever platform that is.
- **Both exist and differ** → the edited side is copied over the other. `--prefer` picks it: `newer` (default, the file modified last, on either platform), or `claude` / `copilot` to force one side when both were edited.
- **Shared fields only.** Agents: `name`, `description`, `tools` (translated with the same alias table as the plugin build), `status`, body. Commands: `description`, `argument-hint`, body (`$ARGUMENTS` ↔ `${input:arguments}`). Rules: `description`, scope (`paths` ↔ `applyTo`; no `paths` ↔ `applyTo: "**"`), body. Skills are copied file by file. Platform-only keys on the target (`model`, `color`, `user-invocable`, `excludeAgent`, …) are kept.
- **Hooks are additive and matched by command.** Claude hooks missing from Copilot go to `.github/hooks/synced-from-claude.json`; Copilot hooks missing from Claude are appended to `.claude/settings.json`.
- **Nothing is deleted.** Each `note:` line is something the script left for you.

## Phase 0 — Context load (silent)

1. Read the root `CLAUDE.md` and `AGENTS.md`.
2. Invoke `Skill("ai-dlc:manage-memory", args: "agent-manager")`.
3. Check for `.claude/scripts/sync-harness.mjs` and `node` on PATH. Done when you know whether the script is installed, and whether it matches `${CLAUDE_SKILL_DIR}/templates/sync-harness.mjs`.

## Mode: install

**Args:** `install`. `/ai-dlc:init` installs the script; this mode installs or refreshes it later, when a developer types `/ai-dlc:harness-sync install` partway through a project. Also run it first in `sync` or `check` mode when the script is missing or out of date.

1. Copy `${CLAUDE_SKILL_DIR}/templates/sync-harness.mjs` to `.claude/scripts/sync-harness.mjs`. If a different copy exists, show the diff and write only with the developer's consent.
2. Offer, and add only on consent:
   - a `"sync:harness": "node .claude/scripts/sync-harness.mjs"` script in a root `package.json`;
   - a CI step `node .claude/scripts/sync-harness.mjs --check` (hand it to **Gene Kim** (`devops-engineer`) through the orchestrator), so a pull request that changes only one platform fails.
3. Done when the script runs with `--help` from the repository root.

## Mode: check

**Args:** `check [--only <kinds>] [--name <n>]`

1. Run `node .claude/scripts/sync-harness.mjs --check`, passing any options you received.
2. Report every `would …` line and every `note:` line. Exit code 1 means drift. Done when every out-of-sync artifact is listed with its proposed direction.

## Mode: sync

**Args:** `sync [--prefer claude|copilot|newer] [--only <kinds>] [--name <n>]`

1. Run `check` first. When an artifact exists on both sides and both were edited since they last matched, ask the developer which side wins. Do not let `newer` pick on its own in that case.
2. Run the script without `--check`, passing the chosen `--prefer` and filters.
3. Resolve every `note:` line through the owning skill, or report it as left for the developer:
   - a tool with no counterpart on the other platform → `agent-management` `update-agent`;
   - a hook with no counterpart event, a non-command hook, or a hook that uses `CLAUDE_*` variables → `hook-management` (`migrate` with an intentional difference, documented);
   - `${CLAUDE_SKILL_DIR}` in a skill → `skill-management` `update-skill`, using paths relative to `SKILL.md`;
   - a positional `$1…` argument in a command → `command-management` `modify`.
4. Re-run with `--check`. Done when it exits 0, or when every remaining line is in your report with the reason it stays.

## Report

List each file created or updated with its source, each `note:` and how it was resolved, and the command developers run themselves: `node .claude/scripts/sync-harness.mjs` (add `--check` to only report).
