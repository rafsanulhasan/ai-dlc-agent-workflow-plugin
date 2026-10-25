---
name: handoff
description: "Records and verifies every hand-off in an AI-DLC run and keeps its run state. Use before any spawn, loop round or hand-off between agents (AAW included), whenever an agent returns its report, at every gate, and at session start to resume an unfinished run after a crash or lost context. Also use mid-stage, when a session must pass unfinished work to a fresh agent or session (context running out, pausing, switching machines; on Claude Code the automatic handoff does it at the context threshold), when a session was seeded by such an automatic handoff, and for verification-only work (\"check it's done\", \"run the gates\"), which proves the acceptance criteria without expanding scope."
---

# Handoff

Every time work changes hands in an AI-DLC run, two records cross the boundary: the **handoff record** the sender writes before the hand-off (what to do, from which verified inputs) and the **hand-back** the receiver returns when it is done (what it did, verbatim). Both live in the run's folder, next to the run state. The receiving agent reads the handoff first, **Scott Hanselman** (`orchestrator`) keeps the run state, and the human approves a record at each gate.

> Agent names are the defaults; a name chosen at `/ai-dlc:init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## When to use

- Any agent is about to hand work to another — a spawn, a message to a teammate, a loop round sent back, a fan-out to parallel agents: write the handoff record first (*Procedure*).
- An agent has returned or finished: store its hand-back first (*Hand-back record*).
- You received a handoff: verify it before you start (*Receiving a handoff*).
- A new request arrives while a run is open: decide whether it joins that run (*Related requests*).
- A human gate (G1–G4, release) needs a single document to approve.
- The orchestrator is about to spawn, has received a return, or a gate was decided: update the run state (*Run state*).
- A session has to stop **mid-stage** and a fresh agent or session will continue the same work: write a session handoff instead (*Session handoff*). On Claude Code the automatic path writes it when the context fills.
- A session was seeded by an automatic handoff (its first prompt starts `[auto-handoff] ↪ Handoff from session`): read the session handoff it names, then resume the run from its run state, in the version its parent session wrote (*Run state*, Versions and Resuming).
- The task is **verification only** — prove that existing work meets its acceptance criteria: follow *Verification-only work*.

## Naming

**Run folder:** `docs/handoffs/{LIFECYCLE}-{YYYYMMDD}-{feature-slug}/` — `artifacts.handoffs` of the effective workflow when `.ai-dlc/workflow.json` sets it. `{LIFECYCLE}` is the run's lifecycle code: a key of the effective workflow's `lifecycles` (`node .ai-dlc/workflow.mjs show` lists them; that list is the only one). `{YYYYMMDD}` is the run's start date, `{feature-slug}` kebab-case. A work-item id, if the run has one, goes in the `work-item:` front matter, not the folder name. One folder per run; it holds the run state (`run.v<version>.md`, one current version per session; *Run state*, Versions) and every record of the run, including those of later requests that joined it (*Related requests*).

**Record files:**

```
{step}[.{sub}][.l{loop}[.{round}]][.{n}]-{from-agent}-to-{to-agent}.handoff.md
{step}[.{sub}][.l{loop}[.{round}]][.{n}]-{from-agent}-to-{to-agent}.handback.md
```

- `step` — a whole number, starting at 1: a **root**.
  - **Each feature of the run is one root, and every hand-off done for that feature, follow-ups included, sits under it, in the sub-root of its phase** (*Phases* below): its research, planning, build, tests, reviews, docs, critiques and fix rounds. Reviews and critiques never take a root of their own.
  - Only a new feature, or a hand-off that serves the whole run, takes a new root, as **the next free number**: the number after every number the run has already used in a record or given to a work item. A number is taken when the first record that uses it is written, or when a breakdown gives it to an item, so two roots never share one. Gaps are allowed, and a number given and then dropped (an abandoned plan) is never reused.
  - **A feature** is an item of a work breakdown (`task-triage`: the run's own, or that of a request that joined the run as a new feature), or a request that starts or joins a run without being broken down, an `AAW` change included. A run of its own that was not broken down is one feature, root 1. The item's number is its root: `WI-5` is step 5, `WI-n` being the item's number within this run, distinct from the backlog's `ITEM-NNN`. The root's own number never names a record. A breakdown's items take consecutive free numbers: in a new run 1, 2, 3; in a run whose last number used is 4, 5 to 8.
  - **A hand-off that serves the whole run** after the cut-off (below) is a gate record, the release stage and its go / no-go, research or a `product-owner` consult that concerns no single feature, or a re-plan. It is named by its bare number (`4-orchestrator-to-human.handoff.md`), with `.1`, `.2` when one sender fans out to several agents.

  **Phases: the sub-roots of a feature.** Under a feature root `N`, the second number is the phase, the same in every lifecycle:

  | Sub-root | Phase | Agents | Its loop |
  |---|---|---|---|
  | `N.1` | Planning: research, the feature's `product-owner` consult and breakdown, stories and ACs, specs and ADRs, low-level design, task plan | `research-assistant`, `product-owner`, `product-manager`, `requirement-analyst`, `software-architect`, `system-engineer` | Clarify, Refine and Align rounds; a follow-up's planning |
  | `N.2` | Implementation | `software-engineer`; `agent-manager` in `AAW` | a follow-up's change; a corrected record |
  | `N.3` | Testing | `sqa-engineer` | `N.3.l1`: SQA ↔ engineer |
  | `N.4` | Code review: `N.4.1` coding conventions (standards axis), `N.4.2` intent against the requirements, architecture and system design (spec axis), both across implementation and test code | `code-reviewer` | `N.4.l1`: review ↔ engineer (the human's code-review rounds, each a `to: human` record) |
  | `N.5` | Documentation, and its critique | `documentation-writer`, `brutal-critique` | `N.5.l1`: critique ↔ writer |

  - A phase a lifecycle does not run is skipped and its number left free, never reused (an `AAW` change usually has no `N.1`). The number names the phase, not the order: in the default FDLC documentation runs beside testing and is still `N.5`.
  - **A sub-root's code names its records**: `5.2-orchestrator-to-software-engineer.handoff.md`. Hand-offs of one sub-root to different agents share its code and are told apart by their agents (`5.1-orchestrator-to-software-architect.handoff.md` and `5.1-orchestrator-to-system-engineer.handoff.md`; the writer's pass `5.5-orchestrator-to-documentation-writer…` and the first critique `5.5-orchestrator-to-brutal-critique…`).
  - Several hand-offs to the same agent spawned together add `.1`, `.2` in spawn order and leave the bare code unused for that agent: the two `code-reviewer` axes are always `.1` standards and `.2` spec (`5.4.1`, `5.4.2`), and two `sqa-engineer` suites spawned together are `5.3.1` and `5.3.2`.
  - A later hand-off to an agent the sub-root already handed off to never takes a new number: it is a loop round (below).
  - **`AAW`** (the `workflow` skill's `references/aaw-review.md`): the change is `N.2`, `sqa-engineer`'s tests of its code `N.3`, the two `code-reviewer` axes `N.4.1` and `N.4.2`, and `brutal-critique`'s first critique of its docs `N.5`; a *Docs update* stage for `documentation-writer` is `N.5` too.

  **Loops and rounds.**
  - `.l{k}` is **loop k** of a sub-root. Loop numbers count per sub-root from 1 (`5.3.l1`; a later, separate loop in the same sub-root is `5.3.l2`). `l1` means loop 1, never round 1. A loop's code is never a record.
  - **A loop opens** when a pass of its sub-root sends work back — test failures, review findings, a critique's REVISE, a record its receiver reported `failed` — when a follow-up re-enters the sub-root (*Follow-ups* below), or when a *Docs update* pass is repeated (below).
  - **Round k** is the k-th pass around the loop, numbered after it from 1 (`5.3.l1.1`, `5.3.l1.2`). A round runs in the loop's order, each agent at most once, starting with the side that answers: the engineer's or the writer's fix, then the re-run of the sub-root's own work (the tests, both review axes, the critique). In round 1 of a follow-up's loop there is nothing to answer yet, so it holds only the sub-root's own work. The same reading holds in every loop.
  - A round's hand-offs are named like a sub-root's: different agents share the round's code, several to the same agent spawned together add `.1`, `.2` (`5.4.l1.1-orchestrator-to-software-engineer.handoff.md`, then `5.4.l1.1.1-` and `5.4.l1.1.2-orchestrator-to-code-reviewer.handoff.md`). The first pass of a phase has no `l`.
  - A fix answers the loop that sent the work back, in that loop's next round. One fix that answers findings of several loops in the same round (a mixed `AAW` round sends every finding to `agent-manager` in one brief) is numbered in the loop of the earliest phase among them (`N.3` before `N.4` before `N.5`), and the run state's *Gates and loops* row of each other loop names it; a fix that answers one loop alone, a docs-only fix included, stays in that loop.
  - **A repeated *Docs update* pass** (`docs-status`: `documentation-writer` runs again for the same documents each time their status changes, with nothing sent back) is never a round of a critique loop. The first repeat opens the documentation sub-root's next loop, whose round 1 holds the writer's pass alone, or the writer and then a critique of that pass when those documents are critiqued; each later status change of the same documents is the next round of that loop. A REVISE on such a pass is answered in the same loop's next round. So in `N.5` the critique's fix rounds and the status passes stay in separate loops (worked example below).
  - A record corrected after its receiver reported it `failed` is the next round of the current loop, or round 1 of the sub-root's next loop when none is open, never an edit of the old file: `1.2-orchestrator-to-software-engineer.handoff.md` fails, so the writer sends `1.2.l1.1-orchestrator-to-software-engineer.handoff.md`.

  **Follow-ups.** A later request about a feature that already has a root — a fix, change, review, addition or question about the same feature — never takes a top-level number or a new sub-root: it runs in its feature's sub-roots, opening in each phase it needs that sub-root's next loop, whose round 1 is its first pass there (feature 8, whose testing already ran loop `8.3.l1`: the follow-up's change `8.2.l1.1`, its tests `8.3.l2.1`, its review `8.4.l1.1.1` and `8.4.l1.1.2`; a test failure then sends the fix and the re-test as `8.3.l2.2`). A phase the feature has not run yet starts at its own code, as a first pass (`8.5`). A follow-up broken into work items gives each item its feature's root, and each item opens its own loops; an item that is a new feature takes the next free top-level number. Whether a request is a follow-up or a new feature is decided at Classify (*Related requests*).

  **One cut-off: Confirm**, when the human confirms the request's Routing Plan. A run that never waits for Confirm (a P0 bug, a security fix, an `AAW` run, or an `AAW` change that joins a run) has its cut-off when its run state, or the joined request's row in the run state, is written.
  - Before the cut-off, every hand-off that serves a request with a root of its own (research to classify it, the work breakdown, a `product-owner` consult) is planning of the request's **first root**, `N.1`, named as any planning hand-off (`5.1.1-` and `5.1.2-orchestrator-to-research-assistant…` spawned together, then `5.1-orchestrator-to-product-manager…`; research asked again later is a round of `5.1.l1`). The first root's number is taken, as the next free number, before the breakdown exists; the breakdown then numbers its items from it.
  - A follow-up's hand-offs before its cut-off (research, its breakdown) are its loop in its feature's planning sub-root: two research spawns together `8.1.l1.1.1` and `8.1.l1.1.2`, then its breakdown `8.1.l1.1`.
  - After the cut-off, every hand-off goes in its own feature's sub-roots or, when it serves the whole run, takes the next free top-level number: **gate records (G1–G4, release) always do**, and so do the release stage, research or a `product-owner` consult later in the run that concern no single feature, and a re-plan, whose new features take the numbers after it.

  **Nested spawn or parallel hand-off.** A code one level below a record's code, sent by that record's receiver, is a **nested spawn** of that record: `5.3.2.1-sqa-engineer-to-sqa-engineer…` under `5.3.2-orchestrator-to-sqa-engineer…`. Any other `.1`, `.2` is a **parallel hand-off** to the same agent (*Phases* above): `5.3.1-` and `5.3.2-orchestrator-to-sqa-engineer…`, whose sender is not the receiver of a record at `5.3`. The file name alone tells them apart; the run state's *Stages* table lists every record under its sub-root as well.

  **Records named under an earlier rule keep their names.** Earlier rules numbered a feature's hand-offs in order (`N.1` change, `N.2` critique, `N.1.l1` fix round, follow-ups `8.7`, `8.8`, request-wide hand-offs before Confirm `5.0.1`), and a run renumbered by hand records the mapping in the `Old steps` column of its run state's *Features* table (*Related requests*) and may hold codes no rule gives, such as a fan-out under a root (`8.2.1`, `8.2.2`); new records follow this rule.
- `.sub` — `.1`, `.2`… under a code. What they mean depends on the code:
  - **Under a feature root**, the phase (*Phases* above).
  - **Under a root that serves the whole run**, `.1`, `.2` are the agents one sender fans out to in parallel. A fan-out uses up its whole number: after `4.1` and `4.2` there is no bare `4-…` record, and the next root is `5`.
  - **Under a sub-root or a round**, the hand-offs to the same agent spawned together (`5.4.1`, `5.4.l1.1.2`).
  - A nested spawn adds one level under the code of the record whose receiver spawned it: `4.1.1`, `5.3.2.1` (*Nested spawn or parallel hand-off* above).
- `.l{loop}.{round}` — loop and round of a sub-root (*Loops and rounds* above): `1.3.l1.2` is round 2 of loop 1 of feature 1's testing.
- `from` / `to` — agent IDs only, never persona names. A hand-back swaps them: `from` is the agent returning the work, `to` the one that handed it off. `human` is the only other name allowed, as the `to` of a record that hands work to the human: a gate record that has no next agent, or a hand-off to the human inside a phase. A `to: human` record has no hand-back: the human's decision is recorded in the run state.

Worked examples:

| Situation | Handoff | Hand-back |
|---|---|---|
| Subagent mode: the orchestrator briefs the engineer on feature 1 | `1.2-orchestrator-to-software-engineer.handoff.md` | `1.2-software-engineer-to-orchestrator.handback.md` |
| Agent team: the architect hands the design to the system engineer (Refine) | `1.1-software-architect-to-system-engineer.handoff.md` | `1.1-system-engineer-to-software-architect.handback.md` |
| Feature 5 in the default FDLC: build; then UI tests, coded tests and docs spawned together; then the two `code-reviewer` axes | `5.2-orchestrator-to-software-engineer.handoff.md`; `5.3.1-` and `5.3.2-orchestrator-to-sqa-engineer.handoff.md` with `5.5-orchestrator-to-documentation-writer.handoff.md`; then `5.4.1-` and `5.4.2-orchestrator-to-code-reviewer.handoff.md` | `5.2-software-engineer-to-orchestrator.handback.md`, `5.3.1-…`, `5.3.2-…`, `5.5-…`, `5.4.1-…`, `5.4.2-code-reviewer-to-orchestrator.handback.md` |
| Nested spawn (Claude Code) under a parallel suite: `sqa-engineer` at `5.3.2` spawns three test writers | `5.3.2.1-sqa-engineer-to-sqa-engineer.handoff.md`, `5.3.2.2-…`, `5.3.2.3-…` | `5.3.2.1-sqa-engineer-to-sqa-engineer.handback.md`, … |
| Failing tests send feature 1's build back, rounds 1 and 2 | `1.3.l1.1-orchestrator-to-software-engineer.handoff.md`, then `1.3.l1.1-orchestrator-to-sqa-engineer.handoff.md`; round 2 the same with `1.3.l1.2` | `1.3.l1.1-software-engineer-to-orchestrator.handback.md`, `1.3.l1.1-sqa-engineer-to-orchestrator.handback.md`, `1.3.l1.2-…` |
| Review Blockers on feature 1, round 1: fix, re-test, both axes again | `1.4.l1.1-orchestrator-to-software-engineer.handoff.md`, `1.4.l1.1-orchestrator-to-sqa-engineer.handoff.md`, then `1.4.l1.1.1-` and `1.4.l1.1.2-orchestrator-to-code-reviewer.handoff.md` | the same codes, agents swapped |
| Documentation: write, critique, REVISE, then fix and critique again | `1.5-orchestrator-to-documentation-writer.handoff.md`, `1.5-orchestrator-to-brutal-critique.handoff.md`; `1.5.l1.1-orchestrator-to-documentation-writer.handoff.md`, `1.5.l1.1-orchestrator-to-brutal-critique.handoff.md` | the same codes, agents swapped |
| `AAW` run of its own (one feature, root 1), docs change: change, critique, REVISE, fix and critique again | `1.2-orchestrator-to-agent-manager.handoff.md`, `1.5-orchestrator-to-brutal-critique.handoff.md`, `1.5.l1.1-orchestrator-to-agent-manager.handoff.md`, `1.5.l1.1-orchestrator-to-brutal-critique.handoff.md` | `1.2-agent-manager-to-orchestrator.handback.md`, `1.5-brutal-critique-to-orchestrator.handback.md`, `1.5.l1.1-agent-manager-to-orchestrator.handback.md`, `1.5.l1.1-brutal-critique-to-orchestrator.handback.md` |
| `AAW` run of its own: a *Docs update* writer pass (*in progress*) and the critique of the change's docs; REVISE, fixed and critiqued again; once the reviews are done the status changes and the writer runs again (marker removed) | `1.5-orchestrator-to-documentation-writer.handoff.md` and `1.5-orchestrator-to-brutal-critique.handoff.md`; critique loop `1.5.l1.1-orchestrator-to-agent-manager.handoff.md`, `1.5.l1.1-orchestrator-to-brutal-critique.handoff.md`; status pass `1.5.l2.1-orchestrator-to-documentation-writer.handoff.md` (a further status change of the same documents: `1.5.l2.2-…`) | the same codes, agents swapped |
| `AAW` run of its own, mixed change: docs and code reviewed in parallel, then the two `code-reviewer` axes | `1.5-orchestrator-to-brutal-critique.handoff.md` with `1.3-orchestrator-to-sqa-engineer.handoff.md`, then `1.4.1-` and `1.4.2-orchestrator-to-code-reviewer.handoff.md` | `1.5-brutal-critique-to-orchestrator.handback.md`, `1.3-sqa-engineer-to-orchestrator.handback.md`, `1.4.1-…`, `1.4.2-code-reviewer-to-orchestrator.handback.md` |
| The same `AAW` run: a test fails and the critique says REVISE; one fix, then the tests and the critique again | `1.3.l1.1-orchestrator-to-agent-manager.handoff.md` (the earliest phase), then `1.3.l1.1-orchestrator-to-sqa-engineer.handoff.md` and `1.5.l1.1-orchestrator-to-brutal-critique.handoff.md` | the same codes, agents swapped |
| A handoff its receiver reported `failed`, corrected | `1.2.l1.1-orchestrator-to-software-engineer.handoff.md` | `1.2.l1.1-software-engineer-to-orchestrator.handback.md` |
| A request joins a run whose last number used is 4: two research spawns to classify it, then its breakdown (items 5–8), all before Confirm | `5.1.1-` and `5.1.2-orchestrator-to-research-assistant.handoff.md` together, then `5.1-orchestrator-to-product-manager.handoff.md` | `5.1.1-research-assistant-to-orchestrator.handback.md`, `5.1.2-…`, `5.1-product-manager-to-orchestrator.handback.md` |
| An `AAW` change that is a new feature joins a run whose last number used is 25: change, then critique | `26.2-orchestrator-to-agent-manager.handoff.md`, `26.5-orchestrator-to-brutal-critique.handoff.md` | `26.2-agent-manager-to-orchestrator.handback.md`, `26.5-brutal-critique-to-orchestrator.handback.md` |
| A follow-up to feature 8, whose testing already ran loop `8.3.l1`: change, tests, both axes | `8.2.l1.1-orchestrator-to-software-engineer.handoff.md`, `8.3.l2.1-orchestrator-to-sqa-engineer.handoff.md`, `8.4.l1.1.1-` and `8.4.l1.1.2-orchestrator-to-code-reviewer.handoff.md` | the same codes, agents swapped |
| Items 1–3 are given and no gate record exists yet; the G3 gate record for the whole run | `4-orchestrator-to-human.handoff.md` | none (the human's decision goes in the run state) |
| Feature 5: failing tests send its build back, round 1; feature 6 starts on its own number | `5.3.l1.1-orchestrator-to-software-engineer.handoff.md`; `6.2-orchestrator-to-software-engineer.handoff.md` | `5.3.l1.1-software-engineer-to-orchestrator.handback.md`; `6.2-software-engineer-to-orchestrator.handback.md` |

A clarification relayed with `SendMessage` to an agent that is still running is recorded in the run state and in the asker's hand-back; a fresh agent spawned to answer it is a new hand-off of the sub-root, or the round, it serves.

**Before the run folder exists.** Spawns made before the Routing Plan is confirmed — research to classify the request, the `product-manager` work breakdown, a `product-owner` consult — get records too, because the lifecycle and slug that name the run folder are not fixed yet: the orchestrator writes their handoffs and stores their hand-backs in `.scratch/<request-slug>/`, numbered from 1 as if they were a run of their own. When the run folder is created at Confirm, or as soon as the request is found to join an open run (*Related requests*), they move in renamed to the run's codes: each becomes a planning hand-off of the request's first root, `N.1`, named as *One cut-off* says (with a first root numbered 5, two research spawns `1.1`, `1.2` and the breakdown `2` become `5.1.1-` and `5.1.2-orchestrator-to-research-assistant` and `5.1-orchestrator-to-product-manager`). A follow-up's scratch records become round 1 of the next loop of its feature's planning sub-root (with feature 8's planning on no loop yet: `8.1.l1.1.1-`, `8.1.l1.1.2-orchestrator-to-research-assistant` and `8.1.l1.1-orchestrator-to-product-manager`). A request that never becomes a run (a question answered by research) leaves them in scratch.

## Related requests

One feature, one run. A request that arrives while a run is open goes into that run when it belongs to it. The orchestrator decides at Classify (`request-routing`, Step 1), before any work breakdown, and this section is the rule it applies. How a joined request's records are numbered is in *Naming*.

**How the orchestrator judges.** From the open run's own records: its run state (request, clarified intent, *Joined requests*, *Stages*), its handoff records and hand-backs, and the artifacts they name. When those are not enough to tell, it has `research-assistant` find out first, then decides. When it is still not clear, it asks the human.

- **Related: it joins the run.** The request continues the work of an `active` or `blocked` run on the current branch: the same feature, the files or documents that run's records name, or a fix, review, rule or documentation change that run caused or found. Then:
  - it uses the same folder and the same run state (its current version; *Run state*, Versions). The folder keeps its name whatever lifecycle the new work runs; each record's `lifecycle` field names the lifecycle of its own work (`AAW` for an agent-artifact change inside a feature run);
  - it is either a **follow-up** or a **new feature** (*Naming*). A follow-up is about a feature that already has a root in the run — a fix, review, change, addition or question about that feature, its files or documents, or findings its records hold — and runs in that root's sub-roots, as their next loops (*Naming*, Follow-ups); a request that brings a feature the run does not have yet takes the next free top-level number. A request that touches several features is broken down, each item going under the root of the feature it belongs to or, when it is a new feature, to a new root. When the records do not tell which root a request belongs to, ask the human ("Is this a follow-up to step `<n>` (<feature>), or a new feature?");
  - its records go into that folder from the moment the orchestrator decides it joins, numbered as *Naming* says; records written in `.scratch/` before then move in renumbered (*Before the run folder exists*);
  - the run state's *Features* table lists every root with its feature name and status (columns `Step | Feature | Status`; a run renumbered by hand adds `Old steps`, the codes each root's records had before): a new feature adds a row, a follow-up updates its feature's status;
  - the run state gets a row under *Joined requests* (the request verbatim, its clarified intent, its Routing Plan rows, the first step it took), and its sub-roots go into the same *Stages* table, the *Stage* cell naming the feature and the phase (a follow-up adds its records, sessions and agents to its feature's rows);
  - its agents therefore show in the run's flowchart, after the earlier steps.
- **Unrelated: it gets its own run.** Another feature, bug or change with no tie to an open run gets a new folder, steps from 1 and its own flowchart.
- **Not clear: ask.** Ask the human one question before filing the work ("Does this belong to `<run id>` (<summary>), or is it separate?"). Never guess, and never split one feature over two runs to avoid the question.
- **Related, but it must stay a separate folder.** When the related run is `done` or `abandoned`, or works on another branch, the orchestrator does not decide alone: it tells the human why that run may not take more steps and asks whether the new work gets its own folder. With the human's yes, or when the human asks for a separate run in the first place, the new work gets its own folder and steps from 1, and its run state names the related run in `parent: <run id>`, so a tool that draws runs can show it inside the parent's chart. Every other run leaves `parent` out.

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

1. **Collect the evidence.** List every input artifact by path, with the result of checking it: for the first stage, the request; after that, the previous hand-back and the artifacts it claims. Check the evidence the previous stage gives for the checks it owns — a build stage's hand-back quotes the project's build and test commands (recorded at init in `CLAUDE.md` / `.github/copilot-instructions.md`) with their real output; a test stage's quotes its test run and names the mutation report path — and that the files it claims exist and `git diff` agrees. Record what the hand-back and the files show, not an agent's summary. Never run a check a stage owns to fill a gap (the orchestrator's one exception, reading its own workflow, is in `orchestrator.md`, *Delegate the work; check the agents' work*): a check missing from the hand-back fails, and the hand-back goes back to its agent (*Rules*).
2. **Gate first, if one sits here.** When the previous stage ended at a gate, follow its `approver` in the effective workflow (default: `human` for every gate): fill *Gate evidence*, then `human` — stop and ask the human to approve this record; `orchestrator` — approve it and write `approved by orchestrator`; `none` — do not stop, but still write the record and have it verified. A gate with no next agent gets a record addressed `to: human`.
3. **Write the handoff record** with the next step code (*Naming*), from the template below, `verification: pending`. It is the receiver's brief: everything `Skill("ai-dlc:agent-invocation")` requires in a brief, with artifacts linked by path.
4. **Update the run state** (subagent mode: the orchestrator; agent team: tell the lead), then **hand off**: spawn or message the receiver, giving the record's path as the first item of *Required context*.
5. **On return, store the hand-back first** (*Hand-back record*), then verify what it claims before the next hand-off — which starts again at step 1.

## Receiving a handoff

The receiver verifies its input before building on it; that is the record's verification.

1. Read the record, then open every listed artifact and the ACs it covers. Check that each exists and matches what the record says.
2. **Report the result as line 1 of your report**, in exactly this form, whatever contract or terminal reply follows it:

   ```
   handoff <file name>: passed|failed — <why>
   ```

   `passed` — every listed artifact exists and matches the record; `failed` — one does not, or the record is missing what you need to start. The writer of the run state copies `passed` or `failed` verbatim into the record's `verification` field when it stores your hand-back; in an agent team you also set the field yourself. (`blocked` and `unavailable` are only for *Verification-only work*.) A `failed` record goes back to its writer, who sends a corrected record as a loop round (*Naming*, Loops and rounds); do not start the work it blocks.
3. List everything unclear, contradictory or missing: an AC that admits two readings, a design that does not say who owns a responsibility, a test result that does not match the diff. If the list is not empty, return one batched clarification request before starting the blocked work (format: `agent-invocation`, *Clarification requests*; whom to ask: the consultation matrix in the `ai-dlc` skill, *Clarify loop*). Continue only with work the questions do not block.
4. When the answers arrive, list every question and answer under *Clarifications* in your hand-back (your report). Never edit the incoming record beyond its `verification` field, and never change an upstream artifact yourself — its owner does.

## Handoff template

```markdown
---
run: <LIFECYCLE>-<YYYYMMDD>-<feature-slug>
work-item: <WI-NNN | none>
lifecycle: <a key of the effective workflow's lifecycles>
step: <step code, e.g. 1.2 | 1.4.1 | 1.3.l1.2 | 4>
from: <agent id>
to: <agent id | human>
mode: subagent | team   # this hand-off's mode: request-routing Modes 1–4 = subagent, Mode 5 = team
loop: none | <loop k, round r: matching .l<k>.<r>>
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
- One record per hand-off; a loop round writes new `.l{k}.{r}` records rather than editing old ones, so the history of a run stays auditable.
- Every lifecycle writes handoff records and hand-backs, `AAW` included.
- The orchestrator re-checks the latest records, their artifacts and the command output quoted in them at every gate, even when a receiver already verified them: by reading them and the git state, never by re-running a command.
- The orchestrator only gathers the run's context (records, hand-backs, run state, the workflow, `git status` / `git log` / `git diff`) and checks the agents' work. It never runs the project's build, test, mutation or validation commands or plugin tests: each check is run by the agent that owns it (tests: **Kent Beck** (`sqa-engineer`)) and quoted in its hand-back. Its one exception, reading its own workflow, is stated in `orchestrator.md`, *Delegate the work; check the agents' work*.

## Hand-back record

The report an agent returns when its stage or loop round ends — `agent-manager`'s `Changed paths` / `Intent` / `Checks`, a critic's verdict, a reviewer's findings, a test report, a clarification request, a verification result — is its **hand-back**. Until someone writes it down it exists only in the caller's context, so it is stored at once and survives a crash or a lost connection.

- **Where:** the run folder, named with the step code of the handoff it answers and the agents swapped: `1.2-software-engineer-to-orchestrator.handback.md` answers `1.2-orchestrator-to-software-engineer.handoff.md`.
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
loop: none | <loop k, round r>
received: YYYY-MM-DD HH:MM   # a date alone only for records migrated from before this convention
---

<the agent's report, verbatim>
```

## Run state

A run must survive a crash, a dropped connection or a lost context. Every run keeps a checkpoint file in its run folder, written in versions, one current version per session: `run.v1.md`, `run.v1.1.md`, `run.v1.2.md`, `run.v2.md` and so on (*Versions* below). The records say what crossed each boundary; the run state says where the run is and what happens next. "The run state" always means the run's current version.

**Versions.** No session ever replaces another session's run state, and no version is changed once its session has ended.

- **Names and order.** `run.v<major>.md` is a major version and `run.v<major>.<minor>.md` a minor one. Every part is a whole number that starts at 1 and has no leading zero: never `run.v0.md`, `run.v01.md`, `run.v1.0.md` or `run.v1.01.md`. Versions are ordered by major, then by minor, both compared as numbers, a bare major counting as minor 0: `run.v1.md` < `run.v1.1.md` < `run.v1.2.md` < `run.v2.md`, `run.v1.9.md` < `run.v1.10.md`, `run.v9.md` < `run.v10.md`. **The current version is the highest.**
- **The session's version.** A session writes the run state only into a version it owns. A version's **owner** is the session that wrote it, together with every later session of that session's automatic-handoff chain (below); this is the one place the owner is defined, and every other mention points here. **A session's current version is the last file it wrote**: a session may write more than one file (a minor pair, then perhaps a major), but it has one current version at a time and updates that one in place. The first session of a run creates `run.v1.md`. A session that only reads the run state writes nothing. A new file is copied forward from the current version, then updated (`version`, `previous`, `session`, `updated`, and whatever the checkpoint changes). Which file, if any, a session writes depends on what it does, decided at its first checkpoint and again whenever the scope widens or the direction changes:
  - **A new request scope** — the session brings a new human request that widens the run (a request that joins it, *Related requests*): the next major, `run.v<major+1>.md`.
  - **A change of direction on the same thing** — the human drops or replaces something the run had decided or built (an approach, a design, a scheme): a **minor pair**, the next two minor numbers under the current major. The first, with `pair: deprecated`, is the current version copied forward with a *Deprecated* section that says what the change drops and why; it is written once and never changed, and the second file follows straight after it, before any other checkpoint, so it is never left as the current version: no session resumes from it or writes a checkpoint into it. If a crash between the two leaves it the highest, the next session that writes the run state first writes the missing second file from it (the next minor, `pair: change`), then goes on as this list says. The second, with `pair: change`, is copied from it without what was dropped, carries the new change, and is the session's current version, updated in place (unless a major follows, below). `pair` has only these two values: a minor with no `pair` line (a plain continuation, below) or with `pair: change` is an ordinary version; only `pair: deprecated` marks a dropped state. From `run.v1.md` the pair is `run.v1.1.md` and `run.v1.2.md`; from `run.v1.2.md`, `run.v1.3.md` and `run.v1.4.md`; from `run.v2.md`, `run.v2.1.md` and `run.v2.2.md`. A change of direction writes its pair when it happens, even in a session that already wrote its version; from then on the session updates the pair's second file.
  - **A plain continuation** — neither of the above: the session goes on with the run as it stands. The current version's owner writes no new file and keeps updating the current version in place. Any other session (it starts, resumes or takes over the run) writes its own version as the **next minor** of the current major, a single file with no `pair` line: from `run.v1.md`, `run.v1.1.md`; from `run.v1.2.md`, `run.v1.3.md`; from `run.v2.md`, `run.v2.1.md`.
  - **A widened scope and a change of direction together** — the session brings a new request that both widens the run and drops or replaces something it had decided: first the minor pair on the current major, for the change of direction, then the next major, for the widened scope, copied forward from the pair's second file and carrying both. The new major is the current version and the session's current version, updated in place; the pair's second file is written once and left as it is. From `run.v1.md`: `run.v1.1.md` (`pair: deprecated`) and `run.v1.2.md` (`pair: change`), then `run.v2.md` (`previous: run.v1.2.md`). When the two happen at different times in the session, each is written when it happens, as above: a widened scope `run.v2.md`, and a later change of direction the pair `run.v2.1.md` and `run.v2.2.md`.
- **An automatic handoff stays in its parent session.** A session seeded by an automatic handoff (*Session handoff*, *The automatic path*), and every later session of the same chain, is part of the session that started the chain, and so owns that session's version (*The session's version*): on a plain continuation it writes no new file; a widened scope or a change of direction still writes the major or the minor pair named above. A manual session handoff starts a new session, which owns no version yet.
- **Older versions are kept unchanged.** An older version is never overwritten, edited, renamed or deleted (the one rename allowed is a legacy `run.md`, below). What a change of direction drops is said in the minor pair's first file, never by editing an older one. Versions marked under an earlier rule (`status: deprecated`, `superseded-by:` in their front matter) keep those lines; they change nothing, since only the current version is read.
- **Every reader takes the current version, and only that one,** per run: the orchestrator listing runs to resume, the hooks module (*The automatic path*, Versioned runs), the documentation status (`docs-status`). An older version is history: never resume from it and never write a checkpoint into it.
- **Runs from before versions.** A folder with a `run.md` and no `run.v<…>.md` is still valid: its `run.md` is the current run state and is read as before. The next session that writes it first renames it to `run.v1.md` with `git mv`, content and front matter unchanged (a file without a `version` line is version 1), then writes its own version, named as above. A folder never holds a `run.md` beside a `run.v<…>.md`.

**Who writes it.** The orchestrator — in an agent team too, as team lead. When no orchestrator is running, the session's main agent does, for example `agent-manager` run directly by a developer. A subagent or teammate never writes it; it reports, and the lead records. The one exception is the automatic session handoff on Claude Code: just before its `/clear`, the hooks module rewrites *Next action* and `updated` in the current version of the run this session hands off, on the main agent's behalf; it never writes a new version. That is only the run this session last wrote, or the one unclaimed active run on the branch, never a run another session wrote (*The automatic path*, Which run).

**When it is written** — always before acting, so a crash leaves the last intention on disk:

- **before the first hand-off of the run**, whatever the lifecycle (create `run.v1.md`: request, clarified intent, Routing Plan row or "AAW", every stage `pending`), and before the first hand-off of a request that joins it (its *Joined requests* row and its stages `pending`; *Related requests*). Normally that is when the human confirms the Routing Plan; a route-immediately item (P0, security fix) gets it at route time, before confirmation; an `AAW` run gets it before the first `agent-manager` spawn;
- **at the first checkpoint of every later session** of the run: the file *Versions*, The session's version, names for it, if any (the current version's owner writes none on a plain continuation);
- **before** each hand-off: its sub-root's row `in-progress`, with the new handoff record, this session's id and the receiving agent's id added to it, and *Next action* = what to do when the agent returns or if it never does;
- **after** each return: the hand-back's file name (stored first), the verification result, the stage `done` or `blocked`, the next action;
- after each gate decision, loop round and clarification round;
- at the end: `status: done` (or `abandoned`, with the human's reason).

At **every** checkpoint, set `commit` to the current `HEAD` and `last-record` to the file name of the newest handoff record or hand-back in the folder.

**Committing it.** Every checkpoint is written to disk at once; that alone survives a crash or a dropped connection. The writer commits its version of the run state at each gate and when the run closes, with the records written since the last commit, a minor pair's first file and a legacy `run.md` it renamed, so the run also survives a lost machine and is visible to the team.

**Ownership.** `owner` is the agent that writes the file (`orchestrator` or the main agent), `session` identifies the session that last wrote it (in an automatic-handoff chain, the latest session of the chain), `version` is its version (`1`, `1.2`, `2`; *Versions*), and `branch` is the branch the run works on. Two sessions never drive one run at the same time.

**Resuming.** At the start of every session the orchestrator reads the current version of each run folder under the handoff folder (`docs/handoffs/*/` by default: `artifacts.handoffs` with its placeholders as `*`; the highest `run.v<…>.md`, else a `run.md`, *Versions*) and lists the runs whose `status` is `active` or `blocked`. It offers to resume only runs whose `branch` is the current branch; for a run on another branch, or one another session wrote last, it asks the human before taking it over. Resuming or taking over, it writes the session's version, named as *Versions*, The session's version, says, with its own `session`. A session seeded by an automatic handoff is the exception, for the one run its seed names and no other: that run was handed to it on purpose, so it takes it over without asking and records its own `session` in the version its parent session wrote, which it owns (*Versions*, The session's version), provided the run's `branch` is the current branch and its `session` is the previous session's id (the session handoff's *Previous session* line) or empty. If `session` names any other session, that session may still be live: ask the human first. The steps below still apply. Before going on:

1. Open `last-record` and re-verify it: each artifact it names still exists and matches, the branch still exists, and `commit` still holds — it is an ancestor of the current `HEAD` (`git merge-base --is-ancestor <commit> HEAD`).
2. For a stage left `in-progress`, check whether that agent's output landed (a stored hand-back newer than `last-record`, or the artifacts themselves) before handing off to it again.
3. A `blocked` run starts by showing the human the blocker — the open questions, the failed verification or the escalation recorded under *Next action* — and asking how to resolve it; it never resumes on its own.
4. A run that lost its session in the middle of a `team` stage cannot get its teammates back (`/resume` does not restore them): resume from the run state and the records the teammates reported, and run the stage's remaining hand-offs as subagents, with `mode: subagent` on the new records.

```markdown
---
run: <LIFECYCLE>-<YYYYMMDD>-<feature-slug>
work-item: <WI-NNN | none>
version: "<1 | 1.2 | 1.10 | 2 …>"   # quoted, so 1.10 stays 1.10; this file is run.v<version>.md (Versions); a renamed run.md without this line is version 1
previous: <run.v<…>.md | run.md | none>   # the version this one was copied from; none for run.v1.md of a new run
pair: deprecated | change   # only on a minor pair (Versions); otherwise leave the line out
status: active | blocked | done | abandoned
lifecycle: <a key of the effective workflow's lifecycles>
mode: subagent | team   # the run's default; a stage that differs says so in the Mode column
current-stage: <stage id>
owner: orchestrator | <main agent id when there is no orchestrator>
session: <session id; host + start time only where the platform has none>
branch: <branch>
commit: <HEAD at the last checkpoint>
last-record: <file name of the newest handoff record or hand-back>
parent: <run id>   # only for related work kept in its own folder (Related requests); otherwise leave the line out
updated: YYYY-MM-DD HH:MM
---

# Run: <run id> — <one-line summary>

## Request
<the human's request as given, redacted>

## Clarified intent
<goal, constraints and what "done" means, as confirmed with the human>

## Routing Plan
<this item's row of the Routing Plan; confirmed by the human on YYYY-MM-DD; one-off overrides; other items of the same plan with their run folders>

## Joined requests
| Date | Request (verbatim, redacted) | Clarified intent | Routing Plan rows | First step |
|---|---|---|---|---|

## Features
| Step | Feature | Status |
|---|---|---|
| 1 | <feature name> | pending / in-progress / done / blocked / abandoned |

## Stages
| Step | Stage | Owner | Mode | Status | Sessions | Agents | Handoff | Handback | Updated |
|---|---|---|---|---|---|---|---|---|---|
| 1.2 | <feature 1>: implementation | <agent> | subagent / team | pending / in-progress / done / blocked / skipped (`when`) | `<session id>` | <agent ids> | `1.2-orchestrator-to-<agent>.handoff.md` / — | `1.2-<agent>-to-orchestrator.handback.md` / — | YYYY-MM-DD HH:MM |
| 1.3 | <feature 1>: testing, loop `1.3.l1` round 1 | sqa-engineer | subagent | in-progress | `<session id>`, `<session id>` | sqa-engineer, software-engineer | `1.3-orchestrator-to-sqa-engineer.handoff.md`, `1.3.l1.1-orchestrator-to-software-engineer.handoff.md` | `1.3-sqa-engineer-to-orchestrator.handback.md` | YYYY-MM-DD HH:MM |
| 4 | G3 gate record (whole run) | orchestrator | subagent | done | `<session id>` | orchestrator | `4-orchestrator-to-human.handoff.md` | — | YYYY-MM-DD HH:MM |

## Gates and loops
| Gate or loop | Approver / round | Decision | By | Date |
|---|---|---|---|---|
| G2 | human | approved | <name> | YYYY-MM-DD |
| review → build | limits 2 rounds / 1 failure (source `loop`, from `rounds --json`) | recorded at run start | orchestrator | YYYY-MM-DD |
| review → build | round 1 / 2 · failure 1 / 1 | Blockers sent back as `1.4.l1.1` | orchestrator | YYYY-MM-DD |
| review → build (stopped at `1.4.l1`) | limits used up, findings open | raised for this run only, for this step only, to `maxRounds` 3 / `maxFailures` 2 (the `workflow` skill's *Raising the limits for a run*); the workflow file is unchanged | human | YYYY-MM-DD |

## Deprecated
<only in the first file of a minor pair (Versions): what the change of direction drops — decisions, features, stages — and why; leave the section out elsewhere>

## Open clarifications
| # | Asker → upstream | Question | Round | Status |
|---|---|---|---|---|

## Next action
<exactly one action: spawn <agent> for <stage> with `<handoff record>` · verify `<hand-back>` · relay Q<n> to <agent> · ask the human to approve <gate> · show the human the blocker — and what to check first when resuming>
```

*Stages* has one row per sub-root of each feature (*Naming*, Phases) and one per hand-off that serves the whole run. *Status* is the phase's; *Sessions* lists every session id that worked in it and *Agents* every agent id that handed off or received work in it; *Handoff* and *Handback* list all its records, its loops' rounds included, **oldest first** in each column: a new record is always added at the end, never sorted in, because the hooks module takes a stage's latest pass from the last handoff in its *Handoff* cell (*The automatic path*, Handoff records). Each loop's rounds, limits and verdicts go in *Gates and loops*.

Keep it short: link artifacts and records by path, never paste them, and redact exactly as for the records.

## Verification-only work

Sometimes the whole task is to prove that work already done meets its acceptance criteria — a last check before G4, or a human asking "is this actually finished?". Verification proves; it does not build. Its result is a **hand-back**: the verifier's report, stored like any other, with the AC outcome table below. The verifier is the agent that owns the checks — `sqa-engineer` for tests and acceptance criteria — never **Scott Hanselman** (`orchestrator`), which routes the task and checks the verifier's hand-back.

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
4. **Point to the run state first.** Before the session ends, update the run's current version, the one this session writes (*Run state*, Versions): set *Next action* to "continue this stage from the session handoff", with its path. Normally the orchestrator or the main agent writes it. On the automatic path the hooks module writes it, before its `/clear`, and quotes the action that was there underneath so nothing planned is lost. Link the run state at the top of the session handoff. The run state is committed and survives; the session handoff is a working note. It stays on the machine that wrote it, so on another machine *Next action* points at a missing file: there, carry on from the planned action quoted under it (the automatic path keeps it) and the records. When you know you are switching machines, use the manual path and copy the session handoff across.
5. **Redact** exactly as for the records.
6. **Start the fresh session.** Manual: give the caller the full path. The human starts a new session (or runs `/clear`) and points it at the file. Automatic: the module runs `/clear` and sends the new session one line: read the session handoff, then resume the run from its run state. In both cases the orchestrator resumes the run from its run state (Run Loop step 1, and *Run state*, Resuming). The manual path starts a new session, which writes a version of its own; on the automatic path the seeded session owns the version of the session it continues (*Run state*, Versions, The session's version).

```markdown
# Session handoff: <run id> — <one-line goal>

- Run state: `docs/handoffs/<run-folder>/run.v<version>.md` (the current version, *Run state*, Versions; `run.md` for a run from before versions)
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

- **Trigger.** The context reaches `thresholdPercent` of the context window (default 80), the window Claude Code reports for the session; only if it reports none does the module fall back to `defaultContextWindow` (500000 tokens, logged once), which fits neither a 200000 nor a 1000000 window, so set `thresholdTokens`, an absolute token count that replaces the percentage (details: *The fallback window* in the README of the ai-dlc repository). Each handoff logs `window=` and `windowSource=` (`host`, `host-percent`, `default`, or `none` under `thresholdTokens`) on its `threshold` line, next to Claude Code's own `hostWindowSource=` and `autoCompactThreshold=`. Set as `AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS` in a shell, it applies to the sessions started there, which also serves a test run. The module checks after each turn and before each model request, counting tool output that has not been measured yet. It also takes the place of an automatic compaction.
- **Main session only.** Only the main conversation, the lead of an agent team, is handed off. Subagent and teammate turns never trigger it: each has its own context window, and a `/clear` typed in a teammate's view acts on the lead. A teammate that runs out of room is replaced by the lead (shut down, then spawned again with a brief); an in-process teammate can compact on its own when the subagent definition it is spawned from sets `autoCompactWindow`.
- **Which run.** The module reads the current run state of each run folder under the handoff folder (`artifacts.handoffs`, default `docs/handoffs/`; *Versioned runs* below) and looks for one with `status: active` and `branch` equal to the current git branch, and picks:
  1. the run whose `session` is this session's id or the id of an earlier session of its chain of handoffs, or the run the chain handed off with while its `session` is empty (the most recently `updated` if several);
  2. else the only active run on the branch, if its `session` is empty (no session claimed it);
  3. else none.

  It never takes a run a session outside the chain wrote, or one of several unclaimed runs: two sessions never drive one run. The chain matters because a seeded session starts before the resumed orchestrator writes its own id into the run state. The match needs `session` to hold the Claude Code session id; a run whose `session` holds a host and start time is never this session's. A `blocked` run is never picked: it waits for the human.
- **Versioned runs.** In each run folder the module reads only the current version (*Run state*, Versions): the highest of its `run.v<major>.md` and `run.v<major>.<minor>.md` files, ordered by major and then by minor, both compared as numbers, a bare major counting as minor 0 (`run.v2.md` > `run.v1.2.md` > `run.v1.1.md` > `run.v1.md`, `run.v10.md` > `run.v9.md`), else a `run.md` from before versions. Older versions are never read, so a `done` newest version ends the run even if an older one says `active`. A folder with neither file is skipped. The module writes *Next action* into the version it read and never writes a new one: the seeded session is part of the session it continues (*Session handoff*, step 6).
- **No run.** With no run picked, or outside a git repository, the module writes its own brief to `~/.claude/state/auto-handoff/<session-id>.md`. It leaves every run state alone and seeds the new session the same way.
- **When a write fails.** The session handoff is written before the run state, so the run state never points at a missing file. If either write fails, the module logs the step that failed and seeds its own brief instead; a session handoff already written stays in scratch, unlinked, and the log names it.
- **Who writes the content.** Haiku writes the template's sections from the conversation. The header lines, files, commits and token figures come from code. If Haiku fails, the document holds the facts alone. A copy of every handoff also stays in `~/.claude/state/auto-handoff/`, which feeds the optional brief viewer and status line link.
- **What it adds.** Besides the template's sections, the automatic session handoff has a *Previous session* header line with the old session's id and transcript path, an *Instructions* section for the fresh session, a *Resume the run* section, a *Handoff records* section, a *How to Use This Brief* note, and the facts extracted in code (files, commits, token figures).
- **Handoff records.** Built in code from the *Stages* table of the run state the module read, this section lists only open work: that run state, the session handoff itself, and, for each row whose status is not `done` or `skipped`:
  - every record of the row's **latest pass**: the round in progress, or the first pass when no loop has opened, taken from the last handoff in the row's *Handoff* cell (or from its last record when it names no handoff);
  - every earlier handoff whose hand-back the row does not name, which is work never answered; a `to: human` handoff inside a phase is never counted as unanswered, since it never gets a hand-back (*Naming*, `from` / `to`);
  - every record whose name has no step code, since its pass cannot be told.

  Done first passes, done rounds and nested spawns that already returned are left out. `last-record` and its pair (same step code, agents swapped) come first when their stage is open. A file that is not on disk yet, such as a hand-back still to come, is marked `(missing)`. The seed line tells the fresh session to read them.
- **Tool gate.** Past the threshold, the module refuses each main-conversation tool call before it runs and tells the model a handoff is coming. The gate is main-loop-only: a subagent's tool calls are never refused. A session the module will not hand off (kill switch set, loop guard reached, already handed off) is never gated either.
- **Loop guards.** While the run the chain hands off stays `active`, the chain goes on: each fresh session hands off again when its context fills, however many handoffs ran without a prompt from the human. It ends when that run's status becomes `done`, `blocked` or `abandoned`; the module then pauses, says so above the prompt, and a prompt from the human resumes it. With no run of the chain, at most `maxConsecutiveHandoffs` handoffs (default 2) run before the human types a prompt; then the module pauses until they do. `chainWhileRunActive: false` applies that limit with a run too. A seeded session hands off no sooner than `seedHeadroomTokens` (default 40k) above its own starting size.
- **Session names.** The sessions of a chain are named `[ai-dlc:auto-handoff]: <original name> (Session N)` (`sessionNamePrefix`, `renameSessions`). The original name is the session's title as Claude Code passes it to the hooks, else the last `custom-title` in the transcript (a `/rename`), else its `ai-title`, else the session's 8-character id; it is carried down the chain, so names never nest. N is the title's number when the title ends in `(Session n)`: the title number wins, and the chain's lineage depth is used only when the title has none (else 1); the next session is N + 1. Each seeded session asks for that name as it starts, as the `sessionTitle` of the module's session-start answer; it gets it only if Claude Code honours a title returned by a hooks module, which is not yet confirmed on a live session. Only the main session, whose title has no number and which has no lineage depth, is renamed: to `(Session 1)` with `/rename` just before its `/clear`, unless it already has that name, and only when the running Claude Code has that command. A numbered session keeps its title. The module waits for the rename to run before it queues the `/clear`, so the two never run out of order; a rename still pending after 10 seconds is logged and the `/clear` goes ahead. Without `/rename` the main session keeps its own name, and the later sessions are named only through `sessionTitle`. When the module cannot read the lineage, it says so once per handoff (one log line marked `numbering fallback:`, one panel step, one toast where the panel is not drawn): the number comes from the title, or is 1 with no rename, and the chain id restarts. A rename that fails or is unavailable is logged and never stops the handoff. `/ai-dlc:init` and `/ai-dlc:configure-auto-handoff rename-check` report whether `/rename` is there; they cannot check `sessionTitle`.
- **Kill switches.** `enabled: false` stops handoffs; as `AI_DLC_AUTO_HANDOFF_ENABLED=false` in a shell, for the sessions started there. `DISABLE_AUTO_COMPACT` stops them too, because then something else owns the context limit. Either way the tool gate is off, and the brief viewer, when `viewer` is set, still serves earlier handoffs. With handoffs off, use the manual path.
- **Settings and log.** Every setting is a key of the repository's `.ai-dlc/auto-handoff.json`, which `/ai-dlc:init` writes and `/ai-dlc:configure-auto-handoff` shows and changes, with each key's `AI_DLC_AUTO_HANDOFF_*` variable and default. Each key is read, highest first, from `env` of `.claude/settings.local.json`, `env` of `.claude/settings.json`, the process environment, that file, then the default (the automatic handoff has no `/config` rows); the module reloads them at each session start. From that file, `viewer`, `briefTemplate` and `instructionsTemplate` apply only in a folder Claude Code trusts (`hasTrustDialogAccepted` in `~/.claude.json`; the rule is in `/ai-dlc:configure-auto-handoff`, *Workspace trust*): a cloned repository must not be able to serve your handoffs to the network or choose files the module writes and reads. Elsewhere they are skipped and logged, and the other keys still apply. A `viewer` that is not `host:port` is ignored and logged, wherever it is set. The old `AUTO_HANDOFF_*` variables and the token option `threshold` are no longer read. Everything the module does is logged to `~/.claude/state/auto-handoff/auto-handoff.log`. Its Haiku requests count against your plan or API usage.
- **Not on GitHub Copilot.** Copilot hooks expose no context size or timer, and document no way to run `/clear` or call a model, so the Copilot plugin ships no module and uses the manual path.

Adapted in part from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT).
Adapted in part from [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) (Apache-2.0); modified.
