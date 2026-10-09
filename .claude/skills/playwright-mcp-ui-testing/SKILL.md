---
name: playwright-mcp-ui-testing
description: AI-driven browser UI testing using the Playwright MCP server. Guides the sqa-engineer to perform autonomous browser interactions, assertions, and evidence capture through the Playwright MCP tools. Use ONLY when the change involves UI or frontend components.
---

# Playwright MCP UI Testing Skill

This skill guides the `sqa-engineer` agent to perform AI-driven UI tests using the Playwright MCP server (`@playwright/mcp`). The agent uses MCP browser tools to navigate, interact, observe, and assert UI behavior autonomously — without writing coded test files. This skill is ONLY invoked when the software change involves UI or frontend components.

---

## Prerequisites

Before invoking this skill:
1. Confirm the change is UI/frontend-related. If not, skip this skill entirely.
2. The Playwright MCP server is already available via the **docker MCP gateway** (configured in `.mcp.json`). No additional setup is required — all browser tools are available with the `mcp__docker-mcp-gateway__` prefix.
3. Ensure the application is running (start via `dotnet run` or via the Aspire AppHost in `samples/AppHost`).
4. Discover the service URL (check Aspire dashboard at `http://localhost:15888` or use the configured `launchUrl`).

---

## Phase 0 — Context Load (silent)

1. Read `CLAUDE.md` to understand the component under test.
2. Read the spec file at `docs/specs/<feature-slug>.spec.md` if it exists.
3. Load persistent memory: `Skill("manage-memory", args: "sqa-engineer")`.
4. Identify which UI routes/components were changed by the software-engineer.

---

## Phase 1 — Test Case Design

Design UI test cases based on user flows and acceptance criteria before interacting with the browser. For each test case specify:
- **Scenario name** (maps to an AC ID if available, e.g., `[AC-2] Submit form with valid data`)
- **Starting URL**
- **Steps** (navigation, interactions, form inputs)
- **Expected outcome** (element visible, text present, URL changed, etc.)
- **Evidence** (screenshot filename)

---

## Phase 2 — AI-Driven Browser Execution

Execute each test case using the Playwright MCP tools. Follow the **SAA pattern** (Snapshot → Act → Snapshot) for every interaction:

### Core Tool Reference

All browser tools are invoked via the docker MCP gateway. Use the exact tool names below:

| Tool | Purpose |
|------|---------|
| `mcp__docker-mcp-gateway__browser_navigate` | Navigate to a URL |
| `mcp__docker-mcp-gateway__browser_snapshot` | Capture accessibility tree — use this for all assertions |
| `mcp__docker-mcp-gateway__browser_take_screenshot` | Capture screenshot as evidence |
| `mcp__docker-mcp-gateway__browser_click` | Click an element by ARIA ref |
| `mcp__docker-mcp-gateway__browser_type` | Type into a focused element |
| `mcp__docker-mcp-gateway__browser_fill_form` | Fill a form field |
| `mcp__docker-mcp-gateway__browser_press_key` | Press keyboard key (Enter, Tab, Escape, etc.) |
| `mcp__docker-mcp-gateway__browser_select_option` | Select a dropdown option |
| `mcp__docker-mcp-gateway__browser_wait_for` | Wait for element/condition |
| `mcp__docker-mcp-gateway__browser_console_messages` | Retrieve browser console log |
| `mcp__docker-mcp-gateway__browser_network_requests` | List intercepted network requests |
| `mcp__docker-mcp-gateway__browser_hover` | Hover over an element |
| `mcp__docker-mcp-gateway__browser_drag` / `mcp__docker-mcp-gateway__browser_drop` | Drag and drop |
| `mcp__docker-mcp-gateway__browser_handle_dialog` | Handle JS alert/confirm/prompt dialogs |
| `mcp__docker-mcp-gateway__browser_eval` | Execute JavaScript (escape hatch — requires justification) |
| `mcp__docker-mcp-gateway__browser_tabs` | List open browser tabs |
| `mcp__docker-mcp-gateway__browser_resize` | Resize the browser window |
| `mcp__docker-mcp-gateway__browser_navigate_back` | Navigate back |
| `mcp__docker-mcp-gateway__browser_network_request` | Inspect a specific network request |

### SAA Pattern (Mandatory for every interaction)

```
Step 1: mcp__docker-mcp-gateway__browser_snapshot          → read current state, identify ARIA refs
Step 2: mcp__docker-mcp-gateway__browser_click / browser_type / browser_fill_form   → perform the interaction
Step 3: mcp__docker-mcp-gateway__browser_snapshot          → verify state changed as expected
```

Never skip the post-action snapshot — it is the assertion.

### Evidence Capture

After each test case (pass or fail), capture a screenshot:
```
Tool: mcp__docker-mcp-gateway__browser_take_screenshot
```

Also capture console errors:
```
Tool: mcp__docker-mcp-gateway__browser_console_messages
```
Treat any `[error]` level entries as implicit test failures.

---

## Phase 3 — Test Report

Produce a structured test report:

```
## AI-Driven UI Test Report

### Application: <app name and URL>
### Date: <ISO date>

| Scenario | AC ID | Steps | Result | Evidence |
|----------|-------|-------|--------|----------|
| Submit valid form | AC-2 | 3 | ✅ PASS | screenshots/submit-valid-pass.png |
| Submit empty form | AC-3 | 2 | ❌ FAIL | screenshots/submit-empty-fail.png |

### Console Errors Found
- [None] / [list any errors]

### Network Errors Found
- [None] / [list any 4xx/5xx responses]

### Summary: N passed, M failed
```

---

## Rules and Constraints

- **Snapshot mode is preferred** over vision mode — cheaper, faster, no vision model required.
- **Never use `mcp__docker-mcp-gateway__browser_eval` as a shortcut** to set state directly. Use actual UI flows. Document any unavoidable use in the test report.
- **Flaky timing**: always use `browser_wait_for` after navigation/form submission — never assume instant rendering.
- **ARIA anchoring**: if UI elements lack proper ARIA labels/roles, surface it as a bug to the software-engineer and request semantic markup fixes before retesting.
- **Screenshots are mandatory evidence** — never submit a test report without screenshot files.
- **This skill produces a report, not test code.** The `write-tests` skill produces `.cs` test files. This skill produces browser interaction results and a markdown report.

---

## Escape Hatches (Require Justification in Report)

- `mcp__docker-mcp-gateway__browser_eval` / `mcp__docker-mcp-gateway__browser_run_code_unsafe`: only when no combination of interaction tools can achieve the required state.
- If visual/CSS rendering testing is needed, capture multiple screenshots with `mcp__docker-mcp-gateway__browser_take_screenshot` at different viewports using `mcp__docker-mcp-gateway__browser_resize`.
