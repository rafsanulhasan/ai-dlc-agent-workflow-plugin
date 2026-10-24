---
name: lens-workflow-identity
description: Human's binding rule (2026-10-24) for ai-dlc-lens: a workflow is one run (work item), never the spawner or timing; new runs never hide or merge into old ones
metadata:
  type: project
---

In ai-dlc-lens a workflow's identity is the run folder its brief's record names (the human's AC-1.5.1 and AC-1.5.2 with their definitions, run AAW-20261023-lens-plugin-from-spike step 1.5, 2026-10-24). A spawn naming run X joins X's workflow whatever spawned it, whenever, whether X is active, blocked or done; an unseen run folder is a new workflow. Only a brief with no run falls back to the request text (same request = same work item); only with no request either does "spawner's latest active workflow" (round 4) apply. Done runs stay listed, dimmed.

**Why:** the orchestrator spawned a second run's agent while the first run's agent still ran, and the lens merged them; the human ruled the round 4 "join while active" rule wrong for that.

Since 2026-10-23 (step 1.6.1.l1, addendum A5, human: "it must map to the parent run"): the identity is the run folder's *name*, lower case (`runIdOf`), never the path string, so relative, `./`, absolute Windows and worktree paths of one run are one run; a call with no run key takes the run of the agent it spawned or resumed (`callRunIds`); `unifyRuns` merges any split (applied in `joinWorkflow` and on every read for drawing, `readWorkflows`).

Since 2026-10-23 (step 1.6.1.l3): a run draws **one chart**; stage (task) panels keep title, status and Buttons but no chart of their own (per-stage charts were the split the human still saw; A5 fixtures had one stage row). The orchestrator node is shared by every run: in a run whose agents all ended it is drawn idle (`restingSpawner`, B2). Lens `$.state` lives in host memory for the session, never on disk: diagnose from the session transcript (Agent/SendMessage calls, queue-operation timeline) or the `probes` E10 log.

Since 2026-10-23 (FEAT step 27.1 and addendum L1, human: "Both"): a run with `parent: <run id>` in its run.md front matter is drawn in its top parent's chart (`runRoots` → `roots`, passed to `callRunIds`/`unifyRuns`/`joinWorkflow`); stages labelled `<child run>: <stage>`; unknown parent or a cycle leaves it its own run; order uses the parent's start (`workflowRunOf`). A brief naming a folder that was merged away is read from `merged-from-<run>.md` in the run it joined and treated as a child of that run (that file name is an orchestrator convention, not yet in the handoff skill). Charts wrap at the lens setting `chartAvatarsPerRow` (default 8, 2..24, `ChartSize.perRow`; was the constant `CHART_ROW_MAX` until step 27.2, 2026-10-24): one orchestrator spawning 40+ agents drew an unreadable 1-row strip. A gate row decided in words with a date is not "waiting" (`gateUndecided`). Replay a live session by appending a generated test that spawns every real brief in order (`.scratch/lens-27/gen.mjs`); tests take `test(name, { timeoutMs }, fn)`.

**How to apply:** `hooks/lens.ts` `joinWorkflow` (keys from `taskKeyOf`, requests from `callTask`). Any change that groups agents must keep both ACs and their tests (`tests/lens.test.tsx`, *step 1.5*). Related: [[claude-only-plugins]], [[plugin-test-harness-quirks]].
