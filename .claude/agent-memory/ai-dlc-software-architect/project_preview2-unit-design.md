---
name: preview2-unit-design
description: AI-DLC-20261113-preview2-specsmd unit design 1.1.14: two units (ai-dlc-engine upstream, ai-dlc-lens), records-as-events, bolt types as stage subsets, ADR drafts 0011-0016; repo facts for C-9/C-13 and rename blast
metadata:
  type: project
---

Unit design 1.1.14 (2026-11-13, worktree `.worktrees/preview2-planning`, branch plan/preview2) for intent 001 / preview2. Proposed (G2 pending): units ai-dlc-engine (owns the contract) and ai-dlc-lens (consumer); units are stable product slices with intent-scoped folders `memory-bank/product/intents/{NNN}-{slug}/units/{unit-slug}/`. Events = the records themselves (Markdown + flat frontmatter, suffix = type). Bolt types = named subsets of existing lifecycle stage ids in workflow.json (`construction-bolt`, `simple-bolt`, `spike-bolt`). Layout mode detected by presence of `artifacts.intents`. ADR drafts 0011-0016 returned as text (documentation-writer writes bank files).

**Why:** the human named the two units after G1 (D14-D18) and renamed the plugin to ai-dlc-engine; documentation-writer is sole author of memory-bank/ (D2), so the architect returns ADR text, never writes it.

**How to apply:** repo facts verified then: lens commands are thin skills in the engine plugin (`skills/lens*`, register.tsx:24-27, CMD map :219) and lens hard-codes `ai-dlc:` (lens.ts:2514) and the roster path (settings.ts:31), so the rename couples the units. build-copilot.mjs copies no plugin-root NOTICE/ATTRIBUTION (only LICENSE from repo root, :287-295). The anomaly.ts run.md drift is text-only (:88, :263, :405; settings.ts:103/109/116). Related: [[herdr-design-adr0010]].
