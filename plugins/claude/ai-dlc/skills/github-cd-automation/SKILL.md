---
name: github-cd-automation
description: Structured workflow for designing GitHub Actions continuous deployment for .NET projects. Covers release workflows triggered by tags or manual dispatch, environments and environment secrets, approval gates, NuGet package deployment, GitHub Releases with changelogs, and separating preview vs production deployment flows. Invoked by the devops-engineer agent when release/deploy workflows must be created or updated.
---

# GitHub CD Automation

You are executing the `github-cd-automation` skill on behalf of **Gene Kim** (`devops-engineer`). Your job is to produce or modify release workflow files that publish the project's packages and create GitHub Releases — with safeguards (approval, environment-scoped secrets) that distinguish preview from production flows.

> Agent names are the defaults; a name chosen at `/ai-dlc:init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## When to Invoke

- A new release workflow must be created (e.g., `release.yml`, `preview.yml`)
- An existing release workflow needs new steps (changelog generation, GitHub Release creation, attestation)
- Approval gates or environments must be added before NuGet publishing
- Migrating from manual `dotnet nuget push` to fully automated tag-driven deploys

## Prerequisites

- A working CI workflow already validates every push (see `github-ci-automation`)
- NuGet API key stored as an environment-scoped secret (e.g., `NUGET_API_KEY` in the `nuget-org-production` environment)
- Repository configured with GitHub Environments (`Settings → Environments`) for at least: `nuget-preview`, `nuget-production`
- Required reviewers configured on the `nuget-production` environment
- Tag convention defined: `vMAJOR.MINOR.PATCH` for stable, `vMAJOR.MINOR.PATCH-preview.N` for previews

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
  id-token: write   # for OIDC if used

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '9.0.x'
      - run: dotnet restore
      - run: dotnet build --configuration Release --no-restore
      - run: dotnet test --configuration Release --no-build
      - name: Pack
        run: dotnet pack --configuration Release --no-build --output ./artifacts --include-symbols -p:SymbolPackageFormat=snupkg
      - uses: actions/upload-artifact@v4
        with:
          name: nupkg
          path: ./artifacts/*.*nupkg

  publish:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: nuget-production
      url: https://www.nuget.org/packages/MyProduct
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: nupkg
          path: ./artifacts
      - name: Push to nuget.org
        run: |
          dotnet nuget push ./artifacts/*.nupkg \
            --api-key ${{ secrets.NUGET_API_KEY }} \
            --source https://api.nuget.org/v3/index.json \
            --skip-duplicate

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

- Trigger on tag pattern `v[0-9]+.[0-9]+.[0-9]+-(preview|alpha|beta|rc).*` or `workflow_dispatch`
- Use `environment: nuget-preview` (no required reviewers, or lighter approval)
- `prerelease: true` on the GitHub Release
- Optionally publish to a private feed first, then nuget.org

## Workflow

### Phase 0 — Context Load

1. Read `CLAUDE.md` for project conventions.
2. List `.github/workflows/` to see existing workflows.
3. Confirm which Environments exist in `Settings → Environments` (ask the user if uncertain).
4. Read the `nuget-package-deployment` skill — your `publish` job must satisfy its protocol.

### Phase 1 — Triggers

Use tags for the primary path:
- Stable: `v[0-9]+.[0-9]+.[0-9]+`
- Preview: `v[0-9]+.[0-9]+.[0-9]+-*`

Always also provide `workflow_dispatch` for manual republish/retry.

### Phase 2 — Environments and Approvals

Each `publish` job must declare `environment:`. This:
- Scopes the `NUGET_API_KEY` secret to that environment only
- Enforces required reviewers configured in the environment settings
- Records the deployment on the repo's Deployments page

Stable production releases require human approval. Previews can be auto-approved.

### Phase 3 — Build → Publish → Release Job Chain

Use `needs:` to enforce ordering. Never combine build and publish in one job — the artifact must be the same artifact that was tested.

### Phase 4 — Changelog Generation

Generate a changelog from `git log` between the previous tag and the current tag. For richer notes, integrate `release-drafter` or `git-cliff` — both available as GitHub Actions.

### Phase 5 — GitHub Release Creation

Use `softprops/action-gh-release@v2`:
- Stable: `prerelease: false`
- Preview: `prerelease: true`
- Attach the `.nupkg` and `.snupkg` artifacts if useful for offline consumers

### Phase 6 — Verification

Add a post-publish smoke step (in production releases):
- `dotnet add package <PackageId> --version ${VERSION}` in a fresh folder
- Assert exit code zero

## Stable vs Preview Flow Summary

| Aspect | Stable (`release.yml`) | Preview (`preview.yml`) |
|--------|------------------------|-------------------------|
| Trigger | Tag `v1.4.0` | Tag `v1.5.0-preview.2` |
| Environment | `nuget-production` (required reviewers) | `nuget-preview` (auto-approve) |
| GitHub Release `prerelease:` | `false` | `true` |
| Changelog scope | Since last stable tag | Since last preview tag |
| Audience | Default consumers | Opt-in via `--prerelease` |

## Common Pitfalls

- **No environment on publish job**: secrets become repo-wide; required reviewers don't apply.
- **Publishing untested artifacts**: rebuild in the publish job loses traceability. Always download the build artifact.
- **Missing `contents: write`**: `action-gh-release` fails silently with permission denied.
- **Tag-pattern overlap**: a single workflow trying to handle both stable and preview tags often leaks preview secrets. Separate workflows are safer.
- **Forgotten `--skip-duplicate`**: retry runs fail when re-pushing matching `.snupkg`.
- **Changelog includes merge commits noise**: filter `--no-merges` or use a curated tool.
- **No rollback plan**: document the unlist procedure on nuget.org in the workflow README.

## Output

Return to the calling agent:
- Workflow files created or modified
- Environments and secrets required
- Approval gate configuration steps for the maintainer
- Tag patterns that trigger each workflow
- Verification step status
