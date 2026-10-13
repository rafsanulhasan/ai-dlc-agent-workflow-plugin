# Edit recipes

How common requests map to `.ai-dlc/workflow.json`. Keys and their meaning are in `workflow.schema.json`; this file covers the moves that touch several keys at once. Agent ids are bare (`software-engineer`, never `ai-dlc:software-engineer`).

| Request | Edit |
|---|---|
| "X reviews before Y" (e.g. system-engineer before code-reviewer in FDLC) | Add a stage `{ "id": "design-review", "agent": "system-engineer", "after": <Y's current after> }` before Y, then set Y's `after` to `["design-review"]`. |
| "X and Y run in parallel" | Give both the same `after`; set the stage that followed them to `after: [X, Y]`. |
| "Add our <agent> after <stage>" | Add the agent to `agents.custom` with a one-line `description` (its `.claude/agents/<id>.md` or `.github/agents/<id>.agent.md` must exist — creating it is `agent-management` work), then add a stage with `after: [<stage>]` and rewire the stage that followed `<stage>` to come after the new one, or leave it parallel if the developer says so. |
| "Skip <gate> / no sign-off at <gate>" | `gates.<id>.approver: "none"`. The handoff record is still written. For one run only, it is a request instruction, not a file edit. |
| "<gate> approved by the orchestrator" | `gates.<id>.approver: "orchestrator"`. |
| "Add a gate after <stage>" | Add `gates.<new id>` with `name`, `approves`, `approver`; set `gate` on the stage. |
| "Skip brutal-critique" / "no critique" | `documents.critic: null`. To drop the agent everywhere, also add it to `agents.disabled` and remove its clarify row. |
| "Run without <agent>" | Add it to `agents.disabled`; then reassign or remove every stage, `routing.handOff` entry, clarify row and clarify target that names it. `validate` lists each one. |
| "Only run <stage> when …" | `when: "<condition in plain words>"` on the stage. |
| "Loop back to <stage> on …, at most N times" | `loop: { "to": "<stage>", "on": "…", "maxRounds": N }` on the stage that finds the problem. |
| "Bugs should go through <lifecycle>" | `routing.byType["Bug Fix"]: "<code>"`. |
| "Send <kind of work> straight to <agent>" | `routing.handOff["<kind of work>"]: "<agent>"`. |
| "Our own lifecycle for <situation>" | Add `lifecycles.<CODE>` with `kind: "custom"`, a `pickWhen` that names the situation, `exitArtifact` and `stages`; add a `routing.byType` entry only if a request type should default to it. |
| "<agent> may also ask <agent> about …" | Append `{ "agent": "…", "about": "…" }` to `clarify.matrix.<asker>`. |
| "More / fewer clarify rounds" | `clarify.maxRounds`. |
| "Specs live in …" | The matching `artifacts` key; tell the developer to move existing files. |

## Checks before showing the change

- Every stage that followed a moved or removed stage still has a valid `after` (no dangling ids, no cycles).
- A lifecycle that still builds code keeps a `code-reviewer` stage, or the developer accepted the warning.
- A removed stage's `gate` moved to the stage that now ends that part of the flow, unless the developer dropped the gate.
