---
name: bash-heredoc-backslashes
description: On this Windows machine the Bash tool turns backslash escapes inside heredocs into real characters; write edit scripts with the Write tool instead
metadata:
  type: feedback
---

Scripted edits whose text holds backslash escapes (`\n` in a TS string, regex escapes) must not go through a Bash heredoc: the Bash tool here rewrote `\n` inside a quoted `<<'EOF'` heredoc into a real newline and broke a `.tsx` test file (2026-10-21, WI-4 auto-handoff absorb).

**Why:** the broken file only showed up as "Unterminated string literal" at `plugin test` time.

**How to apply:** for multi-line edits with escapes, use Edit, or Write the script to `.scratch/<task>/` and run it; heredocs are fine for plain text.

Also seen 2026-10-21 (mods-config run): a heredoc holding many escaped backticks failed with "unexpected EOF while looking for matching `''", and `node -e "..."` with Markdown backticks ran each backticked word as a shell command. Neither changed the file, but both wasted a round. For Markdown or TS with backticks, use Edit or a Written script.
