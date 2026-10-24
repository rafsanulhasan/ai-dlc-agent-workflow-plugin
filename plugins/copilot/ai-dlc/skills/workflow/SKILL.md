---
name: workflow
description: "Customise the AI-DLC workflow of a repository: which stages each lifecycle runs, which agent owns each stage and hands off to whom, what runs in parallel, refinement loops and their round and failure limits, gates and who approves them, the clarify matrix, request routing, disabled and custom agents, artifact paths — all in .ai-dlc/workflow.json, which the orchestrator follows instead of the plugin default. Use to show the effective workflow as tables or a diagram, to edit it from a change in plain words (\"skip G3\", \"system-engineer reviews before code-reviewer\", \"add our security-auditor after build\"), to install or validate the file (with the generated plugin catalog it is checked against and the Stop-hook gate that blocks finishing while it is invalid), to upgrade it after a plugin update, or to reset it to the default."
---

# Workflow

A repository's AI-DLC workflow lives in `.ai-dlc/workflow.json`. The orchestrator reads it on every request; when it is absent, the plugin default applies: [templates/workflow.json](templates/workflow.json), the machine-readable form of the `ai-dlc` skill's catalogue. The project file is a complete definition, so a developer sees and edits everything in one place.

| File in `.ai-dlc/` | What it is |
|---|---|
| `workflow.json` | The team's workflow. Committed. `"$schema": "./workflow.schema.json"` gives completion, hover docs and validation in VS Code |
| `workflow.schema.json` | The schema; every key's meaning is in its `description` ([templates/workflow.schema.json](templates/workflow.schema.json)) |
| `workflow.mjs` | Zero-dependency CLI: `validate`, `show [<lifecycle>] [--mermaid]`, `rounds [--json]`, `diff --against <path>`, `catalog --plugin <dir>`, `merge --template <path> [--file <p>] [--dry-run]`; `--help` lists the options ([templates/workflow.mjs](templates/workflow.mjs)) |
| `catalog.json` | Generated, never edited: the installed plugin's version, agent IDs and skill names, written by `workflow.mjs catalog` at **install** and **upgrade**. `validate` checks every agent and stage skill against it plus the project's own agents (`.claude/agents`, `.github/agents`) and skills (`.claude/skills`, `.github/skills`); without it, `validate` fails. Committed, so the gate and CI validate without the plugin |

The **workflow gate** guards the file: `.claude/hooks/check-workflow.mjs` ([templates/check-workflow.mjs](templates/check-workflow.mjs)), run by a Claude `Stop` hook in `.claude/settings.json` and its Copilot twin `.github/hooks/ai-dlc-workflow-gate.json`. When `.ai-dlc/` has uncommitted changes, it runs `node .ai-dlc/workflow.mjs validate` and blocks finishing while that fails. It blocks **once per stop cycle**, like the test gates: if the agent stops again right after a block, the hook lets it through, so the gate catches mistakes but does not make an invalid file impossible — `validate` in CI or review does. It is a project hook installed with the files; the plugin ships no hooks. `AI_DLC_WORKFLOW_GATE=false` pauses it.

**Boris Cherny** (`agent-manager`) owns changes to the workflow file, like every agent artifact, and each change is reviewed before it is done (the `AAWH` and `AAWP` lifecycles, [references/aaw-review.md](references/aaw-review.md)): docs by **Linus Torvalds** (`brutal-critique`), code by **Kent Beck** (`sqa-engineer`) then **Robert C. Martin** (`code-reviewer`); developers may also run `/workflow …` themselves. **Scott Hanselman** (`orchestrator`) only reads it.

> Agent names are the defaults; a name chosen at `/init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## How the orchestrator applies it

- **Effective workflow** = `.ai-dlc/workflow.json` if present, else the plugin default. A present but invalid file stops the run: the orchestrator shows the `validate` output and never falls back silently.
- **Lifecycle codes** are the keys of `lifecycles`, the one list every skill refers to; a run's handoff folder starts with its code (`artifacts.handoffs`).
- A one-off instruction in a request ("skip G3 this time") overrides the file for that run only.
- Stage order comes from `after`; stages that share an `after` run in parallel; a stage whose `when` does not hold is skipped and counts as finished.
- A gate's `approver`: `human` stops for the human; `orchestrator` approves on the human's behalf and records it; `none` skips the stop, but the handoff record is still written and verified.
- A `loop` sends work back until its condition clears, or until its `maxRounds` or `maxFailures` is used up (*Loop limits*).
- **Limits come from `rounds`.** At the start of a run and before each loop, the orchestrator runs `node .ai-dlc/workflow.mjs rounds --json` and uses the `maxRounds` and `maxFailures` it prints for that loop, and for gate critique (*Gate critique*). Running it is part of reading its own workflow, the one exception to running no checks that `orchestrator.md` states (*Delegate the work; check the agents' work*). It never works out the precedence itself. The one exception is a raise the human made for a stopped step (*Raising the limits for a run*).
- **The human always decides on open findings.** When a loop stops, because its failures or its rounds are used up, with findings open that fail its verdict (*Loop limits*: whatever the loop's `on` names, not only Blockers), the orchestrator asks the human once for that stopped step. When several steps stop in the same round, it asks one question per stopped step, all together. A fix round after the stop counts against the limits like any other: it uses up a round, and a failing verdict in it counts as a failure. Since the limits are exhausted, the human's options are:
  - **Raise the limits for this run**, so more fix rounds can run (*Raising the limits for a run*).
  - **Stop, or accept the findings.**

  Open findings never pass on to the next stage without that decision. Minors and Suggestions need no decision.

## Loop limits

Every stage `loop`, and `clarify`, has two limits:

| Key | Meaning | Omitted |
|---|---|---|
| `maxRounds` | The most review passes the step may run | 2 |
| `maxFailures` | How many failing verdicts that step's reviewer may return before the loop stops and escalates, even with rounds left | 1, or `maxRounds` − 1 when that is lower |

A failing verdict is whatever the loop's `on` names; the `on` text is the rule. In the default file, for example:

- `AAWH` and `AAWP` critique loops: a REVISE verdict, or Majors on a PASS, from **Linus Torvalds** (`brutal-critique`).
- `AAWP` test loop: a test that fails because the code is wrong, from **Kent Beck** (`sqa-engineer`).
- `AAWP` code-review loop: a Blocker or a Warning from **Robert C. Martin** (`code-reviewer`).
- `AAWP` lld loop: a challenge to the design from the low-level design (Refine), from **Zoran Horvat** (`system-engineer`); file-only, like every loop of an agent that is not a reviewer.
- `FDLC`, `BFLC` and `TLC` code-review loops: Blockers only, so a Warning there is not a failing verdict; the `RLC` one adds a behaviour change.
- `clarify`: a round that ends with the question still open.

The loop stops at the failing verdict that takes the count past `maxFailures`: with `maxRounds` 3 and `maxFailures` 1, a first failure is fixed in round 2, and a second failure stops the loop with round 3 unused. The rule is `maxRounds` ≥ `maxFailures` + 1 (the same as `maxFailures` < `maxRounds`): `maxFailures` 1 needs `maxRounds` 2 or more, and `maxRounds` 1 allows only `maxFailures` 0. A file value that breaks this rule fails `validate`. Each step has its own pair: the `AAWH` and `AAWP` review loops need not match.

A variable overrides a property on **every** loop whose stage agent is that reviewer, in every lifecycle (the critique pair also sets gate critique, *Gate critique*):

| Stage agent | Rounds | Failures |
|---|---|---|
| `brutal-critique` | `AI_DLC_CRITIQUE_MAX_ROUNDS` | `AI_DLC_CRITIQUE_MAX_FAILURES` |
| `sqa-engineer` | `AI_DLC_TEST_MAX_ROUNDS` | `AI_DLC_TEST_MAX_FAILURES` |
| `code-reviewer` | `AI_DLC_CODE_REVIEW_MAX_ROUNDS` | `AI_DLC_CODE_REVIEW_MAX_FAILURES` |

Each property is resolved on its own, the first valid value winning:

| # | Level | Source in `rounds` | Use it for |
|---|---|---|---|
| 1 | `env` in `.claude/settings.local.json` | `settings.local.json` | One developer's own limits (gitignored) |
| 2 | `env` in `.claude/settings.json` | `settings.json` | The team's limits (committed) |
| 3 | The process environment: shell, CI, or what the host passed in | `env` | One session or one CI job; a value in either settings file overrides it |
| 4 | The loop's own value in `workflow.json` | `loop` | The project's workflow |
| 5 | The default in the table above | `default` | — |

```json
{ "env": { "AI_DLC_CODE_REVIEW_MAX_ROUNDS": "3", "AI_DLC_CODE_REVIEW_MAX_FAILURES": "1" } }
```

- **Where:** levels 1 and 2 are Claude Code settings files; `workflow.mjs` reads their `env` itself, comments allowed, so a plain terminal, CI and Claude Code give the same answer. On GitHub Copilot only level 3 applies. The project is the folder that holds `.ai-dlc/`.
- **File-only loops:** loops of other agents (the `product-owner` accept loop, the `software-architect` conformance loop, …) and `clarify` take levels 4 and 5 only.
- **Valid value:** a string that matches `^\s*(0|[1-9][0-9]*)\s*$`, or in a settings file also a JSON number, within the safe-integer range; ROUNDS must be ≥ 1, FAILURES ≥ 0. So `2`, ` 2 ` and `2` as a number count; `007`, `00`, `+2`, `-1`, `1.5`, `1e3`, `0x2` and `true` do not.
- **Unset or blank, missing file, no `env` key:** that level is skipped, with no warning.
- **Invalid value:** ignored, with one warning on stderr naming the variable and its file (or `environment`); resolution falls through to the next level. A settings file that does not parse is skipped with one warning naming it. Neither ever fails `validate` or changes an exit code.
- **Combined check:** when the resolved values would make a loop's `maxFailures` ≥ its `maxRounds`, the variables applied to that loop are ignored there, with a warning naming each and its source, and the loop's file values are used.

`node .ai-dlc/workflow.mjs rounds` is the source of truth: it prints, per loop, for `clarify`, for `gate-critique` and for `handoff-review`, the lifecycle and stage, the agent, where work returns to, and `maxRounds` and `maxFailures` with the source of each (`settings.local.json`, `settings.json`, `env`, `loop` — for `clarify`, the `clarify` object — or `default`); `--json` for scripts.

### Gate critique

Every stage marked `critique` gets a critique of its documents: `documents.writer` writes, `documents.critic` critiques, before the gate. This critique has no `loop` object, so it has no file value: nothing in `workflow.json` sets its limits.

- **Applies to:** every `critique`-marked stage, in every lifecycle, with one pair of limits for all of them.
- **Values:** only the critique pair, `AI_DLC_CRITIQUE_MAX_ROUNDS` and `AI_DLC_CRITIQUE_MAX_FAILURES`, read through the same three levels with the same valid-value rule, warnings and combined check as a loop (levels 1–3 above); otherwise the default, 2 rounds and 1 failure. When the combined check drops the variables, the default applies.
- **Sources:** the same names as for a loop, with `default` in place of `loop`.
- **Where to read it:** `rounds --json` lists it as the row with id `gate-critique` (`lifecycle`, `stage` and `to` are `null`, `agent` is `brutal-critique`), and `show` prints it beside the `clarify` line. The orchestrator reads it from `rounds --json`, like every other limit.
- **Independent of `AAWH` and `AAWP`:** their critique loops are stage loops with their own file values; the same variables apply to all of them, but each resolves on its own, and the combined check can drop a variable on one and not on the other.
- With `documents.critic: null` there is no gate critique, and the row is not used.

### Handoff review

**Linus Torvalds** (`brutal-critique`) reviews each handoff record of the lifecycles `handoffReview.lifecycles` names (default `AAWH`, `AAWP`) before its receiver starts: PASS, or REVISE back to the record's writer. The reviewer is always `brutal-critique`, so the file has no reviewer key.

- **File values:** `handoffReview.maxRounds` and `handoffReview.maxFailures` (omitted: 2 and 1, as on a loop; `maxFailures` below `maxRounds`). `handoffReview` is a required top-level key; **upgrade** adds it.
- **Variables:** its own pair, `AI_DLC_HANDOFF_REVIEW_MAX_ROUNDS` and `AI_DLC_HANDOFF_REVIEW_MAX_FAILURES`, read through levels 1–3 with the same valid-value rule, warnings and combined check as a loop. The `AI_DLC_CRITIQUE_*` pair never applies to it, so gate critique, the critique loops and the handoff review change independently.
- **Where to read it:** `rounds --json` lists it as the row with id `handoff-review` (`lifecycle`, `stage`, `agent` and `to` are `null`), and `show` prints it beside the `Gate critique` line.
- `documents.critic: null` does not switch it off.

### Raising the limits for a run

When a step stops with findings open, the human may raise its limits instead of stopping or accepting (*How the orchestrator applies it*).

- **What it is:** the human's explicit new `maxRounds`, `maxFailures` or both, for one stopped step.
- **Where it is recorded:** in the run state's *Gates and loops* table (`handoff` skill, *Run state*), on that step's row.
- **How it is used:** the orchestrator uses it in place of the `rounds` value for that step only, for the rest of that run. Other steps, and other runs, keep the values `rounds` prints.
- **Rule:** it must still satisfy `maxRounds` ≥ `maxFailures` + 1. Raising only `maxRounds` always does; raising `maxFailures` alone may not, and then the orchestrator asks for a `maxRounds` that fits.
- **What it never changes:** `workflow.json` and the settings files. To change the limits for good, edit the file (**edit**) or set the variables.

## Fixed guardrails

The file cannot change these; `validate` rejects the attempts it can detect.

- Boris Cherny (`agent-manager`) alone changes agents, skills, hooks, rules, commands, agent memory and this workflow file, and `agent-artifact work` always routes to it. `orchestrator` and `agent-manager` cannot be disabled.
- Every agent-artifact change is reviewed, in bounded loops. `routing.byType["Agent Artifact"]` lists its lifecycles, one per variant (default `AAWH`, harness, and `AAWP`, plugin / mod). Each is guarded by role: no `software-engineer` stage, an `agent-manager` stage that builds the change, a start at `product-owner`, `software-architect` or `agent-manager`, and a `brutal-critique` stage (docs) that loops back to `agent-manager`; the plugin variant adds `sqa-engineer` and then `code-reviewer` (code) stages that loop back to it and design stages (`software-architect`, `system-engineer`) before it. Each review loop has its own round and failure limits (*Loop limits*). `brutal-critique`, `sqa-engineer` and `code-reviewer` cannot be disabled, and `documents.critic: null` does not remove these reviews. Change kinds, rounds, findings, and exactly what `validate` enforces and what it cannot: [references/aaw-review.md](references/aaw-review.md). A missing `routing.byType["Agent Artifact"]`, a missing `handoffReview`, or the single `AAW` routing of older plugins fails `validate`: run **upgrade**.
- A change to `agent-manager`'s own definition, or to a skill it owns (`agent-management`, `skill-management`, `hook-management`, `rules-management`, `command-management`, `harness-sync`, `workflow`, `plugin-management`), is made by a freshly spawned `agent-manager`, never by the running instance.
- Trust, but verify: every hand-off, `AAWH` and `AAWP` included, gets a handoff record that its receiver verifies (never its writer), whatever the gate approver, and every agent's hand-back is stored verbatim beside it, in the run's folder (`artifacts.handoffs`: `{LIFECYCLE}-{YYYYMMDD}-{feature-slug}/`, files `{step}[.{sub}][.l{loop}[.{round}]][.{n}][.h{round}]-{from-agent}-to-{to-agent}.handoff.md` and `.handback.md`; `handoff` skill). `AAWH` and `AAWP` have no gates: the run state records the rounds and verdicts.
- The test gate hooks and the workflow gate installed by `init` stay in force.
- The orchestrator only delegates, and a stage owner never does another agent's job.

## Phase 0 — Context load (silent)

1. Read the root `CLAUDE.md` and `AGENTS.md`.
2. Invoke `Skill("manage-memory", args: "agent-manager")`.
3. Check for `.ai-dlc/workflow.json`, `.ai-dlc/workflow.schema.json`, `.ai-dlc/workflow.mjs`, `.ai-dlc/catalog.json`, the workflow gate (`.claude/hooks/check-workflow.mjs`, its `Stop` entry in `.claude/settings.json`, `.github/hooks/ai-dlc-workflow-gate.json`) and `node` on PATH. Done when you know which files exist, whether the schema, CLI and gate script match `templates/`, and whether the catalog's `plugin.version` matches the installed plugin (`../../.claude-plugin/plugin.json`, or `plugin.json` on Copilot). With no `.ai-dlc/`, run **install** first (any mode except `show` of the default); with a missing or outdated catalog, run **upgrade**.

## Mode: show

**Args:** `show [<lifecycle>]`

1. Run `node .ai-dlc/workflow.mjs show [<lifecycle>]` and `node .ai-dlc/workflow.mjs show [<lifecycle>] --mermaid`. With no project file, run `node templates/workflow.mjs show [<lifecycle>] [--mermaid] --file templates/workflow.json --plugin ../..` and say the plugin default is in effect.
2. Present the stage tables, the gates and the diagrams (one per lifecycle; solid arrows are hand-offs, dashed arrows are loops, hexagons are gates; `x<N> f<N>` in the loop column are the loop's `maxRounds` and `maxFailures`). When the developer asks about loop limits, also run `rounds` and present where each value comes from. Done when every requested lifecycle is shown, or the `validate` errors are, if the file is invalid.

## Mode: edit

**Args:** `edit <change in plain words>`

1. Translate the change into JSON edits with [references/edit-recipes.md](references/edit-recipes.md). A change that would break a fixed guardrail is refused with the reason. An ambiguous change ("review earlier") becomes one question with a recommended reading.
2. Apply the edits to a copy in the scratch folder and run `node .ai-dlc/workflow.mjs validate --file <copy>`. Fix every error the edit caused. Done when it exits 0.
3. Show the developer the `diff --file <copy> --against .ai-dlc/workflow.json` output, the warnings, and `show <lifecycle> --mermaid` of every changed lifecycle.
4. Write the copy over `.ai-dlc/workflow.json` only with the developer's consent, then run `validate` on it. Done when it exits 0.

## Mode: install

**Args:** `install`. `/init` installs the files; this mode installs or refreshes them later.

1. Copy `templates/workflow.schema.json` and `workflow.mjs` into `.ai-dlc/`: they are plugin-owned and replaced; an existing different file is diffed first and written with the developer's consent. Then `workflow.json`:
   - **Absent:** copy the template.
   - **Present:** never replace it. After removing a legacy `review.maxRounds` (**upgrade** step 2), run `node .ai-dlc/workflow.mjs merge --template templates/workflow.json --dry-run`, show the developer the list of keys it would add, and with consent run it again without `--dry-run` (*Merging into an existing file*).
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

1. Refresh `workflow.schema.json` and `workflow.mjs` from the templates first (plugin-owned, replaced), so the new `merge` and `validate` are the ones that run.
2. **Legacy key.** If the file has `review.maxRounds` (older plugins' shared review budget), offer to remove it and remove it only when the developer agrees. Do this before `merge`: `merge` runs `validate` after writing, `validate` rejects the key as unknown, and `merge` never deletes it. Its value is not carried over; set the per-reviewer pairs (*Loop limits*) if the developer wants it kept.
3. Run `node .ai-dlc/workflow.mjs merge --template templates/workflow.json --dry-run` and present each `+` line to the developer. State the loop-limit lines plainly:
   - `maxFailures` added next to an existing `maxRounds`: it is 1, or `maxRounds` − 1 when that is lower. A loop keeps its rounds but now stops earlier: a loop with an explicit `maxRounds` of 3 gets `maxFailures` 1, so the loop stops at the second failing verdict with round 3 unused. To keep three full rounds, set `maxFailures` 2 on it.
   - `maxRounds` added next to an existing `maxFailures`: it is the template's value, or `maxFailures` + 1 when that is higher.
   - `maxRounds` and `maxFailures` added to a loop that had neither: these loops had no limit before and are now capped at 2 rounds and 1 failure.
   - `clarify.maxFailures`, and `clarify.maxRounds` when the file omits it: an omitted `clarify.maxRounds` used to mean 3 rounds and now means 2. Set `clarify.maxRounds` 3 (and `maxFailures` 2) to keep the old behaviour.
4. Run `node .ai-dlc/workflow.mjs diff --against templates/workflow.json` for what `merge` does not do: upstream changes to values the project also has, and keys upstream removed. Propose each with its outcome; ask when a line is both customised and changed upstream.
5. With the developer's consent, run `merge` without `--dry-run`, apply the agreed `diff` items, refresh the workflow gate (**install** step 3), regenerate the catalog (**install** step 2), and run `validate`. Done when it exits 0.

### Merging into an existing file

`merge` adds every key the project file lacks, taken from the template, and never overwrites or deletes a value, even one that differs from the template (an `AAWP` `maxRounds` of 1, a gate with `approver: "none"`). Arrays (`axes`, `skills`, `produces`, `after`, `disabled`) are kept as they are. Stages are matched by `id`: a missing stage is added in template order, a missing lifecycle is added, and stages or lifecycles only the project has are kept. A key the project removed on purpose comes back, so read the `--dry-run` list with the developer. New keys go at the end of their object; the file is written in the template's layout and then validated. A limit `merge` adds keeps `maxFailures` < `maxRounds` (**upgrade** step 3). A file that still holds `review.maxRounds` fails that validation, so remove the key first (**upgrade** step 2), in **install** too.

## Mode: reset

**Args:** `reset [<lifecycle>]`

1. Whole file: replace `.ai-dlc/workflow.json` with the template. One lifecycle: replace only `lifecycles.<code>` with the template's, and restore any gate it uses that the project removed.
2. Show the diff, write only with consent, then run `validate`. Done when it exits 0.

## Report

List each file written, the `validate` result, the catalog line (`<plugin> <version> · N agents · N skills`), the diagram of every changed lifecycle, and the commands developers run themselves: `node .ai-dlc/workflow.mjs show|validate|rounds`. End with the changed paths, each marked `code` or `docs`, and the intent of the change, one line each, so the right reviewers can be spawned (`AAWH`, `AAWP`).
