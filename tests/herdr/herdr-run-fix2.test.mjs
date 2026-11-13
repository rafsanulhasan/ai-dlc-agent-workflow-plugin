// herdr.mjs fix round 2 (AAWP-20261112 step 1.2.l2, re-test 1.3.l2): a hang-up of the pane stops the child's tree and still writes `.exit`
// (AC-9 never block, AC-10 run-in-pane), the SIGKILL timer does not keep the wrapper alive, and a pane copy whose markers the pane wrapped
// still decodes (AC-10 fallback). herdr and claude are fake executables on a temp PATH (a boundary the repository does not own); the
// wrapper runs as the real script, in its own process.
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { sandbox, claudeOk, until, HERDR_MJS } from "./helpers/fake-bin.mjs";
import { encodePaneCopy, decodePaneCopy, killTree } from "../../plugins/claude/ai-dlc/skills/herdr/scripts/herdr.mjs";

const boxes = [];
const box = (label = "fix2") => { const sb = sandbox(label); boxes.push(sb); return sb; };
afterEach(() => { while (boxes.length) boxes.pop().cleanup(); });

const NONCE = "0123456789ab";
const OTHER = "ffffffffffff";
const OUT = ".scratch/herdr/RUN-1/1.2-agent-manager.result.md";
const RECORD = "docs/handoffs/RUN-1/1.2-orchestrator-to-agent-manager.handoff.md";
const WIN = process.platform === "win32";
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- marker wrap: decodePaneCopy -----------------------------------------------------------------------------------
describe("decodePaneCopy: markers the pane wrapped still decode [AC-10 fallback]", () => {
  const TEXT = "handoff 1.2-x.handoff.md: passed — built it\n\n\ttabbed  \nline éè 中文\r\n";
  const block = (text = TEXT, nonce = NONCE) => encodePaneCopy(text, nonce);
  const lines = (b) => b.split("\n");
  /** Insert `ws` into the marker line `which` (0 = BEGIN, last non-empty = END) at every position, one position at a time. */
  const everySplit = (b, which, ws) => {
    const ls = lines(b);
    const idx = which === "begin" ? 0 : ls.length - 2;
    const out = [];
    for (let i = 0; i <= ls[idx].length; i++) {
      const copy = [...ls];
      copy[idx] = ls[idx].slice(0, i) + ws + ls[idx].slice(i);
      out.push([i, copy.join("\n")]);
    }
    return out;
  };

  for (const which of ["begin", "end"]) {
    for (const [label, ws] of [["LF", "\n"], ["CRLF", "\r\n"], ["blanks around a line end", "  \r\n  "]]) {
      test(`[AC-10] the ${which.toUpperCase()} marker split by ${label} at every character position decodes`, () => {
        for (const [i, text] of everySplit(block(), which, ws)) {
          assert.deepEqual(decodePaneCopy(text, NONCE), { ok: true, text: TEXT }, `split at ${i}: ${JSON.stringify(text.split("\n").slice(0, 2))}`);
        }
      });
    }
  }

  test("[AC-10] the whole block re-wrapped at 30 columns (markers, base64 rows and all), LF and CRLF, decodes", () => {
    const b = block();
    for (const eol of ["\n", "\r\n"]) {
      const wrapped = lines(b).filter((l, i, a) => !(i === a.length - 1 && l === "")).map((l) => l.match(/.{1,30}/g).join(eol)).join(eol);
      assert.ok(wrapped.split(eol).every((l) => l.length <= 30));
      assert.deepEqual(decodePaneCopy(`$ node herdr.mjs child x${eol}${wrapped}${eol}$ `, NONCE), { ok: true, text: TEXT });
    }
  });

  test("[AC-10] the block re-wrapped at 30 columns where a terminal also drops the space at the wrap point decodes", () => {
    const b = block();
    const wrapped = lines(b).filter((l) => l !== "").map((l) => l.match(/.{1,30}/g).map((c) => c.trim()).join("\n")).join("\n");
    assert.deepEqual(decodePaneCopy(wrapped, NONCE), { ok: true, text: TEXT });
  });

  test("[AC-10] a block of another nonce, wrapped at every position of its markers, never decodes for this nonce: markers missing", () => {
    for (const which of ["begin", "end"]) for (const [i, text] of everySplit(block(TEXT, OTHER), which, "\n")) {
      assert.deepEqual(decodePaneCopy(text, NONCE), { ok: false, reason: "markers missing" }, `${which} split at ${i}`);
    }
    const rewrapped = lines(block(TEXT, OTHER)).filter((l) => l !== "").map((l) => l.match(/.{1,30}/g).join("\n")).join("\n");
    assert.deepEqual(decodePaneCopy(rewrapped, NONCE), { ok: false, reason: "markers missing" });
  });

  test("[AC-10] a wrapped stale block of another nonce before this nonce's block is ignored, and each nonce decodes its own text", () => {
    const wrap = (b) => lines(b).filter((l) => l !== "").map((l) => l.match(/.{1,30}/g).join("\n")).join("\n");
    const pane = `${wrap(block("OLD result\n", OTHER))}\n$ next\n${wrap(block(TEXT, NONCE))}\n$ `;
    assert.deepEqual(decodePaneCopy(pane, NONCE), { ok: true, text: TEXT });
    assert.deepEqual(decodePaneCopy(pane, OTHER), { ok: true, text: "OLD result\n" });
  });

  test("[AC-10] a nonce that differs in one character is not this nonce even when the marker is wrapped", () => {
    const near = "0123456789ac";
    const wrapped = lines(block(TEXT, near)).filter((l) => l !== "").map((l) => l.match(/.{1,30}/g).join("\n")).join("\n");
    assert.deepEqual(decodePaneCopy(wrapped, NONCE), { ok: false, reason: "markers missing" });
  });

  describe("whitespace inside the byte count", () => {
    const body = "a".repeat(120);
    const withBegin = (bytesText) => block(body).replace("bytes=120>>>", `bytes=${bytesText}>>>`);
    for (const t of ["1 20", "12\n0", "1\r\n2\r\n0", " 120", "120 ", "1  2  0"]) {
      test(`[AC-10] bytes=${JSON.stringify(t)} is the count 120: decodes`, () => {
        assert.deepEqual(decodePaneCopy(withBegin(t), NONCE), { ok: true, text: body });
      });
    }
    for (const t of ["1 21", "11\n9", "1\r\n2\r\n1", "12 0 0"]) {
      test(`[AC-10] bytes=${JSON.stringify(t)} is a different count: size mismatch`, () => {
        assert.deepEqual(decodePaneCopy(withBegin(t), NONCE), { ok: false, reason: "size mismatch" });
      });
    }
    test("[AC-10] a count with a non-digit is not a BEGIN marker: markers missing", () => {
      assert.deepEqual(decodePaneCopy(withBegin("12x0"), NONCE), { ok: false, reason: "markers missing" });
    });
  });

  describe("whitespace inside the sha256", () => {
    const b = block();
    const sha = b.match(/sha256=([0-9a-f]{64})>>>/)[1];
    const withSha = (s) => b.replace(`sha256=${sha}>>>`, `sha256=${s}>>>`);
    const splitAt = (s, i, ws) => s.slice(0, i) + ws + s.slice(i);
    for (const i of [1, 30, 32, 63]) for (const ws of [" ", "\n", "\r\n"]) {
      test(`[AC-10] the hash split after ${i} characters by ${JSON.stringify(ws)} decodes`, () => {
        assert.deepEqual(decodePaneCopy(withSha(splitAt(sha, i, ws)), NONCE), { ok: true, text: TEXT });
      });
    }
    test("[AC-10] the hash on a line of its own (whitespace around it) decodes", () => {
      assert.deepEqual(decodePaneCopy(withSha(`\n${sha}\n`), NONCE), { ok: true, text: TEXT });
    });
    test("[AC-10] a wrong hash that is also split is a hash mismatch, not markers missing", () => {
      const bad = (sha[0] === "0" ? "1" : "0") + sha.slice(1);
      assert.deepEqual(decodePaneCopy(withSha(splitAt(bad, 30, "\n")), NONCE), { ok: false, reason: "hash mismatch" });
    });
    test("[AC-10] 63 hex characters, 65 hex characters, an uppercase digit or a non-hex character is not an END marker: markers missing", () => {
      for (const s of [sha.slice(1), `${sha}0`, sha.replace(/[a-f]/, "A") === sha ? `${sha.slice(0, 63)}G` : sha.replace(/[a-f]/, "A"), `${sha.slice(0, 63)}g`]) {
        assert.deepEqual(decodePaneCopy(withSha(s), NONCE), { ok: false, reason: "markers missing" }, s);
      }
    });
  });

  test("[AC-10] wrapped markers do not weaken the checks: bad base64 and a body cut short are still reported", () => {
    const b = block();
    const ls = lines(b);
    const bad = [ls[0].replace("bytes=", "bytes=\n"), "@@@@", ls.at(-2).replace("sha256=", "sha256=\n")].join("\n");
    assert.deepEqual(decodePaneCopy(bad, NONCE), { ok: false, reason: "invalid base64" });
    const cut = [ls[0].replace("encoding", "enc\noding"), ...ls.slice(1, 2), ls.at(-2)].join("\n");
    assert.deepEqual(decodePaneCopy(cut, NONCE), { ok: false, reason: "size mismatch" });
  });
});

// ---- killTree: the SIGKILL timer is unref'd -------------------------------------------------------------------------
describe("killTree: the delayed SIGKILL does not keep the wrapper alive [AC-9]", () => {
  test("[AC-9] POSIX path: the 5 s SIGKILL timer is armed and unref'd (a hung-up wrapper exits at once, not 5 s later)", () => {
    const real = globalThis.setTimeout;
    const timers = [];
    globalThis.setTimeout = (fn, ms, ...rest) => { const t = real(fn, ms, ...rest); timers.push({ t, ms }); return t; };
    try {
      killTree({ pid: 2147483646, kill() {} }, "linux");
    } finally { globalThis.setTimeout = real; }
    try {
      assert.equal(timers.length, 1, "one SIGKILL timer");
      assert.equal(timers[0].ms, 5000);
      assert.equal(timers[0].t.hasRef(), false, "the timer is unref'd");
    } finally { for (const { t } of timers) clearTimeout(t); }
  });

  test("[AC-9] win32 path (platform injected): no timer is armed", () => {
    const real = globalThis.setTimeout;
    const timers = [];
    globalThis.setTimeout = (fn, ms, ...rest) => { const t = real(fn, ms, ...rest); timers.push(t); return t; };
    try { killTree({ pid: 2147483646, kill() {} }, "win32"); } finally { globalThis.setTimeout = real; for (const t of timers) clearTimeout(t); }
    assert.equal(timers.length, 0);
  });
});

// ---- the wrapper as a process: hang-up, EPIPE, handler lifecycle ---------------------------------------------------------
const jobFile = (sb, over = {}) => sb.write(".scratch/herdr/RUN-1/1.2-agent-manager.job.json", JSON.stringify({ kind: "child", agent: "agent-manager", record: RECORD, out: OUT, timeoutMinutes: 5, root: sb.root, nonce: NONCE, ...over }));
const claudeStarted = (sb) => sb.entries("claude").length > 0;
const readExit = (sb) => { const t = sb.read(`${OUT}.exit`); return t === undefined ? undefined : JSON.parse(t); };
const finished = (proc) => new Promise((resolve) => { proc.on("close", (code, signal) => resolve({ code, signal })); });

/**
 * An in-process harness: herdr.mjs `main(["child", job])` runs in a node process of its own; `process.emit("SIGHUP")` is the hang-up
 * (a real signal cannot be sent on Windows). It records the SIGHUP / SIGINT / SIGTERM listener counts before, during and after the run
 * and waits for the file `go` (so the test can close its end of the harness's stdout first) before it hangs up.
 */
function harness(sb, { hangUp }) {
  const script = `
    import fs from "node:fs";
    const { main } = await import(process.env.H_MJS);
    const count = () => ({ hup: process.listenerCount("SIGHUP"), int: process.listenerCount("SIGINT"), term: process.listenerCount("SIGTERM") });
    const base = count();
    const run = main(["child", process.env.H_JOB, "--root", process.env.H_ROOT]);
    const wait = async (fn) => { while (!fn()) await new Promise((r) => setTimeout(r, 25)); };
    let during;
    if (process.env.H_HANGUP === "1") {
      await wait(() => fs.existsSync(process.env.FAKE_LOG) && fs.readFileSync(process.env.FAKE_LOG, "utf8").includes('"who":"claude"'));
      during = count();
      await wait(() => fs.existsSync(process.env.H_GO));
      process.emit("SIGHUP");
    }
    const code = await run;
    fs.writeFileSync(process.env.H_REPORT, JSON.stringify({ base, during, after: count(), code }));
  `;
  const report = path.join(sb.base, "report.json");
  const go = path.join(sb.base, "go");
  const proc = spawn(process.execPath, ["--input-type=module", "-e", script], {
    cwd: sb.root, stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
    env: { ...sb.env(), H_MJS: pathToFileURL(HERDR_MJS).href, H_JOB: jobFile(sb), H_ROOT: sb.root, H_HANGUP: hangUp ? "1" : "0", H_REPORT: report, H_GO: go },
  });
  let out = "", err = "";
  proc.stdout.on("data", (d) => { out += d; });
  proc.stderr.on("data", (d) => { err += d; });
  // A missing hang-up handler would leave claude hanging: bound the harness so that shows as a failure, not a stuck run.
  const guard = setTimeout(() => { try { proc.kill(); } catch {} }, 60000);
  proc.on("close", () => clearTimeout(guard));
  return { proc, go: () => fs.writeFileSync(go, ""), report: () => (fs.existsSync(report) ? JSON.parse(fs.readFileSync(report, "utf8")) : undefined), out: () => out, err: () => err, done: finished(proc) };
}

describe("child wrapper: a hang-up of the pane [AC-9, AC-10]", () => {
  test("[AC-10] no signal: the SIGHUP, SIGINT and SIGTERM handlers are registered while claude runs and all removed after it closes", async () => {
    const sb = box("handlers");
    sb.install({ claude: claudeOk({ result: "handoff r.md: passed — ok\nbody" }) });
    const h = harness(sb, { hangUp: false });
    const { code } = await h.done;
    assert.equal(code, 0, h.err());
    const r = h.report();
    assert.ok(r, `a report: ${h.err()}`);
    assert.deepEqual(r.after, r.base, "listeners are removed");
    assert.equal(r.code, 0);
    assert.equal(readExit(sb).usable, true);
  });

  test("[AC-9][AC-10] SIGHUP while claude runs: the handler is registered during the run and removed after; claude's tree is stopped; .exit says usable:false; exit 0", async () => {
    const sb = box("hup");
    sb.install({ claude: { hang: true } });
    const h = harness(sb, { hangUp: true });
    assert.equal(await until(() => claudeStarted(sb), 30000), true, `claude started: ${h.err()}`);
    const pid = sb.entries("claude")[0].pid;
    assert.equal(alive(pid), true, "claude is running before the hang-up");
    h.go();
    const { code } = await h.done;
    assert.equal(code, 0, h.err());
    const r = h.report();
    assert.ok(r, `a report: ${h.err()}`);
    assert.deepEqual([r.during.hup, r.during.int, r.during.term], [r.base.hup + 1, r.base.int + 1, r.base.term + 1], "handlers registered during the run");
    assert.deepEqual(r.after, r.base, "handlers removed after");
    assert.equal(r.code, 0);
    assert.equal(await until(() => !alive(pid), 15000), true, "claude (the tree) is gone");
    const ex = readExit(sb);
    assert.ok(ex, ".exit is written");
    assert.equal(ex.usable, false);
    assert.match(ex.reason, /^claude (did not exit normally|exited \d+)$/);
    assert.equal(ex.paneCopy, false);
    assert.equal(ex.nonce, NONCE);
    assert.equal(sb.exists(OUT), false, "no result file for a hung-up run");
    assert.match(h.out(), /\[no usable result: claude (did not exit normally|exited \d+)\]/);
  });

  test("[AC-9] SIGHUP after the pane is gone (the wrapper's stdout is a closed pipe): the write failure (EPIPE) does not crash the wrapper before .exit", async () => {
    const sb = box("epipe");
    sb.install({ claude: { hang: true } });
    const h = harness(sb, { hangUp: true });
    assert.equal(await until(() => claudeStarted(sb), 30000), true, `claude started: ${h.err()}`);
    h.proc.stdout.destroy();
    await sleep(500);
    h.go();
    const { code } = await h.done;
    assert.equal(code, 0, `no crash: ${h.err()}`);
    assert.doesNotMatch(h.err(), /EPIPE|Unhandled 'error'|ERR_STREAM|uncaught/i);
    const ex = readExit(sb);
    assert.ok(ex, ".exit is written although nothing could be printed");
    assert.equal(ex.usable, false);
    assert.equal(h.report()?.code, 0);
  });

  test("[AC-9] the timeout path and a normal finish still write .exit (the hang-up handler changed neither): a run that ends by itself", async () => {
    const sb = box("timeout");
    sb.install({ claude: { hang: true } });
    // timeoutMinutes is a number > 0; a fraction of a minute keeps the test short.
    const proc = spawn(process.execPath, [HERDR_MJS, "child", jobFile(sb, { timeoutMinutes: 0.02 }), "--root", sb.root], { cwd: sb.root, env: sb.env(), stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let out = "";
    proc.stdout.on("data", (d) => { out += d; });
    proc.stderr.resume();
    const { code } = await finished(proc);
    assert.equal(code, 0);
    assert.match(out, /\[no usable result: timed out after 0\.02 min\]/);
    assert.equal(readExit(sb).reason, "timed out after 0.02 min");
  });

  // Real signals: POSIX only (on win32 process.kill(pid, "SIGHUP") terminates the process without running any handler).
  const posix = { skip: WIN ? "win32: a real SIGHUP cannot be delivered to a handler on Windows (process.kill terminates the process, so no handler runs); the in-process harness tests above cover the handler" : false };

  test("[AC-9][AC-10] a real SIGHUP to the wrapper: claude is stopped, .exit is written with usable:false, exit 0, and the wrapper exits at once (the SIGKILL timer is unref'd)", posix, async () => {
    const sb = box("realhup");
    sb.install({ claude: { hang: true } });
    const proc = spawn(process.execPath, [HERDR_MJS, "child", jobFile(sb), "--root", sb.root], { cwd: sb.root, env: sb.env(), stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    proc.stdout.on("data", (d) => { out += d; });
    proc.stderr.resume();
    const done = finished(proc);
    assert.equal(await until(() => claudeStarted(sb), 15000), true, "claude started");
    const pid = sb.entries("claude")[0].pid;
    const t0 = Date.now();
    process.kill(proc.pid, "SIGHUP");
    const { code, signal } = await done;
    const ms = Date.now() - t0;
    assert.equal(signal, null, "the wrapper handled SIGHUP instead of dying of it");
    assert.equal(code, 0);
    assert.ok(ms < 4000, `the wrapper exited in ${ms} ms, not after the 5 s SIGKILL timer`);
    assert.equal(await until(() => !alive(pid), 10000), true, "claude is gone");
    const ex = readExit(sb);
    assert.equal(ex.usable, false);
    assert.equal(ex.reason, "claude did not exit normally");
    assert.match(out, /\[no usable result: claude did not exit normally\]/);
  });

  test("[AC-9] a real SIGHUP with the stdout pipe already closed: no crash, .exit is written", posix, async () => {
    const sb = box("realepipe");
    sb.install({ claude: { hang: true } });
    const proc = spawn(process.execPath, [HERDR_MJS, "child", jobFile(sb), "--root", sb.root], { cwd: sb.root, env: sb.env(), stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    proc.stderr.on("data", (d) => { err += d; });
    const done = finished(proc);
    assert.equal(await until(() => claudeStarted(sb), 15000), true, "claude started");
    proc.stdout.destroy();
    await sleep(300);
    process.kill(proc.pid, "SIGHUP");
    const { code, signal } = await done;
    assert.equal(signal, null);
    assert.equal(code, 0, err);
    assert.doesNotMatch(err, /EPIPE|Unhandled 'error'/);
    assert.equal(readExit(sb)?.usable, false);
  });

  test("[AC-9] a real SIGTERM and SIGINT still stop the tree and write .exit (the existing handlers are unchanged)", posix, async () => {
    for (const sig of ["SIGTERM", "SIGINT"]) {
      const sb = box(`real${sig}`);
      sb.install({ claude: { hang: true } });
      const proc = spawn(process.execPath, [HERDR_MJS, "child", jobFile(sb), "--root", sb.root], { cwd: sb.root, env: sb.env(), stdio: ["ignore", "pipe", "pipe"] });
      proc.stdout.resume();
      proc.stderr.resume();
      const done = finished(proc);
      assert.equal(await until(() => claudeStarted(sb), 15000), true, `${sig}: claude started`);
      const pid = sb.entries("claude")[0].pid;
      process.kill(proc.pid, sig);
      const { code, signal } = await done;
      assert.deepEqual([code, signal], [0, null], sig);
      assert.equal(await until(() => !alive(pid), 10000), true, `${sig}: claude is gone`);
      assert.equal(readExit(sb)?.usable, false, sig);
    }
  });
});
