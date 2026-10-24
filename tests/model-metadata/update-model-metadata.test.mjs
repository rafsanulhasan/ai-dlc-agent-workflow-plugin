// Tests for the model-metadata hook script (plugins/claude/ai-dlc/skills/model-metadata/templates/update-model-metadata.mjs).
// No network: every page comes from tests/model-metadata/fixtures/, saved copies of Anthropic's docs pages
// (Markdown form) taken on 2026-10-23.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..");
const skillDir = path.join(repo, "plugins", "claude", "ai-dlc", "skills", "model-metadata");
const script = path.join(skillDir, "templates", "update-model-metadata.mjs");
const schema = JSON.parse(fs.readFileSync(path.join(skillDir, "templates", "model-metadata.schema.json"), "utf8"));
const m = await import(new URL(`file:///${script.replace(/\\/g, "/")}`).href);

const fixture = (name) => fs.readFileSync(path.join(here, "fixtures", name), "utf8");
const PRICING = fixture("pricing.md");

/** A fetch stub serving the fixtures; any other URL is a 404. Counts calls. */
function stubFetch(overrides = {}) {
  const pages = {
    [m.SOURCES.pricing]: PRICING,
    [m.SOURCES.models]: fixture("models-overview.md"),
    [m.SOURCES.deprecations]: fixture("model-deprecations.md"),
    [m.modelPageUrl("opus-5-5")]: fixture("model-opus-5-5.md"),
    [m.modelPageUrl("haiku-5-5")]: fixture("model-haiku-5-5.md"),
    [m.modelPageUrl("opus-4-5")]: fixture("model-opus-4-5.md"),
    [m.modelPageUrl("sonnet-4-5")]: fixture("model-sonnet-4-5.md"),
    ...overrides,
  };
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    const body = pages[url];
    if (body instanceof Error) throw body;
    if (typeof body === "number") return { ok: false, status: body, text: async () => "" };
    if (body == null) return { ok: false, status: 404, text: async () => "" };
    return { ok: true, status: 200, text: async () => body };
  };
  fn.calls = calls;
  return fn;
}

const tmpRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), "model-metadata-"));
const metadataFile = (root) => path.join(root, ".ai-dlc", "model-metadata.json");
const NOW = new Date("2026-10-23T12:00:00.000Z");

// ------------------------------------------------------------------------------------------------
// Parsers
// ------------------------------------------------------------------------------------------------

test("money and tokens read the docs' notation", () => {
  assert.equal(m.money("$0.20 / MTok<sup>2</sup>"), 0.2);
  assert.equal(m.money("$8 USD / MTok"), 8);
  assert.equal(m.money("$0.125 / MTok"), 0.125);
  assert.equal(m.money("n/a"), null);
  assert.equal(m.tokens("1M tokens"), 1_000_000);
  assert.equal(m.tokens("200K tokens"), 200_000);
  assert.equal(m.tokens("128,000 tokens"), 128_000);
  assert.equal(m.tokens("Not supported"), null);
});

test("pricing page: every model row, with all five standard prices", () => {
  const models = m.parsePricingPage(PRICING);
  assert.equal(models.size, 20, "21 rows, Claude Haiku 5.5's two rows merged into one model");
  for (const e of models.values()) {
    for (const k of ["input", "output", "cacheWrite5m", "cacheWrite1h", "cacheRead"]) {
      assert.equal(typeof e.pricing[k], "number", `${e.name} ${k}`);
    }
  }
  assert.deepEqual(models.get("opus-5-5").pricing, {
    input: 4, cacheWrite5m: 5, cacheWrite1h: 8, cacheRead: 0.2, output: 20,
    batchInput: 2, batchOutput: 10, fastInput: 8, fastOutput: 40,
  });
});

test("pricing page: footnote markers are stripped and notes kept", () => {
  const models = m.parsePricingPage(PRICING);
  assert.equal(models.get("sonnet-5").pricing.input, 2, "<sup>3</sup> is not part of the price");
  assert.equal(models.get("fable-5-1").pricing.cacheRead, 0.25);
  assert.equal(models.get("opus-4-1").note, "retired, except on Bedrock and Google Cloud");
  assert.equal(models.get("mythos-5-1").note, "limited availability");
  assert.equal(models.get("opus-4-5").note, null);
});

test("pricing page: a model priced by prompt length gets longContextPricing", () => {
  const haiku = m.parsePricingPage(PRICING).get("haiku-5-5");
  assert.equal(haiku.pricing.input, 0.1);
  assert.equal(haiku.pricing.batchInput, 0.05);
  assert.deepEqual(haiku.longContextPricing, {
    thresholdTokens: 100_000, input: 0.5, cacheWrite5m: 0.625, cacheWrite1h: 1, cacheRead: 0.05, output: 2.5,
    batchInput: 0.25, batchOutput: 1.25,
  });
  assert.equal(m.parsePricingPage(PRICING).get("opus-5-5").longContextPricing, null);
});

test("pricing page: a fast mode row naming two models prices both", () => {
  const models = m.parsePricingPage(PRICING);
  assert.equal(models.get("opus-5").pricing.fastInput, 10);
  assert.equal(models.get("opus-4-8").pricing.fastOutput, 50);
  assert.equal(models.get("opus-4-7").pricing.fastInput, null);
});

test("pricing page: a missing table or changed columns throws", () => {
  assert.throws(() => m.parsePricingPage("# Pricing\n\nNothing here.\n"), /no table under "Model pricing"/);
  const renamed = PRICING.replace("| Base input tokens", "| Input (base)");
  assert.throws(() => m.parsePricingPage(renamed), /unexpected columns/);
  const blank = PRICING.replace(/(\| Claude Opus 4\.7 +\| )\$5 \/ MTok/, "$1TBD");
  assert.throws(() => m.parsePricingPage(blank), /no input price for Claude Opus 4\.7/);
});

test("model page: ID, alias, context window and max output; unstated figures are null", () => {
  const opus45 = m.parseModelPage(fixture("model-opus-4-5.md"));
  assert.equal(opus45.name, "Claude Opus 4.5");
  assert.equal(opus45.id, "claude-opus-4-5-20251101");
  assert.equal(opus45.alias, "claude-opus-4-5");
  assert.equal(opus45.contextWindow, 200_000);
  assert.equal(opus45.maxOutputTokens, 64_000);
  assert.equal(opus45.maxInputTokens, null);
  assert.equal(opus45.longContextWindow, null);
  const opus55 = m.parseModelPage(fixture("model-opus-5-5.md"));
  assert.equal(opus55.id, "claude-opus-5-5");
  assert.equal(opus55.contextWindow, 1_000_000);
  assert.equal(opus55.maxOutputTokens, 128_000, "the Batch API beta row is not the max output");
});

test("model page: a long-context row and a max input row are read when a page has them", () => {
  const md = [
    "---", "title: Claude Example 9", "---", "", "Model ID: `claude-example-9`", "",
    "### Capabilities", "", "| Feature | Value |", "| :-- | :-- |",
    "| [Context window](x) | 200K tokens |", "| Context window (beta) | 1M tokens |",
    "| Max input | 180K tokens |", "| Max output | 64K tokens |", "",
  ].join("\n");
  const page = m.parseModelPage(md);
  assert.deepEqual(
    [page.contextWindow, page.longContextWindow, page.maxInputTokens, page.maxOutputTokens],
    [200_000, 1_000_000, 180_000, 64_000],
  );
});

test("model page: the summary line is used when there is no Capabilities table", () => {
  const md = "---\ntitle: Claude Example 9\n---\n\nModel ID: `claude-example-9`\n\nContext window: 200K tokens · Max output: 64K tokens · Input pricing: $1 / MTok\n";
  const page = m.parseModelPage(md);
  assert.equal(page.contextWindow, 200_000);
  assert.equal(page.maxOutputTokens, 64_000);
});

test("model names and IDs map to the same key", () => {
  assert.equal(m.nameKey("Claude Opus 4.5"), "opus-4-5");
  assert.equal(m.nameKey("Claude Opus 4"), "opus-4");
  assert.equal(m.nameKey("Claude Mythos Preview"), "mythos-preview");
  assert.equal(m.idKey("claude-opus-4-5-20251101"), "opus-4-5");
  assert.equal(m.idKey("claude-opus-4-20250514"), "opus-4");
  assert.equal(m.idKey("claude-opus-5"), "opus-5");
  assert.equal(m.idKey("claude-3-5-haiku-20241022"), "haiku-3-5");
  assert.equal(m.idKey("claude-instant-1.2"), null);
  assert.equal(m.datelessAlias("claude-sonnet-4-5-20250929"), "claude-sonnet-4-5");
  assert.equal(m.datelessAlias("claude-opus-4-20250514"), null, "no documented alias without a minor version");
  assert.equal(m.datelessAlias("claude-opus-5"), null);
});

test("deprecations page: status and IDs by key", () => {
  const byKey = m.parseDeprecationsPage(fixture("model-deprecations.md"));
  assert.deepEqual(byKey.get("opus-4-1"), [{ id: "claude-opus-4-1-20250805", status: "retired" }]);
  assert.deepEqual(byKey.get("sonnet-4-5"), [{ id: "claude-sonnet-4-5-20250929", status: "deprecated" }]);
  assert.deepEqual(byKey.get("opus-5-5"), [{ id: "claude-opus-5-5", status: "active" }]);
});

test("isGitCommit: Claude and Copilot payload shapes", () => {
  const claude = (command) => ({ hook_event_name: "PreToolUse", tool_input: { command } });
  assert.equal(m.isGitCommit(claude("git commit -m 'x'")), true);
  assert.equal(m.isGitCommit(claude("git add . && git commit -F msg.txt")), true);
  assert.equal(m.isGitCommit(claude("git -C repo commit --amend")), true);
  assert.equal(m.isGitCommit(claude("git status")), false);
  assert.equal(m.isGitCommit(claude("git commit-tree abc")), false);
  assert.equal(m.isGitCommit(claude("echo committed")), false);
  assert.equal(m.isGitCommit({ toolName: "bash", toolArgs: JSON.stringify({ command: "git commit -m x" }) }), true);
  assert.equal(m.isGitCommit({ toolName: "bash", toolArgs: { command: "git commit -m x" } }), true);
  assert.equal(m.isGitCommit({ toolName: "view", toolArgs: "{\"path\":\"a\"}" }), false);
  assert.equal(m.isGitCommit(null), false);
});

// ------------------------------------------------------------------------------------------------
// The run: write, keep, throttle
// ------------------------------------------------------------------------------------------------

test("run: creates a valid file with prices, limits and sources", async () => {
  const root = tmpRoot();
  const r = await m.run({ root, fetchImpl: stubFetch(), now: NOW });
  assert.equal(r.action, "updated");
  const doc = JSON.parse(fs.readFileSync(metadataFile(root), "utf8"));
  assert.deepEqual(m.validateMetadata(doc), []);
  assert.equal(doc.fetchedAt, NOW.toISOString());
  assert.equal(doc.source, "https://platform.claude.com/docs/en/about-claude/pricing");
  assert.equal(doc.models.length, 20);

  const byId = Object.fromEntries(doc.models.map((x) => [x.id, x]));
  const opus45 = byId["claude-opus-4-5-20251101"];
  assert.deepEqual(opus45.aliases, ["claude-opus-4-5"]);
  assert.equal(opus45.status, "active");
  assert.equal(opus45.contextWindow, 200_000);
  assert.equal(opus45.maxOutputTokens, 64_000);
  assert.equal(opus45.maxInputTokens, null);
  assert.equal(opus45.sources.metadata, "https://platform.claude.com/docs/en/models/opus-4-5/overview");
  assert.equal(opus45.pricing.cacheWrite5m, 6.25);
  assert.equal(opus45.pricing.cacheWrite1h, 10);

  // No page in the fixtures (a 404): ID from the deprecations page, limits null, never guessed.
  const opus41 = byId["claude-opus-4-1-20250805"];
  assert.equal(opus41.status, "retired");
  assert.equal(opus41.contextWindow, null);
  assert.equal(opus41.maxOutputTokens, null);
  assert.equal(opus41.sources.metadata, null);
  assert.equal(opus41.pricing.input, 15);

  assert.ok(byId["claude-3-5-haiku-20241022"], "legacy ID order (claude-3-5-haiku) matched to Claude Haiku 3.5");
  assert.equal(byId["claude-haiku-5-5"].longContextPricing.thresholdTokens, 100_000);
  assert.deepEqual(fs.readdirSync(path.join(root, ".ai-dlc")), ["model-metadata.json"], "no temp file left behind");
});

test("run: the file matches the schema's required keys", async () => {
  const root = tmpRoot();
  await m.run({ root, fetchImpl: stubFetch(), now: NOW });
  const doc = JSON.parse(fs.readFileSync(metadataFile(root), "utf8"));
  assert.deepEqual(Object.keys(doc).filter((k) => k !== "$schema").sort(), [...schema.required].sort());
  const model = schema.$defs.model;
  for (const x of doc.models) {
    assert.deepEqual(Object.keys(x).sort(), [...model.required].sort(), x.id);
    assert.deepEqual(Object.keys(x.pricing).sort(), [...model.properties.pricing.required].sort(), x.id);
    if (x.longContextPricing) assert.deepEqual(Object.keys(x.longContextPricing).sort(), [...model.properties.longContextPricing.oneOf[1].required].sort());
  }
});

for (const [label, overrides] of [
  ["a network error", { [m.SOURCES.pricing]: new TypeError("fetch failed") }],
  ["an HTTP 503", { [m.SOURCES.pricing]: 503 }],
  ["a pricing page that changed shape", { [m.SOURCES.pricing]: "# Pricing\n\nMoved.\n" }],
  ["a model page that fails mid-run", { [m.modelPageUrl("opus-5-5")]: new Error("socket hang up") }],
  ["a pricing page with too few models", { [m.SOURCES.pricing]: PRICING.split("\n").filter((l) => !/^\| Claude (Opus|Sonnet|Haiku|Mythos)/.test(l)).join("\n") }],
]) {
  test(`run: ${label} keeps the old file byte for byte`, async () => {
    const root = tmpRoot();
    fs.mkdirSync(path.join(root, ".ai-dlc"));
    const old = "{\n  \"version\": 1,\n  \"note\": \"old content\"\n}\n";
    fs.writeFileSync(metadataFile(root), old);
    const stale = new Date(NOW.getTime() - 3 * 3600_000);
    fs.utimesSync(metadataFile(root), stale, stale);

    const r = await m.run({ root, fetchImpl: stubFetch(overrides), now: NOW });
    assert.equal(r.action, "failed");
    assert.match(r.message, /kept the old file/);
    assert.equal(fs.readFileSync(metadataFile(root), "utf8"), old);
    assert.deepEqual(fs.readdirSync(path.join(root, ".ai-dlc")), ["model-metadata.json"]);
    // Retries in 10 minutes, not on every stop: the failure is stamped outside the repository.
    assert.equal(fs.statSync(m.retryStampPath(root)).mtimeMs, NOW.getTime());
    const again = stubFetch();
    assert.equal((await m.run({ root, fetchImpl: again, now: new Date(NOW.getTime() + 9 * 60_000) })).action, "skipped");
    assert.equal(again.calls.length, 0);
    fs.rmSync(m.retryStampPath(root), { force: true });
  });
}

test("run: a failure with no file writes nothing", async () => {
  const root = tmpRoot();
  const r = await m.run({ root, fetchImpl: stubFetch({ [m.SOURCES.pricing]: new TypeError("fetch failed") }), now: NOW });
  assert.equal(r.action, "failed");
  assert.match(r.message, /no file written/);
  assert.equal(fs.existsSync(metadataFile(root)), false);
});

test("run: within the refresh interval nothing is fetched", async () => {
  const root = tmpRoot();
  await m.run({ root, fetchImpl: stubFetch(), now: NOW });
  const fetch = stubFetch();
  const later = new Date(NOW.getTime() + 30 * 60_000);
  fs.utimesSync(metadataFile(root), NOW, NOW);
  assert.equal((await m.run({ root, fetchImpl: fetch, now: later, maxAgeMinutes: 60 })).action, "skipped");
  assert.equal(fetch.calls.length, 0);
  assert.equal((await m.run({ root, fetchImpl: fetch, now: later, maxAgeMinutes: 60, force: true })).action, "unchanged");
  assert.ok(fetch.calls.length > 0);
});

test("run: a refetch with the same figures leaves the content alone and touches the clock", async () => {
  const root = tmpRoot();
  await m.run({ root, fetchImpl: stubFetch(), now: NOW });
  const before = fs.readFileSync(metadataFile(root), "utf8");
  const later = new Date(NOW.getTime() + 2 * 3600_000);
  const r = await m.run({ root, fetchImpl: stubFetch(), now: later });
  assert.equal(r.action, "unchanged");
  assert.equal(fs.readFileSync(metadataFile(root), "utf8"), before, "fetchedAt not bumped: no commit churn");
  assert.equal(Math.round(fs.statSync(metadataFile(root)).mtimeMs / 1000), Math.round(later.getTime() / 1000));
});

test("run: a changed price rewrites the file", async () => {
  const root = tmpRoot();
  await m.run({ root, fetchImpl: stubFetch(), now: NOW });
  const later = new Date(NOW.getTime() + 2 * 3600_000);
  const cheaper = PRICING.replace(/(\| Claude Opus 4\.7 +\| )\$5 \/ MTok/, (_, cell) => `${cell}$4 / MTok`);
  const r = await m.run({ root, fetchImpl: stubFetch({ [m.SOURCES.pricing]: cheaper }), now: later });
  assert.equal(r.action, "updated");
  const doc = JSON.parse(fs.readFileSync(metadataFile(root), "utf8"));
  assert.equal(doc.fetchedAt, later.toISOString());
  assert.equal(doc.models.find((x) => x.id === "claude-opus-4-7").pricing.input, 4);
});

// ------------------------------------------------------------------------------------------------
// The hook entry point (child process; never reaches the network)
// ------------------------------------------------------------------------------------------------

const hook = (args, payload, env = {}) => spawnSync(process.execPath, [script, ...args], {
  input: payload == null ? "" : JSON.stringify(payload),
  encoding: "utf8",
  env: { ...process.env, CLAUDE_PROJECT_DIR: "", AI_DLC_MODEL_METADATA_LONG_CONTEXT_THRESHOLD_TOKENS: "", ...env },
  timeout: 20_000,
});

test("hook: --before-commit ignores a tool call that is not a git commit", () => {
  const root = tmpRoot();
  const r = hook(["--before-commit", "--root", root], { hook_event_name: "PreToolUse", tool_input: { command: "npm test" } });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
  assert.equal(r.stderr, "");
  assert.equal(fs.existsSync(metadataFile(root)), false);
});

test("hook: AI_DLC_MODEL_METADATA=off does nothing", () => {
  const root = tmpRoot();
  const r = hook(["--root", root], { hook_event_name: "Stop" }, { AI_DLC_MODEL_METADATA: "off" });
  assert.equal(r.status, 0);
  assert.equal(r.stdout + r.stderr, "");
  assert.equal(fs.existsSync(metadataFile(root)), false);
});

test("hook: with an interval set, a fresh file is not refetched (exit 0, silent)", () => {
  const root = tmpRoot();
  fs.mkdirSync(path.join(root, ".ai-dlc"));
  fs.writeFileSync(metadataFile(root), "{}\n");
  const r = hook(["--root", root], { hook_event_name: "Stop" }, { AI_DLC_MODEL_METADATA_MAX_AGE_MINUTES: "60" });
  assert.equal(r.status, 0);
  assert.equal(r.stdout + r.stderr, "");
  assert.equal(fs.readFileSync(metadataFile(root), "utf8"), "{}\n");
});

// ------------------------------------------------------------------------------------------------
// Install templates
// ------------------------------------------------------------------------------------------------

test("hook templates: Claude and Copilot run the same commands, as entries of their own", () => {
  const claude = JSON.parse(fs.readFileSync(path.join(skillDir, "templates", "claude-hook.json"), "utf8"));
  const copilot = JSON.parse(fs.readFileSync(path.join(skillDir, "templates", "copilot-hook.json"), "utf8"));
  assert.equal(claude.hooks.Stop.length, 1);
  assert.equal(claude.hooks.PreToolUse[0].matcher, "Bash");
  const stop = claude.hooks.Stop[0].hooks[0].command;
  const pre = claude.hooks.PreToolUse[0].hooks[0].command;
  // Rooted at the project, so a Bash call made after a `cd` still finds the script.
  assert.equal(stop, 'node "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/update-model-metadata.mjs"');
  assert.equal(pre, 'node "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/update-model-metadata.mjs" --before-commit');
  assert.equal(copilot.version, 1);
  // Copilot: the same bash command (the harness sync matches on it), run from the repository root.
  assert.deepEqual([copilot.hooks.agentStop[0].bash, copilot.hooks.agentStop[0].powershell, copilot.hooks.agentStop[0].cwd], [stop, "node .claude/hooks/update-model-metadata.mjs", "."]);
  assert.deepEqual([copilot.hooks.preToolUse[0].bash, copilot.hooks.preToolUse[0].powershell, copilot.hooks.preToolUse[0].cwd], [pre, "node .claude/hooks/update-model-metadata.mjs --before-commit", "."]);
});

test("this repository runs the installed copies of the templates", () => {
  const same = (installed, template) => assert.equal(
    fs.readFileSync(path.join(repo, installed), "utf8").replace(/\r\n/g, "\n"),
    fs.readFileSync(path.join(skillDir, "templates", template), "utf8").replace(/\r\n/g, "\n"),
    `${installed} differs from templates/${template}: copy the template again`,
  );
  same(".claude/hooks/update-model-metadata.mjs", "update-model-metadata.mjs");
  same(".ai-dlc/model-metadata.schema.json", "model-metadata.schema.json");
  same(".github/hooks/ai-dlc-model-metadata.json", "copilot-hook.json");
  const settings = JSON.parse(fs.readFileSync(path.join(repo, ".claude", "settings.json"), "utf8"));
  const commands = (event) => (settings.hooks?.[event] ?? []).flatMap((g) => (g.hooks ?? []).map((h) => [g.matcher ?? null, h.command, g.hooks.length]));
  const claudeHook = JSON.parse(fs.readFileSync(path.join(skillDir, "templates", "claude-hook.json"), "utf8"));
  assert.deepEqual(commands("Stop").filter(([, c]) => /update-model-metadata/.test(c)), [[null, claudeHook.hooks.Stop[0].hooks[0].command, 1]]);
  assert.deepEqual(commands("PreToolUse").filter(([, c]) => /update-model-metadata/.test(c)), [["Bash", claudeHook.hooks.PreToolUse[0].hooks[0].command, 1]]);
  const doc = JSON.parse(fs.readFileSync(path.join(repo, ".ai-dlc", "model-metadata.json"), "utf8"));
  assert.deepEqual(m.validateMetadata(doc), []);
});
