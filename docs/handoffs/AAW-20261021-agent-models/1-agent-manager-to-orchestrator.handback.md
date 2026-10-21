---
run: AAW-20261021-agent-models
work-item: none
lifecycle: AAW
step: 1
from: agent-manager
to: orchestrator
mode: subagent
loop: none
received: 2026-10-21
---

Both parts of AAW-20261021-agent-models are done. As expected, the Copilot staleness check fails; the orchestrator still needs to rebuild.

**1. Model lines.** In each file below only the `model:` frontmatter line changed (one-line diff each). All values are aliases.
- `product-owner.md`, `product-manager.md`, `system-engineer.md`: opus → sonnet
- `research-assistant.md`: opus → haiku
- `presentation-manager.md`: sonnet → haiku

`grep '^model:'` across the agents folder now shows orchestrator, agent-manager, software-architect and requirement-analyst on opus, these two on haiku, and every other agent on sonnet.

**2. agent-invocation rule.** I added a "Model per spawn" bullet to the Claude Code invocation-forms section of `agent-invocation/SKILL.md`, right after "Foreground vs background". It says:
- `research-assistant` runs on Haiku by default.
- The caller passes `model: "sonnet"` only when the research must reason over more than about 80K tokens of documents or sources together, or must synthesise or compare rather than look something up. The bullet gives the reason for the threshold: Haiku 5.5 costs more above 100K prompt tokens, and the margin covers tokenizer differences.
- Otherwise the caller splits a large question into smaller parallel Haiku spawns.
- Copilot ignores the choice because the build drops `model:`.

I did not touch `agent-management/SKILL.md` or any other skill I own, and I did not run the build.

Changed paths:
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\plugins\claude\ai-dlc\agents\product-owner.md — docs
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\plugins\claude\ai-dlc\agents\product-manager.md — docs
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\plugins\claude\ai-dlc\agents\system-engineer.md — docs
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\plugins\claude\ai-dlc\agents\research-assistant.md — docs
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\plugins\claude\ai-dlc\agents\presentation-manager.md — docs
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\plugins\claude\ai-dlc\skills\agent-invocation\SKILL.md — docs
- (generated, not yet regenerated) plugins/copilot/ai-dlc/skills/agent-invocation/SKILL.md — generated; the orchestrator's `node tools/build-copilot.mjs` will produce it

Intent: Lower the cost of running the agent team by moving five agents to cheaper default models, and tell callers when one `research-assistant` spawn should run on Sonnet instead of Haiku (long-context or synthesis work), with chunked parallel Haiku spawns for everything else.

Checks:
- `node tools/build-copilot.mjs --check` → exit 1: "Copilot plugin is stale: 1 changed, 0 extra file(s). Run: node tools/build-copilot.mjs — skills/agent-invocation/SKILL.md". This is the stale result you predicted. Only the skill is listed, because the build drops `model:` and so the agent changes do not change the Copilot output. That matches the note in the new rule.
- `git diff --stat`: 6 files, 11 insertions and 5 deletions; each agent file is a one-line change.
- I did not run `plugin validate --strict`: no manifest changed and no agent or skill was added or removed.
