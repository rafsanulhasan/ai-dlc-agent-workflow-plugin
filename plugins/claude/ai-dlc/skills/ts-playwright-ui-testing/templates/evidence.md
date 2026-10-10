# evidence

Every failure should leave enough behind to diagnose it without rerunning.

**Automatic artifacts** (in `use`, see `playwright-config`):

| Option | Recommended | Values |
|---|---|---|
| `trace` | `'on-first-retry'` (or `'retain-on-failure'` when retries are 0) | `'off'`, `'on'`, `'on-first-retry'`, `'on-all-retries'`, `'retain-on-failure'`, `'retain-on-first-failure'`, `'retain-on-failure-and-retries'` |
| `screenshot` | `'only-on-failure'` | `'off'`, `'on'`, `'only-on-failure'`, `'on-first-failure'` |
| `video` | `'retain-on-failure'` | same values as `trace` |

**Steps** — group actions into named steps; the report and trace show them as a tree:

```ts
test('[AC-2] a customer can pay for the cart', async ({ page }) => {
  await test.step('add two items to the cart', async () => {
    /* ... */
  });

  const orderId = await test.step('pay with the test card', async () => {
    /* ... */
    return page.getByTestId('order-id').innerText();
  });

  await test.step('see the confirmation', async () => {
    await expect(page.getByRole('heading', { name: `Order ${orderId} confirmed` })).toBeVisible();
  });
});
```

`test.step` returns the callback's value. Options: `{ box: true }` reports a failure at the step's call site, `{ timeout }` bounds the step.

**Attachments** — add evidence the trace does not hold:

```ts
test('exports the report', async ({ page }, testInfo) => {
  const download = await page.waitForEvent('download');
  const path = testInfo.outputPath('report.csv');
  await download.saveAs(path);

  await testInfo.attach('exported report', { path, contentType: 'text/csv' });
  await testInfo.attach('server state', {
    body: JSON.stringify(await (await page.request.get('/api/debug/state')).json(), null, 2),
    contentType: 'application/json',
  });
});
```

**Viewing** — `npx playwright show-report` opens the HTML report; `npx playwright show-trace test-results/<test>/trace.zip` opens a trace (actions, DOM snapshots, network, console).

In CI, upload `playwright-report/` (or the merged report) and `test-results/` as artifacts even when the job fails (`if: ${{ !cancelled() }}`).
