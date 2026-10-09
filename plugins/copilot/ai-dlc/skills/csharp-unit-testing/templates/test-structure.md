# test-structure

```csharp
[Test]
public async Task HandleAsync_WithValidRequest_ReturnsData()
{
    // Arrange
    IUserRepository mockRepo = IUserRepository.Mock();
    User expectedUser = new Faker<User>()
        .RuleFor(u => u.Id, f => f.Random.Guid())
        .RuleFor(u => u.Name, f => f.Name.FullName())
        .Generate();
    mockRepo.GetByIdAsync(expectedUser.Id).Returns(expectedUser);

    GetUserHandler handler = new(mockRepo);

    // Act
    ApiResponse<UserDto> response = await handler.HandleAsync(new GetUserRequest { Id = expectedUser.Id });

    // Assert
    using (Assert.Multiple())
    {
        await response.Data.Should().NotBeNull();
        await response.Error.Should().BeNull();
        await response.Data!.Id.Should().BeEqualTo(expectedUser.Id);
        await response.Data!.Name.Should().BeEqualTo(expectedUser.Name);
    }
}
```
