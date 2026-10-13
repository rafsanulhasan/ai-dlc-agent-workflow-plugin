---
name: workspace-folders
description: "Sets or changes the repository's worktree root and scratch root: records them in AGENTS.md, CLAUDE.md and .github/copilot-instructions.md, gitignores them, and installs the Claude WorktreeCreate / WorktreeRemove hooks that place worktrees under the root. On a change it offers to move existing worktrees and scratch folders. Args: worktree=<path> scratch=<path>; with none, asks for both. Followed by init."
disable-model-invocation: true
---

# Workspace folders

Two folders every agent uses, on every platform:

- **Worktree root** — holds every git worktree of the repository, one per branch or task: `<worktree root>/<branch-or-task-slug>/`.
- **Scratch root** — holds every temporary file, one subfolder per session or task: `<scratch root>/<session-or-task>/`. Always inside the repository and gitignored.

They are recorded in the "Workspace folders" table of `AGENTS.md`, which agents (and the Copilot `scratchpad` skill) read. Claude Code also gets a `WorktreeCreate` / `WorktreeRemove` hook pair, because its own worktrees otherwise go to `.claude/worktrees/`. GitHub Copilot has no worktree location setting, so there the `AGENTS.md` instruction is the only control. The hook files come from `${CLAUDE_SKILL_DIR}/templates/hooks/`.

## When to use

- `init` follows **Inspect** in its Phase 0, **Confirm** in its Phase 1 message and **Write** in its Phase 2.
- The user runs `/ai-dlc:workspace-folders [worktree=<path>] [scratch=<path>]` to set the roots after init or to change them. A root not given in the args is asked for, with the current value as the default.

Run directly in a repository without `AGENTS.md`, stop and tell the user to run `/ai-dlc:init` first (init itself writes `AGENTS.md` before **Write**).

## Inspect

From the repository root (`git rev-parse --show-toplevel`), record:

1. **Current roots** — the **Worktrees** and **Scratch** rows of the "Workspace folders" table in `AGENTS.md`. None recorded means **create** mode; recorded roots mean **change** mode.
2. **`.gitignore`** — whether it exists, the lines under a `# AI-DLC workspace folders` comment (the ones this skill owns), and any other pattern that already ignores a candidate root (`git check-ignore -q <root>/x` exits 0).
3. **Worktrees** — `git worktree list --porcelain`: each path, branch, and whether it is `locked`. Mark the ones under the current worktree root.
4. **Hooks** — the `WorktreeCreate` and `WorktreeRemove` entries in `.claude/settings.json`, which ones are ours (`worktree-create.mjs` / `worktree-remove.mjs` in the command), the `--root` and `--base` our entry passes, and whether `.claude/hooks/worktree-*.mjs` match the templates.

Done when the mode is known and every item above has a value (or "none").

## Confirm

Propose both roots and validate the answers. Defaults: the args, else the current roots, else `.worktrees` and `.scratch`.

**Validation** — re-ask with the reason until both pass:

- **Worktree root**: relative to the repository root (`.worktrees`), outside it (`../<repo>.worktrees`) or absolute. It must not resolve to the repository root itself or into `.git/`.
- **Scratch root**: inside the repository — a relative path with no drive letter, no leading `/` or `\`, no `~`, no `..` segment; not `.`, not inside `.git/`.
- Normalise both: forward slashes, no leading `./`, no trailing `/`.

Show, in one message (inside init's Phase 1 message when init runs this):

- the roots, as `old → new` in change mode;
- the `.gitignore` lines to add — `/<scratch root>/` always, `/<worktree root>/` when that root resolves inside the repository, each skipped when another pattern already covers it — and in change mode the owned lines they replace;
- the hook entries to add or update, and any `WorktreeCreate` hook that is not ours (two would each create a worktree, so ask which to keep);
- change mode: each worktree under the old root, with the proposed `git worktree move` (or why it is skipped), and the session folders in the old scratch root that can be moved.

Done when the user has confirmed both roots and answered every move offer.

## Write

Show a unified diff for every existing file and write only after the user agrees. Never delete anything without consent.

1. **`.gitignore`** — create it when missing. Under the `# AI-DLC workspace folders` comment (add the comment if missing), add the new lines; in change mode, remove the old owned lines they replace. Leave every line outside that block alone. Done when `git check-ignore -q <scratch root>/x` exits 0, and `<worktree root>/x` too for an in-repo worktree root.
2. **`AGENTS.md`** — the `workspace-folders` managed block (`<!-- ai-dlc:begin workspace-folders -->` … `<!-- ai-dlc:end workspace-folders -->`). Its content is the same block of `${CLAUDE_SKILL_DIR}/../init/templates/AGENTS.md` with both roots filled.
   - Block present: replace the lines between its markers.
   - No block, but a `### Workspace folders` heading from an earlier version: replace that heading and its text, up to the next `##` or `###` heading, with the marked block.
   - Neither: insert the block where "Place a new block" in `${CLAUDE_SKILL_DIR}/../init/references/managed-blocks.md` puts it (right before the `conventions` block, else at the end).
   When init has just written the file with the roots filled, there is nothing to change.
3. **`CLAUDE.md`** (the root file, next to `AGENTS.md`; when only a `.claude/CLAUDE.md` exists, propose the move from "Location and name" in `${CLAUDE_SKILL_DIR}/../init/references/managed-blocks.md` first, and if declined, leave it untouched and create the root file) — the same for its `workspace-folders` block from `${CLAUDE_SKILL_DIR}/../init/templates/CLAUDE.md`; a legacy `## Workspace folders` section runs to the next `##` heading, and a new block is appended at the end. Write it even when `CLAUDE.md` imports `AGENTS.md` — its Claude Code notes are not in `AGENTS.md`; skip it only when the file holds `<!-- ai-dlc:skip workspace-folders -->`.
   Every line outside the block stays as it was; keep the file's line endings.
   **`.github/copilot-instructions.md`** — the same for its `workspace-folders` block from `${CLAUDE_SKILL_DIR}/../init/templates/copilot-instructions.md`: replace in place, else append at the end. Create the file from that template when it is missing; skip it only for `<!-- ai-dlc:skip workspace-folders -->`.
4. **Hook scripts** — copy `templates/hooks/worktree-create.mjs` and `templates/hooks/worktree-remove.mjs` to `.claude/hooks/` when missing or different from the templates.
5. **`.claude/settings.json`** — merge `templates/hooks/claude-worktree-hooks.json` with `{{WORKTREE_ROOT}}` filled. Replace our own entries in place (new `--root`; keep a `--base head` the developer chose earlier), add them when absent, never add them twice, and keep every other hook and key. Add `--base head` only when the developer asks new worktrees to branch from the current `HEAD` instead of the remote default branch.
6. **Change mode: worktrees** — for each worktree under the old root that the user agreed to move: create the new root if needed, then `git worktree move <old root>/<slug> <new root>/<slug>`. Skip, with a note, a worktree that is locked, has uncommitted changes (`git -C <path> status --porcelain` is not empty), or holds the current session. Worktrees outside the old root are never touched. Done when `git worktree list` shows each moved worktree at its new path.
7. **Change mode: scratch** — if the user agreed, move each session folder from the old scratch root to the new one, skipping a name that already exists there; offer to delete the old root only once it is empty. Otherwise leave it and say so.

## Report

List the roots (`old → new` in change mode), each file created or changed, the `.gitignore` lines added and removed, the hook entries, the worktrees moved and left (with the reason), and the scratch folders moved or left. Add: Claude Code keeps the worktrees it makes for subagents and workflow agents (it does not call `WorktreeRemove` for them), so remove those with `git worktree remove <path>` once merged.
