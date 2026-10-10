# Required Dependency Rule

The counterpart of an inheritance / interface rule: every module of a kind must depend on a given module. Example: "every controller uses the shared base controller".

```js
// .dependency-cruiser.cjs — a top-level `required` list, next to `forbidden`
required: [
  {
    name: 'controllers-use-base-controller',
    comment: 'Controllers get error mapping and the { data, error } envelope from the base controller.',
    severity: 'error',
    module: { path: '\\.controller\\.ts$', pathNot: '^src/api/base-controller\\.ts$' },
    to: { path: '^src/api/base-controller\\.ts$' },
  },
],
```

`required` reads "each module matching `module` must depend on at least one module matching `to`".

For contracts the type checker can express, prefer the type checker: `class OrdersController implements Controller` or a `satisfies Handler<Request, Response>` fails `tsc` directly, and needs no rule.

**Key patterns:**

- `required` + `module` + `to` — a dependency that must exist.
- `implements` / `satisfies` — a shape that must hold, checked by `tsc`.
