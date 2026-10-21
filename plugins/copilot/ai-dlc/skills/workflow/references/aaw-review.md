# AAW review: change kinds, rounds and findings

The single source for how the `AAW` lifecycle (agent-artifact work) reviews a change set. Every other file points here; agents reach it as `references/aaw-review.md` in the base directory of the `workflow` skill, after loading that skill. **Boris Cherny** (`agent-manager`) marks each changed path; **Scott Hanselman** (`orchestrator`), or the main agent when there is none, classifies the set with the rule below and spawns the reviewers: docs to **Linus Torvalds** (`brutal-critique`), code to **Kent Beck** (`sqa-engineer`) and then **Robert C. Martin** (`code-reviewer`).

> Agent names are the defaults; a name chosen at `/init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## Change kinds

Apply per file; the first rule that matches decides.

| # | The file is… | Kind | Goes to |
|---|---|---|---|
| 1 | Written by a build or sync whose `--check` passes on it: in the plugin repository, `plugins/copilot/**` (`node tools/build-copilot.mjs --check`), the `.claude/skills/<name>/` mirrors of the skills listed in `tools/project-skills.json`, and `skills/init/templates/AGENTS.md`, `CLAUDE.md` and `copilot-instructions.md` rendered by that build; in a consumer repository, the twin files `node .claude/scripts/sync-harness.mjs` wrote, when its `--check` passes, and `.ai-dlc/catalog.json` when the catalog check below passes | generated | No reviewer. The `--check` verifies it; its source is classified instead |
| 2 | A script (`.mjs`, `.js`, `.cjs`, `.ts`, `.ps1`, `.sh`, `.py`, `.cs`, …) or any file with a shebang: hook scripts, build tools, CLIs | code | `sqa-engineer` → `code-reviewer` |
| 3 | A file with any key whose value is a command or registers one: hook registrations (`hooks` in `hooks.json`, `settings.json` or `.github/hooks/*.json`), `statusLine.command`, `apiKeyHelper`, `mcpServers` / `.mcp.json`, `package.json` `scripts`, CI workflows, and Markdown whose frontmatter declares `hooks` | code — the whole file, even when most of it is data | `sqa-engineer` → `code-reviewer` |
| 4 | Everything else: agent, skill, rule, instruction and command Markdown (including frontmatter that grants tools: `tools`, `allowed-tools`, `disallowedTools` — a permission, not something that runs), memory, READMEs and other prose, data config (`workflow.json`, manifests, schemas) | docs | `brutal-critique` |

- **Generated only when proven:** hand-made `.claude/skills/`, `.github/skills/`, `.claude/agents/` and `.github/agents/*.agent.md` files in a consumer repository, twins included, are docs or code by rows 2–4. Only a file whose `--check` proves it was written by the tool counts as generated.
- **Catalog check.** `.ai-dlc/catalog.json` has no `--check`, so it is proven by regenerating it to a temporary file. **Scott Hanselman** (`orchestrator`) runs it in AAW step 2, or the main agent when there is none. It never touches the repository's index or working tree. `<plugin root>` is resolved as in the `workflow` skill's **install** step 2: the base directory of the loaded `workflow` skill, then `../..`.
  1. `node .ai-dlc/workflow.mjs catalog --plugin <plugin root> --out <temp file outside the repository>`.
  2. `git diff --no-index --quiet --ignore-cr-at-eol -- .ai-dlc/catalog.json <temp file>`.
  3. Delete the temp file.

  Exit 0 at step 2: the catalog is generated. Any other exit: the plugin version moved or the file was hand-edited, so it is docs (row 4); the `workflow` skill's version check (catalog `plugin.version` against the installed plugin) reports a moved version as well. When `.ai-dlc/workflow.mjs` is in the same change set, the catalog goes to the docs path for that round whatever step 2 shows, because the set is classified before that script's code review runs.
- **Disagreement:** when `agent-manager`'s mark and the orchestrator's classification differ, the stricter reading wins: the file goes to both paths.
- **Reading to classify** (extension, shebang, top-level keys, frontmatter) is a verification read, not exploration.
- **Tests** `sqa-engineer` writes are code and join the change set, so `code-reviewer` reviews them. They go in the repository's test folder (e.g. `tests/`), outside the shipped plugin and outside `.claude/` and `.github/`.

## Rounds

**A round is one `agent-manager` change set followed by every review path that change set needs.** The first change opens round 1, so a budget of N rounds allows at most N − 1 fix passes after it. A mixed set runs the docs path and the code path in parallel; within the code path `code-reviewer` starts after `sqa-engineer`, so it reviews the new tests and a failing test returns before a review is spent.

**Re-runs.** In a later round, a path that passed re-runs when files of its kind changed since its pass. The docs path also re-runs when a changed code file is one the docs it passed describe (a skill and the script it documents).

**Budget.** The `loop.maxRounds` values on the AAW review stages are one shared pool, not one budget per loop; `validate` requires the same value on all three (default 3). When the budget is spent with findings open, the run stops and the human decides.

## Findings

Every REVISE, Blocker, Major (also on a PASS), `code-reviewer` Warning and test that fails because the code is wrong goes back to `agent-manager` in the next round, all findings of the round in one brief. A test that is itself wrong is `sqa-engineer`'s to fix in its own stage. Minors and Suggestions never start a round; they are listed in the closing report.

## What `validate` enforces

- The lifecycle `routing.byType["Agent Artifact"]` names starts with `agent-manager` and has a `brutal-critique`, a `sqa-engineer` and a `code-reviewer` stage, each looping back to the `agent-manager` stage.
- Each of those loops has a `maxRounds`, and all three are equal (the shared budget).
- The `code-reviewer` stage lists the `sqa-engineer` stage directly in its `after` (or follows it with `after` omitted); reaching it through another stage does not count.
- A review stage's `when` is either omitted (the stage runs on every change) or exactly `the change set contains docs` for `brutal-critique` and `the change set contains code` for the other two, case and spacing ignored.
- `brutal-critique`, `sqa-engineer` and `code-reviewer` cannot be disabled.

It cannot check the classification itself, that a review really ran, or the round count at run time: those rest on this file and on the run's folder: its run state, handoff records and stored hand-backs.
