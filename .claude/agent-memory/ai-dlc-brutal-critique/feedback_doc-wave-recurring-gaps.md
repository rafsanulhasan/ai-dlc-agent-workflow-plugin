---
name: doc-wave-recurring-gaps
description: Recurring weaknesses in this team's multi-document docs waves (READMEs + lifecycle artifacts) found at step 44 critique
metadata:
  type: feedback
---

Check these first in any docs-wave critique of this repo:

1. **Partial status markers.** documentation-writer marks the main paragraph of a change *in progress* but leaves the same behaviour unmarked elsewhere in the README (command table rows, settings rows, later sections). Grep every requirement id / behaviour phrase across the whole README, not just the marked paragraph.
2. **Stale front-matter status lines.** Lifecycle artifacts (stories, LLD, ADR status, backlog rows) keep "tests pending" / "live check passed" after the run state moved on. Compare each against the run state facts in the brief.
3. **Superseded text left normative.** A new AC says "X now reads Y", but settings tables, Out of scope lists, traceability rows and old "Docs update" sections in the same file still state X. Grep the old phrase across the file.
4. **AC-to-file attribution.** Spec AC-map rows cite the wrong stories file for ACs that live in an earlier delta. Grep each cited AC id.
5. **Stale headings kept for anchors** ("No band in VS Code" after a band was added). Keeping an anchor is fine; a false heading is not.

**Why:** found together in the step 44 round-1 critique (2026-10-31); each came from applying owners' OLD/NEW blocks literally without sweeping the rest of the file.
**How to apply:** for every docs wave, run these five sweeps before reading for prose quality.
