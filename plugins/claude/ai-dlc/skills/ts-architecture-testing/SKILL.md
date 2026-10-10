---
name: ts-architecture-testing
description: Comprehensive guidance for writing architecture tests in JavaScript/TypeScript projects (Node, TypeScript, plain JavaScript) using dependency-cruiser forbidden and required rules (layer dependencies, no circular dependencies, no orphans, not-to-dev-dependency, restricted imports, folder residency), run through depcruise in a test or CI step, plus file-walk tests for naming and residency, with eslint-plugin-boundaries and TypeScript project references as alternatives
---

# JS / TS Architecture Testing

You are the **JS / TS Architecture Testing** skill for the project.

This skill provides guidance for writing architecture tests that enforce structural rules — layer isolation, module boundaries, folder residency, naming patterns, restricted imports — in JavaScript and TypeScript code, on behalf of **Kent Beck** (`sqa-engineer`). The standard tool is **dependency-cruiser**, whose rules run through `depcruise` as a test in the existing runner (Vitest, or Jest when the repository uses it) or as a CI step.

> Agent names are the defaults; a name chosen at `/ai-dlc:init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

---

## Phase 0 — Context Load (silent)

1. Read `CLAUDE.md` / `AGENTS.md` and `.claude/rules/node-testing.md` (on Copilot: `.github/instructions/node-testing.instructions.md`) to understand project conventions and quality gates.
2. Invoke `Skill("ai-dlc:manage-memory", args: "sqa-engineer")` to load the SQA engineer's persistent memory.
3. Read the architecture documentation (ADRs, the design document) and any existing `.dependency-cruiser.*`, `eslint-plugin-boundaries` settings or `tsconfig` project references, to learn the current architectural constraints.
4. Map the layers to folders (`src/domain`, `src/application`, ...) or workspace packages before writing a rule. A rule over a folder that does not exist passes vacuously.

---

## Phase 1 — Architecture Testing Stack

**Tool**: `dependency-cruiser` (npm, dev dependency)
Builds the module dependency graph (resolving TypeScript path aliases and type-only imports) and checks it against `forbidden`, `allowed` and `required` rules in `.dependency-cruiser.cjs`. CLI: `depcruise`.

**Runner**: the repository's existing test runner (Vitest by default)
Architecture tests are ordinary test files (`tests/architecture/*.test.ts`) that run the CLI and assert on its JSON output, plus file-walk tests for naming and residency.

**Assertions**: the runner's `expect`
Compare the list of violating edges or files with `[]` so the failure prints every offender. `expect.soft` collects several rules in one run.

**Alternatives**: `eslint-plugin-boundaries` (lint-time layer rules in the editor) and TypeScript project references (compiler-enforced layer graph). See Phase 2, patterns 8 and 9.

Requires Node 22 or later (dependency-cruiser 18).

---

## Phase 2 — Core Patterns

Each pattern is a separate template file. Review the one that matches your architectural rule.

### 1. Setup and Run — [arch-setup-and-run](templates/arch-setup-and-run.md)

`npx depcruise --init` generates the config with the standard rules; set `tsConfig` and `tsPreCompilationDeps` for TypeScript.
Run: `npx depcruise src --config .dependency-cruiser.cjs --output-type err`.

### 2. Layer Dependency Rule — [arch-layer-dependency](templates/arch-layer-dependency.md)

Example: "the domain must not depend on infrastructure."

Pattern: `{ from: { path: '^src/domain/' }, to: { path: '^src/(application|infrastructure|api)/' } }`

Peer modules: a `from.path` capture group and `$1` in `to.pathNot` keep each module out of the others' internals.

### 3. Folder Residency Rule — [arch-folder-residency](templates/arch-folder-residency.md)

Example: "every `*.controller.ts` lives under `src/api/`."

Pattern: `{ from: { path: '\\.controller\\.ts$', pathNot: '^src/api/' }, to: {} }`, plus a file-walk test for files with no imports.

### 4. Naming Convention Rule — [arch-naming-convention](templates/arch-naming-convention.md)

Example: "every file in `src/application/handlers` is `*.handler.ts`."

Pattern: a file-walk test for file names; `@typescript-eslint/naming-convention` for identifiers.

### 5. Required Dependency Rule — [arch-required-dependency](templates/arch-required-dependency.md)

Example: "every controller uses the base controller."

Pattern: `required: [{ module: { path: '\\.controller\\.ts$' }, to: { path: '^src/api/base-controller\\.ts$' } }]`; prefer `implements` / `satisfies` when the type checker can express the contract.

### 6. Standard Rules and Restricted Imports — [arch-standard-rules](templates/arch-standard-rules.md)

`no-circular`, `no-orphans`, `not-to-dev-dep`, `no-non-package-json`, `not-to-unresolvable`, `not-to-spec`, and "this library only from here" rules (`db-driver-only-in-repositories`, `no-node-builtins-in-domain`).

### 7. Asserting Results — [arch-assert-result](templates/arch-assert-result.md)

Either a CI step (`--output-type err` exits non-zero on any `error` violation) or a test that runs `depcruise --output-type json` and asserts `brokenBy(rule)` equals `[]`.
Map each violation to `from -> to` so the failure is readable. Use `expect.soft` to report every rule in one run.

### 8. Alternative: eslint-plugin-boundaries — [arch-eslint-boundaries](templates/arch-eslint-boundaries.md)

Layer rules as lint errors in the editor. No cycle or orphan detection.

### 9. Alternative: TypeScript project references — [arch-ts-project-references](templates/arch-ts-project-references.md)

One `composite` project per layer; the `references` graph is the allow-list, enforced by `tsc -b`. Coarse; worth it when the repository already builds that way.

### 10. Baseline for an existing codebase — [arch-baseline](templates/arch-baseline.md)

`depcruise src --baseline` records today's violations; `--ignore-known` fails only on new ones.

---

## Phase 3 — Complete Example

See [arch-complete-example](templates/arch-complete-example.md) for a full `.dependency-cruiser.cjs` and `tests/architecture/architecture.test.ts`. It demonstrates:

- Layer, peer-module, residency, restricted-import and hygiene rules in one config, each with a `name` and a `severity`
- One test per rule category (layer, residency, naming)
- A catch-all test that reports every broken `error` rule with `expect.soft`
- Violations mapped to `from -> to` strings and misplaced files listed by path
- Seeing the suite fail first with a throwaway forbidden import

---

## Phase 4 — Key Takeaways

1. **Use dependency-cruiser** — one config file, regular expressions over resolved paths, TypeScript-aware.
2. **Set `tsConfig` and `tsPreCompilationDeps: true`** — path aliases resolve and type-only imports count.
3. **Give every rule a `name`, `severity: 'error'` and a `comment`** saying why — the name is what the failing test reports.
4. **Assert on the list of offenders, never a count** — `expect(brokenBy(rule)).toEqual([])`.
5. **One test per architectural rule** (or per category), with `expect.soft` in the catch-all — see every violation at once.
6. **Cover zero-import files with a file-walk test** — dependency rules only see files that have dependencies.
7. **Baseline, don't disable** — on an existing codebase use `--baseline` / `--ignore-known`, and shrink the list.
8. **Architecture tests live in the existing test suite** and run with `npm test` (or as a `test:arch` CI step) like any other quality gate.

---

## When to Use This Skill

Invoke this skill whenever you are writing tests that enforce structural rules rather than behaviour in a JavaScript or TypeScript codebase:

- Layer isolation (the domain does not import infrastructure or the HTTP layer)
- Module boundaries (feature modules talk only through their public `index.ts`)
- Folder residency (all controllers live under `src/api/`)
- Naming patterns (handlers are `*.handler.ts`; error classes end with `Error`)
- Restricted imports (only repositories import the database driver; no devDependencies in production code)
- Dependency hygiene (no cycles, no orphans, no undeclared packages)

These tests run as part of the regular test command and are enforced like unit and integration tests.
