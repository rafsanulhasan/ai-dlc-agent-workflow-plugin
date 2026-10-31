# Step 44: live findings 4 (the human, 2026-10-31)

Taken after `/reload-plugins` on round 44.2.l1.5 (R44.14 to R44.16), in VS Code. Only `ai-dlc-lens` was re-read.

## Verbatim

> lens hook error: seat follow: HooksError: au-dlc-lens: state.set: denied: it was made while the ui.render is being dispatched, and drawing is pure (a render hook reads state and returns a tree; write from a handler such as onPress, or from another event)) (host check)
>
> the main flowchart is no longer being drawn

## Requirements (binding)
- **R44.17 (bug):** the lens's seat follow (`followSeat`, `seatChanged`) must not write state while a `ui.render` is being dispatched. A deferral that still runs inside the dispatch counts as inside it. Find where the write lands, with path:line, and move it to an event the host allows.
- **R44.18 (bug):** the main flowchart (the workflow view's step chart) draws again. If R44.17 is not its cause, find the cause and say so.
- The test kit must catch this: a state write from anywhere during a render dispatch, timers started in a render included, fails a test. The step 43 kit rule exists (lens-live1-cmd-43.test.tsx:49); it evidently does not cover this path.
