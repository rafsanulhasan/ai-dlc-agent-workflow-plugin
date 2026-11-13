// herdr.mjs watch (AC-6 the pane shows the agent's progress, AC-7 it ends when the hand-back exists, AC-8 never closed or ended for
// idleness, AC-9 read only and tolerant; LLD 1.1.6 U2). watch runs as a real process against fixture run folders and transcripts.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { sandbox, herdrCalls, HERDR_MJS, until } from "./helpers/fake-bin.mjs";

const boxes = [];
const kids = [];
const box = () => { const sb = sandbox("watch"); boxes.push(sb); return sb; };
afterEach(() => { for (const k of kids.splice(0)) { try { k.kill(); } catch {} } while (boxes.length) boxes.pop().cleanup(); });

const RUN = "docs/handoffs/RUN-1";
const REC = `${RUN}/1.2-orchestrator-to-agent-manager.handoff.md`;
const HANDBACK = `${RUN}/1.2-agent-manager-to-orchestrator.handback.md`;

/** Start `watch <job>` as a process; { out(), done: Promise<exitCode> }. */
function watch(sb, jobOver = {}, env = {}) {
  const job = { kind: "watch", run: path.join(sb.root, RUN), step: "1.2", agent: "agent-manager", record: path.join(sb.root, REC), opened: new Date().toISOString(), ...jobOver };
  const jobFile = sb.write(".scratch/herdr/RUN-1/1.2-agent-manager.job.json", JSON.stringify(job));
  const child = spawn(process.execPath, [HERDR_MJS, "watch", jobFile, "--root", sb.root], { cwd: sb.root, env: sb.env({ AI_DLC_HERDR_POLL_MS: "50", ...env }), stdio: ["ignore", "pipe", "pipe"] });
  kids.push(child);
  let out = "", err = "";
  child.stdout.on("data", (d) => { out += d; });
  child.stderr.on("data", (d) => { err += d; });
  const done = new Promise((r) => child.on("close", (code) => r(code)));
  return { out: () => out, err: () => err, done, child, running: () => child.exitCode === null && child.signalCode === null };
}
const lastFrame = (out) => out.split("\x1b[2J\x1b[H").pop();

function seed(sb, record = "---\nfrom: orchestrator\n---\n# Brief\n## Your task\nline 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7 (cut)\n## Next\nx\n") {
  sb.write(REC, record);
}

test("[AC-6] the header shows agent, step, elapsed time and the record name, then the first 6 lines after `## Your task`", async () => {
  const sb = box();
  seed(sb);
  const w = watch(sb);
  assert.ok(await until(() => w.out().includes("line 1")), "the first frame was drawn");
  const frame = lastFrame(w.out());
  const [header, ...rest] = frame.split("\n");
  assert.match(header, /^agent-manager 1\.2 {3}\d\d:\d\d {3}1\.2-orchestrator-to-agent-manager\.handoff\.md$/);
  assert.deepEqual(rest.filter(Boolean).slice(0, 6), ["line 1", "line 2", "line 3", "line 4", "line 5", "line 6"]);
  assert.equal(frame.includes("line 7"), false);
  assert.equal(w.running(), true, "AC-8: with no hand-back it keeps running, however idle the agent is");
  assert.equal(w.err(), "");
});

test("[AC-6] a record without a `## Your task` heading shows the first 6 body lines after the frontmatter", async () => {
  const sb = box();
  seed(sb, "---\nfrom: orchestrator\nstep: 1.2\n---\nb1\n\nb2\nb3\nb4\nb5\nb6\nb7\n");
  const w = watch(sb);
  assert.ok(await until(() => w.out().includes("b1")));
  const frame = lastFrame(w.out());
  for (const l of ["b1", "b2", "b3", "b4", "b5", "b6"]) assert.ok(frame.includes(l), l);
  assert.equal(frame.includes("b7"), false);
  assert.equal(frame.includes("from: orchestrator"), false, "the frontmatter is skipped");
});

test("[AC-9] a record that is not readable prints (record not readable) and the view keeps going", async () => {
  const sb = box();
  const w = watch(sb);
  assert.ok(await until(() => w.out().includes("(record not readable)")));
  assert.equal(w.running(), true);
});

test("[AC-6] run-folder events: files of this agent newer than the pane opening are listed with their time; older ones and other agents' are not", async () => {
  const sb = box();
  seed(sb);
  const old = sb.write(`${RUN}/1.1-orchestrator-to-agent-manager.handoff.md`, "old");
  const longAgo = new Date(Date.now() - 3600_000);
  fs.utimesSync(old, longAgo, longAgo);
  sb.write(`${RUN}/1.3-orchestrator-to-sqa-engineer.handoff.md`, "other agent");
  const w = watch(sb);
  assert.ok(await until(() => w.out().includes("line 1")));
  sb.write(`${RUN}/1.2.1-agent-manager-to-orchestrator.progress.md`, "new");
  assert.ok(await until(() => lastFrame(w.out()).includes("1.2.1-agent-manager-to-orchestrator.progress.md")), "a new file of this agent is listed");
  const frame = lastFrame(w.out());
  assert.match(frame, /\d\d:\d\d:\d\d 1\.2\.1-agent-manager-to-orchestrator\.progress\.md/);
  assert.equal(frame.includes("1.1-orchestrator-to-agent-manager"), false, "a file older than the opening is not an event");
  assert.equal(frame.includes("sqa-engineer.handoff"), false, "another agent's file is not an event");
});

test("[AC-6][AC-7] the hand-back of this step and agent ends the view: it prints the finished line and exits 0 within a second", async () => {
  const sb = box();
  seed(sb);
  const w = watch(sb);
  assert.ok(await until(() => w.out().includes("line 1")));
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(w.running(), true, "no hand-back yet: still running");
  const t0 = Date.now();
  sb.write(HANDBACK, "handoff x: passed");
  const code = await Promise.race([w.done, new Promise((r) => setTimeout(() => r("timeout"), 5000))]);
  assert.equal(code, 0);
  assert.ok(Date.now() - t0 < 2500, `ended in ${Date.now() - t0} ms`);
  assert.match(w.out(), /\[agent-manager 1\.2 finished\]\n$/);
  assert.match(lastFrame(w.out()), /1\.2-agent-manager-to-orchestrator\.handback\.md/, "the hand-back shows as the last event");
});

test("[AC-7] another step's or another agent's hand-back does not end the view", async () => {
  const sb = box();
  seed(sb);
  sb.write(`${RUN}/1.3-agent-manager-to-orchestrator.handback.md`, "x");
  sb.write(`${RUN}/1.2-sqa-engineer-to-orchestrator.handback.md`, "x");
  sb.write(`${RUN}/1.2-agent-manager-to-orchestrator.handoff.md`, "x");
  const w = watch(sb);
  await new Promise((r) => setTimeout(r, 700));
  assert.equal(w.running(), true);
});

test("[AC-9] watch writes nothing and calls no herdr command: the run folder and the repository are unchanged", async () => {
  const sb = box().install({ herdr: herdrCalls() });
  seed(sb);
  const snapshot = () => { const out = []; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else out.push([path.relative(sb.root, f), fs.readFileSync(f, "utf8")].join("\0")); } }; walk(sb.root); return out.sort(); };
  const job = sb.write(".scratch/herdr/RUN-1/1.2-agent-manager.job.json", JSON.stringify({ kind: "watch", run: path.join(sb.root, RUN), step: "1.2", agent: "agent-manager", record: path.join(sb.root, REC), opened: new Date().toISOString() }));
  const before = snapshot();
  const w = watch(sb);
  await new Promise((r) => setTimeout(r, 600));
  w.child.kill();
  await w.done;
  const after = snapshot();
  assert.deepEqual(after.filter((l) => !l.startsWith(path.join(".scratch", "herdr", "RUN-1", "1.2-agent-manager.job.json"))), before.filter((l) => !l.startsWith(path.join(".scratch", "herdr", "RUN-1", "1.2-agent-manager.job.json"))));
  assert.deepEqual(sb.entries(), [], "no herdr or claude call");
  void job;
});

test("[AC-9] a bad job file prints a marker and exits 0", async () => {
  const sb = box();
  for (const body of ["{ nope", "[]", JSON.stringify({ kind: "watch", run: 5, step: "1", agent: "a" }), JSON.stringify({ kind: "watch", run: "x", step: 1, agent: "a" })]) {
    const f = sb.write("bad.job.json", body);
    const k = spawn(process.execPath, [HERDR_MJS, "watch", f, "--root", sb.root], { cwd: sb.root, env: sb.env(), stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    k.stdout.on("data", (d) => { out += d; });
    const code = await new Promise((r) => k.on("close", r));
    assert.equal(code, 0, body);
    assert.equal(out.trim(), "[watch: bad job file]", body);
  }
});

function transcriptRoot(sb) {
  const root = path.join(sb.base, "transcripts");
  const dir = path.join(root, "proj-a", "session-1", "subagents");
  fs.mkdirSync(dir, { recursive: true });
  return { root, dir };
}
const assistant = (text) => JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text }] } });

test("[AC-6] transcript layer: the subagent transcript that names the record shows its last assistant lines (U2)", async () => {
  const sb = box();
  seed(sb);
  const { root, dir } = transcriptRoot(sb);
  const lines = [JSON.stringify({ type: "user", message: { content: `Handoff record: ${REC} ` } }), ...Array.from({ length: 12 }, (_, i) => assistant(`step ${i + 1} done`)), "{ not json", JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Edit", input: { file_path: "a/b.md" } }] } })];
  fs.writeFileSync(path.join(dir, "agent-abc.jsonl"), lines.join("\n"));
  const other = path.join(dir, "agent-zzz.jsonl");
  fs.writeFileSync(other, [JSON.stringify({ type: "user", message: { content: "other brief 9.9-x.md" } }), assistant("NOT OURS")].join("\n"));
  const w = watch(sb, {}, { AI_DLC_HERDR_TRANSCRIPT_ROOT: root });
  assert.ok(await until(() => w.out().includes("> Edit a/b.md")), "the last tool use is shown");
  const frame = lastFrame(w.out());
  assert.ok(frame.includes("step 12 done"));
  assert.equal(frame.includes("step 1 done"), false, "only the last 8 lines are shown");
  assert.equal(frame.includes("NOT OURS"), false);
  assert.equal(w.err(), "");
});

for (const [name, setup] of [
  ["the transcript root does not exist", () => path.join("nowhere", "at-all")],
  ["no transcript mentions the record", (sb) => { const { root, dir } = transcriptRoot(sb); fs.writeFileSync(path.join(dir, "agent-1.jsonl"), assistant("hello")); return root; }],
  ["the matching transcript is only malformed lines", (sb) => { const { root, dir } = transcriptRoot(sb); fs.writeFileSync(path.join(dir, "agent-1.jsonl"), `${REC.split("/").pop()}\n{ bad\n\n`); return root; }],
  ["the transcript layout is a different depth", (sb) => { const root = path.join(sb.base, "t2"); fs.mkdirSync(path.join(root, "p"), { recursive: true }); fs.writeFileSync(path.join(root, "p", "agent-1.jsonl"), `${REC.split("/").pop()}\n${assistant("deep")}`); return root; }],
]) {
  test(`[AC-9] transcript layer: ${name} prints nothing extra and does not fail (U2)`, async () => {
    const sb = box();
    seed(sb);
    const root = setup(sb);
    const w = watch(sb, {}, { AI_DLC_HERDR_TRANSCRIPT_ROOT: root });
    assert.ok(await until(() => w.out().includes("line 1")));
    await new Promise((r) => setTimeout(r, 300));
    const frame = lastFrame(w.out());
    assert.equal(frame.includes("hello") || frame.includes("deep"), false);
    assert.equal(w.err(), "");
    assert.equal(w.running(), true);
  });
}
