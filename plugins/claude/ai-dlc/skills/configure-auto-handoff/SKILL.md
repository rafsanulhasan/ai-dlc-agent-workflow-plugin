---
name: configure-auto-handoff
description: "Shows and changes the automatic session handoff's settings (Claude Code only) in the repository's .ai-dlc/auto-handoff.json, with the source of each value, and checks whether this Claude Code can rename sessions."
disable-model-invocation: true
---

# Configure the automatic session handoff

The ai-dlc plugin's hooks module hands the main session off to a fresh one when its context fills (the `handoff` skill, *The automatic path*). Its settings live in `.ai-dlc/auto-handoff.json`, committed with the repository, so the whole team shares them.

**Claude Code only.** On GitHub Copilot there is no automatic handoff: say that these settings do not apply there and stop.

`<skill dir>` below is this skill's folder: `${CLAUDE_SKILL_DIR}` when it runs as `/ai-dlc:configure-auto-handoff`, `${CLAUDE_SKILL_DIR}/../configure-auto-handoff` when `init` follows it. The CLI is `node <skill dir>/templates/auto-handoff.mjs` (Node 22 or later, the versions it is tested on; no dependencies); run it from the repository root.

| File | What it is |
|---|---|
| `.ai-dlc/auto-handoff.json` | The settings. Every key is present; `null` means "not set here", so the next source applies. `"$schema": "./auto-handoff.schema.json"` gives completion and hover docs |
| `.ai-dlc/auto-handoff.schema.json` | The schema, copied from [templates/auto-handoff.schema.json](templates/auto-handoff.schema.json): every key, its environment variable (`x-env`), its default and its meaning. Plugin-owned; `merge` replaces it |

## Where a value comes from

Each key is read from the first of these that sets it to a valid value:

1. `env` of `.claude/settings.local.json`: one developer's override, not committed;
2. `env` of `.claude/settings.json`: the team's override;
3. the process environment, for the sessions started from that shell;
4. `.ai-dlc/auto-handoff.json`;
5. the plugin's `/config` option, for the keys that have one (`thresholdPercent`, `maxConsecutiveHandoffs`, `briefTemplate`, `instructionsTemplate`, `ignoreFiles`, `viewer`);
6. the default.

Levels 1 to 3 use the `AI_DLC_AUTO_HANDOFF_*` variable of the key (its `x-env`). An invalid value, such as a `viewer` that is not blank or `host:port`, is logged and the next level applies; `set` and `validate` reject it. A `/config` value is lenient: a percentage outside 1 to 100 is clamped and a bad value is dropped for the default, each logged when that level is the one used. The module reloads the settings at each session start, so a chain of handoffs picks up an edit. Claude Code's own `DISABLE_AUTO_COMPACT` also turns handoffs off.

**Workspace trust.** `.ai-dlc/auto-handoff.json` is committed, so a cloned repository could set it. Three keys can do harm from there: `viewer` (a host such as `0.0.0.0` would serve your handoffs, which summarise your transcript, to the network), `briefTemplate` and `instructionsTemplate` (the module creates a missing template file at that path and reads it into the Haiku prompt). From the repository file these three apply only when Claude Code trusts the folder: `projects["<path>"].hasTrustDialogAccepted` is `true` in `~/.claude.json`, where `<path>` is the repository root (in a linked worktree, the main checkout's root; a nested repository has its own entry), or, outside a repository, the start folder or a folder above it. Paths are compared ignoring case, `\` against `/` and a trailing slash. Anything else counts as untrusted: no entry, a value other than `true`, a missing or unreadable file. In an untrusted folder the three keys are skipped and the module logs one line naming them; every other key of the file still applies, and levels 1 to 3 and `/config` are never gated. **show** prints the same warning. Claude Code in VS Code and through the SDK did not show the trust dialog in the versions tested, so a folder only ever opened there stays untrusted until trust is accepted in a terminal session. With `CLAUDE_CONFIG_DIR` set, the module and the CLI still read `~/.claude.json`; whether Claude Code keeps the file there in that case is not verified, and if it does not, the folder counts as untrusted.

## Modes

Parse the arguments: none or `show` → **show**; `install` → **install**; `rename-check` → **rename check**; anything else is a change in plain words → **edit**.

### show

1. Run `node <skill dir>/templates/auto-handoff.mjs show` and present its table: each key, its effective value and its source. A key whose source reads "default, unless set in /config" may hold a different value in this developer's `/config`.
2. Present every `warning:` line it prints with the fix it names.

Done when every key is listed with its source.

### edit

1. Map the change to keys and values with the schema's descriptions, for example "hand off at 70%" → `thresholdPercent=70`, "stop renaming sessions" → `renameSessions=false`, "back to the default threshold" → `thresholdPercent=null`. Ask one question when the change fits no key or several.
2. Ask where it belongs when the change is personal ("on my machine", "for me"): then it goes in `env` of `.claude/settings.local.json` as the key's `x-env` variable, edited in place (the file can hold comments), and steps 3–4 are skipped. When the change sets `viewer`, `briefTemplate` or `instructionsTemplate` and **show** warns that the folder is not trusted, say that the repository file would be ignored for that key here, and suggest `env` of `.claude/settings.local.json` (or the `/config` row) instead.
3. Run `node <skill dir>/templates/auto-handoff.mjs set <key>=<value>... --dry-run`, show the developer the lines it prints, and with consent run it again without `--dry-run`. `set` creates the file when it is missing and writes nothing when a value is invalid.
4. Run **show** and point out a key whose new value is still overridden by a higher level.

Done when `node <skill dir>/templates/auto-handoff.mjs validate` exits 0 and **show** lists the new values, or the developer declined. For a personal change (step 2), `validate` does not apply, since it checks only `.ai-dlc/auto-handoff.json`: done when **show** lists the key with the new value and the source `.claude/settings.local.json`, and prints no `warning:` line for that file. The module picks the value up at the next session start.

### install

Creates the file, or brings an existing one up to date with this plugin version: `init` runs it, and so can a developer after a plugin update.

1. Run `node <skill dir>/templates/auto-handoff.mjs merge --dry-run`. On a new file it says so; on an existing one, `+` lines are keys it adds (as `null`) and `-` lines keys this version no longer has, which it removes. Every value already set is kept. Show the lines and, with consent, run it again without `--dry-run`. It also writes `.ai-dlc/auto-handoff.schema.json`.
2. Apply the values the caller passed (for `init`, the handoff percentage when it differs from 80) with `set`, as in **edit** step 3.
3. Run **rename check**.

Done when `validate` exits 0.

### rename check

Sessions of a chain are named "… (Session 1)", "… (Session 2)" and so on in two ways. Each seeded session asks for its name as it starts, as the `sessionTitle` of the module's session-start answer; whether Claude Code honours a title from a hooks module is not yet confirmed on a live session, and nothing here can check it. And each session handed off is renamed with Claude Code's `/rename` command just before its `/clear`, which the module runs only when the running Claude Code lists it. A skill cannot ask Claude Code which commands it has, so at each session start the module records the answer in `~/.claude/state/auto-handoff/capabilities.json`. This check covers `/rename` only.

1. Run `node <skill dir>/templates/auto-handoff.mjs capabilities`.
2. Report its result:
   - **available**: every session is renamed as it is handed off, the first one included; the current session's name depends on `sessionTitle`;
   - **not available**: no session is renamed with `/rename`, so the first session keeps its own name and the others are named only if `sessionTitle` is honoured; the handoff itself is unaffected;
   - **not recorded**: the module has not run in a session yet (the plugin was installed after this session started, or the session is older than the plugin). Start a new session and run `/ai-dlc:configure-auto-handoff rename-check` there.

Done when one of the three is reported. It never fails the caller.
