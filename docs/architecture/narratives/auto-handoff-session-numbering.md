---
feature: auto-handoff-session-numbering
root: 16
audience: product owner, plugin maintainer
author: software-architect
date: 2026-10-24
spec: docs/specs/auto-handoff-session-numbering.spec.md
---

# Narrative: session numbers that survive a lost store

## Act 1: the problem

When a session runs out of context, the module hands it off to a fresh one and names both `P: B (Session n)`. The number tells you where you are in a chain. Today the number comes only from a record in the module's store. If that record is gone (the store was lost, or the session was resumed under a new id), the module names the session Session 1, even when its title clearly says Session 7. If the record is old and has no depth, the module names nothing. So you can see the same number twice in one chain, or no number at all (14.1.11, section 3).

## Act 2: constraints and choices

- **C1, human decision.** The number in the title wins. The store is used only when the title has no number (00c, root 16).
- **C2.** The store can fail or be empty. Engine facts about the store's durability are unverified (brief, risks), so the design cannot rely on the store.
- **C3.** Only the main session may be renamed. Renaming a numbered session would undo a name the user can see.
- **C4.** A store failure must be visible to the user (Q16-3).
- **Alternatives.**
  - (a) Keep the store as the source of the number and repair it. Rejected: this breaks C1 and depends on C2.
  - (b) Title first, then the store, then 1. Chosen.
  - (c) The title only, never the store. Rejected: a session the user renamed without a number would restart at 1, against AC-16.2.8.
- **Trade-off.** If the user types a wrong number into a title, that number wins. This is accepted, because it follows C1.

## Act 3: the design

- **D1 and D2 (from C1).** Two small pure functions. One reads the title. The other turns "title number, else store depth, else 1" into the current number, the next number and whether this is the main session.
- **D3 and D6 (from C2 and C4).** The store read now says *failed* rather than pretending nothing was there. A failure produces exactly one notice: one log line, plus a panel step that stays on screen across the `/clear` (or a single toast where the band is not drawn). On a failed read, the module renames nothing.
- **D4 (from C3).** Only the main session is renamed.
- **D5 (from C2).** The handoff works the number out once and carries it across the `/clear`. The store is not read a second time, so one handoff cannot produce two different numbers.

- **D7 (from C1).** The attribution record and the setting's description state the new rule, so the next change does not bring back the old one.

ADRs: none. This is a bug-fix rule and easy to reverse.

Risks:
- The live symptom was not reproduced from code alone (14.1.11, Confidence Medium). Failing tests come first, and runtime checks stay in `ATTRIBUTION.md`.
