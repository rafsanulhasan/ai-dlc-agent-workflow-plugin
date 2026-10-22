---
name: lens-decisions
description: 2026-10-22 human decisions widening ai-dlc-lens — merged dashboard of 4 mods, /ai-dlc:lens via thin skills, settings order, no keepwarm, never hide agent responses
metadata:
  type: project
---

On 2026-10-22 the human widened run `FEAT-20261020-ai-dlc-lens` (plan `docs/handoffs/FEAT-20261020-ai-dlc-lens/00b-approved-plan-2026-10-22.md`, branch `feat/ai-dlc-lens`, worktree `.worktrees/ai-dlc-lens`):

- **Scope:** ai-dlc-lens merges savvy-progress, cache-tax, context-view and agent-flow into one view, with **no duplicated field**, on top of the S5 items. Narrow panel: compact rows. Wide panel: an Svg flowchart per workflow. Avatars are initials badges, configurable.
- **Commands:** `/ai-dlc:lens`, `/ai-dlc:lens-init` and `/ai-dlc:lens-configure` come from thin, Claude-only skills in ai-dlc; the code lives in the separate plugin. A hooks module cannot register a colon-named command.
- **Settings order:** settings.local.json env > settings.json env > the user level written by lens-init / lens-configure > defaults. Invalid values are ignored.
- **Cache:** show what cache-tax shows; the guard is opt-in; **no keepwarm**, because ai-dlc keep-alive already pings. Keep-alive owns its status lines; the lens only reads its state.
- **Hiding output:** collapsed rows in the pane and cards in the transcript, but **never hide a subagent's or teammate's response text**.
- **Licences:** all four upstreams go in THIRD_PARTY_NOTICES.md. agent-flow is Apache-2.0, so keep its NOTICE and state the changes.
- **Gates:** G1 to G4 and the release are approved by the human.
- **Release, decided later on 2026-10-22:** everything ships in **1.0.0-preview1**, which is unreleased. There is no cut and nothing moves to 1.1.0.
- **context-view awareness:** included, **on** by default, so the model is told its context size.
- **Avatar images:** a path or data URI per agent is allowed alongside initials. A file path needs the trust check, and rendering in VS Code needs a spike first.

**Why:** the human wants one good-looking place that shows agents, tokens, context, cache and progress, and hides noise without hiding results.

**How to apply:** brief every lens stage with these decisions. The build waits for `AAW-20261022-fold-cache-keepalive` to merge to main.

Related: [[mods-release-scope]], [[auto-handoff-decisions]]
