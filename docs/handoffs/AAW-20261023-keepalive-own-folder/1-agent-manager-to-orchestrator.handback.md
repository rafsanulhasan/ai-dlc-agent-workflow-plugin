---
run: AAW-20261023-keepalive-own-folder
work-item: none
lifecycle: AAW
step: 1
from: agent-manager
to: orchestrator
mode: subagent
loop: none
received: 2026-10-23 03:30
---

handoff 1-orchestrator-to-agent-manager.handoff.md: passed — brief self-contained; the artifacts it names are at 81542db as stated (the tree was clean; repo tests 327/327 and plugin test 387/387 before my change)

**Move: preferred option. Keep-alive is in `hooks/keepalive/`, and it is still one module.**
Probe evidence:
- I moved the files with `git mv` and fixed the imports, then ran `plugin validate --strict ./plugins/claude/ai-dlc`: passed.
- I ran the validator on a detached worktree at 81542db and diffed the module-analysis lines (`❯ ./auto-handoff/register.tsx` hooks, calls, env reads) against the moved tree. They are identical, so the validator follows `../keepalive/` imports, including the `$` calls such as `$.model.fork via ping`.
- `plugin test` gave 387/387 across 6 files and picked up `hooks/keepalive/tests/` without config.
- `hooks.json` is unchanged (`["./auto-handoff/register.tsx"]`). The Copilot build still leaves all of `hooks/` out ("1 Claude-only hooks module(s)").
- Evidence files: `.scratch/keepalive-own-folder/validate-head.txt`, `validate-probe.txt`, `v1.txt`.

**Tasks**
- A1 done: probe above.
- A2 done: `keepalive.ts`, `settings.ts`, `duration.ts`, `README.md`, `LICENSE` and `tests/keepalive.test.ts` are in `hooks/keepalive/`. Imports are at `register.tsx:12` (`../keepalive/keepalive.ts`) and `keepalive/tests/keepalive.test.ts:4-8`. I added `hooks/keepalive/tsconfig.json`, a copy of auto-handoff's, so the folder typechecks; this is not required by validate or test.
- A3: not needed.
- A4: not needed.
- A5 done: keep-alive imports the shared helpers from `../auto-handoff/config.ts` and `../auto-handoff/io.ts` (`keepalive/keepalive.ts:6-8`, `keepalive/settings.ts:6`). Nothing is copied.
- A6 done:
  - Attribution: I gave keep-alive its own `hooks/keepalive/ATTRIBUTION.md`, holding the former *cache-keepalive* section, a note on the old paths, a `Moved` row and a 2026-10-23 entry. auto-handoff's `ATTRIBUTION.md` links to it (lines 5-9) and has its own 2026-10-23 entry.
    - Why: the license and the change record sit next to the code they cover, which matches the plugin-management rule "an ATTRIBUTION.md in the module folder".
    - `LICENSE` is byte-unchanged (a pure rename).
  - Also updated:
    - `THIRD_PARTY_NOTICES.md:296`, `CLAUDE.md:36,50`, `README.md:78,195`, `.claude/rules/plugin-development.md:14`
    - the skills `configure-auto-handoff:13`, `init:57`, `keepalive:22`
    - `plugin.json`: all 39 path mentions
    - `tests/auto-handoff/keepalive-settings.test.mjs:1-15` and `tests/build-copilot-hooks-module.test.mjs:177-194`
    - path comments in `config.ts:95,104`, `io.ts:1,68`, `register.tsx:27,765`, `keepalive.ts:14-17`, `settings.ts:97`
  - Not changed:
    - `docs/plugins.md` and the `handoff` skill name no module path.
    - `tools/build-copilot.mjs` names no path (comment at line 300 only).
    - `keepalive-fold.test.mjs` needs no change.
- B1 done, through a small helper:
  - Why a helper: the test engine drops a failed `$.ui.status` itself, and the test body's `$` has no `env` or `process`, so no engine path can make `showSeedCache` throw today.
  - `io.ts:36` `orLog($, what, fn)` logs `<what> error <err>` and passes nothing on.
  - `register.tsx:879` calls `await orLog($, 'keepalive seed line', () => showSeedCache($, cache))`, so `warnTightThreshold` still runs.
  - Test: `auto-handoff.test.tsx:2000`, which uses a stub `$`.
- B2 done:
  - `settings.ts:86` gates the three prices, 16 keys in total.
  - README *Workspace trust* names them and says "16 settings".
  - The 3 `plugin.json` rows (`:170,175,180`) carry the gate sentence.
  - The `init` skill lists no keys, so it needed no change.
  - Tests:
    - `keepalive.test.ts:764-766`: per-key gate rows for the three prices, probed through the first ping's `spent`.
    - `keepalive.test.ts:775`: the count is now 16.
    - `keepalive-settings.test.mjs:68`: the gated list.
    - `keepalive-settings.test.mjs:89-97`: a new test that the gate sentence is on exactly the 16 gated rows.
    - The README count is checked as well.
- B3 done: `config.ts:106` now reads `const whole = (v` and `settings.ts:99` reads `const NUMBER = /^`.
- B4 done:
  - `io.ts:89` logs `key=value, …` through `config.ts:361-379` (`PREVIEW_CHARS` 40, `previewValue`, `keysWithValues`): text in double quotes, white space folded, values over 40 characters cut with `…` and `(N chars)`, nothing redacted.
  - This also changes auto-handoff's own trust line, now `briefTemplate="/repo/chosen.md", viewer="0.0.0.0:3846" in …` (`auto-handoff.test.tsx:1841`).
  - Tests: `config.test.ts:269,279`; `keepalive.test.ts:521` (truncation); the per-key gate tests now assert `key=value`.

**Changed paths**
- code: `plugins/claude/ai-dlc/hooks/auto-handoff/register.tsx`
- code: `plugins/claude/ai-dlc/hooks/auto-handoff/io.ts`
- code: `plugins/claude/ai-dlc/hooks/auto-handoff/config.ts`
- code: `plugins/claude/ai-dlc/hooks/keepalive/keepalive.ts` (moved)
- code: `plugins/claude/ai-dlc/hooks/keepalive/settings.ts` (moved)
- code: `plugins/claude/ai-dlc/hooks/keepalive/duration.ts` (moved, unchanged)
- code: `plugins/claude/ai-dlc/hooks/keepalive/tsconfig.json` (new)
- code: `plugins/claude/ai-dlc/hooks/keepalive/tests/keepalive.test.ts` (moved)
- code: `plugins/claude/ai-dlc/hooks/auto-handoff/tests/auto-handoff.test.tsx`
- code: `plugins/claude/ai-dlc/hooks/auto-handoff/tests/config.test.ts`
- code: `tests/auto-handoff/keepalive-settings.test.mjs`
- code: `tests/build-copilot-hooks-module.test.mjs`
- code: `plugins/claude/ai-dlc/.claude-plugin/plugin.json` (descriptions only)
- docs: `plugins/claude/ai-dlc/hooks/keepalive/README.md` (moved)
- docs: `plugins/claude/ai-dlc/hooks/keepalive/LICENSE` (moved, unchanged)
- docs: `plugins/claude/ai-dlc/hooks/keepalive/ATTRIBUTION.md` (new)
- docs: `plugins/claude/ai-dlc/hooks/auto-handoff/ATTRIBUTION.md`
- docs: `plugins/claude/ai-dlc/skills/configure-auto-handoff/SKILL.md`
- docs: `plugins/claude/ai-dlc/skills/init/SKILL.md`
- docs: `plugins/claude/ai-dlc/skills/keepalive/SKILL.md`
- docs: `CLAUDE.md`
- docs: `README.md`
- docs: `THIRD_PARTY_NOTICES.md`
- docs: `.claude/rules/plugin-development.md`
- docs: `.claude/agent-memory/ai-dlc-agent-manager/reference_hooks-module-typecheck.md` (my memory)
- generated: `plugins/copilot/ai-dlc/skills/configure-auto-handoff/SKILL.md`
- generated: `plugins/copilot/ai-dlc/skills/init/SKILL.md`

**Intent:** Keep-alive moves to its own folder, `plugins/claude/ai-dlc/hooks/keepalive/`, still imported and registered by the auto-handoff module, so one module handles context and cache with the integration unchanged. The four open review notes are fixed:
- a seed-line failure can no longer break the seed turn;
- the three prices are trust-gated;
- the two missing spaces after `=` are added;
- the trust warning names each skipped value, with long text truncated.

**Checks** (real output)
- `node tools/build-copilot.mjs`: "15 agents, 62 skills, 0 hook event(s), 1 Claude-only hooks module(s) and 1 Claude-only skill(s) left out; 2 file(s) updated, 0 removed."
- `node tools/build-copilot.mjs --check`: "Copilot plugin and generated sources are up to date.", exit 0. Re-run last, still up to date.
- `node --test "tests/**/*.test.mjs"`: tests 329, pass 329, fail 0 (was 327).
- `plugin validate --strict ./plugins/claude/ai-dlc`: "✔ Validation passed", exit 0. One non-blocking plugin-directory warning, ICON_MISSING, was already there. Module analysis is identical to 81542db.
- `plugin validate --strict .`: "✔ Validation passed", exit 0.
- `plugin test ./plugins/claude/ai-dlc`: 409 pass, 0 fail, "Ran 409 tests across 6 files" (was 387).
- Extra, by hand: tsc with the bundled 2.1.306 engine types. No new errors, but two type errors in `keepalive/tests/keepalive.test.ts` predate this change: the GATED table's `options` typing (`:796`) and the budgetMultiplier probe (`:759`).
- `git diff --check`: clean.

**Requests**
- A fresh `agent-manager` should update `plugins/claude/ai-dlc/skills/plugin-management/SKILL.md:74`:
  - "The module also holds `keepalive/` …" should say keep-alive lives in `hooks/keepalive/`, a sibling folder that the `auto-handoff` module imports and registers (one entry in `hooks.json`).
  - It should say that each third-party folder keeps its own `LICENSE` and `ATTRIBUTION.md`, and that `plugin validate` follows imports across sibling folders under `hooks/`.
  - Reason: the repo layout changed, and the skill documents it. Then rebuild.

**Risks**
- B4 also changes auto-handoff's own trust log line, which now carries the values. The shared `trustGate` serves both modules, so this cannot be done for keep-alive alone.
- The configure-auto-handoff CLI (`auto-handoff.mjs:181`) still prints its warnings without values, so the module log and `show`/`validate` now word the same warning differently.
- Values are logged unredacted, as specified. Only the gated keys are logged, but a repo could put arbitrary text in `pingPrompt` or `compactInstructions`; the 40-character cut limits that.
- B1's guard cannot be triggered through the engine today (failed status updates are dropped), so the test covers `orLog` with a stub, not the seed turn end to end.
- The old empty folder `hooks/auto-handoff/keepalive/` is removed locally. The renames are staged by `git mv`, and the two new files are `git add -N`. Nothing is committed.
