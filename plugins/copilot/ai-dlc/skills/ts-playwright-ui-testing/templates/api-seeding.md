# api-seeding

Create the data a test needs through the app's API, not by clicking through the UI. The UI steps are reserved for the behaviour under test.

```ts
test('[AC-4] an overdue invoice is flagged on the dashboard', async ({ page, request }) => {
  // Arrange — seed through the API
  const response = await request.post('/api/invoices', {
    data: { customer: 'Acme Ltd', amount: 120, dueDate: '2026-01-01' },
  });
  await expect(response).toBeOK();
  expect(await response.json()).toEqual({
    data: expect.objectContaining({ id: expect.any(String), status: 'open' }),
    error: null,
  });
  const { data: invoice } = await response.json();

  // Act — the behaviour under test, through the UI
  await page.goto('/dashboard');

  // Assert
  await expect(
    page.getByRole('row').filter({ hasText: 'Acme Ltd' }).getByText('Overdue'),
  ).toBeVisible();
});
```

| Request context | Cookies | Use for |
|---|---|---|
| `request` fixture | Its own, separate from the page; relative paths resolve against `baseURL` | Seeding and cleanup in fixtures and tests |
| `page.request` | Shared with the page's browser context | Calls that must act as the signed-in user in the page |
| `request.newContext()` | Isolated, new | A second user, or an unauthenticated client |

- Assert the seed response (`toBeOK()`, and both sides of `{ data, error }` when the API returns that shape): a failed seed should fail at the seed, not three steps later.
- Make seeded data unique per test (`crypto.randomUUID()` in a name) so parallel workers never collide.
- Put repeated seeding in a fixture (see `fixtures`) with cleanup after `use`.
