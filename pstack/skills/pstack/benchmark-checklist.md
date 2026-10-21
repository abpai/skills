# Benchmark checklist

Use before reporting or acting on a performance measurement. Answer
with evidence from runs, not guesses from code.

## Before measuring

- State the exact claim, metric, and workload you intend to report.
- Read the harness: identify what it times, counts, and excludes.
- Check machine load and core count; identify competing work. If it cannot be
  isolated, interleave the compared runs and disclose the interference.
- Validate the harness and baseline before optimizing against them. Apply the
  checks to every reported result, not just the initial baseline.

## Seven checks

1. **Why not double?** Identify the limiting resource or code path using a
   separate profiling run; profiling overhead must not contaminate reported
   timings. Inspect process CPU, runtime profiles, I/O wait, or syscall counts
   and map measured hot spots to source. Check whether the load generator
   saturates first. Locate the limit before dismissing a change that did not
   improve the result.
2. **Was each side tuned?** Use representative production builds, flags,
   batching, transactions, pools, and cache conditions. Keep dependency versions
   and data equal except for what the comparison intentionally varies. Correct
   accidental disadvantages such as debug builds or missing indexes, then
   measure again. If a side cannot be tuned, do not choose a winner. Relabeling
   the result as "out of the box" does not justify an adoption recommendation.
3. **Does the arithmetic fit physical limits?** Compare throughput with CPU,
   disk, and network capacity: bytes per second against bandwidth, and
   operations per second times CPU cost against available cores. Time saved
   cannot exceed the time the changed component consumed. Removing 10% of
   runtime entirely caps speedup at about 11%. An impossible gain suggests
   cached, skipped, or incorrect work.
4. **Did it error?** Count failures, rejected requests, timeouts, and retries.
   Check output correctness, not just existence. Add missing error counts to
   the harness; failed work may look unusually fast or slow.
5. **Does it reproduce?** Run each side at least five times, alternating them
   to distribute warmup and drift. Report median and range. A gap within
   run-to-run variation is no measurable difference; use the harness's
   statistics or an appropriate test, such as rank-sum, for close comparisons.
6. **Does it matter end to end?** Measure the path a user waits on with realistic
   data and concurrency. Show the changed component's share of total time;
   a large microbenchmark gain may have little overall effect.
7. **Did the work happen?** Confirm the intended operations completed inside
   the timed region and their results were consumed: requests served, rows
   written, or bytes read. Check for unconsumed lazy work, discarded results,
   and timeouts that ended measurement prematurely. Retain error and completed-
   work counts on every optimization run.

## Report

- Lead with faster, slower, no measurable difference, or inconclusive.
- Present one primary result. Keep units, workload, settings, run count,
  median, range, and observed limiter alongside it. Link the raw runs and
  profiling evidence when the report would otherwise become unwieldy.
- Mark comparisons inconclusive if the limiter is unknown, a side is untuned,
  or errors and completed work could not be checked. Name the missing evidence.

For an explicitly requested ballpark, one run is sufficient if error and
completed-work checks pass. Label it as one run; investigate any implausible
result. Choosing between alternatives requires the full checklist.
