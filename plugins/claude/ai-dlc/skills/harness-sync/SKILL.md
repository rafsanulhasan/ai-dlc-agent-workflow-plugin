---
name: harness-sync
description: "Runs the two-way Claude Code ↔ GitHub Copilot harness sync, `node .claude/scripts/sync-harness.mjs`, so every agent, skill, command ↔ prompt, rule ↔ instruction and hook made or edited on one platform exists on the other. `--check` only reports; `--prefer`, `--only` and `--name` pass through to the script. When both twins of one artifact were edited, the file saved last wins, or the side `--prefer claude|copilot` names. User-invoked only; /ai-dlc:init installs the script."
argument-hint: "[--check] [--prefer claude|copilot|newer] [--only <kinds>] [--name <n>]"
disable-model-invocation: true
---

# Harness sync

`/ai-dlc:harness-sync [args]` is the command that syncs a repository's agent harness between Claude Code and GitHub Copilot. It runs `node .claude/scripts/sync-harness.mjs [args]` and shows the output. The sync is two-way, in one run: whatever a developer made or edited by hand on one platform is written to the other, Claude → Copilot and Copilot → Claude. Consumer repositories have no sync hook; the developer runs this command.

> **Scope.** Project scope only: the `.claude/` and `.github/` twins of a consumer repository. In the plugin repository, `node tools/build-copilot.mjs` projects the plugin instead — see **Boris Cherny** (`agent-manager`)'s *Two Scopes of Ownership*.

## Run it

1. If `.claude/scripts/sync-harness.mjs` does not exist, say that the sync script is not installed and that `/ai-dlc:init` installs it (a re-run of init refreshes it: when the installed copy differs from the template, init shows the diff and replaces it only with the developer's consent). Stop.
2. From the repository root, run `node .claude/scripts/sync-harness.mjs` with exactly the arguments typed after the command, nothing added or removed. With no arguments it syncs.
3. Show the output as it is, then one line on the exit code: 0 — done, or everything was already in sync; 1 — `--check` found changes pending (run without `--check` to apply them); 2 — an error, such as an unknown option. Do not edit files, resolve `note:` lines or run anything else unless the user asks.

| Argument | Effect |
|---|---|
| *(none)* | Sync both ways |
| `--check` | Report only: `would …` lines, exit 1 when anything is pending; nothing is written |
| `--prefer claude\|copilot\|newer` | Which side wins when both twins exist and differ (default `newer`) |
| `--only <kinds>` | Limit to `agents`, `skills`, `commands`, `rules`, `hooks` (comma-separated) |
| `--name <n>` | Limit to one artifact by name (hooks are skipped) |
| `--help` | The script's own usage |

## What it syncs

| Kind | Claude Code | GitHub Copilot |
|---|---|---|
| agents | `.claude/agents/<n>.md` | `.github/agents/<n>.agent.md` |
| skills | `.claude/skills/<n>/**` | `.github/skills/<n>/**` |
| commands ↔ prompts | `.claude/commands/<n>.md` | `.github/prompts/<n>.prompt.md` |
| rules ↔ instructions | `.claude/rules/**/<n>.md` | `.github/instructions/**/<n>.instructions.md` |
| hooks | `hooks` in `.claude/settings.json` | `.github/hooks/*.json` |

What the script does, so the output can be explained:

- **Missing twin** → created from the side that exists, whichever platform that is.
- **Both twins edited (they exist and differ)** → one side is copied over the other; the other side's edits to the synced fields are lost. `--prefer` picks the side: `newer` (default) takes the file saved last, on either platform; `claude` or `copilot` forces that side. Before syncing a pair you edited on both sides, run with `--check` and then pass the `--prefer` you want, or merge the two by hand first.
- **Shared fields only.** Agents: `name`, `description`, `tools` (translated with the same alias table as the plugin build), `status`, body. Commands: `description`, `argument-hint`, body (`$ARGUMENTS` ↔ `${input:arguments}`). Rules: `description`, scope (`paths` ↔ `applyTo`; no `paths` ↔ `applyTo: "**"`), body. Skills are copied file by file. Platform-only keys on the target (`model`, `color`, `user-invocable`, `excludeAgent`, …) are kept.
- **Hooks are additive and matched by command.** Claude hooks missing from Copilot go to `.github/hooks/synced-from-claude.json`; Copilot hooks missing from Claude are appended to `.claude/settings.json`. A hook whose command was changed is a new hook: the old one stays on the other side until it is removed there. `synced-from-claude.json` is the script's own output and is not read back into Claude.
- **Nothing is deleted.** Removing an artifact, and each `note:` line, stay with the developer or **Boris Cherny** (`agent-manager`).

## For agents

This command is user-invoked only, so an agent never calls it. **Boris Cherny** (`agent-manager`), and the management skills it runs, read this file and run the script directly:

- **Install or refresh.** `/ai-dlc:init` copies [templates/sync-harness.mjs](templates/sync-harness.mjs) to `.claude/scripts/sync-harness.mjs`. To refresh it later, copy the same template; if a different copy exists, show the diff and write only with the developer's consent. Offer, and add only on consent, a CI step `node .claude/scripts/sync-harness.mjs --check` (hand it to **Gene Kim** (`devops-engineer`) through the orchestrator), so a pull request that changes only one platform fails.
- **Sync after a change.** When you sync one item and both of its twins were edited, run `node .claude/scripts/sync-harness.mjs --check --only <kind> --name <name>` first, ask the human which side wins, then sync with `--prefer claude` or `--prefer copilot`; never let `newer` decide. `--check` shows any pair that exists on both sides and differs as `drifted`, whichever side changed. When only the side you changed was edited, or the human named a side, sync with `--prefer` naming that side. Hooks have no such pair: they are matched by command, and `--name` skips them.
- **Resolve every `note:` line** through the owning skill, or report it as left for the developer:
  - a tool with no counterpart on the other platform → `agent-management` `update-agent`;
  - a hook with no counterpart event, a non-command hook, or a hook that uses `CLAUDE_*` variables → `hook-management` (`migrate` with an intentional difference, documented);
  - `${CLAUDE_SKILL_DIR}` in a skill → `skill-management` `update-skill`, using paths relative to `SKILL.md`;
  - a positional `$1…` argument in a command → `command-management` `modify`.
- **Done** when `--check` exits 0 with the same `--only` / `--name`, or every remaining line is in the report with the reason it stays. The report lists each file created or updated with its source, and each `note:` and how it was resolved.
