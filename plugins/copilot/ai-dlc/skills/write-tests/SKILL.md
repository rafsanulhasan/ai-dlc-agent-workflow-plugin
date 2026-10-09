---
name: write-tests
description: Test implementation skill for .NET projects. Takes a confirmed test plan from design-test-cases and produces compilable, runnable xUnit tests following project conventions. Validates coverage quality through mutation testing. Invoked by the sqa-engineer agent after the test plan is approved.
---

# Write Tests

You are executing the `write-tests` skill on behalf of **Kent Beck** (`sqa-engineer`). Your job is to implement the confirmed test plan as working, convention-compliant xUnit test code. This skill expects a confirmed test plan as input — test case design is handled by the `design-test-cases` skill. Do not redesign test strategy here; implement what the plan specifies.

> Agent names are the defaults; a name chosen at `/init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## Input

The calling agent will pass:
- A confirmed test plan produced by the `design-test-cases` skill
- The component under test (file path and class name)

## Process

### Phase 0 — Context Load (silent, no user interaction)

Before writing any code:

1. Read `CLAUDE.md` to internalize conventions.
2. Invoke `Skill("manage-memory", args: "sqa-engineer")` to load prior knowledge about test fixtures and patterns.
3. Read the confirmed test plan in full — every TC specification is a work item.
4. Locate the test project using Glob. Read several existing test files to internalize:
   - Test framework (xUnit)
   - Assertion library in use
   - Test double approach (NSubstitute, hand-rolled, etc.)
   - Naming convention
   - Fixture and setup patterns (`IClassFixture`, constructors, `[ClassFixture]`)
5. Add every TC from the plan as a `TodoWrite` item before writing a single line of code.

---

### Phase 1 — Test Implementation

Implement each TC from the confirmed plan in order. For every test file written:

#### Structure

Use Arrange / Act / Assert in every test method:

```csharp
[Fact]
public async Task MethodName_StateUnderTest_ExpectedBehavior()
{
    // Arrange
    ...

    // Act
    ResultType result = await sut.MethodNameAsync(input, ct);

    // Assert
    ...
}
```

#### Naming

Three-part names that read as a specification: `MethodName_StateUnderTest_ExpectedBehavior`

- `Validate_WhenAuthHeaderIsMissing_ReturnsErrorResult`
- `Dispatch_WhenHandlerSucceeds_ReturnsPopulatedData`
- `Process_WhenTokenIsCancelled_ThrowsOperationCanceledException`

#### Convention checklist (apply to every test file)

- [ ] Explicit type declarations: `MyService sut = new(mockDep);` not `var sut = ...`
- [ ] `await using` for any disposable test fixtures
- [ ] Assert **both** `data` and `error` fields for every `{ data, error }` result — never assert only one side
- [ ] Each `[Fact]` tests exactly one behavior from the TC specification
- [ ] Use `[Theory]` with `[InlineData]` or `[MemberData]` for parameterized edge cases listed in the plan
- [ ] No `Thread.Sleep` or arbitrary delays — use `CancellationToken` properly
- [ ] Mock only the dependencies the TC exercises — minimal mock configuration
- [ ] Never mock the system under test itself
- [ ] No shared mutable state between test cases

#### Integration tests

For TCs marked as integration type in the plan:

- Use `WebApplicationFactory<T>` or an in-memory `IHost`
- Register test doubles in the test host's DI — do not modify production registrations
- Each test must leave shared infrastructure in a clean state

Mark each `TodoWrite` TC item complete immediately after its test is written and compiling.

---

### Phase 2 — Run and Verify

```shell
dotnet test
```

- All new tests must pass
- No previously passing test may fail — a test that breaks existing tests is itself a defect; report it to **David Fowler** (`software-engineer`) rather than modifying production code
- If a test fails because the implementation has a bug: stop, report the bug to the software-engineer, do not modify production code yourself
- If a test fails because the test setup is wrong: fix the test setup only

---

### Phase 3 — Mutation Testing

```shell
dotnet stryker
```

For each surviving mutant in code covered by the new tests:

1. Map the mutant back to the TC that should have caught it
2. Strengthen or add a test case that produces observably different output when the mutation is present
3. Re-run `dotnet stryker` to confirm the mutant is killed

Acceptable reasons to leave a mutant alive (add a comment in the test file):

- The mutant is in logging-only code with no observable output difference
- The code path is architecturally unreachable without breaking DI or middleware contracts

Do not mark work complete with unresolved surviving mutants unless each one is explicitly justified.

---

## Quality Gate

Do not mark the test suite complete until:

- [ ] Every TC from the confirmed plan has a corresponding test method
- [ ] Every AC listed in the plan maps to at least one passing test
- [ ] `dotnet test` exits with 0 failures
- [ ] `dotnet stryker` produces no surviving mutants on new code paths (or each survivor is commented and justified)
- [ ] Both `data` and `error` are asserted in every `{ data, error }` result test
- [ ] No previously passing test was broken
- [ ] No production code was modified

## Output

Report completion with:

> **Tests implemented for**: [component name] — [N tests written, dotnet test: pass, dotnet stryker: N survivors / all killed]
