---
name: model-metadata
description: "Installs the AI-DLC model metadata hook into the current repository: .ai-dlc/model-metadata.json with its schema, holding every Anthropic model's prices (input, output, 5-minute and 1-hour cache writes, cache reads, batch, fast mode, long-prompt tier) and limits (context window, max input and output tokens), read from Anthropic's official docs pages (and, with ANTHROPIC_API_KEY set, the Models API for limits the docs leave out) and never estimated, plus a project hook that refreshes it when the agent stops and before a `git commit` the agent runs (Claude Code Stop and PreToolUse, GitHub Copilot agentStop and preToolUse). Called by init in every repository; run it directly to add, repair, refresh or remove it. Any stack."
disable-model-invocation: true
---

# Model metadata

Tools that report what an agent run cost (such as a session dashboard) compute it from `.ai-dlc/model-metadata.json` only: a model missing from the file has no cost, never a guessed one. This skill installs the file and the hook that keeps it current. The hook is a project hook, not a plugin hook: it lives in the repository's own `.claude/settings.json` and `.github/hooks/`. The files come from `templates/`.

## When to use

- `init` follows this skill in every repository, whatever the stack.
- The user asks to add, repair, refresh or remove the model metadata file or its hook.

## What the hook does

`update-model-metadata.mjs` is a dependency-free Node.js script (Node.js 18 or later; Windows, macOS and Linux). It reads three Anthropic docs pages in their Markdown form, plus one page per model:

| Page | What it gives |
|---|---|
| `https://platform.claude.com/docs/en/about-claude/pricing` | Every price: the "Model pricing", "Batch processing" and "Fast mode pricing" tables. Required. |
| `https://platform.claude.com/docs/en/models/overview` | The links to each model's page. |
| `https://platform.claude.com/docs/en/models/<model>/overview` | The model's API ID and alias, context window, any larger context window, max input and max output tokens. |
| `https://platform.claude.com/docs/en/about-claude/model-deprecations` | Status of every model (active, deprecated, retired); the API ID and aliases where a model has no page. |
| `https://api.anthropic.com/v1/models` (Models API), only when `ANTHROPIC_API_KEY` is set | `max_input_tokens` and `max_tokens` of each model the key can see, used only to fill a limit the docs leave `null`. |

Each model gets its API ID and aliases, status, the pricing page's note, the four limits (`contextWindow`, `longContextWindow`, `maxInputTokens`, `maxOutputTokens`), the standard prices (input, output, 5-minute and 1-hour cache writes, cache reads, plus batch input and output and fast mode input and output, `null` where the docs give none), `longContextPricing` and `sources`.

A figure no source states is `null`: when a page states no max input tokens or no separate long-context window, that figure is `null`, and a retired model has no page, so its limits are `null`. A model priced by prompt length gets the prices of the longer prompts in `longContextPricing`, with the prompt size above which they apply in its own field, `longContextPricing.thresholdTokens` (`null` when the page names long-context prices but no threshold). Each entry records the page its figures came from. The format is in `templates/model-metadata.schema.json`.

**Limits from the Models API.** The docs pages currently state no max input tokens. When `ANTHROPIC_API_KEY` is set in the hook's environment, the hook also calls `GET https://api.anthropic.com/v1/models?limit=1000` (1000 is the documented maximum page size; headers `x-api-key` and `anthropic-version: 2023-06-01`; it follows `has_more` and `last_id` for up to 10 pages and never follows a redirect, so the key cannot be sent to another host) and fills a `null` limit of each model whose `id` or an alias the API lists: `maxInputTokens` from `max_input_tokens`; `contextWindow`, when no page states one, taken to equal `max_input_tokens`; `maxOutputTokens`, when no page states it, from `max_tokens`. A figure from a docs page is never replaced. The model's `sources.modelsApi` lists the fields filled this way (empty when none). These headers have not been checked against the live API: the docs' curl examples send `Authorization: Bearer` and a newer `anthropic-version`, so a 401 or 400 may mean the headers are wrong rather than the key. The key is sent only to `api.anthropic.com` and is never printed or written. Without the key the hook makes no such call, and when the call fails (an invalid key, a timeout, a redirect, or 10 pages read with more still to come: a partial list is never used) the refresh still succeeds; in both cases each figure an earlier run filled from the API (listed in the old file's `sources.modelsApi`) is kept, so the file does not change between runs with and without the key. Limits no run has filled stay `null`. A fresh API answer replaces the kept figures (a model it no longer lists goes back to `null`), a docs figure that appears replaces the API one and leaves `sources.modelsApi`, and a model gone from the pricing page drops out as before.

It runs:

- **When the agent stops** (Claude `Stop`, Copilot `agentStop`), as its own hook entry, so it runs in parallel with the other stop hooks.
- **Before a `git commit` the agent runs** (Claude `PreToolUse` on `Bash`, Copilot `preToolUse`), with `--before-commit`: it exits at once for any other command. When the file changes there, the hook says so, and the file is not staged: add it to include it in the commit. Copilot's `preToolUse` has no command filter, so on Copilot node starts on every tool call, and the script then exits at once unless the call is a `git commit`. A command that only mentions `git commit` in quoted text (`echo "git commit"`) also counts; that costs one refetch at most and is harmless.

It never blocks. On a network error, a page that changed shape or a result that fails its checks, it keeps the old file, prints one line and exits 0. Each docs request times out after 10 seconds, and the Models API call, all its pages together, after 20 seconds; that call runs alongside the docs requests, so a run takes about 20 seconds at most, well inside the hooks' 60-second timeout. It makes network calls to `platform.claude.com` only, plus `api.anthropic.com` when `ANTHROPIC_API_KEY` is set.

**Refresh interval:** none by default (`0`): the hook refetches at every stop and before every `git commit` the agent runs, so the file is current when work ends and when it is committed. `AI_DLC_MODEL_METADATA_MAX_AGE_MINUTES=<n>` sets an interval, measured from the file's modification time: refetches within `n` minutes of the last one are skipped. A refetch that finds the same figures does not rewrite the file, so the file changes only when Anthropic's figures do; it only touches the modification time. A run without the key, or whose Models API call fails, keeps the figures an earlier run filled from the API, so it is no change either.

**After a failure** (no network, a page that changed shape, a file it cannot write) it makes no new attempt for 10 minutes, whatever the interval, so an offline machine does not call the network at every stop. It records the failure time in a stamp in the user's own cache directory, `<cache>/ai-dlc/model-metadata-<hash of the repository root>.retry`, where `<cache>` is `$XDG_CACHE_HOME` when set to an absolute path, else `%LOCALAPPDATA%` on Windows, else `~/.cache`, and deletes it after the next successful refresh; nothing is written into the repository. The stamp is per user rather than in the shared temp directory, so another user of the machine cannot plant a file or link at its path. When none of the three can be found, there is no stamp and no back-off. `--force` ignores the stamp and the interval.

Settings, in the environment (or the `env` of `.claude/settings.json`): `AI_DLC_MODEL_METADATA=off` turns it off; `AI_DLC_MODEL_METADATA_MAX_AGE_MINUTES=<n>` sets a refresh interval in minutes (default `0`: every run; anything else that is not a number of 0 or more, such as a negative, empty or non-numeric value, means `0`); `AI_DLC_MODEL_METADATA_LONG_CONTEXT_THRESHOLD_TOKENS=<n>` sets one long-context threshold for every model. The hook does not apply that override: it records it in the file as `longContextThresholdTokensOverride` (a positive integer; unset or anything else is `null`), and the file picks up a change at its next refresh (`--force` for at once). `ANTHROPIC_API_KEY` turns on the Models API limits (see above).

**Reading the file.** To find a model a platform names differently, drop an `anthropic.` prefix, a `-v1` or `-v1:0` suffix, an `@YYYYMMDD` suffix and a `[1m]` suffix, then match `id` or `aliases`. Cost per request = tokens × price ÷ 1,000,000 for each token kind. Do not show a limit that is `null` (the docs pages currently state no max input tokens, so `maxInputTokens` is `null` unless the Models API filled it, in this run or an earlier one): leave it out rather than show 0, a dash or a guess.

**Long prompts.** For a model whose `longContextPricing` is not `null`, the threshold is `longContextThresholdTokensOverride` when that is not `null`, else `longContextPricing.thresholdTokens`. A request whose prompt (all input tokens, cache reads and cache writes included) is over the threshold is charged at `longContextPricing` for all its tokens; any other request at `pricing`. When both are `null`, which rates apply is unknown for any prompt, however short: show the cost as unknown, never a guess. The override has no effect on a model whose `longContextPricing` is `null`.

## Install

1. Confirm `node` is on PATH.
2. Copy `templates/update-model-metadata.mjs` to `.claude/hooks/update-model-metadata.mjs` and `templates/model-metadata.schema.json` to `.ai-dlc/model-metadata.schema.json`. If a file exists and differs, show a diff and write only with consent.
3. **Claude Code:** merge `templates/claude-hook.json` into `.claude/settings.json`: append its `Stop` entry to `hooks.Stop` and its `PreToolUse` entry (matcher `Bash`) to `hooks.PreToolUse`, as entries of their own, never inside an existing entry. Never drop existing hooks, and do not add an entry twice (match on `update-model-metadata.mjs` in the command). The commands name the script as `"${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/update-model-metadata.mjs"`, so they still work after the agent's shell has changed directory.
4. **GitHub Copilot:** write `templates/copilot-hook.json` to `.github/hooks/ai-dlc-model-metadata.json` (create `.github/hooks/` if needed). Both platforms run the one script in `.claude/hooks/`. Copilot documents no project-root variable, so each entry sets `"cwd": "."` (relative to the repository root) and `${CLAUDE_PROJECT_DIR:-.}` falls back to it. Its `bash` commands are the Claude ones, so the harness sync (`.claude/scripts/sync-harness.mjs`) sees the pair as in sync.
5. Seed the file: `node .claude/hooks/update-model-metadata.mjs --force` (a run with `--force` reads no hook payload). Done when it exits 0 and `.ai-dlc/model-metadata.json` exists. It prints `created` or `updated` only when the file changed; a refetch that finds the same figures prints nothing, and that is fine. Offline, it prints why and writes nothing; the hook creates the file on the first stop with a connection (after a failure it waits 10 minutes before the next try). Never write the file by hand.

A re-run is safe: identical files are skipped, hook entries are not added twice, and the seed refetches.

## Remove

After showing the user what will be removed: delete the `update-model-metadata.mjs` entries from `hooks.Stop` and `hooks.PreToolUse` in `.claude/settings.json`, delete `.github/hooks/ai-dlc-model-metadata.json` and `.claude/hooks/update-model-metadata.mjs`. Keep `.ai-dlc/model-metadata.json` and its schema unless the user asks to delete them too; nothing refreshes them afterwards. To pause the hook without removing it, set `AI_DLC_MODEL_METADATA=off`.

## Report

List each file created or changed, the number of models in the file and its `fetchedAt`, or the line the seed printed when it could not fetch. Say that the hook calls `platform.claude.com` every time the agent stops and before every `git commit` the agent runs (at most every 10 minutes while it fails; `AI_DLC_MODEL_METADATA_MAX_AGE_MINUTES` sets an interval), that with `ANTHROPIC_API_KEY` set it also calls `api.anthropic.com` to fill the max input tokens, which otherwise stay `null`, and that `AI_DLC_MODEL_METADATA=off` turns it off and **Remove** takes it out.
