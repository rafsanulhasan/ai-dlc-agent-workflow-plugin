# Hand-back 08: research-assistant — cluster H-agile-loops

Stored verbatim on 2026-10-20 (work item RES-20261020-ai-dlc-mods).

---

No mod in cluster H covers sprint planning, retros, standups or adding loops to the workflow. Only loop-breaker matters for R17, and only for loops inside one agent's turn. The runaway-loop gap in the stage-level workflow loops has to be built here.

**Per-mod facts.** All four are MIT, Claude Code mods, released in October 2026, with no version number given on any listing.

| Mod | Function | Mechanism | Harness | Source / maturity |
|---|---|---|---|---|
| bengous-todos | Shows the repo's open TODO/FIXME/HACK comments in a band above the prompt, with a `/todos` command and a toast when a new TODO is added | Hooks on session start, prompt submit, command run, tool call and UI render; `/todos` command; reads `git grep` and `git blame`; no tokens, no network | Terminal and Desktop Code tab; in the VS Code panel "the hooks run but nothing draws"; Copilot not mentioned; CC ≥2.1.287 | github.com/bengous/claude-code-plugins; 5 stars; updated Oct 3, 2026; testing "Not stated by the author" ([page](https://claude-mods.com/bengous-todos/)) |
| autoresearch | Runs an experiment loop by itself: try an idea, benchmark it, keep it with a git commit or revert it, repeat | Three tools, `/autoresearch <goal>` and a resume prompt each turn, capped at 200 automatic resumes; user hook scripts in `.auto/hooks/`; terminal and web dashboards; reverts with `git checkout -- .` and `git clean -fd` | Terminal only; CC ≥2.1.292 | github.com/bn-l/claude-autoresearch-mod; about 3 stars; updated Oct 15, 2026; port of pi-autoresearch 1.8.1; the page says the loop "has no end without `maxIterations`" ([page](https://claude-mods.com/autoresearch/)) |
| loop-breaker | Refuses a tool call that has failed twice in a row with the same arguments and error, and refuses the 4th edit that flips a file back to an earlier version; shows a stuck meter; `/unstick` clears its history | A `tool.call` hook that also covers subagents; errors are hashed with SHA-256 and kept in memory | Terminal for the meter; refusals still apply in the VS Code panel and `claude -p`; Copilot not mentioned; CC ≥2.1.287 | github.com/ccdwyer/loop-breaker; 0 stars; 8 commits; doesn't check parallel calls in one message or notebook edits ([page](https://claude-mods.com/loop-breaker/), [repo](https://github.com/ccdwyer/loop-breaker)) |
| nanoflow | A pane that lists parallel git worktrees with their ticket, branch, ports, PR and CI state, plus a status line and toasts | Hooks that watch but never block; `/nanoflow`; 4 skills (`worktree-lifecycle`, `fix-bug`, `pr-screenshots`, `wrap-up-summary`); polls git every 15s and `gh api graphql` about every 5 min; optional npm CLI | Terminal and Desktop; VS Code and Copilot not mentioned; CC ≥2.1.287 | github.com/nanosite-ai/nanoflow; 14 stars; updated Oct 16, 2026; takes the ticket from the branch name ([page](https://claude-mods.com/nanoflow/)) |

Not verified: the minimum Claude Code version for loop-breaker (its repo doesn't state one), and the licence and last commit dates of bengous-todos, autoresearch and nanoflow, which come only from the listing pages.

**What the repo already has**
- **Task breakdown with a Definition of Done (DoD):** STBLC splits the frozen spec into tasks, each with its own technical DoD (`plugins/claude/ai-dlc/skills/ai-dlc/SKILL.md:84`). Each task records its AC references, dependencies, estimate and DoD (`ai-dlc/SKILL.md:118`, `.ai-dlc/workflow.json:149`).
- **Triage:** severity (`task-triage/SKILL.md:68`), checking a bug before triaging it (`:58`), execution waves (`:79`) and the `needs-info` state (`:87`).
- **Backlog and releases:** milestones (`product-planning/SKILL.md:75`), release checklist (`:21`, `:110-111`), P0 items block a release (`:62`).
- **Sprint, retro, standup:** nothing. A grep of `plugins/claude/ai-dlc/skills` found no sprint, retro or standup anywhere.
- **Loops:** the schema says `maxRounds` is optional: "Omitted: loop until the condition is cleared" (`workflow/templates/workflow.schema.json:267-270`). The validator only checks it is a positive integer (`workflow.mjs:271`). It is required, and must be equal, only on the AAW review loops (`workflow.mjs:343-352`). How to add a loop is documented (`workflow/references/edit-recipes.md:18`). The clarify loop is capped at 3 (`workflow.json:526`, `agent-invocation/SKILL.md:177`).
- **Unbounded loops in this repo's `.ai-dlc/workflow.json`:** 9 loops have no cap, at lines 79, 201, 221, 233, 281, 329, 339, 384 and 409 (line 79 is the product-owner sending stories back). Only the AAW loops at 437, 450 and 463 have `maxRounds: 3`.
- **Prior art outside this repo:** the session also has `engineering:standup` and `product-management:sprint-planning`, from other plugins. I didn't read either.

**R15 (agile practice):**
- **Covered:** AC-driven story breakdown into DoD-driven tasks (STBLC), backlog management (product-planning) and issue triage (task-triage).
- **Gaps:** sprint planning (no iteration or capacity model; estimates exist per task), retros, and standups. No candidate mod supplies these. bengous-todos only surfaces TODO comments in code, not backlog items, and nanoflow's ticket is just the branch name.
- **Feasibility:** high. These are agent-artifact work for agent-manager: add `plan-sprint`, `retro` and `standup` modes to product-planning, or a new skill, built on `docs/backlog/backlog.md`, the run states in `docs/handoffs/*/run.md` and the hand-back files.
- **Recommendation:** build. For the standup and sprint-planning shapes, reuse ideas from the two third-party skills after reading them. Don't integrate any of the four mods for R15.

**R17 (loop engineering):**
- **Adding new loops:** already covered by the workflow file's `loop` field (`to`, `on`, `maxRounds`) and edit-recipes line 18. Nothing to build beyond maybe a guided `/ai-dlc:workflow edit` recipe.
- **Detecting runaway loops, gap 1:** the workflow allows unbounded stage loops, and 9 exist in this repo. Feasible fixes:
  - a validate warning, or a fixed default cap, when `maxRounds` is missing;
  - the orchestrator counting rounds per loop in `run.md` and escalating, the same way the clarify loop already does.
- **Detecting runaway loops, gap 2:** loops inside one agent's turn (repeated failing tool calls, edit ping-pong). loop-breaker does exactly this, but only on Claude Code and with no Copilot path.
- **Recommendations:**
  - Stage-level loops: build, through agent-manager under AAW.
  - Tool-level loops: optionally recommend loop-breaker to Claude Code users. Don't bundle it, because the plugin ships no plugin-wide hooks (`.claude/rules/plugin-development.md`). It has 0 stars and no stated test coverage. Alternatively, reuse its idea (count repeats of the same arguments and error, refuse the third) in an installable hook skill like `node-test-gate`.
  - autoresearch: reuse the idea only, as a pattern for a benchmark loop with keep-or-revert and a hard turn cap (it uses 200). Don't integrate it: it is terminal-only and uses destructive `git clean -fd` rollbacks.
  - nanoflow: not in scope for R15 or R17. Its worktree pane belongs with whichever cluster covers parallel runs and observability.

**Confidence: medium.** Each mod is described from its claude-mods.com listing; only loop-breaker's repo was read to check it. The repo findings come from direct reads and greps.

**Open questions**
1. Should the cap for an uncapped loop be a hard `validate` error, which would break existing consumer workflows, or a warning plus a default cap?
2. Do sprints or iterations fit the gate-driven lifecycle, or should the agile ceremonies only be views over the backlog and run states?

I couldn't save memory in this session because it ran read-only.
