---
name: ai-dlc
description: "AI-DLC lifecycle router and operating model. Defines the full AI-DLC lifecycle — idea to release through every gate (Plan → G1 → Architect & Design → G2 → Breakdown → G3 → Build · Test · Review → G4 → Release) — the default for feature work, plus eight named lifecycles that are its segments (PDLC, ASDLC, STBLC, FDLC) or focused entry points (BFLC, RLC, TLC, CRLC). Use FIRST for any non-trivial request to pick which lifecycle applies, which agents own each stage, which artifact each stage must hand off, which gates a human must approve, and which upstream agents a stage consults when an input is unclear (the Clarify loop). The orchestrator's request-routing skill chooses each work item's lifecycle from this catalogue (unless the user named one), and the orchestrator follows it to run each stage."
---

# AI-DLC — Lifecycle Router

AI-DLC moves the unit of delegation from a line of code to a **phase of the lifecycle**. A team of role-scoped agents owns the lifecycle end to end; the human sets intent, approves gate crossings and resolves ambiguity — reviewing **artifacts**, not every line of code.

> Agent names are the defaults; a name chosen at `/init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

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

In Claude Code every agent id is prefixed `ai-dlc:` (for example `software-engineer`).

`DW ↔ BC` on a lifecycle means: every document that lifecycle produces is written by DW (or the owning agent) and critiqued by BC **in parallel** before the gate is crossed.

## Phase ownership

| Phase | Owner | Artifact handed to the next phase |
|---|---|---|
| Plan | PO | User stories with numbered acceptance criteria |
| Architect | SA | Specs + ADRs |
| Design | SDE | Low-level design (modules, patterns, DI plan) |
| Build | SWE | Implementation diff, green build and tests (the project's commands, recorded in `AGENTS.md` at init) |
| Test | SQA | Test suite, AC-traceability table, mutation report |
| Review | CR | Severity-ranked findings report (Blocker / Warning / Suggestion) |
| Release | PO (go / no-go) + `product-manager` (checklist) + OPS | Release notes, release gate checklist, published package |

## The AI-DLC lifecycle — the full lifecycle

**AI-DLC** is the primary lifecycle: one run takes a feature from intent to release through every gate. The eight named lifecycles below are its segments (PDLC, ASDLC, STBLC, FDLC) or focused entry points (BFLC, RLC, TLC, CRLC).

| # | Stage | Segment | Owner(s) | Exit artifact | Gate |
|---|---|---|---|---|---|
| 1 | Plan | PDLC | PO | Brief, stories with numbered ACs | **G1** |
| 2 | Architect & Design | ASDLC | SA + SDE | ADRs, frozen spec, architecture narrative | **G2** |
| 3 | Breakdown | STBLC | SA + SDE + SWE, PO orders | Task plan | **G3** |
| 4 | Build · Test · Review | FDLC, once per task or wave of tasks | SWE, SQA, SA, CR | Code, tests, docs, review report with zero Blockers | **G4** |
| 5 | Release | Release phase | `product-manager` checklist → PO go / no-go → OPS CD | Release notes, published package | go / no-go |

- Every stage boundary is crossed with `handoff`, every document gets DW ↔ BC, and the Clarify loop applies across the whole run.
- **Exit artifact:** a released (or release-ready) feature traceable from brief → stories / ACs → ADRs / spec → tasks → code / tests / docs → review report → release notes.
- **Entry rule:** enter at the **earliest missing artifact** and run to the end. A feature that already has stories enters at Architect & Design; one with a frozen spec enters at Breakdown. The run does not stop after one segment unless the human says so at a gate.
- **Execution:** an AI-DLC run is executed as `request-routing` Mode 4, *Full lifecycle traversal*.

## Step 1 — Classify into one lifecycle

The `orchestrator` picks exactly one primary lifecycle per work item and runs the stages. A new feature, epic or idea with no named workflow is **AI-DLC**. Pick a segment lifecycle on its own only when the user explicitly limits scope ("only design it", "just write the stories") or the item is one segment of an AI-DLC run that `product-manager` split into separate work items. Bugs, refactors, test gaps and PR reviews take a focused lifecycle; one that turns out to need new behaviour forks an AI-DLC item.

| # | Lifecycle | Kind | Pick it when… | Agents | Exit artifact |
|---|---|---|---|---|---|
| 0 | **AI-DLC** · Full lifecycle | Primary | A feature, epic or idea must go from intent to release (the default for feature work) | All stage owners below, plus PO, `product-manager` and OPS for Release · DW ↔ BC | Released (or release-ready) feature, traceable brief → release notes |
| 1 | **PDLC** · Product Design | AI-DLC segment | The input is a vague idea, epic or business goal | PO · DW ↔ BC | Feature list, use-case diagrams, user stories with numbered ACs in `docs/product/` and `docs/backlog/backlog.md` |
| 2 | **ASDLC** · Architecture & Design | AI-DLC segment | Stories exist but no agreed design / spec | PO ↔ SA ↔ SDE ↔ RA · DW ↔ BC | ADRs in `docs/architecture/decisions/` plus a **frozen** `docs/specs/<slug>.spec.md` per story, co-owned by SA and SDE |
| 3 | **STBLC** · Story & Task Breakdown | AI-DLC segment | A frozen spec exists but no task plan | PO ↔ SA ↔ SDE ↔ SWE · DW ↔ BC | `docs/plans/<slug>.tasks.md`: estimated, dependency-ordered tasks, each with its own technical Definition of Done |
| 4 | **FDLC** · Feature Development | AI-DLC segment | Tasks exist and code must land | SA + SDE ↔ SWE ↔ SQA ↔ CR · DW ↔ BC | Merged-ready change: code, tests, docs, review report with zero Blockers |
| 5 | **BFLC** · Bug Fixing | Focused | Incorrect behaviour, failing test, regression | SA ↔ SDE ↔ SWE ↔ SQA ↔ CR ↔ RA · DW ↔ BC | Root cause statement, minimal fix, a regression test that **failed before and passes after** |
| 6 | **RLC** · Refactoring | Focused | Structure must change, behaviour must not | SA ↔ SDE ↔ SWE ↔ SQA ↔ CR ↔ RA | Refactor diff, unchanged public behaviour, mutation score **not lower** than baseline |
| 7 | **TLC** · Testing | Focused | Existing code lacks coverage, AC traceability or mutation strength | PO ↔ SA ↔ SDE ↔ SWE ↔ SQA ↔ CR · DW ↔ BC | Test plan, new tests, AC-traceability table, mutation report |
| 8 | **CRLC** · Code Review | Focused | An open change / PR must be driven to merge-ready | PO ↔ CR ↔ SWE ↔ SQA | Findings report; CR approves **only at zero Blockers** |

Shortcuts:

- Agent/skill/hook/rule/command changes are **not** a lifecycle — route straight to `agent-manager`.
- P0 security issues: BFLC with `security-review` run by SA/CR before the fix lands; notify PO afterwards.
- Pure questions: answer, or delegate to `research-assistant`; no lifecycle.
- Releases: Release phase — `product-manager` runs its release-gate checklist, `product-owner` gives go / no-go, then `devops-engineer` runs CD.

## Step 2 — Run the lifecycle's stages

### AI-DLC
Run the segment stages below in order, gate by gate: PDLC → G1 → ASDLC → G2 → STBLC → G3 → FDLC (once per task or wave of tasks) → G4 → Release (`product-manager` checklist → `product-owner` go / no-go → `devops-engineer` CD). Start at the earliest missing artifact. Re-anchor on the frozen spec at every boundary after G2.

### PDLC
1. `product-owner` writes the product brief (`docs/product/<slug>/brief.md`: outcomes, features, use cases) and returns a delegation list.
2. `requirement-analyst` → `Skill("requirement-analysis")`: one question at a time until every story has testable, numbered ACs.
3. `product-manager` → `Skill("product-planning", args: "add-item …")`: backlog entries with the priority the product owner decided.
4. `product-owner` accepts the stories and backlog (or sends them back); BC critiques the brief and stories. **Gate G1 — Clarify:** human approves the stories and ACs.

### ASDLC
1. `software-architect` → `Skill("architecture-design")` (RA in parallel for any external fact). Each consequential decision → `Skill("write-adr")`.
2. `system-engineer` → `Skill("system-design")` against the architecture.
3. `requirement-analyst` → `Skill("spec-driven-development")`: SA and SDE co-sign the spec; it is then **frozen** (status `Frozen`). Changes after freezing go back through this step.
4. `software-architect` → `Skill("architecture-narrative")`: the three-act story (problem → constraints and trade-offs → design, ADRs, risks) at `docs/architecture/narratives/<slug>.md`, written for the human who approves G2.
5. BC critiques the ADRs, spec and narrative. **Gate G2 — Refine / Align:** human approves the frozen spec, reading the narrative first.

### STBLC
1. SA + SDE split the spec into tasks; SWE estimates and flags unknowns; PO orders by priority.
2. Each task records: id, AC references, dependencies, estimate, technical DoD.
3. **Gate G3:** human approves the task plan (may be delegated to ORC for small plans).

### FDLC — the build loop
1. SWE → `Skill("implement-feature")`: every behaviour traces to a numbered AC; anything outside the spec goes back to ASDLC.
2. In parallel after SWE: SQA (`design-test-cases` → `write-tests` → the stack's mutation-testing skill: `csharp-mutation-testing` or `ts-mutation-testing`), DW (`write-documentation`), BC on the docs.
3. SA → `Skill("architecture-review")` — **Architecture Conformance** gate.
4. CR → `Skill("review")` — **Code Audit & Refinement** loop: Blockers return to SWE (or SQA for test code) until zero remain.
5. **Gate G4 — approve:** human signs off the review report, not the diff.

### BFLC
1. SWE → `Skill("fix-bug")` Phase 1 only: root cause with file:line. RA if external behaviour is involved; SA if the cause is architectural.
2. SQA writes the regression test **first** and shows it failing.
3. SWE applies the minimal fix; the regression test passes; full suite green.
4. CR reviews. DW updates docs if behaviour visible to users changed.

### RLC
1. SQA captures a mutation baseline (the stack's mutation-testing skill, baseline mode) **before** any change.
2. SA/SDE define the target structure (and any ADR); SWE refactors in small steps with tests green after each.
3. SQA re-runs mutation testing — the score must not regress; CR confirms no behaviour change.

### TLC
1. PO and SA identify the ACs and risk areas; SQA → `design-test-cases` with an AC-traceability table.
2. SQA → `write-tests` and the stack's mutation-testing skill; SWE only touches production code if a test reveals a bug (which forks a BFLC item).
3. CR reviews test quality.

### CRLC
1. CR → `Skill("review")` on the PR/branch (plus SonarQube where configured).
2. Blockers loop to SWE / SQA; PO resolves scope disputes.
3. CR approves at **zero Blockers**; ORC verifies and reports.

## Step 3 — Gates, verification and the human

- **Every handoff is an artifact.** Cross a stage boundary only with `Skill("handoff")`, which records the artifact paths and the verification result in `docs/handoffs/`.
- **Trust, but verify.** The orchestrator reads the artifact before the next agent starts. An agent's summary is a claim, not evidence.
- **Hard gates beat confidence.** Build and tests must be green before Build ends (`init` installs the stack's Stop hook that enforces the test command: `dotnet-test-gate` in .NET repositories, `node-test-gate` in JS / TS repositories); mutation testing is the SQA's gate.
- **Ask upstream, then the human.** When an input is unclear, the stage agent consults the agents that produced it (*Clarify loop* below). Intent, scope or AC questions that no upstream agent can answer go to the human as one targeted question. Never let an agent guess.
- **Re-anchor long runs** on the frozen spec at each stage boundary to stop drift.
- **Skip gates only for artifact-only changes** (planning, agents, skills, hooks, prompts, rules): the test and mutation commands may be skipped when no runtime code, test code, runtime configuration or build logic changed.

## Clarify loop — consult upstream

Every handoff follows one rule: a stage agent that finds something unclear in its inputs **asks the agents that produced them**, rather than guessing or deciding outside its role. `product-owner` answering `software-architect` and `system-engineer` is one row of the matrix below, not a separate loop.

### Consultation matrix

Each stage may consult the agents that produced its inputs, on the topics listed.

| Asker | Name | Consults → about |
|---|---|---|
| `product-owner` | James Montemagno | `product-manager` → release-gate checklist status before go / no-go. Everything else is intent: the human, through the orchestrator |
| `requirement-analyst` | James Montemagno | `product-owner` → brief, scope, priority, intended behaviour; `software-architect` and `system-engineer` → test seams, boundaries and data shapes while drafting the spec they co-sign |
| `product-manager` | James Montemagno | `product-owner` → scope, priority, milestone and release decisions; `requirement-analyst` → stories and ACs being sliced into work items |
| `software-architect` | Mark Richards | `product-owner` → intended behaviour, scope, priority; `requirement-analyst` → story and AC wording, NFRs; at Architecture Conformance, `software-engineer` and `system-engineer` → intent behind the diff and the design |
| `system-engineer` | Zoran Horvat | `software-architect` → architecture, boundaries, ADR intent, and **every decision that would change the architecture** (escalated, never made); `product-owner` → intended behaviour; `requirement-analyst` → AC wording |
| `software-engineer` | David Fowler | `software-architect` → architecture, boundaries, ADR intent; `system-engineer` → low-level design, patterns, UI design, interfaces; `requirement-analyst` → the meaning of an AC in the spec |
| `sqa-engineer` | Kent Beck | `software-engineer` → implementation details and the test cases the change implies; `product-owner` → acceptance criteria and intended behaviour; `system-engineer` → system design and test-case design (seams, interfaces); `software-architect` → architecture testing (layer and dependency rules, NFRs) |
| `documentation-writer` | Daniele Procida | `software-engineer` → behaviour and public API of the change; `software-architect` → ADRs and architecture intent |
| `code-reviewer` | Robert C. Martin (Uncle Bob) | `sqa-engineer` → test intent, coverage, mutation results; `software-engineer` → implementation intent, trade-offs; `requirement-analyst` → the meaning of an AC on the spec axis |
| `devops-engineer` | Gene Kim | `product-manager` → release-gate checklist, version, release scope; `sqa-engineer` → test and mutation gate results; `product-owner` → conditions attached to the go / no-go |
| `brutal-critique` | Linus Torvalds | Consults no one. Questions for the author go into the critique (Blockers or Unverified claims); the orchestrator routes them |

The same agents **answer** questions about their own artifacts and **own any revision** the answer causes: `product-owner` (brief, scope, priority, go / no-go), `requirement-analyst` (stories, ACs, spec), `product-manager` (backlog, work items, release checklist), `software-architect` (architecture, ADRs, NFRs), `system-engineer` (low-level design, interfaces, seams), `software-engineer` (implementation), `sqa-engineer` (test plan, tests, mutation report).

### How a round runs

1. **Raise.** The asker raises questions while verifying the incoming handoff (`handoff`, *Receiving a handoff*) or as soon as a gap appears mid-stage, and keeps doing any work the questions do not block.
2. **Return a clarification request** to the orchestrator: every open question in one batch, each naming the target upstream agent, the artifact or AC it refers to, and a recommended default. Format and relay mechanics: `agent-invocation`, *Clarification requests*. Subagents cannot spawn subagents; if the session's main agent is itself a stage agent, it consults the upstream agent directly with the same format.
3. **Relay.** The orchestrator sends each question to its target — `SendMessage` to the instance that produced the artifact when it is still available, otherwise a fresh brief — and returns the answers to the asker with `SendMessage`, which resumes the stage.
4. **Pass up or to the human.** An upstream agent that cannot answer passes the question along its own row (for example `system-engineer` → `product-owner`) within the same round. A question about the human's intent that no agent can answer goes to the human.
5. **Record.** The asker lists every question and answer in the *Clarifications* section of its stage's handoff record.

### Rules

- **Ask, don't guess.** A recommended default is a proposal for the answerer; never proceed on it unanswered.
- **Batch.** One request per round carries every open question; no drip-feeding.
- **The owner revises.** An answer that changes an upstream artifact (spec, AC, ADR, design, test plan) is made by that artifact's owner, never by the asker; the orchestrator verifies the revision before resuming the asker.
- **ACs change only through the product line.** An answer that changes an AC goes through `product-owner`, who directs `requirement-analyst` to update the spec with `spec-driven-development`; a frozen spec re-enters ASDLC step 3.
- **Stay in role.** An answer never licenses the asker to do the upstream agent's job.
- **Bounded: at most 3 rounds per stage.** A round is one batched request and its answers. If a question is still open after the third round, the stage is **blocked**: the orchestrator stops it and escalates to the human with the open questions, the answers so far and the recommended defaults.

## Output of this skill

Return, per work item:

```
WI-NNN · <lifecycle: AI-DLC | PDLC | … | CRLC> · <one-line goal>
Stages: <ordered agents for this item>
Entry artifact: <path or "none — starts from intent at Plan">
Exit artifact: <path(s)>
Human gates: <G1..G4 that apply; AI-DLC adds the release go / no-go>
Parallel opportunities: <which stages fan out>
```

`request-routing` adds the agent chain and orchestration mode to this.
