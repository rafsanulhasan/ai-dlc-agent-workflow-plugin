// Round 2 (after fix round 1): back-off stamp edge cases, long-context threshold, empty-root fallback, old names gone.
// No network: fetch is always a stub or the stub-fetch preload.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..");
const script = path.join(repo, "plugins", "claude", "ai-dlc", "skills", "model-metadata", "templates", "update-model-metadata.mjs");
const stub = pathToFileURL(path.join(here, "stub-fetch.mjs")).href;
const m = await import(pathToFileURL(script).href);

const fixture = (n) => fs.readFileSync(path.join(here, "fixtures", n), "utf8");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "model-metadata-r2-"));
const dataFile = (root) => path.join(root, ".ai-dlc", "model-metadata.json");
const NOW = new Date("2026-10-23T12:00:00.000Z");
const later = (min) => new Date(NOW.getTime() + min * 60_000);

function stubFetch(overrides = {}) {
  const pages = {
    [m.SOURCES.pricing]: fixture("pricing.md"),
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
const failing = () => stubFetch({ [m.SOURCES.pricing]: new TypeError("fetch failed") });

function hook(args, payload, env = {}, cwd = tmp()) {
  return spawnSync(process.execPath, ["--import", stub, script, ...args], {
    input: payload == null ? "" : JSON.stringify(payload),
    encoding: "utf8",
    cwd,
    env: Object.fromEntries(Object.entries({ ...process.env, CLAUDE_PROJECT_DIR: undefined, AI_DLC_MODEL_METADATA: "", AI_DLC_MODEL_METADATA_MAX_AGE_MINUTES: "", AI_DLC_MODEL_METADATA_LONG_CONTEXT_THRESHOLD_TOKENS: undefined, ANTHROPIC_API_KEY: undefined, MC_STUB_MODE: "ok", ...env }).filter(([, v]) => v !== undefined)),
    timeout: 30_000,
  });
}

// ---- Back-off stamp ------------------------------------------------------------------------------------

test("stamp: the default stamp path is written on failure, skips inside the window, and is removed on success", async () => {
  const root = tmp();
  const stamp = m.retryStampPath(root);
  try {
    assert.equal((await m.run({ root, fetchImpl: failing(), now: NOW })).action, "failed");
    assert.equal(fs.statSync(stamp).mtimeMs, NOW.getTime());
    assert.equal((await m.run({ root, fetchImpl: stubFetch(), now: later(2) })).action, "skipped");
    assert.equal((await m.run({ root, fetchImpl: stubFetch(), now: later(11) })).action, "updated");
    assert.equal(fs.existsSync(stamp), false);
  } finally { fs.rmSync(stamp, { force: true }); }
});

test("stamp: keyed per root, so another repository is not held back", async () => {
  const a = tmp(), b = tmp();
  const sa = m.retryStampPath(a), sb = m.retryStampPath(b);
  try {
    await m.run({ root: a, fetchImpl: failing(), now: NOW });
    assert.ok(fs.existsSync(sa));
    assert.equal(fs.existsSync(sb), false, "root b has no stamp");
    const fb = stubFetch();
    assert.equal((await m.run({ root: b, fetchImpl: fb, now: later(1) })).action, "updated", "b fetches although a is backing off");
    assert.ok(fb.calls.length > 0);
    assert.equal((await m.run({ root: a, fetchImpl: stubFetch(), now: later(1) })).action, "skipped", "a is still backing off");
  } finally { fs.rmSync(sa, { force: true }); fs.rmSync(sb, { force: true }); }
});

test("stamp: nothing is written into the repository when no file exists and the fetch fails", async () => {
  const root = tmp();
  await m.run({ root, fetchImpl: failing(), now: NOW, retryStamp: path.join(tmp(), "s.retry") });
  assert.deepEqual(fs.readdirSync(root), []);
});

test("stamp: an unwritable stamp location does not throw; failure is reported and the next run retries", async () => {
  const root = tmp();
  const blocker = path.join(tmp(), "afile");
  fs.writeFileSync(blocker, "x");
  const retryStamp = path.join(blocker, "sub", "s.retry"); // parent is a regular file
  const r = await m.run({ root, fetchImpl: failing(), now: NOW, retryStamp });
  assert.equal(r.action, "failed");
  assert.match(r.message, /no file written/);
  const again = stubFetch();
  assert.equal((await m.run({ root, fetchImpl: again, now: later(1), retryStamp })).action, "updated", "no stamp, so no back-off");
  assert.ok(again.calls.length > 0);
});

test("stamp: an unwritable stamp location does not break a successful run", async () => {
  const root = tmp();
  const blocker = path.join(tmp(), "afile");
  fs.writeFileSync(blocker, "x");
  const r = await m.run({ root, fetchImpl: stubFetch(), now: NOW, retryStamp: path.join(blocker, "s.retry") });
  assert.equal(r.action, "updated");
});

test("stamp: a failed write of the data file with no file also stamps", async () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, ".ai-dlc"), "x"); // .ai-dlc is a regular file: mkdir fails
  const retryStamp = path.join(tmp(), "s.retry");
  const r = await m.run({ root, fetchImpl: stubFetch(), now: NOW, retryStamp });
  assert.equal(r.action, "failed");
  assert.equal(fs.statSync(retryStamp).mtimeMs, NOW.getTime());
});

test("stamp: with a file present a fresh stamp still holds the run back; the file's age does not lift it", async () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, ".ai-dlc"));
  fs.writeFileSync(dataFile(root), "{}\n");
  const old = new Date(NOW.getTime() - 3 * 3600_000);
  fs.utimesSync(dataFile(root), old, old);
  const retryStamp = path.join(tmp(), "s.retry");
  fs.writeFileSync(retryStamp, ""); fs.utimesSync(retryStamp, NOW, NOW);
  const f = stubFetch();
  assert.equal((await m.run({ root, fetchImpl: f, now: later(1), retryStamp, maxAgeMinutes: 60 })).action, "skipped");
  assert.equal(f.calls.length, 0);
  const r = await m.run({ root, fetchImpl: failing(), now: later(10), retryStamp, maxAgeMinutes: 60 });
  assert.equal(r.action, "failed");
  assert.match(r.message, /kept the old file/);
});

test("stamp: a stamp dated in the future (clock moved back) does not block a retry", async () => {
  const root = tmp();
  const retryStamp = path.join(tmp(), "s.retry");
  fs.writeFileSync(retryStamp, ""); fs.utimesSync(retryStamp, later(30), later(30));
  assert.equal((await m.run({ root, fetchImpl: stubFetch(), now: NOW, retryStamp })).action, "updated");
});

test("stamp: with a long interval, just under 10 minutes is skipped and exactly 10 retries", async () => {
  const root = tmp();
  const retryStamp = path.join(tmp(), "s.retry");
  await m.run({ root, fetchImpl: failing(), now: NOW, retryStamp, maxAgeMinutes: 120 });
  assert.equal((await m.run({ root, fetchImpl: stubFetch(), now: new Date(NOW.getTime() + 599_999), retryStamp, maxAgeMinutes: 120 })).action, "skipped");
  assert.equal((await m.run({ root, fetchImpl: stubFetch(), now: later(10), retryStamp, maxAgeMinutes: 120 })).action, "updated");
});

// ---- Long-context threshold ------------------------------------------------------------------------------

test("threshold: a stated threshold is a number in the written file; a model with no long-context row has null", async () => {
  const root = tmp();
  await m.run({ root, fetchImpl: stubFetch(), now: NOW, retryStamp: path.join(tmp(), "s") });
  const doc = JSON.parse(fs.readFileSync(dataFile(root), "utf8"));
  assert.equal(doc.models.find((x) => x.id.startsWith("claude-haiku-5-5")).longContextPricing.thresholdTokens, 100_000);
  assert.equal(doc.models.find((x) => x.id.startsWith("claude-opus-5-5")).longContextPricing, null);
});

test("threshold: names with 'over N' parse the number; an unstated threshold is null in the written file", async () => {
  assert.equal(m.modelName("Claude Haiku 5.5 (for prompts over 250,000 tokens)").tier.threshold, 250_000);
  assert.equal(m.modelName("Claude Haiku 5.5 (for prompts up to 100,000 tokens)").tier.over, false);
  const root = tmp();
  const md = fixture("pricing.md").replace("(for prompts over 100,000 tokens)", "(long context)");
  await m.run({ root, fetchImpl: stubFetch({ [m.SOURCES.pricing]: md }), now: NOW, retryStamp: path.join(tmp(), "s") });
  const doc = JSON.parse(fs.readFileSync(dataFile(root), "utf8"));
  assert.equal(doc.models.find((x) => x.id.startsWith("claude-haiku-5-5")).longContextPricing.thresholdTokens, null);
});

test("threshold: validator rejects bad thresholdTokens per model and accepts integers, null and no long-context row", () => {
  const mk = () => ({
    version: 1, currency: "USD", fetchedAt: NOW.toISOString(), longContextThresholdTokensOverride: null,
    models: ["a", "b", "c"].map((s) => ({
      id: `claude-${s}`, aliases: [], contextWindow: null, longContextWindow: null, maxInputTokens: null, maxOutputTokens: null,
      pricing: { input: 1, output: 2, cacheWrite5m: 1, cacheWrite1h: 1, cacheRead: 0, batchInput: null, batchOutput: null, fastInput: null, fastOutput: null },
      longContextPricing: { thresholdTokens: 100000, input: 2, output: 4, cacheWrite5m: 2, cacheWrite1h: 2, cacheRead: 0.2, batchInput: null, batchOutput: null },
    })),
  });
  assert.deepEqual(m.validateMetadata(mk()), []);
  for (const bad of [-1, 0, 1.5, "100000", undefined]) {
    const d = mk();
    if (bad === undefined) delete d.models[1].longContextPricing.thresholdTokens; else d.models[1].longContextPricing.thresholdTokens = bad;
    assert.match(m.validateMetadata(d).join(), /models\[claude-b\]: longContextPricing\.thresholdTokens/, String(bad));
  }
  const nul = mk(); nul.models[1].longContextPricing.thresholdTokens = null;
  assert.deepEqual(m.validateMetadata(nul), []);
  const none = mk(); none.models[0].longContextPricing = null;
  assert.deepEqual(m.validateMetadata(none), []);
});

test("override: thresholdOverride boundaries", () => {
  assert.equal(m.thresholdOverride("1"), 1);
  assert.equal(m.thresholdOverride(200000), 200_000);
  assert.equal(m.thresholdOverride(String(Number.MAX_SAFE_INTEGER)), Number.MAX_SAFE_INTEGER);
  for (const v of [null, "0", "00", "-1", "+5", "1,000", "0x10", "NaN", "Infinity", " ", String(Number.MAX_SAFE_INTEGER + 2)]) {
    assert.equal(m.thresholdOverride(v), null, JSON.stringify(v));
  }
});

test("override: via the environment, 0, negative, non-numeric, empty and unset all write null; a valid one is written", () => {
  for (const [label, value] of [["zero", "0"], ["negative", "-200000"], ["non-numeric", "abc"], ["empty", ""], ["unset", undefined]]) {
    const root = tmp();
    const r = hook(["--root", root], { hook_event_name: "Stop" }, { AI_DLC_MODEL_METADATA_LONG_CONTEXT_THRESHOLD_TOKENS: value });
    assert.equal(r.status, 0, label);
    assert.equal(JSON.parse(fs.readFileSync(dataFile(root), "utf8")).longContextThresholdTokensOverride, null, label);
  }
  const ok = tmp();
  hook(["--root", ok], { hook_event_name: "Stop" }, { AI_DLC_MODEL_METADATA_LONG_CONTEXT_THRESHOLD_TOKENS: "123456" });
  assert.equal(JSON.parse(fs.readFileSync(dataFile(ok), "utf8")).longContextThresholdTokensOverride, 123_456);
});

test("override: a changed override alone rewrites the file on a forced refresh", async () => {
  const root = tmp();
  const retryStamp = path.join(tmp(), "s");
  await m.run({ root, fetchImpl: stubFetch(), now: NOW, retryStamp, longContextThresholdTokensOverride: 100_000 });
  assert.equal((await m.run({ root, fetchImpl: stubFetch(), now: later(1), retryStamp, force: true, longContextThresholdTokensOverride: 100_000 })).action, "unchanged");
  assert.equal((await m.run({ root, fetchImpl: stubFetch(), now: later(2), retryStamp, force: true, longContextThresholdTokensOverride: 200_000 })).action, "updated");
});

// ---- Empty-root path ---------------------------------------------------------------------------------------

test("root: --root, CLAUDE_PROJECT_DIR and payload cwd all empty, the process cwd is used", () => {
  const cwd = tmp();
  const r = hook(["--root", ""], { hook_event_name: "Stop", cwd: "" }, { CLAUDE_PROJECT_DIR: "" }, cwd);
  assert.equal(r.status, 0);
  assert.ok(fs.existsSync(dataFile(cwd)), "written under process.cwd()");
});

test("root: a non-string payload cwd is ignored and falls through to the process cwd", () => {
  const cwd = tmp();
  hook([], { hook_event_name: "Stop", cwd: 42 }, {}, cwd);
  assert.ok(fs.existsSync(dataFile(cwd)));
});

test("root: an empty --root falls through to CLAUDE_PROJECT_DIR when that is set", () => {
  const viaEnv = tmp();
  hook(["--root", ""], { hook_event_name: "Stop" }, { CLAUDE_PROJECT_DIR: viaEnv });
  assert.ok(fs.existsSync(dataFile(viaEnv)));
});

// ---- Old names gone ----------------------------------------------------------------------------------------

test("old names: AI_DLC_MODEL_COSTING* settings are not read", () => {
  const off = tmp();
  hook(["--root", off], { hook_event_name: "Stop" }, { AI_DLC_MODEL_COSTING: "off" });
  assert.ok(fs.existsSync(dataFile(off)), "the old off switch does nothing");
  const age = tmp();
  fs.mkdirSync(path.join(age, ".ai-dlc"));
  fs.writeFileSync(dataFile(age), "{\"old\":true}\n");
  const t = new Date(Date.now() - 5 * 60_000); fs.utimesSync(dataFile(age), t, t);
  hook(["--root", age], { hook_event_name: "Stop" }, { AI_DLC_MODEL_METADATA_MAX_AGE_MINUTES: "60", AI_DLC_MODEL_COSTING_MAX_AGE_MINUTES: "0" });
  assert.equal(fs.readFileSync(dataFile(age), "utf8"), "{\"old\":true}\n", "the old interval is ignored: 5 min < the new name's 60");
  const thr = tmp();
  hook(["--root", thr], { hook_event_name: "Stop" }, { AI_DLC_MODEL_COSTING_LONG_CONTEXT_THRESHOLD_TOKENS: "150000" });
  assert.equal(JSON.parse(fs.readFileSync(dataFile(thr), "utf8")).longContextThresholdTokensOverride, null);
});

test("old names: .ai-dlc/model-costing.json is neither counted as the data file nor written", async () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, ".ai-dlc"));
  const legacy = path.join(root, ".ai-dlc", "model-costing.json");
  fs.writeFileSync(legacy, "{\"legacy\":true}\n");
  const r = await m.run({ root, fetchImpl: stubFetch(), now: NOW, retryStamp: path.join(tmp(), "s") });
  assert.equal(r.action, "updated");
  assert.match(r.message, /created/);
  assert.equal(fs.readFileSync(legacy, "utf8"), "{\"legacy\":true}\n");
  assert.deepEqual(fs.readdirSync(path.join(root, ".ai-dlc")).sort(), ["model-costing.json", "model-metadata.json"]);
  assert.equal(m.FILE, path.join(".ai-dlc", "model-metadata.json"));
});

test("old names: no costing name survives in the skill, installed copies or registrations, and the old files are gone", () => {
  const skillDir = path.join(repo, "plugins", "claude", "ai-dlc", "skills", "model-metadata");
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const files = [
    ...walk(skillDir),
    path.join(repo, ".claude", "hooks", "update-model-metadata.mjs"),
    path.join(repo, ".github", "hooks", "ai-dlc-model-metadata.json"),
    path.join(repo, ".ai-dlc", "model-metadata.json"),
    path.join(repo, ".ai-dlc", "model-metadata.schema.json"),
  ].filter((f) => fs.existsSync(f));
  assert.ok(files.length >= 4);
  for (const f of files) assert.doesNotMatch(fs.readFileSync(f, "utf8"), /model[-_]costing/i, f);
  for (const old of [
    path.join(repo, ".claude", "hooks", "update-model-costing.mjs"),
    path.join(repo, ".github", "hooks", "ai-dlc-model-costing.json"),
    path.join(repo, ".ai-dlc", "model-costing.json"),
    path.join(repo, ".ai-dlc", "model-costing.schema.json"),
    path.join(repo, "plugins", "claude", "ai-dlc", "skills", "model-costing"),
  ]) assert.equal(fs.existsSync(old), false, old);
  const settings = fs.readFileSync(path.join(repo, ".claude", "settings.json"), "utf8");
  assert.doesNotMatch(settings, /model[-_]costing/i);
  assert.match(settings, /update-model-metadata\.mjs/);
});

test("models overview source is the platform.claude.com models page", () => {
  assert.equal(m.SOURCES.models, "https://platform.claude.com/docs/en/models/overview.md");
});
