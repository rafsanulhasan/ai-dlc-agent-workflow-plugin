// herdr.mjs result retrieval (amended AC-10: the result file is the main path, a verified pane copy the fallback; AC-11: a result no path can
// produce is a failed hand-back), the child's finish step, childCommand's field validation, killTree (LLD 1.1.6.l2 sections 3.3, 3.4, 3.8, 7).
// Pure functions run in process; finishChild runs in a real subprocess (it writes to stdout); the end-to-end cases run the real script against
// the fake herdr (its `pane read` prints a pane copy built independently of the script, see helpers/fake-exe.mjs).
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { sandbox, herdrCalls, pane, claudeOk, notFound, until, HERDR_MJS } from "./helpers/fake-bin.mjs";
import { encodePaneCopy, decodePaneCopy, retrieveResult, finishChild, childCommand, killTree, PANE_COPY_MAX_BYTES, PANE_COPY_WIDTH } from "../../plugins/claude/ai-dlc/skills/herdr/scripts/herdr.mjs";

const boxes = [];
const box = (label = "fallback") => { const sb = sandbox(label); boxes.push(sb); return sb; };
afterEach(() => { while (boxes.length) boxes.pop().cleanup(); });

const sha = (t) => crypto.createHash("sha256").update(Buffer.from(t, "utf8")).digest("hex");
const NONCE = "0123456789ab";
const OTHER = "ffffffffffff";
const TEXT = "handoff 1.2-orchestrator-to-agent-manager.handoff.md: passed — built it\n\n\ttabbed  \nline éè 中文\r\n\u001b[31mred\u001b[0m   \n";

describe("encodePaneCopy / decodePaneCopy: the pane copy block [AC-10 fallback]", () => {
  test("[AC-10] the block is BEGIN marker (nonce, base64, bytes), base64 rows of 76 columns, END marker (nonce, sha256), LF line ends", () => {
    const block = encodePaneCopy(TEXT, NONCE);
    const lines = block.split("\n");
    const bytes = Buffer.byteLength(TEXT);
    assert.equal(lines[0], `<<<HERDR-RESULT-BEGIN-${NONCE} encoding=base64 bytes=${bytes}>>>`);
    assert.equal(lines.at(-2), `<<<HERDR-RESULT-END-${NONCE} sha256=${sha(TEXT)}>>>`);
    assert.equal(lines.at(-1), "", "ends with a line end");
    assert.equal(block.includes("\r"), false);
    const rows = lines.slice(1, -2);
    assert.ok(rows.length > 1);
    assert.ok(rows.slice(0, -1).every((r) => r.length === PANE_COPY_WIDTH), "every row but the last is 76 columns");
    assert.ok(rows.at(-1).length <= PANE_COPY_WIDTH);
    assert.equal(Buffer.from(rows.join(""), "base64").toString("utf8"), TEXT);
  });

  test("[AC-10] round trip is byte for byte: tabs, trailing blanks, CRLF, ANSI, non-ASCII, a lone line, an exact multiple of 76", () => {
    for (const text of [TEXT, "x", "a\tb  \r\n", "\u001b[1mbold\u001b[0m", "—é中😀", "k".repeat(57), "k".repeat(57 * 5), "\n\n\n", " ", "line1\nline2"]) {
      const got = decodePaneCopy(encodePaneCopy(text, NONCE), NONCE);
      assert.deepEqual(got, { ok: true, text }, JSON.stringify(text));
    }
  });

  test("[AC-10] the whitespace the pane adds does not matter: CRLF rows, trailing blanks, rows re-wrapped at 40 columns, a shell prompt around the block", () => {
    const block = encodePaneCopy(TEXT, NONCE);
    const crlf = block.split("\n").map((l) => `${l}   \r`).join("\n");
    assert.deepEqual(decodePaneCopy(`$ node herdr.mjs child x\r\nnoise\r\n${crlf}\r\n$ `, NONCE), { ok: true, text: TEXT });
    const [begin, , end] = [block.split("\n")[0], 0, block.split("\n").at(-2)];
    const b64 = Buffer.from(TEXT, "utf8").toString("base64");
    const wrapped = [begin, ...b64.match(/.{1,40}/g), end].join("\n");
    assert.deepEqual(decodePaneCopy(wrapped, NONCE), { ok: true, text: TEXT });
  });

  test("[AC-10] markers of another nonce are ignored (a stale block of an earlier run stays in the scrollback): markers missing", () => {
    const stale = encodePaneCopy("old result", OTHER);
    assert.deepEqual(decodePaneCopy(stale, NONCE), { ok: false, reason: "markers missing" });
    assert.deepEqual(decodePaneCopy(`${stale}\n${encodePaneCopy(TEXT, NONCE)}`, NONCE), { ok: true, text: TEXT }, "the block of this nonce is found past the stale one");
    assert.deepEqual(decodePaneCopy(`${encodePaneCopy(TEXT, NONCE)}\n${stale}`, NONCE), { ok: true, text: TEXT }, "and before it");
  });

  test("[AC-10] with two blocks of the same nonce the last END marker and the last BEGIN before it win", () => {
    assert.deepEqual(decodePaneCopy(`${encodePaneCopy("first", NONCE)}\n${encodePaneCopy("second", NONCE)}`, NONCE), { ok: true, text: "second" });
  });

  test("[AC-10] markers missing: no text, no END, no BEGIN, END before BEGIN, a malformed nonce", () => {
    const block = encodePaneCopy(TEXT, NONCE);
    const [begin, ...rest] = block.split("\n");
    const end = rest.at(-2);
    for (const t of [undefined, null, "", "plain output", begin, `${begin}\nQUJD`, `${end}\n${begin}`, block.replace("BEGIN", "BEGAN")]) assert.deepEqual(decodePaneCopy(t, NONCE), { ok: false, reason: "markers missing" }, String(t).slice(0, 30));
    for (const n of [undefined, null, "", "xyz", "0123456789AB", "0123456789abc", 5]) assert.deepEqual(decodePaneCopy(block, n), { ok: false, reason: "markers missing" }, String(n));
  });

  test("[AC-10] a byte count that differs is `size mismatch`, a sha256 that differs is `hash mismatch`, text that is not base64 is `invalid base64`", () => {
    const b64 = Buffer.from(TEXT, "utf8").toString("base64");
    const mk = (bytes, body, hash) => `<<<HERDR-RESULT-BEGIN-${NONCE} encoding=base64 bytes=${bytes}>>>\n${body}\n<<<HERDR-RESULT-END-${NONCE} sha256=${hash}>>>\n`;
    const n = Buffer.byteLength(TEXT);
    assert.deepEqual(decodePaneCopy(mk(n + 1, b64, sha(TEXT)), NONCE), { ok: false, reason: "size mismatch" });
    assert.deepEqual(decodePaneCopy(mk(n - 1, b64, sha(TEXT)), NONCE), { ok: false, reason: "size mismatch" });
    assert.deepEqual(decodePaneCopy(mk(n, b64, sha("other")), NONCE), { ok: false, reason: "hash mismatch" });
    const tampered = Buffer.from(TEXT.replace("built", "BUILT"), "utf8").toString("base64");
    assert.deepEqual(decodePaneCopy(mk(Buffer.from(tampered, "base64").length, tampered, sha(TEXT)), NONCE), { ok: false, reason: "hash mismatch" }, "same length, other bytes");
    assert.deepEqual(decodePaneCopy(mk(n, "not base64!!", sha(TEXT)), NONCE), { ok: false, reason: "invalid base64" });
    assert.deepEqual(decodePaneCopy(mk(n, b64.slice(1), sha(TEXT)), NONCE), { ok: false, reason: "invalid base64" }, "a row lost its first character");
  });

  test("[AC-10] the cap is 16 KiB: 16384 bytes still encode and decode", () => {
    assert.equal(PANE_COPY_MAX_BYTES, 16384);
    const text = "z".repeat(PANE_COPY_MAX_BYTES);
    assert.deepEqual(decodePaneCopy(encodePaneCopy(text, NONCE), NONCE), { ok: true, text });
  });
});

describe("retrieveResult: when the pane copy is tried and when it never is [AC-10, AC-11]", () => {
  /** A sandbox, its result file, and a readPane spy. */
  function rig({ file, readPane } = {}) {
    const sb = box();
    const outFile = path.join(sb.root, ".scratch", "r.md");
    if (file !== undefined) { fs.mkdirSync(path.dirname(outFile), { recursive: true }); fs.writeFileSync(outFile, file); }
    const reads = [], sleeps = [];
    const deps = {
      readPane: (p) => { reads.push(p); return typeof readPane === "function" ? readPane(reads.length) : readPane ?? { ok: true, text: "" }; },
      sleep: async (ms) => { sleeps.push(ms); },
    };
    return { sb, outFile, reads, sleeps, deps, args: (over = {}) => ({ outFile, nonce: NONCE, pane: "w1:p2", ...over }) };
  }
  const usable = (text, over = {}) => ({ usable: true, exit: 0, bytes: Buffer.byteLength(text), sha256: sha(text), ...over });
  const copyOf = (text, nonce = NONCE) => ({ ok: true, text: `$ \n${encodePaneCopy(text, nonce)}$ ` });

  test("[AC-10] main path: .exit usable and the file matches its sha256: source file, the pane is never read", async () => {
    const r = rig({ file: TEXT });
    const got = await retrieveResult(r.args(), usable(TEXT), r.deps);
    assert.deepEqual(got, { ok: true, source: "file", text: TEXT });
    assert.deepEqual(r.reads, [], "a usable main result is never replaced by the fallback");
    assert.equal(fs.readFileSync(r.outFile, "utf8"), TEXT);
  });

  const triggers = {
    "the result file is missing": { file: undefined, ex: usable(TEXT) },
    "the result file is empty": { file: "", ex: usable(TEXT) },
    "the result file is blank": { file: "  \n\t", ex: usable(TEXT) },
    "the result file does not match the sha256 of .exit": { file: "tampered", ex: usable(TEXT) },
    "the .exit has no sha256 (a hand-written fixture)": { file: TEXT, ex: { usable: true, exit: 0 } },
    "the .exit sha256 is not text": { file: TEXT, ex: { usable: true, exit: 0, sha256: 5 } },
    "the child recorded a writeError": { file: undefined, ex: usable(TEXT, { writeError: "EACCES" }) },
    "the child recorded a writeError and a stale file is there": { file: "stale", ex: usable(TEXT, { writeError: "EACCES" }) },
    "the .exit is missing": { file: undefined, ex: undefined },
    "the .exit is missing and a file is there anyway": { file: TEXT, ex: undefined, missingReason: "unreadable .exit file" },
    "the .exit is not an object": { file: undefined, ex: "junk" },
    "the .exit says neither usable true nor false": { file: TEXT, ex: { exit: 0 } },
  };
  for (const [name, t] of Object.entries(triggers)) {
    test(`[AC-10] fallback trigger: ${name} -> the pane copy is read, written to the result file, source pane`, async () => {
      const r = rig({ file: t.file, readPane: copyOf(TEXT) });
      const got = await retrieveResult(r.args({ missingReason: t.missingReason }), t.ex, r.deps);
      assert.deepEqual(got, { ok: true, source: "pane", text: TEXT });
      assert.deepEqual(r.reads, ["w1:p2"]);
      assert.equal(fs.readFileSync(r.outFile, "utf8"), TEXT, "the result file now holds the pane copy, byte for byte");
      assert.deepEqual(fs.readdirSync(path.dirname(r.outFile)).filter((f) => f.endsWith(".tmp")), []);
    });
  }

  test("[AC-10] non-trigger: .exit usable:false never falls back, whatever the pane holds; the child's reason stands", async () => {
    for (const ex of [{ usable: false, exit: 3, reason: "claude exited 3" }, { usable: false, reason: "result is an error", sha256: sha(TEXT) }]) {
      const r = rig({ file: undefined, readPane: copyOf(TEXT) });
      assert.deepEqual(await retrieveResult(r.args(), ex, r.deps), { ok: false, reason: ex.reason });
      assert.deepEqual(r.reads, [], "the pane is not read");
      assert.equal(fs.existsSync(r.outFile), false, "nothing is written");
    }
    const r = rig({ readPane: copyOf(TEXT) });
    assert.deepEqual(await retrieveResult(r.args(), { usable: false }, r.deps), { ok: false, reason: "no usable result" }, "a missing reason has a default");
    assert.deepEqual(r.reads, []);
  });

  test("[AC-10] the main reason is kept when the pane is gone (pane not found); any other read failure is `pane copy unusable: pane read failed`", async () => {
    const cases = [
      [usable(TEXT), undefined, "result file missing or empty"],
      [usable(TEXT), "tampered", "result file does not match .exit"],
      [usable(TEXT, { writeError: "EACCES" }), undefined, "result file not written: EACCES"],
      [undefined, undefined, "no .exit file"],
      [{ usable: true, exit: 0 }, TEXT, "result file does not match .exit"],
      [{ exit: 0 }, undefined, "no usable result"],
    ];
    for (const [ex, file, reason] of cases) {
      const r = rig({ file, readPane: { ok: false, gone: true, reason: "pane not found" } });
      assert.deepEqual(await retrieveResult(r.args(), ex, r.deps), { ok: false, reason }, reason);
      assert.equal(r.reads.length, 1, "no retry on a closed pane");
    }
    const r = rig({ readPane: { ok: false, reason: "pane read failed: unavailable" } });
    assert.deepEqual(await retrieveResult(r.args(), undefined, r.deps), { ok: false, reason: "pane copy unusable: pane read failed: unavailable" });
    assert.equal(r.reads.length, 3, "a transient read failure is retried");
  });

  test("[AC-10] a missingReason from the caller is the main reason when the pane is gone; without one it is `no .exit file`", async () => {
    const r = rig({ readPane: { ok: false, gone: true } });
    assert.deepEqual(await retrieveResult(r.args({ missingReason: "no result within 1 min" }), undefined, r.deps), { ok: false, reason: "no result within 1 min" });
  });

  test("[AC-10] markers missing are retried 3 times with the poll pause between (the pane may not be rendered yet); the second read can succeed", async () => {
    const r = rig({ readPane: () => ({ ok: true, text: "nothing yet" }) });
    assert.deepEqual(await retrieveResult(r.args(), undefined, r.deps), { ok: false, reason: "pane copy unusable: markers missing" });
    assert.equal(r.reads.length, 3);
    assert.equal(r.sleeps.length, 2, "a pause between reads, none before the first");
    const late = rig({ readPane: (n) => (n < 2 ? { ok: true, text: "rendering..." } : copyOf(TEXT)) });
    assert.deepEqual(await retrieveResult(late.args(), usable(TEXT), late.deps), { ok: true, source: "pane", text: TEXT });
    assert.equal(late.reads.length, 2);
    assert.equal(late.sleeps.length, 1);
  });

  test("[AC-10] a copy that is present but wrong is not retried: size mismatch, hash mismatch, invalid base64; nothing is written", async () => {
    const good = encodePaneCopy(TEXT, NONCE);
    const cases = {
      "hash mismatch": good.replace(/sha256=[0-9a-f]{64}/, `sha256=${sha("x")}`),
      "size mismatch": good.replace(/bytes=\d+/, "bytes=1"),
      "invalid base64": good.replace(/\n[A-Za-z0-9+/]/, "\n!"),
    };
    for (const [reason, text] of Object.entries(cases)) {
      const r = rig({ readPane: { ok: true, text } });
      assert.deepEqual(await retrieveResult(r.args(), usable(TEXT, { writeError: "x" }), r.deps), { ok: false, reason: `pane copy unusable: ${reason}` }, reason);
      assert.equal(r.reads.length, 1);
      assert.equal(fs.existsSync(r.outFile), false, "a copy that fails its check is never written as the hand-back");
    }
  });

  test("[AC-10] a stale block (another nonce) is not taken: markers missing", async () => {
    const r = rig({ readPane: copyOf("old result", OTHER) });
    assert.deepEqual(await retrieveResult(r.args(), undefined, r.deps), { ok: false, reason: "pane copy unusable: markers missing" });
    assert.equal(fs.existsSync(r.outFile), false);
  });

  test("[AC-11] a pane copy that decodes to a blank text is not a result", async () => {
    for (const text of ["", "  \n "]) {
      const r = rig({ readPane: copyOf(text) });
      assert.deepEqual(await retrieveResult(r.args(), undefined, r.deps), { ok: false, reason: "pane copy unusable: blank result" });
      assert.equal(fs.existsSync(r.outFile), false);
    }
  });

  test("[AC-10] a pane copy that cannot be written to the result file is reported, not returned as a result", async () => {
    const sb = box();
    fs.mkdirSync(path.join(sb.root, "out"), { recursive: true });
    const outFile = path.join(sb.root, "out", "r.md");
    fs.mkdirSync(outFile); // a directory where the file must go
    const got = await retrieveResult({ outFile, nonce: NONCE, pane: "w1:p2" }, undefined, { readPane: () => copyOf(TEXT), sleep: async () => {} });
    assert.equal(got.ok, false);
    assert.match(got.reason, /^pane copy not written: /);
  });

  test("[AC-10] the pane read is the real call: `pane read <id> --source recent-unwrapped --lines 100000`; its output is the pane text", async () => {
    const sb = box();
    sb.install({ herdr: herdrCalls({ extra: [{ match: ["pane", "read"], stdout: `x\n${encodePaneCopy(TEXT, NONCE)}` }] }) });
    const outFile = path.join(sb.root, "r.md");
    const prev = { ...process.env };
    Object.assign(process.env, sb.env());
    try {
      const got = await retrieveResult({ outFile, nonce: NONCE, pane: "w1:p9" }, undefined, { sleep: async () => {} });
      assert.deepEqual(got, { ok: true, source: "pane", text: TEXT });
    } finally {
      for (const k of Object.keys(process.env)) if (!(k in prev)) delete process.env[k];
      Object.assign(process.env, prev);
    }
    assert.deepEqual(sb.herdrArgs().find((a) => a[1] === "read"), ["pane", "read", "w1:p9", "--source", "recent-unwrapped", "--lines", "100000"]);
  });

  test("[AC-10] a real `pane_not_found` from herdr is the closed-pane case: the main reason is kept", async () => {
    const sb = box();
    sb.install({ herdr: herdrCalls({ extra: [{ match: ["pane", "read"], ...notFound }] }) });
    const prev = { ...process.env };
    Object.assign(process.env, sb.env());
    try {
      const got = await retrieveResult({ outFile: path.join(sb.root, "r.md"), nonce: NONCE, pane: "w1:p9" }, undefined, { sleep: async () => {} });
      assert.deepEqual(got, { ok: false, reason: "no .exit file" });
    } finally {
      for (const k of Object.keys(process.env)) if (!(k in prev)) delete process.env[k];
      Object.assign(process.env, prev);
    }
    assert.equal(sb.herdrArgs().filter((a) => a[1] === "read").length, 1);
  });
});

describe("finishChild: result file, pane copy, .exit; never throws [AC-10, AC-9]", () => {
  /** Run finishChild in a subprocess (it writes to stdout). mode: real | all-throw | exit-throw | out-throw. */
  function finish(target, r, mode = "real") {
    const script = `
      import fs from "node:fs";
      import path from "node:path";
      import { finishChild } from ${JSON.stringify(pathToFileURL(HERDR_MJS).href)};
      const [target, r, mode] = JSON.parse(process.env.ARGS);
      if (target.outFile) fs.mkdirSync(path.dirname(target.outFile), { recursive: true });
      const boom = () => { throw new Error("disk full"); };
      const write = { real: undefined, "all-throw": boom, "exit-throw": (f, t) => (f.endsWith(".exit") ? boom() : fs.writeFileSync(f, t)), "out-throw": (f, t) => (f.endsWith(".exit") ? fs.writeFileSync(f, t) : boom()) }[mode];
      await finishChild(target, r, write);
    `;
    const p = spawnSync(process.execPath, ["--input-type=module", "-e", script], { env: { ...process.env, ARGS: JSON.stringify([target, r, mode]) }, encoding: "utf8" });
    return { status: p.status, stdout: p.stdout, stderr: p.stderr };
  }
  const tgt = (sb) => ({ outFile: path.join(sb.root, "r", "res.md"), out: "r/res.md", nonce: NONCE });
  const exitOf = (t) => JSON.parse(fs.readFileSync(`${t.outFile}.exit`, "utf8"));

  test("[AC-10] usable: the result file first, then the result marker and the pane copy, then .exit with bytes, sha256, paneCopy true and the nonce", () => {
    const sb = box();
    const t = tgt(sb);
    const r = finish(t, { usable: true, text: TEXT, exit: 0, subtype: "success", sessionId: "s1", permissionDenials: 2, costUsd: 0.5 });
    assert.equal(r.status, 0);
    assert.equal(fs.readFileSync(t.outFile, "utf8"), TEXT);
    assert.ok(r.stdout.startsWith("[result written: r/res.md]\n"));
    assert.ok(r.stdout.includes(`[result copy for the orchestrator follows: ${Buffer.byteLength(TEXT)} bytes, base64]\n`));
    assert.deepEqual(decodePaneCopy(r.stdout, NONCE), { ok: true, text: TEXT }, "the printed copy decodes to the result");
    assert.deepEqual(exitOf(t), { usable: true, exit: 0, subtype: "success", sessionId: "s1", permissionDenials: 2, costUsd: 0.5, bytes: Buffer.byteLength(TEXT), sha256: sha(TEXT), paneCopy: true, nonce: NONCE });
  });

  test("[AC-10] the cap: 16384 bytes still print a pane copy; 16385 do not (a marker line says so) and .exit says paneCopy false", () => {
    for (const [size, copy] of [[PANE_COPY_MAX_BYTES, true], [PANE_COPY_MAX_BYTES + 1, false]]) {
      const sb = box();
      const t = tgt(sb);
      const text = "y".repeat(size);
      const r = finish(t, { usable: true, text, exit: 0 });
      assert.equal(r.status, 0);
      assert.equal(r.stdout.includes("HERDR-RESULT-BEGIN"), copy, `${size} bytes`);
      assert.equal(r.stdout.includes("[no pane copy: result larger than 16 KiB]"), !copy);
      assert.equal(exitOf(t).paneCopy, copy);
      assert.equal(fs.readFileSync(t.outFile, "utf8"), text, "the result file is written either way");
      assert.equal(exitOf(t).sha256, sha(text));
    }
  });

  test("[AC-10] the cap counts bytes, not characters: 8200 two-byte characters (16400 bytes) print no pane copy", () => {
    const sb = box();
    const t = tgt(sb);
    const r = finish(t, { usable: true, text: "é".repeat(8200), exit: 0 });
    assert.equal(exitOf(t).paneCopy, false);
    assert.equal(exitOf(t).bytes, 16400);
    assert.ok(r.stdout.includes("[no pane copy: result larger than 16 KiB]"));
  });

  test("[AC-9] not usable: a marker, no result file, .exit with the reason, paneCopy false", () => {
    const sb = box();
    const t = tgt(sb);
    const r = finish(t, { usable: false, reason: "claude exited 3", exit: 3 });
    assert.equal(r.status, 0);
    assert.ok(r.stdout.includes("[no usable result: claude exited 3]"));
    assert.equal(fs.existsSync(t.outFile), false);
    assert.deepEqual(exitOf(t), { usable: false, exit: 3, paneCopy: false, nonce: NONCE, reason: "claude exited 3" });
  });

  test("[AC-9] the result file cannot be written: writeError in .exit, the pane copy is still printed, exit 0", () => {
    const sb = box();
    const t = tgt(sb);
    const r = finish(t, { usable: true, text: TEXT, exit: 0 }, "out-throw");
    assert.equal(r.status, 0);
    assert.ok(r.stdout.includes("[result file not written: disk full]"));
    assert.deepEqual(decodePaneCopy(r.stdout, NONCE), { ok: true, text: TEXT }, "the fallback has something to read");
    const ex = exitOf(t);
    assert.equal(ex.usable, true);
    assert.equal(ex.writeError, "disk full");
    assert.equal(ex.paneCopy, true);
    assert.equal(ex.sha256, sha(TEXT));
  });

  test("[AC-9] .exit cannot be written: a marker, no throw, exit 0, and the result file is already final", () => {
    const sb = box();
    const t = tgt(sb);
    const r = finish(t, { usable: true, text: TEXT, exit: 0 }, "exit-throw");
    assert.equal(r.status, 0);
    assert.equal(r.stderr, "");
    assert.ok(r.stdout.includes("[could not write .exit: disk full]"));
    assert.equal(fs.readFileSync(t.outFile, "utf8"), TEXT);
    assert.equal(fs.existsSync(`${t.outFile}.exit`), false);
  });

  test("[AC-9] every write failing: still no throw, exit 0, markers say what failed", () => {
    const sb = box();
    const r = finish(tgt(sb), { usable: true, text: TEXT, exit: 0 }, "all-throw");
    assert.equal(r.status, 0);
    assert.equal(r.stderr, "");
    assert.ok(r.stdout.includes("[result file not written: disk full]"));
    assert.ok(r.stdout.includes("[could not write .exit: disk full]"));
  });

  test("[AC-9] a job that names no safe result file: nothing is written, a marker says so, exit 0 (the parent reaches its timeout and takes the fallback)", () => {
    const r = finish({ outFile: undefined, out: undefined, nonce: NONCE }, { usable: true, text: TEXT, exit: 0 });
    assert.equal(r.status, 0);
    assert.ok(r.stdout.includes("[result file not written: no result file]"));
    assert.deepEqual(decodePaneCopy(r.stdout, NONCE), { ok: true, text: TEXT });
    assert.ok(r.stdout.includes("[could not write .exit: the job names no safe result file]"));
    const r2 = finish({ outFile: undefined, out: undefined, nonce: undefined }, { usable: false, reason: "invalid job: root", exit: null });
    assert.equal(r2.status, 0);
    assert.ok(r2.stdout.includes("[no usable result: invalid job: root]"));
  });

  test("[AC-9] no nonce (or a malformed one): no pane copy is printed, the result file and .exit still are", () => {
    const sb = box();
    const t = { ...tgt(sb), nonce: "bad" };
    const r = finish(t, { usable: true, text: TEXT, exit: 0 });
    assert.equal(r.status, 0);
    assert.equal(r.stdout.includes("HERDR-RESULT-BEGIN"), false);
    assert.equal(fs.readFileSync(t.outFile, "utf8"), TEXT);
    assert.equal(exitOf(t).paneCopy, false);
  });

  test("[AC-9] usable with no text (a defect upstream) does not throw: the outer catch prints a marker and exits 0", () => {
    const sb = box();
    const r = finish(tgt(sb), { usable: true, exit: 0 });
    assert.equal(r.status, 0);
    assert.equal(r.stderr, "");
  });
});

describe("childCommand: every job field is validated [AC-10, review 1.4.1 S]", () => {
  const sb0 = () => { const sb = box(); sb.install({ claude: claudeOk() }); return sb; };
  const good = (sb, over = {}) => ({ kind: "child", root: sb.root, out: ".scratch/herdr/R/1.2-a.result.md", record: "docs/handoffs/R/1.2-x.handoff.md", agent: "agent-manager", nonce: NONCE, timeoutMinutes: 60, ...over });

  test("[AC-10] a valid job gives the claude call: file, the -p brief with --agent ai-dlc:<id>, and --worktree only when named", () => {
    const sb = sb0();
    const c = childCommand(good(sb), sb.env());
    assert.equal(c.ok, true);
    assert.equal(c.args[0], "-p");
    assert.deepEqual(c.args.slice(2, 4), ["--agent", "ai-dlc:agent-manager"]);
    assert.equal(c.args.includes("--worktree"), false);
    assert.deepEqual(childCommand(good(sb, { worktree: "wt-1.2" }), sb.env()).args.slice(-2), ["--worktree", "wt-1.2"]);
    assert.equal(typeof c.file, "string");
    assert.equal(c.shell, process.platform === "win32", "a .cmd needs a shell on win32 only");
  });

  const bad = (sb) => ({
    kind: [{ kind: "watch" }, { kind: undefined }, { kind: 5 }],
    root: [{ root: undefined }, { root: 5 }, { root: path.join(sb.root, "no-such-dir") }, { root: path.join(sb.root, ".scratch") }],
    out: [{ out: undefined }, { out: "a b" }, { out: "../x" }, { out: "/abs.md" }, { out: "a;b" }, { out: 5 }],
    record: [{ record: undefined }, { record: "../x.md" }, { record: "a b.md" }, { record: "$(x)" }],
    agent: [{ agent: undefined }, { agent: "" }, { agent: 'x"&calc' }, { agent: "a b" }, { agent: "a|b" }, { agent: 5 }],
    worktree: [{ worktree: "a/b" }, { worktree: "a b" }, { worktree: "x;y" }, { worktree: 5 }],
    nonce: [{ nonce: undefined }, { nonce: "" }, { nonce: "xyz" }, { nonce: "0123456789AB" }, { nonce: "0123456789abc" }, { nonce: 5 }],
    timeoutMinutes: [{ timeoutMinutes: undefined }, { timeoutMinutes: 0 }, { timeoutMinutes: -1 }, { timeoutMinutes: "60" }, { timeoutMinutes: NaN }],
  });
  for (const field of ["kind", "root", "out", "record", "agent", "worktree", "nonce", "timeoutMinutes"]) {
    test(`[AC-10] an invalid ${field} is { ok: false, field: "${field}" }`, () => {
      const sb = sb0();
      for (const over of bad(sb)[field]) assert.deepEqual(childCommand(good(sb, over), sb.env()), { ok: false, field }, JSON.stringify(over));
    });
  }

  test("[AC-10] not an object, or null: field kind", () => {
    const sb = sb0();
    for (const j of [null, undefined, 5, "x", []]) assert.deepEqual(childCommand(j, sb.env()), { ok: false, field: "kind" }, String(j));
  });

  test("[AC-9] a valid job but no claude on PATH: { ok: false, reason: `claude is not on PATH` } (no field)", () => {
    const sb = box();
    sb.install({});
    assert.deepEqual(childCommand(good(sb), sb.env()), { ok: false, reason: "claude is not on PATH" });
  });

  test("[AC-10] fields are checked before claude is looked up: an invalid field wins over a missing claude", () => {
    const sb = box();
    sb.install({});
    assert.deepEqual(childCommand(good(sb, { nonce: "x" }), sb.env()), { ok: false, field: "nonce" });
  });
});

describe("killTree: the child and everything it started; never throws [AC-9]", () => {
  test("[AC-9] no pid, no child: nothing happens", () => {
    for (const c of [undefined, null, {}, { pid: 0 }]) assert.doesNotThrow(() => killTree(c));
  });

  test("[AC-9] POSIX path (platform injected) with a pid that does not exist: the group signal fails, the child alone is signalled, nothing throws", () => {
    const got = [];
    assert.doesNotThrow(() => killTree({ pid: 2 ** 22 + 12345, kill: (s) => got.push(s) }, "linux"));
    assert.deepEqual(got, ["SIGTERM"]);
  });

  test("[AC-9] POSIX path, platform injected: a child whose kill also throws is still not an error", () => {
    assert.doesNotThrow(() => killTree({ pid: 2 ** 22 + 54321, kill: () => { throw new Error("EPERM"); } }, "linux"));
  });

  test("[AC-9] win32 path, platform injected: taskkill failing (no such process, or no taskkill on this host) is swallowed", () => {
    assert.doesNotThrow(() => killTree({ pid: 2 ** 22 + 99999 }, "win32"));
  });

  test("[AC-9] a real process and the process it started are both gone", async () => {
    const sb = box();
    const marker = path.join(sb.root, "grandchild.pid");
    // The parent starts a long-lived grandchild and records its pid, then waits; killing the tree must take the grandchild too.
    const code = `const {spawn}=require("node:child_process");const g=spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore"});require("node:fs").writeFileSync(${JSON.stringify(marker)},String(g.pid));setInterval(()=>{},1000);`;
    const child = spawn(process.execPath, ["-e", code], { stdio: "ignore", detached: process.platform !== "win32", windowsHide: true });
    assert.equal(await until(() => fs.existsSync(marker) && fs.readFileSync(marker, "utf8").length > 0, 10000), true, "the grandchild started");
    const grandchild = Number(fs.readFileSync(marker, "utf8"));
    const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
    assert.equal(alive(child.pid) && alive(grandchild), true);
    killTree(child);
    assert.equal(await until(() => !alive(child.pid) && !alive(grandchild), 10000), true, "both are gone");
    if (process.platform !== "win32") assert.equal(await until(() => { try { process.kill(-child.pid, 0); return false; } catch { return true; } }, 8000), true, "the whole process group is gone");
  });
});

describe("run, end to end through the fake herdr: the fallback and its non-triggers [AC-10, AC-11]", () => {
  const RUN = "docs/handoffs/RUN-1";
  const RECORD = `${RUN}/1.2-orchestrator-to-agent-manager.handoff.md`;
  const OUT = ".scratch/herdr/RUN-1/1.2-agent-manager.result.md";
  const EXITREL = `${OUT}.exit`;
  const JOBREL = ".scratch/herdr/RUN-1/1.2-agent-manager.job.json";
  const ENV = { HERDR_ENV: "1", HERDR_PANE_ID: "w1:p1", AI_DLC_HERDR_MODE: "run-in-pane", AI_DLC_HERDR_POLL_MS: "50" };
  const HANDBACK = "handoff 1.2-orchestrator-to-agent-manager.handoff.md: passed — built it\n\n## Body\nline two éè\n";
  const panes = (sb) => [pane({ cwd: sb.root }), pane({ pane_id: "w1:p2" })];

  /** A sandbox whose `pane run` writes the given .exit (and optionally a result file) instead of running a child; `read` is the pane read entry. */
  function staged({ exitDoc, file, read }) {
    const sb = box();
    const exitFile = path.join(sb.root, EXITREL);
    const writeFile = exitDoc === undefined ? undefined : { path: exitFile, text: typeof exitDoc === "string" ? exitDoc : JSON.stringify(exitDoc), ...(file === undefined ? {} : { also: { path: path.join(sb.root, OUT), text: file } }) };
    sb.install({ herdr: herdrCalls({ panes: panes(sb), extra: [...(writeFile ? [{ match: ["pane", "run"], writeFile }] : []), ...(read ? [{ match: ["pane", "read"], ...read }] : [])] }), claude: claudeOk() });
    sb.write(RECORD, "x");
    return sb;
  }
  const exitDoc = (text, over = {}) => ({ usable: true, exit: 0, subtype: "success", bytes: Buffer.byteLength(text), sha256: sha(text), paneCopy: true, nonce: NONCE, permissionDenials: 1, sessionId: "s9", costUsd: 0.5, ...over });
  const go = (sb, extra = []) => sb.cli(["run", "--run", RUN, "--step", "1.2", "--agent", "agent-manager", "--record", RECORD, "--out", OUT, ...extra], { env: ENV });
  const reads = (sb) => sb.herdrArgs().filter((a) => a[1] === "read");
  const closes = (sb) => sb.herdrArgs().filter((a) => a[1] === "close");

  // The read entry needs the job file's nonce, so the sandbox must exist first: build it, then add the read entry.
  function stagedWithCopy({ exitDoc: ex, file, copy }) {
    const sb = box();
    const exitFile = path.join(sb.root, EXITREL);
    const writeFile = { path: exitFile, text: JSON.stringify(ex), ...(file === undefined ? {} : { also: { path: path.join(sb.root, OUT), text: file } }) };
    const read = { match: ["pane", "read"], paneCopyFor: { job: path.join(sb.root, JOBREL), text: HANDBACK, ...copy } };
    sb.install({ herdr: herdrCalls({ panes: panes(sb), extra: [{ match: ["pane", "run"], writeFile }, read] }), claude: claudeOk() });
    sb.write(RECORD, "x");
    return sb;
  }

  const lossy = {
    "the result file is missing": { file: undefined, ex: exitDoc(HANDBACK) },
    "the result file is empty": { file: "", ex: exitDoc(HANDBACK) },
    "the result file does not match the sha256": { file: "TAMPERED", ex: exitDoc(HANDBACK) },
    "the .exit carries a writeError": { file: undefined, ex: exitDoc(HANDBACK, { writeError: "EACCES" }) },
    "the .exit has no sha256": { file: HANDBACK, ex: (() => { const e = exitDoc(HANDBACK); delete e.sha256; return e; })() },
  };
  for (const [name, c] of Object.entries(lossy)) {
    test(`[AC-10] ${name}: run returns source "pane", the result file holds the pane copy byte for byte, .exit says resultSource pane, the pane is closed once`, () => {
      const sb = stagedWithCopy({ exitDoc: c.ex, file: c.file, copy: { prefix: "stale scrollback\r\n" } });
      const r = go(sb);
      assert.equal(r.status, 0);
      assert.deepEqual(r.json, { ok: true, result: OUT, source: "pane", exit: 0, line1: HANDBACK.split("\n")[0], handoffLine: true, permissionDenials: 1, sessionId: "s9", costUsd: 0.5 });
      assert.equal(sb.read(OUT), HANDBACK);
      assert.equal(JSON.parse(sb.read(EXITREL)).resultSource, "pane");
      assert.deepEqual(reads(sb), [["pane", "read", "w1:p2", "--source", "recent-unwrapped", "--lines", "100000"]]);
      assert.deepEqual(closes(sb), [["pane", "close", "w1:p2"]]);
    });
  }

  test("[AC-10] main path wins: a usable .exit and a matching file never read the pane, even when the pane holds a different copy", () => {
    const sb = stagedWithCopy({ exitDoc: exitDoc(HANDBACK), file: HANDBACK, copy: { text: "A DIFFERENT RESULT" } });
    const r = go(sb);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.source, "file");
    assert.equal(sb.read(OUT), HANDBACK);
    assert.deepEqual(reads(sb), []);
    assert.equal(JSON.parse(sb.read(EXITREL)).resultSource, undefined, "resultSource is recorded only for the pane path");
  });

  test("[AC-10] non-trigger: .exit usable:false never reads the pane even when it holds a valid copy; the child's reason is reported and the pane stays open", () => {
    const sb = stagedWithCopy({ exitDoc: { usable: false, exit: 3, reason: "claude exited 3", paneCopy: false, nonce: NONCE } });
    const r = go(sb);
    assert.deepEqual(r.json, { ok: false, stage: "run", reason: "claude exited 3", exit: 3, pane: "w1:p2" });
    assert.deepEqual(reads(sb), []);
    assert.deepEqual(closes(sb), []);
    assert.equal(sb.exists(OUT), false);
  });

  test("[AC-10] a pane copy with the wrong sha256 is a failed hand-back: `pane copy unusable: hash mismatch`, no result file, pane left open", () => {
    const sb = stagedWithCopy({ exitDoc: exitDoc(HANDBACK), copy: { sha256: sha("other") } });
    const r = go(sb);
    assert.deepEqual(r.json, { ok: false, stage: "run", reason: "pane copy unusable: hash mismatch", exit: 0, pane: "w1:p2" });
    assert.equal(sb.exists(OUT), false);
    assert.deepEqual(closes(sb), []);
    assert.equal(reads(sb).length, 1, "a present but wrong copy is not retried");
  });

  test("[AC-10] a pane copy with the wrong byte count is `pane copy unusable: size mismatch`", () => {
    const sb = stagedWithCopy({ exitDoc: exitDoc(HANDBACK), copy: { bytes: 7 } });
    assert.equal(go(sb).json.reason, "pane copy unusable: size mismatch");
    assert.equal(sb.exists(OUT), false);
  });

  test("[AC-10] a stale pane copy (another run's nonce) is not taken: `pane copy unusable: markers missing`, retried 3 times", () => {
    const sb = stagedWithCopy({ exitDoc: exitDoc(HANDBACK), copy: { nonce: OTHER } });
    const r = go(sb);
    assert.equal(r.json.ok, false);
    assert.equal(r.json.reason, "pane copy unusable: markers missing");
    assert.equal(reads(sb).length, 3);
    assert.equal(sb.exists(OUT), false);
  });

  test("[AC-10] the pane is gone when the fallback needs it: the main reason is reported, not a read error", () => {
    const sb = staged({ exitDoc: exitDoc(HANDBACK), read: notFound });
    const r = go(sb);
    assert.deepEqual(r.json, { ok: false, stage: "run", reason: "result file missing or empty", exit: 0, pane: "w1:p2" });
    assert.equal(reads(sb).length, 1);
  });

  test("[AC-10] a result of exactly 16 KiB gets a pane copy; a larger one does not, and the main path still delivers both (real child)", () => {
    for (const [size, copy] of [[PANE_COPY_MAX_BYTES, true], [PANE_COPY_MAX_BYTES + 1, false]]) {
      const head = "handoff 1.2-orchestrator-to-agent-manager.handoff.md: passed — big\n";
      const text = head + "y".repeat(size - Buffer.byteLength(head));
      assert.equal(Buffer.byteLength(text), size);
      const sb = box();
      sb.install({ herdr: herdrCalls({ execRun: true, panes: panes(sb) }), claude: claudeOk({ result: text }) });
      sb.write(RECORD, "x");
      const r = go(sb);
      assert.equal(r.json.ok, true, `${size}`);
      assert.equal(r.json.source, "file");
      assert.equal(sb.read(OUT), text);
      assert.equal(JSON.parse(sb.read(EXITREL)).paneCopy, copy, `${size} bytes`);
    }
  });

  test("[AC-10] real child, main path: the pane is never read, source file", () => {
    const sb = box();
    sb.install({ herdr: herdrCalls({ execRun: true, panes: panes(sb) }), claude: claudeOk({ result: HANDBACK }) });
    sb.write(RECORD, "x");
    const r = go(sb);
    assert.equal(r.json.source, "file");
    assert.deepEqual(reads(sb), []);
    const ex = JSON.parse(sb.read(EXITREL));
    assert.equal(ex.sha256, sha(HANDBACK));
    assert.equal(ex.bytes, Buffer.byteLength(HANDBACK));
    assert.match(ex.nonce, /^[0-9a-f]{12}$/);
    assert.equal(JSON.parse(sb.read(JOBREL)).nonce, ex.nonce, "the job file carries the nonce the child echoes");
  });

  test("[AC-10] the nonce is per run and never on the pane's command line", () => {
    const sb = box();
    sb.install({ herdr: herdrCalls({ execRun: true, panes: panes(sb) }), claude: claudeOk({ result: HANDBACK }) });
    sb.write(RECORD, "x");
    go(sb);
    const nonce1 = JSON.parse(sb.read(JOBREL)).nonce;
    const runArgv = sb.herdrArgs().find((a) => a[1] === "run");
    assert.equal(runArgv.join(" ").includes(nonce1), false);
    go(sb);
    assert.notEqual(JSON.parse(sb.read(JOBREL)).nonce, nonce1);
  });
});

describe("detached children on POSIX [AC-9]", () => {
  test("[AC-9] a timed-out child's whole process group is gone", { skip: process.platform === "win32" && "POSIX only: the child is spawned detached (its own process group) off win32; the win32 tree kill is covered by the timeout test in herdr-run.test.mjs and by killTree above. Not run on this host." }, async () => {
    const sb = box();
    sb.install({ herdr: herdrCalls({ execRun: true, panes: [pane({ cwd: sb.root }), pane({ pane_id: "w1:p2" })] }), claude: { hang: true } });
    sb.write("docs/handoffs/RUN-1/1.2-x.handoff.md", "x");
    const r = sb.cli(["run", "--run", "docs/handoffs/RUN-1", "--step", "1.2", "--agent", "agent-manager", "--record", "docs/handoffs/RUN-1/1.2-x.handoff.md", "--out", ".scratch/herdr/RUN-1/1.2-a.result.md", "--timeout", "0.02"], { env: { HERDR_ENV: "1", HERDR_PANE_ID: "w1:p1", AI_DLC_HERDR_MODE: "run-in-pane", AI_DLC_HERDR_POLL_MS: "50" } });
    assert.equal(r.json.stage, "run");
    const [c] = sb.entries("claude");
    assert.equal(await until(() => { try { process.kill(-c.pid, 0); return false; } catch { return true; } }, 10000), true, "the group led by the child is gone");
  });
});
