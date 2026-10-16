# Managed blocks: merging AGENTS.md, CLAUDE.md and copilot-instructions.md

`init` and `workspace-folders` own only what sits inside their **managed blocks**. Everything else in a project's `AGENTS.md`, `CLAUDE.md` and `.github/copilot-instructions.md` belongs to the developer. That is what lets init merge into a hand-written file and lets a re-run replace its own content in place.

## Marker scheme

```markdown
<!-- ai-dlc:begin <id> -->
…content init owns…
<!-- ai-dlc:end <id> -->
```

- Each marker stands alone on its line. Blocks are flat (never nested) and each id appears once per file.
- `<!-- ai-dlc:skip <id> -->` records that the developer declined a block (for example, they keep their own commands section). A re-run honours it and does not offer that block again unless the developer asks.
- The templates carry the markers: `templates/AGENTS.md`, `templates/CLAUDE.md` and `templates/copilot-instructions.md`. A block's content is the template text between its markers, with the placeholders filled. The last two are rendered by the plugin build from one source, so they have the same blocks with per-platform content.

| File | Blocks, in template order | Content |
|---|---|---|
| `AGENTS.md` | `intro` | what this file is, platform forms |
| | `persona` | the orchestrator persona |
| | `project-facts` | lifecycles and gates, owners, artifact locations, quality gates, memory protocol |
| | `workspace-folders` | worktree and scratch roots (written by `workspace-folders`) |
| | `conventions` | where the stack rules live; ends on "Project-specific architecture notes:" |
| `CLAUDE.md` | `pointer` | the `@AGENTS.md` import and a line explaining it |
| | `commands` | "Project commands" table: the build, test and mutation commands |
| | `workspace-folders` | Claude Code specifics only: the scratch root replaces the built-in scratchpad; the `WorktreeCreate` hook places Claude's worktrees under the root |
| `.github/copilot-instructions.md` | `pointer` | a note that `AGENTS.md` holds the rules (Copilot loads it itself, so no import) |
| | `commands` | the same "Project commands" table as in `CLAUDE.md` |
| | `workspace-folders` | GitHub Copilot specifics only: load the `scratchpad` skill; create worktrees by hand under the root |

`CLAUDE.md` and `.github/copilot-instructions.md` carry only what `AGENTS.md` does not. `AGENTS.md` stays free of stack-specific commands, so the build, test and mutation commands are in the `commands` block of both platform files, with the same values. GitHub Copilot CLI reads `CLAUDE.md` too, so each file's platform-specific blocks name the platform they are for. **Obsolete blocks:** `commands` in `AGENTS.md` and `watch-out-for` in `CLAUDE.md` came from earlier templates; a re-run proposes removing them (see "Decide per block"). The commands an obsolete `AGENTS.md` `commands` block states are Phase 1 defaults for the `commands` blocks of the platform files.

The title (`# …`) and the architecture-notes list after the `conventions` block sit outside every block: they belong to the developer once written.

## Inspect an existing file

Find each file case-insensitively: `AGENTS.md` (`Agents.md`, `agents.md`) at the repository root; `CLAUDE.md` (`Claude.md`, `claude.md`) at the root and in `.claude/`; `copilot-instructions.md` (any case) in `.github/`. A `copilot-instructions.md` anywhere else is not a repository instruction file for Copilot: mention it and leave it alone. Note a `CLAUDE.local.md` if present and never touch it. Where each file ends up is decided under "Location and name" below. For each file found, record:

1. Its line ending (LF or CRLF) and whether it ends with a newline.
2. Its headings, in order, with line numbers.
3. **Blocks present**: each `begin`/`end` pair and each `skip` marker. An unbalanced or duplicated marker stops the merge for that file: show the lines and ask the developer to fix them.
4. **Legacy content** (written by an init that predates the markers): see "Convert legacy content" below.
5. `CLAUDE.md` and `.github/copilot-instructions.md` — **equivalent sections**: a heading of the developer's own that covers a block, for example "Commands", "Build", "Build & test", "Development", "Scripts" for `commands`. In `AGENTS.md`, record such a section as a **commands section** instead: it is the developer's, and Phase 1 offers to move it (see "Decide per block").
6. **Facts it states**: build, test and mutation commands (in code spans or fenced shell lines), and architecture or convention notes. Phase 1 uses them as defaults and lists every one that conflicts with a detected value.
7. `CLAUDE.md` only: whether it **imports** `AGENTS.md` (a line `@AGENTS.md`, or `@` plus its path) or only **links** to it (a Markdown link).

Done when every file has its line ending, headings, blocks, legacy ranges, equivalent sections, facts and (for `CLAUDE.md`) import status recorded.

## Location and name

Both files live in the repository root, side by side: `<repo>/AGENTS.md` and `<repo>/CLAUDE.md`. A `CLAUDE.md` in `.claude/` is migrated there. Each case below is one Phase 1 proposal and one diff (rename or move plus merge), written only after consent.

| Found | Proposal | If the developer declines |
|---|---|---|
| Only `.claude/CLAUDE.md` | Move it to the root — `git mv .claude/CLAUDE.md CLAUDE.md` when it is tracked (`git ls-files --error-unmatch` succeeds), so history follows; a plain move otherwise — then merge into it as usual | Leave `.claude/CLAUDE.md` untouched and create the root `CLAUDE.md` from the template |
| Root `CLAUDE.md` and `.claude/CLAUDE.md` | Merge `.claude/CLAUDE.md` into the root file, then remove it (`git rm` when tracked) | Leave `.claude/CLAUDE.md` untouched and merge only the root file |
| `Claude.md`, `claude.md`, `Agents.md`, `agents.md` at the root, or `.github/` `copilot-instructions.md` in another case | Recommend renaming to `CLAUDE.md` / `AGENTS.md` / `copilot-instructions.md` (`git mv` when tracked), then merge. The docs name only these spellings and say nothing about case, so another case may go unread on a case-sensitive file system (Linux) | Keep the name and merge into it as it is |

When a `.claude/CLAUDE.md` is left in place, tell the developer that Claude Code loads both files (both are project-instruction locations), so their instructions add up.

**Merging `.claude/CLAUDE.md` into the root file:**

- Its lines are appended verbatim after the root file's content, in their own order — title included — and before the managed blocks appended in this run.
- An import or link written relative to `.claude/` (`@../AGENTS.md`, `[…](../AGENTS.md)`) is rewritten to its root-relative form (`@AGENTS.md`). That is the only change to its lines, and the diff shows it.
- A managed block present in both files ends up once: the root file's copy, refreshed in place; the other copy (init's content, not the developer's) is dropped. A block found only in `.claude/CLAUDE.md` moves with it and is refreshed in place. A `skip` marker in either file applies to the merged file.
- An import of `AGENTS.md` in either file counts as an import for the merged file.

Done when the root `CLAUDE.md` holds every developer line of both files, and `.claude/CLAUDE.md` is either removed with consent or untouched.

## Decide per block (Phase 1)

For each block of each existing file, decide one action and show it in the Phase 1 table under the file's **merge** row:

| Situation | Action |
|---|---|
| Block present | **update** in place |
| `skip` marker present | **skip** (say so) |
| `CLAUDE.md` or `.github/copilot-instructions.md`: developer has an equivalent section | ask: **keep theirs** (default — their section stays as is, ours is skipped and a `skip` marker records it) or **adopt** (their section is replaced by our block filled with their values; their wording is lost, so only with explicit agreement) |
| `CLAUDE.md` already imports `AGENTS.md` (their own `@AGENTS.md` line) | skip `pointer` — their import does its job; no marker is needed, the import is detected on every run. `workspace-folders` is still added or updated: its Claude-specific notes are not in `AGENTS.md` |
| `CLAUDE.md` only links `AGENTS.md` | add `pointer`: a link does not load the file, and Claude Code reads `AGENTS.md` by itself only when no `CLAUDE.md` exists |
| Obsolete block — `commands` in `AGENTS.md`, `watch-out-for` in `CLAUDE.md` — or a `skip` marker for one in that file | **remove** — propose it in the same diff and consent. Only the markers and the lines between them go; a section of the developer's own with a similar heading is never touched |
| `AGENTS.md`: developer has a commands section of their own | leave it in place by default; list it in Phase 1 and offer to move its stack-specific commands into the platform files' `commands` blocks, since `AGENTS.md` is meant to stay free of them. Move it only with explicit agreement |
| Otherwise | **add** |

Conflicting values — the file says `npm test`, init detected `pnpm test` — are listed and asked about. Never pick one silently. The confirmed value fills every block that uses it.

The architecture-notes list is filled only when `AGENTS.md` is created or has no notes list yet. If the file already holds such notes under its own headings, fill it with one line pointing to them (`- See "<their heading>" above.`) and leave their text where it is. Move or copy their text only when the developer asks.

## Place a new block

**AGENTS.md:**

- **Title.** Keep the existing H1. Add the template title only when the file has no H1.
- **`intro`** goes right after the title and the paragraph(s) under it, before the first `##` heading. A reader (human or agent) meets the platform forms, and where the commands are, before the long persona that refers to them.
- **`persona`, `project-facts`, `workspace-folders`, `conventions`** are appended after the developer's content, in that order, followed by the architecture-notes list. The persona runs to hundreds of lines; appending it keeps the developer's own sections at the top where they wrote them, and every line of `AGENTS.md` is loaded anyway, so position does not change what the agent sees.
- When some blocks are already present, a missing block goes right after the block before it in template order (or right before the block after it), so the managed blocks stay in template order.

**CLAUDE.md** and **`.github/copilot-instructions.md`:**

- **`pointer`** goes right after the title (before any other line); at the top of a file without a title.
- **`commands`** goes right after `pointer`, before the developer's first `##` heading.
- **`workspace-folders`** is appended at the end.

Separate every inserted block from its neighbours with one blank line.

## Write

1. For a block being **updated**, replace only the lines between its markers.
2. For a block being **added**, insert the markers and content at its place.
3. For a **skip**, write the `skip` marker where the block would have gone (not needed for the import case).
4. For a **remove**, delete the block's markers and the lines between them, and one of the blank lines around it so no double gap is left.
5. Use the file's line ending and keep its final-newline state. Every line outside the blocks stays byte-for-byte as it was.
6. Show a unified diff of the merged file and write only after the developer agrees.

Done when every developer line from before is still present in the same order (only managed content was inserted, replaced or removed) and the markers are balanced.

## Convert legacy content

A file written by an earlier init has the template text but no markers. Recognise it by these anchors and wrap each range in its markers, replacing the range with the current block content:

| Block | Legacy range |
|---|---|
| `intro` | from the paragraph starting "This file makes the main agent" through the "**Platform forms.**" paragraph |
| obsolete: `commands` (AGENTS.md) | from `## Project commands` through the line "Use these wherever the persona below says…" — **proposed for removal**, not converted; its commands are Phase 1 defaults for the platform files |
| `persona` | everything after the `intro` range (or that `commands` range), up to `## Project facts` |
| `project-facts`, `workspace-folders`, `conventions` | from `## Project facts` through the line ending "Project-specific architecture notes:" — replaced by the three current blocks (the old order had "Workspace folders" inside "Project facts") |
| `pointer` | the line `> Agent orchestration, routing, gates and memory rules live in [AGENTS.md]…` (replaced by the current block, which adds the `@AGENTS.md` import) |
| `workspace-folders` (CLAUDE.md) | from `## Workspace folders` to the next `##` heading or the end of the file |
| `commands` (CLAUDE.md) | from `## Commands` to the next `##` heading or the end of the file; its commands are Phase 1 defaults |
| obsolete: `## Watch out for` (CLAUDE.md) | from its heading to the next `##` heading or the end of the file — **proposed for removal**, not converted; if the developer keeps it, it stays as it is, unmarked |

Inside a legacy range, a line that matches neither the old nor the new template text is a developer edit. List each one in Phase 1 and keep it, placed right after the new block, unless the developer agrees to drop it. For a range proposed for removal, its developer edits are listed the same way and kept in place (unmarked) if the developer says so. Show the conversion in the same diff as the rest of the merge.
