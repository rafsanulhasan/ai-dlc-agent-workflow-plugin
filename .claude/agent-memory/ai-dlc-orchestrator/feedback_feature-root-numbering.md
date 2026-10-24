---
name: feature-root-numbering
description: Each feature is one root N with fixed phase sub-roots N.1 plan, N.2 build, N.3 test, N.4 review (N.4.1 conventions, N.4.2 intent), N.5 docs; l<k> = loop k, rounds as sub-numbers; run state versioned major.minor
metadata:
  type: feedback
---

Number a run's records with **each feature as one root N**, and under it the **phase sub-roots** the human set on 2026-10-24:
- N.1 planning;
- N.2 implementation (software-engineer, or agent-manager in AAW);
- N.3 testing, with N.3.l1 the SQA ↔ engineer loop;
- N.4 code review: N.4.1 coding conventions, N.4.2 intent; both across implementation and test code;
- N.5 documentation, with N.5.l1 the critique loop.

Docs come after review. `l<k>` is loop k of a sub-root, never a round; rounds are sub-numbers (N.3.l1.1, N.3.l1.2), and loop numbers count per sub-root. Each sub-root's run-state row lists its session ids and agent ids. Only a new feature, a gate record or a whole-run hand-off takes the next free top-level number. The exact rule is the handoff skill's *Naming*.

Run-state versions:
- one current version per session (the last file it wrote); an automatic-handoff chain owns its parent's version;
- a plain continuation updates the current file in place for its owner, otherwise it writes the next minor;
- a change of direction writes a minor pair: v1.1 says what is deprecated, v1.2 the new direction;
- a new request scope writes the next major;
- when scope and direction both change, write the pair, then the major;
- the highest version is current.

**Why:** the human, 2026-10-24, over several answers. An earlier "change N.1, reviews N.2/N.3, fix N.1.l1" proposal was rejected. Older records are renamed to the new scheme, not kept.

**How to apply:** before writing a handoff record, pick the feature root, then the phase sub-root by the receiving agent's role, then the loop and round. Never number by order. Related: [[related-work-parent-run]], [[lens-chart-per-step]].
