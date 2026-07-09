# Fan-out mechanics

How to run the deslop at scale (hundreds of files) with parallel subagents without
inconsistent taste, broken coverage, or git contention.

## Baseline (do this first)

Run the suite the exact way CI does and capture the result. This is what makes
"I didn't break anything" provable.

```bash
# whichever the repo's gate actually is — read package.json / CI config, don't guess
<test-runner> > baseline.log 2>&1; echo "exit: $?"
# record total count + the set of failing test names
```

Notes:
- Use the **same flags** CI uses (env-file handling, etc.). A different invocation
  can produce a different pass/fail set.
- If a per-package run fails but the whole-repo run is green, the failures are
  pre-existing order-dependency — the whole-repo CI run is the source of truth.
  Don't try to "fix" them inside a deslop.
- Capture baseline on the **pristine** tree (stash your changes) before any agents
  run, so nothing interferes.

## Partition

Map the test files by area, then cut into slices of ~10-18 files along coherent
subtrees. Generate explicit, non-overlapping file lists and **verify coverage**:

```bash
# union of all slice lists == target set, with zero overlaps
cat batch_*.txt | sort | uniq -d | wc -l    # overlaps -> must be 0
comm -23 target.txt <(cat batch_*.txt | sort -u)   # gaps -> must be empty
```

Exclude things that aren't part of the suite under review (e.g. eval/fixture
workspaces that intentionally contain failing tests).

## Calibrate

Run ONE small, representative slice first (2-3 agents). Confirm:
- the prune taste matches the user's chosen bar, and
- edits and `rm`s actually land where you expect (worktree/sandbox quirks bite here).

Then run the calibrated slice's tests in isolation to confirm survivors pass. Only
fan out the rest once both are true.

## Subagent prompt template

Give every agent the **identical** rubric — vary only the file list and a one-line
area note. Paste the KILL/KEEP/PROTECT rubric from `test-deslop-rubric.md` into
the prompt.

```
OPINIONATED test deslopification on ONE slice. Work inside: <REPO/WORKTREE ROOT>.
Do not create/switch branches or commit.

YOUR SLICE = exactly the test files in: <path/to/batch_N.txt>  (cat it).
Modify ONLY those files; touch nothing else.

GOAL: (1) delete low-value tests; (2) make survivors a joy to read.

[ paste KILL criteria ]
[ paste KEEP + SHARPEN ]
[ paste PROTECT — plus any area-specific note, e.g. "these are HTTP auth routes:
  keep every scope/credential/identity check" or "these are codegen no-drift gates:
  default to KEEP" ]

HARD CONSTRAINTS:
- Edit ONLY the test files in your list, using the repo's own convention
  (`*.test.ts`, `*.spec.ts`, `*.test.tsx`, etc.). Never edit source,
  code-under-test, or shared helpers (if a helper goes unused after a deletion,
  leave it and note it).
- Whole-file delete: plain `rm <path>` (NOT `git rm` — staging is central). In-file
  prune: Edit tool; fall back to a Bash rewrite if Edit fails.
- Bias to DELETION over rewriting. Survivor edits must keep tests passing — never
  change behavior-under-test or weaken a meaningful assertion.
- Do NOT run the test suite, git, or the formatter. Just edit/rm your files.
- When unsure, KEEP and flag it.

RETURN (no file dumps): per file — path · verdict
(DELETED-FILE|PRUNED-CASES|CLARIFIED|KEPT) · cases removed/kept · one-line reason.
Then batch totals (files deleted, cases removed, ~lines) and any unused helper /
test you were unsure about.
```

Why these constraints:
- **Disjoint file sets** → no edit conflicts between concurrent agents.
- **Plain `rm` + central `git add -A`** → avoids `index.lock` races when many agents
  delete files at once.
- **Agents don't run tests/formatter/git** → those are central, serialized steps;
  concurrent runs collide and waste tokens.
- **Concise structured reports** → you can QC ~25 agents without drowning in context.

## Verify (central, serialized)

1. Remove orphaned snapshots (a `.snap` whose test no longer calls
   `toMatchSnapshot`) and any fixture left unused.
2. Formatter check (run the repo's `prettier --check .` or equivalent).
3. Typecheck — this is what catches imports orphaned by a prune.
4. Full suite, same command as the baseline. Expect: **fewer tests, and the failing
   set is a subset of baseline** (ideally still zero). New failures = a prune went
   too far; fix or revert that slice.
5. Safety sweep:
   ```bash
   git add -A
   # inspect every changed path; no source file or shared helper should appear:
   git status --porcelain | awk '{print $NF}'
   ```

## Ship

One commit / PR. In the body, give before/after test counts and the *categories* of
what was removed and what was deliberately protected — so the reviewer evaluates the
taste, not just the deletion count.
