---
name: agent-management
description: Creates, updates, and deprecates agent definitions for both Claude Code (.claude/agents/*.md) and GitHub Copilot/VS Code (.github/agents/*.agent.md). Invoked exclusively by the agent-manager agent.
---

# agent-management

> **Scope.** This skill manages *project-scope* artifacts in a consumer repository (`.claude/` and `.github/` twins). To change the shared `ai-dlc` plugin itself, edit `plugins/claude/ai-dlc/` in the plugin repository and run `node tools/build-copilot.mjs` — see **Boris Cherny** (`agent-manager`)'s *Two Scopes of Ownership*.

> Agent names are the defaults; a name chosen at `/init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

You scaffold and maintain all agent definitions across both platforms. Parse the args to determine the operation mode, then execute the corresponding procedure.

---

## Phase 0 — Context Load (silent)

1. Read `.claude/CLAUDE.md` to internalize project conventions and portability rules.
2. Invoke `Skill("manage-memory", args: "agent-manager")` to load persistent memory.
3. Glob `.claude/agents/*.md` and `.github/agents/*.agent.md` to build the current agent roster.

---

## Mode: list

**Args:** `list`

1. Glob `.claude/agents/*.md` — collect `name`, `model`, `tools`, and `description` from frontmatter.
2. Glob `.github/agents/*.agent.md` — collect `name` from frontmatter.
3. Cross-reference: identify agents that exist in one platform but not the other (orphans).
4. Return a formatted table with columns: `agent`, `claude-code`, `copilot`, `model`, `status`.

---

## Mode: create-agent

**Args:** `create-agent <name>`

1. Validate `<name>` is kebab-case.
2. Fail if `.claude/agents/<name>.md` already exists.
3. Collect required inputs:
   - `model` — default `claude-sonnet-4-6`
   - `color` — default `cyan`
   - `tools` — default `Read, Glob, Grep, Skill, TodoWrite`
   - One-line purpose describing the agent's domain
   - 2–4 bullet responsibilities
4. Write `.claude/agents/<name>.md` using the **Claude Agent Template** below.
5. Write `.github/agents/<name>.agent.md` using the **Copilot Agent Template** below — apply the **Claude-only Tool Exclusion List** (see Mode: sync-agent) when populating its `tools:` frontmatter.
6. Create `.claude/agent-memory/<name>/` directory:
	a. Windows: `mkdir -p ".claude/agent-memory/<name>"`
	b. Linux/Mac: `mkdir -p ".claude/agent-memory/<name>/"`
7. Write `.claude/agent-memory/<name>/MEMORY.md` using the **Memory Index Template** below.
8. Review the new definition against **Writing the definition** below.
9. Confirm: "Agent '<name>' created in `.claude/agents/` and `.github/agents/`."

### Writing the definition

An agent definition is read by two agents: the one deciding whether to delegate (it sees only the `description`) and the agent itself (it runs the body). Apply [writing-for-agents.md](../skill-management/references/writing-for-agents.md) from `skill-management`, with these agent-specific points:

- **The `description` is the delegation pointer.** Lead with the role's trigger word, name each distinct situation that should route work here once, and let the `<example>` blocks show those situations rather than restate them. Leave responsibilities and protocols to the body.
- **The body holds the agent's standing behaviour only.** Procedures that only some tasks need belong in a skill the body names, with the trigger for invoking it ("Trigger: once acceptance criteria are confirmed"), not inline.
- **Every protocol is checkable.** Write "invoke `manage-memory` before any lifecycle work", not "keep memory in mind".
- **State the target behaviour.** Keep prohibitions to hard guardrails (never delete files, never read `.env`) and pair each with what to do instead.

### Claude Agent Template

```markdown
---
name: "<name>"
description: "<multi-line description with at least one <example> block>"
tools: Read, Glob, Grep, Skill, TodoWrite
model: <model>
color: <color>
memory: project
---

You are the **<Title>** agent for the project.

## Responsibilities

- [Responsibility 1]
- [Responsibility 2]
- [Responsibility 3]

## Skills

### `manage-memory` — invoke at session start and when learning something worth preserving

```
Skill("manage-memory", args: "<name>")            // load
Skill("manage-memory", args: "save <name> ...")   // save
```

Record: [what this agent should remember across sessions]

### `agent-management` — route all agent definition changes through agent-manager

To create or update an agent definition:
```
Agent("agent-manager", prompt: "create-agent <name>")
Agent("agent-manager", prompt: "update-agent <name> <change-description>")
```

## Protocols

- [Protocol 1]
- [Protocol 2]
```

### Copilot Agent Template

```markdown
---
name: "<name>"
description: "<one-line description for Copilot agent picker>"
tools: [read, edit, search, todo]
user-invocable: true
---
You are the <Title> for the project.

## Responsibilities
1. [Responsibility 1]
2. [Responsibility 2]

## Preferred Skills
- `<primary-skill>`
- `manage-memory`
```

### Memory Index Template

```markdown
# Memory Index

```

---

## Mode: update-agent

**Args:** `update-agent <name> <change-description>`

1. Validate that both `.claude/agents/<name>.md` and `.github/agents/<name>.agent.md` exist; warn on missing platform file.
2. Parse `<change-description>` to determine what to change (frontmatter field, responsibilities, skills section, protocols, etc.).
3. Apply changes to `.claude/agents/<name>.md` using Edit.
4. Apply equivalent changes to `.github/agents/<name>.agent.md` using Edit.
5. If the change touches the `tools:` frontmatter, apply the **Claude-only Tool Exclusion List** (see Mode: sync-agent) before writing the Copilot file — never propagate excluded tools.
6. Validate Claude agent frontmatter still contains: `name`, `description`, `tools`, `model`.
7. Validate Copilot agent frontmatter still contains: `name`, `description`, `tools`.
8. Validate Copilot `tools:` array contains none of the excluded Claude-only tool names.
9. Check that the `description` still names every situation the agent now handles and that the change replaced superseded text instead of adding beside it (see **Writing the definition**).
10. Confirm: "Agent '<name>' updated on both platforms."

---

## Mode: sync-agent

**Args:** `sync-agent <name>`

Use when a Claude agent definition exists but the Copilot counterpart is missing or out of date.

1. Read `.claude/agents/<name>.md`.
2. Derive the equivalent `.github/agents/<name>.agent.md` content from it using the **Copilot Agent Template**.
3. **Apply the Claude-only Tool Exclusion List** (see below) when translating the `tools:` frontmatter — strip excluded tools and substitute Copilot-native equivalents where appropriate.
4. Write or overwrite `.github/agents/<name>.agent.md`.
5. Confirm: "Agent '<name>' synced to `.github/agents/<name>.agent.md`."

### Claude-only Tool Exclusion List (sync, create, update)

When projecting the `tools:` array from a Claude agent definition into a Copilot agent file, the following Claude Code-specific built-in tool names MUST be removed. They do not exist in the GitHub Copilot / VS Code custom agent environment, and including them produces an invalid Copilot agent configuration.

**Excluded tools — never copy to `.github/agents/*.agent.md`:**

- `Bash`
- `Glob`
- `Grep`
- `Read`
- `TodoWrite`
- `WebFetch`
- `WebSearch`
- `PushNotification`
- `ToolSearch`

**Tools that are kept or translated:**

- MCP tools (any tool whose name contains `mcp__` or that maps to an MCP server, e.g. `mcp__docker-mcp-gateway__search`, `microsoft_docs_search`) — keep verbatim, they are platform-portable.
- Skill / Agent invocations — keep verbatim.
- Translate Claude built-ins to Copilot-native equivalents where there is a 1:1 match (apply during sync only when the Copilot file currently lacks the equivalent):
   - `Read` → `read`
   - `Edit` / `Write` → `edit`
   - `Glob` / `Grep` → `search`
   - `Bash` → `execute`
   - `TodoWrite` → `todo`
   - `Agent` → `agent`

**Procedure for translating `tools:`:**

1. Read the Claude `tools:` array.
2. For each tool, look it up in the Excluded list — if matched, drop it.
3. For each remaining tool, look it up in the translation map — if matched, substitute the Copilot-native alias.
4. Preserve all MCP and Skill/Agent entries verbatim.
5. Emit the translated array as the Copilot file's `tools:` frontmatter.

---

## Mode: deprecate-agent

**Args:** `deprecate-agent <name> <reason>`

1. Read `.claude/agents/<name>.md`; fail if it does not exist.
2. Add `status: deprecated` and a `deprecated-reason: <reason>` field to the frontmatter of `.claude/agents/<name>.md`.
3. Add `status: deprecated` to the frontmatter of `.github/agents/<name>.agent.md` if it exists.
4. Do not delete any files.
5. Confirm: "Agent '<name>' deprecated on both platforms."

---

## Validation Rules

- Agent files must never be deleted — only deprecated via `status: deprecated` in frontmatter.
- Claude agent files (`.claude/agents/*.md`) must have: `name`, `description`, `tools`, `model`.
- Copilot agent files (`.github/agents/*.agent.md`) must have: `name`, `description`, `tools`.
- Copilot agent `tools:` arrays MUST NOT contain any of the Claude-only excluded tools: `Bash`, `Glob`, `Grep`, `Read`, `TodoWrite`, `WebFetch`, `WebSearch`, `PushNotification`, `ToolSearch`. Reject the write if any are present.
- Every Claude agent must have a matching Copilot agent of the same name — warn when they are out of sync.
- Agent names must be kebab-case and match across both platform files.
- Never read or modify `.env` files or sensitive configuration.

Adapted in part from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT).
