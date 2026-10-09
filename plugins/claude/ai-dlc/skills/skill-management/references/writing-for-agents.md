# Writing for Agents

How to write any document an agent reads: a `SKILL.md`, an agent definition body, a rule or instructions file, `AGENTS.md`, `CLAUDE.md`, or a reference file reached by a link. The packaging differs; the craft is the same. The goal is not identical output on every run but an agent that takes the **same process** every run.

## 1. Pointers decide when material is read

A **pointer** is text that stays in the agent's context and names material that does not: a skill or agent `description`, a line in `CLAUDE.md` naming a doc, a link from `SKILL.md` to `references/<file>.md`. The pointer's wording, not the target, decides whether and when the agent reaches the material.

- A pointer states **what the material is** and lists the **branches** that should trigger it — each distinct situation the material handles.
- **Front-load the trigger word.** Put the word the agent (and the human's prompts) will actually use at the start.
- **One trigger per branch.** Three synonyms for one situation are one branch written three times; keep one.
- **Cut identity the body already carries.** The pointer is always loaded; every word in it is paid on every turn.
- When required material is being missed, **sharpen the pointer first**. Inline the material only if a sharper pointer still fails.

## 2. Two budgets

- **Context load** — what sits in the agent's window every turn whether it is needed or not: descriptions, `CLAUDE.md`/`AGENTS.md` lines, always-on rules. Spend it only on what changes behaviour often.
- **Cognitive load** — what the human must remember: which skills exist and when to type them. It buys human control; spend it where human judgement matters and remove it where it does not.

Material behind a pointer costs only the pointer's line in context. Material with no pointer at all exists only in the human's memory.

## 3. Information hierarchy

A document holds **steps** (ordered actions) and **reference** (rules, definitions, facts consulted on demand). Place each piece on the ladder by how immediately the agent needs it:

1. **In-file steps** — what the agent does, in order.
2. **In-file reference** — consulted while doing the steps. A flat set of peer rules is fine here.
3. **Disclosed reference** — moved to `references/<topic>.md` (or any external file) and reached by a pointer.

**Disclose by branch:** keep inline what every run needs; move behind a pointer what only some runs reach. Reference left inline around steps buries the steps and makes following them a coin flip.

**Co-locate:** keep a concept's definition, rules and caveats under one heading. Scattering one meaning across a file is as harmful as duplicating it.

**Sprawl** — a file too long even when every line is live — is fixed with the ladder: disclose reference, or split by branch or by sequence so each path carries only what it needs.

## 4. Steps end on completion criteria

Every step ends on a condition that tells the agent it is done.

- **Clear.** The agent can tell done from not done. "Understand the codebase" invites **premature completion** — the agent's attention slides to the visible steps ahead. "Every caller of the changed interface listed" does not.
- **Demanding.** The criterion sets how much legwork the step gets. "Every modified model accounted for" forces thoroughness that "produce a change list" does not. Demand works on reference too: "every rule applied" binds a flat checklist.

The strongest criteria are checkable *and* exhaustive. When a criterion is irreducibly fuzzy and agents visibly rush it, hide the later steps by **splitting the sequence across a real context boundary** — a handoff to another agent or a subagent spawn. Calling another skill inline does not hide anything; the later steps stay in context.

## 5. When to split a document

Splitting creates a new pointer (context load) or a new thing to remember (cognitive load). Split only when the cut earns it:

- **By sequence** — the steps after the current one tempt the agent to rush it. Merging sequences has the opposite effect: every step sees what follows.
- **By invocation** — a separate skill is worth its always-loaded description only if a distinct trigger word should fire it on its own, or another skill must call it.

## 6. Invocation choice for skills

| Choice | Frontmatter | Description is | Use when |
|---|---|---|---|
| **Model-invoked** | no `disable-model-invocation` | A model-facing pointer with every trigger branch (section 1 applies in full) | The agent must reach the skill on its own, or another skill or agent must call it |
| **User-only / followed** | `disable-model-invocation: true` | A one-line, human-facing summary; no trigger lists | Only a human types it, or another skill reads its `SKILL.md` directly (as `init` does) |

A model-invoked skill whose body is all reference is a good home for reference that several skills share. Reference shared by user-only skills belongs in a plain file both can link to, since neither can call the other.

## 7. Leading words

A **leading word** is a compact concept the model already knows — *tracer bullet*, *frontier*, *red*, *tight loop*, *expand–contract* — repeated as a token wherever the behaviour applies. It recruits the model's existing understanding in one or two tokens, and the same word in prompts, docs and code makes the material easier to reach.

- Hunt for phrases spelled out repeatedly ("fast, deterministic, low-overhead") and replace them with one word (*tight*).
- Prefer an existing word to a coined one; a coined word must be defined and recruits nothing.
- A word too weak to beat default behaviour (*thorough*) is a no-op; reach for a stronger one (*exhaustive*, *relentless*), not more sentences.

## 8. State the target, not the prohibition

Naming a forbidden behaviour puts it in context and makes it more likely. Write the behaviour you want ("write one-line comments") rather than the one you do not. Keep a prohibition only as a hard guardrail that cannot be phrased positively, and pair it with the positive target.

## 9. Pruning

- **Single source of truth.** Each meaning lives in one place; a change is a one-place edit. Duplicates cost tokens and inflate a rule's apparent importance.
- **The environment is a source of truth.** Build scripts, config files, directory layout and `--help` output already say what they say. Restating them creates a stale cache. Write down what the agent cannot discover by looking: unwritten conventions, the reason behind a choice, the gotcha no config reveals.
- **Relevance.** Each line must still bear on what the document does. Lines that never bore on the task, or that went stale, settle into **sediment** that later readers must dig through. Remove them.
- **No-ops.** Delete any sentence the model would obey by default — test by whether it changes behaviour, and settle disagreements by running the document, not by debate. Delete the whole sentence rather than trimming words from it.

## Review checklist

Run this on every new or changed agent-facing document before finishing:

- [ ] The description or pointer front-loads the trigger word, names each branch once and carries no identity the body repeats.
- [ ] The invocation choice matches who must reach the skill; a `disable-model-invocation: true` skill has a one-line human description.
- [ ] Every step ends on a clear, demanding completion criterion.
- [ ] Material only some runs need is disclosed under `references/` and linked; each concept is co-located under one heading.
- [ ] No meaning is stated twice, and nothing restates what a file, script or `--help` already shows.
- [ ] Instructions state the target behaviour; any remaining prohibition is a hard guardrail paired with its positive form.
- [ ] Repeated phrasings are collapsed into leading words.
- [ ] No sentence is a no-op, and nothing is stale.
