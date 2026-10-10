---
name: ts-mutation-testing
description: "Runs and interprets StrykerJS mutation testing for JavaScript/TypeScript projects (Node, TypeScript, plain JavaScript): installing @stryker-mutator/core with the vitest-runner or jest-runner, configuring stryker.config.json, running full, incremental and changed-files (--mutate) runs, thresholds and baselines, and triaging surviving mutants into real test gaps vs equivalent mutants. The sqa-engineer's exclusive quality gate in FDLC, RLC and TLC."
---

# JS / TS Mutation Testing (StrykerJS)

Mutation testing checks whether the tests would notice if the code were wrong. StrykerJS makes small changes to production code (mutants) and runs the tests against each one. A mutant that no test fails on has **survived**, which points to a weak or missing assertion.

> Agent names are the defaults; a name chosen at `/init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

Ownership: this gate belongs to **Kent Beck** (`sqa-engineer`). Other agents may run it for information, but only SQA declares the gate passed.

## Phase 0 — Context

1. Read the project's `CLAUDE.md` / `AGENTS.md` for the mutation command and the agreed threshold (default below), and `.claude/rules/node-testing.md` (Copilot: `.github/instructions/node-testing.instructions.md`).
2. `Skill("manage-memory", args: "sqa-engineer")` for prior baselines and known equivalent mutants.
3. Find the StrykerJS config (`stryker.config.json`, `stryker.config.mjs`, `stryker.conf.*`, `.stryker.conf.*`) and the test runner it uses (`testRunner`). In a monorepo, note which package or root folder runs the test command.

## Phase 1 — Tool setup (once per repository)

`/init` installs a `stryker.config.json` from its `templates/stryker.config.json` when no StrykerJS config exists. Prefer that file; edit it rather than creating a second one. Without it:

```bash
npm init stryker@latest                       # interactive; detects the runner and writes the config
# or install by hand, matching the repository's runner:
npm i -D @stryker-mutator/core @stryker-mutator/vitest-runner     # Vitest
npm i -D @stryker-mutator/core @stryker-mutator/jest-runner       # Jest
npm i -D @stryker-mutator/typescript-checker                      # optional: discard mutants that do not type-check
```

Use the detected package manager (`pnpm add -D`, `yarn add -D`, `bun add -d`) and run Stryker with its exec form (`pnpm exec stryker run`, `bunx stryker run`).

The config shape `init` installs, with the runner and source root filled in:

```json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "testRunner": "vitest",
  "coverageAnalysis": "perTest",
  "incremental": true,
  "incrementalFile": "reports/stryker-incremental.json",
  "mutate": [
    "src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
    "!src/**/*.{test,spec}.*",
    "!src/**/__tests__/**",
    "!src/**/*.d.ts"
  ],
  "reporters": ["html", "json", "clear-text", "progress"],
  "thresholds": { "high": 80, "low": 60, "break": 60 }
}
```

Keys worth knowing:

| Key | Purpose |
|---|---|
| `testRunner` | `vitest`, `jest`, `mocha` or `command`. It must match the repository's runner, and its plugin must be installed. |
| `mutate` | Globs of production files to mutate. Exclude tests, type declarations, generated code, migrations and pure type or DTO files with `!` globs. |
| `thresholds` | Give all three keys. `break` makes the run exit non-zero when the score falls below it, and must be ≤ `low`. Without `break`, the run never fails. Agree the value with the team and record it in `AGENTS.md`. |
| `incremental` / `incrementalFile` | Reuse results for unchanged code and tests from the previous run (see Phase 2). |
| `checkers` + `tsconfigFile` | `["typescript"]` with `@stryker-mutator/typescript-checker`: mutants that do not compile are reported as `CompileError` instead of being tested. |
| `coverageAnalysis` | `perTest` (default) runs only the tests that cover each mutant. Remove it for the `command` runner. |
| `vitest.configFile` / `jest.configFile` | Point at the runner config when it is not the default. |
| `ignoreStatic` | Skip mutants in code that runs once at module load, which are expensive to test. |
| `concurrency`, `timeoutMS` | Tune for CI runners that are slow or have few cores. |

Reports go to `reports/mutation/` (`mutation.html`, `mutation.json`). Add `reports/` to `.gitignore` unless the incremental file is committed or cached in CI.

## Phase 2 — Choose the run type

StrykerJS has no `--since` flag. Changed-code runs use **incremental mode**, **an explicit `--mutate` list**, or both.

| Situation | Command |
|---|---|
| FDLC / BFLC on a feature branch: only what changed | `npx stryker run --incremental`. The first run is full; later runs re-test only mutants whose code or covering tests changed. |
| Feature branch, scoped to the files the branch touched | `npx stryker run --mutate "$(git diff --name-only --diff-filter=d origin/main...HEAD -- 'src/**/*.ts' \| paste -sd, -)"` (use the repo's default branch and source globs). An empty file list means there is nothing to mutate; do not run with no list. |
| RLC: capture the score **before** refactoring | `npx stryker run --force` on the base commit. Save the score and the `reports/mutation/mutation.json` path in memory. |
| RLC: compare after refactoring | `npx stryker run --force` again. The score must be ≥ the baseline. |
| TLC / release candidate: whole codebase | `npx stryker run --force` (ignore incremental results) |
| CI gate | `npx stryker run --incremental` with `thresholds.break` set in the config, and the incremental file restored from the target branch's cache |

`--mutate` (`-m`) takes a comma-separated list; quote each glob pattern so the shell does not expand it (`--mutate 'src/a/**/*.ts','src/b.ts'`). A file entry may carry a line range `path:start[:col]-end[:col]` (e.g. `src/app.ts:10-20`) to mutate only those lines, but a range cannot be combined with a glob in the same entry.

`--force` runs every mutant even when `incremental` is on in the config. StrykerJS has no CLI flag for thresholds; set `break` in the config file.

Always run the test command green first (and the type check for TypeScript). Stryker on a red suite is noise, and its initial dry run fails.

### Disabling a mutant (equivalent mutants only)

Only after triage has classified a mutant as **Equivalent**, suppress it at the source with a reason:

```ts
// Stryker disable next-line EqualityOperator: length is never negative, so >= 0 and > -1 are equivalent
if (items.length >= 0) { /* ... */ }
```

Use `// Stryker disable all` / `// Stryker restore all` only around a block that is genuinely not worth mutating (logging-only code), and record each suppression in `sqa-engineer` memory.

## Phase 3 — Triage surviving mutants

Open `reports/mutation/mutation.html`. Mutant states:

| State | Meaning |
|---|---|
| Killed | At least one test failed. Good. |
| Timeout | The mutant caused a hang. Counted as detected. |
| Survived | Tests ran and all passed. Triage it. |
| NoCoverage | No test executes the line. Always a gap or out of scope. |
| CompileError / RuntimeError | The mutant was invalid. Excluded from the score. |
| Ignored | Excluded by config or a disable comment. |

Score = detected (killed + timeout) / valid (detected + survived + no coverage). The report also shows a score for covered code only. The gate uses the total score.

For **each** survived or no-coverage mutant on changed lines, classify it:

| Class | Meaning | Action |
|---|---|---|
| **Gap** | A real behaviour that no test asserts | Add or strengthen a test with `ts-unit-testing` (or `ts-integration-testing`); cite the AC it protects (`[AC-n]` in the test name) |
| **Weak assertion** | A test runs the line but asserts too little | Tighten the assertion: an exact value instead of `toBeDefined()`, both sides of `{ data, error }`, the error type and message, the boundary row in `it.each` |
| **Equivalent** | The mutation cannot change observable behaviour | Record it with a justification and suppress it with a disable comment. Do not write a test to "kill" it. |
| **Out of scope** | Code outside this work item | Note it for a future TLC item; do not expand scope |

Typical JS / TS survivors and the test that kills them:

- `EqualityOperator` (`<` → `<=`): add the exact boundary value as an `it.each` row.
- `ConditionalExpression` / `LogicalOperator`: one test per branch, asserting the outcome that differs.
- `StringLiteral` on error messages: assert the `error` text (`expect.stringContaining`), not just that `error` is non-null.
- `OptionalChaining` (`a?.b` → `a.b`): a test with the `null` / `undefined` input.
- `ObjectLiteral` / `ArrayDeclaration` (`{}` / `[]`): assert the returned structure with `toEqual`, not just its type.
- `BlockStatement` (body removed): the unit's side effect is not asserted. Check the outcome or the boundary call that *is* the behaviour.

Never change production code to kill a mutant. Report real defects to **David Fowler** (`software-engineer`), which forks a BFLC item.

## Phase 4 — Report

Return:

```
## Mutation Report — <scope>
Run: <command> · Score: <n>% (baseline <n>% / threshold break <n>%)
Killed <n> · Timeout <n> · Survived <n> · No coverage <n> · Compile errors <n>
Report: reports/mutation/mutation.html

| File:line | Mutator | Class | Action / test added |
|---|---|---|---|

Gate: PASSED | FAILED — <reason>
```

Save the new baseline score and any accepted equivalent mutants (file, mutator, reason) to `sqa-engineer` memory.
