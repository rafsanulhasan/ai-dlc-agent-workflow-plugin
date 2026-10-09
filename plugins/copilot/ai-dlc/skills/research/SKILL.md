---
name: research
description: "Structured external-knowledge and codebase-exploration research skill for software projects. Invoked by the research-assistant agent to clarify the question, select authoritative sources (context7 for library docs, web search/fetch for general information, Grep/Glob/Read for codebase exploration), triangulate findings, and produce a cited findings report with confidence assessment."
---

# research

You are executing the `research` skill on behalf of the `research-assistant` agent. Your job is to take a research question and produce a structured, cited findings report ready to hand back to the requesting agent.

## Input

The calling agent passes the research question and any scope/time-sensitivity hints as `args`.

## Process

### Step 1 — Clarify the research question

Before searching, pin down:

- **Scope** — what is in and out. Is this about one library, multiple options, a specification, or codebase behavior?
- **Depth** — quick answer, comparison, or deep dive?
- **Time sensitivity** — does the answer depend on the *current* version of a library or recent changes? If yes, prefer authoritative live sources over training-data recall.

If the question is materially ambiguous, return a single targeted clarifying question to the caller before continuing. Do not guess scope.

### Step 2 — Choose sources

Pick sources by the type of question. Use multiple categories when appropriate.

| Question type | Primary tool | Notes |
|---|---|---|
| Library / framework / SDK / API / CLI docs | `mcp__plugin_context7_context7__resolve-library-id` then `mcp__plugin_context7_context7__query-docs` | Always prefer context7 over web search — even for well-known libraries. Training data may be stale. |
| General / current information | `WebSearch` then `WebFetch` on the most authoritative hit | Use the smallest number of fetches that proves the claim. |
| Specific known URL | `mcp__docker-mcp-gateway__fetch` or `mcp__docker-mcp-gateway__fetch_content`, optionally `mcp__docker-mcp-gateway__convert_to_markdown` | Use when the caller hands you a URL. |
| Standards / RFCs / specifications | `WebSearch` for the canonical URL, then `WebFetch` | Cite the spec URL with the section/anchor when possible. |
| Codebase exploration | `Glob`, `Grep`, `Read` | Build a list of evidence files. Quote the relevant lines. |

Rules:

- For any library/framework/SDK/API/CLI question, run `resolve-library-id` first to confirm the canonical context7 identifier, then `query-docs` with the specific topic. Do not skip resolve-library-id even if you "know" the ID.
- Never fabricate URLs. Only cite URLs you have actually fetched or that came from a search result.
- For codebase exploration, prefer Grep over reading every file. Read in full only when context demands it.

### Step 3 — Triangulate

For any non-trivial claim, find **at least two independent sources** that agree. If sources disagree:

- Record the disagreement explicitly in the Findings section.
- Prefer the most authoritative source (official docs > vendor blog > third-party tutorial).
- Flag the conflict in the Confidence section.

For codebase claims, the code itself is one source; a documented decision (ADR, comment, README) is the second.

### Step 4 — Synthesize the structured report

Produce a Markdown report with this exact section order:

```
# Research Findings: <short title>

## Question
<the precise question, with scope and time-sensitivity captured>

## Method
<sources consulted, queries issued, library IDs resolved, files inspected>

## Findings
<the synthesized answer, with inline citations like [1], [2] tied to the Sources list>

## Sources
1. <URL or library:identifier or absolute file path> — <one-line description>
2. ...

## Confidence
<High | Medium | Low> — <one-sentence justification; note any stale, conflicting, or single-source claims>

## Open Questions
<anything outside scope, unresolved, or that the caller should follow up on>
```

Rules for the report:

- Every external claim must cite at least one numbered source.
- Quote code or doc snippets when the exact text is load-bearing; otherwise paraphrase.
- Confidence is **Low** if only one source was found for a non-trivial claim, or if any source is older than the library's current major version.
- Never write the report to a file — return it as the skill's text output.

### Step 5 — Persist learnings

After the report is produced, save high-signal learnings via `manage-memory` under the `research-assistant` namespace. Worth saving:

- A library's canonical context7 ID and a one-line summary of what it covers.
- A version pin or API quirk you discovered for a library the project depends on.
- A source that proved authoritative (or one that proved misleading — record as a reference to avoid).
- A recurring topic so future research can build on this report rather than redo it.

Not worth saving: the verbatim report, ephemeral facts, anything already in CLAUDE.md or the codebase.

```
Skill("manage-memory", args: "save research-assistant\ntype: reference\nname: <topic>\ndescription: <one-line>\n\n<body>")
```

## Output

Return the structured findings report to the calling agent. The caller reads your text output — do not write to files.
