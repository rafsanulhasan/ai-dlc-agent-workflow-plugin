---
name: crlf-when-scripting-docs
description: Docs in this repo are CRLF in the working tree; scripted OLD/NEW edits must keep CRLF and be checked for bare LF after each run
metadata:
  type: feedback
---

Keep CRLF line endings when editing the repo's Markdown with a script. In step 44 a scripted OLD/NEW applier left 11 files with bare LF (some lost every CR), and only a normalise-and-diff pass restored them.

**Why:** the working tree (and the committed blobs) use CRLF; `git diff` then shows whole-file churn if the endings drift. The cause was not pinned down, so do not assume a script is safe.

**How to apply:** after any scripted edit, count bare LF per touched file (`(?<!\r)\n`) and normalise to CRLF with `replace(/\r\n/g,"\n").replace(/\n/g,"\r\n")` before writing. Check `git diff --stat` afterwards: the line counts should match the intended edits. Prefer the Edit tool for a handful of changes.
