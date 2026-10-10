# http-supertest

Works with any framework that exposes a Node request listener or an `http.Server`: Express, Koa (`app.callback()`), Fastify (`app.server`), NestJS (`app.getHttpServer()`).

```ts
import request from 'supertest';

const response = await request(sut.app)
  .post('/api/todos')
  .set('Accept', 'application/json')
  .send(payload);

expect(response.status).toBe(201);
```

supertest starts an app that is not yet listening on an ephemeral port and closes that server when the request finishes. It never closes a server you pass in already listening; close that one yourself.

Fastify: `await app.ready()` first, then `request(app.server)`.

Assert on `response.status` and `response.body` with `expect` rather than chaining `.expect(201)`: one structural assertion shows the whole difference when it fails.
