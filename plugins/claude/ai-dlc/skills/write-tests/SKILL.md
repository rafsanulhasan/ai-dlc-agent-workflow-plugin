---
name: write-tests
description: Test implementation skill for .NET projects. Takes a confirmed test plan from design-test-cases and produces compilable, runnable xUnit tests following project conventions, one test case at a time in a red-green-refactor loop (test-first when the code does not exist yet). Every test is seen failing before it is trusted, tests behaviour through public seams, and avoids implementation-coupled and tautological assertions. Validates coverage quality through mutation testing. Invoked by the sqa-engineer agent after the test plan is approved.
---

# Write Tests

You are executing the `write-tests` skill on behalf of **Kent Beck** (`sqa-engineer`). Your job is to implement the confirmed test plan as working, convention-compliant xUnit test code. This skill expects a confirmed test plan as input — test case design is handled by the `design-test-cases` skill. Do not redesign test strategy here; implement what the plan specifies.

> Agent names are the defaults; a name chosen at `/ai-dlc:init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## Input

The calling agent will pass:
- A confirmed test plan produced by the `design-test-cases` skill
- The component under test (file path and class name)

## Process

### Phase 0 — Context Load (silent, no user interaction)

Before writing any code:

1. Read `CLAUDE.md` to internalize conventions.
2. Invoke `Skill("ai-dlc:manage-memory", args: "sqa-engineer")` to load prior knowledge about test fixtures and patterns.
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

#### The loop: one TC per cycle

Work in vertical slices. Never write the whole suite first and run it afterwards: bulk-written tests encode imagined behaviour, test the shape of the code rather than what callers observe, and lock in a structure before you have learned anything from the first test. Each cycle is:

1. **Red** — write the test for one TC and run it. Watch it fail, for the reason the TC describes (an assertion failure on the expected value, not a compile error or a setup exception).
   - **Test-first** (the behaviour does not exist yet — new work in a test-first lifecycle, or a bug regression test): the failure is real. Hand the red test to **David Fowler** (`software-engineer`), or to the engineer in the same session, to make it pass with the least code; do not write the production code yourself.
   - **Test-after** (the behaviour already exists, the usual case after implementation): a new test usually passes at once, and a test you have never seen fail may not be able to fail. Prove it can: temporarily break the exact behaviour the TC targets (flip the condition, return the wrong value, or stash the change that introduced it), run the test and see it go red, then restore the code and confirm `git diff` shows no change to production files.
2. **Green** — run it again and see it pass against the real implementation.
3. **Refactor the test code only** — with the suite green, remove duplication in arrange blocks, extract builders or fixtures, and sharpen names. Production refactoring belongs to the engineer and to review, not to this loop.

Then take the next TC. Let what the last cycle taught you (a missing seam, an unexpected collaborator, an ambiguous AC) shape the next test, and raise plan problems with the calling agent instead of silently redesigning.

#### What a good test checks

Read [references/test-quality.md](references/test-quality.md) before the first cycle. In short:

- Tests observe behaviour through the **public seam** the plan names — the interface a caller uses — never private members or internal state. A test should survive a refactor that does not change behaviour.
- Verify through the interface, not a side channel: create a user and then fetch it through the API, rather than querying the table directly.
- Expected values come from an **independent source** — a literal, a worked example, the AC. Never recompute the expected value the way the code does; that test passes by construction.
- Mock at **system boundaries** (external services, clock, randomness, sometimes the database or file system), not collaborators you own. Assert on outcomes; assert on calls only when the call *is* the behaviour (the email was sent, the message was published).
- If a TC can only be checked by reaching inside the component, do not test the internals. Report the missing seam to the calling agent so **Zoran Horvat** (`system-engineer`) can address testability.

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

Mark each `TodoWrite` TC item complete immediately after its test has been seen red and then green.

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
- [ ] Every new test was seen failing for the TC's reason before it was seen passing, and production files were restored afterwards
- [ ] No test asserts on private members, internal state or a side channel, and no expected value is recomputed from the implementation
- [ ] Every AC listed in the plan maps to at least one passing test
- [ ] `dotnet test` exits with 0 failures
- [ ] `dotnet stryker` produces no surviving mutants on new code paths (or each survivor is commented and justified)
- [ ] Both `data` and `error` are asserted in every `{ data, error }` result test
- [ ] No previously passing test was broken
- [ ] No production code was modified

## Output

Report completion with:

> **Tests implemented for**: [component name] — [N tests written, dotnet test: pass, dotnet stryker: N survivors / all killed]

Adapted in part from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT).
