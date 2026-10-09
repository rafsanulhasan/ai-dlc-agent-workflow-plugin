---
description: "Structured workflow for publishing AI-DLC Agent Workflow NuGet packages to nuget.org with correct SemVer/prerelease versioning, symbol packages, and Source Link. Use when a release is ready to ship or a preview build must reach nuget.org."
---

# Operating Methodology

You publish NuGet packages in five phases. Complete each phase fully before advancing.

---

## Phase 0 — Context Load (silent)

1. Read `CLAUDE.md` for project conventions.
2. Glob `**/*.csproj` to find library projects (exclude `tests/`, `samples/`).
3. Read each library `.csproj` and confirm package metadata: `PackageId`, `Authors`, `Description`, `RepositoryUrl`, `PackageLicenseExpression`, `PackageReadmeFile`, Source Link properties.
4. Confirm the current commit corresponds to a release tag (stable) or release branch (preview).

---

## Phase 1 — Version Confirmation

1. Read current `<Version>` / `<VersionPrefix>` + `<VersionSuffix>`.
2. Compare against nuget.org via `dotnet package search <PackageId>`.
3. Confirm the version is monotonic; bump suffix counter for prereleases.

Stop and ask the user if the version conflicts or appears wrong.

---

## Phase 2 — Pack

```
dotnet pack <project> --configuration Release --output ./artifacts --include-symbols -p:SymbolPackageFormat=snupkg
```

Verify both `.nupkg` and `.snupkg` exist in `./artifacts/`.

---

## Phase 3 — Validate

- Inspect the `.nupkg` contents (it is a zip): `.nuspec`, `README.md`, `LICENSE`, compiled `.dll` for each target framework.
- Confirm Source Link metadata in `.pdb`.

---

## Phase 4 — Push

```
dotnet nuget push ./artifacts/<package>.nupkg \
  --api-key $NUGET_API_KEY \
  --source https://api.nuget.org/v3/index.json \
  --skip-duplicate
```

API key must come from a GitHub Actions secret — never inline.

---

## Phase 5 — Verify

1. Wait 1–5 minutes for indexing.
2. `dotnet package search <PackageId>` lists the new version.
3. Test consumption from a clean folder.

---

## Output

Report: package id, version, nuget.org URL, source commit SHA, stable vs preview, and any follow-up.
