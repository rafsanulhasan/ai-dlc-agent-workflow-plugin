---
run: FEAT-20261020-ai-dlc-lens
work-item: ITEM-004
lifecycle: AI-DLC
step: 7
from: orchestrator
to: brutal-critique
mode: subagent
loop: none
gate: none
verification: passed
date: 2026-10-22
---

# 7 orchestrator → brutal-critique: critique the ai-dlc-lens product brief (PDLC `brief`, gate-critique round 1 of 2)

## Goal
An adversarial read of the product brief before requirement-analyst builds stories on it, so vague outcomes, gaps and contradictions with the human's decisions are caught now.

## Artifacts
Paths are relative to the worktree `E:\Projects\personal\ai-dlc-agent-workflow-plugin\.worktrees\ai-dlc-lens`.
- `docs/product/ai-dlc-lens/brief.md` — **the document under critique** — verified: exists, 13 sections. F1–F14 are traced to ITEM-003…026. Revised in step 6 for C1–C3: preview1, awareness, images.
- `docs/handoffs/FEAT-20261020-ai-dlc-lens/00b-approved-plan-2026-10-22.md` — the human-approved plan. Its *Your decisions* and *Merged field set* sections are binding, and the brief must not contradict them — verified: exists
- `docs/handoffs/FEAT-20261020-ai-dlc-lens/run.md`, *Open clarifications* rows 4–6 — later human decisions — verified:
  - C1: everything ships in 1.0.0-preview1, with no cut
  - C2: awareness included, on by default
  - C3: avatar images allowed, with the trust check and an initials fallback
- `docs/backlog/backlog.md`, section *FEAT-20261020-ai-dlc-lens* — the items the brief traces to — verified: ITEM-003…026
- Research hand-backs `3.1`–`3.5` and `4.2`–`4.5` in the run folder — the facts the brief's risks rely on — verified: all `passed`

## Gate evidence
- Gate: none here. G1 (human) comes after stories, backlog and product-owner acceptance.
- Loop: gate-critique, at most 2 rounds and 1 failure (source `default`, from `rounds --json`).

## Decisions so far
- See `00b` and the C1–C3 rows above. Do not critique a human decision itself; critique whether the brief states it correctly and completely, and what it implies (risks, gaps).

## Suggested skills
- None beyond your own critique method.

## Instructions for the receiver
Critique `brief.md` only. Read-only: do not edit any file. Check:
1. Fidelity to the binding decisions and to C1–C3.
2. That every feature traces to an item and every item to a feature.
3. That outcomes and success measures are testable, not vague.
4. That scope and out-of-scope don't contradict each other.
5. That the risks match the research findings: unproven VS Code behaviours, no cross-plugin state API, two price tables, the version floor (2.1.287 / 2.1.290 / 2.1.299), the cache prefix with awareness on, the image render path, the schedule with no cut.
6. That the delegation list gives requirement-analyst and product-manager what they need.

Deliverable: a compressed reply.
- Line 1 exactly: `handoff 7-orchestrator-to-brutal-critique.handoff.md: passed|failed — <why>`.
- Then the verdict: `PASS` or `REVISE`.
- Then the findings, one per line: severity (Blocker / Major / Minor) · `brief.md:<line>` · problem · fix.
- At most 40 lines.
- Next hop: REVISE goes back to product-owner; PASS lets requirement-analyst start the stories.
