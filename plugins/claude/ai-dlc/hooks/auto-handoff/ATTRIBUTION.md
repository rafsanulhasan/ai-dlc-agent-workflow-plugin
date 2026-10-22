# Attribution

This hooks module is a modified copy of `auto-handoff` by Alex Hillman,
incorporated into the `ai-dlc` plugin under the MIT License. It is no longer a
separate plugin. The original copyright and permission notice is in
[LICENSE](LICENSE). Its `keepalive/` folder has another upstream, the
`cache-keepalive` mod, and its own `LICENSE`; see *cache-keepalive* below.

| Field | Value |
| --- | --- |
| Upstream | <https://github.com/alexknowshtml/claude-auto-handoff> |
| Commit | `8d762ce726c962268e2dbe24c1c60f0889a2fcde` |
| Version | 0.8.6 |
| Vendored | 2026-10-21, as `plugins/claude-mods/auto-handoff/` |
| Incorporated | 2026-10-21, as `plugins/claude/ai-dlc/hooks/auto-handoff/` |

## What was copied

`hooks/*.ts(x)` (now this folder's root), `templates/`, `statusline/`,
`tests/` and `LICENSE`. Not copied: `.git/`, `docs/` (the demo GIF and video),
`README.md`, `.gitignore` and `.claude-plugin/plugin.json`.

## Modifications

Made by Rafsanul Hasan, 2026-10-21:

- **Viewer server off by default.** The `viewer` option's default changed from
  `tailscale:3846` to blank in `DEFAULTS` in `config.ts` and in the manifest,
  so the module does not start a local web server unless the user sets an
  address in `/config`. The briefs are still written as files and linked by
  path. In `tests/auto-handoff.test.tsx`, the two tests that check the served
  viewer link set `viewer: 'tailscale:3846'` explicitly, as the old default did.
- **Part of ai-dlc.** The module moved into the `ai-dlc` plugin:
  `hooks/hooks.json` lists `./auto-handoff/register.tsx`, the six `userConfig`
  options moved into `ai-dlc`'s `.claude-plugin/plugin.json` (same keys and
  defaults; titles prefixed `Auto-handoff:`), and the shipped templates are read
  from `hooks/auto-handoff/templates/` (`MODULE_DIR` in `config.ts`). The tests
  name the plugin `ai-dlc` and import from `../`.
- **One handoff with the `handoff` skill.** New `run.ts` and
  `templates/session-handoff.md`. When the repository has an `active` AI-DLC
  run on the current branch, the brief is the `handoff` skill's session handoff:
  Haiku writes that template's sections, the module writes the result to
  `<scratch root>/<run folder>/session-<YYYYMMDD-HHMM>.md`, points the run's
  `run.md` *Next action* at it before `/clear`, and the seed tells the fresh
  session to resume the run. Without such a run the brief and seed are
  unchanged. `register.tsx` gained `git` and `activeRun`; tests in
  `tests/run.test.ts`, `tests/auto-handoff.test.tsx` ("ai-dlc run") and
  `tests/seed-row.test.tsx`.
- **Which run.** `pickRun` in `run.ts` takes the `active` run on the current
  branch whose `session` is this session's id (the newest `updated` of
  several); else the one active run on the branch when no session claimed it
  (`session` empty); else no run, so the plain brief. It never takes a run
  another session wrote, or one of several unclaimed runs.
- **Run lookup and run.md write.** `activeRun` in `register.tsx` reads the
  candidate `run.md` files in parallel. The session handoff is written before
  `run.md` is read and rewritten, so `run.md` never points at a missing file;
  each step is named in the log, and a failure after the first step logs the
  session handoff it left unlinked, then seeds the brief.
- **Input checks in `run.ts`.** `handoffsRoot` falls back to `docs/handoffs`
  when `artifacts.handoffs` has a `..` segment. `withNextAction` recognises a
  Next action it wrote by the whole leading sentence (`WRITTEN_HERE`), not by
  the `AUTO_MARK` phrase alone.
- **Constants in `config.ts`.** `MODULE_DIR` (`hooks/auto-handoff`, where the
  shipped templates are read from inside the plugin) and `SESSION_TEMPLATE`
  (`session-handoff.md`).
- **Seed wording.** With a run, the seed line in `register.tsx` names the
  session handoff and tells the fresh session to resume the run from its
  `run.md`. Without one it is the upstream wording.
- **PRIORITY line.** `templates/instructions.md` (and the test fixture)
  say "The last request from the user, in its section below" instead of
  quoting the brief's title-case heading, so the line fits both the brief and
  the session handoff, whose heading is sentence case.
- **TypeScript config.** `tsconfig.json` extends
  `../../.claude-plugin/types/tsconfig.json`, local mods API types for editors
  next to the `ai-dlc` manifest. The repository's `.gitignore` ignores
  `plugins/claude/ai-dlc/.claude-plugin/types/`, so they are never committed.
- **Threshold as a percentage of the context window.** The token option
  `threshold` (default 160000) is retired. Its replacement, `thresholdPercent`
  (number, 1 to 100, default 80), uses a new key so a stored 160000 is never
  read as a percent. `config.ts` clamps it to 1..100 (0, negative or
  non-numeric values give 80) and adds `windowOf`, `contextLine` and
  `DEFAULT_WINDOW` (500000). In `register.tsx`, `configured` turns the
  percentage into a token line: `thresholdPercent` of the window that
  `$.session.usage().context` reports (`window`, else derived from `percent`
  and `tokens`, else 500000, logged once; field shapes from the mods types,
  not yet checked on a live 1M session). The comparisons, including the
  projected size and the seeded-session headroom guard, stay in tokens.
  `AUTO_HANDOFF_TOKENS` stays, as an absolute token count that overrides the
  percentage (superseded 2026-10-22: no longer read; `thresholdTokens`, or
  `AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS`, replaces it). The threshold source reads, for example,
  `80% of the 1000k window, thresholdPercent in /config` on a 1M window. Still main or lead
  session only: every hook skips events with an `agentId`. The stale comment
  naming `HANDOFF_ARM_TOKENS` in `context-warning.ts` is gone. Tests in
  `tests/auto-handoff.test.tsx`: the test engine takes a `window` (or none) and
  a `percent`; new tests cover the default line, the option, the retired key,
  a 1M window, the derived window, the fallback, the env override and the
  clamp; the headroom warning test uses `thresholdPercent: 30`.
- **Percentage tests, review round 1.** `tests/auto-handoff.test.tsx` adds a
  non-numeric `AUTO_HANDOFF_TOKENS` (superseded 2026-10-22, see below) falling back to the percentage, the line at
  `thresholdPercent` 100, `windowOf` with a zero or negative window, `contextLine`
  rounding down, and the logged line in tokens at the default.
- **Fallback window, review round 2.** The one-time log line for a missing
  window now names the token line and its consequence:
  `no context window reported: thresholdPercent applies to 500000, a line of
  400000 tokens; if the real window is smaller than 400000, no handoff fires:
  set AUTO_HANDOFF_TOKENS to an absolute token count` (at the default 80%).
  The fallback test pins the full text. The comment on `configured` names the
  missing window as a use of `AUTO_HANDOFF_TOKENS`, and `parseConfig`'s
  return object is re-indented. (Superseded 2026-10-22: the line now ends
  `set thresholdTokens (AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS) to an absolute
  token count`, and the 500000 is `defaultContextWindow`.)
- **Fallback log test, SQA review round 2.** `tests/auto-handoff.test.tsx` adds a
  test that the fallback log line follows `thresholdPercent` (50% gives a line of
  250000 tokens).
- **README not carried.** The settings, environment variables and status line
  are documented in the `ai-dlc` README ("Automatic session handoff") and the
  `handoff` skill (*Session handoff*).

Made by Rafsanul Hasan, 2026-10-22 (run `AAW-20261022-auto-handoff-chain`):

- **Chain while the run is active.** Upstream's `unattended` guard stopped every
  chain after `maxConsecutiveHandoffs` handoffs, because the seed prompt never
  counts as the user's. `chainGuard` in `register.tsx` now lets the run state
  decide: while the run the chain hands off is `active` and belongs to the
  chain, there is no cap; when the run this chain claimed becomes `done`,
  `blocked` or `abandoned`, the chain ends (logged as `run <id> is <status>:
  chain ends`, with a sticky panel); with no such run, the old guard applies.
  `unattended` is still counted. The seed handler records the run as
  `chainRun:<new session>` in the store, and `pickRun` in `run.ts` also accepts
  a run whose `session` is an earlier session of the chain (the lineage) or the
  claimed run while its `session` is empty. `activeRun` became `runLookup`.
- **Open handoff records.** `run.ts` gained `parseStages`, `isOpen`, `pairOf`,
  `openRecords` and `recordsSection`. The session handoff gets a `## Handoff
  records` section built in code: `run.md`, the session handoff, then the
  records of every *Stages* row not `done` or `skipped`, `last-record` and its
  pair first; files not on disk are marked `(missing)`. The seed line names it.
- **Session names.** Each session of a chain is named
  `<sessionNamePrefix>: <original name> (Session N)`. The original name comes
  from the classic SessionStart / UserPromptSubmit `session_title`, else the
  transcript's last `custom-title`, else its `ai-title`, else the short id; it
  is carried in the lineage record (`baseName`) and any wrapper is stripped
  (`baseName` in `config.ts`), so names never nest. The old session is renamed
  with `$.command.run({ command: 'rename' })` before `/clear`, only when
  `$.command.list()` includes `rename`; the seeded session's name is the
  `sessionTitle` of the classic SessionStart answer. Failures are logged and
  never block the handoff. Open runtime checks, not provable in unit tests:
  whether Claude Code honours `sessionTitle` returned by a hooks module, and
  whether `/rename` exists and renames the current session when a hook runs it.
- **Capabilities record.** At each startup or resume (and once per process),
  the module writes `~/.claude/state/auto-handoff/capabilities.json` with the
  engine version and whether `/rename` is listed, for `/ai-dlc:init` and
  `/ai-dlc:configure-auto-handoff` to read.
- **Repository configuration.** `config.ts` has a `SETTINGS` table (13 keys,
  each with an `AI_DLC_AUTO_HANDOFF_*` variable) and `resolveConfig`: per key,
  `env` of `.claude/settings.local.json`, `env` of `.claude/settings.json`
  (both read from the files, JSONC allowed), the process environment,
  `.ai-dlc/auto-handoff.json`, the `userConfig` from `/config`, then the
  default. Invalid values are logged and fall through; settings reload at each
  session start. New keys: `enabled` (replaces `AUTO_HANDOFF_DISABLE`),
  `thresholdTokens` (replaces `AUTO_HANDOFF_TOKENS`), `defaultContextWindow`
  and `seedHeadroomTokens` (were the constants `DEFAULT_WINDOW` and
  `MIN_HEADROOM`, now the defaults), `chainWhileRunActive`, `renameSessions`,
  `sessionNamePrefix`. The old `AUTO_HANDOFF_*` names are no longer read.
  `DISABLE_AUTO_COMPACT` is still honoured. The schema and the CLI that writes
  the file ship with the new `configure-auto-handoff` skill.
- **Tests.** The test engine's `command.run` branches on the command and gains
  `command.list` and `session.version`; new tests in
  `tests/auto-handoff.test.tsx` (chain, records, session names, configuration),
  `tests/run.test.ts` (lineage, stages, records) and the new
  `tests/config.test.ts`.

Made by Rafsanul Hasan, 2026-10-22, code review round (run
`AAW-20261022-auto-handoff-chain`, step 2.l2):

- **Workspace trust for the repository file.** `.ai-dlc/auto-handoff.json` is
  committed, and Claude Code's trust dialog does not cover it. `config.ts`
  gained `TRUST_GATED` (`briefTemplate`, `instructionsTemplate`, `viewer`),
  `trustOf`, `trustRoot`, `normPath` and `withoutGated`; `loadConfig` in
  `register.tsx` passes the file's values through `trustGated`. When one of
  the three keys is set there, the module reads `~/.claude.json` (only its
  `projects[...].hasTrustDialogAccepted` flag is used; nothing else is logged
  or kept) and applies the three keys only when the flag is exactly `true` for
  the repository root (a linked worktree: the main checkout's root, from `git
  rev-parse --path-format=absolute --git-common-dir`; a nested repository: its
  own root) or, outside a repository, for the working directory or a folder
  above it. Keys are compared ignoring case, `\` against `/` and a trailing
  slash. It fails closed: no file, bad JSON, no entry or a non-`true` value
  skip the three keys with one log line naming them; every other key of the
  file still applies. Settings `env`, the process environment and `/config`
  are not gated. Unverified: whether `CLAUDE_CONFIG_DIR` moves `.claude.json`
  (the module always reads the home directory's, so a moved file reads as
  untrusted), and how other machines spell the keys (this one: forward slashes
  and a lowercase drive letter, matched by the normalisation).
- **Viewer address checked.** `parseAddress` in `server.ts` now takes a port
  of 10 to 65535 with no leading zero, and `check` in `config.ts` accepts a
  `viewer` only when it is blank or `host:port`; anything else is logged and
  falls through, instead of silently starting no server. The CLI applies the
  same rule (schema `format: host-port`).
- **`/config` warnings.** `parseConfig` became `parseUserConfig`, which also
  returns a warning per `/config` value it clamps or drops; `resolveConfig`
  logs it when `/config` is the level used for that key. `parseConfig` stays,
  returning the settings alone.
- **One run lookup per attempt.** `chainGuard` takes the lookup as a function
  and returns what it found; `tryHandoff` passes that to `handoff`, which no
  longer looks again. `canHandOff` on the tool gate uses `cachedLookup`: one
  lookup, shared while running, for two seconds, dropped at each turn end,
  typed prompt and session start.
- **`handoff()` split.** `composeBrief` (Haiku and the brief's text),
  `writeRunHandoff` (the session handoff, then `run.md`) and `queueClear` were
  extracted; behaviour is unchanged.
- **Rename before clear.** `renameOld` now awaits the `/rename` (a queued
  command resolves once it has run) before the `/clear` is queued, so the two
  run in order; a rename still pending after 10 seconds is logged and the
  `/clear` goes ahead.
- **Settings reload.** At each SessionStart, `reloadConfig` waits for a load
  already in flight and then loads again, instead of reusing a load that read
  the files before the session started.
- **Tidying.** The unreachable `return undefined` after `check`'s switch and
  stray blank lines in `register.tsx` are gone.
- **Tests.** `tests/config.test.ts`: trust matching (case, separators,
  trailing slash, drive letter, nested repository, parent-only trust outside a
  repository, missing file, bad JSON, non-boolean), `trustRoot`, the address
  rule and the `/config` warnings. `tests/auto-handoff.test.tsx`: the test
  engine answers `--git-common-dir` and counts run lookups; new tests for an
  untrusted, a non-`true`, a trusted and a worktree folder, and for one lookup
  per handoff and per burst of gated tool calls.
- **Prototype keys.** `check` looks a boolean word up in `BOOLS` with
  `Object.hasOwn`, so `constructor` and `__proto__` are invalid (as in the
  CLI) instead of resolving to `Object.prototype` members. `renderTemplate`
  likewise treats a `{{#name}}` that is not an own flag as unset.

Made by Rafsanul Hasan, 2026-10-22 (run `AAW-20261022-window-observability`):

- **Window in the threshold log line.** The per-turn line now names the
  window the threshold was computed from, where it came from, and the basis:
  `threshold session=<id> tokens=<n> threshold=<n> window=<n|none>
  windowSource=<host|host-percent|default|none> basis=<thresholdPercent:<n>|thresholdTokens>
  via=<trigger>`. `via` stays last because it can hold spaces. `config.ts`
  gained `windowInfo` (the window and its source; `windowOf` now wraps it) and
  `windowFields` (the three fields). In `register.tsx`, `contextWindow` keeps
  the window it used in `lastWindow` and `configured` clears it first, so under
  `thresholdTokens`, where no window is read, the line says `window=none
  windowSource=none basis=thresholdTokens`; `windowFields` adds no usage call.
- **Fallback log line corrected.** The one-time `no context window reported`
  line said `no handoff fires` when the real window is smaller than the line.
  The `session.compact` handler hands off in place of Claude Code's
  auto-compact whatever the threshold, so the line now ends `if the real window
  is smaller than <line>, the handoff waits for auto-compact: set
  thresholdTokens (AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS) to an absolute token
  count`. The two tests that pin it follow.
- **Tests.** `tests/auto-handoff.test.tsx` adds the line's fields for a window
  the host reports, one derived from its percentage, the default window and
  `thresholdTokens`, that `via` stays last, and unit tests of `windowInfo` and
  `windowFields`.
- **Claude Code's own window fields** (fix round 1). The line gains
  `hostWindowSource=<source|none> autoCompactThreshold=<n|none>` between
  `basis` and `via`: Claude Code's `autocompactSource` (how it settled the
  window it compacts against) and `autoCompactThreshold`, read from
  `$.session.usage({ breakdown: 'summary' }).context.breakdown`. `summary`
  estimates locally (`full` would send token-count requests). `register.tsx`
  gained `hostWindow`, called only in `tryHandoff` when the line is written,
  never per turn; a missing breakdown, a missing field or a failed call logs
  `none` and the handoff goes on. `config.ts` gained `HostWindow` and
  `hostFields`, which also logs `none` for a value of the wrong type or one
  that would put a space in the line. The test engine's `session.usage` mock
  now records each call's args and can return a breakdown or throw; the
  existing threshold-line tests take the two fields, and five tests cover a
  breakdown with both fields, with neither, a call that throws, a single
  `summary` request made only when the line is written, and `hostFields`.

Made by Rafsanul Hasan, 2026-10-22 (run `AAW-20261022-fold-cache-keepalive`):

- **Keep-alive folded in.** The `cache-keepalive` mod (section
  *cache-keepalive* below) is now part of this module, in `keepalive/`.
  `register` calls `registerKeepalive` from `keepalive/keepalive.ts`, so
  `hooks/hooks.json` still lists one module, and the mod is no longer a
  separate plugin or a dependency of `ai-dlc`.
- **Shared helpers in `io.ts`.** `homeDir`, `log`, `readText`, `readRaw`,
  `repoRoot`, `git`, `trustTarget` and the new `folderTrust` moved out of
  `register.tsx` into `io.ts`, as function declarations, so keep-alive calls
  them directly: `claude plugin validate` follows `$` past an import only into
  a function declaration, and never through a property. `trustGated` uses
  `folderTrust`. Behaviour is unchanged.
- **Keep-alive stops before the handoff.** `tryHandoff` stops every keep-alive
  timer when a handoff starts, and `handoff` again just before it queues the
  `/clear` (module timers survive `/clear`), each time logging
  `keepalive timers stopped ...` when one was running. Keep-alive arms no
  pings while a handoff is under way.
- **The seed turn and the cache.** The `floor` log line of the seed turn's
  first request now ends with `input_tokens=<n> cache_read_input_tokens=<n>
  cache_creation_input_tokens=<n> cache_creation_1h=<n|none>
  cache_creation_5m=<n|none> cache=<hit|miss>`, and the handed-off panel adds
  a line `cache hit: <n> read, <n> written (1h <n>, 5m <n>)` or
  `cache miss: nothing read, ...`. The 1h/5m split comes from the response's
  usage when it carries `cache_creation`, else from the new session's
  transcript. `config.ts` gained `creationSplit`, `SeedCache`,
  `seedCacheFields` and `seedCacheLine`. Every main-conversation response's
  usage is also handed to keep-alive (`noteUsage`), whose tracks follow the
  split. The header comment of `register.tsx` records why the handoff keeps
  the shared prefix stable (same model and effort; the brief and the seed as
  messages only).
- **Tests.** `tests/auto-handoff.test.tsx` adds: the keep-alive timers stopped
  (and shown as `handed off, stopped`) before the `/clear`, with no ping after
  it; no ping armed during a handoff; the seed turn's cache fields and panel
  line; and unit tests of the new `config.ts` functions.

Made by Rafsanul Hasan, 2026-10-22 (run `AAW-20261022-fold-cache-keepalive`,
review round 1):

- **One trust gate.** `register.tsx`'s own `trustGated` is gone: the
  repository file goes through `trustGate` in `io.ts`, shared with keep-alive,
  which reads `~/.claude.json` once per load and only when a gated key is set.
  It takes the keys out through the new `config.ts` `withoutKeys`, which also
  reads nested keys (`oneHour.keepWarmFor`) and never changes its input;
  `withoutGated` is now `withoutKeys` over `TRUST_GATED`. The log line is
  unchanged.
- **One boolean parser.** `config.ts` gained `parseBool`, used by its own
  `check` and by keep-alive's `settings.ts`; both accept the same words as
  before. The number parsers stay apart: this module takes whole numbers
  only, keep-alive takes fractions.
- **The seed turn on the status line.** Beside the panel line and the log
  line, the seed turn calls keep-alive's `showSeedCache`, which shows
  `keepalive seed: cache hit, <n>k read` or `keepalive seed: cache miss` on
  the status line until the next turn starts.
- **Tests.** `tests/auto-handoff.test.tsx` adds: no ping armed by a Stop while
  the brief is being written (the test engine can now hold the brief's model
  call) or while the `/clear` waits for its seed, and one armed once the
  handoff is over; the seed line on the status, under the track lines after a
  Stop and gone after the next turn starts; a miss; and none with keep-alive's
  status off. The engine's `stepUsage` can now report a read of its choosing
  (`stepRead`).

## cache-keepalive

`keepalive/` is a modified copy of `cache-keepalive` by RichardJSun,
incorporated into this module under the MIT License. The original copyright
and permission notice is in [keepalive/LICENSE](keepalive/LICENSE).

| Field | Value |
| --- | --- |
| Upstream | <https://github.com/RichardJSun/claude-code-mods> (`plugins/cache-keepalive`) |
| Commit | `6135ec5574609c9fcd865f517c24990d5f37321b` |
| Version | 0.2.5 |
| Vendored | 2026-10-21, as `plugins/claude-mods/cache-keepalive/` |
| Incorporated | 2026-10-22, as `plugins/claude/ai-dlc/hooks/auto-handoff/keepalive/` |

### What was copied

`plugins/cache-keepalive/` from the upstream repository (`hooks/register.ts`,
now `keepalive/keepalive.ts`; `hooks/register.test.ts`, now
`tests/keepalive.test.ts`; `.claude-plugin/plugin.json`, whose options are now
rows of `ai-dlc`'s manifest), and `LICENSE` and `README.md` from the upstream
repository root (now `keepalive/LICENSE` and `keepalive/README.md`). `LICENSE`
is unchanged. Not kept: `hooks/hooks.json`, `tsconfig.json` and the vendoring
record `VENDORED.md`, whose history follows.

### Modifications

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
