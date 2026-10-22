---
run: AAW-20261022-copilot-model-effort
lifecycle: AAW
step: 1
from: orchestrator
to: research-assistant
---
Facts needed before building F12 (see run.md Request). Cite official URLs; Unverified where silent.
1. VS Code Copilot `.agent.md` `model` value format: exact model names to use for Claude Opus / Sonnet / Haiku (e.g. "Claude Sonnet 4.5 (copilot)" style qualified names?), how a preference list is written, behaviour when a model isn't available. And `reasoning-effort` details (which models honour it).
2. Copilot CLI: does any agent-file key or setting set model / effort per custom agent? (Fetch the full CLI custom-agent reference this time.)
3. Claude Code: is `effort` a supported subagent frontmatter key (values)? Does the Agent tool / subagent invocation accept `model` and `effort` per call (docs: code.claude.com/docs/en/sub-agents and related)?
4. GitHub Copilot plugin format (plugins/copilot/ai-dlc layout, `.github/plugin/marketplace.json`): any plugin-level way to set agent model/effort?
