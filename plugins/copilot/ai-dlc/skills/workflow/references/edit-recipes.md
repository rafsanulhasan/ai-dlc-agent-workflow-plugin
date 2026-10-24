# Edit recipes

How common requests map to `.ai-dlc/workflow.json`. Changes are made by **Boris Cherny** (`agent-manager`) and reviewed in `AAWH` or `AAWP`: docs by **Linus Torvalds** (`brutal-critique`), code by **Kent Beck** (`sqa-engineer`) then **Robert C. Martin** (`code-reviewer`); stages are owned by agents such as **Zoran Horvat** (`system-engineer`), `code-reviewer` and **David Fowler** (`software-engineer`). Keys and their meaning are in `workflow.schema.json`; this file covers the moves that touch several keys at once. Agent ids are bare (`software-engineer`, never `software-engineer`).

| Request | Edit |
|---|---|
| "X reviews before Y" (e.g. system-engineer before code-reviewer in FDLC) | Add a stage `{ "id": "design-review", "agent": "system-engineer", "after": <Y's current after> }` before Y, then set Y's `after` to `["design-review"]`. |
| "X and Y run in parallel" | Give both the same `after`; set the stage that followed them to `after: [X, Y]`. |
| "Add our <agent> after <stage>" | Add the agent to `agents.custom` with a one-line `description` (its `.claude/agents/<id>.md` or `.github/agents/<id>.agent.md` must exist — creating it is `agent-management` work), then add a stage with `after: [<stage>]` and rewire the stage that followed `<stage>` to come after the new one, or leave it parallel if the developer says so. |
| "Skip <gate> / no sign-off at <gate>" | `gates.<id>.approver: "none"`. The handoff record is still written. For one run only, it is a request instruction, not a file edit. |
| "<gate> approved by the orchestrator" | `gates.<id>.approver: "orchestrator"`. |
| "Add a gate after <stage>" | Add `gates.<new id>` with `name`, `approves`, `approver`; set `gate` on the stage. |
| "Skip brutal-critique" / "no critique" | `documents.critic: null` skips the critique of documents only. `brutal-critique` cannot be disabled, and the `critique` stage of `AAWH` and `AAWP` (the lifecycles `routing.byType["Agent Artifact"]` lists) stays: every agent-artifact change is critiqued, and `validate` fails without that stage. Refuse the rest as a fixed guardrail. |
| "No tests / no code review for agent-artifact changes" | Refuse as a fixed guardrail: `sqa-engineer` and `code-reviewer` cannot be disabled, and `AAWP` keeps its `test` and `code-review` stages, each looping back to `change`, with `code-review` after `test`; `validate` fails otherwise. Their `when` is either omitted or the exact phrase [aaw-review.md](aaw-review.md) gives; it cannot be reworded. |
| "More / fewer review rounds" / "stop after N failed reviews" | Set `maxRounds` and `maxFailures` on each loop concerned, keeping `maxFailures` below `maxRounds`. Without editing the workflow, the developer sets that reviewer's variables (`AI_DLC_CRITIQUE_*`, `AI_DLC_TEST_*` or `AI_DLC_CODE_REVIEW_*` `MAX_ROUNDS` / `MAX_FAILURES`) in `env` of `.claude/settings.local.json` (just them), `.claude/settings.json` (the team) or the shell (one session); they override every loop of that reviewer in every lifecycle (the `workflow` skill's *Loop limits*). |
| "More / fewer review rounds for <stage> only" | `loop.maxRounds: N` (and `loop.maxFailures`, below N) on that stage only. Each step has its own pair, the `AAWH` and `AAWP` review stages included. |
| "Run without <agent>" | Add it to `agents.disabled`; then reassign or remove every stage, `routing.handOff` entry, clarify row and clarify target that names it. `validate` lists each one. |
| "Only run <stage> when …" | `when: "<condition in plain words>"` on the stage. |
| "Loop back to <stage> on …, at most N times" | `loop: { "to": "<stage>", "on": "…", "maxRounds": N }` on the stage that finds the problem, plus `"maxFailures"` below N. Omitted values default to 2 rounds and 1 failure (or N − 1 when lower). |
| "Bugs should go through <lifecycle>" | `routing.byType["Bug Fix"]: "<code>"`. |
| "Send <kind of work> straight to <agent>" | `routing.handOff["<kind of work>"]: "<agent>"`. |
| "Our own lifecycle for <situation>" | Add `lifecycles.<CODE>` with `kind: "custom"`, a `pickWhen` that names the situation, `exitArtifact` and `stages`; add a `routing.byType` entry only if a request type should default to it. |
| "<agent> may also ask <agent> about …" | Append `{ "agent": "…", "about": "…" }` to `clarify.matrix.<asker>`. |
| "More / fewer clarify rounds" | `clarify.maxRounds`, and `clarify.maxFailures` below it. |
| "Specs live in …" | The matching `artifacts` key; tell the developer to move existing files. |

## Checks before showing the change

- Every stage that followed a moved or removed stage still has a valid `after` (no dangling ids, no cycles).
- A lifecycle that still builds code keeps a `code-reviewer` stage, or the developer accepted the warning.
- Every `skills` entry names a plugin skill from `.ai-dlc/catalog.json` or a project skill (`.claude/skills/<name>/`, `.github/skills/<name>/`); a skill the project still needs is created first, through `skill-management`.
- `AAWH` still has its `critique` stage and `AAWP` its `critique`, `test` and `code-review` stages, each looping back to `change`, `code-review` lists `test` directly in its `after`, and each `when` is omitted or the exact phrase.
- Every loop, and `clarify`, keeps `maxFailures` below `maxRounds`.
- A removed stage's `gate` moved to the stage that now ends that part of the flow, unless the developer dropped the gate.
