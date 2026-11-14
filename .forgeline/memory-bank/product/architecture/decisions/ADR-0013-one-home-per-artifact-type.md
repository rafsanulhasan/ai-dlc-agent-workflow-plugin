# ADR-0013: One home per artifact type, one old-to-new map; the new path wins

- **Status:** Accepted (G2 approved, D38). Planned: nothing is built.
- **Date:** 2026-11-13
- **Deciders:** software-architect (1.1.14, 1.1.20), system-engineer (1.1.19), human at G2.

## Context

Knowledge moves from `docs/` to `memory-bank/product/` and `memory-bank/project/`, and runs move to `execution-plans/` (D2, D3, D8). Repositories on preview1 must keep working for one release (D9), with a warning and a migration.

## Decision

A single code table, `ARTIFACT_TYPES` in `workflow.mjs`, gives each artifact type its one new path and its legacy path; `validate`, `migrate`, the path resolver and the tests all read it.

- The layout is preview2 when `artifacts.intents` is set; otherwise it is read as preview1 with a warning.
- A non-empty new root wins. A non-empty legacy root is ignored with a warning when both are non-empty.
- Without a `workflow.json`: a non-empty `execution-plans/` wins, else a non-empty `docs/handoffs/` is read with a warning.
- One warning line per invocation, roots aggregated, through the existing non-blocking channels, naming the migrate entry of that channel.
- Legacy branches in code are marked `fallback: remove in 1.0.0`.
- Order is enforced in code: new tooling, then `migrate`, then the template-key merge (`merge` skips `artifacts` while the layout is legacy), then the managed-block refresh by `init`.

## Consequences

- Preview1 repositories work for one release.
- Bolt artifacts are spread by type and linked from `bolt.md`.
- Specs and low-level designs share a folder, with different suffixes.
- Empty legacy folders never warn.
- Removing the fallback in 1.0.0 is a search for the marker.

## Alternatives rejected

- Co-locating every artifact of a bolt in its own folder: violates one home per type (AC-1.2).
- The legacy path wins: freezes migration.
- A warning per file or per session: noise, or silence.
- An empty new root counts as present: the warning would never stop.
