---
step: 7
from: orchestrator
to: human
date: 2026-11-14
run: AI-DLC-20261113-preview2-specsmd (run.v1.1.md)
stage: Gate G3 — bolt design and task plan (approver: human)
verification: pending (the human's decision)
---

# G3: approve the bolt design and task plan

Branch `plan/preview2`, worktree `.worktrees/preview2-planning`, HEAD `c4b5c22` (G2). Nothing below is committed; on approval devops-engineer commits the G3 records, the bank files and feature 6.

## What is up for approval
- Spec revision delta r1: `memory-bank/product/specs/001-preview2-specsmd.spec.r1-delta.md` (the frozen spec itself is untouched; r1 applies on approval). One new AC (AC-16.6), one AC clarification (AC-15.2), R8 amended.
- 31 stories (25 engine, 6 lens) and 14 bolts: `memory-bank/product/intents/001-preview2-specsmd/units/{engine,lens}/{stories,bolts}/`.
- Task plan `memory-bank/project/plans/001-preview2-specsmd.tasks.md`; backlog `memory-bank/project/backlog.md`.

## Gate evidence
| Step | Who | Verdict | Record |
|---|---|---|---|
| bolt design | software-architect | 31 stories, 13 → 14 bolts | 1.1.23 |
| split-design (two runs, reconciled) | system-engineer; software-architect | reconciled C-1…C-7 | 1.1.24, 1.1.24.1, 1.1.28 |
| product questions | product-owner | R-3, R-8, O-4 decided | 1.1.25 |
| estimate | software-engineer | ~44 d elapsed (39.5 if 012 starts early), range low-confidence | 1.1.26, 1.1.31 |
| order; 012 split | product-owner | W1–W6; 012/014; 012 in W3 non-blocking | 1.1.27, 1.1.29 |
| spec delta r1 content; clarify C1–C4 | requirement-analyst; product-owner; software-architect | closed | 1.1.30, .1, .2 |
| backlog + plan content | product-manager | done | 1.1.31 |
| bank files written; fix round | documentation-writer | done | 1.5.l4.1, 1.5.l4.3 |
| gate critique round 1 | brutal-critique ×3 | REVISE / PASS(4M) / REVISE | 1.5.l4.2.1–.3 |
| gate critique round 2 (last) | brutal-critique ×3 | PASS / PASS / PASS, 0 Blocker, 0 Major | 1.5.l4.4.1–.3 |
| feature 6 (D42) | product-owner → agent-manager → brutal-critique | PASS round 1 | 6.1.1, 6.2, 6.5 |

Every hand-back verified (line 1 passed; files and git state checked by the orchestrator).

## Open Minors (accepted unless the human says otherwise)
- Delta: index row 4.3 and line 431 still say "mixed row"; index order 7.1/6/7.2; AC file lines 9, 64, 74 mention closed O-ids (history).
- Plan: the W-table row sums still lead with 39.5 d; ADR-0015 cites D39 for "decided at G2" (D39 is the G2 decision on the migrate skill name, after D38).
- Backlog: ITEM-111 status (plan says delivered at G2) and ITEM-126 lifecycle/agent chain — product-manager after G3.
- Feature 6: four Minors on AGENTS.md wording.

## Decisions the human gives at G3
1. Approve G3 (stories, bolts, task plan, r1 delta) — yes / no / changes.
2. AC-16.6 (`windows-latest` `node --test` job in bolt 009): accept? And does a red Windows job block merge, or run non-blocking until its follow-up (critique .1 round 2, Minor 2)?
3. Bolt 001 spike: 2–4 h of the human's time on days 1–2 of W1?
4. Bolt 012 in W3 under the non-blocking rule (needs W3 bolts to run in parallel)?
5. Feature 6 follow-ups: other `artifacts` keys stay at `docs/…`; old `docs/handoffs/` folders stay; the four AGENTS.md Minors; an ITEM id for it?
