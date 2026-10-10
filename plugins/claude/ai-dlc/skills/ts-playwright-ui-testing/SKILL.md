---
name: ts-playwright-ui-testing
description: Comprehensive guidance for writing coded end-to-end UI tests for web applications in JavaScript/TypeScript projects (Node, TypeScript, plain JavaScript) using Playwright Test (@playwright/test). Covers playwright.config.ts, webServer, the auth setup project with storageState, fixtures and page objects, role-first locators, web-first assertions, evidence (trace, screenshot, video, attachments, steps), API seeding, network mocking, the clock, axe accessibility scans, tags, sharding and CI. Based on the official docs at https://playwright.dev/docs/intro.
---

# ts-playwright-ui-testing

This skill guides **Kent Beck** (`sqa-engineer`) to write coded, repeatable end-to-end UI tests for web applications in the project using **Playwright Test** (`@playwright/test`), in TypeScript or JavaScript. The test runner manages browsers, contexts and pages through fixtures; tests receive `page`, `request` and the project's own fixtures as arguments.

> Agent names are the defaults; a name chosen at `/ai-dlc:init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

> **Source:** Official Playwright docs — https://playwright.dev/docs/intro

> **When to use:** Use this skill for end-to-end tests that are committed as `*.spec.ts` files and run in CI with `npx playwright test`. For one-time AI-driven exploratory browser checks (no test files), use `playwright-mcp-ui-testing`. For C# / .NET suites, use `tunit-playwright-ui-testing`.

The loop and the quality bar (red first, public seams, no tautologies) belong to `write-tests` and its `references/test-quality.md`; which requests a test may route is decided by `test-doubles`. For a UI test the public seam is the rendered page, reached the way a user reaches it.

---

## Phase 0 — Context Load (silent)

1. Read `CLAUDE.md` / `AGENTS.md` and `.claude/rules/node-testing.md` (on Copilot: `.github/instructions/node-testing.instructions.md`).
2. Load memory: `Skill("ai-dlc:manage-memory", args: "sqa-engineer")`.
3. Find the existing Playwright setup: `playwright.config.*`, the `testDir` (`e2e/`, `tests/e2e/`), fixtures and page objects. Follow it; create one only if none exists.
4. Read the spec file at `docs/specs/<feature-slug>.spec.md` if it exists, and list the ACs the UI tests must cover.
5. Find how the app starts for tests (a `start:test` / `preview` script, a health endpoint) and how test users are provisioned.

---

## Phase 1 — Setup

Initialise in a repository without Playwright (it adds the package, a config, an example test and, optionally, a GitHub Actions workflow):

```bash
npm init playwright@latest      # or: pnpm create playwright / yarn create playwright
```

In a repository that already has it, add only what is missing:

```bash
npm install --save-dev @playwright/test @axe-core/playwright
npx playwright install --with-deps
```

Playwright supports Node 22, 24 and 26. Keep `@playwright/test` and the browsers in step: re-run `npx playwright install` after every version bump.

---

## Phase 2 — Configuration

**Pattern 1: `playwright.config.ts`** — parallelism, CI behaviour, reporters, evidence, projects

[`templates/playwright-config.md`](templates/playwright-config.md)

**Pattern 2: `webServer`** — start the app (and API) for the run

[`templates/web-server.md`](templates/web-server.md)

**Pattern 3: the auth setup project** — sign in once, reuse `storageState`

[`templates/auth-setup-project.md`](templates/auth-setup-project.md)

---

## Phase 3 — Structure: Fixtures and Page Objects

**Pattern 1: Page objects** — locators and user actions, no assertions

[`templates/page-object.md`](templates/page-object.md)

**Pattern 2: Fixtures** — page objects, seeded data with cleanup, the axe builder, worker-scoped resources

[`templates/fixtures.md`](templates/fixtures.md)

Every spec imports `test` and `expect` from the project's `fixtures.ts`, never straight from `@playwright/test`, so all tests share the same fixtures.

---

## Phase 4 — Locators and Assertions

**Pattern 1: Role-first locators**

[`templates/locators.md`](templates/locators.md)

`getByRole` → `getByText` → `getByLabel` → `getByPlaceholder` → `getByAltText` → `getByTitle` → `getByTestId`. Locators are strict; narrow with `filter` instead of `first()` / `nth()`.

**Pattern 2: Web-first assertions**

[`templates/web-first-assertions.md`](templates/web-first-assertions.md)

Always `await expect(locator).toBeVisible()` / `toHaveText()` / `toHaveCount()` / `toHaveURL()`; never read a value and compare it with a plain matcher.

**Pattern 3: `expect.soft`, `expect.poll` and `toPass`**

[`templates/assert-soft-and-poll.md`](templates/assert-soft-and-poll.md)

---

## Phase 5 — Data, Network and Time

**Pattern 1: API seeding** — preconditions through the API, the behaviour through the UI

[`templates/api-seeding.md`](templates/api-seeding.md)

When the API returns the project's `{ data, error }` shape, assert both sides of the seed response in one `toEqual`.

**Pattern 2: Network mocking** — only the routes `test-doubles` allows: third-party services, and failures of your own API that cannot be produced for real

[`templates/network-mocking.md`](templates/network-mocking.md)

**Pattern 3: The clock** — fixed time and fast-forwarded timers

[`templates/clock.md`](templates/clock.md)

---

## Phase 6 — Evidence

[`templates/evidence.md`](templates/evidence.md)

- Traces on the first retry (or retained on failure), screenshots on failure, video retained on failure.
- `test.step` names the stages of a journey; `testInfo.attach` adds files and JSON the trace does not hold.
- `npx playwright show-report` and `npx playwright show-trace` to diagnose.

---

## Phase 7 — Accessibility

[`templates/accessibility-axe.md`](templates/accessibility-axe.md)

Scan each meaningful state with `@axe-core/playwright` through a shared `makeAxeBuilder` fixture, attach the results, and assert `expect(results.violations).toEqual([])`.

---

## Phase 8 — Naming, Tags and Running

**Test naming**

[`templates/test-naming.md`](templates/test-naming.md)

**Tags and CLI filtering**

[`templates/tags-and-filtering.md`](templates/tags-and-filtering.md)

```bash
npx playwright test                       # everything, all projects
npx playwright test --project=chromium    # one browser
npx playwright test --grep @smoke         # tagged subset
npx playwright test --ui                  # interactive mode for local work
```

---

## Phase 9 — CI Integration and Sharding

[`templates/sharding-ci.md`](templates/sharding-ci.md)

- `npx playwright install --with-deps` on the runner.
- Shard with `--shard=i/n` and the `blob` reporter; merge with `npx playwright merge-reports`.
- Upload reports and `test-results/` with `if: ${{ !cancelled() }}`.
- Workflow files are owned by **Gene Kim** (`devops-engineer`) through `github-ci-automation`; hand the job shape over rather than editing workflows from a test task.

---

## Phase 10 — Complete Example

[`templates/complete-example.md`](templates/complete-example.md)

---

## Best Practices

| Do | Don't |
|----|-------|
| Import `test` / `expect` from the project's `fixtures.ts` | Build browsers, contexts or pages by hand |
| Use `getByRole`, `getByLabel`, `getByText` | Reach for CSS or XPath selectors first |
| `await expect(locator).toHaveText(...)` (web-first) | `expect(await locator.textContent()).toBe(...)` |
| Narrow locators with `filter({ hasText, has })` | Use `first()`, `last()` or `nth()` to dodge strictness |
| Seed data through the API, unique per test | Click through setup screens or share data between tests |
| Sign in once in the `setup` project | Log in through the UI in every test |
| Route only third-party calls and failures you cannot produce for real (`test-doubles`) | Route your own API on the happy path |
| Control time with `page.clock` | Use `page.waitForTimeout()` |
| Keep assertions in tests | Put `expect` in page objects |
| Use `expect.soft` for independent checks of one outcome | Let the first failure hide the rest |
| Keep traces, screenshots and attachments on failure | Debug CI failures by rerunning blind |
| Tag and trace each test to an AC (`[AC-n]` in the title) | Write untargeted UI tests |
| See every new test fail once | Trust a test you have only seen pass |

---

## References

- Playwright Test docs: https://playwright.dev/docs/intro
- Locators: https://playwright.dev/docs/locators
- Assertions: https://playwright.dev/docs/test-assertions
- Fixtures: https://playwright.dev/docs/test-fixtures
- Authentication: https://playwright.dev/docs/auth
- Accessibility testing: https://playwright.dev/docs/accessibility-testing
- Sharding: https://playwright.dev/docs/test-sharding
