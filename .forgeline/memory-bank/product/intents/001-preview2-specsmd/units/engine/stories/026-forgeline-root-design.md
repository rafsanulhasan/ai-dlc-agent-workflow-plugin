---
id: 026-forgeline-root-design
unit: engine
intent: 001-preview2-specsmd
status: ready
priority: must
bolt: 015-engine-forgeline-root
created: 2026-11-14
---

# engine/026 — The `.forgeline/` root is designed and approved before any code

**Planned:** nothing here is built yet. The story belongs to [bolt 015-engine-forgeline-root](../bolts/015-engine-forgeline-root/bolt.md), which has not started (G3 approved, 2026-11-14, D79).

## Story

As the product owner, I want the `.forgeline/` root recorded in an ADR and in a spec revision that I approve before code is written, so that the reversal of D16 is a deliberate, reviewed decision.

## Acceptance criteria

- AC-18.1 (ITEM-127 AC-1; G1 amendment D69, approved at G3, 2026-11-14 (D80))

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- New ADR-0018: the `.forgeline/` root and the reversal of D16 for the `.ai-dlc/` folder only. It records the sub-layout the human decided (D70: `.forgeline/ai-dlc/`, `.forgeline/cost-saving/`, `.forgeline/models/claude/`) and does not decide it.
- It supersedes the `.ai-dlc/` "Unchanged" row of ADR-0015 and its matching "Alternatives rejected" bullet, and amends ADR-0013: the bank root is part of `ARTIFACT_TYPES` and the area rule reads `<bankRoot>/<area>/`.
- Spec delta r3 changes §2.1, §2.2, §2.3, §3, §10, §11, §16 and §16.1 (r2 is taken by the ADR-0017 and D64 delta): §16 gets bolt 015 and the new Requires of 009, 010, 011 and 014, and §16.1 gets the parts AC-15.8[forgeline-root], AC-15.8[forgeline-root-lens], AC-16.4[015], AC-18.4[engine], AC-18.4[lens], AC-18.7[layout], AC-18.7[name], AC-18.10[hook and metadata copies] (bolt 015), AC-18.10[config files] (bolt 014) and AC-18.10[runs] (ITEM-121). The `Old` text of r3 for spec:62, 79, 80, 127 and 128 is the `New` text of delta r2. The human approves r3 as a G2 amendment before any code is written.
- The `.forgeline/` root itself is a G1 amendment (D69): FR-18 with AC-18.1 to AC-18.12.
