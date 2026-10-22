---
run: AAW-20261022-fold-cache-keepalive
work-item: none
lifecycle: AAW
step: 3
from: research-assistant
to: orchestrator
mode: subagent
loop: none
received: 2026-10-22 20:48
---

**Commands registered or referenced by the two modules**

Registered (the only ones that exist):
- `/keepalive`, args `[<n>m|<n>h|<n>d|clear] [--session|--machine]`. Registered at `plugins/claude-mods/cache-keepalive/hooks/register.ts:199-203` (`$.command.register`, inside `session.start`). Handler at `register.ts:245`. Argument parser at `hooks/duration.ts:34`.
- `/keepalive` with no args pings now (`register.ts:255-257`). It also prints usage (`register.ts:247`) and the keep-warm status (`register.ts:252`).

Auto-handoff: no command is registered. A grep for `command.register` in `plugins/claude/ai-dlc/hooks/auto-handoff/` finds none outside tests. It only calls built-ins:
- `$.command.run({command:'clear'})` at `plugins/claude/ai-dlc/hooks/auto-handoff/register.tsx:578`.
- `$.command.run({command:'rename', args})` at `register.tsx:464`.
- `$.command.list()` at `register.tsx:220` and `register.tsx:455`.

**Status, log and UI strings that name a command (auto-handoff)**
- `register.tsx:581`: failure toast `'/clear was rejected'`.
- `register.tsx:457`: log `rename unavailable: /rename is not in this Claude Code's commands`.
- `register.tsx:172`, `register.tsx:185`, `config.ts:149`, `config.ts:177`, `config.ts:208`, `config.ts:215`: `/config` (built-in panel, not ours).
- `register.tsx:1057`: seed prompt text. It names no slash command.

**Plugin skills that tell the user to type a command (ai-dlc)**
- `/ai-dlc:configure-auto-handoff`: skill at `plugins/claude/ai-dlc/skills/configure-auto-handoff/SKILL.md:2`. Args: none or `show`, `install`, `rename-check`, or a plain-words edit (`SKILL.md:37`). Also `SKILL.md:73`: "run `/ai-dlc:configure-auto-handoff rename-check`".
- `/ai-dlc:init`: `plugins/claude/ai-dlc/skills/init/SKILL.md:55-60`, `:112`, `:154-163`. Line 163 tells the user `/keepalive 2h` or `/keepalive 1d --machine`. The init skill does not name `/ai-dlc:configure-auto-handoff`.
- `README.md:82`: `/ai-dlc:init` asks for the auto-handoff percentage and for keep-warm, and points at `/config` rows.
- `plugins/claude/ai-dlc/skills/handoff/SKILL.md:299`: "runs `/clear`". `:338`: "a `/clear` typed in a teammate's view". Neither is an ai-dlc command.
- Comments only, not user-facing: `register.tsx:213-214`, `config.ts:11` (`/ai-dlc:init`, `/ai-dlc:configure-auto-handoff`).

**Docs and tests for `/keepalive`**
- `plugins/claude-mods/cache-keepalive/README.md:21`, `:36` ("The command is `/keepalive`, with no plugin prefix"), `:40-44` (usage table).
- `plugins/claude-mods/cache-keepalive/VENDORED.md:33-34` ("invoked as `/keepalive`, no plugin prefix"), `:37-40`, `:50`, `:61`, `:69-75`.
- `plugins/claude-mods/cache-keepalive/.claude-plugin/plugin.json:18`, `:24` (`/keepalive clear --machine`).
- Status-line origin labels: `register.ts:50`, `register.ts:52`, `register.ts:63`.
- Config-option text: `register.ts:194`.
- Tests: `plugins/claude-mods/cache-keepalive/hooks/register.test.ts:108`, `:115`, `:126-166`, `:205-228`, `:241`, `:249-250`, `:279-301`, `:315`, `:318`.
- `tests/build-copilot-hooks-module.test.mjs:168-174` checks manifest keys only, not the command name.
- Not referenced: no `/keepalive` in ai-dlc skills other than the init line above.

**Namespacing: bare or prefixed for hooks-module commands?**
- Commands registered through `$.command.register` appear bare. The mods API doc shows `$.command.register({ name: 'standup', ... })` and says "After the session starts, `/standup` appears" (https://code.claude.com/docs/en/plugins/mods/api, "Add a command"). The same page says "Pick a name that no built-in command uses" and that registering a taken name throws. Tools, by contrast, get `mcp__<plugin>__<name>` on the same page.
- Repo behaviour agrees: `cache-keepalive/README.md:36` and `VENDORED.md:33-34` say `/keepalive` has no plugin prefix.
- Manifest-declared commands and skills are prefixed. `commands` object-map keys become `/<plugin>:<name>` (https://code.claude.com/docs/en/plugins/manifest-reference, "`commands`"). Plugin components are namespaced under the plugin `name` (same page, "`name`"). Skills show as `/my-plugin:review` (https://code.claude.com/docs/en/plugins, overview diagram). This is why `/ai-dlc:init` and `/ai-dlc:configure-auto-handoff` are prefixed, but `/keepalive` is not.
- Confidence: Medium-High. The mods reference (https://code.claude.com/docs/en/plugins/mods/reference) does not state the rule for `$.command.register` in a sentence; the bare-name conclusion rests on the API example, the "built-in" collision rule, and the repo's own docs. The auto-handoff module registers nothing, so the question does not affect it.

**Open questions**
- Whether a hooks-module command can collide with another plugin's bare command name is not stated in the docs; only collision with built-ins is.
- `cache-keepalive` is vendored; its README says "no plugin prefix" but is upstream text kept with local additions, so the claim was checked against the current API doc, not a live Claude Code session.
- No memory was saved (no durable learnings beyond this one-off query).
