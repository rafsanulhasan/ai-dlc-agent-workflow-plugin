---
name: implement-feature
description: "Structured feature implementation workflow for software projects. Use when architecture/system design is ready and code must be implemented safely, from a design, spec or work item, in small verified steps (test-first when failing tests are supplied), without overbuilding: reuse what the repository has, keep scope strict and stop when acceptance passes. Also covers behaviour-preserving refactors, reversible schema/data/API/config migrations, and writing the commit message."
---

# Implement Feature

> Agent names are the defaults; a name chosen at `/init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

# Operating Methodology

You implement features in six phases. Complete each phase fully before advancing. Use `TodoWrite` to track your implementation steps.

---

## Phase 0 — Context Load (silent, no user interaction)

Before writing any code:

1. Read `CLAUDE.md`, `AGENTS.md` and the stack's coding rules under `.claude/rules/` (installed by `dotnet-rules` or `node-rules`) to internalize all conventions — `{ data, error }` return shape, no stack trace exposure, logger module, plus the stack's own (for C#: explicit type declarations, `await using` disposal) — and the project's build / test / mutation commands.
2. Invoke `Skill("manage-memory", args: "software-engineer")` to load any prior institutional knowledge about this codebase area.
3. If an architecture design document or system design output was provided as an argument, read it fully — especially Interface Contracts, DI Registration Plan, and Implementation Handoff Notes.
4. Glob the solution structure to understand project boundaries and locate files to create or modify.
5. Read the specific files that will be touched — understand existing patterns before adding new ones.
6. Check `docs/architecture/decisions/` for any ADRs constraining this feature.
7. If the brief names a work item, spec or handoff record, open it and restate its ID, title and acceptance criteria in one short block before planning. If the reference is ambiguous or does not resolve, ask instead of guessing which item is meant.
8. Note which failing tests, if any, came with the brief — they decide whether Phase 2 runs test-first.

---

## Phase 1 — Implementation Plan (confirm before coding)

Break the feature into atomic, independently buildable steps. Present the plan using `TodoWrite`:

- Each step must correspond to a single class, interface, or registration — not a vague "implement layer"
- Order steps so each one compiles standalone: define interfaces first, then implementations, then DI registrations, then integration points
- Flag any ambiguity in the architecture design that must be resolved before coding begins

### Scope, reuse and stop condition

Overbuilding is the usual failure of feature work. Put three short lists at the top of the plan:

- **Reuse** — the existing modules, helpers, extension points and patterns this feature will build on. Search for them before planning anything new; a second implementation of behaviour the repository already has is a defect, not a feature. If the fitting seam needs reshaping to take the feature cleanly, plan that as a refactor step (below) rather than patching around it.
- **Non-goals** — what this work item will *not* do: extra modes, providers, options, configuration, extensibility hooks and polish that no acceptance criterion asks for. A new dependency, public surface, service, configuration key or migration is added only when the design or an acceptance criterion requires it, and the plan states the trade-off in one line.
- **Stop condition** — the observable check that ends the work, normally "every acceptance criterion restated in Phase 0 passes, through the real entry point". When it is met, stop; do not add unrequested cleanup or improvements. Material omissions go in the handoff, each with the trigger that would justify building it later.

Still deliver a coherent path through every layer that owns part of the behaviour. "Small" means no speculative scope, not cramming the feature into one file or bypassing the layers the design assigns.

### Refactor and migration steps

- A step that restructures existing code without changing behaviour follows [references/refactoring.md](references/refactoring.md): the same proof runs green **before and after** the structural edit, and no feature change rides along.
- A step that changes a schema, stored data, an API or message contract, a configuration format or a behaviour-changing dependency follows [references/migrations.md](references/migrations.md): forward and rollback paths, mixed-version safety, rollback proof, and no destructive step unless separately approved.

Ask the user to confirm the plan or clarify ambiguities. Do not write code until the plan is confirmed.

---

## Phase 2 — Implementation

Implement each step in the confirmed plan. For every file written or edited:

### Test-first when failing tests are supplied

If the brief includes failing tests from **Kent Beck** (`sqa-engineer`) — a test-first lifecycle, or acceptance tests written ahead of the code — implement in red → green slices: take one failing test, write the least code that makes it pass, re-run it, then take the next. Do not write code that no current test or plan step asks for. Tidy up only while the suite is green. Ownership does not change: if a slice has no test, note the gap for the SQA engineer rather than writing the test yourself.

### Tight feedback after every step

Do not wait for Phase 3 to find out a step is broken. After each step:

- build (or type-check) the affected project;
- run the narrowest tests that cover the changed code — one test file or a name filter, not the whole suite.

A failure caught at the step that caused it is a one-line fix; the same failure found after ten steps is an investigation. The full suite runs once, in Phase 4.

### Convention Checklist (apply to every file)

- [ ] **Stack conventions**: the coding rules installed under `.claude/rules/` (`dotnet-rules` or `node-rules`). For C#:
  - **Explicit type declarations**: `FileStream stream = new();` not `var stream = new FileStream()`
    - Exception: `Stream stream = new FileStream()` (interface/base type on left)
    - Exception: `IEnumerable<int> items = new List<int>()` (interface on left, concrete on right)
  - **Async disposal**: `await using ResourceType resource = new();` not `using`
- [ ] **Return shape**: all boundary-crossing operations return `{ data, error }` — use `Result<T, Error>` or equivalent discriminated union; no `throw` across boundaries
- [ ] **No stack trace exposure**: catch at the outermost boundary, log the exception internally, return a sanitized `{ data: null, error: <message> }` to the caller
- [ ] **Logger, not console**: use the project logger, injected (C#: `ILogger<T>` via DI); never call `Console.Write*` or `console.log`
- [ ] **DI compatibility**: all dependencies are injected abstractions; no `new ConcreteService()` inside components
- [ ] **Lifetime correctness**: verify no captive dependencies (scoped injected into singleton, etc.)
- [ ] **Functional patterns**: use the project's result / discriminated-union types (C#: `LanguageExt.Core` monads or `OneOf`) where they reduce null-check noise and improve pipeline composability
- [ ] **No speculative code**: implement exactly what the design specifies — no extra overloads, no future-proofing layers

After implementing each step, mark its `TodoWrite` task complete before moving to the next.

---

## Phase 3 — Build

Run the project's build command (recorded in `AGENTS.md` at init; for example `dotnet build`, or `npm run build` / `tsc --noEmit` for TypeScript).

If build fails:
- Fix every error before continuing — do not proceed to test with a broken build
- Re-run the build after fixes to confirm clean output
- If an error reveals a design ambiguity, note it and ask the user before guessing

---

## Phase 4 — Test

Run the project's test command (for example `dotnet test` or `npm test`).

If tests fail:
- Read each failing test to understand what contract it verifies
- Fix the implementation (not the test) unless the test is demonstrably wrong
- Never delete or skip a test to make the suite pass
- Re-run the tests after fixes to confirm all tests pass

If no tests exist for the new code, note the gap — test design and implementation are the SQA engineer's responsibility. Do not write tests yourself.

---

## Phase 5 — Mutation Testing

Run the project's mutation command (for example `dotnet stryker` or `npx stryker run`; the stack's mutation-testing skill — `csharp-mutation-testing` or `ts-mutation-testing` — covers setup and triage).

For each surviving mutant:

- If the mutant exposes dead code: remove the dead code
- If the mutant exposes an untested logic path: record it and hand the surviving mutant report to the SQA engineer — do not write tests yourself
- Do not suppress mutants without justification

---

## Phase 6 — Commit

Stage only the files changed for this feature. Write the message by [references/commit-messages.md](references/commit-messages.md): the repository's own convention first, otherwise Conventional Commits; the subject states the intent, the body (when needed) states why rather than what. Refactor and migration steps get their own commits, typed and bodied as that reference describes.

Example (Conventional Commits):
```
git add <specific files>
git commit -m "feat(validation): reject requests that fail schema constraints" -m "Handlers assumed validated input; checking before dispatch keeps that assumption true for every endpoint."
```

Do not self-approve. The stage ends with a handoff record (`Skill("handoff")`) listing the changed files, the work item's acceptance criteria and the build and test results; review by **Robert C. Martin** (`code-reviewer`) follows in the lifecycle and checks the change against both the project's standards and the spec.

---

## Quality Gate

Do not mark the feature complete until:

- [ ] The build command exits with 0 errors
- [ ] The test command exits with 0 failures
- [ ] The mutation run produces no surviving mutants on new logic (or each survivor is justified in a comment)
- [ ] Every new interface and public method follows the `{ data, error }` return shape
- [ ] No stack traces can escape to a client
- [ ] All conventions from the checklist in Phase 2 are satisfied
- [ ] Every acceptance criterion restated in Phase 0 is implemented, and nothing outside them was added
- [ ] When failing tests were supplied, each one now passes, and none was changed to make it pass without the SQA engineer agreeing the test was wrong
- [ ] Nothing on the plan's non-goals list was built, and every new dependency, surface or configuration key is justified in the plan
- [ ] Each refactor step has a green run of the same proof before and after the edit; each migration step has a proven rollback and stopped at the requested stage

Adapted in part from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT).
Adapted in part from [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) (Apache-2.0); modified.
