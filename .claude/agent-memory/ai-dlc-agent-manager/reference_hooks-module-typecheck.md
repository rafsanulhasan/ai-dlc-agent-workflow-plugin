---
name: hooks-module-typecheck
description: plugin test does not typecheck the auto-handoff module; how to typecheck it with the bundled engine types, and how a Claude-only plugin skill is kept harmless on Copilot
metadata:
  type: reference
---

`claude plugin test` runs the hooks module tests with types stripped, so a type error passes. To check types (2026-10-22, run AAW-20261022-auto-handoff-chain): copy `types/claude-code.d.ts` from the `plugin-authoring` skill's bundled folder (under the temp `claude/bundled-skills/<version>/<hash>/plugin-authoring/`) into `.scratch/<task>/tc/`, add a tsconfig listing it plus the module files (`strict`, `lib: es2023`, `allowImportingTsExtensions`, `jsxImportSource: claude-code`), and run `npx -p typescript@5 tsc -p`. Ignore TS2875 (no jsx-runtime types) and the pre-existing `session.usage` mock error in `tests/auto-handoff.test.tsx`.

`tools/build-copilot.mjs` copies every plugin skill to Copilot; there is no exclude list. A Claude-only skill (e.g. `configure-auto-handoff`) says on its first lines that it does not apply on Copilot and stops; changing the build is a separate request.

**Why:** `plugin test` and CI never check the module's types, so a type error ships unnoticed unless this is run by hand.

**How to apply:** run the typecheck after any change to `hooks/auto-handoff/*.ts(x)`; re-locate the types file for the current Claude Code build first. Related: [[claude-plugin-config-facts]].
