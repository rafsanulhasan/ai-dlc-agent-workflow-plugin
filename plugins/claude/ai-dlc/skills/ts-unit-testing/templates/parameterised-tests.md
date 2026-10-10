# parameterised-tests

The edge cases in the test plan become the rows of one table-driven test. Object rows keep each case readable, and `$name` placeholders put the row's values into the test name.

```ts
it.each([
  { total: 0, expected: 'standard' },
  { total: 49.99, expected: 'standard' },
  { total: 50, expected: 'free' },        // boundary: free shipping starts at 50
])('charges $expected shipping for a $total order', ({ total, expected }) => {
  // Act
  const tier = shippingTier(total);

  // Assert
  expect(tier).toBe(expected);
});
```

Each row needs an expected value known independently of the code. Never derive `expected` from `total` with the same rule the code uses. Boundary rows (here, 49.99 and 50) are what kill the `>` / `>=` mutants in `ts-mutation-testing`.

Jest supports the same `it.each([...])` form with object rows and `$name` placeholders.
