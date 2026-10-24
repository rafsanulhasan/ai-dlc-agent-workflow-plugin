# Routing Plan: ai-dlc-lens + ai-dlc integrations, AAW redesign, agile backlog (FEAT-20261020-ai-dlc-lens, scope v2)

## Context
The lens plugin is built (feature root 8) and its run is waiting for G2–G4. You want a new scope in the same run. It covers:
- understand and fix the lens's core features in VS Code;
- integrate the lens with ai-dlc: run states grouped by module, submodule and feature; auto-handoff sessions as their own charts; cache lab and context lab;
- a runs launcher and popup for VS Code;
- two bugs: auto-handoff session numbering, and the keep-alive 5m status line;
- AAW split into a harness variant and a plugin/mod variant;
- an agile backlog layout: docs/PO active vs backlog, a new Agile skill.

The taxonomy must ship as a plugin feature that any repository configures, not as a memory or project-only skill. This repository's taxonomy (AI-DLC, AI-DLC-LENS, Integrations) is the first configuration.

Facts from three read-only explorers (they will be recorded as research records 14.1.1–14.1.3 once plan mode ends):
- **Auto-handoff naming.** N comes only from the stored lineage, never from the title (`hooks/auto-handoff/register.tsx:429,996-1005`; `config.ts:412-423`). A "(Session 2)" session with no lineage restarts at 1, and the test `auto-handoff.test.tsx:1766-1774` pins that behaviour.
- **Keep-alive 5m off.** `keepalive.ts:690` renders `off` whenever the last cache write had `ephemeral_5m_input_tokens` = 0. The split is fed by main-loop responses only (`auto-handoff/register.tsx:881`).
- **Lens.**
  - It knows no session ids and does not show auto-handoff chains (`lens.ts:1603` only filters `[auto-handoff]` prompts).
  - It has no cache hit/miss counts. Savings ignore the write premium (`lens.ts:1751`).
  - Usage and keep-alive sections are at `register.tsx:1790,1805`.
- **VS Code limits recorded earlier.** No prompt-toolbar render site, no pinning, no pane placement, no width control (7.2.l1.2/l1.3/l1.5 hand-backs; MANUAL-CHECKS.md:55,367).
- **Planning skills.**
  - No epic, sprint or story hierarchy, and no Scrum or Kanban anywhere.
  - The workflow `artifacts` schema is closed (`additionalProperties: false`, 7 keys).
  - There is no module taxonomy anywhere.
- **AAW.** Four stages, agent-manager only. orchestrator.md:123 excludes SA, SE and SWE.
- **Agent teams.** Enabled in `.claude/settings.json:7`, but this session exposes no team-create tool, and teams don't run in SDK sessions (see Mode).

## Your decisions (binding)
- **Chain:** PO + PM + RA → SA → SE (system-engineer, design) ↔ AM (implements) ↔ SQA → CR, with DW + BC on every document. No software-engineer. This is the item-3b chain, applied to this run as a one-off override of the AAW rule. Item 3 makes it permanent in the plugin.
- **VS Code UI (2.iv):** research, plus a short spike against the current mods API. Where something is still impossible, the closest fallback goes to you at G1.
- **Backlog layout (item 4):**
  - the plugin default becomes `docs/product/active/<epic>/<sprintN>/<feature>/<story>/<task>` and `docs/product/backlog/<epic>/<feature>/<story>/<task>`, configurable through the workflow `artifacts` section;
  - this repository's `docs/backlog/backlog.md` and `docs/product/ai-dlc-lens/` migrate into it;
  - this repository's current sprint is **sprint 1, 2026-10-20 to 2026-10-27 inclusive** (Tuesday).
- **Handoff tree mirrors the product tree:** `docs/handoffs/<epic>/<sprintN>/<feature>/<run>/…`. The lens groups runs epic → sprint → feature without reading the backlog. Existing run folders, this one included, migrate.
- **Agile skill:** PO and PM own it (creating epics, sprints, features, stories and tasks). Every other agent's definition says how to adapt to it: where to read its item, and where its records go.
- **Team vs subagents:** the orchestrator chooses agent team or parallel subagents per request. When it can't decide, it always asks the human.
- **Who builds, by lifecycle (a plugin change):**
  - **AAW:** always agent-manager; software-engineer is never used.
  - **Full AI-DLC and the other named lifecycles (FDLC, BFLC, RLC, …):** from the requirements, the orchestrator decides whether SWE builds, AM builds, or both (product code to SWE, agent artifacts to AM). When unsure, it asks the human.
  - **This run** is AAW work, so AM builds.
- **New default phases for the full AI-DLC chain (a plugin change):**
  - **Phase 1 Planning, always in plan mode:**
    - (a) PO + PM + RA: requirement analysis and feasibility, user stories, use-case diagram → handoff to SA and SQA;
    - (b) SA: architecture narrative, high-level design and patterns (CA, VSA, Layered, CQRS), DB design, business and technical workflow designs, UML; a clarify loop with PO and PM (several handoffs and hand-backs allowed) → handoff to SWE, SQA, CR;
    - (c) SE/SDE: LLD with SOLID, DRY, KISS, YAGNI, Mediator and DDD, paradigms (procedural, OOP, functional, AOP, BDD), UML, optional UI design; a loop with SA → handoff to SWE, SQA, CR;
    - (d) documentation becomes the source of truth: DW authors the docs owned by PO, PM, SA, SE and RA, with a BC critique loop.
  - **Phase 2 Implementation:**
    - (a) SWE and/or AM read the SA and SE handoffs and the coding rules; a loop with SA and SE → handoff to SQA and CR;
    - (b) SQA reads the PO, SA, SE and SWE/AM handoffs and the testing rules; an optional loop with PO, SA and SE; test-suite doc and test code → handoff to CR;
    - (c) CR gives two verdicts:
      - conventions: SE handoffs, review, code and test rules, applied to the implementation and test code;
      - intent: PO + PM, SA and SE handoffs; does the implementation match the intent, and do the tests verify the ACs and DoDs?
  - **Phase 3 Final docs check:** BC critiques all the docs (planning docs and those created or changed during implementation) against the delivered work; DW fixes, in a loop with BC.
  - **Planning docs changed or created during implementation:** they are recorded, and the affected handoffs are updated.
  - **Who writes handoffs:**
    - subagent mode: the orchestrator writes every step's handoff and BC reviews it. When the work is done, the orchestrator verifies it;
    - team mode: the orchestrator only starts the team and leads. Agents write and send handoffs to the next agent, and/or write a hand-back for the previous agent; BC reviews them. The previous agent (the sender) verifies the work.
  - **Implementation mode switch (auto / manual), one switch for both:**
    - gates: auto = SWE → SQA → CR run on without stopping after edits, with the orchestrator approving or rejecting loops and handoffs; manual = the human approves each code and test-code change after the edit;
    - Claude permission mode: auto = auto-accept edits; manual = each edit needs the human's permission;
    - **auto is shown as an anomaly in the lens.**
- **Gates:** G1, G2, G3, G4 and the release are approved by you. Loop limits are 2 rounds / 1 failure each (from `rounds --json`, source `loop`); `gate-critique` is 2 / 1.

## First action after approval
Copy this plan, verbatim, into the run folder as `docs/handoffs/FEAT-20261020-ai-dlc-lens/00c-approved-plan-2026-10-24.md`, following `00b-approved-plan-2026-10-22.md`. Then write `run.v2.md`, which points to it under *Clarified intent*, and the records 14.1.1–14.1.3 of the three explorers. Plan mode allows no writes outside the plan file, so this is step one once you approve. Next:
- the five deep-dive records (14.1.11–14.1.15);
- the product-owner brief and requirement-analyst stories for **tier 1 first** (16–20), built from the requirements below, with BC critique;
- G1 for tier 1;
- the tier 2–4 requirement deep dives run in parallel with tier 1's design.

## Run bookkeeping
- **Run state, one per wave:** each wave has its own run-state file in this run folder:
  - `run.v2.md` Wave 1 Plan, to G1;
  - `run.v3.md` Wave 2 Design, to G2 and G3;
  - `run.v4.md` Wave 3 Build;
  - `run.v5.md` Wave 4 final docs check, G4 and release.
  
  A wave's file is written when that wave starts, and each one points back to the one before (`previous:`). `run.v1.md` stays unchanged. The rule "a run state per wave/phase" also goes into the handoff skill (root 23), so the lens can show one accordion per wave. Branch `feat/ai-dlc-lens`; session = this session.
- **Feature roots:** roots start at **14**. Root 15 is skipped, because `15-claude-lens-gap-analysis.md` is already named with it. Phase sub-roots are N.1–N.5 with `l<k>` loops.
- **Records:** every spawn gets a handoff record first and every return a hand-back. Docs-status markers follow the run state.
- **Mode:**
  - You asked for an agent team, so I start Mode 5 (me as lead only) with the chain above.
  - If the team tool is unavailable in this VS Code session, I stop and ask you before falling back to parallel subagents.
- **BC on handoffs:** every handoff is reviewed by BC, as your new rule says. That raises token cost. Within the 2 / 1 loop limits, Minors are recorded as follow-ups rather than sent round again.
- **Run folder move:** the run moves into the mirror tree when root 21 migrates it. Until then, records stay in `docs/handoffs/FEAT-20261020-ai-dlc-lens/`.

## Task breakdown: independent first, dependent later
This is my draft. product-manager confirms it at 14.1 with task-triage; its breakdown is binding. Feature roots are numbered in build order, root 15 skipped. Every build task follows the same chain:
- system-engineer ↔ agent-manager (Align);
- agent-manager implements and runs the checks;
- sqa-engineer ↔ agent-manager (tests);
- code-reviewer ×2 (conventions, intent);
- documentation-writer ↔ brutal-critique (docs).

### Tier 0: research (root 14, planning; all parallel, no dependencies)
| Task | Question | Feeds |
|---|---|---|
| 14.1.1–14.1.3 | Already done (the three explorers above); recorded after plan mode | all |
| 14.1.4 | Lens core features in VS Code: what works, what is broken (item 1) | G1 |
| 14.1.5 | Integration audit: ai-dlc ↔ lens and auto-handoff ↔ keep-alive bugs and enhancements (2.i.c) | G1 backlog |
| 14.1.6 | Cache semantics: per user/agent turn read/write cost, TTL reset, 5m vs 1h (Anthropic docs) | 17, 22 |
| 14.1.7 | Mods API today: toolbar button, popup/dialog, side panel, width (re-check 2.1.309 limits) + agent-manager spike | 28 |
| 14.1.8 | Review mods: claude-code-filetree, reflect-mod, replay-theater (features, mechanism, licence) | 27 |
| 14.1.9 | Diagram mods: diagram-pane, claude-code-figures, claude-latex, show-me, archpane, mermaid-inline (features, mechanism, licence) | 20 |
| 14.1.10 | Agent teams in this VS Code session: available or not | mode |

### Tier 1: independent (parallel after G3)
| Root | Item | Tasks | Area |
|---|---|---|---|
| 16 | Bug: auto-handoff session N | failing tests for main → 2 and Session 2 → 3; read N from the title when there is no lineage; replace the test that pins the restart at 1; ATTRIBUTION.md | AI-DLC / auto-handoff / handing off |
| 17 | Bug: keep-alive 5m status line always off | reproduce from 14.1.6; fix the split / arming rule at `keepalive.ts:690`; regression test; README | AI-DLC / cache keepalive / statusline |
| 18 | Taxonomy in the plugin | workflow section + schema for modules, submodules, features and integrations; `validate`; run-state front matter fields; run ↔ backlog item ↔ task ↔ session ids; prioritised items create run states in order; this repository's taxonomy as the first config | AI-DLC / multi-agent workflow / handoff, workflow design |
| 19 | AAW redesign | (a) harness variant PO ↔ AM ↔ DW + BC; (b) plugin/mod variant PO ↔ SA ↔ SE ↔ AM ↔ SQA ↔ CR, DW + BC; team and subagent forms; routing between the two; orchestrator hard rule; aaw-review.md; `validate`. Freshly spawned agent-manager | AI-DLC / multi-agent workflow / workflow design, loop design |
| 20 | Lens: diagramming submodule | render PlantUML, Mermaid, LaTeX and others from the chat in a pane or inline; THIRD_PARTY_NOTICES.md | AI-DLC-LENS / diagramming mods |

### Tier 1 requirements (deep dives done 2026-10-24, plan mode; records 14.1.11–14.1.15 written after approval)
**16 Auto-handoff session N.** Research found:
- The chain number comes only from the stored lineage (`register.tsx:429,996-998`).
- With no lineage (resume, lost store, hand-made title, store read error), the old session is renamed Session 1 and the new one Session 2.
- A prefixed title with no number nests the prefix (`config.ts:420`).

Your decision: **the title number wins**. Lineage depth is used only when the title has no number.

ACs:
- main session (no lineage, no number) → old session `(Session 1)`, new session `(Session 2)`;
- title `(Session N)` → new session N + 1, and the old session is never renumbered;
- a lineage without depth, or a store error, still gives N + 1 from the title;
- a prefixed title without a number never nests the prefix;
- the number never decreases or repeats within a chain;
- tests `auto-handoff.test.tsx:693-705,1766-1774` change, and cases for each branch are added;
- `ATTRIBUTION.md:144-155` and `auto-handoff.schema.json:65` (template + `.ai-dlc` copy) are updated.

**17 Keep-alive 5m line + cache explanation.** Research found:
- the bare `off` is the default for every turn without background tasks (`keepalive.ts:52,635,658-661`);
- the split is last-write-wins and sticky, and comes from the main loop only (`register.tsx:881`, `keepalive.ts:84-97`), so subagents' 5m writes are ignored;
- the lens prices every write at the 5m rate and leaves out the write premium in its savings (`lens.ts:330-336,1751-1775`).

Your decision: **show the real cache state, and ping subagent cache too.**

ACs:
- each track shows whether writes of its own TTL exist (main and subagents, labelled) and until when;
- a reason replaces a bare `off`;
- the 5m track arms from subagents' 5m writes as well as the main loop's;
- splits are tracked per TTL, not as one last write;
- a regression test for "5m cache exists → line not off";
- an explanation for the user, from the Anthropic prompt-caching docs: reads 0.1x (0.05x Opus/Sonnet 5.5, 0.025x Fable/Mythos 5.1), writes 1.25x for 5m and 2x for 1h, a hit refreshes the 5m TTL, and what resets the cache (TTL expiry, change to tools/system/messages, /clear, compaction, model change);
- the lens cost fixes go to root 22.

**18 Taxonomy.** Your decision: **epics sit above modules.** Epics are business goals and are the folder level in `docs/product/active|backlog/<epic>/…` and the handoff mirror tree. Module, submodule, feature and integrations are **front-matter tags**, and the lens groups by tag.

ACs:
- an optional, validated declaration of modules, submodules, features and integrations with stable ids (a `taxonomy` section in the workflow file or `.ai-dlc/taxonomy.json`; the architect decides at G2);
- with no declaration, every reader behaves exactly as today;
- run state, backlog items, stories and tasks carry `module`, `submodule`, `feature` and `integrations[]` keys, and `validate` rejects undeclared ids;
- task-triage rows carry them, and a row without them is marked `needs-info`;
- run discovery works at any depth, and run ids are unique across the tree (`handoffsRoot` `run.ts:56-73` and the one-level scan, `lens.ts:986`);
- `pickRun` can filter by module;
- the Stages table gains a machine-readable session column (chain id + session ids), parsed by `run.ts` and the lens;
- moved folders leave `merged-from-<old>.md` behind;
- this repository's taxonomy (AI-DLC, AI-DLC-LENS, Integrations 1 and 2) is the first declaration.

**19 AAW variants.** Research found what blocks a PO- or SA-first chain:
- `workflow.mjs:373-374` requires every starting stage to be agent-manager;
- the reviewer guards are at `:138-150,376-394`;
- the schema is at `:28,70-71,258`;
- the tests are at `tests/workflow/workflow.test.mjs` (removal, routing, `when`, budgets) and `handoff-naming.test.mjs`;
- the naming has no phase slots for PO, SA or SE.

Defaults (change them at G1 if you disagree):
- the variant is picked from the change set: docs-only harness paths → (a); any script or code, or any path under `plugins/claude/*/`, `tools/` or `tests/` → (b); unclear → ask you;
- team-mode verification follows your rule (the sender verifies), replacing `handoff:129`;
- the BC review of each handoff gets its own loop limits (2 / 1, with its own env variables in `rounds --json`);
- PO, SA and SE records go under N.1 planning sub-codes;
- Copilot runs subagent mode only;
- consumer repositories get an upgrade path.

The 13 draft ACs are in the 14.1.14 record (both variants validate; no SWE; the guards are revised and tested; per-mode record writing and verification; a fallback to subagents under -p, the SDK or Copilot; `build --check`, `validate`, tests and the sync check pass; a freshly spawned agent-manager makes the change).

**20 Diagramming submodule.** Your decision: **offline only, never a remote renderer.**

Order:
1. Mermaid;
2. LaTeX math (bundled MathJax);
3. PlantUML only when a local Java + plantuml.jar is configured.

ACs:
- closed fences render below the reply with the source still visible;
- open or streaming fences are not rendered;
- no network request during rendering;
- over the 131,072-char Svg cap, or on an error → the source plus a one-line reason;
- PNG through `Image` on the terminal, Svg in VS Code and desktop;
- THIRD_PARTY_NOTICES.md entries for every idea reused (diagram-pane MIT, figures Apache-2.0 with its NOTICE checked, claude-latex MIT, show-me MIT, archpane MIT, mermaid-inline MIT);
- lens `validate` and tests pass.

Spike first: can an `AssistantMessage` render replace one fence inside a reply? If not, render beneath the reply.

### Tier 2: depends on tier 1
| Root | Item | Depends on | Tasks |
|---|---|---|---|
| 21 | Agile skill + product tree | 18 | `agile` skill (Scrum, Kanban, XP, RAD, …) for PO and PM; adapt sections in every other agent; task-triage and product-planning split `docs/product/active/<epic>/<sprintN>/<feature>/<story>/<task>` from `docs/product/backlog/<epic>/<feature>/<story>/<task>`; `artifacts` keys; handoff mirror tree `docs/handoffs/<epic>/<sprintN>/<feature>/<run>/`; migrate this repository (sprint 1 = 2026-10-20 to 2026-10-27), this run folder included |
| 22 | Lens: Cache lab + Context lab | 17 | rename Usage to Context lab; Cache lab: read, write, uncached, hits, miss, write cost, cost vs saved with the write premium; keep-alive in its own accordion |
| 23 | New default AI-DLC phases | 18, 19 | Planning (plan mode; PO + PM + RA → SA ↔ PO/PM → SE ↔ SA → DW ↔ BC); Implementation (SWE and/or AM ↔ SA/SE → SQA → CR conventions + intent); Phase 3 final docs check; builder choice per lifecycle; multi-target handoffs; planning-doc change tracking; who writes and verifies records per mode; BC on handoffs; auto/manual switch; team vs subagents decision; one run state per wave |

### Tier 3: depends on tier 2
| Root | Item | Depends on | Tasks |
|---|---|---|---|
| 24 | Lens: workflow grouping | 18, 21, 16 | accordions epic → sprint → feature and module → submodule → feature, plus Integrations; one accordion per wave run state; one chart per step; auto-handoff sessions as separate charts inside their step |
| 25 | Lens: auto mode as an anomaly | 23 | read the switch; anomaly for auto gates and auto-accept edits |
| 26 | Lens: review submodule | 23 | changed-files tree in a side panel on each edit (manual mode); open read-only; approve / reject with a reason / skip (anomaly); line comments like a PR review; decisions into the run's records; THIRD_PARTY_NOTICES.md |

### Tier 4: depends on tier 3
| Root | Item | Depends on | Tasks |
|---|---|---|---|
| 27 | Lens: VS Code runs launcher | 24, 14.1.7 | button with hover counts (running / pending / blocked); popup of runs grouped by module and Integrations; click → side panel of step accordions; minimum width; the fallback you approved at G1 where VS Code blocks it |
| 28 | Integration fixes from 14.1.5 | 14.1.5, G1 | items you accept at G1, tier placed by product-manager |

## Waves (each wave has its own run state)
1. **Wave 1 Plan, `run.v2.md`:**
   - tier 0 research in parallel, plus the 14.1.7 spike;
   - product-owner brief with BC critique;
   - product-manager breakdown + backlog in the new product tree;
   - requirement-analyst stories, ACs and use-case diagram, with BC critique;
   - product-owner accept → **G1**.
2. **Wave 2 Design, `run.v3.md`:**
   - software-architect ↔ PO/PM (narrative, HLD, ADRs, UML) per tier, tier 1 first;
   - system-engineer ↔ SA (LLD) per tier;
   - documentation-writer ↔ BC;
   - → **G2**;
   - product-manager task plan by tier → **G3**.
3. **Wave 3 Build, `run.v4.md`:** tier 1 (16–20 in parallel) → tier 2 (21–23) → tier 3 (24–26) → tier 4 (27–28). A tier starts when the items it depends on pass review, not the whole previous tier.
4. **Wave 4 Final, `run.v5.md`:**
   - BC final docs check ↔ documentation-writer;
   - **G4** (both axes);
   - product-owner release go / no-go.

## Flags
- **Override recorded:** AAW chain for this run = item 3b chain: PO + PM + RA → SA → SE ↔ AM ↔ SQA → CR (conventions + intent), DW + BC. SA and SE are added; SQA and CR run on every code change; no SWE.
- **Agent-manager self-change:** roots 19 and 23 edit `workflow` (an agent-manager-owned skill), so they go to a freshly spawned agent-manager.
- **Capability gap:** the `agile` skill is new; agent-manager creates it inside root 21.
- **Risks:**
  - root 27 may stay a fallback (VS Code host limits);
  - agent teams may be unavailable here;
  - item 1 text was cut off ("in vs code,") and is read as "core features in VS Code".

## Verification
Agents run the checks and quote the real output; I check the hand-backs against `git diff` and never run the checks myself.
- `node tools/build-copilot.mjs --check`
- `node tools/validate.mjs`
- `node --test "tests/**/*.test.mjs"`
- `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc` (auto-handoff and keep-alive)
- `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/ai-dlc-lens` and `plugin test ./plugins/claude/ai-dlc-lens`
- `node .ai-dlc/workflow.mjs validate` after the workflow and schema changes
- New regression tests:
  - handing off from Session 2 names the new session 3;
  - the 5m line is on when the 5m track is armed;
  - the lens parses taxonomy front matter and groups charts;
  - auto-handoff sessions become charts per step.
- Your manual VS Code checks (launcher, popup, side panel, accordions) are added to MANUAL-CHECKS.md before G4.
- Every change is recorded in ATTRIBUTION.md for the hooks folders.
