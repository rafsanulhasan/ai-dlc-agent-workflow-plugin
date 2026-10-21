handoff docs/handoffs/AAW-20261021-mods-config/5-orchestrator-to-agent-manager.handoff.md: passed — the record exists, is step 5, is addressed from orchestrator to agent-manager, and is loop round 2 of 3 (shared)

Both required findings and all eight optional items are fixed. None of the human decisions listed in `run.md` were reopened. Every check passes.

## Findings

**Required**
1. **3.1 Major, the 500000 fallback's consequence: fixed.**
   - **Log line.** The one-time log line in `register.tsx` (`contextWindow`) now works out the token line and says what follows from it: `no context window reported: thresholdPercent applies to 500000, a line of 400000 tokens; if the real window is smaller than 400000, no handoff fires: set AUTO_HANDOFF_TOKENS to an absolute token count`. The number follows `thresholdPercent`.
   - **Test.** The fallback test in `tests/auto-handoff.test.tsx` now checks the full text of that line.
   - **Docs.** `README.md` (the `thresholdPercent` row and the kill-switches paragraph) and `handoff/SKILL.md` (*Trigger*) now say that if Claude Code reports no window and yours is smaller than the line (a 200k window at 80% gives 400k), no handoff happens, and that you should set `AUTO_HANDOFF_TOKENS`. Both quote the new log text. The `thresholdPercent` description in `plugin.json` says the same.
   - **"For a test run".** No longer the only stated use in the README, `SKILL.md`, `plugin.json` or the `configured` code comment. They now call it the setting for a missing window, and a test run is a second use.
2. **4.1 Warning, a keep-warm duration under 50m sends no ping: fixed.**
   - **Status.** `register.ts` has a new flag, `pinged`. It is reset when `classic.Stop` arms the pings and set after each successful timer ping. When the duration runs out before the first ping, the status now reads `keepalive: no ping needed for 30m, stopped, warm until H:MM` instead of `kept warm 30m`. A duration that runs out after at least one ping still reads `kept warm`; the existing test for setting 30m after the first ping still checks that.
   - **Docs.** The 50-minute ping interval is now explained in the `keepWarmFor` description in the mod's `plugin.json`, in the `/keepalive` usage text, and in a new paragraph in the mod README's duration section.
   - **Test.** A new test, `a keep-warm duration under 50m sends no ping and says none was needed` (`keepWarmFor: '30m'`), checks that no ping is sent and pins the status text.

**Optional**
- Mod `README.md`, the `/keepalive clear` row: added "(in the default scope unless a flag is given)". Fixed.
- `ai-dlc` `plugin.json`: "set lower" is now "when this leaves less than 40k above the new session's starting size". Fixed.
- `ATTRIBUTION.md`: added "field shapes from the mods types, not yet checked on a live 1M session". The example is now `80% of the 1000k window ... on a 1M window`; the module's `k()` prints 1M as `1000k`. I also added a "Fallback window, review round 2" entry. Fixed.
- Memory file `reference_claude-plugin-config-facts.md`: now says the minimum supported version for mods is 2.1.287. Fixed.
- `duration.ts`: `parseDuration` now refuses anything under 1m, so `0.4m` is a usage error. The usage message also says "at least 1m". Fixed.
- `duration.ts`: `/keepalive 2h 3h` now returns the usage error `give one duration`. Fixed.
- `config.ts`: the `parseConfig` return object is re-indented to 4 spaces. Fixed.
- The syntax no acceptance criterion covers is kept and now listed:
  - in the mod README: fractions, at least 1m, flags and units not case-sensitive, `--clear` as an alias, one duration per call, and the 20-session limit;
  - in `VENDORED.md`, under *Modifications*: a new "Accepted syntax" entry and a "Review round 2" entry.
  
  Fixed. The wording in `THIRD_PARTY_NOTICES.md` still covers these changes, so it is unchanged.

## Changed paths
- `plugins/claude/ai-dlc/hooks/auto-handoff/register.tsx` — code
- `plugins/claude/ai-dlc/hooks/auto-handoff/config.ts` — code
- `plugins/claude/ai-dlc/hooks/auto-handoff/tests/auto-handoff.test.tsx` — code
- `plugins/claude-mods/cache-keepalive/hooks/register.ts` — code
- `plugins/claude-mods/cache-keepalive/hooks/duration.ts` — code
- `plugins/claude-mods/cache-keepalive/hooks/register.test.ts` — code
- `plugins/claude-mods/cache-keepalive/.claude-plugin/plugin.json` — code (manifest; only a `userConfig` description changed)
- `plugins/claude/ai-dlc/.claude-plugin/plugin.json` — code (manifest; only a `userConfig` description changed)
- `plugins/claude/ai-dlc/hooks/auto-handoff/ATTRIBUTION.md` — docs
- `plugins/claude/ai-dlc/skills/handoff/SKILL.md` — docs
- `plugins/claude-mods/cache-keepalive/README.md` — docs
- `plugins/claude-mods/cache-keepalive/VENDORED.md` — docs
- `README.md` — docs
- `.claude/agent-memory/ai-dlc-agent-manager/reference_claude-plugin-config-facts.md` — docs
- `plugins/copilot/ai-dlc/skills/handoff/SKILL.md` — generated (the build reported 1 file updated)

Throwaway edit scripts, not part of the change: `.scratch/mods-percent-config/r2-edit1.mjs` through `r2-edit4.mjs`.

## Intent
Round 2 of AAW-20261021-mods-config:
- **Auto-handoff.** When Claude Code reports no context window, the docs and the one-time log line now say that a window smaller than the threshold line never gets a handoff, and point to `AUTO_HANDOFF_TOKENS`.
- **Cache-keepalive.** The docs and the status line now say truthfully that a keep-warm duration under 50 minutes sends no ping.
- **Minor fixes.** Durations under 1m are refused, giving two durations gets its own error message, and some wording and indentation is corrected.

## Checks
- `node tools/build-copilot.mjs` gave: `Copilot plugin written to plugins\copilot\ai-dlc: 15 agents, 61 skills, 0 hook event(s), 1 Claude-only hooks module(s) left out; 1 file(s) updated, 0 removed.`
- `node tools/build-copilot.mjs --check` gave: `Copilot plugin and generated sources are up to date.` (exit 0)
- `node --test "tests/**/*.test.mjs"` gave: tests 177, pass 177, fail 0.
- `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc` gave: 133 pass, 0 fail, 133 tests across 4 files (exit 0).
- `npx @anthropic-ai/claude-code plugin test ./plugins/claude-mods/cache-keepalive` gave: 27 pass, 0 fail, 27 tests across 1 file (exit 0). That is up from 25; the 2 new tests are the round-2 ones.
- `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/ai-dlc` gave: Validation passed (exit 0).
- `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude-mods/cache-keepalive` gave: Validation passed (exit 0).
- `npx @anthropic-ai/claude-code plugin validate --strict .` gave: Validation passed (exit 0).
