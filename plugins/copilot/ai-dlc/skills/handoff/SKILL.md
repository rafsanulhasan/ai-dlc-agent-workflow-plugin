---
name: handoff
description: "Records and verifies the artifact that crosses an AI-DLC stage boundary. Use whenever one agent's stage ends and another's begins (spec → design, design → build, build → test, test → review, review → release) so the receiving agent starts from a verified, self-contained handoff file instead of chat history."
---

# Handoff

Every AI-DLC stage boundary is crossed with a handoff record. The record is what the next agent reads first, what **Scott Hanselman** (`orchestrator`) verifies, and what the human approves at a gate.

> Agent names are the defaults; a name chosen at `/init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## When to use

- A stage in any lifecycle from the `ai-dlc` skill finishes and the next agent is about to be spawned.
- A loop returns work to an earlier stage (review Blockers back to the engineer, spec change back to ASDLC).
- A human gate (G1–G4) needs a single document to approve.

## Procedure

1. **Collect the evidence.** List every artifact the stage produced, by path. Run the cheap checks the stage claims (for build stages: `dotnet build`, `dotnet test`; for test stages: the mutation report path). Record the actual results, not the agent's summary.
2. **Write the record** at `docs/handoffs/<work-item-id>/<NN>-<from>-to-<to>.md` (`NN` is the next sequence number in that folder) using the template below.
3. **Verify.** The orchestrator (or the sending agent when no orchestrator is running) opens each listed artifact and confirms it exists and matches its claim. Set `Verification` to `passed` or `failed` with the reason.
4. **Gate.** If the boundary is a human gate, stop and ask the human to approve the record. Otherwise continue.
5. **Brief the receiver.** Spawn the next agent with `Skill("agent-invocation")` and pass the handoff file path as the first item of *Required context*.

## Template

```markdown
---
work-item: WI-NNN
lifecycle: PDLC | ASDLC | STBLC | FDLC | BFLC | RLC | TLC | CRLC
from: <agent>
to: <agent>
gate: none | G1-clarify | G2-refine | G3-plan | G4-approve
verification: pending | passed | failed
date: YYYY-MM-DD
---

# <from> → <to>: <one-line summary>

## Artifacts
- `<path>` — <what it is>

## Acceptance criteria covered
| AC | Where it is satisfied / tested |
|---|---|
| AC-1 | `<file>:<line>` / `<test name>` |

## Gate evidence
- Build: <command + result, or n/a>
- Tests: <passed/failed counts, or n/a>
- Mutation: <score vs baseline, or n/a>
- Review: <Blockers / Warnings / Suggestions counts, or n/a>

## Decisions made in this stage
- <decision> — <ADR path if any>

## Open questions / risks for the receiver
- <item>

## Instructions for the receiver
<the scoped task, in the receiver's terms>
```

## Rules

- A handoff with `verification: failed` is never passed forward; send the work back to the sender with the failure reason.
- Never paste large artifacts into the record — link them by path.
- One record per boundary crossing; loops create new records rather than editing old ones, so the history of a work item stays auditable.
- Artifact-only lifecycles (agent/skill changes) do not need handoff records.
