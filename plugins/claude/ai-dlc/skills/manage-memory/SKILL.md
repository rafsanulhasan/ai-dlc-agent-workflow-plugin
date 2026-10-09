---
name: manage-memory
description: Manages persistent file-based memory for all agents in .claude/agent-memory/<agent-name>/. Supports load, save, refresh, prune, audit, and compress (shrink a memory or instruction file that loads every session, to save input tokens, keeping a readable backup). All agents call this directly for load/save; prune/audit/refresh are routed through skill-manager.
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
4. Flag any agent whose MEMORY.md exceeds 150 lines (approaching the 200-line truncation limit); suggest `prune` first, then `compress` for what remains

---

## Compress — args: `compress <path>`

Rewrite a memory or instruction file that is loaded into context every session in a terse register, so each session pays fewer input tokens. The prose shrinks; every fact, rule and piece of code stays exactly as it was. A readable backup is kept and remains the copy humans edit.

**Targets:** agent memory files and `MEMORY.md`, `CLAUDE.md`, `AGENTS.md`, and rule or instruction files (`.claude/rules/*.md`, `.github/instructions/*.instructions.md`). Rule and instruction files, agent definitions and skills are agent artifacts: compressing one is a change routed through **Boris Cherny** (`agent-manager`), which compresses both platform twins together. Documents written for people — specs, ADRs, READMEs, handoff records — are not targets.

### 1. Check eligibility

Refuse, naming the reason, when the file is:

- not natural-language prose: anything other than `.md`, `.mdc`, `.txt`, `.rst` or an extensionless prose file — source code, scripts, and data or config formats (`.json`, `.yaml`, `.yml`, `.toml`, `.xml`, lock files) are never compressed;
- likely to hold secrets: `.env*`, `.netrc`, a name containing `secret`, `credential`, `password`, `token` or `apikey`, key and certificate files (`*.pem`, `*.key`, `*.pfx`, `id_rsa`), or anything under `.ssh/`, `.aws/`, `.gnupg/` or `.kube/`;
- a backup (`*.original.*`) or a generated file (for example `plugins/copilot/**`, or init's generated `AGENTS.md` template).

Done when the file is accepted, or refused with its reason.

### 2. Back up

Copy the file unchanged to `.claude/compress-backups/<path from the repository root, with .original before the extension>` — `CLAUDE.md` becomes `.claude/compress-backups/CLAUDE.original.md`. Never put the backup beside the source: rule and skill folders load every Markdown file they find, so a sibling backup would be read twice, and one in a memory folder invites a duplicate index entry. Keep the backup under version control with the compressed file so the readable text travels with it.

If a backup already exists, it is the source of truth: the human edits the backup and re-runs `compress`, which compresses from the backup, never from already-compressed text.

Done when the backup has been re-read and matches the source byte for byte.

### 3. Compress the prose

Copy these **exactly**, byte for byte:

- frontmatter, headings (text and level), and the labels this skill's formats rely on (`**Why:**`, `**How to apply:**`, index link syntax `[Title](file.md)`, `[[name]]` links);
- fenced and indented code blocks, including their comments and spacing, and inline code;
- commands, file paths, URLs, environment variables, identifiers, library and API names, version numbers, dates and every other number;
- quoted error messages and anything between `<!-- no-compress -->` and `<!-- /no-compress -->`.

Rewrite the remaining prose at the `full` level of `Skill("ai-dlc:terse-output")`: drop articles where the sentence still reads in one pass, filler, hedging, pleasantries and "you should" / "make sure to"; use short words; merge bullets that say the same thing; keep one example where several show the same pattern. Keep every negation, condition and rule word (*must, never, always, only, unless*) — in a rule file they are the rule. Keep list nesting, numbering and table structure; compress cell text only. When unsure whether a span is code or prose, leave it unchanged.

Done when every prose paragraph has been rewritten or deliberately left as is.

### 4. Validate before writing

Compare the compressed text with the backup:

- [ ] frontmatter identical; same headings, same text, same order
- [ ] same number of code blocks, each byte-identical; every inline code span, URL and path still present
- [ ] every negation and rule word from the original still present in the same statement
- [ ] lists and tables keep their structure; a `MEMORY.md` index keeps one entry per line, each under 150 characters

On a failure, restore only the failing spans from the backup — do not recompress the whole file — and validate again. After two failed repairs, stop, leave the original file untouched and report what failed.

### 5. Write and report

Overwrite the source path with the validated text (both twins when `agent-manager` compresses a rule or instruction pair). Report: the path, the backup path, the size before and after in words and characters, and the checks that passed.

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

Adapted in part from [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) (Apache-2.0); modified.
