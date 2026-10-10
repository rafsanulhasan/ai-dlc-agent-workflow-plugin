---
description: TypeScript and JavaScript coding style conventions
paths: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts", "**/*.js", "**/*.jsx", "**/*.mjs", "**/*.cjs"]
---

# Coding Style (TypeScript / JavaScript)

## Tooling the repository already has

- Format and lint with the repository's own configuration (ESLint, Prettier, Biome, or whatever the `package.json` scripts run). Never add a second formatter or linter, never replace the existing configuration, and never reformat code you did not otherwise change.
- Do not disable a lint rule inline (`eslint-disable`, `biome-ignore`) without a comment that says why.
- If the repository has no formatter or linter, match the style of the surrounding code and do not install one unasked.

## Type safety

- TypeScript runs with `"strict": true`. Never weaken compiler options (`strict`, `noImplicitAny`, `strictNullChecks`, adding `skipLibCheck`) to make code compile. A new `tsconfig*.json` starts from `"strict": true`.
- No `any`: not as a type, not as `as any`, not as an implicit parameter type. Use `unknown` and narrow it, a generic, or a precise type.
- No non-null assertions (`value!`) to silence the compiler; handle the `undefined` case.
- No `@ts-ignore`. When a suppression is unavoidable, use `// @ts-expect-error <reason>`.
- Validate data that crosses a trust boundary (HTTP bodies, environment variables, files, `JSON.parse` results) at the boundary, with the validation library the project already uses; inside the boundary, rely on the types.
- Plain JavaScript follows the same rules where they apply. If the repository type-checks JavaScript (`checkJs` or `// @ts-check`), keep JSDoc types accurate.

## Language

- ES modules (`import` / `export`) for new code; see the modules rule. `const` by default, `let` only when reassigned, never `var`.
- `===` and `!==`, except `== null` where the codebase already uses it to test for `null` or `undefined`.
- Prefer named exports. Use a default export only where a framework or tool requires one (route files, config files).

## Naming

- `camelCase` for variables, functions and methods; `PascalCase` for classes, types, interfaces, enums and components; `UPPER_SNAKE_CASE` only for module-level values that are true constants.
- No `I` prefix on interfaces and no `T` prefix on type aliases unless the codebase already uses one.
- File names follow the repository's existing convention (kebab-case when there is none).

## Output

- Use the project's logger; never leave `console.log` in production code. `console` is fine in CLI entry points that print to the user and in build scripts.
- Never expose stack traces or internal error details to clients.
