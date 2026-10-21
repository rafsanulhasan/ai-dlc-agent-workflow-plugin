---
name: claude-plugin-config-facts
description: Verified Claude Code 2.1.306 facts on userConfig min/max, mod command names, $.store scope and `claude plugin configure`
metadata:
  type: reference
---

Checked 2026-10-21 against the bundled mods types (`plugin-authoring` skill, `types/claude-code.d.ts`) and `claude plugin --help`, Claude Code 2.1.306 (the minimum supported for mods is 2.1.287):

- `userConfig` number `min` / `max` are enforced by the host: `claude plugin test` refuses to load a module whose test options are out of range ("must be at most 100"). Clamp in code anyway, but test the clamp as a pure function, not through `test(name, { options })`.
- A string option with `options: [...]` is a picker; a stored value outside it counts as unset.
- A mod's `$.command.register({ name })` command is run as `/<name>`, no plugin prefix; `argumentHint` is shown dim after it; `e.args` is everything after the name (`""` when bare).
- `$.store` is the plugin's own JSON file under the user's config dir, shared by every session on the machine (4 MiB). Per-session values need a session-id key.
- `claude plugin configure <plugin> [--json] [--values-stdin]` shows a plugin's options and which are unset, and can save values from stdin: a documented CLI write path for `pluginConfigs`. Not used by init yet (human chose /config guidance, AAW-20261021-mods-config).
- In mod tests, `session.start` needs a stub that returns its input (it must carry `cwd`) and `command.register` a stub returning `{ value: { command } }`.

**How to apply:** use these when changing hooks modules or vendored mods; re-check against the types file of the current build before relying on them.
