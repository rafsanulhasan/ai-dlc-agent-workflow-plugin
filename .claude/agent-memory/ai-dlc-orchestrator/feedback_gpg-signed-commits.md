---
name: gpg-signed-commits
description: Commits here are GPG-signed and pinentry prompts time out or hide; agents never disable signing; ask the human to answer the prompt
metadata:
  type: feedback
---

Commits in this repository are GPG-signed (`commit.gpgsign=true`). Signing often times out ("gpg: signing failed: Timeout") because the pinentry window is hidden or not answered, and a waiting commit holds `.git/index.lock`, which blocks every other agent's commit. Agents and the orchestrator never disable signing.

**Why:** run AAWP-20261112-herdr-skill (2026-11-12) lost hours to stuck commits; the human chose "I'll enter the passphrase" / "Retry, I'm watching" each time, never unsigned commits.

**How to apply:** commits are made by devops-engineer only ([[commits-by-devops]]); tell the human as soon as a commit waits on pinentry (name the PID); brief agents to commit only their own paths (`git commit -- <paths>`) and, if git is locked, leave changes uncommitted and list them; batch the waiting commits and run them in the foreground while the human watches.
