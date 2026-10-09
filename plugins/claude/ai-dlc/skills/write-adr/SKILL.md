---
name: write-adr
description: Writes a numbered Architecture Decision Record (ADR) for a significant architectural choice in the project. Invoked by the software-architect agent whenever a consequential design decision is made or ratified. Saves the ADR to docs/architecture/decisions/.
---

# Write ADR

You are executing the `write-adr` skill on behalf of **Mark Richards** (`software-architect`). Your job is to produce a well-formed, numbered Architecture Decision Record and persist it to the repository.

> Agent names are the defaults; a name chosen at `/ai-dlc:init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## Input

The calling agent will pass:
- **Decision title** — a short phrase naming the decision (e.g. "Use Result<T> for all service return types")
- **Context and decision** — a summary of what was decided and why (may come from an `architecture-design` output or a post-implementation `architecture-review`)
- Optionally: specific files, components, or requirements that motivated the decision

## Process

### Step 1 — Discover Existing ADRs

1. Use **Glob** to list all files matching `docs/architecture/decisions/ADR-*.md`
2. Find the highest existing ADR number; the new ADR number = highest + 1 (start at `ADR-0001` if none exist)
3. Use **Read** on the two most recent ADRs (if any) to absorb the established tone and any cross-references

### Step 2 — Ground the Decision in the Codebase

Use **Grep** and **Read** to locate the concrete artifacts this decision affects:
- Files, classes, or interfaces that implement or will implement the decision
- Existing usages of the pattern being decided on (or the pattern being superseded)
- Any related ADRs that this decision builds on or contradicts (mark those as Superseded in Step 4 if needed)

### Step 3 — Draft the ADR

Produce the record using this structure:

---

# ADR-{NNNN}: {Title}

**Date**: {YYYY-MM-DD}
**Status**: Accepted
**Deciders**: software-architect

## Context

What situation, requirement, or constraint forced this decision? Describe the problem space in 3–6 sentences. Reference specific project constraints where relevant (e.g. middleware pipeline, `{ data, error }` return shape, DI-only instantiation, async disposal).

## Decision

State the decision in one clear sentence beginning with "We will…".

Then explain the chosen approach with enough detail that a new engineer understands what to do and why. Include:
- The specific pattern, component structure, or constraint being adopted
- How it integrates with the existing middleware / DI / filter architecture
- Any naming conventions or file placement rules it implies

## Alternatives Considered

For each rejected option:
- **Option**: Name of the alternative
- **Why rejected**: One or two sentences — be specific, not vague

## Consequences

### Positive
- Bullet list of concrete benefits

### Negative / Trade-offs
- Bullet list of known costs or constraints introduced

### Neutral
- Bullet list of things that change but are neither good nor bad (migration steps, tooling changes, etc.)

## Compliance Checklist

- [ ] All affected components identified and listed above
- [ ] Related ADRs cross-referenced (or "None" if first)
- [ ] Return shape `{ data, error }` preserved where applicable
- [ ] No stack traces exposed
- [ ] DI registration approach specified (if new components introduced)
- [ ] Superseded ADRs updated with `**Status**: Superseded by ADR-{NNNN}`

---

### Step 4 — Update Superseded ADRs

If this decision supersedes an existing one:
1. **Read** the superseded ADR file
2. Change its `**Status**` line to `**Status**: Superseded by ADR-{NNNN}`
3. **Write** the updated file back

### Step 5 — Save the ADR

1. Ensure the directory `docs/architecture/decisions/` exists (create it via Write if absent)
2. Write the file as `docs/architecture/decisions/ADR-{NNNN}-{kebab-case-title}.md`
3. Report the saved path and ADR number to the calling agent

## Output

Return:
- The full ADR text
- The saved file path (e.g. `docs/architecture/decisions/ADR-0003-use-result-t-for-service-returns.md`)
- A one-line summary: **ADR-{NNNN}** recorded: {title}
