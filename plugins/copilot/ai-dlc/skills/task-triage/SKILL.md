---
name: task-triage
description: "The product-manager's task and bug triage skill. Turns a classified request into a work breakdown — atomic work items with dependencies, parallel groups, priorities and execution waves — and triages bugs (severity, reproduction, regression, security escalation, duplicates). Flags scope and priority decisions for the product-owner and records items in the backlog. Invoked when the orchestrator asks for a work breakdown, or when a bug report or task needs triage."
---

# Task & Bug Triage

The `product-manager` runs this skill. The `orchestrator` has already classified the request (`request-routing`, Step 1); this skill decides *what the work items are, how they depend on each other, how urgent they are, and in what order they run*. Agent chains, lifecycles and orchestration modes are not part of this skill — the orchestrator assigns them from your breakdown.

```
Skill("task-triage", args: "breakdown <request + classification>")
Skill("task-triage", args: "bug <bug report>")
```

## Step 1 — Read the context

Read the code, docs and `docs/backlog/backlog.md` the request touches. Check for existing backlog items that already cover the work — extend or link them instead of creating duplicates.

## Step 2 — Decompose

For complex requests (multiple types, or more than one agent needed):

1. Identify atomic work items — each deliverable by a single, contiguous agent chain.
2. Map dependencies: which items must complete before others can begin.
3. Identify parallelization: which items share no dependency and can run concurrently.
4. Mark **needs research** on items that require external knowledge (library/API/SDK docs, unfamiliar framework, current best practices, version-migration info) or non-trivial cross-cutting code exploration, so the orchestrator prepends `research-assistant`.
5. Keep decomposition minimal — do not split a naturally sequential flow into artificial fragments.

For simple requests (one type, one agent, no dependencies): return a single-item breakdown.

## Step 3 — Triage bugs

For every Bug Fix or Security Fix item:

| Check | Record |
|---|---|
| Reproduction | Steps, expected vs actual, environment; if missing, an open question for the human |
| Scope of impact | Who or what is affected; data loss or exposure? |
| Regression | Did it work before? Last known good version or commit if findable |
| Security | Auth bypass, data exposure, injection, vulnerable dependency → Security Fix, P0, `security-review` needed |
| Duplicate | Existing backlog item or open bug for the same root cause → link instead of adding |
| Severity | Blocker / Major / Minor / Cosmetic |

## Step 4 — Set priorities

Apply defaults, then check for overrides:

- Security Fix: always P0 — never downgrade.
- Bug: regression or system blocker P0; Major P1; Minor P2; Cosmetic P3.
- Feature: P1 by default; P2 for cosmetic or low-impact work.
- TechDebt: P2; raise to P1 only if it directly blocks a P0/P1 item.

Order the items into execution waves: P0 first; within a wave, items with no dependency between them run in parallel.

## Step 5 — Flag product-owner decisions

You propose priorities; the `product-owner` decides scope and priority for features. Flag:

- any new Feature or scope change;
- any priority that conflicts with the current milestone or in-progress work;
- any item you would defer or drop.

P0 bug and security fixes are not held for the product owner — flag them `route-immediately`.

## Step 6 — Record

Add new items to `docs/backlog/backlog.md` with `Skill("product-planning", args: "add-item ...")` (agent-artifact work is never added — it goes straight to `agent-manager`).

## Output

Return to the orchestrator (text only):

```
## Work Breakdown: <one-line request summary>

| ID | Backlog item | Type | Severity | Priority | Description | Depends On | Parallel With | Needs research |
|---|---|---|---|---|---|---|---|---|

### Execution Waves
- Wave 1 (parallel): …
- Wave 2: …

### Bug triage notes
- <WI id>: reproduction · impact · regression · duplicate of <ITEM-NNN | none>

### Flags for the orchestrator
- Route immediately (P0): <WI ids | none>
- Product-owner decision needed: <WI ids + question | none>
- Conflicts with in-progress work: <items | none>
- Open questions for the human: <questions | none>
```
