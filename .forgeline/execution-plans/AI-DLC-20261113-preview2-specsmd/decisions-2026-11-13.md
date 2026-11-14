# Human decisions — preview2 planning (2026-11-13)

> Numbering: item `N.` below is decision **DN** (for example `23.` is D23). Cited as D1–D41 in the memory bank.

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
30. **Marketplace renamed to `forgeline`** (human, 2026-11-13: "rename the marketplace to forgeline") — supersedes D21's `ai-dlc-suite`. Install ids become `ai-dlc-engine@forgeline` and `ai-dlc-lens@forgeline`. Note: 1.1.8 found a private-beta AI-agent product called "Forgeline" (single source; some risk); the brand research (FR-13, P3) now covers `forgeline`. Plugin names unchanged (`ai-dlc-engine`, `ai-dlc-lens`); repository name unchanged.
31. **Lens plugin renamed to `lens`** (human, 2026-11-13: "not ai-dlc-lens@forgeline, lens@forgeline") — install id `lens@forgeline`; reverses D16's "ai-dlc-lens name unchanged". Consequences: lens commands become `/lens:show`, `/lens:configure`, `/lens:init`, `/lens:kit`, `/lens:gate`; folder `plugins/claude/lens/` (to confirm). Whether the engine follows the same pattern (`engine@forgeline`) — asked of the human.
32. **Engine plugin renamed to `engine`** (human, 2026-11-13: "engine@forgeline") — supersedes D15's `ai-dlc-engine`. Prefixes `engine:<id>`, `/engine:<skill>` (`claude --agent engine:orchestrator`, `/engine:init`, `/engine:migrate`, `/engine:cache-keepalive-lens`); memory folders `.claude/agent-memory/engine-<agent>/`; install `engine@forgeline`. With D31: lens commands `/lens:show|configure|init|kit|gate`; install `lens@forgeline`. Plugin folders `plugins/claude/engine/`, `plugins/copilot/engine/`, `plugins/claude/lens/` (D19 applied to the new names). Unit slugs (D27) follow the plugin names: `engine`, `lens` (orchestrator's reading). Family names `.ai-dlc/`, `AI_DLC_*`, managed-block markers stay (D16, R1).

## G2 critique answers (2026-11-14)
33. Lens pane ids follow the plugin name (human: "lens:*") — O-17 closed. Note: research 1.1.16 (a) / `ai-dlc-lens/hooks/register.tsx:24-29` say pane ids cannot contain `:`, so the literal form `lens:*` is likely invalid; proposed `lens-*` (to confirm with the human; spike checks the pane-id character rule). Saved layouts with the old `ai-dlc-lens-*` ids need migrating.
34. Unit names **`engine` and `lens`** confirmed — O-20 closed.
35. Engine manifest keywords (human): **`specmd`, `ai-dlc`, `forgeline`, `agentic-sdlc`** — O-22 closed (the human wrote `specmd`; the upstream project is `specsmd` — to confirm the spelling).
36. Keyword spelling **`specsmd`** (human, 2026-11-14) — D35's keywords are `specsmd`, `ai-dlc`, `forgeline`, `agentic-sdlc`.
37. Lens pane ids **`lens-*`** confirmed (human, 2026-11-14): `lens-kit`, `lens-edge`, `lens-agent`, `lens-chart`, `lens-runs`; the lens closes panes open under old `ai-dlc-lens-*` ids (D33 made concrete).

## G2 (2026-11-14)
38. **G2 approved** by the human — frozen spec 001, unit design, ADR-0011..0016, narrative, draft bolt plan, and the amended FR/AC text with the final names (O-15).
39. O-1, O-2, O-3 accepted: migration skill **`/engine:migrate`**; identical legacy duplicates are **dropped** (printed as `drop`); user-level and managed settings get **advice only**.
40. O-6, O-7 accepted: the **human accepts the spike (bolt 001) hand-back**; bolt 001 runs as **ASDLC with a one-off override research → probe → architecture**, recorded in its routing plan (confirmed at G3).
41. O-5 confirmed: lens commands **`/lens:show`, `/lens:configure`, `/lens:init`, `/lens:kit`, `/lens:gate`**.

## G3 (2026-11-14)
- **D42 (Q1, self-hosting, Risk 1):** "now" — point this repository's `artifacts.handoffs` at `execution-plans/` now, instead of keeping the team on a pre-rename checkout until ITEM-121 (the architect's recommendation, 1.1.23 §6). Applied as feature 6 of this run (AAWH: product-owner intent → agent-manager change to `.ai-dlc/workflow.json` on `plan/preview2` → brutal-critique).
- **D43 (product-owner, 1.1.25; no human decision needed):** R-3 AC-17.14 owned whole by engine bolt 001, lens bolt 010 consumes findings (c), (e), (h), (i) — R8 amended; R-8 `docs/follow-ups.md` moves to `memory-bank/project/` in ITEM-121; O-4 yes (toast once per session + one gate-list entry per scan = one warning per scan).
