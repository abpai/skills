# review-and-commit

Review uncommitted changes, fix issues, and produce clean atomic commits.

```
  git diff
     │
     v
  ┌─── Review ──────────────────────┐
  │  Correctness > Security >       │
  │  Architecture > Tests >         │
  │  Readability                    │
  └────────────┬────────────────────┘
               v
  ┌─── Fix ─────────────────────────┐
  │  Apply safe, scoped fixes       │
  │  Re-check diffs after each fix  │
  └────────────┬────────────────────┘
               v
  ┌─── Validate ────────────────────┐
  │  Lint, tests, type checks       │
  └────────────┬────────────────────┘
               v
  ┌─── Commit Plan ─────────────────┐
  │  Group by concern (feat, fix,   │
  │  refactor, test, docs)          │
  │  Each commit independently      │
  │  revertable                     │
  └────────────┬────────────────────┘
               v
  ┌─── Approval Gate ───────────────┐
  │  Present plan, wait for OK      │
  └────────────┬────────────────────┘
               v
  ┌─── Execute ─────────────────────┐
  │  Stage → Commit → Report        │
  └─────────────────────────────────┘
```

## Usage

```bash
/review-and-commit
```

Reviews all staged and unstaged changes, proposes atomic commits grouped by
concern, and waits for approval before executing.
