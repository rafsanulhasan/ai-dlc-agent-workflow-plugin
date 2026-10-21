---
run: AAW-20261021-model-policy
work-item: none
lifecycle: AAW
step: 3
from: research-assistant
to: orchestrator
mode: subagent
loop: none
received: 2026-10-21
---

Research: skill and subagent `model` frontmatter (official Claude Code docs, fetched 2026-10-21)

1. Skills support a `model` field. Source: https://code.claude.com/docs/en/skills, section "Configure skills > Frontmatter reference", `model` row (optional field).
2. What it does: it sets the "Model to use when this skill is active." The override lasts for the rest of the current turn and is not saved to settings. The session model comes back on the user's next prompt. Source: same row.
3. Accepted values: "the same values as `/model`, or `inherit` to keep the active model." `/model` takes the aliases `default`, `best`, `fable`, `sonnet`, `opus`, `haiku`, `sonnet[1m]`, `opus[1m]` and `opusplan`, plus full model IDs. Sources: skills page, `model` row; https://code.claude.com/docs/en/model-config, "Available models > Model aliases".
4. When the value is ignored: a value excluded by the org's `availableModels` allowlist is not used, and the session keeps its model. The same happens in auto mode, and in plan mode while the classifier reviews commands, if auto mode does not support the model. Source: skills page, `model` row.
5. With `context: fork`: the value sets the forked subagent's model instead. An excluded value then follows the subagent model-override rules. Source: skills page, `model` row.
6. Model-invoked vs user-invoked: not documented. The row says "when this skill is active" and does not tell the two apart. The fetch tool reported no such statement in what it read (the first ~100k of ~110k characters; it does not search the page word for word).
7. Portability: `model` works only in Claude Code. The table "Using skill frontmatter outside Claude Code" lists only `name`, `description`, `license`, `compatibility`, `metadata` and `allowed-tools`, and a field outside that list makes packaging or upload fail. Source: skills page, that section.
8. Related field: skills also take `effort` (`low` | `medium` | `high` | `xhigh` | `max`; which levels are available depends on the model). It overrides the session effort while the skill is active. Source: skills page, Frontmatter reference, `effort` row.
9. Subagent `model` values: `sonnet`, `opus`, `haiku`, `fable`, a full model ID (for example `claude-opus-5-5`; it "accepts the same values as the `--model` flag"), or `inherit` (uses the main conversation's model). Source: https://code.claude.com/docs/en/sub-agents, frontmatter table `model` row and "Choose a model".
10. `fable` is an accepted subagent alias, listed next to `sonnet`, `opus` and `haiku`. Sources: sub-agents page, "Choose a model" ("use one of the available aliases: `sonnet`, `opus`, `haiku`, or `fable`"); the model-config page also lists `fable` as an alias.
11. Subagent model when `model` is omitted, in priority order: the per-invocation `model` parameter, then the definition's `model` frontmatter, then the `CLAUDE_CODE_SUBAGENT_MODEL` env var, then the main conversation's model. Source: sub-agents page, "Choose a model".
12. Plugin agents: the sub-agents page does not say whether plugin agents accept a narrower set of `model` values. I did not check the plugins reference page.

Confidence: High for items 1–5 and 7–11, which are verbatim doc rows. Low for 6 and 12, which are absences, and the last ~10% of each page was not read.
