// Round 4 (test round 3 of 3, after fix round 2): gaps left by round3 -- interval 0 with the back-off stamp and
// --force, Models API edge cases (page cap, all-or-nothing pagination, value filtering, key never leaking) and the
// hook command strings across the templates, the installed settings and the Copilot file.
// No network: fetch is always a stub or the stub-fetch preload; the key is a fake.
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
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "model-metadata-r4-"));
const dataFile = (root) => path.join(root, ".ai-dlc", "model-metadata.json");
const NOW = new Date("2026-10-23T12:00:00.000Z");
const later = (min) => new Date(NOW.getTime() + min * 60_000);
const FAKE_KEY = "sk-ant-test-not-a-real-key-1111";

function stubFetch({ overrides = {}, api } = {}) {
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
    if (url.startsWith(m.MODELS_API)) {
      const a = typeof api === "function" ? api(url) : api;
      if (a instanceof Error) throw a;
      if (typeof a === "number") return { ok: false, status: a, json: async () => ({}) };
      if (a === "badjson") return { ok: true, status: 200, json: async () => { throw new SyntaxError(`Unexpected token ${FAKE_KEY}`); } };
      if (a == null) return { ok: false, status: 404, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => a };
    }
    const body = pages[url];
    if (body instanceof Error) throw body;
    if (typeof body === "number") return { ok: false, status: body, text: async () => "" };
    if (body == null) return { ok: false, status: 404, text: async () => "" };
    return { ok: true, status: 200, text: async () => body };
  };
  fn.calls = calls;
  fn.apiCalls = () => calls.filter((c) => c.url.startsWith(m.MODELS_API));
  return fn;
}

const cleanEnv = (extra) => Object.fromEntries(Object.entries({ ...process.env, CLAUDE_PROJECT_DIR: undefined, AI_DLC_MODEL_METADATA: "", AI_DLC_MODEL_METADATA_MAX_AGE_MINUTES: "", ANTHROPIC_API_KEY: undefined, ...extra }).filter(([, v]) => v !== undefined));
const lines = (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean) : []);

// ---- interval 0 and the back-off stamp, with a file present -------------------------------------------------

test("interval 0 with a file: every run fetches; a failure stamps; the next 9 minutes skip with no request; minute 10 retries", async () => {
  const root = tmp();
  const retryStamp = path.join(tmp(), "s.retry");
  assert.equal((await m.run({ root, fetchImpl: stubFetch(), now: NOW, maxAgeMinutes: 0, retryStamp })).action, "updated");
  const f2 = stubFetch();
  assert.equal((await m.run({ root, fetchImpl: f2, now: later(1), maxAgeMinutes: 0, retryStamp })).action, "unchanged");
  assert.ok(f2.calls.length > 0, "interval 0: fetched again a minute later");
  const before = fs.readFileSync(dataFile(root), "utf8");
  const bad = await m.run({ root, fetchImpl: stubFetch({ overrides: { [m.SOURCES.pricing]: 503 } }), now: later(2), maxAgeMinutes: 0, retryStamp });
  assert.equal(bad.action, "failed");
  assert.match(bad.message, /kept the old file/);
  assert.equal(fs.statSync(retryStamp).mtimeMs, later(2).getTime());
  const f3 = stubFetch();
  const skipped = await m.run({ root, fetchImpl: f3, now: later(11.9), maxAgeMinutes: 0, retryStamp });
  assert.equal(skipped.action, "skipped");
  assert.equal(skipped.message, "");
  assert.equal(f3.calls.length, 0, "no request, not even the Models API");
  assert.equal((await m.run({ root, fetchImpl: stubFetch(), now: later(12), maxAgeMinutes: 0, retryStamp })).action, "unchanged");
  assert.equal(fs.existsSync(retryStamp), false);
  assert.equal(fs.readFileSync(dataFile(root), "utf8"), before);
});

test("the stamp also blocks the Models API call: a skipped run with a key makes no request at all", async () => {
  const root = tmp();
  const retryStamp = path.join(tmp(), "s.retry");
  await m.run({ root, fetchImpl: stubFetch({ overrides: { [m.SOURCES.pricing]: 503 } }), now: NOW, retryStamp, apiKey: FAKE_KEY });
  const f = stubFetch({ api: { data: [], has_more: false } });
  assert.equal((await m.run({ root, fetchImpl: f, now: later(5), retryStamp, apiKey: FAKE_KEY })).action, "skipped");
  assert.equal(f.calls.length, 0);
});

test("--force with a file present bypasses both the stamp and a long interval, and a success clears the stamp", async () => {
  const root = tmp();
  const retryStamp = path.join(tmp(), "s.retry");
  await m.run({ root, fetchImpl: stubFetch(), now: NOW, retryStamp });
  fs.writeFileSync(retryStamp, ""); fs.utimesSync(retryStamp, later(1), later(1));
  const f = stubFetch();
  const r = await m.run({ root, fetchImpl: f, now: later(2), maxAgeMinutes: 1440, force: true, retryStamp });
  assert.equal(r.action, "unchanged");
  assert.ok(f.calls.length > 0);
  assert.equal(fs.existsSync(retryStamp), false);
});

test("a stamp dated in the future does not block (clock moved back)", async () => {
  const root = tmp();
  const retryStamp = path.join(tmp(), "s.retry");
  fs.writeFileSync(retryStamp, ""); fs.utimesSync(retryStamp, later(60), later(60));
  assert.equal((await m.run({ root, fetchImpl: stubFetch(), now: NOW, retryStamp })).action, "updated");
});

test("a failed Models API call is not a refresh failure: the refresh succeeds and no stamp is written", async () => {
  const root = tmp();
  const retryStamp = path.join(tmp(), "s.retry");
  const r = await m.run({ root, fetchImpl: stubFetch({ api: 500 }), now: NOW, retryStamp, apiKey: FAKE_KEY });
  assert.equal(r.action, "updated");
  assert.equal(fs.existsSync(retryStamp), false);
});

test("hook: AI_DLC_MODEL_METADATA_MAX_AGE_MINUTES unset, '0', negative, non-numeric or empty all mean interval 0; 60 skips a fresh file", () => {
  const log = path.join(tmp(), "req.log");
  const requestsOfSecondStop = (age) => {
    const root = tmp();
    const go = () => spawnSync(process.execPath, ["--import", stub, script, "--root", root], {
      input: JSON.stringify({ hook_event_name: "Stop" }), encoding: "utf8", cwd: tmp(), timeout: 30_000,
      env: cleanEnv({ AI_DLC_MODEL_METADATA_MAX_AGE_MINUTES: age, MC_STUB_MODE: "ok", MC_STUB_LOG: log }),
    });
    assert.equal(go().status, 0);
    const n0 = lines(log).length;
    assert.equal(go().status, 0);
    return lines(log).length - n0;
  };
  for (const age of [undefined, "0", "-5", "abc", ""]) assert.ok(requestsOfSecondStop(age) > 0, `age ${JSON.stringify(age)} refetches`);
  assert.equal(requestsOfSecondStop("60"), 0, "60 minutes: the second stop makes no request");
});

// ---- Models API -----------------------------------------------------------------------------------------------

test("api: the hook asks api.anthropic.com only when ANTHROPIC_API_KEY is non-empty, and no URL holds the key", () => {
  const go = (key) => {
    const log = path.join(tmp(), "req.log");
    const r = spawnSync(process.execPath, ["--import", stub, script, "--root", tmp()], {
      input: JSON.stringify({ hook_event_name: "Stop" }), encoding: "utf8", cwd: tmp(), timeout: 30_000,
      env: cleanEnv({ ANTHROPIC_API_KEY: key, MC_STUB_MODE: "ok", MC_STUB_LOG: log }),
    });
    assert.equal(r.status, 0);
    assert.ok(!(r.stdout + r.stderr).includes(FAKE_KEY));
    return fs.readFileSync(log, "utf8");
  };
  assert.ok(!go(undefined).includes("api.anthropic.com"));
  assert.ok(!go("").includes("api.anthropic.com"));
  assert.ok(!go("   ").includes("api.anthropic.com"));
  const withKey = go(FAKE_KEY);
  assert.ok(withKey.includes(`${m.MODELS_API}?limit=1000`));
  assert.ok(!withKey.includes(FAKE_KEY), "the key is not in any URL");
});

test("api: the key is trimmed and sent in x-api-key only, with the version and accept headers and a timeout", async () => {
  const f = stubFetch({ api: { data: [], has_more: false } });
  await m.fetchApiLimits({ apiKey: `  ${FAKE_KEY}\n`, fetchImpl: f });
  const [c] = f.apiCalls();
  assert.deepEqual(Object.keys(c.opts.headers).sort(), ["accept", "anthropic-version", "x-api-key"]);
  assert.equal(c.opts.headers["x-api-key"], FAKE_KEY);
  assert.ok(!c.url.includes(FAKE_KEY));
  assert.ok(c.opts.signal instanceof AbortSignal);
});

test("api: three pages are followed in order, each after_id taken from the previous last_id", async () => {
  const f = stubFetch({
    api: (url) => {
      if (url.includes("after_id=claude-b")) return { data: [{ id: "claude-c", max_input_tokens: 3, max_tokens: 30 }], has_more: false, last_id: "claude-c" };
      if (url.includes("after_id=claude-a")) return { data: [{ id: "claude-b", max_input_tokens: 2, max_tokens: 20 }], has_more: true, last_id: "claude-b" };
      return { data: [{ id: "claude-a", max_input_tokens: 1, max_tokens: 10 }], has_more: true, last_id: "claude-a" };
    },
  });
  const limits = await m.fetchApiLimits({ apiKey: FAKE_KEY, fetchImpl: f });
  assert.deepEqual([...limits.keys()], ["claude-a", "claude-b", "claude-c"]);
  assert.deepEqual(f.apiCalls().map((c) => c.url), [`${m.MODELS_API}?limit=1000`, `${m.MODELS_API}?limit=1000&after_id=claude-a`, `${m.MODELS_API}?limit=1000&after_id=claude-b`]);
});

test("api: a server that always says has_more stops after 10 pages and discards what it read (all or nothing)", async () => {
  let n = 0;
  const f = stubFetch({ api: () => { n++; return { data: [{ id: `claude-p${n}`, max_input_tokens: n, max_tokens: n }], has_more: true, last_id: `claude-p${n}` }; } });
  const limits = await m.fetchApiLimits({ apiKey: FAKE_KEY, fetchImpl: f });
  assert.equal(f.apiCalls().length, 10);
  assert.equal(limits, null);
});

test("api: has_more without a string last_id stops instead of looping", async () => {
  for (const last_id of [undefined, null, 5]) {
    const f = stubFetch({ api: { data: [{ id: "claude-a", max_input_tokens: 1, max_tokens: 1 }], has_more: true, last_id } });
    const limits = await m.fetchApiLimits({ apiKey: FAKE_KEY, fetchImpl: f });
    assert.equal(f.apiCalls().length, 1, String(last_id));
    assert.equal(limits.size, 1);
  }
});

test("api: a failure on page 2 discards the whole result (all or nothing)", async () => {
  for (const second of [500, new TypeError("fetch failed"), "badjson", { nope: 1 }]) {
    const f = stubFetch({ api: (url) => (url.includes("after_id=") ? second : { data: [{ id: "claude-a", max_input_tokens: 1, max_tokens: 1 }], has_more: true, last_id: "claude-a" }) });
    assert.equal(await m.fetchApiLimits({ apiKey: FAKE_KEY, fetchImpl: f }), null, String(second));
  }
});

test("api: values that are not positive safe integers read as null; entries without a string id are skipped", async () => {
  const bad = [0, -1, 1.5, "200000", NaN, Infinity, null, undefined, Number.MAX_SAFE_INTEGER + 2, true, [], {}];
  const data = bad.map((v, i) => ({ id: `claude-v${i}`, max_input_tokens: v, max_tokens: v }));
  data.push({ id: 7, max_input_tokens: 5, max_tokens: 5 }, null, "x", { max_input_tokens: 5 }, { id: "claude-ok", max_input_tokens: 5, max_tokens: 6 });
  const limits = await m.fetchApiLimits({ apiKey: FAKE_KEY, fetchImpl: stubFetch({ api: { data, has_more: false } }) });
  assert.equal(limits.size, bad.length + 1);
  for (let i = 0; i < bad.length; i++) assert.deepEqual(limits.get(`claude-v${i}`), { maxInputTokens: null, maxOutputTokens: null }, String(bad[i]));
  assert.deepEqual(limits.get("claude-ok"), { maxInputTokens: 5, maxOutputTokens: 6 });
});

test("api: the key never appears in a result, message or file even when errors quote it", async () => {
  for (const api of [new Error(`request failed, x-api-key ${FAKE_KEY}`), "badjson"]) {
    const root = tmp();
    const r = await m.run({ root, fetchImpl: stubFetch({ api }), now: NOW, retryStamp: path.join(tmp(), "s"), apiKey: FAKE_KEY });
    assert.equal(r.action, "updated", String(api));
    assert.ok(!r.message.includes(FAKE_KEY));
    assert.ok(!fs.readFileSync(dataFile(root), "utf8").includes(FAKE_KEY));
  }
  // A docs failure with a key set: the failure message carries no key, and the stamp stays empty.
  const retryStamp = path.join(tmp(), "s.retry");
  const bad = await m.run({ root: tmp(), fetchImpl: stubFetch({ overrides: { [m.SOURCES.pricing]: new Error("boom") }, api: { data: [], has_more: false } }), now: NOW, retryStamp, apiKey: FAKE_KEY });
  assert.equal(bad.action, "failed");
  assert.ok(!bad.message.includes(FAKE_KEY));
  assert.equal(fs.readFileSync(retryStamp, "utf8"), "");
});

test("api: a rejection that is not an Error (a string, undefined, a number) still yields null, never a throw", async () => {
  for (const thrown of ["boom", undefined, 42]) {
    const f = async () => { throw thrown; };
    assert.equal(await m.fetchApiLimits({ apiKey: FAKE_KEY, fetchImpl: f }), null);
  }
});

test("api: contextWindow and maxOutputTokens are filled only when the page leaves them null; docs figures win; sources.modelsApi matches", () => {
  const pages = new Map([
    ["sonnet-4-5", { url: m.modelPageUrl("sonnet-4-5"), md: fixture("model-sonnet-4-5.md") }],
    ["opus-5-5", { url: m.modelPageUrl("opus-5-5"), md: fixture("model-opus-5-5.md") }],
  ]);
  const base = { pricingMd: fixture("pricing.md"), overviewMd: "", deprecationsMd: fixture("model-deprecations.md"), pages, fetchedAt: NOW.toISOString() };
  const plain = m.buildMetadata(base).models;
  const api = new Map(plain.map((x) => [x.id, { maxInputTokens: 123_456, maxOutputTokens: 7_890 }]));
  const built = m.buildMetadata({ ...base, apiLimits: api });
  for (let i = 0; i < plain.length; i++) {
    const a = plain[i], b = built.models[i];
    const filled = [];
    for (const [field, value] of [["maxInputTokens", 123_456], ["contextWindow", 123_456], ["maxOutputTokens", 7_890]]) {
      if (a[field] === null) { assert.equal(b[field], value, `${a.id}.${field}`); filled.push(field); } else assert.equal(b[field], a[field], `${a.id}.${field}: docs figure kept`);
    }
    assert.deepEqual(b.sources.modelsApi, filled, a.id);
    assert.equal(b.longContextWindow, a.longContextWindow, "longContextWindow is never filled");
  }
  assert.ok(built.models.some((x) => x.sources.modelsApi.length > 0), "the fixtures leave something to fill");
  assert.ok(plain.some((x) => x.contextWindow !== null && x.maxOutputTokens !== null), "and some figures the docs already state");
  assert.deepEqual(m.validateMetadata(built), []);
});

test("api: null API figures fill nothing and list nothing", () => {
  const pages = new Map([["sonnet-4-5", { url: m.modelPageUrl("sonnet-4-5"), md: fixture("model-sonnet-4-5.md") }]]);
  const base = { pricingMd: fixture("pricing.md"), overviewMd: "", deprecationsMd: fixture("model-deprecations.md"), pages, fetchedAt: NOW.toISOString() };
  const plain = m.buildMetadata(base).models;
  const api = new Map(plain.map((x) => [x.id, { maxInputTokens: null, maxOutputTokens: null }]));
  assert.deepEqual(m.buildMetadata({ ...base, apiLimits: api }).models, plain);
});

test("api: a changed API figure alone is a real change; dropping the key keeps the figures an earlier run filled", async () => {
  const root = tmp();
  const retryStamp = path.join(tmp(), "s");
  const page = (n) => ({ data: [{ id: "claude-opus-5-5", max_input_tokens: n, max_tokens: 1 }, { id: "claude-haiku-5-5", max_input_tokens: n, max_tokens: 1 }], has_more: false });
  assert.equal((await m.run({ root, fetchImpl: stubFetch({ api: page(100_000) }), now: NOW, retryStamp, apiKey: FAKE_KEY })).action, "updated");
  assert.equal((await m.run({ root, fetchImpl: stubFetch({ api: page(100_000) }), now: later(1), retryStamp, apiKey: FAKE_KEY })).action, "unchanged");
  assert.equal((await m.run({ root, fetchImpl: stubFetch({ api: page(200_000) }), now: later(2), retryStamp, apiKey: FAKE_KEY })).action, "updated");
  const before = fs.readFileSync(dataFile(root), "utf8");
  assert.equal((await m.run({ root, fetchImpl: stubFetch(), now: later(3), retryStamp })).action, "unchanged");
  assert.equal(fs.readFileSync(dataFile(root), "utf8"), before, "byte for byte: no churn between runs with and without the key");
  const opus = JSON.parse(before).models.find((x) => x.id === "claude-opus-5-5");
  assert.equal(opus.maxInputTokens, 200_000, "the newer API value replaced the older one");
});

// ---- Keeping the API figures of an earlier run (the human's decision, 2026-10-23) ------------------------------

const API_PAGE = { data: [{ id: "claude-opus-5-5", max_input_tokens: 1_000_000, max_tokens: 1 }, { id: "claude-haiku-5-5", max_input_tokens: 200_000, max_tokens: 1 }], has_more: false };
async function seeded() {
  const root = tmp();
  const retryStamp = path.join(tmp(), "s");
  assert.equal((await m.run({ root, fetchImpl: stubFetch({ api: API_PAGE }), now: NOW, retryStamp, apiKey: FAKE_KEY })).action, "updated");
  const text = fs.readFileSync(dataFile(root), "utf8");
  const doc = JSON.parse(text);
  assert.ok(doc.models.some((x) => x.sources.modelsApi.length > 0), "the seed filled something from the API");
  return { root, retryStamp, text, doc };
}

test("keep: without a key no API call is made, the old API figures and sources.modelsApi stay, and the run reports unchanged", async () => {
  const { root, retryStamp, text } = await seeded();
  const f = stubFetch({ api: API_PAGE });
  const r = await m.run({ root, fetchImpl: f, now: later(1), retryStamp });
  assert.equal(r.action, "unchanged");
  assert.equal(r.message, "");
  assert.equal(f.apiCalls().length, 0);
  assert.equal(fs.readFileSync(dataFile(root), "utf8"), text);
  for (const key of [null, "", "   "]) {
    assert.equal((await m.run({ root, fetchImpl: stubFetch(), now: later(2), retryStamp, apiKey: key })).action, "unchanged", JSON.stringify(key));
  }
});

test("keep: when the API call fails (401, 500, a thrown request, a malformed body, bad JSON) the old API figures stay", async () => {
  for (const api of [401, 500, new TypeError("fetch failed"), { nope: true }, "badjson"]) {
    const { root, retryStamp, text } = await seeded();
    const r = await m.run({ root, fetchImpl: stubFetch({ api }), now: later(1), retryStamp, apiKey: FAKE_KEY });
    assert.equal(r.action, "unchanged", String(api));
    assert.equal(fs.readFileSync(dataFile(root), "utf8"), text, String(api));
  }
});

test("keep: a docs figure that appears replaces the API one and drops it from sources.modelsApi, and stays without the key", async () => {
  const { root, retryStamp, doc } = await seeded();
  const was = doc.models.find((x) => x.id === "claude-opus-5-5");
  assert.deepEqual(was.sources.modelsApi, ["maxInputTokens"]);
  const page = [fixture("model-opus-5-5.md"), "## Capabilities", "", "| Feature | Value |", "|---|---|", "| Max input tokens | 900K tokens |", ""].join("\n");
  const overrides = { [m.modelPageUrl("opus-5-5")]: page };
  for (const [i, opts] of [[1, { apiKey: FAKE_KEY, api: API_PAGE }], [2, {}], [3, { apiKey: FAKE_KEY, api: 500 }]]) {
    const r = await m.run({ root, fetchImpl: stubFetch({ overrides, api: opts.api }), now: later(i), retryStamp, apiKey: opts.apiKey ?? null });
    assert.equal(r.action, i === 1 ? "updated" : "unchanged", `run ${i}`);
    const cur = JSON.parse(fs.readFileSync(dataFile(root), "utf8")).models.find((x) => x.id === "claude-opus-5-5");
    assert.equal(cur.maxInputTokens, 900_000, `run ${i}: the docs figure`);
    assert.deepEqual(cur.sources.modelsApi, [], `run ${i}: no longer listed as from the API`);
    assert.equal(cur.contextWindow, was.contextWindow, `run ${i}: the page's context window`);
  }
});

test("keep: a fresh API answer replaces the kept figures, including one that no longer lists a model", async () => {
  const { root, retryStamp } = await seeded();
  const fresh = { data: [{ id: "claude-opus-5-5", max_input_tokens: 750_000, max_tokens: 1 }], has_more: false };
  assert.equal((await m.run({ root, fetchImpl: stubFetch({ api: fresh }), now: later(1), retryStamp, apiKey: FAKE_KEY })).action, "updated");
  const d = JSON.parse(fs.readFileSync(dataFile(root), "utf8"));
  assert.equal(d.models.find((x) => x.id === "claude-opus-5-5").maxInputTokens, 750_000);
  const haiku = d.models.find((x) => x.id === "claude-haiku-5-5");
  assert.equal(haiku.maxInputTokens, null, "the API answered and no longer lists it");
  assert.deepEqual(haiku.sources.modelsApi, []);
  // The new values are the ones kept from then on.
  assert.equal((await m.run({ root, fetchImpl: stubFetch(), now: later(2), retryStamp })).action, "unchanged");
  assert.equal(JSON.parse(fs.readFileSync(dataFile(root), "utf8")).models.find((x) => x.id === "claude-opus-5-5").maxInputTokens, 750_000);
});

test("keep: buildMetadata keeps only listed, valid figures of models still priced, and ignores the old file when the API answered", () => {
  const pages = new Map([["opus-5-5", { url: m.modelPageUrl("opus-5-5"), md: fixture("model-opus-5-5.md") }]]);
  const base = { pricingMd: fixture("pricing.md"), overviewMd: "", deprecationsMd: fixture("model-deprecations.md"), pages, fetchedAt: NOW.toISOString() };
  const plain = m.buildMetadata(base);
  const opus = plain.models.find((x) => x.id === "claude-opus-5-5");
  assert.equal(opus.maxInputTokens, null);
  const listed = (field) => ({ ...opus.sources, modelsApi: [field] });
  const prevOf = (patch) => ({ models: [{ ...opus, ...patch }, { id: "claude-gone-1", maxInputTokens: 5, sources: { modelsApi: ["maxInputTokens"] } }] });
  // Listed and valid: kept, and listed again.
  const kept = m.buildMetadata({ ...base, previous: prevOf({ maxInputTokens: 333_000, sources: listed("maxInputTokens") }) });
  const keptOpus = kept.models.find((x) => x.id === "claude-opus-5-5");
  assert.equal(keptOpus.maxInputTokens, 333_000);
  assert.deepEqual(keptOpus.sources.modelsApi, ["maxInputTokens"]);
  assert.ok(!kept.models.some((x) => x.id === "claude-gone-1"), "a model gone from the pricing page drops");
  assert.deepEqual(m.validateMetadata(kept), []);
  // Not listed in sources.modelsApi (a hand edit), or not a positive integer: not kept.
  for (const patch of [
    { maxInputTokens: 333_000 },
    { maxInputTokens: 0, sources: listed("maxInputTokens") },
    { maxInputTokens: "333000", sources: listed("maxInputTokens") },
    { maxInputTokens: 333_000, sources: { ...opus.sources, modelsApi: "maxInputTokens" } },
  ]) {
    assert.deepEqual(m.buildMetadata({ ...base, previous: prevOf(patch) }).models, plain.models, JSON.stringify(patch));
  }
  // The API answered (even with nothing for this model): the old file is not used.
  const answered = m.buildMetadata({ ...base, apiLimits: new Map(), previous: prevOf({ maxInputTokens: 333_000, sources: listed("maxInputTokens") }) });
  assert.deepEqual(answered.models, plain.models);
  // A docs figure is never replaced by a kept one.
  const docsWin = m.buildMetadata({ ...base, previous: prevOf({ contextWindow: 1, sources: listed("contextWindow") }) });
  assert.equal(docsWin.models.find((x) => x.id === "claude-opus-5-5").contextWindow, opus.contextWindow);
  // No old file, or one of the wrong shape: nothing kept.
  for (const previous of [null, {}, { models: "x" }, { models: [null] }]) assert.deepEqual(m.buildMetadata({ ...base, previous }).models, plain.models);
});

test("keep: an old file that is not JSON keeps nothing and is rewritten", async () => {
  const root = tmp();
  fs.mkdirSync(path.dirname(dataFile(root)), { recursive: true });
  fs.writeFileSync(dataFile(root), "{ not json");
  const r = await m.run({ root, fetchImpl: stubFetch(), now: NOW, retryStamp: path.join(tmp(), "s") });
  assert.equal(r.action, "updated");
  assert.ok(JSON.parse(fs.readFileSync(dataFile(root), "utf8")).models.every((x) => x.sources.modelsApi.length === 0));
});

// ---- Hook command strings -------------------------------------------------------------------------------------

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const CMD = 'node "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/update-model-metadata.mjs"';
const PS = "node .claude/hooks/update-model-metadata.mjs";

test("commands: templates, installed settings and Copilot files agree on the bash command, carry cwd '.', and keep the PowerShell form", () => {
  const claudeT = readJson(path.join(skillDir, "templates", "claude-hook.json")).hooks;
  const copilotT = readJson(path.join(skillDir, "templates", "copilot-hook.json")).hooks;
  const claudeI = readJson(path.join(repo, ".claude", "settings.json")).hooks;
  const copilotI = readJson(path.join(repo, ".github", "hooks", "ai-dlc-model-metadata.json")).hooks;
  const ours = (groups) => groups.flatMap((g) => g.hooks).filter((h) => /update-model-metadata/.test(h.command));
  assert.equal(ours(claudeT.Stop)[0].command, CMD);
  assert.equal(ours(claudeT.PreToolUse)[0].command, `${CMD} --before-commit`);
  assert.equal(ours(claudeI.Stop)[0].command, CMD, "installed Stop = template");
  assert.equal(ours(claudeI.PreToolUse)[0].command, `${CMD} --before-commit`, "installed PreToolUse = template");
  assert.equal(claudeT.PreToolUse[0].matcher, "Bash");
  for (const [claudeEvent, copilotEvent, args] of [["Stop", "agentStop", ""], ["PreToolUse", "preToolUse", " --before-commit"]]) {
    for (const file of [copilotT, copilotI]) {
      assert.equal(file[copilotEvent].length, 1);
      const h = file[copilotEvent][0];
      assert.equal(h.bash, ours(claudeT[claudeEvent])[0].command, `${copilotEvent}: Copilot bash = Claude command`);
      assert.equal(h.powershell, PS + args, `${copilotEvent}: powershell`);
      assert.equal(h.cwd, ".", `${copilotEvent}: cwd`);
    }
  }
  assert.deepEqual(copilotT, copilotI, "the installed Copilot file is the template");
});

test("commands: only the pre-commit entries pass --before-commit, and no command passes --force", () => {
  const all = [path.join(repo, ".claude", "settings.json"), path.join(repo, ".github", "hooks", "ai-dlc-model-metadata.json"), path.join(skillDir, "templates", "claude-hook.json"), path.join(skillDir, "templates", "copilot-hook.json")];
  for (const p of all) {
    const entries = fs.readFileSync(p, "utf8").split("\n").filter((l) => /update-model-metadata/.test(l));
    assert.ok(entries.length >= 2, p);
    assert.ok(entries.every((l) => !l.includes("--force")), `${p}: no --force`);
    assert.equal(entries.filter((l) => l.includes("--before-commit")).length * 2, entries.length, `${p}: half the entries are the pre-commit ones`);
  }
});

const gitBash = process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\bash.exe" : "bash";
test("commands: the bash path expands to ./.claude/... when CLAUDE_PROJECT_DIR is unset or empty, and to the project dir when set",
  { skip: !fs.existsSync(gitBash) && process.platform === "win32" }, () => {
    const expand = (dir) => spawnSync(gitBash, ["-c", `printf %s "\${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/update-model-metadata.mjs"`], {
      cwd: repo, encoding: "utf8", env: cleanEnv({ CLAUDE_PROJECT_DIR: dir }),
    }).stdout;
    assert.ok(CMD.includes('"${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/update-model-metadata.mjs"'));
    assert.equal(expand(undefined), "./.claude/hooks/update-model-metadata.mjs");
    assert.equal(expand(""), "./.claude/hooks/update-model-metadata.mjs");
    assert.equal(expand("/some/proj"), "/some/proj/.claude/hooks/update-model-metadata.mjs");
  });
