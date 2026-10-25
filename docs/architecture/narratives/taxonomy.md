---
feature: taxonomy
root: 18
audience: product owner, plugin maintainer, G2 reviewer
author: software-architect
date: 2026-10-24
spec: docs/specs/taxonomy.spec.md
adrs: [ADR-0003, ADR-0004]
---

# Narrative: grouping work by module without moving a single record

## Act 1: the problem

The plugin has no idea which module a piece of work belongs to. Backlog items, stories, tasks and runs carry no module, submodule, feature or integration. So no tool can filter or group by them, and the lens cannot draw a module view.

The next root (21) will nest runs under epic and sprint folders. Today's discovery reads only one level, so nested runs would vanish from resume, auto-handoff and the lens (14.1.13 §1).

## Act 2: constraints and choices

- **C1 (human).** Epics are folders, and the taxonomy is front-matter tags. A cross-module feature cannot have two parent folders.
- **C2 (human).** The declaration is optional. Without one, everything behaves as it does today.
- **C3.** Undeclared ids must fail validation (00c root 18).
- **C4.** The taxonomy is product data, and it changes when the product changes. Today the workflow file can only be changed through agent-manager.
- **C5.** Runs must be found at any depth, and a run id must name one run.
- **C6.** Moving a run must not break any record or old brief.
- **C7.** Three runtimes read runs: auto-handoff, the lens and `workflow.mjs`. They cannot share code.

### Alternatives

- **Where the taxonomy lives:**
  - a section in the workflow file. Rejected because of C4;
  - its own file. Chosen;
  - front matter only. Rejected because of C3.
- **How run ids work:**
  - path-based ids. Rejected because of C6;
  - unique folder names. Chosen.
- **How to keep the three runtimes in step:**
  - one shared walk module. Rejected because of C7;
  - three copies held to one contract fixture. Chosen.

## Act 3: the design

- **D1, D2 (C2, C3, C4; ADR-0003).** The declaration is an optional `.ai-dlc/taxonomy.json`, kept by the product manager. When the file exists, `validate` checks it, and `validate --artefacts` checks every open tagged artefact.
- **D3 (C1).** The four tags go on run states, backlog items, stories and tasks. The breakdown carries them, and a row without a module is `needs-info`.
- **D4 (C5, C7; ADR-0004).** A bounded walk finds run folders at any depth. Ids must be unique, and one shared fixture holds the three copies of the walk to the same result.
- **D5.** Each stage row lists its sessions as `chain: ids`. That lets one run spanning several sessions map onto its steps (Integration2 (iii)).
- **D6 (C6).** `move-run` keeps every record name and leaves a `merged-from` note. The lens finds a moved run by its id.
- **D7, D8, D9.** Three smaller pieces:
  - auto-handoff can filter runs by module;
  - runs and tasks name each other;
  - run states are written in priority order.
- **D10.** This repository's own taxonomy is the first declaration.

### Risks

- **A wrong tag is caught by `validate --artefacts`, not by the Stop gate.** The gate runs only when `.ai-dlc/` changed. CI and `product-manager` run the artefact checks, so a tag error never blocks unrelated work.
- **The three walks can drift apart.** The contract fixture catches it.
