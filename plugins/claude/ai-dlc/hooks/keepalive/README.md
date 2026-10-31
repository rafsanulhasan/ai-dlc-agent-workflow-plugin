# Keep-alive

Part of the ai-dlc plugin's hooks module (Claude Code only), adapted from the `cache-keepalive` mod in [RichardJSun/claude-code-mods](https://github.com/RichardJSun/claude-code-mods) under the MIT License ([LICENSE](LICENSE)). The changes are listed in [ATTRIBUTION.md](ATTRIBUTION.md). The automatic handoff's module (`../auto-handoff/`) registers it, so one hooks module runs both.

When Claude ends a turn while background tasks are still running (a teammate, a long build), the prompt cache can expire before the task's notification arrives. The next request then writes the whole context into the cache again, at up to 2× the input price.

Keep-alive pings the cache with a one-line fork of the conversation while the session waits. A cache read costs 0.025× to 0.1× the input price, so a ping costs a few percent of a re-write.

## How the prompt cache works

Read from Anthropic's [prompt-caching documentation](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) and [pricing page](https://platform.claude.com/docs/en/about-claude/pricing) on 2026-10-24 and spot-checked by the project's research assistant that day. Prices change, so check the pages.

- **Prices, as multiples of the base input price.** A cache read costs 0.1x; for Opus 5.5 and Sonnet 5.5 it costs 0.05x, and for Fable 5.1 and Mythos 5.1 0.025x. A write with the 5-minute lifetime costs 1.25x and one with the 1-hour lifetime 2x. The `readPrice` setting holds the read multiples.
- **A hit refreshes the 5-minute lifetime** at no extra cost: each time the cached content is used, its 5 minutes start again.
- **The documentation states no refresh rule for the 1-hour lifetime.** It lists 1 hour as an extended lifetime and says nothing about a hit restarting it. Keep-alive's long keep-warm times rest on that being so (see *Unverified* below).
- **What resets the cache.** The prefix is tools, then system, then messages. The page states that a change to the tools invalidates everything, a change to the system prompt invalidates the system and messages, a change to the messages invalidates the messages, and that the cache expires when its lifetime runs out. These are Claude Code behaviour, not rules the page states: `/clear` and compaction (each starts a new prefix, so a new write) and a change of model.

How to read a line: `main` is the main session's cache and `subagents` the latest of the subagents' caches; `warm until` is when that cache expires if no further hit lands, `expired` that it has. A ping counts only when it landed (`ping 1/9`), and the first one is due one interval after the turn ends (50 minutes on the 1h track, 3 minutes on the 5m track). The states of a line are listed under *Track rows*.

## Two tracks

The prompt cache keeps an entry for 5 minutes or for 1 hour, depending on how it was written. Keep-alive has one track for each lifetime:

| Track | Pings every | Keeps pinging for | Lifetime it assumes |
| --- | --- | --- | --- |
| `1h` | 50 minutes | 8 hours | 60 minutes |
| `5m` | 3 minutes | 1 hour (20 pings) | 5 minutes |

A track runs only when the session's last cache write used its lifetime. Keep-alive reads that from the response's `cache_creation` split (`ephemeral_1h_input_tokens`, `ephemeral_5m_input_tokens`), or from the session's transcript when the response did not carry it. A write that used both lifetimes runs both tracks. Until the session has written to the cache, neither track runs, since the lifetime is unknown. Every value in the table is a setting (see *Settings*).

## Track rows

Subagent caches are observed, never pinged: a hook has no call that replays a subagent's prefix.

**In progress:** keep-alive writes no status line (see *No status line* below). Its state shows in the band, one row per track, drawn from the first turn on whether or not background tasks are running. Each row is `keepalive <track>: <status>, <keep-alive part>; <cache part>`, its status the track's switch in force (the session's switch, else the settings):

```text
keepalive 1h: on, warm until 12:36, ping 1/9, keep warm 8h, stop by 18:46; main warm until 11:46
keepalive 5m: on, idle (cache expired), ping 0/20, keep warm 1h (settings); main expired 10:05
keepalive 1h: off (disabled), ping 0/9, keep warm 8h (settings)
```

- **The cache part** says what keep-alive has seen of the session's cache for the track's lifetime, per source: `main warm until 10:05`, or `main expired 10:05` once that time has passed, then `subagents warm until 10:07` (the latest of the subagents' caches of that lifetime; `subagents expired 10:07` once passed), or `subagents: split unknown` when a subagent's cache write is not yet known to be 5m or 1h. It comes from the cache writes keep-alive has seen this session, so it shows even when no ping is armed. It is left out when no cache of that lifetime has been seen, and the row has none. A new turn keeps it.
- **The keep-alive part** says whether the track is pinging (the text described below) or, when it is not, why.

**In progress:** After an automatic session handoff, a seed row after the track rows says whether the new session's first request read from the prompt cache (see *What the cache can reuse across a handoff*): `keepalive seed: cache hit, 30k read` or `keepalive seed: cache miss`. It shows from that first request until the next turn starts, and only while a track is on: with both tracks off, the band shows no seed row, and it shows again once a track is turned on.

- **warm until**: in the keep-alive part, when the cache expires if no further ping lands: the last successful ping (or the cache's own time, before the first ping) plus the track's lifetime. A landed 5m ping moves the cache part's time too, to the ping time plus 5 minutes (a 5m hit refreshes the cache's lifetime, even when the ping only read). A landed 1h ping moves the cache part's time only when its response carries a 1h cache write; a 1h ping that only read from the cache moves this time alone, so the two times can differ, as in the example above. A row still on screen after that time is stale.
- **ping 2/9**: pings that landed (cache hits, not pings sent) since the turn ended, out of the track's ping limit (`maxPings`, or more after `/ai-dlc:cache-keepalive-configure <duration>`; see *When the pings stop*).
- **ping 0/9, first ping at 10:50**: before the first ping lands, the counter says when that ping is due, so `ping 0/9` reads as "not yet". The time is the first tick, one interval after the turn ends: 50 minutes later on the 1h track, 3 minutes later on the 5m track (`ping 0/20, first ping at 10:03`). A Stop that re-arms the track moves it, since it counts from that Stop. The clause goes once a ping lands (`ping 1/9`), and a track that is not running shows none.
- **keep warm 8h**: the total time the track keeps pinging, counted from the end of the turn, and where that time comes from when it is not the track's own setting.
- **stop by 18:46**: the end of the turn plus the keep-warm time. A ping due at that time still goes out; none is due after it.
- **armed, 1 task(s)**: at the start of a line, the turn has just ended with that many background tasks, and no ping has run yet.
- **In progress:** **on** and **off**: the row's status is the track's switch in force, never a guess from its state, and its button offers the opposite: a row that reads `off` has an `on` button, which turns that track on; a row that reads `on` has an `off` button, which turns it off. A track switched on that is not pinging reads `on, idle (<why>)`, the reasons below; a track switched off reads `off (disabled)`:
  - `idle (no background tasks)`: the turn ended with no background task, so nothing will wake the session.
  - `idle (no 5m cache write seen)` (or `1h`): the session has not written to the cache with this track's lifetime.
  - `idle (no cache write seen yet, so the cache lifetime is unknown)`: the session has not written to the cache at all.
  - `idle (only subagent caches; subagent pings off)`: only a subagent holds a warm cache and keep-alive does not ping subagents, so nothing is armed.
  - `idle (cache expired)`: the turn ended with background tasks, but every cache of this lifetime has expired.
  - `idle (turn running)`: a new turn started. This shows in the published state and in the band during the turn.
  - `idle (session ended)`: the session ended (published only).
  - `off (disabled)`: the track, or keep-alive, is switched off, so the row reads `off`. A bare `off` part of a track that is switched on reads `on, idle`, with no reason in brackets; a track that is switched off and stopped reads `off, work done, stopped` (the stop text follows the status).
  - `idle in overage`: see *Limitations*.

Both track rows are always shown, the 5m row then the 1h row. A row that is not pinging ends with the figures the track would use, `, ping 0/<cap>, keep warm <d> (<source>)`, and every keep-warm clause names where its value comes from (`session`, `machine`, `settings` or `default`) unless `sourceNote` is off. **In progress:** The band shows whenever `status` is on, also when the master or every track is off, so keep-alive can be turned back on there; with `status` off it is gone.

A stopped track says why, and the ones that kept the cache warm add until when, as in `kept warm 8h, stopped, warm until 18:46`: `kept warm 8h, stopped` (its time ran out), `no ping needed for 30m, stopped` (the time ran out before the first ping was due), `ping limit 20 reached, stopped`, `missed, stopped` (a ping missed the cache), `spend limit reached, stopped`, `expired, stopped` (a timer fired after the cache had already expired, for example after the machine slept), `work done, stopped`, `handed off, stopped` (an automatic session handoff), `overage, stopped` or `error, stopped`. They follow the status, as in `keepalive 1h: on, work done, stopped; main warm until 11:00`. A Stop with no background tasks stops any running track this way (`work done, stopped`).

### No status line

**In progress:** Keep-alive writes nothing under the prompt: its state is in the band only. **In progress:** A status line left by a module from before is cleared once, at the first draw after a load. **In progress:** `AI_DLC_KEEPALIVE_STATUS` shows or hides the band. **In progress:** `AI_DLC_KEEPALIVE_STATUS_TEXT` (`statusText`) is retired (R44.11): a settings file or an `env` value that still sets it is reported as no longer used, does not fail validation and is not read, and `/ai-dlc:cache-keepalive-configure merge` drops it from the file.

## The band and the buttons

**In progress:** the band is drawn on every surface, VS Code included, and at every panel width: it is keep-alive's own band above the prompt, outside the pane region, so a resize does not move it (R44.7). Keep-alive opens no Pane on any surface. Where the band is drawn, it is a band of its own, drawn after the lens band above the prompt when the lens draws one (the AI-DLC Lens band first, then this one; never combined into one block), and it minimises the same way the lens band does: `–` minimises it and `□` restores it. It starts minimised each time the module loads. The buttons of a minimised band are glyphs (`⏻` master, `⟳` ping, `□` restore, `×` close); a full band uses words (off/on, Ping now, Minimise, Close). Minimised, it is one row: the head row's status, `on` or `off` (see *The head row* below), one button for it, then `⟳`, `□` and `×`; the track rows and their buttons are hidden. Restored, the band is as described next.

**In progress:** The module registers keep-alive with auto-handoff, and the same hook draws the keep-alive band above the prompt as a block of its own, after the lens band: a head row `⚠ ai-dlc cache-keepalive: on` (or `off`) with its button, the 5m and 1h rows each with an `[on]` / `[off]` button (see *Track rows*), and the seed row after a handoff. `/ai-dlc:cache-keepalive` shows the band, minimised, and opens no Pane. The buttons act on this session only and are kept in the plugin's store (to switch keep-alive for good, use `/ai-dlc:cache-keepalive-configure on|off`, see *The command*); a track arms only while its switch is on. `/ai-dlc:cache-keepalive` takes no arguments: it pings now and shows the band. The lens's Cache Lab, in the agent panel, has Master, 1h and 5m on/off buttons with the same effect (this session only, through `/ai-dlc:cache-keepalive-configure <on|off> [--track 1h|5m] --session`).

### The head row

**In progress:** the head row reads `ai-dlc cache-keepalive: on` while the 1h track or the 5m track is on in force, and `ai-dlc cache-keepalive: off` while both are off; the tracks decide it, not the master switch alone. Its button offers the opposite and acts on this session only: while it reads `on`, the `off` button turns the master and both tracks off; while it reads `off`, the `on` button turns the master and both tracks on, with no ping. The same rule holds in the full band and the minimised band.

### An automatic handoff is one session

The switches and the `--session` keep-warm overrides belong to the automatic handoff chain (the first session and every session it handed off to), so they carry over a handoff; `handoff.carryOver` off keys them by session id again. **In progress:** With `handoff.onWhenOff` on, a chain in which neither track is on in force at the handoff (the head row's rule, R44.13) is turned on in the seeded session (it can spend tokens, so the setting is trust-gated). The chain is published as `chain` in the state below, for the lens's Cache Lab.

## State for other plugins

Keep-alive publishes what its track lines say as the `$.state` value `{ plugin: 'ai-dlc', key: 'keepalive' }`, declared in the plugin's `types/index.d.ts` (`plugin.json` `types`). It writes the value each time the lines change (a track armed, a ping, a track stopped, a new turn, the session ending), even when the band is off (`status`). Only ai-dlc writes it; another plugin, such as `ai-dlc-lens`, reads it with `$.state.get` and needs no `dependencies` entry: without ai-dlc the read gives no value.

The value is `{ enabled, updatedAt, sessionId, tracks }`. Each entry of `tracks` (`1h`, then `5m`) holds `name`, `enabled` (the track's switch in force, which the lens's Master, 1h and 5m buttons in the agent panel's Cache Lab read and set), `running` (a ping is scheduled), `armedAt`, `warmUntil`, `nextPingAt` (null when not running), `pingEvery`, `keepWarmMs` (the keep-warm time in force), `pings` (pings that landed, that is, cache hits, since the track was armed), `cap` (the ping limit), `line` (the track's line, cache part first; the rows of the band use another order, see *Track rows*) and, when keep-alive has seen any cache of the track's lifetime, `caches`. Times are epoch milliseconds.

`caches` is a list with one entry per source, `{ source, warmUntil, expired }`: `source` is `main` (or `subagents`, the latest of the subagents' caches), `warmUntil` is when that cache expires, and `expired` says whether it had by `updatedAt`. The key is omitted when there is no entry. The state also carries `sessionMaster`, `sessionSwitch` and `keepWarmFrom` (the session switches, and where the keep-warm time comes from), `enabled` is the master switch in force, and `chain` is `{ id, sessions }` (the handoff chain, sessions newest first).

**What a track publishes before it runs.** `keepWarmMs` (and `cap`) is the keep-warm time in force; for a track that is not running, that is the time its next arming would take. It is read again at every new turn, when the session ends (this session's override no longer counts), after `/ai-dlc:cache-keepalive-configure` sets or clears an override, whenever a track stops (expired, kept warm, missed, ping limit, spend limit, work done, overage, error) and after every full read (a Stop with background work, the command). A running track publishes the `pingEvery` and limit its timer took when it armed, and a new override at its next ping; the command's reply says so (`; the running 1h track takes it at its next ping`, or `the running tracks take it at their next ping` when both run). The published `enabled`, `pingEvery` and keep-warm times follow the settings files from a session's first turn. A machine override set in another session shows at this session's next turn; the machine override is read from the store at every turn, without the turn cache.

## When the pings stop

Pinging stops at whichever comes first:

- **The work is done.** Claude Code wakes the session when a background task ends, and that turn's start stops the pings. A turn that ends with no background task never starts them, and stops any still running. So do the session ending (exit, `/clear`) and an automatic handoff, which stops them before its `/clear`.
- **A ping misses** the cache: re-writing it is what keep-alive exists to avoid.
- **The track's time or ping limit** is reached. Pings are due every `pingEvery` from the end of the turn, and a ping due exactly at the end of the keep-warm time still goes out, so the 5m track's hour sends 20 pings. Each track's ping limit, `maxPings`, is a whole number of 1 or more; its defaults, 9 on the 1h track and 20 on the 5m track, are the pings the default keep-warm times allow (8h at 50m, 1h at 3m), so with the defaults the time and the limit end together. `/ai-dlc:cache-keepalive-configure` (and `/ai-dlc:init`) rewrites a track's `maxPings` to follow a `keepWarmFor` it writes, unless the same change names `maxPings`, even when the keep-warm time is the one already in the file, so a lower `maxPings` set by hand is overwritten (the output says so; name `maxPings` in the same change to keep it); a `keepWarmFor` edited by hand or set in an `env` keeps its limit, and `/ai-dlc:cache-keepalive-configure` warns when a keep-warm time allows more pings than the limit. A `--session` or `--machine` keep-warm time (see *The command*) writes no file: it raises that track's limit in force to at least the pings the duration allows, so the override always keeps warm for the time it says. A keep-warm time written with `--for` follows the `…_MAX_PINGS` rules under *The command*, not the rewrite described above, which is the configure skill's, for a change in plain words. The schedule counts from the end of the turn, not from when each ping finished, so the seconds a ping takes never cost the last one.
- **The spend limit**, when it is on: the pings of all tracks together have cost `budgetMultiplier` × the context's tokens, in input-token equivalents (cache reads at the model's read price, writes at `writeMult`, output at `outputMult`). The default `2` is about what one re-write costs. `budgetMultiplier` `0` turns the spend limit off. With `compactOnCap`, see *Compact on cap*.

## The command

`/ai-dlc:cache-keepalive` and `/ai-dlc:cache-keepalive-configure` are the commands; no bare `keepalive` command exists. A hooks module can register only a bare command name, so the plugin ships a skill for each, which Claude Code lists under `/ai-dlc:`, and the module answers their runs in the skills' place. The model never sees `/ai-dlc:cache-keepalive`.

**In progress:** `/ai-dlc:cache-keepalive` takes no arguments. It pings now, using the settings in force (the ones `/ai-dlc:cache-keepalive-configure` set), and shows the band, minimised; it opens no Pane. While keep-alive is off it pings nothing and says why. It changes no setting. The band has a **Ping now** button too. Every argument it used to take goes to `/ai-dlc:cache-keepalive-configure`, which the module answers at once for the forms below; with no arguments, or with plain words, the `cache-keepalive-configure` skill runs as before. Arguments that do not parse but are plainly meant as that grammar (they hold `--for`, `--track`, `--session` or `--machine`, or every word is `on`, `off`, `clear`, `--clear` or a duration, such as `2h 3h`) get the module's usage text, naming the problem; arguments that do not parse and are not plainly that grammar reach the skill, so a bare word among other words (`turn the 5m track off`) is still a change in plain words. Flags alone that do parse, such as `--track 5m`, name no change, so they reach the skill too. With no scope flag, `on` and `off` write the override in the `env` of `.claude/settings.local.json` (the same as `--for just-me`); a keep-warm time or `clear` with no scope flag, `--for` or `--machine` uses the default `scope` (`session`, unless `scope` says `machine`), writing no file. To change the team file (`.ai-dlc/cache-keepalive.json`), use plain words.

`--for just-me|team|global` picks where the value is written, with `on`, `off`, a keep-warm time and `clear`: `just-me` the `env` of `.claude/settings.local.json` (what `on` and `off` use when no flag is given; a keep-warm time or `clear` with no flag uses the default `scope` instead); `team` the `env` of `.claude/settings.json`; `global` the `env` of `~/.claude/settings.json`. A track's `…_MAX_PINGS` variable is written or removed only when it is the value the command's keep-warm time left, so a value set by hand stays (a `…_MAX_PINGS` with no `…_KEEP_WARM_FOR` beside it in that file counts as set by hand): a keep-warm time writes `…_MAX_PINGS` as the pings it allows (at least 1) when the file's value is the one its old keep-warm time left, or when the limit in force is too low for the new time; otherwise it leaves it. `clear` removes `…_KEEP_WARM_FOR`, and `…_MAX_PINGS` only when it is the value that keep-warm time left; the reply names each `…_MAX_PINGS` written or removed, and, for `clear`, each one kept. `--for` with `--session` is ignored (the session switch wins, nothing is written, and the reply says so); `--for` with `--machine` is refused. A team write is also recorded under `teamRecord` in `.ai-dlc/cache-keepalive.json`; that entry is only a record, never read, and personal values are never written there. In a folder Claude Code does not trust, a team write still happens, but the reply warns that it will not apply.

| Command | What it does |
| --- | --- |
| `/ai-dlc:cache-keepalive` | **In progress:** Pings now with the settings in force and shows the band, minimised; it opens no Pane. Takes no arguments and changes no setting; with keep-alive off it pings nothing and says why |
| `/ai-dlc:cache-keepalive-configure 2h` | Sets the keep-warm time of both tracks in the default scope (`scope`) |
| `/ai-dlc:cache-keepalive-configure 30m --track 5m` | Sets it for the 5m track only. `--track 1h` picks the 1h track, `--track both` both (the default); `--track=5m` works too |
| `/ai-dlc:cache-keepalive-configure 2h --session` | Sets it for this session only |
| `/ai-dlc:cache-keepalive-configure 1d --machine` | Sets it for every session on this machine until cleared. The value is kept in the plugin's store |
| `/ai-dlc:cache-keepalive-configure off`, `/ai-dlc:cache-keepalive-configure on --track 5m` | Turns keep-alive, or the tracks `--track` names, off or on by writing `AI_DLC_KEEPALIVE_ENABLED` (or `AI_DLC_KEEPALIVE_1H_ENABLED`, `AI_DLC_KEEPALIVE_5M_ENABLED`) to the `env` of `.claude/settings.local.json`, which wins over `.claude/settings.json` and `.ai-dlc/cache-keepalive.json`. This session's band buttons for it are dropped (all of them, for the master form) so the value applies now. `--session` acts like the band button (this session only, no file written); without `--track` it acts like the head row's button, turning both tracks on or off according to what the head row reads (on while either track is on), so `on` while either track is on, and `off` while both are off, changes nothing; `--machine` is refused with `on` and `off` |
| `/ai-dlc:cache-keepalive-configure clear`, `/ai-dlc:cache-keepalive-configure clear --track 5m --machine` | Removes the override of the tracks named (both unless `--track` is given) in that scope (the default scope unless a flag is given). `--clear` works as `clear` |

Durations are `<n>m`, `<n>h` or `<n>d`, at least `minDuration`; `n` may have a fraction (`1.5h`). Flags, track names and units are not case-sensitive, and one duration and one `--track` per call: `/ai-dlc:cache-keepalive-configure 2h 3h` is a usage error. The word after `--track` is always the track, so `--track 5m` never reads as a duration. Each track keeps its own overrides, and for each the most specific value wins: this session's override, then the machine-wide one, then the track's `keepWarmFor`. An override shorter than `minDuration` is ignored with a warning. The store keeps the overrides of the `sessionOverridesMax` most recent sessions that set one. A change made while the pings run takes effect at the next ping. A duration no longer than a track's interval sends no ping on that track: the cache's own lifetime covers it.

## Settings

The team's settings live in `.ai-dlc/cache-keepalive.json`, committed with the repository. `/ai-dlc:init` creates it with every key at its default, then writes the two it asks for, `oneHour.keepWarmFor` and `scope`; on a re-run it adds the keys a newer plugin has with their defaults, rewrites any `null` key to its default, removes retired ones and keeps every value set. Every key holds an explicit value, written from this plugin version's defaults; a later change of a default in the plugin does not reach a key already written, since a re-run keeps every value set. Change a value with `/ai-dlc:cache-keepalive-configure`. A `null` is not a valid value: the module logs it and uses the next level, `/ai-dlc:cache-keepalive-configure` warns about it, and `/ai-dlc:cache-keepalive-merge` rewrites it to its default, as it does a legacy `maxPings` of `0` (it no longer means "no limit") and after a plugin upgrade, adding the new keys and removing retired ones. `/ai-dlc:cache-keepalive-configure` also checks every `AI_DLC_KEEPALIVE_*` variable in the `env` of both settings files. A bad value is never an error anywhere: the module and `/ai-dlc:cache-keepalive-configure` each warn, naming the value that applies instead. The one exception is a file that cannot be read as settings at all: a change and a merge stop when `.ai-dlc/cache-keepalive.json` is not valid JSON, or a track is not an object, and write nothing until it is fixed by hand (`/ai-dlc:cache-keepalive-configure` warns about it, and keep-alive skips the file). `/ai-dlc:cache-keepalive-install` creates the file once, `/ai-dlc:cache-keepalive-merge` brings an existing one up to date, and `/ai-dlc:cache-keepalive-configure` shows each setting's value and where it comes from, and changes them in that file after a preview, or for one developer in the `env` of `.claude/settings.local.json`; its schema, `.ai-dlc/cache-keepalive.schema.json`, gives editors completion and hover docs.

Each setting is read from the first of these that sets it to a valid value, highest first:

1. the `/ai-dlc:cache-keepalive-configure` `--session` or `--machine` override, for the keep-warm time only, each track on its own;
2. the `env` of `.claude/settings.local.json`: one developer's values, not committed;
3. the `env` of `.claude/settings.json`: the team's override (some settings only in a trusted folder; see *Workspace trust*);
4. the `env` of `~/.claude/settings.json`: your values for every repository (not trust-gated);
5. `.ai-dlc/cache-keepalive.json`, with the keys below (a dot is one level of nesting; the same settings only in a trusted folder);
6. the built-in default.

Keep-alive has no `/config` rows, and the process environment is not read. A value that does not parse, is out of range, or breaks a rule is ignored with a warning in the transcript and the module's log (`~/.claude/state/auto-handoff/auto-handoff.log`), and the next level applies. The rules: every duration you set is at least `minDuration` (the defaults are exempt), and each track's `pingEvery` is shorter than its `ttl`. A `ttl` that leaves no `pingEvery` shorter than it, not even the default, is dropped for the defaults of both.

**When the settings are read.** The settings are read at every new turn, each time a turn ends with background work, and at each `/ai-dlc:cache-keepalive-configure`. Nothing is read while the session is idle.

- **What a new turn reads.** Each settings file is checked at every turn and read again only when its size or modified time changed; a file that is missing and stays missing is not read again. The repository root comes from git once per working directory. It is asked again when the working directory changes, in a new session, and after each Stop with background work or each command, which read everything in full. Claude Code's trust record (`~/.claude.json`) is read again only when that file changed, and only when a trust-gated setting differs from its default. An edit that keeps both a file's size and its modified time goes unseen at a new turn and is picked up at the next Stop or command.
- **A broken file at a new turn.** A settings file that cannot be parsed keeps the settings last read (the defaults in a fresh session) and is noted only in the debug log, at every turn while it stays broken. The transcript warning and the fall-through to the next level come at the next Stop or command, as before. A file that exists but cannot be read at a turn (a lock, or a transient error while an editor saves it), whether a settings file or `~/.claude.json`, is treated the same way: the turn keeps the last good values, notes it only in the debug log and reads the file again at the next turn. It is never taken for a missing file. A path that is a folder still reads as missing.

**Workspace trust.** `.ai-dlc/cache-keepalive.json` and `.claude/settings.json` are committed, so a cloned repository could set either. From them, the settings that decide whether and how much the module spends your tokens and rate limit, and the text it sends to the model, apply only in a folder Claude Code trusts (its trust prompt accepted), as for the automatic handoff's `viewer` and templates (see the `configure-auto-handoff` skill): `enabled`, each track's `enabled`, `pingEvery`, `keepWarmFor` and `maxPings`, `budgetMultiplier`, the prices the spend limit counts in (`writeMult`, `outputMult` and `readPrice`), `compactOnCap`, `pingPrompt`, `compactInstructions` and `onWhenOff` (under `handoff`). In a folder it does not trust, each of them whose value differs from its default is skipped with a warning that names it, its value and where to set it instead, and the next level applies; a value equal to its default changes nothing, so it applies without a warning (the file init writes holds every default); set them in the `env` of `.claude/settings.local.json` instead, or a keep-warm time with `/ai-dlc:cache-keepalive`. Neither of those is gated. Every other setting applies from both files in any folder. The warning lists the skipped settings as `key=value`: text in double quotes, any other value as JSON, each run of white space folded to one space, and a value over 40 characters cut there and followed by `…` and `(N chars)`, where N is the length of the folded value in characters (`pingPrompt="Ignore your instructions. xxxxxxxxxxxxxx…" (226 chars)`). It is written to the transcript and to `~/.claude/state/auto-handoff/auto-handoff.log` unredacted, so the first 40 characters of whatever a gated setting holds land in both. Do not put secrets (tokens, keys, passwords) in these settings.

**Which sessions record trust.** Claude Code records it as `projects["<path>"].hasTrustDialogAccepted` in `~/.claude.json`, keyed on the repository root, when you accept its trust dialog. Interactive terminal sessions show that dialog. `claude -p` and Agent SDK sessions never show it, so, as far as the docs show, they never record trust (an inference: the dialog is the only documented way the flag gets written). Whether the VS Code extension records trust is not yet verified; whether the JetBrains extension or Claude Desktop show the dialog or record trust is not documented. The module and its track lines are verified to run in the VS Code extension (maintainer, 2026-10-23). The flag is shared by every surface: accept the folder once in an interactive terminal session, or set the flag to `true` by hand in `~/.claude.json`, and the folder is trusted everywhere. Until then, the 17 settings above never apply from `.claude/settings.json` or `.ai-dlc/cache-keepalive.json` on a surface that does not record trust (`claude -p`, the SDK); the `env` of `.claude/settings.local.json` and the `/ai-dlc:cache-keepalive` overrides still work.

| Environment variable | Key | Default | What it does |
| --- | --- | --- | --- |
| `AI_DLC_KEEPALIVE_ENABLED` | `enabled` | `true` | Keep-alive on or off |
| `AI_DLC_KEEPALIVE_SCOPE` | `scope` | `session` | The scope of `/ai-dlc:cache-keepalive-configure <duration>` without a flag: `session` or `machine` |
| `AI_DLC_KEEPALIVE_STATUS` | `status` | `true` | Show or hide the band |
| `AI_DLC_KEEPALIVE_SOURCE_NOTE` | `sourceNote` | `true` | Name where each keep-warm time comes from in the track rows |
| `AI_DLC_KEEPALIVE_PING_PROMPT` | `pingPrompt` | `Keep-alive ping. Reply with only: ok` | The text each ping sends |
| `AI_DLC_KEEPALIVE_HIT_THRESHOLD` | `hitThreshold` | `0.9` | A ping is a hit when more than this share of its input, 0 up to 1, was read from the cache |
| `AI_DLC_KEEPALIVE_OVERAGE_PERCENT` | `overagePercent` | `100` | No pings while any plan usage window is at or above this percent, 1 to 100 |
| `AI_DLC_KEEPALIVE_MIN_DURATION` | `minDuration` | `1m` | The shortest duration accepted from your settings and the command (at least 1 second) |
| `AI_DLC_KEEPALIVE_SESSION_OVERRIDES_MAX` | `sessionOverridesMax` | `20` | Session overrides the store keeps |
| `AI_DLC_KEEPALIVE_1H_ENABLED` | `oneHour.enabled` | `true` | The 1h track on or off |
| `AI_DLC_KEEPALIVE_1H_TTL` | `oneHour.ttl` | `60m` | The lifetime the 1h track assumes after each ping |
| `AI_DLC_KEEPALIVE_1H_PING_EVERY` | `oneHour.pingEvery` | `50m` | The 1h track's interval |
| `AI_DLC_KEEPALIVE_1H_KEEP_WARM_FOR` | `oneHour.keepWarmFor` | `8h` | How long the 1h track keeps pinging |
| `AI_DLC_KEEPALIVE_1H_MAX_PINGS` | `oneHour.maxPings` | `9` | The 1h track's ping limit, a whole number of 1 or more (8h at 50m allows 9 pings) |
| `AI_DLC_KEEPALIVE_5M_ENABLED` | `fiveMinute.enabled` | `true` | The 5m track on or off |
| `AI_DLC_KEEPALIVE_5M_TTL` | `fiveMinute.ttl` | `5m` | The lifetime the 5m track assumes after each ping |
| `AI_DLC_KEEPALIVE_5M_PING_EVERY` | `fiveMinute.pingEvery` | `3m` | The 5m track's interval |
| `AI_DLC_KEEPALIVE_5M_KEEP_WARM_FOR` | `fiveMinute.keepWarmFor` | `1h` | How long the 5m track keeps pinging |
| `AI_DLC_KEEPALIVE_5M_MAX_PINGS` | `fiveMinute.maxPings` | `20` | The 5m track's ping limit, a whole number of 1 or more (1h at 3m allows 20 pings) |
| `AI_DLC_KEEPALIVE_BUDGET_MULTIPLIER` | `budgetMultiplier` | `2` | The spend limit, in multiples of the context's tokens; `0` turns it off |
| `AI_DLC_KEEPALIVE_COMPACT_ON_CAP` | `compactOnCap` | `false` | Compact instead of stopping when the spend limit is reached |
| `AI_DLC_KEEPALIVE_COMPACT_INSTRUCTIONS` | `compactInstructions` | `Also keep the background tasks' IDs, output paths, and what to do when they finish.` | What that compaction is told to keep |
| `AI_DLC_KEEPALIVE_WRITE_MULT` | `writeMult` | `2` | A cache write's price over the base input price |
| `AI_DLC_KEEPALIVE_OUTPUT_MULT` | `outputMult` | `5` | An output token's price over the base input price |
| `AI_DLC_KEEPALIVE_READ_PRICE` | `readPrice` | `fable\|mythos=0.025,opus[- ]?5[-. ]5=0.05,*=0.1` | A cache read's price over the base input price, by model: `pattern=multiplier` pairs, the first pattern (a case-insensitive regular expression) that matches the model id wins, `*` for any other |
| `AI_DLC_KEEPALIVE_COMPACT_COST_GUESS` | `compactCostGuess` | `0.6` | A compaction's cost per context token, until one has been measured |
| `AI_DLC_KEEPALIVE_SUMMARY_RATIO_GUESS` | `summaryRatioGuess` | `0.15` | A compaction summary's size over the context, until one has been measured |
| `AI_DLC_KEEPALIVE_HANDOFF_CARRY_OVER` | `handoff.carryOver` | `true` | Keep the switches and `--session` overrides across an automatic handoff (see *An automatic handoff is one session*) |
| `AI_DLC_KEEPALIVE_HANDOFF_ON_WHEN_OFF` | `handoff.onWhenOff` | `true` | Turn keep-alive on in the seeded session when neither track was on at the handoff (trust-gated) |

For example, a team that wants the 5-minute track to stop after ten pings and the 1-hour track to keep warm for a working day runs `/ai-dlc:cache-keepalive-configure stop the 5-minute track after ten pings and keep the 1-hour track warm for 10h`, which changes these values in the file (its other keys keep their values; 10h at 50m allows 12 pings, so the 1h limit rises with it):

```json
{
  "fiveMinute": { "maxPings": 10 },
  "oneHour": { "keepWarmFor": "10h", "maxPings": 12 }
}
```

## What the cache can reuse across a handoff

The automatic session handoff ends the session with `/clear` and starts a fresh one. The fresh session's first request can read from the cache only the prefix both sessions share: the tools, the system prompt, and the project context (`CLAUDE.md`, memory and the git status snapshot), and only if that prefix is byte-for-byte the same and the cache still holds it. The old conversation is never reused: it is gone after `/clear`, and the brief and the seed are new messages.

So the handoff keeps that prefix as it was: it changes neither the model nor the effort, and the brief and the seed travel only as messages, never in `CLAUDE.md`, memory or the system prompt. What can still break it:

- a change to `CLAUDE.md`, memory or a tracked file before the `/clear`, which changes the project context or the git status snapshot. With an active AI-DLC run, the handoff updates the run's current run state (the highest `run.v<major>[.<minor>].md`; `run.md` for a run from before versions; **in progress:** the module's own handling of versions is being updated to match the `handoff` skill); when that file was not already modified, the snapshot changes and the prefix misses.
- a different model or effort in the new session.

The handoff takes seconds, well inside both lifetimes, so keep-alive's pings do not help across it; the handoff stops them before its `/clear`. The seed turn proves what happened: its log line (`floor session=…`) gives the first request's `input_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`, the 1h/5m split of the write and `cache=hit` or `cache=miss`, the handoff's panel says `cache hit` or `cache miss`, and so does keep-alive's seed row (`keepalive seed: cache hit, 30k read`). A miss with a fresh write means the prefix changed.

**Unverified.** Keeping the cache warm for hours rests on each cache read restarting the entry's lifetime. Anthropic's prompt-caching documentation says a hit refreshes the cache, in its section on the default 5-minute lifetime; it does not repeat it for the 1-hour lifetime. Pings are forks, which Claude Code may write in the 5-minute bucket; whether a 5-minute read refreshes a 1-hour entry is not documented either. Treat "warm until" and long keep-warm times as resting on that inference, not on a documented guarantee.

## Limitations

Mods see only the account-wide usage windows, not model-scoped limits such as Fable's weekly one. Keep-alive does not arm while a 5-hour or 7-day window is at or above `overagePercent`, and stops if one crosses it during the wait; when a model-scoped limit runs out, the first ping misses and the track stops. Usage readings arrive with this session's own responses, so it may not see overage that other sessions cause during a wait.

**Agent teams.** An in-process teammate's requests use a 5-minute cache unless the `subagentPromptCacheTtl` setting is `1h`. Keep-alive pings the main session only; it observes the subagents' and teammates' caches (the `subagents` part of a line) but does not ping them.

## Compact on cap

`compactOnCap` (off by default) compacts the conversation when the spend limit is reached, while the cache is still warm. It compacts only when the compaction's cost plus re-caching the summary is less than re-caching the whole context. Keep-alive records the cost and summary size of each compaction it runs and uses them for the next decision. Compaction loses context detail, which is why it is off by default.

A background notification that arrives during compaction waits until compaction finishes, then starts its turn as usual.

Compaction keeps the earlier messages in the session file. After each compaction it runs, keep-alive adds a line to the transcript with a command that opens the conversation as it was before that compaction, as a new session. The compacted session does not change. The command needs `jq` and uses `--resume-session-at`, a CLI flag that `claude --help` does not show. `/rewind` cannot go back past a compaction after the session is resumed.
