# Human decisions — preview2 planning (2026-11-13)

> Numbering: item `N.` below is decision **DN** (for example `23.` is D23). Cited as D1–D25 in the memory bank.

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

## After G1 — direction change (2026-11-13)
15. **Rename the `ai-dlc` plugin to `ai-dlc-engine` in preview2** (reverses D4 for the plugin name). Consequences the human was told: every agent and skill becomes `ai-dlc-engine:<name>` (Claude Code namespaces by plugin name), agent-memory folders become `.claude/agent-memory/ai-dlc-engine-<agent>/`.
16. **`.ai-dlc/` folder and `AI_DLC_*` environment variables stay** as family names shared by ai-dlc-engine and ai-dlc-lens.
17. **Rename the marketplace too** (today `ai-dlc-agent-workflow`; the option text proposed `ai-dlc` as an example — exact name to confirm at G2). GitHub repository rename decided separately, later.
18. Product units (human, D14): **ai-dlc-engine** (today's `ai-dlc` plugin) and **ai-dlc-lens**. The 13 work items of 1.1.6 become bolts/stories within these two units (orchestrator's reading, to be confirmed by unit design).
19. Plugin source folders move: `plugins/claude/ai-dlc/` → `plugins/claude/ai-dlc-engine/`, generated `plugins/copilot/ai-dlc/` → `plugins/copilot/ai-dlc-engine/` (human, 2026-11-13).
20. Display name "AI-DLC Engineering Team" kept; keywords keep `ai-dlc` and add `ai-dlc-engine` (human, 2026-11-13).
21. Marketplace name: **`ai-dlc-suite`** (human, 2026-11-13); `ai-dlc` is taken by TheBushidoCollective/ai-dlc (1.1.15). Install becomes `ai-dlc-engine@ai-dlc-suite`. research-assistant clash-checks it before G2.
22. Lens commands move into the ai-dlc-lens plugin **and drop the redundant "lens" prefix**. Human's words: "ai-dlc-lens:show, ai-dlc-lens:configure". Orchestrator's reading of the full map (to confirm at G2): `/ai-dlc:lens` → `/ai-dlc-lens:show`; `lens-configure` → `/ai-dlc-lens:configure`; `lens-init` → `/ai-dlc-lens:init`; `lens-kit` → `/ai-dlc-lens:kit`; `lens-keepalive` → `/ai-dlc-lens:keepalive`; `lens-gate` → `/ai-dlc-lens:gate`.
23. Plugin rename (ai-dlc-engine) and marketplace rename (ai-dlc-suite) **both in preview2** — one clean break; users remove the old marketplace, add `ai-dlc-suite`, reinstall; upgrade guide warns that removing a marketplace deletes the plugin's stored data and settings (1.1.16 b).
Planned (orchestrator): a spike bolt first in construction live-tests the marketplace/plugin rename and the memory-folder derivation (1.1.16 open questions).
24. Lens command map (human, 2026-11-13, answering the D22 confirmation): "engine and lens both has their own init commands. keepalive and auto handoff is a part of engine." Orchestrator's reading: `/ai-dlc-engine:init` and `/ai-dlc-lens:init` are separate commands; `lens-keepalive` does **not** move to the lens — keep-alive (and auto-handoff) stay engine features, so its command lives in ai-dlc-engine (whether it merges into `/ai-dlc-engine:cache-keepalive` is for the architect to propose at G2); `kit` and `gate` follow the D22 pattern (`/ai-dlc-lens:kit`, `/ai-dlc-lens:gate`) — not contradicted.
25. Migration and settings (human, 2026-11-13): "now change the repository's settings files and design a skill which will be shipped with the plugin". Reading: the migration does change the repository's settings files (as proposed), and its entry point is designed as a **skill shipped with the ai-dlc-engine plugin** (G2 design). Not executed now: the run stays planning-only, and switching this repo's settings before the rename exists would break the current tooling.

## G1 amendment and G2 design (2026-11-13)
26. **G1 amendment (FR-17) approved** by the human.
27. Unit model: **stable unit names** (`memory-bank/product/units.md` registry; folders `intents/{NNN}-{slug}/units/{unit-slug}/`) — ADR-0016.
28. Keep-alive lens toggle: **`/ai-dlc-engine:cache-keepalive-lens [on|off]`** (engine skill, answered by the lens module).
29. **`probe` stage** (ASDLC, software-engineer, writes only to `.scratch/`) **and spike bolt 001 first**, before any rename or migration bolt.
