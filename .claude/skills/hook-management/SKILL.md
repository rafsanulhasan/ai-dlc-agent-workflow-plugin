---
name: hook-management
description: Create, modify, and delete Claude Code hooks and GitHub Copilot hook integrations safely using a discovery-first, non-destructive workflow.
---

# Hook Management

Use this skill when a user asks to create, update, migrate, or remove hook behavior for either Claude Code or GitHub Copilot in this repository.

This skill is implementation-agnostic but actionable. It always discovers actual hook files and references first, then applies minimal, reversible changes.

---

## Inputs Expected

- Operation: `create` | `modify` | `delete`
- Platform target: `claude` | `copilot` | `both`
- Hook scope: repository-wide, agent-specific, skill-specific, or command-specific
- Hook name and intent: what the hook should do
- Trigger/event conditions: when it should run
- Safety constraints: destructive actions allowed or not, confirmation requirements
- Validation constraints: expected outputs, pass/fail signals, and rollback policy

If any required input is missing, ask only the minimum clarifying questions needed to proceed safely.

---

## Phase 0 - Context Load (silent)

1. Read `.claude/CLAUDE.md` and `AGENTS.md`.
2. Invoke `Skill("manage-memory", args: "agent-manager")`.
3. Read repository governance files relevant to skill and command ownership.
4. Discover current hook surfaces and references before proposing edits.

---

## Phase 1 - Discovery And Classification

1. Detect existing Claude hook assets:
   - `.claude/hooks/**`
   - `.claude/settings.json`
   - Any hook script references from Claude command/agent files
2. Detect existing Copilot hook assets (format may vary by repo):
   - `.github/hooks/**`
   - Any files that reference hook scripts, pre/post actions, or enforcement callbacks
3. Build a hook inventory table:
   - platform
   - file path
   - trigger/event
   - linked script/config
   - ownership and dependency notes
4. Classify request into one mutation strategy:
   - create new hook
   - modify existing hook
   - delete/deprecate hook
   - migrate/duplicate behavior across platforms

Decision rule:
- If target hook is not discoverable and operation is `modify` or `delete`, pause and ask for disambiguation instead of guessing.

---

## Phase 2 - Plan The Change

1. Map requested behavior to one or both platforms.
2. Choose smallest safe edit set:
   - script/body changes
   - config wiring changes
   - command/prompt/instruction reference changes
3. Identify impact radius:
   - direct dependents
   - potential execution side effects
   - test/validation path
4. For `delete`, require an explicit safety plan:
   - backup path or reversible rename
   - confirmation checkpoint before permanent removal

Branch logic:

- `scope = claude`
  - Edit only Claude hook files and references.
- `scope = copilot`
  - Edit only Copilot hook integration files and references.
- `scope = both`
  - Keep semantic parity; document intentional differences.

- `operation = create`
  - Add hook implementation + registration/wiring + docs note.
- `operation = modify`
  - Patch in place with minimal diff; preserve unrelated behavior.
- `operation = delete`
  - Prefer soft-delete first (disable/unwire + backup) unless hard delete is explicitly approved.

---

## Phase 3 - Execute Create/Modify/Delete

### A. Create

1. Create or extend the hook implementation file in discovered platform convention paths.
2. Register hook in the relevant platform config/reference files.
3. Add brief inline comments only where logic is non-obvious.
4. Ensure cross-platform naming consistency if `scope = both`.

### B. Modify

1. Patch only required logic and references.
2. Keep input/output contracts stable unless explicitly requested.
3. Preserve existing guardrails (error handling, loop prevention, safety checks).

### C. Delete

1. Backup target hook content to a reversible location or branch-safe file before removal.
2. Remove registration/wiring first, then implementation.
3. Remove or update stale references.
4. If permanent delete was not explicitly approved, leave a reversible deprecation marker.

---

## Phase 4 - Safety And Validation

Validation checklist:

- [ ] Discovery evidence captured (what existed before changes)
- [ ] Correct platform scope honored (`claude`, `copilot`, or `both`)
- [ ] No unrelated files modified
- [ ] Hook wiring references resolve to valid files
- [ ] Delete path is reversible unless explicit hard-delete approval exists
- [ ] Behavior parity documented when targeting both platforms
- [ ] Governance rules respected (agent-manager owns skill/command artifacts)

Completion criteria:

1. Requested operation is fully implemented for the declared scope.
2. Hook configuration and implementation are consistent.
3. Risks and any assumptions are reported explicitly.
4. User receives a concise delta summary and suggested next checks.

---

## Ambiguity And Weak-Spot Detection

Before finalizing, surface the most important unresolved points:

1. Copilot hook substrate ambiguity:
   - Whether this repo treats prompts/instructions/agents as hook surfaces or uses separate script hooks.
2. Delete semantics ambiguity:
   - Whether deletion means disable, deprecate, or permanently remove files.
3. Execution contract ambiguity:
   - Expected input/output schema and fail-open vs fail-closed behavior for each platform.

When these are unresolved, return targeted clarification questions with one recommended default.

---

## Example Invocations

- `Skill("hook-management", args: "create claude pre-stop hook to enforce dotnet test before finish")`
- `Skill("hook-management", args: "modify copilot hook to add repository quality-gate reminder")`
- `Skill("hook-management", args: "delete both hook named enforce-tests using soft-delete with backup")`
- `Skill("hook-management", args: "migrate claude hook behavior to copilot and keep event semantics aligned")`
