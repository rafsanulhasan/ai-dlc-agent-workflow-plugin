---
feature: aaw-variants
root: 19
audience: product owner, plugin maintainer, G2 reviewer
author: software-architect
date: 2026-10-24
spec: docs/specs/aaw-variants.spec.md
adrs: [ADR-0001, ADR-0002]
---

# Narrative: the right review chain for each kind of agent-artifact change

## Act 1: the problem

Every change to agents, skills, hooks or the workflow runs one chain today. `agent-manager` makes the change, then reviewers check it. That chain fits two common cases badly:

- **A one-line rule edit** gets the same machinery as a new hooks module.
- **A plugin or mod change** gets no product owner, no architect and no low-level design before the code is written. The validator also forbids that, because it requires every such chain to start with `agent-manager` (14.1.14, section 1).

So plugin work either skips design or leaves the team's own workflow.

## Act 2: constraints and choices

- **C1 (human).** There are two variants. (a) The harness variant is PO ↔ AM with DW + BC. (b) The plugin/mod variant is PO ↔ SA ↔ SE ↔ AM ↔ SQA ↔ CR with DW + BC. Neither uses `software-engineer` (00c).
- **C2 (human).** The orchestrator picks the variant from the change set and asks the human only when it cannot tell (00c defaults; Q19b: hook scripts are (b)).
- **C3 (human).** Every hand-off is reviewed by `brutal-critique`, under its own limits, with no shared budget and no gate (Q19c).
- **C4.** Code must always be tested and reviewed. This is today's guarantee, and it must survive the split.
- **C5.** Consumer repositories must be able to upgrade. The schema is closed, and `merge` never overwrites a value.
- **C6.** Team mode exists on Claude Code only, and only in some sessions. Copilot runs subagents only.
- **C7.** Run folder names start with the lifecycle code, and the lens parses them.

### Alternatives

- **(a) One lifecycle with conditional stages.** Rejected. Its free-text conditions cannot be checked (C2), and it keeps dormant stages in every run.
- **(b) Two routing keys.** Rejected. The request type is the same, and the choice belongs to routing, not to classification.
- **(c) Two lifecycles under one key, chosen by an executable rule.** Chosen.

### Trade-off

The code-review guarantee (C4) now rests on the rule plus the guards, no longer on stage presence alone. In return, harness edits stay light.

## Act 3: the design

- **D1, D2 (C1, C2, C7).** Two lifecycles, `AAWH` and `AAWP`, listed under the one `Agent Artifact` key. The codes have no hyphen, so the lens keeps parsing folder names. (ADR-0001)
- **D4 (C2, C4).** A `variant` command classifies the change set:
  - any code goes to `AAWP`;
  - docs in harness folders go to `AAWH`;
  - anything else is a question for the human.

  The rule is written once, in `aaw-review.md`.
- **D3 (C1, C4).** The validator guards by role:
  - no `software-engineer`;
  - an `agent-manager` stage;
  - PO, SA or AM may start the chain;
  - critique always present;
  - test, code review and design in the plugin variant;
  - no disabled agent in an AAW chain.

  For C4, a second `variant` check runs on the paths actually changed, after every change. A harness run that changed code stops for the human.

  (ADR-0002)
- **D5 (C3).** The handoff review has its own `rounds` row and its own variables. (ADR-0002)
- **D6 (C3, C6).** Every record is verified by the agent it is addressed to. In team mode, the sender verifies the hand-back.
- **D7 (C6, C1).** Both variants can run as a team or as subagents (00c item 3). The orchestrator chooses for each request, and asks when it is unsure. The run falls back to subagents wherever teams are unavailable.
- **D9 (C5).** An old file fails `validate` with an upgrade message. The upgrade migrates it with the developer's consent.
- **D10.** Each change to the `workflow` skill is made by a freshly spawned `agent-manager`. Root 19 merges before root 18's taxonomy keys.

### Risks

- **A wrong `pluginPaths` list in a consumer repository** can send a docs-only plugin change to the harness variant. Design review is skipped, but code review never is.
- **Two roots edit the `workflow` skill.** The WF merge order handles it.
