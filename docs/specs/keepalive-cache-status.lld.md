---
work-item: FEAT-20261020-ai-dlc-lens
root: 17
kind: lld
feature: keepalive-cache-status
module: ai-dlc
submodule: cache-keepalive
integrations: [integration-1]
items: [ITEM-032, ITEM-033, ITEM-034, ITEM-034.a, ITEM-034.b, ITEM-035, ITEM-036]
author: system-engineer
date: 2026-10-24
status: draft revision 4 (bc round 1 fixed; spec revisions 2 and 3: 034.c, D2a, read attribution, D5 main-only arming, AC-17.3.8), awaiting sa answers on section 9 and brutal-critique
spec: docs/specs/keepalive-cache-status.spec.md
stories: docs/product/active/session-continuity-and-cache-visibility/sprint-1/keepalive-cache-status/stories.md
handoff: 17.1.3-software-architect-to-system-engineer.handoff.md
---

# LLD: keep-alive status line shows the real cache state (root 17)

Code lines are as read on 2026-10-24 (branch feat/ai-dlc-lens); the build re-checks them. Paths are under `plugins/claude/ai-dlc/`. No code is written here. Parts that depend on a spike are marked **CONDITIONAL**.

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
export type Ledger = { main: Partial<Record<Ttl, LedgerEntry>>; agents: Map<string, AgentCaches> }   // main never holds 'unknown': a main write without a split is not recorded
export type Observation = { at: number; agentId?: string; usage: unknown }
export type Lifetimes = Record<Ttl, number>        // ms; from settings.fiveMinute.ttl / oneHour.ttl

export const emptyLedger = (): Ledger
export const isEmpty = (l: Ledger, ttl?: Ttl): boolean

/** D1. Records one response. Mutates `l`. Total: an unusable usage object changes nothing. */
export function observe(l: Ledger, o: Observation, life: Lifetimes): void

/** D1, landed ping (spec rev 3). Records the response to a keep-alive ping that hit the cache. `ttl` is the track pinged; `source` is main or an agent id. A landed 5m ping sets that source's 5m entry to at + life['5m'], whatever other entries exist. A landed 1h ping moves the 1h entry only when its usage carries a 1h write (the ordinary write rule). The conservative read rule of `observe` does not apply here. The ping's own writes are then recorded as in `observe`. */
export function observePing(l: Ledger, o: Observation & { ttl: Ttl }, life: Lifetimes): void

/** D1 seed. The transcript fallback at Stop: gives `main` an entry per TTL with tokens > 0, warm until writtenAt + life, only when `main` has no entry yet and that time is after `now`. `writtenAt` is the timestamp of the transcript row that carried the write (new `splitFromTranscript` result `{ split, at }`); a row with no timestamp uses `now`, today's assumption. */
export function seedMain(l: Ledger, split: Record<Ttl, number>, writtenAt: number, now: number, life: Lifetimes): void   // seeds only entries with writtenAt + life[ttl] > now

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
   **D2a.** For an agent source only: when `split` is undefined (or both fields 0) and `usage.cache_creation_input_tokens > 0`, set `agent.caches.unknown = { warmUntil: at }` (a marker; its time is never shown or armed from). Main without a split records nothing (the transcript seed covers it).
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

/** Seeds main from the transcript when the ledger has no main entry (replaces `lastSplit ?? transcriptSplit`). */
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
seed (`seedFromTranscript`): if the ledger has no main entry { r = await transcriptSplit(...) /* returns { split, at? } */; if (r) seedMain(ledger, r.split, r.at ?? now, now, life()) }   // only when no usage was seen. Placement: tasks = 0 -> before the no-tasks branch; tasks > 0 -> right after `load`, before every later branch (disabled, overage, arming), so life() and those lines use the fresh settings
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
- **034.c observation check.** `noteUsage` writes one debug log line per agent response: `keepalive: agent usage agent=<id> split=present|absent writes=<n>` (`$.ui.log(..., { to: 'debug' })`). This stays in the code (cheap, debug only) and is what the live check reads; a second line is logged by the `SubagentStop` handler: `keepalive: subagent transcript agent=<id> rows=<n> split=present|absent`. The result is recorded in the run folder as the 034.c outcome; D2a is built regardless (it costs one branch) and is what shows if the split is absent.
- **Conditional on the build confirming the event names** against the installed Claude Code (no module in `plugins/claude/ai-dlc` uses them today; the names and fields `agent_id`, `agent_transcript_path` come from the provisional 2.1.308 types). If `classic.TeammateIdle` does not exist, agents stay `running` until `SubagentStop` and AC-17.3.5 has no idle/running difference (the teammate is treated as running); if `SubagentStart` does not exist, an agent is created at its first observation. If `SubagentStop` does not exist, finished status is never set and AC-17.3.3 moves to the human with the build's finding.
- `registerKeepalive` gains `on('classic.SubagentStart')` (`markAgent(…, 'running')`), `on('classic.SubagentStop')` (`markAgent(…, 'finished')`; fallback below) and `on('classic.TeammateIdle')` (`markAgent(…, 'idle')`); each calls `next(e)` and never throws. Field names from the engine types: `agent_id` on all three, `agent_transcript_path` on `SubagentStop`.
- **Fallback (D2).** At `SubagentStop`, when the ledger has no entry for that agent, `splitFromTranscript` over `agent_transcript_path` (read with `readRaw`, as `transcriptSplit` does) yields a split, and the agent's entry is set with `at` = the matching row's timestamp (else `now`), `warmUntil = at + life`, only when that is after `now` (as `seedMain`). A new `splitFromAgentTranscript(jsonl)` is the same as `splitFromTranscript` but keeps `isSidechain` lines (a subagent's transcript is all sidechain; the existing function skips them, line 85).

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
| D2a | `observe` unknown marker, `subagentsUnknown` | `AC-17.1.2 (D2a) a subagent write without a split shows subagents: split unknown on both tracks and arms nothing` (pure and keep-alive) |
| ITEM-034.c | debug log line | a keep-alive test asserts the `agent usage … split=` log line for a subagent response with and without a split; the live check is a recorded manual step |
| AC-17.3.2, 17.3.5, 17.3.6 **CONDITIONAL** | `pingRound` | `AC-17.3.2 with pingSubagents on, a round pings main and the running subagent` (stub `AgentPinger`; also the off case: one ping); `AC-17.3.5 an idle teammate with a warm cache is pinged`; `AC-17.3.6 ping k/9 counts rounds and spend counts every ping` (a subagent cost makes `spent >= budget` earlier than the cap) |
| AC-17.3.3 | `status !== 'finished'` | `AC-17.3.3 a finished subagent is never pinged` (setting on and off) |
| AC-17.3.4 | per (source, TTL) ledger | `AC-17.3.4 5m and 1h writes from main and an agent are kept apart` (pure) |
| AC-17.3.7 | `cacheView` at two `now`s | `AC-17.3.7 a running subagent's 5m cache: subagents warm until 10:07 at 10:04, expired 10:07 at 10:08` (setting off; a second Stop at 10:08 renders the second line; asserts `cachePart` only, and no `model.fork`/`session.send` call) |
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
| ITEM-034.c | the first task of 034: the debug log lines (3.7) and the recorded live observation of one subagent response and one `SubagentStop` transcript; decides AC-17.1.2, 17.3.4 (subagents), 17.3.7 versus D2a | 033 |
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
