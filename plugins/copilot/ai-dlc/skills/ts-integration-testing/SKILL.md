---
name: ts-integration-testing
description: Comprehensive guidance for writing integration tests in JavaScript/TypeScript projects (Node, TypeScript, plain JavaScript) using Vitest (or Jest when the repository already uses it), Testcontainers for Node for real databases, caches and brokers, supertest or the framework's own in-process request API (Fastify inject, Hono app.request) or fetch against a listening server, MSW only for third-party HTTP, per-test schema or transaction isolation, and @faker-js/faker test data — real infrastructure, no mocks of your own code
---

# ts-integration-testing

This skill sets out how to write JavaScript and TypeScript integration tests in the project, on behalf of **Kent Beck** (`sqa-engineer`). Integration tests exercise the system end to end through real infrastructure. The standard stack is:

- **Vitest** as the runner (**Jest** when the repository already uses it; see [`templates/jest-notes.md`](templates/jest-notes.md)).
- **Testcontainers for Node** (`testcontainers`, `@testcontainers/postgresql`, `@testcontainers/redis`, `@testcontainers/kafka`, ...) for real databases, caches and brokers.
- **supertest**, or the framework's in-process request API (Fastify `inject`, Hono `app.request`), or `fetch` against a listening server, to call the real app.
- **MSW** for third-party HTTP APIs only.
- **@faker-js/faker** builders for test data.

Project conventions still apply: the `{ data, error }` return shape (`Result<T>`), and seeing every failure at once.

> Agent names are the defaults; a name chosen at `/init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

The loop and the quality bar (red first, public seams, no tautologies) belong to `write-tests` and its `references/test-quality.md`; whether a test may use a double is decided by `test-doubles`. This skill covers the JS / TS integration specifics. Unit-level patterns are in `ts-unit-testing`.

---

## Phase 0 — Context Load (silent)

1. Read `CLAUDE.md` / `AGENTS.md` (test and integration-test commands) and `.claude/rules/node-testing.md`. On Copilot the same rule is `.github/instructions/node-testing.instructions.md`.
2. Invoke `Skill("manage-memory", args: "sqa-engineer")` to load persistent memory.
3. Detect the runner from `package.json` and config files (`vitest.config.*`, `jest.config.*`). Never add a second runner.
4. Find the existing integration suite (a separate Vitest config or project, a `tests/integration/` folder, an `*.int.test.ts` suffix) and follow its layout, setup files and helpers.
5. Find how the app is composed: is there a `buildApp(config)` / `buildServer(config)` that returns the app without listening? Which HTTP framework? Which database client and migration tool?
6. Note the project conventions:
   - All API responses use the `{ data, error }` shape, typed as the discriminated union `Result<T>`.
   - Infrastructure is real (Testcontainers); only third-party HTTP is replaced (MSW).
   - Test data comes from faker builders.
   - Tests are `describe` / `it` sentences, optionally prefixed `[AC-n]`.

---

## Phase 1 — Integration vs. Unit Tests

Before writing an integration test, confirm it belongs in the integration suite:

| Concern | Unit test | Integration test |
| --- | --- | --- |
| Scope | One module through its public entry point | HTTP request → middleware → handler → database → response |
| Dependencies | Real collaborators; `vi.fn` for owned I/O ports and unowned boundaries (`test-doubles`) | **Real**, started with Testcontainers; MSW for third-party HTTP only |
| Hosting | None: call the function | The app built by its factory, called in process or over a socket |
| Cost | Milliseconds | Seconds (container start amortised across the run) |
| Failure signal | Logic regression | Wiring, configuration, contract, schema or serialisation regression |

**Rule:** if a test would still pass with the database swapped for an in-memory `Map`, it is a unit test. Write it with `ts-unit-testing`. Integration tests must exercise the real wire.

**No mocks of your own code.** `vi.mock` of a repository, service or module you own does not belong in an integration test. If you reach for one, decide whether the behaviour belongs in the unit suite or whether the dependency needs a container. The doubles `test-doubles` allows enter in two ways only: MSW for third-party HTTP, and a test double passed through the app's configuration (a fixed clock, or a failing collaborator for a documented unproducible failure).

---

## Phase 2 — JS / TS Integration Testing Conventions

### Runner configuration

Keep the integration suite in its own Vitest config (or Vitest project), with longer timeouts and a `globalSetup` that starts the infrastructure:

[`templates/vitest-config.md`](templates/vitest-config.md)

- `testTimeout` defaults to 5 s and `hookTimeout` to 10 s; containers and migrations need more.
- Cap workers with the top-level `maxWorkers` (`poolOptions` was removed in Vitest 4).
- Testcontainers for Node 12 needs Node 22.22 or later; Vitest 5 needs Node 22.12 or later.

### The app under test: a factory, not a side effect

Tests need to build the app against the containers' addresses without starting a listener:

[`templates/app-factory.md`](templates/app-factory.md)

If the app cannot be built that way (it reads `process.env` and listens on import), report it to the engineer as a testability finding rather than mocking modules around it.

### Real infrastructure: Testcontainers

Testcontainers starts real Docker containers for the test run. **Never replace the database, broker or cache with a mock** — that is the point of the integration suite.

**Pattern 1: One container for the whole run, in `globalSetup`**

[`templates/global-setup-container.md`](templates/global-setup-container.md)

`project.provide` passes the connection string to every test file; `inject('databaseUrl')` reads it. Pass strings, not container objects.

**Pattern 2: A container for one test file, in `beforeAll` / `afterAll`**

[`templates/per-file-container.md`](templates/per-file-container.md)

**Pattern 3: Several containers on a shared Docker network**

[`templates/multi-container-topology.md`](templates/multi-container-topology.md)

Start in dependency order (network → database → services) and stop in reverse.

**Why Testcontainers:** mocks lie about what the database accepts. The real engine catches broken migrations, missing indexes, dialect-specific SQL, constraint violations, and serialisation mismatches that a mock cannot see.

### Lifecycle hooks

| Hook | Scope | Use for |
|---|---|---|
| `globalSetup` (returns teardown) | Whole run, outside the workers | Containers, networks, migrations |
| `beforeAll` / `afterAll` | One file or `describe` | A file-owned container, the app built once for read-only tests |
| `beforeEach` / `afterEach` | One test | An isolated schema or transaction, a fresh app instance, MSW reset |
| `setupFiles` | Every file, inside the worker | MSW `listen` / `resetHandlers` / `close` |

**When to use which**

| Scenario | Prefer |
|---|---|
| Infrastructure shared by every file | `globalSetup` + `provide` / `inject` |
| Infrastructure only one file needs | `beforeAll` / `afterAll` in that file |
| Per-test state (schema, transaction, app instance) | `beforeEach` / `afterEach` |
| Process-wide interception (MSW) | a `setupFiles` entry |

**Disposal order rule:** dispose in reverse construction order. If you built the app after the container, close the app (and its pool) before stopping the container.

### Calling the app

Pick the closest-to-production entry point the framework offers:

| Framework | Entry point | Template |
|---|---|---|
| Express, Koa, NestJS, any `http.Server` | supertest | [`templates/http-supertest.md`](templates/http-supertest.md) |
| Fastify | `app.inject()` (or supertest on `app.server`) | [`templates/http-fastify-inject.md`](templates/http-fastify-inject.md) |
| Hono | `app.request()` / `testClient` | [`templates/http-hono-request.md`](templates/http-hono-request.md) |
| Socket-dependent behaviour (streaming, WebSockets) | `fetch` against `listen(0)` | [`templates/http-fetch-listening-server.md`](templates/http-fetch-listening-server.md) |

### Per-test isolation on shared infrastructure

Files run in parallel against the same container, so every test must own its slice of state.

**Pattern 1: A schema per test (default)**

[`templates/per-test-schema-isolation.md`](templates/per-test-schema-isolation.md)

**Pattern 2: A transaction per test, rolled back**

[`templates/transaction-isolation.md`](templates/transaction-isolation.md)

Only when the app runs every query on the connection the test gives it. Its limits are in the template.

**Golden rule:** if a resource is shared, every test addresses its own slice of it (schema, table prefix, queue or topic name, cache key prefix, bucket path). Otherwise parallel tests flake.

### Third-party HTTP: MSW

[`templates/msw-third-party.md`](templates/msw-third-party.md)

- Only for APIs you do not own and cannot run in a container.
- Fail on any unhandled outbound request, but let requests to `localhost` / `127.0.0.1` through: MSW also intercepts supertest's and `fetch`'s calls to your own app.
- Reset handlers after every test; override per test with `server.use(...)` for failure paths.
- The current major is MSW 3 (`onUnhandledFrame`, `msw/http`); MSW 2 uses `onUnhandledRequest` and the `msw` root import. Use the major the repository has.

### Test data: faker builders

[`templates/faker-test-data.md`](templates/faker-test-data.md)

Seed state through the app's public API or its production repository, never raw SQL: the round trip through the real persistence code is part of what you validate.

### Assertions

Use the runner's `expect`. Quick reference for integration-flavoured cases:

**Pattern 1: HTTP status and contract headers**

[`templates/assert-http-response.md`](templates/assert-http-response.md)

**Pattern 2: The whole response body in one `toEqual`**

[`templates/assert-response-body.md`](templates/assert-response-body.md)

**Pattern 3: Side effects, read back through the public interface**

[`templates/assert-side-effects.md`](templates/assert-side-effects.md)

Check a write with a GET after the POST (or the equivalent query the caller would use), not by reading the database, unless storage is the contract under test (a migration, a repository mapping, a column another system reads).

**Pattern 4: Transport-level failures**

[`templates/assert-async-rejection.md`](templates/assert-async-rejection.md)

Always `await` `rejects`. Never `try` / `catch` in a test.

### `expect.soft`: see every failure at once

A single integration test crosses many layers. Use `expect.soft` for independent facts about one outcome, so one container cycle reports everything that broke:

[`templates/assert-soft.md`](templates/assert-soft.md)

### The `{ data, error }` Return Shape

Every API response, including those reached through the HTTP pipeline, is asserted on **both** sides in one `toEqual`:

[`templates/data-error-shape.md`](templates/data-error-shape.md)

### Test Naming Convention

`describe` names the endpoint (verb and route); `it` is a sentence with the scenario and the outcome, optionally prefixed with the AC ID:

[`templates/test-naming.md`](templates/test-naming.md)

### Test Structure: Arrange, Act, Assert (AAA)

- **Arrange**: build the app against an isolated schema; generate the payload with a faker builder; set any MSW override.
- **Act**: issue **one** request (or one operation) per test.
- **Assert**: the response (status, headers, body), then the side effect read back through the public API, then any emitted event.

**One Act per test.** A request made only to set up state is arrangement; a request made only to read the result back is assertion. If a test needs two requests that are both "the behaviour", split it.

**See it fail first.** Before trusting a new test, break the expectation or the line of code it covers and confirm it fails for the expected reason.

---

## Phase 3 — Complete Example: Endpoint Integration Test

[`templates/endpoint-integration-test.md`](templates/endpoint-integration-test.md)

---

## Phase 4 — Operational Concerns

### Performance and parallelism

- Container start is the dominant cost. Start shared infrastructure once in `globalSetup`.
- Files run in parallel by default. Pair shared containers with per-test isolation; never assume serial execution.
- `fileParallelism: false` (Jest: `--runInBand`) is a last resort: treat a suite that needs it as a bug to fix.
- Don't put `sequence.concurrent` on integration tests that share a schema per file.

### CI/CD

- Integration tests need a Docker daemon on the runner (GitHub-hosted Ubuntu runners have one).
- Run the integration config as its own step (`npm run test:integration`) so a Docker problem is not reported as a unit-test failure.
- Testcontainers' reaper (Ryuk) removes containers if the run dies; leave it on in CI. Reusable containers (`.withReuse()` with `TESTCONTAINERS_REUSE_ENABLE=true`) are for local runs only.

### Diagnostics

- `await container.logs()` streams a container's output; attach it when a test fails and you need to know what the service saw.
- Log the faker seed and the isolated schema name, so a failing test can be replayed against the same data.

### What NOT to do

- Do **not** seed with raw SQL when a repository or API exists: round-trip through the real code path.
- Do **not** `vi.mock` your own modules in an integration test. Pass any double `test-doubles` allows (a fixed clock, a fake email provider) through the app's configuration.
- Do **not** verify writes by reading tables when the public API can read them back.
- Do **not** share mutable state between tests through module-level variables without per-test reset.
- Do **not** hard-code ports; use `listen(0)` and mapped container ports.

---

## Phase 5 — Key Takeaways

When writing integration tests for JavaScript/TypeScript projects:

1. **Build the app from a factory** and call it in process (supertest, `inject`, `app.request`) or over `listen(0)`.
2. **Use Testcontainers for real infrastructure**: Postgres, Redis, Kafka, all of it.
3. **No mocks of your own code**; doubles only where `test-doubles` allows, with MSW for third-party HTTP.
4. **Start containers once, isolate state per test**: `globalSetup` + a schema (or transaction) per test.
5. **Generate test data with faker builders**; seed through the production code path.
6. **Assert the whole body in one `toEqual`**, both sides of `{ data, error }`.
7. **Use `expect.soft`** for independent facts about one outcome.
8. **Verify side effects through the public interface** (GET after POST), not the database.
9. **Name tests as `describe` / `it` sentences**, with `[AC-n]` when they trace to an AC.
10. **See every new test fail once** before trusting it.

Follow these patterns consistently across all integration suites.
