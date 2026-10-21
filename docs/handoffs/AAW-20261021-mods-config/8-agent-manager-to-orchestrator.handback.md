handoff docs/handoffs/AAW-20261021-mods-config/8-orchestrator-to-agent-manager.handoff.md: passed — the record exists, is addressed to agent-manager for step 8, round 3 of 3, and lists four bounded items. I fixed all four and changed nothing else.

## Items
1. **"50m or less" (docs).** The code sends no ping at exactly 50m either (`now - armedTime >= keep.ms`), so every place that stated the bound now says it inclusively:
   - `plugins/claude-mods/cache-keepalive/.claude-plugin/plugin.json` (`keepWarmFor` description): "a duration of 50m or less sends none".
   - `plugins/claude-mods/cache-keepalive/hooks/register.ts:247` (`/keepalive` usage text): the same wording.
   - `plugins/claude-mods/cache-keepalive/README.md:29`: "A duration of 50 minutes or less sends no ping".
   - `plugins/claude-mods/cache-keepalive/VENDORED.md`: the round-2 entry now says "50m or less" and "the 50m-or-less status".
   - The handoff skill and the root README do not state this bound, so they are unchanged.
   - No test pinned the old text. I added a test for exactly 50m.
2. **Parse each word once (code).** `plugins/claude-mods/cache-keepalive/hooks/duration.ts` `parseCommandArgs` now does `const d = parseDuration(w)` once per word, then tests `d !== undefined` and sets `ms = d`. Behaviour is unchanged (`parseDuration` is pure).
3. **`/config` text states the 1m minimum (code).** In `hooks/register.ts:194` the text is now `keepalive: keepWarmFor "<v>" in /config is not a duration (<n>m, <n>h or <n>d, at least 1m); using 8h`. This matches the `/keepalive` usage wording.
   - I updated the existing test that pins this text (`register.test.ts:111`, "all day").
   - New test: `0.4m` in `/config` logs the new text.
4. **`thresholdPercent` description (docs).** `plugins/claude/ai-dlc/.claude-plugin/plugin.json` now reads: "… or 500000 tokens when it reports none. In that case, if the real window is smaller than the line (at the default 80%, a line of 400000 tokens), no handoff fires, so set AUTO_HANDOFF_TOKENS, an absolute token count that overrides this." The meaning is unchanged, and it now uses the same wording as the README and the handoff skill.

**Records.** I added a "Review round 3" entry to `VENDORED.md`. Nothing under `hooks/auto-handoff/` changed, so `ATTRIBUTION.md` is untouched. Nothing is committed.

**Outside the brief.** The test I added for exactly 50m pins the bound that item 1 documents. The old test title at `register.test.ts:190` still says "under 50m"; I left it, because it describes its own 30m case.

Changed paths:
- plugins/claude-mods/cache-keepalive/hooks/duration.ts — code
- plugins/claude-mods/cache-keepalive/hooks/register.ts — code
- plugins/claude-mods/cache-keepalive/hooks/register.test.ts — code
- plugins/claude-mods/cache-keepalive/.claude-plugin/plugin.json — docs
- plugins/claude-mods/cache-keepalive/README.md — docs
- plugins/claude-mods/cache-keepalive/VENDORED.md — docs
- plugins/claude/ai-dlc/.claude-plugin/plugin.json — docs
- (the Copilot build ran: 0 files updated, because the Copilot manifest does not carry `userConfig`, so there are no generated changes)

Intent: Fix the four non-blocking round-2 items for AAW-20261021-mods-config:
- the docs state the no-ping bound as "50m or less";
- `parseDuration` is called once per word;
- the `/config` problem text states the 1m minimum, pinned by a test;
- the `thresholdPercent` description is clearer.

Checks:
- `node tools/build-copilot.mjs` then `--check`: "Copilot plugin and generated sources are up to date."
- `node --test "tests/**/*.test.mjs"`: 177 pass, 0 fail.
- `npx --yes @anthropic-ai/claude-code plugin test ./plugins/claude-mods/cache-keepalive`: 32 pass, 0 fail (30 before plus the 2 new tests).
- `plugin test ./plugins/claude/ai-dlc`: not run, because its hooks module did not change.
- `plugin validate --strict` on `./plugins/claude/ai-dlc`, `./plugins/claude-mods/cache-keepalive` and `.`: all three passed.
