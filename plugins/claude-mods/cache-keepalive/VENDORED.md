# Vendored copy

This plugin is a modified copy of `cache-keepalive` by RichardJSun,
redistributed with the `ai-dlc` plugin under the MIT License. The original
copyright and permission notice is in [LICENSE](LICENSE).

| | |
|---|---|
| Upstream | https://github.com/RichardJSun/claude-code-mods (`plugins/cache-keepalive`) |
| Commit | `6135ec5574609c9fcd865f517c24990d5f37321b` |
| Version | 0.2.5 |
| Vendored | 2026-10-21 |

## What was copied

- `plugins/cache-keepalive/` from the upstream repository.
- `LICENSE` and `README.md` from the upstream repository root.

`LICENSE` is unchanged. The other files are changed as listed below.

## Modifications

Made by Rafsanul Hasan, 2026-10-21:

- **Keep-warm duration.** New `userConfig` option `keepWarmFor` in
  `.claude-plugin/plugin.json` (string, default `8h`, `<n>m`, `<n>h` or
  `<n>d`). In `hooks/register.ts`, `classic.Stop` records when it armed the
  pings, and the timer stops before a ping once that much time has passed
  (status `keepalive: kept warm <duration>, stopped`), alongside the upstream
  expiry, miss, budget and overage stops. An invalid value falls back to `8h`
  and is logged at `session.start`. The arm status line ends with
  `keep warm <duration>`.
- **`/keepalive <duration>`.** The `keepalive` command (invoked as
  `/keepalive`, no plugin prefix) reads its arguments: a duration sets an
  override, `clear` removes it, and `--session` or `--machine` picks the
  scope for that call. Without arguments it pings as upstream does, and its
  output also names the duration in force. The command is registered with a
  new description and an `argumentHint`.
- **Scope.** New `userConfig` option `keepaliveScope` (`session`, the
  default, or `machine`): the scope `/keepalive <duration>` uses without a
  flag. Session overrides are kept in the mod's `$.store` under
  `keepWarmFor:sessions`, by session id, the newest 20 only; the machine-wide
  override under `keepWarmFor:machine`. This session's override wins over the
  machine-wide one, which wins over `keepWarmFor`.
- **New file `hooks/duration.ts`.** The duration and argument parsers, free of
  the engine so the tests call them directly.
- **Tests.** `hooks/register.test.ts`: the test engine answers `session.id`
  and seeds the store (`mock.store`), so the compact-on-cap test no longer does
  that itself, and new tests cover the parsers, the duration stop, the
  `/config` values, the budget stopping first, and the command in both scopes.
- **Tests, review round 1.** `hooks/register.test.ts`: the test engine's session id may be a function; new tests cover `--clear` and flag case, `formatDuration`, no log for a valid `keepWarmFor`, an invalid `keepaliveScope`, an override set while armed, re-arming restarting the window, scope-isolated clears, malformed store values and the 20-override cap.
- **Accepted syntax.** Beyond `<n>m`, `<n>h` and `<n>d`: `n` may have a
  fraction (`1.5h`), units and flags are not case-sensitive, `--clear` is an
  alias of `clear`, and the store keeps at most 20 session overrides.
- **Review round 2.** A duration under 1m is refused (`0.4m` used to parse to
  24 s and print as `0m`); a second duration in one `/keepalive` call is the
  usage error `give one duration`. Since pings come every 50 minutes, a
  duration of 50m or less sends none; the timer now records whether it pinged since
  arming, and when the duration ends before the first ping the status reads
  `keepalive: no ping needed for <duration>, stopped` instead of
  `kept warm <duration>`. The `keepWarmFor` description, the `/keepalive`
  usage text and the README say so. Tests cover the 1m minimum, the two
  durations and the 50m-or-less status.
- **README.** New section "Keep-warm duration (added in this copy)" and one
  more stop condition in the list. The upstream text is otherwise unchanged.

`version` in `plugin.json` stays `0.2.5`, the upstream version these changes
are made on.
- **Tests, review round 2 (SQA).** `hooks/register.test.ts` adds: re-arming after a ping resets the `pinged` flag, a missed ping stops with `missed`, and `/keepalive` usage text states the 1m minimum and the 50-minute pings (plus `1m` accepted, `2h 3h` refused, through the command).
- **Review round 3.** The `keepWarmFor` description, the `/keepalive` usage
  text and the README now say a duration of 50m or less sends no ping (the
  timer also sends none at exactly 50m). The `/config` log for an invalid
  `keepWarmFor` states the 1m minimum. `parseCommandArgs` parses each word
  once. Tests cover a sub-1m `keepWarmFor` in `/config` and a 50m duration; the
  `/keepalive` usage test also asserts the "a duration of 50m or less sends none" wording.
