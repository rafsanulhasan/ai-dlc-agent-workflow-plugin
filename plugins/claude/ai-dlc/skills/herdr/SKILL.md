---
name: herdr
description: "Gives each subagent or teammate the orchestrator spawns a labelled pane in the herdr terminal workspace, herdr.dev (Claude Code only): the pane shows its progress (watch, the default), or the subagent runs as its own claude process in it (run-in-pane). Teaches the herdr commands the script uses. Use when the session runs inside herdr (HERDR_ENV=1, or this session's pane is found), before spawning or shutting down agents there, to drive herdr panes, or to change the herdr setting. Never installs herdr; outside herdr it does nothing."
---

# herdr panes

## What this is, and what it is not

[herdr](https://herdr.dev) is a terminal workspace for coding agents: workspaces, tabs and panes, driven from a CLI and a local server (source: [github.com/herdrdev/herdr](https://github.com/herdrdev/herdr), Apache-2.0; commands: the [CLI reference](https://herdr.dev/tui/docs/cli-reference/)). This skill is the ai-dlc plugin's own text, not herdr's.

When a Claude Code session runs inside herdr, **Scott Hanselman** (`orchestrator`) gives every agent it spawns a pane of its own, labelled `<agent> <step>`:

- **watch** (the default): the agent is spawned with the `Agent` tool as usual; its pane shows the brief, the run folder's records for that agent and, when found, its transcript. The pane closes when the agent hands back (a subagent) or is shut down (a teammate).
- **run-in-pane**: each subagent runs as its own `claude -p --agent ai-dlc:<id>` process in its pane, and its final report becomes the hand-back.
- **off**: no pane, even inside herdr.

- **Claude Code only.** On GitHub Copilot this skill is not shipped: do nothing.
- **Never installs herdr.** The user installs it (winget on Windows, herdr's installer elsewhere). Without it nothing happens.
- **Never blocks a run.** Every failure is one line in the run state; the run goes on with the `Agent` tool.

`<skill dir>` below is this skill's base directory, as the harness reports it when the skill loads (`${CLAUDE_SKILL_DIR}`). The script is `node <skill dir>/scripts/herdr.mjs` (Node 22 or later, no dependencies); run it from the repository root.

## Activation

`detect` decides, read-only, in this order:

1. `mode` is `off` → inactive.
2. `herdr --version` fails → inactive: herdr is not on PATH. Outside herdr, nothing past this call runs.
3. `herdr status server` does not print `status: running` → inactive. Its exit code is 0 either way, so the script reads the text.
4. This session's pane:
   - `HERDR_ENV=1` → active. The anchor (the pane new panes split from) is `HERDR_PANE_ID` when set, else the pane match below when it is unique, else none (herdr splits the current pane).
   - `HERDR_ENV` missing or not `1` → active only when exactly one entry of `herdr pane list` is this session's pane: `agent: claude`, `agent_status: working`, `cwd` this repository, and not a pane this skill opened. No match, or more than one, is inactive, never a guess. The first match of a run is cached in its state folder, so later panes of our own do not confuse it.

herdr exposes no process id or terminal of a pane, so the match is evidence, not proof: two working Claude Code sessions in the same folder are ambiguous and stay inactive. To force activation, set `HERDR_ENV` to `1` in the `env` of `.claude/settings.local.json`; it means the same as the variable herdr sets.

Inactive means nothing is created and nothing is printed; the reason is data for the run state, never a warning. With herdr installed but this session elsewhere, `detect` makes three read-only calls (`--version`, `status server`, `pane list`) and nothing else.

herdr variables the skill uses: `HERDR_ENV` (inside herdr), `HERDR_PANE_ID` (optional anchor), `HERDR_SOCKET_PATH` (read by herdr only).

## The orchestrator's procedure

One `Bash` call per action. Read each call's JSON line for `ok` only; every command exits 0 except a usage error (exit 2).

**Run start.** Run `node <skill dir>/scripts/herdr.mjs detect --run <run folder>` (without `--run` before the run folder exists). Record one line in the run state's *Gates and loops*: `herdr: active (watch)`, `herdr: active (run-in-pane)` or `herdr: inactive: <reason>`. Inactive → skip the rest of this skill for the run.

**Watch, subagent.** After the handoff record and the run state are written:

```
node <skill dir>/scripts/herdr.mjs open --run <run folder> --step <code> --agent <id> --record <handoff record>
```

For a parallel fan-out, put every pair in one call, each `--record` after its pair: `--step 1.4.1 --agent code-reviewer --record <r1> --step 1.4.2 --agent code-reviewer --record <r2>`. Then spawn with `Agent(...)` as usual. After the hand-back is stored:

```
node <skill dir>/scripts/herdr.mjs close --run <run folder> --step <code> --agent <id>
```

`ok:false` from either → one line in the run state, then go on.

**Watch, teammate** (`request-routing`, Mode 5; whatever the setting). `open` as each teammate is spawned. `close` only after the team lead has had that teammate's shutdown confirmed. Never close a teammate's pane because it is idle or waiting for another teammate's handoff or reply: the pane is where the human watches it wait. A team stage under `run-in-pane` stays a team and is marked `team (herdr watch)` in the Routing Plan's Mode column.

**Run-in-pane** (subagent stages only). Record the stage's mode as `subagent (herdr run-in-pane)`. Instead of `Agent(...)`, one `Bash` call per agent, each with `run_in_background: true` (a run can take longer than the 10-minute foreground limit):

```
node <skill dir>/scripts/herdr.mjs run --run <run folder> --step <code> --agent <id> --record <handoff record> --out .scratch/herdr/<run-id>/<code>-<id>.result.md
```

`<run-id>` is the run folder's name. `--record` and `--out` are repository-relative and may hold only letters, digits, `.`, `_`, `-` and `/`. Add `--worktree <name>` only when the brief asks for isolation. When the call exits:

- `ok:true` means **the agent's final text was copied to the file named in `result`**, nothing more: it does not mean the hand-back is valid. Copy that file verbatim into `<code>-<id>-to-orchestrator.handback.md` and check its line 1 like any hand-back. Record `source` (`file` or `pane`, below) with the hand-back in the run state, and a non-zero `permissionDenials` too.
  - `handoffLine:false` (line 1, shown in `line1`, is not `handoff <file>: passed|failed — <why>`; a Stop hook that rewrites the child's final text does this) → a **failed hand-back**: keep the stored text, set its verification to `failed — child's final text is not a hand-back (line 1: <line1>)`, then spawn the same step with `Agent(...)`. This is not a loop round, and the step is not run in a pane again.
  - `source:"pane"` → the result file gave no result and the text came from the pane copy (*Result retrieval*, below), checked byte for byte by size and sha256. Use it as above and say `source: pane` in the verification note.
- `stage:"launch"` (the agent never started) → spawn the step with `Agent(...)` and record `herdr run-in-pane unavailable: <reason>; spawned with the Agent tool`.
- `stage:"run"` (it started, and neither the result file nor the pane copy gave a usable result) → store a hand-back whose line 1 is `handoff <file>: failed — herdr run-in-pane gave no result (<reason>)`, then spawn the same step with `Agent(...)`; this is not a loop round. The pane stays open; name it in the run state, and `close` it once the human has seen it.

Read results with the file tools, never from the pane; only the script reads the pane, in its fallback.

**Nested spawns** (a subagent's own subagents) get no pane.

## Commands the script calls

Only these herdr commands are used; nothing else is documented here.

| herdr command | Used by | Source |
|---|---|---|
| `herdr --version` | `detect` | CLI reference; checked live (herdr 0.9.5, Windows) |
| `herdr status server` | `detect` | CLI reference; checked live: exit 0 and `status: not running` when the server is down |
| `herdr pane list` | `detect` (the pane match), `open` (live panes), `run` (pane liveness) | CLI reference; checked live (JSON `result.panes[]` with `pane_id`, `agent`, `agent_status`, `cwd`) |
| `herdr pane split <pane>\|--current --direction right\|down --no-focus --cwd <root>` | `open`, `run` | CLI reference; checked live (`--no-focus`, `--cwd`) |
| `herdr pane rename <pane> "<agent> <step>"` | `open`, `run` | CLI reference; checked live (shows as the pane's `label`) |
| `herdr pane run <pane> "<command>"` | `open`, `run` | CLI reference; checked live (runs in the pane's shell, PowerShell 7 on the tested Windows) |
| `herdr pane close <pane>` | `close`, `run` | CLI reference; checked live: an unknown pane is `pane_not_found` with exit 1, which counts as closed |
| `herdr pane read <pane> --source recent-unwrapped --lines 100000` | `run`, fallback only | CLI reference; checked live: plain text on stdout; a closed pane is `pane_not_found` with exit 1 |

herdr also offers `pane wait-output` (checked live: it works, but returns only the tail of the pane), tabs and workspaces; this skill does not use them.

**Result retrieval** (`run`). The main path is the **result file**: the child writes the agent's final text to `--out`, then a `.exit` file with its size and sha256, so a `.exit` means the result is final. The fallback is a **pane copy**: the child also prints the text in its pane as base64 between two markers carrying a per-run nonce, the byte count and the sha256, and `run` reads it with `pane read` only when the file channel lost a result the child produced (the file missing, empty or not matching `.exit`, a write error, or no readable `.exit`). It never overrides the child's own verdict: when `.exit` says the result is not usable, there is no fallback. Why base64 and a cap, from live checks on herdr 0.9.5 (Windows): `pane read` without `--lines` returns only a tail; plain text loses tabs, trailing blanks and colour codes; scrollback is bounded (about 500 to 1000 rows), so a copy is printed only for a result of at most 16 KiB; and an older copy stays in the scrollback, hence the nonce.

## Script commands

| Command | Does |
|---|---|
| `detect [--explain] [--run <dir>]` | Activation, above. `--explain` adds the matching panes |
| `open --run <dir> (--step <c> --agent <id> [--record <path>])...` | Opens a watch pane per pair: the first pane of the run to the right of the anchor, later ones below the newest live pane |
| `close --run <dir> (--step <c> --agent <id>)...` | Closes the panes `open` or `run` stored; closing for any other reason never happens |
| `run --run <dir> --step <c> --agent <id> --record <path> --out <path> [--worktree <name>] [--timeout <minutes>]` | Run-in-pane, above; blocks until the result, a timeout or the pane closing. Its JSON: `ok`, `result`, `source`, `exit`, `line1`, `handoffLine`, `permissionDenials`, `sessionId`, `costUsd`; or `ok:false` with `stage` and `reason`. `--timeout` is above 0 and at most 720 |
| `watch <job>`, `child <job>` | Run inside a pane; started by `open` and `run`, never by hand |
| `show [--json]`, `merge [--dry-run]`, `set <key>=<value>... [--dry-run]`, `validate` | Settings, below |

State and job files are in `.scratch/herdr/<run-id>/`, one file per pane, so parallel calls do not race.

## Settings

`.ai-dlc/herdr.json` (optional), schema [templates/herdr.schema.json](templates/herdr.schema.json):

| Key | Values | Default | Variable |
|---|---|---|---|
| `mode` | `watch`, `run-in-pane`, `off` | `watch` | `AI_DLC_HERDR_MODE` |
| `runTimeoutMinutes` | above 0, at most 720 | `60` | `AI_DLC_HERDR_RUN_TIMEOUT_MINUTES` |

Each key is read from the first of these that sets it to a valid value:

1. `env` of `.claude/settings.local.json`: one developer's choice, not committed;
2. `env` of `.claude/settings.json`: the team's;
3. the process environment;
4. `.ai-dlc/herdr.json`;
5. the default.

An invalid value is a `warning:` in `show`, an error in `set` and `validate`, and the next level applies. `null` in the file means not set there.

- **Show:** `node <skill dir>/scripts/herdr.mjs show` prints each key's value and the level it came from (`--json`: the same as one JSON document). It never writes.
- **Change:** ask whether the change is the developer's own (the `env` of `.claude/settings.local.json`, edited directly) or the team's (`set <key>=<value>`, which writes `.ai-dlc/herdr.json` only when every assignment is valid, else exits 1 and writes nothing; `merge` first creates it with every key `null` and copies the schema, keeping values already set). `--dry-run` on either writes nothing. Run `validate` after a change: it checks the file and the other levels and exits 1, one line per invalid value, when any is invalid.

No key is trust-gated. What was checked: run-in-pane starts the same plugin agents, `--permission-prompts none` is accepted and turns a prompt into a denial, never an approval, and neither key widens a permission. What it does add: each subagent becomes a separate `claude` process with its own session and cold cache, so it costs more, and it may run for up to `runTimeoutMinutes` (at most 720 minutes) before the script stops it. Whether the project's `permissions.allow` rules apply to a `-p` child is not verified.

## Known limits

- **Permissions.** A `claude -p` child cannot answer a permission prompt: a tool that needs approval is denied, the agent reports it, and `permissionDenials` counts it. It never runs with bypassed permissions.
- **The hand-back is the final result text** of the child, and `ok:true` only means it was copied. The child runs the project's hooks like any session, so a Stop hook that blocks can make the final text about the hook instead of the work (seen live: the plugin repository's staleness check). `run` reports this as `handoffLine:false`, and the orchestrator treats it as a failed hand-back and spawns the step with the `Agent` tool.
- **The pane copy is limited**: at most 16 KiB, and only while the pane is open. A larger result, or one whose pane was closed, depends on the result file alone.
- **Stopping a child** at its timeout stops everything it started: `taskkill /t /f` on Windows; elsewhere the child runs in its own process group, which gets SIGTERM and, 5 seconds later, SIGKILL. Closing a run-in-pane pane mid-run does the same: the wrapper stops the agent and everything it started, then still writes its `.exit` file (no usable result). Whether herdr sends SIGHUP when it closes a pane is not verified.
- **Teams cannot run in panes**: teammates belong to Claude Code's own session, so team stages always use watch.
- **Cost.** Each child starts its own session with a cold cache.
- **`claude` as a `.cmd` shim** (npm install on Windows) runs through `cmd.exe`, so every argument that reaches it must pass a strict character check; the brief is a fixed text naming only the record path.
- **Not verified:** whether a Bash call inside herdr always carries `HERDR_ENV` (it did not in the tested session); whether a running subagent's transcript grows live (the watch pane shows it only if found); `--worktree` with `claude -p`; whether project `permissions.allow` rules apply in `-p`.

## Windows

Checked on Windows 11 with herdr 0.9.5: `pane run` uses the pane's PowerShell, and the pane stays at its prompt after the command ends, so the script always closes it from outside. The script never uses `terminal attach`. It passes only paths and a job file to the pane, with forward slashes and quotes only around a path with a space, a form sh, pwsh and powershell read the same. Gaps between platforms are stated here as found, never guessed.
