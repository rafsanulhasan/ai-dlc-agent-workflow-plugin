---
name: resvg-js-upstream-tag
description: resvg-js / @resvg/resvg-wasm source tag, commit and licence (verified 2026-11-13)
metadata:
  type: reference
---

@resvg/resvg-wasm 2.6.2 (npm, MPL-2.0) is built from upstream tag v2.6.2 of https://github.com/yisibl/resvg-js, which points at commit 9ca058462ac529120c8cc84ddcd6fef644cc5406 (commit title "2.6.2"). The npm metadata gitHead matches this SHA.

- Stable line: npm dist-tag `latest` is 2.6.2; the upstream tag list tops out at v2.7.0-alpha.2 (alpha, not stable).
- Sources: https://registry.npmjs.org/@resvg/resvg-wasm/2.6.2, https://github.com/yisibl/resvg-js/releases/tag/v2.6.2, https://github.com/yisibl/resvg-js/tags.
- Context7 was not available in that session; the npm registry and GitHub pages were the primary sources.
- Not checked: byte-identity of the vendored files in `plugins/claude/ai-dlc-lens/renderer/vendor/` to the npm tarball (no shell available to hash them).

- Engine (verified 2026-11-13): wasm target uses resvg 0.34.x, patched via [patch.crates-io] to fork github.com/zimond/resvg rev 3495d870 (its crates/resvg = 0.34.1, MPL-2.0; upstream RazrFalcon/resvg tag v0.34.1 = 341c979). Cargo.lock is gitignored in resvg-js, so transitive versions are not pinned by the repo; fork's Cargo.lock lists the resvg subtree. woff2 0.3.0 patched to fork yisibl/woff2-rs (Apache-2.0). Licences are all permissive except MPL-2.0 (resvg/usvg*) and BSD-3-Clause (tiny-skia, brotli, alloc-*).

**Why:** the tier-1 G4 needed the source tag settled; earlier research (17.1.48) left it unverified.

**How to apply:** when a notice or ATTRIBUTION entry for resvg-js is checked, the tag and licence above are the verified values. Re-verify the registry `latest` tag before quoting it as current.
