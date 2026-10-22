---
run: AAW-20261022-copilot-model-effort
work-item: none
lifecycle: AAW
step: 1
from: research-assistant
to: orchestrator
mode: subagent
loop: none
received: 2026-10-22 17:25
---

handoff 1-orchestrator-to-research-assistant.handoff.md: passed — four questions answered from fetched official pages; Q2 CLI per-agent keys and Q4 plugin-level settings are Unverified (no authoritative source found).

Q1 VS Code `model`: a string or an array in preference order, "using the first available model"; omitted means "the currently selected model is used" (S1). Qualified form `<model name> (<vendor>)`, e.g. `(copilot)`, is shown only for handoffs (S1). Exact `model:` string for Claude is not listed on the page: Unverified.
Q1 `reasoning-effort`: string, `low`, `medium`, `high`, `xhigh` or `max`, "Availability depends on the selected model", Copilot harness only (S1). Copilot's model list says "Configurable reasoning levels are available in Visual Studio Code, Copilot CLI, and Copilot cloud agent" but names no levels (S6).
Q1 unavailable model: the page says only "first available model"; no stated behaviour when none is available: Unverified (S1). Local subagent selection order: explicit `model` passed to `runSubagent`, then the agent's `model`, then Auto, then the main model (S2).
Q1 Copilot model names: S6 lists Claude Haiku 5.5, Sonnet 5.5, Opus 5.5, Opus 5, Sonnet 5, Opus 4.8, Sonnet 4.6, Haiku 4.5 and Fable 5/5.1 by display name; availability varies by client and plan (S6). Page is truncated, so per-client support for the 5.x rows is Unverified.
Q2 Copilot CLI: the custom-agent page shows frontmatter keys `name`, `description`, `tools`, `include-custom-instructions` and no `model` or effort key (S3). A GitHub blog example profile carries `model: GPT-4.1` (S7), which is not a CLI reference: Unverified whether CLI honours it. No per-agent effort key found: Unverified.
Q3 Claude Code: `model` and `effort` are both frontmatter fields. `model` takes `sonnet`, `opus`, `haiku`, `fable`, a full model ID or `inherit`. `effort` takes `low`, `medium`, `high`, `xhigh`, `max`, with levels depending on the model (S4). The Agent tool can pass `model` per invocation; it can pass `effort` per invocation for non-fork subagents, requires Claude Code v2.1.292 or later, and overrides the frontmatter (S4). `CLAUDE_CODE_EFFORT_LEVEL` overrides both (S4).
Q3 effort support: Opus 5.5, Sonnet 5.5 and Haiku 5.5 each support `low` through `max` (S5). `max` is not a valid key value in `effortLevel` or `modelSettings`, which accept up to `xhigh` (S5).
Q4 plugin-level model or effort setting: not researched in this run: Unverified.

Recommended mapping (Claude alias to Copilot `model`, verify the strings against the picker before relying on them):
| Claude alias | Copilot `model` (preference array) |
|---|---|
| opus | ['Claude Opus 5.5', 'Claude Opus 5', 'Claude Opus 4.8'] |
| sonnet | ['Claude Sonnet 5.5', 'Claude Sonnet 5', 'Claude Sonnet 4.6'] |
| haiku | ['Claude Haiku 5.5', 'Claude Haiku 4.5'] |
Plain string form is acceptable when a single model is wanted. Fallback order is my recommendation, derived from S6.

Suggested `reasoning-effort` by role (recommendation, not sourced; the sources give the levels, not role assignments): orchestrator high; software-architect xhigh; code-reviewer high; sqa-engineer medium; requirement-analyst medium; research-assistant medium; documentation-writer and brutal-critique low. Copilot effort is supported only on models that accept it, so set it per agent only where the chosen model is confirmed.

Sources:
S1 https://code.visualstudio.com/docs/agents/reference/custom-agent-file-reference
S2 https://code.visualstudio.com/docs/agents/run/subagents
S3 https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-custom-agents-for-cli
S4 https://code.claude.com/docs/en/sub-agents
S5 https://code.claude.com/docs/en/model-config
S6 https://docs.github.com/en/copilot/reference/ai-models/supported-models
S7 https://github.blog/ai-and-ml/github-copilot/from-one-off-prompts-to-workflows-how-to-use-custom-agents-in-github-copilot-cli/

Confidence: Medium. Q1, Q3 and the Claude effort table come from official pages; the Copilot model string format and the S6 list are truncated and Unverified per client. Earlier handback 0.3 is consistent with S1 and S3.

Open questions: (1) Confirm the exact `model:` strings in the VS Code picker. (2) Confirm whether Copilot honours `reasoning-effort` for Haiku 5.5 and Sonnet 5.5. (3) Run the Copilot plugin format and CLI custom-agent references in a follow-up if Q2 and Q4 are needed for the build. (4) Re-run with model "sonnet" if the mapping must be checked against the full S6 per-client table.
