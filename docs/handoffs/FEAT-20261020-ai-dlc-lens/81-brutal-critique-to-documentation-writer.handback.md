handoff 81-documentation-writer-to-brutal-critique.handoff.md: passed — file exists, names target block and sources.

# Critique: CHANGELOG.md, v1.0.0-preview1, "herdr panes" block (lines 40-46)

Verdict: PASS (no Blockers; two Majors to fix before this becomes the prerelease body)

## Blockers
None. Every herdr claim traces to plugins/claude/ai-dlc/skills/herdr/SKILL.md: label `<agent> <step>`, modes watch/run-in-pane/off, team stages always watch, runTimeoutMinutes default 60 max 720, the two AI_DLC_HERDR_* variables, show/set/merge/validate, pane placement and fallback, permission denial, permissions.allow not verified, Claude-only (tools/claude-only-skills.json:6). No status marker, correct (run state status: done).

## Major
1. CHANGELOG.md:40-46, traceability. Every neighbouring bullet cites its ITEM; docs/backlog/backlog.md:238 has ITEM-108 for this skill. The herdr block cites none. Fix: add "(ITEM-108)" to the heading line or bullet 1; the pane-layout follow-up has no ITEM (backlog.md:401), so cite its run step AAWP-20261112-herdr-skill 1.2.l3.
2. CHANGELOG.md:5 and 82-87, consistency with the re-tag. Pane layout (d646698) ships only in the re-tagged build (07e2c7f). The heading date is still 2026-11-13 and Checks counts (1007, 926, 1270) are stated as recorded before the release; d646698 changed code after that. Fix: have devops-engineer/orchestrator confirm whether date and counts still hold, then update them or add one line that the counts predate d646698. Do not change Checks text without evidence.

## Minor
1. Line 42: "the pane closes when the agent hands back" is true only for subagents; a teammate's pane closes at shutdown (SKILL.md:14). Add "(a teammate's, when it is shut down)" or drop the clause.
2. Line 44: "the old one-column rule" means nothing to a reader. Say "the previous rule, a single column down from the run's newest pane" (SKILL.md:103).
3. Line 46: known limits sit in What ships, not Known open; the brief allowed it. Keep, but do not expect the permissions.allow item in Known open.

## Unverified claims
- Re-tag date and whether Checks counts include d646698: I cannot run commands, and 80-devops-engineer-to-orchestrator.handback.md gives no counts.
- "Shipped in v1.0.0-preview1" commit hashes come from the orchestrator's brief; not checked against git.

## What is good (keep it)
- Matches neighbouring format; states Claude-only, never-installs and never-blocks plainly.
- The narrow-session-pane limit is stated honestly.
