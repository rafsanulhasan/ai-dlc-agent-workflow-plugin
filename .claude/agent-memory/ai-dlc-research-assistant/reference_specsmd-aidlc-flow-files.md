---
name: specsmd-aidlc-flow-files
description: Where specsmd's AI-DLC unit/bolt design lives (src/flows/aidlc) and WebFetch caveats when reading it
metadata:
  type: reference
---

specsmd AI-DLC flow files: `https://raw.githubusercontent.com/fabriqaai/specs.md/main/src/flows/aidlc/` (memory-bank.yaml, templates/construction/bolt-template.md, templates/construction/bolt-types/*.md, skills/*, scripts/*.cjs). Tree: `https://api.github.com/repos/fabriqaai/specs.md/git/trees/main?recursive=1` (298k chars; read with WebFetch offset 100000).

**Why:** WebFetch always summarises and refuses "verbatim" requests (quote limit). **How to apply:** ask for "structural extraction" (frontmatter keys, headings, table columns) instead; it works and returns exact key names. Repo itself is inconsistent: bolt dir `{BBB}-{unit}/` vs `bolt-{unit}-{N}/`, bolt id `bolt-{unit}-{seq}`, `complete` vs `done`/`inception-complete` statuses.
