---
name: product-planning
description: "Product backlog management and release planning skill. Invoked by the product-manager agent to add items, review backlog health, re-prioritize, plan releases, or update item status. Reads and writes docs/backlog/backlog.md as the persistent source of truth."
---

# Product Planning Skill

You are executing the `product-planning` skill on behalf of **James Montemagno** (`product-manager`). You manage the backlog file at `docs/backlog/backlog.md` and apply prioritization rules consistently.

> Agent names are the defaults; a name chosen at `/ai-dlc:init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## Input

The calling agent passes an action verb as `args`:

| Action | Description |
|---|---|
| `review-backlog` | Summarize current backlog state and recommend next actions |
| `add-item <description>` | Add a new work item to the backlog |
| `prioritize` | Re-rank items based on current context |
| `plan-release <version>` | Prepare a release checklist and hand off to **Gene Kim** (`devops-engineer`) |
| `update-status <ITEM-NNN> <status>` | Change an item's status |

## Process

### Backlog Initialization

If `docs/backlog/backlog.md` does not exist:

1. Create the `docs/backlog/` directory path.
2. Write the initial backlog file:

```markdown
# Product Backlog

_Last updated: YYYY-MM-DD_

## Priority Key
- **P0**: Critical blocker — stops work or releases
- **P1**: High impact — next to be worked
- **P2**: Medium — planned, not urgent
- **P3**: Low — nice-to-have, deferred

## Active Items

_(none yet)_

## Completed Items

_(none yet)_
```

### Priority Rules (always enforced)

| Type | Default Priority | Override Condition |
|---|---|---|
| Security Fix | P0 | Never downgrade |
| Bug (regression / system blocker) | P0 | — |
| Bug (other) | P1 | — |
| Feature | P1 | Cosmetic or low-impact → P2 |
| TechDebt | P2 | Blocking a P0/P1 item → P1 |
| Release | — | Blocked by any open P0 for the milestone |

### ID Assignment

Read the backlog, find the highest existing `ITEM-NNN` number, increment by 1. Start at `ITEM-001` if the backlog is empty.

### Item Format

```markdown
### ITEM-NNN: <Title>
- **Type**: Feature | Bug | Security | TechDebt | Release
- **Priority**: P0 | P1 | P2 | P3
- **Status**: Backlog | In Progress | Review | Done | Cancelled
- **Milestone**: <version or "Unplanned">
- **Added**: YYYY-MM-DD
- **Agent Chain**: <e.g., requirement-analyst → software-architect → software-engineer → sqa-engineer>

**Acceptance Criteria**
- [ ] <verifiable condition>
- [ ] <verifiable condition>
```

### Action: review-backlog

1. Count items by type, priority, and status.
2. Flag any P0 items not "In Progress" — these are immediate escalations.
3. Identify the critical path (longest dependency chain from Backlog to Done).
4. Surface stale items (status not changed recently and no adjacent git activity).
5. Recommend the next 3 unblocked items to start.

### Action: add-item

1. Assign next ITEM-NNN.
2. Apply priority rules.
3. If Feature type and no acceptance criteria provided: request them — do not write the item without at least two verifiable criteria.
4. Check for duplicate items before adding (search by title keywords).
5. Append to "Active Items" section.
6. Write to `docs/backlog/backlog.md`.

### Action: prioritize

1. List all active items sorted by current priority.
2. For each proposed change: state item, old priority, new priority, and justification.
3. Apply changes to `docs/backlog/backlog.md`.
4. Return a change summary.

### Action: plan-release

1. Identify all items for the target milestone.
2. Verify all are "Done" or explicitly "Cancelled" / deferred to a later milestone.
3. Check for open P0 items — any P0 blocks the release; surface the blocker and stop.
4. Draft release notes by type (Features / Bug Fixes / Security Patches / Tech Debt).
5. Present draft to the calling agent for user approval before handing off to `devops-engineer` for deployment.
6. After approval: move all included items to "Completed Items" section with status "Done" and date.

### Action: update-status

1. Find item by ITEM-NNN.
2. Update the `Status` field.
3. If "Done": verify all acceptance criteria checkboxes are checked; flag unchecked ones.
4. If update unblocks a dependent item: note it in the return value.
5. Write to `docs/backlog/backlog.md`.

## Output

Return the requested report or confirmation to the product-manager agent. Always write changes to `docs/backlog/backlog.md` before returning — never hold backlog changes in memory only.
