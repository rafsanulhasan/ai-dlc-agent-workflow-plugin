---
name: handoff-naming
description: Handoff/handback naming scheme and writer-by-orchestration-mode rule, decided 2026-10-21 (user-approved)
metadata:
  type: project
---

Decided 2026-10-21, approved by the user (runs AAW-20261021-handoff-naming and -self): every hand-off in every lifecycle, AAW included, writes a handoff record and stores a hand-back.

- Folder `docs/handoffs/{LIFECYCLE}-{YYYYMMDD}-{feature-slug}/` (LIFECYCLE = a key of the workflow file's `lifecycles`, the one list); work-item id goes in `work-item:` front matter.
- Files `{step}[.{sub}][.l{loop}]-{from}-to-{to}.handoff.md` / `.handback.md`; agent IDs only; `.sub` = parallel or nested spawns; `.l{n}` = loop round keeping the step code.
- Writer by mode: subagent mode (default, only mode on Copilot) — the orchestrator writes both; Claude Code agent team (request-routing Mode 5) — sender writes the handoff, receiver the hand-back; run.md is the orchestrator's alone. The receiver verifies, never the writer.

**Why:** before this, only hand-backs got written because the writer of the stage handoff was undefined and contradictory.

**How to apply:** the `handoff` skill is the source; new agents or skills that mention records must point to its *Naming* and *Who writes what* sections, not restate them. Open follow-ups: [[handoff-gaps]].
