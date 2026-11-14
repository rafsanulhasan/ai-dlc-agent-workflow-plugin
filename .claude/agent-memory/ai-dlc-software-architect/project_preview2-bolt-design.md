---
name: preview2-bolt-design
description: Step 1.1.23 bolt design for intent 001 (G3 input) - AC parts notation, 31 stories, sweep-after-dogfood sequencing, refines R-1..R-11
metadata:
  type: project
---

Step 1.1.23 (2026-11-14) designed 31 stories (engine 25, lens 6) and 13 bolt.md files for intent 001; report in `.scratch/preview2-g3/1.1.23-report.md`. G3 pending.

- **AC parts:** a multi-bolt AC is split by file ownership as `AC-x[part]`; each part sits in exactly one story (85 bolt ACs, 26 split into 69 parts, 128 assignments). AC-16.1/16.3/16.5 are bolt Definition of Done, closed by ITEM-124/122/124.
- **R-1 CRITICAL:** the bolt 011 stale-names test searches `docs/` and README; legacy history there fails it until ITEM-121 dogfood moves it. So 011 runs after ITEM-121 (W6).
- R-4: spike-bolt lands with `probe` in 005 (else 002's stage-exists check fails). R-5: building-stage prose goes to 003. R-6: 005 merges after 004. R-7: paths.mjs created in 002.
- Self-hosting risk: the repo loads its own plugin; the hook with legacy `artifacts.handoffs` ignores `execution-plans/`, and 009 breaks the local marketplace.

**Why:** the brief required "every AC in exactly one story"; §16.1 maps ACs to several bolts.
**How to apply:** when reviewing bolts 002-013, check each story's AC parts and the DoD; verify 011 does not start before ITEM-121. Related: [[preview2-unit-design]], [[preview2-g2-fixes]].
