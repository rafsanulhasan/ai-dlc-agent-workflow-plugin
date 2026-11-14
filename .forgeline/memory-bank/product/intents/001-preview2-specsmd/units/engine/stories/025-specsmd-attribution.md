---
id: 025-specsmd-attribution
unit: engine
intent: 001-preview2-specsmd
status: ready
priority: must
bolt: 013-engine-notices
created: 2026-11-14
---

# engine/025 — The specsmd attribution ships in both plugin builds

**Planned:** nothing here is built yet. The story belongs to [bolt 013-engine-notices](../bolts/013-engine-notices/bolt.md), which has not started (G3 approved, 2026-11-14, D79).

## Story

As the licence holder's downstream, we want the specsmd attribution shipped in both plugin builds, so that the release is licence-compliant (P1).

## Acceptance criteria

- AC-12.1
- AC-12.2
- AC-12.3

## Technical notes

- It adds the `ROOT_NOTICES` allowlist to the build, and `tests/build-copilot-notices.test.mjs`.
- It adds the entry to `THIRD_PARTY_NOTICES.md`.
- The root `ATTRIBUTION.md` is created here and lists the files adapted so far. Later adapting bolts append to it (DoD), and ITEM-122 compares the full list. Bolt 013 merges before 005, which appends to it in the same wave.
