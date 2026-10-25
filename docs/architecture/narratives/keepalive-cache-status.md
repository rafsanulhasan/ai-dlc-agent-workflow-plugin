---
feature: keepalive-cache-status
root: 17
audience: product owner, plugin maintainer
author: software-architect
date: 2026-10-24
spec: docs/specs/keepalive-cache-status.spec.md
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
