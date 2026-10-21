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

1. Read the root `CLAUDE.md` to internalize project conventions and portability rules.
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
   - `model` — an alias, never a pinned id: `haiku`, `sonnet` or `opus`. `fable` is also valid, but it costs more than `opus`, so use it only when the human explicitly asks for it. Pick the alias with the first rule that matches:
     1. `opus` if the agent authors one of the source artifacts that every later stage builds on: the routing plan, specs and ADRs, stories and acceptance criteria, agent definitions. The list is closed: task plans and work breakdowns are not on it and fall under rule 3. How far its errors spread decides this, not how often it is spawned.
     2. `haiku` if its output is checked by a human gate, another agent or a mechanical check such as a test run, **and** its work is lookup, reading and reporting, or mechanical editing, with no judgement that later stages rely on. A finding, a verdict or a review is judgement, so reviewing and critiquing are never `haiku`.
     3. `sonnet` otherwise: implementation, tests, reviews, critiques, low-level design, documentation, CI/CD, task plans and work breakdowns, and scope and priority decisions.

     This gives the current team: `opus` for `orchestrator`, `agent-manager`, `software-architect` and `requirement-analyst`; `haiku` for `research-assistant` and `presentation-manager`; `sonnet` for the rest. Two results are deliberate, so do not "correct" them: `product-owner` is `sonnet`, not `opus`, because the human approves its decisions at the gates; `presentation-manager` is `haiku` although building a deck is more than mechanical editing, and no other agent checks it: it works on a copy and renders each changed slide for its own visual QA, and the human reviews the deck.

     A caller may override the model for a single spawn; see *Model per spawn* in `agent-invocation`.
   - `color` — default `cyan`
   - `tools` — default `Read, Glob, Grep, Skill, TodoWrite`
   - One-line purpose describing the agent's domain
   - 2–4 bullet responsibilities
4. Write `.claude/agents/<name>.md` using the **Claude Agent Template** below.
5. Generate the Copilot twin `.github/agents/<name>.agent.md` as in **Mode: sync-agent**. Done when that mode's check passes for `<name>`.
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

### Memory Index Template

```markdown
# Memory Index

```

---

## Mode: update-agent

**Args:** `update-agent <name> <change-description>`

1. Validate that both `.claude/agents/<name>.md` and `.github/agents/<name>.agent.md` exist; warn on missing platform file.
2. Parse `<change-description>` to determine what to change (frontmatter field, responsibilities, skills section, protocols, etc.).
3. Apply changes to `.claude/agents/<name>.md` using Edit. A change to a Copilot-only key (`user-invocable`, `handoffs`, `target`, …) goes to `.github/agents/<name>.agent.md` directly.
4. Bring the Copilot twin in step as in **Mode: sync-agent**, with `--prefer claude`.
5. Validate Claude agent frontmatter still contains: `name`, `description`, `tools`, `model`; `model` is an alias (`haiku`, `sonnet`, `opus` or `fable`), never a pinned id.
6. Check that the `description` still names every situation the agent now handles and that the change replaced superseded text instead of adding beside it (see **Writing the definition**).
7. Confirm: "Agent '<name>' updated on both platforms."

---

## Mode: sync-agent

**Args:** `sync-agent <name>`

Use when one platform's file is missing or the two have drifted, in either direction.

1. Run `Skill("harness-sync", args: "sync --only agents --name <name>")`, adding `--prefer claude` or `--prefer copilot` when the caller named the authoritative side. It installs `.claude/scripts/sync-harness.mjs` if missing. The twin gets the same body; only `name`, `description`, `tools` and `status` are synced, and platform-only keys stay.
2. Resolve each `note:` it prints for this agent (a tool with no counterpart: keep it on its own platform, or replace it with one that has a counterpart).
3. Confirm: "Agent '<name>' synced." Done when `node .claude/scripts/sync-harness.mjs --check --only agents --name <name>` exits 0.

### Tool translation (Claude ↔ Copilot)

The same table as the plugin build (`tools/build-copilot.mjs`) and `sync-harness.mjs`:

| Claude Code | Copilot |
|---|---|
| `Read`, `NotebookRead` | `read` |
| `Edit`, `Write`, `MultiEdit`, `NotebookEdit` | `edit` |
| `Glob`, `Grep` | `search` |
| `Bash`, `PowerShell` | `execute` |
| `TodoWrite` | `todo` |
| `Agent`, `Task` | `agent` |
| `WebFetch`, `WebSearch` | `web` |
| `mcp__*` | kept as written |

Claude tools with no Copilot counterpart (`Skill`, `AskUserQuestion`, `SendMessage`, `ToolSearch`, `PushNotification`, `Task*`, `Cron*`, `Monitor`, plan-mode and worktree tools, `mcp__ide__*`) stay on the Claude side only. Copilot-only tools (`githubRepo`, VS Code tool sets, …) stay on the Copilot side only. An agent with no `tools` inherits every tool on both platforms; `disallowedTools` maps to the Copilot aliases it leaves.

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
- Claude agent files (`.claude/agents/*.md`) must have: `name`, `description`, `tools`, `model`; `model` is an alias (`haiku`, `sonnet`, `opus` or `fable`), never a pinned id.
- Copilot agent files (`.github/agents/*.agent.md`) must have: `name`, `description`; `tools` only when the agent does not inherit every tool.
- Copilot agent `tools:` hold Copilot names only (the right-hand column of **Tool translation**, `mcp__*`, or Copilot-only tools), never Claude names such as `Read` or `Bash`.
- Every Claude agent must have a matching Copilot agent of the same name: `node .claude/scripts/sync-harness.mjs --check --only agents` exits 0.
- Agent names must be kebab-case and match across both platform files.
- Never read or modify `.env` files or sensitive configuration.

Adapted in part from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT).
