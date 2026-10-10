# Folder Residency Rule

The TypeScript counterpart of a namespace rule: files of a given kind must live in a given folder. Example: "every `*.controller.ts` lives under `src/api/`".

dependency-cruiser matches **dependencies**, so a forbidden rule keyed on the file's own path catches misplaced files that import something:

```js
// .dependency-cruiser.cjs — inside `forbidden`
{
  name: 'controllers-live-in-api',
  comment: 'HTTP controllers belong to the api layer.',
  severity: 'error',
  from: { path: '\\.controller\\.ts$', pathNot: '^src/api/' },
  to: {},   // an empty `to` matches any dependency
},
```

A misplaced file with **no** imports produces no dependency and slips through. To cover every file, add a plain test that walks the tree:

```ts
// tests/architecture/folder-residency.test.ts
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sourceFiles = (readdirSync('src', { recursive: true }) as string[])
  .map((file) => `src/${file.replaceAll('\\', '/')}`);

describe('folder residency', () => {
  it('keeps every controller under src/api', () => {
    const misplaced = sourceFiles.filter(
      (file) => file.endsWith('.controller.ts') && !file.startsWith('src/api/'),
    );

    expect(misplaced).toEqual([]);
  });

  it('keeps every repository under src/infrastructure', () => {
    const misplaced = sourceFiles.filter(
      (file) => file.endsWith('.repository.ts') && !file.startsWith('src/infrastructure/'),
    );

    expect(misplaced).toEqual([]);
  });
});
```

`expect(misplaced).toEqual([])` prints the offending paths when it fails; never reduce it to `toHaveLength(0)` or a boolean.

**Key patterns:**

- `from.path` with a suffix regex (`\\.controller\\.ts$`) — select files by naming convention.
- `from.pathNot` — the folder they must live in.
- A file-walk test for the zero-import case.
