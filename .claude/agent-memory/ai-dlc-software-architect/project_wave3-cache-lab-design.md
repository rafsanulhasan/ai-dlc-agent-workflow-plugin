---
name: wave3-cache-lab-design
description: Root 22 Cache Lab and ITEM-068 design, 2026-10-25: ADR-0006 (child-process transcript reader), own spec cache-lab.spec.md, mods API limits that drove it
metadata:
  type: project
---

On 2026-10-25 (step 17.1.16), the Cache Lab got its own spec, `docs/specs/cache-lab.spec.md`. Keep-alive rev 4 kept only Part A. ADR-0006 is Proposed: the lens computes from transcripts, using a `node` child reader.

- **Why a child process.** `$.fs.read` and `$.process.run` stdout are both capped at 4 MiB, and `$.fs.read` has no range read. This repository has transcripts up to 10.5 MB, 754 MB in all.
- **Duplicate rows.** Transcripts repeat usage once per content-block row, so dedupe by `message.id`.
- **Transcript folder.** Use dirname(`transcript_path`) from `classic.SessionStart`.
- **Human answers 2026-10-25 (17.1.23).** Exact claude-lens compaction rule (cache-read drop of the two prior calls >50%); gallery turn label as text; window presets default 7d session-only; Keep Alive is a sub-accordion INSIDE Cache Lab; always "Cache Lab" casing; diagramming licences + BSD-2-Clause, Mermaid only in sprint 1.
- **Prices.** They already work through the lens's `loadCosting` and `lookupModel`. Nothing new was needed for prices.
- **promptId.** It sits on `user` rows only, and no API opens a turn, so the gallery has no link.
- **Keep-alive review.** The session switch lives in `$.store` per session id (like `--session`), not in module memory, because a reload would re-arm the track. At 17.1.23 the human replaced "never overrides the master": a session master Button (D11) exists; a track `[on]` overrides the master, master `[off]` clears both track switches, master `[on]` sets both to `on` (human: "Force both tracks on").
- **Human answers 17.1.26.** Track Button follows *allowed*, not *running* (Q-SL8). "Context Lab" casing. Dev-vs-prod behaviour is an explicit lens setting, never detected: `cacheLabKeepWindowOnReload` (default false = production) keeps the window in `$.store` across reloads. The human prefers explicit, documented switches over "dev" detection.

- **17.1.31, the chain (ADR-0007).** Human principle: auto-handoff-linked sessions are ONE session. Chain id = `lineage:<id>`.chain (auto-handoff already writes it; first session's id); per-session state is keyed by chain id; the lens reads the chain only from published keep-alive `chain` (two plugins are not known to share `$.store`). Never change the cache prefix at a handoff (model, effort, tools, system prompt, settings and context files untouched). Settings `handoff.carryOver`, `handoff.onWhenOff` (trust-gated; human: acts as a master [on] press, forcing both tracks on, even with carryOver false), `sourceNote` (show the keep-warm source label, default true). `spent` is zeroed at every arming, so it is never carried. Keep-warm source labels: session|machine|settings|default.

- **17.1.35, D13 (no ADR).** `$.ui.status` is ONE string per plugin, no surface arg (d.ts 2.1.310 :2503-2513), `
` draws as a glyph in the terminal, spaces in VS Code. `$.session.surfaces()` gives the roster (several at once), `session.attach`/`detach` events exist; so per-surface status text is impossible, only a roster rule (all `vscode` -> full text, else summary). Summary <=72 chars; full text lives in band/Pane under the mod's own Text title `⚠ ai-dlc cache-keepalive:` (host prefix `⚠ ai-dlc:` is not settable). Q-SL11 open: explicit `statusText` setting.

**Why:** these mods-API limits are not obvious, and will matter again for any lens feature that reads files.

**How to apply:**
- The next ADR number is 0008.
- Before designing any lens file read, check the 4 MiB caps.
- Sizes are counted in software-engineer build+test sessions. Related: [[wave2-tier1-design]].
