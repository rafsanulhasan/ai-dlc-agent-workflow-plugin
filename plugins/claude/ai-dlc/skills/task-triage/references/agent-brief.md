# Agent-Ready Brief

A brief is the contract a work item carries once its triage state is `ready-for-agent` (or `ready-for-human`). The request, the bug report and the discussion are background; the brief is what the receiving agent builds against. Record it in the backlog item (or in the work item's handoff file) so it survives the conversation.

A brief may sit in the backlog for days while other waves land. Write it so it stays true after files are renamed, moved or refactored.

## Rules

| Rule | Write | Instead of |
|---|---|---|
| **Durable** | Interfaces, types, function signatures, config shapes, domain terms the agent can search for | File paths and line numbers; the current layout of the code |
| **Behavioural** | What the system does after the change, including edge cases and error paths | Step-by-step implementation instructions; the receiving agent explores the code fresh and makes its own design choices |
| **Testable** | Acceptance criteria that can each be verified on their own (`AC-1: Given X, when Y, then Z.`) | "Works correctly", "is handled properly" |
| **Bounded** | An explicit out-of-scope list naming the adjacent changes the agent must leave alone | Silence, which invites gold-plating |
| **Verified** | What you confirmed while triaging: the reproduction result, the code path, the existing behaviour | Unverified reporter claims stated as fact |

A brief for existing work (an open pull request, a half-finished branch) describes the current state of that diff and what remains to finish or fix, not the whole feature from scratch.

A snippet belongs in a brief only when it pins a decision more precisely than prose can (a state machine, a schema, a type shape). Trim it to the decision-carrying lines.

## Template

```markdown
### Brief: <WI id> — <one-line summary>

**Type:** Feature | Bug Fix | Security Fix | TechDebt
**Triage state:** ready-for-agent | ready-for-human
**Blocked by:** <WI ids, or "none — can start now">

**Current behaviour:**
What happens today. For a bug, the broken behaviour and the reproduction result.
For a feature, the status quo it builds on. For existing work, the state of the diff.

**Desired behaviour:**
What is true when the item is done, including edge cases and error conditions.

**Key interfaces:**
- `<TypeOrContract>` — what changes and why
- `<operation>` — current vs required result

**Acceptance criteria:**
- [ ] AC-1: …
- [ ] AC-2: …

**Out of scope:**
- …

**Why a human (ready-for-human only):**
The judgment call, external access, design decision or manual check that keeps this away from an agent.
```

## Self-check before marking `ready-for-agent`

- Could an agent that never saw the conversation start work from this brief alone?
- Does every acceptance criterion have an observable pass or fail?
- Would the brief still be correct if every file it touches were renamed tomorrow?
- Is everything the agent might be tempted to "also fix" listed as out of scope?
