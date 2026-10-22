---
name: handoff
description: "Records and verifies every hand-off in an AI-DLC run and keeps its run state. Use before any spawn, loop round or hand-off between agents (AAW included), whenever an agent returns its report, at every gate, and at session start to resume an unfinished run after a crash or lost context. Also use mid-stage, when a session must pass unfinished work to a fresh agent or session (context running out, pausing, switching machines; on Claude Code the automatic handoff does it at the context threshold), when a session was seeded by such an automatic handoff, and for verification-only work (\"check it's done\", \"run the gates\"), which proves the acceptance criteria without expanding scope."
---

# Handoff

Every time work changes hands in an AI-DLC run, two records cross the boundary: the **handoff record** the sender writes before the hand-off (what to do, from which verified inputs) and the **hand-back** the receiver returns when it is done (what it did, verbatim). Both live in the run's folder, next to the run state. The receiving agent reads the handoff first, **Scott Hanselman** (`orchestrator`) keeps the run state, and the human approves a record at each gate.

> Agent names are the defaults; a name chosen at `/init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## When to use

- Any agent is about to hand work to another — a spawn, a message to a teammate, a loop round sent back, a fan-out to parallel agents: write the handoff record first (*Procedure*).
- An agent has returned or finished: store its hand-back first (*Hand-back record*).
- You received a handoff: verify it before you start (*Receiving a handoff*).
- A human gate (G1–G4, release) needs a single document to approve.
- The orchestrator is about to spawn, has received a return, or a gate was decided: update the run state (*Run state*).
- A session has to stop **mid-stage** and a fresh agent or session will continue the same work: write a session handoff instead (*Session handoff*). On Claude Code the automatic path writes it when the context fills.
- A session was seeded by an automatic handoff (its first prompt starts `[auto-handoff] ↪ Handoff from session`): read the session handoff it names, then resume the run from its `run.md` (*Run state*, Resuming).
- The task is **verification only** — prove that existing work meets its acceptance criteria: follow *Verification-only work*.

## Naming

**Run folder:** `docs/handoffs/{LIFECYCLE}-{YYYYMMDD}-{feature-slug}/` — `artifacts.handoffs` of the effective workflow when `.ai-dlc/workflow.json` sets it. `{LIFECYCLE}` is the run's lifecycle code: a key of the effective workflow's `lifecycles` (`node .ai-dlc/workflow.mjs show` lists them; that list is the only one). `{YYYYMMDD}` is the run's start date, `{feature-slug}` kebab-case. A work-item id, if the run has one, goes in the `work-item:` front matter, not the folder name. One folder per run; it holds `run.md` and every record of the run.

**Record files:**

```
{step}[.{sub}][.l{loop}]-{from-agent}-to-{to-agent}.handoff.md
{step}[.{sub}][.l{loop}]-{from-agent}-to-{to-agent}.handback.md
```

- `step` — a whole number, starting at 1, that grows by one for each new hand-off in the run.
- `.sub` — `.1`, `.2`… when one sender fans out to parallel agents under one step, in spawn order; also for nested spawns under a parent step (below). A fan-out uses up its whole number: after `4.1` and `4.2` there is no bare `4-…` record, and the next hand-off is `5`.
- `.l{n}` — loop round `n` re-running that step; it keeps the step code (`3.l1`, `4.1.l1`). The first pass has no `l` suffix, and a loop round never takes a new step number. A record corrected after its receiver reported it `failed` is also a new `.l{n}` of the same step, never an edit of the old file: `3-orchestrator-to-software-engineer.handoff.md` fails, so the writer sends `3.l1-orchestrator-to-software-engineer.handoff.md`.
- `from` / `to` — agent IDs only, never persona names. A hand-back swaps them: `from` is the agent returning the work, `to` the one that handed it off. `human` is the only other name allowed, as the `to` of a gate record that has no next agent. A `to: human` record has no hand-back: the human's decision is recorded in the run state.

Worked examples:

| Situation | Handoff | Hand-back |
|---|---|---|
| Subagent mode: the orchestrator briefs the engineer | `3-orchestrator-to-software-engineer.handoff.md` | `3-software-engineer-to-orchestrator.handback.md` |
| Agent team: the architect hands the design to the system engineer (Refine) | `2-software-architect-to-system-engineer.handoff.md` | `2-system-engineer-to-software-architect.handback.md` |
| Parallel fan-out after the build | `4.1-orchestrator-to-sqa-engineer.handoff.md`, `4.2-orchestrator-to-documentation-writer.handoff.md` | `4.1-sqa-engineer-to-orchestrator.handback.md`, `4.2-documentation-writer-to-orchestrator.handback.md` |
| Review Blockers send the build back, round 1 | `3.l1-orchestrator-to-software-engineer.handoff.md`; its tests re-run as `4.1.l1-…` | `3.l1-software-engineer-to-orchestrator.handback.md` |
| Nested spawn (Claude Code): `sqa-engineer` at step 4.1 spawns its own test writers | `4.1.1-sqa-engineer-to-sqa-engineer.handoff.md`, `4.1.2-…` | `4.1.1-sqa-engineer-to-sqa-engineer.handback.md` |
| `AAW`: change, then critique | `1-orchestrator-to-agent-manager.handoff.md`, `2-orchestrator-to-brutal-critique.handoff.md` | `1-agent-manager-to-orchestrator.handback.md`, `2-brutal-critique-to-orchestrator.handback.md` |
| `AAW`, mixed change: docs and code reviewed in parallel, then the two `code-reviewer` axes | `2.1-orchestrator-to-brutal-critique.handoff.md`, `2.2-orchestrator-to-sqa-engineer.handoff.md`, then `3.1-orchestrator-to-code-reviewer.handoff.md`, `3.2-orchestrator-to-code-reviewer.handoff.md` | `2.1-brutal-critique-to-orchestrator.handback.md`, `2.2-sqa-engineer-to-orchestrator.handback.md`, `3.1-…`, `3.2-code-reviewer-to-orchestrator.handback.md` |
| A handoff its receiver reported `failed`, corrected | `3.l1-orchestrator-to-software-engineer.handoff.md` | `3.l1-software-engineer-to-orchestrator.handback.md` |

A clarification relayed with `SendMessage` to an agent that is still running is recorded in the run state and in the asker's hand-back; a fresh agent spawned to answer it is a new hand-off and gets the next step.

**Before the run folder exists.** Spawns made before the Routing Plan is confirmed — research to classify the request, the `product-manager` work breakdown, a `product-owner` consult — get records too, because the lifecycle and slug that name the run folder are not fixed yet: the orchestrator writes their handoffs and stores their hand-backs in `.scratch/<request-slug>/`, with the same file names and steps starting at 1. At Confirm, when it creates the run folder, it moves them in as the run's first steps and numbers the run's next hand-off after them. A request that never becomes a run (a question answered by research) leaves them in scratch.

## Who writes what

The orchestration mode (`request-routing`, Step 4) decides who writes each record. It is chosen per stage: Modes 1–4 are `subagent`, Mode 5 is `team`, and every record carries the `mode` of its own hand-off. The receiver verifies a handoff before it starts; the writer never verifies its own record.

| Mode | Handoff record | Hand-back | Run state |
|---|---|---|---|
| **Subagent** (the default; the only mode on GitHub Copilot) | The orchestrator writes `N-orchestrator-to-<agent>.handoff.md` — the brief — **before** each spawn | The orchestrator stores `N-<agent>-to-orchestrator.handback.md`, the agent's report verbatim, as soon as it returns. The agent writes neither: it returns its report | Orchestrator |
| **Main agent without an orchestrator** (for example **Boris Cherny** (`agent-manager`) run directly) | The main agent writes `N-<self>-to-<agent>.handoff.md` before each spawn | The main agent stores each report as `N-<agent>-to-<self>.handback.md` | The main agent |
| **Agent team** (Claude Code only; `request-routing`, Mode 5) | The sending teammate writes `N-<sender>-to-<receiver>.handoff.md` before it messages the receiver | The receiving teammate writes `N-<receiver>-to-<sender>.handback.md` when it is done; if the receiver has no Write tool (`code-reviewer`, `research-assistant`), it sends the report and the sender stores it | The orchestrator, as team lead, only; each teammate tells the lead the name of every record it writes |
| **Nested spawn** (Claude Code; a subagent with the `Agent` tool spawns its own subagents, within `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`) | The spawning subagent writes its children's handoffs under its own step: `4.1.1-…`, `4.1.2-…` | The spawning subagent stores its children's reports the same way; if it has no Write tool, it quotes them in its own report and the orchestrator stores each quote under the child's name — the one hand-back that is not verbatim, because only the quote reached it | Unchanged: the orchestrator. The spawning subagent lists the nested records in its own report. On GitHub Copilot, where nested spawning is not documented, the plugin assumes only the main agent spawns: the orchestrator fans the work out itself, or the agent does it in sequence |

## Procedure

The sender (by the table above) for each hand-off:

1. **Collect the evidence.** List every input artifact by path, with the result of verifying it: for the first stage, the request; after that, the previous hand-back and the artifacts it claims. Run the cheap checks the previous stage claims — for build stages the project's build and test commands recorded at init in `CLAUDE.md` / `.github/copilot-instructions.md`; for test stages the mutation report path. Record the actual results, not an agent's summary.
2. **Gate first, if one sits here.** When the previous stage ended at a gate, follow its `approver` in the effective workflow (default: `human` for every gate): fill *Gate evidence*, then `human` — stop and ask the human to approve this record; `orchestrator` — approve it and write `approved by orchestrator`; `none` — do not stop, but still write the record and have it verified. A gate with no next agent gets a record addressed `to: human`.
3. **Write the handoff record** with the next step code (*Naming*), from the template below, `verification: pending`. It is the receiver's brief: everything `Skill("agent-invocation")` requires in a brief, with artifacts linked by path.
4. **Update the run state** (subagent mode: the orchestrator; agent team: tell the lead), then **hand off**: spawn or message the receiver, giving the record's path as the first item of *Required context*.
5. **On return, store the hand-back first** (*Hand-back record*), then verify what it claims before the next hand-off — which starts again at step 1.

## Receiving a handoff

The receiver verifies its input before building on it; that is the record's verification.

1. Read the record, then open every listed artifact and the ACs it covers. Check that each exists and matches what the record says.
2. **Report the result as line 1 of your report**, in exactly this form, whatever contract or terminal reply follows it:

   ```
   handoff <file name>: passed|failed — <why>
   ```

   `passed` — every listed artifact exists and matches the record; `failed` — one does not, or the record is missing what you need to start. The writer of the run state copies `passed` or `failed` verbatim into the record's `verification` field when it stores your hand-back; in an agent team you also set the field yourself. (`blocked` and `unavailable` are only for *Verification-only work*.) A `failed` record goes back to its writer, who sends a corrected `.l{n}` record (*Naming*); do not start the work it blocks.
3. List everything unclear, contradictory or missing: an AC that admits two readings, a design that does not say who owns a responsibility, a test result that does not match the diff. If the list is not empty, return one batched clarification request before starting the blocked work (format: `agent-invocation`, *Clarification requests*; whom to ask: the consultation matrix in the `ai-dlc` skill, *Clarify loop*). Continue only with work the questions do not block.
4. When the answers arrive, list every question and answer under *Clarifications* in your hand-back (your report). Never edit the incoming record beyond its `verification` field, and never change an upstream artifact yourself — its owner does.

## Handoff template

```markdown
---
run: <LIFECYCLE>-<YYYYMMDD>-<feature-slug>
work-item: <WI-NNN | none>
lifecycle: <a key of the effective workflow's lifecycles>
step: <step code, e.g. 3 | 4.1 | 3.l1>
from: <agent id>
to: <agent id | human>
mode: subagent | team   # this hand-off's mode: request-routing Modes 1–4 = subagent, Mode 5 = team
loop: none | <round n, matching .l<n>>
gate: none | <gate id from the effective workflow — default G1 | G2 | G3 | G4 | release>
verification: pending | passed | failed | blocked | unavailable
date: YYYY-MM-DD
---

# <step> <from> → <to>: <one-line summary>

## Goal
<the outcome, and why it matters>

## Artifacts
- `<path>` — <what it is> — <verified: exists, matches its claim>

## Acceptance criteria covered
| AC | Where it is satisfied / tested |
|---|---|
| AC-1 | `<file>:<line>` / `<test name>` |

## Gate evidence
- Build: <command + result, or n/a>
- Tests: <passed/failed counts, or n/a>
- Mutation: <score vs baseline, or n/a>
- Review: <Blockers / Warnings / Suggestions counts, or n/a>
- Gate: <gate id> · approver <human | orchestrator | none> · <approved by … | not stopped (none) | n/a>

## Decisions so far
- <decision> — <ADR path if any>

## Clarifications carried forward
| # | Asked → answered by | Refers to | Question | Answer | Artifact revised by owner |
|---|---|---|---|---|---|

## Open questions / risks for the receiver
- <item>

## Suggested skills
- `<skill>` — <why the receiver needs it for this task>

## Instructions for the receiver
<the scoped task, in the receiver's terms; the expected deliverable; the next hop>
```

## Rules

- A handoff with `verification: failed` is never built on; it goes back to its writer with the reason.
- Never paste large artifacts into a record — link them by path. Do not restate what a spec, ADR, plan, issue, commit or diff already says; reference it by path, URL or SHA and add only what is written down nowhere else.
- Redact before writing: replace secrets, tokens, connection strings, passwords and personal data with `<REDACTED>`. Records are committed and read by every later agent.
- Name the skills the receiver should load under *Suggested skills*, so a cold-started agent does not have to rediscover which workflow applies. In an agent team this is required: teammates do not load the `skills` listed in an agent's frontmatter.
- One record per hand-off; a loop round writes new `.l{n}` records rather than editing old ones, so the history of a run stays auditable.
- Every lifecycle writes handoff records and hand-backs, `AAW` included.
- The orchestrator re-verifies the latest records and artifacts at every gate, even when a receiver already verified them.

## Hand-back record

The report an agent returns when its stage or loop round ends — `agent-manager`'s `Changed paths` / `Intent` / `Checks`, a critic's verdict, a reviewer's findings, a test report, a clarification request, a verification result — is its **hand-back**. Until someone writes it down it exists only in the caller's context, so it is stored at once and survives a crash or a lost connection.

- **Where:** the run folder, named with the step code of the handoff it answers and the agents swapped: `3-software-engineer-to-orchestrator.handback.md` answers `3-orchestrator-to-software-engineer.handoff.md`.
- **Who:** by mode (*Who writes what*): in subagent mode the orchestrator (or the main agent when there is none) stores it, so agents without Write — **Jon Skeet** (`research-assistant`), **Robert C. Martin** (`code-reviewer`) — have theirs stored too; in an agent team the receiving teammate writes it.
- **When:** as soon as the agent returns, **before** verifying or acting on it; then the run state links it in the stage's row.
- **What:** the report verbatim under the front matter below (the one exception: a nested child's report that reached you only as a quote, *Who writes what*). Redact secrets and personal data (`<REDACTED>`); never summarise, correct or append to it. Your verification of it goes into the next handoff record or the run state, not here.
- **Committed** with the run state at each gate and when the run closes; `AAW` has no gates, so its records are committed when the run closes.

```markdown
---
run: <LIFECYCLE>-<YYYYMMDD>-<feature-slug>
work-item: <WI-NNN | none>
lifecycle: <a key of the effective workflow's lifecycles>
step: <the step code of the handoff it answers>
from: <agent returning the work>
to: <agent that handed it off>
mode: subagent | team
loop: none | <round n>
received: YYYY-MM-DD HH:MM   # a date alone only for records migrated from before this convention
---

<the agent's report, verbatim>
```

## Run state

A run must survive a crash, a dropped connection or a lost context. Every run keeps one checkpoint file, `run.md`, in its run folder. The records say what crossed each boundary; the run state says where the run is and what happens next.

**Who writes it.** The orchestrator — in an agent team too, as team lead. When no orchestrator is running, the session's main agent does, for example `agent-manager` run directly by a developer. A subagent or teammate never writes it; it reports, and the lead records. The one exception is the automatic session handoff on Claude Code: just before its `/clear`, the hooks module rewrites *Next action* and `updated` of the run this session hands off, on the main agent's behalf. That is only the run this session last wrote, or the one unclaimed active run on the branch, never a run another session wrote (*The automatic path*, Which run).

**When it is written** — always before acting, so a crash leaves the last intention on disk:

- **before the first hand-off of the run**, whatever the lifecycle (create it: request, clarified intent, Routing Plan row or "AAW", every stage `pending`). Normally that is when the human confirms the Routing Plan; a route-immediately item (P0, security fix) gets it at route time, before confirmation; an `AAW` run gets it before the first `agent-manager` spawn;
- **before** each hand-off: the stage `in-progress`, its step code and handoff record, and *Next action* = what to do when the agent returns or if it never does;
- **after** each return: the hand-back's file name (stored first), the verification result, the stage `done` or `blocked`, the next action;
- after each gate decision, loop round and clarification round;
- at the end: `status: done` (or `abandoned`, with the human's reason).

At **every** checkpoint, set `commit` to the current `HEAD` and `last-record` to the file name of the newest handoff record or hand-back in the folder.

**Committing it.** Every checkpoint is written to disk at once; that alone survives a crash or a dropped connection. The writer commits `run.md` at each gate and when the run closes, with the records written since the last commit, so the run also survives a lost machine and is visible to the team.

**Ownership.** `owner` is the agent that writes the file (`orchestrator` or the main agent), `session` identifies the session that last wrote it, and `branch` is the branch the run works on. Two sessions never drive one run at the same time.

**Resuming.** At the start of every session the orchestrator lists the `run.md` files in the handoff folders (`docs/handoffs/*/run.md` by default: `artifacts.handoffs` with its placeholders as `*`) whose `status` is `active` or `blocked`. It offers to resume only runs whose `branch` is the current branch; for a run on another branch, or one another session wrote last, it asks the human before taking it over and then records its own `session`. A session seeded by an automatic handoff is the exception, for the one run its seed names and no other: that run was handed to it on purpose, so it takes it over without asking and records its own `session`, provided the run's `branch` is the current branch and its `session` is the previous session's id (the session handoff's *Previous session* line) or empty. If `session` names any other session, that session may still be live: ask the human first. The steps below still apply. Before going on:

1. Open `last-record` and re-verify it: each artifact it names still exists and matches, the branch still exists, and `commit` still holds — it is an ancestor of the current `HEAD` (`git merge-base --is-ancestor <commit> HEAD`).
2. For a stage left `in-progress`, check whether that agent's output landed (a stored hand-back newer than `last-record`, or the artifacts themselves) before handing off to it again.
3. A `blocked` run starts by showing the human the blocker — the open questions, the failed verification or the escalation recorded under *Next action* — and asking how to resolve it; it never resumes on its own.
4. A run that lost its session in the middle of a `team` stage cannot get its teammates back (`/resume` does not restore them): resume from `run.md` and the records the teammates reported, and run the stage's remaining hand-offs as subagents, with `mode: subagent` on the new records.

```markdown
---
run: <LIFECYCLE>-<YYYYMMDD>-<feature-slug>
work-item: <WI-NNN | none>
status: active | blocked | done | abandoned
lifecycle: <a key of the effective workflow's lifecycles>
mode: subagent | team   # the run's default; a stage that differs says so in the Mode column
current-stage: <stage id>
owner: orchestrator | <main agent id when there is no orchestrator>
session: <session id; host + start time only where the platform has none>
branch: <branch>
commit: <HEAD at the last checkpoint>
last-record: <file name of the newest handoff record or hand-back>
updated: YYYY-MM-DD HH:MM
---

# Run: <run id> — <one-line summary>

## Request
<the human's request as given, redacted>

## Clarified intent
<goal, constraints and what "done" means, as confirmed with the human>

## Routing Plan
<this item's row of the Routing Plan; confirmed by the human on YYYY-MM-DD; one-off overrides; other items of the same plan with their run.md paths>

## Stages
| Step | Stage | Owner | Mode | Status | Handoff | Handback | Updated |
|---|---|---|---|---|---|---|---|
| 3 | <stage id> | <agent> | subagent / team | pending / in-progress / done / blocked / skipped (`when`) | `3-orchestrator-to-<agent>.handoff.md` / — | `3-<agent>-to-orchestrator.handback.md` / — | YYYY-MM-DD HH:MM |

## Gates and loops
| Gate or loop | Approver / round | Decision | By | Date |
|---|---|---|---|---|
| G2 | human | approved | <name> | YYYY-MM-DD |
| review → build | limits 2 rounds / 1 failure (source `loop`, from `rounds --json`) | recorded at run start | orchestrator | YYYY-MM-DD |
| review → build | round 1 / 2 · failure 1 / 1 | Blockers sent back as `3.l1` | orchestrator | YYYY-MM-DD |
| review → build (stopped at `3.l1`) | limits used up, findings open | raised for this run only, for this step only, to `maxRounds` 3 / `maxFailures` 2 (the `workflow` skill's *Raising the limits for a run*); the workflow file is unchanged | human | YYYY-MM-DD |

## Open clarifications
| # | Asker → upstream | Question | Round | Status |
|---|---|---|---|---|

## Next action
<exactly one action: spawn <agent> for <stage> with `<handoff record>` · verify `<hand-back>` · relay Q<n> to <agent> · ask the human to approve <gate> · show the human the blocker — and what to check first when resuming>
```

Keep it short: link artifacts and records by path, never paste them, and redact exactly as for the records.

## Verification-only work

Sometimes the whole task is to prove that work already done meets its acceptance criteria — a last check before G4, or a human asking "is this actually finished?". Verification proves; it does not build. Its result is a **hand-back**: the verifier's report, stored like any other, with the AC outcome table below.

1. **Turn each acceptance criterion into the smallest proof that settles it** — a named test, a command and its expected output, a file and line. Put them in the outcome table before running anything.
2. **Reuse results only when they are still current.** An earlier run counts if it was made on the same commit with no uncommitted changes since; otherwise run it again.
3. **Run focused checks first**, then the wider gates the boundary requires (full build, full suite, mutation). A focused failure ends the run early with a precise reason.
4. **Record each check with one of four outcomes**, never rounded up: `pass` — ran and met the criterion; `fail` — ran and did not; `unavailable` — could not run here (missing tool, service or environment), with what is missing; `blocked` — cannot run until something else happens (a dependency, an approval, a fix), with what it waits for.
5. **Do not change product code or tests**, unless the request explicitly includes fixing what fails. A failure is reported back to its owner, not repaired in passing.
6. **Do not add scope once the criteria pass** — no polish, cleanup, refactors or extra tests. Note anything worth doing under the risks.
7. **Stop as soon as every criterion has an outcome** and report the result, the commands run and the unresolved risks — nothing else.

```markdown
verification: passed | failed | blocked | unavailable

| AC | Proof | Command / test | Outcome | Note |
|---|---|---|---|---|
| AC-1 | <smallest proof> | `<command>` | pass / fail / unavailable / blocked | <what failed, is missing or waits> |

Risks: <item | none>
```

The overall result: `passed` only when every criterion is `pass`; otherwise `failed` if any is `fail`, else `blocked` if any is `blocked`, else `unavailable`. Only `failed` goes back to the sender of the verified work; `blocked` and `unavailable` go to the human, who decides how to proceed. The same value goes into the `verification` field of the handoff record that was verified.

## Session handoff (mid-stage)

When a session must stop before its stage is finished, it is compacted into a session handoff so a fresh session can continue without the chat history. Typical reasons: the context window is nearly full, the human is pausing, or the work moves to another machine or tool. There is one procedure with two ways to start it:

| Path | Started by | Where it runs |
|---|---|---|
| **Manual** | The agent, when the human asks or it sees its context running out | Every platform: GitHub Copilot, and Claude Code with the automatic trigger off |
| **Automatic** | The ai-dlc hooks module (`hooks/auto-handoff/`), when the context reaches its threshold | Claude Code 2.1.287 or later, interactive sessions only (*The automatic path*) |

Both paths write the same sections (the template below) to the same place and leave the run state pointing at it. The automatic path adds a few of its own (*The automatic path*, What it adds):

1. **Set the focus.** Manual: ask what the next session is for, if the caller has not said, and leave out what it will not need. Automatic: the focus is always to resume the run where the previous session stopped.
2. **Write it to the scratch folder**: `<scratch root>/<run-folder>/session-<YYYYMMDD-HHMM>.md`. The scratch root is `.scratch` unless the "Workspace folders" table in AGENTS.md records another one. The path is the same on every platform. On platforms other than Claude Code, load the `scratchpad` skill before writing it. It is a working note, not an audit record, so it does not belong in `docs/handoffs/` and is never committed.
3. **Reference, don't copy.** Link the spec, plan, ADRs, earlier records, branch and commits by path, URL or SHA.
4. **Point to the run state first.** Before the session ends, update the run's `run.md`: set *Next action* to "continue this stage from the session handoff", with its path. Normally the orchestrator or the main agent writes it. On the automatic path the hooks module writes it, before its `/clear`, and quotes the action that was there underneath so nothing planned is lost. Link the run state at the top of the session handoff. The run state is committed and survives; the session handoff is a working note. It stays on the machine that wrote it, so on another machine *Next action* points at a missing file: there, carry on from the planned action quoted under it (the automatic path keeps it) and the records. When you know you are switching machines, use the manual path and copy the session handoff across.
5. **Redact** exactly as for the records.
6. **Start the fresh session.** Manual: give the caller the full path. The human starts a new session (or runs `/clear`) and points it at the file. Automatic: the module runs `/clear` and sends the new session one line: read the session handoff, then resume the run from its `run.md`. In both cases the orchestrator resumes the run from its run state (Run Loop step 1, and *Run state*, Resuming).

```markdown
# Session handoff: <run id> — <one-line goal>

- Run state: `docs/handoffs/<run-folder>/run.md`
- Lifecycle / stage / step: <lifecycle> / <stage> / <step code>, agent `<agent>`
- Branch and last commit: <branch> @ <sha>
- Next session focus: <what the caller said the next session is for>

## Done so far
- <outcome> — <path / sha>

## In progress
- <what was being changed, which files, and their state (builds? tests pass?)>

## Last request from the user
<the human's last message, verbatim> — Status: answered / partially answered / not answered

## Next steps
1. <the very next action; answering the last request first when it is not answered>

## Decisions and dead ends
- <decision, or approach tried and abandoned, and why>

## References
- <spec / plan / ADR / record paths>

## Suggested skills
- `<skill>` — <why>
```

A session handoff never replaces a hand-back: when the resumed stage finishes, its report is stored as the stage's hand-back as usual.

### The automatic path (Claude Code)

The ai-dlc plugin's hooks module runs the procedure above by itself when the context fills. It is adapted from [alexknowshtml/claude-auto-handoff](https://github.com/alexknowshtml/claude-auto-handoff) (MIT; see `hooks/auto-handoff/ATTRIBUTION.md` in the Claude plugin).

- **Trigger.** The context reaches `thresholdPercent` of the context window (default 80). The window is the one Claude Code reports for the session; when it reports none, the module uses `defaultContextWindow` (500000 tokens) and logs that once (`no context window reported: thresholdPercent applies to 500000, a line of 400000 tokens; if the real window is smaller than 400000, no handoff fires: set thresholdTokens (AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS) to an absolute token count`, at the default 80%). If Claude Code reports no window and the real one is smaller than the line (a 200k window at 80% gives a 400k line), no handoff happens: set `thresholdTokens`, an absolute token count that replaces the percentage. Set as `AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS` in a shell, it applies to the sessions started there, which also serves a test run. The module checks after each turn and before each model request, counting tool output that has not been measured yet. It also takes the place of an automatic compaction.
- **Main session only.** Only the main conversation, the lead of an agent team, is handed off. Subagent and teammate turns never trigger it: each has its own context window, and a `/clear` typed in a teammate's view acts on the lead. A teammate that runs out of room is replaced by the lead (shut down, then spawned again with a brief); an in-process teammate can compact on its own when the subagent definition it is spawned from sets `autoCompactWindow`.
- **Which run.** The module looks for a `run.md` under the handoff folder (`artifacts.handoffs`, default `docs/handoffs/`) with `status: active` and `branch` equal to the current git branch, and picks:
  1. the run whose `session` is this session's id or the id of an earlier session of its chain of handoffs, or the run the chain handed off with while its `session` is empty (the most recently `updated` if several);
  2. else the only active run on the branch, if its `session` is empty (no session claimed it);
  3. else none.

  It never takes a run a session outside the chain wrote, or one of several unclaimed runs: two sessions never drive one run. The chain matters because a seeded session starts before the resumed orchestrator writes its own id into `run.md`. The match needs `session` to hold the Claude Code session id; a run whose `session` holds a host and start time is never this session's. A `blocked` run is never picked: it waits for the human.
- **No run.** With no run picked, or outside a git repository, the module writes its own brief to `~/.claude/state/auto-handoff/<session-id>.md`. It leaves every run state alone and seeds the new session the same way.
- **When a write fails.** The session handoff is written before `run.md`, so `run.md` never points at a missing file. If either write fails, the module logs the step that failed and seeds its own brief instead; a session handoff already written stays in scratch, unlinked, and the log names it.
- **Who writes the content.** Haiku writes the template's sections from the conversation. The header lines, files, commits and token figures come from code. If Haiku fails, the document holds the facts alone. A copy of every handoff also stays in `~/.claude/state/auto-handoff/`, which feeds the optional brief viewer and status line link.
- **What it adds.** Besides the template's sections, the automatic session handoff has a *Previous session* header line with the old session's id and transcript path, an *Instructions* section for the fresh session, a *Resume the run* section, a *Handoff records* section, a *How to Use This Brief* note, and the facts extracted in code (files, commits, token figures).
- **Handoff records.** Built in code from `run.md`'s *Stages* table, this section lists only open work: `run.md`, the session handoff itself, and the handoff record and hand-back of every stage whose status is not `done` or `skipped`. `last-record` and its pair (same step code, agents swapped) come first when their stage is open. A file that is not on disk yet, such as a hand-back still to come, is marked `(missing)`. The seed line tells the fresh session to read them.
- **Tool gate.** Past the threshold, the module refuses each main-conversation tool call before it runs and tells the model a handoff is coming. The gate is main-loop-only: a subagent's tool calls are never refused. A session the module will not hand off (kill switch set, loop guard reached, already handed off) is never gated either.
- **Loop guards.** While the run the chain hands off stays `active`, the chain goes on: each fresh session hands off again when its context fills, however many handoffs ran without a prompt from the human. It ends when that run's status becomes `done`, `blocked` or `abandoned`; the module then pauses, says so above the prompt, and a prompt from the human resumes it. With no run of the chain, at most `maxConsecutiveHandoffs` handoffs (default 2) run before the human types a prompt; then the module pauses until they do. `chainWhileRunActive: false` applies that limit with a run too. A seeded session hands off no sooner than `seedHeadroomTokens` (default 40k) above its own starting size.
- **Session names.** The sessions of a chain are named `[auto-handoff]: <original name> (Session N)` (`sessionNamePrefix`, `renameSessions`). The original name is the session's title as Claude Code passes it to the hooks, else the last `custom-title` in the transcript (a `/rename`), else its `ai-title`, else the session's 8-character id; it is carried down the chain, so names never nest. Each seeded session asks for its name as it starts, as the `sessionTitle` of the module's session-start answer; it gets it only if Claude Code honours a title returned by a hooks module, which is not yet confirmed on a live session. Each session handed off is also renamed with `/rename` just before its `/clear` (the first one `(Session 1)`), unless it already has that name, and only when the running Claude Code has that command. The module waits for the rename to run before it queues the `/clear`, so the two never run out of order; a rename still pending after 10 seconds is logged and the `/clear` goes ahead. So with `/rename` every handed-off session ends up named, and the current one too if `sessionTitle` is honoured; without it, only `sessionTitle` names sessions. A rename that fails or is unavailable is logged and never stops the handoff. `/init` and `/configure-auto-handoff rename-check` report whether `/rename` is there; they cannot check `sessionTitle`.
- **Kill switches.** `enabled: false` stops handoffs; as `AI_DLC_AUTO_HANDOFF_ENABLED=false` in a shell, for the sessions started there. `DISABLE_AUTO_COMPACT` stops them too, because then something else owns the context limit. Either way the tool gate is off, and the brief viewer, when `viewer` is set, still serves earlier handoffs. With handoffs off, use the manual path.
- **Settings and log.** Every setting is a key of the repository's `.ai-dlc/auto-handoff.json`, which `/init` writes and `/configure-auto-handoff` shows and changes, with each key's `AI_DLC_AUTO_HANDOFF_*` variable and default. Each key is read, highest first, from `env` of `.claude/settings.local.json`, `env` of `.claude/settings.json`, the process environment, that file, the ai-dlc row in `/config` (for the keys that have one), then the default; the module reloads them at each session start. From that file, `viewer`, `briefTemplate` and `instructionsTemplate` apply only in a folder Claude Code trusts (`hasTrustDialogAccepted` in `~/.claude.json`; the rule is in `/configure-auto-handoff`, *Workspace trust*): a cloned repository must not be able to serve your handoffs to the network or choose files the module writes and reads. Elsewhere they are skipped and logged, and the other keys still apply. A `viewer` that is not `host:port` is ignored and logged, wherever it is set. The old `AUTO_HANDOFF_*` variables and the token option `threshold` are no longer read. Everything the module does is logged to `~/.claude/state/auto-handoff/auto-handoff.log`. Its Haiku requests count against your plan or API usage.
- **Not on GitHub Copilot.** Copilot hooks expose no context size or timer, and document no way to run `/clear` or call a model, so the Copilot plugin ships no module and uses the manual path.

Adapted in part from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT).
Adapted in part from [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) (Apache-2.0); modified.
