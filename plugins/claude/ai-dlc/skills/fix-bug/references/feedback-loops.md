# Feedback Loops for Bug Work

Companion to Phase 1 of the `fix-bug` skill. A feedback loop is one command that runs the bug path and reports pass or fail on the user's exact symptom. Pick the first kind below that reaches the bug, then tighten it.

## Kinds of loop, in order of preference

| # | Loop | Use when | Notes |
|---|---|---|---|
| 1 | **Failing test** | A test can reach the bug at some level (unit, integration, end-to-end) | Becomes the regression test almost for free. Pick the level that reproduces the real call pattern. |
| 2 | **HTTP request script** | The bug shows through an API of a locally running service | Assert on status, body fields or headers that carry the symptom, not just "2xx". |
| 3 | **CLI with fixture** | The program is driven from the command line | Keep a known-good output file and diff against it. |
| 4 | **Headless browser script** | The symptom is only visible in the UI | Assert on DOM state, console errors or network calls; avoid screenshots as the oracle. |
| 5 | **Captured-trace replay** | You have a real request, payload or event log that triggers it | Save it to disk (redacted), feed it straight into the code path in isolation. |
| 6 | **Throwaway harness** | The full system is too heavy to boot | Start one service or module with stubbed external dependencies and call the path directly. Delete it in cleanup. |
| 7 | **Property / fuzz loop** | Output is "sometimes wrong" | Generate many random inputs, check an invariant, keep the first failing input as a fixture. |
| 8 | **Bisection harness** | It worked at state A and fails at state B (commit, dependency version, dataset) | Script "set up state, run check, report", then let the VCS bisect command drive it (for git: `git bisect run <script>`). |
| 9 | **Differential loop** | An old version or alternative config behaves correctly | Run identical input through both and diff the outputs. |
| 10 | **Human-in-the-loop script** | A person must perform a step (sign in with hardware key, physical device, third-party UI) | Last resort. See the pattern below. |

## Tightening

Treat the loop as something you are building, not a one-off. After the first version works, ask:

- **Faster?** Cache setup, skip unrelated initialisation, narrow the test filter to one test.
- **Sharper?** Assert the specific symptom (the wrong value, the exact message) instead of "did not throw".
- **More deterministic?** Pin the clock, seed random generators, use an isolated temp directory, stub the network.

A slow, flaky loop is barely better than none. A loop that answers in two seconds with the same verdict every time is what makes the rest of the skill mechanical.

## Intermittent bugs

Aim for a higher failure rate, not a perfect repro:

- Run the trigger many times in a row and in parallel.
- Add load, shrink timeouts, or insert short delays at suspected race points to widen the timing window.
- Record the failure rate before and after each change. A bug that fails half the time is debuggable; one that fails once in a hundred runs is not yet — keep raising the rate.

## Human-in-the-loop pattern

When a person has to do part of the reproduction, still drive it from a script so the steps and the observations are structured and repeatable:

- The script prints one instruction at a time and waits for the person to confirm it is done.
- Where you need an observation, the script asks a specific question (yes/no, or "paste the message") and stores the answer.
- At the end it prints every captured answer as `KEY=value` lines, which you read back as the loop's result.
- Ask only for observations. Anything the person types is echoed back to you, so never ask them to type a password or token; make signing in an instruction step instead.

A minimal Bash shape (the same structure works in PowerShell with `Read-Host`):

```bash
#!/usr/bin/env bash
set -euo pipefail

instruct() { printf '\n>>> %s\n' "$1"; read -r -p '    press Enter when done ' _; }
ask()      { printf '\n>>> %s\n' "$2"; read -r -p '    > ' reply; printf -v "$1" '%s' "$reply"; }

# Steps for this bug
instruct "Start the app locally and sign in."
ask FAILED "Open the report page and press 'Export'. Did it fail? (y/n)"
ask MESSAGE "Paste the error text shown, or 'none':"

printf '\n--- result ---\nFAILED=%s\nMESSAGE=%s\n' "$FAILED" "$MESSAGE"
```

Keep the script in the scratch or temp area, not in the repository, and delete it during cleanup.

## When no loop is possible

Stop and report what you tried. Ask for one of:

- access to an environment where the bug reproduces;
- a redacted captured artifact (log dump, HAR file, core dump, timestamped recording);
- permission to add temporary, tagged instrumentation where the bug occurs.

Do not start hypothesising until one of these gives you a loop.
