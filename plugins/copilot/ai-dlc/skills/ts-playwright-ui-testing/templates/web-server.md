# web-server

`webServer` starts the app before the tests and stops it afterwards.

```ts
webServer: [
  {
    command: 'npm run start:api',
    url: 'http://localhost:4000/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { DATABASE_URL: process.env.E2E_DATABASE_URL ?? '', NODE_ENV: 'test' },
    stdout: 'pipe',
    stderr: 'pipe',
  },
  {
    command: 'npm run preview',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    cwd: './web',
  },
],
```

- The server counts as ready when `url` answers 2xx, 3xx, 400, 401, 402 or 403. Point `url` at a health endpoint, not a page that needs data.
- `timeout` defaults to 60 000 ms; raise it for a cold build.
- `reuseExistingServer: !process.env.CI` lets you run against an app you already started locally, and always starts a fresh one in CI.
- An array starts several servers (API and front end).
- `stdout: 'pipe'` shows the server's output in the test log, which helps when the server dies during a run.
- Run against a production-like build (`build` + `preview` / `start`), not the dev server, unless the repository's existing setup does otherwise.
