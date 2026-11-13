# Architecture narrative — preview2: a memory bank, units and bolts, and a new name

**Planned:** this is the architecture proposed for G2 of intent 001 (release `1.0.0-preview2`). Nothing described here is built; the human decides at G2. Audience: the human owner and the product owner. It assumes no earlier context. The decisions it rests on are [ADR-0011](../decisions/ADR-0011-records-are-events.md) to [ADR-0016](../decisions/ADR-0016-stable-units.md).

## Act 1 — The problem

The AI-DLC plugin runs a team of AI agents through lifecycles with human approval gates. Today everything the agents produce lands in `docs/`: specs, architecture decision records (ADRs), plans, the backlog and hundreds of hand-off records. That mixes three different things: what the product *is* (knowledge), how the team is *working* (run mechanics), and what readers need (user documentation). Nothing says which file is current, who may write it, or how a piece of work is sized.

specsmd, an open-source method, has a cleaner model. A **memory bank** holds knowledge, and work flows as **intents, units and bolts**: an intent is a goal, a unit is a lasting slice of the product, and a bolt is a small, typed delivery slice. The owner wants that model adapted natively, under our gates, with typed events for the hand-offs. The product also gets its real name: the plugin becomes **engine**, the marketplace **forgeline**, and the live view **lens** owns its own commands.

The people involved are the human owner, who approves at the gates; the users who installed preview1 and must not be stranded; and the agents, whose instructions encode every path and name.

## Act 2 — What made this hard

**Constraints.**

- This run is planning only.
- Tooling is zero-dependency Node.
- It must work in Claude Code and GitHub Copilot, with the lens Claude-only.
- Preview1 repositories keep working for one release (D9).
- There is no deterministic runtime (D3).
- There is one documentation writer (D2).

**Characteristics that matter.**

- *Evolvability*: every path comes from one table.
- *Recoverability*: event records stay plain files.
- *Migratability*: one command, with a dry run.
- *Consistency*: one status vocabulary, and one record that wins when two disagree.

**Unique challenges.**

- The rename touches every agent reference, every memory folder and every user setting.
- No alias exists for a renamed marketplace, and removing a marketplace deletes the plugin's stored data.
- The lens's commands are answered by a module in one plugin while the skills that name them ship in another.
- Some platform behaviour is undocumented: how memory folders are named for a plugin's agents, and what happens when the default agent names an unknown plugin.

**Trade-offs.**

| Option | Gain | Cost | Chosen |
|---|---|---|---|
| Bolt types as new lifecycles | Clearer names | Doubles the catalogue and the gates | No: bolt types are subsets of existing stages with a skip rule |
| A separate event stream | A cleaner log | Duplicates the hand-off records | No: the records are the events, with front matter |
| A folder per bolt holding all its artifacts | Browsable | Breaks one home per artifact type | No: type folders, linked from `bolt.md` |
| Renaming in two releases | Softer | Two breaks for users | No: one clean break (the owner's choice, D23) |
| Units numbered per intent | specsmd's way | A new name for the same slice each intent | No: stable unit names (D27) |

## Act 3 — The design

```text
memory-bank/
  product/  intents/{NNN}-{slug}/units/{unit}/{unit-brief.md, stories/, bolts/}
            units.md · specs/ (.spec.md, .lld.md) · decisions/ · narratives/ · glossary.md · briefs/
  project/  backlog.md · out-of-scope/ · plans/ · research/ · quality/ · standards/
execution-plans/{LIFECYCLE}-{date}-{slug}/
  execution-plan.md · run.v*.md · 1.2-orchestrator-to-x.handoff.md · …handback.md · …verdict.md · …escalation.md · …command.md
docs/   README pages, guides, release notes (reader-facing only)
```

- **Two units.** `engine` owns the contract (layout, event grammar, `workflow.json`, migration) and the team, including keep-alive and auto-handoff. `lens` reads the contract and shows runs live. The dependency runs one way, from the lens to the engine.
- **Bolts** are typed by naming a subset of an existing lifecycle's stages (`construction`, `simple`, `spike`); stages outside the subset are skipped like a false condition.
- **Events** are the hand-off records with a type and front matter, checked by `validate` when a run opts in.
- **Preview1 repositories** keep working for one release. The new path wins and the old one is read with one warning that names `/engine:migrate`. Migrate shows a dry run, refuses conflicts before writing, moves files with `git mv`, rewrites the repository's settings and memory folders, and flips the layout last.
- **Decisions.** ADR-0011 (records are events), ADR-0012 (bolt types as skippable stage subsets), ADR-0013 (one home per type; the new path wins), ADR-0014 (a single writer of the bank), ADR-0015 (the rename and the migrate skill), ADR-0016 (stable units). Each traces back to a challenge in Act 2.
- **Delivery.** Thirteen bolts (a draft index is in [the task plan](../../project/plans/001-preview2-specsmd.tasks.md)): a live spike first settles the undocumented behaviour; then the content bolts; then the rename, serialised; then migration and the sweep; then this repository's own migration and the release.
- **Open items.** What the human still decides at G2, and what the spike may change, is in spec 001 §17 and §16 (bolt 001).

### Risks and mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | Undocumented platform behaviour | Spike bolt 001 runs first; the spec changes before the migration bolt |
| 2 | Users lose plugin data when they remove the old marketplace | Upgrade-guide warning before step 1; migrate dry run |
| 3 | The rename churns every file | Serialised, with no other bolt open; a stale-names sweep |
| 4 | Three parsers drift apart | One grammar, shared test vectors, a drift test |
| 5 | The settings rewrite misses a form | A parse check after the rewrite; misses are reported as advice |
| 6 | The fallback outlives its release | A marker in code and a search for it in 1.0.0 (ITEM-125) |
| 7 | `workflow.mjs` grows (988 lines today; the contract, events and `migrate` add to it) | Split into `lib/` once it passes about 1,500 lines (spec 001 §2.3) |
