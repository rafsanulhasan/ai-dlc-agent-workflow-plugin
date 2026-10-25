# Third-party notices: ai-dlc-lens

This plugin holds no third-party code yet. Its code is the spike ITEM-027 code, written in this repository.

The lens design takes code from four upstream projects (story US-18 of `docs/product/ai-dlc-lens/stories.md`): savvy-progress (MIT), cache-tax (MIT), context-view (MIT) and agent-flow (Apache-2.0). Their attributions land with the build waves that copy that code: each upstream's `LICENSE` (and agent-flow's `NOTICE`, if it has one) beside the code taken from it, a notice per upstream in the repository's `THIRD_PARTY_NOTICES.md`, and every change to upstream code listed in this plugin's `ATTRIBUTION.md`.

## foyzulkarim/claude-lens (Cache Lab formulas)

The Cache Lab (`hooks/cache-lab.ts`, `hooks/cache-reader.mjs`) reuses formulas of [claude-lens](https://github.com/foyzulkarim/claude-lens): Saved by cache, Lost to busts (modified: each cache write is priced at its TTL's write rate), NET, the miss attribution (TTL lapse, Prefix change, Unknown, with its compaction rule) and the TTL mix. No claude-lens code is copied; the formulas are written anew. Cache Hit % (token-weighted), Tokens Saved (cache-read tokens) and Median baseline (a true median) deliberately differ from claude-lens. Each formula taken is listed in `ATTRIBUTION.md`. claude-lens is distributed under the following licence:

```text
MIT License

Copyright (c) 2026 Foyzul Karim

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
