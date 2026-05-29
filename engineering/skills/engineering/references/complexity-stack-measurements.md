# Complexity Stack Measurements

Prefer tools already configured in the repository. Do not install heavyweight
analyzers or change CI just to finish a first report.

## Universal Discovery

- Check package scripts, task runners, Makefiles, CI workflows, and repo docs.
- Look for existing benchmarks, profiler docs, load tests, SQL logs, bundle
  reports, and production metric exports.
- If a mature analyzer is already configured, use it as evidence: Semgrep,
  CodeQL, SonarQube, lizard, radon, bundle analyzers, or framework profilers.

## Python

- Correctness: `pytest`, targeted test modules, type/lint commands if present.
- Measurement: `pytest-benchmark`, `python -m cProfile`, py-spy, scalene, or
  existing benchmark scripts.
- Data access: SQLAlchemy/Django query counts, query logs, `EXPLAIN`.

## Node And TypeScript

- Correctness: `npm test`, `pnpm test`, `bun test`, `vitest`, `jest`, typecheck,
  lint, and build scripts already in the repo.
- Measurement: `node --prof`, benchmark scripts, React profiler traces, browser
  performance traces, bundle analyzer outputs.
- Data access: ORM query logs, dataloader batch counts, endpoint/request counts.

## Go

- Correctness: `go test ./...`.
- Measurement: `go test -bench`, `pprof`, trace tooling, allocation profiles.

## JVM

- Correctness: Gradle/Maven test tasks.
- Measurement: JFR, async-profiler, JMH, allocation profiles.

## Databases

- Prefer query count and round-trip evidence for N+1 findings.
- Use `EXPLAIN` or `EXPLAIN ANALYZE` only when safe for the environment.
- Capture indexes, filter selectivity, sort strategy, and row estimates.

## Frontend

- Correctness: component tests, route smoke, build, typecheck.
- Measurement: browser performance trace, React profiler, Lighthouse, bundle
  report, route chunk sizes, long tasks, interaction latency.
