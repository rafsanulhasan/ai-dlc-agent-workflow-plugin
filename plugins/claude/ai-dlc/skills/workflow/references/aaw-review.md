# AAW review: variants, change kinds, rounds and findings

The single source for how agent-artifact work reviews a change set, in its two lifecycles: `AAWH` (harness) and `AAWP` (plugin / mod), both listed under `routing.byType["Agent Artifact"]`. Every other file points here; agents reach it as `references/aaw-review.md` in the base directory of the `workflow` skill, after loading that skill. **Boris Cherny** (`agent-manager`) marks each changed path; **Scott Hanselman** (`orchestrator`), or the main agent when there is none, classifies the set with the rule below and spawns the reviewers: docs to **Linus Torvalds** (`brutal-critique`), code to **Kent Beck** (`sqa-engineer`) and then **Robert C. Martin** (`code-reviewer`).

> Agent names are the defaults; a name chosen at `/ai-dlc:init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## Variants

| Variant | Code | Stages (agent) | For |
|---|---|---|---|
| harness | `AAWH` | `intent` (**James Montemagno**, `product-owner`) → `change` (`agent-manager`) → `docs` (**Daniele Procida**, `documentation-writer`, when documentation changes) ∥ `critique` (`brutal-critique`, loops to `change`) | docs only, every path in `routing.agentArtifact.harnessPaths` |
| plugin / mod | `AAWP` | `intent` (`product-owner`) → `design` (**Mark Richards**, `software-architect`) → `lld` (**Zoran Horvat**, `system-engineer`, loops to `design`: Refine) → `change` (`agent-manager`) → `test` (`sqa-engineer`, loops to `change`) → `code-review` (`code-reviewer`, after `test`, loops to `change`); `docs` ∥ `critique` after `change`, beside `test` | any code, or any path in `routing.agentArtifact.pluginPaths` |

Neither variant has a `software-engineer` stage or a gate. `agent-manager` asks `system-engineer` about the low-level design while it builds (Align) with a clarify request, not a stage loop. The change set picks the variant: any code path (*Change kinds*, rows 2 and 3) or any path in `pluginPaths` runs `AAWP`; a set that is all docs, every path in `harnessPaths`, runs `AAWH`; anything else is asked of the human, with `AAWP` recommended for any change to a plugin, hook or tool. Generated paths (row 1) never decide it. With no harness lifecycle in the list, every change set runs the plugin one.

## Change kinds

Apply per file; the first rule that matches decides.

| # | The file is… | Kind | Goes to |
|---|---|---|---|
| 1 | Written by a build or sync whose `--check` passes on it: in the plugin repository, `plugins/copilot/**` (`node tools/build-copilot.mjs --check`), the `.claude/skills/<name>/` mirrors of the skills listed in `tools/project-skills.json`, and `skills/init/templates/AGENTS.md`, `CLAUDE.md` and `copilot-instructions.md` rendered by that build; in a consumer repository, the twin files `node .claude/scripts/sync-harness.mjs` wrote, when its `--check` passes, and `.ai-dlc/catalog.json` when the catalog check below passes | generated | No reviewer. `agent-manager` runs the `--check` and quotes its output; the orchestrator checks that it did. Its source is classified instead |
| 2 | A script (`.mjs`, `.js`, `.cjs`, `.ts`, `.ps1`, `.sh`, `.py`, `.cs`, …) or any file with a shebang: hook scripts, build tools, CLIs | code | `sqa-engineer` → `code-reviewer` |
| 3 | A file with any key whose value is a command or registers one: hook registrations (`hooks` in `hooks.json`, `settings.json` or `.github/hooks/*.json`), `statusLine.command`, `apiKeyHelper`, `mcpServers` / `.mcp.json`, `package.json` `scripts`, CI workflows, and Markdown whose frontmatter declares `hooks` | code — the whole file, even when most of it is data | `sqa-engineer` → `code-reviewer` |
| 4 | Everything else: agent, skill, rule, instruction and command Markdown (including frontmatter that grants tools: `tools`, `allowed-tools`, `disallowedTools` — a permission, not something that runs), memory, READMEs and other prose, data config (`workflow.json`, manifests, schemas) | docs | `brutal-critique` |

- **Generated only when proven:** hand-made `.claude/skills/`, `.github/skills/`, `.claude/agents/` and `.github/agents/*.agent.md` files in a consumer repository, twins included, are docs or code by rows 2–4. Only a file whose `--check` proves it was written by the tool counts as generated.
- **Catalog check.** `.ai-dlc/catalog.json` has no `--check`, so it is proven by regenerating it to a temporary file. **Boris Cherny** (`agent-manager`) runs it as one of the checks of its change and quotes the three commands and the exit code of step 2 in its hand-back; **Scott Hanselman** (`orchestrator`) never runs it and only checks the hand-back (the agent-artifact hard rule, step 2). When there is no orchestrator, `agent-manager` runs it as the main agent. It never touches the repository's index or working tree. `<plugin root>` is resolved as in the `workflow` skill's **install** step 2: the base directory of the loaded `workflow` skill, then `../..`.
  1. `node .ai-dlc/workflow.mjs catalog --plugin <plugin root> --out <temp file outside the repository>`.
  2. `git diff --no-index --quiet --ignore-cr-at-eol -- .ai-dlc/catalog.json <temp file>`.
  3. Delete the temp file.

  Exit 0 at step 2: the catalog is generated. Any other exit: the plugin version moved or the file was hand-edited, so it is docs (row 4); the `workflow` skill's version check (catalog `plugin.version` against the installed plugin) reports a moved version as well. When `.ai-dlc/workflow.mjs` is in the same change set, the catalog goes to the docs path for that round whatever step 2 shows, because the set is classified before that script's code review runs.
- **Disagreement:** when `agent-manager`'s mark and the orchestrator's classification differ, the stricter reading wins: the file goes to both paths.
- **Reading to classify** (extension, shebang, top-level keys, frontmatter) is a check, not exploration; it reads files and never runs a command. It is the only read of the changed files the orchestrator makes, and only to tell their kind, never to understand what they say (`orchestrator.md`, *Delegate the work; check the agents' work*).
- **Tests** `sqa-engineer` writes are code and join the change set, so `code-reviewer` reviews them. They go in the repository's test folder (e.g. `tests/`), outside the shipped plugin and outside `.claude/` and `.github/`.

## Rounds

**A round is one `agent-manager` change set followed by every review path that change set needs.** The first change opens round 1. In `AAWP` a mixed set runs the docs path and the code path in parallel; within the code path `code-reviewer` starts after `sqa-engineer`, so it reviews the new tests and a failing test returns before a review is spent. `AAWH` has the docs path only.

**Step codes.** An agent-artifact change is one feature `N` (root 1 in a run of its own), numbered by phase (`handoff`, *Naming*, Phases). Planning, in `AAWP` (and the `intent` stage in `AAWH`): `product-owner` `N.1.1`, `software-architect` `N.1.2`, `system-engineer` `N.1.3`, the Refine rounds `N.1.3.l1.<r>`. Then, in both variants: the change is `N.2`, `brutal-critique` `N.5` (with `documentation-writer`'s *Docs update* pass); in `AAWP` also `sqa-engineer` `N.3` and the `code-reviewer` axes `N.4.1` (standards) and `N.4.2` (spec). Round 1 above is these first passes; each later round `r` is round `r − 1` of the loop of every step that re-runs (`N.3.l1.<r−1>`, `N.4.l1.<r−1>`, `N.5.l1.<r−1>`), starting with `agent-manager`'s fix. A fix that answers findings of several steps is numbered in the loop of the earliest phase among them; a fix for one step alone stays in that step's loop (*Naming*, Loops and rounds).

**Re-runs.** In a later round, a path that passed re-runs when files of its kind changed since its pass. The docs path also re-runs when a changed code file is one the docs it passed describe (a skill and the script it documents).

**Limits per step.** Each review step has its own `maxRounds` and `maxFailures`, resolved per reviewer from these levels, the first valid value winning:

| # | Level | Use it for |
|---|---|---|
| 1 | `env` in `.claude/settings.local.json` | One developer |
| 2 | `env` in `.claude/settings.json` | The team |
| 3 | The process environment | One session or CI job; the only level on GitHub Copilot |
| 4 | The loop's value in `workflow.json` | The project |
| 5 | The default: 2 rounds, 1 failure | — |

- **Variables:** `AI_DLC_CRITIQUE_*` (`brutal-critique`), `AI_DLC_TEST_*` (`sqa-engineer`) and `AI_DLC_CODE_REVIEW_*` (`code-reviewer`), each with `MAX_ROUNDS` and `MAX_FAILURES`.
- **Handoff review:** `brutal-critique`'s review of each handoff record of `AAWH` and `AAWP` (`handoffReview.lifecycles`) is a step of its own, row `handoff-review` of `rounds --json`: its file values are `handoffReview.maxRounds` and `maxFailures`, and its variables are its own, `AI_DLC_HANDOFF_REVIEW_MAX_ROUNDS` and `AI_DLC_HANDOFF_REVIEW_MAX_FAILURES`, never `AI_DLC_CRITIQUE_*`. A failing verdict is a REVISE; the record's writer fixes it (the `workflow` skill's *Handoff review*).
- **No shared budget:** each step counts its own passes and failures; the three steps' values need not match.
- **Rounds:** a step with `maxRounds` N reviews at most N times, so at most N − 1 fix passes follow its first review.
- **Failures:** `maxFailures` is how many failing verdicts its reviewer may return before the loop stops, even with rounds left. A failing verdict is what the step's loop `on` names; in the default `AAWH` and `AAWP`: REVISE or Majors on a PASS (`brutal-critique`), a test that fails because the code is wrong (`sqa-engineer`), a Blocker or Warning (`code-reviewer`).
- **Rule:** `maxRounds` ≥ `maxFailures` + 1, so `maxFailures` 1 needs `maxRounds` 2 or more. Valid values and warnings: the `workflow` skill's *Loop limits*.
- **Values in effect:** the orchestrator runs `node .ai-dlc/workflow.mjs rounds --json` at the start of a run and before each loop and uses what it prints, with the source of each value (part of reading its own workflow, the exception `orchestrator.md` states in *Delegate the work; check the agents' work*); it never works out the precedence from the file. The one exception is a raise the human made for a stopped step (the `workflow` skill's *Raising the limits for a run*).
- **Gate critique:** the documents critique of `critique`-marked stages is not an agent-artifact step and has no file value; its limits are the `gate-critique` row of `rounds --json` (the `workflow` skill's *Gate critique*).

**The human decides on open findings.** When a step stops, its failures or its rounds used up, with findings still open that fail its verdict (not only Blockers), the orchestrator (or the main agent when there is none) asks the human once for that stopped step; when several steps stop in the same round, one question per stopped step, asked together. A fix round after the stop counts against the limits like any other: it uses up a round, and a failing verdict in it counts as a failure. Since the limits are exhausted, the human's options are to raise them for this run (the `workflow` skill's *Raising the limits for a run*) or to stop or accept the findings. Open findings never pass to real work without that decision. Minors and Suggestions need no decision.

## Findings

Every REVISE, Blocker, Major (also on a PASS), `code-reviewer` Warning and test that fails because the code is wrong goes back to `agent-manager` in the next round, all findings of the round in one brief, unless the step that raised it has used up its limits (*Limits per step*). A test that is itself wrong is `sqa-engineer`'s to fix in its own stage. Minors and Suggestions never start a round; they are listed in the closing report.

## What `validate` enforces

The guards look at agents and loops, not at lifecycle codes, so a project's own lifecycle listed under the key is guarded the same way.

- **G6, the list:** `routing.byType["Agent Artifact"]` is a non-empty list of defined lifecycles with stages, none twice (the only `byType` value that may be a list). Each has `variant` `harness` or `plugin`; exactly one is `plugin` and at most one `harness`. The single string `AAW` of older plugins fails with `routing.byType["Agent Artifact"] is the single AAW lifecycle of an older plugin; run /ai-dlc:workflow upgrade to replace it with AAWH and AAWP`.
- **G1:** no stage of a listed lifecycle has `agent: "software-engineer"`; the error names the stage.
- **G2:** a listed lifecycle has at least one `agent-manager` stage.
- **G3:** every starting stage (`after: []`, or the first stage with `after` omitted) is `product-owner`, `software-architect` or `agent-manager`.
- **G4, both variants:** a `brutal-critique` stage loops back to an `agent-manager` stage.
- **G5, the plugin variant:** a `sqa-engineer` and a `code-reviewer` stage loop back to an `agent-manager` stage; the `code-reviewer` stage lists the `sqa-engineer` stage directly in its `after` (or follows it with `after` omitted), and reaching it through another stage does not count; and an `agent-manager` stage follows a `software-architect` stage and a `system-engineer` stage through `after`, directly or through other stages.
- **G7:** no agent in `agents.disabled` owns a stage of a listed lifecycle; the error names the agent and the lifecycle. `brutal-critique`, `sqa-engineer` and `code-reviewer` cannot be disabled; `product-owner` can, once it owns no stage there.
- A review stage's `when` is either omitted (the stage runs on every change) or exactly `the change set contains docs` for `brutal-critique` and `the change set contains code` for the other two, case and spacing ignored. In the harness variant this applies to `brutal-critique` only.
- On every loop, these included, and on `handoffReview`: `maxRounds` is a whole number ≥ 1, `maxFailures` a whole number ≥ 0, and `maxFailures` is below `maxRounds` (omitted values counted at their defaults). `handoffReview` is required and names defined lifecycles.

It cannot check the classification itself, which variant a run took, that a review really ran, or the passes and failures counted at run time (`node .ai-dlc/workflow.mjs rounds` prints each loop's limits): those rest on this file and on the run's folder: its run state, handoff records and stored hand-backs.
