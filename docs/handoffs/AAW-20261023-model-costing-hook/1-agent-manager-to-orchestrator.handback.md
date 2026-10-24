---
run: AAW-20261023-model-costing-hook
lifecycle: AAW
step: 1
from: agent-manager
to: orchestrator
mode: subagent
loop: none
received: 2026-10-23 15:10
verification: passed — "handoff 1-orchestrator-to-agent-manager.handoff.md: passed"; orchestrator re-ran: `node tools/build-copilot.mjs --check` up to date; `node .claude/scripts/sync-harness.mjs --check` in sync; `node .ai-dlc/workflow.mjs validate` valid; catalog check (regenerate + `git diff --no-index --quiet --ignore-cr-at-eol`) exit 0 → generated; `node --test "tests/**/*.test.mjs"` 559 tests, 556 pass, 1 fail (known marketplace test); `.ai-dlc/model-costing.json` has 20 models with the fields claimed; `.claude/hooks/update-model-costing.mjs` identical to the plugin template; changed paths match `git status`
---

[harness note on receipt: subagent output matched instruction-shaped pattern(s): settings-json; control tags neutralized.]

handoff 1-orchestrator-to-agent-manager.handoff.md: passed — record exists, matches the brief and the run state (step 1, in-progress); the Addendum was applied as well.

**Intent:** keep `.ai-dlc/model-costing.json` current for every Anthropic model, with prices and limits taken only from Anthropic's docs, never estimated. A project hook (not a plugin hook) refreshes it. The new plugin skill `model-costing` ships it, `/ai-dlc:init` runs that skill in every repository, and it is installed in this repository too.

**Price source:** https://platform.claude.com/docs/en/about-claude/pricing. The script fetches it as Markdown (`.md`, served as `text/markdown`). Other sources:
- https://platform.claude.com/docs/en/about-claude/models/overview: links to the model pages
- https://platform.claude.com/docs/en/models/<slug>/overview: ID, alias, context window, max output
- https://platform.claude.com/docs/en/about-claude/model-deprecations: dated IDs and status

The file records each URL at top level, and each model has `sources.pricing` and `sources.metadata`.

**What it holds:** 20 models, one per row of the pricing table (Haiku 5.5's two prompt-length rows are merged).
- Prices: `input`, `output`, `cacheWrite5m`, `cacheWrite1h`, `cacheRead`, `batchInput/Output`, `fastInput/Output`.
- `longContextPricing`: Haiku 5.5 above 100k tokens.
- Limits: `contextWindow`, `longContextWindow`, `maxInputTokens`, `maxOutputTokens`.
- Also `id`, `aliases`, `status` and `note`.
- Some figures are `null` because no page states them:
  - `maxInputTokens` and `longContextWindow`: no docs page states them, so `null` for every model.
  - All four limits: `null` for the retired Opus 4.1, Opus 4, Sonnet 4 and Haiku 3.5, which have no model page (404).

**Hook behaviour:**
- It has its own Stop entry, so it runs in parallel with `stop-sync-then-check.mjs` and `check-workflow.mjs`.
- It has a `PreToolUse` entry (matcher `Bash`) that exits at once unless the command is a `git commit`. `git commit-tree` is excluded.
- On Copilot it uses `agentStop` and `preToolUse`. The script accepts `toolArgs` as either a string or an object.
- It never blocks: on failure it keeps the old file, prints one line and exits 0.
- Each request times out after 10 s; a live run takes about 2.6 s. Writes are atomic (temp file, then rename).
- **Refresh interval:** 60 minutes, measured from the file's mtime. Override with `AI_DLC_MODEL_COSTING_MAX_AGE_MINUTES`, or pass `--force`. Pricing changes rarely, and a commit right after a stop does not refetch.
- A refetch that finds the same figures does not rewrite the file, so there is no commit churn; it only touches the mtime.
- After a failure it retries in 10 minutes.
- `AI_DLC_MODEL_COSTING=off` turns it off.
- If the file changes during a pre-commit run, it is not staged; the Claude `systemMessage` tells the user to `git add` it.

**No git pre-commit hook was added:**
- `.git/hooks` is not versioned.
- It would clash with Husky / lefthook / `core.hooksPath`.
- It would put a network fetch into every developer commit.
- It would modify a file without staging it.

**Changed paths:**
- code: `plugins/claude/ai-dlc/skills/model-costing/templates/update-model-costing.mjs`
- code: `plugins/claude/ai-dlc/skills/model-costing/templates/model-costing.schema.json`
- code: `plugins/claude/ai-dlc/skills/model-costing/templates/claude-hook.json`
- code: `plugins/claude/ai-dlc/skills/model-costing/templates/copilot-hook.json`
- docs: `plugins/claude/ai-dlc/skills/model-costing/SKILL.md`
- docs: `plugins/claude/ai-dlc/skills/init/SKILL.md` (description, Phase 0 file list, a new Phase 2 "Model costing" step)
- code: `.claude/hooks/update-model-costing.mjs` (installed copy of the template)
- code: `.ai-dlc/model-costing.schema.json` (installed copy)
- generated: `.ai-dlc/model-costing.json` (seeded by the script)
- code: `.claude/settings.json` (Stop and PreToolUse entries appended; nothing removed)
- code: `.github/hooks/ai-dlc-model-costing.json`
- code: `tests/model-costing/update-model-costing.test.mjs` (28 tests)
- docs: `tests/model-costing/fixtures/*.md` (7 saved docs pages: pricing, models overview, deprecations, opus-5-5, haiku-5-5, opus-4-5, sonnet-4-5)
- docs: `CLAUDE.md` ("Watch out for" bullet)
- docs: `.claude/rules/plugin-development.md` (bullet)
- generated: `.github/instructions/plugin-development.instructions.md` (harness sync, `--prefer claude`)
- generated: `.ai-dlc/catalog.json` (regenerated with `workflow.mjs catalog`; adds `model-costing`)
- generated: `plugins/copilot/ai-dlc/skills/model-costing/**`, `plugins/copilot/ai-dlc/skills/init/SKILL.md`, `plugins/copilot/ai-dlc/README.md`, `plugins/claude/ai-dlc/README.md`, `README.md`, `docs/plugins.md` (skill tables written by the build)
- docs: `.claude/agent-memory/ai-dlc-agent-manager/project_model-costing-hook.md`, `MEMORY.md` (memory)

`spikes/` was not touched, nothing was committed, and neither `agent-manager.md` nor any skill I own was edited.

**Checks:**
- `node --test "tests/**/*.test.mjs"`: 559 tests, 558 pass, 1 fail. All 28 model-costing tests pass. The one failure is not from this change: `the cache-keepalive mod is folded into ai-dlc` fails because the marketplace lists the throwaway spike plugins from commit 652a716.
- `node tools/validate.mjs`: "validate: every step passed".
- `node tools/build-copilot.mjs --check`: up to date.
- `node .claude/scripts/sync-harness.mjs --check`: "Everything in sync". The Copilot hook file uses the same commands as the Claude entries, so the sync pairs them.
- `node .ai-dlc/workflow.mjs validate`: valid.
- Script run by hand:
  - `--force`: created the file with 20 models.
  - Pre-commit payload with `git status`: silent, exit 0.
  - `git commit` with max age 0: refetched, found no change, exit 0.
  - Stop payload: throttled, exit 0.
- `git diff --check`: clean.

**Requests for a fresh agent-manager:**
1. `hook-management` SKILL.md, line 164: add `model-costing` to the hooks `init` installs, next to the test gates.
2. `plugin-management` SKILL.md, line 80: mention `model-costing` as a project hook installed through a skill.

**Open questions:**
- The `preToolUse` payload Copilot CLI really sends is unconfirmed. The docs disagree on whether `toolArgs` is a string or an object (research-assistant, medium confidence), so the script handles both.
- Max input tokens: the docs never state them, so they are `null`. The Models API returns `max_input_tokens`, but it needs an API key. Should the hook optionally read `ANTHROPIC_API_KEY` to fill them in?
- Is 60 minutes the right refresh interval?
