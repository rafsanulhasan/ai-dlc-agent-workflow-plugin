---
description: "Structured architectural review of the AI-DLC Agent Workflow codebase or a specific subsystem. Evaluates component boundaries, coupling, layering, and adherence to the project's architectural constraints. Produces a findings report with prioritized recommendations."
---

# Operating Methodology

You perform an architectural review in four phases. Complete each phase fully before advancing. Enter planning mode at the start.

---

## Phase 0 — Context Load (silent, no user interaction)

Before asking the user anything:

1. Read `CLAUDE.md` to internalize project conventions, architecture pillars (Middlewares, DI, Endpoint/Result Filters), and return-shape rules (`{ data, error }`).
2. Glob the solution structure: identify projects, layers, and their dependencies (`*.csproj`, `*.sln`).
3. Read any `docs/architecture/` files and ADRs under `docs/architecture/decisions/` to understand prior decisions.
4. Grep for the core abstractions: middleware registrations, filter interfaces, DI registrations, and the `{ data, error }` result type.
5. Determine the scope of the review: whole solution or a subsystem named by the user (if any argument was passed to the command).

---

## Phase 1 — Scope Agreement (1–2 questions)

Confirm what to review and what success looks like:

- Is the review scoped to a specific layer, subsystem, or feature — or the full solution?
- What is the primary concern driving this review (e.g., coupling, testability, performance boundaries, security surface)?

Accept the answers and do not ask further scoping questions.

---

## Phase 2 — Analysis (silent)

Perform the full architectural inspection against the following dimensions. Record every finding with its location (file path and line range).

### 2.1 Layering and Dependency Direction

- Are dependencies flowing in the correct direction (outer layers depend on inner; inner layers do not reference outer)?
- Do any projects or namespaces violate the expected layer hierarchy?
- Are there circular dependencies between projects or assemblies?

### 2.2 Component Boundaries and Cohesion

- Does each component (middleware, filter, service, handler) have a single, clearly stated responsibility?
- Are responsibilities leaking across boundaries (e.g., business logic in middleware, persistence logic in filters)?
- Are components reused where they should be, and isolated where they should not bleed?

### 2.3 Coupling and Abstractions

- Are high-level modules depending on abstractions, not concretions (DIP)?
- Are there concrete type dependencies that should be interfaces?
- Are there over-engineered abstractions with only one implementation (YAGNI)?

### 2.4 Return Shape Compliance

- Do all components that cross a boundary return `{ data, error }`?
- Are exceptions used for control flow at any boundary? (Flag as critical.)
- Can a stack trace leak to the client from any code path?

### 2.5 Middleware and Filter Pipeline

- Is the middleware registration order correct and documented?
- Are filters applied at the right scope (endpoint vs. global)?
- Are there cross-cutting concerns (auth, logging, validation) handled inconsistently across the pipeline?

### 2.6 Dependency Injection

- Are all dependencies registered with the correct lifetime (singleton, scoped, transient)?
- Are there captive dependency risks (shorter-lived services injected into longer-lived ones)?
- Are any services resolved from the root container outside of a valid scope?

### 2.7 Testability

- Can each component be tested in isolation (all dependencies injectable and mockable)?
- Are there static calls, `new` expressions on concrete types, or ambient state that block unit testing?

### 2.8 Observability

- Is the logger used consistently (not `Console.Write` or `Debug.WriteLine`)?
- Are structured log messages used with appropriate severity levels?
- Are operations traceable across middleware boundaries?

---

## Phase 3 — Findings Report (output)

Produce an **Architecture Review Report** in planning mode using this structure:

```
# Architecture Review: <Scope>

## Executive Summary
Two to four sentences. Overall health, most critical finding, and recommended priority.

## Findings

### Critical (must fix before next release)
ARCH-C1: <component/file> — <violation> — <consequence if not fixed>
...

### Major (should fix in next sprint)
ARCH-M1: <component/file> — <violation> — <consequence>
...

### Minor (technical debt to schedule)
ARCH-N1: <component/file> — <observation> — <recommended improvement>
...

## Architectural Strengths
- What is working well and should be preserved.

## Recommended Refactors

### <Refactor Title>
- **Problem**: <what is wrong>
- **Solution**: <what to change, with before/after code sketch if helpful>
- **Files affected**: <list of paths>
- **Effort**: XS / S / M / L

## Dependency Map Anomalies
List any unexpected or inverted dependencies found (project A → project B when it should be the reverse).

## Open Questions
Questions that require business or team input before architectural decisions can be made.

## Handoff Notes for Architecture Design
If any finding warrants a new architectural design session, state it here with a suggested scope for /architecture-design.
```

After presenting the report, call `ExitPlanMode` and state in one sentence which Critical finding to address first.

---

## Quality Gate

Do not exit planning mode until:

- Every Critical finding has a specific file path and a stated consequence.
- Every recommended refactor has an effort estimate.
- The executive summary is accurate given the findings listed.
