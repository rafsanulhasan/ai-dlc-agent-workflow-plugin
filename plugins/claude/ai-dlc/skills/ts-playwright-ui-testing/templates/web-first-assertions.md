# web-first-assertions

Web-first assertions retry until the condition holds or `expect.timeout` (5 s by default) runs out. Always `await` them.

```ts
await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
await expect(page.getByRole('status')).toHaveText('3 items left');
await expect(page.getByRole('alert')).toContainText('Card declined');
await expect(page.getByRole('listitem')).toHaveCount(3);
await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+$/);
await expect(page).toHaveTitle('Orders — Acme');
await expect(page.getByRole('button', { name: 'Pay' })).toBeDisabled();
await expect(page.getByTestId('cart-badge')).toHaveAccessibleName('3 items in cart');
await expect(page.getByRole('list', { name: 'Todos' })).toMatchAriaSnapshot(`
  - list "Todos":
    - listitem: Buy milk
    - listitem: Write tests
`);
```

**Never** read a value and assert on it with a plain matcher — it does not retry and races the UI:

```ts
// Wrong: no retry; passes or fails depending on timing
expect(await page.getByRole('status').textContent()).toBe('3 items left');
expect(await page.getByRole('alert').isVisible()).toBe(true);

// Right
await expect(page.getByRole('status')).toHaveText('3 items left');
```

Expected values are literals from the acceptance criterion or the data the test seeded, never values read back from the page.

Visual comparison, when the AC is about appearance: `await expect(page).toHaveScreenshot('checkout.png', { maxDiffPixels: 100 });`. Inspect the first baseline image before committing it; update baselines with `--update-snapshots` only when the change is intended.
