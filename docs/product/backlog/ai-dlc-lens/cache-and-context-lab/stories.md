---
work-item: FEAT-20261020-ai-dlc-lens
root: 22
kind: user-stories
author: requirement-analyst
date: 2026-10-25
revision: 5 (2026-10-25, step 17.1.39, fix round for gate critique 17.1.l3.2: AC-22.3.6 gains the compaction rows, 8m gap → TTL lapse and 1m gap → Unknown, keeping the *Terms* rule (Major 1; the LLD 5.1 side is system-engineer's); F6 `sessions` newest first, `[C2, C]` (Minor 1); *Open questions* reordered with a pointer to the spec's two build-time unknowns (Minor 2); title "items a to g" (Minor 5); Lost to busts marked "modified: per-TTL write rate" (Minor 7)). Rev 4 (2026-10-25, step 17.1.30, gate-critique fix round for 17.1.l3.1: AC-22.7.7 states the header line stays (Blocker 3); `[NT]` route added and AC-22.1.1, 22.1.4 and 22.4.6 re-tagged (Major); open-question status aligned with the spec (Major); AC-22.3.6 attribution boundary cases and the fixtures' UTC time zone added (Minors); the human's "one combined session" principle of 2026-10-25 for an automatic handoff chain applied to the window and the This session preset: US-22.8, AC-22.8.1 to 22.8.3, ITEM-077). Rev 3 (2026-10-25, step 17.1.25: the human's answers of run.v4 2m; F1 rev 2 accepted; Q-CL18 "Context Lab"; Q-CL19 window across reloads behind a switch, AC-22.2.13 and AC-22.2.14 added). Rev 2 (2026-10-25, step 17.1.22: the human's decisions of run.v4 2i and 2j; Q-CL1, Q-CL2, Q-CL7, Q-CL11, Q-CL12 decided; stories for ITEM-073 and ITEM-074)
status: draft, awaiting product-owner acceptance and the combined G1+G2+G3 stop
review-status: rev 4 critiqued in 17.1.l3.2 (PASS, 2 Major, 8 Minor); rev 5 fixes M1, m1, m2, m5, m7 of this file; not re-critiqued, checked by the orchestrator
epic: ai-dlc-lens
module: ai-dlc-lens
submodule: cache-context-lab
feature: cache-lab
backlog-item: ITEM-058
items: [ITEM-069 (22.a), ITEM-070 (22.b), ITEM-071 (22.c), ITEM-072 (22.d), ITEM-073 (22.e), ITEM-074 (22.f), ITEM-077 (22.g); umbrella ITEM-058]
inputs: 17.1.14-orchestrator-to-requirement-analyst.handoff.md and the orchestrator's message of 2026-10-25 (item numbers); 17.1.12-research-assistant-to-orchestrator.handback.md (Q2 promptId); 17.1.10-product-owner-to-orchestrator.handback.md (Decisions 2-4); run.v4.md Next action 2b, 2c, 2e, 2i, 2j (the human's answers, 2026-10-25); 17.1.6.3-research-assistant-to-orchestrator.handback.md (claude-lens formulas, MIT); 17.1.16 (architect: L7 window, L8, L9) and 17.1.17 (system-engineer: the exact claude-lens compaction rule) hand-backs; 17.1.22-orchestrator-to-requirement-analyst.handoff.md; docs/specs/cache-lab.lld.md sections 7.2, 9, 10; .ai-dlc/model-metadata.json (price keys)
---

# User stories: ai-dlc-lens Cache Lab, items a to g (root 22)

## Source

- The human, 2026-10-25 (`run.v4.md` 2b): the lens's Cache Lab accordion shows what claude-lens's Cache Lab page shows: (1) Savings, Burst, Net Savings; (2) Miss attribution; (3) TTL Mix; (4) Cache Hit %, Tokens Saved, Bust events, median baseline; (5) Invalidation Gallery as a separate accordion inside Cache Lab. 2c: the po definitions are accepted ("Burst" = busts; Cache Hit % token-weighted; Tokens Saved = cache-read tokens; true median baseline; prices from `.ai-dlc/model-metadata.json`, "no price" when unpriced; claude-lens formulas reused under MIT with the notice); all of it in this sprint. 2e: the root 22 leftovers (rename Usage to Context Lab; keep-alive in its own accordion) are in this sprint (ITEM-073, ITEM-074).
- The human, 2026-10-25 (`run.v4.md` 2i, 2j; handoff 17.1.22):
  - **Q-CL1 accepted:** each cache write is priced by its TTL (5m rate, 1h rate; unknown TTL at the 5m rate).
  - **Q-CL2:** the exact claude-lens compaction rule (the cache read fell by more than half between the two previous calls of the stream).
  - **Q-CL7 accepted:** gallery rows show `prompt <id8> · turn <n>` as text, no link; else `No turn attribution`.
  - **Q-CL11 accepted:** window presets This session / Today / 7d / 30d / All, default 7d, the choice kept for the session.
  - **ITEM-073 accepted:** `Usage` is renamed `Context Lab` in the agent pane only (casing per Q-CL18).
  - **ITEM-074 / Q-CL12, the human's layout:** lens level → **Cache Lab** accordion (like Usage today) → **Keep Alive** as a sub-accordion under Cache Lab (like Usage today).
  - **Casing:** always "Cache Lab", never "Cache lab", in every artifact and UI string.
- The human, 2026-10-25 (`run.v4.md` 2m; handoff 17.1.25):
  - **F1 rev 2 accepted** (A3 `cr` 15,000; F4 and F4b cover compaction).
  - **Q-CL18:** "Context Lab", capital L, matching "Cache Lab", everywhere (ITEM-073's `Context lab` is read as `Context Lab`).
  - **Q-CL19:** the Cache Lab window choice is **kept across reloads** (`/reload-plugins`) for development and testing and **reset on reload** in production, through an explicit, documented switch, off by default (production behaviour); "development" is never detected by guessing. The switch (software-architect, 17.1.26; `cache-lab.spec.md` L7 *Across a reload*) is the lens setting `cacheLabKeepWindowOnReload`.

## How to read this file

| Tag | Route |
|---|---|
| `[PT]` | `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc-lens` (lens tests, fixture transcripts and a fixture price file) |
| `[NT]` | `node --test "tests/**/*.test.mjs"` (the transcript reader and its child process, `tests/cache-reader/`, as the spec and LLD run them) |
| `[DC]` | document check against the named file |
| `[MV]` | manual check in a live Claude Code session, steps given |

## Terms (our definitions; the formulas marked *claude-lens* are reused under MIT, © 2026 Foyzul Karim)

- **Call**: one assistant response in a transcript that carries a usage object. Its tokens: `in` (uncached input), `out`, `cr` (cache read), `cc` (cache write, total), split into `cc5m`, `cc1h` when the usage carries the split.
- **Stream**: the main loop of a session, or one sidechain (subagent). **First call**: the first call of a stream. **Previous call** and **call before the previous**: the two calls of the same stream just before this one, by time.
- **Window**: the time range the lens is showing, inclusive at both ends. Calls are classified over the whole transcript, then filtered to the window (*claude-lens*). **Window presets** (the only windows the UI offers; Q-CL11): **This session** (every call of the session the lens runs in and of every session of its automatic handoff chain, US-22.8), **Today** (from local midnight to now), **7d** (the last 7 × 24 hours to now), **30d** (the last 30 × 24 hours to now), **All** (every call). Default **7d**.
- **Prices**: per model, USD per million tokens, from `.ai-dlc/model-metadata.json`: `input`, `output`, `cacheRead`, `cacheWrite5m`, `cacheWrite1h`. A model with no entry, or with a needed price missing, is **unpriced**.
- **Write rate of a token** (Q-CL1, decided): `cacheWrite5m` for a 5m write token, `cacheWrite1h` for a 1h write token, and `cacheWrite5m` for a write of unknown TTL.
- **Saved by cache** (*claude-lens*): Σ over priced calls of `cr × (input − cacheRead) / 1e6` (the uncached cost minus the actual cost; writes and output cancel).
- **Bust**: a call, not a first call, whose `cc` is above 10,000 (strictly). **Bust events**: the count of busts.
- **Lost to busts** (*claude-lens*, modified: per-TTL write rate): Σ over priced busts of `cc × max(writeRate − cacheRead, 0) / 1e6`, each TTL part at its own write rate.
- **NET** (*claude-lens*): Saved by cache − Lost to busts.
- **Cache Hit %** (ours): Σ`cr` / (Σ`cr` + Σ`cc` + Σ`in`) over every call in the window, × 100, one decimal.
- **Tokens Saved** (ours): Σ`cr` over every call in the window, a token count.
- **Session baseline**: the `cc` of a session's first non-sidechain call with `cc > 0`. **Median baseline** (ours): the true median of the baselines of the sessions whose baseline call is in the window (even count: the mean of the two middle values); no session: `—`.
- **Compaction** (*claude-lens*, exact rule, Q-CL2 decided): a call is compaction when its stream has both a previous call and a call before the previous, the call before the previous has `cr > 0`, and (`cr` of the call before the previous − `cr` of the previous call) / `cr` of the call before the previous is above 0.5 (strictly). The call being classified is not read; a ratio of exactly 0.5 is not compaction.
- **Miss attribution** of a bust (*claude-lens*): base cause, first match wins: *model switch* (model differs from the previous call of the stream), *compaction* (the rule above), else *unexplained*. Gap = this call's time − the previous call's time. Represented TTLs: 5m when `cc5m > 0`, 1h when `cc1h > 0`. Then: model switch → **Unknown**; gap greater than every represented TTL → **TTL lapse**; gap at most every represented TTL and cause unexplained → **Prefix change**; anything else (compaction within the TTL, no represented TTL) → **Unknown**.
- **TTL mix** (*claude-lens*): Σ`cc5m`, Σ`cc1h`, and unknown = Σ over calls of `cc` when the call has no split, else `max(0, cc − cc5m − cc1h)`. 5m + 1h + unknown = Σ`cc`.
- **Gallery row**: one bust (first-call writes are never rows). Newest first (**default, Q-CL4**). Capped at 50, with the total and a truncated flag.
- **Window-persistence switch** (Q-CL19, decided): the lens setting `cacheLabKeepWindowOnReload`, a boolean, default `false` (production: the window resets on reload). Its variable is `AI_DLC_LENS_CACHE_LAB_KEEP_WINDOW_ON_RELOAD`. It is read by the lens settings loader, first match wins: `env` of `.claude/settings.local.json`, `env` of `.claude/settings.json`, `.ai-dlc/lens.json`, the default; the process environment is never read. `/ai-dlc:lens-configure` lists it. Nothing else (no install path, no other variable) turns it on.
- **Reload**: the lens hooks module loaded again in the same session (`/reload-plugins`).
- **Turn label** (Q-CL7, decided): `prompt <the first 8 characters of the prompt id> · turn <n>` when the bust's call resolves to a user turn with a `promptId`, else `No turn attribution`. Text only; nothing opens or links.

## Display formats

Dollars: `$` and two decimals, rounded half away from zero, minus sign before `$` (`-$0.05`). Tokens: whole numbers with `,` thousands separators. Median baseline: thousands rounded to a whole number, then `k` (`20k`). Percentages: one decimal and `%`. Times: `HH:MM` in the display time zone. Every fixture's times are UTC, and the tests pin the display time zone to UTC (so `Today` starts at 2026-10-25 00:00 UTC and the `HH:MM` values below are UTC), whatever the machine's zone. The LLD fixes the string table; these ACs compare the values below.

## Fixtures

Fixture prices `P` (a fixture price file in the shape of `.ai-dlc/model-metadata.json`): models `fixture-model-m` and `fixture-model-n`, each `input 3`, `output 15`, `cacheRead 0.30`, `cacheWrite5m 3.75`, `cacheWrite1h 6.00`.

Fixture transcript **F1** (rev 2: A3's `cr` is 15,000, so that A4 stays a Prefix change under the exact compaction rule), all calls main-loop unless marked, date 2026-10-25:

| Call | Session | Time | Model | in | out | cr | cc5m | cc1h | cc (no split) | Note |
|---|---|---|---|---|---|---|---|---|---|---|
| A1 | A | 10:00 | m | 100 | 100 | 0 | 20,000 | 0 | | first call, baseline A = 20,000 |
| A2 | A | 10:02 | m | 100 | 100 | 20,000 | 500 | 0 | | |
| A3 | A | 10:10 | m | 100 | 100 | 15,000 | 20,600 | 0 | | bust; compaction not tested (A1 `cr` 0); gap 8m > 5m → TTL lapse |
| A4 | A | 10:12 | m | 100 | 100 | 5,000 | 15,700 | 0 | | bust; (20,000 − 15,000) / 20,000 = 0.25, not compaction; gap 2m ≤ 5m → Prefix change |
| A5 | A | 10:13 | n | 100 | 100 | 0 | 0 | 12,000 | | bust; model switch (comes before compaction, which would also fire: 0.67) → Unknown |
| A6 | A | 10:14 | m | 100 | 100 | 12,000 | | | 3,000 | write with no split, not a bust |
| B0 | B | 10:59 | m | 50 | 50 | 0 | 4,000 | 0 | | sidechain |
| B1 | B | 11:00 | m | 50 | 50 | 0 | 10,000 | 0 | | first main call, baseline B = 10,000; 10,000 is not above the threshold |
| C1 | C | 12:00 | m | 0 | 0 | 0 | 60,000 | 0 | | first call, baseline C = 60,000 |

Totals over F1: Σ`in` 700, Σ`cr` 52,000, Σ`cc` 145,800 (5m 130,800, 1h 12,000, unknown 3,000).

**F2**: one session, model m, a first call then 51 busts (each `cc5m 11,000`, one minute apart, 10:01 to 10:51).

**F3**: F1 with `fixture-model-n` removed from the price file (A5 is unpriced).

**F4** (compaction): one session D, model m, main loop, 2026-10-25, every write 5m:

| Call | Time | in | cr | cc5m | Note |
|---|---|---|---|---|---|
| D1 | 10:00 | 100 | 0 | 20,000 | first call |
| D2 | 10:01 | 100 | 20,000 | 0 | |
| D3 | 10:02 | 100 | 8,000 | 0 | not a bust |
| D4 | 10:03 | 100 | 0 | 20,000 | bust; (20,000 − 8,000) / 20,000 = 0.6 > 0.5 → compaction; gap 1m ≤ 5m → Unknown |

**F4b**: F4 with D3's `cr` 10,000: the ratio is exactly 0.5, not compaction, so D4 is a Prefix change.

**F5** (windows): F1 plus three one-call sessions, model m, main loop, each `in 0`, `out 0`, `cc 0`: E1 at 2026-10-24 12:00 with `cr 1,000`; G1 at 2026-10-01 12:00 with `cr 2,000`; H1 at 2026-09-01 12:00 with `cr 4,000`. The clock reads 2026-10-25 12:30 and the lens runs in session C.

## Stories

### US-22.1 The lens reads transcripts and prices them (item a, ITEM-069)

As a developer, I want the lens to compute cache figures from my session transcripts with the prices the plugin already keeps, so that the numbers cover all my sessions, not only the live one.

- AC-22.1.1 `[NT]` Given F1 as the transcript source, when the reader runs, then it yields 9 calls with exactly the fields of the table (session, stream main/sidechain, time, model, `in`, `out`, `cr`, `cc`, and `cc5m`/`cc1h` only where the transcript carries the split; A6 has none).
- AC-22.1.2 `[PT]` Given F1 and the window 10:05 to 11:30, when the calls are classified and filtered, then A3 is still a bust attributed TTL lapse (its previous call A2 and the call before it, A1, both outside the window, are used), and the window holds A3 to B1.
- AC-22.1.3 `[PT]` Given price file P, when a call of `fixture-model-m` is priced, then the prices are P's values; given F3, `fixture-model-n` is unpriced and each figure that needs its price is computed without it (US-22.2, US-22.4).
- AC-22.1.4 `[NT]` + `[PT]` Given a transcript line that is not JSON, or an assistant line with no usage, when the reader runs, then the line is skipped and counted and the other calls are read (`[NT]`, reader test), and the lens shows no error banner for it (`[PT]`) (Q-CL6, answered by system-engineer: skipped and counted in the debug log).
- AC-22.1.5 `[PT]` Given no price file at all, when the Cache Lab renders, then every dollar figure is `no price` and every token figure is still shown.
- AC-22.1.6 `[DC]` Given the ai-dlc-lens `NOTICE.md` (or the ATTRIBUTION file the design names), when it is read, then it carries the claude-lens MIT copyright and licence notice and names the formulas reused.

### US-22.2 Cache Lab savings and summary cards (item b, ITEM-070)

As a developer, I want a Cache Lab accordion that shows what the cache saved me, what busts cost me, and how well the cache is used, so that I can see whether caching pays off.

- AC-22.2.1 `[PT]` *(rev 2)* Given the lens pane, when it renders, then it has, at lens level (not inside an agent pane), a **Cache Lab** accordion that behaves as the Usage section does today: collapsed by default and keeping its open state for the session. Inside it, in this order: the window row (AC-22.2.12), the savings row, the cards row, Miss attribution, TTL mix, the **Invalidation Gallery** sub-accordion (collapsed by default, **default, Q-CL5**) and the **Keep Alive** sub-accordion (US-22.7). Every label reads `Cache Lab`, with a capital L.
- AC-22.2.2 `[PT]` Given F1, P and a window covering all of F1, when Cache Lab renders, then **Saved by cache** is `$0.14` (52,000 × 2.70 / 1e6 = 0.1404).
- AC-22.2.3 `[PT]` Given the same, then **Lost to busts** is `$0.19` (each write at its TTL's rate, Q-CL1: A3 20,600 × 3.45 + A4 15,700 × 3.45 + A5 12,000 × 5.70 = 193,635; / 1e6 = 0.193635).
- AC-22.2.4 `[PT]` Given the same, then **NET** is `-$0.05` (0.1404 − 0.193635 = −0.053235), shown as a negative value.
- AC-22.2.5 `[PT]` Given the same, then **Cache Hit %** is `26.2%` (52,000 / (52,000 + 145,800 + 700) = 0.26196).
- AC-22.2.6 `[PT]` Given the same, then **Tokens Saved** is `52,000` (a token count, not dollars).
- AC-22.2.7 `[PT]` Given the same, then **Bust events** is `3` (A3, A4, A5; A1, B1 and C1 are first calls or not above 10,000).
- AC-22.2.8 `[PT]` Given the same, then **Median baseline** is `20k` (median of 20,000, 10,000, 60,000; the mean, 30k, is wrong; B0, a sidechain, is not B's baseline).
- AC-22.2.9 `[PT]` Given F1 and the window 10:05 to 11:30 (a function-level window; the UI offers presets only), then Tokens Saved is `32,000` (A3 15,000 + A4 5,000 + A6 12,000), Bust events `3`, and Median baseline `10k` (only B's baseline call is in the window).
- AC-22.2.10 `[PT]` Given F3 (A5 unpriced), when Cache Lab renders, then Saved by cache is `$0.14`, Lost to busts `$0.13` (125,235 / 1e6), NET `$0.02` (0.1404 − 0.125235 = 0.015165), the savings row notes `1 call with no price` (**default, Q-CL3**), and Cache Hit %, Tokens Saved and Bust events are the F1 values.
- AC-22.2.11 `[PT]` Given a window with no calls, then every dollar figure is `$0.00`, Cache Hit % `—`, Tokens Saved `0`, Bust events `0` and Median baseline `—`.
- AC-22.2.12 `[PT]` *(new in rev 2, Q-CL11)* Given F5, P and the Cache Lab opened for the first time in the session, then the window row shows the five presets `This session`, `Today`, `7d`, `30d`, `All`, in that order, with `7d` marked active and Tokens Saved `53,000`. When each preset is pressed, the figures are recomputed for it and the pressed preset is marked: `This session` → Tokens Saved `0`, Bust events `0`, Median baseline `60k` (session C only); `Today` → `52,000` (F1); `7d` → `53,000` (+ E1); `30d` → `55,000` (+ G1); `All` → `59,000` (+ H1). After `30d` is pressed and Cache Lab is collapsed and opened again, `30d` is still active. When a new session is started by hand, the window is `7d` again (a session seeded by an automatic handoff continues the chain: US-22.8). No press writes a file (`.ai-dlc/lens.json` keeps its bytes, or stays absent). Across a reload: AC-22.2.13.
- AC-22.2.13 `[PT]` *(new in rev 3, Q-CL19)* Given F5, P, `30d` pressed in this session:
  - **switch off** (`cacheLabKeepWindowOnReload` unset or `false`; the default, production): when the lens is reloaded, then the window is `7d` and Tokens Saved `53,000`; nothing is written to `$.store` for the window at any press, and a window value stored earlier for this session (fixture) is ignored;
  - **switch on** (`AI_DLC_LENS_CACHE_LAB_KEEP_WINDOW_ON_RELOAD=true` in the `env` of `.claude/settings.local.json`, and again with `cacheLabKeepWindowOnReload: true` in `.ai-dlc/lens.json`): when the lens is reloaded, then the window is still `30d` and Tokens Saved `55,000`; when the stored value for this session is absent or invalid (fixture), the window is `7d`;
  - **both**: when a new session is started by hand, the window is `7d` (an automatic handoff: AC-22.8.2); the variable set only in the process environment leaves the switch off; and no press writes a settings file (`.claude/settings.json`, `.claude/settings.local.json` and `.ai-dlc/lens.json` keep their bytes, or stay absent).
- AC-22.2.14 `[DC]` *(new in rev 3, Q-CL19)* Given `plugins/claude/ai-dlc-lens/README.md` after the documentation stage, then it documents `cacheLabKeepWindowOnReload` and `AI_DLC_LENS_CACHE_LAB_KEEP_WINDOW_ON_RELOAD`: default `false`, what each value does (reset to `7d` on reload; kept across reloads, for development and testing), where it can be set (a settings file's `env`, `.ai-dlc/lens.json`; not the process environment), and that a new session always starts at `7d`.

### US-22.3 Why the cache missed, and which TTLs were written (item c, ITEM-071)

As a developer, I want to see why each bust happened and how my cache writes split between 5m and 1h, so that I know what to change.

- AC-22.3.1 `[PT]` *(rev 2)* Given F1 and a window covering all of it, when Cache Lab renders, then **Miss attribution** reads TTL lapse `1` (A3), Prefix change `1` (A4: its cache read fell by 25% between A2 and A3, not more than half, so not compaction), Unknown `1` (A5, model switch), and the three add up to Bust events.
- AC-22.3.2 `[PT]` Given a bust whose usage carries no split (no represented TTL), when it is attributed, then it counts as Unknown.
- AC-22.3.3 `[PT]` *(rev 2, the exact rule)* Given F4, when Cache Lab renders over all of it, then D4 is compaction (the cache read fell from 20,000 at D2 to 8,000 at D3, by 60%) and counts as Unknown: Miss attribution reads TTL lapse `0`, Prefix change `0`, Unknown `1`. Given F4b (a fall of exactly 50%), then D4 is not compaction and Miss attribution reads Prefix change `1`, Unknown `0`.
- AC-22.3.4 `[PT]` Given F1 and a window covering all of it, then **TTL mix** reads 5m `130,800` (89.7%), 1h `12,000` (8.2%), unknown `3,000` (2.1%), and the three token figures add up to Σ`cc` 145,800.
- AC-22.3.5 `[PT]` Given a window with no cache write, then TTL mix shows `0` for each part and no percentages.
- AC-22.3.6 `[PT]` *(rev 4, boundary cases of Miss attribution)* Given one main-loop stream of model m whose previous call is unexplained (same model, not compaction), when a bust with the gap and represented TTLs below is attributed, then it reads:

  | Bust | Represented TTLs | Gap | Attribution |
  |---|---|---|---|
  | `cc5m 11,000` | 5m | exactly 5m 00s | Prefix change (the gap is not greater than 5m) |
  | `cc5m 11,000` | 5m | 5m 01s | TTL lapse |
  | `cc1h 11,000` | 1h | 61m | TTL lapse |
  | `cc1h 11,000` | 1h | 30m | Prefix change |
  | `cc5m 6,000`, `cc1h 6,000` | 5m and 1h | 30m (greater than 5m, at most 1h) | Unknown (neither rule holds for every represented TTL) |
  | `cc5m 6,000`, `cc1h 6,000` | 5m and 1h | 61m | TTL lapse |
  | `cc5m 6,000`, `cc1h 6,000` | 5m and 1h | 2m | Prefix change |

  *(Rev 5, critique 17.1.l3.2 Major 1: compaction rows. Same stream and model, but the bust's cause is compaction by the rule in Terms: the call before the previous has `cr 20,000` and the previous call `cr 8,000`, a fall of 60%. The *Miss attribution* term decides: the gap is checked first, so a compaction bust after a gap greater than every represented TTL is a TTL lapse, and only a compaction within the TTL is Unknown.)*

  | Bust | Represented TTLs | Gap | Cause | Attribution |
  |---|---|---|---|---|
  | `cc5m 11,000` | 5m | 8m (greater than 5m) | compaction | TTL lapse (the gap is greater than every represented TTL) |
  | `cc5m 11,000` | 5m | 1m (at most 5m) | compaction | Unknown (compaction within the TTL; F4's D4) |

### US-22.4 Invalidation Gallery (item d, ITEM-072)

As a developer, I want a list of the busts, each with its cause and cost, so that I can find the turns that broke my cache.

- AC-22.4.1 `[PT]` Given F1 and a window covering all of it, when the gallery is opened, then it has exactly 3 rows, newest first: A5, A4, A3; first-call writes (A1, B1, C1) are not rows; the header reads `3 busts`.
- AC-22.4.2 `[PT]` *(rev 2: the A4 row checked against the exact compaction rule; with A3's `cr` 15,000 it stays Prefix change)* Given the same, then each row shows time, model, session, attribution, cache-write tokens and loss: A5 `10:13`, `fixture-model-n`, `A`, `Unknown`, `12,000`, `$0.07`; A4 `10:12`, `fixture-model-m`, `A`, `Prefix change`, `15,700`, `$0.05`; A3 `10:10`, `fixture-model-m`, `A`, `TTL lapse`, `20,600`, `$0.07`.
- AC-22.4.3 `[PT]` Given F3, then A5's loss is `no price` and the other rows are unchanged.
- AC-22.4.4 `[PT]` Given F2, then the gallery has 50 rows (10:51 back to 10:02), the header reads `50 of 51 busts` and marks the list truncated; the bust at 10:01 is not shown; Bust events on the card is `51`.
- AC-22.4.5 `[PT]` Given a sidechain bust, then its row names its stream (the agent id or label the design names); a main-loop row shows no stream label.
- AC-22.4.6 `[NT]` + `[PT]` *(rev 2, Q-CL7 decided: a text label, no link; rev 4: the turn join is a reader test `[NT]`, the label render a lens test `[PT]`)* Given a bust whose call resolves, through its transcript rows, to a user turn carrying a `promptId`, then its row shows the turn label `prompt <first 8 characters of the id> · turn <n>`; given a bust that does not resolve, the row reads `No turn attribution`. Nothing in the row opens, links or scrolls to anything. (The join is unverified; the first fixture run proves or disproves it, LLD section 8. A disproof means every row reads `No turn attribution`, which this AC accepts.)
- AC-22.4.7 `[PT]` Given the gallery, then no row shows prompt text or tool details.

### Manual check

- AC-22.5.1 `[MV]` Given a live session in this repository with at least two earlier sessions in its transcript folder, when the human opens the lens and the Cache Lab accordion, then every figure of US-22.2 and US-22.3 is shown with a value or `—` / `no price`, the gallery and the Keep Alive sub-accordion open inside Cache Lab, and nothing in the lens's other panels changed apart from the Context Lab heading (US-22.6). Steps: open the lens, expand Cache Lab, press each window preset and record Tokens Saved, expand the gallery, record each figure; compare Bust events with the gallery count; expand Keep Alive and compare its lines with the status line.

### US-22.6 The agent pane's Usage section becomes Context Lab (item e, ITEM-073)

As a developer, I want the agent pane's context section called Context Lab, so that its name says what it shows (the agent's context window and tokens) and it sits beside the Cache Lab by name.

- AC-22.6.1 `[PT]` Given an agent pane (the avatar panel) for an agent with usage, when it renders, then the section that read `Usage (<used> / <window>)` reads `Context Lab (<used> / <window>)` (capital L, Q-CL18; `Context lab` fails), with the same figures, the same rows, in the same place among the sections, and collapsed by default as before.
- AC-22.6.2 `[PT]` Given a hand-off pane (the arrow panel), when it renders, then its section still reads `Usage (in <n>, out <n>)`, unchanged (agent pane only, the human's decision).
- AC-22.6.3 `[PT]` Given an agent whose section was open before the rename (its open state stored in the session), when the agent pane renders after the rename, then the Context Lab section is open; toggling it opens and closes it as the Usage section did.
- AC-22.6.4 `[PT]` Given every agent pane, then no section heading in it reads `Usage`; the usage hints of the slash commands (`Usage: /…`) are not section headings and are unchanged.
- AC-22.6.5 `[DC]` Given `plugins/claude/ai-dlc-lens/README.md` after the documentation stage, then the agent panel's section is named Context Lab and the hand-off panel's still Usage.

### US-22.7 Keep Alive inside the Cache Lab (item f, ITEM-074)

As a developer, I want keep-alive's figures for the session in a Keep Alive sub-accordion of the Cache Lab, so that everything about my cache is in one place at the lens level.

- AC-22.7.1 `[PT]` Given the lens pane, when Cache Lab is opened, then its last child is a **Keep Alive** sub-accordion (label exactly `Keep Alive`), after the Invalidation Gallery (**default, Q-CL14**), collapsed by default and keeping its open state for the session, as the Usage section does today. It is drawn even when Cache Lab shows a reader reason line instead of figures (`reading transcripts...`, or a reader error): it does not depend on the transcripts. There is no Keep Alive accordion anywhere else at the lens level.
- AC-22.7.2 `[PT]` Given a published keep-alive value (fixture) with the 1h track running and the 5m track off, when Keep Alive is opened, then it shows both track lines exactly as the published `line` of each track (the status line's text), and, for each track, the time kept warm this session and `Saved by cache reads, session`, equal to the session figures the agent pane's Cache keep-alive section shows for the same value and the same price file (`—` when a price is missing).
- AC-22.7.3 `[PT]` Given the same, then Keep Alive draws no `[on]`, `[off]` or master button and changes nothing in keep-alive: it only reads the published value (the switches live in the band and the Pane, US-17.6). A track switched off for the session shows its published line, `off (disabled)`.
- AC-22.7.4 `[PT]` Given no published keep-alive value (keep-alive not loaded), when Keep Alive is opened, then it shows each track's kept-warm time as `0s` and no track line, and the rest of Cache Lab renders as usual.
- AC-22.7.5 `[PT]` Given Keep Alive open, when a Cache Lab window preset is pressed, then Keep Alive's figures do not change: they are for the session, not the window (**default, Q-CL15**).
- AC-22.7.6 `[PT]` Given `keepaliveSection` set to `false` (`/ai-dlc:lens-keepalive off`), then the Keep Alive sub-accordion is not drawn and the agent panes' Cache keep-alive section is not drawn; set to `true` (the default), both are drawn (**default, Q-CL16**: one setting for both; the agent-pane section stays).
- AC-22.7.7 `[PT]` Given a keep-alive track running, then the lens pane's header line for keep-alive (`keepaliveRow`) is drawn as today, in the header, unchanged; Keep Alive does not take it over (**default, Q-CL17**).
- AC-22.7.8 `[MV]` Given a live session with a 1h cache and a background task, when the turn ends and the human opens the lens, expands Cache Lab and then Keep Alive, then both track lines match the status line, and the kept-warm time grows after a ping. Steps: end a turn with a background task, read the status line, open Keep Alive, compare; wait for a ping, read again; record.

### US-22.8 An automatic handoff chain is one session for the Cache Lab (ITEM-077, T22.g)

As a developer whose session was handed off automatically, I want the Cache Lab to treat the handed-off sessions as the one session they continue, so that `This session` and my window choice do not reset when the context runs out.

*The human, 2026-10-25: sessions joined by automatic handoffs are one combined session. A session started by hand is a new session. Terms: the **chain id** of a session is the session id of the first session of its automatic handoff chain (auto-handoff's `lineage:<session id>` record, `chain`); a session started by hand is its own chain (chain id = its own session id). The lens takes the chain from the published keep-alive value, `chain: { id, sessions }` (spec L7, keep-alive LLD), published whatever keep-alive's `handoff.carryOver` says: that setting governs keep-alive's own state only, never the lens. With no published keep-alive value (keep-alive not loaded), the chain is the lens's own session only. Decision record: ADR-0007 (`docs/architecture/decisions/ADR-0007-an-automatic-handoff-chain-is-one-session-with-an-unchanged-cache-prefix.md`).*

Fixture **F6**: F5 plus session C2, seeded by an automatic handoff from C, with one main-loop call of model m at 2026-10-25 12:20: `in 0`, `out 0`, `cr 3,000`, `cc 0`; the published keep-alive value carries `chain: { id: C, sessions: [C2, C] }` (newest first, as keep-alive publishes it, keep-alive LLD 19.1 `chainSessions`; the order changes no figure, since the lens filters by membership). The lens runs in C2; the clock reads 12:30. Fixture **F6h**: F6 with C2 started by hand (published `chain: { id: C2, sessions: [C2] }`).

- AC-22.8.1 `[PT]` Given F6 and P, when `This session` is pressed, then the figures cover the calls of every session in the chain (C and C2): Tokens Saved `3,000`, Bust events `0`, Median baseline `60k` (C's baseline; C2 has no write). Given F6h, `This session` covers C2 only: Tokens Saved `3,000`, Bust events `0`, Median baseline `—`.
- AC-22.8.2 `[PT]` Given F6, P, and `30d` pressed in session C, when the lens renders in C2 after the automatic handoff, then the window is still `30d` (Tokens Saved `58,000`), with `cacheLabKeepWindowOnReload` `false` and again with it `true` (the chain is one session; the switch governs only a reload, AC-22.2.13). A reload in C2 then follows AC-22.2.13 as in any session. No press writes a settings file.
- AC-22.8.3 `[PT]` Given F6h, P, and `30d` pressed in session C, when the lens renders in C2 (started by hand), then the window is `7d` (Tokens Saved `56,000`). Given F6 with no published keep-alive value (keep-alive not loaded), then C2 is its own chain: the window is `7d` and `This session` covers C2 only (Tokens Saved `3,000`). Given F6 with keep-alive's `handoff.carryOver` `false`, the results of AC-22.8.1 and AC-22.8.2 are unchanged (the lens always follows the chain).

## Out of scope

- Per-session NET lists, grains (hour / day / week / month) and the rollup verdict of claude-lens.
- Reading keep-alive's published `caches` field for the Cache Lab figures (the lens computes them from transcripts; po Decision 3). Keep Alive (US-22.7) reads the published keep-alive value only for its own figures.
- Long-context price tiers (*see Q-CL8*).
- Editing `.ai-dlc/model-metadata.json`.
- A window other than the five presets in the UI; saving the window choice beyond the session, that is, into a session started by hand (a reload within the session is AC-22.2.13; an automatic handoff chain is one session, US-22.8); detecting a development setup by any means other than the switch.
- Renaming the hand-off pane's Usage section (ITEM-073 is the agent pane only).
- Switching keep-alive from the lens (US-17.6's buttons are the band and the Pane).

## Open questions (for the combined G1+G2+G3 stop)

Decided by the human on 2026-10-25 and applied in rev 2: Q-CL1 (write price by TTL), Q-CL2 (exact claude-lens rule; F1 revised, F4 added), Q-CL7 (text label), Q-CL11 (presets, default 7d, kept for the session), Q-CL12 (Keep Alive under Cache Lab), Q-CL13 (stories for 073 and 074: US-22.6, US-22.7). Answered by system-engineer (17.1.17): Q-CL6 (skipped and logged), Q-CL9 (architect's ADR-0006 and the LLD). Decided by the human on 2026-10-25 (`run.v4.md` 2m) and applied in rev 3: F1 rev 2 accepted; Q-CL18 (`Context Lab`, capital L, everywhere: US-22.6); Q-CL19 (kept across reloads with `cacheLabKeepWindowOnReload` on, reset with it off, the default: AC-22.2.13, AC-22.2.14).

Status aligned with `cache-lab.spec.md` *Open questions* (rev 4):

- **Q-CL3 — decided by po (17.1.18):** totals with unpriced calls sum the priced calls and say `N call(s) with no price` (AC-22.2.10).
- **Q-CL4 — decided by po (17.1.18):** gallery newest first, the 50 newest when truncated (AC-22.4.1, 22.4.4).
- **Q-CL5 — decided by po (17.1.18):** the Invalidation Gallery sub-accordion is collapsed by default (AC-22.2.1).
- **Q-CL6 — answered by system-engineer (17.1.17):** bad lines are skipped and counted in the debug log, no banner (AC-22.1.4).
- **Q-CL8 — decided by po (17.1.18):** base prices only; long-context tiers deferred (*Out of scope*).
- **Q-CL10 — resolved (research 17.1.6.1):** Claude Code transcripts carry the split as `usage.cache_creation.ephemeral_5m_input_tokens` and `ephemeral_1h_input_tokens`, as F1 assumes; a call without it counts as unknown TTL (AC-22.3.2, 22.3.4).
- **Q-CL14 — decided by po (17.1.28), the default:** Keep Alive is the last child of Cache Lab, after the Invalidation Gallery (AC-22.7.1).
- **Q-CL15 — decided by po (17.1.28), the default:** the window does not apply to Keep Alive; its figures are the session's, as published (AC-22.7.5).
- **Q-CL16 — decided by po (17.1.28), the default:** the agent panes' Cache keep-alive section stays, and one setting, `keepaliveSection`, governs it and Keep Alive (AC-22.7.6).
- **Q-CL17 — decided by po (17.1.28), the default:** the lens pane's keep-alive header line (`keepaliveRow`) stays in the header, unchanged (AC-22.7.7).
- **Q-CL18 — decided by the human, 2026-10-25:** `Context Lab`, capital L, matching `Cache Lab`.
- **Q-CL19 — decided by the human, 2026-10-25:** kept across reloads for development and testing, reset on reload in production, through `cacheLabKeepWindowOnReload` (default `false`; spec L7).

No question for a person is left open in this file. Two build-time unknowns stay open in `docs/specs/cache-lab.spec.md` *Open questions* ("Still open"): the turn join through `parentUuid` (AC-22.4.6 accepts a disproof) and how the lens learns its own session id at module start; the build proves both.

## Traceability

| Human's item | Stories |
|---|---|
| (1) Savings, Burst, Net Savings | US-22.2 (AC-22.2.2 to 2.4, 2.10) |
| (2) Miss attribution | US-22.3 (AC-22.3.1 to 3.3) |
| (3) TTL Mix | US-22.3 (AC-22.3.4, 3.5) |
| (4) Cache Hit %, Tokens Saved, Bust events, median baseline | US-22.2 (AC-22.2.5 to 2.9, 2.11) |
| (5) Invalidation Gallery, a sub-accordion | US-22.4, AC-22.2.1 |
| Prices from model-metadata, "no price"; writes by TTL (Q-CL1) | US-22.1 (AC-22.1.3, 1.5), AC-22.2.3, 2.10, AC-22.4.3 |
| claude-lens notice | AC-22.1.6 |
| Exact compaction rule (Q-CL2) | AC-22.3.1, 3.3, AC-22.4.2 (F1 rev 2, F4, F4b) |
| Turn label, no link (Q-CL7) | AC-22.4.6 |
| Window presets, default 7d, kept for the session (Q-CL11) | AC-22.2.12 |
| Window kept across reloads in development and testing, reset in production, by an explicit switch (Q-CL19) | AC-22.2.13, AC-22.2.14 |
| Rename Usage to Context Lab, agent pane only (ITEM-073; casing Q-CL18) | US-22.6 |
| Keep Alive sub-accordion under the Cache Lab accordion (ITEM-074) | US-22.7, AC-22.2.1 |
| Casing "Cache Lab" | AC-22.2.1 |
| Casing "Context Lab" (Q-CL18) | AC-22.6.1, 6.3, 6.5 |
| An automatic handoff chain is one session; a hand-started session is new (the human, 2026-10-25) | US-22.8 (AC-22.8.1 to 8.3), AC-22.2.12, 2.13 |
| Miss attribution boundary cases (critique 17.1.l3.1) | AC-22.3.6 |

## Docs update

`plugins/claude/ai-dlc-lens/README.md`: a Cache Lab section (each figure and its definition, the price source and TTL pricing, "no price", the window presets and default, the `cacheLabKeepWindowOnReload` switch and its variable (AC-22.2.14), the gallery cap and turn label, the Keep Alive sub-accordion); the agent panel's section renamed Context Lab (the hand-off panel keeps Usage); the Cache keep-alive paragraph and the `/ai-dlc:lens-keepalive` row updated for Keep Alive. Status *planned* (no building stage has started for root 22). `plugins/claude/ai-dlc-lens/MANUAL-CHECKS.md` rows that name the agent pane's `Usage` (W5, W7, Y13, Z2, N4) need the new name; that file is a manual-test artifact, for its owner (sqa-engineer), not documentation.
