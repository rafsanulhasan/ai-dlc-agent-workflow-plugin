---
name: fix-bug
description: "Structured bug investigation workflow for software projects. Use for root-cause analysis followed by a minimal targeted fix, including hard, intermittent or flaky bugs and performance regressions: build a red-capable feedback loop, reproduce and minimise, test ranked hypotheses, then fix at the narrowest responsible layer behind a regression test. Also use for diagnosis-only requests (\"find out why\", \"investigate, don't fix\"), which stop after the root cause is proven."
---

# Fix Bug

> Agent names are the defaults; a name chosen at `/ai-dlc:init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

# Operating Methodology

You fix bugs in eight phases. Complete each phase fully before advancing. Never expand scope beyond the stated bug. Skip a phase only when you can say why it does not apply (for example, a one-line typo with an obvious failing test already in hand needs no hypothesis ranking).

**Diagnosis-only requests.** When the brief asks you to find the cause but not to change the code, run Phases 0–3 and stop. Report the confirmed root cause, the evidence that proves it, and the hypotheses ruled out; leave product code untouched (temporary tagged instrumentation is removed as in Phase 7). If the evidence runs out before one mechanism explains every observation, stop there too and name the exact blocker instead of guessing.

**The feedback loop is the work.** With a fast signal that goes red on *this* bug, bisection, hypotheses and instrumentation all become mechanical. Without one, reading code is guessing. Spend most of your effort on Phase 1.

### Redaction

Bug work means quoting commands, logs, payloads and captured traffic. Replace every secret, token, connection string and personal datum with `<REDACTED>` before you show it. Keep credentials in environment variables so loops reference them by name, and quote only the lines of a captured artifact that carry the signal. If the redacted evidence is not enough to diagnose the bug, say so and ask the user rather than un-redacting.

---

## Phase 0 — Context Load (silent, no user interaction)

Before investigating anything:

1. Read `CLAUDE.md` to internalize conventions that the bug may violate.
2. Invoke `Skill("ai-dlc:manage-memory", args: "software-engineer")` to load prior knowledge about this area.
3. Read the bug report, failing test output, or error description in full.
4. Identify which files and components are likely involved based on the report. Check `docs/architecture/decisions/` for ADRs covering them, and the project glossary if one exists, so you use the domain's names for things.
5. Read those files before forming any hypothesis.

---

## Phase 1 — Build a Feedback Loop

Produce **one command** that drives the real bug path and asserts the user's exact symptom. Work down this list and take the first option that reaches the bug; [references/feedback-loops.md](references/feedback-loops.md) describes each in detail:

1. A failing test at whatever level reaches the bug (unit, integration, end-to-end).
2. An HTTP request script against a locally running service.
3. A CLI run with a fixture input, diffed against a known-good output.
4. A headless browser script that drives the UI and asserts on the DOM, console or network.
5. A replay of a captured request, payload or event log through the code path in isolation.
6. A throwaway harness that boots the smallest slice of the system that still exercises the path.
7. A property or fuzz loop for "sometimes wrong" output.
8. A bisection harness when the bug appeared between two known states (commits, versions, datasets).
9. A differential loop that runs the same input through old vs new (or config A vs B) and diffs.
10. A human-in-the-loop script, only when a person must perform a step; it still prompts, captures and prints structured results.

Then **tighten** it: make it faster (narrow scope, skip unrelated setup), sharper (assert the specific symptom, not "did not crash") and deterministic (pin time, seed randomness, isolate the filesystem and network). For intermittent bugs the goal is a higher reproduction rate, not a perfect repro: repeat the trigger many times, parallelise, add load or widen timing windows until it fails often enough to debug against.

**If you cannot build a loop**, stop. List what you tried and ask the user for one of: access to an environment that reproduces it, a redacted captured artifact (log dump, HAR file, core dump, timestamped recording), or permission to add temporary instrumentation where it happens. Do not move on to hypotheses without a loop.

**Exit criterion.** Name the command, show one redacted run of it, and confirm it is:

- [ ] **Red-capable** — it exercises the actual bug path and checks the reported symptom, so it fails now and will pass once fixed
- [ ] **Deterministic** — same verdict on every run (intermittent bugs: a stable, high failure rate)
- [ ] **Fast** — seconds, not minutes
- [ ] **Unattended** — you can run it yourself; a human only through the structured script in option 10

If you notice yourself reading code to build a theory before this command exists, stop and return to building the loop.

---

## Phase 2 — Reproduce and Minimise

Run the loop and watch it fail. Confirm:

- [ ] The failure is the one the **user** described, not a neighbouring failure. Wrong bug, wrong fix.
- [ ] It reproduces across runs (or at the stable rate from Phase 1).
- [ ] The exact symptom is captured (message, wrong value, timing) so Phase 6 can prove it is gone.

Then shrink the scenario to the smallest one that still fails. Remove one input, caller, config value, data row or step at a time and re-run after each cut; keep only what the failure depends on. You are done when removing any remaining element makes the loop pass. The minimal repro narrows the hypothesis space and becomes the regression test in Phase 5.

---

## Phase 3 — Root Cause Investigation

**Rule: understand the cause before writing a single line of fix code.**

1. **Locate the failure point** — find the exact file, class, and method where the incorrect behavior originates. Use Grep and Read; do not guess.

2. **Trace the call chain** — read from the entry point (middleware, filter, endpoint) down to the failure point. Identify every component the request passes through, the state each one changes, and which component *owns* each value or rule on the way. Keep the observed symptom (where it shows up) separate from the inferred cause (where it originates); they are often in different components.

3. **Rank hypotheses** — write **3–5** candidate causes, ranked by likelihood, before testing any of them. A single hypothesis anchors you on the first plausible idea. Each must be falsifiable:
   - "If `<X>` is the cause, then changing `<Y>` makes the bug disappear (and changing `<Z>` makes it worse)."
   - A hypothesis with no prediction is not testable; sharpen it or drop it.

   Show the ranked list to the user before testing. They often know something that re-ranks it instantly ("we changed #3 yesterday") or rules a candidate out. Do not block on an answer; if the user is away, test in your own order.

4. **Probe one variable at a time** — every probe tests a specific prediction from step 3.
   - Prefer a debugger or REPL breakpoint over logging; one breakpoint beats ten log lines.
   - Otherwise add targeted logs only at the boundaries that separate hypotheses — never "log everything and search".
   - Tag every temporary log with a unique marker such as `[DEBUG-7c1e]` so cleanup is a single search.
   - **Performance regressions:** logs mislead. Take a baseline measurement first (timing harness, profiler, query plan), then bisect against it. Measure before changing anything.

5. **State and verify the root cause** —
   - "The bug is in `ClassName.MethodName` at `path/to/file:42` because `<reason>`."
   - Check that this is the *only* thing that needs to change. If fixing it would require changes in three unrelated places, you have found a symptom, not the root cause.

6. **Present the root cause to the user** before writing any fix. State:
   - File and line number
   - What the code does now
   - What it should do instead
   - Why this is the root cause and not a symptom
   - Which hypothesis it confirmed and which were ruled out

Wait for confirmation before proceeding to Phase 4.

---

## Phase 4 — Minimal Fix Design

Design the smallest change that corrects the root cause:

- **Fix at the narrowest responsible layer** — change the component that owns the incorrect behaviour (from the ownership trace in Phase 3), not the place where the symptom surfaces. A guard added at a caller to absorb a bad value from below hides the defect from every other caller.
- **Preserve surrounding behaviour** — public interfaces, error and failure behaviour, ordering, logging and compatibility stay as they were unless changing them *is* the fix. Uncommitted changes already in the working tree belong to the user; leave them alone.
- Change only what the root cause requires — no refactoring, renaming, new abstractions, cleanup or "while I'm here" improvements
- If the fix requires touching more than two files, the root cause analysis may be incomplete — revisit Phase 3
- If the bug exists because a convention was violated (missing `{ data, error }`, leaked exception, sync disposal), fix only that violation — do not rewrite the surrounding code
- State exactly what will change: file path, method name, before → after

---

## Phase 5 — Regression Test, then Implementation

### Regression test first — at the right seam

Write the regression test **before** the fix, but only at a seam that reproduces the real bug pattern as it happens at the call site. A seam that is too shallow (one caller when the bug needs two, a unit test that cannot recreate the chain that triggered it) gives false confidence.

1. Turn the minimised repro from Phase 2 into a failing test at that seam.
2. Run it and watch it fail for the reported reason. If you forced the failure by editing code or a fixture, diff against the pristine version to prove the edit is what made it red.
3. Apply the fix (below).
4. Run it and watch it pass.
5. Re-run the Phase 1 loop against the original, un-minimised scenario.

**If no correct seam exists, that is a finding.** The architecture is preventing the bug from being locked down. Record it in the hand-off and flag it to **Zoran Horvat** (`system-engineer`), or to **Mark Richards** (`software-architect`) when the fix belongs at the architecture level, instead of writing a shallow test that would pass for the wrong reason.

### Implementation

Apply the fix following all project conventions:

#### Convention Checklist

- [ ] Explicit type declarations (`FileStream stream = new();` not `var`)
- [ ] `await using` for disposable resources
- [ ] `{ data, error }` return shape at boundaries — no unhandled exceptions crossing component lines
- [ ] No stack trace in any response body — catch at boundary, log internally, return sanitized error
- [ ] Logger (`ILogger<T>`), not `Console.Write*`
- [ ] No new concrete dependencies — constructor-injected abstractions only

After applying the fix, re-read the changed file to confirm no unintended side effects.

---

## Phase 6 — Verify

### Build

```
dotnet build
```

Fix all compilation errors before continuing.

### Run tests

```
dotnet test
```

- All previously passing tests must still pass — a fix that breaks other tests is a regression
- The regression test from Phase 5 must now pass
- If no regression test could be written (no correct seam), the reason is recorded — it is never silently skipped

### Regression check

Identify the components adjacent to the fix — read their tests and confirm none were affected. If in doubt, run the full test suite and inspect failures. Re-run the Phase 1 loop one last time; it must pass.

---

## Phase 7 — Cleanup and Commit

### Cleanup

- [ ] Every tagged debug log is removed — search for the marker and confirm zero hits
- [ ] Throwaway harnesses, scripts and captured artifacts are deleted, or moved to a clearly marked debug location the user agreed to
- [ ] No captured artifact containing secrets or personal data is left in the working tree

### Commit

Stage only the files changed for this fix. Write the message by [commit-messages.md](../implement-feature/references/commit-messages.md) (the repository's own convention first, else Conventional Commits with type `fix`). For a bug fix the message also:

- Names the component and the defect in the subject
- States, in the body, the hypothesis that proved correct, so the next person debugging this area learns from it
- Does not reference internal tracking IDs unless the user provides one

Example (Conventional Commits):
```
git add <specific files>
git commit -m "fix(validator): handle absent Authorization header" -m "Root cause: the header lookup returned null for absent headers and the validator dereferenced it before the presence check."
```

---

## Quality Gate

Do not mark the bug fixed until:

- [ ] A red-capable feedback loop was built and shown failing before the fix, and passes after it
- [ ] Root cause is stated with file path and line number, and named as the confirmed hypothesis
- [ ] `dotnet build` exits with 0 errors
- [ ] `dotnet test` exits with 0 failures, including a regression test that failed before the fix and passes after it (or the missing seam is documented and flagged)
- [ ] No previously passing test was broken by the fix
- [ ] Stack traces cannot escape to clients via any changed code path
- [ ] The fix touches only what the root cause requires, in the layer that owns the defect — no unrelated changes, and surrounding behaviour is unchanged
- [ ] All tagged debug instrumentation and throwaway harnesses are gone

Adapted in part from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT).
Adapted in part from [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) (Apache-2.0); modified.
