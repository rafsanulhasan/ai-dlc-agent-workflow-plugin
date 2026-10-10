---
name: design-test-cases
description: Structured test case design skill for software projects. Takes an implementation (and acceptance criteria if available) and produces a complete test plan specifying what to test, how, and why — ready to hand off to the write-tests skill. Invoked by the sqa-engineer agent before any test code is written.
---

# Design Test Cases

You are executing the `design-test-cases` skill on behalf of **Kent Beck** (`sqa-engineer`). Your job is to produce a complete, grounded test plan artifact. The output of this skill is a test plan — not test code. Code is written by the `write-tests` skill.

> Agent names are the defaults; a name chosen at `/init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## Input

The calling agent will pass one of:
- A component or feature implementation to design tests for
- A requirements document or acceptance criteria
- A surviving mutant report from the stack's mutation tool (Stryker.NET for C# / .NET, StrykerJS for JS / TS)
- Any combination of the above

## Process

### Phase 0 — Context Load (silent, no user interaction)

Before designing anything:

1. Read `CLAUDE.md` to understand conventions and the `{ data, error }` return shape contract.
2. Invoke `Skill("manage-memory", args: "sqa-engineer")` to load prior knowledge about test patterns and recurring gaps in this codebase.
3. Read every public interface and method on the component under test — understand what each one promises.
4. If a requirements document or acceptance criteria were provided, read them fully. Map each AC to the method(s) that implement it.
5. If a surviving mutant report was provided, read it — each mutant is a gap in the existing test suite.
6. Locate the existing test projects with Glob. Read a sample of existing tests to understand naming conventions and fixture patterns.

---

### Phase 1 — Coverage Analysis

Analyze the component and identify every dimension that needs test coverage:

#### 1.1 Method inventory

For each public method or boundary operation, enumerate:

| Method | Happy path | Error paths | Edge cases | AC covered |
|--------|-----------|-------------|------------|------------|
| `MethodA` | valid inputs → expected result | dep throws, dep returns error | empty collection, null optional | AC-1, AC-3 |
| `MethodB` | ... | ... | ... | AC-2 |

Fill this table completely before moving on. A method with no row is untested by design — that is a decision, not an accident.

For each error path, note whether the failure can be produced for real. Only one that cannot may be faked, under the rules in `test-doubles`.

#### 1.2 Test type assignment

For each method, decide the test type:

- **Unit test**: the component runs with its real collaborators except owned I/O ports (repositories, gateways, clock / ID providers, publishers), which are doubled; no I/O, no pipeline (`test-doubles`)
- **Integration test**: component is exercised inside the real DI container or middleware pipeline; use only when behavior cannot be verified without the surrounding infrastructure

Justify every integration test — they are slower and harder to maintain. Default to unit tests.

Name the stack testing skill `write-tests` will load for each type, so the plan's fixture notes match the stack:

| Test type | C# / .NET | JS / TS |
|---|---|---|
| Unit | `csharp-unit-testing` | `ts-unit-testing` |
| Integration | `csharp-integration-testing` | `ts-integration-testing` |
| Architecture (structural rules) | `csharp-architecture-testing` | `ts-architecture-testing` |
| Coded E2E UI | `tunit-playwright-ui-testing` (Blazor components: `bunit-blazor-testing`) | `ts-playwright-ui-testing` |
| Mutation gap analysis | `csharp-mutation-testing` | `ts-mutation-testing` |

#### 1.3 Mutant gap analysis

If a surviving mutant report is provided, map each mutant to a missing test case:

- State the mutant (e.g., "changed `>` to `>=` on line 42")
- State the test case that would kill it (e.g., "input equal to the boundary value must return error")
- Add that test case to the relevant method row

---

### Phase 2 — Test Case Specification

For each row in the method inventory, write a formal test case specification:

```
## <MethodName>

### TC-01: <StateUnderTest> → <ExpectedBehavior>
- Type: Unit | Integration
- Arrange: <what to set up — inputs, mock behavior, initial state>
- Act: <what to call>
- Assert:
  - data: <expected value or null>
  - error: <expected error shape or null>
  - <any side-effect assertions: logger called, dependency invoked N times, etc.>
- AC: <AC-N if applicable, or "coverage gap" if not tied to an AC>

### TC-02: ...
```

Rules for specifications:

- Every method must have at least one TC for the happy path and one for the primary error path
- Every AC must be covered by at least one TC — mark it explicitly
- Edge cases must be specified as separate TCs, not lumped into the happy path
- `{ data, error }` assertions must appear in every TC — assert both fields, never just one
- Do not write test code here — this is a specification, not an implementation

---

### Phase 3 — Test Plan Output

Produce the complete **Test Plan** and present it to the user:

```
# Test Plan: <Component Name>

## Scope
- Component under test: <ClassName / IInterfaceName>
- File: <path/to/source/file>
- Stack: <C# / .NET | JS / TS> — stack testing skill(s): <from the table in 1.2>
- Test project: <path/to/test/project>

## AC Traceability

| AC | Test Cases |
|----|------------|
| AC-1 | TC-01, TC-04 |
| AC-2 | TC-02 |
| (gap) | TC-03 — no AC; covers <edge case> |

## Test Cases

<full TC specifications from Phase 2>

## Fixture Requirements

- Test doubles: <each double and its `test-doubles` category — unowned boundary, owned port (unit tests only), controlled non-determinism, or unproducible failure (name the failure and why it cannot be produced for real)>
- Integration test infrastructure: <in-process test host, containers, etc. — only if integration tests are planned>
- Shared setup: <anything that belongs in a shared fixture or setup hook>

## Implementation Notes for write-tests

- Naming convention observed in existing tests: <pattern>
- Test double library in use: <the framework's mocks / hand-rolled / etc.>
- Any tricky setup the implementer should know about
```

After presenting the plan, ask the user to confirm or request changes. Do not hand off to `write-tests` until the plan is confirmed.

---

## Quality Gate

Do not present the test plan until:

- [ ] Every public method on the component has at least one TC
- [ ] Every AC has at least one TC with explicit traceability
- [ ] Every surviving mutant (if provided) maps to a new TC
- [ ] Every TC specifies assertions for both `data` and `error` fields
- [ ] Test type (unit vs. integration) is stated and justified for every TC
- [ ] No test code appears in the plan — this is specification only

## Output

Return the complete Test Plan from Phase 3, preceded by a one-line summary:

> **Test Plan for**: [component name] — [one sentence on scope and test strategy]
