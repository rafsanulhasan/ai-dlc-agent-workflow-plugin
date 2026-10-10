# mock-configure

```csharp
// Wildcard matching — matches any argument value
mockUserRepository.GetByIdAsync(Any()).Returns((User?)null);

// Exact argument matching
mockUserRepository.GetByIdAsync(42).Returns(alice);
```
