# assert-simple

```ts
expect(result).not.toBeNull();
expect(result.id).toBe(expectedId);          // Object.is equality — primitives and references
expect(result.name).toMatch(/^Test/);
expect(result.tags).toEqual(['a', 'b']);     // recursive structural equality
expect(result).toStrictEqual(expected);      // also checks undefined properties, sparse arrays and class types
expect(result.total).toBeCloseTo(10.3, 2);   // floating point
```

Prefer `toEqual` / `toStrictEqual` on the whole value over several property checks: one failure message shows the full diff.
