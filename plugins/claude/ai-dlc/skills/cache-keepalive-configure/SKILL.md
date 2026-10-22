---
name: cache-keepalive-configure
description: "Shows or changes keep-alive's settings in .ai-dlc/cache-keepalive.json (Claude Code only). With no arguments it lists each value, its source and any problem; with plain words it previews the change and writes it after you confirm."
argument-hint: "[<change in plain words>]"
disable-model-invocation: true
---

# Configure keep-alive

The ai-dlc plugin's hooks module keeps the prompt cache warm while background tasks run (keep-alive, `hooks/keepalive/README.md` in the plugin). Its settings for the whole team live in `.ai-dlc/cache-keepalive.json`, committed with the repository.

**Claude Code only.** On GitHub Copilot there is no keep-alive: say that these settings do not apply there and stop.

The keep-alive commands:

| Command | What it is for |
|---|---|
| `/ai-dlc:cache-keepalive-install` | First use: creates `.ai-dlc/cache-keepalive.json` with every default, and its schema. An existing file is left alone (use `-merge`). `/ai-dlc:init` runs it when there is no file |
| `/ai-dlc:cache-keepalive-merge` | An existing file, after a plugin upgrade or to repair it: adds new keys, rewrites `null` and legacy values to their defaults, removes retired keys, keeps every value set. `/ai-dlc:init` runs it on a re-run |
| `/ai-dlc:cache-keepalive-configure` | This skill: shows the settings, or changes them from plain words |
| `/ai-dlc:cache-keepalive` | Pings now, or sets a keep-warm time for this session or this machine, on one track or both |

The automatic handoff, the module's other part, has its own settings and skill, `/ai-dlc:configure-auto-handoff`. Keep-alive has no `/config` rows.

`<skill dir>` below is this skill's folder: `${CLAUDE_SKILL_DIR}` when it runs as `/ai-dlc:cache-keepalive-configure`, `${CLAUDE_SKILL_DIR}/../cache-keepalive-configure` when another skill follows it. The CLI is `node <skill dir>/templates/cache-keepalive.mjs` (Node 22 or later, the versions it is tested on; no dependencies); run it from the repository root. The install and merge skills run the same CLI.

| File | What it is |
|---|---|
| `.ai-dlc/cache-keepalive.json` | The settings. Every key is present and holds a value (the schema requires it; `null` is not allowed), written from this plugin version's defaults; a later change of a default in the plugin does not reach a key already written, since merge keeps every value set. Change a value with this skill. A dot in a key name below is one level of nesting (`oneHour.keepWarmFor` is `"oneHour": { "keepWarmFor": … }`). `"$schema": "./cache-keepalive.schema.json"` gives completion and hover docs |
| `.ai-dlc/cache-keepalive.schema.json` | The schema, copied from [templates/cache-keepalive.schema.json](templates/cache-keepalive.schema.json): every key, its environment variable (`x-env`), its default and its meaning. Plugin-owned; install and merge write it |

## Where a value comes from

Each key is read from the first of these that sets it to a valid value:

1. a `/ai-dlc:cache-keepalive` override, for the keep-warm times only, each track on its own: this session's, else this machine's;
2. `env` of `.claude/settings.local.json`: one developer's values, not committed;
3. `env` of `.claude/settings.json`: the team's override;
4. `.ai-dlc/cache-keepalive.json`;
5. the default.

Levels 2 and 3 use the key's `AI_DLC_KEEPALIVE_*` variable (its `x-env`). The process environment is not read. A value that does not parse, is out of range or breaks a rule (every duration you set is at least `minDuration`; each track's `pingEvery` is shorter than its `ttl`; each `maxPings` is 1 or more) is logged and the next level applies; it is never an error. A `null` in the file (left by an earlier plugin version or by hand), or a `maxPings` of `0`, is such a value: the module logs it and uses the next level, and `/ai-dlc:cache-keepalive-merge` rewrites it to its default. The module reads the settings again each time a turn ends with background work, and at each `/ai-dlc:cache-keepalive`.

**Ping limits.** A track's `maxPings` follows its keep-warm time: the pings `keepWarmFor` allows at the track's `pingEvery`, the ping that falls on the limit included (8h at 50m is 9, 1h at 3m is 20). A change of a track's `keepWarmFor` through this skill (or init) rewrites that track's `maxPings` the same way, unless the same change names `maxPings` too. A `/ai-dlc:cache-keepalive <duration>` override raises the limit to at least the pings its duration allows.

**Workspace trust.** `.ai-dlc/cache-keepalive.json` and `.claude/settings.json` are committed, so a cloned repository could set either. From them, the 16 keys the schema marks `x-trustGated` apply only in a folder Claude Code trusts: `enabled`, each track's `enabled`, `pingEvery`, `keepWarmFor` and `maxPings`, `budgetMultiplier`, `writeMult`, `outputMult`, `readPrice`, `compactOnCap`, `pingPrompt` and `compactInstructions`. In a folder it does not trust, the module skips each of them whose value differs from its default, with a warning naming its value, and the next level applies; one equal to its default changes nothing, so it applies quietly (the file holds every default, and they raise no warning). Levels 1 and 2 are never gated. Which sessions record trust, the warning's format and why no secret belongs in these settings: the keep-alive README, *Workspace trust*.

## Modes

No arguments → **show**. Anything else is a change in plain words → **change**.

### show

1. Run `node <skill dir>/templates/cache-keepalive.mjs show` and present its table: each key, its effective value and its source. A `/ai-dlc:cache-keepalive` override of a track outranks that track's `keepWarmFor` (the CLI cannot read it; `/ai-dlc:cache-keepalive` reports the keep-warm time in force on each track).
2. Run `node <skill dir>/templates/cache-keepalive.mjs validate` and present each `warning:` line with the value in force it names. It checks both sources: the file (every key present, no `null`, each value of its kind and within its limits, the rules above; a file that does not parse) and every `AI_DLC_KEEPALIVE_*` variable in the `env` of `.claude/settings.local.json` and `.claude/settings.json` (an unknown name, a value that fails its kind, its limits or a rule; a settings file that does not parse; in a folder Claude Code does not trust, a gated variable in `.claude/settings.json` that differs from its default). It also warns when a track's `maxPings` is below the pings its keep-warm time allows. Every finding is a warning, never an error, and it always exits 0. The values are read with the same check as the module's (`checkValue`, which the plugin's tests hold to `hooks/keepalive/settings.ts`).
3. When the file is missing, offer `/ai-dlc:cache-keepalive-install`; when a warning names a `null`, missing or legacy value in the file, offer `/ai-dlc:cache-keepalive-merge`, which rewrites each to its default and lists it.

Done when every key is listed with its source and every warning is presented.

### change

1. When `.ai-dlc/cache-keepalive.json` does not exist, say so and offer `/ai-dlc:cache-keepalive-install` first; stop until it is there.
2. Map the change to keys and values with the schema's descriptions, for example "keep warm for a working day" → `oneHour.keepWarmFor=10h` (its `maxPings` follows: 12), "5m track off" → `fiveMinute.enabled=false`, "stop the 5-minute track after ten pings" → `fiveMinute.maxPings=10`, "turn the spend limit off" → `budgetMultiplier=0`, "back to the default" → `<key>=<its default>`, from the schema. "Keep-warm time" alone means `oneHour.keepWarmFor`; say that the 5-minute track has its own, `fiveMinute.keepWarmFor`. Ask one question when the change fits no key or several.
3. Ask where it belongs when the change is personal ("on my machine", "for me", "just me"): then, with consent, write it in `env` of `.claude/settings.local.json` as the key's `x-env` variable, its value always a JSON string (`"AI_DLC_KEEPALIVE_5M_ENABLED": "false"`, `"AI_DLC_KEEPALIVE_5M_MAX_PINGS": "10"`, `"AI_DLC_KEEPALIVE_1H_KEEP_WARM_FOR": "10h"`), editing the file in place (it can hold comments; create it with `{ "env": { … } }` when it is missing), and go to step 6. When it writes `AI_DLC_KEEPALIVE_1H_KEEP_WARM_FOR` (or `…_5M_KEEP_WARM_FOR`), also write `AI_DLC_KEEPALIVE_1H_MAX_PINGS` (or `…_5M_MAX_PINGS`) = the keep-warm time ÷ that track's `pingEvery` in force (the value **show** lists), rounded down, at least 1 (`10h` at `50m` is `"12"`), unless the change names `maxPings`: without it the track would still stop at its old limit. A keep-warm time for this session or this machine only is `/ai-dlc:cache-keepalive <duration> --session` or `--machine` instead, with `--track 1h` or `--track 5m` for one track: point the developer to it. When the change sets a key marked `x-trustGated` and **show** warns that the folder is not trusted, say that the repository file would be ignored for that key here, and suggest `env` of `.claude/settings.local.json` instead.
4. **Preview.** Run the CLI's internal write with `--dry-run`: `node <skill dir>/templates/cache-keepalive.mjs set <key>=<value>... --dry-run`. Show the developer every line it prints: each change (`key: old -> new`), a `maxPings` that follows a keep-warm time, any key it rewrites to its default, and each `warning:` for a pair it would skip (an invalid value, a broken rule) with the value that stays. Durations are written `<n>m`, `<n>h` or `<n>d`; a text setting (`pingPrompt`, `compactInstructions`, `readPrice`, a duration) takes the value as typed.
5. **Confirm, then write.** Only after the developer confirms the preview, run the same command without `--dry-run`. It writes the valid pairs and skips the rest with a warning, and exits 0. It stops with exit 1, writing nothing, when the file itself is not valid JSON or a track (`oneHour`, `fiveMinute`) is not an object: say that it must be fixed by hand first.
6. Run **show** and point out a key whose new value is still overridden by a higher level.

Done when **show** lists the new values and `validate` prints no warning for the keys changed (for a personal change, for those variables), and no `… maxPings is …, but … keepWarmFor … allows … pings` warning for a track whose keep-warm time changed, or the developer declined.
