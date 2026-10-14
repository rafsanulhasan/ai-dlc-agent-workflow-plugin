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
const aaw = (wf) => wf.lifecycles.AAW.stages;

function write(wf, name = `wf-${++n}.json`) {
  const f = path.join(tmp, name);
  fs.writeFileSync(f, typeof wf === "string" ? wf : JSON.stringify(wf, null, 2));
  return f;
}
function cli(args, opts = {}) {
  const r = spawnSync(process.execPath, [CLI, "--root", opts.root ?? root, ...args], { encoding: "utf8", cwd: tmp });
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
    assert.match(r.out, new RegExp(`error: lifecycles\\.AAW: needs a ${agent} stage that loops back to the agent-manager stage`));
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
  assert.match(r.out, /loop\.to: "ghost" is not a stage of AAW/);
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
  aaw(wf)[0].id = "make-change";
  for (const s of aaw(wf)) {
    if (s.after?.includes("change")) s.after = s.after.map((a) => (a === "change" ? "make-change" : a));
    if (s.loop?.to === "change") s.loop.to = "make-change";
  }
  const r = validate(wf);
  assert.equal(r.code, 0, r.out);
});

test("every AAW starting stage must be agent-manager", () => {
  const wf = defaultWf();
  aaw(wf).find((s) => s.id === "test").after = [];
  const r = validate(wf);
  assert.equal(r.code, 1);
  assert.match(r.out, /every starting stage must be agent-manager/);
});

test("routing.byType['Agent Artifact'] missing -> error naming upgrade", () => {
  const wf = defaultWf(); delete wf.routing.byType["Agent Artifact"];
  const r = validate(wf);
  assert.equal(r.code, 1);
  assert.match(r.out, /routing\.byType\["Agent Artifact"\]: missing/);
  assert.match(r.out, /\/ai-dlc:workflow upgrade/);
});

test("routing.byType['Agent Artifact'] naming an undefined lifecycle -> error", () => {
  const wf = defaultWf(); wf.routing.byType["Agent Artifact"] = "NOPE";
  const r = validate(wf);
  assert.equal(r.code, 1);
  assert.match(r.out, /lifecycle "NOPE" is not defined/);
});

test("routing.byType['Agent Artifact'] naming a segments lifecycle -> error", () => {
  const wf = defaultWf(); wf.routing.byType["Agent Artifact"] = "AI-DLC";
  const r = validate(wf);
  assert.equal(r.code, 1);
  assert.match(r.out, /must be a lifecycle with stages, not segments/);
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

test("loop.maxRounds must be a positive integer (0 and 1.5 rejected, 1 accepted)", () => {
  for (const [v, ok] of [[0, false], [1.5, false], [1, true]]) {
    // all three AAW review loops get the same value, since they share one budget
    const wf = defaultWf(); for (const s of aaw(wf)) if (s.loop) s.loop.maxRounds = v;
    const r = validate(wf);
    assert.equal(r.code, ok ? 0 : 1, `maxRounds=${v}: ${r.out}`);
    if (!ok) assert.match(r.out, /maxRounds: must be a positive integer/);
  }
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
  const r = cli(["show", "AAW", "--file", write(defaultWf()), "--plugin", PLUGIN]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /## AAW . Agent Artifact Work/);
  for (const [id, agent] of [["change", "agent-manager"], ["critique", "brutal-critique"], ["test", "sqa-engineer"], ["code-review", "code-reviewer"]])
    assert.match(r.out, new RegExp(`\\| ${id}\\s+\\| ${agent}\\s+\\|`), `${id}/${agent}`);
  assert.equal((r.out.match(/-> change x3/g) ?? []).length, 3);
  assert.match(r.out, /\| code-review\s+\| code-reviewer\s+\| test\s+\|/);
  assert.match(r.out, /\| test\s+\| sqa-engineer\s+\| change\s+\|/);
});

test("show AAW --mermaid draws the three loop-back edges to change", () => {
  const r = cli(["show", "AAW", "--mermaid", "--file", write(defaultWf()), "--plugin", PLUGIN]);
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
  const r = cli(["show", "AAW", "--file", write(wf), "--plugin", PLUGIN]);
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
  assert.match(r.out, /\+ only in other:\s+lifecycles\.AAW\.stages\.code-review/);
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

// ---- AAW: shared round budget (references/aaw-review.md, "Rounds") --------------
const REVIEW_IDS = ["critique", "test", "code-review"];
for (const id of REVIEW_IDS) {
  test(`AAW ${id} loop without maxRounds fails: the review loops share one budget`, () => {
    const wf = defaultWf(); delete aaw(wf).find((s) => s.id === id).loop.maxRounds;
    const r = validate(wf);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, new RegExp(`error: lifecycles\\.AAW\\.stages\\[\\d\\] \\(${id}\\)\\.loop\\.maxRounds: required on an AAW review loop`));
  });
}

test("AAW review loops with different maxRounds fail and list each value", () => {
  const wf = defaultWf(); aaw(wf).find((s) => s.id === "test").loop.maxRounds = 2;
  const r = validate(wf);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /error: lifecycles\.AAW: the review loops share one round budget, so their maxRounds must be equal \(critique 3, test 2, code-review 3\)/);
});

test("AAW review loops with an equal non-default budget (5) are valid", () => {
  const wf = defaultWf(); for (const id of REVIEW_IDS) aaw(wf).find((s) => s.id === id).loop.maxRounds = 5;
  const r = validate(wf);
  assert.equal(r.code, 0, r.out);
});

test("maxRounds on a non-AAW loop is not part of the shared budget", () => {
  const wf = defaultWf();
  const lc = Object.entries(wf.lifecycles).find(([code, l]) => code !== "AAW" && Array.isArray(l.stages) && l.stages.some((s) => s.loop));
  assert.ok(lc, "the default workflow has a non-AAW loop");
  lc[1].stages.find((s) => s.loop).loop.maxRounds = 7;
  const r = validate(wf);
  assert.equal(r.code, 0, r.out);
});

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

// budget boundaries
test("maxRounds 1 on all three AAW review loops is valid", () => {
  const wf = defaultWf(); for (const id of REVIEW_IDS) aaw(wf).find((s) => s.id === id).loop.maxRounds = 1;
  assert.equal(validate(wf).code, 0);
});

test("maxRounds 0, 2.5 or a string on an AAW review loop is rejected (and named as required)", () => {
  for (const v of [0, 2.5, "3"]) {
    const wf = defaultWf(); aaw(wf).find((s) => s.id === "test").loop.maxRounds = v;
    const r = validate(wf);
    assert.equal(r.code, 1, `${v}: ${r.out}`);
    assert.match(r.out, /\(test\)\.loop\.maxRounds: required on an AAW review loop/);
  }
});

test("all three maxRounds missing gives three 'required' errors and no 'must be equal' error", () => {
  const wf = defaultWf(); for (const id of REVIEW_IDS) delete aaw(wf).find((s) => s.id === id).loop.maxRounds;
  const r = validate(wf);
  assert.equal((r.out.match(/required on an AAW review loop/g) ?? []).length, 3, r.out);
  assert.doesNotMatch(r.out, /must be equal/);
});

test("one missing and the other two different still reports both problems", () => {
  const wf = defaultWf();
  delete aaw(wf).find((s) => s.id === "critique").loop.maxRounds;
  aaw(wf).find((s) => s.id === "test").loop.maxRounds = 2;
  const r = validate(wf);
  assert.match(r.out, /\(critique\)\.loop\.maxRounds: required/);
  assert.match(r.out, /must be equal \(test 2, code-review 3\)/);
});

test("a review stage that does not loop back to agent-manager is not also asked for maxRounds", () => {
  const wf = defaultWf(); const s = aaw(wf).find((x) => x.id === "test"); s.loop.to = "critique"; delete s.loop.maxRounds;
  const r = validate(wf);
  assert.match(r.out, /needs a sqa-engineer stage that loops back/);
  assert.doesNotMatch(r.out, /\(test\)\.loop\.maxRounds: required/);
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
  assert.match(r.out, /lifecycles\.AAW\.stages\[\d\] \(critique\)\.when: must be "the change set contains docs"/);
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
  const r = cli(["show", "AAW", "--file", write(wf), "--plugin", PLUGIN]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /The Change Set Contains CODE/);
});
