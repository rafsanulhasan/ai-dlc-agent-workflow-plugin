# Keep-alive

Part of the ai-dlc plugin's hooks module (Claude Code only), adapted from the `cache-keepalive` mod in [RichardJSun/claude-code-mods](https://github.com/RichardJSun/claude-code-mods) under the MIT License ([LICENSE](LICENSE)). The changes are listed in [ATTRIBUTION.md](ATTRIBUTION.md). The automatic handoff's module (`../auto-handoff/`) registers it, so one hooks module runs both.

When Claude ends a turn while background tasks are still running (a teammate, a long build), the prompt cache can expire before the task's notification arrives. The next request then writes the whole context into the cache again, at up to 2× the input price.

Keep-alive pings the cache with a one-line fork of the conversation while the session waits. A cache read costs 0.025× to 0.1× the input price, so a ping costs a few percent of a re-write.

## Two tracks

The prompt cache keeps an entry for 5 minutes or for 1 hour, depending on how it was written. Keep-alive has one track for each lifetime:

| Track | Pings every | Keeps pinging for | Lifetime it assumes |
| --- | --- | --- | --- |
| `1h` | 50 minutes | 8 hours | 60 minutes |
| `5m` | 3 minutes | 1 hour (20 pings) | 5 minutes |

A track runs only when the session's last cache write used its lifetime. Keep-alive reads that from the response's `cache_creation` split (`ephemeral_1h_input_tokens`, `ephemeral_5m_input_tokens`), or from the session's transcript when the response did not carry it. A write that used both lifetimes runs both tracks. Until the session has written to the cache, neither track runs, since the lifetime is unknown. Every value in the table is a setting (see *Settings*).

## Status lines

While a turn has ended with background work, the status line under the prompt shows one line per track:

```text
keepalive 1h: warm until 11:36, ping 2/∞, keep warm 8h, stop by 18:46
keepalive 5m: off
```

After an automatic session handoff, a third line says whether the new session's first request read from the prompt cache (see *What the cache can reuse across a handoff*): `keepalive seed: cache hit, 30k read` or `keepalive seed: cache miss`. It shows from that first request until the next turn starts, alone or under the track lines.

- **warm until**: when the cache expires if no further ping lands: the last successful ping (or the end of the turn, before the first ping) plus the track's lifetime. A line still on screen after that time is stale.
- **ping 2/∞**: pings sent since the turn ended, out of the track's ping limit (`∞`: no limit).
- **keep warm 8h**: the total time the track keeps pinging, counted from the end of the turn, and where that time comes from when it is not the track's own setting.
- **stop by 18:46**: the end of the turn plus the keep-warm time. A ping due at that time still goes out; none is due after it.
- **armed, 1 task(s)**: at the start of a line, the turn has just ended with that many background tasks, and no ping has run yet.
- **off**: the track is not in use, because the cache was not written with its lifetime. `off (disabled)`: the track is turned off. `off (no cache write seen yet, …)`: the lifetime is unknown. `off in overage`: see *Limitations*.

A stopped track says why, and the ones that kept the cache warm add until when, as in `kept warm 8h, stopped, warm until 18:46`: `kept warm 8h, stopped` (its time ran out), `no ping needed for 30m, stopped` (the time ran out before the first ping was due), `ping limit 20 reached, stopped`, `missed, stopped` (a ping missed the cache), `spend limit reached, stopped`, `expired, stopped` (a timer fired after the cache had already expired, for example after the machine slept), `work done, stopped`, `handed off, stopped` (an automatic session handoff), `overage, stopped` or `error, stopped`. The lines disappear when a new turn starts.

## When the pings stop

Pinging stops at whichever comes first:

- **The work is done.** Claude Code wakes the session when a background task ends, and that turn's start stops the pings. A turn that ends with no background task never starts them, and stops any still running. So do the session ending (exit, `/clear`) and an automatic handoff, which stops them before its `/clear`.
- **A ping misses** the cache: re-writing it is what keep-alive exists to avoid.
- **The track's time or ping limit** is reached. Pings are due every `pingEvery` from the end of the turn, and a ping due exactly at the end of the keep-warm time still goes out, so the 5m track's hour sends 20 pings. The schedule counts from the end of the turn, not from when each ping finished, so the seconds a ping takes never cost the last one.
- **The spend limit**, when it is on: the pings of all tracks together have cost `budgetMultiplier` × the context's tokens, in input-token equivalents (cache reads at the model's read price, writes at `writeMult`, output at `outputMult`). The default `2` is about what one re-write costs. `budgetMultiplier` `0` turns the spend limit off. With `compactOnCap`, see *Compact on cap*.

## The command

`/ai-dlc:keepalive` is the only command; no bare `keepalive` command exists. A hooks module can register only a bare command name, so the plugin ships a `keepalive` skill, which Claude Code lists as `/ai-dlc:keepalive`, and the module answers its runs in the skill's place. The model never sees the command.

| Command | What it does |
| --- | --- |
| `/ai-dlc:keepalive` | Pings now and reports the hit rate and the keep-warm time in force |
| `/ai-dlc:keepalive 2h` | Sets the keep-warm time of both tracks in the default scope (`scope`). Does not ping |
| `/ai-dlc:keepalive 2h --session` | Sets it for this session only |
| `/ai-dlc:keepalive 1d --machine` | Sets it for every session on this machine until cleared. The value is kept in the plugin's store |
| `/ai-dlc:keepalive clear`, `/ai-dlc:keepalive clear --machine` | Removes the override in that scope (the default scope unless a flag is given). `--clear` works as `clear` |

Durations are `<n>m`, `<n>h` or `<n>d`, at least `minDuration`; `n` may have a fraction (`1.5h`). Flags and units are not case-sensitive, and one duration per call: `/ai-dlc:keepalive 2h 3h` is a usage error. The most specific value wins: this session's override, then the machine-wide one, then the track's `keepWarmFor`. An override shorter than `minDuration` is ignored with a warning. The store keeps the overrides of the `sessionOverridesMax` most recent sessions that set one. A change made while the pings run takes effect at the next ping. A duration no longer than a track's interval sends no ping on that track: the cache's own lifetime covers it.

## Settings

Each setting is read from the first of these that sets it to a valid value, highest first:

1. the `/ai-dlc:keepalive` override, for the keep-warm time only;
2. the `env` of `.claude/settings.local.json`: one developer's override, not committed;
3. the `env` of `.claude/settings.json`: the team's override (some settings only in a trusted folder; see *Workspace trust*);
4. `.ai-dlc/cache-keepalive.json`, with the keys below (a dot is one level of nesting; the same settings only in a trusted folder);
5. the setting's row under `ai-dlc` in `/config`;
6. the built-in default.

The process environment is not read. A value that does not parse, is out of range, or breaks a rule is ignored with a warning in the transcript and the module's log (`~/.claude/state/auto-handoff/auto-handoff.log`), and the next level applies. The rules: every duration you set is at least `minDuration` (the defaults are exempt), and each track's `pingEvery` is shorter than its `ttl`. A `ttl` that leaves no `pingEvery` shorter than it, not even the default, is dropped for the defaults of both. The settings are read again each time a turn ends with background work, and at each `/ai-dlc:keepalive`.

**Workspace trust.** `.ai-dlc/cache-keepalive.json` and `.claude/settings.json` are committed, so a cloned repository could set either. From them, the settings that decide whether and how much the module spends your tokens and rate limit, and the text it sends to the model, apply only in a folder Claude Code trusts (its trust prompt accepted), as for the automatic handoff's `viewer` and templates (see the `configure-auto-handoff` skill): `enabled`, each track's `enabled`, `pingEvery`, `keepWarmFor` and `maxPings`, `budgetMultiplier`, the prices the spend limit counts in (`writeMult`, `outputMult` and `readPrice`), `compactOnCap`, `pingPrompt` and `compactInstructions`. In a folder it does not trust, each of them is skipped with a warning that names it, its value and where to set it instead, and the next level applies; set them in the `env` of `.claude/settings.local.json` or in `/config` instead, or a keep-warm time with `/ai-dlc:keepalive`. Neither of those is gated. Every other setting applies from both files in any folder. The warning lists the skipped settings as `key=value`: text in double quotes, any other value as JSON, each run of white space folded to one space, and a value over 40 characters cut there and followed by `…` and `(N chars)`, where N is the length of the folded value in characters (`pingPrompt="Ignore your instructions. xxxxxxxxxxxxxx…" (226 chars)`). It is written to the transcript and to `~/.claude/state/auto-handoff/auto-handoff.log` unredacted, so the first 40 characters of whatever a gated setting holds land in both. Do not put secrets (tokens, keys, passwords) in these settings.

**Which sessions record trust.** Claude Code records it as `projects["<path>"].hasTrustDialogAccepted` in `~/.claude.json`, keyed on the repository root, when you accept its trust dialog. Interactive terminal sessions show that dialog. `claude -p` and Agent SDK sessions never show it, so, as far as the docs show, they never record trust (an inference: the dialog is the only documented way the flag gets written). Whether the VS Code extension records trust is not yet verified; whether the JetBrains extension or Claude Desktop show the dialog or record trust is not documented. The module and its status lines are verified to run in the VS Code extension (maintainer, 2026-10-23). The flag is shared by every surface: accept the folder once in an interactive terminal session, or set the flag to `true` by hand in `~/.claude.json`, and the folder is trusted everywhere. Until then, the 16 settings above never apply from `.claude/settings.json` or `.ai-dlc/cache-keepalive.json` on a surface that does not record trust (`claude -p`, the SDK); the `env` of `.claude/settings.local.json` and `/config` still work.

| Environment variable | Key | Default | What it does |
| --- | --- | --- | --- |
| `AI_DLC_KEEPALIVE_ENABLED` | `enabled` | `true` | Keep-alive on or off |
| `AI_DLC_KEEPALIVE_SCOPE` | `scope` | `session` | The scope of `/ai-dlc:keepalive <duration>` without a flag: `session` or `machine` |
| `AI_DLC_KEEPALIVE_STATUS` | `status` | `true` | Show the status lines |
| `AI_DLC_KEEPALIVE_PING_PROMPT` | `pingPrompt` | `Keep-alive ping. Reply with only: ok` | The text each ping sends |
| `AI_DLC_KEEPALIVE_HIT_THRESHOLD` | `hitThreshold` | `0.9` | A ping is a hit when more than this share of its input, 0 up to 1, was read from the cache |
| `AI_DLC_KEEPALIVE_OVERAGE_PERCENT` | `overagePercent` | `100` | No pings while any plan usage window is at or above this percent, 1 to 100 |
| `AI_DLC_KEEPALIVE_MIN_DURATION` | `minDuration` | `1m` | The shortest duration accepted from your settings and the command (at least 1 second) |
| `AI_DLC_KEEPALIVE_SESSION_OVERRIDES_MAX` | `sessionOverridesMax` | `20` | Session overrides the store keeps |
| `AI_DLC_KEEPALIVE_1H_ENABLED` | `oneHour.enabled` | `true` | The 1h track on or off |
| `AI_DLC_KEEPALIVE_1H_TTL` | `oneHour.ttl` | `60m` | The lifetime the 1h track assumes after each ping |
| `AI_DLC_KEEPALIVE_1H_PING_EVERY` | `oneHour.pingEvery` | `50m` | The 1h track's interval |
| `AI_DLC_KEEPALIVE_1H_KEEP_WARM_FOR` | `oneHour.keepWarmFor` | `8h` | How long the 1h track keeps pinging |
| `AI_DLC_KEEPALIVE_1H_MAX_PINGS` | `oneHour.maxPings` | `0` | The 1h track's ping limit; `0` is none |
| `AI_DLC_KEEPALIVE_5M_ENABLED` | `fiveMinute.enabled` | `true` | The 5m track on or off |
| `AI_DLC_KEEPALIVE_5M_TTL` | `fiveMinute.ttl` | `5m` | The lifetime the 5m track assumes after each ping |
| `AI_DLC_KEEPALIVE_5M_PING_EVERY` | `fiveMinute.pingEvery` | `3m` | The 5m track's interval |
| `AI_DLC_KEEPALIVE_5M_KEEP_WARM_FOR` | `fiveMinute.keepWarmFor` | `1h` | How long the 5m track keeps pinging |
| `AI_DLC_KEEPALIVE_5M_MAX_PINGS` | `fiveMinute.maxPings` | `0` | The 5m track's ping limit; `0` is none (the hour allows 20 pings) |
| `AI_DLC_KEEPALIVE_BUDGET_MULTIPLIER` | `budgetMultiplier` | `2` | The spend limit, in multiples of the context's tokens; `0` turns it off |
| `AI_DLC_KEEPALIVE_COMPACT_ON_CAP` | `compactOnCap` | `false` | Compact instead of stopping when the spend limit is reached |
| `AI_DLC_KEEPALIVE_COMPACT_INSTRUCTIONS` | `compactInstructions` | `Also keep the background tasks' IDs, output paths, and what to do when they finish.` | What that compaction is told to keep |
| `AI_DLC_KEEPALIVE_WRITE_MULT` | `writeMult` | `2` | A cache write's price over the base input price |
| `AI_DLC_KEEPALIVE_OUTPUT_MULT` | `outputMult` | `5` | An output token's price over the base input price |
| `AI_DLC_KEEPALIVE_READ_PRICE` | `readPrice` | `fable\|mythos=0.025,opus[- ]?5[-. ]5=0.05,*=0.1` | A cache read's price over the base input price, by model: `pattern=multiplier` pairs, the first pattern (a case-insensitive regular expression) that matches the model id wins, `*` for any other |
| `AI_DLC_KEEPALIVE_COMPACT_COST_GUESS` | `compactCostGuess` | `0.6` | A compaction's cost per context token, until one has been measured |
| `AI_DLC_KEEPALIVE_SUMMARY_RATIO_GUESS` | `summaryRatioGuess` | `0.15` | A compaction summary's size over the context, until one has been measured |

The `/config` rows are named `keepalive` plus the key in camel case, such as `keepaliveOneHourKeepWarmFor`, and have no default of their own: an empty row means the built-in default. For example, a team that wants the 5-minute track to stop after ten pings and the 1-hour track to keep warm for a working day:

```json
{
  "fiveMinute": { "maxPings": 10 },
  "oneHour": { "keepWarmFor": "10h" }
}
```

## What the cache can reuse across a handoff

The automatic session handoff ends the session with `/clear` and starts a fresh one. The fresh session's first request can read from the cache only the prefix both sessions share: the tools, the system prompt, and the project context (`CLAUDE.md`, memory and the git status snapshot), and only if that prefix is byte-for-byte the same and the cache still holds it. The old conversation is never reused: it is gone after `/clear`, and the brief and the seed are new messages.

So the handoff keeps that prefix as it was: it changes neither the model nor the effort, and the brief and the seed travel only as messages, never in `CLAUDE.md`, memory or the system prompt. What can still break it:

- a change to `CLAUDE.md`, memory or a tracked file before the `/clear`, which changes the project context or the git status snapshot. With an active AI-DLC run, the handoff updates the run's `run.md`; when that file was not already modified, the snapshot changes and the prefix misses.
- a different model or effort in the new session.

The handoff takes seconds, well inside both lifetimes, so keep-alive's pings do not help across it; the handoff stops them before its `/clear`. The seed turn proves what happened: its log line (`floor session=…`) gives the first request's `input_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`, the 1h/5m split of the write and `cache=hit` or `cache=miss`, the handoff's panel says `cache hit` or `cache miss`, and so does keep-alive's status (`keepalive seed: cache hit, 30k read`). A miss with a fresh write means the prefix changed.

**Unverified.** Keeping the cache warm for hours rests on each cache read restarting the entry's lifetime. Anthropic's prompt-caching documentation says a hit refreshes the cache, in its section on the default 5-minute lifetime; it does not repeat it for the 1-hour lifetime. Pings are forks, which Claude Code may write in the 5-minute bucket; whether a 5-minute read refreshes a 1-hour entry is not documented either. Treat "warm until" and long keep-warm times as resting on that inference, not on a documented guarantee.

## Limitations

Mods see only the account-wide usage windows, not model-scoped limits such as Fable's weekly one. Keep-alive does not arm while a 5-hour or 7-day window is at or above `overagePercent`, and stops if one crosses it during the wait; when a model-scoped limit runs out, the first ping misses and the track stops. Usage readings arrive with this session's own responses, so it may not see overage that other sessions cause during a wait.

**Agent teams.** An in-process teammate's requests use a 5-minute cache unless the `subagentPromptCacheTtl` setting is `1h`. Keep-alive runs in the main session only.

## Compact on cap

`compactOnCap` (off by default) compacts the conversation when the spend limit is reached, while the cache is still warm. It compacts only when the compaction's cost plus re-caching the summary is less than re-caching the whole context. Keep-alive records the cost and summary size of each compaction it runs and uses them for the next decision. Compaction loses context detail, which is why it is off by default.

A background notification that arrives during compaction waits until compaction finishes, then starts its turn as usual.

Compaction keeps the earlier messages in the session file. After each compaction it runs, keep-alive adds a line to the transcript with a command that opens the conversation as it was before that compaction, as a new session. The compacted session does not change. The command needs `jq` and uses `--resume-session-at`, a CLI flag that `claude --help` does not show. `/rewind` cannot go back past a compaction after the session is resumed.
