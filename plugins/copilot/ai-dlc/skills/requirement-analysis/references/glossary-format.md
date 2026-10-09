# Glossary Format

The project glossary records the domain language: the words the business and the code should both use for the same concept. It is the ubiquitous language of the project, written down. Requirements, specs, ADRs, designs and code names all draw on it.

## Where it lives

1. If the repository already has a glossary (search for `GLOSSARY.md`, `docs/glossary.md` or a "Glossary" section in `docs/`), use it and keep its layout.
2. If the repository has several bounded contexts, keep one glossary per context next to that context's code, plus a `GLOSSARY-MAP.md` at the root that lists the contexts and how they relate.
3. Otherwise, use a single `GLOSSARY.md` at the repository root.

Create the file only when the first term is settled. An empty glossary is noise.

When several contexts exist, work out which one the current conversation is about. If it is not obvious, ask.

## Single-context layout

```md
# <Context name>

<One or two sentences: what this context is and why it exists.>

## Language

**Subscriber**:
A household or business with an active contract for at least one service.
_Avoid_: customer, client, account

**Activation**:
The moment a provisioned service starts billing.
_Avoid_: go-live, enablement
```

Group terms under sub-headings once natural clusters appear. A flat list is fine while the glossary is small.

## Multi-context map

```md
# Glossary Map

## Contexts

- [Ordering](./src/ordering/GLOSSARY.md): takes and tracks orders
- [Billing](./src/billing/GLOSSARY.md): raises invoices and collects payment

## Relationships

- **Ordering -> Billing**: Ordering publishes `OrderPlaced`; Billing raises the invoice from it.
- **Ordering <-> Billing**: both share `CustomerId` and `Money`.
```

The same word may legitimately mean different things in two contexts. Record it in both glossaries with each context's meaning, and note the translation in the map.

## Rules for entries

- **Pick one word.** When several words name the same concept, choose the clearest and list the rest under `_Avoid_`.
- **Define what it is, not what it does.** One or two sentences.
- **Domain terms only.** Leave out general programming vocabulary (timeout, retry, DTO, cache) even if the project uses it constantly. Ask: would a domain expert recognise this word as part of their business? If not, it does not belong.
- **No implementation detail.** The glossary is not a spec, a design note or a scratch pad. Table names, class names and algorithms go elsewhere.
- **Write it when it is settled.** Update the glossary as each term is resolved, not in a batch at the end.
