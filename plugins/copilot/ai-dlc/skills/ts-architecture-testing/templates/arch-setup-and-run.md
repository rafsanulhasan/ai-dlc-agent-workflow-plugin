# Setup and Run

Install dependency-cruiser and generate a starting config:

```bash
npm install --save-dev dependency-cruiser
npx depcruise --init
```

`--init` asks a few questions and writes `.dependency-cruiser.js` (or `.dependency-cruiser.cjs` when `package.json` has `"type": "module"`), with the standard rules (`no-circular`, `no-orphans`, `not-to-dev-dep`, ...) already in `forbidden`. It refuses to overwrite an existing file. Prefer the `.cjs` name: it works whatever the package type.

The options that matter for a TypeScript project:

```js
// .dependency-cruiser.cjs
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // the project's rules (arch-layer-dependency, arch-folder-residency, ...)
  ],
  options: {
    doNotFollow: { path: ['node_modules'] },
    tsConfig: { fileName: 'tsconfig.json' },   // resolves path aliases
    tsPreCompilationDeps: true,                // see type-only imports too
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
  },
};
```

Run it over the source folder:

```bash
npx depcruise src --config .dependency-cruiser.cjs --output-type err
```

The `err` reporter prints each violation and exits with the number of `error`-severity violations, so any error fails the step. `--output-type err-long` adds each rule's `comment` (the "why"); `mermaid` or `dot` draws the graph for a review.

```json
{
  "scripts": {
    "test:arch": "depcruise src --config .dependency-cruiser.cjs --output-type err-long"
  }
}
```

In a workspace (monorepo), cruise each package's `src` (or all of them: `depcruise packages/*/src`) with paths written relative to the folder you run it from.
