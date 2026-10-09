# Out-of-Scope Record

`docs/backlog/out-of-scope/` keeps the reasoning behind every feature request rejected in triage, so a request that returns months later meets the earlier decision instead of a fresh debate.

## Layout

One file per **concept**, not per request, named in kebab-case so the directory reads as a list of rejected ideas: `dark-mode.md`, `plugin-system.md`, `graphql-api.md`. Every later request for the same idea is appended to the same file.

Write each file as a short design note a newcomer can follow:

```markdown
# <Concept>

<One sentence stating what the product does not do.>

## Why this is out of scope

<The durable reason: product scope or philosophy, a technical constraint and
what supporting it would require, or a strategic choice made instead.
Name the interfaces or decisions involved so the reasoning can be re-checked.>

## Requests

- <date> — <backlog item, issue or request reference>: "<short quote>"
```

The reason must outlive the moment. "Not this quarter" or "no capacity" is a deferral, not a rejection: keep such items in the backlog at a lower priority instead of recording them here.

## Reading it (triage Step 1)

**James Montemagno** (`product-manager`) owns this record: it decides each rejection and writes the entry. Read every file in the directory and compare by concept, not keyword: "night theme" matches `dark-mode.md`. On a match, weigh the recorded reason and either:

- **confirms** — append the new request to the file's Requests list; the item's triage state is `wontfix (rejected)`;
- **reconsiders** — update or remove the file; the item continues through normal triage. If the recorded reason was a scope decision by **James Montemagno** (`product-owner`), escalate it to them as an open question through the orchestrator instead of reversing it yourself;
- **distinguishes** — the requests are related but different; triage continues and the file is left alone.

## Writing it

Write here only when you reject a **feature or enhancement** in triage. Never write here when:

- the behaviour **already exists** — that is `wontfix (already implemented)`; point to where it lives instead, or the record would make later triage reject things the product already does;
- the item is a **bug** — a declined bug is explained in the triage notes, not recorded as a product decision.

Check for an existing file for the concept first and append to it; create a new file only when none matches.
