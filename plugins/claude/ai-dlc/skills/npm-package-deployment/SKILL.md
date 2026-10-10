---
name: npm-package-deployment
description: Structured workflow for publishing JavaScript/TypeScript packages to the npm registry. Covers SemVer with prerelease dist-tags (next, beta) vs latest, package.json metadata (name/scope, exports, types, files, engines, publishConfig), building the publishable output, npm pack dry-run inspection, npm publish from GitHub Actions with OIDC trusted publishing and automatic provenance (token secret only as fallback), pnpm and yarn equivalents, monorepo publishing with changesets, and keeping secrets and source maps out of the tarball. Invoked by the devops-engineer agent during release execution.
---

# npm Package Deployment

You are executing the `npm-package-deployment` skill on behalf of **Gene Kim** (`devops-engineer`). Your job is to publish traceable, consumable packages to the npm registry for a target version, choosing the correct flow (stable on `latest` vs prerelease on a dist-tag) and shipping only what consumers need.

> Agent names are the defaults; a name chosen at `/ai-dlc:init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## When to Invoke

- A release tag has been cut and packages must reach the npm registry
- A prerelease (`-next`, `-alpha`, `-beta`, `-rc`) must be published to a dist-tag from a feature or release branch
- A hotfix patch must be published after a stable release
- A monorepo has pending changesets that must be versioned and published
- **James Montemagno** (`product-manager`) has confirmed release readiness and handed off to devops-engineer

## Prerequisites

- All quality gates green with the repository's package manager: install from the lockfile, lint, typecheck, test, and StrykerJS (see `github-ci-automation`)
- `version` set correctly in `package.json` (or pending changesets in a monorepo)
- Package metadata complete in `package.json` (Phase 2)
- Publishing from a **GitHub-hosted** runner. npm trusted publishing supports GitHub-hosted GitHub Actions, GitLab.com shared runners and CircleCI cloud; self-hosted runners are not supported.
- Trusted publisher configured on npmjs.com for the package (Phase 5). The package must already exist on the registry, so the very first publish is a one-off bootstrap.
- Publish toolchain: npm CLI **11.5.1 or later** on Node **22.14.0 or later**. Node 22 bundles npm 10, so upgrade npm in the job (`npm install -g npm@latest`).
- Fallback only: an `NPM_TOKEN` granular access token stored as an environment-scoped GitHub Actions secret (never inline)

## Versioning Rules

Follow SemVer 2.0. On npm a version is published **to a dist-tag**; consumers running `npm install <pkg>` get whatever `latest` points to.

| Type | Pattern | Example | Dist-tag | When |
|------|---------|---------|----------|------|
| Stable | `MAJOR.MINOR.PATCH` | `1.4.0` | `latest` | Main-branch release, full gate passed |
| Next | `X.Y.Z-next.N` | `1.5.0-next.2` | `next` | Early integration on `main` between stable releases |
| Alpha | `X.Y.Z-alpha.N` | `2.0.0-alpha.1` | `alpha` | Experimental, breaking changes possible |
| Beta | `X.Y.Z-beta.N` | `2.0.0-beta.3` | `beta` | Feature-complete preview |
| Release Candidate | `X.Y.Z-rc.N` | `2.0.0-rc.1` | `rc` (or `next`) | Final preview before stable cut |
| Maintenance | `X.Y.Z` on an older line | `1.3.5` after `1.4.0` | `v1.3-lts` style tag | Patch to an older line; must not move `latest` backwards |

Rules:
- A prerelease **never** goes to `latest`. npm 11 refuses to publish a prerelease version without an explicit `--tag` (or `publishConfig.tag`); older npm silently put it on `latest`.
- A maintenance patch to an older line must also get an explicit `--tag`, or it becomes `latest`.
- A published version can never be reused, even after unpublish. Bump the counter or the patch.

## Workflow

### Phase 0 — Context Load

1. Read `CLAUDE.md` for project conventions.
2. Detect the package manager from the lockfile: `package-lock.json` → npm, `pnpm-lock.yaml` → pnpm, `yarn.lock` + `.yarnrc.yml` → Yarn Berry. Respect the `packageManager` field in `package.json`.
3. Locate publishable packages via Glob (`**/package.json` excluding `node_modules/`) and skip any with `"private": true`. A `pnpm-workspace.yaml`, `workspaces` field or `.changeset/` directory means a monorepo (Phase 7).
4. Verify the current commit is tagged (stable releases) or on a release branch (prereleases).

### Phase 1 — Version Confirmation

1. Read `version` from `package.json`.
2. Compare with the registry: `npm view <name> versions --json` and `npm view <name> dist-tags`.
3. Confirm with the calling agent that the target version and dist-tag are intentional.
4. For prereleases: confirm the counter is monotonic against the highest existing prerelease on that tag.

### Phase 2 — package.json Metadata

Confirm every field before building:

| Field | Requirement |
|-------|-------------|
| `name` | Scoped (`@org/pkg`) unless the project deliberately publishes unscoped. Scoped public packages need `publishConfig.access: "public"`. |
| `version` | Matches Phase 1 |
| `description`, `license`, `repository`, `homepage`, `bugs`, `keywords` | Present. `repository.url` must match the GitHub repo the workflow runs in, or provenance verification fails. |
| `exports` | Explicit entry points; every target file exists after build. Conditions ordered `types` first, then `import` / `require`, then `default`. |
| `types` (or `exports[...].types`) | Points at the built `.d.ts` |
| `main` / `module` | Only for consumers that do not read `exports`; must agree with it |
| `type` | `"module"` or `"commonjs"`, matching the built output |
| `files` | **Allowlist** of what ships (e.g., `["dist", "README.md", "LICENSE"]`). Prefer it over `.npmignore`. |
| `engines.node` | The minimum Node version actually supported and tested in CI |
| `publishConfig` | `access` (`public` for scoped public packages), `registry` if not the default, `tag` for a branch that only ever publishes prereleases |
| `sideEffects` | `false` when true, so bundlers can tree-shake |

### Phase 3 — Build the Publishable Output

1. Clean install from the lockfile: `npm ci` / `pnpm install --frozen-lockfile` / `yarn install --immutable`.
2. Remove the previous output (`dist/`) so stale files cannot ship.
3. Run the project's build script (`npm run build`). TypeScript packages emit JavaScript plus `.d.ts` declarations; dual-format packages emit both ESM and CJS with matching `exports` conditions.
4. Decide on source maps on purpose. A `.map` with `sourcesContent` republishes the original source. Ship maps only when the source is public anyway and debugging value is wanted; otherwise turn them off for the production build or leave `*.map` out of `files`.
5. Prefer running the build in a `prepack` script so `npm pack` and `npm publish` always build the same way. Never use `prepublish` (deprecated and confusing).

### Phase 4 — Validate the Package (`npm pack` dry run)

Before publishing:

1. `npm pack --dry-run` (or `npm publish --dry-run --tag <tag>`) and read the file list and the unpacked size.
2. Confirm the tarball contains **only**: built output, `package.json`, `README.md`, `LICENSE` (plus `CHANGELOG.md` if wanted).
3. Confirm it contains **none** of: `.env*`, `.npmrc`, keys or certificates (`*.pem`, `*.key`), CI files, `src/` (unless intentional), tests, fixtures, coverage, Stryker reports, unintended `*.map` files, or anything over the expected size.
4. Pack for real (`npm pack`), install the tarball into a scratch folder and import every `exports` entry (ESM and CJS where both are offered). For TypeScript consumers, typecheck a one-line import. Tools such as `publint` and `@arethetypeswrong/cli` catch `exports` / types mistakes.

### Phase 5 — Publish

**Primary: OIDC trusted publishing from GitHub Actions.**

One-time setup on npmjs.com: package → Settings → Trusted Publisher → GitHub Actions, with the organization or user, repository, workflow **filename** (e.g., `release.yml`, no path) and, recommended, the GitHub environment name. npm does not validate this on save; mistakes surface at publish time. With npm 11.15.0 or later the same can be done with `npm trust github <pkg> --file release.yml --repo owner/repo --env npm-production --allow-publish`. Once it works, set the package's Publishing access to "Require two-factor authentication and disallow tokens" — trusted publishing is unaffected.

The publish job:

```yaml
  publish:
    needs: build
    runs-on: ubuntu-latest          # GitHub-hosted; self-hosted is not supported
    environment: npm-production
    permissions:
      contents: read
      id-token: write               # required for OIDC
    steps:
      - uses: actions/setup-node@v7
        with:
          node-version: '24'
          registry-url: 'https://registry.npmjs.org'
      - run: npm install -g npm@latest      # npm >= 11.5.1
      - uses: actions/download-artifact@v8
        with:
          name: npm-package
          path: ./artifacts
      - run: npm publish ./artifacts/*.tgz --tag latest   # --tag next|beta|rc for prereleases
```

- No `NODE_AUTH_TOKEN` and no `NPM_TOKEN` in the publish step: npm exchanges the OIDC token itself. Remove any leftover token configuration so it does not take precedence over OIDC.
- Provenance is generated **automatically** under trusted publishing on GitHub Actions and GitLab (not CircleCI); `--provenance` is not needed. It needs a public source repository and a public package; a private repository or package gets none.
- Publish the tarball built and tested in the `build` job, not a fresh build.

**Bootstrap (first publish of a new package).** Trusted publishing needs the package to exist. Publish the first version manually with 2FA (or with a short-lived granular token), then configure the trusted publisher and switch to the workflow.

**Fallback: token secret.** Only where trusted publishing is unavailable (self-hosted runners, CI providers npm does not support):
- Granular access token, write access to the specific package(s) only, shortest viable expiry (write tokens are capped at 90 days; classic tokens no longer exist).
- Stored as an environment secret, passed as `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` with setup-node's `registry-url`.
- Add `--provenance` (with `id-token: write`) to keep provenance on GitHub-hosted runners.
- Never log, echo, or write the token to a committed `.npmrc`.

### Phase 6 — Verify on the Registry

1. `npm view <name>@<version>` returns the version; `npm view <name> dist-tags` shows it on the intended tag and `latest` did not move for a prerelease.
2. The package page shows the provenance badge linking to the workflow run and commit.
3. `npm audit signatures` in a consumer project verifies registry signatures and provenance attestations.
4. Install from a clean folder: `npm install <name>@<version>` and import it.

## pnpm and Yarn Equivalents

| Step | npm | pnpm | Yarn Berry |
|------|-----|------|------------|
| Clean install | `npm ci` | `pnpm install --frozen-lockfile` | `yarn install --immutable` |
| Inspect tarball | `npm pack --dry-run` | `pnpm pack` (then list the `.tgz`) | `yarn pack --dry-run` |
| Publish | `npm publish --tag <tag>` | `pnpm publish --tag <tag>` (`-r` for workspaces) | `yarn npm publish --tag <tag>` |
| Trusted publishing (OIDC) | npm 11.5.1+ on Node 22.14.0+ | `pnpm publish` is native since pnpm 11 (no longer delegates to npm); early 11.0.x had OIDC regressions, so use 11.1.3 or later (12.x preferred) with `pnpm/action-setup@v6`. Provenance is attached automatically for a public package from a public repo; add `--no-provenance` on self-hosted runners. pnpm 10 has no native OIDC publish: use the npm fallback below. | Yarn 4.10.3 or later (provenance since 4.9.0, GitHub Actions/GitLab OIDC since 4.10.0, scoped-package OIDC fix in 4.10.3; CircleCI OIDC in 4.14.0/4.15.0). Yarn's docs do not say provenance is automatic under OIDC, so set `npmPublishProvenance: true` in `.yarnrc.yml` explicitly. Yarn 1 has no OIDC: use npm publish. |
| Dist-tag move | `npm dist-tag add <pkg>@<v> latest` | same npm command | `yarn npm tag add <pkg>@<v> latest` |

If the pnpm or Yarn version in use cannot publish with OIDC (pnpm 10, Yarn 1, Yarn Berry before 4.10.3), build and pack with it (`pnpm pack` / `yarn pack`), then publish the tarball with npm 11.5.1 or later: `npm publish ./<pkg>.tgz --tag <tag>`. This is also the documented fallback on any pnpm version. `pnpm pack` and `yarn pack` rewrite `workspace:` protocol ranges to real versions; raw `npm publish` from a workspace folder does not.

## Monorepo Publishing with Changesets (option)

Use changesets when several packages version independently:

1. Contributors add `.changeset/*.md` files with each PR (`npx changeset`).
2. On `main`, `changesets/action@v2` (requires Changesets CLI v3) opens a "Version Packages" PR that bumps versions and writes changelogs. Merging it publishes.
3. Inputs in v2 are kebab-case: `publish-script` (e.g., `pnpm changeset publish`), `version-script`, `commit-message`, `pr-title`; pass `github-token` explicitly. The action no longer writes `.npmrc` from `NPM_TOKEN`; use trusted publishing (configured per package on npmjs.com, same workflow filename).
4. For least privilege, use the sub-actions (`changesets/action/version`, `/pack`, `/publish`) and grant `id-token: write` only to the publish job.
5. Prereleases: `changeset pre enter next` → publishes to the `next` dist-tag until `changeset pre exit`.

Without changesets, publish each package from the build artifact in dependency order and keep every package on the same dist-tag rules.

## Stable vs Prerelease Flow Differences

| Step | Stable | Prerelease |
|------|--------|------------|
| Source | Tag on `main` (e.g., `v1.4.0`) | Branch or untagged commit |
| Version | `1.4.0` | `1.5.0-next.N` |
| Dist-tag | `latest` | `next` / `beta` / `rc` |
| Trigger | Manual workflow dispatch or tag push | Push to `release/*` or scheduled |
| Environment | `npm-production` (required reviewers) | `npm-preview` (auto-approve) |
| Audience | All consumers (`npm install <pkg>`) | Opt-in (`npm install <pkg>@next`) |
| Rollback | `npm dist-tag add <pkg>@<previous> latest` + `npm deprecate <pkg>@<bad> "<reason>"` | Bump the counter and republish |

## Common Pitfalls

- **Secrets in the tarball**: `.env`, `.npmrc` or keys ship because there is no `files` allowlist. Always use `files` and read `npm pack --dry-run`.
- **Source maps leaking source**: `*.map` with `sourcesContent` republishes private source. Decide deliberately (Phase 3).
- **Prerelease on `latest`**: every consumer gets the preview. Always pass `--tag` for prereleases and older-line patches.
- **Reusing a version**: the registry rejects it forever. Bump instead. Prefer `npm deprecate` and a dist-tag move over unpublishing.
- **Trusted publishing fails with 404/401**: workflow filename, repository or environment on npmjs.com does not match the run; npm older than 11.5.1; a leftover `NODE_AUTH_TOKEN` / `_authToken`; or a self-hosted runner.
- **Provenance mismatch**: `repository.url` in `package.json` differs from the repository that ran the workflow.
- **Broken `exports`**: a path missing from `dist/` or `types` not first in the condition list. Install the packed tarball and import it before publishing.
- **Hardcoded token**: secret leaks. Use trusted publishing; if a token is unavoidable, source it from `${{ secrets.NPM_TOKEN }}` in an environment.
- **`workspace:` ranges published verbatim**: publishing with raw npm from a pnpm/Yarn workspace. Pack with the workspace's package manager first.

## Output

Return to the calling agent:
- Package name(s), version(s) and dist-tag(s) published
- npmjs.com URL(s)
- SHA of the source commit and confirmation of the provenance attestation
- Whether this is a stable or prerelease deployment, and the publish method (trusted publishing or token fallback)
- Any pending follow-up (e.g., update GitHub Release notes, deprecate a broken version, configure a trusted publisher after a bootstrap publish)
