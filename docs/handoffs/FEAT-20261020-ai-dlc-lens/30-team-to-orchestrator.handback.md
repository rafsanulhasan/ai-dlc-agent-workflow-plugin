handoff 30-orchestrator-to-team.handoff.md: passed — inputs on disk; five specs + five LLDs bc PASS; ADRs critiqued; po accepted all five specs; only pm's G3 task plan is left

---
run: FEAT-20261020-ai-dlc-lens
step: 30
from: team (sa, se, po, pm, bc), written by sa
to: orchestrator
kind: handback (whole-wave: Wave 2 Design, tier 1 roots 16-20)
mode: team
date: 2026-10-24
parent: 30-orchestrator-to-team.handoff.md
---

# Wave 2 Design, tier 1: hand-back for G2

## Acceptance criteria of the handoff
| # | Criterion | Result |
|---|---|---|
| 1 | Each root has a spec with an LLD that traces every AC to a design element and a test seam, with bc PASS | Met for roots 16-20. Spec and LLD both PASS. |
| 2 | ADRs only for real decisions, each critiqued | Met. ADR-0001 to ADR-0005 all PASS. Roots 16 and 17 have no ADR, and their specs give the reason. |
| 3 | `po` accepts the specs against the stories | Met. All five are accepted, checked by AC id. Root 18 is accepted on condition of a G2 note, below. |
| 4 | `pm`'s task plan, critiqued, in build order with merge groups | **Open.** `pm` writes it after this hand-back and reports it separately for G3. |
| 5 | Every inter-agent record on disk, verified by its sender | Met. There are 58 records under steps 16.1-20.1 in the run folder. Each hand-back's line 1 holds its verification. |

## Artifacts
| Root | Spec | LLD | Narrative | ADRs |
|---|---|---|---|---|
| 16 | `docs/specs/auto-handoff-session-numbering.spec.md` (rev 3) | `docs/specs/auto-handoff-session-numbering.lld.md` | `docs/architecture/narratives/auto-handoff-session-numbering.md` | none |
| 17 | `docs/specs/keepalive-cache-status.spec.md` (rev 3) | `docs/specs/keepalive-cache-status.lld.md` (rev 4) | `docs/architecture/narratives/keepalive-cache-status.md` | none (one is due if ITEM-034.b ships) |
| 18 | `docs/specs/taxonomy.spec.md` (rev 2) | `docs/specs/taxonomy.lld.md` (rev 2) | `docs/architecture/narratives/taxonomy.md` | `ADR-0003-taxonomy-declaration-in-its-own-file.md`, `ADR-0004-tags-not-folders-and-a-deep-run-scan-with-unique-ids.md` |
| 19 | `docs/specs/aaw-variants.spec.md` (rev 2) | `docs/specs/aaw-variants.lld.md` (rev 3) | `docs/architecture/narratives/aaw-variants.md` | `ADR-0001-aaw-variants-under-one-routing-key.md`, `ADR-0002-aaw-guards-by-role-and-handoff-review-limits.md` |
| 20 | `docs/specs/diagramming.spec.md` (rev 2) | `docs/specs/diagramming.lld.md` | `docs/architecture/narratives/diagramming.md` | `ADR-0005-offline-diagram-rendering-in-a-child-process.md` |

All ADRs are in `docs/architecture/decisions/` with the status *Proposed*, and await G2.

## Records and bc verdicts (round limit 2/1 unless noted)
- **Root 16.** `16.1.1` sa→se and its hand-back. Critique rounds `16.1.l1.1` and `16.1.l1.2`: spec REVISE, then PASS; the narrative and the handoff passed both rounds. bc then confirmed the store-only D3 delta in text, as main allowed. LLD: `16.1.2`, `16.1.2.l1.1` REVISE, `16.1.2.l1.2` PASS.
- **Root 17.** `17.1.3` sa→se and its hand-back. Spec rounds: `17.1.l1.1` REVISE, `17.1.l1.2` REVISE, `17.1.l1.3` PASS. The third round was possible because the human raised the limit to 3 for this run. bc confirmed the later text edits that align the spec with LLD rev 4. LLD: `17.1.4` REVISE, `17.1.4.l1.2` PASS.
- **Root 18.** `18.1.1` sa→se and its hand-back. Spec rounds: `18.1.l1.1` REVISE, `18.1.l1.2` PASS. The text edits after round 2 (OQ4, the 044.a/b split, the `runs` listing, the interim tag) were confirmed in text. LLD: `18.1.2` REVISE, `18.1.2.l1.2` PASS.
- **Root 19.** `19.1.1` sa→se and its hand-back. Spec rounds: `19.1.l1.1` REVISE, `19.1.l1.2` PASS for all five documents. The text edits for WF-1, the merge order and the docs timing were confirmed in text. LLD: `19.1.2` REVISE, `19.1.2.l1.2` PASS.
- **Root 20.** `20.1.2` sa→se and its hand-back. Spec rounds: `20.1.l1.1` REVISE, `20.1.l1.2` PASS. The D4 element-table wording was aligned afterwards. LLD: `20.1.3` REVISE, `20.1.3.l1.2` PASS.
- **Spikes 17.1.1, 17.1.2 and 20.1.1.** These came from the orchestrator and were applied in roots 17 and 20.

Open Minors, for the build (bc marked them non-blocking):
- `16.lld:164`: a stale cell for AC-16.2.6.
- Root 20 LLD: `lld:139` stale `cleanSource` text, and `lld:237` pointer to AC-20.7.3.
- Root 19: the LLD records the AAWH→AAWP switch.

## Design decisions to ratify at G2 (with recommended defaults)
| # | Question | Default |
|---|---|---|
| G2-1 (Q18) | Where the taxonomy is declared | `.ai-dlc/taxonomy.json`, maintained by `product-manager` and validated by `workflow.mjs` (ADR-0003) |
| G2-2 (Q19d) | Routing for the AAW variants | One key, `Agent Artifact: ["AAWH", "AAWP"]`. An executable `variant` rule picks the variant, and a post-change check runs after every `change` (ADR-0001, ADR-0002) |
| G2-3 (root 18, narrows G1 stories) | AC-18.3.3, 18.5.3, 18.9.2 and 18.11.2 run under `validate --artefacts`. Plain `validate` checks only the declaration file. CI and `product-manager` run `--artefacts`. | Accept (po accepted). If approved, ra updates the stories with a bc check before the build. |
| G2-4 (root 20 OQ1) | Where the picture goes: right after its fence, or beneath the reply. Both AC wordings are in the spec. | After its fence, with the source still shown above it |
| G2-5 (root 20 OQ3) | Vendored renderer bundles under MIT, EPL-2.0, Apache-2.0 and MPL-2.0, plus the font licence | Accept if ITEM-053.a measures `renderer/` at 15 MB or less and finds no other licence |
| G2-6 (root 17 OQ3) | Pass thresholds for ITEM-034.a, the subagent ping spike | Cheap: at most 2× the main ping, per agent per ping, in token-equivalents, with a cache hit. Safe: one woken turn, no tool call, no message, a reply of at most 50 output tokens, and the next task unchanged. |
| G2-7 | Ratify ADR-0001 to ADR-0005 (status *Proposed* → *Accepted*) | Ratify |

Already decided, so there is nothing to ask:
- **Q34 after the spike** (human, `run.v3.md`): subagent observation now; the ping is opt-in, off by default and conditional (ITEM-034.a and .b).
- **Root 19 mode choice** (main, 00c item 3): both variants can run in both modes, and po withdrew its narrowing note.
- **AC-20.3.2 clarification:** "no jar, or no Java found".

## New or split items for pm and the backlog
- **Root 17.**
  - ITEM-034.c, a build-time observation check. It runs before 034 and is done by `sqa-engineer` as `[MV]`. It is recorded in the backlog.
  - ITEM-034.a, a spike.
  - ITEM-034.b, conditional and opt-in.
- **Root 18.** ITEM-044.a, product data, by `product-manager`. ITEM-044.b, the CI step, by `agent-manager`.
- **Root 19.** WF-1 is one atomic unit (045, 050, 046 and 047, built by one fresh `agent-manager`). The WF merge order is WF-1 → 048 → 051 → 037 → 038.
- **Root 20.** ITEM-053.a, a build spike: the rasteriser (resvg WASM preferred), the font, bundle sizes and the PlantUML security profile.
- **KA order:** 030 → 031, then 032 → 033 → 034.c → 034 → 034.a → 034.b → 035, with 036 after 033 and 034.

## Docs update
Status *planned* for every document below. It changes to *in progress* when each root's first build item starts.
- `plugins/claude/ai-dlc/hooks/keepalive/README.md`: root 17 (ITEM-036), the status lines and the cache explanation.
- `README.md` and `docs/plugins.md`: root 19 (AAW variants) and root 18 (taxonomy, tags, deep discovery, `move-run`).
- `plugins/claude/ai-dlc-lens/README.md`: root 20, the diagramming section and its settings.
- `configure-auto-handoff` README row for `runModule`: root 18.

Root 16 needs no documentation change.

## Next hop
`pm` writes the tier 1 task plan for G3. Then G2 (human), G3 (human), and Wave 3 Build (`run.v4.md`).

totals: roots 5/5 spec PASS, 5/5 LLD PASS, 5 ADRs PASS, po 5/5 accepted, G2 questions 7, task plan pending (pm)
