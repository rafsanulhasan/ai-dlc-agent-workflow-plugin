# ADR-0017: Standards are agent artifacts, written by `agent-manager` (exception to ADR-0014)

- **Status:** Accepted (human decision D57, 2026-11-14). **In progress:** feature 8 is still being reviewed, and the G2 amendment of spec 001 that this ADR implies is pending the human's approval at G3 (D65). Built so far, in this repository only (steps 8.2, 8.2.l1.1): the standards folder, its generator and the wording of `docs-status`. For consumer repositories it ships with the rest of ADR-0014's rule change (bolt 003, planned).
- **Date:** 2026-11-14
- **Deciders:** human (D54, D56, D57); software-architect (8.1.6). Amends [ADR-0014](ADR-0014-single-writer-of-memory-bank.md), which stays Accepted.

## Context

ADR-0014 makes `documentation-writer` the only writer under `memory-bank/`, and spec 001 §14 counts every bank file as documentation. Spec 001 §2.2 gives standards one home inside the bank, `memory-bank/project/standards/` (key `standards`, optional until 1.0.0), and D54 kept it to that one home.

In this repository the standards are the source of the rules (D56): `tools/build-standards.mjs` writes each standard into `.claude/rules/<name>.md` and `.github/instructions/<name>.instructions.md` with identical bodies. Research 8.1.5 found that no host loads a pointer stub reliably. Copilot does not expand `@` references in `*.instructions.md`. Claude Code documents `@` imports for `CLAUDE.md` only. So the twins are full generated copies, and editing a standard is editing a rule. Rules are agent artifacts, and only `agent-manager` changes them.

Under ADR-0014 as written, one rule would have two writers: `documentation-writer` for the standard and `agent-manager` for the build that writes its twins. Every `agent-manager` change to a standard would also be a reviewer Blocker (AC-7.3). Critique 8.1.4 (D51, Major 3) asked for the writer to be decided before anything moved. D57 decided it.

## Decision

Standards are agent artifacts, not documentation. `agent-manager` creates, edits and deletes them. `documentation-writer` does not.

- **Scope.** The folder that the `standards` artifacts key resolves to, and only that folder. The default is `memory-bank/project/standards/`. In this repository, which has no `standards` key, it is `.forgeline/memory-bank/project/standards/`. Every other path in the bank keeps ADR-0014's single writer.
- **Review.** A change to a standard is agent-artifact work: AAWH, or AAWP when the generator or other code changes with it. `brutal-critique` critiques the standard. The generated twins are build output and get no reviewer (ADR-0014's exemption for text a build generates).
- **Blocker check.** A file in the standards folder is not a finding in `agent-manager`'s change set. In any other agent's change set, `documentation-writer` included, it is a Blocker: the mirror of AC-7.3. An `agent-manager` change to any other bank path is still a Blocker under ADR-0014.
- **Wording.** The `docs-rules` template of `docs-status`, and in this repository the standard and its generated twins, list "the standards the rules and instructions are generated from, wherever a repository keeps them" under agent artifacts, written by `agent-manager` (D59; done in 8.2.l1.1).

## Consequences

- Each rule has one writer from its source to its twins. A rule change is one `agent-manager` round, not an `agent-manager` round plus a `documentation-writer` round.
- The bank has two writers, split by folder. The authorship check of AC-7.3 must know the standards folder, and the `review` skill must say so (bolt 003).
- Spec 001 §14, AC-7.1, AC-7.2, AC-7.3 and the glossary entry "Memory bank" no longer hold word for word. They change with this ADR (G2 amendment, delta r2).
- Standards carry no docs-status markers and are not part of "knowledge done" for a unit or bolt (§14).
- Reader-facing pages may still link to standards. `documentation-writer` writes those links, not the standards.
- A repository that keeps its standards outside the bank is unaffected: standards are agent artifacts wherever they live.

## Alternatives rejected

- `documentation-writer` writes the standards (ADR-0014 as written): two writers for one rule, and a Blocker on every `agent-manager` rule change.
- `software-architect` writes the standards (suggested in critique 8.1.4): here a standard is the source of an enforced rule, not an architecture decision. Rules stay with `agent-manager`, and decisions go in ADRs.
- Rules stay the source and standards become catalog entries that point to them (8.1.4's alternative to D52): reversed by D56.
- Pointer stubs in `.claude/rules/` and `.github/instructions/` (D47, D52): no host loads the target reliably (8.1.5).
