# ADR-0007: An automatic-handoff chain is one session, and a handoff never changes the cache prefix

**Date**: 2026-10-25
**Status**: Proposed (awaiting the combined G1+G2+G3 stop)
**Deciders**: the human (2026-10-25, run.v4.md Next action 2n.3 and the "one combined session" principle relayed at 17.1.31); software-architect (the chain id, its readers and the settings); system-engineer (keep-alive LLD rev 10, section 19)

## Context

The automatic handoff (`plugins/claude/ai-dlc/hooks/auto-handoff/`) clears a session that is near its context limit and seeds a fresh one. To Claude Code, the seeded session is a new session with a new session id.

Until now, every "per session" state was keyed by session id, so each handoff started that state afresh:

- keep-alive's `--session` keep-warm overrides (`sessionOverrides`, `hooks/keepalive/keepalive.ts`:443);
- the rev 4 master and track switches (`keepalive-cache-status.spec.r4-delta.md`, D10 and D11);
- the Cache Lab's "This session" preset and its kept window (`cache-lab.spec.md`, L7).

As a result, a track the human turned off came back on after a handoff (critique 17.1.l2.1, Minor 9).

The human decided on 2026-10-25 that sessions linked by automatic handoffs are **one combined session**. A session the human starts by hand is a new one. The one exception: if keep-alive was off when the handoff happened, the seeded session turns it on by default (configurable).

The human also requires that a handoff **never change the cache prefix**, so the seeded session reads the shared prefix (tools, system prompt, project context) from the prompt cache that the old session wrote. Auto-handoff already follows this rule, but only as a code comment (`hooks/auto-handoff/register.tsx`:25-28: same model and effort; the brief and the seed travel only as messages). Its seed turn reports whether that read was a hit.

Auto-handoff already records the chain. At the seed's `classic.SessionStart` (`source: 'clear'`), it writes `lineage:<newSession>` = `{ from, chain, depth, baseName }` to `$.store` (`register.tsx`:1039-1040). `chain` is the session id of the chain's first session (`register.tsx`:464).

## Decision

We will treat an automatic-handoff chain as one session, identified by its **chain id**, and we will keep the cache prefix of every seeded session unchanged.

- **Chain id.** The chain id is the session id of the chain's first session. The value is `lineage:<sessionId>`.chain, and a session with no record (one started by hand) is its own chain.
  - One shared reader, `hooks/auto-handoff/chain.ts` (`chainIdOf`, `chainSessions`; not `chainOf`, which `register.tsx`:3 already imports from `viewer.ts`), serves both modules of the ai-dlc plugin.
  - A failed read falls back to the session's own id, so the session starts clean, and the reader logs one debug line.
- **Keyed by chain.** Keep-alive keys its master switch, its track switches and its `--session` keep-warm overrides by chain id. Things every arming starts afresh are not carried: the timers, the cache ledger, the ping count, the spend counter and the budget.
- **Published for the other plugin.** Keep-alive publishes `chain?: { id, sessions }` in its `$.state` value. The ai-dlc-lens plugin reads it for the Cache Lab's "This session" preset and its kept window. With no published value, the lens uses its own session only. Two plugins are not known to share one `$.store`, so the lens never reads `lineage:` records.
- **Settings** (keep-alive's, in `.ai-dlc/cache-keepalive.json` and `AI_DLC_KEEPALIVE_*`):
  - `handoff.carryOver` (default `true`): when `false`, keep-alive keys by session id again. It does not change what the lens does.
  - `handoff.onWhenOff` (default `true`, trust-gated): once per handoff, a seeded session whose chain's master in force is off acts as a master `[on]` press, setting the master and both track switches `on` (human, Q-SL9). It applies whatever `handoff.carryOver` says (Q-SL10).
- **The prefix rule.** At a handoff, no module may change, for the seeded session:
  - the model or the effort;
  - the tools or the system prompt;
  - a settings file;
  - a context file (`CLAUDE.md`, rules, memory).

  The brief and the seed travel only as messages. Carried state moves only through `$.store` and published `$.state`. The rule binds every module registered in the chain (auto-handoff, keep-alive, and any later one).

## Alternatives Considered

- **Snapshot and copy at each handoff.** The old session's state would be copied to keys of the new session id at the seed. Rejected:
  - it copies state that a keyed-by-chain design never has to move;
  - it races `session.end`, which fires on the `/clear` and deletes per-session state;
  - every new per-session value would need its own copy step.
- **Carry the state in the seed text or in injected context.** The model would be told the switches. Rejected:
  - the switches are module state, not something the model acts on;
  - text in the context is not prefix-safe when it goes into the system prompt or a context file, and it is noise when it goes into the seed.
- **Let the lens read `lineage:` from `$.store`.** Rejected: the system-engineer could not verify that two plugins share one store. The published `chain` is the existing cross-plugin channel (D8).
- **Treat each seeded session as new** (the status quo). Rejected by the human: a handoff is an implementation detail of one piece of work.

## Consequences

### Positive

- A track or master the human switched stays switched across handoffs, and so does a `--session` keep-warm time. This closes critique 17.1.l2.1, Minor 9.
- The Cache Lab's "This session" means the piece of work the human sees as one session.
- The prefix rule is written down, so a future module that wants to adjust the seeded session is caught at review.

### Negative / Trade-offs

- **Session means two things.** "Session" now means the chain for this state, but Claude Code's session id is still per handoff. Code that keys new per-session state must choose, and the default is the chain.
- **More store entries.** Chain-keyed entries outlive any one session id. They stay bounded by `sessionOverridesMax`, and they are deleted at `session.end` only when no handoff is in progress.
- **Turning keep-alive on can spend.** With `handoff.onWhenOff` at its default, a seeded session may start spending tokens on pings that the human had turned off. Because the setting acts as a master `[on]` press, it overrides a track disabled in a settings file. That is why the setting is trust-gated and can be set to `false`.
- **No context injection.** Nothing can be put into a seeded session's prefix, not even something useful.

### Neutral

- A session the human starts by hand, or a `/clear` the human types, starts a new chain.

## Compliance Checklist

- [x] Affected components:
  - `plugins/claude/ai-dlc/hooks/auto-handoff/chain.ts` (new) and `register.tsx` (the seed call, `applyHandoffSeed`);
  - `hooks/keepalive/keepalive.ts` and `settings.ts`;
  - the `cache-keepalive-configure` skill's schema;
  - `plugins/claude/ai-dlc/types/index.d.ts` (published `chain`, `keepWarmFrom`);
  - the ai-dlc-lens Cache Lab (`cache-lab.spec.md`, L7).
- [x] Related ADRs: ADR-0006 (the lens reads only `chain` from keep-alive; amended).
- [x] Specs: `keepalive-cache-status.spec.r4-delta.md` D12; `cache-lab.spec.md` L7. Items: ITEM-076 (T17.7), ITEM-077 (T22.g).
- [ ] DI registration: not applicable (hooks module).
- [x] No ADR superseded.
