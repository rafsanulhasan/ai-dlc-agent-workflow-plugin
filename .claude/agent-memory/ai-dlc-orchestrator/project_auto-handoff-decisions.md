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
- **cache-keepalive:** fold it into the ai-dlc auto-handoff module and drop the mod dependency.
  - This is a separate AAW run that starts by measuring cache reads on a seeded session.
  - Research found that only the shared prefix (system prompt, tools, CLAUDE.md) can be warm after a `/clear`, never the old conversation.

**Why:** the human wants one module to manage both context and cache, and to keep every setting configurable per repository without letting a cloned repository expose briefs or pick file paths.

**How to apply:**
- Any new settings source follows the same order, with local winning.
- Before scoping a "configurable in the repo file" feature, check for keys that touch the network or the file system.
- The cache-keepalive run must also check for overlap with the ai-dlc-lens mods-plugin plan.

Related: [[mods-release-scope]], [[review-budget]]
