---
name: tunit-playwright-ui-testing
description: Comprehensive guidance for writing coded end-to-end UI tests in C# using TUnit.Playwright. Tests inherit from PageTest — the base class manages all browser lifecycle. Covers NuGet setup, PageTest inheritance, Page Object Model, browser configuration, parallelism limiting, and CI integration. Based on the official TUnit docs at https://tunit.dev/docs/examples/playwright.
---

# tunit-playwright-ui-testing

This skill guides the `sqa-engineer` to write coded, repeatable UI tests in C# for web applications in AI-DLC Agent Workflow using **TUnit.Playwright** — where tests inherit from `PageTest` and the base class manages browser lifecycle automatically.

> **Source:** Official TUnit docs — https://tunit.dev/docs/examples/playwright

> **When to use:** Use this skill for end-to-end tests that must be committed as `.cs` test files and run in CI via `dotnet test`. For one-time AI-driven exploratory browser tests (no `.cs` files), use `playwright-mcp-ui-testing` instead. For Blazor component-level tests, use `bunit-blazor-testing`.

---

## Phase 0 — Context Load (silent)

1. Read `CLAUDE.md` and project conventions.
2. Load memory: `Skill("manage-memory", args: "sqa-engineer")`.
3. Identify the test project that will host Playwright tests. Create a new `*.PlaywrightTests` csproj if one doesn't exist.
4. Read the spec file at `docs/specs/<feature-slug>.spec.md` if it exists.

---

## Phase 1 — NuGet Setup

Add to `Directory.Packages.props` (if not already present):

```xml
<PackageReference Include="TUnit.Playwright" Version="*" />
```

Add to the Playwright test project's `.csproj`:

```xml
<PackageReference Include="TUnit.Playwright" />
```

Run Playwright browser install after building:

```bash
# Windows (PowerShell):
pwsh bin/Debug/net10.0/playwright.ps1 install chromium

# macOS/Linux:
./bin/Debug/net10.0/playwright.sh install chromium
```

> `TUnit.Playwright` transitively brings in `Microsoft.Playwright`. No need to reference `Microsoft.Playwright` directly.

---

## Phase 2 — Simplest Possible Test (PageTest)

By inheriting from `PageTest`, the base class sets up and disposes all Playwright objects. The following properties are available in every test:

| Property | Type | Description |
|----------|------|-------------|
| `Page` | `IPage` | The current browser page (tab) |
| `Context` | `IBrowserContext` | The browser context |
| `Browser` | `IBrowser` | The browser instance |
| `Playwright` | `IPlaywright` | The Playwright instance |

**Minimal test:**

```csharp
using TUnit.Playwright;

public class Tests : PageTest
{
    [Test]
    public async Task NavigatesToGitHub()
    {
        await Page.GotoAsync("https://www.github.com/thomhurst/TUnit");
    }
}
```

No setup code needed. No fixture classes. No `ClassDataSource`. Just inherit and write tests.

---

## Phase 3 — Real Page Interaction Tests

```csharp
using TUnit.Core;
using TUnit.Assertions;
using TUnit.Assertions.Extensions;
using TUnit.Playwright;

public class LoginPageTests : PageTest
{
    [Test]
    [DisplayName("[AC-1] Login button is visible on the login page")]
    public async Task Login_Button_Is_Visible()
    {
        await Page.GotoAsync("https://example.com/login");
        ILocator loginButton = Page.Locator("button#login");
        await Assert.That(await loginButton.IsVisibleAsync()).IsTrue();
    }

    [Test]
    [DisplayName("[AC-2] Successful login redirects to dashboard")]
    public async Task Successful_Login_Redirects_To_Dashboard()
    {
        await Page.GotoAsync("https://example.com/login");
        await Page.FillAsync("#username", "testuser");
        await Page.FillAsync("#password", "password123");
        await Page.ClickAsync("button#login");
        await Page.WaitForURLAsync("**/dashboard");
        string? heading = await Page.Locator("h1").TextContentAsync();
        await Assert.That(heading).IsEqualTo("Dashboard");
    }
}
```

---

## Phase 4 — Configuring Browser Options

Override `BrowserName` and pass `BrowserTypeLaunchOptions` to the base constructor:

```csharp
using Microsoft.Playwright;
using TUnit.Playwright;

public class HeadlessChromeTests : PageTest
{
    public HeadlessChromeTests() : base(new BrowserTypeLaunchOptions
    {
        Headless = Environment.GetEnvironmentVariable("PLAYWRIGHT_HEADLESS") != "false",
        SlowMo = 0  // set to 100 for debugging — adds 100ms delay between actions
    }) { }

    public override string BrowserName => "chromium";  // chromium | firefox | webkit

    [Test]
    public async Task Page_Title_Matches()
    {
        await Page.GotoAsync("https://example.com");
        string title = await Page.TitleAsync();
        await Assert.That(title).Contains("Example");
    }
}
```

**Browser options:**
- `BrowserName` values: `"chromium"` (default), `"firefox"`, `"webkit"`
- `Headless = true` for CI; read from env var for local flexibility
- `SlowMo` — milliseconds to add between Playwright actions (useful for debugging)

---

## Phase 5 — Page Object Model

Keep pages assertion-free. Page Objects return data; tests assert on it.

```csharp
public class WeatherPage(IPage page)
{
    private const string Url = "http://localhost:5000/weather";

    public async Task NavigateAsync()
        => await page.GotoAsync(Url);

    public async Task<IReadOnlyList<ILocator>> GetForecastRowsAsync()
        => await page.Locator("table tbody tr").AllAsync();

    public async Task<string?> GetTitleAsync()
        => await page.TitleAsync();
}

public class WeatherPageTests : PageTest
{
    [Test]
    [DisplayName("[AC-3] Weather page shows forecast rows")]
    public async Task WeatherPage_WhenLoaded_ShowsForecastRows()
    {
        WeatherPage weatherPage = new(Page);

        // Arrange + Act
        await weatherPage.NavigateAsync();
        IReadOnlyList<ILocator> rows = await weatherPage.GetForecastRowsAsync();

        // Assert
        await Assert.That(rows.Count).IsGreaterThan(0);
    }
}
```

**Page Object rules:**
- One class per page or major component.
- No assertions inside page objects — they return data; tests assert.
- Use `Locator` over `QuerySelector` — locators are lazy and auto-retry.
- Prefer `GetByRole`, `GetByLabel`, `GetByText`, `GetByTestId` over CSS selectors.

---

## Phase 6 — Controlling Parallelism

Browser tests are resource-intensive. Use `[ParallelLimiter<T>]` to cap concurrency:

```csharp
using TUnit.Core;
using TUnit.Playwright;

public class BrowserParallelLimit : IParallelLimit
{
    public int Limit => 2;  // at most 2 browser tests run at once
}

[ParallelLimiter<BrowserParallelLimit>]
public class HeavyBrowserTests : PageTest
{
    [Test]
    public async Task Test_A()
    {
        await Page.GotoAsync("https://example.com/a");
        await Assert.That(await Page.TitleAsync()).IsNotNull();
    }

    [Test]
    public async Task Test_B()
    {
        await Page.GotoAsync("https://example.com/b");
        await Assert.That(await Page.TitleAsync()).IsNotNull();
    }
}
```

---

## Phase 7 — Async Patterns

```csharp
// ✅ Always await Playwright calls
await Page.GotoAsync(url);
await Page.ClickAsync("button[type=submit]");
ILocator input = Page.GetByLabel("Email");
await input.FillAsync("user@example.com");

// ✅ Use locators with built-in retry and wait
ILocator successMsg = Page.GetByText("Order confirmed");
await successMsg.WaitForAsync(new LocatorWaitForOptions { Timeout = 5000 });

// ❌ Never use .Result / .Wait() — deadlocks in async context
Page.GotoAsync(url).Result;

// ❌ Never use Thread.Sleep
Thread.Sleep(2000);
```

---

## Phase 8 — Running Tests

```bash
# Run only Playwright tests
dotnet test --filter "FullyQualifiedName~PlaywrightTests"

# Run in headed mode (visible browser window) for local debugging:
# Windows PowerShell:
$env:PLAYWRIGHT_HEADLESS="false"; dotnet test --filter "FullyQualifiedName~PlaywrightTests"
# macOS/Linux:
PLAYWRIGHT_HEADLESS=false dotnet test --filter "FullyQualifiedName~PlaywrightTests"
```

---

## Phase 9 — CI Integration (GitHub Actions)

```yaml
- name: Install Playwright browsers
  run: pwsh tests/YourProject.PlaywrightTests/bin/Release/net10.0/playwright.ps1 install --with-deps chromium

- name: Run Playwright tests
  run: dotnet test tests/YourProject.PlaywrightTests/ --configuration Release
  env:
    PLAYWRIGHT_HEADLESS: "true"
```

---

## Best Practices

| Do | Don't |
|----|-------|
| Inherit from `PageTest` | Create manual browser fixture classes |
| Use `GetByRole`, `GetByLabel`, `GetByTestId` | Reach for CSS selectors first |
| Use `Locator.WaitForAsync()` to stabilize | Use `await Task.Delay()` |
| Keep assertions in test methods | Put `Assert.That()` in page objects |
| Override `BrowserName` per test class | Leave browser type implicit |
| Use `[ParallelLimiter<T>]` on heavy suites | Let all tests run in unlimited parallel |
| Read `Headless` from env var | Hardcode `Headless = true` or `false` |
| Use `Assert.Multiple()` for multi-property assertions | Let first failure stop the test |
| Trace each test to an AC ID in `[DisplayName]` | Write untargeted tests |

---

## References

- Official TUnit Playwright docs: https://tunit.dev/docs/examples/playwright
- Playwright for .NET API: https://playwright.dev/dotnet/docs/api/class-page
- TUnit docs: https://tunit.dev/docs/
