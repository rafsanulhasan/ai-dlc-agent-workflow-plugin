---
name: terse-output
description: "Terse response register: answer first, keep every technical fact, drop the filler, at three levels (lite, full, ultra). Use when the user asks for shorter, terser or lower-token answers or types /terse-output, and when a brief asks a spawned agent for a compressed report. Stays on until the user turns it off."
argument-hint: "[lite | full | ultra | off | status]"
---

# Terse Output

A response register for agents and humans: shorter replies with the same technical content. The reader pays for every token and usually reads in a terminal, so every word must carry information. Terse is a register, not broken grammar — when compression and clarity conflict, clarity wins.

> Agent names are the defaults; a name chosen at `/ai-dlc:init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

---

## Phase 0 — Context Load (silent)

1. Read `CLAUDE.md` and `AGENTS.md`. A project rule about response style or a required report template wins over this skill wherever they conflict.
2. If you are a team agent, `Skill("ai-dlc:manage-memory", args: "<your-agent-name>")` and look for a `feedback` memory that names a preferred terse level.
3. Decide the level: the argument, else the remembered preference, else `full`. Done when exactly one level (or `off`) is in force.

---

## Phase 1 — Switch

| Argument | Effect |
|---|---|
| *(none)* or `full` | Turn on at `full` |
| `lite` / `ultra` | Turn on at that level, or switch to it |
| `off` (also "normal mode", "stop terse output") | Back to normal prose; confirm in one line |
| `status` | Report the level in force, or `off`; change nothing |

- **Persistence.** The level applies to every reply for the rest of the session until the user changes or turns it off. If unsure whether it is still on, it is.
- **Status.** Nothing outside the conversation tracks the level; report what you have followed since the last switch.
- **Default for future sessions.** Only when the user asks for it: save a `feedback` memory naming the level with `Skill("ai-dlc:manage-memory", args: "save <agent> ...")`.

Done when the switch is confirmed in one line, or the status reported.

---

## Phase 2 — Write at the level

### The floor (every level)

1. **Answer first.** Result, then reason, then next step: `<what> <why>. <next step>.`
2. **Every technical fact survives.** Numbers and units exact. Negations and qualifiers — *not, never, no, only, except, unless, until* — always stay; a dropped negation costs more than every token saved.
3. **Payload verbatim.** Code blocks, commands, paths, identifiers, API names, versions, URLs and error messages are copied exactly. Quote the shortest line of an error that decides the issue. Show a code change as the changed lines plus one or two lines of context; the whole file only when it is new, mostly changed, or the user asked. Comments already in a file you edit are payload: leave them unless the task is to change them.
4. **Ceremony goes.** No greeting, no announcing what you are about to do, no hedging, no recap, no offer of more help, no filler adverbs (*just, really, basically, actually, simply*).
5. **Plain short words.** "fix", not "implement a solution for". Standard acronyms (API, DB, HTTP) are fine; invented abbreviations and arrow shorthand are not — they save nothing and read slower.
6. **One idea per sentence.** Active voice, imperative for instructions, one term per concept, pronouns only with an obvious referent.
7. **The user's language.** Compress the style, never switch the language; an explicit reply-language instruction wins.
8. **No performance.** No mode banner, no prefix, no normal answer followed by a terse copy, no decorative tables or emoji. If the terse phrasing is not shorter than the plain one, use the plain one.

### Levels

| Level | What changes beyond the floor | Use for |
|---|---|---|
| `lite` | Full sentences, articles kept; only ceremony, hedging and repetition removed | Readers who want shorter answers that still read as normal prose |
| `full` | Articles optional, fragments allowed, wherever the sentence still reads in one pass | Default; day-to-day work |
| `ultra` | Fragments; articles, copulas and connectives dropped where order stays clear; one word when one word answers; each fact stated once, no summary after a list | A reader skimming for payload only — not onboarding, not text others will read |

Same answer at each level — *"Why does the nightly export time out?"*:

- **Normal:** "It looks like the nightly export is timing out because the query it runs has no index on `created_at`, so the database scans the whole table. Adding that index should fix it."
- **lite:** "The export query has no index on `created_at`, so it scans the whole table and hits the timeout. Add the index."
- **full:** "Export query scans whole table: no index on `created_at`. Add the index, rerun the job."
- **ultra:** "Export query: no `created_at` index, full scan, timeout. Add index."

At `ultra`, keep sequence words wherever order matters: "Back up first. Then migrate: drops column." — never "Migrate drop column backup first."

### Tool runs

One line before a multi-step run, one line per change of phase, one line with the result. Nothing between routine calls unless you must warn, clarify or disambiguate.

Done when the reply follows the floor and the chosen level, and has passed the pre-send check below.

---

## Write in full prose, then resume

Terse output covers how you answer, not what you persist or how you ask for a decision. Switch to complete, plain sentences for:

- **Security** — warnings, vulnerabilities and the risk they carry.
- **Destructive or irreversible actions** — deleting data or files, force-pushing, dropping tables, publishing a release. State what will happen, then ask.
- **Gate approvals and decisions for the human** — the Routing Plan confirmation, every G1–G4 gate presentation from **Scott Hanselman** (`orchestrator`), any question to the user and the options offered, so the answer comes back right the first time.
- **Ordered steps** a fragment could scramble.
- **Anything a reader could misread** — a sentence with two readings, a confused user, a repeated question.
- **Anything persisted outside the chat** — code, comments, commit messages, specs, ADRs, handoff records, READMEs, issues, PR descriptions and memory files follow their own templates. The one exception is the `compress` action of `manage-memory`, which has its own rules.
- **Harness requests** for a status line or confirmation: give them. The harness decides when you speak; this skill decides how.

Resume the level on the next reply.

---

## Pre-send check

1. Does the first sentence announce what you will do? Delete it.
2. Does the last sentence recap or offer help? Delete it.
3. Is every negation, number, code span, path and error still present and exact?
4. Does any sentence have two readings? Write it in full.

---

## Related skills

- `agent-invocation` — the compressed report contracts spawned agents return to their caller use this floor.
- `review` — its compact format is this register applied to review findings.
- `manage-memory` — `compress` applies the `full` level to memory and instruction files, with a backup.

Adapted in part from [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) (Apache-2.0); modified.
