---
name: licence-fetch-recipe
description: How to read third-party licence texts verbatim here (curl is denied; git clone, npm pack, gh api work) and the lens vendor facts found that way
metadata:
  type: reference
---

Reading licence texts and provenance for notices (ITEM-056, 2026-11-13):

- `curl` is denied by the permission settings. What works: `npm view <pkg>@<ver> repository license gitHead --json`, `npm pack <pkg>@<ver>` into `.scratch/<task>/` then `tar -xzf`, `git clone --depth 1 --filter=blob:none --no-checkout --branch <tag> <url>` then `git show <rev>:LICENSE`, and `gh api repos/<o>/<r>/releases/tags/<t>` for release notes. A WebFetch summary is not verbatim; never paste licence text from one.
- Git checkouts on this machine come out CRLF: strip `\r` before putting text in a notice (the repo files are LF).
- The lens notices section is assembled by a Node script from a template plus the fetched files, written to both `THIRD_PARTY_NOTICES.md` (root section) and `plugins/claude/ai-dlc-lens/THIRD_PARTY_NOTICES.md`; check identity with `diff <(sed -n '/^## ai-dlc-lens diagram renderer (/,$p' A) <(same for B)`.
- Facts: elkjs 0.11.1 is EPL-2.0 only (the GPL-3.0 option is 0.12.0's); its ELK source is commit c831ba4 (the release-note text says 28e5173, but the bundle has enum names only c831ba4 has). The resvg engine in resvg-wasm 2.6.2 is the zimond/resvg fork at 3495d8705b302d6d266748516973606ca9657906.

**How to apply:** use this recipe before asking research-assistant (no shell) for verbatim texts or byte checks. Related: [[feedback_third-party-adaptations]].
