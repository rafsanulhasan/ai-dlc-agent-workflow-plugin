// Preload (node --import) for the hook child-process tests: replaces globalThis.fetch so no run reaches the network.
// MC_STUB_MODE=ok serves the saved docs pages in ./fixtures (any other URL is a 404); MC_STUB_MODE=fail rejects every request.
// MC_STUB_LOG, when set, is a file each requested URL is appended to.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DOCS = "https://platform.claude.com/docs/en";
const files = {
  [`${DOCS}/about-claude/pricing.md`]: "pricing.md",
  [`${DOCS}/models/overview.md`]: "models-overview.md",
  [`${DOCS}/about-claude/model-deprecations.md`]: "model-deprecations.md",
  [`${DOCS}/models/opus-5-5/overview.md`]: "model-opus-5-5.md",
  [`${DOCS}/models/haiku-5-5/overview.md`]: "model-haiku-5-5.md",
  [`${DOCS}/models/opus-4-5/overview.md`]: "model-opus-4-5.md",
  [`${DOCS}/models/sonnet-4-5/overview.md`]: "model-sonnet-4-5.md",
};

globalThis.fetch = async (url) => {
  if (process.env.MC_STUB_LOG) fs.appendFileSync(process.env.MC_STUB_LOG, `${url}\n`);
  if (process.env.MC_STUB_MODE === "fail") throw new TypeError("fetch failed (stub)");
  const f = files[String(url)];
  if (!f) return { ok: false, status: 404, text: async () => "" };
  const body = fs.readFileSync(path.join(here, "fixtures", f), "utf8");
  return { ok: true, status: 200, text: async () => body };
};
