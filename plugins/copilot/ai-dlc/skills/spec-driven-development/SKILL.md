---
name: spec-driven-development
description: Manages the full lifecycle of a feature specification — from collaborative drafting (after a requirement-analysis session, or by synthesising a spec from requirements already discussed in the conversation, a product brief or an issue without re-interviewing) through agreed test seams and architect/system-engineer review to enforcement during implementation and testing.
---

# Spec-Driven Development Skill

Manages the full lifecycle of a feature specification: collaborative drafting with architect and engineer review, finalization to a persistent spec file, and enforcement handoff to **David Fowler** (`software-engineer`) and **Kent Beck** (`sqa-engineer`). Only **James Montemagno** (`requirement-analyst`) may invoke this skill.

> Agent names are the defaults; a name chosen at `/init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

---

## Phase 0 — Guard

1. Verify the caller is `requirement-analyst`. If not, halt immediately and output:
   > "This skill may only be invoked by the requirement-analyst agent."
2. Read `.claude\CLAUDE.md`
3. Invoke `Skill("manage-memory", args: "requirement-analyst")` to load persistent memory
4. Read relevant source files and any existing specs under `docs/specs/` identified from memory or task input

---

## Phase 1 — Spec Drafting (Collaborative)

1. `requirement-analyst` drafts the initial specification from previously elicited requirements. Pick the drafting mode first:
   - **Elicited** — a `requirement-analysis` session produced a Requirements Document. Draft from it.
   - **Synthesis** — the requirements were already settled elsewhere: in this conversation, a product brief, a backlog item, an issue thread or design notes, and the human asks for the spec. Synthesise the spec from what was agreed plus what the code shows, instead of interviewing the human again. See **Synthesis rules** below.
2. Sketch the **test seams** — the points where the feature's behaviour will be observed by tests. Prefer seams the codebase already has; choose the highest seam that can observe the behaviour (a public API or entry point before an internal class); propose a new seam only when none exists, as high as possible. The fewer seams, the better — one is ideal. Confirm the seams with the human before the review rounds; in synthesis mode this is the only routine question.
3. Consult **Mark Richards** (`software-architect`) to review the draft spec for:
   - Architectural alignment with the existing system
   - Technical feasibility
   - Clear and correct component boundary assignments
4. Consult **Zoran Horvat** (`system-engineer`) to review the draft spec for:
   - Low-level design concerns
   - SOLID, DRY, and YAGNI compliance
   - Data shape conformance — all request/response shapes must use `{ data, error }`
5. Collect all feedback from both reviewers and revise the spec.
6. Repeat consultation rounds until both `software-architect` and `system-engineer` explicitly sign off.

### Synthesis rules

Synthesis turns a discussion that already happened into a spec without making the human repeat it.

- **Source every statement.** Each acceptance criterion, boundary and decision traces to something the human said or approved, or to behaviour visible in the code. Anything you would otherwise have to invent is not a criterion — it goes under **Open Questions**.
- **Capture decisions already made.** Technical clarifications, architectural choices, schema or contract changes and specific interactions settled in the discussion go into the spec as decisions (under Component Boundaries or Data Shapes), not back to the human as questions.
- **Cover every actor and path.** Walk each actor through the feature (happy path, edge cases, errors, permissions) and write an AC for each behaviour the discussion committed to. A thin AC list is the usual failure of synthesis.
- **Ask only to unblock.** Interrupt the human only when a gap stops you writing a testable AC for something they clearly asked for; batch those questions into one round. Everything else stays an Open Question for the review rounds.
- **Use the project's words.** Name things with the domain vocabulary already used in the code, glossary and ADRs; respect ADRs in the area.

### Writing rules (both modes)

- Write behaviour and contracts, not file paths, line numbers or code snippets — they go stale before the feature ships. The exception is a snippet from a prototype that pins a decision more precisely than prose (a state machine, a schema, a type shape); inline it within the relevant section, trimmed to the decision-carrying lines, and note that it came from a prototype.
- Describe tests by external behaviour at the agreed seams, never by implementation details.

---

## Phase 2 — Spec Finalization

1. Derive the `<feature-slug>` from the feature name in kebab-case (e.g., `user-registration`).
2. Write the finalized spec to `docs/specs/<feature-slug>.spec.md`.
3. The spec file MUST include all of the following sections:

   ### Overview
   What the feature does and why it is being built.

   ### Acceptance Criteria
   Numbered, testable criteria. Each AC must be independently verifiable.
   Example format:
   ```
   AC-1: Given X, when Y, then Z.
   AC-2: ...
   ```

   ### Component Boundaries
   Which component, service, or module owns each part of the feature. Describe ownership explicitly — do not leave ambiguity.

   ### Data Shapes
   All request and response data shapes. Every shape must use the `{ data, error }` envelope:
   ```json
   {
     "data": { ... },
     "error": null
   }
   ```

   ### Test Seams
   The agreed seams from Phase 1 step 2: where each group of ACs is observed, which existing tests are prior art, and any new seam with the reason it was needed.

   ### Out of Scope
   Explicit list of things that will NOT be addressed by this feature. Required — cannot be omitted.

   ### Open Questions
   Any unresolved questions that remain after the review cycle. May be empty if none remain, but the section must be present.

4. Validate the written file is readable and well-formed before proceeding.

---

## Phase 3 — Enforcement Handoff

Output the following summary block. `software-engineer` and `sqa-engineer` MUST reference this before beginning any work:

```
--- SPEC ENFORCEMENT HANDOFF ---

Spec file: docs/specs/<feature-slug>.spec.md

Acceptance Criteria IDs:
  AC-1, AC-2, ... (list all IDs from the finalized spec)

IMPORTANT: All implementation and tests must trace to an AC in this spec.
Do not implement anything not covered by the spec.
Any deviation from the spec requires re-invoking `spec-driven-development`
to update the spec first — do not diverge silently.

--- END HANDOFF ---
```

---

## Adherence Rules (for software-engineer and sqa-engineer)

These rules are enforced by the handoff block and must be followed by downstream agents:

- **Before writing any code**, `software-engineer` must read the spec at `docs/specs/<feature-slug>.spec.md`.
- Every implemented behavior must map to a numbered AC. If an AC has no corresponding implementation, flag it explicitly.
- **Before writing any test**, `sqa-engineer` must read the spec and trace each test case to an AC ID in the test's comments or description, observing behaviour at the seams listed under **Test Seams**.
- Any deviation from the spec — whether discovered during implementation or testing — requires re-invoking `spec-driven-development` to update the spec first. Silent divergence is not permitted.

Adapted in part from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT).
