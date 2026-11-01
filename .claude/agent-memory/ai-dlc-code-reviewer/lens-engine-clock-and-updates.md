---
name: lens-engine-clock-and-updates
description: ai-dlc-lens engine seams (clock, update helper) that reviews of plugins/claude/ai-dlc-lens keep getting wrong; check before claiming a test cannot control time or that a state update is safe
metadata:
  type: reference
---

The lens hooks read time with `nowMs = () => Date.now()` (`plugins/claude/ai-dlc-lens/hooks/register.tsx:387`).
The engine's `$.clock.now()` is an event through the host (`plugins/claude/ai-dlc-lens/.tsc/claude-code.d.ts`, around :3508),
and `mock.clock` answers `$.clock` from memory, including `clock.now` (around :16433-16440). So a test CAN move
the time seen through `$.clock`; the statement "a test cannot move the time" in step 44.3.l2.2 is wrong for `$.clock`.

The `update($, atom, fn)` helper "tries again on a miss" (`.tsc/claude-code.d.ts` around :15542): `fn` can run more than once,
so side effects on module state (Sets, Records) inside `fn` are not safe. Step 44.2.l1/l2 code does this in `refreshList`.

**Why:** a 2-minute real-time test in lens-status-43 and retry hazards in refreshList were both raised in 44.4.1.l3.2.
**How to apply:** when reviewing lens time-dependent code, ask whether it can read `$.clock.now()`; when reviewing an
`update(...)` callback, check for writes to module state inside it.
