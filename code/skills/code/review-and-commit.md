# Review And Commit

Quickly review local changes, fix real issues, run targeted checks, and prepare
one clean commit. Use this when the user asks to "review and commit", "commit
this", or wants a fast local finish without the full PR-prep lane.

Use `prepare-pr.md` instead when the user asks for PR readiness, reviewer-facing
PR text, manual QA evidence, broad quality gates, or a push/PR update.

## Working tree preflight

```!
echo "REVIEW_AND_COMMIT_PREFLIGHT_$(date +%s%N)"
git rev-parse --show-toplevel 2>/dev/null || echo "not a git repo"
git branch --show-current 2>/dev/null
git status --short 2>/dev/null
git diff --stat 2>/dev/null | head -30
git diff --cached --stat 2>/dev/null | head -30
git log --oneline -n 5 2>/dev/null
```

Run the block above first. Treat it as the scope boundary unless the user
explicitly widens the request.

## Workflow

1. Inspect current change scope.
1. Review the diff for correctness, regressions, security, missing tests, and
   accidental complexity.
1. Apply only scoped fixes that are clearly tied to the requested commit.
1. Run targeted validation for the changed surfaces.
1. Re-check the final diff and status.
1. Propose the exact commit scope and message.
1. Ask approval before staging or committing.
1. Stage only approved files and commit once approval is clear.

## Review Priorities

Prioritize:

1. Correctness and behavioral regressions.
1. Security, secret leakage, and unsafe trust boundaries.
1. Missing tests or validation for changed behavior.
1. Broken project conventions or obvious maintainability problems.
1. Low-risk cleanup that makes the commit easier to review.

Do not turn this into PR prep by default. Skip the finish-lane preflight, PR
body draft, quality-gate lenses, and independent review unless the user asks
for PR readiness or the diff is risky enough that you explicitly escalate to
`prepare-pr.md`.

## Targeted Validation

Run the narrowest useful checks that prove the commit:

- Use repo-native scripts when available: lint, typecheck, test, build, or a
  targeted package/test command.
- For UI changes, run the closest browser or component check that is practical.
- For API or CLI changes, run the representative command/request and at least
  one relevant failure path when cheap.
- For docs-only changes, verify referenced commands, paths, and examples against
  the live repo.

If a check is blocked, report the blocker and the closest proof you ran instead.

## Commit Discipline

- Do not stage unrelated files.
- Mention untracked files explicitly and exclude generated, secret-looking, or
  bulky files by default.
- If unrelated changes exist, keep them out of the commit and say so.
- If multiple independent changes are present, propose separate commits.
- Do not push or open/edit a PR unless the user asks.

## Output

Before committing, show:

- review findings, or "No issues found"
- validation commands and results
- files to stage
- proposed commit message

After committing, report the commit hash and any skipped checks or residual risk.
