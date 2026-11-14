# ADR-0015: The plugin becomes `engine`, the marketplace `forgeline`; family names stay; one migrate skill

- **Status:** Accepted (G2 approved, D38). Planned: nothing is built. The two points that were open at G2, the name of the migrate skill and the removal of identical duplicates during migration (below), were decided in D39.
- **Date:** 2026-11-13
- **Deciders:** software-architect (1.1.14, 1.1.20), system-engineer (1.1.19), human at G2; decisions D15 to D25, D28, D30, D31, D32, D33, D34, D35, D36 and D37.

## Context

After G1 the human renamed the plugin (D15, first to `ai-dlc-engine`, then to `engine` by D32) and the marketplace (D17, D21, superseded by D30), moved the folders (D19) and renamed the lens plugin to `lens` (D31). Both renames ship in preview2 as one break (D23). The lens commands move to the lens (D22), while keep-alive and auto-handoff stay in the engine (D24). Migration is a skill shipped with the plugin (D25). Research (1.1.15, 1.1.16) found that no alias is documented across a marketplace rename, that removing a marketplace deletes the plugin's stored data, that `ai-dlc` is taken, and that the memory-folder pattern for plugin agents is undocumented.

## Decision

Apply the rename map.

| What | From | To |
|---|---|---|
| Plugin name and folders (Claude and Copilot) | `ai-dlc`, `plugins/*/ai-dlc/` | `engine`, `plugins/*/engine/` |
| Marketplace name (both files) | `ai-dlc-agent-workflow` | `forgeline` |
| References | `ai-dlc:<id>`, `/ai-dlc:<skill>` | `engine:<id>`, `/engine:<skill>` (Copilot strips the namespace) |
| Keep-alive command constants | `ai-dlc:cache-keepalive`, `…-configure` | `engine:cache-keepalive`, `…-configure` |
| Lens commands | `/ai-dlc:lens`, `lens-configure`, `lens-init`, `lens-kit`, `lens-gate` | `/lens:show`, `:configure`, `:init`, `:kit`, `:gate` (the skills move to `plugins/claude/lens/skills/`) |
| Lens keep-alive section toggle (D28) | `/ai-dlc:lens-keepalive` | `/engine:cache-keepalive-lens [on\|off]`: an engine skill, answered by the lens module |
| Migration entry (D25) | `/ai-dlc:workflow upgrade` (layout part) | `/engine:migrate [--dry-run]`; `workflow upgrade` keeps only the template-key merge |
| Consumer settings (`.claude/settings.json`, `.claude/settings.local.json`) | `"agent": "ai-dlc:orchestrator"`, `ai-dlc@ai-dlc-agent-workflow`, the marketplace key | `engine:orchestrator`, `engine@forgeline`, `forgeline`; rewritten by the migrate skill; user-level files get advice only (D25); keys of other marketplaces get advice only |
| Agent memory folders | `.claude/agent-memory/ai-dlc-<agent>/` | `engine-<agent>/` (the pattern is confirmed by spike bolt 001) |
| Catalog `plugin.name` | `ai-dlc` | `engine` |
| Lens worker prefix and roster path | `ai-dlc:`, `…/ai-dlc-orchestrator/…` | `engine:`; both accepted for one release; roster fallback path |
| Lens plugin name (D31) | `ai-dlc-lens` | `lens`; folder `plugins/claude/lens/`, install `lens@forgeline` |
| Lens pane ids (D33, D37) | `ai-dlc-lens-*` | `lens-kit`, `lens-edge`, `lens-agent`, `lens-chart`, `lens-runs`; a pane id allows only letters, digits, `_` and `-`; the lens closes panes left open under the old ids |
| Lens state namespace | `{plugin: 'ai-dlc-lens'}` | `{plugin: 'lens'}` |
| **Unchanged** (family names) | `.ai-dlc/`, `AI_DLC_*`, `.ai-dlc/lens.json`, the `[ai-dlc:auto-handoff]` title tag, managed-block markers `<!-- ai-dlc:… -->`, the repository name | |

The shared state namespace `{plugin: 'ai-dlc', key: 'keepalive'}` stays unless spike bolt 001 shows that `plugin` must equal the manifest name; if so, both plugins rename it together.

- There is no alias for the plugin, the marketplace or the old lens commands. The upgrade is: remove the old marketplace, add `forgeline`, reinstall (`engine@forgeline`, and `lens@forgeline` for the lens), run `/engine:migrate`.
- `/engine:migrate` is the single entry point. It runs the plugin's own `workflow.mjs migrate` and rewrites the repository's `.claude/settings.json` and `.claude/settings.local.json` (D25); the human's own user-level settings get advice only.
- The lens accepts both worker prefixes for one release.
- Spike bolt 001 checks the undocumented platform behaviour first, before any rename or migration bolt (D29).

**Decided at G2 (D39):** the skill is named `migrate` (`/engine:migrate`), not a longer name such as `migrate-layout`; and `migrate` removes a legacy file when the target already holds an identical copy (the alternative fails AC-11.10; the old path's history is lost, the content is kept).

**Brand note.** Decision D30 chose the name `forgeline` for the marketplace. Research 1.1.8 found a private-beta AI-agent product with a similar name (a single source, some risk); the brand-name research (FR-13, P3, non-gating) now covers `forgeline`, and a clash goes back to the human as a new decision. D31 and D32 chose the generic plugin names `engine` and `lens`; the same research covers them, because another plugin of the same name can collide in the namespace (`engine:<id>`, `/lens:show`).

## Consequences

- Every command, subagent type and memory folder name changes.
- The engine and lens renames ship together.
- Users remove the old marketplace, add the new one, reinstall and run migrate; the upgrade guide warns about stored-data loss and managed settings.
- A stale-names sweep guards the rename.
- One engine skill's text names a lens setting (a documentation-only reverse reference).

## Alternatives rejected

- Keep `ai-dlc` (decision D4, reversed by D15).
- Plugin names `ai-dlc-engine` and `ai-dlc-lens` (D15, D16): superseded by `engine` and `lens` (D32, D31); the prefixed forms `ai-dlc-engine:` and `ai-dlc-lens:` never ship and are old-name patterns.
- Marketplace `ai-dlc`: the name is taken. Marketplace `ai-dlc-suite` (D21): superseded by `forgeline` (D30).
- Two releases through `renames` (D23).
- Rename `.ai-dlc/` and `AI_DLC_*` (D16).
- Keep `plugins/claude/ai-dlc/` (D19).
- Migration inside `workflow upgrade` (D25).
- Merge the lens toggle into `cache-keepalive-configure`: the engine would write a lens setting.
