---
name: github-cd-automation
description: Structured workflow for designing GitHub Actions continuous deployment for .NET and JavaScript/TypeScript projects. Covers release workflows triggered by tags or manual dispatch, environments and environment secrets, approval gates, package deployment (NuGet to nuget.org; npm with provenance and OIDC trusted publishing), GitHub Releases with changelogs, and separating preview vs production deployment flows. Invoked by the devops-engineer agent when release/deploy workflows must be created or updated.
---

# GitHub CD Automation

You are executing the `github-cd-automation` skill on behalf of **Gene Kim** (`devops-engineer`). Your job is to produce or modify release workflow files that publish the project's packages and create GitHub Releases — with safeguards (approval, environment-scoped credentials) that distinguish preview from production flows.

> Agent names are the defaults; a name chosen at `/init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## Stack Detection

This file holds the stack-neutral release flow. The `build` and `publish` jobs live in one reference per stack, and each `publish` job must satisfy that stack's deployment skill. Detect the stack (ignore `bin/`, `obj/`, `node_modules/`) and read the matching reference:

| Detected | Stack | Reference | Deployment skill |
|----------|-------|-----------|------------------|
| `*.sln`, `*.slnx` or `*.csproj` | .NET | [references/dotnet.md](references/dotnet.md) | `nuget-package-deployment` |
| `package.json` | JavaScript / TypeScript (Node) | [references/node.md](references/node.md) | `npm-package-deployment` |

A repository that publishes both kinds of package uses both references: a `build-<stack>` and `publish-<stack>` job per stack, each with its own environment, and a single `release` job that `needs:` every publish job.

## When to Invoke

- A new release workflow must be created (e.g., `release.yml`, `preview.yml`)
- An existing release workflow needs new steps (changelog generation, GitHub Release creation, attestation)
- Approval gates or environments must be added before package publishing
- Migrating from manual publishing (`dotnet nuget push`, `npm publish` from a laptop) to fully automated tag-driven deploys

## Prerequisites

- A working CI workflow already validates every push (see `github-ci-automation`)
- Repository configured with GitHub Environments (`Settings → Environments`) for a preview and a production flow per registry (names in the stack reference)
- Required reviewers configured on the production environment
- Registry credentials scoped to the environment: an environment secret, or OIDC trusted publishing where the registry supports it (stack reference)
- Tag convention defined: `vMAJOR.MINOR.PATCH` for stable, `vMAJOR.MINOR.PATCH-<pre>.N` for previews

## Workflow Structure — Production Release

```yaml
name: Release

on:
  push:
    tags: ['v[0-9]+.[0-9]+.[0-9]+']
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to release (e.g. 1.4.0)'
        required: true

permissions:
  contents: write   # required to create a GitHub Release
  id-token: write   # for OIDC (trusted publishing, provenance)

jobs:
  build:
    # stack reference: checkout, setup, install, build, test, pack, upload-artifact

  publish:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: <registry>-production
      url: <package page>
    # stack reference: download-artifact, publish

  release:
    needs: publish
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Generate changelog
        id: changelog
        run: |
          PREV_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
          if [ -n "$PREV_TAG" ]; then
            git log "$PREV_TAG..HEAD" --pretty=format:"- %s (%h)" > CHANGELOG.md
          else
            git log --pretty=format:"- %s (%h)" > CHANGELOG.md
          fi
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ github.ref_name }}
          name: ${{ github.ref_name }}
          body_path: CHANGELOG.md
          prerelease: false
```

## Workflow Structure — Preview Release

Differences from production:

- Trigger on tag pattern `v[0-9]+.[0-9]+.[0-9]+-(preview|alpha|beta|rc|next).*` or `workflow_dispatch`
- Use the preview environment (no required reviewers, or lighter approval)
- Publish to the registry's prerelease channel (NuGet prerelease version; npm dist-tag other than `latest`)
- `prerelease: true` on the GitHub Release
- Optionally publish to a private feed first, then the public registry

## Workflow

### Phase 0 — Context Load

1. Read `CLAUDE.md` for project conventions.
2. Detect the stack(s) and read the matching reference(s).
3. List `.github/workflows/` to see existing workflows.
4. Confirm which Environments exist in `Settings → Environments` (ask the user if uncertain).
5. Read the stack's deployment skill (`nuget-package-deployment` or `npm-package-deployment`) — your `publish` job must satisfy its protocol.

### Phase 1 — Triggers

Use tags for the primary path:
- Stable: `v[0-9]+.[0-9]+.[0-9]+`
- Preview: `v[0-9]+.[0-9]+.[0-9]+-*`

Always also provide `workflow_dispatch` for manual republish/retry.

### Phase 2 — Environments and Approvals

Each `publish` job must declare `environment:`. This:
- Scopes the registry secret (or the trusted-publisher binding) to that environment only
- Enforces required reviewers configured in the environment settings
- Records the deployment on the repo's Deployments page

Stable production releases require human approval. Previews can be auto-approved.

### Phase 3 — Build → Publish → Release Job Chain

Use `needs:` to enforce ordering. Never combine build and publish in one job — the artifact must be the same artifact that was tested.

### Phase 4 — Changelog Generation

Generate a changelog from `git log` between the previous tag and the current tag. For richer notes, integrate `release-drafter` or `git-cliff` — both available as GitHub Actions. A JS/TS repository that uses changesets already has curated notes; see the node reference.

### Phase 5 — GitHub Release Creation

Use `softprops/action-gh-release@v2`:
- Stable: `prerelease: false`
- Preview: `prerelease: true`
- Attach the built packages if useful for offline consumers (stack reference names them)

### Phase 6 — Verification

Add a post-publish smoke step (in production releases) that installs the just-published version into a fresh folder and asserts exit code zero. The stack reference gives the command.

## Stable vs Preview Flow Summary

| Aspect | Stable (`release.yml`) | Preview (`preview.yml`) |
|--------|------------------------|-------------------------|
| Trigger | Tag `v1.4.0` | Tag `v1.5.0-preview.2` |
| Environment | Production (required reviewers) | Preview (auto-approve) |
| GitHub Release `prerelease:` | `false` | `true` |
| Changelog scope | Since last stable tag | Since last preview tag |
| Audience | Default consumers | Opt-in (stack reference) |

## Common Pitfalls

- **No environment on publish job**: secrets become repo-wide; required reviewers don't apply.
- **Publishing untested artifacts**: rebuild in the publish job loses traceability. Always download the build artifact.
- **Missing `contents: write`**: `action-gh-release` fails silently with permission denied.
- **Tag-pattern overlap**: a single workflow trying to handle both stable and preview tags often leaks preview secrets. Separate workflows are safer.
- **Changelog includes merge commits noise**: filter `--no-merges` or use a curated tool.
- **No rollback plan**: document the registry's rollback procedure (stack reference) in the workflow README.
- Stack-specific pitfalls are listed at the end of each stack reference.

## Output

Return to the calling agent:
- Workflow files created or modified
- Detected stack(s) and the reference(s) applied
- Environments and secrets (or trusted-publisher bindings) required
- Approval gate configuration steps for the maintainer
- Tag patterns that trigger each workflow
- Verification step status
