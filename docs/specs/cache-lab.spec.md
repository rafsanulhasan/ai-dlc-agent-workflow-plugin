---
work-item: FEAT-20261020-ai-dlc-lens
root: 22
kind: spec
feature: cache-lab
module: ai-dlc-lens
revision: 4.1 (17.1.40: gate critique 17.1.l3.2 Minor 3, L5 lists the window row first, as AC-22.2.1 does). Rev 4 (17.1.31: gate-critique fix round for 17.1.l3.1, and the human's "one combined session" principle for an automatic-handoff chain). Rev 3 (17.1.23: the human's answers of 2026-10-25, run.v4.md 2i and 2j; 17.1.26: Context Lab casing and Q-CL19)
author: software-architect (Part B of keepalive-cache-status.spec.r4-delta.md, moved here and amended at 17.1.16)
date: 2026-10-25
status: draft revision 4.1 (gate critique round 2 PASS, 17.1.l3.2; its findings fixed in round 17.1.39-43, no re-critique), awaiting product-owner acceptance and the combined G1+G2+G3 stop (stories rev 4 and LLD done)
items: [ITEM-069 (22.a), ITEM-070 (22.b), ITEM-071 (22.c), ITEM-072 (22.d), ITEM-073 (22.e), ITEM-074 (22.f), ITEM-077 (22.g); umbrella ITEM-058]
stories: docs/product/backlog/ai-dlc-lens/cache-and-context-lab/stories.md (US-22.1 to US-22.8; fixtures F1 to F6, with F4b and F6h)
lld: docs/specs/cache-lab.lld.md
adrs: [ADR-0006, ADR-0007 (the chain, L7)]
sources: run.v4.md Next action 2b-2e, 2i, 2j; 17.1.10 (po); 17.1.12, 17.1.19 (research); 17.1.18 (po decisions); 17.1.6.3 (claude-lens formulas, MIT)
---

# Spec: ai-dlc-lens Cache Lab (root 22)

## Why its own spec

The software-architect decided at 17.1.16 that the Cache Lab gets its own spec. The analyst recommended this. The reasons:

- **Different plugin.** The Cache Lab is in `ai-dlc-lens`, which has its own test route (`plugin test ./plugins/claude/ai-dlc-lens`).
- **No data dependency on keep-alive** (ADR-0006).
- **Its own gates and merge order.** Root 22 merges before root 20, and keep-alive rev 3 lists root 22 as out of scope.

Keep-alive rev 4 keeps only Part A (`keepalive-cache-status.spec.r4-delta.md`).

## Overview

The lens shows a **Cache Lab** accordion, computed from the project's transcripts. Calls are classified over each whole stream, then filtered to the window. The accordion shows:

- Saved by cache, Lost to busts and NET;
- the cards Cache Hit %, Tokens Saved, Bust events and Median baseline;
- Miss attribution;
- the TTL mix;
- an Invalidation Gallery sub-accordion of busts.

Definitions, fixtures F1 to F6 (with F4b and F6h) and the expected values are in `stories.md` (*Terms*, *Fixtures*). The formulas marked *claude-lens* are reused under MIT, with the notice.

Two root-22 items join this spec on the human's answers of 2026-10-25 (`run.v4.md` 2e, 2i):

- ITEM-073: the Usage section of the **agent pane** is renamed **Context Lab** (agent pane only);
- ITEM-074: a **Keep Alive** sub-accordion inside the Cache Lab accordion.

The layout the human set (2i): lens level → **Cache Lab** accordion (as Usage is drawn today) → **Keep Alive** sub-accordion under it (as Usage is drawn today).

**Casing.** Always "Cache Lab" and "Context Lab", each with a capital L, in every artifact and UI string; never "Cache lab" or "Context lab" (human 2026-10-25, 17.1.26).

## Acceptance criteria → design

| AC | Design | Item |
|---|---|---|
| AC-22.1.1 to 1.6 | L1 reader, L2 pricing, L6 notice | ITEM-069 |
| AC-22.2.1 to 2.11 | L3 classify, L4 aggregate, L5 accordion, L7 window | ITEM-070 |
| AC-22.2.12 (fixture F5) | L7 window presets, default 7d, kept for the session | ITEM-070 |
| AC-22.2.13 | L7 *Across a reload*: the `cacheLabKeepWindowOnReload` switch, both values (Q-CL19) | ITEM-070 |
| AC-22.2.14 `[DC]` | L7 switch documented in the lens README (documentation-writer) | ITEM-070 |
| AC-22.8.1 to 8.3 (US-22.8; fixtures F6, F6h) | L7 *The chain*: "This session" and the kept window cover the automatic-handoff chain; ADR-0007 | ITEM-077 |
| AC-22.6.1 to 6.4 (US-22.6) | L8 rename, agent pane only | ITEM-073 |
| AC-22.6.5 `[DC]` | L8 documented in the lens README (documentation-writer) | ITEM-073 |
| AC-22.7.1 to 7.7 (US-22.7) | L9 Keep Alive sub-accordion | ITEM-074 |
| AC-22.7.8 `[MV]` | L9, live check | ITEM-074 |
| AC-22.3.1 to 3.5 | L3 (exact compaction rule, Q-CL2), L4; 22.3.1 and 22.3.3 reworded and F1 revised by requirement-analyst | ITEM-071 |
| AC-22.3.6 | L3 attribution boundary cases (gap exactly 5m, 1h-only lapse, a gap between the two TTLs) | ITEM-071 |
| AC-22.4.1 to 4.5, 4.7 | L4 gallery, L5; the A4 row of 22.4.2 follows Q-CL2 | ITEM-072 |
| AC-22.4.6 | a text label, never a link (Q-CL7 option b, human accepted 2026-10-25) | ITEM-072 |
| AC-22.5.1 | live check | all |

## Design

The architecture is decided in ADR-0006. The system-engineer's LLD (17.1.17) fixes names, files and the string table.

- **L1, the transcript reader (ADR-0006).** A dependency-free `node` child script shipped in the lens plugin, run with `$.process.run`.
  - **Input.** The transcript folder and the files to read. The folder is the parent of `transcript_path`, taken from the first classic event the module sees: `classic.SessionStart`, else `classic.Stop` or `classic.UserPromptSubmit`. Main streams are `<folder>/<sessionId>.jsonl`; sidechains are `<folder>/<sessionId>/subagents/agent-<id>.jsonl`.
  - **Reading.**
    - Each file is streamed line by line, so the 4 MiB `$.fs.read` cap does not apply.
    - Calls are deduped by `message.id`: one response is written as several rows with the same usage.
    - Lines that are not JSON, and assistant rows with no usage, are skipped and counted (Q-CL6).
  - **Output.** `Call` records only, never message text, in the `{ data, error }` envelope. The output is paged or windowed so that one run stays under the 4 MiB stdout cap. `isStdoutTruncated`, a non-zero exit, no `node`, or no folder located yet each show as a one-line reason in the accordion, never as a partial figure.
  - **Caching.**
    - Files whose mtime is before the window start are not read.
    - A stream that is read is read whole.
    - Records are cached in module memory per `(path, size, mtimeMs)` for the session.
- **L2, pricing.**
  - Prices come from the lens's model metadata file, the `costingPath` setting (default `.ai-dlc/model-metadata.json`, relative to the session's cwd), loaded by the existing `loadCosting`.
  - A call's model id is matched by the existing `lookupModel`: lower case, with `[1m]` and a trailing `-YYYYMMDD` dropped, against each entry's `id` and `aliases`. No match means the model is **unpriced**. So does a needed price that is null.
  - Each TTL part of a write is priced at its own rate: `cc5m` at the 5m write rate, `cc1h` at the 1h write rate, and the part of `cc` of unknown TTL at the 5m rate (Q-CL1, human accepted 2026-10-25).
  - Base prices only: long-context tiers are deferred (Q-CL8, po 17.1.18).
- **L3, classify (pure).**
  - Each stream is taken whole, in time order. For each call it works out:
    - whether it is the stream's first call;
    - whether it is a bust (not a first call, `cc` > 10,000);
    - its base cause, first match wins: model switch, then compaction, else unexplained;
    - **compaction (Q-CL2, the exact claude-lens rule, human chose it 2026-10-25).** Let `p1` be the call just before this one in its stream and `p2` the call before `p1`. The cause is compaction when both exist, `p2.cr > 0`, and `(p2.cr − p1.cr) / p2.cr > 0.5` (strict). The call being classified is never read, and context size (`in + cr + cc`) plays no part. This replaces the context-size rule in the stories' *Terms*. The LLD names the function (`isCompaction`);
    - its attribution, by the *Terms* rule.
  - The calls are then filtered to the window, inclusive at both ends.
- **L4, aggregate (pure).**
  - **Savings.** Saved, Lost and NET are summed over priced calls, with a count of unpriced calls. Per po Q-CL3, the totals are the priced sum plus a note `N call(s) with no price`.
  - **Cards.** Hit %, Tokens Saved, Bust events, and Median baseline (a true median of session baselines; sidechains excluded).
  - **Breakdowns.** Attribution counts, and the TTL mix.
  - **Gallery.** Bust rows only, newest first. When there are more than 50, the 50 newest are kept, with the total and a truncated flag (po Q-CL4).
  - **The seam.** L3 and L4 together are one function, `(calls, prices, window) → CacheLab`.
- **L5, the accordion.**
  - The Cache Lab accordion holds, in this order (AC-22.2.1): the window row (L7, AC-22.2.12), the savings row, the cards row, Miss attribution, the TTL mix, then the Invalidation Gallery sub-accordion, collapsed by default (po Q-CL5).
  - A gallery row shows time, model, session, stream (sidechain rows only), attribution, cache-write tokens, loss and a turn label.
  - **Turn label (Q-CL7 option b, human accepted).** Plain text `prompt <id8> · turn <n>`, where `<id8>` is the first 8 characters of the prompt id and `<n>` the turn number, else `No turn attribution`. It is never a link.
  - No row shows prompt text or tool details.
  - Then the **Keep Alive** sub-accordion (L9), last, collapsed by default.
- **L6, notices.**
  - `plugins/claude/ai-dlc-lens/NOTICE.md` gains the claude-lens MIT notice (© 2026 Foyzul Karim) and names the formulas reused. It also says that Cache Hit %, Tokens Saved and Median baseline deliberately differ.
  - A new `plugins/claude/ai-dlc-lens/ATTRIBUTION.md` lists each formula taken and how it changed.
  - `THIRD_PARTY_NOTICES.md` gets the upstream entry.
- **L7, the window (Q-CL11, human accepted 2026-10-25).** The window is the time range the Cache Lab shows. The lens has no time window today: its "window" settings are context windows.
  - A preset selector in the Cache Lab header: This session, Today, 7d, 30d, All.
  - The default is 7d.
  - A choice is kept for the rest of the session and is never written to a setting. A press recomputes the figures.
  - **The chain (human 2026-10-25, "one combined session"; ITEM-077; ADR-0007).** Sessions linked by automatic handoffs are one session for the Cache Lab; a session started by hand is a new one.
    - **Where the lens learns the chain.** From the published keep-alive value, `chain?: { id, sessions }` (`keepalive-cache-status.spec.r4-delta.md`, D8 and D12), published whatever `handoff.carryOver` says. The lens does not read auto-handoff's `lineage:` records, because the two plugins are not known to share one `$.store`. With no published value (keep-alive not loaded), the chain is the lens's own session only.
    - **"This session"** covers the calls of every session in the chain (the main streams and sidechains of each).
    - **The kept window** is kept for the chain. In module memory it survives the handoff's `/clear` (module variables do). With the switch below on, it is stored by chain id. A session started by hand starts at 7d.
  - **Across a reload (Q-CL19, human 2026-10-25, 17.1.26).** Kept for development and testing, reset for production, chosen by one explicit lens setting. "Dev" is never detected (no `NODE_ENV`, no plugin path or version check, no marketplace check).
    - **The switch.** `cacheLabKeepWindowOnReload`, a lens bool setting in `hooks/settings.ts` `SPEC`, **default `false`** (production behaviour). Env name by the lens's existing rule: `AI_DLC_LENS_CACHE_LAB_KEEP_WINDOW_ON_RELOAD`.
    - **Where it is read.** By the lens's existing settings loader, with its existing precedence: the `env` of `.claude/settings.local.json`, then of `.claude/settings.json`, then `.ai-dlc/lens.json`, then the default. The process environment is never read (lens US-5, AC-5.4). `/ai-dlc:lens-configure` lists it like every other key. A developer turns it on in the gitignored `.claude/settings.local.json`, so a committed project setting never carries it to users by accident.
    - **Off (default, production).** The choice lives in module memory only: `/reload-plugins` or a module restart puts it back to 7d. `$.store` is neither read nor written for it, and an entry left there from an earlier `true` is ignored.
    - **On (development and testing).** Each press also writes the preset to `$.store`, keyed by chain id (session id when no chain is published) and bounded like keep-alive's `sessionOverrides` (oldest dropped). At module start the lens reads that entry for the current chain and starts from it, else 7d. A session started by hand always starts at 7d. An invalid stored value falls back to 7d.
    - **No ADR.** It is a reversible, session-scoped preference on an existing settings mechanism; it fails the *hard to reverse* test, as the D10 switch did.
  - The Keep Alive sub-accordion ignores the window: it shows the live session (L9).
- **L8, the Usage section becomes Context Lab (ITEM-073, human: agent pane only; casing "Context Lab", human 2026-10-25).** Only the label changes: the heading of the agent-pane section, and the test that pins the section order (`tests/lens.test.tsx`:932-934). Setting keys and section ids do not change, so a user's open or closed state survives. The edge pane's `Usage (in …, out …)` heading, which shows hand-off token flow, keeps its name.
- **L9, Keep Alive as a sub-accordion of Cache Lab (ITEM-074; Q-CL12, human layout 2026-10-25).** Inside the Cache Lab accordion, after the Invalidation Gallery, a **Keep Alive** sub-accordion, collapsed by default, shows the live session's keep-alive figures per track (5m, 1h).
  - **Data.** It reuses `keepaliveFigures` and the published `$.state` keepalive (rev 4 D8, `sessionSwitch` and `sessionMaster` included, shown as text). It needs no reader and no window, so it renders even when the Cache Lab shows a reader reason line (no `node`, no folder, truncated).
  - **No switch.** The lens draws no Button for keep-alive (rev 4 Part A, *Out of scope*); the band and the Pane own the presses.
  - **The rest stays.** The per-agent `Cache keep-alive` section stays, behind `keepaliveSection` as today (Q-CL16, po 17.1.28). The pane-head keep-alive line `keepaliveRow` stays in the header, unchanged (Q-CL17, po 17.1.28; AC-22.7.7).

## Data shapes

There is no request/response API, so the `{ data, error }` envelope applies only to the reader's stdout.

**The LLD owns the shapes** (`docs/specs/cache-lab.lld.md`, sections 3 to 5: `Call`, `Classified`, `Window`, `CacheLab`, the gallery row, the reader's modes, paging and records). This spec fixes only what the ACs observe:

- the window presets `This session`, `Today`, `7d`, `30d`, `All`, default `7d` (L7); a window is a time range with an optional set of sessions (the chain, for "This session");
- a dollar figure is a number or `no price`, and the savings row notes the unpriced calls (L4, AC-22.1.5, 22.2.10);
- a gallery row's turn label is `prompt <id8> · turn <n>` or `No turn attribution` (L5);
- the stored window (only with `cacheLabKeepWindowOnReload` on) is one preset per chain id in `$.store`, bounded; the LLD names the key and the bound.

The earlier field lists of this section (revision 3) are withdrawn; where they differed from the LLD, the LLD wins.

## Test seams

- **Pure seam (highest; observes every number with no UI or I/O).** `(calls, prices, window) → CacheLab`, driven by F1 to F6 (with F4b and F6h) and the price fixture P, in UTC (the fixtures' zone): AC-22.1.2, 1.3, 1.5, 22.2.2 to 2.11, 22.3.1 to 3.6 and 22.4.1 to 4.5, each window preset's bounds (F5), and "This session" over a chain (F6, AC-22.8.1).
  - **F1 under the exact rule (Q-CL2; stories rev 2, 17.1.22).** F1's A3 now has `cr` 15,000, so A4's ratio is 0.25 and A4 stays a Prefix change. The cache-read totals and the figures built on them changed with it (the stories carry the new values). Compaction is proved by F4 (ratio 0.6, Unknown) and F4b (exactly 0.5, Prefix change), AC-22.3.3.
  - **The compaction rule** gets its own table of `(p2.cr, p1.cr)` pairs: a fall of exactly half (not compaction), just over half, `p2.cr` 0, a missing neighbour, and a rise.
- **Reader seam.** The child script against fixture JSONL files built from F1. They include a duplicated `message.id`, a non-JSON line, an assistant row with no usage, a sidechain file, and one file over 4 MiB, generated by the test rather than committed. Covers the `[NT]` ACs, AC-22.1.1, 1.4 and the turn join of 22.4.6, plus dedupe, the large file and the page limit. Route `[NT]`: `node --test "tests/**/*.test.mjs"` (`tests/cache-reader/`, LLD section 2), never `plugin test`.
- **Lens render seam.** `tests/lens.test.tsx` is prior art. Covers AC-22.2.1, the formatted strings, gallery rows with their turn label and the 4.7 privacy check, the window selector (default 7d, a press recomputes, kept for the session, no setting written), Q-CL19 both ways (AC-22.2.13; setting off: a module restart in the same session starts at 7d and `$.store` is untouched; setting on: it starts from the stored preset, a new session starts at 7d, an invalid stored value gives 7d), the chain (AC-22.8.2, 8.3: the window kept across an automatic handoff, reset in a session started by hand, the own session only with no published chain), the reason lines (no folder, no `node`, truncated), L8 (agent pane renamed, edge pane unchanged) and L9 (Keep Alive sub-accordion inside Cache Lab, collapsed, drawn while a reader reason line shows).
- **Document check `[DC]`.** AC-22.1.6, 22.2.14, 22.6.5.
- **Manual `[MV]`.** AC-22.5.1, 22.7.8.

## Out of scope

- Per-session NET lists, grains, and the rollup verdict.
- Reading keep-alive's `caches`.
- Long-context price tiers (Q-CL8, deferred).
- Editing `.ai-dlc/model-metadata.json`.
- A turn link in the gallery: there is no API to open a turn (17.1.19).
- A setting that points the reader at another folder.
- A cache of reader results on disk.

## Open questions

Every question below has one status, the same in this spec and in `stories.md` rev 4.

| Question | Status |
|---|---|
| Q-CL1 | decided, human 2026-10-25: price writes by TTL (L2) |
| Q-CL2 | decided, human 2026-10-25: the exact claude-lens rule (L3); F1 and ACs revised by requirement-analyst |
| Q-CL3, Q-CL4, Q-CL5, Q-CL8 | decided, product-owner 17.1.18 (the stories' defaults; L4, L5, L2) |
| Q-CL6 | answered, system-engineer 17.1.17: lines that are not JSON, and assistant rows with no usage, are skipped and counted in the debug log (L1) |
| Q-CL7 | decided, human 2026-10-25: option (b), a text label, never a link (L5) |
| Q-CL9 | answered: ADR-0006, L1 and L2 |
| Q-CL10 | answered, research 17.1.6.1: transcripts carry the split, `usage.cache_creation.ephemeral_5m_input_tokens` and `ephemeral_1h_input_tokens` (keep-alive already reads it, `plugins/claude/ai-dlc/hooks/keepalive/keepalive.ts`:84) |
| Q-CL11 | decided, human 2026-10-25: This session / Today / 7d / 30d / All, default 7d, kept for the session (L7) |
| Q-CL12 | decided, human 2026-10-25: Keep Alive is a sub-accordion under Cache Lab (L9) |
| Q-CL13 | closed: US-22.6, US-22.7 and AC-22.2.12 exist |
| Q-CL14 to Q-CL17 | decided, product-owner 17.1.28, all four defaults: Keep Alive last; not windowed; one `keepaliveSection` for both; `keepaliveRow` unchanged (L9) |
| Q-CL18 | decided, human 2026-10-25: "Context Lab", capital L (L8, *Casing*) |
| Q-CL19 | decided, human 2026-10-25: kept across a reload for development and testing, reset for production; switch `cacheLabKeepWindowOnReload`, default off (L7) |
| ITEM-073 scope | decided, human 2026-10-25: agent pane only (L8) |
| The chain | decided, human 2026-10-25: an automatic-handoff chain is one session (L7, ITEM-077, ADR-0007) |

Still open (build, not a question for a person):

- **Turn join.** The join from an assistant row to its user turn through `parentUuid` is unverified (17.1.19); a reader fixture test must prove it before AC-22.4.6 passes, and AC-22.4.6 accepts a disproof.
- **The session id at module start** (critique 17.1.l3.1, *Unverified*): how the lens learns its own session id for "This session" and the stored window. The LLD names the call; the build proves it.

## Review status

The software-architect has reviewed this spec (17.1.16) and revised it to the human's answers (17.1.23, 17.1.26). At 17.1.31, the gate-critique fix round for 17.1.l3.1:

- Blocker 3: L9 no longer says the LLD moves `keepaliveRow`; it stays (Q-CL17).
- Majors: the AC map and the test seams now cover AC-22.2.13, 2.14, 3.6, 6.5, 7.8 and US-22.8, and the fixtures F4, F4b, F5 and F6; the open-question statuses match the stories; the frontmatter and header are current; Data shapes defers to the LLD.
- ITEM-077 (the chain) is added to L7.

At 17.1.40 (rev 4.1), after gate critique round 2 (17.1.l3.2, PASS): Minor 3, L5 now lists the window row first, as AC-22.2.1 does. The other findings are in the stories, the LLD and `item.md` (requirement-analyst, system-engineer, product-manager).

The requirement-analyst's stories (rev 4) and the system-engineer's LLD are done. Product-owner acceptance and the combined G1+G2+G3 stop are pending.
