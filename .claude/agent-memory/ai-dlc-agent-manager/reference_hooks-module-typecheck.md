---
name: hooks-module-typecheck
description: plugin test does not typecheck the auto-handoff module; how to typecheck it with the bundled engine types, and how a Claude-only plugin skill is kept harmless on Copilot
metadata:
  type: reference
---

`claude plugin test` runs the hooks module tests with types stripped, so a type error passes. To check types (2026-10-22, run AAW-20261022-auto-handoff-chain): copy `types/claude-code.d.ts` from the `plugin-authoring` skill's bundled folder (under the temp `claude/bundled-skills/<version>/<hash>/plugin-authoring/`) into `.scratch/<task>/tc/`, add a tsconfig listing it plus the module files (`strict`, `lib: es2023`, `allowImportingTsExtensions`, `jsxImportSource: claude-code`), and run `npx -p typescript@5 tsc -p`. Ignore TS2875 (no jsx-runtime types); since 2026-10-22 the `session.usage` mock returns `as never`, so no other error is expected. The live window run used this setup in `.scratch/window-observability/tc/`.

`tools/build-copilot.mjs` copies every plugin skill to Copilot except those listed in `tools/claude-only-skills.json` (since 2026-10-22: `keepalive`). A Claude-only skill still copied (e.g. `configure-auto-handoff`) says on its first lines that it does not apply on Copilot and stops; listing it is the alternative.

**Why:** `plugin test` and CI never check the module's types, so a type error ships unnoticed unless this is run by hand.

**How to apply:** run the typecheck after any change to `hooks/auto-handoff/*.ts(x)`; re-locate the types file for the current Claude Code build first. Related: [[claude-plugin-config-facts]].

Engine types (2.1.306): `SessionUsage.context.window` is a required `number`, so the "no window reported" fallback path is defensive; whether a live host ever omits it is unverified. `session.compact` (trigger auto) hands off whatever the threshold, so a line above the window means "waits for auto-compact", never "no handoff". `$.session.usage({ breakdown: 'summary' })` estimates locally (`'full'` calls the token-count API); `context.breakdown` carries `autocompactSource` and `autoCompactThreshold?`; the mock's event payload `e` is the call's args.
