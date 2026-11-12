---
run: AAWP-20261112-herdr-skill
status: active
lifecycle: AAWP
mode: subagent
branch: feat/ai-dlc-lens
session: session_01UvATr6zeybknGfETHs416Y
commit: 3514805
last-record: 1.1.6-orchestrator-to-system-engineer.handoff.md
updated: 2026-11-12
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

## Routing
Agent Artifact (plugin skill + orchestrator / agent-invocation / request-routing wiring; likely a script) → AAWP. No work breakdown (AAW). Mode: subagent.

## Gates and loops
AAWP/lld 2/1 · AAWP/test 2/1 · AAWP/code-review 2/1 · AAWP/critique 2/1 · clarify 2/1 (from `rounds --json`, source `loop`). AAWP has no gates.

## Stages
| Step | Stage | Agent | Status | Record |
|---|---|---|---|---|
| 1.1.1 | research: what herdr is | research-assistant | done (passed) | 1.1.1-research-assistant-to-orchestrator.handback.md |
| 1.1.2 | research: plugin fit | research-assistant | done (passed) | 1.1.2-research-assistant-to-orchestrator.handback.md |
| 1.1.3 | intent | product-owner | done (failed write; content accepted) · ACs 1-15 in the hand-back, which stands as the intent artifact (orchestrator decision 2026-11-12; 1.1.3-intent.md not written) | 1.1.3-product-owner-to-orchestrator.handback.md |
| 1.1.4 | design | software-architect (worktree) | done (passed) · design + ADR-0010 (Proposed); D1-D9; open Q1-Q5 → 1.1.5.x; O1 → human: add `off` | 1.1.4-software-architect-to-orchestrator.handback.md |
| 1.1.5.1 | clarify: herdr CLI (Q1) | research-assistant | done (passed) · syntax confirmed (0.9.5); unknown: no-server behaviour, liveness call, Windows transport/shell, rename/run/close output → live probes at 1.1.6 | 1.1.5.1-research-assistant-to-orchestrator.handback.md |
| 1.1.5.2 | clarify: Claude Code (Q2-Q5) | research-assistant | done (passed) · subagent jsonl path; -p Manual mode, --allowedTools / --permission-prompts none; claude.exe native; unknown: -p --agent plugin load, live jsonl growth, session id in Bash → live probes at 1.1.6 | 1.1.5.2-research-assistant-to-orchestrator.handback.md |
| 1.1.6 | low-level design (+ live probes) | system-engineer | in-progress | 1.1.6-orchestrator-to-system-engineer.handoff.md |
| 1.2 | change | agent-manager | pending | — |
| 1.3 | test (code) | sqa-engineer | pending | — |
| 1.4.1 / 1.4.2 | code review standards / spec | code-reviewer ×2 | pending | — |
| 1.5.1 | docs | documentation-writer | pending | — |
| 1.5.2 | critique (docs) | brutal-critique | pending | — |

## Feature 2 (joined 2026-11-12): Write and Edit for every agent
Request (human, after 1.1.3's write was refused): "give every agent the Write tool, edit tool, and multiple file edit tool so that they can write files. its a part of this run." Then: "both. skip multiedit now." Clarified: (a) agent-manager adds Write and Edit to every plugin agent that lacks them (read-only agents gain write access, the human accepted the role change); MultiEdit skipped; (b) for this run, every writing agent is spawned with worktree isolation, because the refusal ("parent bg session hasn't isolated yet, so writes to the shared checkout are blocked") is environmental, not a missing tool. Orchestrator merges each worktree branch after checking it.
Lifecycle: AAWH (change set 2.2 = 5 docs + 3 generated, no code). Root 2.
Change kinds (2.2): docs — 5 plugins/claude/ai-dlc/agents/*.md; generated — 3 plugins/copilot/ai-dlc/agents/*.agent.md.

| Step | Stage | Agent | Status | Record |
|---|---|---|---|---|
| 2.2 | change | agent-manager (worktree) | done (passed) · Write+Edit added to brutal-critique, code-reviewer, research-assistant (disallowedTools narrowed), requirement-analyst, system-engineer; d8e19a8 ff-merged | 2.2-agent-manager-to-orchestrator.handback.md |
| 2.5 | critique (docs), round 1 / 2 | brutal-critique | done (passed) · **PASS**; 5 Minor: (1) brutal-critique / research-assistant prose limits Write+Edit to own memory → asked the human; (2) code-reviewer could say "own memory only" (optional); (3) orchestrator.md:130 wording, (4) workflow.json stage notes "read-only" — acceptable, fix when next touched; (5) build-copilot NotebookEdit→edit alias quirk → backlog item at close | 2.5-brutal-critique-to-orchestrator.handback.md |

## Decisions
- 2026-11-12, human: writing agents run with worktree isolation for this run; orchestrator merges their branches.
- 2026-11-12: worktrees are created from main, not feat/ai-dlc-lens; both agents reset their branch to a520afa first.
- 2026-11-12, human: set `worktree.bgIsolation: none` in the main repo `.claude/settings.local.json`; agents now write to the checkout directly; an agent that uses a worktree copies that file into it. Worktree isolation no longer required.
- 2026-11-12, human (O1): the herdr setting also accepts `off` (mode: watch default | run-in-pane | off).
- 2026-11-12, orchestrator: 1.1.3 hand-back accepted as the intent artifact (content complete; only the file write failed).

## Next action
Feature 2 done (PASS); Minor 1 (memory-only wording) open with the human. Wait for 1.1.6 (system-engineer LLD); then 1.2 agent-manager change. Note: the 2.2 tool change needs /reload-plugins to take effect (research-assistant still lacked Write at 1.1.5.2).
