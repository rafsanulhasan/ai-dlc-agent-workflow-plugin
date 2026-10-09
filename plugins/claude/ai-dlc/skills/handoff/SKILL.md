---
name: handoff
description: "Records and verifies the artifact that crosses an AI-DLC stage boundary. Use whenever one agent's stage ends and another's begins (spec → design, design → build, build → test, test → review, review → release) so the receiving agent starts from a verified, self-contained handoff file instead of chat history. Also use mid-stage, when a session must pass unfinished work to a fresh agent or session (context running out, pausing, switching machines), to write a compact session handoff. Also use for verification-only work (\"check it's done\", \"run the gates\", last-mile proof before a gate), which proves the acceptance criteria without expanding scope and then stops."
---

# Handoff

Every AI-DLC stage boundary is crossed with a handoff record. The record is what the next agent reads first, what **Scott Hanselman** (`orchestrator`) verifies, and what the human approves at a gate.

> Agent names are the defaults; a name chosen at `/ai-dlc:init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## When to use

- A stage in any lifecycle from the `ai-dlc` skill finishes and the next agent is about to be spawned.
- A loop returns work to an earlier stage (review Blockers back to the engineer, spec change back to ASDLC).
- A human gate (G1–G4) needs a single document to approve.
- A session has to stop **mid-stage** and a fresh agent or session will continue the same work: write a session handoff instead (see *Session handoff* below).
- The task is **verification only** — prove that existing work meets its acceptance criteria before a boundary or gate: follow *Verification-only work* below.

## Procedure

1. **Collect the evidence.** List every artifact the stage produced, by path. Run the cheap checks the stage claims (for build stages: `dotnet build`, `dotnet test`; for test stages: the mutation report path). Record the actual results, not the agent's summary.
2. **Write the record** at `docs/handoffs/<work-item-id>/<NN>-<from>-to-<to>.md` (`NN` is the next sequence number in that folder) using the template below.
3. **Verify.** The orchestrator (or the sending agent when no orchestrator is running) opens each listed artifact and confirms it exists and matches its claim. Set `Verification` to `passed` or `failed` with the reason.
4. **Gate.** If the boundary is a human gate, stop and ask the human to approve the record. Otherwise continue.
5. **Brief the receiver.** Spawn the next agent with `Skill("ai-dlc:agent-invocation")` and pass the handoff file path as the first item of *Required context*.

## Receiving a handoff

The receiving agent verifies its input before building on it.

1. Read the record, then open every listed artifact and the ACs it covers.
2. List everything unclear, contradictory or missing: an AC that admits two readings, a design that does not say who owns a responsibility, a test result that does not match the diff.
3. If the list is not empty, return one batched clarification request to the orchestrator before starting the blocked work (format: `agent-invocation`, *Clarification requests*; whom to ask: the consultation matrix in the `ai-dlc` skill, *Clarify loop*). Continue only with work the questions do not block.
4. When the answers arrive, record them in the *Clarifications* section of the record **you** write at the end of your stage. Do not edit the incoming record, and do not change an upstream artifact yourself — its owner does.

## Template

```markdown
---
work-item: WI-NNN
lifecycle: PDLC | ASDLC | STBLC | FDLC | BFLC | RLC | TLC | CRLC
from: <agent>
to: <agent>
gate: none | G1-clarify | G2-refine | G3-plan | G4-approve
verification: pending | passed | failed
date: YYYY-MM-DD
---

# <from> → <to>: <one-line summary>

## Artifacts
- `<path>` — <what it is>

## Acceptance criteria covered
| AC | Where it is satisfied / tested |
|---|---|
| AC-1 | `<file>:<line>` / `<test name>` |

## Gate evidence
- Build: <command + result, or n/a>
- Tests: <passed/failed counts, or n/a>
- Mutation: <score vs baseline, or n/a>
- Review: <Blockers / Warnings / Suggestions counts, or n/a>

## Decisions made in this stage
- <decision> — <ADR path if any>

## Clarifications
| # | Asked → answered by | Refers to | Question | Answer | Artifact revised by owner |
|---|---|---|---|---|---|
| Q1 | <asker> → <upstream agent or human> | `<path>` / AC-n | <question> | <answer> | none / `<path>` |

## Open questions / risks for the receiver
- <item>

## Suggested skills
- `<skill>` — <why the receiver needs it for this task>

## Instructions for the receiver
<the scoped task, in the receiver's terms>
```

## Rules

- A handoff with `verification: failed` is never passed forward; send the work back to the sender with the failure reason.
- Never paste large artifacts into the record — link them by path. Do not restate what a spec, ADR, plan, issue, commit or diff already says; reference it by path, URL or SHA and add only what is written down nowhere else.
- Redact before writing: replace secrets, tokens, connection strings, passwords and personal data with `<REDACTED>`. Handoff records are committed and read by every later agent.
- Name the skills the receiver should load under *Suggested skills*, so a cold-started agent does not have to rediscover which workflow applies.
- One record per boundary crossing; loops create new records rather than editing old ones, so the history of a work item stays auditable.
- Every clarification the stage asked, and its answer, appears under *Clarifications*; write `none` when there were none.
- Artifact-only lifecycles (agent/skill changes) do not need handoff records.

## Verification-only work

Sometimes the whole task is to prove that work already done meets its acceptance criteria — the orchestrator checking a stage's claim, a last gate run before G4, or a human asking "is this actually finished?". Verification proves; it does not build.

1. **Turn each acceptance criterion into the smallest proof that settles it** — a named test, a command and its expected output, a file and line. Put them in the *Acceptance criteria covered* table before running anything.
2. **Reuse results only when they are still current.** An earlier run counts if it was made on the same commit with no uncommitted changes since; otherwise run it again.
3. **Run focused checks first**, then the wider gates the boundary requires (full build, full suite, mutation). A focused failure ends the run early with a precise reason.
4. **Record each check with one of four outcomes**, never rounded up:
   - `pass` — ran and met the criterion;
   - `fail` — ran and did not;
   - `unavailable` — could not run here (missing tool, service or environment), with what is missing;
   - `blocked` — cannot run until something else happens (a dependency, an approval, a fix), with what it waits for.
5. **Do not change product code or tests**, unless the request explicitly includes fixing what fails. A failure is reported back to its owner, not repaired in passing.
6. **Do not add scope once the criteria pass** — no polish, cleanup, refactors or extra tests. Note anything worth doing under *Open questions / risks*.
7. **Stop as soon as every criterion has an outcome.** Set `verification` to `passed` only when every criterion is `pass`; any `fail`, `unavailable` or `blocked` makes it `failed`, with the reason. Report the commands run, their results and the unresolved risks — nothing else.

## Session handoff (mid-stage)

When a session must stop before its stage is finished — the context window is nearly full, the human is pausing, or the work moves to another machine or tool — compact the conversation into a session handoff so a fresh agent can continue without the chat history.

1. **Ask what the next session is for**, if the caller has not said. Tailor the document to that focus and leave out what it will not need.
2. **Write it outside the repository**, in the operating system's temp directory (`$TMPDIR`, else `/tmp`; `%TEMP%` on Windows), named `<work-item-id>-session-<YYYYMMDD-HHMM>.md`. It is a working note, not an audit record, so it does not belong in `docs/handoffs/` and is never committed. Give the caller the full path.
3. **Reference, don't copy.** Link the spec, plan, ADRs, earlier handoff records, branch and commits by path, URL or SHA.
4. **Redact** exactly as for stage records.

```markdown
# Session handoff: <work item> — <one-line goal>

- Lifecycle / stage: <lifecycle> / <stage>, agent `<agent>`
- Branch and last commit: <branch> @ <sha>
- Next session focus: <what the caller said the next session is for>

## Done so far
- <outcome> — <path / sha>

## In progress
- <what was being changed, which files, and their state (builds? tests pass?)>

## Next steps
1. <the very next action>

## Decisions and dead ends
- <decision, or approach tried and abandoned, and why>

## References
- <spec / plan / ADR / handoff record paths>

## Suggested skills
- `<skill>` — <why>
```

A session handoff never replaces the stage-boundary record: when the resumed stage finishes, write the normal handoff record above.

Adapted in part from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT).
Adapted in part from [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) (Apache-2.0); modified.
