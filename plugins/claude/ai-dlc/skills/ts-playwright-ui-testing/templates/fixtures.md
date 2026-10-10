# fixtures

Fixtures give each test exactly what it needs, set up and torn down around it. Extend `test` once and import it from every spec.

```ts
// e2e/fixtures.ts
import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { TodoPage } from './pages/todo-page';

type TestFixtures = {
  todoPage: TodoPage;
  makeAxeBuilder: () => AxeBuilder;
  seededTodo: { id: string; title: string };
};

type WorkerFixtures = {
  workerAccount: { email: string };
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  todoPage: async ({ page }, use) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await use(todoPage);
  },

  makeAxeBuilder: async ({ page }, use) => {
    await use(() => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']));
  },

  seededTodo: async ({ request }, use) => {
    const title = `Seeded ${crypto.randomUUID()}`;
    const response = await request.post('/api/todos', { data: { title } });
    await expect(response).toBeOK();
    const { data } = await response.json();

    await use({ id: data.id, title });

    await request.delete(`/api/todos/${data.id}`);   // teardown runs after the test
  },

  workerAccount: [
    async ({}, use, workerInfo) => {
      await use({ email: `e2e-worker-${workerInfo.workerIndex}@example.test` });
    },
    { scope: 'worker' },
  ],
});

export { expect } from '@playwright/test';
```

```ts
// e2e/todos.spec.ts
import { test, expect } from './fixtures';

test('completing a todo moves it to Done', async ({ todoPage, seededTodo }) => { /* ... */ });
```

- The code before `use` is setup, the code after is teardown; teardown runs even when the test fails.
- Worker fixture types go in the **second** generic, and the fixture is a tuple with `{ scope: 'worker' }`: it is created once per worker process.
- Other tuple options: `auto: true` (runs for every test without being requested), `timeout`, `option: true` (overridable with `test.use`), `box: true` (hides the fixture's steps from reports).
- Combine fixture sets from several files with `mergeTests(a, b)` and custom matchers with `mergeExpects`.
- A fixture is the place for per-test data: unique values (`randomUUID`) keep parallel tests apart.
