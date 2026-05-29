# Complexity Report

Workflow module for `/engineering:complexity-report`.

Upstream inspiration: https://github.com/Kappaemme-git/codex-complexity-optimizer/tree/6a1f9674d706a06d462296e53a40f668299e8893

Create an evidence-ranked report that helps the user choose what to fix next.
Default to read-only: do not modify source files, lockfiles, generated
artifacts, or test fixtures in this workflow.

## Instructions

1. Establish scope: repository root, target area, language/runtime, framework,
   available test/build commands, benchmark/profiling commands, and likely hot
   paths.
2. Use tools for grounding. Inspect live code, tests, package scripts, docs,
   existing perf reports, SQL logs, profiler traces, route metrics, bundle
   reports, churn, and coverage when available.
3. Use the bundled scanner as lead generation when it helps:

   ```bash
   python3 engineering/skills/engineering/scripts/complexity_scan.py . --format markdown
   python3 engineering/skills/engineering/scripts/complexity_scan.py . --format json
   ```

   If the skill is installed as a plugin, locate this `complexity-report.md`
   module beside `SKILL.md`; run `python3 <that-directory>/scripts/complexity_scan.py <repo>`.
4. Promote a scanner lead to a finding only after inspecting surrounding code
   enough to understand behavior, data shape, and path importance.
5. Rank by expected impact, not smell count: hot path frequency, input size,
   I/O or query cost, route importance, user-visible latency, coverage, churn,
   and implementation risk.
6. Before finalizing, check that every finding has evidence, a stable ID,
   behavior invariants, proof obligations, and a concrete next-turn instruction.

## Report Rules

- State the scope and the exact evidence used.
- Separate measured findings from static leads and hypotheses.
- Include file and line for every promoted finding.
- Estimate current and proposed complexity only when the code supports the
  estimate; otherwise label it as unknown.
- Use stable IDs like `perf-001` so the user can say `address perf-001` in a
  follow-up turn.
- For each finding, include behavior invariants, proof obligations, and
  verification work.
- Include a short "How to address next" note, but do not implement it.
- End report-only work with a clear statement that no files were modified.

## Follow-Up Contract

When the user later asks to address a finding, the normal coding workflow should
use the report as context and implement only the selected finding unless the user
explicitly expands scope. The implementation turn should preserve the listed
invariants, run the listed verification, and report any measurement gaps.

## References

- Read `references/complexity-report-schema.md` before preparing a structured
  report.
- Read `references/complexity-proof-obligations.md` when ranking data-access,
  caching, render-path, or deduplication findings.
- Read `references/complexity-stack-measurements.md` when a repo has
  stack-specific tests, profilers, or analyzers available.
