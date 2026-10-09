#!/usr/bin/env node
// build-copilot.mjs — projects the Claude Code plugin (source of truth) into a
// GitHub Copilot CLI / VS Code plugin. Zero dependencies; Node 18+.
//
//   node tools/build-copilot.mjs           regenerate plugins/copilot/ai-dlc
//   node tools/build-copilot.mjs --check   exit 1 if the generated tree is stale (CI)
//
// Never hand-edit plugins/copilot/** — change plugins/claude/** and rebuild.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "plugins", "claude", "ai-dlc");
const OUT = path.join(ROOT, "plugins", "copilot", "ai-dlc");
const CHECK = process.argv.includes("--check");

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
    .replace(/\bai-dlc:(?=[a-z0-9-]+)/g, "")
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

files.set("GENERATED.md", `# Generated — do not edit\n\nThis Copilot plugin is generated from \`plugins/claude/ai-dlc\` by \`node tools/build-copilot.mjs\`.\nEdit the Claude plugin and rebuild.\n`);

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
  if (changed.length || stale.length) {
    console.error(`Copilot plugin is stale: ${changed.length} changed, ${stale.length} extra file(s). Run: node tools/build-copilot.mjs`);
    for (const r of [...changed, ...stale].slice(0, 20)) console.error(`  ${r}`);
    process.exit(1);
  }
  console.log("Copilot plugin is up to date.");
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
