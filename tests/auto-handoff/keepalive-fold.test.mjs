// [T10] The keep-alive mod is folded into ai-dlc: no claude-mods / cache-keepalive dependency is left
// in the manifests, the marketplaces, CI or the repository's own settings.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (...p) => fs.readFileSync(path.join(REPO, ...p), "utf8");
const STALE = /claude-mods|"cache-keepalive"|cache-keepalive@/;

test("[T10] ai-dlc's manifest has no dependency on the cache-keepalive mod", () => {
  const manifest = JSON.parse(read("plugins", "claude", "ai-dlc", ".claude-plugin", "plugin.json"));
  const deps = (manifest.dependencies ?? []).map((d) => (typeof d === "string" ? d : d.name));
  assert.ok(!deps.some((d) => /cache-keepalive/.test(d)), `dependencies: ${JSON.stringify(deps)}`);
  assert.doesNotMatch(JSON.stringify(manifest), STALE);
});

test("[T10] the marketplaces, CI and .claude/settings.json name neither claude-mods nor cache-keepalive", () => {
  for (const file of [[".claude-plugin", "marketplace.json"], [".github", "plugin", "marketplace.json"], [".github", "workflows", "validate.yml"], [".claude", "settings.json"]]) {
    if (!fs.existsSync(path.join(REPO, ...file))) continue;
    assert.doesNotMatch(read(...file), STALE, file.join("/"));
  }
});
