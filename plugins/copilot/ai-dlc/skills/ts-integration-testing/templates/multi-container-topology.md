# multi-container-topology

Containers that talk to each other share a Docker network and reach each other by alias. Tests on the host still use the mapped ports.

```ts
// tests/integration/global-setup.ts
import type { TestProject } from 'vitest/node';
import { GenericContainer, Network, Wait } from 'testcontainers';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

export default async function setup(project: TestProject) {
  const network = await new Network().start();

  const postgres = await new PostgreSqlContainer('postgres:16-alpine')
    .withNetwork(network)
    .withNetworkAliases('db')
    .start();

  const search = await new GenericContainer('ghcr.io/acme/search-service:2.3.1')
    .withNetwork(network)
    .withEnvironment({ DATABASE_URL: 'postgres://test:test@db:5432/test' })
    .withExposedPorts(8080)
    .withWaitStrategy(Wait.forHttp('/health', 8080))
    .start();

  project.provide('databaseUrl', postgres.getConnectionUri());
  project.provide('searchUrl', `http://${search.getHost()}:${search.getMappedPort(8080)}`);

  return async () => {
    await search.stop();     // reverse start order
    await postgres.stop();
    await network.stop();
  };
}
```

Always set a wait strategy on a generic container (`Wait.forHttp`, `Wait.forLogMessage`, `Wait.forHealthCheck`). Without one, tests race the service's startup.

Run a service in a container when your team owns it or it ships an image. Use MSW (`msw-third-party`) only for third-party APIs you cannot run.
