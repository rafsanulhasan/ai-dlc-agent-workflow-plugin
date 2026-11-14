---
name: preview2-forgeline-adr0017
description: preview2 run feature 8 (2026-11-14) - ADR-0017 proposed (standards = agent artifacts, exception to ADR-0014); .forgeline dogfood vs plugin layout; new bolt 015 outline
metadata:
  type: project
---

Step 8.1.6 (run AI-DLC-20261113-preview2-specsmd, worktree plan/preview2): I proposed **ADR-0017** as a new ADR amending ADR-0014 (not an in-place rewrite; write-adr has no "Amended" status, so ADR-0014 gets a status note + exempt bullet). Scope = the folder `artifacts.standards` resolves to; agent-manager sole writer there; any other agent's write there is the Blocker. Bank ADRs live in `.forgeline/memory-bank/product/architecture/decisions/` (0011-0016 existed; next after 0017 is 0018). Old ADR-0001..0010 stay in `docs/architecture/decisions/`.

**Why:** D56 made standards the source of generated full rule twins (8.1.5: no host loads pointer stubs reliably), D57 gave them to agent-manager; spec 001 §14 / AC-7.1-7.3 said every bank file is documentation, so a G2 amendment is needed.

**How to apply:** Recommended consumer layout adopt `architecture/{decisions,narratives}` (D45) as a G2 amendment so dogfood = plugin layout minus `.forgeline/` prefix. Latent conflicts flagged: spec area rule `memory-bank/<area>/` and overlap rule (this repo's `product` key = whole `product/` root) fail once this repo goes preview2 layout - the `.forgeline` bolt (proposed 015, ADR-0018 for the D16 reversal) must land before ITEM-121 and before the preview2 release so migration is one hop. Related: [[wave2-tier1-design]], [[herdr-design-adr0010]].
