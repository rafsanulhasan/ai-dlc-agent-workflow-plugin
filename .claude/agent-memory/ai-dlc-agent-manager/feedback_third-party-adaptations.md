---
name: third-party-adaptations
description: Rules for merging ideas from third-party skill repos (mattpocock/skills, JuliusBrussee/caveman) into plugin skills — attribution lines, trademark names, voice
metadata:
  type: feedback
---

When adapting a third-party skill repo into `plugins/claude/ai-dlc/`, rewrite in our voice (never paste), keep skills language-agnostic, and end every new or changed SKILL.md with that source's attribution line; stack a second source's line under an existing one (mattpocock line first, then caveman line). Licence texts live in `THIRD_PARTY_NOTICES.md`.

**Why:** User requirement on branch feat/merge-community-skills (2026-10-10). "Caveman" is a trademark: the word (and "cave", "ultracave", "cavecrew") must never appear in a skill name, heading, trigger phrase, command or file name — only in the attribution link.

**How to apply:** Name adapted techniques generically (e.g. `terse-output`, "compressed report", "compact format"). Grep changed files for the trademark before finishing; only the attribution URL may match.
