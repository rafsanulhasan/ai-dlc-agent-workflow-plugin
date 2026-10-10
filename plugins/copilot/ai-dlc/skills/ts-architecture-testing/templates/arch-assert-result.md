# Asserting Results

Two ways to make the rules part of the quality gate.

**1. A script or CI step (simplest)** — the `err` reporter exits non-zero on any `error` violation:

```bash
npx depcruise src --config .dependency-cruiser.cjs --output-type err-long
```

**2. A test in the test suite** — run the CLI with the `json` reporter and assert on the violations, so the rules run with `npm test` and fail with a readable diff:

```ts
// tests/architecture/dependency-rules.test.ts
import { spawnSync } from 'node:child_process';
import { beforeAll, describe, expect, it } from 'vitest';

interface Violation {
  from: string;
  to: string;
  rule: { name: string; severity: 'error' | 'warn' | 'info' | 'ignore' };
}

let violations: Violation[];

beforeAll(() => {
  const run = spawnSync(
    'npx',
    ['depcruise', 'src', '--config', '.dependency-cruiser.cjs', '--output-type', 'json'],
    { encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 },
  );
  violations = JSON.parse(run.stdout).summary.violations;
}, 120_000);

const brokenBy = (ruleName: string) =>
  violations
    .filter((v) => v.rule.name === ruleName)
    .map((v) => `${v.from} -> ${v.to}`);

describe('dependency rules', () => {
  it('keeps the domain free of outer layers', () => {
    expect(brokenBy('domain-not-to-outer-layers')).toEqual([]);
  });
});
```

**Key patterns:**

1. **Map violations to `from -> to` strings** and compare with `[]`: the failure lists every offending edge.
2. **One `it` per rule** — the test name says which rule broke.
3. **`expect.soft`** when one test checks several rules and you want all of them reported:

   ```ts
   for (const rule of ['no-circular', 'not-to-dev-dep', 'domain-not-to-outer-layers']) {
     expect.soft(brokenBy(rule), rule).toEqual([]);
   }
   ```

4. **Never assert only on a count** (`toHaveLength(0)`) — it hides which files broke the rule.
