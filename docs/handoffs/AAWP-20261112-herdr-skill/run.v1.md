---
run: AAWP-20261112-herdr-skill
status: active
lifecycle: AAWP
mode: subagent
branch: feat/ai-dlc-lens
session: session_01UvATr6zeybknGfETHs416Y
commit: c0b08c7
last-record: 2.2-orchestrator-to-agent-manager.handoff.md
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
| 1.1.4 | design | software-architect (worktree) | in-progress | 1.1.4-orchestrator-to-software-architect.handoff.md |
| 1.1.5 | low-level design | system-engineer | pending | — |
| 1.2 | change | agent-manager | pending | — |
| 1.3 | test (code) | sqa-engineer | pending | — |
| 1.4.1 / 1.4.2 | code review standards / spec | code-reviewer ×2 | pending | — |
| 1.5.1 | docs | documentation-writer | pending | — |
| 1.5.2 | critique (docs) | brutal-critique | pending | — |

## Feature 2 (joined 2026-11-12): Write and Edit for every agent
Request (human, after 1.1.3's write was refused): "give every agent the Write tool, edit tool, and multiple file edit tool so that they can write files. its a part of this run." Then: "both. skip multiedit now." Clarified: (a) agent-manager adds Write and Edit to every plugin agent that lacks them (read-only agents gain write access, the human accepted the role change); MultiEdit skipped; (b) for this run, every writing agent is spawned with worktree isolation, because the refusal ("parent bg session hasn't isolated yet, so writes to the shared checkout are blocked") is environmental, not a missing tool. Orchestrator merges each worktree branch after checking it.
Lifecycle: AAWH or AAWP picked from the change set (agent frontmatter = docs; generated Copilot files). Root 2.

| Step | Stage | Agent | Status | Record |
|---|---|---|---|---|
| 2.2 | change | agent-manager (worktree) | in-progress | 2.2-orchestrator-to-agent-manager.handoff.md |
| 2.5 | critique (docs) | brutal-critique | pending | — |

## Decisions
- 2026-11-12, human: writing agents run with worktree isolation for this run; orchestrator merges their branches.
- 2026-11-12, orchestrator: 1.1.3 hand-back accepted as the intent artifact (content complete; only the file write failed).

## Next action
Wait for 1.1.4 (architect) and 2.2 (agent-manager), both in worktrees; verify, merge branches, then 1.1.5 (system-engineer) and 2.5 (critique).
