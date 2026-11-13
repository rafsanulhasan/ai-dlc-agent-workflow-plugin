# Task plan — intent 001-preview2-specsmd (draft bolt index)

**Planned. Draft — finalised at G3 bolt design.** This task plan is the schedule of record for intent 001: its bolt waves replace the work-item waves of step 1.1.11 (the backlog's former wave table). Its bolt rows are the same as spec 001 §16, which governs each bolt's scope; G3 may renumber or reschedule bolts that have not started. No bolt file exists yet; they will live under `memory-bank/product/intents/001-preview2-specsmd/units/<unit>/bolts/` (ADR-0016). Bolt types are those of [ADR-0012](../../product/decisions/ADR-0012-bolt-types-are-stage-subsets.md); units are in [the decomposition](../../product/intents/001-preview2-specsmd/units.md).

Every bolt below is a bolt of the `engine` unit unless the Unit column says `lens`. "AAWP" is the lifecycle the bolt runs in. Items are the backlog items of [the backlog](../backlog.md).

## Bolts

| Bolt | Unit | Type (lifecycle) | Scope | Items | Requires |
|---|---|---|---|---|---|
| 001-engine-rename-spike | engine (lens part (c)) | spike-bolt (ASDLC: research, probe, architecture) | Live in Claude Code, scratch marketplace under `.scratch/`, Claude Code version quoted. Records: (a) the memory folder of a `memory: project` agent of plugin `engine`; (b) what happens to installed plugins, their `enabledPlugins` entries and stored data and settings when marketplace `ai-dlc-agent-workflow` is removed, `forgeline` added and `engine` and `lens` installed; (c) whether `/lens:show`, run from a skill in the `lens` plugin, reaches the lens module; (d) whether `lens` with `skills/` passes `validate --strict`; (e) whether the `$.state` `plugin` must equal the manifest name, and whether lens atoms persist (state lost on rename); (f) what an `"agent"` naming an unknown plugin agent does; (g) whether `engine:cache-keepalive-lens` is answered across plugins; (h, O-23) what happens when another installed plugin is also named `engine` or `lens`, including two plugins opening the same pane id such as `lens-chart`; (i, D33, D37) whether Claude Code reopens a pane by id after `/reload-plugins` or in a new session. A difference from this spec goes through `spec-driven-development` before bolt 009 starts | ITEM-126 (AC-17.14) | — |
| 002-engine-contract-tooling | engine | construction-bolt (AAWP) | `ARTIFACT_TYPES`, schema, `boltTypes`, skip rule and `building`, `validate`, `artifacts`, G-FM with vectors; the `workflow.mjs` resolver and fallback warning with their vectors (§9); `init` scaffolding of `memory-bank/product/`, `memory-bank/project/` and `execution-plans/` (`.gitkeep`) with a preview2 `artifacts` block (AC-1.1, AC-8.2) | ITEM-112 | — |
| 003-engine-authorship-rule | engine | simple-bolt (AAWP) | `docs-status` rewrite in its three copies (§14); the bank-file Blocker check in the `review` skill (AC-7.3); `write-adr`, `spec-driven-development`, `product-planning` and the glossary writes of `requirement-analysis` return content to `documentation-writer` (AC-7.6); `brutal-critique` critiques every bank change before the owning stage is `done`, stated in the rule and the orchestrator's docs-stage text (AC-7.7) | ITEM-113 | — |
| 004-engine-events | engine | construction-bolt (AAWP) | G-REC with vectors, `event.schema.json` installed by `init` (AC-6.1), `EVENT_RULES`, `events`, `handoff` skill rewrite, `execution-plan.md`; `agent-invocation`, the orchestrator body and the generated `AGENTS.md` template name `execution-plans/` (AC-5.2) and say when each event type is written (AC-6.6); session-handoff move; delete `.handoff/config.md` | ITEM-115 | 002 |
| 005-engine-planning-stages | engine | construction-bolt (AAWP) | `unit-design`, `bolt-design`, `probe`; PDLC, ASDLC and STBLC prose; agent text; bank templates for the intent files, unit brief, story and `bolt.md` (§4.1) | ITEM-114 (part a) | 002 |
| 006-engine-build-stages | engine | construction-bolt (AAWP) | bolt types wired into the orchestrator, `request-routing`, the `ai-dlc` skill, and the FDLC, BFLC, RLC and AAW prose | ITEM-114 (part b) | 005 |
| 007-engine-handoff-hook | engine | simple-bolt (AAWP) | hook resolver, formatter, G-REC, pairing, plugin tests | ITEM-116 (part a) | 002, 004 |
| 008-lens-new-paths | lens | simple-bolt (AAWP) | lens resolver, `record.ts`, `detectRun`, verdict and escalation reading, the lens's legacy-path strings | ITEM-116 (part b); lens part of ITEM-117 | 002, 004 |
| 009-engine-rename | engine | construction-bolt (AAWP) | §11 engine side: folder `git mv`, manifest (`name`; keywords D35, D36), both marketplaces (`forgeline`, the `engine` entry), `MARKER_NS`, `tests/helpers/paths.mjs` (`ENGINE_DIR`; `LENS_PLUGIN` and `LENS_DIR` at their old values), `engine:` prefixes, keep-alive command constants, `lens-keepalive` → `cache-keepalive-lens`, `init` settings, catalog, `stripNamespace` (O-21) with a build test, shared state namespace per (e). It edits no lens entry (Component boundaries); the five lens skills sit under `plugins/claude/engine/skills/` until 010, unreleased | ITEM-126 (engine) | 001; 002–008 and 013 merged; serialised |
| 010-lens-rename | lens | simple-bolt (AAWP) | lens plugin `name` and folder `git mv` to `plugins/claude/lens/`; the lens's entries in the shared registration files (marketplace entry, `tools/claude-only-plugins.json` line, the five skill lines leaving `tools/claude-only-skills.json`, its two CI steps, `LENS_PLUGIN` and `LENS_DIR`); paths in `tests/lens-renderer/` and `tests/cache-reader/`; the five skills move and rename; `CMD` map; `KEEPALIVE_COMMAND`; `engine-names.ts`; roster fallback; pane ids `lens-*` with `LEGACY_PANE_IDS` (D33, D37); `LENS_STATE_NS = 'lens'`; shared state namespace per (e) | ITEM-126 (lens; AC-17.11, AC-17.13) | 001, 009 |
| 011-engine-path-sweep | engine | simple-bolt (AAWP) | §15 sweep, its allowlist, and fixes in engine-owned paths; a hit in a lens-owned path goes back to the lens unit as a fix round of bolt 010 | ITEM-117; ITEM-126 (AC-17.3, AC-17.4) | 009, 010 |
| 012-engine-migrate | engine | construction-bolt (AAWP) | §10, `merge` guards, `upgrade` split, migration skill, AC-17.12 | ITEM-118; ITEM-126 (AC-17.10, AC-17.12) | 001 (hand-back accepted), 002, 009, 010 |
| 013-engine-notices | engine | simple-bolt (AAWP) | §13 | ITEM-119 | 002 |

Bolt 013 is numbered last because it was added late.

## Waves

| Wave | Bolts and work | Notes |
|---|---|---|
| W1 | 001, 002, 003 | In parallel |
| W2 | 004, 005, 013 | |
| W3 | 006, 007, 008 | |
| W4 | 009, then 010 | Serialised, with no other bolt open |
| W5 | 011 and 012 | In parallel |
| W6 | Intent-level: ITEM-121 (dogfood migration, an agent-artifact run; `documentation-writer` merges the backlog), ITEM-122 (integration and regression, TLC), ITEM-123 (docs and release notes: upgrade guide with the stored-data warning, D23), ITEM-124 (release) | |
| Not scheduled | ITEM-120 (brand-name research, P3, non-gating), ITEM-125 (remove the fallback in 1.0.0) | |
