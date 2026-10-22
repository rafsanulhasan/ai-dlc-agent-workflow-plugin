# Attribution

This hooks module is a modified copy of `auto-handoff` by Alex Hillman,
incorporated into the `ai-dlc` plugin under the MIT License. It is no longer a
separate plugin. The original copyright and permission notice is in
[LICENSE](LICENSE). The module registers keep-alive, which has another
upstream, the `cache-keepalive` mod, and lives in its own folder,
`hooks/keepalive/`, with its own [LICENSE](../keepalive/LICENSE) and
[ATTRIBUTION.md](../keepalive/ATTRIBUTION.md).

The entries below are a history, each true when it was written. Those before
2026-10-23 (run AAW-20261022-cache-keepalive-init) describe `/config` rows
(the manifest's `userConfig`) as a settings level; those rows and that level
are gone, and the last entry says so.

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

- **Keep-alive folded in.** The `cache-keepalive` mod (its attribution now in
  `../keepalive/ATTRIBUTION.md`) is now part of this module, in `keepalive/`
  (since 2026-10-23 `hooks/keepalive/`, see below).
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

Made by Rafsanul Hasan, 2026-10-23 (run `AAW-20261023-keepalive-own-folder`):

- **Keep-alive in its own folder.** Keep-alive moved out of this module's
  folder to `hooks/keepalive/`, with its own `LICENSE` and `ATTRIBUTION.md`
  (the *cache-keepalive* section that was here). `register.tsx` imports it from
  `../keepalive/keepalive.ts` and still registers it, so `hooks/hooks.json`
  still lists one module and its behaviour is unchanged.
- **The seed line cannot break the seed turn.** `register.tsx` runs
  keep-alive's `showSeedCache` through the new `io.ts` `orLog`, which logs a
  throw (`keepalive seed line error ...`) instead of passing it on, so the
  tight-threshold check after it still runs.
- **Skipped values logged.** `io.ts` `trustGate` names each skipped setting
  with its value, through the new `config.ts` `keysWithValues` and
  `previewValue`: text in double quotes, white space folded, a value longer
  than 40 characters (`PREVIEW_CHARS`) cut with `…` and its length after it.
  Nothing is redacted, so a secret put in a gated setting shows its first 40
  characters in `~/.claude/state/auto-handoff/auto-handoff.log` (and, for
  keep-alive, in the transcript); documented in round 1, below. This also
  applies to `viewer` and the templates here
  (`briefTemplate="/repo/chosen.md", viewer="0.0.0.0:3846" in
  .ai-dlc/auto-handoff.json ignored: ...`).
- **Style.** `config.ts`: a space after `=` in `const whole = (v`.
- **Tests.** `tests/auto-handoff.test.tsx`: `orLog` logs a throw and passes
  nothing on; the trust warning checked with its values. `tests/config.test.ts`:
  `previewValue` and `keysWithValues`.

Made by Rafsanul Hasan, 2026-10-23 (same run, review round 1):

- **`previewValue` cuts on code points.** `config.ts` cuts the folded text
  with `Array.from`, so a character outside the Basic Multilingual Plane (an
  emoji) at the 40th place is kept whole instead of leaving a lone surrogate.
- **`(N chars)` is the folded length.** N is now the length, in characters
  (code points), of the folded text that was cut, not the raw value's UTF-16
  length; a value with runs of white space no longer shows a larger count.
  The doc comment says so and that the values are logged unredacted.
- **Docs.** The `configure-auto-handoff` skill's *Workspace trust* gives the
  warning's `key=value` format, says the line is written unredacted to
  `~/.claude/state/auto-handoff/auto-handoff.log` and not to put secrets in
  these settings; **show** names the keys without values. Logging the values
  is intended (asked for by the human on 2026-10-23).
- **Tests.** `tests/config.test.ts`: an emoji at the cut is kept whole, and N
  counts the folded text. `tests/auto-handoff.test.tsx`: a comment records why
  no test pins the `orLog` wrapper's call site in `register.tsx` (no fault can
  reach `showSeedCache` through the engine, and the test harness loads its own
  copy of the module, so a module-level seam a test sets never reaches it).

Made by Rafsanul Hasan, 2026-10-23 (run AAW-20261022-cache-keepalive-init):

- **Keep-alive.** `registerKeepalive` is called without the plugin options,
  since keep-alive has no `/config` rows any more, and the comment names its
  command `/ai-dlc:cache-keepalive`. See `../keepalive/ATTRIBUTION.md`, same
  run.
- **No `/config` rows** (human decision, 2026-10-23). The six rows
  (`thresholdPercent`, `maxConsecutiveHandoffs`, `briefTemplate`,
  `instructionsTemplate`, `ignoreFiles`, `viewer`) are gone from the plugin
  manifest, which now declares no `userConfig`. `config.ts`: `Setting` lost
  `userConfig`; `resolveConfig(levels)` takes no options; `parseUserConfig`
  and `parseConfig`, with their clamping and their `/config` warnings, are
  removed. `register.tsx` no longer reads the plugin options. Precedence:
  the `env` of `.claude/settings.local.json`, the `env` of
  `.claude/settings.json`, the process environment,
  `.ai-dlc/auto-handoff.json`, the default. A key skipped in an untrusted
  folder is pointed to `.claude/settings.local.json` only. `brief.ts`: the
  `thresholdSource` comment no longer names `/config`.
- **Commands.** The module registers no command of its own; it runs only
  Claude Code's built-in `/rename` and `/clear`, which keep their names. Its
  settings command stays `/ai-dlc:configure-auto-handoff`.
- **Tests.** `tests/config.test.ts`: the `/config` warning tests are replaced
  by one that no setting names a `userConfig` key; the precedence tests take
  no options. `tests/auto-handoff.test.tsx`: the tests that set a value
  through a plugin option set it through the process environment instead;
  the `parseConfig` clamping test is removed; a former `/config` row is shown
  not to be read (precedence, and the retired token threshold).

Made by Rafsanul Hasan, 2026-10-23 (same run, review follow-up):

- **Tests.** `tests/config.test.ts`: the "no setting has a userConfig key"
  check moved to `../keepalive/tests/keepalive.test.ts`, which now checks both
  settings tables, so `claude plugin test` holds one such check. No code in
  this folder changed.
