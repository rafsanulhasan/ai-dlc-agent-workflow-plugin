---
name: document-everything-explicitly
description: Every decision, rule and assumption must be written down explicitly in the docs; never accept "not listed because it doesn't apply" or "rests on an unverified reading" silently
metadata:
  type: feedback
---

Everything must be documented explicitly so nobody ever has to assume anything. A doc open question like "X is not listed because it doesn't change Y", "this rests on a reading of the host API I didn't verify", or "revision line not bumped, decide later" is never accepted as is: the doc must say it in words (X does not change Y; this is assumed from <source>, unverified until <check>; revision bumped now).

**Why:** the human (2026-11-01, step 44 of FEAT-20261020-ai-dlc-lens) rejected my acceptance of three such documentation-writer open questions: "no everything should be documented explicitely so we never have to assume anything".

**How to apply:** when a hand-back lists omissions, inferences or deferred bumps, send them back as explicit text to write. Every human decision (R-numbers) must reach every record it affects (stories/ACs, spec, ADR, LLD, backlog, READMEs), and every host or library behaviour a design relies on is stated with its source and whether it was verified live. Related: [[review-budget]], [[related-work-parent-run]].
