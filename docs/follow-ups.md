# Follow-ups

Non-blocking items left open by the customizable-workflow work ([PR #10](https://github.com/rafsanulhasan/ai-dlc-agent-workflow-plugin/pull/10)). Each was raised in review and accepted for later. Changes to agents and skills go through `agent-manager` and the AAW review, as usual.

| # | Item | Where | Raised by |
|---|---|---|---|
| 1 | AAW step 2 omits the `workflow.mjs` exception | `plugins/claude/ai-dlc/agents/orchestrator.md` (AAW step 2) | `brutal-critique` |
| 2 | The catalog check does not say what a failed regeneration means | `plugins/claude/ai-dlc/skills/workflow/references/aaw-review.md` (Catalog check) | `brutal-critique` |
| 3 | The upgrade reminder needs a version bump at every release | `plugin.json`, marketplace entries | `brutal-critique` |
| 4 | Copilot `agentStop` payload keys are unverified | `skills/workflow/templates/check-workflow.mjs`, `copilot-hook.json` | orchestrator review |

## 1. AAW step 2 omits the `workflow.mjs` exception

AAW step 2 in the orchestrator says: exit 0 means `.ai-dlc/catalog.json` is generated, and anything else means docs. `aaw-review.md` adds an exception. When `.ai-dlc/workflow.mjs` is in the same change set, the catalog goes to docs for that round whatever the exit code, because the change set is classified before that script's code review runs.

The outcome is still correct, because step 3 reads `aaw-review.md`, but the two statements disagree on their face.

**Fix:** in step 2, add "unless `.ai-dlc/workflow.mjs` is in the change set", then rebuild (`AGENTS.md` is generated from `orchestrator.md`).

## 2. The catalog check does not say what a failed regeneration means

The catalog check says "any other exit" means docs, but that covers only the comparison in sub-step 2. If the `catalog` command in sub-step 1 fails (plugin root not found, no agents), the comparison never runs.

**Fix:**
- State that a failed regeneration also means docs.
- State that the temp file is deleted whatever happens.
- Suggest where the temp file goes, for example the scratchpad or the OS temp folder.

## 3. The upgrade reminder needs a version bump at every release

At session start, the orchestrator compares `plugin.version` in `.ai-dlc/catalog.json` with the installed plugin's version. It reminds the human to run `/ai-dlc:workflow upgrade` only when they differ. A consumer whose catalog was generated under `1.0.0-preview1` before these changes gets no reminder while the version stays `1.0.0-preview1`. Plugin updates are also keyed on `version`.

**Fix:** bump the version in `plugins/claude/ai-dlc/.claude-plugin/plugin.json` and in the marketplace entries at every release. The planned sequence is `1.0.0-preview2`, then `1.0.0`, `1.0.1`, `1.1.0` and `2.0.0`.

## 4. Copilot `agentStop` payload keys are unverified

The workflow Stop hook reads field names from Copilot's `agentStop` hook input. `node-test-gate` relies on the same field names. Neither has been checked against a real Copilot run.

**Fix:** capture a real `agentStop` payload from Copilot. Then confirm or correct the field names in both hooks, and record the verified schema next to the hook templates.
