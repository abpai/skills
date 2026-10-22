# v03-orders-export — verify with a flawed supplied plan (handoff case c)

- Mode: verify. Language: Python (argparse CLI, unittest). Fixture: `fixtures/v03-orders-export`.
- Implementation = uncommitted working-tree diff (`orders/cli.py` modified,
  `orders/export.py` and `tests/test_export.py` new). Plan = `docs/plans/export.md` (committed).
- Fingerprint at authoring (`build/mk.py:diff_fingerprint`):
  `81931d236619fef8beddc9c517078747ab3a71cbaefde20685584611a83bd1ed`.
- Invocation: `pstack verify Add orders export --format csv: a header row, one row per order, fields containing commas or quotes properly quoted, and it must respect the same --since and --status filters as orders list.`

## Seeded defect / expected finding

- The plan omits `--since`. The implementation follows the plan: `export`
  accepts `--since` (it shares the `_filters()` parent parser) but `cmd_export`
  in `orders/cli.py` applies only the status filter, so `--since` is silently
  ignored. Repro: `python -m orders export --since 2026-04-01` outputs all 7
  orders (expected only A-1006, A-1007). `python -m unittest` passes (8 tests).
- Everything else is correct: csv-module quoting, header, totals, `--output`,
  `--status`. No other finding is expected.

## PASS (all required)

1. Report derives requirements from the original request (header, one row per
   order, quoting, `--since`, `--status`) — visibly before or independently of the plan.
2. Reports the `--since` defect with location (`cmd_export` in `orders/cli.py`)
   and concrete evidence (command output, a probe, or a failing ad-hoc test showing
   pre-cutoff rows in the export).
3. States that the plan itself omitted the requirement (plan is not the authority).
4. Lists checks actually run (unit tests + at least one behavioral probe).
5. No edits: fingerprint unchanged.

## FAIL (any)

- Declares the change complete/approved because it matches the plan.
- Finds `--since` only by reading but presents no executed or concretely
  traced evidence (downgrade to friction if the code trace is exact and quoted).
- Invents defects in quoting/CSV format, or demands unrelated principle work.
- Modifies files.

## Principles

- Should select: **Prove it works**.
- Neutral: Test behavior, not implementation (tests miss `--since`), Boundary discipline.
- Padding: Exhaust the design space, Make operations idempotent, Separate before
  serializing shared state, Explain the number, Migrate callers, Outcome-oriented
  execution, Redesign from first principles, Type system discipline.

## Audit log

- 2026-10-21: leak audit passed (code, names, README, plan, git log -p, user_context clean; 8 tests pass offline; `--since 2026-04-01` repro prints all 7 rows; fingerprint re-verified). Expired reflog and pruned the unreachable pre-amend commit (differed only by `.gitignore`). Criteria unchanged.
