---
name: skill-management
description: Creates, updates, and lists skill files (.claude/skills/*/SKILL.md) and (.github/skills/*/SKILL.md) for the AI-DLC multi-agent system. Invoked exclusively by the agent-manager agent.
---

# Skill Management

> **Scope.** This skill manages *project-scope* artifacts in a consumer repository (`.claude/` and `.github/` twins). To change the shared `ai-dlc` plugin itself, edit `plugins/claude/ai-dlc/` in the plugin repository and run `node tools/build-copilot.mjs` — see **Boris Cherny** (`agent-manager`)'s *Two Scopes of Ownership*.

> Agent names are the defaults; a name chosen at `/ai-dlc:init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

You scaffold and maintain all skill files. Parse the args to determine the operation mode, then execute the corresponding procedure.

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
   c. `.github/skills/<name>.agent.md` already exists
2. Ask for: model (default sonnet), tools list, one-line description, primary operation modes
3. Create Directories: 
   a. `.claude/skills/<name>/` directory via Bash: `mkdir -p .claude/skills/<name>`
   b. `.github/skills/<name>/` directory via Bash: `mkdir -p .github/skills/<name>`
4. Write `.claude/skills/<name>/SKILL.md` using the Skill File Template below
   a. Write to the `.claude/skills/<name>/SKILL.md` file with the same content for Claude Code discoverability. 
   b. Write to the `.github/skills/<name>/SKILL.md` file with the same content for Copilot/VS Code discoverability
5. Write `.claude/commands/<name>.md` using the Command File Template below
6. Confirm: "Skill '<name>' created. Remember to add it to the relevant agent's Skills section via `update-agent`."

### Skill File Template

```markdown
---
name: <name>
description: <one-line description>
---

[Skill description — what it does and when it's invoked]

---

## Phase 0 — Context Load (silent)

1. Read `.claude/CLAUDE.md` and `AGENTS.md`
2. Invoke `Skill("ai-dlc:manage-memory", args: "<owning-agent-name>")` to load persistent memory
3. Read relevant source files identified from memory or task input

---

## Phase 1 — [Main Phase Name]

[Describe the main work phase]

---

## Phase N — Output

[Describe the final artifact or action this skill produces]
```

## Mode: update-skill

**Args:** `update-skill <name> <change-description>`

1. Read files; fail if it does not exist
   a. `.claude/skills/<name>/SKILL.md`
   b. `.github/skills/<name>/SKILL.md`
2. Read `.claude/commands/<name>.md`
3. Parse `<change-description>` to determine what to change
4. Apply the change using Edit on the relevant file(s)
5. Validate that Phase 0 still loads CLAUDE.md and calls `manage-memory`
6. Validate that the frontmatter still contains: `name`, `description`
7. Confirm: "Skill '<name>' updated."

---

## Validation Rules

- Agent files must have frontmatter: `name`, `description`
- Skill files must have frontmatter: `name`, `description`
- All skill files must have a Phase 0 that reads CLAUDE.md and calls `manage-memory`
- Command files (.claude/commands/*.md) must always pair with a skill file in .claude/skills/
