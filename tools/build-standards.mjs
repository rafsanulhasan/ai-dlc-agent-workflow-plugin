#!/usr/bin/env node
// build-standards.mjs — writes this repository's rule twins from its standards. Zero dependencies; Node 18+.
// Local to this repository (the plugin repository); not shipped in the plugin.
//
//   node tools/build-standards.mjs            write every missing or stale rule twin
//   node tools/build-standards.mjs --check    report only; exit 1 when a twin is missing, stale or refused
//   node tools/build-standards.mjs --force    also overwrite twins that were edited by hand
//   node tools/build-standards.mjs --root <dir>   the repository root (default: git root, else the cwd)
//
// The source is one file per standard, .forgeline/memory-bank/project/standards/<n>.md:
//
//   ---
//   name: <n>                        optional; must equal the file name when given
//   description: <one line>          required; both hosts' `description`
//   paths:                           optional list; none = always on (Claude: no paths, Copilot: applyTo "**")
//     - "src/**/*.ts"
//   template: <folder>               optional; a plugin template folder the twins must equal (see below)
//   ---
//   Any other key, or a key given twice, makes the standard invalid (so a typo such as `path:` cannot
//   turn a scoped rule into an always-on one). A glob may not contain a comma: Copilot's `applyTo` is one
//   comma-separated string, so write `**/*.ts` and `**/*.tsx` rather than `**/*.{ts,tsx}`.
//
//   <the rule body, word for word>
//
// From it the script writes two twins with the same body, byte for byte:
//   .claude/rules/<n>.md                    front matter: description, paths
//   .github/instructions/<n>.instructions.md  front matter: description, applyTo
// The first front-matter line of each twin is a YAML comment, the marker: it names the standard and
// holds the sha256 (12 hex digits) of the twin without that line. The body stays identical on both
// sides, so .claude/scripts/sync-harness.mjs (which compares description, scope and body, and keeps
// front-matter lines it does not sync) sees the twins in sync.
//
// Nothing is lost:
//   - a twin whose content no longer matches the hash in its marker was edited by hand: it is refused
//     (reported, exit 1, left unchanged) until the edit is moved into the standard or --force is given;
//   - a twin with no marker is adopted only when its body already equals the standard's (only its front
//     matter changes); a different body is refused the same way;
//   - a twin with a marker whose standard is gone is reported as an orphan (exit 1), never deleted.
// Rules with no marker and no standard are left alone and listed as a note.
//
// Plugin templates: a standard with `template: <folder>` is also installed into other repositories by a
// plugin skill from <folder>/rules/<n>.md and <folder>/instructions/<n>.instructions.md (docs-status:
// plugins/claude/ai-dlc/skills/docs-rules/templates). Each twin, without its marker line, must equal its
// template byte for byte; when it would not, the standard is refused (exit 1) and nothing is written for
// it, so the repository copy never drifts from the plugin's. Change the template and the standard together.
//
// Exit codes: 0 every twin current (after writing, without --check); 1 something is missing or stale
// (--check), refused, an orphan, or off its template; 2 a usage error or an invalid standard.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const STANDARDS_DIR = ".forgeline/memory-bank/project/standards";
export const RULES_DIR = ".claude/rules";
export const INSTRUCTIONS_DIR = ".github/instructions";
const TOOL = "tools/build-standards.mjs";
const MARKER = /^# Generated from (\S+) by tools\/build-standards\.mjs \(sha256 ([0-9a-f]{12}) of this file without this line\)\./;

const KEYS = ["name", "description", "paths", "template"];
const lf = (s) => s.replace(/\r\n/g, "\n");
const hash = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);
const unquote = (s) => {
  s = s.trim();
  if (s.startsWith('"') && s.endsWith('"') && s.length > 1) return JSON.parse(s);
  if (s.startsWith("'") && s.endsWith("'") && s.length > 1) return s.slice(1, -1).replace(/''/g, "'");
  return s;
};

/** Splits a flow list's inside on the commas that are outside quotes and braces. */
export function splitFlow(inner) {
  const out = [];
  let cur = "", quote = null, depth = 0;
  for (const ch of inner) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === "{") depth++;
    if (ch === "}" && depth > 0) depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map(unquote).filter(Boolean);
}

/** Splits `---` front matter from the body; null when the text has none. */
export function splitDoc(text) {
  const m = lf(text).match(/^---\n([\s\S]*?)\n?---[ \t]*(?:\n|$)([\s\S]*)$/);
  return m ? { fm: m[1], body: m[2] } : null;
}

/** The front matter of a standard: a small YAML subset (scalars, flow or block lists, `#` comments). */
export function parseStandard(text, name) {
  const doc = splitDoc(text);
  if (!doc) throw new Error("no front matter (--- ... ---)");
  const o = {};
  let list = null;
  for (const line of doc.fm.split("\n")) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item) {
      if (!list) throw new Error(`list item outside a list: "${line.trim()}"`);
      list.push(unquote(item[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z_][\w-]*):(?:\s+(.*))?$/);
    if (!kv) throw new Error(`cannot read front-matter line "${line}"`);
    const [, key, raw = ""] = kv;
    if (!KEYS.includes(key)) throw new Error(`unknown front-matter key "${key}" (allowed: ${KEYS.join(", ")})`);
    if (key in o) throw new Error(`front-matter key "${key}" appears twice`);
    list = null;
    if (raw === "") { o[key] = list = []; continue; }
    o[key] = raw.trim().startsWith("[") ? splitFlow(raw.trim().replace(/^\[|\]$/g, "")) : unquote(raw);
  }
  if (typeof o.description !== "string" || !o.description.trim()) throw new Error("description is missing or empty");
  if (o.name !== undefined && o.name !== name) throw new Error(`name "${o.name}" does not match the file name "${name}"`);
  const paths = o.paths === undefined ? [] : o.paths;
  if (!Array.isArray(paths) || paths.some((p) => typeof p !== "string" || !p)) throw new Error("paths must be a list of globs");
  const comma = paths.find((p) => p.includes(","));
  if (comma) throw new Error(`glob "${comma}" contains a comma, which Copilot's comma-separated applyTo cannot hold; write one glob per pattern (for example "**/*.ts" and "**/*.tsx" for "**/*.{ts,tsx}")`);
  if (o.template !== undefined && (typeof o.template !== "string" || !o.template)) throw new Error("template must be a folder path");
  const body = doc.body.replace(/^\n+/, "");
  if (!body.trim()) throw new Error("the body is empty");
  return { name, description: o.description, paths, template: o.template, body };
}

// A YAML plain scalar when it is safe to write one, else a JSON (double-quoted YAML) string.
const plain = (s) => (/^[^\s\-?:,[\]{}#&*!|>'"%@`]/.test(s) && !/: |\s#|\s$/.test(s) && !/^(true|false|yes|no|on|off|null|~|[-+]?(\d[\d_]*)?\.?\d[\d_.eE+-]*)$/i.test(s) ? s : JSON.stringify(s));

/** The two twins of a standard, each without its marker line: { rule, instruction }. */
export function render(std) {
  const head = (lines) => `---\n${lines.join("\n")}\n---\n\n${std.body}`;
  const rule = head([`description: ${plain(std.description)}`, ...(std.paths.length ? ["paths:", ...std.paths.map((p) => `  - ${JSON.stringify(p)}`)] : [])]);
  const instruction = head([`description: ${JSON.stringify(std.description)}`, `applyTo: ${JSON.stringify(std.paths.length ? std.paths.join(",") : "**")}`]);
  return { rule, instruction };
}

/** Adds the marker as the first front-matter line. */
export const withMarker = (content, source) =>
  content.replace(/^---\n/, `---\n# Generated from ${source} by ${TOOL} (sha256 ${hash(content)} of this file without this line). Do not edit: change the standard, then run node ${TOOL}.\n`);

/** Removes the marker line, if any: { content, source, recorded } (source and recorded null without one). */
export function stripMarker(text) {
  text = lf(text);
  const lines = text.split("\n");
  if (lines[0] !== "---" || !MARKER.test(lines[1] ?? "")) return { content: text, source: null, recorded: null };
  const [, source, recorded] = lines[1].match(MARKER);
  return { content: [lines[0], ...lines.slice(2)].join("\n"), source, recorded };
}

const trimmed = (s) => s.replace(/^\s+/, "").replace(/\s+$/, "");

/**
 * Builds every twin under `root`. Returns { lines, code } and writes nothing when `check` is set.
 * `force` overwrites hand-edited twins.
 */
export function build(root, { check = false, force = false } = {}) {
  const out = [];
  let code = 0;
  const problem = (line) => { out.push(line); code = Math.max(code, 1); };
  const rel = (p) => path.relative(root, p).split(path.sep).join("/");
  const dir = path.join(root, STANDARDS_DIR);
  // No standards folder: nothing to build, but generated twins left behind are still reported as orphans.
  const names = !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md") && !e.name.startsWith(".") && !/^README\.md$/i.test(e.name))
    .map((e) => e.name.slice(0, -3)).sort();
  const sources = new Set();
  let current = 0;

  for (const name of names) {
    const stdPath = path.join(dir, `${name}.md`);
    const source = rel(stdPath);
    sources.add(source);
    let std;
    try { std = parseStandard(fs.readFileSync(stdPath, "utf8"), name); } catch (e) {
      out.push(`invalid ${source}: ${e.message}`);
      code = 2;
      continue;
    }
    const twins = render(std);
    const targets = [
      { kind: "rule", file: path.join(root, RULES_DIR, `${name}.md`), content: twins.rule },
      { kind: "instruction", file: path.join(root, INSTRUCTIONS_DIR, `${name}.instructions.md`), content: twins.instruction },
    ];
    if (std.template) {
      const tpl = { rule: path.join(root, std.template, "rules", `${name}.md`), instruction: path.join(root, std.template, "instructions", `${name}.instructions.md`) };
      const off = targets.filter((t) => !fs.existsSync(tpl[t.kind]) || lf(fs.readFileSync(tpl[t.kind], "utf8")) !== t.content);
      if (off.length) {
        for (const t of off) problem(`off-template ${source}: its ${t.kind} would differ from ${rel(tpl[t.kind])}${fs.existsSync(tpl[t.kind]) ? "" : " (missing)"}; change the template and the standard together; nothing written`);
        continue;
      }
    }
    for (const t of targets) {
      const want = withMarker(t.content, source);
      const target = rel(t.file);
      const have = fs.existsSync(t.file) ? lf(fs.readFileSync(t.file, "utf8")) : null;
      if (have === want) { current++; continue; }
      let verb = have === null ? "create" : "update";
      if (have !== null && !force) {
        const m = stripMarker(have);
        const handEdited = m.recorded !== null ? hash(m.content) !== m.recorded : !sameBody(m.content, t.content);
        if (handEdited) {
          problem(`refuse ${target}: edited by hand (${m.recorded !== null ? "it no longer matches its marker" : "no marker, and its body differs from the standard"}); move the edit into ${source}, or run with --force to overwrite it`);
          continue;
        }
      }
      if (check) { problem(`stale ${target}: would ${verb} from ${source}`); continue; }
      fs.mkdirSync(path.dirname(t.file), { recursive: true });
      const tmp = `${t.file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, want);
      fs.renameSync(tmp, t.file);
      out.push(`${verb} ${target} from ${source}`);
    }
  }

  // Generated twins whose standard is gone, and rules that come from no standard.
  for (const [d, ext] of [[RULES_DIR, ".md"], [INSTRUCTIONS_DIR, ".instructions.md"]]) {
    for (const f of walk(path.join(root, d)).filter((f) => f.endsWith(ext))) {
      const m = stripMarker(fs.readFileSync(f, "utf8"));
      if (m.source !== null && !sources.has(m.source)) problem(`orphan ${rel(f)}: generated from ${m.source}, which no longer exists; deprecate it through agent-manager (never deleted here)`);
      else if (m.source === null && !names.includes(path.basename(f).slice(0, -ext.length))) out.push(`note ${rel(f)}: no standard in ${STANDARDS_DIR}; left as it is`);
    }
  }
  out.push(`${current} twin(s) current, ${names.length} standard(s)`);
  return { lines: out, code };
}

function sameBody(a, b) {
  const da = splitDoc(a), db = splitDoc(b);
  return trimmed(da ? da.body : a) === trimmed(db ? db.body : b);
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => !e.name.startsWith("."))
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

function main(argv) {
  const known = new Set(["--check", "--force", "--root", "--help", "-h"]);
  if (argv.includes("--help") || argv.includes("-h")) {
    const head = fs.readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1);
    // The title, then the usage block: everything before the second bare "//" line.
    const bare = head.map((l, i) => (l.trim() === "//" ? i : -1)).filter((i) => i > -1);
    const end = bare.length > 1 ? bare[1] : -1;
    console.log(head.slice(0, end < 0 ? head.length : end).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
    return 0;
  }
  const i = argv.indexOf("--root");
  if (i > -1 && (!argv[i + 1] || argv[i + 1].startsWith("--"))) { console.error("error: --root needs a folder"); return 2; }
  const bad = argv.filter((a, j) => !known.has(a) && !(i > -1 && j === i + 1));
  if (bad.length) { console.error(`error: unknown argument ${bad.join(" ")} (use --check, --force, --root <dir>)`); return 2; }
  if (argv.includes("--check") && argv.includes("--force")) { console.error("error: --check never writes, so --force has no effect with it"); return 2; }
  let root = i > -1 ? argv[i + 1] : null;
  if (!root) { try { root = execSync("git rev-parse --show-toplevel", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { root = process.cwd(); } }
  const { lines, code } = build(path.resolve(root), { check: argv.includes("--check"), force: argv.includes("--force") });
  for (const l of lines) (code && !/^(create|update|note|\d)/.test(l) ? console.error : console.log)(l);
  return code;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
