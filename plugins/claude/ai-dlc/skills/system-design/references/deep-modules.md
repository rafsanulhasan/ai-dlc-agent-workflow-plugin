# Deep Modules, Seams and Deepening

Shared vocabulary for judging whether a module earns its interface, where its seams belong, and how to merge shallow modules into a deeper one. `system-design` and `architecture-review` both use these terms; use them exactly so designs and reviews read the same way.

## Vocabulary

| Term | Meaning |
|---|---|
| **Module** | Anything with an interface and an implementation, at any scale: a function, a type, a package, a service, a vertical slice. |
| **Interface** | Everything a caller must know to use the module correctly: the signatures, plus invariants, call-ordering rules, error modes, required configuration and performance characteristics. Wider than the language's `interface` keyword or a type's public members. |
| **Implementation** | The code inside the module. |
| **Depth** | Leverage at the interface: how much behaviour a caller (or a test) gets per unit of interface it has to learn. **Deep**: a lot of behaviour behind a small interface. **Shallow**: the interface is almost as complex as what it hides. |
| **Seam** | A place where behaviour can be changed without editing the code at that place (Michael Feathers). The seam is *where* an interface sits; choosing it is a separate decision from choosing what goes behind it. |
| **Adapter** | A concrete thing that fills an interface at a seam. Describes a role, not a size: a database repository is a thin adapter over a big implementation; an in-memory fake is the reverse. |
| **Leverage** | What callers gain from depth: more capability per thing learned. One implementation pays back across every call site and every test. |
| **Locality** | What maintainers gain from depth: changes, bugs and knowledge concentrate in one place. Fix it once, it is fixed everywhere. |

Say **seam** or **interface**, not "boundary": "boundary" is reserved for bounded contexts.

Depth is not the ratio of implementation lines to interface lines. That measure rewards padding. Judge depth by leverage.

## Principles

- **Depth belongs to the interface.** A deep module may be built from many small, swappable parts inside; they are simply not part of its interface. It may have **internal seams** (private, used by its own tests) as well as the **external seam** where its interface lives. Do not expose an internal seam just because a test uses it.
- **The deletion test.** Imagine deleting the module and inlining it into its callers. If complexity disappears, it was a pass-through. If the same complexity reappears in every caller, the module was earning its place.
- **The interface is the test surface.** Callers and tests cross the same seam. If a test has to reach past the interface to check something, the module is the wrong shape.
- **One adapter is a hypothetical seam; two adapters make it real.** Introduce a seam (an abstraction plus injection) only when at least two adapters are justified, typically the production one and a test one. A seam with one adapter is indirection with no payoff.

When shaping an interface, ask: can it have fewer operations? Simpler parameters? Can more of the complexity move inside?

## Designing for testability

- **Take dependencies in; do not construct them inside.** A module that builds its own payment gateway cannot be tested without the real one.
- **Return results instead of mutating what was passed in.** A function that returns the computed discount is trivial to test; one that silently edits the cart is not.
- **Keep the surface small.** Fewer operations need fewer tests; fewer parameters need less setup.

## Deepening a cluster of shallow modules

Before merging shallow modules into one deep module, classify each dependency. The category decides how the deepened module is tested across its seam.

| Category | Examples | How to deepen and test |
|---|---|---|
| **1. In-process** | Pure computation, in-memory state, no I/O | Always deepenable. Merge, then test straight through the new interface. No adapter needed. |
| **2. Local stand-in available** | A database with an embeddable or containerised test instance, an in-memory file system | Deepenable when the stand-in exists. Tests run against the stand-in; the seam stays internal and does not appear in the module's interface. |
| **3. Remote but owned** | Your own services over the network, internal APIs, queues | Put a **port** (interface) at the seam. The deep module owns the logic; the transport is an injected adapter: network adapter in production, in-memory adapter in tests. The logic lives in one module even though it is deployed across a network. |
| **4. Truly external** | Third-party payment, messaging or identity providers | Inject the provider as a port; tests supply a fake or mock adapter. |

### Replace tests, do not layer them

- Write tests at the deepened module's interface; that is now the test surface.
- Assert on observable outcomes through the interface, never on internal state.
- Once those exist, delete the old unit tests of the shallow parts. Keeping both doubles the maintenance for no extra safety.
- A good test survives an internal refactor. A test that must change whenever the implementation changes is testing past the interface.
