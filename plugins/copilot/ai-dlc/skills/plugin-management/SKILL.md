---
name: plugin-management
description: "Creates and maintains a plugin that ships the same agents and skills to Claude Code and GitHub Copilot (CLI and VS Code) from one source: the Claude plugin is the source of truth and a zero-dependency build projects it into the Copilot plugin. Covers repository layout, both marketplaces, manifests, agents, skills, project-installed hooks and rules, the build and its --check, the plugin repo's own .claude/ development setup, validation, CI and release. Invoked by agent-manager whenever a plugin or marketplace is created, restructured or published."
---

# Plugin Management — one source, two plugins

This is how the **ai-dlc** plugin is built; use it as the recipe for any new plugin and as the rulebook when changing one. The Claude Code plugin is the **source of truth**; the GitHub Copilot plugin is **generated** from it by `build-copilot.mjs` (shipped next to this file in `templates/`). Nobody edits the Copilot tree by hand.

> Agent names are the defaults; a name chosen at `/init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

```
Skill("plugin-management", args: "create <plugin-name>")   // new dual-platform plugin + marketplaces
Skill("plugin-management", args: "update <change>")        // change agents, skills or manifests in an existing one
Skill("plugin-management", args: "release <version>")      // bump, rebuild, validate, tag
```

## 1. Repository layout

```
<repo>/
├─ .claude-plugin/marketplace.json        Claude marketplace (lists plugins/claude/<name>, Claude-only plugins included)
├─ .github/plugin/marketplace.json        Copilot marketplace (lists plugins/copilot/<name>; never a Claude-only plugin)
├─ .github/workflows/validate.yml         CI: build --check + node --test + sync-harness --check + strict validations + plugin test, per plugin (§9)
├─ plugins/
│  ├─ claude/<name>/                      SOURCE OF TRUTH
│  │  ├─ .claude-plugin/plugin.json
│  │  ├─ LICENSE                          GENERATED copy of the root LICENSE
│  │  ├─ README.md                        the shipped plugin README; its Commands region is GENERATED, and the build carries it into Copilot with Copilot names and Claude-only commands marked
│  │  ├─ agents/<agent>.md
│  │  ├─ skills/<skill>/SKILL.md (+ templates/, scripts/)
│  │  └─ hooks/
│  │     ├─ hooks.json                    `hooks` that must run in EVERY project; `modules`
│  │     ├─ <module>/                     a Claude-only hooks module (mod), its tests, LICENSE, ATTRIBUTION.md
│  │     └─ <folder>/                     optional sibling code the module imports and registers (own tests, LICENSE, ATTRIBUTION.md)
│  ├─ claude/<other>/                     a Claude-only plugin (ai-dlc: ai-dlc-lens, one hooks module): listed in
│  │                                      tools/claude-only-plugins.json and in .claude-plugin/marketplace.json only;
│  │                                      never projected to Copilot
│  └─ copilot/<name>/                     GENERATED — never hand-edit
├─ tools/build-copilot.mjs                the projection (copy of templates/build-copilot.mjs)
├─ tools/validate.mjs                     local validation: harness sync, then a strict validation of the plugin,
│                                         of each Claude-only plugin and of the marketplace
├─ tools/templates/                       sources for generated files (e.g. AGENTS.template.md)
├─ tools/overlays/non-claude/skills/      skills only non-Claude plugins ship (e.g. scratchpad)
├─ tools/claude-only-skills.json          plugin skills the build leaves out of Copilot (ai-dlc: cache-keepalive,
│                                         cache-keepalive-configure, -install, -merge; lens, lens-configure,
│                                         lens-gate, lens-init, lens-keepalive, lens-kit)
├─ tools/claude-only-plugins.json         plugins the build never projects (ai-dlc: ai-dlc-lens)
├─ tests/                                 repo tests (node:test + node:assert only) — never shipped
├─ .claude/                               the plugin repo's own dev setup — never shipped (§8)
├─ LICENSE                                the one license text; the build copies it into both plugins
└─ README.md                             its Commands region is GENERATED (so is the one in docs/plugins.md)
```

## 2. Manifests

**`plugins/claude/<name>/.claude-plugin/plugin.json`** — `name` (kebab-case; it becomes the `<name>:` namespace of every agent and skill), `displayName`, `version` (SemVer), `description`, `author`, `license` (an SPDX id such as `MIT`), `homepage`, `repository`, `keywords`. Add `userConfig` only when a **plugin** hook, script or hooks module reads it (`CLAUDE_PLUGIN_OPTION_<KEY>`, or the module's `register(on, options)`); otherwise leave it out. ai-dlc ships no `userConfig`: the settings of its hooks modules are `AI_DLC_*` variables in the `env` of a settings file, plus `.ai-dlc/auto-handoff.json` and `.ai-dlc/cache-keepalive.json`, changed with `/configure-auto-handoff` and `/cache-keepalive-configure`.

**`.claude-plugin/marketplace.json`** — `name` (the marketplace id users type after `@`), `owner`, `metadata.description`, and `plugins[]` entries `{ name, source: "./plugins/claude/<name>", description, category, license }`. The entry `name` must equal the manifest `name`. Relative `source` paths start at the repo root and never contain `..`.

**`.github/plugin/marketplace.json`** — same shape, `source: "./plugins/copilot/<name>"`, plus `version`. It is hand-maintained: keep its description, version and license in step with the Claude manifest.

The Copilot `plugin.json` is generated by the build: the Claude manifest's `name`, `description`, `version`, `author`, `license`, `homepage`, `repository` and `keywords`, plus `agents/`, `skills/`, and `hooks` only when there are plugin hooks. `userConfig` and hooks modules are never projected.

## 3. Agents (`agents/<agent>.md`)

- Frontmatter: `name`, `description` (with `<example>` blocks — it drives routing), `tools` (comma list; omit to inherit all), `model` (an alias, never a pinned id; the allowed aliases and the rule for choosing one are in `agent-management`, *Mode: create-agent*), `color`, `memory: project`. `status: deprecated` makes the build skip the agent.
- Reference other agents and skills with the namespace: `Agent("<name>:software-engineer", …)`, `Skill("<name>:review")`. The build strips the prefix for Copilot.
- Give an agent the `Skill` tool if it calls skills, and `Agent` if it delegates.
- **Nesting depth is limited.** On Claude Code a subagent with the `Agent` tool can spawn subagents of its own, up to `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` levels (default 3 from Claude Code v2.1.219; below that version the default is 1, no nesting; `1` turns nesting off). Nested spawning is not documented for GitHub Copilot, so the plugin assumes only the main agent spawns there. An agent that runs a team (an orchestrator) must still be the session's main agent, because it is the human-facing lead that runs the whole team and nesting depth is limited: `claude --agent <name>:orchestrator`, or `"agent": "<name>:orchestrator"` in the project's `.claude/settings.json`.

## 4. Skills (`skills/<skill>/SKILL.md`)

- Frontmatter: `name` (= folder name), `description` (when to use it — the model reads this to decide).
- Every skill is also a slash command (`/<name>:<skill>`), so **do not ship `commands/`**: a command and a skill with the same name collide. Fold command bodies into skills.
- Files next to the skill are addressed as `templates/…`; the build rewrites that prefix for Copilot.
- `disable-model-invocation: true` makes a skill user-only. Another skill cannot `Skill()`-call it — have the caller read `../<skill>/SKILL.md` and follow it instead.
- Keep generic skills stack-neutral; put stack-specific content (C#, `dotnet`, NuGet; TypeScript, `npm`, Vitest / Jest) in stack-specific skills.
- A skill only non-Claude providers need goes in `tools/overlays/non-claude/skills/<skill>/`, not in the Claude plugin (§6).

## 5. Hooks and rules: plugin-wide vs project-installed

- A plugin `hooks/hooks.json` hook runs in **every** project that enables the plugin. Use it only for behaviour that is right everywhere; commands use `${PLUGIN_ROOT}/scripts/…`. Stop hooks read the JSON payload from stdin, honour `stop_hook_active` (loop guard) and answer `{"decision":"block","reason":"…"}`. A Stop hook that never blocks, like the plugin repository's own sync hook (§8), has no loop to guard and skips the `stop_hook_active` check.
- A **hooks module** (a Claude Code mod: `"modules": ["./<module>/register.tsx"]` in `hooks/hooks.json`) runs in-process in every Claude Code session that enables the plugin, on Claude Code 2.1.287 or later. ai-dlc ships one, `hooks/auto-handoff/`, the automatic path of the `handoff` skill's session handoff. The prompt-cache keep-alive, folded in from a third-party mod, lives in a sibling folder, `hooks/keepalive/`: `auto-handoff/register.tsx` imports it from `../keepalive/`, registers it and answers `/cache-keepalive`, a plugin skill (`skills/cache-keepalive/`); its team settings are created with `cache-keepalive-install`, brought up to date with `cache-keepalive-merge`, and shown and changed with `cache-keepalive-configure` (`skills/cache-keepalive-configure/` holds the CLI the other two run by relative path). It is not a module of its own, so `hooks/hooks.json` keeps one entry, `./auto-handoff/register.tsx`. `plugin validate --strict` follows the module's imports across sibling folders under `hooks/`, and `plugin test` runs every `*.test.ts(x)` under `hooks/`, `keepalive/tests/` included. Each third-party folder keeps its own upstream `LICENSE` and its own `ATTRIBUTION.md`. Keep the module, its sibling folders, its templates and its `*.test.ts(x)` tests under `hooks/`, never in `skills/`, `agents/` or `scripts/`: those folders are copied to Copilot, and the build fails when a module or a mod test sits there. Keep `hooks/hooks.json` to `modules` unless a settings hook really must run everywhere, since settings hooks are projected to Copilot. Third-party module code keeps its upstream `LICENSE` and an `ATTRIBUTION.md` (upstream, commit, modifications) in its own folder, and a section in `THIRD_PARTY_NOTICES.md`.
- Plugins **cannot ship** project rules, `CLAUDE.md`, `AGENTS.md` or settings. Put those as templates in an `init` skill that writes them into the target repository after showing a diff. Wrap everything init writes into `AGENTS.md` / `CLAUDE.md` in managed blocks (`<!-- <name>:begin <id> -->` … `<!-- <name>:end <id> -->`) so init can merge into hand-written files and replace its own content on a re-run; the ai-dlc rules are in `skills/init/references/managed-blocks.md`.
- Project hooks that are not stack-specific also live in their own skill that `init` follows and the user can re-run: `workspace-folders` installs the Claude `WorktreeCreate` / `WorktreeRemove` hooks that place worktrees under the configured worktree root, and changes the roots later; Copilot has no worktree setting, so there the location is an `AGENTS.md` instruction only.
- Stack-specific rules and hooks (for example a test gate) go in their own skills — `dotnet-rules` and `dotnet-test-gate` for .NET, `node-rules` and `node-test-gate` for JS / TS — that `init` runs only when it detects that stack. They install `.claude/hooks/*`, merge the hook into `.claude/settings.json`, and write the Copilot twin to `.github/hooks/<name>.json` (`{ "version": 1, "hooks": { "agentStop": [ { "type": "command", "bash": …, "powershell": …, "timeoutSec": … } ] } }`). Hooks that guard a project file rather than a stack are installed the same way by the skill that owns the file: the `workflow` skill installs the workflow gate (`check-workflow.mjs`, `.github/hooks/ai-dlc-workflow-gate.json`), and the `model-metadata` skill, which `init` runs in every repository, installs the model metadata hook (`update-model-metadata.mjs`, `.github/hooks/ai-dlc-model-metadata.json`) that keeps `.ai-dlc/model-metadata.json` current on Claude `Stop` and `PreToolUse` (`git commit`) and Copilot `agentStop` and `preToolUse`. Consumer repositories get no sync hook: `init` installs `.claude/scripts/sync-harness.mjs`, and developers sync the two platforms' twins by hand with `/harness-sync` (`--check` only reports).

## 6. The build — `tools/build-copilot.mjs`

Copy `templates/build-copilot.mjs` to `tools/build-copilot.mjs` in a new plugin repo. It is zero-dependency (Node 18+) and plugin-agnostic (`--plugin <name>` when `plugins/claude/` holds several).

| Claude source | Copilot output |
|---|---|
| `agents/<a>.md` | `agents/<a>.agent.md` with a platform note; tools mapped `Read`→`read`, `Write`/`Edit`→`edit`, `Glob`/`Grep`→`search`, `Bash`→`execute`, `Agent`→`agent`, `WebFetch`/`WebSearch`→`web`, `TodoWrite`→`todo`; Claude-only tools dropped; `mcp__*` kept |
| `skills/**` | copied; `<name>:` and `` stripped in Markdown |
| `skills/<s>/` listed in `tools/claude-only-skills.json` | left out of Copilot; a name with no `skills/<s>/SKILL.md` fails the build |
| `plugins/claude/<other>/` listed in `tools/claude-only-plugins.json` | nothing: the folder is ignored and `--plugin <other>` is refused; a name with no `plugins/claude/<other>/` folder, or a `plugins/copilot/<other>/` folder, fails the build |
| `tools/overlays/non-claude/skills/**` | added to `skills/` the same way; a name shared with a Claude plugin skill fails the build |
| `scripts/**` | copied verbatim |
| `hooks/hooks.json` (optional) | `hooks.json` in Copilot's `version: 1` format (`Stop`→`agentStop`, …); its `modules` and the module folders are left out (Claude-only) |
| manifest | generated `plugin.json` + `GENERATED.md` |
| root `LICENSE` (optional) | `LICENSE`, the same text |

It also writes **generated sources** into the Claude plugin when their inputs exist (an `AGENTS.md` template built from `tools/templates/AGENTS.template.md` + the **Scott Hanselman** (`orchestrator`) persona; `CLAUDE.md` and `copilot-instructions.md` templates rendered from the platform variants of `tools/templates/instructions.template.md`; the copy of itself in this skill; the **Commands list**, written from the skills' frontmatter between `<!-- <name>:commands:begin -->` and `<!-- <name>:commands:end -->` in the plugin README, the repository `README.md` and `docs/plugins.md`, with Claude-only commands marked; `LICENSE`, copied from the repository's root `LICENSE`, because an installed plugin is only its own folder). Edit only the root `LICENSE`: the build rewrites the copies in both plugins. It fails when the managed-block markers in these generated templates are unbalanced, nested or duplicated, or differ between the two platform renders, and it keeps the `<name>:` prefix inside `<!-- … -->` markers when it strips namespaces, so both platforms write the same markers. **Non-Claude overlay skills** stand in for something Claude Code has built in (the `scratchpad` skill replaces Claude's per-session scratchpad). They live outside the Claude plugin so it never ships them; a future build for another provider (Codex, …) reads the same folder. **Claude-only skills** are the reverse: plugin skills that work only in Claude Code (`cache-keepalive` gives the hooks module's command its name; `cache-keepalive-install`, `-merge` and `-configure` manage keep-alive's settings; `lens`, `lens-init`, `lens-configure`, `lens-kit`, `lens-keepalive` and `lens-gate` name the commands of the ai-dlc-lens plugin) are listed in `tools/claude-only-skills.json`, and Copilot gets none of their files. **Claude-only plugins** go one step further: a whole plugin that works only in Claude Code (ai-dlc-lens, which is one hooks module) is listed in `tools/claude-only-plugins.json`. The build ignores its folder under `plugins/claude/` (so `--plugin` is not needed to pick the projected one), refuses it as `--plugin`, and fails when it has a `plugins/copilot/` folder; it is listed in `.claude-plugin/marketplace.json` only, never in `.github/plugin/marketplace.json`. Skills listed in `tools/project-skills.json` are also mirrored into the repo's own `.claude/skills/<name>/` for repo-local use. `--check` exits 1 when the Copilot tree or any generated source is stale — that is what CI and the Stop hook run. When the build warns `no Copilot alias for tool "X"`, add `X` to `ALIAS` or `DROP`.

## 7. Change workflow (every change)

1. Edit only `plugins/claude/<name>/` (or `tools/templates/` for generated sources).
2. `node tools/build-copilot.mjs`, then `node tools/build-copilot.mjs --check`. Remove empty folders the build leaves under `plugins/copilot/` after a rename or delete.
3. When a script with tests in `tests/` changed (the `workflow` skill's `workflow.mjs`, the build), or a test did: `node --test "tests/**/*.test.mjs"`, with the glob quoted. `node --test tests/` fails (seen on Node 24), and bare `node --test` can also pick up the hooks module's TypeScript tests. When a hooks module or its tests changed: `npx @anthropic-ai/claude-code plugin test ./plugins/claude/<name>`.
4. When a manifest changed, or an agent or skill was added, renamed or removed: `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/<name>` and `npx @anthropic-ai/claude-code plugin validate --strict .` In ai-dlc, `node tools/validate.mjs` runs the harness sync, then the plugin's validation, one `plugin validate --strict ./plugins/claude/<other>` for each plugin in `tools/claude-only-plugins.json` whose folder exists, and the marketplace's, and exits 1 when any step fails. After changing a Claude-only plugin, also run `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/<other>` and, when it has a hooks module, `npx @anthropic-ai/claude-code plugin test ./plugins/claude/<other>`.
5. Update every reference to a renamed or removed agent/skill in the plugin's agents, skills and templates (`grep -rn '<old-name>' plugins/claude`). Documentation is not yours to edit (the documentation rule, `docs-status`): for references in READMEs and `docs/` (`grep -rn '<old-name>' README.md docs`), and for the README agent and skill tables, put a *Docs update* request for **Daniele Procida** (`documentation-writer`) in your hand-back — each document and section, the status from the run state, and what changed. The Commands regions between the `<name>:commands` markers are written by the build; leave them to it.
6. Prefer deleting a retired agent or skill outright in plugin scope (git keeps history); in project scope, deprecate instead.

## 8. The plugin repository's own `.claude/` (dogfooding)

The repo runs the plugin it builds — it keeps **no local copies** of agents, skills or commands.

- Register the repo as a local marketplace once per machine; this writes the machine path to the gitignored `.claude/settings.local.json`:

  ```
  claude plugin marketplace add ./ --scope local
  claude plugin install <name>@<marketplace> --scope local
  ```

  (`.` is rejected as a source; use `./`.) Edits apply on the next session or after `/reload-plugins`.
- `.claude/CLAUDE.md` — what the repo is, the build/validate commands, the layout, and the dogfooding steps.
- `.claude/rules/plugin-development.md` — edit only `plugins/claude/`, rebuild after every change, validate after manifest or roster changes, keep agents stack-neutral, never hand-edit generated files.
- `.claude/scripts/sync-harness.mjs` (the `harness-sync` skill's script) + `.claude/hooks/sync-harness-on-stop.mjs` — the sync script, and a hook script local to this repository that runs it (consumer repositories get no sync hook; they sync by hand with `/harness-sync`). It syncs the repo's own `.claude/` ↔ `.github/` twins (rules ↔ instructions, mirrored project skills, hooks) and never blocks: it always exits 0, never answers with a `decision`, and reports in a system message only when it wrote something or failed.
- `.claude/hooks/check-copilot-stale.mjs` — runs `build-copilot.mjs --check` and blocks finishing while anything generated is stale (with the `stop_hook_active` loop guard).
- `.claude/hooks/stop-sync-then-check.mjs` + one `Stop` hook in `.claude/settings.json` — runs `sync-harness-on-stop.mjs`, then `check-copilot-stale.mjs`, in that order, and answers with the check's decision (the sync's system message, if any, is kept). They are one command because Claude Code runs the hooks of one event in parallel, and the staleness check reads the `.claude/skills/` mirrors that the sync can rewrite from their `.github/skills/` twins. `.claude/hooks/check-workflow.mjs` stays a separate `Stop` hook: it reads only `.ai-dlc/`, which the sync never writes. The Copilot twin of the combined hook is in `.github/hooks/synced-from-claude.json`, written by the sync.
- `tools/validate.mjs` — the local validation command: runs the harness sync, then `plugin validate --strict` for the plugin, for each plugin in `tools/claude-only-plugins.json` (ai-dlc-lens) and for the marketplace, every step even after a failure, and exits 1 when any step fails (`--check` only checks the sync, as CI does); listed in `CLAUDE.md` *Commands* and `.claude/rules/plugin-development.md`.
- `.claude/settings.json` permissions for `node tools/build-copilot.mjs[ --check]` and both `plugin validate` commands; no stack-specific permissions the repo does not use.

## 9. CI — `.github/workflows/validate.yml`

On push and pull request: checkout, `actions/setup-node` (22), `node tools/build-copilot.mjs --check`, `node --test "tests/**/*.test.mjs"`, `node .claude/scripts/sync-harness.mjs --check` before the validations, `plugin validate --strict ./plugins/claude/<name>`, `plugin test ./plugins/claude/<name>` when the plugin has a hooks module, the same pair for each Claude-only plugin (ai-dlc: `plugin validate --strict ./plugins/claude/ai-dlc-lens` and `plugin test ./plugins/claude/ai-dlc-lens`), then `plugin validate --strict .`. CI never writes: the sync step only checks, and fails when a twin is pending; in this repository the local Stop hook and `tools/validate.mjs` are what sync.

## 10. Release

1. Bump `version` in the Claude `plugin.json` and the Copilot marketplace entry (SemVer).
2. Rebuild, `--check`, both validations.
3. Commit, tag `v<version>`, push. Users update with `/plugin marketplace update <marketplace>` (Claude) or `copilot plugin update` (Copilot).
4. When the install steps or the version the READMEs show changed, put a *Docs update* request for `documentation-writer` in your hand-back for the README install section (the status from the run state, what changed). The install commands it documents: Claude `/plugin marketplace add <owner>/<repo>` + `/plugin install <name>@<marketplace>`; Copilot `copilot plugin marketplace add <owner>/<repo>` + `copilot plugin install <name>@<marketplace>`.

## Checklist for `create`

- [ ] Layout from §1, both marketplaces and the Claude manifest from §2.
- [ ] At least one agent and one skill; namespace references use `<name>:`.
- [ ] `tools/build-copilot.mjs` copied from `templates/`; build + `--check` green.
- [ ] Both strict validations pass.
- [ ] `validate.yml` CI from §9.
- [ ] Repo `.claude/` dev setup from §8 (sync hook and the stale check), plugin installed locally.
- [ ] *Docs update* request for `documentation-writer` in the hand-back: the plugin README, the status from the run state, and what it must cover — what it is, the agent table, install for both platforms, the develop loop. You write no README content yourself; the build fills only the Commands region.
