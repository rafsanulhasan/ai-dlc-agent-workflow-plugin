---
name: ts-unit-testing
description: Comprehensive guidance for writing unit tests in JavaScript/TypeScript projects (Node, TypeScript, plain JavaScript) using Vitest (or Jest when the repository already uses it), @faker-js/faker builders, vi.fn / vi.mock for the test doubles the test-doubles skill allows, and @total-typescript/shoehorn for type-safe partial test data instead of `as` casts, with project conventions
---

# ts-unit-testing

This skill sets out how to write JavaScript and TypeScript unit tests in the project, on behalf of **Kent Beck** (`sqa-engineer`). The standard stack is:

- **Vitest** as the test framework and runner. Use **Jest** instead when the repository already uses it.
- **`vi.fn` / `vi.mock`** for the test doubles `test-doubles` allows.
- **@faker-js/faker** builders for test data.
- **@total-typescript/shoehorn** for type-safe partial objects in place of `as` casts.

It also reinforces project conventions such as the `{ data, error }` return shape and seeing every failure at once.

> Agent names are the defaults; a name chosen at `/init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

The loop and the quality bar (red first, public seams, no tautologies) belong to `write-tests` and its `references/test-quality.md`. This skill covers the JS / TS specifics.

---

## Phase 0 — Context Load (silent)

1. Read `CLAUDE.md` / `AGENTS.md` (test, type-check and mutation commands) and `.claude/rules/node-testing.md`. On Copilot the same rule is `.github/instructions/node-testing.instructions.md`.
2. Invoke `Skill("manage-memory", args: "sqa-engineer")` to load persistent memory.
3. Detect the runner from `package.json` (`devDependencies`, the `test` script) and from config files: `vitest.config.*` / `vite.config.*` mean Vitest; `jest.config.*` or a `jest` key means Jest. If no runner exists yet, use Vitest. Never add a second runner.
4. Read several existing test files. Note:
   - where tests live: co-located `*.test.ts` or a `tests/` folder;
   - whether tests import from `vitest` / `@jest/globals` or use globals;
   - which builders and helpers already exist;
   - the naming style.
   Follow what you find.
5. Note the project conventions:
   - All results use the `{ data, error }` shape.
   - Test framework: Vitest (Jest where already in use).
   - Doubles: `vi.fn` / `vi.mock`, only where `test-doubles` allows one.
   - Test data: faker builders, seeded.
   - Partial data: shoehorn, never `as`.

---

## Phase 1 — JS / TS Unit Testing Conventions

### Testing Framework: Vitest

Vitest is the default runner. Use it for:
- grouping tests per unit with `describe`
- defining test cases with `it` (or `test`; match the repository)
- parameterised cases with `it.each`

**Why Vitest:** TypeScript and ES modules work natively with no transform step, the API is Jest-compatible, and it supports soft assertions and fast watch mode.

**Jest repositories:** keep Jest. The patterns below carry over almost line for line. The real differences (imports, ESM, partial module mocks, no `expect.soft`) are in [`references/jest-differences.md`](references/jest-differences.md).

### Test Doubles: `vi.fn` / `vi.mock`

Whether a unit test may use a double, and which kind, is decided by `test-doubles`. These patterns show the mechanics. A unit that receives an owned I/O port (repository, gateway, clock or ID provider, publisher) or an unowned boundary through its constructor or parameters gets a typed double for it; plain in-process collaborators run for real.

**Pattern 1: Create a typed double**

[`templates/mock-create.md`](templates/mock-create.md)

**Pattern 2: Configure return behaviour**

[`templates/mock-configure.md`](templates/mock-configure.md)

**Pattern 3: Verify a call (only when the call is the behaviour)**

[`templates/mock-verify.md`](templates/mock-verify.md)

**Pattern 4: Argument matching**

[`templates/mock-argument-matching.md`](templates/mock-argument-matching.md)

**Pattern 5: Replace an imported boundary module**

[`templates/mock-module-boundary.md`](templates/mock-module-boundary.md)

**Pattern 6: Control the clock**

[`templates/fake-timers.md`](templates/fake-timers.md)

### Test Data: @faker-js/faker builders

Generate realistic test data through one builder per domain type, and override only the fields the test is about. Seed faker so failures reproduce. The `node-testing` rule forbids unseeded random data.

**Pattern 1: A builder with overrides**

[`templates/faker-test-data.md`](templates/faker-test-data.md)

**Pattern 2: Generate several**

[`templates/faker-generate-multiple.md`](templates/faker-generate-multiple.md)

**Why faker builders:** hardcoded data hides bugs and makes tests brittle. A builder makes the one field that matters visible in the test.

### Partial Test Data: @total-typescript/shoehorn

Framework objects (`Request`, `Response`, SDK clients) have far more members than a test needs. Use `fromPartial()` instead of `as Type`, and `fromAny()` instead of `as unknown as Type`. Use it in test code only.

[`templates/shoehorn-partial-data.md`](templates/shoehorn-partial-data.md)

**Why shoehorn:** `as` turns off type checking for the whole object. `fromPartial` still checks every field you supply, and the call site shows which data is partial on purpose.

### Assertions: `expect`

Use `toEqual` / `toStrictEqual` for structure, `toBe` for primitives and identity, and asymmetric matchers for values you do not control.

**Pattern 1: Simple assertions**

[`templates/assert-simple.md`](templates/assert-simple.md)

**Pattern 2: Collection assertions**

[`templates/assert-collection.md`](templates/assert-collection.md)

**Pattern 3: Exception assertions (Act + Assert merged)**

**Async exception:**

[`templates/assert-async-exception.md`](templates/assert-async-exception.md)

**Sync exception:**

[`templates/assert-sync-exception.md`](templates/assert-sync-exception.md)

**Critical rule:** pass a function to `expect(...).toThrow()`, and always `await` an `expect(promise).rejects` assertion. Never use `try` / `catch` in a test. A `rejects` assertion without `await` passes regardless of the outcome.

**Pattern 4: Parameterised edge cases**

[`templates/parameterised-tests.md`](templates/parameterised-tests.md)

### See All Failures at Once

This replaces `Assert.Multiple()`. First choice: one structural `toEqual` on the whole result, whose diff shows every mismatch. For independent checks, use `expect.soft` (Vitest only; Jest has none).

[`templates/assert-multiple.md`](templates/assert-multiple.md)

### The `{ data, error }` Return Shape

The result type is a discriminated union: exactly one side is set.

```ts
export type Result<T> = { data: T; error: null } | { data: null; error: string };
```

Always assert **both** `data` and `error` in one structural assertion, so a result that carries both cannot pass.

[`templates/data-error-shape.md`](templates/data-error-shape.md)

### Test Naming Convention

`describe` names the unit; `it` states the scenario and the expected outcome as a sentence. Prefix the name with `[AC-n]` when the test traces to an acceptance criterion.

[`templates/test-naming.md`](templates/test-naming.md)

### Test Structure: Arrange, Act, Assert (AAA)

Every test follows **Arrange, Act, Assert**, with the three blocks marked by comments.

**Arrange:** build data with faker builders, create typed doubles for boundaries, and construct the unit.

**Act:** call the unit under test exactly once.

**Assert:** verify the outcome, preferably with one structural assertion.

[`templates/test-structure.md`](templates/test-structure.md)

**Critical rule: one Act per test.** If a test needs to call the unit twice, split it into two tests.

### Running

- All tests: the project's test command from `AGENTS.md` (usually `npm test`).
- One file while iterating: `npx vitest run path/to/file.test.ts` (Jest: `npx jest path/to/file.test.ts`).
- Type-check test code as well (`npx tsc --noEmit`, or the project's script). Vitest strips types without checking them.

---

## Phase 2 — Complete Example: Middleware Test

A complete example that tests an Express-style middleware with all the conventions together:

[`templates/middleware-unit-test.md`](templates/middleware-unit-test.md)

---

## Phase 3 — Key Takeaways

When writing JavaScript / TypeScript unit tests:

1. **Use Vitest**, or Jest when the repository already uses it. Never both.
2. **Doubles only where `test-doubles` allows.** Use `vi.fn` for injected ports and boundaries and `vi.mock` for imported ones; plain logic runs for real.
3. **Generate test data with seeded faker builders**, overriding only the fields that matter.
4. **Use shoehorn instead of `as`.** Use `fromPartial` for partial data and `fromAny` for deliberately wrong data.
5. **See every failure at once**, with one structural `toEqual` or `expect.soft`.
6. **Always assert both `data` and `error`.** The `{ data, error }` shape is mandatory.
7. **Name tests as specifications**: `describe(unit)` plus `it('<outcome> when <scenario>')`.
8. **Test behaviour, not implementation.** Tests must survive refactoring, and expected values come from an independent source.

Follow these patterns consistently across all test suites.

Adapted in part from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT).
