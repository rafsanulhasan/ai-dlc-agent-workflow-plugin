# middleware-unit-test

A complete example that combines the conventions: Vitest, the real validator, framework doubles for `next` and the response, faker data, `fromPartial` for framework objects, Arrange/Act/Assert, and both sides of the result asserted.

```ts
import { faker } from '@faker-js/faker';
import { fromPartial } from '@total-typescript/shoehorn';
import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { requestValidation } from '../src/middleware/request-validation';
import { requiredHeaderValidator } from '../src/validation/required-header-validator';

faker.seed(1234);

function buildResponse(): Response {
  const response = fromPartial<Response>({});
  response.status = vi.fn().mockReturnValue(response);
  response.json = vi.fn().mockReturnValue(response);
  return response;
}

describe('requestValidation', () => {
  it('passes a valid request to the next handler', async () => {
    // Arrange — the validator is plain in-process logic, so it runs for real
    const validator = requiredHeaderValidator('x-request-id');
    const request = fromPartial<Request>({
      method: 'POST',
      path: '/api/users',
      headers: { 'x-request-id': faker.string.uuid() },
      body: { email: faker.internet.email() },
    });
    const response = buildResponse();
    const next: NextFunction = vi.fn();

    // Act
    await requestValidation(validator)(request, response, next);

    // Assert
    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it('responds 400 with an error result when the request is invalid', async () => {
    // Arrange — no x-request-id header, so the real validator rejects the request
    const validator = requiredHeaderValidator('x-request-id');
    const request = fromPartial<Request>({ method: 'POST', path: '/api/users', headers: {} });
    const response = buildResponse();
    const next: NextFunction = vi.fn();

    // Act
    await requestValidation(validator)(request, response, next);

    // Assert
    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ data: null, error: 'Missing required header' });
  });
});
```

`next`, `response.status` and `response.json` are the framework boundary. For a middleware, those calls **are** the observable behaviour, so asserting on them is correct here. The validator is plain in-process logic, so it runs for real rather than as a double (`test-doubles`).
