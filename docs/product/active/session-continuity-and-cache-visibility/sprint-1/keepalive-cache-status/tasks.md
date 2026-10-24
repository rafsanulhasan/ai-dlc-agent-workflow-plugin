---
kind: tasks
epic: session-continuity-and-cache-visibility
sprint: sprint-1
folder: keepalive-cache-status
root: 17
module: ai-dlc
submodule: cache-keepalive
integrations: [integration-1]
source: docs/handoffs/FEAT-20261020-ai-dlc-lens/14.1.12-research-assistant-to-orchestrator.handback.md; 14.1.17 (1h counter cause, pending); plan 00c root 17 plus addendum 2026-10-24
stories: stories.md (requirement-analyst)
---

# Root 17: keep-alive status line shows the real cache state (bug)

Plan ACs, in the plan's order: AC1 each track shows whether writes of its own TTL exist (main and subagents, labelled) and until when; AC2 a reason replaces a bare `off`; AC3 the 5m track arms from subagents' 5m writes as well as the main loop's; AC4 splits tracked per TTL, not one last write; AC5 regression test "5m cache exists, line not off"; AC6 the user explanation (read 0.1x, write 1.25x for 5m and 2x for 1h, a hit refreshes the 5m TTL, what resets the cache); AC7 lens cost fixes go to root 22. Addendum AC-A: the 1h ping counter advances with each ping (not stuck at 0/9).

## ITEM-032 (17.1): per-TTL state, main loop (prefactor)
- Tags: ai-dlc / cache-keepalive / statusline; integrations integration-1. Type Bug. P1. Triage: ready-for-agent. Blocked by G3. Group KA.
- Goal: replace the sticky last-write-wins split (`keepalive.ts:84-97`) with one state per TTL (5m, 1h), each holding last write time, source label and expiry; fed from the main-loop usage (`auto-handoff/register.tsx:881`).
- Covers: AC4, the main-loop half of AC1. Demonstrable by a unit test that two writes of different TTLs keep two states.

## ITEM-033 (17.2): status line renders per-track state with a reason
- Tags as 032. Type Bug. P1. Triage: ready-for-agent. Blocked by 032. Group KA.
- Goal: `keepalive.ts:690` and the default render path (`:52,635,658-661`) print, per track, armed / expires at / reason (for example "no 5m writes in the last 5m"), never a bare `off`.
- Steps: write the regression test "5m cache exists, line not off" first (red), then fix.
- Covers: AC1 (display), AC2, AC5.

## ITEM-034 (17.3): subagent writes and pings
- Tags as 032. Type Feature. P1. Triage: needs-info. Blocked by 032. Group KA.
- Goal: subagent cache writes, labelled, feed the per-TTL state; the 5m track arms from them; keep-alive pings subagent cache too.
- Covers: AC3, the subagent half of AC1.
- Triage notes. Established so far: `register.tsx:881` feeds the split from the main loop only; the human wants subagents pinged. Still needed (from software-architect at G2, with research-assistant if the engine types do not answer): can a hook observe subagent usage and can a ping target a subagent's cache; the brief lists the engine types as unverified (brief risk 14.1.12 section 6). If not observable, any fallback (for example a labelled "subagent: not observable" state) is a human decision: the product-owner did not accept it, and it goes to the human as G1 question Q34, default "No. The AC stands; if the G2 spike proves it impossible, this comes back to the human". The human decided subagent cache is pinged too.

## ITEM-035 (17.4): 1h ping counter advances
- Tags as 032. Type Bug. P1. Triage: needs-info. Blocked by 14.1.17 (root cause). Group KA.
- Goal: the counter advances by one per ping; reported by the human on 2026-10-24 as always `0/9`.
- Covers: AC-A. Test: after N pings the counter shows N / max.
- Triage notes. Established so far: report only; the 1h track is not armed by a stale split (14.1.12 candidate). Still needed (from research-assistant, 14.1.17): the root cause. When it lands, fold the item into 032 if the cause is the shared per-TTL state, otherwise keep it separate.

## ITEM-036 (17.5): user explanation of cache semantics
- Tags as 032. Type Feature (docs). P2. Triage: ready-for-agent. Blocked by 033, 034. Owner: documentation-writer, critiqued by brutal-critique. The implementer puts a Docs update request in its hand-back; nobody else edits docs.
- Content (AC6): read cost 0.1x (0.05x Opus/Sonnet 5.5, 0.025x Fable/Mythos 5.1), write 1.25x for 5m and 2x for 1h, a hit refreshes the 5m TTL, what resets the cache (TTL expiry, change to tools/system/messages, `/clear`, compaction, model change). The 1h refresh rule and `subagentPromptCacheTtl` stay marked undocumented until confirmed against Anthropic's docs (brief risk).
- Status marker: planned until the building stage of 032-035 starts, then in progress, per `docs-status`.
