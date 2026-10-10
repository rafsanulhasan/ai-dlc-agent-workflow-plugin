# http-fetch-listening-server

Use a real listening server when the behaviour depends on the socket (streaming, keep-alive, WebSockets) or the framework has no in-process entry point.

```ts
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, expect, inject, it } from 'vitest';
import { buildApp } from '../../src/app';
import { billingBaseUrl } from './support/msw';

let sut: ReturnType<typeof buildApp>;
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  sut = buildApp({ databaseUrl: inject('databaseUrl'), billingBaseUrl });
  server = sut.app.listen(0);                    // port 0: any free port
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())));
  await sut.close();
});

it('streams the export as CSV', async () => {
  const response = await fetch(`${baseUrl}/api/todos/export`);

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('text/csv');
});
```

Never hard-code a port: parallel test files would collide.
