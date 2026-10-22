---
run: AAW-20261022-flagged-followups
lifecycle: AAW
step: 1
from: orchestrator
to: agent-manager
mode: subagent
loop: none
---

# Brief: flagged follow-ups F17, F18, F11, F13

Evidence: step 0 hand-backs in this folder; flagged list docs/handoffs/AAW-20261022-auto-handoff-chain/flagged.md (don't edit it; the orchestrator keeps it). Host types: .scratch/window-observability/tc/claude-code.d.ts (2.1.306).

F17 (code, human decision: re-check each turn). Today a kill switch (`enabled: false` or `DISABLE_AUTO_COMPACT`) writes `fired:<session>=skipped-pane` permanently (plugins/claude/ai-dlc/hooks/auto-handoff/register.tsx ~:632-637, paneVar ~:667-672). Make it re-evaluated on each check: while a switch is on, skip (log once per session per state change, not every turn); once it is off again, the session can hand off as normal. Keep `canHandOff` (tool gate) consistent. Update the docs that describe kill switches (handoff SKILL.md automatic path, README auto-handoff section, configure-auto-handoff SKILL.md if it mentions them). Tests: switch on → no handoff; switched off later in the same session → handoff fires; log not repeated every turn. Record in ATTRIBUTION.md.

F18 (docs). plugins/claude/ai-dlc/skills/handoff/SKILL.md ~:290 claims Claude Code 2.1.287 or later and "interactive sessions only". Changelog (https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md) 2.1.287 "Added Claude Mods" supports the version; the "interactive sessions only" part has no source — check the module (main/lead session only, agentId skip; any non-interactive guard?) and reword to what the code does. No runtime version gate unless trivial; if you add one, use `$.session.version()` `base` (d.ts :2907-2922), unknown → don't block.

F11 (docs). README.md:36 and docs/plugins.md:94 say agents follow the newest model in each family. Per https://code.claude.com/docs/en/model-config aliases "point to the recommended version for your provider and update over time" (Anthropic API: Opus/Sonnet/Haiku 5.5; Bedrock/Vertex sonnet → Sonnet 4.5; Foundry opus → Opus 4.6). Qualify both: per provider; pin with ANTHROPIC_DEFAULT_OPUS_MODEL / _SONNET_ / _HAIKU_ (documented, https://code.claude.com/docs/en/env-vars). Note: another run will later add Copilot model/effort to the same README section — keep your edit to these sentences.

F13 (docs). Fix markdownlint warnings in README.md (MD060 table spacing, MD012 double blank line ~:99) if a linter is available (`npx markdownlint-cli2 README.md`); otherwise fix by inspection. No content change.

Checks: `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc`, `node tools/build-copilot.mjs` then `--check`, `node --test "tests/**/*.test.mjs"`, both `plugin validate --strict`. Don't commit. Another agent-manager edits skills/workflow/ in parallel — don't touch it.

Hand-back: first line `handoff 1-orchestrator-to-agent-manager.handoff.md: passed|failed — <why>`; changed paths marked code/docs; intent; real check output.
