---
name: architecture-narrative
description: Turn an architecture solution into a story stakeholders can follow — business problem first, then constraints and trade-offs, then the proposed design, ADRs and risks. Use when presenting, documenting or reviewing an architecture for product owners, business stakeholders or review boards, or when someone says "they don't get my diagrams".
---

# Architecture Narrative

An architecture narrative tells the story of an architecture solution from beginning to end, instead of opening with a diagram. It borrows the **narrative arc** and **three-act structure** from storytelling so the audience travels the same path the architect did: the problem, the obstacles, and only then the solution.

Source: Mark Richards, *Software Architecture Monday*, Lesson 224 — "Creating an Architecture Narrative" (https://youtu.be/YgOhcG6bgtA). Watch the lesson for the original diagrams of the arc and the three acts.

## Why this exists

The failure mode this skill prevents: the architect opens with a dense component diagram, business stakeholders can't map it to anything they care about, and the conversation collapses.

Diagrams are one part of describing a solution, not the whole of it. The fix is not a simpler diagram; it is putting the diagram at the *end* of a story the audience has already followed.

## The narrative arc

Great stories rise in tension over time: introduction and exposition, rising complication, climax, then resolution.

## What goes into an architecture solution

A complete solution is more than diagrams. Collect all of these before writing:

| Component | What it is |
|---|---|
| Business problem | The problem being solved, why the business is doing it, who's involved |
| Driving characteristics | The architecture characteristics ("-ilities") the system must support, tied to business needs |
| Constraints | Business (time, cost) and technical (mandated frameworks, services, third-party systems) limits |
| Unique challenges | What makes *this* problem hard, beyond the usual |
| Alternatives | Other options seriously considered |
| Trade-offs | What was given up to get what was chosen |
| Architecture decisions | ADRs — context and justification for each decision |
| Architecture diagrams | The views that illustrate the final design |

Having all of these is not the same as telling a compelling story. Order matters.

## Map the components onto the arc

Lay the components along the arc in the order the architect actually encountered them:

- **Introduction & exposition** → business problem
- **Complication** (rising tension) → constraints, driving characteristics, unique challenges, alternatives, trade-offs
- **Resolution** → architecture decisions and diagrams

Most architects start where the story should end. Diagrams and ADRs belong after the conflict, because the conflict is what produced them.

## The three-act structure

Overlay three acts on the arc. This is the outline of every narrative this skill produces.

### Act 1 — Setup (introduction & exposition)

Answer: **what business problem are we trying to solve?**

- **What** is the context of the problem?
- **Why** is the business doing this? (business drivers — e.g. why migrate the legacy system now)
- **Who** are the major players and stakeholders?

Rules: a few concise paragraphs conveying vision and rationale. Do **not** restate the requirements document.

### Act 2 — Confrontation (complication)

Answer: **what are the conditions and constraints we faced?** This is the journey — the obstacles the architect had to overcome. It's the part architects usually leave out, and it's what makes the later decisions make sense.

- What are the **business and technical constraints**?
- What **architecture characteristics** must be supported — and which business requirement drives each?
- What are the **unique challenges** of this business problem?
- What **alternatives** were considered, and what are the corresponding **trade-offs**?

### Act 3 — Resolution (climax & resolution)

Answer: **what is the proposed solution?**

- What is the **proposed architecture**?
- Can it be **illustrated effectively with diagrams** that build shared understanding?
- What are the **major architectural decisions** (ADRs)?
- What are the **risks** associated with the proposed solution?

## How to build a narrative (workflow)

1. **Gather inputs.** Ask for or locate: requirements/brief, stakeholder list, existing ADRs, diagrams, known constraints, NFRs, options considered. If the user only has diagrams, interview them for Acts 1 and 2 — that missing context is usually the whole problem.
2. **Inventory the eight components** from the table above. Mark any that are missing; missing Act 2 material is the most common gap and must be filled, not skipped.
3. **Write Act 1** in 2–4 short paragraphs: what / why / who. No requirement lists.
4. **Write Act 2** as the journey. For each driving characteristic, name the business requirement behind it. For each alternative, state the trade-off in one line. Make the tension visible — this is what justifies Act 3.
5. **Write Act 3.** Proposed architecture summary → diagrams (simplest view first, detailed views after) → ADR list or summaries → risks with mitigations.
6. **Check the arc.** Every decision in Act 3 should trace back to a constraint, characteristic, challenge or trade-off in Act 2. Every Act 2 item should matter to the Act 1 problem. Cut anything that doesn't connect.
7. **Fit the audience.** For business stakeholders, keep Act 2 in business language and keep detailed diagrams in an appendix. For technical review boards, Act 2 can go deeper on characteristics and trade-off analysis.

Use `references/narrative-template.md` as the output skeleton. In the AI-DLC flow, write the narrative to `docs/architecture/narratives/<feature-slug>.md`, link the ADRs in `docs/architecture/decisions/` and the frozen spec, and send it to `brutal-critique` before Gate G2.

## Anti-patterns

- **Diagram first.** Opening with the solution diagram (the "everything comes crumbling down" scenario).
- **Requirements dump in Act 1.** Act 1 is vision and rationale, not a spec.
- **Painless Act 2.** Hiding the constraints and trade-offs makes the solution look arbitrary.
- **ADRs before the conflict.** Decisions presented without the pressures that formed them read as opinion.
- **No risks.** A resolution without risks isn't credible.

## Output formats

The same three-act outline works as a document, a slide deck (one or more slides per act, diagrams last), or a talk track. When producing slides, mirror the arc visually: a progress marker showing which act the audience is in helps them follow along.
