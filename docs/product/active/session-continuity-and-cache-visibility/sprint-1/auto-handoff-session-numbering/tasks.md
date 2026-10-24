---
kind: tasks
epic: session-continuity-and-cache-visibility
sprint: sprint-1
folder: auto-handoff-session-numbering
root: 16
module: ai-dlc
submodule: auto-handoff
integrations: []
source: docs/handoffs/FEAT-20261020-ai-dlc-lens/14.1.11-research-assistant-to-orchestrator.handback.md; plan 00c *Tier 1 requirements*, root 16
stories: stories.md (requirement-analyst)
---

# Root 16: auto-handoff session N (bug)

Plan ACs, in the plan's order: AC1 main session gives Session 1 then Session 2; AC2 title `(Session N)` gives N + 1 and the old session is never renumbered; AC3 a lineage without depth or a store error still gives N + 1 from the title; AC4 a prefixed title without a number never nests the prefix; AC5 the number never decreases or repeats in a chain; AC6 tests `auto-handoff.test.tsx:693-705,1766-1774` change and a case per branch is added; AC7 `ATTRIBUTION.md:144-155` and `auto-handoff.schema.json:65` (template and `.ai-dlc` copy) updated.

## ITEM-030 (16.1): numbering fix, tests first
- Tags: module ai-dlc, submodule auto-handoff, feature handing-off, integrations none. Type Bug. P1. Triage: ready-for-agent. Blocked by G3. Group KA.
- Goal: the title number wins; lineage depth only when the title has no number.
- Steps (vertical): write the failing tests for each branch (main to 2, Session 2 to 3, lineage without depth, store error, prefixed title without number, monotonic number), watch them fail, then change the numbering in `hooks/auto-handoff/register.tsx` (around 429, 996-1005) and `config.ts` (around 412-423) until green; replace the two tests that pin the old behaviour.
- Covers: AC1-AC6.
- Brief notes: Q16 default stands (prefixed title with no number gives N = 1, original base name carried). Engine facts on resume id and store durability are unverified (brief risk): do not assume them; the tests use the module's own fakes.
- Checks the implementer quotes: `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc` and `node --test "tests/**/*.test.mjs"`.

## ITEM-031 (16.2): attribution and schema text
- Tags as 030. Type Bug. P1. Triage: ready-for-agent. Blocked by 030. Group KA.
- Goal: the recorded behaviour matches the code.
- Covers: AC7. Files: `hooks/auto-handoff/ATTRIBUTION.md` (lines 144-155), `auto-handoff.schema.json` description at line 65 in the skill template and the `.ai-dlc` copy (they must stay identical; `tests/auto-handoff/` checks agreement).
- A README sentence about numbering, if one exists, is a Docs update request to documentation-writer, not an edit by the implementer.
