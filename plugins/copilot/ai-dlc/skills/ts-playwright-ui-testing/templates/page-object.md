# page-object

A page object holds the page's locators and the user actions; it returns data or locators and never asserts.

```ts
// e2e/pages/todo-page.ts
import type { Locator, Page } from '@playwright/test';

export class TodoPage {
  readonly page: Page;
  readonly newTodoInput: Locator;
  readonly addButton: Locator;
  readonly items: Locator;
  readonly status: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newTodoInput = page.getByLabel('New todo');
    this.addButton = page.getByRole('button', { name: 'Add' });
    this.items = page.getByRole('listitem');
    this.status = page.getByRole('status');
  }

  async goto() {
    await this.page.goto('/todos');
  }

  async add(title: string) {
    await this.newTodoInput.fill(title);
    await this.addButton.click();
  }

  item(title: string): Locator {
    return this.items.filter({ hasText: title });
  }

  async complete(title: string) {
    await this.item(title).getByRole('checkbox', { name: 'Done' }).check();
  }
}
```

**Rules:**

- One class per page or major component.
- No `expect` inside page objects: they expose locators (`item(title)`) and the test asserts on them with web-first assertions.
- Locators are fields or methods that return a `Locator`, never an element handle or a resolved value.
- Actions are named for what the user does (`add`, `complete`), not for the DOM (`clickButton2`).
- Expose page objects as fixtures (see `fixtures`) so tests receive them ready-made.
