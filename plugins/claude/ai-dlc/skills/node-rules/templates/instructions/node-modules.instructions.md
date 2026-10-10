---
description: "TypeScript and JavaScript module, import and module-boundary conventions"
applyTo: "**/*.ts,**/*.tsx,**/*.mts,**/*.cts,**/*.js,**/*.jsx,**/*.mjs,**/*.cjs"
---

# Modules and Imports (TypeScript / JavaScript)

## Module system

- Follow the module system `package.json` declares: `"type": "module"` (or `.mjs` / `.mts`) is ESM; `"type": "commonjs"` or no `type` (or `.cjs` / `.cts`) is CommonJS. Write new code as ESM unless the package is CommonJS, and never mix `require` and `import` in one file.
- Import Node.js built-ins with the `node:` prefix (`import { readFile } from "node:fs/promises"`).
- Follow the import-specifier rules of the project's `moduleResolution`: under `NodeNext` / `Node16`, relative imports in TypeScript carry the emitted extension (`./user.js`); under `Bundler`, do what the existing code does.
- Use `import type` (or inline `type` modifiers) for imports used only as types when `verbatimModuleSyntax` is on or the existing code does so.
- Use the path aliases the project already defines (`tsconfig.json` `paths`, bundler aliases). Do not add new aliases.

## Module boundaries

- Treat each package or feature module as a deep module: a small public surface over a larger implementation. Its public surface is its entry points: the files at the module root, or the `exports` map in its `package.json`.
- Import another module only through its entry points. Never deep-import its internals (`../billing/lib/tax-table`, `@acme/billing/src/internal`).
- In a workspace (monorepo), import a sibling package by its package name, never by a relative path that climbs into another package.
- No circular imports. If two modules need each other, move the shared part into a third module.
- Respect the dependency direction the project already has (for example, domain code never imports UI or infrastructure code). If architecture tests or a `dependency-cruiser` config exist, keep them passing.

## Barrel files

- Do not add barrel files that re-export a whole folder (`export * from "./a"` for every file). They hide where code lives, slow down type-checking, tests and bundling, and invite cycles.
- Prefer several small entry points (`index.ts`, `client.ts`, `server.ts`) over one large barrel.
- Inside a module, import siblings directly, never through the module's own entry point.
- Leave an existing barrel in place when removing it is outside the task, but do not add wildcard re-exports to it.

## Side effects

- Importing a module must not perform I/O, start timers or mutate global state. Put that work in an explicit function the entry point calls.
