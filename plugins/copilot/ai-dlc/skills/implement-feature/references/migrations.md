# Migrations

Companion to `implement-feature` for plan steps that move a system from one shape to another while it keeps running: a database schema or data change, an API or message-contract version, a protocol or file-format change, a configuration format, or a dependency upgrade that changes behaviour. The goal is a transition that can be reversed, that is safe while old and new versions overlap, and that is proven at each stage.

## Map before you edit

Write down, in the plan:

- **Readers and writers** — every component, job, service and external client that reads or writes the thing being migrated, including ones outside this repository.
- **Current and target shape** — the data, contract or configuration before and after.
- **Compatibility window** — how long old and new versions run side by side during rollout, and which combinations can occur (old writer + new reader, and the reverse).
- **Ownership** — who deploys each part; rollout sequencing may belong to **Gene Kim** (`devops-engineer`).

If the migration changes a public contract or is hard to reverse, the decision needs an ADR from **Mark Richards** (`software-architect`) before you build it.

## Forward and rollback paths

Define both before writing either. The rollback path restores the previous working state from any point in the forward path, and it is proven, not assumed: run it in a disposable or test environment and confirm the old version works against the rolled-back state.

## Expand, migrate, verify, contract

Sequence the change so each stage is safe on its own:

1. **Expand** — add the new shape alongside the old (new column, new field, new endpoint version, new config key). Old readers and writers are unaffected.
2. **Migrate** — move or dual-write data, switch readers, roll out the new version. Every step is idempotent (safe to re-run after a partial failure) and its progress is observable (counts, logs, a check that reports how much is left).
3. **Verify** — prove old and new paths both behave correctly at this stage, and that the data matches.
4. **Contract** — remove the old shape. This is the destructive step.

## Rules

- **Preserve existing data.** Any step that deletes, truncates, overwrites or narrows data is called out explicitly in the plan and needs its own approval. It is never bundled silently into another step.
- **Stay mixed-version safe.** At every stage, any combination of old and new components that can run together during rollout must work.
- **Verify at each stage, not only at the end.** Test old and new paths at the stages where both exist.
- **Stop at the requested stage.** If the work item asks for expand and migrate, stop after verify. Contraction is a later, separately approved work item; do not perform it because it looks like the obvious next step.
- **Record it.** The handoff lists the stage reached, the forward and rollback commands, the rollback proof, and what remains (usually contraction). The commit body states the migration and its rollback path — see [commit-messages.md](commit-messages.md).
