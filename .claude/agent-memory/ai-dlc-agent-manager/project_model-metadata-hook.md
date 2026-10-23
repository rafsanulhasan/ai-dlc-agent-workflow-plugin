---
name: model-metadata-hook
description: model-metadata hook (2026-10-23, renamed from model-costing): the reasons behind never-estimate, interval 0, per-user back-off stamp, all-or-nothing API limits, no git hook
metadata:
  type: project
---

Reasons behind the `model-metadata` skill and project hook (run AAW-20261023-model-costing-hook; the human renamed it from `model-costing` on 2026-10-23 because it fetches all model metadata, not only prices). The behaviour itself is in the skill and its schema; this keeps only the why.

- **Never estimate** (human, binding): consumers must not show a guessed cost or limit; a `null` limit is hidden, not shown as 0 or a dash.
- **Refresh interval 0** (human, 2026-10-23: "every run and commit"): the file must be current at every stop and commit. The 10-minute back-off after a failure stays, so an offline machine does not hit the network on every stop.
- **Back-off stamp in the user's cache directory** (`$XDG_CACHE_HOME`, else `%LOCALAPPDATA%` on Windows, else `~/.cache`, then `ai-dlc/`), not under `.ai-dlc/`: nothing uncommitted lands in the repository and no ignore rule is needed. Moved out of the OS temp directory in fix round 4 (code review): a predictable name in a shared temp dir lets another user plant a file or symlink there; a per-user folder removes that, simpler than an `lstat` + `wx` write.
- **Models API is all or nothing** (fix round 4): a failed page, the shared 20 s deadline, or the 10-page cap with `has_more` still true all discard the list, so the keep rule applies. `redirect: "error"` keeps the key on api.anthropic.com. `limit=1000` is the documented maximum (platform.claude.com/docs/en/api/models/list: "Ranges from 1 to 1000").
- **Max input tokens from the Models API only with `ANTHROPIC_API_KEY`** (human, 2026-10-23): the docs pages currently state none. The key is optional and never leaves the call to `api.anthropic.com`; the API only fills a `null`, never a docs figure.
- **Keep old API values** (human, 2026-10-23): with no key or a failed API call, figures an earlier run filled (old `sources.modelsApi`) are kept, so the committed file does not flip between developers with and without the key. A fresh API answer or a docs figure replaces them.
- **Models API headers unverified live**: the script sends `x-api-key` + `anthropic-version: 2023-06-01`; the docs' curl examples show `Authorization: Bearer` and a newer `anthropic-version`. A 401/400 may mean the headers, not the key; confirm before blaming the key.
- **Long-context override only recorded**, not applied: consumers apply it, so the file keeps the docs' threshold.
- **No git pre-commit hook** (rejected): `.git/hooks` is not versioned, it clashes with Husky / `core.hooksPath`, and it would put a network call in every developer commit.
- **Copilot `preToolUse` payload shape** (`toolArgs` as a string or an object) was not verified live; the script accepts both. Copilot documents no project-root variable, hence `"cwd": "."` on its entries.

**Why:** the ai-dlc-lens spike reads costs and context windows from this file.

**How to apply:** keep "never estimate" when touching the parser or schema; if the Copilot payload is ever confirmed, record its shape here. Related: [[harness-sync-command]].
