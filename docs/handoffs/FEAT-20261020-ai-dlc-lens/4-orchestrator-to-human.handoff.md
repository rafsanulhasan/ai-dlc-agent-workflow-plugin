---
run: FEAT-20261020-ai-dlc-lens
work-item: ITEM-004
lifecycle: AI-DLC
step: 4.1 (renumbered 2026-10-24 from 11; 11)
from: orchestrator
to: human
mode: subagent
loop: none
gate: G1
verification: pending
date: 2026-10-23
---

# 11 orchestrator → human: G1 — approve the ai-dlc-lens stories and acceptance criteria

## Goal
Your approval of the user stories and their acceptance criteria. Every later stage builds and tests against them: the spikes, the spec at G2, the task plan at G3, the code, and the review at G4.

## Artifacts
Paths are relative to the worktree `.worktrees/ai-dlc-lens` (branch `feat/ai-dlc-lens`).
- **`docs/product/ai-dlc-lens/stories.md`** — the artifact to approve — verified by the orchestrator:
  - 21 stories (US-1…US-21)
  - 144 ACs, each with one test route: `claude plugin test` 96 · `node --test` 16 · build/validate 11 · document check 11 · manual VS Code check 10
  - a traceability table, the M1–M13 map, a settings register with types and allowed values, a *Decisions* table Q1–Q12, and assumptions A1–A24
- `docs/product/ai-dlc-lens/brief.md` — the product brief (F1–F14, UC1–UC9, O1–O6, risks, release target 1.0.0-preview1 with no cut)
- `docs/backlog/backlog.md`, section *FEAT-20261020-ai-dlc-lens* — ITEM-003…029:
  - milestone 1.0.0-preview1
  - spikes 027 (VS Code) and 029 (avatar image) before G2
  - spike 028 (keep-alive) conditional on the fold merge

## Acceptance criteria covered
| AC | Where it is satisfied / tested |
|---|---|
| All 144 | `stories.md`; each AC names its test route. Nothing is built yet. |

## Gate evidence
- Build / tests / mutation: n/a (planning artifacts only)
- Critique:
  - brief: brutal-critique REVISE (`7`), then PASS (`7.l1`)
  - stories: REVISE (`9.1`), then PASS (`9.1.l1`), then 6 precision fixes after the PASS (`8.l2`); those fixes were not re-critiqued, so skim AC-12.6 (loop arrow) and AC-12.8 (round counter)
- Product-owner acceptance: ACCEPT (`10.1`), with three non-blocking conditions:
  1. verify A14 before G2
  2. A2's "leftover" note is stale
  3. AC-1.1 fixes the parser name `parseRunState` for the architect
- Research on A14 (`10.2`):
  - `Stop` fires when the main agent finishes responding, and `SubagentStop` when a subagent does
  - `systemMessage` is documented as "shown to the user", capped at 10,000 characters
  - **How it displays in the terminal and in VS Code is undocumented.** Added to spike (a), ITEM-027, as a live check before G2.
  - Copilot has `agentStop` / `subagentStop` but no documented `systemMessage` equivalent
- Gate: G1 · approver human · presented 2026-10-23

## Decisions so far
- `00b-approved-plan-2026-10-22.md` *Your decisions*
- C1: everything in 1.0.0-preview1, no cut
- C2: context-view awareness on by default
- C3: avatar images, with the trust check and an initials fallback
- Q1–Q12: all of requirement-analyst's defaults accepted

## Open questions / risks for the receiver
The points the product-owner says to look at first:
1. **A1, sequence:** spikes (a) and (c) run between G1 and G2, adding a manual VS Code check by you before G2. Spike (b) runs only if the fold merge lands first.
2. **Size with no cut:** 21 stories, 144 ACs (10 manual), about 50 settings. The schedule risk is yours; G3 re-estimates it.
3. **Defaults that differ from upstream:**
   - the guard is `off` (cache-tax: `refuse`)
   - awareness is `on` (context-view: off)
   - `monochrome` replaces `NO_COLOR`
   - ru and he are not ported
4. **Gate alert (A13, A14):** "gate reached" means the newest record is addressed to you with a gate. The alert fires on `Stop`, and the lens polls every 2 s. VS Code display is still to be proven in spike (a).
5. **Surfaces:** the terminal gets the compact list only; Desktop gets automated tests only; avatar images may fall back to initials.
6. **Heuristics:** ledger stage attribution (A18); the loop round read from the newest *Gates and loops* row (A17).

## Instructions for the receiver
Approve G1, approve it with changes, or send it back.
- Approved: the spikes (027, 029; 028 if the fold merge has landed) run next, then the spec and design go to G2.
- Changes: tell the orchestrator which AC or assumption to change, and requirement-analyst revises it.
