---
run: AAW-20261022-review-rounds-consumers
work-item: WI-2a
lifecycle: AAW
step: 2
from: brutal-critique
to: orchestrator
mode: subagent
loop: none
received: 2026-10-22 08:58
---

handoff 2-orchestrator-to-brutal-critique.handoff.md: passed — record exists; sibling records (1-orchestrator-to-agent-manager.handoff.md, 1-agent-manager-to-orchestrator.handback.md, run.md) exist; all 8 listed docs paths exist and carry the described change. Not re-run (no shell): build --check, 263 tests, byte-identity of .ai-dlc/ vs templates.

# Critique: review-limit consumers (orchestrator.md, AGENTS.md, init, ai-dlc, agent-invocation, request-routing, handoff, README, docs/plugins.md)

Verdict: REVISE

## Blockers
1. `plugins/claude/ai-dlc/agents/orchestrator.md:72` (twin `AGENTS.md:74`, `init/templates/AGENTS.md:74`) — The DW↔BC critique rule has no source in the design and hand-computes precedence incompletely. `workflow/SKILL.md:57` says the `AI_DLC_CRITIQUE_*` variables override "every loop whose stage agent is that reviewer"; DW↔BC has no loop, so `workflow.mjs:561` never applies them to it. No design file (`workflow/SKILL.md`, `references/aaw-review.md`) states the "2 rounds / 1 failure, env-overridable" rule for it — it lives only in the orchestrator body, so a reader of the design source cannot verify it. The orchestrator body also omits the resolution rules the design defines at `workflow/SKILL.md:81-84` (valid-value regex — `007`, `1.5`, `true` invalid; blank-value skip; warning on invalid; the combined check maxFailures ≥ maxRounds → ignore the variables), so two orchestrators will resolve the same settings differently. → Add the DW↔BC rule to `workflow/SKILL.md` *Loop limits* (or `aaw-review.md`), including that `rounds` does not list it, then have `orchestrator.md:72` point there: "limits per the `workflow` skill, *Loop limits*, valid-value and combined-check rules apply". Drop the hand-written precedence sentence (or add the missing rules). Rebuild the twins.

## Major
1. `init/SKILL.md:48`, `:93` — The review-limit question tells the developer the Linus Torvalds (`brutal-critique`) pair is for "document critique", but step 93 writes it only into `brutal-critique` stages that have a `loop` — in the default file, the `AAW` critique loop. The DW↔BC critique at gates has no file value, so the answer never reaches it (only the env variables might, per the Blocker). → Say so in the question ("AAW critique loop"), and that gate critique stays at 2 / 1 unless the variables are set.
2. `init/SKILL.md:48` — "for an existing workflow file, the values its loops already hold" is undefined when loops of one reviewer differ or have no `maxFailures` (e.g. older files with `maxRounds: 3` and no `maxFailures`, which `workflow/SKILL.md:151` says now stops at the 2nd failure). Step 93 then sets one pair on all of that reviewer's loops and silently flattens per-loop customisations, contradicting the "never overwrite" tone of step 92. → State the rule: show the loops' current pairs, offer the default only where all agree, otherwise ask or "keep"; and say that an answer overwrites every loop of that reviewer.
3. `README.md:58`, `docs/plugins.md:127` — They say `upgrade` adds the missing limits "without overwriting your values" but omit the behaviour change disclosed at `workflow/SKILL.md:151-154`: `AAW` loops with `maxRounds: 3` and no `maxFailures` now stop at the 2nd failure with round 3 unused, and an omitted `clarify.maxRounds` went from 3 to 2. Users reading only the README or plugins doc learn nothing of this. → One sentence in each: "limits an older file left implicit are now 2 rounds / 1 failure (clarify was 3); set `maxRounds` 3 and `maxFailures` 2 to keep three full rounds".

## Minor
1. `init/SKILL.md:93` — "every stage whose `agent` is that reviewer" includes stages with no `loop` (BFLC `regression-test`, TLC `tests`, TLC `plan` with `critique`), which have nothing to set → "every `loop` on a stage whose agent is that reviewer".
2. `orchestrator.md:70` — "ask the human once for that stopped step" does not say what happens when two stopped steps arrive in one `AAW` round (the AAW step 5 line has the same gap) → "one question per stopped step, asked together".
3. `handoff/SKILL.md:245-247` — Row 247 ("limits raised to 3 / 2 for this run (one-off)") shows a mechanism not yet defined — the known open point, not counted as a finding; flagged only so the example is revisited when that point is closed.
4. `orchestrator.md:86` (Run Loop 1) — "keep … and record them in each run state" does not say where in `run.md`; the handoff example at `:245` implies the *Gates and loops* table → name the section.

## Unverified claims
- `docs/plugins.md:125` says `validate` fails on a `maxFailures` not below `maxRounds` — I did not run `validate` against such a file; `workflow/SKILL.md:55` asserts it.
- The `merge` CLI flags `--template`, `--plugin`, `--dry-run` used at `init/SKILL.md:92` are confirmed in `workflow.mjs` usage lines 11-22; that `merge` never deletes or overwrites was not checked in code.
- The orchestrator evidence in the brief (263/263 tests, `--check`, byte-identity) — not re-run by me.

## Checked, clean
- No stale "shared budget", fixed 3 or "clarify default 3" in the 9 consumers; remaining hits are the intentional upgrade-note text in `workflow/SKILL.md:149,154`.
- `maxFailures` stops alongside `maxRounds`: `orchestrator.md`, `ai-dlc/SKILL.md:155`, `agent-invocation` (Clarify), `docs/plugins.md`, `README`.
- A fix round counts against the limits: `orchestrator.md:70`, `workflow/SKILL.md:32`.
- `rounds --json` is the source of truth in `orchestrator.md` (line 70 and Run Loop 1).
- `AGENTS.md` matches `orchestrator.md` on the loop-limit lines; the generated `init/templates/AGENTS.md` matches too.
- The init settings.json merge is JSONC-safe and adds only missing keys (`init/SKILL.md:75`); the template does contain `agent` and `env`.
- Env variable names match `workflow.mjs:561-563`.

## What is good (keep it)
- The one-line pointer pattern in `ai-dlc`, `request-routing` and `agent-invocation` ("default 2 / 1, as `rounds` prints them") keeps the rule in one place.
- The init flow orders legacy-key removal → `merge --dry-run` with consent → the limits diff, and states that init writes no env variables.
- The `handoff/SKILL.md:245-247` run-state rows (limits at run start, `round n / max · failure n / max`) make resumption auditable.
