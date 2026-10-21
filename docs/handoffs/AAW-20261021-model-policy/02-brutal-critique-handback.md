---
work-item: AAW-20261021-model-policy
agent: brutal-critique
stage: critique
round: 1
lifecycle: AAW
received: 2026-10-21
---

# Critique: AAW-20261021-model-policy (agent-management create-agent step 3, plugin-management line 52, skill-management line 34)

Verdict: REVISE

I read the three files and grepped the agent frontmatter. I could not run `git diff`, so I judged the current text only. I did not see the removed wording.

## Blockers
None.

## Major
1. skill-management/SKILL.md:34, the "model" input has no destination.
   - The step asks the user for a model, but the Skill File Template (lines 41-49) has only `name` and `description` frontmatter.
   - No `SKILL.md` in the plugin sets `model:`. A grep over `skills/**/SKILL.md` finds one hit: the agent template inside agent-management (line 75).
   - The model is collected and then dropped, or written into a frontmatter field the template does not define.
   - Fix: either delete "model (an alias, default `sonnet`, never a pinned id)" from the line, or add `model` to the template with a sentence saying what a skill's `model` does.
   - Your question was whether skills may take a model field. I cannot confirm that from the repository. If it matters, send it to `research-assistant`.
   - Keeping the alias wording on a field the skill never writes is worse than omitting it.

2. agent-management/SKILL.md:42-45, the tier rule is not applied the same way to the existing agents.
   - Pairs that the rule does not separate:
     - `requirement-analyst` is opus, but `product-owner` and `product-manager` are sonnet. All three do scope or requirements work, and the rule says opus covers "requirements" while sonnet covers "planning".
     - `system-engineer` (low-level design) is sonnet while `software-architect` is opus. The rule names "architecture" for opus, so that gap is defensible, but the rule never says why design below architecture is sonnet.
     - `presentation-manager` is haiku. Its work is deck authoring, which is neither "read-heavy lookup" nor obviously "mechanical". "Checked by another agent" is not a fact stated anywhere for it.
   - The rule is a heuristic with named examples, not a decision procedure. An agent can reach opposite answers for planning versus requirements.
   - Fix: add one line saying the tier list is a guide, plus a decision order. For example: if the agent writes a document that other agents build on (spec, stories, agent definition), it is opus; else if it only reads and reports, haiku; else sonnet.
   - Then state which of `product-owner`, `product-manager` and `presentation-manager` the rule places where, so the current assignments follow from it.

3. The opus list is internally inconsistent with its own criterion, "spawned rarely".
   - `requirement-analyst` is spawned once per feature, which fits.
   - `orchestrator` and `agent-manager` are named for opus on the ground of error spread, not frequency.
   - Both criteria are joined by "and", so an agent that is spawned often and whose errors spread (`software-engineer`) is not covered. That is a gap, not a contradiction: the rule does not say what to do when the two criteria split.
   - Fix: say which criterion wins when the two split (for example, error spread beats frequency for opus).

## Minor
1. agent-management:42 says `fable` is "allowed but never the default", but nothing says when to use it. A reader cannot apply the sentence. Either drop `fable` or add a one-clause use case. The same applies to the cost goal: the request is to minimize cost, and the rule does not say where `fable` sits in the cost order.
2. plugin-management:52 lists only `haiku` / `sonnet` / `opus` and omits `fable`, while agent-management allows it. The two files should list the same set. A cross-reference ("aliases as in `agent-management`") would stop the drift.
3. plugin-management:52 and skill-management:34 are both single lines in a long bullet. Keep the policy in one place (agent-management) and have the other two point to it. That is half done in plugin-management ("choose by the rule in `agent-management`, *Mode: create-agent*") and not done in skill-management.
4. agent-management:130 and :180 ("must have: `name`, `description`, `tools`, `model`") do not say the `model` value must be an alias. Add "alias" there if you want the policy enforced at validation time.
5. "Planning" in line 44 collides with the product-owner / product-manager role names. Replace it with a concrete phrase such as "work breakdown, scope and priority decisions".

## Unverified claims
- Whether Claude Code skills accept a `model` field. It is not in this repository, and I did not check external docs.
- Whether `fable` is a valid alias. It appears only in agent-management:42, and no agent uses it.
- Cost ordering of the tiers. The request is cost minimization, but the repository holds no pricing data. That belongs to `research-assistant` if the doc is meant to justify cost.

## Consistency check
- agent-management:42 and plugin-management:52 agree on "alias, never a pinned id", with `sonnet` as the default. No stale `claude-sonnet-4-6` remains anywhere in `plugins/claude/ai-dlc` (grep found none).
- Current frontmatter matches the intent's list exactly:
  - opus: `orchestrator`, `agent-manager`, `software-architect`, `requirement-analyst`
  - haiku: `research-assistant`, `presentation-manager`
  - sonnet: the other seven
- Your build check passed, so the Copilot twin is in sync. I did not re-run it.

## What is good (keep it)
- The tier rule is short, uses concrete role names, and sits in the one mode (create-agent) where the choice is made.
- plugin-management points to agent-management instead of repeating the rule.
