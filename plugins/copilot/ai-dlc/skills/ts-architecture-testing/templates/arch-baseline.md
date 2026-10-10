# Baseline for an Existing Codebase

Adding rules to a codebase that already breaks them: record today's violations, fail only on new ones, and burn the list down.

```bash
# record the current violations in .dependency-cruiser-known-violations.json
npx depcruise src --config .dependency-cruiser.cjs --baseline

# fail only on violations not in the baseline
npx depcruise src --config .dependency-cruiser.cjs --ignore-known --output-type err
```

`--ignore-known` lowers known violations to `ignore`. Commit the known-violations file, and regenerate it only when a violation has been **fixed** (the list shrinks), never to accept a new one.

`depcruise-baseline` is the older, deprecated form of `--baseline`.
