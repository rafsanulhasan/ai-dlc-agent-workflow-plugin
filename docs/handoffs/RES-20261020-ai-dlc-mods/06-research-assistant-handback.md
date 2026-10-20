# Hand-back 06: research-assistant — cluster F-teamwork-worktrees

Stored verbatim on 2026-10-20 (work item RES-20261020-ai-dlc-mods).

---

I read all six mod pages, the Claude Code docs on worktrees, background agents, agent teams, cross-session messaging and VS Code, and the repo's handoff skill and hooks. Nothing on the claude-mods.com pages is verified by me against the source repos: I didn't clone or read them. Tested versions and Windows support are only what the pages say.

## Per-mod table

| Mod | What it does | How it works | Where it runs (per page) | License / source | Maturity |
|---|---|---|---|---|---|
| **shared-session** | Teammates join the host's Claude Code session through a link and send it prompts. Every tool runs on the host's machine, and the host approves guest edits, shell commands and network use. | Hooks on `prompt.submit`, `tool.call`, `turn.complete` and `ui.render`; commands `/share-session`, `/room`, `/team`, `/invite`. Traffic goes through a relay (a Cloudflare Worker by default, self-hostable). The page says it is "not end to end" and the relay can read shared content. | Terminal and Desktop. VS Code not mentioned. Needs Claude Code 2.1.287+, `/bin/sh` and `curl`; Windows not mentioned (unverified). | MIT, github.com/Paradigm-Study/claude-share | 292 stars, updated 2026-10-16, no version, "Tested with: Not stated". Rooms up to 20 people, can be limited by email domain or GitHub org. |
| **threads** (promptadvisers) | A lead chat starts and steers helper "threads": either separate `claude` processes or background subagents. Supports fork, handoff, phased plans with handoff files between phases, and a worktree per thread. | A private tmux server (`tmux -L cc-threads`), screen capture and transcript polling every 2–10 s, hooks, state in `~/.claude/threads/`. Session threads start in `bypassPermissions` by default. | CLI 2.1.287+ with tmux. Setup is Mac-oriented (`brew`, `open`). VS Code not mentioned. | MIT, github.com/promptadvisers/claude-mods-computer-use-threads | The author calls it "unofficial, experimental". 18 stars, 4 live threads by default. |
| **multi-core** | Lets one session run models from other providers (ChatGPT, Cursor, OpenCode, Antigravity, Grok). | A local gateway started by the `claude-multi` launcher. No worktrees or parallel sessions. | Terminal only; plain `claude` is untouched. Needs Node 24.12+. | Apache-2.0, github.com/greenpolo/cc-multi-cli-plugin | v0.3.0, 193 stars. **Not relevant to R9 or R12.** |
| **claude-fleet** | A terminal dashboard of every running session: status, branch, uncommitted work, context size. It can write handoff summaries and close sessions. It lists worktrees that have no session. | Reads `~/.claude/sessions/` (internal, "not a public API"), plus `ps`, `git status` and `git worktree list`. | CLI only, **macOS/Linux only, does not run on Windows**. Loaded with `--plugin-dir`, no marketplace. | MIT, github.com/Dubbus/claude-fleet | 1 star, early-stage, could break when Claude Code changes. |
| **commonplace** | Turns an Obsidian-style Markdown vault into a wiki Claude maintains. | Skills, hooks, and `vault_search` / `vault_note` tools; local Ollama embeddings. | Terminal. Windows not addressed. | **No license file**, github.com/noopz/commonplace | 11 stars. No team or sync features; **not relevant**. |
| **autodev-core** | An autonomous sprint loop: brainstorm, auto, iterate, audit, review, ship. | State in `prd.json`; a Stop hook keeps `auto` running while stories are pending. Its only worktree rule denies `git worktree add` outside `.claude/worktrees/`, which conflicts with this repo's `.worktrees/`. | Terminal and Desktop; VS Code not mentioned. | MIT is declared, but the repo has no LICENSE file. github.com/djnsty23/claude-auto-dev | v8.181.0, 6 stars. Its loop competes with the ai-dlc lifecycle and gates. |

## Built-in Claude Code features (docs)

- **Worktrees:** `claude --worktree <name>` (or `-w`) creates `.claude/worktrees/<name>/` on branch `worktree-<name>`. A `WorktreeCreate` hook replaces where and how worktrees are made, which is how this repo puts them under `.worktrees/` (`.claude/settings.json:53-64`, `.claude/hooks/worktree-create.mjs`). Subagents can run in their own worktree with `isolation: worktree` (https://code.claude.com/docs/en/worktrees).
- **Background agents:** `claude --bg "<task>"`, `/bg` and `claude agents` (agent view). Each session is moved into its own worktree before it edits files. Rows show PR status, and the page warns that "Claude-created worktrees are deleted with the session" (https://code.claude.com/docs/en/agent-view). That page covers the CLI only. The VS Code docs mention background agents running on after Stop, but full agent-view parity in VS Code is unverified (vs-code doc, the line about background agents and "the map").
- **Agent teams:** experimental (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`). One team per session, no nesting, no resume for in-process teammates. Split panes don't work in VS Code's terminal or Windows Terminal. All teammates are Claude instances; none can be a human (https://code.claude.com/docs/en/agent-teams).
- **Cross-session messaging:** works between "your other Claude Code sessions" on this machine, and across your own machines through Remote Control. It is scoped to one user, so it cannot reach a colleague (https://code.claude.com/docs/en/cross-session-messaging).
- **VS Code:** multiple conversations in tabs, the same plugins as the CLI, and mods can draw in the panel from extension 2.1.299+ (https://code.claude.com/docs/en/vs-code).

## What the repo already supports for handing off between humans

- `run.md` is committed at each gate and at close "so the run also survives a lost machine and is visible to the team". It records `owner`, `session` and `branch`, and "two sessions never drive one run at the same time" (`plugins/claude/ai-dlc/skills/handoff/SKILL.md:134-136`).
- On resume, the orchestrator asks the human before taking over a run on another branch or one another session wrote (`SKILL.md:138`).
- The session handoff already covers "moves to another machine or tool" (`SKILL.md:203`).
- **Gap:** a gate's approver can only be `human`, `orchestrator` or `none` (`plugins/claude/ai-dlc/skills/workflow/templates/workflow.schema.json:184-185`). There is no field for which person owns a role or approves a gate, and no link to a GitHub issue or PR.

## R9: one human per agent role, handing off through ai-dlc

- **Covered by:** git. Committed `run.md`, handoff records and hand-backs on a shared branch or PR already let person B pull and resume person A's run (`SKILL.md:134,138`).
- **Gaps:**
  - No mapping from role or gate to a person (schema enum above).
  - Nothing tells the next person a handoff is waiting: no issue, PR assignment or notification.
  - No claim or lock on a run beyond the "ask before takeover" rule.
  - Built-in messaging is single-user, and agent teams have no human teammates.
- **shared-session** does not fit R9. It is several humans steering *one* host session, not each person running their own role on their own machine. It also has relay privacy concerns and unconfirmed Windows support.
- **Feasibility:** high if the handoff is built on git and GitHub.
- **Recommendation: build.**
  - Add an optional per-role or per-gate human assignee (for example `roles.<agent>.humans` and `gates[].approvers: ["@login"]`) to the workflow schema.
  - Add an optional mirror of each handoff to a GitHub issue or PR: open or comment on an issue per work item, assign the next role's owner, link `run.md`, and treat PR review approval as the gate signal.
  - Add a `claimed-by` field to `run.md`.
- **Reuse the idea** of shared-session's team admission by GitHub org or email domain for role authorization.
- Optionally list shared-session as a pairing aid (several people watching one session). Don't integrate it.

## R12: several unrelated tasks, each with its own workflow, in separate worktrees

- **Covered by:**
  - The built-ins: `--worktree`, `claude --bg` with a worktree per session, and `isolation: worktree` for subagents.
  - The repo's `WorktreeCreate` hook and `.worktrees/` convention.
  - Per-work-item `run.md` files that already carry `branch` and `session`.
- **Gaps:**
  - No ai-dlc view across all active runs and worktrees.
  - Not documented whether each worktree gets its own orchestrator session. `CLAUDE.md` says Claude Code keeps subagent worktrees and they must be removed by hand.
  - The orchestrator's resume step only offers runs on the current branch, so a per-worktree session isolates naturally (`SKILL.md:138`). Confirming that this is enough is an open question.
- **Mods:**
  - **threads** fits conceptually (lead plus worktree threads, phased handoff files), but it needs tmux, is Mac-oriented, bypasses permissions by default and is experimental. Not feasible on the user's Windows machine (unverified, per the page).
  - **claude-fleet** doesn't run on Windows.
  - **autodev-core**'s worktree deny rule and autonomous loop conflict with ai-dlc.
- **Feasibility:** high with the built-ins.
- **Recommendation: build a thin layer on the built-ins.**
  - A documented "one orchestrator session per worktree" recipe: `claude -w <slug> --agent ai-dlc:orchestrator`, or `claude --bg` and `claude agents` on the CLI, or VS Code tabs.
  - A read-only `runs` listing that scans `docs/handoffs/*/run.md` across `git worktree list`.
- **Reuse the idea** of claude-fleet's dashboard and threads' phase-handoff files. Don't integrate either.

## Not relevant

multi-core and commonplace don't address R9 or R12.

## Unverified / open

- Windows support for shared-session and threads (their pages are silent or Mac-oriented).
- Whether agent view (`claude agents`) is fully available in VS Code.
- Whether the background-session worktree isolation respects a custom `WorktreeCreate` hook. The docs say hook-created worktrees are kept by the sweep, but they don't say whether `--bg` uses the hook.
- Whether the mods' repos match their pages: none were read.

No files were written. I didn't save to memory because this session is read-only (plan mode).
