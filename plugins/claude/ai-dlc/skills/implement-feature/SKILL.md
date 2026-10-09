---
name: implement-feature
description: "Structured feature implementation workflow for software projects. Use when architecture/system design is ready and code must be implemented safely."
---

# Implement Feature

# Operating Methodology

You implement features in six phases. Complete each phase fully before advancing. Use `TodoWrite` to track your implementation steps.

---

## Phase 0 — Context Load (silent, no user interaction)

Before writing any code:

1. Read `CLAUDE.md` to internalize all conventions: explicit type declarations, `await using` disposal, `{ data, error }` return shape, no stack trace exposure, logger module.
2. Invoke `Skill("ai-dlc:manage-memory", args: "software-engineer")` to load any prior institutional knowledge about this codebase area.
3. If an architecture design document or system design output was provided as an argument, read it fully — especially Interface Contracts, DI Registration Plan, and Implementation Handoff Notes.
4. Glob the solution structure to understand project boundaries and locate files to create or modify.
5. Read the specific files that will be touched — understand existing patterns before adding new ones.
6. Check `docs/architecture/decisions/` for any ADRs constraining this feature.

---

## Phase 1 — Implementation Plan (confirm before coding)

Break the feature into atomic, independently buildable steps. Present the plan using `TodoWrite`:

- Each step must correspond to a single class, interface, or registration — not a vague "implement layer"
- Order steps so each one compiles standalone: define interfaces first, then implementations, then DI registrations, then integration points
- Flag any ambiguity in the architecture design that must be resolved before coding begins

Ask the user to confirm the plan or clarify ambiguities. Do not write code until the plan is confirmed.

---

## Phase 2 — Implementation

Implement each step in the confirmed plan. For every file written or edited:

### Convention Checklist (apply to every file)

- [ ] **Explicit type declarations**: `FileStream stream = new();` not `var stream = new FileStream()`
  - Exception: `Stream stream = new FileStream()` (interface/base type on left)
  - Exception: `IEnumerable<int> items = new List<int>()` (interface on left, concrete on right)
- [ ] **Async disposal**: `await using ResourceType resource = new();` not `using`
- [ ] **Return shape**: all boundary-crossing operations return `{ data, error }` — use `Result<T, Error>` or equivalent discriminated union; no `throw` across boundaries
- [ ] **No stack trace exposure**: catch at the outermost boundary, log the exception internally, return a sanitized `{ data: null, error: <message> }` to the caller
- [ ] **Logger, not console**: inject `ILogger<T>` via DI; never call `Console.Write*`
- [ ] **DI compatibility**: all dependencies are constructor-injected abstractions; no `new ConcreteService()` inside components
- [ ] **Lifetime correctness**: verify no captive dependencies (scoped injected into singleton, etc.)
- [ ] **Functional patterns**: use `LanguageExt.Core` monads or `OneOf` discriminated unions where they reduce null-check noise and improve pipeline composability
- [ ] **No speculative code**: implement exactly what the design specifies — no extra overloads, no future-proofing layers

After implementing each step, mark its `TodoWrite` task complete before moving to the next.

---

## Phase 3 — Build

Run:

```
dotnet build
```

If build fails:
- Fix every error before continuing — do not proceed to test with a broken build
- Re-run `dotnet build` after fixes to confirm clean output
- If an error reveals a design ambiguity, note it and ask the user before guessing

---

## Phase 4 — Test

Run:

```
dotnet test
```

If tests fail:
- Read each failing test to understand what contract it verifies
- Fix the implementation (not the test) unless the test is demonstrably wrong
- Never delete or skip a test to make the suite pass
- Re-run `dotnet test` after fixes to confirm all tests pass

If no tests exist for the new code, note the gap — test design and implementation are the SQA engineer's responsibility. Do not write tests yourself.

---

## Phase 5 — Mutation Testing

Run:

```
dotnet stryker
```

For each surviving mutant:

- If the mutant exposes dead code: remove the dead code
- If the mutant exposes an untested logic path: record it and hand the surviving mutant report to the SQA engineer — do not write tests yourself
- Do not suppress mutants without justification

---

## Phase 6 — Commit

Stage only the files changed for this feature. Commit with a message that:

- Starts with a verb: "Add", "Implement", "Refactor", "Fix"
- Names the component: "Add IRequestValidator middleware"
- States the why if non-obvious: "...to enforce schema constraints before handler dispatch"

Example:
```
git add <specific files>
git commit -m "Add IRequestValidator middleware to enforce schema constraints before handler dispatch"
```

---

## Quality Gate

Do not mark the feature complete until:

- [ ] `dotnet build` exits with 0 errors
- [ ] `dotnet test` exits with 0 failures
- [ ] `dotnet stryker` produces no surviving mutants on new logic (or each survivor is justified in a comment)
- [ ] Every new interface and public method follows the `{ data, error }` return shape
- [ ] No stack traces can escape to a client
- [ ] All conventions from the checklist in Phase 2 are satisfied
