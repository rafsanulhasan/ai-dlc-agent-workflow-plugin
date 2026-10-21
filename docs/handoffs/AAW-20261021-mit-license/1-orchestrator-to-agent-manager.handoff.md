---
run: AAW-20261021-mit-license
work-item: WI-1
lifecycle: AAW
step: 1
from: orchestrator
to: agent-manager
mode: subagent
loop: none
gate: none
verification: pending
date: 2026-10-21
---

# 1 orchestrator → agent-manager: add the MIT license and ship it with the ai-dlc plugin

## Goal
The repository and the `ai-dlc` plugin have no license. Add MIT so both can be shipped and used in target repos.

## Artifacts
- Research verified that no root `LICENSE` exists. The only LICENSE files are `plugins/claude-mods/cache-keepalive/LICENSE` (MIT, RichardJSun) and `plugins/claude-mods/auto-handoff/LICENSE` (MIT, Alex Hillman).
- `plugins/claude/ai-dlc/.claude-plugin/plugin.json`: no `license` field. The author is Rafsanul Hasan (lines 6-8).
- `.claude-plugin/marketplace.json:11-16` (the ai-dlc entry): no `license`. The mod entries already have `"license": "MIT"` (:22, :29).
- `.github/plugin/marketplace.json:9-17`: no `license` anywhere.
- `tools/build-copilot.mjs:131-142`: builds the Copilot manifest from a fixed field list (name, description, version, author, homepage, repository, keywords, agents, skills, hooks), without `license`. The build copies only skills/, scripts/, overlays and generated files (:282, :299, :308), never a root file of the plugin.
- `README.md:73`: mentions MIT only for the mods. There is no License section.
- Working tree: the mods vendoring left uncommitted changes. `plugins/claude-mods/` is untracked; marketplace.json, settings.json, validate.yml, CLAUDE.md, README.md, THIRD_PARTY_NOTICES.md and plugin.json are modified. Keep them; do not revert them.

## Acceptance criteria covered
| AC | Where it is satisfied / tested |
|---|---|
| AC-1 Root `LICENSE` with the standard MIT text and `Copyright (c) 2026 Rafsanul Hasan` | `LICENSE` |
| AC-2 `"license": "MIT"` in the ai-dlc `plugin.json` and in the ai-dlc entries of both marketplace files | manifests |
| AC-3 The build projects `license` into `plugins/copilot/ai-dlc/plugin.json` | `tools/build-copilot.mjs` |
| AC-4 Both shipped plugins carry a LICENSE: `plugins/claude/ai-dlc/LICENSE` and the generated `plugins/copilot/ai-dlc/LICENSE`. The build copies it, and `--check` fails when a copy drifts from the root `LICENSE`. An equivalent single-source design is fine; say why you chose it | build + test |
| AC-5 A test in `tests/` covers the new build behaviour; `node --test "tests/**/*.test.mjs"` passes | `tests/` |
| AC-6 `node tools/build-copilot.mjs --check` and both `plugin validate --strict` commands pass. `skills/plugin-management/templates/build-copilot.mjs`, a generated copy, is regenerated | commands |
| AC-7 `skills/plugin-management/SKILL.md` documents the license copy. `README.md` gets a short License section that links `LICENSE` and keeps the mods' MIT note and the `THIRD_PARTY_NOTICES.md` link | docs |
| AC-8 The mods' LICENSE, VENDORED.md and THIRD_PARTY_NOTICES.md entries are unchanged | diff |

## Gate evidence
- Build: n/a (before change) · Tests: n/a · Mutation: n/a (none for this stack) · Review: n/a · Gate: none (AAW)

## Decisions so far
- Copyright holder: Rafsanul Hasan, 2026 (decided by the human, 2026-10-21).
- A separate run, `AAW-20261021-absorb-auto-handoff`, will later move the auto-handoff mod into ai-dlc. Do not touch the mods in this run.

## Clarifications carried forward
| # | Asked → answered by | Refers to | Question | Answer | Artifact revised by owner |
|---|---|---|---|---|---|
| 1 | orchestrator → human | LICENSE | Copyright holder? | Rafsanul Hasan, 2026 | — |

## Open questions / risks for the receiver
- Check that `plugin validate --strict` accepts `license` in plugin.json and in the marketplace entries. The mod entries already pass CI with it.

## Suggested skills
- `plugin-management`: the repo layout, the build and the generated copies
- `skill-management`: the writing guide for the SKILL.md and README edits

## Instructions for the receiver
Make the changes in the ACs, then run the build, `--check`, both validations and the tests. Return a compressed report:
- Line 1: the verification line for this record.
- **Changed paths**: each marked `code`, `docs` or `generated`.
- **Intent**.
- **Checks**: each command with its real result.

Next hop: the orchestrator re-runs the checks. brutal-critique then reviews the docs, and sqa-engineer → code-reviewer review the build change.
