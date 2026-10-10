---
name: node-rules
description: "Installs the AI-DLC JavaScript / TypeScript rules into the current repository: coding style (strict TypeScript, no any, ESM, naming), module and import boundaries, async and error handling, and the test / Stryker testing gates, as Claude rules (.claude/rules) with identical GitHub Copilot instruction twins (.github/instructions). Optionally sets up a Husky + lint-staged pre-commit hook, with consent. Called by init when it detects a Node.js project; run it directly to add, repair or update the rules. Only for repositories that contain a package.json."
disable-model-invocation: true
---

# JavaScript / TypeScript rules

These rules are specific to JavaScript and TypeScript, so they are installed only into Node.js repositories, never into other stacks. The files come from `${CLAUDE_SKILL_DIR}/templates/`. They cover Node.js, TypeScript and plain JavaScript; TypeScript-only lines say so and do not apply to a JavaScript-only repository.

## When to use

- `init` uses this skill when Phase 0 finds a `package.json` at the repository root or in a workspace package (outside `node_modules/`).
- The user asks to add, repair or update the JavaScript / TypeScript rules, or to add a pre-commit hook.

If the repository has no `package.json`, stop and say so: do not install the rules.

## What gets installed

| Rule | Claude (`.claude/rules/`) | Copilot (`.github/instructions/`) | Applies to |
|---|---|---|---|
| Coding style (strict `tsconfig`, no `any`, ESM, naming, the repo's own formatter and linter) | `node-coding-style.md` | `node-coding-style.instructions.md` | `*.ts`, `*.tsx`, `*.mts`, `*.cts`, `*.js`, `*.jsx`, `*.mjs`, `*.cjs` |
| Modules and imports (module system, `node:` built-ins, entry-point boundaries, no barrel files, no cycles) | `node-modules.md` | `node-modules.instructions.md` | same |
| Async and error handling (the project's return shape, no floating promises, `Error` with `cause`) | `node-async-errors.md` | `node-async-errors.instructions.md` | same |
| Testing gates (test command, then Stryker; test runner and test location; artifact-only changes exempt) | `node-testing.md` | `node-testing.instructions.md` | everything |

The file names carry a `node-` prefix so they can sit next to the .NET rules (`dotnet-rules`) in a repository that has both stacks.

The rules never impose a formatter or linter: they tell agents to use the ESLint, Prettier or Biome configuration the repository already has.

## Install

1. Confirm the repository is a Node.js project (see above).
2. If `init` collected different test / mutation commands, replace `npm test` and `npx stryker run` in both `node-testing` files with those commands (for example `pnpm test`, `yarn test`, `bun run test`).
3. If the repository has no TypeScript (no `tsconfig*.json` and no `typescript` dependency), keep the files as they are; their TypeScript-only lines are worded so they do not apply.
4. For each file in `templates/rules/`, write it to `.claude/rules/`; for each file in `templates/instructions/`, write it to `.github/instructions/`. Create the folders if needed.
5. For a file that already exists and differs, show a unified diff of the proposed merge and write only with the user's consent. Never delete rules the project already has.
6. Keep each rule and its Copilot twin identical in body; only the frontmatter differs (`paths` vs `applyTo`).
7. Offer the optional pre-commit hook below. Skip the offer when a pre-commit setup already exists.

## Pre-commit hook (optional, consent required)

A Git pre-commit hook that formats and lints the staged files, type-checks and runs the tests, so broken code never reaches a commit. Ask before doing any of this; it adds dev dependencies and changes `package.json`.

1. **Skip when one exists.** Stop and report "pre-commit already set up" if any of these is present: a `.husky/` folder; a lint-staged config (a `"lint-staged"` key in `package.json`, `.lintstagedrc*` or `lint-staged.config.*`); `lefthook.yml` / `.lefthook.yml`; a `"simple-git-hooks"` key in `package.json`; `.pre-commit-config.yaml`; a non-sample `.git/hooks/pre-commit`; or `git config core.hooksPath` set.
2. **Detect the package manager** by lockfile: `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb` or `bun.lock` → bun, else npm. Use it for every command:

   | Manager | Add dev dependency | Run a binary | Run a script |
   |---|---|---|---|
   | npm | `npm install --save-dev` | `npx` | `npm run` |
   | pnpm | `pnpm add --save-dev` | `pnpm exec` | `pnpm run` |
   | yarn | `yarn add --dev` | `yarn` | `yarn run` |
   | bun | `bun add --dev` | `bunx` | `bun run` |

3. **Pick the staged-file tasks from the existing tooling**; never add a tool the repository does not use:
   - Biome configured (`biome.json` / `biome.jsonc`): `"*": "biome check --write --no-errors-on-unmatched --files-ignore-unknown=true"`.
   - Otherwise Prettier configured (a `.prettierrc*`, `prettier.config.*`, or a `"prettier"` key in `package.json`): `"*": "prettier --ignore-unknown --write"`.
   - ESLint configured (`eslint.config.*` or `.eslintrc*`) and not Biome: add `"*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}": "eslint --fix"`.
   - Neither formatter nor linter: ask whether to add Prettier with its defaults or to skip the formatting step. Do not choose for the user.
4. **Install** `husky` and `lint-staged` as dev dependencies (plus `prettier` only if the user chose it in step 3). Check that the installed lint-staged and Husky versions support the repository's Node.js version (their `engines` field); if not, install the latest major that does and say so. Minimums from the npm registry: lint-staged 17.x needs Node ≥ 22.22.1, 16.x needs ≥ 20.17, 15.x needs ≥ 18.12; Husky 9.x needs Node ≥ 18. So pick lint-staged 16 for a Node 20 repository and 15 for Node 18.
5. **Initialise Husky.** npm: `npx husky init`; pnpm: `pnpm exec husky init`; bun: `bunx husky init`. These set `"prepare": "husky"` and create `.husky/pre-commit`. Yarn has no `init`: add `"postinstall": "husky"` (and, for a published non-private package, `pinst` with `"prepack": "pinst --disable"` / `"postpack": "pinst --enable"`), then create `.husky/pre-commit` yourself. If `package.json` is not at the Git root, set `"prepare": "cd <relative-path-to-git-root> && husky <package-dir>/.husky"` and start the hook with `cd <package-dir>`.
6. **Write `.lintstagedrc.json`** with the tasks from step 3.
7. **Write `.husky/pre-commit`** (POSIX `sh`, no shebang needed), one command per line, using the detected manager:

   ```sh
   <run-binary> lint-staged
   <type-check>
   <confirmed test command>
   ```

   `<type-check>` is the `typecheck` script when `package.json` has one (`<run-script> typecheck`), else `<run-binary> tsc --noEmit` for TypeScript; omit it for JavaScript-only repositories. Use the test command confirmed at `init` (else `<run-script> test`); omit it and tell the user if there is no test script.
8. **Verify.** Run `<run-binary> lint-staged` once and show the result. Do not commit: tell the user the hook runs on their next commit, and that `HUSKY=0` disables it (for example in CI).

**Done when:** `.husky/pre-commit`, `.lintstagedrc.json` and the `prepare` (or `postinstall`) script exist, and `lint-staged` ran without error, or the step was skipped with a reason.

## Report

List each file created, merged or left unchanged, and whether the pre-commit hook was installed, skipped (with the reason) or declined.

Adapted in part from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT).
