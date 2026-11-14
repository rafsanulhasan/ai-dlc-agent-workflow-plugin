---
name: standards-generator
description: plan/preview2 — repo rules are generated from .forgeline/memory-bank/project/standards by tools/build-standards.mjs; never hand-edit the twins
metadata:
  type: project
---

On `plan/preview2` (feature 8, 2026-11-14) this repo's `.claude/rules/*.md` and `.github/instructions/*.instructions.md` are generated from `.forgeline/memory-bank/project/standards/<n>.md` by `tools/build-standards.mjs` (Stop chain step 0, CI `--check`). The marker is a YAML comment as the first front-matter line with a sha256 of the twin; hand-edited twins are refused, orphans reported, never deleted. `docs-status` carries `template:` and must equal the docs-rules templates minus the marker.

**Why:** D54/D56/D57 — one standards home; pointer stubs do not load on Copilot (8.1.5); standards are agent artifacts owned by agent-manager.
**How to apply:** change a rule by editing its standard, then `node tools/build-standards.mjs`; change docs-status template and standard together. Windows: `git mv` of a whole folder can fail with "Permission denied" (a directory handle); move file by file instead. Related: [[ai-dlc-copy-test]].
