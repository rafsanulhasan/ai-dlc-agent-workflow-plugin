# playwright-config

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,          // a stray test.only fails CI
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  outputDir: 'test-results',
  reporter: process.env.CI
    ? [['blob'], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : [['list'], ['html', { open: 'never' }]],
  expect: { timeout: 5_000 },            // web-first assertion retry window
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], storageState: 'playwright/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run start:test',
    url: `${baseURL}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- `forbidOnly`, `retries` and `workers` follow the CI / local split Playwright generates.
- Use the `blob` reporter when CI shards the run (see `sharding-ci`); merge the blobs into one HTML report afterwards.
- Keep `retries` low and treat a test that passes only on retry as flaky (`--fail-on-flaky-tests` makes CI fail on it).
- Add `playwright/.auth`, `test-results`, `playwright-report` and `blob-report` to `.gitignore`.
