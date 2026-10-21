---
run: AAW-20261021-absorb-auto-handoff
work-item: WI-2
lifecycle: AAW
step: 1
from: research-assistant
to: orchestrator
mode: subagent
loop: none
received: 2026-10-21 00:30
---

handoff 1-orchestrator-to-research-assistant.handoff.md: passed — all 5 ACs answered from official docs and repo files; 5 items are Inconclusive (marked). Copilot hook facts come from WebFetch summaries of the GitHub and VS Code pages, so treat them as Medium confidence.

## AC-1 (d) mod hooks module inside the ai-dlc plugin
- A plugin can hold skills, agents, hooks, MCP servers and a hooks module together. The docs say "A plugin can hold all of them, so a mod can ship in the same plugin as a skill and an MCP server" — code.claude.com/docs/en/plugins/mods/overview, "Compare mods..." (mods docs, CLI 2.1.287+)
- Required files for a mod: `.claude-plugin/plugin.json`, `hooks/hooks.json` with `"modules": ["./register.js"]` (one path, relative to hooks.json), and the hooks module itself. It exports `register(on, options)` and may be `.js .mjs .cjs .jsx .ts .mts .cts .tsx`. — code.claude.com/docs/en/plugins/mods/reference#files (reference covers CLI as of v2.1.290)
- `hooks/hooks.json` "can also hold settings hooks under `hooks`", so one file may carry both `modules` and `hooks`. — mods/reference#files
- `types/index.d.ts` (the manifest `types` field) is needed only when the mod uses `$.state` or adds a namespace to the mods API. — mods/reference#files
- auto-handoff uses module variables, not `$.state` (`register.tsx:29`, `:315`). It also declares no `types` field (its `plugin.json:1-49` has none). It needs no `types` file. — repo
- Existing mod layout: `hooks/hooks.json` is exactly `{ "modules": ["./register.tsx"] }`. — `plugins/claude-mods/auto-handoff/hooks/hooks.json:1`
- `plugin validate --strict` "reads a plugin's manifest and hooks module and reports errors, the events it handles, and the mods API calls it makes. `--strict` treats warnings as errors". Output has `hooks:` and `calls:` lines. — mods/reference#commands, mods/overview (v2.1.287+)
- CI already runs `plugin validate --strict ./plugins/claude/ai-dlc`. After the move, that command would parse the TypeScript module too. — `.github/workflows/validate.yml:20`
- `plugin test` runs every file "whose name ends in `.test.ts` or `.test.tsx`" under the given directory, or the current directory if none is given. Exit status is 1 on failure. A test file can be saved "anywhere in the plugin directory". — mods/reference#commands, mods/test#write-a-test
- Each test file needs at least one `test()`, or the run fails. A test can import the mod's own files and sibling `.ts` helpers. — mods/test
- Implication: `claude plugin test ./plugins/claude/ai-dlc` would pick up any `*.test.ts(x)` placed anywhere in the plugin, skills included. CI currently has no `plugin test` step for ai-dlc; one must be added. The mod tests are `tests/viewer.test.ts`, `tests/seed-row.test.tsx` and `tests/auto-handoff.test.tsx`. — repo
- `userConfig` sits in `plugin.json` at the top level. Each option needs `type`, `title` and `description`; `default`, `required`, `min`, `max`, `options` and `sensitive` are optional. An unknown key inside an option is an error and the plugin does not load. — code.claude.com/docs/en/plugins/manifest-reference#user-configuration
- Option values reach the mod as `register`'s `options` argument, with defaults filled in. — mods/reference#files
- Non-sensitive values are stored under `pluginConfigs` in the user's `settings.json`. A mod's values are keyed by plugin id. — manifest-reference, mods/reference#settings
- The auto-handoff `userConfig` has 6 keys, all with defaults and none `required`. They are `threshold`, `maxConsecutiveHandoffs`, `briefTemplate`, `instructionsTemplate`, `ignoreFiles` and `viewer`. None use `options`, so the "v2.1.271+ if any field declares `options`" constraint does not apply. — `plugin.json:11-48`, manifest-reference
- Absorbing the mod puts these 6 options on ai-dlc's configure dialog and in `/config` rows (rows need v2.1.269+). The `/config` rows are documented as one per option, except `sensitive` and `multiple`. — manifest-reference
- Older than the mods minimum: the docs say only "In the terminal, use Claude Code v2.1.287 or later" (mods/overview#turn-mods-on-or-off). "Your version is too old" in mods/troubleshoot just links back there.
  - Whether an older CLI ignores `hooks/hooks.json` `modules` or fails the whole plugin — Inconclusive. The docs never state it.
- Documented partial evidence: `disableAllHooks`, `allowManagedModsOnly` and a refused module "stop a mod and leave the rest of its plugin in place: the plugin stays installed, and its skills, commands, agents, and MCP servers load". — mods/overview#turn-mods-on-or-off, mods/troubleshoot refusal table. That covers refusals, not old versions.
- Related: a failing hooks module is skipped and "the session continues". — mods/troubleshoot intro
- An unrecognized top-level manifest key is stripped, not fatal. A hooks-file schema error on an old CLI is not covered. — manifest-reference#unrecognized-fields
- Related minimums: `options` on a userConfig field needs v2.1.271+ and `types` is not version-gated in the docs. For v2.1.289+ `ui.fault` and `Client` errors differ, but that is cosmetic. — manifest-reference, mods/reference
- Interactive-only: `claude -p` and the Agent SDK run hooks but draw nothing. Mods work in the CLI, the Desktop Code tab (not WSL sessions) and the VS Code extension chat panel. — mods/overview#where-mods-run
- Repo README already says "needs Claude Code 2.1.287+" (`README.md:71-80`, per brief).
- Existing ai-dlc manifest has a `dependencies` array and no hooks of its own (the build handles no `hooks/` folder today). — `build-copilot.mjs:314-331`

## AC-2 (a) dependency install and enable
- On install, Claude Code "also installs and enables the plugin's declared dependencies at the same scope". The success message lists them. — code.claude.com/docs/en/plugins/install#plugins-with-dependencies
- On enable, it also enables dependencies that are installed but disabled. If a dependency is not installed, the enable fails and says to install it first. — same
- On disable, "when another enabled plugin still needs the one you named, Claude Code refuses and prints a chained command that disables both in the right order". So a user cannot disable cache-keepalive while ai-dlc stays enabled. — same
- On uninstall, auto-installed dependencies stay until `claude plugin prune`. — same, plugins/dependencies "See also"
- Manifest wording: `dependencies` are "Plugins that must be enabled for this one to work". Entries are `"name"`, `"name@marketplace"` or `{name, marketplace, version}`. A bare name resolves in the declaring plugin's own marketplace. — manifest-reference#dependencies
- `defaultEnabled`: "A plugin that an enabled plugin depends on starts enabled regardless." — manifest-reference#defaultenabled
- The same install paths also install missing dependencies: `/reload-plugins`, marketplace auto-update, re-running install, and `marketplace add`. — plugins/dependencies
- Cross-marketplace dependencies need `allowCrossMarketplaceDependenciesOn` in the root marketplace. A bare-name dependency inside the same marketplace needs no allowlist. — plugins/dependencies
- A disabled or absent dependency disables the dependent plugin at the next load. The documented wording ("is disabled — enable it or remove the dependency") is for the `--plugin-dir` case; the same rule is stated generally ("Plugins that must be enabled"). — plugins/dependencies#test-a-plugin-and-its-dependency-locally
- Absorbing auto-handoff leaves two risks, neither documented:
  - Users who installed the standalone `auto-handoff` plugin keep it, since auto-installed dependencies persist until `prune`. It would then run alongside ai-dlc's copy. The docs say duplicate names block a second copy ("another plugin of that name loads first"). Different plugin names are not covered — Inconclusive.
  - The version scheme: the dependent bumps its own version. A removed dependency leaves the old `auto-handoff` installed. `claude plugin prune` removes it.

## AC-3 (b) Copilot hooks
- Copilot CLI events: `agentStop`, `errorOccurred`, `notification`, `permissionRequest`, `postToolUse`, `postToolUseFailure`, `preCompact`, `preToolUse`, `sessionEnd`, `sessionStart`, `subagentStart`, `subagentStop`, `userPromptSubmitted`, `userPromptTransformed`. PascalCase names select the VS Code payload format. — docs.github.com/en/copilot/reference/hooks-configuration (WebFetch summary, Copilot CLI + cloud agent)
- `agentStop`/`Stop` can block and force another turn, using `reason` as the next prompt. After 8 consecutive blocks the CLI ends the turn. — same
- `notification` is fire-and-forget. It can inject `additionalContext`. Types include `agent_idle`. It does not fire under the cloud agent. — same
- `preToolUse` can allow, deny, or rewrite arguments via `modifiedArgs`. `permissionRequest` can allow or deny. — same
- `postToolUse` can replace the result via `modifiedResult` or add `additionalContext`. — same
- `sessionStart` can inject `additionalContext`. "Prompt hooks can auto-submit text, but only in new interactive sessions." — same
- `sessionEnd` produces no output. In interactive mode `/clear` ends the old session and fires it with `reason: "user_exit"`. — same
- `preCompact` is notification only. `userPromptSubmitted` modifies the prompt only in SDK programmatic hooks; command and HTTP hooks have that output dropped. — same
- VS Code agent hooks are Preview. Events: `sessionStart`, `userPromptSubmitted` (output ignored), `preToolUse` (`permissionDecision: deny`), `postToolUse` (`additionalContext`), `preCompact`, `subagentStart`/`subagentStop` (observe), `agentStop`, `sessionEnd`. The page says "Individual provider implementations can have a different lifecycle status". — code.visualstudio.com/docs/copilot/customization/hooks (WebFetch summary)
- Timers: none in either surface. `timeoutSec` is only the hook's own timeout. — both pages
- Token or context usage: no event field in either page; they do not mention it. — both pages
- Programmatic `/clear` or session restart from a hook: not documented. `sessionEnd` only observes `/clear`. — both pages
- Model call, fork or cache ping from a hook: not documented. — both pages
- Local build: the Copilot projection only maps 9 events (`Stop`, `SubagentStop`, `PreToolUse`, `PostToolUse`, `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `PreCompact`, `Notification`) and only `command` hooks. — `tools/build-copilot.mjs:59-63, :322`
- Mod API features auto-handoff depends on (`$.session.usage`, `/clear` via the mod engine, `$.prompt.submit`, panel UI) are all from the Claude mods API, with no Copilot equivalent. — mods/reference#mods-api-methods
- Prompt cache TTL pings are an Anthropic-API feature. Copilot hooks have no timer or model access. cache-keepalive's `$.clock.after`, `$.model.fork` and `$.session.usage` have no Copilot hook equivalent. — `plugins/claude-mods/cache-keepalive/hooks/register.ts:113, :56, :161`
- Whether a `sessionStart` prompt hook after a user-typed `/clear` could seed the new session, as a manual semi-equivalent to the seed step — Inconclusive. The docs say only that prompt hooks can auto-submit in new interactive sessions.
- Confidence note: the Copilot findings are WebFetch summaries, not verbatim page reads.

## AC-4 (c) agent-team teammates in `background_tasks` on `classic.Stop`
- The Stop input has `background_tasks` and `session_crons`. `type` is "a friendly task-type label such as `shell`, `subagent`, `monitor`, `workflow`, `teammate`, `cloud session`, or `MCP task`". The arrays are "present when the task registry is reachable and empty when nothing is in flight". — code.claude.com/docs/en/hooks (Stop input; WebFetch summary)
- `teammate` is a documented label, but the page "doesn't say which of these can appear in a given session". The agent-teams page has no mention of `background_tasks`, `Stop` or `TeammateIdle` data — code.claude.com/docs/en/agent-teams.
- Does a running in-process teammate show up in the lead's `background_tasks` at `classic.Stop` — Inconclusive. The `teammate` label exists, but no page ties it to agent teams.
- Teammate hooks documented: `TeammateIdle`, `TaskCreated`, `TaskCompleted`. — agent-teams#enforce-quality-gates-with-hooks
- Constraint: an in-process teammate's cache is a 5-minute bucket by default; `subagentPromptCacheTtl: 1h` raises it. The main conversation's cache is separate. — agent-teams#token-usage
- Agent teams are experimental and off by default (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`). Spawning teammates needs an interactive session. — agent-teams
- The mod's own tests use a hand-made `task` object, not a real teammate. — `cache-keepalive/hooks/register.test.ts:27,36,49`

## AC-5 absorbed-mod leakage into the Copilot build
- The build reads only `plugins/claude/<plugin>` (`SRC`). — `tools/build-copilot.mjs:38`
- It copies only these into the Copilot output: `agents/*.md` (`:146`), everything under `skills/` via `walk` (`:282-285`), `scripts/` (`:307-311`), and hooks from `hooks/hooks.json` (`:314-331`).
- `hooks/*.ts(x)`, `statusline/`, `server.ts`, `templates/` and `tests/` outside `skills/`, `agents/` or `scripts/` are never copied. A mod placed under `plugins/claude/ai-dlc/hooks/` would not reach the Copilot plugin by file copy. — `:282-331`
- `hooks/hooks.json` is read as `JSON.parse(...).hooks ?? {}`. A file containing only `{ "modules": [...] }` yields no hooks, so no Copilot `hooks.json` is emitted and `manifest.hooks` is deleted (`:315, :330-331`).
- Danger 1: if the module's `hooks.json` also carried a `hooks` object with events, those would be projected to Copilot as command hooks (`:317-329`). Keep mod hooks and settings hooks separate.
- Danger 2: anything placed under `skills/` is copied verbatim. A mod file or its tests under `skills/handoff/` would ship in the Copilot plugin, and `*.json` there goes through `readText`. `TEXT` regex (`:97`) lets `.json`, `.sh`, `.md` through as text; `.ts`/`.tsx` are copied as binary buffers. — `:97-99, :282-285`
- `--check` compares the generated file set against `OUT`; mod files in a leaked path would be flagged stale only if they differ. Mod files under `hooks/` or at the plugin root would not be checked or copied at all. — `:337-358`
- `claudeManifest.userConfig` is not in the projected manifest field list: only `name, description, version, author, homepage, repository, keywords` plus fixed `agents`, `skills`, `hooks`. So `userConfig` and `types` do not leak. — `:131-142`
- The handoff skill's manual session handoff is in `plugins/claude/ai-dlc/skills/handoff/SKILL.md:280-309` (per brief). Merging mod templates (`brief.md`, `instructions.md`) into `skills/handoff/` would copy them to Copilot, harmlessly but unused there.

## Go / no-go
- AC-1 (d): GO. One plugin can ship agents, skills, `hooks/hooks.json` with `modules`, and `userConfig`. The Copilot build ignores everything outside `skills/`, `agents/`, `scripts/` and `hooks/hooks.json`. Conditions:
  - keep the module and its tests outside `skills/`
  - keep `hooks.json` to `modules` only
  - add a `claude plugin test` CI step for ai-dlc
  - the old-CLI behavior (min 2.1.287) is Inconclusive, so the README requirement must stay
- AC-3 (b), auto-handoff on Copilot: NO-GO. No token or context usage in any hook payload, no timer, no programmatic `/clear` (only `sessionEnd` on a user `/clear`), and no model call from a hook. The manual `handoff` skill remains the Copilot path.
- AC-3 (b), cache-keepalive on Copilot: NO-GO. No timer or idle-with-delay event, no model fork or cache ping API, and the Anthropic prompt-cache TTL is not exposed through Copilot hooks.

## Open Questions
- Behavior of an old CLI (below 2.1.287) on a plugin with `modules` in `hooks.json`: undocumented. A real test on 2.1.286 or earlier would settle it.
- Whether a `teammate` entry appears in `background_tasks` for the lead's `Stop`: undocumented. Log the Stop payload with agent teams on.
- Standalone `auto-handoff` and ai-dlc's absorbed copy running together: undocumented. Handle in the upgrade notes (`claude plugin prune`, uninstall `auto-handoff`).
- The Copilot findings rest on WebFetch summaries. Re-read the GitHub CLI hooks page and the VS Code hooks page verbatim before any Copilot-port decision. No sonnet escalation is needed.

Sources: code.claude.com/docs/en/plugins, /plugins/mods/overview, /plugins/mods/reference, /plugins/mods/test, /plugins/mods/troubleshoot, /plugins/manifest-reference, /plugins/dependencies, /plugins/install, /hooks, /agent-teams; docs.github.com/en/copilot/reference/hooks-configuration; code.visualstudio.com/docs/copilot/customization/hooks; repo files `tools/build-copilot.mjs`, `plugins/claude-mods/auto-handoff/{.claude-plugin/plugin.json,hooks/hooks.json,hooks/register.tsx}`, `plugins/claude-mods/cache-keepalive/hooks/{register.ts,register.test.ts}`, `.github/workflows/validate.yml`.
