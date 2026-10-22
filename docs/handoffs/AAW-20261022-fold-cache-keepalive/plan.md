# Plan: resume AAW-20261022-fold-cache-keepalive on `fix/auto-handoff-chain`

## Context

The run [docs/handoffs/AAW-20261022-fold-cache-keepalive/run.md](docs/handoffs/AAW-20261022-fold-cache-keepalive/run.md) is `active`, and no stage has started yet. It runs on the current branch, `fix/auto-handoff-chain`, as you asked; no new branch is created.

The goal is to fold the vendored `cache-keepalive` mod into ai-dlc's auto-handoff hooks module, so one module manages both context and the prompt cache. It also has to make the handed-off session read the warm cache, and to rework keep-alive the way you asked.

Research this session came from three research-assistant reports:

- Only the shared prefix (the tools, the system prompt, and CLAUDE.md, memory and the git snapshot) can be a cache hit for the new session. The old conversation never can.
- The handoff gap is a few seconds, so keep-alive pings don't help during the handoff itself.
- Keep-alive timers survive /clear today.
- Pings may land in the 5-minute bucket.
- Every value the mod uses is listed with its source: `register.ts:9-16, 72-75, 96, 105, 132, 190-196, 223`, `duration.ts:4-8`, and `plugin.json:9-30`. It reads no env vars today.
- Auto-handoff's env convention is a settings table in `hooks/auto-handoff/config.ts:70-84` with the `AI_DLC_AUTO_HANDOFF_` prefix; invalid values fall through, as in `config.ts:103-139`.

Checks already run: `node .ai-dlc/workflow.mjs validate` → valid. `rounds --json` gives AAW/critique, AAW/test and AAW/code-review each 2 rounds / 1 failure.

## Your decisions (2026-10-22)

- **Direction:** do both. Make the handoff cache-aware, and fold keep-alive into ai-dlc, dropping the mod dependency.
- **Stopping:** stop when the session's work is done, and also on the spend limit. The spend limit stays but is optional: `BUDGET_MULTIPLIER=0` turns it off.
- **Two cache lifetimes:** separate 1-hour and 5-minute tracks, each with its own interval and limits, and one status line each.
- **Settings:** every setting is configurable. Invalid values are ignored, and the next level applies.
- **Command prefix:** every command uses the `ai-dlc:` prefix, so `/keepalive` becomes `/ai-dlc:keepalive`.

## Change scope (for agent-manager)

1. **Cache-aware handoff.**
   - Keep the shared prefix stable across /clear: the same model and effort, and the seed and handoff text only in messages.
   - Stop and clear all keep-alive timers of the old session before /clear.
   - At the seed turn, log `input_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens` and the 1h/5m split next to the floor line (`register.tsx:928-930`), and show the hit or miss in the status.
2. **Fold the mod in.**
   - Move `plugins/claude-mods/cache-keepalive` into `plugins/claude/ai-dlc/hooks/`. Keep its `LICENSE`, and update `ATTRIBUTION.md` and `THIRD_PARTY_NOTICES.md`.
   - Remove the `dependencies` entry, the marketplace entry, `VENDORED.md` and the CI loop.
   - Update the init skill and `plugin-management`.
3. **Keep-alive rework.**
   - **Per-session timers.** Pinging stops at whichever comes first:
     - the work is done (all background tasks have ended, a new turn has started, the session has ended or been handed off);
     - a ping misses;
     - the track's time limit or ping limit is reached;
     - the spend limit, if it is on. When it is hit, `compactOnCap` behaves as it does today.
   - **Track detection.** Work out the track from `cache_creation.ephemeral_1h_input_tokens` and `ephemeral_5m_input_tokens`, never by assumption.
   - **1-hour track:** a ping every 50 minutes, for up to 8 hours.
   - **5-minute track:** a ping every 3 minutes, for up to 1 hour (20 pings). An optional ping limit can stop it sooner.
   - **Status lines,** one per track, for example:
     - `keepalive 1h: warm until 11:36, ping 2/∞, keep warm 8h`
     - `keepalive 5m: warm until 10:39, ping 4/20, stop by 11:36`
     - A track not in use shows `off`.
   - **Commands.** Every command carries the `ai-dlc:` prefix, for example `/ai-dlc:keepalive [<duration>|clear] [--session|--machine]`. agent-manager checks that a command registered by the hooks module really gets the plugin namespace, and if not, names it explicitly. No bare `/keepalive` remains.
   - **Defaults.** One defaults table only, so the duplicate `8h` in `duration.ts:7` and `plugin.json:19` goes away.
4. **Docs.**
   - Explain each status line: "warm until" is the last ping plus the track's lifetime, and "keep warm" is the total time to keep pinging.
   - Give the full env var table.
   - Say what the cache can and cannot reuse, and that the claim that reading the cache restarts its lifetime is unverified.

## Command prefix changes

Research found that the mods API registers a command by its bare name: `$.command.register({name:'standup'})` shows up as `/standup` (https://code.claude.com/docs/en/plugins/mods/api). Only commands and skills declared in the manifest get the `/<plugin>:` prefix. So moving the command into ai-dlc does not prefix it by itself; we have to name it.

| Today | After | Where |
|---|---|---|
| `/keepalive [<n>m\|h\|d\|clear] [--session\|--machine]` (`cache-keepalive/hooks/register.ts:199-203`) | `/ai-dlc:keepalive` with the same arguments | the moved keep-alive code in `hooks/` |
| Auto-handoff module | no commands of its own; it only runs the built-ins `/clear` and `/rename` (`register.tsx:464, 578`), which stay as they are | — |
| `/ai-dlc:init`, `/ai-dlc:configure-auto-handoff` | already prefixed, so no change | skills |

How to name it, in this order (agent-manager confirms which one works with `claude plugin test` and a live session, and records the evidence):

1. Register the command with `name: 'ai-dlc:keepalive'`, if the mods API accepts a colon in the name.
2. Otherwise, add a plugin **skill** `/ai-dlc:keepalive`. The plugin prefixes skills automatically. The skill drives the module through its shared state store, and the module registers no bare command.
3. If neither works, stop and ask the human. Never ship a bare `/keepalive`.

Every mention of `/keepalive` changes to the new name:

- `skills/init/SKILL.md:163`
- the moved README and docs (`README.md:21, 36, 40-44`; drop the "no plugin prefix" line)
- the status and origin labels and the config-option text (`register.ts:50, 52, 63, 194, 247, 252`)
- the `plugin.json:18, 24` descriptions
- the tests (`register.test.ts:108-318`)
- the root `README.md:82`, if it mentions keep-warm

`VENDORED.md` is removed together with the mod; its history moves to `ATTRIBUTION.md`.

## Settings precedence (keep-alive)

From highest to lowest:

1. `/ai-dlc:keepalive` override (session or machine; the keep-warm duration only)
2. the `env` of `.claude/settings.local.json`
3. the `env` of `.claude/settings.json`
4. `.ai-dlc/cache-keepalive.json` (camelCase keys, as in the table below)
5. `/config` userConfig
6. the built-in defaults

The process env is not read. A value that doesn't parse, is out of range, or breaks a rule such as `PING_EVERY < TTL` is ignored with a warning, and the next level applies. Auto-handoff's own settings keep their existing precedence.

## Env vars (prefix `AI_DLC_KEEPALIVE_`)

| Env var | JSON key | Default | Controls (current source) |
|---|---|---|---|
| `_ENABLED` | `enabled` | `true` | Keep-alive on or off |
| `_SCOPE` | `scope` | `session` | Default scope of the command override (`keepaliveScope`, `register.ts:196`) |
| `_STATUS` | `status` | `true` | Show the status lines |
| `_PING_PROMPT` | `pingPrompt` | `Keep-alive ping. Reply with only: ok` | Ping text (`register.ts:96`) |
| `_HIT_THRESHOLD` | `hitThreshold` | `0.9` | A ping counts as a hit above this read ratio (`register.ts:105`) |
| `_OVERAGE_PERCENT` | `overagePercent` | `100` | No pinging at or above this plan usage (`register.ts:86`) |
| `_MIN_DURATION` | `minDuration` | `1m` | Shortest accepted duration (`duration.ts:4`) |
| `_SESSION_OVERRIDES_MAX` | `sessionOverridesMax` | `20` | Session overrides kept (`register.ts:33`) |
| `_1H_ENABLED` | `oneHour.enabled` | `true` | 1-hour track on or off |
| `_1H_TTL` | `oneHour.ttl` | `60m` | Assumed lifetime (`TTL_MS`, `register.ts:10`) |
| `_1H_PING_EVERY` | `oneHour.pingEvery` | `50m` | Interval (`PING_EVERY_MS`, `register.ts:9`) |
| `_1H_KEEP_WARM_FOR` | `oneHour.keepWarmFor` | `8h` | Time limit (`keepWarmFor`) |
| `_1H_MAX_PINGS` | `oneHour.maxPings` | `0` (no cap) | Ping limit |
| `_5M_ENABLED` | `fiveMinute.enabled` | `true` | 5-minute track on or off |
| `_5M_TTL` | `fiveMinute.ttl` | `5m` | Assumed lifetime |
| `_5M_PING_EVERY` | `fiveMinute.pingEvery` | `3m` | Interval |
| `_5M_KEEP_WARM_FOR` | `fiveMinute.keepWarmFor` | `1h` | Time limit |
| `_5M_MAX_PINGS` | `fiveMinute.maxPings` | `0` (no cap; 1h ÷ 3m = 20 pings) | Ping limit |
| `_BUDGET_MULTIPLIER` | `budgetMultiplier` | `2` (`0` = off) | Spend limit = n × context tokens (`register.ts:223`) |
| `_COMPACT_ON_CAP` | `compactOnCap` | `false` | Compact instead of stopping when the spend limit is hit (`register.ts:190`) |
| `_COMPACT_INSTRUCTIONS` | `compactInstructions` | current text | Compaction instruction (`register.ts:132`) |
| `_WRITE_MULT` | `writeMult` | `2` | Cache-write cost multiplier (`register.ts:11`) |
| `_OUTPUT_MULT` | `outputMult` | `5` | Output cost multiplier (`register.ts:12`) |
| `_READ_PRICE` | `readPrice` | `fable\|mythos=0.025,opus-5-5=0.05,*=0.1` | Cache-read price per model pattern (`register.ts:72-75`) |
| `_COMPACT_COST_GUESS` | `compactCostGuess` | `0.6` | Fallback compaction cost (`register.ts:15`) |
| `_SUMMARY_RATIO_GUESS` | `summaryRatioGuess` | `0.15` | Fallback summary ratio (`register.ts:16`) |

Every env var name is the prefix plus the suffix shown, for example `AI_DLC_KEEPALIVE_5M_PING_EVERY`. The userConfig keeps matching keys for `/config`.

## Steps

0. **Update the run state.** Set `session` and `commit`, put the loop limits in *Gates and loops*, close clarification #1, add the requirements and decisions above, and store the three research reports as the `1.1`–`1.3` hand-backs.
1. **Measurement (optional).** Run `claude -p "hello" --output-format json` and read the `usage.cache_creation` 1h/5m split. After the change, the seed-turn log measures this automatically.
2. **Change (step 2).** Spawn a fresh `ai-dlc:agent-manager` with this scope, the precedence, the env table and the research hand-backs. Its hand-back lists the changed paths, each marked code or docs.
3. **Verify myself.** Run these checks, then classify the changed paths with `aaw-review.md`:
   - `node tools/build-copilot.mjs --check`
   - `node --test "tests/**/*.test.mjs"`
   - `npx @anthropic-ai/claude-code plugin validate --strict` on `./plugins/claude/ai-dlc` and on `.`
   - `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc`
4. **Review.** First, in parallel: 3.1 `brutal-critique` on the docs and 3.2 `sqa-engineer` on the tests. Then 4.1 and 4.2: two `code-reviewer` instances, one on the standards axis and one on the spec axis. Fix rounds run as `.l<n>`, within 2 rounds / 1 failure each. If a loop stops with findings still open, ask the human.
5. **Close.** Commit the run state, the records and the hand-backs on this branch, report the outcome, and save memory.

## Verification

- All the commands in step 3 pass.
- Both review paths come back clean: PASS from brutal-critique, and zero Blockers from code-reviewer.
- No `cache-keepalive` dependency or CI references remain, and no bare `/keepalive` command.
- The tests cover:
  - the precedence across all six levels, including an invalid value falling through at each level;
  - the scheduling of both tracks and every stop condition;
  - the spend limit on and off;
  - the timers cleared before /clear;
  - both status lines;
  - the `ai-dlc:` command name.
- A real seeded session logs `cache_read_input_tokens` on its first request.
