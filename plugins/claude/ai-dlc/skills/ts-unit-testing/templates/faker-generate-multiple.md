# faker-generate-multiple

```ts
import { faker } from '@faker-js/faker';

const users = faker.helpers.multiple(() => buildUser(), { count: 5 });

const mixed = [
  ...faker.helpers.multiple(() => buildUser({ status: 'active' }), { count: 3 }),
  buildUser({ status: 'suspended' }),
];
```

Always pass `count` when the test asserts on how many items there are. Never rely on the helper's default count.
