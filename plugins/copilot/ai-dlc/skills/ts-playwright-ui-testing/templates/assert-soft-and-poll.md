# assert-soft-and-poll

**`expect.soft`** records a failure and lets the test continue, so one run shows every broken part of a screen:

```ts
await expect.soft(page.getByRole('heading', { name: 'Invoice INV-1042' })).toBeVisible();
await expect.soft(page.getByTestId('invoice-total')).toHaveText('$120.00');
await expect.soft(page.getByRole('row')).toHaveCount(4);
```

Use it for independent facts about one outcome. Keep a hard `expect` before any step that cannot work after a failure (for example, the navigation the rest of the test depends on).

**`expect.poll`** retries a non-locator check, such as an API call made by the test:

```ts
await expect
  .poll(async () => (await request.get(`/api/orders/${orderId}`)).json(), { timeout: 10_000 })
  .toEqual({ data: expect.objectContaining({ status: 'shipped' }), error: null });
```

**`toPass`** retries a block of steps until all of them pass:

```ts
await expect(async () => {
  const response = await page.request.get('/api/health');
  expect(response.status()).toBe(200);
}).toPass({ timeout: 30_000 });
```

Prefer a web-first assertion on the UI over polling an API: the test should check what the user sees.
