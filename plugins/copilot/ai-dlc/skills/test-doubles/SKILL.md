---
name: test-doubles
description: "Mock, stub, fake, spy or test double policy — the single rule for whether a test may replace part of the system and with what. Use when a test plan lists doubles, before writing any mock, stub, fake, spy, MSW handler, Playwright route or fake clock, when someone asks \"can I mock this?\", and when reviewing a diff that adds or changes a double. Everything runs for real except a boundary you don't own, an owned I/O port in a unit test, controlled non-determinism, and a documented failure state of your own system that cannot be produced for real."
---

# Test Doubles

The single source of truth for when a test may use a **double** — stub, mock, fake, spy, network route, MSW handler, fake clock — and of what kind. **Kent Beck** (`sqa-engineer`) applies it when planning and writing tests, **David Fowler** (`software-engineer`) when writing a regression test, and **Robert C. Martin** (`code-reviewer`) when reviewing one. It is language-agnostic: the stack testing skills show the mechanics (see *Stack pointers*) and defer to this skill for the policy.

> Agent names are the defaults; a name chosen at `/init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

**The rule:** everything runs for real. A double is allowed in exactly four cases — an **unowned boundary**, an **owned port** in a unit test, **controlled non-determinism**, or an **unproducible failure** of a part you own. Anything else is a finding.

An **owned port** is an interface the codebase owns that wraps I/O: a repository, a gateway, a clock or ID provider, a message publisher. Plain in-process logic — pure functions, value objects, validators, mappers, domain services without I/O — is never a port.

## Classify every double

Run this for each double a test plan names, a test needs, or a diff adds. Done when every double carries exactly one of the four categories, or has been replaced by the real thing.

1. **Is it the unit under test, or plain in-process logic?** Then it is forbidden. Run it for real.
2. **Is it a boundary you don't own, or a source of non-determinism?** → *Unowned boundary* or *Controlled non-determinism*. Allowed at every level; follow its rules below.
3. **Is it an owned port, in a unit test?** → *Owned port*. Allowed (rule 1). In an integration or UI / end-to-end test the same port runs for real — go to step 4.
4. **Is it a failure state of something you own that the real system cannot be driven into deterministically?** → *Unproducible failure*. Allowed only under the failure-state rules below.
5. **None of the above** → no double. Run it for real, or, if the code gives no seam that reaches the behaviour without one, report the missing seam to the calling agent so **Zoran Horvat** (`system-engineer`) can address testability.

## 1. Real by default

What you own runs for real; the one allowance is owned ports in unit tests. Level by level:

| Test level | Runs for real | May be doubled (besides unowned boundaries and controlled non-determinism) |
|---|---|---|
| **Unit** | The unit under test and its plain in-process collaborators (pure functions, value objects, validators, domain services without I/O) | **Owned ports** the unit receives: repositories, gateways, clock / ID providers, message publishers |
| **Integration** | Your code, your database, cache and queues (containers or ephemeral instances: a throwaway schema, a test tenant, a disposable queue), your HTTP API | Only an *unproducible failure* of a part you own (rule 4) |
| **UI / end-to-end** | Your UI, your API and its infrastructure | Only an *unproducible failure* of a part you own (rule 4) |

- An owned-port double in a unit test stands in for I/O, not for logic. Type it as the port's interface, configure only what the test exercises, and assert on the unit's outcome.
- The port's real implementation is proved by integration tests against real infrastructure; a unit-level double does not replace them.
- A double of plain logic freezes today's structure into the test: it breaks on a refactor that keeps behaviour, and still passes when the real collaborator is broken.

## 2. Unowned boundaries

A system you don't own — a third-party HTTP API, a payment provider, an email or SMS provider, an external SaaS — may be replaced in unit and integration tests by a double or a **contract-faithful fake**.

- Replace it at the narrowest point: the client your code calls, or the outbound HTTP request — not your code that wraps it.
- Type or shape the double from the real contract (the provider's SDK types, its OpenAPI schema, recorded traffic), so it fails to compile or match when the contract moves.
- Keep it faithful: a **contract test** against the provider's sandbox, or the provider's own published contract, proves the double still matches. A double nobody checks drifts.
- End-to-end tests reach the provider's sandbox when the environment can; route it only when the sandbox cannot be reached, would charge, or cannot produce the case.

## 3. Controlled non-determinism

Time, randomness and generated IDs are **injected or controlled**, never mocked ad hoc.

- Time: a fake or fixed clock passed in through the code's clock abstraction or the framework's clock control — not a patched global inside one test.
- Randomness and test data: a seeded generator (seeded faker / Bogus), with the seed logged so a failure replays.
- IDs: an injected ID generator, or assertions that do not depend on the generated value.

## 4. Unproducible failures of parts you own

You may fake your own component — route your own API to return 503, make your own repository throw, simulate a timeout — **only** when that failure cannot be produced for real in the test environment: the real system cannot be driven into it deterministically (an outage, a timeout, a rate limit, a full disk, a race).

First try to produce it for real. Invalid input, a stopped container, a revoked token, a filled quota, a deleted row, a closed connection: if the test can cause it deterministically without disturbing other tests, it causes it, and no double is allowed.

When the failure really is unproducible, the test:

- **names the failure state and why it cannot be produced for real**, in the test name or a comment at the double (for example `// 503: the real API only returns it during an outage, which the test environment cannot trigger on demand`);
- **asserts the caller- or user-visible handling** — the error message shown, the retry, the `{ data, error }` result, the input kept — never that the fake was hit;
- **lives apart from the happy-path tests** — in its own `describe`, class or file; a happy-path test never runs against a faked part you own;
- **fakes a collaborator, never the unit under test itself**;
- fakes only the failing operation and lets everything else reach the real system.

## 5. Forbidden doubles

- A double of the unit under test, or of part of it (a partial mock, a spied private method).
- A double of plain in-process logic you own (a pure function, value object, validator, mapper, domain service without I/O), at any level.
- A double of an owned port in an integration or UI / end-to-end test, unless it is a documented *unproducible failure*.
- A port invented only to make a test easier to write — an interface around logic that does no I/O.
- Asserting on a double's calls when the observable outcome could be asserted instead. Assert on the call only when the call *is* the behaviour (the email was sent, the message was published, the payment was charged).
- Snapshotting a double's calls or arguments.
- A double that has drifted from the real contract. Add a contract test, or use the provider's sandbox.

## Review checklist

For every double in a diff — new, changed or newly reached by a changed test — check that it is one of:

- [ ] an **unowned boundary**, typed or shaped from the real contract, with a contract test or sandbox keeping it faithful; or
- [ ] an **owned port** (an owned interface that wraps I/O) in a **unit** test, typed as the port, and not the unit under test; or
- [ ] **controlled non-determinism** (injected or framework-controlled clock, seeded data, injected IDs); or
- [ ] an **unproducible failure** of a part you own that names the failure and why it cannot be produced for real, asserts the visible handling, sits apart from the happy path, and does not fake the unit under test.

Anything else is a finding. Severity: **Warning**; **Blocker** when the double hides the behaviour under test — it replaces the unit or the logic the test is about, an integration or end-to-end happy path runs against a faked part you own, or the assertion checks the double instead of the outcome.

## Stack pointers

The mechanics live in the stack skills; they do not restate this policy.

| Double | C# / .NET | JS / TS |
|---|---|---|
| Typed double of an owned port or an unowned boundary (unit tests) | `csharp-unit-testing` (`templates/mock-create.md`, `mock-configure.md`, `mock-verify.md`, `mock-argument-matching.md`) | `ts-unit-testing` (`templates/mock-create.md`, `mock-configure.md`, `mock-verify.md`, `mock-argument-matching.md`) |
| Imported port or boundary module (unit tests) | — | `ts-unit-testing` (`templates/mock-module-boundary.md`) |
| Clock / ID provider | `csharp-unit-testing` (`templates/mock-create.md`, as an owned port); `csharp-integration-testing` (`templates/configure-test-services.md`) | `ts-unit-testing` (`templates/fake-timers.md`); `ts-playwright-ui-testing` (`templates/clock.md`) |
| Seeded test data | `csharp-unit-testing` (`templates/bogus-test-data.md`) | `ts-unit-testing` (`templates/faker-test-data.md`) |
| Third-party HTTP in integration tests | `csharp-integration-testing` (`templates/configure-test-services.md`: replace the provider's client) | `ts-integration-testing` (`templates/msw-third-party.md`) |
| Replacing a service in the test host (clock, third-party client, unproducible failure) | `csharp-integration-testing` (`templates/configure-test-services.md`) | `ts-integration-testing` (`templates/app-factory.md`) |
| Network route in an end-to-end UI test (third party, unproducible failure) | `tunit-playwright-ui-testing` (Playwright's `Page.RouteAsync`; no template yet) | `ts-playwright-ui-testing` (`templates/network-mocking.md`, `complete-example.md` [AC-3]) |
