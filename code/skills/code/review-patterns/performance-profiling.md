# Performance Profiling

Review performance claims and optimizations — block any "faster/lighter/lower-latency" claim that is not backed by a fair, same-host, ranked-and-triangulated measurement with proof that behavior is unchanged.

## When this gate applies

- Diff touches perf-sensitive code, benchmark/profile harnesses, or `bench`/`criterion`/`hyperfine`/`pprof`/load-test files.
- PR text or comments claim faster/slower, lower latency, higher throughput, less memory/IO/contention, or cite p50/p95/p99/p99.9, IOPS, fsync, caching, or scalability.
- A diff adds or changes a benchmark, a "% faster" number, a flamegraph, or a before/after table.
- A migration/rewrite is justified by performance ("we replaced X because it was slow").

_Auto-suggest is path-triggered (benchmark/profile/perf-named files). The PR-text-claim and perf-justified-rewrite cases above are not detectable from file paths — add this gate manually in prepare-pr Phase 2 when they apply._

## Gotchas

The heart of this lens. Each is a non-obvious way a perf claim lies; check the named failure, apply the exact fix/threshold.

1. **Prepared-vs-ad-hoc is the #1 lie (Benchmark Truthfulness Audit).** The FrankenSQLite audit found one side timing cached/prepared statements while the other timed `format!()`-ed SQL strings — **six months of "10x faster" numbers were revised to noise-level** after the audit. CHECK: both sides must use the **same API class** — prepared↔prepared, batched↔batched, async↔async — and the same SQL/key *shape*. Cite the exact API entrypoint on each side. If the PR compares one side's fast path against the other's convenience path, the number is dead. Run `scripts/bias_audit.py` over the bench JSON + source; a HIGH flag (exit 1) blocks.

2. **Cache poisoning — two flavors.** (a) `WHERE k='{val}'` (string-interpolated) misses the parse/plan cache *every call*; `WHERE k=?` (parameterized) hits it. A bench where one side interpolates and the other parameterizes measures cache-miss vs cache-hit, not the systems. (b) Running side A fully to completion, *then* side B, leaves A's pages warm in the OS page cache and silently boosts B. FIX: identical key *shape* per side; **interleave ABAB**, never AAAA…BBBB; for fsync/durability-heavy runs rotate the backing file per iteration so neither side inherits warm dirty pages. Symmetric warmup (e.g. 3 discarded iterations) on *both* sides — "we warmed A's cache, B got none" measures B cold.

3. **One signal lies — triangulate before acting.** Every profiler has bias: samplers under-count short hot functions; on-CPU flames hide *all* waits (I/O, lock, page fault); allocator profiles miss leaks below granularity. Require **3 angles orthogonal in mechanism** to agree before acting on a hypothesis. **3/3 agree → kernel (act); 2/3 → disputed appendix (do NOT act); 1/3 → discard as tool artifact.** Two `perf`-based tools count as ONE mechanism, not two — pick from three different mechanism rows (CPU sample / off-CPU-scheduler / syscall trace / allocator / lock / PMU). Worked trap: CPU flame says `wal_append` is 41% hot, but off-CPU runqlat + `strace -c` show 80% of wall time waiting on `fdatasync` — the real bottleneck is **fsync, not CPU**. A PR that optimized the CPU box would be optimizing the wrong thing.

4. **Flame graphs mislead — canonical misreadings.** X-axis is aggregate **sample count, NOT time**, and is sorted **alphabetically, not chronologically** (you cannot read "first this, then that" across it). **Widest** box = hottest (not tallest). A wide box at the *bottom* means its **callee** is hot, not the box itself. A missing expected function is usually **inlined or stripped**, not absent. On-CPU flames hide all waits — when wall-clock says slow but CPU says fine, reach for an **off-CPU flame** (it reveals I/O or lock). The flame is the artifact a Deep pass attaches; a reviewer who reads it wrong blesses the wrong hotspot.

5. **Means lie, medians mislead — publish the triple, never one number.** Mean is dragged by one slow request; no user experiences the median. Always publish `(p50, p95, p99)` together. **Sample-size honesty:** p95 needs ~1,500 samples, p99 ~15,000, p99.9 ~150,000 for ±5% error. **Below ~1,000 samples, p99.9/p99.99 are "worst-observed" sentinels, not estimates — they MUST be labeled conservative.** CV (coefficient of variation) gates: `<3%` publishable, `<10%` ok for A/B, `>10%` fix host noise first, `>30%` something is broken.

6. **Closed-loop load hides tail latency.** Closed-loop tools (`wrk`, most `ab` setups) back off when the server saturates — virtual users stop issuing new requests while waiting, so the server *looks* like it is "still responding in N ms" when it is actually drowning. For any **server-side tail (p95/p99) claim**, require an **open-loop fixed-arrival-rate** tool: `wrk2`, `k6`, or `vegeta`. A p99 from a closed-loop tool under saturation is invalid.

7. **Compounding wins are multiplicative, not additive.** Five rounds of 10% each is `1.1^5 = 1.61` = **61% faster, not 50%**. The error grows with N. CHECK: convert every "% faster" to a speedup ratio `1/(1−x)` before combining, and report cumulative speedup as a ratio.

8. **Never profile the size-optimized release binary.** `opt-level="z"` + `strip=true` = no frames → useless flames. Require a `release-perf`/`profiling` build: `debug="line-tables-only"` (or `true`), `strip=false`, `force-frame-pointers=yes` (Rust); `-O2 -g -fno-omit-frame-pointer` (C/C++). A flamegraph captured from the shipped release build is not evidence.

9. **Behavior breaks silently along four axes — the Isomorphism Proof.** A "behavior unchanged" claim must check, per change: **Ordering preserved**, **Tie-breaking unchanged**, **Floating-point identical**, **RNG seeds unchanged**, plus `sha256sum -c golden_checksums.txt` against goldens captured **BEFORE** the change. `Linear→HashMap` silently reorders; reduction reassociation silently shifts floats. Goldens captured *after* optimizing prove nothing.

10. **Publish losses — dual-direction reporting.** A report that shows only the winning workload is **the single most common form of benchmark dishonesty.** Require the full `workload × concurrency` matrix including cells where the change *loses*, each with an honest explanation. Systems that hide losses attract credibility complaints; systems that publish losses attract trust. A one-sided "we win on workload X" table is a red flag — ask for the losses section.

11. **Kernel/governor tuning changes global state — ASK, then record the revert.** Knobs that visibly move numbers but need `sudo`: `kernel.perf_event_paranoid`, `kptr_restrict`, `nmi_watchdog`, `cpupower frequency-set -g performance`, `no_turbo`, `taskset` core pinning, `drop_caches`. Never silently applied in a bench harness — present the list, ask "apply these?", and record the revert command. A bench whose numbers depend on un-recorded global tuning is not reproducible.

### Named techniques to demand

- **5 levels of fairness ladder** — L0 both-run → L1 same-workload → L2 same-API-class → L3 same-cache-state → L4 same-physical-host → L5 same-data-shape. **Only assert the claim the matched level supports.** Marketing/blog/paper claims need **L5**; internal engineering decisions can ride **L3–L4**. Reject a marketing-grade "10x" riding an L2 measurement.
- **MATCH / STATE / RANDOMIZE matrix** — classify every axis *before* running. **MATCH** axes (workload, fixture, build profile, pragmas, API, warmup, host) must be identical or the bench fails. **STATE** axes are the design difference being measured — name them, publish both sides. **RANDOMIZE** axes (RNG seed, run order) vary to show insensitivity (and interleave order). "Make every axis match" destroys the comparison; "make the comparison axis implicit" lets marketing cite the wrong thing. Apples-to-oranges is honest *only* when the mismatch is the explicit point and a fair comparison appears beside it.
- **Triangulation ledger** — one hypothesis × three orthogonal angles, each marked `supports`/`rejects` with an evidence path. 3/3 → act; 2/3 → disputed appendix; 1/3 → discard.
- **Three-tier verdict (ratios, not absolute percentiles)** — percentiles are noisy in absolute ms but ratios are stable, so gate on the ratio: **BelowParity** (candidate p95 > 1.25× baseline → call it out), **ParityToMargin** (within 1.25× → report, claim NO win), **HealthyMargin** (≥ 1.10× faster → real win). Do not let a within-noise change be declared a win.
- **Opportunity Matrix** — `Score = Impact × Confidence / Effort` (each 1–5); **implement only Score ≥ 2.0**. Impact: 5 = >50% gain, 1 = <5%. Confidence: 5 = profiler-confirmed, 1 = speculative. Effort: 5 = >1 day, 1 = minutes. This is the gate that justifies *which* lever a PR touched.
- **Isomorphism Proof** per change — ordering ✓, tie-break ✓, float ✓, RNG ✓, `sha256sum -c golden_checksums.txt`.

## Quick pass

Bounded check for a normal perf-claiming PR:

1. Scenario named? Metric + budget + expected output written down. "Feels slow" is not a scenario → block.
2. Same-host baseline present with `(p50, p95, p99)`, not a single number? Sample count ≥ ~1,000 for any p99 claim (label below that conservative).
3. A/B fairness: same API class, same pragmas/knobs, symmetric warmup, **interleaved** not sequential. Run `scripts/bias_audit.py` on the bench JSON/source — HIGH flag blocks.
4. The optimized lever ties to a ranked hotspot (top-5), and Score ≥ 2.0 justifies it.
5. Behavior proof: goldens/checksums captured before the change + an isomorphism note on ordering/tie-break/float/RNG.
6. Report includes losses, not just wins; verdict stated as a ratio with the three-tier label.

## Deep pass

Risk-gate to here for hot-path / latency-SLO / migration-justified-by-perf diffs:

- Re-run ≥ 20 same-host iterations; check the variance envelope with `scripts/variance_envelope.py` (p95 drift ≤ 5% STABLE / ≤ 10% NOISE / ≤ 20% INVESTIGATE / >20% ESCALATE).
- Capture host fingerprint with `scripts/env_fingerprint.sh` so two numbers are provably same-host.
- Build the MATCH/STATE/RANDOMIZE axis matrix explicitly; walk the 14-question fairness gate with `scripts/honest_gate.sh` and attach the signed attestation JSON.
- Profile with ≥ 3 mechanism-orthogonal angles (CPU sample + off-CPU + syscall/lock); write the triangulation ledger and the ranked hotspot table via `scripts/render_hotspot_table.py` (rows missing evidence are flagged).
- Server tail claims: re-measure under **open-loop** (`wrk2`/`k6`/`vegeta`).
- Wire `scripts/ci_compare.sh` as the regression gate (baseline vs candidate p50/p95/p99 with fingerprint-mismatch enforcement).
- Write the Isomorphism Proof per change; commit one lever per commit.

## Scripts

All under [`review-patterns/scripts/`](scripts/):

- [`bias_audit.py`](scripts/bias_audit.py) — `python3 scripts/bias_audit.py --json bench.json --source bench.rs [--out report.md]`. Static scan for prepared-vs-ad-hoc, `format!()`-ed SQL, sequential AAA…BBB run order, mean-only reporting. **Exits 1 on a HIGH flag — wire as a gate.**
- [`honest_gate.sh`](scripts/honest_gate.sh) — `scripts/honest_gate.sh --scenario NAME --result-dir DIR [--non-interactive answers]`. Walks the 14 pre/during/post fairness questions, emits a signed attestation JSON (git SHA + fingerprint hash + per-question pass/fail/waive) beside the result. Bench artifacts without an attestation are unfit to cite.
- [`variance_envelope.py`](scripts/variance_envelope.py) — `python3 scripts/variance_envelope.py run1.json run2.json run3.json`. Emits STABLE/NOISE/INVESTIGATE/ESCALATE on p95 drift (≤5/≤10/≤20/>20%).
- [`ci_compare.sh`](scripts/ci_compare.sh) — `scripts/ci_compare.sh baseline/summary.json candidate/summary.json [--max-pct 5] [--metrics p50_ms,p95_ms,p99_ms]`. Fails if selected metrics regress beyond threshold; enforces fingerprint match.
- [`env_fingerprint.sh`](scripts/env_fingerprint.sh) — `scripts/env_fingerprint.sh [--run-id ID] [--build-profile NAME] > fingerprint.json`. Captures host/toolchain/build-profile so two numbers are provably same-host comparable.
- [`render_hotspot_table.py`](scripts/render_hotspot_table.py) — `python3 scripts/render_hotspot_table.py profile.jsonl [--top N] [--by cumulative|count|p95]`. Renders the ranked hotspot table + hypothesis ledger from `perf.profile.*` JSONL; flags rows missing evidence.

## False positives

Do not raise the gate for these; do not let these rationalizations wave a claim through.

- **Genuine apples-to-oranges that is the point.** A STATE-axis comparison (MVCC vs single-writer, B-tree vs LSM) is fine *iff* the axis is named explicitly and a fairness-normalized control sits beside it. Suppress only when the mismatch is documented as the measured difference — not when it is silent.
- **Microbenchmark labeled as such.** A `criterion` microbench isolating one function is not dishonest for skipping end-to-end percentiles, as long as it does not get cited as a system-level claim.
- **Docs/comment/test-only diffs that merely mention perf words.** A README that says "fast" or a test renamed `test_latency` carries no claim — skip.
- **Internal decision riding L3–L4.** Do not demand L5 marketing rigor for an internal "is this fast enough to ship" call; match the bar to the claim.
- Rationalization blacklist (do NOT accept): "the numbers feel right", "it's obviously faster", "we ran it a few times", "mean is fine here", "we'll add the losses section later", "same machine, trust me" (no fingerprint), "p99 from wrk" (closed-loop), "goldens still pass" (captured after the change).

## Evidence to record

Into the finish-lane verification artifacts, record: the scenario + metric + budget; the baseline command and `(p50,p95,p99)` output with sample count; host fingerprint path; profiler artifacts from ≥ 3 mechanisms (flame / off-CPU / strace) for a Deep pass; the ranked hotspot table + triangulation ledger; the MATCH/STATE/RANDOMIZE matrix; `bias_audit.py` result and `honest_gate.sh` attestation; before/after percentile triple as a ratio with the three-tier verdict; the changed lever (file:line) and its Opportunity Score; the Isomorphism Proof; the full wins-AND-losses matrix; and any kernel/governor knob applied with its revert. On skip, record the one-line rationale (which FP bucket). On block, record the missing element (scenario / same-host baseline / fair A/B / triangulated hotspot / behavior proof / losses section / single-number-only).

---
Provenance: distilled from jeffery-skills `profiling-software-performance` (UNBIASED-BENCHMARKING, HONEST-GATE-CHECKLIST, APPLES-TO-APPLES-MATRIX, TRIANGULATION-RECIPE, FLAMEGRAPH-READING, STATISTICAL-RIGOR, Build Flags, OS Tuning) and `extreme-software-optimization` (Opportunity Matrix, Isomorphism Proof). Ported scripts: `bias_audit.py`, `honest_gate.sh`, `variance_envelope.py`, `ci_compare.sh`, `env_fingerprint.sh`, `render_hotspot_table.py`.
