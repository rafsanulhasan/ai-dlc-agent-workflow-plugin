# Layer Dependency Rule

Enforce that one layer must not depend on another. Example layout: `src/domain` ← `src/application` ← `src/infrastructure` / `src/api` (arrows point the allowed way).

```js
// .dependency-cruiser.cjs — inside `forbidden`
{
  name: 'domain-not-to-outer-layers',
  comment: 'The domain is the core: it must not know about use cases, adapters or transport.',
  severity: 'error',
  from: { path: '^src/domain/' },
  to: { path: '^src/(application|infrastructure|api)/' },
},
{
  name: 'application-not-to-adapters',
  comment: 'Use cases depend on ports (interfaces in application or domain), never on adapters.',
  severity: 'error',
  from: { path: '^src/application/' },
  to: { path: '^src/(infrastructure|api)/' },
},
{
  name: 'infrastructure-not-to-api',
  comment: 'Adapters must not reach into the HTTP layer.',
  severity: 'error',
  from: { path: '^src/infrastructure/' },
  to: { path: '^src/api/' },
},
```

`from.path` and `to.path` are regular expressions over the **resolved** file path, relative to where `depcruise` runs. Type-only imports count when `tsPreCompilationDeps` is `true`; that is what you want for a layer rule.

**Peer-module isolation** (one feature module must not reach into another's internals) uses a capture group and a backreference:

```js
{
  name: 'modules-only-through-public-index',
  comment: 'Another module is reachable only through its index.ts.',
  severity: 'error',
  from: { path: '^src/modules/([^/]+)/' },
  to: {
    path: '^src/modules/[^/]+/',
    pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/index\\.ts$'],
  },
},
```

`$1` in `to.path` / `to.pathNot` is the first group matched in `from.path`.

**Key patterns:**

- `from` + `to` with `path` — strict isolation between layers.
- `pathNot` — carve out the allowed exception (a public `index.ts`, a shared kernel).
- `to.circular: true` — no cycles (see `arch-standard-rules`).
