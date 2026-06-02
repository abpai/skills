# Performance Profiling

Role: Review performance claims and optimizations using comparable measurement,
ranked hotspot evidence, and proof that behavior is unchanged.

## Goal

Block three failures: a "faster/lighter" claim with no measurement, an
optimization aimed at code that is not the measured hotspot, and a speedup that
silently changes output. Done means every performance claim in the diff is
backed by a baseline, a ranked hotspot, and a behavior check on the same host.

## Use When

The diff touches performance-sensitive code or benchmark/profile files, or
claims faster/slower behavior, latency, throughput, memory, I/O, contention,
percentiles (p50/p95/p99), caching, or scalability.

## Success Criteria

- Scenario, input, metric, and budget are named before any measurement.
- Baseline records the metric on the same host with the relevant percentiles,
  throughput, or memory figures.
- Hotspots are ranked from a profile or benchmark before any code changes.
- Each optimization is one lever tied to a top-ranked hotspot, then remeasured.
- Output is proved unchanged via tests, goldens, checksums, invariants, or a
  named preservation rationale.

## Constraints

- "Feels faster" is not evidence.
- Do not compare across hosts or across incompatible ad hoc runs.
- Do not optimize code outside the measured hotspot.
- Ask before kernel, CPU governor, or global machine tuning.

## Quick Pass

1. Read the diff and the performance claim in `qa-plan.md`; define scenario,
   target metric, budget, and expected output.
2. Capture a baseline with repo-native tooling and record host context.
3. Profile or benchmark the changed path against that baseline.
4. Write a hotspot table: rank, location (file:line), metric, value, category,
   evidence.
5. If optimizing, change one lever tied to a top hotspot.
6. Rerun the measurement and the behavior check.
7. Decide run, skip, deep, override, or blocked and record it in `gate-decisions.md`.

## Deep Escalation

For hot-path or latency-SLO code: repeat runs with variance and percentiles,
attach the profiler artifact and a flamegraph or trace, score candidate levers,
commit one lever at a time, and cross-check each behavior proof.

## Evidence

In `verification-timeline.md` record: baseline command and output, host note,
the benchmark/profile artifact path, the hotspot table, before/after metric
values, the changed lever (file:line), the behavior proof, and any skip or
block rationale.

## Skip Or Stop Rules

Skip docs-only or behavior-only diffs that make no performance claim. Block when
a claim lacks a scenario, baseline, ranked hotspot, or behavior proof.

## Output

Return the gate decision (run / skip / deep / override / blocked), the measurement
evidence, the chosen lever if any, and residual risk.
