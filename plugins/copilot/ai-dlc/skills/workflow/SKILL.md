---
name: workflow
description: "Customise the AI-DLC workflow of a repository: which stages each lifecycle runs, which agent owns each stage and hands off to whom, what runs in parallel, refinement loops, gates and who approves them, the clarify matrix, request routing, disabled and custom agents, artifact paths — all in .ai-dlc/workflow.json, which the orchestrator follows instead of the plugin default. Use to show the effective workflow as tables or a diagram, to edit it from a change in plain words (\"skip G3\", \"system-engineer reviews before code-reviewer\", \"add our security-auditor after build\"), to install or validate the file, to upgrade it after a plugin update, or to reset it to the default."
---

# Workflow

A repository's AI-DLC workflow lives in `.ai-dlc/workflow.json`. The orchestrator reads it on every request; when it is absent, the plugin default applies: [templates/workflow.json](templates/workflow.json), the machine-readable form of the `ai-dlc` skill's catalogue. The project file is a complete definition, so a developer sees and edits everything in one place.

| File in `.ai-dlc/` | What it is |
|---|---|
| `workflow.json` | The team's workflow. Committed. `"$schema": "./workflow.schema.json"` gives completion, hover docs and validation in VS Code |
| `workflow.schema.json` | The schema; every key's meaning is in its `description` ([templates/workflow.schema.json](templates/workflow.schema.json)) |
| `workflow.mjs` | Zero-dependency CLI: `validate`, `show [<lifecycle>] [--mermaid]`, `diff --against <path>`; `--help` lists the options ([templates/workflow.mjs](templates/workflow.mjs)) |

**Boris Cherny** (`agent-manager`) owns changes to the workflow file, like every agent artifact; developers may also run `/workflow …` themselves. **Scott Hanselman** (`orchestrator`) only reads it.

> Agent names are the defaults; a name chosen at `/init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## How the orchestrator applies it

- **Effective workflow** = `.ai-dlc/workflow.json` if present, else the plugin default. A present but invalid file stops the run: the orchestrator shows the `validate` output and never falls back silently.
- A one-off instruction in a request ("skip G3 this time") overrides the file for that run only.
- Stage order comes from `after`; stages that share an `after` run in parallel; a stage whose `when` does not hold is skipped and counts as finished.
- A gate's `approver`: `human` stops for the human; `orchestrator` approves on the human's behalf and records it; `none` skips the stop, but the handoff record is still written and verified.

## Fixed guardrails

The file cannot change these; `validate` rejects the attempts it can detect.

- Boris Cherny (`agent-manager`) alone changes agents, skills, hooks, rules, commands, agent memory and this workflow file. `orchestrator` and `agent-manager` cannot be disabled; `agent-artifact work` always routes to `agent-manager`.
- Trust, but verify: every stage boundary gets a verified handoff record, whatever the gate approver.
- The test gate hook installed by `init` stays in force.
- The orchestrator only delegates, and a stage owner never does another agent's job.

## Phase 0 — Context load (silent)

1. Read the root `CLAUDE.md` and `AGENTS.md`.
2. Invoke `Skill("manage-memory", args: "agent-manager")`.
3. Check for `.ai-dlc/workflow.json`, `.ai-dlc/workflow.schema.json`, `.ai-dlc/workflow.mjs` and `node` on PATH. Done when you know which files exist and whether the schema and CLI match `templates/`. With no `.ai-dlc/`, run **install** first (any mode except `show` of the default).

## Mode: show

**Args:** `show [<lifecycle>]`

1. Run `node .ai-dlc/workflow.mjs show [<lifecycle>]` and `node .ai-dlc/workflow.mjs show [<lifecycle>] --mermaid`. With no project file, pass `--file templates/workflow.json` and say the plugin default is in effect.
2. Present the stage tables, the gates and the diagrams (one per lifecycle; solid arrows are hand-offs, dashed arrows are loops, hexagons are gates). Done when every requested lifecycle is shown, or the `validate` errors are, if the file is invalid.

## Mode: edit

**Args:** `edit <change in plain words>`

1. Translate the change into JSON edits with [references/edit-recipes.md](references/edit-recipes.md). A change that would break a fixed guardrail is refused with the reason. An ambiguous change ("review earlier") becomes one question with a recommended reading.
2. Apply the edits to a copy in the scratch folder and run `node .ai-dlc/workflow.mjs validate --file <copy>`. Fix every error the edit caused. Done when it exits 0.
3. Show the developer the `diff --file <copy> --against .ai-dlc/workflow.json` output, the warnings, and `show <lifecycle> --mermaid` of every changed lifecycle.
4. Write the copy over `.ai-dlc/workflow.json` only with the developer's consent, then run `validate` on it. Done when it exits 0.

## Mode: install

**Args:** `install`. `/init` installs the files; this mode installs or refreshes them later.

1. Copy `templates/workflow.json`, `workflow.schema.json` and `workflow.mjs` into `.ai-dlc/`. An existing different file is diffed first (`diff --against` for `workflow.json`) and written only with the developer's consent; an existing `workflow.json` is never replaced without it.
2. Run `node .ai-dlc/workflow.mjs validate`. Done when it exits 0.

## Mode: validate

**Args:** `validate`

1. Run `node .ai-dlc/workflow.mjs validate`.
2. Report every `error:` with the edit that fixes it, and every `warning:` with its risk. Done when exit 0, or every error has a proposed fix.

## Mode: upgrade

**Args:** `upgrade`. Run after a plugin update.

1. Run `node .ai-dlc/workflow.mjs diff --against templates/workflow.json`. `only in other` lines are upstream additions; `changed` and `only in project` lines are the project's customisations or upstream changes.
2. Propose bringing in each upstream addition and change while keeping the project's customisations; list each line with its proposed outcome. Ask when a line is both customised and changed upstream.
3. With the developer's consent, write the merged file, refresh `workflow.schema.json` and `workflow.mjs` from the templates, and run `validate`. Done when it exits 0.

## Mode: reset

**Args:** `reset [<lifecycle>]`

1. Whole file: replace `.ai-dlc/workflow.json` with the template. One lifecycle: replace only `lifecycles.<code>` with the template's, and restore any gate it uses that the project removed.
2. Show the diff, write only with consent, then run `validate`. Done when it exits 0.

## Report

List each file written, the `validate` result, the diagram of every changed lifecycle, and the commands developers run themselves: `node .ai-dlc/workflow.mjs show|validate`.
