# Attribution

This hooks module is a modified copy of `auto-handoff` by Alex Hillman,
incorporated into the `ai-dlc` plugin under the MIT License. It is no longer a
separate plugin. The original copyright and permission notice is in
[LICENSE](LICENSE).

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
  percentage. The threshold source reads, for example,
  `80% of the 1000k window, thresholdPercent in /config` on a 1M window. Still main or lead
  session only: every hook skips events with an `agentId`. The stale comment
  naming `HANDOFF_ARM_TOKENS` in `context-warning.ts` is gone. Tests in
  `tests/auto-handoff.test.tsx`: the test engine takes a `window` (or none) and
  a `percent`; new tests cover the default line, the option, the retired key,
  a 1M window, the derived window, the fallback, the env override and the
  clamp; the headroom warning test uses `thresholdPercent: 30`.
- **Percentage tests, review round 1.** `tests/auto-handoff.test.tsx` adds a
  non-numeric `AUTO_HANDOFF_TOKENS` falling back to the percentage, the line at
  `thresholdPercent` 100, `windowOf` with a zero or negative window, `contextLine`
  rounding down, and the logged line in tokens at the default.
- **Fallback window, review round 2.** The one-time log line for a missing
  window now names the token line and its consequence:
  `no context window reported: thresholdPercent applies to 500000, a line of
  400000 tokens; if the real window is smaller than 400000, no handoff fires:
  set AUTO_HANDOFF_TOKENS to an absolute token count` (at the default 80%).
  The fallback test pins the full text. The comment on `configured` names the
  missing window as a use of `AUTO_HANDOFF_TOKENS`, and `parseConfig`'s
  return object is re-indented.
- **Fallback log test, SQA review round 2.** `tests/auto-handoff.test.tsx` adds a
  test that the fallback log line follows `thresholdPercent` (50% gives a line of
  250000 tokens).
- **README not carried.** The settings, environment variables and status line
  are documented in the `ai-dlc` README ("Automatic session handoff") and the
  `handoff` skill (*Session handoff*).
