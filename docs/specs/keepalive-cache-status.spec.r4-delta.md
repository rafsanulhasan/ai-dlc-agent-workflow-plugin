---
work-item: FEAT-20261020-ai-dlc-lens
root: 17 (part B moved to docs/specs/cache-lab.spec.md, root 22, on 2026-10-25)
kind: spec delta
feature: keepalive-cache-status
base: docs/specs/keepalive-cache-status.spec.md (revision 3; not reopened)
revision: 4.7 (delta only; 17.1.50, gate critique 17.1.l2.4 Minors 3 and 4: AC-map rows say firm since 034.c. 4.6, 17.1.40, gate critique 17.1.l2.2 fixes: Minor 1 D12 table joined, Minor 2 D13 AC-map ids, Blocker 1 D12 master in force with `carryOver: false`, 034.c result in D2 / D2a, `chainIdOf`, D8 `chain.sessions` newest first as LLD 19.1. 4.5, 17.1.35.l1.2: summary tokens for a track stopped by overage and for compaction. 4.4, 17.1.35.l1.1: Q-SL11 decided, setting `statusText`, the human's 2v. 4.3, 17.1.35: D13 status-line summary, the full text in the band and the Pane under the title row `⚠ ai-dlc cache-keepalive:`, the human's 2s and 2t. 4.2, 17.1.31.l1.1: Q-SL9 decided (onWhenOff acts as a master [on] press), Q-SL10 confirmed, setting `sourceNote`. 4.1, 17.1.31: gate-critique fix round for 17.1.l2.1, the human's decisions of run.v4.md 2n and the "one combined session" principle)
author: requirement-analyst (synthesis; design sections are proposals for software-architect and system-engineer)
date: 2026-10-25
status: draft (Part A revised by software-architect at 17.1.23 to the human's master-button decision, at 17.1.26 to the track-button label rule, Q-SL8, and at 17.1.31 to the human's 2n decisions: D3 hide rule, the keep-warm source note, D12 automatic-handoff chain), awaiting gate critique round 2, product-owner acceptance and the combined G1+G2+G3 stop
items: [ITEM-068 (T17.6, part A); ITEM-076 (T17.7, D12 chain carry-over); part B moved to cache-lab.spec.md]
adrs: [ADR-0007 (D12)]
stories: docs/product/active/session-continuity-and-cache-visibility/sprint-1/keepalive-cache-status/stories.delta-r4.md (US-17.6); docs/product/backlog/ai-dlc-lens/cache-and-context-lab/stories.md (US-22.1 to US-22.5)
sources: run.v4.md Next action 2b, 2c, 2i, 2j, 2n; the human's "one combined session" principle (2026-10-25, relayed at 17.1.31); the human's placement and click decisions relayed 2026-10-25; 17.1.10 (po decisions); 17.1.12 (surfaces, promptId); 17.1.6.3 (claude-lens formulas, MIT)
---

# Spec revision 4 (delta): both tracks always shown with buttons; Cache Lab

Revision 3 stays in force. Its ACs, D1 to D8, test seams and open questions are not reopened. This delta adds what follows; where it replaces a rev 3 literal, it says so.

## Part A: keep-alive (root 17, ITEM-068)

### Overview

Today a track that rev 3 does not render, and every off line, hide what keep-alive would do. The human wants both tracks always visible, with keep-warm and pings even when off, and a button beside each track to switch it for this session. The status line cannot hold buttons (17.1.12), so the buttons live in an AbovePrompt band on Terminal and Desktop and in a Pane on VS Code; the status line keeps both lines as text.

### Acceptance criteria → design

| AC | Design | Firm / conditional |
|---|---|---|
| AC-17.6.1 to 6.5 | D3 amended (both tracks, off-line suffix) | firm; E2'/E3' firm since 034.c (*034.c result*; read once the subagent has stopped) |
| AC-17.6.33 (hide rule; the seed line hidden too) | D3 amended, *Nothing allowed* | firm (human 2026-10-25, run.v4.md 2n.1) |
| AC-17.6.34 (labels, published `keepWarmFrom`, setting `sourceNote`); AC-17.6.3 and AC-17.6.4 reworded | D3 amended, *Source note* | firm (human 2026-10-25, 2n.2; `sourceNote` 17.1.31.l1.1) |
| AC-17.6.6 to 6.8 | D9 band | firm; 6.8 default of Q-SL3 |
| AC-17.6.9 to 6.11 | D9 Pane | firm |
| AC-17.6.12 to 6.18, 6.21, 6.32 | D10 session switch, D5 amended | firm; 6.15 Q-SL1 (human accepted 2026-10-25); 6.32 Q-SL8 |
| AC-17.6.19 (superseded by 6.31), AC-17.6.23 to 6.31 (6.30 manual) | D11 master button, D5 amended | firm (human 2026-10-25, run.v4.md 2j); Q-SL4 withdrawn |
| AC-17.6.20 | D8 amended | firm |
| AC-17.6.22 | live check | firm (manual) |
| AC-17.7.1 to 7.10 (US-17.7, ITEM-076: carry-over, `handoff.onWhenOff`, `handoff.carryOver`, the prefix rule) | D12 automatic-handoff chain, ADR-0007 | firm (human 2026-10-25, 2n.3, the combined-session principle, Q-SL9 and Q-SL10) |
| AC-17.6.1 to 6.4, 6.34, 6.35 (now: the *full line*), 6.6, 6.9, 6.23 (title row text); AC-17.6.37 to 6.41 (summary, length rule, surface rule, `statusText`); AC-17.4.4 to 4.6 (the summary's ping and first-ping tokens) | D13 status-line summary | firm (human 2026-10-25, run.v4.md 2s, 2t; setting `statusText` 2v, Q-SL11); the live check of the `auto` rule stays manual |
| AC-17.1.2, AC-17.3.4 (subagents), AC-17.3.7 (historical: conditional on 034.c in rev 3; firm since base spec rev 3.1) | rev 3 D2 transcript fallback, D2a until the subagent stops (*034.c result* below) | firm since 034.c (human's live check 2026-10-25, run.v4.md 2w): built as written for a stopped subagent; a running subagent reads `subagents: split unknown`; AC-17.3.7 restated in base spec rev 3.1 to both readings |

### Literals replaced

E1 to E5 of `stories.md` are replaced by E1' to E5' of `stories.delta-r4.md`; E8 and E9 are added. Every rev 3 test that compares an off line takes the suffix. The data-shape table of rev 3 (`Reason`) is unchanged: the suffix follows the reason, it is not part of it.

### Design (proposals)

- **D3 amended, line rendering.** The pure render function always returns both track lines. An off line (any `Reason`, `overage` included) ends with `, ping 0/<cap>, keep warm <d>`, where `<cap>` and `<d>` are the cap and keep-warm text a running line of that track would show now (the session's keep-warm override included). Running and stopped lines are unchanged except for the source note below.
  - **Source note (human 2026-10-25, run.v4.md 2n.2).** Every keep-warm clause on every line, running (E6, E7) and off alike, ends with ` (<label>)` right after the duration: `keep warm 8h (session)`. The note is always written, `default` included. The label names where the keep-warm time in force came from, from the same lookup that gives the time (`keepWarm`, `hooks/keepalive/keepalive.ts`):

    | Label | The time came from |
    |---|---|
    | `session` | a `/ai-dlc:cache-keepalive --session` override of that track, set in this session or earlier in its automatic-handoff chain (D12) |
    | `machine` | a `/ai-dlc:cache-keepalive --machine` override |
    | `settings` | any settings level: `.ai-dlc/cache-keepalive.json`, or an `AI_DLC_KEEPALIVE_*` variable in the `env` of any settings file |
    | `default` | no level sets it |

    The labels are exactly these four lower-case words. **Setting `sourceNote`** (human 2026-10-25, 17.1.31.l1.1): key `sourceNote`, variable `AI_DLC_KEEPALIVE_SOURCE_NOTE`, boolean, default `true`, not trust-gated (display only). With `false`, no line carries ` (<label>)`; `keepWarmFrom` is still published, and the command report is unchanged. The status line never names the file; the `/ai-dlc:cache-keepalive` report keeps its long source text (`this session, /ai-dlc:cache-keepalive`, `<name> in <file>`). AC-17.6.4 becomes "byte-for-byte as before, except the source note".
  - **Nothing allowed (human 2026-10-25, run.v4.md 2n.1).** When neither track is allowed (D5), keep-alive draws **no status line**: both track lines and the `keepalive seed:` line are hidden, as `enabled: false` hides them today. The band and the Pane still draw the title row, both rows (`off (disabled)` with the suffix) and their Buttons, so the human can turn a track back on; the published value still carries both lines. As soon as one track is allowed (for example after a track `[on]`), the status line shows both lines again.
- **D5 amended, arming.** Before rev 3 D5 runs, the track must be *allowed*, decided in this order (first match wins):
  1. track switch `on`: allowed, whatever the master (the per-track `[on]` overrides the master for this session);
  2. track switch `off`: not allowed;
  3. unset: allowed when the effective master is on and the settings `<track>.enabled` is true.

  The effective master is the session master switch (D11) when set, else the settings `enabled`. A track that is not allowed does not arm, and its reason is `disabled`. An allowed track arms only as rev 3 D5 says: at a turn end with background tasks running and a warm cache of its lifetime (Q-SL1, human accepted 2026-10-25). *(17.1.16 said the switch never overrides the master; the human replaced that on 2026-10-25, run.v4.md 2j, and 17.1.23 rewrote this item.)*
- **D9 surfaces (new).**
  - Status line: *(replaced by D13, 17.1.35)* a one-line summary of both tracks; the full lines only where every attached surface is VS Code.
  - Band: on Terminal and Desktop, one AbovePrompt element: a title row holding the **master Button** (D11), then the 5m row, then the 1h row (Q-SL5), each track row its line text and one Button, padding and gap 0 (Q-SL6). It follows auto-handoff's band pattern, which already puts a Button in an AbovePrompt.
  - Pane: on VS Code, `/ai-dlc:cache-keepalive` (no arguments) also opens a keep-alive Pane with the same title row (master Button included), rows and Buttons, and updates it in place while open. No band on VS Code (AbovePrompt does not render there).
  - The `status` setting hides all three.
  - Surface detection (architect review, 17.1.16): the host gives a signal. `$.session.surfaces()` (d.ts:2864-2875) answers the surfaces, and a render hook reads `e.surface`. The lens already uses `$.session.surfaces()` (`plugins/claude/ai-dlc-lens/hooks/register.tsx`:1006), which is prior art. The fallback stays: draw the band always, since AbovePrompt is not raised on VS Code, and on VS Code the command also opens the Pane.
- **D10 session switch (new).** One value per track, `on | off | unset`, unset when a new chain starts (a session started by hand; D12).
  - **Where it is kept** (amended at the architect review, 17.1.16): the switch is kept the way `/ai-dlc:cache-keepalive --session` overrides are kept. That is in `$.store`, keyed by the **chain id** (D12; amended 17.1.31, was the session id) like the `--session` overrides (`sessionOverrides`, `hooks/keepalive/keepalive.ts`:443, which move to the chain id too), bounded by `sessionOverridesMax`.
  - **Why not module memory:** a `/reload-plugins` or a module restart would forget an `[off]`, and the track would silently re-arm and spend.
  - **Settings files:** none is ever written, per AC-17.6.17.
  - **Label (Q-SL8, human 2026-10-25, 17.1.26).** A track Button follows whether the track is *allowed* (D5), never whether it is running. It shows `[off]` whenever the track is allowed to arm (by its switch, the master or the settings), even before it arms or pings; it shows `[on]` only when the track is not allowed. The master Button follows the same idea (D11, *Label*).
  - `[off]` (the track is allowed): set the switch `off`. If the track is running, stop it now with the reason `disabled` (no stopped-line text) and cancel its timer; if it is not running, nothing else happens. Either way the track is no longer allowed and the Button shows `[on]`.
  - `[on]` (the track is not allowed): set the switch `on`; no ping; the track is now allowed, the Button shows `[off]`, and the track arms at the next Stop under D5.
  - A track press never changes the master switch (D11).
  - `/ai-dlc:cache-keepalive` reports a set switch per track, and the master switch when set.
- **D11 master button (new; human 2026-10-25, run.v4.md 2j; replaces Q-SL4).** The title row of the band and of the Pane holds one master Button for keep-alive as a whole, this session only.
  - **Value.** One session master switch, `on | off | unset`, unset when a new chain starts, kept with the track switches in `$.store` by chain id (D10, D12). No settings file is ever written (AC-17.6.17).
  - **Label.** `[off]` when the effective master is on, `[on]` when it is off.
  - **Master `[off]`.** Sets the master `off`, clears both track switches to unset, and stops each running track now as a track `[off]` does (reason `disabled`, timer cancelled). Both tracks end off, whatever they were.
  - **Master `[on]`.** Sets the master `on`, which overrides a settings `enabled: false` for this session, and sets **both track switches to `on`**, which overrides a settings `<track>.enabled: false` too (D5, rule 1). Both tracks are then allowed and arm at the next turn end under rev 3 D5. No ping is sent at the press. *(Q-SL7, human 2026-10-25, follow-up 17.1.23.l1.1: "Force both tracks on".)*
  - **Track presses.** A track `[on]` sets that track's switch `on` and overrides the master (D5, rule 1); a track `[off]` sets it `off`. Neither changes the master switch.
  - **Example.** Master off by settings; the human presses the 1h `[on]`: the 1h track may arm and its Button shows `[off]` at once, before it arms; the 5m track stays `off (disabled)` with `[on]`; the master Button still shows `[on]`. Pressing the master `[off]` then stops the 1h track and clears its switch. Pressing the master `[on]` next sets both track switches `on`: both tracks may arm, even with `fiveMinute.enabled: false` in a settings file, and the master Button shows `[off]`. A track `[off]` after that turns only that track off; the master stays on.
- **D12 automatic-handoff chain (new; human 2026-10-25, run.v4.md 2n.3 and the "one combined session" principle; ADR-0007).** Sessions linked by automatic handoffs are **one combined session**. A session the human starts by hand starts a new chain.
  - **Chain id.** The session id of the chain's first session. Auto-handoff already records it: at the seed's `classic.SessionStart` (`source: 'clear'`), before the seed prompt, it writes `lineage:<newSession>` = `{ from, chain, depth, baseName }` to `$.store` (`hooks/auto-handoff/register.tsx`:1039-1040; `chain` set at :464). A session's chain id is `lineage:<own id>`.chain; with no record (started by hand), its own session id. A failed store read falls back to the own session id (a clean session) with a debug log line. One shared reader, `hooks/auto-handoff/chain.ts` (`chainIdOf`, `chainSessions`; LLD section 19.1; named `chainIdOf` because `register.tsx`:3 already imports a different `chainOf` from `viewer.ts`), serves keep-alive and auto-handoff.
  - **Keyed by chain id.** The master switch and the track switches (D10, D11) and the `--session` keep-warm overrides are kept per chain, so they continue in the seeded session. `session.end` deletes this session's chain state only when no automatic handoff is in progress or `handoff.carryOver` is `false` (closes 17.1.l2.1 Minor 9: a track the human pressed `[off]` stays off in the seeded session).
  - **Not carried.** Running timers (stopped before the `/clear` by `stopForHandoff`, as today); the cache ledger (the new conversation can read only the shared prefix of the old one's cache); the ping count, the spend counter and the budget, all of which every arming starts afresh (`hooks/keepalive/keepalive.ts`:802-803), within one session too.
  - **The exception, `handoff.onWhenOff`.** In the seed branch of auto-handoff's `classic.SessionStart`, through a keep-alive export the LLD names (`applyHandoffSeed`), once per handoff: when the seeded session's master in force is off, the seeded session acts **as a master `[on]` press** (D11; human 2026-10-25, Q-SL9): it sets the chain's master switch `on` **and both track switches `on`**, which overrides a settings `<track>.enabled: false` too. No ping is sent at the seed; the tracks arm at a turn end under rev 3 D5. It applies whatever `handoff.carryOver` says (Q-SL10). The master in force is read from the state the seeded session sees (rev 4.6, 17.1.40, KA B1):
    - `handoff.carryOver: true`: the chain's master switch, else the settings `enabled`; a master `[off]` pressed in S1 is carried and triggers the exception.
    - `handoff.carryOver: false`: the seeded session's own fresh state, which has no switch, so the settings `enabled` alone. The exception fires only when the settings say `enabled: false`; a master `[off]` pressed in S1 is not carried and does **not** trigger it (S2 starts as the settings say, master on with default settings).
  - **Settings** (`.ai-dlc/cache-keepalive.json` key, a settings `env` variable, `/ai-dlc:cache-keepalive-configure`, the `SETTINGS` table of `hooks/keepalive/settings.ts`):

    | Key | Variable | Kind | Default | Trust-gated | Effect |
    |---|---|---|---|---|---|
    | `handoff.carryOver` | `AI_DLC_KEEPALIVE_HANDOFF_CARRY_OVER` | boolean | `true` | no (it never starts spending on its own) | `true`: keep-alive's per-session state is keyed by chain id (2n.3 b). `false`: by session id, so every seeded session starts keep-alive clean, like one started by hand. It governs keep-alive only; the chain is still published (D8) for the lens. |
    | `handoff.onWhenOff` | `AI_DLC_KEEPALIVE_HANDOFF_ON_WHEN_OFF` | boolean | `true` | yes (it can start spending) | `true`: a seeded session whose chain's master in force is off acts as a master `[on]` press: master and both tracks on (2n.3 a, Q-SL9). `false`: the off state continues (with `carryOver` on), or the session starts from the settings (with it off). |
    | `statusText` | `AI_DLC_KEEPALIVE_STATUS_TEXT` | `auto`, `summary` or `full` | `auto` | no (display only) | Which text the status line gets (D13). `auto`: the surface rule. `summary` / `full`: that text on every surface, the roster not read. |

    `/ai-dlc:cache-keepalive-configure` lists `handoff.carryOver`, `handoff.onWhenOff`, `sourceNote` (D3) and `statusText` (D13) like every other keep-alive setting, and the README settings table carries their rows.

  - **The cache prefix never changes (2n.3 c, ADR-0007).** The carry-over and the exception change only `$.store` keys and keep-alive's own published state. Neither keep-alive nor auto-handoff changes, for a seeded session, the model, the effort, the tools, the system prompt, a settings file, a context file (`CLAUDE.md`, rules, memory) or the seed text. Auto-handoff already keeps this rule (`register.tsx`:25-28); ADR-0007 makes it binding on every module in the chain.
- **034.c result: rev 3 D2 and D2a amended (rev 4.6, 17.1.40; the human's live check, run.v4.md 2w, Claude Code 2.1.310; agreed with system-engineer, keep-alive LLD rev 12, 3.7).** The check found a subagent's live `turn.step` usage with writes and **no** split (4 of 4), and its finished transcript **with** the split (`rows=54 split=present`). Both rev 3 branches therefore apply, in order, which is rev 3 D2's transcript fallback with D2a as the interim, not a new behaviour:
  - While the subagent runs, each write without a split enters the ledger as TTL *unknown* (D2a, unchanged): the cache parts read `subagents: split unknown` and the write arms nothing.
  - At `classic.SubagentStop`, when the agent transcript exists and is readable, its split replaces the *unknown* entry: one entry per TTL, written at the matching row's timestamp (else now), warm until that time plus the TTL, kept only when that is after now. The *unknown* entry is deleted, so the line shows the real TTLs from the stop on.
  - A missing transcript, or one with no split (forked helpers such as `prompt_suggestion` have none), leaves the *unknown* entry.
  - So AC-17.1.2, AC-17.3.4 (subagents) and AC-17.3.7 are built as written for a subagent that has stopped; for one still running they read `subagents: split unknown` (AC-17.3.7 is restated in the base spec, rev 3.1, with both readings; the stories delta's E2'/E3' note points to it). Reading the transcript of a still-running subagent is not designed. The Windows `tail` failure and the forked-helper lines (2w b, a) are LLD fixes (3.7, 3.4), not spec changes.
  - This stays within what the human approved (rev 3 D2 and D2a, OQ4), so no `clarify:` was needed.
- **D8 amended, published state.** `KeepaliveTrackState` gains an optional, additive `sessionSwitch?: 'on' | 'off'`, omitted when unset. The published keepalive value gains an optional, additive top-level `sessionMaster?: 'on' | 'off'`, omitted when unset (D11). `line` keeps its meaning and now carries the suffix on off lines and the source note on every keep-warm clause. Each track also publishes `keepWarmFrom?: KeepSource` (D3). The value gains an optional, additive `chain?: { id: string; sessions: string[] }` (D12: the chain id and the chain's session ids, newest first, as LLD 19.1 `chainSessions` returns them; the lens filters by membership, so the order changes no figure), published whatever `handoff.carryOver` says; the lens's Cache Lab reads it (`cache-lab.spec.md`, L7).
- **D13 status-line summary (new, 17.1.35; human 2026-10-25, run.v4.md 2s "Summary + Pane", 2t).** The status line cannot draw a newline: the `\n` join (`hooks/keepalive/keepalive.ts`:268-272) shows as a replacement glyph in the terminal (research 17.1.34). `ui.status` takes one string per plugin, with no surface or title argument (claude-code.d.ts 2.1.310, :2503-2513; its hook event is `{ text }` alone, :7170-7172). No tooltip exists on any surface (17.1.34).
  - **Two texts.** The *full text* is today's: the track lines (1h, then 5m) and the seed line, unchanged, D3 suffix and source note included. It is what `line` publishes, what the band and Pane rows show and what AC-17.6.2 to 6.4, 6.34 and 6.35 assert. The *summary* is one line, built by a pure function from the same track state:

    `keepalive <1h token> | <5m token>[ | <seed token>]`

    | Track state | Token |
    |---|---|
    | running, at least one ping landed | `<ttl> warm <H:MM>, ping <n>/<cap>` (the track's warm-until) |
    | running, no ping landed yet | `<ttl> warm <H:MM>, first ping <H:MM>` (keeps AC-17.4.5's "not yet") |
    | stopped | `<ttl> stopped: <kind>[, warm <H:MM>]`; `<kind>` one of `done` (kept warm, no ping needed, work done), `ping limit`, `spend limit`, `missed`, `error`, `expired`, `handoff`, `overage` (`overage, stopped`: running tracks stopped when the account went into overage); `warm` only where the full line has a warm-until (`done`, `ping limit`, `spend limit`) |
    | off, `disabled` | `<ttl> off` |
    | off, `expired` | `<ttl> expired` |
    | off, `overage` | `<ttl> off (overage)` (never armed: the turn ended in overage) |
    | compacting (`compactOnCap`) | `<ttl> compacting` |
    | compaction result | `<ttl> compacted`, `<ttl> compaction skipped` or `<ttl> compaction refused`; the token counts, the cache read and the reason stay in the full text |
    | off, waiting (allowed, not armed) | `<ttl> idle (<why>)`: `no tasks`, `no write` (noWrite), `no write yet` (noSplit), `turn`, `subagents`, `ended` |
    | seed line shown | `seed hit <k>` / `seed miss` (same `k()` as today) |

  - **Length.** At most **72 characters** (the host's prefix, about 10 more, then fits an 80-column terminal). Over it, drop in this order until it fits: (1) the seed token; (2) the `warm <H:MM>` clause of each track token. The longest result after both drops is under 62 characters, so a third step is never needed.
  - **What the summary drops** (kept in the full text): the cache part (`main …`, `subagents …`), the cap and keep-warm clause on off lines, `keep warm <d>` and its source note, `stop by`, and the long reason wording.
  - **Examples.** The 2t state: `keepalive 1h warm 6:38, ping 1/9 | 5m idle (no write) | seed hit 31k` (68). Both before the first ping: `keepalive 1h warm 13:36, first ping 13:26 | 5m warm 12:41, first ping 12:40` (75) → `keepalive 1h first ping 13:26 | 5m first ping 12:40` (51). Spend limit: `keepalive 1h stopped: spend limit, warm 13:36 | 5m stopped: spend limit, warm 13:36` (83) → `keepalive 1h stopped: spend limit | 5m stopped: spend limit` (59). One track off: `keepalive 1h warm 6:38, ping 3/9 | 5m off`.
  - **Which text the status line gets.** The mod knows the attached surfaces, not the surface a given status string is drawn on: `$.session.surfaces()` lists every surface the session draws on, several at once (d.ts:2862-2875), and `session.attach` / `session.detach` announce changes (d.ts:4523-4541). Rule: the **full text** (joined with `\n`, which VS Code draws as spaces and wraps, 2t "its good") when the roster is non-empty and every entry is `vscode`; the **summary** otherwise (a terminal, Desktop, mobile, a name unknown at compile time, or a mix, since one string serves them all). The roster is read at session start and on each attach and detach, each followed by a render. Unverified: that the VS Code extension's session lists exactly `vscode` (the d.ts says `terminal` is listed "under the REPL"). If it lists `terminal` too, VS Code gets the summary, which is safe; the full text stays in the Pane. A live check confirms it.
  - **Setting `statusText`** (human 2026-10-25, run.v4.md 2v, Q-SL11): key `statusText`, variable `AI_DLC_KEEPALIVE_STATUS_TEXT`, one of `auto`, `summary`, `full` (trimmed, case-insensitive), default `auto`, not trust-gated (display only). `auto` is the rule above; `summary` and `full` force that text on every surface whatever the roster says, and the roster is not read for it. An invalid value is warned about and the next level applies, like every keep-alive setting (`check`, `hooks/keepalive/settings.ts`). It changes the status line only: the band, the Pane, `line` and the hide rule are unchanged. It is in the D12 settings table.
  - **Unchanged.** The hide rule (D3: nothing allowed, no status line, summary included), `status: false`, and clearing the status line during a turn (AC-17.6.8).
  - **Title row (band and Pane).** The mod's own bold `Text` `⚠ ai-dlc cache-keepalive:`, followed by the master Button (D11), replacing the title `keepalive`. The `⚠` is a character the mod writes, not the host's prefix, so the host's `⚠ ai-dlc:` on the status line is unaffected (17.1.34: the host draws it, the mod cannot set it). The Pane's frame title (`ui.open` `title`) becomes `ai-dlc cache-keepalive`. Then the 5m row and the 1h row (Q-SL5), each its full line and its Button, then **a seed row** (Text, no Button) while the seed line shows, so the band and the Pane carry the whole full text.
  - **Published state.** No new field: `line` stays the full line; the summary is display only.
  - **No ADR.** A display rule, cheap to reverse; it fails the *hard to reverse* test.

### Component boundaries

| Part | Owner |
|---|---|
| D3 suffix, both lines; D13 summary tokens, length rule | `hooks/keepalive/cache-state.ts` (pure render) |
| D13 surface rule (roster, attach / detach), stop kind per track | `hooks/keepalive/keepalive.ts` |
| D5 allowed check, D10 switches, D11 master switch, D12 chain keys and `applyHandoffSeed`, command report | `hooks/keepalive/keepalive.ts` |
| D12 settings rows | `hooks/keepalive/settings.ts` (`SETTINGS`, `TRUST_GATED`), the `cache-keepalive-configure` skill's schema |
| D12 chain-id reader | `hooks/auto-handoff/chain.ts` (new, shared); the seed call in `hooks/auto-handoff/register.tsx` |
| D9 band and Pane components, track and master Button presses | a new keep-alive panel component under `hooks/keepalive/`, registered from `hooks/auto-handoff/register.tsx` with keep-alive's other registrations |
| Published `sessionSwitch` | `plugins/claude/ai-dlc/types/index.d.ts` |
| README | documentation-writer |

### Data shapes

No request/response API; the `{ data, error }` envelope does not apply.

- `SessionSwitch = 'on' | 'off'` per track, and one for the master, each absent when unset; stored per chain id in `$.store` (D12).
- `ChainId = string`: `lineage:<sessionId>`.chain, else the session id (D12).
- `KeepSource = 'session' | 'machine' | 'settings' | 'default'`, the source note's label (D3).
- `TitleRow = { text: '⚠ ai-dlc cache-keepalive:'; button: 'on' | 'off' }`, `button` from the effective master (master on → `off`) (D13).
- `StopKind = 'done' | 'ping limit' | 'spend limit' | 'missed' | 'error' | 'expired' | 'handoff' | 'overage'`, recorded when a track stops, for the summary token (D13).
- `StatusMode = 'full' | 'summary'`, from the surface roster (D13).
- `TrackRow = { track: '5m' | '1h'; line: string; button: 'on' | 'off' }`, `button` from the D5 *allowed* check, never from `running` (allowed → `off`, not allowed → `on`; Q-SL8).

### Test seams

- Pure seam (`cache-state.ts` table): E1' to E5', E8, E9, and the overage suffix.
- Keep-alive tests (mock clock): AC-17.6.1 to 6.5, 6.12 to 6.21 and the master-button ACs (the D5 allowed table: each of the three rules, with master on, off by settings and off by press; master `[off]` stopping both running tracks; a track `[on]` arming with the master off), driving presses through the panel component's press handler, and asserting no settings-file write (a spy on the file writer, plus unchanged fixture files).
- Panel render test (the auto-handoff band tests are prior art): AC-17.6.6, 6.8, 6.9, 6.10, rows and labels, the master Button in the title row and its label. The label table (Q-SL8): allowed and running → `[off]`; allowed and not yet armed → `[off]`; not allowed → `[on]`; for each of D5's three rules.
- D3 additions: the pure table gains the source note (one row per label, running and off lines; `sourceNote: false` writes none) and the hide rule (neither track allowed: no status line, the seed line hidden, the band rows still drawn; after one track `[on]`: both lines back).
- D12, keep-alive tests with a stubbed lineage record (the auto-handoff tests are prior art): the switches, the master and a `--session` override continue into the seeded session; a hand-started session starts clean; `handoff.carryOver: false` starts the seeded session clean; `handoff.onWhenOff` on and off with the master off at the handoff (on: master and both track switches `on`, a settings `fiveMinute.enabled: false` overridden, no ping at the seed; also with `carryOver: false`); a failed lineage read gives a clean session; the trust gate skips `handoff.onWhenOff` in an untrusted folder; the published `chain`. The prefix rule: spies show that the handoff writes no settings or context file and changes no model or effort, and the seed turn's existing cache line reads `keepalive seed: cache hit`.
- D13: the pure table gains one summary row per token state, the length drops (each step, and the 68-character 2t example kept whole); keep-alive tests with stubbed `surfaces` give `['vscode']` the full text, and `['terminal']`, `['desktop']`, `['terminal','vscode']`, `[]` and an unknown name the summary, and an attach or detach re-renders; `statusText: summary` gives `['vscode']` the summary and `full` gives `['terminal']` the full text, an invalid value falls back to the next level; the panel render test asserts the title row text and the seed row.
- Manual: AC-17.6.7, 6.11, 6.22; D13 live check of `statusText: auto`: the terminal status line shows the summary with no replacement glyph, and a VS Code-only session shows the full text.
- Pinned tests that change: every rev 3 test asserting an off line, including the E1 to E5 rows of the pure table.

### Out of scope

As `stories.delta-r4.md`: writing settings from a press, a lasting switch, arming with no background tasks, a pinned VS Code surface, the lens drawing the switch.

### Open questions

Q-SL1 to Q-SL6 of `stories.delta-r4.md`. Q-SL1 is accepted (2026-10-25). Q-SL4 is withdrawn: the human replaced it with the master button (D11).

- **Q-SL7 (closed, human 2026-10-25).** A master `[on]` forces both tracks on: it sets both track switches `on` for the session (D11).
- **Q-SL8 (closed, human 2026-10-25).** A track Button follows *allowed* (enabled), not *running*: `[off]` whenever the track may arm, `[on]` only when it may not (D10 *Label*, `TrackRow`).
- **Q-SL9 (closed, human 2026-10-25, 17.1.31.l1.1).** When `handoff.onWhenOff` turns keep-alive on in a seeded session, it acts as a master `[on]` press: the master and both track switches `on`, overriding a settings `<track>.enabled: false`, once per handoff (D12).
- **Q-SL10 (closed, human 2026-10-25, 17.1.31.l1.1).** With `handoff.carryOver: false`, `handoff.onWhenOff` still applies: the seeded session starts clean from the settings, and if their `enabled` is off, it acts as the master `[on]` press (AC-17.7.6). A master `[off]` pressed in S1 is not carried, so it does not trigger the exception (D12, rev 4.6).

- **Q-SL11 (decided, human 2026-10-25, run.v4.md 2v: yes; setting `statusText` in D13 and the D12 settings table).** The rule gives VS Code the full text only if a VS Code session lists exactly `vscode` in `$.session.surfaces()`, which no record verifies. If the live check finds it does not, VS Code gets the summary too (full text in the Pane). Should keep-alive also have an explicit setting, `statusText: auto | summary | full` (default `auto`, the rule above; not trust-gated), so the human can choose either way whatever the detection finds? Recommended: yes, it covers both outcomes and follows the human's preference for explicit switches over detection.

The architect decided at 17.1.16 that the session switch needs **no ADR**, and at 17.1.23 that the master switch needs none either, for the same reasons. It is scoped to one session and cheap to reverse, and it follows the existing `--session` override precedent, so it fails the *hard to reverse* test. The source note and the hide rule need none either: they are display rules only.

D12 **has an ADR, ADR-0007** (17.1.31). "One combined session" changes what *session* means for every per-session state of both plugins, and the prefix rule binds every future module in the chain. Without context that is surprising, and it is a real trade-off: nothing can be injected into a seeded session's context. The two settings themselves are reversible.

## Part B: Cache Lab (moved)

Moved on 2026-10-25 (software-architect, 17.1.16) to its own spec, `docs/specs/cache-lab.spec.md` (root 22; ADR-0006). This delta now covers only Part A.

## Review status

Written in synthesis mode from decisions the human and po already made.

**software-architect review (17.1.16): Part A accepted, with three amendments:**
- D5: the switch overrides the per-track `enabled`, never the master `enabled`.
- D9: the surface signal exists.
- D10: the switch is kept in `$.store` per session, like `--session`.

- D5 and D10 re-revised at 17.1.23 to the human's master-button decision (D11); D10 storage unchanged.
- D10 and `TrackRow` revised at 17.1.26 to the human's label rule (Q-SL8): a track Button follows *allowed*, not *running*. The analyst reworded the track-button ACs in stories rev 4.2 (AC-17.6.12, 6.15, 6.16, 6.22, 6.26, 6.28, 6.31) and added AC-17.6.32; the AC map above covers AC-17.6.1 to 6.32.
- 17.1.31, the gate-critique fix round for 17.1.l2.1: D3 gains the source note (Major 3) and the hide rule (Major 2). D12 is added (Minor 9 and the human's 2n.3). The AC map gains AC-17.6.32 (Minor 5). Their ACs are AC-17.6.33, 6.34, the reworded 6.3, 6.4 and 6.21, and US-17.7 (AC-17.7.1 to 7.10), in stories rev 4.3 (requirement-analyst, 17.1.30), and the LLD follows (system-engineer, keep-alive LLD rev 10, section 19).

- 17.1.35, the human's 2s and 2t: D13 added (status-line summary, surface rule, title row `⚠ ai-dlc cache-keepalive:`, seed row in band and Pane); D9's status-line bullet replaced; Q-SL11 opened. The ACs follow in stories rev 4.4 (requirement-analyst, 17.1.36) and the LLD in rev 11 (system-engineer, 17.1.37).
- 17.1.35.l1.1, the human's 2v: Q-SL11 decided yes; setting `statusText` (`AI_DLC_KEEPALIVE_STATUS_TEXT`, default `auto`) added to D13, the D12 settings table, the AC map and the test seams.
- 17.1.35.l1.2, system-engineer's gap (17.1.37, LLD rev 11): `overage, stopped` takes the stopped token `<ttl> stopped: overage` (`StopKind` gains `overage`), not the proposed `<ttl> off (overage)`, so the summary keeps the full text's split between stopped while running and never armed; compaction takes `<ttl> compacting`, as proposed, then `<ttl> compacted`, `<ttl> compaction skipped` or `<ttl> compaction refused`. Each fits the length rule.

- 17.1.40 (rev 4.6), gate critique 17.1.l2.2: Minor 1 (the D12 settings table joined), Minor 2 (the D13 AC-map row cites AC-17.6.37 to 6.41 and AC-17.4.4 to 4.6), Blocker 1 (D12 and Q-SL10: with `carryOver: false` the master in force is the settings `enabled`; a master `[off]` pressed in S1 does not trigger the exception, matching AC-17.7.6, requirement-analyst 17.1.39), 034.c (D2 / D2a amended, AC-map row added, agreed with system-engineer 17.1.41), `chainIdOf` (Major 4, LLD 19.1).
- 17.1.50 (rev 4.7), gate critique 17.1.l2.4: Minor 3 (E2'/E3' firm since 034.c), Minor 4 (the AC-17.3.7 row's "conditional on 034.c" marked historical).

Part B moved to `cache-lab.spec.md`. Gate critique round 3 (17.1.l2.3), product-owner acceptance and the combined G1+G2+G3 stop are pending.
