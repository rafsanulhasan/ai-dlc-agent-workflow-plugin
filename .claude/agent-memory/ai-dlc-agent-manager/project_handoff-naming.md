---
name: handoff-naming
description: Handoff/handback naming scheme (phase sub-roots since 2026-10-24) and writer-by-orchestration-mode rule
metadata:
  type: project
---

Decided 2026-10-21, approved by the user (runs AAW-20261021-handoff-naming and -self): every hand-off in every lifecycle, AAW included, writes a handoff record and stores a hand-back.

- Folder `docs/handoffs/{LIFECYCLE}-{YYYYMMDD}-{feature-slug}/` (LIFECYCLE = a key of the workflow file's `lifecycles`, the one list); work-item id goes in `work-item:` front matter.
- Files `{step}[.{sub}][.l{loop}]-{from}-to-{to}.handoff.md` / `.handback.md`; agent IDs only; `.sub` = parallel or nested spawns; `.l{n}` = loop round keeping the step code.
- 2026-10-23 (human, run FEAT-20261020-ai-dlc-lens step 26.l1): a related request joins the open run; each work item of any breakdown is ONE top-level step (item number = step number), its hand-offs are sub-steps that only grow (parallel ones take consecutive numbers: 5.2 + 5.3 together, then 5.4). No merge-runs procedure (one-off). Step 26.l2 (human, 2026-10-23): items start right after the run's last step (last 4 → items 5–8; new run → 1); request-wide hand-offs before the items (classify research, breakdown, PO consult) are `.0.n` of the FIRST item (`5.0.1`, `5.0.2`); a re-plan adding items is `.0.n` of the first new item; scratch records are renamed to `.0.n` on move-in. Both `.sub` meanings kept (item sub-steps vs AAW fan-out).
- Step 26.l3 (human, 2026-10-23), supersedes the 26.l2 re-plan detail: ONE cut-off, Confirm — before it, request-wide hand-offs are `.0.n` of the first item; after it, item sub-steps or the next free top-level number; gate records (G1–G4, release) and re-plans always take the next free top-level number. A joined request not broken down (an AAW change included) is ONE work item: `N.1` change, `N.2` review, `N.1.l1` fix — never a bare `N`. "Next free number" (gaps allowed, taken when first written), never "last step". `WI-n` = per-run item number, not backlog `ITEM-NNN`; backlog keeps optional `**Parent**`. Numbering stated only in handoff *Naming*; other files point to it.
- Step 11.2 (human, 2026-10-24), supersedes "each item one top-level step" for joined work: each FEATURE is one root; every hand-off for it, follow-ups included, is a sub-step (follow-up to 8 → 8.7, 8.8 flat; a follow-up broken into items → 8.7 item, 8.7.1 hand-offs). Only a new feature, a gate record or a whole-run hand-off takes the next free top-level number; reviews never. An AAW run of its own is root 1 (1.1 change, 1.2 critique). Follow-ups have no `.0`. Run state gets a *Features* table (Step | Feature | Status [| Old steps]). Versioned run.vN.md was split to step 11.3.
- Step 11.11 (human, 2026-10-24), supersedes 11.2's in-order sub-numbers: fixed PHASE sub-roots per feature N — N.1 planning, N.2 implementation (agent-manager in AAW), N.3 testing, N.4 review (N.4.1 standards, N.4.2 spec), N.5 docs (N.5.l1 = critique loop). `l<k>` = loop k per sub-root (never a round); rounds are N.3.l1.1, .2. My decisions (open to human): same code shared by different agents; .1/.2 only for same receiver spawned together; follow-up = next loop of each sub-root it touches; one fix for several loops numbered in the earliest phase's loop. Stages: one row per sub-root with Sessions + Agents columns. Old records keep names.
- Writer by mode: subagent mode (default, only mode on Copilot) — the orchestrator writes both; Claude Code agent team (request-routing Mode 5) — sender writes the handoff, receiver the hand-back; run.md is the orchestrator's alone. The receiver verifies, never the writer.

**Why:** before this, only hand-backs got written because the writer of the stage handoff was undefined and contradictory.

**How to apply:** the `handoff` skill is the source; new agents or skills that mention records must point to its *Naming* and *Who writes what* sections, not restate them. Open follow-ups: [[handoff-gaps]].
