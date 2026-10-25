---
work-item: FEAT-20261020-ai-dlc-lens
root: 17
kind: spec
feature: keepalive-cache-status
epic: session-continuity-and-cache-visibility
module: ai-dlc
submodule: cache-keepalive
integrations: [integration-1]
items: [ITEM-032, ITEM-033, ITEM-034.c, ITEM-034, ITEM-034.a, ITEM-034.b, ITEM-035, ITEM-036]
author: software-architect
date: 2026-10-24
status: draft revision 3.2 (17.1.45, gate critique 17.1.l2.3 Majors 1 to 3: 034.c marked done in the AC map and AC-17.3.1, AC-17.3.7 gains the missing-transcript and unreadable-transcript cases). Revision 3.1 (17.1.40: AC-17.3.7 restated to the 034.c result, `split unknown` while the subagent runs, the transcript's split from its stop; see delta rev 4.6, *034.c result*). Revision 3 (bc rounds 1 and 2 fixed; 17.1.9: D1 transcript fallback also resolves a main write with no split, per LLD rev 5), awaiting brutal-critique round 2, product-owner acceptance and G2
stories: docs/product/active/session-continuity-and-cache-visibility/sprint-1/keepalive-cache-status/stories.md (G1-approved)
narrative: docs/architecture/narratives/keepalive-cache-status.md
lld: docs/specs/keepalive-cache-status.lld.md (system-engineer)
spikes: 17.1.1 (subagent observation, landed), 17.1.2 (prices, landed); human answer to Q34 (2026-10-24, run.v3.md)
---

# Spec: keep-alive status line shows the real cache state (root 17, bug)

This spec is a synthesis of the G1-approved stories, the two G2 spikes and the human's answer to Q34. The stories file stays the source of each AC's wording. Each AC id below keeps its stories id. Where an AC changed because of Q34, the change is stated and marked **CONDITIONAL**.

## Overview

Keep-alive arms each track (`5m`, `1h`) from one value: `lastSplit`, the 1h/5m split of the last main-loop cache write (`keepalive.ts`, `noteUsage`). That value has three problems. A later 1h write hides an earlier 5m cache. Subagent writes are filtered out (`register.tsx`, `!e.agentId` before `noteUsage`). And a track that is not armed reads a bare `off`, so the user cannot tell whether a cache exists. In this spec, keep-alive keeps a **cache ledger**: per source and per TTL, when the cache was written and until when it is warm. Each track line shows that state, every `off` gets a reason, and before the first ping the line names when that ping is due.

## Spike results that bind this spec

- **17.1.1.** Subagent usage can be observed: `turn.step` and `turn.complete` carry `agentId`. The `!e.agentId` filter is the module's own choice. `SubagentStop` and its transcript are a fallback. A minimal ping of a subagent's prefix is not possible with the documented API: `$.model.fork` forks the main transcript only. The only candidate is `$.session.send`, which wakes the agent for a real turn and is untested. Two facts are still **UNKNOWN**: whether the raw usage of a subagent's `turn.step` carries the `cache_creation` 5m/1h split, and whether the `SubagentStop` transcript holds usable rows. The hook does not see a subagent spawned by a plugin through `$.agent.spawn`.
- **Q34 (human, 2026-10-24).**
  - Observe subagent caches now (firm).
  - Run a build-time spike on `$.session.send` (ITEM-034.a).
  - The messaging ping (ITEM-034.b) becomes an opt-in setting, off by default, and is built only if the spike proves it cheap and safe.
- **17.1.2.** Confirmed: a cache read costs 0.1x (0.05x on Opus and Sonnet 5.5, 0.025x on Fable and Mythos 5.1). A 5m write costs 1.25x and a 1h write 2x. A 5m hit refreshes the 5m TTL. **Not confirmed:** whether a hit refreshes the 1h TTL. This spec never assumes it.

## Acceptance criteria → design

| AC | Design | Item | Firm / conditional |
|---|---|---|---|
| AC-17.1.1, 17.1.3, 17.1.4 | D1 (for 17.1.3, the read-attribution rule), D3 | 032, 033 | firm |
| AC-17.1.2 | D1, D2, D3 | 034 | firm since 034.c (delta rev 4.6, *034.c result*): split from the transcript at `SubagentStop`, D2a while the subagent runs |
| AC-17.1.5 | D1 (5m read refresh; 1h moves only on a write) | 032 | firm |
| AC-17.3.4 | D1 | 032 (main), 034 (subagents) | main firm; subagents firm since 034.c (delta rev 4.6, *034.c result*): split from the transcript at `SubagentStop`, D2a while the subagent runs |
| AC-17.2.1, 17.2.2, 17.2.3 | D3, D4 | 033 | firm |
| AC-17.3.1 (restated below) | D2, D5 | 034.b | **CONDITIONAL** on 034.a and `pingSubagents` on (034.c is done: see the AC's note) |
| AC-17.3.7 (added after Q34; restated rev 3.1) | D1, D2, D2a, D3 | 034 | firm since 034.c (delta rev 4.6, *034.c result*): split from the transcript at `SubagentStop`, D2a while the subagent runs |
| AC-17.3.8 (added: no useless main ping; po accepted OQ4) | D5 | 034 | firm |
| AC-17.3.2, 17.3.5, 17.3.6 | D7 | 034.b | **CONDITIONAL** on 034.a and on the opt-in setting being on |
| AC-17.3.3 | D7 (with the setting off, nothing is ever pinged for a subagent) | 034 (setting off), 034.b | firm: with the setting off, no subagent ping exists |
| AC-17.4.1, 17.4.2, 17.4.3, 17.4.6 | characterisation of today's `arm` | 035 | firm |
| AC-17.4.5 | D6 | 035 | firm |
| AC-17.4.4 | live check, steps in the stories | 035 | firm (manual) |
| AC-17.4.7, AC-17.5.1-17.5.3 | Docs update (README), D8 | 036 | firm; 17.5.1 and 17.5.2 use the 17.1.2 figures |

**ACs restated after Q34.** The human's Q34 answer of 2026-10-24 (`run.v3.md`, *Gates and loops*) is binding and replaces the G1 default. `po` accepted the restatement on 2026-10-24. For build and test, the wording below replaces the stories' wording of the three ACs, and AC-17.3.7 is added:

- **AC-17.3.7** `[PT]` *(rev 3.1, 17.1.40: 034.c result, delta rev 4.6; was CONDITIONAL on ITEM-034.c)*. Given a subagent whose live write of a track's TTL at 10:02 carries no split, and whose transcript row at 10:02 carries it, when the line renders at 10:03 while the subagent still runs, then the track's cache part reads `subagents: split unknown` and the write arms nothing (D2a); and given the subagent stops at 10:03:30 (`classic.SubagentStop`, transcript readable), when the line renders at 10:04 and again at 10:08, then it reads `subagents warm until 10:07` at 10:04 and `subagents expired 10:07` at 10:08. Given the same stop with a transcript file that exists but has no readable text or no split, then the reading stays `subagents: split unknown` for the rest of that agent's life: no later event re-reads the file, and the write never arms a track (the safe side; LLD 3.7 c). Given a `SubagentStop` whose transcript file does not exist (a forked helper such as `prompt_suggestion` or `agent_summary`, as 034.c found, or a real agent whose file is not written yet), then the stop is ignored: no line changes, no agent is recorded and nothing arms; a real agent's earlier live writes keep their `subagents: split unknown` reading for the rest of its life. All readings are made with `pingSubagents` off, so the subagent's cache is shown going cold and is never pinged.
- **AC-17.3.2** `[PT]` *(CONDITIONAL: ITEM-034.a passes, and `pingSubagents` is on)*. Given an armed track and a subagent running in the background with a warm cache of the track's TTL, when a ping round is due, then one message ping is sent for that subagent and one ping for the main loop. With `pingSubagents` off (the default), only the main-loop ping is sent.
- **AC-17.3.5** `[PT]` *(CONDITIONAL, same two conditions)*. The same holds for an idle teammate with a warm cache.
- **AC-17.3.6** `[PT]` *(CONDITIONAL, same two conditions)*. With the setting on, `ping k/9` counts rounds, the cap applies by round, and every ping counts toward the spend limit (Q17-3a). With the setting off, the counter and cap behave as they do today.
- **AC-17.3.3** `[PT]` *(firm)*. A finished subagent is never pinged, whatever the setting.
- **AC-17.3.1** `[PT]` *(CONDITIONAL: 034.a passes, and `pingSubagents` is on; 034.c is done, rev 3.2)*. Given background tasks running and 5m writes only from subagents, when the turn's Stop runs, then the 5m track arms and pings only the subagents. A track arms only to ping, so with the setting off it does not arm (AC-17.3.8).
- **AC-17.3.8** `[PT]` *(firm, added)*. Given background tasks running, warm entries of a track's TTL only from subagents, and `pingSubagents` off, when the Stop runs, then the track does not arm, no main-loop ping is sent, and the line reads `keepalive 5m: subagents warm until 10:07; off (only subagent caches; subagent pings off)`. A main-loop fork with no warm main cache would only write a new cache that nobody reads (C6, spend ceiling).

The restatement of AC-17.3.1 and the new AC-17.3.8 follow from Q34 and bc's round 1 finding. `po` accepted both on 2026-10-24 (OQ4).

If ITEM-034.a fails, AC-17.3.2, 17.3.5 and 17.3.6 go back to the human with the spike result (D7).

## Design (high level)

- **D1 Cache ledger.** A new keep-alive unit holds one entry per (source, TTL). Each entry records `warmUntil`.
  - A source is `main` or one subagent's `agentId`. The line groups every agent id under the label `subagents`.
  - A response whose usage has `ephemeral_<ttl>_input_tokens > 0` sets that source's entry: `warmUntil = at + ttl`.
  - **Read attribution.** A usage object does not say which TTL a read came from, so a read moves the 5m entry only when it can only be a 5m read. A response with `cache_read_input_tokens > 0` refreshes that source's **5m** entry to `at + 5m` only when all three of these hold:
    - the 5m entry is still warm;
    - the response wrote no 1h tokens;
    - the source has no warm 1h entry.

    Otherwise the read is unattributed and moves nothing. Two rows of the pure-seam table show this. In AC-17.1.3 the 1h write at 10:02 does not move the 5m entry, so the line reads 10:05. In AC-17.1.5 there is no 1h entry, so the line reads 10:09.
  - It never moves a 1h entry. On the 1h track, only a 1h write moves the time (AC-17.1.5).
  - The ledger replaces `lastSplit` as the arming input. The transcript fallback (`transcriptSplit`) still seeds the `main` entry at Stop, as today, when the ledger has no `main` entry, and also at the Stop after a main write that carried no split: the response is marked pending, the transcript row with a split resolves it without lowering a live entry, and when the transcript has no such row the write records nothing and is not read again.
  - The ledger is cleared where `lastSplit` is cleared today: `session.end` and `stopForHandoff`.
  - A turn start does not clear it (AC-17.2.3).
  - **Landed pings are attributable by construction.** The read-attribution rule above covers ordinary responses only. A keep-alive ping that hits the cache refreshes the entry of **its own track's TTL** for the source it pinged:
    - A landed **5m** ping moves that source's 5m entry to `at + 5m`, even when other entries exist, because a 5m hit refreshes the 5m TTL (17.1.2).
    - A landed **1h** ping moves the 1h entry only when its usage carries a 1h write, because the 1h refresh rule is undocumented (OQ2).
  - So the E7 time `main warm until 11:50` comes from the ping's usage.
- **D2 Observation of subagents (034, firm).** `register.tsx` passes every `turn.step` usage to keep-alive with its `agentId`, not only main-loop usage. Auto-handoff's own context accounting keeps its `!e.agentId` filter, so only the keep-alive call moves. When a `turn.step` carries no split, the `SubagentStop` transcript (sidechain lines) is the fallback for that agent. The 5m/1h split comes through the existing `creationSplit` reader, which already reads the untyped raw fields.
- **ITEM-034.c, observation check (build-time, the first task of 034).** In a live session, it observes the `turn.step` usage of one real subagent response and one `SubagentStop` transcript, and records whether the 5m/1h split is present in each. On a pass, AC-17.1.2, 17.3.4 (subagents) and 17.3.7 are built as written.
- **D2a, split not observable.** If 034.c finds a subagent write (`cache_creation_input_tokens > 0`) without a split, that agent's write is entered in the ledger with TTL *unknown*. Both tracks' cache parts then show `subagents: split unknown`, and the write arms nothing. If 034.c finds no subagent usage at all, AC-17.1.2, 17.3.4 (subagents) and 17.3.7 go back to the human with the check's result, as D7 does. Subagents spawned through `$.agent.spawn` cannot be observed (*Out of scope*).
- **D3 Pure line rendering.** One pure function builds each track line from the ledger, the track state and `now`, in the stories' format:
  - the line is `keepalive <track>: <cache part>; <keep-alive part>`;
  - the cache part is `main …` first, then `subagents …` only when an entry of that TTL exists for a subagent, with the latest `warmUntil`, written `warm until HH:MM` or `expired HH:MM`;
  - with no entry at all for that TTL, the line is the single E5 form.
  The running line keeps its own `warm until` (E6, E7 are binding literal strings), so nothing is removed from it. The keep-alive part's `warm until` is the track's own schedule, its `warmUntil`, as today. The cache part is what the ledger observed. The two match whenever a ping's usage carries a write of its TTL. The README explains why a 1h line can differ (AC-17.5.2, OQ2).
  - **Finished agents** are shown until their entries expire, and never arm or are pinged.
  - **D2a only.** When the only entries are of TTL *unknown*, they still count as a cache part: `keepalive 5m: subagents: split unknown; off (no 5m cache write seen)`.
- **D4 Reasons.** The keep-alive part of a track that is not armed always carries a reason, from the stories' table: `no background tasks`, `no <track> cache write seen`, `cache expired`, `turn running`, `session ended`, with the existing `disabled`, `no cache write seen yet…` and `in overage` kept. Three behaviours change:
  - A Stop with no background tasks now renders the lines (today it renders nothing).
  - The turn start *publishes* `off (turn running)` but still clears the visible status, as today.
  - Session end publishes `off (session ended)`.
- **D5 Arming.** At a Stop with background tasks, a track **pings what it can keep warm**. This replaces `split[n] > 0`:
  - The main-loop ping is sent **only** when `main` has a warm entry of the track's TTL, and its `warmUntil` is that entry's. This is decided **at the Stop that arms the track**, from the warm `main` entry at that moment. While the track is armed, its ticks follow today's `arm` logic and do not check the ledger again, so a landed 1h ping without a 1h write does not stop the track (AC-17.4.1). This holds with or without 034.b. The subagent part of a round (D7) does not depend on it.
  - A subagent's entry arms the track only when 034.b exists and `pingSubagents` is on (AC-17.3.1).
  - When only subagents have warm entries and the setting is off, the track does not arm, and its reason is `only subagent caches; subagent pings off` (AC-17.3.8).
- **D6 First ping time (035).** While `pings === 0` on a running track, the counter reads `ping 0/m, first ping at HH:MM`, where `HH:MM` is the track's `nextPingAt`. The first ping is due one `pingEvery` after the turn ended. No other part of `arm` changes, so the counter keeps counting landed pings (AC-17.4.1-4.3, 4.6).
- **D7 Subagent ping (034.b, CONDITIONAL).** It is built only if ITEM-034.a passes.
  - **ITEM-034.a, build-time spike.** Wave 3, before 034.b. Send `$.session.send` to an idle subagent and to an idle teammate. Measure the tokens it costs, whether the reply reads the agent's cache, and its side effects (a real turn, transcript lines, messages to the lead). **Owner:** `sqa-engineer` runs it, and ITEM-034.c, as live `[MV]` checks in a Wave 3 build session, with the human watching the session (as in spikes 027 and 029). `agent-manager` adds the measurement logging it needs. Its output is a written result with pass or fail against two thresholds:
    - **cheap**, measured **per agent per ping** in keep-alive's token-equivalents (its `cost()`, read price included): the send costs at most 2x the main-loop ping of the same round, and its request's cache-read ratio is above `hitThreshold`, which is what makes it a keep-warm ping.
    - **safe:** the send wakes exactly one real turn, which the spike says it must. That turn makes no tool call, sends no message to the lead or to any teammate, and ends with a reply of at most 50 output tokens. The agent's next task stays the same: no extra instruction is added and no pending message is dropped.

    Spike 17.1.1 makes "safe" likely to fail, because a woken teammate may act on the ping. If it fails, D7's drop path applies. The human confirms these thresholds at G2 (OQ3).
  - **ITEM-034.b, only on a pass.** A new setting, `pingSubagents`, default `false`. It is **trust-gated** like the other spend-raising settings, so a cloned repository's committed file cannot turn spending on, and it is read in `settings.ts`. With it on, each ping round messages every live subagent (running in the background) and every idle teammate that has a warm entry of the track's TTL. This happens whether or not that round sends a main-loop ping (D5). Agents seen in `SubagentStop` are never messaged. A round counts once against the cap. Every ping counts toward the spend limit (`budgetMultiplier`), so `spent` grows by each agent's measured cost (Q17-3a).
  - **On a fail.** 034.b is dropped. The ledger and the line (D1-D3) still show each subagent's cache and when it goes cold, which is the human's firm part. AC-17.3.2, 17.3.5 and 17.3.6 go back to the human with the 034.a result.
- **D8 Published state (integration-1).**
  - `KeepaliveTrackState` gains an optional, additive `caches?: { source: 'main' | 'subagents'; warmUntil: number; expired: boolean }[]`. Each entry's TTL is the track's own.
  - The comment on `pings` changes from "sent" to "landed".
  - `line` keeps its meaning (the line as shown).
  - The lens is not changed in root 17; reading `caches` is root 22. A missing field leaves today's readers working.

```mermaid
flowchart LR
  TS[turn.step usage, agentId] --> L[D1 cache ledger: source x TTL]
  SS[SubagentStop transcript] -.fallback.-> L
  PG[keep-alive ping usage] --> L
  L --> R[D3 render line + D4 reason]
  L --> A[D5 arm at Stop]
  A --> T[track timer: ping main]
  T -.CONDITIONAL 034.b, setting on.-> S[$.session.send to live agents]
  R --> UI[ui.status]
  R --> P[D8 publish $.state keepalive]
  P --> Lens[ai-dlc-lens reads, unchanged in root 17]
```

## Component boundaries

| Part | Owner |
|---|---|
| D1 ledger, D3 render, D4 reasons (pure) | new file `hooks/keepalive/cache-state.ts`, tested on its own |
| D5 arming, D6 counter text, D7 ping round, D8 publish | `hooks/keepalive/keepalive.ts` |
| D2 forwarding every usage with `agentId`; the `SubagentStop` fallback hook | `hooks/auto-handoff/register.tsx` (where `noteUsage` is called today); the keep-alive entry point stays in `keepalive.ts` |
| `pingSubagents` setting (034.b only) | `hooks/keepalive/settings.ts`, the `cache-keepalive.json` schema |
| Published contract | `plugins/claude/ai-dlc/types/index.d.ts` |
| README (AC-17.4.7, 17.5.x, status states) | documentation-writer (ITEM-036), never the implementer |
| Lens | untouched (root 22) |

The `hooks/keepalive/ATTRIBUTION.md` entry records each change (repository rule).

## Data shapes

There is no request/response API, so the `{ data, error }` envelope does not apply. The internal shapes:

- `Source = 'main' | { agentId: string }`. The label is `main` or `subagents`.
- `LedgerEntry = { ttl: '5m' | '1h' | 'unknown'; warmUntil: number }`, keyed by source and TTL (`unknown` only under D2a).
- `Observation = { at: number; agentId?: string; usage: unknown }`. This is the one input of D1.
- `TrackView = { name; armed; pings; cap; nextPingAt; warmUntil; reason?: Reason }`. It is the input of D3, alongside the ledger and `now`.
- `Reason`, a closed union. Each member, and its literal text after `off`:

  | Member | Literal |
  |---|---|
  | `noTasks` | `(no background tasks)` |
  | `noWrite` | `(no 5m cache write seen)` / `(no 1h cache write seen)`, by track |
  | `expired` | `(cache expired)` |
  | `turnRunning` | `(turn running)` |
  | `sessionEnded` | `(session ended)` |
  | `onlySubagents` | `(only subagent caches; subagent pings off)` |
  | `disabled` | `(disabled)` |
  | `noSplit` | `(no cache write seen yet, so the cache lifetime is unknown)` |
  | `overage` | exception: no parentheses, the whole keep-alive part is `off in overage`, as today |
- 034.b only: `AgentLiveness = 'running' | 'idle' | 'finished'`, per `agentId`.

The LLD fixes the exact signatures and the string table of the line texts.

## Test seams

- **Existing, primary:** the keep-alive tests (`hooks/keepalive/tests/keepalive.test.ts`). They use a mock clock and stubbed responses, and they observe `ui.status` and the published `$.state`. Every `[PT]` AC of US-17.1, 17.2 and 17.4 is observed here, as literal string comparisons with E1-E7.
- **Existing, D2:** the auto-handoff test harness (`tests/auto-handoff.test.tsx`) already drives `turn.step`. A test there proves that a `turn.step` with an `agentId` reaches the keep-alive ledger, and that auto-handoff's context accounting does not change (AC-17.1.2, 17.3.1).
- **New pure seam, chosen because it is the highest that observes D1/D3 without timers:** `cache-state.ts` exports the ledger and the render function, tested by a table of (observations, now) → line. Required rows:
  - AC-17.1.3: a 1h write after a 5m write leaves the 5m line at 10:05;
  - AC-17.1.5: a read with no 1h entry gives 10:09;
  - the landed-ping row: a main 5m entry, a warm 1h entry and a landed 5m ping move `main warm until` on by 5m;
  - AC-17.3.7: the 10:04 and 10:08 readings;
  - AC-17.3.8: the literal line;
  - D2a: a subagent write without a split gives the literal cache part `subagents: split unknown`.
- **Keep-alive tests, AC-17.3.8:** a Stop with only subagent entries and the setting off sends no `$.model.fork`.
- **034.b:** the keep-alive tests with a stub of `$.session.send`. They cover the ping per live agent, none for a finished agent, the cap counted by round and the spend counted per ping.
- **AC-17.4.4:** manual, with the steps given in the stories.
- **Pinned tests that change:** the tests asserting `ping 0/9, keep warm …` (today at `keepalive.test.ts:1446, 1465`) take the D6 text. As the stories say, `:1496` stays unchanged.

## Out of scope

As the stories: the lens cost fixes and the lens panel (root 22), and which TTL the main loop writes. Also out of scope: any ping of a subagent through `$.model.fork` (17.1.1: not possible), subagents spawned by a plugin through `$.agent.spawn` (the hook does not see them), and changing the lens to read `caches`.

## Open questions

- **OQ1 (closed, 2026-10-24).** `po` accepted the restated ACs, AC-17.3.7 was added, and the source is the human's Q34 answer recorded in `run.v3.md`.
- **OQ2 (po, accepted 2026-10-24).** E7 shows `main warm until 11:50` after a 1h ping. With the 1h refresh rule unknown, the ledger moves only when the ping's usage carries a 1h write. Default: keep E7, and stub the ping's usage with a 1h write in the test. If live pings show no 1h write, E7's cache part would stay at `11:00`, and the README (AC-17.5.2) already says the rule is undocumented.
- **OQ3 (human, G2).** The pass thresholds for 034.a, as defined in D7. Default:
  - cheap: at most 2x the main ping, per agent per ping, in token-equivalents, with a cache hit;
  - safe: one woken turn, no tool call, no message, a reply of at most 50 output tokens, and the next task unchanged.
- **OQ4 (closed, po accepted 2026-10-24).** AC-17.3.1 restated, AC-17.3.8 added, and AC-17.1.2, 17.3.4 (subagents) and 17.3.7 made conditional on ITEM-034.c.

## ADRs

None. The per-source ledger is internal and reversible. The Q34 decision is the human's own, recorded in `run.v3.md`. ITEM-034.b gets an ADR only if 034.a passes and the opt-in ping ships, because that is when spend per subagent becomes a user-facing commitment.

## Docs update

`plugins/claude/ai-dlc/hooks/keepalive/README.md`: *Status lines* (each state of US-17.1 and 17.2, the `main` and `subagents` labels, `ping k/m` counting landed pings, the first ping due one interval after the turn ends), and a new cache explanation section (AC-17.5.1-17.5.3, figures from 17.1.2 with the link and the read date, the 1h refresh rule marked undocumented, `/clear` and compaction labelled Claude Code behaviour). Status *planned*. The building stage has not started, and the README turns *in progress* when ITEM-032 starts. The `pingSubagents` setting is documented only if 034.b ships.
