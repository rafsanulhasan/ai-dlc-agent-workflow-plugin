# Hand-back 01: research-assistant — cluster A-limits-handoff

Stored verbatim on 2026-10-20 (work item RES-20261020-ai-dlc-mods).

---

I could not verify most of R2. I also need you to settle one question before design: does "session limit" in R1 mean the context window filling up, or Claude's 5-hour usage window? Both can be read. auto-handoff watches the context window, and budget-guard watches the 5-hour and 7-day windows.

No memory was saved because plan mode is on. I edited no files.

## Per-mod table

| Mod | What it does | Mechanism | Harness | License / source | Maturity |
|---|---|---|---|---|---|
| auto-handoff | Replaces auto-compact. Haiku writes a brief, the mod runs `/clear`, then submits a seed prompt that tells the fresh session to read the brief. | Mod; events `turn.complete`, `turn.step`, `tool.call`, `session.compact`, `prompt.submit`, `ui.render` | CLI and Desktop, Claude Code 2.1.287+; VS Code gets toasts only; no Copilot | MIT, github.com/alexknowshtml/claude-auto-handoff | about 0.8.6; on Windows its page server does not start (no `sh`) [claude-mods.com/auto-handoff] |
| shunt | `/shunt:usage` shows how much is left in a gateway's account pool for the 5h, 7d and fable windows. The routing happens in the gateway, not the mod. | Mod; `command.run` plus one `$.http.fetch`; the gateway sits behind `ANTHROPIC_BASE_URL` | CLI 2.1.287+ only; needs the gateway running | MIT OR Apache-2.0, no LICENSE file; github.com/pleaseai/shunt | 0.1.0, pre-1.0 gateway [claude-mods.com/shunt] |
| BitFrost | Runs Codex, GLM, Gemini CLI and others as Claude Code subagents, on those apps' own accounts | Mod plus a local helper `bitfrostd`; uses `agent.register`, `tool.register`, `turn.step` | CLI and Desktop; Linux and macOS 12.3+ only, so not Windows | GPL-3.0-only; github.com/SavaSoftworks/BitFrost | beta [claude-mods.com/bitfrost] |
| budget-guard | Warns at 80%, then blocks tool calls once cost, 5h % or 7d % passes its limit (defaults 90% and 95%) | Mod; reads `$.session.usage()` and the `rateLimits` kinds `five_hour` and `seven_day` | Interactive CLI only; the window guards need a Claude subscription | MIT, no LICENSE file; github.com/Arunjay4213/claude-mods | about 9 stars, tested on 2.1.272 [claude-mods.com/budget-guard] |
| session-brief (now recap-plus) | A band above the prompt showing the session's purpose and status, rewritten by Haiku after every turn | Mod; `turn.complete`, `model.complete`, `ui.render` | CLI and Desktop; not the VS Code extension | MIT; github.com/skanehira/claude-recap-plus | early [claude-mods.com/session-brief] |
| handoff-compact | Replaces the compaction summary with a 9-part handoff written by `model.fork`, saved to `~/.claude/handoffs/` | Mod; `session.compact` (and optionally `session.measure`) | CLI and the Desktop Code tab | MIT; github.com/trytofly94/handoff-compact | 0.2, piloted on one live session [claude-mods.com/handoff-compact] |
| session-hud | A status line above the prompt (branch, context %, 7-day %) plus a details pane with 5h and weekly usage | Mod; `session.measure`, `ui.render` | CLI, Desktop and SSH; not the VS Code chat panel, `-p` or the SDK | MIT; github.com/bradtraversy/traversy-claude-mods | early, 2 stars [claude-mods.com/session-hud] |

## Platform facts

- **Status line JSON** carries `rate_limits.five_hour.used_percentage`, `rate_limits.seven_day.used_percentage`, both `resets_at`, and `context_window.used_percentage` [code.claude.com/docs/en/statusline].
- `rate_limits` appears only for Pro and Max subscribers (or behind a Claude apps gateway), only after the first API response, and each window can be missing [same page].
- **The mods API** has `$.session.usage()`, which returns `{context:{tokens,window,percent}, rateLimits:[{kind,percentUsed,resetsAt}], cost}`. The `session.measure` event fires after each turn and whenever a plan-limit percentage changes [code.claude.com/docs/en/plugins/mods/reference].
- **Where mods run:** mod hooks run in the CLI, Desktop, the VS Code extension and `claude -p`. Drawing works in VS Code from extension 2.1.299, but the band above the prompt (`AbovePrompt`) is terminal and Desktop only [code.claude.com/docs/en/plugins/mods/overview; reference].
- **Copilot (CLI or VS Code) cannot load Claude mods.** I found nothing showing that it does.
- **The status line in the VS Code extension** is unverified. A community issue says statusLine does not run there and hook payloads lack `rate_limits` [claudeissues.com/issue/38646]. In VS Code, `/usage` opens an Account & usage dialog [code.claude.com/docs/en/vs-code].
- **Ending a session and starting a new one from code:**
  - A mod can call `$.command.run` and `$.prompt.submit({text, asUser})` [code.claude.com/docs/en/plugins/mods/api].
  - The docs do not say `$.command.run` can run built-ins like `/clear`; auto-handoff's page says it does this. Treat that as verified by one third party only.
  - `session.end` fires on `/clear` with `reason: clear` [reference].
  - Settings ("classic") hooks can block or add context but cannot start a new session. I found no API for it.
- **No mods API method switches account, provider or login.** The reference lists none. `/login` is an interactive OAuth flow.
- **Switching Claude accounts:**
  - `CLAUDE_CONFIG_DIR` gives each account its own config directory. This is unverified in official docs (only third parties [blog.codeminer42.com], and the official env-vars page only mentions it in passing).
  - `CLAUDE_CODE_OAUTH_TOKEN` (made with `claude setup-token`) sets the credential for a whole session, and a restart is needed to replace it [code.claude.com/docs/en/env-vars].
- **Copilot CLI:**
  - Supports several accounts: `/user list` and `/user switch` [docs.github.com/.../authenticate-copilot-cli].
  - Token variables, in order of precedence: `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, `GITHUB_TOKEN` [same page].
  - `-p` runs one prompt without a session and `--resume [ID]` resumes one [docs.github.com/en/copilot/reference/cli-command-reference].
  - I found no Copilot equivalent of the 5h/7d percentages.
- **Native compaction controls:** `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` (it can only lower the trigger) and `CLAUDE_CODE_AUTO_COMPACT_WINDOW` [env-vars].
- **What the repo already has:** the `handoff` skill defines a mid-stage session handoff and the `run.md` run state [plugins/claude/ai-dlc/skills/handoff/SKILL.md:120 and :201]. Use that as the handoff format instead of a Haiku brief.

## R1: stop at 70% session use, write a handoff, start a fresh session

- **Covered by:** auto-handoff covers the context-window case end to end. budget-guard (5h window) and handoff-compact (brief format) cover parts of it.
- **Gaps:**
  - auto-handoff's trigger is a token count (default 160k), not 70%.
  - Its brief is Haiku's, not the repo's `run.md` and session handoff.
  - Its panel and `/clear` behaviour are not described for VS Code.
  - No mod covers Copilot.
- **Feasibility:**
  - High in the Claude CLI and Desktop: read `$.session.usage()` in `session.measure` or `turn.complete`, stop with `$.turn.abort`, write the handoff, run `/clear`, then submit the seed prompt.
  - Medium in the VS Code extension: hooks run there, but `/clear` via `$.command.run` is not verified there.
  - Not feasible in Copilot: there is no mod runtime and no usage percentage.
- **Recommendation:** build our own mod. Reuse auto-handoff's `/clear` plus `prompt.submit` idea and budget-guard's `rateLimits` reading (both MIT). Point the seed prompt at `docs/handoffs/<item>/run.md`.

## R2: at 70% weekly use, stop, hand off, continue on another account or provider

- **Covered by:**
  - budget-guard covers detecting the 7d window and blocking.
  - shunt pools accounts and providers, but at the gateway level: it needs a self-hosted gateway, sits behind `ANTHROPIC_BASE_URL`, and is pre-1.0.
  - BitFrost hands work to other providers' CLIs, but not on Windows and under GPL-3.
- **Gaps:**
  - No mod or API switches account or provider inside a session.
  - Continuing automatically would need an outside launcher: exit, then relaunch `claude` with another `CLAUDE_CONFIG_DIR` or OAuth token, or `copilot` with another token and a prompt that reads the handoff.
  - Starting an interactive terminal from `$.process.spawn` is unverified, and so is it working on Windows.
- **Feasibility:**
  - Stop and write the handoff: high.
  - Hand over to Copilot through the shared handoff files: medium, since Copilot reads `AGENTS.md` and the ai-dlc `handoff` skill. Practically it means telling the user the next command to run.
  - Fully automatic account rotation: low. It blocks on interactive `/login`, has no in-process switch, and may conflict with Anthropic's terms of service (unverified; check before building).
- **Recommendation:**
  - Build the stop-and-handoff part plus a "continue elsewhere" instruction that names the exact `copilot` or `claude` command.
  - Treat an outside launcher script as optional, and gate it on a terms-of-service check.
  - Reuse shunt only as an idea (an optional gateway). Do not bundle BitFrost (GPL-3, no Windows support).

## Open questions

- R1: is "session" the context window or the 5h plan window? (asked above)
- Does `tools/build-copilot.mjs` drop `hooks/hooks.json` `modules` from the Copilot projection? A separate Claude-only mods plugin avoids the question. Not checked.
- Is rotating accounts allowed under Anthropic's consumer terms? Unverified.
