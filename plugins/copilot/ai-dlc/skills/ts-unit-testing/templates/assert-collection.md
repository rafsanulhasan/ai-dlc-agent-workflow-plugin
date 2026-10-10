# assert-collection

```ts
expect(result.items).toHaveLength(3);
expect(result.items).toContainEqual(expect.objectContaining({ status: 'active' }));
expect(result.items.every((item) => item.createdAt <= now)).toBe(true);
expect(result.items.map((item) => item.id)).toEqual([first.id, second.id, third.id]);
```

Assert order only when the order is part of the behaviour (sorting, pagination). Otherwise compare against `expect.arrayContaining([...])` together with `toHaveLength`.
