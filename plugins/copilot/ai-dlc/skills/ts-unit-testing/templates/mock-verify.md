# mock-verify

Assert on a call only when the call **is** the behaviour under test (`test-doubles`, *Forbidden doubles*). Otherwise assert on the unit's result.

```ts
// Called exactly once, with these arguments
expect(emailSender.send).toHaveBeenCalledTimes(1);
expect(emailSender.send).toHaveBeenCalledWith(user.email, expect.stringContaining('Welcome'));

// Never called
expect(paymentGateway.charge).not.toHaveBeenCalled();

// The argument of the first call, checked structurally
expect(vi.mocked(eventBus.publish).mock.calls[0][0]).toEqual({
  type: 'OrderPlaced',
  orderId: order.id,
});
```

`toHaveBeenCalledTimes(1)` works in both Vitest and Jest.
