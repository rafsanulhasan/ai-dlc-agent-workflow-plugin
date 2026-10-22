# Spike 029 (ITEM-029): avatar images and the Svg scrub — manual check

Throwaway mod `spike029-avatars`. Nothing here ships. It answers: do avatar images (a `data:` URI per media type and size, a file path) draw in the mod pane on VS Code and in the terminal `Image` element, and do Svg `<style>`, `<marker>` and `<image>` survive the host's scrub. The result sets `avatarImageTypes` and `avatarImageMaxBytes` (stories `:473-474`) and AC-13.3 / 13.5 / 13.8.

Built and checked on Claude Code 2.1.308, Windows 11, Node 24.11.1. It is deleted before the lens PR leaves draft.

`<REPO>` is the main checkout of this repository, the folder registered as the `ai-dlc-agent-workflow` marketplace (`CLAUDE.md`), switched to the `feat/ai-dlc-lens` branch. `<SPIKES>` = `<REPO>\spikes\ai-dlc-lens`; `<SPIKE>` = `<SPIKES>\029`, this plugin.

## Folder

| Path | What |
|---|---|
| `.claude-plugin/plugin.json` | manifest, name `spike029-avatars` |
| `hooks/hooks.json` | `{ "modules": ["./register.tsx"] }` |
| `hooks/register.tsx` | commands `/spike029` and `/spike029-overcap`, the two panes |
| `hooks/cells.ts` | the Svg cells, pure data |
| `assets/` | test images, written by `tools/gen-assets.mjs` |
| `tools/gen-assets.mjs` | regenerates `assets/` (PNG and WebP in Node; JPEG and GIF through `pwsh` System.Drawing, Windows) |
| `tests/spike029.test.tsx` | engine-level checks, `claude plugin test` |
| `typecheck/` | tsconfig for `tsc`; copy the engine types in first (`<SPIKES>\README.md`) |

Assets (all 48x48 except the ladder, which is 32 px wide RGB noise, stored uncompressed):

| File | Bytes | Base64 chars | Look |
|---|---|---|---|
| `avatar.png` | 129 | 172 | blue/orange quadrants |
| `avatar.jpg` | 1,317 | 1,756 | green with a white circle |
| `avatar.gif` | 1,506 | 2,008 | red with a yellow circle |
| `avatar.webp` | 34 | 48 | solid purple (lossless VP8L) |
| `size-4k.png` … `size-140k.png` | 2,978 / 23,930 / 47,986 / 71,174 / 97,849 / 104,935 | 3,972 / 31,908 / 63,984 / 94,900 / 130,468 / 139,916 | colour noise |

All four avatar files decode with Windows WIC (48x48, top-left pixel as drawn).

## Automated checks (run from this folder)

```text
node tools/gen-assets.mjs                                   # only to regenerate assets/
claude plugin validate .                                    # ✔ passed (warnings: no author, no icon)
npx -y -p typescript@5 tsc -p typecheck                     # exit 0
claude plugin test .                                        # 4 pass, 0 fail
MSYS_NO_PATHCONV=1 claude -p --plugin-dir "<this folder>" "/spike029"
#   -> "spike029-avatars: Spike 029 pane opened (isPlaced: false)."  (headless: no surface places it)
```

Validate, `tsc` and the tests were re-run from `spikes/ai-dlc-lens/029/` on the branch, with the same results. The headless load was run once, from the first location.

What the engine itself decides (from `claude plugin test`; the kit never paints, so the host's scrub is not visible here):

- E1. vscode and desktop accept a tree of 27 `Svg` elements, each ≤ 130,734 chars, holding `<style>`, a `style=""` attribute, `<marker>`, `<image href="data:…">`, `<image xlink:href="data:…">`, `<image href="file:///…">`, `<script>` and `onload=`. The markup reaches the surface **unchanged**: any scrub is the surface's (the test logs every probe `true`).
- E2. An `Svg` source past 131,072 chars refuses the **whole tree**: `returned a tree Pane refuses: Svg source longer than 131072 characters`; the hook is skipped and nothing of the pane draws.
- E3. The terminal accepts `Image` with `{ file, format: 'png' }` and with `{ png: <base64> }`. A `{ png }` whose bytes do not start with the PNG signature refuses the **whole tree**: `Image "t2" source.png does not start as a PNG file does` (seen with filler bytes before the stub was fixed).

## Load it

### VS Code (Claude Code extension 2.1.299 or later)

Main route: the repository's own marketplace, `ai-dlc-agent-workflow`, read from `<REPO>`, which must be on `feat/ai-dlc-lens`.

1. In a terminal at `<REPO>`: `claude plugin marketplace update ai-dlc-agent-workflow`, then `claude plugin install spike029-avatars@ai-dlc-agent-workflow --scope local`.
2. Run `/reload-plugins` in an open Claude Code session, or open a new one in VS Code.
3. In the chat, type `/spike029`. It answers `Spike 029 pane opened (isPlaced: true)` and the pane **Spike 029 avatars** opens.
4. Widen the pane so cells sit 3–4 per row. Read each cell against the table below.
5. Then `/spike029-overcap` for S26.

The installed copy does not follow edits under `<SPIKE>`: after a change, uninstall and install again (the version stays `0.1.0`), then `/reload-plugins`. Cells S10–S13 point at `assets/avatar.png` in the folder the plugin was loaded from (the installed copy, on this route).

Alternative, only if the marketplace route fails: add `"CLAUDE_CODE_PLUGIN_DIRS": "<SPIKE>"` to the `env` block of `~/.claude/settings.json` (user settings; a project's settings are not read for this), with each `\` written as `\\`, merged with any `env` already there (separate several folders with `;`). Restart VS Code, run steps 3–5, then **remove** the entry.

If the pane does not open, check the transcript for a dim line starting `spike029-avatars:` and copy it into the result.

### Terminal

```text
claude --plugin-dir "<SPIKE>"
```

With the marketplace copy installed, plain `claude` loads it too; do not use both at once.

Then `/spike029` (in Git Bash use `MSYS_NO_PATHCONV=1` or type it inside the session, not as a CLI argument). The pane needs ≥ 110 columns to seat unasked; it seats at any width when opened by the command. Use a terminal that draws images (Windows Terminal 1.22+ with Sixel, WezTerm, kitty, iTerm2); note which one.

## Manual checks — VS Code pane

Every image cell is a grey square with a **red diagonal behind the image**: if the image draws it covers the diagonal; a visible diagonal means not drawn. "(interactive)" cells use `isInteractive: true` (sandboxed frame instead of an image).

| # | Cell | Expected if it works | Design meaning | Result |
|---|---|---|---|---|
| 1 | S0 control: plain Svg | green square "OK" | Svg draws at all on this surface; if not, stop: every other cell is void | |
| 2 | S0b initials badge | blue circle, white "MR" | the fallback renders (AC-13.1) | |
| 3 | S1 `data:image/png` | blue/orange quadrants, no diagonal | `image/png` in `avatarImageTypes` | |
| 4 | S2 `data:image/jpeg` | green with white circle | `image/jpeg` in `avatarImageTypes` | |
| 5 | S3 `data:image/gif` | red with yellow circle | `image/gif` in `avatarImageTypes` | |
| 6 | S4 `data:image/webp` | solid purple | `image/webp` in `avatarImageTypes` | |
| 7 | S5–S8 same four, interactive | as 3–6 | whether the lens needs `isInteractive` for images; prefer the image mode if both work | |
| 8 | S9 png via `xlink:href` | as 3 | which attribute the lens writes (`href` preferred) | |
| 9 | S10 `file:///<plugin folder>/assets/avatar.png` | as 3 | AC-13.3: a trusted file path can draw directly; if not, the lens must read the file and inline it as a data URI | |
| 10 | S11 bare path `<plugin folder>/assets/avatar.png` | as 3 | same; expected to fail | |
| 11 | S12–S13 file URL / bare path, interactive | as 3 | same, in the sandboxed frame | |
| 12 | S14 png 2,978 B (Svg 4,238 ch) | noise, no diagonal | size ladder: the largest that draws sets `avatarImageMaxBytes` | |
| 13 | S15 png 23,930 B (Svg 32,174 ch) | noise | ladder | |
| 14 | S16 png 47,986 B (Svg 64,250 ch) | noise | ladder | |
| 15 | S17 png 71,174 B (Svg 95,166 ch) | noise | ladder | |
| 16 | S18 png 97,849 B (Svg 130,734 ch, 338 under the cap) | noise | ladder top: the engine bound | |
| 17 | S19 `<style>` element | **green**; red = stripped | the lens may style nodes with a `<style>` block, else inline attributes | |
| 18 | S20 `style=""` attribute | **green**; red = stripped | fallback styling route | |
| 19 | S21 `<marker>` arrows vs S22 reference | heads on both ends of the lower line and the right end of the upper, as S22 | arrowheads and the two-way loop arrow may use `<marker>`; else draw heads as paths (S22 shows that always works) | |
| 20 | S23 `<marker>`, interactive | as S22 | same, in the frame | |
| 21 | S24 `<style>`, interactive | green | same, in the frame | |
| 22 | S25 scrub probe (`<script>`, `onload`) | brown square, nothing else | the scrub is active and does not drop the whole Svg for a forbidden part | |
| 23 | `/spike029-overcap` → S26 (Svg 140,182 ch) | pane empty or closed; transcript dim line `Svg source longer than 131072 characters` | confirms E2 on the live host: one oversize avatar blanks the whole pane, so the lens must check length before drawing | |

Optional, if the desktop app is at hand: repeat 1–22 there (`CLAUDE_CODE_PLUGIN_DIRS` works the same way).

## Manual checks — terminal

| # | Cell | Expected if it works | Design meaning | Result |
|---|---|---|---|---|
| 24 | T1 `Image` `{ file, format: 'png' }`, avatar.png | blue/orange quadrants; dim "T1 not drawn" = not drawn | AC-13.3 terminal path: a trusted file path draws | |
| 25 | T2 `Image` `{ png }` from the data-URI bytes | as T1 | a `data:image/png` URI can draw on the terminal after decoding (AC-13.5 now says always initials) | |
| 26 | T3 `Image` file, 71,174 B png | noise | larger files draw (the bound is 2 MiB) | |
| 27 | T4 initials badge | " MR " white on blue | fallback renders | |

Record the terminal emulator and version next to 24–27; a terminal without an image protocol shows the alt text, which is itself a result ("initials needed on this terminal").

## How the result sets the settings

- `avatarImageTypes` = the media types whose rows 3–6 pass (image mode). Spec default stays `image/png` if only PNG passes.
- `avatarImageMaxBytes` (Svg surfaces) = the decoded size of the largest ladder row (12–16) that draws, rounded down. The engine bound alone allows about 97,800 B of PNG in an Svg of this shape (row 16); the lens adds its own markup, and if several avatars share one Svg (the whole graph as one element) they share the 131,072 chars. So: one Svg per avatar → up to 65,536 B is safe; avatars inside one graph Svg → divide the budget by the node count, or draw avatars as separate elements.
- The terminal `Image` keeps its own 2 MiB bound (file path or PNG bytes).
- Rows 9–11 decide whether a file path is drawn by reference or read and inlined as a data URI (then it falls under the same byte limit).
- E2 and E3: a bad avatar refuses the whole pane, not just its node. The lens must validate type (magic bytes), size and the final Svg length before it draws, and fall back to initials.
