---
name: agent-sync
description: Detects and resolves platform drift between .claude/agents/*.md (Claude Code) and .github/agents/*.agent.md (Copilot/VS Code). Produces a drift report and applies corrective edits. Invoked exclusively by the agent-manager agent.
---

# Agent Sync

Use this skill when agent definitions on Claude Code and GitHub Copilot/VS Code have drifted apart, when a new agent was added to one platform but not the other, or when a full roster audit is needed. Parse the args to determine the operation mode, then execute the corresponding procedure.

---

## Phase 0 — Context Load (silent)

1. Read `.claude/CLAUDE.md` and `AGENTS.md` to internalize project conventions, portability rules, and the tool exclusion list.
2. Invoke `Skill("manage-memory", args: "agent-manager")` to load persistent memory (prior sync decisions, known exclusions, naming conventions).
3. Glob `.claude/agents/*.md` and `.github/agents/*.agent.md` to build the current agent roster index.

---

## Mode: audit

**Args:** `audit`

Scan all agents on both platforms and produce a drift report.

1. Glob `.claude/agents/*.md` — for each file, read frontmatter and extract: `name`, `model`, `tools`, `description` (first 120 chars), `status`.
2. Glob `.github/agents/*.agent.md` — for each file, read frontmatter and extract: `name`, `tools`, `status`.
3. Build a cross-reference map keyed on agent `name`.
4. Classify each entry:
   - **present-both** — exists in both `.claude/agents/` and `.github/agents/`
   - **claude-only** — exists in `.claude/agents/` but has no matching `.github/agents/<name>.agent.md`
   - **copilot-only** — exists in `.github/agents/` but has no matching `.claude/agents/<name>.md`
   - **drifted** — exists on both platforms but `tools:`, `description`, or `status` differ
5. For each **drifted** agent, enumerate the specific field-level differences:
   - Tools present in Claude but missing from Copilot (excluding the Claude-only tool exclusion list — those are expected to be absent)
   - Tools present in Copilot but not sourced from Claude
   - Description mismatch (first 120 chars differ)
   - `status` field mismatch
6. Output a structured drift report:

```
## Agent Drift Report

| Agent | Claude | Copilot | Status | Drift |
|-------|--------|---------|--------|-------|
| <name> | ✅ | ✅ | active | tools differ |
| <name> | ✅ | ❌ | — | missing on Copilot |
| <name> | ❌ | ✅ | — | missing on Claude |
```

7. Summarise counts: total agents, fully in sync, drifted, orphans.

---

## Mode: sync

**Args:** `sync <name>`

Sync a single named agent from the Claude definition → Copilot, applying all tool exclusion rules.

1. Read `.claude/agents/<name>.md`; fail with a clear error if it does not exist.
2. Read `.github/agents/<name>.agent.md` if it exists (to preserve any Copilot-specific additions not in Claude).
3. Extract from the Claude frontmatter: `name`, `description`, `tools`, `model`, `color`, `status`, any extra fields.
4. Apply the **Claude-only Tool Exclusion List** to the `tools:` array:
   - Remove: `Bash`, `Glob`, `Grep`, `Read`, `TodoWrite`, `WebFetch`, `WebSearch`, `PushNotification`, `ToolSearch`
   - Translate retained Claude tools to Copilot-native equivalents:
     - `Read` → `read` (if not already excluded)
     - `Edit` / `Write` → `edit`
     - `Glob` / `Grep` → `search`
     - `Bash` → `execute`
     - `TodoWrite` → `todo`
     - `Agent` → `agent`
   - Preserve MCP tools verbatim (names containing `mcp__` or mapping to an MCP server)
5. Copy the body (non-frontmatter content) verbatim from the Claude file.
6. Write `.github/agents/<name>.agent.md` with the translated frontmatter and copied body.
7. Confirm: "Agent `<name>` synced to `.github/agents/<name>.agent.md`."

---

## Mode: sync-all

**Args:** `sync-all`

Run `sync <name>` for every agent currently in the Claude roster.

1. Glob `.claude/agents/*.md` — collect all agent names.
2. Filter out agents with `status: deprecated` in frontmatter (skip deprecated agents, report them separately).
3. For each remaining agent name, execute **Mode: sync** in sequence.
4. Produce a summary: agents synced, agents skipped (deprecated), any errors encountered.

---

## Mode: diff

**Args:** `diff <name>`

Show a structured diff between the Claude and Copilot versions of a single agent.

1. Read `.claude/agents/<name>.md`; fail if it does not exist.
2. Read `.github/agents/<name>.agent.md`; fail if it does not exist.
3. Compare frontmatter field by field:
   - `name` — must be identical
   - `description` — show first 120 chars of each; flag if different
   - `tools` — list tools in Claude but not Copilot, tools in Copilot but not Claude (ignoring expected exclusions)
   - `model` — show both values
   - `status` — show both values
4. Compare body sections: identify headings present in one file but absent from the other.
5. Output:

```
## Agent Diff: <name>

### Frontmatter
| Field | Claude | Copilot |
|-------|--------|---------|
| name | <val> | <val> |
| description | <first 120 chars> | <first 120 chars> |
| tools (extra in Claude) | Bash, Glob | (excluded — expected) |
| tools (extra in Copilot) | execute | (translated from Bash — ok) |
| model | <val> | <val> |
| status | <val> | <val> |

### Body Sections
| Section heading | Claude | Copilot |
|-----------------|--------|---------|
| ## Responsibilities | ✅ | ✅ |
| ## Skills | ✅ | ❌ |
```

6. Conclude with: **In sync** / **Drifted — run `sync <name>` to resolve**.

---

## Validation Rules

- The Claude-only Tool Exclusion List is always applied during sync — never copy `Bash`, `Glob`, `Grep`, `Read`, `TodoWrite`, `WebFetch`, `WebSearch`, `PushNotification`, or `ToolSearch` to `.github/agents/`.
- Agent names must be kebab-case and identical on both platforms.
- Never delete any agent file — `sync-all` only creates or overwrites the Copilot counterpart.
- Deprecated agents are skipped during `sync-all` but reported.
- Never read or modify `.env` files or sensitive configuration.
