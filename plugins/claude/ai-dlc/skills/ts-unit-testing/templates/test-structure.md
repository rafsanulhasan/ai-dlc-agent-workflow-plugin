# test-structure

```ts
import { describe, expect, it, vi } from 'vitest';
import { GetUserHandler } from '../src/users/get-user-handler';
import type { UserRepository } from '../src/users/user-repository';
import { buildUser } from './builders/user';

describe('GetUserHandler.handle', () => {
  it('returns the user when it exists', async () => {
    // Arrange
    const user = buildUser();
    const repository: UserRepository = {
      findById: vi.fn().mockResolvedValue(user),
    };
    const handler = new GetUserHandler(repository);

    // Act
    const result = await handler.handle({ id: user.id });

    // Assert
    expect(result).toEqual({
      data: { id: user.id, name: user.name },
      error: null,
    });
  });
});
```

`UserRepository` is the persistence boundary the handler receives through its constructor, so a test double for it is allowed. The assertion is on the handler's outcome, not on how it called the repository.
