---
name: auto-handoff-decisions
description: 2026-10-22 decisions on the auto-handoff module — chain by run state, settings precedence (local env wins), trust gate, cache-keepalive to be folded in
metadata:
  type: project
---

Decisions the human made in run `AAW-20261022-auto-handoff-chain` (closed 2026-10-22):

- **Chaining:** keep handing off while the chain's run is `active`. Stop on `done`, `blocked` or `abandoned`. With no run, keep the 2-handoff guard.
- **What a new session gets:** only the records of open stages.
- **Session names:** `[ai-dlc:auto-handoff]: <original> (Session N)`.
- **Settings precedence:** `.claude/settings.local.json` env, then `.claude/settings.json` env, then process env, then `.ai-dlc/auto-handoff.json`, then `/config`, then the default. **Local always wins.** The human first wrote the order reversed, then corrected it.
- **Trust gate:** `viewer`, `briefTemplate` and `instructionsTemplate` from the repo file apply only when `~/.claude.json` records the folder as trusted (`hasTrustDialogAccepted`).
  - In VS Code and the SDK the trust dialog never shows, and this repository reads as untrusted, so a gate on the whole file would make it useless there.
- **cache-keepalive:** folded into the ai-dlc auto-handoff module on 2026-10-23 (run `AAW-20261022-fold-cache-keepalive`); the mod dependency is dropped.
  - Research found that only the shared prefix (system prompt, tools, CLAUDE.md) can be warm after a `/clear`, never the old conversation.
  - Human decisions in that run:
    - **Two tracks:** 1h (ping every 50m, keep warm 8h) and 5m (every 3m, keep warm 1h, 20 pings, the ping that falls on the limit included), with one status line per track and a seed `cache hit/miss` line.
    - **Stopping:** pinging stops when the work is done or when the optional spend limit is reached (`BUDGET_MULTIPLIER=0` turns the limit off).
    - **Settings:** 26 `AI_DLC_KEEPALIVE_*` settings. Precedence: the `/ai-dlc:keepalive` override > settings.local env > settings.json env > `.ai-dlc/cache-keepalive.json` > `/config` > default. The process env is **not** read here, unlike auto-handoff.
    - **Trust gate:** in an untrusted folder, 13 spend and behaviour keys are skipped from both committed sources (settings.json env and the repo file).
    - **Commands:** every one carries the `ai-dlc:` prefix. Mods-API commands can't contain a colon, so `/ai-dlc:keepalive` is a plugin skill the module answers in `command.run`. The skill is Claude-only and left out of Copilot.
  - **Trust facts (2026-10-23):**
    - Interactive terminal sessions record `hasTrustDialogAccepted`.
    - `-p` and SDK sessions never show the dialog, so they never record it (an inference).
    - The human verified that mods and their UI run in VS Code. Whether VS Code records trust is still to be confirmed live by the human.
  - Open live checks for the human: a seeded session's `cache_read_input_tokens`, the multi-line status rendering, and VS Code trust.

**Why:** the human wants one module to manage both context and cache, and to keep every setting configurable per repository without letting a cloned repository expose briefs or pick file paths.

**How to apply:**
- Any new settings source follows the same order, with local winning.
- Before scoping a "configurable in the repo file" feature, check for keys that touch the network or the file system.
- The cache-keepalive run must also check for overlap with the ai-dlc-lens mods-plugin plan.

Related: [[mods-release-scope]], [[review-budget]]
