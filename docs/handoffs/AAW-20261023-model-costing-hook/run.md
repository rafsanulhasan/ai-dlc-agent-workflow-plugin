---
run: AAW-20261023-model-costing-hook
status: done
lifecycle: AAW
mode: subagent
branch: feat/ai-dlc-lens
session: 4ef2c10f-857f-4b02-8574-47f4cc799591
commit: 11f36b0
last-record: 3.2.l2-code-reviewer-to-orchestrator.handback.md
updated: 2026-10-23 22:40
---
# Run: model-costing skill and the project hook that keeps .ai-dlc/model-costing.json current

## Request
The human (2026-10-23, finding 4 on spike 027): "don't interpret the costings. identify which agent is using which model from the model def or orchestrator's call. maintain a model-costing.json in .ai-dlc folder to store the costing for each models anthropic offers. make it as a hook for the project (not the plugin) so that the pricing is always up to date."

## Clarified intent (human's answers, 2026-10-23)
- Cost is computed only from `.ai-dlc/model-costing.json`. It is never estimated or hard-coded, and a model missing from the file shows `—`.
- Refresh "after every run completes and just before committing. can be parallely with plugin validation".
- ~~This repository only~~, superseded the same day: **installed by `/ai-dlc:init` in target repositories too** (a plugin skill that init runs, like the stack test-gate hooks), and in this repository. Never a plugin-wide hook.
- Addendum: the hook also fetches model metadata. That is the context window (and long-context window), max input/output tokens, and cache read/write for both 5 min and 1 h.
- Consumer: the ai-dlc-lens spike 027 (run FEAT-20261020-ai-dlc-lens, step 17.l2) reads the file.

## Routing
Agent Artifact (plugin skill + repository hook) → AAW. agent-manager, then reviews by kind: docs → brutal-critique; code → sqa-engineer → code-reviewer. Runs in parallel with FEAT-20261020-ai-dlc-lens step 17.l2.

## Gates and loops
AAW/critique 2/1 · AAW/test 2/1 · AAW/code-review 2/1 (from `rounds --json`, source `loop`)
- **AAW/critique raised for this run to 3, then 4 rounds** (one-off) — the human, 2026-10-23.
- Human, 2026-10-23, on critique 2.1.l2 Major 1: **keep old API-filled values** when the Models API isn't called or fails (no churn). Fix round 1.l3 then fixes that, the header-conflict note, the 3 Minors, and whatever test round 3 (2.2.l2) finds; then critique round 4 and code-review round 2 (the script change adds its own tests, reviewed by code-reviewer; the test limit 3 / 3 is used).
- **AAW/test raised for this run to 3 rounds** (one-off; workflow file unchanged) — the human, 2026-10-23: "allow it", for the re-test after the fix round that fixes the mkdirSync defect (2.2.l1).

## Stages
| Step | Stage | Agent | Status | Record |
|---|---|---|---|---|
| 1 | pricing file + hook + model-costing skill (+ addendum: model metadata) | agent-manager | done (passed) | 1-agent-manager-to-orchestrator.handback.md |
| 2.1 | critique (docs) | brutal-critique | done (passed) · **REVISE**: 1 Blocker (done-condition fails on an unchanged refetch), 4 Major, 5 Minor; critique round 1 / 2, failure 1 / 1 | 2.1-brutal-critique-to-orchestrator.handback.md |
| 2.2 | test (code) | sqa-engineer | done (passed) · 44 tests added (72 / 72); 1 low defect (empty CLAUDE_PROJECT_DIR, mjs:490); test round 1 / 2 | 2.2-sqa-engineer-to-orchestrator.handback.md |
| 1.l1 | fix round 1: rename to model-metadata + critique findings + defect + long-context threshold | agent-manager | done (passed) · all 10 findings fixed, defect fixed, threshold field + override; 81 / 81 | 1.l1-agent-manager-to-orchestrator.handback.md |
| 2.3.l1 | rename in hook-management + plugin-management (owned skills) | agent-manager (fresh) | done (passed) | 2.3.l1-agent-manager-to-orchestrator.handback.md |
| 2.2.l1 | re-test (code), round 2 / 2 | sqa-engineer | done (passed) · 22 tests; 1 defect (mjs:494 mkdirSync outside try; `todo` test) → next fix round; test step limits used up — the re-test after that fix needs the human's decision | 2.2.l1-sqa-engineer-to-orchestrator.handback.md |
| 3.1 | code review, axis standards | code-reviewer | done (passed) · changes-requested: 1 Blocker (mjs:494, known), 3 Major (utimesSync :490, statSync :464, cwd-relative hook commands → `$CLAUDE_PROJECT_DIR`), 3 Minor, 1 question, 2 suggestions | 3.1-code-reviewer-to-orchestrator.handback.md |
| 1.l2 | fix round 2: review findings + defect + human answers (interval 0; Models API via ANTHROPIC_API_KEY for null limits) | agent-manager | done (passed) · all fixed except allSettled (declined, reason given); 118 / 118 | 1.l2-agent-manager-to-orchestrator.handback.md |
| 2.2.l2 | test round 3 / 3 | sqa-engineer | done (passed) · 21 tests, 0 defects; 667 pass; round4:272 asserts the old churn rule → updated in 1.l3 | 2.2.l2-sqa-engineer-to-orchestrator.handback.md |
| 1.l3 | fix round 3: keep API-filled values (human), header note, 3 Minors | agent-manager | done (passed) · 145 / 145 | 1.l3-agent-manager-to-orchestrator.handback.md |
| 2.1.l3 | critique round 4 / 4 | brutal-critique | done (passed) · **PASS**; 1 Minor: stale header comment mjs:17-18 (code) | 2.1.l3-brutal-critique-to-orchestrator.handback.md |
| 3.1.l1 | code review round 2 / 2, standards | code-reviewer | done (passed) · **approve**; 1 Warning (10-page cap → partial answer flips the file), 4 Minor (100 s vs 60 s timeout, redirect, temp stamp name, constants), 1 question (limit=1000) | 3.1.l1-code-reviewer-to-orchestrator.handback.md |
| 1.l4 | last fix round (human): page-cap warning, timeout budget, redirect, temp stamp, constants, page size, stale comment; ctx-window fill kept (human) | agent-manager | done (passed) · 158 / 158; stamp → user cache dir; limit 1000 cited | 1.l4-agent-manager-to-orchestrator.handback.md |
| 3.1.l2 | final re-review, standards (code-review limit raised to 3) | code-reviewer | done (passed) · **approve** | 3.1.l2-code-reviewer-to-orchestrator.handback.md |
| 3.2.l2 | final re-review, spec (+ the SKILL.md / memory changes of 1.l4) | code-reviewer | done (passed) · **approved** | 3.2.l2-code-reviewer-to-orchestrator.handback.md |
| 3.2.l1 | code review round 2 / 2, spec | code-reviewer | done (passed) · **approved** (0 Blocker, 0 Warning, 4 suggestions) | 3.2.l1-code-reviewer-to-orchestrator.handback.md |
| 3.x.l1 | code review round 2 (standards, spec) after 2.2.l2 | code-reviewer ×2 | pending | — |
| 2.1.l2 | critique round 3 / 3 (limit raised by the human, 2026-10-23) on docs changed in 1.l2 | brutal-critique | done (passed) · **REVISE**: 2 Major (API-filled values revert on a run without the key → churn; header conflict not stated), 3 Minor; limit used up → human | 2.1.l2-brutal-critique-to-orchestrator.handback.md |
| 3.2 | code review, axis spec | code-reviewer | done (passed) · approved (0 Blocker); W1 mjs:494; W2 60-min throttle vs "always up to date" (human); max input tokens via API key (human) | 3.2-code-reviewer-to-orchestrator.handback.md |
| 2.1.l1 | critique round 2 / 2 (docs incl. 2.3 / 2.3.l1) | brutal-critique | done (passed) · **PASS**; 3 Minors (schema "every figure from docs" except the override; "unknown for any prompt"; memory duplication) ride along with the next fix round | 2.1.l1-brutal-critique-to-orchestrator.handback.md |
| 2.3 | hook-management + plugin-management mention (owned skills) | agent-manager (fresh) | done (passed); 2 docs files join the next critique round | 2.3-agent-manager-to-orchestrator.handback.md |
| 3.x | code review (standards, spec) after 2.2 | code-reviewer ×2 | pending | — |

## Change kinds (step 1)
- **code:** `update-model-costing.mjs` (template, and the identical installed copy), `claude-hook.json`, `copilot-hook.json`, `.claude/settings.json`, `.github/hooks/ai-dlc-model-costing.json`, `tests/model-costing/*.test.mjs`, `model-costing.schema.json`. agent-manager marked the schema code; the rule makes it docs. The stricter reading wins, so it goes to both paths.
- **docs:** `model-costing/SKILL.md`, `init/SKILL.md`, `.ai-dlc/model-costing.json`, `CLAUDE.md`, `.claude/rules/plugin-development.md`, memory, fixtures.
- **generated:** `plugins/copilot/**`, the README skill tables, the `.github/instructions` twin, and `.ai-dlc/catalog.json` (catalog check exit 0).

## Pending change (human, 2026-10-23)
Rename to **model-metadata**, "since it fetches all model related metadata". This covers the skill `model-costing` → `model-metadata`, the script `update-model-costing.mjs` → `update-model-metadata.mjs`, `.github/hooks/ai-dlc-model-costing.json` → `ai-dlc-model-metadata.json`, `.ai-dlc/model-costing{,.schema}.json` → `model-metadata{,.schema}.json` (orchestrator's reading, open to the human's correction), `AI_DLC_MODEL_COSTING*` → `AI_DLC_MODEL_METADATA*`, `tests/model-costing/` → `tests/model-metadata/`, and every mention, including the init, hook-management and plugin-management skills, CLAUDE.md, the rules and memory. It is sent to agent-manager in fix round 1.l1 together with the 2.1 and 2.2 findings, so the tests being written are not broken mid-run. The run folder keeps its name (records are history). Spike 027 is told to read model-metadata.json first, falling back to model-costing.json.

## Open for the human
- Max input tokens are `null` because no docs page states them. Should the hook optionally read `ANTHROPIC_API_KEY` to fill them in from the Models API?
- Is the 60-minute refresh interval right?


## Close (2026-10-23)
Every path clean: critique PASS (round 4), tests 158 / 158 (repo 686 pass, 1 known marketplace failure from the lens spikes), code review approve on both axes (round 3). Committed with this run's records.

Follow-ups (not blocking): move the `API_FIELDS` block above the `buildMetadata` JSDoc (update-model-metadata.mjs:360-373); make `round5.test.mjs:170` pass an explicit env/homedir; the Models API headers are unverified live; the Copilot `preToolUse` payload shape is unverified; the other Stop hooks still use cwd-relative paths; delete `.scratch/aaw-model-metadata-l3/` and the empty `tests/model-costing/` (both untracked).
