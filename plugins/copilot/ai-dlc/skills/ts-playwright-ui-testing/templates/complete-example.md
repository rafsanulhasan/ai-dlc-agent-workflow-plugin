# complete-example

A spec that uses the config, auth setup project, fixtures and page object from the other templates.

```ts
// e2e/todos.spec.ts
import { test, expect } from './fixtures';

test.describe('todos', () => {
  test('[AC-1] a user can add a todo and sees it in the list', { tag: '@smoke' }, async ({ todoPage }) => {
    // Arrange
    const title = `Write the e2e suite ${crypto.randomUUID().slice(0, 8)}`;

    // Act
    await todoPage.add(title);

    // Assert
    await expect(todoPage.item(title)).toBeVisible();
    await expect(todoPage.newTodoInput).toHaveValue('');
  });

  test('[AC-2] completing a todo updates the remaining count', async ({ todoPage, seededTodo }) => {
    // Arrange — seededTodo was created through the API by the fixture
    await todoPage.page.reload();
    await expect(todoPage.item(seededTodo.title)).toBeVisible();

    // Act
    await test.step('complete the seeded todo', async () => {
      await todoPage.complete(seededTodo.title);
    });

    // Assert
    await expect.soft(todoPage.item(seededTodo.title).getByRole('checkbox', { name: 'Done' })).toBeChecked();
    await expect.soft(todoPage.status).toHaveText(/0 items left/);
  });

  test.describe('unproducible failures', () => {
    test('[AC-3] shows an error and keeps the input when saving fails', async ({ page, todoPage }) => {
      // Arrange — failure state: our own API answers POST /api/todos with 503.
      // Why it is faked: the API returns 503 only when its database is unreachable, and the
      // shared e2e back end cannot be taken down for one test without failing the tests
      // running in parallel. Only the POST is routed; every other request reaches the real API.
      await page.route('**/api/todos', (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({ status: 503, json: { data: null, error: 'Service unavailable' } })
          : route.fallback(),
      );

      // Act
      await todoPage.add('Will not be saved');

      // Assert — what the user sees, not the route
      await expect(page.getByRole('alert')).toHaveText('Could not save the todo. Try again.');
      await expect(todoPage.newTodoInput).toHaveValue('Will not be saved');
    });
  });

  test('[AC-7] the todo page has no WCAG A/AA violations', async ({ todoPage, makeAxeBuilder }, testInfo) => {
    await expect(todoPage.newTodoInput).toBeVisible();

    const results = await makeAxeBuilder().include('main').analyze();
    await testInfo.attach('accessibility-scan-results', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json',
    });

    expect(results.violations).toEqual([]);
  });
});
```

What it shows:

1. **Fixtures** deliver a navigated page object, seeded data (with cleanup) and the axe builder.
2. **Role-first locators** live in the page object; the spec reads as user actions.
3. **Web-first assertions** only — every UI check retries; nothing reads a value and compares it.
4. **API seeding** for the precondition, the UI for the behaviour.
5. **One route**, for a failure state that cannot be produced for real: it says why, sits in its own `describe` away from the happy paths, asserts what the user sees, and falls back to the real API for everything else (`test-doubles`).
6. **Evidence** — a named step, an attached scan; traces and screenshots come from the config.
7. **Unique data per test** so the suite runs fully parallel.

To see a new test fail first, change an expected literal (`'0 items left'` → `'9 items left'`), run it, and confirm the failure message and trace point at the right element.
