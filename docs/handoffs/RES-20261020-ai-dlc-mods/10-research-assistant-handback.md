# Hand-back 10: research-assistant — cluster J-platform-capabilities

Stored verbatim on 2026-10-20 (work item RES-20261020-ai-dlc-mods).

---

Mods are an official Claude Code feature, and one plugin can carry a mod to the CLI, the Desktop app and the VS Code extension (v2.1.299 or later). In the VS Code panel there is no band above the prompt and buttons have no hotkeys. Copilot has nothing like mods: it gets settings-style shell hooks, agents, skills and MCP servers only. The Claude docs used here are current as of v2.1.290 (CLI) and v2.1.299 (VS Code extension), and the mods API "can still change between releases" (claude-mods.com).

**What a mod is.** A plugin whose `hooks/hooks.json` has `"modules": ["./register.js"]`. That JS/TS file exports `register(on)` and runs inside Claude Code, not as a separate process. It can draw on screen, step into events and call a `$` API with namespaces such as `$.ui`, `$.session`, `$.model`, `$.prompt`, `$.command` and `$.clock` [MO][MR]. It installs like any plugin from a marketplace with `claude plugin install x@market`, and works in the CLI, Desktop and VS Code extension [MO]. claude-mods.com is a third-party directory that only links to mod repos on GitHub [CM].

## Capability matrix

Cells are Y (yes), P (partial), N (no) or ? (not verified).

| Capability | Claude Code CLI | Claude Code VS Code ext | Copilot CLI | Copilot in VS Code |
|---|---|---|---|---|
| Plugins / marketplace | Y [MO] | Y, `/plugins` UI and `vscode://…/install-plugin` links [VS] | Y: `plugin.json`, agents, skills, `hooks.json`, `.mcp.json`; `enabledPlugins` and `extraKnownMarketplaces` settings [CP][CC] | Y: reads Copilot and Claude plugin formats, but "not every component works in every harness"; marketplaces setting is Experimental [VP] |
| Settings hooks | Y, about 33 events, including the ones you listed plus `PreModelSwitch`/`PostModelSwitch`, `PostCompact`, `SubagentStart`, `SessionEnd` [H] | Y: they run, and the Customize › Hooks UI lists them [VS][MO] | Y, 14 camelCase events: `sessionStart`, `preToolUse`, `postToolUse`, `agentStop`, `subagentStop`, `preCompact`, `notification`, `errorOccurred`… [CH] | P, 8 events: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PreCompact`, `SubagentStart`, `SubagentStop`, `Stop`. Preview. Claude-format files only with `chat.useClaudeHooks`, and matchers are ignored [VH][VHR] |
| In-process mods | Y [MO] | Y; drawing needs ext 2.1.299+ (2.1.304+ without feature flags, e.g. Bedrock) [MO] | N | N |
| Status line (script) | Y; JSON on stdin; `refreshInterval` [SL] | N per user-filed issues (only in terminal mode). Docs are silent [VSI]. A mod's `$.ui.status` shows above the prompt box instead [MI] | Y: `statusLine.command` plus built-in `footer.showQuota` and `showContextWindow`. Stdin JSON schema not found [CC] | N, not found in the docs |
| Pane | Y [MR] | Y: docks at 800px or wider, otherwise inline with 12 rows [MI] | N | N for agent plugins. Only a separate VS Code extension (webview) can do this [VW] |
| Band above the prompt | Y [MR] | **N**: not rendered in VS Code [MR] | N | N |
| Buttons / Input / Select | Y, with hotkeys [MR] | Y, click or Enter only, no hotkeys [MR][MI] | N | Webview extension only [VW] |
| Toast / transcript log line | Y [MA] | Y, shown above the prompt box [MA][MI] | N | N |
| Slash commands | Y; a mod can add one that runs at once, with no Claude turn [MA] | P: only a subset of built-ins; mod commands not verified there [VS] | Y, skills and prompts | Y, prompt files and plugin commands [VP] |
| MCP servers | Y | Y [VS] | Y [CP] | Y [VP] |
| Output styles | Y | Y [VS] | N, not found | N, not found |
| Context % / tokens | Y: `context_window.*` in the status line [SL]; `$.session.usage().context` [MR] | Y via a mod; built-in context indicator [VS] | P: `/context`, footer only [CU][CC] | N for hooks [VHR] |
| 5-hour / weekly limit % | Y: `rate_limits.five_hour` and `seven_day` `used_percentage` and `resets_at`, Pro/Max only [SL]; `$.session.usage().rateLimits` [MR] | Y via a mod; `/usage` dialog [VS] | P: footer quota, `/usage` credits; not given to hooks [CU][CC] | P: quota dashboard in the Status Bar only (search summary of the VS Code FAQ, not checked against the page) |
| Cost | Y: `cost.total_cost_usd` (an estimate) [SL]; `usage().cost` [DTS] | Y via a mod | P: `/usage` [CU] | N |
| Cache read/write tokens | Y: `current_usage.cache_*` and a `prompt_cache` object [SL]; per request in `turn.step` `result.usage` [ME] | Y via a mod | N, not documented | N |
| Per-subagent usage | Y: `turn.step` and `turn.complete` carry `agentId` and `usage` [ME][DTS]; `/usage` attributes usage to each subagent [VS] | Y via a mod | N; `subagentStop` gives only `transcriptPath` [CH] | N, `transcript_path` only, and its format is "not a stable API" [VHR] |
| Transcript path | Y in every hook [H]; `$.session.messages()`, newest 4,096 entries [MR] | Y | Y on stop and compact events [CH] | P, optional [VHR] |
| **Control:** compact | Settings hook: can block only. **Mod: `$.session.compact()`; rejects while a turn runs** [DTS] | Mod: Y | N; `preCompact` observes only [CH] | N [VHR] |
| New session | Settings hook: N [H]. Mod: no dedicated method. `$.command.run` "runs a slash command as if the person typed" it, but whether `/clear` works through it is not confirmed [DTS] | same as CLI | N | N |
| Model / effort | Settings hook: block a switch only [H]. Mod: change the model or effort per request in `turn.step` or `agent.spawn` [MR]; no setter for the session model found | same | `model` and `effortLevel` settings; no hook control [CC] | User picker; agent `model` field not confirmed [VCA] |
| Rewind / checkpoint | User only (`/rewind`); no mod method found | User only [VS] | N, not found | N, not found |
| Switch account | N. `$.session.authorize()` returns only an opaque credential handle [DTS] | N | N (`forceLoginOrgs` only restricts sign-in) [CC] | N |
| Start a turn from a background job | Mod: `$.prompt.submit`, waits for idle [MA] | Y | N | N |
| One package for CLI and VS Code | Y: the same plugin. Hooks run everywhere; what draws depends on the app (`e.surface`) [MO] | ← | P: shares the plugin layout; mod `modules` are ignored or unknown | P [VP] |

## Hard blockers

1. **Automatic session restart.** No hook or mod API starts a new session [H][MR]. Possible workaround: a mod runs `/clear` through `$.command.run` (not confirmed), then `$.prompt.submit` a handoff. Note `session.start` does not fire again after `/clear` [MR]. Copilot (both harnesses): blocked, `SessionStart` is observe-only [VHR][CH].
2. **Cross-account or cross-provider failover.** No API switches the credential or account [DTS]. `fallbackModel` explicitly skips "authentication, billing, rate-limit" errors and only changes model for one turn [MC]. Theoretical loophole: a `turn.step` hook can answer without calling the model [ME], so a mod could proxy one request to another provider with `$.http.fetch`. That is unverified, the streamed result shape is complex, and it is fragile. Copilot: only `continueOnAutoMode` (switches to auto model on a rate limit) and an `allowed_models` fallback [CC].
3. **Auto-compaction.** Possible in Claude Code (CLI and VS Code) with a mod: watch `session.measure` or `turn.complete`, then call `$.session.compact()` [MR][DTS]. It cannot run mid-turn. Built-in alternatives are `autoCompactWindow` and `/autocompact` [MC]. Not possible with settings hooks, and blocked on Copilot.
4. **Cache keep-alive.** No dedicated API. A mod could ping on a timer with `$.clock.every` plus `$.model.fork()`, which "repeats the conversation's last request" and is served from the cache [MA]. That costs usage, and whether it refreshes the main session's TTL is inferred, not documented. The supported route is the `promptCacheTtl: "1h"` setting, plus `idleCompaction` [PC]. Copilot: blocked.
5. **Panes with buttons.** CLI: yes. VS Code extension: panes and buttons yes, but no band above the prompt and no hotkeys [MR][MI]. Copilot: blocked unless you build a separate VS Code extension with a webview, which is a different package and distribution [VW].
6. **Per-agent token accounting.** Claude Code: solved by a mod via `turn.step` `agentId` + `usage` [ME][DTS]. Settings hooks can only parse transcripts. The status line's `prompt_cache` object does not count subagent requests [SL]. Copilot: blocked, transcript-only, and the transcript is "not a stable API" [VHR].

## Confidence and open questions

- **Confidence: Medium-High** for the Claude Code rows (official docs plus the types file), **Medium** for Copilot (official docs, but the status-line JSON schema and the agent `model` field were not found).
- Where the sources disagree:
  - The harness-mods listing on claude-mods.com says its AbovePrompt band "was removed on 18 September". That is about that one third-party mod; the official reference still lists the `AbovePrompt` site.
  - Third-party mods (ctx-handoff and others) reportedly use `/clear` and `/model`, which supports, but does not prove, that `$.command.run` reaches built-in commands.
- Open questions:
  1. Can `$.command.run` run `/clear`, `/model` and `/login`?
  2. Does a `hooks.json` containing `modules` break Copilot CLI or VS Code plugin loading? This matters for the existing `build-copilot.mjs` projection, which may need to strip it.
  3. Do mod-registered slash commands appear in the VS Code panel?

I did not save anything to memory because plan mode allows no writes.

## Sources

- [H] https://code.claude.com/docs/en/hooks
- [SL] https://code.claude.com/docs/en/statusline
- [MO] https://code.claude.com/docs/en/plugins/mods/overview.md
- [MA] https://code.claude.com/docs/en/plugins/mods/api.md
- [ME] https://code.claude.com/docs/en/plugins/mods/events.md
- [MI] https://code.claude.com/docs/en/plugins/mods/interface.md
- [MR] https://code.claude.com/docs/en/plugins/mods/reference.md
- [DTS] https://github.com/anthropics/claude-code/blob/main/mods/types/claude-code.d.ts
- [VS] https://code.claude.com/docs/en/vs-code
- [PC] https://code.claude.com/docs/en/prompt-caching.md
- [MC] https://code.claude.com/docs/en/model-config.md
- [CM] https://claude-mods.com/ and https://claude-mods.com/harness-mods/
- [CH] https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-hooks-reference
- [CC] https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference
- [CU] https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-cli
- [CP] https://docs.github.com/en/copilot/concepts/agents/about-plugins
- [VH] https://code.visualstudio.com/docs/copilot/customization/hooks
- [VHR] https://code.visualstudio.com/docs/agents/reference/hooks-reference
- [VP] https://code.visualstudio.com/docs/copilot/customization/agent-plugins
- [VCA] https://code.visualstudio.com/docs/copilot/customization/custom-agents
- [VW] https://code.visualstudio.com/api/extension-guides/webview
- [VSI] community issues, not official: https://github.com/anthropics/claude-code/issues/20207 and https://claudeissues.com/issue/77829-feature-request-render-the-custom-statusline-in-the-vs-code-extension-panel-pari
