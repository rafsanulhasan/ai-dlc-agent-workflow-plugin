---
description: "Guided architectural design session for AI-DLC Agent Workflow. Takes a requirements document (from /requirement-analysis) or a user-stated problem and produces a full Architecture Design Document with component diagrams, interface contracts, integration points, and an ADR."
---

# Operating Methodology

You design the architecture in five phases. Complete each phase fully before advancing. Enter planning mode at the start.

---

## Phase 0 — Context Load (silent, no user interaction)

Before asking the user anything:

1. Read `CLAUDE.md` to internalize conventions: Middlewares, DI, Endpoint/Result Filters, `{ data, error }` return shape, `await using` disposal, explicit type declarations.
2. Glob the solution structure to understand existing layers and project boundaries.
3. Read any `docs/architecture/` files and existing ADRs in `docs/architecture/decisions/` to avoid contradicting prior decisions.
4. If a requirements document was passed as an argument (file path or inline text), parse it fully — especially Functional Requirements, Constraints, and Handoff Notes.
5. Grep for existing components likely touched by the new design (middleware registrations, filter interfaces, DI registrations, result types).

---

## Phase 1 — Requirements Confirmation (1–3 questions)

Confirm you have enough to design. Ask only what the requirements document did not answer:

- If no requirements document was provided: what problem does this design solve, and what are the top three functional requirements?
- Are there hard constraints on the design (must reuse specific libraries, must not break existing endpoints, must fit within a specific layer)?
- Are there performance, security, or reliability targets the design must meet?

Do not ask about implementation preferences — those are decided during design, not here.

---

## Phase 2 — Options Exploration (silent, then present)

Identify two to three architectural approaches that could satisfy the requirements. For each option, assess:

- **Alignment with existing architecture** (does it fit the middleware/filter/DI pillars?)
- **Complexity vs. benefit tradeoff**
- **Testability and DI compatibility**
- **Impact on existing components** (what changes, what stays)

Present the options concisely to the user with explicit tradeoffs. Ask the user to select one (or to confirm your recommended option). Do not proceed to Phase 3 until the option is chosen.

---

## Phase 3 — Detailed Design (silent)

Design the chosen option in full depth across the following dimensions:

### 3.1 Component Decomposition

- Identify each new component: name, type (middleware, filter, service, handler, repository, etc.), and single responsibility.
- Specify what each component does and explicitly what it does NOT do.
- Define the lifetime of each component (singleton / scoped / transient) and justify it.

### 3.2 Interface Contracts

- Define every public interface with method signatures, parameter types, and return types.
- Return shapes must be `{ data, error }` across all boundary-crossing operations.
- Use discriminated unions or result monads for error modeling — no exception-based control flow across boundaries.

### 3.3 Data Flow and Integration Points

- Trace the primary flow end-to-end through the middleware/filter pipeline.
- Identify where new components plug into existing ones.
- Specify what data enters and exits each component at every integration point.

### 3.4 Dependency Graph

- List all dependencies each new component takes via DI.
- Verify no captive dependency risks (shorter-lived injected into longer-lived).
- Confirm all dependencies are abstractions, not concretions (DIP).

### 3.5 Error Propagation

- Trace every error path from origin to the `{ data, error }` boundary.
- Confirm no stack trace can escape to the client.
- Identify where errors must be logged vs. simply returned.

### 3.6 DI Registration Plan

- State how each new component is registered in the DI container (extension method, `AddScoped`, etc.).
- Identify the registration order where it matters (e.g., middleware pipeline sequence).

### 3.7 Testability Plan

- Confirm every component can be unit-tested with injected mocks.
- Identify integration test boundaries (where real infrastructure is needed).
- Note any state or behavior that requires a dedicated test fixture.

---

## Phase 4 — Architecture Design Document (output)

Produce an **Architecture Design Document** in planning mode:

```
# Architecture Design: <Feature or System Name>

## Problem Statement
One paragraph restating the problem this design solves.

## Selected Approach
Name the chosen option and one sentence on why it was selected over the alternatives.

## Component Overview

| Component | Type | Lifetime | Responsibility |
|-----------|------|----------|----------------|
| <Name> | Middleware / Filter / Service / ... | Singleton / Scoped / Transient | <one line> |

## Interface Contracts

### I<ComponentName>
```csharp
// Concrete, compilable C# following project conventions
public interface IFoo
{
    Task<Result<Bar, Error>> DoSomethingAsync(Request request, CancellationToken ct);
}
```

(Repeat for each new interface.)

## Primary Data Flow

1. Request enters at <entry point>.
2. <Component A> receives it and does <X>, producing <Y>.
3. <Component B> receives <Y> and does <Z>.
4. Response exits as `{ data, error }` from <exit point>.

(Diagram in ASCII or Mermaid if the flow is non-trivial.)

## Dependency Graph

- <ComponentA> ← IComponentB, IComponentC (scoped)
- <ComponentB> ← IRepository (scoped), ILogger<ComponentB> (singleton)
- (Flag any captive dependency risks inline)

## Error Propagation Map

- <Error origin> → wrapped in `Result<T, Error>` → returned to <caller> → logged at <severity> → surfaced as `{ data: null, error: <shape> }`

## DI Registration

```csharp
// Extension method or Program.cs snippet — concrete and compilable
services.AddScoped<IFoo, Foo>();
services.AddScoped<IBar, Bar>();
```

## Testability Notes

- <Component> — mock <IDependency> to test <behavior>
- Integration boundary at <point> — requires <fixture or test db>

## Alternatives Considered

### Option A: <Name>

- **Tradeoff**: <why not chosen>

### Option B: <Name>

- **Tradeoff**: <why not chosen>

## Architectural Decision Record (ADR)

**ADR-XXX: <Decision Title>**

- **Status**: Proposed
- **Context**: <why a decision was needed>
- **Decision**: <what was decided>
- **Consequences**: <what becomes easier, harder, or constrained by this decision>

## Open Questions

- Items that must be resolved before or during implementation.

## Implementation Handoff Notes

- Suggested implementation order (which component to build first).
- Files to create or modify (with paths).
- Risks or tricky spots the implementer should know about.

```

After presenting the document, call `ExitPlanMode` and state in one sentence which component the implementer should build first and why.

---

## Quality Gate

Do not exit planning mode until:
- Every interface uses the `{ data, error }` return shape at boundaries.
- Every component has a stated lifetime with justification.
- No captive dependency exists in the dependency graph.
- At least one AC from the requirements document is traceable through the data flow.
- The ADR is present and has Status, Context, Decision, and Consequences filled in.
