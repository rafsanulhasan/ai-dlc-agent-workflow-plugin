---
name: requirement-analysis
description: "Structured requirement elicitation for software projects. Use before architecture or implementation when scope is new, vague, or ambiguous, or when a plan, idea or design needs to be grilled and stress-tested. Runs a relentless one-question-at-a-time interview (each question with a recommended answer) until no decision is left assumed, sharpens the domain language into the project glossary as terms settle, and flags ADR-worthy decisions for the architect."
---

# Requirement Analysis

> Agent names are the defaults; a name chosen at `/init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## Operating Methodology

You elicit requirements in four stages. Complete each stage fully before advancing to the next. Enter planning mode before starting Stage 1. Every question you ask follows the **Interview Loop** below, and every term you hear goes through **Domain Language** below.

---

### Stage 0 — Context Load (silent, no user interaction)

Before asking the user anything:

1. Read `CLAUDE.md` and any `docs/` files to understand current architecture constraints.
2. Grep for existing implementations related to the requested feature (avoid asking what the code can tell you).
3. Check `docs/architecture/decisions/` for ADRs that constrain the solution space. Do not re-open a recorded decision unless the user raises it.
4. Read the project glossary if one exists (see [references/glossary-format.md](references/glossary-format.md) for where to look). Its terms are the vocabulary for the whole session.
5. Note what is already built vs. what is missing — this shapes your questions.

---

### Stage 1 — Goal Clarification

Establish the *why* before the *what*. Ask:

- What problem does this solve for the user of the API or the developer consuming it?
- What is the definition of success — how will you know this feature is working as intended?

Do not ask about implementation details yet.

---

### Stage 2 — Functional Requirements

Identify what the system must *do*. Probe for:

- **Happy path**: what is the primary flow from trigger to outcome?
- **Edge cases**: what inputs or states should be handled explicitly?
- **Integrations**: which existing middlewares, filters, or services does this touch?
- **Exclusions**: what is explicitly out of scope for this feature?

---

### Stage 3 — Non-Functional Requirements

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

## Interview Loop

Elicitation is a relentless interview, not a questionnaire. Keep going until you and the user share one understanding of the feature, with nothing silently assumed. There is no question quota per stage: a stage is finished when its branches are settled, not when you have asked a set number of questions.

### Map the decisions as a tree

Every decision the user makes opens the decisions that depend on it ("Do refunds go back to the original payment method?" only matters once "Are partial refunds allowed?" is settled). Keep this tree in your plan as you go.

The **frontier** is the set of open decisions whose prerequisites are already settled. Only frontier questions are askable. A question whose answer depends on another open question waits until that one is answered.

### Ask one question at a time

Pick the frontier question that unblocks the most of the tree and ask only that one. Shape it like this:

```
**Q<n> — <short title>**
<the question, with the options if there are several, and what each would mean>

Recommended: <your answer and the one-line reason>
```

- Always give a recommended answer. Word the question so that "yes" accepts it.
- Wait for the answer. Then update the tree: settled decisions push the frontier outward and may open new questions or close others.

### Facts are yours; decisions are the user's

Never ask the user for a fact you can find yourself: how the code currently behaves, which version a library is on, what an ADR says. Look it up (Grep, Read), or for external or wide-ranging facts brief **Jon Skeet** (`research-assistant`). While a lookup is pending, only the questions that depend on it wait; keep asking the rest of the frontier.

Decisions (scope, priority, behaviour, trade-offs) belong to the user. Put each one to them, recommend an answer, and wait.

### Stop when the frontier is empty

The interview is done when every branch has been visited and every remaining decision is either answered or explicitly parked as an Open Question. Before writing the Requirements Document, summarise the settled decisions in a few lines and ask the user to confirm that this is a shared understanding. Do not produce the document until they confirm.

---

## Domain Language

Sharpen the project's vocabulary while you interview. Requirements written in fuzzy words produce designs built on fuzzy concepts.

- **Challenge conflicts with the glossary.** If the user uses a term differently from the glossary, say so at once: "The glossary defines *cancellation* as ending the whole order, but you seem to mean removing one line. Which is it?"
- **Sharpen overloaded words.** When a word could mean two things, propose a precise term: "By *account* do you mean the Subscriber or the login User? They behave differently."
- **Probe with concrete scenarios.** When the user describes how concepts relate, invent specific edge cases that force a precise answer about where one concept ends and the next begins.
- **Check claims against the code.** When the user says how something works today, verify it. Surface contradictions: "The code cancels whole orders only, but you said partial cancellation already exists. Which is right?"
- **Capture each term as it settles.** Keep a running term list in your plan. After `ExitPlanMode`, write the settled terms into the project glossary using [references/glossary-format.md](references/glossary-format.md), creating the file if this is the first term. Domain terms only; no implementation detail.

### Spot ADR candidates

When a decision is hard to reverse, would surprise a future reader without context, and came from a real trade-off between alternatives, note it as an **ADR candidate**. You do not write ADRs; list them in the handoff so **Mark Richards** (`software-architect`) can record them with `write-adr`. Skip decisions that miss any of the three tests.

---

## Output Standards

When all four stages are complete and the user has confirmed the shared understanding, produce a **Requirements Document** using this structure. Write it as a planning artifact (you are in plan mode):

```
# Requirements: <Feature Name>

## Problem Statement
One paragraph. What pain does this solve and for whom?

## Goals
- Bulleted list of outcomes, not implementation steps.

## Glossary
- **<Term>**: <one-sentence definition>. Avoid: <rejected synonyms>.
(only domain terms settled or sharpened in this session; these are written to the project glossary after plan mode)

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
- ADR candidates: decisions settled here that pass all three ADR tests, with the alternatives the user rejected.
- Existing components that will be affected (with file paths if known).
- Suggested starting point for the architecture-design skill.
```

After presenting the document, call `ExitPlanMode`, write the Glossary entries into the project glossary, and summarize in one sentence what the software-architect should focus on first.

---

## Quality Gate

Do not exit planning mode until:

- every FR has at least one corresponding AC. If an AC cannot be written, the requirement is not yet specific enough — go back and ask one more clarifying question;
- every domain term used in an FR or AC is either in the project glossary or in the document's Glossary section, with one meaning;
- the decision tree's frontier is empty and the user has confirmed the shared understanding.

Adapted in part from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT).
