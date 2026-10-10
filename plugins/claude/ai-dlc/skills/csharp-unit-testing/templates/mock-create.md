# mock-create

Mock an owned I/O port (repository, gateway, clock or ID provider, message publisher) or an unowned boundary — never the SUT or plain in-process logic (`test-doubles`).

```csharp
// Call .Mock() on the interface — the result IS the interface, no .Object needed
IUserRepository mockUserRepository = IUserRepository.Mock();
```
