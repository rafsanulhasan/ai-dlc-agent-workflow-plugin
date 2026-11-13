---
name: preview2-specsmd-decisions
description: 2026-11-13 preview2 direction — specsmd adapted natively, memory-bank product/project, execution-plans with typed events, doc-writer sole author, keep ai-dlc id
metadata:
  type: project
---

Preview2 (`1.0.0-preview2`) adapts specsmd (fabriqaai/specs.md, MIT) natively: intents → units → bolts, `memory-bank/product` (the product) and `memory-bank/project` (DevOps flows, harness engineering, other non-product work), and `execution-plans/` replacing `docs/handoffs/` with bolt execution plans and typed events (command, handoff, handback, verdict, escalation). Stage agents own their content, but documentation-writer is the **sole author** of memory-bank files. Deterministic runtime that wakes agents is deferred past preview2. The `ai-dlc` id, prefixes, `.ai-dlc/` and `AI_DLC_*` stay; a brand name (ForgeLine, Boltwright, Intently…) is a later decision after a clash check. Planning happens in worktree `.worktrees/preview2-planning`, branch `plan/preview2` (from `feat/ai-dlc-lens` 47a3480), using specsmd's own steps: intent → unit design → bolt design.

**Why:** the human's answers on 2026-11-13, after comparing their Copilot chat ("Costs of Idle Dependent Agents", which never mentions specsmd), the specsmd research and the repo evidence; records in `.scratch/preview2-specsmd/`.

**How to apply:** route preview2 work to these decisions; any change to them goes back to the human. The specsmd model has internal inconsistencies (bolt folder naming, status values) — we fix, not copy. See [[mods-release-scope]] for the earlier "everything in preview1" decision this supersedes for new work.

Round 2 (2026-11-13): preview1 ships first with the docs/ layout; this redesign is `1.0.0-preview2`. This repo dogfoods memory-bank/ and execution-plans/ now, for preview2 planning. preview2 reads old docs/ paths for one release (with a warning), dropped in 1.0.0. The backlog moves to `memory-bank/project/`.

Run location (until units 5/6 land): the preview2 planning run is `execution-plans/AI-DLC-20261113-preview2-specsmd/` inside worktree `.worktrees/preview2-planning` — run discovery under `docs/handoffs/*/` will not find it; check there by hand at session start.

Planning only: the human said on 2026-11-13 "make plan only, don't implement anything yet". Building units waits for their explicit go after G3.

After G1 (2026-11-13, D14–D18): two product units, **ai-dlc-engine** and **ai-dlc-lens**; the `ai-dlc` plugin is **renamed to `ai-dlc-engine`** in preview2 (reverses the keep-the-id decision; prefixes become `ai-dlc-engine:`, memory folders `ai-dlc-engine-<agent>`); the **marketplace is renamed too** (name TBC at G2); `.ai-dlc/` and `AI_DLC_*` stay as family names; repo rename later. G1 approved 2026-11-13 (commit 41c769a on plan/preview2); rename handled as a G1 amendment.
