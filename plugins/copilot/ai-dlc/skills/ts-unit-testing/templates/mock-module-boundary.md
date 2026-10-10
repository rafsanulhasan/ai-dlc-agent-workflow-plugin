# mock-module-boundary

Some ports and boundaries are imported as modules instead of being injected: an SDK client, `node:fs`, your own module that calls the network. Replace such a module with `vi.mock` in a unit test. Use it only for a double `test-doubles` allows — never for a module of plain logic. For a module you own, prefer injecting the dependency, and report the missing seam if you cannot.

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendInvoice } from '../src/billing/send-invoice';
import { mailClient } from '../src/infrastructure/mail-client';
import { buildInvoice } from './builders/invoice';

vi.mock('../src/infrastructure/mail-client', () => ({
  mailClient: { send: vi.fn() },
}));

describe('sendInvoice', () => {
  beforeEach(() => {
    vi.mocked(mailClient.send).mockResolvedValue({ accepted: true });
  });

  it('emails the invoice to the billing contact', async () => {
    // Arrange
    const invoice = buildInvoice();

    // Act
    const result = await sendInvoice(invoice);

    // Assert
    expect(result).toEqual({ data: { sent: true }, error: null });
    expect(mailClient.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: invoice.billingContact }),
    );
  });
});
```

Notes:

- Put `vi.mock` at the top level of the file. Vitest hoists it above the imports, so its factory cannot use variables declared in the test file. When the factory needs a shared value, create it with `vi.hoisted(() => ...)`.
- To keep most of a module real and replace one export, use an async factory and spread the original: `vi.mock(path, async (importOriginal) => ({ ...(await importOriginal()), send: vi.fn() }))`.
- Reset mocks between tests so a configured return value cannot leak into the next test. Set `mockReset` or `restoreMocks` in the test config, or call `vi.resetAllMocks()` in `beforeEach`. Check what the repository's config already does, because the defaults differ between Vitest majors.
- Jest hoists `jest.mock` the same way. Under native ESM, Jest needs `jest.unstable_mockModule` plus a dynamic `import()` instead (see `references/jest-differences.md`).
