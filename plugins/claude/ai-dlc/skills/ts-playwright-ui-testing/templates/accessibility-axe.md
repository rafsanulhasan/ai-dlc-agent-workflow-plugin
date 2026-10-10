# accessibility-axe

Scan pages with axe-core. Install `@axe-core/playwright` as a dev dependency and expose the builder as a fixture (see `fixtures`) so every scan uses the same tags.

```ts
import { test, expect } from './fixtures';

test('[AC-7] the checkout page has no WCAG A/AA violations', async ({ page, makeAxeBuilder }, testInfo) => {
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();   // scan a rendered page

  const results = await makeAxeBuilder()
    .include('main')
    .exclude('#third-party-chat')
    .analyze();

  await testInfo.attach('accessibility-scan-results', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });

  expect(results.violations).toEqual([]);
});
```

```ts
// fixture (in e2e/fixtures.ts)
makeAxeBuilder: async ({ page }, use) => {
  await use(() => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']));
},
```

- Wait for the content to render before `analyze()`: a scan of a loading spinner proves nothing.
- `expect(results.violations).toEqual([])` prints each violation when it fails; do not reduce it to a count.
- Scan each meaningful state (dialog open, form with errors), not only the initial page.
- `.disableRules(['color-contrast'])` and `.exclude(...)` are exceptions to justify in a comment and track, not a way to turn the test green.
- An automated scan finds a subset of accessibility issues; it complements, not replaces, keyboard and screen-reader checks in the test plan.
