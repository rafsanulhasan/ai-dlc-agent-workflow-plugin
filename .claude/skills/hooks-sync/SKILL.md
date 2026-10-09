---
name: hooks-sync
description: Detects and resolves drift between Claude Code hooks (.claude/hooks/*.ps1 + .claude/settings.json) and GitHub Copilot hooks (.github/hooks/*.ps1 + .github/hooks/*.json). Ensures semantic parity across both hook surfaces. Invoked exclusively by the agent-manager agent.
---

# Hooks Sync

Use this skill when hook definitions on Claude Code and GitHub Copilot have drifted apart, when a hook was added to one platform but not the other, or when a full hook inventory audit is needed. Parse the args to determine the operation mode, then execute the corresponding procedure.

---

## Phase 0 — Context Load (silent)

1. Read `.claude/CLAUDE.md` and `AGENTS.md` to internalize project conventions and portability rules.
2. Invoke `Skill("manage-memory", args: "agent-manager")` to load persistent memory (prior sync decisions, known hook names, settings.json structure).
3. Read `.claude/settings.json` to understand currently registered Claude Code hooks.
4. Glob `.claude/hooks/*.ps1` and `.github/hooks/*.ps1` and `.github/hooks/*.json` to build the current hook inventory.

---

## Mode: audit

**Args:** `audit`

Inventory all hooks on both platforms and flag semantic drift.

1. Read `.claude/settings.json` — extract the `hooks` array; for each entry record: event type, script path, matcher pattern (if any).
2. Glob `.claude/hooks/*.ps1` — list all Claude hook script files.
3. Glob `.github/hooks/*.ps1` — list all Copilot hook script files.
4. Glob `.github/hooks/*.json` — list all Copilot hook metadata files.
5. Normalise hook names from filenames (strip `.ps1` / `.json` extensions).
6. Build a cross-reference map keyed on hook name.
7. Classify each entry:
   - **present-both** — hook script and metadata exist on both platforms, and hook is registered in `settings.json`
   - **claude-only** — `.claude/hooks/<name>.ps1` is registered in `settings.json` but no `.github/hooks/<name>.ps1` or `.github/hooks/<name>.json`
   - **copilot-only** — `.github/hooks/<name>.ps1` + `.github/hooks/<name>.json` exist but no `.claude/hooks/<name>.ps1` registration
   - **unregistered** — `.claude/hooks/<name>.ps1` exists but is not referenced in `settings.json`
   - **drifted** — both platforms have the hook but script content or metadata differs semantically
8. Output a structured audit report:

```
## Hook Drift Report

| Hook | Claude script | settings.json | Copilot script | Copilot metadata | Status | Drift |
|------|---------------|--------------|----------------|-----------------|--------|-------|
| <name> | ✅ | ✅ | ✅ | ✅ | in sync | — |
| <name> | ✅ | ✅ | ❌ | ❌ | — | missing on Copilot |
| <name> | ✅ | ❌ | — | — | — | unregistered |
```

9. Summarise counts: total hooks, fully in sync, drifted, orphans, unregistered.

---

## Mode: sync

**Args:** `sync <name>`

Sync a named hook from Claude → Copilot (or vice versa when Copilot is ahead).

**Claude → Copilot (default direction when Claude hook exists):**

1. Read `.claude/hooks/<name>.ps1`; fail with a clear error if it does not exist.
2. Read `.claude/settings.json` — find the hook entry matching `<name>` to extract event type and any matcher.
3. Write `.github/hooks/<name>.ps1` with the same script content.
4. Write `.github/hooks/<name>.json` with the hook metadata:
   ```json
   {
     "name": "<name>",
     "event": "<event-type-from-settings>",
     "script": "<name>.ps1",
     "description": "<infer from script comments or hook name>"
   }
   ```
5. Confirm: "Hook `<name>` synced to `.github/hooks/`."

**Copilot → Claude (when only Copilot hook exists):**

1. Read `.github/hooks/<name>.ps1` and `.github/hooks/<name>.json`.
2. Write `.claude/hooks/<name>.ps1` with the same script content.
3. Read `.claude/settings.json`; add the hook entry under the appropriate event type.
4. Write updated `.claude/settings.json`.
5. Confirm: "Hook `<name>` synced to `.claude/hooks/` and registered in `settings.json`."

---

## Mode: sync-all

**Args:** `sync-all`

Sync all hooks detected in the Claude registry and Copilot hook directories.

1. Read `.claude/settings.json` — collect all registered hook names.
2. Glob `.github/hooks/*.json` — collect all Copilot hook names.
3. Union the two sets.
4. For each hook name, execute **Mode: sync** in sequence.
5. Produce a summary: hooks synced, any errors encountered.

---

## Mode: diff

**Args:** `diff <name>`

Show a structured diff for one hook name across platforms.

1. Read `.claude/hooks/<name>.ps1`; note if missing.
2. Read `.claude/settings.json` — extract the registration entry for `<name>`; note if not registered.
3. Read `.github/hooks/<name>.ps1`; note if missing.
4. Read `.github/hooks/<name>.json`; note if missing.
5. Compare:
   - Script content: identical / differs (show line-count diff if different)
   - Event type: `settings.json` event vs `<name>.json` `event` field
   - Registration: registered in `settings.json` / not registered
6. Output:

```
## Hook Diff: <name>

| Property | Claude | Copilot |
|----------|--------|---------|
| Script exists | ✅ / ❌ | ✅ / ❌ |
| Script identical | — | ✅ / ❌ |
| Event type | <val> | <val> |
| Registered | ✅ / ❌ | ✅ / ❌ |
```

7. Conclude with: **In sync** / **Drifted — run `sync <name>` to resolve**.

---

## Validation Rules

- Every `.claude/hooks/<name>.ps1` must have a matching entry in `.claude/settings.json`.
- Every `.github/hooks/<name>.ps1` must have a matching `.github/hooks/<name>.json`.
- Hook names must be kebab-case and identical across both platforms.
- Never delete any hook file — use deprecation patterns when retiring.
- Never read or modify `.env` files or sensitive configuration.
