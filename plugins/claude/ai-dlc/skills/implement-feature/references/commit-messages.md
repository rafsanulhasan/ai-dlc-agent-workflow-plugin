# Commit Messages

Companion to the commit step of `implement-feature` and `fix-bug`. A commit message is read later by someone who already has the diff: the subject tells them the intent, the body tells them why. Neither repeats what the diff shows.

## Convention first

Read the last 20 or so commits (`git log --oneline -20`) before writing. If the repository has its own style (plain imperative sentences, ticket prefixes, a commit template, a commit-lint config), follow it and use this file only for what that style leaves open. Otherwise use Conventional Commits as below.

## Subject

```
<type>(<scope>): <intent>
```

- **Type** — one of `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, `chore`, `style`, `revert`. A behaviour-preserving restructure is `refactor`; if behaviour changed, it is not.
- **Scope** — optional; the component or area, in the project's own terms. Do not repeat it in the summary.
- **Intent** — what the change achieves, in the imperative ("add", "reject", "remove"), not what was typed ("update file", "change code"). Aim for 50 characters; never exceed 72. No trailing full stop. Match the project's capitalisation after the colon.
- **Breaking change** — add `!` after the type or scope (`feat(api)!: ...`) and explain it in the body.

## Body

Leave the body out when the subject says everything. Add one when the reason is not obvious from the subject and the diff:

- why the change was needed — the problem, constraint or decision behind it;
- what the reader would otherwise get wrong — a non-obvious trade-off, a rejected alternative, a follow-up that is deliberately left out;
- for a bug fix, the root cause.

A body is **always** required for breaking changes (`BREAKING CHANGE: <what breaks and what callers must do>`), security fixes, data or schema migrations (with the rollback path), and reverts (which commit, and why it is being reverted).

Wrap at 72 columns, use `-` for lists, and put references and trailers last (`Closes #42`, `Refs #17`, `Co-authored-by: ...`), each on its own line.

## Leave out

- Narration of the diff: "this commit", "changed X to Y", file names the scope already implies.
- First person and time words: "I", "we", "now", "currently".
- Emoji, unless the project's convention uses them.
- Secrets, tokens, connection strings and personal data — a commit message is permanent.
- Attribution or tracking trailers the project or the user's instructions do not ask for.

## Examples

```
feat(profile): add endpoint returning a user's public profile

The mobile client loaded the full user record on its first screen;
the profile payload alone is a fraction of the size.

Closes #128
```

```
fix(validator): handle absent Authorization header

Root cause: the header lookup returned null for absent headers and
the validator dereferenced it before the presence check.
```

```
refactor(orders): move tax calculation into the pricing module
```

```
feat(api)!: rename the orders endpoint to checkout

BREAKING CHANGE: callers of /v1/orders must switch to /v1/checkout.
The old route answers 410 Gone from the next major release.
```
