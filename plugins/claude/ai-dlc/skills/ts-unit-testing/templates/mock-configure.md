# mock-configure

```ts
// Fixed return value
vi.mocked(paymentGateway.charge).mockResolvedValue({ id: 'ch_1', status: 'succeeded' });

// One value per call, in order
vi.mocked(paymentGateway.charge)
  .mockResolvedValueOnce({ id: 'ch_1', status: 'declined' })
  .mockResolvedValueOnce({ id: 'ch_2', status: 'succeeded' });

// Boundary failure
vi.mocked(paymentGateway.charge).mockRejectedValue(new GatewayTimeoutError());

// Behaviour that depends on the argument: keep it to a one-line lookup
vi.mocked(userRepository.findById).mockImplementation(async (id) =>
  id === existing.id ? existing : null,
);
```

`vi.mocked(fn)` only narrows the TypeScript type. It does not create a mock. If a double needs branching beyond a one-line lookup, the boundary is probably too generic (see "Testable boundaries" in the write-tests reference `test-quality.md`). Report it instead of building a fake inside the test.
