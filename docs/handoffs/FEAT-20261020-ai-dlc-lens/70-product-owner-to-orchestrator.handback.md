---
run: FEAT-20261020-ai-dlc-lens
work-item: FEAT-20261020-ai-dlc-lens (scope v2), tier 1
lifecycle: Release (segment of AI-DLC)
step: 70
from: product-owner
to: orchestrator
mode: subagent
loop: none
received: 2026-11-13
---

handoff 70-orchestrator-to-product-owner.handoff.md: passed — the brief and `docs/plans/release-tier-1.checklist.md` were both read in full. Nothing was changed or committed. I loaded `ai-dlc:product-planning` but did not run a backlog review, so item counts rest on the checklist.

## Product Owner: tier 1 of ai-dlc-lens

**Decision: GO, as a prerelease, with conditions.** The human confirms the waivers below at the release gate.

### Why go
- No P0 is open. Items 112 and 113 are Done.
- G4 is approved with 0 Blockers in every recorded round.
- Everything still open is a live or manual confirmation or a disclosed gap. None is a known failure.
- The release is labelled preview, and the shipped notice already discloses the unverified third-party items.
- The billing lock on Actions removes only CI evidence. It does not block merge, tag or Release, because `main` is unprotected and the release uses `gh`.

### Waivers
I treat these as waived. The waiver is the human's to confirm at the release gate.

| Checklist item | Waived | Condition |
|---|---|---|
| 9. CI green on the release commit | Yes | Substitute: the local checks listed under "Must exist before deploy" must pass on the actual release commit. |
| 10. Node 22 repository-test run (ITEM-113 open AC) | Yes | Carry into the next milestone. Run it when billing is cleared or locally. State it in the release notes. |
| 11. ITEM-098 live checks | Yes | The human runs them later. Listed in the notes as known open. |
| 12. ITEM-104 manual check M35 | Yes | The human runs it later. Listed in the notes as known open. ITEM-104 stays In Progress. |
| 13. Live two-plugin band check (P9-P11, O15) | Yes | This is the riskiest waiver, because it is the only open item that could change behaviour for a user running both plugins. The release notes must say that running both plugins together is unverified. |
| 14. ITEM-056 "Not verified" notice items | Yes | Already disclosed in the shipped notice. |
| 1. All in-scope items Done or carried | Partly | Waived only for ITEM-098 and ITEM-104. Everything else is already carried explicitly. |
| 15. `MANUAL-CHECKS.md` P1 and P2 result cells | **Not waived** | Recording them is cheap and they only exist in the run state today. See "Must exist before deploy". |
| 20. `.scratch/sqa-63/n22/` housekeeping | Not a gate | The human deletes it. It does not block. |

Items 16 (version) and 17 (release notes) are not waivers. They are deliverables that must exist before deploy.

### Answers to my open questions
- **Q1, version (mine, with the human): no bump.** Release `ai-dlc` `1.0.0-preview1` and `ai-dlc-lens` `0.1.0`.
  - Reason: the memory scheme is "preview1 unreleased; bump at each release", and nothing was ever tagged, so this release is preview1. The backlog already milestones the scope `1.0.0-preview1`.
  - `1.0.0-preview2` stays reserved for the separate planning run on `plan/preview2`.
  - Risk the human should weigh: Claude Code updates are keyed on `version`. Anyone who installed from `main` after 2026-10-22 already holds `1.0.0-preview1` and will not see this build as an update. If that matters, the alternative is to bump `ai-dlc` to `1.0.0-preview2` and rename the planning run's target. I do not recommend it, but it is the human's decision.
  - The backlog milestones for items 112 and 113 (`Unplanned`) need retagging to `1.0.0-preview1`.
- **Q3, go / no-go: go**, as above.
  - If the human wants a stricter bar, the single no-go condition is item 13, the live two-plugin band check.

### Recommendations for the human's questions
- **Q2, tag scheme:** one repository tag, `v1.0.0-preview1`, as a GitHub prerelease whose notes list both plugins. Use per-plugin tags only if the plugins will ship on separate cadences, and nothing says they will.
- **Q4, ITEM-098 and ITEM-104:** list them in the release notes as "known open, manual verification pending". Keep both In Progress and move them to the next milestone rather than holding the release.
- **Q5, timing:** the human has already chosen to start without the manual checks, and I honour that. The only caveat is that merging to `main` is what publishes, so users get the build immediately. If the checks are days away, run P9-P11 and O15 before the merge, since they are cheap and cover the one real behaviour risk. If they are weeks away, merge now, keep the prerelease label, and put the known-unverified wording in the notes. In both cases nothing is merged until the human approves at the release gate.
- **Q6, changelog:** agree with the PM. Put the release notes in the GitHub Release body and seed a new `CHANGELOG.md` from them.

### Must exist before deploy
1. **Release notes** for `v1.0.0-preview1`, written by `documentation-writer` and critiqued by `brutal-critique` (PASS) before use. They must contain:
   - Both plugins and their versions, and the in-scope items.
   - The 19 carried items listed as not included.
   - Known open items: ITEM-098, ITEM-104, the two-plugin band check, the Node 22 run, and the disclosed unverified notice items.
   - A statement that CI could not run (Actions billing lock) and that local checks were used instead.
2. **Local pre-merge checks on the final release commit.** Because CI is unavailable, the owning agents must re-run and quote real output for:
   - `node tools/build-copilot.mjs --check`
   - `node .claude/scripts/sync-harness.mjs --check`
   - `node tools/validate.mjs`
   - `node --test "tests/**/*.test.mjs"`
   - `plugin test` for both plugins

   Checklist items 3-5 were met only from earlier recorded output, so these re-runs replace waived item 9.
3. **Item 15.** The P1 and P2 manual-check results recorded in `hooks/keepalive/MANUAL-CHECKS.md`, through `agent-manager`. If the human declines, move item 15 to waived and carry it.
4. **Version decision (Q1) confirmed** by the human. With no bump, no manifest edits are needed.
5. **Human approval at the release gate** of this go decision and the waiver list.
6. **Merge hygiene:**
   - Leave the unstaged, hook-managed `.ai-dlc/model-metadata.json` out of the merge.
   - Do not delete `feat/ai-dlc-lens` or the stale worktrees.
7. **After deploy:** `product-manager` moves the included items to Done with the release date and re-milestones them. ITEM-098 and ITEM-104 stay open, and the Node 22 run is tracked in the next milestone.

### Questions for the human (via the orchestrator)
- Confirm the waivers for items 9, 10, 11, 12, 13, 14 and the partial waiver of 1.
- Confirm no version bump, given that installs from `main` since 2026-10-22 will not see this build as an update.
- Do you want item 15 recorded before merge or waived?
- Do you run P9-P11 and O15 before the merge or after it?

I wrote no files and made no commits, version or tag changes.
