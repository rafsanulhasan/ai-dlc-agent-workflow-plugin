# shoehorn-partial-data

In tests, pass partial objects to typed parameters with `@total-typescript/shoehorn` instead of `as` casts. **Use it in test code only.** Never import it from production code.

```bash
npm i -D @total-typescript/shoehorn
```

Why not `as`: a cast silences the compiler for the whole object, you must spell out the target type, and wrong-on-purpose data needs the double cast `as unknown as Type`.

## `as Type` → `fromPartial()`

The unit reads `request.body.id`; `Request` has twenty other members.

```ts
import { fromPartial } from '@total-typescript/shoehorn';

// Before: a cast that hides type errors
getUser({ body: { id: '123' } } as Request);

// After: partial data; the fields you do supply are still type-checked
getUser(fromPartial({ body: { id: '123' } }));
```

`fromPartial` infers the target type from where the value is used. If the value is not passed straight to a typed parameter, give the type explicitly: `fromPartial<Request>({ body: { id: '123' } })`.

## `as unknown as Type` → `fromAny()`

Intentionally wrong data, for validation and error-path tests:

```ts
import { fromAny } from '@total-typescript/shoehorn';

// Before
getUser({ body: { id: 123 } } as unknown as Request);

// After: wrong on purpose, and autocomplete still works
getUser(fromAny({ body: { id: 123 } }));
```

## When to use each

| Function | Use |
|---|---|
| `fromPartial()` | Partial data; the supplied fields still type-check |
| `fromAny()` | Intentionally wrong data (validation and error paths) |
| `fromExact()` | Full object required; a placeholder you can later swap for `fromPartial` |

## Migrating an existing suite

1. Find the casts: `grep -rnE " as (unknown as )?[A-Z]" --include="*.test.ts" --include="*.spec.ts" .`
2. Replace `as Type` with `fromPartial(...)` and `as unknown as Type` with `fromAny(...)`.
3. Add the imports from `@total-typescript/shoehorn`.
4. Run the type check (`npx tsc --noEmit`) and the tests.

A partial object is safe only when the unit reads nothing you left out. If the unit reads an omitted member, it gets `undefined`; that means the test should supply that field.
