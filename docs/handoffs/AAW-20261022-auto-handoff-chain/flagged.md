# Flagged: auto-handoff chain — items to address later

Run: `AAW-20261022-auto-handoff-chain` (run state: `run.md` in this folder). Kept by the orchestrator; each item names where it came from and how to close it. Close an item by striking it through with the date and the commit or record that closed it.

## Open — needs a check or a fix

| # | Item | Source | How to close |
|---|---|---|---|
| F3 | CI's `node-version: 22` is assumed to resolve to ≥ 22.18 (type stripping), so the agreement test runs there. Not confirmed by a CI run. On older Node it skips with a stated reason. | `7.2-code-reviewer-to-orchestrator.handback.md` | Check the first CI run of the branch: the agreement suite must report its tests, not a skip. |
| F4 | Manual end-to-end chain test: a seeded session hands off again, 3+ sessions named `… (Session 1/2/3)`, each seed names `run.md` and the open records, the chain stops when `run.md` turns `done`. | plan Verification; human will run it | The human reports the result. Use `AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS` (not the old `AUTO_HANDOFF_TOKENS`). |
| F5 | Does Claude Code honour the `sessionTitle` a hooks module returns from `classic.SessionStart`? New sessions are named only if it does. | `1-research-assistant-to-orchestrator.handback.md`; `ATTRIBUTION.md` | Observe during F4. |
| F6 | Does `/rename` exist at runtime, and does running it from a hook (awaited, 10 s cap) rename the old session before `/clear`? | `1-…handback.md`, `4.2-…handback.md`, `2.l2-…handback.md` | `/ai-dlc:configure-auto-handoff` rename check, then observe during F4. |
| F7 | `CLAUDE_CONFIG_DIR` is not honoured for the trust check (always reads `~/.claude.json`); unconfirmed whether it relocates `.claude.json`. | `5.1-…handback.md`, `2.l2-…handback.md` | Research or test with the variable set; honour it if it does. |
| F8 | Trust-key spelling verified on one Windows machine only (forward slashes, lowercase drive). Other platforms and machines unverified; matching is defensive (case, separators, trailing slash). | `5.1-…handback.md`; orchestrator check | Confirm on macOS / Linux and another Windows machine. |
| F9 | Unofficial reports say `hasTrustDialogAccepted` sometimes does not persist; in VS Code / the SDK the dialog was not shown in the versions tested, so the three gated keys are usually skipped there. | `5.1-…handback.md` | Re-check on Claude Code updates; revisit the gate if Claude Code adds a trust API for mods. |
| F10 | The config reload race at SessionStart is fixed in code but has no dedicated test (harness cannot stage it deterministically). | `2.l2-…handback.md`, `4.1.l1-…handback.md` | Add a test if the harness gains control over load timing. |
| F11 | The env var names `ANTHROPIC_DEFAULT_OPUS_MODEL` / `_SONNET_` / `_HAIKU_` and the "newest model in its family" alias behaviour (README:36, docs/plugins.md:94) are external Claude Code facts not verified in this run. | `7.1-brutal-critique-to-orchestrator.handback.md` (Unverified) | research-assistant against the Claude Code docs. |
| F12 | Copilot agents (`plugins/copilot/ai-dlc/agents/*.agent.md`) carry no `model:` key; the README model table lists Claude models only and does not say so. | `6.4-documentation-writer-to-orchestrator.handback.md` | Decide whether the README should note it. |
| F13 | Pre-existing markdownlint warnings in `README.md` (MD060 table spacing, MD012 double blank line near line 99). Not introduced by this run. | `6.1-agent-manager-to-orchestrator.handback.md` | Tidy in a docs pass. |
| F14 | The `session.usage` test-mock type error at `hooks/auto-handoff/tests/auto-handoff.test.tsx:98` (TS2322), pre-existing; `claude plugin test` does not type-check. | `2.l2-…handback.md`, `6.3-…handback.md` | Fix the mock's type. |
| F15 | What Claude Code reports for a live 1M-context session is not yet observed through the module. User's `/context` (2026-10-22, claude-opus-5-5, VS Code) shows 155.5k / 1.0M. Host types (2.1.306) declare `context.window` a required number equal to the status line's `context_window_size`. Since run `AAW-20261022-window-observability` the per-turn `threshold` log line carries `window=`, `windowSource=`, `basis=`, `hostWindowSource=` and `autoCompactThreshold=`. | `1.1-research-assistant-to-orchestrator.handback.md` (`.scratch/auto-handoff-thresholds-question/`); `docs/handoffs/AAW-20261022-window-observability/` | During F4 on a 1M model, check the log shows `window=1000000 windowSource=host` and a `hostWindowSource` value. |
| F16 | Whether `context.tokens` includes cache reads is unverified. The seed floor counts input + cache_read + cache_creation (`register.tsx:911`); if the host's `context.tokens` excludes cache reads, the threshold compares unlike numbers. | `1.2-research-assistant-to-orchestrator.handback.md` (`.scratch/auto-handoff-thresholds-question/`) | Compare a logged `tokens=` with the transcript's usage for the same turn during F4. |
| F17 | A kill switch (`enabled: false` or `DISABLE_AUTO_COMPACT`) marks the session `fired=skipped-pane` permanently (`register.tsx:632-637`); turning the switch back off takes effect only in the next session. Looks intended, not documented. | `1.2-research-assistant-to-orchestrator.handback.md` | Decide: document it in the handoff SKILL.md, or re-check the switch each turn. |
| F18 | `skills/handoff/SKILL.md:290` says Claude Code 2.1.287 or later is required; the module has no version check (only a version record, `register.tsx:221-224`). | `1.1-research-assistant-to-orchestrator.handback.md` | Confirm the minimum version and either enforce it or reword the doc. |

## Planned work

| # | Item | Where |
|---|---|---|
| P1 | Fold cache-keepalive into the ai-dlc auto-handoff module, drop the mod dependency; measure cache reads on a seeded session first. | `docs/handoffs/AAW-20261022-fold-cache-keepalive/run.md` |
| P2 | `/ai-dlc:workflow upgrade` does not run the `auto-handoff.json` add/remove merge (the workflow skill is agent-manager's own; left out of this run). `configure-auto-handoff` and `init` re-run do it. | Decide whether `workflow upgrade` should call it — a fresh agent-manager run. |

## Closed

| # | Item | Closed by |
|---|---|---|
| F1 | Regression test for the `templates.ts` prototype-key fix | step 8.1, fails with the fix reverted (216/1), passes restored (217/0), 2026-10-22 |
| F2 | Agreement-test clean-ups (dead filter, stale comment, test name) | step 8.1, 2026-10-22 |
| — | README wording minors (log-path subject, softened "never") | step 6.1, 2026-10-22 |
| — | `.ai-dlc/catalog.json` lists `configure-auto-handoff` | step 6.1, catalog check exit 0, 2026-10-22 |
| — | CLI / module agreement test | step 6.2, 2026-10-22 |
| — | `BOOLS` prototype-key defect (`config.ts`), same flaw in `templates.ts` | step 6.3, 2026-10-22 |
| — | README agent → model table | step 6.4, 2026-10-22 |
| — | Dated model versions in README:36; haiku missing in docs/plugins.md:94 | step 8.2, 2026-10-22 |
| — | Window not visible in the per-turn log line (F15 logging half) | run `AAW-20261022-window-observability`, code review approved (step 3), 2026-10-22 |
| — | 500000 `defaultContextWindow` fits neither documented window (200000 / 1000000) | documented in README *The fallback window* (canonical) with pointers in handoff SKILL.md, plugin.json, auto-handoff.schema.json; run `AAW-20261022-window-observability`, critique PASS (2.1.l1), 2026-10-22 |
