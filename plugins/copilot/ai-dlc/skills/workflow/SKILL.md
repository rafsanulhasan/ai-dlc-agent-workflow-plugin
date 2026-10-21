---
name: workflow
description: "Customise the AI-DLC workflow of a repository: which stages each lifecycle runs, which agent owns each stage and hands off to whom, what runs in parallel, refinement loops, gates and who approves them, the clarify matrix, request routing, disabled and custom agents, artifact paths — all in .ai-dlc/workflow.json, which the orchestrator follows instead of the plugin default. Use to show the effective workflow as tables or a diagram, to edit it from a change in plain words (\"skip G3\", \"system-engineer reviews before code-reviewer\", \"add our security-auditor after build\"), to install or validate the file (with the generated plugin catalog it is checked against and the Stop-hook gate that blocks finishing while it is invalid), to upgrade it after a plugin update, or to reset it to the default."
---

# Workflow

A repository's AI-DLC workflow lives in `.ai-dlc/workflow.json`. The orchestrator reads it on every request; when it is absent, the plugin default applies: [templates/workflow.json](templates/workflow.json), the machine-readable form of the `ai-dlc` skill's catalogue. The project file is a complete definition, so a developer sees and edits everything in one place.

| File in `.ai-dlc/` | What it is |
|---|---|
| `workflow.json` | The team's workflow. Committed. `"$schema": "./workflow.schema.json"` gives completion, hover docs and validation in VS Code |
| `workflow.schema.json` | The schema; every key's meaning is in its `description` ([templates/workflow.schema.json](templates/workflow.schema.json)) |
| `workflow.mjs` | Zero-dependency CLI: `validate`, `show [<lifecycle>] [--mermaid]`, `diff --against <path>`, `catalog --plugin <dir>`; `--help` lists the options ([templates/workflow.mjs](templates/workflow.mjs)) |
| `catalog.json` | Generated, never edited: the installed plugin's version, agent IDs and skill names, written by `workflow.mjs catalog` at **install** and **upgrade**. `validate` checks every agent and stage skill against it plus the project's own agents (`.claude/agents`, `.github/agents`) and skills (`.claude/skills`, `.github/skills`); without it, `validate` fails. Committed, so the gate and CI validate without the plugin |

The **workflow gate** guards the file: `.claude/hooks/check-workflow.mjs` ([templates/check-workflow.mjs](templates/check-workflow.mjs)), run by a Claude `Stop` hook in `.claude/settings.json` and its Copilot twin `.github/hooks/ai-dlc-workflow-gate.json`. When `.ai-dlc/` has uncommitted changes, it runs `node .ai-dlc/workflow.mjs validate` and blocks finishing while that fails. It blocks **once per stop cycle**, like the test gates: if the agent stops again right after a block, the hook lets it through, so the gate catches mistakes but does not make an invalid file impossible — `validate` in CI or review does. It is a project hook installed with the files; the plugin ships no hooks. `AI_DLC_WORKFLOW_GATE=false` pauses it.

**Boris Cherny** (`agent-manager`) owns changes to the workflow file, like every agent artifact, and each change is reviewed before it is done (the `AAW` lifecycle, [references/aaw-review.md](references/aaw-review.md)): docs by **Linus Torvalds** (`brutal-critique`), code by **Kent Beck** (`sqa-engineer`) then **Robert C. Martin** (`code-reviewer`); developers may also run `/workflow …` themselves. **Scott Hanselman** (`orchestrator`) only reads it.

> Agent names are the defaults; a name chosen at `/init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## How the orchestrator applies it

- **Effective workflow** = `.ai-dlc/workflow.json` if present, else the plugin default. A present but invalid file stops the run: the orchestrator shows the `validate` output and never falls back silently.
- **Lifecycle codes** are the keys of `lifecycles`, the one list every skill refers to; a run's handoff folder starts with its code (`artifacts.handoffs`).
- A one-off instruction in a request ("skip G3 this time") overrides the file for that run only.
- Stage order comes from `after`; stages that share an `after` run in parallel; a stage whose `when` does not hold is skipped and counts as finished.
- A gate's `approver`: `human` stops for the human; `orchestrator` approves on the human's behalf and records it; `none` skips the stop, but the handoff record is still written and verified.

## Fixed guardrails

The file cannot change these; `validate` rejects the attempts it can detect.

- Boris Cherny (`agent-manager`) alone changes agents, skills, hooks, rules, commands, agent memory and this workflow file, and `agent-artifact work` always routes to it. `orchestrator` and `agent-manager` cannot be disabled.
- Every agent-artifact change is reviewed, in a bounded, shared loop. The lifecycle that `routing.byType["Agent Artifact"]` names (default `AAW`) starts with `agent-manager` and has `brutal-critique` (docs), `sqa-engineer` and then `code-reviewer` (code) stages that loop back to it, with one shared round budget (equal `loop.maxRounds`; default 3, the file may change it). `brutal-critique`, `sqa-engineer` and `code-reviewer` cannot be disabled, and `documents.critic: null` does not remove these reviews. Change kinds, rounds, findings, and exactly what `validate` enforces and what it cannot: [references/aaw-review.md](references/aaw-review.md). A missing `routing.byType["Agent Artifact"]` or lifecycle, or an `AAW` from before these rules, fails `validate`: run **upgrade**.
- A change to `agent-manager`'s own definition, or to a skill it owns (`agent-management`, `skill-management`, `hook-management`, `rules-management`, `command-management`, `harness-sync`, `workflow`, `plugin-management`), is made by a freshly spawned `agent-manager`, never by the running instance.
- Trust, but verify: every hand-off, `AAW` included, gets a handoff record that its receiver verifies (never its writer), whatever the gate approver, and every agent's hand-back is stored verbatim beside it, in the run's folder (`artifacts.handoffs`: `{LIFECYCLE}-{YYYYMMDD}-{feature-slug}/`, files `{step}[.{sub}][.l{loop}]-{from-agent}-to-{to-agent}.handoff.md` and `.handback.md`; `handoff` skill). `AAW` has no gates: its run state records the rounds and verdicts.
- The test gate hooks and the workflow gate installed by `init` stay in force.
- The orchestrator only delegates, and a stage owner never does another agent's job.

## Phase 0 — Context load (silent)

1. Read the root `CLAUDE.md` and `AGENTS.md`.
2. Invoke `Skill("manage-memory", args: "agent-manager")`.
3. Check for `.ai-dlc/workflow.json`, `.ai-dlc/workflow.schema.json`, `.ai-dlc/workflow.mjs`, `.ai-dlc/catalog.json`, the workflow gate (`.claude/hooks/check-workflow.mjs`, its `Stop` entry in `.claude/settings.json`, `.github/hooks/ai-dlc-workflow-gate.json`) and `node` on PATH. Done when you know which files exist, whether the schema, CLI and gate script match `templates/`, and whether the catalog's `plugin.version` matches the installed plugin (`../../.claude-plugin/plugin.json`, or `plugin.json` on Copilot). With no `.ai-dlc/`, run **install** first (any mode except `show` of the default); with a missing or outdated catalog, run **upgrade**.

## Mode: show

**Args:** `show [<lifecycle>]`

1. Run `node .ai-dlc/workflow.mjs show [<lifecycle>]` and `node .ai-dlc/workflow.mjs show [<lifecycle>] --mermaid`. With no project file, run `node templates/workflow.mjs show [<lifecycle>] [--mermaid] --file templates/workflow.json --plugin ../..` and say the plugin default is in effect.
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
2. Generate the catalog from the installed plugin: `node .ai-dlc/workflow.mjs catalog --plugin ../..`. It writes `.ai-dlc/catalog.json`: the plugin version, every agent ID from `agents/*.md` and every skill name from `skills/*/SKILL.md`. Never write or edit it by hand.
3. Install the workflow gate, the way the stack test gates install theirs (`hook-management` conventions):
   - copy `templates/check-workflow.mjs` to `.claude/hooks/check-workflow.mjs`;
   - **Claude Code:** merge `templates/claude-hook.json` into `.claude/settings.json`: append the `Stop` entry to any existing `hooks.Stop` array, never drop existing hooks, and do not add it twice (match on `check-workflow.mjs` in the command);
   - **GitHub Copilot:** write `templates/copilot-hook.json` to `.github/hooks/ai-dlc-workflow-gate.json`.

   An existing different file is diffed first and written only with consent.
4. Run `node .ai-dlc/workflow.mjs validate`. Done when it exits 0.

## Mode: validate

**Args:** `validate`

1. Run `node .ai-dlc/workflow.mjs validate`.
2. Report every `error:` with the edit that fixes it, and every `warning:` with its risk. An agent or stage skill that is neither in the catalog nor a project agent or skill is an error, with a "did you mean" when a known name is close. A missing catalog is an error: run **upgrade** (or **install**) to generate it. Done when exit 0, or every error has a proposed fix.

## Mode: upgrade

**Args:** `upgrade`. Run after a plugin update.

1. Run `node .ai-dlc/workflow.mjs diff --against templates/workflow.json`. `only in other` lines are upstream additions; `changed` and `only in project` lines are the project's customisations or upstream changes.
2. Propose bringing in each upstream addition and change while keeping the project's customisations; list each line with its proposed outcome. Ask when a line is both customised and changed upstream.
3. With the developer's consent, write the merged file, refresh `workflow.schema.json`, `workflow.mjs` and the workflow gate (**install** step 3) from the templates, regenerate the catalog (**install** step 2), and run `validate`. Done when it exits 0.

## Mode: reset

**Args:** `reset [<lifecycle>]`

1. Whole file: replace `.ai-dlc/workflow.json` with the template. One lifecycle: replace only `lifecycles.<code>` with the template's, and restore any gate it uses that the project removed.
2. Show the diff, write only with consent, then run `validate`. Done when it exits 0.

## Report

List each file written, the `validate` result, the catalog line (`<plugin> <version> · N agents · N skills`), the diagram of every changed lifecycle, and the commands developers run themselves: `node .ai-dlc/workflow.mjs show|validate`. End with the changed paths, each marked `code` or `docs`, and the intent of the change, one line each, so the right reviewers can be spawned (`AAW`).
