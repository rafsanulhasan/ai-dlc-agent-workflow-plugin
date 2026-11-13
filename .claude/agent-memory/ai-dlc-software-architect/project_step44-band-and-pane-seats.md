---
name: step44-band-and-pane-seats
description: Step 44 (2026-10-31) ADR-0008 - keep-alive only in its own AbovePrompt band on every surface (no Pane, no status line); lens in the surface-placed pane region; host seat facts
metadata:
  type: project
---

ADR-0008 (2026-10-31, step 44, Accepted): keep-alive draws only its own AbovePrompt band on every surface, VS Code included; no Pane, no status line (D13 superseded in keepalive r4 delta rev 4.8). The lens stays a pane and follows `placement`; no lens band in VS Code; it closes its wide-only Run List tab going inline and never opens it unasked going dock.

- **Host facts (research 44.2.l1.2, probe run.v4.3 2ff, 2.1.310).** All panes of all modules are tabs of ONE region; the surface seats it (VS Code inline narrow, dock wide at ~70 cols); no placement arg, no resize event, no state writes during render, timer opens are "unasked" (undrawn below 110/144 cols). AbovePrompt DOES render in VS Code despite d.ts :10818.
- **Buttons (R44.2/R44.3).** Row shows switch in force, button offers the opposite; tracks decide the title row; replaces Q-SL8 / D10 "label follows allowed".
- **Open Q-SL12:** `statusText` now inert; retire or keep is undecided.

**Why:** an earlier spec premise ("AbovePrompt not raised on VS Code") came from the d.ts and was wrong live; seat rules are host-owned.

**How to apply:** a view that must stay above the prompt at every width is a band, never a pane. Verify d.ts surface claims live before designing on them. Next ADR number is 0009. Related: [[wave3-cache-lab-design]].
