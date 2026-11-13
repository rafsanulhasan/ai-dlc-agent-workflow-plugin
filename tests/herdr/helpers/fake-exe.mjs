// The fake `herdr` and `claude` executables of tests/herdr/. herdr and claude are boundaries the repository does not own
// (test-doubles: a boundary you do not own), so each is a real executable on a temp PATH, driven by a JSON scenario file
// (FAKE_SCRIPT) and logging every call to FAKE_LOG. Nothing else is faked: the script under test runs as a real process.
// herdr scenario: { calls: [{ match: [args...], stdout, stderr, status, delayMs, replies: [{...}], execRun, writeFile: { path, text, also } }], default: {...} }
//   `paneCopyFor: { job, text, nonce?, bytes?, sha256?, prefix?, wrap? }` makes the call print a pane copy block of `text` for the nonce
//   found in the job file `job` (or `nonce`), built here independently of herdr.mjs; bytes / sha256 override the markers' values.
//   `replies` answer the nth matching call (the last one repeats); `execRun` makes `pane run` really execute its command string.
// claude scenario: { stdoutLines: [object | string], status, delayMs, hang }
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const [, , who, ...args] = process.argv;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const scenario = JSON.parse(fs.readFileSync(process.env.FAKE_SCRIPT, "utf8"))[who] ?? {};
const log = (extra = {}) => fs.appendFileSync(process.env.FAKE_LOG, `${JSON.stringify({ who, args, pid: process.pid, ...extra })}\n`);

if (who === "herdr") {
  log();
  const calls = scenario.calls ?? [];
  const idx = calls.findIndex((c) => c.match.every((m, i) => args[i] === m));
  let entry = scenario.default ?? {};
  if (idx >= 0) {
    entry = calls[idx];
    if (Array.isArray(entry.replies)) {
      const counter = `${process.env.FAKE_LOG}.n${idx}`;
      let n = 0;
      try { n = Number(fs.readFileSync(counter, "utf8")) || 0; } catch {}
      fs.writeFileSync(counter, String(n + 1));
      entry = { ...entry, ...entry.replies[Math.min(n, entry.replies.length - 1)] };
    }
  }
  if (entry.delayMs) await sleep(entry.delayMs);
  if (entry.execRun && (entry.status ?? 0) === 0) {
    const command = String(args[3]).replace(/^node /, `"${process.execPath}" `);
    spawn(command, { shell: true, detached: true, stdio: "ignore", windowsHide: true }).unref();
  }
  for (const w of [entry.writeFile, entry.writeFile?.also]) if (w) { fs.mkdirSync(path.dirname(w.path), { recursive: true }); fs.writeFileSync(w.path, w.text); }
  if (entry.paneCopyFor) {
    const c = entry.paneCopyFor;
    const nonce = c.nonce ?? JSON.parse(fs.readFileSync(c.job, "utf8")).nonce;
    const buf = Buffer.from(c.text, "utf8");
    const b64 = buf.toString("base64");
    const rows = b64.match(new RegExp(`.{1,${c.wrap ?? 76}}`, "g")) ?? [];
    const sha = c.sha256 ?? crypto.createHash("sha256").update(buf).digest("hex");
    const eol = "\r\n";
    process.stdout.write([`${c.prefix ?? ""}<<<HERDR-RESULT-BEGIN-${nonce} encoding=base64 bytes=${c.bytes ?? buf.length}>>>`, ...rows, `<<<HERDR-RESULT-END-${nonce} sha256=${sha}>>>`, "$ "].join(eol));
  }
  if (entry.stdout) process.stdout.write(entry.stdout);
  if (entry.stderr) process.stderr.write(entry.stderr);
  process.exitCode = entry.status ?? 0;
} else if (who === "claude") {
  log({ cwd: process.cwd(), mode: process.env.AI_DLC_HERDR_MODE ?? null, herdrEnv: Object.keys(process.env).some((k) => k.toUpperCase() === "HERDR_ENV") });
  if (scenario.delayMs) await sleep(scenario.delayMs);
  if (scenario.hang) setInterval(() => {}, 1000);
  else {
    for (const l of scenario.stdoutLines ?? []) process.stdout.write(`${typeof l === "string" ? l : JSON.stringify(l)}\n`);
    process.exitCode = scenario.status ?? 0;
  }
}
