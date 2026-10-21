---
run: AAW-20261021-handoff-naming
work-item: none
lifecycle: AAW
step: 2
from: agent-manager
to: orchestrator
mode: subagent
loop: none
received: 2026-10-21
---

AAW-20261021-handoff-naming (WI-B): done. Every item in the brief is applied, and the build, `--check`, `validate`, `node --test` and both plugin validations pass. I did not commit, did not touch the files the parallel instance owns (agent-manager.md, skills/workflow/**, skills/plugin-management/**, .ai-dlc/**), and did not touch the two AAW-20261021-handoff-naming* run folders.

Decisions I made that the brief left open (please confirm or send back):
- **How the receiver's check reaches the record (subagent mode):** the receiver puts its check result on the first line of its report, and the orchestrator copies it into the handoff record's `verification` field. In an agent team the receiver sets the field itself.
- **Gate record:** at a gate the orchestrator writes the next handoff record with *Gate evidence*, and the approver approves that record. When no agent follows the gate, the record is addressed `to: human`; `human` is the only non-agent name allowed.
- **Agent team is Mode 5.** It is added as a new mode so Modes 1–4 keep their numbers.
- **Clarification relays:** a relay sent with `SendMessage` gets no new step. A fresh agent spawned to answer a question gets the next step.
- **Front matter:** hand-backs carry `received` and no `date`; handoff records carry `verification` and `date`. `loop` is `none` or the round number. I also added `gate:` to the handoff template (it was in the old template).
- **Two extra files:** I fixed `implement-feature/SKILL.md:141` (it said "stage ends with a handoff record"), because it contradicted the new rule. The brief did not list it.
- **Migrated hand-backs:** the stack-commands hand-backs had no front matter, so I added it above the unchanged content. In the other runs I replaced the old front matter; the reports themselves are unchanged.
- **Cross-links:** the "Sibling item" links between the agent-models and model-policy `run.md` files still resolve, because the folder names did not change, so I left them as they were.
- **Root `AGENTS.md`:** I copied its persona and project-facts blocks from the generated init template and kept this repo's own quality-gate line.
- **Memory:** I wrote the two memory files directly rather than through the manage-memory skill.

Changed paths:
- `plugins/claude/ai-dlc/skills/handoff/SKILL.md` — docs — rewrite: naming, writer by mode, templates, O2/O3/O4/O6/O7/O8
- `plugins/claude/ai-dlc/agents/orchestrator.md` — docs — runtime reason, Run Loop 1/7–10, AAW steps, modes, Skills row
- `plugins/claude/ai-dlc/skills/agent-invocation/SKILL.md` — docs — nesting, record naming, clarify relay, agent-team parallelism
- `plugins/claude/ai-dlc/skills/request-routing/SKILL.md` — docs — Mode 3 renamed; Mode 5 agent team added, with its conditions
- `plugins/claude/ai-dlc/skills/ai-dlc/SKILL.md` — docs — AAW records, Every-handoff rule, clarify nesting, handoff entry
- `plugins/claude/ai-dlc/skills/review/SKILL.md` — docs — spawn conditions reflect nesting; spec lookup in run folder
- `plugins/claude/ai-dlc/skills/implement-feature/SKILL.md` — docs — stage ends with hand-back, not handoff record
- `plugins/claude/ai-dlc/agents/{software-engineer,sqa-engineer,software-architect,system-engineer,requirement-analyst,product-manager,product-owner,devops-engineer,documentation-writer}.md` — docs — one rule: subagent vs team writer
- `plugins/claude/ai-dlc/agents/code-reviewer.md` — docs — verifies its incoming record; the report is stored for it
- `plugins/claude/ai-dlc/agents/brutal-critique.md` — docs — critiques records and hand-backs; never writes one
- `tools/templates/AGENTS.template.md` — docs — project facts: run folder, naming, artifact path row
- `AGENTS.md` — docs — persona and project-facts blocks copied from generated template
- `README.md` — docs — run folder and naming; main-agent reason; nesting facts
- `docs/plugins.md` — docs — run folder and naming; main-agent reason; gates and fixed rules; matrix row
- `docs/handoffs/AAW-20261016-stack-commands-out-of-agents-md/{run.md,1-…,2-…handback.md}` — docs — migration
- `docs/handoffs/AAW-20261021-agent-models/{run.md,4 hand-backs}` — docs — migration
- `docs/handoffs/AAW-20261021-model-policy/{run.md,7 hand-backs}` — docs — migration
- `.claude/agent-memory/ai-dlc-agent-manager/project_handoff-naming.md` — docs — naming and writer-by-mode decision
- `.claude/agent-memory/ai-dlc-agent-manager/project_handoff-gaps.md` — docs — deferred backlog: O5, stale data, Copilot nesting, depth 3
- `.claude/agent-memory/ai-dlc-agent-manager/MEMORY.md` — docs — two index lines added
- `plugins/claude/ai-dlc/skills/init/templates/AGENTS.md` — generated
- `plugins/copilot/ai-dlc/agents/{brutal-critique,code-reviewer,devops-engineer,documentation-writer,orchestrator,product-manager,product-owner,requirement-analyst,software-architect,software-engineer,sqa-engineer,system-engineer}.agent.md` — generated
- `plugins/copilot/ai-dlc/skills/{agent-invocation,ai-dlc,handoff,implement-feature,request-routing,review}/SKILL.md`, `plugins/copilot/ai-dlc/skills/init/templates/AGENTS.md` — generated

Migration (all with `git mv`; in each `run.md` I added `run:` and `last-record:`, set `work-item: none`, and gave the Stages table Step/Handoff/Handback columns with handoff cells "not recorded (pre-convention)"):

| Run folder | Old | New |
|---|---|---|
| AAW-20261016-stack-commands-out-of-agents-md | 01-agent-manager-handback.md | 1-agent-manager-to-orchestrator.handback.md |
| AAW-20261016-stack-commands-out-of-agents-md | 02-brutal-critique-handback.md | 2-brutal-critique-to-orchestrator.handback.md |
| AAW-20261021-agent-models | 01-agent-manager-handback.md | 1-agent-manager-to-orchestrator.handback.md |
| AAW-20261021-agent-models | 02-brutal-critique-handback.md | 2-brutal-critique-to-orchestrator.handback.md |
| AAW-20261021-agent-models | 03-agent-manager-handback.md | 1.l1-agent-manager-to-orchestrator.handback.md |
| AAW-20261021-agent-models | 04-brutal-critique-handback.md | 2.l1-brutal-critique-to-orchestrator.handback.md |
| AAW-20261021-model-policy | 01-agent-manager-handback.md | 1-agent-manager-to-orchestrator.handback.md |
| AAW-20261021-model-policy | 02-brutal-critique-handback.md | 2-brutal-critique-to-orchestrator.handback.md |
| AAW-20261021-model-policy | 03-research-assistant-handback.md | 3-research-assistant-to-orchestrator.handback.md |
| AAW-20261021-model-policy | 04-agent-manager-handback.md | 1.l1-agent-manager-to-orchestrator.handback.md |
| AAW-20261021-model-policy | 05-brutal-critique-handback.md | 2.l1-brutal-critique-to-orchestrator.handback.md |
| AAW-20261021-model-policy | 06-agent-manager-handback.md | 1.l2-agent-manager-to-orchestrator.handback.md |
| AAW-20261021-model-policy | 07-brutal-critique-handback.md | 2.l2-brutal-critique-to-orchestrator.handback.md |

As the brief asked, I left the wrong `branch:` and the missing research-assistant row in model-policy (`run.md`) alone; both are in project_handoff-gaps.md. Text inside the hand-backs that still names old files (for example "05-brutal-critique-handback.md") is left as written, because hand-backs are stored verbatim.

Could not do: delete my scratch scripts in `e:\Projects\personal\ai-dlc-agent-workflow-plugin\.scratch\handoff-naming\` — the `rm` was denied. The folder is gitignored, so it is harmless.

Intent: Every hand-off in every lifecycle, AAW included, now produces a step-coded handoff record and a hand-back in a `{LIFECYCLE}-{YYYYMMDD}-{feature-slug}` run folder, written by whoever the orchestration mode names (orchestrator in subagent mode, teammates in a Claude Code agent team) and verified by the receiver; this adds the agent-team mode, applies O2/O3/O4/O6/O7/O8, corrects the claims about subagent nesting, migrates the three old runs and records the deferred gaps.

Checks:
- `node tools/build-copilot.mjs` → `Copilot plugin written to plugins\copilot\ai-dlc: 15 agents, 61 skills, 0 hook event(s); 0 file(s) updated, 0 removed.` (the first run updated 19 files)
- `node tools/build-copilot.mjs --check` → `Copilot plugin and generated sources are up to date.` (rc=0)
- `node .ai-dlc/workflow.mjs validate` → `.ai-dlc\workflow.json: valid` (rc=0)
- `node --test` → `tests 134 · pass 134 · fail 0`
- `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/ai-dlc` → `✔ Validation passed`
- `npx @anthropic-ai/claude-code plugin validate --strict .` → `✔ Validation passed`
- A grep of plugins/, tools/, AGENTS.md, README.md, docs/plugins.md, CLAUDE.md and .github for the old naming and the old "cannot spawn" claims (`<NN>`, `<work-item-id>`, `docs/handoffs/<work-item>`, `sequential agent team`, `subagents cannot spawn`, `writes no handoff`, `no handoff records`) finds no matches.

Next hop: orchestrator re-runs the checks → brutal-critique (all paths above are docs; there are no code paths).
