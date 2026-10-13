---
name: scratchpad
description: "Scratch folder for every temporary file: throwaway scripts, repro programs, intermediate or tool output, copies of files to edit safely (decks, configs), packed tarballs, session notes. Load before writing the first file that will not be committed, and whenever a step says scratch folder, temp directory or work on a copy."
---

# Scratchpad

Every temporary file lives in one **scratch folder** per session or task, inside the repository's gitignored scratch root. That keeps throwaway work next to the code it belongs to, reviewable by the user, and out of commits.

## 1. Find the scratch root

Read the **Scratch** row of the "Workspace folders" table in `AGENTS.md`. It is a path relative to the repository root.

If `AGENTS.md` has no such row, use `.scratch` and tell the user once: "No scratch root is recorded; using `.scratch`. Run the `workspace-folders` skill to record it."

Done when you hold one relative path inside the repository.

## 2. Open the scratch folder

1. Name it:
   - the work item or task slug when there is one (`WI-042`, `fix-export-timeout`);
   - else `<yyyyMMdd-HHmm>-<short-slug>`, using the current local time and two or three words of the task (`20261014-0930-deck-roster`).
   Reuse the folder you already opened in this session.
2. Create `<repo>/<scratch root>/<folder>/`.
3. Confirm it is ignored: `git check-ignore -q "<scratch root>/<folder>/"` from the repository root. Exit code 0 means ignored.
4. If it is **not** ignored, stop before writing anything. Tell the user, and offer to add `/<scratch root>/` to `.gitignore` (show the diff). Continue only once the path is ignored or the user names another location.

Done when the folder exists and `git check-ignore` exits 0.

## 3. Work in it

- Write every temporary file into the scratch folder: scripts, repro programs, captured output, copies of files you are editing on the side, build or pack output, notes for a later session.
- Run throwaway programs from there, with paths passed as arguments.
- In reports and handoffs, name each scratch file by its path relative to the repository root, so the user can open it.
- Scratch output stays in the scratch folder. Move or copy it into tracked files only when the user asks for that.

## 4. Clean up

- **Default:** leave the folder for the user to review, and list it in your final report.
- **Delete** it when the user, the brief or the skill you are following says to clean up (for example `fix-bug` removes its repro scripts at cleanup). Delete only your own folder, never the whole scratch root.

## Why not the tool's own temp area

GitHub Copilot CLI keeps per-session files under `~/.copilot/session-state/<id>/files/`. This skill deliberately does not use it: that folder cannot be placed under the configured scratch root, and VS Code has no equivalent, so the same team would scatter scratch files across two places. The operating system's temp directory is avoided for the same reason.
