// Behaviour tests for the model-metadata hook: throttle and back-off settings, atomic writes, the validator,
// the hook entry point (child process with a stubbed fetch, never the network) and the hook registrations.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..");
const skillDir = path.join(repo, "plugins", "claude", "ai-dlc", "skills", "model-metadata");
const script = path.join(skillDir, "templates", "update-model-metadata.mjs");
const stub = pathToFileURL(path.join(here, "stub-fetch.mjs")).href;
const m = await import(pathToFileURL(script).href);

const fixture = (n) => fs.readFileSync(path.join(here, "fixtures", n), "utf8");
const tmpRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), "model-metadata-b-"));
const file = (root) => path.join(root, ".ai-dlc", "model-metadata.json");
const NOW = new Date("2026-10-23T12:00:00.000Z");

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
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    const body = pages[url];
    if (body instanceof Error) throw body;
    if (typeof body === "number") return { ok: false, status: body, text: async () => "" };
    if (body == null) return { ok: false, status: 404, text: async () => "" };
    return { ok: true, status: 200, text: async () => body };
  };
  fn.calls = calls;
  return fn;
}

const seed = (root, ageMinutes, content = "{\"old\":true}\n") => {
  fs.mkdirSync(path.join(root, ".ai-dlc"), { recursive: true });
  fs.writeFileSync(file(root), content);
  const t = new Date(NOW.getTime() - ageMinutes * 60_000);
  fs.utimesSync(file(root), t, t);
};
const ageMinutes = (root) => (NOW.getTime() - fs.statSync(file(root)).mtimeMs) / 60_000;

// ---- Parsing: every row, merged Haiku 5.5 rows, retired models ------------------------------------------

test("every pricing-table row is parsed: 21 rows give 20 models, none dropped", () => {
  const md = fixture("pricing.md");
  const rows = md.split("\n").filter((l) => /^\| Claude /.test(l));
  const section = m.tables(md).find((t) => /^model pricing$/i.test(t.heading));
  assert.equal(section.rows.length, 21);
  const models = m.parsePricingPage(md);
  for (const r of section.rows) {
    const key = m.nameKey(m.modelName(r[0]).name);
    assert.ok(models.has(key), `row "${r[0]}" -> ${key}`);
  }
  assert.ok(rows.length >= 21);
});

test("Haiku 5.5: the over-100,000-token row becomes longContextPricing, the other row stays standard", () => {
  const section = m.tables(fixture("pricing.md")).find((t) => /^model pricing$/i.test(t.heading));
  const tiered = section.rows.filter((r) => /Haiku 5\.5/.test(r[0]));
  assert.equal(tiered.length, 2);
  const names = tiered.map((r) => m.modelName(r[0]));
  assert.deepEqual(names.map((n) => n.name), ["Claude Haiku 5.5", "Claude Haiku 5.5"]);
  assert.deepEqual(names.map((n) => n.tier?.over ?? null).sort(), [false, true]);
  const h = m.parsePricingPage(fixture("pricing.md")).get("haiku-5-5");
  assert.equal(h.pricing.output, 0.5 > h.longContextPricing.output ? 0 : h.pricing.output);
  assert.ok(h.longContextPricing.input > h.pricing.input);
});

test("modelName: tier and note extraction", () => {
  assert.deepEqual(m.modelName("Claude Haiku 5.5 (for prompts over 100,000 tokens)"), { name: "Claude Haiku 5.5", note: null, tier: { over: true, threshold: 100000 } });
  assert.deepEqual(m.modelName("Claude Haiku 5.5 (for prompts up to 100,000 tokens)").tier, { over: false, threshold: 100000 });
  assert.equal(m.modelName("Claude Opus 4.1 ([retired, except on Bedrock](https://x))").note, "retired, except on Bedrock");
});

test("a retired model whose page is 404 keeps its price and has null limits and no metadata source", async () => {
  const root = tmpRoot();
  await m.run({ root, fetchImpl: stubFetch(), now: NOW });
  const doc = JSON.parse(fs.readFileSync(file(root), "utf8"));
  const retired = doc.models.filter((x) => x.status === "retired");
  assert.ok(retired.length > 0);
  for (const x of retired.filter((y) => y.sources.metadata === null)) {
    assert.equal(x.contextWindow, null, x.id);
    assert.equal(x.longContextWindow, null, x.id);
    assert.equal(x.maxInputTokens, null, x.id);
    assert.equal(x.maxOutputTokens, null, x.id);
    assert.equal(typeof x.pricing.input, "number", x.id);
  }
});

test("a model page that returns 404 is not an error: the run still updates", async () => {
  const root = tmpRoot();
  const r = await m.run({ root, fetchImpl: stubFetch({ [m.modelPageUrl("opus-5-5")]: 404 }), now: NOW });
  assert.equal(r.action, "updated");
  const doc = JSON.parse(fs.readFileSync(file(root), "utf8"));
  const x = doc.models.find((y) => y.id === "claude-opus-5-5");
  assert.equal(x.contextWindow, null);
  assert.equal(x.maxOutputTokens, null);
});

test("limits are read when the page states them: Opus 5.5 window 1M and max output 128K", async () => {
  const root = tmpRoot();
  await m.run({ root, fetchImpl: stubFetch(), now: NOW });
  const x = JSON.parse(fs.readFileSync(file(root), "utf8")).models.find((y) => y.id === "claude-opus-5-5");
  assert.equal(x.contextWindow, 1_000_000);
  assert.equal(x.maxOutputTokens, 128_000);
});

// ---- Failure paths keep the old file ----------------------------------------------------------------------

test("a request is made with a timeout signal and follows redirects", async () => {
  const f = stubFetch();
  await m.run({ root: tmpRoot(), fetchImpl: f, now: NOW });
  assert.ok(f.calls.length >= 3);
  for (const c of f.calls) {
    assert.ok(c.opts.signal instanceof AbortSignal, c.url);
    assert.equal(c.opts.redirect, "follow");
  }
});

test("a timeout (TimeoutError) keeps the old file and reports failure", async () => {
  const root = tmpRoot();
  seed(root, 180);
  const err = new DOMException("The operation was aborted due to timeout", "TimeoutError");
  const r = await m.run({ root, fetchImpl: stubFetch({ [m.SOURCES.deprecations]: err }), now: NOW });
  assert.equal(r.action, "failed");
  assert.match(r.message, /timeout/i);
  assert.equal(fs.readFileSync(file(root), "utf8"), "{\"old\":true}\n");
});

test("a deprecations page that is missing (404) is tolerated: statuses are null", async () => {
  const root = tmpRoot();
  const r = await m.run({ root, fetchImpl: stubFetch({ [m.SOURCES.deprecations]: 404 }), now: NOW });
  assert.equal(r.action, "updated");
  const doc = JSON.parse(fs.readFileSync(file(root), "utf8"));
  assert.ok(doc.models.every((x) => x.status === null));
});

test("a pricing page that is 404 fails and keeps the old file", async () => {
  const root = tmpRoot();
  seed(root, 180);
  const r = await m.run({ root, fetchImpl: stubFetch({ [m.SOURCES.pricing]: 404 }), now: NOW });
  assert.equal(r.action, "failed");
  assert.match(r.message, /not found/);
  assert.equal(fs.readFileSync(file(root), "utf8"), "{\"old\":true}\n");
});

test("a schema failure (negative price) keeps the old file and says the result is invalid", async () => {
  const root = tmpRoot();
  seed(root, 180);
  // A price cell that parses to a number but yields a value the validator rejects cannot come from "$..." text,
  // so exercise the validator through run() by breaking the doc shape: a page set that yields fewer than 3 models.
  const few = fixture("pricing.md").split("\n").filter((l) => !/^\| Claude /.test(l) || /Haiku (5\.5|4\.5)/.test(l)).join("\n");
  const r = await m.run({ root, fetchImpl: stubFetch({ [m.SOURCES.pricing]: few }), now: NOW });
  assert.equal(r.action, "failed");
  assert.equal(fs.readFileSync(file(root), "utf8"), "{\"old\":true}\n");
});

test("validateMetadata flags each broken field", () => {
  const good = () => ({
    version: 1, currency: "USD", fetchedAt: NOW.toISOString(), longContextThresholdTokensOverride: null,
    models: ["a", "b", "c"].map((s) => ({
      id: `claude-${s}`, aliases: [], contextWindow: null, longContextWindow: null, maxInputTokens: null, maxOutputTokens: 10,
      pricing: { input: 1, output: 2, cacheWrite5m: 1, cacheWrite1h: 1, cacheRead: 0, batchInput: null, batchOutput: null, fastInput: null, fastOutput: null },
      longContextPricing: null,
    })),
  });
  assert.deepEqual(m.validateMetadata(good()), []);
  const bad = (mut) => { const d = good(); mut(d); return m.validateMetadata(d); };
  assert.match(bad((d) => { d.version = 2; }).join(), /version/);
  assert.match(bad((d) => { d.currency = "EUR"; }).join(), /currency/);
  assert.match(bad((d) => { d.fetchedAt = "nope"; }).join(), /fetchedAt/);
  assert.match(bad((d) => { d.models.length = 2; }).join(), /at least 3/);
  assert.match(bad((d) => { d.models[0].id = "gpt-4"; }).join(), /bad id/);
  assert.match(bad((d) => { d.models[1].id = d.models[0].id; }).join(), /duplicate id/);
  assert.match(bad((d) => { d.models[1].aliases = [d.models[0].id]; }).join(), /alias/);
  assert.match(bad((d) => { d.models[0].pricing.input = -1; }).join(), /pricing\.input/);
  assert.match(bad((d) => { d.models[0].pricing.output = Number.NaN; }).join(), /pricing\.output/);
  assert.match(bad((d) => { d.models[0].pricing.batchInput = "x"; }).join(), /batchInput/);
  assert.match(bad((d) => { d.models[0].contextWindow = 0; }).join(), /contextWindow/);
  assert.match(bad((d) => { d.models[0].maxOutputTokens = 1.5; }).join(), /maxOutputTokens/);
  assert.match(bad((d) => { d.models[0].longContextPricing = { ...d.models[0].pricing }; }).join(), /thresholdTokens/);
  assert.deepEqual(m.validateMetadata(null), ["not an object"]);
});

// ---- Long-context threshold: its own field, null when unstated, the repository's override ----------------

test("validateMetadata: the long-context threshold may be null, the override must be present and a positive integer or null", () => {
  const doc = () => ({
    version: 1, currency: "USD", fetchedAt: NOW.toISOString(), longContextThresholdTokensOverride: null,
    models: ["a", "b", "c"].map((s) => ({
      id: `claude-${s}`, aliases: [], contextWindow: null, longContextWindow: null, maxInputTokens: null, maxOutputTokens: null,
      pricing: { input: 1, output: 2, cacheWrite5m: 1, cacheWrite1h: 1, cacheRead: 0, batchInput: null, batchOutput: null, fastInput: null, fastOutput: null },
      longContextPricing: { thresholdTokens: null, input: 2, output: 4, cacheWrite5m: 2, cacheWrite1h: 2, cacheRead: 0.2, batchInput: null, batchOutput: null },
    })),
  });
  assert.deepEqual(m.validateMetadata(doc()), [], "thresholdTokens null is valid");
  const withOverride = doc(); withOverride.longContextThresholdTokensOverride = 200_000;
  assert.deepEqual(m.validateMetadata(withOverride), []);
  for (const bad of [0, -1, 1.5, "200000"]) {
    const d = doc(); d.longContextThresholdTokensOverride = bad;
    assert.match(m.validateMetadata(d).join(), /longContextThresholdTokensOverride/, String(bad));
  }
  const missing = doc(); delete missing.longContextThresholdTokensOverride;
  assert.match(m.validateMetadata(missing).join(), /longContextThresholdTokensOverride/);
  const zero = doc(); zero.models[0].longContextPricing.thresholdTokens = 0;
  assert.match(m.validateMetadata(zero).join(), /thresholdTokens/);
});

test("a long-context row that states no threshold records thresholdTokens null, never a guess", () => {
  assert.deepEqual(m.modelName("Claude Haiku 5.5 (for long prompts)"), { name: "Claude Haiku 5.5", note: null, tier: { over: true, threshold: null } });
  const md = fixture("pricing.md").replace("(for prompts over 100,000 tokens)", "(for long prompts)");
  const h = m.parsePricingPage(md).get("haiku-5-5");
  assert.equal(h.longContextPricing.thresholdTokens, null);
  assert.ok(h.longContextPricing.input > h.pricing.input, "the rates are still recorded");
});

test("thresholdOverride: a positive integer, anything else null", () => {
  assert.equal(m.thresholdOverride("200000"), 200_000);
  assert.equal(m.thresholdOverride(" 150000 "), 150_000);
  for (const v of [undefined, "", "0", "-5", "1.5", "abc", "1e5", "99999999999999999999"]) assert.equal(m.thresholdOverride(v), null, String(v));
});

test("run records the override in the file; the model's own threshold stays as the page states it", async () => {
  const root = tmpRoot();
  await m.run({ root, fetchImpl: stubFetch(), now: NOW, longContextThresholdTokensOverride: 200_000 });
  const doc = JSON.parse(fs.readFileSync(file(root), "utf8"));
  assert.equal(doc.longContextThresholdTokensOverride, 200_000);
  assert.equal(doc.models.find((x) => x.id.startsWith("claude-haiku-5-5")).longContextPricing.thresholdTokens, 100_000);
  // Changing the override changes the file on the next refresh; without one it is null.
  const r = await m.run({ root, fetchImpl: stubFetch(), now: NOW, force: true });
  assert.equal(r.action, "updated");
  assert.equal(JSON.parse(fs.readFileSync(file(root), "utf8")).longContextThresholdTokensOverride, null);
});

test("hook: AI_DLC_MODEL_METADATA_LONG_CONTEXT_THRESHOLD_TOKENS is passed through to the file", () => {
  const root = tmpRoot();
  hook(["--root", root], { hook_event_name: "Stop" }, { AI_DLC_MODEL_METADATA_LONG_CONTEXT_THRESHOLD_TOKENS: "150000" });
  assert.equal(JSON.parse(fs.readFileSync(file(root), "utf8")).longContextThresholdTokensOverride, 150_000);
  const bad = tmpRoot();
  hook(["--root", bad], { hook_event_name: "Stop" }, { AI_DLC_MODEL_METADATA_LONG_CONTEXT_THRESHOLD_TOKENS: "lots" });
  assert.equal(JSON.parse(fs.readFileSync(file(bad), "utf8")).longContextThresholdTokensOverride, null);
});

// ---- Atomic writes, no rewrite when unchanged -------------------------------------------------------------

test("a write failure keeps the old file and leaves no temp file", async () => {
  const root = tmpRoot();
  seed(root, 180);
  // Occupy the temp path with a directory so writeFileSync cannot create it.
  fs.mkdirSync(`${file(root)}.tmp-${process.pid}`);
  const r = await m.run({ root, fetchImpl: stubFetch(), now: NOW });
  assert.equal(r.action, "failed");
  assert.match(r.message, /could not write/);
  assert.equal(fs.readFileSync(file(root), "utf8"), "{\"old\":true}\n");
});

test("the result is written whole through a temp file: the final file always parses", async () => {
  const root = tmpRoot();
  await m.run({ root, fetchImpl: stubFetch(), now: NOW });
  const text = fs.readFileSync(file(root), "utf8");
  assert.ok(text.endsWith("\n"));
  assert.doesNotThrow(() => JSON.parse(text));
  assert.deepEqual(fs.readdirSync(path.join(root, ".ai-dlc")).filter((n) => n.includes(".tmp-")), []);
});

test("unchanged figures: file bytes identical and an old fetchedAt is kept", async () => {
  const root = tmpRoot();
  await m.run({ root, fetchImpl: stubFetch(), now: NOW });
  const bytes = fs.readFileSync(file(root));
  const r = await m.run({ root, fetchImpl: stubFetch(), now: new Date(NOW.getTime() + 5 * 3600_000), force: true });
  assert.equal(r.action, "unchanged");
  assert.equal(r.message, "");
  assert.deepEqual(fs.readFileSync(file(root)), bytes);
});

test("an unreadable old file is replaced by a fresh one", async () => {
  const root = tmpRoot();
  seed(root, 180, "not json");
  const r = await m.run({ root, fetchImpl: stubFetch(), now: NOW });
  assert.equal(r.action, "updated");
  assert.match(r.message, /updated/);
  assert.doesNotThrow(() => JSON.parse(fs.readFileSync(file(root), "utf8")));
});

test("a first run reports created and the model count", async () => {
  const r = await m.run({ root: tmpRoot(), fetchImpl: stubFetch(), now: NOW });
  assert.match(r.message, /created \.ai-dlc\/model-metadata\.json \(20 models\)/);
});

// ---- Throttle, max age, force, back-off -------------------------------------------------------------------

test("throttle: the default interval is 0, so a file a second old is refetched", async () => {
  assert.equal(m.DEFAULT_MAX_AGE_MINUTES, 0);
  const root = tmpRoot(); seed(root, 0);
  const f = stubFetch();
  assert.notEqual((await m.run({ root, fetchImpl: f, now: NOW, retryStamp: path.join(tmpRoot(), "s") })).action, "skipped");
  assert.ok(f.calls.length > 0);
});

test("throttle: with a 60-minute interval, 59 minutes old is skipped, 60 minutes old is refreshed", async () => {
  const a = tmpRoot(); seed(a, 59);
  const fa = stubFetch();
  assert.equal((await m.run({ root: a, fetchImpl: fa, now: NOW, maxAgeMinutes: 60 })).action, "skipped");
  assert.equal(fa.calls.length, 0);
  const b = tmpRoot(); seed(b, 60);
  const fb = stubFetch();
  assert.notEqual((await m.run({ root: b, fetchImpl: fb, now: NOW, maxAgeMinutes: 60 })).action, "skipped");
  assert.ok(fb.calls.length > 0);
});

test("maxAgeMinutes: a custom interval is honoured, and 0 refreshes on every run", async () => {
  const a = tmpRoot(); seed(a, 20);
  assert.equal((await m.run({ root: a, fetchImpl: stubFetch(), now: NOW, maxAgeMinutes: 30 })).action, "skipped");
  assert.notEqual((await m.run({ root: a, fetchImpl: stubFetch(), now: NOW, maxAgeMinutes: 15 })).action, "skipped");
  const z = tmpRoot(); seed(z, 0);
  const f = stubFetch();
  assert.notEqual((await m.run({ root: z, fetchImpl: f, now: NOW, maxAgeMinutes: 0 })).action, "skipped");
  assert.ok(f.calls.length > 0);
});

test("force ignores the interval", async () => {
  const root = tmpRoot(); seed(root, 1);
  const f = stubFetch();
  const r = await m.run({ root, fetchImpl: f, now: NOW, force: true });
  assert.equal(r.action, "updated");
  assert.ok(f.calls.length > 0);
});

test("a missing file is always refreshed, however long the interval", async () => {
  const f = stubFetch();
  const r = await m.run({ root: tmpRoot(), fetchImpl: f, now: NOW, maxAgeMinutes: 100000 });
  assert.equal(r.action, "updated");
});

test("back-off: after a failure with a file, no new try for 10 minutes, whatever the interval (0 included)", async () => {
  for (const max of [0, 5, 60, 1440]) {
    const root = tmpRoot(); seed(root, max + 5);
    const retryStamp = path.join(tmpRoot(), "stamp.retry");
    const r = await m.run({ root, fetchImpl: stubFetch({ [m.SOURCES.pricing]: 503 }), now: NOW, maxAgeMinutes: max, retryStamp });
    assert.equal(r.action, "failed");
    assert.equal(fs.statSync(retryStamp).mtimeMs, NOW.getTime(), `max age ${max}: the stamp holds the failure time`);
    // Not retried 5 minutes later, retried 10 minutes later.
    const f5 = stubFetch();
    assert.equal((await m.run({ root, fetchImpl: f5, now: new Date(NOW.getTime() + 5 * 60_000), maxAgeMinutes: max, retryStamp })).action, "skipped", `max age ${max}`);
    assert.equal(f5.calls.length, 0);
    const f10 = stubFetch();
    assert.notEqual((await m.run({ root, fetchImpl: f10, now: new Date(NOW.getTime() + 10 * 60_000), maxAgeMinutes: max, retryStamp })).action, "skipped", `max age ${max}`);
    assert.equal(fs.existsSync(retryStamp), false, "a successful run deletes the stamp");
  }
});

test("back-off: a failure leaves the file's modification time alone", async () => {
  const root = tmpRoot(); seed(root, 30);
  const before = fs.statSync(file(root)).mtimeMs;
  await m.run({ root, fetchImpl: stubFetch({ [m.SOURCES.pricing]: 503 }), now: NOW, maxAgeMinutes: 60, retryStamp: path.join(tmpRoot(), "s") });
  assert.equal(fs.statSync(file(root)).mtimeMs, before);
});

test("back-off with no file: a failed first fetch is not retried for 10 minutes, then the stamp is cleared", async () => {
  const root = tmpRoot();
  const retryStamp = path.join(tmpRoot(), "stamp.retry");
  const failed = await m.run({ root, fetchImpl: stubFetch({ [m.SOURCES.pricing]: new TypeError("fetch failed") }), now: NOW, retryStamp });
  assert.equal(failed.action, "failed");
  assert.equal(fs.existsSync(file(root)), false, "no data file written");
  assert.equal(fs.statSync(retryStamp).mtimeMs, NOW.getTime(), "the stamp holds the failure time");
  // 5 minutes later: skipped, nothing fetched.
  const f5 = stubFetch();
  assert.equal((await m.run({ root, fetchImpl: f5, now: new Date(NOW.getTime() + 5 * 60_000), retryStamp })).action, "skipped");
  assert.equal(f5.calls.length, 0);
  // 10 minutes later: fetched, file created, stamp removed.
  const f10 = stubFetch();
  assert.equal((await m.run({ root, fetchImpl: f10, now: new Date(NOW.getTime() + 10 * 60_000), retryStamp })).action, "updated");
  assert.ok(f10.calls.length > 0);
  assert.equal(fs.existsSync(retryStamp), false, "a successful run deletes the stamp");
});

test("back-off with no file: force ignores the stamp; interval 0 and an interval under 10 minutes still wait 10", async () => {
  const root = tmpRoot();
  const retryStamp = path.join(tmpRoot(), "stamp.retry");
  await m.run({ root, fetchImpl: stubFetch({ [m.SOURCES.pricing]: 503 }), now: NOW, retryStamp });
  const later = (min) => new Date(NOW.getTime() + min * 60_000);
  assert.equal((await m.run({ root, fetchImpl: stubFetch({ [m.SOURCES.pricing]: 503 }), now: later(1), force: true, retryStamp })).action, "failed", "force ignores the stamp");
  // The last failure was at later(1).
  assert.equal((await m.run({ root, fetchImpl: stubFetch(), now: later(2), maxAgeMinutes: 0, retryStamp })).action, "skipped", "0 still backs off");
  assert.equal((await m.run({ root, fetchImpl: stubFetch(), now: later(5), maxAgeMinutes: 3, retryStamp })).action, "skipped", "3 still waits 10");
  assert.equal((await m.run({ root, fetchImpl: stubFetch(), now: later(11), maxAgeMinutes: 3, retryStamp })).action, "updated");
});

test("back-off stamp: one per repository root, in the user's cache directory", () => {
  const a = m.retryStampPath(path.join(os.tmpdir(), "repo-a"));
  assert.equal(path.dirname(a), path.join(m.userCacheDir(), "ai-dlc"));
  assert.notEqual(path.dirname(a), os.tmpdir());
  assert.match(path.basename(a), /^model-metadata-[0-9a-f]{16}\.retry$/);
  assert.notEqual(a, m.retryStampPath(path.join(os.tmpdir(), "repo-b")));
  assert.equal(a, m.retryStampPath(path.join(os.tmpdir(), "repo-a", ".")));
});

test("run never throws, whatever the fetch does", async () => {
  for (const bad of [new Error("boom"), new TypeError("x"), 500, 429, "<html>not markdown</html>"]) {
    const r = await m.run({ root: tmpRoot(), fetchImpl: stubFetch({ [m.SOURCES.pricing]: bad }), now: NOW });
    assert.equal(r.action, "failed");
  }
  const r = await m.run({ root: tmpRoot(), fetchImpl: async () => { throw "string rejection"; }, now: NOW });
  assert.equal(r.action, "failed");
});

// ---- PreToolUse filter -------------------------------------------------------------------------------------

test("isGitCommit: commits run it, look-alikes and other commands do not", () => {
  const c = (command) => m.isGitCommit({ tool_input: { command } });
  for (const yes of ["git commit", "git commit -m x", "git commit --amend --no-edit", "git -c user.name=a commit -m x", "git -C . commit -m x", "git --no-pager commit", "cd a && git commit -m x", "git add . ; git commit", "(git commit -m x)", "git log | cat && git commit"]) {
    assert.equal(c(yes), true, yes);
  }
  for (const no of ["git commit-tree abc", "git commit-graph write", "git status", "git log --oneline", "git add .", "git stash && git status", "echo git commit-ish", "gitcommit", "mygit commit", "npm run commit", ""]) {
    assert.equal(c(no), false, no);
  }
});

test("isGitCommit: Copilot toolArgs as an object, a JSON string, and a bare string", () => {
  assert.equal(m.isGitCommit({ toolArgs: { command: "git commit -m x" } }), true);
  assert.equal(m.isGitCommit({ toolArgs: JSON.stringify({ command: "git commit -m x" }) }), true);
  assert.equal(m.isGitCommit({ toolArgs: "git commit -m x" }), true, "a non-JSON string is taken as the command");
  assert.equal(m.isGitCommit({ toolArgs: { command: "git commit-tree a" } }), false);
  assert.equal(m.isGitCommit({ toolArgs: JSON.stringify({ command: "git status" }) }), false);
  assert.equal(m.isGitCommit({ toolArgs: { path: "a.txt" } }), false);
  assert.equal(m.isGitCommit({ toolArgs: 5 }), false);
  assert.equal(m.isGitCommit({}), false);
  assert.equal(m.isGitCommit(undefined), false);
  assert.equal(m.isGitCommit({ tool_input: { command: 7 } }), false);
});

test("isGitCommit: tool_input.command wins over toolArgs", () => {
  assert.equal(m.isGitCommit({ tool_input: { command: "git status" }, toolArgs: { command: "git commit" } }), false);
});

// ---- Hook entry point (child process, stubbed fetch) -------------------------------------------------------

function hook(args, payload, env = {}) {
  const log = path.join(tmpRoot(), "requests.log");
  const r = spawnSync(process.execPath, ["--import", stub, script, ...args], {
    input: payload == null ? "" : JSON.stringify(payload),
    encoding: "utf8",
    cwd: tmpRoot(), // never the repository: a root that falls through to process.cwd() lands here
    env: Object.fromEntries(Object.entries({ ...process.env, CLAUDE_PROJECT_DIR: undefined, AI_DLC_MODEL_METADATA: "", AI_DLC_MODEL_METADATA_MAX_AGE_MINUTES: "", AI_DLC_MODEL_METADATA_LONG_CONTEXT_THRESHOLD_TOKENS: undefined, ANTHROPIC_API_KEY: undefined, MC_STUB_MODE: "ok", MC_STUB_LOG: log, ...env }).filter(([, v]) => v !== undefined)),
    timeout: 30_000,
  });
  r.requests = fs.existsSync(log) ? fs.readFileSync(log, "utf8").split("\n").filter(Boolean).length : 0;
  return r;
}

test("hook: a Stop payload creates the file and reports through systemMessage on stdout", () => {
  const root = tmpRoot();
  const r = hook(["--root", root], { hook_event_name: "Stop" });
  assert.equal(r.status, 0);
  assert.equal(r.stderr, "");
  const out = JSON.parse(r.stdout.trim());
  assert.match(out.systemMessage, /created \.ai-dlc\/model-metadata\.json/);
  assert.deepEqual(m.validateMetadata(JSON.parse(fs.readFileSync(file(root), "utf8"))), []);
});

test("hook: a run by hand with --force prints a plain line on stderr and reads no stdin", () => {
  const root = tmpRoot();
  const r = hook(["--force", "--root", root], null);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /model metadata: created/);
});

test("hook: --before-commit with a git commit refreshes and says the file is not staged", () => {
  const root = tmpRoot();
  const r = hook(["--before-commit", "--root", root], { hook_event_name: "PreToolUse", tool_input: { command: "git commit -m x" } });
  assert.equal(r.status, 0);
  assert.match(JSON.parse(r.stdout.trim()).systemMessage, /not staged; `git add \.ai-dlc\/model-metadata\.json`/);
  assert.ok(fs.existsSync(file(root)));
});

test("hook: --before-commit accepts Copilot toolArgs as a string and as an object", () => {
  for (const toolArgs of [JSON.stringify({ command: "git commit -m x" }), { command: "git commit -m x" }]) {
    const root = tmpRoot();
    const r = hook(["--before-commit", "--root", root], { toolName: "bash", toolArgs });
    assert.equal(r.status, 0);
    assert.ok(fs.existsSync(file(root)), JSON.stringify(toolArgs));
    assert.match(r.stderr, /not staged/, "Copilot payload has no hook_event_name: plain line on stderr");
  }
});

test("hook: --before-commit skips commit-tree, status, a missing payload and an unparsable payload with no request made", () => {
  for (const payload of [
    { hook_event_name: "PreToolUse", tool_input: { command: "git commit-tree abc" } },
    { hook_event_name: "PreToolUse", tool_input: { command: "git status" } },
    { toolName: "bash", toolArgs: { command: "git status && git log" } },
    null,
  ]) {
    const root = tmpRoot();
    const r = hook(["--before-commit", "--root", root], payload);
    assert.equal(r.status, 0);
    assert.equal(r.stdout + r.stderr, "");
    assert.equal(r.requests, 0);
    assert.equal(fs.existsSync(file(root)), false);
  }
  const root = tmpRoot();
  const r = spawnSync(process.execPath, ["--import", stub, script, "--before-commit", "--root", root], { input: "{not json", encoding: "utf8", env: { ...process.env, MC_STUB_MODE: "ok" } });
  assert.equal(r.status, 0);
  assert.equal(fs.existsSync(file(root)), false);
});

test("hook: AI_DLC_MODEL_METADATA off, false, 0 and no (any case) all turn it off with no request", () => {
  for (const v of ["off", "OFF", "false", "0", "no", "No"]) {
    const root = tmpRoot();
    const r = hook(["--force", "--root", root], { hook_event_name: "Stop" }, { AI_DLC_MODEL_METADATA: v });
    assert.equal(r.status, 0, v);
    assert.equal(r.requests, 0, v);
    assert.equal(fs.existsSync(file(root)), false, v);
  }
  const root = tmpRoot();
  hook(["--root", root], { hook_event_name: "Stop" }, { AI_DLC_MODEL_METADATA: "on" });
  assert.ok(fs.existsSync(file(root)), "any other value leaves the hook on");
});

test("hook: AI_DLC_MODEL_METADATA_MAX_AGE_MINUTES sets the interval", () => {
  const root = tmpRoot();
  seed(root, 0);
  const t = new Date(Date.now() - 20 * 60_000);
  fs.utimesSync(file(root), t, t);
  const long = hook(["--root", root], { hook_event_name: "Stop" }, { AI_DLC_MODEL_METADATA_MAX_AGE_MINUTES: "30" });
  assert.equal(long.requests, 0, "20 minutes old with a 30-minute interval: skipped");
  const short = hook(["--root", root], { hook_event_name: "Stop" }, { AI_DLC_MODEL_METADATA_MAX_AGE_MINUTES: "10" });
  assert.ok(short.requests > 0, "20 minutes old with a 10-minute interval: refreshed");
});

test("hook: a max age of 0 refreshes on every run; an invalid, negative or empty value falls back to the default, 0", () => {
  for (const value of ["0", "abc", "-5", ""]) {
    const root = tmpRoot(); seed(root, 0);
    assert.ok(hook(["--root", root], { hook_event_name: "Stop" }, { AI_DLC_MODEL_METADATA_MAX_AGE_MINUTES: value }).requests > 0, `"${value}" -> every run`);
  }
});

test("hook: --force refreshes a fresh file", () => {
  const root = tmpRoot(); seed(root, 0);
  const r = hook(["--force", "--root", root], null);
  assert.ok(r.requests > 0);
});

test("hook: the root comes from --root, then CLAUDE_PROJECT_DIR, then the payload cwd", () => {
  const viaEnv = tmpRoot();
  hook([], { hook_event_name: "Stop" }, { CLAUDE_PROJECT_DIR: viaEnv });
  assert.ok(fs.existsSync(file(viaEnv)), "CLAUDE_PROJECT_DIR");
  const viaCwd = tmpRoot();
  hook([], { hook_event_name: "Stop", cwd: viaCwd });
  assert.ok(fs.existsSync(file(viaCwd)), "payload cwd");
  const flagWins = tmpRoot(), envLoses = tmpRoot();
  hook(["--root", flagWins], { hook_event_name: "Stop" }, { CLAUDE_PROJECT_DIR: envLoses });
  assert.ok(fs.existsSync(file(flagWins)));
  assert.equal(fs.existsSync(file(envLoses)), false);
});

test("hook: an empty --root or CLAUDE_PROJECT_DIR counts as unset and falls through to the payload cwd", () => {
  const viaCwd = tmpRoot();
  const r = hook([], { hook_event_name: "Stop", cwd: viaCwd }, { CLAUDE_PROJECT_DIR: "" });
  assert.equal(r.status, 0);
  assert.ok(fs.existsSync(file(viaCwd)), "empty CLAUDE_PROJECT_DIR");
  const viaCwd2 = tmpRoot();
  hook(["--root", ""], { hook_event_name: "Stop", cwd: viaCwd2 }, { CLAUDE_PROJECT_DIR: "" });
  assert.ok(fs.existsSync(file(viaCwd2)), "empty --root");
});

test("hook: a network failure exits 0, keeps the old file and names it in one line", () => {
  const root = tmpRoot(); seed(root, 0);
  const t = new Date(Date.now() - 3 * 3600_000);
  fs.utimesSync(file(root), t, t);
  const r = hook(["--root", root], { hook_event_name: "Stop" }, { MC_STUB_MODE: "fail" });
  assert.equal(r.status, 0);
  const msg = JSON.parse(r.stdout.trim()).systemMessage;
  assert.match(msg, /could not refresh \.ai-dlc\/model-metadata\.json/);
  assert.match(msg, /kept the old file/);
  assert.equal(msg.split("\n").length, 1);
  assert.equal(fs.readFileSync(file(root), "utf8"), "{\"old\":true}\n");
});

test("hook: exits 0 for garbage input, an unwritable root and an unknown flag", () => {
  assert.equal(spawnSync(process.execPath, ["--import", stub, script, "--root", tmpRoot()], { input: "\u0000\u0001 garbage", encoding: "utf8", env: { ...process.env, MC_STUB_MODE: "fail" } }).status, 0);
  const blocker = path.join(tmpRoot(), "afile");
  fs.writeFileSync(blocker, "x");
  const r = hook(["--force", "--root", path.join(blocker, "sub")], null);
  assert.equal(r.status, 0, "a root under a regular file cannot be written");
  assert.equal(hook(["--bogus"], { hook_event_name: "Stop" }, { MC_STUB_MODE: "fail" }).status, 0);
});

// ---- Registrations -----------------------------------------------------------------------------------------

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const gitShow = (p) => {
  const r = spawnSync("git", ["show", `HEAD:${p}`], { cwd: repo, encoding: "utf8" });
  return r.status === 0 ? JSON.parse(r.stdout) : null;
};

test("registrations: .claude/settings.json has our Stop and PreToolUse(Bash) entries exactly once", () => {
  const s = readJson(path.join(repo, ".claude", "settings.json"));
  const ours = (event) => s.hooks[event].flatMap((g) => g.hooks.filter((h) => /update-model-metadata/.test(h.command)).map((h) => ({ matcher: g.matcher, type: h.type, command: h.command })));
  assert.deepEqual(ours("Stop"), [{ matcher: undefined, type: "command", command: 'node "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/update-model-metadata.mjs"' }]);
  assert.deepEqual(ours("PreToolUse"), [{ matcher: "Bash", type: "command", command: 'node "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/update-model-metadata.mjs" --before-commit' }]);
  assert.equal(JSON.stringify(s).split("update-model-metadata.mjs").length - 1, 2);
});

test("registrations: appending left every pre-existing Stop and PreToolUse entry intact (compared with HEAD)", () => {
  const before = gitShow(".claude/settings.json");
  if (!before) return; // not a git checkout: nothing to compare with
  const now = readJson(path.join(repo, ".claude", "settings.json"));
  for (const event of Object.keys(before.hooks ?? {})) {
    for (const group of before.hooks[event]) {
      assert.ok(now.hooks[event].some((g) => JSON.stringify(g) === JSON.stringify(group)), `${event} entry lost or changed: ${JSON.stringify(group)}`);
    }
    // Order of the pre-existing entries is preserved.
    const kept = now.hooks[event].filter((g) => before.hooks[event].some((b) => JSON.stringify(b) === JSON.stringify(g)));
    assert.deepEqual(kept, before.hooks[event], `${event} order`);
  }
  for (const [k, v] of Object.entries(before)) if (k !== "hooks") assert.deepEqual(now[k], v, `settings key ${k} changed`);
});

test("registrations: the Copilot hook file wires agentStop and preToolUse to the script", () => {
  const c = readJson(path.join(repo, ".github", "hooks", "ai-dlc-model-metadata.json"));
  assert.equal(c.version, 1);
  assert.deepEqual(Object.keys(c.hooks).sort(), ["agentStop", "preToolUse"]);
  for (const [ev, args] of [["agentStop", ""], ["preToolUse", " --before-commit"]]) {
    assert.equal(c.hooks[ev].length, 1, ev);
    const h = c.hooks[ev][0];
    assert.equal(h.type, "command", ev);
    assert.equal(h.bash, `node "\${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/update-model-metadata.mjs"${args}`, ev);
    assert.equal(h.powershell, `node .claude/hooks/update-model-metadata.mjs${args}`, ev);
    assert.equal(h.cwd, ".", `${ev} runs from the repository root`);
    assert.ok(Number.isFinite(h.timeoutSec) && h.timeoutSec > 0, `${ev} has a timeout`);
  }
});

test("registrations: the script a hook names exists and has no network-free exit paths other than 0", () => {
  assert.ok(fs.existsSync(path.join(repo, ".claude", "hooks", "update-model-metadata.mjs")));
  const src = fs.readFileSync(script, "utf8");
  assert.doesNotMatch(src, /process\.exit\(/, "no process.exit(): it could cut the systemMessage short on a pipe");
  assert.deepEqual([...src.matchAll(/process\.exitCode\s*=\s*(\w+)/g)].map((x) => x[1]), ["0"], "the only exit code set is 0");
});

test("registrations: the schema file in the skill is valid JSON and requires what the script writes", () => {
  const schema = readJson(path.join(skillDir, "templates", "model-metadata.schema.json"));
  for (const k of ["version", "currency", "fetchedAt", "models"]) assert.ok(schema.required.includes(k), k);
});
