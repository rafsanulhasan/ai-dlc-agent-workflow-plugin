---
work-item: AAW-20261021-agent-models
agent: brutal-critique
stage: critique
round: 1
lifecycle: AAW
received: 2026-10-21
---

# Critique: model changes (5 agents) + agent-invocation "Model per spawn" (AAW-20261021-agent-models)

Verdict: REVISE

I used a read-only Grep/Read of the current files. I did not run `git diff`, so I judged the changed lines from the files as they stand. The `model:` values are as the plan says: product-owner, product-manager and system-engineer are sonnet. research-assistant and presentation-manager are haiku. orchestrator, agent-manager, software-architect and requirement-analyst are opus.

## Blockers
1. `skills/agent-invocation/SKILL.md:66-70` — The Sonnet trigger is not actionable, and it contradicts the rest of the repo. This was the stated intent of the change ("tell callers when a research-assistant spawn should use Sonnet").
   - The second trigger is "synthesise or compare, rather than look something up". Almost every non-locate research request is that. `research-assistant.md:25-27` and the Output Contract require triangulating two sources and returning a synthesized report. Its "When to Invoke" list includes "Comparing options" and "Deep cross-cutting codebase exploration where … synthesis is required". Read literally, the rule sends most spawns to Sonnet, which defeats the cost saving. Read loosely, it is never applied.
   - The first trigger asks the caller to know in advance that more than 80K tokens of input are expected. Nothing says how to estimate that before the spawn.
   - The delegation table at line 36 sends "explanation, options or design commentary" to `research-assistant`. The new bullet says that same work needs Sonnet, but line 36 does not say so.
   - Fix:
     - Replace the two triggers with a closed, checkable list. For example: Haiku for *locate* briefs and single-library or single-fact lookups with a bounded source set; Sonnet for a comparison between options, or for a brief that names more than N files or sources, or any whole-repository audit.
     - Give the caller a concrete way to judge the 80K figure, such as the number of files or documents the brief asks for.
     - Add "(pass `model: "sonnet"`)" to line 36.
     - Add one example each of a Haiku spawn and a Sonnet spawn.

## Major
1. `skills/agent-invocation/SKILL.md:70` — "Otherwise split a large question into smaller parallel Haiku spawns, one chunk each" is the opposite of the first trigger. A chunked question loses cross-source reasoning, which is the reason for escalating. It also multiplies spawns, and each cold spawn re-pays context and the memory and skill load. Either state that chunking applies only to independent chunks (for example, one library per spawn), or drop the sentence.
2. `skills/agent-invocation/SKILL.md:67` — The pricing facts are written into a durable skill: "Haiku 5.5 costs more above 100K prompt tokens". The parenthetical "the margin covers tokenizer differences" is cryptic. The 80K figure is derived from prices that will change. Keep the rule as a context-size threshold with a one-line reason ("Haiku's price rises on long prompts"). Put the version-specific price table in the work-item or ADR record, not the skill.
3. `agents/research-assistant.md` (body, "When to Invoke" and Workflow) — The agent body never mentions that it runs on Haiku by default or that callers can escalate it. The agent is told to triangulate, synthesize and explore the codebase in depth, which are workloads Haiku is weakest at. Add one line to the body telling the agent to state "Confidence: Low – needs Sonnet" and return an Open Question when the brief exceeds what it can handle. Without that, a Haiku run fails quietly instead of flagging it for escalation.
4. `agents/presentation-manager.md` on haiku, against `skills/agent-management/SKILL.md:42-45`, which says "haiku — read-heavy lookup or mechanical work … checked by another agent".
   - presentation-manager edits `.pptx` files in place, uses Bash and Write, and verifies every number by counting from source. Its Output Contract (lines 70-89) has no downstream reviewer.
   - The human approved haiku, so I am not asking you to reverse it. But the project's own selection rule is not met, and the change set neither updates the rule nor records the exception. Record the rationale (cost accepted because it works on a copy and renders for visual QA), or add an escalation note for large decks.
5. `skills/agent-management/SKILL.md:43` — This line lists the opus class as "orchestration, architecture, requirements, agent authoring". `product-owner` (scope, priority, release go/no-go, acceptance of requirement-analyst output) is a decision-maker whose errors spread downstream, and it is now sonnet. The human approved this. State in the rule or the work-item record that this is a deliberate exception, so a later `agent-manager` run does not "correct" it back to opus.

## Minor
1. `skills/agent-invocation/SKILL.md:66` — The bullet sits under the Claude Code section, which is correct. It says "Copilot ignores this choice: the build drops `model:`". I could not confirm that in the build tool, so it is listed under Unverified claims.
2. The bullet is the only place the escalation rule lives. `Skill("ai-dlc:request-routing")` and the orchestrator's brief checklist do not point to it. The orchestrator's `agent-invocation` read before each spawn is enough, but a "Model" line in the brief checklist (line ~115) would make it a step, not a footnote.
3. `system-engineer` and `product-manager` bodies have no deep-reasoning instruction that conflicts with sonnet. `system-engineer.md:29` already escalates architecture-changing decisions to `software-architect`, which is the right guard. No change needed.

## Unverified claims
- The `Agent(...)` call accepts a `model: "sonnet"` parameter. The repo does not document it, and I did not check the Claude Code tool schema. Route this to `research-assistant`.
- `tools/build-copilot.mjs` drops `model:` for Copilot. The orchestrator reports `--check` passed, but I did not read the tool.
- All prices (Haiku 5.5 $0.10/$0.50, rising to $0.50/$2.50 above 100K; Sonnet 5.5 $2/$10; Opus 5.5 $4/$20) come from the request and cannot be verified from the repo.
- The `validate --strict` runs and the `build-copilot --check` result are reported by the orchestrator. I received no raw output.

## What is good (keep it)
- The change to the five agents is the `model:` frontmatter line only, with no body edits. The aliases are not pinned ids, as `agent-management` requires.
- The "Model per spawn" bullet sits next to the other spawn parameters in the Claude Code section. It states the default and the override form, and it notes that Copilot ignores the choice.
- `agent-management/SKILL.md:42-45` and `plugin-management/SKILL.md:52` already carry a model-selection rule, so the change builds on an existing convention.
