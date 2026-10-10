# Node (JavaScript / TypeScript) CD steps

Stack-specific part of `github-cd-automation` for a repository with a `package.json` (outside `node_modules/`). The job chain, triggers, environments, approvals, changelog and GitHub Release are in `SKILL.md`. The `publish` job must satisfy the `npm-package-deployment` skill: read it before writing the job.

## Prerequisites

- GitHub Environments: `npm-preview` and `npm-production`, with required reviewers on `npm-production`
- An npm **trusted publisher** configured for each package on npmjs.com: this repository, the release workflow **filename** (e.g., `release.yml`) and the environment (`npm-production`, or `npm-preview` for `preview.yml`). The package must already exist; bootstrap a new package as `npm-package-deployment` describes.
- GitHub-hosted runners for the publish job (trusted publishing does not support self-hosted runners yet)
- Fallback only: an `NPM_TOKEN` granular access token as an environment secret
- Tag convention: `vMAJOR.MINOR.PATCH` for stable, `vMAJOR.MINOR.PATCH-<next|alpha|beta|rc>.N` for prereleases

## Build job

```yaml
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v7
        with:
          node-version: '24'
          package-manager-cache: false    # release workflow: no dependency cache (cache poisoning)
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - name: Pack
        run: |
          mkdir -p artifacts
          npm pack --pack-destination ./artifacts
          tar -tzf ./artifacts/*.tgz      # file list in the log for review
      - uses: actions/upload-artifact@v7
        with:
          name: npm-package
          path: ./artifacts/*.tgz
```

`npm pack` runs the `prepack` build. For pnpm, add `pnpm/action-setup@v6` before setup-node and use `pnpm install --frozen-lockfile` and `pnpm pack --pack-destination ./artifacts`. For Yarn Berry use `yarn install --immutable` and `yarn pack --out ./artifacts/%s-%v.tgz`. Packing with the workspace's own manager rewrites `workspace:` ranges.

## Publish job

```yaml
  publish:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: npm-production
      url: https://www.npmjs.com/package/@org/my-package
    permissions:
      contents: read
      id-token: write                     # OIDC trusted publishing + provenance
    steps:
      - uses: actions/setup-node@v7
        with:
          node-version: '24'
          registry-url: 'https://registry.npmjs.org'
      - run: npm install -g npm@latest    # trusted publishing needs npm >= 11.5.1
      - uses: actions/download-artifact@v8
        with:
          name: npm-package
          path: ./artifacts
      - name: Publish to npm
        run: npm publish ./artifacts/*.tgz --tag latest
```

- No `NODE_AUTH_TOKEN`: npm exchanges the OIDC token itself and attaches provenance automatically.
- Prerelease workflow (`preview.yml`): `environment: npm-preview` and `--tag next` (or `beta` / `rc`, from the version's prerelease identifier). npm 11 refuses a prerelease without `--tag`.
- Token fallback: add `env: NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` (environment secret) and `--provenance` to the publish step.
- Set `permissions: contents: write` at the workflow level only if the `release` job needs it; keep `id-token: write` on the publish job only.

## Monorepos with changesets

When the repository uses changesets, the release workflow runs on push to `main` instead of on tags: `changesets/action@v2` opens or updates the "Version Packages" PR, and merging that PR publishes. Requirements, inputs and the sub-action split (`version` / `pack` / `publish`, with `id-token: write` on publish only) are in `npm-package-deployment`. The changesets-generated `CHANGELOG.md` entries replace the `git log` changelog; pass them to the GitHub Release body instead. Production approval still comes from the `environment:` on the publish job.

## Release assets

Attach the `.tgz` tarball(s) to the GitHub Release if useful for offline or air-gapped consumers.

## Post-publish smoke step

```bash
mkdir smoke && cd smoke && npm init -y
npm install <name>@${VERSION}
node -e "import('<name>').then(() => console.log('ok'))"
npm audit signatures
```

Assert exit code zero. Allow a short retry for registry propagation.

## Flow values

| Aspect | Stable (`release.yml`) | Preview (`preview.yml`) |
|--------|------------------------|-------------------------|
| Environment | `npm-production` (required reviewers) | `npm-preview` (auto-approve) |
| Dist-tag | `latest` | `next` / `beta` / `rc` |
| Audience | Default consumers | Opt-in via `npm install <pkg>@next` |

## Pitfalls

- **Trusted publisher bound to the wrong file or environment**: publish fails with 404/401. The workflow filename and environment on npmjs.com must match exactly; preview and production workflows each need their own binding.
- **`id-token: write` missing on the publish job**: OIDC and provenance silently fall back or fail.
- **Leftover `NPM_TOKEN` / `NODE_AUTH_TOKEN`**: can take precedence over OIDC. Remove it once trusted publishing works.
- **Prerelease without `--tag`**: npm 11 rejects it; older npm moves `latest` to the preview.
- **Rebuilding in the publish job**: publish the tarball from the build artifact.
- **No rollback plan**: document `npm dist-tag add <pkg>@<previous> latest` and `npm deprecate <pkg>@<bad> "<reason>"` in the workflow README; unpublishing is restricted and a version can never be reused.
