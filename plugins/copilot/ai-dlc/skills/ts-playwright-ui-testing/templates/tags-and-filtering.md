# tags-and-filtering

Tag tests to run subsets (smoke on every PR, the full suite nightly):

```ts
test('[AC-1] a visitor can sign up', { tag: '@smoke' }, async ({ page }) => { /* ... */ });

test.describe('billing', { tag: ['@billing', '@slow'] }, () => {
  test('refunds a paid invoice', async ({ page }) => { /* ... */ });
});
```

```bash
npx playwright test --grep @smoke                 # only smoke tests (-g)
npx playwright test --grep-invert @slow           # everything except slow tests (-G)
npx playwright test --project=chromium            # one project
npx playwright test --last-failed                 # rerun what failed last time
npx playwright test --only-changed=origin/main    # tests affected by changes since a ref
npx playwright test --repeat-each=20 e2e/cart.spec.ts   # hunt a flaky test
npx playwright test --ui                          # interactive UI mode
npx playwright test --headed                      # visible browser
npx playwright test --debug                       # step through with the inspector
```

- `--fail-on-flaky-tests` makes CI fail when a test passes only on retry.
- `--update-snapshots` (with `all`, `changed`, `missing` or `none`) refreshes screenshot and ARIA baselines; review the diff before committing.
- Never commit `test.only`: `forbidOnly: !!process.env.CI` in the config fails the CI run if one slips through.
