---
intent: 001-preview2-specsmd
status: planned
updated: 2026-11-14
---

# Intent 001 — acceptance criteria

Status: planned (G1 approved 2026-11-13; FR-17 amendment approved 2026-11-13, D26; the D30–D37 name amendments are approved at G2, O-15). These are the acceptance criteria for FR-1 to FR-17 of [requirements.md](requirements.md). They were drafted by `requirement-analyst` (step 1.1.9) and changed as `product-owner` required (step 1.1.10). FR-17 and AC-17.1 to AC-17.14 were drafted in steps 1.1.13 and 1.1.18 and changed as `product-owner` required in step 1.1.17. Step 1.5.l2.2 applied the human's decisions D24 and D25.

Sources: `execution-plans/AI-DLC-20261113-preview2-specsmd/1.1.9-requirement-analyst-to-orchestrator.handback.md`, `1.1.10-product-owner-to-orchestrator.handback.md` and `decisions-2026-11-13.md` (D1–D37), plus FR-17 and the rename amendments from steps 1.1.13, 1.1.17 and 1.1.18 (`1.1.13-requirement-analyst-to-orchestrator.handback.md`, `1.1.17-product-owner-to-orchestrator.handback.md`, `1.1.18-requirement-analyst-to-orchestrator.handback.md`), and `execution-plans/AI-DLC-20261113-preview2-specsmd/1.1.19.1-system-engineer-to-orchestrator.handback.md` (the proposed keep-alive and migrate names).

## Conventions

- "Legacy paths" are the seven preview1 `docs/` defaults of `artifacts` in `.ai-dlc/workflow.json` (`backlog`, `product`, `specs`, `decisions`, `narratives`, `plans`, `handoffs`).
- "The contract" is spec 001 (`memory-bank/product/specs/001-preview2-specsmd.spec.md`): layout, vocabulary, ids, statuses, event schema, path map, fallback rule.
- "Repo checks" are `node --test "tests/**/*.test.mjs"`, `node tools/build-copilot.mjs --check`, `node tools/validate.mjs`, `npx @anthropic-ai/claude-code plugin test ./plugins/claude/engine` and `npx @anthropic-ai/claude-code plugin test ./plugins/claude/lens`. Each is quoted with its real output by the owning agent.
- "Old-name patterns" are the case-sensitive forms that FR-17 retires; AC-17.3, AC-17.4 and AC-17.9 use them:
  - `ai-dlc:` (`engine:` and `lens:` do not contain it);
  - `ai-dlc-engine`, `ai-dlc-suite` and every `ai-dlc-lens` form (`ai-dlc-lens:`, `ai-dlc-lens@`, `plugins/claude/ai-dlc-lens` and the old pane ids `ai-dlc-lens-*`): the interim names of D15 and D21 and the old lens name, replaced by `engine` (D32), `forgeline` (D30), `lens` (D31) and the pane ids `lens-*` (D33, D37); none ships (`.ai-dlc/lens.json` is not a pattern: a family name, unchanged);
  - `ai-dlc@`;
  - `"name": "ai-dlc"`;
  - `agent-memory/ai-dlc-<id>` for each plugin agent id;
  - `ai-dlc-agent-workflow` not followed by `-plugin`;
  - `plugins/claude/ai-dlc` or `plugins/copilot/ai-dlc` followed by a character other than a letter, a digit or `-`, or by the end of the line;
  - the phrase `ai-dlc plugin`;
  - the half-renamed lens forms `engine:lens` and `lens:lens`, and `lens:keepalive` (keep-alive stays in the engine, D24).

## Decided

Decided by `product-owner` in step 1.1.10. These are closed; the ACs below already carry them.

- **C-1 — bank content.** Lifecycle knowledge only. README files, `docs/plugins.md`, guides and release notes stay in `docs/` (D11).
- **C-2 — warning granularity.** One warning per tool invocation: one CLI command, one hook firing or one lens scan. Not per file, not per session, because a per-session warning needs persisted state, which edges toward the runtime that D3 defers.
- **C-3 — both paths exist.** Read the new path and warn once that the legacy path is ignored; the warning names the ignored legacy root and the migration entry point. An invocation that sees no legacy path emits no warning (AC-15.5).
- **C-6 — folder per run.** One `execution-plans/` folder per run, not per bolt. The execution plan and the run state record the intent, unit and bolt ids; bolt ids are entries, not folders.
- **C-10 — severity.** A bank file written by any agent other than `documentation-writer` is a Blocker: `code-reviewer` cannot approve and `brutal-critique` returns REVISE. Text a build generates is exempt; a stage agent returning content plus a *Docs update* request is not a violation.
- **C-11 — dry-run.** The migration has a dry-run mode, at P1 (AC-11.11).
- **C-12 — preview1 gate.** No preview2 change is merged into the preview1 release line before `1.0.0-preview1` is tagged; the version-bump merge is the last of these merges. Work on the preview2 planning branch itself continues.

Rename-round clarifications, resolved since step 1.1.13 (ids R1 to R8 follow the 1.1.13 numbering; they are not the open Q1 to Q4 below):

- **R1 — plugin source folders.** Renamed with the plugin: `plugins/claude/engine/` and the generated `plugins/copilot/engine/` (D19). The "(P)" conditional of the draft is gone.
- **R2 — marketplace name.** `forgeline`, fixed by D30 (supersedes D21, which named it `ai-dlc-suite`; `ai-dlc` is taken by TheBushidoCollective/ai-dlc, step 1.1.15). `ai-dlc-agent-workflow` becomes an old-name pattern allowed only on the allowlisted rename pages.
- **R3 — hooks module and skills in one plugin.** A hooks-module plugin may also ship `skills/`, and `command.run` answers `/<plugin>:<skill>` (1.1.16 (a)); the lens commands are live-checked by AC-17.14 (c).
- **R4 — lens commands.** Five move into the lens plugin and drop the "lens" prefix: `show`, `configure`, `init`, `kit` and `gate` (D22, D24). The human named `show` and `configure`; `kit` and `gate` were not contradicted and are confirmed at G2 (Q1). `lens-keepalive` does not move (R9).
- **R5 — migration scope and fallbacks (product-owner, 1.1.17).** The migration moves memory folders and rewrites `agent` and the marketplace and plugin keys in the repository's settings files (R10); the lens accepts the `ai-dlc:` prefix for one release; `validate` detects and warns (no memory read fallback); ITEM-125 lists the AC-17.11 and AC-17.12 code; there is no fallback for plugin or marketplace names.
- **R6 — display name and keywords.** "AI-DLC Engineering Team" kept (D20); keywords `specsmd`, `ai-dlc`, `forgeline`, `agentic-sdlc` (D35, D36, supersedes D20's `engine`).
- **R7 — FR-13.** Kept as P3, non-gating research on `engine`, `lens` and `forgeline` (D30, D31, D32; generic names, so a namespace collision with other plugins of the same name is checked too); a clash goes to the human as a new decision (product-owner, 1.1.17).
- **R8 — unit assignment.** Lens parts of AC-17.5, AC-17.11 and AC-17.14 go to the lens, the rest to engine (D14; product-owner, 1.1.17).
- **R9 — keep-alive and init (human, D24).** `lens-keepalive` stays in the engine because keep-alive and auto-handoff are engine features; its command is proposed as the separate skill `/engine:cache-keepalive-lens [on|off]`, name and behaviour confirmed by the human at G2 (Q1); it keeps today's behaviour (toggles the lens setting `keepaliveSection`, answered by the lens hooks module, and reports figures the engine publishes), so it needs the lens plugin. `/engine:init` and `/lens:init` are two separate commands.
- **R10 — migration and settings (human, D25).** The migration rewrites the repository's `.claude/settings.json` and `.claude/settings.local.json` (this settles question Q2 of step 1.1.18). Its user entry point is a skill shipped with the engine plugin, proposed as `/engine:migrate [--dry-run]`, whose name and behaviour are confirmed by the human at G2 (C-7). Planning only: nothing is run or switched in this run.
- **Exemption (product-owner, 1.1.17).** The migration's pure moves (100% similarity, `git mv`) and `init` `.gitkeep` scaffolding are exempt from the single-author rule for `memory-bank/`; content edits are not. ITEM-121 AC-3 (the backlog merge) is a content merge, so it is not exempt: `documentation-writer` writes it, `product-manager` owns its content (D2, D10, C-10).
- **FR-13 retargeted.** ITEM-120 stays a P3 research item, retargeted to `engine`, `lens` and `forgeline` (D30, D31, D32; the generic plugin names carry a namespace-collision risk). The 1.1.8 finding of a similar-named private-beta product, "Forgeline" (single source), is a known risk the research must check.

## Open at G1, answered in spec 001

Each question below is answered or proposed in spec 001; the human's approval at G2 closes it. The last column names the section, and the spec's open item where one remains.

| Id | Question | Owner | Recommended (from 1.1.9) | Spec 001 |
|---|---|---|---|---|
| C-4 | Does `validate` fail when a bank folder is missing on disk, or only check `artifacts` keys and paths? | software-architect | Keys and paths only; `init` creates the folders | §2.3 (keys and paths only) |
| C-5 | Does `validate` check bank frontmatter (bolt id = folder, status values), or is that left to templates and review? | software-architect | Check bolt id = folder and status values only | §4.2 (ids, `status`, bolt `type`) |
| C-7 | Name and behaviour of the migration skill shipped with the engine plugin (D25): a new dedicated skill, or `/engine:workflow upgrade` extended? | software-architect | A skill shipped with the engine plugin. Proposal (system-engineer, D25 favours a new dedicated skill): `/engine:migrate [--dry-run]`, with `workflow upgrade` keeping only the template-key merge; confirmed by the human at G2 | §10.4 (`/engine:migrate`; name O-1) |
| C-8 | Event file format (JSON or Markdown frontmatter), and whether handoff and hand-back records are themselves the events. | software-architect | The records are the events, with typed frontmatter | §8.1 (records are the events, ADR-0011) |
| C-9 | Does "anomaly.ts run.md-only drift" mean the hard-coded `run.md` in the skipped message (`anomaly.ts:263`) and the settings text (`settings.ts:109`)? If not, AC-9.3 changes. | software-architect | Yes | §12 (yes) |
| C-13 | Does `build-copilot.mjs` copy plugin-root files such as NOTICE into `plugins/copilot/engine/`? AC-12.2 needs them there. | software-architect (with research input) | — | §13 (allowlist `ROOT_NOTICES`) |
| C-14 | Remove the stale `.handoff/config.md` (belongs to the third-party `agent-handoff` plugin) in work item 5 (bolt 004), or leave it? No AC needs it; AC-5.5 only requires that ai-dlc never reads it. | work item 5 (agent-manager) | — | §7 (bolt 004 deletes it) |

Rename-round questions from step 1.1.18 (Q2 is resolved, see R10):

| Id | Question | Owner | Recommended (from 1.1.18) | Spec 001 |
|---|---|---|---|---|
| Q1 | Confirm the command name and behaviour of the engine keep-alive command that takes over from `lens-keepalive` (proposed: the separate skill `/engine:cache-keepalive-lens [on|off]`, which keeps today's behaviour of toggling the lens setting `keepaliveSection`, so it depends on the lens plugin; the alternative is to merge it into `/engine:cache-keepalive` or to retire it in favour of `/lens:configure keepaliveSection`, which loses the figures report), confirm the migration skill name `/engine:migrate [--dry-run]` (or give another), and confirm that `lens-kit` becomes `/lens:kit` and `lens-gate` becomes `:gate`. | system-engineer proposes, human confirms at G2 | Proposal at G2 | §11 (`/engine:cache-keepalive-lens` decided, D28; `/engine:migrate` O-1; `/lens:kit`, `/lens:gate` O-5) |
| Q3 | The AC-17.14 spike is the first construction bolt of the engine unit, its lens part (c) goes to the lens unit, and the migration bolt waits for the spike's accepted hand-back. | software-architect | Yes | §16 (decided, D29: bolt 001 first) |
| Q4 | Apply the backlog amendments (documentation-writer writes them), add a documentation-writer stage to ITEM-121 for AC-3, and add FR-17 items once Q3 places the bolts. | product-manager | Apply; ITEM-126 is the placeholder until G3 | task plan and backlog (applied: the plan schedules; ITEM-126 → bolts 001, 009–012) |

## Acceptance criteria

### FR-1: memory-bank layout
- AC-1.1: The contract defines a `memory-bank/` tree with exactly two top-level folders, `product/` and `project/`, and nothing else at that level.
- AC-1.2: The contract has a table that gives each artifact type exactly one path. A tester checks that no type appears twice and no path is shared by two types. The table covers at least:
  - the seven legacy `artifacts` keys;
  - intents, units, stories, bolts and the glossary;
  - research notes, low-level designs, test plans, test and mutation reports, review reports and critiques (the lifecycle-artifact list in `docs-status`).
- AC-1.3: The backlog's home is under `memory-bank/project/` (D10).
- AC-1.4: Run mechanics (handoffs, hand-backs, run state, session handoffs, events) are not in `memory-bank/`. Their home is `execution-plans/` (see FR-5).
- AC-1.5: Reader-facing documentation (every `README.md`, `docs/plugins.md`, user guides, release notes) is not in `memory-bank/`. It stays at its current path under `docs/` or the repo root (D11).
- AC-1.6: The contract has an old-to-new path map. Each of the seven legacy paths maps to exactly one new path, and the migration (FR-11) and the fallback (FR-15) both use this one map.

### FR-2: intent, unit, bolt, story as first-class constructs
- AC-2.1: The contract defines, for intent, unit, bolt and story: an id format, a folder or file name, required frontmatter keys, and allowed status values. Each id format has a worked example.
- AC-2.2: A bolt's `id` equals its folder name, and the contract shows one naming pattern for it. This fixes the specsmd `{BBB}-{unit}` vs `bolt-{unit}-{N}` conflict.
- AC-2.3: One list of bolt types exists in the contract. Every plugin file that names bolt types (agents, skills, templates, `workflow.json`) uses exactly that list. Check: grep for each type id across `plugins/claude/engine/`, and every hit uses only listed ids.
- AC-2.4: One story status vocabulary exists, and every story template and skill uses only those values.
- AC-2.5: The contract says which record is authoritative when the run state's stage status and an artifact's frontmatter `status` disagree. It also gives a worked example.
- AC-2.6: The contract lists every specsmd inconsistency named in 1.1.5 Q1/Q4 and how preview2 resolves each one. That is at least: bolt id vs folder, the bolt-type list, story statuses, run-state vs frontmatter status, and the cascade statuses (`inception-complete` and others).

### FR-3: unit-design and bolt-design stages
- AC-3.1: `node .ai-dlc/workflow.mjs show` on the preview2 default workflow lists a "unit design" stage and a "bolt design" stage in the lifecycles the contract names. For each stage it shows an owner agent, the `produces` artifacts and `critique: true`.
- AC-3.2: Unit design's outputs feed G2, and bolt design's outputs feed G3. The `show` output shows each stage before its gate.
- AC-3.3: The set of gate ids in the preview2 default workflow equals preview1's set (G1-G4 plus release go / no-go). No gate is added or removed. A tester compares the gate lists of both templates.
- AC-3.4: `node .ai-dlc/workflow.mjs validate` passes on the preview2 default template.

### FR-4: bolt types mapped
- AC-4.1: Each bolt type in the AC-2.3 list has a definition giving its ordered stages, the owning agent of each stage, the artifact each stage produces, and the lifecycle(s) it runs in.
- AC-4.2: The lifecycle list is still exactly the eight named lifecycles plus the AAW variants. No lifecycle is added per bolt type.
- AC-4.3: The mapping is recorded in the frozen spec (or an ADR) that passes G2. Any difference from specsmd's types (`ddd-construction-bolt`, `simple-construction-bolt`, `spike-bolt`) is stated there with its reason.
- AC-4.4: A spike bolt produces knowledge artifacts only, and its definition says it produces no production code.

### FR-5: execution-plans/
- AC-5.1: The default `artifacts.handoffs` in the preview2 workflow template points under `execution-plans/`, not `docs/handoffs/`.
- AC-5.2: The `handoff` skill, `agent-invocation`, the orchestrator body (and the generated `AGENTS.md` template) name `execution-plans/` as the home of:
  - the execution plan;
  - handoff records and hand-backs;
  - run state versions;
  - session handoffs.
- AC-5.3: A run has one `execution-plans/` folder (not one per bolt), and the contract defines its naming. The intent, unit and bolt ids the run works on are recorded in the execution plan and in the run state.
- AC-5.4: The contract defines an "execution plan" file (name and required sections) that the orchestrator writes in the run folder before the first spawn.
- AC-5.5: No ai-dlc file reads `.handoff/config.md` or `handoff_dir`. Check: grep in `plugins/` and `tools/` returns nothing (1.1.8 B).

### FR-6: typed events (files and schema, no runtime)
- AC-6.1: An event schema file exists and is installed by `init`. Its type field allows exactly `command`, `handoff`, `handback`, `verdict`, `escalation`.
- AC-6.2: Given a run folder with an event file that matches the schema, `node .ai-dlc/workflow.mjs validate` exits 0.
- AC-6.3: Given an event file whose type is not one of the five, or that lacks a required field, `validate` exits non-zero and its output names the file and the failing field.
- AC-6.4: Tests under `tests/workflow/` cover AC-6.2 and AC-6.3, one per event type plus the invalid cases, and `node --test "tests/**/*.test.mjs"` passes.
- AC-6.5: The change set adds nothing that reads or acts on events except `validate` and agent prose: no daemon, scheduler, timer, watcher, or hook that acts on events. A reviewer checks the diff for new hook entries, `setInterval`/`setTimeout`, file watchers or background processes tied to events and finds none.
- AC-6.6: The orchestrator body says, for each of the five event types, when it writes one and where.

### FR-7: authorship rule and docs-status
- AC-7.1: The rewritten `docs-status` (the `docs-rules` template, `.claude/rules/docs-status.md` and its `.github/instructions/` twin, all identical in body) lists every file under `memory-bank/` in its closed list of documentation.
- AC-7.2: The rule says `documentation-writer` is the only agent that creates, edits or deletes files under `memory-bank/`, and that stage agents return content plus a *Docs update* request instead.
- AC-7.3: Given a hand-back from any agent other than `documentation-writer` whose changed paths include a file under `memory-bank/`, when `code-reviewer` or `brutal-critique` reviews that change, then it raises a finding that names the file and the agent. The severity is Blocker: `code-reviewer` cannot approve and `brutal-critique` returns REVISE. The rule text and the `review` skill state this check.
- AC-7.4: Files under `execution-plans/` are not documentation, and the rule says so. The orchestrator (or teammates in Mode 5) still writes them.
- AC-7.5: The rule defines "done" for a unit or bolt as engineering complete (build, tests, reviews, gates) and knowledge complete:
  - its bank content is written by `documentation-writer`;
  - `brutal-critique` returned PASS on it;
  - no status marker disagrees with the run state.
  The rule includes one worked example where engineering is done and knowledge is not, so the unit is not done.
- AC-7.6: Each stage agent whose skill used to write a lifecycle artifact directly (for example `write-adr`, `spec-driven-development`, `product-planning`, `requirement-analysis` glossary writes) now returns the content to `documentation-writer` instead. A grep of those skills finds no instruction to write under `memory-bank/` themselves.
- AC-7.7: `brutal-critique` critiques every `documentation-writer` change under `memory-bank/` before the owning stage is `done`.

### FR-8: workflow.json, schema, validator, template, init
- AC-8.1: The workflow schema's `artifacts` properties and required list, `workflow.mjs`'s known artifact keys, and the plugin template all agree on one key set. A test fails when they differ.
- AC-8.2: In an empty git repository, running `/engine:init` creates `memory-bank/product/`, `memory-bank/project/` and `execution-plans/` (per the contract) and a `workflow.json` whose `artifacts` use the new paths. Then `node .ai-dlc/workflow.mjs validate` exits 0.
- AC-8.3: The `init` run in AC-8.2 installs the rewritten `docs-status` rule (FR-7) into `.claude/rules/` and `.github/instructions/`.
- AC-8.4: Given a preview1 `workflow.json` (legacy `docs/` paths, no new keys), `validate` exits 0, prints the FR-15 fallback warning, and does not fail on the missing new keys.
- AC-8.5: `validate` fails on an unknown `artifacts` key and on a bank artifact type whose path points outside `memory-bank/`. Tests cover both.

### FR-9: hooks and lens
- AC-9.1: Given a run folder under `execution-plans/` with an active run state, the auto-handoff hook finds and names that run in its session handoff. A test in `hooks/auto-handoff/tests/` covers it.
- AC-9.2: Given the same folder, lens lists the run and its stages, and its anomaly scan reports a blocked step. A test in `plugins/claude/lens/tests/` covers each.
- AC-9.3: Given a run folder holding only `run.v2.md` (no `run.md`) with no front matter, the anomaly scan's skipped message names `run.v2.md`, not `run.md`. The settings text and the code comments that say "run.md" say "run state" instead. A test covers the message.
- AC-9.4: Given only a legacy `docs/handoffs/` run folder, the hook and the lens still read it and emit the FR-15 warning.
- AC-9.5: Both `plugin test` commands pass, and every change under `hooks/auto-handoff/` and `hooks/keepalive/` has an entry in that folder's `ATTRIBUTION.md`.

### FR-10: stale-path sweep with an allowlist
- AC-10.1: A check runs as part of `node --test "tests/**/*.test.mjs"`. It searches these places for each of the seven legacy path prefixes and fails on any hit not on the allowlist:
  - `plugins/claude/engine/` and `plugins/copilot/engine/`;
  - `plugins/claude/lens/`;
  - `tools/templates/`, `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`;
  - `.claude/rules/` and `.github/instructions/`.
- AC-10.2: The allowlist is one explicit file. Each entry is a path (file or glob) with a one-line reason, and it holds only:
  - the fallback-read code (FR-15) and its tests;
  - the migration code (FR-11), its tests and fixtures;
  - reader-facing pages under `docs/` (and READMEs and release notes) that are allowed to name legacy paths, for example the migration guide and the preview2 release notes (D11).
  An entry outside these categories fails code review.
- AC-10.3: With the release branch's content, the check passes. A tester adds `docs/specs/x.spec.md` to any agent file, sees the check fail and name that file and line, then removes it.
- AC-10.4: The check does not flag reader-facing paths that are not legacy prefixes, such as `docs/plugins.md` and `README.md`.

### FR-11: migration (D12: run on this repo before release)
- AC-11.1: A documented migration entry point exists, a skill shipped with the engine plugin (D25; proposed: `/engine:migrate [--dry-run]`; name and behaviour fixed in the contract; see C-7), and is described in a reader-facing guide under `docs/`.
- AC-11.2: Given a preview1 fixture repo with files at all seven legacy paths, after migration:
  - every file is at its mapped path (AC-1.6);
  - the file count of moved artifacts equals the count before;
  - `workflow.json` `artifacts` uses the new paths;
  - `validate` exits 0 with no fallback warning.
- AC-11.3: The migration moves files so that `git log --follow <new path>` shows commits made before the move, for at least one file per artifact type in the fixture.
- AC-11.4: Running the migration a second time on the migrated fixture changes nothing (`git status` clean).
- AC-11.5: Given a fixture where a target path already exists with different content, the migration stops with a non-zero exit and changes nothing (`git status` clean), and its message names the conflicting path.
- AC-11.6: Given a fixture whose `workflow.json` has custom (non-default) `artifacts` paths, the migration moves from those paths, not from the defaults.
- AC-11.7: Given a fixture with both layouts present (legacy `docs/` plus an existing `execution-plans/`, as this repo has today, D8), the migration merges them without overwriting any existing file.
- AC-11.8: Reader-facing docs (AC-1.5) are not moved.
- AC-11.9: Tests for AC-11.2 to AC-11.8 run in `node --test "tests/**/*.test.mjs"` and pass.
- AC-11.10 (D12, P1): Before the release go / no-go, the migration has been run on this repository. After it:
  - no file remains under the seven legacy paths (reader-facing `docs/` pages excepted);
  - `.ai-dlc/workflow.json` uses the new paths;
  - the repo checks pass with no fallback warning in their output.
  The hand-back quotes the migration command and its output.
- AC-11.11 (P1): The migration has a dry-run mode (a flag). Given a fixture, the dry run lists every planned move and every conflict (as AC-11.5 would report them), changes nothing (`git status` clean), and exits 0 when there is no conflict and non-zero otherwise. A test in `tests/` covers it.

### FR-12: attribution
- AC-12.1: `THIRD_PARTY_NOTICES.md` has an entry for fabriqaai/specs.md: MIT, "Copyright (c) 2025 Fabriqa AI", the upstream URL, and the full MIT licence text.
- AC-12.2: The engine plugin contains a NOTICE (or equivalent) and an ATTRIBUTION record. The record lists each plugin file that adapts specsmd material and what was adapted, and it is present in both `plugins/claude/engine/` and the generated `plugins/copilot/engine/`.
- AC-12.3: Every file the contract or later units mark as adapted from specsmd appears in the ATTRIBUTION record. A reviewer compares the two lists and finds no file missing.
- AC-12.4: The release is not tagged while AC-12.1 to AC-12.3 fail (priority P1, licence compliance).

### FR-13: brand-name check (research only)
- AC-13.1: A research report exists as a lifecycle artifact. It covers at least the names in 1.1.8 A, plus `engine`, `lens` (fixed by D32 and D31, with a namespace-collision check against other plugins of the same name) and `forgeline` (fixed by D30, which supersedes D21; the 1.1.8 finding of a private-beta product called "Forgeline" is checked explicitly), and for each one it records:
  - web search findings;
  - USPTO/EUIPO, npm, GitHub org and the Claude Code and Copilot marketplace checks, or states that each was unreachable;
  - a verdict.
- AC-13.2: The report does not decide the name: the release ships the names FR-17 fixes. A tester confirms this: the report's verdicts change no file outside the report itself.
- AC-13.3: The report is not release-gating (P3). Release can proceed with it missing.

### FR-14: release 1.0.0-preview2
- AC-14.1: No preview2 change is merged into the preview1 release line before `1.0.0-preview1` is tagged.
- AC-14.2: The engine plugin's version is `1.0.0-preview2` in `plugins/claude/engine/.claude-plugin/plugin.json`, in the generated Copilot manifest and in both marketplace entries.
- AC-14.3: The release hand-back quotes the five repo checks plus `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/engine` and `… --strict .`, each with output showing success.
- AC-14.4: Release notes under `docs/` (D11) describe:
  - the layout move;
  - the migration entry point;
  - the one-release fallback and its removal in 1.0.0;
  - that it is a breaking release;
  - the plugin rename to `engine`, the marketplace rename to `forgeline` and the lens command renames, with the upgrade steps and the stored-data warning (AC-17.8).
- AC-14.5: The backlog in `memory-bank/project/` has milestone `1.0.0-preview2` with every work item Done (work item 10, ITEM-120, excepted: P3), and has an item for removing the fallback in 1.0.0.
- AC-14.6: G4 is approved by the human and go / no-go is recorded by `product-owner` in the run state before the tag.
- AC-14.7: End to end: a fresh `init` repo (AC-8.2) and a migrated preview1 repo (AC-11.2) each complete one documented smoke walk-through with no error. The `sqa-engineer` hand-back quotes the steps and output.

### FR-15: one-release read fallback with a warning
- AC-15.1: Given an artifact type whose new path does not exist and whose legacy path does, `workflow.mjs`, the auto-handoff hook and the lens read the legacy path and behave as preview1 did.
- AC-15.2: An invocation that read or ignored at least one legacy path emits exactly one warning, however many files it read. An invocation is one CLI command, one hook firing, or one lens scan.
- AC-15.3: The warning names:
  - each legacy root used;
  - the new path it maps to;
  - the migration entry point (AC-11.1);
  - that the fallback ends in 1.0.0.
  - when a legacy path was ignored because the new path exists, the warning names the ignored legacy root and the migration entry point.
- AC-15.4: Where each warning appears:
  - `workflow.mjs`: on stderr, and the exit code is unchanged by the warning.
  - Hook and lens: the channel each already uses for non-blocking notices (fixed in the contract).
  - Never: as a blocking error.
- AC-15.5: An invocation that neither reads nor ignores any legacy path emits no warning.
- AC-15.6: When both the new and the legacy path exist for a type, the new path is read, and one warning says the legacy path is ignored.
- AC-15.7: Tests cover AC-15.2 (two legacy reads in one invocation give one warning), AC-15.5 and AC-15.6 for `workflow.mjs`, the hook and the lens.
- AC-15.8: Every fallback code path carries a marker comment the contract defines, for example `fallback: remove in 1.0.0`, so a grep finds them all. The AC-14.5 backlog item lists those files.

### FR-16: Copilot parity and boundaries
- AC-16.1: `node tools/build-copilot.mjs --check` passes on the release branch.
- AC-16.2: Every new skill in `engine` that works only in Claude Code is listed in `tools/claude-only-skills.json`. No skill in that list is present in `plugins/copilot/engine/`. The lens command skills live in `plugins/claude/lens/skills/` and are not listed there; the engine keep-alive skill (D24) is Claude-only and stays listed (AC-17.13). the `lens` plugin stays in `tools/claude-only-plugins.json` and only in `.claude-plugin/marketplace.json`.
- AC-16.3: The agents and generic skills added or changed in preview2 contain no stack-specific terms (`dotnet`, NuGet, Stryker, C#, TypeScript, `npm`) outside a stack-routing table. A reviewer greps the changed files.
- AC-16.4: No `.ai-dlc/` path or `AI_DLC_*` variable is renamed or removed. Check: the diff against `47a3480` shows no such rename or removal. The plugin names (`engine`, `lens`; D32 and D31 supersede the "`ai-dlc-lens` plugin name unchanged" of D16), prefixes, marketplace name, lens command names and lens pane ids (`lens-*`, D33, D37) are covered by FR-17.
- AC-16.5: `node tools/validate.mjs` passes (harness sync and all `plugin validate --strict` runs).

### FR-17: rename the plugin, the marketplace and the lens commands (planned; amendment approved, D26)
Old-name patterns are defined under Conventions. Parts for the lens unit are marked "(lens)" (D14).
- AC-17.1: The plugin `name` is `engine` in `plugins/claude/engine/.claude-plugin/plugin.json` and in the generated Copilot manifest. Both keep `displayName` "AI-DLC Engineering Team", and their `keywords` are `specsmd`, `ai-dlc`, `forgeline` and `agentic-sdlc` (D35, D36). Both marketplace files are named `forgeline` (D30, supersedes D21) and list `engine` with `source` at the renamed folder. The Claude marketplace also lists `lens`; the Copilot one does not.
- AC-17.2: These pass, each quoted with its real output: `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/engine`; `… --strict .`; `… --strict ./plugins/claude/lens`; `node tools/build-copilot.mjs --check`; `node tools/validate.mjs`. None of `plugins/claude/ai-dlc/`, `plugins/copilot/ai-dlc/` and `plugins/claude/ai-dlc-lens/` exists.
- AC-17.3: A check in `node --test "tests/**/*.test.mjs"` fails on any old-name hit that is not on the allowlist. It searches `plugins/claude/engine/`, `plugins/copilot/engine/`, `plugins/claude/lens/`, `tools/`, `tests/`, `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.claude/rules/`, `.github/instructions/`, `.claude/skills/`, `.claude/settings.json`, both marketplace files, `README.md` and `docs/`. It does not flag `.ai-dlc/`, `AI_DLC_`, `lens`, `engine`, `forgeline` or `ai-dlc-agent-workflow-plugin`, except the half-renamed lens forms. A tester puts `ai-dlc-engine:orchestrator` in an agent file and sees the check fail. A tester puts `Agent("ai-dlc:orchestrator")` in an agent file and sees the check fail naming the file and line; `/ai-dlc:lens-gate` in a skill fails; `lens:gate` is not flagged.
- AC-17.4: The check uses the FR-10 allowlist file. Entries exist only for: (a) migration code, tests and fixtures; (b) the lens agent-type prefix fallback (AC-17.11) and its legacy pane-id list (D33, D37), the `validate` detect-and-warn code (AC-17.12) and their tests; (c) reader-facing rename pages, that is the migration and upgrade guide and the preview2 release notes, the only places where `ai-dlc-agent-workflow`, `ai-dlc@…` install ids and `/ai-dlc:lens*` may appear; (d) history: `docs/handoffs/` only (the other history paths are outside the AC-17.3 search scope). Any other entry fails code review.
- AC-17.5 (engine): The hooks-module command constants are `engine:cache-keepalive`, `engine:cache-keepalive-configure` and the engine keep-alive command that replaces `lens-keepalive` (D24; proposed: the separate skill `cache-keepalive-lens`, so the third constant is `engine:cache-keepalive-lens`; name confirmed by the human at G2, Q1; if the human chooses at G2 to merge it into `cache-keepalive`, no third constant exists and AC-17.13 applies to `cache-keepalive`). A test asserts that each equals its skill's namespaced name. `npx @anthropic-ai/claude-code plugin test ./plugins/claude/engine` passes. Each changed hooks folder has an `ATTRIBUTION.md` entry. The lens side of this AC (the lens's use of these names) goes to lens.
- AC-17.6: `init` writes `"agent": "engine:orchestrator"` and creates `.claude/agent-memory/engine-<agent>/` (the pattern is confirmed by AC-17.14). `manage-memory`, `agent-management` and the build's Copilot platform note name it. AC-17.3 passes.
- AC-17.7: `workflow.mjs catalog` records the plugin name `engine`. `validate` exits 0 on the preview2 default template. The agent ids in `workflow.json` stay bare.
- AC-17.8: The README, `docs/plugins.md`, the `CLAUDE.md` dev setup, both plugin READMEs, the lens README and MANUAL-CHECKS, and the upgrade guide show `/plugin install engine@forgeline`, `copilot plugin install engine@forgeline`, `claude plugin install engine@forgeline --scope local`, `lens@forgeline` and the `/lens:*` commands. The upgrade steps from preview1 are: 1 remove marketplace `ai-dlc-agent-workflow` (and the plugin); 2 add `forgeline`; 3 install `engine` (and `lens`); 4 run the migration skill (D25). The guide also has a warning before step 1 that removing a marketplace deletes the plugin's stored data and settings, a note that managed `enabledPlugins` need an administrator's edit, and the old-to-new lens command table, which shows that keep-alive stays an engine command. AC-17.3 passes over these files, with category (c) of AC-17.4 the only exception.
- AC-17.9 (dogfood): Before go / no-go the migration has run on this repository. No `.claude/agent-memory/ai-dlc-<plugin-agent-id>/` remains; each `engine-<id>/` holds every file of the old folder; `.claude/settings.json` has `"agent": "engine:orchestrator"`, the `forgeline` marketplace key and no `ai-dlc-agent-workflow` key (the migration skill rewrote them, D25); the repo checks pass; the hand-back quotes the command and its output.
- AC-17.10: Given a fixture with `ai-dlc-<id>/` memory folders, `"agent": "ai-dlc:orchestrator"`, and `extraKnownMarketplaces` and `enabledPlugins` keys under `ai-dlc-agent-workflow` in `.claude/settings.json` and `.claude/settings.local.json`: (a) each folder moves, the file count is equal, and `git log --follow` keeps the history of at least one file; (b) `agent` is rewritten; (c) project-local and non-plugin `ai-dlc-*` folders are untouched; (d) a second run changes nothing; (e) when both folders exist, identical same-name files are deduplicated, and a differing same-name file gives a non-zero exit, no change, and a message naming both paths, with `MEMORY.md` lines merged as a union; (f) a dry run lists every move, rewrite and conflict, changes nothing, and is non-zero only on a conflict; (g) the marketplace key becomes `forgeline` and the plugin keys become `engine@forgeline` and `lens@forgeline`, other plugins' keys and the `repo` value are untouched, and an absent `settings.local.json` is skipped without error; (h) permission and other string values carrying an `ai-dlc:<id>` prefix (for example `Skill(ai-dlc:init)`) are rewritten by the prefix rules of spec §10; (i) a fixture with `"ai-dlc@<other>"` (any marketplace other than `ai-dlc-agent-workflow`) is not rewritten, `migrate` prints one `advice:` line for it, and the prefix rules are not applied to that file ((h) and (i) added after critique 1.5.l3.7; approved at G2). Tests in `tests/` cover (a) to (i), through the entry point of the migration skill (D25).
- AC-17.11 (lens): For one release the lens recognises agent types and run-record workers that carry `ai-dlc:` or `engine:` and shows the same agent. Pre-rename run records display unchanged. A lens test covers both prefixes. The code carries `fallback: remove in 1.0.0`.
- AC-17.12: `validate` emits exactly one warning per invocation when a `.claude/agent-memory/ai-dlc-<plugin-agent-id>/` folder exists or the `agent` in `.claude/settings.json` starts with `ai-dlc:`. The warning goes to stderr and the exit code is unchanged (AC-15.4). It names what it found and the migration skill (D25). There is no warning otherwise. Tests cover both cases. The code carries the fallback marker.
- AC-17.13 (lens, D22, D24): Each of `show`, `configure`, `init`, `kit` and `gate` has a `SKILL.md` in `plugins/claude/lens/skills/<name>/`. No `lens*` skill remains under `plugins/claude/engine/skills/`, and there is no `keepalive` skill in the lens plugin. `tools/claude-only-skills.json` lists none of the five, and none is in `plugins/copilot/engine/`. The lens hooks module registers exactly the five lens commands `lens:show`, `:configure`, `:init`, `:kit` and `:gate`, and a test asserts that each equals `lens:<skill folder name>`; it additionally answers the engine keep-alive command (proposed `engine:cache-keepalive-lens`), which is not a lens skill and is excluded from that folder-name test. The keep-alive command that replaces `lens-keepalive` is an engine skill (D24; proposed: `cache-keepalive-lens`, name confirmed by the human at G2, AC-17.5; if merged, `cache-keepalive` itself). It keeps today's behaviour: it shows or hides keep-alive in the lens Cache Lab by toggling the lens setting `keepaliveSection` in `.ai-dlc/lens.json`, which the lens hooks module answers, and it reports figures the engine publishes, so it depends on the lens plugin being installed. It is listed in `tools/claude-only-skills.json` and absent from `plugins/copilot/engine/`. `/engine:init` and `/lens:init` both exist as separate commands. No `/ai-dlc:lens*` command is registered or aliased. `plugin test ./plugins/claude/lens` and `plugin validate --strict ./plugins/claude/lens` pass, quoted. The lens opens its panes as `lens-kit`, `lens-edge`, `lens-agent`, `lens-chart` and `lens-runs` (D33, D37) and at load closes any pane open under an old `ai-dlc-lens*` id; a test covers both.
- AC-17.14 (spike, runs first): The first construction bolt is a spike, and the migration bolt does not start before its hand-back is accepted. It runs live in Claude Code with a scratch marketplace under `.scratch/`. The hand-back quotes the commands, the output and the Claude Code version, and records: (a) which `.claude/agent-memory/` folder a `memory: project` agent of a plugin named `engine` writes; (b) what happens to the installed plugin, its `enabledPlugins` entries and its stored data and settings when marketplace `ai-dlc-agent-workflow` is removed, `forgeline` is added and the plugin is reinstalled; (c, lens) whether `/lens:show`, run from a skill in the lens plugin, reaches the command the lens hooks module registered; and (d)–(i) as listed in spec §16 (bolt 001). If (a) differs from `engine-<agent>`, the folder pattern in AC-17.6, 17.9, 17.10 and 17.12 is replaced with the observed one through spec-driven-development before the migration bolt. If (b) contradicts AC-17.8, AC-17.8 is corrected the same way. If (c) fails, it goes to the human. In every case the human is told.

## Glossary (draft — fixed in spec 001 at G2)

- **Intent**: a top-level body of product work with one problem statement, goals and FRs, approved at G1 (for example intent 001, preview2). Avoid: epic, project.
- **Unit**: a lasting slice of the product, named in the registry `memory-bank/product/units.md` (D27, D34; ADR-0016), that any intent can touch. An intent assigns its FRs to the units it touches; an FR that spans both is split by file ownership (the intent's `units.md`, *Split rule*). Avoid: module, component (in this sense).
- **Story**: a user-facing, testable piece of a unit, with ACs. It is delivered by one bolt. Avoid: task, ticket.
- **Bolt**: a bounded execution slice of a unit that delivers one or more stories through the stages of its bolt type, run in the order of the lifecycle's `after` edges. Avoid: sprint, iteration.
- **Bolt type**: the stage subset a bolt follows, `construction-bolt`, `simple-bolt` or `spike-bolt` (`boltTypes`, ADR-0012). It picks stages inside an existing lifecycle and is not a lifecycle itself.
- **Stage**: one step of a lifecycle or bolt type with an owner agent, inputs, `produces` outputs and optionally a gate or critique.
- **Lifecycle**: one of the eight named workflows (plus AAW) that orders stages and gates. Unchanged in preview2.
- **Execution plan**: the per-run file in `execution-plans/<run>/` that the orchestrator writes before the first spawn. It lists the stages, agents, waves and gates it will run.
- **Run**: one execution of a lifecycle, with its own folder under `execution-plans/`, its run state versions and its records.
- **Event**: a typed record file in a run folder, one of `command`, `handoff`, `handback`, `verdict`, `escalation`, checked against the event schema by `validate`. It is never acted on by a runtime.
- **Memory bank**: the `memory-bank/` tree that holds a repository's knowledge. Only `documentation-writer` writes it. It counts as documentation.
- **Memory bank product** (`memory-bank/product/`): knowledge about what the product is and does (intents, units, stories, specs, ADRs, narratives, glossary).
- **Memory bank project** (`memory-bank/project/`): knowledge about how the work is run: the backlog with its out-of-scope records, task plans, research notes, quality reports and standards.
- **Engineering state / knowledge state**: the two halves of "done". Engineering is build, tests, reviews and gates. Knowledge is the bank content being current, written by `documentation-writer`, passed by `brutal-critique`, and with statuses that match the run state.
- **Legacy path**: one of the seven preview1 `docs/` artifact defaults. It is read only through the fallback until 1.0.0.
- **engine**: the plugin that was named `ai-dlc` before preview2 (D32; `ai-dlc-engine` was never shipped). Avoid: "ai-dlc plugin".
- **lens**: the Claude-only live-view plugin, named `ai-dlc-lens` before D31 (D31; `ai-dlc-lens` as a plugin name never ships).
- **forgeline**: the marketplace, named `ai-dlc-agent-workflow` before preview2 (D30).
- **Family names**: `.ai-dlc/` and `AI_DLC_*`, shared by the engine and the lens and not renamed (D16).
