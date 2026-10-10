---
name: architecture-review
description: Structured architectural review skill for the project. Use when reviewing implemented code for architectural integrity, design flaws, convention compliance, and long-term risk, or when asked to scan a codebase or area for architectural improvement — finding shallow modules, leaky seams and other deepening opportunities and ranking them. Invoked by the software-architect agent after implementation is complete, or on request for an improvement scan.
---

# Architecture Review

You are executing the `architecture-review` skill on behalf of **Mark Richards** (`software-architect`). Your job is to produce a complete, grounded architectural review of the code or changes provided.

> Agent names are the defaults; a name chosen at `/ai-dlc:init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## Input

The calling agent will pass one of:
- A description of recently implemented or modified code
- A list of changed files or a diff to review
- A specific architectural concern to investigate
- A request to scan the codebase, or a named area of it, for architectural improvements

## Modes

- **Change review** (the first three inputs): a gate on what was just built. Follow Steps 1–5.
- **Deepening scan** (the last input): a search for refactors that turn shallow modules into deep ones. Follow the Deepening Scan section instead.

Both modes use the depth vocabulary in [../system-design/references/deep-modules.md](../system-design/references/deep-modules.md) — **module**, **interface**, **depth**, **seam**, **adapter**, **leverage**, **locality** — and the project glossary's domain terms. Talk about "the Order intake module", not "the OrderHandler class" or "the order service".

## Process

### Step 1 — Scope the Review

Focus on what changed, not the entire codebase. Use **Glob** and **Read** to locate changed files, then **Grep** to trace how new components are wired into the existing system. Read the ADRs in `docs/architecture/decisions/` that touch the changed area; do not re-litigate a recorded decision unless the change exposes real friction with it.

### Step 2 — Apply the Review Framework

Evaluate each dimension systematically:

1. **Separation of Concerns** — Are responsibilities cleanly divided? Does each component have a single, well-defined purpose?
2. **Coupling and Cohesion** — Is the design loosely coupled and highly cohesive? Are dependencies flowing in the right direction?
3. **Module Depth** — Did the change add shallow modules (interface nearly as complex as the implementation)? Apply the deletion test to new layers and wrappers. Does any new abstraction sit at a seam with only one adapter? Do modules leak details across their seams?
4. **Extensibility** — Can the system accommodate foreseeable changes without major restructuring?
5. **Reliability** — Are there single points of failure? Is error handling sound? Does the `{ data, error }` return shape propagate correctly through all paths?
6. **Security Boundaries** — Are sensitive operations properly isolated? Are there information leakage risks in the API surface?
7. **Testability** — Is the architecture designed to support unit, integration, and mutation testing (the stack's mutation tool, e.g. Stryker.NET or StrykerJS)? Do tests exercise modules through their interfaces, or reach past them into internals?
8. **Scalability** — Only flag when realistic load increases would degrade this design.

### Step 3 — Check Convention Compliance

Verify adherence to project conventions (the stack's coding rules that `dotnet-rules` or `node-rules` installed under `.claude/rules/` are authoritative):
- C# / .NET: explicit type declarations with target-typed new expressions or collection expressions; async disposal preferred over sync disposal (`await using`)
- JS / TS: the module, typing and async conventions in the installed `node-rules`
- Return shape is always `{ data, error }`
- No stack traces exposed to clients
- Logger module used, not console output
- DI-registered services — no hidden `new` for dependencies

### Step 4 — Produce the Review

Structure your output as:

---

**Verdict**: `APPROVED` / `APPROVED WITH CONCERNS` / `REQUIRES REVISION`

**Design Flaws** *(if any)*
List issues that have architectural impact — not just code style. For each:
- Severity: `CRITICAL` (blocks design) / `MAJOR` (significant risk) / `MINOR` (improvement opportunity)
- Description: What the flaw is and why it matters structurally
- Location: Specific file, class, or method

**Recommended Improvements**
Concrete, actionable changes with rationale. Never vague — e.g., not "consider better abstractions" but "extract X responsibility into a dedicated Y service because Z".

**Scalability / Reliability Concerns** *(only if applicable at realistic scale)*

**Convention Compliance**
List any violations. If compliant, state "All project conventions followed."

**Positive Observations**
What was done well architecturally. Always include at least one — this builds institutional knowledge.

---

### Step 5 — Finalize

Before returning:
- Every flaw must have a concrete recommended improvement
- Severity labels must be applied consistently — CRITICAL only when the design cannot proceed as-is
- If verdict is REQUIRES REVISION, the recommended improvements must be sufficient to resolve all CRITICAL and MAJOR flaws

## Deepening Scan

Goal: find where the architecture causes friction and propose **deepening opportunities** — refactors that merge shallow modules into deep ones so the code is easier to change, test and navigate.

### 1. Decide where to look

Deepening pays off where the code keeps changing, so scope before you scan (YAGNI):

- If the caller named an area, module or pain point, scan that.
- Otherwise find the hot spots: read a long stretch of commit history (`git log --oneline`, `git log --stat`) and note the files and directories that keep changing. Start there. Widen the net only if changes are scattered with no clear hot spot.

Read the project glossary and the ADRs for that area first.

### 2. Explore for friction

Walk the code and note where it fights you, rather than applying a fixed checklist. Signals:

- Understanding one concept means bouncing between many small modules.
- A module's interface is nearly as complex as its implementation.
- Pure functions were extracted for testability, but the real bugs live in how they are wired together (no locality).
- Tightly coupled modules leak details across their seams.
- An abstraction has a single adapter and nothing varies across it.
- Code is untested, or hard to test through its current interface.

Apply the deletion test to every suspected pass-through: would deleting it concentrate complexity, or just move it? "Concentrates" is the signal you want. For a large codebase, brief **Jon Skeet** (`research-assistant`) to map the area so you can focus on judgement.

### 3. Present ranked candidates

For each candidate:

- **Files** — the modules involved
- **Problem** — the friction the current shape causes
- **Proposal** — in plain words, what would merge or move (not an interface design yet)
- **Benefits** — in terms of locality, leverage, and how tests would improve
- **Dependencies** — each dependency's category (in-process, local stand-in, remote but owned, truly external), which decides how the deepened module is tested
- **Strength** — `Strong` / `Worth exploring` / `Speculative`

Order candidates by strength, then by how hot the area is. End with a **Top recommendation**: the one to tackle first and why.

If a candidate contradicts an existing ADR, include it only when the friction is real enough to reopen the decision, and say so explicitly: "Contradicts ADR-0007; worth reopening because…". Do not list every refactor an ADR rules out.

Do not design interfaces at this stage. Return the ranked list and ask which candidate to explore.

### 4. Explore the chosen candidate

- Walk the open decisions with the human one question at a time, each with a recommended answer (the interview loop in `requirement-analysis`): constraints, dependencies, the shape of the deepened module, what sits behind the seam, which tests survive.
- Hand interface design to **Zoran Horvat** (`system-engineer`), whose `system-design` skill designs the interface several ways before recommending one ([design-it-twice](../system-design/references/design-it-twice.md)).
- If the deepened module is named after a concept the glossary lacks, or a fuzzy term gets sharpened, add the term to the glossary.
- If the human rejects a candidate for a reason a future reviewer would need to know, offer to record it with `write-adr` so later scans do not suggest it again. Skip temporary reasons ("not now") and self-evident ones.

Adapted in part from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT).
