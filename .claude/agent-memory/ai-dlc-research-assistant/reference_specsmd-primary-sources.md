---
name: specsmd-primary-sources
description: specsmd (fabriqaai/specs.md) and AWS AI-DLC primary sources, licences and known inconsistencies as checked 2026-11-13
metadata:
  type: reference
---

specsmd = npm package `specsmd`, repository github.com/fabriqaai/specs.md. `src/package.json` on main shows version 0.1.74, licence MIT.

Primary sources that answered: `README.md`, `LICENSE` ("MIT License", "Copyright (c) 2025 Fabriqa AI"), `src/flows/aidlc/memory-bank.yaml`, `src/flows/aidlc/agents/construction-agent.md`.

Fetch limits: the npm and socket.dev pages returned 403 to WebFetch; docs.specs.md returned 404.

**Why:** Known inconsistencies in the specsmd sources:
- README gives `intents/{name}/units.md`; `memory-bank.yaml` uses `units/{unit}/unit-brief.md`.
- The `ddd-03-test-report.md` file is labelled stage 5, but the construction stages are four.
- README naming differs from the yaml naming (NNN prefixes).
- Only `ddd-construction-bolt` is named as a bolt type. TDD and BDD appear only in a third-party example.

AWS AI-DLC methodology: blog post by Raja SP, 2025-07-31, aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/. `awslabs/aidlc-workflows` is a different project under MIT No Attribution (MIT-0).

**How to apply:** Re-check the version and licence against `src/package.json` and `LICENSE` before relying on them. Do not cite the third-party bolt-type example as a definition.
