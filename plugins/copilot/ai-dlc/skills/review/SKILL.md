---
name: review
description: "Structured code review workflow for software projects. Use to assess branch/PR/file changes, or everything since a given commit, branch or tag, and produce severity-ranked findings on two separate axes: Standards (correctness, documented conventions, coverage, design and code smells) and Spec (does the change do what the spec or acceptance criteria asked, no more and no less), run as independent parallel reviewers where possible. Reports in the full format, or on request in a compact one-line-per-finding format (location, problem, fix)."
---

# Review

> Agent names are the defaults; a name chosen at `/init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

# Operating Methodology

You review code in seven phases on behalf of **Robert C. Martin** (`code-reviewer`). Complete each phase fully before advancing. Never modify production code — describe findings so **David Fowler** (`software-engineer`) can act on them.

## Two axes, kept apart

Every review answers two independent questions:

| Axis | Question | Phases |
|---|---|---|
| **Standards** | Is the code correct and written the way this project says code should be written? | 1–4 |
| **Spec** | Does the code do what the spec or acceptance criteria asked — all of it, correctly, and nothing extra? | 5 |

A change can pass one and fail the other: clean, conventional code that implements the wrong thing, or exactly the requested behaviour written against every project rule. Reviewing both in one pass lets one mask the other, so they are reviewed independently and reported side by side, never merged into one ranking.

**Running them in parallel.** Each axis should be judged in its own context:

- **When you can spawn agents** (you are the session's main agent), spawn two reviewers in one message, one per axis, each with a self-contained brief from `Skill("agent-invocation")`: the diff command, the commit list, and either the standards sources plus the full text of [references/smell-baseline.md](references/smell-baseline.md), pasted in because a spawned reviewer cannot resolve this skill's relative paths (Standards), or the spec and its acceptance criteria (Spec). Ask each for findings in the Phase 6 compact format, under about 400 words, so their reports stay small in your context. Aggregate their reports in Phase 6.
- **When you are a subagent** (subagents cannot spawn further agents), run the axes as two separate passes: finish and write up Phases 1–4 before you open the spec for Phase 5, so the spec does not colour the standards review and vice versa.
- **Scott Hanselman** (`orchestrator`) can also fan out two `code-reviewer` instances in parallel, one briefed `axis: standards` and one `axis: spec`. A reviewer briefed with one axis runs only that axis's phases plus Phases 0 and 6.

---

## Phase 0 — Context Load (silent, no user interaction)

Before reviewing any code:

1. Read `CLAUDE.md` and `AGENTS.md` to internalize all conventions (`{ data, error }` return shape, no stack trace exposure, logger module, plus the stack's own from `dotnet-rules` or `node-rules`) and the project's build / test commands.
2. **Pin the base and the diff** from the argument:
   - **PR number**: run `gh pr diff <number>` to get the full diff
   - **Branch name**: run `git diff main...<branch>` to get all changes vs main
   - **Since a fixed point** (commit, tag, branch, `HEAD~N`): run `git diff <base>...HEAD` — three dots, so the comparison is against the merge base, not the base's current tip
   - **Commit range**: run `git diff <sha1>..<sha2>`
   - **File list**: read each named file directly
   - If no scope was given, ask for one rather than assuming `main`.

   For any git-based scope, first confirm the base resolves (`git rev-parse <base>`) and the diff is non-empty, and record the commit list (`git log <base>..HEAD --oneline`). A bad ref or an empty diff stops the review here, before any reviewer is spawned.
3. For each changed file, read the full file — not just the diff lines — to understand surrounding context.
4. Check `docs/architecture/decisions/` for any ADRs that constrain the changed components.
5. **Find the standards sources** — every file that says how code should be written here: `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `CODING_STANDARDS.md` (always include these two when present), `.claude/rules/`, `.github/instructions/`, and linter or formatter configuration. Rules a linter, formatter or compiler already enforces are not review findings; skip them.
6. **Find the spec**, in this order:
   1. the handoff record for the work item (`docs/handoffs/<work-item-id>/`) and the spec it links;
   2. a spec or story path passed as an argument;
   3. `docs/specs/<slug>.spec.md` (or another spec under `docs/`) matching the branch name or feature;
   4. issue or work-item references in the commit messages or PR description.

   If none is found, ask where the spec is. If there is none, the Spec axis is skipped and the report says "no spec available" — it is never silently dropped.

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

- [ ] Disposable resources are released on every path (C#: `await using`, not `using`; JS / TS: `try` / `finally` or `await using` where supported)
- [ ] No fire-and-forget async work (C#: no `async void` except event handlers; JS / TS: no floating promises)
- [ ] C#: no `.Result` or `.Wait()` calls that could deadlock

---

## Phase 2 — Convention Review

Check every changed file against each standards source found in Phase 0, citing the source file and rule for every breach, and then against the defaults below:

### Type Declarations

The stack's coding rules (`dotnet-rules` or `node-rules`, under `.claude/rules/`) define this. For C#:

- [ ] Explicit types on left-hand side: `FileStream stream = new();` not `var stream = new FileStream()`
  - Exception allowed: `Stream stream = new FileStream()` (base/interface type on left)
  - Exception allowed: `IEnumerable<T> items = new List<T>()` (interface on left, concrete on right)

### Dependency Injection

- [ ] All dependencies are injected abstractions — no `new ConcreteService()` inside components
- [ ] No captive dependencies: scoped services not injected into singletons
- [ ] The project logger is injected (C#: `ILogger<T>` via DI) — no `Console.Write*` or `console.log` calls

### Comments

- [ ] No comments that describe *what* code does — well-named identifiers handle that
- [ ] Comments present only where the *why* is non-obvious: hidden constraints, workarounds, subtle invariants
- [ ] No commented-out code blocks

---

## Phase 3 — Test Coverage Review

1. For every new public method or changed logical branch, check whether a corresponding test exists.
2. Run the project's build command (recorded in `AGENTS.md` at init; for example `dotnet build` or `npm run build`) to confirm the code compiles.
3. Run the project's test command (for example `dotnet test` or `npm test`) to confirm the test suite passes.
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

### Smell baseline

Even where the project documents nothing, check the diff against the code-smell baseline in [references/smell-baseline.md](references/smell-baseline.md) (Mysterious Name, Duplicated Code, Feature Envy, Data Clumps, Primitive Obsession, Repeated Switches, Shotgun Surgery, Divergent Change, Speculative Generality, Message Chains, Middle Man, Refused Bequest). Two rules bind it:

- **The project wins.** A documented project standard always overrides the baseline; if the project endorses something the baseline would flag, do not report it.
- **Always a judgement call.** Report a smell as "possible <smell>" with the hunk quoted, at **Suggestion** or **Warning** level — never as a Blocker on its own. Breaches of a documented standard can be Blockers; smells cannot.

---

## Phase 5 — Spec Review

Skip this phase only when Phase 0 found no spec; record that in the report. Otherwise, read the spec and its numbered acceptance criteria, then compare them with the diff and the commit list. Report three kinds of finding, each quoting the spec line or AC it relates to:

| Finding | What it means | Default severity |
|---|---|---|
| **Missing or partial** | A requirement or AC the spec asked for is absent, or only part of it is implemented | Blocker (Warning if the spec marks it optional or deferred) |
| **Implemented wrongly** | The change appears to address a requirement, but the behaviour does not match what the spec says | Blocker |
| **Not asked for** | Behaviour in the diff that no requirement asks for (scope creep) | Warning; Blocker if it changes a public contract, data shape or security surface |

Build an AC trace as you go — each AC mapped to the code that satisfies it and the test that proves it — and carry it into the report. An AC with no code is *missing*; an AC with code but no test is a Coverage Gap for the SQA engineer.

---

## Phase 6 — Findings Report

When the axes ran as separate reviewers, collect both reports first. Present each axis under its own heading, as returned or lightly cleaned; do not merge findings across axes or re-rank one against the other. A reviewer that returned the compact format has its lines carried over one for one into the full format: no finding added, dropped or re-ranked.

Two formats share one set of findings:

| Format | Use for |
|---|---|
| **Full** (default) | The G4 report the human approves, the CRLC exit artifact, and any review whose reader needs the rationale |
| **Compact** | When the caller asks for it (`format: compact` in the brief or argument), a parallel axis reviewer reporting back, a re-review after fixes, or comments ready to paste into a PR |

The Quality Gate below applies to both; the compact format shortens the write-up, never the review.

### Full format

Produce the report in this format:

```
## Code Review: <branch / PR / file list> (base: <ref>, <N> commits)

### Summary
<1–3 sentence overview: what changed and overall assessment>
Standards: <B> blockers, <W> warnings, <S> suggestions — worst: <one line or "none">
Spec: <B> blockers, <W> warnings — worst: <one line, "none", or "no spec available">

### Standards
#### Blockers (must fix before merge)
- **[file:line]** <issue, the rule it breaks (source file + rule), and what must change>
#### Warnings (should fix)
- **[file:line]** <issue and recommended change>
#### Suggestions (optional)
- **[file:line]** <improvement, including "possible <smell>" judgement calls>

### Spec
#### Missing or partial
- **[AC-n]** "<quoted spec line>" — <what is missing> (<severity>)
#### Implemented wrongly
- **[AC-n] [file:line]** "<quoted spec line>" — <how the behaviour differs> (<severity>)
#### Not asked for
- **[file:line]** <behaviour no requirement asks for> (<severity>)
#### AC trace
| AC | Code | Test |
|---|---|---|

### Coverage Gaps (hand to sqa-engineer)
- <component / method> — <what logic path lacks test coverage>

### Verdict
[ ] Approved — no blockers on either axis, warnings addressed or accepted
[ ] Changes requested — blockers must be resolved before re-review
```

The summary names the worst issue **within each axis**; do not pick one overall winner across axes. Use `TodoWrite` to create a task for each Blocker and Warning so the software-engineer can track them.

### Compact format

One line per finding: location, problem, fix. Same axes, severities and rules as the full format, in the register of `Skill("terse-output")`.

```
## Review (compact): <branch / PR / file list> (base: <ref>, <N> commits)
### Standards
<path>:<line>: <severity>: <problem>. <fix>.
totals: <B> blocker, <W> warning, <S> suggestion, <Q> question
### Spec
<AC-n, or "no AC" for not-asked>: <missing | partial | wrong | not-asked>: "<shortest decisive spec text>" <path:line if any>. <fix>. (<severity>)
AC trace: AC-1 ok · AC-2 code, no test · AC-3 missing
totals: <B> blocker, <W> warning   (or: no spec available)
### Coverage gaps
<component / method>: <untested logic path>
verdict: approved | changes-requested
```

- **Severity** is `blocker`, `warning` or `suggestion`, as in the full format, plus `question` when you need the author's intent before you can judge. Use `question` instead of hedging.
- **Location** is an exact line or range (`src/orders/order_service.py:42`, `:88-140`). Sort findings by file, then line.
- **Problem** names the exact identifier in backticks and says what is wrong, not what the line does — the author can read the diff.
- **Fix** is concrete ("add a null guard before `.email`"), never "consider refactoring". Add the reason only when the fix does not make it obvious.
- The axis rules still bind: a documented-standard finding ends with its source (`(rule: CONTRIBUTING.md, Naming)`); a smell is reported as "possible <smell>" at `suggestion` or `warning`, never `blocker`; a Spec finding quotes its AC (a not-asked finding names the behaviour and the `path:line` instead); a missing spec is stated, never dropped.
- An axis with no findings is a single line: `No findings.`

```
src/auth/token_validator.go:42: blocker: expiry check uses `<` not `<=`; expired tokens pass for one tick. Use `<=`.
src/orders/order_service.py:88-140: suggestion: possible Divergent Change: `place_order` changes for validation, pricing, persistence and notification. Split by reason to change.
src/http/retry-policy.ts:23: warning: no retry on 429. Retry with backoff, at most 3 attempts.
src/cache/CacheStore.java:107: question: why clear the cache here? The next read misses.
```

**Write a full paragraph instead of one line, then resume the compact lines,** for:

- a security finding — state the risk and its impact in plain sentences, with a reference (CWE, advisory) where one exists;
- an architectural disagreement — give the rationale, and flag it for **Mark Richards** (`software-architect`) as the full format does;
- an author new to the codebase who needs the reason, not only the fix.

---

## Quality Gate

Do not produce the findings report until:

- [ ] The base resolved and the diff was non-empty
- [ ] Every changed file has been fully read (not just the diff)
- [ ] The build command exits with 0 errors
- [ ] The test command exits with 0 failures
- [ ] Both axes were reviewed independently, or the report states why the Spec axis was skipped
- [ ] Every Standards finding names a specific file path and line number; every documented-standard finding cites its source
- [ ] Every Spec finding quotes the spec line or AC it relates to
- [ ] The verdict is explicit: Approved or Changes Requested
- [ ] No Blocker is left undocumented

Adapted in part from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT).
Adapted in part from [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) (Apache-2.0); modified.
