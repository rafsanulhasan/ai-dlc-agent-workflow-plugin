---
run: AAWP-20261112-herdr-skill
version: "2"
previous: run.v1.md
status: active
lifecycle: AAWP
mode: team   # follow-up 1.2.l3 onwards runs as an AAWP agent team (human 2026-11-13); earlier stages subagent
branch: feat/ai-dlc-lens
session: f1e3e3dc-bbb2-420f-aa4c-439c258c0179, then its automatic-handoff session (2026-11-14)
commit: 930848d
last-record: 3-orchestrator-to-devops-engineer.handoff.md
updated: 2026-11-14
---
# Run: herdr skill, and herdr panes for spawned agents

## Request
The human (2026-11-12): "create a skill for herdr in the plugin so that agents can control herdr and orchestrator can create herdr panes when it spawn a agent team or subagents"

## Clarified intent (human's answers, 2026-11-12)
- herdr = herdrdev/herdr (herdr.dev), terminal workspace for AI coding agents; Apache-2.0; v0.9.5; Windows native GA.
- **Both modes**, chosen by a setting: **watch** (default) — agents still spawn with the Agent tool; the orchestrator opens a labelled herdr pane per subagent / teammate showing its progress, closed when the agent is finished (subagent handed back, teammate shut down). **A teammate idle while waiting for a teammate's handoff or reply keeps its pane open.** **run-in-pane** — each agent runs as its own `claude --agent ai-dlc:<id>` process in a herdr pane, driven with pane run / wait / read.
- **Activation:** automatic only when the session runs inside herdr (HERDR_ENV=1) and `herdr` is on PATH; otherwise nothing happens.
- **Our own skill**, not vendored from upstream; cite herdr.dev as source.
- **Own AAWP run** (not the lens run).
- Assumptions (stated in the plan, not contradicted): herdr installed separately; skill Claude Code only (tools/claude-only-skills.json); Windows CLI parity verified at design.

## Joined requests
| Date | Request (verbatim) | Clarified intent | Routing Plan rows | First step |
|---|---|---|---|---|
| 2026-11-13 | "yes add it as a followup for agent manager and the AAWP team in the run where we added the herdr skill" (after the orchestrator reported that `herdr.mjs open` stacks every new pane below the newest one in a single column, so with five panes opened at once the last ones got one row each and were not visible, and that the human had to ask for a third column, which the orchestrator built by hand with `herdr pane move` across tabs, since herdr does not move a pane within its own tab) | Follow-up to feature 1 (the herdr skill): `open` should lay out watch panes so every pane stays readable — e.g. start a new column when the current one would make a pane too small, and keep a team's panes together — instead of always splitting the newest pane down. Facts found 2026-11-13 (herdr 0.9.5, Windows): `herdr pane move <id> --tab <tab> --split right|down --target-pane <id>` works only across tabs (same tab: `changed:false`, `reason:same_tab`); `herdr pane layout` returns every pane's rect and the split tree; pane ids survive a move. Queued by the human until after the lens run's tier-1 G4 (FEAT-20261020-ai-dlc-lens). | AAWP follow-up, agent team: agent-manager → sqa-engineer → code-reviewer ×2, docs → brutal-critique (and documentation-writer for the README herdr entry if its wording changes) | 1.2.l3.1 (pending) |

## Follow-up stages (feature 1, pane layout; started 2026-11-14 after the human's "yes")
Codes corrected to the phase sub-roots (handoff, Naming): each sub-root takes its next loop.
| Step | Stage | Owner | Mode | Status |
|---|---|---|---|---|
| 1.2.l3.1 | change: `herdr.mjs open`/`run` pane layout (columns), SKILL.md | agent-manager (am-h3) | team | done (passed, lead check: herdr.mjs (code, +52) and SKILL.md (docs, +9) changed per git diff; no generated; build/--check/sync --check/validate exit 0; tests 1270/1262/1 fail (deliberate, herdr-open-close.test.mjs:334 allow-list lacks `pane layout`)/7 skipped; rule: split the run pane whose smaller half scores best on min(cols/50, rows/10) from `pane layout`; fallback old rule; live: 4 panes 32x10 one column) · `1.2.l3.1-agent-manager-to-orchestrator.handback.md`; handoffs to sqa-engineer and brutal-critique |
| 1.3.l3.1 | tests for the layout logic (tests/herdr) | sqa-engineer (sqa-h3) | team | done (passed, lead check: new tests/herdr/herdr-layout.test.mjs (40), edits herdr-open-close.test.mjs (allow-lists) and helpers/fake-bin.mjs; herdr.mjs still +52 (mutants reverted); node --test 1310 / 1303 pass / 0 fail / 7 skipped; 17/17 placement mutants killed; no defects) · `1.3.l3.1-sqa-engineer-to-agent-manager.handback.md`; one handoff for both reviewers `1.3.l3.1-sqa-engineer-to-code-reviewer.handoff.md` |
| 1.4.1.l3.1 | code review, standards | code-reviewer (cr-std-h3) | team | done · **APPROVE** round 1 of 2, 0B/0W/4S (S1 warning pushed before the split, herdr.mjs:411; S2 freeze READABLE :370; S3 loose hang-test bound herdr-layout.test.mjs:237; S4 HERDR_MJS_UNDER_TEST seam) · `1.4.1.l3.1-code-reviewer-to-sqa-engineer.handback.md` |
| 1.4.2.l2.1 | code review, spec | code-reviewer (cr-spec-h3) | team | done · **PASS** round 1 of 2, 0B/0M/1W (herdr.mjs:419-425: first pane halves the anchor, a narrow anchor gives a narrow column and later panes warn below 50x10)/2S (tie order not chronological; SKILL.md "closest to readable" imprecise) · `1.4.2.l2.1-code-reviewer-to-sqa-engineer.handback.md`. Warning open → asked the human (am-h3 proposes docs-only fix round 1.2.l3.2) |
| 1.5.2.l2.1 | critique of the docs it changes | brutal-critique (bc-h3) | team | done · **PASS** round 1 of 2, 0B/0M/4 Minor (dense paragraph; 50x10 not named; pane_not_found retry undocumented; multi-tab note) · stored by am-h3 as `1.5.2.l2.1-brutal-critique-to-agent-manager.handback.md` |
| 1.2.l3.2 | fix round (docs only, the human 2026-11-14): spec W + S1/S2, critique 4 Minors in SKILL.md; standards S1-S4 accepted open | agent-manager (am-h3) | team | done (passed, lead check: only SKILL.md changed further (+9 → +16 lines), herdr.mjs still +52, tests unchanged; build --check and sync --check exit 0 quoted) · `1.2.l3.2-agent-manager-to-orchestrator.handback.md`; handoff to bc-h3 |
| 1.5.2.l2.2 | re-critique, round 2 of 2 | brutal-critique (bc-h3) | team | done · **PASS** 0B/0M/0 new Minor; Warning, S1, S2, Minors 1-4 closed (SKILL.md 99-106, 115) · `1.5.2.l2.2-brutal-critique-to-agent-manager.handback.md` |
| 3 | commit the follow-up (code, docs, tests, records); push | devops-engineer | subagent | in-progress · `3-orchestrator-to-devops-engineer.handoff.md` |

## Routing
Agent Artifact (plugin skill + orchestrator / agent-invocation / request-routing wiring; likely a script) → AAWP. No work breakdown (AAW). Mode: subagent.

## Gates and loops
AAWP/lld 2/1 · AAWP/test 2/1 · AAWP/code-review 2/1 · AAWP/critique 2/1 · clarify 2/1 (from `rounds --json`, source `loop`). AAWP has no gates.
- 2026-11-14, follow-up loops 1.3.l3, 1.4.1.l3, 1.4.2.l2, 1.5.2.l2: AAWP/test 2/1, AAWP/code-review 2/1, AAWP/critique 2/1 (rounds --json, source loop); the 3-round raise below applied to the earlier loops only.
- herdr (2026-11-14): active (watch), anchor w1:p1, herdr 0.9.5; team panes w1:p1Z, w1:p10, w1:p21, w1:p22, w1:p23 opened for 1.2.l3.1, 1.3.l3.1, 1.4.1.l3.1, 1.4.2.l2.1, 1.5.2.l2.1.
- **AAWP/test and AAWP/code-review raised to 3 rounds for this run** (one-off; workflow file unchanged) — the human, 2026-11-12: "Fix it, 1 more round" for the 1.4.1.l1 SIGHUP Warning.

## Stages
| Step | Stage | Agent | Status | Record |
|---|---|---|---|---|
| 1.1.1 | research: what herdr is | research-assistant | done (passed) | 1.1.1-research-assistant-to-orchestrator.handback.md |
| 1.1.2 | research: plugin fit | research-assistant | done (passed) | 1.1.2-research-assistant-to-orchestrator.handback.md |
| 1.1.3 | intent | product-owner | done (failed write; content accepted) · ACs 1-15 in the hand-back, which stands as the intent artifact (orchestrator decision 2026-11-12; 1.1.3-intent.md not written) | 1.1.3-product-owner-to-orchestrator.handback.md |
| 1.1.4 | design | software-architect (worktree) | done (passed) · design + ADR-0010 (Proposed); D1-D9; open Q1-Q5 → 1.1.5.x; O1 → human: add `off` | 1.1.4-software-architect-to-orchestrator.handback.md |
| 1.1.5.1 | clarify: herdr CLI (Q1) | research-assistant | done (passed) · syntax confirmed (0.9.5); unknown: no-server behaviour, liveness call, Windows transport/shell, rename/run/close output → live probes at 1.1.6 | 1.1.5.1-research-assistant-to-orchestrator.handback.md |
| 1.1.5.2 | clarify: Claude Code (Q2-Q5) | research-assistant | done (passed) · subagent jsonl path; -p Manual mode, --allowedTools / --permission-prompts none; claude.exe native; unknown: -p --agent plugin load, live jsonl growth, session id in Bash → live probes at 1.1.6 | 1.1.5.2-research-assistant-to-orchestrator.handback.md |
| 1.1.6 | low-level design (+ live probes) | system-engineer | done (passed) · LLD 1.1.6-lld.md (6ff361e); probes: herdr 0.9.5 running, no-server exit 0 (read status line), claude.cmd npm shim, `claude -p --agent ai-dlc:…` loads plugin agent; U1 HERDR_ENV absent in herdr pane → human | 1.1.6-system-engineer-to-orchestrator.handback.md |
| 1.1.6.l1 | LLD revision: detection fallback (lld loop round 1 / 2) | system-engineer | done (passed) · 63b662d; detect: off → --version → status running → HERDR_ENV anchor, else unique working claude pane in this cwd, else inactive; AC-4/D8 change in LLD §9.4 | 1.1.6.l1-system-engineer-to-orchestrator.handback.md |
| 1.2 | change | agent-manager | done (passed) · 80d9d2e (22 files); checks all exit 0, catalog check 0; 7 LLD deviations reported; live probe: run-in-pane child ran the repo Stop hook, which rewrote its final text (known limit in SKILL.md) | 1.2-agent-manager-to-orchestrator.handback.md |
| 1.2.1 | change: plugin-management mention (owned skill; fresh agent-manager) | agent-manager (fresh) | done (passed) · c48e5bf (docs + generated); checks exit 0 | 1.2.1-agent-manager-to-orchestrator.handback.md |
| 1.3 | test (code), round 1 / 2 | sqa-engineer | done (passed) · 10 files tests/herdr (staged; commit pending GPG); 1122 tests, 1118 pass, 0 fail, 1 todo; gap 1 AC-11: run returns ok:true for a Stop-hook-rewritten result; minor: double close herdr.mjs:381-387/:447-449 | 1.3-sqa-engineer-to-orchestrator.handback.md |
| 1.4.1 | code review, standards, round 1 / 2 | code-reviewer | done (passed) · **approve**; W: todo test asserts invented fields (drop it); W: POSIX killTree only kills direct child; S: double close, childCommand agent/worktree checks, finish() try/catch; AC-11 gap → skill rule, not script | 1.4.1-code-reviewer-to-orchestrator.handback.md |
| 1.1.3.l1 | intent amendment: AC-10 main + fallback, AC-4 restated, AC-16+ settings | product-owner | done (passed) · 1.1.3.l1-intent-amendment.md: AC-4, AC-5, AC-10 (main + fallback, path recorded), AC-11 (line-1 check → failed hand-back + Agent re-spawn) restated; AC-16..AC-23 settings | 1.1.3.l1-product-owner-to-orchestrator.handback.md |
| 1.1.6.l2 | LLD revision: result retrieval main + fallback (lld loop round 2 / 2) + review decisions | system-engineer | done (passed) · main = result file; fallback = base64 pane copy (nonce markers, bytes + sha256, 16 KiB cap) via pane read recent-unwrapped; wait-output unused; probes P1-P12; U11 PowerShell paths E:/; LLD uncommitted (git locked) | 1.1.6.l2-system-engineer-to-orchestrator.handback.md |
| 1.2.l1 | fix round 1: all findings + AC-10 main/fallback + AC-16..23 | agent-manager | done (passed) · herdr.mjs (code), SKILL.md, orchestrator.md (docs), AGENTS.md + templates + Copilot (generated); checks exit 0; tests 7 fail, all deliberate LLD changes → 1.3.l1; live probes file path + pane fallback OK; uncommitted (git locked) | 1.2.l1-agent-manager-to-orchestrator.handback.md |
| 1.3.l1 | re-test, round 2 / 2 | sqa-engineer | done (passed) · 1220 tests, 1216 pass, 0 fail, 4 skipped, 0 todo; +herdr-run-fallback (73), +herdr-settings-levels (24); no defects | 1.3.l1-sqa-engineer-to-orchestrator.handback.md |
| 1.5.1.l2 | docs update: run-in-pane results (in progress) | documentation-writer | done (passed) · 3 docs + generated Copilot README | 1.5.1.l2-documentation-writer-to-orchestrator.handback.md |
| 1.2.l2 | fix round 2: SIGHUP, unref kill timer, marker wrap | agent-manager | done (passed) · a7e8068; + stdout EPIPE listener (beyond brief); checks exit 0, 1220 / 1216 / 0 fail | 1.2.l2-agent-manager-to-orchestrator.handback.md |
| 1.3.l2 | re-test, round 3 / 3 | sqa-engineer | done (passed) · 3c01bf0 herdr-run-fix2 (47); 1267 / 1260 pass / 0 fail / 7 skipped; no defects; manual mutation checks reverted (production clean) | 1.3.l2-sqa-engineer-to-orchestrator.handback.md |
| 1.4.1.l2 | re-review standards, round 3 / 3 | code-reviewer | done (passed) · **APPROVE**; Warning + 2 Suggestions closed; EPIPE listener sound; 1 optional Suggestion (stderr guard) accepted as is | 1.4.1.l2-code-reviewer-to-orchestrator.handback.md |
| 1.5.1.l3 | docs: remove in-progress markers (status done) + plugins.md:84 wording | documentation-writer | done (passed) · 915b66b | 1.5.1.l3-documentation-writer-to-orchestrator.handback.md |
| 1.4.1.l1 | re-review standards, round 2 / 2 | code-reviewer | done (passed) · **approve**; round-1 findings closed; 1 Warning: SIGHUP regression (detached child orphaned if herdr closes the pane, herdr.mjs:711-715, unverified); 2 Suggestions (unref kill timer; marker wrap test) → human (review limits used up) | 1.4.1.l1-code-reviewer-to-orchestrator.handback.md |
| 1.4.2.l1 | re-review spec, round 2 / 2 | code-reviewer | done (passed) · **APPROVE**; W1, W2 closed; all amended / new ACs evidenced; 3 Suggestions (retag settings tests, AC-22 check weak, Copilot Skill("herdr") carry-over) | 1.4.2.l1-code-reviewer-to-orchestrator.handback.md |
| 1.5.2.l1 | re-critique docs, round 2 / 2 | brutal-critique | done (passed) · **PASS**; M1, M2, Minor 1 closed; 1 Minor (docs/plugins.md:84 `--agent` wording vs READMEs) — cosmetic, fold into the final docs stage | 1.5.2.l1-brutal-critique-to-orchestrator.handback.md |
| 1.5.1.l1 | docs fix: teammate panes (critique Minor 1) | documentation-writer | done (passed) · 3 docs + generated Copilot README, 1 line each; uncommitted (git locked) | 1.5.1.l1-documentation-writer-to-orchestrator.handback.md |
| 1.4.2 | code review, spec, round 1 / 2 | code-reviewer | done (passed) · **approve**; W: AC-11 recovery (known); W: SKILL.md:130 (known); S: AC-10 vs D4 → human; S: settings above AC-5 → human; S: Copilot dangling Skill("herdr") (accepted, guarded) | 1.4.2-code-reviewer-to-orchestrator.handback.md |
| 1.5.1 | docs (README herdr entry, in progress) | documentation-writer | done (passed) · bc834ea; 3 READMEs + docs/plugins.md marked in progress | 1.5.1-documentation-writer-to-orchestrator.handback.md |
| 1.5.2 | critique (docs of 1.2, 1.2.1, 1.5.1), round 1 / 2 | brutal-critique | done (passed) · **PASS** with 2 Major (M1 SKILL.md:71/135 no recovery branch when line 1 is not the handoff line → store failed hand-back, re-spawn with Agent; M2 SKILL.md:130 "nothing beyond Agent" overstated) + Minor 1 (READMEs: teammate pane stays until shutdown) → next fix round with test / review findings; Minors 2-5 acceptable | 1.5.2-brutal-critique-to-orchestrator.handback.md |

## Feature 2 status
Closed 2026-11-12: critique 2.5 PASS; the human kept the memory-only write rule for brutal-critique and research-assistant (Minor 1 resolved as "keep"). Minor 5 (build-copilot NotebookEdit→edit alias quirk) → backlog item at run close.

## Feature 2 (joined 2026-11-12): Write and Edit for every agent
Request (human, after 1.1.3's write was refused): "give every agent the Write tool, edit tool, and multiple file edit tool so that they can write files. its a part of this run." Then: "both. skip multiedit now." Clarified: (a) agent-manager adds Write and Edit to every plugin agent that lacks them (read-only agents gain write access, the human accepted the role change); MultiEdit skipped; (b) for this run, every writing agent is spawned with worktree isolation, because the refusal ("parent bg session hasn't isolated yet, so writes to the shared checkout are blocked") is environmental, not a missing tool. Orchestrator merges each worktree branch after checking it.
Lifecycle: AAWH (change set 2.2 = 5 docs + 3 generated, no code). Root 2.
Change kinds (2.2): docs — 5 plugins/claude/ai-dlc/agents/*.md; generated — 3 plugins/copilot/ai-dlc/agents/*.agent.md.

| Step | Stage | Agent | Status | Record |
|---|---|---|---|---|
| 2.2 | change | agent-manager (worktree) | done (passed) · Write+Edit added to brutal-critique, code-reviewer, research-assistant (disallowedTools narrowed), requirement-analyst, system-engineer; d8e19a8 ff-merged | 2.2-agent-manager-to-orchestrator.handback.md |
| 2.5 | critique (docs), round 1 / 2 | brutal-critique | done (passed) · **PASS**; 5 Minor: (1) brutal-critique / research-assistant prose limits Write+Edit to own memory → asked the human; (2) code-reviewer could say "own memory only" (optional); (3) orchestrator.md:130 wording, (4) workflow.json stage notes "read-only" — acceptable, fix when next touched; (5) build-copilot NotebookEdit→edit alias quirk → backlog item at close | 2.5-brutal-critique-to-orchestrator.handback.md |

## Decisions after review (human, 2026-11-12)
- AC-10: "research and implement one as a main and another one as fallback" — result file and pane read; main chosen by research / LLD 1.1.6.l2.
- Settings above AC-5: "ok, add those ACs" → product-owner 1.1.3.l1 (AC-16+).

## Change kinds (1.2)
- code: herdr.mjs, herdr.schema.json, tools/claude-only-skills.json, tests/build-copilot-hooks-module.test.mjs
- docs: herdr/SKILL.md, agents/orchestrator.md, agent-invocation, request-routing, CLAUDE.md, .claude/rules/plugin-development.md, AGENTS.md (root, hand-rendered)
- generated: .github/instructions twin, init AGENTS templates, Copilot outputs, README Commands rows, .ai-dlc/catalog.json (catalog check exit 0)

## Decisions
- 2026-11-12, human: writing agents run with worktree isolation for this run; orchestrator merges their branches.
- 2026-11-12: worktrees are created from main, not feat/ai-dlc-lens; both agents reset their branch to a520afa first.
- 2026-11-12, human: set `worktree.bgIsolation: none` in the main repo `.claude/settings.local.json`; agents now write to the checkout directly; an agent that uses a worktree copies that file into it. Worktree isolation no longer required.
- 2026-11-12, human (O1): the herdr setting also accepts `off` (mode: watch default | run-in-pane | off).
- 2026-11-12, human: commits are GPG-signed; signing timed out until the human unlocked GPG. Agents never disable signing.
- 2026-11-12, human (U1): fallback detection — active on HERDR_ENV=1, or, when missing, herdr server running AND this session's pane identified reliably; else inactive. Changes AC-4.
- 2026-11-12, orchestrator: 1.1.3 hand-back accepted as the intent artifact (content complete; only the file write failed).

## Next action
**Current (2026-11-14):** follow-up reviews all passed (critique PASS round 2; standards APPROVE with S1-S4 accepted open by the human; spec PASS, Warning documented). Team shut down (am-h3, bc-h3 requested). devops-engineer step 3 commits and pushes; then status done.
