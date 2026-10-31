---
feature: keepalive-cache-status
root: 17
audience: product owner, plugin maintainer
author: software-architect
date: 2026-10-24 (step 44 section added 2026-10-31, and widened the same day for R44.11 to R44.20)
spec: docs/specs/keepalive-cache-status.spec.md; docs/specs/keepalive-cache-status.spec.r4-delta.md (rev 4.9)
adrs: [ADR-0007, ADR-0008]
---

# Narrative: a status line that tells the truth about the cache

## Act 1: the problem

Keep-alive keeps the prompt cache warm while background work runs, so that the next turn reads the cache instead of paying to write it again. Its status line is the only place the user sees cache state, and today that line misleads in three ways:

- The 5m line shows a bare `off` under an armed 1h line, even when a 5m cache is warm. A Stop without background tasks shows no line at all (14.1.12).
- Caches written by subagents are invisible: their writes are filtered out before keep-alive sees them.
- The 1h line shows `ping 0/9` for its whole first 50 minutes, which reads as stuck (14.1.17).

So users cannot tell "there is nothing to keep warm" from "keep-alive is broken".

## Act 2: constraints and choices

- **C1, human.** Show the real state per TTL, for the main loop and for subagents, labelled (00c, root 17).
- **C2, human, Q34.** Observe subagent caches now. A subagent may be pinged only by an opt-in setting, off by default, and only if a build-time spike proves the ping cheap and safe.
- **C3, spike 17.1.1.** Subagent usage can be observed from `turn.step` (`agentId`). Whether it carries the 5m/1h split is unknown and needs a build-time check. A subagent's prefix cannot be pinged by forking. The only route is a message to the agent, which wakes it for a real turn.
- **C4, spike 17.1.2.** A hit refreshes the 5m lifetime. Whether a hit refreshes the 1h lifetime is undocumented.
- **C5.** The lens reads keep-alive's published state. Any change to that state must be additive.
- **C6.** The spend ceiling the user set must hold (Q17-3a).

Alternatives:

- **(a) Keep one "last write" value and add subagents to it.** Rejected: a 1h write still hides a 5m cache, against C1.
- **(b) A ledger per source and per TTL.** Chosen.
- **(c) Ping subagents by forking.** Impossible, by C3.
- **(d) Always ping subagents by message.** Rejected: C2 makes it opt-in and gates it behind a spike.

Trade-off: with the setting off, a subagent's cache can be shown going cold that keep-alive does not keep warm. The human accepted this (Q34).

## Act 3: the design

- **D1, D3, D4 (C1).** A cache ledger records, per source and TTL, when the cache was written and until when it is warm. Each track's line is built from the ledger: `main …` first, then `subagents …`. Every `off` carries a reason.
- **D1 (C4).** A hit moves the 5m time when it can only be a 5m read, or when it is a landed 5m ping. Only a write moves the 1h time.
- **D2, D2a (C3).** Every response's usage, with its `agentId`, reaches the ledger, and the subagent's stop transcript is a fallback. A check (ITEM-034.c) confirms the split first. Without the split, the line says `split unknown`.
- **D5 (C1, C6).** A track pings only what it can keep warm. While subagent pings are off, a cache held only by subagents arms nothing.
- **D6.** Before the first ping, the line shows when that ping is due.
- **D7 (C2, C3, C6).** Spike ITEM-034.a, then, only if it passes, the opt-in setting ITEM-034.b. The ping cap counts by round, and the spend counts per ping.
- **D8 (C5).** The published state gains an optional `caches` list. Nothing that the lens reads today is removed.

ADRs: none now. One is due if ITEM-034.b ships, because pinging subagents is then a user-facing spend commitment.

Risks:

- **The host may not repaint the status line between events** (AC-17.4.4, a live check). If it does not, `po`'s Q17-4 applies: a README limitation and a backlog item.
- **E7 depends on what a ping's usage carries** (spec OQ2). It holds only if a 1h ping carries a 1h write.
- **ITEM-034.a may fail.** Then the subagent-ping ACs go back to the human.

## Later: where keep-alive's state is shown (revision 4 and step 44, 2026-10-31)

The design above put the truth in the status line. Revision 4 added Buttons, which a status line cannot hold, so the state moved into a band above the prompt (terminal, Desktop) and a Pane (VS Code), with a one-line summary left in the status line. Step 44 settles where it lives.

### The problem

In a narrow VS Code panel the human saw the status line repeat the band, Buttons that named the state they were in instead of the action they take, and keep-alive's tab leaving the area above the prompt, with the lens's, when the panel was widened. After those were fixed, the human asked three things of the lens: bring its Run List tab when it docks, in Tab mode only; show docked or pinned as it really sits; and let its mode button move it between the right pane and the band above the prompt. Building that brought a host error on resize and a missing step chart. Last, the human asked for the flowchart in the right panel only, in both panel types, never in the band above the prompt.

### Constraints

- **C7, host (research 44.2.l1.2, F1 and F2).** Every pane of every module is a tab of one region, and the surface seats that region. VS Code puts it inline above the prompt when narrow and docks it on the right when wide (about 70 columns, probe 2ff). A module cannot choose the seat.
- **C8, host (probe 2ff).** The band above the prompt (`AbovePrompt`) is drawn in VS Code too, although the types say terminal and Desktop only.
- **C9, human (R44.7, R44.9, R44.10).** Keep-alive stays above the prompt at every width; only the lens moves with the width.
- **C10, human (R44.1 to R44.3, R44.6).** One view without repetition; a Button offers the action, not the state; the title row says on or off as the tracks do.
- **C11, human (R44.11, R44.13).** A setting that no longer does anything is retired, not kept inert, and an old settings file must not break. The automatic-handoff exception reads keep-alive the way its head row does.
- **C12, human (R44.12, R44.14 to R44.16).** In Tab mode the lens brings its Run List tab when it docks, as the wide `/ai-dlc:lens` does; in Drill in mode it does not. Its mode word follows the seat, and its mode button moves it between the right pane (docked) and the band above the prompt (pinned).
- **C13, host (d.ts :3494; R44.17).** No state write while any render is being dispatched, and a timer does not make sure the write lands outside one.
- **C14, human (R44.19, R44.20).** On widening, the lens shows the workflow view with its flowchart in the right panel in both panel types. In VS Code the flowchart is never shown above the prompt. The terminal and Desktop are unchanged.
- **C15, host (44.2.l1.7).** A plugin cannot widen the Claude panel in VS Code: no host operation sizes it (d.ts 2382-2640, 7646-7657).

Alternatives: keep-alive as a tab beside the lens (rejected, it docks with the lens, C9); its rows only inside the lens (rejected, nothing to see while the lens is closed); the lens moving its own panes (impossible, C7). For the mode button: working only in a wide panel, or changing only its label (the human chose option (a) instead, C12). For C13: a bare 0 ms timer (rejected: it fired inside a later render). For C14: widening the panel from the plugin (impossible, C15); blocking only full screen above the prompt (the human kept no flowchart there at all); the same rule on the terminal (not chosen: it has no other windows).

### The design

- **Keep-alive is its own band, everywhere (C7 to C9; ADR-0008).** It draws no Pane and writes no status line, so a resize never moves it.
- **The lens stays in the pane region (C7, C9, C12, C14).** It follows the seat the surface gives it: above the prompt when narrow, in the right pane when wide. Its mode word follows too: docked in the right pane, pinned above the prompt. It closes its wide-only Run List tab when it comes back inline. When it docks, in either panel type, it shows the workflow tab on the current step with its flowchart; in Tab mode it also opens the Run List tab without focus. It draws no band of its own in VS Code unless the person presses pinned: then the pane closes and the lens is drawn in the band above the prompt, and pressing docked brings the pane back (ADR-0008, R44.16).
- **Rows say the state, Buttons the action (C10).** A track reads `on, …` or `off (disabled)` with the opposite Button; the title row reads `on` when either track is on, else `off`, with the opposite Button for the master and both tracks. While both tracks are off, the seed row is hidden.
- `statusText` is retired (C11). It is gone from the settings, the schema and the configure CLI. An old file or variable that still sets it gets a "no longer used" warning, `validate` still passes, and `merge` removes it.
- The handoff exception reads the tracks (C11). A seeded session is turned on only when neither track is on in force, so a chain with a track still on is left as it is.
- Writes after a render are retried (C13; ADR-0008). The lens makes every write a render asks for after the render, and tries it again, up to 20 times 100 ms apart, when the host refuses it as made during one. That removed the resize error and brought the step chart back: it had gone missing because the refused write stopped the docking layout (R44.17, R44.18).
- **Flowcharts only in the right pane, in VS Code (C14, C15; ADR-0008).** Above the prompt an open step says "Widen the Claude panel to see the flowchart in the right panel." instead of drawing the chart, and its full-screen control is dim while the panel is narrow. On the band of a wide panel, that control opens the right pane on the step. The terminal and Desktop draw flowcharts as before.

Risks:

- C8 is observed on Claude Code 2.1.310 and contradicts the types. If a later version stops drawing the band in VS Code, keep-alive has no view there; the live check after a host update covers it.
- In Tab mode the lens opens its Run List tab on widening, but the person did not ask for that open, so the host may keep it undrawn below 144 columns (110 once the person has opened it and not closed it by hand; d.ts :15066-15074) until the panel widens or the person opens it. The human accepted this (R44.12).
- The lens's band in VS Code is an exception to R44.4. If the pinned choice and a drawn pane ever overlapped, both lens views would show, which is the original R44.4 bug; the lens clears the choice whenever a lens pane is drawn.
- The retry hides a render-time refusal for about 2 seconds. A write refused 20 times in a row shows as a lens error, so the problem stays visible.
- In a narrow VS Code panel the person sees no flowchart until they widen the Claude panel by hand, because the plugin cannot widen it (C15). The dim control is plain text, since the host's Button cannot be disabled.
