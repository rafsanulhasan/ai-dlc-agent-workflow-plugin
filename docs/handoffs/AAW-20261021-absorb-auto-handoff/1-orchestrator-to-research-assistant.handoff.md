---
run: AAW-20261021-absorb-auto-handoff
work-item: WI-2
lifecycle: AAW
step: 1
from: orchestrator
to: research-assistant
mode: subagent
loop: none
gate: none
verification: pending
date: 2026-10-21
---

# 1 orchestrator → research-assistant: can auto-handoff be absorbed into ai-dlc, and can either mod be ported to Copilot?

## Goal
Before agent-manager changes anything, find out:
- whether the vendored auto-handoff mod can live inside the `ai-dlc` plugin;
- whether either mod can be rebuilt on Copilot hooks.

## Artifacts
- `plugins/claude-mods/auto-handoff/`:
  - `.claude-plugin/plugin.json`, with userConfig at :42-47
  - `hooks/hooks.json` → `register.tsx`, and `hooks/config.ts`
  - `statusline/handoff-link.sh`, the viewer `server.ts`, templates, and `tests/`
  - `VENDORED.md`: modified from upstream (:19-33)
  - `register.tsx:11-13`: the mod is for interactive terminal sessions only
- `plugins/claude-mods/cache-keepalive/`: `hooks/hooks.json` → `register.ts`, and `hooks/register.test.ts`.
- `plugins/claude/ai-dlc/.claude-plugin/plugin.json:25-28`: `dependencies`.
- `tools/build-copilot.mjs`: reads only `plugins/claude`, and projects only a listed set of manifest fields (:131-142).
- `plugins/claude/ai-dlc/skills/handoff/SKILL.md:280-309`: the manual session handoff.
- `.github/workflows/validate.yml:15-28`: CI.
- `README.md:71-80`: "needs Claude Code 2.1.287+" and "GitHub Copilot has no mods".

## Acceptance criteria covered
| AC | Where |
|---|---|
| AC-1 (d) Can one Claude Code plugin ship agents, skills and a mod hooks module (`hooks/hooks.json` → `.tsx`) together? Cover the constraints: `plugin validate --strict`; `plugin test` (layout, and where tests live); how the mod's `userConfig` sits in a plugin manifest; and what happens on Claude Code older than the mods minimum — is the mod ignored, or does the whole plugin fail to load? Cite the official docs (code.claude.com/docs/en/plugins, plugins/mods/*) | report |
| AC-2 (a) Does Claude Code auto-install and auto-enable a plugin's `dependencies`? Can a user disable one while the parent plugin stays enabled? | report |
| AC-3 (b) Copilot hooks (CLI and VS Code agent mode): list the events and what each can do — block a tool call, inject context, act on stop or idle, timers, clear or restart the session, read token usage. Give a go / no-go with the reason for each port: an auto-handoff equivalent (threshold → brief → clear → seed) and a cache-keepalive equivalent (periodic ping while idle) | report |
| AC-4 (c) Do agent-team teammates appear in `background_tasks` on `classic.Stop` for cache-keepalive? If this is not documented, mark it Inconclusive | report |
| AC-5 If the moved mod's code sits inside `ai-dlc`, would it reach the Copilot build or `--check` unless excluded? Cite `tools/build-copilot.mjs` lines | report |

## Gate evidence
n/a (research)

## Decisions so far
- auto-handoff is absorbed into ai-dlc and merged with the `handoff` skill (decided by the human, 2026-10-21).
- cache-keepalive stays a vendored mod and a dependency.
- Both stay Claude-only. A Copilot port happens only if Copilot hooks can support it.

## Clarifications carried forward
none

## Open questions / risks for the receiver
- The mods platform is new. Mark any claim the docs do not state explicitly as Inconclusive.

## Suggested skills
- `research`: source selection and the cited report

## Instructions for the receiver
Report only; write nothing. Use the *research* compressed contract:
- Line 1: the verification line for this record.
- Then one finding per line, `<claim> — <source> (<version>)`, grouped by AC.
- End with a go / no-go line for AC-1 and one for AC-3.

Next hop: the orchestrator briefs agent-manager for the absorb change.
