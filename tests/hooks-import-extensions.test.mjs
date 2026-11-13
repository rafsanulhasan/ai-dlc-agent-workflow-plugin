// Regression guard for the 63.x host break: from Claude Code 2.1.323, `claude plugin validate --strict` type-checks
// every .ts / .tsx file of a plugin's hooks module with the engine's own options, which refuse a relative import
// path that ends in `.ts` / `.tsx` (TS5097); the plugin's tsconfig has no effect. So hooks files import each other
// without an extension. Dropping an extension back in fails validate on 2.1.323 but not on 2.1.322, so only this
// test catches it on an older host.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const plugins = ["plugins/claude/ai-dlc", "plugins/claude/ai-dlc-lens"];

// A relative specifier (`./` or `../`) ending in .ts / .tsx, in a static import, `export ... from`, or import().
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*)(['"])(\.\.?\/[^'"\n]*\.tsx?)\1/g;

function extensionImports(source) {
  return [...source.matchAll(SPECIFIER)].map((m) => m[2]);
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(name) && !name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

test("[63.x] the scanner flags a relative .ts / .tsx import and nothing else", () => {
  assert.deepEqual(extensionImports(`import { a } from './x.ts'`), ["./x.ts"]);
  assert.deepEqual(extensionImports(`import type { A } from "../y/z.tsx"`), ["../y/z.tsx"]);
  assert.deepEqual(extensionImports(`export * from './x.ts'`), ["./x.ts"]);
  assert.deepEqual(extensionImports(`import './side.ts'`), ["./side.ts"]);
  assert.deepEqual(extensionImports(`const m = await import('./lazy.ts')`), ["./lazy.ts"]);
  assert.deepEqual(extensionImports(`import { a } from './x'`), []);
  assert.deepEqual(extensionImports(`import { a } from 'node:fs'`), []);
  assert.deepEqual(extensionImports(`import { a } from 'pkg/file.ts'`), []);
  assert.deepEqual(extensionImports(`import d from './data.json'`), []);
});

for (const plugin of plugins) {
  test(`[63.x] ${plugin}/hooks has no relative import ending in .ts or .tsx`, () => {
    const dir = join(root, plugin, "hooks");
    const files = walk(dir);
    assert.ok(files.length > 0, `no .ts / .tsx files found under ${dir}`);
    const offenders = [];
    for (const file of files) {
      for (const spec of extensionImports(readFileSync(file, "utf8"))) {
        offenders.push(`${relative(root, file)}: ${spec}`);
      }
    }
    assert.deepEqual(offenders, [], "hooks files must import each other without a .ts / .tsx extension (TS5097 on Claude Code 2.1.323+)");
  });
}
