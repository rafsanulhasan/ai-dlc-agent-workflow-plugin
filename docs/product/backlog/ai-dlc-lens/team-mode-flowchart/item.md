---
kind: backlog-item
epic: ai-dlc-lens
folder: team-mode-flowchart
root: 33
backlog-item: ITEM-067
module: ai-dlc-lens
submodule: agent-workflows
feature: team-mode-flowchart
integrations: [integration-2]
priority: P2
status: Backlog
milestone: Unplanned
triage: needs-info (research answered; five human questions open, asked at G1 when tier 3 enters a sprint)
tier: 3 (not tier 1)
blocked-by: 19 (ITEM-049), 18 (ITEM-041), 24 (ITEM-060), spike 33.0 (ITEM-067.a), human answers Q33a-e
source: human enhancement 2026-10-24, relayed by the orchestrator
---

# Root 33: team-mode-flowchart

Human request: when the team works as an agent team, teammates message each other, so the lens flowchart shows that too, with the handoff and hand-back among them.

Meaning: in team mode the flowchart draws edges between teammates (for example sa to se, se to bc, ra to po), for both the SendMessage messages and the handoff / hand-back records they write to each other. Today the lens draws edges only from record names (`lens.ts` parseRecordName, stepCharts) and from the orchestrator's spawns.

## Placement
- Tier 3, P2, merges in the lens group after root 24 (order 20, 22, 24, 33, 25, 26, 27; the product-owner confirms).
- Not tier 1: it needs root 19's per-mode record rules (ITEM-049: in team mode the sender writes both records, so a teammate-to-teammate edge is derivable from record names), root 18's session column (ITEM-041) and root 24's chart-per-step structure to draw into.
- Taxonomy: submodule id `agent-workflows` is a proposal until root 18 (ITEM-044) declares it.

## Research result (33.1.2 hand-back, confidence Medium)
- R1 answered, conditional: a `session.send` hook sees model SendMessage calls with sender `agentId` and `to`; untested live; pane-hosted teammates are invisible. Needs the live spike below.
- R2 answered: record names already give from and to, but `stepTrees` and `drawChart` draw only parent to child, so no teammate edges are drawn today.
- R3 answered: an edge key needs a name, agent id and type-id join.
- R4 answered: the tree layout cannot place cross-edges; it needs a separate edge style, count badges and a toggle.

## Tasks
- 067.a (spike, P2, ready-for-agent, build-time): live-test `session.send` for in-process teammate-to-teammate SendMessage and the `tool.call` payload (sender, `to`, text). Result: a written ruling on R1 and, if it fails, the record-edges-only fallback (AC-5).
- 067 (feature, P2, blocked by 067.a, 049, 041, 060, Q33a-e): draw record edges (AC-1), message edges (AC-2), distinct and toggleable styles (AC-3), name-to-type mapping (AC-4), fallback notice (AC-5), `team` node (AC-6). Final AC ids come with the stories.

## Draft ACs (from the research)
AC-1 record edges between team members; AC-2 message edges from `session.send`, one per ordered pair with a count; AC-3 distinct, individually toggleable; AC-4 runtime names map to agent types; AC-5 no `session.send` data means record edges only, and the chart says so; AC-6 `team` drawn as a group or expanded to its members.

## Human questions for G1 (tier 3 entry), defaults in brackets
- Q33a: counts per pair, or message order and text too? [counts only]
- Q33b: is storing message text acceptable? [no]
- Q33c: are pane-hosted teammates in scope? [no, fall back with a notice]
- Q33d: expand `team` to its members, or show one group node? [expand to listed members]
- Q33e: run the live `session.send` spike? [yes, 067.a]
