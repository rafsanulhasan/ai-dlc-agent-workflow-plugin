# Hand-back 11: research-assistant — cluster aggregate-combined-report

Stored verbatim on 2026-10-20 (work item RES-20261020-ai-dlc-mods).

---

# Research Findings: AI-DLC mods, combined report (R1–R17)

## 1. Executive summary

- Mods are an official Claude Code feature: in-process JS registered through `hooks/hooks.json` `"modules"`, using the `$` API. They run in the CLI (≥2.1.287), Desktop and the VS Code extension, though VS Code shows less: no AbovePrompt band and no script status line. Copilot has no mods, only settings-style hooks. [Digest J]
- None of the ~41 listed mods understands ai-dlc runs (`run.md`, `workflow.json`, stages). The useful ones are generic, Claude-only and usually terminal-only.
- **Most requirements are BUILD.** Ten of 17 (R4, R9, R14, R15, R17, plus R13, R16 and parts of R7, R11, R12) are changes to ai-dlc core workflow and skills that go through AAW, not mods. They also work on Copilot.
- Only one mod is worth integrating directly: **blast-radius** (R8, Apache-2.0). cache-keeper, claude-mermaid and loop-breaker are worth recommending as optional companions.
- **Blocker confirmed:** `tools/build-copilot.mjs:31-37` throws when `plugins/claude/` holds more than one folder and `--plugin` is not passed. CI calls it bare (`.github/workflows/validate.yml:16`). So adding any second Claude plugin breaks CI and the Stop hook until this is fixed.
- Building R1, R3, R8, R11, R12 and R13 reverses the paused ai-dlc-lens plan's "buy, don't build" decisions. The human or PO needs to confirm that.

## 2. Master table

Harness columns: **CLI** = Claude Code CLI · **VSC** = Claude in VS Code · **Cop** = Copilot (CLI and VS Code). H/M/L = feasibility.

| R | Requirement | Confirmed mods (licence, harness) | Covered? | CLI | VSC | Cop | Recommendation | Home |
|---|---|---|---|---|---|---|---|---|
| R1 | Auto-handoff + fresh session at 70% | auto-handoff (MIT, CLI/Desktop; Windows page server fails), budget-guard (MIT, CLI), handoff-compact (MIT) | Partly; generic, 160k token trigger, writes its own brief rather than `run.md` | H | M (`/clear` unverified) | L (no new-session control) | BUILD (reuse the auto-handoff `/clear`+`prompt.submit` pattern; the seed points to `docs/handoffs/<item>/run.md`) | new mods plugin (or ai-dlc-lens) |
| R2 | 70% weekly → other account or provider | budget-guard (MIT), shunt (pre-1.0, gateway), BitFrost (GPL-3, no Windows), multi-core (gateway) | Gap for safe automatic switching | H stop+handoff; L auto-rotate | M | M (handover via shared handoff files) | BUILD stop + handoff + print the "continue in `copilot`/`claude`" command; auto-rotation only after a ToS check | mods plugin + docs |
| R3 | Cache keep-alive | cache-keeper (MIT, terminal+desktop, pane), cache-tax (MIT, terminal) | Covered (generic) | H | M | NOT FEASIBLE (no cache control) | RECOMMEND cache-keeper, or BUILD a small keep-warm (TTL from settings, cost cap, auto-off) | mods plugin; docs (`promptCacheTtl` 1h) |
| R4 | Auto model/effort | effortless (MIT, main thread only, judge costs usage), effort-cycle (MIT, manual), agent-router (MIT, needs a gateway), harness-mods | Gap for per-agent and per-stage choices | H | H | M (`model` yes, `reasoning-effort` VS Code only; CLI unverified) | BUILD native policy; REUSE-IDEA agent-router tiers and decision log | ai-dlc core (AAW) |
| R5 | Context/cache/waste bar (agent/session/project/all) | context-bar, context-lens (main thread only), agentpane (per-subagent tokens) | Partly; none is per-agent plus project-wide | H | M (pane yes, status line no) | L (usage not exposed to hooks) | BUILD; REUSE-IDEA context-bar/agentpane; "waste" needs a definition | ai-dlc-lens |
| R6 | Live review pane approve/reject | show-your-work (kitty only, telemetry on) | Gap | H | H (pane+buttons) | M (native Keep/Undo in VS Code Copilot) | BUILD (pre-edit capture per subagent/stage, Approve/Reject, revert + `prompt.submit`, git status sweep for Bash) | ai-dlc-lens (display) + mods plugin (control) |
| R7 | Quality gate SQA/brutal-critique | eigenwise-quality-gate (MIT, never blocks, band), typesafe-mod (not a gate) | Gap | H | H | H (preToolUse/Stop hooks) | REUSE-IDEA: quality CLI run by sqa-engineer, enforced by a Stop/SubagentStop hook, shown in a pane | ai-dlc core (AAW, installable hook skill) + lens display |
| R8 | Blast-radius pane | blast-radius (Apache-2.0, anthropics/claude-code-playground; misses `find -delete`/`xargs rm`) | Covered | H | H (Proceed/Cancel) | M (preToolUse ask with reason) | INTEGRATE as optional companion (vendor or fork allowed); Copilot preToolUse hook | mods plugin + Copilot hook via init |
| R9 | Humans own roles, person→person handoffs | shared-session (MIT, relay can read content), claude-fleet (no Windows) | Gap | H | H | H | BUILD workflow change: per-role/per-gate human assignees in schema, `claimed-by` in `run.md`, optional GitHub issue/PR mirror | ai-dlc core (AAW) |
| R10 | Work-progress pane | agent-flow, mission-control (no tokens), flowpane/workflow-watch (Workflow-tool runs only), agentpane | Gap (none join to ai-dlc stages) | H | H (SVG pane) | L | BUILD (join agentId → subagentType → `run.md` stage) | ai-dlc-lens (WI-4, WI-6) |
| R11a | Auto-compact | idle-compact (Apache-2.0); built-in idleCompaction since 2.1.290 | Built-in | H | M | built-in (~80%) | BUILT-IN + settings presets via init; thin mod only for VS Code idle | docs / init |
| R11b | Compact + keep warm | cache-keeper + idle-compact | Gap (combined) | H | M | NOT FEASIBLE | BUILD combined mod | mods plugin |
| R11c | Compact handoffs | handoff-compact (MIT; replacement mechanism unverified), workface | Partly | H | H | M (preCompact is observe-only) | BUILD portable PreCompact snapshot + SessionStart[compact] re-injecting `run.md` | ai-dlc core (installable hook skill) |
| R12 | Multiple tasks in worktrees | nanoflow, claude-fleet (no Windows), autodev-core (conflicts with `.worktrees/`) | Mostly built-in (`--worktree`, `isolation: worktree`) | H | H | M | BUILT-IN + thin BUILD: one-orchestrator-per-worktree recipe + read-only cross-worktree `runs` | ai-dlc core + lens (`runs`) |
| R13 | Diagramming (UML, ER, C4, plan-mode inline) | claude-mermaid (MIT), mermaid-inline (no Windows), whitekr-mermaid | Partly (terminal redraw; no C4, use-case or VS Code) | M | L | via GitHub rendering | BUILD diagramming skill wired into architecture-design, system-design, write-adr, requirement-analysis; RECOMMEND claude-mermaid; plan-mode/VS Code inline NOT FEASIBLE | ai-dlc core (AAW) |
| R14 | Routing policy model/effort per agent/handoff | agent-router (gateway only) | Gap | H | H | M | BUILD (same item as R4) | ai-dlc core (AAW) |
| R15 | Agile (sprint, retro, AC→DoD, backlog, triage, standup) | bengous-todos (not a backlog), autoresearch (unrelated) | Partly (DoD, triage, backlog exist; no sprint/retro/standup) | H | H | H | BUILD `plan-sprint`/`retro`/`standup` modes | ai-dlc core (AAW) |
| R16 | Undo a whole workflow turn | claude-time-machine (MIT, no Windows) | Gap (`/rewind` skips subagent edits) | H | H | M (VS Code checkpoints) | BUILD stage snapshot (`git stash create` + `update-ref` before each spawn, id in `run.md`, "undo stage"; Node for Windows) | ai-dlc core (AAW) + lens button |
| R17 | Create/break workflow loops | loop-breaker (MIT, 0 stars) | Creating loops already supported; no runaway guard | H | H | H | BUILD validate warning/default cap + round counting in `run.md`; tool-level loops: RECOMMEND loop-breaker or REUSE-IDEA in a hook skill | ai-dlc core (AAW) |

## 3. Mod disposition

The brief says 39 URLs but lists 41 names, and Digest A also mentions recap-plus. The digests do not carry the URLs, so mods are named only. I did not invent links.

| Mod | R# | Verdict | Reason |
|---|---|---|---|
| auto-handoff | R1 | reuse idea | MIT; `/clear`+seed pattern is good; Windows page server fails; not ai-dlc-aware |
| multi-core | R2 | reject | Needs a gateway; not R9/R12 |
| shunt | R2 | reuse idea | Pre-1.0 account pool behind a gateway; ToS risk |
| promptadvisers-threads | R12 | reject | tmux/Mac, `bypassPermissions` by default, experimental |
| cache-tax | R3 | reuse idea | Terminal only; cold-send guard worth copying |
| cache-keeper | R3, R11b | recommend | MIT, pane, `/keepwarm`; Claude only |
| context-bar | R5 | reuse idea | Main thread only |
| mission-control | R10 | reject | No token data |
| eigenwise-quality-gate | R7 | reuse idea | Never blocks; uses the band (absent in VS Code) |
| blast-radius | R8 | **integrate** | Apache-2.0, Anthropic playground; patch the `find -delete`/`xargs rm` gaps |
| shared-session | R9 | reject | Relay can read content; Windows unverified |
| show-your-work | R6 | reject | kitty only, telemetry on |
| effortless | R4 | reuse idea | Judge costs usage; optional third-party API |
| harness-mods | R4 | reject | Author-specific; no effort control |
| agent-flow | R10, R5 | reuse idea | Per-agent tree; VS Code prints text only |
| bitfrost | R2 | reject | GPL-3, no Windows |
| idle-compact | R11a | reject | Duplicates built-in idleCompaction |
| nanoflow | R12 | reject | Overlaps built-in worktrees |
| handoff-compact | R1, R11c | reuse idea | Writes to `~/.claude/handoffs`, not `docs/handoffs`; mechanism unverified |
| workflow-watch | R10 | reject | Workflow-tool runs only |
| agentpane | R5, R10 | reuse idea | Per-subagent tokens and cached share |
| flowpane | R10 | reject | Workflow-tool runs only |
| commonplace | none | reject | Obsidian vault; off-topic |
| claude-code-figures | none | reject | kitty/Ghostty renderer; off-topic |
| budget-guard | R1, R2 | reuse idea | `$.session.usage` rateLimits logic; CLI |
| session-brief | R1 | reject | Band only; not in VS Code |
| recap-plus | R1 | reject | Band only; not in VS Code |
| context-lens | R5 | reuse idea | Skips subagents |
| agent-router | R4, R14 | reuse idea | Tiers and decision log; gateway only |
| typesafe-mod | R7 | reject | Not a gate; third-party API |
| autodev-core | R12 | reject | Competes with gates; conflicts with `.worktrees/` |
| workface | R11 | reject | Compaction notes; covered by R11c build |
| bengous-todos | R15 | reject | TODO comments, not a backlog |
| claude-mermaid | R13 | recommend | MIT, most mature; terminal only |
| autoresearch | R15 | reject | Autonomous loop with `git clean -fd` |
| effort-cycle | R4 | reject | Manual hotkeys; VS Code has no hotkeys |
| session-hud | R1, R2 | reject | HUD not shown in a VS Code panel; lens covers it |
| claude-time-machine | R16 | reuse idea | No Windows; snapshot idea reused |
| claude-fleet | R9, R12 | reject | macOS/Linux; internal `~/.claude/sessions` |
| loop-breaker | R17 | recommend (optional) | Covers subagents; 0 stars, so maturity risk |
| mermaid-inline | R13 | reject | macOS/Linux only |
| whitekr-mermaid | R13 | reject | Duplicates claude-mermaid |

## 4. Packaging proposal

| Bucket | Items | Copilot story |
|---|---|---|
| **(a) ai-dlc core, via AAW** (stays hook-free; hooks are installed by init skills like `node-test-gate`) | R4/R14 model/effort policy (frontmatter `effort:`, workflow.json + schema + validate, Routing Plan, agent-invocation, build-copilot emits `model`/`reasoning-effort`); R9 human assignees; R13 diagramming skill; R15 sprint/retro/standup; R16 stage snapshots; R17 loop cap + validate warning; R7 quality-gate hook skill; R11c PreCompact/SessionStart hook skill; R12 worktree recipe; fix the `agent-management/SKILL.md:42` `claude-sonnet-4-6` vs aliases-only conflict | Full (skills, workflow, settings-style hooks) |
| **(b) ai-dlc-lens** (paused run) | `workflow.mjs runs` (also cross-worktree, R12); R10 progress pane; R5 context/cache bar + per-agent ledger; display side of R6/R7/R16 (buttons) | None (no panes); `runs` CLI works everywhere |
| **(c) separate mods plugin**, e.g. `ai-dlc-mods` (or `ai-dlc-pilot`) | R1 auto-handoff at threshold; R2 budget stop + handover; R3/R11b keep-warm + idle compact; R6 review control; R8 blast-radius (vendored) | R8: Copilot preToolUse hook via init. R2: handoff files usable from `copilot`. Others: none |
| **(d) docs only** | R11a built-in compaction settings presets; R3 `promptCacheTtl` 1h advice; companion list (cache-keeper, claude-mermaid, loop-breaker); R2 account/provider manual-switch guide | Docs cover Copilot's built-in ~80% auto-compact and `/user` switch |

Open option: merge (b) and (c) into one Claude-only plugin, which means one extra marketplace entry instead of two.

## 5. Cross-cutting blockers and risks

| # | Risk | Evidence | Mitigation |
|---|---|---|---|
| 1 | **build-copilot breaks with a second Claude plugin** (confirmed by spot-check) | `tools/build-copilot.mjs:31-37`; bare call in `.github/workflows/validate.yml:16`, `.claude/hooks/check-copilot-stale.mjs:20` | Default to `ai-dlc` or skip non-projected folders (e.g. a `copilot: false` marker), or pass `--plugin ai-dlc` everywhere, or put mods outside `plugins/claude/`. Not covered by `00-approved-plan.md:254` |
| 2 | Mods API may change | Mods docs say so | Pin the minimum CLI/extension version; keep logic in plain Node modules that are testable with `node --test` |
| 3 | VS Code gaps: no AbovePrompt band; script status line reportedly not rendered (issue 20207); no hotkeys | Digest J | Use panes and toasts, never the band |
| 4 | Windows: several reference mods fail or exclude Windows | Digests A, F, G, E | Node-only implementations; Windows in CI |
| 5 | ToS of automatic account rotation | Unverified | No auto-rotation until checked |
| 6 | Undocumented transcript format (`subagents/agent-<id>.jsonl`, `.meta.json`); streamed usage repeats | Digest D | Dedupe by message id; tolerant parser; prefer `turn.step` usage events |
| 7 | Could `hooks.json` with `"modules"` break Copilot plugin loading? | Unverified | Keep mods Claude-only; marketplace entry in `.claude-plugin/marketplace.json` only |
| 8 | Reverses the ai-dlc-lens "buy" decisions | Digest I | Human/PO decision (Section 7) |
| 9 | Marketplace drift: Claude entry lacks `version`; descriptions still say ".NET is the first supported stack" | Digest I | Fix in the same AAW item as the marketplace entry |
| 10 | Uncapped loops in `.ai-dlc/workflow.json` | Digest H lists 9 uncapped. Spot-check: 5 `maxRounds` occurrences in the file, consistent with only some loops capped | R17 guard |

## 6. Suggested waves (a proposal for product-manager, not binding)

- **Wave 0:** fix build-copilot for multiple plugins + marketplace drift (AAW). This blocks every new plugin.
- **Wave 1 (parallel, core AAW):** R4/R14 policy · R17 loop guard · R13 diagram skill · R15 agile modes · R9 assignees (schema). All independent.
- **Wave 2:** resume ai-dlc-lens: `runs` (R12 listing) → R10 pane → R5 bar/ledger. R16 snapshots (core) in parallel.
- **Wave 3 (mods plugin):** R1 auto-handoff → R2 budget stop/handover (shares usage plumbing) · R3/R11b keep-warm+compact · R8 blast-radius vendor + Copilot hook.
- **Wave 4:** R6 review pane (depends on R16 snapshots and the R10 pane) · R7 quality-gate hook + display · R11c compact-handoff hooks.

## 7. Decisions needed from the human

1. R1: does "session limit" mean the context window or the 5-hour plan window?
2. R2: automation level. Stop and handoff only, print a switch command, or automatic rotation (after a ToS check)?
3. R6: approve per edit or per stage (at G4)? Do Bash-made changes count?
4. Copilot coverage: parity where hooks allow, or Claude-only for UI mods?
5. May the ai-dlc-lens "buy" decisions be reversed for R1, R3, R8, R11, R12 and R13?
6. Fold these into the paused ai-dlc-lens run (FEAT-20261020-ai-dlc-lens) or start a new run?
7. One Claude-only plugin (lens + mods) or two? What name?
8. How should build-copilot handle multiple plugins (default plugin, opt-out marker, or a separate folder)?
9. R5: what counts as "context waste"? (PO at G1)
10. R9: is a GitHub issue/PR mirror in scope, or only `run.md` assignees?
11. R8: vendor or fork blast-radius, or recommend it only?
12. Release target: 1.0.0, or defer the mods to 1.1.0?

## 8. Unverified items

- Whether `$.command.run` can reach `/clear`, `/model` or `/login`.
- Whether a `hooks.json` with `"modules"` breaks Copilot plugin loading.
- Whether the script status line is rendered in the VS Code extension (only community issue 20207).
- Whether Copilot CLI honours `reasoning-effort`.
- Whether a forked or side ping refreshes the main conversation's 1h cache entry.
- How handoff-compact replaces the compaction summary (vs the documented `{skip}`).
- Whether `$.fs` can read outside the project (needed for R5 all-sessions scope).
- Whether automatic account switching complies with Anthropic ToS.
- The format of the subagent transcript and `meta.json` (undocumented).
- Whether plan-mode Mermaid rendering is impossible in the CLI (only the VS Code request #20529, closed unimplemented, is known).
- The exact count of uncapped loops (Digest H says 9; my grep found 5 `maxRounds` keys and did not check them line by line).
- The mod URLs, which are not in the digests.

## Sources

- Digests A–J (from the brief), with the citations they carry (code.claude.com/docs/en/plugins/mods/*, anthropics/claude-code `mods/types/claude-code.d.ts`, repo paths).
- Spot-checked in the repo: `e:\Projects\personal\ai-dlc-agent-workflow-plugin\tools\build-copilot.mjs:31-37` (confirmed), `e:\Projects\personal\ai-dlc-agent-workflow-plugin\.github\workflows\validate.yml:16` (confirmed bare call), `e:\Projects\personal\ai-dlc-agent-workflow-plugin\.ai-dlc\workflow.json` (5 `maxRounds` occurrences).

## Confidence

Medium. This is a synthesis of digests, not first-hand research. Only the build-copilot blocker and the CI call were re-verified. Feasibility ratings rely on mods docs that the vendor says may change, and on a few community reports.

## Open Questions

See Section 7. Also: the brief's "39 URLs" does not match the 41 names it lists (42 counting recap-plus).
