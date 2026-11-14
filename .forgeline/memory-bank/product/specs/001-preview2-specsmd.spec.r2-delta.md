---
spec: 001-preview2-specsmd
revision: r2
base: memory-bank/product/specs/001-preview2-specsmd.spec.md (G2-approved, D38)
intent: 001-preview2-specsmd
status: ready
created: 2026-11-14
---

# Spec 001, revision delta r2 (G2 amendment, feature 8; input to G3)

**Approved at G3, 2026-11-14 (D80):** this delta changes the frozen spec 001 (D64, D65) now that the human has approved it. The spec file itself is not edited by this record; this delta is the text of record, and it is written as a delta file because the spec says that after G2 it changes only through revision deltas (spec header, *Status*), as the r1 delta does. The front matter `status: ready` is this delta's own status, not the spec's.

Content by `software-architect` (step 8.1.6) and `requirement-analyst` (step 8.1.7); written to the bank by `documentation-writer` (D2, step 8.5.3). Line numbers ("spec:N") refer to `memory-bank/product/specs/001-preview2-specsmd.spec.md` as approved at G2.

Sources (all in `.forgeline/execution-plans/AI-DLC-20261113-preview2-specsmd/`): `8.1.6-software-architect-to-orchestrator.handback.md` (§1c, §2a, §2b) and `run.v2.md`, Feature 8 (D57, D64, D65). The reasoning behind the §14 change is [ADR-0017](../architecture/decisions/ADR-0017-standards-are-agent-artifacts.md).

## Change index

| # | Section | Change | Needs G2 approval | Source |
|---|---|---|---|---|
| 1.1 | §2.1 tree (spec:62) | `decisions/` and `narratives/` move under `architecture/` | yes | D64; 8.1.6 §2a |
| 1.2 | §2.1 after spec:65 | informative note: this repository dogfoods the layout under `.forgeline/` | no (informative) | D53, D58; 8.1.6 §2b |
| 1.3 | §2.2 (spec:79, :80) | ADR and narrative paths | yes | D64; 8.1.6 §2a |
| 1.4 | §3 (spec:127, :128) | preview2 column of the `decisions` and `narratives` rows | yes | D64; 8.1.6 §2a |
| 1.5 | §14 (spec:544 to :546) | the bank is documentation except the standards folder; single writer and severity follow | yes | D57, D65; ADR-0017; 8.1.6 §1c |
| 1.5a | §14 (spec:550) | "Done" for a unit or bolt: bank content apart from the standards folder | yes | D65; ADR-0017; step 8.1.7 |
| 1.6 | acceptance-criteria.md: C-10, AC-7.1, AC-7.2, AC-7.3, AC-7.5, three glossary entries | wording for the standards exception, written into the AC file | yes | D65; step 8.1.7 |
| 1.7 | architecture narrative preview2-specsmd.md, line 53 (its tree) | `decisions/` and `narratives/` move under `architecture/`, as in 1.1 | no (the narrative follows the amended spec) | D64 |

Changes 1.1, 1.3 and 1.4 adopt D45 for consumer repositories (D64, option A): consumer repositories get `memory-bank/product/architecture/{decisions,narratives}/`, so this repository's layout equals the plugin layout apart from the `.forgeline/` prefix. The overlap rule of §2.3 still passes: the roots `memory-bank/product/architecture/decisions` and `memory-bank/product/architecture/narratives` share a parent, but neither is a prefix of the other, and no key's root is `memory-bank/product/architecture`. The legacy-path regex of §15 (spec:562) matches the `docs/…` legacy paths and is unaffected. No AC names these paths, and the r1 delta has no `product/decisions` or `product/narratives` path, so no other spec or AC text changes. The only other file with the flat paths was the architecture narrative, whose tree line is aligned (1.7).

## 1.1 §2.1 tree (spec:62)

Replace:

```text
                       units.md · specs/ · decisions/ · narratives/ · glossary.md · briefs/
```

with:

```text
                       units.md · specs/ · architecture/{decisions,narratives}/ · glossary.md · briefs/
```

## 1.2 §2.1 note (insert after spec:65)

Informative; it describes this repository only and needs no G2 approval.

> This repository dogfoods the layout under `.forgeline/` (D53, D58): its `artifacts` settings prefix every bank and run path above with `.forgeline/` (`.forgeline/memory-bank/…`, `.forgeline/execution-plans/…`). The plugin default stays as shown until bolt 015 (the `.forgeline` root; D66 and D70 are decided, FR-18 is approved at G3, 2026-11-14 (D80)) ships.

## 1.3 §2.2 (spec:79, :80)

Replace spec:79:

```text
| ADR | `memory-bank/product/decisions/ADR-NNNN-<title>.md` | `decisions` |
```

with:

```text
| ADR | `memory-bank/product/architecture/decisions/ADR-NNNN-<title>.md` | `decisions` |
```

Replace spec:80:

```text
| Architecture narrative | `memory-bank/product/narratives/<slug>.md` | `narratives` |
```

with:

```text
| Architecture narrative | `memory-bank/product/architecture/narratives/<slug>.md` | `narratives` |
```

## 1.4 §3 (spec:127, :128)

Replace spec:127:

```text
| decisions | `docs/architecture/decisions/` | `memory-bank/product/decisions/` |
```

with:

```text
| decisions | `docs/architecture/decisions/` | `memory-bank/product/architecture/decisions/` |
```

Replace spec:128:

```text
| narratives | `docs/architecture/narratives/<feature-slug>.md` | `memory-bank/product/narratives/<feature-slug>.md` |
```

with:

```text
| narratives | `docs/architecture/narratives/<feature-slug>.md` | `memory-bank/product/architecture/narratives/<feature-slug>.md` |
```

## 1.5 §14 (spec:544 to :546)

Replace the three bullets "The bank is documentation", "Single writer" and "Severity" with:

- **The bank is documentation, except the standards.** The rewritten `docs-status` lists every file under `memory-bank/` as documentation, except the standards folder (`artifacts.standards`, default `memory-bank/project/standards/`), which holds agent artifacts (ADR-0017). The rule lives in three copies with identical bodies: the `docs-rules` template, `.claude/rules/docs-status.md` and its `.github/instructions/` twin.
- **Single writer.** `documentation-writer` is the only agent that creates, edits or deletes files under `memory-bank/`, except the standards folder, which only `agent-manager` writes (ADR-0017). Stage agents return the content plus a *Docs update* request.
- **Severity.** A bank file in another agent's change set is a Blocker (`code-reviewer` cannot approve; `brutal-critique` returns REVISE); for the standards folder, "another agent" is any agent other than `agent-manager`. The rule and the `review` skill both state this check.

## 1.5a §14 "Done" bullet (spec:550)

Replace spec:550:

```text
  - its bank content was written by `documentation-writer`;
```

with:

```text
  - its bank content, apart from the standards folder, was written by `documentation-writer` (standards are agent artifacts and are not part of knowledge done, ADR-0017);
```

## 1.6 ACs and glossary

The wording was confirmed by `requirement-analyst` (step 8.1.7) and is written into [the acceptance criteria](../intents/001-preview2-specsmd/acceptance-criteria.md) itself, each item marked as a G2 amendment (D65) approved at G3, 2026-11-14 (D80). The AC file is the text of record; this delta only lists what changed there:

- **C-10** (AC file, *Decided*): the one exception is the standards folder, where the Blocker applies to any agent other than `agent-manager`.
- **AC-7.1:** the `docs-status` rule excludes the standards folder from the closed list of documentation and lists the standards under agent artifacts, written by `agent-manager`.
- **AC-7.2:** `documentation-writer` writes under `memory-bank/` except the standards folder, which only `agent-manager` writes.
- **AC-7.3:** the finding has two cases: (a) an agent other than `documentation-writer` changes a bank file outside the standards folder; (b) an agent other than `agent-manager` changes a file in the standards folder.
- **AC-7.5**, first bullet: "apart from the standards folder".
- **Glossary:** "Memory bank", "Memory bank project" and "Engineering state / knowledge state" carry the same exception.

The standards folder means the folder `artifacts.standards` resolves to, by default `memory-bank/project/standards/`.
