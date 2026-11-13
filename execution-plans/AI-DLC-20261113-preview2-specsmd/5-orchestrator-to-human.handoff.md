---
step: 5
from: orchestrator
to: human
date: 2026-11-14
run: AI-DLC-20261113-preview2-specsmd (run.v1.1.md)
gate: G2 (frozen spec) — approver: human
verification: approved — human, 2026-11-14: "Approve G2"
---

# G2 — frozen spec, unit design, ADRs (intent 001, preview2)

## Artifacts (worktree `memory-bank/`)
- `product/specs/001-preview2-specsmd.spec.md` — frozen spec (17 sections, 104-AC traceability)
- `product/units.md`; `product/intents/001-preview2-specsmd/units.md`; `units/engine/unit-brief.md`; `units/lens/unit-brief.md`
- `product/decisions/ADR-0011` … `ADR-0016` (Proposed)
- `product/narratives/preview2-specsmd.md`
- `project/plans/001-preview2-specsmd.tasks.md` (13 bolts, waves W1–W6; schedule of record, finalised at G3)
- amended: `requirements.md`, `acceptance-criteria.md`, `project/backlog.md` (names D30–D37, O-15)

## Gate evidence
- Design chain: unit design 1.1.14 → LLD 1.1.19 + 1.1.19.1 → refine 1.1.20 → spec 1.1.21 (rev 3) → fix decisions 1.1.22.
- Brutal-critique: REVISE round 1 (1.5.l3.5) → PASS round 2 (1.5.l3.7, limit); 0 Blockers. Round-2 Majors 1–3 and Minors 1–9 applied in 1.5.l3.8 without a third critique (AC-17.10 (h), (i) and AC-17.14 (d)–(i) added after critique, approved here).
- Human decisions D1–D37 (`decisions-2026-11-13.md`); names: plugins `engine`, `lens`; marketplace `forgeline`; pane ids `lens-*`; keywords `specsmd, ai-dlc, forgeline, agentic-sdlc`.
- Planning only: only `memory-bank/` and `execution-plans/` changed since 8fb7f7e.

## Open items for the human (spec §17)
O-1 migrate skill name (rec. `migrate`) · O-2 drop identical legacy duplicates (rec. drop, printed) · O-3 user-level/managed settings advice only (rec. confirm) · O-5 `/lens:init`, `/lens:kit`, `/lens:gate` (rec. confirmed) · O-6 who accepts the spike hand-back (rec. the human) · O-7 spike runs as ASDLC with a one-off override before `boltTypes` exists (rec. yes; confirmed at G3) · O-15 approve the amended FR/AC text with the D30–D37 names.
Others are owned by agents (O-4 product-owner; O-9, O-10, O-12, O-21 system-engineer; O-13, O-23 spike; O-19 brand research).

## Decision
Approve G2 → commit; G3 bolt design (STBLC). Reject → state the change.
