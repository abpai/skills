# Performance Evidence Check

Block performance claims that lack a fair, reproducible comparison and proof that
behavior is unchanged. Use the target repository's benchmark and profiler tools;
do not force results into a bundled schema.

## When this gate applies

- The diff changes a benchmark, profiler, load test, or performance-sensitive hot
  path.
- PR text claims lower latency, higher throughput, less memory/I/O/contention, or
  cites percentile/benchmark numbers.
- A rewrite or migration is justified by speed or scalability.

## Gotchas

1. **Compare the same API class.** Prepared vs ad-hoc, batched vs single, async
   vs sync, or cached vs uncached measures different work. Name the exact entry
   point and data shape on both sides.
2. **Control cache and run order.** Warm both sides symmetrically and interleave
   ABAB; AAAA then BBBB lets the second side inherit warmed state.
3. **Publish distributions, not one number.** Report sample count and p50/p95/p99.
   Label tail values as worst-observed when the sample size cannot support the
   claimed percentile.
4. **Use open-loop load for server tail claims.** Closed-loop clients back off
   under saturation and hide queueing.
5. **Measure the same host and build.** Record git SHA, dirty state, OS/kernel,
   CPU, toolchain, build profile, and any governor/core/cache tuning. Never change
   host tuning without approval and a revert command.
6. **Triangulate the mechanism.** CPU samples, off-CPU/scheduler evidence, syscall
   traces, allocator, or lock profiles reveal different bottlenecks. Act only when
   independent evidence supports the same hypothesis.
7. **Preserve behavior.** Check ordering, tie-breaking, floating-point evaluation,
   seeds, output bytes, and side effects before accepting the optimization.
8. **Publish losses.** Show the whole workload × concurrency matrix, including
   cells where the candidate regresses.

## Quick pass

1. State the scenario, metric, budget, and exact claim. If none exists, skip.
2. Capture the repository-native baseline and candidate commands on the same host
   and build with symmetric warmup and interleaved order.
3. Record sample count, p50/p95/p99, dispersion, and repeated-run drift.
4. Confirm the changed lever maps to a measured top hotspot rather than a guess.
5. Run the behavior-preservation proof appropriate to the output.
6. Report the before/after ratio and all losses. Treat a result inside the noise
   envelope as parity, not a win.

## Deep pass

Escalate for latency SLOs, migrations justified by performance, or global tuning:

- repeat at least 20 same-host runs and investigate drift above 10%;
- profile with at least three mechanism-orthogonal signals;
- use fixed-arrival-rate load for server p95/p99;
- vary workload, concurrency, and randomized run order;
- add the repository-native regression gate only after the benchmark is stable;
- record every system knob and its revert command.

This lens deliberately ships no benchmark scripts. The removed helpers assumed
specific JSON schemas and Linux host controls, which made a portable review look
more deterministic than it was.

## False positives

- A microbenchmark may omit system percentiles when its claim stays local.
- A documented apples-to-oranges comparison is valid only when the differing
  axis is the point and a normalized control appears beside it.
- Docs/tests that merely mention performance without making a claim can skip.

## Evidence to record

Scenario, metric, budget, commands, git/build/host fingerprint, sample count,
p50/p95/p99 and dispersion, run-order/warmup controls, profiler evidence, complete
wins/losses matrix, behavior proof, result ratio/verdict, and any tuning/revert.
