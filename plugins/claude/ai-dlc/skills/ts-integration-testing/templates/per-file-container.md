# per-file-container

Use a container per test file only when that file needs infrastructure the rest of the suite does not (a Redis for one module, a broker with special settings).

```ts
import { afterAll, beforeAll, describe, it } from 'vitest';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { createCache } from '../../src/cache/create-cache';

describe('rate limiter with a real Redis', () => {
  let redis: StartedRedisContainer;
  let cache: ReturnType<typeof createCache>;

  beforeAll(async () => {
    redis = await new RedisContainer('redis:7-alpine').start();
    cache = createCache({ url: redis.getConnectionUrl() });
  });

  afterAll(async () => {
    await cache.close();   // dispose in reverse order: client first,
    await redis.stop();    // container second
  });

  it('blocks the request after the limit is reached', async () => { /* ... */ });
});
```

Started containers are `AsyncDisposable`, so inside a single function `await using redis = await new RedisContainer(image).start();` stops the container automatically. Across hooks, keep the explicit `afterAll`.
