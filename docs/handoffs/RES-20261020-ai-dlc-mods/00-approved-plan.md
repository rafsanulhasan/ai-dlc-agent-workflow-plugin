# Plan: AI-DLC mods — classification, research findings and next steps

## Context
The user wants a set of "mods" (https://claude-mods.com/) for the `ai-dlc` plugin, for both the Claude Code CLI and the VS Code extension, and ideally GitHub Copilot. This step classified 17 requirements, mapped them to the 41 listed mods, ran 10 parallel `research-assistant` agents (clusters A–J) and a separate aggregator. The combined report follows. No repository file has changed.

Related run: `docs/handoffs/FEAT-20261020-ai-dlc-lens/` (active, paused, branch `feat/ai-dlc-lens`). It plans `workflow.mjs runs`, a gate alert, and an `ai-dlc-lens` mod plugin (pane, status line, per-agent cost ledger). It overlaps R5, R10 and R12, and shows R6, R7 and R16 on screen only.

## Key findings
- **Mods are an official Claude Code feature.** A mod is in-process JavaScript registered through `hooks/hooks.json` `"modules"` and uses the `$` API. It runs in the CLI (2.1.287 or later), in Desktop, and in the VS Code extension (2.1.299 or later). VS Code shows panes, buttons (click only) and toasts, but not the band above the prompt or a script status line. **Copilot has no mods**, only settings-style hooks, agents, skills and MCP servers.
- **None of the 41 mods understands ai-dlc runs** (`run.md`, `workflow.json`, stages). The useful ones are generic, Claude-only, and usually terminal-only. Several exclude Windows.
- **Most requirements are changes to ai-dlc itself, not mods:** R4, R9, R13, R14, R15, R16 and R17, and parts of R7, R11 and R12. These go through AAW, and most of them also work on Copilot.
- **One mod is worth integrating:** blast-radius (R8, Apache-2.0, Anthropic playground). Three are worth recommending: cache-keeper, claude-mermaid, loop-breaker.
- **Blocker (re-verified):** `tools/build-copilot.mjs:31-37` throws when `plugins/claude/` holds more than one plugin and no `--plugin` argument is given. CI (`.github/workflows/validate.yml:16`) and the Stop hook (`.claude/hooks/check-copilot-stale.mjs:20`) call it without one. Any second Claude plugin breaks CI until this is fixed.
- **Building R1, R3, R8, R11, R12 and R13 reverses** the ai-dlc-lens plan's "buy, don't build" decisions.

## Requirements: verdict and home
| R | Requirement | Verdict | Home | Copilot |
|---|---|---|---|---|
| R1 | Auto-handoff and a fresh session at 70% | BUILD (reuse the auto-handoff `/clear` + seed prompt idea; the seed prompt points at `run.md`) | mods plugin | Low: Copilot cannot start a new session |
| R2 | At 70% weekly, move to another account or provider | BUILD: stop, hand off, print the `copilot`/`claude` command to continue; auto-rotation only after a terms-of-service check | mods plugin + docs | Medium: through the shared handoff files |
| R3 | Cache keep-alive | RECOMMEND cache-keeper, or BUILD a small keep-warm mod; advise `promptCacheTtl: "1h"` | mods plugin / docs | Not feasible |
| R4 + R14 | Model and effort per agent, stage or task | BUILD a native policy: `effort:` frontmatter, model and effort in `workflow.json` + schema, Routing Plan, agent-invocation; build-copilot emits `model` and `reasoning-effort` | ai-dlc core (AAW) | Medium to high |
| R5 | Context, cache and waste bar | BUILD (ideas from context-bar and agentpane); "waste" needs a definition | ai-dlc-lens | Low |
| R6 | Live review pane, approve/reject | BUILD (capture each edit, Approve/Reject, revert, tell the agent) | lens (display) + mods (control) | VS Code's own Keep/Undo |
| R7 | Quality gate | REUSE-IDEA from eigenwise: sqa-engineer runs the quality CLI; a Stop/SubagentStop hook enforces it | ai-dlc core (hook skill installed by init) | High |
| R8 | Blast radius | INTEGRATE blast-radius (vendored); Copilot `preToolUse` "ask" | mods plugin + init hook | Medium |
| R9 | Humans own roles; handoffs between people | BUILD a workflow change: per-role/per-gate assignees, `claimed-by` in `run.md`, optional GitHub issue/PR mirror | ai-dlc core | High |
| R10 | Workflow progress pane | BUILD (link agentId → agent type → `run.md` stage; diagram from `workflow.json`) | ai-dlc-lens | Low |
| R11 | Auto-compaction | Built-in `idleCompaction`/`autoCompactWindow` presets; BUILD compact + keep-warm; BUILD PreCompact + SessionStart[compact] hooks that re-inject `run.md` | docs / mods / core hook skill | Partial |
| R12 | Parallel tasks in worktrees | Built-in features + a one-orchestrator-per-worktree recipe + `runs` across worktrees | core + lens | Medium |
| R13 | Diagramming | BUILD a diagramming skill (diagram type → stage; Mermaid C4/ER/sequence/use-case; PlantUML fallback); RECOMMEND claude-mermaid; inline rendering in plan mode and VS Code is not feasible | ai-dlc core | Through GitHub's rendering |
| R15 | Agile ceremonies | BUILD `plan-sprint`, `retro` and `standup` (DoD, triage and backlog already exist) | ai-dlc core | High |
| R16 | Undo a workflow turn | BUILD git snapshots per stage (ref saved in `run.md`, "undo stage"); `/rewind` misses subagent edits | ai-dlc core + lens button | Medium |
| R17 | Create or break loops | BUILD a cap on runaway loops (validate warning or default `maxRounds`; rounds counted in `run.md`); optional loop-breaker | ai-dlc core | High |

The disposition of all 41 mods (integrate 1, recommend 3, reuse an idea 14, reject 23) is in the aggregator's report (section 3).

## Suggested waves (a proposal for product-manager, not binding)
- **W0:** make build-copilot work with several plugins; fix the marketplace drift (Claude entry has no `version`; descriptions still say ".NET first").
- **W1 (core AAW, in parallel):** R4/R14 policy · R17 loop guard · R13 diagram skill · R15 agile modes · R9 assignees.
- **W2:** resume ai-dlc-lens: `runs` (R12) → R10 pane → R5 bar/ledger; R16 snapshots in parallel.
- **W3 (mods plugin):** R1 → R2 (shared usage plumbing) · R3/R11b keep-warm and compact · R8 blast-radius + Copilot hook.
- **W4:** R6 review pane (needs R16 and R10) · R7 gate hook and display · R11c compaction hooks.

## Human decisions (2026-10-20)
1. **R1 trigger:** both. Hand off when the context window or the 5-hour usage window reaches 70%, whichever comes first.
2. **R2 failover:** stop, write the handoff, and print the exact `copilot` or `claude` command to continue. No automatic account rotation and no credential handling.
3. **Packaging:** ai-dlc core (skills and workflow through AAW: R4, R7, R9, R13–R17) plus **one** Claude-only mods plugin, made by expanding the paused ai-dlc-lens run (R1–R3, R5, R6, R8, R10, R11). Both go in the same marketplace. This reverses ai-dlc-lens's "buy" decisions for R1, R3, R8, R11, R12 and R13.
4. **Release:** **1.0.0 ships the mods for Claude.** Mods that work through settings hooks (for example the R7 gate, the R8 blast-radius "ask", and the R11c PreCompact/SessionStart hooks) are also integrated for Copilot. This supersedes the ai-dlc-lens run's "1.1.0 if it delays the release" rule, so 1.0.0 waits for this scope.
Still open for product-owner at G1: what "context waste" means (R5); per-edit or per-stage review, and whether Bash changes count (R6); whether a GitHub issue/PR mirror is in scope for R9; vendoring or forking blast-radius; how build-copilot handles several plugins (W0).

## After approval
1. **Keep this plan in the repo:** copy this file verbatim to `docs/handoffs/RES-20261020-ai-dlc-mods/00-approved-plan.md`. Write the run state `run.md` there. Store the 10 cluster hand-backs and the aggregate verbatim (`01…11-research-assistant-handback.md`). Commit on `feat/ai-dlc-lens` with the attribution line.
2. Apply the human's decisions below. Then product-manager produces the binding work breakdown, including whether to fold items into FEAT-20261020-ai-dlc-lens. Then product-owner rules on scope, release target and the reversed "buy" decisions.
3. Route each item (AI-DLC for the mods plugin and lens; AAW for core skill and workflow changes). Present the Routing Plan for confirmation.

## Verification
- Every requirement R1–R17 has a verdict, a home and cited sources (cluster reports A–J).
- All 41 mods have a disposition.
- `node .ai-dlc/workflow.mjs validate` still passes. No repository file changed in this step.

## Still unverified
Whether `$.command.run` can run `/clear`; whether `hooks.json` with `modules` breaks Copilot plugin loading; the script status line in VS Code; `reasoning-effort` in Copilot CLI; whether a fork ping refreshes the main 1h cache; whether account rotation is allowed by the terms of service; the undocumented format of subagent transcripts and `meta.json`.
