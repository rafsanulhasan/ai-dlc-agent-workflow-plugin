---
run: AAW-20261022-auto-handoff-chain
work-item: none
lifecycle: AAW
step: 1
from: orchestrator
to: research-assistant
mode: subagent
loop: none
gate: none
verification: pending
date: 2026-10-22
---

# 1 orchestrator → research-assistant: how can a Claude Code hooks module (mod) rename a session?

## Goal
The ai-dlc auto-handoff hooks module must rename the old session to `[ai-dlc:auto-handoff]: <name> (Session 1)` just before it runs `/clear`, and the new (seeded) session to `… (Session N)`. We need to know the supported way to do that from a mod, and how to read the current session's name, before agent-manager implements it.

## Artifacts
- `plugins/claude/ai-dlc/hooks/auto-handoff/register.tsx` — the module; uses `$.command.run({ command: 'clear' })` (~line 321) and `$.prompt.submit({ text })` (~line 708); types from `import type { EngineInterface, Register } from 'claude-code'`.
- `plugins/claude/ai-dlc/hooks/auto-handoff/tsconfig.json` — extends `../../.claude-plugin/types/tsconfig.json` (gitignored, absent).
- Local evidence: transcripts under `~/.claude/projects/*/*.jsonl` carry `{"type":"custom-title","customTitle":…}` lines written by `/rename`, and `"type":"ai-title"` lines.
- Precedent: cache-keepalive mod tests call `command.run({ command: 'keepalive', args: '2h' })` (`~/.claude/plugins/cache/ai-dlc-agent-workflow/cache-keepalive/*/hooks/register.test.ts`).

## Open questions / risks for the receiver
Answer each with a cited source (docs URL, type definition path:line, or skill path:line) and a confidence:
1. Can a mod run a built-in slash command such as `/rename <name>` via `$.command.run({ command: 'rename', args })`? Does it act on the current session, and does it work after/around `/clear` (i.e. on the new session from a `SessionStart` source `clear` handler)?
2. Is there any engine API for setting the session title directly (e.g. `$.session.setTitle`, `$.session.rename`, or similar)? Where are the `EngineInterface` types published (npm `claude-code` package? `claude plugin` scaffolding?), and what does `EngineInterface['command']` / `['session']` declare?
3. How does a mod read the current session's name: a `$.session` getter, or only the transcript's last `custom-title` / `ai-title` line?
4. Does `/rename` exist in Claude Code ≥ 2.1.287 under that name, and does it accept the name as its argument?

## Suggested skills
- `research` — structured, cited findings.
- `plugin-authoring` — Claude Code's own skill for writing mods and hooks modules; likely documents the `$` engine API.

## Instructions for the receiver
Read-only. Return line 1 as `handoff 1-orchestrator-to-research-assistant.handoff.md: passed|failed — <why>`, then a compressed findings report: per question, the answer, source path:line or URL, confidence. End with a recommendation: the exact call(s) the module should make to rename the current session and to read its name, or "not possible" with the closest alternative.
