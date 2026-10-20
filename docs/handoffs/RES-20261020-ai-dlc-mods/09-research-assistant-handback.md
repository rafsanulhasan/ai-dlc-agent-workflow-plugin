# Hand-back 09: research-assistant — cluster I-plugin-fit

Stored verbatim on 2026-10-20 (work item RES-20261020-ai-dlc-mods).

---

I couldn't find a built-in answer to any of the 17 requirements in the repo. Most of them map onto a seam that already exists: the `run.md` run state, the `workflow.json` schema with `workflow.mjs`, the `handoff` skill, agent `model:` frontmatter, or the worktree hooks. There is also a problem the approved plan doesn't mention: a second plugin folder under `plugins/claude/` breaks the Copilot build as it is called today (see "Second plugin" below).

Sources: codebase only, read-only, no web. Confidence: High for what exists (every claim cites path:line); Medium for where things should plug in, which is my inference.

## Requirement map

| R# | What exists (path:line) | Where a new mod would plug in | Overlap with the ai-dlc-lens plan |
|---|---|---|---|
| R1 auto-handoff at 70% | The `handoff` skill has a *Session handoff (mid-stage)* section for "context window is nearly full" (`plugins/claude/ai-dlc/skills/handoff/SKILL.md:201-238`); the note goes to scratch, *Next action* to `run.md` (`:206-208`). Nothing measures context usage. | A context-threshold hook in the new plugin that triggers that procedure. ai-dlc stays hook-free (`docs/handoffs/FEAT-20261020-ai-dlc-lens/00-approved-plan.md:254`). | Partial. The plan lists auto-handoff mods as "buy" (`00-approved-plan.md:46`) and doesn't build one. |
| R2 weekly limit → other account/provider | Nothing. Closest: a session handoff when "work moves to another machine or tool" (`handoff/SKILL.md:203`), plus the Copilot projection (`tools/build-copilot.mjs:1-9`). | Limit meter, then a session handoff, then resume on Copilot or another account from `run.md`. | No. Limit bars are "buy" (hourglass, quota-meter; `00-approved-plan.md:97`, `:131`). |
| R3 cache keep-alive | Nothing in the plugin. | New plugin only. | No. cache-keeper and cache-timer are listed as buy (`00-approved-plan.md:98`). |
| R4 auto model/effort | Fixed `model:` per agent: opus or sonnet (e.g. `agents/orchestrator.md:5`, `agents/software-engineer.md:4`); the convention is aliases only (`skills/plugin-management/SKILL.md:52`). Repo-wide `effortLevel: medium` and `ANTHROPIC_MODEL: opus` (`.claude/settings.json:4,6`). No per-stage effort. | The orchestrator's spawn brief (`skills/agent-invocation/SKILL.md`) or a routing field in `workflow.json`. | Indirect. Option B's per-agent cost is meant to "choose a cheaper model per agent" (`00-approved-plan.md:172,187`). |
| R5 context/cache/waste bar | Nothing. OTEL is turned on but nothing reads it (`.claude/settings.json:9-10`; `00-approved-plan.md:20`). | New plugin: `$.ui.status` plus pane. | Yes. WI-6 builds the pane, status line and per-agent ledger (`00-approved-plan.md:240`). Plain context/cache meters are Option C, rated "buy, not worth it" (`:131,141,173`). |
| R6 live review pane approve/reject | The G4 gate approves the review report, human approver (`.ai-dlc/workflow.json:25-29`); gate decisions are recorded in `run.md` (`handoff/SKILL.md:169-173`). Today approval is a chat reply. | A pane that writes the gate decision into `run.md`. | Partial. Gate alert (WI-5) and pane (WI-6) are planned, but only as display and notification, not an approve/reject action (`00-approved-plan.md:239-240`). |
| R7 quality gate for SQA / brutal-critique | brutal-critique returns PASS/REVISE; code-reviewer approves only at zero Blockers (`agents/code-reviewer.md:14`). The AAW review loops share a round budget of 3 (`.ai-dlc/workflow.json:432-468`), enforced in `workflow.mjs:335-352`. sqa-engineer runs mutation tests (`workflow.json:196-206`). | A hook or pane that shows verdicts and round N/3 from hand-backs and `run.md`. | Partial. The pane shows "loop round N/3" (`00-approved-plan.md:128`). Quality-gate mods are "buy" (`:50-58`). |
| R8 blast radius pane | Only the term in task-triage (`skills/task-triage/SKILL.md:47`) and "affected components" in the ADR checklist (`skills/write-adr/SKILL.md:106`). | New plugin: pane over git diff plus spec ACs. | No. The plan lists Anthropic's blast-radius mod under Safety, as buy (`00-approved-plan.md:78`). |
| R9 multi-human handoffs | `run.md` has owner, session and branch; one session drives a run; takeover needs the human's OK (`handoff/SKILL.md:136-138,146-148`); commits at each gate make runs visible to the team (`:134`). Gate approvers are only `human`, `orchestrator` or `none`, never a named person (`.ai-dlc/workflow.json:8-34`). | Extend the `run.md` schema and the gate `approver` with person ids. That is an ai-dlc workflow change, not a mod. | No. |
| R10 workflow progress pane | `run.md`'s stage table and *Next action* (`handoff/SKILL.md:164-180`); `workflow.mjs show [--mermaid]` (`skills/workflow/templates/workflow.mjs:6-7,434-520`). There is no `runs` command yet; the commands are `validate`, `show`, `diff`, `catalog` (`workflow.mjs:37`). | WI-4 `workflow.mjs runs [--json] [--active]`, then the WI-6 pane. | Yes, this is the core of the plan: options A and A′ (`00-approved-plan.md:128-129,137-138,238,240`). |
| R11 auto-compact session/cache/handoffs | The session-handoff procedure (`handoff/SKILL.md:201-238`). The Copilot build maps `PreCompact` (`tools/build-copilot.mjs:59-62` and the EVENT table), but ai-dlc ships no hooks (`build-copilot.mjs:313-315`). | A PreCompact hook in the new plugin. | Partial, same as R1: compaction-to-handoff mods are buy (`00-approved-plan.md:46-47`). |
| R12 parallel tasks in worktrees | The `workspace-folders` skill installs WorktreeCreate/Remove hooks under `.worktrees` (`skills/workspace-folders/SKILL.md:3,11,14`; `.claude/settings.json:53-74`). Parallel spawns exist (`skills/agent-invocation/SKILL.md:181-186`) but nothing tells the orchestrator to use `isolation: "worktree"`. Only software-architect has the Enter/ExitWorktree tools (`agents/software-architect.md:4`). | `agent-invocation` or `request-routing` mode 2 guidance. A mod could show a worktree map. | No. worktree-map is listed as buy (`00-approved-plan.md:71`). |
| R13 diagramming | `workflow.mjs show --mermaid` (`workflow.mjs:482-520`; `skills/workflow/SKILL.md:51-52`); Mermaid use-case diagrams in product briefs (`agents/product-owner.md:29`); the architecture-narrative skill (`skills/architecture-narrative/SKILL.md:8-26`). | A Mermaid render pane in the new plugin, or buy one. | Partial. claude-mermaid and show-me are buy (`00-approved-plan.md:75`). |
| R14 model/effort routing policy per agent | Static `model:` frontmatter on all 15 agents (`agents/*.md:4-5`). The agent-management default is `claude-sonnet-4-6` (`skills/agent-management/SKILL.md:42`), which conflicts with the aliases-only rule (`plugin-management/SKILL.md:52`). The workflow schema has no model or effort field (stage keys at `workflow.mjs:136`). | A new `workflow.json` key (schema plus `validate`) that the orchestrator reads when spawning. | Indirect. B's ledger would supply the data; agent-router and fable-pin are buy (`00-approved-plan.md:66`). |
| R15 agile ceremonies | Nothing (no standup, retro or sprint matches). What exists: PM waves and backlog (`.ai-dlc/workflow.json:67-73`), task-triage, the Release segment (`:472-499`). | New skills or a lifecycle in `workflow.json`. Not mod territory. | No. |
| R16 undo a workflow turn | Nothing. `run.md` records the commit SHA at each checkpoint (`handoff/SKILL.md:149`) and is committed at gates (`:134`). | Restore `run.md` plus the git state from the last checkpoint SHA, via a CLI command or slash command. | No. |
| R17 create/break workflow loops | `loop {to, on, maxRounds}` per stage, validated in `workflow.mjs:265-288` with a cycle check (`:410`). Edits go through `/ai-dlc:workflow edit` (agent-manager, `AGENTS.md`). Runtime break: blocked and escalated after 3 clarify rounds (`skills/ai-dlc/SKILL.md:198`; `workflow.json:526`). | Workflow-file edits stay with agent-manager. A mod could show loop rounds and offer "break → escalate". | Partial. The pane shows round N/3 (`00-approved-plan.md:128`). Loop-breaker mods are buy (`:57`). |

## Second plugin: marketplaces and the Copilot build

**Marketplaces**
- Add an entry to the `plugins` array in `.claude-plugin/marketplace.json:10-17`, with source `./plugins/claude/ai-dlc-lens`.
- Leave it out of `.github/plugin/marketplace.json`, because mods are Claude-only (`00-approved-plan.md:26,240`).
- Two existing inconsistencies:
  - The Claude marketplace entry has no `version`; the Copilot one does (`.github/plugin/marketplace.json:14`).
  - Both entry descriptions still say ".NET is the first supported stack" (`.claude-plugin/marketplace.json:14`, `.github/plugin/marketplace.json:13`).

**build-copilot.mjs — this is the blocker**
- The build lists every folder under `plugins/claude/`. With more than one folder and no `--plugin` argument, it throws (`tools/build-copilot.mjs:31-37`).
- These all call it without `--plugin`:
  - CI (`.github/workflows/validate.yml:16`)
  - the Stop hook (`.claude/hooks/check-copilot-stale.mjs:20`)
  - the allowed-command list (`.claude/settings.json:18-19`)
  - the commands in CLAUDE.md
- So adding `plugins/claude/ai-dlc-lens/` would immediately fail CI and leave the Stop hook permanently blocking.
- The plan only says the build "must ignore ai-dlc-lens" and cites `:315` (`00-approved-plan.md:254`). It doesn't cover this.
- **Options:**
  1. Change every caller to `--plugin ai-dlc`.
  2. Make the build default to `ai-dlc`, or skip folders that have no Copilot projection.
  3. Put the mod outside `plugins/claude/`.
- Should it project ai-dlc-lens to Copilot? No: mods never reach Copilot (`00-approved-plan.md:26,148`), and the build drops non-command hooks (`build-copilot.mjs:322`).

## Version

- `plugins/claude/ai-dlc/.claude-plugin/plugin.json:4` is `1.0.0-preview1`.
- Your project memory `project_version-scheme.md:11-15` says it is unreleased and goes preview2 → 1.0.0 → 1.0.1 → 1.1.0 → 2.0.0, with no bump during feature work. I didn't find this scheme written down anywhere in the repo.
- The plan agrees 1.0.0 isn't shipped (`00-approved-plan.md:179`). Its cut line: CLI plus docs in 1.0.0 only if that doesn't delay the release, otherwise 1.1.0 (`:219`, `run.md:21`).

## Paused run FEAT-20261020-ai-dlc-lens

- Status `active`, stage `breakdown`, branch `feat/ai-dlc-lens` (`docs/handoffs/FEAT-20261020-ai-dlc-lens/run.md:3-8`).
- Every stage is pending. You paused it before anything ran (`run.md:32-42,54`).
- Next action: spawn product-manager and 4 research-assistants in one message (`run.md:58-61`).

How it overlaps:
- **R10, fully:** the run-state core, `workflow.mjs runs`, then a pane with stage, gate, round N/3, next action and validate status (WI-4 and WI-6, `00-approved-plan.md:128,238,240`).
- **R5, partly:** the per-agent and per-stage token and cost ledger plus `/ai-dlc-lens:report` (`:130,240`). Plain context/cache meters were marked "buy".
- **R6 and R7, display only:** gate alerts and pane, but no approve/reject action.

## Open questions

1. Fold R1–R17 into the paused FEAT run (re-scoping WI-1), or start a separate work item? The plan said "buy" for R1, R3, R8, R11, R12 and R13, so building them reverses that decision.
2. R9, R14, R15 and R16 change the ai-dlc workflow schema or skills, not a mod plugin. They need their own run with agent-manager (AAW).
3. The fix for the build-copilot multi-plugin failure needs to go into the WI-2 spec constraints.
