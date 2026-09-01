# CI Optimize

Workflow module for `/engineering ci-optimize`.

Make CI cheaper and more useful without weakening what it proves. Favor a few
measurable, maintainable changes over elaborate routing, caching, or proof-reuse
systems.

## Process

### 1. Map the delivery contract

Read current workflows, branch or merge rules, required checks, release rules,
and representative run history. Historical results establish a baseline; the
current revision and live rules establish authority.

Complete this step when you can name every candidate-producing event, its
required context, and which proof is local, service-backed, or hosted-only.

### 2. Build the baseline

Measure feedback latency, runner time, billed time, setup overhead, cancelled
work, and failure causes separately. Remove quota, account, and zero-step
infrastructure failures from code-performance calculations while retaining them
as operational cost or reliability evidence.

Complete this step when the sample window, exclusions, dominant costs, current
critical path, and confidence limits are explicit.

### 3. Choose the smallest structural win

Adapt these candidates to the project:

- cancel superseded work and give drafts or intermediate changes a bounded fast
  feedback path;
- reserve complete certification for candidates that can actually merge or
  release;
- avoid running unrelated lanes while keeping unknown changes fail-safe;
- consolidate compatible short jobs when repeated setup or per-job billing
  dominates;
- remove duplicate post-merge proof only when the merged result is demonstrably
  the same result already certified;
- reuse immutable environments and safely parallelize isolated work when the
  measured payoff exceeds the added ownership.

Rank opportunities by expected saving, implementation complexity, and integrity
risk. Complete this step when the chosen change has a measurable prediction, a
named invariant, and less ownership than the waste it removes.

### 4. Preserve candidate proof

Optimize the complete candidate rather than its latest commit. A documentation-
only follow-up can still belong to a broad unmerged change. Reuse earlier proof
only when its provenance, revision, base, controls, ancestry, and affected
surface are trustworthy. Prefer fresh proof when reuse requires a large trust
system with an unmeasured hit rate.

Treat fast feedback as a bounded workload, not a command name. Bound selection,
widening, and concurrency, then measure a broad representative candidate.
Conditional jobs, consolidation, and unknown paths must preserve the required
contexts and fail-safe behavior.

Complete this step when every skipped or reused lane has an authoritative reason
and a missing premise selects fresh proof or a clear failure.

### 5. Certify changed events

For implementations, observe the first real execution of every changed draft,
ready, merge, release, or main-branch path. Exercise its fail-safe path when
applicable. Local success is evidence for local behavior; hosted services,
runner images, permissions, containers, and event semantics require hosted
evidence.

Complete this step when each changed event has a live result on the intended
revision and unresolved failures are classified at their owning boundary.

### 6. Measure the rollout

Before rollout, define the cutoff and representative acceptance cohort for each
changed path. Keep three states distinct:

- **implemented:** the intended routing or workload change exists;
- **event-certified:** every changed event path has run successfully, including
  its fail-safe path when applicable;
- **measured:** the acceptance cohort confirms the expected latency, runner time,
  billed time, cancellation, and reliability effect.

Call the optimization complete only when every required state is satisfied.
Otherwise report the exact partial state. Recompute the critical path and
reconcile the durable proof record with the final design, rejected mechanisms,
and follow-up repairs.

Complete this step when the acceptance cohort is measured and the durable record
describes current behavior rather than the original plan.

## Authority

Respect the requested mode and authority. Reviews are read-only. Implementations
may update in-scope CI and supporting tests, but do not merge, alter repository
protection, or trigger unusual external spend without authorization.

## Deliverable

Lead with the decision and largest opportunities. Explain the current cost and
confidence baseline, the recommended or implemented changes, why they preserve
the delivery contract, what was deliberately rejected, and whether the result is
implemented, event-certified, and measured.
