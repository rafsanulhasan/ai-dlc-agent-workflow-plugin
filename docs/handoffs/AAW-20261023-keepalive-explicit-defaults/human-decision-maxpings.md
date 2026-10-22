# Human decision (2026-10-23): how maxPings follows the keep-warm time
- 1h track: maxPings = keep-warm time ÷ 50 minutes (its pingEvery), rounded down.
- 5m track: maxPings = keep-warm time ÷ 3 minutes (its pingEvery), rounded down, the ping that falls on the limit included.
Applied by: init (install) for both tracks, and `/ai-dlc:cache-keepalive-config set` whenever a track's keepWarmFor is written without an explicit maxPings in the same call; the output lists the recomputed value. Resolves critique Blocker 1 (2.1).

# Human request (2026-10-23): list the commands for discoverability
Add a **Commands** section to the repository README (and point to it from docs/plugins.md) that lists every user-invocable `/ai-dlc:*` command: its name, arguments and a one-line purpose, marking the Claude-only ones (`/ai-dlc:cache-keepalive`, `/ai-dlc:cache-keepalive-config`, `/ai-dlc:configure-auto-handoff`). Generate the list from the skills' frontmatter (user-invocable, not `disable-model-invocation`-only internals) so it can be checked; if the build can keep it in sync, add it to `--check`.
- Amended (human, 2026-10-23): the repository README is not shipped with the plugin, so **do not link** to it. Put the full Commands list, duplicated, in each place a reader meets it: the repository README, docs/plugins.md, and the plugin's own shipped README (plugins/claude/ai-dlc/README.md, which the build carries into the Copilot plugin; Copilot's copy marks the Claude-only commands as not available there). One generated source writes every copy, and `--check` fails when one drifts.
