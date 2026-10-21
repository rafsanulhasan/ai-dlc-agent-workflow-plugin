---
work-item: AAW-20261021-model-policy
agent: brutal-critique
stage: critique
round: 3
lifecycle: AAW
received: 2026-10-21
---

# Critique: plugins/claude/ai-dlc/skills/agent-management/SKILL.md (create-agent step 3, lines 42-49)

Verdict: PASS

## Blockers
None.

## Major
None.

## Minor
None raised.

## Check results
- **Major 1 (resolved):** Rule 2 now says "A finding, a verdict or a review is judgement, so reviewing and critiquing are never `haiku`." It no longer lists "a render" as a check. `presentation-manager` is described as a deliberate exception, and the text says no other agent checks it, which is accurate. `brutal-critique` and `code-reviewer` fall to rule 3 and are `sonnet`, as the frontmatter has them.
- **Minor 1 (resolved):** Rule 1 says "The list is closed: task plans and work breakdowns are not on it and fall under rule 3." Rule 3 names "task plans and work breakdowns".
- **Applying rules 1-3 to `plugins/claude/ai-dlc/agents/*.md`:** I read the `model:` line of all 15 files. They give 4 opus, 2 haiku and 9 sonnet, and every agent comes out as follows.
  - **opus (rule 1, 4 agents):**
    - `orchestrator` authors the routing plan.
    - `software-architect` authors specs and ADRs.
    - `requirement-analyst` authors stories and acceptance criteria.
    - `agent-manager` authors agent definitions.
  - **haiku (rule 2, 1 agent):** `research-assistant` does lookup and reporting, and its output is checked.
  - **haiku (stated exception, 1 agent):** `presentation-manager`.
  - **sonnet (rule 3, 9 agents):**
    - `code-reviewer`
    - `brutal-critique`
    - `devops-engineer`
    - `documentation-writer`
    - `product-manager`
    - `product-owner`
    - `system-engineer`
    - `software-engineer`
    - `sqa-engineer`
  - **Why the sonnet agents miss rules 1 and 2:**
    - `product-manager` writes task plans and work breakdowns, which rule 1 now excludes.
    - `system-engineer`, `documentation-writer` and `sqa-engineer` author nothing on the closed rule 1 list.
    - `product-owner` is a stated exception. Its decisions are not on the rule 1 list, and the human approves them at the gates.
    - `code-reviewer` and `brutal-critique` are excluded from rule 2 by its judgement sentence.
    - The rest do implementation or CI/CD work that is neither lookup nor mechanical editing.
- **Build check:** I did not run `node tools/build-copilot.mjs --check` myself. I take your report that it exited 0 after the rebuild, so treat that as Unverified.

## What is good (keep it)
- The closed list in rule 1 and the explicit "never `haiku`" for reviewing and critiquing make the rule order produce the team's models without needing the exceptions.
- The two exceptions are stated with their reasons, so a later reader will not "correct" them.
