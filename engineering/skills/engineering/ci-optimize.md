# CI Optimize

Workflow module for `/engineering ci-optimize`.

Reduce feedback time and compute cost without weakening what green means.
Optimize the whole candidate lifecycle, not one job in isolation. Prefer a few
measured structural changes over machinery whose trust or ownership cost
exceeds its saving.

## Modes

Respect the requested mode:

- **review:** inspect and recommend without changing repository or service state;
- **plan:** define changes, invariants, proof, and expected savings;
- **implement:** make the approved changes and validate every affected path.

## Contract

Start from the delivery contract: current workflows, required checks, merge and
release rules, candidate-producing events, and where each proof can run. Current
configuration and live rules are authority; historical runs are evidence.

Preserve these invariants unless the user explicitly changes them:

- required contexts still certify the exact candidate that can merge or release;
- unknown changes and missing premises select complete proof or fail clearly;
- conditional routing exposes why each lane ran or skipped;
- local checks do not substitute for hosted runner, permission, container, or
  event behavior;
- a later narrow commit does not make a broad unmerged candidate narrow.

The contract is understood when every event and required context has an owner,
an applicability rule, and a named proof boundary.

## Baseline

Build a **bounded baseline** from up to ten recent completed runs per relevant
event. Separate:

- feedback latency and critical path;
- runner or billed time, including repeated setup and per-job rounding;
- cancellations, flakes, and infrastructure or quota failures;
- work that is duplicated, unrelated, serialized, or waiting on setup.

Exclude non-code outages from code-performance calculations, but retain them as
reliability and operational-cost evidence. State the cohort, exclusions,
dominant costs, and uncertainty. Widen the cohort only to resolve an uncertainty
that could change the decision. Investigate older failures only when reliability
is in scope or they could change the recommendation; historical inventory is not
an outcome.

## Changes worth considering

Rank opportunities by expected latency or cost saving, integrity risk, and
ongoing ownership. Common structural wins include:

- a bounded advisory path for drafts or intermediate work, followed by complete
  certification for a merge or release candidate;
- cancellation of work made obsolete by a newer candidate, while preserving
  independent release or main-branch runs;
- consolidation of compatible short jobs when setup or billing dominates;
- safe parallelism for demonstrably isolated tests;
- reuse of immutable, version-aligned environments;
- conservative changed-surface routing, with unknown paths selecting full proof;
- removal of post-merge work only when the resulting tree and prior successful
  proof are both authoritative.

Treat caching, sharding, and cross-commit proof reuse as investments, not default
answers. Adopt them only when measured savings justify their invalidation,
provenance, and maintenance surface.

Choose a change when its expected saving is measurable, its preserved invariant
is explicit, and its mechanism is simpler to own than the waste it removes.

## Proof and completion

For implementations, validate locally where useful, then observe every changed
draft, ready, merge, main, release, or manual event on the intended revision.
Exercise conservative fallback when routing or proof reuse can skip work.

Report these states separately:

- **implemented:** the intended routing or workload change exists;
- **event-certified:** every changed event path has run successfully, including
  its fail-safe path when applicable;
- **measured:** a representative post-change cohort confirms the latency, compute,
  cancellation, and reliability effect.

The optimization is complete when every required state is satisfied and the
durable documentation describes the final behavior, rejected mechanisms, and
remaining measurement gaps.

## Authority

Implementations may update in-scope CI and supporting tests. Merge, repository
protection, and unusual external spend require explicit authority.

## Deliverable

Lead with the decision and largest opportunities. Include the baseline, expected
or measured savings, preserved invariants, rejected complexity, and the exact
completion state.
