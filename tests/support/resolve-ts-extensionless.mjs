// Lets a Node test import a hooks module file (`.ts` / `.tsx`) whose relative imports carry no extension.
// Since Claude Code 2.1.323, `claude plugin validate --strict` type-checks a plugin's hooks with the engine's own
// options, which refuse a `.ts` import path (TS5097), so the hooks modules import each other without one, as the
// engine's loader allows. Node's resolver needs the extension: this hook tries `.ts`, then `.tsx`, for a relative
// specifier with no extension that Node could not find, and changes nothing else.
// Import it first in a test that imports a hooks module: import "../support/resolve-ts-extensionless.mjs".
import nodeModule from "node:module";

const EXTENSIONLESS_RELATIVE = /^\.\.?\/(?:[^/]+\/)*[^/.]+$/;

// registerHooks is Node 22.15 / 23.5 and later; the suites that import TypeScript need 22.18 and skip below it.
nodeModule.registerHooks?.({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (err?.code !== "ERR_MODULE_NOT_FOUND" || !EXTENSIONLESS_RELATIVE.test(specifier)) throw err;
      for (const ext of [".ts", ".tsx"]) {
        try {
          return nextResolve(specifier + ext, context);
        } catch {}
      }
      throw err;
    }
  },
});
