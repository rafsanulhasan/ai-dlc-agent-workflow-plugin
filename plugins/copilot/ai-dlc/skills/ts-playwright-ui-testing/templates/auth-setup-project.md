# auth-setup-project

Log in once in a `setup` project, save the browser state, and start every other test already authenticated.

```ts
// e2e/auth.setup.ts
import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate as the standard user', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.E2E_USER_EMAIL!);
  await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await page.context().storageState({ path: authFile });
});
```

In `playwright.config.ts` (see `playwright-config`):

```ts
projects: [
  { name: 'setup', testMatch: /.*\.setup\.ts/ },
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' },
    dependencies: ['setup'],
  },
],
```

- Wait for a signed-in signal (a heading, a user menu) before saving the state; otherwise the cookie may not be set yet.
- Credentials come from environment variables or CI secrets, never from the repository.
- `playwright/.auth` holds live session tokens: add it to `.gitignore`.
- A test that must start signed out overrides the state: `test.use({ storageState: { cookies: [], origins: [] } });`.
- Testing the login form itself is a separate test, not the setup project.
