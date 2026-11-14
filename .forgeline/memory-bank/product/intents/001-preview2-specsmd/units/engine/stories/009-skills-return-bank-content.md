---
id: 009-skills-return-bank-content
unit: engine
intent: 001-preview2-specsmd
status: draft
priority: must
bolt: 003-engine-authorship-rule
created: 2026-11-14
---

# engine/009 — Skills return bank content plus a Docs update request

**Planned:** nothing here is built yet. The story belongs to [bolt 003-engine-authorship-rule](../bolts/003-engine-authorship-rule/bolt.md), which has not started (G3 pending).

## Story

As a stage agent, I want my skills to return content plus a *Docs update* request instead of writing the bank, so that I never break the single-writer rule.

## Acceptance criteria

- AC-7.6

## Technical notes

- It changes `write-adr`, `spec-driven-development`, `product-planning` and the glossary writes of `requirement-analysis`.
- It includes the grep check.
- Per the legacy-path rule (S-7), it clears the legacy `docs/…` paths in the skills it edits.
