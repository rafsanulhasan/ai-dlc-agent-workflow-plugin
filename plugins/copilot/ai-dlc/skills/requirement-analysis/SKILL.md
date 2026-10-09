---
name: requirement-analysis
description: "Structured requirement elicitation for software projects. Use before architecture or implementation when scope is new, vague, or ambiguous."
---

# Requirement Analysis

> Agent names are the defaults; a name chosen at `/init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## Operating Methodology

You elicit requirements in four stages. Complete each stage fully before advancing to the next. Enter planning mode before starting Stage 1.

---

### Stage 0 — Context Load (silent, no user interaction)

Before asking the user anything:

1. Read `CLAUDE.md` and any `docs/` files to understand current architecture constraints.
2. Grep for existing implementations related to the requested feature (avoid asking what the code can tell you).
3. Check `docs/architecture/decisions/` for ADRs that constrain the solution space.
4. Note what is already built vs. what is missing — this shapes your questions.

---

### Stage 1 — Goal Clarification (1–2 questions)

Establish the *why* before the *what*. Ask:

- What problem does this solve for the user of the API or the developer consuming it?
- What is the definition of success — how will you know this feature is working as intended?

Do not ask about implementation details yet. Accept the user's answers and move to Stage 2.

---

### Stage 2 — Functional Requirements (2–4 questions)

Identify what the system must *do*. Probe for:

- **Happy path**: what is the primary flow from trigger to outcome?
- **Edge cases**: what inputs or states should be handled explicitly?
- **Integrations**: which existing middlewares, filters, or services does this touch?
- **Exclusions**: what is explicitly out of scope for this feature?

Ask one question at a time. Wait for each answer before continuing.

---

### Stage 3 — Non-Functional Requirements (1–3 questions)

Identify quality attributes. Only ask about dimensions relevant to the feature — do not enumerate every possible NFR. Common relevant ones for this project:

- **Performance**: latency budget, throughput expectations, caching allowed?
- **Security**: authentication required, authorization model, data sensitivity?
- **Reliability**: failure modes, retry behavior, partial failure handling?
- **Observability**: what must be logged, traced, or metered?
- **Compatibility**: language/runtime version, existing framework or DI constraints, breaking change tolerance?

---

### Stage 4 — Constraints and Acceptance Criteria

Ask:

- Are there hard constraints (deadline, must reuse existing library, must not break existing endpoints)?
- Who will verify this is done — and how will they test it?

Use the answers to draft acceptance criteria (see Output Standards below).

---

## Output Standards

When all four stages are complete, produce a **Requirements Document** using this structure. Write it as a planning artifact (you are in plan mode):

```
# Requirements: <Feature Name>

## Problem Statement
One paragraph. What pain does this solve and for whom?

## Goals
- Bulleted list of outcomes, not implementation steps.

## Functional Requirements
FR-1: <verb phrase describing a system behavior>
FR-2: ...
(number each; tester must be able to verify each one independently)

## Non-Functional Requirements
NFR-1: <quality attribute> — <measurable target or constraint>
NFR-2: ...

## Out of Scope
- Explicitly descoped items to prevent scope creep.

## Constraints
- Hard technical or business constraints that bound the design space.

## Acceptance Criteria
AC-1: Given <precondition>, when <action>, then <verifiable outcome>.
AC-2: ...
(one AC per FR minimum; written in Given/When/Then)

## Open Questions
- Questions that could not be answered during elicitation and must be resolved before or during design.

## Handoff Notes for Software Architect
- Key decisions the architect must make.
- Existing components that will be affected (with file paths if known).
- Suggested starting point for the architecture-design skill.
```

After presenting the document, call `ExitPlanMode` and summarize in one sentence what **Mark Richards** (`software-architect`) should focus on first.

---

## Quality Gate

Do not exit planning mode until every FR has at least one corresponding AC. If an AC cannot be written, the requirement is not yet specific enough — go back and ask one more clarifying question.
