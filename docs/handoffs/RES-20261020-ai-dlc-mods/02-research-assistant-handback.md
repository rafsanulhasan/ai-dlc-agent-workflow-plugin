# Hand-back 02: research-assistant — cluster B-cache-compaction

Stored verbatim on 2026-10-20 (work item RES-20261020-ai-dlc-mods).

---

# Research findings: prompt cache keep-alive and compaction (cluster B, R3 and R11)

**What changes the plan:** Claude Code already compacts idle sessions on its own. The `idleCompaction` setting has been on by default since v2.1.290, so building an idle-compact mod would mostly duplicate it. Claude Code also exposes a documented mods API (`$.session.compact`, `$.model.fork`, `$.clock`) that can trigger compaction and send keep-warm pings, and that API runs inside the VS Code extension too. Copilot has nothing like it: compaction there is either automatic or the user's manual `/compact`, and its `preCompact` hook can only observe.

**Conflict between sources:** claude-mods.com says mod drawing doesn't show in the VS Code chat panel. Anthropic's docs say it does, from extension v2.1.299 (v2.1.304 for sessions that don't fetch feature flags) (code.claude.com/docs/en/plugins/mods/overview.md, "Where mods run"). Trust the official docs. The mod pages list only terminal and desktop because that is what each author tested.

## Per mod

| Mod | What it does | How it works | Harness (author-listed) | License / source | Maturity |
|---|---|---|---|---|---|
| cache-tax | Blocks one send into a cold cache over 50k tokens and shows its price; pings every 50 min inside a window (default 6 h) | Mod hooks on `prompt.submit` and `turn.step`; background model requests; no status line | Terminal only | MIT, github.com/karanb192/cache-tax (v2.1.3, 217★) | Published 2026-09-17; author verified one run in one configuration |
| cache-keeper | Cache countdown, `/keepwarm [hours\|off]` (default 4 h, max 24), cold-send guard over 150k tokens, `/board` pane, `/handoff` | Mod: band above the prompt, pane, commands, a 30 s heartbeat to a local store. Pings land ~8 min before expiry on the 1 h cache, 90 s on the 5 min cache | Terminal and Desktop (Desktop shows only a footer label) | MIT, github.com/nateherkai/claude-code-mods (41★, no version) | Updated 2026-10-03. Prices are hardcoded. `/clear`, `/resume` and `/branch` turn keep-warm off |
| idle-compact | Compacts once after 50 idle minutes, while the 1 h cache is still warm | Mod: `turn.complete` arms one timer; `turn.start`, `session.end` and manual compaction cancel it; it fires `$.session.compact` only in the 50–58 min window. Nothing to configure | Terminal and Desktop | Apache-2.0, github.com/takahirom/takahirom-claude-code-marketplace (17★) | Published 2026-10-16. Assumes the 1 h TTL, never retries |
| handoff-compact | Replaces the built-in compaction summary with a structured handoff (goal, state and proof, next step, decisions, ruled-out approaches, plus the last 10 prompts verbatim). Also saves it to `~/.claude/handoffs/` | Mod hooks on `session.compact` (also `session.measure` and `turn.complete` in `self` mode); a forked request writes the handoff; `/compact classic` runs the normal summary once | Terminal and Desktop | MIT, github.com/trytofly94/handoff-compact (12★) | v0.2, piloted through 6 compactions, published 2026-10-14 |

Sources: https://claude-mods.com/cache-tax/ , https://claude-mods.com/cache-keeper/ , https://claude-mods.com/idle-compact/ , https://claude-mods.com/handoff-compact/

**Unverified:**
- I read none of the four repositories' source, only the site pages and READMEs. The `$.session.compact` call in idle-compact comes from its README flowchart.
- The documented return for a `session.compact` hook is only `{ skip: reason }` (mods reference, "Session"). I could not confirm how handoff-compact *replaces* the summary through the documented API. It may use undocumented behaviour, a skip followed by its own message, or something else.
- claude-mods.com is an unofficial directory "not affiliated with or endorsed by Anthropic" (https://claude-mods.com/). All stars and versions are as that site reports them.

## Platform facts (Anthropic docs)

### Prompt cache TTL
- **API defaults and prices:** the default cache lasts 5 min and is "refreshed for no additional cost each time the cached content is used". You get 1 h by setting `"ttl": "1h"` on `cache_control` (https://platform.claude.com/docs/en/build-with-claude/prompt-caching).
- **Price multipliers:**
  - 5 min write: 1.25×
  - 1 h write: 2×
  - Read: 0.1×; 0.05× on Opus 5.5 and Sonnet 5.5; 0.025× on Fable 5.1 and Mythos 5.1
- **Claude Code defaults:** the main conversation gets 1 h on a subscription within plan usage. With an API key, cloud provider or usage credits it gets 5 min. Subagents, compaction and forks get 5 min unless you set `subagentPromptCacheTtl`.
- **Overriding the TTL:** set `promptCacheTtl` or `CLAUDE_CODE_PROMPT_CACHE_TTL` (v2.1.242+). Precedence:
  1. `FORCE_PROMPT_CACHING_5M`
  2. the environment variable
  3. the setting
  4. the subagent's `cacheTtl`
  5. `ENABLE_PROMPT_CACHING_1H`

  Source: https://code.claude.com/docs/en/prompt-caching ("Cache lifetime").
- **Cost of a ping:** about context × read rate, plus a small write and the output. Example from cache-keeper: about 8¢ for a 400k-token Opus 5.5 chat, against $3.20 to rewrite it on the 1 h cache. On the 5 min TTL you need about 12 pings an hour, so pinging costs more than the rewrite it avoids after roughly 1.5 h (cache-keeper page).
- **Arithmetic check (mine):**
  - 1 h TTL on Opus 5.5: one ping costs 0.05×, a rewrite 2×, so a ping is ~1/40 of a rewrite.
  - 5 min TTL: 12 pings × 0.05× = 0.6× per hour, against a 1.25× rewrite.
- **On a subscription:** pings count against plan limits instead of a bill (cache-keeper page).

### Triggering compaction from code
- **Mods (Claude Code):** yes. `$.session` includes `compact`, `$.model.fork` resends the conversation, which reads the cache, and `$.clock.after` / `$.clock.every` provide timers (https://code.claude.com/docs/en/plugins/mods/reference.md, "Mods API methods"; https://code.claude.com/docs/en/plugins/mods/api.md).
- **Where mod hooks run:** terminal, Desktop, the VS Code extension, `-p` and the SDK, but not Desktop WSL sessions (overview.md, "Where mods run").
- **Version needed:** CLI v2.1.287+. Mods are installed as a plugin with `hooks/hooks.json` → `"modules": [...]`.
- **Settings hooks (shell):** they cannot trigger compaction. `PreCompact` can block it (exit code 2 or `decision: "block"`) and receives `trigger` and `custom_instructions`. It cannot change the summary, and Claude Code discards its `systemMessage` and `continue` fields. `PostCompact` receives `compact_summary` but has no decision control. `SessionStart` with the `compact` matcher can re-inject context afterwards. Source: https://code.claude.com/docs/en/hooks, the PreCompact and PostCompact sections.
- **Built-in settings:**
  - `idleCompaction` (default true, v2.1.290+). It runs only in an interactive terminal session on the 1 h TTL, at ≥200k tokens (`CLAUDE_CODE_IDLE_COMPACT_MIN_TOKENS`), after about 54 idle minutes (settings-reference, `idleCompaction`).
  - `autoCompactWindow` (100k–1M), the `/autocompact` command, `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, and `autoCompactEnabled` (https://code.claude.com/docs/en/model-config).

### Copilot
- **Copilot CLI:**
  - Auto-compacts at about 80% of the window and pauses at about 95%; `/compact` is manual (https://docs.github.com/en/copilot/concepts/agents/copilot-cli/context-management).
  - There is no setting to change the threshold; a feature request asks for one (github/copilot-cli#3026).
  - `preCompact` is "notification only": it cannot block or modify, and no hook can trigger compaction (https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-hooks-reference).
  - Nothing documents prompt caching or keep-alive.
- **VS Code (Copilot):**
  - Agent hooks are in Preview and include PreCompact, for saving state. `chat.useClaudeHooks` reads `.claude/settings.json` but ignores matchers (https://code.visualstudio.com/docs/copilot/customization/hooks).
  - No compaction trigger or cache control is documented.
- **This repo:** the build already maps `PreCompact` to `preCompact` (`plugins/claude/ai-dlc/skills/plugin-management/templates/build-copilot.mjs:62`, `skills/harness-sync/templates/sync-harness.mjs:386`).

## Per requirement

### R3: keep the cache warm for a configurable period
- **Covered by:** cache-keeper (`/keepwarm` 0–24 h, stops itself on a write or no answer) and cache-tax (a 6 h window). The directory also lists cache-keepalive, which I did not read.
- **Gaps:**
  - Neither mod lists VS Code as tested, though the API supports it.
  - Neither covers Copilot.
  - Prices are hardcoded.
  - `/clear` and `/resume` reset state.
- **Feasibility:**
  - **Claude CLI, Desktop and VS Code:** feasible as a mod (`$.clock` + `$.model.fork` + `$.session.usage`). A `$.model.fork` request falls in the "everything else" TTL bucket (5 min unless `subagentPromptCacheTtl` is set). Whether a 5 min-requested read keeps alive a main-conversation entry written at 1 h is **unverified**.
  - **Copilot:** not feasible. There is no hook-driven model call and no documented cache control.
- **Cost/benefit:**
  - Worth it on the 1 h TTL with a large context (≥100k tokens) and breaks of 1–N hours.
  - Close to pointless on the 5 min TTL: the advice there is to set `promptCacheTtl: "1h"` first.
  - Thinking models make each ping cost more (cache-tax page).
- **Recommendation:** **reuse the idea or integrate.** Either recommend cache-keeper (MIT) from the plugin's docs, or build a small `ai-dlc-mods` keep-warm mod. It should read its TTL from settings, use a `userConfig` period, a cost cap and auto-off, and tell users to set `promptCacheTtl: "1h"`. Mark it Claude-only.

### R11a: auto-compact the active session before the context bloats
- **Covered by:** Claude Code itself:
  - `autoCompactWindow` / `/autocompact` (threshold-based)
  - `idleCompaction` (idle, before the cache expires)

  Then idle-compact (mostly duplicates the built-in) and taskcut / ctx-handoff (listed on claude-mods.com, not read).
- **Gaps:**
  - Built-in idle compaction runs only in an interactive terminal session, at ≥200k tokens, on the 1 h TTL.
  - In VS Code, idle compaction is off per the docs' conditions, but a mod could fill that gap.
  - On Copilot, auto-compaction is fixed at about 80%.
- **Feasibility:**
  - **Claude:** fully feasible through settings plus, optionally, a `$.session.compact` mod for VS Code and Desktop idle.
  - **Copilot:** not feasible beyond manual `/compact` and the built-in 80% auto-compaction.
- **Recommendation:** **mostly no build needed.** Ship guidance and settings presets through `/ai-dlc:init`. Build only a thin mod if VS Code idle compaction is wanted.

### R11b: compact, then keep the compacted cache warm
- **Covered by:** nothing in one piece. idle-compact and cache-keeper together would do it, but they don't coordinate. After compaction, cache-keeper's state may reset (**unverified**).
- **Feasibility:** feasible as one mod. After compaction (`session.compact`, or the PostCompact settings hook), arm keep-warm pings on the new short prefix. Pings are cheaper because the context is smaller.
- **Recommendation:** **build.** This is a combined mod with no existing equivalent. Claude only.

### R11c: compact handoff records
- **Covered by:**
  - handoff-compact (MIT), which turns compaction into a structured handoff saved to disk.
  - The repo's existing *Session handoff* section (`plugins/claude/ai-dlc/skills/handoff/SKILL.md:201`).

  compact-keeper, compact-handoff and auto-handoff are listed on claude-mods.com but not read.
- **Gaps:**
  - handoff-compact writes to `~/.claude/handoffs/`, not `docs/handoffs/<work-item>/`, and doesn't know about `run.md`.
  - The documented API doesn't show summary replacement (see the unverified note above).
- **Feasibility:**
  - **Portable path (both harnesses):** a `PreCompact` settings hook or `preCompact` (Copilot) that writes or refreshes a session handoff and `run.md` from the transcript. On Copilot it can only observe, so it's best effort. The summary text itself can't be changed this way.
  - **Claude:** `PostCompact`'s `compact_summary` can be persisted next to the handoff records, and `SessionStart` with the `compact` matcher can re-inject `run.md`.
- **Recommendation:** **reuse the idea and build.** Use the portable hook pair (PreCompact snapshot, plus SessionStart[compact] re-injecting `run.md` and the latest handoff) in the main plugin. An optional Claude mod can take handoff-compact's outline and point it at `docs/handoffs/`.

## Confidence
**Medium-High.**
- **High:** platform facts. They come from current official docs (code.claude.com, platform.claude.com, docs.github.com, code.visualstudio.com).
- **Medium:** the four mods. Their facts come from an unofficial directory and READMEs, and I read no source.
- **Stale source:** claude-mods.com's VS Code claim conflicts with the official docs and looks out of date.

## Open questions
1. Does a `$.model.fork` ping (subagent TTL bucket) refresh a main-conversation 1 h cache entry? This needs an empirical test using the `ephemeral_1h_input_tokens` and `cache_read_input_tokens` usage fields.
2. How does handoff-compact replace the compaction summary when the documented `session.compact` return is only `{ skip }`? Reading its source would answer it.
3. Should mods live in `ai-dlc` or in a separate plugin? `tools/build-copilot.mjs` would need to drop or skip `hooks.json` `modules` for Copilot, and its current behaviour with a `modules` key is untested.
4. Neither mod page lists the cache-keepalive, taskcut, ctx-handoff or compact-keeper mods' harness support. I did not read them, and they may overlap R3 and R11.

I did not save to memory because plan mode was active (read-only).
