---
name: handoff
description: "Records and verifies the artifact that crosses an AI-DLC stage boundary. Use whenever one agent's stage ends and another's begins (spec → design, design → build, build → test, test → review, review → release) so the receiving agent starts from a verified, self-contained handoff file instead of chat history. Also keeps each work item's run state (docs/handoffs/<work-item>/run.md: request, intent, Routing Plan, stage status, gate decisions, open clarifications, next action), written before every spawn and after every return or gate, so a new session can resume a run after a crash or lost context; and stores every agent's hand-back (the report it returns when its stage or round ends) verbatim next to them. Also use mid-stage, when a session must pass unfinished work to a fresh agent or session (context running out, pausing, switching machines), to write a compact session handoff. Also use for verification-only work (\"check it's done\", \"run the gates\", last-mile proof before a gate), which proves the acceptance criteria without expanding scope and then stops."
---

# Handoff

Every AI-DLC stage boundary is crossed with a handoff record. The record is what the next agent reads first, what **Scott Hanselman** (`orchestrator`) verifies, and what the human approves at a gate.

> Agent names are the defaults; a name chosen at `/ai-dlc:init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## When to use

- A stage in any lifecycle from the `ai-dlc` skill finishes and the next agent is about to be spawned.
- A loop returns work to an earlier stage (review Blockers back to the engineer, spec change back to ASDLC).
- A human gate (G1–G4) needs a single document to approve.
- A stage agent has returned: store its hand-back first (see *Hand-back record* below).
- The orchestrator is about to spawn a stage agent, or one has returned, or a gate was decided: update the work item's run state (see *Run state* below).
- A session has to stop **mid-stage** and a fresh agent or session will continue the same work: write a session handoff instead (see *Session handoff* below).
- The task is **verification only** — prove that existing work meets its acceptance criteria before a boundary or gate: follow *Verification-only work* below.

## Procedure

1. **Collect the evidence.** List every artifact the stage produced, by path. Run the cheap checks the stage claims (for build stages: the project's build and test commands recorded at init in `CLAUDE.md` / `.github/copilot-instructions.md`, e.g. `dotnet build` / `dotnet test` or `npm run build` / `npm test`; for test stages: the mutation report path). Record the actual results, not the agent's summary.
2. **Write the record** at `docs/handoffs/<work-item-id>/<NN>-<from>-to-<to>.md` (the folder is `artifacts.handoffs` of the effective workflow when `.ai-dlc/workflow.json` sets it) (`NN` is the next sequence number in that folder) using the template below.
3. **Verify.** The orchestrator (or, when no orchestrator is running, the session's main agent — for example **Boris Cherny** (`agent-manager`) run directly — or else the sending agent) opens each listed artifact and confirms it exists and matches its claim. Set `Verification` to `passed` or `failed` with the reason.
4. **Gate.** If the stage ends at a gate, follow the gate's `approver` in the effective workflow (default: `human` for every gate): `human` — stop and ask the human to approve the record; `orchestrator` — the orchestrator approves it and writes `approved by orchestrator` under *Gate evidence*; `none` — continue. Otherwise continue.
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
lifecycle: <lifecycle code from the effective workflow — default AI-DLC | PDLC | ASDLC | STBLC | FDLC | BFLC | RLC | TLC | CRLC | Release | AAW>
from: <agent>
to: <agent>
gate: none | <gate id from the effective workflow — default G1 | G2 | G3 | G4 | release>
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
- Gate: <gate id> · approver <human | orchestrator | none> · <approved by … | skipped (none) | n/a>

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
- Artifact-only work (the `AAW` lifecycle: agent, skill, hook, rule, command and workflow changes) writes no handoff records; its run state records each round and links the hand-backs of `agent-manager` and of every reviewer.

## Hand-back record

The report an agent returns when its stage or loop round ends — `agent-manager`'s `Changed paths` / `Intent` / `Checks`, a critic's verdict, a reviewer's findings, a test report, a clarification request — is its **hand-back**. It exists only in the caller's context until someone writes it down, so it is stored like a handoff record and survives a crash or a lost connection.

- **Where:** `docs/handoffs/<work-item-id>/<NN>-<agent>-handback.md` (the `artifacts.handoffs` folder of the effective workflow). `NN` continues the sequence the handoff records use in that folder; parallel agents get one number each, in the order of their Agent calls.
- **Who:** the writer of the run state — the orchestrator, or the main agent when there is none. A spawned agent never writes its own, so agents without Write (**Jon Skeet** (`research-assistant`), **Robert C. Martin** (`code-reviewer`)) have theirs stored too. The one exception: a main agent that does stage work itself (`agent-manager` run directly, in `AAW`) writes its own hand-back each round, before it spawns reviewers.
- **When:** as soon as the agent returns, **before** verifying or acting on it; then the run state links it in the stage's row.
- **What:** the report verbatim under the front matter below. Redact secrets and personal data (`<REDACTED>`); never summarise, correct or append to it. Your verification result goes into the handoff record or the run state, not here.
- **Committed** with the run state at each gate and when the work item closes; `AAW` has no gates, so its run state and hand-backs are committed when the run closes.

```markdown
---
work-item: WI-NNN
agent: <agent id>
stage: <stage id>
round: <1, or the loop round>
lifecycle: <lifecycle code from the effective workflow, e.g. FDLC | AAW>
received: YYYY-MM-DD HH:MM
---

<the agent's report, verbatim>
```

## Run state

A run must survive a crash, a dropped connection or a lost context. Every work item keeps one checkpoint file, `docs/handoffs/<work-item-id>/run.md` (the `artifacts.handoffs` folder of the effective workflow), next to its handoff records. Handoff records say what crossed each boundary; the run state says where the run is and what happens next. Agent-artifact work that has no work item uses `AAW-<YYYYMMDD>-<slug>` as its id.

**Who writes it.** The orchestrator. When no orchestrator is running, the session's main agent does — for example `agent-manager` run directly by a developer. A subagent never writes it; it reports, and the caller records.

**When it is written** — always before acting, so a crash leaves the last intention on disk:

- **before the first spawn of the run**, whatever the lifecycle (create it: request, clarified intent, Routing Plan row or "AAW", every stage `pending`). Normally that is when the human confirms the Routing Plan; a route-immediately item (P0, security fix) gets it at route time, before confirmation; an `AAW` run gets it before the first `agent-manager` spawn;
- **before** each spawn: the stage `in-progress`, the brief's source, and *Next action* = what to do when the agent returns or if it never does;
- **after** each return: the hand-back path (stored first, see *Hand-back record*), verification result, the handoff record path, the stage `done` or `blocked`, the next action;
- after each gate decision, loop round and clarification round;
- at the end: `status: done` (or `abandoned`, with the human's reason).

**Committing it.** Every checkpoint is written to disk at once; that alone survives a crash or a dropped connection. The writer (the orchestrator, or the main agent when there is none) commits `run.md` at each gate and when the work item closes, with the handoff records and hand-backs written since the last commit, so the run also survives a lost machine and is visible to the team.

**Ownership.** `owner` is the agent that writes the file (`orchestrator` or the main agent), `session` identifies the session that last wrote it, and `branch` is the branch the run works on. Two sessions never drive one run at the same time.

**Resuming.** At the start of every session the orchestrator lists `run.md` files whose `status` is `active` or `blocked`. It offers to resume only runs whose `branch` is the current branch; for a run on another branch, or one another session wrote last, it asks the human before taking it over and then records its own `session`. Before going on it re-verifies the last handoff record the file names (each artifact still exists and matches; the branch and commit still hold) and, for a stage left `in-progress`, checks whether that agent's output landed (a stored hand-back, or the artifacts themselves) before spawning it again.

```markdown
---
work-item: WI-NNN
status: active | blocked | done | abandoned
lifecycle: <lifecycle code from the effective workflow>
current-stage: <stage id>
owner: orchestrator | <main agent id when there is no orchestrator>
session: <session id, or host + start time>
branch: <branch>
commit: <sha at the last checkpoint>
updated: YYYY-MM-DD HH:MM
---

# Run: WI-NNN — <one-line summary>

## Request
<the human's request as given, redacted>

## Clarified intent
<goal, constraints and what "done" means, as confirmed with the human>

## Routing Plan
<this item's row of the Routing Plan; confirmed by the human on YYYY-MM-DD; one-off overrides; other items of the same plan with their run.md paths>

## Stages
| Stage | Owner | Status | Hand-back | Handoff record | Updated |
|---|---|---|---|---|---|
| <stage id> | <agent> | pending / in-progress / done / blocked / skipped (`when`) | `<NN>-<agent>-handback.md` / — | `<NN>-<from>-to-<to>.md` / — | YYYY-MM-DD HH:MM |

## Gates and loops
| Gate or loop | Approver / round | Decision | By | Date |
|---|---|---|---|---|
| G2 | human | approved | <name> | YYYY-MM-DD |
| review → build | round 1 / 3 | Blockers sent back | orchestrator | YYYY-MM-DD |

## Open clarifications
| # | Asker → upstream | Question | Round | Status |
|---|---|---|---|---|

## Next action
<exactly one action: spawn <agent> for <stage> with the brief from `<handoff record>` · verify `<record>` · relay Q<n> to <agent> · ask the human to approve <gate> — and what to check first when resuming>
```

Keep it short: link artifacts and records by path, never paste them, and redact exactly as for stage records.

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
2. **Write it to the scratch folder**, `<scratchpad root>/<work-item-id>/` (the gitignored root recorded in AGENTS.md "Workspace folders"), named `<work-item-id>-session-<YYYYMMDD-HHMM>.md`. It is a working note, not an audit record, so it does not belong in `docs/handoffs/` and is never committed. Give the caller the full path.
3. **Reference, don't copy.** Link the spec, plan, ADRs, earlier handoff records, branch and commits by path, URL or SHA.
4. **Point to the run state.** Update the work item's `run.md` first (the orchestrator, or the main agent when there is none) (*Next action* = continue this stage from the session handoff, with its path), and link the run state at the top of the session handoff. The run state is committed and survives; the session handoff is a working note.
5. **Redact** exactly as for stage records.

```markdown
# Session handoff: <work item> — <one-line goal>

- Run state: `docs/handoffs/<work-item-id>/run.md`
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
