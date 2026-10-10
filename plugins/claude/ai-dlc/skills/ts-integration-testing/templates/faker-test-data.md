# faker-test-data

```ts
// tests/support/builders/todo.ts
import { faker } from '@faker-js/faker';
import type { CreateTodoRequest } from '../../../src/todos/types';

export function buildCreateTodoRequest(overrides: Partial<CreateTodoRequest> = {}): CreateTodoRequest {
  return {
    title: faker.lorem.sentence(3),
    dueDate: faker.date.future().toISOString(),
    ownerEmail: faker.internet.email(),
    premium: false,
    ...overrides,
  };
}
```

```ts
const payload = buildCreateTodoRequest({ title: '' });   // the field the test is about is explicit
```

- Name the value the test depends on (`{ title: '' }`); let faker fill the rest.
- Expected values come from the payload you built or a hand-worked literal, never from re-running the code under test.
- When a failure must be reproducible, call `faker.seed(n)` in `beforeEach` and log the seed.
- Faker 10 is ESM only; `faker.name` is now `faker.person` and `faker.address` is `faker.location`.
- Seed state through the app's public API or its production repository, not raw SQL: the round trip is part of what you test.
