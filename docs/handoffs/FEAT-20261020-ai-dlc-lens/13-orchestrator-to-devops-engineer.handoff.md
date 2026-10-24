---
step: 13
from: orchestrator
to: devops-engineer
run: FEAT-20261020-ai-dlc-lens
lifecycle: AI-DLC (whole-run hand-off: commits by feature root and the PR #24 update)
branch: feat/ai-dlc-lens
written: 2026-10-24 (session 5bbdde00, continued after automatic handoff)
verification: pending
---

# 13 — commit the run's work by feature root, then update PR #24

The human (2026-10-24): "Commits by feature root, then the PR #24 update: after the steps above." The steps are done. Everything is uncommitted on `feat/ai-dlc-lens` since `2a4ce11`.

## Do
1. **Commit plan first.** Group the working tree by the run's feature roots, from the *Features* table in `docs/handoffs/FEAT-20261020-ai-dlc-lens/run.v1.md`. Assign each changed path from the *Changed paths* lists in the hand-backs (`*-to-orchestrator.handback.md` in that folder; the step code's first number is the feature). The roots that changed in this branch since `2a4ce11` are:
   - 8: the ai-dlc-lens plugin, `plugins/claude/ai-dlc-lens/**`, plus the lens skills and lens parts of READMEs;
   - 9: orchestrator checks only;
   - 10: the docs-status rule and its `docs-rules` skill;
   - 11: feature-root and phase numbering, versioned run state, the auto-handoff module's run-state reading (`plugins/claude/ai-dlc/hooks/auto-handoff/**`), and the handoff skill;
   - 12: keep-alive (`plugins/claude/ai-dlc/hooks/keepalive/**`).

   Generated files (`plugins/copilot/**`, `skills/init/templates/AGENTS.md`) go with the change that regenerated them. A file touched by several features goes in the earliest commit that leaves the tree consistent: say which, and why. Paths no hand-back claims are listed, not committed. That covers the earlier uncommitted work this run did not make (`.ai-dlc/model-metadata.json`, `.github/workflows/validate.yml`, `.claude-plugin/marketplace.json`, `CLAUDE.md`, `README.md` hunks, agent memory); show them to the orchestrator, who asks the human. The run folder `docs/handoffs/FEAT-20261020-ai-dlc-lens/**` (records, `run.v1.md`, `phase-renames-2026-10-24.json`) goes in its own last commit.
2. **Before each commit:** run `node tools/build-copilot.mjs --check` and `node tools/validate.mjs` on the staged state, or on the final tree if staging makes that impossible. Say which. Before the last commit, also run `node --test "tests/**/*.test.mjs"`, `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc` and `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc-lens`.
3. **Commit messages:** conventional (`feat(lens): …`, `feat(handoff): …`, `docs(…)`, `chore(handoffs): …`), each naming its feature root, and ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never `--no-verify`. If a hook blocks a commit, fix the cause or report it; don't bypass it.
4. **PR #24:** update its description to cover the new commits: what each feature root delivers, the deferred items, and the open human gates (G2–G4 and release are still ahead for the lens). End it with the line `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Push the branch only if PR #24 tracks it and the push is a fast-forward. Never force-push. The GitHub MCP server failed to connect this session, so use the `gh` CLI. If `gh` cannot authenticate, stop and report.

## Limits
Never rewrite history, never push to `main`, never merge. Commit only paths a hand-back claims, plus the run folder. Don't edit file contents; if a check fails, report it rather than fixing code.

## Hand back
Line 1: `handoff 13-orchestrator-to-devops-engineer.handoff.md: passed|failed — <why>`. Then:
- the commit plan (commit → paths → feature root);
- each commit's hash and subject;
- the checks with real output;
- unclaimed paths left uncommitted;
- the PR #24 URL and what changed in its description;
- push result.

Compact.

## Addendum A (orchestrator, 2026-10-24, after the human's answers)
State: your commit C8 did land after your report, as `295a337`. It is signed (`%G?` = G), has 85 files and is not pushed.
1. **Trailer:** the human chose to fix it. Amend only `295a337`'s message (`git commit --amend`, signed as usual, nothing staged) so its trailer reads `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. This is the session's attribution line; use it on every commit. This one amend of an unpushed commit is explicitly allowed. No other history rewrite.
2. **Continue C9–C12** as planned, with the Opus trailer. Exception: agent-memory files move out of C11 (and out of any later commit) into the memory commit below.
3. **Then three separate commits, in this order:**
   - `chore(memory): …`: every changed file under `.claude/agent-memory/` not already in C8, including the 6 that were unclaimed. The message may reference the run, `docs/handoffs/FEAT-20261020-ai-dlc-lens/run.v1.md`.
   - `chore(model-metadata): …`: `.ai-dlc/model-metadata.json` alone.
   - `chore(handoffs): …`: the run folder, `run.v1.md` with all its step records and `phase-renames-2026-10-24.json` (the human: "commit the run state separately with its steps"). Add your hand-back records for step 13 too, once the orchestrator has written them; it will tell you.
4. Run the checks before each commit as the record says, and the full test set before the last one.
5. Then update PR #24 and push (fast-forward only).
