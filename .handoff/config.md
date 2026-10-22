# Handoff Config

## Verification Commands
test:      node --test "tests/**/*.test.mjs"
typecheck:
lint:      node tools/build-copilot.mjs --check
build:     node tools/build-copilot.mjs

## Conventions
response_language: en
handoff_dir:       .handoff
commit_style:      conventional
convention_docs:   .claude/rules/

## Project Documentation Index

### Agent guidance
- [CLAUDE.md](CLAUDE.md) — root agent rules
- [AGENTS.md](AGENTS.md) — agent-agnostic rules
- [.github/copilot-instructions.md](.github/copilot-instructions.md) — Copilot-specific rules

### Project docs
- [README.md](README.md) — project overview
- [docs/plugins.md](docs/plugins.md) — plugin and workflow reference
- [docs/follow-ups.md](docs/follow-ups.md) — open follow-ups
- [docs/backlog/backlog.md](docs/backlog/backlog.md) — product backlog
- [.claude/rules/plugin-development.md](.claude/rules/plugin-development.md) — plugin development rules

### Detected toolchain
- package manager: none (Node.js .mjs scripts, no package.json)
- monorepo: none
- frameworks: Claude Code plugin + GitHub Copilot plugin (generated)
