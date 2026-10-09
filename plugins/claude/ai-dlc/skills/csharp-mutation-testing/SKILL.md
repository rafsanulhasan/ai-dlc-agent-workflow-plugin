---
name: csharp-mutation-testing
description: "Runs and interprets Stryker.NET mutation testing for C# projects — installing the tool, configuring stryker-config.json, running full, incremental (--since) and baseline runs, and triaging surviving mutants into real test gaps vs equivalent mutants. The sqa-engineer's exclusive quality gate in FDLC, RLC and TLC."
---

# C# Mutation Testing (Stryker.NET)

Mutation testing checks whether the tests would notice if the code were wrong. Stryker.NET makes small changes (mutants) to production code and re-runs the tests; a mutant that does not make any test fail **survived** and points to a weak or missing assertion.

Ownership: this gate belongs to `sqa-engineer`. Other agents may run it for information, but only SQA declares the gate passed.

## Phase 0 — Context

1. Read the project's `CLAUDE.md` / `AGENTS.md` for the mutation threshold the project has agreed (default below).
2. `Skill("ai-dlc:manage-memory", args: "sqa-engineer")` for prior baselines and known equivalent mutants.
3. Find the test projects (`Glob **/*Tests*.csproj`) and the production project(s) they cover.

## Phase 1 — Tool setup (once per repository)

Prefer a local tool manifest so CI and every developer use the same version:

```bash
dotnet new tool-manifest      # only if .config/dotnet-tools.json does not exist
dotnet tool install dotnet-stryker
dotnet stryker init           # optional: scaffolds stryker-config.json
```

A minimal `stryker-config.json` at the test project (or solution) root:

```json
{
  "stryker-config": {
    "project": "MyProduct.csproj",
    "test-projects": ["tests/UnitTests/UnitTests.csproj"],
    "mutation-level": "Standard",
    "reporters": ["html", "json", "progress"],
    "thresholds": { "high": 80, "low": 60, "break": 60 },
    "mutate": ["**/*.cs", "!**/Migrations/**/*.cs"]
  }
}
```

Notes:
- `project` is the production project **file name**, not a path.
- `thresholds.break` fails the run (non-zero exit) when the score is below it; it must be ≤ `low`. Agree the value with the team and record it in `AGENTS.md`.
- Exclude generated code, migrations and DTO-only files with `!` globs in `mutate`.

## Phase 2 — Choose the run type

| Situation | Command |
|---|---|
| FDLC / BFLC on a feature branch — only what changed | `dotnet stryker --since:main` (use the repo's default branch) |
| RLC — capture the score **before** refactoring | `dotnet stryker` on the base commit; save the JSON report path and score in memory |
| RLC — compare after refactoring | `dotnet stryker` again; score must be ≥ baseline |
| TLC / release candidate — whole codebase | `dotnet stryker` |
| CI gate | `dotnet stryker --since:<target> --break-at <n>` |

Always run `dotnet build` and `dotnet test` green first — Stryker on a red suite is noise.

## Phase 3 — Triage surviving mutants

Open the HTML report (path printed at the end of the run; `--output` sets the location). For **each** surviving mutant on changed lines, classify it:

| Class | Meaning | Action |
|---|---|---|
| **Gap** | A real behaviour no test asserts | Add or strengthen a test; cite the AC it protects (`[AC-n]` in the test name) |
| **Weak assertion** | A test executes the line but asserts too little | Tighten the assertion (exact value, exception type, message, side effect) |
| **Equivalent** | The mutation cannot change observable behaviour | Record it with justification; do not write a test to "kill" it |
| **Out of scope** | Code outside this work item | Note for a future TLC item; do not expand scope |

Never change production code to kill a mutant — report real defects to `software-engineer` (that forks a BFLC item).

## Phase 4 — Report

Return:

```
## Mutation Report — <scope>
Run: <command> · Score: <n>% (baseline <n>% / threshold break <n>%)
Killed <n> · Survived <n> · No coverage <n> · Timeout <n>
Report: <path to html/json>

| File:line | Mutator | Class | Action / test added |
|---|---|---|---|

Gate: PASSED | FAILED — <reason>
```

Save the new baseline score and any accepted equivalent mutants to `sqa-engineer` memory.
