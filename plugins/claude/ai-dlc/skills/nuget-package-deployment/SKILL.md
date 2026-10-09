---
name: nuget-package-deployment
description: Structured workflow for publishing NuGet packages to nuget.org. Covers SemVer with preview/prerelease suffixes, dotnet pack, dotnet nuget push, secret-based API key handling, symbol packages (.snupkg), Source Link, package metadata in .csproj, and the difference between stable and preview release flows. Invoked by the devops-engineer agent during release execution.
---

# NuGet Package Deployment

You are executing the `nuget-package-deployment` skill on behalf of **Gene Kim** (`devops-engineer`). Your job is to produce signed, traceable, and consumable NuGet packages on nuget.org for a target version, choosing the correct flow (stable vs preview/prerelease).

> Agent names are the defaults; a name chosen at `/ai-dlc:init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## When to Invoke

- A release tag has been cut and packages must reach nuget.org
- A preview build (`-preview`, `-alpha`, `-beta`, `-rc`) must be published from a feature or release branch
- A hotfix patch must be republished after a stable release
- **James Montemagno** (`product-manager`) has confirmed release readiness and handed off to devops-engineer

## Prerequisites

- All quality gates green: `dotnet build`, `dotnet test`, `dotnet stryker`
- Version field set correctly in `.csproj` or `Directory.Build.props`
- `NUGET_API_KEY` available as a GitHub Actions secret (never inline)
- Package metadata complete in `.csproj`: `PackageId`, `Authors`, `Description`, `RepositoryUrl`, `PackageLicenseExpression`, `PackageReadmeFile`
- Source Link enabled: `<PublishRepositoryUrl>true</PublishRepositoryUrl>`, `<EmbedUntrackedSources>true</EmbedUntrackedSources>`, `<IncludeSymbols>true</IncludeSymbols>`, `<SymbolPackageFormat>snupkg</SymbolPackageFormat>`

## Versioning Rules

Follow SemVer 2.0:

| Type | Pattern | Example | When |
|------|---------|---------|------|
| Stable | `MAJOR.MINOR.PATCH` | `1.4.0` | Main-branch release, full gate passed |
| Preview | `X.Y.Z-preview.N` | `1.5.0-preview.2` | Early integration on `main` between stable releases |
| Alpha | `X.Y.Z-alpha.N` | `2.0.0-alpha.1` | Experimental, breaking changes possible |
| Beta | `X.Y.Z-beta.N` | `2.0.0-beta.3` | Feature-complete preview |
| Release Candidate | `X.Y.Z-rc.N` | `2.0.0-rc.1` | Final preview before stable cut |

Prerelease suffixes follow nuget.org ordering — `alpha < beta < rc < (stable)`. Never reuse a published version; bump the suffix counter.

## Workflow

### Phase 0 — Context Load

1. Read `CLAUDE.md` for project conventions.
2. Locate the project file(s) to be packed via Glob (`**/*.csproj` filtered to library projects, not tests/samples).
3. Read `.csproj` files and confirm metadata is complete.
4. Verify the current commit is tagged (stable releases) or on a release branch (previews).

### Phase 1 — Version Confirmation

1. Read the current `<Version>` (or `<VersionPrefix>` + `<VersionSuffix>`) from the project file or `Directory.Build.props`.
2. Confirm with the calling agent that the target version is intentional (compare to the latest version already on nuget.org via `dotnet package search <PackageId>` or the nuget.org API).
3. For prereleases: confirm the suffix is monotonic against the highest existing prerelease tag.

### Phase 2 — Pack

```
dotnet pack <project> --configuration Release --output ./artifacts --include-symbols -p:SymbolPackageFormat=snupkg
```

This produces both `.nupkg` and `.snupkg` files in `./artifacts/`. Verify both exist before pushing.

### Phase 3 — Validate the Package

Before pushing:

1. Open the `.nupkg` (it is a zip) and confirm:
   - `*.nuspec` contains correct metadata
   - `README.md` is included if referenced
   - `LICENSE` or `PackageLicenseExpression` is present
   - `lib/<tfm>/*.dll` contains the compiled assembly for every target framework
2. Run `dotnet nuget verify ./artifacts/*.nupkg` for signed packages.
3. For Source Link: extract a `.pdb` and confirm it contains `SourceLink.json`.

### Phase 4 — Push

```
dotnet nuget push ./artifacts/<package>.nupkg \
  --api-key $NUGET_API_KEY \
  --source https://api.nuget.org/v3/index.json \
  --skip-duplicate
```

`.snupkg` files are pushed automatically alongside the matching `.nupkg` when both are present.

**API key handling:**
- Always read from environment variable populated by a GitHub Actions secret
- Never log, echo, or write the key to a file
- Use a key scoped to the specific package, with shortest viable expiry

### Phase 5 — Verify on nuget.org

1. Wait 1–5 minutes for indexing.
2. `dotnet package search <PackageId>` should list the new version.
3. Test consumption from a clean folder: `dotnet add package <PackageId> --version <new-version>`.
4. For Source Link: open a step-into in a consumer project and confirm the source is fetched from GitHub.

## Stable vs Preview Flow Differences

| Step | Stable | Preview |
|------|--------|---------|
| Source | Tag on `main` (e.g., `v1.4.0`) | Branch or untagged commit |
| Version | `1.4.0` | `1.5.0-preview.N` |
| Trigger | Manual workflow dispatch or tag push | Push to `release/*` or scheduled |
| Audience | All consumers | Opt-in via `--prerelease` |
| Rollback | Unlist via nuget.org UI | Bump suffix and republish |

## Common Pitfalls

- **Reusing a version**: nuget.org rejects duplicates. Always bump the suffix or patch number.
- **Missing `.snupkg`**: consumers lose Source Link/debug support. Always include symbols.
- **Hardcoded API key**: secret leaks. Always source from `$env:NUGET_API_KEY` / `${{ secrets.NUGET_API_KEY }}`.
- **Stale `<RepositoryCommit>`**: Source Link points to the wrong commit. Use `MinVer` or the build pipeline to inject the SHA.
- **Forgetting `--skip-duplicate`**: a retry fails when the matching `.snupkg` is already pushed. Always pass this flag in CD scripts.
- **PackageReadmeFile not packed**: nuget.org page is blank. Confirm `<None Include="README.md" Pack="true" PackagePath="\" />` in the project file.

## Output

Return to the calling agent:
- Package id and version published
- nuget.org URL
- SHA of the source commit
- Whether this is a stable or prerelease deployment
- Any pending follow-up (e.g., update GitHub Release notes, unlist a previous broken version)
