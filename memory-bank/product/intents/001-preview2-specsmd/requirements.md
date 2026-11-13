# Intent 001 — preview2: specsmd memory bank, units/bolts, execution plans with typed events

Status: planned (G1 approved 2026-11-13; FR-17 amendment approved 2026-11-13, D26; the D30–D37 name amendments are approved at G2, O-15). Release: 1.0.0-preview2 (breaking; preview1 ships first, D7).
Owner: product-owner. Acceptance criteria: [acceptance-criteria.md](acceptance-criteria.md).
Sources: decisions D1–D37 ([decisions-2026-11-13.md](../../../../execution-plans/AI-DLC-20261113-preview2-specsmd/decisions-2026-11-13.md)),
work breakdown ([1.1.6-work-breakdown.md](../../../../execution-plans/AI-DLC-20261113-preview2-specsmd/1.1.6-work-breakdown.md)),
specsmd (fabriqaai/specs.md, MIT); the rename amendment (FR-17) from steps 1.1.13, 1.1.17 and 1.1.18 of the same folder; the proposed keep-alive and migrate names from [1.1.19.1-system-engineer-to-orchestrator.handback.md](../../../../execution-plans/AI-DLC-20261113-preview2-specsmd/1.1.19.1-system-engineer-to-orchestrator.handback.md). The 13 work items of the breakdown are items ITEM-111 to ITEM-123 (work item N is ITEM-(110+N))
in [the backlog](../../../project/backlog.md).

## Problem
Run mechanics and product knowledge are mixed under `docs/` (specs, stories, ADRs, backlog, handoffs). There is no
first-class vocabulary for intents, units and bolts, and no typed record of the orchestrator's commands, handoffs,
handbacks, verdicts and escalations. Authorship of documents is split between stage agents, so what counts as
"done" for knowledge is unclear.

## Users
- Humans who approve gates G1-G4 and read the product knowledge.
- The AI-DLC agents, which read and write the artifacts.
- Maintainers of target repositories on preview1, who must be able to move.

## Outcomes and success measures
1. A target repository keeps its knowledge in one `memory-bank/` (`product/`, `project/`); each artifact type has one home.
   Measure: layout contract exists; `init` creates it; validate checks it.
2. Work is planned as intents, units and bolts with a fixed vocabulary, ids and status model.
   Measure: unit design and bolt design are lifecycle stages with owners, outputs and critique; feeds G2/G3.
3. Run mechanics live in `execution-plans/` with typed events (command, handoff, handback, verdict, escalation).
   Measure: event schema exists; events are files checked by `workflow.mjs validate`.
4. One authorship rule: stage agents own content; only documentation-writer writes memory-bank files;
   brutal-critique gates. Done = engineering state and knowledge state both complete.
   Measure: `docs-status` rewritten; reviews flag a bank file written by any other agent.
5. Existing repositories can move without losing history.
   Measure: documented, tested migration; one-release read fallback with a warning.

## Functional requirements
FR-1 memory-bank layout (product/, project/ incl. backlog); one home per artifact type; old-to-new path map.
FR-2 intent, unit, bolt as first-class constructs: vocabulary, ids, frontmatter, status model (specsmd inconsistencies fixed).
FR-3 unit-design and bolt-design stages in the lifecycles (owners, outputs, gates, critique); feed G2/G3; no new gates.
FR-4 bolt types defined; their relation to lifecycles and agents (including the product-owner preference in Open questions) decided at G2.
FR-5 execution-plans/: one folder per run (not per bolt): the execution plan, handoffs, handbacks, run state and session handoffs. The execution plan and the run state record the intent, unit and bolt ids the run works on; bolt ids are entries, not folders.
FR-6 typed events (command, handoff, handback, verdict, escalation): schema + files, checked by validate; no runtime.
FR-7 authorship rule; a memory-bank tree is documentation; docs-status rewritten; done = engineering + knowledge.
FR-8 workflow.json `artifacts`, schema, validator, template and `init` express the new paths.
FR-9 auto-handoff hook and the lens read the new paths and file names; anomaly.ts run.md-only drift fixed.
FR-10 agent, skill, rule, template and generated prose cite the new paths; no stale `docs/...` references.
FR-11 migration of existing repositories (docs/ to memory-bank/, docs/handoffs/ to execution-plans/), documented and tested. Its user entry point is a skill shipped with the engine plugin (D25; proposed: the skill `/engine:migrate [--dry-run]`; name and behaviour confirmed by the human at G2); it also rewrites the repository's settings files (FR-17).
FR-12 attribution for adapted specsmd material (NOTICE, THIRD_PARTY_NOTICES, ATTRIBUTION; MIT, Copyright 2025 Fabriqa AI).
FR-13 brand-name clash check as research only (P3, non-gating), covering `engine`, `lens` and `forgeline` (D30, D31, D32; `engine` and `lens` are generic plugin names, so the research also checks a namespace collision with other plugins of the same name; the 1.1.8 finding of a similar-named private-beta product, "Forgeline", is checked explicitly); a clash goes to the human as a new decision. The rename is FR-17.
FR-14 release 1.0.0-preview2: tests, build --check, validate, plugin tests pass; docs and backlog updated; release gate.
FR-15 fallback: preview2 reads old docs/ paths with a warning; dropped in 1.0.0.
FR-16 Copilot parity: changes projected by the build and `--check` passes; Claude-only items stay listed as such;
      agents and generic skills stay language-agnostic; `.ai-dlc/` and `AI_DLC_*` unchanged (the lens pane ids follow the plugin name, `lens-*`, D33, D37); the plugin names (`engine`, `lens`; D31, D32
      supersede D16 for the lens name), prefixes, marketplace and lens command names change only as FR-17 says.
FR-17 rename (planned; amendment approved, D26, D15-D25, D31, D32). Renames the `ai-dlc` plugin to `engine` (D32) and the marketplace
      `ai-dlc-agent-workflow` to `forgeline`, and moves the lens commands into the lens plugin, which is named `lens` (D31; it was `ai-dlc-lens`) (reverses D4 for these names).
      Both renames ship in 1.0.0-preview2 as one clean break (D23). Covers both platforms: the Claude plugin and marketplace, and the
      generated Copilot plugin and marketplace. What changes:
  - **Plugin name.** `name` becomes `engine`; `ai-dlc:<name>` becomes `engine:<name>` and `/ai-dlc:<skill>` becomes `/engine:<skill>` (`claude --agent engine:orchestrator`). The lens plugin is named `lens` (D31), folder `plugins/claude/lens/`.
  - **Plugin folders.** `plugins/claude/ai-dlc/` becomes `plugins/claude/engine/`; the generated `plugins/copilot/ai-dlc/` becomes `plugins/copilot/engine/` (D19).
  - **Marketplace name.** Both marketplace files are named `forgeline` (D30, supersedes D21). Install ids: `engine@forgeline` and `lens@forgeline`.
  - **Manifest fields.** The display name stays "AI-DLC Engineering Team"; the keywords keep `ai-dlc` and add `engine` (D20).
  - **Hooks-module command names.** `engine:cache-keepalive` and `engine:cache-keepalive-configure`, plus the engine keep-alive command that takes over from `lens-keepalive` (D24): proposed `engine:cache-keepalive-lens`, a separate skill, name confirmed by the human at G2 (see the lens table below).
  - **Init commands (D24).** The engine and the lens each have their own: `/engine:init` (today's `/ai-dlc:init`) and `/lens:init` (today's `/ai-dlc:lens-init`) are two separate commands.
  - **Lens commands (D22, D24).** Five of the six `lens*` skills move to `plugins/claude/lens/skills/` and lose the "lens" prefix. The sixth, `lens-keepalive`, does not move: keep-alive and auto-handoff are engine features, so it becomes an engine command:

    | Old command | New command |
    |---|---|
    | `/ai-dlc:lens` | `/lens:show` |
    | `/ai-dlc:lens-configure` | `/lens:configure` |
    | `/ai-dlc:lens-init` | `/lens:init` |
    | `/ai-dlc:lens-kit` | `/lens:kit` |
    | `/ai-dlc:lens-keepalive` | stays in the engine as an `engine` skill. Proposed: `/engine:cache-keepalive-lens [on|off]`, a separate skill, not merged into `/engine:cache-keepalive` or `:cache-keepalive-configure`; name and behaviour confirmed by the human at G2. It keeps today's behaviour: it shows or hides keep-alive in the lens Cache Lab by toggling the lens setting `keepaliveSection` in `.ai-dlc/lens.json` (the lens hooks module answers it) and reports figures the engine publishes, so it still needs the lens plugin |
    | `/ai-dlc:lens-gate` | `/lens:gate` |

    The human named `show` and `configure` (D22), and said that the engine and the lens each have their own init and that keep-alive and auto-handoff belong to the engine (D24). `kit` and `gate` follow the D22 pattern and were not contradicted; the human confirms them at G2 with the keep-alive command name and behaviour (open question Q1 in the acceptance criteria).
    The five lens skills leave `tools/claude-only-skills.json` (the lens plugin as a whole is Claude-only). The engine keep-alive skill is Claude-only and stays listed there. The lens hooks module registers exactly the five new lens command names, and additionally answers the engine keep-alive command (proposed `engine:cache-keepalive-lens`), which is not a lens skill.
  - **Lens prefix handling.** The lens recognises `engine:` and also accepts `ai-dlc:` for one release (AC-17.11).
  - **Agent memory folders.** `.claude/agent-memory/ai-dlc-<agent>/` becomes `.claude/agent-memory/engine-<agent>/`. The platform does not document the
    pattern, so a spike confirms it first (AC-17.14).
  - **Settings `init` writes.** `"agent": "engine:orchestrator"`.
  - **Every other reference.** Agents, skills, templates, generated files, tools, tests, rules and instructions, `AGENTS.md`, `CLAUDE.md`,
    `.github/copilot-instructions.md`, `.claude/settings.json` (`agent`, permission paths, the `extraKnownMarketplaces` key) and reader-facing docs.
  - **Migration (D25).** The FR-11 migration (same entry point and dry run), in installed repositories and in this one, moves the memory folders, rewrites `agent`,
    and rewrites the marketplace and plugin keys (`extraKnownMarketplaces`, `enabledPlugins`) in the repository's `.claude/settings.json` and
    `.claude/settings.local.json` when present. User-scope and managed settings are not touched: the upgrade guide covers them, and managed
    `enabledPlugins` need an administrator. The user entry point is a skill shipped with the engine plugin; proposed: `/engine:migrate [--dry-run]`; its name and behaviour are confirmed by the human at G2 (D25).
  - **Upgrade path (D23).** There is no alias for a renamed plugin or marketplace, so no fallback for those names nor for the old `/ai-dlc:lens*` commands.
    Upgrade: remove marketplace `ai-dlc-agent-workflow`, add `forgeline`, install `engine` (and `lens`), run the migration. The guide warns that
    removing a marketplace deletes the plugin's stored data and settings.
  - **First construction bolt.** A spike tests the rename live, the memory-folder pattern and the moved lens commands before the migration bolt (AC-17.14).
  - **Unit assignment (D14).** Lens parts (AC-17.11, the lens skills of AC-17.13, the lens side of AC-17.5 and AC-17.14 (c)) go to the lens; the rest, including the engine keep-alive command (D24) and the migration skill (D25), goes to the engine.
  - **Lens pane ids (D33, D37).** `ai-dlc-lens-*` become `lens-*` (a pane id cannot contain `:`); the lens closes panes left open under the old ids.
  - **Does not change.** `.ai-dlc/` (including `.ai-dlc/lens.json`) and `AI_DLC_*` (D16); the GitHub
    repository name and URL (later, D17); bare agent ids in `workflow.json`; project-local memory folders (`.claude/agent-memory/<agent>/`); the "AI-DLC" lifecycle name.

## Scope
In: everything above. Dogfood: this repo's preview2 planning artifacts live in memory-bank/ and execution-plans/ now (D8).
Out: deterministic runtime/scheduler; GitHub repository rename; renaming `.ai-dlc/` or `AI_DLC_*`; aliases for old plugin, marketplace or lens command names; specsmd runtime scripts as dependencies; specsmd ideation/FIRE/simple
flows and its operations flow beyond mapping to our release/DevOps stages; changes to preview1.

## Decisions
- 2026-11-13 (D11): reader-facing documents (README.md files, `docs/plugins.md`, user guides, release notes) stay in
  `docs/`; lifecycle knowledge moves to `memory-bank/`. documentation-writer authors both.
- 2026-11-13 (D12): work item 11 (ITEM-121) (migrate this repo's legacy `docs/` history) must ship in preview2, priority P1.
- 2026-11-13 (D15-D23): plugin renamed to `ai-dlc-engine` (D15; renamed `engine` by D32) and marketplace to `ai-dlc-suite` (D21; renamed `forgeline` by D30), both in preview2 (one clean break, reinstall); plugin folders
  renamed; display name kept, keyword added; lens commands moved into the lens plugin without the `lens` prefix (the plugin `ai-dlc-lens` of D16 is renamed `lens` by D31); `.ai-dlc/` and `AI_DLC_*` kept; repository rename later.
- 2026-11-13 (D31, D32): the plugins are named `engine` and `lens` (human: `engine@forgeline`, `lens@forgeline`). Prefixes `engine:`, commands `/lens:*`, memory folders `engine-<agent>/`, folders `plugins/*/engine/` and `plugins/claude/lens/`, unit slugs `engine` and `lens`. `ai-dlc-engine:` and `ai-dlc-lens:` never ship and are old-name patterns.
- 2026-11-13 (D24): the engine and the lens have separate `init` commands; `lens-keepalive` stays in the engine (keep-alive and auto-handoff are engine features), proposed name `/engine:cache-keepalive-lens [on|off]`, confirmed by the human at G2, with today's behaviour kept; `kit` and `gate` go to the lens.
- 2026-11-13 (D25): the migration rewrites the repository's `.claude/settings.json` and `.claude/settings.local.json`, and its entry point is a skill shipped with the engine plugin (proposed: `/engine:migrate [--dry-run]`, confirmed by the human at G2). Planning only: nothing is run in this run.

## Findings
- `.handoff/config.md` is a stale leftover of the third-party `agent-handoff` plugin; no ai-dlc source under `plugins/` or
  `tools/` reads it (source: `execution-plans/AI-DLC-20261113-preview2-specsmd/1.1.8-research-assistant-to-orchestrator.handback.md`, part B).

## Priorities
P0 work item 1 (contracts and ADRs). P1 work items 2-9, 11, 12, 13 (work item 11 must ship in preview2). P3 work item 10 (brand research). FR-17 P1 (release-gating).

## Definition of done (preview2)
- Every FR has numbered, testable ACs accepted at G1; the frozen spec passes G2; the task plan passes G3.
- Per unit: engineering complete (build, tests, reviews) and knowledge complete (bank content current, written by
  documentation-writer, critiqued by brutal-critique, statuses match run state).
- Repository checks pass, quoted by the owning agents: `node --test "tests/**/*.test.mjs"`,
  `node tools/build-copilot.mjs --check`, `node tools/validate.mjs`, `plugin test` for the engine and lens plugins.
- A fresh `init` and a migrated preview1 repository both work end to end; fallback warns once per invocation (AC-15.2).
- Work item 11 (ITEM-121): this repository's legacy `docs/` history migrated (AC-11.10, D12).
- The rename (FR-17) is complete, the spike (AC-17.14) is recorded, and this repo is migrated (AC-17.9).
- Attribution files updated; release notes written; no open P0; G4 approved; release go/no-go by product-owner.

## Open questions
- Bolt-type mapping details: decided at G2 (PO preference: do not map bolt types one-to-one to lifecycles; a bolt's type
  picks the stage template inside a lifecycle; the architect verifies the specsmd bolt type list).
