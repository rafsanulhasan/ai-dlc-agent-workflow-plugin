# middleware-unit-test

```csharp
namespace MyProduct.Tests;

[TestClass]
public class RequestValidationMiddlewareTests
{
    [Test]
    public async Task InvokeAsync_WithValidRequest_CallsNext()
    {
        // Arrange — the validator is plain in-process logic, so it runs for real;
        // next is the framework boundary, and calling it is the behaviour under test
        RequiredHeaderValidator validator = new("X-Request-Id");
        RequestDelegate mockNext = RequestDelegate.Mock();
        RequestValidationMiddleware middleware = new(mockNext, validator);

        DefaultHttpContext httpContext = new();
        httpContext.Request.Method = "POST";
        httpContext.Request.Path = "/api/users";
        httpContext.Request.Headers["X-Request-Id"] = "req-1";

        // Act
        await middleware.InvokeAsync(httpContext);

        // Assert
        mockNext.Invoke(Any<HttpContext>()).WasCalled(Times.Once);
    }

    [Test]
    public async Task InvokeAsync_WithInvalidRequest_ReturnsErrorResponse()
    {
        // Arrange — the request has no X-Request-Id header, so the real validator rejects it
        RequiredHeaderValidator validator = new("X-Request-Id");
        RequestDelegate mockNext = RequestDelegate.Mock();
        RequestValidationMiddleware middleware = new(mockNext, validator);

        DefaultHttpContext httpContext = new();
        httpContext.Request.Method = "POST";
        httpContext.Request.Path = "/api/users";

        // Act
        await middleware.InvokeAsync(httpContext);

        // Assert
        using (Assert.Multiple())
        {
            mockNext.Invoke(Any<HttpContext>()).WasCalled(Times.Never);
            await httpContext.Response.StatusCode.Should().BeEqualTo(400);
        }
    }
}
```
