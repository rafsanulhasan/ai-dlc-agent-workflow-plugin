<!-- sub-step: build 43.2.5, tests 43.3.5 -->
# Step 43 live findings, round 2 (human, 2026-10-26; run.v4.md 2dh)

Naming: clicking an ARROW opens a panel, to be called the **Connections panel**; clicking an AVATAR opens a panel, to be called the **Agents panel**. The human also asked to rename "the label in the workflow" (wording to be confirmed: the human wrote arrows -> "Agents", avatars -> "Connections", which looks swapped).

Connections panel (arrow click):
1. No separator after Anomalies: add one.
2. Its "Usage" section is (or should be) "Context Lab". Research: does a context lab make sense for a connection (a hand-off between two agents)? If yes, explain how and why; if no, remove it.
3. Research: is a Cache Lab meaningful for a connection? If yes, add it as another accordion; if not, leave it out.
4. SendMessage tool calls should be stripped from the chat to reduce noise, and the Connections panel gets a "Send Message" accordion listing those messages.
- Confirmed (human): arrows are labelled "Connections" and open the Connections panel; avatars are labelled "Agents" and open the Agents panel.

Agents panel (avatar click):
5. Add a button at the bottom right of the Agents panel to STOP that agent. (Research: can a mod stop a running subagent or teammate — an agent stop/kill API in the d.ts; per surface; what happens to its records.)

## Research (43.1.4) and the human's decisions (2026-10-26)
- Connections panel: remove "Usage" (it showed the receiver's whole-life tokens); show a small "Hand-off" line instead: brief size and hand-back size (characters). No Context Lab, no Cache Lab (not meaningful per connection with current data).
- Connections panel gets an Anomalies section (that connection's anomalies, e.g. a failed hand-back), with a separator after it. Order: header; separator; Anomalies; separator; Hand-off / Hand-back; Send Message (accordion: sender, receiver, text, time of each SendMessage on this connection).
- SendMessage calls hidden from the chat via the ToolUse render hook (register.tsx ~4269); unverified per surface: list it as a live check; if a surface ignores an empty tree, collapse it to one dim line there.
- Agents panel bottom row: today "View Transcript" and "Refresh" — both DO NOT WORK: fix them. Add a third button at the right, "Stop", that does the same interrupt as pressing Esc: `$.turn.abort` (d.ts:2989-2994, main loop's running turn; it stops the running tools, so the agents that turn started). It cannot target one subagent alone (no API, d.ts:3252-3302). Just below the buttons, a dim note saying what Stop does (interrupts the current turn like Esc, which stops its running agents) and that a single agent cannot be stopped on its own.
- Agents panel bottom row (human): put space between the buttons (View Transcript, Refresh, Stop).
- Agents panel buttons (human): all the buttons centred horizontally (this replaces "Stop at the right"); the Stop button has a red background and white text.
- Stop (human, 2026-10-26, replaces "Stop on every Agents panel"): the ORCHESTRATOR's (main) Agents panel gets a "Stop" button; each step accordion (the whole step) and the Connections panel get a "Stop turn" button; subagent Agents panels get no Stop. All of them do the Esc-like interrupt ($.turn.abort), with the note.
- SendMessage receivers (human): map names: "team-lead" / "main" -> the orchestrator; a teammate or persona name -> that agent when known.
