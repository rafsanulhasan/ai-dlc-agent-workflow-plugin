---
run: AAW-20261021-handoff-naming
work-item: none
lifecycle: AAW
step: 1
from: research-assistant
to: orchestrator
mode: subagent
loop: none
received: 2026-10-21
---

Research: subagent nesting, re-verified (read-only). Contract: research.

Claude Code
- Subagents CAN spawn subagents by default, up to 3 layers below the main conversation. A subagent at the third layer cannot spawn further. — https://code.claude.com/docs/en/sub-agents "Nesting and default depth" (v2.1.219+ default 3)
- Env var is CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH (settings.json "env" or shell), default 3, positive whole number only; invalid values are ignored, so it can be lowered but not removed. Set to 1 to turn nesting off. — https://code.claude.com/docs/en/env-vars (v2.1.217+ for the variable; default 1 in v2.1.217–v2.1.218, 3 from v2.1.219)
- Not the same as CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS, a concurrency cap (default 20). — https://code.claude.com/docs/en/env-vars
- Tools: a subagent spawns only if it has the Agent tool. Omitted `tools` = inherits all subagent-available tools (so Agent is included); to block spawning, omit Agent from `tools` or add it to `disallowedTools`. Listing Agent in a subagent's `tools` lets it spawn while the depth limit allows. The Agent(agent_type) allowlist syntax applies only to the main thread via `claude --agent`. — https://code.claude.com/docs/en/sub-agents "Whether Agent must be in tools"
- At the depth limit, Agent is withheld from non-fork subagents; a fork keeps Agent but the call errors. — https://code.claude.com/docs/en/sub-agents
- Plugin subagents: hooks, mcpServers and permissionMode frontmatter are ignored; no nesting limit specific to plugin subagents is documented. — https://code.claude.com/docs/en/sub-agents
- Headless / SDK: in `claude -p` and the Agent SDK the spawning subagent waits for nested subagents while fork mode is on; with fork mode off, nested subagents run in background and do not block the spawner. — https://code.claude.com/docs/en/sub-agents
- Older docs said a fixed, non-configurable depth; a GitHub issue reports the page lagged and was closed as fixed on 2026-08-16 (third-party, corroborates the change). — https://claudeissues.com/issue/80083-docs-nested-subagent-docs-still-describe-a-fixed-depth-and-omit-the-default-disa
- Third-party corroboration of default 3 and =1 disabling nesting. — https://digitalapplied.com/blog/claude-code-subagent-depth-limits-budget-caps-2026 (v2.1.219 per official docs)

GitHub Copilot custom agents
- Not documented: neither the custom-agents concept page nor the CLI custom-agents pages state whether a custom agent can invoke or delegate to another custom agent. The CLI docs say the main agent can delegate a task to a subagent using a custom profile, and custom agents are exposed to the model as tools. — https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-custom-agents (no nesting statement); https://github.blog/changelog/2025-10-28-github-copilot-cli-use-custom-agents-and-delegate-to-copilot-coding-agent/ (main-agent delegation only, per search excerpt; not fetched in full)
- Copilot SDK: runtime auto-delegates to matching agent in isolated context. Not stated whether that can nest. — https://docs.github.com/en/copilot/how-tos/copilot-sdk/use-copilot-sdk/custom-agents (search excerpt, not fetched)
- Implication: "subagents cannot spawn agents" is an unverified claim for Copilot. Do not state it as fact for Copilot without a test.

Plugin statements (path:line, as of this checkout; Copilot files are generated, do not hand-edit)
- plugins/claude/ai-dlc/skills/agent-invocation/SKILL.md:42 — "Only the session's main agent can run this chain, because a subagent cannot spawn further agents."
- plugins/claude/ai-dlc/skills/agent-invocation/SKILL.md:168 — "A subagent cannot spawn another agent, so it returns its questions to the orchestrator, which relays them."
- plugins/claude/ai-dlc/skills/ai-dlc/SKILL.md:186 — "Subagents cannot spawn subagents; if the session's main agent is itself a stage agent, it consults the upstream agent directly..."
- plugins/claude/ai-dlc/agents/orchestrator.md:43 — "Subagents cannot spawn further subagents, so the orchestrator must run as the session's main agent..."
- plugins/claude/ai-dlc/skills/init/templates/AGENTS.md:45 — same wording (generated from tools/templates/AGENTS.template.md + agents/orchestrator.md; edit sources, not this file)
- plugins/claude/ai-dlc/skills/plugin-management/SKILL.md:55 — "Subagents cannot spawn subagents." (orchestrator must be main agent)
- plugins/claude/ai-dlc/skills/review/SKILL.md:28 — "When you are a subagent (subagents cannot spawn further agents), run the axes as two separate passes..."
- plugins/claude/ai-dlc/agents/product-owner.md:30 — "return a delegation list the orchestrator executes (you cannot spawn agents yourself)."
- plugins/claude/ai-dlc/skills/system-design/references/design-it-twice.md:26 — conditional wording ("If you can spawn agents ... If you cannot spawn agents"); not a false claim per se.
- Outside plugin/: AGENTS.md:45 (same "Subagents cannot spawn further subagents" wording); README.md:91 ("subagents cannot spawn other subagents"); docs/plugins.md:72 (same). Note docs\plugins.md is a path with backslash in grep output.
- Copilot generated mirrors with the same text: plugins/copilot/ai-dlc/agents/orchestrator.agent.md:42, plugins/copilot/ai-dlc/skills/{agent-invocation/SKILL.md:42,168, ai-dlc/SKILL.md:186, review/SKILL.md:28, plugin-management/SKILL.md:55, init/templates/AGENTS.md:45}, plugins/copilot/ai-dlc/agents/product-owner.agent.md:29.

Confidence
- High for Claude Code default depth 3, the env var name, default and semantics: two official pages (sub-agents, env-vars) agree; the version history is in both.
- Medium for the headless/SDK note: one official page, no second official source.
- Low/unknown for Copilot: no document found that states nesting either way.
- Stale: the plugin's "cannot spawn" statements are wrong for Claude Code at default settings (depth 3). Claim is true only at depth 1 or for the main-agent requirement, which is a separate reason (the orchestrator needs to be main to run the team at default depth 3 too, unless the depth and tool setup allow it; docs do not say whether a plugin subagent with the Agent tool can run the orchestrator's full team, so the "must be main" rule needs a verified test before it is dropped).

Open questions
1. Does the orchestrator's main-agent requirement still hold at default depth 3? Docs say nesting is allowed; the reason for the rule (lifecycle needing 2+ layers, nested agents' Agent tool access, background/foreground waiting) needs a test run, not doc inference. agent-manager should not drop the "main agent" rule on docs alone.
2. Copilot: nesting unknown. Either test or keep wording as "not verified for Copilot".
3. Claude Code version of the user's install is not known to me; the depth-3 default applies from v2.1.219, so below that the default is 1 (the plugin's claim would hold there).
4. The memory save step was skipped (time); no persistence done.
5. Second-source for headless behaviour is missing.
