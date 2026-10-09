---
name: architecture-review
description: Structured architectural review skill for the AI-DLC Agent Workflow project. Use when reviewing implemented code for architectural integrity, design flaws, convention compliance, and long-term risk. Invoked by the software-architect agent after implementation is complete.
---

# Architecture Review

You are executing the `architecture-review` skill on behalf of the software-architect agent. Your job is to produce a complete, grounded architectural review of the code or changes provided.

## Input

The calling agent will pass one of:
- A description of recently implemented or modified code
- A list of changed files or a diff to review
- A specific architectural concern to investigate

## Process

### Step 1 — Scope the Review

Focus on what changed, not the entire codebase. Use **Glob** and **Read** to locate changed files, then **Grep** to trace how new components are wired into the existing system.

### Step 2 — Apply the Review Framework

Evaluate each dimension systematically:

1. **Separation of Concerns** — Are responsibilities cleanly divided? Does each component have a single, well-defined purpose?
2. **Coupling and Cohesion** — Is the design loosely coupled and highly cohesive? Are dependencies flowing in the right direction?
3. **Extensibility** — Can the system accommodate foreseeable changes without major restructuring?
4. **Reliability** — Are there single points of failure? Is error handling sound? Does the `{ data, error }` return shape propagate correctly through all paths?
5. **Security Boundaries** — Are sensitive operations properly isolated? Are there information leakage risks in the API surface?
6. **Testability** — Is the architecture designed to support unit, integration, and mutation testing (`dotnet stryker`)?
7. **Scalability** — Only flag when realistic load increases would degrade this design.

### Step 3 — Check Convention Compliance

Verify adherence to project conventions:
- Explicit type declarations with target-typed new expressions or collection expressions
- Async disposal preferred over sync disposal (`await using`)
- Return shape is always `{ data, error }`
- No stack traces exposed to clients
- Logger module used, not console output
- DI-registered services — no hidden `new` for dependencies

### Step 4 — Produce the Review

Structure your output as:

---

**Verdict**: `APPROVED` / `APPROVED WITH CONCERNS` / `REQUIRES REVISION`

**Design Flaws** *(if any)*
List issues that have architectural impact — not just code style. For each:
- Severity: `CRITICAL` (blocks design) / `MAJOR` (significant risk) / `MINOR` (improvement opportunity)
- Description: What the flaw is and why it matters structurally
- Location: Specific file, class, or method

**Recommended Improvements**
Concrete, actionable changes with rationale. Never vague — e.g., not "consider better abstractions" but "extract X responsibility into a dedicated Y service because Z".

**Scalability / Reliability Concerns** *(only if applicable at realistic scale)*

**Convention Compliance**
List any violations. If compliant, state "All project conventions followed."

**Positive Observations**
What was done well architecturally. Always include at least one — this builds institutional knowledge.

---

### Step 5 — Finalize

Before returning:
- Every flaw must have a concrete recommended improvement
- Severity labels must be applied consistently — CRITICAL only when the design cannot proceed as-is
- If verdict is REQUIRES REVISION, the recommended improvements must be sufficient to resolve all CRITICAL and MAJOR flaws
