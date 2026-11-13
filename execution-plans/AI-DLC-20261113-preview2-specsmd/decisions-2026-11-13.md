# Human decisions — preview2 planning (2026-11-13)

Asked by the orchestrator after comparing the Copilot conversation, specsmd research and repo evidence.

1. specsmd integration: **Adapt natively** — re-implement intents, units, bolts and the memory bank inside the ai-dlc plugin (agents/skills), MIT attribution to fabriqaai/specs.md; fix its inconsistencies; our own event model on top.
2. memory-bank authorship: **"Stage Agents Own their own docs but sole author is Doc Writer"** — stage agents own the content (truth, accountability); documentation-writer is the only agent that writes files in memory-bank/ (representation and persistence); brutal-critique gates.
3. preview2 scope: **Bank + bolts + events** — memory-bank/product and memory-bank/project; intents, units, bolts in the lifecycles; execution-plans/ with typed events (command, handoff, handback, verdict, escalation). Orchestrator still schedules; deterministic runtime deferred to a later release.
4. naming: **Keep ai-dlc ID** — plugin id, ai-dlc: prefixes, .ai-dlc/, AI_DLC_* unchanged; research-assistant checks a brand name (ForgeLine, Boltwright, Intently…) for clashes; rename decided in a later release.
5. base branch: plan/preview2 from feat/ai-dlc-lens 47a3480 ("Okay for now"), worktree .worktrees/preview2-planning.
6. Planning method: the human asked to plan with specsmd's own steps — intent → unit design → bolt design.

## Round 2 (after the PM breakdown)
7. Release order: **preview1 ships first** (current docs/ layout + lens); this redesign is **1.0.0-preview2**, breaking, with a migration path.
8. Dogfood: **memory-bank/ now** — this repo's preview2 planning artifacts go straight into memory-bank/ and execution-plans/, ahead of the tooling.
9. Fallback: **one release** — preview2 reads old docs/ paths with a warning; dropped in 1.0.0.
10. Backlog location: **memory-bank/project/**.
Orchestrator-settled (from D2/D3): events in preview2 = files + schema checked by validate; a memory-bank tree counts as documentation (documentation-writer sole author).

## Round 3 (product-owner clarifications, 2026-11-13)
11. Reader-facing documents (README.md files, docs/plugins.md, user guides, release notes) **stay in docs/**; lifecycle knowledge moves to memory-bank/. documentation-writer authors both.
12. Unit 11 (migrate this repo's legacy docs/ history) **must ship in preview2** — priority P1, not P2.
Also (human, 2026-11-13): **planning only** in this run — make plans, implement nothing.

## G1 (2026-11-13)
13. **G1 approved** by the human.
14. Human recommendation for unit design (input to G2): "2 units for the product in the repo: **ai-dlc-engine** and **ai-dlc-lens**".
