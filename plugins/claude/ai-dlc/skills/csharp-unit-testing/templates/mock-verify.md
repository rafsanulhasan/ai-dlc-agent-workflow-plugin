# mock-verify

Verify a call only when the call **is** the behaviour under test — the event was published, the email was sent (`test-doubles`). Otherwise assert on the SUT's result.

```csharp
// Verify called exactly once with any argument
mockEventPublisher.PublishAsync(Any()).WasCalled(Times.Once);

// Verify called at least once with a specific argument
mockEventPublisher.PublishAsync(orderPlaced).WasCalled();

// Verify never called
mockNext.Invoke(Any<HttpContext>()).WasCalled(Times.Never);
```
