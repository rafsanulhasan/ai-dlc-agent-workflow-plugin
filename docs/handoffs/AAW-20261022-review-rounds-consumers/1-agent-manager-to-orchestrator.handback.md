---
run: AAW-20261022-review-rounds-consumers
work-item: WI-2a
lifecycle: AAW
step: 1
from: agent-manager
to: orchestrator
mode: subagent
loop: none
received: 2026-10-22 08:45
---

handoff 1-orchestrator-to-agent-manager.handoff.md: passed — record exists, frontmatter complete (run, step 1, orchestrator → agent-manager, AAW, verification: pending); goal, design, changes and checks are clear and match the `workflow` skill's SKILL.md and references/aaw-review.md on disk.

## What I did

Everything that mentions review limits now follows the WI-1 design: per-loop `maxRounds` / `maxFailures` (default 2 / 1), no shared budget, limits from `node .ai-dlc/workflow.mjs rounds --json`, and the human deciding once per stopped step. Added the review-limit steps to `/ai-dlc:init` and resynced this repo's `.ai-dlc/` to the templates. All checks pass, including all 263 tests.

**1. orchestrator.md, and root AGENTS.md by hand.** The build does not regenerate root `AGENTS.md` (only `skills/init/templates/AGENTS.md`), so the same text was applied to both; lines 20–200 of the two files are now identical.
- **Execution:** loops stop when `maxRounds` or `maxFailures` is used up; a failing verdict is whatever the loop's `on` names.
- **New "Loop limits" bullet:** limits come from `rounds --json` and the orchestrator never works out the precedence itself; with no workflow file every loop gets 2 / 1; the human is asked once per stopped step — raise that loop's limits for this run (a one-off, recorded in run.md) or stop / accept; a fix round counts against the limits; open findings never pass on without that decision.
- **Critique stages (DW↔BC):** at most 2 rounds / 1 failure unless the `AI_DLC_CRITIQUE_*` pair is set; the three levels are spelled out (settings.local `env` → settings `env` → process env; on Copilot only the process env). This is the one place the orchestrator resolves a value itself, because `rounds` does not list critique stages (they have no loop object).
- **Run Loop step 1:** run `rounds --json` and record the limits in each run state.
- **Step 8:** `clarify.maxRounds` / `clarify.maxFailures` (default 2 / 1).
- **AAW step 5:** each reviewer has its own limits, no shared budget; the human decides on open findings.

**2. init/SKILL.md**
- **Phase 1:** the Team workflow bullet now says an existing file is merged. New "Review limits" question for the three reviewer pairs: default 2 / 1 (or the existing file's values; "keep" leaves them as they are); the `maxRounds ≥ maxFailures + 1` check; each developer can override in `.claude/settings.local.json` `env`, the team in `.claude/settings.json` `env`; init writes none of the variables.
- **Phase 2, settings row:** when the file exists, add only missing keys and entries, never replace a value, keep comments and layout (JSONC: edit the text in place).
- **Phase 2, team workflow:** schema and CLI are copied; an absent `workflow.json` is copied; a present one is never replaced — legacy `review.maxRounds` removed first (with consent), then `merge --dry-run`, then `merge` (passing `--plugin`, harmless; `merge` skips validation when there is no catalog yet); new step 2 writes the answers into every loop whose stage agent is that reviewer; then the catalog, the gate, and finally `validate` + `rounds`.

**3. Other prose**
- `ai-dlc/SKILL.md`: overrides list :21; AAW :93; Code Audit :125 and CRLC :146 now bounded; new "Loops are bounded" bullet in Step 3; clarify :198 now uses `clarify.maxRounds` / `maxFailures` (a round ending with the question still open counts as a failure).
- `agent-invocation` (:97, :170, :194), `request-routing` (:41).
- `handoff`: the run.md example shows a limits row, a "round 1 / 2 · failure 1 / 1" row, and a row where the human raised the limits.
- `README.md:58`.
- `docs/plugins.md`: :125, :127, :129, plus the `loop` and `clarify` rows of the table. The `validate` list at :125 said "unequal round budgets"; it now says "a `maxFailures` that is not below `maxRounds`".
- The leftover grep now finds only the deliberate "no shared budget" wording.

**4. `.ai-dlc/` resync** — copied `templates/workflow.json`, `workflow.schema.json` and `workflow.mjs` over `.ai-dlc/`. As decided, this replaces the uncommitted AAW `maxRounds: 1` edit. The catalog check found no drift, so `.ai-dlc/catalog.json` was not regenerated.

**Note:** my build also regenerated `plugins/copilot/ai-dlc/agents/agent-manager.agent.md` (2 lines). That comes from WI-2b's parallel edit to `agents/agent-manager.md`, not from me — attributed to WI-2b. I did not touch `agents/agent-manager.md`, `skills/workflow/` or `.claude/settings.json`; no commit.

## Changed paths
- plugins/claude/ai-dlc/agents/orchestrator.md — docs
- AGENTS.md — docs
- plugins/claude/ai-dlc/skills/init/SKILL.md — docs
- plugins/claude/ai-dlc/skills/ai-dlc/SKILL.md — docs
- plugins/claude/ai-dlc/skills/agent-invocation/SKILL.md — docs
- plugins/claude/ai-dlc/skills/request-routing/SKILL.md — docs
- plugins/claude/ai-dlc/skills/handoff/SKILL.md — docs
- README.md — docs
- docs/plugins.md — docs
- .ai-dlc/workflow.json — docs (byte-identical copy of the template)
- .ai-dlc/workflow.schema.json — docs (byte-identical copy of the template)
- .ai-dlc/workflow.mjs — code (byte-identical copy of `plugins/claude/ai-dlc/skills/workflow/templates/workflow.mjs`, already reviewed in WI-1)
- plugins/claude/ai-dlc/skills/init/templates/AGENTS.md — generated (build --check passes)
- plugins/copilot/ai-dlc/agents/orchestrator.agent.md — generated
- plugins/copilot/ai-dlc/skills/{init,init/templates/AGENTS.md,ai-dlc,agent-invocation,request-routing,handoff}/SKILL.md etc. — generated
- plugins/copilot/ai-dlc/agents/agent-manager.agent.md — generated (from WI-2b's source change)

## Intent
Bring every agent, skill and doc that uses review limits in line with WI-1's configurable model (per-loop `maxRounds` / `maxFailures`, default 2 / 1, no AAW shared budget, limits from `rounds --json`, a human decision when a loop stops); add the review-limit question, the merge-never-replace step for an existing workflow file and the JSONC-safe settings merge to `/ai-dlc:init`; resync this repo's `.ai-dlc/` so the full test suite passes.

## Checks
- `node tools/build-copilot.mjs` → "Copilot plugin written to plugins\copilot\ai-dlc: 15 agents, 61 skills, 0 hook event(s), 1 Claude-only hooks module(s) left out; 7 file(s) updated, 0 removed."
- `node tools/build-copilot.mjs --check` → "Copilot plugin and generated sources are up to date." (exit 0)
- `node --test "tests/**/*.test.mjs"` → tests 263, pass 263, fail 0
- `node .ai-dlc/workflow.mjs validate` → ".ai-dlc\workflow.json: valid" (exit 0)
- `node .ai-dlc/workflow.mjs rounds` → 13 rows (PDLC/accept, FDLC/tests, FDLC/architecture-review, FDLC/review, BFLC/review, RLC/mutation-check, RLC/review, TLC/review, CRLC/address, AAW/critique, AAW/test, AAW/code-review, clarify), every row maxRounds 2 / maxFailures 1, source `loop`.
- Catalog check: `catalog --plugin plugins/claude/ai-dlc --out <scratchpad>/catalog.json` → "ai-dlc 1.0.0-preview1 · 15 agents · 60 skills"; `git diff --no-index --quiet --ignore-cr-at-eol` → exit 0 (generated, no drift); temp file deleted.
- `merge --template … --plugin plugins/claude/ai-dlc --dry-run` on the resynced file → "nothing to add" (exit 0)
- Root AGENTS.md vs the generated init template, lines 20–200: identical
- `plugin validate` not run: no manifest change, no agent or skill added or removed.
