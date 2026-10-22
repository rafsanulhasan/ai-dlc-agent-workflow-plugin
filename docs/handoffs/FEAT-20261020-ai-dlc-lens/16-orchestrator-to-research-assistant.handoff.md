---
run: FEAT-20261020-ai-dlc-lens
work-item: ITEM-027
lifecycle: AI-DLC
step: 16
from: orchestrator
to: research-assistant
mode: subagent
loop: none
gate: none
verification: passed
date: 2026-10-23
---

# 16 orchestrator → research-assistant: can the Claude Code mods API build the reworked 027 lens card?

## Goal
Before agent-manager reworks spike 027 (step 17), establish what the Claude Code mods / hooks-module API can and cannot do for the human's new card design. Each answer is cited (API docs, the engine type definitions, or spike code with path:line) or marked **needs a spike** with the smallest experiment that would settle it. Read-only: write nothing.

## The human's binding design (2026-10-23, `15-claude-lens-gap-analysis.md` §Human decisions 2)
- Orchestrator transcript: how it thought and gathered context; **thinking collapsible**, **gathered context collapsible**.
- Workflow at the top: flowchart of the orchestrator spawning agents (e.g. several research-assistants), an **avatar** per agent.
- Under each avatar: `Agent Name (model)` e.g. `Agent Manager (opus/opus-5.5)`; role e.g. `agent-manager`; context used / model window e.g. `100K/1M`; input / output tokens; cache reads / writes / misses.
- **Click an arrow** → a separate panel with that handoff record and hand-back, plus that hand-off's input / output tokens.
- **Click an avatar** → a separate panel with that agent's background tasks and tool calls.
- Still binding (stories US-12, US-15): subagent and teammate responses are never hidden; two-way arrow for a loop; running agents blink green, finished ones green without blinking.

## Questions (answer each)
1. Can a mod read the main agent's **thinking blocks** and **tool calls / tool results** (the "gathered context") as they stream, and render them as **collapsible** sections inside a transcript card or a pane? Which render site (transcript card, pane, other)?
2. Can **Svg elements** (an arrow path, an avatar group) carry a click handler, or must clicks go through Button/other widgets? If not, what is the closest clickable layout (e.g. buttons overlaid or listed under the chart)?
3. Can a mod open a **second / separate pane or panel** on demand (from a click), or replace the content of one pane (drill-in with a back control)? Limits on the number of panes?
4. Per subagent: where do **model ID**, **context window size**, **context used**, **input / output tokens**, **cache read / cache write** counts come from (events, transcript JSONL `usage` fields, session state)? Is a **cache miss** a real figure or derived (e.g. input tokens not read from cache)? Is the model's window (200K vs 1M) available, or must it come from a table?
5. Are tokens attributable **per spawn (handoff)** and **per tool call**?
6. Are **background tasks** (background Bash, background agents) visible to a mod, with status?
7. Can the card read a **handoff record / hand-back file** from `docs/handoffs/<run>/` (file read permission in a mod), and match a spawn to its step code?

## Artifacts to read
- `spikes/ai-dlc-lens/027/hooks/register.tsx`, `027/types/index.d.ts`, `027/tests/spike.test.tsx`, `027/CHECK.md` — what spike 027 already does.
- `spikes/ai-dlc-lens/README.md` — how the spikes are installed and checked.
- `docs/handoffs/FEAT-20261020-ai-dlc-lens/12.1-agent-manager-to-orchestrator.handback.md`, `3.2-…`, `4.2-…`, `4.3-research-assistant-to-orchestrator.handback.md` — earlier mods-API research (render sites, events, shared state, transcripts). Do not redo what they settled; cite them.
- The engine types: `types/claude-code.d.ts` from the `plugin-authoring` skill bundled with the installed Claude Code build (see README line 54), and the Claude Code mods docs.
- `plugins/claude/ai-dlc/hooks/auto-handoff/` and `hooks/keepalive/` — working mods in this repo that read session usage (cite only).

## Return format (compact)
Line 1: `handoff 16-orchestrator-to-research-assistant.handoff.md: passed|failed — <why>`. Then a table `| # | Question | Answer: yes / no / partial / needs a spike | How (API name, event, field) | Fallback if no | Source path:line or URL |`. Then a short list: the recommended card layout given the answers, and the experiments step 17 must run. Mark every unverified claim.

## Next
Step 17: agent-manager reworks spike 027 from this report. Loop limits for the spike: 2 rounds / 1 failure (`rounds --json`).
