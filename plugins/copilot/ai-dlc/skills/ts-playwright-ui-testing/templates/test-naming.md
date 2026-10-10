# test-naming

`test.describe` names the feature or page; `test` states what the user does and what they see, as a sentence. Prefix with the AC ID when the test traces to a numbered acceptance criterion.

```ts
test.describe('checkout', () => {
  test('[AC-2] a customer can pay for the cart with a saved card', async ({ page }) => { /* ... */ });

  test('[AC-3] a declined card shows an error and keeps the cart', async ({ page }) => { /* ... */ });
});
```

- Name the behaviour, not the mechanism: "a declined card shows an error", not "clicks pay and checks alert div".
- Every end-to-end test should trace to an AC or a named user journey; an untargeted UI test is expensive and rarely read.
- If the repository already uses another naming shape, keep it: consistency with existing tests wins.
