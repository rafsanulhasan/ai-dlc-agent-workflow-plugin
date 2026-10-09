# Behaviour-Preserving Refactors

Companion to `implement-feature` for plan steps that restructure code without changing what it does: extracting a module, consolidating duplicates, moving a responsibility to the component that should own it, or cleanup a design or review asked for.

## The rule: prove it before and after

A refactor is only safe if the same proof passes on both sides of the structural edit.

1. **Draw the boundary.** Write down what must not change: public interfaces, return values, error and failure behaviour, ordering and side effects, persisted formats, configuration and compatibility with existing callers. Anything outside that list is in scope for restructuring; anything on it is not, unless the plan says so explicitly.
2. **Establish the proof first.** Pick the tests that exercise the boundary and run them *before* touching the structure. They must be green. If they are not, stop: you cannot tell a refactoring mistake from a pre-existing failure.
3. **Fill gaps before the edit, not after.** If nothing covers part of the boundary, that is a gap for **Kent Beck** (`sqa-engineer`) to close (characterisation tests that pin today's behaviour) before the restructure starts. Do not write those tests yourself, and do not begin the edit with the boundary unproven; record it in the plan as blocked.
4. **Make the structural edit.** Move one ownership boundary at a time. Each intermediate state builds and passes the proof; never leave a half-moved responsibility across commits.
5. **Run the same proof again.** Same tests, same filters, same inputs. Green on both sides is the evidence; record both runs in the handoff.

## Keep it a refactor

- **No feature changes inside the refactor.** If the work item also needs new behaviour, sequence it as a separate step (and preferably a separate commit) after the refactor is proven. Mixing them makes both unreviewable.
- **No growth without a reason.** A refactor does not add dependencies, configuration, extension points or abstractions unless correctness needs them.
- **A test that has to change is a signal.** If a boundary test must be edited for the refactor to pass, behaviour changed. Either the boundary was drawn wrong (say so and ask) or the edit is not a refactor.
- **Commit type is `refactor`** — see [commit-messages.md](commit-messages.md).

## Done when

- The requested structure is in place.
- The proof that passed before the edit passes after it, unchanged.
- Nothing on the boundary list changed.
