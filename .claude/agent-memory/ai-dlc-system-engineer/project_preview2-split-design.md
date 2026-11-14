---
name: preview2-split-design
description: preview2 split-design decisions (workflow.mjs stays one file, .mjs vector files, merge guard to bolt 002) and the repo facts behind them
metadata:
  type: project
---

For preview2 (step 1.1.24, 2026-11-14) I decided `workflow.mjs` stays one installed file through preview2, made importable with an `IS_MAIN` guard (precedent `auto-handoff.mjs:328`) and lazy `LEVELS`/`ENV`.

**Why:** it is installed as a two-file copy by the `workflow` skill, `init` and the future `migrate` skill, and the Stop-hook gate blocks a session when `validate` fails, so a partial `lib/` install would block sessions.

**How to apply:** revisit at 1.0.0 or above ~2,500 lines. Shared grammar vectors are plain `.mjs` modules (hook and lens test runners load code files only; precedent `ai-dlc-lens/tests/fixtures/scrub-cases.mjs`), not JSON. `merge` adds every missing key at any depth, so the template's preview2 `artifacts` flips a legacy layout unless a guard exists; I moved that guard to bolt 002. CI is ubuntu-only with a shallow checkout, so tests must not read git history. Static `import` specifiers in 16 existing tests cannot use `paths.mjs`. Related: [[preview2-bolt-design]] is the architect's side.
