# clock

Control time in the browser instead of waiting for it.

**A fixed "now"** — for dates shown on screen (preferred when timers must keep running):

```ts
await page.clock.setFixedTime(new Date('2026-03-01T10:00:00Z'));
await page.goto('/invoices');

await expect(page.getByRole('row').filter({ hasText: 'INV-1042' })).toContainText('Overdue');
```

**A controllable clock** — for timeouts, intervals and session expiry. Install it **before** `goto`:

```ts
await page.clock.install({ time: new Date('2026-03-01T10:00:00Z') });
await page.goto('/editor');

await page.clock.fastForward('05:00');   // jump 5 minutes, firing due timers once
await expect(page.getByRole('status')).toHaveText('Draft saved');

await page.clock.runFor(30_000);          // advance 30 s, running every timer in between
await page.clock.pauseAt(new Date('2026-03-01T11:00:00Z'));
await expect(page.getByRole('dialog', { name: 'Session expired' })).toBeVisible();
await page.clock.resume();
```

- Never wait with `page.waitForTimeout()` to let time pass; it is slow and still flaky.
- The browser clock does not change the server's clock. For server-side time (expiry computed by the API), seed data with the dates you need, or start the app with a configurable clock.
