#!/usr/bin/env node
// build-copilot.mjs — projects the Claude Code plugin (source of truth) into a
// GitHub Copilot CLI / VS Code plugin. Zero dependencies; Node 18+.
//
//   node tools/build-copilot.mjs                    regenerate plugins/copilot/<plugin>
//   node tools/build-copilot.mjs --check            exit 1 if anything generated is stale (CI)
//   node tools/build-copilot.mjs --plugin <name>    pick the plugin when plugins/claude/ holds several
//
// Never hand-edit plugins/copilot/** — change plugins/claude/** and rebuild.
//
// Optional generated sources, written into the Claude plugin so both plugins ship them:
// - if tools/templates/AGENTS.template.md exists: skills/init/templates/AGENTS.md, the
//   template with the orchestrator persona (agents/orchestrator.md) at its marker;
// - if skills/plugin-management/ exists: skills/plugin-management/templates/build-copilot.mjs,
//   a copy of this script for new plugins.
// Never hand-edit generated files either.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
const pluginArg = process.argv.indexOf("--plugin");
const claudePlugins = fs.readdirSync(path.join(ROOT, "plugins", "claude"), { withFileTypes: true })
  .filter((e) => e.isDirectory()).map((e) => e.name);
const PLUGIN = pluginArg > -1 ? process.argv[pluginArg + 1]
  : claudePlugins.length === 1 ? claudePlugins[0] : null;
if (!PLUGIN || !claudePlugins.includes(PLUGIN)) {
  throw new Error(`Pick a plugin with --plugin <name> (found: ${claudePlugins.join(", ") || "none"})`);
}
const SRC = path.join(ROOT, "plugins", "claude", PLUGIN);
const OUT = path.join(ROOT, "plugins", "copilot", PLUGIN);
// `<plugin>:` prefix on agent and skill references; Copilot ids have no namespace.
const NAMESPACE = new RegExp(`\\b${PLUGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:(?=[a-z0-9-]+)`, "g");

// ---- tool translation -------------------------------------------------------
const ALIAS = {
  Read: "read", NotebookRead: "read",
  Write: "edit", Edit: "edit", MultiEdit: "edit", NotebookEdit: "edit",
  Glob: "search", Grep: "search",
  Bash: "execute", PowerShell: "execute",
  TodoWrite: "todo",
  Agent: "agent", Task: "agent",
  WebFetch: "web", WebSearch: "web",
};
const ALL_ALIASES = ["read", "edit", "search", "execute", "agent", "web", "todo"];
// Claude-only tools with no Copilot equivalent are dropped silently.
const DROP = /^(PushNotification|ToolSearch|Task(Create|Get|List|Update|Stop|Output)|Cron(Create|Delete|List)|Monitor|EnterPlanMode|ExitPlanMode|EnterWorktree|ExitWorktree|RemoteTrigger|ScheduleWakeup|Skill|SendMessage|AskUserQuestion|mcp__ide__.*)$/;

const EVENT = {
  Stop: "agentStop", SubagentStop: "subagentStop", PreToolUse: "preToolUse",
  PostToolUse: "postToolUse", SessionStart: "sessionStart", SessionEnd: "sessionEnd",
  UserPromptSubmit: "userPromptSubmitted", PreCompact: "preCompact", Notification: "notification",
};

const PLATFORM_NOTE = `> **Platform note (GitHub Copilot).** This agent was generated from the Claude Code definition of the AI-DLC team. Read \`Skill("name", args)\` as "load and follow the \`name\` skill", \`Agent("name", prompt)\` as "delegate to the \`name\` custom agent with the agent tool", and \`TodoWrite\` as the \`todo\` tool. Agent memory lives in \`.claude/agent-memory/<agent>/\` on both platforms.\n\n`;

// ---- helpers ----------------------------------------------------------------
const files = new Map(); // relative path -> string | Buffer
const warn = (m) => console.warn(`warn: ${m}`);

function splitFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  return m ? { fm: m[1], body: m[2] } : { fm: "", body: text };
}

// Minimal YAML reader for single-line `key: value` frontmatter (all our files use it).
function parseFm(fm) {
  const out = {};
  for (const line of fm.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const list = (v) => (v ?? "").replace(/^\[|\]$/g, "").split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);

function stripNamespace(text) {
  return text
    .replace(NAMESPACE, "")
    .replaceAll("${CLAUDE_SKILL_DIR}/", "")
    .replaceAll("${CLAUDE_PLUGIN_ROOT}", "${PLUGIN_ROOT}");
}

function translateTools(fmObj, name) {
  if (fmObj.tools) {
    const aliases = new Set();
    for (const t of list(fmObj.tools)) {
      if (ALIAS[t]) aliases.add(ALIAS[t]);
      else if (t.startsWith("mcp__")) aliases.add(t);
      else if (!DROP.test(t)) warn(`${name}: no Copilot alias for tool "${t}" — dropped (add it to ALIAS or DROP)`);
    }
    return [...aliases];
  }
  if (fmObj.disallowedTools) {
    const denied = new Set(list(fmObj.disallowedTools).map((t) => ALIAS[t]).filter(Boolean));
    return ALL_ALIASES.filter((a) => !denied.has(a));
  }
  return null; // inherit every tool
}

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "__pycache__" || e.name.endsWith(".pyc")) continue; // local run artefacts, never shipped
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// ---- manifest ---------------------------------------------------------------
const claudeManifest = JSON.parse(fs.readFileSync(path.join(SRC, ".claude-plugin", "plugin.json"), "utf8"));
const manifest = {
  name: claudeManifest.name,
  description: claudeManifest.description,
  version: claudeManifest.version,
  author: claudeManifest.author,
  homepage: claudeManifest.homepage,
  repository: claudeManifest.repository,
  keywords: claudeManifest.keywords,
  agents: "agents/",
  skills: "skills/",
  hooks: "hooks.json",
};
// plugin.json is emitted after the hooks section, which drops `hooks` when the plugin ships none.

// ---- agents -----------------------------------------------------------------
for (const f of fs.readdirSync(path.join(SRC, "agents")).filter((f) => f.endsWith(".md")).sort()) {
  const { fm, body } = splitFrontmatter(fs.readFileSync(path.join(SRC, "agents", f), "utf8"));
  const o = parseFm(fm);
  const name = (o.name || f.replace(/\.md$/, "")).replace(/^["']|["']$/g, "");
  if (o.status === "deprecated") { warn(`${name}: deprecated — skipped`); continue; }
  const tools = translateTools(o, name);
  let out = `---\nname: ${name}\ndescription: ${stripNamespace(o.description ?? `"${name}"`)}\n`;
  if (tools) out += `tools: [${tools.map((t) => JSON.stringify(t)).join(", ")}]\n`;
  out += `---\n\n${PLATFORM_NOTE}${stripNamespace(body).replace(/^\s+/, "")}`;
  files.set(`agents/${name}.agent.md`, out);
}

// ---- generated AGENTS.md template (orchestrator persona for target projects) -----
// Written into the Claude plugin source so both plugins ship it; --check reports drift.
const AGENTS_TEMPLATE = path.join(ROOT, "tools", "templates", "AGENTS.template.md");
const AGENTS_OUT = path.join(SRC, "skills", "init", "templates", "AGENTS.md");
const PERSONA_MARKER = "<!-- ai-dlc:orchestrator-persona -->";
const sourceStale = [];
function writeGenerated(file, content) {
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n") : null;
  if (current === content) return;
  if (CHECK) sourceStale.push(path.relative(ROOT, file).split(path.sep).join("/"));
  else { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); }
}
if (fs.existsSync(AGENTS_TEMPLATE)) {
  const template = fs.readFileSync(AGENTS_TEMPLATE, "utf8").replace(/\r\n/g, "\n");
  if (!template.includes(PERSONA_MARKER)) throw new Error(`${path.relative(ROOT, AGENTS_TEMPLATE)} is missing ${PERSONA_MARKER}`);
  const { body } = splitFrontmatter(fs.readFileSync(path.join(SRC, "agents", "orchestrator.md"), "utf8").replace(/\r\n/g, "\n"));
  // Demote the persona's headings one level so it nests under the AGENTS.md title; fenced code is left alone.
  let fenced = false;
  const persona = body.trim().split("\n").map((line) => {
    if (/^\s*```/.test(line)) fenced = !fenced;
    return !fenced && /^#{1,5} /.test(line) ? `#${line}` : line;
  }).join("\n");
  writeGenerated(AGENTS_OUT, template.replace(PERSONA_MARKER, persona));
}

// ---- generated build-script template (shipped by the plugin-management skill) -----
const PLUGIN_MGMT = path.join(SRC, "skills", "plugin-management");
if (fs.existsSync(PLUGIN_MGMT)) {
  const self = fs.readFileSync(fileURLToPath(import.meta.url), "utf8").replace(/\r\n/g, "\n");
  writeGenerated(path.join(PLUGIN_MGMT, "templates", "build-copilot.mjs"), self);
}

// ---- project mirrors: plugin skills also kept as repo-local .claude/skills/<name> ----
// Listed in tools/project-skills.json; the plugin copy is the source, the mirror is generated.
const MIRRORS = path.join(ROOT, "tools", "project-skills.json");
if (fs.existsSync(MIRRORS)) {
  for (const name of JSON.parse(fs.readFileSync(MIRRORS, "utf8"))) {
    const from = path.join(SRC, "skills", name);
    const to = path.join(ROOT, ".claude", "skills", name);
    if (!fs.existsSync(from)) throw new Error(`tools/project-skills.json: no plugin skill "${name}"`);
    const wanted = new Set();
    for (const p of walk(from)) {
      const rel = path.relative(from, p);
      wanted.add(rel);
      writeGenerated(path.join(to, rel), fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n"));
    }
    for (const p of fs.existsSync(to) ? walk(to) : []) {
      if (wanted.has(path.relative(to, p))) continue;
      if (CHECK) sourceStale.push(path.relative(ROOT, p).split(path.sep).join("/"));
      else fs.rmSync(p);
    }
  }
}

// ---- skills (copied, namespace stripped in markdown) ----------------------------
for (const p of walk(path.join(SRC, "skills"))) {
  const rel = path.relative(SRC, p).split(path.sep).join("/");
  files.set(rel, p.endsWith(".md") ? stripNamespace(fs.readFileSync(p, "utf8")) : fs.readFileSync(p));
}

// ---- scripts (copied verbatim) ------------------------------------------------
if (fs.existsSync(path.join(SRC, "scripts"))) {
  for (const p of walk(path.join(SRC, "scripts"))) {
    files.set(path.relative(SRC, p).split(path.sep).join("/"), fs.readFileSync(p));
  }
}

// ---- hooks (optional — project hooks such as the .NET test gate are installed by skills) ----
const hooksFile = path.join(SRC, "hooks", "hooks.json");
const claudeHooks = fs.existsSync(hooksFile) ? JSON.parse(fs.readFileSync(hooksFile, "utf8")).hooks ?? {} : {};
const copilotHooks = {};
for (const [event, groups] of Object.entries(claudeHooks)) {
  const target = EVENT[event];
  if (!target) { warn(`hook event ${event} has no Copilot equivalent — skipped`); continue; }
  for (const g of groups) {
    for (const h of g.hooks ?? []) {
      if (h.type && h.type !== "command") { warn(`${event}: hook type ${h.type} not supported on Copilot — skipped`); continue; }
      const cmd = stripNamespace(h.command);
      const entry = { type: "command", bash: cmd, powershell: cmd, timeoutSec: h.timeout ?? 30 };
      if (g.matcher) entry.matcher = g.matcher;
      (copilotHooks[target] ??= []).push(entry);
    }
  }
}
if (Object.keys(copilotHooks).length) files.set("hooks.json", JSON.stringify({ version: 1, hooks: copilotHooks }, null, 2) + "\n");
else delete manifest.hooks;
files.set("plugin.json", JSON.stringify(manifest, null, 2) + "\n");

files.set("GENERATED.md", `# Generated — do not edit\n\nThis Copilot plugin is generated from \`plugins/claude/${PLUGIN}\` by \`node tools/build-copilot.mjs\`.\nEdit the Claude plugin and rebuild.\n`);

// ---- emit or check ------------------------------------------------------------
const existing = fs.existsSync(OUT) ? walk(OUT).map((p) => path.relative(OUT, p).split(path.sep).join("/")) : [];
const stale = existing.filter((r) => !files.has(r));
const changed = [...files].filter(([rel, content]) => {
  const p = path.join(OUT, rel);
  if (!fs.existsSync(p)) return true;
  const cur = fs.readFileSync(p);
  return !cur.equals(Buffer.isBuffer(content) ? content : Buffer.from(content));
}).map(([rel]) => rel);

if (CHECK) {
  if (sourceStale.length) {
    console.error(`Generated source is stale. Run: node tools/build-copilot.mjs`);
    for (const r of sourceStale) console.error(`  ${r}`);
  }
  if (changed.length || stale.length) {
    console.error(`Copilot plugin is stale: ${changed.length} changed, ${stale.length} extra file(s). Run: node tools/build-copilot.mjs`);
    for (const r of [...changed, ...stale].slice(0, 20)) console.error(`  ${r}`);
  }
  if (sourceStale.length || changed.length || stale.length) process.exit(1);
  console.log("Copilot plugin and generated sources are up to date.");
  process.exit(0);
}

for (const rel of changed) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, files.get(rel));
}
for (const rel of stale) {
  try { fs.rmSync(path.join(OUT, rel)); } catch (e) { warn(`could not remove stale ${rel}: ${e.code}`); }
}
const agents = [...files.keys()].filter((k) => k.startsWith("agents/")).length;
const skills = [...files.keys()].filter((k) => /^skills\/[^/]+\/SKILL\.md$/.test(k)).length;
console.log(`Copilot plugin written to ${path.relative(ROOT, OUT)}: ${agents} agents, ${skills} skills, ${Object.keys(copilotHooks).length} hook event(s); ${changed.length} file(s) updated, ${stale.length} removed.`);
