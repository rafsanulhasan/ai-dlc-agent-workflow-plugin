---
description: TypeScript and JavaScript async and error-handling conventions
paths: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts", "**/*.js", "**/*.jsx", "**/*.mjs", "**/*.cjs"]
---

# Async and Error Handling (TypeScript / JavaScript)

## Return shape

- Follow the error-return convention the project already uses, and keep each layer consistent:
  - If services or API handlers return a result object (for example `{ data, error }` or a `Result` type), return that shape for every expected failure and keep exceptions for bugs.
  - If the code throws and a central handler maps errors to responses, throw typed errors and let the handler map them.
  - Never mix both styles within one layer. When the project has no convention yet, ask before introducing one.
- API responses keep the project's response shape. Never expose stack traces or internal error details to clients.

## Promises

- Every promise is awaited, returned, or deliberately detached with `void` and a comment that says why. No floating promises.
- Use `async` / `await` rather than `.then()` chains in new code.
- Run independent work concurrently with `Promise.all`; use `Promise.allSettled` when partial failure is acceptable. Do not `await` inside a loop whose iterations are independent.
- Never pass an `async` function where the caller ignores the returned promise (`array.forEach(async …)`, event-emitter listeners, timers) unless it handles its own errors.
- Long-running I/O accepts an `AbortSignal` (or the cancellation mechanism the codebase uses) and has a timeout.

## Errors

- Throw `Error` instances or subclasses, never strings or plain objects. When rethrowing, keep the original as the cause: `throw new AppError("…", { cause: err })`.
- Catch variables are `unknown`: narrow with `instanceof` or a type guard before reading properties.
- Never swallow errors. A `catch` block recovers, converts the error into the project's result shape, or logs through the project logger and rethrows. No empty `catch`.
- Handle an error at the boundary that can act on it; do not wrap every call in `try` / `catch`.

## Resources

- Release resources (file handles, sockets, database connections, subscriptions) in `finally`, or with `await using` / `using` when the project's TypeScript and Node.js versions support explicit resource management.
