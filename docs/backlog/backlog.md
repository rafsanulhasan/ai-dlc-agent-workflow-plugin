# Product Backlog — AI-DLC Agent Workflow

Maintained by `product-manager` through the `product-planning` skill. Priorities: P0 critical blocker · P1 high · P2 medium · P3 low.

<!-- Items use this shape:

### ITEM-001: <Title>
- **Type**: Feature | Bug | Security | TechDebt | Release
- **Priority**: P0 | P1 | P2 | P3
- **Status**: Backlog | In Progress | Review | Done | Cancelled
- **Lifecycle**: AI-DLC | PDLC | ASDLC | STBLC | FDLC | BFLC | RLC | TLC | CRLC
- **Milestone**: <version or "Unplanned">
- **Added**: YYYY-MM-DD
- **Agent Chain**: <e.g. requirement-analyst → software-architect → software-engineer → sqa-engineer>

**Acceptance Criteria**
- [ ] AC-1 <verifiable condition>
-->

### ITEM-001: Configurable review limits per loop (maxRounds / maxFailures)
- **Type**: Feature
- **Priority**: P2
- **Status**: Done
- **Lifecycle**: AAW
- **Milestone**: 1.0.0-preview1
- **Added**: 2026-10-22
- **Agent Chain**: agent-manager → brutal-critique / sqa-engineer → code-reviewer

Done 2026-10-22 in commit 85b53e8. Every review loop carries maxRounds and maxFailures (default 2 / 1), overridable by three env pairs; `rounds --json` reports the limits in effect. Runs: `docs/handoffs/AAW-20261022-review-rounds-workflow-skill/`, `AAW-20261022-review-rounds-consumers/`, `AAW-20261022-review-rounds-agent-manager/`.

**Acceptance Criteria**
- [x] AC-1 Each review loop has maxRounds and maxFailures with defaults 2 / 1
- [x] AC-2 Three env pairs override the limits
- [x] AC-3 `rounds --json` reports the limits in effect

### ITEM-002: Fix 7 Minor wording findings from the final critiques of the review-limits runs
- **Type**: TechDebt
- **Priority**: P3
- **Status**: Backlog
- **Lifecycle**: AAW
- **Milestone**: Unplanned
- **Added**: 2026-10-22
- **Agent Chain**: agent-manager → brutal-critique

Source: "Gates and loops" in `docs/handoffs/AAW-20261022-review-rounds-workflow-skill/run.md` and `docs/handoffs/AAW-20261022-review-rounds-consumers/run.md`.

**Acceptance Criteria**
- [ ] AC-1 All 7 Minor wording findings are fixed or explicitly declined with a reason
- [ ] AC-2 brutal-critique returns PASS on the changed docs
