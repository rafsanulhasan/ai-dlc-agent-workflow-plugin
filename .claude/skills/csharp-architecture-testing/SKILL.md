---
name: csharp-architecture-testing
description: Comprehensive guidance for writing C# architecture tests using NetArchTest.Rules, TUnit, and TUnit.Assertions.Should to enforce layer dependencies, namespace rules, and naming conventions
---

# C# Architecture Testing

You are the **C# Architecture Testing** skill for the AI-DLC Agent Workflow project.

This skill provides comprehensive guidance for writing architecture tests that enforce structural rules — layer isolation, namespace conventions, naming patterns, and interface contracts — using the NetArchTest.Rules fluent API within the TUnit testing framework.

---

## Phase 0 — Context Load (silent)

1. Read `.claude/CLAUDE.md` and `.claude/rules/testing.md` to understand project conventions and quality gates
2. Invoke `Skill("manage-memory", args: "sqa-engineer")` to load the SQA engineer's persistent memory
3. Read relevant architecture documentation or existing ArchitectureTests.cs files to understand current architectural constraints

---

## Phase 1 — Architecture Testing Stack

**Package**: `NetArchTest.Rules` (NuGet)  
Provides a fluent API — `Types.InAssembly(...).That()...Should()...` — for asserting structural rules over .NET assemblies.

**Test Framework**: TUnit  
Same framework as all other tests in this project. Use `[TestClass]` and `[Test]` attributes.

**Assertions**: TUnit.Assertions.Should  
Use `ArchRuleResult.IsSuccessful` + TUnit.Assertions.Should to assert the result. On failure, include `FailingTypeNames` in the assertion message.

**NuGet**: `NetArchTest.Rules` (latest stable). No other special packages needed.

---

## Phase 2 — Core Patterns

Each pattern is documented in a separate template file. Review the pattern that matches your architectural rule:

### 1. Loading an Assembly — [arch-load-assembly](templates/arch-load-assembly.md)

Use `Types.InAssembly(typeof(SomeTypeFromAssembly).Assembly)` to target an assembly.  
For solution-wide rules, load multiple assemblies and chain `.And()`.

### 2. Layer Dependency Rule — [arch-layer-dependency](templates/arch-layer-dependency.md)

Example: "Domain layer must not depend on Infrastructure layer."

Pattern: `.That().ResideInNamespace("AiDlcAgentWorkflow.Domain").ShouldNot().HaveDependencyOn("AiDlcAgentWorkflow.Infrastructure")`

### 3. Namespace Residency Rule — [arch-namespace-residency](templates/arch-namespace-residency.md)

Example: "All middleware classes must reside in the Middlewares namespace."

Pattern: `.That().HaveNameEndingWith("Middleware").Should().ResideInNamespace("AiDlcAgentWorkflow.Middlewares")`

### 4. Naming Convention Rule — [arch-naming-convention](templates/arch-naming-convention.md)

Example: "All interface types must start with 'I'."

Pattern: `.That().AreInterfaces().Should().HaveNameStartingWith("I")`

### 5. Inheritance / Interface Implementation Rule — [arch-inheritance-rule](templates/arch-inheritance-rule.md)

Example: "All request handlers must implement IRequestHandler."

Pattern: `.That().ResideInNamespace("...Handlers").Should().ImplementInterface(typeof(IRequestHandler<,>))`

### 6. Asserting Results — [arch-assert-result](templates/arch-assert-result.md)

Always capture `TestResult result = rule.GetResult();`  
Assert `result.IsSuccessful` with a message that includes `string.Join(", ", result.FailingTypes.Select(t => t.FullName ?? t.Name))` so failures are visible.  
Use `Assert.Multiple()` to collect all architecture rule failures in one test run.

---

## Phase 3 — Complete Example

See [arch-complete-example](templates/arch-complete-example.md) for a complete test class enforcing AI-DLC Agent Workflow architecture rules. It demonstrates:

- A `[TestClass]` with 4 test methods, one per rule category
- Loading the AI-DLC Agent Workflow assembly via `typeof(SomeKnownType).Assembly`
- At least one dependency rule, one namespace rule, one naming rule, and one multi-rule assertion
- Using `Assert.Multiple()` to collect failures
- Using TUnit.Assertions.Should for the final assertion

---

## Phase 4 — Key Takeaways

1. **Use `NetArchTest.Rules`** — fluent API, no extra dependencies.
2. **Load assemblies via `typeof(KnownType).Assembly`** — never hardcode paths.
3. **Always call `.GetResult()` and check `IsSuccessful`** — include `FailingTypeNames` in the failure message for debuggability.
4. **Wrap all assertions in `Assert.Multiple()`** — see all violations at once instead of stopping at the first failure.
5. **One test per architectural rule** — keeps failures targeted and understandable.
6. **Architecture tests belong in the existing test project** — no separate project needed.
7. **These tests run with `dotnet test`** like any other test — they are part of your regular CI/CD quality gates.

---

## When to Use This Skill

Invoke this skill whenever you are writing tests that enforce structural rules rather than behavior:

- Layer isolation (domain should not reference infrastructure)
- Namespace conventions (all handlers must live in a specific namespace)
- Naming patterns (all interfaces must start with 'I', all exceptions must end with 'Exception')
- Interface contracts (all request handlers must implement a specific interface)
- Dependency direction (presentation layer should not depend on persistence)

These tests run as part of `dotnet test` and are enforced just like unit and integration tests.
