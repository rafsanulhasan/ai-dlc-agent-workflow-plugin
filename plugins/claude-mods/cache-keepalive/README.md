# claude-code-mods

Claude Code mods, published as a plugin marketplace.

```
/plugin marketplace add RichardJSun/claude-code-mods
/plugin install cache-keepalive@richardjsun-mods
```

## cache-keepalive

When Claude ends a turn while background tasks are still running, the prompt cache can expire before the task's notification arrives. The next request then re-writes the whole context into the cache at 2× the input price.

This mod pings the cache with a one-line fork of the conversation every 50 minutes while the session waits. A cache read costs 0.025–0.1× input, so a ping costs a few percent of a re-write. Pings stop when:

- a new turn starts
- a ping misses the cache
- the pings have cost as much as one re-write would have
- the keep-warm duration is spent (added in this copy; see below)

`/keepalive` pings now and reports the hit rate. The status line shows `armed`, `warm` or `stopped`. `armed` and `warm` end with the time the cache expires if no ping lands, so a line still on screen after that time is stale.

### Keep-warm duration (added in this copy)

This section describes local changes to the copy that ships with the `ai-dlc` plugin. Upstream `cache-keepalive` does not have them (see [VENDORED.md](VENDORED.md)).

No ping is sent once the keep-warm duration has passed since Claude ended the turn that armed the pings. The budget, a missed ping, overage and a new turn can still stop them sooner, whichever comes first. The last ping keeps the cache warm for up to an hour after it, so when the pings run to the end, the cache stays warm for at least the duration.

Pings come every 50 minutes, so the duration is checked only then. A duration of 50 minutes or less sends no ping: the cache's own 1-hour lifetime already covers it, and the status reads `keepalive: no ping needed for 30m, stopped` (for `30m`). A longer duration stops at the first ping time past it, so `2h` sends two pings, at 50 and 100 minutes.

| Setting (`/config`) | Default | Values |
| --- | --- | --- |
| `keepWarmFor` (Keep the cache warm for) | `8h` | `<n>m`, `<n>h` or `<n>d`, at least `1m`, such as `90m`, `1.5h`, `8h` or `1d`; `n` may have a fraction. An invalid value falls back to `8h`, and the mod says so in the transcript when the session starts. |
| `keepaliveScope` (Scope of `/keepalive <duration>`) | `session` | `session` or `machine`: where `/keepalive <duration>` applies when no flag is given. |

The command is `/keepalive`, with no plugin prefix:

| Command | What it does |
| --- | --- |
| `/keepalive` | Pings now and reports the hit rate and the keep-warm duration in force (upstream behaviour, plus the duration). |
| `/keepalive 2h` | Sets the duration in the default scope. Does not ping. |
| `/keepalive 2h --session` | Sets it for this session only. |
| `/keepalive 1d --machine` | Sets it for every session on this machine until cleared. The value is kept in the mod's store. |
| `/keepalive clear`, `/keepalive clear --machine` | Removes the override in that scope (in the default scope unless a flag is given). `--clear` works as `clear`. |

Flags and units are not case-sensitive. One duration per call: `/keepalive 2h 3h` is a usage error. The most specific value wins: this session's override, then the machine-wide one, then `keepWarmFor`. The store keeps the session overrides of the 20 most recent sessions that set one; older ones are dropped. A change made while the pings run takes effect at the next ping.

An 8h duration takes about nine pings. It relies on each ping's cache read restarting the cache's 1-hour lifetime. Anthropic's prompt-caching documentation says that reads refresh the cache, but it says so in its section on the default 5-minute cache and does not repeat it for the 1-hour cache. Treat long durations as resting on that inference, not on a documented guarantee. Each ping also counts against the budget, so with a large context the budget may stop the pings well before the duration ends.

**Agent teams.** An in-process teammate's requests use a 5-minute cache unless the `subagentPromptCacheTtl` setting is `1h`. The mod pings every 50 minutes, so with a 5-minute cache its first ping misses and the pings stop.

### Limitations

The mod assumes the 1h cache TTL. It cannot read the TTL, so it infers the 5m TTL from overage, which switches a session to it. It does not arm while the 5-hour or 7-day rate-limit window is at 100% or more, and it stops if one crosses 100% during the wait. Mods cannot see model-scoped limits such as Fable's weekly one, so the mod ignores them. When such a limit runs out, the first ping misses and the mod stops. Rate-limit readings arrive with this session's own responses, so the mod may not see overage that other sessions cause during a wait. When a 5m TTL slips past the check, the first ping misses, pays for a full re-cache itself and saves nothing, and the mod stops.

### Compact on cap

The `compactOnCap` setting (off by default) compacts the conversation when the ping budget runs out, while the cache is still warm. It compacts only when the compaction's cost plus re-caching the summary is less than re-caching the whole context. The mod records the cost and summary size of each compaction it runs and uses them for the next decision. Compaction loses context detail, which is why it is off by default.

A background notification that arrives during compaction waits until compaction finishes, then starts its turn as usual.

Compaction keeps the earlier messages in the session file. After each compaction it runs, the mod adds a line to the transcript with a command that opens the conversation as it was before that compaction, as a new session. The compacted session does not change. The command needs `jq` and uses `--resume-session-at`, a CLI flag that `claude --help` does not show. `/rewind` cannot go back past a compaction after the session is resumed.
