# mock-argument-matching

Asymmetric matchers work inside `toHaveBeenCalledWith`, `toEqual` and `toMatchObject` (Vitest and Jest alike):

```ts
expect.anything()                           // any value except null or undefined
expect.any(String)                          // any instance of this constructor (String, Number, Date, a class)
expect.stringContaining('failed')           // substring
expect.stringMatching(/^ord_/)              // RegExp
expect.objectContaining({ status: 'paid' }) // subset of properties
expect.arrayContaining([itemA, itemB])      // subset of elements, in any order
```

Use the most specific matcher that still lets the test survive a refactor. A test that uses `expect.anything()` everywhere asserts nothing.
