# Performance Profiling

Role: Review performance claims and optimizations using comparable measurement,
ranked hotspot evidence, and behavior-preservation proof.

## Goal

Allow speed, latency, throughput, memory, I/O, contention, p95/p99, cache, or
hot-path claims only when backed by evidence.

## Use When

Use for changed performance-sensitive code, benchmark/profile files, or claims
about faster/slower behavior, latency, throughput, memory, I/O, contention, hot
paths, percentiles, caching, or scalability.

## Success Criteria

- Scenario, input, metric, and expected behavior are named before measurement.
- Baseline includes same-host context and relevant p50/p95/p99, throughput,
  memory, or similar data.
- Hotspots are ranked with artifact-backed evidence before optimization.
- Any optimization is one lever tied to a top hotspot and remeasured.
- Behavior is proved unchanged with tests, goldens, checksums, invariants, or an
  explicit preservation note.

## Constraints

- Do not accept "feels faster" as evidence.
- Do not compare across hosts or ad hoc incompatible runs.
- Do not optimize outside the measured hotspot.
- Ask before kernel, governor, or global machine tuning.

## Quick Pass

1. Define scenario, target metric, budget, and expected output.
2. Capture baseline and environment context.
3. Profile or benchmark changed path with repo-native tooling.
4. Produce compact hotspot table: rank, location, metric, value, category,
   evidence.
5. If optimizing, pick one justified lever.
6. Rerun measurements and behavior proof.
7. Record whether the claim is supported, rejected, blocked, or skipped.

## Deep Escalation

Use for speed-critical code. Add multiple runs, variance/percentiles, profiler
artifacts, flamegraph or trace path, candidate scoring, one-lever commits, and
cross-checks for behavior preservation.

## Evidence

Record baseline command/output, environment note, benchmark/profile artifact,
hotspot table, before/after metric, changed lever, behavior proof, and
skip/blocker rationale.

## Skip Or Stop Rules

Skip docs-only or behavior-only diffs with no performance claim. Block
optimization when there is no scenario, baseline, ranked hotspot, or behavior
proof.

## Output

Return claim status, measurement evidence, any chosen lever, and residual risk.
