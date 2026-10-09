---
name: task-triage
description: "The product-manager's task and bug triage skill. Turns a classified request, plan or spec into a work breakdown — tracer-bullet work items with explicit blocking edges, parallel groups, priorities and execution waves — and triages bugs (verification, severity, regression, security escalation, duplicates). Gives every item a triage state (needs-info, ready-for-agent, ready-for-human, wontfix), writes agent-ready briefs, checks for already-built and previously rejected requests, decides and records rejections in docs/backlog/out-of-scope/, escalates genuine scope or priority conflicts to the product-owner as open questions and records items in the backlog. Invoked when the orchestrator asks for a work breakdown, when a bug report or task needs triage, or when a backlog item must be re-triaged or made agent-ready."
---

# Task & Bug Triage

**James Montemagno** (`product-manager`) owns and runs this skill, including deciding and recording rejections. **Scott Hanselman** (`orchestrator`) has already classified the request (`request-routing`, Step 1); this skill decides *what the work items are, how they block each other, how urgent they are, whether each is ready to build, and in what order they run*. Agent chains, lifecycles and orchestration modes are not part of this skill — the orchestrator assigns them from your breakdown.

> Agent names are the defaults; a name chosen at `/ai-dlc:init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

```
Skill("ai-dlc:task-triage", args: "breakdown <request | plan | spec path> + <classification>")
Skill("ai-dlc:task-triage", args: "bug <bug report>")
Skill("ai-dlc:task-triage", args: "retriage <ITEM-NNN>")
```

Supporting references:

- [references/agent-brief.md](references/agent-brief.md) — how to write the brief a `ready-for-agent` item carries.
- [references/out-of-scope.md](references/out-of-scope.md) — the record of rejected feature requests and how to read and write it.

## Step 1 — Read the context

1. Read the code, docs and `docs/backlog/backlog.md` the request touches, using the project's domain vocabulary and respecting ADRs in the area. If the input is a spec or plan path, read it in full.
2. **Resume, don't restart.** If the item already carries triage notes, read them and check which open questions have been answered since. Do not re-ask a resolved question.
3. **Duplicate check.** Existing backlog items or open bugs that already cover the work — extend or link them instead of adding new ones.
4. **Already-built check.** Search the code for an existing implementation of the requested behaviour by domain concept, not just by the request's wording. Record where you looked. A hit makes the item `wontfix (already implemented)` — point to where it lives.
5. **Prior-rejection check.** Read `docs/backlog/out-of-scope/` ([references/out-of-scope.md](references/out-of-scope.md)) and flag any concept that matches the request.

Step 1 is complete when every item has a recorded result for all three checks (match with reference, or "none — searched <where>").

## Step 2 — Decompose into tracer bullets

For complex requests (multiple types, or more than one agent needed), break the work into **tracer-bullet** work items:

1. **Vertical, not horizontal.** Each item cuts a narrow but complete path through every layer it touches (contract, logic, persistence, UI, tests) and is demoable or verifiable on its own. "All the database changes" is a horizontal layer, not a work item.
2. **Sized for one fresh context.** An agent that starts cold should be able to finish an item in a single session from its brief.
3. **Prefactor first.** When a preparatory refactor would make the change easy, make it its own item that blocks the feature items — make the change easy, then make the easy change.
4. **Explicit blocking edges** (the `Depends On` column). For every item, list the items that must be *done* before it can *start*. Add an edge only when the blocker genuinely gates the work, not because it happened to be listed first. An item with no blockers can start immediately.
5. Mark **needs research** on items that require external knowledge (library/API/SDK docs, unfamiliar framework, current best practices, version-migration info) or non-trivial cross-cutting code exploration, so the orchestrator prepends **Jon Skeet** (`research-assistant`).
6. Keep decomposition minimal — do not split a naturally sequential flow into artificial fragments.

**Wide refactors are the exception to vertical slicing.** When one mechanical change (renaming a column, retyping a shared symbol) breaks call sites across the whole codebase, no single slice can land green. Sequence it as **expand–contract** instead:

- **Expand** — add the new form beside the old; nothing breaks.
- **Migrate** — move call sites in batches sized by blast radius (per module, per directory); each batch is its own item, blocked by the expand, and the build stays green because the old form still exists.
- **Contract** — remove the old form, blocked by every migrate batch.

If even the batches cannot stay green alone, keep the sequence on a shared integration branch and add a final integrate-and-verify item that every batch blocks; green is promised only there.

For simple requests (one type, one agent, no dependencies): return a single-item breakdown.

**Check the breakdown** before moving on: is the granularity right (no item too large for one session, none too thin to verify)? Does every blocking edge gate real work? Should any items merge or split? Raise unresolved doubts as open questions for the human; the orchestrator confirms the plan with them.

## Step 3 — Triage bugs

For every Bug Fix or Security Fix item, **verify the claim before anything else**: reproduce it from the reporter's steps (or, for submitted code, check out the change and run the relevant tests). Record the result as *confirmed* (with the code path), *not reproduced*, or *insufficient detail* — the last is a strong `needs-info` signal.

| Check | Record |
|---|---|
| Verification | Confirmed (code path) / not reproduced / insufficient detail |
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

Order the items into execution waves along the blocking edges: P0 first; a wave holds the **frontier** — items whose blockers are all done — and items in the same wave run in parallel.

## Step 5 — Assign a triage state

Every item ends with exactly one triage state. It is separate from the backlog `Status` field: the state says whether the item is ready to build, the status says where it is in delivery.

| State | Meaning | What you attach |
|---|---|---|
| `needs-info` | A question only the human or reporter can answer blocks a testable brief | Triage notes (below) |
| `ready-for-agent` | Fully specified; an agent can build it without the conversation | Agent-ready brief ([references/agent-brief.md](references/agent-brief.md)) |
| `ready-for-human` | Needs a judgment call, external access, a design decision or a manual check | The same brief, plus why it cannot be delegated |
| `wontfix (already implemented)` | The behaviour exists | Where it lives; nothing is written to `out-of-scope/` |
| `wontfix (rejected)` | You declined it in triage | For a feature, the `out-of-scope/` entry; for a bug, the explanation |

An item stays out of `ready-for-agent` until its brief passes the self-check in the brief reference. If the human explicitly sets a state, apply it and confirm what you changed; when they push an item to `ready-for-agent` without a brief, ask whether to write one.

Triage notes for `needs-info` keep what is already settled, so the next pass starts from it:

```markdown
#### Triage notes — <WI id>
**Established so far:**
- …
**Still needed (from <who>):**
- <specific, answerable question>
```

Each question names the exact fact needed ("Which version did this last work on?"), never "please provide more detail".

## Step 6 — Decide deferrals and rejections; escalate conflicts

Triage is yours end to end. You set priorities and triage states, and you decide which items to defer, reject or drop, including what to do with a match against `out-of-scope/` ([references/out-of-scope.md](references/out-of-scope.md)). Record each rejection and its durable reason.

**James Montemagno** (`product-owner`) owns product scope and priority but does not run or co-own triage. Escalate to the product owner, as an open question through the orchestrator, only a genuine conflict with a decision they own:

- a priority that conflicts with the current milestone or in-progress work they set;
- a rejection or deferral that would contradict the product brief or a scope decision they made.

Do not hold the rest of the breakdown for the answer; mark the affected items `needs-info` until it comes back.

P0 bug and security fixes are never held — flag them `route-immediately`.

## Step 7 — Record

Add new items to `docs/backlog/backlog.md` with `Skill("ai-dlc:product-planning", args: "add-item ...")`, including each item's blocking edges, triage state and brief or triage notes (agent-artifact work is never added — it goes straight to **Boris Cherny** (`agent-manager`)). When you reject a feature, update `docs/backlog/out-of-scope/` as described in [references/out-of-scope.md](references/out-of-scope.md).

## Output

Return to the orchestrator (text only):

```
## Work Breakdown: <one-line request summary>

| ID | Backlog item | Type | Severity | Priority | Triage state | Description | Depends On (blocked by) | Parallel With | Needs research |
|---|---|---|---|---|---|---|---|---|---|

### Execution Waves
- Wave 1 (parallel): …
- Wave 2: …

### Briefs
- <WI id>: <brief, or link to where it is recorded>

### Bug triage notes
- <WI id>: verification · reproduction · impact · regression · duplicate of <ITEM-NNN | none>

### Context checks
- Already implemented: <WI id → location | none> (searched: …)
- Prior rejections: <WI id → out-of-scope/<concept>.md | none>

### Flags for the orchestrator
- Route immediately (P0): <WI ids | none>
- Scope or priority conflict for the product-owner: <WI ids + question | none>
- Conflicts with in-progress work: <items | none>
- Open questions for the human: <questions | none>
```

Adapted in part from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT).
