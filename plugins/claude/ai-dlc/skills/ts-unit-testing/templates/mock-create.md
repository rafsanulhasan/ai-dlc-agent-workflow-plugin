# mock-create

Create a typed test double for an owned I/O port (repository, gateway, clock or ID provider, publisher) or an unowned boundary that the unit receives through its constructor or parameters. Never double the unit under test or plain in-process logic (`test-doubles`). Type the double as the boundary's interface, so the compiler flags any drift from the real contract.

```ts
import { vi } from 'vitest';
import type { PaymentGateway } from '../src/payments/payment-gateway';

const paymentGateway: PaymentGateway = {
  charge: vi.fn(),
  refund: vi.fn(),
};
```

For a single function dependency, give `vi.fn` the function type:

```ts
const sendEmail = vi.fn<(to: string, body: string) => Promise<void>>();
```

When the boundary has many members and the test uses only one, build it with `fromPartial` (see `shoehorn-partial-data`). Do not stub every member, and do not cast with `as`.

Jest: import `jest` from `@jest/globals` and use `jest.fn<(to: string, body: string) => Promise<void>>()`.
