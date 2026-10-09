---
name: review
description: "Structured code review workflow for software projects. Use to assess branch/PR/file changes and produce severity-ranked findings."
---

# Review

> Agent names are the defaults; a name chosen at `/ai-dlc:init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

# Operating Methodology

You review code in five phases. Complete each phase fully before advancing. Never modify production code — describe findings so **David Fowler** (`software-engineer`) can act on them.

---

## Phase 0 — Context Load (silent, no user interaction)

Before reviewing any code:

1. Read `CLAUDE.md` to internalize all conventions: explicit type declarations, `await using` disposal, `{ data, error }` return shape, no stack trace exposure, logger module.
2. Identify the review scope from the argument:
   - **PR number**: run `gh pr diff <number>` to get the full diff
   - **Branch name**: run `git diff main...<branch>` to get all changes vs main
   - **Commit range**: run `git diff <sha1>..<sha2>`
   - **File list**: read each named file directly
3. For each changed file, read the full file — not just the diff lines — to understand surrounding context.
4. Check `docs/architecture/decisions/` for any ADRs that constrain the changed components.

---

## Phase 1 — Correctness Review

For every changed file, check:

### Bugs and Logic Errors

- [ ] Are there null-reference paths that are not guarded?
- [ ] Are conditional branches correct and complete? Check inverted conditions and off-by-one errors.
- [ ] Are async operations awaited everywhere they must be?
- [ ] Are exceptions caught at the correct boundary and not swallowed silently?
- [ ] Does any code path allow a stack trace to reach the client response body?

### Return Shape

- [ ] All boundary-crossing operations return `{ data, error }` — no raw `throw` across component lines
- [ ] Both `data` and `error` sides are populated correctly: success sets `data`, non-null `error` means failure
- [ ] No operation returns `{ data: null, error: null }` — one must always be set

### Async and Disposal

- [ ] Disposable resources use `await using`, not `using`
- [ ] No `async void` methods except event handlers
- [ ] No `.Result` or `.Wait()` calls that could deadlock

---

## Phase 2 — Convention Review

For every changed file, check:

### Type Declarations

- [ ] Explicit types on left-hand side: `FileStream stream = new();` not `var stream = new FileStream()`
  - Exception allowed: `Stream stream = new FileStream()` (base/interface type on left)
  - Exception allowed: `IEnumerable<T> items = new List<T>()` (interface on left, concrete on right)

### Dependency Injection

- [ ] All dependencies are constructor-injected abstractions — no `new ConcreteService()` inside components
- [ ] No captive dependencies: scoped services not injected into singletons
- [ ] Logger is `ILogger<T>` injected via DI — no `Console.Write*` calls

### Comments

- [ ] No comments that describe *what* code does — well-named identifiers handle that
- [ ] Comments present only where the *why* is non-obvious: hidden constraints, workarounds, subtle invariants
- [ ] No commented-out code blocks

---

## Phase 3 — Test Coverage Review

1. For every new public method or changed logical branch, check whether a corresponding test exists.
2. Run `dotnet build` to confirm the code compiles:
   ```
   dotnet build
   ```
3. Run `dotnet test` to confirm the test suite passes:
   ```
   dotnet test
   ```
4. Identify any new logic paths not covered by the existing test suite and flag them as **Warning** items for **Kent Beck** (`sqa-engineer`).

---

## Phase 4 — Design and Architecture Review

For structural changes (new classes, new interfaces, new middleware, new DI registrations):

- [ ] Does the component stay within its stated responsibility? (SRP)
- [ ] Are abstractions introduced only where variation is certain, not speculative? (YAGNI)
- [ ] Does the component depend on abstractions, not concretions? (DIP)
- [ ] Is there a simpler design that achieves the same result without premature abstraction?
- [ ] Are interface contracts stable — would a consumer need to change if the implementation changes?

If structural concerns require an ADR or architectural decision, note them as **Blocker** items and flag for **Mark Richards** (`software-architect`).

---

## Phase 5 — Findings Report

Produce a findings report in this format:

```
## Code Review: <branch / PR / file list>

### Summary
<1–3 sentence overview: what changed and overall assessment>

### Blockers (must fix before merge)
- **[file:line]** <description of the issue and what must change>

### Warnings (should fix)
- **[file:line]** <description of the issue and recommended change>

### Suggestions (optional)
- **[file:line]** <description of the improvement>

### Coverage Gaps (hand to sqa-engineer)
- <component / method> — <what logic path lacks test coverage>

### Verdict
[ ] Approved — no blockers, warnings addressed or accepted
[ ] Changes requested — blockers must be resolved before re-review
```

Use `TodoWrite` to create a task for each Blocker and Warning so the software-engineer can track them.

---

## Quality Gate

Do not produce the findings report until:

- [ ] Every changed file has been fully read (not just the diff)
- [ ] `dotnet build` exits with 0 errors
- [ ] `dotnet test` exits with 0 failures
- [ ] Every finding names a specific file path and line number
- [ ] The verdict is explicit: Approved or Changes Requested
- [ ] No Blocker is left undocumented
