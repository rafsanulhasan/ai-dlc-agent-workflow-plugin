# Naming Convention Rule

Two kinds of naming rule apply in JS / TS:

1. **File names by folder** — every file in a layer follows the layer's suffix. A file-walk test:

```ts
// tests/architecture/naming.test.ts
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const filesUnder = (dir: string) =>
  (readdirSync(dir, { recursive: true }) as string[])
    .map((file) => file.replaceAll('\\', '/'))
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'));

describe('naming conventions', () => {
  it('names every file in src/api/controllers *.controller.ts', () => {
    const wrong = filesUnder('src/api/controllers').filter(
      (file) => !file.endsWith('.controller.ts') && file !== 'index.ts',
    );

    expect(wrong).toEqual([]);
  });

  it('names every file in src/application/handlers *.handler.ts', () => {
    const wrong = filesUnder('src/application/handlers').filter(
      (file) => !file.endsWith('.handler.ts') && file !== 'index.ts',
    );

    expect(wrong).toEqual([]);
  });
});
```

2. **Identifier names** (types, classes, functions) — use `@typescript-eslint/naming-convention`, which already runs with the linter:

```js
// eslint.config.js — rules
'@typescript-eslint/naming-convention': [
  'error',
  { selector: 'typeLike', format: ['PascalCase'] },
  { selector: 'class', filter: { regex: 'Error$', match: false }, format: ['PascalCase'] },
  { selector: 'class', filter: { regex: 'Error$', match: true }, format: ['PascalCase'], suffix: ['Error'] },
],
```

Encode the conventions the repository already follows; do not import C# habits (an `I` prefix on interfaces is not idiomatic TypeScript unless the codebase already uses it).

**Key patterns:**

- File-walk test + `expect(wrong).toEqual([])` — suffix by folder.
- `@typescript-eslint/naming-convention` — identifier casing, prefixes and suffixes.
- Name-based **import** rules (only `*.repository.ts` may import the database driver) belong to dependency-cruiser: see `arch-standard-rules`.
