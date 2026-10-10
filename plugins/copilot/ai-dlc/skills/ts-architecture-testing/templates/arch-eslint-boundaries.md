# Alternative: eslint-plugin-boundaries

Use it when the repository wants layer rules reported in the editor as lint errors. It checks imports file by file; it does not detect cycles or orphans, so keep dependency-cruiser (or `import/no-cycle`) for those.

```bash
npm install --save-dev eslint-plugin-boundaries eslint-import-resolver-typescript
```

```js
// eslint.config.js
import boundaries from 'eslint-plugin-boundaries';

export default [
  {
    files: ['src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: { alwaysTryTypes: true } },
      'boundaries/elements': [
        { type: 'domain', pattern: 'src/domain/*' },
        { type: 'application', pattern: 'src/application/*' },
        { type: 'infrastructure', pattern: 'src/infrastructure/*' },
        { type: 'api', pattern: 'src/api/*' },
      ],
    },
    rules: {
      'boundaries/no-unknown-files': 'error',
      'boundaries/dependencies': ['error', {
        default: 'disallow',
        policies: [
          { from: { element: { type: 'domain' } }, allow: { to: { element: { type: 'domain' } } } },
          { from: { element: { type: 'application' } }, allow: { to: { element: { type: ['domain', 'application'] } } } },
          { from: { element: { type: 'infrastructure' } }, allow: { to: { element: { type: ['domain', 'application', 'infrastructure'] } } } },
          { from: { element: { type: 'api' } }, allow: { to: { element: { type: ['domain', 'application', 'api'] } } } },
        ],
      }],
    },
  },
];
```

Version notes (v7): `boundaries/element-types` is now `boundaries/dependencies`, and the `rules` option is now `policies`; the old names still work with deprecation warnings. Match the plugin version the repository has.

`boundaries/no-unknown-files` fails any source file that matches no element — a coarse folder-residency check.
