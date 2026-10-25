---
description: Who writes documentation (documentation-writer only), what counts as documentation, how every other agent asks for it, and the status markers (planned, in progress until the last review or gate is done, none once done) taken from the run state, the backlog only for work no run records; every agent, lifecycle and workflow
---

# Documentation and its status

This rule binds every agent in every lifecycle and workflow: AI-DLC, PDLC, ASDLC, STBLC, FDLC, BFLC, RLC, TLC, CRLC, AAW, any custom lifecycle in `.ai-dlc/workflow.json`, and work done outside a run.

## What counts as documentation

"Documentation" is a closed list, and only these:

- READMEs (`README.md` in any folder);
- user guides, how-to pages, reference pages and other pages that tell a reader what the project does or will do, under `docs/` or elsewhere;
- release notes and changelogs.

Everything else is not documentation, and this rule does not cover it, even under `docs/`:

- **Lifecycle artifacts**, written by the agents whose stage produces them: everything under the paths of the workflow's `artifacts` section (defaults: the backlog `docs/backlog/` with its out-of-scope records `docs/backlog/out-of-scope/`, product briefs and stories `docs/product/`, specs `docs/specs/`, ADRs `docs/architecture/decisions/`, architecture narratives `docs/architecture/narratives/`, task plans `docs/plans/`, run records `docs/handoffs/`), and wherever they are kept: the glossary, research notes, low-level designs, test plans, test and mutation reports, review reports and critiques. In general, what a stage lists as its output (`produces`) belongs to that stage's agent.
- **Agent artifacts**: agent definitions, skills, rules and instructions, hooks, commands and prompts, the workflow file, `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`.
- **Agent memory** (`.claude/agent-memory/`).
- **Text a build generates** (for example a list a build script writes between markers), which stays with the build.

## Who writes documentation

- **Only `documentation-writer` authors or updates documentation**, status markers included.
- **Every other agent owns its work, not the documents about it.** When its work changes what the documentation should say (a feature starts, ships, changes or is dropped), it asks `documentation-writer` to write the change and does not edit the documentation itself.
- **How to ask.** Put a *Docs update* request in the hand-back (or, when there is no orchestrator, send it to `documentation-writer` directly). Name:
  - each document to change (path and section);
  - the status to show, worked out as below: *planned*, *in progress*, or done;
  - what changed, in one or two sentences, with the paths of the code or artifacts that show it.
- **When the docs stage runs.** The orchestrator runs a `documentation-writer` stage in the same run right after the stage that sent the request, before the run goes on. It runs that stage again, for the same documents and without waiting for a new request, each time their status changes: the building stage starts (*in progress*), the run's last review or gate stage is `done` (marker removed), the work stops (*planned*), or it is cancelled (text removed).

## The stages that decide the status

The status comes from the run that builds the feature, from two kinds of stage in its run state:

- **The building stage**: the stage that changes what the feature does — the implementation stage (FDLC, BFLC, RLC and AI-DLC: `software-engineer`), or the change itself in AAW (`agent-manager`). Stages before it (stories, specs, design, task plans) do not change the status.
- **Review stages**: every test, critique, review and gate stage after the building stage, with their fix rounds: for example `sqa-engineer`, `brutal-critique`, `code-reviewer` and gate G4, or the AAW reviews. The release stage and its go / no-go gate are not review stages: release notes say what shipped in a version.

A feature stays *in progress* from the moment the building stage starts until the run's **last** review stage is `done`. A finished building stage is not enough: documentation is not written as done while reviews are still pending.

## How `documentation-writer` writes the status

| State | When | How the document says it |
|---|---|---|
| **Planned** | Accepted, and no agent has started building it: no run builds it yet, or its building stage is `pending`, or `blocked` before it ever started. | Mark it *planned*. Say what it will do, in the future tense. |
| **In progress** | The building stage is `in-progress`; or it is `blocked` after it started; or it is `done` while any review stage after it is not `done` (`pending`, `in-progress`, `blocked`, or reopened by a fix round). | Mark it *in progress*. Describe only what already exists, and say what is not done yet. |
| **Done** | The run's last review stage is `done`, or the run is closed with `status: done`. | No marker. Describe it as it is, in the present tense. |

Worked examples:

- FDLC run: `software-engineer` `done`, `sqa-engineer` and `documentation-writer` `done`, `code-reviewer` `pending` → *in progress*. After G4 is approved → done, marker removed.
- AAW run: `agent-manager` `done`, `brutal-critique` returned REVISE and a fix round is `in-progress` → *in progress*; a fix round never moves the status back to *planned* or forward to done.
- A run whose stages are all `pending` → *planned*.

- Never call something *planned* while an agent is building it, or while its reviews are pending.
- Never describe planned or in-progress behaviour as if it shipped.
- Work that was cancelled or rejected is not described at all.
- Write the marker as the document already does. With no existing form, put `(planned)` or `(in progress)` after the heading, or start the paragraph with `**Planned:**` or `**In progress:**`.

## When to ask

| The work | Ask for |
|---|---|
| The building stage starts on something the documentation calls *planned* (or does not mention yet) | *in progress* |
| The building stage is `done` but review stages are still open | *in progress* stays; no new request needed |
| A review fails and a fix round starts | *in progress* stays |
| The run's last review stage is `done`, or the run closes `done` | the marker removed and the thing described as it is |
| The work stopped before it was done (the human stopped the run, or it closed without `done`) | *planned* again, if it is still in the backlog; otherwise the text removed |
| The work was cancelled or rejected | the text about it removed |
| Something done changed how it works (a later run) | the description updated once that run is done; *in progress* only for new behaviour that is still being built |

## Where the status comes from

Take the status from the records, never from memory or a guess:

1. **The run state.** The *Stages* table and `status` of the run's current run state, in the run folder (default `docs/handoffs/<run>/`; the workflow's `artifacts.handoffs` sets the path): the highest `run.v<version>.md` (`run.v2.md` above `run.v1.2.md` above `run.v1.1.md` above `run.v1.md`; the run state has one current version per session, and an older version is history and never gives the status), or `run.md` for a run from before versions. Read it as in the tables above.
2. **The backlog**, only for what no run records. The item's `Status` (default `docs/backlog/backlog.md`): Backlog is *planned*; In Progress or Review is *in progress*; Done is done; Cancelled is not described.

The run state always wins: it changes at every hand-off, and the backlog can lag behind it. A run with no backlog item (an AAW run, or work outside the backlog) takes its status from the run state alone. Work in the backlog with no run takes it from the backlog alone. When neither records the work, `documentation-writer` writes no marker and asks whoever briefed it.

## Reviews

For `brutal-critique` and `code-reviewer` alike, these are findings: a status marker that does not match the run state (or, for work no run records, the backlog), and a documentation file in the change set of any agent other than `documentation-writer`.
