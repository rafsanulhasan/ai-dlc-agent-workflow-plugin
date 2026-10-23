// Round 5 (fix round 4): the Models API page cap is all or nothing, one deadline covers the whole API call,
// the request that carries the key never follows a redirect, and the back-off stamp lives in the user's cache
// directory rather than the shared OS temp directory.
// No network: fetch is always a stub; the key is a fake.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..");
const skillDir = path.join(repo, "plugins", "claude", "ai-dlc", "skills", "model-metadata");
const script = path.join(skillDir, "templates", "update-model-metadata.mjs");
const m = await import(pathToFileURL(script).href);

const fixture = (n) => fs.readFileSync(path.join(here, "fixtures", n), "utf8");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "model-metadata-r5-"));
const dataFile = (root) => path.join(root, ".ai-dlc", "model-metadata.json");
const NOW = new Date("2026-10-23T12:00:00.000Z");
const later = (min) => new Date(NOW.getTime() + min * 60_000);
const FAKE_KEY = "sk-ant-test-not-a-real-key-5555";

function stubFetch({ api, overrides = {} } = {}) {
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
      const a = typeof api === "function" ? await api(url, opts) : api;
      if (a instanceof Error) throw a;
      if (typeof a === "number") return { ok: false, status: a, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => a };
    }
    const body = pages[url];
    if (body == null) return { ok: false, status: 404, text: async () => "" };
    return { ok: true, status: 200, text: async () => body };
  };
  fn.calls = calls;
  fn.apiCalls = () => calls.filter((c) => c.url.startsWith(m.MODELS_API));
  return fn;
}

const endless = () => {
  let n = 0;
  return () => { n++; return { data: [{ id: `claude-p${n}`, max_input_tokens: n, max_tokens: n }], has_more: true, last_id: `claude-p${n}` }; };
};

// ---- 1. Page cap: all or nothing ------------------------------------------------------------------------------

test("page cap: the last allowed page saying has_more yields null; the same pages ending there yield the list", async () => {
  assert.equal(await m.fetchApiLimits({ apiKey: FAKE_KEY, fetchImpl: stubFetch({ api: endless() }) }), null);
  // Exactly MODELS_API_MAX_PAGES pages, the last with has_more false: complete, so kept.
  let n = 0;
  const exact = () => { n++; return { data: [{ id: `claude-p${n}`, max_input_tokens: n, max_tokens: n }], has_more: n < m.MODELS_API_MAX_PAGES, last_id: `claude-p${n}` }; };
  const f = stubFetch({ api: exact });
  const limits = await m.fetchApiLimits({ apiKey: FAKE_KEY, fetchImpl: f });
  assert.equal(f.apiCalls().length, m.MODELS_API_MAX_PAGES);
  assert.equal(limits.size, m.MODELS_API_MAX_PAGES);
});

test("page cap: a truncated list fills nothing, and the figures an earlier run filled are kept", async () => {
  const root = tmp();
  const retryStamp = path.join(tmp(), "s");
  const seed = { data: [{ id: "claude-opus-5-5", max_input_tokens: 1_000_000, max_tokens: 1 }], has_more: false };
  assert.equal((await m.run({ root, fetchImpl: stubFetch({ api: seed }), now: NOW, retryStamp, apiKey: FAKE_KEY })).action, "updated");
  const before = fs.readFileSync(dataFile(root), "utf8");
  // An endless list whose pages would change the figure: discarded, so the file stays as it was.
  let n = 0;
  const changing = () => { n++; return { data: [{ id: "claude-opus-5-5", max_input_tokens: 5, max_tokens: 5 }], has_more: true, last_id: `claude-x${n}` }; };
  const r = await m.run({ root, fetchImpl: stubFetch({ api: changing }), now: later(1), retryStamp, apiKey: FAKE_KEY });
  assert.equal(r.action, "unchanged");
  assert.equal(fs.readFileSync(dataFile(root), "utf8"), before);
});

// ---- 2. One deadline for the whole API call -------------------------------------------------------------------

test("deadline: every page of one call shares a single AbortSignal; a new call gets a new one", async () => {
  let n = 0;
  const pagesOf3 = () => { n++; return { data: [], has_more: n < 3, last_id: `claude-p${n}` }; };
  const f = stubFetch({ api: pagesOf3 });
  await m.fetchApiLimits({ apiKey: FAKE_KEY, fetchImpl: f });
  const signals = f.apiCalls().map((c) => c.opts.signal);
  assert.equal(signals.length, 3);
  assert.ok(signals[0] instanceof AbortSignal);
  assert.ok(signals.every((s) => s === signals[0]), "one signal for all pages");
  const g = stubFetch({ api: { data: [], has_more: false } });
  await m.fetchApiLimits({ apiKey: FAKE_KEY, fetchImpl: g });
  assert.notEqual(g.apiCalls()[0].opts.signal, signals[0]);
});

test("deadline: the budgets fit well inside the 60 s hook timeout of every hook entry", () => {
  assert.ok(m.MODELS_API_DEADLINE_MS <= 20_000, "the API deadline is at most 20 s");
  // Docs: the three index pages, then the model pages, each request at most REQUEST_TIMEOUT_MS; the API call runs alongside.
  const worst = Math.max(2 * m.REQUEST_TIMEOUT_MS, m.MODELS_API_DEADLINE_MS);
  assert.ok(worst <= 20_000, `worst case ${worst} ms`);
  const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
  const claude = [readJson(path.join(skillDir, "templates", "claude-hook.json")), readJson(path.join(repo, ".claude", "settings.json"))]
    .flatMap((f) => Object.values(f.hooks).flat()).flatMap((g) => g.hooks).filter((h) => /update-model-metadata/.test(h.command)).map((h) => h.timeout);
  const copilot = [readJson(path.join(skillDir, "templates", "copilot-hook.json")), readJson(path.join(repo, ".github", "hooks", "ai-dlc-model-metadata.json"))]
    .flatMap((f) => Object.values(f.hooks).flat()).map((h) => h.timeoutSec);
  assert.ok(claude.length >= 4 && copilot.length >= 4);
  for (const t of [...claude, ...copilot]) assert.ok(worst * 2 <= t * 1000, `hook timeout ${t} s leaves at least twice the worst case`);
});

test("deadline: an abort of the shared signal mid-call yields null, never a throw or a partial list", async () => {
  let n = 0;
  const api = () => {
    n++;
    if (n === 2) throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    return { data: [{ id: "claude-a", max_input_tokens: 1, max_tokens: 1 }], has_more: true, last_id: "claude-a" };
  };
  assert.equal(await m.fetchApiLimits({ apiKey: FAKE_KEY, fetchImpl: stubFetch({ api }) }), null);
});

// ---- 3. No redirect for the request that carries the key ------------------------------------------------------

test("redirect: every Models API request sets redirect 'error'; docs requests still follow redirects", async () => {
  let n = 0;
  const two = () => { n++; return { data: [], has_more: n < 2, last_id: `claude-p${n}` }; };
  const f = stubFetch({ api: two });
  await m.fetchMetadata({ fetchImpl: f, now: NOW, apiKey: FAKE_KEY });
  const api = f.apiCalls();
  assert.equal(api.length, 2);
  for (const c of api) assert.equal(c.opts.redirect, "error");
  const docs = f.calls.filter((c) => !c.url.startsWith(m.MODELS_API));
  assert.ok(docs.length > 0);
  for (const c of docs) assert.equal(c.opts.redirect, "follow", c.url);
});

test("redirect: fetch rejecting on a redirect (as redirect 'error' does) yields null and the refresh still succeeds", async () => {
  const root = tmp();
  const r = await m.run({ root, fetchImpl: stubFetch({ api: new TypeError("fetch failed: unexpected redirect") }), now: NOW, retryStamp: path.join(tmp(), "s"), apiKey: FAKE_KEY });
  assert.equal(r.action, "updated");
  assert.ok(!fs.readFileSync(dataFile(root), "utf8").includes(FAKE_KEY));
});

// ---- 4. The back-off stamp in the user's cache directory ------------------------------------------------------

test("stamp: XDG_CACHE_HOME first (absolute only), then LOCALAPPDATA on Windows, then ~/.cache", () => {
  const home = path.resolve(tmp());
  const h = () => home;
  const xdg = path.resolve(tmp());
  const local = path.resolve(tmp());
  assert.equal(m.userCacheDir({ XDG_CACHE_HOME: xdg, LOCALAPPDATA: local }, "win32", h), xdg);
  assert.equal(m.userCacheDir({ XDG_CACHE_HOME: "relative/dir", LOCALAPPDATA: local }, "win32", h), local, "a relative XDG_CACHE_HOME is ignored");
  assert.equal(m.userCacheDir({ LOCALAPPDATA: local }, "linux", h), path.join(home, ".cache"), "LOCALAPPDATA only on Windows");
  assert.equal(m.userCacheDir({ XDG_CACHE_HOME: "" }, "darwin", h), path.join(home, ".cache"));
  assert.equal(m.userCacheDir({}, "linux", () => ""), null, "no home directory: no cache directory");
  assert.equal(m.userCacheDir({}, "linux", () => { throw new Error("no home"); }), null);
});

test("stamp: the path is <cache>/ai-dlc/model-metadata-<hash>.retry, per root, never under the OS temp directory by default", () => {
  const xdg = path.resolve(tmp());
  const p = m.retryStampPath("/some/repo", { XDG_CACHE_HOME: xdg }, "linux");
  assert.equal(path.dirname(p), path.join(xdg, "ai-dlc"));
  assert.match(path.basename(p), /^model-metadata-[0-9a-f]{16}\.retry$/);
  assert.notEqual(p, m.retryStampPath("/some/other", { XDG_CACHE_HOME: xdg }, "linux"));
  assert.equal(m.retryStampPath("/x", {}, "linux", () => ""), null);
  assert.notEqual(path.dirname(path.dirname(m.retryStampPath("/some/repo"))), os.tmpdir());
});

test("stamp: a failure creates the ai-dlc folder in the cache directory, and a success removes only the stamp", async () => {
  const xdg = path.resolve(tmp());
  const root = tmp();
  const retryStamp = m.retryStampPath(root, { XDG_CACHE_HOME: xdg }, process.platform);
  assert.equal(fs.existsSync(path.dirname(retryStamp)), false);
  const bad = await m.run({ root, fetchImpl: stubFetch({ overrides: { [m.SOURCES.pricing]: null } }), now: NOW, retryStamp });
  assert.equal(bad.action, "failed");
  assert.equal(fs.statSync(retryStamp).mtimeMs, NOW.getTime());
  if (process.platform !== "win32") assert.equal(fs.statSync(path.dirname(retryStamp)).mode & 0o077, 0, "the folder is private to its user");
  assert.equal((await m.run({ root, fetchImpl: stubFetch(), now: later(5), retryStamp })).action, "skipped");
  assert.equal((await m.run({ root, fetchImpl: stubFetch(), now: later(11), retryStamp })).action, "updated");
  assert.equal(fs.existsSync(retryStamp), false);
  assert.ok(fs.existsSync(path.dirname(retryStamp)), "the folder stays");
});

test("stamp: with no cache directory (retryStamp null) a failure is reported, nothing is stamped, and the next run tries again", async () => {
  const root = tmp();
  const bad = await m.run({ root, fetchImpl: stubFetch({ overrides: { [m.SOURCES.pricing]: null } }), now: NOW, retryStamp: null });
  assert.equal(bad.action, "failed");
  const f = stubFetch();
  assert.equal((await m.run({ root, fetchImpl: f, now: later(1), retryStamp: null })).action, "updated");
  assert.ok(f.calls.length > 0);
});

// ---- 5. One API_FIELDS list -----------------------------------------------------------------------------------

test("fields: validation accepts the three API fields and names them in fill order", () => {
  const pages = new Map([["opus-5-5", { url: m.modelPageUrl("opus-5-5"), md: fixture("model-opus-5-5.md") }]]);
  const doc = m.buildMetadata({ pricingMd: fixture("pricing.md"), overviewMd: "", deprecationsMd: fixture("model-deprecations.md"), pages, fetchedAt: NOW.toISOString() });
  assert.deepEqual(m.validateMetadata(doc), []);
  const bad = structuredClone(doc);
  bad.models[0].sources.modelsApi = ["longContextWindow"];
  const [problem] = m.validateMetadata(bad);
  assert.match(problem, /among maxInputTokens, contextWindow, maxOutputTokens$/);
});

// ---- 6. Page size: the documented maximum ---------------------------------------------------------------------

test("page size: the request asks for the documented maximum, 1000 (limit: 'Ranges from 1 to 1000')", async () => {
  assert.equal(m.MODELS_API_PAGE_SIZE, 1000);
  const f = stubFetch({ api: { data: [], has_more: false } });
  await m.fetchApiLimits({ apiKey: FAKE_KEY, fetchImpl: f });
  assert.equal(f.apiCalls()[0].url, `${m.MODELS_API}?limit=1000`);
});
