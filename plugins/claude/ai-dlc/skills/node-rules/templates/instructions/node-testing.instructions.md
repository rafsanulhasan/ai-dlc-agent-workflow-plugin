---
description: "TypeScript and JavaScript testing and quality gate requirements"
applyTo: "**"
---

# Testing Requirements (TypeScript / JavaScript)

- After implementing every feature or fix in JavaScript or TypeScript code, run `npm test` to validate all tests pass.
- After all tests pass, run `npx stryker run` to run mutation tests and verify code quality.
- Never skip either quality gate before finishing.

## Test runner and test location

- Use the test runner the repository already uses (Vitest, Jest, Mocha or `node:test`). Never add a second test runner or assertion library.
- Use test APIs the way existing tests do: explicit imports (`import { describe, it, expect } from "vitest"`) or the configured globals; do not mix the two.
- Put new tests where the existing tests live and name them the same way: co-located `*.test.ts` / `*.spec.ts` next to the source, or a `tests/` / `__tests__/` folder. In a workspace (monorepo), a package's tests live inside that package.
- Test a module through its public entry points, not its internals.
- Unit tests are deterministic: no real network calls, no wall-clock time, no random data without a fixed seed, and no mutable state shared between tests.

## Exception For Non-Functional Artifact Changes

- If a change is non-functional and only updates agent artifacts, you may skip `npm test` and `npx stryker run`.
- Non-functional agent artifacts include:
	- planning updates
	- agent definitions
	- skills
	- hooks
	- prompts or commands
	- rules or instructions
- If any production code, test code, runtime configuration, `package.json`, lockfile, `tsconfig*.json` or build logic changes, run both quality gates.
