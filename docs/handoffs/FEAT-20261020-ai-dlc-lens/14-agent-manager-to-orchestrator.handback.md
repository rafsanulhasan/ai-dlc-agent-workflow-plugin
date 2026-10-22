---
run: FEAT-20261020-ai-dlc-lens
work-item: ITEM-027, ITEM-028, ITEM-029
lifecycle: AI-DLC
step: 14
from: agent-manager
to: orchestrator
mode: subagent
loop: none
received: 2026-10-23 11:35
---

handoff 14-orchestrator-to-agent-manager.handoff.md: passed — record and artifacts match (worktree clean at 4f6fe46 apart from the orchestrator's run.md and record 14). The change is made. One check fails, as expected: AC6, a repository test that the brief did not let me edit.

AC1 done: root `.claude-plugin/marketplace.json` keeps `ai-dlc` unchanged and adds 4 entries after it: `ai-dlc-lens-spike-027` → `./spikes/ai-dlc-lens/027`, `spike028-ka` → `./spikes/ai-dlc-lens/028/spike028-ka`, `spike028-lens` → `./spikes/ai-dlc-lens/028/spike028-lens`, `spike029-avatars` → `./spikes/ai-dlc-lens/029`. Each description ends "Throwaway spike for FEAT-20261020-ai-dlc-lens; removed before the lens PR leaves draft."
AC2 done: `.github/plugin/marketplace.json` unchanged (diff empty). The build and the tests do not require the two marketplaces to match; the license test only looks up the `ai-dlc` entry in each.
AC3 done: `spikes/ai-dlc-lens/.claude-plugin/marketplace.json` deleted (working tree, not staged).
AC4 done: README.md and 027/028/029 CHECK.md now say: `claude plugin marketplace update ai-dlc-agent-workflow` → `claude plugin install <name>@ai-dlc-agent-workflow --scope local` → `/reload-plugins`. Teardown is `uninstall <name>@ai-dlc-agent-workflow --scope local`, and the docs say to keep the marketplace because it also serves ai-dlc. `<REPO>` is defined as the main checkout registered as the marketplace, which must be on `feat/ai-dlc-lens`. The README test block no longer runs `validate .` in the spikes folder; it validates the 4 plugins, and the marketplace is validated from the repository root.
AC5 done: `validate --strict .` failed at first: the 4 spike manifests had no `author`, and strict turns that warning into an error. I added `author {name: Rafsanul Hasan, url: github.com/rafsanulhasan}` to the 4 spike `plugin.json` files. Now `--strict .` gives "✔ Validation passed" and `--strict ./plugins/claude/ai-dlc` gives "✔ Validation passed". No icon was needed: the marketplace strict check does not flag a missing icon.
AC6 FAILED (1 test): build `--check` "up to date" (exit 0); `validate.mjs --check` "every step passed"; `workflow.mjs validate` "valid"; `node --test "tests/**/*.test.mjs"`: 531 tests, 528 pass, 1 fail, 2 skipped. The failing test is `tests/build-copilot-hooks-module.test.mjs:167`, "the cache-keepalive mod is folded into ai-dlc…". At line 170 it asserts `market.plugins.map(p=>p.name)` deep-equals `["ai-dlc"]`, so any extra entry in the root marketplace fails it. The brief forbids touching `tests/`, so it is left as is. Smallest fix, which keeps what the test checks (no leftover mod entry): change line 170 to `assert.ok(!market.plugins.some((p) => /claude-mods|cache-keepalive/.test(p.name)))`, or filter out `spike*` and `ai-dlc-lens-spike-*` names before the deepEqual. The other way to get green is to revert the marketplace entries. The orchestrator decides; a test change would be its own reviewed item.
AC7 done: `plugin validate --strict` passes for 027, spike028-ka, spike028-lens and 029; the only notes are informational (no icon, hooks-module notice). `plugin test` passes: 027 3/0, 028/spike028-lens 1/0, 029 4/0.
"required by spike028-lens" explained: `028/spike028-lens/.claude-plugin/plugin.json` declares `"dependencies": ["spike028-ka"]`, which is the dependency check 12.3/run5 relies on. Uninstalling the provider while the lens is still installed shows that warning; it is expected, not a fault. The docs now say to uninstall `spike028-lens` before `spike028-ka`. Both are in the same marketplace, so the bare dependency name still resolves.
Note: the JSON rewrite reformatted `029/plugin.json` (it was on one line) and the lens `dependencies` array onto separate lines. The content is unchanged apart from `author`. Line endings were kept. I committed, installed and uninstalled nothing.

Changed paths:
- .claude-plugin/marketplace.json (code)
- spikes/ai-dlc-lens/.claude-plugin/marketplace.json (code, deleted)
- spikes/ai-dlc-lens/027/.claude-plugin/plugin.json (code)
- spikes/ai-dlc-lens/028/spike028-ka/.claude-plugin/plugin.json (code)
- spikes/ai-dlc-lens/028/spike028-lens/.claude-plugin/plugin.json (code)
- spikes/ai-dlc-lens/029/.claude-plugin/plugin.json (code)
- spikes/ai-dlc-lens/README.md (docs)
- spikes/ai-dlc-lens/027/CHECK.md (docs)
- spikes/ai-dlc-lens/028/CHECK.md (docs)
- spikes/ai-dlc-lens/029/CHECK.md (docs)
(all under E:\Projects\personal\ai-dlc-agent-workflow-plugin\.worktrees\ai-dlc-lens)
Intent: the human wants the four throwaway lens spike plugins installable from the repository's own `ai-dlc-agent-workflow` marketplace (Claude only, local scope, main checkout on feat/ai-dlc-lens) instead of a separate `ai-dlc-lens-spikes` marketplace; the spike docs are updated to match.
Checks: validate --strict . PASS; validate --strict ./plugins/claude/ai-dlc PASS; build-copilot --check PASS; validate.mjs --check PASS; workflow.mjs validate PASS; node --test 528/1 fail/2 skip (FAIL: build-copilot-hooks-module.test.mjs:167, pins the root marketplace to ["ai-dlc"]); 4 spikes validate --strict PASS; plugin test 027 3/0, spike028-lens 1/0, 029 4/0.
