---
step: 3
from: orchestrator
to: human
date: 2026-11-13
run: AI-DLC-20261113-preview2-specsmd (run.v1.md)
gate: G1 (stories / ACs) — approver: human
verification: approved — human, 2026-11-13: "G1 approved"
---

# G1 — intent 001 (preview2): requirements, acceptance criteria, backlog

## The artifacts to approve (worktree `.worktrees/preview2-planning`, branch `plan/preview2`)
- `memory-bank/product/intents/001-preview2-specsmd/requirements.md` — intent, outcomes, FR-1…FR-16, scope, priorities, definition of done
- `memory-bank/product/intents/001-preview2-specsmd/acceptance-criteria.md` — numbered ACs per FR, decided clarifications, questions open for G2, draft glossary
- `memory-bank/project/backlog.md` — milestone `1.0.0-preview2`, ITEM-111…ITEM-124, and ITEM-125 (1.0.0)
- `memory-bank/product/intents/001-preview2-specsmd/inception-log.md`, `memory-bank/README.md`

## Gate evidence
- Product-owner: **Accepted** (1.1.12), conditional on the FR-5 wording — applied in 1.5.l1.3 (requirements.md:39 checked).
- Brutal-critique: **PASS** round 1 (1.5.2) and round 2 (1.5.l1.2, the gate-critique limit of 2 rounds); 0 Blockers. Round-2 Majors (FR-5; AC-15.2/15.3/15.5 consistency) and 8 Minors applied in 1.5.l1.3 **without a third critique round** (limit reached) — the human may accept as is or raise the limit for one more round.
- Traceability (critique round 2, check 3): every FR has ACs; every intent AC maps to a backlog AC; every cited AC exists.
- Planning only: the worktree diff contains only `memory-bank/` and `execution-plans/` (git status checked); no plugin, hook, skill, schema, tool or test changed.
- Decisions D1–D12: `decisions-2026-11-13.md`.

## Known open items (not blocking G1; owners named)
- G2 (software-architect): C-4 validate checks bank folders?, C-5 frontmatter checks, C-7 migration entry point, C-8 event file format / records-as-events, C-9 lens drift, C-13 does the Copilot build copy NOTICE; bolt-type mapping (product-owner preference: stage templates inside lifecycles).
- Unit 5: C-14 remove the stale `.handoff/config.md`?
- Release and 1.0.0 follow-up priority (P1) is product-manager's proposal for product-owner to confirm.
- Commit `2` (run start) landed as 18b160c (signed); records after it and `memory-bank/` are committed after the G1 decision.

## Decision
Approve G1 → unit design (ASDLC; G2). Reject → state what to change.
