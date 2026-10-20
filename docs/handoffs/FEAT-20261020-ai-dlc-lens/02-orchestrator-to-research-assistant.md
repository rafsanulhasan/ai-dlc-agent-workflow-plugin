---
work-item: FEAT-20261020-ai-dlc-lens
lifecycle: AI-DLC
from: orchestrator
to: research-assistant
gate: none
verification: passed
date: 2026-10-20
---

# orchestrator → research-assistant: WI-0, four technical questions to answer before the spec

## Artifacts
- `docs/handoffs/FEAT-20261020-ai-dlc-lens/00-approved-plan.md` — approved plan; see "Build vs buy" → "Open technical questions"
- `docs/handoffs/FEAT-20261020-ai-dlc-lens/run.md` — run state

## Acceptance criteria covered
| AC | Where it is satisfied / tested |
|---|---|
| AC-1 each question gets a yes / no / partly answer with a cited source (doc URL, version, or `path:line` of a real transcript) | research-assistant reports |
| AC-2 anything that cannot be verified says `Inconclusive: <what is missing>` | research-assistant reports |

## Gate evidence
- Build: n/a · Tests: n/a · Mutation: n/a · Review: n/a
- Gate: none

## Decisions made in this stage
- Research facts gathered on 2026-10-20 that the questions build on:
  - The mod API docs live at `https://code.claude.com/docs/en/plugins/mods/` (pages overview, reference, events, api, interface, create, test, troubleshoot, admin).
  - Session-level `$.session.usage().cost` exists. There is no per-turn or per-agent dollar figure.
  - `turn.step` and `turn.complete` carry `agentId?` and token usage.
  - `agent.spawn` carries `subagentType` and `parentAgentId`.
  - The API is early access. It had breaking changes at 2.1.271, 2.1.283 and 2.1.299–2.1.304.

## Clarifications
none

## Open questions / risks for the receiver
- The GitHub copy of the types, `mods/types/claude-code.d.ts`, dates from about 2.1.277. Prefer the types that `claude --plugin-dir` writes for the installed version, and the current docs.
- Transcripts at `~/.claude/projects/` can be large. Read samples only, and redact any prompt content you quote.

## Suggested skills
- `research` — cited findings, use context7 / official docs first

## Instructions for the receiver
Run as **four parallel research-assistant spawns**, one question each, each read-only.

Reply to each with the *research* contract:
- one finding per line, in the form `<claim> — <source> (<version>)`
- end with the line `Answer: yes | no | partly — <one sentence>`

1. **Agent type in transcripts.** Do Claude Code subagent transcripts record which agent type ran? For example `subagent_type`, an agent name, or the Task/Agent tool input linked to the sidechain file. Check real files under `~/.claude/projects/<project>/` (main `.jsonl` and any subagent files) and the docs. This decides whether a transcript-based per-agent cost report (B′) is possible.
2. **statusLine in VS Code.** Does the Claude Code VS Code extension render a settings `statusLine` command? Which fields does its stdin JSON carry (cost, context, rate limits, model, session id, transcript path)? Give the minimum version.
3. **agentId coverage.** In the mod API, is `agentId` set on `turn.step` / `turn.complete` for every subagent turn? That includes background subagents, subagents resumed with `SendMessage`, and agent-team teammates (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`). Can `agentId` always be joined to `subagentType` through `agent.spawn` or `$.agent.list()`?
4. **`$.process.run` on Windows.** Can a mod's `$.process.run` call `node .ai-dlc/workflow.mjs validate` on Windows 11 without a shell wrapper? What do cwd, PATH resolution and timeouts look like? If the docs are silent, say `Inconclusive`.

Next hop: the orchestrator stores the four hand-backs. They then go to the product-owner (Plan, G1) and the software-architect (spec, G2).
