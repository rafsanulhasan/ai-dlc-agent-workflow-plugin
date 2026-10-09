# Design It Twice

Your first interface idea is rarely the best one (John Ousterhout, *A Philosophy of Software Design*). For any interface that will be hard to change later — a module many callers will use, a port at a seam, the deepened module from an architecture review — produce several radically different designs, compare them, and only then recommend one.

Uses the vocabulary in [deep-modules.md](deep-modules.md).

## 1. Frame the problem

Write a short, reader-facing statement of the problem before designing anything:

- the constraints every candidate interface must satisfy (requirements, ACs, invariants, performance limits);
- the dependencies it relies on and their category (in-process, local stand-in, remote but owned, truly external);
- a rough sketch of a call site, only to make the constraints concrete. It is not a proposal.

Share it with whoever asked, then go straight on to step 2; they can read while the designs are produced.

## 2. Produce three or more designs under different constraints

Give each design one deliberately different driving constraint, for example:

1. **Minimal** — one to three entry points; maximum leverage per entry point.
2. **Flexible** — supports many use cases and extension.
3. **Common case first** — the most frequent caller's code is trivial; rare cases may cost more.
4. **Ports and adapters** — designed around the cross-seam dependencies (when there are any of category 3 or 4).

If you can spawn agents, brief one agent per design in parallel. Each brief is self-contained: the relevant file paths, the coupling you found, each dependency's category, what must sit behind the seam, the driving constraint, and both vocabularies (the terms in `deep-modules.md` and the project glossary) so all designs name things the same way. If you cannot spawn agents, draft each design on its own, in turn, without revising the earlier ones to look like the later ones.

Each design states:

1. the interface: operations, parameters, invariants, ordering rules, error modes;
2. a usage example from a caller's point of view;
3. what the implementation hides behind the seam;
4. the dependency strategy and which adapters exist;
5. trade-offs: where leverage is high and where it is thin.

## 3. Compare and recommend

Present the designs one at a time so each can be absorbed, then compare them in prose on:

- **depth** — leverage at the interface;
- **locality** — where future change will concentrate;
- **seam placement** — whether each seam has two real adapters.

Finish with a firm recommendation: which design is strongest and why. If parts of different designs combine well, propose the hybrid. The reader wants a clear position, not a menu.
