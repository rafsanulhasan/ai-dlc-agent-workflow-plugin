---
run: FEAT-20261020-ai-dlc-lens
step: 31
from: orchestrator
to: human
kind: handoff (gate G2, tier 1: roots 16-20, frozen spec)
date: 2026-10-24
run-state: run.v3.md
---

# G2: freeze the tier 1 specs and designs (roots 16-20)

## Artifacts to approve (docs/specs/, docs/architecture/)
| Root | Spec | LLD | Narrative | ADRs |
|---|---|---|---|---|
| 16 auto-handoff session N | auto-handoff-session-numbering.spec.md (rev 3) | .lld.md | narratives/auto-handoff-session-numbering.md | — |
| 17 keep-alive cache status | keepalive-cache-status.spec.md (rev 3) | .lld.md (rev 4) | narratives/keepalive-cache-status.md | — (one only if 034.b ships) |
| 18 taxonomy | taxonomy.spec.md (rev 2) | .lld.md (rev 2) | narratives/taxonomy.md | ADR-0003, ADR-0004 |
| 19 AAW variants | aaw-variants.spec.md (rev 2) | .lld.md (rev 3) | narratives/aaw-variants.md | ADR-0001, ADR-0002 |
| 20 diagramming | diagramming.spec.md (rev 2) | .lld.md (rev 2) | narratives/diagramming.md | ADR-0005 |

## Gate evidence
- bc verdicts: every spec, LLD, narrative, ADR and sa→se handoff is PASS. Root 17's spec needed round 3, which the human allowed. Root 16's post-PASS delta and root 18's final edits were confirmed by bc in text. 0 open Blockers or Majors.
- po accepted all five specs against the G1 stories. Every AC traces to a design element and a test seam.
- G2 inputs: spikes 17.1.1 (subagent cache observable; a ping is impossible except via session.send), 17.1.2 (prices confirmed; 1h refresh undocumented), 20.1.1 (fence split possible; surfaces; licences).
- Minors carried into the build, listed in the bc records: stale LLD lines (16 :164, 17 :184/:281, 20 :139); unverified engine names to confirm at build (`store.*`, `classic.SubagentStart/Stop/TeammateIdle`, Image/Svg props); 053.a resolves resvg wasm, the font and the PlantUML profile.

## Questions for the human
1. Root 20 OQ1: picture placement, (A) right after its fence with the source still shown, or (B) beneath the reply.
2. Root 20 OQ3: vendor renderer bundles (MIT, EPL-2.0, Apache-2.0, MPL-2.0), renderer/ at most 15 MB unpacked, fonts included, subject to the 053.a check.
3. Root 18: "when validate runs" in AC-18.3.3, 18.5.3 and 18.9.2 means `validate --artefacts`; plain validate checks only the declaration. This narrows the G1 stories.
4. Root 18 ownership: `.ai-dlc/taxonomy.json` kept by product-manager as product data (ADR-0003), not by agent-manager as an agent artifact.
5. Root 17 OQ3: 034.a pass thresholds. Cheap: at most 2x the main ping per agent per ping, with a cache hit. Safe: one woken turn, no tool call, no message, a reply of at most 50 output tokens, and the next task unchanged.
