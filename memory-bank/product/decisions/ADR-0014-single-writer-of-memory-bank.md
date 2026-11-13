# ADR-0014: `documentation-writer` is the single writer of `memory-bank/`

- **Status:** Proposed (G2). Planned: nothing is built (the rule change is bolt 003).
- **Date:** 2026-11-13
- **Deciders:** software-architect (1.1.14, 1.1.20), system-engineer (1.1.19), human at G2; the principle is human decision D2.

## Context

D2: stage agents own the content; one agent persists it. In preview1 each stage wrote its own artifacts, and voice, status markers and paths drifted between them.

## Decision

Stage agents return content and a *Docs update* request; only `documentation-writer` writes under `memory-bank/`, and `brutal-critique` gates it. Any other agent's write to the bank is a reviewer Blocker.

- Exempt: tool output with no content edit (the `.gitkeep` scaffolding of `init`, the pure moves of `migrate`, `git mv` at 100% similarity) and text a build generates (spec 001 §14).
- `execution-plans/` is not documentation: the orchestrator and, in an agent team, the teammates write the records.
- The backlog in the bank: `product-manager` owns the content and `documentation-writer` writes it, including the merge of this repository's backlog (ITEM-121).

## Consequences

- One voice and one consistent status.
- An extra hop per artifact.
- The documentation rule and its template change (bolt 003).
- Authorship can be checked from the diff.

## Alternatives rejected

- Each stage writes its own artifacts, as in preview1.
- A shared-writer convention without the Blocker: unenforceable.
