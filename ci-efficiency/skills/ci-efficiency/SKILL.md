---
name: ci-efficiency
disable-model-invocation: true
description: Improve CI speed and cost while preserving the confidence required to merge and release safely. Use for CI audits, optimization plans, implementations, or reviews of proposed pipeline changes.
argument-hint: "[repository or change] [review|plan|implement]"
metadata:
  version: "1.1.0"
---

# CI Efficiency

Make CI cheaper and more useful without weakening what it proves. Favor a few
measurable, maintainable changes over elaborate routing, caching, or proof-reuse
systems.

## Desired outcomes

- Fast, relevant feedback during development.
- Reliable full certification for merge and release candidates.
- Less repeated work, idle setup, cancellation waste, and billing-rounding
  overhead.
- Clear separation between local checks, CI-only proof, infrastructure failures,
  and unverified assumptions.
- A pipeline whose complexity is justified by measured savings.

## Guidance

Understand the repository's actual delivery contract before changing it. Use
current workflows, branch or merge rules, required checks, and representative
run history as evidence. Treat historical results as a baseline, not proof of
the current revision.

Measure the important dimensions separately: feedback latency, runner time,
billed time, setup overhead, cancelled work, and failure causes. Exclude quota,
account, or zero-step infrastructure failures when assessing code performance,
but report them as operational cost or reliability issues.

Look first for simple structural savings, adapting them to the project:

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

Optimize the complete candidate, not merely its latest commit. A documentation-
only follow-up can still belong to a broad unmerged change. Do not reuse earlier
proof unless its provenance, revision, base, controls, ancestry, and affected
surface are trustworthy. Prefer rerunning work to introducing a large trust
system with an unmeasured hit rate.

Preserve the gate's integrity. Conditional or skipped jobs must not accidentally
satisfy required checks. Consolidation must not hide missing proof. Local success
does not establish hosted services, runner images, permissions, containers, or
event-specific behavior.

For implementations, add proof proportionate to the risk and validate the
events whose behavior changed. In particular, observe the first real execution
of a newly introduced draft, ready, merge, release, or main-branch path. Treat a
projected saving as projected until post-rollout runs measure it.

Respect the requested mode and authority. Reviews are read-only. Implementations
may update in-scope CI and supporting tests, but do not merge, alter repository
protection, or trigger unusual external spend without authorization.

## Deliverable

Lead with the decision and largest opportunities. Explain the current cost and
confidence baseline, the recommended or implemented changes, why they preserve
the delivery contract, what was deliberately rejected, and which outcomes remain
unmeasured or require live CI proof.
