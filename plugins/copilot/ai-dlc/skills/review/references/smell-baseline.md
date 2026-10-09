# Smell Baseline for the Standards Axis

Companion to Phase 4 of the `review` skill. These are the code smells from Martin Fowler's *Refactoring* (chapter 3) that the Standards axis checks even when a project documents no standards of its own.

Rules:

- **The project wins.** A documented project standard always overrides this list. If the project explicitly allows something below, do not report it.
- **Judgement, not violation.** Report a match as "possible <smell>", quote the hunk, and suggest the remedy. A smell alone is at most a Warning, never a Blocker.
- **Only the diff.** Report smells introduced or made worse by the change, not ones that were already there.
- **Skip what tools catch.** If a linter or analyzer already flags it, it is not a review finding.

| Smell | What to look for in the diff | Usual remedy |
|---|---|---|
| **Mysterious Name** | A function, variable or type whose name does not say what it does or holds | Rename. If no honest name comes to mind, the design is unclear — say so. |
| **Duplicated Code** | The same logic shape in more than one hunk or file of the change | Extract the shared shape once and call it from each place. |
| **Feature Envy** | A method that uses another object's data more than its own | Move the method to the data it uses. |
| **Data Clumps** | The same few fields or parameters travelling together through several signatures | Introduce a type for the group and pass that. |
| **Primitive Obsession** | A string or number standing in for a domain concept (an ID, an amount with currency, a status) | Give the concept its own small type. |
| **Repeated Switches** | The same `switch` or `if` cascade over the same discriminator in several places | Polymorphism, or one lookup table shared by every site. |
| **Shotgun Surgery** | One logical change forced scattered edits across many files | Gather what changes together into one module. |
| **Divergent Change** | One file or module edited for several unrelated reasons in the same change | Split it so each part changes for one reason. |
| **Speculative Generality** | Abstractions, parameters, hooks or extension points no requirement needs | Remove them; inline until a real need appears. |
| **Message Chains** | Callers navigating `a.b().c().d()` through structure they should not depend on | Hide the walk behind one method on the first object. |
| **Middle Man** | A class or function that mostly forwards calls elsewhere | Remove it and call the real target. |
| **Refused Bequest** | A subtype or implementer that ignores or overrides most of what it inherits | Replace inheritance with composition. |

Speculative Generality overlaps with the YAGNI check in Phase 4 and with "Not asked for" findings on the Spec axis. Report it once, on the axis that fits: Standards when it is unnecessary *structure*, Spec when it is unrequested *behaviour*.
