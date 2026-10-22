// The automatic handoff and keep-alive settle their settings the same way: no /config rows, the same
// committed-source trust wording, the same personal level. This checks the structure they share (the
// manifest, the schemas, the settings tables, the trust warning, the order of the levels in each skill);
// the wording of the prose is left to review.
// Run from the repository root: node --test "tests/**/*.test.mjs".
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PLUGIN = path.join(REPO, "plugins", "claude", "ai-dlc");
const read = (...p) => fs.readFileSync(path.join(PLUGIN, ...p), "utf8");
const AH = { skill: read("skills", "configure-auto-handoff", "SKILL.md"), cli: read("skills", "configure-auto-handoff", "templates", "auto-handoff.mjs"), schema: read("skills", "configure-auto-handoff", "templates", "auto-handoff.schema.json") };
const KA = { skill: read("skills", "cache-keepalive-config", "SKILL.md"), cli: read("skills", "cache-keepalive-config", "templates", "cache-keepalive.mjs"), schema: read("skills", "cache-keepalive-config", "templates", "cache-keepalive.schema.json") };

// The one check, for this runner, that no /config row is left (human decisions, 2026-10-22 and 2026-10-23,
// run AAW-20261022-cache-keepalive-init). The hooks module's own runner (claude plugin test) has its
// own one, in hooks/keepalive/tests/keepalive.test.ts.
test("no /config rows: the manifest declares no userConfig, neither schema has x-userConfig, neither settings table names userConfig", () => {
  assert.ok(!("userConfig" in JSON.parse(read(".claude-plugin", "plugin.json"))));
  for (const [name, s] of [["auto-handoff", AH.schema], ["cache-keepalive", KA.schema]]) {
    const props = JSON.parse(s).properties;
    const all = Object.values(props).flatMap((p) => p.properties ? Object.values(p.properties) : [p]);
    for (const p of all) assert.ok(!Object.keys(p).some((k) => /userconfig/i.test(k)), name);
  }
  for (const file of [["hooks", "auto-handoff", "config.ts"], ["hooks", "keepalive", "settings.ts"]]) assert.doesNotMatch(read(...file), /userConfig: '/, file.join("/"));
});

test("both CLIs warn about an untrusted folder with the same words and send the developer to settings.local.json", () => {
  const phrase = "Claude Code does not trust this folder";
  assert.ok(AH.cli.includes(phrase) && KA.cli.includes(phrase));
  assert.ok(AH.cli.includes("set them in the env of .claude/settings.local.json instead"));
  assert.ok(KA.cli.includes("set them in the env of .claude/settings.local.json instead"));
});

test("both skills put settings.local.json env first and the repository file below the settings env", () => {
  for (const [name, text] of [["auto-handoff", AH.skill], ["cache-keepalive", KA.skill]]) {
    const local = text.indexOf("`env` of `.claude/settings.local.json`");
    const shared = text.indexOf("`env` of `.claude/settings.json`");
    const repo = text.indexOf(name === "auto-handoff" ? "`.ai-dlc/auto-handoff.json`" : "`.ai-dlc/cache-keepalive.json`", shared);
    assert.ok(local > 0 && shared > local && repo > shared, name);
  }
});
