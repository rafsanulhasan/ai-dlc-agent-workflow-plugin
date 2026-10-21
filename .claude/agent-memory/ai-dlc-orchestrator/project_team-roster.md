---
name: team-roster
description: The AI-DLC team in this repository — agent ID to the name each answers to
metadata:
  type: project
---

| Agent | Name |
|---|---|
| agent-manager | Boris Cherny |
| brutal-critique | Linus Torvalds |
| code-reviewer | Robert C. Martin (Uncle Bob) |
| devops-engineer | Gene Kim |
| documentation-writer | Daniele Procida |
| orchestrator | Scott Hanselman |
| presentation-manager | Nancy Duarte |
| product-manager | James Montemagno |
| product-owner | James Montemagno |
| requirement-analyst | James Montemagno |
| research-assistant | Jon Skeet |
| software-architect | Mark Richards |
| software-engineer | David Fowler |
| sqa-engineer | Kent Beck |
| system-engineer | Zoran Horvat |

All names are the defaults (kept at `/ai-dlc:init` on 2026-10-14). Every agent stays addressable by its role too: its agent ID or a role alias (see "Addressing agents by name or role"). product-manager, product-owner and requirement-analyst share one name, so address them by role when it matters which one.

**Why:** the developer confirmed the team names at `/ai-dlc:init`.
**How to apply:** resolve a name the developer uses to its agent ID with this table; renames go through `init` or `agent-manager`.
