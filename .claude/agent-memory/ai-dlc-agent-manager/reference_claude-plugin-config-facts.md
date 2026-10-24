---
name: claude-plugin-config-facts
description: Verified Claude Code 2.1.306 facts on userConfig min/max, mod command names, $.store scope and `claude plugin configure`; workspace trust in ~/.claude.json; $.command.run ordering
metadata:
  type: reference
---

Checked 2026-10-21 against the bundled mods types (`plugin-authoring` skill, `types/claude-code.d.ts`) and `claude plugin --help`, Claude Code 2.1.306 (the minimum supported for mods is 2.1.287):

- `userConfig` number `min` / `max` are enforced by the host: `claude plugin test` refuses to load a module whose test options are out of range ("must be at most 100"). Clamp in code anyway, but test the clamp as a pure function, not through `test(name, { options })`.
- A string option with `options: [...]` is a picker; a stored value outside it counts as unset.
- A mod's `$.command.register({ name })` command is run as `/<name>`, no plugin prefix; `argumentHint` is shown dim after it; `e.args` is everything after the name (`""` when bare). For a prefixed `/<plugin>:<name>`, see the 2026-10-22 entry below (a plugin skill plus a `command.run` hook).
- `$.store` is the plugin's own JSON file under the user's config dir, shared by every session on the machine (4 MiB). Per-session values need a session-id key.
- `claude plugin configure <plugin> [--json] [--values-stdin]` shows a plugin's options and which are unset, and can save values from stdin: a documented CLI write path for `pluginConfigs`. Not used by init yet (human chose /config guidance, AAW-20261021-mods-config).
- No engine API exposes workspace trust (2026-10-22). It is `projects["<path>"].hasTrustDialogAccepted` in `~/.claude.json` (repo root; worktree → main checkout; outside a repo, the folder or an ancestor). Keys on this Windows machine: forward slashes, lowercase drive. VS Code / SDK sessions never show the dialog, so the flag stays false there. The auto-handoff module gates `viewer` and the two templates on it (`config.ts`, `TRUST_GATED`); keep-alive gates its spend and behaviour settings and its two texts from both `.ai-dlc/cache-keepalive.json` and the `env` of `.claude/settings.json` (`keepalive/settings.ts`, `TRUST_GATED`; human decision 2026-10-22); both go through `io.ts` `trustGate`. Read only the flag, never quote the file.
- `$.command.run` queues a command and resolves once it has run (session idle); await it to order two commands.
- Verified 2026-10-22 (Claude Code 2.1.308, run AAW-20261022-fold-cache-keepalive): `$.command.register` refuses a colon ("name is letters, digits, _ or - (up to 64)"). A prefixed command works as a plugin skill (`skills/<name>`, listed as `/<plugin>:<name>`) plus a module hook `on('command.run', { command: '<plugin>:<name>' }, …)` that answers without `next`: live `claude -p "/<plugin>:<name> …"` returned the hook's text, 0 turns, $0. The Copilot build rewrites `/ai-dlc:<cmd>` to `/<cmd>` in Copilot copies; a skill listed in `tools/claude-only-skills.json` (such as `keepalive`) is not copied at all.
- Verified 2026-10-24 (Claude Code 2.1.309, AAW-20261023 step 1.4): a `command.run` hook of one plugin answers a skill command of another (`ai-dlc-lens` answers `/ai-dlc:lens-gate`, a skill of `ai-dlc`): headless `claude -p`, 0 turns, $0. It answered even with `ai-dlc` absent (name typed in full; the typeahead would not list it). Pane ids (`PaneOpenArgs.id`, d.ts:7590) allow no `:`.
- `claude plugin validate` follows `$` past an import only into a `function` declaration: passing `$` to an arrow const, a property (`deps.fn($)`) or a function value fails validation. Shared `$` helpers live in `hooks/auto-handoff/io.ts` as declarations.
- A `userConfig` string with `options` must have a `default` among them (or `required: true`); rows without `options` may omit `default`, so a module can keep its defaults in one code table.
- In mod tests, `session.start` needs a stub that returns its input (it must carry `cwd`) and `command.register` a stub returning `{ value: { command } }`.
- Mod tests (2026-10-22): a test hook that throws is skipped (the call falls through), so to make `$.store.get` etc. reject, return `{ deny: '…' }`. Every `on(...)` must come before the test's first `$` call, so one engine per test (loop over `test(...)`, not inside one). The test body's `$` has no `ui` noun: call an exported `$` helper through a hook, not directly. `{ options }` values must be string, number, boolean or string[].

**How to apply:** use these when changing hooks modules (the ai-dlc plugin has one, auto-handoff with keep-alive in it); re-check against the types file of the current build before relying on them.
