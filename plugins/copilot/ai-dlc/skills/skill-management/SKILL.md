---
name: skill-management
description: Creates, updates, syncs, and lists skill files (.claude/skills/*/SKILL.md) and (.github/skills/*/SKILL.md) for the AI-DLC multi-agent system, and holds the writing guide and review checklist for any agent-facing document (skills, agent bodies, rules, AGENTS.md, CLAUDE.md). Invoked exclusively by the agent-manager agent.
---

# Skill Management

> **Scope.** This skill manages *project-scope* artifacts in a consumer repository (`.claude/` and `.github/` twins). To change the shared `ai-dlc` plugin itself, edit `plugins/claude/ai-dlc/` in the plugin repository and run `node tools/build-copilot.mjs` — see **Boris Cherny** (`agent-manager`)'s *Two Scopes of Ownership*.

> Agent names are the defaults; a name chosen at `/init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

You scaffold and maintain all skill files. Parse the args to determine the operation mode, then execute the corresponding procedure.

Every skill you write or change is read by an agent, not a person. Write and review it with [references/writing-for-agents.md](references/writing-for-agents.md): how descriptions trigger a skill, what stays in `SKILL.md` versus `references/`, completion criteria for steps, the invocation choice, and the pruning rules. The same guide applies when `agent-manager` edits an agent body, a rule, `AGENTS.md` or `CLAUDE.md`.

---

## Mode: list

**Args:** `list`

1. Glob `.claude/skills/*/SKILL.md` — collect skill names and descriptions
2. Glob `.github/skills/*/SKILL.md` — collect skill names and descriptions
3. Return a formatted summary table: skills 

## Mode: create-skill

**Args:** `create-skill <name>`

1. Validate `<name>` is kebab-case; fail if 
   a. `.claude/skills/<name>/SKILL.md` already exists
   b. `.claude/commands/<name>.md` already exists
   c. `.github/skills/<name>/SKILL.md` already exists
2. Ask for: tools list, primary operation modes, the trigger situations (branches) that should fire the skill, and whether it is model-invoked or user-only (`disable-model-invocation: true`) — see *Invocation choice* in [references/writing-for-agents.md](references/writing-for-agents.md). Write the `description` from these: lead with the trigger word, one phrase per branch for a model-invoked skill; a one-line human summary for a user-only skill.
   Do not ask for a model. A skill normally omits `model` and runs on the session's model. Set `model` only when the skill truly needs a different one, and then use an alias (rule in `agent-management`, *Mode: create-agent*). The field works only in Claude Code: it applies while the skill is active, for the rest of that turn, and other harnesses reject it when the skill is packaged.
3. Write `.claude/skills/<name>/SKILL.md` using the Skill File Template below. Link files with paths relative to `SKILL.md`, not `${CLAUDE_SKILL_DIR}`, which Copilot does not expand.
4. If some branches need material the others do not (long templates, examples, per-case rules), put it in `references/<topic>.md` beside `SKILL.md` and link it from the step that needs it.
5. Run the **Review checklist** in [references/writing-for-agents.md](references/writing-for-agents.md) on the new `SKILL.md`; fix every unchecked item.
6. Copy the skill to `.github/skills/<name>/` as in **Mode: sync-skill**. Skills are slash-invocable on both platforms, so a command / prompt file is needed only when the developer asks for one; create it through `command-management`.
7. Confirm: "Skill '<name>' created. Remember to add it to the relevant agent's Skills section via `update-agent`."

### Skill File Template

```markdown
---
name: <name>
description: <one-line description>
---

[Skill description — what it does and when it's invoked]

---

## Phase 0 — Context Load (silent)

1. Read the root `CLAUDE.md` and `AGENTS.md`
2. Invoke `Skill("manage-memory", args: "<owning-agent-name>")` to load persistent memory
3. Read relevant source files identified from memory or task input

---

## Phase 1 — [Main Phase Name]

[Ordered steps. End each step on a checkable completion criterion, e.g. "every caller listed", not "understand the code".]

---

## Phase N — Output

[Describe the final artifact or action this skill produces]
```

## Mode: update-skill

**Args:** `update-skill <name> <change-description>`

1. Read `.claude/skills/<name>/SKILL.md`; fail if it does not exist. If only `.github/skills/<name>/SKILL.md` exists, run **Mode: sync-skill** first.
2. Read `.claude/commands/<name>.md` if it exists.
3. Parse `<change-description>` to determine what to change
4. Apply the change using Edit on the Claude copy, including any `references/` files. Replace or remove what the change supersedes rather than appending beside it, so each meaning keeps a single source.
5. Validate that Phase 0 still loads CLAUDE.md and calls `manage-memory`
6. Validate that the frontmatter still contains: `name`, `description`, and that `description` still names every trigger the skill now handles
7. Run the **Review checklist** in [references/writing-for-agents.md](references/writing-for-agents.md) on the changed sections
8. Copy the change to Copilot as in **Mode: sync-skill**, with `--prefer claude`.
9. Confirm: "Skill '<name>' updated."

## Mode: sync-skill

**Args:** `sync-skill <name>`

Use when a skill exists on one platform only, or its files differ between `.claude/skills/<name>/` and `.github/skills/<name>/`, in either direction.

1. Run `Skill("harness-sync", args: "sync --only skills --name <name>")`, adding `--prefer claude|copilot` when the caller named the authoritative side. Files are copied one by one; the side edited last wins otherwise.
2. Done when `node .claude/scripts/sync-harness.mjs --check --only skills --name <name>` exits 0.

---

## Validation Rules

- Agent files must have frontmatter: `name`, `description`
- Skill files must have frontmatter: `name`, `description`
- All skill files must have a Phase 0 that reads CLAUDE.md and calls `manage-memory`
- A command file (`.claude/commands/<name>.md`) that calls a skill must name one that exists in `.claude/skills/`
- Every link from `SKILL.md` to a `references/` file must resolve, on both platforms

Adapted in part from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT).
