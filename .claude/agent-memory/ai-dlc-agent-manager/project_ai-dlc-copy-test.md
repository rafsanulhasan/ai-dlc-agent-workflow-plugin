---
name: ai-dlc-copy-test
description: tests/workflow/handoff-naming.test.mjs compares the repo's own .ai-dlc/ copies with the workflow skill templates, so .ai-dlc/ must be resynced after a template change
metadata:
  type: project
---

`tests/workflow/handoff-naming.test.mjs` ("`.ai-dlc` copies equal the templates") asserts that the repo-root `.ai-dlc/workflow.json` and `workflow.schema.json` equal the files in `plugins/claude/ai-dlc/skills/workflow/templates/`.

**Why:** the repository runs the workflow it ships, and the test keeps the two from drifting.

**How to apply:** after changing either template, resync `.ai-dlc/` in the same change, or, when the brief puts `.ai-dlc/` out of scope, report this test as the one expected failure and name the resync as follow-up work. Related: [[workflow-roster-sync]].
