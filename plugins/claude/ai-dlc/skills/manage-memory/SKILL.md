---
name: manage-memory
description: Manages persistent file-based memory for all agents in .claude/agent-memory/<agent-name>/. Supports load, save, refresh, prune, and audit. All agents call this directly for load/save; prune/audit/refresh are routed through skill-manager.
---

# Manage Memory Skill

You manage all persistent memory for agents in the project. Memory is stored in `.claude/agent-memory/<agent-name>/`. Parse the args to determine the operation.

> Agent names are the defaults; a name chosen at `/ai-dlc:init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

---

## Load — args: `<agent-name>`

Retrieve all memories for the named agent.

1. Check for `.claude/agent-memory/<agent-name>/MEMORY.md`
2. If it exists, read the index to get all memory file pointers
3. Read each referenced memory file
4. Run the Staleness Check (see below) on all entries
5. Return all memory content as structured context for the calling agent. If a `persona-name` memory exists, return it first and state that the calling agent adopts that name in place of its default `Persona name`.

If no MEMORY.md exists: respond "No prior memories for <agent-name>."

---

## Save — args: multi-line block

```
save <agent-name>
type: <user|feedback|project|reference>
name: <memory-name>
description: <one-line description for the index>

<memory content body>
```

1. Parse agent name, type, name, description, and content from args
2. Derive filename: `<type>_<kebab-case-name>.md` (e.g., `feedback_response-style.md`)
3. Write `.claude/agent-memory/<agent-name>/<filename>.md` using the Memory File Format below
4. Read `.claude/agent-memory/<agent-name>/MEMORY.md` (or initialize an empty index)
5. Check for an existing entry matching this memory name — update rather than duplicate
6. Write the updated MEMORY.md
7. Confirm: "Saved '<name>' to <agent-name>'s memory."

---

## Refresh — args: `refresh <agent-name>`

Force-reload the memory index and all files, then re-run staleness checks.

1. Re-read `.claude/agent-memory/<agent-name>/MEMORY.md`
2. Re-read every referenced memory file
3. Run the Staleness Check on all entries
4. Flag any stale entries to the caller
5. Return the refreshed memory context

---

## Prune — args: `prune <agent-name>`

Remove stale or duplicate memory entries with confirmation.

1. Load all memory files for the agent
2. Identify stale entries: those referencing non-existent file paths (Glob), functions, or flags (Grep)
3. Identify duplicates: same topic covered by multiple files
4. Present a list of candidates with reasons; ask for confirmation before any deletion
5. On confirmation: delete approved files and remove their entries from MEMORY.md
6. Confirm: "Pruned N entries from <agent-name>'s memory."

---

## Audit — args: `audit`

Survey memory health across all agents.

1. Glob `.claude/agent-memory/*/MEMORY.md`
2. For each agent, count entries and note the index file size
3. Return a summary table: agent → entry count → index line count → staleness risk
4. Flag any agent whose MEMORY.md exceeds 150 lines (approaching the 200-line truncation limit)

---

## Memory File Format

```markdown
---
name: <memory name>
description: <one-line description — specific enough to judge relevance in future conversations>
type: <user|feedback|project|reference>
---

<content body>
```

**feedback** and **project** entries must include:
- The rule or fact on the lead line
- **Why:** the reason (past incident, constraint, user preference)
- **How to apply:** when/where this guidance kicks in

---

## MEMORY.md Format (index only — no frontmatter)

```markdown
# Memory Index

- [Title](filename.md) — one-line hook under 150 characters
```

One line per entry. Never write memory content directly in MEMORY.md.
Lines after 200 are truncated — keep the index concise.

---

## Memory Types

| Type | Stores | Save when |
|------|--------|-----------|
| **user** | Role, goals, expertise, preferences | You learn who the user is |
| **feedback** | Corrections AND validated approaches | User corrects ("don't X") or confirms ("yes, exactly") |
| **project** | Work, decisions, constraints, deadlines | You learn project context (convert relative dates to absolute YYYY-MM-DD) |
| **reference** | Pointers to external systems | You learn about tools, dashboards, trackers, channels |

**Persona name.** `user_persona-name.md` (name `persona-name`) holds the name the developer gave an agent; the full roster is **Scott Hanselman** (`orchestrator`)'s `project_team-roster.md`. Renames happen only through `/ai-dlc:init` or **Boris Cherny** (`agent-manager`), which update both files together — an agent never renames itself.

---

## What NOT to Save

- Code patterns, conventions, architecture — derivable from the codebase
- Git history — `git log` is authoritative
- Bug fixes or debugging recipes — the fix is in the code
- Anything documented in CLAUDE.md files
- Ephemeral task state or current conversation context

If asked to save any of the above, ask what was *surprising or non-obvious* about it — save that instead.

---

## Staleness Check (on load and refresh)

For every memory entry that names a specific file, function, flag, or external resource:
- File paths: Glob to verify existence
- Function or flag names: Grep to verify
- Flag stale entries to the calling agent before returning memory context

Current codebase state always overrides memory.
