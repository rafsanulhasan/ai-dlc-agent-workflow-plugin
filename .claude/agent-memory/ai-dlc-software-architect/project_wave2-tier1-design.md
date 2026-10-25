---
name: wave2-tier1-design
description: Tier 1 (roots 16-20) design decisions of run FEAT-20261020-ai-dlc-lens, 2026-10-24: ADR-0001..0005, codes AAWH/AAWP, taxonomy file, offline lens renderer
metadata:
  type: project
---

Wave 2 design for roots 16-20 was drafted on 2026-10-24, in team mode with se, po, pm and bc. ADRs 0001-0005 are Proposed and await G2.

- **ADR-0001.** AAW is split into `AAWH` (harness) and `AAWP` (plugin), both listed under `byType["Agent Artifact"]`. The `workflow.mjs variant` command picks between them, and a post-change check runs the same command again.
  - **Why the codes have no hyphen:** the lens `folderDateOf` regex `^[a-z][a-z0-9]*-\d{8}`.
- **ADR-0002.** The guards G1-G7 are role-based. `handoffReview` has its own `rounds` row and its own `AI_DLC_HANDOFF_REVIEW_*` variables. Each record is verified by the agent it is addressed to.
- **ADR-0003.** The taxonomy is kept in `.ai-dlc/taxonomy.json`, which product-manager maintains. It is not in workflow.json.
- **ADR-0004.** The taxonomy is expressed as tags, not folders. Runs are found by a walk up to depth 6, and run ids are unique across the tree.
- **ADR-0005.** The lens renders diagrams offline, in a `node` child process that uses vendored bundles.

**Why:** the human decisions in 00c. The run state `run.v3.md` holds the post-spike Q34 answer: the subagent ping is opt-in, off by default, and conditional on a spike.

**How to apply:** the next ADR number is 0006. Lessons from bc's critique:
- **Stop gate.** `check-workflow.mjs` runs only when `.ai-dlc/` is dirty, so artefact checks go behind `validate --artefacts`.
- **Store reads in auto-handoff.** The lineage read for numbering is store-only.
- **Cache-read attribution.** A usage object cannot attribute a read to a TTL. A landed 5m ping refreshes by construction.
- **Check human answers in the run state.** Later answers in `run.v*.md` supersede the G1 brief defaults. Read the run state's *Gates and loops* before relying on `po` defaults. See [[team-mode-workflow]].
