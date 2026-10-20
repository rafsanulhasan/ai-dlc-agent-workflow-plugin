# Hand-back 05: research-assistant — cluster E-review-quality-blast-undo

Stored verbatim on 2026-10-20 (work item RES-20261020-ai-dlc-mods).

---

I read all five mod pages, the Claude Code docs on checkpoints, hooks, VS Code and mods, and the GitHub Copilot CLI and VS Code docs. No mod covers R6, and R8 and R16 have gaps that matter on your setup.

Four facts shape the recommendations:

- **R16 gap 1:** `/rewind` does not restore edits made by subagents. In ai-dlc almost all edits are made by subagents.
- **R16 gap 2:** Claude Time Machine does not run on Windows, which is your platform.
- **VS Code:** mods do draw there, but the VS Code extension only shows a mod's side pane and its question dialog. The band above the prompt does not appear there, and three of these mods use it.
- **Copilot:** mods run only in Claude Code. Copilot needs its own hooks.

## The five mods

| Mod | What it does | How it works | Where it runs | License and source | Maturity |
|---|---|---|---|---|---|
| show-your-work | Shows screenshots and Playwright recordings in the chat, with before/after compare. It has no approve, reject or revert. [1] | Mod hooks (`tool.call`, `prompt.compose`, `ui.render`, …). Draws images with the kitty graphics protocol and copies files to `.show-your-work/`. [1] | Terminal only, and only terminals with kitty graphics. VS Code is not mentioned. [1] | MIT, github.com/iamumeransari/claude-show-your-work [1] | v0.6.4, 246 stars. Sends telemetry to PostHog and checks for updates, both on by default. [1] |
| eigenwise-quality-gate | Shows complexity, last test result and CRAP score for the functions Claude changed. A CLI fails any function scoring 6 or more. [2] | `classic.PostToolUse` marks tests stale. `turn.complete` runs `quality-gate turn` and shows the result in the band above the prompt. "Nothing in the hooks module blocks a tool call or ends a turn." [2] | Terminal listed. The band does not appear in VS Code. [2][6] | MIT, github.com/Eigenwise/eigenwise-toolshed [2] | No version, about 280 stars. Coverage for PHP and Vue is never verified. [2] |
| typesafe-mod | Sends AskUserQuestion choices to an outside model, shows a probability for each option, and can answer them itself (opt-in). It is not a quality gate. [3] | `tool.call` and `ui.render`. Calls `api.typesafe.ai`. Lets the turn continue if that fails. [3] | Terminal listed. [3] | MIT, github.com/BeLazy167/typesafe-mod [3] | 6 stars. Needs an API key and sends data to a third party. [3] |
| blast-radius | Holds `rm -r/-f`, `git reset --hard`, `git clean`, force-push and database migrations. Shows a report of what would change, with Proceed and Cancel; Cancel refuses the command and Claude is told why. [4][5] | `tool.call` on Bash. Measures the impact with `git status`, `find` and `du`. Report in a side pane at 144 columns or wider, otherwise in the band. Times out to Cancel after 10 minutes. [4] | Terminal listed. VS Code is plausible but unverified. [4][6] | Apache-2.0, anthropics/claude-code-playground, path `claude-code/mods` [4] | v0.1.0, an Anthropic sample shared as-is. "a safety net, not a sandbox." Misses `find -delete` and `xargs rm`. [4] |
| claude-time-machine | Undo a whole turn or one step, including Bash changes. Also review, travel to an earlier snapshot, and bookmarks. Does not rewind the conversation. [7] | Every edit and every Bash command that can write becomes a git snapshot, kept in a separate bare repository under `~/.claude/time-machine/`. Your own repository is untouched. Undo offered in the band. [7] | Terminal only. macOS or Linux, no Windows. [7] | MIT, github.com/xzwache/claude-time-machine [7] | 1 star, tested with Claude Code 2.1.287. [7] |

## Platform answers

- **Checkpoints and `/rewind` in the CLI and VS Code:** both have them. The checkpoints page [8]:
  - restores only edits made with Claude's file tools, not Bash
  - keeps the 100 most recent checkpoints
  - deletes snapshots after about 30 days
  - offers restore code, restore conversation, or both
  - **does not restore subagent edits**, apart from a skill that runs in the foreground

  In VS Code, hovering a message gives "Rewind code to here" and "Fork conversation and rewind code" [9].
- **Can a pane reject a file change, revert it and tell the agent?** Yes, if you build it as a mod:
  - `tool.call` fires for Edit and Write, including calls made by subagents.
  - The mod can read the file first with `$.fs.read`, then write the old content back with `$.fs.write`.
  - A Button press arrives as `ui.press`.
  - `$.prompt.submit({text})` sends a message to Claude, labelled as coming from the mod.
  - Panes and Buttons draw in the VS Code extension from version 2.1.299, but clicking is the only way to press a button there; hotkeys are ignored. [6][10][11]

  Settings hooks cannot do this: a PostToolUse hook runs after the edit and can only add text for Claude; nothing undoes the edit [12]. A held tool call can also wait for the user with `$.ui.ask`; it is drawn as the question dialog, which VS Code shows [10][11].
- **PreToolUse "ask" with context for a destructive Bash command:** yes.
  - `permissionDecision` can be `allow`, `deny`, `ask` or `defer`.
  - For `ask`, the reason is shown to the user in the permission prompt. For `deny`, it is shown to Claude.
  - `additionalContext` is ignored only with `defer`, so it is kept with `ask`. That is my reading of the docs; they don't say it outright. [12]
  - There are bug reports of the VS Code extension ignoring `ask` (marked closed), and of `ask` being approved silently in bypassPermissions mode (open). Neither is verified for current versions [15].
  - The permission prompt is plain text, and mods cannot change what it shows [6]. A blast-radius report needs a mod pane or `$.ui.ask`.
- **Copilot equivalents:**
  - **Copilot CLI** `preToolUse` accepts `allow`, `deny` and `ask`, plus `modifiedArgs`. `ask` is treated as deny in the cloud agent and in autopilot mode. `additionalContext` is not listed for preToolUse, only for postToolUse and others. The CLI reads plugin `hooks.json` files and `.claude/settings.json` hooks using Claude's event names. No checkpoint feature is documented. [13]
  - **VS Code with Copilot:** native Keep/Undo per file or per change, a changed-files list, and checkpoints with Restore Checkpoint and Redo. These do not reverse terminal commands, and Undo does not tell the agent (feedback goes through inline comments and Submit Feedback in the Agents window) [14]. VS Code agent hooks support PreToolUse with allow, deny or ask and `additionalContext` [15, from a search summary; I did not read that page].
  - No equivalent of mod panes was found for Copilot.

## Requirements

| Req | Covered by | Gaps | Feasibility | Recommendation |
|---|---|---|---|---|
| **R6** live review gate | No mod. VS Code's Keep/Undo works in Copilot local sessions only [14]. The Claude VS Code extension has accept/reject per change before an edit is applied, in Manual mode [9]. | No workflow-wide list of changed files with approve and reject. No mod feeds a rejection back. Files changed by Bash are invisible to `tool.call`. | High on Claude Code (CLI, Desktop, VS Code 2.1.299+) [6]. On Copilot, use the native Keep/Undo only. | **Build** a mod:<br>• `tool.call` on Edit and Write saves each file's old content and records the subagent or stage.<br>• A Pane lists the changes with Approve and Reject.<br>• Reject writes the old content back, then `$.prompt.submit` tells the agent why.<br>• Add a `git status` sweep to catch Bash changes.<br>• Reuse ideas from the built-in `/diff` mod source [6]. |
| **R7** quality gate | eigenwise-quality-gate shows signals but enforces nothing [2]. typesafe-mod does not fit [3]. | Nothing blocks. Its band does not show in VS Code. Nothing is tied to sqa-engineer or brutal-critique results. | High. | **Reuse the idea.** Run its `quality-gate crap` CLI from sqa-engineer, and enforce the gate with a Stop or SubagentStop settings hook (works on both platforms) or a `tool.check` deny. Show status in a Pane, not the band. Note that ai-dlc ships no hooks today; stack hooks are installed by `/ai-dlc:init` (CLAUDE.md). |
| **R8** blast radius | blast-radius [4][5] | Narrow list of commands, partial shell parsing. Terminal is the only listed surface. It needs `bash`, `find` and `du` (works on Windows only with Git Bash, unverified). No Copilot version. | High on Claude Code. On Copilot, a preToolUse `ask` can carry a short reason but no pane [13]. | **Integrate** it as an optional companion. It is Apache-2.0 [4], so a fork or vendored copy is allowed, keeping the license. It cannot be a plugin dependency from that marketplace without your own marketplace entry (unverified). For Copilot, add a preToolUse `ask` whose reason summarizes the impact. |
| **R16** undo a whole turn | `/rewind` on CLI and VS Code, file-tool edits only [8][9]. Claude Time Machine adds Bash [7]. VS Code Copilot checkpoints [14]. | `/rewind` misses subagent edits [8], the main path in ai-dlc. Time Machine has no Windows support [7]. Whether Time Machine captures subagent edits is unverified. Neither reverts terminal side effects outside files. | Medium. | **Build, reusing Time Machine's design:**<br>• Before each stage's spawn, save a git snapshot to a separate repository or a private ref; `git stash create` plus `update-ref` is one way.<br>• Record its id in the run state (`run.md`).<br>• "Undo stage" restores that snapshot.<br>• Write it in Node so it runs on Windows.<br>• Keep `/rewind` for the main conversation. |

## Unverified
- Whether blast-radius, Quality Gate and Time Machine work in the VS Code panel. The pages say only "terminal", while the docs say panes draw in VS Code [6].
- Whether blast-radius's bash/find/du checks work on Windows.
- Whether Time Machine captures subagent edits.
- The current state of `ask` in the VS Code extension and under bypassPermissions [15].
- The full field schema of VS Code's agent hooks (search summary only).

## Sources
1. https://claude-mods.com/show-your-work/
2. https://claude-mods.com/eigenwise-quality-gate/
3. https://claude-mods.com/typesafe-mod/
4. https://claude-mods.com/blast-radius/
5. https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods/blast-radius
6. https://code.claude.com/docs/en/plugins/mods/overview
7. https://claude-mods.com/claude-time-machine/
8. https://code.claude.com/docs/en/checkpointing
9. https://code.claude.com/docs/en/vs-code (sections on rewind with checkpoints, plugins that draw in the panel, and accept/reject per change)
10. https://code.claude.com/docs/en/plugins/mods/events
11. https://code.claude.com/docs/en/plugins/mods/reference (render sites and elements by surface)
12. https://code.claude.com/docs/en/hooks (PreToolUse and PostToolUse decision control)
13. https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-hooks-reference
14. https://code.visualstudio.com/docs/agents/run/review-code-edits
15. https://code.visualstudio.com/docs/agents/reference/hooks-reference (search summary only), https://claudeissues.com/issue/13339-bug-vs-code-extension-ignores-hook-permissiondecision-ask, https://claudeissues.com/issue/77212-pretooluse-hook-permissiondecision-ask-is-silently-auto-approved-under-bypassper

Confidence: High for the mod facts and Claude Code platform behaviour (from the docs). Medium for Copilot and VS Code hooks. Low for the items under Unverified.

Open questions:
1. Should R6 gate each edit as it happens, or review a whole stage's changes at the G4 gate?
2. Should Bash-made changes count as "files changed by agents" for R6 and R16?
3. Is Copilot coverage for R6 and R8 required, or is it acceptable that only Claude Code gets the panes?
