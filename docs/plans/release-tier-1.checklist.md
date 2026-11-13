---
work-item: FEAT-20261020-ai-dlc-lens
kind: release-gate-checklist
scope: scope v2 tier 1 (G4 approved with open conditions, record 66)
author: product-manager
date: 2026-11-13
step: 69 (brief `docs/handoffs/FEAT-20261020-ai-dlc-lens/69-orchestrator-to-product-manager.handoff.md`)
decides: product-owner (go / no-go), then human at the release gate
status: draft; no version, tag, branch or backlog status changed, nothing committed
---

# Release-gate checklist: tier 1 of the ai-dlc-lens run

## 1. What is released today (read from the repository, 2026-11-13)

| Fact | Value | Source |
|---|---|---|
| `ai-dlc` version (Claude manifest) | `1.0.0-preview1` | `plugins/claude/ai-dlc/.claude-plugin/plugin.json:4`; same on `main` |
| `ai-dlc` version (Copilot manifest, generated) | `1.0.0-preview1` | `plugins/copilot/ai-dlc/plugin.json`; `.github/plugin/marketplace.json:14` |
| `ai-dlc-lens` version | `0.1.0` | `plugins/claude/ai-dlc-lens/.claude-plugin/plugin.json:4`; same on `main` |
| Claude marketplace entries | `ai-dlc` and `ai-dlc-lens`, no `version` key (version lives in each plugin manifest) | `.claude-plugin/marketplace.json` |
| Git tags | **none** (`git tag -l` empty) | git |
| GitHub Releases | **none** (`gh release list` empty) | gh |
| Changelog / release notes file | **none** in the repository | `ls` |
| Publish / release workflow | **none**: the only workflow is `.github/workflows/validate.yml` (validation, runs on push) | `.github/workflows/` |
| `main` | at `fe7ec7c`, the merge of PR #24; PRs #21-#25 merged 2026-10-22 | git, gh |
| `feat/ai-dlc-lens` | at `eb5edb5`, pushed; 85 commits ahead of `main`, 758 files, +55184 / -1380 | git |
| Branch protection on `main` | none (API 404) | gh |
| Version scheme | 1.0.0-preview2 -> 1.0.0 -> 1.0.1 -> 1.1.0 -> 2.0.0, bump at each release in the manifests | user memory `project_version-scheme` (2026-10-14) |

Consequence: nothing has ever been tagged or released. `1.0.0-preview1` is the version string on `main` since PRs #21-#25, but no release exists under it.

## 2. Release scope

Plugins in the release:
- `ai-dlc` (Claude, plus the generated Copilot plugin): keep-alive and auto-handoff changes of roots 16 and 17 (session numbering, per-TTL cache state, per-track reason, ping counter, explanation docs, handoff-chain state), the AAW and workflow work already on the branch, and the 2.1.323 compatibility fixes (ITEM-112, ITEM-113).
- `ai-dlc-lens` (Claude only): the one "AI-DLC Lens" view, band rules, tier-1 lens items 068-077, notices (ITEM-056).

In scope, Done (G4 record 66): 26 plan rows (030, 031, 032, 033, 034, 034.c, 035, 036, 045, 046, 047, 050, 052, 053.a-c, 056, 068, 069-074, 076, 077 and the 058 umbrella) plus step-44 items 092-097, 107, 112, 113.

Carried, not in this release (19 rows, each with a recorded decision): 034.a, 054, 055, 075 (sprint 2); 034.b, 037-043, 044.a, 044.b, 065, 066, 048, 049, 051 (next sprint not set). Follow-ups ITEM-111, 114-119 (Backlog, P3) stay out.

In scope but open: ITEM-098 (live checks), ITEM-104 (In Progress until manual check M35).

Milestone label: the backlog marks the lens items `1.0.0-preview1` (`backlog.md:25, 55, 243, 260`); ITEM-112 and ITEM-113 are `Unplanned`. Retag after the version decision (open question Q1).

## 3. Proposed versions

| Plugin | Today | Proposed | Reason |
|---|---|---|---|
| `ai-dlc` | `1.0.0-preview1` | **`1.0.0-preview1` (no bump), first release, tagged as a prerelease** | The scheme bumps at each release, and preview1 has never been released: no tag, no GitHub Release. The backlog already milestones this scope `1.0.0-preview1`. `1.0.0-preview2` is the name of the separate planning run (branch `plan/preview2`, intent 001); using it here would collide. |
| `ai-dlc` Copilot plugin | `1.0.0-preview1` | `1.0.0-preview1` | Generated from the Claude plugin by `node tools/build-copilot.mjs`; the two always match. |
| `ai-dlc-lens` | `0.1.0` | **`0.1.0` (no bump), first release** | Never released; the plugin is still behind its run's gates (`CLAUDE.md`), and tier 1 is its first shipped build. |

Risk of "no bump": Claude Code plugin updates are keyed on `version`. Anyone who installed from `main` after 2026-10-22 holds `1.0.0-preview1` and would not see this build as an update (their installed copy differs from the released one). Alternative: bump `ai-dlc` to `1.0.0-preview2` now and rename the planning run's target. See Q1.

Tag and Release scheme: one repository tag per release train, `v1.0.0-preview1`, a GitHub prerelease whose notes list both plugins (`ai-dlc` 1.0.0-preview1, `ai-dlc-lens` 0.1.0). Per-plugin tags are the alternative (Q2).

## 4. Deploy steps (devops-engineer, after go and the human's approval)

No step needs GitHub Actions: there is no publish workflow, and `main` has no branch protection or required checks. Distribution is the marketplaces served from the repository (`.claude-plugin/marketplace.json`, `.github/plugin/marketplace.json`), so a merge to `main` is what publishes.

1. Documentation-writer writes release notes from the scope in section 2 (a *Docs update* request is in this report); critic pass first. No changelog file exists today; documentation-writer decides whether the notes live in the GitHub Release only or also in a `CHANGELOG.md`.
2. Version decision applied: if the human picks no bump, no manifest changes; if a bump, edit the manifests (`plugin.json` of `ai-dlc`, `.github/plugin/marketplace.json`) and run `node tools/build-copilot.mjs` and `--check`.
3. Pre-merge checks, run locally by the owning agent (CI is unavailable): `node tools/build-copilot.mjs --check`, `node .claude/scripts/sync-harness.mjs --check`, `node tools/validate.mjs` (both `plugin validate --strict` and the lens one), `node --test "tests/**/*.test.mjs"`, `plugin test` for both plugins. Last recorded: 1007/0 and 926/0 on Claude Code 2.1.323 and 2.1.322; repository tests 1263 pass / 0 fail / 7 skipped on Node 24 (record 66).
4. Merge `feat/ai-dlc-lens` into `main` through a pull request (previous trains used PRs #21-#25). `.ai-dlc/model-metadata.json` is modified and unstaged in the working tree; leave it out (it is hook-managed).
5. Tag `v1.0.0-preview1` on the merge commit on `main`; create the GitHub prerelease with the release notes (`gh release create`, not an Actions workflow).
6. Backlog: documentation-writer's marker pass is already done (step 67); product-manager moves the included items to Done with the release date and re-milestones.
7. Do not delete `feat/ai-dlc-lens` or the stale worktrees as part of the release.

## 5. Checklist

Marks: met, not met, waived (a human decision waives it; none is waived yet).

| # | Item | Mark | Evidence |
|---|---|---|---|
| 1 | Every in-scope item is Done or explicitly carried | **not met** | 26 + 8 Done; 19 carried with decisions; ITEM-098 and ITEM-104 open (record 66). Carried is explicit; the two open items need a decision (Q3). |
| 2 | No open P0 item for the milestone | met | P0 items 112 and 113 are Done; no other P0 is open (backlog scan). |
| 3 | Test command passed in the last build | met (not re-run for this document) | Repository tests 1263 pass / 0 fail / 7 skipped, Node 24 (record 63.3). |
| 4 | Plugin tests, both plugins | met (not re-run) | 1007 / 0 and 926 / 0 on Claude Code 2.1.323 and 2.1.322 (63.3). |
| 5 | `plugin validate --strict`, both plugins and marketplace | met (not re-run) | Exit 0 on 2.1.323 and 2.1.322 (63.2, 63.3). |
| 6 | Copilot plugin up to date; harness twins in sync | met | `build-copilot --check` and `sync-harness --check` exit 0 (68, at `eb5edb5`). |
| 7 | G4 approved | met, with conditions | Record 66, approved 2026-11-13 with the open conditions below. |
| 8 | Reviews at zero Blockers | met | 0 Blockers in every recorded round (record 66). |
| 9 | CI green on the release commit | **not met** | Actions refuses every job ("account is locked due to a billing issue"); the last three runs failed in 3-4 s (43467848658, 43468788647, 43470021639). Not a code failure. |
| 10 | Node 22 repository-test run (ITEM-113 open AC) | **not met** | Needs Actions or a local Node 22. |
| 11 | ITEM-098 live checks | **not met** | Human to run in Claude Code. |
| 12 | ITEM-104 manual check M35 | **not met** | Human to run. |
| 13 | Live two-plugin band check on 2.1.323 (keep-alive MANUAL-CHECKS P9-P11, lens O15) | **not met** | `plugin test` loads one plugin; composed bands unverified live. |
| 14 | ITEM-056 "Not verified" notice items | **not met** (disclosed) | safer-bytes 0.2.0 repository, compiled-in serde 1.x version, GWT code in minified elkjs, transitive crates; marked so in the shipped notice. |
| 15 | Manual-check result cells recorded (`MANUAL-CHECKS.md` P1, P2) | **not met** | Cells empty (`hooks/keepalive/MANUAL-CHECKS.md:19, :32`); results sit in the run state only. |
| 16 | Version proposed and decided | **not met** | Awaiting Q1. |
| 17 | Release notes written | **not met** | documentation-writer step pending. |
| 18 | Docs status markers match the run state | met | Marker pass done, step 67 (`809a144`). |
| 19 | Merge route clear | met | `main` unprotected; no required checks. |
| 20 | Housekeeping: `.scratch/sqa-63/n22/` (unrun node.exe) deleted | **not met**, not a gate | Agent delete was refused; human to delete. |

Counts: **met 9** (2, 3, 4, 5, 6, 7, 8, 18, 19), **not met 11** (1, 9-17, 20), **waived 0**. Items 3-5 are met from recorded output, not re-run here.

## 6. Blockers and what each blocks

| Blocker | Blocks | Clears when |
|---|---|---|
| GitHub Actions locked over billing | Items 9 and 10 only: CI evidence and the Node 22 run. It does not block merge, tag or Release, because `main` is unprotected and the release uses `gh`, not a workflow. | Human fixes the billing issue; or the human waives 9 and 10, or someone runs Node 22 locally. |
| Version decision (Q1) | Items 16 and the tag name. | Human or product-owner answers Q1. |
| Manual checks 098, M35, P9-P11 / O15 | Confidence, not mechanics: the live two-plugin band behaviour and two item closures. | Human runs them later (stated plan), or waives for a prerelease. |
| Release notes | Step 5 (the GitHub Release body). | documentation-writer pass. |

Open P0 for the milestone: none.

## 7. Open questions

- **Q1 (product-owner, human): version.** Recommend no bump, first prerelease `ai-dlc` `1.0.0-preview1` and `ai-dlc-lens` `0.1.0`, because nothing was ever released and the backlog milestone says preview1; keep `1.0.0-preview2` for the planning run's intent. Alternative: bump to preview2 so that installs from `main` update.
- **Q2 (human): tag scheme.** Recommend one repository prerelease `v1.0.0-preview1` listing both plugins; per-plugin tags (`ai-dlc-v...`, `ai-dlc-lens-v...`) only if the plugins will ship on separate cadences.
- **Q3 (product-owner): go / no-go with open conditions.** Recommend **go as a prerelease**, with 9, 10-14 and 15 waived by the human for preview, because: it is labelled preview, the open items are live or manual confirmations, not known failures, the notice discloses the unverified items, and Actions blocks only CI evidence. If the human wants a stricter bar, make item 13 (live two-plugin band check) the single no-go condition: it is the only one that could change how the shipped product behaves for a user running both plugins.
- **Q4 (human): ITEM-098 and ITEM-104.** Recommend list them in the release notes as "known open, manual verification pending", keep them In Progress, and move them to the next milestone rather than hold the release.
- **Q5 (human): merge before or after the manual checks.** Recommend merge and tag after the human has run P9-P11 / O15 if that is days, not weeks, since the human said they will run the checks later; otherwise release first and mark the prerelease accordingly. Either way nothing is merged until the human approves at the release gate.
- **Q6 (documentation-writer): changelog location.** Recommend GitHub Release body plus a `CHANGELOG.md` seeded from it, since the repository has none.

## 8. Docs update request (for documentation-writer)

- Documents: release notes for `v1.0.0-preview1` (GitHub Release body; optionally new `CHANGELOG.md`).
- Status: release notes say what ships; items carried or open are listed as not included.
- What changed: sections 2 and 3 above; evidence in `docs/plans/tier-1-g4-checklist.md` and `66-orchestrator-to-human.handoff.md`.
