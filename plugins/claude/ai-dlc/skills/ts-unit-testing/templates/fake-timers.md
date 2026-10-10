# fake-timers

The clock is controlled non-determinism (`test-doubles`). Control it; do not sleep.

```ts
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-15T09:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

it('expires a session after 30 minutes of inactivity', () => {
  // Arrange
  const session = startSession(buildUser());

  // Act
  vi.advanceTimersByTime(30 * 60 * 1000);

  // Assert
  expect(session.isActive()).toBe(false);
});
```

If the code takes the clock as a dependency (`now: () => Date`), pass a fixed function instead. That is simpler than fake timers and has no global state. Never wait on real time in a unit test.

Jest: `jest.useFakeTimers()`, `jest.setSystemTime(...)`, `jest.advanceTimersByTime(...)`, `jest.useRealTimers()`.
