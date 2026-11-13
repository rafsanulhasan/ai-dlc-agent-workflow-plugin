---
name: preview2-unit-design
description: AI-DLC-20261113-preview2-specsmd unit design 1.1.14 + refine 1.1.20: two units (ai-dlc-engine upstream, ai-dlc-lens), records-as-events, bolt types as stage subsets with skip semantics, spike bolt first, ADR drafts 0011-0016; template stage-id facts
metadata:
  type: project
---

Unit design 1.1.14, refined 1.1.20 (2026-11-13, worktree `.worktrees/preview2-planning`, branch plan/preview2) for intent 001 / preview2. Proposed, G2 pending. Units ai-dlc-engine (owns the contract) and ai-dlc-lens (consumer). Events = the records themselves. Bolt types = named subsets of existing lifecycle stage ids; a stage outside the subset is skipped like a false `when`; optional per-type `after` override (spike). Lens owns five commands (show, configure, init, kit, gate); lens-keepalive -> engine `cache-keepalive-lens` (D24); `/ai-dlc-engine:migrate` skill is the migration entry point (D25). Bolt 001 = rename spike. ADR drafts 0011-0016 returned as text (documentation-writer writes bank files).

**Why:** human decisions D14-D25; documentation-writer is sole author of memory-bank/ (D2), so the architect returns ADR text, never writes it.

**How to apply:** verified template facts (plugins/claude/ai-dlc/skills/workflow/templates/workflow.json): PDLC has no `research` stage; ASDLC `research` and `architecture` both `after: []`; `critique` is a stage only in AAWH/AAWP (elsewhere a `critique: true` flag); AAWP stages intent, design, lld, change, test, code-review, docs, critique; STBLC split, split-design, estimate, order(G3). research-assistant has `disallowedTools: Bash`, so live spikes need another agent. AC-17.10(e) says MEMORY.md is union-merged (system-engineer's LLD said conflict; the AC wins). Earlier repo facts: lens hard-codes `ai-dlc:` (lens.ts:2514), roster path (settings.ts:31); build copies no plugin-root NOTICE (build-copilot.mjs:287-295). Related: [[herdr-design-adr0010]].
