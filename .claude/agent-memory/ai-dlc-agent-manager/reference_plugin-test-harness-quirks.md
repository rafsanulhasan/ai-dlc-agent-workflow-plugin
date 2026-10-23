---
name: plugin-test-harness-quirks
description: claude plugin test (2.1.309) quirks met in spike 027 — where hover props live, turn.step answers, timers, pane APIs a mod lacks
metadata:
  type: reference
---

Facts about `claude plugin test` and the 2.1.309 mod API, learned building spike 027 round 6 (2026-10-23).

- A Box's `hover` is kept beside `props` on the element as its parent's `children` lists it, not in `findAll` results: assert via the keyed parent's `children[i].hover`.
- A test's `turn.step` hook must answer the same `{ turnId, index }` it was called with, or the chain fails with "no implementation for turn.step".
- `$.clock.every` callbacks may still fire under test even with a `clock.every` stub: a poll that writes state (e.g. `$.agent.list()` refresh) shows up in pane assertions.
- No mod API sets a pane's place or order, minimises it, or adds a title-bar control (PaneOpenArgs: id, title, focus, closeOnEscape, holdToasts, rows, columns only). Esc-to-close is `closeOnEscape`; `Button role="dismiss"` is the close hint.
- `prompt.submit` `e.origin.kind` (`composer` / `bridge` / `sdk` = the person) tells a human prompt from a notification.

**How to apply:** check these before writing pane or event tests in a mod; see [[bash-heredoc-backslashes]] for writing multi-line scripts (use the Write tool, then run the file).
