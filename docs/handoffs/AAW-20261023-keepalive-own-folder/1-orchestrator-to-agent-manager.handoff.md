---
run: AAW-20261023-keepalive-own-folder
work-item: none
lifecycle: AAW
step: 1
from: orchestrator
to: agent-manager
mode: subagent
loop: none
gate: none
verification: pending
date: 2026-10-23
---

# 1 orchestrator → agent-manager: move keep-alive to hooks/keepalive/ and fix the four leftover notes

## Goal
The human wants keep-alive in its own folder, `plugins/claude/ai-dlc/hooks/keepalive/`, not under `hooks/auto-handoff/`. The four review notes left open by the previous run must also be fixed. Behaviour must not change except for those fixes.

## Artifacts
- Previous run: `docs/handoffs/AAW-20261022-fold-cache-keepalive/run.md` (*Outcome*) and `plan.md` (the spec, still binding). Commit `81542db` holds the current state. Verified: the tree is clean at `81542db`, and all gates were green there:
  - build `--check` up to date;
  - both validations passed;
  - repo tests 327/327;
  - plugin test 387/387.
- The four notes:
  - `AAW-20261022-fold-cache-keepalive/7.1.l1-code-reviewer-to-orchestrator.handback.md`, its three suggestions;
  - `AAW-20261022-fold-cache-keepalive/5.2.l1-sqa-engineer-to-orchestrator.handback.md`, the log note.
- Current code:
  - `plugins/claude/ai-dlc/hooks/auto-handoff/keepalive/{keepalive.ts,settings.ts,duration.ts,README.md,LICENSE}`
  - `hooks/auto-handoff/{register.tsx,config.ts,io.ts}`
  - `hooks/auto-handoff/tests/keepalive.test.ts`
  - `hooks/hooks.json` (`modules` only)

## Tasks
### A. Move to `hooks/keepalive/` (the human asked whether it is possible)
1. **Probe first**, in scratch or by trying it, with `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/ai-dlc` and `plugin test`. Can the auto-handoff module import from `../keepalive/`, a sibling folder under `hooks/`? Watch the validator's `$`-following rule, the module file layout, and the Copilot build's handling of `hooks/` (the build must still leave all of `hooks/` out of Copilot).
2. **Preferred:** move `keepalive.ts`, `settings.ts`, `duration.ts`, `README.md` and `LICENSE` to `hooks/keepalive/`, and the keep-alive tests to `hooks/keepalive/tests/` (or wherever `plugin test` picks them up; say where). auto-handoff's `register.tsx` keeps registering keep-alive and imports it from `../keepalive/`. One module still manages context and cache.
3. **Fallback**, only if the preferred option fails validation or tests: make `hooks/keepalive/` its own module, listed in `hooks/hooks.json` `modules`. The integration must stay exactly as it is:
   - timers stopped before `/clear`;
   - no arming while a handoff is in flight or pending;
   - the seed cache line.

   Say how the two modules coordinate, and give the evidence.
4. **If neither works**, stop and return a `clarify:` request to the human with the evidence.
5. **Shared helpers.** keep-alive uses `config.ts` and `io.ts` from auto-handoff. Keep them shared, with no copies. Choose the import direction that validates.
6. **Update every path reference:**
   - `ATTRIBUTION.md`. The LICENSE stays next to the keep-alive code; say where the attribution for keep-alive now lives. Keep it in auto-handoff's `ATTRIBUTION.md` with a path note, or give `hooks/keepalive/` its own; justify the choice.
   - `THIRD_PARTY_NOTICES.md`, `CLAUDE.md` (Architecture, Watch out for), `README.md`, `docs/plugins.md`, `.claude/rules/plugin-development.md`
   - the skills `plugin-management` (owned by you; return that edit as a request, do not make it), `init`, `configure-auto-handoff`, `keepalive`, `handoff`
   - the `plugin.json` descriptions
   - the tests that name paths: `tests/build-copilot-hooks-module.test.mjs`, `tests/auto-handoff/*.test.mjs`
   - `tools/build-copilot.mjs`, if it names the module path

### B. The four notes
1. `keepalive.ts:362-369` / `register.tsx:878-880`: wrap `await showSeedCache($, cache)` in try/catch and log the error, so a throw cannot break the seed turn's floor handling. Add a test.
2. `settings.ts:67-69`: trust-gate `writeMult`, `outputMult` and `readPrice` like the other 13 keys (16 in total). Update the README trust paragraph and its key list, the 3 `plugin.json` row descriptions, the init skill if it lists them, and the tests, including `keepalive-settings.test.mjs` and the gated-list test.
3. `config.ts:106` `const whole =(v` and `settings.ts:96` `const NUMBER =/^`: add the space after `=`.
4. `io.ts:72-80` `trustGate`: the log must name each skipped setting **and its value**, as the docs promise ("each skipped value is logged"). Redact nothing by default; truncate long text values (`pingPrompt`, `compactInstructions`) to a short preview. Test it.

## Rules
- Branch `fix/auto-handoff-chain`. Do not commit.
- Never hand-edit `plugins/copilot/**`.
- Keep the upstream MIT LICENSE with the keep-alive code, and record every change in the attribution file.
- Do not edit orchestrator memory.

## Checks to run, with their real output
- `node tools/build-copilot.mjs`, then `--check`
- `node --test "tests/**/*.test.mjs"`
- `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/ai-dlc`
- `npx @anthropic-ai/claude-code plugin validate --strict .`
- `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc`

## Report (compressed)
- Line 1: `handoff 1-orchestrator-to-agent-manager.handoff.md: passed|failed — <why>`
- **Move:** the option used (preferred / fallback), with probe evidence
- Tasks A1–A6 and B1–B4: done or not, with `path:line`
- **Changed paths:** each marked code, docs or generated
- **Intent**
- **Checks**
- **Requests:** the `plugin-management` edit
- **Risks**

Next hop: brutal-critique (docs) and sqa-engineer (tests), then code-reviewer.

## Suggested skills
- `plugin-management`, `hook-management`, `plugin-authoring` (mods API, module layout)
