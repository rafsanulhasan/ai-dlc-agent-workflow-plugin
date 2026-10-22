---
run: FEAT-20261020-ai-dlc-lens
work-item: none
lifecycle: AI-DLC
step: 5
from: product-owner
to: orchestrator
mode: subagent
loop: none
received: 2026-10-22 15:48
---

handoff 5-orchestrator-to-product-owner.handoff.md: passed — the record and every artifact it lists exist in the worktree. Backlog items 003-026 are present, and every hand-back I grepped has a `passed` line 1 (3.x carry the old `R1`-`R5` names; 4.1-4.5 use the new form).

Brief: E:\Projects\personal\ai-dlc-agent-workflow-plugin\.worktrees\ai-dlc-lens\docs\product\ai-dlc-lens\brief.md. It covers problem, vision, personas, outcomes, features F1-F14 traced to ITEM-003..026, use cases UC1-UC9 (Mermaid), scope, release cut, success measures, risks and the delegation list. Nothing committed, nothing else edited.

Answers to the PM's five questions
1. Cut candidates: nothing cut now. For G3 I recommend this cut order: 017 transcript cards, 018 text fallback, 020 ledger, 009 gate alert last. The human approves the cut at G3 under the 2026-10-20 rule ("1.0.0 unless it delays").
2. preview2 vs 1.0.0: see clarify 1. Working assumption is the 1.0.0 milestone.
3. Plugin location: stays a G2 decision. I set the product constraints: separate from `ai-dlc`, Claude marketplace only, build and CI ignore it, the thin skills say how to install it.
4. Coarse ACs: a starting point and traceability map only. requirement-analyst replaces them with the G1 ACs and keeps the ITEM ids. The PM rewrites the backlog ACs after G1.
5. P0 override: none. A security defect in the 019 path trust check, or any regression, would be P0.

clarify: (human decisions; my recommended default in each)
- C1, release label and delay rule. The version memory shows `1.0.0-preview1` unreleased with `preview2` next. The scope has grown to 24 items against a 10-14 day plan, so the "unless it delays" clause is live. Does 1.0.0 mean the next published release, and may the mod move to 1.1.0 if the G3 plan shows a delay? Default: keep milestone 1.0.0, draw the cut line at G3, and the lens is not required in a preview2.
- C2, context-view `awareness*` settings. They append a line to the model telling it its context size. The settings decision says every upstream setting is configurable, but awareness is not in the merged field set and changes what the model sees. Default: exclude it from 1.0.0, keep all other context-view settings and thresholds configurable.
- C3, avatars. Is an avatar image (path or data URI) in 1.0.0, or only an initials badge with configurable text and colour? Default: initials and colour only. Svg `data:` images are unproven and a file path needs the trust check.

Assumptions flagged in the brief for the human to confirm at G1
- Version floor 2.1.299, so VS Code works.
- User-facing cost history and export are out of 1.0.0.
- No numeric success targets are invented.

Delegation list (brief section 13)
- requirement-analyst:
  - Write stories with numbered ACs for F1-F14 and UC1-UC9.
  - Elicit the guard modes (opt-in, off by default), which upstream constants become settings, the attention thresholds, avatar and blink settings, and subagent versus header context.
  - Tag every AC with one test route: `claude plugin test`; `node --test`; build/validate commands; document check; or the manual VS Code check (resize, real blink, cards in the VS Code transcript, `[+]`, commands, local override).
- product-manager, after G1:
  - Record the cut order on 017, 018, 020 and 009. Priorities stay as they are.
  - Add two P1 spikes before 014, 015 and 017: VS Code resize/Svg animation/buttons, and a keep-alive state read.
  - Fix a dependency: the header est. $ (013/014) needs the one dated price table, which 020 owns. Move the table into 013 or its own P1 item.
  - Keep 019 at P1.
  - Replace the coarse ACs with the accepted G1 ACs.

Research facts the orchestrator should know
- cache-tax's copyright line is closed: "Copyright (c) 2026 Karan Bansal".
- The version floor is unresolved: context-view says 2.1.290, cache-tax says 2.1.287, the VS Code pane needs 2.1.299.
- The 4.4 open questions still need the architect at G2: the `ui.status` surface, context-view's thresholds, and its per-subagent context rule.

Next hop: brutal-critique reviews the brief, then requirement-analyst, then product-manager, then my acceptance, then G1.
