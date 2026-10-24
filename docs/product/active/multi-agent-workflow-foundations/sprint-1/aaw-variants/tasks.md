---
kind: tasks
epic: multi-agent-workflow-foundations
sprint: sprint-1
folder: aaw-variants
root: 19
module: ai-dlc
submodule: multi-agent-workflow
integrations: []
source: docs/handoffs/FEAT-20261020-ai-dlc-lens/14.1.14-research-assistant-to-orchestrator.handback.md (13 draft ACs, section 5); plan 00c root 19
stories: stories.md (requirement-analyst)
---

# Root 19: AAW variants

Two variants (human decision 19): (a) harness: PO ↔ AM ↔ DW + BC; (b) plugin/mod: PO ↔ SA ↔ SE ↔ AM ↔ SQA ↔ CR, DW + BC. AAW never uses software-engineer. "AC n" below is the n-th draft AC in 14.1.14 section 5.

Every item is `workflow` skill, handoff skill or orchestrator work: a freshly spawned agent-manager builds it (self-change rule, `orchestrator.md:137`). The plan's defaults stand unless the human changes them at G1: variant picked from the change set, team verification by the sender, own limits for the BC handoff review, PO/SA/SE records under N.1, Copilot subagent-only, an upgrade path.

| ITEM | Task | Goal and files | Covers | Blocked by | Triage |
|---|---|---|---|---|---|
| 045 | 19.1 | Prefactor. Relax `workflow.mjs:373-374` (every starting stage is agent-manager), the reviewer guards `:138-150,376-394` and schema `:28,70-71,258` so a PO- or SA-first AAW lifecycle validates and software-engineer is rejected in AAW; extend `tests/workflow/workflow.test.mjs` first (red) | AC 3, 11 | G2 (design) | needs-info |
| 046 | 19.2 | Variant (a) lifecycle in `templates/workflow.json` and `references/aaw-review.md`; `validate` and `show AAW` pass; test | AC 1, 2 | 045 | needs-info |
| 047 | 19.3 | Variant (b) lifecycle with its stages, loops and team/subagent forms; test | AC 1, 2 | 045 | needs-info |
| 048 | 19.4 | Variant selection from the change set: docs-only harness paths give (a); any script or code, or a path under `plugins/claude/*/`, `tools/`, `tests/` gives (b); unclear asks the human. Rewrite the orchestrator hard rule (`orchestrator.md:105-135`) and `request-routing`; one test per signal | AC 4, 9 | 046, 047 | needs-info |
| 049 | 19.5 | Records per mode: subagent mode, the orchestrator writes and BC reviews each handoff before the receiver starts; team mode, the sender writes and verifies (replaces `handoff:129`); PO/SA/SE records under N.1; AAW examples and `handoff-naming.test.mjs` updated | AC 5, 6, 8 | 047, 050 | needs-info |
| 050 | 19.6 | Per-handoff BC review loop with its own `maxRounds`, `maxFailures` and env variables (`workflow.mjs:564-566`), printed by `rounds --json`, no shared budget | AC 7 | 045 | needs-info |
| 051 | 19.7 | Fallback to subagents under `-p`, the SDK, the missing flag and Copilot; upgrade path for consumer repositories (`/ai-dlc:workflow upgrade`; an old AAW validates or gets the upgrade message); catalog check, Copilot build and harness sync pass | AC 6, 10, 12, 13 | 048, 049 | needs-info |

Tags: module ai-dlc, submodule multi-agent-workflow; feature workflow-design (045-048, 051), handoff (049), loop-design (050). Integrations none.

Triage notes. Established so far: the 13 draft ACs; the plan defaults. Still needed (from the human at G1, defaults in brackets): Q19a-Q19e of the brief [PO joins a harness change; hook scripts count as (b); no gate on (b); one routing key and two lifecycles, architect confirms; this run finishes under the 00c override]. Design (what the lifecycle JSON looks like, how team and subagent forms coexist) is the architect's at G2, so the build items stay `needs-info` until G2.
