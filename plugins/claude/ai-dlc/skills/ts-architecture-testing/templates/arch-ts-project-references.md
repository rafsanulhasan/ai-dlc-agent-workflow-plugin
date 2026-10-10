# Alternative: TypeScript Project References

Make each layer its own TypeScript project; the reference graph becomes the allowed dependency graph, enforced by the compiler.

```text
src/domain/tsconfig.json          (no references)
src/application/tsconfig.json     references: domain
src/infrastructure/tsconfig.json  references: domain, application
src/api/tsconfig.json             references: domain, application
tsconfig.json                     files: [], references: all four
```

```json
// src/application/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "../../dist/application"
  },
  "include": ["**/*.ts"],
  "references": [{ "path": "../domain" }]
}
```

```bash
npx tsc --build      # or tsc -b; builds projects in dependency order
```

How it enforces direction: a `composite` project must list all its files. If `application` imports a file from `infrastructure` without referencing it, that file is pulled into `application`'s program and `tsc` fails with TS6307 ("File ... is not listed within the file list of project ..."). Adding the reference is the explicit, reviewable act of allowing the dependency.

Limits:

- Coarse: one rule per project, no `pathNot` exceptions, no file-level rules.
- Imports through a workspace **package name** (resolved via `node_modules`) are not caught this way; in a monorepo, combine with dependency-cruiser.
- Worth it when the repository already builds with `tsc -b`; adding project references only for architecture rules costs more than a dependency-cruiser config.
