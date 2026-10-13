#!/usr/bin/env node
// workflow.mjs — checks, shows and compares this repository's AI-DLC workflow (.ai-dlc/workflow.json).
// Zero dependencies; Node 18+. Installed by the AI-DLC workflow skill; change the workflow itself with
// /ai-dlc:workflow edit <change> (agent-manager), then run validate.
//
//   node .ai-dlc/workflow.mjs validate [--file <path>]           structural and semantic checks
//   node .ai-dlc/workflow.mjs show [<lifecycle>] [--mermaid]     stage tables and gates, or flowcharts
//   node .ai-dlc/workflow.mjs diff --against <path> [--file <p>]  what differs from another workflow file
//
// Options:
//   --file <path>   the workflow file to read (default: <root>/.ai-dlc/workflow.json)
//   --root <dir>    repository root, where custom agents are looked up (default: git root, else cwd)
//
// Exit codes: 0 ok (no errors; diff: no differences) · 1 problems (errors; diff: differences)
//             2 usage error or unreadable file.
// Warnings never fail validate. Agent ids are bare (software-engineer); the orchestrator adds the
// ai-dlc: prefix for plugin agents.

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

// ---- options --------------------------------------------------------------------
const argv = process.argv.slice(2);
if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
  console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1, 17).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  process.exit(argv.length === 0 ? 2 : 0);
}
const opt = (name) => { const i = argv.indexOf(name); return i > -1 ? argv[i + 1] : undefined; };
const VALUE_OPTS = ["--file", "--root", "--against"];
const positional = argv.filter((a, i) => !a.startsWith("--") && !VALUE_OPTS.includes(argv[i - 1]));
const COMMAND = positional[0];
if (!["validate", "show", "diff"].includes(COMMAND)) usage(`unknown command "${COMMAND ?? ""}" (use validate, show or diff)`);
for (const a of argv) if (a.startsWith("--") && ![...VALUE_OPTS, "--mermaid"].includes(a)) usage(`unknown option ${a}`);
for (const o of VALUE_OPTS) if (argv.includes(o) && (!opt(o) || opt(o).startsWith("--"))) usage(`${o} needs a value`);
const ROOT = path.resolve(opt("--root") ?? gitRoot() ?? process.cwd());
const FILE = path.resolve(opt("--file") ?? path.join(ROOT, ".ai-dlc", "workflow.json"));

function gitRoot() {
  try { return execSync("git rev-parse --show-toplevel", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return null; }
}
function usage(msg) { console.error(`error: ${msg}\nRun with --help for usage.`); process.exit(2); }

// The AI-DLC plugin's agents. Keep in step with plugins/claude/ai-dlc/agents/.
const PLUGIN_AGENTS = [
  "orchestrator", "product-owner", "product-manager", "requirement-analyst", "software-architect",
  "system-engineer", "software-engineer", "sqa-engineer", "code-reviewer", "documentation-writer",
  "brutal-critique", "presentation-manager", "research-assistant", "devops-engineer", "agent-manager",
];
const UNDISABLEABLE = ["orchestrator", "agent-manager"];
const APPROVERS = ["human", "orchestrator", "none"];
const KINDS = ["primary", "segment", "focused", "custom"];
const AXES = ["standards", "spec"];
const ARTIFACTS = ["backlog", "product", "specs", "decisions", "narratives", "plans", "handoffs"];
const TOP = ["$schema", "version", "agents", "gates", "lifecycles", "routing", "clarify", "documents", "review", "artifacts"];
const STAGE_KEYS = ["id", "agent", "skills", "produces", "after", "when", "gate", "loop", "critique", "note"];
const ID = /^[a-z][a-z0-9-]*$/;
const CODE = /^[A-Za-z][A-Za-z0-9_-]*$/;

function load(file) {
  let text;
  try { text = fs.readFileSync(file, "utf8"); } catch {
    console.error(`error: cannot read ${file}${opt("--file") ? "" : " (no project workflow: the plugin default applies; install one with /ai-dlc:workflow install)"}`);
    process.exit(2);
  }
  try { return JSON.parse(text); } catch (e) { console.error(`error: ${file} is not valid JSON: ${e.message}`); process.exit(2); }
}

// ---- validate -------------------------------------------------------------------
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const isStrArr = (v) => Array.isArray(v) && v.every((x) => typeof x === "string");

function validate(wf) {
  const errors = [], warnings = [];
  const err = (p, m) => errors.push(`${p}: ${m}`);
  const wrn = (p, m) => warnings.push(`${p}: ${m}`);
  const unknownKeys = (obj, allowed, p) => { for (const k of Object.keys(obj)) if (!allowed.includes(k)) err(`${p}.${k}`, "unknown key"); };

  if (!isObj(wf)) { err("$", "the workflow must be a JSON object"); return { errors, warnings }; }
  unknownKeys(wf, TOP, "$");
  for (const k of TOP.slice(1)) if (!(k in wf)) err("$", `missing required key "${k}"`);
  if ("version" in wf && wf.version !== 1) err("version", "must be 1");

  // agents
  const disabled = new Set(), custom = new Set();
  if (isObj(wf.agents)) {
    unknownKeys(wf.agents, ["disabled", "custom"], "agents");
    if (!isStrArr(wf.agents.disabled)) err("agents.disabled", "must be an array of agent ids");
    else for (const a of wf.agents.disabled) {
      if (!PLUGIN_AGENTS.includes(a)) err("agents.disabled", `"${a}" is not a plugin agent`);
      else if (UNDISABLEABLE.includes(a)) err("agents.disabled", `"${a}" cannot be disabled (fixed guardrail)`);
      else disabled.add(a);
    }
    if (!isObj(wf.agents.custom)) err("agents.custom", "must be an object of { <id>: { description } }");
    else for (const [id, def] of Object.entries(wf.agents.custom)) {
      const p = `agents.custom.${id}`;
      if (!ID.test(id)) err(p, "id must be kebab-case");
      if (PLUGIN_AGENTS.includes(id)) err(p, "id collides with a plugin agent");
      if (id === "human") err(p, `"human" is reserved`);
      if (!isObj(def) || !isStr(def.description)) err(p, "needs a description");
      else unknownKeys(def, ["description"], p);
      const files = [path.join(ROOT, ".claude", "agents", `${id}.md`), path.join(ROOT, ".github", "agents", `${id}.agent.md`)];
      if (!files.some((f) => fs.existsSync(f))) err(p, `no agent file: expected .claude/agents/${id}.md or .github/agents/${id}.agent.md`);
      custom.add(id);
    }
  } else if ("agents" in wf) err("agents", "must be an object");

  const usedAgent = (a, p, { human = false } = {}) => {
    if (human && a === "human") return;
    if (typeof a !== "string") return err(p, "must be an agent id");
    if (a.includes(":")) return err(p, `"${a}": use the bare id, without a namespace prefix`);
    if (disabled.has(a)) return err(p, `"${a}" is disabled in agents.disabled — reassign or remove`);
    if (!PLUGIN_AGENTS.includes(a) && !custom.has(a)) err(p, `unknown agent "${a}" (not a plugin agent, not in agents.custom)`);
  };

  // gates
  const gates = isObj(wf.gates) ? wf.gates : {};
  if ("gates" in wf && !isObj(wf.gates)) err("gates", "must be an object");
  for (const [g, def] of Object.entries(gates)) {
    const p = `gates.${g}`;
    if (!CODE.test(g)) err(p, "gate id must start with a letter and use letters, digits, - or _");
    if (!isObj(def)) { err(p, "must be an object"); continue; }
    unknownKeys(def, ["name", "approves", "approver", "note"], p);
    if (!isStr(def.name)) err(p, "needs a name");
    if (!isStr(def.approves)) err(p, "needs `approves` (the artifact signed off)");
    if (!APPROVERS.includes(def.approver)) err(p, `approver must be ${APPROVERS.join(", ")}`);
    else if (def.approver === "none") wrn(p, `approver is none — ${g === "G4" ? "the review report reaches merge without sign-off" : "nobody signs off this gate"}`);
  }
  const usedGates = new Set();

  // lifecycles
  const lifecycles = isObj(wf.lifecycles) ? wf.lifecycles : {};
  if ("lifecycles" in wf && (!isObj(wf.lifecycles) || !Object.keys(wf.lifecycles).length)) err("lifecycles", "must be a non-empty object");
  for (const [code, lc] of Object.entries(lifecycles)) {
    const p = `lifecycles.${code}`;
    if (!CODE.test(code)) err(p, "lifecycle code must start with a letter and use letters, digits, - or _");
    if (!isObj(lc)) { err(p, "must be an object"); continue; }
    unknownKeys(lc, ["name", "kind", "pickWhen", "exitArtifact", "segments", "stages", "note"], p);
    for (const k of ["name", "pickWhen", "exitArtifact"]) if (!isStr(lc[k])) err(p, `needs ${k}`);
    if (!KINDS.includes(lc.kind)) err(p, `kind must be ${KINDS.join(", ")}`);
    const hasSeg = "segments" in lc, hasStages = "stages" in lc;
    if (hasSeg === hasStages) { err(p, "needs exactly one of `segments` or `stages`"); continue; }
    if (hasSeg) {
      if (!isStrArr(lc.segments) || !lc.segments.length) { err(`${p}.segments`, "must be a non-empty array of lifecycle codes"); continue; }
      for (const s of lc.segments) {
        if (!(s in lifecycles)) err(`${p}.segments`, `"${s}" is not a defined lifecycle`);
        else if (s === code) err(`${p}.segments`, "a lifecycle cannot contain itself");
      }
      continue;
    }
    if (!Array.isArray(lc.stages) || !lc.stages.length) { err(`${p}.stages`, "must be a non-empty array"); continue; }
    const ids = new Set();
    lc.stages.forEach((st, i) => {
      const sp = `${p}.stages[${i}]${isObj(st) && typeof st.id === "string" ? ` (${st.id})` : ""}`;
      if (!isObj(st)) return err(sp, "must be an object");
      unknownKeys(st, STAGE_KEYS, sp);
      if (typeof st.id !== "string" || !ID.test(st.id)) err(sp, "id must be kebab-case");
      else if (ids.has(st.id)) err(sp, `duplicate stage id "${st.id}"`);
      else ids.add(st.id);
      if (!("agent" in st)) err(sp, "needs an agent"); else usedAgent(st.agent, `${sp}.agent`);
      for (const k of ["skills", "produces", "after"]) if (k in st && !isStrArr(st[k])) err(`${sp}.${k}`, "must be an array of strings");
      for (const k of ["when", "note"]) if (k in st && !isStr(st[k])) err(`${sp}.${k}`, "must be a non-empty string");
      if ("critique" in st && typeof st.critique !== "boolean") err(`${sp}.critique`, "must be true or false");
      if ("gate" in st) {
        if (!(st.gate in gates)) err(`${sp}.gate`, `gate "${st.gate}" is not defined in gates`);
        usedGates.add(st.gate);
      }
      if ("loop" in st) {
        if (!isObj(st.loop)) err(`${sp}.loop`, "must be an object { to, on, maxRounds? }");
        else {
          unknownKeys(st.loop, ["to", "on", "maxRounds"], `${sp}.loop`);
          if (!isStr(st.loop.on)) err(`${sp}.loop`, "needs `on` (what sends work back)");
          if ("maxRounds" in st.loop && !(Number.isInteger(st.loop.maxRounds) && st.loop.maxRounds >= 1)) err(`${sp}.loop.maxRounds`, "must be a positive integer");
        }
      }
    });
    // references inside the lifecycle
    lc.stages.forEach((st, i) => {
      if (!isObj(st)) return;
      const sp = `${p}.stages[${i}] (${st.id})`;
      if (isStrArr(st.after)) for (const a of st.after) {
        if (!ids.has(a)) err(`${sp}.after`, `"${a}" is not a stage of ${code}`);
        else if (a === st.id) err(`${sp}.after`, "a stage cannot follow itself");
      }
      if (isObj(st.loop) && "to" in st.loop) {
        if (!ids.has(st.loop.to)) err(`${sp}.loop.to`, `"${st.loop.to}" is not a stage of ${code}`);
      }
    });
    if (lc.stages.every(isObj)) {
      const cycle = findCycle(lc.stages);
      if (cycle) err(`${p}.stages`, `cycle in \`after\`: ${cycle.join(" -> ")}`);
      // "Builds code": a software-engineer stage that runs a build skill or produces a diff / fix / code.
      const builds = lc.stages.some((s) => s.agent === "software-engineer" &&
        ((s.skills ?? []).some((k) => ["implement-feature", "fix-bug"].includes(k)) || /diff|fix|code|implement|refactor/i.test((s.produces ?? []).join(" "))));
      const reviews = lc.stages.some((s) => s.agent === "code-reviewer");
      if (builds && !reviews) wrn(p, "builds code (a software-engineer stage) but has no code-reviewer stage");
    }
  }
  // composite cycles (A contains B contains A)
  for (const code of Object.keys(lifecycles)) {
    const seen = new Set();
    const visit = (c, trail) => {
      const lc = lifecycles[c];
      if (!isObj(lc) || !isStrArr(lc.segments)) return;
      for (const s of lc.segments) {
        if (s === code && trail.length) { err(`lifecycles.${code}.segments`, `composite cycle: ${[...trail, s].join(" -> ")}`); return; }
        if (!seen.has(s)) { seen.add(s); visit(s, [...trail, s]); }
      }
    };
    visit(code, [code]);
  }
  for (const g of Object.keys(gates)) if (!usedGates.has(g)) wrn(`gates.${g}`, "is defined but no stage uses it");

  // routing
  const r = wf.routing;
  if (isObj(r)) {
    unknownKeys(r, ["byType", "handOff", "routeImmediately"], "routing");
    if (!isObj(r.byType)) err("routing.byType", "must be an object { <request type>: <lifecycle code> }");
    else for (const [t, lc] of Object.entries(r.byType)) if (!(lc in lifecycles)) err(`routing.byType.${t}`, `"${lc}" is not a defined lifecycle`);
    if (!isObj(r.handOff)) err("routing.handOff", "must be an object { <work kind>: <agent id> }");
    else {
      for (const [k, a] of Object.entries(r.handOff)) usedAgent(a, `routing.handOff["${k}"]`);
      if ("agent-artifact work" in r.handOff && r.handOff["agent-artifact work"] !== "agent-manager") err(`routing.handOff["agent-artifact work"]`, "must stay agent-manager (fixed guardrail)");
    }
    if (!isStrArr(r.routeImmediately)) err("routing.routeImmediately", "must be an array of request types");
  } else if ("routing" in wf) err("routing", "must be an object");

  // clarify
  const c = wf.clarify;
  if (isObj(c)) {
    unknownKeys(c, ["maxRounds", "matrix"], "clarify");
    if (!(Number.isInteger(c.maxRounds) && c.maxRounds >= 1)) err("clarify.maxRounds", "must be a positive integer");
    if (!isObj(c.matrix)) err("clarify.matrix", "must be an object { <asker>: [{ agent, about }] }");
    else for (const [asker, rows] of Object.entries(c.matrix)) {
      const p = `clarify.matrix.${asker}`;
      usedAgent(asker, p);
      if (!Array.isArray(rows)) { err(p, "must be an array of { agent, about }"); continue; }
      rows.forEach((row, i) => {
        if (!isObj(row)) return err(`${p}[${i}]`, "must be { agent, about }");
        unknownKeys(row, ["agent", "about"], `${p}[${i}]`);
        usedAgent(row.agent, `${p}[${i}].agent`, { human: true });
        if (row.agent === asker) err(`${p}[${i}].agent`, "an agent cannot consult itself");
        if (!isStr(row.about)) err(`${p}[${i}]`, "needs `about`");
      });
    }
  } else if ("clarify" in wf) err("clarify", "must be an object");

  // documents, review, artifacts
  const d = wf.documents;
  if (isObj(d)) {
    unknownKeys(d, ["writer", "critic"], "documents");
    usedAgent(d.writer, "documents.writer");
    if (d.critic === null) wrn("documents.critic", "is null — documents reach gates without critique");
    else usedAgent(d.critic, "documents.critic");
  } else if ("documents" in wf) err("documents", "must be an object");
  if (isObj(wf.review)) {
    unknownKeys(wf.review, ["axes"], "review");
    if (!isStrArr(wf.review.axes) || !wf.review.axes.length) err("review.axes", "must be a non-empty array");
    else for (const a of wf.review.axes) if (!AXES.includes(a)) err("review.axes", `"${a}" is not an axis (${AXES.join(", ")})`);
  } else if ("review" in wf) err("review", "must be an object");
  if (isObj(wf.artifacts)) {
    unknownKeys(wf.artifacts, ARTIFACTS, "artifacts");
    for (const k of ARTIFACTS) if (!isStr(wf.artifacts[k])) err(`artifacts.${k}`, "must be a non-empty path");
  } else if ("artifacts" in wf) err("artifacts", "must be an object");

  return { errors, warnings };
}

// `after` defaults to the previous stage; [] starts the lifecycle.
const afterOf = (stages, i) => Array.isArray(stages[i].after) ? stages[i].after : i === 0 ? [] : [stages[i - 1].id];

function findCycle(stages) {
  const graph = new Map(stages.map((s, i) => [s.id, afterOf(stages, i).filter((a) => stages.some((x) => x.id === a))]));
  const state = new Map(); // 1 visiting, 2 done
  const stack = [];
  const dfs = (n) => {
    state.set(n, 1); stack.push(n);
    for (const m of graph.get(n) ?? []) {
      if (state.get(m) === 1) return [...stack.slice(stack.indexOf(m)), m].reverse();
      if (!state.has(m)) { const c = dfs(m); if (c) return c; }
    }
    state.set(n, 2); stack.pop();
    return null;
  };
  for (const n of graph.keys()) if (!state.has(n)) { const c = dfs(n); if (c) return c; }
  return null;
}

// ---- show -----------------------------------------------------------------------
function table(rows) {
  const w = rows[0].map((_, i) => Math.max(...rows.map((r) => String(r[i]).length)));
  const line = (r) => `| ${r.map((c, i) => String(c).padEnd(w[i])).join(" | ")} |`;
  return [line(rows[0]), `|${w.map((n) => "-".repeat(n + 2)).join("|")}|`, ...rows.slice(1).map(line)].join("\n");
}

function show(wf, only, mermaid) {
  const codes = only ? [only] : Object.keys(wf.lifecycles);
  if (only && !(only in wf.lifecycles)) usage(`no lifecycle "${only}" (have ${Object.keys(wf.lifecycles).join(", ")})`);
  const out = [];
  for (const code of codes) {
    const lc = wf.lifecycles[code];
    if (mermaid) { out.push(`### ${code} · ${lc.name}`, "", "```mermaid", ...flowchart(wf, code), "```", ""); continue; }
    out.push(`## ${code} · ${lc.name} (${lc.kind})`, `Pick when: ${lc.pickWhen}`, `Exit artifact: ${lc.exitArtifact}`);
    if (lc.note) out.push(`Note: ${lc.note}`);
    if (lc.segments) {
      out.push(`Segments: ${lc.segments.map((s) => { const g = lastGate(wf, s); return g ? `${s} -> ${g}` : s; }).join(" -> ")}`, "");
      continue;
    }
    const rows = [["stage", "agent", "after", "when", "gate", "loop"]];
    lc.stages.forEach((st, i) => {
      const after = afterOf(lc.stages, i);
      rows.push([
        st.id + (st.critique && wf.documents.critic ? " *" : ""),
        st.agent,
        after.length ? after.join(", ") : "(start)",
        st.when ?? "",
        st.gate ? `${st.gate} (${wf.gates[st.gate]?.approver ?? "?"})` : "",
        st.loop ? `-> ${st.loop.to}${st.loop.maxRounds ? ` x${st.loop.maxRounds}` : ""}` : "",
      ]);
    });
    out.push("", table(rows));
    if (lc.stages.some((s) => s.critique) && wf.documents.critic) out.push(`* documents written by ${wf.documents.writer}, critiqued by ${wf.documents.critic} in parallel`);
    out.push("");
  }
  if (!mermaid && !only) {
    out.push("## Gates", "", table([["gate", "name", "approver", "approves"], ...Object.entries(wf.gates).map(([g, d]) => [g, d.name, d.approver, d.approves])]), "");
    const dis = wf.agents.disabled.length ? wf.agents.disabled.join(", ") : "none";
    const cus = Object.keys(wf.agents.custom).length ? Object.keys(wf.agents.custom).join(", ") : "none";
    out.push(`Disabled agents: ${dis} · Custom agents: ${cus} · Clarify: max ${wf.clarify.maxRounds} rounds · Review axes: ${wf.review.axes.join(", ")}`);
  }
  console.log(out.join("\n").trimEnd());
}

function lastGate(wf, code) {
  const lc = wf.lifecycles[code];
  if (!lc) return null;
  if (lc.segments) return lastGate(wf, lc.segments.at(-1));
  return lc.stages.findLast((s) => s.gate)?.gate ?? null;
}

const nid = (s) => s.replace(/[^A-Za-z0-9_]/g, "_");
const label = (s) => s.replace(/"/g, "#quot;");

function flowchart(wf, code) {
  const lc = wf.lifecycles[code];
  const out = ["flowchart LR"];
  if (lc.segments) {
    const parts = ["start((start))"];
    for (const s of lc.segments) {
      const g = lastGate(wf, s);
      parts.push(`seg_${nid(s)}["${label(s)}<br/>${label(wf.lifecycles[s]?.name ?? "?")}"]`);
      if (g) parts.push(`gate_${nid(s)}{{"${label(g)} · ${wf.gates[g]?.approver ?? "?"}"}}`);
    }
    parts.push("finish((done))");
    out.push(`  ${parts.join(" --> ")}`);
    return out;
  }
  const st = lc.stages;
  const succ = new Map(st.map((s) => [s.id, []]));
  st.forEach((s, i) => { for (const a of afterOf(st, i)) succ.get(a)?.push(s.id); });
  out.push("  start((start))", "  finish((done))");
  for (const s of st) {
    // A conditional stage (`when`) is drawn as a parallelogram with its condition.
    const text = `${label(s.id)}<br/>${label(s.agent)}${s.when ? `<br/><i>if ${label(s.when)}</i>` : ""}`;
    out.push(`  ${nid(s.id)}${s.when ? `[/"${text}"/]` : `["${text}"]`}`);
    if (s.gate) out.push(`  gate_${nid(s.id)}{{"${label(s.gate)} · ${wf.gates[s.gate]?.approver ?? "?"}"}}`);
  }
  st.forEach((s, i) => { if (afterOf(st, i).length === 0) out.push(`  start --> ${nid(s.id)}`); });
  for (const s of st) {
    const from = s.gate ? `gate_${nid(s.id)}` : nid(s.id);
    if (s.gate) out.push(`  ${nid(s.id)} --> ${from}`);
    const next = succ.get(s.id);
    if (!next.length) out.push(`  ${from} --> finish`);
    for (const n of next) out.push(`  ${from} --> ${nid(n)}`);
  }
  for (const s of st) if (s.loop) out.push(`  ${nid(s.id)} -.->|"${label(s.loop.on.length > 48 ? `${s.loop.on.slice(0, 45)}...` : s.loop.on)}"| ${nid(s.loop.to)}`);
  return out;
}

// ---- diff -----------------------------------------------------------------------
// Stages are compared by id and clarify rows by agent, not position, so a reordered or inserted
// entry reads as one change.
function normalise(v) {
  if (Array.isArray(v)) {
    const byAgent = v.length && v.every((x) => isObj(x) && typeof x.agent === "string") && new Set(v.map((x) => x.agent)).size === v.length;
    return byAgent ? Object.fromEntries(v.map((x) => [x.agent, x.about ?? normalise(x)])) : v.map(normalise);
  }
  if (!isObj(v)) return v;
  const o = {};
  for (const [k, x] of Object.entries(v)) {
    if (k === "stages" && Array.isArray(x) && x.every((s) => isObj(s) && typeof s.id === "string")) {
      o.stages = Object.fromEntries(x.map((s) => [s.id, normalise(s)]));
      o["stage order"] = x.map((s) => s.id);
    } else o[k] = normalise(x);
  }
  return o;
}

function diff(a, b, p, out) {
  if (isObj(a) && isObj(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const q = p ? `${p}.${k}` : k;
      if (!(k in b)) out.push(`- only in project: ${q} = ${short(a[k])}`);
      else if (!(k in a)) out.push(`+ only in other:   ${q} = ${short(b[k])}`);
      else diff(a[k], b[k], q, out);
    }
  } else if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`~ changed:         ${p}: ${short(a)} (project) vs ${short(b)} (other)`);
  return out;
}
const short = (v) => { const s = JSON.stringify(v); return s.length > 100 ? `${s.slice(0, 97)}...` : s; };

// ---- main -----------------------------------------------------------------------
const wf = load(FILE);
const relFile = path.relative(process.cwd(), FILE) || FILE;

if (COMMAND === "validate") {
  const { errors, warnings } = validate(wf);
  for (const e of errors) console.log(`error: ${e}`);
  for (const w of warnings) console.log(`warning: ${w}`);
  console.log(errors.length ? `${relFile}: ${errors.length} error(s), ${warnings.length} warning(s)` : `${relFile}: valid${warnings.length ? `, ${warnings.length} warning(s)` : ""}`);
  process.exit(errors.length ? 1 : 0);
}

if (COMMAND === "show") {
  const { errors } = validate(wf);
  if (errors.length) {
    for (const e of errors) console.log(`error: ${e}`);
    console.log(`${relFile} is invalid; fix it before showing it (node .ai-dlc/workflow.mjs validate).`);
    process.exit(1);
  }
  show(wf, positional[1], argv.includes("--mermaid"));
  process.exit(0);
}

if (COMMAND === "diff") {
  const against = opt("--against");
  if (!against) usage("diff needs --against <path>");
  const lines = diff(normalise(wf), normalise(load(path.resolve(against))), "", []);
  console.log(lines.length ? lines.join("\n") : "no differences");
  if (lines.length) console.log(`${lines.length} difference(s) between ${relFile} (project) and ${path.relative(process.cwd(), path.resolve(against))} (other)`);
  process.exit(lines.length ? 1 : 0);
}
