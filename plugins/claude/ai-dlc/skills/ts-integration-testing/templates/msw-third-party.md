# msw-third-party

MSW stands in for **third-party HTTP APIs** the app calls: a payment provider, an email service, another organisation's API you cannot run in a container. It is the *unowned boundary* double of `test-doubles`; your own database, cache and queues stay real.

MSW 3 (current major, ESM only):

```ts
// tests/integration/support/msw.ts
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw/http';

export const billingBaseUrl = 'https://billing.example.test';

export const mswServer = setupServer(
  http.post(`${billingBaseUrl}/v1/charges`, () =>
    HttpResponse.json({ id: 'ch_123', status: 'succeeded' }, { status: 201 }),
  ),
);
```

```ts
// tests/integration/setup-msw.ts — listed in the Vitest `setupFiles`
import { afterAll, afterEach, beforeAll } from 'vitest';
import { mswServer } from './support/msw';

beforeAll(() =>
  mswServer.listen({
    onUnhandledFrame({ frame, defaults }) {
      if (frame.protocol === 'http') {
        const { hostname } = new URL(frame.data.request.url);
        if (hostname === '127.0.0.1' || hostname === 'localhost') return; // the app and the containers
      }
      defaults.error();   // any other unmocked outbound call fails the test
    },
  }),
);
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());
```

Override a handler in one test for a failure path:

```ts
mswServer.use(
  http.post(`${billingBaseUrl}/v1/charges`, () =>
    HttpResponse.json({ error: 'card_declined' }, { status: 402 }),
  ),
);
```

**Why the callback:** MSW intercepts Node's `http` module and the global `fetch` for the whole process, including supertest's and your own `fetch` calls to the local app. A plain `'error'` would fail those. `inject` (Fastify) and `app.request` (Hono) never reach the network, so MSW does not see them.

MSW 2.x names the option `onUnhandledRequest` (callback `(request, print)`) and imports `http` / `HttpResponse` from `'msw'`. Match the major the repository already has.

Assert on what the app did with the third-party answer (its response, its stored state), not on the request MSW received, unless the outbound request *is* the contract (for example, the amount sent to the payment provider).
