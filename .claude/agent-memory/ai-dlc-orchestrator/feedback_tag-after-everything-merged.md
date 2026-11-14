---
name: tag-after-everything-merged
description: Tag a release only after every non-preview change on the branch is committed and merged; deleting a tag/release is blocked for agents in auto mode, so the human does it
metadata:
  type: feedback
---
Before tagging a release, make sure everything that belongs to it is committed, merged and listed in the release notes (CHANGELOG): no code commit may land on the release branch after the tag.
**Why:** 2026-11-14, v1.0.0-preview1 was tagged on 9eae890 while the herdr pane-layout change and records were still on the branch; the human had the tag removed twice and re-tagged (final: 57ca76b, PR #28), and the notes first missed herdr entirely.
**How to apply:** at the release stage, check `git log origin/main..<branch>` is empty of code and that the notes name every shipped item (ask documentation-writer for missing ones) before devops-engineer tags. Deleting a tag or GitHub release is refused by the auto-mode classifier for subagents even with allow rules in settings.local.json; ask the human to run `gh release delete <tag> --yes --cleanup-tag` and `git tag -d <tag>` themselves (via `!`). Release records written after the tag are fine to commit later. Related: [[commits-by-devops]], [[gpg-signed-commits]].
