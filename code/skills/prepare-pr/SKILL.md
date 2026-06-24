---
name: prepare-pr
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Prepare a branch's full PR diff (committed and uncommitted) for human review with finish-lane QA, cleanup, validation, PR text, commits, push, and PR update.
argument-hint: "[scope or message hint]"
# No allowed-tools here: this wrapper is disable-model-invocation +
# user-invocable: false, so it is never the active skill and its allowed-tools
# would be dead config. The allowlist lives on the umbrella code/skills/code/SKILL.md.
---

# /code:prepare-pr

Use the `prepare-pr` module.

1. Read `skills/code/prepare-pr.md`.
2. Run the deterministic preflight (`scripts/finish-lane.ts --fix --arm`): it computes the full PR scope union, runs discovered fix/validation commands and mechanical scans, suggests review lenses, writes `.workflow/finish-lane/changed-files.txt`, and arms the push gate. Run it even when the working tree is clean — it scopes to the full branch diff `<base>...HEAD`, so an already-committed branch is in scope, not a reason to skip.
3. Review the full PR diff (`<base>...HEAD` plus any uncommitted changes) for correctness, security, architecture, tests, manual QA coverage, and maintainability.
4. Accept, override, or add quality gates from the script's suggested-lens list; load only the selected bundled review-pattern playbooks and record evidence or skip rationales.
5. Apply safe fixes, run source-grounded QA and targeted validation, run the independent review, and draft or update PR text from evidence.
6. Stage the unambiguous intended scope by path, commit coherent changes, seal (`--seal`), push, create or update the PR, then disarm (`--disarm`). Ask only when scope is ambiguous, unrelated, secret-like, destructive, or otherwise unsafe to decide automatically.

User input: $ARGUMENTS
