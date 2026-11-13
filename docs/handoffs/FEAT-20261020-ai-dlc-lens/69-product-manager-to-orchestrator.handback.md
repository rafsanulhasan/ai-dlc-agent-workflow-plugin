---
run: FEAT-20261020-ai-dlc-lens
work-item: FEAT-20261020-ai-dlc-lens (scope v2), tier 1
lifecycle: Release (segment of AI-DLC)
step: 69
from: product-manager
to: orchestrator
mode: subagent
loop: none
received: 2026-11-13
---

handoff 69-orchestrator-to-product-manager.handoff.md: passed — brief read and facts re-checked against the repository; checklist written, nothing committed or changed.

File: E:\Projects\personal\ai-dlc-agent-workflow-plugin\docs\plans\release-tier-1.checklist.md

Facts read, not assumed:
- ai-dlc is 1.0.0-preview1 in the Claude manifest, the Copilot manifest and the Copilot marketplace entry.
- ai-dlc-lens is 0.1.0.
- No git tags, no GitHub Releases, no changelog file.
- No publish workflow exists. validate.yml is the only workflow.
- main (fe7ec7c) already carries those versions from PRs #21-#25 (2026-10-22), and it has no branch protection.
- feat/ai-dlc-lens is 85 commits and 758 files ahead of main.

Proposed versions:
- ai-dlc: 1.0.0-preview1, no bump. It was never released, and the backlog milestone already says preview1.
- Copilot plugin: 1.0.0-preview1, generated, so it always matches.
- ai-dlc-lens: 0.1.0, no bump, first release.
- One prerelease tag, v1.0.0-preview1, listing both plugins.
- Risk: anyone who installed preview1 from main will not see this build as an update, because updates are keyed on version.

Checklist: 9 met, 11 not met, 0 waived. Three of the met items (test, plugin test, validate) come from recorded output and were not re-run. No P0 is open.

The not-met items:
- CI green and the Node 22 run (both Actions).
- ITEM-098.
- ITEM-104 (M35).
- The live two-plugin band check (P9-P11 / O15).
- The ITEM-056 "not verified" disclosures.
- The empty MANUAL-CHECKS result cells.
- The version decision.
- Release notes.
- Item-scope completeness (098 and 104 are open).
- The housekeeping deletion of `.scratch/sqa-63/n22/`.

What the Actions lock blocks: only CI evidence and the Node 22 run. It does not block merge, tag or Release, because main is unprotected and the release can use `gh release create` instead of a workflow.

Open questions, each with a recommended answer:
1. Version (product-owner / human): do not bump. Ship ai-dlc 1.0.0-preview1 and ai-dlc-lens 0.1.0, and keep preview2 for the plan/preview2 intent. The alternative is to bump to preview2 so installs from main update.
2. Tag scheme (human): one repository prerelease, v1.0.0-preview1, listing both plugins. Per-plugin tags only if the plugins will ship on separate cadences.
3. Go / no-go (product-owner): go as a prerelease, with the human waiving CI, Node 22, ITEM-098, M35, the ITEM-056 disclosures and the empty MANUAL-CHECKS result cells. If a stricter bar is wanted, make the live two-plugin band check the single no-go condition, since it is the only open item that could change shipped behaviour.
4. ITEM-098 and ITEM-104 (human): list them in the release notes as known open and move them to the next milestone, rather than hold the release.
5. Timing (human): merge and tag after the manual checks if they are days away. Otherwise release first. Nothing merges before the human approves at the release gate.
6. Changelog location (documentation-writer): use the GitHub Release body plus a new CHANGELOG.md seeded from it.

Docs update request, for documentation-writer: write the v1.0.0-preview1 release notes from section 2 of the checklist (section 8 has the request). The notes should say what ships and list the carried and open items as not included.

Next hop: product-owner for go / no-go, then the human at the release gate, then devops-engineer.
