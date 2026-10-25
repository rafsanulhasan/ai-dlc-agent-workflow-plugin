---
work-item: FEAT-20261020-ai-dlc-lens
root: 17
kind: lld
feature: keepalive-cache-status
module: ai-dlc
submodule: cache-keepalive
integrations: [integration-1]
items: [ITEM-032, ITEM-033, ITEM-034, ITEM-034.a, ITEM-034.b, ITEM-035, ITEM-036, ITEM-068, ITEM-076]
author: system-engineer
date: 2026-10-25
status: draft revision 14 (17.1.46 follow-up, fix round 5: KA M1 the AC-17.3.7 test row separates the helper with no file from the unsettled marker, m3 E2'/E3' firm since 034.c; review status: awaiting critique round 5 / 5); revision 13 (17.1.46, gate critique round 3: KA B1 AC-17.3.7 test row in two steps, M3 an unflushed real agent keeps `split unknown`, m1 the ITEM-034.c row, m3 citations; review status: awaiting critique round 4 / 4); revision 12 (17.1.41: gate critique round 2 fixes KA M4, round-1 6, m6; 034.c follow-ups a, b, c in 3.7 and 3.4; `chainOf($)` renamed `chainIdOf($)`; see 3.7, 11.2, 13, 19.1, 19.4); revision 11 (17.1.37: D13 status-line summary, pure `summaryOf`, `Track.status` set by `setPart`, surface roster and `statusText` setting, band / Pane title row and seed row; see Revision 11 at the end, which amends sections 2.2, 3.1, 3.3, 3.5, 11, 11.1, 11.2, 13, 14, 15, 16, 17, 19.1); revision 10 (17.1.32 and follow-up 17.1.32.l1.1: section 11.2 source note and its `sourceNote` setting, the hide stays, section 12.2 and 12.3 chain key and switchText, section 19 auto-handoff chain as one session, Q-SL9 the exception acts like a master [on] press, Q-SL10); revision 9 (2026-10-25: Q-SL8 track button label follows enabled, sections 11, 12, 13, 14); revision 8 (17.1.24: master button, a track switch overrides the master, switches in $.store per session id, ITEM-068 resized to 4); revision 7 (17.1.17: sections 11 to 18, ITEM-068 both lines, band, Pane, session switch; sections 1 to 10 are rev 6, unchanged except where section 11 says so); revision 5 (17.1.7: main write without a split resolved from the transcript at the next Stop; spec line 82 correction owed by sa); revision 4 (bc round 1 fixed; spec revisions 2 and 3: 034.c, D2a, read attribution, D5 main-only arming, AC-17.3.8), awaiting sa answers on section 9 and brutal-critique
spec: docs/specs/keepalive-cache-status.spec.md
stories: docs/product/active/session-continuity-and-cache-visibility/sprint-1/keepalive-cache-status/stories.md
handoff: 17.1.3-software-architect-to-system-engineer.handoff.md
---

# LLD: keep-alive status line shows the real cache state (root 17)

Code lines are as read on 2026-10-24 (branch feat/ai-dlc-lens); the build re-checks them. Paths are under `plugins/claude/ai-dlc/`. No code is written here. Parts that depend on a spike are marked **CONDITIONAL**.

**Rev 11 (D13):** the status line gets a one-line summary on a terminal; the strings, band title and sections named in the header are amended by *Revision 11* at the end, which wins where it differs from sections 2.2, 3.x, 11 to 17.

## 1. Design summary

| Principle | Decision |
|---|---|
| Pure core, thin wiring | A new engine-free file `hooks/keepalive/cache-state.ts` holds the ledger, the view and every line string (D1, D3, D4). `keepalive.ts` keeps the timers, the arming and the I/O. |
| One source for the cache part | The status line's cache part and the published `caches` both come from one `cacheView(ledger, ttl, now)`. |
| Store the keep-alive part, derive the line | A track keeps `part` (the keep-alive text after `; `). The full line is `lineOf(track, cachePart(view), part)`, built at render and publish time with a `now`, so it never carries a stale cache part. |
| Spend stays visible | The subagent ping (034.b) is a separate, injected function behind a setting that defaults to off; with it absent every behaviour is the main-loop one. |
| Minimal blast radius | Timers, `arm` tick order, `pingCap`, `spendLimit`, settings resolution keep their code. |

## 2. `cache-state.ts` (D1, D3, D4), pure and engine-free

```ts
export type Ttl = '5m' | '1h'                     // = TrackName in duration.ts
export type EntryTtl = Ttl | 'unknown'            // 'unknown' only under D2a (a subagent write without a split)
export type LedgerEntry = { warmUntil: number }     // writtenAt dropped (spec rev 2)
export type AgentCaches = { caches: Partial<Record<EntryTtl, LedgerEntry>>; status: 'running' | 'idle' | 'finished' }
export type Ledger = { main: Partial<Record<Ttl, LedgerEntry>>; agents: Map<string, AgentCaches>; pendingMain?: { at: number } }   // main never holds 'unknown'. A main write without a split sets `pendingMain` (the time of the response); the next Stop resolves it from the transcript (2.1 step 3, rev 5)
export type Observation = { at: number; agentId?: string; usage: unknown }
export type Lifetimes = Record<Ttl, number>        // ms; from settings.fiveMinute.ttl / oneHour.ttl

export const emptyLedger = (): Ledger
export const isEmpty = (l: Ledger, ttl?: Ttl): boolean

/** D1. Records one response. Mutates `l`. Total: an unusable usage object changes nothing. */
export function observe(l: Ledger, o: Observation, life: Lifetimes): void

/** D1, landed ping (spec rev 3). Records the response to a keep-alive ping that hit the cache. `ttl` is the track pinged; `source` is main or an agent id. A landed 5m ping sets that source's 5m entry to at + life['5m'], whatever other entries exist. A landed 1h ping moves the 1h entry only when its usage carries a 1h write (the ordinary write rule). The conservative read rule of `observe` does not apply here. The ping's own writes are then recorded as in `observe`. */
export function observePing(l: Ledger, o: Observation & { ttl: Ttl }, life: Lifetimes): void

/** D1 seed. The transcript fallback at Stop: gives `main` an entry per TTL with tokens > 0, warm until writtenAt + life, only when `needsMainSeed(l)` and that time is after `now`. Rev 5: with a pending write the entry is merged, `max(existing.warmUntil, writtenAt + life)`, so it never lowers a live entry; `pendingMain` is cleared on return. A row with no timestamp uses `pendingMain.at` when pending, else `now`. `writtenAt` is the timestamp of the transcript row that carried the write (new `splitFromTranscript` result `{ split, at }`); a row with no timestamp uses `now`, today's assumption. */
export function seedMain(l: Ledger, split: Record<Ttl, number>, writtenAt: number, now: number, life: Lifetimes): void   // seeds only entries with writtenAt + life[ttl] > now

/** Rev 5. True when `main` has no entry, or a main write without a split is pending: the Stop reads the transcript only then. */
export const needsMainSeed = (l: Ledger): boolean => !hasMain(l) || l.pendingMain !== undefined
/** Rev 5. The transcript had no split for the pending write: forget it (one read per pending write, never retried). */
export function dropPending(l: Ledger): void

/** Agent liveness (034). `markAgent` creates the agent when unknown. A finished agent keeps its entries. */
export function markAgent(l: Ledger, agentId: string, status: AgentCaches['status']): void

export type SourceView = { warmUntil: number; expired: boolean }
export type CacheView = { main?: SourceView; subagents?: SourceView; subagentsUnknown?: boolean }
/** D3. Per-source view of one TTL. `subagents.warmUntil` is the latest over the agents' entries of that TTL. `expired` = warmUntil <= now. `subagentsUnknown` is true when any agent has an 'unknown' entry (D2a), the same on both TTLs. */
export function cacheView(l: Ledger, ttl: Ttl, now: number): CacheView

/** D5 (spec rev 2). The time a track may arm from: `main`'s warm entry of the TTL; with `opts.agents` (034.b built and `pingSubagents` on) the latest warm entry of an agent that is not finished when `main` has none. Undefined when none. `armUntilAgentsOnly` reports whether only agents are warm, for the `onlySubagents` reason. */
export function armUntil(l: Ledger, ttl: Ttl, now: number, opts: { agents: boolean }): number | undefined
export const onlyAgentsWarm = (l: Ledger, ttl: Ttl, now: number): boolean   // no warm main entry, some unfinished agent has one

export type Reason = 'noTasks' | { noWrite: Ttl } | 'expired' | 'turnRunning' | 'sessionEnded' | 'onlySubagents' | 'disabled' | 'noSplit' | 'overage'   // the names of the spec's Data shapes
export const reasonText: (r: Reason) => string          // the keep-alive part for a track that is not armed

export const hhmm: (ms: number) => string               // the module's `until`, moved here (local time, H:MM)
export function cachePart(v: CacheView): string | undefined
export const lineOf = (ttl: Ttl, cache: string | undefined, part: string): string
```

### 2.1 `observe` rules (D1)

1. `source = o.agentId ? agents.get(o.agentId) ?? created : main`. An observation from an agent sets its status to `running`, unless it is `finished` (a finished agent does not respond; if one does, it was resumed, so it is `running`).
2. `split = creationSplit(o.usage)` (the existing reader in `auto-handoff/config.ts:385`; it reads the untyped raw fields and needs both `ephemeral_1h_input_tokens` and `ephemeral_5m_input_tokens` to be numbers). For each `ttl` with `split[ttl] > 0`: `entry = { warmUntil: at + life[ttl] }`.
3. **Read attribution (spec D1 rev 2).** `read = usage.cache_read_input_tokens`. When `typeof read === 'number' && read > 0` and all three hold: the source's `5m` entry exists with `warmUntil > at`; the response wrote no 1h tokens (`split?.['1h'] ?? 0` is 0); the source has no warm `1h` entry (`warmUntil > at`); then `warmUntil = at + life['5m']`. Otherwise the read is unattributed and moves nothing. Never touches a `1h` entry (AC-17.1.5; the 1h refresh rule is unknown, 17.1.2).
   **D2a.** For an agent source only: when `split` is undefined (or both fields 0) and `usage.cache_creation_input_tokens > 0`, set `agent.caches.unknown = { warmUntil: at }` (a marker; its time is never shown or armed from). **Main without a split (rev 5).** When `usage.cache_creation_input_tokens > 0` and `split` is undefined (or both fields 0), the source is `main`: record nothing in `main` and set `l.pendingMain = { at }` (the later `at` wins). `recordWrites` takes `l` for this, and so does `observePing` (a ping reply with a write and no split is the same case). A read-only response or a main response with a split sets nothing. The Stop resolves the marker (3.4); until then the line shows what the ledger holds, as today.
4. Order within one call (the only statement of it): step 3 (the read) runs first, then step 2 (the writes), so a response that reads and writes 5m ends at `at + life`; the 'wrote no 1h tokens' test in step 3 uses the same response's split.
5. No usage, a non-object or a missing split with no read: no change.

### 2.2 String table (the literals the tests compare)

`lineOf(ttl, cache, part)` = `` `keepalive ${ttl}: ${cache ? `${cache}; ${part}` : part}` ``.

| Piece | Text |
|---|---|
| main, warm | `main warm until ${hhmm(warmUntil)}` |
| main, expired | `main expired ${hhmm(warmUntil)}` |
| subagents, warm / expired | `subagents warm until ${hhmm(w)}` / `subagents expired ${hhmm(w)}` |
| cache part | `main …` first, then `, subagents …` only when `subagents` exists, then `, subagents: split unknown` when `subagentsUnknown`; elements joined by `, `; undefined when none exists |
| `reasonText('noTasks')` | `off (no background tasks)` |
| `{ noWrite: ttl }` | `off (no ${ttl} cache write seen)` |
| `'expired'` | `off (cache expired)` |
| `'turnRunning'` | `off (turn running)` |
| `'sessionEnded'` | `off (session ended)` |
| `'onlySubagents'` | `off (only subagent caches; subagent pings off)` |
| `'disabled'` | `off (disabled)` (unchanged) |
| `'noSplit'` | `off (no cache write seen yet, so the cache lifetime is unknown)` (unchanged) |
| `'overage'` | `off in overage` (unchanged) |
| unknown split (D2a) | cache part element `subagents: split unknown`, after `main …` and any `subagents …`, on both tracks |
| running, before the first ping | `armed, ${n} task(s), warm until ${hhmm(t.warmUntil)}, ping 0/${cap}, first ping at ${hhmm(t.nextPingAt)}, keep warm ${keep}, stop by ${hhmm(armedTime + keep)}` |
| running, after a landed ping | `warm until ${hhmm(t.warmUntil)}, ping ${k}/${cap}, keep warm ${keep}, stop by ${hhmm(armedTime + keep)}` |
| stopped / compaction texts | every existing text, unchanged (`expired, stopped`, `kept warm …`, `missed, stopped`, `ping limit … reached, stopped, warm until …`, `error, stopped`, `spend limit reached, stopped, warm until …`, `compacting`, the compaction result, `handed off, stopped`, `work done, stopped`, `overage, stopped`) |

The examples E1 to E7 of the stories are exactly `lineOf` over these pieces (E6, E7: cache part from the ledger, running text with its own `warm until`, per the fixed decision).

## 3. `keepalive.ts` (D3 to D6, D8)

### 3.1 State

- New module variable `ledger: Ledger = emptyLedger()` replaces `lastSplit` (lines 64-65). `noteUsage` and the transcript fallback feed it; it is cleared where `lastSplit` is cleared: `session.end` (line 721) and `stopForHandoff` (line 603). A turn start never clears it (AC-17.2.3).
- `Track` gains `pingWarmUntil: number` (0 = none): set to `now + cfg.ttl` at every landed ping of the track (beside `t.warmUntil`, `keepalive.ts:549`), read **only** by the arming decision at Stop (3.4: `until` is the later of the ledger's arming time and `pingWarmUntil` while it is in the future, so a 1h track whose landed pings carried no 1h write is not ended as `expired` by the next Stop) and never by `cacheView`/`cachePart`, which stay ledger-only (spec D1, OQ2). It is cleared (set to 0) when the track ends as `expired`, `missed` or `error` (the cache is gone or unknown), at `session.end` and in `stopForHandoff`; it survives `turn.start` and a `ping limit`/`kept warm` end (the cache is still warm). `Track` also gains `mainPings: boolean` (3.8, set at arming: true when armed from a warm main entry). `transcriptSplit` and `splitFromTranscript` return `{ split, at? }` (`at` = the matching row's `timestamp`, parsed, when it has one); their other callers (`register.tsx` seed cache, line 891) read `.split`.
- `Track.line: string` is replaced by `Track.part: string`, the keep-alive part. `newTrack` starts with `part = reasonText({ noWrite: name })` (it was `off`, which a bare-`off` check would now reject).
- `until` (lines 113-116) moves to `cache-state.ts` as `hhmm`; `keepalive.ts` imports it.
- `life: Lifetimes` is `{ '5m': settings.fiveMinute.ttl, '1h': settings.oneHour.ttl }`, read when observing.

### 3.2 Entry points

```ts
/** Replaces noteUsage(usage). Records one response in the ledger; `agentId` is set for a subagent or teammate. */
export async function noteUsage($: EngineInterface, usage: unknown, agentId?: string): Promise<void>
//   observe(ledger, { at: await $.clock.now(), agentId, usage }, life())

/** Seeds main from the transcript when `needsMainSeed(ledger)` (replaces `lastSplit ?? transcriptSplit`; rev 5 widened the guard from `!hasMain`). In keepalive.ts the one change is the guard of `seedFromTranscript` (line 133): `if (!needsMainSeed(ledger)) return`, plus the `dropPending` branch when `r` is undefined. `noteUsage` and the `ping` observation points need no change: the marker is set inside `observe`/`observePing`. */
```

`stopForHandoff($)` stays synchronous and returns the boolean; its render stays synchronous and becomes `render($, 0)`: the ledger is emptied first, so no line has a cache part and `now` changes nothing in what is shown (an async IIFE would let the caller's `/clear` run before the render). `republishKeep` is still launched with `void`.

### 3.3 Rendering and publishing take a `now`

- `render($, now)` and `publish($, now)` gain `now`. Every caller reads `const now = await $.clock.now()` once. `trackStates(now)` builds `line = lineOf(n, cachePart(cacheView(ledger, n, now)), t.part)` and the optional `caches` (3.6).
- Callers to change (all already async): `end` (line 510), `arm`'s tick tail (563), `spendLimit` (589, 595), `turn.start` (648), Stop (659, 677, 700), `session.measure` (712), `session.end` (735), `command.run` (747, 756), `showSeedCache` (623), `republishKeep` (412).
- Assignments `t.line = \`keepalive ${n}: X\`` become `t.part = X` at each site: `stopAll(line)` (136), `end` (512), `spendLimit` (579, 590, 594), turn start (635), overage (675), Stop (688-690, 696), session end (730). `X` is the text after `keepalive ${n}: ` today.

### 3.4 Stop handler (lines 654-705), decisions in order

```
tasks = e.background_tasks?.length ?? 0
now = await $.clock.now()
if compacting or handingOff: return next
if (!settings.enabled)   [after load, when tasks > 0]: stopAll; each track's part = reasonText('disabled') (else `off (turn running)` from turn.start would stay published); publish; clear status. With 0 tasks and keep-alive disabled the no-tasks branch renders each track's `disabled` part (status hidden by `settings.status` as usual)
seed (`seedFromTranscript`): if needsMainSeed(ledger) { r = await transcriptSplit(...) /* returns { split, at? } */; if (r) seedMain(ledger, r.split, r.at ?? ledger.pendingMain?.at ?? now, now, life()); else dropPending(ledger) }   // rev 5: when no main entry exists (as before) or a main write without a split is pending. One transcript read per Stop with a pending write, none otherwise: reads are never per response, because the response's own row may not be flushed when `turn.step` returns, while at Stop it is. No row with a split (transcript missing, unreadable or without one): `dropPending`, nothing recorded, one debug line `keepalive: main write without split, transcript has none`; the track then reads `expired` or `no write seen` as before, and the next Stop does not read again. Placement: tasks = 0 -> before the no-tasks branch; tasks > 0 -> right after `load`, before every later branch (disabled, overage, arming), so life() and those lines use the fresh settings
if (!tasks) {                                      // NEW: renders (AC-17.2.2)
  if anyRunning(): stopAll('work done, stopped')   // unchanged text, existing branch
  for each track not running:
      t.part = !settings[key].enabled ? reasonText('disabled')
             : isEmpty(ledger, n)       ? reasonText({ noWrite: n })
             : reasonText('noTasks')
  refreshKeep; render($, now); return next
}
// tasks > 0: today's order, with the ledger replacing `split`
load; seed (above); settings.enabled false -> parts 'disabled' (above); overage -> t.part = reasonText('overage') (unchanged text)
agentsArm = settings.pingSubagents && pingerOf() !== undefined      // false until 034.b exists
for each track:
   stopTrack(t)
   disabled                      -> part = reasonText('disabled')                  (unchanged text)
   isEmpty(ledger) [both TTLs]   -> part = reasonText('noSplit')                   (unchanged text)
   until = max(armUntil(ledger, n, now, { agents: agentsArm }), t.pingWarmUntil > now ? t.pingWarmUntil : undefined)   // a landed ping proves warmth for arming (clarify round 1, T17.1); the display stays ledger-only
   until !== undefined           -> armedTime = now; pings = 0; warmUntil = until; keep = ...; arm(...); part = runningText(t, keep, `armed, ${tasks} task(s), `)
   onlyAgentsWarm(ledger, n, now)-> part = reasonText('onlySubagents'); t.warmUntil = 0   (AC-17.3.8: no arm, no main ping)
   isEmpty(ledger, n)            -> part = reasonText({ noWrite: n }); t.warmUntil = 0
   else                          -> part = reasonText('expired'); t.warmUntil = 0
```

`isEmpty(ledger, n)` ignores `unknown` entries. With `agentsArm` false (the state until 034.b ships), `armUntil` looks at `main` only, which is exactly spec D5. `spent`/`budget` setup (683-684) stays before the loop. The no-tasks branch does not touch `spent`.

### 3.5 Running text and the first ping (D6)

`runningLine` (505-506) becomes `runningText(t, keep, lead)` returning the text after `keepalive <track>: `, with `pingsOf` extended: `ping ${t.pings}/${cap}` followed by `, first ping at ${hhmm(t.nextPingAt)}` while `t.pings === 0 && t.nextPingAt !== null`. `nextPingAt` is set by `arm` (line 526) before the part is written (the existing comment at 503 says it is written right after `arm()`), so the time is the first tick. After a landed ping `t.pings > 0` and the clause is gone (AC-17.4.1 to 17.4.3, 17.4.6 stay: `missed, stopped` ends the track first, line 548).

### 3.6 Published state (D8) and the types

`types/index.d.ts` `KeepaliveTrackState` gains `caches?: { source: 'main' | 'subagents'; warmUntil: number; expired: boolean }[]` (omitted when empty) and the `pings` comment reads "Pings that landed (cache hits) since the track was armed". `trackStates(now)` fills it from `cacheView`. The lens is untouched (root 22). Additive and optional: a reader that ignores it still works (`ai-dlc-lens` has its own copy of the type, which does not list the new field, so it keeps compiling).

### 3.7 Observation points

- `ping($, ttl)` (line 444) gains the track it pings and feeds the ledger after `r.usage` is read: `if (ok) observePing(ledger, { at: now, ttl, usage: r.usage }, life()) else observe(ledger, { at: now, usage: r.usage }, life())` as `main`. A landed 5m ping refreshes the main 5m entry whatever else exists (the same time as today's `t.warmUntil = now + cfg.ttl`, line 549, which stays for the running text); a landed 1h ping moves the 1h entry only if its usage has a 1h write (OQ2, spec rev 3). The `command.run` ping (line 770) is a main ping with no track: it uses `observe`.
- **034.c observation check (rev 6: placement that fires before T17.3).** Two log-only seams, no ledger write, no behaviour change, both kept by T17.3 (debug only, cheap). (1) `keepalive.ts` exports `logAgentUsage($, usage, agentId): void`, which logs `keepalive: agent usage agent=<id> split=present|absent writes=<n>` (`$.ui.log(..., { to: 'debug' })`; `writes` is the count of `cache_creation` writes in `usage`, `split` whether `usage.cache_creation` carries the 5m/1h split). It is pure apart from the log and never throws. In 034.c `register.tsx` `turn.step` calls it when `e.agentId && r.usage`, a separate line next to the `!e.agentId` accounting and no forwarding to `noteUsage`. In T17.3 that line is replaced by the section 4 `noteUsage($, r.usage, e.agentId)` forwarding, and `noteUsage` calls `logAgentUsage` itself when `agentId` is set, so the log line stays in one place and nothing is removed but the one 034.c call line. (2) `keepalive.ts` exports `logSubagentTranscript($, e: { agent_id, agent_transcript_path }): Promise<void>` (reads `agent_transcript_path` with `readTranscript` (3.7, rev 12); counts rows; `split` from the new pure `splitFromAgentTranscript(jsonl)`, see Fallback; logs `keepalive: subagent transcript agent=<id> rows=<n> split=present|absent`; never touches the ledger, never throws, a missing path or read failure logs `rows=0 split=absent`). `registerKeepalive` adds in 034.c a log-only `on('classic.SubagentStop')` that awaits `logSubagentTranscript` inside try/catch and calls `next(e)`. T17.3 keeps that handler and adds `markAgent(…, 'finished')` and the fallback after the log call. No `SubagentStart`/`TeammateIdle` handler and no `markAgent` before T17.3. The live check reads these two lines; the result is recorded in the run folder as the 034.c outcome. D2a is built regardless (it costs one branch) and is what shows if the split is absent.
- **Conditional on the build confirming the event names** against the installed Claude Code (no module in `plugins/claude/ai-dlc` uses them today; the names and fields `agent_id`, `agent_transcript_path` come from the provisional 2.1.308 types). If `classic.TeammateIdle` does not exist, agents stay `running` until `SubagentStop` and AC-17.3.5 has no idle/running difference (the teammate is treated as running); if `SubagentStart` does not exist, an agent is created at its first observation. If `SubagentStop` does not exist, finished status is never set and AC-17.3.3 moves to the human with the build's finding.
- `registerKeepalive` gains `on('classic.SubagentStart')` (`markAgent(…, 'running')`), `on('classic.SubagentStop')` (`markAgent(…, 'finished')`; fallback below) and `on('classic.TeammateIdle')` (`markAgent(…, 'idle')`); each calls `next(e)` and never throws. Field names from the engine types: `agent_id` on all three, `agent_transcript_path` on `SubagentStop`.
- **Fallback (D2).** At `SubagentStop`, when the ledger has no entry for that agent, `splitFromTranscript` over `agent_transcript_path` (read with `readRaw`, as `transcriptSplit` does) yields a split, and the agent's entry is set with `at` = the matching row's timestamp (else `now`), `warmUntil = at + life`, only when that is after `now` (as `seedMain`). A new `splitFromAgentTranscript(jsonl)` is the same as `splitFromTranscript` but keeps `isSidechain` lines (a subagent's transcript is all sidechain; the existing function skips them, line 85).

- **Rev 12 (17.1.41): the 034.c live check (human, 2026-10-25, Claude Code 2.1.310, Windows; run.v4 2w) and its three follow-ups.** Observed: (a) live subagent usage has no `cache_creation` split (`split=absent` x4, writes 29055, 7582, 4744, 12638), while the transcript read at `SubagentStop` has it (`rows=54 split=present`); (b) `$.process.run (ai-dlc): tail failed to start: ENOENT` at every `SubagentStop`; (c) forked helper agents (`prompt_suggestion`, `agent_summary`) fire `SubagentStop` with no transcript file (`rows=0 split=absent`).
  - **(a) The subagent split source is the transcript at `SubagentStop`, D2a is the interim (agreed with software-architect, step 17.1.40 and this step 17.1.41; spec delta rev 4.6).** Live: an agent write with `cache_creation_input_tokens > 0` and no split enters the `unknown` marker (D2a, unchanged; arms nothing). At `classic.SubagentStop`, when `agent_transcript_path` exists and `readTranscript` returns text, `splitFromAgentTranscript(text)` gives the split; a new pure `settleAgent(l, agentId, r: { split, at? }, now, life)` sets that agent's entry per TTL with tokens > 0 (`at` = the matching row's timestamp, else `now`; `warmUntil = at + life[ttl]`, kept only when after `now`, as `seedMain`) and **deletes the agent's `unknown` marker** whether or not any entry survives the `warmUntil` test (the split is now known). No transcript, no readable text or no split: the marker stays and `AC-17.1.2` is the D2a case. A still-running subagent therefore shows `subagents: split unknown` until it stops (consequence for the AC-17.3.7 fixture, recorded in the spec delta rev 4.6). This replaces the Fallback bullet's condition "when the ledger has no entry for that agent" with "when the ledger has no entry for that agent **or only its `unknown` marker**".
  - **(b) A portable read.** `$.fs.read` takes no range (types: `read(path, { as })`, rejects over 4 MiB) and `tail` does not exist on Windows, so the 4 MiB-and-over case has no pure-`$.fs` form. `readTranscript` becomes: (1) `readRaw` whole (unchanged); (2) on failure, `await $.fs.exists(path)`: false -> `undefined`, **no process spawned** (this also removes the ENOENT noise for a missing file); (3) otherwise (a file over 4 MiB) `$.process.run(['node', '-e', TAIL_SCRIPT, path, String(TAIL_BYTES)])`, `TAIL_SCRIPT` a constant of about four lines (`fs.openSync`, `fs.fstatSync` size, `fs.readSync` of the last `min(size, n)` bytes at `size - n`, write them as UTF-8 to stdout). `node` is on every machine that runs the plugin's own `tools/` and the diagramming LLD's `node --version` probe (cache-lab and diagramming LLDs). A spawn that fails or exits non-zero gives `undefined` and one debug line `keepalive: transcript tail unavailable (<error>)`, logged once per session (a module flag), so a machine with no `node` is quiet after the first line. The partial first line of the tail is ignored by `splitFromTranscript` as the `tail -c` output was (build confirms with a fixture cut mid-line). Windows-safe: the argv has no shell, the path is one argument.
  - **(c) Forked helper agents are ignored.** The `SubagentStop` handler (log-only in 034.c, `markAgent` and the fallback in T17.3) starts with `if (!e.agent_transcript_path || !(await $.fs.exists(e.agent_transcript_path)))`: `$.ui.log('keepalive: subagent <id> has no transcript file, ignored', { to: 'debug' })`, `return next(e)`: no `logSubagentTranscript` row line, no `markAgent`, no ledger change. A real agent whose file is not flushed yet at `SubagentStop` is the same case and is treated the same, and **it keeps `subagents: split unknown` for the rest of that agent's life**: nothing settles the marker later (no event after `SubagentStop` re-reads the file; reading it on a later event is not designed, spec delta rev 4.6), and it arms nothing, which is the safe side. The stop-time read is expected to find the file, as the live check did (`rows=54`). The `rows=0 split=absent` line stays only for a path that exists but cannot be read.
  - **Size impact: none** (one `settleAgent` function, one constant script, one guard; inside T17.3 and 034.c, whose sessions pm-fix3 keeps). Tests: `settleAgent` (marker replaced per TTL; entry already expired at `now` keeps the marker deleted; no split leaves the marker); `readTranscript` with a stub `$` (whole read ok; missing file spawns nothing; over-size spawns `node` with the argv above and returns its stdout; a failing spawn logs once and returns `undefined` on two calls); `SubagentStop` with a missing path ignores it (no ledger change, no `markAgent`); `AC-17.1.2 (034.c)` names updated.

### 3.8 The tick does not re-check the ledger (bc round 1, Blocker)

The timer callback keeps its existing checks (expiry against `t.warmUntil`, line 535; keep-warm time, 543) and gains no ledger check. A track arms only from a warm `main` entry (3.4, spec D5), and from then on "every round" in spec D5 means "while the track is armed": a landed ping is itself proof that the cache is alive, and `t.warmUntil` already makes that assumption (line 549). A ledger check at the tick would end a 1h track whose landed pings carry no 1h write (the ledger's 1h entry stays old by OQ2) and would break AC-17.4.1 and 17.4.3. The ledger therefore only decides *arming* and the *cache part*; the running text's `warm until` stays `t.warmUntil`. (sa reads spec D5 "every round" this way; confirmed by bc's message to sa.)

## 4. `register.tsx` (D2)

At the `turn.step` handler (lines 877-885), `noteUsage` moves out of the `!e.agentId` condition:

```ts
const r = yield* next(e)
if (r.usage) await noteUsage($, r.usage, e.agentId)   // keep-alive's ledger: main and every agent
if (!e.agentId && r.usage) { unmeasured = unmeasured - before + r.usage.output_tokens }   // auto-handoff's accounting keeps its filter
```

The line 877 `seeding` test, the floor and everything else stay main-only. No other `register.tsx` change except that `showSeedCache`/`stopForHandoff` callers are unchanged in signature. `noteUsage` is now `await`ed inside a `try` that already surrounds the handler's logging; a ledger failure is logged and never stops the turn.

## 5. Settings (034.b, CONDITIONAL on 034.a)

`settings.ts`: `Settings.pingSubagents: boolean`; `SETTINGS` row `{ key: 'pingSubagents', env: 'AI_DLC_KEEPALIVE_PING_SUBAGENTS', kind: 'boolean', default: false }`, placed after `status` (order matters only for rules that read earlier values); `defaults()` and the resolver map it like `compactOnCap`. Trust gating (sa, spec rev 3): `pingSubagents` is **trust-gated**, like `enabled`, the intervals and the ping limits: it joins the gated list in `settings.ts` (and `GATED_INSTEAD` text, the README's gated-settings sentence checked by `keepalive-settings.test.mjs`), so a cloned repository's committed file cannot turn on spending. The README table, the `cache-keepalive-configure` skill's schema and the `tests/auto-handoff/keepalive-settings.test.mjs` alignment check (README table versus `SETTINGS`) change together, in the 034.b task. If 034.a fails, none of this is built.

## 6. 034.a spike and 034.b round design (CONDITIONAL)

**034.a (task, no production code kept).** A throwaway test in `.scratch/` or a documented manual run: send `$.session.send` to (a) an idle background subagent and (b) an idle teammate, with the `pingPrompt` text. Record, per case: tokens read from cache and written (does the reply read the agent's cache), the cost against the main ping's `cost()` (threshold: at most 2x), whether the agent made a tool call or a message to the lead, and whether a visible turn appeared in the agent's transcript (threshold: none). Output: a written result in the run folder, `pass`/`fail` per threshold. The addressing question (`to` takes a name or an id) is answered by the spike. Thresholds are the human's at G2 (OQ3).

**034.b (only on a pass).** Interface kept small and injected:

```ts
type AgentPing = { ok: boolean; cost: number }          // cost in token-equivalents, as ping() computes it
type AgentPinger = ($: EngineInterface, agentId: string) => Promise<AgentPing>
const pingerOf: () => AgentPinger | undefined            // the 034.a result; undefined when not built
```

`pingRound($, t, now)` replaces the single `ping($)` call at line 545:

1. The main ping goes out in every round of an armed track whose arming came from a warm `main` entry (3.8). A track armed from agents only (034.b, `pingSubagents` on, no warm main entry at arming) sends no main ping in any round (`t.mainPings = false`, set at arming). When sent it decides `ok` for the track as today (`ping($, t.name)`); a miss ends the track (line 548) and no agent is pinged. The agent part below does not depend on step 1 being sent.
2. A round of an agents-only track counts as landed when at least one agent ping landed; a round with neither a main nor an agent ping to send ends the track as `expired, stopped` (nothing to keep warm). If `settings.pingSubagents && pingerOf()`: for each agent in `ledger.agents` with `status !== 'finished'` and a **warm** entry of `t.name`'s TTL (`cacheView`/entry `warmUntil > now`), call the pinger; add each `cost` to `spent`; feed its usage to `observe` under that `agentId`. A failing agent ping is logged and does not fail the round.
3. `t.pings++` once per round (line 550), cap by round (`pingCap` unchanged), the spend limit compares `spent >= budget` after the whole round (line 552), so every ping counts toward `budgetMultiplier` (Q17-3a).

A finished agent is never pinged, whatever the setting (AC-17.3.3); with the setting off the code path is the main-loop-only one and `pingerOf` is not read.

**Drop path.** If 034.a fails: remove nothing from sections 2 to 4; section 5 and 6's `pingRound` branch are not built; AC-17.3.2, 17.3.5, 17.3.6 go back to the human with the spike result.

## 7. AC to design to test

Seams (spec): the pure table in a new `tests/cache-state.test.ts` (alongside `keepalive.test.ts`), the keep-alive tests with the mock clock for line and state, and the auto-handoff harness for the forwarding. Test names begin with the AC id. Keep-alive tests set the clock with `clock.fire(minutes)` from `START` (2026-10-07 12:00 UTC); expected strings are built with `hhmm(START + n * MIN)` and compared to the E1 to E7 shapes. Usages are fed with `noteUsage($, usageOf(h, m, read), agentId?)`, a new test helper beside `row`.

| AC | Design | Test |
|---|---|---|
| AC-17.1.1 | `observe` main 5m, `lineOf`, Stop no-tasks | `AC-17.1.1 main 5m write, no tasks: E1` (keepalive.test.ts: `noteUsage` at +0, `clock.fire(1)`, `Stop(stop([]))`; `line('5m')` equals E1) |
| AC-17.1.2 | agent source, `cacheView` | `AC-17.1.2 a subagent-only 5m write is E2; with a main write E3` |
| AC-17.1.3 | per-TTL entries | `AC-17.1.3 a later 1h write does not switch 5m off` (both lines literal; pure row: a response with a 1h write and a read does not move the 5m entry) |
| AC-17.1.4 | `expired` | `AC-17.1.4 main 5m write at 10:00, read at 10:06: E4` |
| AC-17.1.5 | observe step 3 | `AC-17.1.5 a 5m hit refreshes to 10:09; a 1h read does not move the 1h entry` (pure table in cache-state.test.ts and one keep-alive test) |
| AC-17.2.1 | `reasonText`, Stop branches | `AC-17.2.1 each row of the reason table` (table-driven over: no tasks, no write seen, cache expired, turn running (published), session ended (published), disabled, no split, overage, each stopped text) plus a sweep asserting no rendered or published line matches `/: off$/` |
| AC-17.2.2 | no-tasks branch renders | `AC-17.2.2 (red today) a warm 5m cache with no tasks renders E1, not off and not absent` |
| AC-17.2.3 | ledger kept at turn start | `AC-17.2.3 a turn start after E3 keeps the cache part` |
| AC-17.3.1 **CONDITIONAL** (034.c, 034.a, `pingSubagents` on) | `armUntil(…, { agents: true })` | `AC-17.3.1 with pingSubagents on and 034.b built, a subagent-only 5m write arms the 5m track and the round pings only the agents` (stub `AgentPinger`; no `model.fork`) |
| arming after landed pings (clarify, T17.1) | `Track.pingWarmUntil` | `D1 arming: after landed 1h pings with no 1h write, a new Stop re-arms the 1h track (not expired, stopped); after a miss it does not; the cache part still shows the ledger time` (keep-alive test: fork usage with no 1h write, `clock.fire` to the first ping, a second turn and Stop; assert `armed` and the cache part unchanged) |
| landed ping (spec rev 3) | `observePing` | `D1 landed ping: a landed 5m ping refreshes the 5m entry whatever other entries exist; a landed 1h ping without a 1h write leaves the 1h entry` (pure table, plus a keep-alive test: 5m track, `clock.fire(3)`, the line's cache part moves to `main warm until` + 5m) |
| AC-17.3.8 | `onlyAgentsWarm`, `armUntil` main-only | `AC-17.3.8 a subagent-only warm cache with pingSubagents off: no arm, no model.fork, line is subagents warm until 10:07; off (only subagent caches; subagent pings off)` |
| D2a main (rev 5) | `pendingMain`, `needsMainSeed`, `seedMain` merge, `dropPending` | pure (cache-state.test.ts): `AC-17.1.1 (D2a main) a main write with no split sets pendingMain and records no entry; a read-only response or a write with a split does not`; `seedMain merges max and clears pending, never lowers a live entry`; `needsMainSeed`/`dropPending`. Keep-alive (keepalive.test.ts, mock clock, transcript fixture with a timestamped split row): `AC-17.1.4 (D2a main) after a first main entry, a no-split main write at 10:00 then Stop at 10:03 shows main warm until 10:05, not expired` (red today); `AC-17.1.1 (D2a main) no split in the transcript either: no entry added, one transcript read, a second Stop reads nothing`; `AC-17.1.1 (D2a main) a ping reply with a write and no split is resolved at the next Stop`; `AC-17.1.1 (D2a main) a row with no timestamp uses the response time, not the Stop time` |
| D2a | `observe` unknown marker, `subagentsUnknown` | `AC-17.1.2 (D2a) a subagent write without a split shows subagents: split unknown on both tracks and arms nothing` (pure and keep-alive) |
| ITEM-034.c | `logAgentUsage`, `logSubagentTranscript`, log-only `SubagentStop` handler | keepalive.test.ts, log-only (a `$.ui.log` spy; `AC-17.1.2 (034.c)` names): `logAgentUsage` with a split logs `agent=a1 split=present writes=<n>`, without a split `split=absent`; `registerKeepalive`'s `SubagentStop` handler with a transcript fixture (with and without a split row) logs `subagent transcript … rows=<n> split=present|absent`, with a missing path logs `rows=0 split=absent`, always calls `next(e)`, and does not throw when the read rejects. Each test also asserts the ledger is unchanged (`cacheView` before and after equal; no `model.fork`/`session.send`) and that `noteUsage` is not called from `register.tsx` for an agent response. The live check is a recorded manual step |
| AC-17.3.2, 17.3.5, 17.3.6 **CONDITIONAL** | `pingRound` | `AC-17.3.2 with pingSubagents on, a round pings main and the running subagent` (stub `AgentPinger`; also the off case: one ping); `AC-17.3.5 an idle teammate with a warm cache is pinged`; `AC-17.3.6 ping k/9 counts rounds and spend counts every ping` (a subagent cost makes `spent >= budget` earlier than the cap) |
| AC-17.3.3 | `status !== 'finished'` | `AC-17.3.3 a finished subagent is never pinged` (setting on and off) |
| AC-17.3.4 | per (source, TTL) ledger | `AC-17.3.4 5m and 1h writes from main and an agent are kept apart` (pure) |
| AC-17.3.7 | `cacheView`, `settleAgent`, the `SubagentStop` handler (3.7) | three cases, asserting `cachePart` only and no `model.fork`/`session.send` call (setting off). (1) `AC-17.3.7 a running subagent reads split unknown`: the agent's 5m write at 10:02 has no split, a Stop at 10:03 renders `subagents: split unknown` and arms nothing. (2) `AC-17.3.7 after SubagentStop the transcript split gives the warm window`: `SubagentStop` at 10:03:30 with a readable transcript whose row (timestamp 10:02) has a 5m split; a render at 10:04 reads `subagents warm until 10:07`, a Stop at 10:08 reads `subagents expired 10:07`; the `unknown` marker is gone. (3a) `AC-17.3.7 a SubagentStop with no transcript file is ignored` (the forked-helper case): an agent id the ledger has never seen and no file; the line is unchanged, the ledger has no entry for it, no `markAgent` happens and nothing arms. (3b) `AC-17.3.7 an unsettled marker stays split unknown`: a real agent with an earlier live `unknown` marker whose stop finds no file, or a file with no split row: the line still reads `subagents: split unknown`, the marker is kept and nothing arms |
| AC-17.4.1 | `arm` unchanged | `AC-17.4.1 (characterisation) the k-th landed 1h ping shows ping k/9` (the existing tests at :489, :552, :1737, renamed) |
| AC-17.4.2, 17.4.3, 17.4.6 | `arm` unchanged | the same: existing tests renamed to cite the AC id |
| AC-17.4.4 | live | manual; `MANUAL-CHECKS.md` row is the implementer's; steps in the stories |
| AC-17.4.5 | `pingsOf` + `first ping at` | `AC-17.4.5 (red first) ping 0/9, first ping at HH:MM` (replaces the assertions at :1446, :1465; :1496 stays) |
| AC-17.4.7, 17.5.1 to 17.5.3 | README | document checks, ITEM-036 (documentation-writer) |
| D1 forwarding | `register.tsx` | in `auto-handoff.test.tsx`: `AC-17.1.2 (forwarding) a turn.step with an agentId reaches the keep-alive ledger and auto-handoff's accounting is unchanged` (drives `$.turn.step`-level usage with and without `agentId`; asserts the `unmeasured` effect is main-only through the handoff threshold, and the ledger through a Stop line) |
| SubagentStop fallback | `splitFromAgentTranscript` | `AC-17.1.2 SubagentStop with no turn.step split records the transcript's split` (pure plus a keep-alive test with `agent_transcript_path`) |
| Published state | `caches?`, `line` | `AC-17.1.1 the published state carries caches and the line shown` (extend the `Published` type in the test) |

**Pinned tests that change.** The tests that assert a full line change mechanically, because the default fixture (a transcript with a 5m or 1h write) seeds the `main` entry and the line now has a cache part. Rule: tests asserting a keep-alive part (`ping 0/9`, `armed`, `stopped`, `warm until`, `missed`) keep `toContain`, or use a new helper `part(track)` returning the text after `; `. The roughly 50 assertions (counted by the build with `grep -c 'keepalive (5m|1h):'`, 49 on 2026-10-24) with an anchored `^keepalive …` regex or `toBe('keepalive …')` are rewritten to `part(track)` unless they test the cache part. Specific changes: `:414, :442, :452, :458, :472` (`keepalive 1h: off`, `keepalive 5m: off`) become the new reason texts; `:422-423, :435, :504-505` (`no cache write seen yet`) keep the text; `:616, :727` (`off in overage`) keep it; `:796, :823, :905` (published `line`) take the new line with the cache part; `:1446, :1465` take D6. Mechanical churn, one pass.

## 8. Tasks for `pm` (one per ITEM)

| Item | Scope | Depends on |
|---|---|---|
| ITEM-032 | `cache-state.ts` (`observe`, `seedMain`, `cacheView`, `hhmm`), `Track.part`, ledger replaces `lastSplit`, forwarding of main usage unchanged in `register.tsx`, tests for AC-17.1.1, 17.1.3 to 17.1.5, 17.3.4 | none |
| ITEM-033 | `reasonText`, `lineOf`, `render/publish(now)`, Stop no-tasks branch, turn start / session end parts, `caches?` in the published type, tests for AC-17.2.x | 032 |
| ITEM-034.c | the first task of 034, **decided** (human's live check, run.v4 2w): the debug log lines (3.7) stay; the result is D2a while a subagent runs and the transcript split at `SubagentStop` (3.7, rev 12), so AC-17.1.2, 17.3.4 (subagents) and 17.3.7 are built as the spec delta rev 4.6 reads | 033 |
| ITEM-034 | `noteUsage($, usage, agentId)`, `register.tsx` forwarding, `SubagentStart/Stop/TeammateIdle`, `armUntil` over agents, fallback, tests AC-17.1.2, 17.3.1, 17.3.3, 17.3.7 | 033 |
| ITEM-034.a | spike (section 6), result recorded | 034 |
| ITEM-034.b | `pingSubagents` setting, `pingRound`, tests AC-17.3.2, 17.3.5, 17.3.6; dropped when 034.a fails | 034.a |
| ITEM-035 | `first ping at`, characterisation tests renamed, AC-17.4.4 manual check | 033 (same file, after the `part` change) |
| ITEM-036 | README (documentation-writer, from the Docs update request), `ATTRIBUTION.md` entries by the implementer | 032 to 035 |

Merge group (one file, `keepalive.ts`): 032, 033, 034, 035 in that order.

## 9. Questions for `sa` (Refine)

1. (Closed by spec rev 2: main-only arming, AC-17.3.8.)
2. **Finished agents.** The LLD shows a finished agent's cache (it can be resumed by a message, so it is still warm) but never arms from it or pings it (`armUntil` skips finished agents). Confirm.
3. (Closed: sa decided `pingSubagents` is trust-gated; spec rev 3 says so and section 5 implements it.)
4. **E7 and the 1h refresh.** (Withdrawn proposal: deriving `t.warmUntil` from the ledger would shorten it and break AC-17.4.1.) The running text keeps `t.warmUntil`; the cache part comes from the ledger. They can differ live after a 1h ping with no 1h write (`main warm until 11:00; warm until 11:50`). This is displayed as it is and noted in the README by ITEM-036. Confirm.
5. **D2a display.** With only `unknown` agent writes on a track and nothing else, the line is `keepalive 5m: subagents: split unknown; off (no 5m cache write seen)`. The spec's "no entry at all gives the E5 form" and "show `subagents: split unknown` on both tracks" overlap here; the LLD shows the unknown element and keeps the reason. Confirm.
6. **Tests grow with the cache part.** The default test fixtures seed `main`, so many anchored line assertions change (section 7). Accept as mechanical churn in ITEM-033.

## 10. Risks

- `render`/`publish` taking `now` touches about fifteen call sites (3.3); each is a one-line change but all are in a single file, hence one merge group.
- The `store`-less `lineOf` at publish time uses the clock at publish; a state read later shows the line as of the last event, as `line` always did.
- The `SubagentStop` field names are from the engine types (`agent_id`, `agent_transcript_path`); the build confirms them against the installed Claude Code (the repo's `.scratch` copy is 2.1.308 and provisional, 15 in the stories).

---

# Revision 7 (17.1.17), amended by revision 8 (17.1.24): ITEM-068, both lines always, band, Pane, master and track session switches (US-17.6)

Inputs: `stories.delta-r4.md` (AC-17.6.1 to AC-17.6.32 and later; the file order is not by number, 17.1.l2.1 Minor 8), `keepalive-cache-status.spec.r4-delta.md` Part A (D10, D11 master button), research 17.1.12. Code lines are as read on 2026-10-25 (working tree, uncommitted T17.1 to T17.4 changes included). Nothing here reopens sections 1 to 10, except the string table (11.1), the Stop handler's master branch (12.3) and the pinned tests (15). **Rev 8 changes:** the human's master button replaces Q-SL4 and the D5 amendment "never override the master"; the switches are kept in `$.store` per session id (sa D10), not module memory; sections 11, 12, 13, 14, 16, 17 and 18 change accordingly.

## 11. Pure additions in `cache-state.ts` (D3 amended, D10/D11)

```ts
/** True for a keep-alive part that says the track is off: every reasonText() result. Stopped texts ('expired, stopped', 'missed, stopped', ...) are not off. */
export const isOffPart = (part: string): boolean => part === 'off' || part.startsWith('off ')

export type OffTail = { cap: number; keepWarm: string }          // keepWarm = formatDuration(keep.ms)
export const offTail = (t: OffTail): string => `, ping 0/${t.cap}, keep warm ${t.keepWarm}`

/** Rev 7: lineOf appends offTail(tail) when tail is given and isOffPart(part). Running and stopped parts ignore it. */
export const lineOf = (ttl: Ttl, cache: string | undefined, part: string, tail?: OffTail): string

export type Button = 'on' | 'off'
/** Rev 8 (D10/D11). The session switches: the master (keep-alive as a whole) and one per track. Absent = unset. */
export type SessionSwitch = { master?: Button; '5m'?: Button; '1h'?: Button }
/** Effective master: the session master, else the settings' `enabled`. */
export const masterOn = (sw: SessionSwitch, settingEnabled: boolean): boolean => sw.master ? sw.master === 'on' : settingEnabled
/** Effective track: the track switch (it overrides the master and the settings), else the master AND the track's own setting. */
export const trackOn = (sw: SessionSwitch, n: Ttl, settingEnabled: boolean, trackSetting: boolean): boolean =>
  sw[n] ? sw[n] === 'on' : masterOn(sw, settingEnabled) && trackSetting
/** A track press (rev 9, Q-SL8): [off] on an ENABLED track (trackOn true: switched on by switch, master or settings, running or not) sets its switch off, [on] on a track that is off sets it on. The master and the other track are untouched. */
export const afterTrackPress = (sw: SessionSwitch, n: Ttl, enabled: boolean): SessionSwitch => ({ ...sw, [n]: enabled ? 'off' : 'on' })
/** A master press: [off] sets the master off and clears both track switches; [on] sets the master on AND both track switches to 'on' (human, 2026-10-25, 17.1.24.l1.1: force both tracks on), so a track with `<track>.enabled: false` in a settings file still comes on for this session. */
export const afterMasterPress = (sw: SessionSwitch, settingEnabled: boolean): SessionSwitch =>
  masterOn(sw, settingEnabled) ? { master: 'off' } : { master: 'on', '5m': 'on', '1h': 'on' }

export type TrackRow = { track: Ttl; line: string; button: Button }          // button = enabled ? 'off' : 'on' (rev 9, Q-SL8: enabled = trackOn, not running)
export type BandModel = { title: 'keepalive'; master: Button; rows: TrackRow[] }   // rev 8: master = masterOn ? 'off' : 'on' (the button names the press); rows: 5m first, then 1h (Q-SL5 default); title is a constant (Q-SL2)
export const bandModel = (master: Button, lines: Record<Ttl, { line: string; enabled: boolean }>)   // enabled = trackEnabled(n, key), the one predicate the arming loop uses: BandModel
```

### 11.1 String table changes (replaces rows of 2.2)

| Piece | Text |
|---|---|
| off line | `lineOf(...)` of an off part ends `, ping 0/${cap}, keep warm ${d}` (E1' to E5', E8, E9; `off in overage, ping 0/20, keep warm 1h`) |
| `reasonText` | unchanged: the suffix is not part of a Reason (spec delta, Literals replaced) |

Why a predicate and not a flag on `Track`: about 20 assignment sites write `t.part`; a flag would be a second field to keep in step at each. `isOffPart` is one function whose domain is exactly the `reasonText` results, proved by one table test (every `Reason` is off; every stopped and running text is not). AC-17.2.1's sweep gains two checks: no line matches `/: off$/`, and no off line lacks `ping 0/`. Rejected: parsing the built line (it exists to be built, never parsed).

### 11.2 `keepalive.ts`

- `lineFor(t, now)` becomes `lineOf(t.name, cachePart(...), t.part, tailOf(t))`. `tailOf(t)` = `{ cap: capOf(t), keepWarm: formatDuration(keepOf(t).ms) }`, with `keepOf(t) = t.keep ?? { ms: cfgOf(t).keepWarmFor }` and `capOf(t) = pingCap(cfg.maxPings, cfg.pingEvery, keepOf(t))`. `trackStates` uses the same two helpers for `keepWarmMs` and `cap` (it computes them inline today). One source: the published `cap`/`keepWarmMs` and the suffix cannot differ (AC-17.6.2, 17.6.3).
- **The keep-warm text carries its source (rev 10, the human's decision 2; closes 17.1.l2.1 Major 3).** Every line with a keep-warm clause, off suffix and running line alike, writes ` keep warm <d> (<label>)`, `label` one of `session | machine | settings | default` (sa, 17.1.31). One pure function in `cache-state.ts`: `sourceLabel(keep: Keep)` over `keepWarm()`'s `from` (`keepalive.ts:467`, overrides at 455 to 463): `keep.override` with `from` starting `this session` -> `session`; `keep.override` with `from` starting `this machine` -> `machine`; `from === 'default'` -> `default`; any other `from` (the `<name> in <where>` form of `resolveSettings`, `settings.ts:261`: a settings file or env) -> `settings`. `Keep` gains no field. `OffTail` gains `source` beside `keepWarm`; `offTail` writes `, ping 0/${cap}, keep warm ${keepWarm} (${source})`; `runningText` (`keepalive.ts:606`) writes `keep warm ${formatDuration(keep.ms)} (${sourceLabel(keep)})`. Published: additive `KeepaliveTrackState.keepWarmFrom: 'session' | 'machine' | 'settings' | 'default'` in `types/index.d.ts`, from the same `keepOf(t)` as the line (one source). The command's report keeps its long form (`this session, /ai-dlc:cache-keepalive`, `keepalive.ts:521`). **Setting `sourceNote` (follow-up 17.1.32.l1.1, sa):** `SETTINGS` row `{ key: 'sourceNote', env: 'AI_DLC_KEEPALIVE_SOURCE_NOTE', kind: 'boolean', default: true }`, **not** trust-gated (display only, so it is not added to `TRUST_GATED`). With `false`, `offTail` and `runningText` write no ` (<label>)` on any line (the tail takes `source: undefined`, and `lineOf`/`runningText` print the label only when it is defined); `keepWarmFrom` is still published and the command report is unchanged. It is a key of `.ai-dlc/cache-keepalive.json`, listed by `/ai-dlc:cache-keepalive-configure` with `handoff.carryOver` and `handoff.onWhenOff` (the skill's schema and its listing gain the three rows) and pinned in the README settings table by the settings test (Docs update request for the table). The running line therefore changes, so AC-17.6.4 ("byte for byte as before") needs the label (ra restates it with AC-17.6.3). Tests: `sourceLabel` table over the four cases; `sourceNote: false` gives every line with no label (running, off, every label) and the published `keepWarmFrom` unchanged; `lineOf` with each label; a `runningText` snapshot; `trackStates().keepWarmFrom`; every existing assertion on `keep warm <d>` takes the label (mechanical, ITEM-068). README *Status lines* line 39 and line 27's example then match the code: a Docs update request for `documentation-writer` (ITEM-036), not an edit here.
- Both lines always (AC-17.6.1): `render` maps every `TRACKS` entry and rev 3 never drops a track. Rev 8: the early return is `!settings.status || !anyOn()` (12.2), so a session where nothing is on by settings or switch hides the status line as `enabled: false` did. **This is the human's decision 1 (2026-10-25; closes 17.1.l2.1 Major 2): the hide stays, the band and the Pane still draw both rows (`off (disabled)`, `[on]`), and the seed line hides with the status line. It is covered by the new AC of ra (17.1.30, "status line when nothing is allowed") and spec D3 (sa); this LLD cites it as AC-17.6.33.** AC-17.6.5: `status:false` hides status line, band and Pane. Band and Pane draw whatever `enabled` says (AC-17.6.19 superseded, 12.4).

## 12. Session switches (D10, D11, rev 8), in `$.store`, and their relation to `--session`

### 12.1 Precedence and the presses

| Level | Decides | Set by |
|---|---|---|
| Track switch (`on`/`off`/unset) | that track, over everything below | the track button |
| Master switch (`on`/`off`/unset) | every track without a track switch | the master button; else the settings' `enabled` |
| Settings | `enabled` AND `<track>.enabled` | files, env |

Examples (the cases the human named): master off, 5m switch on: the 5m track may arm, 1h is `off (disabled)`. 1h `[off]` pressed with master on: master unchanged, 5m unaffected. Master `[off]` pressed: master off, both track switches cleared, both running tracks stopped now with `disabled`. Master `[on]` pressed (17.1.24.l1.1, the human: force both tracks on): master `on` and both track switches `on`, so a track with `<track>.enabled: false` in a settings file still comes on for this session, and so does keep-alive over `enabled: false`. The master button shows the same either way. The master button shows `[off]` when the effective master is on, else `[on]`; a track armed by its own switch under a master `[on]` button is allowed (the button names the master, not the tracks); with both switches forced `on`, `trackOn` is true for both tracks until a track `[off]` or a master `[off]`.

### 12.2 Storage (sa D10: `$.store` per session id, not module memory)

```ts
// keepalive.ts  (rev 10: the first element of each pair is the CHAIN id, section 19; a session in no chain is a chain of one, its own id)
const switchKey = 'keepalive:switch:sessions'                       // [chainId, SessionSwitch][], bounded by settings.sessionOverridesMax, like sessionKey(n)
let switchMirror: { id: string; sw: SessionSwitch } | undefined      // a copy of this session's entry; the store is the truth
async function loadSwitch($): Promise<SessionSwitch>                 // id = (await chainIdOf($)).id (rev 10; was $.session.id()); re-reads the store when the mirror's id differs or the mirror is empty
async function saveSwitch($, sw: SessionSwitch): Promise<void>       // writes the list (entry dropped when sw is empty), then the mirror; a store failure is logged to debug and the mirror still holds the value
const curSwitch = (): SessionSwitch => switchMirror?.sw ?? {}
const masterNow = (): boolean => masterOn(curSwitch(), settings.enabled)
const trackEnabled = (n: TrackName, key: TrackKey): boolean => trackOn(curSwitch(), n, settings.enabled, settings[key].enabled)
const anyOn = (): boolean => masterNow() || TRACKS.some(([n, k]) => trackEnabled(n, k))
```

- **Why a mirror over the store.** `render`, `publish`, `trackStates` and `lineFor` are synchronous and have about fifteen call sites (3.3); `$.store` is async. Each handler that renders awaits `loadSwitch($)` once at its top (`turn.start`, Stop, `session.measure`, `command.run`, both presses, `keepaliveBand`, the Pane hook), after which every synchronous read sees the session's value. The store is written on every press, so a `/reload-plugins` or module restart loses nothing: the first handler after it reloads the entry (the reason for D10). Single writer, one session id, so the mirror cannot go stale.
- Reads replaced: every `settings.enabled` read in `keepalive.ts` (lines 258, 270, 729, 772, 786, 906 as read) becomes `masterNow()`, `anyOn()` or `trackEnabled`, and `settings[key].enabled` at 772 and 807 becomes `trackEnabled(n, key)`: the published `enabled` is `masterNow()`; the status line and the early return use `anyOn()`; the command's `enabled=false` reply (906) fires when `!anyOn()`.
- Cleared at `session.end` (AC-17.6.18), **except inside an auto-handoff chain (rev 10, section 19)**: the list is keyed by the chain id, and a `session.end` fired by a handoff's `/clear` deletes nothing. A session the human starts by hand is a chain of one: its entry is deleted at its own `session.end` and a new session starts unset. A resume of an ended id starts unset (not asked to keep it).
- Settings files are never written by a press (AC-17.6.17); the only writes are `$.store.set(switchKey, ...)`.

### 12.3 Presses and the Stop handler

```ts
export async function pressTrack($, n: TrackName): Promise<void>
export async function pressMaster($): Promise<void>
```

Both never throw (a failure goes to the debug log) and end with `await saveSwitch`, `await refreshKeep($)`, `render($, await $.clock.now())`.

- AC-17.6.12 and AC-17.6.32 (Q-SL8) are built by the enabled branch below; AC-17.6.32 is cited in section 14 (closes 17.1.l2.1 Minors 5 and 6 here; the spec's D10 row is sa's).
- `pressTrack`: `sw = afterTrackPress(await loadSwitch($), n, trackEnabled(n, key))`. Rev 9 (Q-SL8): the label and the press follow enabled (`trackOn`), never `t.timer`.
  - Enabled (the press is `[off]`; running or not): if running, `stopTrack(t)`; then `t.part = reasonText('disabled')` (AC-17.6.13; `stopTrack` bumps `generation`, so a ping in flight cannot rearm). `pingWarmUntil` is kept. The master is untouched (a track `[off]` never changes it).
  - Off (the press is `[on]`; a disabled track is never running): no ping. If `t.part` is the `disabled` text it becomes `isEmpty(ledger, n) ? { noWrite: n } : 'noTasks'` (AC-17.6.15: E9 to E1'); other parts (`off (turn running)`, stopped lines) stay until the next Stop. It arms only at a Stop with background tasks (Q-SL1, accepted) because the arming loop reads `trackEnabled`.
  - The old step "`!settings.enabled`: return" is gone: a track `[on]` works at master off (it overrides the master).
- `pressMaster`: `was = masterNow(); sw = afterMasterPress(await loadSwitch($), settings.enabled)`.
  - Turning off (`was`): every running track `stopTrack(t)`; every track's `t.part = reasonText('disabled')` (the track switches are cleared, so none is on).
  - Turning on: both track switches are `on` (`trackEnabled` is true for both), so each track not running whose `t.part` is the `disabled` text gets the "not running" reason above (E9 to E1' form), whatever its own setting. A track running is untouched. No ping; arming at the next Stop (Q-SL1).
- **Stop handler (3.4) amended.** The branch "`!settings.enabled` (after load, when tasks > 0): stopAll; parts disabled; return" is removed. The per-track loop already ends each track at `disabled`, and its test becomes `!trackEnabled(n, key)`; with every track off the result equals the old branch (stopAll, `disabled` parts, status cleared by `anyOn()`), and with a track switch on that track alone arms. The no-tasks branch (3.4) uses `trackEnabled` in place of `settings[key].enabled`. Settings are still loaded first, so `life()` and the lines use the fresh values.
- Published (AC-17.6.20): `KeepaliveTrackState.sessionSwitch?: 'on' | 'off'` per track and `KeepaliveState.sessionMaster?: 'on' | 'off'` beside it in `types/index.d.ts`, both additive, omitted when unset (sa D11 name).
- Command report (AC-17.6.21): `switchText()` returns, for the set switches, `keep-alive: on|off for this session` for the master and `<5m|1h> track: on|off for this session` for a track, joined by `; `, master first, then 5m, then 1h, only the set ones (for example `keep-alive: off for this session; 5m track: on for this session`), `''` when none; AC-17.6.21 quotes exactly this form (agreed with ra, 17.1.30; closes 17.1.l2.1 Minor 4); appended to the ping reply, the set/clear reply and the `enabled=false` reply, not to the usage error.
- **Relation to `/ai-dlc:cache-keepalive --session`.** Same store and same key shape (a list of [session id, value], bounded by `sessionOverridesMax`), different dimension, no shared state:

| | overrides | store key | lives until |
|---|---|---|---|
| `--session` | the keep-warm duration | `keepalive:keepWarmFor:sessions:<track>` | cleared, per session id |
| session switches | master and track `enabled` | `keepalive:switch:sessions` | `session.end` deletes the entry |

  A switched-off track still shows the `--session` duration in its off suffix (AC-17.6.3); `[on]` does not clear a duration; `clear` does not touch the switches.
- **No ADR** (agrees with sa): session-scoped, reversible, uses the existing store.

### 12.4 Superseded

AC-17.6.19 ("a press is ignored when `enabled: false`, Q-SL4") is superseded by AC-17.6.31 (with `enabled:false`, a track `[on]` enables that track for the session) and the master ACs 17.6.23 to 6.30 (analyst, 17.1.22). This LLD builds: with `enabled: false` both lines read `off (disabled)` with the suffix, the master shows `[on]`, a press of any button works.

## 13. The band and the Pane (D9)

*The title row, the title of `ui.open` and the roster shown in this section are amended by 20.6 (rev 11), which wins.*

One component, two hosts, so the rows cannot differ (AC-17.6.9).

```tsx
// hooks/keepalive/panel.tsx  (new; draws only, like auto-handoff/panel.tsx: the host never follows $ across an import)
type Elements = { Box: any; Text: any; Button: any }
export function keepaliveTree({ Box, Text, Button }: Elements, m: BandModel, onPress: (t: Ttl) => void, onMaster: () => void): JSX.Element
export const bandText = (m: BandModel): string      // plain text, one row per line, for tests
```

- Tree: `Box flexDirection="column" gap={0}`; a **title row**, `Box flexDirection="row" gap={0}` holding `Text bold` `keepalive` and `Button key="ka-master" label={m.master} onPress={onMaster}`; then per track row a `Box flexDirection="row" gap={0}` holding the line as `Text` and one `Button key={`ka-${track}`} label={button} onPress={() => onPress(track)}`. No margin or padding props; `gap={0}` explicit. The terminal draws a Button as `[ label ]` (d.ts 1093 to 1198); `bandText` writes `keepalive [on]`/`keepalive [off]` for the title row and `[on]`/`[off]` per row for tests; the drawn form is confirmed in AC-17.6.7.
- **Q-SL6 answered: yes, per the types.** `Space` is "a number of character cells, the same on every surface" (d.ts 12727 to 12734), so `0` is zero cells, and a Box with no spacing props has none. Residual: a Button's own chrome, and Desktop's `xs` between Buttons of a row with no gap (one Button per row here, so none). AC-17.6.7 stays the live check; the design does not change either way.
- **Row order (Q-SL5).** `bandModel` puts 5m first; the status line and `tracks` keep 1h first (default). One constant.
- **Band (Terminal, Desktop): shares auto-handoff's one AbovePrompt hook.** The band is one instance ("a hook draws a tree, or passes"); two hooks that both return a tree would hide each other, and whether `next(e)` hands back the inner tree is not documented. So `auto-handoff/register.tsx:974` becomes the one composer:

```tsx
on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
  if (e.props.hasSurvey) return next(e)                         // yields to a survey, as today
  const t = $.ui.resolve(e)
  const ka = await keepaliveBand($, t)                          // keepalive.ts: a tree, or undefined when status is false
  const ho = shown ? panelTree(t, shown, frame, () => hidePanel($)) : undefined
  return ho || ka ? <t.Box flexDirection="column">{ho}{ka}</t.Box> : next(e)
})
```

  `keepaliveBand($, t)` (exported from `keepalive.ts`) = `settings.status ? keepaliveTree(t, bandModelNow(await loadSwitch($)), n => pressTrack($, n), () => pressMaster($)) : undefined`. `isWorking` is not read: the band stays during a turn (Q-SL3 default, AC-17.6.8). Auto-handoff's panel draws above, keep-alive below. Rejected: a second hook in `registerKeepalive` (hides or is hidden). The pure tree stays in `keepalive/`; only the composition line is in `register.tsx`.
- **Redraw.** `publish()` and every `render()` end with `$.ui.invalidate('ui.render')`, the call auto-handoff's `showPanel` uses (`register.tsx:703`), so band and Pane redraw on every line change and press (AC-17.6.10). Cheap when `status` is false (the hook draws nothing).
- **Pane (VS Code).** `PANE = 'keepalive'` (1 to 64 of letters, digits, `_`, `-`). A hook in `registerKeepalive`: `on('ui.render', { component: 'Pane', requestId: PANE }, ...)` returns `keepaliveTree` over the same model (title row and master button included, so the text is identical, AC-17.6.9). A Pane has its own `requestId`, so no composition problem.
- **Which surface.** `$.session.surfaces()` lists the attached surfaces and includes `'vscode'` (d.ts 2865 to 2875), so no guess. `/ai-dlc:cache-keepalive` with no arguments, after its ping and report, runs `if ((await $.session.surfaces()).includes('vscode')) await $.ui.open({ id: PANE, title: 'keepalive', closeOnEscape: true })`. Asked by a command, it is placed at any width (d.ts 2519 to 2522); `isPlaced: false` appends `; pane not shown (${reason})` to the reply. On Terminal/Desktop the command opens nothing (the band is there). AbovePrompt is not raised on VS Code, so band and Pane never both draw. A session attached to both gets both. Seam: stub `surfaces`.
- The Pane stays until the person closes it; there is no pinned Pane (17.1.12). Presses run `onPress`/`onMaster` in the plugin (`ui.press`); no `hotkey` is set (VS Code ignores it).

## 14. Test seams (ITEM-068)

| Seam | Observes | ACs |
|---|---|---|
| Pure, `cache-state.test.ts` | `isOffPart` over every `Reason` and stopped text; `lineOf` with `OffTail`: E1' to E5', E8, E9, the overage suffix; `bandModel` rows, order, buttons, `master`; **rev 8:** `masterOn` / `trackOn` truth table (master switch x track switch x two settings), `afterTrackPress` (master and the other track untouched), `afterMasterPress` (`[off]`: `{ master: 'off' }`; `[on]`: master and both track switches `on`, also over a track setting `enabled:false`; the Q-SL7 line) | 17.6.1, 6.2, 6.3, 6.4, 6.12, AC-17.6.23 to 6.31; rev 10: `sourceLabel` over its four cases, `lineOf` with each label |
| Pure, `tests/panel.test.tsx` (keep-alive) | `bandText(keepaliveTree(stub elements, ...))`: title row with the master button, two rows, `[on]`/`[off]`, no blank row; the press stub is called with the track, the master stub with no argument | 17.6.6, 6.8, 6.10, 6.12, AC-17.6.23 to 6.31 |
| Keep-alive, mock clock, in-memory `$.store` stub | `pressTrack`: running 1h `[off]` then zero pings after `clock.fire`; E9 after a press; `[on]` sends no ping and E9 becomes E1'; arms only at the next Stop with tasks. **Rev 8:** master `[off]` stops both running tracks, both lines `off (disabled)`, switches cleared; master off then 5m `[on]` arms at the next Stop while 1h does not; a track `[off]` leaves the master and the other track; master `[on]` after `[off]`; settings `enabled:false` plus a press works (supersedes 6.19); `session.end` deletes the store entry; a forgotten mirror (test-only `forgetSwitchMirror()`) reloads the switch from the store; published `sessionSwitch` and `sessionMaster`; no settings-file write (spy on the file writer, fixture bytes and mtimes). **Rev 9 (Q-SL8; AC-17.6.12 revised, AC-17.6.15, 6.16, 6.26, 6.28 and 6.31 also assert the pressed button turns `[off]`; new AC-17.6.32: `[off]` on an enabled, not-running track disables it, shows the E9 line and `[on]`, and does not arm it):** the button follows enabled, not running: `[off]` on a track that is enabled but has not started pinging (E1' no tasks, `off (turn running)`), `[on]` only when disabled; pressing `[off]` on an enabled idle track sets its switch off and its part to `off (disabled)` with no timer to stop; `bandModel` over `enabled` x `running` (four cases) | 17.6.13 to 6.20, AC-17.6.23 to 6.32 |
| Command | the report names the master and track switches; `surfaces` stub `['vscode']` calls `ui.open({ id: 'keepalive' })`, `['terminal']` does not; `isPlaced:false` appends the note | 17.6.9, 6.21 |
| Auto-handoff harness | the composed AbovePrompt hook: both up, keep-alive only, handoff only, neither (`next`), `hasSurvey` | 17.6.7 (non-manual part) |
| Manual | pinned band, no gap; the Pane opens and clicks work (title-row master button included); the press script | 17.6.7, 6.11, 6.22 |

## 15. Pinned tests that change (adds to section 7)

Every test asserting an off line takes the suffix; `part(track)` includes it. Auto-handoff band tests that expect `next(e)` with no panel now see the keep-alive band; they set `status:false` or assert the composed tree. Rev 8: the tests of the `!settings.enabled` Stop branch and of "press ignored at `enabled:false`" are rewritten to the master rules. Mechanical, one pass, in ITEM-068 (not ITEM-033).

## 16. Order, size and merge group

ITEM-068 follows 035 in the `keepalive.ts` merge group (032, 033, 034, 035, 068); its `register.tsx` hunk is one hook. It does not depend on 034.b. E2'/E3' are firm since 034.c (decided: 3.7, rev 12). **Size: 4 agent sessions (rev 7: 3).** The master button, the store-backed switches with their mirror, the precedence functions and the Stop-branch rework add one session; the suffix, band composition, Pane, command and about 50 pinned tests are the rest.

## 17. Risks (rev 8)

- Composition: a future second AbovePrompt hook in another plugin would hide this one; only this repository's two plugins are known.
- `isOffPart` depends on `reasonText` keeping the `off` lead; the table test guards it.
- Removing the `!settings.enabled` Stop branch changes a path many keep-alive tests touch; the all-off equivalence is asserted by one test before the rewrite.
- The mirror is a second copy of the store entry: a handler that renders without calling `loadSwitch` first would use `{}`. Mitigation: `loadSwitch` is the first line of each listed handler, and a test per handler.
- The Button's drawn form and Desktop spacing are live-check facts (AC-17.6.7).
- **Resolved (17.1.l2.1 Minor 9, rev 10):** a track the human pressed `[off]` used to re-arm in the seeded session, because `stopForHandoff`'s `/clear` fires `session.end`, which deleted the switch entry. With the chain key (section 19) a handoff's `session.end` deletes nothing, so the seeded session keeps the switches. A session started by hand, or an ordinary `/clear`, still starts unset, by design.

## 18. Clarify and open

- **Q-SL7 answered by the human (2026-10-25), final (17.1.24.l1.1): force both tracks on.** Master `[on]` sets the master and both track switches to `on` (a track with `enabled:false` in a settings file still comes on for this session); master `[off]` sets the master off, clears both track switches and stops both now. Built in `afterMasterPress`. **Resolved:** the stories (rev 4.2) already carry the reading (17.1.l2.1 Minor 7).
- Q-SL4 and the D5 amendment are replaced by the master button (12.1). Q-SL1 accepted (`[on]` arms only at a turn end with background tasks, D5 unchanged). Q-SL2, Q-SL3, Q-SL5 stay defaults; Q-SL6 answered in section 13.
- To requirement-analyst: new ACs for the master (button present in the title row; master `[off]` stops and disables both; track `[on]` overrides a master `[off]`; track `[off]` leaves the master; master survives a reload via the store), AC-17.6.19 superseded, AC-17.6.20/21 extended with `sessionMaster` and the master line. Ids assigned by the analyst: AC-17.6.23 to 6.30 are now assigned (6.29 reload test seam: test-only `forgetSwitchMirror()` in 14).
- **Resolved (rev 10):** the human decided a source note is owed on every keep-warm clause (11.2); the README is corrected by a Docs update request to `documentation-writer`, not by this LLD.

---

# Revision 10 (17.1.32): an auto-handoff chain is one session (ITEM-076)

Inputs: the human's decisions 3 and 2o (2026-10-25, `run.v4.md`), sa's design (17.1.31, chain id, key names). Code lines as read on 2026-10-25. Nothing in sections 1 to 18 changes except as marked there. **Size: ITEM-076 = 2 sessions (T17.7), after ITEM-068; unchanged by the follow-up (the exception reuses `afterMasterPress`, and `sourceNote` is one `SETTINGS` row plus a guard in `lineOf`/`runningText`, counted in ITEM-068's pinned-test pass)** (it needs the switch store of section 12).

## 19. The chain is the unit of per-session state

### 19.1 Chain identity

- `chainIdOf($)` in a new `hooks/auto-handoff/chain.ts` (named `chainIdOf` because `register.tsx:3` already imports a different `chainOf(all, sessionId)` from `viewer.ts`; the two must not share a name; a shared file both modules can import; `keepalive.ts` already imports `auto-handoff/config.ts`, so the direction of the import is the existing one, and `register.tsx` is not imported by keep-alive). It reads `lineage:<$.session.id()>` from `$.store` (written by the seed step, `register.tsx:1039-1040`, from `chain = own?.chain ?? sessionId`, `register.tsx:464`) and returns `{ id: lineage.chain }`; no record: `{ id: <own session id> }`; a read that throws: `{ id: <own session id>, failed: true }` plus one debug-log line (the numbering LLD's rule for a failed read, `auto-handoff-session-numbering.spec.md` D3: the chain restarts, accepted). `chainSessions($)` walks `lineage:<id>.from` upward (at most 50 steps, a cycle stops it) and returns the session ids, newest first; the Cache Lab uses it (cache-lab.lld.md, 7.2).
- A hand-started session has no lineage record, so its chain is itself and its state starts clean. The seed's `lineage:<new>` record is written before the seeded session's first turn (`register.tsx:1039-1040`), and keep-alive handlers read the chain at their top (`loadSwitch`), so no handler of the seeded session sees the wrong id.
- **Settings.** In `SETTINGS` (`settings.ts`), flat `handoff.*` keys by the dot convention (`oneHour.enabled` -> `AI_DLC_KEEPALIVE_1H_ENABLED`): `handoff.carryOver`, env `AI_DLC_KEEPALIVE_HANDOFF_CARRY_OVER`, boolean, default `true`, not trust-gated (`false`: key by the session id, so a handoff starts clean); `handoff.onWhenOff`, env `AI_DLC_KEEPALIVE_HANDOFF_ON_WHEN_OFF`, boolean, default `true`, added to `TRUST_GATED` (`settings.ts:85`; it can turn keep-alive on, which spends tokens). Both are listed by `/ai-dlc:cache-keepalive-configure` and are keys of `.ai-dlc/cache-keepalive.json` (a `handoff` object), together with `sourceNote` (11.2); the configure skill's schema and the settings README table pin gain three rows (`sourceNote`, `handoff.carryOver`, `handoff.onWhenOff`).

### 19.2 What moves to the chain key

`keepalive:switch:sessions` (12.2), and the `--session` override list `keepalive:keepWarmFor:sessions:<track>` (`keepalive.ts:31, 455, 512, 560`: `$.session.id()` -> `(await chainIdOf($)).id`; `sessionOverridesMax` still bounds both). `keepWarm($, key, { session: false })` at `session.end` (`keepalive.ts:~870`) still means "this session's override left out", used only when the chain is not continuing. Not carried: timers (`stopForHandoff` stops them, unchanged), the ledger (emptied; the seed turn's first usage refills it: the cache is the same prefix, so the first request reads it), the ping count of an arming, the budget.

**`spent` is not carried (answer to sa).** `spent` and `budget` are reset together at every arming (`keepalive.ts:802-803`) and at `session.end` (862-863); `budget` is recomputed from the context size (`budgetMultiplier x ctx.tokens`), which is small after a `/clear`. Carrying `spent` changes no arming and no tick (a tick runs only after an arming, which zeroes `spent`); its only visible effect is the manual `/ai-dlc:cache-keepalive` report (`keepalive.ts:546`, `spent N of M`) before the first arming, where an old-session `spent` could exceed the new, smaller `budget` and read as an overrun that is not real. So: drop it. Nothing else in the file reads `spent` across a turn.

### 19.3 `session.end` in a handoff

`registerKeepalive` takes `handingOff` today (`register.tsx:825`: `inFlight || pending !== undefined`). `session.end` (`keepalive.ts:858`) deletes the switch entry only when `!handingOff()` or `handoff.carryOver` is false; otherwise it stops timers, empties the ledger and resets its module variables as now, and leaves the store alone. The entry is bounded by `sessionOverridesMax`, so it cannot grow for ever.

### 19.4 The exception: keep-alive was off at the handoff (`handoff.onWhenOff`; Q-SL9, Q-SL10)

`applyHandoffSeed($)` is exported from `keepalive.ts` and called from the seed branch of `classic.SessionStart` in `register.tsx` (`source === 'clear'` with `pending`, lines ~1006-1030), right after the lineage record is written (1040) and before `$.prompt.submit`; a hand-typed `/clear` never reaches it, so it runs **once per handoff**. It runs `await loadSwitch($)` and, when `handoff.onWhenOff` is true and `!masterNow()` (the chain's effective master: its switch, else the settings' `enabled`), saves `afterMasterPress(sw, settings.enabled)`: **the exception acts like a master `[on]` press (the human, Q-SL9): the master `on` AND both track switches `on`**, so even a track with `<track>.enabled: false` in a settings file comes on for this chain (D11), and a track `[off]` the human pressed earlier is overwritten (the master was off, which had cleared both track switches anyway). It is the same pure function as the button (`afterMasterPress`), so the two cannot differ. No ping and no arming at the seed (Q-SL1: arming stays at a Stop with tasks). **A master `[off]` pressed in S1 is invisible to this test when `handoff.carryOver` is false** (the key is the seeded session's own id, so only the settings' `enabled` speaks: AC-17.7.6 says the master is off by settings, `enabled: false`; a master `[off]` pressed in S1 does not trigger the exception with `carryOver: false`, and S2 starts with the master the settings say). It applies with `handoff.carryOver` false too (Q-SL10): the key is then the seeded session's own id, `loadSwitch` finds nothing, `masterNow()` reads the settings' `enabled`, and when that is off the press runs on the fresh entry. A store failure goes to the debug log and the mirror holds the value (as `saveSwitch`). If keep-alive was on, the carry-over is just the shared key: no copy, and `applyHandoffSeed` changes nothing.

### 19.5 The prefix never changes (human 2n, c)

The carry-over and the exception write only `$.store` and module variables. They never set the model or effort, write a settings file, a context file or the seed text, and send no message or ping. Tests: with carry-over on and off the seed text of `register.tsx:~1068` is byte-identical; spies on `$.fs.write` (no write beyond the existing brief and lineage files), on any model or effort setter and on `$.prompt.submit` (called once, by the existing seed) see nothing new from `applyHandoffSeed`; the existing seed cache line test (`keepalive seed: cache hit, 30k read`) still passes.

### 19.6 Tests (ITEM-076)

Pure/store-stub: `chainIdOf` (found, absent, failed with the log line, a 51-step chain stops); switches set in session A are seen under session B of the same chain and not under an unrelated session; `handoff.carryOver: false` keys by session id; a `session.end` with `handingOff()` true keeps the entry, false deletes it; `applyHandoffSeed` with master off sets the master and both track switches `on` (equal to `afterMasterPress`; also over a settings `<track>.enabled: false`; a track `[off]` set before the handoff does not survive), with master on changes nothing, with `onWhenOff: false` changes nothing, with `carryOver: false` and `enabled: false` it still applies on the fresh session entry (Q-SL10), a second call is idempotent, and no ping is sent; the `--session` keep-warm override survives a handoff; `spent` is 0 in the seeded session. Seed seam: the `classic.SessionStart` clear-with-pending test of auto-handoff calls `applyHandoffSeed` once and a plain clear does not. Mechanical: the pinned `session.end` test of 12.2 gains the `handingOff` cases.

### 19.7 Risks

- `handoff.onWhenOff` turns keep-alive on, and both tracks even over `<track>.enabled: false`, for a person who had it off; hence trust-gated and a settings key. Default `true` is the human's decision (Q-SL9).
- A failed lineage read splits the chain (the numbering spec accepts it); the debug-log line is the only trace.
- The chain's sessions are all in one `$.store`; whether the lens plugin's store is the same store is not verified, so the lens gets the chain from published state (cache-lab.lld.md, 7.2), not from `lineage:`.

---

# Revision 11 (17.1.37): the status-line summary, `statusText`, title row and seed row (D13, ITEM-068)

Inputs: spec delta rev 4.4 (`keepalive-cache-status.spec.r4-delta.md`, D13 and Q-SL11 closed by the human 2026-10-25, run.v4.md 2v) and the architect's hand-back 17.1.35. The status line cannot draw a newline, so it gets a one-line **summary** on a terminal; the **full text** (today's track lines and seed line, `\n`-joined) stays what `line` publishes and what the band and Pane draw. Code lines are the architect's citations and rev 10's; the build re-reads them. Nothing in sections 1 to 19 changes except as marked.

## 20. Amendments, by section

### 20.1 Sections 2.2 and 11.1: strings

- `lineOf`, `reasonText`, the off suffix and the source note are **unchanged**: they build the full text. The summary strings are new and live in one pure function (20.2); no existing literal is edited, so every rev 10 line assertion stands.
- Summary token table (spec D13), the literals the tests compare: running with a landed ping `<ttl> warm <H:MM>, ping <n>/<cap>`; running before the first ping `<ttl> warm <H:MM>, first ping <H:MM>`; stopped `<ttl> stopped: <kind>[, warm <H:MM>]`; off `<ttl> off`, `<ttl> expired`, `<ttl> off (overage)`; waiting `<ttl> idle (<why>)`; seed `seed hit <k>` or `seed miss`. Joined `keepalive <1h token> | <5m token>[ | <seed token>]` (1h first, as the status line's track order).
- `Reason` to token: `noTasks` `idle (no tasks)`; `{ noWrite }` `idle (no write)`; `noSplit` `idle (no write yet)`; `turnRunning` `idle (turn)`; `onlySubagents` `idle (subagents)`; `sessionEnded` `idle (ended)`; `disabled` `off`; `expired` `expired`; `overage` `off (overage)` (a track never armed because the turn ended in overage; a track stopped by overage is `<ttl> stopped: overage`, no warm clause). Compaction (spec rev 4.5): `<ttl> compacting` while running, then `<ttl> compacted`, `<ttl> compaction skipped` or `<ttl> compaction refused`. An exhaustive `switch` with a `never` check, so a new `Reason` fails the build.

### 20.2 Section 11 (pure additions in `cache-state.ts`): `summaryOf`

```ts
export type StopKind = 'done' | 'ping limit' | 'spend limit' | 'missed' | 'error' | 'expired' | 'handoff' | 'overage'   // 'overage' added by sa, spec rev 4.5
export type StatusMode = 'full' | 'summary'
/** What the summary needs from one track, built by keepalive.ts from Track state; never parsed from a line (11.1: a line is built, never parsed). */
export type TrackFacts =
  | { kind: 'running'; warmUntil: number; pings: number; cap: number; firstPingAt?: number }   // firstPingAt set while pings === 0
  | { kind: 'stopped'; stop: StopKind; warmUntil?: number }          // warmUntil only for done, ping limit, spend limit
  | { kind: 'off'; reason: Reason }
  | { kind: 'compaction'; phase: 'compacting' | 'compacted' | 'skipped' | 'refused' }   // counts, cache read and reason stay in the full text only
export type SeedFact = { hit: true; tokens: number } | { hit: false }      // the existing `k()` formatter, moved here if it is not already
export const SUMMARY_MAX = 72
/** D13. Total and pure. Builds the full summary; while longer than SUMMARY_MAX drops (1) the seed token, then (2) every `warm <H:MM>` clause (an off or idle token has none). A running token without its clause reads `<ttl> ping <n>/<cap>` or `<ttl> first ping <H:MM>`; a stopped one `<ttl> stopped: <kind>`. Never a third step (spec: the longest result is under 62). */
export function summaryOf(facts: Record<Ttl, TrackFacts>, seed: SeedFact | undefined): string
/** D13 surface rule: 'full' when the roster is non-empty and every entry is 'vscode', else 'summary'. */
export const surfaceMode = (surfaces: readonly string[]): StatusMode
export type StatusTextSetting = 'auto' | 'summary' | 'full'
/** The mode in force: `summary` and `full` override the rule and the roster is not consulted; `auto` is surfaceMode(surfaces). */
export const statusModeOf = (setting: StatusTextSetting, surfaces: readonly string[]): StatusMode
/** The one chooser: 'full' returns fullText unchanged, 'summary' returns summaryOf(...). */
export const statusTextOf = (mode: StatusMode, fullText: string, facts: Record<Ttl, TrackFacts>, seed: SeedFact | undefined): string
```

Why facts and not a line parser: the summary drops the cache part, the cap and keep-warm clause and the long reason wording, which a parser would have to re-derive from text; the facts are data `Track` already holds. Why one pure file: the 68-character example, each token row and each drop step are table tests with no engine (the spec's pure seam).

### 20.3 Section 3.1 (`Track`): `status` set in `end()`

- `Track` gains `status?: { stop: StopKind } | { off: Reason }`. It is written **only** by `setPart(t, part, status?)`, the one writer that replaces every `t.part = X` assignment (those sites are already edited, 3.3): it sets `t.part` and `t.status = status`, so passing none clears it and a stale kind cannot survive a re-arm or a new reason. A running track has `t.timer` and no `status`.
- `end(t, text, stop)` (the architect cites `keepalive.ts:635-704`) takes the `StopKind`. Callers pass: `expired` for `expired, stopped`; `missed` for `missed, stopped`; `error`; `ping limit`; `done` for `kept warm ...` and `work done, stopped`; `spend limit`; `handoff` for `handed off, stopped` (`stopAll` / `stopForHandoff`); `overage` for `overage, stopped` (spec rev 4.5). The compaction texts (`compacting`, then the compaction result) set `{ compaction: phase }` in `Track.status`, the type becoming `{ stop } | { off } | { compaction }`; `factsOf` maps it to `kind: 'compaction'`. Every `reasonText(r)` assignment passes `{ off: r }`.
- `factsOf(t, now): TrackFacts` in `keepalive.ts`: `t.timer` is running (`warmUntil = t.warmUntil`, `pings`, `cap = capOf(t)`, `firstPingAt = t.pings === 0 && t.nextPingAt !== null ? t.nextPingAt : undefined`); `t.status.stop` is stopped, with `warmUntil = t.warmUntil` for the three kinds whose full line carries a warm-until; `t.status.off` is off. It uses the same `capOf` as the line, so the summary and the full text cannot differ on the cap.
- Rev 10's `Track.pingWarmUntil` and the arming rules are untouched.

### 20.4 Sections 3.3 (render) and 11.2: which text, and the roster

- `render($, now)` builds the full text as today, then `statusTextOf(statusMode(), fullText, facts, seedFact)` goes to `$.ui.status`. The hide rule (`anyOn()` false, or `status: false`), clearing during a turn (AC-17.6.8) and the seed-line hiding apply before either text, unchanged. `publish` is untouched: `line` is the full line.
- **Both-lines rule (11.2).** Full mode: both track lines, then the seed line while it shows, joined with `\n` as today. Summary mode: one string with both track tokens always (a track is never dropped; only the seed token and the `warm` clauses go, by length), and the seed token only while the seed line shows.
- **Roster.** Module variable `surfaces: readonly string[] = []`. `refreshSurfaces($)` awaits `$.session.surfaces()` (claude-code.d.ts 2.1.310 :2862-2875), stores it (a throwing read stores `[]`, so the safe summary, plus one debug line), then `render($, await $.clock.now())`. It runs at `session.start` and from handlers for `session.attach` and `session.detach` (:4523-4541) that **ignore the event payload** and re-read the roster, so the design does not depend on the payload's shape. `statusMode()` = `statusModeOf(settings.statusText, surfaces)`. With `statusText` `summary` or `full`, `refreshSurfaces` does not read the roster.
- Section 13's `surfaces().includes('vscode')` (open the Pane when any VS Code is attached) stays and is a different predicate from `surfaceMode` (every surface is VS Code): name them `hasVscode` and `surfaceMode`. A mixed session wants the Pane and the summary.

### 20.5 Section 3.5 (first ping)

`runningText` is unchanged (the full text keeps `first ping at`). The summary's `first ping <H:MM>` reads `nextPingAt` through `factsOf`; `arm` sets it before the part is written (3.5). No other change.

### 20.6 Section 13: title row, seed row, Pane title, roster

- `BandModel` becomes `{ title: '⚠ ai-dlc cache-keepalive:'; master: Button; rows: TrackRow[]; seed?: string }`. `bandModel(master, lines, seed?)` takes the seed line's text (the string the full text shows); `seed` is undefined while the seed line is hidden. `title` stays a constant (Q-SL2).
- `keepaliveTree`: the title row is `Text bold` with the title, then `Button key="ka-master"` (rev 8); the 5m row, the 1h row (Q-SL5); then, when `m.seed` is defined, a seed row: one `Text`, **no Button**. `bandText` writes `⚠ ai-dlc cache-keepalive: [on]` for the title row, the rows as before, and the seed row as plain text. The `⚠` is written by the mod; the host's own `⚠ ai-dlc:` on the status line is not touched.
- The Pane's frame title in `ui.open` becomes `ai-dlc cache-keepalive`. `PANE` (the `requestId`) stays `keepalive`: an identifier, not a label.
- `keepaliveBand($, t)` and the Pane hook pass `seed` from the same source as the status line, so band, Pane and full text carry the same words (AC-17.6.9).

### 20.7 Setting `statusText` (Q-SL11: the human said yes; names by sa-fix2, spec rev 4.4)

`SETTINGS` row `{ key: 'statusText', env: 'AI_DLC_KEEPALIVE_STATUS_TEXT', kind: <enum>, default: 'auto' }`, after `status`; values `auto | summary | full`, trimmed and case-insensitive (like `scope`); **not** trust-gated (display only; not added to `TRUST_GATED`). An invalid value behaves like every keep-alive setting (`settings.ts` `check`): it is warned about and the next level applies, ending at the default `auto`. The build checks which kinds `settings.ts` has; with no enum kind it adds one validator beside the boolean one. `full` and `summary` force that text on every surface and skip the roster (20.4); the band and Pane are unaffected. `/ai-dlc:cache-keepalive-configure` lists it with the other keep-alive settings: the skill's schema and listing gain the row, so with 11.2 and 19.1 they gain four in all (`statusText`, `sourceNote`, `handoff.carryOver`, `handoff.onWhenOff`); the README table gains the row (Docs update request for `documentation-writer`, ITEM-036), and `tests/auto-handoff/keepalive-settings.test.mjs` (README versus `SETTINGS`) changes with it.

## 21. Tests, pinned tests, size (amends sections 14, 15, 16)

- **Pure** (`cache-state.test.ts`): one `summaryOf` row per token state; the 68-character example kept whole (`keepalive 1h warm 6:38, ping 1/9 | 5m idle (no write) | seed hit 31k`); each length step (seed dropped; then the `warm` clauses: the 83-character spend-limit example becomes the 59-character one, both-before-first-ping 75 becomes 51); the one-track-off example; exhaustive `Reason` and `StopKind` tables; `surfaceMode` over `['vscode']`, `['terminal']`, `['desktop']`, `['terminal','vscode']`, `[]` and an unknown name; `statusModeOf` with the three settings (`summary` and `full` ignore the roster); `bandModel` with and without `seed`; `bandText` title row and seed row.
- **Keep-alive** (mock clock, `surfaces` stub): `['vscode']` gets the full text, `['terminal']` the summary; an attach or detach re-renders; `statusText: summary` and `full` override both ways and never call `surfaces`; an invalid value warns and reads as `auto`; `end()` records each `StopKind` and a later re-arm clears it (`setPart`); `factsOf` for running, first ping, stopped with and without `warm`; the hide rule and `status: false` still hide the summary and the seed token; the published `line` is the full text in every mode.
- **Panel** (`panel.test.tsx`): title text and master Button; the seed row only while the seed line shows, with no Button; the Pane's `ui.open` title is `ai-dlc cache-keepalive`.
- **Manual** (spec D13 live check, Q-SL11): the terminal status line shows the summary with no replacement glyph; a VS Code-only session shows the full text (if the roster is not exactly `vscode`, the summary, and `statusText: full` is the way out).
- **Pinned tests that change.** (1) Tests asserting the `$.ui.status` string: the default stub roster is empty, which now means the summary, so the shared fixture sets `statusText: 'full'` and those assertions stand; only the new D13 tests use `auto`. (2) Band and Pane tests asserting the title `keepalive` take the new title and Pane title. (3) Published `line` assertions are unchanged. Mechanical, in ITEM-068's pass.
- **Size.** ITEM-068 goes from 4 to **5 agent sessions (+1)**: `summaryOf` with its token and length tables, `Track.status` and `setPart` over about 20 sites, the roster and its events, the `statusText` row with the configure listing and README pin, and the title and seed row with their tests. ITEM-076 stays 2; ITEM-032 to 035 are unchanged. The plan is with product-manager. The merge-group order is unchanged (032, 033, 034, 035, 068).

## 22. Risks and open (adds to sections 17 and 19.7)

- `Track.status` carries the usual two-fields-in-step risk (11.1's reason for `isOffPart`): `setPart` as the only writer, plus a build check that no `t.part =` assignment remains, is the mitigation.
- Unverified (spec): that a VS Code session lists exactly `vscode`; if not, `auto` gives the summary there and `statusText: full` covers it.
- **Closed (sa, spec rev 4.5):** `overage, stopped` is `<ttl> stopped: overage` (StopKind `overage`, no warm clause); the compaction texts get the four tokens of 20.1. Summary tests gain one row each.
- The summary reads `nextPingAt` and `warmUntil` at render; `arm` and the landed-ping path write both before `render`, as the full text already assumes.
