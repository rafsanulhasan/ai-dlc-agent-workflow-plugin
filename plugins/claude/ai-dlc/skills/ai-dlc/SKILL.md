---
name: ai-dlc
description: "AI-DLC lifecycle router and operating model. Use FIRST for any non-trivial request to pick which of the eight named lifecycles applies (PDLC, ASDLC, STBLC, FDLC, BFLC, RLC, TLC, CRLC), which agents own each stage, which artifact each stage must hand off, and which gates a human must approve. The orchestrator's request-routing skill chooses each work item's lifecycle from this catalogue (unless the user named one), and the orchestrator follows it to run each stage."
---

# AI-DLC — Lifecycle Router

AI-DLC moves the unit of delegation from a line of code to a **phase of the lifecycle**. A team of role-scoped agents owns the lifecycle end to end; the human sets intent, approves gate crossings and resolves ambiguity — reviewing **artifacts**, not every line of code.

> Agent names are the defaults; a name chosen at `/ai-dlc:init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

The routing layer has four parts, used in this order:

1. **`request-routing`** — **Scott Hanselman** (`orchestrator`) classifies the request and decides each work item's workflow from this skill's lifecycles (or the user's explicit choice), its agent chain and orchestration mode.
2. **`ai-dlc`** (this skill) — the lifecycle catalogue: stages, owners, exit artifacts and human gates.
3. **`agent-invocation`** — spawns agents with self-contained briefs.
4. **`handoff`** — records and verifies the artifact that crosses each stage boundary.

## Roles

| Code | Role in the deck | Name | Agent(s) in this plugin |
|---|---|---|---|
| ORC | Orchestrator | Scott Hanselman | `orchestrator` — receives every human request first, gets intent, drives the flow, verifies artifacts, approves gate crossings on the human's behalf only when the human has delegated that gate |
| TRI | Triage | Scott Hanselman; James Montemagno | `orchestrator` classifies and routes (lifecycle, mode, chain); `product-manager` decomposes the request into prioritised work items with dependencies and waves |
| PO | Product Owner | James Montemagno | `product-owner` — owns Plan and Release: product brief, scope and priority decisions, acceptance of stories and backlog, release go / no-go. Directs two specialists: `requirement-analyst` (elicitation, stories, numbered ACs, spec) and `product-manager` (backlog, sequencing, release-gate checklist) |
| SA | Software Architect | Mark Richards | `software-architect` |
| SDE | System Design Engineer | Zoran Horvat | `system-engineer` |
| SWE | Software Engineer | David Fowler | `software-engineer` |
| SQA | SQA Engineer | Kent Beck | `sqa-engineer` |
| CR | Code Reviewer | Robert C. Martin (Uncle Bob) | `code-reviewer` |
| RA | Research Assistant | Jon Skeet | `research-assistant` — runs every research task, owns the knowledge base |
| DW | Documentation Writer | Daniele Procida | `documentation-writer` — writes every document |
| BC | Brutal Critique | Linus Torvalds | `brutal-critique` — parallel, adversarial critique of every document |
| OPS | Release / DevOps | Gene Kim | `devops-engineer` — CI/CD, packaging, release gates |
| PM-D | Presentation Manager | Nancy Duarte | `presentation-manager` — creates, updates and reviews slide decks, keeping them true to the project |
| ARM | Agent Resource Manager | Boris Cherny | `agent-manager` — the only agent that may change agents, skills, hooks or rules |

In Claude Code every agent id is prefixed `ai-dlc:` (for example `ai-dlc:software-engineer`).

`DW ↔ BC` on a lifecycle means: every document that lifecycle produces is written by DW (or the owning agent) and critiqued by BC **in parallel** before the gate is crossed.

## Phase ownership

| Phase | Owner | Artifact handed to the next phase |
|---|---|---|
| Plan | PO | User stories with numbered acceptance criteria |
| Architect | SA | Specs + ADRs |
| Design | SDE | Low-level design (modules, patterns, DI plan) |
| Build | SWE | Implementation diff, green `dotnet build` / `dotnet test` |
| Test | SQA | Test suite, AC-traceability table, mutation report |
| Review | CR | Severity-ranked findings report (Blocker / Warning / Suggestion) |
| Release | PO (go / no-go) + `product-manager` (checklist) + OPS | Release notes, release gate checklist, published package |

## Step 1 — Classify into one lifecycle

The `orchestrator` picks exactly one primary lifecycle per work item and runs the stages. A request may produce several work items in different lifecycles (for example a feature that first needs PDLC, then ASDLC, STBLC and FDLC).

| # | Lifecycle | Pick it when… | Agents | Exit artifact |
|---|---|---|---|---|
| 1 | **PDLC** · Product Design | The input is a vague idea, epic or business goal | PO · DW ↔ BC | Feature list, use-case diagrams, user stories with numbered ACs in `docs/product/` and `docs/backlog/backlog.md` |
| 2 | **ASDLC** · Architecture & Design | Stories exist but no agreed design / spec | PO ↔ SA ↔ SDE ↔ RA · DW ↔ BC | ADRs in `docs/architecture/decisions/` plus a **frozen** `docs/specs/<slug>.spec.md` per story, co-owned by SA and SDE |
| 3 | **STBLC** · Story & Task Breakdown | A frozen spec exists but no task plan | PO ↔ SA ↔ SDE ↔ SWE · DW ↔ BC | `docs/plans/<slug>.tasks.md`: estimated, dependency-ordered tasks, each with its own technical Definition of Done |
| 4 | **FDLC** · Feature Development | Tasks exist and code must land | SA + SDE ↔ SWE ↔ SQA ↔ CR · DW ↔ BC | Merged-ready change: code, tests, docs, review report with zero Blockers |
| 5 | **BFLC** · Bug Fixing | Incorrect behaviour, failing test, regression | SA ↔ SDE ↔ SWE ↔ SQA ↔ CR ↔ RA · DW ↔ BC | Root cause statement, minimal fix, a regression test that **failed before and passes after** |
| 6 | **RLC** · Refactoring | Structure must change, behaviour must not | SA ↔ SDE ↔ SWE ↔ SQA ↔ CR ↔ RA | Refactor diff, unchanged public behaviour, mutation score **not lower** than baseline |
| 7 | **TLC** · Testing | Existing code lacks coverage, AC traceability or mutation strength | PO ↔ SA ↔ SDE ↔ SWE ↔ SQA ↔ CR · DW ↔ BC | Test plan, new tests, AC-traceability table, mutation report |
| 8 | **CRLC** · Code Review | An open change / PR must be driven to merge-ready | PO ↔ CR ↔ SWE ↔ SQA | Findings report; CR approves **only at zero Blockers** |

Shortcuts:

- Agent/skill/hook/rule/command changes are **not** a lifecycle — route straight to `agent-manager`.
- P0 security issues: BFLC with `security-review` run by SA/CR before the fix lands; notify PO afterwards.
- Pure questions: answer, or delegate to `research-assistant`; no lifecycle.
- Releases: Release phase — `product-manager` runs its release-gate checklist, `product-owner` gives go / no-go, then `devops-engineer` runs CD.

## Step 2 — Run the lifecycle's stages

### PDLC
1. `product-owner` writes the product brief (`docs/product/<slug>/brief.md`: outcomes, features, use cases) and returns a delegation list.
2. `requirement-analyst` → `Skill("ai-dlc:requirement-analysis")`: one question at a time until every story has testable, numbered ACs.
3. `product-manager` → `Skill("ai-dlc:product-planning", args: "add-item …")`: backlog entries with the priority the product owner decided.
4. `product-owner` accepts the stories and backlog (or sends them back); BC critiques the brief and stories. **Gate G1 — Clarify:** human approves the stories and ACs.

### ASDLC
1. `software-architect` → `Skill("ai-dlc:architecture-design")` (RA in parallel for any external fact). Each consequential decision → `Skill("ai-dlc:write-adr")`.
2. `system-engineer` → `Skill("ai-dlc:system-design")` against the architecture.
3. `requirement-analyst` → `Skill("ai-dlc:spec-driven-development")`: SA and SDE co-sign the spec; it is then **frozen** (status `Frozen`). Changes after freezing go back through this step.
4. `software-architect` → `Skill("ai-dlc:architecture-narrative")`: the three-act story (problem → constraints and trade-offs → design, ADRs, risks) at `docs/architecture/narratives/<slug>.md`, written for the human who approves G2.
5. BC critiques the ADRs, spec and narrative. **Gate G2 — Refine / Align:** human approves the frozen spec, reading the narrative first.

### STBLC
1. SA + SDE split the spec into tasks; SWE estimates and flags unknowns; PO orders by priority.
2. Each task records: id, AC references, dependencies, estimate, technical DoD.
3. **Gate G3:** human approves the task plan (may be delegated to ORC for small plans).

### FDLC — the build loop
1. SWE → `Skill("ai-dlc:implement-feature")`: every behaviour traces to a numbered AC; anything outside the spec goes back to ASDLC.
2. In parallel after SWE: SQA (`design-test-cases` → `write-tests` → `csharp-mutation-testing`), DW (`write-documentation`), BC on the docs.
3. SA → `Skill("ai-dlc:architecture-review")` — **Architecture Conformance** gate.
4. CR → `Skill("ai-dlc:review")` — **Code Audit & Refinement** loop: Blockers return to SWE (or SQA for test code) until zero remain.
5. **Gate G4 — approve:** human signs off the review report, not the diff.

### BFLC
1. SWE → `Skill("ai-dlc:fix-bug")` Phase 1 only: root cause with file:line. RA if external behaviour is involved; SA if the cause is architectural.
2. SQA writes the regression test **first** and shows it failing.
3. SWE applies the minimal fix; the regression test passes; full suite green.
4. CR reviews. DW updates docs if behaviour visible to users changed.

### RLC
1. SQA captures a mutation baseline (`csharp-mutation-testing`, baseline mode) **before** any change.
2. SA/SDE define the target structure (and any ADR); SWE refactors in small steps with tests green after each.
3. SQA re-runs mutation testing — the score must not regress; CR confirms no behaviour change.

### TLC
1. PO and SA identify the ACs and risk areas; SQA → `design-test-cases` with an AC-traceability table.
2. SQA → `write-tests` and `csharp-mutation-testing`; SWE only touches production code if a test reveals a bug (which forks a BFLC item).
3. CR reviews test quality.

### CRLC
1. CR → `Skill("ai-dlc:review")` on the PR/branch (plus SonarQube where configured).
2. Blockers loop to SWE / SQA; PO resolves scope disputes.
3. CR approves at **zero Blockers**; ORC verifies and reports.

## Step 3 — Gates, verification and the human

- **Every handoff is an artifact.** Cross a stage boundary only with `Skill("ai-dlc:handoff")`, which records the artifact paths and the verification result in `docs/handoffs/`.
- **Trust, but verify.** The orchestrator reads the artifact before the next agent starts. An agent's summary is a claim, not evidence.
- **Hard gates beat confidence.** Build and tests must be green before Build ends (in .NET repositories `init` installs a Stop hook that enforces `dotnet test`); mutation testing is the SQA's gate.
- **Ambiguity is a human job.** When intent, scope or ACs are unclear, ask the human one targeted question. Never let an agent guess.
- **Re-anchor long runs** on the frozen spec at each stage boundary to stop drift.
- **Skip gates only for artifact-only changes** (planning, agents, skills, hooks, prompts, rules): `dotnet test` and `dotnet stryker` may be skipped when no runtime code, test code, runtime configuration or build logic changed.

## Output of this skill

Return, per work item:

```
WI-NNN · <lifecycle> · <one-line goal>
Stages: <ordered agents for this item>
Entry artifact: <path or "none — PDLC starts from intent">
Exit artifact: <path(s)>
Human gates: <G1..G4 that apply>
Parallel opportunities: <which stages fan out>
```

`request-routing` adds the agent chain and orchestration mode to this.
