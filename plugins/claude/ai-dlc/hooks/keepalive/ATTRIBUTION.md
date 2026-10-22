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
- **`.ai-dlc/cache-keepalive.json` from init.** `/ai-dlc:init` creates it with
  every key unset except `oneHour.keepWarmFor` and `scope`, and merges it on a
  re-run, through the new `cache-keepalive-config` skill
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
