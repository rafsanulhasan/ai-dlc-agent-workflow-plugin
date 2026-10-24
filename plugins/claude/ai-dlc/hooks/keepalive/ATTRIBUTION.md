# Attribution

This folder, keep-alive, is a modified copy of `cache-keepalive` by
RichardJSun, incorporated into the `ai-dlc` plugin under the MIT License. The
original copyright and permission notice is in [LICENSE](LICENSE). It is not a
hooks module of its own: the `auto-handoff` module (`../auto-handoff/`, with
its own upstream, `LICENSE` and `ATTRIBUTION.md`) imports it and registers it.

Until 2026-10-23 this folder was `hooks/auto-handoff/keepalive/`, and its tests
`hooks/auto-handoff/tests/keepalive.test.ts`. The entries below that predate
the move name the paths as they were then: `keepalive/<file>` is now `<file>`
in this folder, and `tests/keepalive.test.ts`, then auto-handoff's, is now this
folder's.

The entries below are a history, each true when it was written. Those before
2026-10-23 (run AAW-20261022-cache-keepalive-init) name the command
`/ai-dlc:keepalive` and the skill `skills/keepalive/`, now
`/ai-dlc:cache-keepalive` and `skills/cache-keepalive/`, and `/config` rows
(`keepalive*` in the manifest's `userConfig`) as a settings level; those rows
and that level are gone. The last entry describes the current state.

| Field | Value |
| --- | --- |
| Upstream | <https://github.com/RichardJSun/claude-code-mods> (`plugins/cache-keepalive`) |
| Commit | `6135ec5574609c9fcd865f517c24990d5f37321b` |
| Version | 0.2.5 |
| Vendored | 2026-10-21, as `plugins/claude-mods/cache-keepalive/` |
| Incorporated | 2026-10-22, as `plugins/claude/ai-dlc/hooks/auto-handoff/keepalive/` |
| Moved | 2026-10-23, to `plugins/claude/ai-dlc/hooks/keepalive/` |

## What was copied

`plugins/cache-keepalive/` from the upstream repository (`hooks/register.ts`,
now `keepalive.ts`; `hooks/register.test.ts`, now
`tests/keepalive.test.ts`; `.claude-plugin/plugin.json`, whose options are now
rows of `ai-dlc`'s manifest), and `LICENSE` and `README.md` from the upstream
repository root (now `LICENSE` and `README.md`). `LICENSE`
is unchanged. Not kept: `hooks/hooks.json`, upstream's `tsconfig.json` (the
one here now was added on 2026-10-23, see below) and the vendoring record
`VENDORED.md`, whose history follows.

## Modifications

Made by Rafsanul Hasan, 2026-10-21 (run `AAW-20261021-mods-config`), while the
mod was vendored:

- **Keep-warm duration.** New `userConfig` option `keepWarmFor` (string,
  default `8h`, `<n>m`, `<n>h` or `<n>d`). `classic.Stop` recorded when it
  armed the pings, and the timer stopped before a ping once that much time had
  passed (status `keepalive: kept warm <duration>, stopped`), alongside the
  upstream expiry, miss, budget and overage stops. An invalid value fell back
  to `8h` and was logged at `session.start`. The arm status line ended with
  `keep warm <duration>`.
- **`/keepalive <duration>`** (the command was then `/keepalive`; it is now
  `/ai-dlc:keepalive`, see below). The `keepalive` command read its arguments: a
  duration set an override, `clear` removed it, and `--session` or
  `--machine` picked the scope for that call. Without arguments it pinged as
  upstream does, and its output also named the duration in force.
- **Scope.** New `userConfig` option `keepaliveScope` (`session`, the
  default, or `machine`): the scope `/keepalive <duration>` (the command's
  name then) used without a flag. Session overrides were kept in the store by session id, the newest 20
  only; the machine-wide override beside them. This session's override won
  over the machine-wide one, which won over `keepWarmFor`.
- **New file `hooks/duration.ts`** (now `keepalive/duration.ts`): the duration
  and argument parsers, free of the engine so the tests call them directly.
- **Accepted syntax.** `n` may have a fraction (`1.5h`), units and flags are
  not case-sensitive, `--clear` is an alias of `clear`, a duration under 1m is
  refused, and two durations in one call are the usage error
  `give one duration`. A duration of 50m or less sent no ping, and the status
  then read `no ping needed for <duration>, stopped`.
- **Tests and README.** Tests for the parsers, the duration stop, the
  `/config` values, the budget stopping first, both scopes, re-arming, a
  missed ping, malformed store values and the 20-override cap, added over
  three review rounds; a README section "Keep-warm duration".

Made by Rafsanul Hasan, 2026-10-22 (run `AAW-20261022-fold-cache-keepalive`):

- **Moved into `ai-dlc`.** The code is registered by this module
  (`registerKeepalive`), its options are rows of `ai-dlc`'s manifest, and the
  `cache-keepalive` plugin, its marketplace entry, the `dependencies` entry of
  `ai-dlc` and the CI loop over vendored mods are gone. Store keys carry a
  `keepalive:` prefix (`keepalive:keepWarmFor:sessions`,
  `keepalive:keepWarmFor:machine`, `keepalive:compactCost`,
  `keepalive:summaryRatio`), since the store is now `ai-dlc`'s.
- **`/ai-dlc:keepalive`.** A hooks module can register only a bare command
  name (letters, digits, `_` and `-`; Claude Code refuses
  `ai-dlc:keepalive`), so the module registers none. The new plugin skill
  `skills/keepalive` gives the name `/ai-dlc:keepalive`, and the module's
  `command.run` hook on `{ command: 'ai-dlc:keepalive' }` answers its runs in
  the skill's place; the skill's own text only tells the model that the module
  is not loaded. The arguments are unchanged, and every message names
  `/ai-dlc:keepalive`.
- **Two tracks.** One upstream timer assuming a 1-hour cache became a 1-hour
  track (a ping every 50 minutes, for 8 hours) and a 5-minute track (every 3
  minutes, for 1 hour), each with its own timer, limits and status line. A
  track runs only when the session's last cache write used its lifetime: the
  `cache_creation` split of the latest main-conversation response
  (`noteUsage`), else of the transcript's last such row (`splitOf`,
  `splitFromTranscript`, `transcriptSplit`). With no write seen, neither runs.
  A duration set with the command applies to both tracks. The status is two
  lines, `keepalive 1h: …` and `keepalive 5m: …`, with "warm until", the pings
  sent out of the limit, the keep-warm time and "stop by"; a track not in use
  shows `off`.
- **Stop rules.** A Stop with no background task stops the pings
  (`work done, stopped`); so do `session.end` and an automatic handoff
  (`stopForHandoff`, `handed off, stopped`), alongside the upstream new-turn,
  miss, expiry and overage stops. A track also stops at its ping limit. The
  budget became the optional spend limit, shared by both tracks:
  `budgetMultiplier` × the context's tokens, `0` for none; `compactOnCap`
  works as before. A timer stopped since it was set no longer touches its
  track.
- **Every setting configurable.** New `keepalive/settings.ts`: one table of
  26 settings, each with an `AI_DLC_KEEPALIVE_*` variable, a key in
  `.ai-dlc/cache-keepalive.json` and a `/config` row, and the only defaults
  (the duplicate `8h` of `duration.ts` and the manifest is gone; the `/config`
  rows have no `default`). Precedence, highest first: the command's override
  (keep-warm time only), the `env` of `.claude/settings.local.json`, the `env`
  of `.claude/settings.json`, `.ai-dlc/cache-keepalive.json`, `/config`, the
  default; the process environment is not read. An invalid value, or one that
  breaks a rule (a duration under `minDuration`, a `pingEvery` not shorter than
  its `ttl`), is logged once and the next level applies. The upstream
  constants (ping interval, lifetime, write and output price, read price by
  model, compaction guesses, hit threshold, overage percent, ping prompt,
  compaction instructions) are settings now. `pingPrompt` and
  `compactInstructions` apply from the repository file only in a folder
  Claude Code trusts (widened in review round 1, D2; see below).
  `parseDuration` and `parseCommandArgs` take the minimum,
  and `formatDuration` shows a part of a minute.
- **README.** Rewritten for the module: the two tracks, each status line, the
  stop rules, the command, the settings table, and what the cache can and
  cannot reuse across a handoff, including that a read restarting a 1-hour
  entry's lifetime is unverified. The upstream compaction text is kept.
- **Tests.** `tests/keepalive.test.ts` keeps the upstream tests where the
  behaviour is, renamed for the tracks and the command, and adds: the
  precedence across the levels with an invalid value falling through at each,
  the rules, every kind, the read price, the split readers, both tracks'
  scheduling, both together, the ping limit, no split, a disabled track, the
  spend limit on and off, the work-done, new-turn, session-end and overage
  stops, `enabled` and `status`, the trust gate, one warning per value, the
  command name with no bare `keepalive` answered, and the override against the
  settings levels and `minDuration`.

Made by Rafsanul Hasan, 2026-10-22 (run `AAW-20261022-fold-cache-keepalive`,
review round 1, with the human's decisions D1 to D4):

- **The last ping goes out (D1).** A track stops when its next ping would be
  due after the keep-warm time, counted as pings × `pingEvery` from the end of
  the turn rather than on the clock. A ping due exactly at the limit goes out,
  so the 5-minute track's hour sends 20 pings, not 19, and the seconds each
  ping takes no longer cost the last one. The 1-hour track still sends 9 in 8
  hours.
- **Spend and behaviour settings need a trusted folder (D2).** From
  `.ai-dlc/cache-keepalive.json` and now also from the `env` of the committed
  `.claude/settings.json`, `enabled`, each track's `enabled`, `pingEvery`,
  `keepWarmFor` and `maxPings`, `budgetMultiplier`, `compactOnCap`,
  `pingPrompt` and `compactInstructions` apply only in a folder Claude Code
  trusts (`settings.ts`, `TRUST_GATED` and `gatedNames`). Elsewhere each is
  logged and skipped, and the next level applies; the message names where to
  set them instead, the `/ai-dlc:keepalive` override included. The `env` of
  `.claude/settings.local.json`, `/config` and the override are not gated.
  The local `gated` function is gone; `load` uses `io.ts` `trustGate`.
- **The seed turn's cache on the status line (D4).** `showSeedCache` and
  `seedLineOf`: after an automatic handoff, a third status line
  `keepalive seed: cache hit, <n>k read` or `keepalive seed: cache miss`,
  alone during the seed turn, under the track lines once a Stop arms them,
  cleared at the next turn and at `session.end`, hidden with the tracks when
  `enabled` or `status` is off.
- **Spend limit failures are caught.** The timer awaits `spendLimit`, so a
  failure in it reaches the timer's `catch`, which now logs it even when the
  track was already stopped. A store that cannot be read when deciding
  whether compacting pays is logged, and the tracks stay stopped at the spend
  limit, instead of leaving an unhandled rejection and a stale status line.
- **`session.end` resets the session.** Besides the timers, the split and the
  lines, it clears what was spent, the spend limit, the measured context, the
  compacting flag and the seed line, and forgets which setting problems were
  warned about, so each session warns about them once.
- **Booleans** parse through `config.ts` `parseBool`, as in the automatic
  handoff's settings; the accepted words are unchanged.
- **README.** The 5-minute track's 20 pings and why the last one goes out; a
  stop line with its `, warm until HH:MM` suffix; the trust paragraph naming
  every gated setting and both gated files; the seed status line.
- **Tests.** `tests/keepalive.test.ts` adds: the transcript read through
  `tail -c` when it is over the read cap, `tail` missing or exiting non-zero,
  and a first line cut mid-row; the trust gate on the `env` of
  `.claude/settings.json` and on the repository file, the gated settings still
  applying from `.claude/settings.local.json` and `/config`, and applying from
  both committed files when trusted; a store failing at the spend limit; a new
  session with nothing spent and its warnings repeated; the seed line's text;
  and the `/ai-dlc:keepalive` override against each lower level in turn. The
  5-minute track test expects 20 pings, and the tests that set a gated
  setting from a committed file run in a trusted folder. Repository tests
  (`tests/auto-handoff/keepalive-settings.test.mjs`) check the gated list and
  the README's trust paragraph.

Made by Rafsanul Hasan, 2026-10-23 (same run, review round 2, docs only):

- **README.** *Workspace trust* says which sessions record trust: interactive
  terminal sessions do, `claude -p` and Agent SDK sessions never do, and the
  VS Code and JetBrains extensions and Claude Desktop are undocumented. The
  flag in `~/.claude.json` is shared, so accepting the folder once in a
  terminal, or setting it by hand, trusts it for every surface; until then the
  13 gated settings never apply from the committed files, and the `env` of
  `.claude/settings.local.json` and `/config` are the way to set them. It
  also says the warning names where to set them instead. No code changed.

Made by Rafsanul Hasan, 2026-10-23 (same run, review round 3, docs only):

- **README.** *Workspace trust* no longer says the 13 gated settings never
  apply "whatever surface you use": they never apply from the committed files
  on a surface that does not record trust (`claude -p`, the SDK). That those
  sessions never record trust is marked as an inference from the docs, here
  and in the `init` and `configure-auto-handoff` skills. Whether the VS Code
  extension records trust is not yet verified (to be confirmed live); the
  JetBrains extension and Claude Desktop stay undocumented. The maintainer
  verified that the module and its status lines run in the VS Code extension.
- **Manifest.** The 13 keep-alive `userConfig` descriptions name the
  keep-alive README (`hooks/auto-handoff/keepalive/README.md`, *Workspace
  trust*) instead of "the README". No code changed.

Made by Rafsanul Hasan, 2026-10-23 (run `AAW-20261023-keepalive-own-folder`):

- **Own folder.** Keep-alive moved from `hooks/auto-handoff/keepalive/` to
  `hooks/keepalive/`, with its `LICENSE` (unchanged), `README.md`, this file
  (until then the *cache-keepalive* section of auto-handoff's
  `ATTRIBUTION.md`) and its tests (`tests/keepalive.test.ts`). It stays part of
  the one hooks module: `../auto-handoff/register.tsx` imports it from
  `../keepalive/keepalive.ts` and registers it, and `hooks/hooks.json` still
  lists that one module. Keep-alive imports the shared helpers from
  `../auto-handoff/config.ts` and `../auto-handoff/io.ts`; nothing is copied.
  `claude plugin validate --strict` reports the same hooks, calls and
  environment reads for the module before and after the move. A
  `tsconfig.json`, the same as auto-handoff's, makes the folder type-check on
  its own.
- **Prices trust-gated.** `writeMult`, `outputMult` and `readPrice` joined the
  trust-gated settings (16 in all): from the `env` of `.claude/settings.json`
  or `.ai-dlc/cache-keepalive.json` they apply only in a folder Claude Code
  trusts, since a low price lets the pings spend more before the spend limit,
  as a high `budgetMultiplier` does.
- **Skipped values logged.** The trust gate's warning names each skipped
  setting with its value (`pingPrompt="..." in .ai-dlc/cache-keepalive.json
  ignored: ...`), unredacted, in the transcript and the module's log; a value
  longer than 40 characters is cut, with `…` and its length after it. A
  secret put in a gated setting therefore shows its first 40 characters there
  (documented in round 1, below).
- **Style.** `settings.ts`: a space after `=` in `const NUMBER = /.../`.
- **README.** *Workspace trust* names the three prices and counts 16 gated
  settings, and says the warning names each value.
- **Tests.** `tests/keepalive.test.ts`: the three prices in the per-key
  trust-gate table (each skipped and logged with its value when untrusted,
  applying from `settings.local.json`, `/config` and trusted files), probed
  through what the first ping spent; the gated list now 16 keys; a long
  skipped text logged cut short; the trust warnings checked with their values.

Made by Rafsanul Hasan, 2026-10-23 (same run, review round 1):

- **README.** *Workspace trust* gives the trust warning's format (`key=value`,
  text in double quotes, white space folded, a value over 40 characters cut
  with `…` and `(N chars)`), says it is written unredacted to the transcript
  and `~/.claude/state/auto-handoff/auto-handoff.log`, so a gated setting's
  first 40 characters land there, and says not to put secrets in these
  settings. Logging the values is intended (asked for by the human on
  2026-10-23); nothing is redacted.
- **The shared preview** (`../auto-handoff/config.ts`, `previewValue`, which
  this folder's trust warning uses) now cuts on code points and counts N as
  the folded value's length in characters; see auto-handoff's
  `ATTRIBUTION.md`, same round. No code in this folder changed.

Made by Rafsanul Hasan, 2026-10-23 (run AAW-20261022-cache-keepalive-init;
human decisions of 2026-10-22):

- **The command is `/ai-dlc:cache-keepalive`.** It was `/ai-dlc:keepalive`;
  the plugin skill that gives it its name moved from `skills/keepalive/` to
  `skills/cache-keepalive/`, and `COMMAND` in `keepalive.ts` is now
  `ai-dlc:cache-keepalive`. The former name is no longer answered.
- **One track or both.** `/ai-dlc:cache-keepalive <duration>` and `clear`
  take `--track 1h`, `--track 5m` or `--track both` (also `--track=5m`), both
  by default (`duration.ts`, `parseCommandArgs`; the word after `--track` is
  always the track). Each track keeps its own overrides in the plugin's store
  (`keepalive:keepWarmFor:sessions:<track>` and
  `keepalive:keepWarmFor:machine:<track>`, replacing the two shared keys; an
  override under the former keys is no longer read). The command's reply and
  usage text name the track, and the minDuration warning names it too.
- **No `/config` rows.** The 26 `keepalive*` rows are gone from the plugin
  manifest's `userConfig`; `settings.ts` has no `/config` level (`Setting`
  lost `userConfig`, `Level` lost `by: 'userConfig'`), and
  `registerKeepalive` no longer takes the plugin options
  (`../auto-handoff/register.tsx` updated). Precedence: the command's
  override, the `env` of `.claude/settings.local.json`, the `env` of
  `.claude/settings.json`, `.ai-dlc/cache-keepalive.json`, the default. A
  setting skipped in an untrusted folder is now pointed to
  `.claude/settings.local.json` (or the command) only.
- **`.ai-dlc/cache-keepalive.json` from init.** (Superseded the same day, run
  AAW-20261023-keepalive-explicit-defaults: init now writes every key's
  value, and `null` is invalid; see the entries below.) `/ai-dlc:init` creates it with
  every key unset except `oneHour.keepWarmFor` and `scope`, and merges it on a
  re-run, through the new `cache-keepalive-config` skill (itself superseded in step 1.l3 by
  `cache-keepalive-install`, `-merge` and `-configure`)
  (`/ai-dlc:cache-keepalive-config`, Claude Code only), which also shows and
  changes the settings. Its CLI
  (`skills/cache-keepalive-config/templates/cache-keepalive.mjs`)
  re-implements the resolution in `settings.ts`;
  `tests/auto-handoff/cache-keepalive-config-cli.test.mjs` in the plugin
  repository checks the two agree.
- **README.** *The command* documents `--track` and per-track overrides;
  *Settings* drops the `/config` level and row names, and describes the file
  init writes and the config command.
- **Tests.** `tests/keepalive.test.ts`: `--track` parsing and the command per
  track; the store keys per track; the precedence and invalid-value tests
  without `/config`; a former `/config` row is not read; the gated-key table
  without `/config` columns; the former command name is not answered.

Made by Rafsanul Hasan, 2026-10-23 (same run, review follow-up):

- **Style.** `keepalive.ts`: the comment above `load` is re-wrapped to the
  file's line width. No behaviour changed.
- **Tests.** `tests/keepalive.test.ts`: the one check, for `claude plugin
  test`, that neither keep-alive's settings table nor the automatic handoff's
  names a `userConfig` key (it replaces the per-setting assertion here and the
  one in `../auto-handoff/tests/config.test.ts`).

Made by Rafsanul Hasan, 2026-10-23 (run AAW-20261023-keepalive-explicit-defaults; human decisions of
the same day):

- **Every key holds a value.** `/ai-dlc:init` (the `cache-keepalive-config`
  skill's install) now writes `.ai-dlc/cache-keepalive.json` with all 26 keys
  at this plugin version's defaults, taken from `SETTINGS` through the
  skill's schema, which the plugin's tests hold to it. A later plugin
  default does not reach a key already written.
- **`null` is invalid in the repository file.** `settings.ts`, `check`: a
  `null` there is an invalid value (`NULL_IN_FILE`), warned about once, and
  the next level applies; in an `env` it is still unset.
- **Defaults are not trust-gated.** `settings.ts`: `differsFromDefault` and
  `gatedDiffering`. `keepalive.ts` passes the trust gate only the gated
  values that differ from their defaults, read as the module reads them
  (`480m` equals `8h`), from both committed sources; a value equal to its
  default changes nothing, so an untrusted folder applies it without a
  warning.
- **README.** *Settings*: the file holds every default, a `null` is invalid,
  `validate` checks the settings files' `env` too, and the trust paragraph
  says a value equal to its default is not skipped.
- **Tests.** `tests/keepalive.test.ts`: a file of every default logs no trust
  warning; only differing gated values are skipped; a `null` is one warning
  and the next level applies; `check` on `null`; `differsFromDefault` and
  `gatedDiffering`.

Made by Rafsanul Hasan, 2026-10-23 (same run, step 1.l1; human decisions of the same day):

- **`maxPings` is 1 or more.** `settings.ts`: both tracks' `maxPings` are
  `positiveWhole`; `0` ("no limit") and below are invalid, warned about once,
  and the next level applies. The defaults are 9 on the 1h track and 20 on
  the 5m track: the pings each default keep-warm time allows at its default
  interval (8h at 50m, 1h at 3m), counted as the module counts them.
- **The command lifts the limit.** `keepalive.ts`: `pingsWithin` and
  `pingCap`. When `/ai-dlc:cache-keepalive <duration>` set a track's
  keep-warm time, its ping limit is the larger of `maxPings` and the pings
  that duration allows, so the command keeps warm for the time it says. The
  limit stops a track only while the keep-warm time would allow another
  ping, so with the defaults the track still ends as "kept warm". The status
  line shows the limit in force (`ping 2/9`) instead of `∞`.
- **README.** The status line example, the two `maxPings` rows and *When the
  pings stop* describe the limit, its defaults, the command lifting it, and
  that a raised `keepWarmFor` in the settings needs a raised `maxPings`.
- **Tests.** `tests/keepalive.test.ts`: the defaults pinned to the pings the
  default keep-warm times allow; `0` invalid at every level; `pingCap`; the
  default limit stopping the 1h track at 48m pings; `1d` on the 1h track
  pinging 28 times; the R1 test now sets `maxPings` 10; the status lines and
  the gated-key table show 9 and 20.

Made by Rafsanul Hasan, 2026-10-23 (same run, review round 1):

- **Messages.** (Superseded in step 1.l3: the fix is now
  `/ai-dlc:cache-keepalive-merge`.) `settings.ts`, `NULL_IN_FILE`: the fix it names is
  `/ai-dlc:cache-keepalive-config install`, the skill's mode, instead of the
  CLI's `merge`.
- **README.** *When the pings stop*: `set` and init make a track's
  `maxPings` follow a `keepWarmFor` they write; the command raises the limit
  to at least the pings its duration allows. *Settings*: `set` and install
  stop with exit 1 on a file that is not valid JSON or a track that is not an
  object.
- **Tests.** `tests/keepalive.test.ts`: the pinned null message.

Made by Rafsanul Hasan, 2026-10-23 (same run, step 1.l3; the final command design, human decision of
the same day):

- **Settings commands.** The `cache-keepalive-config` skill is gone, with
  no alias (the plugin is an unreleased preview). Three skills replace it:
  `cache-keepalive-install` (first use: creates the file with every
  default; an existing file is left alone with a warning pointing to merge),
  `cache-keepalive-merge` (an existing file, after an upgrade or to repair
  it; without a file, a warning pointing to install) and
  `cache-keepalive-configure` (shows the settings and their problems, or
  previews a change from plain words and writes it after confirmation). The
  CLI and the schema moved to `skills/cache-keepalive-configure/templates/`;
  its `install` and `merge` modes are separate, and its write mode is
  internal, never a user command.
- **Messages.** `settings.ts`, `NULL_IN_FILE`: the fix it names is
  `/ai-dlc:cache-keepalive-merge`.
- **README.** The settings commands are the three new ones. No test in this
  folder changed: `tests/keepalive.test.ts` reads the message from `NULL_IN_FILE`.

Made by Rafsanul Hasan, 2026-10-23 (run AAW-20261023-keepalive-cleanup-sync):

- **README.** *When the pings stop* says that writing a track's
  `keepWarmFor` recomputes its `maxPings` even when the keep-warm time is
  unchanged, overwriting a lower hand-set limit, and that naming `maxPings`
  in the same change keeps it. No code in this folder changed.

Made by Rafsanul Hasan, 2026-10-23 (run AAW-20261023-lens-plugin-from-spike, step 1.3; spike 028's
provider, `spike028-ka`, moved into this folder):

- **Published state.** `keepalive.ts` publishes the tracks as the `$.state`
  value `{ plugin: 'ai-dlc', key: 'keepalive' }`: `{ enabled, updatedAt,
  sessionId, tracks }`, each track with `name`, `running`, `armedAt`,
  `warmUntil`, `nextPingAt`, `pingEvery`, `keepWarmMs`, `pings`, `cap` and
  `line`. `render` publishes on every status change, and `turn.start`, the
  Stop with keep-alive turned off and `session.end` publish too, whether or
  not the status line is shown. Writes are chained so they land in order; a
  failed write goes to the debug log only. To say when the next ping is due,
  a track keeps `nextPingAt` (set by `arm`, which now takes the time the timer
  is set, cleared by `stopTrack`) and `keep`, the keep-warm time last worked
  out for it. After a ping, the track is re-armed before the render, after
  one more `$.clock.now()` and generation check. No ping, limit or stop
  decision changed.
- **Contract.** New `../../types/index.d.ts` declares
  `PluginState['ai-dlc'].keepalive`; `ai-dlc`'s `plugin.json` gains
  `"types": "./types/index.d.ts"`. Neither reaches the Copilot plugin (the
  build's manifest is an allow-list, and `types/` is not copied).
- **README.** New section *State for other plugins*.
- **Tests.** `tests/keepalive.test.ts`: the test engine records each
  `state.set` of that value; new block *the published state (read by
  ai-dlc-lens)*, seven tests (arming, a ping, a stopped track, a new turn and
  the session ending, status line off, keep-alive off, nothing published
  without background work).

Made by Rafsanul Hasan, 2026-10-23 (run FEAT-20261020-ai-dlc-lens, work item 28, step 28.1; from
code review 21.1):

- **The published keep-warm time is the one in force.** `keepalive.ts`: a
  track's `keep` was set only at arming and at each ping, so a stopped or
  reset track went on publishing the last `/ai-dlc:cache-keepalive`
  override's `keepWarmMs` (and the `cap` it lifted) after that override was
  cleared or its session ended, and a track never armed published its
  setting even while an override stood. New `refreshKeep` re-reads the
  keep-warm time of every track that is not running, the one its next arming
  would take, at `turn.start`, at `session.end` and after the command sets or
  clears an override, then publishes. `stopTrack` is unchanged: `arm` calls
  it before every arming. A running track is left alone: its tick reads the
  time again before each ping, and a change made while it runs takes effect
  at that ping (README), so it publishes the new time then. A track armed
  while `refreshKeep` waits on the store is left alone (its generation moved
  on); a store that cannot be read publishes the setting and says so in the
  debug log. `keepWarm` gains `{ session: false }`: this session's override
  is left out and nothing is warned, the time an ended session leaves in
  force. A session's override still outlives its turns; only the end of the
  session drops it from what is published. No ping, limit or stop decision
  changed.
- **Tests.** `tests/keepalive.test.ts`: the test engine answers `state.get`
  of that value with the last write; new block *the published keep-warm
  time*, nine tests (re-arming after a ping and after a second Stop, a track
  stopped while the override stands, a clear while stopped, a new turn with a
  session override and on a track never armed, a new turn reading a machine
  override, the session ending, an override set while a track runs, a reader
  plugin's `$.state.get`, a store that cannot be read).

Made by Rafsanul Hasan, 2026-10-23 (run FEAT-20261020-ai-dlc-lens, work item 28, step 28.1.l1; the
human's answer to 28.1's open questions, "re-read each turn"):

- **Settings re-read at every new turn.** `keepalive.ts`: `turn.start` now
  reads the settings again (`load` with `atTurn`: the env of
  `.claude/settings.local.json` and `.claude/settings.json` and
  `.ai-dlc/cache-keepalive.json`, with the same precedence and trust rules
  as at a Stop) before `refreshKeep` re-reads the overrides, then publishes.
  A fresh session publishes its real settings from its first turn, and a
  machine override another session changed is published at this session's
  next turn. Nothing is read while the session is idle (no polling). At a
  turn, a settings file that is not valid JSON or not an object, or a read
  that fails, keeps the settings last read (the defaults when none was read
  yet) and goes to the debug log; nothing is warned in the transcript, and
  the other problems (an invalid value, a setting skipped in an untrusted
  folder) are left to the next Stop or command, which warn as before. A
  Stop or command still reads as before. A running track is untouched: no
  track runs during a turn. No ping, limit or stop decision changed.
- **Tests.** `tests/keepalive.test.ts`: the test engine returns its
  `files`, takes a shared `storeMap` and counts `fs.read` and `store.get`
  calls; new block *settings re-read at each new turn*, six tests (a fresh
  session's first turn, also after a file changes; keep-alive turned off in
  a file; a machine override written by another session, published at the
  next turn and not before; a broken file at a turn; a broken file at the
  first turn; nothing read or published while idle).

Made by Rafsanul Hasan, 2026-10-23 (run FEAT-20261020-ai-dlc-lens, work item 28, step 28.1.l2; the
human's answer to 28.1.l1's open questions, "cache it"):

- **The turn read reads only what changed.** `keepalive.ts`: `load` with
  `atTurn` now reads through a turn cache. Each settings file
  (`.claude/settings.local.json`, `.claude/settings.json`,
  `.ai-dlc/cache-keepalive.json`) is stat-ed at every turn and read again
  only when its size or modified time changed (a missing file that stays
  missing is not read again). The repository root and the trust target come
  from git once per working directory: they are dropped when the session's
  working directory changes, at `session.end` and at every full read, so a
  turn is never behind the last full read, which runs git itself; nothing
  cheaper than the `rev-parse` signals a `git init` or a moved worktree.
  Claude Code's trust answer is kept with the size and modified time of
  `~/.claude.json`, stat-ed at each turn that needs it (only when a
  trust-gated setting differs from its default) and read again when it
  changed, because trust fails closed and a trust withdrawn there must count
  at the next turn. A Stop and `/ai-dlc:cache-keepalive` read every file,
  run git and ask trust in full as before, with their warnings and
  fall-through unchanged. An unchanged broken file still keeps the settings
  last read and logs at every turn. Two edits in one modified-time tick that
  leave the size the same go unseen until the next full read. The machine
  override is still read from the store at every turn (`refreshKeep`).
- **Tests.** `tests/keepalive.test.ts`: the test engine answers `fs.stat`
  (size, and a modified time that moves at each write a test makes through
  `files`, exposed as `mtimes`), records each `fs.read` and `fs.stat` path
  and takes a `cwd` that can move; new block *the turn read reads only what
  changed*, ten tests (an unchanged file read once over three turns and git
  run once; a size change; a modified-time change at the same size; an edit
  keeping both, seen at the next Stop; a file created and deleted; an
  unchanged broken file, read once and logged at each turn; a Stop and the
  command reading in full and the next turn running git once again; a
  changed working directory; the trust answer reused, then withdrawn in
  `~/.claude.json`; a new session after `session.end`).

Made by Rafsanul Hasan, 2026-10-23 (run FEAT-20261020-ai-dlc-lens, work item 28, step 28.1.l3; code
review round 1, hand-backs 28.4 and 28.5):

- **A file that stats but cannot be read is not absent.** `keepalive.ts`:
  at a turn, `cachedRead` no longer caches a failed read of a path that
  stats as a file (a lock or a transient error while an editor saves it);
  it throws, so `load` counts it as a failure and the turn keeps the
  settings last read, logging to the debug log only, as for a broken file.
  The next turn reads it again. `turnTrust` does the same for
  `~/.claude.json`, instead of caching the fail-closed answer. A path that
  stats as a folder still reads as absent; a full read (a Stop, the
  command) is unchanged.
- **The keep-warm time published after a full read is the one in force.**
  The Stop (each branch: keep-alive off, overage, and the tracks that do not
  arm), the command and `showSeedCache` call `refreshKeep` after `load`, and
  the command and `showSeedCache` publish.
- **A track that stops re-reads its keep-warm time.** `end()` (expired, kept
  warm, missed, the ping limit, an error) is async and calls `refreshKeep`
  before it renders; so do the spend limit, the Stop's "work done", the
  Stop's and `session.measure`'s overage stops, and `stopForHandoff`, which
  answers at once and re-reads in the background (`republishKeep`, which
  publishes only when no track was stopped or armed meanwhile).
- **One source for a running track's `pingEvery` and limit.** `arm` keeps the
  settings it took on the track (`cfg`); the published state and the status
  line of a running track use them (`cfgOf`), so they match what its tick
  uses until it arms again. The line is written after `arm`.
- **Smaller fixes.** `publish` ends its chain with a second catch, so a
  failing debug log cannot stop every later write. `turnRoot` and the trust
  target keep git's answer only in the turn cache they asked for, through a
  local, after the await. A comment at `turnTrust`'s getter says why
  `trustGate` uses the cached answer. The command's reply to a duration or
  `clear` says, for a running track, that it takes the new time at its next
  ping.
- **Tests.** `tests/keepalive.test.ts`: the test engine takes `failRead` (paths
  that stat but fail to read) and `failStateSets`; new block *[28.1.l3]
  review fixes*, twelve tests (a settings file and `~/.claude.json` that
  cannot be read at a turn; `trustGate` using the turn cache; the time
  published after a Stop, a Stop with keep-alive off and the ping command;
  an override cleared while a track runs, then the track expiring, missing
  and the work done; the command reply with and without a running track; a
  running track's `pingEvery`; a failed state write).

Made by Rafsanul Hasan, 2026-10-25 (run FEAT-20261020-ai-dlc-lens, feature root 17, step 17.2,
task T17.1 / ITEM-032; spec and LLD `keepalive-cache-status`):

- **The cache ledger.** New file `cache-state.ts`, pure and engine-free: one
  entry per source (`main` or a subagent's id) and cache lifetime, each
  saying until when that cache is warm (`observe`, `observePing`,
  `seedMain`, `cacheView`, `armUntil` for main, `isEmpty`), and the line
  pieces `hhmm` (the former `until`), `reasonText`, `cachePart` and
  `lineOf`. A read refreshes the 5m entry only when it can only be a 5m read
  (the 5m entry is warm, the response wrote no 1h tokens, no 1h entry is
  warm) and never moves a 1h entry; a landed 5m ping refreshes the 5m entry
  whatever else exists, a landed 1h ping moves the 1h entry only when it
  wrote 1h tokens.
- **The ledger replaces the last split.** `keepalive.ts`: `lastSplit` is
  gone. `noteUsage($, usage)` records each main-conversation response at the
  clock's time; each ping's usage is recorded too. At a Stop, a track arms
  only from a warm main entry of its lifetime, warm until that entry's time,
  so a later 1h write no longer switches the 5m track off, and an expired
  cache no longer arms. With no usage seen, the transcript's last write
  seeds main from its row's `timestamp` (`splitFromTranscript` and
  `transcriptSplit` now return `{ split, at? }`). The ledger is cleared at
  `session.end` and before a handoff, not at a turn start.
- **`Track.part`.** A track keeps the text after `keepalive <track>: `; the
  line is built when shown (`lineFor`). The rendered and published text is
  unchanged: the cache part joins the line with T17.2.
- **`../auto-handoff/register.tsx`.** Awaits `noteUsage($, usage)` for main
  usage only, as before, through `orLog`; the seed line reads `.split`.
- **Tests.** New `tests/cache-state.test.ts` (the pure table: AC-17.1.1,
  17.1.3, 17.1.4, 17.1.5, 17.3.4, the landed ping, the transcript seed, D2a,
  the reason texts). `tests/keepalive.test.ts`: the transcript split with
  its row time, and a block *[T17.1] the cache ledger arms the tracks* (the
  same ACs at a Stop with background tasks, through `turn.step` usage and
  the mock clock).
- **Arming after landed pings** (clarify round 1, step 17.2.l1.1; LLD 3.1
  and 3.4). A track keeps `pingWarmUntil`, its last landed ping's time
  plus its ttl. A Stop arms the track until the later of the ledger's
  time and `pingWarmUntil` while that is still ahead, so a 1h track whose
  landed pings wrote no 1h tokens is no longer ended as expired at its
  first tick after the next Stop. The ledger and the cache part do not
  read it. It is cleared when the track ends as expired, missed or with
  an error, at `session.end` and before a handoff. The test pinned as
  *[pending LLD clarify]* now checks the new rule, under a name that
  cites the LLD; the test engine's `cacheRead` may be a function, so a
  test can miss a ping after earlier pings landed.
