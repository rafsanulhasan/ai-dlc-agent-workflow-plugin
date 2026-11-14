---
unit: lens
intent: 001-preview2-specsmd
status: ready
default_bolt_type: simple-bolt
created: 2026-11-13
updated: 2026-11-14
---

# Unit brief — lens (intent 001-preview2-specsmd)

**Planned:** approved at G2 (D38; the unit status is `ready`, which §5 of the spec maps to *planned*). Nothing here is built yet, and the bolts below are planned (status `ready`, G3 approved, 2026-11-14, D79).

## Purpose

The Claude-only live view of runs, read from `execution-plans/` and the event records.

## Scope in

- `plugins/claude/lens/**` (today `plugins/claude/ai-dlc-lens/`; renamed by D31), including the **five** command skills `show`, `configure`, `init`, `kit`, `gate` in `plugins/claude/lens/skills/` (D22, D24).
- Its hooks module, which answers those five commands and the engine's `engine:cache-keepalive-lens` (D28). Its panes use the ids `lens-*` (D33, D37).
- The lens's tests and `MANUAL-CHECKS.md`. Also `tests/lens-renderer/`, `tests/cache-reader/`, and the lens's entries in the shared registration files.

## Scope out

- The contract itself (the engine's).
- Keep-alive itself (an engine feature; the lens only answers its toggle).
- Copilot: the lens is never projected.

## Functional requirements

The lens parts of FR-9, FR-10, FR-15, FR-17 and FR-18 (AC-17.11, AC-17.13, the lens side of AC-17.5, and AC-18.4[lens]). See [the unit decomposition](../../units.md).

## Depends on

The engine contract, the grammar vectors, the rename constants and the result of spike bolt 001.

## Success

AC-9.2, AC-9.3, the lens parts of AC-15.x, AC-17.11, AC-17.13 and AC-18.4[lens] pass; the lens's `plugin validate --strict` and `plugin test` pass.

## Bolts

Two bolts of [the task plan](../../../../../project/plans/001-preview2-specsmd.tasks.md), each with a `bolt.md` and its stories (6 stories of these two bolts, `lens/001` to `lens/006`; the seventh, `lens/007`, belongs to the engine bolt 015). Both are status `ready` (planned): G3 was approved on 2026-11-14 (D79). Requires, waves and merge order are in the task plan and in each `bolt.md`.

| Bolt | Type | Stories | Wave |
|---|---|---|---|
| [008-lens-new-paths](bolts/008-lens-new-paths/bolt.md) | simple-bolt | [lens/001](stories/001-lens-reads-execution-plans.md), [lens/002](stories/002-run-state-file-names.md), [lens/003](stories/003-lens-fallback-notice.md) | W3 |
| [010-lens-rename](bolts/010-lens-rename/bolt.md) | simple-bolt | [lens/004](stories/004-lens-plugin-identity.md), [lens/005](stories/005-lens-commands-and-panes.md), [lens/006](stories/006-dual-engine-prefix.md) | W4 |

[lens/007 lens-config-reader](stories/007-lens-config-reader.md) (the lens reads its config files from their `CONFIG_PATHS` places) is a story of [bolt 015-engine-forgeline-root](../engine/bolts/015-engine-forgeline-root/bolt.md), which is the engine's bolt (D53, D66; W3). Cross-unit exception (FR-18): the engine bolt carries the lens reader story, because bolt 010 requires 015 and a split would be circular, and the lens unit owns AC-18.4[lens].
