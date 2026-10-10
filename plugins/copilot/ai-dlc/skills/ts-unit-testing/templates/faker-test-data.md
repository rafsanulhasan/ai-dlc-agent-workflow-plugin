# faker-test-data

Wrap faker in a **builder** for each domain type. The builder supplies realistic defaults and takes overrides for the fields the test is about, so each test states only what matters to its scenario.

```ts
// tests/builders/user.ts
import { faker } from '@faker-js/faker';
import type { User } from '../../src/users/user';

export function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    status: 'active',
    createdAt: faker.date.past(),
    ...overrides,
  };
}
```

```ts
const user = buildUser();                              // all defaults
const suspended = buildUser({ status: 'suspended' });  // the field under test is explicit
```

**Seed faker.** Unit tests must be deterministic (`.claude/rules/node-testing.md`). Seed faker once per test file, or in a setup file the test config loads, so a failure reproduces:

```ts
import { faker } from '@faker-js/faker';

faker.seed(Number(process.env.FAKER_SEED ?? 1234));
```

Never compute the expected value from the generated data the same way the code does; that is a tautology. Either read the field back from the built object (`user.name`) and compare against it, or override the field with a literal and assert that literal.
