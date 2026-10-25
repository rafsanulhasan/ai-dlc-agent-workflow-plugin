---
kind: tasks
epic: ai-dlc-lens
sprint: sprint-1
folder: diagramming
root: 20
priority-note: stretch; moves to docs/product/backlog/ai-dlc-lens/diagramming/ first if sprint 1 ends (product-owner, brief QS)
module: ai-dlc-lens
submodule: diagramming
integrations: []
source: docs/handoffs/FEAT-20261020-ai-dlc-lens/14.1.15-research-assistant-to-orchestrator.handback.md; plan 00c root 20
stories: stories.md (requirement-analyst)
---

# Root 20: lens diagramming submodule

Offline only, never a remote renderer (human decision 20). Order: Mermaid, then LaTeX math (bundled MathJax), then PlantUML only with a local Java and jar. Plan ACs: AC1 closed fences render below the reply with the source visible; AC2 open or streaming fences are not rendered; AC3 no network request while rendering; AC4 over the 131,072-character Svg cap, or an error, shows the source plus a one-line reason; AC5 PNG through `Image` on the terminal, Svg in VS Code and desktop; AC6 `THIRD_PARTY_NOTICES.md` entries for every idea reused; AC7 lens `validate` and tests pass.

Common tags: module ai-dlc-lens, submodule diagramming, feature diagramming, integrations none. Priority P2. Build items edit the lens `register.tsx`: merge one at a time (group LENS), and after the scope-v1 lens run's merge.

| ITEM | Task | Goal | Covers | Blocked by | Triage |
|---|---|---|---|---|---|
| 052 | 20.1 | Spike (plan: "Spike first"), with a manual check by the human in VS Code like spikes 027 and 029: can an `AssistantMessage` render replace one fence inside a reply (engine typing `claude-code.d.ts:10320`, `Markdown` at `:5871`)? Written result in the run folder: works / does not / fallback "render beneath the reply". Scratch mod deleted afterwards, as the earlier spikes 027 and 029 | decides AC1 shape | G1 | ready-for-agent |
| 053 | 20.2 | Mermaid: detect closed fences, render offline (mermaid-inline approach: local layout plus resvg-wasm PNG for terminal; Svg for VS Code and desktop), source stays visible, no network call, cap/error falls back to source plus reason | AC1-AC5 for Mermaid, defining the shared pipeline | 052, G2 | needs-info |
| 054 | 20.3 | **Sprint 2 (backlog; moved out of sprint 1 by the human, 2026-10-25).** LaTeX math fences and `$$` blocks via bundled MathJax, same fallbacks | AC1, AC4, AC5 for math; AC2 and AC3 re-tested on the shared pipeline | 053 | needs-info |
| 055 | 20.4 | **Sprint 2 (backlog; moved out of sprint 1 by the human, 2026-10-25); the spike's 053.a2 security-profile check is deferred with it.** PlantUML only when a local `java` and `plantuml.jar` path are configured (trust check as the avatar path, `avatar.ts:205-262`); otherwise the source plus a notice; PlantUML licence checked at G2 | AC1, AC3, AC4 for PlantUML, plus source and a notice when no Java and jar are configured | 053 | needs-info |
| 056 | 20.5 | **Sprint 1 notice list (AC-20.7.1a):** `THIRD_PARTY_NOTICES.md` entries for beautiful-mermaid (MIT), elkjs (EPL-2.0), `entities` (BSD-2-Clause), resvg-wasm (MPL-2.0), Inter with the OFL-1.1 text, mermaid-inline (MIT), and claude-code-figures (Apache-2.0, NOTICE checked) only if reused; plus the lens `hooks/ATTRIBUTION.md`; `plugin validate --strict` and `plugin test` for ai-dlc-lens pass. The MathJax, LaTeX Inline and PlantUML entries are sprint 2 (ITEM-075); `claude-latex` is dropped (renamed LaTeX Inline, spec D8). Evidence owed (owner software-engineer): the esbuild `--metafile` package list for `vendor/mermaid.mjs`, in the spike evidence or `BUILD.md`, so the licence inventory is verified | AC6, AC7 (for the 053 upstreams in sprint 1; the 054 and 055 upstreams move to ITEM-075) | 053 | ready-for-agent after |
| 075 | 20.6 | Sprint 2 follow-up of 056: `THIRD_PARTY_NOTICES.md` and `ATTRIBUTION.md` entries for 054 (MathJax, claude-latex, LaTeX Inline) and 055 (PlantUML, any reused idea); lens `validate` and `test` pass. Added 2026-10-25 | AC6, AC7 (for those upstreams) | 054, 055, 056 | needs-info |

Scope change 2026-10-25: 054 and 055 are sprint 2 (human); 056 covers 053 only in sprint 1, with ITEM-075 for the rest. Plan: `docs/plans/tier-1-sprint-1.tasks.md` section 12.6.

Triage notes (053-055). Established so far: offline default, order of languages, the Svg cap, the trust model (14.1.15). Still needed (from the human at G1, defaults in brackets): Q20a PNG rasteriser dependency (resvg-wasm, MPL-2.0; accepted after the spike licence check); Q20b fences from `Read` results of planning artifacts [no, chat replies only]. Design (renderer packaging, how a PNG and an Svg path share one pipeline) is the architect's at G2.
