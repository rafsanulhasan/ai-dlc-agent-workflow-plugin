---
name: cache-keepalive-config
description: "Shows and changes keep-alive's settings (Claude Code only) in the repository's .ai-dlc/cache-keepalive.json, with the source of each value: the keep-warm times, the two tracks, the ping limits, the spend limit and the rest. /ai-dlc:cache-keepalive-config [show | install | <change in plain words>]."
argument-hint: "[show | install | <change in plain words>]"
disable-model-invocation: true
---

# Configure keep-alive

The ai-dlc plugin's hooks module keeps the prompt cache warm while background tasks run (keep-alive, `hooks/keepalive/README.md` in the plugin). Its settings for the whole team live in `.ai-dlc/cache-keepalive.json`, committed with the repository.

**Claude Code only.** On GitHub Copilot there is no keep-alive: say that these settings do not apply there and stop.

`/ai-dlc:cache-keepalive` (the `cache-keepalive` skill) pings now and sets a keep-warm time for this session or this machine, on one track or both; this skill changes the settings, for the team in `.ai-dlc/cache-keepalive.json` or for one developer in `env` of `.claude/settings.local.json`. Keep-alive has no `/config` rows. The automatic handoff, the module's other part, has its own settings and skill, `/ai-dlc:configure-auto-handoff`.

`<skill dir>` below is this skill's folder: `${CLAUDE_SKILL_DIR}` when it runs as `/ai-dlc:cache-keepalive-config`, `${CLAUDE_SKILL_DIR}/../cache-keepalive-config` when `init` follows it. The CLI is `node <skill dir>/templates/cache-keepalive.mjs` (Node 22 or later, the versions it is tested on; no dependencies); run it from the repository root.

| File | What it is |
|---|---|
| `.ai-dlc/cache-keepalive.json` | The settings. Every key is present; `null` means "not set here", so the next source applies. A dot in a key name below is one level of nesting (`oneHour.keepWarmFor` is `"oneHour": { "keepWarmFor": … }`). `"$schema": "./cache-keepalive.schema.json"` gives completion and hover docs |
| `.ai-dlc/cache-keepalive.schema.json` | The schema, copied from [templates/cache-keepalive.schema.json](templates/cache-keepalive.schema.json): every key, its environment variable (`x-env`), its default and its meaning. Plugin-owned; `merge` replaces it |

## Where a value comes from

Each key is read from the first of these that sets it to a valid value:

1. a `/ai-dlc:cache-keepalive` override, for the keep-warm times only, each track on its own: this session's, else this machine's;
2. `env` of `.claude/settings.local.json`: one developer's values, not committed;
3. `env` of `.claude/settings.json`: the team's override;
4. `.ai-dlc/cache-keepalive.json`;
5. the default.

Levels 2 and 3 use the key's `AI_DLC_KEEPALIVE_*` variable (its `x-env`). The process environment is not read. A value that does not parse, is out of range or breaks a rule (every duration you set is at least `minDuration`; each track's `pingEvery` is shorter than its `ttl`) is logged and the next level applies; `set` and `validate` reject it. The module reads the settings again each time a turn ends with background work, and at each `/ai-dlc:cache-keepalive`.

**Workspace trust.** `.ai-dlc/cache-keepalive.json` and `.claude/settings.json` are committed, so a cloned repository could set either. From them, the 16 keys the schema marks `x-trustGated` apply only in a folder Claude Code trusts: `enabled`, each track's `enabled`, `pingEvery`, `keepWarmFor` and `maxPings`, `budgetMultiplier`, `writeMult`, `outputMult`, `readPrice`, `compactOnCap`, `pingPrompt` and `compactInstructions`. In a folder it does not trust, the module skips each of them with a warning naming its value, and the next level applies. Levels 1 and 2 are never gated. Which sessions record trust, the warning's format and why no secret belongs in these settings: the keep-alive README, *Workspace trust*. **show** prints a warning naming the skipped keys, without their values.

## Modes

Parse the arguments: none or `show` → **show**; `install` → **install**; anything else is a change in plain words → **edit**.

### show

1. Run `node <skill dir>/templates/cache-keepalive.mjs show` and present its table: each key, its effective value and its source. A `/ai-dlc:cache-keepalive` override of a track outranks that track's `keepWarmFor` (the CLI cannot read it; `/ai-dlc:cache-keepalive` reports the keep-warm time in force on each track).
2. Present every `warning:` line it prints with the fix it names.

Done when every key is listed with its source.

### edit

1. Map the change to keys and values with the schema's descriptions, for example "keep warm for a working day" → `oneHour.keepWarmFor=10h`, "stop the 5-minute track after ten pings" → `fiveMinute.maxPings=10`, "turn the spend limit off" → `budgetMultiplier=0`, "back to the default" → `<key>=null`. "Keep-warm time" alone means `oneHour.keepWarmFor`; say that the 5-minute track has its own, `fiveMinute.keepWarmFor`. Ask one question when the change fits no key or several.
2. Ask where it belongs when the change is personal ("on my machine", "for me", "just me"): then write it in `env` of `.claude/settings.local.json` as the key's `x-env` variable, its value always a JSON string (`"AI_DLC_KEEPALIVE_5M_ENABLED": "false"`, `"AI_DLC_KEEPALIVE_5M_MAX_PINGS": "10"`, `"AI_DLC_KEEPALIVE_1H_KEEP_WARM_FOR": "10h"`), with consent, editing the file in place (it can hold comments; create it with `{ "env": { … } }` when it is missing), and skip steps 3–4. A keep-warm time for this session or this machine only is `/ai-dlc:cache-keepalive <duration> --session` or `--machine` instead, with `--track 1h` or `--track 5m` for one track: point the developer to it. When the change sets a key marked `x-trustGated` and **show** warns that the folder is not trusted, say that the repository file would be ignored for that key here, and suggest `env` of `.claude/settings.local.json` instead.
3. Run `node <skill dir>/templates/cache-keepalive.mjs set <key>=<value>... --dry-run`, show the developer the lines it prints, and with consent run it again without `--dry-run`. Durations are written `<n>m`, `<n>h` or `<n>d`. A text setting (`pingPrompt`, `compactInstructions`, `readPrice`, a duration) takes the value as typed, so `pingPrompt=123` is the text `123`; `null` unsets it. `set` creates the file when it is missing and writes nothing when a value is invalid or breaks a rule. It does not write the schema: when `.ai-dlc/cache-keepalive.schema.json` is missing or the file is new, run **install** first, which writes both.
4. Run **show** and point out a key whose new value is still overridden by a higher level.

Done when `node <skill dir>/templates/cache-keepalive.mjs validate` exits 0 and **show** lists the new values, or the developer declined. For a personal change (step 2), `validate` does not apply, since it checks only `.ai-dlc/cache-keepalive.json`: done when **show** lists the key with the new value and the source `.claude/settings.local.json`, and prints no `warning:` line for that file.

### install

Creates the file, or brings an existing one up to date with this plugin version: `init` runs it, and so can a developer after a plugin update.

1. Run `node <skill dir>/templates/cache-keepalive.mjs merge --dry-run`. On a new file it says so; on an existing one, `+` lines are keys it adds (as `null`) and `-` lines keys this version no longer has, which it removes. Every value already set is kept. Show the lines and, with consent, run it again without `--dry-run`. It also writes `.ai-dlc/cache-keepalive.schema.json`.
2. Apply the values the caller passed (for `init`, `oneHour.keepWarmFor` and `scope`) with `set`, as in **edit** step 3.

Done when `validate` exits 0.
