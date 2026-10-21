---
run: AAW-20261021-handoff-naming-self
work-item: none
lifecycle: AAW
step: 1
from: agent-manager
to: orchestrator
mode: subagent
loop: none
received: 2026-10-21
---

Self-change done: my own definition and the `workflow` skill now use the new handoff/handback naming, and the keys of `lifecycles` are now the one authoritative list of lifecycle codes (O8). I did not touch the parallel item's files and wrote nothing under docs/handoffs/. Nothing is committed.

What changed:
- **`agent-manager.md` (main agent, no orchestrator):** the run folder is now `docs/handoffs/AAW-<YYYYMMDD>-<feature-slug>/`. Before each reviewer spawn I write `<step>[.<sub>][.l<round>]-agent-manager-to-<reviewer>.handoff.md`. When a reviewer returns, I store its report verbatim as `…-<reviewer>-to-agent-manager.handback.md`. File names use agent IDs only, and at close the handoff records are committed too.
- **Own hand-back file dropped:** the old `<NN>-agent-manager-handback.md` has no counterpart now. The spec only has agent-to-agent files and I didn't want to invent a `human` ID, so my changed paths, intent and checks travel inside each reviewer handoff record instead. Push back if you want a separate file.
- **Line 180:** the orchestrator now also "writes each handoff record".
- **`workflow.json`:** the AAW note says AAW now writes handoff records and stores hand-backs in the run's folder. The `artifacts.handoffs` default is now `docs/handoffs/{LIFECYCLE}-{YYYYMMDD}-{feature-slug}/`.
- **`workflow.schema.json`:**
  - The `lifecycles` description makes its keys the authoritative code list and drops its own copied list (which was missing AAW).
  - The `handoffs` description gives the full spec: placeholders, `work-item:` front matter, `.handoff.md`/`.handback.md` patterns, step/sub/loop rules, who writes in subagent vs agent-team mode, and that the receiver verifies, never the writer.
  - Lines 186 and 253 needed no change.
- **O8 approach:** `workflow.mjs` and the tests are unchanged. The existing key pattern `^[A-Za-z][A-Za-z0-9_-]*$` is already safe for folder names.
- **`aaw-review.md:49`** and **`SKILL.md:37`** now match the new rule, and `SKILL.md` has a new bullet on lifecycle codes.
- **`.ai-dlc/` copies:** the repo's `workflow.json` and `workflow.schema.json` are byte copies of the new templates. `workflow.mjs` and `catalog.json` were left alone (no agents, skills or version changed).

For the parallel item: the `handoff` skill still describes the old `<NN>` names and the `WI-NNN` run heading. `SKILL.md` and `agent-manager.md` point to it for details, so it must land in the same change.

Changed paths:
- `plugins/claude/ai-dlc/agents/agent-manager.md` — docs — no-orchestrator branch uses new folder and file names
- `plugins/claude/ai-dlc/skills/workflow/SKILL.md` — docs — guardrail: AAW records handoffs; lifecycle-code bullet
- `plugins/claude/ai-dlc/skills/workflow/references/aaw-review.md` — docs — run folder holds handoff records too
- `plugins/claude/ai-dlc/skills/workflow/templates/workflow.json` — code — AAW note; new handoffs path default
- `plugins/claude/ai-dlc/skills/workflow/templates/workflow.schema.json` — code — lifecycles keys are the list; handoffs naming spec
- `.ai-dlc/workflow.json` — code — copy of the template
- `.ai-dlc/workflow.schema.json` — code — copy of the template
- `plugins/copilot/ai-dlc/agents/agent-manager.agent.md` — generated
- `plugins/copilot/ai-dlc/skills/workflow/SKILL.md` — generated
- `plugins/copilot/ai-dlc/skills/workflow/references/aaw-review.md` — generated
- `plugins/copilot/ai-dlc/skills/workflow/templates/workflow.json` — generated
- `plugins/copilot/ai-dlc/skills/workflow/templates/workflow.schema.json` — generated

I marked the JSON files `code` because the CLI reads and validates them; that is the stricter reading, since most edits there are description strings.

Intent: make my definition and the `workflow` skill follow the new `{LIFECYCLE}-{YYYYMMDD}-{feature-slug}/` folder and `{step}[.{sub}][.l{loop}]-{from}-to-{to}.handoff.md|.handback.md` names (AAW included) and make the `lifecycles` keys the single lifecycle-code list (O8).

Checks:
- `node tools/build-copilot.mjs` → "Copilot plugin written to plugins\copilot\ai-dlc: 15 agents, 61 skills, 0 hook event(s); 5 file(s) updated, 0 removed."
- `node tools/build-copilot.mjs --check` → "Copilot plugin and generated sources are up to date." (exit 0)
- `node .ai-dlc/workflow.mjs validate` → ".ai-dlc\workflow.json: valid" (exit 0)
- `JSON.parse` of `.ai-dlc/workflow.schema.json` → ok
- `node --test` → "tests 134 … pass 134 … fail 0" (no code changed; run as a safety net)
- Catalog check: not run because the permission prompt denied it; `.ai-dlc/catalog.json` is not in the change set.
