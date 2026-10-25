# ADR-0006: Cache Lab computes its figures from the project's transcripts, read by a child-process reader

**Date**: 2026-10-25
**Status**: Proposed (awaiting the combined G1+G2+G3 stop)
**Deciders**: the human (2026-10-25: the Cache Lab shows what claude-lens's Cache Lab shows, prices come from `.ai-dlc/model-metadata.json`, and the claude-lens formulas are reused under MIT); product-owner (17.1.10, Decision 3: the lens computes, and keep-alive publishes nothing new); software-architect (the reader, the process boundary and the data access)

## Context

The ai-dlc-lens Cache Lab (root 22, ITEM-069 to 072) shows savings, busts, hit %, miss attribution, TTL mix and a gallery of busts. It covers every session of the project, not only the live one.

Three sources were available:
- keep-alive's published ledger;
- `$.session.messages`;
- the transcript files under `<config>/projects/<project>/`.

The transcript folder has a main file per session, `<uuid>.jsonl`, and a file per sidechain, `<uuid>/subagents/agent-<id>.jsonl`. It sits outside the repository. In this repository it holds 609 files, 754 MB in all. 16 of the files are over 4 MiB, the largest 10.5 MB, and those are the main sessions, which matter most.

The mods API caps `$.fs.read` at 4 MiB per file and has no range read (`claude-code.d.ts`:3309-3317). `$.process.run` caps stdout at 4 MiB (d.ts:8237).

One API response is written as several rows, one per content block, each carrying the same `message.id` and the same `usage`. The largest file has 182 duplicated ids.

## Decision

We will compute every Cache Lab figure inside the lens from the project's transcript files. The files are read by a dependency-free `node` child process, the **reader**, which returns only numeric usage records, never transcript content. The lens holds no Cache Lab data of its own and reads none from keep-alive.

- **Folder.** The folder is the parent of `transcript_path`, taken from the first classic event the lens module sees: `classic.SessionStart`, else `classic.Stop` or `classic.UserPromptSubmit`. This follows `CLAUDE_CONFIG_DIR` and needs no guess at how Claude Code turns a cwd into a folder name. With no event seen yet, the Cache Lab shows "transcripts not located yet", not a figure.
- **Reader.** The script ships in the lens plugin (path set by the LLD). It runs as `$.process.run(['node', <script>, …])`.
  - It streams each `.jsonl` line by line, so the 4 MiB read cap does not apply.
  - It skips lines that are not JSON, or that carry no usage (Q-CL6), and counts them.
  - It dedupes calls by `message.id`.
  - For each call it emits only these fields:
    - `sessionId` and the stream (main, or an `agentId`);
    - the timestamp and the model id;
    - the token fields `in`, `out`, `cr`, `cc`, `cc5m` and `cc1h`;
    - for bust candidates only, the prompt id and the turn number, so the gallery can show a text label (Q-CL7 option b, human accepted 2026-10-25); never prompt text.
  - It writes the `{ data, error }` envelope to stdout.
- **Bounded output.**
  - The protocol is paged or windowed so that one run stays under the 4 MiB stdout cap.
  - `isStdoutTruncated` is an error shown as a reason, never a partial figure.
  - A file whose mtime is before the window start holds no call in the window, so it is not read. A session's stream is always read whole, because its first call and baseline need its earlier calls.
- **Cache.** The module keeps each file's records in memory for the session, keyed by `(path, size, mtimeMs)`. Only new or changed files are sent to the reader.
- **Pure core.** Classification and aggregation (spec L3 and L4) are one pure function in the lens's TypeScript, `(calls, prices, window) → CacheLab`, and are tested with fixtures by `plugin test`. The reader only extracts.
- **Prices.** Prices come from the lens's existing model metadata path:
  - the file is the `costingPath` setting (default `.ai-dlc/model-metadata.json`, relative to the session's cwd), loaded by `loadCosting` (`hooks/register.tsx`:659);
  - a model id is matched by `lookupModel` (`hooks/lens.ts`:279): lower case, with `[1m]` and a trailing `-YYYYMMDD` dropped, against each entry's `id` and `aliases`;
  - no match means the model is unpriced.

  Writes are priced by TTL part, a write of unknown TTL at the 5m rate (Q-CL1, human accepted 2026-10-25).
- **Formulas.** Saved by cache, Lost to busts, NET, miss attribution and TTL mix reuse the claude-lens (MIT, © 2026 Foyzul Karim) formulas. Cache Hit %, Tokens Saved and Median baseline deliberately differ: see `cache-and-context-lab/stories.md`, *Terms*. The notice goes in `plugins/claude/ai-dlc-lens/NOTICE.md` and the repository's `THIRD_PARTY_NOTICES.md`. Each formula taken goes in a new `plugins/claude/ai-dlc-lens/ATTRIBUTION.md`. Lost to busts is recorded there as *modified: each cache write priced at its TTL's write rate* (Q-CL1), not as taken unchanged.
- **The chain (amended 17.1.31, ADR-0007).** The one value the lens reads from keep-alive is the published `chain` (`{ id, sessions }`): which sessions an automatic-handoff chain joins into one session, for the "This session" preset and the kept window. It is identity, not Cache Lab data, and it is optional: with no published value, the lens uses its own session only. Every figure still comes from the transcripts.

## Alternatives Considered

- **Keep-alive's published ledger (`$.state` keepalive, its `caches`).**
  - It is live and covers one session, while the Cache Lab covers history across sessions.
  - It would couple two plugins' release cycles.
  - It would make keep-alive publish data only the lens uses.

  The product-owner withdrew the `mix?` field for these reasons (17.1.10).
- **Reading the files in the module with `$.fs.read`.**
  - It fails on every file over 4 MiB, which here are the 16 largest main sessions.
  - Skipping them would silently understate every figure.
- **`$.session.messages`.**
  - It covers the current session only, at most 4096 entries.
  - It gives no history.
- **Deriving the folder from the cwd and `HOME`.** It depends on Claude Code's undocumented rule for turning a path into a folder name, and on how the config directory is resolved. We keep it only as a possible later fallback, not as the main path.
- **Copying the claude-lens Cache Hit %, "Tokens saved" and baseline as they are.** Rejected by the human and the product-owner:
  - claude-lens's hit % bucket sum is suspect;
  - its "Tokens saved" shows dollars;
  - its baseline is a mean of medians.

  Recorded here so that nobody "fixes" the lens to match claude-lens.

## Consequences

### Positive
- The Cache Lab covers every session and subagent of the project, the largest transcripts included.
- No transcript text leaves the reader: the module and the UI see only numbers, ids and timestamps (AC-22.4.7).
- Keep-alive and the lens stay independent, so the lens lane does not wait for T17.3. The optional `chain` read (ADR-0007) adds no build-order edge: without it, "This session" is the lens's own session.
- Pricing reuses code that is already reviewed. The only change is a per-TTL write price, which also makes Lost to busts a modified claude-lens formula (ATTRIBUTION.md says so).

### Negative / Trade-offs
- The Cache Lab needs `node` on PATH, as diagrams do (ADR-0005). Without it, the accordion shows the reason.
- The first open with a wide window reads up to every transcript, about 750 MB here, which takes seconds. Later opens read only changed files. The cache does not survive a module restart.
- The reader depends on undocumented transcript fields: `message.usage`, `cache_creation.ephemeral_5m_input_tokens`, `ephemeral_1h_input_tokens`, `isSidechain` and `message.id`. A Claude Code format change breaks it. The lens shows the reason and counts the skipped lines; it never invents figures.
- The lens reads files outside the repository. It reads only the folder that `transcript_path` names, and has no setting to point it elsewhere.
- The plugin ships one more licence notice (claude-lens, MIT).

### Neutral
- The reader's stdout uses the `{ data, error }` envelope.
- Long-context price tiers are not applied in the Cache Lab (Q-CL8, deferred).

## Compliance Checklist

- [x] Affected components:
  - `plugins/claude/ai-dlc-lens/hooks/register.tsx` (folder capture, reader call, accordion);
  - `hooks/lens.ts` (pricing per TTL);
  - a new pure Cache Lab module and the reader script (the LLD names them);
  - `NOTICE.md`, a new `ATTRIBUTION.md`, `THIRD_PARTY_NOTICES.md`, `MANUAL-CHECKS.md`.
- [x] Related ADRs: ADR-0005 (the same child-process pattern; this reader needs no vendored bundles, so it does not wait for root 20); ADR-0007 (the automatic-handoff chain is one session).
- [x] `{ data, error }`: on the reader protocol.
- [x] No stack traces exposed: reader errors are one line.
- [ ] DI registration: not applicable (hooks module).
- [x] No ADR superseded.
