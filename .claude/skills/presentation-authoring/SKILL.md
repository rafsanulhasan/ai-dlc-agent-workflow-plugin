---
name: presentation-authoring
description: "Authors and maintains PowerPoint (.pptx) decks: reading a deck, editing slide text in place without breaking the layout, building a new deck, rendering slides to images for visual QA, and keeping a deck in sync with its source of truth (for example a team roster or a product's architecture). Use whenever a .pptx must be created, updated, reviewed or checked against the current state of the project."
---

# Presentation Authoring

A `.pptx` is a ZIP of XML parts. Most deck work is **editing an existing deck so it says what is true now**, and the safest way to do that is to replace whole text runs in the slide XML and leave every shape, position and style alone. Building a new deck is the less common case.

Helpers in `${CLAUDE_SKILL_DIR}/scripts/` (Python standard library and PowerShell only — no installs):

| Script | What it does |
|---|---|
| `pptx_text.py deck.pptx [--runs]` | Text per slide in presentation order; `--runs` numbers every text run (what you match against when editing) |
| `pptx_replace.py in.pptx out.pptx edits.json` | Replaces whole runs per slide from `{ "4": [["old", "new"], …] }`; refuses to write if any `old` is missing or ambiguous; escapes XML; checks each edited slide is well-formed |
| `export-slides.ps1 -Deck <abs> -OutDir <abs> [-Slides 4,5]` | Renders slides to `s<N>.png` through installed PowerPoint on Windows, without a window |

## 1. Work on a copy

- Copy the deck to a scratch folder and work there; write back to the original path only after QA passes.
- If the deck is not committed yet, tell the user — an overwritten deck cannot be recovered otherwise.

## 2. Read it

1. `python "${CLAUDE_SKILL_DIR}/scripts/pptx_text.py" deck.pptx` — what every slide says.
2. Render the slides you will touch (§5) and look at them: layout, how full each box is, what wraps.
3. Decide **what is true now** from the source of truth, not from memory — for a team deck that is the agent definitions, skills and README of the project; for an architecture deck, the ADRs and specs. List every claim on the slides that no longer holds (names, counts, roles, flows, file paths, versions).

## 3. Edit text in place

1. `pptx_text.py deck.pptx --runs` to get the exact run text on each slide you will change.
2. Write `edits.json` with whole-run replacements, slide numbers in presentation order. A sentence split across several runs (mixed formatting) must be replaced run by run, keeping each run's role.
3. `python "${CLAUDE_SKILL_DIR}/scripts/pptx_replace.py" deck.pptx out.pptx edits.json`.

Rules:

- **Keep the slide's voice and density.** Replace a line with a line of similar length; a card that held two lines should still hold two.
- **Never retype a whole text box** — formatting lives on the runs; replace only the runs that change.
- **Names that must not wrap mid-word** (`research-assistant`, `system-design`): use the non-breaking hyphen `‑` in the replacement text.
- **Counts and lists come from the source of truth** — count the files, do not trust the old slide.
- **Leave text you do not understand** (a stray note, a fragment that might be deliberate) and ask the user about it instead of deleting it.
- Structural changes — adding, removing or reordering slides, moving shapes, changing charts — are a different job: unzip, change `ppt/presentation.xml` `<p:sldIdLst>` and the slide parts, keep every relationship and content-type entry consistent, and zip with `[Content_Types].xml` first.

## 4. Build a new deck

- Generate with `pptxgenjs` (Node) or `python-pptx`; set the layout size before adding slides (16:9 is 10" × 5.625" in pptxgenjs).
- Define the theme (heading and body fonts, colour palette) and slide layouts once, then fill slides from them, so the deck can be restyled in one place.
- One message per slide; every slide has a visual element (diagram, icon, chart, stat callout), not only bullets. Titles 36–44 pt, body 14–16 pt, at least 0.5" margins.
- Prefer fonts that ship with Office (Calibri, Arial, Cambria); never hex colours with `#` or alpha in pptxgenjs.
- Speaker notes go in notes, not in text boxes on the slide.

## 5. Render and look (required)

- **Windows with PowerPoint:** `pwsh -NoProfile -File "${CLAUDE_SKILL_DIR}/scripts/export-slides.ps1" -Deck <abs path> -OutDir <abs dir> -Slides 4,5`.
- **Elsewhere:** `soffice --headless --convert-to pdf deck.pptx`, then `pdftoppm -png -r 110 deck.pdf s`.

Open every changed slide image and check, in this order:

1. Text overflow or text cut off at a box edge.
2. A word, name or number split across lines (`agent-` / `manager`, `26` / `M`).
3. A box that grew a line and now crowds or overlaps its neighbour.
4. Leftover old names or counts anywhere on the slide.
5. Consistency with sibling slides (same title position, same card style).

Fix by shortening the text or using non-breaking hyphens, re-render only the changed slides, and stop when they are clean.

## 6. File checks (required)

- Every edited slide parses as XML (`pptx_replace.py` does this), and the output has the same parts as the input unless you changed structure on purpose.
- PowerPoint (or LibreOffice) opens the output and renders every changed slide — §5 proves this.
- When a full validator is available (for example the `pptx` skill's `validate.py`), run it with the original deck as the baseline.

## 7. Report

List per slide what changed and why (which source-of-truth fact it now matches), what you checked visually, and anything you deliberately left alone or that is still out of date elsewhere in the deck.
