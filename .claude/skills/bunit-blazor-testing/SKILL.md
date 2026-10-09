---
name: bunit-blazor-testing
description: Comprehensive guidance for writing Blazor component tests using bUnit with TUnit as the test runner. Covers in-memory rendering, component parameters, cascading values, service mocking, event testing, semantic HTML assertions, and snapshot testing.
---

# bunit-blazor-testing

This skill guides the `sqa-engineer` to write Blazor component tests using **bUnit** — an in-memory Blazor component testing library — with **TUnit** as the test runner. bUnit renders Blazor components without a real browser, making tests fast and deterministic.

> **When to use:** Use this skill for testing Blazor components in isolation (unit/component tests). For full browser end-to-end tests of a Blazor app, use `tunit-playwright-ui-testing` instead.

---

## Phase 0 — Context Load (silent)

1. Read `CLAUDE.md` and project conventions.
2. Load memory: `Skill("manage-memory", args: "sqa-engineer")`.
3. Locate Blazor components under test.
4. Identify the test project (create `*.BlazorTests` if needed).

---

## Phase 1 — NuGet Setup

```xml
<PackageReference Include="bunit" Version="1.*" />
<PackageReference Include="TUnit" Version="*" />
<PackageReference Include="TUnit.Assertions" Version="*" />
<PackageReference Include="Bogus" Version="*" />
```

**Note:** bUnit ships a single `bunit` meta-package. It targets `net8.0` and `net9.0`; confirm compatibility with `net10.0` before pinning. If the project is on net10.0, you may need `<TargetFramework>net9.0</TargetFramework>` for the test project until bUnit releases net10.0 support, or use a preview build.

---

## Phase 2 — TestContext Setup

bUnit provides `Bunit.TestContext` which renders components in an in-memory Blazor host:

```csharp
using Bunit;
using TUnit.Core;

[TestClass]
public class WeatherCardComponentTests : IDisposable
{
    private readonly TestContext _ctx = new();

    [Test]
    [DisplayName("[AC-5] WeatherCard shows temperature in Celsius")]
    public async Task WeatherCard_WhenTemperatureProvided_ShowsCelsiusValue()
    {
        // Arrange
        IRenderedComponent<WeatherCard> cut = _ctx.RenderComponent<WeatherCard>(parameters => parameters
            .Add(p => p.TemperatureC, 22)
            .Add(p => p.Summary, "Warm"));

        // Act — component is already rendered

        // Assert
        cut.Find(".temperature").TextContent.Should().Contain("22");
    }

    public void Dispose() => _ctx.Dispose();
}
```

**Key types:**
- `TestContext` — the in-memory Blazor host. Always dispose it after the test class.
- `IRenderedComponent<TComponent>` — a rendered component handle.
- `cut` — "component under test" (standard bUnit convention).

---

## Phase 3 — Component Parameters

```csharp
// Typed parameters (preferred)
_ctx.RenderComponent<MyComponent>(parameters => parameters
    .Add(p => p.Title, "Hello")
    .Add(p => p.IsVisible, true)
    .Add(p => p.Items, new List<string> { "a", "b" })
    .Add(p => p.OnClick, EventCallback.Factory.Create(this, HandleClick)));

// Child content / RenderFragment
_ctx.RenderComponent<MyComponent>(parameters => parameters
    .AddChildContent("<p>Child content</p>"));
```

---

## Phase 4 — Service Mocking and DI

Register services in the bUnit TestContext's `Services` collection before rendering:

```csharp
// Register a real service
_ctx.Services.AddScoped<IWeatherService, WeatherService>();

// Register a mock (using TUnit.Mocks or hand-rolled)
WeatherServiceMock mockWeatherSvc = new();
_ctx.Services.AddScoped<IWeatherService>(_ => mockWeatherSvc);

// Register a Bogus-generated stub
_ctx.Services.AddSingleton(new FakeWeatherService(new Faker()));
```

**Pattern: full DI registration**

```csharp
_ctx.Services.AddSingleton<IConfiguration>(new ConfigurationBuilder().Build());
_ctx.Services.AddHttpClient();
// ...add anything the component's DI graph requires
```

---

## Phase 5 — Cascading Values

```csharp
_ctx.RenderComponent<MyComponent>(parameters => parameters
    .AddCascadingValue("ThemeName", "dark")
    .AddCascadingValue(new AppState { IsLoggedIn = true }));
```

---

## Phase 6 — Event Testing

Test user interactions by finding elements and triggering events:

```csharp
[Test]
public async Task SubmitButton_WhenClicked_CallsOnSubmitCallback()
{
    bool submitted = false;
    IRenderedComponent<ContactForm> cut = _ctx.RenderComponent<ContactForm>(parameters => parameters
        .Add(p => p.OnSubmit, EventCallback.Factory.Create(this, () => submitted = true)));

    // Act
    cut.Find("button[type=submit]").Click();

    // Assert
    await Assert.That(submitted).IsTrue();
}
```

**Common event helpers:**
- `.Click()` — mouse click
- `.Input(value)` — input event with value
- `.Change(value)` — change event
- `.KeyPress(key)` — keyboard event
- `cut.InvokeAsync(() => component.SomeMethod())` — trigger state changes

---

## Phase 7 — Semantic HTML Assertions

bUnit provides semantic HTML comparison that ignores whitespace and attribute order:

```csharp
// Assert markup matches expected HTML
cut.MarkupMatches("<div class=\"card\"><h1>Title</h1></div>");

// Assert element presence
cut.Find("h1").TextContent.Should().Be("Weather Forecast");

// Assert element count
cut.FindAll("li").Count.Should().Be(5);

// Assert element has CSS class
cut.Find(".alert").ClassList.Should().Contain("alert-danger");

// Assert element attribute
cut.Find("input").GetAttribute("disabled").Should().NotBeNull();
```

---

## Phase 8 — Snapshot Testing

For components where the full markup is the contract:

```csharp
[Test]
public void WeatherCard_RendersCorrectMarkup()
{
    IRenderedComponent<WeatherCard> cut = _ctx.RenderComponent<WeatherCard>(
        p => p.Add(c => c.Summary, "Mild"));

    // Saves snapshot on first run; asserts equality on subsequent runs
    cut.SaveSnapshot();
}
```

> Snapshots are saved to `__snapshots__/` next to the test file. Commit them to source control. Re-generate with `dotnet test -- bunit:updateSnapshots=true` when intentional markup changes are made.

---

## Phase 9 — TUnit-Specific Patterns

Since TUnit replaces xUnit/NUnit as the runner:

```csharp
// Use [TestClass] not [Fact] or [Test] on classes
// Use [Test] on methods (same as TUnit convention for other test types)
// Use TUnit.Assertions.Should for all assertions on bUnit output
// Use Assert.Multiple() to collect all failures

[Test]
public async Task MyComponent_RendersAllItems()
{
    IRenderedComponent<ItemList> cut = _ctx.RenderComponent<ItemList>(
        p => p.Add(c => c.Items, ["A", "B", "C"]));

    await Assert.Multiple(async () =>
    {
        await Assert.That(cut.FindAll("li")).HasCount().EqualTo(3);
        await Assert.That(cut.Find("li:first-child").TextContent).IsEqualTo("A");
    });
}
```

---

## Phase 10 — Running Tests

```bash
dotnet test --filter "FullyQualifiedName~BlazorTests"
```

---

## Best Practices

| Do | Don't |
|----|-------|
| Test one behavior per `[Test]` | Test multiple behaviors in one test |
| Use `cut.Find()` with semantic selectors | Use brittle positional selectors |
| Dispose `TestContext` after each test class | Leak the bUnit host |
| Register mocks in `_ctx.Services` | Use static/global mocks |
| Use `MarkupMatches()` for structural assertions | Use raw string equality on HTML |
| Trace each test to an AC | Write untargeted "just render it" tests |
