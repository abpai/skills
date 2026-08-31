---
name: ci-efficiency
disable-model-invocation: true
description: Audit and improve GitHub Actions CI for speed and cost without weakening merge-gate integrity. Use when workflows rerun unrelated gates, draft commits waste runners, main repeats PR proof, job setup or billing rounding dominates, or a CI optimization proposal needs review.
argument-hint: "[repository or PR] [review|plan|implement]"
metadata:
  version: "1.0.0"
---

# CI Efficiency

Find measured GitHub Actions savings while preserving the exact property the
merge gate is supposed to prove. Prefer a few structural wins over a large
cache, proof-reuse, or path-routing subsystem whose hit rate is unknown.

## Scope and authority

Treat `review` as read-only. In `plan`, produce a sequenced recommendation with
proof obligations. In `implement`, change workflows and supporting tests only
when the user has authorized repository edits; do not merge, change branch
protection, or spend hosted CI budget beyond the normal requested workflow
without authorization.

Before analysis, read the repository guidance and testing/merge documentation.
Refresh the target branch, PR head/base, current workflow files, required status
checks, strict-up-to-date policy, and live check rollup. Historical runs inform
the design but do not certify the current head.

## Evidence model

Build a baseline before recommending changes. Use enough recent Actions history
to represent ordinary PRs, cancellations, main pushes, manual runs, and known
budget/account outages. Separate:

- runner time from wall-clock latency;
- actual duration from billed duration after per-job rounding;
- code failures from zero-step infrastructure, quota, or account failures;
- completed work from cancelled work;
- PR proof from duplicate post-merge work;
- local deterministic proof from CI-only services and hosted-runner behavior.

Record the sample window, excluded runs, job counts, median or average duration,
dominant jobs, setup overhead, cancellation waste, and estimated billed time.
Call savings projections projections until measured after rollout.

Inspect representative PR histories, not only workflow totals. A README-only
follow-up on a broad PR still has the broad base-to-head candidate tree. Skipping
its prior code proof based only on the latest commit weakens exact-head
certification.

## Map the gate before optimizing it

For every workflow and conditional job, identify:

- trigger events and path filters;
- concurrency and cancellation behavior;
- required check context names;
- job dependencies and aggregate semantics;
- permissions, secrets, services, containers, caches, and artifacts;
- whether `main` is merge-only and requires a strict, up-to-date PR check;
- which tests are local, Postgres/service-backed, independent-platform, or
  hosted-runner-only.

Read the live ruleset. Do not infer merge safety from workflow YAML alone. A
dynamic job name may remain literal when the job is skipped, so verify both
sides empirically: draft runs must not accidentally create the required context,
and a ready run must create the context with its exact required name.

## Prefer simple structural savings

Evaluate these in order:

1. **Draft versus ready.** Give draft synchronizations one bounded,
   cancel-in-progress feedback job. Trigger the full required exact-head gate on
   `ready_for_review` and subsequent ready-PR synchronizations. Keep the draft
   job name distinct from the required context.
2. **Duplicate main proof.** When the live ruleset is strict/up-to-date and main
   is merge-only, determine whether the merge result tree is already the
   certified PR-head tree. Replace a duplicate full main suite with one bounded
   integrity/release-control job only when that invariant is proven.
3. **Per-job rounding and repeated setup.** Fold short, compatible proof into an
   existing job; remove duplicated installs, checkouts, formatting, image builds,
   and artifact transfers. Preserve independent failure boundaries when they
   materially improve diagnosis or isolation.
4. **Expensive environment setup.** Prefer immutable prebuilt test containers
   when they match the locked dependency version. Test prerequisites that the
   container omits, and couple the visible image version to the lockfile. Treat
   a tag-plus-digest check as a drift signal, not proof that the digest belongs
   to that tag; the hosted behavior test remains authoritative.
5. **Safe parallelism.** Parallelize only tests shown to own distinct temp
   directories, ports, processes, databases, and checkout state. Keep shared
   confinement and mutation tests serialized.
6. **Path routing.** Keep classification conservative and test unknown paths.
   Remember that PR path filters describe the complete PR diff, not only the
   latest commit.

Do not add cross-commit lane-proof reuse by default. Consider it only after
measuring a meaningful eligible-hit rate. Any design must authenticate the
source workflow/run, exact head and base, workflow-control version, ancestry,
and affected surface; bot identity or a status context alone is not provenance.
If this machinery is larger or riskier than the measured saving, leave it out.

## Threat and failure review

Before accepting an optimization, challenge it as a gate bypass:

- Can a PR-modified workflow mint evidence that another job trusts?
- Does a skipped job register a required context as successful?
- Can a force-push, base update, merge, or workflow edit reuse stale evidence?
- Does a token appear in process arguments or logs instead of environment/stdin?
- Does an action or container float by mutable tag when the repo expects pins?
- Does consolidation silently remove a check from the aggregate audit trail?
- Does a local pass omit hosted services, OS packages, container behavior, or a
  release classifier exercised only in CI?

Resolve the cause of red hosted jobs at their owning boundary. Do not weaken the
aggregate or mark a missing proof as skipped to make the rollup green.

## Implementation proof

Add focused regression coverage for workflow parsing, trigger/job-name behavior,
classifier unknown paths, aggregate success/failure semantics, dependency-version
coupling, and any consolidated command. Keep the audit trail named after jobs
that still exist; do not alias one result under a removed lane name.

Run focused tests while editing, then the repository's full required local gate
on the exact candidate commit. Push the normal draft/ready flow and inspect the
live rollup:

1. Confirm the draft path allocates only its intended feedback work and does not
   create the required merge context.
2. Mark ready once and confirm the required context materializes literally.
3. Verify all hosted-only and risk-area jobs, not only the aggregate.
4. After merge, watch the first `main` integrity run because that event cannot be
   fully proven by a PR event.

Inspect unresolved review threads on the final head. Classify each as current,
outdated because its code was removed, or valid follow-up hardening. Do not churn
an otherwise green PR for repository-wide policy work that belongs in a focused
follow-up.

## Deliverable

Lead with the verdict and the largest measured wins. Include:

- baseline and exclusions;
- current gate/property map;
- recommendations ranked by saving, complexity, and integrity risk;
- changes implemented or deliberately withheld;
- exact commit and local/hosted proof boundaries;
- projected savings and a post-rollout measurement window;
- remaining CI-only proof, first-main-run observation, and follow-up work.

State explicitly when a result is green, budget-blocked, unmeasured, or only
locally proven.
