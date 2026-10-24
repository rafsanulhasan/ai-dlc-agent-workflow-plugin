// Tests for plugins/claude/ai-dlc/skills/workflow/templates/workflow.mjs (the workflow CLI).
// Run from the repository root: node --test     No dependencies. Each test mutates a temp copy of the default workflow.json
// and drives the CLI as a child process; nothing under plugins/ is written.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PLUGIN = path.join(REPO, "plugins", "claude", "ai-dlc");
const CLI = path.join(PLUGIN, "skills", "workflow", "templates", "workflow.mjs");
const DEFAULT = path.join(PLUGIN, "skills", "workflow", "templates", "workflow.json");

let tmp, root, n = 0;
before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wf-test-")); root = path.join(tmp, "repo"); fs.mkdirSync(root); });
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const defaultWf = () => JSON.parse(fs.readFileSync(DEFAULT, "utf8"));
const aaw = (wf) => wf.lifecycles.AAWP.stages;

function write(wf, name = `wf-${++n}.json`) {
  const f = path.join(tmp, name);
  fs.writeFileSync(f, typeof wf === "string" ? wf : JSON.stringify(wf, null, 2));
  return f;
}
function cli(args, opts = {}) {
  // The shell's loop-limit variables never leak in; a test sets them through opts.env.
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (/^AI_DLC_(CRITIQUE|TEST|CODE_REVIEW|HANDOFF_REVIEW)_MAX_(ROUNDS|FAILURES)$/.test(k)) delete env[k];
  const r = spawnSync(process.execPath, [CLI, "--root", opts.root ?? root, ...args], { encoding: "utf8", cwd: tmp, env: { ...env, ...opts.env } });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
const validate = (wf, extra = ["--plugin", PLUGIN]) => cli(["validate", "--file", write(wf), ...extra]);
const withoutStage = (wf, id) => { const s = aaw(wf); s.splice(s.findIndex((x) => x.id === id), 1); return wf; };

// ---- default workflow ----------------------------------------------------------
test("default workflow validates with --plugin (exit 0, 'valid')", () => {
  const r = validate(defaultWf());
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /: valid/);
  assert.doesNotMatch(r.out, /^error:/m);
});

test("default workflow validates against a generated catalog, without --plugin", () => {
  const cat = path.join(tmp, "catalog-ok.json");
  const g = cli(["catalog", "--plugin", PLUGIN, "--out", cat]);
  assert.equal(g.code, 0, g.out + g.err);
  const r = cli(["validate", "--file", write(defaultWf()), "--catalog", cat]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /: valid/);
});

test("validate without --plugin and without a catalog fails and hints 'workflow upgrade'", () => {
  const r = cli(["validate", "--file", write(defaultWf()), "--catalog", path.join(tmp, "nope.json")]);
  assert.equal(r.code, 1);
  assert.match(r.out, /error: catalog: .*missing/);
  assert.match(r.out, /\/ai-dlc:workflow upgrade/);
});

// ---- catalog -------------------------------------------------------------------
test("catalog writes sorted agents/skills incl. the review agents, and reports counts", () => {
  const out = path.join(tmp, "sub", "dir", "catalog.json");
  const r = cli(["catalog", "--plugin", PLUGIN, "--out", out]);
  assert.equal(r.code, 0, r.out + r.err);
  const c = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.deepEqual(c.agents, [...c.agents].sort());
  assert.deepEqual(c.skills, [...c.skills].sort());
  for (const a of ["orchestrator", "agent-manager", "brutal-critique", "sqa-engineer", "code-reviewer"]) assert.ok(c.agents.includes(a), a);
  assert.ok(c.skills.includes("workflow"));
  assert.equal(c.plugin.name, "ai-dlc");
  assert.match(r.out, new RegExp(`${c.agents.length} agents . ${c.skills.length} skills`));
});

test("catalog without --plugin is a usage error (exit 2)", () => {
  const r = cli(["catalog", "--out", path.join(tmp, "x.json")]);
  assert.equal(r.code, 2);
  assert.match(r.err, /catalog needs --plugin/);
});

test("catalog on a directory that is not a plugin root is a usage error", () => {
  const r = cli(["catalog", "--plugin", tmp, "--out", path.join(tmp, "x.json")]);
  assert.equal(r.code, 2);
  assert.match(r.err, /not a plugin root/);
});

test("catalog omits deprecated agents and skills, and strips .agent.md suffixes", () => {
  const p = path.join(tmp, "mini-plugin");
  fs.mkdirSync(path.join(p, ".claude-plugin"), { recursive: true });
  fs.writeFileSync(path.join(p, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "mini", version: "1.2.3" }));
  fs.mkdirSync(path.join(p, "agents"));
  fs.writeFileSync(path.join(p, "agents", "live.md"), "---\nname: live\n---\n");
  fs.writeFileSync(path.join(p, "agents", "twin.agent.md"), "---\nname: twin\n---\n");
  fs.writeFileSync(path.join(p, "agents", "old.md"), "---\nname: old\nstatus: deprecated\n---\n");
  for (const [s, fm] of [["good", "name: good"], ["dead", "name: dead\nstatus: deprecated"]]) {
    fs.mkdirSync(path.join(p, "skills", s), { recursive: true });
    fs.writeFileSync(path.join(p, "skills", s, "SKILL.md"), `---\n${fm}\n---\n`);
  }
  const out = path.join(tmp, "mini-cat.json");
  assert.equal(cli(["catalog", "--plugin", p, "--out", out]).code, 0);
  const c = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.deepEqual(c.agents, ["live", "twin"]);
  assert.deepEqual(c.skills, ["good"]);
  assert.deepEqual(c.plugin, { name: "mini", version: "1.2.3" });
});

test("a stale stored catalog version gives a warning, not an error", () => {
  const f = path.join(root, ".ai-dlc", "catalog.json");
  assert.equal(cli(["catalog", "--plugin", PLUGIN, "--out", f]).code, 0);
  const c = JSON.parse(fs.readFileSync(f, "utf8")); c.plugin.version = "0.0.0-stale";
  fs.writeFileSync(f, JSON.stringify(c));
  try {
    const r = validate(defaultWf());
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /warning: catalog: .*0\.0\.0-stale/);
  } finally { fs.rmSync(path.join(root, ".ai-dlc"), { recursive: true, force: true }); }
});

// ---- AAW guardrail: the three review stages ------------------------------------
for (const [id, agent] of [["critique", "brutal-critique"], ["test", "sqa-engineer"], ["code-review", "code-reviewer"]]) {
  test(`removing the AAW ${id} stage fails with 'needs a ${agent} stage that loops back'`, () => {
    const wf = withoutStage(defaultWf(), id);
    // keep the graph otherwise valid: nothing may reference the removed stage
    for (const s of aaw(wf)) if (Array.isArray(s.after)) s.after = s.after.filter((a) => a !== id);
    const r = validate(wf);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, new RegExp(`error: lifecycles\\.AAWP: needs a ${agent} stage that loops back to the agent-manager stage`));
    assert.match(r.out, /\/ai-dlc:workflow upgrade/);
    for (const other of ["brutal-critique", "sqa-engineer", "code-reviewer"].filter((a) => a !== agent))
      assert.doesNotMatch(r.out, new RegExp(`needs a ${other} stage`));
  });

  test(`AAW ${id} stage whose loop targets a non-agent-manager stage fails the loopsBack check`, () => {
    const wf = defaultWf();
    const st = aaw(wf).find((s) => s.id === id);
    st.loop.to = id === "critique" ? "test" : "critique"; // a real stage, not owned by agent-manager
    const r = validate(wf);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, new RegExp(`needs a ${agent} stage that loops back`));
  });

  test(`AAW ${id} stage with no loop at all fails the loopsBack check`, () => {
    const wf = defaultWf();
    delete aaw(wf).find((s) => s.id === id).loop;
    const r = validate(wf);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, new RegExp(`needs a ${agent} stage that loops back`));
  });
}

test("a loop pointing at a stage id that does not exist reports it (and the guardrail)", () => {
  const wf = defaultWf();
  aaw(wf).find((s) => s.id === "test").loop.to = "ghost";
  const r = validate(wf);
  assert.equal(r.code, 1);
  assert.match(r.out, /loop\.to: "ghost" is not a stage of AAWP/);
  assert.match(r.out, /needs a sqa-engineer stage that loops back/);
});

test("the guardrail accepts a review stage with a different id if agent and loop-back hold", () => {
  const wf = defaultWf();
  aaw(wf).find((x) => x.id === "test").id = "run-tests";
  aaw(wf).find((x) => x.id === "code-review").after = ["run-tests"];
  const r = validate(wf);
  assert.equal(r.code, 0, r.out);
});

test("loop-back is resolved by the target stage's agent, not its id", () => {
  const wf = defaultWf();
  aaw(wf).find((s) => s.id === "change").id = "make-change";
  for (const s of aaw(wf)) {
    if (s.after?.includes("change")) s.after = s.after.map((a) => (a === "change" ? "make-change" : a));
    if (s.loop?.to === "change") s.loop.to = "make-change";
  }
  const r = validate(wf);
  assert.equal(r.code, 0, r.out);
});

test("AC-19.3.1 a starting stage of an agent other than product-owner, software-architect or agent-manager fails (G3)", () => {
  const wf = defaultWf();
  aaw(wf).find((s) => s.id === "test").after = [];
  const r = validate(wf);
  assert.equal(r.code, 1);
  assert.match(r.out, /error: lifecycles\.AAWP\.stages\[\d\] \(test\): a starting stage must be product-owner, software-architect or agent-manager \(fixed guardrail\)/);
});

test("routing.byType['Agent Artifact'] missing -> error naming upgrade", () => {
  const wf = defaultWf(); delete wf.routing.byType["Agent Artifact"];
  const r = validate(wf);
  assert.equal(r.code, 1);
  assert.match(r.out, /routing\.byType\["Agent Artifact"\]: missing/);
  assert.match(r.out, /\/ai-dlc:workflow upgrade/);
});

test("routing.byType['Agent Artifact'] naming an undefined lifecycle -> error", () => {
  const wf = defaultWf(); wf.routing.byType["Agent Artifact"] = ["AAWH", "AAWP", "NOPE"];
  const r = validate(wf);
  assert.equal(r.code, 1);
  assert.match(r.out, /routing\.byType\["Agent Artifact"\]: "NOPE" is not a defined lifecycle/);
});

test("routing.byType['Agent Artifact'] naming a segments lifecycle -> error", () => {
  const wf = defaultWf(); wf.routing.byType["Agent Artifact"] = ["AAWH", "AAWP", "AI-DLC"];
  const r = validate(wf);
  assert.equal(r.code, 1);
  assert.match(r.out, /"AI-DLC" must be a lifecycle with stages, not segments/);
});

test("handOff 'agent-artifact work' must stay agent-manager", () => {
  const wf = defaultWf(); wf.routing.handOff["agent-artifact work"] = "software-engineer";
  const r = validate(wf);
  assert.equal(r.code, 1);
  assert.match(r.out, /must stay agent-manager/);
});

// ---- undisableable agents ------------------------------------------------------
const MSG = {
  "orchestrator": /"orchestrator" cannot be disabled \(fixed guardrail\)/,
  "agent-manager": /"agent-manager" cannot be disabled \(fixed guardrail\)/,
  "brutal-critique": /"brutal-critique" cannot be disabled \(fixed guardrail: it critiques the docs of every agent-artifact change\)/,
  "sqa-engineer": /"sqa-engineer" cannot be disabled \(fixed guardrail: it tests the code of every agent-artifact change\)/,
  "code-reviewer": /"code-reviewer" cannot be disabled \(fixed guardrail: it reviews the code of every agent-artifact change\)/,
};
for (const [agent, re] of Object.entries(MSG)) {
  test(`disabling ${agent} fails with its guardrail message`, () => {
    const wf = defaultWf(); wf.agents.disabled = [agent];
    const r = validate(wf);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, re);
    assert.match(r.out, /error: agents\.disabled:/);
  });
}

test("disabling an agent a stage uses fails; reassigning that use makes it pass", () => {
  const wf = defaultWf(); wf.agents.disabled = ["presentation-manager"];
  const r1 = validate(wf);
  assert.equal(r1.code, 1);
  assert.match(r1.out, /"presentation-manager" is disabled in agents\.disabled/);
  wf.routing.handOff["a slide deck to create, update or review"] = "documentation-writer";
  const r2 = validate(wf);
  assert.equal(r2.code, 0, r2.out);
});

test("disabling the same agent twice reports the duplicate", () => {
  const wf = defaultWf(); wf.agents.disabled = ["devops-engineer", "devops-engineer"];
  const r = validate(wf);
  assert.match(r.out, /"devops-engineer" is listed twice/);
  assert.equal(r.code, 1);
});

test("disabling a name that is not a plugin agent gives 'is not a plugin agent' + did-you-mean", () => {
  const wf = defaultWf(); wf.agents.disabled = ["devops-enginer"];
  const r = validate(wf);
  assert.equal(r.code, 1);
  assert.match(r.out, /"devops-enginer" is not a plugin agent \(did you mean "devops-engineer"\?\)/);
});

// ---- unknown names -------------------------------------------------------------
test("unknown stage agent gives 'did you mean' and the upgrade hint", () => {
  const wf = defaultWf(); aaw(wf).find((s) => s.id === "test").agent = "sqa-enginer";
  const r = validate(wf);
  assert.equal(r.code, 1);
  assert.match(r.out, /unknown agent "sqa-enginer" .*\(did you mean "sqa-engineer"\?\).*\/ai-dlc:workflow upgrade/);
});

test("unknown stage skill gives 'did you mean' and the upgrade hint", () => {
  const wf = defaultWf(); aaw(wf)[0].skills = ["agent-managment"];
  const r = validate(wf);
  assert.equal(r.code, 1);
  assert.match(r.out, /unknown skill "agent-managment" .*\(did you mean "agent-management"\?\).*\/ai-dlc:workflow upgrade/);
});

test("a wildly different unknown name yields no 'did you mean'", () => {
  const wf = defaultWf(); aaw(wf)[0].skills = ["zzzzzzzzzzzzzzzzzzzz"];
  const r = validate(wf);
  assert.equal(r.code, 1);
  assert.match(r.out, /unknown skill "zzzzzzzzzzzzzzzzzzzz"/);
  assert.doesNotMatch(r.out, /did you mean/);
});

test("namespace-prefixed agent and skill names are rejected", () => {
  const wf = defaultWf(); aaw(wf)[0].agent = "ai-dlc:agent-manager"; aaw(wf)[0].skills = ["ai-dlc:agent-management"];
  const r = validate(wf);
  assert.equal(r.code, 1);
  assert.match(r.out, /use the bare id, without a namespace prefix/);
  assert.match(r.out, /use the bare skill name, without a namespace prefix/);
});

test("a project agent not declared in agents.custom is flagged; once declared the flag goes away", () => {
  const proj = path.join(tmp, "proj-agents"); fs.mkdirSync(path.join(proj, ".claude", "agents"), { recursive: true });
  fs.writeFileSync(path.join(proj, ".claude", "agents", "my-bot.md"), "---\nname: my-bot\n---\n");
  const wf = defaultWf(); wf.routing.handOff["a backlog or prioritisation question"] = "my-bot";
  let r = cli(["validate", "--file", write(wf), "--plugin", PLUGIN], { root: proj });
  assert.equal(r.code, 1);
  assert.match(r.out, /"my-bot" is a project agent but not declared in agents\.custom/);
  wf.agents.custom["my-bot"] = { description: "x" };
  r = cli(["validate", "--file", write(wf), "--plugin", PLUGIN], { root: proj });
  assert.equal(r.code, 0, r.out);
});

test("a custom agent without an agent file is an error", () => {
  const wf = defaultWf(); wf.agents.custom["ghost-bot"] = { description: "x" };
  const r = validate(wf);
  assert.equal(r.code, 1);
  assert.match(r.out, /no agent file: expected \.claude\/agents\/ghost-bot\.md/);
});

// ---- structural / boundary -----------------------------------------------------
test("unreadable --file exits 2; invalid JSON exits 2", () => {
  let r = cli(["validate", "--file", path.join(tmp, "missing.json"), "--plugin", PLUGIN]);
  assert.equal(r.code, 2); assert.match(r.err, /cannot read/);
  r = cli(["validate", "--file", write("{not json"), "--plugin", PLUGIN]);
  assert.equal(r.code, 2); assert.match(r.err, /not valid JSON/);
});

test("a non-object workflow ('[]') is an error, exit 1", () => {
  const r = validate("[]");
  assert.equal(r.code, 1);
  assert.match(r.out, /\$: the workflow must be a JSON object/);
});

test("unknown top-level key, wrong version and missing required key are all reported", () => {
  const wf = defaultWf(); wf.bogus = 1; wf.version = 2; delete wf.review;
  const r = validate(wf);
  assert.equal(r.code, 1);
  assert.match(r.out, /\$\.bogus: unknown key/);
  assert.match(r.out, /version: must be 1/);
  assert.match(r.out, /missing required key "review"/);
});

test("cycle in `after` is detected", () => {
  const wf = defaultWf();
  aaw(wf).find((s) => s.id === "change").after = ["code-review"];
  const r = validate(wf);
  assert.equal(r.code, 1);
  assert.match(r.out, /cycle in `after`/);
});

test("a gate with approver 'none' is a warning only (exit stays 0)", () => {
  const wf = defaultWf(); wf.gates.G4.approver = "none";
  const r = validate(wf);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /warning: gates\.G4: approver is none/);
});

test("a stage naming an undefined gate is an error", () => {
  const wf = defaultWf(); aaw(wf)[0].gate = "G99";
  const r = validate(wf);
  assert.equal(r.code, 1);
  assert.match(r.out, /gate "G99" is not defined in gates/);
});

// ---- CLI usage -----------------------------------------------------------------
test("no arguments prints help and exits 2; --help exits 0", () => {
  let r = spawnSync(process.execPath, [CLI], { encoding: "utf8" });
  assert.equal(r.status, 2); assert.match(r.stdout, /workflow\.mjs validate/);
  r = spawnSync(process.execPath, [CLI, "--help"], { encoding: "utf8" });
  assert.equal(r.status, 0);
});

test("unknown command, unknown option and valueless option are usage errors (exit 2)", () => {
  let r = cli(["frobnicate"]); assert.equal(r.code, 2); assert.match(r.err, /unknown command "frobnicate"/);
  r = cli(["validate", "--nope"]); assert.equal(r.code, 2); assert.match(r.err, /unknown option --nope/);
  r = cli(["validate", "--file"]); assert.equal(r.code, 2); assert.match(r.err, /--file needs a value/);
});

// ---- show ----------------------------------------------------------------------
test("show AAW lists the change, critique, test and code-review stages with agents and loops", () => {
  const r = cli(["show", "AAWP", "--file", write(defaultWf()), "--plugin", PLUGIN]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /## AAWP . Agent Artifact Work, plugin \/ mod \(focused, plugin variant\)/);
  for (const [id, agent] of [["change", "agent-manager"], ["critique", "brutal-critique"], ["test", "sqa-engineer"], ["code-review", "code-reviewer"]])
    assert.match(r.out, new RegExp(`\\| ${id}\\s+\\| ${agent}\\s+\\|`), `${id}/${agent}`);
  assert.equal((r.out.match(/-> change x2 f1/g) ?? []).length, 3);
  assert.match(r.out, /\| code-review\s+\| code-reviewer\s+\| test\s+\|/);
  assert.match(r.out, /\| test\s+\| sqa-engineer\s+\| change\s+\|/);
});

test("show AAW --mermaid draws the three loop-back edges to change", () => {
  const r = cli(["show", "AAWP", "--mermaid", "--file", write(defaultWf()), "--plugin", PLUGIN]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /flowchart LR/);
  for (const id of ["critique", "test", "code_review"]) assert.match(r.out, new RegExp(`${id} -\\.->\\|"[^"]+"\\| change`));
});

test("show with no lifecycle lists every lifecycle plus gates", () => {
  const r = cli(["show", "--file", write(defaultWf()), "--plugin", PLUGIN]);
  assert.equal(r.code, 0);
  for (const code of Object.keys(defaultWf().lifecycles)) assert.match(r.out, new RegExp(`## ${code} `));
  assert.match(r.out, /## Gates/);
  assert.match(r.out, /Disabled agents: none/);
});

test("show of an unknown lifecycle is a usage error", () => {
  const r = cli(["show", "NOPE", "--file", write(defaultWf()), "--plugin", PLUGIN]);
  assert.equal(r.code, 2);
  assert.match(r.err, /no lifecycle "NOPE"/);
});

test("show refuses an invalid workflow (exit 1) and prints the errors", () => {
  const wf = withoutStage(defaultWf(), "code-review");
  const r = cli(["show", "AAWP", "--file", write(wf), "--plugin", PLUGIN]);
  assert.equal(r.code, 1);
  assert.match(r.out, /needs a code-reviewer stage/);
  assert.match(r.out, /is invalid; fix it before showing it/);
});

// ---- diff ----------------------------------------------------------------------
test("diff of identical files: 'no differences', exit 0", () => {
  const r = cli(["diff", "--file", write(defaultWf()), "--against", write(defaultWf())]);
  assert.equal(r.code, 0);
  assert.equal(r.out.trim(), "no differences");
});

test("diff reports a removed stage and a changed field, exit 1", () => {
  const mine = withoutStage(defaultWf(), "code-review");
  mine.review.axes = ["standards"];
  const r = cli(["diff", "--file", write(mine), "--against", write(defaultWf())]);
  assert.equal(r.code, 1);
  assert.match(r.out, /\+ only in other:\s+lifecycles\.AAWP\.stages\.code-review/);
  assert.match(r.out, /review\.axes/);
  assert.match(r.out, /\d+ difference\(s\)/);
});

test("diff compares stages by id: a reordered stage list reports only the order", () => {
  const a = defaultWf(), b = defaultWf();
  const s = aaw(b); [s[1], s[2]] = [s[2], s[1]];
  const r = cli(["diff", "--file", write(a), "--against", write(b)]);
  assert.equal(r.code, 1);
  assert.match(r.out, /stage order/);
  assert.doesNotMatch(r.out, /stages\.(critique|test)\./);
});

test("diff without --against is a usage error", () => {
  const r = cli(["diff", "--file", write(defaultWf())]);
  assert.equal(r.code, 2);
  assert.match(r.err, /diff needs --against/);
});

// ---- AAW review stages (references/aaw-review.md) -------------------------------
const REVIEW_IDS = ["critique", "test", "code-review"];
const setLimits = (wf, values) => { for (const [id, v] of Object.entries(values)) Object.assign(aaw(wf).find((s) => s.id === id).loop, v); return wf; };

for (const id of REVIEW_IDS) {
  test(`AAW ${id} loop with its own maxRounds 4 / maxFailures 3 while the others keep 2 / 1 is valid`, () => {
    const r = validate(setLimits(defaultWf(), { [id]: { maxRounds: 4, maxFailures: 3 } }));
    assert.equal(r.code, 0, r.out);
  });
}

test("AAW review stages without `when` are valid (they run on every change)", () => {
  const wf = defaultWf(); for (const id of REVIEW_IDS) delete aaw(wf).find((s) => s.id === id).when;
  const r = validate(wf);
  assert.equal(r.code, 0, r.out);
});

// ---- AAW: code-review follows the test stage -----------------------------------
test("AAW code-review running in parallel with test (after: [change]) fails", () => {
  const wf = defaultWf(); aaw(wf).find((s) => s.id === "code-review").after = ["change"];
  const r = validate(wf);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\(code-review\)\.after: must include the sqa-engineer stage \(test\)/);
});

test("AAW code-review after both change and test is valid", () => {
  const wf = defaultWf(); aaw(wf).find((s) => s.id === "code-review").after = ["change", "test"];
  const r = validate(wf);
  assert.equal(r.code, 0, r.out);
});

test("AAW code-review placed directly after test with `after` omitted (defaults to the previous stage) is valid", () => {
  const wf = defaultWf(); delete aaw(wf).find((s) => s.id === "code-review").after;
  const r = validate(wf);
  assert.equal(r.code, 0, r.out);
});

// ---- W1: prototype names are not undisableable agents ---------------------------
test("disabling 'toString' or 'constructor' is not reported as a fixed guardrail", () => {
  const wf = defaultWf(); wf.agents.disabled = ["toString", "constructor"];
  // no catalog: the plugin-agent check is skipped, so only the guardrail lookup could fire
  const r = cli(["validate", "--file", write(wf), "--catalog", path.join(tmp, "absent.json")]);
  assert.doesNotMatch(r.out, /cannot be disabled/);
});

// ---- W2: a corrupt stored catalog during validate --plugin ----------------------
test("a corrupt stored catalog with --plugin gives a 'not valid JSON' warning, not an error", () => {
  const dir = path.join(root, ".ai-dlc");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "catalog.json"), "{ not json");
  try {
    const r = validate(defaultWf());
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /warning: catalog: .*catalog\.json is not valid JSON — run \/ai-dlc:workflow upgrade/);
    assert.doesNotMatch(r.out, /is for plugin version/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- AAW: review-stage `when` is an exact phrase (case and spacing ignored) ----
const whenResult = (id, when) => { const wf = defaultWf(); aaw(wf).find((s) => s.id === id).when = when; return validate(wf); };
const PHRASE = { "critique": "the change set contains docs", "test": "the change set contains code", "code-review": "the change set contains code" };
const whenError = (id) => new RegExp(`\\(${id}\\)\\.when: must be "${PHRASE[id]}" \\(case and spacing ignored\\), or be omitted`);

for (const [id, when] of [
  ["critique", "the change set contains docs"],
  ["critique", "The Change Set Contains DOCS"],
  ["critique", "  the change set contains docs  "],
  ["test", "the change set contains code"],
  ["test", "the  change\tset contains   code"],
  ["code-review", "THE CHANGE SET CONTAINS CODE"],
]) {
  test(`AAW ${id} when ${JSON.stringify(when)} is accepted`, () => {
    const r = whenResult(id, when);
    assert.equal(r.code, 0, r.out);
  });
}

for (const [id, when] of [
  ["critique", "the change set contains code"],      // the other kind
  ["test", "the change set contains docs"],
  ["code-review", "the change set contains docs"],
  ["test", "the change set contains code."],         // near misses
  ["test", "the change set contains codes"],
  ["test", "change set contains code"],
  ["test", "the change set does not contain code"],
  ["test", "non-code changes"],
  ["critique", "never"],
  ["critique", "false"],
  ["test", ""],
]) {
  test(`AAW ${id} when ${JSON.stringify(when)} is rejected, quoting the accepted phrase`, () => {
    const r = whenResult(id, when);
    assert.equal(r.code, 1, r.out);
    if (when !== "") assert.match(r.out, whenError(id));
  });
}

test("AAW review stage with a non-string when (5) is rejected", () => {
  const r = whenResult("test", 5);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, whenError("test"));
});

test("every review stage with an invalid when reports its own error", () => {
  const wf = defaultWf();
  aaw(wf).find((s) => s.id === "critique").when = "code";
  aaw(wf).find((s) => s.id === "test").when = "docs";
  aaw(wf).find((s) => s.id === "code-review").when = "no code";
  const r = validate(wf);
  for (const id of REVIEW_IDS) assert.match(r.out, whenError(id));
});

test("`when` is not enforced on non-review AAW stages", () => {
  const wf = defaultWf(); aaw(wf).find((s) => s.id === "change").when = "anything at all, not even code";
  assert.equal(validate(wf).code, 0);
});

// limit boundaries
test("maxRounds 1 with maxFailures 0 on all three AAW review loops is valid", () => {
  const wf = setLimits(defaultWf(), Object.fromEntries(REVIEW_IDS.map((id) => [id, { maxRounds: 1, maxFailures: 0 }])));
  assert.equal(validate(wf).code, 0);
});

test("maxRounds 1 with maxFailures omitted is valid: the default drops to maxRounds - 1 = 0", () => {
  const wf = defaultWf(); const l = aaw(wf).find((s) => s.id === "test").loop; l.maxRounds = 1; delete l.maxFailures;
  const r = validate(wf);
  assert.equal(r.code, 0, r.out);
});

test("all limits omitted on the AAW review loops is valid", () => {
  const wf = defaultWf(); for (const id of REVIEW_IDS) { const l = aaw(wf).find((s) => s.id === id).loop; delete l.maxRounds; delete l.maxFailures; }
  const r = validate(wf);
  assert.equal(r.code, 0, r.out);
});

// order boundaries
test("code-review whose omitted `after` follows a non-test previous stage fails", () => {
  const wf = defaultWf(); const s = aaw(wf);
  const cr = s.splice(s.findIndex((x) => x.id === "code-review"), 1)[0];
  delete cr.after;
  s.splice(s.findIndex((x) => x.id === "test"), 0, cr); // now directly after critique, before test
  const t = s.find((x) => x.id === "test"); t.after = ["change"];
  const r = validate(wf);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\(code-review\)\.after: must include the sqa-engineer stage/);
});

test("with no sqa-engineer stage, only the missing-stage error is reported (no 'after' error)", () => {
  const wf = withoutStage(defaultWf(), "test");
  aaw(wf).find((s) => s.id === "code-review").after = ["change"];
  const r = validate(wf);
  assert.match(r.out, /needs a sqa-engineer stage/);
  assert.doesNotMatch(r.out, /must include the sqa-engineer stage/);
});

test("a stage whose agent is 'constructor' or 'toString' does not crash the validator", () => {
  for (const a of ["constructor", "toString", "__proto__"]) {
    const wf = defaultWf(); aaw(wf).find((s) => s.id === "test").agent = a;
    const r = validate(wf);
    assert.equal(r.code, 1, `${a}: ${r.out}${r.err}`);
    assert.equal(r.err, "");
    assert.match(r.out, /needs a sqa-engineer stage/);
  }
});

test("the real-plugin-style corrupt catalog warning does not hide a genuine error", () => {
  const dir = path.join(root, ".ai-dlc"); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "catalog.json"), "");
  try {
    const wf = withoutStage(defaultWf(), "critique");
    const r = validate(wf);
    assert.equal(r.code, 1);
    assert.match(r.out, /warning: catalog: .*not valid JSON/);
    assert.match(r.out, /needs a brutal-critique stage/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- Round 3 (sqa-engineer): exact-phrase `when` boundaries ---------------------
for (const [label, id, when] of [
  ["newline between words", "test", "the change set\ncontains code"],
  ["CRLF between words", "critique", "the change set\r\ncontains docs"],
  ["leading and trailing newline/tab", "test", "\n\tthe change set contains code\t\n"],
  ["leading/trailing spaces", "code-review", "   the change set contains code   "],
  ["NBSP (U+00A0) as a separator", "test", "the change set contains code"],
  ["em space (U+2003) as a separator", "critique", "the change set contains docs"],
  ["ideographic space (U+3000) padding", "test", "　the change set contains code　"],
  ["mixed case + tabs", "code-review", "ThE\tChange SET  Contains\tCode"],
]) {
  test(`when accepted: ${label}`, () => {
    const r = whenResult(id, when);
    assert.equal(r.code, 0, r.out);
  });
}

for (const [label, id, when] of [
  ["trailing period", "test", "the change set contains code."],
  ["trailing period on docs", "critique", "The change set contains docs."],
  ["trailing semicolon", "test", "the change set contains code;"],
  ["zero-width space inside (U+200B is not whitespace)", "test", "the change set​contains code"],
  ["no space between words", "test", "the change setcontains code"],
  ["a word removed", "code-review", "the change set contains"],
  ["extra word", "test", "the change set contains code and docs"],
  ["prefix word", "test", "when the change set contains code"],
  ["phrase repeated", "test", "the change set contains code the change set contains code"],
  ["docs phrase on sqa-engineer", "test", "the change set contains docs"],
  ["docs phrase on code-reviewer", "code-review", "the change set contains docs"],
  ["code phrase on brutal-critique", "critique", "the change set contains code"],
  ["whitespace only", "test", "   \t\n "],
  ["Cyrillic homoglyph 'с' in 'code'", "test", "the change set contains сode"],
  ["fullwidth letters", "test", "the change set contains ｃｏｄｅ"],
  ["Turkish dotted/dotless i via toLowerCase edge: 'CONTAİNS'", "test", "the change set CONTAİNS code"],
]) {
  test(`when rejected: ${label}`, () => {
    const r = whenResult(id, when);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, whenError(id));
  });
}

for (const [label, val] of [["null", null], ["an array holding the phrase", ["the change set contains code"]], ["an object", { text: "the change set contains code" }], ["true", true], ["0", 0]]) {
  test(`when rejected: ${label} (non-string), with the phrase quoted`, () => {
    const r = whenResult("test", val);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, whenError("test"));
    assert.equal(r.err, "");
  });
}

test("when empty string: rejected with the exact-phrase error as well as the generic one", () => {
  const r = whenResult("code-review", "");
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, whenError("code-review"));
});

test("the error names the stage, quotes the phrase for its own kind, and leaves the other reviewers alone", () => {
  const r = whenResult("critique", "docs");
  assert.match(r.out, /lifecycles\.AAWP\.stages\[\d\] \(critique\)\.when: must be "the change set contains docs"/);
  assert.equal((r.out.match(/\.when: must be/g) ?? []).length, 1, r.out);
});

test("two code reviewers (test + code-review) with one bad `when` produce exactly one error naming that stage", () => {
  const r = whenResult("code-review", "docs");
  assert.equal((r.out.match(/\.when: must be/g) ?? []).length, 1, r.out);
  assert.match(r.out, /\(code-review\)\.when/);
});

test("a spare second sqa-engineer stage in AAW is also held to the code phrase", () => {
  const wf = defaultWf();
  aaw(wf).push({ id: "extra-test", agent: "sqa-engineer", when: "whenever", after: ["change"], loop: { to: "change", on: "x", maxRounds: 3 } });
  const r = validate(wf);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\(extra-test\)\.when: must be "the change set contains code"/);
});

test("a review stage with a wrong `when` is not rescued by being named differently (keyed on agent, not id)", () => {
  const wf = defaultWf();
  const s = aaw(wf).find((x) => x.id === "critique"); s.id = "docs-check"; s.when = "sometimes";
  const r = validate(wf);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\(docs-check\)\.when: must be "the change set contains docs"/);
});

test("a wrong `when` on a review stage that does not loop back is not checked (the loop-back error is reported instead)", () => {
  const wf = defaultWf(); const s = aaw(wf).find((x) => x.id === "test"); s.when = "whenever"; delete s.loop;
  const r = validate(wf);
  assert.match(r.out, /needs a sqa-engineer stage that loops back/);
  assert.doesNotMatch(r.out, /\(test\)\.when/);
});

test("show still renders a normalised-valid but mixed-case `when` verbatim", () => {
  const wf = defaultWf(); aaw(wf).find((s) => s.id === "test").when = "The Change Set Contains CODE";
  const r = cli(["show", "AAWP", "--file", write(wf), "--plugin", PLUGIN]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /The Change Set Contains CODE/);
});

// ---- loop limits: maxRounds / maxFailures, `rounds`, the AI_DLC_*_MAX_* variables ----
// Design: every stage loop and clarify has maxRounds (default 2) and maxFailures (default 1, or maxRounds - 1
// when lower), maxFailures < maxRounds; three env pairs, one per reviewer, override loops of that agent.
const rounds = (wf, env, extra = []) => cli(["rounds", "--json", "--file", write(wf), "--plugin", PLUGIN, ...extra], { env });
const parseRounds = (r) => { assert.equal(r.code, 0, r.out + r.err); return JSON.parse(r.out); };
const byId = (list) => Object.fromEntries(list.map((l) => [l.id, l]));
const lim = (l) => [l.maxRounds, l.maxRoundsSource, l.maxFailures, l.maxFailuresSource];
const PAIRS = {
  "brutal-critique": ["AI_DLC_CRITIQUE_MAX_ROUNDS", "AI_DLC_CRITIQUE_MAX_FAILURES"],
  "sqa-engineer": ["AI_DLC_TEST_MAX_ROUNDS", "AI_DLC_TEST_MAX_FAILURES"],
  "code-reviewer": ["AI_DLC_CODE_REVIEW_MAX_ROUNDS", "AI_DLC_CODE_REVIEW_MAX_FAILURES"],
};
const invalidWarning = (name, min, where = "environment") => new RegExp(`^warning: ${name}=.* in ${where.replace(/\./g, "\\.")} ignored: not a whole number >= ${min}; falling back to the next level$`, "m");
const allLoops = (wf) => Object.values(wf.lifecycles).filter((l) => Array.isArray(l.stages)).flatMap((l) => l.stages.filter((s) => s.loop));
const stripLimits = (wf) => {
  for (const s of allLoops(wf)) { delete s.loop.maxRounds; delete s.loop.maxFailures; }
  delete wf.clarify.maxRounds; delete wf.clarify.maxFailures;
  delete wf.handoffReview.maxRounds; delete wf.handoffReview.maxFailures;
  return wf;
};

// template
test("the template sets maxRounds 2 and maxFailures 1 on every loop and on clarify", () => {
  const wf = defaultWf();
  for (const s of allLoops(wf)) assert.deepEqual([s.loop.maxRounds, s.loop.maxFailures], [2, 1], s.id);
  assert.deepEqual([wf.clarify.maxRounds, wf.clarify.maxFailures], [2, 1]);
  assert.equal("maxRounds" in wf.review, false);
});

// validate: the file values
test("loop.maxRounds must be a whole number >= 1 (0, 1.5 and \"3\" rejected; 1 with maxFailures 0 accepted)", () => {
  for (const [v, ok] of [[0, false], [1.5, false], ["3", false], [1, true]]) {
    const wf = defaultWf(); for (const s of aaw(wf)) if (s.loop) { s.loop.maxRounds = v; s.loop.maxFailures = 0; }
    const r = validate(wf);
    assert.equal(r.code, ok ? 0 : 1, `maxRounds=${JSON.stringify(v)}: ${r.out}`);
    if (!ok) assert.match(r.out, /\(test\)\.loop\.maxRounds: must be a whole number >= 1/);
  }
});

test("loop.maxFailures must be a whole number >= 0 (-1, 0.5 and \"1\" rejected; 0 accepted)", () => {
  for (const [v, ok] of [[-1, false], [0.5, false], ["1", false], [0, true]]) {
    const wf = defaultWf(); aaw(wf).find((s) => s.id === "test").loop.maxFailures = v;
    const r = validate(wf);
    assert.equal(r.code, ok ? 0 : 1, `maxFailures=${JSON.stringify(v)}: ${r.out}`);
    if (!ok) assert.match(r.out, /\(test\)\.loop\.maxFailures: must be a whole number >= 0/);
  }
});

for (const [rounds_, failures] of [[2, 2], [1, 1], [3, 5]]) {
  test(`a loop with maxRounds ${rounds_} and maxFailures ${failures} fails: maxFailures must be below maxRounds`, () => {
    const wf = defaultWf(); Object.assign(aaw(wf).find((s) => s.id === "code-review").loop, { maxRounds: rounds_, maxFailures: failures });
    const r = validate(wf);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, new RegExp(`\\(code-review\\)\\.loop: maxFailures \\(${failures}\\) must be below maxRounds \\(${rounds_}\\)`));
  });
}

test("maxRounds omitted with maxFailures 2 fails and says the omitted maxRounds counts as 2", () => {
  const wf = defaultWf(); const l = aaw(wf).find((s) => s.id === "critique").loop; delete l.maxRounds; l.maxFailures = 2;
  const r = validate(wf);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\(critique\)\.loop: maxFailures \(2\) must be below maxRounds \(2\) \(maxRounds omitted: 2\)/);
});

test("clarify follows the same rule: 2/2 fails, 2/1 passes, both omitted passes", () => {
  let wf = defaultWf(); wf.clarify.maxFailures = 2;
  let r = validate(wf);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /error: clarify: maxFailures \(2\) must be below maxRounds \(2\)/);
  wf = defaultWf(); delete wf.clarify.maxRounds; delete wf.clarify.maxFailures;
  r = validate(wf);
  assert.equal(r.code, 0, r.out);
  wf = defaultWf(); wf.clarify.maxRounds = 0;
  r = validate(wf);
  assert.match(r.out, /clarify\.maxRounds: must be a whole number >= 1/);
});

test("an unknown loop key is still reported", () => {
  const wf = defaultWf(); aaw(wf).find((s) => s.id === "test").loop.maxFails = 1;
  const r = validate(wf);
  assert.equal(r.code, 1);
  assert.match(r.out, /\(test\)\.loop\.maxFails: unknown key/);
});

test("review.maxRounds is gone: it is now an unknown key, like any other review key", () => {
  for (const key of ["maxRounds", "rounds"]) {
    const wf = defaultWf(); wf.review[key] = 2;
    const r = validate(wf);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, new RegExp(`error: review\\.${key}: unknown key`));
  }
});

test("the AAW review steps each have their own pair: unequal values are valid (no shared budget)", () => {
  const wf = defaultWf();
  for (const [id, r_, f] of [["critique", 3, 2], ["test", 1, 0], ["code-review", 1, 0]]) Object.assign(aaw(wf).find((s) => s.id === id).loop, { maxRounds: r_, maxFailures: f });
  const r = validate(wf);
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /must be equal|share one/);
});

test("an old file with only maxRounds stays valid; maxFailures defaults to 1, or maxRounds - 1 when lower", () => {
  const wf = stripLimits(defaultWf());
  for (const id of REVIEW_IDS) aaw(wf).find((s) => s.id === id).loop.maxRounds = 3;
  const fdlc = wf.lifecycles.FDLC.stages.find((s) => s.loop); fdlc.loop.maxRounds = 1;
  wf.clarify.maxRounds = 3;
  assert.equal(validate(wf).code, 0);
  const m = byId(parseRounds(rounds(wf)));
  for (const id of REVIEW_IDS) assert.deepEqual(lim(m[`AAWP/${id}`]), [3, "loop", 1, "default"], id);
  assert.deepEqual(lim(m[`FDLC/${fdlc.id}`]), [1, "loop", 0, "default"]);
  assert.deepEqual(lim(m.clarify), [3, "loop", 1, "default"]);
});

test("loops and clarify with no limits at all validate and take the defaults 2 / 1", () => {
  const wf = stripLimits(defaultWf());
  assert.equal(validate(wf).code, 0);
  for (const l of parseRounds(rounds(wf))) assert.deepEqual(lim(l), [2, "default", 1, "default"], l.id);
});

// rounds
test("rounds lists every stage loop as lifecycle/stage, then clarify, gate-critique and handoff-review, with both limits and their sources", () => {
  const wf = defaultWf();
  const list = parseRounds(rounds(wf));
  const expected = [];
  for (const [code, lc] of Object.entries(wf.lifecycles)) if (Array.isArray(lc.stages))
    for (const s of lc.stages) if (s.loop) expected.push(`${code}/${s.id}`);
  assert.deepEqual(list.map((l) => l.id), [...expected, "clarify", "gate-critique", "handoff-review"]);
  for (const l of list) {
    assert.deepEqual(Object.keys(l).sort(), ["agent", "id", "lifecycle", "maxFailures", "maxFailuresSource", "maxRounds", "maxRoundsSource", "stage", "to"], l.id);
    assert.deepEqual(lim(l), l.id === "gate-critique" ? [2, "default", 1, "default"] : [2, "loop", 1, "loop"], l.id);
  }
  const c = byId(list)["AAWP/critique"];
  assert.deepEqual([c.lifecycle, c.stage, c.agent, c.to], ["AAWP", "critique", "brutal-critique", "change"]);
  const cl = byId(list).clarify;
  assert.deepEqual([cl.lifecycle, cl.stage, cl.agent, cl.to], [null, null, null, null]);
});

test("rounds without --json prints a table with both limits and a clarify row", () => {
  const r = cli(["rounds", "--file", write(defaultWf()), "--plugin", PLUGIN]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /\| loop\s+\| agent\s+\| to\s+\| maxRounds \| source\s+\| maxFailures \| source\s+\|/);
  assert.match(r.out, /\| AAWP\/critique\s+\| brutal-critique\s+\| change\s+\| 2\s+\| loop\s+\| 1\s+\| loop\s+\|/);
  assert.match(r.out, /\| clarify\s+\|\s+\|\s+\| 2\s+\| loop\s+\| 1\s+\| loop\s+\|/);
  assert.match(r.out, /\| gate-critique\s+\| brutal-critique\s+\|\s+\| 2\s+\| default \| 1\s+\| default \|/);
});

test("rounds refuses an invalid workflow (exit 1) and prints the errors", () => {
  const wf = defaultWf(); aaw(wf).find((s) => s.id === "test").loop.maxRounds = 0;
  const r = cli(["rounds", "--file", write(wf), "--plugin", PLUGIN]);
  assert.equal(r.code, 1);
  assert.match(r.out, /\(test\)\.loop\.maxRounds: must be a whole number >= 1/);
  assert.match(r.out, /is invalid; fix it before reading its round limits/);
});

// environment variables
test("precedence per property: a valid variable beats the loop value, which beats the default", () => {
  const wf = defaultWf(); const t = aaw(wf).find((s) => s.id === "test").loop;
  Object.assign(t, { maxRounds: 3, maxFailures: 1 });
  let m = byId(parseRounds(rounds(wf)));
  assert.deepEqual(lim(m["AAWP/test"]), [3, "loop", 1, "loop"]);
  m = byId(parseRounds(rounds(wf, { AI_DLC_TEST_MAX_ROUNDS: "5" })));
  assert.deepEqual(lim(m["AAWP/test"]), [5, "env", 1, "loop"]);
  m = byId(parseRounds(rounds(wf, { AI_DLC_TEST_MAX_FAILURES: "2" })));
  assert.deepEqual(lim(m["AAWP/test"]), [3, "loop", 2, "env"]);
  delete t.maxFailures;
  m = byId(parseRounds(rounds(wf, { AI_DLC_TEST_MAX_ROUNDS: "4" })));
  assert.deepEqual(lim(m["AAWP/test"]), [4, "env", 1, "default"]);
});

for (const [agent, [ROUNDS, FAILURES]] of Object.entries(PAIRS)) {
  test(`${ROUNDS} / ${FAILURES} override every ${agent} loop in every lifecycle, and no other loop`, () => {
    const wf = defaultWf();
    const before = byId(parseRounds(rounds(wf)));
    const r = rounds(wf, { [ROUNDS]: "6", [FAILURES]: "3" });
    const list = parseRounds(r);
    assert.equal(r.err, "");
    const mine = list.filter((l) => l.agent === agent);
    assert.ok(mine.length >= 1, `the template has a ${agent} loop`);
    for (const l of list) {
      if (l.agent === agent) assert.deepEqual(lim(l), [6, "env", 3, "env"], l.id);
      else assert.deepEqual(lim(l), lim(before[l.id]), l.id);
    }
  });
}

test("loops of other agents and clarify are file-only: all six variables leave them alone", () => {
  const env = Object.fromEntries(Object.values(PAIRS).flatMap(([a, b]) => [[a, "7"], [b, "2"]]));
  const m = byId(parseRounds(rounds(defaultWf(), env)));
  for (const id of ["PDLC/accept", "FDLC/architecture-review", "CRLC/address", "clarify"]) assert.deepEqual(lim(m[id]), [2, "loop", 1, "loop"], id);
});

test("unset or blank variables are not set: file values, no warning", () => {
  for (const env of [undefined, { AI_DLC_TEST_MAX_ROUNDS: "" }, { AI_DLC_TEST_MAX_FAILURES: "   " }]) {
    const r = rounds(defaultWf(), env);
    for (const l of parseRounds(r)) assert.deepEqual(lim(l), l.id === "gate-critique" ? [2, "default", 1, "default"] : [2, "loop", 1, "loop"], `${JSON.stringify(env)} ${l.id}`);
    assert.equal(r.err, "", JSON.stringify(env));
  }
});

test("surrounding spaces are accepted; the largest safe integer is accepted", () => {
  let r = rounds(defaultWf(), { AI_DLC_CODE_REVIEW_MAX_ROUNDS: "  3 " });
  assert.equal(byId(parseRounds(r))["AAWP/code-review"].maxRounds, 3);
  assert.equal(r.err, "");
  r = rounds(defaultWf(), { AI_DLC_CODE_REVIEW_MAX_ROUNDS: "9007199254740991" });
  assert.equal(byId(parseRounds(r))["AAWP/code-review"].maxRounds, 9007199254740991);
  assert.equal(r.err, "");
});

test("007 is rejected: leading zeros never count (ROUNDS and FAILURES)", () => {
  const r = rounds(defaultWf(), { AI_DLC_TEST_MAX_ROUNDS: "007", AI_DLC_TEST_MAX_FAILURES: "00" });
  assert.deepEqual(lim(byId(parseRounds(r))["AAWP/test"]), [2, "loop", 1, "loop"]);
  assert.match(r.err, invalidWarning("AI_DLC_TEST_MAX_ROUNDS", 1));
  assert.match(r.err, invalidWarning("AI_DLC_TEST_MAX_FAILURES", 0));
});

for (const bad of ["0", "-1", "1.5", "abc", "2x", "+2", "007", "00", "1e3", "0x2", "٢", "9007199254740993"]) {
  test(`AI_DLC_CRITIQUE_MAX_ROUNDS=${JSON.stringify(bad)} is ignored with one warning naming it; exit 0`, () => {
    const r = rounds(defaultWf(), { AI_DLC_CRITIQUE_MAX_ROUNDS: bad });
    assert.deepEqual(lim(byId(parseRounds(r))["AAWP/critique"]), [2, "loop", 1, "loop"]);
    assert.match(r.err, invalidWarning("AI_DLC_CRITIQUE_MAX_ROUNDS", 1));
    assert.equal((r.err.match(/^warning:/gm) ?? []).length, 1, r.err);
  });
}

for (const bad of ["-1", "1.5", "abc", "+0", "01", "1e0"]) {
  test(`AI_DLC_CRITIQUE_MAX_FAILURES=${JSON.stringify(bad)} is ignored with one warning naming it; exit 0`, () => {
    const r = rounds(defaultWf(), { AI_DLC_CRITIQUE_MAX_FAILURES: bad });
    assert.deepEqual(lim(byId(parseRounds(r))["AAWP/critique"]), [2, "loop", 1, "loop"]);
    assert.match(r.err, invalidWarning("AI_DLC_CRITIQUE_MAX_FAILURES", 0));
    assert.equal((r.err.match(/^warning:/gm) ?? []).length, 1, r.err);
  });
}

test("FAILURES 0 is valid (stop at the first failing verdict)", () => {
  const r = rounds(defaultWf(), { AI_DLC_CRITIQUE_MAX_FAILURES: "0" });
  assert.deepEqual(lim(byId(parseRounds(r))["AAWP/critique"]), [2, "loop", 0, "env"]);
  assert.equal(r.err, "");
});

// combined check after the variables
test("combined check: a ROUNDS that makes maxFailures >= maxRounds is ignored on those loops, with one warning", () => {
  const wf = defaultWf();
  const r = rounds(wf, { AI_DLC_TEST_MAX_ROUNDS: "1" });
  const list = parseRounds(r);
  const tests = list.filter((l) => l.agent === "sqa-engineer");
  for (const l of tests) assert.deepEqual(lim(l), [2, "loop", 1, "loop"], l.id);
  const lines = r.err.trim().split("\n");
  assert.equal(lines.length, 1, r.err);
  assert.match(lines[0], /^warning: AI_DLC_TEST_MAX_ROUNDS=1 \(env\) ignored on .*: maxFailures must stay below maxRounds; using workflow\.json$/);
  for (const l of tests) assert.ok(lines[0].includes(l.id), `${l.id} named in ${lines[0]}`);
});

test("combined check: a FAILURES that reaches maxRounds is ignored; both set and clashing are both ignored", () => {
  let r = rounds(defaultWf(), { AI_DLC_CODE_REVIEW_MAX_FAILURES: "2" });
  assert.deepEqual(lim(byId(parseRounds(r))["AAWP/code-review"]), [2, "loop", 1, "loop"]);
  assert.match(r.err, /AI_DLC_CODE_REVIEW_MAX_FAILURES=2 \(env\) ignored on /);
  r = rounds(defaultWf(), { AI_DLC_CODE_REVIEW_MAX_ROUNDS: "3", AI_DLC_CODE_REVIEW_MAX_FAILURES: "3" });
  assert.deepEqual(lim(byId(parseRounds(r))["AAWP/code-review"]), [2, "loop", 1, "loop"]);
  assert.match(r.err, /AI_DLC_CODE_REVIEW_MAX_ROUNDS=3 \(env\), AI_DLC_CODE_REVIEW_MAX_FAILURES=3 \(env\) ignored on /);
});

test("combined check: a pair that keeps maxFailures below maxRounds applies, ROUNDS 1 with FAILURES 0 included", () => {
  const r = rounds(defaultWf(), { AI_DLC_TEST_MAX_ROUNDS: "1", AI_DLC_TEST_MAX_FAILURES: "0" });
  assert.deepEqual(lim(byId(parseRounds(r))["AAWP/test"]), [1, "env", 0, "env"]);
  assert.equal(r.err, "");
});

// validate and show with variables
test("validate never fails on a bad variable: warnings on stderr only, exit 0", () => {
  const r = cli(["validate", "--file", write(defaultWf()), "--plugin", PLUGIN], { env: { AI_DLC_TEST_MAX_ROUNDS: "abc", AI_DLC_CODE_REVIEW_MAX_FAILURES: "5" } });
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /: valid/);
  assert.match(r.err, invalidWarning("AI_DLC_TEST_MAX_ROUNDS", 1));
  assert.match(r.err, /AI_DLC_CODE_REVIEW_MAX_FAILURES=5 \(env\) ignored on /);
  assert.doesNotMatch(r.out, /AI_DLC_/);
});

test("valid variables give no warning in validate", () => {
  const r = cli(["validate", "--file", write(defaultWf()), "--plugin", PLUGIN], { env: { AI_DLC_TEST_MAX_ROUNDS: "3", AI_DLC_TEST_MAX_FAILURES: "2" } });
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(r.err, "");
});

test("a variable never rescues a bad file: validate, show and rounds still exit 1", () => {
  const wf = defaultWf(); Object.assign(aaw(wf).find((s) => s.id === "test").loop, { maxRounds: 2, maxFailures: 2 });
  const env = { AI_DLC_TEST_MAX_ROUNDS: "5" };
  for (const cmd of ["validate", "show", "rounds"]) {
    const r = cli([cmd, "--file", write(wf), "--plugin", PLUGIN], { env });
    assert.equal(r.code, 1, `${cmd}: ${r.out}`);
    assert.match(r.out, /maxFailures \(2\) must be below maxRounds \(2\)/, cmd);
  }
});

test("rounds on an invalid workflow still warns once about a bad variable, and exits 1", () => {
  const wf = defaultWf(); aaw(wf).find((s) => s.id === "test").loop.maxRounds = 0;
  const r = cli(["rounds", "--file", write(wf), "--plugin", PLUGIN], { env: { AI_DLC_TEST_MAX_ROUNDS: "abc" } });
  assert.equal(r.code, 1);
  assert.equal((r.err.match(/AI_DLC_TEST_MAX_ROUNDS=/g) ?? []).length, 1, r.err);
});

test("show prints x<maxRounds> f<maxFailures> for every loop and for clarify, and honours the variables", () => {
  const wf = stripLimits(defaultWf());
  aaw(wf).find((s) => s.id === "critique").loop.maxRounds = 1;
  let r = cli(["show", "--file", write(wf), "--plugin", PLUGIN]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal((r.out.match(/\| -> [a-z-]+ x\d+ f\d+\s+\|/g) ?? []).length, allLoops(wf).length, r.out);
  assert.match(r.out, /\| critique\s+\|.*\| -> change x1 f0\s+\|/);
  assert.match(r.out, /Clarify: x2 f1 · Gate critique: x2 f1/);
  r = cli(["show", "AAWP", "--file", write(defaultWf()), "--plugin", PLUGIN], { env: { AI_DLC_CODE_REVIEW_MAX_ROUNDS: "5", AI_DLC_CODE_REVIEW_MAX_FAILURES: "4" } });
  assert.match(r.out, /\| code-review\s+\|.*\| -> change x5 f4\s+\|/);
  assert.equal((r.out.match(/-> change x2 f1/g) ?? []).length, 2, r.out);
});

test("a bad variable warns once in show, and show keeps exit 0", () => {
  const r = cli(["show", "--file", write(defaultWf()), "--plugin", PLUGIN], { env: { AI_DLC_CRITIQUE_MAX_ROUNDS: "abc" } });
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal((r.err.match(/AI_DLC_CRITIQUE_MAX_ROUNDS=/g) ?? []).length, 1, r.err);
});

test("--help prints the whole header comment: the rounds command and the six variables, and no code", () => {
  const r = spawnSync(process.execPath, [CLI, "--help"], { encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /workflow\.mjs rounds \[--json\]/);
  for (const name of Object.values(PAIRS).flat()) assert.ok(r.stdout.includes(name), name);
  assert.match(r.stdout, /the orchestrator adds the ai-dlc: prefix for plugin ones\.\s*$/);
  assert.doesNotMatch(r.stdout, /^import /m);
  assert.doesNotMatch(r.stdout, /AI_DLC_REVIEW_ROUNDS/);
});

// ---- loop limits from Claude Code settings files ----------------------------------
// Per property, highest first: env in .claude/settings.local.json, env in .claude/settings.json, the process
// environment, the loop's value, the default. The CLI reads the files itself (JSONC allowed).
let proj = 0;
function project({ local, shared } = {}) {
  const dir = path.join(tmp, `proj-${++proj}`);
  fs.mkdirSync(path.join(dir, ".claude"), { recursive: true });
  for (const [name, content] of [["settings.local.json", local], ["settings.json", shared]])
    if (content !== undefined) fs.writeFileSync(path.join(dir, ".claude", name), typeof content === "string" ? content : JSON.stringify(content, null, 2));
  return dir;
}
const roundsIn = (dir, env, wf = defaultWf()) => cli(["rounds", "--json", "--file", write(wf), "--plugin", PLUGIN], { root: dir, env });
const testLoop = (r) => byId(parseRounds(r))["AAWP/test"];

test("settings.local.json beats settings.json, which beats the process environment, which beats the loop", () => {
  const both = project({ local: { env: { AI_DLC_TEST_MAX_ROUNDS: "5" } }, shared: { env: { AI_DLC_TEST_MAX_ROUNDS: "4" } } });
  let r = roundsIn(both, { AI_DLC_TEST_MAX_ROUNDS: "3" });
  assert.deepEqual(lim(testLoop(r)), [5, "settings.local.json", 1, "loop"]);
  assert.equal(r.err, "");
  const shared = project({ shared: { env: { AI_DLC_TEST_MAX_ROUNDS: "4" } } });
  r = roundsIn(shared, { AI_DLC_TEST_MAX_ROUNDS: "3" });
  assert.deepEqual(lim(testLoop(r)), [4, "settings.json", 1, "loop"]);
  r = roundsIn(project(), { AI_DLC_TEST_MAX_ROUNDS: "3" });
  assert.deepEqual(lim(testLoop(r)), [3, "env", 1, "loop"]);
  r = roundsIn(project());
  assert.deepEqual(lim(testLoop(r)), [2, "loop", 1, "loop"]);
});

test("each property resolves on its own: ROUNDS from one level, FAILURES from another", () => {
  const dir = project({ local: { env: { AI_DLC_CODE_REVIEW_MAX_FAILURES: 2 } }, shared: { env: { AI_DLC_CODE_REVIEW_MAX_ROUNDS: 4 } } });
  const r = roundsIn(dir);
  assert.deepEqual(lim(byId(parseRounds(r))["AAWP/code-review"]), [4, "settings.json", 2, "settings.local.json"]);
});

test("settings values may be JSON numbers or strings; both follow the same rule", () => {
  const dir = project({ shared: { env: { AI_DLC_TEST_MAX_ROUNDS: 3, AI_DLC_TEST_MAX_FAILURES: "2" } } });
  assert.deepEqual(lim(testLoop(roundsIn(dir))), [3, "settings.json", 2, "settings.json"]);
});

test("an invalid value at one level is warned about, naming the file, and falls through to the next level", () => {
  const dir = project({ local: { env: { AI_DLC_TEST_MAX_ROUNDS: "007" } }, shared: { env: { AI_DLC_TEST_MAX_ROUNDS: 1.5 } } });
  let r = roundsIn(dir, { AI_DLC_TEST_MAX_ROUNDS: "4" });
  assert.deepEqual(lim(testLoop(r)), [4, "env", 1, "loop"]);
  assert.match(r.err, invalidWarning("AI_DLC_TEST_MAX_ROUNDS", 1, ".claude/settings.local.json"));
  assert.match(r.err, invalidWarning("AI_DLC_TEST_MAX_ROUNDS", 1, ".claude/settings.json"));
  r = roundsIn(dir, { AI_DLC_TEST_MAX_ROUNDS: "abc" });
  assert.deepEqual(lim(testLoop(r)), [2, "loop", 1, "loop"]);
  assert.match(r.err, invalidWarning("AI_DLC_TEST_MAX_ROUNDS", 1));
  assert.equal((r.err.match(/^warning:/gm) ?? []).length, 3, r.err);
});

test("a wrong type in a settings file (true, an array) is invalid and falls through", () => {
  const dir = project({ local: { env: { AI_DLC_TEST_MAX_FAILURES: true } }, shared: { env: { AI_DLC_TEST_MAX_FAILURES: [0] } } });
  const r = roundsIn(dir, { AI_DLC_TEST_MAX_FAILURES: "0" });
  assert.deepEqual(lim(testLoop(r)), [2, "loop", 0, "env"]);
  assert.match(r.err, invalidWarning("AI_DLC_TEST_MAX_FAILURES", 0, ".claude/settings.local.json"));
  assert.match(r.err, invalidWarning("AI_DLC_TEST_MAX_FAILURES", 0, ".claude/settings.json"));
});

test("a JSONC settings file with // and /* */ comments is read; comment markers inside strings are kept", () => {
  const dir = project({ shared: `{
  // team default for test reviews
  "$note": "a // inside a string, and /* this */ too",
  /* block
     comment */
  "env": { "AI_DLC_TEST_MAX_ROUNDS": "3" } // trailing
}
` });
  const r = roundsIn(dir);
  assert.deepEqual(lim(testLoop(r)), [3, "settings.json", 1, "loop"]);
  assert.equal(r.err, "");
});

test("an unparseable settings file is skipped with one warning naming it; the next level applies; exit 0", () => {
  const dir = project({ local: "{ \"env\": { \"AI_DLC_TEST_MAX_ROUNDS\": \"5\" ", shared: { env: { AI_DLC_TEST_MAX_ROUNDS: "4" } } });
  const r = roundsIn(dir);
  assert.deepEqual(lim(testLoop(r)), [4, "settings.json", 1, "loop"]);
  assert.match(r.err, /^warning: .*settings\.local\.json is not valid JSON \(comments allowed\); its env is skipped$/m);
  assert.equal((r.err.match(/^warning:/gm) ?? []).length, 1, r.err);
  const v = cli(["validate", "--file", write(defaultWf()), "--plugin", PLUGIN], { root: dir });
  assert.equal(v.code, 0, v.out + v.err);
});

test("missing settings files, or files without env, are skipped silently", () => {
  for (const dir of [project(), project({ local: {}, shared: { permissions: {} } })]) {
    const r = roundsIn(dir);
    assert.deepEqual(lim(testLoop(r)), [2, "loop", 1, "loop"]);
    assert.equal(r.err, "");
  }
});

test("the settings files of the project holding .ai-dlc/ are used, whatever --root says", () => {
  const dir = project({ shared: { env: { AI_DLC_CRITIQUE_MAX_ROUNDS: "6" } } });
  fs.mkdirSync(path.join(dir, ".ai-dlc"));
  const file = path.join(dir, ".ai-dlc", "workflow.json");
  fs.writeFileSync(file, JSON.stringify(defaultWf()));
  const r = cli(["rounds", "--json", "--file", file, "--plugin", PLUGIN], { root: project() });
  assert.deepEqual(lim(byId(parseRounds(r))["AAWP/critique"]), [6, "settings.json", 1, "loop"]);
});

test("the combined check names each dropped value with its source; the loop's file values are used", () => {
  const dir = project({ local: { env: { AI_DLC_TEST_MAX_ROUNDS: "1" } } });
  const r = roundsIn(dir);
  assert.deepEqual(lim(testLoop(r)), [2, "loop", 1, "loop"]);
  assert.match(r.err, /^warning: AI_DLC_TEST_MAX_ROUNDS=1 \(settings\.local\.json\) ignored on .*AAWP\/test.*: maxFailures must stay below maxRounds; using workflow\.json$/m);
});

test("show and the rounds table carry the settings sources too", () => {
  const dir = project({ local: { env: { AI_DLC_CODE_REVIEW_MAX_ROUNDS: "5", AI_DLC_CODE_REVIEW_MAX_FAILURES: "4" } } });
  let r = cli(["show", "AAWP", "--file", write(defaultWf()), "--plugin", PLUGIN], { root: dir });
  assert.match(r.out, /\| code-review\s+\|.*\| -> change x5 f4\s+\|/);
  r = cli(["rounds", "--file", write(defaultWf()), "--plugin", PLUGIN], { root: dir });
  assert.match(r.out, /\| AAWP\/code-review\s+\| code-reviewer\s+\| change\s+\| 5\s+\| settings\.local\.json \| 4\s+\| settings\.local\.json \|/);
});

// ---- gate critique: the critique of every `critique`-marked stage -----------------
// It has no loop object, so no file value: the AI_DLC_CRITIQUE_* pair (same levels, valid-value rule,
// warnings and combined check as a loop) or the default 2 / 1. Row `gate-critique` in `rounds`.
const gate = (r) => byId(parseRounds(r))["gate-critique"];

test("gate-critique row: lifecycle, stage and to null, agent brutal-critique, default 2 / 1", () => {
  const g = gate(rounds(defaultWf()));
  assert.deepEqual([g.lifecycle, g.stage, g.agent, g.to], [null, null, "brutal-critique", null]);
  assert.deepEqual(lim(g), [2, "default", 1, "default"]);
});

test("gate-critique takes the critique pair from each env level: settings.local.json, settings.json, environment", () => {
  let r = roundsIn(project({ local: { env: { AI_DLC_CRITIQUE_MAX_ROUNDS: "5" } }, shared: { env: { AI_DLC_CRITIQUE_MAX_ROUNDS: "4" } } }), { AI_DLC_CRITIQUE_MAX_ROUNDS: "3" });
  assert.deepEqual(lim(gate(r)), [5, "settings.local.json", 1, "default"]);
  r = roundsIn(project({ shared: { env: { AI_DLC_CRITIQUE_MAX_ROUNDS: "4", AI_DLC_CRITIQUE_MAX_FAILURES: 2 } } }), { AI_DLC_CRITIQUE_MAX_ROUNDS: "3" });
  assert.deepEqual(lim(gate(r)), [4, "settings.json", 2, "settings.json"]);
  r = roundsIn(project(), { AI_DLC_CRITIQUE_MAX_ROUNDS: "3", AI_DLC_CRITIQUE_MAX_FAILURES: "0" });
  assert.deepEqual(lim(gate(r)), [3, "env", 0, "env"]);
  assert.equal(r.err, "");
});

test("gate-critique: an invalid critique value falls through to the next level, with one warning", () => {
  let r = roundsIn(project({ local: { env: { AI_DLC_CRITIQUE_MAX_ROUNDS: "007" } } }), { AI_DLC_CRITIQUE_MAX_ROUNDS: "4" });
  assert.deepEqual(lim(gate(r)), [4, "env", 1, "default"]);
  assert.match(r.err, invalidWarning("AI_DLC_CRITIQUE_MAX_ROUNDS", 1, ".claude/settings.local.json"));
  assert.equal((r.err.match(/^warning:/gm) ?? []).length, 1, r.err);
  r = rounds(defaultWf(), { AI_DLC_CRITIQUE_MAX_FAILURES: "1.5" });
  assert.deepEqual(lim(gate(r)), [2, "default", 1, "default"]);
  assert.match(r.err, invalidWarning("AI_DLC_CRITIQUE_MAX_FAILURES", 0));
  assert.equal((r.err.match(/^warning:/gm) ?? []).length, 1, r.err);
});

test("gate-critique: the combined check drops both critique values there and keeps the default 2 / 1", () => {
  const r = rounds(defaultWf(), { AI_DLC_CRITIQUE_MAX_ROUNDS: "3", AI_DLC_CRITIQUE_MAX_FAILURES: "3" });
  assert.deepEqual(lim(gate(r)), [2, "default", 1, "default"]);
  assert.match(r.err, /^warning: AI_DLC_CRITIQUE_MAX_ROUNDS=3 \(env\), AI_DLC_CRITIQUE_MAX_FAILURES=3 \(env\) ignored on .*gate-critique/m);
});

test("the AAW critique loop and gate-critique resolve independently: the loop has a file value, the row does not", () => {
  const wf = defaultWf(); Object.assign(aaw(wf).find((s) => s.id === "critique").loop, { maxRounds: 4, maxFailures: 3 });
  let m = byId(parseRounds(rounds(wf)));
  assert.deepEqual(lim(m["AAWP/critique"]), [4, "loop", 3, "loop"]);
  assert.deepEqual(lim(m["gate-critique"]), [2, "default", 1, "default"]);
  // FAILURES 2 fits the loop (2 < 4) but not gate-critique (2 >= 2): dropped on the row only.
  const r = rounds(wf, { AI_DLC_CRITIQUE_MAX_FAILURES: "2" });
  m = byId(parseRounds(r));
  assert.deepEqual(lim(m["AAWP/critique"]), [4, "loop", 2, "env"]);
  assert.deepEqual(lim(m["gate-critique"]), [2, "default", 1, "default"]);
  // AAWH/critique keeps the template's 2 / 1, so FAILURES 2 is dropped there too.
  assert.match(r.err, /^warning: AI_DLC_CRITIQUE_MAX_FAILURES=2 \(env\) ignored on AAWH\/critique, gate-critique: /m);
});

// ---- merge: add what the project file lacks, never overwrite ----------------------
const mergeRun = (file, extra = []) => cli(["merge", "--file", file, "--template", DEFAULT, "--plugin", PLUGIN, ...extra]);
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

test("merge adds missing keys and keeps existing values that differ from the template", () => {
  const wf = defaultWf();
  delete wf.lifecycles.FDLC.stages.find((s) => s.id === "tests").loop.maxFailures;
  delete wf.lifecycles.FDLC.stages.find((s) => s.id === "tests").loop.maxRounds;
  wf.gates.G3.approver = "none";
  Object.assign(aaw(wf).find((s) => s.id === "code-review").loop, { maxRounds: 1, maxFailures: 0 });
  delete wf.artifacts.plans;
  const file = write(wf);
  const r = mergeRun(file);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /^\+ lifecycles\.FDLC\.stages\[tests\]\.loop\.maxRounds = 2$/m);
  assert.match(r.out, /^\+ lifecycles\.FDLC\.stages\[tests\]\.loop\.maxFailures = 1$/m);
  assert.match(r.out, /^\+ artifacts\.plans = /m);
  assert.match(r.out, /: valid/);
  const out = readJson(file);
  assert.equal(out.gates.G3.approver, "none");
  assert.deepEqual([aaw(out).find((s) => s.id === "code-review").loop.maxRounds, aaw(out).find((s) => s.id === "code-review").loop.maxFailures], [1, 0]);
  assert.equal(out.artifacts.plans, defaultWf().artifacts.plans);
  assert.equal(Object.keys(out.artifacts).at(-1), "plans", "a new key goes at the end of its object");
});

test("merge derives maxFailures from an existing maxRounds: min(1, maxRounds - 1)", () => {
  const wf = defaultWf();
  for (const [id, n] of [["critique", 1], ["test", 3], ["code-review", 2]]) { const l = aaw(wf).find((s) => s.id === id).loop; l.maxRounds = n; delete l.maxFailures; }
  wf.clarify.maxRounds = 1; delete wf.clarify.maxFailures;
  const file = write(wf);
  const r = mergeRun(file);
  assert.equal(r.code, 0, r.out + r.err);
  const out = readJson(file);
  assert.deepEqual(["critique", "test", "code-review"].map((id) => aaw(out).find((s) => s.id === id).loop.maxFailures), [0, 1, 1]);
  assert.equal(out.clarify.maxFailures, 0);
  assert.match(r.out, /^\+ lifecycles\.AAWP\.stages\[critique\]\.loop\.maxFailures = 0$/m);
});

test("merge matches stages by id: a missing stage is added in template order, a project-only stage is kept", () => {
  const wf = defaultWf();
  const s = aaw(wf);
  s.splice(s.findIndex((x) => x.id === "test"), 1);
  s.find((x) => x.id === "code-review").after = ["change"];
  s.push({ id: "security", agent: "code-reviewer", after: ["code-review"] });
  const file = write(wf);
  const r = mergeRun(file, ["--dry-run"]);
  assert.match(r.out, /^\+ lifecycles\.AAWP\.stages\[test\] = /m);
  mergeRun(file);
  const ids = aaw(readJson(file)).map((x) => x.id);
  assert.deepEqual(ids, ["intent", "design", "lld", "change", "test", "code-review", "docs", "critique", "security"]);
  assert.deepEqual(aaw(readJson(file)).find((x) => x.id === "code-review").after, ["change"], "an existing array is not touched");
});

test("merge adds a missing lifecycle and keeps a project-only one", () => {
  const wf = defaultWf();
  delete wf.lifecycles.TLC;
  wf.lifecycles.OPS = { name: "Ops", kind: "custom", pickWhen: "ops work", exitArtifact: "a runbook", stages: [{ id: "run", agent: "devops-engineer" }] };
  const file = write(wf);
  const r = mergeRun(file);
  assert.match(r.out, /^\+ lifecycles\.TLC = /m);
  const out = readJson(file);
  assert.ok(out.lifecycles.TLC && out.lifecycles.OPS);
});

test("merge never merges arrays element by element", () => {
  const wf = defaultWf();
  wf.review.axes = ["standards"];
  wf.agents.disabled = ["presentation-manager"];
  aaw(wf).find((s) => s.id === "critique").skills = [];
  const file = write(wf);
  const r = mergeRun(file);
  assert.equal(r.out.trim().split("\n")[0], "nothing to add", r.out);
  const out = readJson(file);
  assert.deepEqual(out.review.axes, ["standards"]);
  assert.deepEqual(out.agents.disabled, ["presentation-manager"]);
  assert.deepEqual(aaw(out).find((s) => s.id === "critique").skills, []);
});

test("merge --dry-run lists the additions and writes nothing", () => {
  const wf = defaultWf(); delete wf.clarify.maxFailures;
  const file = write(wf);
  const before = fs.readFileSync(file, "utf8");
  const r = mergeRun(file, ["--dry-run"]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /^\+ clarify\.maxFailures = 1$/m);
  assert.match(r.out, /dry run: nothing written/);
  assert.equal(fs.readFileSync(file, "utf8"), before);
});

test("merge of the pre-change template (AAW maxRounds 3, clarify 3, no maxFailures) passes validate and keeps the 3s", () => {
  const old = defaultWf();
  for (const s of allLoops(old)) { delete s.loop.maxFailures; delete s.loop.maxRounds; }
  for (const id of REVIEW_IDS) aaw(old).find((s) => s.id === id).loop.maxRounds = 3;
  old.clarify.maxRounds = 3; delete old.clarify.maxFailures;
  const file = write(old);
  const r = mergeRun(file);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /: valid/);
  const out = readJson(file);
  for (const id of REVIEW_IDS) assert.deepEqual([aaw(out).find((s) => s.id === id).loop.maxRounds, aaw(out).find((s) => s.id === id).loop.maxFailures], [3, 1], id);
  assert.deepEqual([out.clarify.maxRounds, out.clarify.maxFailures], [3, 1]);
  assert.equal(validate(out).code, 0);
});

test("merge writes the template's layout: merging the template into itself is a byte-for-byte no-op", () => {
  const file = path.join(tmp, `same-${++n}.json`);
  fs.copyFileSync(DEFAULT, file);
  // Drop the last key of an object (new keys go at the end) and write it in JSON.stringify's own layout.
  const wf = readJson(file); delete wf.artifacts[Object.keys(wf.artifacts).at(-1)];
  fs.writeFileSync(file, JSON.stringify(wf, null, 2));
  mergeRun(file);
  assert.equal(fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n"), fs.readFileSync(DEFAULT, "utf8").replace(/\r\n/g, "\n"));
});

test("merge never deletes: review.maxRounds stays, and validate reports it", () => {
  const wf = defaultWf(); wf.review.maxRounds = 1;
  const file = write(wf);
  const r = mergeRun(file);
  assert.equal(readJson(file).review.maxRounds, 1);
  assert.equal(r.code, 0, "nothing to add, so no write and no validate");
  assert.match(validate(readJson(file)).out, /review\.maxRounds: unknown key/);
});

test("merge without --template is a usage error", () => {
  const r = cli(["merge", "--file", write(defaultWf())]);
  assert.equal(r.code, 2);
  assert.match(r.err, /merge needs --template/);
});

// ---- round-1 final: gaps found by sqa-engineer (settings parsing, merge invariants) ----
test("JSONC: a URL with // and an escaped quote before // inside strings are kept; the env on the same line still applies", () => {
  const dir = project({ shared: '{ "u": "https://example.com/a//b", "q": "say \\"hi\\" // not a comment /* nor this */", "env": { "AI_DLC_TEST_MAX_ROUNDS": "4" } }' });
  const r = roundsIn(dir);
  assert.deepEqual(lim(testLoop(r)), [4, "settings.json", 1, "loop"]);
  assert.equal(r.err, "");
});

test("JSONC: a real comment after a string that contains // is still removed", () => {
  const dir = project({ local: '{\n  "env": { "AI_DLC_TEST_MAX_ROUNDS": "3" }, "u": "http://x" // trailing "quote\n}' });
  const r = roundsIn(dir);
  assert.deepEqual(lim(testLoop(r)), [3, "settings.local.json", 1, "loop"]);
  assert.equal(r.err, "");
});

test("a blank value at a higher level is 'not set': it falls through to the next level silently", () => {
  const dir = project({ local: { env: { AI_DLC_TEST_MAX_ROUNDS: "  " } }, shared: { env: { AI_DLC_TEST_MAX_ROUNDS: "4" } } });
  const r = roundsIn(dir);
  assert.deepEqual(lim(testLoop(r)), [4, "settings.json", 1, "loop"]);
  assert.equal(r.err, "");
});

test("a settings file whose env is not an object is skipped with one warning naming it; the next level applies", () => {
  const dir = project({ local: { env: ["AI_DLC_TEST_MAX_ROUNDS"] }, shared: { env: { AI_DLC_TEST_MAX_ROUNDS: "4" } } });
  const r = roundsIn(dir);
  assert.deepEqual(lim(testLoop(r)), [4, "settings.json", 1, "loop"]);
  assert.match(r.err, /^warning: .*settings\.local\.json: env is not an object; skipped$/m);
  assert.equal((r.err.match(/^warning:/gm) ?? []).length, 1, r.err);
});

test("settings numbers that are not safe whole numbers (1e21, 0, -1) are invalid for ROUNDS and fall through", () => {
  for (const bad of [1e21, 0, -1]) {
    const dir = project({ local: { env: { AI_DLC_TEST_MAX_ROUNDS: bad } } });
    const r = roundsIn(dir, { AI_DLC_TEST_MAX_ROUNDS: "3" });
    assert.deepEqual(lim(testLoop(r)), [3, "env", 1, "loop"], String(bad));
    assert.match(r.err, invalidWarning("AI_DLC_TEST_MAX_ROUNDS", 1, ".claude/settings.local.json"));
  }
});

test("combined check from two levels: ROUNDS (settings.local.json) and FAILURES (env) that clash are both dropped and both sources are named", () => {
  const dir = project({ local: { env: { AI_DLC_CODE_REVIEW_MAX_ROUNDS: "2" } } });
  const r = roundsIn(dir, { AI_DLC_CODE_REVIEW_MAX_FAILURES: "2" });
  assert.deepEqual(lim(byId(parseRounds(r))["AAWP/code-review"]), [2, "loop", 1, "loop"]);
  assert.match(r.err, /AI_DLC_CODE_REVIEW_MAX_ROUNDS=2 \(settings\.local\.json\), AI_DLC_CODE_REVIEW_MAX_FAILURES=2 \(env\) ignored on /);
});

test("a settings variable of one reviewer leaves the other two reviewers' loops and clarify on their file values", () => {
  const dir = project({ shared: { env: { AI_DLC_CRITIQUE_MAX_ROUNDS: "7", AI_DLC_CRITIQUE_MAX_FAILURES: "6" } } });
  const m = byId(parseRounds(roundsIn(dir)));
  assert.deepEqual(lim(m["AAWP/critique"]), [7, "settings.json", 6, "settings.json"]);
  assert.deepEqual(lim(m["AAWP/test"]), [2, "loop", 1, "loop"]);
  assert.deepEqual(lim(m["AAWP/code-review"]), [2, "loop", 1, "loop"]);
  assert.deepEqual(lim(m.clarify), [2, "loop", 1, "loop"]);
});

test("rounds --json: the clarify row has null lifecycle/stage/agent/to and is file-only", () => {
  const wf = defaultWf(); wf.clarify.maxRounds = 4; wf.clarify.maxFailures = 3;
  const row = byId(parseRounds(rounds(wf, { AI_DLC_TEST_MAX_ROUNDS: "9", AI_DLC_CRITIQUE_MAX_ROUNDS: "9", AI_DLC_CODE_REVIEW_MAX_ROUNDS: "9" })))["clarify"];
  assert.deepEqual([row.lifecycle, row.stage, row.agent, row.to], [null, null, null, null]);
  assert.deepEqual(lim(row), [4, "loop", 3, "loop"]);
});

test("merge is idempotent: a second merge adds nothing, writes nothing and leaves the file unchanged", () => {
  const wf = defaultWf();
  for (const s of allLoops(wf)) delete s.loop.maxFailures;
  delete wf.clarify.maxFailures; delete wf.artifacts.plans;
  const file = write(wf);
  const first = mergeRun(file);
  assert.equal(first.code, 0, first.out + first.err);
  const after1 = fs.readFileSync(file, "utf8");
  const second = mergeRun(file);
  assert.equal(second.code, 0, second.out + second.err);
  assert.equal(second.out.trim(), "nothing to add");
  assert.equal(fs.readFileSync(file, "utf8"), after1);
  assert.equal(mergeRun(file, ["--dry-run"]).out.trim(), "nothing to add");
});

test("merge result validates (with a catalog) when all limits were missing; --dry-run does not write", () => {
  const wf = stripLimits(defaultWf());
  const file = write(wf);
  const dry = mergeRun(file, ["--dry-run"]);
  assert.doesNotMatch(dry.out, /: valid/);
  assert.deepEqual(readJson(file).clarify, wf.clarify);
  const r = mergeRun(file);
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(validate(readJson(file)).code, 0);
});

test("merge keeps a project-only stage in its position among the template stages", () => {
  const wf = defaultWf();
  aaw(wf).splice(4, 0, { id: "extra", agent: "code-reviewer", after: ["change"] });
  const file = write(wf);
  mergeRun(file);
  assert.deepEqual(aaw(readJson(file)).map((x) => x.id), ["intent", "design", "lld", "change", "extra", "test", "code-review", "docs", "critique"]);
});

test("merge adds maxFailures next to an existing maxRounds of every value: 1 -> 0, 2 -> 1, 5 -> 1", () => {
  for (const [rounds_, expected] of [[1, 0], [2, 1], [5, 1]]) {
    const wf = defaultWf();
    const l = aaw(wf).find((s) => s.id === "test").loop; l.maxRounds = rounds_; delete l.maxFailures;
    const file = write(wf);
    mergeRun(file);
    assert.equal(aaw(readJson(file)).find((s) => s.id === "test").loop.maxFailures, expected, `maxRounds ${rounds_}`);
  }
});

test("merge on an old file with maxRounds: 1 everywhere keeps 1 and adds maxFailures 0", () => {
  const wf = defaultWf();
  for (const s of allLoops(wf)) { s.loop.maxRounds = 1; delete s.loop.maxFailures; }
  wf.clarify.maxRounds = 1; delete wf.clarify.maxFailures;
  const file = write(wf);
  const r = mergeRun(file);
  assert.equal(r.code, 0, r.out + r.err);
  const out = readJson(file);
  for (const s of allLoops(out)) assert.deepEqual([s.loop.maxRounds, s.loop.maxFailures], [1, 0]);
  assert.deepEqual([out.clarify.maxRounds, out.clarify.maxFailures], [1, 0]);
});

test("merge reports 'validate skipped' when there is no catalog yet, and still writes the additions", () => {
  const dir = fs.mkdtempSync(path.join(tmp, "nocat-"));
  const wf = defaultWf(); delete wf.artifacts.plans;
  const file = path.join(dir, "workflow.json");
  fs.writeFileSync(file, JSON.stringify(wf, null, 2));
  const r = cli(["merge", "--file", file, "--template", DEFAULT], { root: dir });
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /validate skipped: no catalog yet/);
  assert.ok(readJson(file).artifacts.plans);
});

// Guards D1: merge used to add the template's maxRounds (2) next to a project maxFailures of 2, breaking the rule
// maxFailures < maxRounds. It now adds max(template value, maxFailures + 1).
test("merge keeps maxFailures < maxRounds when only maxFailures exists in the project loop", () => {
  const wf = defaultWf();
  const l = aaw(wf).find((s) => s.id === "test").loop; delete l.maxRounds; l.maxFailures = 2;
  const file = write(wf);
  mergeRun(file);
  const out = readJson(file);
  const t = aaw(out).find((s) => s.id === "test").loop;
  assert.ok(t.maxFailures < t.maxRounds, JSON.stringify(t));
  assert.deepEqual([t.maxRounds, t.maxFailures], [3, 2]);
  assert.equal(validate(out).code, 0);
});

test("merge keeps the template's maxRounds when it is already above a project maxFailures", () => {
  const wf = defaultWf();
  const l = aaw(wf).find((s) => s.id === "test").loop; delete l.maxRounds; l.maxFailures = 0;
  const file = write(wf);
  mergeRun(file);
  const t = aaw(readJson(file)).find((s) => s.id === "test").loop;
  assert.deepEqual([t.maxRounds, t.maxFailures], [2, 0]);
});

test("a settings file whose top level is not an object is skipped with one warning naming it; the next level applies", () => {
  for (const top of ["[]", "\"text\"", "3"]) {
    const dir = project({ local: top, shared: { env: { AI_DLC_TEST_MAX_ROUNDS: "4" } } });
    const r = roundsIn(dir);
    assert.deepEqual(lim(testLoop(r)), [4, "settings.json", 1, "loop"], top);
    assert.match(r.err, /^warning: .*settings\.local\.json: top level is not an object; its env is skipped$/m, top);
    assert.equal((r.err.match(/^warning:/gm) ?? []).length, 1, r.err);
  }
});

test("a settings file that starts with a UTF-8 BOM is read like one without it", () => {
  const dir = project({ local: "\uFEFF" + JSON.stringify({ env: { AI_DLC_TEST_MAX_ROUNDS: "5" } }), shared: "\uFEFF// team\n{ \"env\": { \"AI_DLC_TEST_MAX_FAILURES\": \"2\" } }" });
  const r = roundsIn(dir);
  assert.deepEqual(lim(testLoop(r)), [5, "settings.local.json", 2, "settings.json"]);
  assert.equal(r.err, "");
});

// ---- root 19, WF-1: the two agent-artifact lifecycles AAWH and AAWP --------------------------------
// Spec docs/specs/aaw-variants.spec.md (D1-D3, D5, D9), LLD docs/specs/aaw-variants.lld.md (2.1-2.4, 4).
const aawh = (wf) => wf.lifecycles.AAWH.stages;
const agentsOf = (stages) => stages.map((s) => s.agent);
const errorLines = (r) => r.out.split(/\r?\n/).filter((l) => l.startsWith("error:"));
// Remove a stage and repoint every `after` and `loop.to` that named it at `to` (or drop the edge).
function dropStage(stages, id, to) {
  const i = stages.findIndex((s) => s.id === id);
  stages.splice(i, 1);
  for (const s of stages) {
    if (Array.isArray(s.after)) s.after = [...new Set(s.after.flatMap((a) => (a === id ? (to ? [to] : []) : [a])))];
    if (s.loop?.to === id) delete s.loop;
  }
  return stages;
}

test("AC-19.1.1 the template validates with AAWH and AAWP under one routing key", () => {
  const wf = defaultWf();
  assert.deepEqual(wf.routing.byType["Agent Artifact"], ["AAWH", "AAWP"]);
  assert.equal(wf.lifecycles.AAWH.variant, "harness");
  assert.equal(wf.lifecycles.AAWP.variant, "plugin");
  assert.equal("AAW" in wf.lifecycles, false, "the single AAW lifecycle is gone");
  const r = validate(wf);
  assert.equal(r.code, 0, r.out + r.err);
});

test("AC-19.1.1 this repository's .ai-dlc/workflow.json validates and routes agent-artifact work to AAWH and AAWP", () => {
  const file = path.join(REPO, ".ai-dlc", "workflow.json");
  const r = cli(["validate", "--file", file, "--plugin", PLUGIN], { root: REPO });
  assert.equal(r.code, 0, r.out + r.err);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")).routing.byType["Agent Artifact"], ["AAWH", "AAWP"]);
});

test("AC-19.1.2 AAWH has exactly product-owner, agent-manager, documentation-writer and brutal-critique; AAWP adds the design, test and review agents", () => {
  const wf = defaultWf();
  assert.deepEqual(agentsOf(aawh(wf)), ["product-owner", "agent-manager", "documentation-writer", "brutal-critique"]);
  assert.deepEqual(agentsOf(aaw(wf)), ["product-owner", "software-architect", "system-engineer", "agent-manager", "sqa-engineer", "code-reviewer", "documentation-writer", "brutal-critique"]);
  for (const st of [aawh(wf), aaw(wf)]) assert.equal(st.some((s) => s.agent === "software-engineer"), false);
  for (const code of ["AAWH", "AAWP"]) assert.equal(wf.lifecycles[code].stages.some((s) => "gate" in s), false, `${code} has no gate`);
});

test("AC-19.1.2 the links: design after intent, lld loops to design, change after lld, test and code-review loops, code-review after test, critique loops to change", () => {
  const wf = defaultWf();
  const p = Object.fromEntries(aaw(wf).map((s) => [s.id, s]));
  assert.deepEqual(p.intent.after, []);
  assert.deepEqual(p.design.after, ["intent"]);
  assert.deepEqual([p.lld.after, p.lld.loop.to], [["design"], "design"]);
  assert.deepEqual(p.change.after, ["lld"]);
  assert.deepEqual([p.test.after, p.test.loop.to], [["change"], "change"]);
  assert.deepEqual([p["code-review"].after, p["code-review"].loop.to], [["test"], "change"]);
  assert.deepEqual([p.docs.after, p.critique.after, p.critique.loop.to], [["change"], ["change"], "change"]);
  const h = Object.fromEntries(aawh(wf).map((s) => [s.id, s]));
  assert.deepEqual([h.intent.after, h.change.after, h.docs.after, h.critique.after, h.critique.loop.to], [[], ["intent"], ["change"], ["change"], "change"]);
  // Align (lld <-> change) is a clarify request, not a stage loop.
  assert.ok(wf.clarify.matrix["agent-manager"].some((row) => row.agent === "system-engineer"));
  assert.ok(wf.clarify.matrix["agent-manager"].some((row) => row.agent === "software-architect"));
});

for (const code of ["AAWH", "AAWP"]) {
  test(`AC-19.1.3 a software-engineer stage in ${code} fails and names the stage (G1)`, () => {
    const wf = defaultWf();
    wf.lifecycles[code].stages.push({ id: "build", agent: "software-engineer", after: ["change"] });
    const r = validate(wf);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, new RegExp(`error: lifecycles\\.${code}\\.stages\\[\\d+\\] \\(build\\): agent-artifact work never uses software-engineer \\(fixed guardrail\\)`));
  });

  test(`AC-19.1.4 ${code} with no agent-manager stage fails (G2)`, () => {
    const wf = defaultWf();
    const st = wf.lifecycles[code].stages;
    st.find((s) => s.id === "change").agent = "documentation-writer";
    const r = validate(wf);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, new RegExp(`error: lifecycles\\.${code}: needs an agent-manager stage: agent-artifact changes are always built by agent-manager \\(fixed guardrail\\)`));
  });

  test(`AC-19.3.3 ${code} without a brutal-critique stage fails (G4)`, () => {
    const wf = defaultWf();
    dropStage(wf.lifecycles[code].stages, "critique");
    const r = validate(wf);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, new RegExp(`error: lifecycles\\.${code}: needs a brutal-critique stage that loops back to the agent-manager stage`));
    assert.match(r.out, /run \/ai-dlc:workflow upgrade to bring in the default AAWH and AAWP stages/);
  });
}

test("AC-19.3.1 a variant starting with product-owner validates; starting with software-architect or agent-manager validates too", () => {
  assert.equal(validate(defaultWf()).code, 0);
  const wf = defaultWf();
  dropStage(aaw(wf), "intent"); // AAWP now starts with software-architect
  dropStage(aawh(wf), "intent"); // AAWH now starts with agent-manager
  const r = validate(wf);
  assert.equal(r.code, 0, r.out);
});

test("AC-19.3.2 the plugin variant without sqa-engineer or code-reviewer, or code-reviewer not after sqa-engineer, fails (G5)", () => {
  let wf = defaultWf(); dropStage(aaw(wf), "test", "change");
  let r = validate(wf);
  assert.match(r.out, /error: lifecycles\.AAWP: needs a sqa-engineer stage that loops back/);
  wf = defaultWf(); dropStage(aaw(wf), "code-review");
  r = validate(wf);
  assert.match(r.out, /error: lifecycles\.AAWP: needs a code-reviewer stage that loops back/);
  wf = defaultWf(); aaw(wf).find((s) => s.id === "code-review").after = ["change"];
  r = validate(wf);
  assert.match(r.out, /error: lifecycles\.AAWP\.stages\[\d+\] \(code-review\)\.after: must include the sqa-engineer stage \(test\)/);
});

test("AC-19.3.2 the harness variant needs no sqa-engineer or code-reviewer stage, and a spare one there is not held to the code phrase", () => {
  const wf = defaultWf();
  aawh(wf).push({ id: "extra-test", agent: "sqa-engineer", when: "whenever", after: ["change"] });
  const r = validate(wf);
  assert.equal(r.code, 0, r.out);
});

for (const [agent, label, mutate] of [
  ["software-architect", "no software-architect stage", (st) => dropStage(st, "design", "intent")],
  ["system-engineer", "no system-engineer stage", (st) => dropStage(st, "lld", "design")],
  ["software-architect", "the software-architect stage after agent-manager", (st) => { st.find((s) => s.id === "design").after = ["change"]; st.find((s) => s.id === "lld").after = ["intent"]; delete st.find((s) => s.id === "lld").loop; }],
]) {
  test(`AC-19.3.2 the plugin variant without a ${agent} stage the agent-manager stage follows fails (G5 design): ${label}`, () => {
    const wf = defaultWf();
    mutate(aaw(wf));
    const r = validate(wf);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, new RegExp(`error: lifecycles\\.AAWP: the plugin variant needs a ${agent} stage that the agent-manager stage follows through after: design is part of the plugin variant \\(fixed guardrail\\)`));
  });
}

test("AC-19.3.2 design reached through another stage counts (transitive after)", () => {
  const wf = defaultWf();
  // change after lld after design: the architect is reached through system-engineer, not directly.
  assert.deepEqual(aaw(wf).find((s) => s.id === "change").after, ["lld"]);
  assert.equal(validate(wf).code, 0);
});

test("AC-19.3.2 the harness variant needs no design stages", () => {
  const wf = defaultWf();
  assert.equal(aawh(wf).some((s) => ["software-architect", "system-engineer"].includes(s.agent)), false);
  assert.equal(validate(wf).code, 0);
});

test("AC-19.3.4 G7: disabling product-owner while a listed lifecycle has a product-owner stage fails and names the agent and the lifecycle; removing the stage clears that error", () => {
  const wf = defaultWf(); wf.agents.disabled = ["product-owner"];
  let r = validate(wf);
  assert.equal(r.code, 1, r.out);
  for (const code of ["AAWH", "AAWP"])
    assert.match(r.out, new RegExp(`error: lifecycles\\.${code}\\.stages\\[0\\] \\(intent\\)\\.agent: "product-owner" is disabled in agents\\.disabled`));
  dropStage(aawh(wf), "intent"); dropStage(aaw(wf), "intent");
  r = validate(wf);
  // product-owner still has other uses in the template (PDLC, Release, routing, clarify); none of them is AAWH or AAWP.
  assert.equal(errorLines(r).some((l) => /lifecycles\.AAW[HP]/.test(l)), false, r.out);
});

// G6: the shape of routing.byType["Agent Artifact"] and the variants of the lifecycles it names.
test("G6 a listed lifecycle without a variant fails", () => {
  const wf = defaultWf(); delete wf.lifecycles.AAWH.variant;
  const r = validate(wf);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /error: lifecycles\.AAWH\.variant: must be "harness" or "plugin" for a lifecycle named in routing\.byType\["Agent Artifact"\]/);
});

test("G6 a variant value other than harness or plugin fails, listed or not", () => {
  const wf = defaultWf(); wf.lifecycles.TLC.variant = "mod";
  const r = validate(wf);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /error: lifecycles\.TLC\.variant: variant must be "harness" or "plugin"/);
});

test("G6 a variant on a lifecycle that is not listed is allowed", () => {
  const wf = defaultWf(); wf.lifecycles.TLC.variant = "harness";
  assert.equal(validate(wf).code, 0);
});

test("G6 the list needs exactly one plugin variant (none, or two, fail)", () => {
  let wf = defaultWf(); wf.routing.byType["Agent Artifact"] = ["AAWH"];
  let r = validate(wf);
  assert.match(r.out, /error: routing\.byType\["Agent Artifact"\]: needs exactly one variant "plugin" lifecycle \(found 0\)/);
  wf = defaultWf(); wf.lifecycles.AAWP2 = JSON.parse(JSON.stringify(wf.lifecycles.AAWP)); wf.routing.byType["Agent Artifact"] = ["AAWH", "AAWP", "AAWP2"];
  r = validate(wf);
  assert.match(r.out, /needs exactly one variant "plugin" lifecycle \(found 2\)/);
});

test("G6 at most one harness variant; the plugin variant alone is valid (D2: every change set goes to it)", () => {
  let wf = defaultWf(); wf.lifecycles.AAWH2 = JSON.parse(JSON.stringify(wf.lifecycles.AAWH)); wf.routing.byType["Agent Artifact"] = ["AAWH", "AAWH2", "AAWP"];
  let r = validate(wf);
  assert.match(r.out, /error: routing\.byType\["Agent Artifact"\]: may name at most one variant "harness" lifecycle \(found 2\)/);
  wf = defaultWf(); wf.routing.byType["Agent Artifact"] = ["AAWP"]; wf.handoffReview.lifecycles = ["AAWP"];
  r = validate(wf);
  assert.equal(r.code, 0, r.out);
});

for (const [label, value, re] of [
  ["a string other than AAW", "AAWP", /routing\.byType\["Agent Artifact"\]: must be a list of lifecycle codes, for example \["AAWH", "AAWP"\]/],
  ["an empty list", [], /routing\.byType\["Agent Artifact"\]: must be a non-empty list of lifecycle codes/],
  ["a list with a non-string", ["AAWH", 5], /must be a non-empty list of lifecycle codes/],
  ["a list naming a lifecycle twice", ["AAWH", "AAWP", "AAWP"], /routing\.byType\["Agent Artifact"\]: "AAWP" is listed twice/],
]) {
  test(`G6 ${label} under "Agent Artifact" fails`, () => {
    const wf = defaultWf(); wf.routing.byType["Agent Artifact"] = value;
    const r = validate(wf);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, re);
  });
}

test("G6 only \"Agent Artifact\" may be a list: a list under another byType key fails", () => {
  const wf = defaultWf(); wf.routing.byType.Feature = ["AI-DLC", "FDLC"];
  const r = validate(wf);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /error: routing\.byType\.Feature: must be one lifecycle code \(only "Agent Artifact" may be a list\)/);
});

test("the guards apply by role to a custom lifecycle listed under the key", () => {
  const wf = defaultWf();
  wf.lifecycles.OURS = { ...JSON.parse(JSON.stringify(wf.lifecycles.AAWH)), kind: "custom" };
  wf.lifecycles.OURS.stages.push({ id: "build", agent: "software-engineer", after: ["change"] });
  wf.routing.byType["Agent Artifact"] = ["OURS", "AAWP"];
  const r = validate(wf);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /error: lifecycles\.OURS\.stages\[\d+\] \(build\): agent-artifact work never uses software-engineer/);
});

test("AC-19.8.1 a file with routing AAW fails with the upgrade message and names AAW", () => {
  const wf = defaultWf(); wf.routing.byType["Agent Artifact"] = "AAW";
  const r = validate(wf);
  assert.equal(r.code, 1, r.out);
  assert.ok(r.out.includes(`error: routing.byType["Agent Artifact"]: routing.byType["Agent Artifact"] is the single AAW lifecycle of an older plugin; run /ai-dlc:workflow upgrade to replace it with AAWH and AAWP`), r.out);
});

test("routing.agentArtifact: the template's folder lists; a wrong shape fails", () => {
  const wf = defaultWf();
  assert.deepEqual(wf.routing.agentArtifact.pluginPaths, ["plugins/**", "tools/**", "tests/**"]);
  assert.ok(wf.routing.agentArtifact.harnessPaths.includes(".claude/agents/**"));
  for (const [mutate, re] of [
    [(w) => { w.routing.agentArtifact = []; }, /error: routing\.agentArtifact: must be an object \{ harnessPaths, pluginPaths \}/],
    [(w) => { w.routing.agentArtifact.pluginPaths = "plugins/**"; }, /error: routing\.agentArtifact\.pluginPaths: must be an array of path globs/],
    [(w) => { w.routing.agentArtifact.harnessPaths.push("AGENTS.md"); }, /error: routing\.agentArtifact\.harnessPaths: "AGENTS\.md" is listed twice/],
    [(w) => { w.routing.agentArtifact.extra = []; }, /error: routing\.agentArtifact\.extra: unknown key/],
  ]) {
    const w = defaultWf(); mutate(w);
    const r = validate(w);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, re);
  }
});

// handoffReview (D5, ITEM-050)
test("handoffReview is required, and its keys are checked", () => {
  let wf = defaultWf(); delete wf.handoffReview;
  let r = validate(wf);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /error: \$: missing required key "handoffReview"/);
  for (const [mutate, re] of [
    [(w) => { w.handoffReview.lifecycles = ["NOPE"]; }, /error: handoffReview\.lifecycles: "NOPE" is not a defined lifecycle/],
    [(w) => { w.handoffReview.lifecycles = []; }, /error: handoffReview\.lifecycles: must be a non-empty array of lifecycle codes/],
    [(w) => { w.handoffReview.lifecycles = ["AAWH", "AAWH"]; }, /error: handoffReview\.lifecycles: "AAWH" is listed twice/],
    [(w) => { w.handoffReview.reviewer = "brutal-critique"; }, /error: handoffReview\.reviewer: unknown key/],
    [(w) => { w.handoffReview.maxFailures = 2; }, /error: handoffReview: maxFailures \(2\) must be below maxRounds \(2\)/],
    [(w) => { w.handoffReview.maxRounds = 0; }, /error: handoffReview\.maxRounds: must be a whole number >= 1/],
    [(w) => { w.handoffReview = "AAWH"; }, /error: handoffReview: must be an object/],
  ]) {
    wf = defaultWf(); mutate(wf);
    r = validate(wf);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, re);
  }
});

test("handoffReview limits omitted take the loop defaults 2 / 1", () => {
  const wf = defaultWf(); delete wf.handoffReview.maxRounds; delete wf.handoffReview.maxFailures;
  assert.equal(validate(wf).code, 0);
  assert.deepEqual(lim(byId(parseRounds(rounds(wf)))["handoff-review"]), [2, "default", 1, "default"]);
});

test("a null documents.critic does not affect handoffReview", () => {
  const wf = defaultWf(); wf.documents.critic = null;
  const r = rounds(wf);
  assert.deepEqual(lim(byId(parseRounds(r))["handoff-review"]), [2, "loop", 1, "loop"]);
});

test("AC-19.5.1 rounds --json has a handoff-review row 2/1, distinct from gate-critique", () => {
  const list = parseRounds(rounds(defaultWf()));
  const m = byId(list);
  const h = m["handoff-review"];
  assert.deepEqual([h.lifecycle, h.stage, h.agent, h.to], [null, null, null, null]);
  assert.deepEqual(lim(h), [2, "loop", 1, "loop"]);
  assert.deepEqual(lim(m["gate-critique"]), [2, "default", 1, "default"]);
  assert.equal(list.at(-1).id, "handoff-review");
  assert.equal(list.at(-2).id, "gate-critique");
});

test("AC-19.5.2 the handoff review variables change only its row (process environment)", () => {
  const before = byId(parseRounds(rounds(defaultWf())));
  const after_ = byId(parseRounds(rounds(defaultWf(), { AI_DLC_HANDOFF_REVIEW_MAX_ROUNDS: "4", AI_DLC_HANDOFF_REVIEW_MAX_FAILURES: "3" })));
  assert.deepEqual(lim(after_["handoff-review"]), [4, "env", 3, "env"]);
  for (const id of Object.keys(before)) if (id !== "handoff-review") assert.deepEqual(after_[id], before[id], id);
});

test("AC-19.5.2 the handoff review variables are read from settings env too, highest first", () => {
  const dir = project({ local: { env: { AI_DLC_HANDOFF_REVIEW_MAX_ROUNDS: "5" } }, shared: { env: { AI_DLC_HANDOFF_REVIEW_MAX_ROUNDS: "4", AI_DLC_HANDOFF_REVIEW_MAX_FAILURES: 2 } } });
  const r = roundsIn(dir, { AI_DLC_HANDOFF_REVIEW_MAX_ROUNDS: "3" });
  const m = byId(parseRounds(r));
  assert.deepEqual(lim(m["handoff-review"]), [5, "settings.local.json", 2, "settings.json"]);
  assert.deepEqual(lim(m["gate-critique"]), [2, "default", 1, "default"]);
  assert.equal(r.err, "");
});

test("AC-19.5.2 AI_DLC_CRITIQUE_* moves gate-critique and the critique loops, never handoff-review", () => {
  const m = byId(parseRounds(rounds(defaultWf(), { AI_DLC_CRITIQUE_MAX_ROUNDS: "6", AI_DLC_CRITIQUE_MAX_FAILURES: "4" })));
  assert.deepEqual(lim(m["gate-critique"]), [6, "env", 4, "env"]);
  assert.deepEqual(lim(m["AAWH/critique"]), [6, "env", 4, "env"]);
  assert.deepEqual(lim(m["handoff-review"]), [2, "loop", 1, "loop"]);
});

test("a handoff review pair that breaks maxFailures < maxRounds is warned about once and falls back to the file", () => {
  const r = rounds(defaultWf(), { AI_DLC_HANDOFF_REVIEW_MAX_FAILURES: "2" });
  assert.deepEqual(lim(byId(parseRounds(r))["handoff-review"]), [2, "loop", 1, "loop"]);
  assert.match(r.err, /^warning: AI_DLC_HANDOFF_REVIEW_MAX_FAILURES=2 \(env\) ignored on handoff-review: maxFailures must stay below maxRounds; using workflow\.json$/m);
  assert.equal((r.err.match(/AI_DLC_HANDOFF_REVIEW/g) ?? []).length, 1);
});

test("an invalid handoff review variable is warned about and the next level is used", () => {
  const r = rounds(defaultWf(), { AI_DLC_HANDOFF_REVIEW_MAX_ROUNDS: "007" });
  assert.deepEqual(lim(byId(parseRounds(r))["handoff-review"]), [2, "loop", 1, "loop"]);
  assert.match(r.err, invalidWarning("AI_DLC_HANDOFF_REVIEW_MAX_ROUNDS", 1));
});

test("show prints the handoff review limits in its summary line", () => {
  const r = cli(["show", "--file", write(defaultWf()), "--plugin", PLUGIN], { env: { AI_DLC_HANDOFF_REVIEW_MAX_ROUNDS: "3" } });
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /Gate critique: x2 f1 · Handoff review: x3 f1 · Review axes/);
  assert.match(r.out, /## AAWH . Agent Artifact Work, harness \(focused, harness variant\)/);
});
