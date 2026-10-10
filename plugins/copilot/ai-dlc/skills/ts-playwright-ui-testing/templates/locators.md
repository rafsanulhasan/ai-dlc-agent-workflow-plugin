# locators

Locate elements the way a user or assistive technology finds them. Priority:

1. `page.getByRole(role, { name })` — buttons, links, headings, checkboxes, dialogs, rows
2. `page.getByText(text)` — non-interactive content
3. `page.getByLabel(label)` — form fields
4. `page.getByPlaceholder(text)`
5. `page.getByAltText(text)` — images
6. `page.getByTitle(text)`
7. `page.getByTestId(id)` — when nothing user-facing is stable

```ts
page.getByRole('button', { name: 'Save' });
page.getByRole('heading', { name: 'Orders', level: 1 });
page.getByRole('checkbox', { name: 'Done', checked: false });
page.getByRole('link', { name: /view invoice/i });
page.getByLabel('Email');
page.getByTestId('order-total');   // attribute is configurable with `use.testIdAttribute`
```

Narrow by structure instead of by index:

```ts
const row = page.getByRole('row').filter({ hasText: 'INV-1042' });
await row.getByRole('button', { name: 'Refund' }).click();

page.getByRole('listitem').filter({ has: page.getByRole('checkbox', { checked: true }) });
page.getByRole('listitem').filter({ hasNotText: 'Archived' });
page.getByRole('button', { name: 'Save' }).or(page.getByRole('button', { name: 'Update' }));
```

- Locators are **strict**: an action on a locator that matches more than one element fails. That is a feature; narrow the locator rather than reaching for `first()`, `last()` or `nth()`.
- `getByRole` options: `name`, `exact`, `checked`, `disabled`, `expanded`, `includeHidden`, `level`, `pressed`, `selected`.
- Avoid CSS and XPath selectors tied to layout or generated class names. If an element has no accessible role or name, that is often an accessibility bug to report.
- Locators are lazy: build them once (in a page object) and use them many times; each action re-resolves them.
