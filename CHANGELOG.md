# Changelog

All notable changes to the plugins in this repository are recorded here. Each release section is also the body of the matching GitHub Release.

## v1.0.0-preview1 - 2026-11-13

**This is a prerelease.** It is the first tagged release of this repository: no tag or GitHub Release existed before it. One tag covers both plugins.

| Plugin | Version | Works in |
|---|---|---|
| `ai-dlc` | `1.0.0-preview1` | Claude Code, and GitHub Copilot through the generated Copilot plugin (same version) |
| `ai-dlc-lens` | `0.1.0` | Claude Code only |

No version number changed for this release. Both plugins already carried these versions in their manifests.

### Read this before you update

- **Installs from `main` since 2026-10-22 already report `1.0.0-preview1`.** Claude Code decides whether an update exists from the `version` field, so those installs will not see this build as an update. If you installed from `main`, you already hold a copy that differs from this release under the same version.
- **Running `ai-dlc` and `ai-dlc-lens` together on Claude Code 2.1.323 has not been checked live.** The plugin tests load one plugin at a time, so the keep-alive band and the lens band composed in one session are unverified. This is the one open item that could change behaviour for someone using both plugins.
- **CI did not run for this release.** GitHub Actions refused every job because the account is locked over a billing issue; the last three runs failed within seconds, which is not a code failure. Local checks stand in for it (see [Checks](#checks)).

### What ships

#### `ai-dlc` 1.0.0-preview1

Keep-alive and automatic session handoff (the Claude-only hooks module):

- Auto-handoff numbers a session from its title, then from its lineage depth (ITEM-030). The `ATTRIBUTION.md` and schema text were brought in line (ITEM-031).
- A chain of automatically handed-off sessions counts as one session for keep-alive (ITEM-076).
- Keep-alive keeps cache state per TTL, 5 minutes and 1 hour, for the main loop (ITEM-032), and the 1-hour ping counter advances on each ping (ITEM-035).
- Each keep-alive track always shows a reason, never a bare `off` (ITEM-033). Both tracks are always shown, with their buttons and a summary (ITEM-068).
- Keep-alive writes no status line. Its state shows in its own band above the prompt, in every panel including VS Code (ITEM-092, ITEM-093). Each track row shows the switch in force; the head row follows the tracks; the seed row is hidden while both tracks are off. The `statusText` setting and its variable `AI_DLC_KEEPALIVE_STATUS_TEXT` are retired: a settings file that still sets either is reported as "no longer used" and is not rejected.
- Subagent writes feed the per-TTL state (ITEM-034), in part. It was built, tested with 18 tests traced to its acceptance criteria and reviewed on both axes, and a bug found in AC-17.3.7 is guarded by a test. AC-17.3.1, AC-17.3.2, AC-17.3.5 and AC-17.3.6 cannot be tested until ITEM-034.b and stay open; see Known open. The subagent-usage live check is ITEM-034.c, also under Known open.
- A user explanation of how the prompt cache works is in the keep-alive README (ITEM-036).

Workflow and agent-artifact work:

- The agent-artifact lifecycle comes in two variants, `AAWH` for a harness change and `AAWP` for a plugin or mod, with review loop limits per hand-off (ITEM-045, ITEM-046, ITEM-047, ITEM-050). Both lifecycles are in the workflow template. `README.md` (line 58) says when each applies: `AAWH` for a docs-only change under the harness folders, `AAWP` for any change that holds code or touches `plugins/`, `tools/` or `tests/`. Automatic selection is not built: the `variant` command that picks the variant, with the selection rule in routing (ITEM-048), is not included (see Not included), as `README.md` also says.

Compatibility with Claude Code 2.1.323:

- The five band tests that failed on the 2.1.323 test host pass again; the fix changed tests only (ITEM-112).
- `plugin validate --strict` passes for both plugins on 2.1.323 (ITEM-113). Its Node 22 run is still open.

#### `ai-dlc-lens` 0.1.0

- **One "AI-DLC Lens" view** in the pane region, with the lens band rules for each surface. The band follows the session's own surface (terminal, Desktop or VS Code). In VS Code the lens moves between the inline pane and the docked right pane with the panel width, and the mode button switches between pinned and docked (ITEM-094, ITEM-095, ITEM-097).
- **Run status** never reads "completed" for an active run, in the run list or in the step charts (ITEM-096). A done stage settles a failed or killed agent in it, so the step no longer reads halted (ITEM-107).
- **Cache Lab and Context Lab** (ITEM-058 umbrella): the transcript reader and pricing (ITEM-069), the Cache Lab accordion with cards and windows (ITEM-070), miss attribution and the TTL mix (ITEM-071), the Invalidation Gallery (ITEM-072), Usage renamed Context Lab (ITEM-073), a Keep Alive sub-accordion (ITEM-074) and the chain window (ITEM-077).
- **Diagrams**: the diagramming core and an offline Mermaid renderer (ITEM-053.b), the `registerDiagram` hook and six settings rows (ITEM-053.c). The two spikes behind them are closed (ITEM-052, ITEM-053.a).
- **Notices**: third-party notices and attribution for the diagram renderer (ITEM-056).

### Not included

These 19 items were carried out of this release by recorded decisions. Nothing in them ships.

- **Next sprint (sprint 2):** ITEM-034.a (spike: `session.send` to an idle subagent), ITEM-054 (LaTeX math through MathJax), ITEM-055 (PlantUML), ITEM-075 (notices for 054 and 055).
- **Next sprint not set:**
  - ITEM-034.b: subagent keep-alive ping through messaging, conditional on ITEM-034.a.
  - Root 18 (taxonomy, run discovery and run state): ITEM-037, ITEM-038, ITEM-039, ITEM-040, ITEM-041, ITEM-042, ITEM-043, ITEM-044.a, ITEM-044.b, ITEM-065 and ITEM-066.
  - AAW variant follow-ups: ITEM-048 (variant selection, orchestrator rule and routing), ITEM-049 (records per mode), ITEM-051 (subagent fallback, Copilot and upgrade path).

Also not included: the backlog follow-ups ITEM-099 to ITEM-103, ITEM-105, ITEM-106, ITEM-111 and ITEM-114 to ITEM-119, and the later lens tiers (tiers 2 to 4).

### Known open

- **ITEM-098, live checks of the VS Code and keep-alive fixes** (manual checks M25 to M31 and M34 for the lens, P17 to P26 for keep-alive, and assumptions A1 and A2 of the session's own surface). Not run; the maintainer will run them later.
- **ITEM-034, subagent writes feeding per-TTL state.** AC-17.3.1, AC-17.3.2, AC-17.3.5 and AC-17.3.6 are untestable until ITEM-034.b (carried to sprint 2) and stay open. AC-17.3.1 may never fire; the human accepted that at the sprint gate.
- **ITEM-104, a running background subagent shown as halted.** The fix is built and reviewed, but the cause was never captured live. A subagent that is missing from the engine's agent list and sends no events shows halted after a timeout, 15 minutes by default and configurable; a subagent the list shows as running is never timed out. The item stays In Progress until manual check M35 is run.
- **Two plugins together on Claude Code 2.1.323 are unverified.** The live band check (keep-alive P9 to P11 and lens O15) was not run. See the note at the top.
- **Node 22 run of the repository tests** (the open acceptance criterion of ITEM-113). It needs GitHub Actions or a local Node 22; the recorded repository test run is on Node 24.
- **Third-party notice items marked "Not verified"** in the shipped notice (ITEM-056): the `safer-bytes` 0.2.0 repository, the compiled-in `serde` 1.x version, GWT code in the minified `elkjs`, and transitive crates.
- **Live results of the two keep-alive checks are recorded in `plugins/claude/ai-dlc/hooks/keepalive/MANUAL-CHECKS.md` (P1 and P2), with these outcomes.**
  - **1-hour ping repaint (P1, ITEM-035).** VS Code passed: the ping count went from 1/9 to 2/9 on its own. In the terminal the first ping passed, but the step from 1/9 to 2/9 was not observed, so that part stays open. An earlier terminal attempt with the 2-minute interval produced the human's report "cli did not repaint pings after 2 mins"; it is not known whether a fresh session picked up the setting, what the line said, or whether the module updated the status while the terminal did not redraw; a re-run with a debug log then settled the first ping, but nothing explains the earlier run, and the cause was never found. The comparison of the lens's ping count against the screen is not recorded on either surface. Both runs were read on the keep-alive status line, which a later change removed. The Claude Code version was not recorded.
  - **Subagent usage split (P2, ITEM-034.c).** The terminal check failed on Claude Code 2.1.310: the live usage lines of a running subagent carried no 1h/5m split, while its finished transcript did. The fallback D2a applies.
  - **Diagram check AC-20.8.1 (ITEM-053.c).** No result is recorded.

### Checks

CI could not run, so these were run locally and recorded before the release. The release commit's own re-run is recorded by the release step, not here.

- `node tools/build-copilot.mjs --check` and `node .claude/scripts/sync-harness.mjs --check` exit 0.
- `plugin validate --strict` exits 0 for both plugins and the marketplace on Claude Code 2.1.323 and 2.1.322.
- `plugin test ./plugins/claude/ai-dlc`: 1007 passing, 0 failing, on Claude Code 2.1.323 and on 2.1.322.
- `plugin test ./plugins/claude/ai-dlc-lens`: 926 passing, 0 failing, on Claude Code 2.1.323 and on 2.1.322.
- Repository tests: 1270 tests, 1263 passing, 0 failing, 7 skipped, on Node 24.11.1.
- Code review ended with 0 Blockers in every recorded round; G4 was approved with the open conditions above.
