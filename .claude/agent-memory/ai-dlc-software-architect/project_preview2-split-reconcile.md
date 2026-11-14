---
name: preview2-split-reconcile
description: Step 1.1.28 (2026-11-14) reconciliation of the two 1.1.24 split-design reports; G-FM narrowed to one implementation, fallback-in-own-files rule, D42 per-key resolver rule and migrate residue
metadata:
  type: project
---

1.1.28 decided (report `.scratch/preview2-g3/1.1.28-report.md`): R-7 = new tests only use paths.mjs (16 static-import test files verified, 4 lens-owned); merge `artifacts` guard in 002; G-FM implemented once (workflow.mjs) in preview2, spec-only change; runs-root.mjs fourth vector file; one convention drift test in 002; TS files record.ts + runs-root.ts (+ lens identity.ts, engine-names.ts); tests/herdr docs/handoffs literals (14 hits, 8 files) owned by 004; bank templates in write-documentation/templates/bank/; MIGRATE_ENTRY holds final name from day one; 012 split OK if 012b only adds planners and dry-run kind enum fixed in 012a (012a requires only 002, could run W3).

1.1.30.2 (2026-11-14): 012a/012b renumbered, id grammar `{BBB}-{unit}-{slug}` and AC-2.2 untouched: `012-engine-migrate-plan`, `014-engine-migrate-settings`; old `012-engine-migrate` retired. R-10 `time_box` = `<n>d` convention only, not validated.

Rule adopted: code that ends at 1.0.0 lives in files of its own, because the sweep allowlist is per path and ITEM-125 deletes per file.

D42 facts: preview1 hook and lens already read artifacts.handoffs (run.ts:54, anomaly.ts:376), so 1.1.23's self-hosting premise was wrong; mixed artifacts block needs a per-key legacy rule in the resolver and a residue source in migrate §10.2 (else docs/handoffs never migrates).

**Why:** the orchestrator reconciles conflicting dispatches through the architect before G3.
**How to apply:** when reviewing bolts 002, 004, 007, 008, 012, check these placements. Related: [[preview2-bolt-design]], [[preview2-unit-design]].
