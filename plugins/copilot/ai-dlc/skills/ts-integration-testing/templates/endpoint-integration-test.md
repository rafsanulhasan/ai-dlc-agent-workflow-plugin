# endpoint-integration-test

```ts
// tests/integration/todos/create-todo.test.ts
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, inject, it } from 'vitest';
import { http, HttpResponse } from 'msw/http';
import { buildApp } from '../../../src/app';
import { createIsolatedSchema } from '../support/isolated-schema';
import { billingBaseUrl, mswServer } from '../support/msw';
import { buildCreateTodoRequest } from '../../support/builders/todo';

describe('POST /api/todos', () => {
  let isolated: Awaited<ReturnType<typeof createIsolatedSchema>>;
  let sut: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    isolated = await createIsolatedSchema(inject('databaseUrl'));
    sut = buildApp({
      databaseUrl: inject('databaseUrl'),
      dbSchema: isolated.schema,
      billingBaseUrl,
      clock: () => new Date('2026-01-15T09:00:00Z'),
    });
  });

  afterEach(async () => {
    await sut.close();
    await isolated.drop();
  });

  it('[AC-1] persists the todo and returns 201 with its location', async () => {
    // Arrange
    const payload = buildCreateTodoRequest({ dueDate: '2026-02-01T00:00:00.000Z' });

    // Act
    const created = await request(sut.app).post('/api/todos').send(payload);

    // Assert — the response
    expect.soft(created.status).toBe(201);
    expect.soft(created.headers.location).toMatch(/^\/api\/todos\//);
    expect(created.body).toEqual({
      data: {
        id: expect.any(String),
        title: payload.title,
        dueDate: '2026-02-01T00:00:00.000Z',
        createdAt: '2026-01-15T09:00:00.000Z',
        done: false,
      },
      error: null,
    });

    // Assert — the side effect, read back through the public API
    const fetched = await request(sut.app).get(created.headers.location);
    expect(fetched.body).toEqual(created.body);
  });

  it('[AC-2] returns 400 and a validation error when the title is empty', async () => {
    // Arrange
    const payload = buildCreateTodoRequest({ title: '' });

    // Act
    const response = await request(sut.app).post('/api/todos').send(payload);

    // Assert
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      data: null,
      error: expect.stringContaining('title'),
    });
  });

  it('[AC-4] returns 502 and stores nothing when the billing provider declines', async () => {
    // Arrange — the third-party API is the only double
    mswServer.use(
      http.post(`${billingBaseUrl}/v1/charges`, () =>
        HttpResponse.json({ error: 'card_declined' }, { status: 402 }),
      ),
    );
    const payload = buildCreateTodoRequest({ premium: true });

    // Act
    const response = await request(sut.app).post('/api/todos').send(payload);

    // Assert
    expect(response.status).toBe(502);
    expect(response.body).toEqual({ data: null, error: expect.stringContaining('billing') });

    const list = await request(sut.app).get('/api/todos');
    expect(list.body).toEqual({ data: [], error: null });
  });
});
```

Before trusting a new test, see it fail once: change the expected literal, or break the line in the handler it covers, and check it fails for the reason you expect.
