---
work-item: FEAT-20261020-ai-dlc-lens
kind: user-stories
author: requirement-analyst
date: 2026-10-22
revision: 2 (gate-critique round 1 findings applied; Q1–Q12 decided by the human 2026-10-22)
status: draft, awaiting brutal-critique round 2, product-owner acceptance and G1
milestone: 1.0.0-preview1 (C1)
inputs: brief.md (§13 delegation list), 00b-approved-plan-2026-10-22.md, run.md clarifications C1–C3, Q1–Q12 answers (8.l1 handoff), backlog ITEM-003…029, research 3.2, 4.2–4.5, handoff skill *Run state*
---

# User stories: ai-dlc-lens

Sources: `docs/product/ai-dlc-lens/brief.md` (cited "brief §n"), `docs/handoffs/FEAT-20261020-ai-dlc-lens/00b-approved-plan-2026-10-22.md` ("00b"), human decisions C1–C3 (run.md, *Open clarifications* rows 4–6) and Q1–Q12 (section *Decisions*), research hand-backs cited by step and line ("4.4:99"), the run-state format in `plugins/claude/ai-dlc/skills/handoff/SKILL.md` (*Run state*, lines 209-255, cited "handoff:NNN"). These stories replace the backlog's coarse ACs; the ITEM ids are kept.

**Revision 2 numbering.** AC ids from revision 1 are kept. New ACs take the next free number in their story: AC-6.9, AC-7.12, AC-13.9, AC-16.4. AC-21.4 is withdrawn (it was a process gate; see *Process items*). The traceability table and the M-map are updated.

## How to read this file

**Test routes.** Every AC carries exactly one tag:

| Tag | Route | Run by |
|---|---|---|
| `[PT]` | `npx @anthropic-ai/claude-code plugin test <plugin>` with `$.ui.mount` element trees, the mock clock and stubbed events (3.2:51-55) | automated |
| `[NT]` | `node --test "tests/**/*.test.mjs"` | automated |
| `[BV]` | build and validate: `plugin validate --strict` (ai-dlc, ai-dlc-lens, `.`), `node tools/build-copilot.mjs --check`, or a scripted presence check (a file, a CI step, or a pattern searched in the lens source with the exact pattern given in the AC) | automated |
| `[DC]` | document check: a reviewer reads the named file against the AC | review |
| `[MV]` | manual check in the VS Code extension 2.1.299 or later, exact steps given | human |

**Marks.** `(spike)`: the number or behaviour comes from a pre-G2 spike (brief §9; backlog ITEM-027 spike (a), ITEM-028 spike (b), ITEM-029 spike (c)). The AC names the setting or the fallback; the spec sets the value from the spike result. Revision 1's `(default — pending human)` marks are gone: the human accepted every default (Q1–Q12, *Decisions*).

**Settings.** A setting is named here by its logical name (for example `awarenessStep`). Its env-key spelling in `settings.json` and the user-level file's location are G2 decisions; types, allowed values and defaults are fixed by the settings register at the end of this file. Every setting resolves through US-5.

**Terms.**
- **Run**: one AI-DLC run folder with a `run.md` (`docs/handoffs/{LIFECYCLE}-{YYYYMMDD}-{slug}/`, or the `artifacts.handoffs` path of `.ai-dlc/workflow.json`), in the format of handoff:209-255.
- **Run-state check**: one read of the run state by a consumer: one lens poll (every `runStatePollMs`) or one invocation of the gate-alert hook.
- **Human gate reached** (A13): the record named by the run's `last-record` front-matter field has, in its own front matter, `to: human` and a `gate:` value other than `none` (for example `gate: G1`). The gate stays reached until `last-record` names a different record.
- **Blocked**: the run's `run.md` front matter has `status: blocked`.
- **Agent**: a subagent or an in-process teammate known to `agent.spawn` or `$.agent.list()` (4.3:43-44).
- **Display name**: for an `ai-dlc:<id>` agent, the persona name the orchestrator's roster (`project_team-roster.md`) gives it, else the default `Persona name:` line of that agent (A8); for any other agent, the spawn `description`, else the agent type.
- **Pane tree**: everything one `ui.render` call of the lens Pane returns.
- **Settings levels** (A12), highest first: **L1** `.claude/settings.local.json` env; **L2** `.claude/settings.json` env; **L3** the user level written by `/ai-dlc:lens-init` and `/ai-dlc:lens-configure`; **L4** the built-in default. The process environment is not a level and is never read (00b).

### Merged field set (from 00b, binding; inlined so testers need no other file)

| Area | Fields (each drawn once per pane tree) |
|---|---|
| Session header | total tokens; est. spend (labelled `est.`); elapsed |
| Context | `%`; used / window; headroom to auto-compact; warning and error colours; `auto-compact next` / `run /compact` hint |
| Cache | warm / cold / unknown; cold re-write price; break-even; session cold writes; guard mode (hidden until expanded) |
| Keep-alive | keep-alive state, only when active |
| Run / workflow | lifecycle; stage; gate; loop round N/M; next action |
| Progress | task bar: title, phase, `Tasks n/m`, % |
| Agent, collapsed | avatar; display name; status; current activity; tokens |
| Agent, expanded (`[+]`) | type; model; effort; own context %; est. spend; elapsed; call count; prompt excerpt; last lines; recent tool calls |
| Attention | waiting for approval; tool call over `slowToolMs`; silent over `quietMs`; human gate reached |

Hidden until asked: expanded agent detail, guard mode, price-table date.

---

## F1 Run state for everyone

### US-1 Shared run-state parser — ITEM-007
As the plugin maintainer, I want one run.md parser used by `workflow.mjs`, the auto-handoff module and the lens, so that every tool reads run state the same way.

Context: the parser to extract is `parseRunState` in `plugins/claude/ai-dlc/hooks/auto-handoff/run.ts:83` (present in this worktree, from `main`). The fold branch `fix/auto-handoff-chain` (unmerged) also changes the auto-handoff module; ITEM-007 is built after that merge (backlog EXT).

- AC-1.1 `[BV]` Given the repository after ITEM-007, when `plugins/`, `tools/` and the lens folder are searched with the pattern `function\s+parseRunState\b|parseRunState\s*=` (the extracted parser keeps the name `parseRunState`, `run.ts:83`), then exactly one module matches, and `workflow.mjs`, `hooks/auto-handoff/` and the lens import it; `run.ts` no longer holds its own copy.
- AC-1.2 `[PT]` Given the auto-handoff tests, when `plugin test ./plugins/claude/ai-dlc` runs after the extraction, then every test that passed before passes, with unchanged assertions.
- AC-1.3 `[NT]` Given a run.md fixture with every front-matter field of handoff:211-222 (`run`, `work-item`, `status`, `lifecycle`, `mode`, `current-stage`, `owner`, `session`, `branch`, `commit`, `last-record`, `updated`), a *Stages* table and a *Gates and loops* table, when it is parsed, then each field, each stage row (step, stage, owner, mode, status, handoff, handback, updated) and each gates-and-loops row (gate or loop, approver / round, decision, by, date) is returned with its value.
- AC-1.4 `[NT]` Given a run.md fixture missing any one front-matter field, or with no *Stages* or *Gates and loops* table, when it is parsed, then parsing does not throw and the missing item is returned as `null` (a field) or an empty list (a table).
- AC-1.5 `[NT]` Given a file that is empty, has no front matter, or has front-matter lines that are not `key: value`, when it is parsed, then parsing does not throw and returns a result marked unreadable.

### US-2 `workflow.mjs runs` — ITEM-008
As a Copilot or terminal user, I want `node .ai-dlc/workflow.mjs runs [--json] [--active]` to list runs, so that I can see run state without the lens.

- AC-2.1 `[NT]` Given a fixture repository with three run folders (statuses `active`, `blocked`, `done`), when `runs` runs, then it prints one line per run with run id, status, lifecycle, current stage, branch, last record and updated time, and exits 0.
- AC-2.2 `[NT]` Given the same fixture, when `runs --active` runs, then only the `active` and `blocked` runs are listed.
- AC-2.3 `[NT]` Given the same fixture, when `runs --json` runs, then stdout is one JSON array, one object per run with the fields of AC-2.1 plus `nextAction` (the run.md *Next action* section text) and `gateReached` (the gate id, or `null`, per the *Human gate reached* term), and nothing else is written to stdout.
- AC-2.4 `[NT]` Given a run.md missing fields (AC-1.4), when `runs` and `runs --json` run, then that run is still listed, missing values print as `—` in text and `null` in JSON, and the exit code is 0.
- AC-2.5 `[NT]` Given an unreadable run.md (AC-1.5) next to valid ones, when `runs` runs, then the valid runs are listed, the unreadable one is listed with status `unknown`, a one-line warning naming its path goes to stderr, and the exit code is 0 (A7).
- AC-2.6 `[NT]` Given no run folders, when `runs --json` runs, then stdout is `[]` and the exit code is 0.
- AC-2.7 `[NT]` Given a `.ai-dlc/workflow.json` whose `artifacts.handoffs` names another folder, when `runs` runs, then it reads runs from that folder and not from `docs/handoffs/`.
- AC-2.8 `[BV]` Given the build, when `node tools/build-copilot.mjs --check` passes, then the Copilot plugin's copy of `workflow.mjs` contains the string `runs` as a command name (UC9).

---

## F2 Gate alert — ITEM-009

### US-3 Alert when a human gate is reached or a run is blocked
As the maintainer or a plugin user, I want an alert when a run reaches a human gate or becomes blocked, so that I respond without watching the chat.

Decided (Q1): the alert fires at the first run-state check after the change; the lens polls every `runStatePollMs` (2,000 ms); channels are a toast plus the attention row with the lens, and a visible session line from the hook without it.

- AC-3.1 `[DC]` Given `plugins/claude/ai-dlc/skills/init/`, when it is read, then `init` installs the gate-alert hook into the target repository, registered on Claude Code's `Stop` hook event (A14), and says how to remove it.
- AC-3.2 `[NT]` Given a fixture run whose `last-record` changes to a record with `to: human` and `gate: G1`, when the gate-alert hook runs once afterwards, then it emits one alert naming the run id, the gate `G1` and the record file name.
- AC-3.3 `[NT]` Given a fixture run whose `status` changes to `blocked`, when the hook runs once afterwards, then it emits one alert naming the run id, the word `blocked` and the run's *Next action* text, the whole alert cut to at most 500 characters with `…` (the toast limit, 3.2:40).
- AC-3.4 `[NT]` Given an alert already emitted for a gate or block, when the hook runs again and the run's `last-record` and `status` are unchanged, then no second alert is emitted.
- AC-3.5 `[NT]` Given a run.md with missing fields or an unreadable run.md, when the hook runs, then it emits no alert for that run and exits 0 (it never blocks the session).
- AC-3.6 `[NT]` Given a fixture run.md changed into a gate-reached or blocked state, and three hook invocations in sequence after the change, then the alert is in the output of the first invocation, and not in the second or third (first run-state check after the change).
- AC-3.7 `[PT]` Given the lens is installed and a fixture run's state changes to gate reached at clock time T, when the mock clock advances by `runStatePollMs` (2,000 ms), then by T + 2,000 ms exactly one toast naming the run and the gate has been raised, and the pane's attention row shows the gate (UC6).
- AC-3.8 `[NT]` Given the hook emits an alert, then its stdout is one JSON object whose `systemMessage` field holds the alert text (the hook output Claude Code shows to the user, A14), and the exit code is 0.
- AC-3.9 `[DC]` Given the Copilot plugin docs, when read, then they either name the projected gate-alert hook, or, if G2 decides it cannot be projected, tell Copilot users to poll with `node .ai-dlc/workflow.mjs runs --active`.
- AC-3.10 `[MV]` Setup: a scratch repository set up with `/ai-dlc:init`, the lens installed, VS Code extension 2.1.299 or later. Steps: ask the orchestrator for a small feature so it runs PDLC; let it run until it stops at G1 (its gate record is addressed `to: human`). Expected: once the orchestrator's G1 message has finished and before you type the next prompt, a toast names the run and `G1`, and the lens pane's attention row shows `G1`. Then disable the lens plugin, repeat to the next human gate, and expect a visible alert line in the session instead.

---

## F3 Packaging — ITEM-010, ITEM-011

### US-4 The lens is its own Claude-only plugin
As the maintainer, I want the lens in its own plugin, listed in the Claude marketplace only, so that ai-dlc stays usable when the mods API breaks and Copilot gets no lens content.

- AC-4.1 `[BV]` `plugin validate --strict` passes for `./plugins/claude/ai-dlc`, for the ai-dlc-lens plugin folder and for `.`.
- AC-4.2 `[BV]` `.claude-plugin/marketplace.json` lists `ai-dlc-lens`; `.github/plugin/marketplace.json` does not.
- AC-4.3 `[BV]` `node tools/build-copilot.mjs --check` passes, and no file under `plugins/copilot/` contains lens code, the lens manifest or the skills `lens`, `lens-init`, `lens-configure`.
- AC-4.4 `[BV]` ai-dlc's manifest does not list ai-dlc-lens as a dependency, and `plugin validate --strict ./plugins/claude/ai-dlc` passes without the lens folder present.
- AC-4.5 `[BV]` `.github/workflows/validate.yml` has a step running `plugin validate --strict` and a step running `plugin test` for the lens folder, and both use one exact Claude Code version (no `latest`, no range).
- AC-4.6 `[DC]` The lens manifest and the lens README state the same minimum Claude Code version, the value G2 decides (brief §11).

---

## F4 Settings — ITEM-012, ITEM-019

### US-5 One settings resolver
As a user, I want every lens setting to resolve the same predictable way, so that a local override always wins and a typo never breaks the lens.

- AC-5.1 `[PT]` Given a setting with different valid values at L1, L2 and L3, when it is resolved, then the L1 value is used.
- AC-5.2 `[PT]` Three separate cases: given valid values at L2 and L3 only, the L2 value is used; given a valid value at L3 only, the L3 value is used; given no value at L1–L3, the L4 default is used.
- AC-5.3 `[PT]` Given an invalid value at a level (wrong type, outside the register's *Allowed* column), and a valid value at a lower level, when resolved, then the lower valid value is used. Tested for an invalid L1 over a valid L2, an invalid L2 over a valid L3, and an invalid L3 over the L4 default.
- AC-5.4 `[PT]` Given a valid value present only in the process environment under the setting's env key, when resolved, then it is ignored and the L4 default is used.
- AC-5.5 `[PT]` Given a setting changed at any level during the session, when the lens reloads its settings (a module reload, 4.4:90), then the next render uses the new value. Decided (Q11); the README marks which settings need a reload (AC-21.3).
- AC-5.6 `[PT]` Given every row of the settings register, when the resolver's setting list is read in a test, then each row is present with the register's type, allowed values and default; the test fails if one is missing or differs.

### US-6 `/ai-dlc:lens-init` and `/ai-dlc:lens-configure` write the user level
As a user, I want two commands that write my lens settings, refusing unsafe file paths, so that I can configure the lens without editing JSON.

Context: the trust check reuses the rule auto-handoff already ships: a path-valued setting applies only in a folder Claude Code trusts, read from `projects["<path>"].hasTrustDialogAccepted` in `~/.claude.json` (`plugins/claude/ai-dlc/hooks/auto-handoff/config.ts:295-336`, `ATTRIBUTION.md:174-180`, both present in this worktree; the fold branch `fix/auto-handoff-chain`, unmerged, also edits these files).

- AC-6.1 `[PT]` Given no L3 lens settings, when `/ai-dlc:lens-init` runs, then it writes L3 with every register setting at its default and reports the file it wrote.
- AC-6.2 `[PT]` Given existing L3 settings, when `/ai-dlc:lens-init` runs, then it does not overwrite a value the user set, and names the keys it kept.
- AC-6.3 `[PT]` Given `/ai-dlc:lens-configure <name> <value>` with a valid value, then that one key is written at L3, and the command reports the new value and, when an L1 or L2 value overrides it, says which.
- AC-6.4 `[PT]` Given `/ai-dlc:lens-configure <name> <value>` with an invalid value or an unknown name, then nothing is written and the command reports why.
- AC-6.5 `[PT]` Given a path-valued setting (`avatarImage.<agent>`) whose path lies outside every folder Claude Code trusts, when `/ai-dlc:lens-configure` is asked to write it, then nothing is written and the command says the path is untrusted.
- AC-6.6 `[PT]` Given a path-valued setting at L1 or L2 of a project folder Claude Code does not trust, when resolved, then the value is ignored and the next level applies.
- AC-6.7 `[MV]` Steps: in VS Code, set `transcriptCards` to `on` in `.claude/settings.json` env and `off` in `.claude/settings.local.json` env; reload the window; call a subagent. Expected: native transcript rows, no cards (L1 wins).
- AC-6.8 `[MV]` Steps: in a docked panel, run `/ai-dlc:lens-init`, then `/ai-dlc:lens-configure layout compact`. Expected: both report success and the pane redraws as the compact list.
- AC-6.9 `[PT]` Per-agent keys (A21): given `/ai-dlc:lens-configure avatarInitials.software-architect AR`, then the key `avatarInitials.software-architect` is written at L3, and the resolver returns `AR` for agents of type `ai-dlc:software-architect` and the default for every other agent; a key for a non-ai-dlc agent uses its full agent type (`avatarInitials.<plugin>:<agent>`), and a key whose agent part is empty is rejected as invalid.

---

## F5 Data model and compact view — ITEM-013

### US-7 See every agent of the session in a compact list
As the maintainer, I want one row per agent with its name, status and tokens, so that I see who is working without reading files (O1).

- AC-7.1 `[PT]` Given a fixture session that spawns three agents (one nested), when the pane mounts on `vscode` with `placement: 'inline'` and on `terminal`, then the tree holds one collapsed row per agent with exactly the *Agent, collapsed* fields of the merged field set (A11).
- AC-7.2 `[PT]` Given an agent of type `ai-dlc:software-architect` and a fixture roster mapping it to "Mark Richards", then its display name is "Mark Richards"; with no roster entry, it is the agent's default `Persona name:`; for a non-ai-dlc agent with description "lint fix", it is "lint fix"; with no description, it is the agent type.
- AC-7.3 `[PT]` Status shows `$.agent.list()` status (`pending`, `running`, `waiting`, `idle`, `completed`, `failed`, `killed`, 4.3:44); given no status source for an agent, its status reads `unknown`, never `completed` (brief §11).
- AC-7.4 `[PT]` Tokens per agent are the sum over its `turn.step` usages (input, output, cache read, cache write) for that `agentId`; given the fixture usages, the row shows the fixture total.
- AC-7.5 `[PT]` The session header shows total tokens, est. spend (labelled `est.`) and elapsed time, each once.
- AC-7.6 `[PT]` Est. spend uses one dated price table owned by ITEM-013 (backlog 9.2); given fixture usages for `sonnet-5-5` (4.5:30: input 2, output 10, cache read 0.1, cache write 4 USD per MTok), the figure equals the fixture's expected value to the cent.
- AC-7.7 `[PT]` Given a model not in the price table, then no dollar figure is drawn for it (`—`) and the session est. spend is marked `partial` (Q6).
- AC-7.8 `[PT]` The context window comes from `$.session.usage().context.window`; given a fixture window of 200,000 and another of 1,000,000 with the same tokens, the percentages differ by a factor of 5; no window value is hard-coded.
- AC-7.9 `[PT]` Task bar (Q7): given a fixture run whose *Stages* table has 4 of 10 rows `done` and `current-stage: stories`, the task bar shows the run title, phase `stories`, `Tasks 4/10` and `40%`. The lens registers no progress tool for the model.
- AC-7.10 `[PT]` Given more agents than `maxNodes`, then the oldest finished agents are dropped first and the summary line says how many are hidden.
- AC-7.11 `[PT]` Given a session with no active run, then the agent rows still draw and the run area says `no active run`.
- AC-7.12 `[PT]` Prices override (Q2): given `prices` set to `{ "date": "2026-11-01", "rows": [{ "match": "sonnet-5-5", "usd": [3, 12, 0.2, 5] }] }`, then est. spend for `sonnet-5-5` usage uses those four rates, every other model still uses the built-in table, and the price-table date shown on expand is `2026-11-01`; given an override row with a negative rate or not four numbers, the whole override is ignored as invalid (US-5).

---

## F6 Merged header — ITEM-014

### US-8 Context meter
As a user, I want the context %, used / window and headroom to auto-compact in the header, so that I act before a compaction (O2).

Headroom formula (A19, from context-view, 4.4:82 and 00b:84): `headroom = window − reserve − tokens`, where `reserve` comes from the local `/context` breakdown, else `compactReserveFallback`. With auto-compact off, headroom counts to the window's end and the hint is `run /compact`.

- AC-8.1 `[PT]` Given a fixture usage of 84,100 tokens in a 200,000 window, auto-compact on and no `/context` breakdown, then the header shows `42%`, `84.1k/200k` and `82.9k until auto-compact` (200,000 − 33,000 − 84,100 = 82,900); counts format as `84.1k`, `200k`, `1m` (4.4:85).
- AC-8.2 `[PT]` With threshold `window − reserve`: at or past `contextWarnAt` of the way to the threshold the meter uses the theme `warning` key; within `contextErrorWithin` tokens of the threshold, the `error` key; past it, the hint `auto-compact next`; with auto-compact off and past the limit, the hint `run /compact` (4.4:82-83). Fixtures (200k window, 33k reserve, threshold 167,000): 100,000 tokens → normal; 100,200 (0.6 × 167,000) → warning; 147,000 (20,000 before the threshold) → error; 167,001 → `auto-compact next`.
- AC-8.3 `[PT]` Given a fixture `/context` breakdown with a reserve of 45,000, the headroom uses 45,000; without one, `compactReserveFallback` (4.4:82, 4.4:107).
- AC-8.4 `[PT]` Before the first response, after `/clear` and after a compaction, figures are `~`-prefixed estimates (4.4:85).
- AC-8.5 `[PT]` The meter refreshes after each main-thread turn and every `contextPollMs` (mock clock); a fixture subagent request does not change the header figure (4.4:86; Q5).
- AC-8.6 `[PT]` The meter is `meterCells` cells wide when space allows and shrinks to 60% then 40% of it (20 → 12 → 8 at the default) as `bodyColumns` narrows, at the two `bodyColumns` thresholds the spec sets at G2 (context-view's band thresholds were not read, 4.4:84, 4.4:123); the test uses one fixture width inside each of the three bands; its glyph pair follows `meterGlyphs` (`parallelogram` = `▰`/`▱`, `block` = `█`/`░`) (4.4:84; A23).
- AC-8.7 `[PT]` Setting `contextMeter` `off` removes the meter row and nothing else from the tree.
- AC-8.8 `[PT]` The pane tree holds exactly one context figure; no second context size (savvy-progress session context, cache-tax context size) is drawn.

### US-9 Cache figures and keep-alive state
As a user, I want to see whether the cache is warm or cold and what a cold turn costs, so that I avoid paying for a cold re-write (O2).

TTL source (A15): the cache lifetime is `cacheTtlMinutes` when set at L1–L3; otherwise Claude Code's `promptCacheTtl` (`5m` → 5, `1h` → 60, 4.4:62) when set; otherwise 60 minutes.

- AC-9.1 `[PT]` Before the first usage event the cache state is `unknown`; after a turn it is `warm`; when the TTL passes with no turn (mock clock), it is `cold`. Three TTL cases: `cacheTtlMinutes` 30 with `promptCacheTtl` `1h` → cold after 30 min; `cacheTtlMinutes` unset with `promptCacheTtl` `5m` → cold after 5 min; both unset → cold after 60 min.
- AC-9.2 `[PT]` Given a fixture context of 100,000 tokens on `sonnet-5-5` (read 0.1, 1 h write 4 USD per MTok, 4.4:40), the *cold re-write* price is `$0.40` and break-even is `40` (`floor(4 / 0.1)`, 4.4:27); both labels differ from `est.`.
- AC-9.3 `[PT]` Session cold writes counts each turn that wrote the cache while it was cold; given a fixture with two cold writes, it shows `2`.
- AC-9.4 `[PT]` Given the keep-alive state source (spike (b), ITEM-028, or its fallback) reports active, the header shows one keep-alive line; given inactive or no source available, no keep-alive line draws and every other header field still draws. (spike)
- AC-9.5 `[BV]` No keepwarm: a search of the lens source finds no match for `model.fork`, `keepwarm` or `PING_AFTER`, and the settings register has no `always`, keepwarm-window or `every` row.
- AC-9.6 `[PT]` The price-table date is not in the tree until the header's `[+]` is pressed; then it shows the table's date.
- AC-9.7 `[PT]` Colours follow Claude Code's `theme` config; `monochrome` `on` draws with no colour (every `color`, `backgroundColor`, `borderColor` and Svg fill is unset or the theme's default text key). The process `NO_COLOR` variable is not read (Q2, A9).

### US-10 Opt-in cold-cache guard
As a user who wants protection from cold turns, I want an opt-in guard, so that a large cold send costs me nothing by surprise.

Decided (Q3): modes `off`, `warn`, `refuse`; default `off`, although upstream cache-tax defaults to `refuse` (4.4:55); threshold `guardMinTokens` 50,000.

- AC-10.1 `[PT]` With `guard` `off`, no prompt is delayed, dropped or annotated.
- AC-10.2 `[PT]` With `guard` `warn`, a prompt sent while the cache is cold and the context is at least `guardMinTokens` shows one line with the cold re-write price, and the prompt is sent.
- AC-10.3 `[PT]` With `guard` `refuse`, the first such prompt is dropped with one line showing the price. The **resend** is the next prompt submitted with identical text and no other prompt in between; it is sent without a guard line. A different next prompt is guarded again.
- AC-10.4 `[PT]` With `guard` `warn` or `refuse`, these pass with no guard line: slash commands, plugin prompts, a non-cold cache, context under `guardMinTokens`; unattended origins (`scheduled-trigger`, `peer`, `coordinator`) get the `warn` behaviour in `refuse` mode (4.4:29).
- AC-10.5 `[PT]` If the guard throws, the prompt is sent and one dim line says the guard was skipped (4.4:30).
- AC-10.6 `[PT]` The guard mode is not in the tree until the header's `[+]` is pressed.

### US-11 Awareness line (C2)
As Claude in a long session, I want a line telling me my context size, so that I can act before auto-compact (O6).

- AC-11.1 `[PT]` With every awareness setting at its default, a fixture prompt yields exactly one appended line with tokens, window and headroom (M12).
- AC-11.2 `[PT]` After a tool result, a new line is appended only when the main-thread context grew by at least `awarenessStep` since the last line; with `awarenessStep` 0, any growth yields one. `awarenessStep` does not apply to prompts: each prompt that passes AC-11.3 yields one line (4.4:99).
- AC-11.3 `[PT]` With `awarenessFrom` N > 0, no line is appended below N tokens; with `awarenessWithin` M > 0, none until headroom is M or less; with both 0, lines start from the first prompt (4.4:97-98).
- AC-11.4 `[PT]` `awarenessAt` `prompts` yields lines after prompts only; `tool-results` after tool results only.
- AC-11.5 `[PT]` Subagent results, other plugins' calls and refused calls get no line (4.4:89).
- AC-11.6 `[PT]` A line once appended is never edited or removed: the test records the transcript entries after the line and asserts they are unchanged after three later turns.
- AC-11.7 `[PT]` With `awareness` `off`, no line is appended for any event.
- AC-11.8 `[PT]` With `contextMeter` `off`, lines are still appended (4.4:89).
- AC-11.9 `[MV]` Steps: in VS Code, send two prompts with the defaults; then run `/ai-dlc:lens-configure awareness off` and send one more. Expected: one awareness line after each of the first two, appended once each; none after the third.

---

## F7 Flowchart view — ITEM-015

### US-12 One flowchart per workflow in a wide panel
As the maintainer, I want a flowchart of who calls whom in a wide panel, so that I see the run's shape at a glance (UC2).

Discriminator (A16, Q4): the layout follows `placement`, never a pixel width. VS Code sets `placement: 'dock'` for a panel 800 px or wider and `'inline'` below (4.2:31); the 800 px figure appears only in the manual steps, as the way to get each placement.

- AC-12.1 `[PT]` With `layout` `auto`, on `vscode` and `desktop` with `placement: 'dock'` the pane draws the flowchart; with `placement: 'inline'` it draws the compact list; on `terminal` it always draws the compact list.
- AC-12.2 `[PT]` `layout` `compact` forces the compact list and `layout` `flowchart` forces the flowchart on `vscode` and `desktop` at either placement; on `terminal`, `flowchart` falls back to the compact list.
- AC-12.3 `[PT]` Given a fixture session with agents in two runs, the tree holds two Svg charts, one per run, each titled with its run id; agents not attributed to a run (AC-17.2) are drawn in one more chart titled `session`.
- AC-12.4 `[PT]` Each agent is one node with its avatar (US-13) and, below it, its display name and status as text.
- AC-12.5 `[PT]` For each caller → callee pair (`parentId` / `parentAgentId`, 4.3:43-45), the chart has one arrow from caller to callee; the main loop is the root.
- AC-12.6 `[PT]` When the run's *Gates and loops* table has a loop row whose first cell names two stages as `<from> → <to>` (handoff:245-246, for example `review → build`), the arrow between the agents owning those two stages (the *Owner* of their rows in the *Stages* table) is two-way. A row whose first cell has no `→` draws no two-way arrow, and a `.l<round>` step code alone never does (it re-runs the same stage and agent). Tie rule: when a stage has several rows with different owners, or parallel stages share one owner, every agent owning a row of the `<from>` stage is paired with every agent owning a row of the `<to>` stage, each pair drawn once; an owner with no agent in the session gets no arrow. Fixture: loop row `review → build`, *Stages* rows `build` owned by `software-engineer` and `review` owned by `code-reviewer` twice (two axes) → two two-way arrows, `code-reviewer` ↔ `software-engineer`, one per reviewer agent.
- AC-12.7 `[PT]` A `running` agent's node alternates between green and its normal colour every `blinkMs` (mock clock); `completed` is green and the same across ticks; `failed` or `killed` is not green; `unknown` is neutral. With `monochrome` `on`, the running node alternates between filled and outlined instead, and completed shows a filled node with a `✓` beside the status text (Q4).
- AC-12.8 `[PT]` Below each chart, the run details show lifecycle, stage, gate, next action and loop round `N/M`, taken from the newest *Gates and loops* row of that run whose *Approver / round* cell begins with `round N / M` (handoff:246; A17); with no such row, the loop field is absent. Fixture: the cell `round 1 / 2 · failure 1 / 1` shows loop round `1/2`; a newer row with `round 2 / 2 · failure 1 / 1` shows `2/2`; a row with `limits 2 rounds / 1 failure` is not a round row.
- AC-12.9 `[PT]` Given a chart whose Svg source would exceed 131,072 characters (3.2:27), the pane draws the compact list for that run and one dim line saying the chart is too large.
- AC-12.10 `[MV]` Steps: in VS Code, start the PDLC run of AC-3.10 with the panel narrower than 800 px, then widen it until the pane docks beside the conversation (800 px or more, 4.2:31). Expected: compact list while inline; flowchart once docked; the running agent blinks green; a finished agent is steady green; a critique loop (`.l1` step) shows a two-way arrow. If spike (a) (ITEM-027) found that resizing does not redraw, the expected result is instead that `/ai-dlc:lens-configure layout flowchart` switches it. (spike)
- AC-12.11 `[MV]` Steps: in the same session, start a second run. Expected: a second chart appears for it.

### US-13 Avatars: initials badge or image (C3)
As a user, I want each agent shown with an initials badge or my own image, so that I recognise agents quickly, safely.

- AC-13.1 `[PT]` By default, an agent's avatar is an initials badge: the first letter of the first and of the last word of the display name ("Mark Richards" → `MR`; one word → one letter), on a colour fixed per agent type (the same type gets the same colour in every render).
- AC-13.2 `[PT]` `avatarInitials.<agent>` and `avatarColor.<agent>` replace the text and colour of that agent's badge (key shape AC-6.9); invalid values are ignored.
- AC-13.3 `[PT]` Given `avatarImage.<agent>` set to a PNG file path inside a trusted folder, on `vscode` or `desktop` the node draws that image if spike (c) (ITEM-029) found Svg images draw, else initials; on `terminal`, a trusted file path draws through `Image` (3.2:27). (spike)
- AC-13.4 `[PT]` Given `avatarImage.<agent>` set to a file path outside every trusted folder, the image is refused and the initials badge draws.
- AC-13.5 `[PT]` Given a `data:` URI whose media type is in `avatarImageTypes` and whose decoded size is within `avatarImageMaxBytes`, it draws on `vscode` and `desktop` with no fetch; another type or a larger size is refused and initials draw; on `terminal` a data URI always shows initials. (spike)
- AC-13.6 `[PT]` Given a remote URL (`http:`, `https:` or any scheme other than `data:` and a file path) or a path to a file whose content is not an image of an allowed type, the image is refused, no request is made, and initials draw.
- AC-13.7 `[PT]` Given a trusted path to a file that does not exist, or larger than `avatarImageMaxBytes`, initials draw.
- AC-13.8 `[MV]` (brief minor 4) Steps: set `avatarImage.<agent>` for one agent to a trusted PNG path and for another to a path outside the trusted folders; run both agents in a docked panel. Expected: an avatar image draws for the first, or, where spike (c) found it cannot, the initials fallback shows; the second shows initials.
- AC-13.9 `[PT]` Given a path inside a trusted folder that escapes it through `..` segments or through a symbolic link resolving outside it, the trust check uses the resolved real path, refuses the image, and initials draw.

---

## F8 Collapse, expand and attention — ITEM-016

### US-14 Hide detail until asked; flag what needs attention
As the maintainer, I want collapsed rows that expand on demand and flags on agents that need me, so that the pane stays calm until it matters (UC1).

- AC-14.1 `[PT]` Each agent row or node has a `[+]` Button; `press` on it adds exactly the *Agent, expanded* fields of the merged field set to the tree; pressing again removes them.
- AC-14.2 `[PT]` Expanded detail is capped by `promptExcerptChars`, `chatTailLines`, `chatTailChars`, `chatLineChars`, `recentTools` and `descriptionMaxChars` (4.5:80-89): a fixture over each cap is cut to the cap.
- AC-14.3 `[PT]` Own context % of a subagent is (input + cache read + cache write of its latest request) / window (Q5, 4.3:55); the header stays main-thread (AC-8.5).
- AC-14.4 `[PT]` Attention flags, each checked with the mock clock: status `waiting` (waiting for approval); a tool call running longer than `slowToolMs`; a running agent with no event for `quietMs`; a human gate reached in its run. Each flag shows on the agent (on the run, for a gate) and in the attention row.
- AC-14.5 `[PT]` With `placement: 'inline'`, only running or flagged agents draw, at most `inlineMaxRows`, plus one summary line with the counts of the rest.
- AC-14.6 `[PT]` Field uniqueness (M2): for fixture trees on `vscode` (inline and dock, collapsed and fully expanded) and `terminal`, each field of the merged field set appears at most once per pane tree; the test fails on a duplicate.
- AC-14.7 `[PT]` With nothing pressed, the tree holds the header and collapsed rows and none of: expanded agent fields, guard mode, price-table date.
- AC-14.8 `[PT]` Timing settings take effect with the mock clock: `tickMs` (elapsed redraw), `reconcileMs` (`$.agent.list()` re-read), `invalidateDebounceMs` (state changes inside the window give one invalidate), `openProbeMs` (4.5:101-106).
- AC-14.9 `[PT]` Auto-open (Q9): with `autoOpen` `ai-dlc`, the pane opens on the first `ai-dlc:` agent spawn, or on an active run, when `bodyColumns` is at least `autoOpenMinColumns`, or `keptOpenMinColumns` when the user kept it open before; `any` opens on any agent spawn; `off` never auto-opens.
- AC-14.10 `[PT]` `language` (Q8): `auto` and `en` draw English text; `ru`, `he` or any other value is invalid and ignored (English draws).
- AC-14.11 `[MV]` Steps: in a docked VS Code panel, click `[+]` on a running agent, then click it again. Expected: detail opens, then closes.

---

## F9 Transcript cards — ITEM-017

### US-15 Subagent and teammate calls as cards, responses never hidden
As a user, I want subagent and teammate calls drawn as compact cards, so that the transcript is readable without losing what agents said.

- AC-15.1 `[PT]` Given an `Agent` ToolUse fixture, the ToolUse site draws one card with avatar, display name, status and tokens; the call's prompt is not in the tree until the card's Button is pressed, then it is.
- AC-15.2 `[PT]` Given the matching ToolResult, the lens returns `next(e)` there, and the subagent's response text is present in the mounted tree (M3; 4.2:39).
- AC-15.3 `[PT]` A `SendMessage` ToolUse draws the same card; a delivered teammate message (`UserMessage` with origin `peer-send-message`) draws a card header with the full message text present in the tree (4.2:45-47).
- AC-15.4 `[PT]` With `transcriptCards` `off`, each of those sites returns `next(e)` and the native rows draw.
- AC-15.5 `[BV]` No rewriting or hiding: a search of the lens source finds no `session.append` hook registration and no `consumed` returned from a `session.receive` handler (00b:45; 4.3:71).
- AC-15.6 `[MV]` Steps: in VS Code, run a subagent and a `SendMessage`. Expected: each shows as a card, the response text is visible without clicking, and clicking the card shows the prompt.

---

## F10 Text fallback — ITEM-018

### US-16 `/ai-dlc:lens text`
As a terminal or `-p` user, I want the agent tree as plain text, so that I can read it where panes do not draw (UC8).

- AC-16.1 `[PT]` Given the fixture session of AC-7.1, `/ai-dlc:lens text` prints one line per agent, indented two spaces per nesting level, with display name, status and tokens, then one line per run with lifecycle, stage, gate and next action.
- AC-16.2 `[PT]` The output contains no Svg, no colour escape codes and no Button labels.
- AC-16.3 `[PT]` With no agents and no run, it prints `no agents` and `no active run`.
- AC-16.4 `[PT]` Non-interactive (`-p`): the command returns the text as its result and opens no pane (`$.ui.open` is not called), so a `claude -p "/ai-dlc:lens text"` run prints it.

---

## F11 Ledger and report — ITEM-020

### US-17 Per-agent and per-stage cost report
As the maintainer, I want tokens and est. spend per agent and per stage, so that I tune model choice and find runaway loops (O4).

- AC-17.1 `[PT]` Given a fixture of `turn.step` usages for agents across two stages, `/ai-dlc:lens` shows per-agent and per-stage totals of input, output, cache read and cache write tokens, and est. spend, equal to the fixture's expected totals (M11).
- AC-17.2 `[PT]` Stage attribution (A18): an agent's usage counts against the stage whose handoff record its spawn prompt names (the record file name's step code matched to the *Stages* table); with no record named, against the single `in-progress` stage; with several `in-progress` stages, against the one whose *Owner* equals the agent's id; still tied or none, under `unattributed` in its run, or `no run` outside any run. One fixture per branch of the rule.
- AC-17.3 `[PT]` Dollar figures are labelled `est.` and the report shows the price table's date.
- AC-17.4 `[PT]` The ledger is kept per run and survives a new session on the same machine (Q10): given a fixture ledger stored by session A, session B's report for the same run includes A's totals.
- AC-17.5 `[PT]` Agent type and completion come from `agent.spawn` and `classic.SubagentStop` / `$.agent.list()` (4.3:17-18); with neither, the ledger records the agent as `unknown` and still counts its tokens.
- AC-17.6 `[PT]` Version drift: given a subagent transcript fixture whose `meta.json` lacks `agentType` (4.3:34), the fallback reader does not throw and records `unknown`.

---

## F12 Licences — ITEM-021

### US-18 Honour every upstream licence
As the maintainer, I want every upstream licence kept and every change listed, so that the lens is lawful to ship (O5).

- AC-18.1 `[DC]` `THIRD_PARTY_NOTICES.md` holds four notices, each naming the upstream repository and the commit copied, with these copyright lines: savvy-progress, MIT, `Copyright (c) 2026 johnnyvizz` (4.5:18); cache-tax, MIT, `Copyright (c) 2026 Karan Bansal` (4.4:22); context-view, MIT, `Copyright (c) 2026 kongyo2` (4.4:78); agent-flow, Apache-2.0, `Copyright 2026 Charles Tao.` (4.5:65; the spec records where upstream states it).
- AC-18.2 `[DC]` Each upstream's `LICENSE` file is kept beside the code taken from it, and agent-flow's `NOTICE` is kept if one exists.
- AC-18.3 `[DC]` The lens `ATTRIBUTION.md` lists every change to upstream code, per file, and every file taken from agent-flow carries a notice that it was changed (Apache-2.0 §4(b)).

---

## F13 Thin skills and layout docs — ITEM-022, ITEM-023

### US-19 `/ai-dlc:lens`, `/ai-dlc:lens-init`, `/ai-dlc:lens-configure`
As a plugin user, I want the three commands under the ai-dlc name, so that I find them where the rest of ai-dlc lives.

- AC-19.1 `[BV]` `plugins/claude/ai-dlc/skills/` has `lens`, `lens-init` and `lens-configure`, and `plugin validate --strict ./plugins/claude/ai-dlc` passes.
- AC-19.2 `[DC]` Each skill names its command and, when the ai-dlc-lens plugin is not installed, tells the user the exact install command and stops.
- AC-19.3 `[BV]` No directory named `lens`, `lens-init` or `lens-configure` exists under `plugins/copilot/ai-dlc/skills/` after `node tools/build-copilot.mjs`.
- AC-19.4 `[MV]` Steps: in VS Code with the lens installed, run `/ai-dlc:lens`, `/ai-dlc:lens-init` and `/ai-dlc:lens-configure layout auto`. Expected: the report, the init summary and the configure confirmation each appear.

### US-20 Layout documentation
As a contributor, I want the repository docs to describe the new plugin layout, so that I build and test it correctly.

- AC-20.1 `[DC]` `skills/plugin-management/SKILL.md`, `.claude/rules/plugin-development.md` and `CLAUDE.md` name the lens plugin's folder, its validate and test commands, and that the Copilot build ignores it.

---

## F14 Docs — ITEM-024

### US-21 Lens README, recommended-mods page, settings table
As a user, I want to know what the lens does, what it can reach, and every setting, so that I decide to trust it and configure it.

- AC-21.1 `[DC]` The lens README describes every view (compact, flowchart, header, cards, text, report), the three commands and the minimum Claude Code version per surface.
- AC-21.2 `[DC]` A recommended-mods page says mods run unsandboxed with the user's permissions and lists what the lens reads (files, events) and writes.
- AC-21.3 `[DC]` A settings table lists every row of the settings register below with type, allowed values, default, and whether a change needs a reload.
- AC-21.4 withdrawn in revision 2: brutal-critique's PASS on the docs is ITEM-024's process gate (backlog chain DW ↔ BC), not an AC.

---

## Process items

Process items 003–006, 025, 026 and the spikes 027–029 have no story. Their ACs live in the backlog (`docs/backlog/backlog.md`, section *FEAT-20261020-ai-dlc-lens*): 004 is this file approved at G1; each spike's AC is its recorded result in the run folder, cited by the spec (ITEM-005). ACs above that depend on a spike are marked `(spike)`.

## Use-case coverage

| UC | Covered by |
|---|---|
| UC1 Watch a run, narrow panel | AC-7.1, AC-14.5, AC-14.11 |
| UC2 Wide panel flowchart | US-12 (AC-12.1–12.11), US-13 |
| UC3 Cache and context state | US-8, US-9 |
| UC4 Configure settings and avatars | US-5, US-6, US-13 |
| UC5 Per-agent cost report | US-17 |
| UC6 Gate alert | US-3, AC-14.4 |
| UC7 Subagent call in transcript | US-15 |
| UC8 Text tree in `-p` | US-16 (AC-16.4) |
| UC9 `workflow.mjs runs` | US-1, US-2 |

## Traceability

| Story | ITEM | F | UC | ACs |
|---|---|---|---|---|
| US-1 | 007 | F1 | UC9 | AC-1.1–1.5 |
| US-2 | 008 | F1 | UC9 | AC-2.1–2.8 |
| US-3 | 009 | F2 | UC6 | AC-3.1–3.10 |
| US-4 | 010, 011 | F3 | — | AC-4.1–4.6 |
| US-5 | 012 | F4 | UC4 | AC-5.1–5.6 |
| US-6 | 019 | F4 | UC4 | AC-6.1–6.9 |
| US-7 | 013 | F5 | UC1 | AC-7.1–7.12 |
| US-8 | 014 | F6 | UC3 | AC-8.1–8.8 |
| US-9 | 014, 028 (spike b) | F6 | UC3 | AC-9.1–9.7 |
| US-10 | 014 | F6 | UC3 | AC-10.1–10.6 |
| US-11 | 014 | F6 | UC3 | AC-11.1–11.9 |
| US-12 | 015, 027 (spike a) | F7 | UC2 | AC-12.1–12.11 |
| US-13 | 015, 019, 029 (spike c) | F7, F4 | UC2, UC4 | AC-13.1–13.9 |
| US-14 | 016, 027 | F8 | UC1, UC6 | AC-14.1–14.11 |
| US-15 | 017, 027 | F9 | UC7 | AC-15.1–15.6 |
| US-16 | 018 | F10 | UC8 | AC-16.1–16.4 |
| US-17 | 020 | F11 | UC5 | AC-17.1–17.6 |
| US-18 | 021 | F12 | — | AC-18.1–18.3 |
| US-19 | 022 | F13 | UC4 | AC-19.1–19.4 |
| US-20 | 023 | F13 | — | AC-20.1 |
| US-21 | 024 | F14 | — | AC-21.1–21.3 |

**Success measures (brief §10) to ACs:**

| M | ACs |
|---|---|
| M1 build checks | AC-1.2, AC-4.1, AC-4.3, AC-4.5, AC-19.1, AC-19.3 |
| M2 field uniqueness | AC-14.6 |
| M3 transcript cards | AC-15.1, AC-15.2, AC-15.4 |
| M4 settings precedence | AC-5.1, AC-5.2, AC-5.3, AC-5.4 |
| M5 licences | AC-18.1, AC-18.2 |
| M6 manual VS Code check | AC-3.10, AC-6.7, AC-6.8, AC-11.9, AC-12.10, AC-12.11, AC-13.8, AC-14.11, AC-15.6, AC-19.4 |
| M7 G4 zero Blockers | none: process gate of ITEM-025 |
| M8 (O1) | AC-7.1, AC-12.8 |
| M9 (O2) | AC-8.1, AC-8.5, AC-9.1, AC-9.2 |
| M10 (O3) | AC-3.6, AC-3.7 |
| M11 (O4) | AC-17.1 |
| M12 (O6) | AC-11.1–11.7 |
| M13 outcome signal | none: release judgement (A6) |

**AC count per route (revision 2):** `[PT]` 96 · `[NT]` 16 · `[BV]` 11 · `[DC]` 11 · `[MV]` 10 · total 144.

## Settings register

Types: `bool` accepts `on`/`off`/`true`/`false`; `int` is a whole number; ranges are inclusive. Ranges are G1 assumption A22. Keepwarm settings (`always`, keepwarm window, `every`) and keepwarm constants are dropped (00b).

| Setting | Type | Allowed | Default | Upstream | AC |
|---|---|---|---|---|---|
| `awareness` | bool | on, off | `on` (upstream `off`; C2) | context-view | 11.1, 11.7 |
| `awarenessFrom` | int, tokens | 0–10,000,000 | 0 | context-view | 11.3 |
| `awarenessWithin` | int, tokens | 0–10,000,000 | 0 | context-view | 11.3 |
| `awarenessStep` | int, tokens | 0–10,000,000 | 20,000 | context-view | 11.2 |
| `awarenessAt` | enum | `prompts-and-tool-results`, `prompts`, `tool-results` | `prompts-and-tool-results` | context-view | 11.4 |
| `contextMeter` | bool | on, off | `on` | context-view (row shown/hidden) | 8.7 |
| `meterCells` | int, cells | 4–40 | 20 | context-view constant | 8.6 |
| `meterGlyphs` | enum | `parallelogram`, `block` | `parallelogram` | context-view constant | 8.6 |
| `contextWarnAt` | number | 0.05–0.95 | 0.6 | context-view constant | 8.2 |
| `contextErrorWithin` | int, tokens | 0–1,000,000 | 20,000 | context-view constant | 8.2 |
| `compactReserveFallback` | int, tokens | 0–1,000,000 | 33,000 | context-view constant | 8.3 |
| `contextPollMs` | int, ms | 500–60,000 | 2,000 | context-view constant | 8.5 |
| `guard` | enum | `off`, `warn`, `refuse` | `off` (upstream `refuse`; Q3) | cache-tax | 10.1–10.3 |
| `guardMinTokens` | int, tokens | 0–10,000,000 | 50,000 | cache-tax `BIG_TOKENS` | 10.2 |
| `cacheTtlMinutes` | int, minutes | 1–1,440 | unset (then `promptCacheTtl`, then 60; A15) | cache-tax `TTL_MS` | 9.1 |
| `prices` | object | `{ date: YYYY-MM-DD, rows: [{ match: string, usd: [input, output, cacheRead, cacheWrite] ≥ 0 }] }` | unset (built-in dated table) | cache-tax / savvy-progress constant (Q2) | 7.12 |
| `monochrome` | bool | on, off | `off` | cache-tax `NO_COLOR` (replaced; Q2) | 9.7, 12.7 |
| `language` | enum | `auto`, `en` | `auto` | savvy-progress (ru, he not ported; Q8) | 14.10 |
| `autoOpen` | enum | `ai-dlc`, `any`, `off` | `ai-dlc` | savvy-progress (Q9) | 14.9 |
| `slowToolMs` | int, ms | 1,000–3,600,000 | 30,000 | agent-flow | 14.4 |
| `quietMs` | int, ms | 1,000–3,600,000 | 120,000 | agent-flow | 14.4 |
| `tickMs` | int, ms | 100–60,000 | 1,000 | agent-flow | 14.8 |
| `reconcileMs` | int, ms | 500–60,000 | 2,000 | agent-flow | 14.8 |
| `invalidateDebounceMs` | int, ms | 0–1,000 | 100 | agent-flow | 14.8 |
| `openProbeMs` | int, ms | 50–5,000 | 300 | agent-flow | 14.8 |
| `autoOpenMinColumns` | int, cells | 0–1,000 | 144 | agent-flow | 14.9 |
| `keptOpenMinColumns` | int, cells | 0–1,000 | 110 | agent-flow | 14.9 |
| `maxNodes` | int | 1–1,000 | 200 | agent-flow / savvy-progress | 7.10 |
| `inlineMaxRows` | int | 1–50 | 5 | agent-flow | 14.5 |
| `descriptionMaxChars` | int | 10–500 | 60 | agent-flow | 14.2 |
| `promptExcerptChars` | int | 0–2,000 | 120 | agent-flow | 14.2 |
| `recentTools` | int | 0–50 | 5 | agent-flow | 14.2 |
| `chatTailChars` | int | 0–10,000 | 1,500 | agent-flow | 14.2 |
| `chatTailLines` | int | 0–50 | 6 | agent-flow | 14.2 |
| `chatLineChars` | int | 20–1,000 | 200 | agent-flow | 14.2 |
| `layout` | enum | `auto`, `compact`, `flowchart` | `auto` (Q4) | new | 12.1, 12.2 |
| `blinkMs` | int, ms | 100–5,000 (redraws are capped at 10 per second, 4.2:24) | 500 (Q4) | new | 12.7 |
| `runStatePollMs` | int, ms | 500–60,000 | 2,000 (Q1) | new | 3.7 |
| `transcriptCards` | bool | on, off | `on` | new (00b) | 15.4 |
| `avatarInitials.<agent>` | string | 1–3 characters | initials of the display name | new (00b) | 13.1, 13.2 |
| `avatarColor.<agent>` | string | `#rrggbb` | fixed colour per agent type | new (00b) | 13.1, 13.2 |
| `avatarImage.<agent>` | string, path or `data:` URI | trusted file path, or data URI of an allowed type | unset | new (C3) | 13.3–13.7, 13.9 |
| `avatarImageTypes` | list | subset of `image/png`, `image/jpeg`, `image/gif`, `image/webp` | `image/png` until spike (c) sets it | new (C3) | 13.5 |
| `avatarImageMaxBytes` | int, bytes | 1–2,097,152 (2 MiB, 3.2:27) | 2,097,152 until spike (c) sets it | new (C3) | 13.5, 13.7 |

Not lens settings: Claude Code's `theme`, `promptCacheTtl`, `autoCompact` and `autoCompactWindow`, which the lens reads and never writes. agent-flow's `GONE_AFTER_MISSES` and `EVENT_LOG_SIZE` are internal bookkeeping, left to the spec (A8b). savvy-progress has no other settings (4.5:21-24).

## Decisions (human, 2026-10-22)

C1–C3 as in brief §12. Q1–Q12, all accepted as recommended:

| Q | Decision | ACs |
|---|---|---|
| Q1 | Alert at the first run-state check after the change; lens poll `runStatePollMs` 2,000 ms; toast and attention row with the lens, visible session line without it | 3.6, 3.7, 3.8 |
| Q2 | Every upstream constant becomes a setting, including a `prices` override; `NO_COLOR` replaced by `monochrome` | 7.12, 9.7, register |
| Q3 | Guard modes `off`/`warn`/`refuse`, default `off` (upstream `refuse`), `guardMinTokens` 50,000 | 10.1–10.4 |
| Q4 | `layout` `auto`/`compact`/`flowchart`, default `auto`; `blinkMs` 500 | 12.1, 12.2, 12.7 |
| Q5 | Header = main thread; subagent row = its own context; awareness counts the main thread only | 8.5, 11.2, 14.3 |
| Q6 | Unknown model: `—` and session total marked `partial` | 7.7 |
| Q7 | Task bar from the run.md *Stages* table; no progress tool for the model | 7.9 |
| Q8 | `language` `auto`/`en` only; upstream ru and he not ported in preview1 | 14.10 |
| Q9 | `autoOpen` `ai-dlc`/`any`/`off`, default `ai-dlc` | 14.9 |
| Q10 | Ledger per run, persisted across sessions on the same machine | 17.4 |
| Q11 | A settings change applies after the lens reloads; the README marks which need a reload | 5.5, 21.3 |
| Q12 | Desktop covered by automated `surface: 'desktop'` tests only | 12.1, 12.2 |

## G1 assumptions (for the human to confirm)

- A1 (brief minor 3) **Spikes before G2.** Spikes (a) ITEM-027 and (c) ITEM-029 run between G1 and the spec (brief §9), which changes the `00b` sequence (waves 3 to 5: 6, G1, 7, G2) and adds a **manual VS Code check by the human before G2**, besides the M6 check at G4. Spike (b) ITEM-028 runs before G2 only if the fold merge has landed.
- A2 (brief minor 2) Awareness is decided (C2); brief §13:213 listing it under "Open" is a leftover.
- A3 (brief minor 1) Alert latency is "the first run-state check after the change" (Q1), asserted by AC-3.6 and AC-3.7.
- A4 (brief minor 4) The M6 avatar step reads "an avatar image draws, or, where spike (c) found it cannot, the initials fallback shows" (AC-13.8).
- A5 Desktop: decided (Q12).
- A6 M13 has no AC; it is a release judgement.
- A7 An unreadable run.md is listed by `runs` as `unknown` with a stderr warning (AC-2.5); the hook ignores it (AC-3.5).
- A8 Display names come from the orchestrator's roster, else the agent's default `Persona name:` (AC-7.2); how the lens locates those files is a G2 decision. A8b: agent-flow's `GONE_AFTER_MISSES` and `EVENT_LOG_SIZE` stay internal unless the spec finds a user need.
- A9 `NO_COLOR` replaced by `monochrome` (Q2).
- A10 User-facing cost history and export stay out of preview1 (brief §8).
- A11 The binding 00b field set wins over brief F5's wording: type, model, own context, est. spend and elapsed are in the expanded row (AC-7.1, AC-14.1).
- A12 Settings levels L1–L4 as defined in *Terms*; the process environment is not a level.
- A13 "Human gate reached" = the record named by `last-record` has `to: human` and a `gate:` other than `none` (handoff:37, :101, :104; the orchestrator writes a `to: human` gate record at every human gate). No new run.md field is added.
- A14 `init` registers the gate-alert hook on Claude Code's `Stop` event (fires at least once per turn), and the hook reports through the `systemMessage` field of its JSON output. If G2 picks another event or channel, AC-3.1 and AC-3.8 change with it.
- A15 Cache TTL: `cacheTtlMinutes` (L1–L3) > Claude Code `promptCacheTtl` > 60 minutes.
- A16 Layout keys on `placement`, never pixels; 800 px is only VS Code's dock rule (4.2:31), used in manual steps.
- A17 Loop round `N/M` comes from the newest *Gates and loops* row whose round cell begins with `round N / M` (handoff:246).
- A18 Stage attribution: the handoff record named in the spawn prompt, else the single `in-progress` stage, else the `in-progress` stage owned by the agent, else `unattributed` (AC-17.2).
- A19 Headroom = window − reserve − tokens, reserve from `/context`, else `compactReserveFallback` (matches 00b:84's example). The architect confirms against context-view's `Readings` module at G2 (4.4:81, 4.4:123).
- A20 "Lists no X" checks (AC-9.5, AC-15.5) are source searches with the patterns given, not `plugin validate` output: the research does not show what `validate` reports beyond "the events and calls the mod uses" (3.2:56).
- A21 Per-agent setting keys are `<setting>.<agent-id>` for ai-dlc agents and `<setting>.<plugin>:<agent>` for others (AC-6.9).
- A22 Setting types and ranges as in the register; the spec may widen a range, never narrow a default out of it.
- A23 `meterGlyphs` is a plain choice; the lens does not detect Ghostty from `TERM_PROGRAM`, so that no process environment is read.
- A24 The keep-alive code's own licence (vendored cache-keepalive, `hooks/auto-handoff/keepalive/LICENSE` on the fold branch `fix/auto-handoff-chain`, unmerged) belongs to run `AAW-20261022-fold-cache-keepalive`, not to the lens; the lens copies no keep-alive code, only reads its state (critique minor 6, rejected for this file).
