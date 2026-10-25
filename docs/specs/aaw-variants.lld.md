---
work-item: FEAT-20261020-ai-dlc-lens
root: 19
kind: lld
feature: aaw-variants
module: ai-dlc
submodule: multi-agent-workflow
integrations: []
items: [ITEM-045, ITEM-046, ITEM-047, ITEM-048, ITEM-049, ITEM-050, ITEM-051]
author: system-engineer
date: 2026-10-24
status: draft revision 3 (bc round 1 fixed; spec rev 2: D4a, D4b, G5 design stages, G7, LEGACY_AAW, handoffReview without reviewer), awaiting brutal-critique
spec: docs/specs/aaw-variants.spec.md
adrs: [ADR-0001, ADR-0002]
stories: docs/product/active/multi-agent-workflow-foundations/sprint-1/aaw-variants/stories.md
handoff: 19.1.1-software-architect-to-system-engineer.handoff.md
---

# LLD: two AAW variants, harness and plugin / mod (root 19)

Design only. Per the team brief, the `workflow` skill's files are changed later by a freshly spawned agent-manager (D10); nothing here edits an agent artifact. Code lines are as read on 2026-10-24 in `plugins/claude/ai-dlc/skills/workflow/templates/workflow.mjs` (880 lines); the build re-checks them. Paths are under `plugins/claude/ai-dlc/` unless stated. Text changes are listed as sections to change, with no prose drafted.

## 1. Design summary

| Principle | Decision |
|---|---|
| Pure functions, a thin CLI | New pure functions in `workflow.mjs`: `checkAgentArtifact`, `kindOf`, `areaOf`, `decideVariant`, `globToRegExp`, `migrateLegacyAAW`, `signatureOf`. Each CLI command reads the file, calls one of them and prints. They take the parsed workflow and paths, and touch the file system only through `kindOf` for existing paths. |
| One rule, one place | The variant rule has one implementation (`decideVariant`); `aaw-review.md` states it in prose and names the command; the orchestrator and `request-routing` point there (AC-19.2.4). |
| Guards by role, not by lifecycle name | G1 to G7 look at agents and loops, so a custom lifecycle listed under the key is guarded the same way. |
| Existing behaviour kept | Every non-AAW validation, `rounds` for the three reviewer rows and the other commands are untouched; only the AAW block (lines 364 to 394), `TOP`, the routing key list, `ENV_VARS`/`rounds` and `merge` change. |

## 2. `workflow.mjs`

### 2.1 Constants and key sets

- `TOP` (line 156) gains `"handoffReview"`; it is **required** like the other keys (the loop at 217 reports `missing required key "handoffReview"`). `merge` adds it for consumers, so a missing key is only seen on an unmerged file.
- Lifecycle keys (line 260 `unknownKeys`) gain `"variant"`; routing keys (line 345) gain `"agentArtifact"`.
- `UNDISABLEABLE` is unchanged (spec D3); G7 (no disabled agent owns a stage of a listed lifecycle) is satisfied by the existing `usedAgent` check, which applies to `product-owner` like any agent: a repository may disable it but must then remove it from its AAW lifecycles. `AAW_REVIEWERS` is kept for the `brutal-critique` `when` rule (G4) and for the plugin variant's two reviewers (G5); its `why` strings stay and are used in the G4/G5 messages.
- New: `const VARIANTS = ["harness", "plugin"]`, `const AAW_START = ["product-owner", "software-architect", "agent-manager"]`, `const LEGACY_AAW = "AAW"`.

### 2.2 `validate`: the `routing` block (replaces lines 364 to 394)

```js
// byType["Agent Artifact"]: a list of lifecycle codes (only this key may be a list). Returns the lifecycles it names.
function checkAgentArtifact(r, lifecycles, err)            // pure apart from err
function guardVariant(code, lc, err)                       // G1 to G5 for one lifecycle
```

`validate` in the routing block (line 358) first accepts a list for `"Agent Artifact"` and a string for every other key:

1. `byType[t]` for `t !== "Agent Artifact"` must be a string naming a defined lifecycle (as today); a list there is `routing.byType.<t>: must be one lifecycle code (only "Agent Artifact" may be a list)`.
2. `aaw = byType["Agent Artifact"]`. Cases, in order, each an `err` on path `routing.byType["Agent Artifact"]`:
   - `undefined`: `missing: agent-artifact work needs its lifecycles (default ["AAWH", "AAWP"]) — run /ai-dlc:workflow upgrade to bring them in`.
   - the string `"AAW"` (legacy): exactly `routing.byType["Agent Artifact"] is the single AAW lifecycle of an older plugin; run /ai-dlc:workflow upgrade to replace it with AAWH and AAWP` (AC-19.8.1; the path is part of the message text per the spec, so `err` is called with the path `$` prefix suppressed: the line printed is `routing.byType["Agent Artifact"]: routing.byType["Agent Artifact"] is …`; the build uses `err(path, msg)` with `msg` as the spec gives it, accepting the repeated path, which keeps the spec's wording verbatim).
   - any other string: `must be a list of lifecycle codes, for example ["AAWH", "AAWP"]`.
   - a list that is empty, has a non-string, a duplicate, or a code that is not a defined lifecycle: one error each (`"<x>" is not a defined lifecycle`, `is listed twice`, `must be a non-empty list of lifecycle codes`).
   - a code that names a `segments` lifecycle: `"<x>" must be a lifecycle with stages, not segments`.
3. G6, for the list as a whole: every lifecycle named has `variant` of `harness` or `plugin` (`lifecycles.<x>.variant: must be "harness" or "plugin" for a lifecycle named in routing.byType["Agent Artifact"]`); exactly one `plugin` (`routing.byType["Agent Artifact"]: needs exactly one variant "plugin" lifecycle (found N)`) and at most one `harness`. A `variant` key on a lifecycle that is not in the list is allowed and unchecked.
4. For each named lifecycle with stages: `guardVariant(code, lc, err)`.

`guardVariant(code, lc, err)`, the stage list `st`; path prefix `lifecycles.<code>`:

| Guard | Check | Message (exact) |
|---|---|---|
| G1 | no stage with `agent === "software-engineer"` | `lifecycles.<code>.stages[<i>] (<id>): agent-artifact work never uses software-engineer (fixed guardrail)` |
| G2 | some stage with `agent === "agent-manager"` | `lifecycles.<code>: needs an agent-manager stage: agent-artifact changes are always built by agent-manager (fixed guardrail)` |
| G3 | every stage with `afterOf(st, i).length === 0` has `agent` in `AAW_START` | `lifecycles.<code>.stages[<i>] (<id>): a starting stage must be product-owner, software-architect or agent-manager (fixed guardrail)` |
| G4 | a `brutal-critique` stage exists and loops back (`loop.to` names an `agent-manager` stage); its `when`, if present, is exactly `the change set contains docs` (case and spacing ignored, same normalisation as line 387) | the existing messages with the lifecycle code (`needs a brutal-critique stage that loops back to the agent-manager stage <why> (fixed guardrail; run /ai-dlc:workflow upgrade to bring in the default AAWH and AAWP stages)`; `…when: must be "the change set contains docs" (case and spacing ignored), or be omitted so the stage runs on every change (fixed guardrail)`) |
| G5 | only when `lc.variant === "plugin"`: a `sqa-engineer` and a `code-reviewer` stage each loop back to an `agent-manager` stage; their `when` is omitted or `the change set contains code`; every `code-reviewer` stage lists the `sqa-engineer` stage in its own `after`; and a `software-architect` stage and a `system-engineer` stage exist that an `agent-manager` stage follows through `after` (transitively: `reaches(st, from, to)` walks `afterOf` back from the agent-manager stage) | the existing messages (lines 378, 388, 392) with the code in the path; new: `lifecycles.<code>: the plugin variant needs a <software-architect or system-engineer> stage that the agent-manager stage follows through after: design is part of the plugin variant (fixed guardrail)` |
| G7 | already enforced: `usedAgent` (workflow.mjs:240) reports a disabled agent at any stage, with a path that includes the lifecycle (`lifecycles.<code>.stages[<i>] (<id>).agent: "<agent>" is disabled in agents.disabled — reassign or remove`). No new code and no second message; ITEM-045 adds only the test that asserts the error names the agent and the lifecycle, for `product-owner` in each variant. | (existing message) |

The three existing blocks that implement G4/G5 are lifted unchanged into `guardVariant` (the `reviews` filter, the `when` check, the `after` check), with `AAW_REVIEWERS` entries picked by variant: harness checks `brutal-critique` only, plugin checks all three. The old "every starting stage must be agent-manager" (line 373) is deleted (G3).

`routing.handOff["agent-artifact work"]` stays `agent-manager` (line 361) unchanged.

### 2.3 `validate`: `lifecycles` and `handoffReview`

- `lifecycles.<code>.variant`: if present, a string in `VARIANTS`, else `variant must be "harness" or "plugin"`.
- `handoffReview` (new block after `review`):
  ```js
  unknownKeys(h, ["lifecycles", "maxRounds", "maxFailures"], "handoffReview");
  // no reviewer key: the reviewer is always brutal-critique (00c), which UNDISABLEABLE already protects
  lifecycles: a non-empty array of defined lifecycle codes, no duplicates
  checkLimits(h, "handoffReview", err);                        // maxRounds and maxFailures are optional (default 2 / 1, fileLimits); when present maxFailures < maxRounds, as every loop and clarify (spec D5; accepted deviation, the first LLD made them required)
  ```
  A `null` or missing `documents.critic` does not affect it (a null `documents.critic` only stops document critique, `aaw-review.md`).

### 2.4 `rounds` (D5)

- `ENV_VARS` stays keyed by agent. A second table keyed by row id: `const ROW_ENV = { "handoff-review": { maxRounds: "AI_DLC_HANDOFF_REVIEW_MAX_ROUNDS", maxFailures: "AI_DLC_HANDOFF_REVIEW_MAX_FAILURES" } }`.
- The `ENV` reading loop (line 623) iterates `[...Object.values(ENV_VARS), ...Object.values(ROW_ENV)]` so the new variables are read at the same levels with the same validity rule (`WHOLE`, min 1 for rounds, min 0 for failures).
- `loopLimits(agent, loop, id, vars = ENV_VARS[agent])` gains a fourth parameter; `loopLimits(null, h, "handoff-review", ROW_ENV["handoff-review"])` reads the row's variables and never `ENV_VARS["brutal-critique"]` (AC-19.5.2).
- `rounds(wf)` appends, after the `gate-critique` row, `{ id: "handoff-review", lifecycle: null, stage: null, agent: null, to: null, maxRounds…, … }` (same row shape). `show` prints `Handoff review: x<N> f<N>` in its summary line (line 505).
- `warnEnv` already walks `rounds(wf)`, so a variable pair that breaks `maxFailures < maxRounds` warns once and falls back to the file, as for every loop.

### 2.5 The `variant` command (D4)

```
node .ai-dlc/workflow.mjs variant [--json] [--exclude <path>]... <path>...
```

`--exclude` (repeatable; the paths `agent-manager` marked generated, row 1) is a new option; because `opt()` returns the first occurrence only, `variant` reads its excludes with a small `optAll("--exclude")` over `argv`. `VALUE_OPTS` gains `--exclude`. The command needs the workflow (for `routing.agentArtifact` and the list) and reads files only to tell their kind.

Pure functions:

```js
const norm = (p) => p.replace(/\\/g, "/").replace(/^\.\//, "")            // posix; the command receives repo-relative paths, and a path under --root is made relative with path.relative(ROOT, abs)
function globToRegExp(glob)                                                  // see below
const matchAny = (globs, p) => globs.some((g) => globToRegExp(g).test(p))
function kindOf(p, root)                                                     // "code" | "docs"
function areaOf(p, aa)                                                       // "plugin" | "harness" | "none"
function decideVariant(wf, paths, excluded, root)                            // { decision, lifecycle, reason, paths }
```

- **`globToRegExp`**: the file has no matcher today (the spec says it uses "the same minimal matcher as the rest of `workflow.mjs`"; there is none, so this adds one, no dependency). `**` matches any characters including `/`; `**/` at the start or after `/` matches zero or more directories; `*` matches any characters except `/`; `?` one character except `/`; every other character is literal (escaped). Anchored `^…$`, case-sensitive. Tests pin each form.
- **`kindOf(p, root)`**, in order (rows 2 to 4 of `aaw-review.md`):
  1. Planned file (does not exist): by name only. Code (deliberately conservative: a planned `settings.json` or `hooks.json` is always code, even if it later holds no command) when: extension in `{.mjs .js .cjs .ts .tsx .jsx .ps1 .sh .py .cs}`; or the basename is `hooks.json`, `settings.json`, `settings.local.json`, `.mcp.json` or `package.json`; or the path matches `.github/workflows/*` or `.github/hooks/*.json`; or the path matches `.claude/hooks/*`. Else docs.
  2. Existing file: code when the first line starts with `#!`; or the extension is in the script set; or (for `.json`) the parsed top level has any of `hooks`, `statusLine`, `apiKeyHelper`, `mcpServers`, or `scripts` (for `package.json`) and the value is a command or registers one (presence of the key decides, as row 3: "the whole file, even when most of it is data"); or a `.md`/`.mdc` file whose frontmatter has a `hooks` key; or the path matches the CI/hook-config globs above. Unreadable or non-JSON `.json` files fall back to the name rule of step 1. Else docs. Files are read, never run.
- **`areaOf(p, aa)`**: `plugin` when `matchAny(aa.pluginPaths, p)`, else `harness` when `matchAny(aa.harnessPaths, p)`, else `none`. A path in both lists is `plugin` (code safety first).
- **`decideVariant`** (pure): drop `excluded` paths (compared after `norm`). No paths given or none left (spec D4a): `{ decision: "ask", lifecycle: null, reason: "no paths" }`, exit 0 (not a usage error). Else for each remaining path compute `kind` and `area`. Then:
  1. any `kind === "code"` or `area === "plugin"`: decision `plugin`;
  2. else every path has `kind === "docs"` and `area === "harness"`: decision `harness`;
  3. else decision `ask`, reason `<path> is in neither folder list and is not code; the variant depends on the change` (the first such path; recommends `plugin` in the reason text, the orchestrator asks the human one question with that recommendation, AC-19.2.3).
  When the routing list has no `harness` lifecycle, a `harness` decision becomes `plugin` with reason `no harness variant is defined; every change set goes to the plugin variant` (spec D2).
  `lifecycle` is the code of the list's lifecycle whose `variant` equals the decision, else null.
- **Output.** Text mode prints one line: the code (`AAWP`), or `ask: <reason>`. `--json` prints `{ "data": { "lifecycle", "decision", "reason", "paths": [{ "path", "kind", "area" }] }, "error": null }`. A usage error (no `routing.agentArtifact`; an unknown option) prints `{ "data": null, "error": "<message>" }` with `--json` (or `error:` text without it) and exits 2; a decision, `ask` included, exits 0. Only this command uses the envelope.
- **D4b post-change check.** The orchestrator runs the same command after every `change` hand-back, on the paths `agent-manager` reported as changed minus its generated marks (`--exclude`). A result of `plugin` or `ask` for an AAWH run stops the run and the human decides; the recommended answer is to continue under AAWP from `test`. No new CLI surface. `aaw-review.md` *Rounds* and the orchestrator hard rule describe it (5.1, 5.2); change kinds (docs/code review routing) stay the rule of `aaw-review.md`.
- **Recording a switch.** When the human chooses AAWH to AAWP after a D4b stop: the run folder name stays (`AAWH-...`); the run state has no per-row lifecycle column (its *Stages* table is `Step | Stage | Owner | Mode | Status | Sessions | Agents | Handoff | Handback | Updated`), so the switch is shown in the existing `Stage` cell: the remaining rows read `<feature>: AAWP <stage id>` (for example `1: AAWP test`), new rows for `test` and `code-review` are added as `pending`, and the rows for `design` and `lld` are added as `skipped` with the reason `switched from AAWH, human decision` when the human continues from `test`; the front matter `lifecycle:` field of the run state stays `AAWH` (the run's start) and a `switched-to: AAWP` line is added to the run state's front matter (additive; readers ignore unknown keys); a *Gates and loops* row `variant switch: AAWH -> AAWP, <date>, decided by the human, reason: <variant output>` records it; earlier records keep their codes and `lifecycle: AAWH`, later records use `lifecycle: AAWP` in their own front matter. `handoff` *Run state* documents the row (5.3). The first record after the switch quotes the D4b output.
- The command runs `validate` first and refuses an invalid file (exit 1, like `rounds`, line 833).

### 2.6 `merge --migrate` (D9)

```js
function signatureOf(lc)                       // a string that ignores text, order of keys and limits' source
function migrateLegacyAAW(wf, tpl, lines)      // returns { changed: boolean }
```

- `signatureOf(lc)`: as in `LEGACY_AAW` below (sorted `after`, `loop.to`, no limits, no texts).
- **Shipped template version.** `LEGACY_AAW` (below) lists the shipped signatures; "equals a shipped template version" means `LEGACY_AAW.includes(signatureOf(wf.lifecycles.AAW))`. The list holds only single-AAW versions, so later changes to AAWH or AAWP never touch it.
- `migrateLegacyAAW`, run by `merge --migrate` **before** `merge` (so `merge`'s own validation sees the new routing):
  1. If `routing.byType["Agent Artifact"] !== "AAW"`: nothing to do (prints nothing).
  2. Set it to `clone(tpl.routing.byType["Agent Artifact"])` (`["AAWH","AAWP"]`). Line: `~ routing.byType["Agent Artifact"]: "AAW" -> ["AAWH","AAWP"]`.
  3. If `lifecycles.AAW` exists and its signature is shipped: delete it. Line: `~ lifecycles.AAW: removed (equals the shipped AAW; replaced by AAWH and AAWP)`. If it differs: keep it, and print `! lifecycles.AAW: kept, customised, and no longer routed; port its changes to AAWH or AAWP by hand`. If it is absent: no line.
- The lines are printed as `~` lines in `--dry-run` as well (the existing `+` lines follow). Without `--migrate`, `merge` on a legacy file prints `! legacy AAW routing: run merge --migrate (with the developer's consent) before merge` first and continues as today (the post-merge `validate` then reports the legacy error, AC-19.8.1).
- `merge` then adds `AAWH`, `AAWP`, `routing.agentArtifact` and `handoffReview` from the template (existing add logic, `lifecycles` missing codes are added, line 744). A kept customised `AAW` stays in the file.
- `diff` and `normalise` are unchanged.
- **`LEGACY_AAW`** (spec D9). The normalised stage signatures of the AAW lifecycles the plugin shipped: `stages.map((s, i) => [s.id, s.agent, [...afterOf(stages, i)].sort().join("+"), s.when ?? "", s.loop?.to ?? ""].join("|")).join(";")` (id, agent, sorted `after`, `when`, `loop.to`; limits and texts ignored). From `git log --follow -- plugins/claude/ai-dlc/skills/workflow/templates/workflow.json` (the last 40 commits, read on 2026-10-24, two distinct versions):
  1. `change|agent-manager|||;critique|brutal-critique|change|the change set contains docs|change;test|sqa-engineer|change|the change set contains code|change;code-review|code-reviewer|test|the change set contains code|change` (current);
  2. `change|agent-manager|||;critique|brutal-critique|change||change` (the earliest AAW, no `when`).
  The list above is a reading of the last 40 commits and is unverified for older history: the build derives the list again from the whole history with `git log --follow -p -- plugins/claude/ai-dlc/skills/workflow/templates/workflow.json`, and its hand-back quotes the command, the number of distinct signatures found and the commit that introduced each. A test per signature (below) pins the final list. A lifecycle whose signature is in the list is removed by `--migrate`; any other is kept, warned about and left unrouted. A project that only changed a limit or a text still matches and is removed, so its limits are lost; the `~` line says so (`removed; limits and texts are ignored in the match`).

## 3. `workflow.schema.json`

Fragments, to be applied with the current structure (the file has `byType`, `lifecycles.additionalProperties`, a top-level `properties`):

```json
"handoffReview": {
  "type": "object", "additionalProperties": false,
  "required": ["lifecycles"],
  "properties": {
    "lifecycles": { "type": "array", "items": { "type": "string" }, "minItems": 1, "description": "The lifecycles whose hand-offs are reviewed (default AAWH, AAWP)." },
    "maxRounds": { "type": "integer", "minimum": 1, "default": 2, "description": "…overridden by AI_DLC_HANDOFF_REVIEW_MAX_ROUNDS…" },
    "maxFailures": { "type": "integer", "minimum": 0, "default": 1, "description": "…AI_DLC_HANDOFF_REVIEW_MAX_FAILURES… Must be below maxRounds." }
  }
}
```
```json
"routing.properties.agentArtifact": { "type": "object", "additionalProperties": false, "required": ["harnessPaths", "pluginPaths"],
  "properties": { "harnessPaths": { "type": "array", "items": { "type": "string" } }, "pluginPaths": { "type": "array", "items": { "type": "string" } } } }
"routing.properties.byType.properties[\"Agent Artifact\"]": { "type": "array", "items": { "type": "string" }, "minItems": 1, "uniqueItems": true }
"routing.properties.byType.additionalProperties": { "type": "string" }        // unchanged; only the named key is a list
"lifecycles.additionalProperties.properties.variant": { "enum": ["harness", "plugin"] }
```

`byType.required` keeps `["Agent Artifact"]`. The long `byType` description (line 71) is rewritten to the two-variant rule. The schema description of `artifacts.handoffs` (the file-name grammar) gains `[.h{round}]` (see 5.3). The `when` description (line 258) names the AAWH/AAWP review stages. The root-level `required` list gains `handoffReview`. The `.ai-dlc/` copy stays byte-equal to the template (`handoff-naming.test.mjs` checks it).

## 4. `workflow.json` (template): routing, `handoffReview`, `AAWH`, `AAWP`

`lifecycles.AAW` is removed; the two lifecycles replace it (before `Release`). `routing.byType["Agent Artifact"]` is `["AAWH","AAWP"]`. Added top level (after `review`):

```json
"handoffReview": { "lifecycles": ["AAWH", "AAWP"], "maxRounds": 2, "maxFailures": 1 }
```
```json
"routing": { …, "agentArtifact": { "harnessPaths": [ …spec Data shapes… ], "pluginPaths": ["plugins/**", "tools/**", "tests/**"] } }
```

Shared `name`/`pickWhen`/`exitArtifact` texts are drafted by the build from the AAW text; the structure is fixed here.

### 4.1 `AAWH`

```json
"AAWH": { "name": "Agent Artifact Work, harness", "kind": "focused", "variant": "harness",
  "pickWhen": "…harness change: only docs under the harness folders (agents, skills, rules, commands, prompts, the workflow file, AGENTS.md)…", "exitArtifact": "…", "note": "…",
  "stages": [
    { "id": "intent", "agent": "product-owner", "after": [], "produces": ["The intent of the change and its scope, in writing"] },
    { "id": "change", "agent": "agent-manager", "after": ["intent"], "produces": ["The changed paths, each marked code or docs", "The intent of the change", "The checks run and their results"] },
    { "id": "docs", "agent": "documentation-writer", "skills": ["write-documentation"], "when": "the change set changes documentation", "after": ["change"], "produces": ["Updated READMEs or user guides, or no change"] },
    { "id": "critique", "agent": "brutal-critique", "when": "the change set contains docs", "after": ["change"], "produces": ["Critique of the docs in the change set with a PASS / REVISE verdict"],
      "loop": { "to": "change", "on": "A REVISE verdict, or Majors on a PASS: the critique goes back to agent-manager with the same changed paths and intent", "maxRounds": 2, "maxFailures": 1 } }
  ] }
```

### 4.2 `AAWP`

```json
"AAWP": { "name": "Agent Artifact Work, plugin / mod", "kind": "focused", "variant": "plugin", …,
  "stages": [
    { "id": "intent", "agent": "product-owner", "after": [], "produces": ["The intent of the change and its scope, in writing"] },
    { "id": "design", "agent": "software-architect", "skills": ["architecture-design"], "after": ["intent"], "produces": ["A short design and any ADR the change needs"] },
    { "id": "lld", "agent": "system-engineer", "skills": ["system-design"], "after": ["design"], "produces": ["The low-level design: modules, functions, test seams"],
      "loop": { "to": "design", "on": "A challenge to the design from the low-level design (Refine): the architect revises", "maxRounds": 2, "maxFailures": 1 } },
    { "id": "change", "agent": "agent-manager", "after": ["lld"], "produces": [ …as AAWH… ] },
    { "id": "test", "agent": "sqa-engineer", "when": "the change set contains code", "after": ["change"], "produces": ["Tests for the changed code", "The test run and its results"],
      "loop": { "to": "change", "on": "A test that fails because the code is wrong: the failure goes back to agent-manager", "maxRounds": 2, "maxFailures": 1 } },
    { "id": "code-review", "agent": "code-reviewer", "when": "the change set contains code", "after": ["test"], "produces": ["Severity-ranked findings on the code and its tests"],
      "loop": { "to": "change", "on": "A Blocker or Warning: the findings go back to agent-manager", "maxRounds": 2, "maxFailures": 1 } },
    { "id": "docs", … as AAWH, "after": ["change"] },
    { "id": "critique", … as AAWH, "after": ["change"] }
  ] }
```

Notes: the `lld` loop has no named reviewer verdict, so `lld` has no env variable (loop limits come from the file, like every non-reviewer loop). Align (`lld`↔`change`) is a clarify request (OQ1), so it has no stage loop and no JSON; the `clarify.matrix` already lists `agent-manager` asking `system-engineer` (`software-engineer` does today); the build checks the row and adds `agent-manager → system-engineer` and `agent-manager → software-architect` rows if absent (list in 8). The skills named must be in the catalog (`architecture-design`, `system-design`, `write-documentation` are plugin skills); the catalog check passes without regenerating.

## 5. Text changes (agent-manager's build; sections only)

### 5.1 `references/aaw-review.md`
Intro paragraph (variants), *Change kinds* (rows unchanged; add "applied before `variant`"), new section *Picking the variant* (the rule of 2.5 in prose, the command line, what `ask` does, the folder lists and where to change them), *Rounds* (both variants; step codes; AAWP planning codes), *Limits per step* (add the handoff-review variables and row), *Findings*, *What `validate` enforces* (G1 to G7, the legacy error).

### 5.2 `agents/orchestrator.md` and `tools/templates/AGENTS.template.md` (and the generated `skills/init/templates/AGENTS.md` by the build)
*Agent Artifact Routing (Hard Rule)*: both chains, no `software-engineer`, no checks run by the orchestrator, no SDLC chain, the "No PM consultation" line removed and `product-owner` named; *Run Loop* step 2 points to `aaw-review.md`; the exception list in *Delegate the work; check the agents' work* gains `node .ai-dlc/workflow.mjs variant`; a *Mode choice* paragraph (D7): team or subagents per request, both variants, ask when unsure, default subagents for a one-line AAWH change.

### 5.3 `skills/handoff/SKILL.md`
- *Naming*: add one sentence: the run folder code never changes after an AAWH to AAWP switch (D4b). Grammar becomes `{step}[.{sub}][.l{loop}[.{round}]][.{n}][.h{round}]-…`; define `.h<round>`; the AAW bullet shows AAWH and AAWP; AAWP planning `N.1.1` intent, `N.1.2` design, `N.1.3` LLD and `N.1.3.l1.<r>` for Refine; the folder-code examples `AAWH-…`, `AAWP-…`.
- *Who writes what*: table gains a **Verifies** column and the matrix of section 6; line 129's sentence ("the writer never verifies its own record") is restated as "the addressee verifies"; run-state text records a mode fallback.
- *Receiving a handoff* and *Hand-back record*: the addressee verification of a hand-back in team mode.

### 5.3a Fallback text (ITEM-051, AC-19.4.3)
`skills/request-routing/SKILL.md` *Mode 5 conditions*: the conditions of section 6 (`-p`, headless or Agent SDK, flag, no team or messaging tool, Copilot) apply to both variants. `skills/handoff/SKILL.md` *Run state*: the Stages table `mode` cell takes `subagent`, `team` or `subagent (fallback: <reason>)`; the fallback row is recorded in *Gates and loops*.

### 5.4 Other files
`skills/request-routing/SKILL.md` (pointer), `agents/agent-manager.md` (main-agent-without-orchestrator: AAWH in subagent mode only, writes the records, refuses an AAWP change set with the message `start the orchestrator: claude --agent ai-dlc:orchestrator`), `agents/brutal-critique.md` (the handoff-review duty: reviews each hand-off record, PASS/REVISE, own limits), `skills/workflow/SKILL.md` (*Mode: upgrade* gains step *Legacy AAW* before step 3, using `merge --migrate`; *Loop limits* gains the `handoff-review` row and variables), `skills/workflow/references/edit-recipes.md` (the AAW recipes for the two variants).

### 5.5 Every reader of `routing.byType["Agent Artifact"]` or the single AAW lifecycle

Found by `grep -rl "Agent Artifact"` over the repository (2026-10-24), excluding `docs/`, `plugins/copilot/` and `.scratch/`: `.ai-dlc/workflow.json`, `.ai-dlc/workflow.mjs`, `.ai-dlc/workflow.schema.json` (this repository's copies, changed by the upgrade, ITEM-047), `AGENTS.md` and `skills/init/templates/AGENTS.md` (generated from `tools/templates/AGENTS.template.md` plus `orchestrator.md`), `agents/orchestrator.md`, `skills/ai-dlc/SKILL.md` (the lifecycle catalogue: its AAW row becomes AAWH and AAWP), `skills/request-routing/SKILL.md`, `skills/workflow/references/aaw-review.md`, `skills/workflow/references/edit-recipes.md`, `skills/workflow/SKILL.md`, `skills/workflow/templates/workflow.{json,mjs,schema.json}` and `tests/workflow/workflow.test.mjs`. A search for the lifecycle code `AAW` as a word finds more (`tests/auto-handoff/*`, `tests/build-copilot-*`, `lens` folder-code readers, memory files); the build lists each hit and decides: a hit that only uses `AAW-…` run folder names in prose or fixtures stays (old runs keep their folders), a hit that parses the lifecycle value changes. The lens needs no change (folder code regex, spec).

## 6. Records, verification and fallback, per variant and mode (D6, D7)

Rule for every record (spec D6): the **addressee verifies** what is addressed to it. `brutal-critique` reviews each **handoff** before its receiver starts (`.h<round>` records), under `handoffReview` limits. Line 1 of a report is `handoff <file>: passed|failed — <why>`.

| Variant × mode | Handoff written by | BC review (`.h<r>`) | Handoff verified by | Hand-back written / stored by | Hand-back verified by | Run state |
|---|---|---|---|---|---|---|
| AAWH or AAWP, **subagent** | orchestrator, before the spawn | by BC, then the receiver starts on PASS | the receiver (line 1) | stored verbatim by the orchestrator | the orchestrator | orchestrator |
| AAWH or AAWP, **team** (both variants; AAWH roster PO, AM, DW, BC; AAWP adds SA, SE, SQA, CR) | the sending teammate | by BC (a teammate), then the receiver starts on PASS | the receiver (line 1) | written by the receiver to the sender; for `code-reviewer`, which has no Write, the sender stores it | **the sender** (the hand-back's addressee) | lead keeps it from reported record names |
| **Main agent `agent-manager` without an orchestrator** | agent-manager | BC reviews | the receiver | agent-manager stores | agent-manager | agent-manager; AAWH, subagent mode only; AAWP refused with the message in 5.4 |

**Fallback to subagent mode** (recorded in the run state, *Gates and loops*): `-p`, headless or Agent SDK session, missing `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`, no team or messaging tool in the session, GitHub Copilot. The fallback is decided once per run, at its start (spec D7). **Choosing:** the orchestrator decides per request and asks the human when unsure; one-line AAWH changes default to subagents. Team-mode AAWH needs `SendMessage` on the roster agents (feature root 29, already shipped).

## 7. AC to design to test

Tests use `node:test` and `node:assert` in `tests/workflow/` (`workflow.test.mjs`, `handoff-naming.test.mjs`), which run `workflow.mjs` on temporary workflow files built from the template. Test names begin with the AC id. `[DC]` rows are read by `brutal-critique` / the reviewer against the named section of 5.

| AC | Element | Test or check |
|---|---|---|
| AC-19.1.1 | template and this repository's file define both; `validate` exits 0 | `AC-19.1.1 the template validates with AAWH and AAWP` (`--plugin`); and a test that `.ai-dlc/workflow.json` of this repository validates (the existing "default workflow validates" pattern, run on that file) |
| AC-19.1.2 | section 4 stage lists | `AC-19.1.2 AAWH has exactly …, AAWP exactly …` (list the stage agents, assert the two sets) |
| AC-19.1.3 | G1 | `AC-19.1.3 a software-engineer stage in either variant fails and names the stage` (two cases) |
| AC-19.1.4 | G2 | `AC-19.1.4 a variant with no agent-manager stage fails` |
| AC-19.1.5 `[DC]` | 2.2 / 4 routing | aaw-review.md *Picking the variant* and the template's one routing key |
| AC-19.2.1 | `decideVariant` | `AC-19.2.1 harness docs only: AAWH` (CLI `variant` on `.claude/agents/x.md` plus `.claude/rules/y.md`) |
| AC-19.2.2 | code or pluginPaths | `AC-19.2.2 a plugin path, and a .claude/hooks/x.mjs script, give AAWP` (two cases) |
| AC-19.2.3 | `ask` | `AC-19.2.3 a path in neither list gives ask with a reason; --json uses the envelope and exit 0`; usage error: `exit 2, data null` |
| AC-19.2.4 `[DC]` | 5.1, 5.2, 5.4 | one place in aaw-review.md; the other two point |
| Variant signals | `kindOf`/`areaOf`/glob | one case per signal: planned path (`plugins/x/new.mjs`, `.claude/hooks/new.mjs` that do not exist), existing hook JSON with `hooks`, shebang file, generated path via `--exclude`, an empty change set, a path in both lists, no harness lifecycle (all to AAWP); `globToRegExp` table (`**`, `*`, `?`, literals) |
| AC-19.3.1 | G3 | `AC-19.3.1 a variant starting with product-owner validates; a starting stage of another agent fails` |
| AC-19.3.2 | G5 | `AC-19.3.2 the plugin variant without sqa-engineer or code-reviewer, or code-reviewer not after sqa-engineer, fails` (three cases); the existing removal tests (`:123-150`) become these |
| AC-19.3.3 | G4 | `AC-19.3.3 either variant without a brutal-critique stage fails` |
| Spec rev 2 guards | G5 design stages, G7 | `AC-19.3.2 the plugin variant without a software-architect or system-engineer stage the agent-manager stage follows fails` (three cases: no SA, no SE, SA not before AM); `AC-19.3.4 G7: disabling product-owner while a listed lifecycle has a product-owner stage fails and the message names the agent and the lifecycle; removing the stage makes it pass` (existing `usedAgent` message; test only) |
| D4a, D4b | `decideVariant` with no paths; post-change use | `AC-19.2.3 variant with no path prints ask, reason "no paths", exit 0`; `AC-19.2.3 (D4b) the reported paths of an AAWH run that include a .mjs file give plugin` (CLI, same test file); the orchestrator's stop-and-ask and the switch record are `[DC]` checks of `aaw-review.md`, `orchestrator.md` and `handoff` *Run state* |
| LEGACY_AAW | `signatureOf`, `migrateLegacyAAW` | `AC-19.8.2 both shipped AAW signatures migrate (removed); a lifecycle with an extra stage or a different loop target is kept, warned and unrouted; a changed limit still matches` |
| AC-19.3.4 | all | a passing and a failing case per guard G1 to G6 and per `variant` signal (the table above) |
| AC-19.4.1, 19.4.2, 19.4.3, 19.4.4, 19.4.5 `[DC]` | 5.2, 5.3, 5.4, 6 | the handoff and orchestrator sections of 5.2 to 5.4 against the matrix in section 6 |
| AC-19.5.1 | `rounds` row | `AC-19.5.1 rounds --json has a handoff-review row 2/1 distinct from gate-critique` |
| AC-19.5.2 | `ROW_ENV` | `AC-19.5.2 the handoff review variables change only its row` (settings `env` and process env; and `AI_DLC_CRITIQUE_*` does not move it) |
| AC-19.6.1 `[DC]` | 5.3 naming | *Naming* shows `N.1.1` to `N.1.3` and both variants |
| AC-19.6.2 | `handoff-naming.test.mjs` | `AC-19.6.2 a name for each of product-owner, software-architect, system-engineer (AAWP N.1.1-N.1.3) and a .h1 review record match the grammar` (the test asserts that the schema description contains the grammar string with `[.h{round}]`, and checks the example names against an explicit regex written in the test) |
| AC-19.7.1, 19.7.2 `[DC]` | 5.1, 5.2 | hard rule and aaw-review.md |
| AC-19.8.1 | legacy error | `AC-19.8.1 a file with routing AAW fails with the upgrade message and names AAW` |
| AC-19.8.2 | `merge --migrate` | `AC-19.8.2 migrate then merge validates and holds both variants` (fixtures: shipped AAW → removed; customised AAW → kept, warned, unrouted; `--dry-run` lists `~` lines and writes nothing; no consent flag → no migrate) |
| AC-19.9.1 `[BV]` | build | the hand-back of each item quotes the five commands |
| AC-19.9.2 `[DC]` | run state | each agent-manager spawn is for one item |
| OQ1 links | stage `after` / `loop` | `AC-19.1.2 the links: design after intent, lld loops to design, change after lld, test and code-review loops, code-review after test, critique loops to change` — a test over the template's `after` and `loop` fields (po-accepted trace, spec OQ1); the Align link is a clarify row test in `workflow.test.mjs` (`clarify.matrix["agent-manager"]` contains `system-engineer`) |

**Existing tests that change** (`workflow.test.mjs`): every test that names the `AAW` lifecycle: `:123-150` (removing review stages: now per variant), `:181` (starting stage), `:189-210` (routing cases), `:227` (disabling guardrails keep), `:370-387` (`show AAW`, `show AAW --mermaid` become AAWH/AAWP; three loop-back edges become the per-variant edges); `handoff-naming.test.mjs`: the key list check (`includes("AAW")` becomes AAWH and AAWP), the AAW note test (`wf.lifecycles.AAW.note` becomes both notes), and the file-name pattern assertion (the new grammar string). Build counts the occurrences with `grep -c AAW`.

## 8. Tasks for `pm` (one per ITEM; WF order; atomic validator and template)

**The repository must validate at the end of every item.** A validator that rejects the string `"AAW"`, requires a list under `Agent Artifact` and requires `handoffReview` cannot land before the template and this repository's `.ai-dlc/` copies carry `AAWH`, `AAWP`, `routing.agentArtifact` and `handoffReview`, because `workflow.test.mjs:40` and `:47`, `validate` on this repository and the Stop gate all read them. So ITEM-045, 050, 046 and 047 form one **atomic unit WF-1**: one branch, built by one freshly spawned agent-manager in the sub-task order below, merged once, with the full set of D10 checks quoted at the end of the unit (template validates, suite passes). The ITEM ids stay for traceability and AC mapping; `pm` may list them as sub-tasks 045.a to 045.d of one task.

| Sub-task (ITEM) | Scope | Files |
|---|---|---|
| WF-1.a (045) | G1 to G6, list-valued key, `variant` field, legacy error, schema fragments, guard tests | 2.1, 2.2, 2.3 (variant), 3 |
| WF-1.b (050) | `handoffReview` key and validation, `ROW_ENV`, `rounds` row, schema, tests AC-19.5.x | 2.3, 2.4, 3 |
| WF-1.c (046, 047) | template `AAWH`, `AAWP`, routing list, `routing.agentArtifact`, `handoffReview`, clarify rows, `aaw-review.md` rounds and limits, this repository's `.ai-dlc/` copies, naming test | 4, 5.1 (rounds, limits) |

Then, each valid at its own end (none changes what the validator rejects):

| Item | Scope | Files | Depends on |
|---|---|---|---|
| ITEM-048 | `variant` command, `globToRegExp`, D4a and D4b, orchestrator and request-routing text, the mode choice, tests AC-19.2.x | 2.5, 5.1, 5.2, 5.4 | WF-1 |
| ITEM-051 | `merge --migrate`, `LEGACY_AAW`, the *Legacy AAW* upgrade step, the fallback text (5.3a), consumer upgrade tests | 2.6, 5.3a, 5.4 | WF-1 |
| ITEM-049 | `handoff` skill (naming, who verifies, matrix), `agent-manager` and `brutal-critique` text, naming test | 5.3, 5.4, 6 | WF-1 (the naming test reads the schema) |

Merge group WF (the `workflow` skill's files): **WF-1 → 048 → 051**, then root 18's 037 and 038 (spec 18, which follow root 19 in the same group). The spec's D10 lists 045 → 050 → 046 → 047 → 037 → 038 and omits 048 and 051, which also edit the skill.

## 9. Questions for `sa` (Refine)

1. **`--exclude` option.** The spec says generated paths are "left out before the rule runs" but gives the CLI no way to receive them. This LLD adds a repeatable `--exclude <path>`; confirm, or say how else the orchestrator passes `agent-manager`'s marks.
2. **No glob matcher exists** in `workflow.mjs` (the spec says it reuses one). This LLD adds `globToRegExp` (about 15 lines, no dependency). Confirm.
3. **WF group.** 045, 050, 046 and 047 are one atomic unit (the repository must validate after every item, bc round 1 Blocker); 048 and 051 follow it. Confirm the unit, and that root 18's 037/038 follow 051.
4. **`handoffReview` is required** in `TOP` (every consumer file needs it; `merge` adds it). Confirm that a missing key is an error rather than a defaulted warning.
5. **Customised AAW detection** follows spec D9 (id, agent, sorted `after`, `when`, `loop.to`): a project that only changed a limit or reworded a note counts as shipped and is removed with its limits. The `~` line says so. Confirm that losing a customised limit on removal is acceptable.
6. **`clarify.matrix` rows** for `agent-manager` → `system-engineer` and → `software-architect` (the Align link) are not in the spec's data shapes. The LLD adds them in 4.2; confirm they belong to root 19.

7. **AAWP `docs` and `critique` stages** are `after: ["change"]` in this LLD, in parallel with `test` and `code-review`, as `aaw-review.md` runs a mixed change set today (the docs path and the code path in parallel) and as the OQ1 trace has the critique loop to `change`. Spec D1 says "Then `docs` ∥ `critique`" after `code-review`. Please align the spec to the parallel form (a docs critique may start before a failing test sends the change back, which is today's behaviour), or tell me to make them follow `code-review`.
8. The spec's G7 is already enforced by `usedAgent`; the LLD adds a test only.

## 10. Risks

- The `validate` AAW block is replaced, so every existing AAW test changes (section 7). That is mechanical, one pass, in ITEM-045.
- `kindOf` for existing JSON uses presence of keys, as row 3 does ("the whole file"); a settings file without any command key is `docs` by row 4, which the tests pin.
- `LEGACY_AAW` must grow whenever a later plugin changes the shipped AAW lifecycles again; the `workflow` skill's maintenance note carries this duty (5.4).
