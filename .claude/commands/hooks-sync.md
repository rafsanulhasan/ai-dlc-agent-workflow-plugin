---
description: Detects and resolves drift between Claude Code hooks (.claude/hooks/*.ps1 + .claude/settings.json) and GitHub Copilot hooks (.github/hooks/*.ps1 + .github/hooks/*.json). Ensures semantic parity across both hook surfaces.
---

Audits the full hook inventory for platform drift and applies corrective syncs, keeping `.claude/settings.json` registrations, Claude hook scripts, and Copilot hook scripts/metadata in semantic parity.

## Usage

- `Skill("hooks-sync", args: "audit")` — inventory all hooks on both platforms, flag semantic drift
- `Skill("hooks-sync", args: "sync <name>")` — sync a named hook from Claude → Copilot (or vice versa)
- `Skill("hooks-sync", args: "sync-all")` — sync all hooks
- `Skill("hooks-sync", args: "diff <name>")` — show structured diff for one hook name across platforms

## Expected Workflow

1. Phase 0: load CLAUDE.md, AGENTS.md, `settings.json`, and persistent memory via `manage-memory`.
2. Glob all hook scripts and metadata files to build the inventory.
3. For `audit`: cross-reference all hooks, classify drift, emit report with unregistered hook warnings.
4. For `sync <name>`: read Claude hook and `settings.json` entry, write Copilot `.ps1` and `.json` metadata (or reverse direction).
5. For `sync-all`: iterate all hooks from both registries, sync each, summarise results.
6. For `diff <name>`: compare script content, event types, and registration status, output structured diff table.

## Safety Defaults

- No hook file is ever deleted.
- `settings.json` modifications are additive only unless explicitly removing a hook.
- Sync direction defaults to Claude → Copilot when both exist and are equal; uses the more recently modified file when they differ.
