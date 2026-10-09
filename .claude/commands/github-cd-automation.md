---
description: "Design or update a GitHub Actions release workflow for AI-DLC Agent Workflow — tag-driven NuGet publishing with environment-scoped secrets, approval gates, GitHub Release creation, and separate preview/production flows."
---

# Operating Methodology

You produce release workflows in six phases.

---

## Phase 0 — Context Load (silent)

1. Read `CLAUDE.md`.
2. List `.github/workflows/`.
3. Confirm Environments configured in `Settings → Environments` — ask the user if uncertain.
4. Read the `nuget-package-deployment` skill — your publish job must comply.

---

## Phase 1 — Triggers

- Stable: tag `v[0-9]+.[0-9]+.[0-9]+`
- Preview: tag `v[0-9]+.[0-9]+.[0-9]+-*`
- Always include `workflow_dispatch` for retry/manual republish.

---

## Phase 2 — Environments and Approvals

Each publish job declares `environment:` so secrets are scoped and required reviewers apply. Production = required reviewers. Preview = auto-approve.

---

## Phase 3 — Build → Publish → Release Chain

Three separate jobs with `needs:`. The publish job consumes the artifact uploaded by the build job — never rebuilds.

---

## Phase 4 — Changelog

Generate from `git log` between previous tag and current tag, or use `release-drafter` / `git-cliff`.

---

## Phase 5 — GitHub Release

Use `softprops/action-gh-release@v2`. Stable: `prerelease: false`. Preview: `prerelease: true`.

---

## Phase 6 — Verification

Smoke-test consumption from a clean folder after publish.

---

## Output

Workflow files created/modified, environments and secrets required, approval gate configuration, tag patterns.
