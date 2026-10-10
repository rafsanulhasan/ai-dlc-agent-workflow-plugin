# .NET CD steps

Stack-specific part of `github-cd-automation` for a repository that contains `*.sln`, `*.slnx` or `*.csproj`. The job chain, triggers, environments, approvals, changelog and GitHub Release are in `SKILL.md`. The `publish` job must satisfy the `nuget-package-deployment` skill.

## Prerequisites

- NuGet API key stored as an environment-scoped secret (e.g., `NUGET_API_KEY` in the `nuget-production` environment)
- GitHub Environments (`Settings → Environments`) for at least: `nuget-preview`, `nuget-production`
- Required reviewers configured on the `nuget-production` environment
- Tag convention: `vMAJOR.MINOR.PATCH` for stable, `vMAJOR.MINOR.PATCH-preview.N` for previews

## Build job

```yaml
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
```

## Publish job

```yaml
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
```

The environment scopes the `NUGET_API_KEY` secret to that environment only. For previews use `environment: nuget-preview` (no required reviewers, or lighter approval), and optionally publish to a private feed first, then nuget.org.

## Release assets

Attach the `.nupkg` and `.snupkg` artifacts to the GitHub Release if useful for offline consumers.

## Post-publish smoke step

- `dotnet add package <PackageId> --version ${VERSION}` in a fresh folder
- Assert exit code zero

## Flow values

| Aspect | Stable (`release.yml`) | Preview (`preview.yml`) |
|--------|------------------------|-------------------------|
| Environment | `nuget-production` (required reviewers) | `nuget-preview` (auto-approve) |
| Audience | Default consumers | Opt-in via `--prerelease` |

## Pitfalls

- **Forgotten `--skip-duplicate`**: retry runs fail when re-pushing matching `.snupkg`.
- **No rollback plan**: document the unlist procedure on nuget.org in the workflow README.
- Migrating from manual `dotnet nuget push` to tag-driven deploys: keep the manual command out of contributor docs once the workflow publishes.
