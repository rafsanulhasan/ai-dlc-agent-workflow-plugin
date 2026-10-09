# middleware-unit-test

```csharp
namespace MyProduct.Tests;

[TestClass]
public class RequestValidationMiddlewareTests
{
    [Test]
    public async Task InvokeAsync_WithValidRequest_CallsNext()
    {
        // Arrange
        IRequestValidator mockValidator = IRequestValidator.Mock();
        mockValidator.ValidateAsync(Any()).Returns(new ValidationResult { IsValid = true });

        RequestDelegate mockNext = RequestDelegate.Mock();
        RequestValidationMiddleware middleware = new(mockNext, mockValidator);

        Faker<HttpRequest> requestFaker = new()
            .RuleFor(r => r.Method, "POST")
            .RuleFor(r => r.Path, "/api/users");

        HttpRequest request = requestFaker.Generate();
        DefaultHttpContext httpContext = new();
        httpContext.Request.CopyFrom(request);

        // Act
        await middleware.InvokeAsync(httpContext);

        // Assert
        using (Assert.Multiple())
        {
            mockValidator.ValidateAsync(Any()).WasCalled(Times.Once);
            mockNext.Invoke(Any<HttpContext>()).WasCalled(Times.Once);
        }
    }

    [Test]
    public async Task InvokeAsync_WithInvalidRequest_ReturnsErrorResponse()
    {
        // Arrange
        IRequestValidator mockValidator = IRequestValidator.Mock();
        mockValidator.ValidateAsync(Any()).Returns(new ValidationResult { IsValid = false, Error = "Missing required header" });

        RequestDelegate mockNext = RequestDelegate.Mock();
        RequestValidationMiddleware middleware = new(mockNext, mockValidator);

        HttpRequest request = new Faker<HttpRequest>()
            .RuleFor(r => r.Method, "POST")
            .Generate();

        DefaultHttpContext httpContext = new();
        httpContext.Request.CopyFrom(request);

        // Act
        await middleware.InvokeAsync(httpContext);

        // Assert
        using (Assert.Multiple())
        {
            mockValidator.ValidateAsync(Any()).WasCalled(Times.Once);
            mockNext.Invoke(Any<HttpContext>()).WasCalled(Times.Never);
            await httpContext.Response.StatusCode.Should().BeEqualTo(400);
        }
    }
}
```
